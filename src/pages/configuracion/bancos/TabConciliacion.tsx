import { BLANCO, GRANATE, GRIS, INK, LIMA, OSW, LEX } from '@/styles/neobrutal'
import {
  CONFIG_BORDE, CONFIG_MUT, CONFIG_MUT_ALT, CONFIG_ROJO_WASH,
  CONCILIACION_ACTIVE_BG_DARK, CONCILIACION_ACTIVE_BG_LIGHT, CONCILIACION_ACTIVE_BORDE_DARK,
  CONCILIACION_ACTIVE_BORDE_LIGHT, CONCILIACION_ACTIVE_TXT_LIGHT, ROJO_WASH_BG_DARK, ROJO_TXT_DARK,
} from '@/styles/palettes'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useIsDark } from '@/hooks/useIsDark'
import { AbvBadge } from '@/components/configuracion/AbvBadge'
import { Table, THead, TBody, TH, TR, TD } from '@/components/configuracion/ConfigTable'
import { ConfigModal, ConfigField, useInputStyle, ModalActions } from '@/components/configuracion/ConfigModal'
import { PantallaCantera, HeroCantera, Papel } from '@/components/kit/cantera'

// REESCRITO 12-jul-2026 — esta pantalla estaba rota tras la unificacion de categorias:
//   1. Leia una columna `codigo` que NO EXISTE en categorias_pyg. El codigo ES el `id`
//      ('2.11.1'), asi que salia null en todas partes.
//   2. Separaba ingresos filtrando por codigos que empiezan en '7' (Plan General Contable).
//      Ninguna categoria de Streat Lab empieza por 7 (son 1.x, 2.x, 3.x, 4.x), asi que la
//      lista de INGRESOS salia SIEMPRE VACIA.
//   3. Las reglas leian y guardaban `categoria_id`, cuando la tabla usa `categoria_codigo`.
//      Resultado: la columna "Asignar categoria" salia en blanco.
//
// Ahora lee la jerarquia real: 1.x ingresos · 2.x gastos · 3.x internos · 4.x financiacion.

type SubPill = 'categorias' | 'reglas'

interface Cat {
  id: string
  nombre: string
  nivel: number
  bloque: string | null
  conciliable: boolean
  requiere_factura: boolean
  estimable: boolean
}

interface Regla {
  id: string
  patron: string
  tipo_categoria: string | null
  categoria_codigo: string | null
  set_proveedor: string | null
  prioridad: number
  activa: boolean
  notas_regla: string | null
}

const BLOQUE_DE = (id: string): 'ingreso' | 'gasto' | 'interno' | 'financiacion' => {
  if (id.startsWith('1.')) return 'ingreso'
  if (id.startsWith('3.')) return 'interno'
  if (id.startsWith('4.')) return 'financiacion'
  return 'gasto'
}

export default function TabConciliacion() {
  const isDark = useIsDark()
  const [pill, setPill] = useState<SubPill>('categorias')

  const subPillStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 14px',
    borderRadius: 0,
    background: active ? (isDark ? CONCILIACION_ACTIVE_BG_DARK : CONCILIACION_ACTIVE_BG_LIGHT) : (isDark ? INK : BLANCO),
    border: `2px solid ${active ? INK : (isDark ? INK : CONFIG_BORDE)}`,
    color: active ? (isDark ? LIMA : CONCILIACION_ACTIVE_TXT_LIGHT) : (isDark ? GRIS : GRIS),
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    fontFamily: OSW,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  })

  return (
    <PantallaCantera embedded>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" style={subPillStyle(pill === 'categorias')} onClick={() => setPill('categorias')}>
          Categorías
        </button>
        <button type="button" style={subPillStyle(pill === 'reglas')} onClick={() => setPill('reglas')}>
          Reglas automáticas
        </button>
      </div>

      {pill === 'categorias' ? <PanelCategorias /> : <PanelReglas />}
    </PantallaCantera>
  )
}

/* ═══════ PANEL CATEGORÍAS ═══════ */

