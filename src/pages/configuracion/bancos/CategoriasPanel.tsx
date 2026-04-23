import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'

interface CatIngreso {
  id: string
  codigo: string
  nombre: string
  canal_abv: string | null
  orden: number
}

interface CatGasto {
  id: string
  codigo: string
  nombre: string
  grupo: string | null
  tipo: string | null
  orden: number
}

type TipoGasto = 'fijo' | 'var' | 'pers' | 'mkt'
type GrupoGasto = 'PRODUCTO' | 'RRHH' | 'ALQUILER' | 'CONTROLABLES'

const TIPO_OPCIONES: { value: TipoGasto; label: string }[] = [
  { value: 'fijo', label: 'Fijo' },
  { value: 'var',  label: 'Variable' },
  { value: 'pers', label: 'Personal' },
  { value: 'mkt',  label: 'Marketing' },
]
const GRUPO_OPCIONES: GrupoGasto[] = ['PRODUCTO', 'RRHH', 'ALQUILER', 'CONTROLABLES']

type ModalForm = {
  open: boolean
  tipoFila: 'ingreso' | 'gasto'
  codigo: string
  nombre: string
  grupo: GrupoGasto | ''
  tipoGasto: TipoGasto | ''
  canal_abv: string
}

const EMPTY_FORM: ModalForm = {
  open: false,
  tipoFila: 'gasto',
  codigo: '',
  nombre: '',
  grupo: '',
  tipoGasto: '',
  canal_abv: '',
}

