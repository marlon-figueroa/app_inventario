import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'inicio',
        loadComponent: () =>
          import('../features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'productos',
        loadComponent: () =>
          import('../features/products/products.page').then((m) => m.ProductsPage),
      },
      {
        path: 'productos/nuevo',
        loadComponent: () =>
          import('../features/products/product-form.page').then((m) => m.ProductFormPage),
      },
      {
        path: 'productos/:id',
        loadComponent: () =>
          import('../features/products/product-detail.page').then((m) => m.ProductDetailPage),
      },
      {
        path: 'productos/:id/editar',
        loadComponent: () =>
          import('../features/products/product-form.page').then((m) => m.ProductFormPage),
      },
      {
        path: 'operaciones',
        loadComponent: () =>
          import('../features/documents/operations.page').then((m) => m.OperationsPage),
      },
      {
        path: 'operaciones/venta/nueva',
        loadComponent: () =>
          import('../features/documents/sale-pos.page').then((m) => m.SalePosPage),
      },
      {
        path: 'operaciones/compra/nueva',
        loadComponent: () =>
          import('../features/documents/purchase-form.page').then((m) => m.PurchaseFormPage),
      },
      {
        path: 'operaciones/documento/:id',
        loadComponent: () =>
          import('../features/documents/document-detail.page').then((m) => m.DocumentDetailPage),
      },
      {
        path: 'operaciones/movimientos/nuevo',
        loadComponent: () =>
          import('../features/movements/movement-form.page').then((m) => m.MovementFormPage),
      },
      {
        path: 'operaciones/movimientos/:id/editar',
        loadComponent: () =>
          import('../features/movements/movement-form.page').then((m) => m.MovementFormPage),
      },
      {
        path: 'movimientos',
        redirectTo: 'operaciones',
        pathMatch: 'full',
      },
      {
        path: 'movimientos/nuevo',
        redirectTo: 'operaciones/movimientos/nuevo',
        pathMatch: 'full',
      },
      {
        path: 'movimientos/:id/editar',
        loadComponent: () =>
          import('../features/movements/movement-form.page').then((m) => m.MovementFormPage),
      },
      {
        path: 'reportes',
        loadComponent: () =>
          import('../features/reports/reports.page').then((m) => m.ReportsPage),
      },
      {
        path: 'ajustes',
        loadComponent: () =>
          import('../features/settings/settings.page').then((m) => m.SettingsPage),
      },
      {
        path: 'ajustes/proveedores',
        loadComponent: () =>
          import('../features/catalogs/suppliers.page').then((m) => m.SuppliersPage),
      },
      {
        path: 'ajustes/proveedores/nuevo',
        loadComponent: () =>
          import('../features/catalogs/supplier-form.page').then((m) => m.SupplierFormPage),
      },
      {
        path: 'ajustes/proveedores/:id/editar',
        loadComponent: () =>
          import('../features/catalogs/supplier-form.page').then((m) => m.SupplierFormPage),
      },
      {
        path: 'ajustes/marcas',
        loadComponent: () => import('../features/catalogs/brands.page').then((m) => m.BrandsPage),
      },
      {
        path: 'ajustes/marcas/nuevo',
        loadComponent: () =>
          import('../features/catalogs/brand-form.page').then((m) => m.BrandFormPage),
      },
      {
        path: 'ajustes/marcas/:id/editar',
        loadComponent: () =>
          import('../features/catalogs/brand-form.page').then((m) => m.BrandFormPage),
      },
      {
        path: 'ajustes/categorias',
        loadComponent: () =>
          import('../features/catalogs/categories.page').then((m) => m.CategoriesPage),
      },
      {
        path: 'ajustes/categorias/nuevo',
        loadComponent: () =>
          import('../features/catalogs/category-form.page').then((m) => m.CategoryFormPage),
      },
      {
        path: 'ajustes/categorias/:id/editar',
        loadComponent: () =>
          import('../features/catalogs/category-form.page').then((m) => m.CategoryFormPage),
      },
      {
        path: '',
        redirectTo: '/tabs/inicio',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: '/tabs/inicio',
    pathMatch: 'full',
  },
];
