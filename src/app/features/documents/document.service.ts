import { Injectable, inject } from '@angular/core';
import { documentFolioLabel } from '../../core/labels';
import { DatabaseService } from '../../core/database/database.service';
import { createId } from '../../core/ids';
import { roundMoney, roundQty } from '../../core/money';
import {
  documentLineTotal,
  documentSubtotal,
  documentTotal,
} from '../../core/pricing';
import {
  DocumentLine,
  DocumentType,
  DocumentWithLines,
  InventoryDocument,
  PaymentMethod,
  PurchaseInput,
  SaleInput,
} from '../../core/models';
import { InsufficientStockError } from '../../core/inventory-math';
import { InventoryStockService } from '../products/inventory-stock.service';

interface DocumentRow {
  id: string;
  type: DocumentType;
  folio: number;
  date: string;
  supplier_id: string | null;
  customer_name: string | null;
  invoice_number: string | null;
  payment_method: PaymentMethod | null;
  subtotal: number;
  discount: number;
  total: number;
  status: 'completed' | 'cancelled';
  cancelled_at: string | null;
  cancel_reason: string | null;
  notes: string | null;
  created_at: string;
  supplier_name?: string;
}

interface LineRow {
  id: string;
  document_id: string;
  product_id: string;
  quantity: number;
  unit_amount: number;
  line_total: number;
  movement_id: string | null;
  product_name?: string;
  product_sku?: string;
  product_unit?: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private db = inject(DatabaseService);
  private stock = inject(InventoryStockService);

  async list(type: DocumentType, from?: string, to?: string): Promise<InventoryDocument[]> {
    const where = ['type = ?'];
    const values: unknown[] = [type];
    if (from) {
      where.push('date >= ?');
      values.push(from);
    }
    if (to) {
      where.push('date <= ?');
      values.push(to);
    }
    const rows = await this.db.query<DocumentRow>(
      `SELECT * FROM documents WHERE ${where.join(' AND ')} ORDER BY date DESC, folio DESC;`,
      values
    );
    return rows.map((row) => this.mapDocument(row));
  }

  async get(id: string): Promise<DocumentWithLines | null> {
    const rows = await this.db.query<DocumentRow>(
      `SELECT d.*, s.name AS supplier_name FROM documents d
       LEFT JOIN suppliers s ON s.id = d.supplier_id WHERE d.id=?;`,
      [id]
    );
    const doc = rows[0];
    if (!doc) {
      return null;
    }
    const lines = await this.db.query<LineRow>(
      `SELECT dl.*, p.name AS product_name, p.sku AS product_sku, p.unit AS product_unit
       FROM document_lines dl
       JOIN products p ON p.id = dl.product_id
       WHERE dl.document_id=? ORDER BY dl.id;`,
      [id]
    );
    return {
      ...this.mapDocument(doc),
      supplierName: doc.supplier_name ?? undefined,
      lines: lines.map((line) => ({
        id: line.id,
        documentId: line.document_id,
        productId: line.product_id,
        quantity: Number(line.quantity),
        unitAmount: roundMoney(Number(line.unit_amount)),
        lineTotal: roundMoney(Number(line.line_total)),
        movementId: line.movement_id,
        productName: line.product_name ?? '',
        productSku: line.product_sku ?? '',
        productUnit: line.product_unit as DocumentWithLines['lines'][0]['productUnit'],
      })),
    };
  }

