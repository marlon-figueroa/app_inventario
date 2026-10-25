import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { todayIso } from '../../core/dates';
import { documentSubtotal } from '../../core/pricing';
import { ProductStock, Supplier } from '../../core/models';
import { MxnPipe } from '../../shared/mxn.pipe';
import { SupplierService } from '../catalogs/supplier.service';
import { ProductService } from '../products/product.service';
import { DocumentService } from './document.service';

interface PurchaseLine {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
}

@Component({
  selector: 'app-purchase-form',
  templateUrl: './purchase-form.page.html',
  styleUrls: ['./purchase-form.page.scss'],
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonSearchbar,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonIcon,
    MxnPipe,
  ],
})
export class PurchaseFormPage {
  readonly Number = Number;

  private fb = inject(FormBuilder);
  private productsApi = inject(ProductService);
  private suppliersApi = inject(SupplierService);
  private documentsApi = inject(DocumentService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  search = signal('');
  results = signal<ProductStock[]>([]);
  lines = signal<PurchaseLine[]>([]);
  suppliers = signal<Supplier[]>([]);
  saving = signal(false);

  form = this.fb.nonNullable.group({
    date: this.fb.nonNullable.control(todayIso()),
    supplierId: this.fb.nonNullable.control(''),
    invoiceNumber: this.fb.control<string | null>(null),
    notes: this.fb.control<string | null>(null),
  });

  total = computed(() => documentSubtotal(this.lines().map((l) => ({ lineTotal: l.lineTotal }))));

  async ionViewWillEnter(): Promise<void> {
    this.suppliers.set(await this.suppliersApi.list(true));
  }

  async onSearch(event: CustomEvent): Promise<void> {
    const q = String(event.detail.value ?? '');
    this.search.set(q);
    if (!q.trim()) {
      this.results.set([]);
      return;
    }
    this.results.set(await this.productsApi.list({ search: q, activeOnly: false }));
  }

  addProduct(product: ProductStock): void {
    const existing = this.lines().find((l) => l.productId === product.id);
    if (existing) {
      this.lines.set(
        this.lines().map((l) =>
          l.productId === product.id
            ? {
                ...l,
                quantity: l.quantity + 1,
                lineTotal: (l.quantity + 1) * l.unitCost,
              }
            : l
        )
      );
      return;
    }
    const cost = product.avgCost > 0 ? product.avgCost : product.salePrice;
    this.lines.set([
      ...this.lines(),
      {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity: 1,
        unitCost: cost,
        lineTotal: cost,
      },
    ]);
  }

  updateLine(productId: string, quantity: number, unitCost: number): void {
    this.lines.set(
      this.lines().map((line) => {
        if (line.productId !== productId) {
          return line;
        }
        const qty = Math.max(1, quantity);
        const cost = Math.max(0, unitCost);
        return { ...line, quantity: qty, unitCost: cost, lineTotal: qty * cost };
      })
    );
  }

  removeLine(productId: string): void {
    this.lines.set(this.lines().filter((l) => l.productId !== productId));
  }

  async save(): Promise<void> {
    if (!this.lines().length) {
      return;
    }
    if (!this.form.controls.supplierId.value) {
      const toast = await this.toastCtrl.create({
        message: 'Selecciona un proveedor',
        duration: 2000,
        color: 'warning',
      });
      await toast.present();
      return;
    }
    this.saving.set(true);
    const value = this.form.getRawValue();
    try {
      const id = await this.documentsApi.createPurchase({
        date: value.date,
        supplierId: value.supplierId,
        invoiceNumber: value.invoiceNumber,
        notes: value.notes,
        lines: this.lines().map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitAmount: l.unitCost,
        })),
      });
      await this.router.navigate(['/tabs/operaciones/documento', id]);
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: error instanceof Error ? error.message : 'No se pudo registrar la compra',
        duration: 2800,
        color: 'dark',
      });
      await toast.present();
    } finally {
      this.saving.set(false);
    }
  }
}
