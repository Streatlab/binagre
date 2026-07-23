import { BLANCO, GRIS, LIMA } from '@/styles/neobrutal'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { COLORS, OSWALD, LEXEND, CARDS, DROPDOWN_BTN } from '@/components/panel/resumen/tokens'
import { fmtEur, fmtDate } from '@/utils/format'

interface RawRow {
  id: string
  factura_id: string | null
  conciliacion_id: string | null
  importe_asociado: number
  confianza_match: number | null
  facturas: {
    proveedor_nombre: string
    fecha_factura: string
    total: number
    nif_emisor: string | null
  } | null
  conciliacion: {
    fecha: string
    concepto: string
    importe: number
    titular_id: string
    titulares: { nombre: string } | null
  } | null
}

interface Propuesta {
  id: string
  factura_id: string | null
  conciliacion_id: string | null
  importe_asociado: number
  confianza_match: number | null
  proveedor_nombre: string
  fecha_factura: string
  total_factura: number
  nif_emisor: string | null
  fecha_mov: string
  concepto: string
  importe_mov: number
  titular_id: string
  titular_nombre: string
}

interface PendingAction {
  tipo: 'confirmar' | 'rechazar'
  propuesta: Propuesta
  timeoutId: ReturnType<typeof setTimeout>
}

