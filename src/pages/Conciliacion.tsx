import { useMemo, useState, useEffect, type CSSProperties } from 'react'
import { Search, Zap } from 'lucide-react'
import { fmtEur, fmtDate } from '@/utils/format'
import { useTheme, FONT, fmtFechaCorta } from '@/styles/tokens'
import { KpiCard } from '@/components/KpiCard'
import { ResumenDashboard } from '@/components/conciliacion/ResumenDashboard'
import ImportDropzone, { type ParsedRow } from '@/components/conciliacion/ImportDropzone'
import { useAniosDisponibles } from '@/hooks/useAniosDisponibles'
import { toast } from '@/lib/toastStore'
import type { Movimiento, Regla } from '@/types/conciliacion'
import { useConciliacion } from '@/hooks/useConciliacion'
import { supabase } from '@/lib/supabase'
import TabsPastilla from '@/components/ui/TabsPastilla'
import TabMovimientos from '@/components/conciliacion/TabMovimientos'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'

type PeriodoKey = 'mes' | 'mes_anterior' | 'trimestre' | '30d' | 'personalizado' | string

const ModalAddGasto = ({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) => open ? null : null

const STOP_WORDS = new Set(['liquidacion','pedido','nomina','del','de','la','el','por','para','con','sin','abril','marzo','febrero','enero','semana'])

const TAB_STORAGE_KEY = 'conciliacion:tab'

function loadTab(): Tab {
  try {
    const raw = sessionStorage.getItem(TAB_STORAGE_KEY)
    if (raw === 'movimientos' || raw === 'resumen') return raw
  } catch { /* swallow */ }
  return 'resumen'
}

function saveTab(t: Tab) {
  try { sessionStorage.setItem(TAB_STORAGE_KEY, t) } catch { /* swallow */ }
}

function extraerPatron(concepto: string): string {
  const w = concepto.toLowerCase().split(/\s+/).find(x => x.length > 3 && !STOP_WORDS.has(x))
  return w ?? concepto.slice(0, 10).toLowerCase()
}

function matchPatron(concepto: string, patron: string): boolean {
  if (!patron) return false
  const c = concepto.toLowerCase()
  const p = patron.toLowerCase()
  if (!p.includes('*') && !p.includes('?')) return c.includes(p)
  const esc = p.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const rx = new RegExp('^' + esc.replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
  return rx.test(c)
}

function colorContraparte(nombre: string): string | null {
  const n = nombre.toLowerCase().trim()
  if (n.includes('uber')) return '#06C167'
  if (n.includes('glovo')) return '#e8f442'
  if (n.includes('just eat') || n === 'just eat' || n.includes('justeat')) return '#f5a623'
  if (n.includes('rushour') || n.includes('web') || n.includes('tienda')) return '#B01D23'
  return null
}

function calcularLabelPeriodo(periodo: string, customDesde?: string, customHasta?: string): string {
  const now = new Date()
  const mes = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  if (periodo === 'mes') return mes.toUpperCase()
  if (periodo === 'mes_anterior') {
    const ma = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return ma.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()
  }
  if (periodo === 'trimestre') return 'ÚLTIMOS 3 MESES'
  if (periodo.startsWith('anio_')) return `AÑO ${periodo.slice(5)}`
  if (periodo === 'personalizado' && customDesde && customHasta) {
    return `${customDesde} — ${customHasta}`
  }
  return 'ÚLTIMOS 31 DÍAS'
}

type Tab = 'resumen' | 'movimientos'
type FiltroRapido = 'pendientes' | 'asociadas' | 'faltantes' | 'duplicadas' | 'sin_titular' | null

export default function Conciliacion() {
  const { T, isDark } = useTheme()
  const [tab, setTab] = useState<Tab>(loadTab())
  const [periodo, setPeriodo] = useState<PeriodoKey>('mes')
  const [customDesde, setCustomDesde] = useState<string>('')
  const [customHasta, setCustomHasta] = useState<string>('')
  const aniosDisponibles = useAniosDisponibles()
  useEffect(() => { saveTab(tab) }, [tab])
  const [periodoDesde, setPeriodoDesde] = useState<Date>(() => { const h = new Date(); h.setDate(1); h.setHours(0,0,0,0); return h })
  const [periodoHasta, setPeriodoHasta] = useState<Date>(() => { const h = new Date(); h.setHours(23,59,59,999); return h })
  const [periodoLabelSFU, setPeriodoLabelSFU] = useState('Mes en curso')
  const [catFiltro, setCatFiltro] = useState<string>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [filtroCard, setFiltroCard] = useState<'pendientes'|'ingreso'|'gasto'|null>(null)
  const toggleFiltroCard = (k: 'pendientes'|'ingreso'|'gasto') => { setFiltroCard(prev => prev === k ? null : k) }
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>(null)
  const [modalGastoOpen, setModalGastoOpen] = useState(false)
  const toggleFiltroRapido = (k: NonNullable<FiltroRapido>) => { setFiltroRapido(prev => prev === k ? null : k) }
  const [importResult, setImportResult] = useState<{insertados:number;duplicados:number;omitidos:number}|null>(null)
  const [reglas, setReglas] = useState<Regla[]>([])
  const { movimientos: movimientosBD, insertMovimientos, updateCategoria, categorias: categoriasBD, loading: loadingBD } = useConciliacion()

  const dropdownGroups = useMemo(() => {
    const ingresos = categoriasBD.filter(c => c.tipo_parent === 'ingreso')
    const gastos = categoriasBD.filter(c => c.tipo_parent === 'gasto')
    const porGrupo: Record<string, typeof gastos> = {}
    for (const c of gastos) { const k = c.grupo ?? 'OTROS'; (porGrupo[k] = porGrupo[k] || []).push(c) }
    const gruposOrdenados = Object.keys(porGrupo).sort()
    return { ingresos, gastosPorGrupo: gruposOrdenados.map(g => ({ grupo: g, items: porGrupo[g] })) }
  }, [categoriasBD])

  const tipoPorCodigo = useMemo(() => {
    const m: Record<string, 'ingreso'|'gasto'> = {}
    categoriasBD.forEach(c => { m[c.codigo] = c.tipo_parent })
    return m
  }, [categoriasBD])

  const movimientos = useMemo<Movimiento[]>(
    () => movimientosBD.map(m => ({
      id: m.id, fecha: m.fecha, concepto: m.concepto, importe: Number(m.importe),
      categoria_id: m.categoria, contraparte: m.proveedor ?? '',
      gasto_id: m.gasto_id ?? null, factura_id: m.factura_id ?? null,
      factura_data: m.factura_data ?? null, titular_id: m.titular_id ?? null,
      doc_estado: ((m as unknown as { doc_estado?: 'tiene'|'falta'|'no_requiere'|null }).doc_estado) ?? 'falta',
    })), [movimientosBD]
  )

  const handleCategorizar = async (movId: string, catId: string, concepto: string) => {
    const normalizedCat = catId === '' ? null : catId
    const mov = movimientos.find(m => m.id === movId)
    const tipo: 'ingreso'|'gasto'|null = !normalizedCat ? null : (tipoPorCodigo[normalizedCat] ?? (mov && mov.importe >= 0 ? 'ingreso' : 'gasto'))
    try { await updateCategoria(movId, normalizedCat, tipo) } catch (err) { console.error('Error guardando categoría:', err); return }
    if (normalizedCat) {
      const patron = extraerPatron(concepto)
      const similares = movimientos.filter(m => m.id !== movId && !m.categoria_id && matchPatron(m.concepto, patron))
      for (const s of similares) {
        const sTipo: 'ingreso'|'gasto' = s.importe >= 0 ? 'ingreso' : 'gasto'
        try { await updateCategoria(s.id, normalizedCat, sTipo) } catch (err) { console.error('Error auto-categorizando:', err) }
      }
      setReglas(prev => [...prev, { patron, categoria_id: normalizedCat }])
    }
  }

  const { rangoActual, rangoAnterior, rangoFechasLegible } = useMemo(() => {
    const hoy = new Date(); hoy.setHours(23,59,59,999)
    let inicio: Date; let fin: Date = new Date(hoy)
    if (periodo === 'mes') { inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1) }
    else if (periodo === 'mes_anterior') { inicio = new Date(hoy.getFullYear(), hoy.getMonth()-1, 1); fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59) }
    else if (periodo === 'trimestre') { inicio = new Date(hoy); inicio.setDate(inicio.getDate() - 89) }
    else if (periodo.startsWith('anio_')) { const year = Number(periodo.slice(5)); inicio = new Date(year,0,1); fin = new Date(year,11,31,23,59,59) }
    else if (periodo === 'personalizado' && customDesde && customHasta) { inicio = new Date(customDesde+'T00:00:00'); fin = new Date(customHasta+'T23:59:59') }
    else { inicio = new Date(hoy); inicio.setDate(inicio.getDate() - 30) }
    inicio.setHours(0,0,0,0)
    const duracionMs = fin.getTime() - inicio.getTime()
    const finAnt = new Date(inicio.getTime() - 24*60*60*1000); finAnt.setHours(23,59,59,999)
    const inicioAnt = new Date(finAnt.getTime() - duracionMs); inicioAnt.setHours(0,0,0,0)
    const fmt = (d: Date) => d.toLocaleDateString('es-ES', { day:'numeric', month:'short' })
    return { rangoActual: { inicio, fin }, rangoAnterior: { inicio: inicioAnt, fin: finAnt }, rangoFechasLegible: `${fmt(inicio)} — ${fmt(fin)} ${fin.getFullYear()}` }
  }, [periodo, customDesde, customHasta])

  const dedupKeys = useMemo(() => {
    const seen = new Map<string, number>()
    for (const m of movimientos) { const key = `${m.importe}|${m.fecha}|${m.concepto}`; seen.set(key, (seen.get(key) ?? 0) + 1) }
    return seen
  }, [movimientos])

  const movimientosFiltrados = useMemo(() => {
    return movimientos
      .filter(m => { const f = new Date(m.fecha+'T12:00:00'); return f >= rangoActual.inicio && f <= rangoActual.fin })
      .filter(m => catFiltro === 'todas' || m.categoria_id === catFiltro)
      .filter(m => { if (!busqueda) return true; const q = busqueda.toLowerCase(); return m.concepto.toLowerCase().includes(q) || (m.contraparte && m.contraparte.toLowerCase().includes(q)) || (m.factura_id && m.factura_id.toLowerCase().includes(q)) || String(Math.abs(m.importe)).includes(q) })
      .filter(m => { if (filtroCard === 'pendientes') return !m.categoria_id; if (filtroCard === 'ingreso') return m.importe > 0; if (filtroCard === 'gasto') return m.importe < 0; return true })
      .filter(m => { if (!filtroRapido) return true; if (filtroRapido === 'pendientes') return !m.categoria_id; if (filtroRapido === 'asociadas') return !!m.factura_id; if (filtroRapido === 'faltantes') return !!m.categoria_id && !m.factura_id && m.importe < 0; if (filtroRapido === 'duplicadas') { const key = `${m.importe}|${m.fecha}|${m.concepto}`; return (dedupKeys.get(key) ?? 0) > 1 }; if (filtroRapido === 'sin_titular') return !m.titular_id; return true })
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [movimientos, catFiltro, busqueda, rangoActual, filtroCard, filtroRapido, dedupKeys])

  const movimientosAnterior = useMemo(() => {
    return movimientos.filter(m => { const f = new Date(m.fecha+'T12:00:00'); return f >= rangoAnterior.inicio && f <= rangoAnterior.fin })
  }, [movimientos, rangoAnterior])

  const datos = useMemo(() => {
    const ingresos = movimientosFiltrados.filter(m => m.importe > 0)
    const gastos = movimientosFiltrados.filter(m => m.importe < 0)
    const sumIng = ingresos.reduce((s, m) => s + m.importe, 0)
    const sumGst = Math.abs(gastos.reduce((s, m) => s + m.importe, 0))
    return { ingresos, gastos, sumIng, sumGst, balance: sumIng - sumGst, pendientes: movimientosFiltrados.filter(m => !m.categoria_id).length }
  }, [movimientosFiltrados])

  const periodoLabel = calcularLabelPeriodo(periodo, customDesde, customHasta)
  const hoyDate = new Date()
  const mesNombreRaw = hoyDate.toLocaleDateString('es-ES', { month: 'long' })
  const mesNombre = mesNombreRaw.charAt(0).toUpperCase() + mesNombreRaw.slice(1)
  const anioActual = hoyDate.getFullYear()
  const ultimoDiaMes = new Date(anioActual, hoyDate.getMonth() + 1, 0).getDate()
  const diasRestantes = Math.max(0, ultimoDiaMes - hoyDate.getDate())

  return (
    <div style={{ background: '#f5f3ef', padding: '24px 28px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:18, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ color:'#B01D23', fontFamily:'Oswald, sans-serif', fontSize:22, fontWeight:600, letterSpacing:'3px', margin:0, textTransform:'uppercase' }}>CONCILIACIÓN</h2>
          <span style={{ fontFamily:'Lexend, sans-serif', fontSize:13, color:'#7a8090', display:'block', marginTop:4 }}>{fmtFechaCorta(periodoDesde.toISOString().slice(0,10))} — {fmtFechaCorta(periodoHasta.toISOString().slice(0,10))}</span>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <SelectorFechaUniversal nombreModulo="conciliacion" defaultOpcion="mes_en_curso" onChange={(desde, hasta, label) => { setPeriodoDesde(desde); setPeriodoHasta(hasta); setPeriodoLabelSFU(label) }} />
        </div>
      </div>
      <TabsPastilla tabs={[{ id:'resumen', label:'Resumen' }, { id:'movimientos', label:'Movimientos' }]} activeId={tab} onChange={(id) => setTab(id as Tab)} />
      {tab === 'resumen' && <ResumenDashboard movimientos={movimientosFiltrados} movimientosAnterior={movimientosAnterior} mesNombre={mesNombre} anio={anioActual} diasRestantes={diasRestantes} />}
      {tab === 'movimientos' && <TabMovimientos periodoLabel={periodoLabelSFU} periodoDesde={periodoDesde} periodoHasta={periodoHasta} />}
      <ModalAddGasto open={modalGastoOpen} onClose={() => setModalGastoOpen(false)} onSaved={() => { setModalGastoOpen(false) }} />
    </div>
  )
}

interface KpiClickableProps { activo: boolean; onClick: () => void; T: ReturnType<typeof useTheme>['T']; children: React.ReactNode }
function KpiClickable({ activo, onClick, T, children }: KpiClickableProps) {
  return (
    <div onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      style={{ position:'relative', cursor:'pointer', borderRadius:10, outline: activo ? '2px solid #B01D23' : 'none', outlineOffset:-1, transition:'transform 120ms, opacity 120ms', opacity: activo ? 1 : 0.97 }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}>
      {children}
      {activo && <span style={{ position:'absolute', top:8, right:8, background:'#B01D23', color:'#fff', fontFamily:'Oswald, sans-serif', fontSize:9, letterSpacing:0.6, textTransform:'uppercase', fontWeight:600, padding:'2px 7px', borderRadius:4, pointerEvents:'none' }}>✓ Filtrando</span>}
      <span style={{ position:'absolute', bottom:6, right:10, fontSize:10, color:T.mut, fontFamily:'Lexend, sans-serif', opacity: activo ? 0 : 0.6, pointerEvents:'none' }}>Click para filtrar</span>
    </div>
  )
}
