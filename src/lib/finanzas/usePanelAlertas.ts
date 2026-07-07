/**
 * usePanelAlertas — hook autocontenido de checks financieros.
 * Dispara una alerta SOLO cuando un ratio se rompe respecto a su umbral.
 * Si todo está sano, `alertas` viene vacío y la UI debe mostrarlo explícitamente.
 *
 * Módulo autónomo: consulta Supabase directamente, sin depender de otros
 * hooks del ERP (Panel de Alertas / Finanzas).
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fmtEur, fmtPct, fmtDate } from '@/lib/format';

export type Severidad = 'roja' | 'ambar';

export interface Alerta {
  id: string;
  severidad: Severidad;
  titulo: string;
  detalle: string;
  valor?: string;
}

/** Forma interna de trabajo: añade un rango numérico solo para ordenar. */
type AlertaRankeada = Alerta & { _rank: number };

/* ── Umbrales documentados ────────────────────────────────────────── */
/** Caja: por debajo de este importe (y por encima de 0) → ámbar. Por debajo de 0 → roja. */
export const UMBRAL_CAJA_AMBAR = 3000;
/** Margen: diferencia en puntos porcentuales (objetivo − real) que separa ámbar de roja. */
export const UMBRAL_MARGEN_DIFERENCIA_ROJA = 10;
/** Gasto disparado: mes actual > promedio de los 3 meses anteriores × este factor → ámbar. */
export const UMBRAL_GASTO_DISPARADO = 1.3;
/** Gasto disparado: factor a partir del cual la alerta sube a roja. */
export const UMBRAL_GASTO_DISPARADO_ROJA = 1.6;
/** Cobro de plataforma: días desde fin de periodo sin fecha_pago → ámbar. */
export const UMBRAL_COBRO_AMBAR_DIAS = 30;
/** Cobro de plataforma: días desde fin de periodo sin fecha_pago → roja. */
export const UMBRAL_COBRO_ROJA_DIAS = 45;

/** Mapea el valor de `plataforma` (resumenes_plataforma_marca_mensual / ventas_plataforma)
 *  al nombre legible y al `canal` usado en config_canales. */
const PLATAFORMA_LABEL: Record<string, string> = {
  uber: 'Uber Eats',
  glovo: 'Glovo',
  just_eat: 'Just Eat',
  web: 'Web Propia',
  directa: 'Venta Directa',
};
const PLATAFORMA_A_CANAL: Record<string, string> = {
  uber: 'Uber Eats',
  glovo: 'Glovo',
  just_eat: 'Just Eat',
  web: 'Web Propia',
  directa: 'Venta Directa',
};

function diasDesde(fechaIso: string, hoy: Date): number {
  const f = new Date(fechaIso + 'T00:00:00');
  return Math.floor((hoy.getTime() - f.getTime()) / 86400000);
}

/* ── Check 1: caja bajo umbral ────────────────────────────────────── */
async function checkCajaBajoUmbral(): Promise<AlertaRankeada[]> {
  const { data, error } = await supabase
    .from('configuracion')
    .select('clave,valor')
    .eq('clave', 'saldo_banco_actual');
  if (error) throw new Error(`Caja: ${error.message}`);

  if (!data || data.length === 0) {
    // TODO fuente de datos: clave 'saldo_banco_actual' no existe aún en configuracion
    return [];
  }

  const saldo = Number(data[0].valor);
  if (!Number.isFinite(saldo)) return [];

  if (saldo < 0) {
    return [{
      id: 'caja-negativa',
      severidad: 'roja',
      titulo: 'Caja en números rojos',
      detalle: `El saldo de banco registrado es ${fmtEur(saldo, { decimals: 2 })}, por debajo de cero.`,
      valor: fmtEur(saldo, { decimals: 2 }),
      _rank: 1_000_000 + Math.abs(saldo),
    }];
  }
  if (saldo < UMBRAL_CAJA_AMBAR) {
    return [{
      id: 'caja-baja',
      severidad: 'ambar',
      titulo: 'Caja por debajo del colchón mínimo',
      detalle: `Saldo de banco de ${fmtEur(saldo, { decimals: 2 })}, por debajo del umbral de ${fmtEur(UMBRAL_CAJA_AMBAR, { decimals: 0 })}.`,
      valor: fmtEur(saldo, { decimals: 2 }),
      _rank: UMBRAL_CAJA_AMBAR - saldo,
    }];
  }
  return [];
}

