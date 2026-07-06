import { useState, useRef } from 'react'
import { useOcrUpload } from '@/lib/ocrUploadStore'
import { toast } from '@/lib/toastStore'
import CardFacturasCorreo from '@/components/panel/resumen/CardFacturasCorreo'
import CardSaludOcr from '@/components/panel/resumen/CardSaludOcr'
import ChuletaPlataformas from '@/components/ChuletaPlataformas'
import AvisosBandeja from '@/components/documentacion/AvisosBandeja'

// ── Bandeja de entrada — 3 BOTONES, UN SOLO PICKER CADA UNO ─────────────────
//   · BANCO    → extracto (CSV/PDF). Pregunta titular (Rubén/Emilio) y vuelca a
//     Conciliación. El match retroactivo con facturas ya cargadas es automático.
//   · VENTAS   → liquidaciones/resúmenes de plataforma → Ventas de Finanzas.
//     Si un archivo NO es de ventas, se redirige solo al motor de Facturas y avisa.
//   · FACTURAS → OCR + Drive + contraste con Conciliación. Si un archivo ES un
//     resumen de ventas, se redirige solo a Ventas y avisa.
//   Duplicados: mismo archivo subido dos veces en la sesión no se reprocesa.

const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'

const EXT_PDF_IMG = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'heic', 'heif', 'tif', 'tiff', 'gif', 'bmp']
const EXT_OFFICE = ['doc', 'docx', 'xls', 'xlsx', 'csv', 'html', 'htm', 'txt']
const EXT_COMPRIMIDOS = ['zip', 'rar', '7z']
const EXT_ACEPTADAS = [...EXT_PDF_IMG, ...EXT_OFFICE, ...EXT_COMPRIMIDOS]
const ACCEPT = EXT_ACEPTADAS.map(e => `.${e}`).join(',')

// ── Reconocimiento cliente del "resumen de ganancias" de Uber (CSV) ─────────
function esResumenUberTexto(texto: string): boolean {
  const cab = (texto || '').slice(0, 2000).toLowerCase()
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

type Destino = 'banco' | 'ventas' | 'facturas'

// ── Botón de subida: UN solo picker (clic = selector de archivos múltiple; también admite arrastrar) ──
function BtnSubir({ label, sub, color, colorHover, onArchivos, preparando }: {
  label: string; sub: string; color: string; colorHover: string
  onArchivos: (r: { aceptados: File[]; comprimidos: File[]; rechazados: string[] }) => void
  preparando: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [ocupado, setOcupado] = useState(false)
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
      onClick={() => { if (!bloqueado) inputRef.current?.click() }}
      style={{
        flex: 1, minWidth: 220, border: '3px solid #140f08', boxShadow: '4px 4px 0 #140f08',
        background: over ? colorHover : color, cursor: bloqueado ? 'wait' : 'pointer',
        padding: '18px 14px', textAlign: 'center', userSelect: 'none', position: 'relative',
        transition: 'background 0.15s', opacity: bloqueado ? 0.6 : 1,
      }}
    >
      <input ref={inputRef} type="file" multiple accept={ACCEPT} style={{ display: 'none' }}
        onChange={e => { handleFiles(e.target.files); if (inputRef.current) inputRef.current.value = '' }} />
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 17, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#fff', lineHeight: 1.2 }}>{label}</div>
      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11.5, color: 'rgba(255,255,255,0.92)', marginTop: 6, lineHeight: 1.35 }}>{sub}</div>
      {ocupado && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', pointerEvents: 'none' }}>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 13, color: '#fff', letterSpacing: '2px', textTransform: 'uppercase' }}>Preparando…</div>
        </div>
      )}
    </div>
  )
}