function PanelCategorias() {
  const isDark = useIsDark()
  const [cats, setCats] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<{ editing: Cat | null } | null>(null)

  const refetch = async () => {
    const { data, error } = await supabase
      .from('categorias_pyg')
      .select('id, nombre, nivel, bloque, conciliable, requiere_factura, estimable')
      .eq('activa', true)
      .eq('nivel', 3)
      .order('id')
    if (error) throw error
    setCats((data ?? []) as unknown as Cat[])
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try { await refetch() }
      catch (e: any) { if (!cancelled) setError(e?.message ?? 'Error') }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  const handleDelete = async (c: Cat) => {
    if (!confirm(`¿Eliminar la categoría "${c.id} · ${c.nombre}"?\n\nSi tiene facturas o movimientos asociados, la base de datos lo impedirá.`)) return
    const { error } = await supabase.from('categorias_pyg').delete().eq('id', c.id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  const mut = isDark ? GRIS : CONFIG_MUT
  const actionColor = GRANATE

  if (loading) return <Papel ceja={GRANATE}><div style={{ padding: 20, color: mut, fontFamily: LEX }}>Cargando categorías…</div></Papel>
  if (error) {
    return (
      <Papel ceja={GRANATE}>
        <div style={{ color: isDark ? ROJO_TXT_DARK : GRANATE, fontFamily: LEX }}>{error}</div>
      </Papel>
    )
  }

  const ingresos = cats.filter(c => BLOQUE_DE(c.id) === 'ingreso')
  const gastos = cats.filter(c => BLOQUE_DE(c.id) === 'gasto')
  const otros = cats.filter(c => BLOQUE_DE(c.id) === 'interno' || BLOQUE_DE(c.id) === 'financiacion')
  const conciliables = cats.filter(c => c.conciliable).length

  const Tabla = ({ lista }: { lista: Cat[] }) => (
    <Table>
      <THead>
        <tr>
          <TH>Código</TH>
          <TH>Categoría</TH>
          <TH num>Concilia</TH>
          <TH num>Factura</TH>
          <TH num>Fijo</TH>
          <TH num>Acciones</TH>
        </tr>
      </THead>
      <TBody>
        {lista.map(c => (
          <TR key={c.id}>
            <TD><AbvBadge abv={c.id} /></TD>
            <TD bold>{c.nombre}</TD>
            <TD num muted>{c.conciliable ? 'Sí' : '—'}</TD>
            <TD num muted>{c.requiere_factura ? 'Sí' : '—'}</TD>
            <TD num muted>{c.estimable ? 'Sí' : '—'}</TD>
            <TD num>
              <button onClick={() => setModal({ editing: c })} style={actionBtn(actionColor)}>Editar</button>
              <button onClick={() => handleDelete(c)} style={actionBtn(mut, true)}>Eliminar</button>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  )

  const Bloque = ({ titulo, count, children }: { titulo: string; count: string; children: React.ReactNode }) => (
    <Papel ceja={GRANATE} pad="0" style={{ overflow: 'hidden' }}>
      <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: mut, fontWeight: 700, padding: '18px 22px 10px' }}>
        {titulo} <span style={{ color: INK, textTransform: 'none', letterSpacing: 'normal' }}>· {count}</span>
      </div>
      <div style={{ padding: '0 22px 18px', overflowX: 'auto' }}>{children}</div>
    </Papel>
  )

  return (
    <>
      <HeroCantera
        area="equipo"
        titular="Así están tus categorías de conciliación"
        etiquetaDato="Categorías que concilian con el banco"
        cifra={conciliables}
        resumen={<>{ingresos.length} de ingresos · {gastos.length} de gastos · {otros.length} internas o de financiación</>}
      />

      <div style={{ display: 'grid', gap: 14 }}>
        <Bloque titulo="Ingresos" count={`${ingresos.length} categorías`}>
          <Tabla lista={ingresos} />
        </Bloque>

        <Bloque titulo="Gastos" count={`${gastos.length} categorías`}>
          <Tabla lista={gastos} />
        </Bloque>

        <Bloque titulo="Movimientos internos y financiación" count={`${otros.length} categorías`}>
          <Tabla lista={otros} />
        </Bloque>

        <button onClick={() => setModal({ editing: null })} style={addBtn(isDark)}>
          + Nueva categoría
        </button>
      </div>

      {modal && (
        <CategoriaModal
          editing={modal.editing}
          onClose={() => setModal(null)}
          onSaved={refetch}
        />
      )}
    </>
  )
}

function actionBtn(color: string, danger = false): React.CSSProperties {
  return {
    background: 'none',
    border: 'none',
    color,
    fontSize: 11,
    cursor: 'pointer',
    marginLeft: 12,
    padding: 0,
    fontFamily: 'Oswald, sans-serif',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    fontWeight: 600,
    ...(danger ? { textDecoration: 'none' } : {}),
  }
}

function addBtn(isDark: boolean): React.CSSProperties {
  return {
    marginTop: 12,
    padding: '8px 14px',
    borderRadius: 0,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    background: isDark ? CONCILIACION_ACTIVE_BG_DARK : CONCILIACION_ACTIVE_BG_LIGHT,
    color: isDark ? LIMA : CONCILIACION_ACTIVE_TXT_LIGHT,
    border: `2px solid ${INK}`,
    boxShadow: `3px 3px 0 ${INK}`,
    cursor: 'pointer',
    fontFamily: OSW,
    width: 'fit-content',
  }
}

/* ═══════ MODAL CATEGORÍA ═══════ */

function CategoriaModal({
  editing, onClose, onSaved,
}: {
  editing: Cat | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const inputStyle = useInputStyle()
  const [id, setId] = useState(editing?.id ?? '')
  const [nombre, setNombre] = useState(editing?.nombre ?? '')
  const [conciliable, setConciliable] = useState(editing?.conciliable ?? true)
  const [requiereFactura, setRequiereFactura] = useState(editing?.requiere_factura ?? true)
  const [estimable, setEstimable] = useState(editing?.estimable ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!id.trim() || !nombre.trim()) return
    setSaving(true); setError(null)
    const codigo = id.trim()
    const partes = codigo.split('.')
    const parent = partes.length > 1 ? partes.slice(0, -1).join('.') : null

    const q = editing
      ? supabase.from('categorias_pyg')
          .update({ nombre: nombre.trim(), conciliable, requiere_factura: requiereFactura, estimable })
          .eq('id', editing.id)
      : supabase.from('categorias_pyg')
          .insert({ id: codigo, nombre: nombre.trim(), nivel: partes.length, parent_id: parent, activa: true, conciliable, requiere_factura: requiereFactura, estimable })
    const { error } = await q
    setSaving(false)
    if (error) { setError(error.message); return }
    await onSaved()
    onClose()
  }

  const check = (label: string, ayuda: string, valor: boolean, set: (v: boolean) => void) => (
    <ConfigField label={label}>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={valor} onChange={e => set(e.target.checked)} style={{ accentColor: GRANATE }} />
        <span>{ayuda}</span>
      </label>
    </ConfigField>
  )

  return (
    <ConfigModal title={`${editing ? 'Editar' : 'Nueva'} categoría`} onClose={onClose}>
      <ConfigField label="Código">
        <input
          value={id}
          onChange={e => setId(e.target.value)}
          disabled={!!editing}
          style={{ ...inputStyle, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
          placeholder="2.11.1"
        />
      </ConfigField>
      <ConfigField label="Nombre">
        <input value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} placeholder="Alimentos y bebidas" />
      </ConfigField>

      {check('Se concilia', 'Se casa 1 a 1 con una factura de gasto', conciliable, setConciliable)}
      {check('Necesita documento', 'Debe existir factura o justificante', requiereFactura, setRequiereFactura)}
      {check('Gasto fijo', 'Se repite cada mes: Running lo estima si falta', estimable, setEstimable)}

      {error && (
        <div style={{ marginTop: 12, padding: 8, background: CONFIG_ROJO_WASH, color: GRANATE, fontSize: 12, borderRadius: 0 }}>
          {error}
        </div>
      )}
      <ModalActions
        onCancel={onClose}
        onSave={handleSave}
        saving={saving}
        disabled={!id.trim() || !nombre.trim()}
      />
    </ConfigModal>
  )
}

/* ═══════ PANEL REGLAS ═══════ */

function PanelReglas() {
  const isDark = useIsDark()
  const [reglas, setReglas] = useState<Regla[]>([])
  const [cats, setCats] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Regla | null>(null)

  const refetch = async () => {
    const [r, pyg] = await Promise.all([
      supabase.from('reglas_conciliacion')
        .select('id, patron, tipo_categoria, categoria_codigo, set_proveedor, prioridad, activa, notas_regla')
        .order('prioridad', { ascending: true }),
      supabase.from('categorias_pyg')
        .select('id, nombre, nivel, bloque, conciliable, requiere_factura, estimable')
        .eq('activa', true).eq('nivel', 3).order('id'),
    ])
    if (r.error) throw r.error
    if (pyg.error) throw pyg.error
    setReglas((r.data ?? []) as unknown as Regla[])
    setCats((pyg.data ?? []) as unknown as Cat[])
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try { await refetch() }
      catch (e: any) { if (!cancelled) setError(e?.message ?? 'Error') }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  const handleDelete = async (r: Regla) => {
    if (!confirm(`¿Eliminar la regla "${r.patron}"?`)) return
    const { error } = await supabase.from('reglas_conciliacion').delete().eq('id', r.id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  const handleToggle = async (r: Regla) => {
    const { error } = await supabase.from('reglas_conciliacion').update({ activa: !r.activa }).eq('id', r.id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  const mut = isDark ? GRIS : CONFIG_MUT
  const subtle = isDark ? GRIS : CONFIG_MUT_ALT

  if (loading) return <Papel ceja={GRANATE}><div style={{ padding: 20, color: mut, fontFamily: LEX }}>Cargando reglas…</div></Papel>
  if (error) {
    return (
      <Papel ceja={GRANATE}>
        <div style={{ color: isDark ? ROJO_TXT_DARK : GRANATE, fontFamily: LEX }}>{error}</div>
      </Papel>
    )
  }

  const nombreCat = (codigo: string | null): string => {
    if (!codigo) return '—'
    const c = cats.find(x => x.id === codigo)
    return c ? `${c.id} · ${c.nombre}` : codigo
  }

  const activas = reglas.filter(r => r.activa).length

  return (
    <>
      <HeroCantera
        area="equipo"
        titular="Así asigna categoría el sistema en automático"
        etiquetaDato="Reglas activas de asignación"
        cifra={activas}
        resumen={<>{reglas.length} reglas en total · la de prioridad más baja se evalúa primero</>}
      />

      <Papel ceja={GRANATE} pad="0" style={{ overflow: 'hidden' }}>
        <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: mut, fontWeight: 700, padding: '18px 22px 0' }}>
          Reglas de asignación automática <span style={{ color: INK, textTransform: 'none', letterSpacing: 'normal' }}>· {reglas.length} reglas</span>
        </div>
        <div style={{ padding: '10px 22px 18px' }}>
        <p style={{ fontSize: 12.5, color: subtle, marginBottom: 16, fontFamily: LEX }}>
          Cuando llega un movimiento del banco, el sistema busca la primera regla activa cuyo patrón encaje con el concepto y le asigna esa categoría.
          <strong> Prioridad más baja = se evalúa antes.</strong> El patrón admite alternativas con la barra vertical: <code>emilio bbva|sueldo emilio</code>.
        </p>
        {reglas.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: mut }}>Sin reglas definidas</div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Si el concepto contiene</TH>
                <TH>Asignar categoría</TH>
                <TH>Proveedor</TH>
                <TH num>Prioridad</TH>
                <TH num>Activa</TH>
                <TH num>Acciones</TH>
              </tr>
            </THead>
            <TBody>
              {reglas.map(r => (
                <TR key={r.id}>
                  <TD style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5 }}>
                    {r.patron}
                  </TD>
                  <TD bold>{nombreCat(r.categoria_codigo)}</TD>
                  <TD muted>{r.set_proveedor ?? '—'}</TD>
                  <TD num bold>{r.prioridad}</TD>
                  <TD num>
                    <input type="checkbox" checked={r.activa} onChange={() => handleToggle(r)} style={{ accentColor: GRANATE, cursor: 'pointer' }} />
                  </TD>
                  <TD num>
                    <button onClick={() => { setEditing(r); setModalOpen(true) }} style={actionBtn(GRANATE)}>Editar</button>
                    <button onClick={() => handleDelete(r)} style={actionBtn(mut)}>Eliminar</button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <button onClick={() => { setEditing(null); setModalOpen(true) }} style={addBtn(isDark)}>
          + Nueva regla
        </button>
        </div>
      </Papel>
      {modalOpen && (
        <ReglaModal
          editing={editing}
          cats={cats}
          onClose={() => setModalOpen(false)}
          onSaved={refetch}
        />
      )}
    </>
  )
}

/* ═══════ MODAL REGLA ═══════ */

function ReglaModal({
  editing, cats, onClose, onSaved,
}: {
  editing: Regla | null
  cats: Cat[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const inputStyle = useInputStyle()
  const [patron, setPatron] = useState(editing?.patron ?? '')
  const [categoria, setCategoria] = useState(editing?.categoria_codigo ?? '')
  const [proveedor, setProveedor] = useState(editing?.set_proveedor ?? '')
  const [prioridad, setPrioridad] = useState(editing?.prioridad ?? 50)
  const [activa, setActiva] = useState(editing?.activa ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!patron.trim() || !categoria) return
    setSaving(true); setError(null)
    const esIngreso = categoria.startsWith('1.')
    const payload = {
      patron: patron.trim(),
      categoria_codigo: categoria,
      set_proveedor: proveedor.trim() || null,
      tipo_categoria: esIngreso ? 'ingreso' : 'gasto',
      asigna_como: esIngreso ? 'ingreso' : 'gasto',
      prioridad: Number(prioridad) || 50,
      activa,
      creada_por_usuario: true,
    }
    const q = editing
      ? supabase.from('reglas_conciliacion').update(payload).eq('id', editing.id)
      : supabase.from('reglas_conciliacion').insert(payload)
    const { error } = await q
    setSaving(false)
    if (error) { setError(error.message); return }
    await onSaved()
    onClose()
  }

  return (
    <ConfigModal title={`${editing ? 'Editar' : 'Nueva'} regla`} onClose={onClose}>
      <ConfigField label="Si el concepto del banco contiene">
        <input
          value={patron}
          onChange={e => setPatron(e.target.value)}
          style={{ ...inputStyle, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
          placeholder="alcampo|carrefour"
        />
      </ConfigField>
      <ConfigField label="Asignar categoría">
        <select value={categoria} onChange={e => setCategoria(e.target.value)} style={inputStyle}>
          <option value="">— selecciona —</option>
          {cats.map(c => (
            <option key={c.id} value={c.id}>{c.id} · {c.nombre}</option>
          ))}
        </select>
      </ConfigField>
      <ConfigField label="Nombre del proveedor (opcional)">
        <input value={proveedor} onChange={e => setProveedor(e.target.value)} style={inputStyle} placeholder="ALCAMPO" />
      </ConfigField>
      <ConfigField label="Prioridad (más baja = se evalúa antes)">
        <input type="number" value={prioridad} onChange={e => setPrioridad(Number(e.target.value))} style={inputStyle} />
      </ConfigField>
      <ConfigField label="Activa">
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={activa} onChange={e => setActiva(e.target.checked)} style={{ accentColor: GRANATE }} />
          <span>Aplicar esta regla a los movimientos nuevos</span>
        </label>
      </ConfigField>
      {error && (
        <div style={{ marginTop: 12, padding: 8, background: CONFIG_ROJO_WASH, color: GRANATE, fontSize: 12, borderRadius: 0 }}>
          {error}
        </div>
      )}
      <ModalActions
        onCancel={onClose}
        onSave={handleSave}
        saving={saving}
        disabled={!patron.trim() || !categoria}
      />
    </ConfigModal>
  )
}
