/**
 * useRunningV2 — hook Running V2 (17 may 2026)
 *
 * Fuentes:
 * - gastos (vista → conciliacion WHERE 2.%)
 * - conciliacion WHERE 1.% (ingresos)
 * - facturacion_diario (desglose plataforma)
 * - categorias_rango (benchmarks)
 * - categorias_pyg (árbol)
 *
 * Cálculos: prime cost, break-even, proyección, ritmo, deltas, YTD, margen por marca
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fechaISO } from '@/lib/running';
import type { PeriodoRango } from '@/lib/running';

/* ── Tipos ── */

export interface GastoRow {
  fecha: string;
  grupo: string;
  subcategoria: string;
  proveedor: string | null;
  concepto: string | null;
  importe: number;
  base_imponible: number;
  marca: string | null;
  categoria_codigo: string;
  titular_id: string | null;
}

export interface IngresoConc {
  fecha: string;
  importe: number;
  categoria: string;
  titular_id: string | null;
}

export interface FactDiaria {
  fecha: string;
  marca_id: string | null;
  total_bruto: number;
  uber_bruto: number;
  glovo_bruto: number;
  je_bruto: number;
  web_bruto: number;
  directa_bruto: number;
  total_pedidos: number;
  uber_pedidos: number;
  glovo_pedidos: number;
  je_pedidos: number;
  web_pedidos: number;
  directa_pedidos: number;
}

export interface RangoCategoria {
  categoria: string;
  pct_min: number;
  pct_max: number;
  orden: number;
}

export interface CatPyG {
  id: string;
  nivel: number;
  parent_id: string | null;
  nombre: string;
}

/* ── Cálculos derivados ── */

export interface GastosPorGrupo {
  grupo: string;
  total: number;
  subcategorias: { nombre: string; total: number }[];
}

export interface IngresosPlataforma {
  canal: string;
  bruto: number;
  pedidos: number;
  neto: number;
}

export interface RunningV2Calc {
  ingresosNeto: number;
  ingresosBruto: number;
  totalGastos: number;
  resultado: number;
  primeCost: number;
  primeCostPct: number;
  breakEven: number;
  proyeccion: number;
  ritmo: { actual: number; esperado: number; pct: number };
  gastoProducto: number;
  gastoRRHH: number;
  gastoAlquiler: number;
  gastoControlables: number;
  deltaIngresos: number;
  deltaGastos: number;
  deltaResultado: number;
  ingresosPorPlataforma: IngresosPlataforma[];
  gastosPorGrupo: GastosPorGrupo[];
  ytdIngresos: number;
  ytdGastos: number;
  ytdResultado: number;
}

export interface RunningV2State {
  loading: boolean;
  error: string | null;
  gastos: GastoRow[];
  gastosAnt: GastoRow[];
  ingresos: IngresoConc[];
  ingresosAnt: IngresoConc[];
  facturacion: FactDiaria[];
  facturacionAnt: FactDiaria[];
  rangos: RangoCategoria[];
  cats: CatPyG[];
  gastosYTD: GastoRow[];
  ingresosYTD: IngresoConc[];
  facturacionYTD: FactDiaria[];
  calc: RunningV2Calc;
  calcAnt: RunningV2Calc | null;
  topProveedores: { proveedor: string; total: number }[];
  topCategorias: { categoria: string; total: number }[];
  reload: () => void;
}

/* ── Comisiones por canal ── */
const COMISIONES: Record<string, { pct: number; fijo: number }> = {
  uber: { pct: 0.30, fijo: 0.82 },
  glovo: { pct: 0.25, fijo: 0.75 },
  je: { pct: 0.20, fijo: 0.75 },
  web: { pct: 0.07, fijo: 0.50 },
  directa: { pct: 0, fijo: 0 },
};

