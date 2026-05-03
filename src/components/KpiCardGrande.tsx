import type { CSSProperties } from 'react'
import { useTheme, FONT } from '@/styles/tokens'

/* ═══════════════════════════════════════════════════════════
   KpiCardGrande
   Card grande estilo Panel Global:
   - Label superior (Oswald 12, letterSpacing 2)
   - Valor KPI gigante (Oswald 38px)
   - Subtítulo / delta (verde / ámbar / rojo)
   - Barra apilada multicolor opcional
   - Desglose con dots de color
   ═══════════════════════════════════════════════════════════ */

export interface KpiSegmento {
  label: string
  valor: number
  color: string
  pct?: number  // si viene, se usa para la barra; si no, se calcula del valor
}

export type KpiAccentGrande = 'success' | 'danger' | 'warning' | 'neutral'

interface Props {
  label: string
  valor: string                       // ya formateado, sin €
  delta?: string                      // ya formateado, ej: "+8,4% vs mes anterior"
  deltaAccent?: KpiAccentGrande
  segmentos?: KpiSegmento[]           // para barra apilada + desglose
  desgloseTituloRight?: string        // texto opcional a la derecha del label
  highlight?: boolean                 // borde/fondo destacado
  footnote?: string
  children?: React.ReactNode          // contenido custom debajo (ej: círculo de día)
}

const ACCENT: Record<KpiAccentGrande, string> = {
  success: '#1D9E75',
  danger:  '#E24B4A',
  warning: '#f5a623',
  neutral: '',
}

export function KpiCardGrande({
  label, valor, delta, deltaAccent = 'neutral',
  segmentos, desgloseTituloRight, highlight, footnote, children,
}: Props) {
  const { T } = useTheme()

  const wrap: CSSProperties = {
    background: T.card,
    border: `0.5px solid ${T.brd}`,
    borderRadius: 16,
    padding: '24px 28px',
    ...(highlight ? { background: `linear-gradient(180deg, ${T.card} 0%, #1D9E7508 100%)` } : {}),
  }

  const labelStyle: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: T.mut,
    marginBottom: 8,
  }

  const valueStyle: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 38,
    fontWeight: 600,
    color: T.pri,
    lineHeight: 1.05,
  }

  const deltaStyle: CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    color: deltaAccent !== 'neutral' ? ACCENT[deltaAccent] : T.mut,
    marginTop: 4,
  }

  // Cálculo de % si no viene
  const total = segmentos ? segmentos.reduce((a, s) => a + Math.max(0, s.valor), 0) : 0
  const segs = segmentos?.map(s => ({
    ...s,
    pctCalc: s.pct != null ? s.pct : (total > 0 ? (s.valor / total) * 100 : 0),
  })) ?? []

  return (
    <div style={wrap}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={labelStyle}>{label}</div>
        {desgloseTituloRight && (
          <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
            {desgloseTituloRight}
          </div>
        )}
      </div>

      <div style={valueStyle}>{valor}</div>

      {delta && <div style={deltaStyle}>{delta}</div>}

      {/* BARRA APILADA */}
      {segs.length > 0 && (
        <div style={{
          height: 8, borderRadius: 4,
          background: T.brd, overflow: 'hidden',
          display: 'flex', marginTop: 12,
        }}>
          {segs.map((s, i) => (
            <div key={i} style={{
              width: `${s.pctCalc}%`,
              background: s.color,
              height: '100%',
            }} title={`${s.label}: ${Math.round(s.pctCalc)}%`} />
          ))}
        </div>
      )}

      {/* DESGLOSE */}
      {segs.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {segs.map((s, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', padding: '8px 0',
              borderBottom: i < segs.length - 1 ? `0.5px solid ${T.group}` : 'none',
              fontSize: 12,
            }}>
              <span style={{ color: T.sec, fontFamily: FONT.body, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 4,
                  background: s.color, display: 'inline-block',
                }} />
                {s.label}
              </span>
              <span style={{
                fontFamily: FONT.heading, fontSize: 13, fontWeight: 500,
                color: T.pri,
              }}>
                {fmtSinDecimales(s.valor)}
              </span>
            </div>
          ))}
        </div>
      )}

      {children && <div style={{ marginTop: 12 }}>{children}</div>}

      {footnote && (
        <div style={{
          fontFamily: FONT.body, fontSize: 11, color: T.mut,
          marginTop: 10, fontStyle: 'italic',
        }}>
          {footnote}
        </div>
      )}
    </div>
  )
}

function fmtSinDecimales(n: number): string {
  if (n == null || isNaN(n)) return '—'
  return Math.round(n).toLocaleString('es-ES')
}
