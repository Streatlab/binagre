// _puertas/nominas-barrido.ts — barrido automático de cruce nómina↔banco.
// Reutiliza el motor existente (matchNomina.ts, sin bajar sus umbrales) para
// asociar y CONFIRMAR automáticamente solo los pagos de alta confianza (>=70,
// el mismo umbral que ya usaba la UI para pintar en verde). Nunca toca una
// nómina que ya tiene un pago confirmado. Pensado para dispararse al abrir
// Costes (vive en _puertas: se sirve a través de la puerta /api/operaciones).
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { sugerirCandidatos, type NominaParaMatch } from '../_lib/matchNomina.js'

const UMBRAL_ALTA_CONFIANZA = 70

interface NominaRow {
  id: string
  mes: number
  anio: number
  importe_neto: number | null
  empleado_id: string
  empleados: { nombre: string } | { nombre: string }[] | null
}

function nombreDeEmpleadoJoin(v: NominaRow['empleados']): string {
  if (!v) return ''
  if (Array.isArray(v)) return v[0]?.nombre ?? ''
  return v.nombre ?? ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const anio = Number(req.body?.anio) || new Date().getFullYear()

  const { data: nominasData, error } = await supabaseAdmin
    .from('nominas')
    .select('id, mes, anio, importe_neto, empleado_id, empleados(nombre)')
    .eq('anio', anio)
  if (error) return res.status(500).json({ error: error.message })

  const { data: pagosConfirmados } = await supabaseAdmin
    .from('nominas_pagos')
    .select('nomina_id')
    .eq('confirmado', true)
  const idsConPagoConfirmado = new Set((pagosConfirmados ?? []).map(p => p.nomina_id as string))

  const pendientes = ((nominasData ?? []) as unknown as NominaRow[]).filter(n => !idsConPagoConfirmado.has(n.id))

  const asociadas: Array<{ nomina_id: string; empleado: string; mes: number; anio: number; conciliacion_id: string; importe: number; confianza: number }> = []

  for (const n of pendientes) {
    const { data: aliasRows } = await supabaseAdmin.from('empleado_alias').select('alias').eq('empleado_id', n.empleado_id)
    const nominaInput: NominaParaMatch = {
      id: n.id,
      empleado_nombre: nombreDeEmpleadoJoin(n.empleados),
      aliases: (aliasRows ?? []).map(r => r.alias as string),
      mes: n.mes,
      anio: n.anio,
      importe_neto: n.importe_neto != null ? Number(n.importe_neto) : null,
    }
    const candidatos = await sugerirCandidatos(supabaseAdmin, nominaInput)
    const mejor = candidatos[0]
    if (!mejor || mejor.confianza < UMBRAL_ALTA_CONFIANZA) continue

    const { error: errUp } = await supabaseAdmin.from('nominas_pagos').upsert({
      nomina_id: n.id,
      conciliacion_id: mejor.conciliacion_id,
      importe_asociado: Math.abs(mejor.importe),
      confirmado: true,
      confianza_match: mejor.confianza,
    }, { onConflict: 'nomina_id,conciliacion_id' })
    if (errUp) continue

    asociadas.push({
      nomina_id: n.id, empleado: nominaInput.empleado_nombre, mes: n.mes, anio: n.anio,
      conciliacion_id: mejor.conciliacion_id, importe: mejor.importe, confianza: mejor.confianza,
    })
  }

  return res.status(200).json({ ok: true, revisadas: pendientes.length, asociadas })
}
