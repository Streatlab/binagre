/**
 * GestorDocumental — Tabs: Facturas / Ventas / Exportar
 *
 * Selector mes: dropdown custom con meses desde primera factura hasta hoy.
 * Banner gestoría: idéntico a BannerPendientes (mismos estilos exactos).
 * Check "facturas importadas": confirmación manual con botón.
 * Check "ventas Uber": automático cuando se suban en tab Ventas.
 */

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type CSSProperties,
} from 'react'
import {
  COLORS,
  FONT,
  DROPDOWN_BTN,
} from '@/components/panel/resumen/tokens'
import { ChevronDown } from 'lucide-react'
import { X } from 'lucide-react'
import TabsPastilla from '@/components/ui/TabsPastilla'
import { supabase } from '@/lib/supabase'

type TabId = 'facturas' | 'ventas' | 'exportar'
type SortColumn = 'fecha' | 'proveedor' | 'nif' | 'importe' | 'categoria' | 'titular' | 'doc' | 'estado'
type SortDir = 'asc' | 'desc'

interface Titular {
  id: string
  nombre: string
  color: string
  carpeta_drive: string | null
}

interface CategoriaPyg {
  id: string
  nivel: number
  parent_id: string | null
  nombre: string
  bloque: string
  orden: number
}

interface FacturaRow {
  id: string
  fecha_factura: string | null
  proveedor_nombre: string
  total: number | null
  estado: string | null
  titular_id: string | null
  pdf_drive_url: string | null
  pdf_filename: string | null
  pdf_original_name: string | null
  categoria_factura: string | null
  nif_emisor: string | null
  tipo: string | null
}

interface DriveFiltro {
  titular_id?: string
  anio?: number
  trimestre?: number
  mes?: number
}

interface DriveNode {
  label: string
  count: number
  importe: number
  children?: DriveNode[]
  filtro: DriveFiltro
  kind: 'titular' | 'anio' | 'trim' | 'mes'
  trimNum?: number
}

/* Mes seleccionado: { anio, mes } */
interface MesSel { anio: number; mes: number }

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'facturas', label: 'Facturas' },
  { id: 'ventas',   label: 'Ventas' },
  { id: 'exportar', label: 'Exportar' },
]

const COLOR_RUBEN  = '#F26B1F'
const COLOR_EMILIO = '#1E5BCC'

function colorTitular(nombre: string | undefined, fallback: string): string {
  if (!nombre) return fallback
  const k = nombre.toLowerCase().trim()
  if (k.includes('rubén') || k.includes('ruben')) return COLOR_RUBEN
  if (k.includes('emilio')) return COLOR_EMILIO
  return fallback
}

const TRIM_PALETTE: Record<number, { bg: string; head: string; headDark: string; tot: string }> = {
  1: { bg: '#dde8f4', head: '#7da3c8', headDark: '#3a5f80', tot: '#b5cae3' },
  2: { bg: '#dee9d4', head: '#7da569', headDark: '#3d6027', tot: '#b6cea3' },
  3: { bg: '#f4e8c8', head: '#c89945', headDark: '#7d5a1a', tot: '#e8cf85' },
  4: { bg: '#e3d8eb', head: '#7e5c9b', headDark: '#4a3163', tot: '#bfa6cf' },
}
const ANIO_BG = '#fbe5e8'

const MESES_NOMBRE = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const MESES_POR_TRIM: Record<number, number[]> = {
  1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12],
}

function trimestreEnCurso(mesActual: number): number {
  return Math.ceil(mesActual / 3)
}

