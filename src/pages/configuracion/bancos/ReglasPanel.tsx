import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'
import { EditModal, Field } from '@/components/configuracion/EditModal'

interface Regla {
  id: string
  patron: string
  asigna_como: 'ingreso' | 'gasto'
  categoria_id: string
}

interface Cat {
  id: string
  nombre: string
  es_ingreso: boolean
  es_gasto: boolean
}

export default function ReglasPanel() {
  const { T, isDark } = useTheme()
  const [reglas, setReglas] = useState<Regla[]>([])
  const [cats, setCats] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Regla | null>(null)
  const [creating, setCreating] = useState(false)
  const [fPatron, setFPatron] = useState('')
  const [fAsigna, setFAsigna] = useState<'ingreso' | 'gasto'>('gasto')
  const [fCat, setFCat] = useState('')
  const [saving, setSaving] = useState(false)

  async function refetch() {
    const [r, c] = await Promise.all([
      supabase.from('reglas_conciliacion').select('id, patron, asigna_como, categoria_id, tipo_categoria'),
      supabase.from('categorias_contables').select('id, nombre, es_ingreso, es_gasto').order('orden'),
    ])
    if (r.error) throw r.error
    if (c.error) throw c.error
    const mapped = (r.data ?? []).map((x: any) => ({
      id: x.id,
      patron: x.patron,
      asigna_como: (x.asigna_como ?? x.tipo_categoria) as 'ingreso' | 'gasto',
      categoria_id: x.categoria_id,
    }))
    setReglas(mapped)
    setCats((c.data ?? []) as Cat[])
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  function open(r?: Regla) {
    if (r) { setEditing(r); setFPatron(r.patron); setFAsigna(r.asigna_como); setFCat(r.categoria_id) }
    else { setCreating(true); setFPatron(''); setFAsigna('gasto'); setFCat('') }
  }
  function close() { setEditing(null); setCreating(false); setFPatron(''); setFCat('') }

  async function handleSave() {
    setSaving(true)
    try {
      const payload: any = { patron: fPatron.trim(), asigna_como: fAsigna, tipo_categoria: fAsigna, categoria_id: fCat }
      const q = editing
        ? supabase.from('reglas_conciliacion').update(payload).eq('id', editing.id)
        : supabase.from('reglas_conciliacion').insert(payload)
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

  if (loading) return <div style={{ padding: 24, color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
  if (error) {
    return (
      <div style={{ padding: 16, background: '#B01D2320', color: '#B01D23', borderRadius: 10, fontFamily: FONT.body }}>
        {error}
      </div>
    )
  }

  const catNombre = (id: string) => cats.find(c => c.id === id)?.nombre ?? '—'
  const catsFiltradas = cats.filter(c => fAsigna === 'ingreso' ? c.es_ingreso : c.es_gasto)

  const th: React.CSSProperties = {
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
  const td: React.CSSProperties = { padding: '10px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri }

  const helpBg = isDark ? 'rgba(255,255,255,0.03)' : '#FAF4E4'
  const codeBg = isDark ? 'rgba(255,255,255,0.05)' : '#ffffff'

  return (
    <>
      <ConfigGroupCard title="Reglas de asignación automática" subtitle={`${reglas.length} reglas`}>
        <div
          style={{
            margin: '0 22px 14px',
            padding: 14,
            background: helpBg,
            border: `0.5px solid ${T.brd}`,
            borderRadius: 8,
            fontSize: 12.5,
            color: T.sec,
            fontFamily: FONT.body,
          }}
        >
          <strong style={{ color: T.pri }}>Cómo usar patrones:</strong>
          <ul style={{ paddingLeft: 20, marginTop: 8, marginBottom: 0, display: 'grid', gap: 4 }}>
            <li><code style={{ background: codeBg, padding: '1px 6px', borderRadius: 3, border: `0.5px solid ${T.brd}` }}>*uber*</code> — contiene "uber"</li>
            <li><code style={{ background: codeBg, padding: '1px 6px', borderRadius: 3, border: `0.5px solid ${T.brd}` }}>glov*</code> — empieza por "glov"</li>
            <li><code style={{ background: codeBg, padding: '1px 6px', borderRadius: 3, border: `0.5px solid ${T.brd}` }}>*eats</code> — termina en "eats"</li>
            <li><code style={{ background: codeBg, padding: '1px 6px', borderRadius: 3, border: `0.5px solid ${T.brd}` }}>factura?.pdf</code> — <code>?</code> = un carácter</li>
          </ul>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderTop: `0.5px solid ${T.brd}`, borderBottom: `0.5px solid ${T.brd}`, background: T.group }}>
                <th style={th}>Si concepto contiene</th>
                <th style={th}>Asigna como</th>
                <th style={th}>Categoría</th>
              </tr>
            </thead>
            <tbody>
              {reglas.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: '32px 22px', textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>
                    Sin reglas aún. Al crear una, los movimientos que coincidan se categorizarán automáticamente.
                  </td>
                </tr>
              ) : reglas.map(r => (
                <tr key={r.id} onClick={() => open(r)} style={{ borderBottom: `0.5px solid ${T.brd}`, cursor: 'pointer' }}>
                  <td style={{ ...td, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5 }}>{r.patron}</td>
                  <td style={{ ...td, textTransform: 'capitalize', color: T.sec }}>{r.asigna_como}</td>
                  <td style={td}>{catNombre(r.categoria_id)}</td>
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
          saving={saving} canSave={!!fPatron.trim() && !!fCat}
        >
          <Field label="Patrón (wildcards * y ?)">
            <input
              value={fPatron}
              onChange={(e) => setFPatron(e.target.value)}
              placeholder="*uber*"
              autoFocus
              className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--sl-border-focus)]"
            />
          </Field>
          <Field label="Asignar como">
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={fAsigna === 'ingreso'} onChange={() => { setFAsigna('ingreso'); setFCat('') }} /> Ingreso
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={fAsigna === 'gasto'} onChange={() => { setFAsigna('gasto'); setFCat('') }} /> Gasto
              </label>
            </div>
          </Field>
          <Field label="Categoría">
            <select
              value={fCat}
              onChange={(e) => setFCat(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm bg-[var(--sl-card)] focus:outline-none focus:border-[var(--sl-border-focus)]"
            >
              <option value="">—</option>
              {catsFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Field>
        </EditModal>
      )}
    </>
  )
}
