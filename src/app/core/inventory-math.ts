import { roundMoney, roundQty } from './money';
import { MovementType } from './models';

export interface ReplayMovement {
  id: string;
  type: MovementType;
  quantity: number;
  unitCost: number | null;
  date: string;
  createdAt: string;
}

export interface ReplayResult {
  stock: number;
  avgCost: number;
  /** unit_cost fijado por movimiento (salidas y ajustes) */
  unitCostsById: Map<string, number>;
}

export class InsufficientStockError extends Error {
  constructor(
    public readonly requested: number,
    public readonly available: number
  ) {
    super(`Stock insuficiente: solicitado ${requested}, disponible ${available}.`);
    this.name = 'InsufficientStockError';
  }
}

export function replay(movements: ReplayMovement[]): ReplayResult {
  const sorted = [...movements].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) {
      return d;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });

  let stock = 0;
  let avgCost = 0;
  const unitCostsById = new Map<string, number>();

  for (const m of sorted) {
    if (m.type === 'entry') {
      const qty = roundQty(Math.abs(m.quantity));
      const cost = roundMoney(m.unitCost ?? 0);
      if (qty <= 0) {
        continue;
      }
      const totalValue = stock * avgCost + qty * cost;
      stock = roundQty(stock + qty);
      avgCost = stock > 0 ? roundMoney(totalValue / stock) : 0;
      continue;
    }

    if (m.type === 'exit') {
      const qty = roundQty(Math.abs(m.quantity));
      if (qty <= 0) {
        continue;
      }
      if (stock < qty - 1e-9) {
        throw new InsufficientStockError(qty, stock);
      }
      unitCostsById.set(m.id, avgCost);
      stock = roundQty(stock - qty);
      if (stock <= 1e-9) {
        stock = 0;
        avgCost = 0;
      }
      continue;
    }

    // adjustment: quantity is signed delta
    const delta = roundQty(m.quantity);
    if (delta === 0) {
      continue;
    }
    if (delta > 0) {
      const cost = roundMoney(m.unitCost ?? avgCost);
      const totalValue = stock * avgCost + delta * cost;
      stock = roundQty(stock + delta);
      avgCost = stock > 0 ? roundMoney(totalValue / stock) : 0;
      unitCostsById.set(m.id, cost);
    } else {
      const qty = roundQty(Math.abs(delta));
      if (stock < qty - 1e-9) {
        throw new InsufficientStockError(qty, stock);
      }
      unitCostsById.set(m.id, avgCost);
      stock = roundQty(stock - qty);
      if (stock <= 1e-9) {
        stock = 0;
        avgCost = 0;
      }
    }
  }

  return { stock, avgCost, unitCostsById };
}
