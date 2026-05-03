# Job: OCR funcional — Edge functions + UI + placeholder Listado Facturas

## Contexto
Reescribimos `Ocr.tsx` con schema real, ahora hacemos el módulo completo funcional:
- 2 edge functions (facturas + extractos bancarios)
- Conectar botón Subir según tab
- Modal "¿De quién es?" para extractos (Rubén / Emilio)
- Reglas OCR auto-aprendizaje (manual ahora, auto-match futuro)
- Toast progreso
- Modal multi-doc en columna DOC
- Placeholder "Listado de Facturas" en módulo Finanzas
- Tab "Reglas OCR" en Configuración > Bancos

## Constantes
- RUBEN_ID = `6ce69d55-60d0-423c-b68b-eb795a0f32fe` (NIF 21669051S)
- EMILIO_ID = `c5358d43-a9cc-4f4c-b0b3-99895bdf4354` (NIF 53484832B)
- ANTHROPIC_API_KEY → leer desde `Deno.env.get('ANTHROPIC_API_KEY')`. Si no existe, hacer `supabase secrets set ANTHROPIC_API_KEY=<valor>` previamente vía Supabase MCP — el secret debe quedar disponible para las edge functions.
- Drive folder root: `/00 SISTEMA STREAT LAB/05 OPERACIONES/05 FACTURAS RECIBIDAS/`
- Match conciliación: titular_id + total exacto al céntimo + fecha exacta. Sin desviaciones.

## Schema Supabase (verificado)

### Tabla `facturas`
id, proveedor_id, proveedor_nombre, numero_factura, fecha_factura, tipo (proveedor/plataforma/otro), plataforma, base_4/10/21, iva_4/10/21, total, pdf_drive_url, pdf_filename, pdf_hash, estado, titular_id, nif_emisor, nif_cliente, categoria_factura, ocr_confianza, ocr_raw

### Tabla `facturas_gastos` (N:N)
factura_id, conciliacion_id, importe_asociado, confirmado, confianza_match, cruza_cuentas

### Tabla `conciliacion`
fecha, concepto, importe, categoria, titular_id, factura_id (legacy 1:1), doc_estado, ordenante, beneficiario

### Tabla `reglas_ocr` (ya creada)
id, patron_nif, patron_nombre, categoria_codigo, titular_id, proveedor_canonico, activa

---

## TAREA 1 — Edge function `ocr-procesar-factura`

Crear archivo `supabase/functions/ocr-procesar-factura/index.ts`:

```typescript
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

    // 1. Hash MD5 para dedup
    const binary = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0))
    const hashBuffer = await crypto.subtle.digest("SHA-256", binary)
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("")

    // 2. Dedup: ¿existe ya?
    const { data: existente } = await supabase
      .from("facturas")
      .select("id")
      .eq("pdf_hash", hashHex)
      .maybeSingle()

    if (existente) {
      return new Response(JSON.stringify({ status: "duplicado", factura_id: existente.id }), { headers: corsHeaders })
    }

    // 3. OCR con Claude API
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

    // 4. Determinar titular por NIF cliente
    let titular_id: string | null = null
    if (parsed.nif_cliente === NIF_RUBEN) titular_id = RUBEN_ID
    else if (parsed.nif_cliente === NIF_EMILIO) titular_id = EMILIO_ID

    // 5. Aplicar reglas_ocr por NIF emisor
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

    // 6. Subir PDF a Storage Supabase (en lugar de Drive directo, más simple)
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

    // 7. Insertar factura
    const { data: facturaIns, error: insErr } = await supabase
      .from("facturas")
      .insert({
        proveedor_nombre: parsed.proveedor_nombre,
        numero_factura: parsed.numero_factura,
        fecha_factura: parsed.fecha_factura,
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
        pdf_hash: hashHex,
        titular_id,
        nif_emisor: parsed.nif_emisor,
        nif_cliente: parsed.nif_cliente,
        categoria_factura,
        ocr_confianza: parsed.confianza,
        ocr_raw: parsed,
        estado: "asociada",
      })
      .select("id")
      .single()

    if (insErr) {
      return new Response(JSON.stringify({ error: "insert_error", detail: insErr.message }), { status: 500, headers: corsHeaders })
    }

    // 8. Match exacto en conciliación: titular + total exacto + fecha exacta
    let matched = false
    if (titular_id && parsed.total && parsed.fecha_factura) {
      const { data: movs } = await supabase
        .from("conciliacion")
        .select("id")
        .eq("titular_id", titular_id)
        .eq("fecha", parsed.fecha_factura)
        .eq("importe", -Math.abs(parsed.total))
        .limit(1)

      if (movs && movs.length > 0) {
        await supabase.from("facturas_gastos").insert({
          factura_id: facturaIns.id,
          conciliacion_id: movs[0].id,
          importe_asociado: parsed.total,
          confirmado: true,
          confianza_match: 100,
        })
        matched = true
      }
    }

    return new Response(JSON.stringify({
      status: "ok",
      factura_id: facturaIns.id,
      matched,
      sin_categoria: !categoria_factura,
      sin_titular: !titular_id,
    }), { headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: "unhandled", detail: String(err) }), { status: 500, headers: corsHeaders })
  }
})
```

