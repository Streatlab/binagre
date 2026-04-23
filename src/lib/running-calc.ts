export type CategoriaGasto =
  | 'PRODUCTO'
  | 'RRHH'
  | 'ALQUILER'
  | 'MARKETING'
  | 'SUMINISTROS'
  | 'INTERNET_VENTAS'
  | 'ADMIN_GENERALES';

export const CATEGORIAS_ORDEN: CategoriaGasto[] = [
  'PRODUCTO',
  'RRHH',
  'ALQUILER',
  'MARKETING',
  'SUMINISTROS',
  'INTERNET_VENTAS',
  'ADMIN_GENERALES',
];

export const NOMBRES_CATEGORIA: Record<CategoriaGasto, string> = {
  PRODUCTO: 'Producto',
  RRHH: 'RRHH',
  ALQUILER: 'Alquiler',
  MARKETING: 'Marketing',
  SUMINISTROS: 'Suministros',
  INTERNET_VENTAS: 'Internet y ventas',
  ADMIN_GENERALES: 'Admin/Generales',
};

export const TOKEN_CATEGORIA: Record<CategoriaGasto, string> = {
  PRODUCTO: 'var(--rf-gasto-producto)',
  RRHH: 'var(--rf-gasto-rrhh)',
  ALQUILER: 'var(--rf-gasto-alquiler)',
  MARKETING: 'var(--rf-gasto-mkt)',
  SUMINISTROS: 'var(--rf-gasto-sumin)',
  INTERNET_VENTAS: 'var(--rf-gasto-sumin)',
  ADMIN_GENERALES: 'var(--rf-text-secondary)',
};

export const MESES_CORTO = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
export const MESES_LARGO = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

export const diasEnMes = (anio: number, mes1a12: number): number =>
  new Date(anio, mes1a12, 0).getDate();

export function statusPresupuesto(gasto: number, tope: number): 'ok' | 'warn' | 'bad' {
  if (tope <= 0) return 'ok';
  const p = gasto / tope;
  if (p > 1) return 'bad';
  if (p >= 0.9) return 'warn';
  return 'ok';
}

export const pct = (part: number, total: number): number =>
  !total ? 0 : Math.round((part / total) * 100);

export interface Delta { sign: 'up' | 'down' | 'neutral'; valueAbs: number; }

export function deltaPct(actual: number, anterior: number): Delta {
  if (!anterior && !actual) return { sign: 'neutral', valueAbs: 0 };
  if (!anterior) return { sign: 'up', valueAbs: 100 };
  const d = ((actual - anterior) / Math.abs(anterior)) * 100;
  if (Math.abs(d) < 0.5) return { sign: 'neutral', valueAbs: 0 };
  return { sign: d > 0 ? 'up' : 'down', valueAbs: Math.abs(Math.round(d)) };
}

export function proyeccionMes(gastoActual: number, diaActual: number, diasMes: number): number {
  if (diaActual <= 0) return 0;
  return Math.round((gastoActual / diaActual) * diasMes);
}
