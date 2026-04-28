/**
 * T-F4-05 — Carta · CRUD carta_platos con food cost por canal.
 * Implementa T-F4-05 + T-F4-06 (margen por canal).
 */
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, pageTitleStyle, tabActiveStyle, tabInactiveStyle } from '@/styles/tokens'
import { marginPorTodosCanales, type MargenPorCanal } from '@/lib/marcas/foodCostPorCanal'
import { fmtEur } from '@/utils/format'

/* ─── Types ─── */

interface Plato {
  id: string
  nombre: string
  pvp: number
  marca: string
  receta_id: string | null
  activo: boolean
  created_at: string
}

interface Receta {
  id: string
  nombre: string
  coste_rac: number
}

type Tab = 'platos' | 'canal'

/* ─── Colores semáforo ─── */
const COLOR_VERDE = '#1D9E75'
const COLOR_AMARILLO = '#f5a623'
const COLOR_ROJO = '#B01D23'

function margenColor(estado: 'verde' | 'amarillo' | 'rojo'): string {
  return estado === 'verde' ? COLOR_VERDE : estado === 'amarillo' ? COLOR_AMARILLO : COLOR_ROJO
}

/* ─── Main ─── */

export default function Carta() {
  const { T, isDark } = useTheme()
  const [tab, setTab] = useState<Tab>('platos')
  const [platos, setPlatos] = useState<Plato[]>([])
  const [recetas, setRecetas] = useState<Receta[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from('carta_platos').select('*').order('marca').order('nombre'),
        supabase.from('recetas').select('id, nombre, coste_rac').order('nombre'),
      ])
      if (!cancelled) {
        setPlatos((p as Plato[]) ?? [])
        setRecetas((r as Receta[]) ?? [])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [refreshKey])

  const recetaMap = Object.fromEntries(recetas.map(r => [r.id, r]))

  const platosActivos = platos.filter(p => p.activo)
  const sinReceta = platos.filter(p => !p.receta_id).length
  const margenMedio = platosActivos.length > 0
    ? platosActivos.reduce((acc, p) => {
      const r = p.receta_id ? recetaMap[p.receta_id] : null
      if (!r) return acc
      return acc + (p.pvp - r.coste_rac)
    }, 0) / platosActivos.filter(p => p.receta_id && recetaMap[p.receta_id]).length || 0
    : 0

  /* ── Estilos ── */
  const thStyle: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px',
    textTransform: 'uppercase', color: T.mut, padding: '9px 12px',
    textAlign: 'left', whiteSpace: 'nowrap', background: '#0a0a0a',
    borderBottom: `1px solid ${T.brd}`,
  }
  const tdStyle: CSSProperties = {
    fontFamily: FONT.body, fontSize: 13, color: T.pri,
    padding: '9px 12px', borderBottom: `0.5px solid ${T.brd}`, verticalAlign: 'middle',
  }

  return (
    <div style={{ background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 28px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={pageTitleStyle(T)}>Carta</h1>
        <button
          onClick={() => { setEditId(null); setShowForm(true) }}
          style={{
            background: '#e8f442', color: '#111111', border: 'none', borderRadius: 6,
            fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase',
            padding: '8px 18px', cursor: 'pointer',
          }}
        >
          + Nuevo plato
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
        <KpiMini label="Platos activos" value={String(platosActivos.length)} T={T} />
        <KpiMini label="Margen bruto medio" value={fmtEur(margenMedio)} T={T} />
        <KpiMini label="Sin receta" value={String(sinReceta)} T={T} accent={sinReceta > 0 ? COLOR_AMARILLO : undefined} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([['platos', 'Platos'] as const, ['canal', 'Por canal'] as const]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={tab === id ? tabActiveStyle(isDark) : tabInactiveStyle(T)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.mut }}>Cargando...</div>}

      {!loading && tab === 'platos' && (
        <TabPlatos
          platos={platos} recetaMap={recetaMap} T={T} thStyle={thStyle} tdStyle={tdStyle}
          onEdit={id => { setEditId(id); setShowForm(true) }}
          onToggle={async (id, activo) => {
            await supabase.from('carta_platos').update({ activo: !activo }).eq('id', id)
            setRefreshKey(k => k + 1)
          }}
          onDelete={async id => {
            await supabase.from('carta_platos').delete().eq('id', id)
            setRefreshKey(k => k + 1)
          }}
        />
      )}

      {!loading && tab === 'canal' && (
        <TabPorCanal platos={platosActivos} recetaMap={recetaMap} T={T} thStyle={thStyle} tdStyle={tdStyle} />
      )}

      {showForm && (
        <PlatoForm
          T={T}
          plato={editId ? platos.find(p => p.id === editId) ?? null : null}
          recetas={recetas}
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); setRefreshKey(k => k + 1) }}
        />
      )}
    </div>
  )
}