export default function BandejaEntrada({ desde, hasta, onProcesado }: { desde: string; hasta: string; onProcesado?: () => void }) {
  const { procesar } = useOcrUpload()
  const [preparando] = useState(false)
  const [verRechazados, setVerRechazados] = useState(false)
  // Control de duplicados en sesión: nombre|tamaño ya enviados no se reprocesan
  const enviadosRef = useRef<Set<string>>(new Set())

  const [modal, setModal] = useState<{ destino: Destino; archivos: File[]; duplicados: string[]; rechazados: string[]; visible: boolean }>({ destino: 'facturas', archivos: [], duplicados: [], rechazados: [], visible: false })

  const abrirModal = (destino: Destino) => (r: { aceptados: File[]; comprimidos: File[]; rechazados: string[] }) => {
    setVerRechazados(false)
    const todos = [...r.aceptados, ...r.comprimidos]
    const nuevos: File[] = []
    const duplicados: string[] = []
    for (const f of todos) {
      const clave = `${f.name}|${f.size}`
      if (enviadosRef.current.has(clave)) duplicados.push(f.name)
      else nuevos.push(f)
    }
    setModal({ destino, archivos: nuevos, duplicados, rechazados: r.rechazados, visible: true })
  }

  const marcarEnviados = (archivos: File[]) => { for (const f of archivos) enviadosRef.current.add(`${f.name}|${f.size}`) }

  // Separa resúmenes de ventas (Uber CSV) del resto mirando el contenido
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

  // Envía archivos de ventas al endpoint de plataformas con un único aviso veraz
  const enviarAVentas = async (ventas: File[]) => {
    if (ventas.length === 0) return
    const tid = toast.loading(`Leyendo resumen de ventas (${ventas.length})…`)
    let tiendas = 0, nuevas = 0, actualizadas = 0, pedidos = 0, neto = 0
    const errs: string[] = []
    for (const f of ventas) {
      try {
        const base64 = await fileABase64(f)
        const res = await fetch('/api/importar/plataforma', {
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
        } else {
          errs.push(j.mensaje || 'no reconocido')
        }
      } catch (e: any) {
        errs.push(e?.message || 'error de red')
      }
    }
    if (errs.length > 0 && nuevas + actualizadas === 0) {
      toast.error(`No se pudo leer el resumen de ventas: ${errs[0]}`, { id: tid })
    } else {
      toast.success(
        `Ventas · ${tiendas} tiendas · ${nuevas} nuevas, ${actualizadas} actualizadas · ${pedidos} pedidos · neto ${neto.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
        { id: tid }
      )
    }
  }

  // ── Envío según destino, con redirección automática de documentos mal ubicados ──
  const enviar = async (titular?: string) => {
    const { destino, archivos } = modal
    setModal(m => ({ ...m, visible: false, archivos: [], duplicados: [], rechazados: [] }))
    if (archivos.length === 0) return
    marcarEnviados(archivos)

    if (destino === 'banco') {
      procesar(archivos, 'ocr-procesar-extracto', titular ?? null)
      onProcesado?.()
      return
    }

    const { ventas, resto } = await separarVentas(archivos)

    if (destino === 'ventas') {
      // Lo que no es de ventas se redirige solo a Facturas y se avisa
      if (resto.length > 0) {
        // El motor clasifica por contenido: liquidaciones Just Eat/Glovo, resúmenes
        // Uber y CSV de platos/franjas van SOLOS a Ventas; lo demás sigue a Facturas.
        toast.success(`${resto.length} documento${resto.length !== 1 ? 's' : ''} enviado${resto.length !== 1 ? 's' : ''} al clasificador: lo que sea de ventas entra en Ventas y el resto en Facturas.`)
        procesar(resto, 'ocr-procesar-factura', null)
      }
      await enviarAVentas(ventas)
      onProcesado?.()
      return
    }

    // destino === 'facturas'
    if (ventas.length > 0) {
      // Resúmenes de ventas subidos por el botón equivocado → redirigidos solos
      toast.success(`${ventas.length} resumen${ventas.length !== 1 ? 'es' : ''} de ventas detectado${ventas.length !== 1 ? 's' : ''}: enviado${ventas.length !== 1 ? 's' : ''} a Ventas.`)
      await enviarAVentas(ventas)
    }
    if (resto.length > 0) procesar(resto, 'ocr-procesar-factura', null)
    onProcesado?.()
  }

  const tituloModal = modal.destino === 'banco' ? 'Extracto bancario' : modal.destino === 'ventas' ? 'Documentos de ventas' : 'Facturas'
  const colorTitulo = modal.destino === 'banco' ? '#1E5BCC' : modal.destino === 'ventas' ? '#1D9E75' : '#B01D23'

  return (
    <div style={{ marginTop: 16 }}>
      {/* ── 3 botones: Banco · Ventas · Facturas ── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
        <BtnSubir
          label="Banco" color="#1E5BCC" colorHover="#16459e"
          sub="Extractos del banco (CSV o PDF). Pregunta de quién es y vuelca a Conciliación."
          onArchivos={abrirModal('banco')} preparando={preparando}
        />
        <BtnSubir
          label="Ventas" color="#1D9E75" colorHover="#157a5a"
          sub="Liquidaciones y resúmenes de plataforma. Van directos a Ventas de Finanzas."
          onArchivos={abrirModal('ventas')} preparando={preparando}
        />
        <BtnSubir
          label="Facturas" color="#B01D23" colorHover="#8f1519"
          sub="Facturas de proveedores y plataformas. OCR, Drive y cruce con Conciliación."
          onArchivos={abrirModal('facturas')} preparando={preparando}
        />
      </div>
      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#140f08', marginBottom: 16, textAlign: 'center' }}>
        Si un documento entra por el botón equivocado, el sistema lo detecta por contenido, lo redirige solo y te avisa. Los duplicados no se procesan dos veces.
      </div>

      {/* ── Avisos autoaprendibles: dudas abiertas con solución en un clic ── */}
      <AvisosBandeja onResuelto={() => onProcesado?.()} />

      {/* Tres columnas iguales: correo · salud OCR · chuleta plataformas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignItems: 'stretch' }}>
        <CardFacturasCorreo tipo="factura" desde={desde} hasta={hasta} onBarrido={() => onProcesado?.()} />
        <CardSaludOcr />
        <ChuletaPlataformas />
      </div>

      {/* ── Modal único de confirmación ── */}
      {modal.visible && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#FCEFD6', padding: 28, minWidth: 380, maxWidth: 560, border: '4px solid #140f08', boxShadow: '6px 6px 0 #140f08' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase', color: colorTitulo, marginBottom: 12 }}>{tituloModal}</div>
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 16, color: '#111', marginBottom: 6 }}>
              Vas a subir <strong style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, color: '#1D9E75' }}>{modal.archivos.length}</strong> documento{modal.archivos.length !== 1 ? 's' : ''}
            </div>
            {modal.duplicados.length > 0 && (
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#c47f00', marginBottom: 6 }}>
                {modal.duplicados.length} ya subido{modal.duplicados.length !== 1 ? 's' : ''} en esta sesión: no se repite{modal.duplicados.length !== 1 ? 'n' : ''}.
              </div>
            )}
            {modal.rechazados.length > 0 && (
              <>
                <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 14, color: '#E24B4A', marginBottom: 8 }}>
                  Rechazados: <strong>{modal.rechazados.length}</strong>{' '}
                  <button onClick={() => setVerRechazados(v => !v)} style={{ background: 'none', border: 'none', color: '#B01D23', fontFamily: 'Lexend, sans-serif', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>{verRechazados ? 'ocultar' : 'ver lista'}</button>
                </div>
                {verRechazados && (
                  <div style={{ background: '#fff5f5', border: '2px solid #140f08', borderRadius: 0, padding: '10px 12px', maxHeight: 180, overflowY: 'auto', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginBottom: 8 }}>
                    {modal.rechazados.map((nm, i) => <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '2px 0' }}>{nm}</div>)}
                  </div>
                )}
              </>
            )}

            {modal.destino === 'banco' ? (
              <>
                <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', marginTop: 10, marginBottom: 14 }}>¿De quién es este extracto?</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button disabled={modal.archivos.length === 0} onClick={() => enviar(RUBEN_ID)} style={{ flex: 1, padding: '12px 14px', borderRadius: 0, border: '3px solid #140f08', boxShadow: '3px 3px 0 #140f08', background: '#FF6A1A', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', opacity: modal.archivos.length === 0 ? 0.4 : 1 }}>Rubén</button>
                  <button disabled={modal.archivos.length === 0} onClick={() => enviar(EMILIO_ID)} style={{ flex: 1, padding: '12px 14px', borderRadius: 0, border: '3px solid #140f08', boxShadow: '3px 3px 0 #140f08', background: '#2D5BFF', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', opacity: modal.archivos.length === 0 ? 0.4 : 1 }}>Emilio</button>
                </div>
                <button onClick={() => setModal(m => ({ ...m, visible: false, archivos: [], duplicados: [], rechazados: [] }))} style={{ marginTop: 14, width: '100%', padding: '8px', background: 'none', border: 'none', color: '#7a8090', fontFamily: 'Lexend, sans-serif', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
              </>
            ) : (
              <>
                <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090', marginTop: 8, marginBottom: 18 }}>
                  El sistema clasifica cada documento por su contenido, aplica el diccionario de proveedores y lo redirige si no corresponde a este botón.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setModal(m => ({ ...m, visible: false, archivos: [], duplicados: [], rechazados: [] })); setVerRechazados(false) }} style={{ flex: 1, padding: '12px 14px', borderRadius: 0, border: '3px solid #140f08', background: '#fff', color: '#140f08', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer' }}>Cancelar</button>
                  <button disabled={modal.archivos.length === 0} onClick={() => enviar()} style={{ flex: 1, padding: '12px 14px', borderRadius: 0, border: '3px solid #140f08', boxShadow: '3px 3px 0 #140f08', background: modal.archivos.length === 0 ? '#d0c8bc' : colorTitulo, color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: modal.archivos.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Enviar {modal.archivos.length}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
