import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'crypto'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { extraerDatosFactura } from '../_lib/ocr.js'
import { matchingGastos } from '../_lib/matching.js'
import { subirPdfADrive, generarNombreArchivo } from '../_lib/google-drive.js'

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
  maxDuration: 60,
}

type UploadBody = {
  nombre: string
  base64: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body as UploadBody
    if (!body?.base64 || !body?.nombre) {
      return res.status(400).json({ error: 'Falta base64 o nombre' })
    }

    const buffer = Buffer.from(body.base64, 'base64')
    const hash = createHash('sha256').update(buffer).digest('hex')

    // Dedup por hash
    const { data: existente } = await supabaseAdmin
      .from('facturas')
      .select('id, numero_factura, proveedor_nombre, total, estado')
      .eq('pdf_hash', hash)
      .maybeSingle()

    if (existente) {
      return res.status(200).json({
        estado: 'duplicada',
        factura_existente: existente,
        archivo: body.nombre,
      })
    }

    // Crear registro con estado 'procesando'
    const tempNum = `TEMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const { data: nueva, error: errInsert } = await supabaseAdmin
      .from('facturas')
      .insert({
        pdf_original_name: body.nombre,
        pdf_hash: hash,
        proveedor_nombre: 'Procesando...',
        numero_factura: tempNum,
        fecha_factura: new Date().toISOString().slice(0, 10),
        total: 0,
        estado: 'procesando',
      })
      .select()
      .single()

    if (errInsert || !nueva) {
      return res.status(500).json({ error: errInsert?.message || 'No se pudo crear factura' })
    }

    try {
      const extracted = await extraerDatosFactura(body.base64)

      // Matching proveedor (case-insensitive, prefijo 20 chars)
      const provQuery = extracted.proveedor_nombre.slice(0, 20)
      const { data: proveedor } = await supabaseAdmin
        .from('proveedores')
        .select('id')
        .ilike('nombre', `%${provQuery}%`)
        .maybeSingle()

      // Check duplicado proveedor+numero
      if (proveedor?.id) {
        const { data: duplicadoNum } = await supabaseAdmin
          .from('facturas')
          .select('id')
          .eq('proveedor_id', proveedor.id)
          .eq('numero_factura', extracted.numero_factura)
          .neq('id', nueva.id)
          .maybeSingle()
        if (duplicadoNum) {
          await supabaseAdmin.from('facturas').delete().eq('id', nueva.id)
          return res.status(200).json({
            estado: 'duplicada',
            factura_existente: duplicadoNum,
            archivo: body.nombre,
            motivo: 'proveedor+numero',
          })
        }
      }

      let proveedorId = proveedor?.id
      if (!proveedorId && extracted.proveedor_nombre) {
        const { data: nuevoProv } = await supabaseAdmin
          .from('proveedores')
          .insert({ nombre: extracted.proveedor_nombre, activo: true })
          .select('id')
          .single()
        proveedorId = nuevoProv?.id
      }

      await supabaseAdmin
        .from('facturas')
        .update({
          proveedor_id: proveedorId,
          proveedor_nombre: extracted.proveedor_nombre,
          numero_factura: extracted.numero_factura,
          fecha_factura: extracted.fecha_factura,
          es_recapitulativa: extracted.es_recapitulativa,
          periodo_inicio: extracted.periodo_inicio,
          periodo_fin: extracted.periodo_fin,
          tipo: extracted.tipo,
          plataforma: extracted.plataforma,
          base_4: extracted.base_4,
          iva_4: extracted.iva_4,
          base_10: extracted.base_10,
          iva_10: extracted.iva_10,
          base_21: extracted.base_21,
          iva_21: extracted.iva_21,
          total: extracted.total,
          ocr_confianza: extracted.confianza,
          ocr_raw: extracted,
          estado: 'pendiente_revision',
        })
        .eq('id', nueva.id)

      if (extracted.tipo === 'plataforma' && extracted.plataforma_detalle?.length) {
        for (const det of extracted.plataforma_detalle) {
          const { data: marca } = await supabaseAdmin
            .from('marcas')
            .select('id')
            .ilike('nombre', `%${det.marca_nombre}%`)
            .maybeSingle()
          await supabaseAdmin.from('facturas_plataforma_detalle').insert({
            factura_id: nueva.id,
            marca_id: marca?.id ?? null,
            marca_nombre: det.marca_nombre,
            pedidos: det.pedidos,
            ventas_brutas: det.ventas_brutas,
            comision: det.comision,
            comision_iva: det.comision_iva,
            fee_fijo: det.fee_fijo,
            ads: det.ads,
            promos_cubiertas: det.promos_cubiertas,
            neto_liquidado: det.neto_liquidado,
            periodo_inicio: det.periodo_inicio,
            periodo_fin: det.periodo_fin,
          })
        }
      }

      const resultadoMatch = await matchingGastos(nueva.id, extracted, supabaseAdmin)

      // Nombre + subida Drive
      const inicioMes = new Date(extracted.fecha_factura)
      inicioMes.setDate(1)
      const finMes = new Date(inicioMes)
      finMes.setMonth(finMes.getMonth() + 1)
      finMes.setDate(0)
      const { count } = await supabaseAdmin
        .from('facturas')
        .select('id', { count: 'exact', head: true })
        .ilike('proveedor_nombre', `%${extracted.proveedor_nombre}%`)
        .gte('fecha_factura', inicioMes.toISOString().slice(0, 10))
        .lte('fecha_factura', finMes.toISOString().slice(0, 10))

      const nombreArchivo = await generarNombreArchivo(extracted, count || 0)
      try {
        const drive = await subirPdfADrive(buffer, nombreArchivo, extracted)
        await supabaseAdmin
          .from('facturas')
          .update({
            pdf_drive_id: drive.id,
            pdf_drive_url: drive.webViewLink,
            estado: resultadoMatch,
          })
          .eq('id', nueva.id)
      } catch (driveErr) {
        const msg = driveErr instanceof Error ? driveErr.message : 'Drive error'
        await supabaseAdmin
          .from('facturas')
          .update({
            error_mensaje: `Drive: ${msg}`,
            estado: resultadoMatch,
          })
          .eq('id', nueva.id)
      }

      const { data: finalFac } = await supabaseAdmin
        .from('facturas')
        .select('*')
        .eq('id', nueva.id)
        .single()

      return res.status(200).json({
        estado: 'ok',
        factura: finalFac,
        archivo: body.nombre,
      })
    } catch (ocrErr) {
      const msg = ocrErr instanceof Error ? ocrErr.message : 'OCR error'
      await supabaseAdmin
        .from('facturas')
        .update({ estado: 'error', error_mensaje: msg })
        .eq('id', nueva.id)
      return res.status(200).json({
        estado: 'error',
        id: nueva.id,
        error: msg,
        archivo: body.nombre,
      })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: msg })
  }
}
