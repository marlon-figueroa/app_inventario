import { Component, ElementRef, viewChild, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import {
  AlertController,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { BackupService } from '../../core/backup/backup.service';
import { InventoryDataService } from '../../core/data/inventory-data.service';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonIcon,
    IonSegment,
    IonSegmentButton,
    RouterLink,
  ],
})
export class SettingsPage {
  private backupApi = inject(BackupService);
  private dataApi = inject(InventoryDataService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  theme = inject(ThemeService);
  fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  platform = Capacitor.getPlatform();
  busy = signal(false);

  setTheme(value: string | number | undefined): void {
    if (value === 'light' || value === 'dark' || value === 'system') {
      this.theme.setPreference(value);
    }
  }

  async exportBackup(): Promise<void> {
    this.busy.set(true);
    try {
      const filename = await this.backupApi.downloadOrShare();
      const toast = await this.toastCtrl.create({
        message: `Respaldo listo: ${filename}`,
        duration: 1800,
        color: 'success',
      });
      await toast.present();
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: error instanceof Error ? error.message : 'No se pudo exportar',
        duration: 2200,
        color: 'dark',
      });
      await toast.present();
    } finally {
      this.busy.set(false);
    }
  }

  pickBackup(): void {
    this.fileInput()?.nativeElement.click();
  }

  async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    const alert = await this.alertCtrl.create({
      header: 'Reemplazar datos',
      message: 'Esto borra la información actual y carga el respaldo.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Importar',
          handler: async () => {
            try {
              await this.backupApi.importBackup(await file.text());
              const toast = await this.toastCtrl.create({
                message: 'Respaldo restaurado',
                duration: 1800,
                color: 'success',
              });
              await toast.present();
            } catch (error) {
              const toast = await this.toastCtrl.create({
                message: error instanceof Error ? error.message : 'Respaldo inválido',
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

  async clearData(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Vaciar datos',
      message: 'Se eliminarán proveedores, catálogos, productos y movimientos.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Vaciar',
          role: 'destructive',
          handler: async () => {
            await this.dataApi.clearAll();
            const toast = await this.toastCtrl.create({ message: 'Datos eliminados', duration: 1600 });
            await toast.present();
          },
        },
      ],
    });
    await alert.present();
  }
}
