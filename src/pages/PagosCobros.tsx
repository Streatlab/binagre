/**
 * PagosCobros — Módulo placeholder
 * Pendiente de implementación cuando existan las tablas facturas y gastos_fijos.
 */
export default function PagosCobros() {
  return (
    <div style={{
      padding: '32px 28px',
      fontFamily: 'Lexend, sans-serif',
      color: '#ffffff',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 28 }}>🚧</span>
        <div>
          <h1 style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: '#ffffff',
            margin: 0,
          }}>
            Pagos y Cobros
          </h1>
          <p style={{ fontSize: 13, color: '#777777', margin: '4px 0 0' }}>
            Módulo en construcción — pendiente de implementación
          </p>
        </div>
      </div>

      <div style={{
        marginTop: 24,
        background: '#141414',
        border: '0.5px solid #2a2a2a',
        borderRadius: 12,
        padding: '24px 28px',
        color: '#cccccc',
        fontSize: 13,
        lineHeight: 1.6,
      }}>
        <p style={{ margin: 0 }}>
          Este módulo centralizará la gestión de cobros y pagos de Streat Lab.
          Estará disponible cuando se creen las tablas <code>facturas</code> y <code>gastos_fijos</code> en Supabase.
        </p>
        <ul style={{ marginTop: 12, paddingLeft: 20, color: '#777777' }}>
          <li>Cobros pendientes de plataformas (Uber, Glovo, Just Eat)</li>
          <li>Pagos fijos mensuales (alquiler, sueldos, suministros)</li>
          <li>Proyección de tesorería 7d / 30d</li>
          <li>Alertas de vencimientos</li>
        </ul>
      </div>
    </div>
  )
}
