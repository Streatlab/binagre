import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'

interface CatPyg {
  id: string               // ej: "2.11.1"
  nombre: string
  nivel: number            // 1, 2, 3
  parent_id: string | null
  bloque: string | null
  comportamiento: string | null
  activa: boolean
  orden: number | null
  requiere_factura: boolean
  banda_min_pct: number | null
  banda_max_pct: number | null
}

export default function CategoriasPanel() {
  const { T, isDark } = useTheme()
  const [cats, setCats] = useState<CatPyg[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    const { data, error } = await supabase
      .from('categorias_pyg')
      .select('id, nombre, nivel, parent_id, bloque, comportamiento, activa, orden, requiere_factura, banda_min_pct, banda_max_pct')
      .eq('activa', true)
      .order('orden', { ascending: true })
      .order('id', { ascending: true })
    if (error) throw error
    setCats((data ?? []) as CatPyg[])
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  /* Construir jerarquía nivel 1 → 2 → 3 */
  const arbol = useMemo(() => {
    const nivel1 = cats.filter(c => c.nivel === 1)
    return nivel1.map(n1 => {
      const hijos2 = cats.filter(c => c.nivel === 2 && c.parent_id === n1.id)
      const sueltos3 = cats.filter(c => c.nivel === 3 && c.parent_id === n1.id) // por si nivel 3 cuelga directamente de 1 (caso "3 Movimientos internos")
      return {
        n1,
        grupos: hijos2.map(n2 => ({
          n2,
          hijos: cats.filter(c => c.nivel === 3 && c.parent_id === n2.id),
        })),
        sueltos3,
      }
    })
  }, [cats])

  async function patchCat(id: string, campo: keyof CatPyg, value: any) {
    const { error } = await supabase.from('categorias_pyg').update({ [campo]: value }).eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  async function eliminarConCheck(id: string, nombre: string) {
    const { count: usoConc } = await supabase.from('conciliacion').select('id', { count: 'exact', head: true }).eq('categoria', id)
    if ((usoConc ?? 0) > 0) {
      alert(`No se puede eliminar "${nombre}" (${id}): está en uso en ${usoConc} movimiento(s) bancarios. Recategoriza primero.`)
      return
    }
    if (!confirm(`Eliminar "${nombre}" (${id})?`)) return
    const { error } = await supabase.from('categorias_pyg').update({ activa: false }).eq('id', id)
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

  /* STYLES */
  const th: CSSProperties = {
    padding: '10px 16px',
    fontFamily: FONT.heading,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '1.3px',
    color: T.mut,
    fontWeight: 500,
    background: T.bg,
    borderBottom: `1px solid ${T.brd}`,
    textAlign: 'left',
  }
  const td: CSSProperties = {
    padding: '8px 16px',
    fontFamily: FONT.body,
    fontSize: 13,
    color: T.pri,
  }
  const codigoTd: CSSProperties = {
    ...td,
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: '0.5px',
    color: T.sec,
    width: 90,
  }
  const groupRowBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
  const subGroupBg = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'
  const accentN1 = isDark ? '#F09595' : '#A32D2D'
  const accentIng = isDark ? '#5DCAA5' : '#3B6D11'

  function GroupHeaderN1({ cat }: { cat: CatPyg }) {
    const accent = cat.id === '1' ? accentIng : accentN1
    return (
      <tr style={{ background: groupRowBg }}>
        <td colSpan={5} style={{
          padding: '12px 16px',
          fontFamily: FONT.heading,
          fontSize: 12,
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          color: accent,
          fontWeight: 700,
          borderTop: `1px solid ${T.brd}`,
          borderBottom: `0.5px solid ${T.brd}`,
        }}>
          {cat.id} · {cat.nombre}
        </td>
      </tr>
    )
  }

  function GroupHeaderN2({ cat }: { cat: CatPyg }) {
    return (
      <tr style={{ background: subGroupBg }}>
        <td colSpan={5} style={{
          padding: '8px 16px 8px 32px',
          fontFamily: FONT.heading,
          fontSize: 10,
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
          color: T.mut,
          fontWeight: 600,
        }}>
          {cat.id} · {cat.nombre}
        </td>
      </tr>
    )
  }

  function FilaN3({ c }: { c: CatPyg }) {
    return (
      <tr style={{ borderBottom: `0.5px solid ${T.brd}` }}>
        <td style={codigoTd}>{c.id}</td>
        <td style={{ ...td, fontWeight: 500 }}>
          <InlineEdit value={c.nombre} type="text" onSubmit={v => patchCat(c.id, 'nombre', String(v))} />
        </td>
        <td style={{ ...td, textAlign: 'center', width: 130 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: c.requiere_factura ? T.pri : T.mut }}>
            <input
              type="checkbox"
              checked={c.requiere_factura}
              onChange={e => patchCat(c.id, 'requiere_factura', e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            {c.requiere_factura ? 'Sí' : 'No'}
          </label>
        </td>
        <td style={{ ...td, textAlign: 'center', width: 80 }}>
          <InlineEdit value={c.orden ?? 0} type="number" align="right" onSubmit={v => patchCat(c.id, 'orden', Number(v))} />
        </td>
        <td style={{ ...td, textAlign: 'right', paddingRight: 20, width: 90 }}>
          <button
            onClick={() => eliminarConCheck(c.id, c.nombre)}
            style={{
              background: 'transparent', border: 'none', color: T.mut,
              fontSize: 11, cursor: 'pointer', fontFamily: FONT.heading,
              letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, padding: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#B01D23')}
            onMouseLeave={(e) => (e.currentTarget.style.color = T.mut)}
          >Eliminar</button>
        </td>
      </tr>
    )
  }

  const totalActivas = cats.length

  return (
    <ConfigGroupCard title="Categorías P&G" subtitle={`${totalActivas} categorías`}>
      <div
        style={{
          margin: '0 22px 14px',
          padding: 14,
          background: isDark ? 'rgba(186,117,23,0.18)' : '#FAEEDA',
          border: `1px solid ${isDark ? 'rgba(250,199,117,0.28)' : '#FAC775'}`,
          borderRadius: 8,
          fontSize: 12.5,
          color: isDark ? '#F5C36B' : '#854F0B',
          fontFamily: FONT.body,
        }}
      >
        <strong style={{ color: isDark ? '#FAC775' : '#412402' }}>Categorías canónicas P&amp;G.</strong>{' '}
        Estas son las únicas categorías válidas para conciliación, gastos, presupuestos y P&amp;G. La columna
        <em> Requiere factura</em> determina si un movimiento bancario necesita factura adjunta para considerarse conciliado.
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Código</th>
              <th style={th}>Nombre</th>
              <th style={{ ...th, textAlign: 'center' }}>Requiere factura</th>
              <th style={{ ...th, textAlign: 'center' }}>Orden</th>
              <th style={{ ...th, textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {arbol.map(({ n1, grupos, sueltos3 }) => (
              <Fragment key={n1.id}>
                <GroupHeaderN1 cat={n1} />
                {grupos.map(({ n2, hijos }) => (
                  <Fragment key={n2.id}>
                    {grupos.length > 1 || (grupos.length === 1 && hijos.length > 0) ? <GroupHeaderN2 cat={n2} /> : null}
                    {hijos.map(c => <FilaN3 key={c.id} c={c} />)}
                  </Fragment>
                ))}
                {sueltos3.map(c => <FilaN3 key={c.id} c={c} />)}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </ConfigGroupCard>
  )
}