import { useMemo, useState, useEffect, type CSSProperties } from 'react'
import { Search, Zap } from 'lucide-react'
import { fmtEur, fmtDate } from '@/utils/format'
import { useTheme, FONT, fmtFechaCorta } from '@/styles/tokens'
import { KpiCard } from '@/components/KpiCard'
import { ResumenDashboard } from '@/components/conciliacion/ResumenDashboard'
import ImportDropzone, { type ParsedRow } from '@/components/conciliacion/ImportDropzone'
import { useAniosDisponibles } from '@/hooks/useAniosDisponibles'
import { toast } from '@/lib/toastStore'
import type { Movimiento } from '@/types/conciliacion'
import { useConciliacion } from '@/hooks/useConciliacion'
import { supabase } from '@/lib/supabase'
import TabsPastilla from '@/components/ui/TabsPastilla'
import TabMovimientos from '@/components/conciliacion/TabMovimientos'
import PanelCierre from '@/components/conciliacion/PanelCierre'
import BandejaPropuestas from '@/components/conciliacion/BandejaPropuestas'
import BandejaPendiente from '@/components/conciliacion/BandejaPendiente'
import CierreCuatroPiezas from '@/components/conciliacion/CierreCuatroPiezas'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import { normalizarConcepto, matchPatron, inicializarStopwords } from '@/lib/normalizarConcepto'
import { fechaLocalStr } from '@/utils/fechaLocal'

type PeriodoKey = 'mes' | 'mes_anterior' | 'trimestre' | '30d' | 'personalizado' | string

