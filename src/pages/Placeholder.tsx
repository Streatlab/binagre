import { AZUL_CL, BLANCO, GRANATE, LIMA } from '@/styles/neobrutal'
import { type CSSProperties } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { FONT } from '@/styles/tokens'

const LABELS: Record<string, string> = {
  // Analytics
  'revenue': 'Revenue & Ticket Medio',
  'cogs': 'COGS / Coste MP',
  'margen': 'Margen por Canal',
  'ventas-marca': 'Ventas por Marca',
  'ranking': 'Ranking Productos',
  'demanda': 'Predicción Demanda',
  // Operaciones
  'temperaturas': 'Control Temperaturas',
  'checklists': 'Checklists Apertura/Cierre',
  'tareas': 'Tareas Operativas',
  'bitacora': 'Bitácora Novedades',
  'equipos': 'Libro Equipos',
  'danos': 'Daños Menaje',
  'pedidos-menaje': 'Pedidos Menaje',
  'pulso': 'Pulso Cocina',
  'bpm': 'BPM / Calidad',
  'reuniones': 'Reuniones Equipo',
  'recetas': 'Recetas Fichas Técnicas',
  // Cocina
  'lista-compra': 'Lista de Compra',
  // Equipo
  'empleados': 'Fichas Empleados',
  'evaluaciones': 'Evaluaciones',
  'llamados': 'Llamados Atención',
  'antiguedad': 'Beneficios Antigüedad',
  'celebraciones': 'Celebraciones',
  'dotacion': 'Dotación',
  'onboarding': 'Onboarding Digital',
  'sgsst': 'SG-SST',
  'metas': 'Mis Ventas / Mis Metas',
  // Clientes
  'club': 'Club Fidelización',
  'crm': 'CRM Tienda Propia',
  'resenas': 'Panel Reseñas',
  // Integraciones
  'pos': 'POS Ventas',
  // Finanzas
  'calendario-cobros-pagos': 'Calendario Cobros/Pagos',
  'escenarios-tesoreria': 'Escenarios de Tesorería',

  // ── Auditoría mercado jul-26 · funciones pendientes ──
  'mapeo-marcas': 'Mapeo de Marcas (Glovo / Just Eat)',
  'mapeo-platos': 'Mapeo Plato → Receta',
  'lineas-factura': 'Líneas de Factura',
  'duplicados-platos': 'Platos Duplicados',
  'teorico-vs-real': 'Teórico vs Real',
  'alertas-precio': 'Alertas de Subida de Precio',
  'rentabilidad-franja': 'Rentabilidad por Franja Horaria',
  'ventas-perdidas': 'Ventas Perdidas',
  'produccion-prevista': 'Producción Prevista',
  'sync-carta': 'Sincronización de Carta',
}

interface Ficha {
  ref: string
  hace: string
  porque: string
  desbloquea?: string
  tuyo: string
  bloqueo?: string
  critico?: boolean
}

