import { Fragment, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Wand2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'
import { EditModal, Field } from '@/components/configuracion/EditModal'

interface Regla {
  id: string
  patron: string
  asigna_como: 'ingreso' | 'gasto'
  categoria_codigo: string | null
  activa: boolean
  prioridad: number
}

interface CatIngreso { codigo: string; nombre: string }
interface CatGasto { codigo: string; nombre: string; grupo: string | null }

export default function ReglasPanel() {
  const { T, isDark } = useTheme()
  const [reglas, setReglas] = useState<Regla[]>([])
  const [catsIng, setCatsIng] = useState<CatIngreso[]>([])
  const [catsGas, setCatsGas] = useState<CatGasto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Regla | null>(null)
  const [creating, setCreating] = useState(false)
  const [fPatron, setFPatron] = useState('')
  const [fAsigna, setFAsigna] = useState<'ingreso' | 'gasto'>('gasto')
  const [fCodigo, setFCodigo] = useState('')
  const [fActiva, setFActiva] = useState(true)
  const [fPrioridad, setFPrioridad] = useState(0)
  const [saving, setSaving] = useState(false)

  async function refetch() {
    const [r, ci, cg] = await Promise.all([
      supabase.from('reglas_conciliacion').select('id, patron, asigna_como, tipo_categoria, categoria_codigo, activa, prioridad').order('prioridad', { ascending: false }),
      supabase.from('categorias_contables_ingresos').select('codigo, nombre').order('orden'),
      supabase.from('categorias_contables_gastos').select('codigo, nombre, grupo').order('grupo').order('codigo'),
    ])
    if (r.error) throw r.error
    if (ci.error) throw ci.error
    if (cg.error) throw cg.error
    const mapped: Regla[] = (r.data ?? []).map((x: any) => ({
      id: x.id,
      patron: x.patron,
      asigna_como: (x.asigna_como ?? x.tipo_categoria) as 'ingreso' | 'gasto',
      categoria_codigo: x.categoria_codigo ?? null,
      activa: x.activa ?? true,
      prioridad: x.prioridad ?? 0,
    }))
    setReglas(mapped)
    setCatsIng((ci.data ?? []) as CatIngreso[])
    setCatsGas((cg.data ?? []) as CatGasto[])
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  const gastosPorGrupo = useMemo(() => {
    const m: Record<string, CatGasto[]> = {}
    catsGas.forEach(c => {
      const k = c.grupo ?? 'OTROS'
      ;(m[k] = m[k] || []).push(c)
    })
    return Object.keys(m).sort().map(g => ({ grupo: g, items: m[g] }))
  }, [catsGas])

  const nombrePorCodigo = useMemo(() => {
    const m: Record<string, string> = {}
    catsIng.forEach(c => { m[c.codigo] = c.nombre })
    catsGas.forEach(c => { m[c.codigo] = c.nombre })
    return m
  }, [catsIng, catsGas])

  function open(r?: Regla) {
    if (r) {
      setEditing(r)
      setFPatron(r.patron)
      setFAsigna(r.asigna_como)
      setFCodigo(r.categoria_codigo ?? '')
      setFActiva(r.activa)
      setFPrioridad(r.prioridad)
    } else {
      setCreating(true)
      setFPatron(''); setFAsigna('gasto'); setFCodigo(''); setFActiva(true); setFPrioridad(0)
    }
  }
  function close() {
    setEditing(null); setCreating(false)
    setFPatron(''); setFCodigo(''); setFActiva(true); setFPrioridad(0)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload: any = {
        patron: fPatron.trim().toLowerCase(),
        asigna_como: fAsigna,
        tipo_categoria: fAsigna,
        categoria_codigo: fCodigo,
        categoria_id: null,
        activa: fActiva,
        prioridad: fPrioridad,
      }
      const q = editing
        ? supabase.from('reglas_conciliacion').update(payload).eq('id', editing.id)
        : supabase.from('reglas_conciliacion').upsert(payload, { onConflict: 'patron' })
      const { error } = await q; if (error) throw error
      await refetch(); close()
    } catch (e: any) { setError(e?.message ?? 'Error') } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!editing) return
    if (!confirm(`Eliminar regla "${editing.patron}"?`)) return
    const { error } = await supabase.from('reglas_conciliacion').delete().eq('id', editing.id)
    if (error) { setError(error.message); return }
    await refetch(); close()
  }

  async function toggleActiva(r: Regla) {
    const { error } = await supabase.from('reglas_conciliacion').update({ activa: !r.activa }).eq('id', r.id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  if (loading) return <div style={{ padding: 24, color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
  if (error) {
    return (
      <div style={{ padding: 16, background: '#B01D2320', color: '#B01D23', borderRadius: 10, fontFamily: FONT.body }}>
        {error}
      </div>
    )
  }

  const th: CSSProperties = {
    padding: '10px 14px',
    fontFamily: FONT.heading,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '2px',
    color: T.mut,
    fontWeight: 400,
    background: T.group,
    textAlign: 'left',
  }
  const td: CSSProperties = { padding: '10px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri }

  const washBg     = isDark ? 'rgba(186,117,23,0.18)'  : '#FAEEDA'
  const washBrd    = isDark ? 'rgba(250,199,117,0.28)' : '#FAC775'
  const washTxt    = isDark ? '#FAC775'                 : '#412402'
  const washSub    = isDark ? '#F5C36B'                 : '#854F0B'
  const codeBg     = isDark ? 'rgba(255,255,255,0.06)' : '#ffffff'
  const codeBrd    = isDark ? 'rgba(250,199,117,0.22)' : '#E9D9A6'

  return (
    <>
      <ConfigGroupCard title="Reglas de asignación automática" subtitle={`${reglas.length} reglas`}>
        <div
          style={{
            margin: '0 22px 14px',
            padding: 14,
            background: washBg,
            border: `1px solid ${washBrd}`,
            borderRadius: 8,
            fontSize: 12.5,
            color: washSub,
            fontFamily: FONT.body,
          }}
        >
          <strong style={{ color: washTxt }}>Cómo funcionan:</strong>{' '}
          Cada vez que categorizas un movimiento manualmente, se crea una regla con su <em>concepto normalizado</em>.
          Al importar nuevos movimientos, los conceptos similares se categorizan automáticamente. Patrones soportan
          <code style={{ background: codeBg, padding: '1px 6px', borderRadius: 3, border: `0.5px solid ${codeBrd}`, color: washTxt, marginLeft: 4 }}>*</code> y{' '}
          <code style={{ background: codeBg, padding: '1px 6px', borderRadius: 3, border: `0.5px solid ${codeBrd}`, color: washTxt }}>?</code>.
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderTop: `0.5px solid ${T.brd}`, borderBottom: `0.5px solid ${T.brd}`, background: T.group }}>
                <th style={th}>Patrón</th>
                <th style={th}>Categoría</th>
                <th style={th}>Tipo</th>
                <th style={{ ...th, textAlign: 'center', width: 80 }}>Activa</th>
                <th style={{ ...th, textAlign: 'right', width: 80 }}>Prioridad</th>
              </tr>
            </thead>
            <tbody>
              {reglas.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px 22px', textAlign: 'center' }}>
                    <Wand2 size={32} color={T.mut} style={{ marginBottom: 12 }} />
                    <div style={{ fontFamily: FONT.heading, fontSize: 13, color: T.pri, letterSpacing: '1.3px', textTransform: 'uppercase', marginBottom: 6 }}>
                      Sin reglas aún
                    </div>
                    <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, maxWidth: 400, margin: '0 auto' }}>
                      Categoriza un movimiento en Conciliación y se creará la primera regla automáticamente.
                    </div>
                  </td>
                </tr>
              ) : reglas.map(r => (
                <tr key={r.id} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                  <td
                    onClick={() => open(r)}
                    style={{ ...td, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, cursor: 'pointer' }}
                  >{r.patron}</td>
                  <td onClick={() => open(r)} style={{ ...td, cursor: 'pointer' }}>
                    {r.categoria_codigo ? (
                      <>
                        <span style={{ fontFamily: FONT.heading, fontSize: 11, color: T.sec, marginRight: 8, letterSpacing: 0.5 }}>{r.categoria_codigo}</span>
                        <span>{nombrePorCodigo[r.categoria_codigo] ?? '—'}</span>
                      </>
                    ) : '—'}
                  </td>
                  <td onClick={() => open(r)} style={{ ...td, textTransform: 'capitalize', color: T.sec, cursor: 'pointer' }}>{r.asigna_como}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={r.activa}
                      onChange={() => toggleActiva(r)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td onClick={() => open(r)} style={{ ...td, textAlign: 'right', cursor: 'pointer', color: T.sec }}>{r.prioridad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '14px 22px 18px',
            borderTop: `0.5px solid ${T.brd}`,
            background: T.bg,
          }}
        >
          <button
            onClick={() => open()}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: 'none',
              background: '#B01D23',
              color: '#ffffff',
              fontFamily: FONT.heading,
              fontSize: 11,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >+ Nueva regla</button>
        </div>
      </ConfigGroupCard>

      {(editing || creating) && (
        <EditModal
          title={editing ? 'Editar regla' : 'Nueva regla'}
          onSave={handleSave} onCancel={close}
          onDelete={editing ? handleDelete : undefined}
          saving={saving} canSave={!!fPatron.trim() && !!fCodigo}
        >
          <Field label="Patrón (lowercase, * y ? como wildcards)">
            <input
              value={fPatron}
              onChange={(e) => setFPatron(e.target.value)}
              placeholder="lidl"
              autoFocus
              className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--sl-border-focus)]"
            />
          </Field>
          <Field label="Asignar como">
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={fAsigna === 'ingreso'} onChange={() => { setFAsigna('ingreso'); setFCodigo('') }} /> Ingreso
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={fAsigna === 'gasto'} onChange={() => { setFAsigna('gasto'); setFCodigo('') }} /> Gasto
              </label>
            </div>
          </Field>
          <Field label="Categoría">
            <select
              value={fCodigo}
              onChange={(e) => setFCodigo(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm bg-[var(--sl-card)] focus:outline-none focus:border-[var(--sl-border-focus)]"
            >
              <option value="">—</option>
              {fAsigna === 'ingreso'
                ? catsIng.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)
                : gastosPorGrupo.map(g => (
                    <Fragment key={g.grupo}>
                      <optgroup label={g.grupo}>
                        {g.items.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)}
                      </optgroup>
                    </Fragment>
                  ))
              }
            </select>
          </Field>
          <Field label="Activa">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={fActiva} onChange={(e) => setFActiva(e.target.checked)} /> La regla está activa
            </label>
          </Field>
          <Field label="Prioridad (mayor = aplicada antes)">
            <input
              type="number"
              value={fPrioridad}
              onChange={(e) => setFPrioridad(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--sl-border-focus)]"
            />
          </Field>
        </EditModal>
      )}
    </>
  )
}
