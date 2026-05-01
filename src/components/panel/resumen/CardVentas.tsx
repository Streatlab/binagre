/**
 * CardVentas — Ronda 8
 * R8-01: objetivos editables usan handler saveObjetivoVenta del padre (upsert por tipo en tabla objetivos)
 *        en lugar de EditableInline genérico que apunta a campos inexistentes
 *        Si se borra el valor → restaurar valor base por defecto desde tabla
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import {
  COLOR, OSWALD, LEXEND, cardBig, lbl, lblXs, lblSm,
} from './tokens'
import { fmtEur, fmtNum, fmtSemana, fmtMes, colorSemaforo } from '@/lib/format'
import { BarraCumplimiento } from '@/components/ui/BarraCumplimiento'
import type { ObjetivosVentas, ToastFn } from './types'

interface Props {
  bruto: number
  netoEstimado: number
  variacionPct: number | null
  ventasSemana: number
  ventasMes: number
  ventasAno: number
  nSemana: number
  lunesSemana?: Date
  mes?: number
  ano: number
  objetivos: ObjetivosVentas
  onSaveObjetivo: (tipo: 'semanal' | 'mensual' | 'anual', valor: number | null) => Promise<void>
  refetchObjetivos?: () => void
  toast: ToastFn
}

export default function CardVentas({
  bruto, netoEstimado, variacionPct,
  ventasSemana, ventasMes, ventasAno,
  nSemana, lunesSemana, mes, ano,
  objetivos, onSaveObjetivo, refetchObjetivos, toast,
}: Props) {
  const pctNeto = bruto > 0 ? Math.round((netoEstimado / bruto) * 100) : 0

  const lunesRef = lunesSemana ?? (() => {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const m = new Date(now)
    m.setDate(now.getDate() + diff)
    return m
  })()
  const semLabel = fmtSemana(nSemana, lunesRef)

  const mesActual = mes ?? (new Date().getMonth() + 1)
  const mesLabel = fmtMes(mesActual)

  function rowBarra(
    tipo: 'semanal' | 'mensual' | 'anual',
    valor: number,
    objetivo: number,
    label: string,
    marginBottom: number
  ) {
    const pct = objetivo > 0 ? Math.min(100, (valor / objetivo) * 100) : 0
    const sem = colorSemaforo(pct)
    const faltan = Math.max(0, objetivo - valor)

    return (
      <div key={tipo} style={{ marginBottom }}>
        <div style={{ ...lblSm, display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ ...lblSm, textTransform: 'none' }}>{label}</span>
          <span style={{ ...lblSm, color: sem }}>{fmtNum(pct, 0)}%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: COLOR.textMut, marginBottom: 6, fontFamily: LEXEND, flexWrap: 'wrap' }}>
          <span>Faltan</span>
          <span style={{ color: sem, fontWeight: 500 }}>{fmtEur(faltan, { showEuro: false, decimals: 2 })}</span>
          <span>de</span>
          {/* R8-01: usa onSaveObjetivo del padre (upsert por tipo, no EditableInline genérico) */}
          <ObjetivoEditable
            tipo={tipo}
            valor={objetivo}
            onSave={onSaveObjetivo}
            onRefetch={refetchObjetivos}
            toast={toast}
          />
        </div>
        <BarraCumplimiento pct={pct} altura={8} />
      </div>
    )
  }

  const colorDelta = (variacionPct ?? 0) >= 0 ? COLOR.verde : COLOR.rojo
  const flecha = (variacionPct ?? 0) >= 0 ? '▲' : '▼'

  return (
    <div style={cardBig}>
      <div style={lbl}>FACTURACIÓN</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 38, fontWeight: 600, color: '#111111' }}>
            {fmtEur(bruto, { showEuro: false, decimals: 2 })}
          </div>
          <div style={lblXs}>BRUTO</div>
        </div>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 38, fontWeight: 600, color: COLOR.verde }}>
            {fmtEur(netoEstimado, { showEuro: false, decimals: 2 })}
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1.5px', color: COLOR.verde, textTransform: 'uppercase', fontWeight: 500 }}>
            NETO ESTIMADO · {fmtNum(pctNeto, 2)}%
          </div>
        </div>
      </div>

      {variacionPct !== null && (
        <div style={{ fontSize: 12, color: colorDelta, margin: '10px 0 16px', fontFamily: LEXEND }}>
          {flecha} {fmtNum(Math.abs(variacionPct), 1)}% vs anterior
        </div>
      )}

      {rowBarra('semanal', ventasSemana, objetivos.semanal, semLabel, 14)}
      {rowBarra('mensual', ventasMes, objetivos.mensual, mesLabel, 14)}
      {rowBarra('anual', ventasAno, objetivos.anual, String(ano), 0)}
    </div>
  )
}

// R8-01: editable inline con borrar→restaurar último valor válido
function ObjetivoEditable({
  tipo, valor, onSave, onRefetch, toast,
}: {
  tipo: 'semanal' | 'mensual' | 'anual'
  valor: number
  onSave: (tipo: 'semanal' | 'mensual' | 'anual', valor: number | null) => Promise<void>
  onRefetch?: () => void
  toast: ToastFn
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(valor ?? ''))
  const inputRef = useRef<HTMLInputElement>(null)
  const lastValid = useRef<number>(valor)

  useEffect(() => {
    if (valor != null && !isNaN(valor)) lastValid.current = valor
    setDraft(String(valor ?? ''))
  }, [valor])

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  const guardar = useCallback(async () => {
    const trimmed = draft.trim()
    if (trimmed === '') {
      // Borrado → restaurar último valor válido (no se persiste)
      setDraft(String(lastValid.current))
      setEditing(false)
      toast?.('Valor anterior restaurado', 'warning')
      return
    }
    const num = parseFloat(trimmed.replace(',', '.'))
    if (isNaN(num) || num <= 0) {
      setDraft(String(lastValid.current))
      setEditing(false)
      return
    }
    lastValid.current = num
    await onSave(tipo, num)
    setEditing(false)
    onRefetch?.()
    toast?.('Objetivo actualizado', 'success')
  }, [draft, onSave, onRefetch, tipo, toast])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') guardar()
    if (e.key === 'Escape') {
      setDraft(String(valor ?? ''))
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={draft}
        step="any"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={guardar}
        onKeyDown={onKey}
        style={{
          width: 80, padding: '0 4px', border: '1px solid #FF4757',
          borderRadius: 3, fontFamily: 'inherit', fontSize: 'inherit',
          color: '#3a4050', background: '#fff',
        }}
      />
    )
  }

  return (
    <span
      onClick={() => setEditing(true)}
      style={{
        borderBottom: '1px dashed #d0c8bc',
        cursor: 'text',
        color: '#3a4050',
        padding: '0 2px',
      }}
      title="Click para editar — vacío restaura el anterior"
    >
      {fmtEur(valor, { showEuro: false, decimals: 2 })}
    </span>
  )
}
