import { ROJO } from '@/styles/neobrutal'
import React from 'react'

type EstadoDoc = 'conciliada' | 'no_requiere' | 'pendiente'

export function DocBadge({ estado, url, onClick }: { estado: EstadoDoc; url: string | null; onClick: () => void }) {
  const tieneUrl = !!url
  if (tieneUrl) {
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation()
      window.open(url!, '_blank', 'noopener,noreferrer')
    }
    return (
      <div
        onClick={handleClick}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', minHeight: 38, fontSize: 22, lineHeight: 1, color: '#0F6E56', cursor: 'pointer', userSelect: 'none' }}
        title={estado === 'conciliada' ? 'Conciliada · Ver PDF' : estado === 'no_requiere' ? 'No requiere · PDF en Drive' : 'Pendiente · Ver PDF'}
      >📎</div>
    )
  }
  if (estado === 'no_requiere') {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', minHeight: 38, fontFamily: 'Lexend, sans-serif', fontSize: 18, fontWeight: 600, color: '#9ba8c0', cursor: 'default', userSelect: 'none' }} title="No requiere documento">—</div>
  }
  return (
    <div
      onClick={e => { e.stopPropagation(); onClick() }}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', minHeight: 38, fontSize: 18, lineHeight: 1, color: ROJO, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
      title="Falta documento o asociación · Click para editar"
    >✕</div>
  )
}
