import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'

interface Fmt { id: string; nombre: string }
interface Rel { id: string; unidad_estandar: string; unidad_minima: string; factor: number; orden: number }

export default function TabUnidades() {
  const { T } = useTheme()
  const [formatos, setFormatos] = useState<Fmt[]>([])
  const [relaciones, setRelaciones] = useState<Rel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newFmt, setNewFmt] = useState('')
  const [newEst, setNewEst] = useState('')
  const [newMin, setNewMin] = useState('')

  async function refetch() {
    const [f, r] = await Promise.all([
      supabase.from('config_formatos').select('*').order('nombre'),
      supabase.from('unidades_relacion').select('*').order('orden'),
    ])
    if (f.error) throw f.error
    if (r.error) throw r.error
    setFormatos((f.data ?? []) as Fmt[])
    setRelaciones(((r.data ?? []) as unknown as Rel[]).map(x => ({ ...x, factor: Number(x.factor) || 1 })))
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  async function addFmt() {
    if (!newFmt.trim()) return
    const { error } = await supabase.from('config_formatos').insert({ nombre: newFmt.trim() })
    if (error) { setError(error.message); return }
    setNewFmt(''); await refetch()
  }
  async function delFmt(id: string) {
    if (!confirm('Eliminar?')) return
    const { error } = await supabase.from('config_formatos').delete().eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function renFmt(id: string, n: string) {
    const { error } = await supabase.from('config_formatos').update({ nombre: n.trim() }).eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  async function addRel() {
    if (!newEst.trim() || !newMin.trim()) return
    const maxOrden = relaciones.reduce((m, r) => Math.max(m, r.orden ?? 0), 0)
    const { error } = await supabase
      .from('unidades_relacion')
      .insert({ unidad_estandar: newEst.trim(), unidad_minima: newMin.trim(), factor: 1, orden: maxOrden + 1 })
    if (error) { setError(error.message); return }
    setNewEst(''); setNewMin(''); await refetch()
  }
  async function delRel(id: string) {
    if (!confirm('Eliminar?')) return
    const { error } = await supabase.from('unidades_relacion').delete().eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function updRel(id: string, campo: string, valor: string | number) {
    const { error } = await supabase.from('unidades_relacion').update({ [campo]: valor }).eq('id', id)
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

  const btnRojo: React.CSSProperties = {
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
  }
  const inputStyle: React.CSSProperties = {
    padding: '7px 12px',
    border: `0.5px dashed ${T.brd}`,
    borderRadius: 6,
    background: T.inp,
    color: T.pri,
    fontSize: 13,
    fontFamily: FONT.body,
    outline: 'none',
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
      {/* Formatos */}
      <ConfigGroupCard title="Formatos de compra" subtitle={`${formatos.length}`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderTop: `0.5px solid ${T.brd}`, borderBottom: `0.5px solid ${T.brd}`, background: T.group }}>
                <th style={th}>Nombre</th>
                <th style={{ ...th, textAlign: 'right', width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {formatos.length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ padding: '32px 22px', textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>
                    Sin formatos.
                  </td>
                </tr>
              ) : formatos.map(f => (
                <tr key={f.id} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                  <td style={{ ...td, fontWeight: 600 }}>
                    <InlineEdit value={f.nombre} type="text" onSubmit={(v) => renFmt(f.id, String(v))} />
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button
                      onClick={() => delFmt(f.id)}
                      style={{ background: 'transparent', border: 'none', color: T.mut, fontSize: 11, cursor: 'pointer', fontFamily: FONT.heading, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, padding: 0 }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#B01D23')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = T.mut)}
                    >Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '14px 22px 18px', borderTop: `0.5px solid ${T.brd}`, background: T.bg }}>
          <input
            value={newFmt}
            onChange={(e) => setNewFmt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFmt()}
            placeholder="Nuevo formato de compra..."
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={addFmt} style={btnRojo}>+ Añadir</button>
        </div>
      </ConfigGroupCard>

      {/* Unidades estándar y mínimas */}
      <ConfigGroupCard title="Unidades estándar y mínimas" subtitle={`${relaciones.length}`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderTop: `0.5px solid ${T.brd}`, borderBottom: `0.5px solid ${T.brd}`, background: T.group }}>
                <th style={th}>Estándar</th>
                <th style={th}>Mínima</th>
                <th style={{ ...th, textAlign: 'right', width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {relaciones.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: '32px 22px', textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>
                    Sin relaciones.
                  </td>
                </tr>
              ) : relaciones.map(r => (
                <tr key={r.id} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                  <td style={{ ...td, fontWeight: 600 }}>
                    <InlineEdit value={r.unidad_estandar} type="text" onSubmit={(v) => updRel(r.id, 'unidad_estandar', String(v))} />
                  </td>
                  <td style={{ ...td, color: T.sec }}>
                    <InlineEdit value={r.unidad_minima} type="text" onSubmit={(v) => updRel(r.id, 'unidad_minima', String(v))} />
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button
                      onClick={() => delRel(r.id)}
                      style={{ background: 'transparent', border: 'none', color: T.mut, fontSize: 11, cursor: 'pointer', fontFamily: FONT.heading, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, padding: 0 }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#B01D23')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = T.mut)}
                    >Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '14px 22px 18px', borderTop: `0.5px solid ${T.brd}`, background: T.bg }}>
          <input value={newEst} onChange={(e) => setNewEst(e.target.value)} placeholder="Estándar (ej: Kg)" style={{ ...inputStyle, flex: 1 }} />
          <input value={newMin} onChange={(e) => setNewMin(e.target.value)} placeholder="Mínima (ej: gr)" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={addRel} style={btnRojo}>+ Añadir</button>
        </div>
      </ConfigGroupCard>
    </div>
  )
}
