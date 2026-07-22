/**
 * TabsContainer — contenedor reutilizable de PESTAÑAS del kit (C·Bloque D).
 * Se usa en las 6 áreas: una barra de pestañas (granate de marca en la activa)
 * + <Outlet/> que renderiza la pantalla existente envuelta TAL CUAL.
 *
 * `insight` es la ranura para las frases_insight de cabecera de cada área
 * (se cablea en el cierre de D). Nunca reescribe el interior de las pantallas.
 */
import { NavLink, Outlet } from 'react-router-dom'
import type { CSSProperties } from 'react'
import { GRANATE, BLANCO } from '@/styles/neobrutal'
import { useTheme, FONT } from '@/styles/tokens'

export interface AreaTab {
  to: string
  label: string
  end?: boolean
}

export function TabsContainer({
  title,
  tabs,
  insight,
}: {
  title?: string
  tabs: AreaTab[]
  insight?: string
}) {
  const { T } = useTheme()

  const tabStyle = (isActive: boolean): CSSProperties => ({
    padding: '8px 20px',
    borderRadius: 8,
    fontFamily: FONT.heading,
    fontSize: 13,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    fontWeight: isActive ? 600 : 500,
    background: isActive ? GRANATE : T.card,
    color: isActive ? BLANCO : T.sec,
    border: `0.5px solid ${isActive ? GRANATE : T.brd}`,
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  })

  return (
    <div style={{ width: '100%' }}>
      {(title || insight) && (
        <div style={{ marginBottom: 16 }}>
          {title && (
            <h1 style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: T.pri, margin: 0 }}>
              {title}
            </h1>
          )}
          {insight && (
            <p style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, margin: '6px 0 0' }}>{insight}</p>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} end={t.end} style={({ isActive }) => tabStyle(isActive)}>
            {t.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  )
}

export default TabsContainer
