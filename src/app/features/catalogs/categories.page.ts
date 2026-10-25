import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { Category } from '../../core/models';
import { CategoryService } from './category.service';

@Component({
  selector: 'app-categories',
  templateUrl: './categories.page.html',
  styleUrls: ['./catalogs.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonList,
    IonItem,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonLabel,
    IonIcon,
    IonFab,
    IonFabButton,
    RouterLink,
  ],
})
export class CategoriesPage {
  private api = inject(CategoryService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  items = signal<Category[]>([]);

  async ionViewWillEnter(): Promise<void> {
    await this.reload();
  }

  async reload(event?: CustomEvent): Promise<void> {
    this.items.set(await this.api.list());
    await event?.detail.complete();
  }

  async confirmDelete(item: Category): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar categoría',
      message: `¿Eliminar ${item.name}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.api.remove(item.id);
              await this.reload();
            } catch (error) {
              const toast = await this.toastCtrl.create({
                message: error instanceof Error ? error.message : 'No se pudo eliminar',
                duration: 2200,
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
