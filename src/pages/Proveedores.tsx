import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, pageTitleStyle, FONT } from '@/styles/tokens'
import { fmtEur, fmtDate } from '@/utils/format'

/* ─── Types ─────────────────────────────────────────────── */
interface Proveedor {
  id: string
  nombre: string
  categoria: string | null
  contacto: string | null
  condiciones: string | null
  activo: boolean | null
  abv: string | null
  tipo: string | null
  tipo_proveedor: string | null
  frecuencia: string | null
  created_at: string | null
}

interface PedidoRow {
  id: string
  fecha: string | null
  estado: string | null
  total_estimado: number | null
  proveedor_abv: string | null
  proveedor_nombre: string | null
}

interface FacturaCount {
  nif_emisor: string
  count: number
  total: number
}

interface ProveedorEnriquecido extends Proveedor {
  ultimo_pedido: string | null
  total_comprado: number
  facturas_count: number
}

/* ─── Modal Detalle ─────────────────────────────────────── */
interface ModalProps {
  prov: Proveedor | null
  pedidos: PedidoRow[]
  onClose: () => void
  onSave: (p: Partial<Proveedor>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  saving: boolean
}

function ModalDetalle({ prov, pedidos, onClose, onSave, onDelete, saving }: ModalProps) {
  const { T } = useTheme()
  const isNew = !prov?.id
  const [form, setForm] = useState<Partial<Proveedor>>(prov ?? { activo: true })
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => { setForm(prov ?? { activo: true }) }, [prov])

  const inp: CSSProperties = {
    background: '#1e1e1e',
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    color: '#ffffff',
    padding: '7px 10px',
    fontSize: 13,
    fontFamily: FONT.body,
    width: '100%',
    boxSizing: 'border-box',
  }

