import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBadge,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { documentFolioLabel, DOCUMENT_TYPE_LABELS, PAYMENT_METHOD_LABELS } from '../../core/labels';
import { InventoryDocument } from '../../core/models';
import { DisplayDatePipe } from '../../shared/label.pipe';
import { MxnPipe } from '../../shared/mxn.pipe';
import { MovementsPage } from '../movements/movements.page';
import { DocumentService } from './document.service';

type OperationsSegment = 'sales' | 'purchases' | 'movements';

@Component({
  selector: 'app-operations',
  templateUrl: './operations.page.html',
  styleUrls: ['./operations.page.scss'],
  imports: [
    MovementsPage,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonRefresher,
    IonRefresherContent,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonBadge,
    IonIcon,
    IonFab,
    IonFabButton,
    RouterLink,
    MxnPipe,
    DisplayDatePipe,
  ],
})
export class OperationsPage {
  private documentsApi = inject(DocumentService);

  segment = signal<OperationsSegment>('sales');
  sales = signal<InventoryDocument[]>([]);
  purchases = signal<InventoryDocument[]>([]);

  documentTypeLabels = DOCUMENT_TYPE_LABELS;
  paymentLabels = PAYMENT_METHOD_LABELS;

  async ionViewWillEnter(): Promise<void> {
    await this.reload();
  }

  async reload(event?: CustomEvent): Promise<void> {
    const [sales, purchases] = await Promise.all([
      this.documentsApi.list('sale'),
      this.documentsApi.list('purchase'),
    ]);
    this.sales.set(sales);
    this.purchases.set(purchases);
    await event?.detail.complete();
  }

  setSegment(value: OperationsSegment): void {
    this.segment.set(value);
  }

  folioLabel(doc: InventoryDocument): string {
    return documentFolioLabel(doc.type, doc.folio);
  }

  fabLink(): string {
    if (this.segment() === 'purchases') {
      return '/tabs/operaciones/compra/nueva';
    }
    return '/tabs/operaciones/venta/nueva';
  }

  showFab(): boolean {
    return this.segment() !== 'movements';
  }
}