export function BandejaPropuestas() {
  const [propuestas, setPropuestas] = useState<Propuesta[]>([])
  const [loading, setLoading] = useState(true)
  const [titulares, setTitulares] = useState<{ id: string; nombre: string }[]>([])
  const [filtroTitular, setFiltroTitular] = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [pending, setPending] = useState<Record<string, PendingAction>>({})
  const [toastInfo, setToastInfo] = useState<{ msg: string; lastId: string } | null>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('facturas_gastos')
      .select(`
        id, factura_id, conciliacion_id, importe_asociado, confianza_match,
        facturas:factura_id (proveedor_nombre, fecha_factura, total, nif_emisor),
        conciliacion:conciliacion_id (fecha, concepto, importe, titular_id, titulares:titular_id (nombre))
      `)
      .eq('confirmado', false)
      .order('created_at', { ascending: false })

    if (data) {
      const mapped: Propuesta[] = (data as unknown as RawRow[])
        .filter(r => r.facturas && r.conciliacion)
        .map(r => ({
          id: r.id,
          factura_id: r.factura_id,
          conciliacion_id: r.conciliacion_id,
          importe_asociado: Number(r.importe_asociado),
          confianza_match: r.confianza_match != null ? Number(r.confianza_match) : null,
          proveedor_nombre: r.facturas!.proveedor_nombre,
          fecha_factura: r.facturas!.fecha_factura,
          total_factura: Number(r.facturas!.total),
          nif_emisor: r.facturas!.nif_emisor,
          fecha_mov: r.conciliacion!.fecha,
          concepto: r.conciliacion!.concepto,
          importe_mov: Number(r.conciliacion!.importe),
          titular_id: r.conciliacion!.titular_id,
          titular_nombre: r.conciliacion!.titulares?.nombre ?? '—',
        }))
      setPropuestas(mapped)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    supabase
      .from('titulares')
      .select('id, nombre')
      .eq('activo', true)
      .order('orden')
      .then(({ data }) => { if (data) setTitulares(data) })
  }, [])

  const proveedores = useMemo(() => {
    const set = new Set<string>()
    propuestas.forEach(p => { if (p.proveedor_nombre) set.add(p.proveedor_nombre) })
    return Array.from(set).sort()
  }, [propuestas])

  const visible = useMemo(() => {
    return propuestas
      .filter(p => !pending[p.id])
      .filter(p => !filtroTitular || p.titular_id === filtroTitular)
      .filter(p => !filtroProveedor || p.proveedor_nombre === filtroProveedor)
      .sort((a, b) => b.fecha_mov.localeCompare(a.fecha_mov))
  }, [propuestas, pending, filtroTitular, filtroProveedor])

  const handleAccion = (p: Propuesta, tipo: 'confirmar' | 'rechazar') => {
    const tid = setTimeout(async () => {
      if (tipo === 'confirmar') {
        await supabase.from('facturas_gastos').update({ confirmado: true }).eq('id', p.id)
      } else {
        await supabase.from('facturas_gastos').delete().eq('id', p.id)
      }
      setPropuestas(prev => prev.filter(x => x.id !== p.id))
      setPending(prev => { const n = { ...prev }; delete n[p.id]; return n })
      setToastInfo(null)
    }, 5000)

    setPending(prev => ({ ...prev, [p.id]: { tipo, propuesta: p, timeoutId: tid } }))
    setToastInfo({
      msg: tipo === 'confirmar' ? 'Propuesta confirmada' : 'Propuesta rechazada',
      lastId: p.id,
    })
    setTimeout(() => setToastInfo(prev => (prev?.lastId === p.id ? null : prev)), 5500)
  }

  const handleDeshacer = (id: string) => {
    const action = pending[id]
    if (!action) return
    clearTimeout(action.timeoutId)
    setPending(prev => { const n = { ...prev }; delete n[id]; return n })
    setToastInfo(null)
  }

  const handleDeshacerUltima = () => {
    const keys = Object.keys(pending)
    if (keys.length > 0) handleDeshacer(keys[keys.length - 1])
  }

  if (loading) {
    return (
      <div style={{ fontFamily: LEXEND, fontSize: 13, color: COLORS.mut, padding: '20px 0' }}>
        Cargando propuestas…
      </div>
    )
  }

  const sinResultados = visible.length === 0 && Object.keys(pending).length === 0

  return (
    <div>
      {/* Cabecera + filtros */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 14,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: OSWALD,
              fontSize: 14,
              letterSpacing: '2px',
              color: COLORS.redSL,
              textTransform: 'uppercase',
            }}
          >
            PROPUESTAS DE CUADRE
          </div>
          <div style={{ fontFamily: LEXEND, fontSize: 12, color: COLORS.mut }}>
            {propuestas.length} propuesta{propuestas.length !== 1 ? 's' : ''} del motor automático sin validar
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={filtroTitular}
            onChange={e => setFiltroTitular(e.target.value)}
            style={{ ...DROPDOWN_BTN, fontFamily: LEXEND }}
          >
            <option value="">Todos los titulares</option>
            {titulares.map(t => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
          <select
            value={filtroProveedor}
            onChange={e => setFiltroProveedor(e.target.value)}
            style={{ ...DROPDOWN_BTN, fontFamily: LEXEND }}
          >
            <option value="">Todos los proveedores</option>
            {proveedores.map(p => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {(filtroTitular || filtroProveedor) && (
            <button
              onClick={() => { setFiltroTitular(''); setFiltroProveedor('') }}
              style={{ ...DROPDOWN_BTN, color: COLORS.err, fontFamily: LEXEND }}
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {sinResultados && (
        <div style={{ ...CARDS.std, textAlign: 'center', padding: '40px 20px' }}>
          <div
            style={{
              fontFamily: OSWALD,
              fontSize: 14,
              letterSpacing: '2px',
              color: COLORS.ok,
            }}
          >
            ✓ SIN PROPUESTAS PENDIENTES
          </div>
          <div style={{ fontFamily: LEXEND, fontSize: 13, color: COLORS.mut, marginTop: 6 }}>
            Todas las propuestas han sido revisadas.
          </div>
        </div>
      )}

      {/* Filas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map(p => (
          <FilaPropuesta
            key={p.id}
            propuesta={p}
            onConfirmar={() => handleAccion(p, 'confirmar')}
            onRechazar={() => handleAccion(p, 'rechazar')}
          />
        ))}
        {/* Ghost de acciones pendientes */}
        {Object.values(pending).map(action => (
          <div
            key={action.propuesta.id}
            style={{
              ...CARDS.std,
              opacity: 0.35,
              pointerEvents: 'none',
              transition: 'opacity 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontFamily: LEXEND, fontSize: 12, color: COLORS.mut }}>
              {action.tipo === 'confirmar' ? '✓ Confirmando…' : '✕ Rechazando…'}{' '}
              <strong>{action.propuesta.proveedor_nombre}</strong>
            </span>
          </div>
        ))}
      </div>

      {/* Toast deshacer */}
      {toastInfo && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: COLORS.sidebar,
            color: BLANCO,
            borderRadius: 10,
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            zIndex: 300,
            fontFamily: LEXEND,
            fontSize: 13,
            boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
            whiteSpace: 'nowrap',
          }}
        >
          <span>{toastInfo.msg}</span>
          <button
            onClick={handleDeshacerUltima}
            style={{
              background: LIMA,
              color: COLORS.sidebar,
              border: 'none',
              borderRadius: 6,
              padding: '5px 14px',
              fontFamily: OSWALD,
              fontSize: 11,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Deshacer
          </button>
          <button
            onClick={() => setToastInfo(null)}
            style={{
              background: 'transparent',
              color: GRIS,
              border: 'none',
              fontSize: 16,
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}

function FilaPropuesta({
  propuesta: p,
  onConfirmar,
  onRechazar,
}: {
  propuesta: Propuesta
  onConfirmar: () => void
  onRechazar: () => void
}) {
  const confianza = p.confianza_match != null ? Math.round(p.confianza_match * 100) : null
  const confianzaColor =
    confianza == null ? COLORS.mut : confianza >= 80 ? COLORS.ok : confianza >= 50 ? COLORS.warn : COLORS.err

  return (
    <div
      style={{
        ...CARDS.std,
        display: 'flex',
        gap: 12,
        alignItems: 'stretch',
        flexWrap: 'wrap',
        padding: '14px 16px',
      }}
    >
      {/* Badge confianza */}
      {confianza != null && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 52,
              textAlign: 'center',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: OSWALD,
                  fontSize: 20,
                  fontWeight: 700,
                  color: confianzaColor,
                  lineHeight: 1,
                }}
              >
                {confianza}%
              </div>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: '1px',
                  color: COLORS.mut,
                  textTransform: 'uppercase',
                  fontFamily: OSWALD,
                }}
              >
                match
              </div>
            </div>
          </div>
          <div style={{ width: 1, background: COLORS.brd, alignSelf: 'stretch' }} />
        </>
      )}

      {/* Factura */}
      <div style={{ flex: 1, minWidth: 190 }}>
        <div
          style={{
            fontFamily: OSWALD,
            fontSize: 10,
            letterSpacing: '2px',
            color: COLORS.mut,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          FACTURA
        </div>
        <div style={{ fontFamily: OSWALD, fontSize: 15, fontWeight: 600, color: COLORS.pri }}>
          {p.proveedor_nombre || '—'}
        </div>
        <div style={{ fontFamily: LEXEND, fontSize: 12, color: COLORS.sec }}>{fmtDate(p.fecha_factura)}</div>
        {p.nif_emisor && (
          <div style={{ fontFamily: LEXEND, fontSize: 11, color: COLORS.mut }}>{p.nif_emisor}</div>
        )}
        <div
          style={{
            fontFamily: OSWALD,
            fontSize: 15,
            fontWeight: 600,
            color: COLORS.pri,
            marginTop: 4,
          }}
        >
          {fmtEur(p.total_factura)}
        </div>
      </div>

      {/* Separador */}
      <div style={{ display: 'flex', alignItems: 'center', color: COLORS.mut, fontSize: 18, flexShrink: 0 }}>
        ⟷
      </div>

      {/* Movimiento bancario */}
      <div style={{ flex: 1, minWidth: 190 }}>
        <div
          style={{
            fontFamily: OSWALD,
            fontSize: 10,
            letterSpacing: '2px',
            color: COLORS.mut,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          MOVIMIENTO BANCARIO
        </div>
        <div style={{ fontFamily: LEXEND, fontSize: 12, color: COLORS.sec }}>{fmtDate(p.fecha_mov)}</div>
        <div
          style={{
            fontFamily: LEXEND,
            fontSize: 13,
            color: COLORS.pri,
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 260,
          }}
          title={p.concepto}
        >
          {p.concepto}
        </div>
        <div style={{ fontFamily: LEXEND, fontSize: 11, color: COLORS.mut }}>{p.titular_nombre}</div>
        <div
          style={{
            fontFamily: OSWALD,
            fontSize: 15,
            fontWeight: 600,
            color: p.importe_mov < 0 ? COLORS.err : COLORS.ok,
            marginTop: 4,
          }}
        >
          {fmtEur(p.importe_mov)}
        </div>
      </div>

      {/* Acciones */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 8,
          minWidth: 114,
        }}
      >
        <button
          onClick={onConfirmar}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: 'none',
            background: COLORS.ok,
            color: BLANCO,
            fontFamily: OSWALD,
            fontSize: 11,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          ✓ Confirmar
        </button>
        <button
          onClick={onRechazar}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: `1.5px solid ${COLORS.err}`,
            background: 'transparent',
            color: COLORS.err,
            fontFamily: OSWALD,
            fontSize: 11,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          ✕ Rechazar
        </button>
      </div>
    </div>
  )
}
