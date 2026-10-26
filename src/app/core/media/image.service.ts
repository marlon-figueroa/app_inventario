import { Injectable } from '@angular/core';
import { Camera } from '@capacitor/camera';
import type { MediaResult } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

export type ImageEntityKind = 'products' | 'brands';

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.8;

let pwaElementsReady: Promise<void> | null = null;

function ensurePwaElements(): Promise<void> {
  if (Capacitor.getPlatform() !== 'web') {
    return Promise.resolve();
  }
  if (!pwaElementsReady) {
    pwaElementsReady = import('@ionic/pwa-elements/loader').then(({ defineCustomElements }) =>
      defineCustomElements(window)
    );
  }
  return pwaElementsReady;
}

@Injectable({ providedIn: 'root' })
export class ImageService {
  readonly productPlaceholder = 'assets/img/placeholder-product.svg';
  readonly brandPlaceholder = 'assets/img/placeholder-brand.svg';

  placeholderFor(kind: ImageEntityKind): string {
    return kind === 'products' ? this.productPlaceholder : this.brandPlaceholder;
  }

  async pick(source: 'camera' | 'gallery', kind: ImageEntityKind, entityId: string): Promise<string> {
    await ensurePwaElements();
    await this.ensureMediaPermissions(source);

    const platform = Capacitor.getPlatform();
    let base64: string;

    try {
      if (platform === 'web' && source === 'gallery') {
        return this.pickFromFileInput(kind, entityId);
      }

      if (platform === 'web') {
        const shot = await Camera.takePhoto({
          quality: Math.round(JPEG_QUALITY * 100),
          targetWidth: MAX_DIMENSION,
          targetHeight: MAX_DIMENSION,
          correctOrientation: true,
          webUseInput: true,
        });
        base64 = await this.mediaResultToBase64(shot);
      } else if (source === 'camera') {
        const shot = await Camera.takePhoto({
          quality: Math.round(JPEG_QUALITY * 100),
          targetWidth: MAX_DIMENSION,
          targetHeight: MAX_DIMENSION,
          correctOrientation: true,
        });
        base64 = await this.mediaResultToBase64(shot);
      } else {
        const gallery = await Camera.chooseFromGallery({
          allowMultipleSelection: false,
          targetWidth: MAX_DIMENSION,
          targetHeight: MAX_DIMENSION,
          correctOrientation: true,
        });
        const selected = gallery.results[0];
        if (!selected) {
          throw new Error('USER_CANCELLED');
        }
        base64 = await this.mediaResultToBase64(selected);
      }
    } catch (error) {
      if (this.isUserCancel(error)) {
        throw new Error('USER_CANCELLED');
      }
      if (platform === 'web' && source === 'camera') {
        return this.pickFromFileInput(kind, entityId);
      }
      throw this.wrapError(error, 'No se pudo abrir la cámara o la galería.');
    }
    const folder = `images/${kind}`;
    await this.ensureDir(folder);
    const path = `${folder}/${entityId}-${Date.now()}.jpg`;
    await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Data,
    });
    return path;
  }

  async remove(path: string | null | undefined): Promise<void> {
    if (!path?.trim()) {
      return;
    }
    try {
      await Filesystem.deleteFile({ path, directory: Directory.Data });
    } catch {
      // archivo ya ausente
    }
  }

  async toDisplayUrl(path: string | null | undefined, kind: ImageEntityKind): Promise<string> {
    if (!path?.trim()) {
      return this.placeholderFor(kind);
    }
    if (Capacitor.getPlatform() === 'web') {
      try {
        const file = await Filesystem.readFile({ path, directory: Directory.Data });
        const data = typeof file.data === 'string' ? file.data : '';
        return data.startsWith('data:') ? data : `data:image/jpeg;base64,${data}`;
      } catch {
        return this.placeholderFor(kind);
      }
    }
    try {
      const { uri } = await Filesystem.getUri({ path, directory: Directory.Data });
      return Capacitor.convertFileSrc(uri);
    } catch {
      return this.placeholderFor(kind);
    }
  }

  async readAsBase64(path: string): Promise<string> {
    const file = await Filesystem.readFile({ path, directory: Directory.Data });
    return typeof file.data === 'string' ? file.data : '';
  }

  async writeFromBase64(path: string, base64: string): Promise<void> {
    const parts = path.split('/');
    parts.pop();
    const folder = parts.join('/');
    if (folder) {
      await this.ensureDir(folder);
    }
    await Filesystem.writeFile({ path, data: base64, directory: Directory.Data });
  }

  async listEntityImages(kind: ImageEntityKind): Promise<string[]> {
    const folder = `images/${kind}`;
    try {
      const result = await Filesystem.readdir({ path: folder, directory: Directory.Data });
      return result.files.map((f) => `${folder}/${f.name}`);
    } catch {
      return [];
    }
  }

  private async ensureMediaPermissions(source: 'camera' | 'gallery'): Promise<void> {
    if (Capacitor.getPlatform() === 'web') {
      return;
    }
    const current = await Camera.checkPermissions();
    if (source === 'camera') {
      if (current.camera === 'granted') {
        return;
      }
      const requested = await Camera.requestPermissions({ permissions: ['camera'] });
      if (requested.camera !== 'granted') {
        throw new Error('Activa el permiso de cámara en Ajustes del teléfono.');
      }
      return;
    }
    if (current.photos === 'granted' || current.photos === 'limited') {
      return;
    }
    const requested = await Camera.requestPermissions({ permissions: ['photos'] });
    if (requested.photos !== 'granted' && requested.photos !== 'limited') {
      throw new Error('Activa el permiso de fotos o galería en Ajustes del teléfono.');
    }
  }

  private async ensureDir(folder: string): Promise<void> {
    try {
      await Filesystem.mkdir({
        path: folder,
        directory: Directory.Data,
        recursive: true,
      });
    } catch {
      // ya existe
    }
  }

  private async mediaResultToBase64(media: MediaResult): Promise<string> {
    const platform = Capacitor.getPlatform();

    if (platform !== 'web' && media.uri?.trim()) {
      try {
        const file = await Filesystem.readFile({ path: media.uri.trim() });
        if (typeof file.data === 'string' && file.data.length > 0) {
          return file.data.startsWith('data:') ? this.dataUrlToBase64(file.data) : file.data;
        }
      } catch {
        // continuar con webPath / miniatura
      }
    }

    if (platform === 'web' && media.thumbnail?.trim()) {
      const thumb = media.thumbnail.trim();
      return thumb.startsWith('data:') ? this.dataUrlToBase64(thumb) : thumb;
    }

    const path = media.webPath ?? media.uri;
    if (!path) {
      if (media.thumbnail?.trim()) {
        const thumb = media.thumbnail.trim();
        return thumb.startsWith('data:') ? this.dataUrlToBase64(thumb) : thumb;
      }
      throw new Error('No se pudo obtener la imagen.');
    }

    const url =
      path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:')
        ? path
        : Capacitor.convertFileSrc(path);
    const response = await fetch(url);
    if (!response.ok) {
      if (media.thumbnail?.trim()) {
        const thumb = media.thumbnail.trim();
        return thumb.startsWith('data:') ? this.dataUrlToBase64(thumb) : thumb;
      }
      throw new Error('No se pudo leer la imagen capturada.');
    }
    const blob = await response.blob();
    return this.blobToBase64(blob);
  }

  private pickFromFileInput(kind: ImageEntityKind, entityId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp,image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error('USER_CANCELLED'));
          return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const dataUrl = String(reader.result ?? '');
            const base64 = this.dataUrlToBase64(dataUrl);
            const folder = `images/${kind}`;
            await this.ensureDir(folder);
            const path = `${folder}/${entityId}-${Date.now()}.jpg`;
            await Filesystem.writeFile({
              path,
              data: base64,
              directory: Directory.Data,
            });
            resolve(path);
          } catch (error) {
            reject(this.wrapError(error, 'No se pudo guardar la imagen.'));
          }
        };
        reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        reader.readAsDataURL(file);
      };
      input.oncancel = () => reject(new Error('USER_CANCELLED'));
      input.click();
    });
  }

  private dataUrlToBase64(dataUrl: string): string {
    const comma = dataUrl.indexOf(',');
    return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result ?? '');
        resolve(this.dataUrlToBase64(dataUrl));
      };
      reader.onerror = () => reject(new Error('No se pudo procesar la imagen.'));
      reader.readAsDataURL(blob);
    });
  }

  private isUserCancel(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes('User cancelled') ||
      message.includes('canceled') ||
      message.includes('cancelled') ||
      message === 'USER_CANCELLED'
    );
  }

  private wrapError(error: unknown, fallback: string): Error {
    if (this.isUserCancel(error)) {
      return new Error('USER_CANCELLED');
    }
    if (error instanceof Error && error.message) {
      return error;
    }
    return new Error(fallback);
  }
}
