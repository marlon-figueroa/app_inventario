import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../core/database/database.service';
import { periodRange } from '../../core/dates';
import { roundMoney, roundQty } from '../../core/money';
import { MovementType, ReportPeriod, ReportResult, StockMovement } from '../../core/models';

interface TotalsRow {
  entry_qty: number;
  entry_cost: number;
  exit_qty: number;
  exit_revenue: number;
  exit_cost: number;
  adj_qty: number;
}

interface GroupRow extends TotalsRow {
  group_id: string;
  group_name: string;
}

interface MovementJoinRow {
  id: string;
  product_id: string;
  type: MovementType;
  quantity: number;
  unit_cost: number | null;
  unit_price: number | null;
  reason: string;
  reference: string | null;
  date: string;
  notes: string | null;
  created_at: string;
  product_name: string;
  product_sku: string;
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private db = inject(DatabaseService);

  async summarize(period: ReportPeriod, reference: string): Promise<ReportResult> {
    const { from, to } = periodRange(period, reference);
    const totalsRow = (
      await this.db.query<TotalsRow>(
        `SELECT
           COALESCE(SUM(CASE WHEN type='entry' THEN ABS(quantity) ELSE 0 END), 0) AS entry_qty,
           COALESCE(SUM(CASE WHEN type='entry' THEN ABS(quantity) * COALESCE(unit_cost, 0) ELSE 0 END), 0) AS entry_cost,
           COALESCE(SUM(CASE WHEN type='exit' THEN ABS(quantity) ELSE 0 END), 0) AS exit_qty,
           COALESCE(SUM(CASE WHEN type='exit' THEN ABS(quantity) * COALESCE(unit_price, 0) ELSE 0 END), 0) AS exit_revenue,
           COALESCE(SUM(CASE WHEN type='exit' THEN ABS(quantity) * COALESCE(unit_cost, 0) ELSE 0 END), 0) AS exit_cost,
           COALESCE(SUM(CASE WHEN type='adjustment' THEN quantity ELSE 0 END), 0) AS adj_qty
         FROM stock_movements
         WHERE date >= ? AND date <= ?;`,
        [from, to]
      )
    )[0];

    const totals = this.mapTotals(totalsRow);

    const byCategory = await this.groupReport(
      `c.id AS group_id, c.name AS group_name`,
      `JOIN products p ON p.id = m.product_id JOIN categories c ON c.id = p.category_id`,
      from,
      to
    );
    const byBrand = await this.groupReport(
      `b.id AS group_id, b.name AS group_name`,
      `JOIN products p ON p.id = m.product_id JOIN brands b ON b.id = p.brand_id`,
      from,
      to
    );
    const bySupplier = await this.groupReport(
      `s.id AS group_id, s.name AS group_name`,
      `JOIN products p ON p.id = m.product_id JOIN brands b ON b.id = p.brand_id JOIN suppliers s ON s.id = b.supplier_id`,
      from,
      to
    );

    const movementRows = await this.db.query<MovementJoinRow>(
      `SELECT m.*, p.name AS product_name, p.sku AS product_sku
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
       WHERE m.date >= ? AND m.date <= ?
       ORDER BY m.date DESC, m.created_at DESC;`,
      [from, to]
    );

    return {
      period,
      from,
      to,
      totals,
      byCategory,
      byBrand,
      bySupplier,
      movements: movementRows.map((row) => this.mapMovement(row)),
    };
  }

  private async groupReport(selectGroup: string, joins: string, from: string, to: string) {
    const rows = await this.db.query<GroupRow>(
      `SELECT ${selectGroup},
         COALESCE(SUM(CASE WHEN m.type='entry' THEN ABS(m.quantity) ELSE 0 END), 0) AS entry_qty,
         COALESCE(SUM(CASE WHEN m.type='entry' THEN ABS(m.quantity) * COALESCE(m.unit_cost, 0) ELSE 0 END), 0) AS entry_cost,
         COALESCE(SUM(CASE WHEN m.type='exit' THEN ABS(m.quantity) ELSE 0 END), 0) AS exit_qty,
         COALESCE(SUM(CASE WHEN m.type='exit' THEN ABS(m.quantity) * COALESCE(m.unit_price, 0) ELSE 0 END), 0) AS exit_revenue,
         COALESCE(SUM(CASE WHEN m.type='exit' THEN ABS(m.quantity) * COALESCE(m.unit_cost, 0) ELSE 0 END), 0) AS exit_cost,
         COALESCE(SUM(CASE WHEN m.type='adjustment' THEN m.quantity ELSE 0 END), 0) AS adj_qty
       FROM stock_movements m
       ${joins}
       WHERE m.date >= ? AND m.date <= ?
       GROUP BY group_id
       HAVING entry_qty > 0 OR exit_qty > 0 OR adj_qty <> 0
       ORDER BY exit_revenue DESC, group_name COLLATE NOCASE;`,
      [from, to]
    );
    return rows.map((row) => ({
      groupId: row.group_id,
      groupName: row.group_name,
      ...this.mapTotals(row),
    }));
  }

  private mapTotals(row: TotalsRow | undefined) {
    const entryCost = roundMoney(Number(row?.entry_cost ?? 0));
    const exitRevenue = roundMoney(Number(row?.exit_revenue ?? 0));
    const exitCost = roundMoney(Number(row?.exit_cost ?? 0));
    return {
      entryQty: roundQty(Number(row?.entry_qty ?? 0)),
      entryCost,
      exitQty: roundQty(Number(row?.exit_qty ?? 0)),
      exitRevenue,
      exitCost,
      margin: roundMoney(exitRevenue - exitCost),
      adjustmentQty: roundQty(Number(row?.adj_qty ?? 0)),
    };
  }

  private mapMovement(row: MovementJoinRow): StockMovement & { productName: string; productSku: string } {
    return {
      id: row.id,
      productId: row.product_id,
      type: row.type,
      quantity: Number(row.quantity),
      unitCost: row.unit_cost,
      unitPrice: row.unit_price,
      reason: row.reason,
      reference: row.reference,
      date: row.date,
      notes: row.notes,
      createdAt: row.created_at,
      productName: row.product_name,
      productSku: row.product_sku,
    };
  }
}
