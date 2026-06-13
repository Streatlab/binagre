import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, CARDS, lbl, lblSm, kpiMid, TABS_PILL } from '@/components/panel/resumen/tokens'
import { fmtEur, fmtNumES } from '@/utils/format'

/* ═════════════ CRM STREAT LAB ═════════════
   Tokens y estilos canónicos Binagre (Panel Global / Evolución).
   Pestañas: Embudo (gráfico real, datos reales) · Campañas · Calendario · Públicos · Clientes
*/

type Cliente = { id: string; nombre: string | null; email: string | null; telefono: string | null; marca_preferida: string | null; canal_captacion: string; consentimiento_rgpd: boolean; fecha_alta: string; ultima_compra: string | null; num_pedidos: number; gasto_total: number; baja: boolean }
type Publico = { id: number; marca: string; publico_objetivo: string; propuesta_valor: string; momentos_consumo: string | null; mensajes_clave: string | null; ticket_medio_objetivo: number | null; plataforma_principal: string | null }
type Campana = { id: number; nombre: string; marca: string | null; producto: string | null; canal: string; tipo: string; mecanica_plataforma: string | null; objetivo_smart: string; kpi_principal: string; kpi_meta: number | null; codigo_promo: string | null; mecanica: string | null; fecha_inicio: string; fecha_fin: string | null; presupuesto: number; coste_real: number; estado: string; resultado_real: number | null; aprendizaje: string | null; veredicto: string | null }
type Metrica = { id: number; campana_id: number; fecha: string; pedidos: number; ventas: number; nuevos_clientes: number; canjes_codigo: number; coste: number }

const CANAL_LABEL: Record<string, string> = { uber_eats: 'Uber Eats', glovo: 'Glovo', just_eat: 'Just Eat', web: 'Web propia', qr_bolsa: 'QR Bolsa', email: 'Email', rrss: 'RRSS', directo: 'Directa', encuesta: 'Encuesta', ads_posicion: 'Uber Eats Ads' }
const CANAL_COLOR: Record<string, string> = { uber_eats: COLORS.uber, glovo: COLORS.glovo, just_eat: COLORS.je, web: COLORS.web, qr_bolsa: COLORS.directa, email: COLORS.modal, rrss: COLORS.lun }
const CANAL_TXT: Record<string, string> = { glovo: COLORS.glovoText }
const MECANICA_LABEL: Record<string, string> = { '2x1_bogo': '2x1 (BOGO)', descuento_item: '% descuento', pct_pedido: '% sobre pedido', nuevo_usuario: 'Oferta nuevo cliente', envio_gratis: 'Envío gratis', sellos: 'Tarjeta de sellos', ads_posicion: 'Ads / posición' }
const ESTADOS = ['borrador', 'activa', 'pausada', 'cerrada']
const ESTADO_COLOR: Record<string, string> = { borrador: COLORS.mut, activa: COLORS.ok, pausada: COLORS.warn, cerrada: COLORS.err }
const VEREDICTO_COLOR: Record<string, string> = { exito: COLORS.ok, parcial: COLORS.warn, fracaso: COLORS.err }

const TABS = [
  { id: 'embudo', label: 'Embudo' },
  { id: 'campanas', label: 'Campañas' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'publicos', label: 'Públicos' },
  { id: 'clientes', label: 'Clientes' },
] as const

export default function CrmTiendaPropia() {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('embudo')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [publicos, setPublicos] = useState<Publico[]>([])
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [metricas, setMetricas] = useState<Metrica[]>([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState('')

  async function cargar() {
    setCargando(true)
    const [c, p, ca, m] = await Promise.all([
      supabase.from('crm_clientes').select('*').eq('baja', false).order('fecha_alta', { ascending: false }),
      supabase.from('crm_publicos_marca').select('*').order('marca'),
      supabase.from('crm_campanas').select('*').order('fecha_inicio', { ascending: false }),
      supabase.from('crm_campanas_metricas').select('*'),
    ])
    setClientes((c.data as Cliente[]) || [])
    setPublicos((p.data as Publico[]) || [])
    setCampanas((ca.data as Campana[]) || [])
    setMetricas((m.data as Metrica[]) || [])
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])
  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', padding: '24px 28px', fontFamily: FONT.body, color: COLORS.pri }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: COLORS.redSL, letterSpacing: 3, textTransform: 'uppercase' }}>CRM STREAT LAB</div>
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut, marginTop: 2 }}>Embudo de captación · campañas reales por plataforma · clientes propios</div>
      </div>

      <div style={TABS_PILL.container}>
        {TABS.map(t2 => (
          <button key={t2.id} onClick={() => setTab(t2.id)} style={tab === t2.id ? TABS_PILL.active : TABS_PILL.inactive}>{t2.label}</button>
        ))}
      </div>

      {msg && <div style={{ ...CARDS.std, borderLeft: `3px solid ${COLORS.ok}`, margin: '12px 0', fontSize: 13, color: COLORS.pri }}>{msg}</div>}

      {cargando ? (
        <div style={{ color: COLORS.mut, fontSize: 14, padding: 24 }}>Cargando CRM...</div>
      ) : (
        <div style={{ marginTop: 14 }}>
          {tab === 'embudo' && <TabEmbudo />}
          {tab === 'campanas' && <TabCampanas campanas={campanas} metricas={metricas} onSaved={(t: string) => { cargar(); flash(t) }} />}
          {tab === 'calendario' && <TabCalendario campanas={campanas} metricas={metricas} />}
          {tab === 'publicos' && <TabPublicos publicos={publicos} onSaved={() => { cargar(); flash('Público actualizado') }} />}
          {tab === 'clientes' && <TabClientes clientes={clientes} onSaved={() => { cargar(); flash('Cliente guardado') }} />}
        </div>
      )}
    </div>
  )
}

