/**
 * EditorCategoriasIngredientes.tsx — CRUD único sobre `categorias_ingredientes`.
 *
 * Fuente ÚNICA de categorías de ingredientes (Config y Escandallo comparten
 * este mismo componente y la misma tabla). Nunca borra filas: archivar/
 * reactivar (`activa`), nunca delete — así no se pierden ingredientes que
 * apuntan a la categoría vía FK ON DELETE SET NULL.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'

export interface CategoriaIngrediente {
  id: string
  nombre: string
  orden: number
  activa: boolean
  created_at?: string
}

interface Props {
  /** Título de la tarjeta contenedora. */
  titulo?: string
}

export default function EditorCategoriasIngredientes({ titulo = 'Categorías de ingredientes' }: Props) {
  const { T } = useTheme()
  const [cats, setCats] = useState<CategoriaIngrediente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState('')

  async function refetch() {
    const { data, error } = await supabase
      .from('categorias_ingredientes')
      .select('*')
      .order('orden')
      .order('nombre')
    if (error) throw error
    setCats((data ?? []) as CategoriaIngrediente[])
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  function mensajeError(e: any, nombre: string): string {
    // 23505 = unique_violation (constraint UNIQUE sobre nombre)
    if (e?.code === '23505') return `Ya existe una categoría "${nombre}".`
    return e?.message ?? 'Error al guardar'
  }

  async function crear(n: string) {
    const trimmed = n.trim()
    if (!trimmed) return
    const maxOrden = cats.reduce((m, c) => Math.max(m, c.orden ?? 0), 0)
    const { error } = await supabase.from('categorias_ingredientes').insert({ nombre: trimmed, orden: maxOrden + 1, activa: true })
    if (error) { setError(mensajeError(error, trimmed)); return }
    setError(null)
    await refetch()
  }

  async function renombrar(id: string, n: string) {
    const trimmed = String(n).trim()
    if (!trimmed) return
    const { error } = await supabase.from('categorias_ingredientes').update({ nombre: trimmed }).eq('id', id)
    if (error) { setError(mensajeError(error, trimmed)); return }
    setError(null)
    await refetch()
  }

  async function toggleActiva(c: CategoriaIngrediente) {
    const { error } = await supabase.from('categorias_ingredientes').update({ activa: !c.activa }).eq('id', c.id)
    if (error) { setError(error.message); return }
    setError(null)
    await refetch()
  }

  async function mover(id: string, dir: -1 | 1) {
    const sorted = [...cats].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre))
    const idx = sorted.findIndex(c => c.id === id)
    const j = idx + dir
    if (idx === -1 || j < 0 || j >= sorted.length) return
    const a = sorted[idx], b = sorted[j]
    const { error: e1 } = await supabase.from('categorias_ingredientes').update({ orden: b.orden }).eq('id', a.id)
    if (e1) { setError(e1.message); return }
    const { error: e2 } = await supabase.from('categorias_ingredientes').update({ orden: a.orden }).eq('id', b.id)
    if (e2) { setError(e2.message); return }
    setError(null)
    await refetch()
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

  if (loading) return <div style={{ padding: 24, color: T.mut, fontFamily: FONT.body }}>Cargando…</div>

  const ordenados = [...cats].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre))

  return (
    <ConfigGroupCard title={titulo} subtitle={`${cats.length}`}>
      {error && (
        <div style={{ margin: '0 22px 10px', padding: '8px 12px', background: '#B01D2320', color: '#B01D23', borderRadius: 8, fontFamily: FONT.body, fontSize: 12.5 }}>
          {error}
        </div>
      )}
      <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
        <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderTop: `0.5px solid ${T.brd}`, borderBottom: `0.5px solid ${T.brd}`, background: T.group }}>
              <th style={{ ...th, width: 46 }} />
              <th style={th}>Nombre</th>
              <th style={{ ...th, width: 100 }}>Estado</th>
              <th style={{ ...th, textAlign: 'right', width: 110 }} />
            </tr>
          </thead>
          <tbody>
            {ordenados.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '32px 22px', textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>
                  Sin categorías.
                </td>
              </tr>
            ) : ordenados.map((c, idx) => (
              <tr key={c.id} style={{ borderBottom: `0.5px solid ${T.brd}`, opacity: c.activa ? 1 : 0.55 }}>
                <td style={{ ...td, padding: '4px 8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <button
                      onClick={() => mover(c.id, -1)}
                      disabled={idx === 0}
                      style={{ background: 'transparent', border: 'none', color: idx === 0 ? T.brd : T.mut, cursor: idx === 0 ? 'default' : 'pointer', fontSize: 10, lineHeight: 1, padding: '2px 0' }}
                    >▲</button>
                    <button
                      onClick={() => mover(c.id, 1)}
                      disabled={idx === ordenados.length - 1}
                      style={{ background: 'transparent', border: 'none', color: idx === ordenados.length - 1 ? T.brd : T.mut, cursor: idx === ordenados.length - 1 ? 'default' : 'pointer', fontSize: 10, lineHeight: 1, padding: '2px 0' }}
                    >▼</button>
                  </div>
                </td>
                <td style={{ ...td, fontWeight: 600 }}>
                  <InlineEdit value={c.nombre} type="text" onSubmit={(v) => renombrar(c.id, String(v))} />
                </td>
                <td style={td}>
                  <span style={{
                    fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase',
                    padding: '3px 8px', borderRadius: 6,
                    background: c.activa ? '#1D9E7520' : `${T.mut}20`,
                    color: c.activa ? '#1D9E75' : T.mut,
                  }}>
                    {c.activa ? 'Activa' : 'Archivada'}
                  </span>
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <button
                    onClick={() => toggleActiva(c)}
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
                  >{c.activa ? 'Archivar' : 'Reactivar'}</button>
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
          onKeyDown={(e) => { if (e.key === 'Enter') { crear(nuevo); setNuevo('') } }}
          placeholder="Nueva categoría de ingrediente..."
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
          onClick={async () => { await crear(nuevo); setNuevo('') }}
          style={{
            padding: '7px 14px',
            borderRadius: 6,
            border: 'none',
            background: '#e8f442',
            color: '#111111',
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
