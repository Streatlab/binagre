import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, X, RotateCcw } from 'lucide-react'
import { fmtEur, fmtDate } from '@/utils/format'
import { COLORS, FONT, CARDS } from '@/components/panel/resumen/tokens'
import { usePropuestasCuadre, type PropuestaCuadre } from '@/hooks/usePropuestasCuadre'

interface UndoEntry {
  type: 'confirmar' | 'rechazar'
  propuesta: PropuestaCuadre
  timer: ReturnType<typeof setTimeout>
}

export default function BandejaPropuestas() {
  const { propuestas, loading, error, confirmar, rechazar, deshacerConfirmar, deshacerRechazar } = usePropuestasCuadre()

  const [filtroTitular, setFiltroTitular] = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [undoEntry, setUndoEntry] = useState<UndoEntry | null>(null)
  const undoRef = useRef<UndoEntry | null>(null)

  useEffect(() => { undoRef.current = undoEntry }, [undoEntry])

  const clearUndo = useCallback(() => {
    if (undoRef.current) clearTimeout(undoRef.current.timer)
    setUndoEntry(null)
  }, [])

  const handleConfirmar = useCallback(async (p: PropuestaCuadre) => {
    clearUndo()
    await confirmar(p.id)
    const timer = setTimeout(() => setUndoEntry(null), 5000)
    setUndoEntry({ type: 'confirmar', propuesta: p, timer })
  }, [confirmar, clearUndo])

  const handleRechazar = useCallback(async (p: PropuestaCuadre) => {
    clearUndo()
    await rechazar(p.id)
    const timer = setTimeout(() => setUndoEntry(null), 5000)
    setUndoEntry({ type: 'rechazar', propuesta: p, timer })
  }, [rechazar, clearUndo])

  const handleDeshacer = useCallback(async () => {
    if (!undoEntry) return
    clearUndo()
    const { type, propuesta } = undoEntry
    if (type === 'confirmar') await deshacerConfirmar(propuesta.id)
    else await deshacerRechazar(propuesta.id, propuesta.conciliacion_id, propuesta.factura_id, propuesta.importe_asociado)
  }, [undoEntry, clearUndo, deshacerConfirmar, deshacerRechazar])

  const titulares = Array.from(new Set(propuestas.map(p => p.mov_proveedor).filter(Boolean))) as string[]
  const proveedores = Array.from(new Set(propuestas.map(p => p.factura_proveedor).filter(Boolean))) as string[]

  const filtradas = propuestas.filter(p => {
    if (filtroTitular && p.mov_proveedor !== filtroTitular) return false
    if (filtroProveedor && p.factura_proveedor !== filtroProveedor) return false
    return true
  }).sort((a, b) => (b.mov_fecha ?? '').localeCompare(a.mov_fecha ?? ''))

  return (
    <div style={{ ...CARDS.big, marginBottom: 18 }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <span style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: '2px', color: COLORS.mut, textTransform: 'uppercase', fontWeight: 500 }}>
            Propuestas de cuadre
          </span>
          {!loading && (
            <span style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginLeft: 10 }}>
              {filtradas.length} pendiente{filtradas.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={filtroTitular}
            onChange={e => setFiltroTitular(e.target.value)}
            style={selectStyle}
          >
            <option value="">Todos los titulares</option>
            {titulares.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={filtroProveedor}
            onChange={e => setFiltroProveedor(e.target.value)}
            style={selectStyle}
          >
            <option value="">Todos los proveedores</option>
            {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {loading && <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut, padding: '20px 0' }}>Cargando propuestas…</div>}
      {error && <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.err }}>{error}</div>}

      {!loading && filtradas.length === 0 && (
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut, padding: '20px 0', textAlign: 'center' }}>
          No hay propuestas pendientes de validar.
        </div>
      )}

      {!loading && filtradas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtradas.map(p => (
            <PropuestaFila
              key={p.id}
              propuesta={p}
              onConfirmar={() => handleConfirmar(p)}
              onRechazar={() => handleRechazar(p)}
            />
          ))}
        </div>
      )}

      {/* Toast undo */}
      {undoEntry && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: COLORS.sidebar, color: '#fff', borderRadius: 10, padding: '10px 18px',
          display: 'flex', alignItems: 'center', gap: 14, zIndex: 300,
          fontFamily: FONT.body, fontSize: 13,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
          <span>
            {undoEntry.type === 'confirmar' ? 'Propuesta confirmada' : 'Propuesta rechazada'}
          </span>
          <button onClick={handleDeshacer} style={{
            background: '#e8f442', color: COLORS.sidebar, border: 'none', borderRadius: 6,
            padding: '5px 12px', fontFamily: FONT.heading, fontSize: 11,
            letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <RotateCcw size={11} /> Deshacer
          </button>
          <button onClick={clearUndo} style={{ background: 'transparent', color: '#aaa', border: 'none', fontSize: 16, cursor: 'pointer', padding: 0 }}>×</button>
        </div>
      )}
    </div>
  )
}

