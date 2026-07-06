// ocr-procesar-extracto v34
// v34: los movimientos entran con doc_estado='falta' (reloj) salvo que el
// trigger fn_doc_estado_auto los pase a 'no_requiere' por categoría. Así los
// movimientos con documento pendiente quedan como Pendiente, no auto-conciliados.
// v31: ENRIQUECIDO — guarda saldo, fecha_valor, referencia y tipo_mov.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const STOPWORDS = new Set([
  'pago','con','tarjeta','transferencia','recibida','realizada','adeudo','abono',
  'cargo','traspaso','desde','cuenta','sueldo','factura','invoice','enviado',
  'enviada','bizum','cuota','seguridad','social','cotizacion','automatico',
  'concepto','referencia','impuesto','operacion','liquidacion','servicios',
  'recarga','descarga','tarjetas','prepago','transferencias','euros','recibido',
  'beneficiario','ordenante','anulacion','aportacion','inicial','la','el','en',
  'de','del','los','las','una','para','por'
])

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })
}
function errResp(step: string, detail: unknown) {
  console.error(`[STEP=${step}]`, detail)
  return jsonResp({ status: "ok", error: `step:${step}`, detail: String(detail).slice(0, 800) })
}

function capitalize(s: string): string {
  if (!s) return s
  return s.toLowerCase().charAt(0).toUpperCase() + s.toLowerCase().slice(1)
}
function normalizarConcepto(s: string): string {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function deducirTipoMov(concepto: string): string {
  const c = (concepto || '').toLowerCase()
  if (/pago con tarjeta|compra con tarjeta|\btarjeta\b/.test(c)) return 'tarjeta'
  if (/abono por transferencia|transferencia recibida|recibida en euros|abono a su favor/.test(c)) return 'transferencia_recibida'
  if (/transferencia realizada|transferencia emitida|transferencia enviada|enviada/.test(c)) return 'transferencia_emitida'
  if (/\badeudo\b|recibo|domiciliacion|domiciliado/.test(c)) return 'adeudo'
  if (/traspaso/.test(c)) return 'traspaso'
  if (/bizum/.test(c)) return 'bizum'
  if (/recarga|prepago/.test(c)) return 'recarga'
  if (/comision|comisiones/.test(c)) return 'comision'
  return 'otro'
}
function extraerReferencia(concepto: string): string | null {
  const c = concepto || ''
  const m1 = c.match(/n[\u00ba\u00b0o.\s]*\s*([0-9]{6,})/i)
  if (m1) return m1[1]
  const m2 = c.match(/\b(\d{10,})\b/)
  if (m2) return m2[1]
  return null
}

function tokensIdentificativos(concNorm: string): Set<string> {
  const tokens = new Set<string>()
  const matches = concNorm.match(/[a-z0-9]{6,}/g) || []
  for (const t of matches) {
    if (STOPWORDS.has(t)) continue
    if (/[0-9]/.test(t) || t.length >= 10) tokens.add(t)
  }
  return tokens
}

function conceptosCompatibles(c1: string, c2: string): boolean {
  if (!c1 || !c2) return true
  if (c1 === c2) return true
  if (c1.includes(c2) || c2.includes(c1)) return true
  const t1 = tokensIdentificativos(c1)
  const t2 = tokensIdentificativos(c2)
  if (t1.size > 0 && t2.size > 0) {
    for (const t of t1) if (t2.has(t)) return true
  }
  if (c1.length < 8 && c2.length < 8) return true
  return false
}

async function md5hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s)
  const hash = await crypto.subtle.digest('MD5', buf).catch(() => null)
  if (!hash) {
    let h = 5381
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i)
    return Math.abs(h).toString(16).padStart(8, '0').slice(0, 8)
  }
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 8)
}

interface MovimientoCSV { fecha: string; concepto: string; importe: number; saldo: number | null; fecha_valor: string | null }

