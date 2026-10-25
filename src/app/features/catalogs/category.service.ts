import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../core/database/database.service';
import { createId } from '../../core/ids';
import { Category, CategoryInput } from '../../core/models';

interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private db = inject(DatabaseService);

  async list(): Promise<Category[]> {
    const rows = await this.db.query<CategoryRow>('SELECT * FROM categories ORDER BY name COLLATE NOCASE;');
    return rows.map((row) => this.map(row));
  }

  async get(id: string): Promise<Category | null> {
    const rows = await this.db.query<CategoryRow>('SELECT * FROM categories WHERE id=?;', [id]);
    return rows[0] ? this.map(rows[0]) : null;
  }

  async create(input: CategoryInput): Promise<string> {
    const id = createId();
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO categories (id, name, description, created_at, updated_at) VALUES (?,?,?,?,?);`,
      [id, input.name.trim(), input.description?.trim() || null, now, now]
    );
    return id;
  }

  async update(id: string, input: CategoryInput): Promise<void> {
    await this.db.run(
      `UPDATE categories SET name=?, description=?, updated_at=? WHERE id=?;`,
      [input.name.trim(), input.description?.trim() || null, new Date().toISOString(), id]
    );
  }

  async remove(id: string): Promise<void> {
    const products = await this.db.query<{ c: number }>(
      'SELECT COUNT(*) AS c FROM products WHERE category_id=?;',
      [id]
    );
    if (Number(products[0]?.c ?? 0) > 0) {
      throw new Error('No se puede eliminar: la categoría tiene productos asociados.');
    }
    await this.db.run('DELETE FROM categories WHERE id=?;', [id]);
  }

  private map(row: CategoryRow): Category {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
