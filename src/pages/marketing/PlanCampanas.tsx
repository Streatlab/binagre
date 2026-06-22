import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, CARDS, lbl, lblSm, kpiMid, TABS_PILL } from '@/components/panel/resumen/tokens'
import { fmtEur } from '@/utils/format'

/* ═════════════ PLAN ADS & PROMOS · Jul–Dic 2026 ═════════════
   Panel estratégico + planificador financiero del Plan Maestro.
   Lee/escribe crm_campanas (codigo_promo LIKE 'PLAN-%') y lee crm_campanas_metricas.
   Tabs: Resumen · Retorno · Cronograma · Por marca · Por canal · Detalle.
*/

type Campana = {
  id: number; nombre: string; marca: string | null; producto: string | null
  canal: string; tipo: string; objetivo_smart: string; kpi_principal: string
  kpi_meta: number | null; codigo_promo: string | null; mecanica: string | null
  mecanica_plataforma: string | null; fecha_inicio: string; fecha_fin: string | null
  presupuesto: number; estado: string
}
type Metrica = { id: number; campana_id: number; fecha: string; pedidos: number; ventas: number; nuevos_clientes: number; canjes_codigo: number; coste: number }

const CANAL_LABEL: Record<string, string> = { uber_eats: 'Uber Eats', glovo: 'Glovo', just_eat: 'Just Eat', web: 'Web propia' }
const CANAL_COLOR: Record<string, string> = { uber_eats: COLORS.uber, glovo: COLORS.glovo, just_eat: COLORS.je, web: COLORS.web }
const CANAL_TXT: Record<string, string> = { glovo: COLORS.glovoText }
const CANAL_NETO: Record<string, number> = { uber_eats: 0.55, glovo: 0.52, just_eat: 0.63, web: 0.96 }
const MECANICA_LABEL: Record<string, string> = { '2x1_bogo': '2x1 (BOGO)', descuento_item: '% descuento', pct_pedido: 'Gasta más ahorra más', nuevo_usuario: 'Artículo gratis', envio_gratis: 'Envío gratis', ads_posicion: 'Ads / posición' }
const TIPO_LABEL: Record<string, string> = { captacion: 'Captación', ticket_medio: 'Ticket medio', repeticion: 'Repetición' }
const TIPO_COLOR: Record<string, string> = { captacion: COLORS.lun, ticket_medio: COLORS.modal, repeticion: COLORS.ok }
const ESTADO_COLOR: Record<string, string> = { planificada: COLORS.mut, borrador: COLORS.mut, activa: COLORS.ok, pausada: COLORS.warn, cerrada: COLORS.err }
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const OBJETIVOS = [
  { k: 'Facturación', v: '+70%', s: '14,7k → 25k €/mes', c: COLORS.redSL },
  { k: 'Beneficio', v: '+40%', s: 'mejor mix + precios', c: COLORS.ok },
  { k: 'Nuevos clientes', v: '+200%', s: '×3 captación', c: COLORS.lun },
  { k: 'Recompra 30d', v: '35%', s: 'rituales + 2º pedido', c: COLORS.modal },
]

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'retorno', label: 'Retorno' },
  { id: 'cronograma', label: 'Cronograma' },
  { id: 'marcas', label: 'Por marca' },
  { id: 'canales', label: 'Por canal' },
  { id: 'detalle', label: 'Detalle' },
] as const

const th: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLORS.mut, fontWeight: 500, padding: '8px 10px', textAlign: 'left', borderBottom: `1px solid ${COLORS.brd}`, cursor: 'pointer', userSelect: 'none' }
const td: React.CSSProperties = { fontFamily: FONT.body, fontSize: 13, color: COLORS.sec, padding: '8px 10px', borderBottom: `1px solid ${COLORS.group}` }
const inp: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: `0.5px solid ${COLORS.brd}`, background: COLORS.card, color: COLORS.pri, fontSize: 13, fontFamily: FONT.body, outline: 'none' }
const btnGhost: React.CSSProperties = { padding: '4px 10px', borderRadius: 6, border: `0.5px solid ${COLORS.brd}`, background: 'transparent', color: COLORS.sec, cursor: 'pointer', fontSize: 11, fontFamily: FONT.body }

