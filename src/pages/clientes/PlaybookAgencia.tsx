import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * PLAYBOOK AGENCIA DELIVERY — Módulo MKT (clientes) · v2
 * 3 vistas:
 *  1) Cuadro de mando: KPIs REALES del ERP (vista v_mkt_playbook_kpis) vs objetivos del plan.
 *  2) Plan 6 meses: checklist operativo por fases con estado + nota persistidos (mkt_playbook_estado).
 *  3) Estrategia: 10 agencias leídas de mkt_benchmark_competidores (categoria='agencia_delivery').
 *
 * Datos 100% reales o degradación elegante (sin inventar). Tokens SL: #B01D23 #1e2233 #e8f442 #484f66
 */

const RED = '#B01D23', DARK = '#1e2233', LIME = '#e8f442', GREY = '#484f66'
const eur = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

type Estado = 'ACTIVO' | 'EN_CURSO' | 'HECHO'
const ESTADOS: Estado[] = ['ACTIVO', 'EN_CURSO', 'HECHO']
const COLOR_ESTADO: Record<Estado, string> = { ACTIVO: '#9aa0b4', EN_CURSO: '#f59e0b', HECHO: '#16a34a' }

type Kpis = {
  bruto_total: number; pedidos_total: number; directo_bruto: number
  uber_bruto: number; glovo_bruto: number; je_bruto: number
  pct_directo: number; ticket_medio: number; comision_estimada: number
  crm_clientes: number; club_socios: number; resenas: number
}
type Agencia = {
  id: number; nombre: string; web: string; que_venden: string; como_lo_venden: string
  por_que_funciona: string; su_debilidad: string; nuestro_atajo: string
  ticket_medio: string; canal_principal: string; facturacion: string
  amenaza: number; facilidad_copiar: number; orden: number
}

type Paso = { id: string; quien: 'Claude' | 'Rubén'; texto: string }
type Fase = { id: string; titulo: string; robado: string; kpi: string; pasos: Paso[] }

