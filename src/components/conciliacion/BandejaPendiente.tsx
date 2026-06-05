import { useState } from 'react'
import { AlertTriangle, Copy, Tag } from 'lucide-react'
import { fmtEur, fmtDate } from '@/utils/format'
import { COLORS, FONT, CARDS } from '@/components/panel/resumen/tokens'
import { useFacturasPendientes, type FacturaPendiente } from '@/hooks/useFacturasPendientes'

export default function BandejaPendiente() {
  const { facturas, loading, setCategoria, resolverDuplicado, resolverAritmetica } = useFacturasPendientes()

  const duplicados = facturas.filter(f => f.posible_duplicado)
  const aritmeticos = facturas.filter(f => f.aviso_aritmetica && !f.posible_duplicado)
  const sinCategoria = facturas.filter(f => !f.categoria_factura && !f.posible_duplicado && !f.aviso_aritmetica)

  const total = duplicados.length + aritmeticos.length + sinCategoria.length

  if (!loading && total === 0) return null

  return (
    <div style={{ ...CARDS.big, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: '2px', color: COLORS.mut, textTransform: 'uppercase', fontWeight: 500 }}>
          Pendiente de mí
        </span>
        {!loading && total > 0 && (
          <span style={{
            background: COLORS.err, color: '#fff', borderRadius: '50%',
            width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FONT.heading, fontSize: 11, fontWeight: 600,
          }}>{total}</span>
        )}
      </div>

      {loading && <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut }}>Cargando…</div>}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {duplicados.length > 0 && (
            <Seccion
              icono={<Copy size={14} />}
              titulo="Posibles duplicados"
              color={COLORS.err}
            >
              {duplicados.map(f => (
                <FilaFactura key={f.id} factura={f}>
                  <button onClick={() => resolverDuplicado(f.id)} style={btnResolver(COLORS.err)}>
                    Resolver
                  </button>
                </FilaFactura>
              ))}
            </Seccion>
          )}

          {aritmeticos.length > 0 && (
            <Seccion
              icono={<AlertTriangle size={14} />}
              titulo="Aviso aritmética"
              color={COLORS.warn}
            >
              {aritmeticos.map(f => (
                <FilaFacturaEditable key={f.id} factura={f} onGuardar={resolverAritmetica} />
              ))}
            </Seccion>
          )}

          {sinCategoria.length > 0 && (
            <Seccion
              icono={<Tag size={14} />}
              titulo="Sin categoría"
              color={COLORS.mut}
            >
              {sinCategoria.map(f => (
                <FilaCategoria key={f.id} factura={f} onGuardar={setCategoria} />
              ))}
            </Seccion>
          )}
        </div>
      )}
    </div>
  )
}

function Seccion({ icono, titulo, color, children }: {
  icono: React.ReactNode
  titulo: string
  color: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ color }}>{icono}</span>
        <span style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', color, textTransform: 'uppercase', fontWeight: 500 }}>
          {titulo}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
  )
}

function FilaFactura({ factura: f, children }: { factura: FacturaPendiente; children?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: COLORS.group, borderRadius: 9, padding: '10px 14px', gap: 12, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.pri, fontWeight: 500 }}>
          {f.proveedor ?? '—'}
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {f.fecha_factura && <span style={chipMut}>{fmtDate(f.fecha_factura)}</span>}
          {f.total != null && <span style={chipMut}>{fmtEur(f.total)}</span>}
          {f.numero_factura && <span style={chipMut}>{f.numero_factura}</span>}
          {f.titular && <span style={chipMut}>{f.titular}</span>}
        </div>
      </div>
      {children}
    </div>
  )
}

function FilaFacturaEditable({ factura: f, onGuardar }: {
  factura: FacturaPendiente
  onGuardar: (id: string, total: number) => Promise<void>
}) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(f.total?.toString() ?? '')

  const guardar = async () => {
    const n = parseFloat(valor.replace(',', '.'))
    if (isNaN(n)) return
    await onGuardar(f.id, n)
    setEditando(false)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: COLORS.group, borderRadius: 9, padding: '10px 14px', gap: 12, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.pri, fontWeight: 500 }}>
          {f.proveedor ?? '—'}
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {f.fecha_factura && <span style={chipMut}>{fmtDate(f.fecha_factura)}</span>}
          {editando ? (
            <input
              value={valor}
              onChange={e => setValor(e.target.value)}
              style={{ width: 90, fontFamily: FONT.body, fontSize: 12, padding: '2px 6px', borderRadius: 5, border: `1px solid ${COLORS.warn}`, background: '#fff' }}
              autoFocus
            />
          ) : (
            f.total != null && <span style={chipMut}>{fmtEur(f.total)}</span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {editando ? (
          <>
            <button onClick={guardar} style={btnResolver(COLORS.ok)}>Guardar</button>
            <button onClick={() => setEditando(false)} style={btnResolver(COLORS.mut)}>Cancelar</button>
          </>
        ) : (
          <button onClick={() => setEditando(true)} style={btnResolver(COLORS.warn)}>Revisar total</button>
        )}
      </div>
    </div>
  )
}

function FilaCategoria({ factura: f, onGuardar }: {
  factura: FacturaPendiente
  onGuardar: (id: string, categoria: string) => Promise<void>
}) {
  const [valor, setValor] = useState('')

  const guardar = async () => {
    if (!valor.trim()) return
    await onGuardar(f.id, valor.trim())
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: COLORS.group, borderRadius: 9, padding: '10px 14px', gap: 12, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.pri, fontWeight: 500 }}>
          {f.proveedor ?? '—'}
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {f.fecha_factura && <span style={chipMut}>{fmtDate(f.fecha_factura)}</span>}
          {f.total != null && <span style={chipMut}>{fmtEur(f.total)}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          value={valor}
          onChange={e => setValor(e.target.value)}
          placeholder="Categoría…"
          style={{ width: 140, fontFamily: FONT.body, fontSize: 12, padding: '4px 8px', borderRadius: 6, border: `0.5px solid ${COLORS.brd}`, background: '#fff' }}
          onKeyDown={e => { if (e.key === 'Enter') guardar() }}
        />
        <button onClick={guardar} style={btnResolver(COLORS.redSL)} disabled={!valor.trim()}>
          Asignar
        </button>
      </div>
    </div>
  )
}

const chipMut: React.CSSProperties = {
  fontFamily: FONT.body, fontSize: 11, padding: '2px 7px', borderRadius: 5,
  background: COLORS.brd + '44', color: COLORS.sec, border: `0.5px solid ${COLORS.brd}`,
}

function btnResolver(color: string): React.CSSProperties {
  return {
    background: color, color: '#fff', border: 'none', borderRadius: 6,
    padding: '5px 11px', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px',
    textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
  }
}
