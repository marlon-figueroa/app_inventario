import { Component, effect, inject, input, output, signal } from '@angular/core';
import {
  ActionSheetController,
  IonButton,
  IonIcon,
  IonImg,
  IonLabel,
  IonSpinner,
} from '@ionic/angular';
import { ImageEntityKind, ImageService } from '../core/media/image.service';

@Component({
  selector: 'app-entity-image',
  template: `
    <div class="entity-image">
      @if (loading()) {
        <ion-spinner name="crescent"></ion-spinner>
      } @else {
        <ion-img [src]="displayUrl()" (ionError)="onImageError()"></ion-img>
      }
      @if (editable()) {
        <ion-button size="small" fill="outline" (click)="openActions()">
          <ion-icon slot="start" name="camera-outline"></ion-icon>
          <ion-label>Imagen</ion-label>
        </ion-button>
      }
    </div>
  `,
  styles: [
    `
      .entity-image {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 0;
      }
      ion-img {
        width: 120px;
        height: 120px;
        object-fit: cover;
        border-radius: 12px;
        background: var(--ion-color-light);
      }
    `,
  ],
  imports: [IonImg, IonButton, IonIcon, IonLabel, IonSpinner],
})
export class EntityImageComponent {
  private images = inject(ImageService);
  private actionSheet = inject(ActionSheetController);

  kind = input.required<ImageEntityKind>();
  entityId = input.required<string>();
  imagePath = input<string | null>(null);
  editable = input(true);

  imagePathChange = output<string | null>();

  displayUrl = signal('');
  loading = signal(true);
  private usePlaceholder = false;

  constructor() {
    effect(() => {
      const path = this.imagePath();
      const kind = this.kind();
      void this.refreshDisplay(path, kind);
    });
  }

  async openActions(): Promise<void> {
    const sheet = await this.actionSheet.create({
      header: 'Imagen',
      buttons: [
        {
          text: 'Tomar foto',
          icon: 'camera-outline',
          handler: () => void this.capture('camera'),
        },
        {
          text: 'Elegir de galería',
          icon: 'images-outline',
          handler: () => void this.capture('gallery'),
        },
        ...(this.imagePath()
          ? [
              {
                text: 'Quitar imagen',
                role: 'destructive' as const,
                icon: 'trash-outline',
                handler: () => void this.removeImage(),
              },
            ]
          : []),
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  onImageError(): void {
    this.usePlaceholder = true;
    this.displayUrl.set(this.images.placeholderFor(this.kind()));
  }

  private async refreshDisplay(path: string | null, kind: ImageEntityKind): Promise<void> {
    this.loading.set(true);
    this.usePlaceholder = false;
    try {
      const url = await this.images.toDisplayUrl(path, kind);
      this.displayUrl.set(url);
    } finally {
      this.loading.set(false);
    }
  }

  private async capture(source: 'camera' | 'gallery'): Promise<void> {
    try {
      const previous = this.imagePath();
      const path = await this.images.pick(source, this.kind(), this.entityId());
      if (previous && previous !== path) {
        await this.images.remove(previous);
      }
      this.imagePathChange.emit(path);
    } catch {
      // usuario canceló o error de permisos
    }
  }

  private async removeImage(): Promise<void> {
    const previous = this.imagePath();
    if (previous) {
      await this.images.remove(previous);
    }
    this.imagePathChange.emit(null);
  }
}
