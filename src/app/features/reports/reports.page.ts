import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
} from '@ionic/angular';
import { periodCaption, shiftPeriod, todayIso } from '../../core/dates';
import { ReportPeriod, ReportResult } from '../../core/models';
import { DisplayDatePipe, MovementReasonLabelPipe, MovementTypeLabelPipe } from '../../shared/label.pipe';
import { MxnPipe } from '../../shared/mxn.pipe';
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
    RouterLink,
    MxnPipe,
    MovementTypeLabelPipe,
    MovementReasonLabelPipe,
    DisplayDatePipe,
  ],
})
export class ReportsPage {
  private reportsApi = inject(ReportService);
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
}
