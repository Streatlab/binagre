import { useState, useRef } from 'react'
import { useOcrUpload, TAM_LOTE } from '@/lib/ocrUploadStore'
import { toast } from '@/lib/toastStore'
import { enviarAEquipoSeguro } from '@/lib/equipo/subidaSegura'
import AvisosBandeja from '@/components/documentacion/AvisosBandeja'
import { OSW, LEX, INK, CREMA, CLARO, SHADOW, BORDER, BORDER_CARD, GRANATE, VERDE, NAR, AZUL, ROJO, GRIS, BLANCO } from '@/styles/neobrutal'
import { HeroCantera, FrasePotente, PantallaCantera } from '@/components/kit/cantera'

// ── Bandeja de entrada — 5 BOTONES ──────────────────────────────────────────
//   · BANCO    → extracto (CSV/PDF). Pregunta titular y vuelca a Conciliación.
//   · VENTAS   → liquidaciones, resúmenes, historial de pedidos y productos de
//     plataforma (Uber, Glovo, Just Eat, Sinqro, Rushour). Van directos a Ventas.
//   · FACTURAS → OCR + Drive + contraste con Conciliación.
//   · EQUIPO   → nóminas, resumen de nóminas y Seguridad Social (RLC/RNT).
//   · CORREO   → acción directa: recoge el buzón ahora mismo (no sube archivos).

const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'

const EXT_PDF_IMG = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'heic', 'heif', 'tif', 'tiff', 'gif', 'bmp']
const EXT_OFFICE = ['doc', 'docx', 'xls', 'xlsx', 'csv', 'html', 'htm', 'txt']
const EXT_COMPRIMIDOS = ['zip', 'rar', '7z']
const EXT_ACEPTADAS = [...EXT_PDF_IMG, ...EXT_OFFICE, ...EXT_COMPRIMIDOS]
const ACCEPT = EXT_ACEPTADAS.map(e => `.${e}`).join(',')

// Ningún documento puede colgar la tanda entera. Si el servidor no contesta en
// este tiempo, ese archivo se da por fallido y se sigue con el resto.
const TIMEOUT_DOC_MS = 90_000
const EN_PARALELO = 4

async function fetchConTimeout(url: string, init: RequestInit, ms = TIMEOUT_DOC_MS): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { ...init, signal: ctrl.signal }) }
  finally { clearTimeout(t) }
}

/** Recorre una lista con varias tareas a la vez, sin que una lenta frene al resto. */
async function enParalelo<T>(items: T[], limite: number, tarea: (item: T) => Promise<void>) {
  let siguiente = 0
  const obreros = Array.from({ length: Math.min(limite, items.length) }, async () => {
    for (;;) {
      const i = siguiente++
      if (i >= items.length) return
      await tarea(items[i])
    }
  })
  await Promise.all(obreros)
}

// ── Reconocimiento cliente de documentos de VENTAS (CSV) ────────────────────
function esResumenUberTexto(texto: string): boolean {
  const cab = (texto || '').slice(0, 2000).toLowerCase()
  const primera = (texto.split('\n')[0] || '').toLowerCase()
  if (primera.includes('restaurante') && primera.includes('valor del recibo') && primera.includes('estado del pedido')) return true
  if (primera.includes('id. del pedido') && primera.includes('nombre del artículo') && primera.includes('precio unitario')) return true
  if (primera.includes('order id') && primera.includes('order received at') && primera.includes('order status')) return true
  if (cab.includes('nombre del local') && cab.includes('total parcial')) return true
  const cols = primera.replace(/csv\./g, '').split(',')
  const nombre = cols.some(c => c.includes('nombre') || c.includes('producto') || c.includes('name'))
  const cantidad = cols.some(c => c.includes('cantidad') || c.includes('unidades') || c.includes('vendidas'))
  if (nombre && cantidad && cols.length <= 6) return true
  const marca = cab.includes('nombre del restaurante') || cab.includes('store name') || cab.includes('restaurant name')
  const pago = cab.includes('pago total') || cab.includes('net payout') || cab.includes('total payout')
  const ref = cab.includes('referencia de ganancias') || cab.includes('earnings reference') || cab.includes('payment reference')
  return marca && (pago || ref)
}

