// volcarVentasPlataforma — Punto único que conecta los documentos de plataforma con
// las calculadoras. Lo llama procesarArchivo ANTES de tratar nada como factura:
//   · Just Eat: archivo .doc (HTML) de factura  → ventas_plataforma
//   · Glovo: ZIP de liquidación (xlsx + pdf)     → ventas_plataforma + estadisticas_prime_promo
//   · Uber: PDF mensual U1 o CSV emea U2          → ventas_plataforma (neto real + desglose)
// El ratio neto real se aprende de ventas_plataforma; el % Prime/Promo del trigger
// sobre estadisticas_prime_promo. Idempotente: re-subir el mismo documento no duplica.
//
// REGLA ANTI-DUPLICADO UBER (§3.3):
//   Para (marca, plataforma), si ya existe un registro cuyo periodo CONTIENE
//   el periodo entrante, se descarta el nuevo (el mensual ya cubre esas semanas).
//   Si el nuevo periodo CONTIENE registros previos parciales, los reemplaza (upsert).

import JSZip from 'jszip'
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseFacturaJustEat, type VentaPlataformaParseada } from './parserJustEatFactura.js'
import { parseLiquidacionGlovo } from './parserGlovoLiquidacion.js'
import { parseUberResumenMensual, type UberResumenParseado } from './parserUberResumenMensual.js'
import { parseUberResumenGanancias, emeaAVentas } from './parserUberResumenGanancias.js'
import { extraerTextoPDF } from './extractores.js'
import type { ProcesarResultado, ArchivoEntrada } from './procesarArchivo.js'

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Mapea el nombre de tienda/local crudo a una marca canónica de la tabla `marcas`.
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

// Suma el conteo Prime/Promo al mes correspondiente.
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
  const pr  = (prev?.pedidos_prime || 0) + prime
  const po  = (prev?.pedidos_promo || 0) + promo
  await supabase.from('estadisticas_prime_promo').upsert({
    canal, ['año']: anio, mes,
    pedidos_total: tot, pedidos_prime: pr, pedidos_promo: po,
    pct_prime: tot > 0 ? pr / tot : 0, pct_promo: tot > 0 ? po / tot : 0,
    fuente: 'liquidacion_' + v.plataforma,
  }, { onConflict: 'canal,año,mes' })
}

// ── Anti-duplicado por cobertura de periodo (§3.3) ────────────────────────────
// Devuelve 'skip' si el entrante está contenido en uno existente.
// Devuelve 'replace' si el entrante contiene uno o más existentes.
// Devuelve 'new' si no hay solapamiento.
type CoberturaTipo = 'skip' | 'replace' | 'new'
interface CoberturaCheck { tipo: CoberturaTipo; idsAEliminar: string[] }

async function checkCoberturaPeriodo(
  supabase: SupabaseClient,
  plataforma: string,
  marca: string,
  ini: string,
  fin: string,
): Promise<CoberturaCheck> {
  const { data } = await supabase.from('ventas_plataforma').select('id, fecha_inicio_periodo, fecha_fin_periodo')
    .eq('plataforma', plataforma).eq('marca', marca) as unknown as {
      data: { id: string; fecha_inicio_periodo: string; fecha_fin_periodo: string }[] | null
    }
  const existentes = data || []

  for (const e of existentes) {
    const eIni = e.fecha_inicio_periodo
    const eFin = e.fecha_fin_periodo
    // El existente contiene al entrante → SKIP
    if (eIni <= ini && eFin >= fin) return { tipo: 'skip', idsAEliminar: [] }
  }

  // El entrante contiene a alguno existente → los reemplaza
  const contenidos = existentes.filter((e) => ini <= e.fecha_inicio_periodo && fin >= e.fecha_fin_periodo)
  if (contenidos.length > 0) return { tipo: 'replace', idsAEliminar: contenidos.map((e) => e.id) }

  return { tipo: 'new', idsAEliminar: [] }
}

