/**
 * impresionEnvio — cliente ÚNICO del endpoint de impresión remota
 * (/api/papeleo/imprimir → Brevo → Epson de la cocina).
 * Nadie más en el repo llama a ese endpoint ni a Brevo (criterio 3 del handoff).
 */
import type { jsPDF } from 'jspdf'
import { supabase } from '@/lib/supabase'

export interface PreferenciasDoc {
  documento_id: string
  nombre: string
  area: 'cocina' | 'finanzas' | 'equipo' | 'operaciones'
  tinta: 'bn' | 'color'
  orientacion: 'vertical' | 'apaisado'
  copias: number
  activo: boolean
}

/** Defaults del handoff §3.3 si el documento no tiene fila. */
export function preferenciasPorDefecto(documentoId: string, nombre?: string): PreferenciasDoc {
  return {
    documento_id: documentoId,
    nombre: nombre || documentoId,
    area: 'cocina',
    tinta: 'bn',
    orientacion: 'vertical',
    copias: 1,
    activo: true,
  }
}

/** Lee las preferencias del documento (o defaults si no hay fila). */
export async function cargarPreferencias(documentoId: string, nombre?: string): Promise<PreferenciasDoc> {
  const { data } = await supabase
    .from('impresion_preferencias')
    .select('documento_id, nombre, area, tinta, orientacion, copias, activo')
    .eq('documento_id', documentoId)
    .maybeSingle()
  return (data as PreferenciasDoc | null) ?? preferenciasPorDefecto(documentoId, nombre)
}

export interface ResultadoEnvio {
  ok: boolean
  messageId?: string
  error?: string
}

/** Serializa el jsPDF y lo manda a la impresora del local vía el endpoint. */
export async function enviarAlLocal(opts: {
  doc: jsPDF
  documentoId: string
  nombre: string
  nombreArchivo: string
  copias: number
  usuario?: string | null
}): Promise<ResultadoEnvio> {
  const pdfBase64 = btoa(opts.doc.output())
  try {
    const r = await fetch('/api/papeleo/imprimir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentoId: opts.documentoId,
        nombre: opts.nombre,
        pdfBase64,
        nombreArchivo: opts.nombreArchivo,
        copias: opts.copias,
        usuario: opts.usuario || null,
      }),
    })
    const json = (await r.json().catch(() => ({}))) as ResultadoEnvio
    if (json.ok) return json
    return { ok: false, error: json.error || `Error ${r.status} al enviar a la impresora` }
  } catch (err) {
    return { ok: false, error: 'Error de red: ' + (err as Error).message }
  }
}
