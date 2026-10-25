import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../core/database/database.service';
import { periodRange } from '../../core/dates';
import { roundMoney, roundQty } from '../../core/money';
import {
  MovementType,
  PaymentMethod,
  PurchaseReportSummary,
  ReportPeriod,
  ReportResult,
  SalesReportSummary,
  StockMovement,
} from '../../core/models';

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

    const [sales, purchases] = await Promise.all([
      this.salesSummary(from, to),
      this.purchasesSummary(from, to),
    ]);

    return {
      period,
      from,
      to,
      totals,
      byCategory,
      byBrand,
      bySupplier,
      sales,
      purchases,
      movements: movementRows.map((row) => this.mapMovement(row)),
    };
  }

  async salesSummary(from: string, to: string): Promise<SalesReportSummary> {
    const rows = await this.db.query<{
      sale_count: number;
      cancelled_count: number;
      total_revenue: number;
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END), 0) AS sale_count,
         COALESCE(SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_count,
         COALESCE(SUM(CASE WHEN status='completed' THEN total ELSE 0 END), 0) AS total_revenue
       FROM documents WHERE type='sale' AND date >= ? AND date <= ?;`,
      [from, to]
    );
    const row = rows[0];
    const saleCount = Number(row?.sale_count ?? 0);
    const totalRevenue = roundMoney(Number(row?.total_revenue ?? 0));
    const byPayment = await this.db.query<{ payment_method: PaymentMethod; c: number; total: number }>(
      `SELECT payment_method, COUNT(*) AS c, COALESCE(SUM(total), 0) AS total
       FROM documents
       WHERE type='sale' AND status='completed' AND date >= ? AND date <= ?
       GROUP BY payment_method;`,
      [from, to]
    );
    return {
      saleCount,
      cancelledCount: Number(row?.cancelled_count ?? 0),
      totalRevenue,
      averageTicket: saleCount > 0 ? roundMoney(totalRevenue / saleCount) : 0,
      byPaymentMethod: byPayment
        .filter((p) => p.payment_method)
        .map((p) => ({
          method: p.payment_method,
          count: Number(p.c),
          total: roundMoney(Number(p.total)),
        })),
    };
  }

  async purchasesSummary(from: string, to: string): Promise<PurchaseReportSummary> {
    const rows = await this.db.query<{
      purchase_count: number;
      cancelled_count: number;
      total_cost: number;
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END), 0) AS purchase_count,
         COALESCE(SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_count,
         COALESCE(SUM(CASE WHEN status='completed' THEN total ELSE 0 END), 0) AS total_cost
       FROM documents WHERE type='purchase' AND date >= ? AND date <= ?;`,
      [from, to]
    );
    const row = rows[0];
    const bySupplier = await this.db.query<{
      supplier_id: string;
      supplier_name: string;
      c: number;
      total: number;
    }>(
      `SELECT d.supplier_id, s.name AS supplier_name, COUNT(*) AS c, COALESCE(SUM(d.total), 0) AS total
       FROM documents d
       JOIN suppliers s ON s.id = d.supplier_id
       WHERE d.type='purchase' AND d.status='completed' AND d.date >= ? AND d.date <= ?
       GROUP BY d.supplier_id
       ORDER BY total DESC;`,
      [from, to]
    );
    return {
      purchaseCount: Number(row?.purchase_count ?? 0),
      cancelledCount: Number(row?.cancelled_count ?? 0),
      totalCost: roundMoney(Number(row?.total_cost ?? 0)),
      bySupplier: bySupplier.map((s) => ({
        supplierId: s.supplier_id,
        supplierName: s.supplier_name,
        count: Number(s.c),
        total: roundMoney(Number(s.total)),
      })),
    };
  }

  async exportInventoryCsv(): Promise<string> {
    const rows = await this.db.query<{
      sku: string;
      name: string;
      category_name: string;
      brand_name: string;
      stock: number;
      avg_cost: number;
      sale_price: number;
      barcode: string | null;
    }>(`
      SELECT p.sku, p.name, c.name AS category_name, b.name AS brand_name,
             p.stock, p.avg_cost, p.sale_price, p.barcode
      FROM products p
      JOIN categories c ON c.id = p.category_id
      JOIN brands b ON b.id = p.brand_id
      WHERE p.active = 1
      ORDER BY p.name COLLATE NOCASE;
    `);
    const { CsvService } = await import('../../core/export/csv.service');
    const csv = new CsvService();
    return csv.toCsv(
      ['SKU', 'Nombre', 'Categoría', 'Marca', 'Stock', 'Costo prom.', 'Precio venta', 'Código barras'],
      rows.map((r) => [
        r.sku,
        r.name,
        r.category_name,
        r.brand_name,
        r.stock,
        r.avg_cost,
        r.sale_price,
        r.barcode ?? '',
      ])
    );
  }

  async exportMovementsCsv(from: string, to: string): Promise<string> {
    const rows = await this.db.query<MovementJoinRow>(
      `SELECT m.*, p.name AS product_name, p.sku AS product_sku
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
       WHERE m.date >= ? AND m.date <= ?
       ORDER BY m.date DESC, m.created_at DESC;`,
      [from, to]
    );
    const { CsvService } = await import('../../core/export/csv.service');
    const csv = new CsvService();
    return csv.toCsv(
      ['Fecha', 'Tipo', 'Producto', 'SKU', 'Cantidad', 'Costo', 'Precio', 'Motivo', 'Referencia'],
      rows.map((r) => [
        r.date,
        r.type,
        r.product_name,
        r.product_sku,
        r.quantity,
        r.unit_cost ?? '',
        r.unit_price ?? '',
        r.reason,
        r.reference ?? '',
      ])
    );
  }

  async exportSalesCsv(from: string, to: string): Promise<string> {
    const rows = await this.db.query<{
      folio: number;
      date: string;
      customer_name: string | null;
      payment_method: string | null;
      total: number;
      status: string;
    }>(
      `SELECT folio, date, customer_name, payment_method, total, status
       FROM documents WHERE type='sale' AND date >= ? AND date <= ?
       ORDER BY date DESC, folio DESC;`,
      [from, to]
    );
    const { CsvService } = await import('../../core/export/csv.service');
    const csv = new CsvService();
    return csv.toCsv(
      ['Folio', 'Fecha', 'Cliente', 'Pago', 'Total', 'Estado'],
      rows.map((r) => [
        `V-${String(r.folio).padStart(6, '0')}`,
        r.date,
        r.customer_name ?? '',
        r.payment_method ?? '',
        r.total,
        r.status,
      ])
    );
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
      documentId: null,
      date: row.date,
      notes: row.notes,
      createdAt: row.created_at,
      productName: row.product_name,
      productSku: row.product_sku,
    };
  }
}
