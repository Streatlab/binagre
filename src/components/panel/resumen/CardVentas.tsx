/**
 * CardVentas — Fixes 1-17
 * FIX 2: sin € bruto
 * FIX 3: sin € neto
 * FIX 4: sin € objetivos
 * FIX 5: sin € faltan
 * FIX 6: sublabel FACTURACIÓN
 * FIX 7: fmtSemana formato S18_27_04_26
 * FIX 8: fmtMes solo nombre
 * FIX 9: solo año string
 * FIX 10: bruto fontSize 38 fontWeight 600 color #111111
 * FIX 11: neto fontSize 38 fontWeight 600 color verde
 * FIX 12-13: objetivos desde Supabase con override_usuario
 * FIX 14-15: EditableInline
 * FIX 16: BarraCumplimiento
 * FIX 17: colorSemaforo para %
 */
import { useEffect, useCallback } from 'react'
import {
  COLOR, OSWALD, LEXEND, cardBig, lbl, lblXs, lblSm,
} from './tokens'
import { fmtEur, fmtNum, fmtSemana, fmtMes, colorSemaforo } from '@/lib/format'
import { BarraCumplimiento } from '@/components/ui/BarraCumplimiento'
import { EditableInline } from '@/components/ui/EditableInline'
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

  // FIX 7: semana label usando fmtSemana
  const lunesRef = lunesSemana ?? (() => {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const m = new Date(now)
    m.setDate(now.getDate() + diff)
    return m
  })()
  const semLabel = fmtSemana(nSemana, lunesRef)

  // FIX 8: mes label usando fmtMes
  const mesActual = mes ?? (new Date().getMonth() + 1)
  const mesLabel = fmtMes(mesActual)

  const handleUpdate = useCallback(() => {
    refetchObjetivos?.()
  }, [refetchObjetivos])

  function rowBarra(
    tipo: 'semanal' | 'mensual' | 'anual',
    valor: number,
    objetivo: number,
    label: string,
    marginBottom: number
  ) {
    const pct = objetivo > 0 ? Math.min(100, (valor / objetivo) * 100) : 0
    // FIX 17: colorSemaforo
    const sem = colorSemaforo(pct)
    const faltan = Math.max(0, objetivo - valor)

    return (
      <div key={tipo} style={{ marginBottom }}>
        {/* FIX 7/8/9: solo label sin prefijo SEMANAL/MENSUAL/ANUAL */}
        <div style={{ ...lblSm, display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ ...lblSm, textTransform: 'none' }}>{label}</span>
          {/* FIX 17: % coloreado con semáforo */}
          <span style={{ ...lblSm, color: sem }}>{fmtNum(pct, 0)}%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: COLOR.textMut, marginBottom: 6, fontFamily: LEXEND, flexWrap: 'wrap' }}>
          <span>Faltan</span>
          {/* FIX 5+17: sin €, color semáforo */}
          <span style={{ color: sem, fontWeight: 500 }}>{fmtEur(faltan, { showEuro: false, decimals: 2 })}</span>
          <span>de</span>
          {/* FIX 14: EditableInline */}
          <EditableInline
            valor={objetivo}
            tabla="objetivos"
            campo="override_usuario"
            filtros={
              tipo === 'semanal'
                ? { tipo: 'semanal', año: ano, semana: nSemana }
                : tipo === 'mensual'
                  ? { tipo: 'mensual', año: ano, mes: mesActual }
                  : { tipo: 'anual', año: ano }
            }
            decimales={2}
            unidad=""
            color="#3a4050"
            onUpdate={handleUpdate}
          />
        </div>
        {/* FIX 16: BarraCumplimiento */}
        <BarraCumplimiento pct={pct} altura={8} />
      </div>
    )
  }

  const colorDelta = (variacionPct ?? 0) >= 0 ? COLOR.verde : COLOR.rojo
  const flecha = (variacionPct ?? 0) >= 0 ? '▲' : '▼'

  return (
    <div style={cardBig}>
      {/* FIX 6: FACTURACIÓN */}
      <div style={lbl}>FACTURACIÓN</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
        <div>
          {/* FIX 10: fontSize 38, #111111, sin € */}
          <div style={{ fontFamily: OSWALD, fontSize: 38, fontWeight: 600, color: '#111111' }}>
            {fmtEur(bruto, { showEuro: false, decimals: 2 })}
          </div>
          <div style={lblXs}>BRUTO</div>
        </div>
        <div>
          {/* FIX 11: fontSize 38 verde, sin € */}
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

      {/* FIX 7: semLabel = S18_27_04_26 */}
      {rowBarra('semanal', ventasSemana, objetivos.semanal, semLabel, 14)}
      {/* FIX 8: mesLabel = Abril */}
      {rowBarra('mensual', ventasMes, objetivos.mensual, mesLabel, 14)}
      {/* FIX 9: solo año */}
      {rowBarra('anual', ventasAno, objetivos.anual, String(ano), 0)}
    </div>
  )
}
