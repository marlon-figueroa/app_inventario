# Inventario

App **Ionic Angular + Capacitor** (PWA y Android) para **gestión de inventario**: productos por categoría y marca (según proveedor), entradas, salidas, ajustes, costo promedio y reportes. Los datos viven en **SQLite local** y se exportan o restauran como JSON v2.

Arquitectura, esquema y reglas de stock: **[Manual técnico](docs/manual-tecnico.md)**.

## Arquitectura (modelo C4)

El sistema es **offline-first**: no hay API remota. El intercambio externo es un archivo JSON de respaldo.

### Nivel 1 — Contexto

```mermaid
flowchart LR
  classDef person fill:#08427B,stroke:#062A4F,color:#ffffff
  classDef system fill:#1168BD,stroke:#0B4A86,color:#ffffff
  classDef external fill:#8A8496,stroke:#66607A,color:#ffffff

  user(["Usuario<br/>Inventario y movimientos"]):::person
  app["Inventario<br/>PWA Ionic Angular y APK Android<br/>SQLite local"]:::system
  files["Archivos del dispositivo<br/>JSON de respaldo"]:::external

  user -->|"Usa"| app
  app -->|"Exporta e importa"| files
```

### Nivel 2 — Contenedores

```mermaid
flowchart TB
  classDef person fill:#08427B,stroke:#062A4F,color:#ffffff
  classDef container fill:#438DD5,stroke:#2E6BA8,color:#ffffff
  classDef external fill:#8A8496,stroke:#66607A,color:#ffffff

  user(["Usuario"]):::person

  subgraph inv["Inventario"]
    direction TB
    ui["App Ionic Angular<br/>Angular 22 + Ionic 9"]:::container
    sw["Service Worker<br/>solo web producción"]:::container
    cap["Capacitor 8"]:::container
    db[("SQLite inventario v2")]:::container
  end

  files["Archivos JSON"]:::external

  user --> ui
  ui --> sw
  ui --> cap
  ui --> db
  cap --> db
  cap --> files
  ui --> files
```

### Nivel 3 — Componentes (resumen)

| Capa | Componente | Archivo |
| --- | --- | --- |
| Shell | `AppComponent`, `TabsPage` | `src/app/` |
| UI | `DashboardPage` | `features/dashboard/` |
| UI | Productos (lista, detalle, formulario) | `features/products/` |
| UI | Movimientos | `features/movements/` |
| UI | Catálogos (proveedores, marcas, categorías) | `features/catalogs/` |
| UI | `ReportsPage`, `SettingsPage` | `features/reports/`, `settings/` |
| Dominio | `ProductService`, `StockMovementService`, `ReportService`, catálogos | junto a cada feature |
| Core | `DatabaseService`, `inventory-math`, `BackupService`, `ThemeService` | `src/app/core/` |

## Requisitos

- Node.js
- JDK 21 (Homebrew `openjdk@21`) para Android

```bash
npm install
```

## Desarrollo

```bash
npm start
```

Abre `http://localhost:4200`.

## Android

```bash
npm run android:apk
```

APK debug: `android/app/build/outputs/apk/debug/app_inventario.apk`

## Uso

1. En **Ajustes → Catálogos**, crea proveedores, marcas y categorías.
2. Registra **productos** (SKU, categoría, marca).
3. En **Operaciones**, registra **ventas** (ticket), **compras** o movimientos sueltos (entrada/salida/ajuste).
4. Asigna **fotos** a productos y marcas; usa **código de barras** en Android o lector USB en web.
5. Revisa **Inicio** y **Reportes** (incluye CSV de inventario, movimientos y ventas).
6. Exporta o restaura respaldo JSON v3 en Ajustes.

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm start` | Servidor `:4200` |
| `npm run build` | Build a `www/` |
| `npm run android:apk` | APK debug |
| `npm test` | Vitest |
| `npm run lint` | ESLint |

## Documentación

| Documento | Contenido |
| --- | --- |
| Este README | Uso, scripts, C4 |
| [docs/manual-tecnico.md](docs/manual-tecnico.md) | Esquema v2, stock, reportes, respaldo |
