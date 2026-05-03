import { FONT } from '@/styles/tokens'

export default function ListadoFacturas() {
  return (
    <div style={{ background: '#f5f3ef', padding: '24px 28px', minHeight: '100%' }}>
      <h1 style={{
        fontFamily: FONT.heading,
        fontSize: 22,
        fontWeight: 600,
        color: '#B01D23',
        textTransform: 'uppercase',
        letterSpacing: '3px',
        margin: 0,
      }}>
        Listado de Facturas
      </h1>
      <p style={{ fontFamily: FONT.body, fontSize: 13, color: '#7a8090', marginTop: 8, marginBottom: 24 }}>
        Próximamente — consulta y filtrado avanzado de todas las facturas registradas.
      </p>

      <div style={{
        background: '#fff',
        border: '0.5px solid #d0c8bc',
        borderRadius: 14,
        padding: '64px 32px',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: 14,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          color: '#7a8090',
          marginBottom: 8,
        }}>
          En desarrollo
        </div>
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: '#7a8090' }}>
          Vista de listado de facturas con filtros, agrupaciones y exportación.
        </div>
      </div>
    </div>
  )
}