const ModalAddGasto = ({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) => open ? null : null

const TAB_STORAGE_KEY = 'conciliacion:tab'

function loadTab(): Tab {
  try {
    const raw = sessionStorage.getItem(TAB_STORAGE_KEY)
    if (raw === 'movimientos' || raw === 'resumen' || raw === 'cuadre') return raw
  } catch { /* swallow */ }
  return 'resumen'
}

function saveTab(t: Tab) {
  try { sessionStorage.setItem(TAB_STORAGE_KEY, t) } catch { /* swallow */ }
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

type Tab = 'resumen' | 'movimientos' | 'cuadre'
type FiltroRapido = 'pendientes' | 'asociadas' | 'faltantes' | 'duplicadas' | 'sin_titular' | null

export default function Conciliacion() {
  const { T, isDark } = useTheme()
  const [tab, setTab] = useState<Tab>(loadTab())
  const [periodo, setPeriodo] = useState<PeriodoKey>('mes')
  const [customDesde, setCustomDesde] = useState<string>('')
  const [customHasta, setCustomHasta] = useState<string>('')
  const aniosDisponibles = useAniosDisponibles()
  useEffect(() => { saveTab(tab) }, [tab])
  // Cargar stop-words desde BD al montar (C-03)
  useEffect(() => { inicializarStopwords() }, [])
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
  // IDs de movimientos propagados en la última acción, para undo (C-02)
  const [ultimaPropagacion, setUltimaPropagacion] = useState<string[] | null>(null)
  const { movimientos: movimientosBD, updateCategoria, categorias: categoriasBD, loading: loadingBD } = useConciliacion()

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

  // C-01: tipo SIEMPRE desde tipoPorCodigo, nunca del signo del importe
  const handleCategorizar = async (movId: string, catId: string, concepto: string) => {
    const normalizedCat = catId === '' ? null : catId
    const tipo: 'ingreso'|'gasto'|null = !normalizedCat ? null : (tipoPorCodigo[normalizedCat] ?? null)
    try { await updateCategoria(movId, normalizedCat, tipo) } catch (err) { console.error('Error guardando categoría:', err); return }

    if (!normalizedCat) return

    // Motor único: normalizarConcepto + matchPatron desde normalizarConcepto.ts (C-02b)
    const patron = normalizarConcepto(concepto)
    if (!patron) return

    const similares = movimientos.filter(
      m => m.id !== movId && !m.categoria_id && matchPatron(normalizarConcepto(m.concepto), patron)
    )

    if (similares.length === 0) return

    // C-02: previsualización con número de afectados antes de propagar
    const ok = window.confirm(
      `Se encontraron ${similares.length} movimiento${similares.length > 1 ? 's' : ''} sin categoría con patrón "${patron}".\n¿Categorizar también?`
    )
    if (!ok) return

    // C-01: aplicar el MISMO tipo de la categoría elegida, no el signo de cada movimiento
    const propagados: string[] = []
    for (const s of similares) {
      try {
        await updateCategoria(s.id, normalizedCat, tipo)
        propagados.push(s.id)
      } catch (err) { console.error('Error propagando categoría:', err) }
    }

    if (propagados.length > 0) {
      // C-02: guardar para undo
      setUltimaPropagacion(propagados)
    }
  }

  // C-02: deshacer la última propagación (revierte a sin categoría)
  const handleDeshacerPropagacion = async () => {
    if (!ultimaPropagacion) return
    for (const movId of ultimaPropagacion) {
      try { await updateCategoria(movId, null, null) } catch {}
    }
    setUltimaPropagacion(null)
    toast.success(`${ultimaPropagacion.length} movimiento${ultimaPropagacion.length > 1 ? 's' : ''} revertido${ultimaPropagacion.length > 1 ? 's' : ''}`)
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
          <span style={{ fontFamily:'Lexend, sans-serif', fontSize:13, color:'#7a8090', display:'block', marginTop:4 }}>{fmtFechaCorta(fechaLocalStr(periodoDesde))} — {fmtFechaCorta(fechaLocalStr(periodoHasta))}</span>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <SelectorFechaUniversal nombreModulo="conciliacion" defaultOpcion="mes_en_curso" onChange={(desde, hasta, label) => { setPeriodoDesde(desde); setPeriodoHasta(hasta); setPeriodoLabelSFU(label) }} />
        </div>
      </div>
      <TabsPastilla tabs={[{ id:'resumen', label:'Resumen' }, { id:'movimientos', label:'Movimientos' }, { id:'cuadre', label:'Cuadre' }]} activeId={tab} onChange={(id) => setTab(id as Tab)} />
      {tab === 'resumen' && <ResumenDashboard movimientos={movimientosFiltrados} movimientosAnterior={movimientosAnterior} mesNombre={mesNombre} anio={anioActual} diasRestantes={diasRestantes} />}
      {tab === 'movimientos' && <TabMovimientos periodoLabel={periodoLabelSFU} periodoDesde={periodoDesde} periodoHasta={periodoHasta} />}
      {tab === 'cuadre' && (
        <div style={{ marginTop: 16 }}>
          <PanelCierre />
          <BandejaPropuestas />
          <BandejaPendiente />
          <CierreCuatroPiezas />
        </div>
      )}
      <ModalAddGasto open={modalGastoOpen} onClose={() => setModalGastoOpen(false)} onSaved={() => { setModalGastoOpen(false) }} />
      {/* C-02: banner de deshacer propagación */}
      {ultimaPropagacion && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#1e2233', color: '#fff', borderRadius: 10, padding: '10px 18px',
          display: 'flex', alignItems: 'center', gap: 14, zIndex: 200,
          fontFamily: 'Lexend, sans-serif', fontSize: 13,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
          <span>{ultimaPropagacion.length} movimiento{ultimaPropagacion.length > 1 ? 's' : ''} categorizados</span>
          <button onClick={handleDeshacerPropagacion} style={{
            background: '#e8f442', color: '#1e2233', border: 'none', borderRadius: 6,
            padding: '5px 12px', fontFamily: 'Oswald, sans-serif', fontSize: 11,
            letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600,
          }}>Deshacer</button>
          <button onClick={() => setUltimaPropagacion(null)} style={{
            background: 'transparent', color: '#aaa', border: 'none', fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1,
          }}>×</button>
        </div>
      )}
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
