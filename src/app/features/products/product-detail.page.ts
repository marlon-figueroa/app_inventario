import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { ProductStock, StockMovement } from '../../core/models';
import {
  DisplayDatePipe,
  MovementReasonLabelPipe,
  MovementTypeLabelPipe,
  ProductUnitLabelPipe,
} from '../../shared/label.pipe';
import { EntityImageComponent } from '../../shared/entity-image.component';
import { MxnPipe } from '../../shared/mxn.pipe';
import { StockMovementService } from '../movements/stock-movement.service';
import { ProductService } from './product.service';

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.page.html',
  styleUrls: ['./product-detail.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonBadge,
    IonButton,
    EntityImageComponent,
  RouterLink,
    MxnPipe,
    ProductUnitLabelPipe,
    DisplayDatePipe,
    MovementTypeLabelPipe,
    MovementReasonLabelPipe,
  ],
})
export class ProductDetailPage {
  private productsApi = inject(ProductService);
  private movementsApi = inject(StockMovementService);

  id = input.required<string>();
  product = signal<ProductStock | null>(null);
  movements = signal<StockMovement[]>([]);

  async ionViewWillEnter(): Promise<void> {
    const id = this.id();
    const [product, movements] = await Promise.all([
      this.productsApi.get(id),
      this.movementsApi.listForProduct(id),
    ]);
    this.product.set(product);
    this.movements.set(movements);
  }

  movementQuery(type: 'entry' | 'exit' | 'adjustment'): Record<string, string> {
    return { productId: this.id(), type };
  }
}
