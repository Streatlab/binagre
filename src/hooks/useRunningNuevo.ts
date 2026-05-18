/**
 * useRunningNuevo — Hook Running NUEVO desde cero (18 may 2026)
 * Fuentes: gastos (vista), conciliacion ingresos, facturacion_diario,
 *          categorias_rango, presupuestos_mensuales
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CANALES, calcNeto } from '@/styles/tokens';

/* ── Tipos ── */

export interface GastoRow {
  fecha: string;
  grupo: string;
  subcategoria: string;
  proveedor: string;
  concepto: string;
  importe: number;
  marca: string;
  titular_id: string | null;
}

export interface IngresoRow {
  fecha: string;
  importe: number;
  concepto: string;
  plataforma: string;
  marca: string;
  titular_id: string | null;
}

export interface FactDiaria {
  fecha: string;
  marca_id: string | null;
  uber_bruto: number; uber_pedidos: number;
  glovo_bruto: number; glovo_pedidos: number;
  je_bruto: number; je_pedidos: number;
  web_bruto: number; web_pedidos: number;
  directa_bruto: number; directa_pedidos: number;
  titular_id: string | null;
}

export interface RangoCat {
  categoria: string;
  pct_min: number;
  pct_max: number;
}

export interface Presupuesto {
  mes: number;
  anio: number;
  categoria: string;
  importe: number;
}

export interface CanalResumen {
  canal: string;
  color: string;
  bruto: number;
  pedidos: number;
  comisiones: number;
  neto: number;
}

export interface GrupoGasto {
  grupo: string;
  total: number;
  pct: number;
}

export interface ProveedorTop {
  proveedor: string;
  total: number;
}

export interface CategoriaTop {
  categoria: string;
  total: number;
}

export interface RunningNuevoState {
  loading: boolean;
  error: string | null;
  /* raw */
  gastos: GastoRow[];
  ingresos: IngresoRow[];
  facturacion: FactDiaria[];
  facturacionYTD: FactDiaria[];
  rangos: RangoCat[];
  presupuestos: Presupuesto[];
  /* calc */
  ingresosBruto: number;
  ingresosNeto: number;
  totalGastos: number;
  resultado: number;
  gastoProducto: number;
  gastoRRHH: number;
  primeCost: number;
  primeCostPct: number;
  breakEven: number;
  breakEvenSuperado: boolean;
  proyeccion: number;
  ritmoPct: number;
  canales: CanalResumen[];
  gastosPorGrupo: GrupoGasto[];
  topProveedores: ProveedorTop[];
  topCategorias: CategoriaTop[];
  ytdIngresos: number;
  ytdGastos: number;
  ytdResultado: number;
  /* periodo anterior */
  antIngresosNeto: number;
  antGastos: number;
  antResultado: number;
  deltaIngresos: number;
  deltaGastos: number;
  deltaResultado: number;
  /* acciones */
  reload: () => void;
}

/* ── Helpers ── */

const fmt = (d: Date) => d.toISOString().slice(0, 10);

function mesAnterior(desde: Date, hasta: Date): { desde: string; hasta: string } {
  const d = new Date(desde); d.setMonth(d.getMonth() - 1);
  const h = new Date(hasta); h.setMonth(h.getMonth() - 1);
  return { desde: fmt(d), hasta: fmt(h) };
}

function delta(actual: number, anterior: number): number {
  if (!anterior) return 0;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}

/* ── Hook ── */

