import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { periodRange, todayIso } from '../../core/dates';
import { ProductStock } from '../../core/models';
import { DisplayDatePipe, MovementReasonLabelPipe, MovementTypeLabelPipe } from '../../shared/label.pipe';
import { MxnPipe } from '../../shared/mxn.pipe';
import { StockMovementService } from '../movements/stock-movement.service';
import { ProductService } from '../products/product.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonBadge,
  IonButton,
  IonSpinner,
    RouterLink,
    MxnPipe,
    DisplayDatePipe,
    MovementTypeLabelPipe,
    MovementReasonLabelPipe,
  ],
})
export class DashboardPage {
  private productsApi = inject(ProductService);
  private movementsApi = inject(StockMovementService);

  loading = signal(true);
  summary = signal({ productCount: 0, inventoryValue: 0, lowStockCount: 0 });
  lowStock = signal<ProductStock[]>([]);
  monthTotals = signal({ entryQty: 0, exitQty: 0, adjustmentQty: 0 });
  recentMovements = signal<
    Array<{ id: string; type: string; productName: string; date: string; quantity: number; reason: string }>
  >([]);

  hasLowStock = computed(() => this.lowStock().length > 0);

  async ionViewWillEnter(): Promise<void> {
    await this.reload();
  }

  async reload(event?: CustomEvent): Promise<void> {
    this.loading.set(true);
    const range = periodRange('month', todayIso());
    const [summary, products, totals, movements] = await Promise.all([
      this.productsApi.summary(),
      this.productsApi.list({ lowStockOnly: true }),
      this.movementsApi.totalsInRange(range.from, range.to),
      this.movementsApi.list({ from: range.from, to: range.to }),
    ]);

    const productMap = new Map(
      (await this.productsApi.list({ activeOnly: false })).map((p) => [p.id, p.name])
    );

    this.summary.set(summary);
    this.lowStock.set(products.slice(0, 8));
    this.monthTotals.set(totals);
    this.recentMovements.set(
      movements.slice(0, 10).map((m) => ({
        id: m.id,
        type: m.type,
        productName: productMap.get(m.productId) ?? '—',
        date: m.date,
        quantity: m.quantity,
        reason: m.reason,
      }))
    );
    this.loading.set(false);
    await event?.detail.complete();
  }
}