/* ── Check 2: margen bajo objetivo ────────────────────────────────── */
async function checkMargenBajoObjetivo(): Promise<AlertaRankeada[]> {
  const anioActual = new Date().getFullYear();

  const { data: resumenes, error: errRes } = await supabase
    .from('resumenes_plataforma_marca_mensual')
    .select('plataforma,bruto,neto_real_cobrado,mes,año')
    .eq('año', anioActual)
    .order('mes', { ascending: false })
    .returns<{ plataforma: string; bruto: number | null; neto_real_cobrado: number | null; mes: number; año: number }[]>();
  if (errRes) throw new Error(`Margen: ${errRes.message}`);
  if (!resumenes || resumenes.length === 0) return [];

  // Mes más reciente con datos (primera fila tras ordenar desc).
  const mesReciente = resumenes[0].mes;
  const filasMes = resumenes.filter(r => r.mes === mesReciente);

  // Agrega por plataforma (hay varias filas por marca en el mismo mes/plataforma).
  const agregados = new Map<string, { bruto: number; neto: number }>();
  for (const fila of filasMes) {
    const acc = agregados.get(fila.plataforma) ?? { bruto: 0, neto: 0 };
    acc.bruto += Number(fila.bruto) || 0;
    acc.neto += Number(fila.neto_real_cobrado) || 0;
    agregados.set(fila.plataforma, acc);
  }

  const { data: canales, error: errCan } = await supabase
    .from('config_canales')
    .select('canal,margen_obj_pct')
    .eq('activo', true);
  if (errCan) throw new Error(`Margen: ${errCan.message}`);
  if (!canales || canales.length === 0) return [];

  // margen_obj_pct viene como fracción (0.15 = 15%).
  const objetivoPorCanal = new Map<string, number>();
  for (const c of canales) objetivoPorCanal.set(c.canal, Number(c.margen_obj_pct) * 100);

  const alertas: AlertaRankeada[] = [];
  for (const [plataforma, { bruto, neto }] of agregados) {
    if (bruto <= 0) continue;
    const nombreCanal = PLATAFORMA_A_CANAL[plataforma];
    if (!nombreCanal) continue; // TODO fuente de datos: plataforma sin mapeo a config_canales
    const objetivo = objetivoPorCanal.get(nombreCanal);
    if (objetivo === undefined) continue;

    const margenReal = (neto / bruto) * 100;
    const diferencia = objetivo - margenReal;
    if (diferencia <= 0) continue; // margen igual o por encima del objetivo: sano

    const severidad: Severidad = diferencia > UMBRAL_MARGEN_DIFERENCIA_ROJA ? 'roja' : 'ambar';
    alertas.push({
      id: `margen-${plataforma}-${anioActual}-${mesReciente}`,
      severidad,
      titulo: `Margen bajo objetivo en ${PLATAFORMA_LABEL[plataforma] ?? plataforma}`,
      detalle: `Margen real de ${fmtPct(margenReal, 1)} frente a un objetivo de ${fmtPct(objetivo, 1)} en el mes ${mesReciente}/${anioActual} (${fmtEur(neto, { decimals: 2 })} netos sobre ${fmtEur(bruto, { decimals: 2 })} brutos). Diferencia de ${fmtPct(diferencia, 1)}.`,
      valor: fmtPct(margenReal, 1),
      _rank: diferencia,
    });
  }
  return alertas;
}

