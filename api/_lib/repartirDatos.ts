// repartirDatos.ts — REPARTO DE DATOS POR DESTINO (Prompt 2, task 3).
//
// El diccionario NIF declara en `destinos_datos` (text[]) a qué subsistemas debe
// fluir la información de cada proveedor. Valores reales en producción:
//   Gestoria, OCR, Conciliacion  → pipeline por defecto (ya lo cubre procesarArchivo)
//   Running, IVA, Facturacion    → destinos específicos
// Esta función LEE ese reparto declarado y lo ejecuta. Los destinos del pipeline
// por defecto no requieren acción extra. Los destinos específicos sin handler
// automático se registran como aviso (nada se pierde en silencio); un destino no
// reconocido genera aviso 'destino_desconocido'.
//
// DECISIÓN AUTÓNOMA (RULES §8): la ingesta concreta a las tablas de negocio
// (nominas, running, facturacion) NO se hace a ciegas desde una factura porque
// cambiaría datos de negocio sin esquema confirmado. En su lugar se deja un aviso
// accionable por destino específico. Cuando se definan los handlers, se registran
// en HANDLERS y dejan de avisar.

import type { SupabaseClient } from '@supabase/supabase-js'

// Destinos que YA cubre el flujo normal de procesarArchivo (no requieren acción).
const DESTINOS_PIPELINE_DEFAULT = new Set(['gestoria', 'ocr', 'conciliacion'])
// Destinos reconocidos pero cuyo handler automático aún no existe → aviso.
const DESTINOS_PENDIENTE_HANDLER = new Set(['running', 'iva', 'facturacion', 'nominas', 'suministros'])

export interface RepartoDecision {
  cubiertos: string[]      // destinos ya cubiertos por el pipeline por defecto
  pendientes: string[]     // destinos reconocidos sin handler automático
  desconocidos: string[]   // destinos que no se reconocen
}

// Función PURA: clasifica los destinos declarados. Testeable sin BD.
export function decidirDestinos(destinos: (string | null | undefined)[] | null | undefined): RepartoDecision {
  const cubiertos: string[] = [], pendientes: string[] = [], desconocidos: string[] = []
  for (const raw of destinos || []) {
    const d = (raw || '').toString().trim().toLowerCase()
    if (!d) continue
    if (DESTINOS_PIPELINE_DEFAULT.has(d)) cubiertos.push(d)
    else if (DESTINOS_PENDIENTE_HANDLER.has(d)) pendientes.push(d)
    else desconocidos.push(d)
  }
  return { cubiertos, pendientes, desconocidos }
}

function errMsg(e: unknown): string { return e instanceof Error ? e.message : String(e) }

// Lee destinos_datos de la ficha del proveedor de la factura y ejecuta el reparto.
// Invocada al final de procesarArchivo y desde el barrido de pendientes.
export async function repartirDatosDocumento(
  supabase: SupabaseClient, facturaId: string,
): Promise<RepartoDecision> {
  const vacio: RepartoDecision = { cubiertos: [], pendientes: [], desconocidos: [] }
  try {
    const { data: fac } = await supabase.from('facturas')
      .select('id, nif_emisor, proveedor_nombre').eq('id', facturaId).maybeSingle()
    const nif = (fac?.nif_emisor as string) || null
    if (!nif) return vacio
    const { data: ficha } = await supabase.from('diccionario_nif_proveedor')
      .select('destinos_datos').eq('nif', nif).maybeSingle()
    const destinos = (ficha?.destinos_datos as string[] | null) || null
    const decision = decidirDestinos(destinos)

    for (const d of decision.pendientes) {
      await supabase.from('avisos_papeleo').insert({
        tipo: 'destino_pendiente',
        titulo: `Destino '${d}' declarado sin handler automático`,
        detalle: `El proveedor ${fac?.proveedor_nombre || nif} declara el destino '${d}' en destinos_datos, pero aún no hay ingesta automática a esa tabla. Revisar manualmente.`,
        estado: 'abierto', factura_id: facturaId,
        payload: { nif, destino: d },
      })
    }
    for (const d of decision.desconocidos) {
      await supabase.from('avisos_papeleo').insert({
        tipo: 'destino_desconocido',
        titulo: `Destino '${d}' no reconocido`,
        detalle: `El proveedor ${fac?.proveedor_nombre || nif} declara un destino '${d}' que no corresponde a ningún handler conocido.`,
        estado: 'abierto', factura_id: facturaId,
        payload: { nif, destino: d },
      })
    }
    return decision
  } catch (e) { console.error('[repartirDatosDocumento]', errMsg(e)); return vacio }
}
