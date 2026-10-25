import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../database/database.service';

@Injectable({ providedIn: 'root' })
export class InventoryDataService {
  private db = inject(DatabaseService);

  async clearAll(): Promise<void> {
    await this.db.execute(`
      DELETE FROM stock_movements;
      DELETE FROM products;
      DELETE FROM brands;
      DELETE FROM categories;
      DELETE FROM suppliers;
    `);
  }
}
