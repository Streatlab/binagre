import { BLANCO, GRIS, INK, LIMA, NAR, GRANATE, AMA, AMA_S, AZUL, AZUL_S, ROSA_S, OSW, LEX } from '@/styles/neobrutal'
import { useState } from 'react'
import { useCalendario, type TipoDia } from '@/contexts/CalendarioContext'
import ModalTipoDia from './ModalTipoDia'

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function toKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function cellStyle(tipo: TipoDia): React.CSSProperties {
  switch (tipo) {
    case 'cerrado':     return { backgroundColor: ROSA_S, border: `2px solid ${GRANATE}` }
    case 'festivo':     return { backgroundColor: AMA_S, border: `2px solid ${AMA}` }
    case 'vacaciones':  return { backgroundColor: AZUL_S, border: `2px solid ${AZUL}` }
    case 'solo_comida': return { backgroundColor: INK, border: `2px solid ${LIMA}` }
    case 'solo_cena':   return { backgroundColor: INK, border: `2px solid ${NAR}` }
    default:            return { backgroundColor: INK, border: `2px solid ${INK}` }
  }
}

function CellBadge({ tipo }: { tipo: TipoDia }) {
  if (tipo === 'solo_comida') return (
    <span style={{ fontSize: 9, fontFamily: OSW, fontWeight: 700, backgroundColor: LIMA, color: INK, padding: '1px 4px', letterSpacing: 0.5 }}>ALM</span>
  )
  if (tipo === 'solo_cena') return (
    <span style={{ fontSize: 9, fontFamily: OSW, fontWeight: 700, backgroundColor: NAR, color: BLANCO, padding: '1px 4px', letterSpacing: 0.5 }}>CENA</span>
  )
  if (tipo === 'cerrado') return (
    <span style={{ fontSize: 9, fontFamily: OSW, fontWeight: 700, color: GRANATE }}>CERRADO</span>
  )
  if (tipo === 'festivo') return (
    <span style={{ fontSize: 9, fontFamily: OSW, fontWeight: 700, color: INK }}>FEST</span>
  )
  if (tipo === 'vacaciones') return (
    <span style={{ fontSize: 9, fontFamily: OSW, fontWeight: 700, color: INK }}>VAC</span>
  )
  return null
}

interface Props {
  year: number
  month: number  // 1-12
}

export default function MesGrid({ year, month }: Props) {
  const { tipoDia } = useCalendario()
  const [modalFecha, setModalFecha] = useState<string | null>(null)

  // First day of month (0=Sun..6=Sat), convert to Mon-based (0=Mon..6=Sun)
  const firstDate = new Date(year, month - 1, 1)
  const rawDow = firstDate.getDay()  // 0=Sun
  const startOffset = rawDow === 0 ? 6 : rawDow - 1  // Mon=0..Sun=6

  const daysInMonth = new Date(year, month, 0).getDate()
  const today = toKey(new Date())

  // Build cells array: nulls for padding + day numbers
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {DIAS_SEMANA.map(d => (
          <div key={d} style={{ textAlign: 'center', fontFamily: OSW, fontWeight: 700, fontSize: 11, color: GRIS, padding: '4px 0', letterSpacing: 1 }}>
            {d}
          </div>
        ))}

        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />

          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const tipo = tipoDia(dateStr)
          const isToday = dateStr === today

          return (
            <div
              key={dateStr}
              onClick={() => setModalFecha(dateStr)}
              style={{
                ...cellStyle(tipo),
                borderRadius: 0,
                padding: '6px 4px',
                cursor: 'pointer',
                minHeight: 52,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                outline: isToday ? `2px solid ${LIMA}` : undefined,
                outlineOffset: isToday ? 1 : undefined,
              }}
            >
              <span style={{
                fontFamily: LEX,
                fontSize: 13,
                color: tipo === 'cerrado' ? GRANATE : tipo === 'festivo' ? INK : tipo === 'vacaciones' ? INK : BLANCO,
                fontWeight: isToday ? 700 : 400,
              }}>
                {day}
              </span>
              <CellBadge tipo={tipo} />
            </div>
          )
        })}
      </div>

      {modalFecha && (
        <ModalTipoDia
          fecha={modalFecha}
          tipoActual={tipoDia(modalFecha)}
          onClose={() => setModalFecha(null)}
        />
      )}
    </>
  )
}