// ── Volcar una venta parseada ─────────────────────────────────────────────────
async function volcar(
  supabase: SupabaseClient,
  file: ArchivoEntrada,
  v: VentaPlataformaParseada,
  extra?: { comision_eur?: number; ads_eur?: number; promo_eur?: number; cupones_eur?: number; ajustes_eur?: number },
): Promise<ProcesarResultado> {
  const marca = await mapearMarca(supabase, v.marcaRaw)
  const ticket = v.pedidos > 0 ? v.bruto / v.pedidos : 0
  const info = {
    plataforma: v.plataforma, marca: marca || v.marcaRaw,
    periodo: `${v.fecha_inicio_periodo} → ${v.fecha_fin_periodo}`,
    bruto: v.bruto, neto: v.neto, pedidos: v.pedidos,
  }

  if (!marca) {
    return {
      estado: 'lectura_manual', archivo: file.nombre, tipo_documento: 'resumen_ventas',
      resumen_ventas: info, motivo: `venta ${v.plataforma}: marca no identificada ("${v.marcaRaw}")`,
    }
  }

  // Anti-duplicado
  const cobertura = await checkCoberturaPeriodo(
    supabase, v.plataforma, marca, v.fecha_inicio_periodo, v.fecha_fin_periodo,
  )

  if (cobertura.tipo === 'skip') {
    return {
      estado: 'duplicada', archivo: file.nombre, tipo_documento: 'resumen_ventas',
      resumen_ventas: info,
      motivo: `venta ${v.plataforma} · ${marca} · ya cubierta por un periodo mayor, omitida`,
    }
  }

  if (cobertura.tipo === 'replace' && cobertura.idsAEliminar.length > 0) {
    await supabase.from('ventas_plataforma').delete().in('id', cobertura.idsAEliminar)
  }

  // Fila a insertar
  const fila: Record<string, unknown> = {
    plataforma: v.plataforma, marca,
    fecha_inicio_periodo: v.fecha_inicio_periodo,
    fecha_fin_periodo: v.fecha_fin_periodo,
    bruto: v.bruto, neto: v.neto, pedidos: v.pedidos, ticket_medio: ticket,
    ingreso_colaborador: v.neto,
    comision_eur: extra?.comision_eur ?? 0,
    ads_eur:      extra?.ads_eur      ?? 0,
    promo_eur:    extra?.promo_eur    ?? 0,
    cupones_eur:  extra?.cupones_eur  ?? 0,
    ajustes_eur:  extra?.ajustes_eur  ?? 0,
    ...(v.fecha_pago   ? { fecha_pago: v.fecha_pago }                  : {}),
    ...(v.referencia   ? { facturas_origen: [v.referencia] }           : {}),
    updated_at: new Date().toISOString(),
  }

  await supabase.from('ventas_plataforma').insert(fila)
  await acumularPrimePromo(supabase, v)

  const accion = cobertura.tipo === 'replace' ? 'registrada (reemplazando semanales)' : 'registrada'
  return {
    estado: 'ok', archivo: file.nombre, tipo_documento: 'resumen_ventas',
    resumen_ventas: info, motivo: `venta ${v.plataforma} · ${marca} · ${accion}`,
  }
}

// ── Punto de entrada ──────────────────────────────────────────────────────────
export async function intentarVentaPlataforma(
  supabase: SupabaseClient, file: ArchivoEntrada, tipo: string,
): Promise<ProcesarResultado | null> {
  try {
    const ext = (file.nombre.toLowerCase().split('.').pop() || '').trim()

    // ── Just Eat: .doc/.docx HTML ──────────────────────────────────────────
    if (ext === 'doc' || ext === 'docx' || tipo === 'word') {
      const html = file.buffer.toString('utf8')
      if (/just\s*eat/i.test(html)) {
        const v = parseFacturaJustEat(html)
        if (v) return await volcar(supabase, file, v)
      }
    }

    // ── Glovo: ZIP con xlsx + pdf ──────────────────────────────────────────
    if (ext === 'zip') {
      const zip = await JSZip.loadAsync(file.buffer)
      let xlsxBuf: Buffer | null = null
      let pdfBuf: Buffer | null = null
      for (const name of Object.keys(zip.files)) {
        if (/\.xlsx$/i.test(name)) xlsxBuf = Buffer.from(await zip.files[name].async('nodebuffer'))
        if (/\.pdf$/i.test(name))  pdfBuf  = Buffer.from(await zip.files[name].async('nodebuffer'))
      }
      if (xlsxBuf && pdfBuf) {
        const pdfTexto = await extraerTextoPDF(pdfBuf)
        const v = parseLiquidacionGlovo(xlsxBuf, pdfTexto)
        if (v) return await volcar(supabase, file, v)
      }
    }

    // ── Uber: PDF resumen mensual U1 ──────────────────────────────────────
    if (ext === 'pdf') {
      const texto = await extraerTextoPDF(file.buffer)
      if (/uber\s*eats/i.test(texto) && /total\s+neto/i.test(texto)) {
        const parsed = parseUberResumenMensual(texto)
        if (parsed.length > 0) {
          // Si hay varias marcas en el mismo PDF, volcar la primera y devolver ok
          // (procesarArchivo puede llamar a intentarVentaPlataforma solo una vez por archivo;
          // para multi-marca en un PDF el parser devuelve todas y las volcamos en bucle)
          let ultimo: ProcesarResultado | null = null
          for (const p of parsed) {
            const extra = {
              comision_eur: p.comision_eur,
              ads_eur:      p.ads_eur,
              promo_eur:    p.promo_eur,
              cupones_eur:  p.cupones_eur,
              ajustes_eur:  p.ajustes_eur,
            }
            ultimo = await volcar(supabase, file, p, extra)
          }
          return ultimo
        }
      }
    }

    // ── Uber: CSV emea U2 (fallback semanal) ──────────────────────────────
    if (ext === 'csv' || ext === 'xlsx') {
      // Detectar si es el CSV emea de Uber por cabeceras clave
      let buf = file.buffer
      // Si es CSV convertir a buffer para XLSX
      const filas = parseUberResumenGanancias(buf)
      if (filas && filas.length > 0) {
        // Marca desconocida en CSV emea (no viene en el archivo); marcar para revisión manual
        const ventas = emeaAVentas(filas, 'DESCONOCIDA_UBER')
        let ultimo: ProcesarResultado | null = null
        for (const v of ventas) {
          ultimo = await volcar(supabase, file, v)
        }
        return ultimo
      }
    }

  } catch (e) {
    console.error('[intentarVentaPlataforma] fallo:', (e as Error)?.message)
  }
  return null
}
