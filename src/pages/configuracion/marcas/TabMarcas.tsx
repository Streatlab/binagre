import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/lib/format'
import { rangoPeriodo } from '@/lib/dateRange'
import type { Periodo } from '@/lib/dateRange'
import {
  useTheme,
  groupStyle,
  cardStyle,
  sectionLabelStyle,
  kpiLabelStyle,
  kpiValueStyle,
  dividerStyle,
  FONT,
  CANALES,
} from '@/styles/tokens'
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

// ABV → id canal en tokens.CANALES
const ABV_TO_ID: Record<CanalAbv, string> = {
  UE: 'uber',
  GL: 'glovo',
  JE: 'je',
  WEB: 'web',
  DIR: 'dir',
}
const ABV_TO_BRUTO: Record<CanalAbv, keyof FacturacionMarcaAgregada> = {
  UE: 'ue_bruto',
  GL: 'gl_bruto',
  JE: 'je_bruto',
  WEB: 'web_bruto',
  DIR: 'dir_bruto',
}

const CANALES_MARCA: { abv: CanalAbv; label: string; color: string }[] = [
  { abv: 'UE',  label: 'Uber Eats', color: CANALES.find(c => c.id === 'uber')!.color },
  { abv: 'GL',  label: 'Glovo',     color: CANALES.find(c => c.id === 'glovo')!.color },
  { abv: 'JE',  label: 'Just Eat',  color: CANALES.find(c => c.id === 'je')!.color },
  { abv: 'WEB', label: 'Web',       color: CANALES.find(c => c.id === 'web')!.color },
  { abv: 'DIR', label: 'Directa',   color: CANALES.find(c => c.id === 'dir')!.color },
]

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r},${g},${b}`
}

export default function TabMarcas() {
  const { T, isDark } = useTheme()

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
  const [fCanales, setFCanales] = useState<CanalAbv[]>([])
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
    setTipos((tRes.data ?? []) as TipoCocina[])
  }

  async function loadFacturacion(p: Periodo, range?: [string, string]) {
    const [desde, hasta] = rangoPeriodo(p, range)
    const { data, error } = await supabase
      .from('v_facturacion_marca')
      .select('*')
      .gte('fecha', desde).lte('fecha', hasta)
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
    (async () => {
      try { await Promise.all([loadBase(), loadFacturacion(periodo, custom)]) }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleChangePeriodo(p: Periodo, range?: [string, string]) {
    setPeriodo(p)
    if (range) setCustom(range)
    try { await loadFacturacion(p, range) } catch (e: any) { setError(e?.message ?? 'Error') }
  }

  async function refetch() {
    try { await Promise.all([loadBase(), loadFacturacion(periodo, custom)]) }
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

  const activas = marcas.filter(m => m.estado === 'activa').length
  const pausadas = marcas.filter(m => m.estado === 'pausada').length

  const totalBruto = facturaciones.reduce((a, f) => a + f.total_bruto, 0)

  const margenes = marcas.map(m => m.margen_deseado_pct).filter(x => x > 0)
  const margenAvg = margenes.length > 0 ? margenes.reduce((a, v) => a + v, 0) / margenes.length : 0
  const margenMin = margenes.length > 0 ? Math.min(...margenes) : 0
  const margenMax = margenes.length > 0 ? Math.max(...margenes) : 0

  const canalStats = useMemo(() => CANALES.map(c => {
    const abv = (Object.keys(ABV_TO_ID) as CanalAbv[]).find(k => ABV_TO_ID[k] === c.id) as CanalAbv | undefined
    const brutoKey = abv ? ABV_TO_BRUTO[abv] : undefined
    const bruto = brutoKey ? facturaciones.reduce((a, f) => a + Number(f[brutoKey] || 0), 0) : 0
    const nMarcas = abv ? marcas.filter(m => (m.accesos || []).some(a => a.activo && a.plataforma === abv)).length : 0
    const pct = totalBruto > 0 ? (bruto / totalBruto) * 100 : 0
    return { id: c.id, label: c.label, color: c.color, bruto, nMarcas, pct }
  }), [facturaciones, marcas, totalBruto])

  const top10 = useMemo(
    () => [...facturaciones].sort((a, b) => b.total_bruto - a.total_bruto).slice(0, 10),
    [facturaciones],
  )

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
      const payload = {
        nombre: fNombre.trim(),
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
  async function handleDelete() {
    if (!editing) return
    if (!confirm(`Eliminar marca "${editing.nombre}"?`)) return
    const { error } = await supabase.from('marcas').delete().eq('id', editing.id)
    if (error) { setError(error.message); return }
    await refetch(); close()
  }

  if (loading) {
    return (
      <div style={{ padding: 24, color: T.mut, fontFamily: FONT.body }}>Cargando marcas…</div>
    )
  }
  if (error) {
    return (
      <div
        style={{
          padding: 16,
          background: isDark ? '#3a1a1a' : '#FCE0E2',
          color: '#B01D23',
          borderRadius: 10,
          fontFamily: FONT.body,
        }}
      >
        {error}
      </div>
    )
  }

  const inputSearchStyle: React.CSSProperties = {
    background: T.inp,
    border: `0.5px solid ${T.brd}`,
    borderRadius: 6,
    padding: '7px 12px 7px 32px',
    fontSize: 11,
    fontFamily: FONT.body,
    color: T.pri,
    width: 220,
    outline: 'none',
  }

  const thStyle: React.CSSProperties = {
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
  const thNumStyle: React.CSSProperties = { ...thStyle, textAlign: 'right' }
  const thCenterStyle: React.CSSProperties = { ...thStyle, textAlign: 'center' }

  const tdStyle: React.CSSProperties = {
    padding: '10px 14px',
    fontFamily: FONT.body,
    fontSize: 13,
    color: T.pri,
  }

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ position: 'relative' }}>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.mut, pointerEvents: 'none' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16 10a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar marca..."
            style={inputSearchStyle}
          />
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

        <div style={{ flex: 1 }} />

        <button
          onClick={openNueva}
          style={{
            background: '#B01D23',
            color: '#ffffff',
            padding: '7px 14px',
            borderRadius: 6,
            fontFamily: FONT.heading,
            fontSize: 11,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          + Nueva marca
        </button>
      </div>

      {/* KPIs arriba */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 22 }}>
        {/* Total marcas */}
        <div style={cardStyle(T)}>
          <div style={{ ...kpiLabelStyle(T), marginBottom: 8 }}>Total marcas</div>
          <div style={{ ...kpiValueStyle(T), marginBottom: 10 }}>{filtradas.length}</div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec, marginBottom: 10 }}>
            {activas} activas · {pausadas} pausadas
          </div>
          <div style={dividerStyle(T)} />
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginTop: 10 }}>
            {marcas.length} totales en portfolio
          </div>
        </div>

        {/* Facturación total */}
        <div style={cardStyle(T)}>
          <div style={{ ...kpiLabelStyle(T), marginBottom: 8 }}>Facturación</div>
          <div style={{ ...kpiValueStyle(T), marginBottom: 10 }}>{fmtEur(totalBruto)}</div>
          <div style={dividerStyle(T)} />
          {canalStats.filter(c => c.bruto > 0).map((c, idx, arr) => (
            <div
              key={c.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '10px 1fr auto auto',
                alignItems: 'center',
                gap: '0 8px',
                padding: '5px 0',
                borderBottom: idx < arr.length - 1 ? `0.5px solid ${T.brd}` : 'none',
              }}
            >
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: c.color }} />
              <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
              <span style={{ fontFamily: FONT.body, fontSize: 13, fontWeight: 600, color: T.pri, textAlign: 'right' }}>{fmtEur(c.bruto)}</span>
              <span style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, textAlign: 'right', minWidth: 34 }}>{c.pct.toFixed(0)}%</span>
            </div>
          ))}
          {canalStats.every(c => c.bruto === 0) && (
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginTop: 10 }}>Sin facturación en el periodo</div>
          )}
        </div>

        {/* Margen medio */}
        <div style={cardStyle(T)}>
          <div style={{ ...kpiLabelStyle(T), marginBottom: 8 }}>Margen objetivo medio</div>
          <div style={{ ...kpiValueStyle(T), marginBottom: 10 }}>
            {margenAvg.toFixed(1).replace('.', ',')}%
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec, marginBottom: 10 }}>
            {margenes.length > 0
              ? <>rango {margenMin.toFixed(0)}% – {margenMax.toFixed(0)}%</>
              : 'sin datos'}
          </div>
          <div style={dividerStyle(T)} />
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginTop: 10 }}>
            objetivo deseado configurable por marca
          </div>
        </div>
      </div>

      {/* Facturación por canal — cards tintadas */}
      <div style={{ ...sectionLabelStyle(T), marginBottom: 12 }}>Facturación por canal</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 22 }}>
        {canalStats.map(c => {
          const isGlovo = c.id === 'glovo'
          const hasData = c.bruto > 0
          const cardBg = isGlovo ? (isDark ? '#1a1800' : '#fffbe0') : (isDark ? `${c.color}18` : `${c.color}22`)
          const labelColor = isGlovo ? (isDark ? '#e8f442' : '#8a7800') : c.color
          return (
            <div
              key={c.id}
              style={{
                background: cardBg,
                border: `1px solid ${c.color}`,
                borderRadius: 10,
                padding: '12px 14px',
              }}
            >
              <div
                style={{
                  fontFamily: FONT.heading,
                  fontSize: 11,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  color: labelColor,
                  marginBottom: 8,
                }}
              >
                {c.label}
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 10 }}>
                {hasData ? (
                  <>
                    <span style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 600, color: T.pri, lineHeight: 1 }}>
                      {fmtEur(c.bruto)}
                    </span>
                    <span style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut }}>bruto</span>
                  </>
                ) : (
                  <span style={{ fontFamily: FONT.heading, fontSize: 18, color: T.mut, lineHeight: 1 }}>—</span>
                )}
              </div>

              <div style={{ height: 3, background: T.brd, borderRadius: 2, marginBottom: 8 }}>
                <div style={{ height: 3, width: `${Math.min(c.pct, 100)}%`, background: c.color, borderRadius: 2 }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <span style={{ fontFamily: FONT.body, color: T.sec }}>Marcas</span>
                <span style={{ fontFamily: FONT.heading, fontWeight: 600, color: T.pri }}>{c.nMarcas}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabla Portfolio */}
      <div style={{ ...groupStyle(T), padding: 0, marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut }}>
            Portfolio de marcas
            <span style={{ color: T.pri, letterSpacing: '0.04em', textTransform: 'none', marginLeft: 6 }}>
              · {filtradas.length} marcas
            </span>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderTop: `0.5px solid ${T.brd}`, borderBottom: `0.5px solid ${T.brd}`, background: T.group }}>
                <th style={thStyle}>Marca</th>
                <th style={thStyle}>Canales</th>
                <th style={thNumStyle}>Facturación</th>
                <th style={thNumStyle}>Margen obj.</th>
                <th style={thCenterStyle}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(m => {
                const f = factMap.get(m.id)
                const bruto = f?.total_bruto ?? 0
                const canales = (m.accesos || []).filter(a => a.activo).map(a => a.plataforma as CanalAbv)
                return (
                  <tr
                    key={m.id}
                    onClick={() => openEdit(m)}
                    style={{ borderBottom: `0.5px solid ${T.brd}`, cursor: 'pointer' }}
                  >
                    <td style={{ ...tdStyle, color: T.pri, fontWeight: 600 }}>{m.nombre}</td>
                    <td style={tdStyle}>
                      {canales.length === 0
                        ? <span style={{ color: T.mut }}>—</span>
                        : canales.map(c => <Ctag key={c} abv={c} />)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: bruto > 0 ? T.pri : T.mut }}>
                      {bruto > 0 ? fmtEur(bruto) : '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <InlineEdit
                        value={m.margen_deseado_pct}
                        type="percent" align="right" min={0} max={100} step={0.01}
                        onSubmit={async (v) => {
                          await supabase.from('marcas').update({ margen_deseado_pct: v }).eq('id', m.id)
                          refetch()
                        }}
                      />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <StatusTag variant={m.estado === 'activa' ? 'ok' : 'off'}>
                        {m.estado === 'activa' ? 'Activa' : 'Pausada'}
                      </StatusTag>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `1px solid ${T.brd}`, background: T.group }}>
                <td
                  colSpan={2}
                  style={{
                    padding: '10px 14px',
                    fontFamily: FONT.heading,
                    fontSize: 11,
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    color: T.pri,
                    fontWeight: 600,
                  }}
                >
                  Total
                </td>
                <td
                  style={{
                    padding: '10px 14px',
                    textAlign: 'right',
                    fontFamily: FONT.heading,
                    fontSize: 12,
                    fontWeight: 600,
                    color: T.pri,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmtEur(filtradas.reduce((a, m) => a + (factMap.get(m.id)?.total_bruto ?? 0), 0))}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Tabla Top 10 */}
      <div style={{ ...groupStyle(T), padding: 0, marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut }}>
            Top 10 marcas
          </div>
          <PeriodDropdown value={periodo} onChange={handleChangePeriodo} customRange={custom} />
        </div>
        {top10.length === 0 || top10.every(t => t.total_bruto === 0) ? (
          <div
            style={{
              padding: '32px 22px',
              textAlign: 'center',
              color: T.mut,
              fontFamily: FONT.body,
              fontSize: 13,
              borderTop: `0.5px solid ${T.brd}`,
            }}
          >
            Sin datos de facturación en el periodo
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderTop: `0.5px solid ${T.brd}`, borderBottom: `0.5px solid ${T.brd}`, background: T.group }}>
                  <th style={{ ...thStyle, width: 60 }}>#</th>
                  <th style={thStyle}>Marca</th>
                  <th style={thNumStyle}>Facturación</th>
                  <th style={thNumStyle}>Pedidos</th>
                </tr>
              </thead>
              <tbody>
                {top10.map((m, i) => (
                  <tr key={m.marca_id} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                    <td style={{ ...tdStyle, fontFamily: FONT.heading, fontSize: 13, color: T.mut, fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ ...tdStyle, color: T.pri, fontWeight: 600 }}>{m.marca_nombre}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtEur(m.total_bruto)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: T.sec }}>{m.total_pedidos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
            <input
              value={fNombre}
              onChange={(e) => setFNombre(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--sl-border-focus)]"
            />
          </Field>
          <Field label="Tipo de cocina">
            <select
              value={fCocina}
              onChange={(e) => setFCocina(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm bg-[var(--sl-card)] focus:outline-none focus:border-[var(--sl-border-focus)]"
            >
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
            <input
              type="number"
              value={fMargen}
              onChange={(e) => setFMargen(e.target.value)}
              step="0.01" min="0" max="100"
              className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--sl-border-focus)]"
            />
          </Field>
          <Field label="Canales activos">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CANALES_MARCA.map(c => {
                const activo = fCanales.includes(c.abv)
                const rgb = hexToRgb(c.color)
                return (
                  <button
                    key={c.abv}
                    type="button"
                    onClick={() =>
                      setFCanales(prev =>
                        prev.includes(c.abv) ? prev.filter(x => x !== c.abv) : [...prev, c.abv],
                      )
                    }
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: `1px solid ${activo ? c.color : T.brd}`,
                      background: activo
                        ? (isDark ? `rgba(${rgb},0.22)` : `rgba(${rgb},0.12)`)
                        : 'transparent',
                      color: activo
                        ? (isDark
                          ? (c.abv === 'GL' ? '#e8f442' : c.color)
                          : (c.abv === 'GL' ? '#8a7800' : c.color))
                        : T.mut,
                      fontFamily: FONT.heading,
                      fontSize: 12,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {activo && <Check size={12} strokeWidth={3} />}
                    {c.label}
                  </button>
                )
              })}
            </div>
          </Field>
        </EditModal>
      )}
    </>
  )
}
