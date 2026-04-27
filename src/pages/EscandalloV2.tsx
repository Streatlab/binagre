import { useTheme, FONT, pageTitleStyle } from '@/styles/tokens'

/* ─── ESCANDALLO V2 — ESQUELETO ─── */

export default function EscandalloV2() {
  const { T } = useTheme()

  const secciones = [
    {
      id: 'eps',
      titulo: 'EPS — Escandallo por Plato',
      descripcion: 'Costeo por plato con ingredientes actualizados. Cálculo automático de food cost y margen.',
      estado: 'planificado',
    },
    {
      id: 'recetas',
      titulo: 'Recetas — Waterfall',
      descripcion: 'Árbol de recetas multi-nivel con sub-recetas, mermas y comisiones por canal.',
      estado: 'planificado',
    },
    {
      id: 'ingredientes',
      titulo: 'Ingredientes',
      descripcion: 'Gestión de ingredientes con histórico de precios, proveedor y conversiones de unidad.',
      estado: 'planificado',
    },
  ]

  return (
    <div style={{ background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 28px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={pageTitleStyle(T)}>Escandallo v2</h1>
        <span style={{
          fontFamily: FONT.heading,
          fontSize: 10,
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          color: '#f5a623',
          background: '#f5a62318',
          border: '1px solid #f5a62340',
          borderRadius: 6,
          padding: '3px 10px',
        }}>
          Beta — En desarrollo
        </span>
      </div>
      <p style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, marginBottom: 28, maxWidth: 600 }}>
        Versión 2 del módulo de escandallo. La v1 sigue operativa en{' '}
        <a href="/escandallo" style={{ color: '#e8f442', textDecoration: 'none' }}>/escandallo</a>.
        Esta versión integra recetas multi-nivel, mermas automáticas y comparación de precios por proveedor.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {secciones.map(sec => (
          <div key={sec.id} style={{
            background: T.card,
            border: `1px solid ${T.brd}`,
            borderRadius: 12,
            padding: '20px 22px',
            opacity: 0.7,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 10,
            }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase', color: T.pri, fontWeight: 600 }}>
                {sec.titulo}
              </div>
              <span style={{
                fontFamily: FONT.heading,
                fontSize: 9,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                color: T.mut,
                background: T.group,
                border: `1px solid ${T.brd}`,
                borderRadius: 4,
                padding: '2px 7px',
                whiteSpace: 'nowrap',
              }}>
                Planificado
              </span>
            </div>
            <p style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec, margin: 0, lineHeight: 1.5 }}>
              {sec.descripcion}
            </p>
            <div style={{ marginTop: 14, height: 3, background: T.brd, borderRadius: 2 }}>
              <div style={{ width: '0%', height: 3, background: '#e8f442', borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28, padding: 16, background: '#e8f44210', border: '1px solid #e8f44230', borderRadius: 10 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#e8f442', marginBottom: 6 }}>
          Roadmap v2
        </div>
        <ul style={{ margin: 0, padding: '0 0 0 18px', fontFamily: FONT.body, fontSize: 12, color: T.sec, lineHeight: 1.8 }}>
          <li>Importar ingredientes y precios desde proveedores (Makro, BM, etc.)</li>
          <li>Recetas multi-nivel con sub-recetas anidadas</li>
          <li>Mermas por categoría de ingrediente</li>
          <li>Food cost por canal (Uber / Glovo / Web / Directa)</li>
          <li>Menú Engineering integrado (rentabilidad × popularidad)</li>
          <li>Alertas cuando el food cost de un plato supere el objetivo</li>
        </ul>
      </div>
    </div>
  )
}
