export function fmtNum(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  });
}

export function fmtMes(mes: number): string {
  return ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][mes - 1] ?? '';
}

export function fmtEur(n: number | null | undefined, opts?: { signed?: boolean; decimals?: number; showEuro?: boolean }): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '—';
  const num = Number(n);
  const decimals = opts?.decimals ?? 0;
  const showEuro = opts?.showEuro !== false;
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  });
  const prefix = opts?.signed && num > 0 ? '+' : num < 0 ? '−' : '';
  return showEuro ? `${prefix}${formatted} €` : `${prefix}${formatted}`;
}

export function fmtPct(n: number | null | undefined, decimals = 2): string {
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

export function formatearFechaCorta(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d + 'T12:00:00') : d;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(2);
  return `${dd}/${mm}/${yy}`;
}

export function fmtSemana(numSemana: number, lunes: Date): string {
  const dd = String(lunes.getDate()).padStart(2, '0');
  const mm = String(lunes.getMonth() + 1).padStart(2, '0');
  const yy = String(lunes.getFullYear()).slice(-2);
  return `S${numSemana}_${dd}_${mm}_${yy}`;
}

// Reglas del semáforo según Rubén:
//  - 0%       → rojo
//  - 0.01-50% → ámbar
//  - >50%     → verde (50.01% ya pasa la mitad)
export function colorSemaforo(pct: number): string {
  if (pct <= 0) return '#B01D23';   // rojo
  if (pct > 50) return '#1D9E75';   // verde
  return '#e8f442';                 // ámbar
}
