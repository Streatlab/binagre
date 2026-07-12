// _puertas/nominas-id-action.ts — acciones sobre una nómina concreta.
// (vive en _puertas: la puerta /api/operaciones rellena req.query.id y
// req.query.action desde la ruta /api/nominas/:id/:action)
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { sugerirCandidatos, sugerirCombinacion, type NominaParaMatch } from '../_lib/matchNomina.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id || '')
  const action = String(req.query.action || '')
  if (!id) return res.status(400).json({ error: 'Falta id' })

  switch (action) {
    case 'sugerir-matches':
      // Solo lectura: se acepta GET o POST indistintamente.
      if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
      return sugerirMatches(res, id)
    case 'asociar-pago':
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
      return asociarPago(req, res, id)
    case 'desasociar-pago':
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
      return desasociarPago(req, res, id)
    case 'confirmar-pago':
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
      return confirmarPago(req, res, id)
    default:
      return res.status(404).json({ error: `Acción desconocida: ${action}` })
  }
}

interface NominaConEmpleadoRow {
  id: string
  mes: number
  anio: number
  importe_neto: number | null
  empleado_id: string
  empleados: { nombre: string } | { nombre: string }[] | null
}

function nombreDeEmpleadoJoin(v: NominaConEmpleadoRow['empleados']): string {
  if (!v) return ''
  if (Array.isArray(v)) return v[0]?.nombre ?? ''
  return v.nombre ?? ''
}

async function sugerirMatches(res: VercelResponse, id: string) {
  const { data, error } = await supabaseAdmin
    .from('nominas')
    .select('id, mes, anio, importe_neto, empleado_id, empleados(nombre)')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return res.status(404).json({ error: error?.message || 'Nómina no encontrada' })

  const nomina = data as unknown as NominaConEmpleadoRow
  const { data: aliasRows } = await supabaseAdmin
    .from('empleado_alias')
    .select('alias')
    .eq('empleado_id', nomina.empleado_id)
  const nominaInput: NominaParaMatch = {
    id: nomina.id,
    empleado_nombre: nombreDeEmpleadoJoin(nomina.empleados),
    aliases: (aliasRows ?? []).map(r => r.alias as string),
    mes: nomina.mes,
    anio: nomina.anio,
    importe_neto: nomina.importe_neto != null ? Number(nomina.importe_neto) : null,
  }

  const [individuales, combinaciones] = await Promise.all([
    sugerirCandidatos(supabaseAdmin, nominaInput),
    sugerirCombinacion(supabaseAdmin, nominaInput),
  ])

  return res.status(200).json({ individuales, combinaciones })
}

async function asociarPago(req: VercelRequest, res: VercelResponse, id: string) {
  const body = (req.body || {}) as {
    conciliacion_id?: string
    importe_asociado?: number
    confirmado?: boolean
    confianza_match?: number
  }
  if (!body.conciliacion_id) return res.status(400).json({ error: 'Falta conciliacion_id' })
  if (body.importe_asociado == null) return res.status(400).json({ error: 'Falta importe_asociado' })

  const fila = {
    nomina_id: id,
    conciliacion_id: body.conciliacion_id,
    importe_asociado: Math.abs(Number(body.importe_asociado)),
    confirmado: body.confirmado ?? false,
    confianza_match: body.confianza_match ?? null,
  }
  const { error } = await supabaseAdmin.from('nominas_pagos').upsert(fila, { onConflict: 'nomina_id,conciliacion_id' })
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}

async function desasociarPago(req: VercelRequest, res: VercelResponse, id: string) {
  const body = (req.body || {}) as { conciliacion_id?: string }
  if (!body.conciliacion_id) return res.status(400).json({ error: 'Falta conciliacion_id' })

  const { error } = await supabaseAdmin
    .from('nominas_pagos')
    .delete()
    .eq('nomina_id', id)
    .eq('conciliacion_id', body.conciliacion_id)
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}

async function confirmarPago(req: VercelRequest, res: VercelResponse, id: string) {
  const body = (req.body || {}) as { conciliacion_id?: string }
  if (!body.conciliacion_id) return res.status(400).json({ error: 'Falta conciliacion_id' })

  const { error } = await supabaseAdmin
    .from('nominas_pagos')
    .update({ confirmado: true })
    .eq('nomina_id', id)
    .eq('conciliacion_id', body.conciliacion_id)
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