async function fileABase64(file: File | Blob): Promise<string> {
  const buf = await file.arrayBuffer()
  let bin = ''
  const bytes = new Uint8Array(buf)
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)) as unknown as number[])
  }
  return btoa(bin)
}

async function cargarJSZip(): Promise<any> {
  if ((window as any).JSZip) return (window as any).JSZip
  await new Promise<void>((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload = () => res(); s.onerror = () => rej(new Error('No se pudo cargar JSZip')); document.head.appendChild(s) })
  return (window as any).JSZip
}

const MAX_NIVEL_ZIP = 5

async function expandirZipRecursivo(f: File | Blob, nombreOrigen: string, validas: Set<string>, aceptados: File[], comprimidos: File[], rechazados: string[], contador: { n: number }, nivel: number) {
  if (nivel > MAX_NIVEL_ZIP) { rechazados.push(`${nombreOrigen} (ZIP demasiado anidado)`); return }
  try {
    const JSZip = await cargarJSZip()
    const zip = await JSZip.loadAsync(f)
    for (const path of Object.keys(zip.files)) {
      const entry = zip.files[path]
      if (entry.dir) continue
      const innerName = path.split('/').pop() || path
      const innerExt = innerName.split('.').pop()?.toLowerCase() ?? ''
      const blob = await entry.async('blob')
      if (innerExt === 'zip') { await expandirZipRecursivo(blob, `${nombreOrigen} → ${innerName}`, validas, aceptados, comprimidos, rechazados, contador, nivel + 1); continue }
      if (innerExt === 'rar' || innerExt === '7z') { comprimidos.push(new File([blob], innerName, { type: 'application/octet-stream' })); continue }
      if (!validas.has(innerExt)) { rechazados.push(`${nombreOrigen} → ${innerName}`); continue }
      aceptados.push(new File([blob], innerName, { type: blob.type || 'application/octet-stream' }))
      contador.n++
    }
  } catch (err: any) { rechazados.push(`${nombreOrigen} (zip corrupto: ${err?.message || 'error'})`) }
}

async function expandirArchivos(files: File[]): Promise<{ aceptados: File[]; comprimidos: File[]; rechazados: string[] }> {
  const aceptados: File[] = [], comprimidos: File[] = [], rechazados: string[] = [], contador = { n: 0 }
  const validas = new Set(EXT_ACEPTADAS.map(e => e.toLowerCase()))
  const validasSinComp = new Set([...validas].filter(e => !['zip', 'rar', '7z'].includes(e)))
  for (const f of files) {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (ext === 'zip') { await expandirZipRecursivo(f, f.name, validasSinComp, aceptados, comprimidos, rechazados, contador, 1) }
    else if (ext === 'rar' || ext === '7z') { comprimidos.push(f) }
    else if (validas.has(ext)) { aceptados.push(f) }
    else { rechazados.push(f.name) }
  }
  return { aceptados, comprimidos, rechazados }
}

// ── Botón de acción directa (no sube archivos): recoge el buzón de correo ──
function BtnCorreo({ label, sub, color, colorHover, onClick, ocupado }: {
  label: string; sub: string; color: string; colorHover: string
  onClick: () => void; ocupado: boolean
}) {
  const [over, setOver] = useState(false)
  return (
    <div
      onMouseEnter={() => setOver(true)} onMouseLeave={() => setOver(false)}
      onClick={() => { if (!ocupado) onClick() }}
      style={{
        flex: 1, minWidth: 160, border: BORDER_CARD, boxShadow: SHADOW,
        background: over && !ocupado ? colorHover : color, cursor: ocupado ? 'wait' : 'pointer',
        padding: '18px 14px', textAlign: 'center', userSelect: 'none', position: 'relative',
        transition: 'background 0.15s', opacity: ocupado ? 0.6 : 1,
      }}
    >
      <div style={{ fontFamily: OSW, fontSize: 17, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: BLANCO, lineHeight: 1.2 }}>
        {ocupado ? 'Recogiendo…' : label}
      </div>
      <div style={{ fontFamily: LEX, fontSize: 11.5, color: 'rgba(255,255,255,0.92)', marginTop: 6, lineHeight: 1.35 }}>{sub}</div>
    </div>
  )
}

type Destino = 'banco' | 'ventas' | 'facturas' | 'equipo'

