import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * PLAYBOOK AGENCIA DELIVERY — Módulo MKT (clientes) · v3
 * Vistas:
 *  1) Cuadro de mando: KPIs REALES (v_mkt_playbook_kpis, comisión real de config_canales) + semáforos automáticos
 *     contra objetivos del plan, tendencia mensual (v_mkt_playbook_tendencia) y mix por canal.
 *  2) Ingeniería de menú: matriz popularidad×ingreso real de los platos (v_mkt_playbook_platos) — Fase 2 viva.
 *  3) Plan 6 meses: checklist por fases con estado + nota persistidos; KPI de salida autoevaluado con dato real.
 *  4) Estrategia: 10 agencias desde BD (mkt_benchmark_competidores, categoria='agencia_delivery').
 * Datos 100% reales o degradación elegante. Tokens SL: #B01D23 #1e2233 #e8f442 #484f66
 */

const RED = '#B01D23', DARK = '#1e2233', LIME = '#e8f442', GREY = '#484f66', GREEN = '#16a34a', AMBER = '#f59e0b'
const eur = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

type Estado = 'ACTIVO' | 'EN_CURSO' | 'HECHO'
const ESTADOS: Estado[] = ['ACTIVO', 'EN_CURSO', 'HECHO']
const COLOR_ESTADO: Record<Estado, string> = { ACTIVO: '#9aa0b4', EN_CURSO: AMBER, HECHO: GREEN }

type Kpis = { bruto_total: number; pedidos_total: number; directo_bruto: number; uber_bruto: number; glovo_bruto: number; je_bruto: number; pct_directo: number; ticket_medio: number; comision_estimada: number; crm_clientes: number; club_socios: number; resenas: number }
type Tend = { mes: string; bruto: number; directo: number; pct_directo: number; ticket_medio: number }
type Plato = { plato: string; unidades: number; ingresos: number; precio_medio: number }
type Agencia = { id: number; nombre: string; web: string; que_venden: string; como_lo_venden: string; por_que_funciona: string; su_debilidad: string; nuestro_atajo: string; facturacion: string; amenaza: number; facilidad_copiar: number; orden: number }

type Paso = { id: string; quien: 'Claude' | 'Rubén'; texto: string }
type Fase = { id: string; titulo: string; robado: string; kpi: string; meta?: { tipo: 'directo' | 'ticket' | 'crm' | 'resenas'; valor: number }; pasos: Paso[] }

