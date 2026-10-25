import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { defineCustomElements as defineJeepSqlite } from 'jeep-sqlite/loader';
import { DB_NAME, DROP_LEGACY_V1, SCHEMA_V2, SCHEMA_VERSION } from './migrations';

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private sqlite = new SQLiteConnection(CapacitorSQLite);
  private db: SQLiteDBConnection | null = null;
  private platform = Capacitor.getPlatform();
  private ready = false;

  async initialize(): Promise<void> {
    if (this.ready) {
      return;
    }

    if (this.platform === 'web') {
      await defineJeepSqlite(window);
      const existing = document.querySelector('jeep-sqlite');
      if (!existing) {
        const jeepEl = document.createElement('jeep-sqlite');
        jeepEl.setAttribute('wasmPath', '/assets');
        jeepEl.setAttribute('autoSave', 'true');
        document.body.appendChild(jeepEl);
      }
      await customElements.whenDefined('jeep-sqlite');
      await this.sqlite.initWebStore();
    }

    const consistency = await this.sqlite.checkConnectionsConsistency();
    const isConn = (await this.sqlite.isConnection(DB_NAME, false)).result;
    if (consistency.result && isConn) {
      this.db = await this.sqlite.retrieveConnection(DB_NAME, false);
    } else {
      this.db = await this.sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
    }

    await this.db.open();
    await this.db.execute('PRAGMA foreign_keys = ON;', false);
    await this.migrate();
    await this.persist();
    this.ready = true;
  }

  getConnection(): SQLiteDBConnection {
    if (!this.db) {
      throw new Error('La base de datos no está lista.');
    }
    return this.db;
  }

  async query<T = Record<string, unknown>>(sql: string, values: unknown[] = []): Promise<T[]> {
    const result = await this.getConnection().query(sql, values);
    return (result.values ?? []) as T[];
  }

  async run(sql: string, values: unknown[] = []): Promise<void> {
    await this.getConnection().run(sql, values, false);
    await this.persist();
  }

  async execute(sql: string): Promise<void> {
    await this.getConnection().execute(sql, false);
    await this.persist();
  }

  async persist(): Promise<void> {
    if (this.platform === 'web') {
      await this.sqlite.saveToStore(DB_NAME);
    }
  }

  private async migrate(): Promise<void> {
    const rows = await this.getConnection().query('PRAGMA user_version;');
    const current = Number(rows.values?.[0]?.['user_version'] ?? 0);
    if (current >= SCHEMA_VERSION) {
      return;
    }
    if (current > 0) {
      await this.getConnection().execute(DROP_LEGACY_V1, false);
    }
    await this.getConnection().execute(SCHEMA_V2, false);
    await this.getConnection().execute(`PRAGMA user_version = ${SCHEMA_VERSION};`, false);
  }
}
