export const PRODUCT_UNITS = ['pieza', 'caja', 'kg', 'litro', 'metro'] as const;
export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export const MOVEMENT_TYPES = ['entry', 'exit', 'adjustment'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const ENTRY_REASONS = ['compra', 'devolucion_cliente', 'otro'] as const;
export const EXIT_REASONS = ['venta', 'consumo', 'devolucion_proveedor', 'otro'] as const;
export const ADJUSTMENT_REASONS = ['conteo', 'merma', 'dano', 'caducidad', 'otro'] as const;

export type EntryReason = (typeof ENTRY_REASONS)[number];
export type ExitReason = (typeof EXIT_REASONS)[number];
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];
export type MovementReason = EntryReason | ExitReason | AdjustmentReason;

export interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierInput {
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  active?: boolean;
}

export interface Brand {
  id: string;
  name: string;
  supplierId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandWithSupplier extends Brand {
  supplierName: string;
}

export interface BrandInput {
  name: string;
  supplierId: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryInput {
  name: string;
  description?: string | null;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  brandId: string;
  unit: ProductUnit;
  salePrice: number;
  minStock: number;
  stock: number;
  avgCost: number;
  active: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  sku: string;
  name: string;
  categoryId: string;
  brandId: string;
  unit: ProductUnit;
  salePrice?: number;
  minStock?: number;
  notes?: string | null;
  active?: boolean;
}

export interface ProductStock extends Product {
  categoryName: string;
  brandName: string;
  supplierId: string;
  supplierName: string;
  inventoryValue: number;
  lowStock: boolean;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: MovementType;
  quantity: number;
  unitCost: number | null;
  unitPrice: number | null;
  reason: string;
  reference: string | null;
  date: string;
  notes: string | null;
  createdAt: string;
}

export interface StockMovementInput {
  productId: string;
  type: MovementType;
  quantity: number;
  unitCost?: number | null;
  unitPrice?: number | null;
  reason: string;
  reference?: string | null;
  date: string;
  notes?: string | null;
}

export interface AdjustmentInput {
  productId: string;
  countedQuantity: number;
  reason: AdjustmentReason;
  date: string;
  reference?: string | null;
  notes?: string | null;
}

export type ReportPeriod = 'day' | 'week' | 'month' | 'year';

export interface ReportTotals {
  entryQty: number;
  entryCost: number;
  exitQty: number;
  exitRevenue: number;
  exitCost: number;
  margin: number;
  adjustmentQty: number;
}

export interface ReportByGroup extends ReportTotals {
  groupId: string;
  groupName: string;
}

export interface ReportResult {
  period: ReportPeriod;
  from: string;
  to: string;
  totals: ReportTotals;
  byCategory: ReportByGroup[];
  byBrand: ReportByGroup[];
  bySupplier: ReportByGroup[];
  movements: Array<StockMovement & { productName: string; productSku: string }>;
}

export const BACKUP_SCHEMA_VERSION = 2;

export interface AppBackup {
  schemaVersion: number;
  exportedAt: string;
  suppliers: Supplier[];
  brands: Brand[];
  categories: Category[];
  products: Product[];
  stockMovements: StockMovement[];
}
