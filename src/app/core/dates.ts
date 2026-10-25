import { ReportPeriod } from './models';

const pad = (value: number): string => String(value).padStart(2, '0');

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function formatDisplayDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return parseIsoDate(value).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function periodRange(period: ReportPeriod, reference = todayIso()): { from: string; to: string } {
  const date = parseIsoDate(reference);
  if (period === 'day') {
    return { from: reference, to: reference };
  }
  if (period === 'week') {
    const weekday = (date.getDay() + 6) % 7;
    const start = new Date(date);
    start.setDate(date.getDate() - weekday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: toIsoDate(start), to: toIsoDate(end) };
  }
  if (period === 'month') {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { from: toIsoDate(start), to: toIsoDate(end) };
  }
  const start = new Date(date.getFullYear(), 0, 1);
  const end = new Date(date.getFullYear(), 11, 31);
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

export function shiftPeriod(period: ReportPeriod, reference: string, direction: -1 | 1): string {
  const date = parseIsoDate(reference);
  if (period === 'day') {
    date.setDate(date.getDate() + direction);
  } else if (period === 'week') {
    date.setDate(date.getDate() + 7 * direction);
  } else if (period === 'month') {
    date.setMonth(date.getMonth() + direction);
  } else {
    date.setFullYear(date.getFullYear() + direction);
  }
  return toIsoDate(date);
}

export function periodCaption(period: ReportPeriod, from: string, to: string): string {
  if (period === 'day') {
    return formatDisplayDate(from);
  }
  if (period === 'week') {
    return `${formatDisplayDate(from)} – ${formatDisplayDate(to)}`;
  }
  if (period === 'month') {
    return parseIsoDate(from).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  }
  return String(parseIsoDate(from).getFullYear());
}
