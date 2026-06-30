/**
 * Servicios de guardado en Supabase — Fases 2, 3 y 4
 */

import { supabase } from '../supabase';
import type { VentaPlato } from './parserUberArticulos';
import type { VentaFranja } from './parserSinqroSoldProducts';
import type { ResumenPlataforma } from './parserRushourPlataformas';
import type { SerieDiaria } from './parserRushourIngresos';
import type { MetricasClientes } from './parserGlovoClientes';

export interface ResultadoGuardado {
  insertados: number;
  actualizados: number;
  errores: string[];
}

// ── FASE 2: Ventas por plato ────────────────────────────────────
// Recibe el origen para marcarlo en BD (ej: 'sincro', 'uber', etc.)
export async function guardarVentasPlato(
  datos: VentaPlato[],
  origen: string = 'real',
): Promise<ResultadoGuardado> {
  const res: ResultadoGuardado = { insertados: 0, actualizados: 0, errores: [] };
  if (!datos.length) { res.errores.push('No hay datos'); return res; }

  for (const d of datos) {
    const { data: existing } = await supabase
      .from('ventas_plato')
      .select('id, estimado')
      .eq('canal', d.canal).eq('marca', d.marca).eq('plato', d.plato)
      .eq('mes', d.mes).eq('año', d.año)
      .maybeSingle();

    const payload = {
      ...d,
      estimado: false,
      origen,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      // Pisa siempre (sea estimado o no) — dato real tiene prioridad
      const { error } = await supabase.from('ventas_plato').update(payload).eq('id', existing.id);
      if (error) res.errores.push(`Error ${d.plato}: ${error.message}`);
      else res.actualizados++;
    } else {
      const { error } = await supabase.from('ventas_plato').insert(payload);
      if (error) res.errores.push(`Error ${d.plato}: ${error.message}`);
      else res.insertados++;
    }
  }
  return res;
}

// ── FASE 2: Ventas por franja horaria ──────────────────────────
// Idempotente: upsert por (canal, marca, fecha, hora)
export async function guardarVentasFranja(datos: VentaFranja[]): Promise<ResultadoGuardado> {
  const res: ResultadoGuardado = { insertados: 0, actualizados: 0, errores: [] };
  if (!datos.length) return res;

  for (const d of datos) {
    const { data: existing } = await supabase
      .from('ventas_franja')
      .select('id')
      .eq('canal', d.canal).eq('marca', d.marca)
      .eq('fecha', d.fecha).eq('hora', d.hora)
      .maybeSingle();

    const payload = { ...d, updated_at: new Date().toISOString() };

    if (existing?.id) {
      const { error } = await supabase.from('ventas_franja').update(payload).eq('id', existing.id);
      if (error) res.errores.push(`Error franja ${d.fecha}/${d.hora}h: ${error.message}`);
      else res.actualizados++;
    } else {
      const { error } = await supabase.from('ventas_franja').insert(payload);
      if (error) res.errores.push(`Error franja ${d.fecha}/${d.hora}h: ${error.message}`);
      else res.insertados++;
    }
  }
  return res;
}

// ── FASE 2: Resumen plataformas Rushour ────────────────────────
export async function guardarResumenPlataformas(datos: ResumenPlataforma[]): Promise<ResultadoGuardado> {
  const res: ResultadoGuardado = { insertados: 0, actualizados: 0, errores: [] };
  if (!datos.length) { res.errores.push('No hay datos'); return res; }

  for (const d of datos) {
    const { data: existing } = await supabase
      .from('resumen_plataformas')
      .select('id')
      .eq('canal', d.canal).eq('marca', d.marca)
      .eq('mes', d.mes).eq('año', d.año)
      .maybeSingle();

    const payload = { ...d, updated_at: new Date().toISOString() };

    if (existing?.id) {
      const { error } = await supabase.from('resumen_plataformas').update(payload).eq('id', existing.id);
      if (error) res.errores.push(`Error ${d.canal}/${d.marca}: ${error.message}`);
      else res.actualizados++;
    } else {
      const { error } = await supabase.from('resumen_plataformas').insert(payload);
      if (error) res.errores.push(`Error ${d.canal}/${d.marca}: ${error.message}`);
      else res.insertados++;
    }
  }
  return res;
}

// ── FASE 3: Serie diaria Rushour ───────────────────────────────
export async function guardarSerieDiaria(datos: SerieDiaria[]): Promise<ResultadoGuardado> {
  const res: ResultadoGuardado = { insertados: 0, actualizados: 0, errores: [] };
  if (!datos.length) { res.errores.push('No hay datos'); return res; }

  for (const d of datos) {
    const { data: existing } = await supabase
      .from('serie_diaria_rushour')
      .select('id')
      .eq('fecha', d.fecha).eq('marca', d.marca).eq('canal', d.canal)
      .maybeSingle();

    const payload = { ...d, updated_at: new Date().toISOString() };

    if (existing?.id) {
      const { error } = await supabase.from('serie_diaria_rushour').update(payload).eq('id', existing.id);
      if (error) res.errores.push(`Error ${d.fecha}: ${error.message}`);
      else res.actualizados++;
    } else {
      const { error } = await supabase.from('serie_diaria_rushour').insert(payload);
      if (error) res.errores.push(`Error ${d.fecha}: ${error.message}`);
      else res.insertados++;
    }
  }
  return res;
}

// ── FASE 4: Clientes Glovo ─────────────────────────────────────
export async function guardarMetricasClientes(datos: MetricasClientes[]): Promise<ResultadoGuardado> {
  const res: ResultadoGuardado = { insertados: 0, actualizados: 0, errores: [] };
  if (!datos.length) { res.errores.push('No hay datos'); return res; }

  for (const d of datos) {
    const { data: existing } = await supabase
      .from('metricas_clientes_glovo')
      .select('id')
      .eq('marca', d.marca).eq('mes', d.mes).eq('año', d.año)
      .maybeSingle();

    const payload = { ...d, updated_at: new Date().toISOString() };

    if (existing?.id) {
      const { error } = await supabase.from('metricas_clientes_glovo').update(payload).eq('id', existing.id);
      if (error) res.errores.push(`Error ${d.marca}: ${error.message}`);
      else res.actualizados++;
    } else {
      const { error } = await supabase.from('metricas_clientes_glovo').insert(payload);
      if (error) res.errores.push(`Error ${d.marca}: ${error.message}`);
      else res.insertados++;
    }
  }
  return res;
}
