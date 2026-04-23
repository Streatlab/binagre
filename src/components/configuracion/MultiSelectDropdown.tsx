import { useState, useRef, useEffect } from 'react'

interface Opt { value: string; label: string }

interface Props {
  label: string
  options: Opt[]
  selected: string[]
  onChange: (v: string[]) => void
}

export function MultiSelectDropdown({ label, options, selected, onChange }: Props) {
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`px-3 py-2 rounded-lg text-[13px] border flex items-center gap-2 ${
          selected.length > 0
            ? 'border-[#B01D23] bg-[#FCE0E2] text-[#B01D23] font-medium'
            : 'border-[#E9E1D0] bg-white text-[#1A1A1A]'
        } hover:border-[#B01D23]`}
      >
        {summary}
        <span className="text-[9px] text-[#9E9588]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-[260px] max-h-[320px] overflow-y-auto bg-white border border-[#E9E1D0] rounded-lg shadow-lg z-20 p-1">
          {options.length === 0 && <div className="p-3 text-xs text-[#9E9588]">Sin opciones</div>}
          {options.map(o => {
            const on = selected.includes(o.value)
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className="flex items-center gap-2 w-full px-3 py-2 text-[13px] rounded hover:bg-[#FAF4E4] text-left"
              >
                <span
                  className={`inline-block w-4 h-4 rounded border ${
                    on ? 'border-[#B01D23] bg-[#B01D23]' : 'border-[#DDD4BF] bg-white'
                  } flex items-center justify-center`}
                >
                  {on && <span className="text-white text-[10px] leading-none">✓</span>}
                </span>
                {o.label}
              </button>
            )
          })}
          {selected.length > 0 && (
            <div className="border-t border-[#E9E1D0] mt-1 pt-1">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full px-3 py-1.5 text-xs text-[#B01D23] hover:bg-[#FCE0E2] rounded"
              >Limpiar</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