// Fichas de las funciones pendientes: qué hace, por qué importa y qué hace falta.
const FICHAS: Record<string, Ficha> = {
  'mapeo-marcas': {
    ref: 'A1',
    hace: 'Asigna marca a cada venta que llega de Glovo y Just Eat, que hoy entran en blanco.',
    porque: 'Son 16.438 € de venta ciega, más de la mitad de la facturación. Cualquier reparto por marca que veas hoy es falso.',
    desbloquea: 'Ventas por marca · Margen por marca · Break-even por marca',
    tuyo: 'Confirmar qué marcas están activas en cada plataforma.',
    critico: true,
  },
  'mapeo-platos': {
    ref: 'A2',
    hace: 'Conecta los 514 nombres de plato que se venden con su receta costeada. Empareja solo por similitud y te pide confirmar los dudosos.',
    porque: 'Se venden 514 platos distintos y solo 7 casan con una receta. El 98,6% de la facturación se vende sin saber si gana o pierde dinero.',
    desbloquea: 'Margen por plato · Menú Engineering · COGS real · Ranking · Teórico vs Real',
    tuyo: 'Validar los emparejamientos dudosos con un clic.',
    critico: true,
  },
  'lineas-factura': {
    ref: 'A3',
    hace: 'El OCR pasa de guardar solo el total de la factura a guardar lo que compraste: producto, cantidad y precio.',
    porque: 'Hoy los 396 ingredientes tienen el precio congelado. El escandallo envejece sin que nadie se entere.',
    desbloquea: 'Escandallo vivo · Alertas de precio · Coste real actualizado',
    tuyo: 'Nada.',
  },
  'duplicados-platos': {
    ref: 'A4',
    hace: 'Detecta el mismo plato vendido con distinto nombre en distintas marcas y lo une a una única receta.',
    porque: '"Canelones de tu yaya" y "Cannelloni de la Mamma" son el mismo plato. El sistema los cuenta como dos y ensucia coste, producción y compras.',
    tuyo: 'Validar las uniones propuestas.',
  },
  'teorico-vs-real': {
    ref: 'B1',
    hace: 'Compara lo que deberías haber gastado (recetas × ventas) con lo que gastaste de verdad (compras + inventario).',
    porque: 'Es la única forma de detectar merma, sobreporción y robo. La desviación no controlada suele ser un 5-9% del coste de materia prima.',
    tuyo: 'Hacer inventario una vez al mes. 30 minutos.',
  },
  'alertas-precio': {
    ref: 'B2',
    hace: 'Cuando un proveedor sube un ingrediente, avisa y dice qué platos se han quedado sin margen.',
    porque: 'Hoy una subida del jamón se come el margen de las croquetas y no se ve hasta el cierre del mes.',
    tuyo: 'Nada.',
    bloqueo: 'Necesita A3 · Líneas de Factura',
  },
  'rentabilidad-franja': {
    ref: 'B3',
    hace: 'Cruza ventas por hora con coste de personal y comisiones. Enseña qué marcas y qué horas no cubren coste.',
    porque: 'Apagar una marca en una franja que pierde dinero cuesta cero euros y es margen puro.',
    tuyo: 'Nada.',
  },
  'ventas-perdidas': {
    ref: 'B4',
    hace: 'Cuantifica el dinero perdido por tienda pausada, plato agotado o pedido rechazado.',
    porque: 'En delivery suele ser un 3-6% de la venta y es completamente invisible en los informes actuales.',
    tuyo: 'Nada.',
  },
  'produccion-prevista': {
    ref: 'B5',
    hace: 'Ventas previstas × recetas = lista de producción de mañana y pedido sugerido a proveedor.',
    porque: 'Mata la hora diaria de cálculo a mano y baja la merma.',
    tuyo: 'Nada.',
    bloqueo: 'Necesita A2 · Mapeo Plato → Receta',
  },
  'sync-carta': {
    ref: 'B6',
    hace: 'Cambias un precio o marcas un plato agotado UNA vez y se propaga a Uber, Glovo, Just Eat y web.',
    porque: 'Hoy es trabajo manual multiplicado por 4 canales y por cada marca. Cuando se olvida, se venden platos que no hay.',
    tuyo: 'Decidir si va vía Rushour/Sinqro o directo contra cada plataforma.',
  },
}

const SECTION_LABELS: Record<string, string> = {
  'analytics': 'Analytics',
  'ops': 'Operaciones',
  'equipo': 'Equipo',
  'cocina': 'Cocina',
  'clientes': 'Clientes',
  'integraciones': 'Integraciones',
  'finanzas': 'Finanzas',
  'configuracion': 'Configuración',
  'stock': 'Stock & Compras',
}

const NEO_INK = 'var(--neo-ink)'
const NEO_SHADOW = '4px 4px 0 var(--neo-shadow-color)'
const NEO_CARD: CSSProperties = { border: `3px solid ${NEO_INK}`, borderRadius: 0, boxShadow: NEO_SHADOW }

