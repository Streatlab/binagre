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
}

export interface IngresoMensualRaw {
  anio: number; mes: number; canal: string; tipo: 'bruto'|'neto'; importe: number;
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
  rangos: RangoCategoria[];
  reload: () => void;
}

export function useRunning(periodo: PeriodoRango, anio: number): RunningState {
  const [state, setState] = useState<Omit<RunningState, 'reload'>>({
    loading: true, error: null, gastos: [], gastosAnt: [], ingresosMes: [], rangos: [],
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

        const [{data: g, error: e1}, {data: ga, error: e2}, {data: im, error: e3}, {data: r, error: e4}] = await Promise.all([
          supabase.from('gastos').select('fecha,categoria:grupo,subcategoria,proveedor,concepto,importe')
            .gte('fecha', fechaISO(periodo.desde)).lte('fecha', fechaISO(periodo.hasta)),
          supabase.from('gastos').select('fecha,categoria:grupo,subcategoria,proveedor,concepto,importe')
            .gte('fecha', fechaISO(desdeAnt)).lte('fecha', fechaISO(hastaAnt)),
          supabase.from('ingresos_mensuales').select('anio,mes,canal,tipo,importe').eq('anio', anio),
          supabase.from('categorias_rango').select('categoria,pct_min,pct_max,orden').order('orden'),
        ]);
        if (e1) throw e1; if (e2) throw e2; if (e3) throw e3; if (e4) throw e4;

        if (cancel) return;
        setState({
          loading: false, error: null,
          gastos: (g || []) as GastoRaw[],
          gastosAnt: (ga || []) as GastoRaw[],
          ingresosMes: (im || []) as IngresoMensualRaw[],
          rangos: (r || []) as RangoCategoria[],
        });
      } catch (err: any) {
        if (cancel) return;
        setState(s => ({...s, loading: false, error: err.message || 'Error'}));
      }
    })();
    return () => { cancel = true; };
  }, [periodo.desde.getTime(), periodo.hasta.getTime(), anio, tick]);

  return { ...state, reload };
}
