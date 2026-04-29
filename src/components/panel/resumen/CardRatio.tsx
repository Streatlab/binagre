import { useState, type CSSProperties } from 'react'
import {
  COLOR, OSWALD, LEXEND, card, lblSm, barTrack, editable,
  fmtEur0,
} from './tokens'

interface Props {
  netosEstimados: number
  netosReales: number
  gastosFijos: number
  gastosReales: number
  objetivo: number
  onSaveObjetivo: (valor: number | null) => Promise<void>
  onToast: (msg: string, type: 'success' | 'warning') => void
}

export default function CardRatio({
  netosEstimados, netosReales, gastosFijos, gastosReales,
  objetivo, onSaveObjetivo, onToast,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState<string>('')

  const ratio = gastosReales > 0 ? netosReales / gastosReales : 0
  const pctDist = objetivo > 0 ? Math.round((ratio / objetivo) * 100) : 0
  const ratioPctObj = objetivo > 0 ? (ratio / objetivo) * 100 : 0

  const semColor =
    ratio >= objetivo ? COLOR.verde :
    ratioPctObj >= 80 ? COLOR.ambar : COLOR.rojo

  const flecha = ratio >= objetivo ? '▲' : '▼'

  function startEdit() {
    setEditing(true)
    setEditVal(String(objetivo))
  }

  async function commit() {
    const trimmed = editVal.trim()
    if (trimmed === '') {
      await onSaveObjetivo(null)
      onToast('Restaurado', 'warning')
    } else {
      const num = parseFloat(trimmed.replace(',', '.'))
      if (!isNaN(num) && num > 0) {
        await onSaveObjetivo(num)
        onToast('Objetivo actualizado', 'success')
      }
    }
    setEditing(false)
  }

  const filled = Math.min(pctDist, 100)
  const remaining = Math.max(0, 100 - pctDist)

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={lblSm}>RATIO INGRESOS / GASTOS</div>
        <div style={{ fontSize: 11, color: COLOR.textMut, display: 'flex', alignItems: 'center', gap: 4, fontFamily: LEXEND }}>
          obj{' '}
          {editing ? (
            <input
              autoFocus
              type="number"
              value={editVal}
              step="0.1"
              onChange={(e) => setEditVal(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') setEditing(false)
              }}
              style={{
                width: 50, padding: '1px 4px', borderRadius: 4,
                border: `1px solid ${COLOR.rojoAccent}`, background: '#fff',
                fontFamily: OSWALD, fontSize: 11, color: COLOR.textPri, outline: 'none',
              }}
            />
          ) : (
            <span style={editable as CSSProperties} onClick={startEdit} title="Click para editar objetivo">
              {objetivo.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      <div style={{ fontFamily: OSWALD, fontSize: 38, fontWeight: 600, color: semColor, marginTop: 6 }}>
        {ratio.toFixed(2)}
      </div>
      <div style={{ fontSize: 12, color: semColor, marginBottom: 10, fontFamily: LEXEND }}>
        {flecha} {pctDist}% del objetivo
      </div>

      <Linea label="Netos estimados"        valor={fmtEur0(netosEstimados)} top />
      <Linea label="Netos reales (factura)" valor={fmtEur0(netosReales)} />
      <Linea label="Gastos fijos"           valor={fmtEur0(gastosFijos)} marginTop={6} />
      <Linea label="Gastos reales"          valor={fmtEur0(gastosReales)} />

      <div style={{ marginTop: 14, paddingTop: 10, borderTop: `0.5px solid ${COLOR.borde}` }}>
        <div style={{ fontSize: 11, color: COLOR.textMut, marginBottom: 6, fontFamily: LEXEND }}>
          Distancia al objetivo
        </div>
        <div style={barTrack}>
          <div style={{ height: '100%', width: `${filled}%`, background: semColor, transition: 'width 0.5s ease' }} />
          <div style={{ height: '100%', width: `${remaining}%`, background: COLOR.rojo }} />
        </div>
        <div style={{ fontSize: 11, color: COLOR.textMut, textAlign: 'right', marginTop: 4, fontFamily: LEXEND }}>
          {pctDist}% del {objetivo.toFixed(1)} obj
        </div>
      </div>
    </div>
  )
}

function Linea({ label, valor, top, marginTop }: { label: string; valor: string; top?: boolean; marginTop?: number }) {
  return (
    <div style={{
      fontSize: 12,
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: top ? 10 : marginTop ?? 0,
      fontFamily: LEXEND,
    }}>
      <span style={{ color: COLOR.textMut }}>{label}</span>
      <span style={{ color: COLOR.textPri }}>{valor}</span>
    </div>
  )
}