---

## TAREA 2 — Edge function `ocr-procesar-extracto`

Crear `supabase/functions/ocr-procesar-extracto/index.ts`:

```typescript
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

    // Dedup: marca pdf_hash en facturas tipo='otro' categoria='extracto_bancario'
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
      // Dedup por (titular_id + fecha + importe + concepto)
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

      // Aplicar regla_ocr por nombre (concepto)
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

    // Subir PDF a storage
    const titNombre = titular_id === "6ce69d55-60d0-423c-b68b-eb795a0f32fe" ? "RUBEN" : "EMILIO"
    const today = new Date().toISOString().slice(0, 10)
    const path = `EXTRACTOS/${titNombre}/${today}-${filename}`
    await supabase.storage.from("facturas").upload(path, binary, { contentType: mimeType, upsert: false })

    // Registrar el extracto como factura tipo otro para no duplicarlo
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
```

---

## TAREA 3 — Modificar `src/pages/Ocr.tsx`

Reemplazar `handleSubir` y añadir modal selector titular para extractos. Añadir toast de progreso.

Añadir estos imports y estado en el componente Ocr:

```tsx
const [toast, setToast] = useState<{enviados: number; ok: number; pendientes: number; duplicados: number; total: number; visible: boolean} | null>(null)
const [modalTitular, setModalTitular] = useState<{archivos: File[]; visible: boolean}>({ archivos: [], visible: false })
```

Reemplazar `handleSubir` por:

```tsx
const handleSubir = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.accept = '.pdf,.png,.jpg,.jpeg,.webp'
  input.onchange = async (e: any) => {
    const files = Array.from(e.target.files || []) as File[]
    if (files.length === 0) return

    if (tab === 'extractos') {
      setModalTitular({ archivos: files, visible: true })
      return
    }

    procesarLote(files, null)
  }
  input.click()
}

const procesarLote = async (files: File[], titular_id_forzado: string | null) => {
  setToast({ enviados: 0, ok: 0, pendientes: 0, duplicados: 0, total: files.length, visible: true })

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const base64 = await new Promise<string>((res, rej) => {
      const r = new FileReader()
      r.onload = () => res((r.result as string).split(',')[1])
      r.onerror = () => rej()
      r.readAsDataURL(file)
    })

    const fnName = tab === 'extractos' ? 'ocr-procesar-extracto' : 'ocr-procesar-factura'
    const body = tab === 'extractos'
      ? { fileBase64: base64, filename: file.name, mimeType: file.type, titular_id: titular_id_forzado }
      : { fileBase64: base64, filename: file.name, mimeType: file.type }

    try {
      const { data } = await supabase.functions.invoke(fnName, { body })

      setToast(t => {
        if (!t) return t
        const next = { ...t, enviados: t.enviados + 1 }
        if (data?.status === 'duplicado') next.duplicados++
        else if (data?.status === 'ok' && data?.matched) next.ok++
        else next.pendientes++
        return next
      })
    } catch {
      setToast(t => t ? { ...t, enviados: t.enviados + 1, pendientes: t.pendientes + 1 } : t)
    }
  }

  setTimeout(() => setToast(null), 6000)
  cargarPagina()
  cargarAgregados()
}
```

