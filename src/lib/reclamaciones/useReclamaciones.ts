// =============================================================
// Hook useReclamaciones - CRUD + upload de fotos al storage
// =============================================================
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase';

export type Canal = 'uber_eats' | 'glovo' | 'just_eat' | 'web' | 'directo';
export type EstadoReclamacion = 'pendiente' | 'reclamada' | 'cobrada' | 'rechazada';
export type TipoReclamacion =
  | 'producto_faltante' | 'producto_erroneo' | 'mala_calidad'
  | 'pedido_cancelado' | 'cobro_incorrecto' | 'otro';

export interface Reclamacion {
  id: string;
  created_at: string;
  updated_at: string;
  fecha: string;
  canal: Canal;
  marca: string | null;
  tipo: TipoReclamacion;
  pedido_ref: string;
  descripcion: string | null;
  importe_reclamado: number;
  importe_compensado: number;
  estado: EstadoReclamacion;
  fecha_envio: string | null;
  fecha_resolucion: string | null;
  foto_url: string | null;
  factura_cobro_periodo: string | null;
  resolucion_notas: string | null;
}

export type NuevaReclamacion = Omit<Reclamacion, 'id' | 'created_at' | 'updated_at'>;

export function useReclamaciones() {
  const [data, setData] = useState<Reclamacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from('reclamaciones')
      .select('*')
      .order('fecha', { ascending: false });
    if (err) setError(err.message);
    else setData((rows as Reclamacion[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const insert = async (nueva: Partial<NuevaReclamacion>) => {
    const { data: row, error: err } = await supabase
      .from('reclamaciones')
      .insert([nueva])
      .select()
      .single();
    if (err) throw err;
    await fetchData();
    return row;
  };

  const update = async (id: string, patch: Partial<Reclamacion>) => {
    const { error: err } = await supabase
      .from('reclamaciones')
      .update(patch)
      .eq('id', id);
    if (err) throw err;
    await fetchData();
  };

  const remove = async (id: string) => {
    const { error: err } = await supabase
      .from('reclamaciones')
      .delete()
      .eq('id', id);
    if (err) throw err;
    await fetchData();
  };

  const uploadFoto = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: err } = await supabase.storage
      .from('reclamaciones-fotos')
      .upload(path, file, { upsert: false });
    if (err) throw err;
    const { data: pub } = supabase.storage
      .from('reclamaciones-fotos')
      .getPublicUrl(path);
    return pub.publicUrl;
  };

  return { data, loading, error, refetch: fetchData, insert, update, remove, uploadFoto };
}

// ===== Helpers de presentación =====

export const CANAL_LABELS: Record<Canal, string> = {
  uber_eats: 'Uber Eats',
  glovo: 'Glovo',
  just_eat: 'Just Eat',
  web: 'Web',
  directo: 'Directo',
};

export const TIPO_LABELS: Record<TipoReclamacion, string> = {
  producto_faltante: 'Prod. faltante',
  producto_erroneo: 'Prod. erróneo',
  mala_calidad: 'Mala calidad',
  pedido_cancelado: 'Ped. cancelado',
  cobro_incorrecto: 'Cobro incorrecto',
  otro: 'Otro',
};

export const ESTADO_LABELS: Record<EstadoReclamacion, { full: string; short: string }> = {
  pendiente: { full: 'Pendiente', short: 'Pend.' },
  reclamada: { full: 'Reclamada', short: 'Recl.' },
  cobrada:   { full: 'Cobrada',   short: 'Cobr.' },
  rechazada: { full: 'Rechazada', short: 'Rech.' },
};

// ===== Métricas agregadas =====

export function computeMetricas(rows: Reclamacion[]) {
  const abiertas = rows.filter(r => r.estado === 'pendiente' || r.estado === 'reclamada');
  const enRiesgo = abiertas.reduce((s, r) => s + Number(r.importe_reclamado), 0);
  const cobradas = rows.filter(r => r.estado === 'cobrada');
  const cobrado = cobradas.reduce((s, r) => s + Number(r.importe_compensado), 0);
  const rechazadas = rows.filter(r => r.estado === 'rechazada');
  const perdido = rechazadas.reduce((s, r) => s + Number(r.importe_reclamado), 0);
  const totalReclamado = rows.reduce((s, r) => s + Number(r.importe_reclamado), 0);
  const resueltas = cobradas.length + rechazadas.length;
  const tasaResolucion = resueltas > 0 ? Math.round((cobradas.length / resueltas) * 100) : 0;

  return {
    abiertas: abiertas.length,
    enRiesgo,
    pendientes: rows.filter(r => r.estado === 'pendiente').length,
    reclamadas: rows.filter(r => r.estado === 'reclamada').length,
    cobradas: cobradas.length,
    rechazadas: rechazadas.length,
    cobrado,
    perdido,
    totalReclamado,
    tasaResolucion,
  };
}

export function computeMetricasPorCanal(rows: Reclamacion[], canal: Canal) {
  const sub = rows.filter(r => r.canal === canal);
  const enRiesgo = sub
    .filter(r => r.estado === 'pendiente' || r.estado === 'reclamada')
    .reduce((s, r) => s + Number(r.importe_reclamado), 0);
  const cobrado = sub
    .filter(r => r.estado === 'cobrada')
    .reduce((s, r) => s + Number(r.importe_compensado), 0);
  const cobradas = sub.filter(r => r.estado === 'cobrada').length;
  const rechazadas = sub.filter(r => r.estado === 'rechazada').length;
  const resueltas = cobradas + rechazadas;
  const tasa = resueltas > 0 ? Math.round((cobradas / resueltas) * 100) : null;
  return { count: sub.length, enRiesgo, cobrado, tasa };
}
