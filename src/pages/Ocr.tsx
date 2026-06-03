import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FONT, useTheme, groupStyle } from '@/styles/tokens'
import { fmtEur, fmtDate, fmtNumES } from '@/utils/format'
import { fechaLocalStr } from '@/utils/fechaLocal'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toastStore'
import TabsPastilla from '@/components/ui/TabsPastilla'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import ModalDetalleFactura from '@/components/ocr/ModalDetalleFactura'
import ExtractosTabla from '@/components/ocr/ExtractosTabla'
import VentasTab from '@/components/ocr/VentasTab'
import CardFacturasCorreo from '@/components/panel/resumen/CardFacturasCorreo'
import { useOcrUpload } from '@/lib/ocrUploadStore'
import { DocBadge } from '@/components/ocr/DocBadgeV2'
import SortableHeader, { ClearSortButton } from '@/components/ui/SortableHeader'
import { useMultiSort } from '@/hooks/useMultiSort'

type TabId = 'facturas' | 'extractos' | 'ventas' | 'otros'
type FiltroCard = 'conciliadas' | 'pendientes' | null

const PAGE_SIZES = [50, 100, 200] as const
type PageSize = typeof PAGE_SIZES[number]
const DEFAULT_PAGE_SIZE: PageSize = 100

const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'

const EXT_PDF_IMG = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'heic', 'heif', 'tif', 'tiff', 'gif', 'bmp']
const EXT_OFFICE = ['doc', 'docx', 'xls', 'xlsx', 'csv', 'html', 'htm', 'txt']
const EXT_COMPRIMIDOS = ['zip', 'rar', '7z']
const EXT_ACEPTADAS_FACTURAS = [...EXT_PDF_IMG, ...EXT_OFFICE, ...EXT_COMPRIMIDOS]
const EXT_ACEPTADAS_EXTRACTOS = [...EXT_PDF_IMG, ...EXT_OFFICE, ...EXT_COMPRIMIDOS]
const EXT_ACEPTADAS_OTROS = [...EXT_PDF_IMG, ...EXT_OFFICE, ...EXT_COMPRIMIDOS]

const ACCEPT_FACTURAS = EXT_ACEPTADAS_FACTURAS.map(e => `.${e}`).join(',')
const ACCEPT_EXTRACTOS = EXT_ACEPTADAS_EXTRACTOS.map(e => `.${e}`).join(',')
const ACCEPT_OTROS = EXT_ACEPTADAS_OTROS.map(e => `.${e}`).join(',')

// Detección de navegador móvil. webkitdirectory (selección de carpetas) NO
// funciona en móvil (iOS Safari / Android no lo soportan). En móvil el botón
// "por carpetas" se convierte en selección múltiple de archivos (sí soportada).
const ES_MOVIL = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)

// FUENTE ÚNICA DE VERDAD (Bloque 1 auditoría): el estado real de conciliación
// de cada factura sale de la vista v_estado_factura (derivada del vínculo real
// factura↔movimiento en facturas_gastos). Estas constantes de banderas sueltas
// solo se mantienen para el cálculo por-fila heredado; las cards usan la RPC.
const ESTADOS_CONCILIADOS_RAW = ['conciliada', 'asociada', 'solo_drive']
const ESTADOS_CONCILIADOS = new Set(ESTADOS_CONCILIADOS_RAW)
const ESTADOS_SIN_DOC = new Set(['solo_drive'])

function parsePageSize(raw: string | null): PageSize { const n = Number(raw); return (PAGE_SIZES as readonly number[]).includes(n) ? (n as PageSize) : DEFAULT_PAGE_SIZE }
function parsePage(raw: string | null): number { const n = Number(raw); return Number.isInteger(n) && n >= 1 ? n : 1 }

