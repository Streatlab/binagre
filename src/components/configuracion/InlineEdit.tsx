import { useState, useRef, useEffect } from 'react'
import type { KeyboardEvent } from 'react'

type InlineType = 'text' | 'number' | 'percent' | 'currency'

interface Props {
  value: string | number | null
  onSubmit: (newValue: string | number) => Promise<void> | void
  type?: InlineType
  placeholder?: string
  align?: 'left' | 'right'
  min?: number
  max?: number
  step?: number
}

export function InlineEdit({
  value, onSubmit, type = 'text', placeholder, align = 'left',
  min, max, step,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState<string>(formatDisplay(value, type))
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])
  useEffect(() => { setLocal(formatDisplay(value, type)) }, [value, type])

  async function commit() {
    const parsed = parseInput(local, type)
    if (parsed === null) { setLocal(formatDisplay(value, type)); setEditing(false); return }
    if (parsed === value) { setEditing(false); return }
    setSaving(true)
    try {
      await onSubmit(parsed)
    } finally {
      setSaving(false); setEditing(false)
    }
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commit() }
    else if (e.key === 'Escape') { setLocal(formatDisplay(value, type)); setEditing(false) }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type === 'text' ? 'text' : 'number'}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        min={min} max={max} step={step ?? (type === 'text' ? undefined : 0.01)}
        disabled={saving}
        className={`w-full px-2 py-1 rounded-md border-2 border-[#B01D23] bg-white text-[13.5px] font-medium focus:outline-none ${align === 'right' ? 'text-right tabular-nums' : ''}`}
        placeholder={placeholder}
      />
    )
  }

  const display = formatDisplay(value, type)
  return (
    <span
      onClick={() => setEditing(true)}
      className={`inline-block w-full cursor-pointer rounded-md px-2 py-1 hover:bg-[#FAF4E4] ${align === 'right' ? 'text-right tabular-nums' : ''} ${display === '' ? 'text-[#9E9588]' : ''}`}
      title="Click para editar"
    >
      {display || placeholder || '—'}
    </span>
  )
}

function formatDisplay(v: string | number | null, t: InlineType): string {
  if (v == null || v === '') return ''
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  if (t === 'percent') return Number.isFinite(n) ? `${n.toFixed(2).replace('.', ',')}%` : ''
  if (t === 'currency') return Number.isFinite(n) ? `${n.toFixed(2).replace('.', ',')} €` : ''
  if (t === 'number') return Number.isFinite(n) ? String(n).replace('.', ',') : ''
  return String(v)
}

function parseInput(s: string, t: InlineType): string | number | null {
  if (t === 'text') return s.trim()
  const cleaned = s.replace('%', '').replace('€', '').replace(/\s/g, '').replace(',', '.').trim()
  if (cleaned === '') return null
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}
