import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonBadge,
  IonButtons,
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
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { Supplier } from '../../core/models';
import { SupplierService } from './supplier.service';

@Component({
  selector: 'app-suppliers',
  templateUrl: './suppliers.page.html',
  styleUrls: ['./catalogs.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonList,
    IonItem,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonLabel,
    IonBadge,
    IonIcon,
    IonFab,
    IonFabButton,
    RouterLink,
  ],
})
export class SuppliersPage {
  private api = inject(SupplierService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  items = signal<Supplier[]>([]);

  async ionViewWillEnter(): Promise<void> {
    await this.reload();
  }

  async reload(event?: CustomEvent): Promise<void> {
    this.items.set(await this.api.list());
    await event?.detail.complete();
  }

  async confirmDelete(item: Supplier): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar proveedor',
      message: `¿Eliminar ${item.name}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.api.remove(item.id);
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
