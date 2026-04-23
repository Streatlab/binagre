import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/lib/format'
import { rangoPeriodo } from '@/lib/dateRange'
import type { Periodo } from '@/lib/dateRange'
import { KpiCard, KpiGrid } from '@/components/configuracion/KpiCard'
import { BigCard } from '@/components/configuracion/BigCard'
import { Toolbar, Spacer, BtnRed, SearchInput } from '@/components/configuracion/Toolbar'
import { Ctag } from '@/components/configuracion/Ctag'
import { StatusTag } from '@/components/configuracion/StatusTag'
import { InlineEdit } from '@/components/configuracion/InlineEdit'
import { InlineSelect } from '@/components/configuracion/InlineSelect'
import { CanalCard } from '@/components/configuracion/CanalCard'
import { PeriodDropdown } from '@/components/configuracion/PeriodDropdown'
import { EditModal, Field } from '@/components/configuracion/EditModal'
import type { CanalAbv, TipoCocina, FacturacionMarcaAgregada, EstadoMarca } from '@/types/configuracion'

interface MarcaRow {
  id: string
  nombre: string
  cocina: string | null
  tipo_cocina_id: string | null
  tipo_cocina?: { nombre: string } | null
  margen_deseado_pct: number
  estado: EstadoMarca
  responsable_id: string | null
  responsable?: { id: string; nombre: string } | null
  accesos: { plataforma: string; activo: boolean }[]
}

interface UsuarioOpt { id: string; nombre: string }

type FiltroBase = 'todas' | 'canal' | 'cocina'

