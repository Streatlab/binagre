import { useState } from 'react'

interface Opt { value: string; label: string }

interface Props {
  value: string | null
  options: Opt[]
  onSubmit: (v: string) => Promise<void> | void
  placeholder?: string
}

export function InlineSelect({ value, options, onSubmit, placeholder }: Props) {
  const [editing, setEditing] = useState(false)
  const current = options.find(o => o.value === value)?.label ?? ''

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={value ?? ''}
        onChange={async (e) => { await onSubmit(e.target.value); setEditing(false) }}
        onBlur={() => setEditing(false)}
        className="w-full px-2 py-1 rounded-md border-2 border-[#B01D23] bg-white text-[13.5px] font-medium focus:outline-none"
      >
        <option value="">—</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }
  return (
    <span
      onClick={() => setEditing(true)}
      className="inline-block w-full cursor-pointer rounded-md px-2 py-1 hover:bg-[#FAF4E4]"
      title="Click para cambiar"
    >
      {current || placeholder || '—'}
    </span>
  )
}
