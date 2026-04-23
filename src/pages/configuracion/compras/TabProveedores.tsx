import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'
import { EditModal, Field } from '@/components/configuracion/EditModal'
import { StatusTag } from '@/components/configuracion/StatusTag'

interface Prov {
  id: string
  abv: string
  categoria: string | null
  nombre: string | null
  nombre_completo: string
  marca_principal: string | null
  marca_asociada: string | null
  activo: boolean
}

export default function TabProveedores() {
  const { T, isDark } = useTheme()
  const [provs, setProvs] = useState<Prov[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Prov | null>(null)
  const [creating, setCreating] = useState(false)
  const [fAbv, setFAbv] = useState('')
  const [fCat, setFCat] = useState('')
  const [fNom, setFNom] = useState('')
  const [fMarca, setFMarca] = useState('')
  const [fActivo, setFActivo] = useState(true)
  const [saving, setSaving] = useState(false)

  async function refetch() {
    const { data, error } = await supabase.from('config_proveedores').select('*').order('abv')
    if (error) throw error
    setProvs((data ?? []) as Prov[])
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  function nomDe(p: Prov): string { return p.nombre ?? p.nombre_completo ?? '' }
  function marcaDe(p: Prov): string { return p.marca_principal ?? p.marca_asociada ?? '' }

  function open(p?: Prov) {
    if (p) {
      setEditing(p); setCreating(false)
      setFAbv(p.abv); setFCat(p.categoria ?? ''); setFNom(nomDe(p)); setFMarca(marcaDe(p))
      setFActivo(p.activo ?? true)
    } else {
      setCreating(true); setEditing(null)
      setFAbv(''); setFCat(''); setFNom(''); setFMarca(''); setFActivo(true)
    }
  }
  function close() { setEditing(null); setCreating(false) }

  async function handleSave() {
    setSaving(true)
    try {
      const nom = fNom.trim()
      const marca = fMarca.trim()
      const payload: any = {
        abv: fAbv.trim().toUpperCase(),
        categoria: fCat.trim() || null,
        nombre: nom,
        nombre_completo: nom,
        marca_principal: marca || null,
        marca_asociada: marca || null,
        activo: fActivo,
      }
      const q = editing
        ? supabase.from('config_proveedores').update(payload).eq('id', editing.id)
        : supabase.from('config_proveedores').insert(payload)
      const { error } = await q; if (error) throw error
      await refetch(); close()
    } catch (e: any) { setError(e?.message ?? 'Error') } finally { setSaving(false) }
  }
  async function handleDelete() {
    if (!editing) return
    if (!confirm(`Eliminar proveedor "${nomDe(editing)}"?`)) return
    const { error } = await supabase.from('config_proveedores').delete().eq('id', editing.id)
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
    borderBottom: `1px solid ${T.brd}`,
    textAlign: 'left',
  }
  const td: React.CSSProperties = { padding: '12px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri }

  return (
    <>
      <ConfigGroupCard title="Proveedores" subtitle={`${provs.length}`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>ABV</th>
                <th style={th}>Categoría</th>
                <th style={th}>Nombre</th>
                <th style={th}>Marca principal</th>
                <th style={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {provs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px 22px', textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>
                    Sin proveedores.
                  </td>
                </tr>
              ) : provs.map(p => (
                <tr
                  key={p.id}
                  onClick={() => open(p)}
                  style={{ borderBottom: `0.5px solid ${T.brd}`, cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={td}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        background: isDark ? T.card : T.pri,
                        color: isDark ? T.pri : T.bg,
                        borderRadius: 6,
                        fontSize: 11,
                        letterSpacing: '0.8px',
                        fontWeight: 600,
                        fontFamily: FONT.heading,
                      }}
                    >
                      {p.abv}
                    </span>
                  </td>
                  <td style={{ ...td, color: T.sec }}>{p.categoria ?? '—'}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{nomDe(p)}</td>
                  <td style={{ ...td, color: T.sec }}>{marcaDe(p) || '—'}</td>
                  <td style={td}>
                    <StatusTag variant={p.activo ? 'ok' : 'off'}>{p.activo ? 'Activo' : 'Inactivo'}</StatusTag>
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
          >+ Nuevo proveedor</button>
        </div>
      </ConfigGroupCard>

      {(editing || creating) && (
        <EditModal
          title={editing ? 'Editar proveedor' : 'Nuevo proveedor'}
          onSave={handleSave} onCancel={close}
          onDelete={editing ? handleDelete : undefined}
          saving={saving} canSave={!!fAbv.trim() && !!fNom.trim()}
        >
          <Field label="ABV"><input value={fAbv} onChange={(e) => setFAbv(e.target.value)} autoFocus maxLength={5} className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm font-mono uppercase focus:outline-none focus:border-[var(--sl-border-focus)]" /></Field>
          <Field label="Categoría"><input value={fCat} onChange={(e) => setFCat(e.target.value)} className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--sl-border-focus)]" /></Field>
          <Field label="Nombre"><input value={fNom} onChange={(e) => setFNom(e.target.value)} className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--sl-border-focus)]" /></Field>
          <Field label="Marca principal"><input value={fMarca} onChange={(e) => setFMarca(e.target.value)} className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--sl-border-focus)]" /></Field>
          <Field label="Estado">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={fActivo} onChange={(e) => setFActivo(e.target.checked)} />
              <span>Proveedor activo</span>
            </label>
          </Field>
        </EditModal>
      )}
    </>
  )
}
