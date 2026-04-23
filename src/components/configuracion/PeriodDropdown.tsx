import { useState } from 'react'

export type Periodo = '30d' | 'mes_curso' | '60d' | '90d' | 'custom'

interface Props {
  value: Periodo
  onChange: (v: Periodo, range?: [string, string]) => void
  customRange?: [string, string]
}

const LABELS: Record<Periodo, string> = {
  '30d': 'Últimos 30 días',
  'mes_curso': 'Mes en curso',
  '60d': 'Últimos 60 días',
  '90d': 'Últimos 90 días',
  'custom': 'Personalizado',
}

export function PeriodDropdown({ value, onChange, customRange }: Props) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(customRange?.[0] ?? '')
  const [to, setTo] = useState(customRange?.[1] ?? '')

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-[#B01D23] text-xs font-medium underline decoration-dotted underline-offset-4 hover:text-[#901A1E]"
      >{LABELS[value]} ▾</button>
      {open && (
        <div className="absolute right-0 mt-2 w-[220px] bg-white border border-[#E9E1D0] rounded-lg shadow-lg z-20 p-1">
          {(['30d','mes_curso','60d','90d','custom'] as Periodo[]).map(p => (
            <button
              key={p}
              onClick={() => {
                if (p !== 'custom') { onChange(p); setOpen(false) }
                else onChange(p, [from || '', to || ''])
              }}
              className={`block w-full text-left px-3 py-2 text-xs rounded ${value === p ? 'bg-[#FCE0E2] text-[#B01D23] font-medium' : 'hover:bg-[#F1EADD]'}`}
            >{LABELS[p]}</button>
          ))}
          {value === 'custom' && (
            <div className="p-2 border-t border-[#E9E1D0] mt-1 space-y-2">
              <div>
                <label className="text-[10px] uppercase text-[#9E9588] tracking-[0.12em]">Desde</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full px-2 py-1 border border-[#E9E1D0] rounded text-xs" />
              </div>
              <div>
                <label className="text-[10px] uppercase text-[#9E9588] tracking-[0.12em]">Hasta</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full px-2 py-1 border border-[#E9E1D0] rounded text-xs" />
              </div>
              <button
                onClick={() => { onChange('custom', [from, to]); setOpen(false) }}
                disabled={!from || !to}
                className="w-full px-3 py-1.5 text-xs bg-[#B01D23] text-white rounded-md hover:bg-[#901A1E] disabled:opacity-50"
              >Aplicar</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
