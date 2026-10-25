import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'mxn' })
export class MxnPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value ?? 0);
  }
}
