import { INK, ROSA } from '@/styles/neobrutal'
/**
 * SubTabs — navegación secundaria · CANTERA ALEGRE v4.
 * Segundo nivel bajo TabsPastilla: solo texto Oswald con subrayado grueso rosa
 * en la activa. Sin cajas ni sombras: se ve al instante que depende de la
 * pestaña principal. Letra grande y aire entre opciones.
 */
const OSW = "'Oswald', sans-serif"

interface SubTabItem { id: string; label: string }

export default function SubTabs({ tabs, activeId, onChange }: {
  tabs: SubTabItem[]
  activeId: string
  onChange: (id: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 28, borderBottom: '2px solid rgba(36,29,18,0.13)', padding: '0 4px', flexWrap: 'wrap' }}>
      {tabs.map(t => {
        const active = t.id === activeId
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            fontFamily: OSW, fontWeight: 600, fontSize: 15, letterSpacing: '1px', textTransform: 'uppercase',
            padding: '8px 2px 10px', border: 'none', background: 'transparent', cursor: 'pointer',
            color: active ? INK : '#8a7f68',
            borderBottom: `5px solid ${active ? ROSA : 'transparent'}`,
            marginBottom: -2,
          }}>{t.label}</button>
        )
      })}
    </div>
  )
}
