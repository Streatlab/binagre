export function fmtNum(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtMes(mes: number): string {
  return ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][mes - 1] ?? '';
}

export function fmtEur(n: number | null | undefined, opts?: { signed?: boolean; decimals?: number; showEuro?: boolean }): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '—';
  const num = Number(n);
  const decimals = opts?.decimals ?? 0;
  const showEuro = opts?.showEuro !== false; // default true para compatibilidad
  const abs = Math.abs(num);
  const parts = abs.toFixed(decimals).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const formatted = parts.join(',');
  const prefix = opts?.signed && num > 0 ? '+' : num < 0 ? '−' : '';
  return showEuro ? `${prefix}${formatted} €` : `${prefix}${formatted}`;
}

export function fmtPct(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '—';
  return `${fmtNum(Number(n), decimals)}%`;
}

export function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = date.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

/** Formato canónico Panel: dd/mm/yy (sin año completo) */
export function formatearFechaCorta(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d + 'T12:00:00') : d;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(2);
  return `${dd}/${mm}/${yy}`;
}

/** Semana en formato Panel: S18_27_04_26 */
export function fmtSemana(numSemana: number, lunes: Date): string {
  const dd = String(lunes.getDate()).padStart(2, '0');
  const mm = String(lunes.getMonth() + 1).padStart(2, '0');
  const yy = String(lunes.getFullYear()).slice(-2);
  return `S${numSemana}_${dd}_${mm}_${yy}`;
}

/** Color semáforo para % cumplimiento */
export function colorSemaforo(pct: number): string {
  if (pct >= 50) return '#1D9E75'; // verde
  if (pct >= 1)  return '#f5a623'; // amarillo
  return '#E24B4A';                // rojo
}
