// ChuletaPlataformas — card grande "Qué subir por plataforma".
// Diseñada para ocupar UNA columna (1/3) en la Bandeja de entrada, a la derecha
// de las cards de correo y salud OCR. Estilo ERP Binagre: card blanca, header
// Oswald, acento rojo #B01D23, items en wash beige #edecea. height:100% para
// igualar la altura de las cards vecinas.

const ITEMS: { marca: string; color: string; docs: string[] }[] = [
  { marca: 'Glovo', color: '#FFC244', docs: ['Factura (PDF)', 'CSV de la factura'] },
  { marca: 'Uber Eats', color: '#06C167', docs: ['Factura (PDF)', 'Detalle de ganancias nivel artículo', 'Resumen de ganancias'] },
  { marca: 'Just Eat', color: '#FF8000', docs: ['Factura (PDF)', 'Sincro · Sold Products'] },
]

export default function ChuletaPlataformas() {
  return (
    <div
      style={{
        background: '#fff',
        border: '0.5px solid #d0c8bc',
        borderRadius: 14,
        padding: '16px 16px',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          color: '#7a8090',
          marginBottom: 12,
        }}
      >
        Qué subir por plataforma
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {ITEMS.map((p) => (
          <div
            key={p.marca}
            style={{
              background: '#edecea',
              borderRadius: 10,
              padding: '10px 12px',
              borderLeft: `3px solid ${p.color}`,
            }}
          >
            <div
              style={{
                fontFamily: 'Oswald, sans-serif',
                fontWeight: 600,
                fontSize: 14,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                color: '#B01D23',
                marginBottom: 4,
              }}
            >
              {p.marca}
            </div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {p.docs.map((d) => (
                <li
                  key={d}
                  style={{
                    fontFamily: 'Lexend, sans-serif',
                    fontSize: 12.5,
                    color: '#3a4050',
                    lineHeight: 1.55,
                  }}
                >
                  {d}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
