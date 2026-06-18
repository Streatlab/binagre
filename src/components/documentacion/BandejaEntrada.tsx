import { useState, useRef } from 'react'
import { useOcrUpload } from '@/lib/ocrUploadStore'
import CardFacturasCorreo from '@/components/panel/resumen/CardFacturasCorreo'
import CardSaludOcr from '@/components/panel/resumen/CardSaludOcr'
import ChuletaPlataformas from '@/components/ChuletaPlataformas'

// ── Bandeja de entrada — FUENTE ÚNICA DE SUBIDA ────────────────────────────
// Diseño definitivo (simple y 100% efectivo): CERO clasificación manual.
//   · "Subir documentos"  → facturas y liquidaciones de venta. El motor OCR
//     decide por el CONTENIDO si es factura de proveedor, de plataforma o
//     liquidación de ventas, y reparte cada dato a su sitio (Facturas / Ventas).
//   · "Subir extracto bancario" → único caso que va a otro flujo y pregunta de
//     quién es (Rubén/Emilio). Vuelca los movimientos a Conciliación.
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

function BtnSubirSplit({ label, variante, onArchivos, preparando, setPreparando }: { label: string; variante: 'rojo' | 'azul'; onArchivos: (r: { aceptados: File[]; comprimidos: File[]; rechazados: string[] }) => void; preparando: boolean; setPreparando: (v: boolean) => void }) {
  const inputFileRef = useRef<HTMLInputElement>(null)
  const inputFolderRef = useRef<HTMLInputElement>(null)
  const [overL, setOverL] = useState(false)
  const [overR, setOverR] = useState(false)
  const base = variante === 'rojo' ? '#B01D23' : '#1E5BCC'
  const baseHover = variante === 'rojo' ? '#8f1519' : '#16459e'
  const handleFiles = async (files: FileList | File[] | null) => { if (!files || files.length === 0) return; setPreparando(true); try { const arr = Array.isArray(files) ? files : Array.from(files); onArchivos(await expandirArchivos(arr)) } finally { setPreparando(false) } }
  const halfBase: React.CSSProperties = { flex: 1, padding: '15px 12px', cursor: preparando ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', transition: 'background 0.15s', opacity: preparando ? 0.6 : 1 }
  const labelDerecha = ES_MOVIL ? 'varios archivos' : 'por carpetas'
  return (
    <div style={{ display: 'flex', borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
      <input ref={inputFileRef} type="file" multiple accept={ACCEPT} style={{ display: 'none' }} onChange={e => { handleFiles(e.target.files); if (inputFileRef.current) inputFileRef.current.value = '' }} />
      <input ref={inputFolderRef} type="file" /* @ts-ignore */ webkitdirectory="" directory="" multiple style={{ display: 'none' }} onChange={e => { handleFiles(e.target.files); if (inputFolderRef.current) inputFolderRef.current.value = '' }} />
      <div onDragOver={e => { if (preparando) return; e.preventDefault(); setOverL(true) }} onDragLeave={() => setOverL(false)} onDrop={e => { if (preparando) return; e.preventDefault(); setOverL(false); handleFiles(e.dataTransfer.files) }} onClick={() => { if (!preparando) inputFileRef.current?.click() }} style={{ ...halfBase, background: overL ? baseHover : base, borderRight: '1px solid rgba(255,255,255,0.25)' }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 13.5, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#fff', textAlign: 'center', lineHeight: 1.25 }}>{label} por archivos</div>
      </div>
      <div onDragOver={e => { if (preparando) return; e.preventDefault(); setOverR(true) }} onDragLeave={() => setOverR(false)} onDrop={e => { if (preparando) return; e.preventDefault(); setOverR(false); handleFiles(e.dataTransfer.files) }} onClick={() => { if (preparando) return; if (ES_MOVIL) inputFileRef.current?.click(); else inputFolderRef.current?.click() }} style={{ ...halfBase, background: overR ? baseHover : base }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 13.5, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#fff', textAlign: 'center', lineHeight: 1.25 }}>{label} {labelDerecha}</div>
      </div>
      {preparando && (<div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: 14, pointerEvents: 'none' }}><div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 13, color: '#fff', letterSpacing: '2px', textTransform: 'uppercase' }}>Preparando…</div></div>)}
    </div>
  )
}

export default function BandejaEntrada({ desde, hasta, onProcesado }: { desde: string; hasta: string; onProcesado?: () => void }) {
  const { procesar } = useOcrUpload()
  const [preparando, setPreparando] = useState(false)
  const [verRechazados, setVerRechazados] = useState(false)
  // Modal de confirmación (documentos: facturas/ventas) — el motor clasifica solo
  const [modalDoc, setModalDoc] = useState<{ archivos: File[]; rechazados: string[]; visible: boolean }>({ archivos: [], rechazados: [], visible: false })
  // Modal de extracto — pregunta titular
  const [modalExtracto, setModalExtracto] = useState<{ archivos: File[]; rechazados: string[]; visible: boolean }>({ archivos: [], rechazados: [], visible: false })

  const onDoc = (r: { aceptados: File[]; comprimidos: File[]; rechazados: string[] }) => { setVerRechazados(false); setModalDoc({ archivos: [...r.aceptados, ...r.comprimidos], rechazados: r.rechazados, visible: true }) }
  const onExtracto = (r: { aceptados: File[]; comprimidos: File[]; rechazados: string[] }) => { setVerRechazados(false); setModalExtracto({ archivos: [...r.aceptados, ...r.comprimidos], rechazados: r.rechazados, visible: true }) }

  const enviarDoc = () => { const a = modalDoc.archivos; setModalDoc({ archivos: [], rechazados: [], visible: false }); procesar(a, 'ocr-procesar-factura', null); onProcesado?.() }
  const enviarExtracto = (titular: string) => { const a = modalExtracto.archivos; setModalExtracto({ archivos: [], rechazados: [], visible: false }); procesar(a, 'ocr-procesar-extracto', titular); onProcesado?.() }

  return (
    <div style={{ marginTop: 16 }}>
      {/* Subida 1: documentos (facturas + ventas) — el contenido manda */}
      <div style={{ marginBottom: 12 }}>
        <BtnSubirSplit label="Subir documentos" variante="rojo" onArchivos={onDoc} preparando={preparando} setPreparando={setPreparando} />
        <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090', marginTop: 8, textAlign: 'center' }}>
          Facturas y liquidaciones de venta (Uber, Glovo, Just Eat…). El sistema lee cada documento y reparte solo lo que va a Facturas y lo que va a Ventas.
        </div>
      </div>

      {/* Subida 2: extracto bancario — pregunta titular */}
      <div style={{ marginBottom: 16 }}>
        <BtnSubirSplit label="Subir extracto banco" variante="azul" onArchivos={onExtracto} preparando={preparando} setPreparando={setPreparando} />
        <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090', marginTop: 8, textAlign: 'center' }}>
          Solo extractos del banco. Te preguntará de quién es y vuelca los movimientos a Conciliación. Mejor en Excel/CSV que en PDF.
        </div>
      </div>

      {/* Cartero + Salud OCR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        <CardFacturasCorreo tipo="factura" desde={desde} hasta={hasta} onBarrido={() => onProcesado?.()} />
        <CardSaludOcr />
      </div>

      {/* Chuleta: qué subir por plataforma (Glovo / Uber / Just Eat) */}
      <ChuletaPlataformas />

      {/* Modal documentos */}
      {modalDoc.visible && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: 28, borderRadius: 14, minWidth: 380, maxWidth: 560, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase', color: '#B01D23', marginBottom: 12 }}>Confirmar subida</div>
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 16, color: '#111', marginBottom: 6 }}>Vas a subir <strong style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, color: '#1D9E75' }}>{modalDoc.archivos.length}</strong> documento{modalDoc.archivos.length !== 1 ? 's' : ''}</div>
            {modalDoc.rechazados.length > 0 && (<><div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 14, color: '#E24B4A', marginBottom: 8 }}>Rechazados: <strong>{modalDoc.rechazados.length}</strong>{' '}<button onClick={() => setVerRechazados(v => !v)} style={{ background: 'none', border: 'none', color: '#B01D23', fontFamily: 'Lexend, sans-serif', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>{verRechazados ? 'ocultar' : 'ver lista'}</button></div>{verRechazados && (<div style={{ background: '#fff5f5', border: '0.5px solid #E24B4A50', borderRadius: 8, padding: '10px 12px', maxHeight: 180, overflowY: 'auto', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginBottom: 8 }}>{modalDoc.rechazados.map((nm, i) => <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '2px 0' }}>{nm}</div>)}</div>)}</>)}
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090', marginTop: 8, marginBottom: 18 }}>El sistema clasifica cada uno por su contenido (factura de proveedor, de plataforma o liquidación de ventas).</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setModalDoc({ archivos: [], rechazados: [], visible: false }); setVerRechazados(false) }} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '0.5px solid #d0c8bc', background: '#fff', color: '#3a4050', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer' }}>Cancelar</button>
              <button disabled={modalDoc.archivos.length === 0} onClick={enviarDoc} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: 'none', background: modalDoc.archivos.length === 0 ? '#d0c8bc' : '#B01D23', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: modalDoc.archivos.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Enviar {modalDoc.archivos.length}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal extracto (titular) */}
      {modalExtracto.visible && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: 28, borderRadius: 14, minWidth: 380, maxWidth: 560, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase', color: '#1E5BCC', marginBottom: 12 }}>Extracto bancario</div>
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 16, color: '#111', marginBottom: 6 }}>Vas a subir <strong style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, color: '#1D9E75' }}>{modalExtracto.archivos.length}</strong> archivo{modalExtracto.archivos.length !== 1 ? 's' : ''}</div>
            {modalExtracto.rechazados.length > 0 && (<div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#E24B4A', marginBottom: 8 }}>Rechazados: <strong>{modalExtracto.rechazados.length}</strong></div>)}
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', marginTop: 10, marginBottom: 14 }}>¿De quién es este extracto?</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button disabled={modalExtracto.archivos.length === 0} onClick={() => enviarExtracto(RUBEN_ID)} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '0.5px solid #F26B1F', background: '#F26B1F', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', opacity: modalExtracto.archivos.length === 0 ? 0.4 : 1 }}>Rubén</button>
              <button disabled={modalExtracto.archivos.length === 0} onClick={() => enviarExtracto(EMILIO_ID)} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '0.5px solid #1E5BCC', background: '#1E5BCC', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', opacity: modalExtracto.archivos.length === 0 ? 0.4 : 1 }}>Emilio</button>
            </div>
            <button onClick={() => setModalExtracto({ archivos: [], rechazados: [], visible: false })} style={{ marginTop: 14, width: '100%', padding: '8px', background: 'none', border: 'none', color: '#7a8090', fontFamily: 'Lexend, sans-serif', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
