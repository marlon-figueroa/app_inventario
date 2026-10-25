# Manual técnico — Inventario

Referencia de arquitectura, dominio, persistencia y empaquetado para quien mantenga o extienda la app.

## 1. Qué es

Inventario es una app **offline-first** para **gestión de stock**: productos por categoría y marca (cada marca pertenece a un proveedor), entradas, salidas, ajustes de inventario, costo promedio ponderado y reportes. Corre como **PWA** (Ionic Angular) y como **APK Android** (Capacitor). No hay backend: los datos viven en **SQLite local**.

| Dato | Valor |
| --- | --- |
| Nombre | Inventario |
| Paquete Android | `com.mfigueroa.inventario` |
| Idioma / locale | `es-MX` |
| Base de datos | `inventario` (esquema **v3**) |
| Respaldo JSON | `schemaVersion` **3** (importa v2) |

## 2. Stack

- **Angular 22** standalone (`bootstrapApplication`)
- **Ionic 9** + **Ionicons 8**
- **Capacitor 8** (`androidScheme: https`)
- **@capacitor-community/sqlite** en nativo; **jeep-sqlite** + **sql.js** (WASM) en web
- **Service Worker** solo en build web de producción; en Android se desregistra a propósito
- Salida de build: `www/`

## 3. Arranque

`src/main.ts` registra `es-MX` y espera:

1. `ThemeService.initialize()`
2. `DatabaseService.initialize()` — jeep-sqlite en web, migraciones incrementales (`user_version` → 3)

## 4. Estructura del código

```
src/app/
  core/           modelos, SQLite, inventory-math, dinero, fechas, tema, respaldo
  features/
    catalogs/     proveedores, marcas, categorías
    products/     productos, recálculo de stock
    movements/    entradas, salidas, ajustes
    dashboard/    resumen
    reports/      agregados por periodo
    settings/     tema, catálogos, respaldo
  shared/         pipes
  tabs/           shell y rutas
```

## 5. Rutas

`src/app/tabs/tabs.routes.ts` + `withComponentInputBinding()`.

| Ruta | Pantalla |
| --- | --- |
| `/tabs/inicio` | Dashboard de inventario |
| `/tabs/productos` | Lista con filtros |
| `/tabs/productos/nuevo` | Alta de producto |
| `/tabs/productos/:id` | Detalle + accesos a movimientos |
| `/tabs/productos/:id/editar` | Edición |
| `/tabs/operaciones` | Ventas, compras y movimientos |
| `/tabs/operaciones/venta/nueva` | Punto de venta (ticket) |
| `/tabs/operaciones/compra/nueva` | Compra multi-partida |
| `/tabs/operaciones/documento/:id` | Detalle de ticket / compra |
| `/tabs/operaciones/movimientos/nuevo` | Alta (`?productId=` y `?type=` opcionales) |
| `/tabs/operaciones/movimientos/:id/editar` | Edición |
| `/tabs/reportes` | Totales por periodo |
| `/tabs/ajustes` | Tema, respaldo, enlaces a catálogos |
| `/tabs/ajustes/proveedores` | CRUD proveedores |
| `/tabs/ajustes/marcas` | CRUD marcas (FK proveedor) |
| `/tabs/ajustes/categorias` | CRUD categorías |

## 6. Dominio

### Catálogos

- **Proveedor** (`suppliers`): contacto, activo/inactivo.
- **Marca** (`brands`): `supplier_id` obligatorio (`ON DELETE RESTRICT`).
- **Categoría** (`categories`): nombre único.

### Producto

SKU único, categoría, marca, unidad (catálogo ampliado para ferretería), código de barras, imagen, precio de venta, precio/cantidad de mayoreo, stock mínimo, notas.  
Campos cacheados: `stock`, `avg_cost` (costo promedio ponderado).

### Documentos (`documents` / `document_lines`)

Ventas (`sale`) y compras (`purchase`) con folio, partidas, totales y cancelación que revierte movimientos de stock. Los movimientos ligados llevan `document_id`.

### Movimientos (`stock_movements`)

| Tipo | Cantidad | Costo / precio |
| --- | --- | --- |
| `entry` | positiva | `unit_cost` obligatorio en UI |
| `exit` | positiva (se guarda positiva) | `unit_price` opcional; `unit_cost` se fija al recalcular |
| `adjustment` | delta con signo | positivo aumenta stock; negativo reduce |

Motivos: entradas (`compra`, `devolucion_cliente`, `otro`); salidas (`venta`, `consumo`, `devolucion_proveedor`, `otro`); ajustes (`conteo`, `merma`, `dano`, `caducidad`, `otro`).

El ajuste en UI se captura como **cantidad contada**; el servicio persiste `delta = contada - stock actual`.

## 7. Stock y costo promedio

Lógica pura en `src/app/core/inventory-math.ts` (`replay()`):

- Entrada: nuevo promedio = `(stock×avg + qty×costo) / (stock + qty)`.
- Salida / ajuste negativo: descuenta al `avg` vigente; rechaza si no hay stock (`InsufficientStockError`).
- Tras cada alta/edición/baja de movimiento, `InventoryStockService.recalculate(productId)` actualiza `products.stock`, `products.avg_cost` y `unit_cost` de salidas/ajustes.

Pruebas: `inventory-math.spec.ts` (Vitest).

## 8. Persistencia

`migrations.ts`: `SCHEMA_VERSION = 3`. Migración incremental: v1 legado → v2 → v3 (productos sin CHECK de unidad, imágenes, barcode, mayoreo, documentos).

Tablas: `suppliers`, `brands`, `categories`, `products`, `stock_movements`, `documents`, `document_lines`.

`PRAGMA foreign_keys = ON`. Sin cifrado.

## 9. Reportes

`ReportService.summarize(period, reference)`:

- Totales: cantidades y montos de entradas (costo), salidas (ingreso y costo vendido), margen, ajustes netos.
- Agrupación por categoría, marca y proveedor.
- Lista de movimientos del periodo.

## 10. Respaldo

`AppBackup` v3 incluye catálogos, productos, movimientos, documentos, partidas e imágenes (base64).  
Importación en transacción (borra todo e inserta en orden de FK). Acepta respaldo v2 (campos nuevos en null).

`InventoryDataService.clearAll()` vacía todas las tablas de inventario.

## 11. UI y tema

Ver `src/theme/variables.scss` y `ThemeService`. Logos en `assets/icon/`.

## 12. Plataformas

Igual que antes: PWA con `ng build`; Android con `npm run android:apk` (JDK 21).

## 13. Archivos clave

| Archivo | Rol |
| --- | --- |
| `src/app/core/models.ts` | Contratos |
| `src/app/core/inventory-math.ts` | Replay stock / costo |
| `src/app/core/database/migrations.ts` | DDL v2 |
| `src/app/features/products/product.service.ts` | CRUD productos |
| `src/app/features/products/inventory-stock.service.ts` | Recálculo |
| `src/app/features/movements/stock-movement.service.ts` | Movimientos |
| `src/app/features/reports/report.service.ts` | Reportes |
| `src/app/core/backup/backup.service.ts` | JSON v2 |
| `src/app/features/catalogs/*.service.ts` | Catálogos |
