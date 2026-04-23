import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/lib/format'
import { rangoPeriodo } from '@/lib/dateRange'
import type { Periodo } from '@/lib/dateRange'
import { BigCard } from '@/components/configuracion/BigCard'
import { PeriodDropdown } from '@/components/configuracion/PeriodDropdown'
import { MultiSelectDropdown } from '@/components/configuracion/MultiSelectDropdown'
import { Ctag } from '@/components/configuracion/Ctag'
import { StatusTag } from '@/components/configuracion/StatusTag'
import { InlineEdit } from '@/components/configuracion/InlineEdit'
import { EditModal, Field } from '@/components/configuracion/EditModal'
import type { CanalAbv, TipoCocina, FacturacionMarcaAgregada, EstadoMarca } from '@/types/configuracion'

interface MarcaRow {
  id: string
  nombre: string
  estado: EstadoMarca
  margen_deseado_pct: number
  tipo_cocina_id: string | null
  accesos: { plataforma: string; activo: boolean }[]
}

export default function TabMarcas() {
  const [marcas, setMarcas] = useState<MarcaRow[]>([])
  const [tipos, setTipos] = useState<TipoCocina[]>([])
  const [facturaciones, setFacturaciones] = useState<FacturacionMarcaAgregada[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [platsSel, setPlatsSel] = useState<string[]>([])
  const [marcasSel, setMarcasSel] = useState<string[]>([])
  const [periodo, setPeriodo] = useState<Periodo>('30d')
  const [custom, setCustom] = useState<[string, string] | undefined>()

  const [editing, setEditing] = useState<MarcaRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [fNombre, setFNombre] = useState('')
  const [fCocina, setFCocina] = useState('')
  const [fEstado, setFEstado] = useState<EstadoMarca>('activa')
  const [fMargen, setFMargen] = useState('70')
  const [saving, setSaving] = useState(false)

  async function loadBase() {
    const [mRes, tRes] = await Promise.all([
      supabase.from('marcas').select(`
        id, nombre, estado, margen_deseado_pct, tipo_cocina_id,
        accesos:marca_plataforma_acceso(plataforma, activo)
      `).order('nombre'),
      supabase.from('tipos_cocina').select('*').order('orden'),
    ])
    if (mRes.error) throw mRes.error
    if (tRes.error) throw tRes.error
    setMarcas(((mRes.data ?? []) as unknown as MarcaRow[]).map(m => ({
      ...m,
      margen_deseado_pct: Number(m.margen_deseado_pct) || 0,
      accesos: m.accesos ?? [],
    })))
    setTipos(((tRes.data ?? []) as TipoCocina[]))
  }

  async function loadFact(p: Periodo, range?: [string, string]) {
    const [from, to] = rangoPeriodo(p, range)
    const { data, error } = await supabase
      .from('v_facturacion_marca')
      .select('*')
      .gte('fecha', from).lte('fecha', to)
    if (error) throw error
    const agg = new Map<string, FacturacionMarcaAgregada>()
    for (const r of (data ?? []) as any[]) {
      const id = r.marca_id as string
      if (!agg.has(id)) {
        agg.set(id, {
          marca_id: id, marca_nombre: r.marca_nombre,
          ue_bruto: 0, gl_bruto: 0, je_bruto: 0, web_bruto: 0, dir_bruto: 0,
          total_bruto: 0, total_pedidos: 0,
          ue_pedidos: 0, gl_pedidos: 0, je_pedidos: 0,
        })
      }
      const x = agg.get(id)!
      x.ue_bruto += Number(r.ue_bruto ?? 0)
      x.gl_bruto += Number(r.gl_bruto ?? 0)
      x.je_bruto += Number(r.je_bruto ?? 0)
      x.web_bruto += Number(r.web_bruto ?? 0)
      x.dir_bruto += Number(r.dir_bruto ?? 0)
      x.total_bruto += Number(r.total_bruto ?? 0)
      x.total_pedidos += Number(r.total_pedidos ?? 0)
    }
    setFacturaciones(Array.from(agg.values()))
  }

  useEffect(() => {
    (async () => {
      try { await Promise.all([loadBase(), loadFact(periodo, custom)]) }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleChangePeriodo(p: Periodo, range?: [string, string]) {
    setPeriodo(p)
    if (range) setCustom(range)
    try { await loadFact(p, range) } catch (e: any) { setError(e?.message ?? 'Error') }
  }

  async function refetch() {
    try { await Promise.all([loadBase(), loadFact(periodo, custom)]) }
    catch (e: any) { setError(e?.message ?? 'Error') }
  }

  const factMap = useMemo(() => new Map(facturaciones.map(f => [f.marca_id, f])), [facturaciones])

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase()
    return marcas.filter(m => {
      if (q && !m.nombre.toLowerCase().includes(q)) return false
      if (marcasSel.length > 0 && !marcasSel.includes(m.id)) return false
      if (platsSel.length > 0) {
        const activas = (m.accesos || []).filter(a => a.activo).map(a => a.plataforma)
        if (!platsSel.some(p => activas.includes(p))) return false
      }
      return true
    })
  }, [marcas, search, marcasSel, platsSel])

  const top10 = useMemo(() => [...facturaciones].sort((a, b) => b.total_bruto - a.total_bruto).slice(0, 10), [facturaciones])

  function openNueva() {
    setCreating(true); setEditing(null)
    setFNombre(''); setFCocina(''); setFEstado('activa'); setFMargen('70')
  }
  function openEdit(m: MarcaRow) {
    setEditing(m); setCreating(false)
    setFNombre(m.nombre); setFCocina(m.tipo_cocina_id ?? ''); setFEstado(m.estado); setFMargen(String(m.margen_deseado_pct))
  }
  function close() { setEditing(null); setCreating(false) }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        nombre: fNombre.trim(),
        tipo_cocina_id: fCocina || null,
        estado: fEstado,
        margen_deseado_pct: parseFloat(fMargen.replace(',', '.')) || 70,
      }
      const q = editing
        ? supabase.from('marcas').update(payload).eq('id', editing.id)
        : supabase.from('marcas').insert(payload)
      const { error } = await q
      if (error) throw error
      await refetch(); close()
    } catch (e: any) { setError(e?.message ?? 'Error') } finally { setSaving(false) }
  }
  async function handleDelete() {
    if (!editing) return
    if (!confirm(`Eliminar marca "${editing.nombre}"?`)) return
    const { error } = await supabase.from('marcas').delete().eq('id', editing.id)
    if (error) { setError(error.message); return }
    await refetch(); close()
  }

  if (loading) return <div className="p-6 text-[var(--sl-text-muted)]">Cargando marcas…</div>
  if (error) return <div className="p-6 bg-[var(--sl-border-error)]/20 text-[var(--sl-border-error)] rounded-xl">{error}</div>

  return (
    <>
      <div className="flex gap-2.5 items-center flex-wrap mb-5">
        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar marca..."
            className="pl-9 pr-3 py-2 bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-lg text-[13px] text-[var(--sl-text-primary)] w-[220px] focus:outline-none focus:border-[var(--sl-border-focus)]"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--sl-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M16 10a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
        </div>

        <MultiSelectDropdown
          label="Plataformas"
          options={[
            { value: 'UE', label: 'Uber Eats' },
            { value: 'GL', label: 'Glovo' },
            { value: 'JE', label: 'Just Eat' },
            { value: 'WEB', label: 'Web' },
            { value: 'DIR', label: 'Directa' },
          ]}
          selected={platsSel}
          onChange={setPlatsSel}
        />

        <MultiSelectDropdown
          label="Marcas"
          options={marcas.map(m => ({ value: m.id, label: m.nombre }))}
          selected={marcasSel}
          onChange={setMarcasSel}
        />

        <div className="flex-1" />

        <button
          onClick={openNueva}
          className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--sl-btn-save-bg)] text-white hover:bg-[#901A1E] tracking-[0.04em]"
        >+ Nueva marca</button>
      </div>

      <BigCard title="Portfolio de marcas" count={`${filtradas.length} marcas`}>
        <table className="sl-cfg-table">
          <thead>
            <tr>
              <th>Marca</th>
              <th>Canales</th>
              <th className="num">Facturación</th>
              <th className="num">Margen</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map(m => {
              const f = factMap.get(m.id) ?? { total_bruto: 0 } as any
              const canales = (m.accesos || []).filter(a => a.activo).map(a => a.plataforma as CanalAbv)
              return (
                <tr key={m.id} className="row-click" onClick={() => openEdit(m)}>
                  <td><strong>{m.nombre}</strong></td>
                  <td>
                    {canales.length === 0 ? <span className="text-[var(--sl-text-muted)]">—</span> :
                      canales.map(c => <Ctag key={c} abv={c} />)}
                  </td>
                  <td className="num">{fmtEur(f.total_bruto)}</td>
                  <td className="num" onClick={(e) => e.stopPropagation()}>
                    <InlineEdit
                      value={m.margen_deseado_pct}
                      type="percent" align="right" min={0} max={100} step={0.01}
                      onSubmit={async (v) => { await supabase.from('marcas').update({ margen_deseado_pct: v }).eq('id', m.id); refetch() }}
                    />
                  </td>
                  <td>
                    <StatusTag variant={m.estado === 'activa' ? 'ok' : 'off'}>
                      {m.estado === 'activa' ? 'Activa' : 'Pausada'}
                    </StatusTag>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </BigCard>

      <BigCard title="Top 10 marcas" count={
        <PeriodDropdown value={periodo} onChange={handleChangePeriodo} customRange={custom} />
      }>
        {top10.length === 0 || top10.every(t => t.total_bruto === 0) ? (
          <div className="py-8 text-center text-[var(--sl-text-muted)]">Sin datos de facturación en el periodo</div>
        ) : (
          <table className="sl-cfg-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Marca</th>
                <th className="num">Facturación</th>
                <th className="num">Pedidos</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((m, i) => (
                <tr key={m.marca_id}>
                  <td style={{ color: "var(--sl-text-muted)", fontWeight: 700 }}>{i + 1}</td>
                  <td><strong>{m.marca_nombre}</strong></td>
                  <td className="num">{fmtEur(m.total_bruto)}</td>
                  <td className="num">{m.total_pedidos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </BigCard>

      {(editing || creating) && (
        <EditModal
          title={editing ? 'Editar marca' : 'Nueva marca'}
          onSave={handleSave}
          onCancel={close}
          onDelete={editing ? handleDelete : undefined}
          saving={saving}
          canSave={!!fNombre.trim()}
        >
          <Field label="Nombre">
            <input value={fNombre} onChange={(e) => setFNombre(e.target.value)} autoFocus
              className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--sl-border-focus)]" />
          </Field>
          <Field label="Tipo de cocina">
            <select value={fCocina} onChange={(e) => setFCocina(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm bg-[var(--sl-card)] focus:outline-none focus:border-[var(--sl-border-focus)]">
              <option value="">—</option>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </Field>
          <Field label="Estado">
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={fEstado === 'activa'} onChange={() => setFEstado('activa')} /> Activa
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={fEstado === 'pausada'} onChange={() => setFEstado('pausada')} /> Pausada
              </label>
            </div>
          </Field>
          <Field label="Margen deseado (%)">
            <input type="number" value={fMargen} onChange={(e) => setFMargen(e.target.value)}
              step="0.01" min="0" max="100"
              className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--sl-border-focus)]" />
          </Field>
        </EditModal>
      )}
    </>
  )
}
