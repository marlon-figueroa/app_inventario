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
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { SupplierService } from './supplier.service';

@Component({
  selector: 'app-supplier-form',
  templateUrl: './supplier-form.page.html',
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
    IonTextarea,
    IonToggle,
    IonButton,
  ],
})
export class SupplierFormPage implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(SupplierService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  id = input<string | undefined>();
  saving = signal(false);

  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    contactName: this.fb.control<string | null>(null),
    phone: this.fb.control<string | null>(null),
    email: this.fb.control<string | null>(null),
    notes: this.fb.control<string | null>(null),
    active: this.fb.nonNullable.control(true),
  });

  get isEdit(): boolean {
    return !!this.id();
  }

  async ngOnInit(): Promise<void> {
    const id = this.id();
    if (!id) {
      return;
    }
    const item = await this.api.get(id);
    if (!item) {
      return;
    }
    this.form.patchValue({
      name: item.name,
      contactName: item.contactName,
      phone: item.phone,
      email: item.email,
      notes: item.notes,
      active: item.active,
    });
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
        message: 'Proveedor guardado',
        duration: 1600,
        color: 'success',
      });
      await toast.present();
      await this.router.navigate(['/tabs/ajustes/proveedores']);
    } finally {
      this.saving.set(false);
    }
  }
}