const FASES: Fase[] = [
  { id: 'f1', titulo: 'FASE 1 · MES 1 — Montar la agencia', robado: 'Think Paladar, Comunikoo', kpi: 'Línea base + fotos + rituales activos.', pasos: [
    { id: 'f1p1', quien: 'Claude', texto: 'Auditoría de las 3 plataformas marca a marca: posición, fotos, descripciones, tiempos, valoraciones, comisión efectiva real.' },
    { id: 'f1p2', quien: 'Claude', texto: 'Línea base ERP: ticket medio, repetición, margen por plato/canal, horas valle por marca.' },
    { id: 'f1p3', quien: 'Claude', texto: 'Auditoría de fugas nº1: € en comisiones y promos últimos 3 meses → presupuesto para canal propio.' },
    { id: 'f1p4', quien: 'Claude', texto: 'Montar panel de agencia en Notion: rituales, calendario Q3, plantilla de informe mensual.' },
    { id: 'f1p5', quien: 'Rubén', texto: 'Optimizar fichas de Google Business de las marcas (Claude redacta textos; tú las subes, 1 h).' },
    { id: 'f1p6', quien: 'Rubén', texto: 'Sesión de fotos profesional de los 10 platos top (400–800 €). BLOQUEANTE. Uber Eats la regala en plan Standard/Premium.' },
  ] },
  { id: 'f2', titulo: 'FASE 2 · MES 2 — Ingeniería de menú y pricing', robado: 'pleez, Think Paladar, Peckwater', kpi: 'Ticket plataformas +5% · ROI medido por promo · cartas reescritas.', meta: { tipo: 'ticket', valor: 27 }, pasos: [
    { id: 'f2p1', quien: 'Claude', texto: 'Matriz popularidad×margen de la carta (pestaña Ingeniería de menú). Subir 5–8% estrellas, matar platos perro.' },
    { id: 'f2p2', quien: 'Claude', texto: 'Reescribir listings estilo Peckwater: nombres apetitosos, descripciones que venden, combos cerrados arriba.' },
    { id: 'f2p3', quien: 'Claude', texto: 'Definir 3 reglas de promo estilo pleez (solo valle, nunca permanentes, presupuesto cerrado) + ROI a 2 semanas.' },
    { id: 'f2p4', quien: 'Claude', texto: 'Primer radar de competencia quincenal de Vallecas.' },
    { id: 'f2p5', quien: 'Rubén', texto: 'Aplicar cambios en paneles Glovo/Uber/Just Eat con el guion exacto (o en sesión conjunta).' },
  ] },
  { id: 'f3', titulo: 'FASE 3 · MES 3 — Lanzar el canal directo', robado: 'Delitbee, Cheerfy, Deliverect', kpi: 'Web viva · 100 pedidos directos · coste/pedido < comisión media.', meta: { tipo: 'directo', valor: 8 }, pasos: [
    { id: 'f3p1', quien: 'Claude', texto: 'Construir y desplegar binagre.com: carta sincronizada con ERP, Stripe, Uber Direct API, recogida con descuento.' },
    { id: 'f3p2', quien: 'Claude', texto: 'Precios web 5–10% bajo plataformas (sin 25–30% comisión sigue siendo más rentable por pedido).' },
    { id: 'f3p3', quien: 'Claude', texto: 'Medir conversión carrito→compra contra benchmark Delitbee (60%) y optimizar checkout.' },
    { id: 'f3p4', quien: 'Claude', texto: 'SEO local: 4 guías "comida casera a domicilio Vallecas/Madrid" + enlace de pedido en ficha Google.' },
    { id: 'f3p5', quien: 'Rubén', texto: 'Crear el repo de la web (bloqueante, 10 min con guía) y validar en tu móvil antes del go-live.' },
  ] },
  { id: 'f4', titulo: 'FASE 4 · MES 4 — Captura y trasvase', robado: 'Comunikoo, Cheerfy', kpi: 'Base ≥400 clientes · ≥30% pedidos web captados · +50 reseñas.', meta: { tipo: 'crm', valor: 400 }, pasos: [
    { id: 'f4p1', quien: 'Claude', texto: 'CRM en ERP: cliente, contacto, frecuencia, plato favorito, canal. Diseño del flyer QR del packaging.' },
    { id: 'f4p2', quien: 'Claude', texto: 'Automatización: WhatsApp/email bienvenida + recordatorio a 10–14 días sin pedido, segmentado.' },
    { id: 'f4p3', quien: 'Claude', texto: 'Encuesta post-pedido: 5★ → Google review; <4★ → alerta para recuperar cliente.' },
    { id: 'f4p4', quien: 'Rubén', texto: 'Imprimir flyers (60–100 €) y meterlos en TODOS los pedidos de plataforma. Disciplina de cocina.' },
  ] },
  { id: 'f5', titulo: 'FASE 5 · MES 5 — Fidelización por hábito', robado: 'Cheerfy, Taster, Binagre', kpi: 'Repetición 30 días +25% · ≥20 suscripciones · pico influencer.', pasos: [
    { id: 'f5p1', quien: 'Claude', texto: 'Programa de puntos en web: 5 pedidos → 6º ejecutivo gratis (premio en producto, no descuento).' },
    { id: 'f5p2', quien: 'Claude', texto: 'Suscripción semanal Ofi L-V y Meal Prep con cobro recurrente Stripe: ingreso predecible.' },
    { id: 'f5p3', quien: 'Claude', texto: 'Campañas segmentadas: viernes familia, lunes meal prep, según CRM.' },
    { id: 'f5p4', quien: 'Rubén', texto: 'Cerrar 2–3 microinfluencers food de Madrid (Claude prepara lista, mensaje y trato).' },
  ] },
  { id: 'f6', titulo: 'FASE 6 · MES 6 — Escalar y decidir con números', robado: 'Peckwater, Think Paladar', kpi: 'Canal directo ≥20% · ticket +12% · playbook documentado.', meta: { tipo: 'directo', valor: 20 }, pasos: [
    { id: 'f6p1', quien: 'Claude', texto: 'P&L por marca virtual. Marca que no rinde tras 8 semanas optimizada → rediseñar o matar.' },
    { id: 'f6p2', quien: 'Claude', texto: 'Replicar playbook (fases 2–5) en la 2ª marca con mejor margen.' },
    { id: 'f6p3', quien: 'Claude', texto: 'Informe semestral: canal directo %, ticket, repetición, ahorro en comisiones, comparativa vs agencia.' },
    { id: 'f6p4', quien: 'Rubén', texto: 'Decisión con Emilio: doblar en canal directo, lanzar/matar marcas, contratar pieza externa puntual.' },
  ] },
]
const TODOS = FASES.flatMap(f => f.pasos)

