import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { fileBase64, filename, mimeType, titular_id } = await req.json()

    if (!fileBase64 || !filename || !titular_id) {
      return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: corsHeaders })
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
      return new Response(JSON.stringify({ status: "duplicado" }), { headers: corsHeaders })
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY")
    if (!apiKey) return new Response(JSON.stringify({ error: "missing ANTHROPIC_API_KEY" }), { status: 500, headers: corsHeaders })

    const isPdf = mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")
    const prompt = `Extrae todos los movimientos del extracto bancario en JSON estricto:

{
  "movimientos": [
    {
      "fecha": "YYYY-MM-DD",
      "concepto": string,
      "importe": number (negativo si es gasto, positivo si es ingreso),
      "ordenante": string | null,
      "beneficiario": string | null,
      "saldo": number | null
    }
  ]
}

Devuelve SOLO el JSON, sin texto adicional.`

    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        messages: [{
          role: "user",
          content: [
            { type: isPdf ? "document" : "image", source: { type: "base64", media_type: mimeType, data: fileBase64 } },
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

    const movimientos = parsed.movimientos || []
    let insertados = 0
    let saltados = 0

    for (const m of movimientos) {
      const { data: dup } = await supabase
        .from("conciliacion")
        .select("id")
        .eq("titular_id", titular_id)
        .eq("fecha", m.fecha)
        .eq("importe", m.importe)
        .eq("concepto", m.concepto)
        .maybeSingle()

      if (dup) {
        saltados++
        continue
      }

      let categoria: string | null = null
      const nombreBuscar = m.beneficiario || m.ordenante || m.concepto
      if (nombreBuscar) {
        const { data: regla } = await supabase
          .from("reglas_ocr")
          .select("categoria_codigo")
          .ilike("patron_nombre", `%${nombreBuscar.slice(0, 20)}%`)
          .eq("activa", true)
          .maybeSingle()
        if (regla) categoria = regla.categoria_codigo
      }

      await supabase.from("conciliacion").insert({
        fecha: m.fecha,
        concepto: m.concepto,
        importe: m.importe,
        categoria,
        titular_id,
        ordenante: m.ordenante,
        beneficiario: m.beneficiario,
        doc_estado: "no_requiere",
      })
      insertados++
    }

    const titNombre = titular_id === "6ce69d55-60d0-423c-b68b-eb795a0f32fe" ? "RUBEN" : "EMILIO"
    const today = new Date().toISOString().slice(0, 10)
    const path = `EXTRACTOS/${titNombre}/${today}-${filename}`
    await supabase.storage.from("facturas").upload(path, binary, { contentType: mimeType, upsert: false })

    await supabase.from("facturas").insert({
      tipo: "otro",
      categoria_factura: "extracto_bancario",
      pdf_filename: filename,
      pdf_hash: hashHex,
      titular_id,
      fecha_factura: today,
      total: 0,
      proveedor_nombre: `Extracto ${titNombre}`,
      estado: "historica",
    })

    return new Response(JSON.stringify({ status: "ok", insertados, saltados, total: movimientos.length }), { headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: "unhandled", detail: String(err) }), { status: 500, headers: corsHeaders })
  }
})
