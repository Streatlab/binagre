import { useState } from 'react'
import { FONT } from '@/styles/tokens'
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
    case 'cerrado':     return { backgroundColor: '#2d1515', border: '1px solid #aa3030' }
    case 'festivo':     return { backgroundColor: '#1e2233', border: '1px solid #3a4060' }
    case 'vacaciones':  return { backgroundColor: '#484f66', border: '1px solid #6070aa' }
    case 'solo_comida': return { backgroundColor: '#141414', border: '1px solid #e8f442' }
    case 'solo_cena':   return { backgroundColor: '#141414', border: '1px solid #f5a623' }
    default:            return { backgroundColor: '#141414', border: '1px solid #2a2a2a' }
  }
}

function CellBadge({ tipo }: { tipo: TipoDia }) {
  if (tipo === 'solo_comida') return (
    <span style={{ fontSize: 9, fontFamily: FONT.heading, backgroundColor: '#e8f442', color: '#111', padding: '1px 4px', borderRadius: 3, letterSpacing: 0.5 }}>ALM</span>
  )
  if (tipo === 'solo_cena') return (
    <span style={{ fontSize: 9, fontFamily: FONT.heading, backgroundColor: '#f5a623', color: '#fff', padding: '1px 4px', borderRadius: 3, letterSpacing: 0.5 }}>CENA</span>
  )
  if (tipo === 'cerrado') return (
    <span style={{ fontSize: 9, fontFamily: FONT.heading, color: '#ffaaaa' }}>CERRADO</span>
  )
  if (tipo === 'festivo') return (
    <span style={{ fontSize: 9, fontFamily: FONT.heading, color: '#9ba8c0' }}>FEST</span>
  )
  if (tipo === 'vacaciones') return (
    <span style={{ fontSize: 9, fontFamily: FONT.heading, color: '#fff' }}>VAC</span>
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
          <div key={d} style={{ textAlign: 'center', fontFamily: FONT.heading, fontSize: 11, color: '#777', padding: '4px 0', letterSpacing: 1 }}>
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
                borderRadius: 6,
                padding: '6px 4px',
                cursor: 'pointer',
                minHeight: 52,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                outline: isToday ? '2px solid #e8f442' : undefined,
                outlineOffset: isToday ? 1 : undefined,
              }}
            >
              <span style={{
                fontFamily: FONT.body,
                fontSize: 13,
                color: tipo === 'cerrado' ? '#ffaaaa' : tipo === 'festivo' ? '#9ba8c0' : tipo === 'vacaciones' ? '#d0d8ff' : '#fff',
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