const RITUALES = [
  ['Pulso semanal', 'Lunes (15 min)', 'Ventas por marca/canal, ticket, pedidos, ROI de promos, alertas. 10 líneas + decisión.', 'Claude prepara · Rubén decide'],
  ['Radar competencia', 'Quincenal', 'Cartas, precios y promos de competidores de Vallecas. Cambios → propuesta de respuesta.', 'Claude'],
  ['Comité de carta', 'Mensual (30 min)', 'Matriz popularidad×margen. Subir/reposicionar/combo/eliminar. Máx 3 cambios/mes/marca.', 'Claude propone · Rubén+Emilio'],
  ['Informe mensual', 'Último viernes', 'Resultados vs objetivos, qué se hizo, plan del mes. Acta en Notion.', 'Claude redacta · Reunión'],
  ['Auditoría de fugas', 'Trimestral', 'Comisiones + promos vs margen directo → presupuesto para canal propio.', 'Claude'],
  ['Calendario comercial', 'Trimestral', 'Picos del trimestre con producto especial y pedido anticipado en web.', 'Claude propone · Rubén valida'],
]

const OBJ_DIRECTO = 20

function Semaforo({ ok, casi }: { ok: boolean; casi?: boolean }) {
  const c = ok ? GREEN : casi ? AMBER : RED
  return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: c, marginRight: 6 }} />
}

function KpiCard({ titulo, valor, sub, color = DARK, barra }: { titulo: string; valor: string; sub?: string; color?: string; barra?: { pct: number; obj: number } }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e3e6ee', borderRadius: 14, padding: 16, flex: '1 1 180px', minWidth: 180 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: 0.3 }}>{titulo}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, marginTop: 4 }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, color: GREY, marginTop: 2 }}>{sub}</div>}
      {barra && (
        <div style={{ marginTop: 8 }}>
          <div style={{ height: 8, background: '#eef0f5', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, (barra.pct / barra.obj) * 100)}%`, height: '100%', background: barra.pct >= barra.obj ? GREEN : LIME }} />
          </div>
          <div style={{ fontSize: 11, color: GREY, marginTop: 3 }}>Objetivo {barra.obj}%</div>
        </div>
      )}
    </div>
  )
}

// Sparkline SVG simple
function Spark({ data, color = RED, w = 320, h = 70, fmt = (n: number) => String(n) }: { data: { x: string; y: number }[]; color?: string; w?: number; h?: number; fmt?: (n: number) => string }) {
  if (!data.length) return null
  const ys = data.map(d => d.y); const max = Math.max(...ys, 1); const min = Math.min(...ys, 0)
  const rng = max - min || 1; const step = w / Math.max(1, data.length - 1)
  const pts = data.map((d, i) => `${i * step},${h - ((d.y - min) / rng) * (h - 12) - 6}`).join(' ')
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h + 18}`} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={i * step} cy={h - ((d.y - min) / rng) * (h - 12) - 6} r={3} fill={color} />
          <text x={i * step} y={h + 14} fontSize="9" fill={GREY} textAnchor="middle">{d.x.slice(5)}</text>
        </g>
      ))}
    </svg>
  )
}

