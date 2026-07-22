import { GRANATE, LIMA, VERDE } from '@/styles/neobrutal'
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

// Importe de una factura de proveedor: 0 en BD (columna NOT NULL) significa
// "el OCR no pudo leer el total", nunca un importe real (ninguna vía de lectura
// escribe 0 salvo la lectura manual sin resolver). Nunca mostrar "0,00 €" como
// si fuera un dato real: se avisa y se marca para relectura en vez de fingir.
export function fmtEurFactura(total: number | null | undefined): string {
  if (total === null || total === undefined || total === 0) return 'sin importe leído';
  return fmtEur(total, { decimals: 2 });
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
  if (pct <= 0) return GRANATE;   // rojo
  if (pct > 50) return VERDE;   // verde
  return LIMA;                 // ámbar
}
