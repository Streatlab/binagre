// ocr-expandir-archivo/index.ts
// Recibe un storagePath de un archivo RAR, 7z o ZIP en el bucket ocr-uploads
// Lo descomprime en Deno y procesa cada archivo interno via ocr-procesar-factura
// Retry interno ilimitado por archivo (hasta que el usuario cancele la sesión)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const MIME_PDF  = "application/pdf"
const MIME_PNG  = "image/png"
const MIME_JPG  = "image/jpeg"
const EXT_MIME: Record<string, string> = {
  pdf: MIME_PDF, png: MIME_PNG, jpg: MIME_JPG, jpeg: MIME_JPG,
  webp: "image/webp", tif: "image/tiff", tiff: "image/tiff",
  gif: "image/gif", bmp: "image/bmp", heic: "image/heic",
  csv: "text/csv", txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
const EXTS_VALIDAS = new Set(Object.keys(EXT_MIME))
const EXTS_COMPRIMIDOS = new Set(["zip", "rar", "7z"])

function getExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? ""
}

function getMime(name: string): string {
  return EXT_MIME[getExt(name)] ?? "application/octet-stream"
}

// Descomprimir usando 7za (disponible en Supabase Edge runtime)
// 7za soporta zip, rar, 7z, tar, gz, bz2, etc.
async function descomprimirCon7za(archivePath: string, outDir: string): Promise<boolean> {
  try {
    const cmd = new Deno.Command("7za", {
      args: ["x", archivePath, `-o${outDir}`, "-y", "-bd"],
      stdout: "null",
      stderr: "null",
    })
    const { code } = await cmd.output()
    return code === 0
  } catch {
    // 7za no disponible — intentar con unzip para ZIP
    try {
      const cmd = new Deno.Command("unzip", {
        args: ["-o", archivePath, "-d", outDir],
        stdout: "null",
        stderr: "null",
      })
      const { code } = await cmd.output()
      return code === 0
    } catch {
      return false
    }
  }
}

// Leer archivos recursivamente desde un directorio
async function leerArchivosRecursivo(dir: string): Promise<string[]> {
  const result: string[] = []
  for await (const entry of Deno.readDir(dir)) {
    const fullPath = `${dir}/${entry.name}`
    if (entry.isDirectory) {
      const sub = await leerArchivosRecursivo(fullPath)
      result.push(...sub)
    } else if (entry.isFile) {
      result.push(fullPath)
    }
  }
  return result
}

