import { Component, effect, inject, input, signal } from '@angular/core';
import { IonThumbnail } from '@ionic/angular';
import { ImageService } from '../core/media/image.service';

@Component({
  selector: 'app-product-thumb',
  template: `
    <ion-thumbnail slot="start" class="product-thumb">
      <img [src]="displayUrl()" (error)="onError()" alt="" />
    </ion-thumbnail>
  `,
  styles: [
    `
      .product-thumb {
        --size: 52px;
        --border-radius: 10px;
        margin-inline-end: 12px;
      }
      img {
        object-fit: cover;
        width: 100%;
        height: 100%;
        border-radius: 10px;
        background: var(--ion-color-light);
      }
    `,
  ],
  imports: [IonThumbnail],
})
export class ProductThumbComponent {
  private images = inject(ImageService);

  imagePath = input<string | null>(null);

  displayUrl = signal('');

  constructor() {
    effect(() => {
      const path = this.imagePath();
      void this.refresh(path);
    });
  }

  onError(): void {
    this.displayUrl.set(this.images.productPlaceholder);
  }

  private async refresh(path: string | null): Promise<void> {
    this.displayUrl.set(await this.images.toDisplayUrl(path, 'products'));
  }
}