  async createSale(input: SaleInput): Promise<string> {
    if (!input.lines.length) {
      throw new Error('Agrega al menos un producto a la venta.');
    }
    const documentId = createId();
    const conn = this.db.getConnection();
    await conn.beginTransaction();
    try {
      const folio = await this.nextFolio('sale', conn);
      const reference = documentFolioLabel('sale', folio);
      const lineRows = input.lines.map((line) => ({
        ...line,
        lineTotal: documentLineTotal(line.quantity, line.unitAmount),
      }));
      const subtotal = documentSubtotal(lineRows);
      const discount = roundMoney(input.discount ?? 0);
      const total = documentTotal(subtotal, discount);
      const now = new Date().toISOString();

      await conn.run(
        `INSERT INTO documents (
          id, type, folio, date, supplier_id, customer_name, invoice_number, payment_method,
          subtotal, discount, total, status, cancelled_at, cancel_reason, notes, created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);`,
        [
          documentId,
          'sale',
          folio,
          input.date,
          null,
          input.customerName?.trim() || null,
          null,
          input.paymentMethod,
          subtotal,
          discount,
          total,
          'completed',
          null,
          null,
          input.notes?.trim() || null,
          now,
        ],
        false
      );

      const productIds = new Set<string>();
      for (const line of lineRows) {
        const lineId = createId();
        const movementId = createId();
        productIds.add(line.productId);
        await conn.run(
          `INSERT INTO document_lines (id, document_id, product_id, quantity, unit_amount, line_total, movement_id)
           VALUES (?,?,?,?,?,?,?);`,
          [
            lineId,
            documentId,
            line.productId,
            roundQty(line.quantity),
            roundMoney(line.unitAmount),
            line.lineTotal,
            movementId,
          ],
          false
        );
        await conn.run(
          `INSERT INTO stock_movements (
            id, product_id, type, quantity, unit_cost, unit_price, reason, reference, document_id, date, notes, created_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?);`,
          [
            movementId,
            line.productId,
            'exit',
            roundQty(line.quantity),
            null,
            roundMoney(line.unitAmount),
            'venta',
            reference,
            documentId,
            input.date,
            input.notes?.trim() || null,
            now,
          ],
          false
        );
      }

      for (const productId of productIds) {
        try {
          await this.stock.recalculate(productId);
        } catch (error) {
          if (error instanceof InsufficientStockError) {
            throw new Error(error.message);
          }
          throw error;
        }
      }

      await conn.commitTransaction();
      await this.db.persist();
      return documentId;
    } catch (error) {
      await conn.rollbackTransaction();
      throw error;
    }
  }

  async createPurchase(input: PurchaseInput): Promise<string> {
    if (!input.lines.length) {
      throw new Error('Agrega al menos un producto a la compra.');
    }
    const documentId = createId();
    const conn = this.db.getConnection();
    await conn.beginTransaction();
    try {
      const folio = await this.nextFolio('purchase', conn);
      const reference = documentFolioLabel('purchase', folio);
      const lineRows = input.lines.map((line) => ({
        ...line,
        lineTotal: documentLineTotal(line.quantity, line.unitAmount),
      }));
      const subtotal = documentSubtotal(lineRows);
      const total = documentTotal(subtotal, 0);
      const now = new Date().toISOString();

      await conn.run(
        `INSERT INTO documents (
          id, type, folio, date, supplier_id, customer_name, invoice_number, payment_method,
          subtotal, discount, total, status, cancelled_at, cancel_reason, notes, created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);`,
        [
          documentId,
          'purchase',
          folio,
          input.date,
          input.supplierId,
          null,
          input.invoiceNumber?.trim() || null,
          null,
          subtotal,
          0,
          total,
          'completed',
          null,
          null,
          input.notes?.trim() || null,
          now,
        ],
        false
      );

      const productIds = new Set<string>();
      for (const line of lineRows) {
        const lineId = createId();
        const movementId = createId();
        productIds.add(line.productId);
        await conn.run(
          `INSERT INTO document_lines (id, document_id, product_id, quantity, unit_amount, line_total, movement_id)
           VALUES (?,?,?,?,?,?,?);`,
          [
            lineId,
            documentId,
            line.productId,
            roundQty(line.quantity),
            roundMoney(line.unitAmount),
            line.lineTotal,
            movementId,
          ],
          false
        );
        await conn.run(
          `INSERT INTO stock_movements (
            id, product_id, type, quantity, unit_cost, unit_price, reason, reference, document_id, date, notes, created_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?);`,
          [
            movementId,
            line.productId,
            'entry',
            roundQty(line.quantity),
            roundMoney(line.unitAmount),
            null,
            'compra',
            reference,
            documentId,
            input.date,
            input.notes?.trim() || null,
            now,
          ],
          false
        );
      }

      for (const productId of productIds) {
        await this.stock.recalculate(productId);
      }

      await conn.commitTransaction();
      await this.db.persist();
      return documentId;
    } catch (error) {
      await conn.rollbackTransaction();
      throw error;
    }
  }

