import { useState, useEffect, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtNum } from '@/utils/format'
import { useTheme } from '@/contexts/ThemeContext'
import type { Receta } from '@/components/escandallo/types'

interface RecetaFicha extends Receta {
  elaboracion?: string | null
  herramientas?: string | null
  alergenos?: string[] | null
  foto_url?: string | null
}

interface LineaRow {
  ingrediente_nombre: string
  cantidad: number
  unidad: string
  eur_total: number
}

const T = {
  brd:  'var(--sl-border)',
  card: 'var(--sl-card)',
  pri:  'var(--sl-text-primary)',
  sec:  'var(--sl-text-secondary)',
  mut:  'var(--sl-text-muted)',
  red:  '#B01D23',
}

const sectionLabel: CSSProperties = {
  fontFamily: 'Oswald, sans-serif',
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: '2px',
  color: T.mut,
  borderBottom: `0.5px solid ${T.brd}`,
  paddingBottom: 6,
  marginBottom: 8,
  display: 'block',
  marginTop: 0,
}

const labelStyle: CSSProperties = {
  fontFamily: 'Oswald, sans-serif',
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: '2px',
  color: T.mut,
  display: 'block',
  marginBottom: 5,
}

export default function RecetasFichasTecnicas() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [recetas, setRecetas]     = useState<RecetaFicha[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [categorias, setCategorias] = useState<string[]>([])
  const [selected, setSelected]   = useState<RecetaFicha | null>(null)
  const [lineas, setLineas]       = useState<LineaRow[]>([])
  const [editOpen, setEditOpen]   = useState(false)

  // edit state
  const [editCategoria,   setEditCategoria]   = useState('')
  const [editElab,        setEditElab]        = useState('')
  const [editHerramientas,setEditHerramientas]= useState('')
  const [editAlergenos,   setEditAlergenos]   = useState('')
  const [editFotoUrl,     setEditFotoUrl]     = useState('')
  const [saving, setSaving] = useState(false)

  const loadRecetas = useCallback(async () => {
    setLoading(true)
    const [recRes, catRes] = await Promise.all([
      supabase.from('recetas').select('*').order('nombre'),
      supabase.from('configuracion').select('valor').eq('clave', 'categorias_recetas').maybeSingle(),
    ])
    if (recRes.data) setRecetas(recRes.data as RecetaFicha[])
    if (catRes.data?.valor) {
      try { const c = JSON.parse(catRes.data.valor); if (Array.isArray(c)) setCategorias(c) } catch {}
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadRecetas() }, [loadRecetas])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('recetas_lineas')
        .select('ingrediente_nombre, cantidad, unidad, eur_ud_neta')
        .eq('receta_id', selected.id)
        .order('linea')
      if (!cancelled && data)
        setLineas(data.map((d: any) => ({
          ingrediente_nombre: d.ingrediente_nombre ?? '',
          cantidad: d.cantidad ?? 0,
          unidad: d.unidad ?? '',
          eur_total: (d.cantidad ?? 0) * (d.eur_ud_neta ?? 0),
        })))
    })()
    return () => { cancelled = true }
  }, [selected])

  const filtered = recetas.filter(r => {
    const ms = !search || r.nombre.toLowerCase().includes(search.toLowerCase())
    const mc = !catFilter || (r.categoria ?? '') === catFilter
    return ms && mc
  })

  const groups = filtered.reduce<Record<string, RecetaFicha[]>>((acc, r) => {
    const k = r.categoria || 'Sin categoría'
    if (!acc[k]) acc[k] = []
    acc[k].push(r)
    return acc
  }, {})

  const openEdit = () => {
    if (!selected) return
    setEditCategoria(selected.categoria ?? '')
    setEditElab(selected.elaboracion ?? '')
    setEditHerramientas(selected.herramientas ?? '')
    setEditAlergenos((selected.alergenos ?? []).join(', '))
    setEditFotoUrl(selected.foto_url ?? '')
    setEditOpen(true)
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    const alergArr = editAlergenos
      ? editAlergenos.split(',').map(s => s.trim()).filter(Boolean)
      : []
    await supabase.from('recetas').update({
      categoria:    editCategoria    || null,
      elaboracion:  editElab         || null,
      herramientas: editHerramientas || null,
      alergenos:    alergArr,
      foto_url:     editFotoUrl      || null,
    }).eq('id', selected.id)
    setSaving(false)
    setEditOpen(false)
    // reload list and refresh selected
    const { data } = await supabase.from('recetas').select('*').order('nombre')
    if (data) {
      setRecetas(data as RecetaFicha[])
      const updated = (data as RecetaFicha[]).find(r => r.id === selected.id)
      if (updated) setSelected(updated)
    }
  }

  const inputStyle: CSSProperties = {
    fontFamily: 'Lexend, sans-serif',
    fontSize: 13,
    backgroundColor: 'var(--sl-input-edit)',
    border: '1px solid var(--sl-border-strong)',
    borderRadius: 6,
    padding: '7px 10px',
    color: T.pri,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      display: 'flex',
      background: 'var(--sl-card)',
      border: `0.5px solid ${T.brd}`,
      borderRadius: 16,
      overflow: 'hidden',
      height: 'calc(100vh - 80px)',
    }}>

      {/* ── Columna izquierda ── */}
      <div style={{ width: 260, flexShrink: 0, borderRight: `0.5px solid ${T.brd}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 12px 10px', borderBottom: `0.5px solid ${T.brd}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            style={inputStyle}
            placeholder="Buscar receta..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            style={inputStyle}
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ padding: '5px 12px', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: T.mut, borderBottom: `0.5px solid ${T.brd}` }}>
          {filtered.length} recetas
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 20, fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut }}>Cargando…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 20, fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut }}>Sin resultados</div>
          ) : Object.entries(groups).map(([grp, items]) => (
            <div key={grp}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 9, textTransform: 'uppercase', letterSpacing: '2px', color: T.mut, padding: '10px 12px 4px' }}>
                {grp}
              </div>
              {items.map(r => {
                const active = selected?.id === r.id
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelected(r)}
                    style={{
                      padding: '9px 12px',
                      cursor: 'pointer',
                      borderLeft: active ? `2px solid ${T.red}` : '2px solid transparent',
                      background: active ? 'var(--sl-card-alt)' : 'transparent',
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.pri, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.nombre}
                    </div>
                    <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 10, color: T.sec, marginTop: 2 }}>
                      {r.categoria ?? 'Sin categoría'} · {fmtEur(r.coste_rac)}/rac
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Columna derecha ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {!selected ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: T.mut }}>
            Selecciona una receta
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 22, color: T.pri, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                  {selected.nombre}
                </h1>
                <p style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.sec, marginTop: 4, marginBottom: 0 }}>
                  {selected.raciones} ración{selected.raciones !== 1 ? 'es' : ''} · Coste {fmtEur(selected.coste_rac)}/rac
                </p>
              </div>
              <button
                onClick={openEdit}
                style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', backgroundColor: T.red, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', flexShrink: 0 }}
              >
                Editar
              </button>
            </div>

            {/* CATEGORÍA */}
            <div style={{ marginBottom: 20 }}>
              <span style={sectionLabel}>Categoría</span>
              {selected.categoria ? (
                <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', backgroundColor: T.brd, color: T.sec, padding: '3px 10px', borderRadius: 99, display: 'inline-block' }}>
                  {selected.categoria}
                </span>
              ) : (
                <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut }}>—</span>
              )}
            </div>

            {/* INGREDIENTES */}
            <div style={{ marginBottom: 20 }}>
              <span style={sectionLabel}>Ingredientes</span>
              {lineas.length === 0 ? (
                <p style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut, fontStyle: 'italic', margin: 0 }}>Sin ingredientes</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {(['Ingrediente', 'Cantidad', 'Coste'] as const).map((h, i) => (
                        <th key={h} style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.mut, padding: '6px 10px', textAlign: i === 0 ? 'left' : 'right', borderBottom: `0.5px solid ${T.brd}`, fontWeight: 600 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l, i) => (
                      <tr key={i} style={{ backgroundColor: i % 2 !== 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                        <td style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: T.pri, padding: '8px 10px', borderBottom: `0.5px solid ${T.brd}` }}>
                          {l.ingrediente_nombre}
                        </td>
                        <td style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: T.sec, padding: '8px 10px', textAlign: 'right', borderBottom: `0.5px solid ${T.brd}` }}>
                          {fmtNum(l.cantidad)} {l.unidad}
                        </td>
                        <td style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: T.pri, padding: '8px 10px', textAlign: 'right', borderBottom: `0.5px solid ${T.brd}` }}>
                          {fmtEur(l.eur_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ELABORACIÓN */}
            <div style={{ marginBottom: 20 }}>
              <span style={sectionLabel}>Elaboración</span>
              {selected.elaboracion ? (
                <p style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: T.pri, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                  {selected.elaboracion}
                </p>
              ) : (
                <p style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut, fontStyle: 'italic', margin: 0 }}>
                  ⚠ Sin elaboración — pulsa Editar para añadirla
                </p>
              )}
            </div>

            {/* HERRAMIENTAS */}
            <div style={{ marginBottom: 20 }}>
              <span style={sectionLabel}>Herramientas</span>
              {selected.herramientas ? (
                <p style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: T.pri, margin: 0 }}>
                  {selected.herramientas}
                </p>
              ) : (
                <p style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut, fontStyle: 'italic', margin: 0 }}>
                  Sin herramientas definidas
                </p>
              )}
            </div>

            {/* ALÉRGENOS */}
            <div style={{ marginBottom: 20 }}>
              <span style={sectionLabel}>Alérgenos</span>
              {selected.alergenos && selected.alergenos.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selected.alergenos.map(a => (
                    <span key={a} style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', backgroundColor: T.brd, color: T.sec, padding: '3px 10px', borderRadius: 99, border: `0.5px solid ${T.brd}` }}>
                      {a}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut, fontStyle: 'italic', margin: 0 }}>
                  Sin alérgenos definidos
                </p>
              )}
            </div>

            {/* FOTO */}
            <div style={{ marginBottom: 20 }}>
              <span style={sectionLabel}>Foto</span>
              {selected.foto_url ? (
                <img
                  src={selected.foto_url}
                  alt={selected.nombre}
                  style={{ width: '100%', borderRadius: 8, maxHeight: 240, objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{ border: `1px dashed ${T.brd}`, borderRadius: 8, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut }}>
                    Sin foto — pulsa Editar para añadir
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Modal Editar ── */}
      {editOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)', padding: 16 }}
          onClick={() => setEditOpen(false)}
        >
          <div
            style={{ backgroundColor: isDark ? '#1a1a1a' : '#ffffff', border: `1px solid ${T.brd}`, borderRadius: 10, padding: 24, width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 15, color: T.pri, margin: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {selected?.nombre}
            </h2>

            <div>
              <label style={labelStyle}>Categoría</label>
              <select style={inputStyle} value={editCategoria} onChange={e => setEditCategoria(e.target.value)}>
                <option value="">Sin categoría</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Elaboración</label>
              <textarea
                style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
                value={editElab}
                onChange={e => setEditElab(e.target.value)}
                placeholder="Pasos de elaboración..."
              />
            </div>

            <div>
              <label style={labelStyle}>Herramientas</label>
              <textarea
                style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                value={editHerramientas}
                onChange={e => setEditHerramientas(e.target.value)}
                placeholder="Ej: Cazuela, batidora..."
              />
            </div>

            <div>
              <label style={labelStyle}>Alérgenos (separados por comas)</label>
              <input
                style={inputStyle}
                value={editAlergenos}
                onChange={e => setEditAlergenos(e.target.value)}
                placeholder="Ej: Gluten, Lácteos, Huevo"
              />
            </div>

            <div>
              <label style={labelStyle}>URL Foto</label>
              <input
                style={inputStyle}
                value={editFotoUrl}
                onChange={e => setEditFotoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditOpen(false)}
                style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', backgroundColor: 'var(--sl-btn-cancel-bg)', color: 'var(--sl-btn-cancel-text)', border: '1px solid var(--sl-btn-cancel-border)', borderRadius: 5, padding: '9px 20px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', backgroundColor: T.red, color: '#fff', border: 'none', borderRadius: 5, padding: '9px 20px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