function BtnSubir({ label, sub, color, colorHover, onArchivos, preparando }: {
  label: string; sub: string; color: string; colorHover: string
  onArchivos: (r: { aceptados: File[]; comprimidos: File[]; rechazados: string[] }) => void
  preparando: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const carpetaRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [elegir, setElegir] = useState(false)
  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return
    setOcupado(true)
    try { const arr = Array.isArray(files) ? files : Array.from(files); onArchivos(await expandirArchivos(arr)) }
    finally { setOcupado(false) }
  }
  const bloqueado = preparando || ocupado
  return (
    <div
      onDragOver={e => { if (bloqueado) return; e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { if (bloqueado) return; e.preventDefault(); setOver(false); handleFiles(e.dataTransfer.files) }}
      onClick={() => { if (!bloqueado) setElegir(true) }}
      style={{
        flex: 1, minWidth: 160, border: BORDER_CARD, boxShadow: SHADOW,
        background: over ? colorHover : color, cursor: bloqueado ? 'wait' : 'pointer',
        padding: '18px 14px', textAlign: 'center', userSelect: 'none', position: 'relative',
        transition: 'background 0.15s', opacity: bloqueado ? 0.6 : 1,
      }}
    >
      <input ref={inputRef} type="file" multiple accept={ACCEPT} style={{ display: 'none' }}
        onClick={e => e.stopPropagation()}
        onChange={e => { handleFiles(e.target.files); if (inputRef.current) inputRef.current.value = '' }} />
      <input ref={carpetaRef} type="file" style={{ display: 'none' }}
        {...({ webkitdirectory: '', directory: '', mozdirectory: '' } as any)}
        onClick={e => e.stopPropagation()}
        onChange={e => { handleFiles(e.target.files); if (carpetaRef.current) carpetaRef.current.value = '' }} />
      <div style={{ fontFamily: OSW, fontSize: 17, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: BLANCO, lineHeight: 1.2 }}>{label}</div>
      <div style={{ fontFamily: LEX, fontSize: 11.5, color: 'rgba(255,255,255,0.92)', marginTop: 6, lineHeight: 1.35 }}>{sub}</div>
      {ocupado && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', pointerEvents: 'none' }}>
          <div style={{ fontFamily: OSW, fontSize: 13, color: BLANCO, letterSpacing: '2px', textTransform: 'uppercase' }}>Preparando…</div>
        </div>
      )}

      {elegir && (
        <div onClick={e => { e.stopPropagation(); setElegir(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: CREMA, padding: 24, minWidth: 300, maxWidth: 360, border: BORDER, boxShadow: '8px 8px 0 rgba(0,0,0,0.25)' }}>
            <div style={{ fontFamily: OSW, fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase', color, marginBottom: 4 }}>{label}</div>
            <div style={{ fontFamily: LEX, fontSize: 13, color: INK, marginBottom: 16 }}>¿Qué quieres subir?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => { setElegir(false); setTimeout(() => inputRef.current?.click(), 0) }}
                style={{ padding: '14px', border: BORDER_CARD, boxShadow: SHADOW, background: color, color: BLANCO, fontFamily: OSW, fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer' }}>Archivos sueltos</button>
              <button onClick={() => { setElegir(false); setTimeout(() => carpetaRef.current?.click(), 0) }}
                style={{ padding: '14px', border: BORDER_CARD, boxShadow: SHADOW, background: BLANCO, color: INK, fontFamily: OSW, fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer' }}>Carpeta entera</button>
            </div>
            <button onClick={() => setElegir(false)} style={{ marginTop: 14, width: '100%', padding: '8px', background: 'none', border: 'none', color: GRIS, fontFamily: LEX, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BandejaEntrada({ onProcesado }: { desde?: string; hasta?: string; onProcesado?: () => void }) {
  const { procesar } = useOcrUpload()
  const [preparando] = useState(false)
  const [verRechazados, setVerRechazados] = useState(false)
  const [recogiendoCorreo, setRecogiendoCorreo] = useState(false)

  const recogerCorreo = async () => {
    if (recogiendoCorreo) return
    setRecogiendoCorreo(true)
    const tid = toast.loading('Recogiendo correo…')
    try {
      const r = await fetchConTimeout('/api/facturas?action=cartero', {}, 180_000)
      const j = await r.json()
      if (j.ok) {
        const nFac = Number(j.nuevas) || 0
        const dup = Number(j.duplicadas) || 0
        const man = Number(j.lectura_manual) || 0
        const partes = [`${nFac} nueva${nFac === 1 ? '' : 's'}`]
        if (dup > 0) partes.push(`${dup} ya estaban`)
        if (man > 0) partes.push(`${man} a revisar`)
        toast.success(`Correo recogido · ${partes.join(' · ')}`, { id: tid })
        onProcesado?.()
      } else {
        toast.error(j.error || 'No se pudo recoger el correo', { id: tid })
      }
    } catch (e: any) {
      const msg = e?.name === 'AbortError' ? 'El buzón tardó demasiado en responder' : (e?.message || 'Error de red al recoger el correo')
      toast.error(msg, { id: tid })
    } finally {
      setRecogiendoCorreo(false)
    }
  }

  const [modal, setModal] = useState<{ destino: Destino; archivos: File[]; rechazados: string[]; visible: boolean }>({ destino: 'facturas', archivos: [], rechazados: [], visible: false })
  const UMBRAL_CONFIRMACION_MASIVA = 2000
  const [confirmoLotes, setConfirmoLotes] = useState(false)

  const abrirModal = (destino: Destino) => (r: { aceptados: File[]; comprimidos: File[]; rechazados: string[] }) => {
    setVerRechazados(false)
    setConfirmoLotes(false)
    const todos = [...r.aceptados, ...r.comprimidos]
    if (todos.length === 0 && r.rechazados.length === 0) return
    setModal({ destino, archivos: todos, rechazados: r.rechazados, visible: true })
  }
  const numLotes = Math.max(1, Math.ceil(modal.archivos.length / TAM_LOTE))
  const requiereConfirmacionMasiva = modal.archivos.length > UMBRAL_CONFIRMACION_MASIVA
  const bloqueadoPorLotes = requiereConfirmacionMasiva && !confirmoLotes

  const separarVentas = async (archivos: File[]): Promise<{ ventas: File[]; resto: File[] }> => {
    const ventas: File[] = []
    const resto: File[] = []
    for (const f of archivos) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
      if (ext === 'csv' || ext === 'txt') {
        try { const t = await f.text(); if (esResumenUberTexto(t)) { ventas.push(f); continue } } catch { /* sigue */ }
      }
      resto.push(f)
    }
    return { ventas, resto }
  }

  const enviarAVentas = async (ventas: File[]) => {
    if (ventas.length === 0) return
    const tid = toast.loading(`Leyendo documentos de ventas (${ventas.length})…`)
    let tiendas = 0, nuevas = 0, actualizadas = 0, pedidos = 0, productos = 0, neto = 0
    const errs: string[] = []
    try {
      await enParalelo(ventas, EN_PARALELO, async (f) => {
        try {
          const base64 = await fileABase64(f)
          const res = await fetchConTimeout('/api/importar/plataforma', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64, nombre: f.name, mimeType: f.type || null, modulo: 'bandeja' }),
          })
          const j = await res.json()
          if (j.ok && j.tipo_detectado === 'liquidacion_uber_resumen') {
            tiendas = Math.max(tiendas, Number(j.tiendas) || 0)
            nuevas += Number(j.nuevas) || 0
            actualizadas += Number(j.actualizadas) || 0
            pedidos += Number(j.totalPedidos) || 0
            neto += Number(j.totalNeto) || 0
          } else if (j.ok && (j.tipo_detectado === 'uber_historial_pedidos' || j.tipo_detectado === 'just_eat_pedidos' || j.tipo_detectado === 'uber_detalle_articulo' || j.tipo_detectado === 'glovo_orderdetails')) {
            pedidos += Number(j.pedidos) || 0
            productos += Number(j.productos) || 0
          } else if (j.ok && j.tipo_detectado === 'productos_vendidos') {
            productos += Number(j.productos) || 0
          } else {
            errs.push(`${f.name}: ${j.mensaje || 'no reconocido'}`)
          }
        } catch (e: any) {
          errs.push(`${f.name}: ${e?.name === 'AbortError' ? 'tardó demasiado' : (e?.message || 'error de red')}`)
        }
      })
    } finally {
      if (errs.length > 0 && nuevas + actualizadas + pedidos + productos === 0) {
        toast.error(`No se pudo leer el documento de ventas: ${errs[0]}`, { id: tid })
      } else {
        const partes: string[] = []
        if (tiendas) partes.push(`${tiendas} tiendas`)
        if (nuevas || actualizadas) partes.push(`${nuevas} nuevas, ${actualizadas} actualizadas`)
        if (pedidos) partes.push(`${pedidos} pedidos`)
        if (productos) partes.push(`${productos} productos`)
        if (neto) partes.push(`neto ${neto.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`)
        if (errs.length) partes.push(`${errs.length} con problema`)
        toast.success(`Ventas · ${partes.join(' · ') || 'procesado'}`, { id: tid })
      }
    }
  }

  // EQUIPO: subida segura. Guarda primero, lee después. Lo que no se lea queda
  // apuntado y la repesca automática lo recupera: no se pierde ningún documento.
  const enviarAEquipo = async (archivos: File[]) => {
    if (archivos.length === 0) return
    const tid = toast.loading(`Leyendo documentos de equipo (0/${archivos.length})…`)
    try {
      const r = await enviarAEquipoSeguro(archivos, (hechos, total) => {
        toast.loading(`Leyendo documentos de equipo (${hechos}/${total})…`, { id: tid })
      })
      // Resumen con VERDAD: lo de personal, lo que se reenvió (y a qué módulo lo
      // recogió de verdad) y lo que se rechazó por no ser de ningún buzón.
      const partes: string[] = []
      if (r.nominas) partes.push(`${r.nominas} nómina${r.nominas !== 1 ? 's' : ''}`)
      if (r.resumenes) partes.push(`${r.resumenes} resumen${r.resumenes !== 1 ? 'es' : ''}`)
      if (r.segSocial) partes.push(`${r.segSocial} Seguridad Social`)
      if (r.revisar) partes.push(`${r.revisar} por revisar`)

      const reenv = Object.entries(r.reencaminados)
      const totalReenv = reenv.reduce((a, [, n]) => a + n, 0)
      const frases: string[] = []
      if (totalReenv > 0) {
        frases.push(
          `${totalReenv} documento${totalReenv !== 1 ? 's' : ''} no ${totalReenv !== 1 ? 'eran' : 'era'} de personal: ` +
          reenv.map(([mod, n]) => `${n} a ${mod}`).join(' y ') + '.',
        )
      }
      if (r.rechazados.length > 0) {
        frases.push(
          `${r.rechazados.length} rechazado${r.rechazados.length !== 1 ? 's' : ''} ` +
          `(${r.rechazados[0].nombre}: ${r.rechazados[0].motivo})`,
        )
      }
      if (r.aRepescar > 0) {
        frases.push(`${r.aRepescar} en repesca: están guardados y se reintentan solos, no hace falta volver a subirlos.`)
      }

      const cabecera = partes.length > 0 ? `EQUIPO · ${partes.join(' · ')}` : 'EQUIPO'
      const texto = [cabecera, ...frases].join(' — ')

      if (partes.length === 0 && totalReenv === 0 && r.rechazados.length === 0 && r.aRepescar === 0) {
        toast.error(`No se pudo procesar: ${r.errores[0] || 'sin respuesta'}`, { id: tid })
      } else if (r.rechazados.length > 0 || r.aRepescar > 0) {
        toast.aviso(texto, { id: tid, duration: 25000 })
      } else if (totalReenv > 0) {
        toast.success(texto, { id: tid, duration: 20000 })
      } else {
        toast.success(texto, { id: tid })
      }
    } catch (e: any) {
      toast.error(e?.message || 'Error al enviar los documentos de equipo', { id: tid })
    }
  }

  const enviar = async (titular?: string) => {
    const { destino, archivos } = modal
    setModal(m => ({ ...m, visible: false, archivos: [], rechazados: [] }))
    if (archivos.length === 0) return

    if (destino === 'banco') {
      if (!titular) {
        toast.error('Falta decir de quién es el extracto. Elige Rubén o Emilio.')
        return
      }
      procesar(archivos, 'ocr-procesar-extracto', titular)
      onProcesado?.()
      return
    }

    if (destino === 'equipo') {
      await enviarAEquipo(archivos)
      onProcesado?.()
      return
    }

    const { ventas, resto } = await separarVentas(archivos)

    if (destino === 'ventas') {
      if (resto.length > 0) {
        toast.success(`${resto.length} documento${resto.length !== 1 ? 's' : ''} enviado${resto.length !== 1 ? 's' : ''} al clasificador: lo que sea de ventas entra en Ventas y el resto en Facturas.`)
        procesar(resto, 'ocr-procesar-factura', null)
      }
      await enviarAVentas(ventas)
      onProcesado?.()
      return
    }

    if (ventas.length > 0) {
      toast.success(`${ventas.length} documento${ventas.length !== 1 ? 's' : ''} de ventas detectado${ventas.length !== 1 ? 's' : ''}: enviado${ventas.length !== 1 ? 's' : ''} a Ventas.`)
      await enviarAVentas(ventas)
    }
    if (resto.length > 0) procesar(resto, 'ocr-procesar-factura', null)
    onProcesado?.()
  }

  const tituloModal = modal.destino === 'banco' ? 'Extracto bancario' : modal.destino === 'ventas' ? 'Documentos de ventas' : modal.destino === 'equipo' ? 'Documentos de equipo' : 'Facturas'
  const colorTitulo = modal.destino === 'banco' ? AZUL : modal.destino === 'ventas' ? VERDE : modal.destino === 'equipo' ? VERDE : GRANATE

  return (
    <PantallaCantera embedded style={{ marginTop: 16 }}>
      <HeroCantera
        area="papeleo"
        titular="Suelta lo que sea: el sistema lo lee y lo reparte solo."
        resumen="Banco, ventas, facturas o equipo — un botón por destino, sin tener que clasificar nada a mano."
      />
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <BtnSubir
          label="Banco" color={AZUL} colorHover={`color-mix(in srgb, ${AZUL} 75%, black)`}
          sub="Extractos del banco (CSV o PDF). Pregunta de quién es y vuelca a Conciliación."
          onArchivos={abrirModal('banco')} preparando={preparando}
        />
        <BtnSubir
          label="Ventas" color={VERDE} colorHover={`color-mix(in srgb, ${VERDE} 75%, black)`}
          sub="Liquidaciones, resúmenes, historial de pedidos y productos de plataforma. Van directos a Ventas."
          onArchivos={abrirModal('ventas')} preparando={preparando}
        />
        <BtnSubir
          label="Facturas" color={GRANATE} colorHover={`color-mix(in srgb, ${GRANATE} 75%, black)`}
          sub="Facturas de proveedores y plataformas. OCR, Drive y cruce con Conciliación."
          onArchivos={abrirModal('facturas')} preparando={preparando}
        />
        <BtnSubir
          label="Equipo" color={VERDE} colorHover={`color-mix(in srgb, ${VERDE} 65%, black)`}
          sub="Nóminas, resumen y Seguridad Social — suelta todo junto."
          onArchivos={abrirModal('equipo')} preparando={preparando}
        />
        <BtnCorreo
          label="Correo" color={AZUL} colorHover={`color-mix(in srgb, ${AZUL} 65%, black)`}
          sub="Recoge el buzón ahora mismo, sin esperar al robot de las 07:00."
          onClick={recogerCorreo} ocupado={recogiendoCorreo}
        />
      </div>
      <FrasePotente significado="logro">Si un documento entra por el botón equivocado, el sistema lo detecta por contenido, lo redirige solo y te avisa.</FrasePotente>

      <AvisosBandeja onResuelto={() => onProcesado?.()} />

      {modal.visible && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: CREMA, padding: 28, minWidth: 380, maxWidth: 560, border: BORDER, boxShadow: '8px 8px 0 rgba(0,0,0,0.25)' }}>
            <div style={{ fontFamily: OSW, fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase', color: colorTitulo, marginBottom: 12 }}>{tituloModal}</div>
            <div style={{ fontFamily: LEX, fontSize: 16, color: INK, marginBottom: 6 }}>
              Vas a subir <strong style={{ fontFamily: OSW, fontSize: 20, color: VERDE }}>{modal.archivos.length}</strong> documento{modal.archivos.length !== 1 ? 's' : ''}
            </div>
            {modal.rechazados.length > 0 && (
              <>
                <div style={{ fontFamily: LEX, fontSize: 14, color: ROJO, marginBottom: 8 }}>
                  Rechazados: <strong>{modal.rechazados.length}</strong>{' '}
                  <button onClick={() => setVerRechazados(v => !v)} style={{ background: 'none', border: 'none', color: GRANATE, fontFamily: LEX, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>{verRechazados ? 'ocultar' : 'ver lista'}</button>
                </div>
                {verRechazados && (
                  <div style={{ background: CLARO, border: `2px solid ${INK}`, borderRadius: 0, padding: '10px 12px', maxHeight: 180, overflowY: 'auto', fontFamily: LEX, fontSize: 11, color: GRIS, marginBottom: 8 }}>
                    {modal.rechazados.map((nm, i) => <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '2px 0' }}>{nm}</div>)}
                  </div>
                )}
              </>
            )}

            {modal.archivos.length > TAM_LOTE && (
              <div style={{ fontFamily: LEX, fontSize: 12.5, color: INK, background: CLARO, border: `2px solid ${INK}`, padding: '8px 10px', marginBottom: 12 }}>
                Se subirán en <strong>{numLotes}</strong> lotes de {TAM_LOTE} archivos, uno detrás de otro (para no saturar el servidor).
                {requiereConfirmacionMasiva && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={confirmoLotes} onChange={e => setConfirmoLotes(e.target.checked)} />
                    Entiendo, subir en {numLotes} lotes
                  </label>
                )}
              </div>
            )}

            {modal.destino === 'banco' ? (
              <>
                <div style={{ fontFamily: LEX, fontSize: 13, color: INK, marginTop: 10, marginBottom: 14 }}>¿De quién es este extracto?</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button disabled={modal.archivos.length === 0 || bloqueadoPorLotes} onClick={() => enviar(RUBEN_ID)} style={{ flex: 1, padding: '12px 14px', borderRadius: 0, border: BORDER_CARD, boxShadow: SHADOW, background: NAR, color: BLANCO, fontFamily: OSW, fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: modal.archivos.length === 0 || bloqueadoPorLotes ? 'not-allowed' : 'pointer', opacity: modal.archivos.length === 0 || bloqueadoPorLotes ? 0.4 : 1 }}>Rubén</button>
                  <button disabled={modal.archivos.length === 0 || bloqueadoPorLotes} onClick={() => enviar(EMILIO_ID)} style={{ flex: 1, padding: '12px 14px', borderRadius: 0, border: BORDER_CARD, boxShadow: SHADOW, background: AZUL, color: BLANCO, fontFamily: OSW, fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: modal.archivos.length === 0 || bloqueadoPorLotes ? 'not-allowed' : 'pointer', opacity: modal.archivos.length === 0 || bloqueadoPorLotes ? 0.4 : 1 }}>Emilio</button>
                </div>
                <button onClick={() => setModal(m => ({ ...m, visible: false, archivos: [], rechazados: [] }))} style={{ marginTop: 14, width: '100%', padding: '8px', background: 'none', border: 'none', color: GRIS, fontFamily: LEX, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
              </>
            ) : (
              <>
                <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 8, marginBottom: 18 }}>
                  {modal.destino === 'equipo'
                    ? 'Cada documento se guarda antes de leerse. Lo que no sea de personal se reenvía solo al módulo que le toque, y lo que no reconozca ningún módulo se rechaza con el motivo. No se pierde ninguno.'
                    : 'El sistema clasifica cada documento por su contenido, aplica el diccionario de proveedores y lo redirige si no corresponde a este botón.'}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setModal(m => ({ ...m, visible: false, archivos: [], rechazados: [] })); setVerRechazados(false) }} style={{ flex: 1, padding: '12px 14px', borderRadius: 0, border: BORDER_CARD, background: BLANCO, color: INK, fontFamily: OSW, fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer' }}>Cancelar</button>
                  <button disabled={modal.archivos.length === 0 || bloqueadoPorLotes} onClick={() => enviar()} style={{ flex: 1, padding: '12px 14px', borderRadius: 0, border: BORDER_CARD, boxShadow: SHADOW, background: modal.archivos.length === 0 || bloqueadoPorLotes ? CLARO : colorTitulo, color: BLANCO, fontFamily: OSW, fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: modal.archivos.length === 0 || bloqueadoPorLotes ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Enviar {modal.archivos.length}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </PantallaCantera>
  )
}
