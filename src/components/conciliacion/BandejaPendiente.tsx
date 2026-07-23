import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { COLORS, OSWALD, LEXEND, CARDS, DROPDOWN_BTN } from '@/components/panel/resumen/tokens'
import { fmtEur, fmtDate } from '@/utils/format'

interface Factura {
  id: string
  proveedor_nombre: string
  fecha_factura: string
  total: number
  categoria_factura: string | null
  posible_duplicado: boolean
  duplicado_revisado: boolean
  aviso_aritmetica: boolean | null
  posible_duplicado_de: string | null
}

interface CatGasto {
  id: string
  codigo: string
  nombre: string
}

export function BandejaPendiente() {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [categorias, setCategorias] = useState<CatGasto[]>([])
  const [loading, setLoading] = useState(true)
  const [editTotal, setEditTotal] = useState<{ id: string; valor: string } | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const load = async () => {
    const { data } = await supabase
      .from('facturas')
      .select(
        'id, proveedor_nombre, fecha_factura, total, categoria_factura, posible_duplicado, duplicado_revisado, aviso_aritmetica, posible_duplicado_de',
      )
      .or('posible_duplicado.eq.true,aviso_aritmetica.eq.true,categoria_factura.is.null')
      .order('fecha_factura', { ascending: false })
    if (data) setFacturas(data as Factura[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    supabase
      .from('categorias_gastos')
      .select('id, codigo, nombre')
      .order('nombre')
      .then(({ data }) => { if (data) setCategorias(data as CatGasto[]) })
  }, [])

  const resolverDuplicado = async (id: string) => {
    setSaving(id)
    await supabase.from('facturas').update({ duplicado_revisado: true }).eq('id', id)
    setFacturas(prev => prev.map(f => (f.id === id ? { ...f, duplicado_revisado: true } : f)))
    setSaving(null)
  }

  const guardarTotal = async (id: string, valor: string) => {
    const n = parseFloat(valor.replace(',', '.'))
    if (isNaN(n)) return
    setSaving(id)
    await supabase.from('facturas').update({ total: n, aviso_aritmetica: false }).eq('id', id)
    setFacturas(prev =>
      prev.map(f => (f.id === id ? { ...f, total: n, aviso_aritmetica: false } : f)),
    )
    setEditTotal(null)
    setSaving(null)
  }

  const asignarCategoria = async (id: string, codigo: string) => {
    setSaving(id)
    await supabase
      .from('facturas')
      .update({ categoria_factura: codigo, categoria_factura_origen: 'manual' })
      .eq('id', id)
    setFacturas(prev =>
      prev.map(f => (f.id === id ? { ...f, categoria_factura: codigo } : f)),
    )
    setSaving(null)
  }

  if (loading) return null

  const duplicados = facturas.filter(f => f.posible_duplicado && !f.duplicado_revisado)
  const aritmetica = facturas.filter(f => f.aviso_aritmetica)
  const sinCat = facturas.filter(f => f.categoria_factura === null)
  const total = duplicados.length + aritmetica.length + sinCat.length

  if (total === 0) {
    return (
      <div
        style={{
          ...CARDS.std,
          textAlign: 'center',
          padding: '18px 20px',
          marginTop: 16,
        }}
      >
        <div style={{ fontFamily: OSWALD, fontSize: 12, letterSpacing: '2px', color: COLORS.ok }}>
          ✓ TODO REVISADO
        </div>
        <div style={{ fontFamily: LEXEND, fontSize: 12, color: COLORS.mut, marginTop: 4 }}>
          No hay facturas pendientes de revisión.
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          fontFamily: OSWALD,
          fontSize: 14,
          letterSpacing: '2px',
          color: COLORS.redSL,
          textTransform: 'uppercase',
          marginBottom: 14,
        }}
      >
        PENDIENTE DE MÍ · {total} ítem{total !== 1 ? 's' : ''}
      </div>

      {duplicados.length > 0 && (
        <SeccionPendiente titulo={`POSIBLES DUPLICADOS (${duplicados.length})`} color={COLORS.warn}>
          {duplicados.map(f => (
            <FilaPendiente key={f.id} factura={f}>
              <button
                onClick={() => resolverDuplicado(f.id)}
                disabled={saving === f.id}
                style={estiloBtn(COLORS.warn)}
              >
                {saving === f.id ? '…' : 'Resolver'}
              </button>
            </FilaPendiente>
          ))}
        </SeccionPendiente>
      )}

      {aritmetica.length > 0 && (
        <SeccionPendiente titulo={`AVISO ARITMÉTICA (${aritmetica.length})`} color={COLORS.err}>
          {aritmetica.map(f => (
            <FilaPendiente key={f.id} factura={f}>
              {editTotal?.id === f.id ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={editTotal.valor}
                    onChange={e => setEditTotal({ id: f.id, valor: e.target.value })}
                    style={{ ...DROPDOWN_BTN, width: 90, fontFamily: LEXEND }}
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') guardarTotal(f.id, editTotal.valor)
                      if (e.key === 'Escape') setEditTotal(null)
                    }}
                  />
                  <button
                    onClick={() => guardarTotal(f.id, editTotal.valor)}
                    disabled={saving === f.id}
                    style={estiloBtn(COLORS.ok)}
                  >
                    {saving === f.id ? '…' : '✓'}
                  </button>
                  <button onClick={() => setEditTotal(null)} style={estiloBtn(COLORS.mut)}>
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditTotal({ id: f.id, valor: String(f.total) })}
                  style={estiloBtn(COLORS.err)}
                >
                  Editar total
                </button>
              )}
            </FilaPendiente>
          ))}
        </SeccionPendiente>
      )}

      {sinCat.length > 0 && (
        <SeccionPendiente titulo={`SIN CATEGORÍA (${sinCat.length})`} color={COLORS.sec}>
          {sinCat.map(f => (
            <FilaPendiente key={f.id} factura={f}>
              <select
                value={f.categoria_factura ?? ''}
                onChange={e => { if (e.target.value) asignarCategoria(f.id, e.target.value) }}
                style={{ ...DROPDOWN_BTN, fontFamily: LEXEND, minWidth: 170 }}
                disabled={saving === f.id}
              >
                <option value="">Seleccionar categoría…</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.codigo}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </FilaPendiente>
          ))}
        </SeccionPendiente>
      )}
    </div>
  )
}

function SeccionPendiente({
  titulo,
  color,
  children,
}: {
  titulo: string
  color: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontFamily: OSWALD,
          fontSize: 10,
          letterSpacing: '2px',
          color,
          textTransform: 'uppercase',
          marginBottom: 6,
          borderLeft: `3px solid ${color}`,
          paddingLeft: 8,
        }}
      >
        {titulo}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
  )
}

function FilaPendiente({
  factura: f,
  children,
}: {
  factura: Factura
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        ...CARDS.std,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontFamily: OSWALD, fontSize: 13, fontWeight: 600, color: COLORS.pri }}>
          {f.proveedor_nombre}
        </div>
        <div style={{ fontFamily: LEXEND, fontSize: 11, color: COLORS.mut }}>
          {fmtDate(f.fecha_factura)}
        </div>
      </div>
      <div style={{ fontFamily: OSWALD, fontSize: 14, fontWeight: 600, color: COLORS.pri }}>
        {fmtEur(f.total)}
      </div>
      {children}
    </div>
  )
}

function estiloBtn(color: string) {
  return {
    padding: '6px 14px',
    borderRadius: 0,
    border: `1.5px solid ${color}`,
    background: 'transparent',
    color,
    fontFamily: OSWALD,
    fontSize: 11,
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  }
}
