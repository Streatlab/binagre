// =============================================================
// Hook useRepeticionClientes — % repetición, frecuencia media y
// clientes perdidos, calculado sobre crm_clientes.
//
// TODO fuente de datos: crm_clientes está vacía (0 filas) en este momento.
// Para tener datos reales hace falta poblarla — candidatos: pedidos de canal
// Directa/Web (que sí identifican cliente) o una importación desde el CRM
// externo si existe. Este módulo ya consulta la tabla correcta y calculará
// bien en cuanto tenga filas.
// =============================================================
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase';

const DIAS_PERDIDO = 90;

export interface ClienteRepeticion {
  id: string;
  nombre: string | null;
  num_pedidos: number | null;
  gasto_total: number | null;
  primera_compra: string | null;
  ultima_compra: string | null;
  marca_preferida: string | null;
  baja: boolean | null;
}

export interface MetricasRepeticion {
  totalClientes: number;
  pctRepeticion: number | null;
  frecuenciaMedia: number | null;
  clientesPerdidos: number | null;
}

export interface MetricaPorMarca {
  marca: string;
  numClientes: number;
  pctRepeticion: number | null;
  frecuenciaMedia: number | null;
  perdidos: number;
}

function calcularMetricas(rows: ClienteRepeticion[]): MetricasRepeticion {
  const total = rows.length;
  if (total === 0) {
    return { totalClientes: 0, pctRepeticion: null, frecuenciaMedia: null, clientesPerdidos: null };
  }

  const repetidores = rows.filter(r => (r.num_pedidos ?? 0) > 1).length;
  const pctRepeticion = (repetidores / total) * 100;

  const conPedidos = rows.filter(r => (r.num_pedidos ?? 0) > 0);
  const frecuenciaMedia = conPedidos.length > 0
    ? conPedidos.reduce((acc, r) => acc + (r.num_pedidos ?? 0), 0) / conPedidos.length
    : null;

  const limite = new Date();
  limite.setDate(limite.getDate() - DIAS_PERDIDO);
  const clientesConCompra = rows.filter(r => (r.num_pedidos ?? 0) > 0 && r.ultima_compra);
  const clientesPerdidos = clientesConCompra.length > 0
    ? clientesConCompra.filter(r => new Date(r.ultima_compra as string) < limite).length
    : null;

  return { totalClientes: total, pctRepeticion, frecuenciaMedia, clientesPerdidos };
}

function calcularPorMarca(rows: ClienteRepeticion[]): MetricaPorMarca[] {
  const grupos = new Map<string, ClienteRepeticion[]>();
  rows.forEach(r => {
    const marca = r.marca_preferida?.trim() || 'Sin marca';
    if (!grupos.has(marca)) grupos.set(marca, []);
    grupos.get(marca)!.push(r);
  });

  const limite = new Date();
  limite.setDate(limite.getDate() - DIAS_PERDIDO);

  return Array.from(grupos.entries())
    .map(([marca, clientes]) => {
      const m = calcularMetricas(clientes);
      return {
        marca,
        numClientes: m.totalClientes,
        pctRepeticion: m.pctRepeticion,
        frecuenciaMedia: m.frecuenciaMedia,
        perdidos: m.clientesPerdidos ?? 0,
      };
    })
    .sort((a, b) => b.numClientes - a.numClientes);
}

export function useRepeticionClientes() {
  const [data, setData] = useState<ClienteRepeticion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: rows, error: err } = await supabase
      .from('crm_clientes')
      .select('id,nombre,num_pedidos,gasto_total,primera_compra,ultima_compra,marca_preferida,baja')
      .eq('baja', false);

    if (err) {
      setError(err.message);
      setData([]);
    } else {
      setData((rows ?? []) as ClienteRepeticion[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const metricas = calcularMetricas(data);
  const porMarca = calcularPorMarca(data);

  return { data, loading, error, metricas, porMarca, refetch: fetchData };
}