const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
const iso = (d: Date) => d.toISOString().slice(0, 10)
const dias = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ ...CARDS.std, flex: 1, minWidth: 150 }}>
      <div style={lbl}>{label}</div>
      <div style={{ ...kpiMid, marginTop: 6, color: color ?? COLORS.pri }}>{value}</div>
      {sub && <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
function Pill({ text, bg, txt }: { text: string; bg: string; txt?: string }) {
  return <span style={{ fontSize: 10, fontFamily: FONT.heading, letterSpacing: '0.5px', padding: '2px 8px', borderRadius: 4, background: bg, color: txt ?? '#fff', textTransform: 'uppercase' }}>{text}</span>
}
function Bar({ pct, color, h = 8 }: { pct: number; color: string; h?: number }) {
  return (
    <div style={{ flex: 1, height: h, background: COLORS.group, borderRadius: h / 2 }}>
      <div style={{ height: h, width: `${Math.max(2, Math.min(100, pct))}%`, background: color, borderRadius: h / 2, transition: 'width .4s' }} />
    </div>
  )
}
function Donut({ segs, size = 150, hole = 0.62, center }: { segs: { label: string; value: number; color: string }[]; size?: number; hole?: number; center?: string }) {
  const total = segs.reduce((s, x) => s + x.value, 0) || 1
  const r = size / 2, sw = (size / 2) * (1 - hole)
  const rr = r - sw / 2
  const c = 2 * Math.PI * rr
  let off = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <g transform={`rotate(-90 ${r} ${r})`}>
        {segs.map((s, i) => {
          const frac = s.value / total
          const dash = frac * c
          const el = <circle key={i} cx={r} cy={r} r={rr} fill="none" stroke={s.color} strokeWidth={sw} strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-off} />
          off += dash
          return el
        })}
      </g>
      {center && <text x={r} y={r} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 700, fill: COLORS.pri }}>{center}</text>}
    </svg>
  )
}

