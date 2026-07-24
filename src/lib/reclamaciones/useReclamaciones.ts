// =============================================================
// Hook useReclamaciones - CRUD + upload de fotos al storage
// =============================================================
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase';

export type Canal = 'uber_eats' | 'glovo' | 'just_eat' | 'web' | 'directo';
export type EstadoReclamacion =
  | 'pendiente' | 'devuelto' | 'reclamada' | 'aprobada' | 'cobrada' | 'cobrada_doble' | 'rechazada' | 'incobrable';
export type TipoReclamacion =
  | 'producto_faltante' | 'producto_erroneo' | 'mala_calidad'
  | 'pedido_cancelado' | 'cobro_incorrecto' | 'otro';
export type CausaReclamacion = 'cocina' | 'plataforma' | 'rider' | 'cliente' | 'desconocida';

// Plazo orientativo para reclamar a la plataforma desde la fecha del pedido.
// 14 días como margen seguro común a Uber/Glovo/Just Eat.
export const PLAZO_RECLAMO_DIAS = 14;

export function diasRestantesReclamo(fechaPedido: string): number {
  const f = new Date(fechaPedido + 'T00:00:00');
  const limite = f.getTime() + PLAZO_RECLAMO_DIAS * 86400000;
  return Math.ceil((limite - Date.now()) / 86400000);
}

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
  fecha_incobrable: string | null;
  foto_url: string | null;
  factura_cobro_periodo: string | null;
  factura_descuento_id: string | null;
  factura_cobro_id: string | null;
  resolucion_notas: string | null;
  pedido_plataforma_id: string | null;
  factura_origen_ref: string | null;
  pedido_verificado: boolean | null;
  causa: CausaReclamacion;
  cliente_nombre: string | null;
  detectado_por: string;
  fecha_deteccion_devolucion: string | null;
  aviso_visto: boolean | null;
  // nº de facturas del canal llegadas después de reclamar sin traer el cobro
  facturas_revisadas: number;
}

// Resultado de verificar un pedido en pedidos_plataforma
export interface PedidoVerificado {
  encontrado: boolean;
  plataforma: string | null;
  marca: string | null;
  fecha: string | null;
  factura_origen: string | null;
  importe_pedido: number | null;
}

// Busca el pedido por su código entre los pedidos reales de plataforma.
export async function verificarPedido(ref: string): Promise<PedidoVerificado> {
  const clean = ref.trim().replace(/^#/, '');
  if (!clean) return { encontrado: false, plataforma: null, marca: null, fecha: null, factura_origen: null, importe_pedido: null };
  const { data, error } = await supabase.rpc('fn_buscar_pedido_reembolso', { p_ref: clean });
  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    return { encontrado: false, plataforma: null, marca: null, fecha: null, factura_origen: null, importe_pedido: null };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    encontrado: true,
    plataforma: row.plataforma ?? null,
    marca: row.marca ?? null,
    fecha: row.fecha ?? null,
    factura_origen: row.factura_origen ?? null,
    importe_pedido: row.importe_pedido ?? null,
  };
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

  const marcarAvisoVisto = async (id: string) => {
    const { error: err } = await supabase
      .from('reclamaciones')
      .update({ aviso_visto: true })
      .eq('id', id);
    if (err) throw err;
    await fetchData();
  };

  return { data, loading, error, refetch: fetchData, insert, update, remove, uploadFoto, marcarAvisoVisto };
}

// ===== Reembolsos pendientes por canal (para Facturación) =====

export interface ReembolsoPendienteCanal {
  canal: Canal;
  num_pendientes: number;
  importe_pendiente: number;
}

