/**
 * EditorListaConfigJson.tsx — CRUD genérico para una lista de valores guardada como JSON
 * en `configuracion.valor` bajo una clave dada (Tanda C). Mismo patrón visual que
 * EditorCategoriasIngredientes/TabCostes, pero para claves clave-valor simples sin tabla
 * propia — la fuente que de verdad lee useConfig.ts (categorias, unidades, unidades_std,
 * unidades_min, formatos, categorias_recetas, categorias_eps...). Escribe SIEMPRE en la
 * clave que ya consumen los modales de Escandallo: nunca crea una tabla nueva desconectada.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import ConfigGroupCard from './ConfigGroupCard'
import { InlineEdit } from './InlineEdit'
import { GRANATE, LIMA } from '@/styles/neobrutal'
import { BOTON_ANADIR_TXT } from '@/styles/palettes'

interface Props {
  /** Clave en configuracion.clave cuyo valor es un JSON array de strings. */
  clave: string
  titulo: string
  placeholder?: string
}

export default function EditorListaConfigJson({ clave, titulo, placeholder = 'Nuevo valor...' }: Props) {
  const { T } = useTheme()
  const [items, setItems] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState('')

  async function refetch() {
    const { data, error } = await supabase.from('configuracion').select('valor').eq('clave', clave).maybeSingle()
    if (error) throw error
    if (data?.valor) {
      try {
        const arr = JSON.parse(data.valor)
        setItems(Array.isArray(arr) ? arr.map(String) : [])
      } catch { setItems([]) }
    } else {
      setItems([])
    }
  }

  useEffect(() => {
    setLoading(true)
    ;(async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  async function guardar(next: string[]) {
    const { error } = await supabase.from('configuracion').upsert({ clave, valor: JSON.stringify(next) }, { onConflict: 'clave' })
    if (error) { setError(error.message); return }
    setError(null)
    setItems(next)
  }

  async function crear(v: string) {
    const trimmed = v.trim()
    if (!trimmed || items.includes(trimmed)) return
    await guardar([...items, trimmed])
  }
  async function renombrar(idx: number, v: string) {
    const trimmed = v.trim()
    if (!trimmed) return
    const next = [...items]; next[idx] = trimmed
    await guardar(next)
  }
  async function eliminar(idx: number) {
    if (!confirm('¿Eliminar este valor?')) return
    await guardar(items.filter((_, i) => i !== idx))
  }
  async function mover(idx: number, dir: -1 | 1) {
    const j = idx + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    await guardar(next)
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

  return (
    <ConfigGroupCard title={titulo} subtitle={`${items.length}`}>
      {error && (
        <div style={{ margin: '0 22px 10px', padding: '8px 12px', background: GRANATE + '20', color: GRANATE, borderRadius: 8, fontFamily: FONT.body, fontSize: 12.5 }}>
          {error}
        </div>
      )}
      <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
        <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderTop: `0.5px solid ${T.brd}`, borderBottom: `0.5px solid ${T.brd}`, background: T.group }}>
              <th style={{ ...th, width: 46 }} />
              <th style={th}>Valor</th>
              <th style={{ ...th, textAlign: 'right', width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: '32px 22px', textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>
                  Sin valores.
                </td>
              </tr>
            ) : items.map((v, idx) => (
              <tr key={idx} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                <td style={{ ...td, padding: '4px 8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <button
                      onClick={() => mover(idx, -1)}
                      disabled={idx === 0}
                      style={{ background: 'transparent', border: 'none', color: idx === 0 ? T.brd : T.mut, cursor: idx === 0 ? 'default' : 'pointer', fontSize: 10, lineHeight: 1, padding: '2px 0' }}
                    >▲</button>
                    <button
                      onClick={() => mover(idx, 1)}
                      disabled={idx === items.length - 1}
                      style={{ background: 'transparent', border: 'none', color: idx === items.length - 1 ? T.brd : T.mut, cursor: idx === items.length - 1 ? 'default' : 'pointer', fontSize: 10, lineHeight: 1, padding: '2px 0' }}
                    >▼</button>
                  </div>
                </td>
                <td style={{ ...td, fontWeight: 600 }}>
                  <InlineEdit value={v} type="text" onSubmit={(nv) => renombrar(idx, String(nv))} />
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <button
                    onClick={() => eliminar(idx)}
                    style={{ background: 'transparent', border: 'none', color: T.mut, fontSize: 11, cursor: 'pointer', fontFamily: FONT.heading, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, padding: 0 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = GRANATE)}
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
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { crear(nuevo); setNuevo('') } }}
          placeholder={placeholder}
          style={{ flex: 1, padding: '7px 12px', border: `0.5px dashed ${T.brd}`, borderRadius: 6, background: T.inp, color: T.pri, fontSize: 13, fontFamily: FONT.body, outline: 'none' }}
        />
        <button
          onClick={async () => { await crear(nuevo); setNuevo('') }}
          style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: LIMA, color: BOTON_ANADIR_TXT, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer' }}
        >+ Añadir</button>
      </div>
    </ConfigGroupCard>
  )
}
