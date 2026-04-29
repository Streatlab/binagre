import { useState, type CSSProperties } from 'react'
import {
  COLOR, OSWALD, LEXEND, cardBig, lbl, lblXs, lblSm, kpiBig,
  barTrack, editable, fmtEur0, semaforoBarra,
} from './tokens'
import type { ObjetivosVentas, ToastFn } from './types'

interface Props {
  bruto: number
  netoEstimado: number
  variacionPct: number | null
  ventasSemana: number
  ventasMes: number
  ventasAno: number
  nSemana: number
  nombreMes: string
  ano: number
  objetivos: ObjetivosVentas
  onSaveObjetivo: (tipo: 'semanal' | 'mensual' | 'anual', valor: number | null) => Promise<void>
  toast: ToastFn
}

type Tipo = 'semanal' | 'mensual' | 'anual'

export default function CardVentas({
  bruto, netoEstimado, variacionPct,
  ventasSemana, ventasMes, ventasAno,
  nSemana, nombreMes, ano,
  objetivos, onSaveObjetivo, toast,
}: Props) {
  const [editing, setEditing] = useState<Tipo | null>(null)
  const [editVal, setEditVal] = useState<string>('')

  const pctNeto = bruto > 0 ? Math.round((netoEstimado / bruto) * 100) : 0

  function startEdit(tipo: Tipo) {
    setEditing(tipo)
    setEditVal(String(objetivos[tipo]))
  }

  async function commit(tipo: Tipo) {
    const trimmed = editVal.trim()
    if (trimmed === '') {
      await onSaveObjetivo(tipo, null)
      toast('Restaurado', 'warning')
    } else {
      const num = parseFloat(trimmed.replace(',', '.'))
      if (!isNaN(num) && num > 0) {
        await onSaveObjetivo(tipo, num)
        toast('Objetivo actualizado', 'success')
      }
    }
    setEditing(null)
  }

  function rowBarra(tipo: Tipo, valor: number, objetivo: number, label: string, sub: string, marginBottom: number) {
    const pct = objetivo > 0 ? Math.min(100, Math.round((valor / objetivo) * 100)) : 0
    const sem = semaforoBarra(pct)
    const faltan = Math.max(0, objetivo - valor)
    const isEditing = editing === tipo

    return (
      <div style={{ marginBottom }}>
        <div style={{ ...lblSm, display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={lblSm}>{label} — {sub}</span>
          <span style={{ ...lblSm, color: sem }}>{pct}%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: COLOR.textMut, marginBottom: 6, fontFamily: LEXEND, flexWrap: 'wrap' }}>
          <span>Faltan</span>
          <span style={{ color: sem, fontWeight: 500 }}>{fmtEur0(faltan)}</span>
          <span>de</span>
          {isEditing ? (
            <input
              autoFocus
              type="number"
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onBlur={() => commit(tipo)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit(tipo)
                if (e.key === 'Escape') setEditing(null)
              }}
              style={{
                width: 90, padding: '1px 6px', borderRadius: 4,
                border: `1px solid ${COLOR.rojoAccent}`, background: '#fff',
                fontFamily: OSWALD, fontSize: 13, color: COLOR.textPri, outline: 'none',
              }}
            />
          ) : (
            <span
              style={editable as CSSProperties}
              onClick={() => startEdit(tipo)}
              title="Click para editar objetivo"
            >
              {fmtEur0(objetivo)}
            </span>
          )}
        </div>
        <div style={barTrack}>
          <div style={{ height: '100%', width: `${pct}%`, background: sem, transition: 'width 0.5s ease' }} />
          <div style={{ height: '100%', width: `${100 - pct}%`, background: COLOR.rojo }} />
        </div>
      </div>
    )
  }

  const colorDelta = (variacionPct ?? 0) >= 0 ? COLOR.verde : COLOR.rojo
  const flecha = (variacionPct ?? 0) >= 0 ? '▲' : '▼'

  return (
    <div style={cardBig}>
      <div style={lbl}>VENTAS</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={kpiBig}>{fmtEur0(bruto)}</div>
          <div style={lblXs}>BRUTO</div>
        </div>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 600, color: COLOR.verde }}>
            {fmtEur0(netoEstimado)}
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1.5px', color: COLOR.verde, textTransform: 'uppercase', fontWeight: 500 }}>
            NETO ESTIMADO · {pctNeto}%
          </div>
        </div>
      </div>

      {variacionPct !== null && (
        <div style={{ fontSize: 12, color: colorDelta, margin: '10px 0 16px', fontFamily: LEXEND }}>
          {flecha} {Math.abs(variacionPct).toFixed(1)}% vs anterior
        </div>
      )}

      {rowBarra('semanal', ventasSemana, objetivos.semanal, 'SEMANAL', `S${nSemana}`, 14)}
      {rowBarra('mensual', ventasMes,    objetivos.mensual, 'MENSUAL', nombreMes, 14)}
      {rowBarra('anual',   ventasAno,    objetivos.anual,   'ANUAL',   String(ano), 0)}
    </div>
  )
}
