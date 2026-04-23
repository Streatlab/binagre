import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { CategoriaGasto } from '@/lib/running-calc';

export interface IngresoMes {
  mes: number;
  uber: number;
  glovo: number;
  justeat: number;
  web: number;
  bruto: number;
  neto: number;
  comisiones: number;
}

export interface GastoAggCat {
  categoria: CategoriaGasto;
  total: number;
  porSubcategoria: { nombre: string; total: number }[];
  porProveedor: { proveedor: string; abv: string | null; total: number }[];
  porConcepto: { concepto: string; total: number }[];
}

export interface PresupuestoRow {
  categoria: CategoriaGasto;
  tope: number;
  gasto: number;
}

export interface TesoreriaRow {
  fecha: string;
  caja_liquida: number;
  cobros_pendientes: number;
  pagos_pendientes: number;
}

export interface RunningData {
  anio: number;
  mesActual: number;
  ingresosPorMes: IngresoMes[];
  gastosPorMes: Record<number, GastoAggCat[]>;
  presupuestosMesActual: PresupuestoRow[];
  tesoreriaHoy: TesoreriaRow | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useRunningFinanciero(anio: number, marca: string = 'Todas'): RunningData {
  const [state, setState] = useState<Omit<RunningData, 'reload'>>({
    anio,
    mesActual: new Date().getMonth() + 1,
    ingresosPorMes: [],
    gastosPorMes: {},
    presupuestosMesActual: [],
    tesoreriaHoy: null,
    loading: true,
    error: null,
  });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const desde = `${anio}-01-01`;
        const hasta = `${anio}-12-31`;

        const { data: fd, error: e1 } = await supabase
          .from('facturacion_diario')
          .select('fecha, uber_bruto, glovo_bruto, je_bruto, web_bruto, directa_bruto, total_bruto')
          .gte('fecha', desde)
          .lte('fecha', hasta);
        if (e1) throw e1;

        const COM = { uber: 0.30, glovo: 0.30, je: 0.30, web: 0.07, directa: 0.00 };
        const ing = new Map<number, IngresoMes>();
        for (let m = 1; m <= 12; m++) {
          ing.set(m, { mes: m, uber: 0, glovo: 0, justeat: 0, web: 0, bruto: 0, neto: 0, comisiones: 0 });
        }
        (fd || []).forEach((r: any) => {
          const mes = Number(String(r.fecha).slice(5, 7));
          const row = ing.get(mes)!;
          const ub = Number(r.uber_bruto || 0);
          const gb = Number(r.glovo_bruto || 0);
          const jb = Number(r.je_bruto || 0);
          const wb = Number(r.web_bruto || 0);
          const db = Number(r.directa_bruto || 0);
          const tb = Number(r.total_bruto || 0) || ub + gb + jb + wb + db;
          const un = ub * (1 - COM.uber);
          const gn = gb * (1 - COM.glovo);
          const jn = jb * (1 - COM.je);
          const wn = wb * (1 - COM.web);
          const dn = db * (1 - COM.directa);
          const tn = un + gn + jn + wn + dn;
          row.bruto += tb;
          row.neto += tn;
          row.comisiones += tb - tn;
          row.uber += un;
          row.glovo += gn;
          row.justeat += jn;
          row.web += wn + dn;
        });

        let gq: any = supabase
          .from('gastos')
          .select('fecha, categoria, subcategoria, proveedor, proveedor_abv, concepto, importe, marca')
          .gte('fecha', desde)
          .lte('fecha', hasta);
        if (marca !== 'Todas') gq = gq.eq('marca', marca);
        const { data: gs, error: e2 } = await gq;
        if (e2) throw e2;

        const gastosPorMes: Record<number, GastoAggCat[]> = {};
        for (let m = 1; m <= 12; m++) gastosPorMes[m] = [];
        (gs || []).forEach((g: any) => {
          const mes = Number(String(g.fecha).slice(5, 7));
          const cat = g.categoria as CategoriaGasto;
          let agg = gastosPorMes[mes].find((x) => x.categoria === cat);
          if (!agg) {
            agg = { categoria: cat, total: 0, porSubcategoria: [], porProveedor: [], porConcepto: [] };
            gastosPorMes[mes].push(agg);
          }
          const imp = Number(g.importe || 0);
          agg.total += imp;
          if (g.subcategoria) {
            const s = agg.porSubcategoria.find((x) => x.nombre === g.subcategoria);
            if (s) s.total += imp;
            else agg.porSubcategoria.push({ nombre: g.subcategoria, total: imp });
          }
          if (g.proveedor) {
            const p = agg.porProveedor.find((x) => x.proveedor === g.proveedor);
            if (p) p.total += imp;
            else agg.porProveedor.push({ proveedor: g.proveedor, abv: g.proveedor_abv || null, total: imp });
          }
          if (g.concepto) {
            const c2 = agg.porConcepto.find((x) => x.concepto === g.concepto);
            if (c2) c2.total += imp;
            else agg.porConcepto.push({ concepto: g.concepto, total: imp });
          }
        });

        const mesActual = new Date().getMonth() + 1;
        const { data: pres, error: e3 } = await supabase
          .from('presupuestos_mensuales')
          .select('categoria, tope')
          .eq('anio', anio)
          .eq('mes', mesActual);
        if (e3) throw e3;
        const presupuestosMesActual: PresupuestoRow[] = ((pres as any[]) || []).map((p: any) => ({
          categoria: p.categoria as CategoriaGasto,
          tope: Number(p.tope || 0),
          gasto: gastosPorMes[mesActual].find((x) => x.categoria === p.categoria)?.total || 0,
        }));

        const { data: tes, error: e4 } = await supabase
          .from('tesoreria_snapshot')
          .select('fecha, caja_liquida, cobros_pendientes, pagos_pendientes')
          .order('fecha', { ascending: false })
          .limit(1);
        if (e4) throw e4;

        if (cancel) return;
        setState({
          anio,
          mesActual,
          ingresosPorMes: Array.from(ing.values()),
          gastosPorMes,
          presupuestosMesActual,
          tesoreriaHoy: tes && (tes as any[])[0] ? ((tes as any[])[0] as TesoreriaRow) : null,
          loading: false,
          error: null,
        });
      } catch (err: any) {
        if (cancel) return;
        setState((s) => ({ ...s, loading: false, error: err.message || 'Error' }));
      }
    })();
    return () => {
      cancel = true;
    };
  }, [anio, marca, tick]);

  return { ...state, reload };
}
