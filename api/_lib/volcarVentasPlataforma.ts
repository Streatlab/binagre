// volcarVentasPlataforma — Punto único que conecta los documentos de plataforma con
// las calculadoras. Lo llama procesarArchivo ANTES de tratar nada como factura:
//   · Just Eat: archivo .doc (HTML) de factura  → ventas_plataforma
//   · Glovo: ZIP de liquidación (xlsx + pdf)     → ventas_plataforma + estadisticas_prime_promo
// El ratio neto real se aprende de ventas_plataforma; el % Prime/Promo del trigger
// sobre estadisticas_prime_promo. Idempotente: re-subir el mismo documento no duplica.
import JSZip from 'jszip'
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseFacturaJustEat, type VentaPlataformaParseada } from './parserJustEatFactura.js'
import { parseLiquidacionGlovo } from './parserGlovoLiquidacion.js'
import { extraerTextoPDF } from './extractores.js'
import type { ProcesarResultado, ArchivoEntrada } from './procesarArchivo.js'

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Mapea el nombre de tienda/local crudo a una marca canónica de la tabla `marcas`.
// Devuelve el nombre canónico, o null si ninguna marca casa (no se inventa).
async function mapearMarca(supabase: SupabaseClient, marcaRaw: string): Promise<string | null> {
  const { data } = await supabase.from('marcas').select('nombre')
  const marcas = (data || []) as { nombre: string }[]
  const raw = norm(marcaRaw)
  let mejor: string | null = null
  let mejorLen = 0
  for (const m of marcas) {
    const n = norm(m.nombre)
    if (n && (raw.includes(n) || n.includes(raw)) && n.length > mejorLen) {
      mejor = m.nombre; mejorLen = n.length
    }
  }
  return mejor
}

// Suma el conteo Prime/Promo de una liquidación al mes correspondiente y dispara el
// trigger que recalcula el % en config_canales. Solo se llama si la venta era NUEVA.
async function acumularPrimePromo(supabase: SupabaseClient, v: VentaPlataformaParseada): Promise<void> {
  if (v.pedidos_prime == null && v.pedidos_promo == null) return
  const canal = v.plataforma === 'glovo' ? 'glovo' : v.plataforma === 'uber' ? 'uber_eats' : null
  if (!canal) return
  const d = new Date(v.fecha_inicio_periodo)
  const anio = d.getUTCFullYear()
  const mes = d.getUTCMonth() + 1
  const prime = v.pedidos_prime || 0
  const promo = v.pedidos_promo || 0

  const { data: prev } = await supabase.from('estadisticas_prime_promo')
    .select('*').eq('canal', canal).eq('mes', mes).maybeSingle() as unknown as { data: Record<string, number> | null }
  const tot = (prev?.pedidos_total || 0) + v.pedidos
  const pr = (prev?.pedidos_prime || 0) + prime
  const po = (prev?.pedidos_promo || 0) + promo
  await supabase.from('estadisticas_prime_promo').upsert({
    canal, ['año']: anio, mes,
    pedidos_total: tot, pedidos_prime: pr, pedidos_promo: po,
    pct_prime: tot > 0 ? pr / tot : 0, pct_promo: tot > 0 ? po / tot : 0,
    fuente: 'liquidacion_' + v.plataforma,
  }, { onConflict: 'canal,año,mes' })
}

async function volcar(
  supabase: SupabaseClient, file: ArchivoEntrada, v: VentaPlataformaParseada,
): Promise<ProcesarResultado> {
  const marca = await mapearMarca(supabase, v.marcaRaw)
  const ticket = v.pedidos > 0 ? v.bruto / v.pedidos : 0
  const info = { plataforma: v.plataforma, marca: marca || v.marcaRaw,
    periodo: `${v.fecha_inicio_periodo} → ${v.fecha_fin_periodo}`,
    bruto: v.bruto, neto: v.neto, pedidos: v.pedidos }

  if (!marca) {
    return { estado: 'lectura_manual', archivo: file.nombre, tipo_documento: 'resumen_ventas',
      resumen_ventas: info, motivo: `venta ${v.plataforma}: marca no identificada ("${v.marcaRaw}")` }
  }

  const { data: existe } = await supabase.from('ventas_plataforma').select('id')
    .eq('plataforma', v.plataforma).eq('marca', marca)
    .eq('fecha_inicio_periodo', v.fecha_inicio_periodo)
    .eq('fecha_fin_periodo', v.fecha_fin_periodo).maybeSingle()

  const fila = {
    plataforma: v.plataforma, marca,
    fecha_inicio_periodo: v.fecha_inicio_periodo, fecha_fin_periodo: v.fecha_fin_periodo,
    bruto: v.bruto, neto: v.neto, pedidos: v.pedidos, ticket_medio: ticket,
    ingreso_colaborador: v.neto,
    ...(v.fecha_pago ? { fecha_pago: v.fecha_pago } : {}),
    ...(v.referencia ? { facturas_origen: [v.referencia] } : {}),
    updated_at: new Date().toISOString(),
  }

  if (existe) {
    await supabase.from('ventas_plataforma').update(fila).eq('id', (existe as { id: string }).id)
    return { estado: 'duplicada', archivo: file.nombre, tipo_documento: 'resumen_ventas',
      resumen_ventas: info, motivo: `venta ${v.plataforma} · ${marca} · ya existía, actualizada` }
  }

  await supabase.from('ventas_plataforma').insert(fila)
  await acumularPrimePromo(supabase, v) // solo en alta nueva → no duplica conteo
  return { estado: 'ok', archivo: file.nombre, tipo_documento: 'resumen_ventas',
    resumen_ventas: info, motivo: `venta ${v.plataforma} · ${marca} · registrada` }
}

// Intenta tratar el archivo como documento de ventas de plataforma. Devuelve el
// resultado si lo era; null si no (para que siga el flujo normal de factura).
export async function intentarVentaPlataforma(
  supabase: SupabaseClient, file: ArchivoEntrada, tipo: string,
): Promise<ProcesarResultado | null> {
  try {
    const ext = (file.nombre.toLowerCase().split('.').pop() || '').trim()

    // Just Eat: .doc/.docx que en realidad es HTML de factura
    if (ext === 'doc' || ext === 'docx' || tipo === 'word') {
      const html = file.buffer.toString('utf8')
      if (/just\s*eat/i.test(html)) {
        const v = parseFacturaJustEat(html)
        if (v) return await volcar(supabase, file, v)
      }
    }

    // Glovo: ZIP de liquidación con xlsx + pdf
    if (ext === 'zip') {
      const zip = await JSZip.loadAsync(file.buffer)
      let xlsxBuf: Buffer | null = null
      let pdfBuf: Buffer | null = null
      for (const name of Object.keys(zip.files)) {
        if (/\.xlsx$/i.test(name)) xlsxBuf = Buffer.from(await zip.files[name].async('nodebuffer'))
        if (/\.pdf$/i.test(name)) pdfBuf = Buffer.from(await zip.files[name].async('nodebuffer'))
      }
      if (xlsxBuf && pdfBuf) {
        const pdfTexto = await extraerTextoPDF(pdfBuf)
        const v = parseLiquidacionGlovo(xlsxBuf, pdfTexto)
        if (v) return await volcar(supabase, file, v)
      }
    }
  } catch (e) {
    console.error('[intentarVentaPlataforma] fallo:', (e as Error)?.message)
  }
  return null
}
