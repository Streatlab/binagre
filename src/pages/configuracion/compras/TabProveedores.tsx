import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useIsDark } from '@/hooks/useIsDark'
import { KpiCard, KpiGrid } from '@/components/configuracion/KpiCard'
import { BigCard } from '@/components/configuracion/BigCard'
import { Toolbar, Spacer, BtnRed, SearchInput } from '@/components/configuracion/Toolbar'
import { AbvBadge } from '@/components/configuracion/AbvBadge'
import { Table, THead, TBody, TH, TR, TD } from '@/components/configuracion/ConfigTable'
import { ConfigModal, ConfigField, useInputStyle, ModalActions } from '@/components/configuracion/ConfigModal'

interface ProveedorLegacy {
  id: string
  abv: string
  nombre_completo: string
  categoria: string | null
  marca_asociada: string | null
  activo: boolean
}

export default function TabProveedores() {
  const isDark = useIsDark()
  const [rows, setRows] = useState<ProveedorLegacy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ editing: ProveedorLegacy | null } | null>(null)

  const refetch = async () => {
    const { data, error } = await supabase.from('config_proveedores').select('*').order('abv')
    if (error) throw error
    setRows((data ?? []) as unknown as ProveedorLegacy[])
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try { await refetch() }
      catch (e: any) { if (!cancelled) setError(e?.message ?? 'Error') }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(p =>
      (p.abv ?? '').toLowerCase().includes(q) ||
      p.nombre_completo.toLowerCase().includes(q) ||
      (p.categoria ?? '').toLowerCase().includes(q) ||
      (p.marca_asociada ?? '').toLowerCase().includes(q)
    )
  }, [rows, search])

  const handleDelete = async (p: ProveedorLegacy) => {
    if (!confirm(`¿Eliminar proveedor ${p.abv}?`)) return
    const { error } = await supabase.from('config_proveedores').delete().eq('id', p.id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  const mut = isDark ? '#777' : '#9E9588'

  if (loading) return <div style={{ padding: 24, color: mut }}>Cargando proveedores…</div>
  if (error) {
    return (
      <div style={{ padding: 16, background: isDark ? '#3a1a1a' : '#FCE0E2', color: isDark ? '#ff8080' : '#B01D23', borderRadius: 12 }}>
        {error}
      </div>
    )
  }

  const categorias = Array.from(new Set(rows.map(r => r.categoria).filter(Boolean) as string[]))

  return (
    <>
      <KpiGrid>
        <KpiCard label="Proveedores" value={rows.length} sub="registrados" />
        <KpiCard label="Categorías" value={categorias.length} sub={categorias.slice(0, 3).join(' · ') || '—'} />
        <KpiCard label="Activos" value={rows.filter(r => r.activo).length} sub={`de ${rows.length}`} />
        <KpiCard label="Compra mes" value="—" sub="pendiente métrica" subTone="muted" />
      </KpiGrid>

      <Toolbar>
        <SearchInput
          placeholder="Buscar proveedor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Spacer />
        <BtnRed onClick={() => setModal({ editing: null })}>+ Añadir proveedor</BtnRed>
      </Toolbar>

      <BigCard title="Proveedores" count={`${filtrados.length} resultados`}>
        {filtrados.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: mut }}>
            {search ? 'Sin resultados' : 'Sin proveedores registrados'}
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>ABV</TH>
                <TH>Categoría</TH>
                <TH>Nombre</TH>
                <TH>Marca principal</TH>
                <TH num>Acciones</TH>
              </tr>
            </THead>
            <TBody>
              {filtrados.map(p => (
                <TR key={p.id}>
                  <TD><AbvBadge abv={p.abv} /></TD>
                  <TD muted>{p.categoria ?? '—'}</TD>
                  <TD bold>{p.nombre_completo}</TD>
                  <TD muted>{p.marca_asociada ?? '—'}</TD>
                  <TD num>
                    <button
                      onClick={() => setModal({ editing: p })}
                      style={{
                        background: 'none', border: 'none', color: '#B01D23',
                        fontSize: 11, cursor: 'pointer', marginRight: 12, padding: 0,
                        fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', fontWeight: 600,
                        letterSpacing: '0.04em',
                      }}
                    >Editar</button>
                    <button
                      onClick={() => handleDelete(p)}
                      style={{
                        background: 'none', border: 'none', color: mut,
                        fontSize: 11, cursor: 'pointer', padding: 0,
                        fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', fontWeight: 600,
                        letterSpacing: '0.04em',
                      }}
                    >Eliminar</button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </BigCard>

      {modal && (
        <ProveedorModal
          editing={modal.editing}
          onClose={() => setModal(null)}
          onSaved={refetch}
        />
      )}
    </>
  )
}

function ProveedorModal({
  editing, onClose, onSaved,
}: {
  editing: ProveedorLegacy | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const inputStyle = useInputStyle()
  const [abv, setAbv] = useState(editing?.abv ?? '')
  const [nombre, setNombre] = useState(editing?.nombre_completo ?? '')
  const [categoria, setCategoria] = useState(editing?.categoria ?? '')
  const [marca, setMarca] = useState(editing?.marca_asociada ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!abv.trim() || !nombre.trim()) return
    setSaving(true); setError(null)
    const payload = {
      abv: abv.trim().toUpperCase(),
      nombre_completo: nombre.trim(),
      categoria: categoria.trim() || null,
      marca_asociada: marca.trim() || null,
      activo: true,
    }
    const q = editing
      ? supabase.from('config_proveedores').update(payload).eq('id', editing.id)
      : supabase.from('config_proveedores').insert(payload)
    const { error } = await q
    setSaving(false)
    if (error) { setError(error.message); return }
    await onSaved()
    onClose()
  }

  return (
    <ConfigModal title={`${editing ? 'Editar' : 'Añadir'} proveedor`} onClose={onClose}>
      <ConfigField label="ABV">
        <input
          value={abv}
          onChange={e => setAbv(e.target.value)}
          style={{ ...inputStyle, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
          placeholder="MER"
        />
      </ConfigField>
      <ConfigField label="Nombre">
        <input value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} placeholder="Mercadona" />
      </ConfigField>
      <ConfigField label="Categoría">
        <input value={categoria} onChange={e => setCategoria(e.target.value)} style={inputStyle} placeholder="Supermercado" />
      </ConfigField>
      <ConfigField label="Marca principal">
        <input value={marca} onChange={e => setMarca(e.target.value)} style={inputStyle} placeholder="Hacendado" />
      </ConfigField>
      {error && (
        <div style={{ marginTop: 12, padding: 8, background: '#FCE0E2', color: '#B01D23', fontSize: 12, borderRadius: 6 }}>
          {error}
        </div>
      )}
      <ModalActions
        onCancel={onClose}
        onSave={handleSave}
        saving={saving}
        disabled={!abv.trim() || !nombre.trim()}
      />
    </ConfigModal>
  )
}
