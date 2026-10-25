import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

@Injectable({ providedIn: 'root' })
export class CsvService {
  escapeCell(value: unknown): string {
    const text = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(text)) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  }

  toCsv(headers: string[], rows: unknown[][]): string {
    const lines = [
      headers.map((h) => this.escapeCell(h)).join(','),
      ...rows.map((row) => row.map((cell) => this.escapeCell(cell)).join(',')),
    ];
    return `\uFEFF${lines.join('\n')}`;
  }

  async downloadOrShare(filename: string, csv: string): Promise<string> {
    if (Capacitor.getPlatform() === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      return filename;
    }

    const result = await Filesystem.writeFile({
      path: filename,
      data: csv,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: filename,
      text: filename,
      url: result.uri,
      dialogTitle: 'Compartir CSV',
    });
    return filename;
  }
}