function PropuestaFila({ propuesta: p, onConfirmar, onRechazar }: {
  propuesta: PropuestaCuadre
  onConfirmar: () => void
  onRechazar: () => void
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr auto',
      gap: 12,
      background: COLORS.group,
      borderRadius: 10,
      padding: '12px 14px',
      alignItems: 'start',
    }}>
      {/* Lado factura */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', color: COLORS.mut, textTransform: 'uppercase' }}>Factura</span>
        <span style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.pri, fontWeight: 500 }}>
          {p.factura_proveedor ?? '—'}
        </span>
        {p.factura_nif && <span style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut }}>NIF {p.factura_nif}</span>}
        <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
          {p.factura_fecha && <Chip>{fmtDate(p.factura_fecha)}</Chip>}
          {p.factura_total != null && <Chip accent>{fmtEur(p.factura_total)}</Chip>}
          {p.factura_numero && <Chip>{p.factura_numero}</Chip>}
        </div>
      </div>

      {/* Lado movimiento */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', color: COLORS.mut, textTransform: 'uppercase' }}>Movimiento banco</span>
        <span style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.sec }}>
          {p.mov_concepto ?? '—'}
        </span>
        {p.mov_proveedor && <span style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut }}>{p.mov_proveedor}</span>}
        <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
          {p.mov_fecha && <Chip>{fmtDate(p.mov_fecha)}</Chip>}
          {p.mov_importe != null && <Chip accent={p.mov_importe < 0}>{fmtEur(Math.abs(p.mov_importe))}</Chip>}
        </div>
      </div>

      {/* Botones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 18 }}>
        <button onClick={onConfirmar} style={btnConfirmar} title="Confirmar enlace">
          <Check size={13} /> Confirmar
        </button>
        <button onClick={onRechazar} style={btnRechazar} title="Rechazar propuesta">
          <X size={13} /> Rechazar
        </button>
      </div>
    </div>
  )
}

function Chip({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span style={{
      fontFamily: FONT.body, fontSize: 11, padding: '2px 7px', borderRadius: 6,
      background: accent ? COLORS.redSL + '18' : COLORS.brd + '55',
      color: accent ? COLORS.redSL : COLORS.sec,
      border: `0.5px solid ${accent ? COLORS.redSL + '44' : COLORS.brd}`,
    }}>
      {children}
    </span>
  )
}

const selectStyle: React.CSSProperties = {
  fontFamily: FONT.body, fontSize: 12, padding: '5px 10px', borderRadius: 8,
  border: `0.5px solid ${COLORS.brd}`, background: '#fff', color: COLORS.sec, cursor: 'pointer',
}

const btnConfirmar: React.CSSProperties = {
  background: COLORS.ok, color: '#fff', border: 'none', borderRadius: 7,
  padding: '6px 12px', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px',
  textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600,
  display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
}

const btnRechazar: React.CSSProperties = {
  background: 'transparent', color: COLORS.err, border: `1px solid ${COLORS.err}55`,
  borderRadius: 7, padding: '6px 12px', fontFamily: FONT.heading, fontSize: 11,
  letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600,
  display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
}