  const lbl: CSSProperties = {
    fontFamily: 'Oswald,sans-serif',
    fontSize: 11,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: '#777777',
    marginBottom: 4,
    display: 'block',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #383838',
        borderRadius: 12,
        width: '90%',
        maxWidth: 680,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '28px 32px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <span style={{ fontFamily: 'Oswald,sans-serif', fontSize: 16, letterSpacing: '2px', textTransform: 'uppercase', color: '#ffffff' }}>
            {isNew ? 'Nuevo proveedor' : form.nombre}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#777777', cursor: 'pointer', fontSize: 20 }}
          >×</button>
        </div>

        {/* Campos */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px', marginBottom: 20 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Nombre *</label>
            <input style={inp} value={form.nombre ?? ''} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Abreviatura (ABV)</label>
            <input style={inp} value={form.abv ?? ''} onChange={e => setForm(f => ({ ...f, abv: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Categoría</label>
            <input style={inp} value={form.categoria ?? ''} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Tipo</label>
            <input style={inp} value={form.tipo ?? ''} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Tipo proveedor</label>
            <input style={inp} value={form.tipo_proveedor ?? ''} onChange={e => setForm(f => ({ ...f, tipo_proveedor: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Frecuencia</label>
            <input style={inp} value={form.frecuencia ?? ''} onChange={e => setForm(f => ({ ...f, frecuencia: e.target.value }))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Contacto</label>
            <input style={inp} value={form.contacto ?? ''} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Condiciones</label>
            <textarea
              rows={3}
              style={{ ...inp, resize: 'vertical' }}
              value={form.condiciones ?? ''}
              onChange={e => setForm(f => ({ ...f, condiciones: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={form.activo ?? true}
                onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
                style={{ accentColor: '#e8f442', width: 16, height: 16 }}
              />
              Activo
            </label>
          </div>
        </div>

        {/* Historial pedidos */}
        {!isNew && pedidos.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: '#777777', marginBottom: 10 }}>
              Historial de pedidos ({pedidos.length})
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#0a0a0a' }}>
                  {['Fecha','Estado','Total'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Total' ? 'right' : 'left', color: '#777777', fontFamily: 'Oswald,sans-serif', fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', borderBottom: '1px solid #2a2a2a' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pedidos.slice(0, 10).map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #1e1e1e' }}>
                    <td style={{ padding: '6px 10px', color: '#cccccc' }}>{fmtDate(p.fecha)}</td>
                    <td style={{ padding: '6px 10px', color: '#777777' }}>{p.estado ?? '—'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: '#cccccc' }}>{p.total_estimado != null ? fmtEur(p.total_estimado) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Acciones */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <div>
            {!isNew && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{ background: 'none', border: '1px solid #B01D23', color: '#B01D23', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontFamily: FONT.body }}
              >
                Eliminar
              </button>
            )}
            {confirmDelete && (
              <span style={{ color: '#B01D23', fontSize: 12 }}>
                ¿Seguro?{' '}
                <button onClick={() => onDelete(prov!.id)} style={{ color: '#B01D23', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}>Sí, eliminar</button>
                {' '}
                <button onClick={() => setConfirmDelete(false)} style={{ color: '#777777', background: 'none', border: 'none', cursor: 'pointer' }}>Cancelar</button>
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{ background: '#222222', border: '1px solid #383838', color: '#cccccc', borderRadius: 6, padding: '7px 16px', cursor: 'pointer', fontSize: 13, fontFamily: FONT.body }}
            >
              Cancelar
            </button>
            <button
              onClick={() => onSave(form)}
              disabled={saving || !form.nombre}
              style={{ background: '#B01D23', border: 'none', color: '#ffffff', borderRadius: 6, padding: '7px 20px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: FONT.body, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Component ────────────────────────────────────── */
export default function Proveedores() {
  const { T } = useTheme()
  const [proveedores, setProveedores] = useState<ProveedorEnriquecido[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [modalProv, setModalProv] = useState<Proveedor | null | undefined>(undefined) // undefined = closed
  const [modalPedidos, setModalPedidos] = useState<PedidoRow[]>([])
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [provRes, pedRes, facRes] = await Promise.all([
        supabase.from('proveedores').select('*').order('nombre'),
        supabase.from('pedidos_proveedor').select('id,fecha,proveedor_abv,proveedor_nombre,total_estimado,estado').order('fecha', { ascending: false }),
        supabase.from('facturas').select('nif_emisor,total').not('nif_emisor', 'is', null),
      ])

      if (provRes.error) throw provRes.error

      // Agrupar pedidos por proveedor_abv
      const pedidosPorAbv: Record<string, PedidoRow[]> = {}
      for (const p of (pedRes.data ?? [])) {
        const key = p.proveedor_abv ?? ''
        if (!pedidosPorAbv[key]) pedidosPorAbv[key] = []
        pedidosPorAbv[key].push(p as PedidoRow)
      }

      // Agrupar facturas por nif_emisor
      const facturasPorNif: Record<string, FacturaCount> = {}
      for (const f of (facRes.data ?? [])) {
        const nif = f.nif_emisor ?? ''
        if (!facturasPorNif[nif]) facturasPorNif[nif] = { nif_emisor: nif, count: 0, total: 0 }
        facturasPorNif[nif].count++
        facturasPorNif[nif].total += Number(f.total ?? 0)
      }

      const enriquecidos: ProveedorEnriquecido[] = (provRes.data as Proveedor[]).map(p => {
        const peds = pedidosPorAbv[p.abv ?? ''] ?? []
        const ultimoPedido = peds[0]?.fecha ?? null
        // total comprado = suma de facturas o pedidos
        const facCount = facturasPorNif[p.abv ?? ''] // fallback: match by abv if no NIF
        const totalComprado = facCount?.total ?? peds.reduce((a, x) => a + (x.total_estimado ?? 0), 0)
        const facturasCount = facCount?.count ?? 0
        return { ...p, ultimo_pedido: ultimoPedido, total_comprado: totalComprado, facturas_count: facturasCount }
      })

      setProveedores(enriquecidos)
    } catch (e: unknown) {
      setError((e as {message?:string})?.message ?? 'Error cargando proveedores')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function openModal(prov: Proveedor | null) {
    setModalProv(prov)
    if (prov?.abv) {
      const { data } = await supabase
        .from('pedidos_proveedor')
        .select('id,fecha,estado,total_estimado,proveedor_abv,proveedor_nombre')
        .eq('proveedor_abv', prov.abv)
        .order('fecha', { ascending: false })
        .limit(20)
      setModalPedidos((data ?? []) as PedidoRow[])
    } else {
      setModalPedidos([])
    }
  }

  async function handleSave(form: Partial<Proveedor>) {
    setSaving(true)
    try {
      if (form.id) {
        const { error } = await supabase.from('proveedores').update(form).eq('id', form.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('proveedores').insert(form)
        if (error) throw error
      }
      setModalProv(undefined)
      await cargar()
    } catch (e: unknown) {
      alert((e as {message?:string})?.message ?? 'Error guardando')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setSaving(true)
    try {
      const { error } = await supabase.from('proveedores').delete().eq('id', id)
      if (error) throw error
      setModalProv(undefined)
      await cargar()
    } catch (e: unknown) {
      alert((e as {message?:string})?.message ?? 'Error eliminando')
    } finally {
      setSaving(false)
    }
  }

  const filtrados = proveedores.filter(p => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      (p.nombre ?? '').toLowerCase().includes(q) ||
      (p.abv ?? '').toLowerCase().includes(q) ||
      (p.categoria ?? '').toLowerCase().includes(q) ||
      (p.contacto ?? '').toLowerCase().includes(q)
    )
  })

  /* ── Estilos ── */
  const th: CSSProperties = {
    padding: '8px 14px',
    textAlign: 'left',
    fontFamily: 'Oswald,sans-serif',
    fontSize: 11,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: '#777777',
    background: '#0a0a0a',
    borderBottom: '1px solid #2a2a2a',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ padding: 28, fontFamily: FONT.body, background: '#111111', minHeight: '100vh' }}>
      <h1 style={pageTitleStyle(T)}>Proveedores</h1>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          placeholder="Buscar por nombre, ABV, categoría…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{
            background: '#1e1e1e',
            border: '1px solid #2a2a2a',
            borderRadius: 8,
            color: '#ffffff',
            padding: '8px 14px',
            fontSize: 13,
            fontFamily: FONT.body,
            width: 320,
          }}
        />
        <span style={{ color: '#777777', fontSize: 12 }}>{filtrados.length} proveedores</span>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => openModal(null)}
            style={{
              background: '#e8f442',
              border: 'none',
              color: '#111111',
              borderRadius: 7,
              padding: '8px 18px',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'Oswald,sans-serif',
              letterSpacing: '1px',
              fontWeight: 600,
            }}
          >
            + AÑADIR PROVEEDOR
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: '#ffaaaa', backgroundColor: '#2d1515', border: '1px solid #aa3030', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ color: '#777777', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Cargando proveedores…</div>
      )}

      {!loading && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>Nombre / ABV</th>
                <th style={th}>Categoría</th>
                <th style={th}>Tipo</th>
                <th style={th}>Frecuencia</th>
                <th style={th}>Último pedido</th>
                <th style={{ ...th, textAlign: 'right' }}>Total compras</th>
                <th style={{ ...th, textAlign: 'center' }}>Facturas OCR</th>
                <th style={{ ...th, textAlign: 'center' }}>Estado</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#777777' }}>
                    {busqueda ? 'Sin resultados para la búsqueda' : 'Sin proveedores registrados'}
                  </td>
                </tr>
              )}
              {filtrados.map((p, i) => (
                <tr
                  key={p.id}
                  style={{
                    background: i % 2 === 0 ? 'transparent' : '#141414',
                    borderBottom: '1px solid #1e1e1e',
                    cursor: 'pointer',
                  }}
                  onClick={() => openModal(p)}
                >
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ color: '#ffffff', fontWeight: 500 }}>{p.nombre}</div>
                    {p.abv && <div style={{ color: '#777777', fontSize: 11, marginTop: 2 }}>{p.abv}</div>}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#cccccc' }}>{p.categoria ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#777777', fontSize: 12 }}>{p.tipo ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#777777', fontSize: 12 }}>{p.frecuencia ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#cccccc' }}>{p.ultimo_pedido ? fmtDate(p.ultimo_pedido) : '—'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: p.total_comprado > 0 ? '#ffffff' : '#777777' }}>
                    {p.total_comprado > 0 ? fmtEur(p.total_comprado) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    {p.facturas_count > 0
                      ? <span style={{ background: '#1e1e1e', border: '1px solid #383838', borderRadius: 4, padding: '2px 8px', fontSize: 11, color: '#cccccc' }}>{p.facturas_count}</span>
                      : <span style={{ color: '#777777', fontSize: 12 }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <span style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: p.activo ? 'rgba(29,158,117,0.15)' : 'rgba(176,29,35,0.15)',
                      color: p.activo ? '#1D9E75' : '#B01D23',
                      border: `1px solid ${p.activo ? '#1D9E75' : '#B01D23'}`,
                    }}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <span style={{ color: '#777777', fontSize: 16 }}>›</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalProv !== undefined && (
        <ModalDetalle
          prov={modalProv}
          pedidos={modalPedidos}
          onClose={() => setModalProv(undefined)}
          onSave={handleSave}
          onDelete={handleDelete}
          saving={saving}
        />
      )}
    </div>
  )
}
