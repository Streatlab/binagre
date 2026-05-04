import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import JSZip from "https://esm.sh/jszip@3.10.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { mes, titular_id } = await req.json()
    // mes = "2026-01", titular_id = uuid

    if (!mes || !titular_id) {
      return new Response(JSON.stringify({ error: "mes y titular_id requeridos" }), { status: 400, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const [year, month] = mes.split("-")
    const desdeStr = `${mes}-01`
    const lastDay = new Date(Number(year), Number(month), 0).getDate()
    const hastaStr = `${mes}-${String(lastDay).padStart(2, "0")}`

    // Facturas del mes y titular
    const { data: facturas, error: fErr } = await supabase
      .from("facturas")
      .select("id, pdf_drive_url, pdf_filename, proveedor_nombre, nif_emisor, fecha_factura, total")
      .eq("titular_id", titular_id)
      .gte("fecha_factura", desdeStr)
      .lte("fecha_factura", hastaStr)
      .not("pdf_drive_url", "is", null)

    if (fErr) {
      return new Response(JSON.stringify({ error: "error_facturas", detail: fErr.message }), { status: 500, headers: corsHeaders })
    }

    // Resúmenes Uber del mes
    const { data: resumenes } = await supabase
      .from("ventas_resumenes")
      .select("id, archivo_url, mes, plataforma")
      .eq("mes", mes)
      .eq("plataforma", "uber")

    const zip = new JSZip()
    const carpetaFacturas = zip.folder("facturas")!
    const carpetaVentas = zip.folder("ventas")!

    // Descargar y añadir facturas
    const facturaPromises = (facturas || []).map(async (f) => {
      try {
        const resp = await fetch(f.pdf_drive_url)
        if (!resp.ok) return
        const buf = await resp.arrayBuffer()

        // Nombre limpio: YYYYMMDD_NIF_proveedor.pdf
        const fecha = (f.fecha_factura || "").replace(/-/g, "")
        const nif = (f.nif_emisor || "sinNIF").replace(/[^a-zA-Z0-9]/g, "")
        const prov = (f.proveedor_nombre || "sinProveedor")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "-")
          .slice(0, 30)
        const ext = (f.pdf_filename || "archivo.pdf").split(".").pop() || "pdf"
        const nombre = `${fecha}_${nif}_${prov}.${ext}`

        carpetaFacturas.file(nombre, buf)
      } catch (_) { /* skip */ }
    })

    // Descargar y añadir resúmenes Uber
    const uberPromises = (resumenes || []).map(async (r) => {
      if (!r.archivo_url) return
      try {
        const resp = await fetch(r.archivo_url)
        if (!resp.ok) return
        const buf = await resp.arrayBuffer()
        const ext = r.archivo_url.split(".").pop()?.split("?")[0] || "csv"
        carpetaVentas.file(`uber_${r.mes}.${ext}`, buf)
      } catch (_) { /* skip */ }
    })

    await Promise.all([...facturaPromises, ...uberPromises])

    const zipBuffer = await zip.generateAsync({ type: "uint8array" })

    // Nombre del titular
    const { data: tit } = await supabase
      .from("titulares")
      .select("nombre")
      .eq("id", titular_id)
      .single()

    const titNombre = (tit?.nombre || "titular").toUpperCase().replace(/[^A-Z0-9]/g, "")
    const zipName = `gestoria_${mes}_${titNombre}.zip`

    return new Response(zipBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName}"`,
      },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: "unhandled", detail: String(err) }), { status: 500, headers: corsHeaders })
  }
})
