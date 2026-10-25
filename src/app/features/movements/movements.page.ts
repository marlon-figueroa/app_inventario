import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AlertController,
  IonBadge,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { MovementType, StockMovement } from '../../core/models';
import { DisplayDatePipe, MovementReasonLabelPipe, MovementTypeLabelPipe } from '../../shared/label.pipe';
import { MxnPipe } from '../../shared/mxn.pipe';
import { ProductService } from '../products/product.service';
import { StockMovementService } from './stock-movement.service';

@Component({
  selector: 'app-movements',
  templateUrl: './movements.page.html',
  styleUrls: ['./movements.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonSelect,
    IonSelectOption,
    IonList,
    IonItem,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonLabel,
    IonNote,
    IonBadge,
    IonIcon,
    IonFab,
    IonFabButton,
    RouterLink,
    MxnPipe,
    DisplayDatePipe,
    MovementTypeLabelPipe,
    MovementReasonLabelPipe,
  ],
})
export class MovementsPage {
  private movementsApi = inject(StockMovementService);
  private productsApi = inject(ProductService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  movements = signal<Array<StockMovement & { productName: string; productSku: string }>>([]);
  typeFilter = signal<MovementType | ''>('');
  productFilter = signal('');
  products = signal<{ id: string; name: string }[]>([]);

  async ionViewWillEnter(): Promise<void> {
    const products = await this.productsApi.list({ activeOnly: false });
    this.products.set(products.map((p) => ({ id: p.id, name: p.name })));
    await this.reload();
  }

  async reload(event?: CustomEvent): Promise<void> {
    const rows = await this.movementsApi.list({
      type: this.typeFilter() || undefined,
      productId: this.productFilter() || undefined,
    });
    const productMap = new Map(
      (await this.productsApi.list({ activeOnly: false })).map((p) => [p.id, p])
    );
    this.movements.set(
      rows.map((m) => ({
        ...m,
        productName: productMap.get(m.productId)?.name ?? '—',
        productSku: productMap.get(m.productId)?.sku ?? '',
      }))
    );
    await event?.detail.complete();
  }

  typeColor(type: MovementType): string {
    if (type === 'entry') {
      return 'success';
    }
    if (type === 'exit') {
      return 'warning';
    }
    return 'medium';
  }

  async confirmDelete(item: StockMovement): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar movimiento',
      message: 'Se recalculará el stock del producto.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.movementsApi.remove(item.id);
              await this.reload();
            } catch (error) {
              const toast = await this.toastCtrl.create({
                message: error instanceof Error ? error.message : 'No se pudo eliminar',
                duration: 2200,
                color: 'dark',
              });
              await toast.present();
            }
          },
        },
      ],
    });
    await alert.present();
  }
}
