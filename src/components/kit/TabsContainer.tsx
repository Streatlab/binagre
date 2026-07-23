/**
 * TabsContainer — contenedor reutilizable de PESTAÑAS del kit (C·Bloque D).
 * CANTERA ALEGRE v4: cuando trae `title` es NIVEL PRIMARIO → miga de pan
 * (RutaPantalla) + plancha segmentada estilo TabsPastilla (activa ROSA).
 * Cuando NO trae `title` es NIVEL SECUNDARIO → estilo SubTabs (solo texto
 * Oswald con subrayado grueso rosa, sin cajas).
 * Sigue routeando con <NavLink> y renderiza la pantalla existente TAL CUAL
 * en el <Outlet/>. Nunca reescribe el interior de las pantallas.
 */
import { NavLink, Outlet } from 'react-router-dom'
import type { CSSProperties } from 'react'
import { INK, BLANCO } from '@/styles/neobrutal'

const ROSA = '#FF2E63'
const OSW = "'Oswald', sans-serif"

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
  // Miga de pan a partir del título: "Cocina · Operativa" → ['Cocina','Operativa'].
  const niveles = title ? title.split('·').map(s => s.trim()).filter(Boolean) : []
  const colores = [INK, ROSA, '#a3987f']

  // ── Nivel secundario (sin título): estilo SubTabs ──
  if (!title) {
    return (
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', gap: 28, borderBottom: '2px solid rgba(36,29,18,0.13)', padding: '0 4px', flexWrap: 'wrap', marginBottom: 20 }}>
          {tabs.map(t => (
            <NavLink key={t.to} to={t.to} end={t.end} style={({ isActive }) => ({
              fontFamily: OSW, fontWeight: 600, fontSize: 15, letterSpacing: '1px', textTransform: 'uppercase',
              padding: '8px 2px 10px', textDecoration: 'none', whiteSpace: 'nowrap',
              color: isActive ? INK : '#8a7f68',
              borderBottom: `5px solid ${isActive ? ROSA : 'transparent'}`,
              marginBottom: -2,
            } as CSSProperties)}>
              {t.label}
            </NavLink>
          ))}
        </div>
        <Outlet />
      </div>
    )
  }

  // ── Nivel primario (con título): RutaPantalla + plancha estilo TabsPastilla ──
  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', fontFamily: OSW, textTransform: 'uppercase', lineHeight: 1 }}>
          {niveles.map((n, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10 }}>
              {i > 0 && <span style={{ fontSize: 18, color: '#FF6A1A', fontWeight: 700 }}>▸</span>}
              <span style={{ fontWeight: 700, fontSize: 26, letterSpacing: '2px', color: colores[Math.min(i, 2)] }}>{n}</span>
            </span>
          ))}
        </div>
        {insight && (
          <div style={{ fontFamily: "'Lexend', sans-serif", fontSize: 12.5, fontWeight: 600, color: 'var(--sl-text-secondary)', marginTop: 5 }}>{insight}</div>
        )}
      </div>

      <div style={{ display: 'inline-flex', flexWrap: 'wrap', border: `2px solid ${INK}`, background: 'var(--sl-card, #FFFFFF)', boxShadow: '4px 4px 0 rgba(36,29,18,0.15)', maxWidth: '100%', marginBottom: 20 }}>
        {tabs.map((t, idx) => (
          <NavLink key={t.to} to={t.to} end={t.end} style={({ isActive }) => ({
            fontFamily: OSW, fontWeight: 600, fontSize: 14, letterSpacing: '0.6px', textTransform: 'uppercase',
            padding: '12px 22px', textDecoration: 'none', whiteSpace: 'nowrap',
            borderLeft: idx > 0 ? `2px solid ${INK}` : 'none',
            background: isActive ? ROSA : 'transparent',
            color: isActive ? BLANCO : INK,
            display: 'inline-flex', alignItems: 'center', flex: '0 0 auto',
          } as CSSProperties)}>
            {t.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  )
}

export default TabsContainer
