import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../core/database/database.service';
import { createId } from '../../core/ids';
import { roundMoney, roundQty } from '../../core/money';
import { Product, ProductInput, ProductStock, ProductUnit } from '../../core/models';

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  category_id: string;
  brand_id: string;
  unit: ProductUnit;
  sale_price: number;
  min_stock: number;
  stock: number;
  avg_cost: number;
  active: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  category_name?: string;
  brand_name?: string;
  supplier_id?: string;
  supplier_name?: string;
}

export interface ProductListFilters {
  search?: string;
  categoryId?: string;
  brandId?: string;
  supplierId?: string;
  lowStockOnly?: boolean;
  activeOnly?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private db = inject(DatabaseService);

  async list(filters: ProductListFilters = {}): Promise<ProductStock[]> {
    const where: string[] = [];
    const values: unknown[] = [];

    if (filters.activeOnly !== false) {
      where.push('p.active = 1');
    }
    if (filters.categoryId) {
      where.push('p.category_id = ?');
      values.push(filters.categoryId);
    }
    if (filters.brandId) {
      where.push('p.brand_id = ?');
      values.push(filters.brandId);
    }
    if (filters.supplierId) {
      where.push('b.supplier_id = ?');
      values.push(filters.supplierId);
    }
    if (filters.search?.trim()) {
      where.push('(p.name LIKE ? OR p.sku LIKE ?)');
      const q = `%${filters.search.trim()}%`;
      values.push(q, q);
    }
    if (filters.lowStockOnly) {
      where.push('p.stock <= p.min_stock');
    }

    const sql = `
      SELECT
        p.*,
        c.name AS category_name,
        b.name AS brand_name,
        b.supplier_id AS supplier_id,
        s.name AS supplier_name
      FROM products p
      JOIN categories c ON c.id = p.category_id
      JOIN brands b ON b.id = p.brand_id
      JOIN suppliers s ON s.id = b.supplier_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY p.name COLLATE NOCASE;
    `;
    const rows = await this.db.query<ProductRow>(sql, values);
    return rows.map((row) => this.mapStock(row));
  }

  async get(id: string): Promise<ProductStock | null> {
    const rows = await this.db.query<ProductRow>(
      `
      SELECT
        p.*,
        c.name AS category_name,
        b.name AS brand_name,
        b.supplier_id AS supplier_id,
        s.name AS supplier_name
      FROM products p
      JOIN categories c ON c.id = p.category_id
      JOIN brands b ON b.id = p.brand_id
      JOIN suppliers s ON s.id = b.supplier_id
      WHERE p.id=?;
    `,
      [id]
    );
    return rows[0] ? this.mapStock(rows[0]) : null;
  }

  async create(input: ProductInput): Promise<string> {
    const id = createId();
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO products (
        id, sku, name, category_id, brand_id, unit, sale_price, min_stock,
        stock, avg_cost, active, notes, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,0,0,?,?,?,?);`,
      [
        id,
        input.sku.trim().toUpperCase(),
        input.name.trim(),
        input.categoryId,
        input.brandId,
        input.unit,
        roundMoney(input.salePrice ?? 0),
        roundQty(input.minStock ?? 0),
        input.active === false ? 0 : 1,
        input.notes?.trim() || null,
        now,
        now,
      ]
    );
    return id;
  }

  async update(id: string, input: ProductInput): Promise<void> {
    await this.db.run(
      `UPDATE products SET
        sku=?, name=?, category_id=?, brand_id=?, unit=?, sale_price=?, min_stock=?,
        active=?, notes=?, updated_at=?
       WHERE id=?;`,
      [
        input.sku.trim().toUpperCase(),
        input.name.trim(),
        input.categoryId,
        input.brandId,
        input.unit,
        roundMoney(input.salePrice ?? 0),
        roundQty(input.minStock ?? 0),
        input.active === false ? 0 : 1,
        input.notes?.trim() || null,
        new Date().toISOString(),
        id,
      ]
    );
  }

  async remove(id: string): Promise<void> {
    await this.db.run('DELETE FROM products WHERE id=?;', [id]);
  }

  async summary(): Promise<{ productCount: number; inventoryValue: number; lowStockCount: number }> {
    const rows = await this.db.query<{ product_count: number; inventory_value: number; low_stock: number }>(`
      SELECT
        COUNT(*) AS product_count,
        COALESCE(SUM(stock * avg_cost), 0) AS inventory_value,
        COALESCE(SUM(CASE WHEN stock <= min_stock AND active = 1 THEN 1 ELSE 0 END), 0) AS low_stock
      FROM products WHERE active = 1;
    `);
    const row = rows[0];
    return {
      productCount: Number(row?.product_count ?? 0),
      inventoryValue: roundMoney(Number(row?.inventory_value ?? 0)),
      lowStockCount: Number(row?.low_stock ?? 0),
    };
  }

  private mapStock(row: ProductRow): ProductStock {
    const stock = roundQty(Number(row.stock ?? 0));
    const avgCost = roundMoney(Number(row.avg_cost ?? 0));
    const minStock = roundQty(Number(row.min_stock ?? 0));
    return {
      id: row.id,
      sku: row.sku,
      name: row.name,
      categoryId: row.category_id,
      brandId: row.brand_id,
      unit: row.unit,
      salePrice: roundMoney(Number(row.sale_price ?? 0)),
      minStock,
      stock,
      avgCost,
      active: row.active === 1,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      categoryName: row.category_name ?? '',
      brandName: row.brand_name ?? '',
      supplierId: row.supplier_id ?? '',
      supplierName: row.supplier_name ?? '',
      inventoryValue: roundMoney(stock * avgCost),
      lowStock: stock <= minStock,
    };
  }
}
