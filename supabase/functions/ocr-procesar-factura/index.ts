import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const RUBEN_ID = "6ce69d55-60d0-423c-b68b-eb795a0f32fe"
const EMILIO_ID = "c5358d43-a9cc-4f4c-b0b3-99895bdf4354"
const NIF_RUBEN = "21669051S"
const NIF_EMILIO = "53484832B"

function normalizar(t: string): string {
  return (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[,.]/g, " ").replace(/\s+/g, " ").trim()
}

function mesAnterior(fecha: string) {
  const d = new Date(fecha)
  const año = d.getFullYear()
  const mes = d.getMonth()
  const inicio = new Date(año, mes - 1, 1)
  const fin = new Date(año, mes, 0)
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fin: fin.toISOString().slice(0, 10),
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { fileBase64, filename, mimeType } = await req.json()

    if (!fileBase64 || !filename) {
      return new Response(JSON.stringify({ error: "missing fileBase64 or filename" }), { status: 400, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const binary = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0))
    const hashBuffer = await crypto.subtle.digest("SHA-256", binary)
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("")

    const { data: existente } = await supabase
      .from("facturas")
      .select("id")
      .eq("pdf_hash", hashHex)
      .maybeSingle()

    if (existente) {
      return new Response(JSON.stringify({ status: "duplicado", factura_id: existente.id }), { headers: corsHeaders })
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY")
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "missing ANTHROPIC_API_KEY" }), { status: 500, headers: corsHeaders })
    }

    const isPdf = mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")
    const prompt = `Eres un OCR de facturas. Extrae los siguientes campos en JSON estricto, sin texto adicional:

{
  "proveedor_nombre": string,
  "nif_emisor": string,
  "nif_cliente": string,
  "numero_factura": string,
  "fecha_factura": "YYYY-MM-DD",
  "es_recapitulativa": boolean,
  "periodo_inicio": "YYYY-MM-DD" | null,
  "periodo_fin": "YYYY-MM-DD" | null,
  "base_4": number, "iva_4": number,
  "base_10": number, "iva_10": number,
  "base_21": number, "iva_21": number,
  "total": number,
  "tipo": "proveedor" | "plataforma" | "otro",
  "plataforma": "uber" | "glovo" | "just_eat" | null,
  "confianza": number (0-100)
}

Si un campo no existe, ponlo a 0 o null. Devuelve SOLO el JSON.`

    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: [
            {
              type: isPdf ? "document" : "image",
              source: { type: "base64", media_type: mimeType, data: fileBase64 },
            },
            { type: "text", text: prompt },
          ],
        }],
      }),
    })

    if (!claudeResp.ok) {
      const errText = await claudeResp.text()
      return new Response(JSON.stringify({ error: "claude_api_error", detail: errText }), { status: 500, headers: corsHeaders })
    }

    const claudeData = await claudeResp.json()
    const rawText = claudeData.content?.[0]?.text || "{}"
    const cleanJson = rawText.replace(/```json|```/g, "").trim()
    let parsed: any
    try {
      parsed = JSON.parse(cleanJson)
    } catch {
      return new Response(JSON.stringify({ error: "parse_error", raw: rawText }), { status: 500, headers: corsHeaders })
    }

    let titular_id: string | null = null
    if (parsed.nif_cliente === NIF_RUBEN) titular_id = RUBEN_ID
    else if (parsed.nif_cliente === NIF_EMILIO) titular_id = EMILIO_ID

    // Plataformas (Uber/Glovo/JE) sin NIF cliente → asume Rubén por defecto
    const provNorm = normalizar(parsed.proveedor_nombre || "")
    const esPlataforma = parsed.tipo === "plataforma" || ["uber", "glovo", "just_eat"].includes(parsed.plataforma)
    if (!titular_id && esPlataforma) {
      titular_id = RUBEN_ID
    }

    let categoria_factura: string | null = null
    if (parsed.nif_emisor) {
      const { data: regla } = await supabase
        .from("reglas_ocr")
        .select("categoria_codigo, titular_id, proveedor_canonico")
        .eq("patron_nif", parsed.nif_emisor)
        .eq("activa", true)
        .maybeSingle()

      if (regla) {
        categoria_factura = regla.categoria_codigo
        if (!titular_id && regla.titular_id) titular_id = regla.titular_id
        if (regla.proveedor_canonico) parsed.proveedor_nombre = regla.proveedor_canonico
      }
    }

    const folderTitular = titular_id === RUBEN_ID ? "RUBEN" : titular_id === EMILIO_ID ? "EMILIO" : "SIN_ASIGNAR"
    const year = parsed.fecha_factura ? parsed.fecha_factura.slice(0, 4) : new Date().getFullYear().toString()
    const month = parsed.fecha_factura ? parsed.fecha_factura.slice(5, 7) : "00"
    const trim = month >= "01" && month <= "03" ? "1T" : month <= "06" ? "2T" : month <= "09" ? "3T" : "4T"
    const subfolder = parsed.tipo === "plataforma" ? "PLATAFORMAS" : "PROVEEDORES"

    const proveedorClean = (parsed.proveedor_nombre || "sin_proveedor").toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30)
    const fechaClean = (parsed.fecha_factura || new Date().toISOString().slice(0, 10)).replace(/-/g, "")
    const ext = filename.split(".").pop() || "pdf"
    const newName = `${proveedorClean}-${parsed.nif_emisor || "noNIF"}-${fechaClean}-${parsed.total || 0}.${ext}`
    const storagePath = `${folderTitular}/${year}/${trim}/${month}/${subfolder}/${newName}`

    const { error: uploadErr } = await supabase.storage
      .from("facturas")
      .upload(storagePath, binary, { contentType: mimeType, upsert: false })

    let pdf_drive_url: string | null = null
    if (!uploadErr) {
      const { data: pubUrl } = supabase.storage.from("facturas").getPublicUrl(storagePath)
      pdf_drive_url = pubUrl.publicUrl
    }

    // Determinar estado según reglas de matching
    // - Uber Eats: solo_drive (no matchea con banco)
    // - Importe 0 (Alcampo saldo Club): solo_drive
    // - Resto: matching activo
    const importeAbs = Math.abs(parsed.total || 0)
    const esUber = parsed.plataforma === "uber"
    const esImporteCero = importeAbs < 0.01
    const soloDrive = esUber || esImporteCero

    let estadoFinal = "asociada"
    let mensajeMatching: string | null = null
    if (soloDrive) {
      estadoFinal = "solo_drive"
      mensajeMatching = esUber
        ? "Factura Uber Eats: gasto deducible, no matchea con banco. Guardado en Drive."
        : "Importe 0€: solo guardado en Drive para contabilidad."
    }

    const { data: facturaIns, error: insErr } = await supabase
      .from("facturas")
      .insert({
        proveedor_nombre: parsed.proveedor_nombre,
        numero_factura: parsed.numero_factura,
        fecha_factura: parsed.fecha_factura,
        es_recapitulativa: parsed.es_recapitulativa || false,
        periodo_inicio: parsed.periodo_inicio || null,
        periodo_fin: parsed.periodo_fin || null,
        tipo: parsed.tipo || "proveedor",
        plataforma: parsed.plataforma,
        base_4: parsed.base_4 || 0,
        iva_4: parsed.iva_4 || 0,
        base_10: parsed.base_10 || 0,
        iva_10: parsed.iva_10 || 0,
        base_21: parsed.base_21 || 0,
        iva_21: parsed.iva_21 || 0,
        total: parsed.total || 0,
        pdf_drive_url,
        pdf_filename: newName,
        pdf_original_name: filename,
        pdf_hash: hashHex,
        titular_id,
        nif_emisor: parsed.nif_emisor,
        nif_cliente: parsed.nif_cliente,
        categoria_factura,
        categoria_factura_origen: categoria_factura ? "regla" : null,
        ocr_confianza: parsed.confianza,
        ocr_raw: parsed,
        estado: estadoFinal,
        mensaje_matching: mensajeMatching,
      })
      .select("id")
      .single()

    if (insErr) {
      return new Response(JSON.stringify({ error: "insert_error", detail: insErr.message }), { status: 500, headers: corsHeaders })
    }

    let matched = false

    // Solo intentar matching si NO es solo_drive
    if (!soloDrive && titular_id && parsed.total && parsed.fecha_factura) {
      // REGLA MERCADONA: recapitulativa mes natural anterior
      if (provNorm.includes("mercadona")) {
        const { inicio, fin } = mesAnterior(parsed.fecha_factura)
        const { data: movs } = await supabase
          .from("conciliacion")
          .select("id, importe")
          .eq("titular_id", titular_id)
          .gte("fecha", inicio)
          .lte("fecha", fin)
          .lt("importe", 0)
          .or("concepto.ilike.%mercadona%,proveedor.ilike.%mercadona%")

        if (movs && movs.length > 0) {
          const sumaMovs = movs.reduce((a, m) => a + Math.abs(Number(m.importe)), 0)
          const dif = Math.abs(sumaMovs - Math.abs(parsed.total))
          if (dif <= 5) {
            const filas = movs.map(m => ({
              factura_id: facturaIns.id,
              conciliacion_id: m.id,
              importe_asociado: Math.abs(Number(m.importe)),
              confirmado: dif <= 0.5,
              confianza_match: dif <= 0.5 ? 95 : 70,
            }))
            await supabase.from("facturas_gastos").insert(filas)
            matched = true
            await supabase.from("facturas").update({
              mensaje_matching: `Mercadona ${inicio} → ${fin}: ${movs.length} cargos suman ${sumaMovs.toFixed(2)}€`
            }).eq("id", facturaIns.id)
          }
        }
      }
      // GLOVO / JUST EAT: liquidación bancaria en periodo
      else if (parsed.plataforma === "glovo" || parsed.plataforma === "just_eat") {
        const aliasMap: Record<string, string[]> = {
          glovo: ["glovo", "glovoapp"],
          just_eat: ["just eat", "justeat", "takeaway"],
        }
        const aliases = aliasMap[parsed.plataforma]
        const fInicio = parsed.periodo_inicio || parsed.fecha_factura
        const fFinBase = parsed.periodo_fin || parsed.fecha_factura
        const fFin = new Date(fFinBase)
        fFin.setDate(fFin.getDate() + 14)

        const orFilter = aliases.flatMap(a => [`concepto.ilike.%${a}%`, `proveedor.ilike.%${a}%`]).join(",")
        const { data: movs } = await supabase
          .from("conciliacion")
          .select("id, importe")
          .gt("importe", 0)
          .gte("fecha", fInicio)
          .lte("fecha", fFin.toISOString().slice(0, 10))
          .or(orFilter)

        if (movs && movs.length > 0) {
          const filas = movs.map(m => ({
            factura_id: facturaIns.id,
            conciliacion_id: m.id,
            importe_asociado: Math.abs(Number(m.importe)),
            confirmado: false,
            confianza_match: 70,
          }))
          await supabase.from("facturas_gastos").insert(filas)
          matched = true
          await supabase.from("facturas").update({
            mensaje_matching: `Liquidación ${parsed.plataforma}: ${movs.length} ingresos en periodo`
          }).eq("id", facturaIns.id)
        }
      }
      // RESTO: matching exacto importe + ventana fechas (-5/+30)
      else {
        const fechaBase = new Date(parsed.fecha_factura)
        const fMin = new Date(fechaBase); fMin.setDate(fMin.getDate() - 5)
        const fMax = new Date(fechaBase); fMax.setDate(fMax.getDate() + 30)
        const palabras = provNorm.split(" ").filter(p => p.length >= 3)
        const termino = palabras[0] || provNorm

        const { data: movs } = await supabase
          .from("conciliacion")
          .select("id, importe")
          .eq("titular_id", titular_id)
          .lt("importe", 0)
          .gte("fecha", fMin.toISOString().slice(0, 10))
          .lte("fecha", fMax.toISOString().slice(0, 10))
          .or(`concepto.ilike.%${termino}%,proveedor.ilike.%${termino}%`)

        if (movs && movs.length > 0) {
          const total = Math.abs(parsed.total)
          const exactos = movs.filter(m => Math.abs(Math.abs(Number(m.importe)) - total) <= 0.5)
          if (exactos.length === 1) {
            await supabase.from("facturas_gastos").insert({
              factura_id: facturaIns.id,
              conciliacion_id: exactos[0].id,
              importe_asociado: Math.abs(Number(exactos[0].importe)),
              confirmado: true,
              confianza_match: 95,
            })
            matched = true
          } else if (exactos.length > 1) {
            const filas = exactos.map(m => ({
              factura_id: facturaIns.id,
              conciliacion_id: m.id,
              importe_asociado: Math.abs(Number(m.importe)),
              confirmado: false,
              confianza_match: 60,
            }))
            await supabase.from("facturas_gastos").insert(filas)
            matched = true
            await supabase.from("facturas").update({
              estado: "pendiente_revision",
              mensaje_matching: `Varios movimientos coinciden (${exactos.length})`
            }).eq("id", facturaIns.id)
          }
        }
      }
    }

    return new Response(JSON.stringify({
      status: "ok",
      factura_id: facturaIns.id,
      matched,
      sin_categoria: !categoria_factura,
      sin_titular: !titular_id,
      solo_drive: soloDrive,
    }), { headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: "unhandled", detail: String(err) }), { status: 500, headers: corsHeaders })
  }
})
