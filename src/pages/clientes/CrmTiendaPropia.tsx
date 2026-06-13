import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, CARDS, lbl, lblSm, kpiMid, TABS_PILL } from '@/components/panel/resumen/tokens'
import { fmtEur, fmtNumES } from '@/utils/format'

/* ═════════════ CRM STREAT LAB ═════════════
   Tokens y estilos canónicos Binagre (Panel Global).
   Pestañas: Embudo (gráfico real) · Campañas · Calendario · Públicos · Clientes
*/

type Cliente = { id: string; nombre: string | null; email: string | null; telefono: string | null; marca_preferida: string | null; canal_captacion: string; consentimiento_rgpd: boolean; fecha_alta: string; ultima_compra: string | null; num_pedidos: number; gasto_total: number; baja: boolean }
type Publico = { id: number; marca: string; publico_objetivo: string; propuesta_valor: string; momentos_consumo: string | null; mensajes_clave: string | null; ticket_medio_objetivo: number | null; plataforma_principal: string | null }
type Campana = { id: number; nombre: string; marca: string | null; producto: string | null; canal: string; tipo: string; mecanica_plataforma: string | null; objetivo_smart: string; kpi_principal: string; kpi_meta: number | null; codigo_promo: string | null; mecanica: string | null; fecha_inicio: string; fecha_fin: string | null; presupuesto: number; coste_real: number; estado: string; resultado_real: number | null; aprendizaje: string | null; veredicto: string | null }
type Metrica = { id: number; campana_id: number; fecha: string; pedidos: number; ventas: number; nuevos_clientes: number; canjes_codigo: number; coste: number }
type EmbudoEvento = { id: number; fecha: string; canal: string; marca: string | null; etapa: string; valor: number }

const CANAL_LABEL: Record<string, string> = { uber_eats: 'Uber Eats', glovo: 'Glovo', just_eat: 'Just Eat', web: 'Web', qr_bolsa: 'QR Bolsa', email: 'Email', rrss: 'RRSS', directo: 'Directa', encuesta: 'Encuesta', UE: 'Uber Eats', GL: 'Glovo', JE: 'Just Eat' }
const CANAL_COLOR: Record<string, string> = { uber_eats: COLORS.uber, glovo: COLORS.glovo, just_eat: COLORS.je, web: COLORS.web, qr_bolsa: COLORS.directa, email: COLORS.modal, rrss: COLORS.lun, UE: COLORS.uber, GL: COLORS.glovo, JE: COLORS.je }
const CANAL_TXT: Record<string, string> = { glovo: COLORS.glovoText, GL: COLORS.glovoText }
const MECANICA_LABEL: Record<string, string> = { '2x1_bogo': '2x1 (BOGO)', descuento_item: '% dto. producto', pct_pedido: '% dto. pedido', nuevo_usuario: 'Oferta nuevo usuario', envio_gratis: 'Envío gratis', sellos: 'Tarjeta de sellos' }
const ETAPAS = ['exposicion', 'descubrimiento', 'consideracion', 'conversion', 'relacion', 'retencion'] as const
const ETAPA_LABEL: Record<string, string> = { exposicion: 'Exposición', descubrimiento: 'Descubrimiento', consideracion: 'Consideración', conversion: 'Conversión', relacion: 'Relación', retencion: 'Retención' }
const ETAPA_COLOR: Record<string, string> = { exposicion: '#B01D23', descubrimiento: '#f5a623', consideracion: '#1E5BCC', conversion: '#F26B1F', relacion: '#7B4FA8', retencion: '#1D9E75' }
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
  const [embudo, setEmbudo] = useState<EmbudoEvento[]>([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState('')

  async function cargar() {
    setCargando(true)
    const [c, p, ca, m, e] = await Promise.all([
      supabase.from('crm_clientes').select('*').eq('baja', false).order('fecha_alta', { ascending: false }),
      supabase.from('crm_publicos_marca').select('*').order('marca'),
      supabase.from('crm_campanas').select('*').order('fecha_inicio', { ascending: false }),
      supabase.from('crm_campanas_metricas').select('*'),
      supabase.from('crm_embudo_eventos').select('*').order('fecha', { ascending: false }).limit(3000),
    ])
    setClientes((c.data as Cliente[]) || [])
    setPublicos((p.data as Publico[]) || [])
    setCampanas((ca.data as Campana[]) || [])
    setMetricas((m.data as Metrica[]) || [])
    setEmbudo((e.data as EmbudoEvento[]) || [])
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])
  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', padding: '24px 28px', fontFamily: FONT.body, color: COLORS.pri }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: COLORS.redSL, letterSpacing: 3, textTransform: 'uppercase' }}>CRM STREAT LAB</div>
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut, marginTop: 2 }}>Clientes propios · Campañas medibles · Embudo por canal · Marcas reales por plataforma</div>
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
          {tab === 'embudo' && <TabEmbudo embudo={embudo} onSaved={() => { cargar(); flash('Embudo actualizado') }} />}
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

