import { useEffect, useState } from 'react'
import { Star, Landmark } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { fmtEur } from '@/lib/format'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'
import { EditModal, Field } from '@/components/configuracion/EditModal'
import { StatusTag } from '@/components/configuracion/StatusTag'

interface Cuenta {
  id: string
  alias: string
  banco: string
  iban: string | null
  swift: string | null
  saldo_actual: number | null
  activa: boolean
  es_principal: boolean
}

function maskIban(iban: string | null | undefined): string {
  if (!iban) return '—'
  const clean = iban.replace(/\s+/g, '')
  if (clean.length < 6) return clean
  return '•••• •••• •••• ' + clean.slice(-4)
}

export default function CuentasPanel() {
  const { T, isDark } = useTheme()
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Cuenta | null>(null)
  const [fAlias, setFAlias] = useState('')
  const [fBanco, setFBanco] = useState('')
  const [fIban, setFIban] = useState('')
  const [fSwift, setFSwift] = useState('')
  const [fSaldo, setFSaldo] = useState('0')
  const [fActiva, setFActiva] = useState(true)
  const [fPrincipal, setFPrincipal] = useState(false)
  const [saving, setSaving] = useState(false)

  async function refetch() {
    const { data, error } = await supabase
      .from('cuentas_bancarias')
      .select('id, alias, banco, iban, swift, saldo_actual, activa, es_principal')
      .order('alias')
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
      setFSaldo(String(c.saldo_actual ?? 0))
      setFActiva(c.activa ?? true)
      setFPrincipal(c.es_principal ?? false)
    } else {
      setCreating(true); setEditing(null)
      setFAlias(''); setFBanco(''); setFIban(''); setFSwift('')
      setFSaldo('0'); setFActiva(true); setFPrincipal(false)
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
        saldo_actual: parseFloat(fSaldo.replace(',', '.')) || 0,
        activa: fActiva,
        es_principal: fPrincipal,
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
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '1.3px',
    color: T.mut,
    fontWeight: 500,
    background: T.bg,
    textAlign: 'left',
    borderBottom: `1px solid ${T.brd}`,
  }
  const thNum: React.CSSProperties = { ...th, textAlign: 'right' }
  const thCenter: React.CSSProperties = { ...th, textAlign: 'center' }
  const td: React.CSSProperties = { padding: '12px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri }
  const mono: React.CSSProperties = { ...td, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5 }

  return (
    <>
      <ConfigGroupCard title="Cuentas bancarias" subtitle={`${cuentas.length}`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Alias</th>
                <th style={th}>Banco</th>
                <th style={th}>IBAN</th>
                <th style={th}>SWIFT</th>
                <th style={thNum}>Saldo</th>
                <th style={th}>Estado</th>
                <th style={thCenter}>Principal</th>
              </tr>
            </thead>
            <tbody>
              {cuentas.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 22px', textAlign: 'center' }}>
                    <Landmark size={32} color={T.mut} style={{ marginBottom: 12 }} />
                    <div style={{ fontFamily: FONT.heading, fontSize: 13, color: T.pri, letterSpacing: '1.3px', textTransform: 'uppercase', marginBottom: 6 }}>
                      Sin cuentas registradas
                    </div>
                    <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, maxWidth: 400, margin: '0 auto' }}>
                      Añade tu primera cuenta bancaria para poder conciliar movimientos importados.
                    </div>
                  </td>
                </tr>
              ) : cuentas.map(c => (
                <tr
                  key={c.id}
                  onClick={() => open(c)}
                  style={{ borderBottom: `0.5px solid ${T.brd}`, cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ ...td, fontWeight: 600 }}>{c.alias}</td>
                  <td style={td}>{c.banco}</td>
                  <td style={mono}>{maskIban(c.iban)}</td>
                  <td style={mono}>{c.swift ?? '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {c.saldo_actual != null ? fmtEur(c.saldo_actual) : '—'}
                  </td>
                  <td style={td}>
                    <StatusTag variant={c.activa ? 'ok' : 'off'}>{c.activa ? 'Activa' : 'Inactiva'}</StatusTag>
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {c.es_principal ? (
                      <Star size={16} fill="#F5C36B" color="#F5C36B" />
                    ) : (
                      <span style={{ color: T.mut }}>—</span>
                    )}
                  </td>
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
          <Field label="Saldo actual (€)">
            <input
              value={fSaldo}
              onChange={(e) => setFSaldo(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--sl-border-focus)]"
            />
          </Field>
          <Field label="Estado">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={fActiva} onChange={(e) => setFActiva(e.target.checked)} />
              <span>Cuenta activa</span>
            </label>
          </Field>
          <Field label="Principal">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={fPrincipal} onChange={(e) => setFPrincipal(e.target.checked)} />
              <span>Marcar como cuenta principal</span>
            </label>
          </Field>
        </EditModal>
      )}
    </>
  )
}
