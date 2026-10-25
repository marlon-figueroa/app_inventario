export const DB_NAME = 'inventario';
export const SCHEMA_VERSION = 3;

/** Esquema legado v1 (deudas); solo se usa al migrar desde user_version 1. */
export const SCHEMA_V1 = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('credit_card','loan','extrafinancing')),
  credit_limit REAL,
  principal REAL NOT NULL DEFAULT 0,
  interest_rate REAL,
  cutoff_day INTEGER,
  due_day INTEGER,
  term_months INTEGER,
  monthly_payment REAL,
  start_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paid','closed')),
  paid_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS movements (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('expense','payment','income')),
  amount REAL NOT NULL CHECK(amount > 0),
  date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_movements_product ON movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_date ON movements(date);
`;

export const DROP_LEGACY_V1 = `
DROP TABLE IF EXISTS movements;
DROP TABLE IF EXISTS products;
`;

export const SCHEMA_V2 = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  unit TEXT NOT NULL CHECK(unit IN ('pieza','caja','kg','litro','metro')),
  sale_price REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 0,
  stock REAL NOT NULL DEFAULT 0,
  avg_cost REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('entry','exit','adjustment')),
  quantity REAL NOT NULL CHECK(quantity <> 0),
  unit_cost REAL,
  unit_price REAL,
  reason TEXT NOT NULL DEFAULT '',
  reference TEXT,
  date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_brands_supplier ON brands(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(date);
`;

/** Migración v2 → v3: productos sin CHECK de unidad, imágenes, barcode, mayoreo, documentos. */
export const MIGRATION_V3 = `
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS products_new (
  id TEXT PRIMARY KEY NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  unit TEXT NOT NULL,
  barcode TEXT,
  image_path TEXT,
  sale_price REAL NOT NULL DEFAULT 0,
  wholesale_price REAL NOT NULL DEFAULT 0,
  wholesale_min_qty REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 0,
  stock REAL NOT NULL DEFAULT 0,
  avg_cost REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE RESTRICT
);

INSERT INTO products_new (
  id, sku, name, category_id, brand_id, unit, barcode, image_path,
  sale_price, wholesale_price, wholesale_min_qty, min_stock, stock, avg_cost,
  active, notes, created_at, updated_at
)
SELECT
  id, sku, name, category_id, brand_id, unit, NULL, NULL,
  sale_price, 0, 0, min_stock, stock, avg_cost,
  active, notes, created_at, updated_at
FROM products;

DROP TABLE products;
ALTER TABLE products_new RENAME TO products;

CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('sale','purchase')),
  folio INTEGER NOT NULL,
  date TEXT NOT NULL,
  supplier_id TEXT,
  customer_name TEXT,
  invoice_number TEXT,
  payment_method TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed','cancelled')),
  cancelled_at TEXT,
  cancel_reason TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(type, folio),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS document_lines (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity REAL NOT NULL CHECK(quantity > 0),
  unit_amount REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0,
  movement_id TEXT,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (movement_id) REFERENCES stock_movements(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_type_date ON documents(type, date);
CREATE INDEX IF NOT EXISTS idx_document_lines_document ON document_lines(document_id);
CREATE INDEX IF NOT EXISTS idx_document_lines_product ON document_lines(product_id);

ALTER TABLE brands ADD COLUMN image_path TEXT;

ALTER TABLE stock_movements ADD COLUMN document_id TEXT;

CREATE INDEX IF NOT EXISTS idx_stock_movements_document ON stock_movements(document_id);

PRAGMA foreign_keys = ON;
`;
