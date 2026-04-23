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

  if (loading) return <div className="p-6 text-[var(--sl-text-muted)]">Cargando...</div>
  if (error) return <div className="p-6 bg-[var(--sl-border-error)]/20 text-[var(--sl-border-error)] rounded-xl">{error}</div>

  return (
    <>
      <BigCard title="Cuentas bancarias" count={`${cuentas.length}`}>
        <table className="sl-cfg-table">
          <thead>
            <tr>
              <th>Alias</th>
              <th>Banco</th>
              <th>IBAN</th>
              <th>SWIFT</th>
            </tr>
          </thead>
          <tbody>
            {cuentas.map(c => (
              <tr key={c.id} onClick={() => open(c)} className="row-click">
                <td><strong>{c.alias}</strong></td>
                <td>{c.banco}</td>
                <td style={{ fontFamily: "ui-monospace,monospace", fontSize: 12.5 }}>{c.iban ?? '—'}</td>
                <td style={{ fontFamily: "ui-monospace,monospace", fontSize: 12.5 }}>{c.swift ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => open()} className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--sl-btn-save-bg)] text-white hover:bg-[#901A1E] tracking-[0.04em]">+ Nueva cuenta</button>
      </BigCard>

      {(editing || creating) && (
        <EditModal
          title={editing ? 'Editar cuenta' : 'Nueva cuenta'}
          onSave={handleSave} onCancel={close}
          onDelete={editing ? handleDelete : undefined}
          saving={saving} canSave={!!fAlias.trim() && !!fBanco.trim()}
        >
          <Field label="Alias"><input value={fAlias} onChange={(e) => setFAlias(e.target.value)} autoFocus className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--sl-border-focus)]" /></Field>
          <Field label="Banco"><input value={fBanco} onChange={(e) => setFBanco(e.target.value)} className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--sl-border-focus)]" /></Field>
          <Field label="IBAN"><input value={fIban} onChange={(e) => setFIban(e.target.value)} className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--sl-border-focus)]" /></Field>
          <Field label="SWIFT"><input value={fSwift} onChange={(e) => setFSwift(e.target.value)} className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--sl-border-focus)]" /></Field>
        </EditModal>
      )}
    </>
  )
}
