import { GRANATE, INK, CREMA, GRIS, BLANCO, OSW, LEX } from '@/styles/neobrutal'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PantallaCantera, HeroCantera, Papel, SHADOW_DURA } from '@/components/kit/cantera'
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

  if (loading) {
    return (
      <PantallaCantera embedded>
        <Papel ceja={GRANATE}><div style={{ padding: 12, fontFamily: LEX, fontSize: 13 }}>Cargando…</div></Papel>
      </PantallaCantera>
    )
  }
  if (error) {
    return (
      <PantallaCantera embedded>
        <Papel ceja={GRANATE}><div style={{ padding: 12, fontFamily: LEX, fontSize: 13, color: GRANATE, fontWeight: 600 }}>{error}</div></Papel>
      </PantallaCantera>
    )
  }

  const activos = provs.filter(p => p.activo).length

  const th: React.CSSProperties = {
    padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px',
    textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'left',
  }
  const td: React.CSSProperties = { padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}` }

  return (
    <PantallaCantera embedded>
      <HeroCantera
        area="equipo"
        titular="Así tienes organizados tus proveedores"
        etiquetaDato="Proveedores dados de alta"
        cifra={provs.length}
        resumen={`${activos} activos de ${provs.length} en total.`}
      />

      <Papel ceja={GRANATE} pad="0" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: INK }}>
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
                  <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: GRIS, fontFamily: LEX, fontSize: 13, fontWeight: 600 }}>
                    Sin proveedores.
                  </td>
                </tr>
              ) : provs.map(p => (
                <tr key={p.id} onClick={() => open(p)} style={{ cursor: 'pointer' }}>
                  <td style={td}>
                    <span style={{ display: 'inline-block', padding: '3px 9px', background: INK, color: CREMA, fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '0.8px' }}>
                      {p.abv}
                    </span>
                  </td>
                  <td style={td}>{p.categoria ?? '—'}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{nomDe(p)}</td>
                  <td style={td}>{marcaDe(p) || '—'}</td>
                  <td style={td}>
                    <StatusTag variant={p.activo ? 'ok' : 'off'}>{p.activo ? 'Activo' : 'Inactivo'}</StatusTag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 16px', borderTop: `2px solid ${INK}` }}>
          <button
            onClick={() => open()}
            style={{
              padding: '8px 14px', border: `2px solid ${INK}`, boxShadow: SHADOW_DURA,
              background: GRANATE, color: BLANCO, fontFamily: OSW, fontSize: 12,
              letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
            }}
          >+ Nuevo proveedor</button>
        </div>
      </Papel>

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
    </PantallaCantera>
  )
}