/* ─── Tab Platos ─── */

function TabPlatos({ platos, recetaMap, T, thStyle, tdStyle, onEdit, onToggle, onDelete }: {
  platos: Plato[]; recetaMap: Record<string, Receta>; T: ReturnType<typeof useTheme>['T']
  thStyle: CSSProperties; tdStyle: CSSProperties
  onEdit: (id: string) => void
  onToggle: (id: string, activo: boolean) => void
  onDelete: (id: string) => void
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Nombre</th>
            <th style={thStyle}>Marca</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>PVP</th>
            <th style={thStyle}>Receta</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Food cost</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Margen bruto</th>
            <th style={thStyle}>Estado</th>
            <th style={thStyle}></th>
          </tr>
        </thead>
        <tbody>
          {platos.map(p => {
            const receta = p.receta_id ? recetaMap[p.receta_id] : null
            const foodCost = receta ? receta.coste_rac : null
            const margen = foodCost != null ? p.pvp - foodCost : null
            const fcPct = foodCost != null && p.pvp > 0 ? (foodCost / p.pvp) * 100 : null
            const fcOver = fcPct != null && fcPct > 32

            return (
              <tr key={p.id}>
                <td style={tdStyle}>{p.nombre}</td>
                <td style={{ ...tdStyle, color: T.sec }}>{p.marca}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtEur(p.pvp)}</td>
                <td style={{ ...tdStyle, color: receta ? T.pri : T.mut, fontStyle: receta ? 'normal' : 'italic' }}>
                  {receta ? receta.nombre : '—'}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {foodCost != null ? (
                    <span style={{ color: fcOver ? '#ff6b70' : T.pri }}>
                      {fmtEur(foodCost)} {fcPct != null ? `(${fcPct.toFixed(1)}%)` : ''}
                      {fcOver && ' ⚠'}
                    </span>
                  ) : (
                    <span style={{ color: T.mut }}>N/D</span>
                  )}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {margen != null ? (
                    <span style={{ color: margen >= 0 ? '#1D9E75' : '#E24B4A' }}>
                      {fmtEur(margen)}
                    </span>
                  ) : <span style={{ color: T.mut }}>—</span>}
                </td>
                <td style={tdStyle}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11,
                    fontFamily: FONT.heading, letterSpacing: '1px', textTransform: 'uppercase',
                    background: p.activo ? '#1D9E7533' : '#33333388',
                    color: p.activo ? '#1D9E75' : T.mut,
                  }}>
                    {p.activo ? 'Activo' : 'Pausado'}
                  </span>
                </td>
                <td style={{ ...tdStyle, display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => onEdit(p.id)}
                    style={{ background: T.card, border: `1px solid ${T.brd}`, color: T.sec, fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontFamily: FONT.body }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => onToggle(p.id, p.activo)}
                    style={{ background: T.card, border: `1px solid ${T.brd}`, color: T.sec, fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontFamily: FONT.body }}
                  >
                    {p.activo ? 'Pausar' : 'Activar'}
                  </button>
                </td>
              </tr>
            )
          })}
          {platos.length === 0 && (
            <tr>
              <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: T.mut, padding: 24 }}>
                Sin platos. Añade el primero con "+ Nuevo plato".
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ─── Tab Por canal ─── */