Y añadir al JSX, justo antes del cierre del componente (último `</div>` de return):

```tsx
{/* Modal selector titular para extractos */}
{modalTitular.visible && (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
    <div style={{ background: '#fff', padding: 28, borderRadius: 14, minWidth: 340, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase', color: '#B01D23', marginBottom: 8 }}>Extracto bancario</div>
      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 14, color: '#111', marginBottom: 18 }}>¿De quién es este extracto?</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => { procesarLote(modalTitular.archivos, '6ce69d55-60d0-423c-b68b-eb795a0f32fe'); setModalTitular({ archivos: [], visible: false }) }}
          style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '0.5px solid #F26B1F', background: '#F26B1F', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer' }}>
          Rubén
        </button>
        <button onClick={() => { procesarLote(modalTitular.archivos, 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'); setModalTitular({ archivos: [], visible: false }) }}
          style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '0.5px solid #1E5BCC', background: '#1E5BCC', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer' }}>
          Emilio
        </button>
      </div>
      <button onClick={() => setModalTitular({ archivos: [], visible: false })}
        style={{ marginTop: 14, width: '100%', padding: '8px', background: 'none', border: 'none', color: '#7a8090', fontFamily: 'Lexend, sans-serif', fontSize: 12, cursor: 'pointer' }}>
        Cancelar
      </button>
    </div>
  </div>
)}

{/* Toast progreso */}
{toast && toast.visible && (
  <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#1e2233', color: '#fff', padding: '14px 18px', borderRadius: 12, minWidth: 280, fontFamily: 'Lexend, sans-serif', fontSize: 13, zIndex: 99, boxShadow: '0 6px 20px rgba(0,0,0,0.25)' }}>
    <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 8, color: '#e8f442' }}>Procesando…</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
      <div>Enviados: <b>{toast.enviados}/{toast.total}</b></div>
      <div style={{ color: '#1D9E75' }}>Conciliados: <b>{toast.ok}</b></div>
      <div style={{ color: '#F26B1F' }}>Pendientes: <b>{toast.pendientes}</b></div>
      <div style={{ color: '#7a8090' }}>Duplicados: <b>{toast.duplicados}</b></div>
    </div>
    <div style={{ marginTop: 10, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${(toast.enviados / toast.total) * 100}%`, height: '100%', background: '#1D9E75', transition: 'width 0.3s' }} />
    </div>
  </div>
)}
```

---

## TAREA 4 — Placeholder "Listado de Facturas"

Crear archivo `src/pages/finanzas/ListadoFacturas.tsx`:

```tsx
import { FONT } from '@/styles/tokens'

