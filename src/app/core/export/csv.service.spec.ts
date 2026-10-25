import { describe, expect, it } from 'vitest';
import { CsvService } from './csv.service';

describe('CsvService', () => {
  const csv = new CsvService();

  it('escapa comillas y comas', () => {
    expect(csv.escapeCell('Hola, "mundo"')).toBe('"Hola, ""mundo"""');
  });

  it('incluye BOM UTF-8', () => {
    const content = csv.toCsv(['A'], [['1']]);
    expect(content.startsWith('\uFEFF')).toBe(true);
  });
});
