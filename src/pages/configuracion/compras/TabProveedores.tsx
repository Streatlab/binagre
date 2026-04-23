import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BigCard } from '@/components/configuracion/BigCard'
import { EditModal, Field } from '@/components/configuracion/EditModal'

interface ProveedorLegacy {
  id: string
  abv: string
  nombre_completo: string
  categoria: string | null
  marca_asociada: string | null
  activo: boolean
}

export default function TabProveedores() {
  const [provs, setProvs] = useState<ProveedorLegacy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<ProveedorLegacy | null>(null)
  const [creating, setCreating] = useState(false)
  const [fCat, setFCat] = useState('')
  const [fAbv, setFAbv] = useState('')
  const [fNombre, setFNombre] = useState('')
  const [fMarca, setFMarca] = useState('')
  const [saving, setSaving] = useState(false)

  async function refetch() {
    const { data, error } = await supabase.from('config_proveedores').select('*').order('abv')
    if (error) throw error
    setProvs((data ?? []) as unknown as ProveedorLegacy[])
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  function open(p?: ProveedorLegacy) {
    if (p) {
      setEditing(p); setCreating(false)
      setFCat(p.categoria ?? ''); setFAbv(p.abv ?? ''); setFNombre(p.nombre_completo ?? ''); setFMarca(p.marca_asociada ?? '')
    } else {
      setCreating(true); setEditing(null)
      setFCat(''); setFAbv(''); setFNombre(''); setFMarca('')
    }
  }
  function close() { setEditing(null); setCreating(false) }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        categoria: fCat.trim() || null,
        abv: fAbv.trim().toUpperCase(),
        nombre_completo: fNombre.trim(),
        marca_asociada: fMarca.trim() || null,
        activo: true,
      }
      const q = editing
        ? supabase.from('config_proveedores').update(payload).eq('id', editing.id)
        : supabase.from('config_proveedores').insert(payload)
      const { error } = await q
      if (error) throw error
      await refetch(); close()
    } catch (e: any) { setError(e?.message ?? 'Error') } finally { setSaving(false) }
  }
  async function handleDelete() {
    if (!editing) return
    if (!confirm(`Eliminar proveedor "${editing.nombre_completo}"?`)) return
    const { error } = await supabase.from('config_proveedores').delete().eq('id', editing.id)
    if (error) { setError(error.message); return }
    await refetch(); close()
  }

  if (loading) return <div className="p-6 text-[#9E9588]">Cargando...</div>
  if (error) return <div className="p-6 bg-[#FCE0E2] text-[#D63A49] rounded-xl">{error}</div>

  return (
    <>
      <BigCard title="Proveedores" count={`${provs.length}`}>
        <table className="w-full text-[13.5px] border-collapse mb-3">
          <thead>
            <tr>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">ABV</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Categoría</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Nombre</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Marca principal</th>
            </tr>
          </thead>
          <tbody>
            {provs.map(p => (
              <tr key={p.id} onClick={() => open(p)} className="border-b border-[#F0E8D5] cursor-pointer hover:bg-[#FAF4E4]">
                <td className="py-3.5 px-3.5">
                  <span className="inline-block px-2 py-[3px] rounded bg-[#1A1A1A] text-white text-[10px] tracking-[0.04em] font-bold">{p.abv}</span>
                </td>
                <td className="py-3.5 px-3.5">{p.categoria ?? '—'}</td>
                <td className="py-3.5 px-3.5"><strong>{p.nombre_completo}</strong></td>
                <td className="py-3.5 px-3.5">{p.marca_asociada ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => open()} className="px-3.5 py-2 rounded-lg text-xs font-medium bg-[#B01D23] text-white hover:bg-[#901A1E]">+ Nuevo proveedor</button>
      </BigCard>

      {(editing || creating) && (
        <EditModal
          title={editing ? 'Editar proveedor' : 'Nuevo proveedor'}
          onSave={handleSave}
          onCancel={close}
          onDelete={editing ? handleDelete : undefined}
          saving={saving}
          canSave={!!fAbv.trim() && !!fNombre.trim()}
        >
          <Field label="ABV"><input value={fAbv} onChange={(e) => setFAbv(e.target.value)} className="w-full px-3 py-2 border border-[#E9E1D0] rounded-lg text-sm font-mono" /></Field>
          <Field label="Categoría"><input value={fCat} onChange={(e) => setFCat(e.target.value)} className="w-full px-3 py-2 border border-[#E9E1D0] rounded-lg text-sm" /></Field>
          <Field label="Nombre"><input value={fNombre} onChange={(e) => setFNombre(e.target.value)} className="w-full px-3 py-2 border border-[#E9E1D0] rounded-lg text-sm" /></Field>
          <Field label="Marca principal"><input value={fMarca} onChange={(e) => setFMarca(e.target.value)} className="w-full px-3 py-2 border border-[#E9E1D0] rounded-lg text-sm" /></Field>
        </EditModal>
      )}
    </>
  )
}
