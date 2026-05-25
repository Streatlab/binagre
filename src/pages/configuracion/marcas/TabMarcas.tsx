import { useEffect, useMemo, useState } from 'react'
import { Trash2, Edit3, Power, Plus, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { EditModal, Field } from '@/components/configuracion/EditModal'
import type { CanalAbv, TipoCocina, EstadoMarca } from '@/types/configuracion'

interface AccesoRow {
  plataforma: CanalAbv
  activo: boolean
  email_acceso?: string | null
}
interface MarcaRow {
  id: string
  nombre: string
  estado: EstadoMarca
  tipo_cocina_id: string | null
  margen_deseado_pct: number
  archivada_at: string | null
  accesos: AccesoRow[]
}

const CANAL_PILL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  UE:  { bg: '#0f0f0f', border: '#0f0f0f', text: '#fff' },
  GL:  { bg: '#FFC107', border: '#FFC107', text: '#111' },
  JE:  { bg: '#F36805', border: '#F36805', text: '#fff' },
  WEB: { bg: '#1D9E75', border: '#1D9E75', text: '#fff' },
  DIR: { bg: '#666',    border: '#666',    text: '#fff' },
}

const PLATAFORMAS: CanalAbv[] = ['UE', 'GL', 'JE', 'WEB', 'DIR']

