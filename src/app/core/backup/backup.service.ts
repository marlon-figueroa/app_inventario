import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import {
  AppBackup,
  BACKUP_SCHEMA_VERSION,
  Brand,
  Category,
  DocumentLine,
  InventoryDocument,
  Product,
  StockMovement,
  Supplier,
} from '../models';
import { DatabaseService } from '../database/database.service';
import { ImageService } from '../media/image.service';
import { todayIso } from '../dates';

const LEGACY_BACKUP_VERSION = 2;

@Injectable({ providedIn: 'root' })
export class BackupService {
  private db = inject(DatabaseService);
  private images = inject(ImageService);

  async exportBackup(): Promise<AppBackup> {
    const suppliers = await this.db.query<Record<string, unknown>>('SELECT * FROM suppliers;');
    const brands = await this.db.query<Record<string, unknown>>('SELECT * FROM brands;');
    const categories = await this.db.query<Record<string, unknown>>('SELECT * FROM categories;');
    const products = await this.db.query<Record<string, unknown>>('SELECT * FROM products;');
    const stockMovements = await this.db.query<Record<string, unknown>>('SELECT * FROM stock_movements;');
    const documents = await this.db.query<Record<string, unknown>>('SELECT * FROM documents;');
    const documentLines = await this.db.query<Record<string, unknown>>('SELECT * FROM document_lines;');

    const imagePaths = new Set<string>();
    for (const row of products) {
      const path = row['image_path'] as string | null;
      if (path) {
        imagePaths.add(path);
      }
    }
    for (const row of brands) {
      const path = row['image_path'] as string | null;
      if (path) {
        imagePaths.add(path);
      }
    }

    const images: Record<string, string> = {};
    for (const path of imagePaths) {
      try {
        images[path] = await this.images.readAsBase64(path);
      } catch {
        // omitir imagen ausente
      }
    }

    return {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      suppliers: suppliers.map((row) => this.mapSupplier(row)),
      brands: brands.map((row) => this.mapBrand(row)),
      categories: categories.map((row) => this.mapCategory(row)),
      products: products.map((row) => this.mapProduct(row)),
      stockMovements: stockMovements.map((row) => this.mapMovement(row)),
      documents: documents.map((row) => this.mapDocument(row)),
      documentLines: documentLines.map((row) => this.mapDocumentLine(row)),
      images,
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
    const version = parsed?.schemaVersion;
    if (!parsed || (version !== BACKUP_SCHEMA_VERSION && version !== LEGACY_BACKUP_VERSION)) {
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

    const documents = version === BACKUP_SCHEMA_VERSION ? (parsed.documents ?? []) : [];
    const documentLines = version === BACKUP_SCHEMA_VERSION ? (parsed.documentLines ?? []) : [];

    const connection = this.db.getConnection();
    await connection.beginTransaction();
    try {
      await connection.run('DELETE FROM document_lines;', [], false);
      await connection.run('DELETE FROM stock_movements;', [], false);
      await connection.run('DELETE FROM documents;', [], false);
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
          `INSERT INTO brands (id, name, supplier_id, image_path, created_at, updated_at) VALUES (?,?,?,?,?,?);`,
          [
            brand.id,
            brand.name,
            brand.supplierId,
            brand.imagePath ?? null,
            brand.createdAt,
            brand.updatedAt,
          ],
          false
        );
      }
      for (const product of parsed.products) {
        await connection.run(
          `INSERT INTO products (
            id, sku, name, category_id, brand_id, unit, barcode, image_path,
            sale_price, wholesale_price, wholesale_min_qty, min_stock,
            stock, avg_cost, active, notes, created_at, updated_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);`,
          [
            product.id,
            product.sku,
            product.name,
            product.categoryId,
            product.brandId,
            product.unit,
            product.barcode ?? null,
            product.imagePath ?? null,
            product.salePrice,
            product.wholesalePrice ?? 0,
            product.wholesaleMinQty ?? 0,
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
            id, product_id, type, quantity, unit_cost, unit_price, reason, reference, document_id, date, notes, created_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?);`,
          [
            movement.id,
            movement.productId,
            movement.type,
            movement.quantity,
            movement.unitCost,
            movement.unitPrice,
            movement.reason,
            movement.reference,
            movement.documentId ?? null,
            movement.date,
            movement.notes,
            movement.createdAt,
          ],
          false
        );
      }
      for (const document of documents) {
        await connection.run(
          `INSERT INTO documents (
            id, type, folio, date, supplier_id, customer_name, invoice_number, payment_method,
            subtotal, discount, total, status, cancelled_at, cancel_reason, notes, created_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);`,
          [
            document.id,
            document.type,
            document.folio,
            document.date,
            document.supplierId,
            document.customerName,
            document.invoiceNumber,
            document.paymentMethod,
            document.subtotal,
            document.discount,
            document.total,
            document.status,
            document.cancelledAt,
            document.cancelReason,
            document.notes,
            document.createdAt,
          ],
          false
        );
      }
      for (const line of documentLines) {
        await connection.run(
          `INSERT INTO document_lines (id, document_id, product_id, quantity, unit_amount, line_total, movement_id)
           VALUES (?,?,?,?,?,?,?);`,
          [
            line.id,
            line.documentId,
            line.productId,
            line.quantity,
            line.unitAmount,
            line.lineTotal,
            line.movementId,
          ],
          false
        );
      }

      await connection.commitTransaction();
      await this.db.persist();

      if (parsed.images) {
        for (const [path, base64] of Object.entries(parsed.images)) {
          try {
            await this.images.writeFromBase64(path, base64);
          } catch {
            // omitir
          }
        }
      }
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
      imagePath: (row['image_path'] as string | null) ?? null,
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
      barcode: (row['barcode'] as string | null) ?? null,
      imagePath: (row['image_path'] as string | null) ?? null,
      salePrice: Number(row['sale_price'] ?? 0),
      wholesalePrice: Number(row['wholesale_price'] ?? 0),
      wholesaleMinQty: Number(row['wholesale_min_qty'] ?? 0),
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
      documentId: (row['document_id'] as string | null) ?? null,
      date: String(row['date']),
      notes: (row['notes'] as string | null) ?? null,
      createdAt: String(row['created_at']),
    };
  }

  private mapDocument(row: Record<string, unknown>): InventoryDocument {
    return {
      id: String(row['id']),
      type: row['type'] as InventoryDocument['type'],
      folio: Number(row['folio']),
      date: String(row['date']),
      supplierId: (row['supplier_id'] as string | null) ?? null,
      customerName: (row['customer_name'] as string | null) ?? null,
      invoiceNumber: (row['invoice_number'] as string | null) ?? null,
      paymentMethod: (row['payment_method'] as InventoryDocument['paymentMethod']) ?? null,
      subtotal: Number(row['subtotal'] ?? 0),
      discount: Number(row['discount'] ?? 0),
      total: Number(row['total'] ?? 0),
      status: row['status'] as InventoryDocument['status'],
      cancelledAt: (row['cancelled_at'] as string | null) ?? null,
      cancelReason: (row['cancel_reason'] as string | null) ?? null,
      notes: (row['notes'] as string | null) ?? null,
      createdAt: String(row['created_at']),
    };
  }

  private mapDocumentLine(row: Record<string, unknown>): DocumentLine {
    return {
      id: String(row['id']),
      documentId: String(row['document_id']),
      productId: String(row['product_id']),
      quantity: Number(row['quantity']),
      unitAmount: Number(row['unit_amount'] ?? 0),
      lineTotal: Number(row['line_total'] ?? 0),
      movementId: (row['movement_id'] as string | null) ?? null,
    };
  }
}
