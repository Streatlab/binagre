// L01: Edge function legacy DESACTIVADA — el flujo actual usa ocr-procesar-sesion → API Vercel
// Esta función se mantiene como stub para no romper invocaciones antiguas.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  return new Response(JSON.stringify({
    error: "deprecated",
    detail: "Esta función está desactivada. El procesamiento OCR ahora usa ocr-procesar-sesion → API Vercel.",
  }), { status: 410, headers: corsHeaders })
})
