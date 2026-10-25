import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import {
  AppBackup,
  BACKUP_SCHEMA_VERSION,
  Brand,
  Category,
  Product,
  StockMovement,
  Supplier,
} from '../models';
import { DatabaseService } from '../database/database.service';
import { todayIso } from '../dates';

@Injectable({ providedIn: 'root' })
export class BackupService {
  private db = inject(DatabaseService);

  async exportBackup(): Promise<AppBackup> {
    const suppliers = await this.db.query<Record<string, unknown>>('SELECT * FROM suppliers;');
    const brands = await this.db.query<Record<string, unknown>>('SELECT * FROM brands;');
    const categories = await this.db.query<Record<string, unknown>>('SELECT * FROM categories;');
    const products = await this.db.query<Record<string, unknown>>('SELECT * FROM products;');
    const stockMovements = await this.db.query<Record<string, unknown>>('SELECT * FROM stock_movements;');
    return {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      suppliers: suppliers.map((row) => this.mapSupplier(row)),
      brands: brands.map((row) => this.mapBrand(row)),
      categories: categories.map((row) => this.mapCategory(row)),
      products: products.map((row) => this.mapProduct(row)),
      stockMovements: stockMovements.map((row) => this.mapMovement(row)),
    };
  }

  async downloadOrShare(): Promise<string> {
    const backup = await this.exportBackup();
    const filename = `inventario-${todayIso().replaceAll('-', '')}.json`;
    const json = JSON.stringify(backup, null, 2);

    if (Capacitor.getPlatform() === 'web') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      return filename;
    }

    const result = await Filesystem.writeFile({
      path: filename,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: 'Respaldo Inventario',
      text: filename,
      url: result.uri,
      dialogTitle: 'Compartir respaldo',
    });
    return filename;
  }

  async importBackup(raw: string): Promise<void> {
    const parsed = JSON.parse(raw) as AppBackup;
    if (!parsed || parsed.schemaVersion !== BACKUP_SCHEMA_VERSION) {
      throw new Error('El archivo de respaldo no es compatible.');
    }
    if (
      !Array.isArray(parsed.suppliers) ||
      !Array.isArray(parsed.brands) ||
      !Array.isArray(parsed.categories) ||
      !Array.isArray(parsed.products) ||
      !Array.isArray(parsed.stockMovements)
    ) {
      throw new Error('El respaldo está incompleto.');
    }

    const connection = this.db.getConnection();
    await connection.beginTransaction();
    try {
      await connection.run('DELETE FROM stock_movements;', [], false);
      await connection.run('DELETE FROM products;', [], false);
      await connection.run('DELETE FROM brands;', [], false);
      await connection.run('DELETE FROM categories;', [], false);
      await connection.run('DELETE FROM suppliers;', [], false);

      for (const supplier of parsed.suppliers) {
        await connection.run(
          `INSERT INTO suppliers (id, name, contact_name, phone, email, notes, active, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?);`,
          [
            supplier.id,
            supplier.name,
            supplier.contactName,
            supplier.phone,
            supplier.email,
            supplier.notes,
            supplier.active ? 1 : 0,
            supplier.createdAt,
            supplier.updatedAt,
          ],
          false
        );
      }
      for (const category of parsed.categories) {
        await connection.run(
          `INSERT INTO categories (id, name, description, created_at, updated_at) VALUES (?,?,?,?,?);`,
          [category.id, category.name, category.description, category.createdAt, category.updatedAt],
          false
        );
      }
      for (const brand of parsed.brands) {
        await connection.run(
          `INSERT INTO brands (id, name, supplier_id, created_at, updated_at) VALUES (?,?,?,?,?);`,
          [brand.id, brand.name, brand.supplierId, brand.createdAt, brand.updatedAt],
          false
        );
      }
      for (const product of parsed.products) {
        await connection.run(
          `INSERT INTO products (
            id, sku, name, category_id, brand_id, unit, sale_price, min_stock,
            stock, avg_cost, active, notes, created_at, updated_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?);`,
          [
            product.id,
            product.sku,
            product.name,
            product.categoryId,
            product.brandId,
            product.unit,
            product.salePrice,
            product.minStock,
            product.stock,
            product.avgCost,
            product.active ? 1 : 0,
            product.notes,
            product.createdAt,
            product.updatedAt,
          ],
          false
        );
      }
      for (const movement of parsed.stockMovements) {
        await connection.run(
          `INSERT INTO stock_movements (
            id, product_id, type, quantity, unit_cost, unit_price, reason, reference, date, notes, created_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?);`,
          [
            movement.id,
            movement.productId,
            movement.type,
            movement.quantity,
            movement.unitCost,
            movement.unitPrice,
            movement.reason,
            movement.reference,
            movement.date,
            movement.notes,
            movement.createdAt,
          ],
          false
        );
      }
      await connection.commitTransaction();
      await this.db.persist();
    } catch (error) {
      await connection.rollbackTransaction();
      throw error;
    }
  }

  private mapSupplier(row: Record<string, unknown>): Supplier {
    return {
      id: String(row['id']),
      name: String(row['name']),
      contactName: (row['contact_name'] as string | null) ?? null,
      phone: (row['phone'] as string | null) ?? null,
      email: (row['email'] as string | null) ?? null,
      notes: (row['notes'] as string | null) ?? null,
      active: Number(row['active'] ?? 1) === 1,
      createdAt: String(row['created_at']),
      updatedAt: String(row['updated_at']),
    };
  }

  private mapBrand(row: Record<string, unknown>): Brand {
    return {
      id: String(row['id']),
      name: String(row['name']),
      supplierId: String(row['supplier_id']),
      createdAt: String(row['created_at']),
      updatedAt: String(row['updated_at']),
    };
  }

  private mapCategory(row: Record<string, unknown>): Category {
    return {
      id: String(row['id']),
      name: String(row['name']),
      description: (row['description'] as string | null) ?? null,
      createdAt: String(row['created_at']),
      updatedAt: String(row['updated_at']),
    };
  }

  private mapProduct(row: Record<string, unknown>): Product {
    return {
      id: String(row['id']),
      sku: String(row['sku']),
      name: String(row['name']),
      categoryId: String(row['category_id']),
      brandId: String(row['brand_id']),
      unit: row['unit'] as Product['unit'],
      salePrice: Number(row['sale_price'] ?? 0),
      minStock: Number(row['min_stock'] ?? 0),
      stock: Number(row['stock'] ?? 0),
      avgCost: Number(row['avg_cost'] ?? 0),
      active: Number(row['active'] ?? 1) === 1,
      notes: (row['notes'] as string | null) ?? null,
      createdAt: String(row['created_at']),
      updatedAt: String(row['updated_at']),
    };
  }

  private mapMovement(row: Record<string, unknown>): StockMovement {
    return {
      id: String(row['id']),
      productId: String(row['product_id']),
      type: row['type'] as StockMovement['type'],
      quantity: Number(row['quantity']),
      unitCost: (row['unit_cost'] as number | null) ?? null,
      unitPrice: (row['unit_price'] as number | null) ?? null,
      reason: String(row['reason'] ?? ''),
      reference: (row['reference'] as string | null) ?? null,
      date: String(row['date']),
      notes: (row['notes'] as string | null) ?? null,
      createdAt: String(row['created_at']),
    };
  }
}
