import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

export type ImageEntityKind = 'products' | 'brands';

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.8;

@Injectable({ providedIn: 'root' })
export class ImageService {
  readonly productPlaceholder = 'assets/img/placeholder-product.svg';
  readonly brandPlaceholder = 'assets/img/placeholder-brand.svg';

  placeholderFor(kind: ImageEntityKind): string {
    return kind === 'products' ? this.productPlaceholder : this.brandPlaceholder;
  }

  async pick(source: 'camera' | 'gallery', kind: ImageEntityKind, entityId: string): Promise<string> {
    const photo = await Camera.getPhoto({
      quality: Math.round(JPEG_QUALITY * 100),
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
    });
    if (!photo.dataUrl) {
      throw new Error('No se pudo obtener la imagen.');
    }
    const base64 = this.dataUrlToBase64(photo.dataUrl);
    const path = `images/${kind}/${entityId}-${Date.now()}.jpg`;
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
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Data });
    return Capacitor.convertFileSrc(uri);
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
      try {
        await Filesystem.mkdir({ path: folder, directory: Directory.Data, recursive: true });
      } catch {
        // ya existe
      }
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

  private dataUrlToBase64(dataUrl: string): string {
    const comma = dataUrl.indexOf(',');
    return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  }
}