function csvEscape(s: string): string { const v = (s ?? '').replace(/"/g, '""'); return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v}"` : v }

interface CatPyg { id: string; nombre: string; nivel: number; parent_id: string | null }
interface Titular { id: string; nombre: string }
interface Factura { id: string; fecha_factura: string; proveedor_nombre: string; total: number; tipo: string; categoria_factura: string | null; nif_emisor: string | null; titular_id: string | null; pdf_drive_url: string | null; pdf_drive_id: string | null; pdf_filename: string | null; numero_factura: string | null; estado: string; doc_estado: string | null; matches_count: number; posible_duplicado: boolean; estado_real?: 'conciliada' | 'parcial' | 'pendiente' | 'esperando_banco' | null }
interface Agregados { totalCount: number; totalImporte: number; conciliadasCount: number; conciliadasPct: number; conciliadasImporte: number; pendientesCount: number; pendientesImporte: number }
type EstadoDoc = 'conciliada' | 'no_requiere' | 'pendiente'

function getEstadoDoc(f: Factura): EstadoDoc {
  if (f.estado_real) {
    if (f.estado_real === 'conciliada' || f.estado_real === 'parcial') return 'conciliada'
    if (f.estado_real === 'esperando_banco') return 'pendiente'
    return 'pendiente'
  }
  // fallback legacy
  if (ESTADOS_SIN_DOC.has(f.estado) || f.doc_estado === 'no_requiere') return 'no_requiere'
  if (ESTADOS_CONCILIADOS.has(f.estado)) return 'conciliada'
  return 'pendiente'
}
function esConciliada(f: Factura): boolean {
  if (f.estado_real) return f.estado_real === 'conciliada' || f.estado_real === 'parcial'
  return ESTADOS_CONCILIADOS.has(f.estado) || f.doc_estado === 'no_requiere'
}

// Orden canónico para columna "estado": 'conciliada' (0) → 'pendiente' (1). Asc: conciliadas primero.
function estadoSortKey(f: Factura): number {
  return esConciliada(f) ? 0 : 1
}

async function cargarJSZip(): Promise<any> {
  if ((window as any).JSZip) return (window as any).JSZip
  await new Promise<void>((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload = () => res(); s.onerror = () => rej(new Error('No se pudo cargar JSZip')); document.head.appendChild(s) })
  return (window as any).JSZip
}

const MAX_NIVEL_ZIP = 5

async function expandirZipRecursivo(f: File | Blob, nombreOrigen: string, validas: Set<string>, aceptados: File[], rechazados: string[], contador: { n: number }, contadorComp: { n: number }, nivel: number) {
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
      if (innerExt === 'zip') { await expandirZipRecursivo(blob, `${nombreOrigen} → ${innerName}`, validas, aceptados, rechazados, contador, contadorComp, nivel + 1); continue }
      if (innerExt === 'rar' || innerExt === '7z') { aceptados.push(new File([blob], innerName, { type: 'application/octet-stream' })); contador.n++; contadorComp.n++; continue }
      if (!validas.has(innerExt)) { rechazados.push(`${nombreOrigen} → ${innerName}`); continue }
      aceptados.push(new File([blob], innerName, { type: blob.type || 'application/octet-stream' }))
      contador.n++
    }
  } catch (err: any) { rechazados.push(`${nombreOrigen} (zip corrupto: ${err?.message || 'error'})`) }
}

async function expandirArchivos(files: File[], extensionesValidas: string[]): Promise<{ aceptados: File[]; rechazados: string[]; expandidosZip: number; totalOriginal: number; comprimidosServidor: number }> {
  const aceptados: File[] = [], rechazados: string[] = [], contador = { n: 0 }, contadorComp = { n: 0 }
  const validas = new Set(extensionesValidas.map(e => e.toLowerCase()))
  const validasSinComp = new Set([...validas].filter(e => !['zip','rar','7z'].includes(e)))
  for (const f of files) {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (ext === 'zip') { await expandirZipRecursivo(f, f.name, validasSinComp, aceptados, rechazados, contador, contadorComp, 1) }
    else if (ext === 'rar' || ext === '7z') { aceptados.push(f); contadorComp.n++ }
    else if (validas.has(ext)) { aceptados.push(f) }
    else { rechazados.push(f.name) }
  }
  return { aceptados, rechazados, expandidosZip: contador.n, totalOriginal: files.length, comprimidosServidor: contadorComp.n }
}

interface BtnSubirSplitProps { label: string; accept: string; extensiones: string[]; onArchivos: (resultado: { aceptados: File[]; rechazados: string[]; expandidosZip: number; totalOriginal: number; comprimidosServidor: number }) => void; preparando: boolean; setPreparando: (v: boolean) => void }
function BtnSubirSplit({ label, accept, extensiones, onArchivos, preparando, setPreparando }: BtnSubirSplitProps) {
  const inputFileRef = useRef<HTMLInputElement>(null)
  const inputFolderRef = useRef<HTMLInputElement>(null)
  const [overL, setOverL] = useState(false)
  const [overR, setOverR] = useState(false)
  const handleFiles = async (files: FileList | File[] | null) => { if (!files || (Array.isArray(files) ? files.length === 0 : files.length === 0)) return; setPreparando(true); try { const arr = Array.isArray(files) ? files : Array.from(files); const resultado = await expandirArchivos(arr, extensiones); onArchivos(resultado) } finally { setPreparando(false) } }
  const handleClickArchivos = () => { if (preparando) return; inputFileRef.current?.click() }
  // En móvil, webkitdirectory no abre nada → usar el input de archivos múltiple.
  const handleClickCarpetas = () => { if (preparando) return; if (ES_MOVIL) { inputFileRef.current?.click() } else { inputFolderRef.current?.click() } }
  const halfBase: React.CSSProperties = { flex: 1, padding: '14px 12px', cursor: preparando ? 'wait' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', userSelect: 'none', transition: 'background 0.15s', opacity: preparando ? 0.6 : 1 }
  // Etiqueta del botón derecho: en móvil "varios archivos" (las carpetas no existen en móvil)
  const labelDerecha = ES_MOVIL ? 'varios archivos' : 'por carpetas'
  return (
    <div style={{ display: 'flex', borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
      <input ref={inputFileRef} type="file" multiple accept={accept} style={{ display: 'none' }} onChange={e => { handleFiles(e.target.files); if (inputFileRef.current) inputFileRef.current.value = '' }} />
      <input ref={inputFolderRef} type="file" /* @ts-ignore */ webkitdirectory="" directory="" multiple style={{ display: 'none' }} onChange={e => { handleFiles(e.target.files); if (inputFolderRef.current) inputFolderRef.current.value = '' }} />
      <div onDragOver={e => { if (preparando) return; e.preventDefault(); e.stopPropagation(); setOverL(true) }} onDragLeave={e => { e.stopPropagation(); setOverL(false) }} onDrop={e => { if (preparando) return; e.preventDefault(); e.stopPropagation(); setOverL(false); handleFiles(e.dataTransfer.files) }} onClick={handleClickArchivos} style={{ ...halfBase, background: overL ? '#8f1519' : '#B01D23', borderRight: '1px solid rgba(255,255,255,0.25)' }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: '#fff', textAlign: 'center', lineHeight: 1.25 }}>{label} por archivos</div>
      </div>
      <div onDragOver={e => { if (preparando) return; e.preventDefault(); e.stopPropagation(); setOverR(true) }} onDragLeave={e => { e.stopPropagation(); setOverR(false) }} onDrop={e => { if (preparando) return; e.preventDefault(); e.stopPropagation(); setOverR(false); handleFiles(e.dataTransfer.files) }} onClick={handleClickCarpetas} style={{ ...halfBase, background: overR ? '#8f1519' : '#B01D23' }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: '#fff', textAlign: 'center', lineHeight: 1.25 }}>{label} {labelDerecha}</div>
      </div>
      {preparando && (<div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: 14, pointerEvents: 'none' }}><div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 13, color: '#fff', letterSpacing: '2px', textTransform: 'uppercase' }}>Preparando…</div></div>)}
    </div>
  )
}

export default function Ocr() {
  const { T } = useTheme()
  const [fechaDesde, setFechaDesde] = useState(new Date())
  const [fechaHasta, setFechaHasta] = useState(new Date())
  const [periodoLabel, setPeriodoLabel] = useState('')
  const [tab, setTab] = useState<TabId>('facturas')
  const [filtroCard, setFiltroCard] = useState<FiltroCard>(null)
  const [soloCorreo, setSoloCorreo] = useState(false)
  const [soloDuplicados, setSoloDuplicados] = useState(false)
  const [dupTotal, setDupTotal] = useState(0)
  const [marcandoNoDup, setMarcandoNoDup] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [busquedaDebounced, setBusquedaDebounced] = useState('')
  const [catFiltro, setCatFiltro] = useState('todas')
  const ms = useMultiSort('ocr_facturas')
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const pageSize = parsePageSize(searchParams.get('size'))
  const updateUrl = useCallback((next: { page?: number; size?: PageSize }) => { const params = new URLSearchParams(searchParams); if (next.page !== undefined) params.set('page', String(next.page)); if (next.size !== undefined) params.set('size', String(next.size)); setSearchParams(params, { replace: true }) }, [searchParams, setSearchParams])
  const [filas, setFilas] = useState<Factura[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const fetchIdRef = useRef(0)
  const [agregados, setAgregados] = useState<Agregados | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [pausarActualizacion, setPausarActualizacion] = useState(false)
  const [categoriasPyg, setCategoriasPyg] = useState<CatPyg[]>([])
  const [titulares, setTitulares] = useState<Titular[]>([])
  const [exportando, setExportando] = useState(false)
  const [preparando, setPreparando] = useState(false)
  const [modalTitular, setModalTitular] = useState<{ archivos: File[]; totalOriginal: number; rechazados: string[]; expandidosZip: number; comprimidosServidor: number; visible: boolean }>({ archivos: [], totalOriginal: 0, rechazados: [], expandidosZip: 0, comprimidosServidor: 0, visible: false })
  const [modalConfirmarSubida, setModalConfirmarSubida] = useState<{ archivos: File[]; totalOriginal: number; rechazados: string[]; expandidosZip: number; comprimidosServidor: number; visible: boolean; fnName: 'ocr-procesar-factura' | 'ocr-procesar-extracto' }>({ archivos: [], totalOriginal: 0, rechazados: [], expandidosZip: 0, comprimidosServidor: 0, visible: false, fnName: 'ocr-procesar-factura' })
  const [facturaEditando, setFacturaEditando] = useState<Factura | null>(null)
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [confirmarBorrarLote, setConfirmarBorrarLote] = useState(false)
  const [borrandoLote, setBorrandoLote] = useState(false)
  const [verRechazados, setVerRechazados] = useState(false)
  const { sessions, procesar } = useOcrUpload()
  const prevProcessingRef = useRef<Set<string>>(new Set())
  useEffect(() => { const cp = new Set(sessions.filter(s => s.procesando).map(s => s.id)); let t = false; prevProcessingRef.current.forEach(id => { if (!cp.has(id)) t = true }); if (t && !pausarActualizacion) setRefreshTick(x => x + 1); prevProcessingRef.current = cp }, [sessions, pausarActualizacion])
  useEffect(() => { const h = () => { if (!pausarActualizacion) setRefreshTick(x => x + 1) }; window.addEventListener('facturas:changed', h); return () => window.removeEventListener('facturas:changed', h) }, [pausarActualizacion])
  useEffect(() => { const t = setTimeout(() => setBusquedaDebounced(busqueda.trim()), 400); return () => clearTimeout(t) }, [busqueda])
  useEffect(() => { Promise.all([supabase.from('categorias_pyg').select('id, nombre, nivel, parent_id').eq('activa', true).order('orden'), supabase.from('titulares').select('id, nombre').eq('activo', true).order('orden')]).then(([cats, tits]) => { if (!cats.error) setCategoriasPyg(cats.data ?? []); if (!tits.error) setTitulares(tits.data ?? []) }) }, [])
  // F-04/A-01: hora local, no UTC (toISOString desfasa en UTC+1/+2)
  const periodoDesdeStr = fechaLocalStr(fechaDesde)
  const periodoHastaStr = fechaLocalStr(fechaHasta)
  // El "hasta" debe incluir el día completo (las facturas sin leer llevan created_at de
  // hoy a cualquier hora). Se usa el día siguiente como cota superior exclusiva.
  const periodoHastaExclusivo = (() => { const d = new Date(fechaHasta); d.setDate(d.getDate() + 1); return fechaLocalStr(d) })()

  // Detecta si la ordenación incluye la columna "estado" (calculada, requiere fetch full)
  const ordenaEstadoCalculado = ms.sorts.some((s: any) => s.col === 'estado')
  const filtraEstadoCalculado = filtroCard !== null

  // Conteo global de posibles duplicados (toda la base, no solo el periodo). Alimenta
  // la card "Duplicados" (quinta card) y su botón "Revisar bandeja".
  const cargarDupTotal = useCallback(async () => {
    const { count } = await supabase.from('facturas').select('id', { count: 'exact', head: true }).eq('posible_duplicado', true)
    setDupTotal(count ?? 0)
  }, [refreshTick])
  useEffect(() => { cargarDupTotal() }, [cargarDupTotal])

  const cargarPagina = useCallback(async () => {
    if (tab === 'extractos' || tab === 'ventas') { setCargando(false); return }
    const myFetchId = ++fetchIdRef.current
    setCargando(true); setErrorCarga(null)

    // Si filtra por correo, necesitamos primero los ids de facturas marcadas origen=correo
    let idsCorreo: string[] | null = null
    if (soloCorreo) {
      const { data: oc } = await supabase.from('facturas_origen_correo').select('factura_id')
      idsCorreo = (oc || []).map((r: any) => r.factura_id)
      if (idsCorreo.length === 0) { setFilas([]); setTotal(0); setCargando(false); return }
    }

    // Si filtra/ordena por estado calculado o por correo → trae TODAS las filas del periodo, filtra y ordena en cliente, pagina en cliente
    const necesitaClienteCompleto = ordenaEstadoCalculado || filtraEstadoCalculado || soloCorreo

    const sortMap: Record<string, string | null> = {
      fecha: 'fecha_factura', contraparte: 'proveedor_nombre', nif: 'nif_emisor',
      importe: 'total', categoria: 'categoria_factura', doc: 'pdf_drive_url',
      titular: 'titular_id', estado: null,
    }

    // El periodo filtra por created_at (fecha de SUBIDA), no por fecha_factura.
    // Motivo: las facturas sin plantilla no tienen fecha real legible y llevan
    // fecha_factura = hoy; filtrar por fecha_factura escondía el lote recién subido.
    // EXCEPCIÓN: la bandeja de duplicados ignora el periodo (revisión global).
    let q: any = supabase.from('facturas')
      .select('id, fecha_factura, proveedor_nombre, total, tipo, categoria_factura, nif_emisor, titular_id, pdf_drive_url, pdf_drive_id, pdf_filename, numero_factura, estado, doc_estado, posible_duplicado, facturas_gastos(conciliacion_id)', { count: 'exact' })

    if (!soloDuplicados) {
      q = q.gte('created_at', periodoDesdeStr).lt('created_at', periodoHastaExclusivo)
    } else {
      q = q.eq('posible_duplicado', true)
    }

    if (tab === 'facturas') q = q.in('tipo', ['proveedor', 'plataforma'])
    else q = q.eq('tipo', 'otro')
    if (catFiltro !== 'todas') q = q.eq('categoria_factura', catFiltro)
    if (idsCorreo) q = q.in('id', idsCorreo)
    if (busquedaDebounced) {
      const safe = busquedaDebounced.replace(/[%_,()]/g, ' ').trim()
      if (safe) q = q.or(`proveedor_nombre.ilike.%${safe}%,nif_emisor.ilike.%${safe}%,numero_factura.ilike.%${safe}%`)
    }

    // Orden servidor solo si el primer criterio (más prioritario) tiene mapeo en BD
    const orderList = ms.toSupabaseOrder(sortMap)
    if (!necesitaClienteCompleto && orderList.length > 0) {
      for (const o of orderList) q = q.order(o.field, { ascending: o.ascending })
    } else if (!necesitaClienteCompleto) {
      q = q.order('created_at', { ascending: false })
    } else {
      // Para cliente completo, traer ordenado por created_at como base estable
      q = q.order('created_at', { ascending: false })
    }

    if (!necesitaClienteCompleto) {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      q = q.range(from, to)
    } else {
      // Cliente completo: subir el tope por encima del límite por defecto de PostgREST (1000)
      q = q.range(0, 99999)
    }

    const { data, error, count } = await q
    if (myFetchId !== fetchIdRef.current) return

    if (error) {
      setErrorCarga('Error cargando. Intenta de nuevo.')
      setFilas([]); setTotal(0)
    } else {
      let mapped: Factura[] = (data ?? []).map((m: any) => ({
        id: m.id, fecha_factura: m.fecha_factura, proveedor_nombre: m.proveedor_nombre ?? '',
        total: Number(m.total) || 0, tipo: m.tipo ?? 'proveedor',
        categoria_factura: m.categoria_factura ?? null, nif_emisor: m.nif_emisor ?? null,
        titular_id: m.titular_id ?? null, pdf_drive_url: m.pdf_drive_url ?? null,
        pdf_drive_id: m.pdf_drive_id ?? null, pdf_filename: m.pdf_filename ?? null,
        numero_factura: m.numero_factura ?? null, estado: m.estado ?? '',
        doc_estado: m.doc_estado ?? null,
        posible_duplicado: !!m.posible_duplicado,
        matches_count: Array.isArray(m.facturas_gastos) ? m.facturas_gastos.length : 0
      }))

      // Enriquecer con estado_real desde v_estado_factura por los IDs cargados
      try {
        const ids = mapped.map(f => f.id)
        if (ids.length > 0) {
          const { data: vEstado } = await supabase
            .from('v_estado_factura')
            .select('factura_id, estado_real')
            .in('factura_id', ids)
          if (vEstado && vEstado.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const estadoMap = new Map((vEstado as any[]).map(r => [r.factura_id, r.estado_real]))
            mapped = mapped.map(f => ({ ...f, estado_real: (estadoMap.get(f.id) ?? null) as Factura['estado_real'] }))
          }
        }
      } catch { /* degradación segura: estado_real queda null, usa fallback legacy */ }

      if (myFetchId !== fetchIdRef.current) return

      if (necesitaClienteCompleto) {
        // 1. Filtrar por filtroCard
        let filtradas = mapped
        if (filtroCard === 'conciliadas') filtradas = mapped.filter(esConciliada)
        else if (filtroCard === 'pendientes') filtradas = mapped.filter(f => !esConciliada(f))

        // 2. Ordenar en cliente con todos los criterios (incluye "estado" calculado)
        const sortsActivos = ms.sorts
        if (sortsActivos.length > 0) {
          filtradas = [...filtradas].sort((a: Factura, b: Factura) => {
            for (const s of sortsActivos) {
              let va: any, vb: any
              switch(s.col) {
                case 'fecha':       va = a.fecha_factura ?? ''; vb = b.fecha_factura ?? ''; break
                case 'contraparte': va = (a.proveedor_nombre || '').toLowerCase(); vb = (b.proveedor_nombre || '').toLowerCase(); break
                case 'nif':         va = (a.nif_emisor || '').toLowerCase(); vb = (b.nif_emisor || '').toLowerCase(); break
                case 'importe':     va = a.total; vb = b.total; break
                case 'categoria':   va = a.categoria_factura ?? ''; vb = b.categoria_factura ?? ''; break
                case 'doc':         va = a.pdf_drive_url ? 1 : 0; vb = b.pdf_drive_url ? 1 : 0; break
                case 'titular':     va = a.titular_id ?? ''; vb = b.titular_id ?? ''; break
                case 'estado':      va = estadoSortKey(a); vb = estadoSortKey(b); break
                default:            va = ''; vb = ''
              }
              let cmp = 0
              if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
              else cmp = String(va).localeCompare(String(vb), 'es', { numeric: true })
              if (cmp !== 0) return s.dir === 'asc' ? cmp : -cmp
            }
            return 0
          })
        }

        // 3. Paginar en cliente
        const totalFiltradas = filtradas.length
        const from = (page - 1) * pageSize
        setFilas(filtradas.slice(from, from + pageSize))
        setTotal(totalFiltradas)
      } else {
        setFilas(mapped)
        setTotal(count ?? 0)
      }
    }
    setCargando(false)
  }, [page, pageSize, ms.sorts, filtroCard, soloCorreo, soloDuplicados, catFiltro, periodoDesdeStr, periodoHastaExclusivo, refreshTick, busquedaDebounced, tab, ordenaEstadoCalculado, filtraEstadoCalculado])

  // Cards: FUENTE ÚNICA DE VERDAD. El conteo e importe de conciliadas/pendientes
  // los calcula 100% en servidor la función ocr_agregados_facturas, que lee la
  // vista v_estado_factura (estado real = vínculo factura↔movimiento confirmado).
  // Antes se contaba con las 5 banderas sueltas (estado/doc_estado/...), que daban
  // cifras distintas en cada pantalla y inflaban el % con 'solo_drive'. Además esto
  // elimina la suma paginada sin orden estable y el truncado a 100k filas.
  const cargarAgregados = useCallback(async () => {
    const myFetchId = fetchIdRef.current
    try {
      const { data, error } = await supabase.rpc('ocr_agregados_facturas', { p_desde: periodoDesdeStr, p_hasta: periodoHastaExclusivo })
      if (error) throw error
      if (myFetchId !== fetchIdRef.current) return
      const r: any = Array.isArray(data) ? data[0] : data
      if (!r) { setAgregados(null); return }
      const tot = Number(r.total_count) || 0
      const conc = Number(r.conc_count) || 0
      setAgregados({
        totalCount: tot,
        totalImporte: Number(r.total_importe) || 0,
        conciliadasCount: conc,
        conciliadasPct: tot > 0 ? Math.round((conc / tot) * 100) : 0,
        conciliadasImporte: Number(r.conc_importe) || 0,
        pendientesCount: Math.max(0, tot - conc),
        pendientesImporte: Number(r.pend_importe) || 0
      })
    } catch { if (myFetchId === fetchIdRef.current) setAgregados(null) }
  }, [periodoDesdeStr, periodoHastaExclusivo, refreshTick])

  useEffect(() => { cargarPagina() }, [cargarPagina])
  useEffect(() => { cargarAgregados() }, [cargarAgregados])
  useEffect(() => { if (cargando || total === 0) return; const tp = Math.max(1, Math.ceil(total / pageSize)); if (page > tp) updateUrl({ page: tp }) }, [cargando, total, pageSize, page, updateUrl])
  useEffect(() => { setSeleccionadas(new Set()); setConfirmarBorrarLote(false) }, [page, pageSize, filtroCard, soloCorreo, soloDuplicados, catFiltro, busquedaDebounced, tab])
  const sortsKey = ms.sorts.map((s: any) => s.col+':'+s.dir).join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (page !== 1) updateUrl({ page: 1 }) }, [sortsKey])
  const onCambiarFiltroCard = (v: FiltroCard) => { setFiltroCard(prev => prev === v ? null : v); setSoloCorreo(false); setSoloDuplicados(false); if (page !== 1) updateUrl({ page: 1 }) }
  const onToggleSoloCorreo = () => { setSoloCorreo(prev => !prev); setFiltroCard(null); setSoloDuplicados(false); if (page !== 1) updateUrl({ page: 1 }) }
  const onToggleSoloDuplicados = () => { setSoloDuplicados(prev => !prev); setFiltroCard(null); setSoloCorreo(false); if (page !== 1) updateUrl({ page: 1 }) }
  const onCambiarBusqueda = (v: string) => { setBusqueda(v); if (page !== 1) updateUrl({ page: 1 }) }
  const onCambiarCatFiltro = (v: string) => { setCatFiltro(v); if (page !== 1) updateUrl({ page: 1 }) }
  const filasVisibles = useMemo(() => filas, [filas])
  const todasSeleccionadas = filasVisibles.length > 0 && filasVisibles.every(f => seleccionadas.has(f.id))
  const algunaSeleccionada = filasVisibles.some(f => seleccionadas.has(f.id))
  function toggleSeleccion(id: string) { setSeleccionadas(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  function toggleSeleccionTodas() { if (todasSeleccionadas) setSeleccionadas(new Set()); else setSeleccionadas(new Set(filasVisibles.map(f => f.id))) }
  // A-06/A-07/A-08: borrado atómico vía RPC — borra vínculos, resetea doc_estado
  // solo en movimientos que quedan SIN ninguna factura, borra las facturas y
  // devuelve los drive_id para borrar PDFs después.
  async function handleBorrarLote() {
    if (seleccionadas.size === 0) return
    setBorrandoLote(true)
    try {
      const ids = Array.from(seleccionadas)

      const { data: rpcData, error: rpcError } = await supabase.rpc('borrar_facturas_lote', { p_ids: ids })
      if (rpcError) throw rpcError

      // La RPC devuelve los drive_ids de los PDFs a borrar en Drive
      const driveIds = ((rpcData ?? []) as any[])
        .map((r: any) => (typeof r === 'string' ? r : (r?.drive_id ?? r?.pdf_drive_id ?? null)))
        .filter(Boolean) as string[]

      const driveErrors: string[] = []
      const chunks: string[][] = []
      for (let i = 0; i < driveIds.length; i += 5) chunks.push(driveIds.slice(i, i + 5))
      for (const chunk of chunks) {
        await Promise.allSettled(chunk.map(async driveId => {
          try {
            await supabase.functions.invoke('drive-borrar-archivo', { body: { drive_file_id: driveId } })
          } catch (e: any) {
            driveErrors.push(`${driveId}: ${e?.message || 'error'}`)
          }
        }))
      }
      if (driveErrors.length > 0) {
        toast.error(`No se pudieron borrar ${driveErrors.length} de ${driveIds.length} archivo(s) de Drive. Las facturas se borraron igualmente.`)
      }

      setSeleccionadas(new Set())
      setConfirmarBorrarLote(false)
      setRefreshTick(x => x + 1)
    } catch (err: any) {
      toast.error(err.message || 'Error borrando')
    } finally {
      setBorrandoLote(false)
    }
  }
  // "No es duplicado": aprende (no vuelve a marcarlas) y limpia la marca en la
  // factura y en su pareja. Reutiliza el mismo selector que el borrado.
  async function handleNoDuplicado() {
    if (seleccionadas.size === 0) return
    setMarcandoNoDup(true)
    try {
      for (const id of seleccionadas) {
        await supabase.rpc('marcar_no_duplicado', { p_id: id })
      }
      toast.success(`${seleccionadas.size} marcada(s) como no duplicado. No volverán a avisar.`)
      setSeleccionadas(new Set())
      setRefreshTick(x => x + 1)
    } catch (err: any) {
      toast.error(err?.message || 'Error al marcar no duplicado')
    } finally {
      setMarcandoNoDup(false)
    }
  }
  function getBadgeCategoria(f: Factura) { if (!f.categoria_factura) return null; const cat = categoriasPyg.find(c => c.id === f.categoria_factura); return cat ? { id: cat.id, nombre: cat.nombre } : { id: f.categoria_factura, nombre: f.categoria_factura } }
  const handleExportar = async () => { setExportando(true); try { const { data } = await supabase.from('facturas').select('fecha_factura, proveedor_nombre, nif_emisor, total, categoria_factura, pdf_drive_url, titular_id').gte('created_at', periodoDesdeStr).lt('created_at', periodoHastaExclusivo).range(0, 99999); const rows = (data ?? []).map((m: any) => { const tit = m.titular_id === RUBEN_ID ? 'Rubén' : m.titular_id === EMILIO_ID ? 'Emilio' : ''; return [m.fecha_factura, csvEscape(m.proveedor_nombre ?? ''), csvEscape(m.nif_emisor ?? ''), m.total, m.categoria_factura ?? '', m.pdf_drive_url ? 'Sí' : 'No', tit] }); const csv = [['Fecha', 'Contraparte', 'NIF', 'Total', 'Categoría', 'Doc', 'Titular'].join(','), ...rows.map(r => r.join(','))].join('\n'); const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `facturas_${new Date().toISOString().slice(0, 10)}.csv`; a.click() } catch {} finally { setExportando(false) } }
  const cardStyle = (_filtro: FiltroCard, isActive: boolean): React.CSSProperties => ({ background: '#fff', border: isActive ? '1px solid #FF4757' : '0.5px solid #d0c8bc', borderRadius: 14, padding: '16px 16px', cursor: 'pointer', boxShadow: isActive ? '0 0 0 3px #FF475715' : 'none', transition: 'border-color 0.15s, box-shadow 0.15s' })
  const HEADERS: { label: string; col: string; align: 'left' | 'right' | 'center' }[] = [{ label: 'Fecha', col: 'fecha', align: 'left' }, { label: 'Contraparte', col: 'contraparte', align: 'left' }, { label: 'NIF', col: 'nif', align: 'left' }, { label: 'Importe', col: 'importe', align: 'right' }, { label: 'Categoría', col: 'categoria', align: 'left' }, { label: 'Doc', col: 'doc', align: 'center' }, { label: 'Estado', col: 'estado', align: 'left' }, { label: 'Titular', col: 'titular', align: 'left' }]
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const TABS = [{ id: 'facturas', label: 'Facturas' }, { id: 'extractos', label: 'Extractos bancarios' }, { id: 'ventas', label: 'Ventas' }, { id: 'otros', label: 'Otros documentos' }]
  const emptyLabel = tab === 'otros' ? 'No hay documentos en este periodo' : 'No hay facturas en este periodo'
  const emptySub = tab === 'otros' ? 'Prueba a cambiar el periodo o sube tus primeros documentos' : 'Prueba a cambiar el periodo o sube tus primeras facturas'
  const gridCols = tab === 'facturas' ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)'
  return (
    <div style={groupStyle(T)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}><div><h1 style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: '#B01D23', textTransform: 'uppercase', letterSpacing: '3px', margin: 0 }}>OCR</h1><p style={{ fontFamily: FONT.body, fontSize: 13, color: '#7a8090', marginTop: 4, marginBottom: 0 }}>{periodoLabel}</p></div><SelectorFechaUniversal nombreModulo="ocr" defaultOpcion="mes_en_curso" onChange={(desde, hasta, label) => { setFechaDesde(desde); setFechaHasta(hasta); setPeriodoLabel(label) }} /></div>
      <TabsPastilla tabs={TABS} activeId={tab} onChange={(id) => setTab(id as TabId)} />
      {tab === 'extractos' && (<div style={{ marginTop: 14 }}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}><BtnSubirSplit label="Subir extractos" accept={ACCEPT_EXTRACTOS} extensiones={EXT_ACEPTADAS_EXTRACTOS} preparando={preparando} setPreparando={setPreparando} onArchivos={(r) => { setVerRechazados(false); setModalTitular({ archivos: r.aceptados, totalOriginal: r.totalOriginal, rechazados: r.rechazados, expandidosZip: r.expandidosZip, comprimidosServidor: r.comprimidosServidor, visible: true }) }} /></div><div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, overflow: 'hidden' }}><ExtractosTabla refreshTick={refreshTick} titulares={titulares} /></div></div>)}
      {tab === 'ventas' && (<div style={{ marginTop: 14 }}><div style={{ marginBottom: 14 }}><BtnSubirSplit label="Subir ventas" accept={ACCEPT_FACTURAS} extensiones={EXT_ACEPTADAS_FACTURAS} preparando={preparando} setPreparando={setPreparando} onArchivos={(r) => { setVerRechazados(false); setModalConfirmarSubida({ archivos: r.aceptados, totalOriginal: r.totalOriginal, rechazados: r.rechazados, expandidosZip: r.expandidosZip, comprimidosServidor: r.comprimidosServidor, visible: true, fnName: 'ocr-procesar-factura' }) }} /></div><CardFacturasCorreo tipo="ventas" desde={periodoDesdeStr} hasta={periodoHastaStr} onBarrido={() => setRefreshTick(x => x + 1)} /><VentasTab fechaDesde={fechaDesde} fechaHasta={fechaHasta} titulares={titulares} /></div>)}
      {(tab === 'facturas' || tab === 'otros') && (<>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12, marginBottom: 12, marginTop: 14 }}>
          <div onClick={() => onCambiarFiltroCard(null)} style={cardStyle(null, filtroCard === null && !soloCorreo && !soloDuplicados)}><div style={{ marginBottom: 8 }}><span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Total facturas</span></div><div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#111' }}>{agregados?.totalCount ?? '—'}</div><div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 4 }}>{agregados ? fmtEur(agregados.totalImporte) : '—'}</div></div>
          <div onClick={() => onCambiarFiltroCard('conciliadas')} style={cardStyle('conciliadas', filtroCard === 'conciliadas')}><div style={{ marginBottom: 8 }}><span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Conciliadas</span></div><div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#1D9E75' }}>{agregados?.conciliadasCount ?? '—'}</div><div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 4 }}>{agregados ? `${agregados.conciliadasPct}% · ${fmtEur(agregados.conciliadasImporte)}` : '—'}</div></div>
          <div onClick={() => onCambiarFiltroCard('pendientes')} style={cardStyle('pendientes', filtroCard === 'pendientes')}><div style={{ marginBottom: 8 }}><span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Pendientes</span></div><div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#F26B1F' }}>{agregados?.pendientesCount ?? '—'}</div><div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 4 }}>{agregados ? `Faltan datos · ${fmtEur(agregados.pendientesImporte)}` : '—'}</div></div>
          {tab === 'facturas' && (<CardFacturasCorreo tipo="factura" desde={periodoDesdeStr} hasta={periodoHastaStr} activa={soloCorreo} onClick={onToggleSoloCorreo} onBarrido={() => setRefreshTick(x => x + 1)} />)}
          {tab === 'facturas' && (
            <div style={cardStyle(null, soloDuplicados)}>
              <div style={{ marginBottom: 8 }}><span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Duplicados</span></div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: dupTotal > 0 ? '#F26B1F' : '#1D9E75' }}>{dupTotal}</div>
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 4, marginBottom: 12 }}>{dupTotal > 0 ? 'a revisar' : 'sin duplicados'}</div>
              <button onClick={(e) => { e.stopPropagation(); onToggleSoloDuplicados() }} disabled={dupTotal === 0 && !soloDuplicados} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', background: (dupTotal === 0 && !soloDuplicados) ? '#d0c8bc' : '#B01D23', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: (dupTotal === 0 && !soloDuplicados) ? 'default' : 'pointer', fontWeight: 600 }}>{soloDuplicados ? 'Ver todas' : 'Revisar bandeja'}</button>
            </div>
          )}
        </div>
        <div style={{ marginBottom: 14 }}>
          <BtnSubirSplit label={tab === 'facturas' ? 'Subir facturas' : 'Subir documentos'} accept={tab === 'facturas' ? ACCEPT_FACTURAS : ACCEPT_OTROS} extensiones={tab === 'facturas' ? EXT_ACEPTADAS_FACTURAS : EXT_ACEPTADAS_OTROS} preparando={preparando} setPreparando={setPreparando} onArchivos={(r) => { setVerRechazados(false); setModalConfirmarSubida({ archivos: r.aceptados, totalOriginal: r.totalOriginal, rechazados: r.rechazados, expandidosZip: r.expandidosZip, comprimidosServidor: r.comprimidosServidor, visible: true, fnName: 'ocr-procesar-factura' }) }} />
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}><div style={{ flex: 1, minWidth: 240, position: 'relative' }}><input type="text" value={busqueda} onChange={e => onCambiarBusqueda(e.target.value)} placeholder="Buscar contraparte, NIF o número de factura…" style={{ width: '100%', padding: '10px 36px 10px 14px', borderRadius: 10, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', outline: 'none', boxSizing: 'border-box' }} />{busqueda && <button onClick={() => onCambiarBusqueda('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: '#f5f3ef', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 14, color: '#7a8090', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>}</div><select value={catFiltro} onChange={e => onCambiarCatFiltro(e.target.value)} style={{ padding: '10px 14px', borderRadius: 10, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', minWidth: 280, cursor: 'pointer' }}><option value="todas">Categorías</option>{categoriasPyg.filter(c => c.nivel === 3).map(c => <option key={c.id} value={c.id}>{c.id} · {c.nombre}</option>)}</select><ClearSortButton show={ms.showClearButton} onClear={ms.clearSorts} /><button onClick={() => setPausarActualizacion(v => !v)} style={{ padding: '10px 18px', borderRadius: 10, border: pausarActualizacion ? '0.5px solid #F26B1F' : '0.5px solid #d0c8bc', background: pausarActualizacion ? '#F26B1F15' : '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: pausarActualizacion ? '#F26B1F' : '#3a4050', cursor: 'pointer', fontWeight: 500 }}>{pausarActualizacion ? '⏸ Actualización pausada' : 'Pausar actualización'}</button><button onClick={handleExportar} disabled={exportando} style={{ padding: '10px 18px', borderRadius: 10, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#3a4050', cursor: exportando ? 'default' : 'pointer', fontWeight: 500, opacity: exportando ? 0.6 : 1 }}>{exportando ? 'Exportando...' : 'Exportar'}</button></div>
        {soloDuplicados && (<div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090', marginBottom: 10 }}>Bandeja de posibles duplicados (toda la base, ignora el periodo). Selecciona y elige: <strong>Borrar</strong> si sobra, o <strong>No es duplicado</strong> si las dos son legítimas (no volverán a avisar).</div>)}
        {seleccionadas.size > 0 && (<div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', marginBottom: 12, background: '#FF475710', border: '0.5px solid #FF4757', borderRadius: 10 }}><span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#B01D23', fontWeight: 500 }}>{seleccionadas.size} factura{seleccionadas.size > 1 ? 's' : ''} seleccionada{seleccionadas.size > 1 ? 's' : ''}</span><div style={{ flex: 1 }} />{!confirmarBorrarLote ? (<><button onClick={() => setSeleccionadas(new Set())} style={{ padding: '6px 12px', borderRadius: 6, border: '0.5px solid #d0c8bc', background: '#fff', color: '#3a4050', fontFamily: 'Lexend, sans-serif', fontSize: 12, cursor: 'pointer' }}>Quitar selección</button>{soloDuplicados && (<button onClick={handleNoDuplicado} disabled={marcandoNoDup} style={{ padding: '6px 14px', borderRadius: 6, border: '0.5px solid #1D9E75', background: '#fff', color: '#0F6E56', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 500, opacity: marcandoNoDup ? 0.6 : 1 }}>{marcandoNoDup ? 'Marcando…' : 'No es duplicado'}</button>)}<button onClick={() => setConfirmarBorrarLote(true)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#E24B4A', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 500 }}>Borrar seleccionadas</button></>) : (<><span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#B01D23', fontWeight: 500 }}>¿Seguro? Se borran las facturas, sus asociaciones y los PDFs en Drive.</span><button onClick={() => setConfirmarBorrarLote(false)} disabled={borrandoLote} style={{ padding: '6px 12px', borderRadius: 6, border: '0.5px solid #d0c8bc', background: '#fff', color: '#3a4050', fontFamily: 'Lexend, sans-serif', fontSize: 12, cursor: 'pointer' }}>Cancelar</button><button onClick={handleBorrarLote} disabled={borrandoLote} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#E24B4A', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 500, opacity: borrandoLote ? 0.6 : 1 }}>{borrandoLote ? 'Borrando…' : 'Sí, borrar'}</button></>)}</div>)}
        {errorCarga && (<div style={{ background: '#fff5f5', border: '0.5px solid #B01D23', borderRadius: 8, padding: '10px 14px', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#B01D23' }}><span>{errorCarga}</span><button onClick={() => { cargarPagina(); cargarAgregados() }} style={{ background: '#B01D23', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontFamily: 'Oswald, sans-serif', fontSize: 11, textTransform: 'uppercase', cursor: 'pointer' }}>Reintentar</button></div>)}
        {!cargando && total === 0 && !errorCarga ? (<div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, padding: '48px 28px', textAlign: 'center' }}><div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, color: '#7a8090', letterSpacing: 1, marginBottom: 8 }}>{soloDuplicados ? 'No hay posibles duplicados' : emptyLabel}</div><div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090' }}>{soloDuplicados ? 'Nada que revisar' : emptySub}</div></div>) : (
          <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, overflow: 'hidden' }}>
            {cargando ? <div style={{ padding: '24px 16px', textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090' }}>Cargando…</div> : (<div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', minWidth: 940, fontFamily: 'Lexend, sans-serif', fontSize: 13 }}><colgroup><col style={{ width: 40 }} /><col style={{ width: 90 }} /><col /><col style={{ width: '14%' }} /><col style={{ width: 110 }} /><col style={{ width: 200 }} /><col style={{ width: 60 }} /><col style={{ width: 130 }} /><col style={{ width: 100 }} /></colgroup><thead><tr><th style={{ padding: '10px 8px', background: '#f5f3ef', borderBottom: '0.5px solid #d0c8bc', textAlign: 'center' }}><input type="checkbox" checked={todasSeleccionadas} ref={el => { if (el) el.indeterminate = !todasSeleccionadas && algunaSeleccionada }} onChange={toggleSeleccionTodas} style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#FF4757' }} /></th>{HEADERS.map(h => <SortableHeader key={h.col} col={h.col} label={h.label} sortIndex={ms.sortIndex(h.col)} sortDir={ms.sortDir(h.col)} onToggle={ms.toggleSort} align={h.align} />)}</tr></thead><tbody>
              {filasVisibles.length === 0 ? (<tr><td colSpan={9} style={{ padding: '32px 16px', textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090' }}>Sin resultados</td></tr>) : filasVisibles.map((f, idx) => {
                const isLast = idx === filasVisibles.length - 1; const tdBase: React.CSSProperties = { padding: '8px 16px', borderBottom: isLast ? 'none' : '0.5px solid #ebe8e2', verticalAlign: 'middle', lineHeight: 1.4 }; const tdDocBase: React.CSSProperties = { padding: 0, borderBottom: isLast ? 'none' : '0.5px solid #ebe8e2', verticalAlign: 'middle', textAlign: 'center' }; const catInfo = getBadgeCategoria(f); const estadoDoc = getEstadoDoc(f); const conciliada = estadoDoc === 'conciliada'; const titNombre = titulares.find(t => t.id === f.titular_id)?.nombre?.toLowerCase() ?? ''; const isRuben = titNombre.includes('rubén') || titNombre.includes('ruben'); const isEmilio = titNombre.includes('emilio'); const contraparte = f.proveedor_nombre || '—'; const sel = seleccionadas.has(f.id)
                return (<tr key={f.id} style={{ cursor: 'pointer', background: sel ? '#FF475710' : (f.posible_duplicado ? '#FFF7ED' : undefined) }} onClick={() => setFacturaEditando(f)} onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = '#f5f3ef60' }} onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = f.posible_duplicado ? '#FFF7ED' : '' }}><td style={{ ...tdBase, padding: '8px', textAlign: 'center' }} onClick={e => { e.stopPropagation(); toggleSeleccion(f.id) }}><input type="checkbox" checked={sel} onChange={() => toggleSeleccion(f.id)} onClick={e => e.stopPropagation()} style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#FF4757' }} /></td><td style={{ ...tdBase, color: '#7a8090', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(f.fecha_factura)}</td><td style={{ ...tdBase, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.posible_duplicado && <span title="Posible duplicado" style={{ marginRight: 6 }}>⚠</span>}{contraparte.length > 40 ? contraparte.slice(0, 40) + '…' : contraparte}</td><td style={{ ...tdBase, color: f.nif_emisor ? '#111' : '#7a8090', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nif_emisor || 'Sin identificar'}</td><td style={{ ...tdBase, textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 500, letterSpacing: '0.5px', color: f.total >= 0 ? '#1D9E75' : '#E24B4A', whiteSpace: 'nowrap' }}>{fmtNumES(f.total, 2)}</td><td style={{ ...tdBase, overflow: 'hidden' }}>{catInfo ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 6, background: '#f5f3ef', border: '0.5px solid #d0c8bc', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#3a4050', whiteSpace: 'nowrap' }}><span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1px', color: '#7a8090', fontWeight: 500 }}>{catInfo.id}</span>{catInfo.nombre}</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, background: '#E24B4A10', border: '0.5px dashed #E24B4A50', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#E24B4A', fontStyle: 'italic' }}>sin categoría</span>}</td><td style={tdDocBase}><DocBadge estado={estadoDoc} url={f.pdf_drive_url} onClick={() => setFacturaEditando(f)} /></td><td style={tdBase}>{conciliada ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', fontWeight: 500, textTransform: 'uppercase', background: '#1D9E7515', color: '#0F6E56' }}>Conciliada</span> : estadoDoc === 'no_requiere' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', fontWeight: 500, textTransform: 'uppercase', background: '#1D9E7515', color: '#0F6E56' }}>Conciliada</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', fontWeight: 500, textTransform: 'uppercase', background: '#F26B1F15', color: '#F26B1F' }}>Pendiente</span>}</td><td style={tdBase}>{isRuben ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Lexend, sans-serif', fontSize: 12, fontWeight: 500, background: '#F26B1F15', color: '#F26B1F', whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F26B1F', flexShrink: 0 }} />Rubén</span> : isEmilio ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Lexend, sans-serif', fontSize: 12, fontWeight: 500, background: '#1E5BCC15', color: '#1E5BCC', whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1E5BCC', flexShrink: 0 }} />Emilio</span> : <span style={{ color: '#7a8090', fontFamily: 'Lexend, sans-serif', fontSize: 12 }}>—</span>}</td></tr>)
              })}</tbody></table></div>)}
            {total > 0 && (() => { const desde = (page - 1) * pageSize + 1; const hasta = Math.min(page * pageSize, total); const isFirst = page === 1, isLast2 = page === totalPages; const btnBase: React.CSSProperties = { background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 8, padding: '6px 12px', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', cursor: 'pointer' }; const btnDis: React.CSSProperties = { ...btnBase, opacity: 0.35, cursor: 'default' }; return (<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#fafaf7', borderTop: '0.5px solid #d0c8bc' }}><span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090' }}>{`Mostrando ${desde.toLocaleString('es-ES')}–${hasta.toLocaleString('es-ES')} de ${total.toLocaleString('es-ES')} facturas`}</span>{totalPages > 1 && (<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><label style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, color: '#7a8090', textTransform: 'uppercase' }}>Filas:</label><select value={pageSize} onChange={e => updateUrl({ page: 1, size: Number(e.target.value) as PageSize })} style={{ padding: '6px 10px', borderRadius: 8, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>{PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}</select><button style={isFirst ? btnDis : btnBase} disabled={isFirst} onClick={() => !isFirst && updateUrl({ page: 1 })}>Primera</button><button style={isFirst ? btnDis : btnBase} disabled={isFirst} onClick={() => !isFirst && updateUrl({ page: page - 1 })}>‹ Anterior</button><span style={{ ...btnBase, cursor: 'default' }}>{`Página ${page} de ${totalPages}`}</span><button style={isLast2 ? btnDis : btnBase} disabled={isLast2} onClick={() => !isLast2 && updateUrl({ page: page + 1 })}>Siguiente ›</button><button style={isLast2 ? btnDis : btnBase} disabled={isLast2} onClick={() => !isLast2 && updateUrl({ page: totalPages })}>Última</button></div>)}</div>) })()}
          </div>
        )}
      </>)}
      {modalConfirmarSubida.visible && (<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}><div style={{ background: '#fff', padding: 28, borderRadius: 14, minWidth: 380, maxWidth: 560, maxHeight: '85vh', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}><div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase', color: '#B01D23', marginBottom: 12 }}>Confirmar subida</div><div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 14, color: '#111', marginBottom: 4 }}>Seleccionados: <strong>{modalConfirmarSubida.totalOriginal}</strong></div>{modalConfirmarSubida.expandidosZip > 0 && (<div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#1E5BCC', marginBottom: 4 }}>Extraídos de comprimidos ZIP: <strong>{modalConfirmarSubida.expandidosZip}</strong></div>)}<div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 14, color: '#1D9E75', marginBottom: 4 }}>Listos para subir ahora: <strong>{modalConfirmarSubida.archivos.length - modalConfirmarSubida.comprimidosServidor}</strong></div>{modalConfirmarSubida.comprimidosServidor > 0 && (<div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#F26B1F', marginBottom: 4 }}>Comprimidos RAR/7z: <strong>{modalConfirmarSubida.comprimidosServidor}</strong> <span style={{ fontSize: 11, color: '#7a8090' }}>(el servidor los abrirá — el total de facturas puede crecer)</span></div>)}{modalConfirmarSubida.rechazados.length > 0 && (<><div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 14, color: '#E24B4A', marginBottom: 8 }}>Rechazados: <strong>{modalConfirmarSubida.rechazados.length}</strong>{' '}<button onClick={() => setVerRechazados(v => !v)} style={{ background: 'none', border: 'none', color: '#B01D23', fontFamily: 'Lexend, sans-serif', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>{verRechazados ? 'ocultar' : 'ver lista'}</button></div>{verRechazados && (<div style={{ background: '#fff5f5', border: '0.5px solid #E24B4A50', borderRadius: 8, padding: '10px 12px', maxHeight: 200, overflowY: 'auto', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginBottom: 8 }}>{modalConfirmarSubida.rechazados.map((n, i) => <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '2px 0' }}>{n}</div>)}</div>)}</>)}<div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090', marginTop: 8, marginBottom: 18 }}>Se procesarán con OCR y se guardarán en el sistema</div><div style={{ display: 'flex', gap: 10 }}><button onClick={() => { setModalConfirmarSubida({ archivos: [], totalOriginal: 0, rechazados: [], expandidosZip: 0, comprimidosServidor: 0, visible: false, fnName: 'ocr-procesar-factura' }); setVerRechazados(false) }} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '0.5px solid #d0c8bc', background: '#fff', color: '#3a4050', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer' }}>Cancelar</button><button disabled={modalConfirmarSubida.archivos.length === 0} onClick={() => { const a = modalConfirmarSubida.archivos; const fn = modalConfirmarSubida.fnName; setModalConfirmarSubida({ archivos: [], totalOriginal: 0, rechazados: [], expandidosZip: 0, comprimidosServidor: 0, visible: false, fnName: 'ocr-procesar-factura' }); setVerRechazados(false); procesar(a, fn, null) }} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: 'none', background: modalConfirmarSubida.archivos.length === 0 ? '#d0c8bc' : '#B01D23', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: modalConfirmarSubida.archivos.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Enviar {modalConfirmarSubida.archivos.length}</button></div></div></div>)}
      {modalTitular.visible && (<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}><div style={{ background: '#fff', padding: 28, borderRadius: 14, minWidth: 380, maxWidth: 560, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}><div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase', color: '#B01D23', marginBottom: 12 }}>Extracto bancario</div><div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 14, color: '#111', marginBottom: 4 }}>Seleccionados: <strong>{modalTitular.totalOriginal}</strong></div>{modalTitular.expandidosZip > 0 && (<div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#1E5BCC', marginBottom: 4 }}>Extraídos de comprimidos ZIP: <strong>{modalTitular.expandidosZip}</strong></div>)}<div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 14, color: '#1D9E75', marginBottom: 4 }}>Listos para subir ahora: <strong>{modalTitular.archivos.length - modalTitular.comprimidosServidor}</strong></div>{modalTitular.comprimidosServidor > 0 && (<div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#F26B1F', marginBottom: 4 }}>Comprimidos RAR/7z: <strong>{modalTitular.comprimidosServidor}</strong> <span style={{ fontSize: 11, color: '#7a8090' }}>(el servidor los abrirá — el total puede crecer)</span></div>)}{modalTitular.rechazados.length > 0 && (<div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#E24B4A', marginBottom: 8 }}>Rechazados: <strong>{modalTitular.rechazados.length}</strong></div>)}<div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', marginTop: 10, marginBottom: 14 }}>¿De quién es este extracto?</div><div style={{ display: 'flex', gap: 10 }}><button disabled={modalTitular.archivos.length === 0} onClick={() => { const a = modalTitular.archivos; setModalTitular({ archivos: [], totalOriginal: 0, rechazados: [], expandidosZip: 0, comprimidosServidor: 0, visible: false }); procesar(a, 'ocr-procesar-extracto', RUBEN_ID) }} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '0.5px solid #F26B1F', background: '#F26B1F', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', opacity: modalTitular.archivos.length === 0 ? 0.4 : 1 }}>Rubén</button><button disabled={modalTitular.archivos.length === 0} onClick={() => { const a = modalTitular.archivos; setModalTitular({ archivos: [], totalOriginal: 0, rechazados: [], expandidosZip: 0, comprimidosServidor: 0, visible: false }); procesar(a, 'ocr-procesar-extracto', EMILIO_ID) }} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '0.5px solid #1E5BCC', background: '#1E5BCC', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', opacity: modalTitular.archivos.length === 0 ? 0.4 : 1 }}>Emilio</button></div><button onClick={() => setModalTitular({ archivos: [], totalOriginal: 0, rechazados: [], expandidosZip: 0, comprimidosServidor: 0, visible: false })} style={{ marginTop: 14, width: '100%', padding: '8px', background: 'none', border: 'none', color: '#7a8090', fontFamily: 'Lexend, sans-serif', fontSize: 12, cursor: 'pointer' }}>Cancelar</button></div></div>)}
      {facturaEditando && (<ModalDetalleFactura factura={facturaEditando as any} categoriasPyg={categoriasPyg} onClose={() => setFacturaEditando(null)} onSaved={() => { setFacturaEditando(null); setRefreshTick(x => x + 1) }} onDeleted={() => { setFacturaEditando(null); setRefreshTick(x => x + 1) }} />)}
    </div>
  )
}