function calcNetoLocal(bruto: number, pedidos: number, canal: string): number {
  const c = COMISIONES[canal] || { pct: 0, fijo: 0 };
  const comision = bruto * c.pct + pedidos * c.fijo;
  const iva = comision * 0.21;
  return Math.max(0, bruto - comision - iva);
}

/* ── Cálculos ── */

function buildCalc(
  gastos: GastoRow[],
  facturacion: FactDiaria[],
  _periodoDesde: Date,
  _periodoHasta: Date,
): RunningV2Calc {
  const canales = ['uber', 'glovo', 'je', 'web', 'directa'] as const;
  const canalLabels: Record<string, string> = {
    uber: 'Uber Eats', glovo: 'Glovo', je: 'Just Eat', web: 'Web', directa: 'Directa',
  };

  let ingresosBruto = 0;
  let ingresosNeto = 0;
  const porPlataforma: Record<string, { bruto: number; pedidos: number; neto: number }> = {};
  for (const c of canales) porPlataforma[c] = { bruto: 0, pedidos: 0, neto: 0 };

  for (const f of facturacion) {
    for (const c of canales) {
      const bruto = Number((f as any)[`${c}_bruto`] || 0);
      const peds = Number((f as any)[`${c}_pedidos`] || 0);
      if (!bruto) continue;
      const neto = calcNetoLocal(bruto, peds, c);
      porPlataforma[c].bruto += bruto;
      porPlataforma[c].pedidos += peds;
      porPlataforma[c].neto += neto;
      ingresosBruto += bruto;
      ingresosNeto += neto;
    }
  }

  const ingresosPorPlataforma: IngresosPlataforma[] = canales
    .map(c => ({ canal: canalLabels[c], bruto: porPlataforma[c].bruto, pedidos: porPlataforma[c].pedidos, neto: porPlataforma[c].neto }))
    .filter(x => x.bruto > 0);

  const grupoMap: Record<string, { total: number; subs: Record<string, number> }> = {};
  let totalGastos = 0;
  const GRUPO_BLOQUE: Record<string, string> = { 'Producto': '2.1', 'Equipo': '2.2', 'Alquiler': '2.3', 'Controlables': '2.4', 'Sin grupo': 'otros' };
  const GRUPO_TIPO: Record<string, 'producto' | 'rrhh' | 'alquiler' | 'controlables'> = { 'Producto': 'producto', 'Equipo': 'rrhh', 'Alquiler': 'alquiler', 'Controlables': 'controlables' };

  let gastoProducto = 0, gastoRRHH = 0, gastoAlquiler = 0, gastoControlables = 0;

  for (const g of gastos) {
    const imp = Math.abs(Number(g.base_imponible || g.importe || 0));
    totalGastos += imp;
    const grp = g.grupo || 'Sin grupo';
    if (!grupoMap[grp]) grupoMap[grp] = { total: 0, subs: {} };
    grupoMap[grp].total += imp;
    const sub = g.subcategoria || 'Otros';
    grupoMap[grp].subs[sub] = (grupoMap[grp].subs[sub] || 0) + imp;
    const tipo = GRUPO_TIPO[grp];
    if (tipo === 'producto') gastoProducto += imp;
    else if (tipo === 'rrhh') gastoRRHH += imp;
    else if (tipo === 'alquiler') gastoAlquiler += imp;
    else if (tipo === 'controlables') gastoControlables += imp;
  }

  const gastosPorGrupo: GastosPorGrupo[] = Object.entries(grupoMap)
    .map(([grupo, data]) => ({
      grupo, total: data.total,
      subcategorias: Object.entries(data.subs).map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => (GRUPO_BLOQUE[a.grupo] || 'z').localeCompare(GRUPO_BLOQUE[b.grupo] || 'z'));

  const resultado = ingresosNeto - totalGastos;
  const primeCost = gastoProducto + gastoRRHH;
  const primeCostPct = ingresosNeto > 0 ? (primeCost / ingresosNeto) * 100 : 0;
  const gastosFijos = gastoRRHH + gastoAlquiler + gastoControlables;
  const ratioVariables = ingresosNeto > 0 ? gastoProducto / ingresosNeto : 0;
  const breakEven = ratioVariables < 1 ? gastosFijos / (1 - ratioVariables) : 0;
  const hoy = new Date();
  const diaActual = hoy.getDate();
  const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const proyeccion = diaActual > 0 ? (ingresosNeto / diaActual) * diasMes : 0;
  const esperado = (ingresosNeto > 0 && diasMes > 0) ? (breakEven / diasMes) * diaActual : 0;

  return {
    ingresosNeto, ingresosBruto, totalGastos, resultado,
    primeCost, primeCostPct, breakEven, proyeccion,
    ritmo: { actual: ingresosNeto, esperado, pct: esperado > 0 ? (ingresosNeto / esperado) * 100 : 0 },
    gastoProducto, gastoRRHH, gastoAlquiler, gastoControlables,
    deltaIngresos: 0, deltaGastos: 0, deltaResultado: 0,
    ingresosPorPlataforma, gastosPorGrupo,
    ytdIngresos: 0, ytdGastos: 0, ytdResultado: 0,
  };
}

function calcDelta(actual: number, anterior: number): number {
  if (!anterior) return actual ? 100 : 0;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}

/* ── Hook ── */

export function useRunningV2(
  periodo: PeriodoRango,
  titularId: string | null,
  marcaId: string | null,
  modoIVA: 'sin' | 'con' = 'con',
): RunningV2State {
  const [state, setState] = useState<Omit<RunningV2State, 'reload'>>({
    loading: true, error: null,
    gastos: [], gastosAnt: [], ingresos: [], ingresosAnt: [],
    facturacion: [], facturacionAnt: [],
    rangos: [], cats: [],
    gastosYTD: [], ingresosYTD: [], facturacionYTD: [],
    calc: buildCalc([], [], new Date(), new Date()),
    calcAnt: null, topProveedores: [], topCategorias: [],
  });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setState(s => ({ ...s, loading: true, error: null }));
      try {
        const ms = periodo.hasta.getTime() - periodo.desde.getTime();
        const hastaAnt = new Date(periodo.desde); hastaAnt.setDate(hastaAnt.getDate() - 1);
        const desdeAnt = new Date(hastaAnt.getTime() - ms);
        const anio = periodo.desde.getFullYear();
        const ytdDesde = `${anio}-01-01`;
        const ytdHasta = fechaISO(periodo.hasta);

        const gastosCols = modoIVA === 'sin'
          ? 'fecha,grupo,subcategoria,proveedor,concepto,importe:base_imponible,base_imponible,marca,categoria_codigo,titular_id'
          : 'fecha,grupo,subcategoria,proveedor,concepto,importe,base_imponible,marca,categoria_codigo,titular_id';

        let gQ = supabase.from('gastos').select(gastosCols).gte('fecha', fechaISO(periodo.desde)).lte('fecha', fechaISO(periodo.hasta));
        let gaQ = supabase.from('gastos').select(gastosCols).gte('fecha', fechaISO(desdeAnt)).lte('fecha', fechaISO(hastaAnt));
        let gYTD = supabase.from('gastos').select(gastosCols).gte('fecha', ytdDesde).lte('fecha', ytdHasta);
        if (titularId) { gQ = gQ.eq('titular_id', titularId); gaQ = gaQ.eq('titular_id', titularId); gYTD = gYTD.eq('titular_id', titularId); }

        const factCols = 'fecha,marca_id,total_bruto,uber_bruto,glovo_bruto,je_bruto,web_bruto,directa_bruto,total_pedidos,uber_pedidos,glovo_pedidos,je_pedidos,web_pedidos,directa_pedidos';
        let fQ = supabase.from('facturacion_diario').select(factCols).gte('fecha', fechaISO(periodo.desde)).lte('fecha', fechaISO(periodo.hasta));
        let faQ = supabase.from('facturacion_diario').select(factCols).gte('fecha', fechaISO(desdeAnt)).lte('fecha', fechaISO(hastaAnt));
        let fYTD = supabase.from('facturacion_diario').select(factCols).gte('fecha', ytdDesde).lte('fecha', ytdHasta);
        if (marcaId) { fQ = fQ.eq('marca_id', marcaId); faQ = faQ.eq('marca_id', marcaId); fYTD = fYTD.eq('marca_id', marcaId); }

        const [{ data: g, error: e1 }, { data: ga, error: e2 }, { data: gytd, error: e3 }, { data: fd, error: e4 }, { data: fda, error: e5 }, { data: fytd, error: e6 }, { data: r, error: e7 }, { data: c, error: e8 }] = await Promise.all([
          gQ, gaQ, gYTD, fQ, faQ, fYTD,
          supabase.from('categorias_rango').select('categoria,pct_min,pct_max,orden').order('orden'),
          supabase.from('categorias_pyg').select('id,nivel,parent_id,nombre').order('id'),
        ]);

        const err = e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8;
        if (err) throw err;
        if (cancel) return;

        const gastos = (g || []) as GastoRow[];
        const gastosAnt = (ga || []) as GastoRow[];
        const gastosYTD = (gytd || []) as GastoRow[];
        const facturacion = (fd || []) as FactDiaria[];
        const facturacionAnt = (fda || []) as FactDiaria[];
        const facturacionYTD = (fytd || []) as FactDiaria[];
        const rangos = (r || []) as RangoCategoria[];
        const cats = (c || []) as CatPyG[];

        const calc = buildCalc(gastos, facturacion, periodo.desde, periodo.hasta);
        const calcAntData = buildCalc(gastosAnt, facturacionAnt, desdeAnt, hastaAnt);
        calc.deltaIngresos = calcDelta(calc.ingresosNeto, calcAntData.ingresosNeto);
        calc.deltaGastos = calcDelta(calc.totalGastos, calcAntData.totalGastos);
        calc.deltaResultado = calcDelta(calc.resultado, calcAntData.resultado);
        const calcYTD = buildCalc(gastosYTD, facturacionYTD, new Date(anio, 0, 1), periodo.hasta);
        calc.ytdIngresos = calcYTD.ingresosNeto;
        calc.ytdGastos = calcYTD.totalGastos;
        calc.ytdResultado = calcYTD.resultado;

        const provMap: Record<string, number> = {};
        for (const g2 of gastos) { const p = g2.proveedor || 'Sin proveedor'; provMap[p] = (provMap[p] || 0) + Math.abs(Number(g2.base_imponible || g2.importe || 0)); }
        const topProveedores = Object.entries(provMap).map(([proveedor, total]) => ({ proveedor, total })).sort((a, b) => b.total - a.total).slice(0, 5);

        const catMap: Record<string, number> = {};
        for (const g2 of gastos) { const cat = g2.subcategoria || g2.grupo || 'Otros'; catMap[cat] = (catMap[cat] || 0) + Math.abs(Number(g2.base_imponible || g2.importe || 0)); }
        const topCategorias = Object.entries(catMap).map(([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total).slice(0, 5);

        setState({
          loading: false, error: null,
          gastos, gastosAnt, ingresos: [], ingresosAnt: [],
          facturacion, facturacionAnt, rangos, cats,
          gastosYTD, ingresosYTD: [], facturacionYTD,
          calc, calcAnt: calcAntData, topProveedores, topCategorias,
        });
      } catch (err: any) {
        if (cancel) return;
        setState(s => ({ ...s, loading: false, error: err.message || 'Error' }));
      }
    })();
    return () => { cancel = true; };
  }, [periodo.desde.getTime(), periodo.hasta.getTime(), titularId, marcaId, modoIVA, tick]);

  return { ...state, reload };
}
