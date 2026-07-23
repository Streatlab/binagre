import { BLANCO, GRANATE, INK, LIMA, VERDE, AZUL } from '@/styles/neobrutal'
import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { fmtEur, fmtDate } from '@/utils/format'
import { useEsMovil } from '@/hooks/useEsMovil'
import { HeroCantera, Papel, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'

/* ─── Neobrutal ─────────────────────────────────────────── */
const NEO_INK = 'var(--neo-ink)'
const NEO_SHADOW = '4px 4px 0 var(--neo-shadow-color)'
const NEO_CARD: CSSProperties = { border: `3px solid ${NEO_INK}`, borderRadius: 0, boxShadow: NEO_SHADOW }

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
    background: 'var(--sl-input-edit)',
    border: '1px solid var(--sl-border)',
    borderRadius: 6,
    color: 'var(--sl-text-primary)',
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
    color: 'var(--sl-text-muted)',
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
        backgroundColor: 'var(--sl-card-alt)',
        ...NEO_CARD,
        width: '90%',
        maxWidth: 680,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '28px 32px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <span style={{ fontFamily: 'Oswald,sans-serif', fontSize: 16, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--sl-text-primary)' }}>
            {isNew ? 'Nuevo proveedor' : form.nombre}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--sl-text-muted)', cursor: 'pointer', fontSize: 20 }}
          >×</button>
        </div>

        {/* Campos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px 20px', marginBottom: 20 }}>
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
                style={{ accentColor: LIMA, width: 16, height: 16 }}
              />
              Activo
            </label>
          </div>
        </div>

        {/* Historial pedidos */}
        {!isNew && pedidos.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--sl-text-muted)', marginBottom: 10 }}>
              Historial de pedidos ({pedidos.length})
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--sl-thead)' }}>
                  {['Fecha','Estado','Total'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Total' ? 'right' : 'left', color: 'var(--sl-text-muted)', fontFamily: 'Oswald,sans-serif', fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', borderBottom: '1px solid var(--sl-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pedidos.slice(0, 10).map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--sl-border)' }}>
                    <td style={{ padding: '6px 10px', color: 'var(--sl-btn-cancel-text)' }}>{fmtDate(p.fecha)}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--sl-text-muted)' }}>{p.estado ?? '—'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--sl-btn-cancel-text)' }}>{p.total_estimado != null ? fmtEur(p.total_estimado) : '—'}</td>
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
                style={{ background: 'none', border: `1px solid ${GRANATE}`, color: GRANATE, borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontFamily: FONT.body }}
              >
                Eliminar
              </button>
            )}
            {confirmDelete && (
              <span style={{ color: GRANATE, fontSize: 12 }}>
                ¿Seguro?{' '}
                <button onClick={() => onDelete(prov!.id)} style={{ color: GRANATE, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}>Sí, eliminar</button>
                {' '}
                <button onClick={() => setConfirmDelete(false)} style={{ color: 'var(--sl-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancelar</button>
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{ background: 'var(--sl-btn-cancel-bg)', border: '1px solid var(--sl-btn-cancel-border)', color: 'var(--sl-btn-cancel-text)', borderRadius: 6, padding: '7px 16px', cursor: 'pointer', fontSize: 13, fontFamily: FONT.body }}
            >
              Cancelar
            </button>
            <button
              onClick={() => onSave(form)}
              disabled={saving || !form.nombre}
              style={{ background: GRANATE, border: `3px solid ${NEO_INK}`, borderRadius: 0, boxShadow: NEO_SHADOW, color: BLANCO, padding: '7px 20px', minHeight: 44, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: FONT.body, opacity: saving ? 0.7 : 1 }}
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
  const movil = useEsMovil()
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
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

  // Agrupación por categoría (móvil)
  const gruposCat = (() => {
    const m = new Map<string, ProveedorEnriquecido[]>()
    for (const p of filtrados) {
      const k = (p.categoria ?? '').trim() || 'Sin categoría'
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(p)
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'))
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'))
  })()
  const toggleGrupo = (k: string) => setAbiertos(prev => {
    const next = new Set(prev)
    if (next.has(k)) next.delete(k); else next.add(k)
    return next
  })

  /* ── Estilos ── */
  const th: CSSProperties = {
    padding: '8px 14px',
    textAlign: 'left',
    fontFamily: 'Oswald,sans-serif',
    fontSize: 11,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: 'var(--sl-text-muted)',
    background: 'var(--sl-thead)',
    borderBottom: '1px solid var(--sl-border)',
    whiteSpace: 'nowrap',
  }

  const activos = proveedores.filter(p => p.activo).length
  const totalCompradoGlobal = proveedores.reduce((s, p) => s + (p.total_comprado || 0), 0)
  const conFacturas = proveedores.filter(p => p.facturas_count > 0).length

  return (
    <PantallaCantera embedded>
      {/* HÉROE (azul · área Compras) */}
      <HeroCantera
        area="cashflow"
        titular={proveedores.length === 0 ? 'Aún no hay proveedores dados de alta.' : 'Así está tu mapa de proveedores.'}
        etiquetaDato="Comprado a proveedores"
        cifra={totalCompradoGlobal > 0 ? fmtEur(totalCompradoGlobal) : '—'}
        resumen={<>{activos} de {proveedores.length} activos · {conFacturas} con facturas OCR casadas</>}
        atencion={[
          filtrados.length !== proveedores.length ? `${filtrados.length} tras el filtro` : null,
          gruposCat.length > 0 ? `${gruposCat.length} categorías` : null,
        ].filter(Boolean) as string[]}
      />

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          placeholder="Buscar por nombre, ABV, categoría…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{
            background: 'var(--sl-input-edit)',
            border: '1px solid var(--sl-border)',
            borderRadius: 8,
            color: 'var(--sl-text-primary)',
            padding: '8px 14px',
            fontSize: 13,
            fontFamily: FONT.body,
            flex: '1 1 220px',
            minWidth: 0,
            maxWidth: 360,
          }}
        />
        <span style={{ color: 'var(--sl-text-muted)', fontSize: 12 }}>{filtrados.length} proveedores</span>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => openModal(null)}
            style={{
              background: LIMA,
              border: `3px solid ${NEO_INK}`,
              boxShadow: NEO_SHADOW,
              color: INK,
              borderRadius: 0,
              padding: '8px 18px',
              minHeight: 44,
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
        <div style={{ color: GRANATE, backgroundColor: GRANATE + '18', border: `1px solid ${GRANATE}55`, borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ color: 'var(--sl-text-muted)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Cargando proveedores…</div>
      )}

      {!loading && movil && (
        <VistaMovilProveedores
          buscando={!!busqueda}
          filtrados={filtrados}
          grupos={gruposCat}
          abiertos={abiertos}
          toggleGrupo={toggleGrupo}
          onSelect={openModal}
        />
      )}

      {!loading && !movil && (
        <div>
        <SeccionLabel bg={AZUL}>Proveedores</SeccionLabel>
        <Papel ceja={AZUL} pad="0" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 13 }}>
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
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--sl-text-muted)' }}>
                    {busqueda ? 'Sin resultados para la búsqueda' : 'Sin proveedores registrados'}
                  </td>
                </tr>
              )}
              {filtrados.map((p, i) => (
                <tr
                  key={p.id}
                  style={{
                    background: i % 2 === 0 ? 'transparent' : 'var(--sl-card-alt)',
                    borderBottom: '1px solid var(--sl-border)',
                    cursor: 'pointer',
                  }}
                  onClick={() => openModal(p)}
                >
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ color: 'var(--sl-text-primary)', fontWeight: 500 }}>{p.nombre}</div>
                    {p.abv && <div style={{ color: 'var(--sl-text-muted)', fontSize: 11, marginTop: 2 }}>{p.abv}</div>}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--sl-btn-cancel-text)' }}>{p.categoria ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--sl-text-muted)', fontSize: 12 }}>{p.tipo ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--sl-text-muted)', fontSize: 12 }}>{p.frecuencia ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--sl-btn-cancel-text)' }}>{p.ultimo_pedido ? fmtDate(p.ultimo_pedido) : '—'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: p.total_comprado > 0 ? 'var(--sl-text-primary)' : 'var(--sl-text-muted)' }}>
                    {p.total_comprado > 0 ? fmtEur(p.total_comprado) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    {p.facturas_count > 0
                      ? <span style={{ background: 'var(--sl-input-edit)', border: '1px solid var(--sl-btn-cancel-border)', borderRadius: 4, padding: '2px 8px', fontSize: 11, color: 'var(--sl-btn-cancel-text)' }}>{p.facturas_count}</span>
                      : <span style={{ color: 'var(--sl-text-muted)', fontSize: 12 }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <span style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: p.activo ? 'rgba(29,158,117,0.15)' : 'rgba(176,29,35,0.15)',
                      color: p.activo ? VERDE : GRANATE,
                      border: `1px solid ${p.activo ? VERDE : GRANATE}`,
                    }}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <span style={{ color: 'var(--sl-text-muted)', fontSize: 16 }}>›</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Papel>
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
    </PantallaCantera>
  )
}