export default function TabMarcas() {
  const { T, isDark } = useTheme()
  const [marcas, setMarcas] = useState<MarcaRow[]>([])
  const [tiposCocina, setTiposCocina] = useState<TipoCocina[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [incArchivadas, setIncArchivadas] = useState(false)

  const [editing, setEditing] = useState<MarcaRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [fNombre, setFNombre] = useState('')
  const [fCocina, setFCocina] = useState<string>('')
  const [fEstado, setFEstado] = useState<EstadoMarca>('activa')
  const [fMargen, setFMargen] = useState('70')
  const [fCanales, setFCanales] = useState<CanalAbv[]>([])
  const [saving, setSaving] = useState(false)

  const [delModal, setDelModal] = useState<MarcaRow | null>(null)
  const [renameConflict, setRenameConflict] = useState<{ source: MarcaRow; target: MarcaRow } | null>(null)

  async function refetch() {
    setLoading(true); setError(null)
    try {
      const { data: ms, error: e1 } = await supabase
        .from('marcas')
        .select('id, nombre, estado, tipo_cocina_id, margen_deseado_pct, archivada_at')
        .order('nombre', { ascending: true })
      if (e1) throw e1
      const ids = (ms ?? []).map((m: any) => m.id)
      const { data: accesos } = await supabase
        .from('marca_plataforma_acceso')
        .select('marca_id, plataforma, activo, email_acceso')
        .in('marca_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
      const accesosByMarca = new Map<string, AccesoRow[]>()
      for (const a of (accesos ?? []) as any[]) {
        const arr = accesosByMarca.get(a.marca_id) ?? []
        arr.push({ plataforma: a.plataforma, activo: !!a.activo, email_acceso: a.email_acceso })
        accesosByMarca.set(a.marca_id, arr)
      }
      const out: MarcaRow[] = (ms ?? []).map((m: any) => ({
        ...m, accesos: accesosByMarca.get(m.id) ?? [],
      }))
      setMarcas(out)

      const { data: tcs } = await supabase
        .from('tipos_cocina').select('id, nombre').order('nombre')
      setTiposCocina((tcs ?? []) as TipoCocina[])
    } catch (e: any) { setError(e?.message ?? 'Error') } finally { setLoading(false) }
  }
  useEffect(() => { refetch() }, [])

  async function toggleCanal(marca: MarcaRow, canal: CanalAbv) {
    const existente = marca.accesos.find(a => a.plataforma === canal)
    const nuevoEstado = existente ? !existente.activo : true
    if (existente) {
      await supabase
        .from('marca_plataforma_acceso')
        .update({ activo: nuevoEstado })
        .eq('marca_id', marca.id)
        .eq('plataforma', canal)
    } else {
      await supabase
        .from('marca_plataforma_acceso')
        .insert({ marca_id: marca.id, plataforma: canal, activo: true })
    }
    refetch()
  }

  async function toggleMasivo(canales: CanalAbv[], activar: boolean) {
    const visibles = filtradas.map(m => m.id)
    if (!visibles.length) return
    for (const p of canales) {
      const { data: existentes } = await supabase
        .from('marca_plataforma_acceso')
        .select('marca_id')
        .eq('plataforma', p)
        .in('marca_id', visibles)
      const yaExistentes = new Set((existentes ?? []).map((x: any) => x.marca_id))
      const aInsertar = visibles.filter(id => !yaExistentes.has(id))
      if (yaExistentes.size > 0) {
        await supabase
          .from('marca_plataforma_acceso')
          .update({ activo: activar })
          .eq('plataforma', p)
          .in('marca_id', visibles)
      }
      if (activar && aInsertar.length > 0) {
        await supabase.from('marca_plataforma_acceso').insert(
          aInsertar.map(mid => ({ marca_id: mid, plataforma: p, activo: true }))
        )
      }
    }
    refetch()
  }

  async function toggleMarcaCompleta(marca: MarcaRow, activar: boolean) {
    for (const p of ['UE', 'GL', 'JE'] as CanalAbv[]) {
      const ex = marca.accesos.find(a => a.plataforma === p)
      if (ex) {
        await supabase
          .from('marca_plataforma_acceso')
          .update({ activo: activar })
          .eq('marca_id', marca.id)
          .eq('plataforma', p)
      } else if (activar) {
        await supabase
          .from('marca_plataforma_acceso')
          .insert({ marca_id: marca.id, plataforma: p, activo: true })
      }
    }
    refetch()
  }

  const filtradas = useMemo(() => {
    let f = marcas
    if (!incArchivadas) f = f.filter(m => !m.archivada_at)
    if (search.trim()) f = f.filter(m => m.nombre.toLowerCase().includes(search.toLowerCase()))
    return f
  }, [marcas, search, incArchivadas])

  function openNueva() {
    setCreating(true); setEditing(null)
    setFNombre(''); setFCocina(''); setFEstado('activa'); setFMargen('70')
    setFCanales([])
  }
  function openEdit(m: MarcaRow) {
    setEditing(m); setCreating(false)
    setFNombre(m.nombre); setFCocina(m.tipo_cocina_id ?? ''); setFEstado(m.estado); setFMargen(String(m.margen_deseado_pct))
    setFCanales((m.accesos || []).filter(a => a.activo).map(a => a.plataforma as CanalAbv))
  }
  function close() { setEditing(null); setCreating(false) }

  async function syncCanales(marcaId: string, canalesActivos: CanalAbv[]) {
    const plataformas: CanalAbv[] = ['UE', 'GL', 'JE', 'WEB', 'DIR']
    const { data: existentes } = await supabase
      .from('marca_plataforma_acceso')
      .select('plataforma, email_acceso')
      .eq('marca_id', marcaId)
    const emailMap = new Map((existentes ?? []).map((x: any) => [x.plataforma as string, x.email_acceso as string | null]))
    await supabase.from('marca_plataforma_acceso').delete().eq('marca_id', marcaId)
    const rows = plataformas.map(p => ({
      marca_id: marcaId,
      plataforma: p,
      activo: canalesActivos.includes(p),
      email_acceso: emailMap.get(p) ?? null,
    }))
    const { error } = await supabase.from('marca_plataforma_acceso').insert(rows)
    if (error) throw error
  }

  async function handleSave() {
    setSaving(true)
    try {
      const nombre = fNombre.trim()
      if (!nombre) { setSaving(false); return }
      if (editing && nombre !== editing.nombre) {
        const conflict = marcas.find(m => m.id !== editing.id && m.nombre.toLowerCase() === nombre.toLowerCase() && !m.archivada_at)
        if (conflict) {
          setRenameConflict({ source: editing, target: conflict })
          setSaving(false)
          return
        }
        await supabase.from('marca_alias').insert({
          marca_id: editing.id,
          nombre_anterior: editing.nombre,
        })
      }
      const payload = {
        nombre,
        tipo_cocina_id: fCocina || null,
        estado: fEstado,
        margen_deseado_pct: parseFloat(fMargen.replace(',', '.')) || 70,
      }
      let marcaId: string | undefined = editing?.id
      if (editing) {
        const { error } = await supabase.from('marcas').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('marcas').insert(payload).select('id').single()
        if (error) throw error
        marcaId = (data as any)?.id
      }
      if (marcaId) await syncCanales(marcaId, fCanales)
      await refetch(); close()
    } catch (e: any) { setError(e?.message ?? 'Error') } finally { setSaving(false) }
  }

  async function handleUnificar() {
    if (!renameConflict) return
    const { source, target } = renameConflict
    setSaving(true)
    try {
      await supabase.from('marca_alias').insert({
        marca_id: target.id,
        nombre_anterior: source.nombre,
      })
      await supabase.from('facturacion_diario').update({ marca_id: target.id }).eq('marca_id', source.id)
      await supabase.from('marca_plataforma_acceso').delete().eq('marca_id', source.id)
      await supabase.from('marcas').delete().eq('id', source.id)
      setRenameConflict(null)
      await refetch()
      close()
    } catch (e: any) { setError(e?.message ?? 'Error unificando') } finally { setSaving(false) }
  }

  async function handleArchivar(marca: MarcaRow) {
    setSaving(true)
    try {
      await supabase
        .from('marcas')
        .update({ archivada_at: new Date().toISOString(), estado: 'pausada' })
        .eq('id', marca.id)
      await supabase
        .from('marca_plataforma_acceso')
        .update({ activo: false })
        .eq('marca_id', marca.id)
      setDelModal(null)
      await refetch()
      close()
    } catch (e: any) { setError(e?.message ?? 'Error archivando') } finally { setSaving(false) }
  }

  async function handleBorrarTotal(marca: MarcaRow) {
    setSaving(true)
    try {
      await supabase.from('marca_plataforma_acceso').delete().eq('marca_id', marca.id)
      await supabase.from('marca_alias').delete().eq('marca_id', marca.id)
      await supabase.from('facturacion_diario').delete().eq('marca_id', marca.id)
      await supabase.from('marcas').delete().eq('id', marca.id)
      setDelModal(null)
      await refetch()
      close()
    } catch (e: any) { setError(e?.message ?? 'Error borrando') } finally { setSaving(false) }
  }

  if (loading) return <div style={{ padding: 24, color: T.mut, fontFamily: FONT.body }}>Cargando marcas…</div>
  if (error) return (
    <div style={{ padding: 16, background: isDark ? '#3a1a1a' : '#FCE0E2', color: '#B01D23', borderRadius: 10, fontFamily: FONT.body }}>
      {error}
    </div>
  )

  const thStyle: React.CSSProperties = {
    padding: '10px 14px', fontFamily: FONT.heading, fontSize: 10,
    textTransform: 'uppercase', letterSpacing: '2px', color: T.mut,
    fontWeight: 400, background: T.group, textAlign: 'left',
  }
  const thCenterStyle: React.CSSProperties = { ...thStyle, textAlign: 'center' }
  const tdStyle: React.CSSProperties = { padding: '12px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri }

  const PillCanal = ({ canal, activo, onClick }: { canal: CanalAbv; activo: boolean; onClick: (e: React.MouseEvent) => void }) => {
    const colors = CANAL_PILL_COLORS[canal]
    return (
      <button
        onClick={onClick}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '4px 9px', minWidth: 38,
          borderRadius: 5, fontFamily: FONT.heading, fontSize: 10, fontWeight: 700,
          letterSpacing: '1px',
          background: activo ? colors.bg : 'transparent',
          color: activo ? colors.text : T.mut,
          border: activo ? `1px solid ${colors.border}` : `1px dashed ${T.brd}`,
          cursor: 'pointer', transition: 'all 120ms',
          marginRight: 4,
        }}
        title={activo ? `${canal} activo · click para desactivar` : `${canal} inactivo · click para activar`}
      >
        {canal}
      </button>
    )
  }

  return (
    <>
      {/* Header: buscador + nueva marca */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: '0 0 auto' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.mut, pointerEvents: 'none' }} />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar marca..."
            style={{
              background: T.inp, border: `0.5px solid ${T.brd}`, borderRadius: 6,
              padding: '8px 12px 8px 32px', fontSize: 12, fontFamily: FONT.body,
              color: T.pri, width: 260, outline: 'none',
            }}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.mut, fontFamily: FONT.body, cursor: 'pointer' }}>
          <input type="checkbox" checked={incArchivadas} onChange={e => setIncArchivadas(e.target.checked)} />
          Incluir archivadas
        </label>

        <div style={{ flex: 1 }} />

        <button onClick={openNueva}
          style={{
            background: '#B01D23', color: '#ffffff',
            padding: '8px 16px', borderRadius: 6,
            fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px',
            textTransform: 'uppercase', fontWeight: 600, border: 'none', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
          <Plus size={14} /> Nueva marca
        </button>
      </div>

      {/* Barra de acciones masivas */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14, padding: '10px 14px', background: T.group, borderRadius: 10, border: `0.5px solid ${T.brd}` }}>
        <span style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: 1.5, color: T.mut, textTransform: 'uppercase', marginRight: 4 }}>Masivo ({filtradas.length}):</span>
        {([
          { label: 'UE',       canales: ['UE'] as CanalAbv[],            color: '#0f0f0f' },
          { label: 'GL',       canales: ['GL'] as CanalAbv[],            color: '#FFC107' },
          { label: 'JE',       canales: ['JE'] as CanalAbv[],            color: '#F36805' },
          { label: 'UE+GL',    canales: ['UE','GL'] as CanalAbv[],       color: '#666' },
          { label: 'UE+JE',    canales: ['UE','JE'] as CanalAbv[],       color: '#666' },
          { label: 'GL+JE',    canales: ['GL','JE'] as CanalAbv[],       color: '#666' },
          { label: 'UE+GL+JE', canales: ['UE','GL','JE'] as CanalAbv[],  color: '#1D9E75' },
        ]).map(grp => (
          <div key={grp.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 0, marginRight: 4 }}>
            <button onClick={() => toggleMasivo(grp.canales, true)}
              style={{
                padding: '5px 8px', borderRadius: '5px 0 0 5px',
                background: grp.color, color: grp.label === 'GL' ? '#111' : '#fff',
                border: `1px solid ${grp.color}`, borderRight: 'none',
                fontFamily: FONT.heading, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, cursor: 'pointer',
              }}
              title={`Activar ${grp.label} en marcas visibles`}>
              ON {grp.label}
            </button>
            <button onClick={() => toggleMasivo(grp.canales, false)}
              style={{
                padding: '5px 8px', borderRadius: '0 5px 5px 0',
                background: 'transparent', color: T.mut,
                border: `1px solid ${T.brd}`,
                fontFamily: FONT.heading, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, cursor: 'pointer',
              }}
              title={`Desactivar ${grp.label} en marcas visibles`}>
              OFF
            </button>
          </div>
        ))}
      </div>

      {/* Tabla limpia */}
      <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                <th style={thStyle}>Marca</th>
                <th style={thStyle}>Canales</th>
                <th style={thCenterStyle}>Toggle marca</th>
                <th style={thCenterStyle}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(m => {
                const algunoActivo = ['UE', 'GL', 'JE'].some(p => m.accesos.find(a => a.plataforma === p && a.activo))
                return (
                  <tr key={m.id} style={{ borderBottom: `0.5px solid ${T.brd}`, opacity: m.archivada_at ? 0.5 : 1 }}>
                    <td style={{ ...tdStyle, color: T.pri, fontWeight: 600 }}>
                      {m.nombre}
                      {m.archivada_at && <span style={{ marginLeft: 8, fontSize: 9, color: T.mut, fontFamily: FONT.heading, letterSpacing: 1, textTransform: 'uppercase' }}>Archivada</span>}
                    </td>
                    <td style={{ ...tdStyle }}>
                      {PLATAFORMAS.map(p => {
                        const acceso = m.accesos.find(a => a.plataforma === p)
                        return (
                          <PillCanal
                            key={p} canal={p}
                            activo={!!acceso?.activo}
                            onClick={(e) => { e.stopPropagation(); toggleCanal(m, p) }}
                          />
                        )
                      })}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleMarcaCompleta(m, !algunoActivo) }}
                        style={{
                          padding: '5px 12px', borderRadius: 5,
                          background: algunoActivo ? '#1D9E75' : T.inp,
                          color: algunoActivo ? '#fff' : T.mut,
                          border: `1px solid ${algunoActivo ? '#1D9E75' : T.brd}`,
                          fontFamily: FONT.heading, fontSize: 10, letterSpacing: 1, cursor: 'pointer', fontWeight: 600,
                        }}
                        title={algunoActivo ? 'Desactivar UE+GL+JE' : 'Activar UE+GL+JE'}>
                        <Power size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                        {algunoActivo ? 'ON' : 'OFF'}
                      </button>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button onClick={(e) => { e.stopPropagation(); openEdit(m) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.mut, padding: 6, marginRight: 4 }}
                        title="Editar / renombrar">
                        <Edit3 size={15} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setDelModal(m) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B01D23', padding: 6 }}
                        title="Eliminar marca">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filtradas.length === 0 && (
                <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', padding: 32, color: T.mut }}>Sin marcas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL nueva / editar */}
      {(editing || creating) && (
        <EditModal
          title={creating ? 'Nueva marca' : `Editar ${editing?.nombre}`}
          onCancel={close}
          onSave={handleSave}
          saving={saving}
        >
          <Field label="Nombre">
            <input
              value={fNombre} onChange={e => setFNombre(e.target.value)}
              placeholder="Nombre de la marca"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: `0.5px solid ${T.brd}`, fontSize: 13, fontFamily: FONT.body, background: T.inp, color: T.pri, outline: 'none' }}
            />
          </Field>
          <Field label="Tipo de cocina">
            <select value={fCocina} onChange={e => setFCocina(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: `0.5px solid ${T.brd}`, fontSize: 13, fontFamily: FONT.body, background: T.inp, color: T.pri, outline: 'none' }}>
              <option value="">— Sin tipo —</option>
              {tiposCocina.map(tc => <option key={tc.id} value={tc.id}>{tc.nombre}</option>)}
            </select>
          </Field>
          <Field label="Margen deseado (%)">
            <input value={fMargen} onChange={e => setFMargen(e.target.value)} type="number" min="0" max="100" step="0.01"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: `0.5px solid ${T.brd}`, fontSize: 13, fontFamily: FONT.body, background: T.inp, color: T.pri, outline: 'none' }}
            />
          </Field>
          <Field label="Plataformas activas">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PLATAFORMAS.map(p => {
                const activo = fCanales.includes(p)
                const c = CANAL_PILL_COLORS[p]
                return (
                  <button key={p} type="button" onClick={() => {
                    setFCanales(prev => activo ? prev.filter(x => x !== p) : [...prev, p])
                  }}
                    style={{
                      padding: '6px 12px', borderRadius: 5, fontFamily: FONT.heading, fontSize: 11, fontWeight: 700, letterSpacing: 1,
                      background: activo ? c.bg : 'transparent',
                      color: activo ? c.text : T.mut,
                      border: activo ? `1px solid ${c.border}` : `1px dashed ${T.brd}`,
                      cursor: 'pointer',
                    }}>
                    {p}
                  </button>
                )
              })}
            </div>
          </Field>
        </EditModal>
      )}

      {/* MODAL eliminar */}
      {delModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: 16 }} onClick={() => !saving && setDelModal(null)}>
          <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 16, width: '100%', maxWidth: 480, padding: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: `0.5px solid ${T.brd}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: FONT.heading, fontSize: 15, margin: 0, color: T.pri, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>Eliminar marca</h3>
              <button onClick={() => !saving && setDelModal(null)} style={{ background: 'none', border: 'none', color: T.mut, fontSize: 22, cursor: 'pointer', padding: 0 }}>×</button>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 14, color: T.pri, fontFamily: FONT.body, marginTop: 0, marginBottom: 16 }}>
                ¿Cómo quieres eliminar <strong>{delModal.nombre}</strong>?
              </p>
              <button onClick={() => handleArchivar(delModal)} disabled={saving}
                style={{
                  width: '100%', padding: '14px 16px', marginBottom: 10,
                  background: T.inp, border: `1px solid ${T.brd}`, borderRadius: 8,
                  textAlign: 'left', cursor: saving ? 'default' : 'pointer', fontFamily: FONT.body,
                }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.pri, marginBottom: 4 }}>📦 Archivar (conservar histórico)</div>
                <div style={{ fontSize: 11, color: T.mut }}>Marca se oculta pero conserva todos los datos. Recomendado.</div>
              </button>
              <button onClick={() => handleBorrarTotal(delModal)} disabled={saving}
                style={{
                  width: '100%', padding: '14px 16px',
                  background: 'transparent', border: '1px solid #B01D23', borderRadius: 8,
                  textAlign: 'left', cursor: saving ? 'default' : 'pointer', fontFamily: FONT.body,
                }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#B01D23', marginBottom: 4 }}>🗑 Borrar todo (sin vuelta atrás)</div>
                <div style={{ fontSize: 11, color: T.mut }}>Elimina marca y TODOS sus datos. Irreversible.</div>
              </button>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                <button onClick={() => setDelModal(null)} disabled={saving}
                  style={{ padding: '8px 16px', background: 'transparent', color: T.mut, border: `0.5px solid ${T.brd}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: FONT.body }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL conflicto rename */}
      {renameConflict && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: 16 }} onClick={() => !saving && setRenameConflict(null)}>
          <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 16, width: '100%', maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: `0.5px solid ${T.brd}` }}>
              <h3 style={{ fontFamily: FONT.heading, fontSize: 15, margin: 0, color: T.pri, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>Nombre ya existe</h3>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 13, color: T.pri, fontFamily: FONT.body, marginTop: 0, marginBottom: 14, lineHeight: 1.5 }}>
                Ya existe una marca llamada <strong>"{renameConflict.target.nombre}"</strong>. ¿Quieres unificar <strong>"{renameConflict.source.nombre}"</strong> con ella?
              </p>
              <button onClick={handleUnificar} disabled={saving}
                style={{
                  width: '100%', padding: '12px 16px', marginBottom: 10,
                  background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8,
                  textAlign: 'left', cursor: saving ? 'default' : 'pointer', fontFamily: FONT.body,
                }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>✓ Unificar todo en "{renameConflict.target.nombre}"</div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>Datos de "{renameConflict.source.nombre}" se moverán. La marca origen se borra.</div>
              </button>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setRenameConflict(null)} disabled={saving}
                  style={{ padding: '8px 16px', background: 'transparent', color: T.mut, border: `0.5px solid ${T.brd}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: FONT.body }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