export default function CategoriasPanel() {
  const { T, isDark } = useTheme()
  const [ingresos, setIngresos] = useState<CatIngreso[]>([])
  const [gastos, setGastos] = useState<CatGasto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<ModalForm>(EMPTY_FORM)

  async function refetch() {
    const [ing, gas] = await Promise.all([
      supabase.from('categorias_contables_ingresos').select('id, codigo, nombre, canal_abv, orden').order('orden'),
      supabase.from('categorias_contables_gastos').select('id, codigo, nombre, grupo, tipo, orden').order('grupo').order('codigo'),
    ])
    if (ing.error) throw ing.error
    if (gas.error) throw gas.error
    setIngresos((ing.data ?? []) as CatIngreso[])
    setGastos((gas.data ?? []) as CatGasto[])
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
    gastos.forEach(g => {
      const k = g.grupo ?? 'OTROS'
      ;(m[k] = m[k] || []).push(g)
    })
    return Object.keys(m).sort().map(grupo => ({ grupo, items: m[grupo] }))
  }, [gastos])


  /* ────────── EDIT INLINE ────────── */
  async function patchIngreso(id: string, campo: keyof CatIngreso, value: any) {
    const { error } = await supabase.from('categorias_contables_ingresos').update({ [campo]: value }).eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function patchGasto(id: string, campo: keyof CatGasto, value: any) {
    const { error } = await supabase.from('categorias_contables_gastos').update({ [campo]: value }).eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  /* ────────── DELETE con check de uso ────────── */
  async function eliminarConCheck(tabla: 'categorias_contables_ingresos' | 'categorias_contables_gastos', id: string, codigo: string, nombre: string) {
    const [usoGastos, usoConc] = await Promise.all([
      supabase.from('gastos').select('id', { count: 'exact', head: true }).eq('categoria', codigo),
      supabase.from('conciliacion').select('id', { count: 'exact', head: true }).eq('categoria', codigo),
    ])
    const total = (usoGastos.count ?? 0) + (usoConc.count ?? 0)
    if (total > 0) {
      alert(`No se puede eliminar "${nombre}": está en uso en ${total} registro(s) (gastos/conciliación). Recategoriza primero.`)
      return
    }
    if (!confirm(`Eliminar "${nombre}" (${codigo})?`)) return
    const { error } = await supabase.from(tabla).delete().eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  /* ────────── ADD nuevo ────────── */
  async function añadir() {
    const codigo = form.codigo.trim().toUpperCase()
    const nombre = form.nombre.trim()
    if (!codigo || !nombre) {
      alert('Código y nombre son obligatorios.')
      return
    }
    if (form.tipoFila === 'gasto') {
      if (!form.grupo) { alert('Grupo es obligatorio para gastos.'); return }
      if (!form.tipoGasto) { alert('Tipo (fijo/var/pers/mkt) es obligatorio para gastos.'); return }
      const maxOrden = gastos.filter(g => g.grupo === form.grupo).reduce((m, g) => Math.max(m, g.orden ?? 0), 0)
      const { error } = await supabase.from('categorias_contables_gastos').insert({
        codigo, nombre, grupo: form.grupo, tipo: form.tipoGasto, orden: maxOrden + 10,
      })
      if (error) { mostrarErrorSupabase(error.message); return }
    } else {
      const maxOrden = ingresos.reduce((m, c) => Math.max(m, c.orden ?? 0), 0)
      const { error } = await supabase.from('categorias_contables_ingresos').insert({
        codigo, nombre, canal_abv: form.canal_abv.trim() || null, orden: maxOrden + 10,
      })
      if (error) { mostrarErrorSupabase(error.message); return }
    }
    setForm(EMPTY_FORM)
    await refetch()
  }

  function mostrarErrorSupabase(msg: string) {
    if (msg.includes('categorias_contables_gastos_tipo_check')) {
      alert('Tipo no válido. Debe ser uno de: fijo, var, pers, mkt.')
    } else if (msg.includes('duplicate key') && msg.includes('codigo')) {
      alert('Ya existe una categoría con ese código.')
    } else if (msg.includes('check constraint')) {
      alert(`Restricción de BD violada: ${msg}`)
    } else {
      setError(msg)
    }
  }

  if (loading) return <div style={{ padding: 24, color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
  if (error) {
    return (
      <div style={{ padding: 16, background: '#B01D2320', color: '#B01D23', borderRadius: 10, fontFamily: FONT.body }}>
        {error}
      </div>
    )
  }

  /* ────────── STYLES ────────── */
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
    padding: '10px 16px',
    fontFamily: FONT.body,
    fontSize: 13,
    color: T.pri,
  }
  const groupHeaderColorIng = isDark ? '#5DCAA5' : '#3B6D11'
  const groupHeaderColorGas = isDark ? '#F09595' : '#A32D2D'
  const groupRowBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'

  const totalCats = ingresos.length + gastos.length

  function GroupHeader({ label, count, accent }: { label: string; count: number; accent: string }) {
    return (
      <tr style={{ background: groupRowBg }}>
        <td colSpan={4} style={{
          padding: '10px 16px',
          fontFamily: FONT.heading,
          fontSize: 11,
          letterSpacing: '1.3px',
          textTransform: 'uppercase',
          color: accent,
          fontWeight: 600,
          borderBottom: `0.5px solid ${T.brd}`,
        }}>
          {label} · {count}
        </td>
      </tr>
    )
  }

  const codigoTd: CSSProperties = {
    ...td,
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: '0.5px',
    color: T.sec,
    width: 120,
  }

  const eliminarBtn = (onClick: () => void): CSSProperties => ({
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
  } as CSSProperties)

  return (
    <ConfigGroupCard title="Categorías de conciliación" subtitle={`${totalCats}`}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Código</th>
              <th style={th}>Nombre</th>
              <th style={{ ...th, textAlign: 'center', width: 90 }}>Orden</th>
              <th style={{ ...th, textAlign: 'right', width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {/* INGRESOS */}
            {ingresos.length > 0 && (
              <>
                <GroupHeader label="INGRESOS" count={ingresos.length} accent={groupHeaderColorIng} />
                {ingresos.map(c => (
                  <tr key={c.id} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                    <td style={codigoTd}>
                      <InlineEdit value={c.codigo} type="text" onSubmit={v => patchIngreso(c.id, 'codigo', String(v).toUpperCase())} />
                    </td>
                    <td style={{ ...td, fontWeight: 600 }}>
                      <InlineEdit value={c.nombre} type="text" onSubmit={v => patchIngreso(c.id, 'nombre', String(v))} />
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <InlineEdit value={c.orden} type="number" align="right" onSubmit={v => patchIngreso(c.id, 'orden', Number(v))} />
                    </td>
                    <td style={{ ...td, textAlign: 'right', paddingRight: 20 }}>
                      <button
                        onClick={() => eliminarConCheck('categorias_contables_ingresos', c.id, c.codigo, c.nombre)}
                        style={eliminarBtn(() => {})}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#B01D23')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = T.mut)}
                      >Eliminar</button>
                    </td>
                  </tr>
                ))}
              </>
            )}

            {/* GASTOS por grupo */}
            {gastosPorGrupo.map(({ grupo, items }) => (
              <Fragment key={grupo}>
                <GroupHeader label={`GASTOS · ${grupo}`} count={items.length} accent={groupHeaderColorGas} />
                {items.map(c => (
                  <tr key={c.id} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                    <td style={codigoTd}>
                      <InlineEdit value={c.codigo} type="text" onSubmit={v => patchGasto(c.id, 'codigo', String(v).toUpperCase())} />
                    </td>
                    <td style={{ ...td, fontWeight: 600 }}>
                      <InlineEdit value={c.nombre} type="text" onSubmit={v => patchGasto(c.id, 'nombre', String(v))} />
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <InlineEdit value={c.orden} type="number" align="right" onSubmit={v => patchGasto(c.id, 'orden', Number(v))} />
                    </td>
                    <td style={{ ...td, textAlign: 'right', paddingRight: 20 }}>
                      <button
                        onClick={() => eliminarConCheck('categorias_contables_gastos', c.id, c.codigo, c.nombre)}
                        style={eliminarBtn(() => {})}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#B01D23')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = T.mut)}
                      >Eliminar</button>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Botón añadir */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        padding: '14px 22px 18px',
        borderTop: `0.5px solid ${T.brd}`,
        background: T.bg,
      }}>
        <button
          onClick={() => setForm({ ...EMPTY_FORM, open: true })}
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
        >+ Añadir categoría</button>
      </div>

      {/* Modal añadir */}
      {form.open && (
        <div
          onClick={() => setForm(EMPTY_FORM)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: T.card, border: `1px solid ${T.brd}`, borderRadius: 14,
              padding: 24, minWidth: 380, maxWidth: 460, color: T.pri, fontFamily: FONT.body,
            }}
          >
            <div style={{
              fontFamily: FONT.heading, fontSize: 14, fontWeight: 600,
              letterSpacing: 1, textTransform: 'uppercase', color: '#B01D23', marginBottom: 18,
            }}>
              Nueva categoría
            </div>

            <Field label="Tipo">
              <div style={{ display: 'flex', gap: 8 }}>
                {(['ingreso', 'gasto'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, tipoFila: t, grupo: '', tipoGasto: '' }))}
                    style={{
                      padding: '6px 14px', borderRadius: 6, fontFamily: FONT.heading,
                      fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600,
                      cursor: 'pointer',
                      background: form.tipoFila === t ? '#B01D23' : 'transparent',
                      color: form.tipoFila === t ? '#fff' : T.mut,
                      border: form.tipoFila === t ? 'none' : `1px solid ${T.brd}`,
                    }}
                  >{t}</button>
                ))}
              </div>
            </Field>

            {form.tipoFila === 'gasto' && (
              <>
                <Field label="Grupo">
                  <select
                    value={form.grupo}
                    onChange={e => setForm(f => ({ ...f, grupo: e.target.value as GrupoGasto | '' }))}
                    style={inputStyle(T)}
                  >
                    <option value="">— Selecciona grupo —</option>
                    {GRUPO_OPCIONES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="Tipo">
                  <select
                    value={form.tipoGasto}
                    onChange={e => setForm(f => ({ ...f, tipoGasto: e.target.value as TipoGasto | '' }))}
                    style={inputStyle(T)}
                  >
                    <option value="">— Selecciona tipo —</option>
                    {TIPO_OPCIONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>
              </>
            )}

            <Field label="Código">
              <input
                value={form.codigo}
                onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                placeholder={form.tipoFila === 'gasto' ? 'PRD-XXX' : 'ING-XXX'}
                style={inputStyle(T)}
              />
            </Field>

            <Field label="Nombre">
              <input
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                style={inputStyle(T)}
              />
            </Field>

            {form.tipoFila === 'ingreso' && (
              <Field label="Canal ABV (opcional)">
                <input
                  value={form.canal_abv}
                  onChange={e => setForm(f => ({ ...f, canal_abv: e.target.value }))}
                  placeholder="UBER / GLOVO / ..."
                  style={inputStyle(T)}
                />
              </Field>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={() => setForm(EMPTY_FORM)}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: `1px solid ${T.brd}`,
                  background: 'transparent', color: T.pri, fontFamily: FONT.body, fontSize: 13, cursor: 'pointer',
                }}
              >Cancelar</button>
              <button
                onClick={añadir}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: 'none',
                  background: '#B01D23', color: '#fff', fontFamily: FONT.heading, fontSize: 12,
                  letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer',
                }}
              >Guardar</button>
            </div>
          </div>
        </div>
      )}
    </ConfigGroupCard>
  )
}

/* ────────── helpers UI ────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { T } = useTheme()
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontFamily: FONT.heading, fontSize: 10, letterSpacing: 1,
        textTransform: 'uppercase', color: T.mut, marginBottom: 5,
      }}>{label}</div>
      {children}
    </div>
  )
}

function inputStyle(T: ReturnType<typeof useTheme>['T']): CSSProperties {
  return {
    width: '100%',
    padding: '8px 12px',
    border: `1px solid ${T.brd}`,
    borderRadius: 6,
    background: T.inp,
    color: T.pri,
    fontSize: 13,
    fontFamily: FONT.body,
    outline: 'none',
    boxSizing: 'border-box',
  }
}
