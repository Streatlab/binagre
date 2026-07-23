import { AZUL_CL, BLANCO, GRANATE, INK, LIMA, ROJO, VERDE } from '@/styles/neobrutal'
/**
 * CocinaInventario — Gestión de inventario de cocina
 * 3 tabs: Conteo físico · Producción semanal · Entradas de materia prima
 * KPIs: valor stock, ingredientes bajo mínimo, consumo período
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'
import { fmtNum, fmtEur, fmtDate } from '@/utils/format'
import { useIsMobile } from '@/hooks/useIsMobile'
import TabHojaInventario from './TabHojaInventario'
import RutaPantalla from '@/components/ui/RutaPantalla'
import TabsPastilla from '@/components/ui/TabsPastilla'

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface Ingrediente {
  id: string
  nombre: string
  unidad: string | null
  ud_std: string | null
  categoria: string | null
  precio_activo: number | null
  stock_actual: number
  stock_minimo: number
  activo: boolean
}

interface Conteo {
  id: string
  fecha: string
  ingrediente_id: string
  stock_inicial: number
  entradas: number
  stock_final: number
  consumo: number
  periodicidad: string
  nota: string | null
  ingrediente: { nombre: string; unidad: string | null } | null
}

interface Partida {
  id: string
  nombre: string
  seccion_id: string
  orden: number
  activa: boolean
  biberon?: boolean
}

interface Seccion {
  id: string
  nombre: string
  orden: number
}

interface EntradaProduccion {
  id: string
  partida_id: string
  semana_iso: string
  dia: string
  hoy: string
  ssp: string
}

// ── Estilos base ───────────────────────────────────────────────────────────────

const NEO_INK = 'var(--neo-ink)'
const NEO_SHADOW = '4px 4px 0 var(--neo-shadow-color)'
const NEO_CARD: React.CSSProperties = { border: `3px solid ${NEO_INK}`, borderRadius: 0, boxShadow: NEO_SHADOW }

const S: Record<string, React.CSSProperties> = {
  page:  { padding: '24px 28px', minHeight: '100vh', backgroundColor: 'var(--neo-bg)', fontFamily: FONT.body, color: 'var(--sl-text-primary)' },
  title: { fontFamily: FONT.heading, fontSize: 'clamp(18px, 5vw, 22px)', fontWeight: 700, color: GRANATE, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 } as React.CSSProperties,
  sub:   { fontFamily: FONT.body, fontSize: 13, color: 'var(--sl-text-muted)', marginBottom: 20 },
  card:  { backgroundColor: 'var(--sl-card)', ...NEO_CARD, padding: '14px 18px' },
  th:    { fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: 'var(--sl-text-muted)', padding: '8px 12px', textAlign: 'left' as const, backgroundColor: 'var(--sl-thead)', borderBottom: '2px solid var(--neo-ink)', whiteSpace: 'nowrap' as const },
  td:    { padding: '8px 12px', fontSize: 13, color: 'var(--sl-text-primary)', borderBottom: '0.5px solid var(--sl-border)', fontFamily: FONT.body, verticalAlign: 'middle' as const },
  inp:   { padding: '6px 10px', borderRadius: 0, border: '2px solid var(--sl-border)', backgroundColor: 'var(--sl-input-edit)', color: 'var(--sl-text-primary)', fontSize: 13, fontFamily: FONT.body, outline: 'none' },
  calc:  { backgroundColor: GRANATE + '18', border: `1px solid ${GRANATE}`, color: GRANATE, padding: '4px 10px', borderRadius: 0, fontSize: 13, fontFamily: FONT.body, display: 'inline-block', textAlign: 'right' as const, minWidth: 70 },
}

function activeBtn(active: boolean): React.CSSProperties {
  return {
    padding: '7px 14px', borderRadius: 0,
    border: `2px solid ${NEO_INK}`,
    backgroundColor: active ? LIMA : 'var(--sl-card)',
    color: active ? INK : 'var(--sl-text-secondary)',
    boxShadow: active ? '3px 3px 0 var(--neo-shadow-color)' : 'none',
    fontFamily: FONT.heading, fontSize: 11, fontWeight: 700,
    letterSpacing: '0.5px', textTransform: 'uppercase' as const, cursor: 'pointer',
  }
}

// ── Componente principal ───────────────────────────────────────────────────────

type Tab = 'conteo' | 'hoja' | 'produccion' | 'entradas'

const TABS: { id: Tab; label: string }[] = [
  { id: 'conteo',     label: 'Conteo físico' },
  { id: 'hoja',       label: 'Hoja de Inventario' },
  { id: 'produccion', label: 'Producción' },
  { id: 'entradas',   label: 'Entradas MP' },
]

export default function CocinaInventario() {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<Tab>('conteo')

  const hoy = new Date().toISOString().split('T')[0]
  const primeroDeMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const [desde, setDesde] = useState(primeroDeMes)
  const [hasta, setHasta] = useState(hoy)

  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [conteos, setConteos] = useState<Conteo[]>([])
  const [loading, setLoading] = useState(true)

  const cargarBase = useCallback(async () => {
    setLoading(true)
    const [{ data: ings }, { data: cnt }] = await Promise.all([
      supabase.from('ingredientes')
        .select('id,nombre,unidad,ud_std,categoria,precio_activo,stock_actual,stock_minimo,activo')
        .eq('activo', true)
        .order('categoria', { nullsFirst: false })
        .order('nombre'),
      supabase.from('conteos_inventario')
        .select('*, ingrediente:ingredientes(nombre,unidad)')
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('fecha', { ascending: false }),
    ])
    setIngredientes((ings as Ingrediente[]) ?? [])
    setConteos((cnt as unknown as Conteo[]) ?? [])
    setLoading(false)
  }, [desde, hasta])

  useEffect(() => { cargarBase() }, [cargarBase])

  const kpis = useMemo(() => {
    const valorStock = ingredientes.reduce((s, i) => s + (i.stock_actual || 0) * (i.precio_activo || 0), 0)
    const bajominimo = ingredientes.filter(i => i.stock_minimo > 0 && i.stock_actual < i.stock_minimo).length
    const consumoTotal = conteos.reduce((s, c) => s + Math.max(0, Number(c.consumo || 0)), 0)
    return { valorStock, bajominimo, consumoTotal }
  }, [ingredientes, conteos])

  return (
    <div style={{ ...S.page, padding: isMobile ? '14px 12px' : '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <RutaPantalla niveles={['Inventario Cocina', TABS.find(t => t.id === tab)?.label ?? '']} subtitulo="Control de stock · producción semanal · entradas de materia prima" />
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, marginBottom: 20 }}>
        <KpiCard label="Valor stock aprox." value={fmtEur(kpis.valorStock)} color={LIMA} />
        <KpiCard label="Bajo mínimo" value={String(kpis.bajominimo)} color={kpis.bajominimo > 0 ? GRANATE : VERDE} suffix=" ing." />
        <KpiCard label="Consumo período" value={fmtNum(kpis.consumoTotal)} color="var(--sl-text-secondary)" suffix=" uds" />
        <KpiCard label="Ingredientes activos" value={String(ingredientes.length)} color={AZUL_CL} />
      </div>

      {/* Período */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: FONT.heading, fontSize: 11, color: 'var(--sl-text-muted)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Período:</span>
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ ...S.inp, width: 140 }} />
        <span style={{ color: 'var(--sl-text-muted)' }}>—</span>
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ ...S.inp, width: 140 }} />
        <button onClick={() => { setDesde(primeroDeMes); setHasta(hoy) }} style={{ ...S.inp, cursor: 'pointer', color: 'var(--sl-text-secondary)', fontSize: 12 }}>
          Este mes
        </button>
      </div>

      <TabsPastilla tabs={TABS} activeId={tab} onChange={id => setTab(id as Tab)} />

      <div style={{ height: 16 }} />

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--sl-text-muted)' }}>Cargando datos…</div>
      ) : (
        <>
          {tab === 'conteo'     && <TabConteo ingredientes={ingredientes} conteos={conteos} onRefresh={cargarBase} />}
          {tab === 'hoja'       && <TabHojaInventario />}
          {tab === 'produccion' && <TabProduccion desde={desde} hasta={hasta} />}
          {tab === 'entradas'   && <TabEntradas desde={desde} hasta={hasta} ingredientes={ingredientes} onRefresh={cargarBase} />}
        </>
      )}
    </div>
  )
}

