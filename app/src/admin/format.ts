// Zahlen und Daten für den Admin-Bereich, immer Berliner Zeit.

const TZ = 'Europe/Berlin';

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '–';
  try { return new Intl.DateTimeFormat('de-DE', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso)); }
  catch { return String(iso); }
}
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '–';
  try { return new Intl.DateTimeFormat('de-DE', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); }
  catch { return String(iso); }
}
export function fmtEur(cents: number | null | undefined): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);
}
export function fmtInt(n: number | null | undefined): string {
  return new Intl.NumberFormat('de-DE').format(n || 0);
}
export function fmtBytes(n: number | null | undefined): string {
  const v = Number(n || 0);
  if (v < 1024) return `${v} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let x = v / 1024;
  let i = 0;
  while (x >= 1024 && i < units.length - 1) { x /= 1024; i++; }
  return `${x.toLocaleString('de-DE', { maximumFractionDigits: 1 })} ${units[i]}`;
}
export function relDays(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return 'heute';
  if (d === 1) return 'gestern';
  return `vor ${d} Tagen`;
}
