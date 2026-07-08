// =============================================================
// useTicketMedio — ticket medio por marca, por canal y global.
// Fuentes: ventas_plataforma (uber/glovo/just_eat) + facturacion_diario
// (web/directa, que no están en ventas_plataforma).
// =============================================================
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

export type CanalTicket = 'uber' | 'glovo' | 'just_eat' | 'web' | 'directa';

export interface VentaPlataformaRow {
  marca: string | null;
  plataforma: string;
  bruto: number | null;
  pedidos: number | null;
  ticket_medio: number | null;
  fecha_fin_periodo: string;
}

export interface FacturacionDiarioRow {
  fecha: string;
  web_bruto: number | null;
  web_pedidos: number | null;
  directa_bruto: number | null;
  directa_pedidos: number | null;
}

export interface TicketPorMarca {
  marca: string;
  ticketMedio: number;
  pedidos: number;
  bruto: number;
}

export interface TicketPorCanal {
  canal: CanalTicket;
  label: string;
  ticketMedio: number;
  pedidos: number;
  bruto: number;
}

export interface EvolucionMes {
  mes: string;               // 'YYYY-MM'
  ticketMedio: number;
  pedidos: number;
  bruto: number;
  variacion: number | null;  // % con signo vs mes anterior (null si no hay mes anterior)
}

export interface TicketMedioResult {
  loading: boolean;
  error: string | null;
  /** Ticket medio global del último mes con datos (KPI hero). */
  ticketGlobalUltimoMes: number | null;
  /** Mes (YYYY-MM) al que corresponde ticketGlobalUltimoMes. */
  mesUltimoMes: string | null;
  /** Marca con mayor ticket medio ponderado (KPI hero). */
  mejorMarca: TicketPorMarca | null;
  /** Variación % (con signo) del ticket medio global: último mes vs anterior. */
  tendenciaPct: number | null;
  porMarca: TicketPorMarca[];
  porCanal: TicketPorCanal[];
  evolucion: EvolucionMes[];
}

const CANAL_LABEL: Record<CanalTicket, string> = {
  uber: 'Uber Eats',
  glovo: 'Glovo',
  just_eat: 'Just Eat',
  web: 'Web',
  directa: 'Directa',
};

const ORDEN_CANAL: CanalTicket[] = ['uber', 'glovo', 'just_eat', 'web', 'directa'];

function acumular(
  map: Map<string, { bruto: number; pedidos: number }>,
  key: string,
  bruto: number,
  pedidos: number,
) {
  const prev = map.get(key) ?? { bruto: 0, pedidos: 0 };
  prev.bruto += bruto;
  prev.pedidos += pedidos;
  map.set(key, prev);
}

