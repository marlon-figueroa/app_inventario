import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
  IonSegment,
  IonSegmentButton,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import {
  ADJUSTMENT_REASON_LABELS,
  ENTRY_REASON_LABELS,
  EXIT_REASON_LABELS,
} from '../../core/labels';
import {
  AdjustmentReason,
  EntryReason,
  ExitReason,
  MovementType,
  ProductStock,
} from '../../core/models';
import { todayIso } from '../../core/dates';
import { ProductService } from '../products/product.service';
import { StockMovementService } from './stock-movement.service';

@Component({
  selector: 'app-movement-form',
  templateUrl: './movement-form.page.html',
  styleUrls: ['./movement-form.page.scss'],
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonButton,
  ],
})
export class MovementFormPage implements OnInit {
  private fb = inject(FormBuilder);
  private movementsApi = inject(StockMovementService);
  private productsApi = inject(ProductService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastCtrl = inject(ToastController);

  id = input<string | undefined>();
  saving = signal(false);
  products = signal<ProductStock[]>([]);
  movementType = signal<MovementType>('entry');
  currentStock = signal(0);

  entryReasons = Object.entries(ENTRY_REASON_LABELS) as Array<[EntryReason, string]>;
  exitReasons = Object.entries(EXIT_REASON_LABELS) as Array<[ExitReason, string]>;
  adjustmentReasons = Object.entries(ADJUSTMENT_REASON_LABELS) as Array<[AdjustmentReason, string]>;

  form = this.fb.nonNullable.group({
    productId: ['', Validators.required],
    quantity: this.fb.control<number | null>(null, Validators.required),
    countedQuantity: this.fb.control<number | null>(null),
    unitCost: this.fb.control<number | null>(null),
    unitPrice: this.fb.control<number | null>(null),
    reason: ['compra', Validators.required],
    reference: this.fb.control<string | null>(null),
    date: this.fb.nonNullable.control(todayIso()),
    notes: this.fb.control<string | null>(null),
  });

  get isEdit(): boolean {
    return !!this.id();
  }

  get isAdjustment(): boolean {
    return this.movementType() === 'adjustment';
  }

  async ngOnInit(): Promise<void> {
    this.products.set(await this.productsApi.list({ activeOnly: false }));

    const qp = this.route.snapshot.queryParamMap;
    const typeParam = qp.get('type') as MovementType | null;
    if (typeParam === 'entry' || typeParam === 'exit' || typeParam === 'adjustment') {
      this.setType(typeParam);
    }
    const productId = qp.get('productId');
    if (productId) {
      this.form.patchValue({ productId });
      await this.refreshStock(productId);
    }

    const id = this.id();
    if (!id) {
      return;
    }
    const movement = await this.movementsApi.get(id);
    if (!movement) {
      return;
    }
    if (movement.documentId) {
      const toast = await this.toastCtrl.create({
        message: 'Este movimiento pertenece a una venta o compra y no se puede editar aquí.',
        duration: 2800,
        color: 'dark',
      });
      await toast.present();
      await this.router.navigate(['/tabs/operaciones']);
      return;
    }
    this.setType(movement.type);
    this.form.patchValue({
      productId: movement.productId,
      quantity: Math.abs(movement.quantity),
      unitCost: movement.unitCost,
      unitPrice: movement.unitPrice,
      reason: movement.reason,
      reference: movement.reference,
      date: movement.date,
      notes: movement.notes,
    });
    await this.refreshStock(movement.productId);
  }

  setType(type: MovementType): void {
    this.movementType.set(type);
    const defaultReason =
      type === 'entry' ? 'compra' : type === 'exit' ? 'venta' : 'conteo';
    this.form.patchValue({ reason: defaultReason });
  }

  async onProductChange(productId: string): Promise<void> {
    await this.refreshStock(productId);
  }

  async refreshStock(productId: string): Promise<void> {
    const product = await this.productsApi.get(productId);
    this.currentStock.set(product?.stock ?? 0);
    if (this.isAdjustment && product) {
      this.form.patchValue({ countedQuantity: product.stock });
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const value = this.form.getRawValue();
    const type = this.movementType();

    try {
      if (this.isEdit) {
        await this.movementsApi.update(this.id()!, {
          productId: value.productId,
          type,
          quantity: Number(value.quantity ?? 0),
          unitCost: value.unitCost,
          unitPrice: value.unitPrice,
          reason: value.reason,
          reference: value.reference,
          date: value.date,
          notes: value.notes,
        });
      } else if (type === 'adjustment') {
        await this.movementsApi.createAdjustment({
          productId: value.productId,
          countedQuantity: Number(value.countedQuantity ?? 0),
          reason: value.reason as AdjustmentReason,
          date: value.date,
          reference: value.reference,
          notes: value.notes,
        });
      } else {
        await this.movementsApi.create({
          productId: value.productId,
          type,
          quantity: Number(value.quantity ?? 0),
          unitCost: type === 'entry' ? Number(value.unitCost ?? 0) : null,
          unitPrice: type === 'exit' ? Number(value.unitPrice ?? 0) : null,
          reason: value.reason,
          reference: value.reference,
          date: value.date,
          notes: value.notes,
        });
      }
      const toast = await this.toastCtrl.create({
        message: 'Movimiento guardado',
        duration: 1600,
        color: 'success',
      });
      await toast.present();
      await this.router.navigate(['/tabs/operaciones']);
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