function fmtFechaCorta(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

function fmtNum(n: number | null | undefined, dec = 2): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '0,00'
  return Number(n).toLocaleString('es-ES', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
}

function colorEstado(estado: string | null): { bg: string; col: string; lbl: string } {
  switch (estado) {
    case 'asociada':                 return { bg: '#e8f5ec', col: COLORS.ok,    lbl: 'CONCILIADA' }
    case 'pendiente_revision':       return { bg: '#fcf0dc', col: COLORS.warn,  lbl: 'PEND. REV.' }
    case 'pendiente_titular_manual': return { bg: '#fcf0dc', col: COLORS.warn,  lbl: 'FALTA TITULAR' }
    case 'sin_match':                return { bg: '#fce8e8', col: COLORS.redSL, lbl: 'SIN MATCH' }
    case 'historica':                return { bg: '#eef0f4', col: COLORS.mut,   lbl: 'HISTÓRICA' }
    case 'duplicada':                return { bg: '#fce8e8', col: COLORS.redSL, lbl: 'DUPLICADA' }
    case 'error':                    return { bg: '#fce8e8', col: COLORS.redSL, lbl: 'ERROR' }
    case 'procesando':               return { bg: '#eef0f4', col: COLORS.mut,   lbl: 'PROCESANDO' }
    default:                         return { bg: '#eef0f4', col: COLORS.mut,   lbl: (estado || '—').toUpperCase() }
  }
}

/* Genera lista de meses desde primeraFecha hasta hoy, desc */
function generarMeses(primeraFecha: string): MesSel[] {
  const hoy = new Date()
  const [ay, am] = primeraFecha.split('-').map(Number)
  const result: MesSel[] = []
  let anio = hoy.getFullYear()
  let mes = hoy.getMonth() + 1
  while (anio > ay || (anio === ay && mes >= am)) {
    result.push({ anio, mes })
    mes--
    if (mes === 0) { mes = 12; anio-- }
  }
  return result
}

function mesLabel(m: MesSel): string {
  return `${MESES_NOMBRE[m.mes]} ${m.anio}`
}

function mesDesde(m: MesSel): string {
  return `${m.anio}-${String(m.mes).padStart(2, '0')}-01`
}

function mesHasta(m: MesSel): string {
  const ultimo = new Date(m.anio, m.mes, 0).getDate()
  return `${m.anio}-${String(m.mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`
}

/* Selector de mes custom igual al estilo dropdown del sistema */
function SelectorMes({
  meses, seleccionado, onChange,
}: {
  meses: MesSel[]
  seleccionado: MesSel
  onChange: (m: MesSel) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '6px 10px', borderRadius: 8,
          border: '0.5px solid #d0c8bc', background: '#ffffff',
          fontSize: 13, fontFamily: 'Lexend, sans-serif', color: '#111111',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          whiteSpace: 'nowrap',
        }}
      >
        <span>{mesLabel(seleccionado)}</span>
        <ChevronDown size={11} strokeWidth={2.5} style={{ marginLeft: 4 }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, background: '#fff',
          border: '0.5px solid #d0c8bc', borderRadius: 8, width: 200,
          fontSize: 13, color: '#3a4050',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)', zIndex: 50,
          maxHeight: 280, overflowY: 'auto',
        }}>
          {meses.map((m, i) => {
            const isActive = m.anio === seleccionado.anio && m.mes === seleccionado.mes
            return (
              <button
                key={i}
                onClick={() => { onChange(m); setOpen(false) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 12px', background: isActive ? '#FF475715' : 'transparent',
                  color: isActive ? '#FF4757' : '#7a8090', border: 'none',
                  fontSize: 13, fontFamily: 'Lexend, sans-serif',
                  cursor: 'pointer', fontWeight: isActive ? 500 : 400,
                }}
              >
                {mesLabel(m)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function buildDriveTree(facturas: FacturaRow[], titulares: Titular[]): DriveNode[] {
  const counts = new Map<string, Map<number, Map<number, { count: number; importe: number }>>>()
  for (const f of facturas) {
    if (!f.fecha_factura || !f.titular_id) continue
    const d = new Date(f.fecha_factura + 'T00:00:00')
    const anio = d.getFullYear()
    const mes  = d.getMonth() + 1
    if (!counts.has(f.titular_id)) counts.set(f.titular_id, new Map())
    const tMap = counts.get(f.titular_id)!
    if (!tMap.has(anio)) tMap.set(anio, new Map())
    const aMap = tMap.get(anio)!
    if (!aMap.has(mes)) aMap.set(mes, { count: 0, importe: 0 })
    const node = aMap.get(mes)!
    node.count += 1
    node.importe += Number(f.total || 0)
  }
  const hoy = new Date()
  const anioActual = hoy.getFullYear()
  const aniosSet = new Set<number>([anioActual, anioActual - 1])
  for (const tMap of counts.values()) {
    for (const a of tMap.keys()) aniosSet.add(a)
  }
  const anios = Array.from(aniosSet).sort((a, b) => b - a)
  const tree: DriveNode[] = []
  for (const t of titulares) {
    const tMap = counts.get(t.id)
    const titNode: DriveNode = {
      label: t.nombre, count: 0, importe: 0, children: [],
      filtro: { titular_id: t.id }, kind: 'titular',
    }
    for (const anio of anios) {
      const aMap = tMap?.get(anio)
      const aNode: DriveNode = {
        label: String(anio), count: 0, importe: 0, children: [],
        filtro: { titular_id: t.id, anio }, kind: 'anio',
      }
      for (const trim of [1, 2, 3, 4]) {
        const qNode: DriveNode = {
          label: `T${trim}`, count: 0, importe: 0, children: [],
          filtro: { titular_id: t.id, anio, trimestre: trim }, kind: 'trim', trimNum: trim,
        }
        for (const mes of MESES_POR_TRIM[trim]) {
          const data = aMap?.get(mes) ?? { count: 0, importe: 0 }
          qNode.children!.push({
            label: MESES_NOMBRE[mes], count: data.count, importe: data.importe,
            filtro: { titular_id: t.id, anio, trimestre: trim, mes },
            kind: 'mes', trimNum: trim,
          })
          qNode.count += data.count
          qNode.importe += data.importe
        }
        aNode.children!.push(qNode)
        aNode.count += qNode.count
        aNode.importe += qNode.importe
      }
      titNode.children!.push(aNode)
      titNode.count += aNode.count
      titNode.importe += aNode.importe
    }
    tree.push(titNode)
  }
  return tree
}

function flattenCategorias(cats: CategoriaPyg[]): Array<{ id: string; label: string }> {
  const byParent = new Map<string | null, CategoriaPyg[]>()
  for (const c of cats) {
    const k = c.parent_id ?? null
    if (!byParent.has(k)) byParent.set(k, [])
    byParent.get(k)!.push(c)
  }
  for (const arr of byParent.values()) arr.sort((a, b) => a.orden - b.orden)
  const out: Array<{ id: string; label: string }> = []
  function walk(parent: string | null, depth: number) {
    const hijos = byParent.get(parent) || []
    for (const c of hijos) {
      const indent = '   '.repeat(depth)
      out.push({ id: c.id, label: `${indent}${c.id} ${c.nombre}` })
      walk(c.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

/* Mes anterior a hoy */
function mesAnterior(): MesSel {
  const hoy = new Date()
  let m = hoy.getMonth() // getMonth() = mes actual - 1 → mes anterior
  let a = hoy.getFullYear()
  if (m === 0) { m = 12; a-- }
  return { anio: a, mes: m }
}

/* ══════════════════════════════════════════════════════ */
export default function GestionFacturas() {
  const [activeTab, setActiveTab]   = useState<TabId>('facturas')
  const [titularKey, setTitularKey] = useState<'ruben' | 'emilio'>('ruben')
  const [busqueda, setBusqueda]     = useState('')
  const [categoriaId, setCategoria] = useState<string>('todas')
  const [mesSel, setMesSel]         = useState<MesSel>(mesAnterior)
  const [driveFiltro, setDriveFiltro] = useState<DriveFiltro>({})
  const [expansionMap, setExpansionMap] = useState<Record<string, boolean>>({})
  const [bannerVisible, setBannerVisible] = useState(true)

  const [sortColumn, setSortColumn] = useState<SortColumn>('fecha')
  const [sortDir, setSortDir]       = useState<SortDir>('desc')

  const [titulares, setTitulares]   = useState<Titular[]>([])
  const [categorias, setCategorias] = useState<CategoriaPyg[]>([])
  const [facturas, setFacturas]     = useState<FacturaRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [primeraFecha, setPrimeraFecha] = useState('2026-01-01')

  useEffect(() => {
    let cancel = false
    async function load() {
      const [tRes, cRes, fRes, minRes] = await Promise.all([
        supabase.from('titulares').select('id, nombre, color, carpeta_drive').order('orden'),
        supabase.from('categorias_pyg').select('id, nivel, parent_id, nombre, bloque, orden').eq('activa', true).order('orden'),
        supabase.from('facturas')
          .select('id, fecha_factura, proveedor_nombre, total, estado, titular_id, pdf_drive_url, pdf_filename, pdf_original_name, categoria_factura, nif_emisor, tipo')
          .order('fecha_factura', { ascending: false, nullsFirst: false }),
        supabase.from('facturas').select('fecha_factura').order('fecha_factura', { ascending: true }).limit(1),
      ])
      if (cancel) return
      setTitulares((tRes.data ?? []) as Titular[])
      setCategorias((cRes.data ?? []) as CategoriaPyg[])
      setFacturas(((fRes.data ?? []) as unknown as FacturaRow[]).map(f => ({
        ...f,
        total: f.total === null ? null : Number(f.total),
      })))
      if (minRes.data?.[0]?.fecha_factura) {
        setPrimeraFecha(minRes.data[0].fecha_factura)
      }
      setLoading(false)
    }
    load()
    return () => { cancel = true }
  }, [])

  const meses = useMemo(() => generarMeses(primeraFecha), [primeraFecha])

  // Plazo gestoría = día 5 del mes siguiente al seleccionado
  const plazoDate = new Date(mesSel.anio, mesSel.mes, 5) // mes es 1-based, new Date(y,m,d) usa 0-based para mes siguiente
  const hoy = new Date()
  const diasPlazo = Math.max(0, Math.ceil((plazoDate.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)))
  const plazoStr = `5 de ${MESES_NOMBRE[mesSel.mes === 12 ? 1 : mesSel.mes + 1].toLowerCase()}`

  const titularActivo = useMemo(() => {
    return titulares.find(t => {
      const n = t.nombre.toLowerCase()
      if (titularKey === 'ruben') return n.includes('rubén') || n.includes('ruben')
      return n.includes('emilio')
    }) ?? null
  }, [titulares, titularKey])

  const driveTreeFull = useMemo(() => buildDriveTree(facturas, titulares), [facturas, titulares])

  const driveTree = useMemo(() => {
    if (!titularActivo) return []
    return driveTreeFull.filter(t => t.filtro.titular_id === titularActivo.id)
  }, [driveTreeFull, titularActivo])

  useEffect(() => { setDriveFiltro({}) }, [titularKey])

  useEffect(() => {
    if (Object.keys(expansionMap).length > 0) return
    if (driveTreeFull.length === 0) return
    const init: Record<string, boolean> = {}
    const anioActual = new Date().getFullYear()
    const trimActual = trimestreEnCurso(new Date().getMonth() + 1)
    for (const t of driveTreeFull) {
      const titId = t.filtro.titular_id
      init[`t:${titId}`] = true
      init[`y:${titId}:${anioActual}`] = true
      init[`q:${titId}:${anioActual}:${trimActual}`] = true
    }
    setExpansionMap(init)
  }, [driveTreeFull, expansionMap])

  const categoriasFlat = useMemo(() => flattenCategorias(categorias), [categorias])
  const catNombre = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categorias) m.set(c.id, c.nombre)
    return m
  }, [categorias])

  function handleSort(col: SortColumn) {
    if (sortColumn === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortColumn(col); setSortDir('asc') }
  }

  const facturasFiltradas = useMemo(() => {
    return facturas.filter(f => {
      if (titularActivo && f.titular_id !== titularActivo.id) return false
      if (driveFiltro.titular_id && f.titular_id !== driveFiltro.titular_id) return false
      if (driveFiltro.anio && f.fecha_factura) {
        const d = new Date(f.fecha_factura + 'T00:00:00')
        if (d.getFullYear() !== driveFiltro.anio) return false
        if (driveFiltro.trimestre) {
          const trim = Math.ceil((d.getMonth() + 1) / 3)
          if (trim !== driveFiltro.trimestre) return false
        }
        if (driveFiltro.mes && d.getMonth() + 1 !== driveFiltro.mes) return false
      }
      if (categoriaId !== 'todas') {
        if (!f.categoria_factura) return false
        if (!f.categoria_factura.startsWith(categoriaId)) return false
      }
      if (busqueda) {
        const q = busqueda.toLowerCase()
        const hit = (f.proveedor_nombre || '').toLowerCase().includes(q)
                  || (f.nif_emisor || '').toLowerCase().includes(q)
                  || String(f.total || '').includes(q)
        if (!hit) return false
      }
      return true
    })
  }, [facturas, titularActivo, driveFiltro, categoriaId, busqueda])

  const facturasOrdenadas = useMemo(() => {
    const arr = [...facturasFiltradas]
    const dirMul = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      let va: string | number = ''
      let vb: string | number = ''
      switch (sortColumn) {
        case 'fecha':     va = a.fecha_factura ?? ''; vb = b.fecha_factura ?? ''; break
        case 'proveedor': va = (a.proveedor_nombre || '').toLowerCase(); vb = (b.proveedor_nombre || '').toLowerCase(); break
        case 'nif':       va = (a.nif_emisor || '').toLowerCase(); vb = (b.nif_emisor || '').toLowerCase(); break
        case 'importe':   va = Number(a.total || 0); vb = Number(b.total || 0); break
        case 'categoria': va = a.categoria_factura || ''; vb = b.categoria_factura || ''; break
        case 'titular': {
          const ta = titulares.find(t => t.id === a.titular_id)?.nombre || ''
          const tb = titulares.find(t => t.id === b.titular_id)?.nombre || ''
          va = ta.toLowerCase(); vb = tb.toLowerCase(); break
        }
        case 'doc':    va = a.pdf_drive_url ? 1 : 0; vb = b.pdf_drive_url ? 1 : 0; break
        case 'estado': va = a.estado || ''; vb = b.estado || ''; break
      }
      if (va < vb) return -1 * dirMul
      if (va > vb) return  1 * dirMul
      return 0
    })
    return arr
  }, [facturasFiltradas, sortColumn, sortDir, titulares])

  // Facturas del mes seleccionado para Exportar
  const facturasMesExportar = useMemo(() => {
    const desde = mesDesde(mesSel)
    const hasta  = mesHasta(mesSel)
    return facturas.filter(f => {
      if (titularActivo && f.titular_id !== titularActivo.id) return false
      if (!f.fecha_factura) return false
      return f.fecha_factura >= desde && f.fecha_factura <= hasta
    })
  }, [facturas, titularActivo, mesSel])

  const HEADERS: { label: string; col: SortColumn; align: 'left' | 'right' | 'center' }[] = [
    { label: 'Fecha',      col: 'fecha',     align: 'left' },
    { label: 'Proveedor',  col: 'proveedor', align: 'left' },
    { label: 'NIF',        col: 'nif',       align: 'left' },
    { label: 'Importe',    col: 'importe',   align: 'right' },
    { label: 'Categoría',  col: 'categoria', align: 'left' },
    { label: 'Titular',    col: 'titular',   align: 'left' },
    { label: 'Doc',        col: 'doc',       align: 'center' },
    { label: 'Estado',     col: 'estado',    align: 'left' },
  ]

  const tdStyle: CSSProperties = {
    padding: '11px 12px', fontSize: 13, fontFamily: FONT.body, color: COLORS.pri,
    borderBottom: `0.5px solid ${COLORS.brd}`, whiteSpace: 'nowrap',
  }

  const islaStyle: CSSProperties = {
    background: COLORS.card, border: `0.5px solid ${COLORS.brd}`,
    borderRadius: 8, padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 4,
  }

  return (
    <div style={{ background: COLORS.bg, padding: '24px 28px', minHeight: '100%' }}>

      {/* Banner gestoría — idéntico a BannerPendientes */}
      {bannerVisible && (
        <div style={{
          background: '#e8f442', color: '#111111',
          padding: '6px 14px', fontSize: 12, fontFamily: 'Lexend, sans-serif',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, borderRadius: 8, marginBottom: 12,
        }}>
          <span>
            Plazo gestoría <strong style={{ fontWeight: 500 }}>{mesLabel(mesSel)}</strong>: hasta el {plazoStr}
            {diasPlazo > 0 ? ` · Quedan ${diasPlazo} día${diasPlazo === 1 ? '' : 's'}` : ' · ¡Hoy es el plazo!'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setActiveTab('exportar')}
              style={{
                padding: '4px 10px', fontSize: 11, fontFamily: 'Oswald, sans-serif',
                background: '#111111', color: '#e8f442',
                border: 'none', borderRadius: 5, cursor: 'pointer',
                fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase',
              }}
            >
              GENERAR ZIP
            </button>
            <button
              onClick={() => setBannerVisible(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#111111', padding: 2, display: 'flex', alignItems: 'center' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 18, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h2 style={{
            color: COLORS.redSL, fontFamily: FONT.heading, fontSize: 22,
            fontWeight: 600, letterSpacing: '3px', margin: 0, textTransform: 'uppercase',
          }}>
            GESTOR DOCUMENTAL
          </h2>
          <span style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut, display: 'block', marginTop: 4 }}>
            {mesLabel(mesSel)}
          </span>
        </div>
        <SelectorMes meses={meses} seleccionado={mesSel} onChange={setMesSel} />
      </div>

      <TabsPastilla
        tabs={TABS}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
      />

      {activeTab === 'facturas' && (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, marginBottom: 14, flexWrap: 'wrap' }}>
            <ToggleTitular titularKey={titularKey} onChange={setTitularKey} />
            <input
              type="text"
              placeholder="Buscar proveedor, NIF, importe…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                flex: 1, minWidth: 220, height: 36, padding: '0 12px',
                borderRadius: 8, border: `0.5px solid ${COLORS.brd}`,
                background: COLORS.card, fontSize: 13, fontFamily: FONT.body,
                color: COLORS.pri, outline: 'none',
              }}
            />
            <div style={{ ...islaStyle, padding: 0, overflow: 'hidden' }}>
              <select
                value={categoriaId}
                onChange={(e) => setCategoria(e.target.value)}
                style={{ ...DROPDOWN_BTN, border: 'none', background: 'transparent', minWidth: 280, height: 36, paddingRight: 28, cursor: 'pointer' }}
              >
                <option value="todas">Todas las categorías</option>
                {categoriasFlat.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14 }}>
            {/* Drive */}
            <div style={{ background: COLORS.card, border: `0.5px solid ${COLORS.brd}`, borderRadius: 14, padding: 14, fontSize: 13, fontFamily: FONT.body, alignSelf: 'start' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottom: `0.5px solid ${COLORS.brd}` }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLORS.pri, fontWeight: 600 }}>
                  📁 Drive
                </span>
                {driveFiltro.anio && (
                  <button type="button" onClick={() => setDriveFiltro({})} style={{ fontSize: 10, padding: '3px 9px', border: 'none', background: COLORS.group, borderRadius: 4, color: COLORS.sec, cursor: 'pointer', fontFamily: FONT.body }}>
                    limpiar
                  </button>
                )}
              </div>
              {loading && <div style={{ color: COLORS.mut, fontSize: 12 }}>Cargando…</div>}
              {!loading && driveTree.map(tNode => (
                <NodoArbolItem
                  key={tNode.label}
                  node={tNode}
                  level={0}
                  filtroActivo={driveFiltro}
                  expansionMap={expansionMap}
                  titularColor={titularKey === 'ruben' ? COLOR_RUBEN : COLOR_EMILIO}
                  onSelect={setDriveFiltro}
                  onToggleExpand={(key) => setExpansionMap(m => ({ ...m, [key]: !m[key] }))}
                />
              ))}
            </div>

            {/* Tabla */}
            <div style={{ background: COLORS.card, border: `0.5px solid ${COLORS.brd}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      {HEADERS.map(h => {
                        const isActive = sortColumn === h.col
                        return (
                          <th key={h.col} onClick={() => handleSort(h.col)} style={{
                            fontFamily: FONT.heading, fontSize: 10, fontWeight: 500,
                            letterSpacing: '2px', color: isActive ? COLORS.redSL : COLORS.mut,
                            textTransform: 'uppercase', textAlign: h.align,
                            padding: '10px 12px', background: COLORS.group,
                            borderBottom: `0.5px solid ${COLORS.brd}`,
                            whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
                          }}>
                            {h.label}{isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: COLORS.mut, padding: '40px 12px' }}>Cargando…</td></tr>
                    )}
                    {!loading && facturasOrdenadas.map((f, idx) => {
                      const tit = titulares.find(t => t.id === f.titular_id)
                      const titColor = colorTitular(tit?.nombre, tit?.color || COLORS.pri)
                      const est = colorEstado(f.estado)
                      const catLbl = f.categoria_factura ? `${f.categoria_factura} ${catNombre.get(f.categoria_factura) || ''}`.trim() : '—'
                      const isLast = idx === facturasOrdenadas.length - 1
                      const tdDoc: CSSProperties = { padding: 0, borderBottom: isLast ? 'none' : `0.5px solid ${COLORS.brd}`, verticalAlign: 'middle', textAlign: 'center' }
                      return (
                        <tr key={f.id}
                          onClick={() => f.pdf_drive_url && window.open(f.pdf_drive_url, '_blank', 'noopener')}
                          style={{ cursor: f.pdf_drive_url ? 'pointer' : 'default' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.bg)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td style={tdStyle}>{fmtFechaCorta(f.fecha_factura)}</td>
                          <td style={tdStyle}>{f.proveedor_nombre || '—'}</td>
                          <td style={{ ...tdStyle, color: COLORS.mut, fontSize: 12 }}>{f.nif_emisor || '—'}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 500 }}>{fmtNum(f.total, 2)}</td>
                          <td style={tdStyle}>
                            <span style={{ background: COLORS.bg, fontSize: 11, padding: '3px 9px', borderRadius: 4, border: `0.5px solid ${COLORS.brd}`, fontFamily: FONT.body, color: COLORS.sec }}>
                              {catLbl}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, fontSize: 12 }}>
                            {tit ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: FONT.body, fontSize: 12, fontWeight: 500, background: `${titColor}15`, color: titColor }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: titColor }} />
                                {tit.nombre}
                              </span>
                            ) : <span style={{ color: COLORS.mut }}>—</span>}
                          </td>
                          {f.pdf_drive_url ? (
                            <td style={tdDoc} onClick={(e) => { e.stopPropagation(); window.open(f.pdf_drive_url!, '_blank', 'noopener,noreferrer') }} title="Ver factura">
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', minHeight: 38, fontSize: 22, lineHeight: 1, color: COLORS.pri, cursor: 'pointer', userSelect: 'none' }}>📎</div>
                            </td>
                          ) : (
                            <td style={tdDoc}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', minHeight: 38, fontSize: 18, lineHeight: 1, color: '#F26B1F', fontWeight: 600 }}>✕</div>
                            </td>
                          )}
                          <td style={tdStyle}>
                            <span style={{ background: est.bg, color: est.col, fontFamily: FONT.heading, fontSize: 9, letterSpacing: '0.5px', padding: '2px 8px', borderRadius: 9, fontWeight: 500 }}>
                              {est.lbl}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    {!loading && facturasOrdenadas.length === 0 && (
                      <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: COLORS.mut, padding: '40px 12px' }}>Sin facturas para los filtros seleccionados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'ventas' && (
        <TabVentas titularKey={titularKey} setTitularKey={setTitularKey} />
      )}

      {activeTab === 'exportar' && (
        <TabExportar
          titularKey={titularKey}
          setTitularKey={setTitularKey}
          mesSel={mesSel}
          facturasMes={facturasMesExportar}
          plazoStr={plazoStr}
          diasPlazo={diasPlazo}
        />
      )}
    </div>
  )
}

/* ── Toggle Rubén/Emilio reutilizable ─── */
function ToggleTitular({ titularKey, onChange }: { titularKey: 'ruben' | 'emilio'; onChange: (k: 'ruben' | 'emilio') => void }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {(['ruben', 'emilio'] as const).map(t => {
        const isActive = titularKey === t
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            style={{
              padding: '8px 18px', borderRadius: 8,
              border: isActive ? 'none' : `0.5px solid ${COLORS.brd}`,
              background: isActive ? (t === 'ruben' ? COLOR_RUBEN : COLOR_EMILIO) : '#fff',
              fontFamily: FONT.body, fontSize: 13,
              color: isActive ? '#fff' : '#3a4050',
              cursor: 'pointer', fontWeight: 500, minWidth: 90,
            }}
          >
            {t === 'ruben' ? 'Rubén' : 'Emilio'}
          </button>
        )
      })}
    </div>
  )
}

/* ── Tab Ventas ─── */
function TabVentas({ titularKey, setTitularKey }: { titularKey: 'ruben' | 'emilio'; setTitularKey: (k: 'ruben' | 'emilio') => void }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, marginBottom: 14 }}>
        <ToggleTitular titularKey={titularKey} onChange={setTitularKey} />
      </div>
      <div style={{ marginTop: 24, padding: 60, textAlign: 'center', background: COLORS.card, border: `0.5px solid ${COLORS.brd}`, borderRadius: 14, color: COLORS.mut, fontFamily: FONT.body, fontSize: 14 }}>
        Subida de resúmenes de ventas (Uber Eats CSV) · Próximamente
      </div>
    </>
  )
}

/* ── Tab Exportar ─── */
function TabExportar({
  titularKey, setTitularKey, mesSel, facturasMes, plazoStr, diasPlazo,
}: {
  titularKey: 'ruben' | 'emilio'
  setTitularKey: (k: 'ruben' | 'emilio') => void
  mesSel: MesSel
  facturasMes: FacturaRow[]
  plazoStr: string
  diasPlazo: number
}) {
  const [facturasConfirmadas, setFacturasConfirmadas] = useState(false)
  const ventasUberSubido = false
  const numFacturas = facturasMes.length
  const numResumenesUber = ventasUberSubido ? 1 : 0
  const todoOk = facturasConfirmadas && ventasUberSubido

  // Reset confirmación cuando cambia mes o titular
  useEffect(() => { setFacturasConfirmadas(false) }, [mesSel.anio, mesSel.mes, titularKey])

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, marginBottom: 14 }}>
        <ToggleTitular titularKey={titularKey} onChange={setTitularKey} />
      </div>

      {/* Checklist */}
      <div style={{ background: COLORS.card, border: `0.5px solid ${COLORS.brd}`, borderRadius: 14, padding: '20px 22px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <p style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', color: COLORS.mut, textTransform: 'uppercase', margin: 0 }}>
            Antes de exportar
          </p>
          <span style={{ fontSize: 12, color: todoOk ? '#3B6D11' : '#BA7517', fontWeight: 500 }}>
            {[facturasConfirmadas, ventasUberSubido].filter(Boolean).length} de 2 listos
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Check 1: manual */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: facturasConfirmadas ? '#EAF3DE' : '#FCEBEB', borderRadius: 8 }}>
            <span style={{ display: 'flex', width: 22, height: 22, borderRadius: '50%', background: facturasConfirmadas ? '#639922' : '#A32D2D', color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
              {facturasConfirmadas ? '✓' : '✕'}
            </span>
            <span style={{ flex: 1, fontSize: 13, color: facturasConfirmadas ? '#173404' : '#501313', fontWeight: 500 }}>
              Todas las facturas del mes importadas
            </span>
            {facturasConfirmadas ? (
              <span style={{ fontSize: 12, color: '#3B6D11' }}>{numFacturas} facturas</span>
            ) : (
              <button
                onClick={() => setFacturasConfirmadas(true)}
                style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#A32D2D', color: '#fff', fontSize: 12, fontFamily: FONT.body, cursor: 'pointer', fontWeight: 500 }}
              >
                Confirmar
              </button>
            )}
          </div>

          {/* Check 2: automático ventas Uber */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: ventasUberSubido ? '#EAF3DE' : '#FCEBEB', borderRadius: 8 }}>
            <span style={{ display: 'flex', width: 22, height: 22, borderRadius: '50%', background: ventasUberSubido ? '#639922' : '#A32D2D', color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
              {ventasUberSubido ? '✓' : '✕'}
            </span>
            <span style={{ flex: 1, fontSize: 13, color: ventasUberSubido ? '#173404' : '#501313', fontWeight: 500 }}>
              Ventas Uber Eats subidas
            </span>
            <span style={{ fontSize: 12, color: ventasUberSubido ? '#3B6D11' : '#A32D2D' }}>
              {ventasUberSubido ? 'Subido' : 'Pendiente'}
            </span>
          </div>
        </div>
      </div>

      {/* ZIP contendrá */}
      <div style={{ background: COLORS.card, border: `0.5px solid ${COLORS.brd}`, borderRadius: 14, padding: '20px 22px', marginBottom: 14 }}>
        <p style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', color: COLORS.mut, textTransform: 'uppercase', margin: '0 0 14px' }}>
          El ZIP contendrá
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, fontFamily: FONT.body }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>📁</span>
            <span><strong style={{ fontWeight: 500 }}>Facturas</strong> · {numFacturas} Docs</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>📁</span>
            <span><strong style={{ fontWeight: 500 }}>Ventas</strong> · {numResumenesUber} Resumen{numResumenesUber === 1 ? '' : 'es'} Uber</span>
          </div>
        </div>
      </div>

      <button
        disabled={!todoOk}
        style={{ width: '100%', padding: '14px 20px', background: todoOk ? '#111' : '#d0c8bc', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, fontFamily: FONT.body, cursor: todoOk ? 'pointer' : 'not-allowed' }}
      >
        Generar paquete ZIP · {mesLabel(mesSel)}
      </button>
    </>
  )
}

/* ── Árbol Drive ─── */
interface NodoArbolItemProps {
  node: DriveNode; level: number; filtroActivo: DriveFiltro
  expansionMap: Record<string, boolean>; titularColor: string
  onSelect: (f: DriveFiltro) => void; onToggleExpand: (k: string) => void
}

function nodeKey(filtro: DriveFiltro): string {
  if (filtro.mes) return `m:${filtro.titular_id}:${filtro.anio}:${filtro.trimestre}:${filtro.mes}`
  if (filtro.trimestre) return `q:${filtro.titular_id}:${filtro.anio}:${filtro.trimestre}`
  if (filtro.anio) return `y:${filtro.titular_id}:${filtro.anio}`
  return `t:${filtro.titular_id}`
}

function NodoArbolItem({ node, level, filtroActivo, expansionMap, titularColor, onSelect, onToggleExpand }: NodoArbolItemProps) {
  const tieneHijos = !!(node.children && node.children.length > 0)
  const myKey = nodeKey(node.filtro)
  const expandido = expansionMap[myKey] ?? false
  const sinFacturas = node.count === 0
  const esActivo = filtroActivo.titular_id === node.filtro.titular_id && filtroActivo.anio === node.filtro.anio && filtroActivo.trimestre === node.filtro.trimestre && filtroActivo.mes === node.filtro.mes

  let nodoBg = 'transparent', nodoColor = COLORS.pri, nodoFF = FONT.body
  let nodoFS = 13, nodoFW = 400, nodoBL = '3px solid transparent'

  if (node.kind === 'titular') { nodoColor = titularColor; nodoFF = FONT.heading; nodoFS = 14; nodoFW = 600; nodoBL = `3px solid ${titularColor}` }
  else if (node.kind === 'anio') { nodoBg = ANIO_BG; nodoColor = '#7a1218'; nodoFF = FONT.heading; nodoFS = 13; nodoFW = 600 }
  else if (node.kind === 'trim' && node.trimNum) { const p = TRIM_PALETTE[node.trimNum]; nodoBg = p.bg; nodoColor = p.headDark; nodoFF = FONT.heading; nodoFW = 700; nodoFS = 13 }
  else if (node.kind === 'mes' && node.trimNum) { const p = TRIM_PALETTE[node.trimNum]; nodoBg = p.bg + '60'; nodoColor = COLORS.pri; nodoFS = 13 }

  if (esActivo) {
    nodoBg = node.kind === 'trim' && node.trimNum ? TRIM_PALETTE[node.trimNum].headDark : titularColor
    nodoColor = '#fff'; nodoFW = 700
    nodoBL = `3px solid ${node.kind === 'trim' && node.trimNum ? TRIM_PALETTE[node.trimNum].headDark : titularColor}`
  }

  const rowStyle: CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center',
    padding: '6px 8px', paddingLeft: 6 + level * 12,
    background: nodoBg, border: 'none', borderLeft: nodoBL,
    borderRadius: node.kind === 'mes' ? '0 4px 4px 0' : '0 6px 6px 0',
    cursor: 'pointer', fontFamily: nodoFF, fontSize: nodoFS,
    textAlign: 'left', color: nodoColor, fontWeight: nodoFW,
    opacity: sinFacturas && !esActivo ? 0.5 : 1,
    marginBottom: node.kind === 'titular' ? 4 : 1,
    letterSpacing: node.kind === 'titular' ? '1px' : 'normal',
    textTransform: node.kind === 'titular' ? 'uppercase' : 'none',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 1 }}>
        {tieneHijos ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); onToggleExpand(myKey) }}
            style={{ width: 24, height: 28, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: COLORS.sec, fontSize: 18, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
            {expandido ? '▾' : '▸'}
          </button>
        ) : (
          <span style={{ width: 24, display: 'inline-block', textAlign: 'center', color: COLORS.mut, flexShrink: 0 }}>·</span>
        )}
        <button type="button" onClick={() => onSelect(node.filtro)} style={rowStyle}>
          <span style={{ flex: 1 }}>{node.label}</span>
          <span style={{ color: esActivo ? '#fff' : COLORS.mut, fontSize: 11, marginLeft: 8, fontWeight: 500, opacity: esActivo ? 0.9 : 1 }}>
            {node.count > 0 ? node.count : '—'}
          </span>
        </button>
      </div>
      {expandido && tieneHijos && (
        <div>
          {node.children!.map((child, idx) => (
            <NodoArbolItem key={`${child.label}-${idx}`} node={child} level={level + 1}
              filtroActivo={filtroActivo} expansionMap={expansionMap} titularColor={titularColor}
              onSelect={onSelect} onToggleExpand={onToggleExpand} />
          ))}
        </div>
      )}
    </div>
  )
}
