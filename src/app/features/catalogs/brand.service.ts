import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../core/database/database.service';
import { createId } from '../../core/ids';
import { Brand, BrandInput, BrandWithSupplier } from '../../core/models';

interface BrandRow {
  id: string;
  name: string;
  supplier_id: string;
  created_at: string;
  updated_at: string;
  supplier_name?: string;
}

@Injectable({ providedIn: 'root' })
export class BrandService {
  private db = inject(DatabaseService);

  async list(): Promise<BrandWithSupplier[]> {
    const rows = await this.db.query<BrandRow>(`
      SELECT b.*, s.name AS supplier_name
      FROM brands b
      JOIN suppliers s ON s.id = b.supplier_id
      ORDER BY b.name COLLATE NOCASE;
    `);
    return rows.map((row) => this.mapWithSupplier(row));
  }

  async listBySupplier(supplierId: string): Promise<Brand[]> {
    const rows = await this.db.query<BrandRow>(
      'SELECT * FROM brands WHERE supplier_id=? ORDER BY name COLLATE NOCASE;',
      [supplierId]
    );
    return rows.map((row) => this.map(row));
  }

  async get(id: string): Promise<BrandWithSupplier | null> {
    const rows = await this.db.query<BrandRow>(
      `SELECT b.*, s.name AS supplier_name FROM brands b
       JOIN suppliers s ON s.id = b.supplier_id WHERE b.id=?;`,
      [id]
    );
    return rows[0] ? this.mapWithSupplier(rows[0]) : null;
  }

  async create(input: BrandInput): Promise<string> {
    const id = createId();
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO brands (id, name, supplier_id, created_at, updated_at) VALUES (?,?,?,?,?);`,
      [id, input.name.trim(), input.supplierId, now, now]
    );
    return id;
  }

  async update(id: string, input: BrandInput): Promise<void> {
    await this.db.run(
      `UPDATE brands SET name=?, supplier_id=?, updated_at=? WHERE id=?;`,
      [input.name.trim(), input.supplierId, new Date().toISOString(), id]
    );
  }

  async remove(id: string): Promise<void> {
    const products = await this.db.query<{ c: number }>(
      'SELECT COUNT(*) AS c FROM products WHERE brand_id=?;',
      [id]
    );
    if (Number(products[0]?.c ?? 0) > 0) {
      throw new Error('No se puede eliminar: la marca tiene productos asociados.');
    }
    await this.db.run('DELETE FROM brands WHERE id=?;', [id]);
  }

  private map(row: BrandRow): Brand {
    return {
      id: row.id,
      name: row.name,
      supplierId: row.supplier_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapWithSupplier(row: BrandRow): BrandWithSupplier {
    return {
      ...this.map(row),
      supplierName: row.supplier_name ?? '',
    };
  }
}
