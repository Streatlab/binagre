import { INK, ROSA, NAR } from '@/styles/neobrutal'
/**
 * RutaPantalla — miga de pan · CANTERA ALEGRE v4.
 * "Global ▸ Resumen ▸ Visión general": un color por nivel para saber dónde
 * estás de un vistazo. Tinta = módulo · rosa = pestaña activa (mismo rosa que
 * TabsPastilla) · arena = subpestaña. Solo texto, no navega.
 */
const OSW = "'Oswald', sans-serif"
const ARENA = '#a3987f'

export default function RutaPantalla({ niveles, subtitulo }: { niveles: string[]; subtitulo?: string }) {
  const colores = [INK, ROSA, ARENA]
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', fontFamily: OSW, textTransform: 'uppercase', lineHeight: 1 }}>
        {niveles.map((n, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10 }}>
            {i > 0 && <span style={{ fontSize: 18, color: NAR, fontWeight: 700 }}>▸</span>}
            <span style={{ fontWeight: i === niveles.length - 1 && niveles.length > 2 ? 600 : 700, fontSize: 26, letterSpacing: '2px', color: colores[Math.min(i, 2)] }}>{n}</span>
          </span>
        ))}
      </div>
      {subtitulo && <div style={{ fontFamily: "'Lexend', sans-serif", fontSize: 12.5, fontWeight: 600, color: 'var(--sl-text-secondary)', marginTop: 5 }}>{subtitulo}</div>}
    </div>
  )
}
