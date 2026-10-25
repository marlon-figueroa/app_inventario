import { roundMoney } from './money';

export interface WholesalePriceInput {
  salePrice: number;
  wholesalePrice: number;
  wholesaleMinQty: number;
}

/** Precio unitario sugerido según cantidad y reglas de mayoreo. */
export function pickUnitPrice(
  quantity: number,
  product: WholesalePriceInput
): number {
  const qty = quantity;
  if (
    product.wholesaleMinQty > 0 &&
    qty >= product.wholesaleMinQty &&
    product.wholesalePrice > 0
  ) {
    return roundMoney(product.wholesalePrice);
  }
  return roundMoney(product.salePrice);
}

export function documentLineTotal(quantity: number, unitAmount: number): number {
  return roundMoney(quantity * unitAmount);
}

export function documentSubtotal(lines: Array<{ lineTotal: number }>): number {
  return roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0));
}

export function documentTotal(subtotal: number, discount: number): number {
  return roundMoney(Math.max(0, subtotal - discount));
}
