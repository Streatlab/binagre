/**
 * Test Visual — Placeholder para mockups aún no maquetados.
 * Se re-pinta según la piel para mantener la comparación coherente.
 */
import type { Skin } from './skins'
import { cardStyle, lbl } from './skins'

export default function EnPreparacion({ s, nombre }: { s: Skin; nombre: string }) {
  return (
    <div style={{ minHeight: '100%', background: s.pageBg, padding: '24px 28px', fontFamily: s.fontBody }}>
      <div style={{ fontFamily: s.fontTitle, fontSize: 24, fontWeight: 600, color: s.title, letterSpacing: s.titleSpacing, textTransform: 'uppercase', marginBottom: 16 }}>{nombre}</div>
      <div style={{ ...cardStyle(s), maxWidth: 460 }}>
        <div style={lbl(s)}>Copia visual</div>
        <div style={{ fontSize: 15, color: s.textSec, marginTop: 10, lineHeight: 1.5 }}>
          Mockup de <b style={{ color: s.textPri }}>{nombre}</b> en preparación. Panel Global ya está listo con las 3 pieles — el resto se maqueta a continuación con el mismo sistema.
        </div>
      </div>
    </div>
  )
}