const FASES: Fase[] = [
  { id: 'f1', titulo: 'FASE 1 · MES 1 — Montar la agencia', robado: 'Think Paladar, Comunikoo',
    kpi: 'Línea base + fotos + rituales activos.', pasos: [
      { id: 'f1p1', quien: 'Claude', texto: 'Auditoría de las 3 plataformas marca a marca: posición, fotos, descripciones, tiempos, valoraciones, comisión efectiva real.' },
      { id: 'f1p2', quien: 'Claude', texto: 'Línea base ERP: ticket medio, repetición, margen por plato/canal, horas valle por marca.' },
      { id: 'f1p3', quien: 'Claude', texto: 'Auditoría de fugas nº1: € en comisiones y promos últimos 3 meses → presupuesto para canal propio.' },
      { id: 'f1p4', quien: 'Claude', texto: 'Montar panel de agencia en Notion: rituales, calendario Q3, plantilla de informe mensual.' },
      { id: 'f1p5', quien: 'Rubén', texto: 'Optimizar fichas de Google Business de las marcas (Claude redacta textos; tú las subes, 1 h).' },
      { id: 'f1p6', quien: 'Rubén', texto: 'Sesión de fotos profesional de los 10 platos top (400–800 €). BLOQUEANTE. Uber Eats la regala en plan Standard/Premium.' },
    ] },
  { id: 'f2', titulo: 'FASE 2 · MES 2 — Ingeniería de menú y pricing', robado: 'pleez, Think Paladar, Peckwater',
    kpi: 'Ticket plataformas +5% · ROI medido por promo · cartas reescritas en 3 canales.', pasos: [
      { id: 'f2p1', quien: 'Claude', texto: 'Matriz popularidad×margen de la carta. Subir 5–8% estrellas inelásticas, matar/reformular platos perro.' },
      { id: 'f2p2', quien: 'Claude', texto: 'Reescribir listings estilo Peckwater: nombres apetitosos, descripciones que venden, combos cerrados arriba.' },
      { id: 'f2p3', quien: 'Claude', texto: 'Definir 3 reglas de promo estilo pleez (solo valle, nunca permanentes, presupuesto cerrado) + ROI a 2 semanas.' },
      { id: 'f2p4', quien: 'Claude', texto: 'Primer radar de competencia quincenal de Vallecas.' },
      { id: 'f2p5', quien: 'Rubén', texto: 'Aplicar cambios en paneles Glovo/Uber/Just Eat con el guion exacto (o en sesión conjunta).' },
    ] },
  { id: 'f3', titulo: 'FASE 3 · MES 3 — Lanzar el canal directo', robado: 'Delitbee, Cheerfy, Deliverect',
    kpi: 'Web viva · 100 pedidos directos · coste logístico/pedido < comisión media plataforma.', pasos: [
      { id: 'f3p1', quien: 'Claude', texto: 'Construir y desplegar binagre.com: carta sincronizada con ERP, Stripe, Uber Direct API, recogida con descuento.' },
      { id: 'f3p2', quien: 'Claude', texto: 'Precios web 5–10% bajo plataformas (sin 25–30% comisión sigue siendo más rentable por pedido).' },
      { id: 'f3p3', quien: 'Claude', texto: 'Medir conversión carrito→compra contra benchmark Delitbee (60%) y optimizar checkout.' },
      { id: 'f3p4', quien: 'Claude', texto: 'SEO local: 4 guías "comida casera a domicilio Vallecas/Madrid" + enlace de pedido en ficha Google.' },
      { id: 'f3p5', quien: 'Rubén', texto: 'Crear el repo de la web (bloqueante, 10 min con guía) y validar en tu móvil antes del go-live.' },
    ] },
  { id: 'f4', titulo: 'FASE 4 · MES 4 — Captura y trasvase', robado: 'Comunikoo, Cheerfy',
    kpi: 'Base ≥400 clientes · ≥30% pedidos web de clientes captados · +50 reseñas.', pasos: [
      { id: 'f4p1', quien: 'Claude', texto: 'CRM en ERP: cliente, contacto, frecuencia, plato favorito, canal. Diseño del flyer QR del packaging.' },
      { id: 'f4p2', quien: 'Claude', texto: 'Automatización: WhatsApp/email bienvenida + recordatorio a 10–14 días sin pedido, segmentado.' },
      { id: 'f4p3', quien: 'Claude', texto: 'Encuesta post-pedido: 5★ → Google review; <4★ → alerta para recuperar cliente.' },
      { id: 'f4p4', quien: 'Rubén', texto: 'Imprimir flyers (60–100 €) y meterlos en TODOS los pedidos de plataforma. Disciplina de cocina.' },
    ] },
  { id: 'f5', titulo: 'FASE 5 · MES 5 — Fidelización por hábito', robado: 'Cheerfy, Taster, Binagre',
    kpi: 'Repetición 30 días +25% · ≥20 suscripciones · primer pico por influencer.', pasos: [
      { id: 'f5p1', quien: 'Claude', texto: 'Programa de puntos en web: 5 pedidos → 6º ejecutivo gratis (premio en producto, no descuento).' },
      { id: 'f5p2', quien: 'Claude', texto: 'Suscripción semanal Ofi L-V y Meal Prep con cobro recurrente Stripe: ingreso predecible.' },
      { id: 'f5p3', quien: 'Claude', texto: 'Campañas segmentadas: viernes familia, lunes meal prep, según CRM.' },
      { id: 'f5p4', quien: 'Rubén', texto: 'Cerrar 2–3 microinfluencers food de Madrid (Claude prepara lista, mensaje y trato).' },
    ] },
  { id: 'f6', titulo: 'FASE 6 · MES 6 — Escalar y decidir con números', robado: 'Peckwater, Think Paladar',
    kpi: 'Canal directo ≥20% · ticket +12% · playbook documentado.', pasos: [
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

// Objetivos del plan (norte a 6 meses)
const OBJ_DIRECTO = 20      // % canal directo objetivo
const OBJ_TICKET_PCT = 12   // % subida ticket objetivo

function KpiCard({ titulo, valor, sub, color = DARK, barra }: { titulo: string; valor: string; sub?: string; color?: string; barra?: { pct: number; obj: number } }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e3e6ee', borderRadius: 14, padding: 16, flex: '1 1 180px', minWidth: 180 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: 0.3 }}>{titulo}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, marginTop: 4 }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, color: GREY, marginTop: 2 }}>{sub}</div>}
      {barra && (
        <div style={{ marginTop: 8 }}>
          <div style={{ height: 8, background: '#eef0f5', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, (barra.pct / barra.obj) * 100)}%`, height: '100%', background: barra.pct >= barra.obj ? '#16a34a' : LIME }} />
          </div>
          <div style={{ fontSize: 11, color: GREY, marginTop: 3 }}>Objetivo {barra.obj}%</div>
        </div>
      )}
    </div>
  )
}

export default function PlaybookAgencia() {
  const [tab, setTab] = useState<'mando' | 'plan' | 'estrategia'>('mando')
  const [estados, setEstados] = useState<Record<string, { estado: Estado; nota?: string }>>({})
  const [persistente, setPersistente] = useState(true)
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [agencias, setAgencias] = useState<Agencia[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    ;(async () => {
      // KPIs reales
      try {
        const { data } = await supabase.from('v_mkt_playbook_kpis').select('*').single()
        if (activo && data) setKpis(data as any)
      } catch { /* sin vista */ }
      // Agencias de BD
      try {
        const { data } = await supabase.from('mkt_benchmark_competidores').select('*')
          .eq('categoria', 'agencia_delivery').order('orden')
        if (activo && data?.length) setAgencias(data as any)
      } catch { /* sin tabla */ }
      // Estados persistidos
      try {
        const { data, error } = await supabase.from('mkt_playbook_estado').select('id, estado, nota')
        if (error) throw error
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
    if (!persistente) return
    try { await supabase.from('mkt_playbook_estado').upsert({ id, estado, nota: estados[id]?.nota ?? null, updated_at: new Date().toISOString() }) } catch {}
  }
  async function setNota(id: string, nota: string) {
    setEstados(prev => ({ ...prev, [id]: { estado: prev[id]?.estado ?? 'ACTIVO', nota } }))
    if (!persistente) return
    try { await supabase.from('mkt_playbook_estado').upsert({ id, estado: estados[id]?.estado ?? 'ACTIVO', nota, updated_at: new Date().toISOString() }) } catch {}
  }

  const prog = useMemo(() => {
    const h = TODOS.filter(p => estados[p.id]?.estado === 'HECHO').length
    return { h, t: TODOS.length, pct: Math.round((h / TODOS.length) * 100) }
  }, [estados])

  const k = kpis
  const mixMax = k ? Math.max(k.uber_bruto, k.glovo_bruto, k.je_bruto, k.directo_bruto, 1) : 1

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ color: GREY, fontSize: 13, fontWeight: 600 }}>MKT · CLIENTES</div>
      <h1 style={{ margin: 0, color: DARK, fontSize: 28, fontWeight: 800 }}>Playbook Agencia Delivery</h1>
      <p style={{ color: GREY, fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
        El know-how de las 10 empresas líderes de food delivery, convertido en un sistema que ejecutamos con Claude —
        medido contra los datos reales del ERP.
      </p>

      <div style={{ display: 'flex', gap: 8, margin: '18px 0 22px', flexWrap: 'wrap' }}>
        {([['mando', 'Cuadro de mando'], ['plan', 'Plan 6 meses'], ['estrategia', 'Estrategia · 10 agencias']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, background: tab === key ? DARK : '#eef0f5', color: tab === key ? '#fff' : GREY }}>{label}</button>
        ))}
      </div>

      {/* ---- CUADRO DE MANDO ---- */}
      {tab === 'mando' && (
        <>
          {!k ? <div style={{ color: GREY }}>Cargando datos del ERP…</div> : (
            <>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <KpiCard titulo="% Canal directo" valor={`${k.pct_directo}%`} sub={`${eur(k.directo_bruto)} de ${eur(k.bruto_total)}`} color={RED} barra={{ pct: k.pct_directo, obj: OBJ_DIRECTO }} />
                <KpiCard titulo="Ticket medio" valor={eur(k.ticket_medio)} sub={`${k.pedidos_total} pedidos`} />
                <KpiCard titulo="Comisiones pagadas (est.)" valor={eur(k.comision_estimada)} sub="Uber/Glovo 30% · JE 20%" color={RED} />
                <KpiCard titulo="Presupuesto canal propio" valor={eur(k.comision_estimada)} sub="= lo que regalas a plataformas" color="#16a34a" />
              </div>

              <h3 style={{ color: DARK, marginTop: 24, fontSize: 16 }}>Mix por canal (bruto real 2026)</h3>
              <div style={{ background: '#fff', border: '1px solid #e3e6ee', borderRadius: 14, padding: 16 }}>
                {[['Uber Eats', k.uber_bruto, '#000'], ['Glovo', k.glovo_bruto, '#f7c600'], ['Just Eat', k.je_bruto, '#fb5a3c'], ['Directo (web)', k.directo_bruto, '#16a34a']].map(([n, v, c]: any) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0' }}>
                    <div style={{ width: 90, fontSize: 12.5, fontWeight: 700, color: DARK }}>{n}</div>
                    <div style={{ flex: 1, height: 18, background: '#eef0f5', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${(v / mixMax) * 100}%`, height: '100%', background: c }} />
                    </div>
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
                Lectura: el canal directo es prácticamente {k.pct_directo}%. En lo que va de 2026 has dejado unos {eur(k.comision_estimada)} en
                comisiones de plataforma. Ese importe es exactamente el presupuesto que justifica construir y empujar el canal propio. Norte a 6 meses: directo ≥{OBJ_DIRECTO}%.
              </div>
            </>
          )}
        </>
      )}

      {/* ---- PLAN 6 MESES ---- */}
      {tab === 'plan' && (
        <>
          <div style={{ background: '#fff', border: '1px solid #e3e6ee', borderRadius: 14, padding: 18, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 800, color: DARK, fontSize: 16 }}>Progreso global</div>
              <div style={{ fontWeight: 800, color: RED, fontSize: 22 }}>{prog.pct}%</div>
            </div>
            <div style={{ height: 12, background: '#eef0f5', borderRadius: 8, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ width: `${prog.pct}%`, height: '100%', background: LIME }} />
            </div>
            <div style={{ color: GREY, fontSize: 12, marginTop: 8 }}>
              {prog.h} de {prog.t} pasos hechos{!persistente && ' · (modo memoria: crea la tabla mkt_playbook_estado para guardar)'}
            </div>
          </div>

          {cargando ? <div style={{ color: GREY }}>Cargando…</div> : FASES.map(f => {
            const h = f.pasos.filter(p => estados[p.id]?.estado === 'HECHO').length
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
                          {ESTADOS.map(e => (
                            <button key={e} onClick={() => setEstado(p.id, e)} title={e} style={{ width: 26, height: 26, borderRadius: 7, cursor: 'pointer', border: est === e ? `2px solid ${COLOR_ESTADO[e]}` : '1px solid #d8dbe6', background: est === e ? COLOR_ESTADO[e] : '#fff' }} />
                          ))}
                        </div>
                      </div>
                      <input value={reg?.nota || ''} onChange={e => setNota(p.id, e.target.value)} placeholder="Nota…"
                        style={{ marginTop: 6, marginLeft: 44, width: 'calc(100% - 140px)', fontSize: 12, color: GREY, border: '1px solid #eef0f5', borderRadius: 6, padding: '4px 8px', background: '#fafbfc' }} />
                    </div>
                  )
                })}
                <div style={{ marginTop: 12, background: LIME, borderRadius: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: DARK }}>KPI salida: {f.kpi}</div>
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

      {/* ---- ESTRATEGIA (de BD) ---- */}
      {tab === 'estrategia' && (
        <div style={{ display: 'grid', gap: 14 }}>
          {agencias.length === 0 ? <div style={{ color: GREY }}>Sin agencias cargadas en BD.</div> : agencias.map((a, i) => (
            <div key={a.id} style={{ background: '#fff', border: '1px solid #e3e6ee', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ background: DARK, color: '#fff', padding: '10px 16px', fontWeight: 800, fontSize: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{i + 1}. {a.nombre} <span style={{ fontWeight: 500, opacity: 0.7, fontSize: 12 }}>· {a.web}</span></span>
                <span style={{ fontSize: 11, opacity: 0.8 }}>{a.facturacion} · amenaza {a.amenaza}/5 · copiar {a.facilidad_copiar}/5</span>
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