export default function ListadoFacturas() {
  return (
    <div style={{ background: '#f5f3ef', padding: '24px 28px', minHeight: '100%' }}>
      <h1 style={{
        fontFamily: FONT.heading,
        fontSize: 22,
        fontWeight: 600,
        color: '#B01D23',
        textTransform: 'uppercase',
        letterSpacing: '3px',
        margin: 0,
      }}>
        Listado de Facturas
      </h1>
      <p style={{ fontFamily: FONT.body, fontSize: 13, color: '#7a8090', marginTop: 8 }}>
        Próximamente — consulta y filtrado avanzado de todas las facturas registradas.
      </p>
    </div>
  )
}
```

En `src/App.tsx`, añadir el import junto a los otros de `finanzas`:
```tsx
import ListadoFacturas from '@/pages/finanzas/ListadoFacturas'
```

Y la ruta dentro del bloque de Finanzas (justo antes de `<Route path="finanzas/pagos-cobros"...`):
```tsx
<Route path="finanzas/listado-facturas" element={<ProtectedRoute solo={['admin']}><ListadoFacturas /></ProtectedRoute>} />
```

En `src/components/Sidebar.tsx`, en la sección `finanzas` del array `SECTIONS`, añadir como último ítem antes del OCR:
```tsx
{ path: '/finanzas/listado-facturas',     label: 'Listado de Facturas', emoji: '🧾', perfiles: ['admin'] },
```

(Es decir, debe quedar justo encima del item `/ocr`).

---

## TAREA 5 — Tab "Reglas OCR" en Configuración > Bancos

Inspeccionar `src/pages/configuracion/bancos/BancosYCuentasPage.tsx`. Localizar el componente que renderiza tabs (nombres tipo "Reglas", "Categorías", etc).

Acción:
1. Renombrar el tab existente "Reglas" a "Reglas bancarias" (es lo que ya existe).
2. Añadir nuevo tab "Reglas OCR" que renderiza un nuevo componente `<ReglasOcrPanel />`.
3. Crear `src/pages/configuracion/bancos/ReglasOcrPanel.tsx` calcado del existente `ReglasPanel.tsx` pero apuntando a la tabla `reglas_ocr` con campos: patron_nif (opcional), patron_nombre (opcional), categoria_codigo (FK a categorias_pyg, requerido), titular_id (opcional), proveedor_canonico (opcional), activa (boolean).

El CRUD debe ser idéntico al de ReglasPanel: lista con buscador, botón "+ Nueva regla", modal de creación/edición, switch activa/inactiva, eliminar.

En el formulario de regla, añadir nota textual: "💡 patron_nif aplica a facturas. patron_nombre aplica a extractos bancarios. Rellenando ambos, una sola regla cubre los dos casos."

---

## TAREA 6 — Conciliación: icono 📎 abre PDF

(Ya implementado correctamente. Solo verificar que en `src/pages/Conciliacion.tsx` el onClick del icono `clip-rounded` o equivalente abre `f.pdf_drive_url` en nueva pestaña cuando existe. Si ya está, no tocar nada.)

---

## TAREA 7 — Bucket Supabase Storage

Ejecutar SQL para crear bucket `facturas` si no existe:

```sql
insert into storage.buckets (id, name, public) values ('facturas', 'facturas', true) on conflict (id) do nothing;

create policy "facturas insert" on storage.objects for insert to authenticated with check (bucket_id = 'facturas');
create policy "facturas select" on storage.objects for select to authenticated using (bucket_id = 'facturas');
create policy "facturas update" on storage.objects for update to authenticated using (bucket_id = 'facturas');
create policy "facturas delete" on storage.objects for delete to authenticated using (bucket_id = 'facturas');
```

---

## Verificación
1. `npm run build` debe pasar sin errores TS.
2. Las dos edge functions deben quedar deployadas con `supabase functions deploy ocr-procesar-factura` y `supabase functions deploy ocr-procesar-extracto`.
3. La página `/ocr` debe mostrar:
   - Tab Facturas → botón "Subir facturas" abre selector de archivos directo
   - Tab Extractos → botón "Subir extractos" abre modal "¿De quién es?"
   - Tab Otros → botón "Subir documentos" abre selector
4. Tras subir, debe aparecer toast con progreso y resultados.
5. Sidebar Finanzas debe mostrar nuevo ítem "Listado de Facturas" con emoji 🧾.
6. Configuración > Bancos debe tener nuevo tab "Reglas OCR".

## Commit
```
feat(ocr): edge functions facturas/extractos + UI funcional + placeholder listado + reglas OCR
```