export function useRunningNuevo(
  desde: Date,
  hasta: Date,
  titularId: string | null,
  marcaId: string | null,
): RunningNuevoState {
  const [state, setState] = useState<RunningNuevoState>(empty());
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const dStr = fmt(desde);
        const hStr = fmt(hasta);
        const ant = mesAnterior(desde, hasta);
        const anio = desde.getFullYear();

        /* ── 1. Gastos periodo ── */
        let qGastos = supabase.from('gastos').select('*')
          .gte('fecha', dStr).lte('fecha', hStr);
        if (titularId) qGastos = qGastos.eq('titular_id', titularId);

        /* ── 2. Ingresos conciliación ── */
        let qIngresos = supabase.from('conciliacion').select('*')
          .eq('tipo', 'ingreso')
          .like('categoria', '1.%')
          .gte('fecha', dStr).lte('fecha', hStr);
        if (titularId) qIngresos = qIngresos.eq('titular_id', titularId);

        /* ── 3. Facturación diaria ── */
        let qFact = supabase.from('facturacion_diario').select('*')
          .gte('fecha', dStr).lte('fecha', hStr);
        if (titularId) qFact = qFact.eq('titular_id', titularId);
        if (marcaId) qFact = qFact.eq('marca_id', marcaId);

        /* ── 4. Facturación YTD ── */
        let qYTD = supabase.from('facturacion_diario').select('*')
          .gte('fecha', `${anio}-01-01`).lte('fecha', hStr);
        if (titularId) qYTD = qYTD.eq('titular_id', titularId);

        /* ── 5. Gastos YTD ── */
        let qGastosYTD = supabase.from('gastos').select('importe')
          .gte('fecha', `${anio}-01-01`).lte('fecha', hStr);
        if (titularId) qGastosYTD = qGastosYTD.eq('titular_id', titularId);

        /* ── 6. Gastos anterior ── */
        let qGastosAnt = supabase.from('gastos').select('importe')
          .gte('fecha', ant.desde).lte('fecha', ant.hasta);
        if (titularId) qGastosAnt = qGastosAnt.eq('titular_id', titularId);

        /* ── 7. Facturación anterior ── */
        let qFactAnt = supabase.from('facturacion_diario').select('*')
          .gte('fecha', ant.desde).lte('fecha', ant.hasta);
        if (titularId) qFactAnt = qFactAnt.eq('titular_id', titularId);

        /* ── 8. Rangos ── */
        const qRangos = supabase.from('categorias_rango').select('*');

        /* ── 9. Presupuestos ── */
        const qPres = supabase.from('presupuestos_mensuales').select('*')
          .eq('anio', anio);

        /* ── Ejecutar todo en paralelo ── */
        const [
          rGastos, rIngresos, rFact, rYTD, rGastosYTD,
          rGastosAnt, rFactAnt, rRangos, rPres,
        ] = await Promise.all([
          qGastos, qIngresos, qFact, qYTD, qGastosYTD,
          qGastosAnt, qFactAnt, qRangos, qPres,
        ]);

        if (cancelled) return;

        const gastos: GastoRow[] = (rGastos.data || []).map(r => ({
          fecha: r.fecha, grupo: r.grupo || '', subcategoria: r.subcategoria || '',
          proveedor: r.proveedor || '', concepto: r.concepto || '',
          importe: Number(r.base_imponible || r.importe || 0),
          marca: r.marca || '', titular_id: r.titular_id,
        }));

        const ingresos: IngresoRow[] = (rIngresos.data || []).map(r => ({
          fecha: r.fecha, importe: Number(r.importe || 0),
          concepto: r.concepto || '', plataforma: r.plataforma || '',
          marca: r.marca || '', titular_id: r.titular_id,
        }));

        const facturacion: FactDiaria[] = (rFact.data || []).map(r => ({
          fecha: r.fecha, marca_id: r.marca_id,
          uber_bruto: Number(r.uber_bruto || 0), uber_pedidos: Number(r.uber_pedidos || 0),
          glovo_bruto: Number(r.glovo_bruto || 0), glovo_pedidos: Number(r.glovo_pedidos || 0),
          je_bruto: Number(r.je_bruto || 0), je_pedidos: Number(r.je_pedidos || 0),
          web_bruto: Number(r.web_bruto || 0), web_pedidos: Number(r.web_pedidos || 0),
          directa_bruto: Number(r.directa_bruto || 0), directa_pedidos: Number(r.directa_pedidos || 0),
          titular_id: r.titular_id,
        }));

        const facturacionYTD: FactDiaria[] = (rYTD.data || []).map(r => ({
          fecha: r.fecha, marca_id: r.marca_id,
          uber_bruto: Number(r.uber_bruto || 0), uber_pedidos: Number(r.uber_pedidos || 0),
          glovo_bruto: Number(r.glovo_bruto || 0), glovo_pedidos: Number(r.glovo_pedidos || 0),
          je_bruto: Number(r.je_bruto || 0), je_pedidos: Number(r.je_pedidos || 0),
          web_bruto: Number(r.web_bruto || 0), web_pedidos: Number(r.web_pedidos || 0),
          directa_bruto: Number(r.directa_bruto || 0), directa_pedidos: Number(r.directa_pedidos || 0),
          titular_id: r.titular_id,
        }));

        const rangos: RangoCat[] = (rRangos.data || []).map(r => ({
          categoria: r.categoria, pct_min: Number(r.pct_min || 0), pct_max: Number(r.pct_max || 0),
        }));

        const presupuestos: Presupuesto[] = (rPres.data || []).map(r => ({
          mes: r.mes, anio: r.anio, categoria: r.categoria, importe: Number(r.importe || 0),
        }));

        /* ── Cálculos ingresos por canal ── */
        let ingresosBruto = 0;
        let ingresosNeto = 0;
        const canalMap: Record<string, CanalResumen> = {};
        for (const c of CANALES) {
          canalMap[c.id] = { canal: c.label, color: c.color, bruto: 0, pedidos: 0, comisiones: 0, neto: 0 };
        }

        for (const f of facturacion) {
          for (const canal of CANALES) {
            const bruto = Number((f as any)[canal.bruKey] || 0);
            const pedidos = Number((f as any)[canal.pedKey] || 0);
            if (!bruto) continue;
            const neto = calcNeto(bruto, pedidos, canal);
            const comision = bruto - neto;
            canalMap[canal.id].bruto += bruto;
            canalMap[canal.id].pedidos += pedidos;
            canalMap[canal.id].comisiones += comision;
            canalMap[canal.id].neto += neto;
            ingresosBruto += bruto;
            ingresosNeto += neto;
          }
        }

        const canales = CANALES.map(c => canalMap[c.id]).filter(c => c.bruto > 0);

        /* ── Gastos por grupo ── */
        const totalGastos = gastos.reduce((s, g) => s + g.importe, 0);
        const grupoMap: Record<string, number> = {};
        for (const g of gastos) {
          const gr = g.grupo || 'Otros';
          grupoMap[gr] = (grupoMap[gr] || 0) + g.importe;
        }
        const gastosPorGrupo: GrupoGasto[] = Object.entries(grupoMap)
          .map(([grupo, total]) => ({ grupo, total, pct: totalGastos ? (total / totalGastos) * 100 : 0 }))
          .sort((a, b) => b.total - a.total);

        /* ── Prime Cost ── */
        const gastoProducto = gastos.filter(g => g.grupo === 'Producto').reduce((s, g) => s + g.importe, 0);
        const gastoRRHH = gastos.filter(g => g.grupo === 'Equipo').reduce((s, g) => s + g.importe, 0);
        const primeCost = gastoProducto + gastoRRHH;
        const primeCostPct = ingresosNeto ? (primeCost / ingresosNeto) * 100 : 0;

        /* ── Break-even ── */
        const gastosFijos = gastos
          .filter(g => ['Alquiler', 'Equipo'].includes(g.grupo))
          .reduce((s, g) => s + g.importe, 0);
        const gastosVariables = gastos
          .filter(g => ['Producto', 'Controlables'].includes(g.grupo))
          .reduce((s, g) => s + g.importe, 0);
        const ratioVar = ingresosNeto ? gastosVariables / ingresosNeto : 0.5;
        const breakEven = ratioVar < 1 ? gastosFijos / (1 - ratioVar) : gastosFijos * 3;
        const breakEvenSuperado = ingresosNeto >= breakEven;

        /* ── Proyección cierre mes ── */
        const hoy = new Date();
        const diaActual = hoy.getDate();
        const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
        const proyeccion = diaActual > 0 ? (ingresosNeto / diaActual) * diasMes : 0;
        const ritmoPct = breakEven > 0 ? (ingresosNeto / breakEven) * 100 : 0;

        const resultado = ingresosNeto - totalGastos;

        /* ── Top proveedores ── */
        const provMap: Record<string, number> = {};
        for (const g of gastos) {
          if (g.proveedor) provMap[g.proveedor] = (provMap[g.proveedor] || 0) + g.importe;
        }
        const topProveedores: ProveedorTop[] = Object.entries(provMap)
          .map(([proveedor, total]) => ({ proveedor, total }))
          .sort((a, b) => b.total - a.total).slice(0, 5);

        /* ── Top categorías gasto ── */
        const catMap: Record<string, number> = {};
        for (const g of gastos) {
          const cat = g.subcategoria || g.grupo || 'Otros';
          catMap[cat] = (catMap[cat] || 0) + g.importe;
        }
        const topCategorias: CategoriaTop[] = Object.entries(catMap)
          .map(([categoria, total]) => ({ categoria, total }))
          .sort((a, b) => b.total - a.total).slice(0, 5);

        /* ── YTD ── */
        let ytdIngresos = 0;
        for (const f of facturacionYTD) {
          for (const canal of CANALES) {
            const bruto = Number((f as any)[canal.bruKey] || 0);
            const pedidos = Number((f as any)[canal.pedKey] || 0);
            if (bruto) ytdIngresos += calcNeto(bruto, pedidos, canal);
          }
        }
        const ytdGastos = (rGastosYTD.data || []).reduce((s: number, r: any) => s + Number(r.importe || 0), 0);
        const ytdResultado = ytdIngresos - ytdGastos;

        /* ── Periodo anterior ── */
        let antIngresosNeto = 0;
        for (const f of (rFactAnt.data || [])) {
          for (const canal of CANALES) {
            const bruto = Number((f as any)[canal.bruKey] || 0);
            const pedidos = Number((f as any)[canal.pedKey] || 0);
            if (bruto) antIngresosNeto += calcNeto(bruto, pedidos, canal);
          }
        }
        const antGastos = (rGastosAnt.data || []).reduce((s: number, r: any) => s + Number(r.importe || 0), 0);
        const antResultado = antIngresosNeto - antGastos;

        if (cancelled) return;

        setState({
          loading: false, error: null,
          gastos, ingresos, facturacion, facturacionYTD, rangos, presupuestos,
          ingresosBruto, ingresosNeto, totalGastos, resultado,
          gastoProducto, gastoRRHH, primeCost, primeCostPct,
          breakEven, breakEvenSuperado, proyeccion, ritmoPct,
          canales, gastosPorGrupo, topProveedores, topCategorias,
          ytdIngresos, ytdGastos, ytdResultado,
          antIngresosNeto, antGastos, antResultado,
          deltaIngresos: delta(ingresosNeto, antIngresosNeto),
          deltaGastos: delta(totalGastos, antGastos),
          deltaResultado: delta(resultado, antResultado),
          reload,
        });
      } catch (e: any) {
        if (!cancelled) setState(s => ({ ...s, loading: false, error: e.message || 'Error' }));
      }
    })();

    return () => { cancelled = true; };
  }, [desde, hasta, titularId, marcaId, tick]);

  return state;
}

function empty(): RunningNuevoState {
  return {
    loading: true, error: null,
    gastos: [], ingresos: [], facturacion: [], facturacionYTD: [], rangos: [], presupuestos: [],
    ingresosBruto: 0, ingresosNeto: 0, totalGastos: 0, resultado: 0,
    gastoProducto: 0, gastoRRHH: 0, primeCost: 0, primeCostPct: 0,
    breakEven: 0, breakEvenSuperado: false, proyeccion: 0, ritmoPct: 0,
    canales: [], gastosPorGrupo: [], topProveedores: [], topCategorias: [],
    ytdIngresos: 0, ytdGastos: 0, ytdResultado: 0,
    antIngresosNeto: 0, antGastos: 0, antResultado: 0,
    deltaIngresos: 0, deltaGastos: 0, deltaResultado: 0,
    reload: () => {},
  };
}
