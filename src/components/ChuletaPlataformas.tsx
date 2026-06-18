// ChuletaPlataformas — recordatorio breve de qué subir por plataforma.
// Se coloca en Bandeja de entrada (OCR), junto a las cards de correo/OCR.
// Sin lógica: solo el nombre exacto del documento a sacar de cada plataforma.

const ITEMS: { marca: string; docs: string[] }[] = [
  { marca: 'Glovo', docs: ['Factura (PDF)', 'CSV de la factura'] },
  { marca: 'Uber Eats', docs: ['Factura (PDF)', 'Detalle de ganancias nivel artículo', 'Resumen de ganancias'] },
  { marca: 'Just Eat', docs: ['Factura (PDF)', 'Sincro · Sold Products'] },
]

export default function ChuletaPlataformas() {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid rgba(30,34,51,0.10)',
        borderRadius: 12,
        padding: '14px 16px',
        marginTop: 16,
      }}
    >
      <div
        style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: 13,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: '#1e2233',
          marginBottom: 10,
        }}
      >
        Qué subir por plataforma
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {ITEMS.map((p) => (
          <div
            key={p.marca}
            style={{
              background: '#edecea',
              borderRadius: 8,
              padding: '10px 12px',
            }}
          >
            <div
              style={{
                fontFamily: 'Oswald, sans-serif',
                fontWeight: 600,
                fontSize: 15,
                color: '#B01D23',
                marginBottom: 6,
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
                    fontSize: 13,
                    color: '#1e2233',
                    lineHeight: 1.6,
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
