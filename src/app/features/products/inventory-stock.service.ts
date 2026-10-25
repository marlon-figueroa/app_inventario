import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../core/database/database.service';
import { InsufficientStockError, replay } from '../../core/inventory-math';
import { roundMoney, roundQty } from '../../core/money';
import { MovementType } from '../../core/models';

interface MovementRow {
  id: string;
  type: MovementType;
  quantity: number;
  unit_cost: number | null;
  date: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class InventoryStockService {
  private db = inject(DatabaseService);

  async recalculate(productId: string): Promise<void> {
    const rows = await this.db.query<MovementRow>(
      'SELECT id, type, quantity, unit_cost, date, created_at FROM stock_movements WHERE product_id=?;',
      [productId]
    );
    const movements = rows.map((row) => ({
      id: row.id,
      type: row.type,
      quantity: Number(row.quantity),
      unitCost: row.unit_cost,
      date: row.date,
      createdAt: row.created_at,
    }));

    let result;
    try {
      result = replay(movements);
    } catch (error) {
      if (error instanceof InsufficientStockError) {
        throw error;
      }
      throw error;
    }

    const conn = this.db.getConnection();
    for (const [movementId, cost] of result.unitCostsById) {
      await conn.run('UPDATE stock_movements SET unit_cost=? WHERE id=?;', [cost, movementId], false);
    }

    await conn.run(
      'UPDATE products SET stock=?, avg_cost=?, updated_at=? WHERE id=?;',
      [result.stock, result.avgCost, new Date().toISOString(), productId],
      false
    );
  }

  async currentStock(productId: string): Promise<number> {
    const rows = await this.db.query<{ stock: number }>('SELECT stock FROM products WHERE id=?;', [
      productId,
    ]);
    return roundQty(Number(rows[0]?.stock ?? 0));
  }
}
