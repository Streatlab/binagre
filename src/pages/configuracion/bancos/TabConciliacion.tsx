import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useIsDark } from '@/hooks/useIsDark'
import { BigCard } from '@/components/configuracion/BigCard'
import { AbvBadge } from '@/components/configuracion/AbvBadge'
import { Table, THead, TBody, TH, TR, TD } from '@/components/configuracion/ConfigTable'
import { ConfigModal, ConfigField, useInputStyle, ModalActions } from '@/components/configuracion/ConfigModal'

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
    borderRadius: 6,
    background: active ? (isDark ? '#2a2600' : '#FFF3B8') : (isDark ? '#1e1e1e' : '#ffffff'),
    border: `1px solid ${active ? (isDark ? '#4a4000' : '#E8D066') : (isDark ? '#2a2a2a' : '#E9E1D0')}`,
    color: active ? (isDark ? '#e8f442' : '#5a4d0a') : (isDark ? '#cccccc' : '#555555'),
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    fontFamily: 'Oswald, sans-serif',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  })

  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button type="button" style={subPillStyle(pill === 'categorias')} onClick={() => setPill('categorias')}>
          Categorías
        </button>
        <button type="button" style={subPillStyle(pill === 'reglas')} onClick={() => setPill('reglas')}>
          Reglas automáticas
        </button>
      </div>

      {pill === 'categorias' ? <PanelCategorias /> : <PanelReglas />}
    </>
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

  const mut = isDark ? '#777' : '#9E9588'
  const actionColor = '#B01D23'

  if (loading) return <div style={{ padding: 24, color: mut }}>Cargando categorías…</div>
  if (error) {
    return (
      <div style={{ padding: 16, background: isDark ? '#3a1a1a' : '#FCE0E2', color: isDark ? '#ff8080' : '#B01D23', borderRadius: 12 }}>
        {error}
      </div>
    )
  }

  const ingresos = cats.filter(c => BLOQUE_DE(c.id) === 'ingreso')
  const gastos = cats.filter(c => BLOQUE_DE(c.id) === 'gasto')
  const otros = cats.filter(c => BLOQUE_DE(c.id) === 'interno' || BLOQUE_DE(c.id) === 'financiacion')

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

  return (
    <>
      <div style={{ display: 'grid', gap: 14 }}>
        <BigCard title="Ingresos" count={`${ingresos.length} categorías`}>
          <Tabla lista={ingresos} />
        </BigCard>

        <BigCard title="Gastos" count={`${gastos.length} categorías`}>
          <Tabla lista={gastos} />
        </BigCard>

        <BigCard title="Movimientos internos y financiación" count={`${otros.length} categorías`}>
          <Tabla lista={otros} />
        </BigCard>

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
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    background: isDark ? '#2a2600' : '#FFF3B8',
    color: isDark ? '#e8f442' : '#5a4d0a',
    border: `1px solid ${isDark ? '#4a4000' : '#E8D066'}`,
    cursor: 'pointer',
    fontFamily: 'Oswald, sans-serif',
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
        <input type="checkbox" checked={valor} onChange={e => set(e.target.checked)} style={{ accentColor: '#B01D23' }} />
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
        <div style={{ marginTop: 12, padding: 8, background: '#FCE0E2', color: '#B01D23', fontSize: 12, borderRadius: 6 }}>
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

  const mut = isDark ? '#777' : '#9E9588'
  const subtle = isDark ? '#aaa' : '#6E6656'

  if (loading) return <div style={{ padding: 24, color: mut }}>Cargando reglas…</div>
  if (error) {
    return (
      <div style={{ padding: 16, background: isDark ? '#3a1a1a' : '#FCE0E2', color: isDark ? '#ff8080' : '#B01D23', borderRadius: 12 }}>
        {error}
      </div>
    )
  }

  const nombreCat = (codigo: string | null): string => {
    if (!codigo) return '—'
    const c = cats.find(x => x.id === codigo)
    return c ? `${c.id} · ${c.nombre}` : codigo
  }

  return (
    <>
      <BigCard title="Reglas de asignación automática" count={`${reglas.length} reglas`}>
        <p style={{ fontSize: 12.5, color: subtle, marginBottom: 16, fontFamily: 'Lexend, sans-serif' }}>
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
                    <input type="checkbox" checked={r.activa} onChange={() => handleToggle(r)} style={{ accentColor: '#B01D23', cursor: 'pointer' }} />
                  </TD>
                  <TD num>
                    <button onClick={() => { setEditing(r); setModalOpen(true) }} style={actionBtn('#B01D23')}>Editar</button>
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
      </BigCard>
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
          <input type="checkbox" checked={activa} onChange={e => setActiva(e.target.checked)} style={{ accentColor: '#B01D23' }} />
          <span>Aplicar esta regla a los movimientos nuevos</span>
        </label>
      </ConfigField>
      {error && (
        <div style={{ marginTop: 12, padding: 8, background: '#FCE0E2', color: '#B01D23', fontSize: 12, borderRadius: 6 }}>
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
