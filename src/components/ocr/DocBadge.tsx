import React from 'react'

export type EstadoDoc = 'conciliada' | 'no_requiere' | 'pendiente'

const STYLE_BASE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  minHeight: 38,
  lineHeight: 1,
  userSelect: 'none',
}

export default function DocBadge(props: { estado: EstadoDoc; url: string | null; onClick: () => void }) {
  const { estado, url, onClick } = props
  if (url) {
    const handle = (e: React.MouseEvent) => {
      e.stopPropagation()
      window.open(url, '_blank', 'noopener,noreferrer')
    }
    const title =
      estado === 'conciliada'
        ? 'Conciliada \u00B7 Ver PDF'
        : estado === 'no_requiere'
          ? 'No requiere \u00B7 PDF en Drive'
          : 'Pendiente \u00B7 Ver PDF'
    return React.createElement(
      'div',
      {
        onClick: handle,
        title,
        style: { ...STYLE_BASE, fontSize: 22, color: '#0F6E56', cursor: 'pointer' },
      },
      '\uD83D\uDCCE'
    )
  }
  if (estado === 'no_requiere') {
    return React.createElement(
      'div',
      {
        title: 'No requiere documento',
        style: {
          ...STYLE_BASE,
          fontFamily: 'Lexend, sans-serif',
          fontSize: 18,
          fontWeight: 600,
          color: '#9ba8c0',
          cursor: 'default',
        },
      },
      '\u2014'
    )
  }
  const handleX = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick()
  }
  return React.createElement(
    'div',
    {
      onClick: handleX,
      title: 'Falta documento o asociaci\u00F3n \u00B7 Click para editar',
      style: { ...STYLE_BASE, fontSize: 18, color: '#E24B4A', fontWeight: 600, cursor: 'pointer' },
    },
    '\u2715'
  )
}
