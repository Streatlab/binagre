/**
 * TabPills — pestañas de Ajustes · CANTERA ALEGRE v4.
 * Plancha segmentada estilo TabsPastilla: celdas unidas, activa ROSA, sombra
 * suave. Misma navegación (onChange por id).
 */
interface Tab {
  id: string
  label: string
}

const INK = 'var(--neo-ink)'
const ROSA = '#FF2E63'

export function TabPills({
  tabs,
  active,
  onChange,
}: {
  tabs: Tab[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', border: `2px solid ${INK}`, background: 'var(--sl-card, #FFFFFF)', boxShadow: '4px 4px 0 rgba(36,29,18,0.15)', maxWidth: '100%', marginBottom: 20 }}>
      {tabs.map((t, idx) => {
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              padding: '12px 22px',
              cursor: 'pointer',
              border: 'none',
              borderLeft: idx > 0 ? `2px solid ${INK}` : 'none',
              borderRadius: 0,
              background: isActive ? ROSA : 'transparent',
              color: isActive ? '#FFFFFF' : INK,
              display: 'inline-flex',
              alignItems: 'center',
              flex: '0 0 auto',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
