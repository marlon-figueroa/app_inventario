import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  BarcodeFormat,
  BarcodeScanner,
} from '@capacitor-mlkit/barcode-scanning';

@Injectable({ providedIn: 'root' })
export class BarcodeScanService {
  async scanOnce(): Promise<string | null> {
    if (Capacitor.getPlatform() !== 'android') {
      return null;
    }
    const { camera } = await BarcodeScanner.requestPermissions();
    if (camera !== 'granted' && camera !== 'limited') {
      throw new Error('Se necesita permiso de cámara para escanear.');
    }
    const { barcodes } = await BarcodeScanner.scan({
      formats: [BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.Code128],
    });
    const value = barcodes[0]?.rawValue?.trim();
    return value || null;
  }
}