function presupuestoPorMes(camp: Campana[]) {
  const acc: Record<string, number> = {}
  for (const c of camp) {
    const ini = new Date(c.fecha_inicio + 'T00:00:00')
    const fin = c.fecha_fin ? new Date(c.fecha_fin + 'T00:00:00') : ini
    const totalDias = Math.max(1, Math.round((fin.getTime() - ini.getTime()) / 86400000) + 1)
    const cur = new Date(ini)
    while (cur <= fin) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth()).padStart(2, '0')}`
      acc[key] = (acc[key] || 0) + Number(c.presupuesto || 0) / totalDias
      cur.setDate(cur.getDate() + 1)
    }
  }
  return acc
}

export default function PlanCampanas() {
  const [camp, setCamp] = useState<Campana[]>([])
  const [met, setMet] = useState<Metrica[]>([])
  const [cargando, setCargando] = useState(true)
  const [tab, setTab] = useState<typeof TABS[number]['id']>('resumen')
  const [msg, setMsg] = useState('')

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('crm_campanas').select('*').like('codigo_promo', 'PLAN-%').order('fecha_inicio')
    const lista = (data as Campana[]) || []
    setCamp(lista)
    if (lista.length) {
      const ids = lista.map(c => c.id)
      const { data: m } = await supabase.from('crm_campanas_metricas').select('*').in('campana_id', ids)
      setMet((m as Metrica[]) || [])
    }
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])
  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(''), 2500) }
  async function cambiarEstado(c: Campana, estado: string) {
    await supabase.from('crm_campanas').update({ estado }).eq('id', c.id)
    setCamp(cs => cs.map(x => x.id === c.id ? { ...x, estado } : x)); flash(`${c.nombre} → ${estado}`)
  }

  const aggMet = useMemo(() => {
    const m: Record<number, { pedidos: number; ventas: number; nuevos: number; canjes: number; coste: number }> = {}
    for (const x of met) {
      if (!m[x.campana_id]) m[x.campana_id] = { pedidos: 0, ventas: 0, nuevos: 0, canjes: 0, coste: 0 }
      m[x.campana_id].pedidos += x.pedidos || 0
      m[x.campana_id].ventas += Number(x.ventas) || 0
      m[x.campana_id].nuevos += x.nuevos_clientes || 0
      m[x.campana_id].canjes += x.canjes_codigo || 0
      m[x.campana_id].coste += Number(x.coste) || 0
    }
    return m
  }, [met])

  const tot = useMemo(() => {
    const presupuesto = camp.reduce((s, c) => s + Number(c.presupuesto || 0), 0)
    const ads = camp.filter(c => c.mecanica_plataforma === 'ads_posicion').reduce((s, c) => s + Number(c.presupuesto || 0), 0)
    const promo = presupuesto - ads
    const porTipo: Record<string, number> = {}
    camp.forEach(c => { porTipo[c.tipo] = (porTipo[c.tipo] || 0) + Number(c.presupuesto || 0) })
    const ventasReales = Object.values(aggMet).reduce((s, a) => s + a.ventas, 0)
    const nuevosReales = Object.values(aggMet).reduce((s, a) => s + a.nuevos, 0)
    const roasMetas = camp.filter(c => c.kpi_principal === 'roas' && c.kpi_meta).map(c => Number(c.kpi_meta))
    const roasObj = roasMetas.length ? roasMetas.reduce((a, b) => a + b, 0) / roasMetas.length : 0
    const activas = camp.filter(c => c.estado === 'activa').length
    return { presupuesto, ads, promo, porTipo, ventasReales, nuevosReales, roasObj, activas }
  }, [camp, aggMet])

  const porCanal = useMemo(() => {
    const m: Record<string, { n: number; eur: number; ads: number; promo: number }> = {}
    camp.forEach(c => { if (!m[c.canal]) m[c.canal] = { n: 0, eur: 0, ads: 0, promo: 0 }; m[c.canal].n++; const e = Number(c.presupuesto || 0); m[c.canal].eur += e; if (c.mecanica_plataforma === 'ads_posicion') m[c.canal].ads += e; else m[c.canal].promo += e })
    return m
  }, [camp])

  const porMarca = useMemo(() => {
    const m: Record<string, { n: number; eur: number; canales: Set<string> }> = {}
    camp.forEach(c => { const k = c.marca || 'Multi'; if (!m[k]) m[k] = { n: 0, eur: 0, canales: new Set() }; m[k].n++; m[k].eur += Number(c.presupuesto || 0); m[k].canales.add(c.canal) })
    return Object.entries(m).sort((a, b) => b[1].eur - a[1].eur)
  }, [camp])

  const mesData = useMemo(() => {
    const acc = presupuestoPorMes(camp)
    return Object.keys(acc).sort().map(k => { const [y, m] = k.split('-').map(Number); return { label: `${MESES[m]} ${String(y).slice(2)}`, eur: acc[k] } })
  }, [camp])

  const alertas = useMemo(() => {
    const out: { sev: 'urgente' | 'aviso' | 'ok'; txt: string }[] = []
    const hStr = iso(hoy)
    camp.filter(c => c.estado === 'planificada' && dias(hStr, c.fecha_inicio) >= 0 && dias(hStr, c.fecha_inicio) <= 14)
      .forEach(c => out.push({ sev: 'urgente', txt: `Arranca en ${dias(hStr, c.fecha_inicio)}d: «${c.nombre}» — activar en plataforma y marcar como activa` }))
    camp.filter(c => c.estado === 'activa' && !aggMet[c.id]).forEach(c => out.push({ sev: 'aviso', txt: `«${c.nombre}» activa sin métricas registradas — cargar datos en CRM` }))
    camp.filter(c => c.estado === 'planificada' && c.fecha_fin && dias(hStr, c.fecha_fin) < 0).forEach(c => out.push({ sev: 'aviso', txt: `«${c.nombre}» venció sin lanzarse — replanificar o descartar` }))
    if (!out.length) out.push({ sev: 'ok', txt: 'Sin acciones urgentes. Plan al día.' })
    return out
  }, [camp, aggMet])

  function exportCSV() {
    const head = ['codigo', 'nombre', 'marca', 'canal', 'tipo', 'mecanica', 'inicio', 'fin', 'presupuesto', 'kpi', 'meta', 'estado', 'objetivo']
    const rows = camp.map(c => [c.codigo_promo, c.nombre, c.marca || 'Multi', CANAL_LABEL[c.canal] || c.canal, TIPO_LABEL[c.tipo] || c.tipo, MECANICA_LABEL[c.mecanica_plataforma || ''] || '', c.fecha_inicio, c.fecha_fin || '', c.presupuesto, c.kpi_principal, c.kpi_meta ?? '', c.estado, c.objetivo_smart])
    const csv = [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'plan_ads_promos_jul_dic_2026.csv'; a.click()
  }

  if (cargando) return <div style={{ background: COLORS.bg, minHeight: '100vh', padding: 28, color: COLORS.mut, fontFamily: FONT.body }}>Cargando plan...</div>

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', padding: '24px 28px', fontFamily: FONT.body, color: COLORS.pri }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: COLORS.redSL, letterSpacing: 3, textTransform: 'uppercase' }}>Plan Ads &amp; Promos · Jul–Dic 2026</div>
          <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut, marginTop: 2 }}>{camp.length} campañas · {tot.activas} activas · Uber Eats · Glovo · Just Eat</div>
        </div>
        <button onClick={exportCSV} style={btnGhost}>Exportar CSV</button>
      </div>

      {msg && <div style={{ ...CARDS.std, borderLeft: `3px solid ${COLORS.ok}`, margin: '0 0 12px', fontSize: 13, color: COLORS.pri }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        {OBJETIVOS.map(o => (
          <div key={o.k} style={{ ...CARDS.std, flex: 1, minWidth: 150, borderLeft: `3px solid ${o.c}` }}>
            <div style={lblSm}>{o.k}</div>
            <div style={{ fontFamily: FONT.heading, fontSize: 26, fontWeight: 700, color: o.c, marginTop: 2 }}>{o.v}</div>
            <div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, marginTop: 2 }}>{o.s}</div>
          </div>
        ))}
      </div>

      <div style={{ ...CARDS.std, marginBottom: 14 }}>
        <div style={{ ...lblSm, marginBottom: 8 }}>Próximas acciones</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {alertas.map((a, i) => {
            const col = a.sev === 'urgente' ? COLORS.err : a.sev === 'aviso' ? COLORS.warn : COLORS.ok
            return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT.body, fontSize: 13, color: COLORS.sec }}><span style={{ width: 8, height: 8, borderRadius: 4, background: col, flexShrink: 0 }} />{a.txt}</div>
          })}
        </div>
      </div>

      {camp.length === 0 ? (
        <div style={{ ...CARDS.std, color: COLORS.mut }}>No hay campañas del plan cargadas (codigo_promo PLAN-*).</div>
      ) : (
        <>
          <div style={TABS_PILL.container}>
            {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={tab === t.id ? TABS_PILL.active : TABS_PILL.inactive}>{t.label}</button>)}
          </div>
          <div style={{ marginTop: 14 }}>
            {tab === 'resumen' && <TabResumen tot={tot} porCanal={porCanal} mesData={mesData} porMarca={porMarca} />}
            {tab === 'retorno' && <TabRetorno porCanal={porCanal} totPresupuesto={tot.presupuesto} />}
            {tab === 'cronograma' && <TabCronograma camp={camp} />}
            {tab === 'marcas' && <TabMarcas porMarca={porMarca} camp={camp} />}
            {tab === 'canales' && <TabCanales porCanal={porCanal} camp={camp} totalPresupuesto={tot.presupuesto} />}
            {tab === 'detalle' && <TabDetalle camp={camp} aggMet={aggMet} onEstado={cambiarEstado} />}
          </div>
        </>
      )}
    </div>
  )
}

/* ═════════════ RESUMEN ═════════════ */
function TabResumen({ tot, porCanal, mesData, porMarca }: any) {
  const maxMes = Math.max(1, ...mesData.map((m: any) => m.eur))
  const tipoSegs = Object.entries(tot.porTipo).map(([t, eur]: any) => ({ label: TIPO_LABEL[t] || t, value: eur, color: TIPO_COLOR[t] || COLORS.mut }))
  const canalSegs = Object.entries(porCanal).map(([c, v]: any) => ({ label: CANAL_LABEL[c] || c, value: v.eur, color: CANAL_COLOR[c] || COLORS.mut }))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard label="Campañas" value={String(porMarca.reduce((s: number, m: any) => s + m[1].n, 0))} sub={`${porMarca.length} marcas`} color={COLORS.redSL} />
        <KpiCard label="Presupuesto total" value={fmtEur(tot.presupuesto)} sub="semestre" color={COLORS.ok} />
        <KpiCard label="Ads (posición)" value={fmtEur(tot.ads)} sub={`${Math.round(tot.ads / tot.presupuesto * 100)}%`} color={COLORS.lun} />
        <KpiCard label="Promos (descuentos)" value={fmtEur(tot.promo)} sub={`${Math.round(tot.promo / tot.presupuesto * 100)}%`} color={COLORS.modal} />
        <KpiCard label="ROAS objetivo" value={`≥ ${tot.roasObj.toFixed(1)}:1`} sub="campañas de ads" color={COLORS.ok} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
        <div style={CARDS.std}>
          <div style={{ ...lbl, marginBottom: 10 }}>Inversión por objetivo</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Donut segs={tipoSegs} center={`${Object.keys(tot.porTipo).length}`} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {tipoSegs.map(s => (
                <div key={s.label} style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.sec }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: s.color, marginRight: 6 }} />{s.label}</span><b style={{ color: COLORS.pri }}>{fmtEur(s.value)}</b></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={CARDS.std}>
          <div style={{ ...lbl, marginBottom: 10 }}>Inversión por plataforma</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Donut segs={canalSegs} center={`${canalSegs.length}`} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {canalSegs.sort((a, b) => b.value - a.value).map(s => (
                <div key={s.label} style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.sec }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: s.color, marginRight: 6 }} />{s.label}</span><b style={{ color: COLORS.pri }}>{fmtEur(s.value)}</b></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={CARDS.big}>
        <div style={{ ...lbl, marginBottom: 14 }}>Presupuesto por mes</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 180, paddingBottom: 4 }}>
          {mesData.map((m: any) => (
            <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 12, fontWeight: 600, color: COLORS.pri, marginBottom: 4 }}>{fmtEur(m.eur)}</div>
              <div style={{ width: '70%', maxWidth: 60, height: `${(m.eur / maxMes) * 100}%`, background: COLORS.redSL, borderRadius: '6px 6px 0 0', minHeight: 4 }} />
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: COLORS.mut, marginTop: 6 }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═════════════ RETORNO ═════════════ */
function TabRetorno({ porCanal, totPresupuesto }: { porCanal: Record<string, any>; totPresupuesto: number }) {
  const [roasAds, setRoasAds] = useState(5)
  const [multPromo, setMultPromo] = useState(6)
  const filas = Object.entries(porCanal).map(([canal, v]: any) => {
    const ventas = v.ads * roasAds + v.promo * multPromo
    const neto = CANAL_NETO[canal] || 0.55
    const margenNeto = ventas * neto - v.eur
    return { canal, inv: v.eur, ads: v.ads, promo: v.promo, ventas, neto, margenNeto }
  }).sort((a, b) => b.margenNeto - a.margenNeto)
  const ventasTot = filas.reduce((s, f) => s + f.ventas, 0)
  const margenTot = filas.reduce((s, f) => s + f.margenNeto, 0)
  const roiTot = totPresupuesto > 0 ? margenTot / totPresupuesto : 0
  const objetivoIncremental = 14700 * 0.70 * 6
  const cobertura = objetivoIncremental > 0 ? ventasTot / objetivoIncremental : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...CARDS.std, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut }}>Supuestos editables:</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT.body, fontSize: 13, color: COLORS.sec }}>ROAS ads (€ venta / € ads)
          <input type="number" step="0.5" value={roasAds} onChange={e => setRoasAds(Number(e.target.value) || 0)} style={{ ...inp, width: 80 }} /></label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT.body, fontSize: 13, color: COLORS.sec }}>Multiplicador promo (€ venta / € descuento)
          <input type="number" step="0.5" value={multPromo} onChange={e => setMultPromo(Number(e.target.value) || 0)} style={{ ...inp, width: 80 }} /></label>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard label="Inversión total" value={fmtEur(totPresupuesto)} sub="ads + promos, semestre" color={COLORS.modal} />
        <KpiCard label="Ventas proyectadas" value={fmtEur(ventasTot)} sub="brutas incrementales" color={COLORS.lun} />
        <KpiCard label="Margen proyectado" value={fmtEur(margenTot)} sub="tras plataforma − inversión" color={margenTot >= 0 ? COLORS.ok : COLORS.err} />
        <KpiCard label="ROI del plan" value={`${Math.round(roiTot * 100)}%`} sub="margen / inversión" color={COLORS.ok} />
        <KpiCard label="Cobertura objetivo +70%" value={`${Math.round(cobertura * 100)}%`} sub={`de ${fmtEur(objetivoIncremental)} incrementales`} color={COLORS.redSL} />
      </div>

      <div style={{ ...CARDS.std, overflowX: 'auto' }}>
        <div style={{ ...lbl, marginBottom: 10 }}>Retorno proyectado por canal</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={th}>Canal</th><th style={{ ...th, textAlign: 'right' }}>Inversión</th><th style={{ ...th, textAlign: 'right' }}>Ads</th><th style={{ ...th, textAlign: 'right' }}>Promo</th>
            <th style={{ ...th, textAlign: 'right' }}>Ventas proy.</th><th style={{ ...th, textAlign: 'right' }}>Neto canal</th><th style={{ ...th, textAlign: 'right' }}>Margen neto</th>
          </tr></thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.canal}>
                <td style={{ ...td, color: CANAL_TXT[f.canal] || CANAL_COLOR[f.canal], fontFamily: FONT.heading, fontWeight: 600 }}>{CANAL_LABEL[f.canal] || f.canal}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmtEur(f.inv)}</td>
                <td style={{ ...td, textAlign: 'right', color: COLORS.mut }}>{fmtEur(f.ads)}</td>
                <td style={{ ...td, textAlign: 'right', color: COLORS.mut }}>{fmtEur(f.promo)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmtEur(f.ventas)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{Math.round(f.neto * 100)}%</td>
                <td style={{ ...td, textAlign: 'right', fontFamily: FONT.heading, color: f.margenNeto >= 0 ? COLORS.ok : COLORS.err }}>{fmtEur(f.margenNeto)}</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...td, fontFamily: FONT.heading, color: COLORS.pri }}>TOTAL</td>
              <td style={{ ...td, textAlign: 'right', fontFamily: FONT.heading, color: COLORS.pri }}>{fmtEur(totPresupuesto)}</td>
              <td style={td}></td><td style={td}></td>
              <td style={{ ...td, textAlign: 'right', fontFamily: FONT.heading, color: COLORS.pri }}>{fmtEur(ventasTot)}</td>
              <td style={td}></td>
              <td style={{ ...td, textAlign: 'right', fontFamily: FONT.heading, color: margenTot >= 0 ? COLORS.ok : COLORS.err }}>{fmtEur(margenTot)}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, marginTop: 8 }}>Modelo conservador y editable. Ventas = ads×ROAS + promo×multiplicador. Margen = ventas×neto del canal − inversión. Ajusta los supuestos arriba; los números no son promesa, son herramienta de decisión.</div>
      </div>
    </div>
  )
}

/* ═════════════ CRONOGRAMA ═════════════ */
function TabCronograma({ camp }: { camp: Campana[] }) {
  const fechas = camp.flatMap(c => [c.fecha_inicio, c.fecha_fin].filter(Boolean) as string[])
  const min = fechas.reduce((a, b) => (a < b ? a : b))
  const max = fechas.reduce((a, b) => (a > b ? a : b))
  const minD = new Date(min + 'T00:00:00'), maxD = new Date(max + 'T00:00:00')
  const totalMs = Math.max(1, maxD.getTime() - minD.getTime())
  const pos = (d: string) => ((new Date(d + 'T00:00:00').getTime() - minD.getTime()) / totalMs) * 100
  const hoyPct = Math.max(0, Math.min(100, ((hoy.getTime() - minD.getTime()) / totalMs) * 100))
  const enRango = hoy >= minD && hoy <= maxD
  const meses: { label: string; left: number }[] = []
  const cur = new Date(minD.getFullYear(), minD.getMonth(), 1)
  while (cur <= maxD) { meses.push({ label: `${MESES[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`, left: Math.max(0, ((cur.getTime() - minD.getTime()) / totalMs) * 100) }); cur.setMonth(cur.getMonth() + 1) }
  const orden = [...camp].sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))
  return (
    <div style={CARDS.big}>
      <div style={{ ...lbl, marginBottom: 12 }}>Cronograma · color = plataforma · etiqueta = mecánica · línea = hoy</div>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'relative', height: 18, marginLeft: 210, marginBottom: 6 }}>
          {meses.map((m, i) => <span key={i} style={{ position: 'absolute', left: `${m.left}%`, fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: COLORS.mut }}>{m.label}</span>)}
        </div>
        {enRango && <div style={{ position: 'absolute', left: `calc(210px + ${hoyPct}% * (100% - 210px) / 100)`, top: 18, bottom: 0, width: 2, background: COLORS.redSL, opacity: 0.5, zIndex: 2, pointerEvents: 'none' }} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {orden.map(c => {
            const x1 = pos(c.fecha_inicio), x2 = c.fecha_fin ? pos(c.fecha_fin) : x1 + 4
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 200, flexShrink: 0, fontFamily: FONT.body, fontSize: 12, color: COLORS.sec, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ color: CANAL_TXT[c.canal] || CANAL_COLOR[c.canal], fontWeight: 600 }}>{c.marca || 'Multi'}</span> <span style={{ color: COLORS.mut }}>· {c.producto || c.tipo}</span>
                </div>
                <div style={{ flex: 1, position: 'relative', height: 24, background: COLORS.group, borderRadius: 6 }}>
                  <div style={{ position: 'absolute', left: `${x1}%`, width: `${Math.max(4, x2 - x1)}%`, top: 2, bottom: 2, background: CANAL_COLOR[c.canal] || COLORS.mut, borderRadius: 5, display: 'flex', alignItems: 'center', paddingLeft: 8, overflow: 'hidden', opacity: c.estado === 'pausada' ? 0.4 : 1 }} title={`${c.nombre} · ${fmtEur(Number(c.presupuesto))} · ${c.estado}`}>
                    <span style={{ fontFamily: FONT.heading, fontSize: 9, color: CANAL_TXT[c.canal] || '#fff', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{MECANICA_LABEL[c.mecanica_plataforma || ''] || c.tipo}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ═════════════ POR MARCA ═════════════ */
function TabMarcas({ porMarca, camp }: { porMarca: [string, any][]; camp: Campana[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 14 }}>
      {porMarca.map(([marca, v]) => {
        const cs = camp.filter(c => (c.marca || 'Multi') === marca)
        return (
          <div key={marca} style={CARDS.std}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 15, letterSpacing: '0.5px', color: COLORS.redSL, fontWeight: 600 }}>{marca}</div>
              <div style={{ fontFamily: FONT.heading, fontSize: 15, fontWeight: 600, color: COLORS.pri }}>{fmtEur(v.eur)}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {Array.from(v.canales).map((c: any) => <Pill key={c} text={CANAL_LABEL[c] || c} bg={CANAL_COLOR[c] || COLORS.mut} txt={CANAL_TXT[c]} />)}
              <span style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut }}>{v.n} campañas</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cs.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingBottom: 6, borderBottom: `1px solid ${COLORS.group}` }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.sec, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre.split('·').slice(1).join('·').trim() || c.nombre}</div>
                    <div style={{ fontFamily: FONT.body, fontSize: 10, color: COLORS.mut }}>{MECANICA_LABEL[c.mecanica_plataforma || ''] || c.tipo} · {c.fecha_inicio.slice(5)}→{c.fecha_fin ? c.fecha_fin.slice(5) : '—'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <Pill text={CANAL_LABEL[c.canal] || c.canal} bg={CANAL_COLOR[c.canal] || COLORS.mut} txt={CANAL_TXT[c.canal]} />
                    <span style={{ fontFamily: FONT.heading, fontSize: 12, color: COLORS.pri }}>{fmtEur(Number(c.presupuesto))}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ═════════════ POR CANAL ═════════════ */
function TabCanales({ porCanal, camp, totalPresupuesto }: { porCanal: Record<string, any>; camp: Campana[]; totalPresupuesto: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {Object.entries(porCanal).sort((a: any, b: any) => b[1].eur - a[1].eur).map(([canal, v]: any) => {
        const cs = camp.filter(c => c.canal === canal)
        const mecanicas = Array.from(new Set(cs.map(c => MECANICA_LABEL[c.mecanica_plataforma || ''] || c.tipo)))
        return (
          <div key={canal} style={{ ...CARDS.std, borderLeft: `3px solid ${CANAL_COLOR[canal] || COLORS.mut}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, letterSpacing: '0.5px', color: CANAL_TXT[canal] || CANAL_COLOR[canal] }}>{CANAL_LABEL[canal] || canal}</div>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut }}>Presupuesto <b style={{ color: COLORS.pri }}>{fmtEur(v.eur)}</b> ({Math.round(v.eur / totalPresupuesto * 100)}%)</span>
                <span style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut }}>Campañas <b style={{ color: COLORS.pri }}>{v.n}</b></span>
                <span style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut }}>Neto canal <b style={{ color: COLORS.ok }}>{Math.round((CANAL_NETO[canal] || 0) * 100)}%</b></span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {mecanicas.map(m => <Pill key={m} text={m} bg={COLORS.modal} />)}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {cs.map(c => (
                    <tr key={c.id}>
                      <td style={{ ...td, fontFamily: FONT.heading, fontSize: 12, color: COLORS.pri }}>{c.marca || 'Multi'}</td>
                      <td style={{ ...td, fontSize: 12, maxWidth: 320 }}>{c.objetivo_smart}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12 }}>{c.fecha_inicio.slice(5)}→{c.fecha_fin ? c.fecha_fin.slice(5) : '—'}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: FONT.heading, color: COLORS.pri }}>{fmtEur(Number(c.presupuesto))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ═════════════ DETALLE ═════════════ */
function TabDetalle({ camp, aggMet, onEstado }: { camp: Campana[]; aggMet: Record<number, any>; onEstado: (c: Campana, e: string) => void }) {
  const [fCanal, setFCanal] = useState('todos')
  const [fMarca, setFMarca] = useState('todas')
  const [fTipo, setFTipo] = useState('todos')
  const [q, setQ] = useState('')
  const [orden, setOrden] = useState<{ k: string; asc: boolean }>({ k: 'fecha_inicio', asc: true })

  const marcas = Array.from(new Set(camp.map(c => c.marca || 'Multi')))
  const canales = Array.from(new Set(camp.map(c => c.canal)))
  const tipos = Array.from(new Set(camp.map(c => c.tipo)))

  function realKpi(c: Campana): number {
    const a = aggMet[c.id]; if (!a) return 0
    if (c.kpi_principal.includes('nuevos')) return a.nuevos
    if (c.kpi_principal.includes('recurrentes') || c.kpi_principal.includes('pedidos')) return a.pedidos
    if (c.kpi_principal.includes('ticket')) return a.pedidos > 0 ? a.ventas / a.pedidos : 0
    return a.ventas
  }
  function progreso(c: Campana): number { return c.kpi_meta ? Math.round((realKpi(c) / Number(c.kpi_meta)) * 100) : 0 }
  function semColor(p: number) { return p >= 80 ? COLORS.ok : p >= 50 ? COLORS.warn : COLORS.err }

  let lista = camp.filter(c =>
    (fCanal === 'todos' || c.canal === fCanal) &&
    (fMarca === 'todas' || (c.marca || 'Multi') === fMarca) &&
    (fTipo === 'todos' || c.tipo === fTipo) &&
    (!q || c.nombre.toLowerCase().includes(q.toLowerCase()) || (c.objetivo_smart || '').toLowerCase().includes(q.toLowerCase()) || (c.codigo_promo || '').toLowerCase().includes(q.toLowerCase()))
  )
  lista = [...lista].sort((a: any, b: any) => {
    const av = a[orden.k], bv = b[orden.k]
    const r = (typeof av === 'number' && typeof bv === 'number') ? av - bv : String(av).localeCompare(String(bv))
    return orden.asc ? r : -r
  })
  function sort(k: string) { setOrden(o => o.k === k ? { k, asc: !o.asc } : { k, asc: true }) }
  const presupuestoFiltrado = lista.reduce((s, c) => s + Number(c.presupuesto || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={fCanal} onChange={e => setFCanal(e.target.value)} style={inp}><option value="todos">Todos los canales</option>{canales.map(c => <option key={c} value={c}>{CANAL_LABEL[c] || c}</option>)}</select>
        <select value={fMarca} onChange={e => setFMarca(e.target.value)} style={inp}><option value="todas">Todas las marcas</option>{marcas.map(m => <option key={m} value={m}>{m}</option>)}</select>
        <select value={fTipo} onChange={e => setFTipo(e.target.value)} style={inp}><option value="todos">Todos los objetivos</option>{tipos.map(t => <option key={t} value={t}>{TIPO_LABEL[t] || t}</option>)}</select>
        <input placeholder="Buscar..." value={q} onChange={e => setQ(e.target.value)} style={{ ...inp, flex: 1, minWidth: 160 }} />
        {(fCanal !== 'todos' || fMarca !== 'todas' || fTipo !== 'todos' || q) && <button onClick={() => { setFCanal('todos'); setFMarca('todas'); setFTipo('todos'); setQ('') }} style={btnGhost}>Limpiar</button>}
      </div>
      <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut }}>{lista.length} campañas · {fmtEur(presupuestoFiltrado)} de presupuesto</div>

      <div style={{ ...CARDS.std, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={th} onClick={() => sort('nombre')}>Campaña</th>
            <th style={th} onClick={() => sort('marca')}>Marca</th>
            <th style={th} onClick={() => sort('canal')}>Canal</th>
            <th style={th} onClick={() => sort('mecanica_plataforma')}>Mecánica</th>
            <th style={th} onClick={() => sort('fecha_inicio')}>Duración</th>
            <th style={{ ...th, textAlign: 'right' }} onClick={() => sort('presupuesto')}>Presup.</th>
            <th style={th}>Progreso</th>
            <th style={th} onClick={() => sort('estado')}>Estado</th>
            <th style={th}>Acción</th>
          </tr></thead>
          <tbody>
            {lista.map(c => {
              const a = aggMet[c.id]; const pct = progreso(c)
              return (
                <tr key={c.id}>
                  <td style={td}>
                    <div style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600, color: COLORS.pri }}>{c.nombre}</div>
                    <div style={{ fontSize: 11, color: COLORS.mut }}>{c.codigo_promo} · {c.objetivo_smart}</div>
                  </td>
                  <td style={td}>{c.marca || 'Multi'}</td>
                  <td style={td}><Pill text={CANAL_LABEL[c.canal] || c.canal} bg={CANAL_COLOR[c.canal] || COLORS.mut} txt={CANAL_TXT[c.canal]} /></td>
                  <td style={td}>{MECANICA_LABEL[c.mecanica_plataforma || ''] || '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{c.fecha_inicio.slice(5)} → {c.fecha_fin ? c.fecha_fin.slice(5) : '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: FONT.heading, color: COLORS.pri }}>{fmtEur(Number(c.presupuesto))}</td>
                  <td style={{ ...td, minWidth: 120 }}>
                    {a ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Bar pct={pct} color={semColor(pct)} h={6} /><span style={{ fontFamily: FONT.heading, fontSize: 12, color: semColor(pct) }}>{pct}%</span></div>
                      : <span style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut }}>sin métricas</span>}
                  </td>
                  <td style={td}><span style={{ color: ESTADO_COLOR[c.estado] || COLORS.mut, fontFamily: FONT.heading, fontSize: 11, textTransform: 'uppercase' }}>{c.estado}</span></td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {c.estado !== 'activa' && <button onClick={() => onEstado(c, 'activa')} style={{ ...btnGhost, borderColor: COLORS.ok, color: COLORS.ok }}>Activar</button>}
                      {c.estado === 'activa' && <button onClick={() => onEstado(c, 'pausada')} style={{ ...btnGhost, borderColor: COLORS.warn, color: COLORS.warn }}>Pausar</button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
