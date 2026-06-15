import { useState, useRef } from 'react'
import { useOcrUpload } from '@/lib/ocrUploadStore'
import CardFacturasCorreo from '@/components/panel/resumen/CardFacturasCorreo'
import CardSaludOcr from '@/components/panel/resumen/CardSaludOcr'

// ── Bandeja de entrada — FUENTE ÚNICA DE SUBIDA ────────────────────────────
// Subes aquí cualquier documento (o carpeta entera, ZIP incluido) y eliges el
// tipo. El sistema lo procesa por OCR y lo manda a su flujo:
//   · Facturas / Otros → ocr-procesar-factura
//   · Extractos        → ocr-procesar-extracto (pregunta titular)
//   · Ventas           → ocr-procesar-factura (tipo ventas)
// Incluye el cartero (facturas que llegan por correo) y la salud del OCR.

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

const MODOS: { id: Modo; label: string; nota: string }[] = [
  { id: 'factura', label: 'Facturas', nota: 'Facturas de proveedor o plataforma' },
  { id: 'extracto', label: 'Extractos', nota: 'Extractos bancarios (pregunta titular)' },
  { id: 'venta', label: 'Ventas', nota: 'Liquidaciones / informes de ventas' },
]

export default function BandejaEntrada({ desde, hasta, onProcesado }: { desde: string; hasta: string; onProcesado?: () => void }) {
  const { procesar } = useOcrUpload()
  const [modo, setModo] = useState<Modo>('factura')
  const [preparando, setPreparando] = useState(false)
  const [modalConfirmar, setModalConfirmar] = useState<{ archivos: File[]; rechazados: string[]; visible: boolean }>({ archivos: [], rechazados: [], visible: false })
  const [modalTitular, setModalTitular] = useState<{ archivos: File[]; rechazados: string[]; visible: boolean }>({ archivos: [], rechazados: [], visible: false })
  const [verRechazados, setVerRechazados] = useState(false)

  const onArchivos = (r: { aceptados: File[]; comprimidos: File[]; rechazados: string[] }) => {
    const archivos = [...r.aceptados, ...r.comprimidos]
    setVerRechazados(false)
    if (modo === 'extracto') setModalTitular({ archivos, rechazados: r.rechazados, visible: true })
    else setModalConfirmar({ archivos, rechazados: r.rechazados, visible: true })
  }

  const labelSubir = modo === 'factura' ? 'Subir facturas' : modo === 'extracto' ? 'Subir extractos' : 'Subir ventas'

  return (
    <div style={{ marginTop: 16 }}>
      {/* Selector de tipo (clasificador) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {MODOS.map(m => {
          const activo = modo === m.id
          return (
            <button key={m.id} onClick={() => setModo(m.id)} style={{ flex: '1 1 160px', textAlign: 'left', padding: '12px 16px', borderRadius: 12, cursor: 'pointer', background: activo ? '#FF475710' : '#fff', border: activo ? '1.5px solid #FF4757' : '0.5px solid #d0c8bc', transition: 'all 150ms' }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', color: activo ? '#FF4757' : '#1e2233', fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 3 }}>{m.nota}</div>
            </button>
          )
        })}
      </div>

      {/* Botonera de subida */}
      <div style={{ marginBottom: 16 }}>
        <BtnSubirSplit label={labelSubir} onArchivos={onArchivos} preparando={preparando} setPreparando={setPreparando} />
        <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090', marginTop: 8, textAlign: 'center' }}>
          Arrastra aquí archivos o carpetas (ZIP incluido). Se procesan por OCR y van a su sitio según el tipo elegido arriba.
        </div>
      </div>

      {/* Cartero + Salud OCR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        <CardFacturasCorreo tipo="factura" desde={desde} hasta={hasta} onBarrido={() => onProcesado?.()} />
        <CardSaludOcr />
      </div>

      {/* Modal confirmar (facturas / ventas) */}
      {modalConfirmar.visible && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: 28, borderRadius: 14, minWidth: 380, maxWidth: 560, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase', color: '#B01D23', marginBottom: 12 }}>Confirmar subida</div>
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 16, color: '#111', marginBottom: 6 }}>Vas a subir <strong style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, color: '#1D9E75' }}>{modalConfirmar.archivos.length}</strong> archivos</div>
            {modalConfirmar.rechazados.length > 0 && (<><div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 14, color: '#E24B4A', marginBottom: 8 }}>Rechazados: <strong>{modalConfirmar.rechazados.length}</strong>{' '}<button onClick={() => setVerRechazados(v => !v)} style={{ background: 'none', border: 'none', color: '#B01D23', fontFamily: 'Lexend, sans-serif', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>{verRechazados ? 'ocultar' : 'ver lista'}</button></div>{verRechazados && (<div style={{ background: '#fff5f5', border: '0.5px solid #E24B4A50', borderRadius: 8, padding: '10px 12px', maxHeight: 200, overflowY: 'auto', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginBottom: 8 }}>{modalConfirmar.rechazados.map((n, i) => <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '2px 0' }}>{n}</div>)}</div>)}</>)}
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090', marginTop: 8, marginBottom: 18 }}>Se procesarán con OCR y se guardarán en el sistema</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setModalConfirmar({ archivos: [], rechazados: [], visible: false }); setVerRechazados(false) }} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '0.5px solid #d0c8bc', background: '#fff', color: '#3a4050', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer' }}>Cancelar</button>
              <button disabled={modalConfirmar.archivos.length === 0} onClick={() => { const a = modalConfirmar.archivos; setModalConfirmar({ archivos: [], rechazados: [], visible: false }); setVerRechazados(false); procesar(a, 'ocr-procesar-factura', null); onProcesado?.() }} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: 'none', background: modalConfirmar.archivos.length === 0 ? '#d0c8bc' : '#B01D23', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: modalConfirmar.archivos.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Enviar {modalConfirmar.archivos.length}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal titular (extractos) */}
      {modalTitular.visible && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: 28, borderRadius: 14, minWidth: 380, maxWidth: 560, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase', color: '#B01D23', marginBottom: 12 }}>Extracto bancario</div>
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 16, color: '#111', marginBottom: 6 }}>Vas a subir <strong style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, color: '#1D9E75' }}>{modalTitular.archivos.length}</strong> archivos</div>
            {modalTitular.rechazados.length > 0 && (<div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#E24B4A', marginBottom: 8 }}>Rechazados: <strong>{modalTitular.rechazados.length}</strong></div>)}
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', marginTop: 10, marginBottom: 14 }}>¿De quién es este extracto?</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button disabled={modalTitular.archivos.length === 0} onClick={() => { const a = modalTitular.archivos; setModalTitular({ archivos: [], rechazados: [], visible: false }); procesar(a, 'ocr-procesar-extracto', RUBEN_ID); onProcesado?.() }} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '0.5px solid #F26B1F', background: '#F26B1F', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', opacity: modalTitular.archivos.length === 0 ? 0.4 : 1 }}>Rubén</button>
              <button disabled={modalTitular.archivos.length === 0} onClick={() => { const a = modalTitular.archivos; setModalTitular({ archivos: [], rechazados: [], visible: false }); procesar(a, 'ocr-procesar-extracto', EMILIO_ID); onProcesado?.() }} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '0.5px solid #1E5BCC', background: '#1E5BCC', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', opacity: modalTitular.archivos.length === 0 ? 0.4 : 1 }}>Emilio</button>
            </div>
            <button onClick={() => setModalTitular({ archivos: [], rechazados: [], visible: false })} style={{ marginTop: 14, width: '100%', padding: '8px', background: 'none', border: 'none', color: '#7a8090', fontFamily: 'Lexend, sans-serif', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
