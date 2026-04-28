/**
 * Escandallo v2 — T-F4-03 / T-F4-04 / T-F4-11
 * Ingredientes con proveedor_principal, botón "Vincular con compra",
 * histórico precios y comparativa proveedores.
 */
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, pageTitleStyle, tabActiveStyle, tabInactiveStyle } from '@/styles/tokens'
import { VincularCompraModal } from '@/components/escandallo/VincularCompraModal'
import { HistoricoPrecioIngrediente } from '@/components/escandallo/HistoricoPrecioIngrediente'
import { ComparativaProveedores } from '@/components/escandallo/ComparativaProveedores'
import { FoodCostBadge } from '@/components/alerts/FoodCostBadge'
import type { Ingrediente } from '@/components/escandallo/types'

type Tab = 'ingredientes' | 'recetas'

export default function EscandalloV2() {
  const { T, isDark } = useTheme()
  const [tab, setTab] = useState<Tab>('ingredientes')
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const [selected, setSelected] = useState<Ingrediente | null>(null)
  const [vincularModal, setVincularModal] = useState<Ingrediente | null>(null)
  const [umbral, setUmbral] = useState(32)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [{ data: ings }, { data: cfg }] = await Promise.all([
        supabase.from('ingredientes').select('*').order('nombre'),
        supabase.from('configuracion').select('valor').eq('clave', 'config_food_cost_umbral').maybeSingle(),
      ])
      if (!cancelled) {
        setIngredientes((ings as Ingrediente[]) ?? [])
        if (cfg) setUmbral(parseFloat(String((cfg as { valor: string }).valor)) || 32)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [refreshKey])

  const filtrados = ingredientes.filter(i => {
    if (i.abv === 'EPS' || i.abv === 'MRM') return false
    const q = busqueda.trim().toLowerCase()
    if (!q) return true
    return (i.nombre ?? '').toLowerCase().includes(q) ||
      (i.nombre_base ?? '').toLowerCase().includes(q) ||
      (i.categoria ?? '').toLowerCase().includes(q)
  })

  const handleSetProveedor = async (id: string, proveedor: string) => {
    await supabase.from('ingredientes').update({ proveedor_principal: proveedor }).eq('id', id)
    setRefreshKey(k => k + 1)
  }

  const thStyle: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px',
    textTransform: 'uppercase', color: T.mut, padding: '9px 12px',
    textAlign: 'left', whiteSpace: 'nowrap', background: '#0a0a0a',
    borderBottom: `1px solid ${T.brd}`,
  }
  const tdStyle: CSSProperties = {
    fontFamily: FONT.body, fontSize: 12, color: T.pri,
    padding: '8px 12px', borderBottom: `0.5px solid ${T.brd}`, verticalAlign: 'middle',
  }

  return (
    <div style={{ background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 28px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={pageTitleStyle(T)}>Escandallo v2</h1>
        <a href="/escandallo" style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, textDecoration: 'none' }}>
          ← v1
        </a>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([['ingredientes', 'Ingredientes'] as const, ['recetas', 'Recetas'] as const]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={tab === id ? tabActiveStyle(isDark) : tabInactiveStyle(T)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'ingredientes' && (
        <>
          {/* Buscador */}
          <div style={{ marginBottom: 16 }}>
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar ingrediente..."
              style={{
                background: '#1e1e1e', border: `1px solid ${T.brd}`, borderRadius: 6,
                color: T.pri, fontFamily: FONT.body, fontSize: 13,
                padding: '8px 12px', width: 280, boxSizing: 'border-box',
              }}
            />
            <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginLeft: 12 }}>
              {filtrados.length} ingrediente{filtrados.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Tabla */}
          {loading ? (
            <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.mut }}>Cargando...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Nombre</th>
                    <th style={thStyle}>Categoría</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Precio</th>
                    <th style={thStyle}>Ud</th>
                    <th style={thStyle}>Proveedor principal</th>
                    <th style={thStyle}>Food cost</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(ing => {
                    const precioActivo = ing.precio_activo ?? ing.ultimo_precio ?? 0
                    // Food cost aproximado: coste_neto_std como % del precio medio de la receta
                    const fcPct = ing.coste_neto_std && ing.coste_neto_std > 0
                      ? null // solo se calcula a nivel receta
                      : null

                    return (
                      <tr
                        key={ing.id}
                        style={{ cursor: 'pointer', background: selected?.id === ing.id ? '#B01D2311' : 'transparent' }}
                        onClick={() => setSelected(selected?.id === ing.id ? null : ing)}
                      >
                        <td style={tdStyle}>{ing.nombre_base || ing.nombre}</td>
                        <td style={{ ...tdStyle, color: T.sec }}>{ing.categoria ?? '—'}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>
                          {precioActivo > 0 ? `${precioActivo.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '—'}
                        </td>
                        <td style={{ ...tdStyle, color: T.mut }}>{ing.ud_std}</td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              color: ing.proveedor_principal ? T.pri : T.mut,
                              fontStyle: ing.proveedor_principal ? 'normal' : 'italic',
                              fontSize: 12,
                            }}
                            onClick={e => e.stopPropagation()}
                          >
                            <ProveedorInline
                              value={ing.proveedor_principal ?? ''}
                              onSave={val => handleSetProveedor(ing.id, val)}
                              T={T}
                            />
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {fcPct != null ? <FoodCostBadge foodCostPct={fcPct} umbral={umbral} /> : null}
                        </td>
                        <td style={tdStyle} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setVincularModal(ing)}
                            style={{
                              background: '#1e1e1e', border: `1px solid ${T.brd}`, color: T.sec,
                              fontFamily: FONT.body, fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                            }}
                          >
                            Vincular compra
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Detalle ingrediente seleccionado */}
          {selected && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', color: T.pri, marginBottom: 8 }}>
                {selected.nombre_base || selected.nombre}
              </div>
              <HistoricoPrecioIngrediente ingredienteId={selected.id} />
              <ComparativaProveedores
                ingredienteId={selected.id}
                proveedorPrincipal={selected.proveedor_principal}
              />
            </div>
          )}
        </>
      )}

      {tab === 'recetas' && (
        <TabRecetasV2 T={T} umbral={umbral} />
      )}

      {vincularModal && (
        <VincularCompraModal
          ingredienteId={vincularModal.id}
          ingredienteNombre={vincularModal.nombre_base || vincularModal.nombre}
          onClose={() => setVincularModal(null)}
          onDone={() => {
            setRefreshKey(k => k + 1)
            if (selected?.id === vincularModal.id) {
              setSelected(prev => prev ? { ...prev } : null)
            }
          }}
        />
      )}
    </div>
  )
}

/* ─── ProveedorInline: edición inline ─── */
function ProveedorInline({ value, onSave, T }: { value: string; onSave: (v: string) => void; T: ReturnType<typeof useTheme>['T'] }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (!editing) {
    return (
      <span
        onClick={() => { setDraft(value); setEditing(true) }}
        style={{ cursor: 'text', borderBottom: `1px dashed ${T.brd}`, paddingBottom: 1, color: value ? T.pri : T.mut, fontStyle: value ? 'normal' : 'italic' }}
      >
        {value || '+ proveedor'}
      </span>
    )
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { onSave(draft); setEditing(false) }}
      onKeyDown={e => {
        if (e.key === 'Enter') { onSave(draft); setEditing(false) }
        if (e.key === 'Escape') setEditing(false)
      }}
      style={{
        background: '#1e1e1e', border: `1px solid ${T.brd}`, borderRadius: 4,
        color: T.pri, fontFamily: FONT.body, fontSize: 12,
        padding: '2px 6px', width: 140,
      }}
      onClick={e => e.stopPropagation()}
    />
  )
}

/* ─── Tab Recetas v2 ─── */
function TabRecetasV2({ T, umbral }: { T: ReturnType<typeof useTheme>['T']; umbral: number }) {
  const [recetas, setRecetas] = useState<{
    id: string; nombre: string; coste_rac: number;
    pvp_uber: number; pvp_glovo: number; pvp_je: number; pvp_web: number; pvp_directa: number
  }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('recetas')
        .select('id, nombre, coste_rac, pvp_uber, pvp_glovo, pvp_je, pvp_web, pvp_directa')
        .order('nombre')
      if (!cancelled) { setRecetas(data ?? []); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  if (loading) return <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.mut }}>Cargando recetas...</div>

  const thStyle: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px',
    textTransform: 'uppercase', color: T.mut, padding: '9px 12px',
    textAlign: 'left', whiteSpace: 'nowrap', background: '#0a0a0a',
    borderBottom: `1px solid ${T.brd}`,
  }
  const tdStyle: CSSProperties = {
    fontFamily: FONT.body, fontSize: 12, color: T.pri,
    padding: '8px 12px', borderBottom: `0.5px solid ${T.brd}`,
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Receta</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Coste rac.</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>PVP Uber</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>FC Uber%</th>
            <th style={thStyle}>Alerta</th>
          </tr>
        </thead>
        <tbody>
          {recetas.map(r => {
            const pvpRef = r.pvp_uber || r.pvp_glovo || r.pvp_je || r.pvp_web || r.pvp_directa
            const fcPct = pvpRef > 0 ? (r.coste_rac / pvpRef) * 100 : null
            return (
              <tr key={r.id}>
                <td style={tdStyle}>{r.nombre}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.coste_rac.toLocaleString('es-ES', { minimumFractionDigits: 4 })} €</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{pvpRef > 0 ? `${pvpRef.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {fcPct != null ? (
                    <span style={{ color: fcPct > umbral ? '#ff6b70' : T.pri }}>
                      {fcPct.toFixed(1)}%
                    </span>
                  ) : '—'}
                </td>
                <td style={tdStyle}>
                  {fcPct != null && <FoodCostBadge foodCostPct={fcPct} umbral={umbral} />}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
