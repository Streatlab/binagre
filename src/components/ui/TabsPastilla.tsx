/**
 * TabsPastilla — pestañas del Panel Global (Resumen, Operaciones, Finanzas…).
 * v10: modelo T3 — pastilla dura, activa en ROSA con sombra negra, inactivas en
 * crema con borde negro. Oswald mayúsculas.
 * En móvil (.movil-scope) se convierte en una tira deslizable: ver movil-scope.css.
 */

const INK = '#140f08'
const ROSA = '#FF2E63'
const CREMA = '#FCEFD6'
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
              fontSize: 14,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              padding: '9px 18px',
              cursor: 'pointer',
              border: `3px solid ${INK}`,
              borderRadius: 0,
              background: active ? ROSA : CREMA,
              color: active ? '#fff' : INK,
              boxShadow: active ? `4px 4px 0 ${INK}` : 'none',
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
                color: '#ffffff',
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
