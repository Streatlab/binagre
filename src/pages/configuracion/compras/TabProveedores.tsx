import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BigCard } from '@/components/configuracion/BigCard'
import { EditModal, Field } from '@/components/configuracion/EditModal'

interface Prov {
  id: string
  abv: string
  categoria: string | null
  nombre: string | null
  nombre_completo: string
  marca_principal: string | null
  marca_asociada: string | null
}

export default function TabProveedores() {
  const [provs, setProvs] = useState<Prov[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Prov | null>(null)
  const [creating, setCreating] = useState(false)
  const [fAbv, setFAbv] = useState('')
  const [fCat, setFCat] = useState('')
  const [fNom, setFNom] = useState('')
  const [fMarca, setFMarca] = useState('')
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
    } else {
      setCreating(true); setEditing(null)
      setFAbv(''); setFCat(''); setFNom(''); setFMarca('')
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

  if (loading) return <div className="p-6 text-[var(--sl-text-muted)]">Cargando...</div>
  if (error) return <div className="p-6 bg-[var(--sl-border-error)]/20 text-[var(--sl-border-error)] rounded-xl">{error}</div>

  return (
    <>
      <BigCard title="Proveedores" count={`${provs.length}`}>
        <table className="sl-cfg-table">
          <thead>
            <tr>
              <th>ABV</th>
              <th>Categoría</th>
              <th>Nombre</th>
              <th>Marca principal</th>
            </tr>
          </thead>
          <tbody>
            {provs.map(p => (
              <tr key={p.id} onClick={() => open(p)} className="row-click">
                <td>
                  <span className="inline-block px-2 py-[3px] rounded bg-[#1A1A1A] text-white text-[10px] tracking-[0.04em] font-bold">{p.abv}</span>
                </td>
                <td>{p.categoria ?? '—'}</td>
                <td><strong>{nomDe(p)}</strong></td>
                <td>{marcaDe(p) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => open()} className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--sl-btn-save-bg)] text-white hover:bg-[#901A1E] tracking-[0.04em]">+ Nuevo proveedor</button>
      </BigCard>

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
        </EditModal>
      )}
    </>
  )
}
