import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../core/database/database.service';
import { createId } from '../../core/ids';
import { Supplier, SupplierInput } from '../../core/models';

interface SupplierRow {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private db = inject(DatabaseService);

  async list(activeOnly = false): Promise<Supplier[]> {
    const sql = activeOnly
      ? 'SELECT * FROM suppliers WHERE active = 1 ORDER BY name COLLATE NOCASE;'
      : 'SELECT * FROM suppliers ORDER BY name COLLATE NOCASE;';
    const rows = await this.db.query<SupplierRow>(sql);
    return rows.map((row) => this.map(row));
  }

  async get(id: string): Promise<Supplier | null> {
    const rows = await this.db.query<SupplierRow>('SELECT * FROM suppliers WHERE id=?;', [id]);
    return rows[0] ? this.map(rows[0]) : null;
  }

  async create(input: SupplierInput): Promise<string> {
    const id = createId();
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO suppliers (id, name, contact_name, phone, email, notes, active, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?);`,
      [
        id,
        input.name.trim(),
        input.contactName?.trim() || null,
        input.phone?.trim() || null,
        input.email?.trim() || null,
        input.notes?.trim() || null,
        input.active === false ? 0 : 1,
        now,
        now,
      ]
    );
    return id;
  }

  async update(id: string, input: SupplierInput): Promise<void> {
    await this.db.run(
      `UPDATE suppliers SET name=?, contact_name=?, phone=?, email=?, notes=?, active=?, updated_at=? WHERE id=?;`,
      [
        input.name.trim(),
        input.contactName?.trim() || null,
        input.phone?.trim() || null,
        input.email?.trim() || null,
        input.notes?.trim() || null,
        input.active === false ? 0 : 1,
        new Date().toISOString(),
        id,
      ]
    );
  }

  async remove(id: string): Promise<void> {
    const brands = await this.db.query<{ c: number }>(
      'SELECT COUNT(*) AS c FROM brands WHERE supplier_id=?;',
      [id]
    );
    if (Number(brands[0]?.c ?? 0) > 0) {
      throw new Error('No se puede eliminar: el proveedor tiene marcas asociadas.');
    }
    await this.db.run('DELETE FROM suppliers WHERE id=?;', [id]);
  }

  private map(row: SupplierRow): Supplier {
    return {
      id: row.id,
      name: row.name,
      contactName: row.contact_name,
      phone: row.phone,
      email: row.email,
      notes: row.notes,
      active: row.active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
