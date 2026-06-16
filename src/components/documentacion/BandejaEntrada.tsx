import { useState, useRef } from 'react'
import { useOcrUpload } from '@/lib/ocrUploadStore'
import CardFacturasCorreo from '@/components/panel/resumen/CardFacturasCorreo'
import CardSaludOcr from '@/components/panel/resumen/CardSaludOcr'

// ── Bandeja de entrada — FUENTE ÚNICA DE SUBIDA + CLASIFICADOR ──────────────
// Subes cualquier documento (o carpeta entera, ZIP incluido). El clasificador
// detecta SOLO por el nombre del archivo si es factura, extracto o venta, lo
// pre-selecciona y te deja corregirlo antes de enviar. Cada tipo va a su flujo:
//   · Facturas / Otros → ocr-procesar-factura
//   · Extractos        → ocr-procesar-extracto (pregunta titular)
//   · Ventas           → ocr-procesar-factura (tipo ventas)

const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'

const EXT_PDF_IMG = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'heic', 'heif', 'tif', 'tiff', 'gif', 'bmp']
const EXT_OFFICE = ['doc', 'docx', 'xls', 'xlsx', 'csv', 'html', 'htm', 'txt']
const EXT_COMPRIMIDOS = ['zip', 'rar', '7z']
const EXT_ACEPTADAS = [...EXT_PDF_IMG, ...EXT_OFFICE, ...EXT_COMPRIMIDOS]
const ACCEPT = EXT_ACEPTADAS.map(e => `.${e}`).join(',')

const ES_MOVIL = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)

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

type Modo = 'factura' | 'extracto' | 'venta'

// ── Clasificador: detecta el tipo SOLO por el nombre del archivo ───────────
const RE_EXTRACTO = /(extracto|bbva|movimiento|mov_|n43|norma\s?43|saldo|santander|caixa|sabadell|bankinter|kutxa|unicaja|cuenta\s?corriente|cta\b)/i
const RE_VENTA = /(venta|liquidac|settlement|payout|payment|remesa|uber|glovo|just\s?eat|justeat|deliveroo|informe.?ventas|ingresos.?plataforma)/i

function detectarTipo(nombres: string[]): { tipo: Modo; auto: boolean } {
  let e = 0, v = 0, f = 0
  for (const n of nombres) {
    if (RE_EXTRACTO.test(n)) e++
    else if (RE_VENTA.test(n)) v++
    else f++
  }
  if (e > 0 && e >= v && e >= f) return { tipo: 'extracto', auto: true }
  if (v > 0 && v >= e && v >= f) return { tipo: 'venta', auto: true }
  // Sin señal clara → factura (lo más habitual). auto=true solo si hubo algún match de factura explícito
  return { tipo: 'factura', auto: e + v === 0 ? false : true }
}

function BtnSubirSplit({ label, onArchivos, preparando, setPreparando }: { label: string; onArchivos: (r: { aceptados: File[]; comprimidos: File[]; rechazados: string[] }) => void; preparando: boolean; setPreparando: (v: boolean) => void }) {
  const inputFileRef = useRef<HTMLInputElement>(null)
  const inputFolderRef = useRef<HTMLInputElement>(null)
  const [overL, setOverL] = useState(false)
  const [overR, setOverR] = useState(false)
  const handleFiles = async (files: FileList | File[] | null) => { if (!files || files.length === 0) return; setPreparando(true); try { const arr = Array.isArray(files) ? files : Array.from(files); onArchivos(await expandirArchivos(arr)) } finally { setPreparando(false) } }
  const halfBase: React.CSSProperties = { flex: 1, padding: '16px 12px', cursor: preparando ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', transition: 'background 0.15s', opacity: preparando ? 0.6 : 1 }
  const labelDerecha = ES_MOVIL ? 'varios archivos' : 'por carpetas'
  return (
    <div style={{ display: 'flex', borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
      <input ref={inputFileRef} type="file" multiple accept={ACCEPT} style={{ display: 'none' }} onChange={e => { handleFiles(e.target.files); if (inputFileRef.current) inputFileRef.current.value = '' }} />
      <input ref={inputFolderRef} type="file" /* @ts-ignore */ webkitdirectory="" directory="" multiple style={{ display: 'none' }} onChange={e => { handleFiles(e.target.files); if (inputFolderRef.current) inputFolderRef.current.value = '' }} />
      <div onDragOver={e => { if (preparando) return; e.preventDefault(); setOverL(true) }} onDragLeave={() => setOverL(false)} onDrop={e => { if (preparando) return; e.preventDefault(); setOverL(false); handleFiles(e.dataTransfer.files) }} onClick={() => { if (!preparando) inputFileRef.current?.click() }} style={{ ...halfBase, background: overL ? '#8f1519' : '#B01D23', borderRight: '1px solid rgba(255,255,255,0.25)' }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: '#fff', textAlign: 'center', lineHeight: 1.25 }}>{label} por archivos</div>
      </div>
      <div onDragOver={e => { if (preparando) return; e.preventDefault(); setOverR(true) }} onDragLeave={() => setOverR(false)} onDrop={e => { if (preparando) return; e.preventDefault(); setOverR(false); handleFiles(e.dataTransfer.files) }} onClick={() => { if (preparando) return; if (ES_MOVIL) inputFileRef.current?.click(); else inputFolderRef.current?.click() }} style={{ ...halfBase, background: overR ? '#8f1519' : '#B01D23' }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: '#fff', textAlign: 'center', lineHeight: 1.25 }}>{label} {labelDerecha}</div>
      </div>
      {preparando && (<div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: 14, pointerEvents: 'none' }}><div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 13, color: '#fff', letterSpacing: '2px', textTransform: 'uppercase' }}>Preparando…</div></div>)}
    </div>
  )
}

