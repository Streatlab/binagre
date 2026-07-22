/**
 * TabsContainer — contenedor reutilizable de PESTAÑAS del kit (C·Bloque D).
 * Se usa en las 6 áreas: una barra de pestañas (granate de marca en la activa)
 * + <Outlet/> que renderiza la pantalla existente envuelta TAL CUAL.
 *
 * `insight` es la ranura para las frases_insight de cabecera de cada área
 * (se cablea en el cierre de D). Nunca reescribe el interior de las pantallas.
 */
import { NavLink, Outlet, Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import { GRANATE, BLANCO } from '@/styles/neobrutal'
import { useTheme, FONT } from '@/styles/tokens'
import { useFraseArea } from '@/hooks/useFraseArea'

export interface AreaTab {
  to: string
  label: string
  end?: boolean
}

/** Salto de navegación cruzada: desde un área al área que explica su dato. */
export interface CrossNav {
  to: string
  label: string
}

export function TabsContainer({
  title,
  tabs,
  insight,
  insightCategoria,
  crossNav,
}: {
  title?: string
  tabs: AreaTab[]
  insight?: string
  insightCategoria?: string
  crossNav?: CrossNav
}) {
  const { T } = useTheme()
  const fraseBD = useFraseArea(insightCategoria)
  const frase = insight ?? fraseBD

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
      {(title || frase || crossNav) && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            {title && (
              <h1 style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: T.pri, margin: 0 }}>
                {title}
              </h1>
            )}
            {frase && (
              <p style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, margin: '6px 0 0' }}>{frase}</p>
            )}
          </div>
          {crossNav && (
            <Link to={crossNav.to} style={{
              flexShrink: 0, textDecoration: 'none',
              fontFamily: FONT.heading, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600,
              color: GRANATE, background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 8, padding: '7px 14px',
            }}>{crossNav.label} →</Link>
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
