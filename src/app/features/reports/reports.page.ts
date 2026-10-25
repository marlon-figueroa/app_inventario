import { Component, inject, signal } from '@angular/core';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { periodCaption, shiftPeriod, todayIso } from '../../core/dates';
import { ReportPeriod, ReportResult } from '../../core/models';
import { DisplayDatePipe, MovementReasonLabelPipe, MovementTypeLabelPipe } from '../../shared/label.pipe';
import { MxnPipe } from '../../shared/mxn.pipe';
import { CsvService } from '../../core/export/csv.service';
import { PAYMENT_METHOD_LABELS } from '../../core/labels';
import { ReportService } from './report.service';

@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButton,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonList,
    IonItem,
    IonNote,
    MxnPipe,
    MovementTypeLabelPipe,
    MovementReasonLabelPipe,
    DisplayDatePipe,
  ],
})
export class ReportsPage {
  private reportsApi = inject(ReportService);
  private csv = inject(CsvService);
  private toastCtrl = inject(ToastController);

  paymentLabels = PAYMENT_METHOD_LABELS;

  period = signal<ReportPeriod>('month');
  reference = signal(todayIso());
  report = signal<ReportResult | null>(null);
  groupTab = signal<'category' | 'brand' | 'supplier'>('category');

  caption(): string {
    const current = this.report();
    if (!current) {
      return '';
    }
    return periodCaption(current.period, current.from, current.to);
  }

  async ionViewWillEnter(): Promise<void> {
    await this.reload();
  }

  async setPeriod(period: string | number | undefined): Promise<void> {
    if (period === 'day' || period === 'week' || period === 'month' || period === 'year') {
      this.period.set(period);
      await this.reload();
    }
  }

  async shift(direction: -1 | 1): Promise<void> {
    this.reference.set(shiftPeriod(this.period(), this.reference(), direction));
    await this.reload();
  }

  async reload(): Promise<void> {
    this.report.set(await this.reportsApi.summarize(this.period(), this.reference()));
  }

  groupedRows(current: ReportResult) {
    if (this.groupTab() === 'brand') {
      return current.byBrand;
    }
    if (this.groupTab() === 'supplier') {
      return current.bySupplier;
    }
    return current.byCategory;
  }

  async exportInventory(): Promise<void> {
    try {
      const content = await this.reportsApi.exportInventoryCsv();
      await this.csv.downloadOrShare(`inventario-${todayIso()}.csv`, content);
    } catch (error) {
      await this.showExportError(error);
    }
  }

  async exportPeriodMovements(): Promise<void> {
    const current = this.report();
    if (!current) {
      return;
    }
    try {
      const content = await this.reportsApi.exportMovementsCsv(current.from, current.to);
      await this.csv.downloadOrShare(`movimientos-${current.from}-${current.to}.csv`, content);
    } catch (error) {
      await this.showExportError(error);
    }
  }

  async exportPeriodSales(): Promise<void> {
    const current = this.report();
    if (!current) {
      return;
    }
    try {
      const content = await this.reportsApi.exportSalesCsv(current.from, current.to);
      await this.csv.downloadOrShare(`ventas-${current.from}-${current.to}.csv`, content);
    } catch (error) {
      await this.showExportError(error);
    }
  }

  private async showExportError(error: unknown): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: error instanceof Error ? error.message : 'No se pudo exportar',
      duration: 2200,
      color: 'dark',
    });
    await toast.present();
  }
}
