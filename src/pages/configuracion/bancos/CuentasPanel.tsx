import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BigCard } from '@/components/configuracion/BigCard'
import { EditModal, Field } from '@/components/configuracion/EditModal'

interface Cuenta {
  id: string
  alias: string
  banco: string
  iban: string | null
  swift: string | null
}

export default function CuentasPanel() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Cuenta | null>(null)
  const [fAlias, setFAlias] = useState('')
  const [fBanco, setFBanco] = useState('')
  const [fIban, setFIban] = useState('')
  const [fSwift, setFSwift] = useState('')
  const [saving, setSaving] = useState(false)

  async function refetch() {
    const { data, error } = await supabase.from('cuentas_bancarias').select('id, alias, banco, iban, swift').order('alias')
    if (error) throw error
    setCuentas((data ?? []) as Cuenta[])
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  function open(c?: Cuenta) {
    if (c) {
      setEditing(c); setCreating(false)
      setFAlias(c.alias); setFBanco(c.banco); setFIban(c.iban ?? ''); setFSwift(c.swift ?? '')
    } else {
      setCreating(true); setEditing(null)
      setFAlias(''); setFBanco(''); setFIban(''); setFSwift('')
    }
  }
  function close() { setEditing(null); setCreating(false) }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        alias: fAlias.trim(),
        banco: fBanco.trim(),
        iban: fIban.trim() || null,
        swift: fSwift.trim() || null,
      }
      const q = editing
        ? supabase.from('cuentas_bancarias').update(payload).eq('id', editing.id)
        : supabase.from('cuentas_bancarias').insert(payload)
      const { error } = await q; if (error) throw error
      await refetch(); close()
    } catch (e: any) { setError(e?.message ?? 'Error') } finally { setSaving(false) }
  }
  async function handleDelete() {
    if (!editing) return
    if (!confirm(`Eliminar cuenta "${editing.alias}"?`)) return
    const { error } = await supabase.from('cuentas_bancarias').delete().eq('id', editing.id)
    if (error) { setError(error.message); return }
    await refetch(); close()
  }

  if (loading) return <div className="p-6 text-[#9E9588]">Cargando...</div>
  if (error) return <div className="p-6 bg-[#FCE0E2] text-[#D63A49] rounded-xl">{error}</div>

  return (
    <>
      <BigCard title="Cuentas bancarias" count={`${cuentas.length}`}>
        <table className="w-full border-collapse text-[13.5px] mb-4">
          <thead>
            <tr>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] font-medium text-left">Alias</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] font-medium text-left">Banco</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] font-medium text-left">IBAN</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] font-medium text-left">SWIFT</th>
            </tr>
          </thead>
          <tbody>
            {cuentas.map(c => (
              <tr key={c.id} onClick={() => open(c)} className="border-b border-[#F0E8D5] cursor-pointer hover:bg-[#FAF4E4]">
                <td className="py-3.5 px-3.5"><strong>{c.alias}</strong></td>
                <td className="py-3.5 px-3.5">{c.banco}</td>
                <td className="py-3.5 px-3.5 font-mono text-[12.5px]">{c.iban ?? '—'}</td>
                <td className="py-3.5 px-3.5 font-mono text-[12.5px]">{c.swift ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => open()} className="px-4 py-2 rounded-lg text-xs font-medium bg-[#B01D23] text-white hover:bg-[#901A1E] tracking-[0.04em]">+ Nueva cuenta</button>
      </BigCard>

      {(editing || creating) && (
        <EditModal
          title={editing ? 'Editar cuenta' : 'Nueva cuenta'}
          onSave={handleSave} onCancel={close}
          onDelete={editing ? handleDelete : undefined}
          saving={saving} canSave={!!fAlias.trim() && !!fBanco.trim()}
        >
          <Field label="Alias"><input value={fAlias} onChange={(e) => setFAlias(e.target.value)} autoFocus className="w-full px-3 py-2 border border-[#E9E1D0] rounded-lg text-sm focus:outline-none focus:border-[#B01D23]" /></Field>
          <Field label="Banco"><input value={fBanco} onChange={(e) => setFBanco(e.target.value)} className="w-full px-3 py-2 border border-[#E9E1D0] rounded-lg text-sm focus:outline-none focus:border-[#B01D23]" /></Field>
          <Field label="IBAN"><input value={fIban} onChange={(e) => setFIban(e.target.value)} className="w-full px-3 py-2 border border-[#E9E1D0] rounded-lg text-sm font-mono focus:outline-none focus:border-[#B01D23]" /></Field>
          <Field label="SWIFT"><input value={fSwift} onChange={(e) => setFSwift(e.target.value)} className="w-full px-3 py-2 border border-[#E9E1D0] rounded-lg text-sm font-mono focus:outline-none focus:border-[#B01D23]" /></Field>
        </EditModal>
      )}
    </>
  )
}
