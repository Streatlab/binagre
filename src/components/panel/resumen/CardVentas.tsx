/**
 * CardVentas — Panel Global
 * Editable inline:
 *  - Vacío o 0/negativo → DELETE override → restaura valor calculado
 *  - Número > 0 → upsert override (siempre guarda, sin checks de igualdad)
 *  - Sin toasts (no piden ruido visual)
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
  toast?: ToastFn
}

export default function CardVentas({
  bruto, netoEstimado, variacionPct,
  ventasSemana, ventasMes, ventasAno,
  nSemana, lunesSemana, mes, ano,
  objetivos, onSaveObjetivo, refetchObjetivos,
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
          <span style={{ color: sem, fontWeight: 500 }}>{fmtEur(faltan, { showEuro: false, decimals: 0 })}</span>
          <span>de</span>
          <ObjetivoEditable
            tipo={tipo}
            valor={objetivo}
            onSave={onSaveObjetivo}
            onRefetch={refetchObjetivos}
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

// Editable inline SIN toasts. Siempre guarda si es número > 0.
// Vacío o 0 → DELETE override → restaura.
function ObjetivoEditable({
  tipo, valor, onSave, onRefetch,
}: {
  tipo: 'semanal' | 'mensual' | 'anual'
  valor: number
  onSave: (tipo: 'semanal' | 'mensual' | 'anual', valor: number | null) => Promise<void>
  onRefetch?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(Math.round(valor ?? 0)))
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cuando cambia el valor desde el padre y NO estoy editando, sincronizo el draft
  useEffect(() => {
    if (!editing) {
      setDraft(String(Math.round(valor ?? 0)))
    }
  }, [valor, editing])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const guardar = useCallback(async () => {
    if (saving) return
    const trimmed = draft.trim()

    // Vacío → DELETE override → restaura
    if (trimmed === '') {
      setSaving(true)
      try {
        await onSave(tipo, null)
        onRefetch?.()
      } finally {
        setSaving(false)
        setEditing(false)
      }
      return
    }

    const num = parseFloat(trimmed.replace(',', '.'))

    // No es número válido → cancela sin guardar
    if (isNaN(num)) {
      setDraft(String(Math.round(valor ?? 0)))
      setEditing(false)
      return
    }

    // 0 o negativo → DELETE override → restaura
    if (num <= 0) {
      setSaving(true)
      try {
        await onSave(tipo, null)
        onRefetch?.()
      } finally {
        setSaving(false)
        setEditing(false)
      }
      return
    }

    // Número > 0 → SIEMPRE guarda (sin check num === valor que bloqueaba escribir el mismo número o uno cercano)
    setSaving(true)
    try {
      await onSave(tipo, num)
      onRefetch?.()
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }, [draft, onSave, onRefetch, tipo, valor, saving])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') guardar()
    if (e.key === 'Escape') {
      setDraft(String(Math.round(valor ?? 0)))
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
        disabled={saving}
        placeholder="vacío o 0 = restaurar"
        style={{
          width: 110, padding: '0 4px', border: `1px solid ${COLOR.verde}`,
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
      title="Click para editar · vacío o 0 restaura el valor calculado"
    >
      {fmtEur(valor, { showEuro: false, decimals: 0 })}
    </span>
  )
}