const ROJO = GRANATE
function Etiqueta({ texto, fondo, color }: { texto: string; fondo: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', background: fondo, color, border: `2px solid ${NEO_INK}`,
      fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 700,
      letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 8px',
    }}>{texto}</span>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <p style={{
        fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: 'var(--sl-text-muted)', marginBottom: 5,
      }}>{titulo}</p>
      <p style={{ fontFamily: 'Lexend, sans-serif', fontSize: 14, lineHeight: 1.55, color: 'var(--sl-text-secondary)' }}>
        {children}
      </p>
    </div>
  )
}

export default function Placeholder() {
  const params = useParams()
  const location = useLocation()
  const slug = params['*'] || params.slug || location.pathname.split('/').pop() || ''
  const section = location.pathname.split('/')[1] || ''
  const title = LABELS[slug] ?? slug.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase())
  const sectionLabel = SECTION_LABELS[section] ?? section
  const ficha = FICHAS[slug]

  return (
    <div style={{ background: 'var(--neo-bg)', minHeight: '100vh', padding: '24px 20px' }}>
      <h2
        className="mb-2"
        style={{
          fontFamily: FONT.title,
          fontSize: 'clamp(20px, 5vw, 28px)',
          color: 'var(--sl-text-primary)',
          letterSpacing: '0.04em',
          fontWeight: 'normal',
        }}
      >
        {title}
      </h2>
      <p
        className="mb-6"
        style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: 11,
          color: 'var(--sl-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
        }}
      >
        {sectionLabel}
      </p>

      {ficha ? (
        <div
          style={{
            ...NEO_CARD,
            background: 'var(--sl-card)',
            width: '100%',
            maxWidth: 760,
            padding: 24,
            borderLeft: `12px solid ${ficha.critico ? ROJO : LIMA}`,
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Etiqueta texto={`Ref ${ficha.ref}`} fondo={NEO_INK} color={BLANCO} />
            {ficha.critico
              ? <Etiqueta texto="Bloquea el resto" fondo={ROJO} color={BLANCO} />
              : <Etiqueta texto="Pendiente" fondo={LIMA} color={NEO_INK} />}
            {ficha.bloqueo ? <Etiqueta texto={ficha.bloqueo} fondo="#d8d6d0" color={NEO_INK} /> : null}
          </div>

          <Bloque titulo="Qué hace">{ficha.hace}</Bloque>
          <Bloque titulo="Por qué importa">{ficha.porque}</Bloque>
          {ficha.desbloquea ? <Bloque titulo="Qué desbloquea">{ficha.desbloquea}</Bloque> : null}
          <Bloque titulo="Qué hace falta de ti">{ficha.tuyo}</Bloque>

          <p style={{
            marginTop: 22, paddingTop: 14, borderTop: `2px solid var(--sl-border)`,
            fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--sl-text-muted)',
          }}>
            Sin construir · Auditoría de mercado jul-26
          </p>
        </div>
      ) : (
        <div
          className="p-12 text-center"
          style={{ ...NEO_CARD, background: 'var(--sl-card)', width: '90%', maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
            style={{ background: 'var(--sl-card)', border: '1px solid var(--sl-border)' }}>
            <span style={{ fontSize: 24 }}>🚧</span>
          </div>
          <p style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, color: 'var(--sl-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            En construcción
          </p>
          <p style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: 'var(--sl-text-muted)', marginTop: 8 }}>
            Este módulo está planificado y se implementará próximamente.
          </p>
          <code
            className="inline-block mt-5 px-3 py-1 rounded"
            style={{ fontFamily: 'monospace', fontSize: 11, background: 'var(--sl-thead)', color: AZUL_CL, border: '1px solid var(--sl-border)' }}
          >
            {location.pathname}
          </code>
        </div>
      )}
    </div>
  )
}
