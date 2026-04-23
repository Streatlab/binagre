export function fmtEur(n: number | null | undefined, opts?: { signed?: boolean; decimals?: 0 | 2 }): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '—';
  const num = Number(n);
  const decimals = opts?.decimals ?? 0;
  const abs = Math.abs(num);
  const parts = abs.toFixed(decimals).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const formatted = parts.join(',');
  const prefix = opts?.signed && num > 0 ? '+' : num < 0 ? '−' : '';
  return `${prefix}${formatted} €`;
}

export function fmtPct(n: number | null | undefined, decimals: 0 | 1 = 0): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '—';
  return `${Number(n).toFixed(decimals).replace('.', ',')}%`;
}

export function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = date.getFullYear();
  return `${dd}/${mm}/${yy}`;
}
