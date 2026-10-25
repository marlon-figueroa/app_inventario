import { describe, expect, it } from 'vitest';
import { InsufficientStockError, replay } from './inventory-math';

describe('replay', () => {
  it('calcula costo promedio en entradas', () => {
    const result = replay([
      {
        id: '1',
        type: 'entry',
        quantity: 10,
        unitCost: 100,
        date: '2026-01-01',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '2',
        type: 'entry',
        quantity: 10,
        unitCost: 200,
        date: '2026-01-02',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
    expect(result.stock).toBe(20);
    expect(result.avgCost).toBe(150);
  });

  it('descuenta salida al costo promedio vigente', () => {
    const result = replay([
      {
        id: '1',
        type: 'entry',
        quantity: 10,
        unitCost: 100,
        date: '2026-01-01',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '2',
        type: 'exit',
        quantity: 4,
        unitCost: null,
        date: '2026-01-03',
        createdAt: '2026-01-03T00:00:00.000Z',
      },
    ]);
    expect(result.stock).toBe(6);
    expect(result.avgCost).toBe(100);
    expect(result.unitCostsById.get('2')).toBe(100);
  });

  it('rechaza salida sin stock', () => {
    expect(() =>
      replay([
        {
          id: '1',
          type: 'exit',
          quantity: 1,
          unitCost: null,
          date: '2026-01-01',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ])
    ).toThrow(InsufficientStockError);
  });

  it('aplica ajuste positivo y negativo', () => {
    const result = replay([
      {
        id: '1',
        type: 'entry',
        quantity: 10,
        unitCost: 50,
        date: '2026-01-01',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '2',
        type: 'adjustment',
        quantity: -2,
        unitCost: null,
        date: '2026-01-02',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
      {
        id: '3',
        type: 'adjustment',
        quantity: 3,
        unitCost: 60,
        date: '2026-01-03',
        createdAt: '2026-01-03T00:00:00.000Z',
      },
    ]);
    expect(result.stock).toBe(11);
    expect(result.avgCost).toBeCloseTo(52.73, 1);
  });
});