function parsearFechaES(s: string): string | null {
  const clean = (s || '').trim().replace(/"/g, '')
  const m1 = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`
  if (clean.match(/^\d{4}-\d{2}-\d{2}$/)) return clean
  return null
}
function parsearImporte(s: string): number | null {
  const clean = (s || '').trim().replace(/"/g, '').replace(/\s/g, '')
  if (!clean || clean === '-') return null
  let n: number
  if (clean.includes(',')) n = parseFloat(clean.replace(/\./g, '').replace(',', '.'))
  else n = parseFloat(clean)
  return isNaN(n) ? null : n
}
function splitLine(line: string, sep: string): string[] {
  const r: string[] = []; let cur = '', inQ = false
  for (const ch of line) {
    if (ch === '"') inQ = !inQ
    else if (ch === sep && !inQ) { r.push(cur.replace(/^"|"$/g, '')); cur = '' }
    else cur += ch
  }
  r.push(cur.replace(/^"|"$/g, '')); return r
}

function construirConcepto(rawConc: string, rawMov: string): string {
  const c = (rawConc || '').trim()
  const m = (rawMov || '').trim()
  if (c && m && m.toLowerCase() !== c.toLowerCase()) {
    return capitalize(c) + ' - ' + m.toLowerCase()
  }
  if (c) return capitalize(c)
  if (m) return capitalize(m)
  return 'Sin concepto'
}

function parsearCSV(texto: string): { movs: MovimientoCSV[], debug: string } {
  const lines = texto.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { movs: [], debug: `solo ${lines.length} lineas` }
  let sep = ';'
  const sampleLine = lines.slice(0, 10).find(l => l.length > 10) || lines[0]
  if (sampleLine.split(';').length < sampleLine.split(',').length) sep = ','
  const headerKeywords = ['fecha','f.valor','fvalor','importe','concepto','descripcion','movimiento','cargo','abono']
  let hi = -1
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const low = lines[i].toLowerCase().replace(/[^a-z.;,]/g, ' ')
    if (headerKeywords.filter(k => low.includes(k)).length >= 2) { hi = i; break }
  }
  if (hi < 0) return { movs: [], debug: `cabecera no encontrada. primera: ${lines[0].slice(0, 100)}` }
  const headers = splitLine(lines[hi], sep).map(h => h.trim().toLowerCase().replace(/"/g, '').replace(/[^a-z.]/g, ' ').trim())
  const idx = (...names: string[]) => {
    for (const n of names) {
      const i = headers.findIndex(h => h.includes(n))
      if (i >= 0) return i
    }
    return -1
  }
  const fechaCol = idx('f.valor','fvalor','fecha valor','fecha')
  const fvalorCol = idx('f.valor','fvalor','fecha valor')
  const impCol   = idx('importe','amount')
  const cargoCol = idx('cargo','debito','salida','debe')
  const abonoCol = idx('abono','credito','entrada','haber')
  const concCol  = idx('concepto','descripcion','description','detalle')
  const movCol   = idx('movimiento','observaciones','contraparte')
  const saldoCol = idx('disponible','saldo')

  const movs: MovimientoCSV[] = []
  for (let i = hi + 1; i < lines.length; i++) {
    const cols = splitLine(lines[i], sep)
    if (cols.length < 3 || cols.every(c => !c.trim())) continue
    const fecha = parsearFechaES(fechaCol >= 0 ? cols[fechaCol] : '')
    if (!fecha) continue
    let importe: number | null = null
    if (impCol >= 0) importe = parsearImporte(cols[impCol] || '')
    else if (cargoCol >= 0 || abonoCol >= 0) {
      const cargo = cargoCol >= 0 ? parsearImporte(cols[cargoCol] || '') : null
      const abono = abonoCol >= 0 ? parsearImporte(cols[abonoCol] || '') : null
      if (cargo && cargo !== 0) importe = -Math.abs(cargo)
      else if (abono && abono !== 0) importe = Math.abs(abono)
    }
    if (importe === null) continue
    const rawConc = concCol >= 0 ? (cols[concCol] || '') : ''
    const rawMov  = movCol  >= 0 ? (cols[movCol]  || '') : ''
    movs.push({
      fecha,
      concepto: construirConcepto(rawConc, rawMov),
      importe,
      saldo: saldoCol >= 0 ? parsearImporte(cols[saldoCol] || '') : null,
      fecha_valor: fvalorCol >= 0 ? parsearFechaES(cols[fvalorCol] || '') : null,
    })
  }
  return { movs, debug: `sep='${sep}' hi=${hi} parsed=${movs.length} concCol=${concCol} movCol=${movCol} saldoCol=${saldoCol}` }
}

function addDays(fechaIso: string, days: number): string {
  const d = new Date(fechaIso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
function diffDays(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime()
  const db = new Date(b + 'T00:00:00Z').getTime()
  return Math.abs(Math.round((da - db) / 86400000))
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  let step = "start"
  try {
    step = "parse_body"
    const body = await req.json()
    const { fileBase64, fileTexto, filename, mimeType, titular_id } = body
    if ((!fileBase64 && !fileTexto) || !filename || !titular_id) {
      return errResp(step, `missing fields fb=${!!fileBase64} ft=${!!fileTexto} fn=${filename} tid=${titular_id}`)
    }

    step = "supabase_client"
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!SUPABASE_URL || !SERVICE_KEY) return errResp(step, 'env vars missing')
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    step = "binary"
    const binary = fileTexto
      ? new TextEncoder().encode(fileTexto)
      : Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0))

    const esCSV = /\.(csv|txt)$/i.test(filename) || mimeType === 'text/csv' || !!fileTexto
    let movimientos: MovimientoCSV[] = []
    let debugInfo = ''
    let tipoParse = 'csv_nativo'

    if (esCSV) {
      step = "parse_csv"
      const texto = fileTexto || (() => {
        try { return new TextDecoder('utf-8', { fatal: true }).decode(binary) }
        catch { return new TextDecoder('iso-8859-1').decode(binary) }
      })()
      const { movs, debug } = parsearCSV(texto)
      debugInfo = debug
      movimientos = movs
      if (!movimientos.length) return errResp(step, `Sin movimientos. ${debug}`)
    } else {
      step = "claude_vision"
      tipoParse = 'claude_vision'
      const apiKey = Deno.env.get("ANTHROPIC_API_KEY")
      if (!apiKey) return errResp(step, "ANTHROPIC_API_KEY missing")
      const isPdf = mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")
      const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5", max_tokens: 8000,
          messages: [{ role: "user", content: [
            { type: isPdf ? "document" : "image", source: { type: "base64", media_type: mimeType, data: fileBase64 } },
            { type: "text", text: `Extrae todos los movimientos en JSON: {"movimientos":[{"fecha":"YYYY-MM-DD","fecha_valor":"YYYY-MM-DD o null","concepto":string,"importe":number,"saldo":number o null}]}. fecha = fecha de operacion. fecha_valor = fecha valor si aparece, si no null. Negativo=gasto. saldo = saldo de la cuenta tras el movimiento si aparece en una columna Saldo, si no null. Concepto debe incluir TANTO la descripcion generica como el detalle del comercio si estan disponibles. Solo JSON.` },
          ]}],
        }),
      })
      if (!claudeResp.ok) return errResp(step, `claude ${claudeResp.status}`)
      const raw = (await claudeResp.json()).content?.[0]?.text || '{}'
      try {
        const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
        const arr = parsed.movimientos || []
        movimientos = arr.map((m: any) => ({
          fecha: m.fecha,
          concepto: m.concepto || 'Sin concepto',
          importe: Number(m.importe),
          saldo: (m.saldo === null || m.saldo === undefined) ? null : Number(m.saldo),
          fecha_valor: m.fecha_valor || null,
        }))
      } catch {
        return errResp(step, `parse json: ${raw.slice(0, 200)}`)
      }
    }
    if (!movimientos.length) return errResp('post_parse', 'movimientos vacio')

    const fechaMin = movimientos.reduce((min, m) => m.fecha < min ? m.fecha : min, movimientos[0].fecha)
    const fechaMax = movimientos.reduce((max, m) => m.fecha > max ? m.fecha : max, movimientos[0].fecha)

    step = "load_reglas"
    const { data: reglas } = await supabase.from("reglas_conciliacion")
      .select("patron, set_proveedor, categoria_codigo")
      .eq("activa", true)
    const reglasList = reglas || []

    step = "preload_existentes"
    const fechaMinExt = addDays(fechaMin, -5)
    const fechaMaxExt = addDays(fechaMax, 5)
    const { data: existentes } = await supabase
      .from("conciliacion")
      .select("fecha, importe, concepto")
      .eq("titular_id", titular_id)
      .gte("fecha", fechaMinExt)
      .lte("fecha", fechaMaxExt)

    interface MovExistente { fecha: string, conceptoNorm: string, usado: boolean }
    const porImporte = new Map<string, MovExistente[]>()
    for (const r of (existentes || [])) {
      const k = Number(r.importe).toFixed(2)
      const arr = porImporte.get(k) || []
      arr.push({ fecha: r.fecha, conceptoNorm: normalizarConcepto(r.concepto || ''), usado: false })
      porImporte.set(k, arr)
    }

    step = "prepare_rows"
    const yaProcesadosArchivo = new Set<string>()
    const filasInsertar: any[] = []
    let saltadosBD = 0
    let saltadosArchivo = 0
    let categorizados = 0

    for (const m of movimientos) {
      const concNorm = normalizarConcepto(m.concepto)
      const importeKey = Number(m.importe).toFixed(2)

      const claveArchivo = `${m.fecha}|${importeKey}|${concNorm}`
      if (yaProcesadosArchivo.has(claveArchivo)) {
        saltadosArchivo++
        continue
      }
      yaProcesadosArchivo.add(claveArchivo)

      const candidatos = porImporte.get(importeKey) || []
      const matchExistente = candidatos.find(c =>
        !c.usado &&
        diffDays(c.fecha, m.fecha) <= 5 &&
        conceptosCompatibles(c.conceptoNorm, concNorm)
      )
      if (matchExistente) {
        matchExistente.usado = true
        saltadosBD++
        continue
      }

      const titular8  = titular_id.replace(/-/g,'').slice(0,8)
      const hash8     = await md5hex(concNorm)
      const dedup_key = `${m.fecha}|${importeKey}|${titular8}|${hash8}|1`

      let categoria: string | null = null
      let proveedor_set: string | null = null
      const buscar = concNorm.slice(0, 200)
      for (const r of reglasList) {
        if (r.patron && buscar.includes(r.patron.toLowerCase())) {
          categoria = r.categoria_codigo
          proveedor_set = r.set_proveedor
          break
        }
      }
      if (categoria) categorizados++

      const arr = porImporte.get(importeKey) || []
      arr.push({ fecha: m.fecha, conceptoNorm: concNorm, usado: false })
      porImporte.set(importeKey, arr)

      filasInsertar.push({
        fecha: m.fecha,
        concepto: m.concepto,
        importe: m.importe,
        categoria,
        titular_id,
        proveedor: proveedor_set,
        // doc_estado NO se fuerza: el trigger fn_doc_estado_auto decide 'falta'
        // (reloj) o 'no_requiere' según la categoría. Se pasa 'falta' como base.
        doc_estado: 'falta',
        dedup_key,
        saldo: m.saldo ?? null,
        fecha_valor: m.fecha_valor ?? null,
        referencia: extraerReferencia(m.concepto),
        tipo_mov: deducirTipoMov(m.concepto),
      })
    }

    step = "insert_chunks"
    let insertados = 0
    let errores = 0
    let primerError: string | null = null
    const CHUNK_SIZE = 500

    for (let i = 0; i < filasInsertar.length; i += CHUNK_SIZE) {
      const chunk = filasInsertar.slice(i, i + CHUNK_SIZE)
      const { error } = await supabase.from("conciliacion").insert(chunk)
      if (error) {
        if (!primerError) primerError = `chunk@${i}: ${error.message}`
        for (const fila of chunk) {
          const { error: e2 } = await supabase.from("conciliacion").insert(fila)
          if (e2) errores++
          else insertados++
        }
      } else {
        insertados += chunk.length
      }
    }

    step = "insert_extracto"
    const notas = errores > 0 ? `${errores} errores. Primero: ${primerError?.slice(0, 300)}` : null
    await supabase.from("extractos_bancarios").insert({
      titular_id,
      filename: filename.replace(/[^a-zA-Z0-9._-]/g, "_"),
      drive_url: null,
      drive_id: null,
      fecha_subida: new Date().toISOString().slice(0, 10),
      movimientos_total: movimientos.length,
      movimientos_insertados: insertados,
      movimientos_saltados: saltadosBD + saltadosArchivo,
      fecha_min: fechaMin,
      fecha_max: fechaMax,
      origen: tipoParse,
      notas,
    })

    return jsonResp({
      status: "ok",
      tipo_detectado: "extracto_bancario",
      insertados,
      saltados: saltadosBD + saltadosArchivo,
      saltados_bd: saltadosBD,
      saltados_archivo: saltadosArchivo,
      duplicados: saltadosBD + saltadosArchivo,
      categorizados_auto: categorizados,
      errores,
      primer_error: primerError,
      total: movimientos.length,
      tipo_parse: tipoParse,
      debug: debugInfo,
    })
  } catch (err) {
    return errResp(step, err instanceof Error ? `${err.name}: ${err.message}` : String(err))
  }
})
