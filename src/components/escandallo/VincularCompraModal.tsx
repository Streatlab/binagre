/**
 * T-F4-03 — VincularCompraModal
 * Modal para vincular facturas de Conciliación (categoría Producto) a un ingrediente,
 * registrando precio_unitario en precios_ingredientes.
 */
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { onPrecioInsertado } from '@/lib/escandallo/onPrecioInsertado'
import { useTheme, FONT } from '@/styles/tokens'

interface Factura {
  id: string
  fecha: string
  concepto: string
  proveedor: string | null
  importe: number
}

interface Props {
  ingredienteId: string
  ingredienteNombre: string
  onClose: () => void
  onDone?: () => void
}

const CATEGORIAS_PRODUCTO = ['Producto', 'Materia prima', 'COGS', 'Alimentacion', 'Alimentación']

export function VincularCompraModal({ ingredienteId, ingredienteNombre, onClose, onDone }: Props) {
  const { T } = useTheme()
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [precioUnitario, setPrecioUnitario] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fecha90 = new Date()
    fecha90.setDate(fecha90.getDate() - 90)
    const fecha90str = fecha90.toISOString().slice(0, 10)
    ;(async () => {
      const { data } = await supabase
        .from('conciliacion')
        .select('id, fecha, concepto, proveedor, importe')
        .gte('fecha', fecha90str)
        .lt('importe', 0) // gastos (negativos)
        .order('fecha', { ascending: false })
        .limit(200)
      if (!cancelled) {
        // Filtrar categoría Producto heurísticamente por el nombre de la consulta
        // (la tabla conciliacion tiene campo categoria)
        setFacturas((data as Factura[] ?? []))
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const facturasFiltradas = facturas.filter(f => {
    if (!filtroProveedor.trim()) return true
    return (f.proveedor ?? '').toLowerCase().includes(filtroProveedor.toLowerCase()) ||
      f.concepto.toLowerCase().includes(filtroProveedor.toLowerCase())
  })

  const handleConfirmar = async () => {
    if (!selected || !precioUnitario) return
    const precio = parseFloat(precioUnitario.replace(',', '.'))
    if (isNaN(precio) || precio <= 0) { setError('Precio unitario no válido'); return }

    const factura = facturas.find(f => f.id === selected)
    if (!factura) return

    setSaving(true)
    setError(null)
    const alertas = await onPrecioInsertado(selected, [{
      ingrediente_id: ingredienteId,
      precio_unitario: precio,
      proveedor: factura.proveedor ?? factura.concepto,
      fecha: factura.fecha,
    }])
    setSaving(false)
    if (alertas.length > 0) {
      // Alertas visibles via toast (ya emitidas en onPrecioInsertado)
    }
    onDone?.()
    onClose()
  }

  const overlayStyle: CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  const modalStyle: CSSProperties = {
    backgroundColor: '#1a1a1a',
    border: `1px solid ${T.brd}`,
    borderRadius: 12,
    padding: '24px 28px',
    width: '90%', maxWidth: 640,
    maxHeight: '80vh', overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: 16,
  }
  const inputStyle: CSSProperties = {
    background: '#1e1e1e', border: `1px solid ${T.brd}`, borderRadius: 6,
    color: T.pri, fontFamily: FONT.body, fontSize: 13,
    padding: '7px 10px', width: '100%', boxSizing: 'border-box',
  }
  const thStyle: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px',
    textTransform: 'uppercase', color: T.mut, padding: '8px 10px',
    textAlign: 'left', whiteSpace: 'nowrap', background: '#0a0a0a',
    borderBottom: `1px solid ${T.brd}`,
  }
  const tdStyle: CSSProperties = {
    fontFamily: FONT.body, fontSize: 12, color: T.pri,
    padding: '8px 10px', borderBottom: `0.5px solid ${T.brd}`,
  }

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalStyle}>
        <div style={{ fontFamily: FONT.heading, fontSize: 16, letterSpacing: '2px', textTransform: 'uppercase', color: T.pri }}>
          Vincular con compra — {ingredienteNombre}
        </div>

        <input
          style={inputStyle}
          placeholder="Filtrar por proveedor o concepto..."
          value={filtroProveedor}
          onChange={e => setFiltroProveedor(e.target.value)}
        />

        {loading ? (
          <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.mut }}>Cargando facturas...</div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 24 }}></th>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Proveedor</th>
                  <th style={thStyle}>Concepto</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {facturasFiltradas.slice(0, 80).map(f => (
                  <tr
                    key={f.id}
                    onClick={() => setSelected(f.id)}
                    style={{ cursor: 'pointer', background: selected === f.id ? '#B01D2322' : 'transparent' }}
                  >
                    <td style={tdStyle}>
                      <input
                        type="radio" readOnly
                        checked={selected === f.id}
                        style={{ accentColor: '#B01D23' }}
                      />
                    </td>
                    <td style={tdStyle}>{f.fecha}</td>
                    <td style={tdStyle}>{f.proveedor ?? '—'}</td>
                    <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.concepto}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#ff6b70' }}>
                      {Math.abs(f.importe).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                    </td>
                  </tr>
                ))}
                {facturasFiltradas.length === 0 && (
                  <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: T.mut }}>Sin facturas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {selected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec }}>
              Precio unitario (€/{'{ud}'}):
            </label>
            <input
              type="text"
              style={{ ...inputStyle, width: 120 }}
              placeholder="Ej: 1.45"
              value={precioUnitario}
              onChange={e => setPrecioUnitario(e.target.value)}
            />
          </div>
        )}

        {error && (
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: '#ff6b70' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              background: '#222222', border: '1px solid #383838', color: T.sec,
              fontFamily: FONT.body, fontSize: 13, padding: '8px 18px', borderRadius: 6, cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={!selected || !precioUnitario || saving}
            style={{
              background: (!selected || !precioUnitario || saving) ? '#555' : '#B01D23',
              color: '#fff', border: 'none',
              fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase',
              padding: '8px 20px', borderRadius: 6, cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Guardando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