export default function TabMarcas() {
  const [marcas, setMarcas] = useState<MarcaRow[]>([])
  const [tipos, setTipos] = useState<TipoCocina[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioOpt[]>([])
  const [facturaciones, setFacturaciones] = useState<FacturacionMarcaAgregada[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<FiltroBase>('todas')
  const [canalFiltro, setCanalFiltro] = useState<string>('')
  const [cocinaFiltro, setCocinaFiltro] = useState<string>('')
  const [periodo, setPeriodo] = useState<Periodo>('30d')
  const [customRange, setCustomRange] = useState<[string, string] | undefined>()

  const [editing, setEditing] = useState<MarcaRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [fNombre, setFNombre] = useState('')
  const [fCocinaId, setFCocinaId] = useState('')
  const [fEstado, setFEstado] = useState<EstadoMarca>('activa')
  const [fMargen, setFMargen] = useState(70)
  const [fResp, setFResp] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadBase() {
    const [mRes, tRes, uRes] = await Promise.all([
      supabase.from('marcas').select(`
        id, nombre, cocina, tipo_cocina_id, margen_deseado_pct, estado, responsable_id,
        tipo_cocina:tipos_cocina(nombre),
        responsable:usuarios!marcas_responsable_fk(id, nombre),
        accesos:marca_plataforma_acceso(plataforma, activo)
      `).order('nombre'),
      supabase.from('tipos_cocina').select('*').order('orden'),
      supabase.from('usuarios').select('id, nombre').order('nombre'),
    ])
    if (mRes.error) throw mRes.error
    if (tRes.error) throw tRes.error
    if (uRes.error) throw uRes.error
    setMarcas(((mRes.data ?? []) as unknown as MarcaRow[]).map(m => ({
      ...m,
      margen_deseado_pct: Number(m.margen_deseado_pct) || 0,
      accesos: m.accesos ?? [],
    })))
    setTipos(((tRes.data ?? []) as TipoCocina[]))
    setUsuarios(((uRes.data ?? []) as UsuarioOpt[]))
  }

  async function loadFact(p: Periodo, range?: [string, string]) {
    const [from, to] = rangoPeriodo(p, range)
    const { data, error } = await supabase
      .from('v_facturacion_marca')
      .select('*')
      .gte('fecha', from)
      .lte('fecha', to)
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
      x.ue_pedidos += Number(r.ue_pedidos ?? 0)
      x.gl_pedidos += Number(r.gl_pedidos ?? 0)
      x.je_pedidos += Number(r.je_pedidos ?? 0)
    }
    setFacturaciones(Array.from(agg.values()))
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await Promise.all([loadBase(), loadFact(periodo, customRange)])
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Error cargando')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChangePeriodo = async (p: Periodo, range?: [string, string]) => {
    setPeriodo(p)
    if (range) setCustomRange(range)
    try { await loadFact(p, range) } catch (e: any) { setError(e?.message ?? 'Error') }
  }

  const refetch = async () => {
    try { await Promise.all([loadBase(), loadFact(periodo, customRange)]) }
    catch (e: any) { setError(e?.message ?? 'Error') }
  }

  const factMap = useMemo(() => new Map(facturaciones.map(f => [f.marca_id, f])), [facturaciones])

  const marcasFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase()
    return marcas.filter(m => {
      if (q && !m.nombre.toLowerCase().includes(q)) return false
      if (filtro === 'canal' && canalFiltro) {
        const has = m.accesos?.some(a => a.plataforma === canalFiltro && a.activo)
        if (!has) return false
      }
      if (filtro === 'cocina' && cocinaFiltro) {
        if (m.tipo_cocina_id !== cocinaFiltro) return false
      }
      return true
    })
  }, [marcas, search, filtro, canalFiltro, cocinaFiltro])

  const activas = marcas.filter(m => m.estado === 'activa')
  const pausadas = marcas.filter(m => m.estado === 'pausada')
  const topMarca = [...facturaciones].sort((a, b) => b.total_bruto - a.total_bruto)[0]
  const totalFact = facturaciones.reduce((a, f) => a + f.total_bruto, 0)
  const margenPonderado = useMemo(() => {
    if (totalFact === 0) {
      const m = marcas.filter(x => x.estado === 'activa')
      if (m.length === 0) return 0
      return m.reduce((a, x) => a + x.margen_deseado_pct, 0) / m.length
    }
    let sum = 0
    for (const m of marcas) {
      const f = factMap.get(m.id)
      sum += (m.margen_deseado_pct ?? 0) * (f?.total_bruto ?? 0)
    }
    return sum / totalFact
  }, [marcas, factMap, totalFact])

  const totalUE = facturaciones.reduce((a, f) => a + f.ue_bruto, 0)
  const totalGL = facturaciones.reduce((a, f) => a + f.gl_bruto, 0)
  const totalJE = facturaciones.reduce((a, f) => a + f.je_bruto, 0)
  const pedUE = facturaciones.reduce((a, f) => a + f.ue_pedidos, 0)
  const pedGL = facturaciones.reduce((a, f) => a + f.gl_pedidos, 0)
  const pedJE = facturaciones.reduce((a, f) => a + f.je_pedidos, 0)

  const top10 = useMemo(() => [...facturaciones].sort((a, b) => b.total_bruto - a.total_bruto).slice(0, 10), [facturaciones])

  async function updateCocina(marcaId: string, tipoCocinaId: string) {
    const { error } = await supabase.from('marcas').update({ tipo_cocina_id: tipoCocinaId || null }).eq('id', marcaId)
    if (error) { setError(error.message); return }
    await refetch()
  }

  async function updateMargen(marcaId: string, v: number) {
    const { error } = await supabase.from('marcas').update({ margen_deseado_pct: v }).eq('id', marcaId)
    if (error) { setError(error.message); return }
    await refetch()
  }

  function openNew() {
    setCreating(true); setEditing(null)
    setFNombre(''); setFCocinaId(''); setFEstado('activa'); setFMargen(70); setFResp('')
  }
  function openEdit(m: MarcaRow) {
    setEditing(m); setCreating(false)
    setFNombre(m.nombre)
    setFCocinaId(m.tipo_cocina_id ?? '')
    setFEstado(m.estado)
    setFMargen(m.margen_deseado_pct)
    setFResp(m.responsable_id ?? '')
  }
  function closeModal() { setEditing(null); setCreating(false) }

  async function handleSaveMarca() {
    setSaving(true)
    try {
      const payload: any = {
        nombre: fNombre.trim(),
        tipo_cocina_id: fCocinaId || null,
        estado: fEstado,
        margen_deseado_pct: Number(fMargen) || 0,
        responsable_id: fResp || null,
      }
      const q = editing
        ? supabase.from('marcas').update(payload).eq('id', editing.id)
        : supabase.from('marcas').insert(payload)
      const { error } = await q
      if (error) throw error
      await refetch(); closeModal()
    } catch (e: any) { setError(e?.message ?? 'Error') } finally { setSaving(false) }
  }
  async function handleDeleteMarca(id: string) {
    if (!confirm('¿Eliminar marca?')) return
    const { error } = await supabase.from('marcas').delete().eq('id', id)
    if (error) { setError(error.message); return }
    await refetch(); closeModal()
  }

  if (loading) return <div className="p-6 text-[#9E9588]">Cargando marcas…</div>
  if (error) return <div className="p-6 bg-[#FCE0E2] text-[#D63A49] rounded-xl">{error}</div>

  return (
    <>
      <KpiGrid>
        <KpiCard
          label="Marcas activas"
          value={activas.length}
          sub={pausadas.length > 0 ? `${pausadas.length} pausada${pausadas.length !== 1 ? 's' : ''}` : 'todas activas'}
          subTone={pausadas.length > 0 ? 'neg' : 'muted'}
        />
        <KpiCard label="En pausa" value={pausadas.length} sub="portfolio" />
        <KpiCard
          label="Top facturación"
          value={topMarca?.marca_nombre ?? '—'}
          sub={topMarca ? fmtEur(topMarca.total_bruto) : '—'}
        />
        <KpiCard
          label="Margen ponderado"
          value={`${margenPonderado.toFixed(1).replace('.', ',')}%`}
          sub="promedio por facturación"
        />
      </KpiGrid>

      <div className="grid grid-cols-3 gap-3.5 mb-5">
        <CanalCard color="ue" label="UBER EATS" bruto={totalUE} pedidos={pedUE} />
        <CanalCard color="gl" label="GLOVO" bruto={totalGL} pedidos={pedGL} />
        <CanalCard color="je" label="JUST EAT" bruto={totalJE} pedidos={pedJE} />
      </div>

      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {[
          { id: 'todas', label: 'Todas' },
          { id: 'canal', label: 'Por canal' },
          { id: 'cocina', label: 'Por cocina' },
        ].map(p => (
          <button
            key={p.id}
            onClick={() => setFiltro(p.id as FiltroBase)}
            className={filtro === p.id
              ? 'px-5 py-2 rounded-lg text-[13px] font-semibold bg-[#B01D23] text-white border border-[#B01D23]'
              : 'px-5 py-2 rounded-lg text-[13px] font-medium bg-white text-[#1A1A1A] border border-[#E9E1D0] hover:bg-[#FAF4E4]'}
          >{p.label}</button>
        ))}
        {filtro === 'canal' && (
          <select value={canalFiltro} onChange={(e) => setCanalFiltro(e.target.value)} className="ml-2 px-3 py-2 border border-[#E9E1D0] rounded-lg text-[13px] bg-white">
            <option value="">Todos</option>
            <option value="UE">Uber Eats</option>
            <option value="GL">Glovo</option>
            <option value="JE">Just Eat</option>
            <option value="WEB">Web</option>
            <option value="DIR">Directa</option>
          </select>
        )}
        {filtro === 'cocina' && (
          <select value={cocinaFiltro} onChange={(e) => setCocinaFiltro(e.target.value)} className="ml-2 px-3 py-2 border border-[#E9E1D0] rounded-lg text-[13px] bg-white">
            <option value="">Todas</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        )}
        <div className="flex-1" />
        <PeriodDropdown value={periodo} onChange={handleChangePeriodo} customRange={customRange} />
      </div>

      <Toolbar>
        <SearchInput placeholder="Buscar marca..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Spacer />
        <BtnRed onClick={openNew}>+ Nueva marca</BtnRed>
      </Toolbar>

      <BigCard title="Portfolio de marcas" count={`${marcasFiltradas.length} marca${marcasFiltradas.length !== 1 ? 's' : ''}`}>
        <table className="w-full text-[13.5px] border-collapse">
          <thead>
            <tr>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Marca</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Cocina</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Resp.</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Canales</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-right">Facturación</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-right">Margen</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Estado</th>
            </tr>
          </thead>
          <tbody>
            {marcasFiltradas.map(m => {
              const f = factMap.get(m.id)
              const canales = m.accesos?.filter(a => a.activo).map(a => a.plataforma as CanalAbv) ?? []
              return (
                <tr key={m.id} className="border-b border-[#F0E8D5] hover:bg-[#FAF4E4] cursor-pointer" onClick={() => openEdit(m)}>
                  <td className="py-3.5 px-3.5"><strong>{m.nombre}</strong></td>
                  <td className="py-3.5 px-3.5" onClick={(e) => e.stopPropagation()}>
                    <InlineSelect
                      value={m.tipo_cocina_id}
                      options={tipos.map(t => ({ value: t.id, label: t.nombre }))}
                      onSubmit={(v) => updateCocina(m.id, v)}
                      placeholder="Sin asignar"
                    />
                  </td>
                  <td className="py-3.5 px-3.5">{m.responsable?.nombre ?? '—'}</td>
                  <td className="py-3.5 px-3.5">
                    {canales.length === 0
                      ? <span className="text-[#9E9588]">—</span>
                      : canales.map(c => <Ctag key={c} abv={c} />)}
                  </td>
                  <td className="py-3.5 px-3.5 text-right tabular-nums font-bold">
                    {f ? fmtEur(f.total_bruto) : fmtEur(0)}
                  </td>
                  <td className="py-3.5 px-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <InlineEdit
                      value={m.margen_deseado_pct}
                      onSubmit={(v) => updateMargen(m.id, typeof v === 'number' ? v : parseFloat(String(v)))}
                      type="percent" align="right" min={0} max={100} step={0.01}
                    />
                  </td>
                  <td className="py-3.5 px-3.5">
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

      <BigCard title={`Top 10 marcas`} count={
        <PeriodDropdown value={periodo} onChange={handleChangePeriodo} customRange={customRange} />
      }>
        {top10.length === 0 || top10.every(t => t.total_bruto === 0) ? (
          <div className="py-8 text-center text-[#9E9588]">
            Sin facturación en el periodo seleccionado.
          </div>
        ) : (
          <table className="w-full text-[13.5px] border-collapse">
            <thead>
              <tr>
                <th className="py-3 px-3 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">#</th>
                <th className="py-3 px-3 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Marca</th>
                <th className="py-3 px-3 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-right">Facturación</th>
                <th className="py-3 px-3 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-right">Pedidos</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((m, i) => (
                <tr key={m.marca_id} className="border-b border-[#F0E8D5]">
                  <td className="py-3 px-3 font-bold text-[#9E9588]">{i + 1}</td>
                  <td className="py-3 px-3"><strong>{m.marca_nombre}</strong></td>
                  <td className="py-3 px-3 text-right tabular-nums font-bold">{fmtEur(m.total_bruto)}</td>
                  <td className="py-3 px-3 text-right tabular-nums font-bold">{m.total_pedidos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </BigCard>

      {(editing || creating) && (
        <EditModal
          title={editing ? 'Editar marca' : 'Nueva marca'}
          onSave={handleSaveMarca}
          onCancel={closeModal}
          onDelete={editing ? () => handleDeleteMarca(editing.id) : undefined}
          saving={saving}
          canSave={!!fNombre.trim()}
        >
          <Field label="Nombre">
            <input value={fNombre} onChange={(e) => setFNombre(e.target.value)} className="w-full px-3 py-2 border border-[#E9E1D0] rounded-lg text-sm" autoFocus />
          </Field>
          <Field label="Tipo de cocina">
            <select value={fCocinaId} onChange={(e) => setFCocinaId(e.target.value)} className="w-full px-3 py-2 border border-[#E9E1D0] rounded-lg text-sm">
              <option value="">—</option>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </Field>
          <Field label="Estado">
            <select value={fEstado} onChange={(e) => setFEstado(e.target.value as EstadoMarca)} className="w-full px-3 py-2 border border-[#E9E1D0] rounded-lg text-sm">
              <option value="activa">Activa</option>
              <option value="pausada">Pausada</option>
            </select>
          </Field>
          <Field label="Margen deseado (%)">
            <input type="number" step="0.01" min="0" max="100" value={fMargen} onChange={(e) => setFMargen(Number(e.target.value))} className="w-full px-3 py-2 border border-[#E9E1D0] rounded-lg text-sm" />
          </Field>
          <Field label="Responsable">
            <select value={fResp} onChange={(e) => setFResp(e.target.value)} className="w-full px-3 py-2 border border-[#E9E1D0] rounded-lg text-sm">
              <option value="">—</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </Field>
        </EditModal>
      )}
    </>
  )
}
