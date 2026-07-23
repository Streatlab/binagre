import { BLANCO, INK } from '@/styles/neobrutal'
/**
 * TabsPastilla — navegación primaria · CANTERA ALEGRE v4.
 * UNA plancha segmentada: celdas blancas unidas por bordes internos, la activa
 * en ROSA. Sombra suave (no negra). Cuanto más importante, más sólido: este es
 * el único elemento con cuerpo de la cabecera; los filtros son planos y las
 * subpestañas (SubTabs) van solo subrayadas.
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
    <div className="tabs-pastilla" style={{ display: 'inline-flex', flexWrap: 'wrap', border: `2px solid ${INK}`, background: 'var(--sl-card, #FFFFFF)', boxShadow: '4px 4px 0 rgba(36,29,18,0.15)', maxWidth: '100%' }}>
      {tabs.map((tab, idx) => {
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
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              padding: '12px 22px',
              cursor: 'pointer',
              border: 'none',
              borderLeft: idx > 0 ? `2px solid ${INK}` : 'none',
              borderRadius: 0,
              background: active ? ROSA : 'transparent',
              color: active ? BLANCO : INK,
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