export async function fetchReembolsosPendientes(): Promise<ReembolsoPendienteCanal[]> {
  const { data, error } = await supabase
    .from('v_reembolsos_pendientes')
    .select('*');
  if (error) throw error;
  return (data as ReembolsoPendienteCanal[]) || [];
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
  pendiente:     { full: 'Pendiente',      short: 'Pend.' },
  devuelto:      { full: 'Detectado',      short: 'Detect.' },
  reclamada:     { full: 'Reclamada',      short: 'Recl.' },
  aprobada:      { full: 'Aprobada',       short: 'Aprob.' },
  cobrada:       { full: 'Cobrada',        short: 'Cobr.' },
  cobrada_doble: { full: 'Cobrada doble',  short: '2x' },
  rechazada:     { full: 'Rechazada',      short: 'Rech.' },
  incobrable:    { full: 'Incobrable',     short: 'Incob.' },
};

export const CAUSA_LABELS: Record<CausaReclamacion, string> = {
  cocina: 'Error de cocina',
  plataforma: 'Fallo de plataforma',
  rider: 'Fallo del rider',
  cliente: 'Abuso del cliente',
  desconocida: 'Sin determinar',
};

// ===== Métricas agregadas =====

const ESTADOS_ABIERTOS: EstadoReclamacion[] = ['pendiente', 'devuelto', 'reclamada', 'aprobada'];

export function computeMetricas(rows: Reclamacion[]) {
  const abiertas = rows.filter(r => ESTADOS_ABIERTOS.includes(r.estado));
  const enRiesgo = abiertas.reduce((s, r) => s + Number(r.importe_reclamado), 0);
  const cobradas = rows.filter(r => r.estado === 'cobrada' || r.estado === 'cobrada_doble');
  const cobrado = cobradas.reduce((s, r) => s + Number(r.importe_compensado), 0);
  const dobles = rows.filter(r => r.estado === 'cobrada_doble');
  const extraDoble = dobles.reduce((s, r) => s + (Number(r.importe_compensado) - Number(r.importe_reclamado)), 0);
  const perdidas = rows.filter(r => r.estado === 'rechazada' || r.estado === 'incobrable');
  const perdido = perdidas.reduce((s, r) => s + Number(r.importe_reclamado), 0);
  const totalReclamado = rows.reduce((s, r) => s + Number(r.importe_reclamado), 0);
  const resueltas = cobradas.length + perdidas.length;
  const tasaResolucion = resueltas > 0 ? Math.round((cobradas.length / resueltas) * 100) : 0;

  return {
    abiertas: abiertas.length,
    enRiesgo,
    pendientes: rows.filter(r => r.estado === 'pendiente' || r.estado === 'devuelto').length,
    detectadas: rows.filter(r => r.estado === 'devuelto').length,
    reclamadas: rows.filter(r => r.estado === 'reclamada').length,
    aprobadas: rows.filter(r => r.estado === 'aprobada').length,
    avisosNuevos: rows.filter(r => r.estado === 'devuelto' && r.aviso_visto === false).length,
    cobradas: cobradas.length,
    dobles: dobles.length,
    extraDoble,
    rechazadas: rows.filter(r => r.estado === 'rechazada').length,
    incobrables: rows.filter(r => r.estado === 'incobrable').length,
    cobrado,
    perdido,
    totalReclamado,
    tasaResolucion,
  };
}

export function computeMetricasPorCanal(rows: Reclamacion[], canal: Canal) {
  const sub = rows.filter(r => r.canal === canal);
  const enRiesgo = sub
    .filter(r => ESTADOS_ABIERTOS.includes(r.estado))
    .reduce((s, r) => s + Number(r.importe_reclamado), 0);
  const cobrado = sub
    .filter(r => r.estado === 'cobrada' || r.estado === 'cobrada_doble')
    .reduce((s, r) => s + Number(r.importe_compensado), 0);
  const cobradas = sub.filter(r => r.estado === 'cobrada' || r.estado === 'cobrada_doble').length;
  const perdidas = sub.filter(r => r.estado === 'rechazada' || r.estado === 'incobrable').length;
  const resueltas = cobradas + perdidas;
  const tasa = resueltas > 0 ? Math.round((cobradas / resueltas) * 100) : null;
  return { count: sub.length, enRiesgo, cobrado, tasa };
}
