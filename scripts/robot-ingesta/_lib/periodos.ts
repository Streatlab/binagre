/**
 * Cálculo de periodos cerrados (quincena, mes, semana) en hora Madrid, para la
 * lógica de insistencia de facturas (plan-v2 T6): un robot solo reintenta el
 * periodo que YA cerró, no el que está en curso.
 */
import { hoyMadrid } from './bandeja.js';

function ultimoDiaMes(anio: number, mes1a12: number): number {
  return new Date(Date.UTC(anio, mes1a12, 0)).getUTCDate();
}
function pad(n: number): string { return String(n).padStart(2, '0'); }

/**
 * Quincena cerrada más reciente. Día 1-15 del mes → la quincena disponible es
 * el 16-fin del mes ANTERIOR. Día 16-fin → la quincena disponible es el 1-15
 * de ESTE mes.
 */
export function quincenaCerrada(): { periodo: string; from: string; to: string } {
  const [y, m, d] = hoyMadrid().split('-').map(Number);
  if (d >= 16) {
    return { periodo: `${y}-${pad(m)}-Q1`, from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-15` };
  }
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return { periodo: `${py}-${pad(pm)}-Q2`, from: `${py}-${pad(pm)}-16`, to: `${py}-${pad(pm)}-${pad(ultimoDiaMes(py, pm))}` };
}

/** Mes cerrado más reciente (el mes natural anterior al actual). */
export function mesCerrado(): { periodo: string; from: string; to: string } {
  const [y, m] = hoyMadrid().split('-').map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return { periodo: `${py}-${pad(pm)}`, from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(ultimoDiaMes(py, pm))}` };
}

/** Semana cerrada más reciente (lunes-domingo anterior al lunes de esta semana), en hora Madrid. */
export function semanaCerrada(): { periodo: string; from: string; to: string } {
  const [y, m, d] = hoyMadrid().split('-').map(Number);
  const hoy = new Date(Date.UTC(y, m - 1, d));
  const diaSemana = hoy.getUTCDay() || 7; // 1=lunes...7=domingo
  const lunesEstaSemana = new Date(hoy); lunesEstaSemana.setUTCDate(hoy.getUTCDate() - (diaSemana - 1));
  const domingoAnterior = new Date(lunesEstaSemana); domingoAnterior.setUTCDate(lunesEstaSemana.getUTCDate() - 1);
  const lunesAnterior = new Date(domingoAnterior); lunesAnterior.setUTCDate(domingoAnterior.getUTCDate() - 6);
  const iso = (dt: Date) => `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  // Identificador de semana ISO simple: año-mes-día del lunes.
  return { periodo: `sem-${iso(lunesAnterior)}`, from: iso(lunesAnterior), to: iso(domingoAnterior) };
}

/** Día de la semana en Madrid: 1=lunes ... 7=domingo. */
export function diaSemanaMadrid(): number {
  const [y, m, d] = hoyMadrid().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

/** Día del mes en Madrid (1-31). */
export function diaMesMadrid(): number {
  return Number(hoyMadrid().split('-')[2]);
}
