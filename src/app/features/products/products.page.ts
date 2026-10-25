import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AlertController,
  ToastController,
  IonBadge,
  IonChip,
  IonContent,
  IonCol,
  IonFab,
  IonFabButton,
  IonGrid,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonRow,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { ProductStock } from '../../core/models';
import { ProductThumbComponent } from '../../shared/product-thumb.component';
import { ProductUnitLabelPipe } from '../../shared/label.pipe';
import { MxnPipe } from '../../shared/mxn.pipe';
import { BrandService } from '../catalogs/brand.service';
import { CategoryService } from '../catalogs/category.service';
import { SupplierService } from '../catalogs/supplier.service';
import { ProductListFilters, ProductService } from './product.service';

@Component({
  selector: 'app-products',
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonGrid,
    IonRow,
    IonCol,
    IonSearchbar,
    IonSelect,
    IonSelectOption,
    IonList,
    IonItem,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonLabel,
    IonNote,
    IonBadge,
    IonChip,
    IonIcon,
    IonFab,
    IonFabButton,
    RouterLink,
    MxnPipe,
    ProductUnitLabelPipe,
    ProductThumbComponent,
  ],
})
export class ProductsPage {
  private productsApi = inject(ProductService);
  private categoriesApi = inject(CategoryService);
  private brandsApi = inject(BrandService);
  private suppliersApi = inject(SupplierService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  products = signal<ProductStock[]>([]);
  search = signal('');
  categoryId = signal('');
  brandId = signal('');
  supplierId = signal('');
  lowStockOnly = signal(false);

  categories = signal<{ id: string; name: string }[]>([]);
  brands = signal<{ id: string; name: string }[]>([]);
  suppliers = signal<{ id: string; name: string }[]>([]);

  filteredCount = computed(() => this.products().length);

  async ionViewWillEnter(): Promise<void> {
    const [categories, brands, suppliers] = await Promise.all([
      this.categoriesApi.list(),
      this.brandsApi.list(),
      this.suppliersApi.list(true),
    ]);
    this.categories.set(categories.map((c) => ({ id: c.id, name: c.name })));
    this.brands.set(brands.map((b) => ({ id: b.id, name: b.name })));
    this.suppliers.set(suppliers.map((s) => ({ id: s.id, name: s.name })));
    await this.reload();
  }

  async reload(event?: CustomEvent): Promise<void> {
    const filters: ProductListFilters = {
      search: this.search(),
      categoryId: this.categoryId() || undefined,
      brandId: this.brandId() || undefined,
      supplierId: this.supplierId() || undefined,
      lowStockOnly: this.lowStockOnly(),
    };
    this.products.set(await this.productsApi.list(filters));
    await event?.detail.complete();
  }

  onSearch(event: CustomEvent): void {
    this.search.set(String(event.detail.value ?? ''));
    void this.reload();
  }

  toggleLowStock(): void {
    this.lowStockOnly.update((v) => !v);
    void this.reload();
  }

  async confirmDelete(product: ProductStock): Promise<void> {
    const movementCount = await this.productsApi.movementCount(product.id);
    if (movementCount > 0) {
      const alert = await this.alertCtrl.create({
        header: 'Producto con historial',
        message: `${product.name} tiene ${movementCount} movimiento(s). No se puede eliminar; puedes desactivarlo.`,
        buttons: [
          { text: 'Cancelar', role: 'cancel' },
          {
            text: 'Desactivar',
            handler: async () => {
              await this.productsApi.deactivate(product.id);
              await this.reload();
            },
          },
        ],
      });
      await alert.present();
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Eliminar producto',
      message: `Se borrará ${product.name} (sin movimientos registrados).`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.productsApi.remove(product.id);
              await this.reload();
            } catch (error) {
              const toast = await this.toastCtrl.create({
                message: error instanceof Error ? error.message : 'No se pudo eliminar',
                duration: 2400,
                color: 'dark',
              });
              await toast.present();
            }
          },
        },
      ],
    });
    await alert.present();
  }
}