// Llamar a ocr-procesar-factura con retry ilimitado y backoff capped 30s
async function procesarArchivoConRetry(
  supabaseUrl: string,
  serviceKey: string,
  fileBase64: string,
  filename: string,
  mimeType: string,
): Promise<{ status: string; [k: string]: any }> {
  let intento = 0
  while (true) {
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/ocr-procesar-factura`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ fileBase64, filename, mimeType }),
      })
      if (resp.ok) {
        return await resp.json()
      }
      // Si es error HTTP no retryable (400 = duplicado/bad request), devolver
      if (resp.status === 400) {
        const body = await resp.json().catch(() => ({}))
        return { status: "error", detail: body }
      }
      throw new Error(`HTTP ${resp.status}`)
    } catch (e) {
      const wait = Math.min(2000 * Math.pow(2, Math.min(intento, 10)), 30000)
      console.warn(`[expandir] retry ${intento + 1} para ${filename}: ${e}. Esperando ${wait}ms`)
      await new Promise(r => setTimeout(r, wait))
      intento++
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { storagePath, sesionId, fnName, titular_id } = await req.json()
    // storagePath: path dentro del bucket ocr-uploads
    // fnName: 'ocr-procesar-factura' | 'ocr-procesar-extracto'

    if (!storagePath) {
      return new Response(JSON.stringify({ error: "missing storagePath" }), { status: 400, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Descargar el archivo comprimido desde Storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("ocr-uploads")
      .download(storagePath)

    if (dlErr || !fileData) {
      return new Response(JSON.stringify({ error: "download_error", detail: dlErr?.message }), { status: 500, headers: corsHeaders })
    }

    const ext = getExt(storagePath.split("/").pop() ?? "")
    if (!EXTS_COMPRIMIDOS.has(ext)) {
      return new Response(JSON.stringify({ error: "not_compressed", ext }), { status: 400, headers: corsHeaders })
    }

    // Escribir en tmp
    const tmpDir = await Deno.makeTempDir()
    const tmpArchive = `${tmpDir}/archive.${ext}`
    const outDir = `${tmpDir}/out`
    await Deno.mkdir(outDir, { recursive: true })

    const buf = await fileData.arrayBuffer()
    await Deno.writeFile(tmpArchive, new Uint8Array(buf))

    // Descomprimir
    const ok = await descomprimirCon7za(tmpArchive, outDir)
    if (!ok) {
      // Limpieza
      await Deno.remove(tmpDir, { recursive: true }).catch(() => {})
      return new Response(JSON.stringify({ error: "descompresion_fallida", path: storagePath }), { status: 500, headers: corsHeaders })
    }

    // Leer archivos extraídos
    const archivos = await leerArchivosRecursivo(outDir)
    const resultados: any[] = []

    for (const filePath of archivos) {
      const filename = filePath.split("/").pop() ?? filePath
      const fileExt = getExt(filename)

      // Si es otro comprimido dentro: llamar recursivamente (nested)
      if (EXTS_COMPRIMIDOS.has(fileExt)) {
        // Subir a storage temporalmente y llamar de nuevo a esta función
        const innerBuf = await Deno.readFile(filePath)
        const innerPath = `${storagePath}_nested_${Date.now()}_${filename}`
        await supabase.storage.from("ocr-uploads").upload(innerPath, innerBuf, { upsert: true })
        const nestedResp = await fetch(`${supabaseUrl}/functions/v1/ocr-expandir-archivo`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ storagePath: innerPath, sesionId, fnName, titular_id }),
        })
        const nestedResult = await nestedResp.json().catch(() => ({}))
        resultados.push({ archivo: filename, nested: true, result: nestedResult })
        // Limpiar el temporal
        await supabase.storage.from("ocr-uploads").remove([innerPath]).catch(() => {})
        continue
      }

      if (!EXTS_VALIDAS.has(fileExt)) {
        resultados.push({ archivo: filename, status: "ignorado", razon: `extensión ${fileExt} no válida` })
        continue
      }

      // Leer como base64
      const fileBuf = await Deno.readFile(filePath)
      const b64 = btoa(String.fromCharCode(...fileBuf))
      const mime = getMime(filename)

      // Llamar a la edge function correcta con retry ilimitado
      const targetFn = fnName === "ocr-procesar-extracto" ? "ocr-procesar-extracto" : "ocr-procesar-factura"
      let result: any

      if (targetFn === "ocr-procesar-extracto") {
        // Para extractos pasa titular_id
        let intento = 0
        while (true) {
          try {
            const resp = await fetch(`${supabaseUrl}/functions/v1/ocr-procesar-extracto`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
              body: JSON.stringify({ fileBase64: b64, filename, mimeType: mime, titular_id }),
            })
            if (resp.ok) { result = await resp.json(); break }
            if (resp.status === 400) { result = { status: "error", detail: await resp.json().catch(() => ({})) }; break }
            throw new Error(`HTTP ${resp.status}`)
          } catch (e) {
            const wait = Math.min(2000 * Math.pow(2, Math.min(intento, 10)), 30000)
            await new Promise(r => setTimeout(r, wait))
            intento++
          }
        }
      } else {
        result = await procesarArchivoConRetry(supabaseUrl, serviceKey, b64, filename, mime)
      }

      resultados.push({ archivo: filename, ...result })
    }

    // Limpieza tmp
    await Deno.remove(tmpDir, { recursive: true }).catch(() => {})

    // Limpiar el archivo comprimido original de ocr-uploads
    await supabase.storage.from("ocr-uploads").remove([storagePath]).catch(() => {})

    return new Response(JSON.stringify({ status: "ok", procesados: resultados.length, resultados }), { headers: corsHeaders })

  } catch (err) {
    return new Response(JSON.stringify({ error: "unhandled", detail: String(err) }), { status: 500, headers: corsHeaders })
  }
})
