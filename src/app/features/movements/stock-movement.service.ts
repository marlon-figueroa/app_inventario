import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../core/database/database.service';
import { createId } from '../../core/ids';
import { InsufficientStockError } from '../../core/inventory-math';
import { roundMoney, roundQty } from '../../core/money';
import {
  AdjustmentInput,
  MovementType,
  StockMovement,
  StockMovementInput,
} from '../../core/models';
import { InventoryStockService } from '../products/inventory-stock.service';

interface MovementRow {
  id: string;
  product_id: string;
  type: MovementType;
  quantity: number;
  unit_cost: number | null;
  unit_price: number | null;
  reason: string;
  reference: string | null;
  document_id: string | null;
  date: string;
  notes: string | null;
  created_at: string;
}

export interface MovementListFilters {
  productId?: string;
  type?: MovementType;
  from?: string;
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class StockMovementService {
  private db = inject(DatabaseService);
  private stock = inject(InventoryStockService);

  async list(filters: MovementListFilters = {}): Promise<StockMovement[]> {
    const where: string[] = [];
    const values: unknown[] = [];
    if (filters.productId) {
      where.push('product_id = ?');
      values.push(filters.productId);
    }
    if (filters.type) {
      where.push('type = ?');
      values.push(filters.type);
    }
    if (filters.from) {
      where.push('date >= ?');
      values.push(filters.from);
    }
    if (filters.to) {
      where.push('date <= ?');
      values.push(filters.to);
    }
    const sql = `SELECT * FROM stock_movements ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY date DESC, created_at DESC;`;
    const rows = await this.db.query<MovementRow>(sql, values);
    return rows.map((row) => this.map(row));
  }

  async listForProduct(productId: string, limit = 50): Promise<StockMovement[]> {
    const rows = await this.db.query<MovementRow>(
      `SELECT * FROM stock_movements WHERE product_id=? ORDER BY date DESC, created_at DESC LIMIT ?;`,
      [productId, limit]
    );
    return rows.map((row) => this.map(row));
  }

  async get(id: string): Promise<StockMovement | null> {
    const rows = await this.db.query<MovementRow>('SELECT * FROM stock_movements WHERE id=?;', [id]);
    return rows[0] ? this.map(rows[0]) : null;
  }

  async create(input: StockMovementInput): Promise<string> {
    const id = createId();
    const quantity = this.normalizeQuantity(input);
    return this.withRecalculate(input.productId, async () => {
      await this.insertMovement(id, { ...input, quantity }, false);
      return id;
    });
  }

  async createAdjustment(input: AdjustmentInput): Promise<string> {
    const current = await this.stock.currentStock(input.productId);
    const counted = roundQty(input.countedQuantity);
    const delta = roundQty(counted - current);
    if (Math.abs(delta) < 1e-9) {
      throw new Error('La cantidad contada coincide con el stock actual.');
    }
    const id = createId();
    return this.withRecalculate(input.productId, async () => {
      await this.insertMovement(
        id,
        {
          productId: input.productId,
          type: 'adjustment',
          quantity: delta,
          unitCost: null,
          unitPrice: null,
          reason: input.reason,
          reference: input.reference,
          date: input.date,
          notes: input.notes,
        },
        false
      );
      return id;
    });
  }

  async update(id: string, input: StockMovementInput): Promise<void> {
    const previous = await this.get(id);
    if (!previous) {
      return;
    }
    if (previous.documentId) {
      throw new Error(
        'Este movimiento pertenece a una venta o compra. Cancélala desde Operaciones.'
      );
    }
    const quantity = this.normalizeQuantity(input);
    const conn = this.db.getConnection();
    await conn.beginTransaction();
    try {
      await conn.run(
        `UPDATE stock_movements SET
          product_id=?, type=?, quantity=?, unit_cost=?, unit_price=?, reason=?, reference=?, document_id=?, date=?, notes=?
         WHERE id=?;`,
        [
          input.productId,
          input.type,
          quantity,
          input.type === 'entry' ? roundMoney(input.unitCost ?? 0) : null,
          input.type === 'exit' ? roundMoney(input.unitPrice ?? 0) : null,
          input.reason,
          input.reference?.trim() || null,
          input.documentId ?? null,
          input.date,
          input.notes?.trim() || null,
          id,
        ],
        false
      );
      await this.stock.recalculate(input.productId);
      if (previous.productId !== input.productId) {
        await this.stock.recalculate(previous.productId);
      }
      await conn.commitTransaction();
      await this.db.persist();
    } catch (error) {
      await conn.rollbackTransaction();
      if (error instanceof InsufficientStockError) {
        throw new Error(error.message);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const previous = await this.get(id);
    if (!previous) {
      return;
    }
    if (previous.documentId) {
      throw new Error(
        'Este movimiento pertenece a una venta o compra. Cancélala desde Operaciones.'
      );
    }
    await this.withRecalculate(previous.productId, async () => {
      await this.db.getConnection().run('DELETE FROM stock_movements WHERE id=?;', [id], false);
    });
  }

  async totalsInRange(from: string, to: string): Promise<{
    entryQty: number;
    exitQty: number;
    adjustmentQty: number;
  }> {
    const rows = await this.db.query<{
      entry_qty: number;
      exit_qty: number;
      adj_qty: number;
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN type='entry' THEN ABS(quantity) ELSE 0 END), 0) AS entry_qty,
         COALESCE(SUM(CASE WHEN type='exit' THEN ABS(quantity) ELSE 0 END), 0) AS exit_qty,
         COALESCE(SUM(CASE WHEN type='adjustment' THEN quantity ELSE 0 END), 0) AS adj_qty
       FROM stock_movements WHERE date >= ? AND date <= ?;`,
      [from, to]
    );
    const row = rows[0];
    return {
      entryQty: roundQty(Number(row?.entry_qty ?? 0)),
      exitQty: roundQty(Number(row?.exit_qty ?? 0)),
      adjustmentQty: roundQty(Number(row?.adj_qty ?? 0)),
    };
  }

  private async withRecalculate<T>(productId: string, fn: () => Promise<T>): Promise<T> {
    const conn = this.db.getConnection();
    await conn.beginTransaction();
    try {
      const result = await fn();
      await this.stock.recalculate(productId);
      await conn.commitTransaction();
      await this.db.persist();
      return result;
    } catch (error) {
      await conn.rollbackTransaction();
      if (error instanceof InsufficientStockError) {
        throw new Error(error.message);
      }
      throw error;
    }
  }

  private async insertMovement(id: string, input: StockMovementInput, persist = true): Promise<void> {
    const quantity = this.normalizeQuantity(input);
    const conn = this.db.getConnection();
    const run = persist
      ? (sql: string, values: unknown[]) => this.db.run(sql, values)
      : (sql: string, values: unknown[]) => conn.run(sql, values, false);
    await run(
      `INSERT INTO stock_movements (
        id, product_id, type, quantity, unit_cost, unit_price, reason, reference, document_id, date, notes, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?);`,
      [
        id,
        input.productId,
        input.type,
        quantity,
        input.type === 'entry' ? roundMoney(input.unitCost ?? 0) : null,
        input.type === 'exit' ? roundMoney(input.unitPrice ?? 0) : null,
        input.reason,
        input.reference?.trim() || null,
        input.documentId ?? null,
        input.date,
        input.notes?.trim() || null,
        new Date().toISOString(),
      ]
    );
  }

  private normalizeQuantity(input: StockMovementInput): number {
    const q = roundQty(Math.abs(input.quantity));
    if (q <= 0) {
      throw new Error('La cantidad debe ser mayor que cero.');
    }
    if (input.type === 'adjustment') {
      return roundQty(input.quantity);
    }
    return q;
  }

  private map(row: MovementRow): StockMovement {
    return {
      id: row.id,
      productId: row.product_id,
      type: row.type,
      quantity: Number(row.quantity),
      unitCost: row.unit_cost,
      unitPrice: row.unit_price,
      reason: row.reason,
      reference: row.reference,
      documentId: row.document_id,
      date: row.date,
      notes: row.notes,
      createdAt: row.created_at,
    };
  }
}
