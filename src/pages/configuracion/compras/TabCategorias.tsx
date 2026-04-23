import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'

interface Cat { id: string; nombre: string; orden: number }

interface ListaProps {
  titulo: string
  items: Cat[]
  onAdd: (n: string) => Promise<void>
  onDel: (id: string) => Promise<void>
  onRen: (id: string, n: string) => Promise<void>
  placeholder: string
}

function Lista({ titulo, items, onAdd, onDel, onRen, placeholder }: ListaProps) {
  const { T } = useTheme()
  const [nuevo, setNuevo] = useState('')

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

  return (
    <ConfigGroupCard title={titulo} subtitle={`${items.length}`}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderTop: `0.5px solid ${T.brd}`, borderBottom: `0.5px solid ${T.brd}`, background: T.group }}>
              <th style={th}>Nombre</th>
              <th style={{ ...th, textAlign: 'right', width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={2} style={{ padding: '32px 22px', textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>
                  Sin categorías.
                </td>
              </tr>
            ) : items.map(c => (
              <tr key={c.id} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                <td style={{ ...td, fontWeight: 600 }}>
                  <InlineEdit value={c.nombre} type="text" onSubmit={(v) => onRen(c.id, String(v))} />
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <button
                    onClick={() => onDel(c.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: T.mut,
                      fontSize: 11,
                      cursor: 'pointer',
                      fontFamily: FONT.heading,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      padding: 0,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#B01D23')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = T.mut)}
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
          onKeyDown={(e) => { if (e.key === 'Enter') { onAdd(nuevo); setNuevo('') } }}
          placeholder={placeholder}
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
          onClick={async () => { await onAdd(nuevo); setNuevo('') }}
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

export default function TabCategorias() {
  const { T } = useTheme()
  const [recetas, setRecetas] = useState<Cat[]>([])
  const [ingredientes, setIngredientes] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    const [r, i] = await Promise.all([
      supabase.from('categorias_recetas').select('*').order('orden'),
      supabase.from('categorias_ingredientes_config').select('*').order('orden'),
    ])
    if (r.error) throw r.error
    if (i.error) throw i.error
    setRecetas((r.data ?? []) as Cat[])
    setIngredientes((i.data ?? []) as Cat[])
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  async function addRec(n: string) {
    if (!n.trim()) return
    const maxOrden = recetas.reduce((m, c) => Math.max(m, c.orden ?? 0), 0)
    const { error } = await supabase.from('categorias_recetas').insert({ nombre: n.trim(), orden: maxOrden + 1 })
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function delRec(id: string) {
    if (!confirm('Eliminar?')) return
    const { error } = await supabase.from('categorias_recetas').delete().eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function renRec(id: string, n: string) {
    const { error } = await supabase.from('categorias_recetas').update({ nombre: n.trim() }).eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  async function addIng(n: string) {
    if (!n.trim()) return
    const maxOrden = ingredientes.reduce((m, c) => Math.max(m, c.orden ?? 0), 0)
    const { error } = await supabase.from('categorias_ingredientes_config').insert({ nombre: n.trim(), orden: maxOrden + 1 })
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function delIng(id: string) {
    if (!confirm('Eliminar?')) return
    const { error } = await supabase.from('categorias_ingredientes_config').delete().eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function renIng(id: string, n: string) {
    const { error } = await supabase.from('categorias_ingredientes_config').update({ nombre: n.trim() }).eq('id', id)
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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
      <Lista titulo="Categorías de recetas" items={recetas} onAdd={addRec} onDel={delRec} onRen={renRec} placeholder="Nueva categoría de receta..." />
      <Lista titulo="Categorías de ingredientes" items={ingredientes} onAdd={addIng} onDel={delIng} onRen={renIng} placeholder="Nueva categoría de ingrediente..." />
    </div>
  )
}
