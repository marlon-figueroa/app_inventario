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
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { CategoryService } from './category.service';

@Component({
  selector: 'app-category-form',
  templateUrl: './category-form.page.html',
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
    IonButton,
  ],
})
export class CategoryFormPage implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(CategoryService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  id = input<string | undefined>();
  saving = signal(false);

  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: this.fb.control<string | null>(null),
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
    this.form.patchValue({ name: item.name, description: item.description });
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
        message: 'Categoría guardada',
        duration: 1600,
        color: 'success',
      });
      await toast.present();
      await this.router.navigate(['/tabs/ajustes/categorias']);
    } finally {
      this.saving.set(false);
    }
  }
}
