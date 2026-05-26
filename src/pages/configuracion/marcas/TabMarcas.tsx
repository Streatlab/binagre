import { useEffect, useMemo, useState } from 'react'
import { Trash2, Edit3, Power, Plus, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { COLORS, CARDS, kpiBig, kpiSm, lblSm, lblXs, OSWALD } from '@/components/panel/resumen/tokens'
import { EditModal, Field } from '@/components/configuracion/EditModal'
import { calcDesglosePorCanal, loadConfigCanales, loadMarcasPorCanal, useConfigCanales } from '@/lib/panel/calcNetoPlataforma'
import type { CanalAbv, EstadoMarca } from '@/types/configuracion'

interface AccesoRow { plataforma: CanalAbv; activo: boolean; email_acceso?: string | null }
interface MarcaRow {
  id: string
  nombre: string
  estado: EstadoMarca
  archivada_at: string | null
  accesos: AccesoRow[]
}

const PILL_COLORS: Record<string, { bg: string; text: string }> = {
  UE:  { bg: '#06C167', text: '#fff' },
  GL:  { bg: '#FFC107', text: '#111' },
  JE:  { bg: '#F36805', text: '#fff' },
  WEB: { bg: '#B01D23', text: '#fff' },
  DIR: { bg: '#66aaff', text: '#fff' },
}
const PLATAFORMAS: CanalAbv[] = ['UE', 'GL', 'JE', 'WEB', 'DIR']

const CANAL_DEFS = [
  { id: 'uber',  abv: 'UE'  as CanalAbv, label: 'Uber Eats',    color: '#06C167', bru: 'uber_bruto',    ped: 'uber_pedidos',    cfgName: 'Uber Eats' },
  { id: 'glovo', abv: 'GL'  as CanalAbv, label: 'Glovo',        color: '#FFC107', bru: 'glovo_bruto',   ped: 'glovo_pedidos',   cfgName: 'Glovo' },
  { id: 'je',    abv: 'JE'  as CanalAbv, label: 'Just Eat',     color: '#F36805', bru: 'je_bruto',      ped: 'je_pedidos',      cfgName: 'Just Eat' },
  { id: 'web',   abv: 'WEB' as CanalAbv, label: 'Web propia',   color: '#B01D23', bru: 'web_bruto',     ped: 'web_pedidos',     cfgName: 'Web Propia' },
  { id: 'dir',   abv: 'DIR' as CanalAbv, label: 'Directa',      color: '#66aaff', bru: 'directa_bruto', ped: 'directa_pedidos', cfgName: 'Venta Directa' },
]

export default function TabMarcas() {
  const { T, isDark } = useTheme()
  const config = useConfigCanales()
  const [marcas, setMarcas] = useState<MarcaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [incArchivadas, setIncArchivadas] = useState(false)

  const [editing, setEditing] = useState<MarcaRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [fNombre, setFNombre] = useState('')
  const [fEstado, setFEstado] = useState<EstadoMarca>('activa')
  const [fCanales, setFCanales] = useState<CanalAbv[]>([])
  const [saving, setSaving] = useState(false)

  const [delModal, setDelModal] = useState<MarcaRow | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ marca: MarcaRow; mode: 'archive' | 'total' } | null>(null)
  const [renameConflict, setRenameConflict] = useState<{ source: MarcaRow; target: MarcaRow } | null>(null)

  const [totales, setTotales] = useState<Record<string, { bruto: number; pedidos: number }>>({})
  const [desgloseCanal, setDesgloseCanal] = useState<Record<string, any>>({})
  const [rango, setRango] = useState<{ desde: Date | null; hasta: Date | null }>({ desde: null, hasta: null })

  async function refetch() {
    setLoading(true); setError(null)
    try {
      const { data: ms, error: e1 } = await supabase
        .from('marcas')
        .select('id, nombre, estado, archivada_at')
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
      const out: MarcaRow[] = (ms ?? []).map((m: any) => ({ ...m, accesos: accesosByMarca.get(m.id) ?? [] }))
      setMarcas(out)

      // HISTÓRICO COMPLETO: sin filtro fecha
      const { data: fact } = await supabase
        .from('facturacion_diario')
        .select('fecha,uber_bruto,uber_pedidos,glovo_bruto,glovo_pedidos,je_bruto,je_pedidos,web_bruto,web_pedidos,directa_bruto,directa_pedidos')
        .order('fecha', { ascending: true })

      const tot: Record<string, { bruto: number; pedidos: number }> = {}
      for (const c of CANAL_DEFS) tot[c.id] = { bruto: 0, pedidos: 0 }
      let fechaMin: string | null = null
      let fechaMax: string | null = null
      for (const r of (fact ?? []) as any[]) {
        if (!fechaMin || r.fecha < fechaMin) fechaMin = r.fecha
        if (!fechaMax || r.fecha > fechaMax) fechaMax = r.fecha
        for (const c of CANAL_DEFS) {
          tot[c.id].bruto   += Number(r[c.bru as keyof typeof r] || 0)
          tot[c.id].pedidos += Number(r[c.ped as keyof typeof r] || 0)
        }
      }
      setTotales(tot)

      const desde = fechaMin ? new Date(fechaMin) : new Date()
      const hasta = fechaMax ? new Date(fechaMax) : new Date()
      setRango({ desde, hasta })

      await loadConfigCanales()
      await loadMarcasPorCanal()
      const desg: Record<string, any> = {}
      for (const c of CANAL_DEFS) {
        const t = tot[c.id]
        if (t.bruto > 0) {
          desg[c.id] = calcDesglosePorCanal(c.id, t.bruto, t.pedidos, undefined, desde, hasta)
        } else {
          desg[c.id] = {
            bruto: 0, comisionConIva: 0, feePromoConIva: 0, feePrimeConIva: 0,
            feePeriodicoConIva: 0, fijoPedidoConIva: 0, totalDescuentos: 0, neto: 0,
          }
        }
      }
      setDesgloseCanal(desg)
    } catch (e: any) { setError(e?.message ?? 'Error') } finally { setLoading(false) }
  }
  useEffect(() => { refetch() }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        setEditing(null); setCreating(false)
        setDelModal(null); setConfirmDelete(null); setRenameConflict(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saving])

  async function toggleCanal(marca: MarcaRow, canal: CanalAbv) {
    const existente = marca.accesos.find(a => a.plataforma === canal)
    const nuevoEstado = existente ? !existente.activo : true
    if (existente) {
      await supabase.from('marca_plataforma_acceso')
        .update({ activo: nuevoEstado }).eq('marca_id', marca.id).eq('plataforma', canal)
    } else {
      await supabase.from('marca_plataforma_acceso')
        .insert({ marca_id: marca.id, plataforma: canal, activo: true })
    }
    refetch()
  }

  async function toggleMarcaCompleta(marca: MarcaRow, activar: boolean) {
    for (const p of PLATAFORMAS) {
      const ex = marca.accesos.find(a => a.plataforma === p)
      if (ex) {
        await supabase.from('marca_plataforma_acceso')
          .update({ activo: activar }).eq('marca_id', marca.id).eq('plataforma', p)
      } else if (activar) {
        await supabase.from('marca_plataforma_acceso')
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
    setFNombre(''); setFEstado('activa'); setFCanales([])
  }
  function openEdit(m: MarcaRow) {
    setEditing(m); setCreating(false)
    setFNombre(m.nombre); setFEstado(m.estado)
    setFCanales((m.accesos || []).filter(a => a.activo).map(a => a.plataforma as CanalAbv))
  }
  function close() { setEditing(null); setCreating(false) }

  async function syncCanales(marcaId: string, canalesActivos: CanalAbv[]) {
    const { data: existentes } = await supabase
      .from('marca_plataforma_acceso').select('plataforma, email_acceso').eq('marca_id', marcaId)
    const emailMap = new Map((existentes ?? []).map((x: any) => [x.plataforma as string, x.email_acceso as string | null]))
    await supabase.from('marca_plataforma_acceso').delete().eq('marca_id', marcaId)
    const rows = PLATAFORMAS.map(p => ({
      marca_id: marcaId, plataforma: p, activo: canalesActivos.includes(p), email_acceso: emailMap.get(p) ?? null,
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
        if (conflict) { setRenameConflict({ source: editing, target: conflict }); setSaving(false); return }
        await supabase.from('marca_alias').insert({ marca_id: editing.id, nombre_anterior: editing.nombre })
      }
      const payload = { nombre, estado: fEstado }
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
      await supabase.from('marca_alias').insert({ marca_id: target.id, nombre_anterior: source.nombre })
      await supabase.from('facturacion_diario').update({ marca_id: target.id }).eq('marca_id', source.id)
      await supabase.from('marca_plataforma_acceso').delete().eq('marca_id', source.id)
      await supabase.from('marcas').delete().eq('id', source.id)
      setRenameConflict(null); await refetch(); close()
    } catch (e: any) { setError(e?.message ?? 'Error unificando') } finally { setSaving(false) }
  }

  async function handleArchivar(marca: MarcaRow) {
    setSaving(true)
    try {
      await supabase.from('marcas').update({ archivada_at: new Date().toISOString(), estado: 'pausada' }).eq('id', marca.id)
      await supabase.from('marca_plataforma_acceso').update({ activo: false }).eq('marca_id', marca.id)
      setDelModal(null); setConfirmDelete(null); await refetch(); close()
    } catch (e: any) { setError(e?.message ?? 'Error archivando') } finally { setSaving(false) }
  }

  async function handleBorrarTotal(marca: MarcaRow) {
    setSaving(true)
    try {
      await supabase.from('marca_plataforma_acceso').delete().eq('marca_id', marca.id)
      await supabase.from('marca_alias').delete().eq('marca_id', marca.id)
      await supabase.from('facturacion_diario').delete().eq('marca_id', marca.id)
      await supabase.from('marcas').delete().eq('id', marca.id)
      setDelModal(null); setConfirmDelete(null); await refetch(); close()
    } catch (e: any) { setError(e?.message ?? 'Error borrando') } finally { setSaving(false) }
  }

  if (loading) return <div style={{ padding: 24, color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
  if (error) return (
    <div style={{ padding: 16, background: isDark ? '#3a1a1a' : '#FCE0E2', color: '#B01D23', borderRadius: 10, fontFamily: FONT.body }}>
      {error}
    </div>
  )

  const thStyle: React.CSSProperties = {
    padding: '14px 16px', fontFamily: FONT.heading, fontSize: 10,
    textTransform: 'uppercase', letterSpacing: '2px', color: T.mut,
    fontWeight: 400, background: T.group, textAlign: 'left',
  }
  const thCenterStyle: React.CSSProperties = { ...thStyle, textAlign: 'center' }
  const tdStyle: React.CSSProperties = { padding: '16px', fontFamily: FONT.body, fontSize: 14, color: T.pri }

  const PillCanal = ({ canal, activo, onClick }: { canal: CanalAbv; activo: boolean; onClick: (e: React.MouseEvent) => void }) => {
    const c = PILL_COLORS[canal]
    return (
      <button onClick={onClick}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '5px 10px', minWidth: 42,
          borderRadius: 5, fontFamily: FONT.heading, fontSize: 11, fontWeight: 700, letterSpacing: '1px',
          background: activo ? c.bg : 'transparent',
          color: activo ? c.text : T.mut,
          border: activo ? `1px solid ${c.bg}` : `1px dashed ${T.brd}`,
          cursor: 'pointer', transition: 'all 120ms', marginRight: 4,
        }}>
        {canal}
      </button>
    )
  }

  const fmt = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtN = (n: number) => Math.round(n).toLocaleString('es-ES')
  const pctOf = (n: number, total: number) => total > 0 ? `${((n / total) * 100).toFixed(2)}%` : '—'

  // Totales solo plataformas (UE+GL+JE)
  const totalPlat = useMemo(() => ({
    bruto:    ['uber','glovo','je'].reduce((a,c) => a + (totales[c]?.bruto || 0), 0),
    pedidos:  ['uber','glovo','je'].reduce((a,c) => a + (totales[c]?.pedidos || 0), 0),
    neto:     ['uber','glovo','je'].reduce((a,c) => a + (desgloseCanal[c]?.neto || 0), 0),
    comision: ['uber','glovo','je'].reduce((a,c) => a + (desgloseCanal[c]?.comisionConIva || 0), 0),
    feePrime: ['uber','glovo','je'].reduce((a,c) => a + (desgloseCanal[c]?.feePrimeConIva || 0), 0),
    feePromo: ['uber','glovo','je'].reduce((a,c) => a + (desgloseCanal[c]?.feePromoConIva || 0), 0),
    feePer:   ['uber','glovo','je'].reduce((a,c) => a + (desgloseCanal[c]?.feePeriodicoConIva || 0), 0),
    fijo:     ['uber','glovo','je'].reduce((a,c) => a + (desgloseCanal[c]?.fijoPedidoConIva || 0), 0),
    pedPrime: ['uber','glovo','je'].reduce((a,c) => {
      const cfg = config[CANAL_DEFS.find(x => x.id === c)!.cfgName]
      return a + (totales[c]?.pedidos || 0) * (cfg?.pct_pedidos_prime_estim || 0)
    }, 0),
    pedPromo: ['uber','glovo','je'].reduce((a,c) => {
      const cfg = config[CANAL_DEFS.find(x => x.id === c)!.cfgName]
      return a + (totales[c]?.pedidos || 0) * (cfg?.pct_pedidos_promo_estim || 0)
    }, 0),
  }), [totales, desgloseCanal, config])

  const rangoTxt = rango.desde && rango.hasta
    ? `${rango.desde.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })} → ${rango.hasta.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}`
    : 'sin datos'

  const renderCard = (cfg: typeof CANAL_DEFS[number], d: any, t: { bruto: number; pedidos: number }) => {
    const netoPct = t.bruto > 0 ? (d.neto / t.bruto) * 100 : 0
    const cfgCanal = config[cfg.cfgName]
    const pctPrime = cfgCanal?.pct_pedidos_prime_estim || 0
    const pctPromo = cfgCanal?.pct_pedidos_promo_estim || 0
    const nPrime = t.pedidos * pctPrime
    const nPromo = t.pedidos * pctPromo
    const tieneDatos = t.bruto > 0
    return (
      <div key={cfg.id} style={{ ...CARDS.big, padding: '20px 22px', borderTop: `3px solid ${cfg.color}` }}>
        {/* Header: label + % neto */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ ...lblSm, color: cfg.color, letterSpacing: '1.5px' }}>{cfg.label}</div>
          <div style={{ fontFamily: OSWALD, fontSize: 26, fontWeight: 700, color: tieneDatos ? cfg.color : COLORS.mut, lineHeight: 1 }}>
            {tieneDatos ? netoPct.toFixed(2) + '%' : '—'}
          </div>
        </div>
        <div style={{ ...lblXs, color: COLORS.mut, marginBottom: 14 }}>% NETO SOBRE BRUTO · HISTÓRICO</div>

        {/* Bruto / Neto grandes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ ...kpiSm, fontSize: 22, color: COLORS.pri, lineHeight: 1 }}>{fmt(t.bruto)}</div>
            <div style={{ ...lblXs, marginTop: 4 }}>BRUTO €</div>
          </div>
          <div>
            <div style={{ ...kpiSm, fontSize: 22, color: COLORS.ok, lineHeight: 1 }}>{fmt(d.neto)}</div>
            <div style={{ ...lblXs, marginTop: 4, color: COLORS.ok }}>NETO €</div>
          </div>
        </div>

        {/* Pedidos */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, paddingBottom: 10, borderBottom: `0.5px solid ${T.brd}` }}>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec }}>Pedidos</div>
          <div style={{ fontFamily: OSWALD, fontSize: 18, fontWeight: 600, color: T.pri }}>{fmtN(t.pedidos)}</div>
        </div>

        {/* Desglose costes */}
        <div style={{ fontFamily: FONT.body, fontSize: 11.5, color: T.sec, display: 'grid', gap: 4 }}>
          {d.comisionConIva > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Comisión</span>
              <span style={{ color: T.pri, fontWeight: 500 }}>{fmt(d.comisionConIva)} · {pctOf(d.comisionConIva, t.bruto)}</span>
            </div>
          )}
          {d.feePrimeConIva > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Fee Prime ({fmtN(nPrime)} ped · {(pctPrime*100).toFixed(1)}%)</span>
              <span style={{ color: T.pri, fontWeight: 500 }}>{fmt(d.feePrimeConIva)} · {pctOf(d.feePrimeConIva, t.bruto)}</span>
            </div>
          )}
          {d.feePromoConIva > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Fee Promo ({fmtN(nPromo)} ped · {(pctPromo*100).toFixed(1)}%)</span>
              <span style={{ color: T.pri, fontWeight: 500 }}>{fmt(d.feePromoConIva)} · {pctOf(d.feePromoConIva, t.bruto)}</span>
            </div>
          )}
          {d.feePeriodicoConIva > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Fee {cfg.id === 'uber' ? 'semanal' : cfg.id === 'glovo' ? 'quincenal' : 'periódico'}</span>
              <span style={{ color: T.pri, fontWeight: 500 }}>{fmt(d.feePeriodicoConIva)} · {pctOf(d.feePeriodicoConIva, t.bruto)}</span>
            </div>
          )}
          {d.fijoPedidoConIva > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Fee fijo / pedido</span>
              <span style={{ color: T.pri, fontWeight: 500 }}>{fmt(d.fijoPedidoConIva)} · {pctOf(d.fijoPedidoConIva, t.bruto)}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Etiqueta rango histórico */}
      <div style={{ ...lblXs, marginBottom: 10, color: T.mut }}>HISTÓRICO COMPLETO · {rangoTxt}</div>

      {/* 6 CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 22 }}>
        {CANAL_DEFS.map(cfg => renderCard(cfg, desgloseCanal[cfg.id] || {}, totales[cfg.id] || { bruto: 0, pedidos: 0 }))}
        {/* Card consolidada plataformas */}
        <div style={{ ...CARDS.big, padding: '20px 22px', borderTop: `3px solid ${COLORS.redSL}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ ...lblSm, color: COLORS.redSL, letterSpacing: '1.5px' }}>Plataformas UE+GL+JE</div>
            <div style={{ fontFamily: OSWALD, fontSize: 26, fontWeight: 700, color: COLORS.redSL, lineHeight: 1 }}>
              {totalPlat.bruto > 0 ? ((totalPlat.neto / totalPlat.bruto) * 100).toFixed(2) + '%' : '—'}
            </div>
          </div>
          <div style={{ ...lblXs, color: COLORS.mut, marginBottom: 14 }}>% NETO PONDERADO · HISTÓRICO</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <div style={{ ...kpiSm, fontSize: 22, color: COLORS.pri, lineHeight: 1 }}>{fmt(totalPlat.bruto)}</div>
              <div style={{ ...lblXs, marginTop: 4 }}>BRUTO €</div>
            </div>
            <div>
              <div style={{ ...kpiSm, fontSize: 22, color: COLORS.ok, lineHeight: 1 }}>{fmt(totalPlat.neto)}</div>
              <div style={{ ...lblXs, marginTop: 4, color: COLORS.ok }}>NETO €</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, paddingBottom: 10, borderBottom: `0.5px solid ${T.brd}` }}>
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec }}>Pedidos totales</div>
            <div style={{ fontFamily: OSWALD, fontSize: 18, fontWeight: 600, color: T.pri }}>{fmtN(totalPlat.pedidos)}</div>
          </div>

          <div style={{ fontFamily: FONT.body, fontSize: 11.5, color: T.sec, display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Comisión total</span>
              <span style={{ color: T.pri, fontWeight: 500 }}>{fmt(totalPlat.comision)} · {pctOf(totalPlat.comision, totalPlat.bruto)}</span>
            </div>
            {totalPlat.feePrime > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Fees Prime ({fmtN(totalPlat.pedPrime)} ped)</span>
                <span style={{ color: T.pri, fontWeight: 500 }}>{fmt(totalPlat.feePrime)} · {pctOf(totalPlat.feePrime, totalPlat.bruto)}</span>
              </div>
            )}
            {totalPlat.feePromo > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Fees Promo ({fmtN(totalPlat.pedPromo)} ped)</span>
                <span style={{ color: T.pri, fontWeight: 500 }}>{fmt(totalPlat.feePromo)} · {pctOf(totalPlat.feePromo, totalPlat.bruto)}</span>
              </div>
            )}
            {totalPlat.feePer > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Fees periódicos</span>
                <span style={{ color: T.pri, fontWeight: 500 }}>{fmt(totalPlat.feePer)} · {pctOf(totalPlat.feePer, totalPlat.bruto)}</span>
              </div>
            )}
            {totalPlat.fijo > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Fees fijos</span>
                <span style={{ color: T.pri, fontWeight: 500 }}>{fmt(totalPlat.fijo)} · {pctOf(totalPlat.fijo, totalPlat.bruto)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.mut, pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar marca..."
            style={{
              background: T.inp, border: `0.5px solid ${T.brd}`, borderRadius: 6,
              padding: '8px 12px 8px 32px', fontSize: 12, fontFamily: FONT.body,
              color: T.pri, width: 260, outline: 'none',
            }} />
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

      <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                <th style={thStyle}>Marca</th>
                <th style={thStyle}>Canales</th>
                <th style={thCenterStyle}>Toggle</th>
                <th style={thCenterStyle}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(m => {
                const algunoActivo = PLATAFORMAS.some(p => m.accesos.find(a => a.plataforma === p && a.activo))
                return (
                  <tr key={m.id} style={{ borderBottom: `0.5px solid ${T.brd}`, opacity: m.archivada_at ? 0.5 : 1 }}>
                    <td style={{ ...tdStyle, color: T.pri, fontWeight: 600 }}>
                      {m.nombre}
                      {m.archivada_at && <span style={{ marginLeft: 8, fontSize: 9, color: T.mut, fontFamily: FONT.heading, letterSpacing: 1, textTransform: 'uppercase' }}>Archivada</span>}
                    </td>
                    <td style={tdStyle}>
                      {PLATAFORMAS.map(p => {
                        const a = m.accesos.find(x => x.plataforma === p)
                        return <PillCanal key={p} canal={p} activo={!!a?.activo} onClick={(e) => { e.stopPropagation(); toggleCanal(m, p) }} />
                      })}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button onClick={(e) => { e.stopPropagation(); toggleMarcaCompleta(m, !algunoActivo) }}
                        style={{
                          padding: '6px 14px', borderRadius: 5,
                          background: algunoActivo ? '#1D9E75' : T.inp,
                          color: algunoActivo ? '#fff' : T.mut,
                          border: `1px solid ${algunoActivo ? '#1D9E75' : T.brd}`,
                          fontFamily: FONT.heading, fontSize: 11, letterSpacing: 1, cursor: 'pointer', fontWeight: 600,
                        }}>
                        <Power size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                        {algunoActivo ? 'ON' : 'OFF'}
                      </button>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button onClick={(e) => { e.stopPropagation(); openEdit(m) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.mut, padding: 6, marginRight: 6 }}>
                        <Edit3 size={16} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setDelModal(m) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B01D23', padding: 6 }}>
                        <Trash2 size={16} />
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

      {(editing || creating) && (
        <EditModal
          title={creating ? 'Nueva marca' : `Editar ${editing?.nombre}`}
          onCancel={close} onSave={handleSave} saving={saving}>
          <Field label="Nombre">
            <input value={fNombre} onChange={e => setFNombre(e.target.value)} placeholder="Nombre de la marca" autoFocus
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: `0.5px solid ${T.brd}`, fontSize: 13, fontFamily: FONT.body, background: T.inp, color: T.pri, outline: 'none' }} />
          </Field>
          <Field label="Plataformas activas">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PLATAFORMAS.map(p => {
                const activo = fCanales.includes(p)
                const c = PILL_COLORS[p]
                return (
                  <button key={p} type="button" onClick={() => setFCanales(prev => activo ? prev.filter(x => x !== p) : [...prev, p])}
                    style={{
                      padding: '6px 12px', borderRadius: 5, fontFamily: FONT.heading, fontSize: 11, fontWeight: 700, letterSpacing: 1,
                      background: activo ? c.bg : 'transparent',
                      color: activo ? c.text : T.mut,
                      border: activo ? `1px solid ${c.bg}` : `1px dashed ${T.brd}`,
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

      {delModal && !confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: 16 }} onClick={() => !saving && setDelModal(null)}>
          <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 16, width: '100%', maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: `0.5px solid ${T.brd}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: FONT.heading, fontSize: 15, margin: 0, color: T.pri, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>Eliminar marca</h3>
              <button onClick={() => !saving && setDelModal(null)} style={{ background: 'none', border: 'none', color: T.mut, fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 14, color: T.pri, fontFamily: FONT.body, marginTop: 0, marginBottom: 16 }}>
                ¿Cómo quieres eliminar <strong>{delModal.nombre}</strong>?
              </p>
              <button onClick={() => setConfirmDelete({ marca: delModal, mode: 'archive' })}
                style={{ width: '100%', padding: '14px 16px', marginBottom: 10, background: T.inp, border: `1px solid ${T.brd}`, borderRadius: 8, textAlign: 'left', cursor: 'pointer', fontFamily: FONT.body }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.pri, marginBottom: 4 }}>📦 Archivar (conservar histórico)</div>
                <div style={{ fontSize: 11, color: T.mut }}>Marca se oculta pero conserva todos los datos.</div>
              </button>
              <button onClick={() => setConfirmDelete({ marca: delModal, mode: 'total' })}
                style={{ width: '100%', padding: '14px 16px', background: 'transparent', border: '1px solid #B01D23', borderRadius: 8, textAlign: 'left', cursor: 'pointer', fontFamily: FONT.body }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#B01D23', marginBottom: 4 }}>🗑 Borrar todo (sin vuelta atrás)</div>
                <div style={{ fontSize: 11, color: T.mut }}>Elimina marca y TODOS sus datos.</div>
              </button>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                <button onClick={() => setDelModal(null)}
                  style={{ padding: '8px 16px', background: 'transparent', color: T.mut, border: `0.5px solid ${T.brd}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: FONT.body }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', padding: 16 }} onClick={() => !saving && setConfirmDelete(null)}>
          <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 16, width: '100%', maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: `0.5px solid ${T.brd}` }}>
              <h3 style={{ fontFamily: FONT.heading, fontSize: 14, margin: 0, color: confirmDelete.mode === 'total' ? '#B01D23' : T.pri, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>
                {confirmDelete.mode === 'total' ? '⚠ Confirmar borrado total' : 'Confirmar archivar'}
              </h3>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 13, color: T.pri, fontFamily: FONT.body, marginTop: 0, marginBottom: 16, lineHeight: 1.5 }}>
                {confirmDelete.mode === 'total'
                  ? <>Vas a borrar <strong>{confirmDelete.marca.nombre}</strong> y todos sus datos sin posibilidad de recuperarlos. ¿Confirmas?</>
                  : <>Vas a archivar <strong>{confirmDelete.marca.nombre}</strong>. ¿Confirmas?</>}
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmDelete(null)} disabled={saving}
                  style={{ padding: '8px 16px', background: 'transparent', color: T.mut, border: `0.5px solid ${T.brd}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: FONT.body }}>
                  Cancelar
                </button>
                <button
                  onClick={() => confirmDelete.mode === 'total' ? handleBorrarTotal(confirmDelete.marca) : handleArchivar(confirmDelete.marca)}
                  disabled={saving}
                  style={{
                    padding: '8px 16px',
                    background: confirmDelete.mode === 'total' ? '#B01D23' : '#1D9E75',
                    color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    fontFamily: FONT.heading, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
                  }}>
                  {saving ? '...' : (confirmDelete.mode === 'total' ? 'Sí, borrar todo' : 'Sí, archivar')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {renameConflict && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: 16 }} onClick={() => !saving && setRenameConflict(null)}>
          <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 16, width: '100%', maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: `0.5px solid ${T.brd}` }}>
              <h3 style={{ fontFamily: FONT.heading, fontSize: 15, margin: 0, color: T.pri, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>Nombre ya existe</h3>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 13, color: T.pri, fontFamily: FONT.body, marginTop: 0, marginBottom: 14, lineHeight: 1.5 }}>
                Ya existe una marca llamada <strong>"{renameConflict.target.nombre}"</strong>. ¿Quieres unificar <strong>"{renameConflict.source.nombre}"</strong> con ella?
              </p>
              <button onClick={handleUnificar} disabled={saving}
                style={{ width: '100%', padding: '12px 16px', marginBottom: 10, background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, textAlign: 'left', cursor: saving ? 'default' : 'pointer', fontFamily: FONT.body }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>✓ Unificar todo en "{renameConflict.target.nombre}"</div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>Datos de "{renameConflict.source.nombre}" se moverán. La marca origen se borra.</div>
              </button>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setRenameConflict(null)}
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
