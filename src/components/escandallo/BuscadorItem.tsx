import { VERDE } from '@/styles/neobrutal'
import type { CSSProperties } from 'react'
import { useState, useRef, useEffect, useMemo } from 'react'

export interface BuscadorOpcion { id: string; nombre: string; barato?: boolean; tag?: string }

interface Props {
  value: string
  opciones: BuscadorOpcion[]
  onSelect: (nombre: string) => void
  placeholder?: string
  inputClassName?: string
  inputStyle?: CSSProperties
}

export default function BuscadorItem({ value, opciones, onSelect, placeholder, inputClassName, inputStyle }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtradas = useMemo(() => {
    const term = (q || '').toLowerCase().trim()
    const base = term ? opciones.filter(o => o.nombre.toLowerCase().includes(term)) : opciones
    return base.slice(0, 50)
  }, [q, opciones])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        className={inputClassName}
        style={inputStyle}
        value={value}
        placeholder={placeholder}
        onChange={e => { setQ(e.target.value); onSelect(e.target.value); if (!open) setOpen(true) }}
        onFocus={() => { setQ(''); setOpen(true) }}
      />
      {open && filtradas.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60, maxHeight: 240, overflowY: 'auto', background: 'var(--sl-card)', border: '1px solid var(--sl-border)', borderRadius: 0, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', marginTop: 2 }}>
          {filtradas.map(o => (
            <div
              key={o.id}
              onMouseDown={() => { onSelect(o.nombre); setOpen(false); setQ('') }}
              style={{ padding: '6px 10px', fontSize: 13, fontFamily: 'Lexend, sans-serif', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8, color: o.barato ? VERDE : 'var(--sl-text-primary)', fontWeight: o.barato ? 600 : 400 }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--sl-card-alt)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            >
              <span>{o.nombre}</span>
              {o.barato ? <span style={{ fontSize: 11, color: VERDE, whiteSpace: 'nowrap' }}>✔ más barato</span> : o.tag ? <span style={{ fontSize: 11, color: 'var(--sl-text-muted)', whiteSpace: 'nowrap' }}>{o.tag}</span> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