const TIPO_LABEL: Record<Modo, string> = { factura: 'Facturas', extracto: 'Extractos', venta: 'Ventas' }

export default function BandejaEntrada({ desde, hasta, onProcesado }: { desde: string; hasta: string; onProcesado?: () => void }) {
  const { procesar } = useOcrUpload()
  const [preparando, setPreparando] = useState(false)
  const [verRechazados, setVerRechazados] = useState(false)
  // Modal único de clasificación: tipo editable con chips antes de enviar.
  const [modal, setModal] = useState<{ archivos: File[]; rechazados: string[]; visible: boolean; tipo: Modo; auto: boolean }>({ archivos: [], rechazados: [], visible: false, tipo: 'factura', auto: false })

  const onArchivos = (r: { aceptados: File[]; comprimidos: File[]; rechazados: string[] }) => {
    const archivos = [...r.aceptados, ...r.comprimidos]
    if (archivos.length === 0 && r.rechazados.length === 0) return
    const { tipo, auto } = detectarTipo(archivos.map(f => f.name))
    setVerRechazados(false)
    setModal({ archivos, rechazados: r.rechazados, visible: true, tipo, auto })
  }

  const cerrar = () => { setModal(m => ({ ...m, visible: false, archivos: [], rechazados: [] })); setVerRechazados(false) }
  const setTipo = (tipo: Modo) => setModal(m => ({ ...m, tipo, auto: false }))

  const enviarFacturaVenta = () => { const a = modal.archivos; cerrar(); procesar(a, 'ocr-procesar-factura', null); onProcesado?.() }
  const enviarExtracto = (titular: string) => { const a = modal.archivos; cerrar(); procesar(a, 'ocr-procesar-extracto', titular); onProcesado?.() }

  const n = modal.archivos.length

  return (
    <div style={{ marginTop: 16 }}>
      {/* Botonera de subida única — el clasificador decide el tipo al soltar */}
      <div style={{ marginBottom: 16 }}>
        <BtnSubirSplit label="Subir documentos" onArchivos={onArchivos} preparando={preparando} setPreparando={setPreparando} />
        <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090', marginTop: 8, textAlign: 'center' }}>
          Arrastra aquí archivos o carpetas (ZIP incluido). El clasificador detecta si es factura, extracto o venta y te deja corregirlo antes de enviar.
        </div>
      </div>

      {/* Cartero + Salud OCR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        <CardFacturasCorreo tipo="factura" desde={desde} hasta={hasta} onBarrido={() => onProcesado?.()} />
        <CardSaludOcr />
      </div>

      {/* Modal clasificador */}
      {modal.visible && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: 28, borderRadius: 14, minWidth: 400, maxWidth: 580, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase', color: '#B01D23', marginBottom: 12 }}>Clasificar y subir</div>
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 16, color: '#111', marginBottom: 6 }}>Vas a subir <strong style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, color: '#1D9E75' }}>{n}</strong> archivo{n !== 1 ? 's' : ''}</div>

            {modal.rechazados.length > 0 && (<><div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 14, color: '#E24B4A', marginBottom: 8 }}>Rechazados: <strong>{modal.rechazados.length}</strong>{' '}<button onClick={() => setVerRechazados(v => !v)} style={{ background: 'none', border: 'none', color: '#B01D23', fontFamily: 'Lexend, sans-serif', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>{verRechazados ? 'ocultar' : 'ver lista'}</button></div>{verRechazados && (<div style={{ background: '#fff5f5', border: '0.5px solid #E24B4A50', borderRadius: 8, padding: '10px 12px', maxHeight: 180, overflowY: 'auto', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginBottom: 8 }}>{modal.rechazados.map((nm, i) => <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '2px 0' }}>{nm}</div>)}</div>)}</>)}

            {/* Tipo detectado + chips para corregir */}
            <div style={{ marginTop: 12, marginBottom: 4, fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#3a4050' }}>
              {modal.auto ? <>Detectado automáticamente: <strong>{TIPO_LABEL[modal.tipo]}</strong>. Cámbialo si no es correcto:</> : <>No estaba claro por el nombre — elige el tipo:</>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
              {(['factura', 'extracto', 'venta'] as Modo[]).map(t => {
                const activo = modal.tipo === t
                return (
                  <button key={t} onClick={() => setTipo(t)} style={{ flex: '1 1 110px', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', background: activo ? '#FF475715' : '#fff', border: activo ? '1.5px solid #FF4757' : '0.5px solid #d0c8bc', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: activo ? '#FF4757' : '#1e2233', fontWeight: 600 }}>{TIPO_LABEL[t]}</button>
                )
              })}
            </div>

            {modal.tipo === 'extracto' ? (
              <>
                <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', marginBottom: 12 }}>¿De quién es este extracto?</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button disabled={n === 0} onClick={() => enviarExtracto(RUBEN_ID)} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '0.5px solid #F26B1F', background: '#F26B1F', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', opacity: n === 0 ? 0.4 : 1 }}>Rubén</button>
                  <button disabled={n === 0} onClick={() => enviarExtracto(EMILIO_ID)} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '0.5px solid #1E5BCC', background: '#1E5BCC', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', opacity: n === 0 ? 0.4 : 1 }}>Emilio</button>
                </div>
                <button onClick={cerrar} style={{ marginTop: 14, width: '100%', padding: '8px', background: 'none', border: 'none', color: '#7a8090', fontFamily: 'Lexend, sans-serif', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={cerrar} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '0.5px solid #d0c8bc', background: '#fff', color: '#3a4050', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer' }}>Cancelar</button>
                <button disabled={n === 0} onClick={enviarFacturaVenta} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: 'none', background: n === 0 ? '#d0c8bc' : '#B01D23', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: n === 0 ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Enviar {n}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
