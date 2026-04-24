import { useTheme, FONT, pageTitleStyle, cardStyle } from '@/styles/tokens'
import { useTitular } from '@/contexts/TitularContext'

export default function Gestoria() {
  const { T } = useTheme()
  const { titulares } = useTitular()

  return (
    <div style={{ padding: 24, background: T.bg, minHeight: '100vh', color: T.pri }}>
      <h1 style={pageTitleStyle(T)}>GESTORÍA</h1>

      <div style={{ ...cardStyle(T), padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
        <div
          style={{
            fontFamily: FONT.heading,
            fontSize: 16,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: T.pri,
            marginBottom: 12,
            fontWeight: 600,
          }}
        >
          PRÓXIMAMENTE
        </div>
        <div style={{ color: T.sec, fontSize: 14, lineHeight: 1.5, maxWidth: 560, margin: '0 auto' }}>
          Exports fiscales trimestrales por titular: <b>modelo 303</b> (IVA), <b>modelo 130</b> (IRPF
          fraccionado autónomos), <b>modelo 390</b> (resumen anual IVA). Desglose automático por
          Rubén y Emilio con los datos ya consolidados en el ERP.
        </div>

        {titulares.length > 0 && (
          <div
            style={{
              marginTop: 24,
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            {titulares.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: '8px 14px',
                  background: T.card,
                  border: `1px solid ${T.brd}`,
                  borderLeft: `3px solid ${t.color}`,
                  borderRadius: 6,
                  fontSize: 12,
                  color: T.sec,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ color: T.pri, fontWeight: 600 }}>{t.nombre}</span>
                <span style={{ color: T.mut }}>· {t.nif}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
