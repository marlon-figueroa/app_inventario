import {
  AdjustmentReason,
  DocumentType,
  EntryReason,
  ExitReason,
  MovementType,
  PaymentMethod,
  ProductUnit,
  ReportPeriod,
} from './models';

export const PRODUCT_UNIT_LABELS: Record<ProductUnit, string> = {
  pieza: 'Pieza',
  caja: 'Caja',
  kg: 'Kilogramo',
  litro: 'Litro',
  metro: 'Metro',
  rollo: 'Rollo',
  par: 'Par',
  juego: 'Juego',
  bulto: 'Bulto',
  galon: 'Galón',
  saco: 'Saco',
  bolsa: 'Bolsa',
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  entry: 'Entrada',
  exit: 'Salida',
  adjustment: 'Ajuste',
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  sale: 'Venta',
  purchase: 'Compra',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
};

export const ENTRY_REASON_LABELS: Record<EntryReason, string> = {
  compra: 'Compra',
  devolucion_cliente: 'Devolución de cliente',
  otro: 'Otro',
};

export const EXIT_REASON_LABELS: Record<ExitReason, string> = {
  venta: 'Venta',
  consumo: 'Consumo interno',
  devolucion_proveedor: 'Devolución a proveedor',
  otro: 'Otro',
};

export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = {
  conteo: 'Conteo físico',
  merma: 'Merma',
  dano: 'Daño',
  caducidad: 'Caducidad',
  otro: 'Otro',
};

export const PERIOD_LABELS: Record<ReportPeriod, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
  year: 'Año',
};

export function reasonLabel(type: MovementType, reason: string): string {
  if (type === 'entry') {
    return ENTRY_REASON_LABELS[reason as EntryReason] ?? reason;
  }
  if (type === 'exit') {
    return EXIT_REASON_LABELS[reason as ExitReason] ?? reason;
  }
  return ADJUSTMENT_REASON_LABELS[reason as AdjustmentReason] ?? reason;
}

export function documentFolioLabel(type: DocumentType, folio: number): string {
  const prefix = type === 'sale' ? 'V' : 'C';
  return `${prefix}-${String(folio).padStart(6, '0')}`;
}