/* ─── Vista móvil: categorías plegables + filas compactas ─── */
interface VistaMovilProps {
  buscando: boolean
  filtrados: ProveedorEnriquecido[]
  grupos: [string, ProveedorEnriquecido[]][]
  abiertos: Set<string>
  toggleGrupo: (k: string) => void
  onSelect: (p: Proveedor) => void
}

function VistaMovilProveedores({ buscando, filtrados, grupos, abiertos, toggleGrupo, onSelect }: VistaMovilProps) {
  const fila = (p: ProveedorEnriquecido, conBorde: boolean) => (
    <button
      key={p.id}
      onClick={() => onSelect(p)}
      style={{
        textAlign: 'left', width: '100%', background: 'transparent', border: 'none',
        borderBottom: conBorde ? '0.5px solid var(--sl-border)' : 'none',
        padding: '11px 13px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', gap: 10, cursor: 'pointer',
      }}
    >
      <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: FONT.body, fontSize: 13, color: 'var(--sl-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
        {p.abv && <span style={{ fontSize: 11, color: 'var(--sl-text-muted)' }}>{p.abv}</span>}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {p.total_comprado > 0 && (
          <span style={{ fontFamily: 'Oswald,sans-serif', fontSize: 12, fontWeight: 700, color: 'var(--sl-btn-cancel-text)' }}>{fmtEur(p.total_comprado)}</span>
        )}
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.activo ? VERDE : GRANATE, display: 'inline-block' }} />
      </span>
    </button>
  )

  if (filtrados.length === 0) {
    return (
      <div style={{ background: 'var(--sl-card-alt)', border: `3px solid ${NEO_INK}`, borderRadius: 0, padding: 40, textAlign: 'center', color: 'var(--sl-text-muted)', fontSize: 13 }}>
        {buscando ? 'Sin resultados para la búsqueda' : 'Sin proveedores registrados'}
      </div>
    )
  }

  if (buscando) {
    return (
      <div style={{ background: 'var(--sl-card-alt)', border: `3px solid ${NEO_INK}`, borderRadius: 0, overflow: 'hidden' }}>
        {filtrados.map((p, idx) => fila(p, idx < filtrados.length - 1))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {grupos.map(([cat, items]) => {
        const open = abiertos.has(cat)
        return (
          <div key={cat} style={{ background: 'var(--sl-card-alt)', border: `3px solid ${open ? LIMA : NEO_INK}`, borderRadius: 0, overflow: 'hidden' }}>
            <button
              onClick={() => toggleGrupo(cat)}
              style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={open ? LIMA : 'var(--sl-text-muted)'} strokeWidth="2.5" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}>
                  <path d="M9 6l6 6-6 6" />
                </svg>
                <span style={{ fontFamily: FONT.body, fontSize: 13, fontWeight: 600, color: 'var(--sl-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
              </span>
              <span style={{ fontFamily: FONT.body, fontSize: 11, color: 'var(--sl-btn-cancel-text)', background: 'var(--sl-btn-cancel-bg)', padding: '3px 9px', borderRadius: 20, flexShrink: 0 }}>{items.length}</span>
            </button>
            {open && (
              <div style={{ borderTop: '0.5px solid var(--sl-border)' }}>
                {items.map((p, idx) => fila(p, idx < items.length - 1))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
