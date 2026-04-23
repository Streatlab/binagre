export type Categoria = 'PRODUCTO'|'RRHH'|'ALQUILER'|'MARKETING'|'SUMINISTROS'|'INTERNET_VENTAS'|'ADMIN_GENERALES';

export const CATEGORIAS_ORDEN: Categoria[] = ['PRODUCTO','RRHH','ALQUILER','MARKETING','INTERNET_VENTAS','ADMIN_GENERALES','SUMINISTROS'];

export const CATEGORIA_NOMBRE: Record<Categoria, string> = {
  PRODUCTO: 'Producto',
  RRHH: 'Recursos Humanos',
  ALQUILER: 'Alquiler',
  MARKETING: 'Marketing',
  INTERNET_VENTAS: 'Internet y ventas',
  ADMIN_GENERALES: 'Administración/Generales',
  SUMINISTROS: 'Suministros',
};

export const CATEGORIA_COLOR: Record<Categoria, string> = {
  PRODUCTO: 'var(--rf-orange)',
  RRHH: 'var(--rf-red)',
  ALQUILER: '#8b5a9f',
  MARKETING: '#e8a4a0',
  INTERNET_VENTAS: 'var(--rf-ch-directa)',
  ADMIN_GENERALES: 'var(--rf-text-2)',
  SUMINISTROS: '#4a90d9',
};

export const GASTOS_FIJOS: Categoria[] = ['RRHH','ALQUILER','MARKETING','INTERNET_VENTAS','ADMIN_GENERALES','SUMINISTROS'];
export const GASTOS_VARIABLES: Categoria[] = ['PRODUCTO'];

export const MESES_CORTO = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
export const MESES_LARGO = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

export interface PeriodoRango { desde: Date; hasta: Date; label: string; key: string; }

export function periodoMesActual(ref = new Date()): PeriodoRango {
  const y = ref.getFullYear(), m = ref.getMonth();
  return {
    desde: new Date(y, m, 1),
    hasta: new Date(y, m+1, 0),
    label: `${MESES_LARGO[m]} ${y}`,
    key: 'mes_actual',
  };
}

export function periodoUltimoMes(ref = new Date()): PeriodoRango {
  const y = ref.getFullYear(), m = ref.getMonth();
  const desde = new Date(y, m-1, 1);
  const hasta = new Date(y, m, 0);
  return { desde, hasta, label: `${MESES_LARGO[desde.getMonth()]} ${desde.getFullYear()}`, key: 'ultimo_mes' };
}

export function periodoUltimos(dias: number, ref = new Date()): PeriodoRango {
  const hasta = new Date(ref);
  const desde = new Date(ref);
  desde.setDate(desde.getDate() - dias + 1);
  return { desde, hasta, label: `Últimos ${dias} días`, key: `ult_${dias}d` };
}

export function periodoAnio(anio: number): PeriodoRango {
  return { desde: new Date(anio,0,1), hasta: new Date(anio,11,31), label: `Año ${anio}`, key: `anio_${anio}` };
}

export function periodoAnterior(p: PeriodoRango): PeriodoRango {
  const ms = p.hasta.getTime() - p.desde.getTime();
  const hasta = new Date(p.desde);
  hasta.setDate(hasta.getDate() - 1);
  const desde = new Date(hasta.getTime() - ms);
  return { desde, hasta, label: 'Periodo anterior', key: 'prev' };
}

export function fechaISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

export function statusRango(pctReal: number, _min: number, max: number): 'ok'|'warn'|'bad' {
  if (pctReal > max) return 'bad';
  if (pctReal > max * 0.9) return 'warn';
  return 'ok';
}

export function deltaPct(actual: number, anterior: number): { sign:'up'|'down'|'neutral'; value: number } {
  if (!anterior && !actual) return { sign:'neutral', value: 0 };
  if (!anterior) return { sign:'up', value: 100 };
  const d = ((actual - anterior) / Math.abs(anterior)) * 100;
  if (Math.abs(d) < 0.5) return { sign:'neutral', value: 0 };
  return { sign: d>0 ? 'up' : 'down', value: Math.round(Math.abs(d)) };
}
