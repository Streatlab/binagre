import { BLANCO, BORDE_SUAVE, GRIS, INK, LIMA, NAR, ROJO, ROJO_S } from '@/styles/neobrutal'
import {
  ERROR_BANNER_BG, PANEL_SIDEBAR_BG, PANEL_MODAL_BG, CALENDARIO_FESTIVO_BORDE, CALENDARIO_VACACIONES_BORDE,
  APRENDIZAJES_SEC, ESTIMADO_BADGE_TXT, CALENDARIO_MODAL_BG, CALENDARIO_MODAL_BORDE,
} from '@/styles/palettes'
import { useState } from 'react'
import { FONT, useTheme, pageTitleStyle } from '@/styles/tokens'
import { ConfigShell } from '@/components/configuracion/ConfigShell'
import MesGrid from './MesGrid'
import ModalRangoBulk from './ModalRangoBulk'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const MIN_YEAR = 2026
const MAX_YEAR = 2027

// Color legend
const LEYENDA: { tipo: string; bg: string; border: string; text: string; label: string }[] = [
  { tipo: 'operativo',   bg: INK, border: INK, text: BLANCO,    label: 'Operativo' },
  { tipo: 'solo_comida', bg: INK, border: LIMA, text: LIMA, label: 'Solo comida (ALM)' },
  { tipo: 'solo_cena',   bg: INK, border: NAR, text: NAR, label: 'Solo cena (CENA)' },
  { tipo: 'cerrado',     bg: ERROR_BANNER_BG, border: ROJO, text: ROJO_S, label: 'Cerrado' },
  { tipo: 'festivo',     bg: PANEL_SIDEBAR_BG, border: CALENDARIO_FESTIVO_BORDE, text: APRENDIZAJES_SEC, label: 'Festivo' },
  { tipo: 'vacaciones',  bg: PANEL_MODAL_BG, border: CALENDARIO_VACACIONES_BORDE, text: ESTIMADO_BADGE_TXT, label: 'Vacaciones' },
]

export default function CalendarioPage() {
  const { T } = useTheme()
  const hoy = new Date()

  const [year, setYear]   = useState(hoy.getFullYear() < MIN_YEAR ? MIN_YEAR : hoy.getFullYear() > MAX_YEAR ? MAX_YEAR : hoy.getFullYear())
  const [month, setMonth] = useState(hoy.getMonth() + 1)
  const [showBulk, setShowBulk] = useState(false)

  const goPrev = () => {
    if (month === 1) {
      if (year <= MIN_YEAR) return
      setYear(y => y - 1)
      setMonth(12)
    } else {
      setMonth(m => m - 1)
    }
  }

  const goNext = () => {
    if (month === 12) {
      if (year >= MAX_YEAR) return
      setYear(y => y + 1)
      setMonth(1)
    } else {
      setMonth(m => m + 1)
    }
  }

  const canPrev = !(year === MIN_YEAR && month === 1)
  const canNext = !(year === MAX_YEAR && month === 12)

  return (
    <ConfigShell>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={pageTitleStyle(T)}>Calendario operativo</h1>
        <button
          onClick={() => setShowBulk(true)}
          style={{ padding: '9px 18px', backgroundColor: LIMA, color: INK, border: 'none', borderRadius: 8, fontFamily: FONT.heading, fontSize: 12, cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}
        >
          Marcar rango
        </button>
      </div>

      {/* Nav mes */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <button
          onClick={goPrev}
          disabled={!canPrev}
          style={{ padding: '6px 14px', backgroundColor: INK, border: `1px solid ${BORDE_SUAVE}`, borderRadius: 6, color: canPrev ? BLANCO : GRIS, fontFamily: FONT.heading, fontSize: 13, cursor: canPrev ? 'pointer' : 'default', letterSpacing: 0.5 }}
        >
          ‹
        </button>
        <span style={{ fontFamily: FONT.heading, fontSize: 18, color: T.pri, letterSpacing: 2, minWidth: 200, textAlign: 'center', textTransform: 'uppercase' }}>
          {MESES[month - 1]} {year}
        </span>
        <button
          onClick={goNext}
          disabled={!canNext}
          style={{ padding: '6px 14px', backgroundColor: INK, border: `1px solid ${BORDE_SUAVE}`, borderRadius: 6, color: canNext ? BLANCO : GRIS, fontFamily: FONT.heading, fontSize: 13, cursor: canNext ? 'pointer' : 'default', letterSpacing: 0.5 }}
        >
          ›
        </button>
      </div>

      {/* Grid */}
      <div style={{ backgroundColor: CALENDARIO_MODAL_BG, border: `1px solid ${CALENDARIO_MODAL_BORDE}`, borderRadius: 12, padding: '20px 20px 24px', maxWidth: 560 }}>
        <MesGrid year={year} month={month} />
      </div>

      {/* Leyenda */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
        {LEYENDA.map(l => (
          <div key={l.tipo} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 14, backgroundColor: l.bg, border: `1px solid ${l.border}`, borderRadius: 3 }} />
            <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec }}>{l.label}</span>
          </div>
        ))}
      </div>

      {showBulk && <ModalRangoBulk onClose={() => setShowBulk(false)} />}
    </ConfigShell>
  )
}