/* ── Check 3: gasto disparado ──────────────────────────────────────── */
async function checkGastoDisparado(): Promise<AlertaRankeada[]> {
  const hoy = new Date();
  const mesActualStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const inicioRango = new Date(hoy.getFullYear(), hoy.getMonth() - 3, 1);
  const fechaDesde = `${inicioRango.getFullYear()}-${String(inicioRango.getMonth() + 1).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('conciliacion')
    .select('fecha,importe,categoria,tipo')
    .eq('tipo', 'gasto')
    .gte('fecha', fechaDesde);
  if (error) throw new Error(`Gasto: ${error.message}`);
  if (!data || data.length === 0) return [];

  // Agrupa importes (valor absoluto) por categoría y por mes (YYYY-MM derivado de fecha).
  const porCategoriaMes = new Map<string, Map<string, number>>();
  for (const fila of data) {
    if (!fila.categoria || !fila.fecha) continue;
    const mes = String(fila.fecha).slice(0, 7);
    let porMes = porCategoriaMes.get(fila.categoria);
    if (!porMes) { porMes = new Map(); porCategoriaMes.set(fila.categoria, porMes); }
    porMes.set(mes, (porMes.get(mes) ?? 0) + Math.abs(Number(fila.importe) || 0));
  }

  const mesesAnteriores = [1, 2, 3].map(offset => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const alertas: AlertaRankeada[] = [];
  for (const [categoria, porMes] of porCategoriaMes) {
    const actual = porMes.get(mesActualStr);
    if (!actual) continue;

    const promedio = mesesAnteriores.reduce((sum, m) => sum + (porMes.get(m) ?? 0), 0) / mesesAnteriores.length;
    if (promedio <= 0) continue; // sin histórico previo: nada que comparar

    const ratio = actual / promedio;
    if (ratio <= UMBRAL_GASTO_DISPARADO) continue;

    const severidad: Severidad = ratio > UMBRAL_GASTO_DISPARADO_ROJA ? 'roja' : 'ambar';
    alertas.push({
      id: `gasto-${categoria}-${mesActualStr}`,
      severidad,
      titulo: `Gasto disparado en categoría ${categoria}`,
      detalle: `Gasto de ${fmtEur(actual, { decimals: 2 })} este mes frente a un promedio de ${fmtEur(promedio, { decimals: 2 })} en los 3 meses anteriores (×${ratio.toFixed(2)}).`,
      valor: fmtEur(actual, { decimals: 2 }),
      _rank: ratio,
    });
  }
  return alertas;
}

/* ── Check 4: cobro de plataforma retrasado ──────────────────────────── */
async function checkCobroRetrasado(): Promise<AlertaRankeada[]> {
  const { data, error } = await supabase
    .from('ventas_plataforma')
    .select('plataforma,marca,neto,fecha_fin_periodo,fecha_pago')
    .is('fecha_pago', null);
  if (error) throw new Error(`Cobro: ${error.message}`);
  if (!data || data.length === 0) return [];

  const hoy = new Date();
  const alertas: AlertaRankeada[] = [];
  for (const fila of data) {
    if (!fila.fecha_fin_periodo) continue;
    const dias = diasDesde(fila.fecha_fin_periodo, hoy);
    if (dias <= UMBRAL_COBRO_AMBAR_DIAS) continue;

    const severidad: Severidad = dias > UMBRAL_COBRO_ROJA_DIAS ? 'roja' : 'ambar';
    const label = PLATAFORMA_LABEL[fila.plataforma] ?? fila.plataforma;
    alertas.push({
      id: `cobro-${fila.plataforma}-${fila.marca ?? 's-marca'}-${fila.fecha_fin_periodo}`,
      severidad,
      titulo: `Cobro pendiente de ${label}${fila.marca ? ` (${fila.marca})` : ''}`,
      detalle: `Periodo cerrado el ${fmtDate(fila.fecha_fin_periodo)} sin fecha de pago registrada: ${dias} días de retraso. Importe neto pendiente: ${fmtEur(Number(fila.neto) || 0, { decimals: 2 })}.`,
      valor: fmtEur(Number(fila.neto) || 0, { decimals: 2 }),
      _rank: dias,
    });
  }
  return alertas;
}

/* ── Orden: rojas primero, luego ámbar; dentro de cada grupo, por magnitud de desviación ── */
function ordenar(alertas: AlertaRankeada[]): Alerta[] {
  const rojas = alertas.filter(a => a.severidad === 'roja').sort((a, b) => b._rank - a._rank);
  const ambar = alertas.filter(a => a.severidad === 'ambar').sort((a, b) => b._rank - a._rank);
  return [...rojas, ...ambar].map(({ _rank: _omit, ...resto }) => resto);
}

export function usePanelAlertas() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resultados = await Promise.all([
        checkCajaBajoUmbral(),
        checkMargenBajoObjetivo(),
        checkGastoDisparado(),
        checkCobroRetrasado(),
      ]);
      setAlertas(ordenar(resultados.flat()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar las alertas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const rojas = alertas.filter(a => a.severidad === 'roja');
  const ambar = alertas.filter(a => a.severidad === 'ambar');
  const masUrgente = rojas[0]?.titulo ?? ambar[0]?.titulo ?? null;

  return { alertas, rojas, ambar, masUrgente, loading, error, recargar: cargar };
}
