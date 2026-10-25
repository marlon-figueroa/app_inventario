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
  IonList,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { Supplier } from '../../core/models';
import { BrandService } from './brand.service';
import { SupplierService } from './supplier.service';

@Component({
  selector: 'app-brand-form',
  templateUrl: './brand-form.page.html',
  styleUrls: ['./catalogs.page.scss'],
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonList,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonButton,
  ],
})
export class BrandFormPage implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(BrandService);
  private suppliersApi = inject(SupplierService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  id = input<string | undefined>();
  saving = signal(false);
  suppliers = signal<Supplier[]>([]);

  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    supplierId: ['', Validators.required],
  });

  get isEdit(): boolean {
    return !!this.id();
  }

  async ngOnInit(): Promise<void> {
    this.suppliers.set(await this.suppliersApi.list(true));
    const id = this.id();
    if (!id) {
      return;
    }
    const item = await this.api.get(id);
    if (!item) {
      return;
    }
    this.form.patchValue({ name: item.name, supplierId: item.supplierId });
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const value = this.form.getRawValue();
    try {
      if (this.id()) {
        await this.api.update(this.id()!, value);
      } else {
        await this.api.create(value);
      }
      const toast = await this.toastCtrl.create({
        message: 'Marca guardada',
        duration: 1600,
        color: 'success',
      });
      await toast.present();
      await this.router.navigate(['/tabs/ajustes/marcas']);
    } finally {
      this.saving.set(false);
    }
  }
}
