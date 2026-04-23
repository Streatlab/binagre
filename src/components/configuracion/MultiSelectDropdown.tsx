import { useState, useRef, useEffect } from 'react'
import { useTheme, FONT } from '@/styles/tokens'

interface Opt { value: string; label: string }

interface Props {
  label: string
  options: Opt[]
  selected: string[]
  onChange: (v: string[]) => void
}

export function MultiSelectDropdown({ label, options, selected, onChange }: Props) {
  const { T, isDark } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function toggle(v: string) {
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])
  }

  const summary = selected.length === 0
    ? label
    : selected.length === 1
      ? options.find(o => o.value === selected[0])?.label ?? label
      : `${label} (${selected.length})`

  const activeBg = isDark ? 'rgba(176,29,35,0.22)' : '#FCE0E2'
  const hoverBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '8px 14px',
          border: `1px solid ${selected.length > 0 ? '#B01D23' : T.brd}`,
          borderRadius: 8,
          background: selected.length > 0 ? activeBg : T.card,
          color: selected.length > 0 ? '#B01D23' : T.pri,
          fontFamily: FONT.heading,
          fontSize: 12,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          fontWeight: selected.length > 0 ? 600 : 500,
          cursor: 'pointer',
          minHeight: 36,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          transition: 'all 0.15s',
        }}
      >
        {summary}
        <span style={{ fontSize: 9, color: T.mut }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            marginTop: 8,
            width: 260,
            maxHeight: 320,
            overflowY: 'auto',
            background: T.card,
            border: `1px solid ${T.brd}`,
            borderRadius: 10,
            boxShadow: isDark ? '0 12px 24px rgba(0,0,0,0.5)' : '0 12px 24px rgba(0,0,0,0.12)',
            zIndex: 20,
            padding: 4,
          }}
        >
          {options.length === 0 && (
            <div style={{ padding: 12, fontSize: 12, color: T.mut, fontFamily: FONT.body }}>Sin opciones</div>
          )}
          {options.map(o => {
            const on = selected.includes(o.value)
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: 13,
                  borderRadius: 6,
                  background: 'transparent',
                  border: 'none',
                  color: T.pri,
                  fontFamily: FONT.body,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 16,
                    height: 16,
                    borderRadius: 3,
                    border: `1px solid ${on ? '#B01D23' : T.brd}`,
                    background: on ? '#B01D23' : 'transparent',
                    color: '#ffffff',
                    fontSize: 10,
                    lineHeight: 1,
                  }}
                >
                  {on ? '✓' : ''}
                </span>
                {o.label}
              </button>
            )
          })}
          {selected.length > 0 && (
            <div style={{ borderTop: `1px solid ${T.brd}`, marginTop: 4, paddingTop: 4 }}>
              <button
                type="button"
                onClick={() => onChange([])}
                style={{
                  width: '100%',
                  padding: '7px 12px',
                  fontSize: 11,
                  color: '#B01D23',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  fontFamily: FONT.heading,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = activeBg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >Limpiar</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
