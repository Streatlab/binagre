import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'

interface Cat {
  id: string
  nombre: string
  es_ingreso: boolean
  es_gasto: boolean
  orden: number
}

export default function CategoriasPanel() {
  const { T, isDark } = useTheme()
  const [cats, setCats] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState('')

  async function refetch() {
    const { data, error } = await supabase.from('categorias_contables').select('*').order('orden')
    if (error) throw error
    setCats((data ?? []) as Cat[])
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  async function togglePin(c: Cat, campo: 'es_ingreso' | 'es_gasto') {
    const { error } = await supabase.from('categorias_contables').update({ [campo]: !c[campo] }).eq('id', c.id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function renombrar(c: Cat, nombre: string) {
    const { error } = await supabase.from('categorias_contables').update({ nombre }).eq('id', c.id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function eliminar(c: Cat) {
    if (!confirm(`Eliminar "${c.nombre}"?`)) return
    const { error } = await supabase.from('categorias_contables').delete().eq('id', c.id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function añadir() {
    if (!nuevo.trim()) return
    const maxOrden = cats.reduce((m, c) => Math.max(m, c.orden), 0)
    const { error } = await supabase
      .from('categorias_contables')
      .insert({ nombre: nuevo.trim(), orden: maxOrden + 1, es_ingreso: true, es_gasto: false, tipo: 'ingreso' })
    if (error) { setError(error.message); return }
    setNuevo(''); await refetch()
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
    padding: '12px 16px',
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
  const td: React.CSSProperties = {
    padding: '12px 16px',
    fontFamily: FONT.body,
    fontSize: 13,
    color: T.pri,
  }

  const grupos: { label: string; items: Cat[] }[] = [
    { label: 'Ingresos',         items: cats.filter(c => c.es_ingreso && !c.es_gasto) },
    { label: 'Gastos',           items: cats.filter(c => c.es_gasto && !c.es_ingreso) },
    { label: 'Ingreso y gasto',  items: cats.filter(c => c.es_ingreso && c.es_gasto) },
    { label: 'Sin asignar',      items: cats.filter(c => !c.es_ingreso && !c.es_gasto) },
  ]

  // Colores soft-wash dark-aware
  const inColor = isDark ? '#22B573' : '#027b4b'
  const inBg = isDark ? 'rgba(34, 181, 115, 0.15)' : '#D4F0E0'
  const gaColor = isDark ? '#ff8080' : '#B01D23'
  const gaBg = isDark ? 'rgba(176, 29, 35, 0.22)' : '#FCE0E2'

  return (
    <ConfigGroupCard title="Categorías de conciliación" subtitle={`${cats.length}`}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Nombre</th>
              <th style={{ ...th, textAlign: 'center' }}>Tipo</th>
              <th style={{ ...th, textAlign: 'right', width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {grupos.flatMap(g => g.items.length === 0 ? [] : [
              (() => {
                const isIng = g.label === 'Ingresos'
                const isGas = g.label === 'Gastos'
                const color = isIng
                  ? (isDark ? '#5DCAA5' : '#3B6D11')
                  : isGas
                    ? (isDark ? '#F09595' : '#A32D2D')
                    : T.sec
                return (
                  <tr
                    key={`g-${g.label}`}
                    style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                  >
                    <td
                      colSpan={3}
                      style={{
                        padding: '10px 16px',
                        fontFamily: FONT.heading,
                        fontSize: 11,
                        letterSpacing: '1.3px',
                        textTransform: 'uppercase',
                        color,
                        fontWeight: 600,
                        borderBottom: `0.5px solid ${T.brd}`,
                      }}
                    >
                      {g.label} · {g.items.length}
                    </td>
                  </tr>
                )
              })(),
              ...g.items.map(c => (
                <tr key={c.id} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                  <td style={{ ...td, fontWeight: 600 }}>
                    <InlineEdit value={c.nombre} type="text" onSubmit={(v) => renombrar(c, String(v))} />
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        onClick={() => togglePin(c, 'es_ingreso')}
                        style={{
                          padding: '5px 14px',
                          borderRadius: 6,
                          fontFamily: FONT.heading,
                          fontSize: 10,
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: c.es_ingreso ? inBg : 'transparent',
                          color: c.es_ingreso ? inColor : T.mut,
                          border: c.es_ingreso ? 'none' : `1px dashed ${T.brd}`,
                        }}
                      >Ingreso</button>
                      <button
                        onClick={() => togglePin(c, 'es_gasto')}
                        style={{
                          padding: '5px 14px',
                          borderRadius: 6,
                          fontFamily: FONT.heading,
                          fontSize: 10,
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: c.es_gasto ? gaBg : 'transparent',
                          color: c.es_gasto ? gaColor : T.mut,
                          border: c.es_gasto ? 'none' : `1px dashed ${T.brd}`,
                        }}
                      >Gasto</button>
                    </div>
                  </td>
                  <td style={{ ...td, textAlign: 'right', paddingRight: 20 }}>
                    <button
                      onClick={() => eliminar(c)}
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
              )),
            ])}
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
          onKeyDown={(e) => e.key === 'Enter' && añadir()}
          placeholder="Nueva categoría..."
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
          onClick={añadir}
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
        >+ Nueva categoría</button>
      </div>
    </ConfigGroupCard>
  )
}
