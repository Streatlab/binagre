import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Categoria, PeriodoRango } from '@/lib/running';
import { fechaISO } from '@/lib/running';

export interface GastoRaw {
  fecha: string;
  categoria: Categoria;
  subcategoria: string | null;
  proveedor: string | null;
  concepto: string | null;
  importe: number;
  marca: string | null;
}

export interface IngresoMensualRaw {
  anio: number; mes: number; canal: string; tipo: 'bruto'|'neto'; importe: number;
}

export interface FacturacionDiariaRaw {
  fecha: string;
  marca_id: string | null;
  total_bruto: number;
  uber_bruto: number;
  glovo_bruto: number;
  je_bruto: number;
  web_bruto: number;
  directa_bruto: number;
  total_pedidos: number;
}

export interface RangoCategoria {
  categoria: Categoria; pct_min: number; pct_max: number; orden: number;
}

export interface RunningState {
  loading: boolean;
  error: string | null;
  gastos: GastoRaw[];
  gastosAnt: GastoRaw[];
  ingresosMes: IngresoMensualRaw[];
  facturacion: FacturacionDiariaRaw[];
  facturacionAnt: FacturacionDiariaRaw[];
  rangos: RangoCategoria[];
  reload: () => void;
}

export function useRunning(
  periodo: PeriodoRango,
  anio: number,
  marcaId?: string | null,
  marcaNombre?: string | null,
  modoIVA: 'sin' | 'con' = 'con',
): RunningState {
  const [state, setState] = useState<Omit<RunningState, 'reload'>>({
    loading: true, error: null,
    gastos: [], gastosAnt: [], ingresosMes: [],
    facturacion: [], facturacionAnt: [],
    rangos: [],
  });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick(t => t+1), []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setState(s => ({...s, loading: true, error: null}));
      try {
        const ms = periodo.hasta.getTime() - periodo.desde.getTime();
        const hastaAnt = new Date(periodo.desde); hastaAnt.setDate(hastaAnt.getDate()-1);
        const desdeAnt = new Date(hastaAnt.getTime() - ms);

        const gastosCols = modoIVA === 'sin'
          ? 'fecha,categoria:grupo,subcategoria,proveedor,concepto,importe:base_imponible,marca'
          : 'fecha,categoria:grupo,subcategoria,proveedor,concepto,importe,marca';
        let gQ = supabase.from('gastos').select(gastosCols)
          .gte('fecha', fechaISO(periodo.desde)).lte('fecha', fechaISO(periodo.hasta));
        let gaQ = supabase.from('gastos').select(gastosCols)
          .gte('fecha', fechaISO(desdeAnt)).lte('fecha', fechaISO(hastaAnt));
        if (marcaNombre) {
          gQ = gQ.eq('marca', marcaNombre);
          gaQ = gaQ.eq('marca', marcaNombre);
        }

        let fQ = supabase.from('facturacion_diario')
          .select('fecha,marca_id,total_bruto,uber_bruto,glovo_bruto,je_bruto,web_bruto,directa_bruto,total_pedidos')
          .gte('fecha', fechaISO(periodo.desde)).lte('fecha', fechaISO(periodo.hasta));
        let faQ = supabase.from('facturacion_diario')
          .select('fecha,marca_id,total_bruto,uber_bruto,glovo_bruto,je_bruto,web_bruto,directa_bruto,total_pedidos')
          .gte('fecha', fechaISO(desdeAnt)).lte('fecha', fechaISO(hastaAnt));
        if (marcaId) {
          fQ = fQ.eq('marca_id', marcaId);
          faQ = faQ.eq('marca_id', marcaId);
        }

        const [{data: g, error: e1}, {data: ga, error: e2}, {data: im, error: e3}, {data: r, error: e4}, {data: fd, error: e5}, {data: fda, error: e6}] = await Promise.all([
          gQ,
          gaQ,
          supabase.from('ingresos_mensuales').select(
            modoIVA === 'sin' ? 'anio,mes,canal,tipo,importe:base_imponible' : 'anio,mes,canal,tipo,importe'
          ).eq('anio', anio),
          supabase.from('categorias_rango').select('categoria,pct_min,pct_max,orden').order('orden'),
          fQ,
          faQ,
        ]);
        if (e1) throw e1; if (e2) throw e2; if (e3) throw e3; if (e4) throw e4; if (e5) throw e5; if (e6) throw e6;

        if (cancel) return;
        setState({
          loading: false, error: null,
          gastos: (g || []) as GastoRaw[],
          gastosAnt: (ga || []) as GastoRaw[],
          ingresosMes: (im || []) as IngresoMensualRaw[],
          facturacion: (fd || []) as FacturacionDiariaRaw[],
          facturacionAnt: (fda || []) as FacturacionDiariaRaw[],
          rangos: (r || []) as RangoCategoria[],
        });
      } catch (err: any) {
        if (cancel) return;
        setState(s => ({...s, loading: false, error: err.message || 'Error'}));
      }
    })();
    return () => { cancel = true; };
  }, [periodo.desde.getTime(), periodo.hasta.getTime(), anio, marcaId, marcaNombre, modoIVA, tick]);

  return { ...state, reload };
}