/* ─────────── helpers UI canónicos ─────────── */
const inp: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: `0.5px solid ${COLORS.brd}`, background: COLORS.card, color: COLORS.pri, fontSize: 13, fontFamily: FONT.body, outline: 'none', width: '100%' }
const btnPri: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', background: COLORS.accent, color: '#fff', fontFamily: FONT.body, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnGhost: React.CSSProperties = { padding: '4px 10px', borderRadius: 6, border: `0.5px solid ${COLORS.brd}`, background: 'transparent', color: COLORS.sec, cursor: 'pointer', fontSize: 11, fontFamily: FONT.body }
const th: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLORS.mut, fontWeight: 500, padding: '8px 10px', textAlign: 'left', borderBottom: `1px solid ${COLORS.brd}` }
const td: React.CSSProperties = { fontFamily: FONT.body, fontSize: 13, color: COLORS.sec, padding: '8px 10px', borderBottom: `1px solid ${COLORS.group}` }
const lblXsLocal: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.mut }

function semColor(pct: number) { if (pct >= 80) return COLORS.ok; if (pct >= 50) return COLORS.warn; return COLORS.err }

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ ...CARDS.std, flex: 1, minWidth: 170 }}>
      <div style={lbl}>{label}</div>
      <div style={{ ...kpiMid, marginTop: 6, color: color ?? COLORS.pri }}>{value}</div>
      {sub && <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Pill({ text, bg, txt }: { text: string; bg: string; txt?: string }) {
  return <span style={{ fontSize: 10, fontFamily: FONT.heading, letterSpacing: '0.5px', padding: '2px 8px', borderRadius: 4, background: bg, color: txt ?? '#fff', textTransform: 'uppercase' }}>{text}</span>
}

/* ═════════════ TAB EMBUDO — gráfico real alimentado de pedidos reales ═════════════ */
const ETAPAS_EMBUDO = [
  { key: 'impresiones', label: 'Impresiones en app', color: '#484f66', sub: 'estimado' },
  { key: 'visitas', label: 'Visitas al menú', color: '#1E5BCC', sub: 'estimado' },
  { key: 'pedidos', label: 'Pedidos', color: '#B01D23', sub: 'dato real · facturación' },
  { key: 'recompra', label: 'Recompra (30d)', color: '#1D9E75', sub: 'estimado' },
] as const

const CANALES_EMBUDO = ['uber_eats', 'glovo', 'just_eat', 'web'] as const
type TasaCanal = { iv: number; vp: number; pr: number }

function TabEmbudo() {
  const [ped, setPed] = useState<Record<string, number>>({ uber_eats: 0, glovo: 0, just_eat: 0, web: 0 })
  const [tasas, setTasas] = useState<Record<string, TasaCanal>>({})
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(false)
  const [draft, setDraft] = useState<Record<string, TasaCanal>>({})

  async function cargar() {
    setCargando(true)
    const desde = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const [f, t] = await Promise.all([
      supabase.from('facturacion_diario').select('uber_pedidos,glovo_pedidos,je_pedidos,web_pedidos,directa_pedidos').gte('fecha', desde),
      supabase.from('crm_embudo_tasas').select('*'),
    ])
    const acc: Record<string, number> = { uber_eats: 0, glovo: 0, just_eat: 0, web: 0 }
    ;((f.data as any[]) || []).forEach(r => {
      acc.uber_eats += r.uber_pedidos || 0
      acc.glovo += r.glovo_pedidos || 0
      acc.just_eat += r.je_pedidos || 0
      acc.web += (r.web_pedidos || 0) + (r.directa_pedidos || 0)
    })
    setPed(acc)
    const tt: Record<string, TasaCanal> = {}
    ;((t.data as any[]) || []).forEach(x => { tt[x.canal] = { iv: Number(x.impresion_a_visita), vp: Number(x.visita_a_pedido), pr: Number(x.pedido_a_recompra) } })
    setTasas(tt)
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  function tasaDe(c: string): TasaCanal { return tasas[c] || { iv: 0.25, vp: 0.10, pr: 0.30 } }
  function etapasCanal(c: string) {
    const p = ped[c] || 0
    const t = tasaDe(c)
    const visitas = t.vp > 0 ? p / t.vp : 0
    const impresiones = t.iv > 0 ? visitas / t.iv : 0
    return { impresiones, visitas, pedidos: p, recompra: p * t.pr }
  }

  const agg = useMemo(() => {
    const a: Record<string, number> = { impresiones: 0, visitas: 0, pedidos: 0, recompra: 0 }
    CANALES_EMBUDO.forEach(c => { const e = etapasCanal(c); a.impresiones += e.impresiones; a.visitas += e.visitas; a.pedidos += e.pedidos; a.recompra += e.recompra })
    return a
  }, [ped, tasas])

  async function guardarTasas() {
    for (const c of CANALES_EMBUDO) {
      const d = draft[c]
      if (!d) continue
      await supabase.from('crm_embudo_tasas').upsert({ canal: c, impresion_a_visita: d.iv, visita_a_pedido: d.vp, pedido_a_recompra: d.pr }, { onConflict: 'canal' })
    }
    setEditando(false)
    cargar()
  }

  if (cargando) return <div style={{ color: COLORS.mut, fontSize: 14, padding: 24 }}>Cargando embudo...</div>

  const vals = ETAPAS_EMBUDO.map(e => agg[e.key])
  const maxVal = vals[0] || 1
  const sinPedidos = agg.pedidos === 0

  // Geometría embudo SVG (bandas de ancho proporcional al valor, con suelo visual)
  const W = 860, bandH = 76, gap = 6, maxW = 660
  const H = ETAPAS_EMBUDO.length * (bandH + gap)
  const anchoDe = (v: number) => (0.20 + 0.80 * (maxVal > 0 ? v / maxVal : 0)) * maxW

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut }}>
        Embudo de captación · últimos 30 días. La etapa <b style={{ color: COLORS.redSL }}>Pedidos</b> es dato real de tu facturación; las plataformas no ceden impresiones ni visitas por API, así que se estiman aplicando tasas de conversión del sector (editables). El recorrido cliente a cliente completo solo existe en canal propio.
      </div>

      {/* KPIs cabecera */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard label="Pedidos (30d)" value={fmtNumES(agg.pedidos)} sub="dato real" color={COLORS.redSL} />
        <KpiCard label="Visitas estimadas" value={fmtNumES(Math.round(agg.visitas))} sub={`conv. visita→pedido ${agg.visitas > 0 ? Math.round(agg.pedidos / agg.visitas * 100) : 0}%`} color={COLORS.lun} />
        <KpiCard label="Impresiones estimadas" value={fmtNumES(Math.round(agg.impresiones))} sub={`conv. total ${agg.impresiones > 0 ? (agg.pedidos / agg.impresiones * 100).toFixed(1) : 0}%`} color={COLORS.modal} />
        <KpiCard label="Recompra estimada (30d)" value={fmtNumES(Math.round(agg.recompra))} sub={`${agg.pedidos > 0 ? Math.round(agg.recompra / agg.pedidos * 100) : 0}% repite`} color={COLORS.ok} />
      </div>

      {/* GRÁFICO DE EMBUDO */}
      <div style={CARDS.big}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={lbl}>Embudo Streat Lab — del descubrimiento al pedido</div>
          <button onClick={() => { setDraft(Object.fromEntries(CANALES_EMBUDO.map(c => [c, tasaDe(c)]))); setEditando(e => !e) }} style={btnGhost}>{editando ? 'Cerrar' : 'Ajustar tasas'}</button>
        </div>

        {sinPedidos ? (
          <div style={{ padding: 30, textAlign: 'center', color: COLORS.mut, fontSize: 14 }}>Sin pedidos en los últimos 30 días.</div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
              {ETAPAS_EMBUDO.map((et, i) => {
                const v = vals[i]
                const wTop = anchoDe(v)
                const wBot = i < ETAPAS_EMBUDO.length - 1 ? anchoDe(vals[i + 1]) : wTop * 0.82
                const y = i * (bandH + gap)
                const cx = W / 2
                const pts = `${cx - wTop / 2},${y} ${cx + wTop / 2},${y} ${cx + wBot / 2},${y + bandH} ${cx - wBot / 2},${y + bandH}`
                const conv = i > 0 && vals[i - 1] > 0 ? Math.round(v / vals[i - 1] * 100) : null
                return (
                  <g key={et.key}>
                    <polygon points={pts} fill={et.color} opacity={0.94} />
                    <text x={cx} y={y + bandH / 2 - 8} textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize={15} fontWeight={600} fill="#fff" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>{et.label}</text>
                    <text x={cx} y={y + bandH / 2 + 14} textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize={22} fontWeight={600} fill="#fff">{fmtNumES(Math.round(v))}</text>
                    <text x={cx} y={y + bandH / 2 + 30} textAnchor="middle" fontFamily="Lexend, sans-serif" fontSize={10} fill="rgba(255,255,255,0.75)">{et.sub}</text>
                    {conv !== null && (
                      <text x={W - 8} y={y - gap / 2 + 2} textAnchor="end" fontFamily="Oswald, sans-serif" fontSize={13} fontWeight={600} fill={COLORS.sec}>▼ {conv}%</text>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>
        )}

        {editando && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.group}` }}>
            <div style={{ ...lblSm, marginBottom: 10 }}>Tasas de conversión por canal (estimación del sector)</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Canal</th><th style={th}>Impresión → Visita</th><th style={th}>Visita → Pedido</th><th style={th}>Pedido → Recompra</th></tr></thead>
                <tbody>
                  {CANALES_EMBUDO.map(c => {
                    const d = draft[c] || tasaDe(c)
                    const upd = (k: keyof TasaCanal, val: string) => setDraft(p => ({ ...p, [c]: { ...d, [k]: Number(val) } }))
                    return (
                      <tr key={c}>
                        <td style={{ ...td, color: CANAL_TXT[c] || CANAL_COLOR[c], fontWeight: 600 }}>{CANAL_LABEL[c]}</td>
                        <td style={td}><input type="number" step="0.01" value={d.iv} onChange={e => upd('iv', e.target.value)} style={{ ...inp, width: 90 }} /></td>
                        <td style={td}><input type="number" step="0.01" value={d.vp} onChange={e => upd('vp', e.target.value)} style={{ ...inp, width: 90 }} /></td>
                        <td style={td}><input type="number" step="0.01" value={d.pr} onChange={e => upd('pr', e.target.value)} style={{ ...inp, width: 90 }} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12 }}><button onClick={guardarTasas} style={btnPri}>Guardar tasas</button></div>
          </div>
        )}
      </div>

      {/* DESGLOSE POR CANAL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14 }}>
        {CANALES_EMBUDO.map(c => {
          const e = etapasCanal(c)
          const orden = [e.impresiones, e.visitas, e.pedidos, e.recompra]
          const mx = orden[0] || 1
          const convTotal = e.impresiones > 0 ? (e.pedidos / e.impresiones * 100) : 0
          return (
            <div key={c} style={{ ...CARDS.std, opacity: e.pedidos > 0 ? 1 : 0.55 }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: CANAL_TXT[c] || CANAL_COLOR[c], marginBottom: 10 }}>{CANAL_LABEL[c]}</div>
              {ETAPAS_EMBUDO.map((et, i) => (
                <div key={et.key} style={{ marginBottom: 7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT.body, fontSize: 11, color: COLORS.sec, marginBottom: 2 }}>
                    <span>{et.label}</span><span style={{ fontWeight: 600, color: COLORS.pri }}>{fmtNumES(Math.round(orden[i]))}</span>
                  </div>
                  <div style={{ height: 7, background: COLORS.group, borderRadius: 4 }}>
                    <div style={{ height: 7, width: `${Math.max(2, (orden[i] / mx) * 100)}%`, background: et.color, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
              <div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, marginTop: 8 }}>
                {e.pedidos > 0 ? `Conversión total: ${convTotal.toFixed(1)}%` : 'Sin pedidos en 30 días'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═════════════ TAB CAMPAÑAS ═════════════ */
function TabCampanas({ campanas, metricas, onSaved }: { campanas: Campana[]; metricas: Metrica[]; onSaved: (t: string) => void }) {
  const [regId, setRegId] = useState<number | null>(null)
  const [reg, setReg] = useState({ fecha: new Date().toISOString().slice(0, 10), pedidos: '', ventas: '', nuevos_clientes: '', canjes_codigo: '', coste: '' })
  const [cierreId, setCierreId] = useState<number | null>(null)
  const [cierre, setCierre] = useState({ resultado_real: '', veredicto: 'exito', aprendizaje: '' })
  const [filtroEstado, setFiltroEstado] = useState('todas')

  const agg = useMemo(() => {
    const m: Record<number, { pedidos: number; ventas: number; nuevos: number; canjes: number; coste: number }> = {}
    for (const x of metricas) {
      if (!m[x.campana_id]) m[x.campana_id] = { pedidos: 0, ventas: 0, nuevos: 0, canjes: 0, coste: 0 }
      m[x.campana_id].pedidos += x.pedidos || 0
      m[x.campana_id].ventas += Number(x.ventas) || 0
      m[x.campana_id].nuevos += x.nuevos_clientes || 0
      m[x.campana_id].canjes += x.canjes_codigo || 0
      m[x.campana_id].coste += Number(x.coste) || 0
    }
    return m
  }, [metricas])

  function realKpi(c: Campana): number {
    const a = agg[c.id]; if (!a) return 0
    if (c.kpi_principal.includes('nuevos')) return a.nuevos
    if (c.kpi_principal.includes('recurrentes')) return a.pedidos
    if (c.kpi_principal.includes('ticket')) return a.pedidos > 0 ? a.ventas / a.pedidos : 0
    if (c.kpi_principal.includes('pedidos')) return a.pedidos
    return a.ventas
  }
  function progreso(c: Campana): number {
    if (!c.kpi_meta) return 0
    return Math.round((realKpi(c) / Number(c.kpi_meta)) * 100)
  }

  async function cambiarEstado(c: Campana, estado: string) { await supabase.from('crm_campanas').update({ estado }).eq('id', c.id); onSaved(`Campaña ${estado}`) }
  async function guardarMetrica() {
    if (!regId) return
    await supabase.from('crm_campanas_metricas').upsert({ campana_id: regId, fecha: reg.fecha, pedidos: Number(reg.pedidos) || 0, ventas: Number(reg.ventas) || 0, nuevos_clientes: Number(reg.nuevos_clientes) || 0, canjes_codigo: Number(reg.canjes_codigo) || 0, coste: Number(reg.coste) || 0 }, { onConflict: 'campana_id,fecha' })
    setRegId(null); setReg({ fecha: new Date().toISOString().slice(0, 10), pedidos: '', ventas: '', nuevos_clientes: '', canjes_codigo: '', coste: '' }); onSaved('Métricas registradas')
  }
  async function guardarCierre() {
    if (!cierreId) return
    await supabase.from('crm_campanas').update({ estado: 'cerrada', resultado_real: Number(cierre.resultado_real) || null, veredicto: cierre.veredicto, aprendizaje: cierre.aprendizaje || null }).eq('id', cierreId)
    setCierreId(null); setCierre({ resultado_real: '', veredicto: 'exito', aprendizaje: '' }); onSaved('Campaña cerrada')
  }

  const lista = campanas.filter(c => filtroEstado === 'todas' || c.estado === filtroEstado)
  const activas = campanas.filter(c => c.estado === 'activa').length
  const ventasTot = Object.values(agg).reduce((s, a) => s + a.ventas, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard label="Campañas" value={String(campanas.length)} sub={`${activas} activas`} />
        <KpiCard label="En cartera" value={String(campanas.filter(c => c.estado === 'borrador').length)} sub="listas para lanzar" color={COLORS.mut} />
        <KpiCard label="Ventas atribuidas" value={fmtEur(ventasTot)} color={COLORS.ok} />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['todas', ...ESTADOS].map(e => (
          <button key={e} onClick={() => setFiltroEstado(e)} style={filtroEstado === e ? { ...btnGhost, border: `0.5px solid ${COLORS.accent}`, color: COLORS.accent, fontWeight: 600 } : btnGhost}>{e}</button>
        ))}
      </div>

      {lista.map(c => {
        const a = agg[c.id]
        const pct = progreso(c)
        const roi = a && a.coste > 0 ? Math.round(((a.ventas - a.coste) / a.coste) * 100) : null
        return (
          <div key={c.id} style={CARDS.std}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, color: COLORS.pri }}>{c.nombre}</span>
                  <Pill text={CANAL_LABEL[c.canal] || c.canal} bg={CANAL_COLOR[c.canal] || COLORS.mut} txt={CANAL_TXT[c.canal]} />
                  <span style={{ fontSize: 10, fontFamily: FONT.heading, letterSpacing: '0.5px', padding: '2px 8px', borderRadius: 4, border: `1px solid ${ESTADO_COLOR[c.estado]}`, color: ESTADO_COLOR[c.estado], textTransform: 'uppercase' }}>{c.estado}</span>
                  {c.mecanica_plataforma && <Pill text={MECANICA_LABEL[c.mecanica_plataforma] || c.mecanica_plataforma} bg={COLORS.modal} />}
                </div>
                {c.marca && <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.sec, marginBottom: 2 }}>Marca: <b>{c.marca}</b>{c.producto ? ` · ${c.producto}` : ''}</div>}
                <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.sec, marginBottom: 4 }}>{c.objetivo_smart}</div>
                <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 4 }}>
                  {c.fecha_inicio}{c.fecha_fin ? ` → ${c.fecha_fin}` : ''} · Presupuesto {fmtEur(Number(c.presupuesto))}{c.codigo_promo ? ` · Código ${c.codigo_promo}` : ''}
                </div>
                {c.veredicto && (
                  <div style={{ marginTop: 8, padding: '8px 10px', background: (VEREDICTO_COLOR[c.veredicto] || COLORS.mut) + '11', borderRadius: 8, borderLeft: `3px solid ${VEREDICTO_COLOR[c.veredicto] || COLORS.mut}` }}>
                    <span style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: VEREDICTO_COLOR[c.veredicto] }}>{c.veredicto}</span>
                    {c.resultado_real != null && <span style={{ fontSize: 12, color: COLORS.sec }}> · Resultado: {fmtNumES(c.resultado_real)}</span>}
                    {c.aprendizaje && <div style={{ fontSize: 12, color: COLORS.sec, marginTop: 2 }}>📌 {c.aprendizaje}</div>}
                  </div>
                )}
              </div>
              <div style={{ minWidth: 230 }}>
                <div style={lblSm}>KPI: {c.kpi_principal} · Meta {fmtNumES(c.kpi_meta ?? 0)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <div style={{ flex: 1, height: 6, background: COLORS.group, borderRadius: 3 }}>
                    <div style={{ height: 6, width: `${Math.min(pct, 100)}%`, background: semColor(pct), borderRadius: 3, transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ fontFamily: FONT.heading, fontSize: 15, fontWeight: 600, color: semColor(pct) }}>{pct}%</span>
                </div>
                {a && <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.sec, marginTop: 6 }}>{a.pedidos} pedidos · {fmtEur(a.ventas)} · {a.nuevos} nuevos{a.canjes ? ` · ${a.canjes} canjes` : ''}{roi !== null ? ` · ROI ${roi}%` : ''}</div>}
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {ESTADOS.filter(e => e !== c.estado && e !== 'cerrada').map(e => (
                    <button key={e} onClick={() => cambiarEstado(c, e)} style={btnGhost}>{e}</button>
                  ))}
                  <button onClick={() => setRegId(regId === c.id ? null : c.id)} style={{ ...btnGhost, border: `0.5px solid ${COLORS.accent}`, color: COLORS.accent, fontWeight: 600 }}>+ métricas</button>
                  {c.estado !== 'cerrada' && <button onClick={() => setCierreId(cierreId === c.id ? null : c.id)} style={{ ...btnGhost, border: `0.5px solid ${COLORS.redSL}`, color: COLORS.redSL, fontWeight: 600 }}>cerrar + aprender</button>}
                </div>
              </div>
            </div>

            {regId === c.id && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.group}`, alignItems: 'center' }}>
                <input type="date" value={reg.fecha} onChange={e => setReg({ ...reg, fecha: e.target.value })} style={inp} />
                <input type="number" placeholder="Pedidos" value={reg.pedidos} onChange={e => setReg({ ...reg, pedidos: e.target.value })} style={inp} />
                <input type="number" placeholder="Ventas €" value={reg.ventas} onChange={e => setReg({ ...reg, ventas: e.target.value })} style={inp} />
                <input type="number" placeholder="Nuevos" value={reg.nuevos_clientes} onChange={e => setReg({ ...reg, nuevos_clientes: e.target.value })} style={inp} />
                <input type="number" placeholder="Canjes" value={reg.canjes_codigo} onChange={e => setReg({ ...reg, canjes_codigo: e.target.value })} style={inp} />
                <input type="number" placeholder="Coste €" value={reg.coste} onChange={e => setReg({ ...reg, coste: e.target.value })} style={inp} />
                <button onClick={guardarMetrica} style={btnPri}>Guardar</button>
              </div>
            )}

            {cierreId === c.id && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.group}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
                  <input type="number" placeholder={`Resultado real (${c.kpi_principal})`} value={cierre.resultado_real} onChange={e => setCierre({ ...cierre, resultado_real: e.target.value })} style={inp} />
                  <select value={cierre.veredicto} onChange={e => setCierre({ ...cierre, veredicto: e.target.value })} style={inp}>
                    <option value="exito">Éxito (repetir)</option>
                    <option value="parcial">Parcial (ajustar)</option>
                    <option value="fracaso">Fracaso (no repetir)</option>
                  </select>
                </div>
                <textarea placeholder="¿Qué aprendimos? ¿Qué repetir o cambiar?" value={cierre.aprendizaje} onChange={e => setCierre({ ...cierre, aprendizaje: e.target.value })} style={{ ...inp, minHeight: 52 }} />
                <div><button onClick={guardarCierre} style={btnPri}>Cerrar campaña</button></div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ═════════════ TAB CALENDARIO ═════════════ */
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
function TabCalendario({ campanas, metricas }: { campanas: Campana[]; metricas: Metrica[] }) {
  const aggVentas = useMemo(() => {
    const m: Record<number, number> = {}
    for (const x of metricas) m[x.campana_id] = (m[x.campana_id] || 0) + (Number(x.ventas) || 0)
    return m
  }, [metricas])

  const fechas = campanas.flatMap(c => [c.fecha_inicio, c.fecha_fin].filter(Boolean) as string[])
  if (fechas.length === 0) return <div style={{ ...CARDS.std, color: COLORS.mut }}>Sin campañas programadas.</div>
  const min = fechas.reduce((a, b) => (a < b ? a : b))
  const max = fechas.reduce((a, b) => (a > b ? a : b))
  const minD = new Date(min + 'T00:00:00'), maxD = new Date(max + 'T00:00:00')
  const totalMs = Math.max(1, maxD.getTime() - minD.getTime())
  const pos = (d: string) => ((new Date(d + 'T00:00:00').getTime() - minD.getTime()) / totalMs) * 100

  const meses: { label: string; left: number }[] = []
  const cur = new Date(minD.getFullYear(), minD.getMonth(), 1)
  while (cur <= maxD) {
    meses.push({ label: `${MESES[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`, left: Math.max(0, ((cur.getTime() - minD.getTime()) / totalMs) * 100) })
    cur.setMonth(cur.getMonth() + 1)
  }
  const ordenadas = [...campanas].sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut }}>Cada barra es una campaña con su duración real. Color = plataforma. Etiqueta = mecánica.</div>

      <div style={CARDS.big}>
        <div style={{ ...lbl, marginBottom: 12 }}>Cronograma de campañas</div>
        <div style={{ position: 'relative', height: 18, marginLeft: 210, marginBottom: 6 }}>
          {meses.map((m, i) => (
            <span key={i} style={{ position: 'absolute', left: `${m.left}%`, fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: COLORS.mut }}>{m.label}</span>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {ordenadas.map(c => {
            const x1 = pos(c.fecha_inicio), x2 = c.fecha_fin ? pos(c.fecha_fin) : x1 + 5
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 200, flexShrink: 0, fontFamily: FONT.body, fontSize: 12, color: COLORS.sec, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ color: CANAL_TXT[c.canal] || CANAL_COLOR[c.canal], fontWeight: 600 }}>{c.marca || 'Multi'}</span> <span style={{ color: COLORS.mut }}>· {c.producto || c.tipo}</span>
                </div>
                <div style={{ flex: 1, position: 'relative', height: 24, background: COLORS.group, borderRadius: 6 }}>
                  <div style={{ position: 'absolute', left: `${x1}%`, width: `${Math.max(4, x2 - x1)}%`, top: 2, bottom: 2, background: CANAL_COLOR[c.canal] || COLORS.mut, borderRadius: 5, display: 'flex', alignItems: 'center', paddingLeft: 8, overflow: 'hidden' }}>
                    <span style={{ fontFamily: FONT.heading, fontSize: 9, color: CANAL_TXT[c.canal] || '#fff', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{MECANICA_LABEL[c.mecanica_plataforma || ''] || c.tipo}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={CARDS.std}>
        <div style={{ ...lbl, marginBottom: 12 }}>Plan de campañas — objetivo, duración y resultado</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Marca</th><th style={th}>Plataforma</th><th style={th}>Mecánica</th><th style={th}>Objetivo</th><th style={th}>Duración</th><th style={th}>Estado</th><th style={{ ...th, textAlign: 'right' }}>Ventas</th><th style={th}>Veredicto</th>
            </tr></thead>
            <tbody>
              {ordenadas.map(c => (
                <tr key={c.id}>
                  <td style={td}>{c.marca || 'Multi'}{c.producto ? <div style={{ fontSize: 11, color: COLORS.mut }}>{c.producto}</div> : null}</td>
                  <td style={td}><Pill text={CANAL_LABEL[c.canal] || c.canal} bg={CANAL_COLOR[c.canal] || COLORS.mut} txt={CANAL_TXT[c.canal]} /></td>
                  <td style={td}>{MECANICA_LABEL[c.mecanica_plataforma || ''] || '—'}</td>
                  <td style={{ ...td, maxWidth: 300, fontSize: 12 }}>{c.objetivo_smart}</td>
                  <td style={td}>{c.fecha_inicio.slice(5)} → {c.fecha_fin ? c.fecha_fin.slice(5) : '—'}</td>
                  <td style={td}><span style={{ color: ESTADO_COLOR[c.estado], fontFamily: FONT.heading, fontSize: 11, textTransform: 'uppercase' }}>{c.estado}</span></td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: FONT.heading, color: COLORS.pri }}>{fmtEur(aggVentas[c.id] || 0)}</td>
                  <td style={td}>{c.veredicto ? <span style={{ color: VEREDICTO_COLOR[c.veredicto], fontFamily: FONT.heading, fontSize: 11, textTransform: 'uppercase' }}>{c.veredicto}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ═════════════ TAB PÚBLICOS ═════════════ */
function TabPublicos({ publicos, onSaved }: { publicos: Publico[]; onSaved: () => void }) {
  const [editId, setEditId] = useState<number | null>(null)
  const [ed, setEd] = useState<any>({})
  async function guardar() {
    await supabase.from('crm_publicos_marca').update({ publico_objetivo: ed.publico_objetivo, propuesta_valor: ed.propuesta_valor, momentos_consumo: ed.momentos_consumo, mensajes_clave: ed.mensajes_clave, ticket_medio_objetivo: ed.ticket_medio_objetivo ? Number(ed.ticket_medio_objetivo) : null }).eq('id', editId)
    setEditId(null); onSaved()
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 14 }}>
      {publicos.map(p => (
        <div key={p.id} style={CARDS.std}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 15, letterSpacing: '1px', textTransform: 'uppercase', color: COLORS.redSL, fontWeight: 600 }}>{p.marca}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {p.plataforma_principal && <Pill text={CANAL_LABEL[p.plataforma_principal] || p.plataforma_principal} bg={CANAL_COLOR[p.plataforma_principal] || COLORS.mut} txt={CANAL_TXT[p.plataforma_principal]} />}
              <button onClick={() => { setEditId(p.id); setEd({ ...p }) }} style={btnGhost}>Editar</button>
            </div>
          </div>
          {editId === p.id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea value={ed.publico_objetivo} onChange={e => setEd({ ...ed, publico_objetivo: e.target.value })} style={{ ...inp, minHeight: 60 }} />
              <textarea value={ed.propuesta_valor} onChange={e => setEd({ ...ed, propuesta_valor: e.target.value })} style={{ ...inp, minHeight: 44 }} />
              <input value={ed.momentos_consumo || ''} onChange={e => setEd({ ...ed, momentos_consumo: e.target.value })} style={inp} placeholder="Momentos de consumo" />
              <input value={ed.mensajes_clave || ''} onChange={e => setEd({ ...ed, mensajes_clave: e.target.value })} style={inp} placeholder="Mensajes clave" />
              <input type="number" value={ed.ticket_medio_objetivo || ''} onChange={e => setEd({ ...ed, ticket_medio_objetivo: e.target.value })} style={inp} placeholder="Ticket medio objetivo €" />
              <div style={{ display: 'flex', gap: 8 }}><button onClick={guardar} style={btnPri}>Guardar</button><button onClick={() => setEditId(null)} style={btnGhost}>Cancelar</button></div>
            </div>
          ) : (
            <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.sec, display: 'flex', flexDirection: 'column', gap: 7, lineHeight: 1.45 }}>
              <div><span style={lblXsLocal}>Público</span><br />{p.publico_objetivo}</div>
              <div><span style={lblXsLocal}>Propuesta</span><br />{p.propuesta_valor}</div>
              {p.momentos_consumo && <div><span style={lblXsLocal}>Momentos</span><br />{p.momentos_consumo}</div>}
              {p.mensajes_clave && <div><span style={lblXsLocal}>Mensajes</span><br />{p.mensajes_clave}</div>}
              {p.ticket_medio_objetivo != null && <div><span style={lblXsLocal}>Ticket objetivo</span><br />{fmtEur(Number(p.ticket_medio_objetivo))}</div>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ═════════════ TAB CLIENTES ═════════════ */
function TabClientes({ clientes, onSaved }: { clientes: Cliente[]; onSaved: () => void }) {
  const [f, setF] = useState({ nombre: '', email: '', telefono: '', marca_preferida: '', canal_captacion: 'qr_bolsa', consentimiento_rgpd: false })
  const [filtro, setFiltro] = useState('')
  const conRgpd = clientes.filter(c => c.consentimiento_rgpd).length
  const gastoTotal = clientes.reduce((s, c) => s + (Number(c.gasto_total) || 0), 0)
  const pedidosTotal = clientes.reduce((s, c) => s + (c.num_pedidos || 0), 0)
  const ticketMedio = pedidosTotal > 0 ? gastoTotal / pedidosTotal : 0
  const repetidores = clientes.filter(c => c.num_pedidos >= 2).length
  const lista = clientes.filter(c => !filtro || (c.nombre || '').toLowerCase().includes(filtro.toLowerCase()) || (c.email || '').toLowerCase().includes(filtro.toLowerCase()))

  async function guardar() {
    if (!f.email && !f.telefono) return
    await supabase.from('crm_clientes').insert({ ...f, marca_preferida: f.marca_preferida || null, fecha_consentimiento: f.consentimiento_rgpd ? new Date().toISOString() : null })
    setF({ nombre: '', email: '', telefono: '', marca_preferida: '', canal_captacion: 'qr_bolsa', consentimiento_rgpd: false }); onSaved()
  }
  async function borrar(id: string) { await supabase.from('crm_clientes').update({ baja: true }).eq('id', id); onSaved() }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard label="Clientes propios" value={String(clientes.length)} sub={`${conRgpd} con RGPD`} />
        <KpiCard label="Repetidores" value={String(repetidores)} sub={clientes.length ? `${Math.round(repetidores / clientes.length * 100)}% de la base` : '—'} />
        <KpiCard label="Gasto acumulado" value={fmtEur(gastoTotal)} sub={`${pedidosTotal} pedidos`} />
        <KpiCard label="Ticket medio" value={fmtEur(ticketMedio)} sub="canal propio" />
      </div>

      <div style={CARDS.std}>
        <div style={{ ...lblSm, marginBottom: 12 }}>Alta de cliente</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, alignItems: 'center' }}>
          <input placeholder="Nombre" value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} style={inp} />
          <input placeholder="Email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} style={inp} />
          <input placeholder="Teléfono" value={f.telefono} onChange={e => setF({ ...f, telefono: e.target.value })} style={inp} />
          <input placeholder="Marca preferida" value={f.marca_preferida} onChange={e => setF({ ...f, marca_preferida: e.target.value })} style={inp} />
          <select value={f.canal_captacion} onChange={e => setF({ ...f, canal_captacion: e.target.value })} style={inp}>
            {['qr_bolsa', 'web', 'directo', 'encuesta', 'rrss'].map(c => <option key={c} value={c}>{CANAL_LABEL[c] || c}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT.body, fontSize: 13, color: COLORS.sec, cursor: 'pointer' }}>
            <input type="checkbox" checked={f.consentimiento_rgpd} onChange={e => setF({ ...f, consentimiento_rgpd: e.target.checked })} style={{ accentColor: COLORS.accent }} /> RGPD
          </label>
          <button onClick={guardar} style={btnPri}>Guardar</button>
        </div>
      </div>

      <div style={CARDS.std}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
          <div style={lblSm}>Base de clientes</div>
          <input placeholder="Buscar..." value={filtro} onChange={e => setFiltro(e.target.value)} style={{ ...inp, width: 220 }} />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Cliente</th><th style={th}>Contacto</th><th style={th}>Marca</th><th style={th}>Captación</th><th style={th}>RGPD</th><th style={{ ...th, textAlign: 'right' }}>Pedidos</th><th style={{ ...th, textAlign: 'right' }}>Gasto</th><th style={th}>Última</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {lista.length === 0 && <tr><td colSpan={9} style={{ ...td, color: COLORS.mut }}>Sin clientes todavía. Primera fuente: QR en bolsa → registro web.</td></tr>}
              {lista.map(c => (
                <tr key={c.id}>
                  <td style={td}>{c.nombre || '—'}</td>
                  <td style={td}>{c.email || c.telefono || '—'}</td>
                  <td style={td}>{c.marca_preferida || '—'}</td>
                  <td style={td}>{CANAL_LABEL[c.canal_captacion] || c.canal_captacion}</td>
                  <td style={td}>{c.consentimiento_rgpd ? '✅' : '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{c.num_pedidos}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtEur(Number(c.gasto_total))}</td>
                  <td style={td}>{c.ultima_compra || '—'}</td>
                  <td style={td}><button onClick={() => borrar(c.id)} style={{ background: 'none', border: 'none', color: COLORS.mut, cursor: 'pointer', fontSize: 12 }}>Baja</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