function TabPorCanal({ platos, recetaMap, T, thStyle, tdStyle }: {
  platos: Plato[]; recetaMap: Record<string, Receta>; T: ReturnType<typeof useTheme>['T']
  thStyle: CSSProperties; tdStyle: CSSProperties
}) {
  const [margenes, setMargenes] = useState<Record<string, MargenPorCanal[]>>({})
  const [loadingCanales, setLoadingCanales] = useState(true)
  const [canalesNombres, setCanalesNombres] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const platosConReceta = platos.filter(p => p.receta_id && recetaMap[p.receta_id])
      if (!platosConReceta.length) { setLoadingCanales(false); return }

      const first = platosConReceta[0]
      const recetaFirst = recetaMap[first.receta_id!]
      const canalesRef = await marginPorTodosCanales(first.pvp, recetaFirst.coste_rac)
      const nombres = canalesRef.map(c => c.canal)

      const result: Record<string, MargenPorCanal[]> = {}
      for (const p of platosConReceta) {
        const receta = recetaMap[p.receta_id!]
        result[p.id] = await marginPorTodosCanales(p.pvp, receta.coste_rac)
      }
      if (!cancelled) {
        setCanalesNombres(nombres)
        setMargenes(result)
        setLoadingCanales(false)
      }
    })()
    return () => { cancelled = true }
  }, [platos, recetaMap])

  if (loadingCanales) {
    return <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.mut }}>Calculando márgenes...</div>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Plato</th>
            <th style={thStyle}>Marca</th>
            {canalesNombres.map(c => (
              <th key={c} style={{ ...thStyle, textAlign: 'right' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {platos.filter(p => p.receta_id && recetaMap[p.receta_id]).map(p => {
            const mByCanal = margenes[p.id] ?? []
            return (
              <tr key={p.id}>
                <td style={tdStyle}>{p.nombre}</td>
                <td style={{ ...tdStyle, color: T.sec }}>{p.marca}</td>
                {canalesNombres.map(cname => {
                  const m = mByCanal.find(x => x.canal === cname)
                  if (!m) return <td key={cname} style={{ ...tdStyle, textAlign: 'right', color: T.mut }}>—</td>
                  return (
                    <td key={cname} style={{ ...tdStyle, textAlign: 'right' }}>
                      <span style={{ color: margenColor(m.estado), fontWeight: 600 }}>
                        {fmtEur(m.margen)}
                      </span>
                      <span style={{ color: T.mut, fontSize: 11 }}> ({m.margen_pct.toFixed(1)}%)</span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
          {platos.filter(p => p.receta_id && recetaMap[p.receta_id]).length === 0 && (
            <tr><td colSpan={2 + canalesNombres.length} style={{ ...tdStyle, textAlign: 'center', color: T.mut, padding: 24 }}>
              Sin platos con receta vinculada.
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ─── PlatoForm ─── */

function PlatoForm({ T, plato, recetas, onClose, onSave }: {
  T: ReturnType<typeof useTheme>['T']
  plato: Plato | null
  recetas: Receta[]
  onClose: () => void
  onSave: () => void
}) {
  const [nombre, setNombre] = useState(plato?.nombre ?? '')
  const [pvp, setPvp] = useState(plato?.pvp ? String(plato.pvp) : '')
  const [marca, setMarca] = useState(plato?.marca ?? '')
  const [recetaId, setRecetaId] = useState(plato?.receta_id ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleSave = async () => {
    if (!nombre.trim() || !pvp || !marca.trim()) { setErr('Nombre, PVP y marca son obligatorios'); return }
    const pvpNum = parseFloat(pvp.replace(',', '.'))
    if (isNaN(pvpNum) || pvpNum <= 0) { setErr('PVP no válido'); return }

    setSaving(true); setErr(null)
    const payload = {
      nombre: nombre.trim(),
      pvp: pvpNum,
      marca: marca.trim(),
      receta_id: recetaId || null,
    }
    let error
    if (plato) {
      ({ error } = await supabase.from('carta_platos').update(payload).eq('id', plato.id))
    } else {
      ({ error } = await supabase.from('carta_platos').insert(payload))
    }
    setSaving(false)
    if (error) { setErr(error.message); return }
    onSave()
  }

  const overlayStyle: CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  const modalStyle: CSSProperties = {
    backgroundColor: '#1a1a1a', border: `1px solid ${T.brd}`, borderRadius: 12,
    padding: '24px 28px', width: '90%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 14,
  }
  const labelStyle: CSSProperties = { fontFamily: FONT.body, fontSize: 12, color: T.sec, marginBottom: 4, display: 'block' }
  const inputStyle: CSSProperties = {
    background: '#1e1e1e', border: `1px solid ${T.brd}`, borderRadius: 6,
    color: T.pri, fontFamily: FONT.body, fontSize: 13,
    padding: '8px 10px', width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalStyle}>
        <div style={{ fontFamily: FONT.heading, fontSize: 15, letterSpacing: '2px', textTransform: 'uppercase', color: T.pri }}>
          {plato ? 'Editar plato' : 'Nuevo plato'}
        </div>
        <div>
          <label style={labelStyle}>Nombre</label>
          <input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Katsu curry" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>PVP (€)</label>
            <input style={inputStyle} value={pvp} onChange={e => setPvp(e.target.value)} placeholder="Ej: 12.50" />
          </div>
          <div>
            <label style={labelStyle}>Marca</label>
            <input style={inputStyle} value={marca} onChange={e => setMarca(e.target.value)} placeholder="Ej: Mister Katsu" />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Receta vinculada (opcional)</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={recetaId} onChange={e => setRecetaId(e.target.value)}>
            <option value="">— Sin receta —</option>
            {recetas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>
        {err && <div style={{ fontFamily: FONT.body, fontSize: 12, color: '#ff6b70' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: '#222222', border: '1px solid #383838', color: T.sec, fontFamily: FONT.body, fontSize: 13, padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} style={{ background: saving ? '#555' : '#B01D23', color: '#fff', border: 'none', fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', padding: '8px 20px', borderRadius: 6, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── KPI Mini ─── */
function KpiMini({ label, value, T, accent }: { label: string; value: string; T: ReturnType<typeof useTheme>['T']; accent?: string }) {
  return (
    <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: accent ?? T.pri }}>{value}</div>
    </div>
  )
}
