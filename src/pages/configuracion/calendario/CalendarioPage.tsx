import { BLANCO, GRIS, INK, LIMA, NAR, GRANATE, AMA, AMA_S, AZUL, AZUL_S, ROSA_S, OSW, LEX } from '@/styles/neobrutal'
import { useState } from 'react'
import RutaPantalla from '@/components/ui/RutaPantalla'
import { ConfigShell } from '@/components/configuracion/ConfigShell'
import { PantallaCantera, HeroCantera, Papel, SHADOW_DURA } from '@/components/kit/cantera'
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
  { tipo: 'operativo',   bg: INK,    border: INK,    text: BLANCO, label: 'Operativo' },
  { tipo: 'solo_comida', bg: INK,    border: LIMA,   text: LIMA,   label: 'Solo comida (ALM)' },
  { tipo: 'solo_cena',   bg: INK,    border: NAR,    text: NAR,    label: 'Solo cena (CENA)' },
  { tipo: 'cerrado',     bg: ROSA_S, border: GRANATE, text: GRANATE, label: 'Cerrado' },
  { tipo: 'festivo',     bg: AMA_S,  border: AMA,    text: INK,    label: 'Festivo' },
  { tipo: 'vacaciones',  bg: AZUL_S, border: AZUL,   text: INK,    label: 'Vacaciones' },
]

export default function CalendarioPage() {
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
      <PantallaCantera embedded>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <RutaPantalla niveles={['Ajustes', 'Calendario operativo']} />
          <button
            onClick={() => setShowBulk(true)}
            style={{ padding: '9px 18px', backgroundColor: GRANATE, color: BLANCO, border: `2px solid ${INK}`, boxShadow: SHADOW_DURA, borderRadius: 0, fontFamily: OSW, fontWeight: 700, fontSize: 12, cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase' }}
          >
            Marcar rango
          </button>
        </div>

        <HeroCantera
          area="equipo"
          titular="Así tienes marcado tu calendario operativo"
          resumen="Pulsa un día para cambiar su tipo. Usa «Marcar rango» para aplicar el mismo tipo a varios días de golpe."
        />

        {/* Nav mes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={goPrev}
            disabled={!canPrev}
            style={{ padding: '6px 14px', backgroundColor: INK, border: `2px solid ${INK}`, boxShadow: canPrev ? SHADOW_DURA : undefined, borderRadius: 0, color: canPrev ? BLANCO : GRIS, fontFamily: OSW, fontWeight: 700, fontSize: 13, cursor: canPrev ? 'pointer' : 'default', letterSpacing: 0.5 }}
          >
            ‹
          </button>
          <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 18, color: INK, letterSpacing: 2, minWidth: 200, textAlign: 'center', textTransform: 'uppercase' }}>
            {MESES[month - 1]} {year}
          </span>
          <button
            onClick={goNext}
            disabled={!canNext}
            style={{ padding: '6px 14px', backgroundColor: INK, border: `2px solid ${INK}`, boxShadow: canNext ? SHADOW_DURA : undefined, borderRadius: 0, color: canNext ? BLANCO : GRIS, fontFamily: OSW, fontWeight: 700, fontSize: 13, cursor: canNext ? 'pointer' : 'default', letterSpacing: 0.5 }}
          >
            ›
          </button>
        </div>

        {/* Grid */}
        <Papel ceja={AZUL} style={{ maxWidth: 560 }}>
          <MesGrid year={year} month={month} />
        </Papel>

        {/* Leyenda */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {LEYENDA.map(l => (
            <div key={l.tipo} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 14, backgroundColor: l.bg, border: `2px solid ${l.border}` }} />
              <span style={{ fontFamily: LEX, fontSize: 12, color: INK, fontWeight: 600 }}>{l.label}</span>
            </div>
          ))}
        </div>

        {showBulk && <ModalRangoBulk onClose={() => setShowBulk(false)} />}
      </PantallaCantera>
    </ConfigShell>
  )
}
