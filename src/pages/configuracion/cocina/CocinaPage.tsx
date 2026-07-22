/**
 * CocinaPage.tsx — Tanda C: sección "Cocina" dentro de Configuración. Agrupa Categorías,
 * Unidades, Proveedores y Formato de números del Escandallo en un solo sitio, reutilizando
 * los mismos componentes que "Compras" (misma fuente, cero duplicación de UI/lógica).
 */
import { BLANCO, GRANATE } from '@/styles/neobrutal'
import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { useTheme, FONT } from '@/styles/tokens'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { ConfigShell } from '@/components/configuracion/ConfigShell'

interface Pill { id: string; label: string }

const PILLS: Pill[] = [
  { id: 'categorias',      label: 'Categorías' },
  { id: 'unidades',        label: 'Unidades' },
  { id: 'proveedores',     label: 'Proveedores' },
  { id: 'formato-numeros', label: 'Formato de números' },
]

export default function CocinaPage() {
  const { T } = useTheme()
  const loc = useLocation()
  const nav = useNavigate()

  const seg = loc.pathname.split('/').filter(Boolean).pop() ?? ''
  const active =
    seg === 'unidades'        ? 'unidades' :
    seg === 'proveedores'     ? 'proveedores' :
    seg === 'formato-numeros' ? 'formato-numeros' :
    'categorias'

  return (
    <ConfigShell>
      <ModTitle>Cocina</ModTitle>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {PILLS.map(p => {
          const isActive = p.id === active
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => nav(`/configuracion/cocina/${p.id}`)}
              style={{
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
                transition: 'all 0.15s ease',
              }}
            >{p.label}</button>
          )
        })}
      </div>
      <Outlet />
    </ConfigShell>
  )
}