/* ═════════════ TAB EMBUDO (gráfico SVG real) ═════════════ */
function TabEmbudo({ embudo, onSaved }: { embudo: EmbudoEvento[]; onSaved: () => void }) {
  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const [f, setF] = useState({ fecha: new Date().toISOString().slice(0, 10), canal: 'todos', etapa: 'exposicion', valor: '' })

  const totals = useMemo(() => {
    const t: Record<string, number> = {}
    ETAPAS.forEach(e => (t[e] = 0))
    embudo.forEach(ev => { if (ev.fecha >= hace30 && t[ev.etapa] !== undefined) t[ev.etapa] += Number(ev.valor) || 0 })
    return t
  }, [embudo])

  const maxV = Math.max(...ETAPAS.map(e => totals[e]), 1)
  const hayDatos = ETAPAS.some(e => totals[e] > 0)

  const W = 720, segH = 64, gap = 8, topW = 560, botW = 150
  const H = ETAPAS.length * (segH + gap)
  function trap(i: number) {
    const t = ETAPAS.length - 1
    const w1 = topW - (topW - botW) * (i / (t + 1))
    const w2 = topW - (topW - botW) * ((i + 1) / (t + 1))
    const cx = W / 2, y = i * (segH + gap)
    const x1a = cx - w1 / 2, x1b = cx + w1 / 2
    const x2a = cx - w2 / 2, x2b = cx + w2 / 2
    return { points: `${x1a},${y} ${x1b},${y} ${x2b},${y + segH} ${x2a},${y + segH}`, y, cy: y + segH / 2 }
  }

  async function guardar() {
    if (!f.valor) return
    const canales = f.canal === 'todos' ? ['uber_eats', 'glovo', 'just_eat', 'web'] : [f.canal]
    const val = Number(f.valor) / canales.length
    for (const c of canales) {
      await supabase.from('crm_embudo_eventos').upsert({ fecha: f.fecha, canal: c, marca: null, etapa: f.etapa, valor: val, fuente: 'manual' }, { onConflict: 'fecha,canal,marca,etapa' })
    }
    setF({ ...f, valor: '' })
    onSaved()
  }

  function conv(i: number): number | null {
    if (i === 0) return null
    const prev = totals[ETAPAS[i - 1]], cur = totals[ETAPAS[i]]
    return prev > 0 ? Math.round((cur / prev) * 100) : null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut }}>
        Embudo de marketing agregado · últimos 30 días. Las plataformas (Uber Eats, Glovo, Just Eat) sólo ceden datos agregados de sus paneles (no identidad del cliente); el embudo cliente a cliente sólo existe en canal propio.
      </div>

      <div style={CARDS.big}>
        <div style={{ ...lbl, marginBottom: 16 }}>Embudo Streat Lab — Exposición → Retención</div>
        {!hayDatos ? (
          <div style={{ padding: 30, textAlign: 'center', color: COLORS.mut, fontSize: 14 }}>
            Sin datos todavía. Registra abajo las cifras de cada etapa (visitas de menú, pedidos, etc.) desde los paneles de plataforma.
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 720, height: 'auto' }}>
              {ETAPAS.map((et, i) => {
                const g = trap(i)
                const val = totals[et]
                const cnv = conv(i)
                const pctBar = Math.round((val / maxV) * 100)
                return (
                  <g key={et}>
                    <polygon points={g.points} fill={ETAPA_COLOR[et]} opacity={0.92} />
                    <text x={W / 2} y={g.cy - 6} textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize={17} fontWeight={600} fill="#fff" style={{ textTransform: 'uppercase' as const, letterSpacing: '1px' }}>{ETAPA_LABEL[et]}</text>
                    <text x={W / 2} y={g.cy + 14} textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize={15} fontWeight={600} fill="#fff">{fmtNumES(val)}</text>
                    {cnv !== null && (
                      <text x={W - 6} y={g.y - gap / 2} textAnchor="end" fontFamily="Lexend, sans-serif" fontSize={11} fill={COLORS.mut}>▼ {cnv}%</text>
                    )}
                    <text x={6} y={g.cy + 4} fontFamily="Lexend, sans-serif" fontSize={10} fill={COLORS.mut}>{pctBar}%</text>
                  </g>
                )
              })}
            </svg>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
        {(['uber_eats', 'glovo', 'just_eat', 'web'] as const).map(c => {
          const porEtapa: Record<string, number> = {}
          ETAPAS.forEach(e => (porEtapa[e] = 0))
          embudo.forEach(ev => { if (ev.fecha >= hace30 && ev.canal === c && porEtapa[ev.etapa] !== undefined) porEtapa[ev.etapa] += Number(ev.valor) || 0 })
          const mx = Math.max(...ETAPAS.map(e => porEtapa[e]), 1)
          const expo = porEtapa.exposicion, conver = porEtapa.conversion
          const tasa = expo > 0 ? Math.round((conver / expo) * 100) : null
          return (
            <div key={c} style={CARDS.std}>
              <div style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: CANAL_TXT[c] || CANAL_COLOR[c], marginBottom: 10 }}>{CANAL_LABEL[c]}</div>
              {ETAPAS.map((et, i) => (
                <div key={et} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT.body, fontSize: 11, color: COLORS.sec, marginBottom: 2 }}>
                    <span>{ETAPA_LABEL[et]}</span><span style={{ fontWeight: 600, color: COLORS.pri }}>{fmtNumES(porEtapa[et])}</span>
                  </div>
                  <div style={{ height: 6, background: COLORS.group, borderRadius: 3 }}>
                    <div style={{ height: 6, width: `${(porEtapa[et] / mx) * 100}%`, background: ETAPA_COLOR[et], borderRadius: 3, opacity: 1 - i * 0.1 }} />
                  </div>
                </div>
              ))}
              <div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, marginTop: 8 }}>
                {tasa !== null ? `Conversión exposición→pedido: ${tasa}%` : 'Sin datos de exposición'}
              </div>
            </div>
          )
        })}
      </div>

      <div style={CARDS.std}>
        <div style={{ ...lblSm, marginBottom: 12 }}>Registrar dato de embudo (desde los paneles de plataforma)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, alignItems: 'center' }}>
          <input type="date" value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} style={inp} />
          <select value={f.canal} onChange={e => setF({ ...f, canal: e.target.value })} style={inp}>
            <option value="todos">Todos los canales</option>
            <option value="uber_eats">Uber Eats</option>
            <option value="glovo">Glovo</option>
            <option value="just_eat">Just Eat</option>
            <option value="web">Web</option>
          </select>
          <select value={f.etapa} onChange={e => setF({ ...f, etapa: e.target.value })} style={inp}>
            {ETAPAS.map(e => <option key={e} value={e}>{ETAPA_LABEL[e]}</option>)}
          </select>
          <input type="number" placeholder="Valor" value={f.valor} onChange={e => setF({ ...f, valor: e.target.value })} style={inp} />
          <button onClick={guardar} style={btnPri}>Guardar</button>
        </div>
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

  async function cambiarEstado(c: Campana, estado: string) {
    await supabase.from('crm_campanas').update({ estado }).eq('id', c.id)
    onSaved(`Campaña ${estado}`)
  }
  async function guardarMetrica() {
    if (!regId) return
    await supabase.from('crm_campanas_metricas').upsert({ campana_id: regId, fecha: reg.fecha, pedidos: Number(reg.pedidos) || 0, ventas: Number(reg.ventas) || 0, nuevos_clientes: Number(reg.nuevos_clientes) || 0, canjes_codigo: Number(reg.canjes_codigo) || 0, coste: Number(reg.coste) || 0 }, { onConflict: 'campana_id,fecha' })
    setRegId(null); setReg({ fecha: new Date().toISOString().slice(0, 10), pedidos: '', ventas: '', nuevos_clientes: '', canjes_codigo: '', coste: '' })
    onSaved('Métricas registradas')
  }
  async function guardarCierre() {
    if (!cierreId) return
    await supabase.from('crm_campanas').update({ estado: 'cerrada', resultado_real: Number(cierre.resultado_real) || null, veredicto: cierre.veredicto, aprendizaje: cierre.aprendizaje || null }).eq('id', cierreId)
    setCierreId(null); setCierre({ resultado_real: '', veredicto: 'exito', aprendizaje: '' })
    onSaved('Campaña cerrada con aprendizaje')
  }

  const activas = campanas.filter(c => c.estado === 'activa').length
  const totalPresup = campanas.reduce((s, c) => s + Number(c.presupuesto || 0), 0)
  const ventasTot = Object.values(agg).reduce((s, a) => s + a.ventas, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard label="Campañas" value={String(campanas.length)} sub={`${activas} activas`} />
        <KpiCard label="Presupuesto total" value={fmtEur(totalPresup)} />
        <KpiCard label="Ventas atribuidas" value={fmtEur(ventasTot)} color={COLORS.ok} />
      </div>

      {campanas.map(c => {
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
                {c.mecanica && <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut }}>Mecánica: {c.mecanica}</div>}
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
                <div style={{ ...lblSm }}>KPI: {c.kpi_principal} · Meta {fmtNumES(c.kpi_meta ?? 0)}</div>
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
                <textarea placeholder="¿Qué aprendimos? ¿Qué repetir o cambiar la próxima vez?" value={cierre.aprendizaje} onChange={e => setCierre({ ...cierre, aprendizaje: e.target.value })} style={{ ...inp, minHeight: 52 }} />
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
function TabCalendario({ campanas, metricas }: { campanas: Campana[]; metricas: Metrica[] }) {
  const aggVentas = useMemo(() => {
    const m: Record<number, number> = {}
    for (const x of metricas) m[x.campana_id] = (m[x.campana_id] || 0) + (Number(x.ventas) || 0)
    return m
  }, [metricas])

  const fechas = campanas.flatMap(c => [c.fecha_inicio, c.fecha_fin].filter(Boolean) as string[])
  if (fechas.length === 0) return <div style={{ color: COLORS.mut, padding: 24 }}>Sin campañas programadas.</div>
  const min = fechas.reduce((a, b) => (a < b ? a : b))
  const max = fechas.reduce((a, b) => (a > b ? a : b))
  const minD = new Date(min + 'T00:00:00'), maxD = new Date(max + 'T00:00:00')
  const totalDays = Math.max(1, Math.round((maxD.getTime() - minD.getTime()) / 86400000))

  function pos(d: string) { return Math.round(((new Date(d + 'T00:00:00').getTime() - minD.getTime()) / 86400000 / totalDays) * 100) }
  const ordenadas = [...campanas].sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut }}>
        Calendario de campañas por marca, producto y plataforma. Cada barra es una campaña con su duración real. Color = plataforma.
      </div>

      <div style={CARDS.big}>
        <div style={{ ...lbl, marginBottom: 6 }}>Cronograma de campañas</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, marginBottom: 12 }}>
          <span>{min}</span><span>{max}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ordenadas.map(c => {
            const x1 = pos(c.fecha_inicio), x2 = c.fecha_fin ? pos(c.fecha_fin) : x1 + 4
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 200, flexShrink: 0, fontFamily: FONT.body, fontSize: 12, color: COLORS.sec, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.marca || 'Multi'} · <span style={{ color: COLORS.mut }}>{c.nombre}</span>
                </div>
                <div style={{ flex: 1, position: 'relative', height: 22, background: COLORS.group, borderRadius: 6 }}>
                  <div style={{ position: 'absolute', left: `${x1}%`, width: `${Math.max(3, x2 - x1)}%`, top: 2, bottom: 2, background: CANAL_COLOR[c.canal] || COLORS.mut, borderRadius: 5, display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
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
                  <td style={{ ...td, maxWidth: 280 }}>{c.objetivo_smart}</td>
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
const lblXsLocal: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.mut }

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