export default function PlaybookAgencia() {
  const [tab, setTab] = useState<'mando' | 'menu' | 'plan' | 'estrategia'>('mando')
  const [estados, setEstados] = useState<Record<string, { estado: Estado; nota?: string }>>({})
  const [persistente, setPersistente] = useState(true)
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [tend, setTend] = useState<Tend[]>([])
  const [platos, setPlatos] = useState<Plato[]>([])
  const [agencias, setAgencias] = useState<Agencia[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    ;(async () => {
      try { const { data } = await supabase.from('v_mkt_playbook_kpis').select('*').single(); if (activo && data) setKpis(data as any) } catch {}
      try { const { data } = await supabase.from('v_mkt_playbook_tendencia').select('*'); if (activo && data) setTend(data as any) } catch {}
      try { const { data } = await supabase.from('v_mkt_playbook_platos').select('*'); if (activo && data) setPlatos(data as any) } catch {}
      try { const { data } = await supabase.from('mkt_benchmark_competidores').select('*').eq('categoria', 'agencia_delivery').order('orden'); if (activo && data?.length) setAgencias(data as any) } catch {}
      try {
        const { data, error } = await supabase.from('mkt_playbook_estado').select('id, estado, nota'); if (error) throw error
        const map: Record<string, { estado: Estado; nota?: string }> = {}
        ;(data || []).forEach((r: any) => { map[r.id] = { estado: r.estado, nota: r.nota } })
        if (activo) setEstados(map)
      } catch { setPersistente(false) }
      if (activo) setCargando(false)
    })()
    return () => { activo = false }
  }, [])

  async function setEstado(id: string, estado: Estado) {
    setEstados(prev => ({ ...prev, [id]: { ...prev[id], estado } }))
    if (persistente) try { await supabase.from('mkt_playbook_estado').upsert({ id, estado, nota: estados[id]?.nota ?? null, updated_at: new Date().toISOString() }) } catch {}
  }
  async function setNota(id: string, nota: string) {
    setEstados(prev => ({ ...prev, [id]: { estado: prev[id]?.estado ?? 'ACTIVO', nota } }))
    if (persistente) try { await supabase.from('mkt_playbook_estado').upsert({ id, estado: estados[id]?.estado ?? 'ACTIVO', nota, updated_at: new Date().toISOString() }) } catch {}
  }

  const prog = useMemo(() => { const h = TODOS.filter(p => estados[p.id]?.estado === 'HECHO').length; return { h, t: TODOS.length, pct: Math.round((h / TODOS.length) * 100) } }, [estados])

  // Autoevaluación de KPI de fase con dato real
  function evalMeta(meta?: Fase['meta']): { ok: boolean; casi: boolean; txt: string } | null {
    if (!meta || !kpis) return null
    let actual = 0, obj = meta.valor
    if (meta.tipo === 'directo') actual = kpis.pct_directo
    if (meta.tipo === 'ticket') actual = kpis.ticket_medio
    if (meta.tipo === 'crm') actual = kpis.crm_clientes
    if (meta.tipo === 'resenas') actual = kpis.resenas
    const ok = actual >= obj; const casi = actual >= obj * 0.7
    const u = meta.tipo === 'directo' ? '%' : meta.tipo === 'ticket' ? '€' : ''
    return { ok, casi, txt: `Real: ${actual}${u} / objetivo ${obj}${u}` }
  }

  const k = kpis
  const mixMax = k ? Math.max(k.uber_bruto, k.glovo_bruto, k.je_bruto, k.directo_bruto, 1) : 1
  const platosMax = platos.length ? Math.max(...platos.map(p => p.ingresos)) : 1

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ color: GREY, fontSize: 13, fontWeight: 600 }}>MKT · CLIENTES</div>
      <h1 style={{ margin: 0, color: DARK, fontSize: 28, fontWeight: 800 }}>Playbook Agencia Delivery</h1>
      <p style={{ color: GREY, fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>El know-how de las 10 empresas líderes de food delivery, ejecutado con Claude y medido contra los datos reales del ERP.</p>

      <div style={{ display: 'flex', gap: 8, margin: '18px 0 22px', flexWrap: 'wrap' }}>
        {([['mando', 'Cuadro de mando'], ['menu', 'Ingeniería de menú'], ['plan', 'Plan 6 meses'], ['estrategia', 'Estrategia · 10 agencias']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, background: tab === key ? DARK : '#eef0f5', color: tab === key ? '#fff' : GREY }}>{label}</button>
        ))}
      </div>

      {/* CUADRO DE MANDO */}
      {tab === 'mando' && (!k ? <div style={{ color: GREY }}>Cargando datos del ERP…</div> : (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <KpiCard titulo="% Canal directo" valor={`${k.pct_directo}%`} sub={`${eur(k.directo_bruto)} de ${eur(k.bruto_total)}`} color={RED} barra={{ pct: k.pct_directo, obj: OBJ_DIRECTO }} />
            <KpiCard titulo="Ticket medio" valor={eur(k.ticket_medio)} sub={`${k.pedidos_total} pedidos`} />
            <KpiCard titulo="Comisiones pagadas" valor={eur(k.comision_estimada)} sub="% real de config_canales" color={RED} />
            <KpiCard titulo="Presupuesto canal propio" valor={eur(k.comision_estimada)} sub="= lo que regalas a plataformas" color={GREEN} />
          </div>

          <h3 style={{ color: DARK, marginTop: 24, fontSize: 16 }}>Tendencia mensual</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px', background: '#fff', border: '1px solid #e3e6ee', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: GREY }}>BRUTO €/MES</div>
              <Spark data={tend.map(t => ({ x: t.mes, y: t.bruto }))} color={RED} />
            </div>
            <div style={{ flex: '1 1 300px', background: '#fff', border: '1px solid #e3e6ee', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: GREY }}>TICKET MEDIO €/MES</div>
              <Spark data={tend.map(t => ({ x: t.mes, y: t.ticket_medio }))} color={DARK} />
            </div>
          </div>

          <h3 style={{ color: DARK, marginTop: 20, fontSize: 16 }}>Mix por canal (bruto real)</h3>
          <div style={{ background: '#fff', border: '1px solid #e3e6ee', borderRadius: 14, padding: 16 }}>
            {[['Uber Eats', k.uber_bruto, '#000'], ['Glovo', k.glovo_bruto, '#f7c600'], ['Just Eat', k.je_bruto, '#fb5a3c'], ['Directo (web)', k.directo_bruto, GREEN]].map(([n, v, c]: any) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0' }}>
                <div style={{ width: 90, fontSize: 12.5, fontWeight: 700, color: DARK }}>{n}</div>
                <div style={{ flex: 1, height: 18, background: '#eef0f5', borderRadius: 6, overflow: 'hidden' }}><div style={{ width: `${(v / mixMax) * 100}%`, height: '100%', background: c }} /></div>
                <div style={{ width: 90, textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: DARK }}>{eur(v)}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
            <KpiCard titulo="Clientes en CRM" valor={String(k.crm_clientes)} sub="Objetivo fase 4: ≥400" />
            <KpiCard titulo="Socios del club" valor={String(k.club_socios)} />
            <KpiCard titulo="Reseñas registradas" valor={String(k.resenas)} sub="Objetivo fase 4: +50" />
            <KpiCard titulo="Progreso del plan" valor={`${prog.pct}%`} sub={`${prog.h}/${prog.t} pasos`} color={RED} />
          </div>

          <div style={{ background: LIME, borderRadius: 12, padding: 16, marginTop: 18, fontSize: 13.5, color: DARK, fontWeight: 600, lineHeight: 1.5 }}>
            Lectura: canal directo {k.pct_directo}%. En 2026 has dejado {eur(k.comision_estimada)} en comisiones de plataforma (con tus % reales). Ese importe es el presupuesto que justifica empujar el canal propio. Norte: directo ≥{OBJ_DIRECTO}%.
          </div>
        </>
      ))}

      {/* INGENIERÍA DE MENÚ */}
      {tab === 'menu' && (
        <>
          <p style={{ color: GREY, fontSize: 13.5, lineHeight: 1.5 }}>Matriz popularidad×ingreso de tus platos (datos reales del ERP). Esto es la Fase 2 ejecutándose: las <b>estrellas</b> (mucha venta, buen ingreso) son candidatas a subir precio 5–8%; los de cola, a reformular o matar.</p>
          {platos.length === 0 ? <div style={{ color: GREY }}>Sin datos de ventas por plato.</div> : (
            <div style={{ background: '#fff', border: '1px solid #e3e6ee', borderRadius: 14, padding: 16 }}>
              {platos.map((p, i) => (
                <div key={p.plato} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: i ? '1px solid #f0f1f5' : 'none' }}>
                  <div style={{ width: 22, fontSize: 12, fontWeight: 800, color: i < 3 ? RED : GREY }}>{i + 1}</div>
                  <div style={{ width: 220, fontSize: 12.5, fontWeight: 700, color: DARK }}>{p.plato}</div>
                  <div style={{ flex: 1, height: 16, background: '#eef0f5', borderRadius: 6, overflow: 'hidden' }}><div style={{ width: `${(p.ingresos / platosMax) * 100}%`, height: '100%', background: i < 3 ? RED : DARK }} /></div>
                  <div style={{ width: 80, textAlign: 'right', fontSize: 12, fontWeight: 700, color: DARK }}>{eur(p.ingresos)}</div>
                  <div style={{ width: 95, textAlign: 'right', fontSize: 11.5, color: GREY }}>{p.unidades} ud · {eur(p.precio_medio)}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ background: LIME, borderRadius: 12, padding: 14, marginTop: 14, fontSize: 13, color: DARK, fontWeight: 600 }}>
            Acción de Claude: con esta matriz preparo la propuesta de subida de precio de las 3 estrellas y la lista de platos a reformular para la próxima carta.
          </div>
        </>
      )}

      {/* PLAN */}
      {tab === 'plan' && (
        <>
          <div style={{ background: '#fff', border: '1px solid #e3e6ee', borderRadius: 14, padding: 18, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 800, color: DARK, fontSize: 16 }}>Progreso global</div>
              <div style={{ fontWeight: 800, color: RED, fontSize: 22 }}>{prog.pct}%</div>
            </div>
            <div style={{ height: 12, background: '#eef0f5', borderRadius: 8, marginTop: 10, overflow: 'hidden' }}><div style={{ width: `${prog.pct}%`, height: '100%', background: LIME }} /></div>
            <div style={{ color: GREY, fontSize: 12, marginTop: 8 }}>{prog.h} de {prog.t} pasos hechos{!persistente && ' · (modo memoria)'}</div>
          </div>

          {cargando ? <div style={{ color: GREY }}>Cargando…</div> : FASES.map(f => {
            const h = f.pasos.filter(p => estados[p.id]?.estado === 'HECHO').length
            const ev = evalMeta(f.meta)
            return (
              <div key={f.id} style={{ background: '#fff', border: '1px solid #e3e6ee', borderRadius: 14, padding: 18, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, color: DARK, fontSize: 16, fontWeight: 800 }}>{f.titulo}</h3>
                  <span style={{ fontSize: 12, color: GREY }}>{h}/{f.pasos.length}</span>
                </div>
                <div style={{ fontSize: 12, fontStyle: 'italic', color: GREY, margin: '4px 0 12px' }}>Robado de: {f.robado}</div>
                {f.pasos.map(p => {
                  const reg = estados[p.id]; const est = reg?.estado || 'ACTIVO'
                  return (
                    <div key={p.id} style={{ padding: '8px 0', borderTop: '1px solid #f0f1f5' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: p.quien === 'Claude' ? GREY : RED, padding: '2px 7px', borderRadius: 6, marginTop: 2 }}>{p.quien}</span>
                        <span style={{ flex: 1, fontSize: 13.5, color: DARK, lineHeight: 1.45, textDecoration: est === 'HECHO' ? 'line-through' : 'none', opacity: est === 'HECHO' ? 0.55 : 1 }}>{p.texto}</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {ESTADOS.map(e => <button key={e} onClick={() => setEstado(p.id, e)} title={e} style={{ width: 26, height: 26, borderRadius: 7, cursor: 'pointer', border: est === e ? `2px solid ${COLOR_ESTADO[e]}` : '1px solid #d8dbe6', background: est === e ? COLOR_ESTADO[e] : '#fff' }} />)}
                        </div>
                      </div>
                      <input value={reg?.nota || ''} onChange={e => setNota(p.id, e.target.value)} placeholder="Nota…" style={{ marginTop: 6, marginLeft: 44, width: 'calc(100% - 140px)', fontSize: 12, color: GREY, border: '1px solid #eef0f5', borderRadius: 6, padding: '4px 8px', background: '#fafbfc' }} />
                    </div>
                  )
                })}
                <div style={{ marginTop: 12, background: LIME, borderRadius: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: DARK, display: 'flex', alignItems: 'center' }}>
                  {ev && <Semaforo ok={ev.ok} casi={ev.casi} />}KPI salida: {f.kpi}{ev && <span style={{ marginLeft: 8, color: GREY, fontWeight: 600 }}>· {ev.txt}</span>}
                </div>
              </div>
            )
          })}

          <h2 style={{ color: RED, fontSize: 18, marginTop: 28 }}>Sistema operativo · rituales</h2>
          <div style={{ background: '#fff', border: '1px solid #e3e6ee', borderRadius: 14, overflow: 'hidden' }}>
            {RITUALES.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: 12, borderTop: i ? '1px solid #f0f1f5' : 'none' }}>
                <div style={{ width: 150, fontWeight: 800, color: DARK, fontSize: 13 }}>{r[0]}<div style={{ fontWeight: 500, color: GREY, fontSize: 11 }}>{r[1]}</div></div>
                <div style={{ flex: 1, fontSize: 12.5, color: DARK, lineHeight: 1.4 }}>{r[2]}</div>
                <div style={{ width: 150, fontSize: 11.5, color: GREY, textAlign: 'right' }}>{r[3]}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ESTRATEGIA */}
      {tab === 'estrategia' && (
        <div style={{ display: 'grid', gap: 14 }}>
          {agencias.length === 0 ? <div style={{ color: GREY }}>Sin agencias cargadas en BD.</div> : agencias.map((a, i) => (
            <div key={a.id} style={{ background: '#fff', border: '1px solid #e3e6ee', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ background: DARK, color: '#fff', padding: '10px 16px', fontWeight: 800, fontSize: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span>{i + 1}. {a.nombre} <span style={{ fontWeight: 500, opacity: 0.7, fontSize: 12 }}>· {a.web}</span></span>
                <span style={{ fontSize: 11, opacity: 0.8, whiteSpace: 'nowrap' }}>{a.facturacion} · amenaza {a.amenaza}/5 · copiar {a.facilidad_copiar}/5</span>
              </div>
              <div style={{ padding: 16, display: 'grid', gap: 8, fontSize: 13, color: DARK, lineHeight: 1.45 }}>
                <div><b style={{ color: GREY }}>Qué venden. </b>{a.que_venden}</div>
                <div><b style={{ color: GREY }}>Cómo. </b>{a.como_lo_venden}</div>
                <div><b style={{ color: GREY }}>Por qué funciona. </b>{a.por_que_funciona}</div>
                <div><b style={{ color: GREY }}>Su debilidad. </b>{a.su_debilidad}</div>
                <div style={{ background: LIME, borderRadius: 8, padding: '8px 12px', fontWeight: 600 }}><b>Nuestro atajo con Claude. </b>{a.nuestro_atajo}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
