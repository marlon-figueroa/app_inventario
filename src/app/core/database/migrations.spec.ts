import { describe, expect, it } from 'vitest';
import { MIGRATION_V3, SCHEMA_VERSION } from './migrations';

describe('migrations v3', () => {
  it('define esquema v3 incremental', () => {
    expect(SCHEMA_VERSION).toBe(3);
    expect(MIGRATION_V3).toContain('products_new');
    expect(MIGRATION_V3).toContain('CREATE TABLE IF NOT EXISTS documents');
    expect(MIGRATION_V3).toContain('document_id');
  });
});
