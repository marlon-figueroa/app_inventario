import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { createId } from '../../core/ids';
import { ImageService } from '../../core/media/image.service';
import { PRODUCT_UNIT_LABELS } from '../../core/labels';
import { ProductUnit, PRODUCT_UNITS } from '../../core/models';
import { EntityImageComponent } from '../../shared/entity-image.component';
import { BrandService } from '../catalogs/brand.service';
import { CategoryService } from '../catalogs/category.service';
import { ProductService } from './product.service';

@Component({
  selector: 'app-product-form',
  templateUrl: './product-form.page.html',
  styleUrls: ['./product-form.page.scss'],
  imports: [
    ReactiveFormsModule,
    EntityImageComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonToggle,
    IonButton,
  ],
})
export class ProductFormPage implements OnInit {
  private fb = inject(FormBuilder);
  private productsApi = inject(ProductService);
  private categoriesApi = inject(CategoryService);
  private brandsApi = inject(BrandService);
  private images = inject(ImageService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  id = input<string | undefined>();
  saving = signal(false);
  categories = signal<{ id: string; name: string }[]>([]);
  brands = signal<{ id: string; name: string; supplierName: string }[]>([]);
  imagePath = signal<string | null>(null);
  entityId = signal('');

  units = PRODUCT_UNITS.map((u) => [u, PRODUCT_UNIT_LABELS[u]] as const);

  form = this.fb.nonNullable.group({
    sku: ['', Validators.required],
    name: ['', Validators.required],
    categoryId: ['', Validators.required],
    brandId: ['', Validators.required],
    unit: this.fb.nonNullable.control<ProductUnit>('pieza'),
    barcode: this.fb.control<string | null>(null),
    salePrice: this.fb.control<number | null>(0),
    wholesalePrice: this.fb.control<number | null>(0),
    wholesaleMinQty: this.fb.control<number | null>(0),
    minStock: this.fb.control<number | null>(0),
    notes: this.fb.control<string | null>(''),
    active: this.fb.nonNullable.control(true),
  });

  get isEdit(): boolean {
    return !!this.id();
  }

  selectedSupplier(): string {
    const brandId = this.form.controls.brandId.value;
    return this.brands().find((b) => b.id === brandId)?.supplierName ?? '—';
  }

  async ngOnInit(): Promise<void> {
    this.entityId.set(this.id() ?? createId());

    const [categories, brands] = await Promise.all([
      this.categoriesApi.list(),
      this.brandsApi.list(),
    ]);
    this.categories.set(categories.map((c) => ({ id: c.id, name: c.name })));
    this.brands.set(
      brands.map((b) => ({ id: b.id, name: b.name, supplierName: b.supplierName }))
    );

    const id = this.id();
    if (!id) {
      return;
    }
    const product = await this.productsApi.get(id);
    if (!product) {
      return;
    }
    this.imagePath.set(product.imagePath);
    this.form.patchValue({
      sku: product.sku,
      name: product.name,
      categoryId: product.categoryId,
      brandId: product.brandId,
      unit: product.unit,
      barcode: product.barcode,
      salePrice: product.salePrice,
      wholesalePrice: product.wholesalePrice,
      wholesaleMinQty: product.wholesaleMinQty,
      minStock: product.minStock,
      notes: product.notes,
      active: product.active,
    });
  }

  onImagePathChange(path: string | null): void {
    this.imagePath.set(path);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const value = this.form.getRawValue();
    const payload = {
      sku: value.sku,
      name: value.name,
      categoryId: value.categoryId,
      brandId: value.brandId,
      unit: value.unit,
      barcode: value.barcode,
      imagePath: this.imagePath(),
      salePrice: Number(value.salePrice ?? 0),
      wholesalePrice: Number(value.wholesalePrice ?? 0),
      wholesaleMinQty: Number(value.wholesaleMinQty ?? 0),
      minStock: Number(value.minStock ?? 0),
      notes: value.notes,
      active: value.active,
    };

    try {
      if (this.id()) {
        const previous = await this.productsApi.get(this.id()!);
        await this.productsApi.update(this.id()!, payload);
        if (previous?.imagePath && previous.imagePath !== payload.imagePath) {
          await this.images.remove(previous.imagePath);
        }
        await this.router.navigate(['/tabs/productos', this.id()]);
      } else {
        const createdId = await this.productsApi.create(payload, this.entityId());
        await this.router.navigate(['/tabs/productos', createdId]);
      }
      const toast = await this.toastCtrl.create({
        message: 'Producto guardado',
        duration: 1600,
        color: 'success',
      });
      await toast.present();
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: error instanceof Error ? error.message : 'No se pudo guardar',
        duration: 2400,
        color: 'dark',
      });
      await toast.present();
    } finally {
      this.saving.set(false);
    }
  }
}
