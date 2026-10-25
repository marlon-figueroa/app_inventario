import { Pipe, PipeTransform } from '@angular/core';
import {
  MOVEMENT_TYPE_LABELS,
  PERIOD_LABELS,
  PRODUCT_UNIT_LABELS,
  reasonLabel,
} from '../core/labels';
import { MovementType, ProductUnit, ReportPeriod } from '../core/models';

@Pipe({ name: 'productUnitLabel' })
export class ProductUnitLabelPipe implements PipeTransform {
  transform(value: ProductUnit | string): string {
    return PRODUCT_UNIT_LABELS[value as ProductUnit] ?? value;
  }
}

@Pipe({ name: 'movementTypeLabel' })
export class MovementTypeLabelPipe implements PipeTransform {
  transform(value: MovementType | string): string {
    return MOVEMENT_TYPE_LABELS[value as MovementType] ?? value;
  }
}

@Pipe({ name: 'movementReasonLabel' })
export class MovementReasonLabelPipe implements PipeTransform {
  transform(reason: string, type: MovementType): string {
    return reasonLabel(type, reason);
  }
}

@Pipe({ name: 'periodLabel' })
export class PeriodLabelPipe implements PipeTransform {
  transform(value: ReportPeriod | string): string {
    return PERIOD_LABELS[value as ReportPeriod] ?? value;
  }
}

@Pipe({ name: 'displayDate' })
export class DisplayDatePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