export function useTicketMedio(): TicketMedioResult {
  const [ventas, setVentas] = useState<VentaPlataformaRow[]>([]);
  const [facturacion, setFacturacion] = useState<FacturacionDiarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [vp, fd] = await Promise.all([
      supabase
        .from('ventas_plataforma')
        .select('marca,plataforma,bruto,pedidos,ticket_medio,fecha_fin_periodo')
        .order('fecha_fin_periodo'),
      supabase
        .from('facturacion_diario')
        .select('fecha,web_bruto,web_pedidos,directa_bruto,directa_pedidos')
        .order('fecha'),
    ]);
    if (vp.error) { setError(vp.error.message); setLoading(false); return; }
    if (fd.error) { setError(fd.error.message); setLoading(false); return; }
    setVentas((vp.data ?? []) as VentaPlataformaRow[]);
    setFacturacion((fd.data ?? []) as FacturacionDiarioRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { porMarca, porCanal, evolucion } = useMemo(() => {
    // --- Por marca: ticket medio ponderado = sum(bruto)/sum(pedidos) ---
    const porMarcaMap = new Map<string, { bruto: number; pedidos: number }>();
    ventas.forEach(r => {
      const marca = r.marca?.trim();
      if (!marca) return;
      acumular(porMarcaMap, marca, Number(r.bruto) || 0, Number(r.pedidos) || 0);
    });
    const porMarca: TicketPorMarca[] = Array.from(porMarcaMap.entries())
      .map(([marca, v]) => ({
        marca,
        ticketMedio: v.pedidos > 0 ? v.bruto / v.pedidos : 0,
        pedidos: v.pedidos,
        bruto: v.bruto,
      }))
      .filter(x => x.pedidos > 0)
      .sort((a, b) => b.ticketMedio - a.ticketMedio);

    // --- Por canal: uber/glovo/just_eat desde ventas_plataforma, web/directa desde facturacion_diario ---
    const porCanalMap = new Map<string, { bruto: number; pedidos: number }>();
    ventas.forEach(r => {
      const canal = r.plataforma;
      if (canal !== 'uber' && canal !== 'glovo' && canal !== 'just_eat') return;
      acumular(porCanalMap, canal, Number(r.bruto) || 0, Number(r.pedidos) || 0);
    });
    let webBruto = 0, webPedidos = 0, directaBruto = 0, directaPedidos = 0;
    facturacion.forEach(r => {
      webBruto += Number(r.web_bruto) || 0;
      webPedidos += Number(r.web_pedidos) || 0;
      directaBruto += Number(r.directa_bruto) || 0;
      directaPedidos += Number(r.directa_pedidos) || 0;
    });
    acumular(porCanalMap, 'web', webBruto, webPedidos);
    acumular(porCanalMap, 'directa', directaBruto, directaPedidos);

    const porCanal: TicketPorCanal[] = ORDEN_CANAL.map(canal => {
      const v = porCanalMap.get(canal) ?? { bruto: 0, pedidos: 0 };
      return {
        canal,
        label: CANAL_LABEL[canal],
        ticketMedio: v.pedidos > 0 ? v.bruto / v.pedidos : 0,
        pedidos: v.pedidos,
        bruto: v.bruto,
      };
    });

    // --- Evolución mensual global: últimos 12 meses con datos ---
    const porMesMap = new Map<string, { bruto: number; pedidos: number }>();
    ventas.forEach(r => {
      if (!r.fecha_fin_periodo) return;
      const mes = r.fecha_fin_periodo.slice(0, 7);
      acumular(porMesMap, mes, Number(r.bruto) || 0, Number(r.pedidos) || 0);
    });
    facturacion.forEach(r => {
      if (!r.fecha) return;
      const mes = r.fecha.slice(0, 7);
      acumular(
        porMesMap,
        mes,
        (Number(r.web_bruto) || 0) + (Number(r.directa_bruto) || 0),
        (Number(r.web_pedidos) || 0) + (Number(r.directa_pedidos) || 0),
      );
    });

    const mesesConDatos = Array.from(porMesMap.entries())
      .filter(([, v]) => v.pedidos > 0)
      .sort(([a], [b]) => a.localeCompare(b));

    const ultimos12 = mesesConDatos.slice(-12);
    const evolucion: EvolucionMes[] = ultimos12.map(([mes, v], idx) => {
      const ticketMedio = v.bruto / v.pedidos;
      let variacion: number | null = null;
      if (idx > 0) {
        const anterior = ultimos12[idx - 1][1];
        const tmAnterior = anterior.pedidos > 0 ? anterior.bruto / anterior.pedidos : null;
        if (tmAnterior && tmAnterior > 0) {
          variacion = ((ticketMedio - tmAnterior) / tmAnterior) * 100;
        }
      }
      return { mes, ticketMedio, pedidos: v.pedidos, bruto: v.bruto, variacion };
    });

    return { porMarca, porCanal, evolucion };
  }, [ventas, facturacion]);

  const ultimoMes = evolucion.length > 0 ? evolucion[evolucion.length - 1] : null;

  return {
    loading,
    error,
    ticketGlobalUltimoMes: ultimoMes ? ultimoMes.ticketMedio : null,
    mesUltimoMes: ultimoMes ? ultimoMes.mes : null,
    mejorMarca: porMarca.length > 0 ? porMarca[0] : null,
    tendenciaPct: ultimoMes ? ultimoMes.variacion : null,
    porMarca,
    porCanal,
    evolucion,
  };
}
