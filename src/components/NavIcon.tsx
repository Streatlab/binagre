interface NavIconProps {
  section: string
  collapsed: boolean
  isDark: boolean
  active?: boolean
  size?: number
}

const SECTION_COLORS: Record<string, string> = {
  panel:         '#FF4757',
  finanzas:      '#06C167',
  cocina:        '#f5a623',
  operaciones:   '#9ba8c0',
  stock:         '#f5a623',
  pos:           '#66aaff',
  marcas:        '#B01D23',
  marketing:     '#FF4757',
  equipo:        '#9ba8c0',
  clientes:      '#06C167',
  informes:      '#378ADD',
  configuracion: '#5a6880',
}

export function NavIcon({ section, collapsed, isDark, active = false, size = 24 }: NavIconProps) {
  // Color expandido: cada sección su propio color
  // Color colapsado: activo = acento tema; inactivo = gris contrastado
  const sectionColor = SECTION_COLORS[section] ?? '#9ba8c0'
  const strokeColor = collapsed
    ? (active ? (isDark ? '#FF4757' : '#B01D23') : (isDark ? '#c8d0e8' : '#3a4050'))
    : (active ? '#1a1a1a' : sectionColor)
  const strokeW = collapsed ? 1.5 : 2

  const svgProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24' as string,
    fill: 'none',
    stroke: strokeColor,
    strokeWidth: strokeW,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { flexShrink: 0 as const },
  }

  switch (section) {
    case 'panel':
      return <svg {...svgProps}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    case 'finanzas':
      return <svg {...svgProps}><path d="M19 5a9 9 0 100 14"/><line x1="3" y1="10" x2="15" y2="10"/><line x1="3" y1="14" x2="13" y2="14"/></svg>
    case 'cocina':
      return <svg {...svgProps}><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
    case 'operaciones':
      return <svg {...svgProps}><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
    case 'stock':
      return <svg {...svgProps}><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
    case 'pos':
      return <svg {...svgProps}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
    case 'marcas':
      return <svg {...svgProps}><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
    case 'marketing':
      return <svg {...svgProps}><polyline points="3 7 10 12 3 17"/><polyline points="21 7 14 12 21 17"/><path d="M7 12h10"/></svg>
    case 'equipo':
      return <svg {...svgProps}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
    case 'clientes':
      return <svg {...svgProps}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    case 'informes':
      return <svg {...svgProps}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
    case 'configuracion':
      return <svg {...svgProps}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
    default:
      return <svg {...svgProps}><circle cx="12" cy="12" r="10"/></svg>
  }
}
