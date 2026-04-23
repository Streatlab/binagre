import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'
import { EditModal, Field } from '@/components/configuracion/EditModal'

interface Cuenta {
  id: string
  alias: string
  banco: string
  iban: string | null
  swift: string | null
}

export default function CuentasPanel() {
  const { T } = useTheme()
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
    if (c) { setEditing(c); setCreating(false); setFAlias(c.alias); setFBanco(c.banco); setFIban(c.iban ?? ''); setFSwift(c.swift ?? '') }
    else { setCreating(true); setEditing(null); setFAlias(''); setFBanco(''); setFIban(''); setFSwift('') }
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

  if (loading) return <div style={{ padding: 24, color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
  if (error) {
    return (
      <div style={{ padding: 16, background: '#B01D2320', color: '#B01D23', borderRadius: 10, fontFamily: FONT.body }}>
        {error}
      </div>
    )
  }

  const th: React.CSSProperties = {
    padding: '10px 14px',
    fontFamily: FONT.heading,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '2px',
    color: T.mut,
    fontWeight: 400,
    background: T.group,
    textAlign: 'left',
  }
  const td: React.CSSProperties = { padding: '10px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri }
  const mono: React.CSSProperties = { ...td, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5 }

  return (
    <>
      <ConfigGroupCard title="Cuentas bancarias" subtitle={`${cuentas.length}`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderTop: `0.5px solid ${T.brd}`, borderBottom: `0.5px solid ${T.brd}`, background: T.group }}>
                <th style={th}>Alias</th>
                <th style={th}>Banco</th>
                <th style={th}>IBAN</th>
                <th style={th}>SWIFT</th>
              </tr>
            </thead>
            <tbody>
              {cuentas.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '32px 22px', textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>
                    Sin cuentas registradas.
                  </td>
                </tr>
              ) : cuentas.map(c => (
                <tr key={c.id} onClick={() => open(c)} style={{ borderBottom: `0.5px solid ${T.brd}`, cursor: 'pointer' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{c.alias}</td>
                  <td style={td}>{c.banco}</td>
                  <td style={mono}>{c.iban ?? '—'}</td>
                  <td style={mono}>{c.swift ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '14px 22px 18px',
            borderTop: `0.5px solid ${T.brd}`,
            background: T.bg,
          }}
        >
          <button
            onClick={() => open()}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: 'none',
              background: '#B01D23',
              color: '#ffffff',
              fontFamily: FONT.heading,
              fontSize: 11,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >+ Nueva cuenta</button>
        </div>
      </ConfigGroupCard>

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