// ── KPI Card ───────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, suffix = '' }: { label: string; value: string; color: string; suffix?: string }) {
  return (
    <div style={S.card}>
      <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: 'var(--sl-text-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: FONT.heading, fontSize: 'clamp(20px, 6vw, 26px)', fontWeight: 700, color }}>
        {value}<span style={{ fontSize: 13, color: 'var(--sl-text-muted)' }}>{suffix}</span>
      </div>
    </div>
  )
}

// ── TAB CONTEO ─────────────────────────────────────────────────────────────────

function TabConteo({ ingredientes, conteos, onRefresh }: { ingredientes: Ingrediente[]; conteos: Conteo[]; onRefresh: () => void }) {
  const [editMap, setEditMap] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [fechaNueva, setFechaNueva] = useState(() => new Date().toISOString().split('T')[0])
  const [periodicidad, setPeriodicidad] = useState<'semanal' | 'mensual'>('mensual')
  const [busqueda, setBusqueda] = useState('')

  const ultimoPorIng = useMemo(() => {
    const map: Record<string, Conteo> = {}
    for (const c of [...conteos].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      map[c.ingrediente_id] = c
    }
    return map
  }, [conteos])

  const ingsFiltrados = useMemo(() => {
    if (!busqueda) return ingredientes
    return ingredientes.filter(i => i.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  }, [ingredientes, busqueda])

  const fechasConteo = useMemo(() => {
    const s = new Set(conteos.map(c => c.fecha))
    return [...s].sort((a, b) => b.localeCompare(a))
  }, [conteos])

  const [fechaSel, setFechaSel] = useState<string | null>(null)
  const fechaActiva = fechaSel ?? fechasConteo[0] ?? null

  const conteosFecha = useMemo(() => {
    if (!fechaActiva) return []
    return conteos.filter(c => c.fecha === fechaActiva)
  }, [conteos, fechaActiva])

  async function guardarStockFinal(conteoId: string, valor: string) {
    const num = parseFloat(valor.replace(',', '.'))
    if (isNaN(num)) return
    await supabase.from('conteos_inventario').update({ stock_final: num }).eq('id', conteoId)
    await onRefresh()
  }

  async function crearConteo() {
    setSaving(true)
    const rows = await Promise.all(
      ingredientes.map(async ing => {
        const { data: ultimo } = await supabase
          .from('conteos_inventario')
          .select('stock_final')
          .eq('ingrediente_id', ing.id)
          .order('fecha', { ascending: false })
          .limit(1)
          .maybeSingle()
        return {
          fecha: fechaNueva,
          ingrediente_id: ing.id,
          stock_inicial: ultimo?.stock_final ?? 0,
          entradas: 0,
          stock_final: ultimo?.stock_final ?? 0,
          consumo: 0,
          periodicidad,
        }
      })
    )
    await supabase.from('conteos_inventario').insert(rows)
    setSaving(false)
    setShowModal(false)
    await onRefresh()
  }

  return (
    <div>
      {/* Selector de conteo existente + botón crear */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {fechasConteo.length === 0 && <span style={{ color: 'var(--sl-text-muted)', fontSize: 13 }}>Sin conteos en el período</span>}
          {fechasConteo.slice(0, 6).map(f => (
            <button key={f} onClick={() => setFechaSel(f)} style={activeBtn(f === fechaActiva)}>{fmtDate(f)}</button>
          ))}
        </div>
        <button onClick={() => setShowModal(true)} style={{ padding: '10px 18px', minHeight: 44, borderRadius: 0, border: `3px solid ${NEO_INK}`, boxShadow: NEO_SHADOW, backgroundColor: LIMA, color: INK, fontFamily: FONT.heading, fontSize: 13, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' as const, cursor: 'pointer' }}>
          + Nuevo conteo
        </button>
      </div>

      {/* Tabla estado stock */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: 'var(--sl-text-muted)', marginBottom: 8 }}>
          Stock actual vs mínimo — {ingredientes.length} ingredientes
        </div>
        <input
          type="text" placeholder="Filtrar ingredientes…" value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ ...S.inp, marginBottom: 10, width: 240 }}
        />
        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr>
                <th style={S.th}>Ingrediente</th>
                <th style={S.th}>Cat.</th>
                <th style={{ ...S.th, textAlign: 'right' as const }}>Stock actual</th>
                <th style={{ ...S.th, textAlign: 'right' as const }}>Mínimo</th>
                <th style={{ ...S.th, textAlign: 'right' as const }}>Diferencia</th>
                <th style={{ ...S.th, textAlign: 'right' as const }}>Último conteo</th>
              </tr>
            </thead>
            <tbody>
              {ingsFiltrados.map(ing => {
                const diff = ing.stock_actual - ing.stock_minimo
                const bajo = ing.stock_minimo > 0 && diff < 0
                const ultimo = ultimoPorIng[ing.id]
                return (
                  <tr key={ing.id} style={{ backgroundColor: bajo ? '#B01D2314' : 'transparent' }}>
                    <td style={S.td}>
                      <span style={{ fontWeight: 600 }}>{ing.nombre}</span>
                      {bajo && <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 5px', borderRadius: 0, backgroundColor: GRANATE, color: BLANCO, fontFamily: FONT.heading, letterSpacing: '0.5px', textTransform: 'uppercase' as const }}>bajo mín.</span>}
                    </td>
                    <td style={{ ...S.td, color: 'var(--sl-text-muted)', fontSize: 12 }}>{ing.categoria ?? '—'}</td>
                    <td style={{ ...S.td, textAlign: 'right' as const }}>{fmtNum(ing.stock_actual)} <span style={{ color: 'var(--sl-text-muted)', fontSize: 11 }}>{ing.ud_std ?? ing.unidad ?? ''}</span></td>
                    <td style={{ ...S.td, textAlign: 'right' as const, color: 'var(--sl-text-muted)' }}>{ing.stock_minimo > 0 ? fmtNum(ing.stock_minimo) : '—'}</td>
                    <td style={{ ...S.td, textAlign: 'right' as const }}>
                      {ing.stock_minimo > 0
                        ? <span style={{ color: bajo ? ROJO : VERDE, fontWeight: 600 }}>{diff > 0 ? '+' : ''}{fmtNum(diff)}</span>
                        : <span style={{ color: 'var(--sl-text-muted)' }}>—</span>}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right' as const, color: 'var(--sl-text-muted)', fontSize: 12 }}>{ultimo ? fmtDate(ultimo.fecha) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Tabla conteo seleccionado */}
      {fechaActiva && conteosFecha.length > 0 && (
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: 'var(--sl-text-muted)', marginBottom: 10 }}>
            Conteo {fmtDate(fechaActiva)} — {conteosFecha.length} ingredientes
          </div>
          <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={S.th}>Ingrediente</th>
                  <th style={{ ...S.th, textAlign: 'right' as const }}>Stock anterior</th>
                  <th style={{ ...S.th, textAlign: 'right' as const }}>Entradas</th>
                  <th style={{ ...S.th, textAlign: 'right' as const }}>Conteo actual</th>
                  <th style={{ ...S.th, textAlign: 'right' as const }}>Consumo</th>
                  <th style={S.th}>Nota</th>
                </tr>
              </thead>
              <tbody>
                {conteosFecha.map(c => {
                  const ing = Array.isArray(c.ingrediente) ? (c.ingrediente[0] ?? null) : c.ingrediente
                  return (
                    <tr key={c.id}>
                      <td style={S.td}>
                        <span style={{ fontWeight: 600 }}>{ing?.nombre ?? c.ingrediente_id}</span>
                        {ing?.unidad && <span style={{ color: 'var(--sl-text-muted)', fontSize: 11, marginLeft: 4 }}>({ing.unidad})</span>}
                      </td>
                      <td style={{ ...S.td, textAlign: 'right' as const, color: 'var(--sl-text-secondary)' }}>{fmtNum(c.stock_inicial)}</td>
                      <td style={{ ...S.td, textAlign: 'right' as const, color: VERDE }}>{fmtNum(c.entradas)}</td>
                      <td style={{ ...S.td, textAlign: 'right' as const }}>
                        <input
                          type="number" step="0.001"
                          value={editMap[c.id] ?? String(c.stock_final ?? '')}
                          onChange={e => setEditMap(p => ({ ...p, [c.id]: e.target.value }))}
                          onBlur={() => guardarStockFinal(c.id, editMap[c.id] ?? String(c.stock_final ?? ''))}
                          style={{ ...S.inp, width: 90, textAlign: 'right' as const }}
                        />
                      </td>
                      <td style={{ ...S.td, textAlign: 'right' as const }}>
                        <div style={S.calc}>{fmtNum(c.consumo)}</div>
                      </td>
                      <td style={{ ...S.td, color: 'var(--sl-text-muted)', fontSize: 12 }}>{c.nota ?? ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo conteo */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--sl-overlay)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }} onClick={() => !saving && setShowModal(false)}>
          <div style={{ backgroundColor: 'var(--sl-modal-bg)', ...NEO_CARD, padding: '28px 32px', width: '90%', maxWidth: 380, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: FONT.heading, fontSize: 17, letterSpacing: '2px', textTransform: 'uppercase' as const, color: GRANATE, marginBottom: 20 }}>Nuevo conteo</div>
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--sl-text-muted)', fontFamily: FONT.heading, letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: 6 }}>Periodicidad</span>
              <select value={periodicidad} onChange={e => setPeriodicidad(e.target.value as 'semanal' | 'mensual')} style={{ ...S.inp, width: '100%' }}>
                <option value="mensual">Mensual</option>
                <option value="semanal">Semanal</option>
              </select>
            </label>
            <label style={{ display: 'block', marginBottom: 20 }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--sl-text-muted)', fontFamily: FONT.heading, letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: 6 }}>Fecha</span>
              <input type="date" value={fechaNueva} onChange={e => setFechaNueva(e.target.value)} style={{ ...S.inp, width: '100%' }} />
            </label>
            <p style={{ fontSize: 12, color: 'var(--sl-text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
              Se creará una fila por cada ingrediente activo. El stock inicial se tomará del último conteo de cada ingrediente.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} disabled={saving} style={{ padding: '10px 18px', minHeight: 44, borderRadius: 0, border: `2px solid ${NEO_INK}`, backgroundColor: 'var(--sl-btn-cancel-bg)', color: 'var(--sl-btn-cancel-text)', fontSize: 13, fontFamily: FONT.heading, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' as const, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={crearConteo} disabled={saving} style={{ padding: '10px 18px', minHeight: 44, borderRadius: 0, border: `2px solid ${NEO_INK}`, boxShadow: NEO_SHADOW, backgroundColor: GRANATE, color: BLANCO, opacity: saving ? 0.6 : 1, fontSize: 13, fontFamily: FONT.heading, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' as const, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Creando…' : 'Crear conteo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── TAB PRODUCCIÓN ─────────────────────────────────────────────────────────────

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const
type Dia = typeof DIAS[number]
const DIAS_LABEL: Record<Dia, string> = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue',
  viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
}

function getSemanaISO(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function getSemanaLabel(iso: string): string {
  const [year, week] = iso.split('-W').map(Number)
  const jan4 = new Date(year, 0, 4)
  const startOfWeek = new Date(jan4.getTime() - (((jan4.getDay() || 7) - 1) * 86400000) + ((week - 1) * 7 * 86400000))
  const endOfWeek = new Date(startOfWeek.getTime() + 6 * 86400000)
  const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`
  return `Sem ${week} · ${fmt(startOfWeek)}–${fmt(endOfWeek)}`
}

function TabProduccion({ desde, hasta }: { desde: string; hasta: string }) {
  const semanaActual = getSemanaISO(new Date())
  const [semana, setSemana] = useState(semanaActual)
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [secciones, setSecciones] = useState<Seccion[]>([])
  const [entradas, setEntradas] = useState<EntradaProduccion[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: secs }, { data: parts }, { data: ents }] = await Promise.all([
      supabase.from('secciones_produccion').select('*').eq('activa', true).order('orden'),
      supabase.from('produccion_partidas').select('*').eq('activa', true).order('orden'),
      supabase.from('produccion_entradas').select('*').eq('semana_iso', semana),
    ])
    setSecciones((secs as Seccion[]) ?? [])
    setPartidas((parts as Partida[]) ?? [])
    setEntradas((ents as EntradaProduccion[]) ?? [])
    setLoading(false)
  }, [semana])

  useEffect(() => { cargar() }, [cargar])

  async function upsertCelda(partida_id: string, dia: Dia, campo: 'hoy' | 'ssp', valor: string) {
    const existing = entradas.find(e => e.partida_id === partida_id && e.dia === dia)
    if (existing) {
      await supabase.from('produccion_entradas').update({ [campo]: valor }).eq('id', existing.id)
    } else {
      await supabase.from('produccion_entradas').insert({ partida_id, semana_iso: semana, dia, hoy: campo === 'hoy' ? valor : '', ssp: campo === 'ssp' ? valor : '' })
    }
    await cargar()
  }

  const semanas = useMemo(() => {
    const result: string[] = []
    const seen = new Set<string>()
    const start = new Date(desde)
    const end = new Date(hasta)
    let cur = new Date(start)
    while (cur <= end) {
      const iso = getSemanaISO(cur)
      if (!seen.has(iso)) { seen.add(iso); result.push(iso) }
      cur.setDate(cur.getDate() + 7)
    }
    if (!seen.has(semanaActual)) result.push(semanaActual)
    return result.sort().reverse()
  }, [desde, hasta, semanaActual])

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--sl-text-muted)' }}>Cargando producción…</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontFamily: FONT.heading, fontSize: 11, color: 'var(--sl-text-muted)', letterSpacing: '1.5px', textTransform: 'uppercase' as const }}>Semana:</span>
        <select value={semana} onChange={e => setSemana(e.target.value)} style={{ ...S.inp, minWidth: 200 }}>
          {semanas.map(s => (
            <option key={s} value={s}>{getSemanaLabel(s)}{s === semanaActual ? ' (actual)' : ''}</option>
          ))}
        </select>
      </div>

      {partidas.length === 0 ? (
        <div style={{ ...S.card, color: 'var(--sl-text-muted)', textAlign: 'center', padding: 40 }}>
          Sin partidas de producción activas. Gestiona las partidas desde el módulo Producción.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ ...S.th, minWidth: 180 }}>Partida</th>
                {DIAS.map(d => (
                  <th key={d} style={{ ...S.th, textAlign: 'center' as const, minWidth: 90 }} colSpan={2}>{DIAS_LABEL[d]}</th>
                ))}
              </tr>
              <tr>
                <th style={{ ...S.th, backgroundColor: 'var(--neo-bg)' }} />
                {DIAS.map(d => (
                  <th key={`${d}-h`} style={{ ...S.th, textAlign: 'center' as const, fontSize: 10, backgroundColor: 'var(--neo-bg)' }} colSpan={2}>
                    <span style={{ display: 'inline-block', width: 44, textAlign: 'center' as const }}>HOY</span>
                    <span style={{ display: 'inline-block', width: 44, textAlign: 'center' as const }}>SSP</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {secciones.map(sec => {
                const partsOfSec = partidas.filter(p => p.seccion_id === sec.id)
                if (partsOfSec.length === 0) return null
                return (
                  <TableSection key={sec.id} sec={sec} partsOfSec={partsOfSec} entradas={entradas} upsertCelda={upsertCelda} />
                )
              })}
              {/* Partidas sin sección */}
              {(() => {
                const secIds = new Set(secciones.map(s => s.id))
                const sinSec = partidas.filter(p => !secIds.has(p.seccion_id))
                return sinSec.map(p => {
                  return (
                    <PartidaRow key={p.id} p={p} entradas={entradas} upsertCelda={upsertCelda} />
                  )
                })
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function TableSection({ sec, partsOfSec, entradas, upsertCelda }: { sec: Seccion; partsOfSec: Partida[]; entradas: EntradaProduccion[]; upsertCelda: (id: string, dia: Dia, campo: 'hoy' | 'ssp', v: string) => void }) {
  return (
    <>
      <tr>
        <td colSpan={1 + DIAS.length * 2} style={{ ...S.td, backgroundColor: 'var(--sl-thead)', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: 'var(--sl-text-muted)', padding: '6px 12px' }}>
          {sec.nombre}
        </td>
      </tr>
      {partsOfSec.map(p => <PartidaRow key={p.id} p={p} entradas={entradas} upsertCelda={upsertCelda} />)}
    </>
  )
}

function PartidaRow({ p, entradas, upsertCelda }: { p: Partida; entradas: EntradaProduccion[]; upsertCelda: (id: string, dia: Dia, campo: 'hoy' | 'ssp', v: string) => void }) {
  return (
    <tr>
      <td style={{ ...S.td, fontWeight: 600 }}>{p.nombre}</td>
      {DIAS.map(d => {
        const ent = entradas.find(e => e.partida_id === p.id && e.dia === d)
        return (
          <>
            <td key={`${p.id}-${d}-hoy`} style={{ ...S.td, textAlign: 'center' as const, padding: '4px 3px' }}>
              <input
                defaultValue={ent?.hoy ?? ''}
                onBlur={e => upsertCelda(p.id, d, 'hoy', e.target.value)}
                style={{ ...S.inp, width: 44, textAlign: 'center' as const, padding: '4px 4px', fontSize: 12 }}
              />
            </td>
            <td key={`${p.id}-${d}-ssp`} style={{ ...S.td, textAlign: 'center' as const, padding: '4px 3px' }}>
              <input
                defaultValue={ent?.ssp ?? ''}
                onBlur={e => upsertCelda(p.id, d, 'ssp', e.target.value)}
                style={{ ...S.inp, width: 44, textAlign: 'center' as const, padding: '4px 4px', fontSize: 12 }}
              />
            </td>
          </>
        )
      })}
    </tr>
  )
}

// ── TAB ENTRADAS MP ────────────────────────────────────────────────────────────

interface EntradaMP {
  id: string
  fecha: string
  ingrediente_id: string
  entradas: number
  nota: string | null
  ingrediente: { nombre: string; unidad: string | null } | null
}

function TabEntradas({ desde, hasta, ingredientes, onRefresh }: { desde: string; hasta: string; ingredientes: Ingrediente[]; onRefresh: () => void }) {
  const [entradas, setEntradas] = useState<EntradaMP[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ fecha: new Date().toISOString().split('T')[0], ingrediente_id: '', cantidad: '', nota: '' })

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('conteos_inventario')
      .select('id,fecha,ingrediente_id,entradas,nota,ingrediente:ingredientes(nombre,unidad)')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .gt('entradas', 0)
      .order('fecha', { ascending: false })
    const mapped: EntradaMP[] = ((data as unknown as Array<{
      id: string; fecha: string; ingrediente_id: string; entradas: number; nota: string | null;
      ingrediente: { nombre: string; unidad: string | null } | Array<{ nombre: string; unidad: string | null }> | null
    }>) ?? []).map(r => ({
      id: r.id,
      fecha: r.fecha,
      ingrediente_id: r.ingrediente_id,
      entradas: r.entradas,
      nota: r.nota,
      ingrediente: Array.isArray(r.ingrediente) ? (r.ingrediente[0] ?? null) : r.ingrediente,
    }))
    setEntradas(mapped)
    setLoading(false)
  }, [desde, hasta])

  useEffect(() => { cargar() }, [cargar])

  async function guardar() {
    const num = parseFloat(String(form.cantidad).replace(',', '.'))
    if (!form.ingrediente_id || isNaN(num) || num <= 0) return
    setSaving(true)
    await supabase.from('conteos_inventario').insert({
      fecha: form.fecha,
      ingrediente_id: form.ingrediente_id,
      stock_inicial: 0,
      entradas: num,
      stock_final: 0,
      consumo: 0,
      periodicidad: 'entrada',
      nota: form.nota || null,
    })
    setSaving(false)
    setShowModal(false)
    setForm({ fecha: new Date().toISOString().split('T')[0], ingrediente_id: '', cantidad: '', nota: '' })
    await cargar()
    await onRefresh()
  }

  const totalEntradas = useMemo(() => entradas.reduce((s, e) => s + Number(e.entradas), 0), [entradas])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <span style={{ color: 'var(--sl-text-muted)', fontSize: 13 }}>
          {entradas.length} registros · {fmtNum(totalEntradas)} uds totales
        </span>
        <button onClick={() => setShowModal(true)} style={{ padding: '10px 18px', minHeight: 44, borderRadius: 0, border: `3px solid ${NEO_INK}`, boxShadow: NEO_SHADOW, backgroundColor: LIMA, color: INK, fontFamily: FONT.heading, fontSize: 13, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' as const, cursor: 'pointer' }}>
          + Registrar entrada
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--sl-text-muted)' }}>Cargando entradas…</div>
      ) : entradas.length === 0 ? (
        <div style={{ ...S.card, color: 'var(--sl-text-muted)', textAlign: 'center', padding: 40 }}>
          Sin entradas de materia prima registradas en este período.
        </div>
      ) : (
        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr>
                <th style={S.th}>Fecha</th>
                <th style={S.th}>Ingrediente</th>
                <th style={{ ...S.th, textAlign: 'right' as const }}>Cantidad</th>
                <th style={S.th}>Nota</th>
              </tr>
            </thead>
            <tbody>
              {entradas.map(e => (
                <tr key={e.id}>
                  <td style={S.td}>{fmtDate(e.fecha)}</td>
                  <td style={S.td}>
                    <span style={{ fontWeight: 600 }}>{e.ingrediente?.nombre ?? e.ingrediente_id}</span>
                    {e.ingrediente?.unidad && <span style={{ color: 'var(--sl-text-muted)', fontSize: 11, marginLeft: 4 }}>({e.ingrediente.unidad})</span>}
                  </td>
                  <td style={{ ...S.td, textAlign: 'right' as const, color: VERDE, fontWeight: 600 }}>+{fmtNum(e.entradas)}</td>
                  <td style={{ ...S.td, color: 'var(--sl-text-muted)', fontSize: 12 }}>{e.nota ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--sl-overlay)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }} onClick={() => !saving && setShowModal(false)}>
          <div style={{ backgroundColor: 'var(--sl-modal-bg)', ...NEO_CARD, padding: '28px 32px', width: '90%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: FONT.heading, fontSize: 17, letterSpacing: '2px', textTransform: 'uppercase' as const, color: GRANATE, marginBottom: 20 }}>Registrar entrada MP</div>

            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--sl-text-muted)', fontFamily: FONT.heading, letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: 6 }}>Ingrediente</span>
              <select value={form.ingrediente_id} onChange={e => setForm(p => ({ ...p, ingrediente_id: e.target.value }))} style={{ ...S.inp, width: '100%' }}>
                <option value="">Selecciona ingrediente…</option>
                {ingredientes.map(i => (
                  <option key={i.id} value={i.id}>{i.nombre} {i.ud_std ? `(${i.ud_std})` : i.unidad ? `(${i.unidad})` : ''}</option>
                ))}
              </select>
            </label>

            {([
              { label: 'Fecha', key: 'fecha', type: 'date' },
              { label: 'Cantidad', key: 'cantidad', type: 'number', placeholder: '0.000' },
              { label: 'Nota', key: 'nota', type: 'text', placeholder: 'Opcional' },
            ] as { label: string; key: keyof typeof form; type: string; placeholder?: string }[]).map(f => (
              <label key={f.key} style={{ display: 'block', marginBottom: 14 }}>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--sl-text-muted)', fontFamily: FONT.heading, letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: 6 }}>{f.label}</span>
                <input type={f.type} value={form[f.key]} placeholder={f.placeholder} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={{ ...S.inp, width: '100%', boxSizing: 'border-box' as const }} />
              </label>
            ))}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} disabled={saving} style={{ padding: '10px 18px', minHeight: 44, borderRadius: 0, border: `2px solid ${NEO_INK}`, backgroundColor: 'var(--sl-btn-cancel-bg)', color: 'var(--sl-btn-cancel-text)', fontSize: 13, fontFamily: FONT.heading, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' as const, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardar} disabled={saving || !form.ingrediente_id || !form.cantidad} style={{ padding: '10px 18px', minHeight: 44, borderRadius: 0, border: `2px solid ${NEO_INK}`, boxShadow: NEO_SHADOW, backgroundColor: GRANATE, color: BLANCO, fontSize: 13, fontFamily: FONT.heading, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' as const, cursor: 'pointer', opacity: (!form.ingrediente_id || !form.cantidad) ? 0.5 : 1 }}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
