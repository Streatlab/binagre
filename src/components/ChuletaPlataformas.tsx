import { COLORS, FONT } from '@/components/panel/resumen/tokens'

// ChuletaPlataformas — card "Qué subir por plataforma".
// Misma factura visual que CardSaludOcr / CardFacturasCorreo (Panel Global):
// fondo blanco, borde 0.5px suave, radio 14, header Oswald 11/2px, cuerpo
// Lexend en gris mut. Limpio, sin cajas de colores. height:100% para igualar
// la altura de las dos cards vecinas en la fila de 3 columnas.

const ITEMS: { marca: string; color: string; borde?: string; docs: string[] }[] = [
  { marca: 'Glovo', color: COLORS.glovo, borde: COLORS.glovoDark, docs: ['Factura (PDF)', 'CSV de la factura', 'Historial de pedidos'] },
  { marca: 'Uber Eats', color: COLORS.uber, docs: ['Factura (PDF)', 'Detalle de ganancias nivel artículo', 'Resumen de ganancias'] },
  { marca: 'Just Eat', color: COLORS.je, docs: ['Factura (PDF)', 'Sincro · Sold Products'] },
]

export default function ChuletaPlataformas() {
  return (
    <div
      style={{
        background: COLORS.card,
        border: `0.5px solid ${COLORS.brd}`,
        borderRadius: 0,
        padding: '16px 16px',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontFamily: FONT.heading, fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: COLORS.mut, textTransform: 'uppercase' }}>
          Qué subir por plataforma
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {ITEMS.map((p, i) => (
          <div
            key={p.marca}
            style={{
              paddingTop: i === 0 ? 0 : 10,
              paddingBottom: i === ITEMS.length - 1 ? 0 : 10,
              borderTop: i === 0 ? 'none' : `0.5px solid ${COLORS.group}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0, border: p.borde ? `0.5px solid ${p.borde}` : 'none' }} />
              <span style={{ fontFamily: FONT.heading, fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: COLORS.sec }}>
                {p.marca}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 15 }}>
              {p.docs.map((d) => (
                <span key={d} style={{ fontFamily: FONT.body, fontSize: 11.5, color: COLORS.mut, lineHeight: 1.4 }}>
                  {d}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
