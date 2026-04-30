/**
 * CardRatio — Ratio Ingresos / Gastos
 * J.3: Barra + desviación movidos justo debajo del coeficiente grande.
 * J.4: Solo Ingresos netos / Gastos fijos / Gastos variables (eliminados "Netos estimados" y "Netos reales factura").
 * J.5: Datos de running no existen → "Datos insuficientes" en cifras.
 * J.6: Tooltip en título.
 */
import { useState, type CSSProperties } from 'react'
import {
  COLOR, OSWALD, LEXEND, card, lblSm, barTrack, editable,
  fmtDec,
} from './tokens'
import { fmtEur } from '@/lib/format'

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
  netosEstimados, gastosFijos, gastosReales,
  objetivo, onSaveObjetivo, onToast,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState<string>('')

  // J.5: running no existe → todos los datos son insuficientes si gastosReales < 100
  const ratioInsuficiente = gastosReales < 100 || netosEstimados < 100
  const ratio = ratioInsuficiente ? 0 : (gastosReales > 0 ? netosEstimados / gastosReales : 0)
  const pctDist = objetivo > 0 ? Math.round((ratio / objetivo) * 100) : 0
  const ratioPctObj = objetivo > 0 ? (ratio / objetivo) * 100 : 0

  const semColor =
    ratio >= objetivo ? COLOR.verde :
    ratioPctObj >= 80 ? COLOR.ambar : COLOR.rojo

  const flecha = ratio >= objetivo ? '▲' : '▼'

  const filled = Math.min(pctDist, 100)
  const remaining = Math.max(0, 100 - pctDist)

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

  return (
    <div style={card}>
      {/* Cabecera con tooltip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <div style={lblSm}>RATIO INGRESOS / GASTOS</div>
          <span
            title="Cociente entre ingresos netos estimados y gastos totales del periodo. Objetivo por defecto: 2.5"
            style={{ fontSize: 11, color: COLOR.textMut, cursor: 'help', fontFamily: LEXEND }}
          >
            ⓘ
          </span>
        </div>
        {/* Objetivo editable inline — J.1 */}
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
            // J.1: hardcode 2.5 si kpi_objetivos no existe — la tabla objetivos sí existe, se usa en TabResumen
            <span style={editable as CSSProperties} onClick={startEdit} title="Click para editar objetivo">
              {fmtDec(objetivo, 1)}
            </span>
          )}
        </div>
      </div>

      {/* J.2: Coeficiente grande Oswald 38px con colorSemaforo */}
      <div
        style={{ fontFamily: OSWALD, fontSize: 38, fontWeight: 600, color: semColor, marginTop: 6 }}
        title={ratioInsuficiente ? 'Datos insuficientes para calcular ratio' : undefined}
      >
        {ratioInsuficiente ? '—' : fmtDec(ratio, 2)}
      </div>

      {/* J.3: Barra + texto desviación justo debajo del coeficiente */}
      <div style={{ marginTop: 6, marginBottom: 12 }}>
        <div style={barTrack}>
          <div style={{ height: '100%', width: `${filled}%`, background: semColor, transition: 'width 0.5s ease' }} />
          <div style={{ height: '100%', width: `${remaining}%`, background: COLOR.rojo }} />
        </div>
        <div style={{ fontSize: 12, color: semColor, marginTop: 4, fontFamily: LEXEND }}>
          {ratioInsuficiente ? 'Datos insuficientes' : `${flecha} ${pctDist}% del objetivo`}
        </div>
      </div>

      {/* J.4: Solo Ingresos netos / Gastos fijos / Gastos variables */}
      <Linea
        label="Ingresos netos"
        valor={ratioInsuficiente ? '—' : `${fmtEur(netosEstimados, { showEuro: false, decimals: 0 })} €`}
        top
      />
      <Linea
        label="Gastos fijos"
        valor={ratioInsuficiente ? '—' : `${fmtEur(gastosFijos, { showEuro: false, decimals: 0 })} €`}
      />
      <Linea
        label="Gastos variables"
        valor={ratioInsuficiente ? '—' : `${fmtEur(Math.max(0, gastosReales - gastosFijos), { showEuro: false, decimals: 0 })} €`}
      />
    </div>
  )
}

function Linea({ label, valor, top }: { label: string; valor: string; top?: boolean }) {
  return (
    <div style={{
      fontSize: 12,
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: top ? 4 : 2,
      fontFamily: LEXEND,
    }}>
      <span style={{ color: COLOR.textMut }}>{label}</span>
      <span style={{ color: COLOR.textPri }}>{valor}</span>
    </div>
  )
}
