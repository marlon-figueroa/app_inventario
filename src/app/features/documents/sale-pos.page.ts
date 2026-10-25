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
import { PAYMENT_METHOD_LABELS } from '../../core/labels';
import { BarcodeScanService } from '../../core/media/barcode-scan.service';
import { documentSubtotal, documentTotal, pickUnitPrice } from '../../core/pricing';
import { PaymentMethod, ProductStock } from '../../core/models';
import { MxnPipe } from '../../shared/mxn.pipe';
import { ProductService } from '../products/product.service';
import { DocumentService } from './document.service';

interface CartLine {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  maxStock: number;
  salePrice: number;
  wholesalePrice: number;
  wholesaleMinQty: number;
}

@Component({
  selector: 'app-sale-pos',
  templateUrl: './sale-pos.page.html',
  styleUrls: ['./sale-pos.page.scss'],
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonSearchbar,
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonInput,
    IonSelect,
    IonSelectOption,
    MxnPipe,
  ],
})
export class SalePosPage {
  /** Expuesto al template para parsear inputs numéricos. */
  readonly Number = Number;

  private fb = inject(FormBuilder);
  private productsApi = inject(ProductService);
  private documentsApi = inject(DocumentService);
  private barcode = inject(BarcodeScanService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  search = signal('');
  results = signal<ProductStock[]>([]);
  cart = signal<CartLine[]>([]);
  saving = signal(false);

  paymentMethods = Object.entries(PAYMENT_METHOD_LABELS) as Array<[PaymentMethod, string]>;

  form = this.fb.nonNullable.group({
    date: this.fb.nonNullable.control(todayIso()),
    customerName: this.fb.control<string | null>(null),
    paymentMethod: this.fb.nonNullable.control<PaymentMethod>('efectivo'),
    discount: this.fb.control<number | null>(0),
    amountReceived: this.fb.control<number | null>(null),
    notes: this.fb.control<string | null>(null),
  });

  subtotal = computed(() => documentSubtotal(this.cart().map((l) => ({ lineTotal: l.lineTotal }))));
  total = computed(() => documentTotal(this.subtotal(), Number(this.form.controls.discount.value ?? 0)));
  changeDue = computed(() => {
    const received = Number(this.form.controls.amountReceived.value ?? 0);
    if (this.form.controls.paymentMethod.value !== 'efectivo') {
      return 0;
    }
    return Math.max(0, received - this.total());
  });

  async onSearch(event: CustomEvent): Promise<void> {
    const q = String(event.detail.value ?? '');
    this.search.set(q);
    if (!q.trim()) {
      this.results.set([]);
      return;
    }
    this.results.set(await this.productsApi.list({ search: q, activeOnly: true }));
  }

  async onSearchKeydown(event: KeyboardEvent): Promise<void> {
    if (event.key !== 'Enter') {
      return;
    }
    const code = this.search().trim();
    if (!code) {
      return;
    }
    const product = await this.productsApi.findByCode(code);
    if (product) {
      this.addProduct(product);
      this.search.set('');
      this.results.set([]);
    }
  }

  async scanBarcode(): Promise<void> {
    try {
      const code = await this.barcode.scanOnce();
      if (!code) {
        const toast = await this.toastCtrl.create({
          message: 'Escaneo disponible en Android. En web usa el lector USB o escribe el código.',
          duration: 2600,
          color: 'medium',
        });
        await toast.present();
        return;
      }
      const product = await this.productsApi.findByCode(code);
      if (!product) {
        const toast = await this.toastCtrl.create({
          message: 'Producto no encontrado',
          duration: 2000,
          color: 'dark',
        });
        await toast.present();
        return;
      }
      this.addProduct(product);
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: error instanceof Error ? error.message : 'No se pudo escanear',
        duration: 2400,
        color: 'dark',
      });
      await toast.present();
    }
  }

  addProduct(product: ProductStock): void {
    const existing = this.cart().find((l) => l.productId === product.id);
    const nextQty = (existing?.quantity ?? 0) + 1;
    if (nextQty > product.stock) {
      void this.toastCtrl
        .create({
          message: `Stock insuficiente (${product.stock} disponibles)`,
          duration: 2200,
          color: 'warning',
        })
        .then((t) => t.present());
      return;
    }
    const unitPrice = pickUnitPrice(nextQty, product);
    const line: CartLine = {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      quantity: nextQty,
      unitPrice,
      lineTotal: nextQty * unitPrice,
      maxStock: product.stock,
      salePrice: product.salePrice,
      wholesalePrice: product.wholesalePrice,
      wholesaleMinQty: product.wholesaleMinQty,
    };
    if (existing) {
      this.cart.set(this.cart().map((l) => (l.productId === product.id ? line : l)));
    } else {
      this.cart.set([...this.cart(), line]);
    }
  }

  updateLine(productId: string, quantity: number, unitPrice: number): void {
    this.cart.set(
      this.cart().map((line) => {
        if (line.productId !== productId) {
          return line;
        }
        const qty = Math.max(0, quantity);
        if (qty <= 0) {
          return line;
        }
        if (qty > line.maxStock) {
          return line;
        }
        const suggested = pickUnitPrice(qty, line);
        const price = unitPrice > 0 ? unitPrice : suggested;
        return {
          ...line,
          quantity: qty,
          unitPrice: price,
          lineTotal: qty * price,
        };
      })
    );
  }

  removeLine(productId: string): void {
    this.cart.set(this.cart().filter((l) => l.productId !== productId));
  }

  async checkout(): Promise<void> {
    if (!this.cart().length) {
      return;
    }
    this.saving.set(true);
    const value = this.form.getRawValue();
    try {
      const id = await this.documentsApi.createSale({
        date: value.date,
        customerName: value.customerName,
        paymentMethod: value.paymentMethod,
        discount: Number(value.discount ?? 0),
        amountReceived: Number(value.amountReceived ?? 0),
        notes: value.notes,
        lines: this.cart().map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitAmount: l.unitPrice,
        })),
      });
      await this.router.navigate(['/tabs/operaciones/documento', id]);
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: error instanceof Error ? error.message : 'No se pudo registrar la venta',
        duration: 2800,
        color: 'dark',
      });
      await toast.present();
    } finally {
      this.saving.set(false);
    }
  }
}
