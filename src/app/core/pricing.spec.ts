import { describe, expect, it } from 'vitest';
import { documentSubtotal, documentTotal, pickUnitPrice } from './pricing';

describe('pickUnitPrice', () => {
  it('usa precio de mayoreo cuando aplica', () => {
    expect(
      pickUnitPrice(10, { salePrice: 100, wholesalePrice: 80, wholesaleMinQty: 5 })
    ).toBe(80);
  });

  it('usa precio de venta por debajo del mínimo de mayoreo', () => {
    expect(
      pickUnitPrice(3, { salePrice: 100, wholesalePrice: 80, wholesaleMinQty: 5 })
    ).toBe(100);
  });
});

describe('document totals', () => {
  it('calcula subtotal y total con descuento', () => {
    const subtotal = documentSubtotal([{ lineTotal: 50 }, { lineTotal: 30 }]);
    expect(subtotal).toBe(80);
    expect(documentTotal(subtotal, 10)).toBe(70);
  });
});
