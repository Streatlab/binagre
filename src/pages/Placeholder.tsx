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
  // Finanzas (nuevos placeholders)
  'verifactu': 'Verifactu / Facturación legal',
  'ocr-whatsapp': 'OCR Facturas (WhatsApp/Email)',
  'escenarios-tesoreria': 'Escenarios de Tesorería',
}

const SECTION_LABELS: Record<string, string> = {
  'analytics': 'Analytics',
  'ops': 'Operaciones',
  'equipo': 'Equipo',
  'clientes': 'Clientes',
  'integraciones': 'Integraciones',
  'finanzas': 'Finanzas',
}

export default function Placeholder() {
  const params = useParams()
  const location = useLocation()
  const slug = params['*'] || params.slug || location.pathname.split('/').pop() || ''
  const section = location.pathname.split('/')[1] || ''
  const title = LABELS[slug] ?? slug.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase())
  const sectionLabel = SECTION_LABELS[section] ?? section

  return (
    <div>
      <h2
        className="mb-2"
        style={{
          fontFamily: FONT.title,
          fontSize: 28,
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

      <div
        className="rounded-xl border p-12 text-center"
        style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
      >
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
          style={{ background: '#1e1e1e', border: '1px solid var(--sl-border)' }}>
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
          style={{ fontFamily: 'monospace', fontSize: 11, background: '#111111', color: '#66aaff', border: '1px solid var(--sl-border)' }}
        >
          {location.pathname}
        </code>
      </div>
    </div>
  )
}
