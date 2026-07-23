import { BLANCO, INK } from '@/styles/neobrutal'
/**
 * TabsPastilla — pestañas de navegación · CANTERA ALEGRE v1.0.
 * Hermanas de los desplegables de cabecera: mismo alto, mismo borde 2px, misma
 * Oswald mayúsculas y misma sombra dura de pulsable. La activa va en ROSA y se
 * "hunde" (translate + sin sombra); las inactivas en blanco con sombra.
 * En móvil (.movil-scope) se convierte en una tira deslizable: ver movil-scope.css.
 */

const ROSA = '#FF2E63'
const OSW = "'Oswald', sans-serif"

interface TabItem {
  id: string
  label: string
  badge?: number
}

interface TabsPastillaProps {
  tabs: TabItem[]
  activeId: string
  onChange: (id: string) => void
}

export default function TabsPastilla({ tabs, activeId, onChange }: TabsPastillaProps) {
  return (
    <div className="tabs-pastilla" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {tabs.map(tab => {
        const active = tab.id === activeId
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            data-activo={active ? '1' : undefined}
            style={{
              fontFamily: OSW,
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              padding: '9px 16px',
              cursor: 'pointer',
              border: `2px solid ${INK}`,
              borderRadius: 0,
              background: active ? ROSA : 'var(--sl-card, #FFFFFF)',
              color: active ? BLANCO : INK,
              boxShadow: active ? 'none' : `3px 3px 0 ${INK}`,
              transform: active ? 'translate(2px, 2px)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              flex: '0 0 auto',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                border: `2px solid ${INK}`,
                background: INK,
                color: BLANCO,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: OSW,
                marginLeft: 8,
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