  async cancelDocument(id: string, reason: string): Promise<void> {
    const doc = await this.get(id);
    if (!doc) {
      return;
    }
    if (doc.status === 'cancelled') {
      throw new Error('El documento ya está cancelado.');
    }

    const conn = this.db.getConnection();
    await conn.beginTransaction();
    try {
      const productIds = new Set<string>();
      for (const line of doc.lines) {
        if (line.movementId) {
          productIds.add(line.productId);
          await conn.run('DELETE FROM stock_movements WHERE id=?;', [line.movementId], false);
        }
      }
      for (const productId of productIds) {
        try {
          await this.stock.recalculate(productId);
        } catch (error) {
          if (error instanceof InsufficientStockError) {
            throw new Error(
              'No se puede cancelar: ya no hay stock suficiente para revertir esta operación.'
            );
          }
          throw error;
        }
      }
      await conn.run(
        `UPDATE documents SET status='cancelled', cancelled_at=?, cancel_reason=? WHERE id=?;`,
        [new Date().toISOString(), reason.trim(), id],
        false
      );
      await conn.commitTransaction();
      await this.db.persist();
    } catch (error) {
      await conn.rollbackTransaction();
      throw error;
    }
  }

  formatTicketText(doc: DocumentWithLines): string {
    const header = documentFolioLabel(doc.type, doc.folio);
    const lines = doc.lines
      .map(
        (l) =>
          `${l.productName} x${l.quantity} @ ${l.unitAmount.toFixed(2)} = ${l.lineTotal.toFixed(2)}`
      )
      .join('\n');
    return [
      header,
      `Fecha: ${doc.date}`,
      doc.customerName ? `Cliente: ${doc.customerName}` : '',
      doc.supplierName ? `Proveedor: ${doc.supplierName}` : '',
      doc.invoiceNumber ? `Factura: ${doc.invoiceNumber}` : '',
      doc.paymentMethod ? `Pago: ${doc.paymentMethod}` : '',
      '---',
      lines,
      '---',
      `Subtotal: ${doc.subtotal.toFixed(2)}`,
      doc.discount ? `Descuento: ${doc.discount.toFixed(2)}` : '',
      `Total: ${doc.total.toFixed(2)}`,
      doc.status === 'cancelled' ? `CANCELADO: ${doc.cancelReason ?? ''}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private async nextFolio(
    type: DocumentType,
    conn: ReturnType<DatabaseService['getConnection']>
  ): Promise<number> {
    const rows = await conn.query('SELECT COALESCE(MAX(folio), 0) AS max_folio FROM documents WHERE type=?;', [
      type,
    ]);
    const max = Number(rows.values?.[0]?.['max_folio'] ?? 0);
    return max + 1;
  }

  private mapDocument(row: DocumentRow): InventoryDocument {
    return {
      id: row.id,
      type: row.type,
      folio: Number(row.folio),
      date: row.date,
      supplierId: row.supplier_id,
      customerName: row.customer_name,
      invoiceNumber: row.invoice_number,
      paymentMethod: row.payment_method,
      subtotal: roundMoney(Number(row.subtotal)),
      discount: roundMoney(Number(row.discount)),
      total: roundMoney(Number(row.total)),
      status: row.status,
      cancelledAt: row.cancelled_at,
      cancelReason: row.cancel_reason,
      notes: row.notes,
      createdAt: row.created_at,
    };
  }
}
