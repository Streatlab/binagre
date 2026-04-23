import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'
import type { TipoCocina } from '@/types/configuracion'

interface TipoConCount extends TipoCocina { count_marcas: number }

export default function TabTiposCocina() {
  const { T } = useTheme()
  const [tipos, setTipos] = useState<TipoConCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState('')

  async function refetch() {
    const { data: t, error } = await supabase.from('tipos_cocina').select('*').order('orden')
    if (error) throw error
    const { data: m } = await supabase.from('marcas').select('tipo_cocina_id')
    const count = new Map<string, number>()
    for (const x of (m ?? []) as any[]) {
      if (x.tipo_cocina_id) count.set(x.tipo_cocina_id, (count.get(x.tipo_cocina_id) ?? 0) + 1)
    }
    setTipos(((t ?? []) as TipoCocina[]).map(x => ({ ...x, count_marcas: count.get(x.id) ?? 0 })))
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  async function handleAdd() {
    if (!nuevo.trim()) return
    const maxOrden = tipos.reduce((m, t) => Math.max(m, t.orden), 0)
    const { error } = await supabase.from('tipos_cocina').insert({ nombre: nuevo.trim(), orden: maxOrden + 1 })
    if (error) { setError(error.message); return }
    setNuevo(''); await refetch()
  }
  async function handleDelete(t: TipoConCount) {
    if (t.count_marcas > 0) { alert(`"${t.nombre}" usado por ${t.count_marcas} marca(s). No se puede eliminar.`); return }
    if (!confirm(`Eliminar "${t.nombre}"?`)) return
    const { error } = await supabase.from('tipos_cocina').delete().eq('id', t.id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function handleRename(t: TipoConCount, nombre: string) {
    const { error } = await supabase.from('tipos_cocina').update({ nombre }).eq('id', t.id)
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
  const td: React.CSSProperties = {
    padding: '10px 14px',
    fontFamily: FONT.body,
    fontSize: 13,
    color: T.pri,
  }

  return (
    <ConfigGroupCard title="Tipos de cocina" subtitle={`${tipos.length}`}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderTop: `0.5px solid ${T.brd}`, borderBottom: `0.5px solid ${T.brd}`, background: T.group }}>
              <th style={th}>Tipo</th>
              <th style={{ ...th, textAlign: 'right' }}>Marcas</th>
              <th style={{ ...th, textAlign: 'right', width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {tipos.map(t => (
              <tr key={t.id} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                <td style={{ ...td, fontWeight: 600 }}>
                  <InlineEdit value={t.nombre} type="text" onSubmit={(v) => handleRename(t, String(v))} />
                </td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: t.count_marcas > 0 ? T.pri : T.mut }}>
                  {t.count_marcas}
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <button
                    onClick={() => handleDelete(t)}
                    disabled={t.count_marcas > 0}
                    title={t.count_marcas > 0 ? 'Usado por marcas' : 'Eliminar'}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: t.count_marcas > 0 ? T.mut : '#B01D23',
                      fontSize: 11,
                      cursor: t.count_marcas > 0 ? 'not-allowed' : 'pointer',
                      fontFamily: FONT.heading,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      opacity: t.count_marcas > 0 ? 0.4 : 1,
                      padding: 0,
                    }}
                  >Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '14px 22px 18px',
          borderTop: `0.5px solid ${T.brd}`,
          background: T.bg,
        }}
      >
        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Nuevo tipo de cocina..."
          style={{
            flex: 1,
            padding: '7px 12px',
            border: `0.5px dashed ${T.brd}`,
            borderRadius: 6,
            background: T.inp,
            color: T.pri,
            fontSize: 13,
            fontFamily: FONT.body,
            outline: 'none',
          }}
        />
        <button
          onClick={handleAdd}
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
        >+ Añadir</button>
      </div>
    </ConfigGroupCard>
  )
}
