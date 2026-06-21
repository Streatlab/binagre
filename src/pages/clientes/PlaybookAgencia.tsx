import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * PLAYBOOK AGENCIA DELIVERY — Módulo MKT (clientes)
 * Vista 1 (Plan 6 meses): checklist operativo por fases con estado persistido en Supabase.
 * Vista 2 (Estrategia): dossier de las 10 empresas tipo Think Paladar.
 *
 * Persistencia: tabla `mkt_playbook_estado` (id text PK, estado text, updated_at timestamptz).
 * Si la tabla no existe, funciona en memoria (degradación elegante).
 * Tokens Streat Lab: #B01D23 / #1e2233 / #e8f442 / #484f66
 */

const RED = '#B01D23'
const DARK = '#1e2233'
const LIME = '#e8f442'
const GREY = '#484f66'

type Estado = 'ACTIVO' | 'EN_CURSO' | 'HECHO'
const ESTADOS: Estado[] = ['ACTIVO', 'EN_CURSO', 'HECHO']
const COLOR_ESTADO: Record<Estado, string> = { ACTIVO: '#9aa0b4', EN_CURSO: '#f59e0b', HECHO: '#16a34a' }

type Ficha = { n: number; nombre: string; meta: string; servicios: string; metodo: string; precio: string; conClaude: string }

const AGENCIAS: Ficha[] = [
  { n: 1, nombre: 'Think Paladar', meta: 'Barcelona · ex-Glovo · +130 clientes',
    servicios: 'Delivery+ (gestión de canales: pricing, promos, posicionamiento), PaladarApp (datos + pricing dinámico) y Studio (branding, foto, packaging).',
    metodo: 'Diagnóstico → plan mensual → ejecución diaria → informe semanal → informe mensual + reunión con gestor dedicado. Pricing dinámico estilo hoteles.',
    precio: '3 planes (hasta 5 locales / grupos / a medida). Fee fijo mensual, mercado 400–900 €/marca-local.',
    conClaude: 'Las 4 patas (datos, plan, ejecución, reunión) las hace Claude con el ERP. Ventaja: una sola cuenta y con margen real por plato que ellos nunca ven.' },
  { n: 2, nombre: 'pleez', meta: 'Lisboa/Madrid · +200 clientes · IA',
    servicios: 'Promos automatizadas por reglas, pricing/menú por plataforma, espionaje de competidores en tu radio, ROI por promo, canibalización entre platos.',
    metodo: 'Algoritmo + account manager. Reglas una vez, ejecución automática. Promesa +15% ingresos vía ingeniería de menú.',
    precio: 'SaaS ~60 €/local/mes (referidos descuentan 59,90 €/mes).',
    conClaude: 'Scraping mensual de cartas/promos de Vallecas + reglas de promo en Notion + ROI real en ERP. Optimizamos beneficio (escandallo), no facturación.' },
  { n: 3, nombre: 'Delitbee', meta: 'Valencia · Lanzadera · +500 restaurantes',
    servicios: 'Tienda online de marca, channel manager (3 plataformas + web), Delitbee Rails (multi-flota que elige el rider más barato/disponible), fidelización.',
    metodo: 'SaaS fijo mensual sin comisión por venta + acompañamiento. "Los restaurantes ya no quieren depender de plataformas".',
    precio: 'Cuota fija mensual. Resultados: -80% comisiones, 60% conversión carrito→compra, 0% cancelaciones.',
    conClaude: 'Su producto = binagre.com. Lo construimos nosotros + fidelización en el ERP. Su 60% de conversión pasa a ser nuestro KPI de web. Cero cuota.' },
  { n: 4, nombre: 'Cheerfy', meta: 'Madrid · partner ElTenedor · loyalty',
    servicios: 'Tienda online + CRM (captura desde QR/wifi/packaging) + tarjeta Wallet con push + cupones + encuestas + integración +100 TPVs. Carrito multi-marca.',
    metodo: 'El dato del cliente es del restaurante. Registro en cada touchpoint → segmentación → automatización → recurrencia.',
    precio: '2,5% de ventas (mín 29 € / máx 299 €/mes por local), alta 99 €, setup 499 €/marca.',
    conClaude: 'Copiamos el sistema en el ERP: clientes+puntos+cupones, QR del packaging, WhatsApp/email a 10–14 días, encuesta→Google. 0 € vs 2,5% + carrito multi-marca nativo.' },
  { n: 5, nombre: 'Slerp', meta: 'Londres · The Savoy, Lima · premio tecnología',
    servicios: 'Web/app de pedidos de marca, mayor red de couriers UK, click&collect, catering, loyalty, CRM, pedidos desde Google + agencia in-house de social ads.',
    metodo: 'Comisión 7,5% del canal directo (4x más barata que marketplace) + servicios de agencia según acompañamiento.',
    precio: 'Comisión ~7,5% + fees variables. Reseñas: fácil de usar, buen soporte.',
    conClaude: 'Robamos calendario comercial (picos del trimestre con producto especial y pedido anticipado) + pedidos desde ficha de Google. Sin 7,5%.' },
  { n: 6, nombre: 'Peckwater Brands', meta: 'Londres · $18M · marcas virtuales',
    servicios: 'Marcas virtuales llave en mano: diseño por demografía local, recetas, listings, packaging, formación de cocina, account manager, portal de benchmarks.',
    metodo: '100% performance: solo cobran % de ventas brutas. Prometen 8x pedidos y +£12k–57k/año por cocina.',
    precio: '% de ventas, sin cuota fija. El riesgo lo asume la agencia.',
    conClaude: 'Su know-how es nuestro negocio. Robamos su gap analysis: qué cocina falta en Vallecas con demanda alta → diseñar marca para ese hueco → testar 8 semanas con corte.' },
  { n: 7, nombre: 'Taster', meta: 'Londres/París · marcas con influencers',
    servicios: 'Marcas digitales co-creadas con creadores de contenido (Out Fry, Pepe Chicken): demanda incorporada desde el día 1.',
    metodo: 'Licencia de marca + royalties. La marca llega con audiencia en vez de comprar visibilidad a la plataforma.',
    precio: 'Royalty sobre ventas.',
    conClaude: 'Demanda prestada: 2–3 microinfluencers food de Madrid con plato co-firmado + código en binagre.com. Versión low-cost que empuja el canal propio.' },
  { n: 8, nombre: 'Deliverect', meta: 'Gante · channel manager líder mundial',
    servicios: 'Agrega pedidos de todas las plataformas en el TPV, carta única sincronizada, pausar agotados en todos a la vez, informes por canal.',
    metodo: 'SaaS por local. Tesis: cada tablet/carta duplicada genera errores; un panel único reduce tiempos de aceptación (factor de ranking).',
    precio: 'Suscripción ~70–300 €/mes/local según módulos.',
    conClaude: 'No su software (Rushour ya agrega), sí su disciplina: carta maestra única en el ERP + checklist de sincronización tras cada cambio en los 4 canales.' },
  { n: 9, nombre: 'Last.app', meta: 'Barcelona · TPV all-in-one con delivery',
    servicios: 'TPV + integración 3 plataformas + web/app propia sin comisión + KDS cocina + informes por canal + blog SEO potente.',
    metodo: 'Suscripción por módulos. Venta basada en "todo en un sistema": menos fricción, datos unificados.',
    precio: 'Suscripción mensual por local y módulos.',
    conClaude: 'Ya decidimos construir propio. Robamos su packaging comercial (flujo único pedido→cocina→datos→decisión, que el ERP ya es) y su SEO local para binagre.com.' },
  { n: 10, nombre: 'Comunikoo', meta: 'Barcelona · anti-dependencia plataformas',
    servicios: 'Auditoría de "fugas de dinero", SEO local + Google Ads, reputación/reseñas, sistema "1ª vez plataforma, 2ª directo en tu web".',
    metodo: 'Fee mensual sin permanencia. Primero auditan, luego invierten.',
    precio: 'Fee mensual 500–1.200 €.',
    conClaude: 'Robamos la auditoría de fugas como ritual trimestral: € en comisiones = presupuesto justificado para canal propio. Y el flyer QR en cada pedido.' },
]

const RITUALES = [
  ['Pulso semanal', 'Lunes (15 min)', 'Ventas por marca/canal, ticket, pedidos, ROI de promos, alertas. 10 líneas + decisión.', 'Claude prepara · Rubén decide'],
  ['Radar competencia', 'Quincenal', 'Cartas, precios y promos de competidores de Vallecas. Cambios → propuesta de respuesta.', 'Claude'],
  ['Comité de carta', 'Mensual (30 min)', 'Matriz popularidad×margen. Subir/reposicionar/combo/eliminar. Máx 3 cambios/mes/marca.', 'Claude propone · Rubén+Emilio'],
  ['Informe mensual + reunión', 'Último viernes', 'Resultados vs objetivos, qué se hizo, plan del mes. Acta en Notion.', 'Claude redacta · Reunión'],
  ['Auditoría de fugas', 'Trimestral', 'Comisiones + promos vs margen directo → presupuesto para canal propio.', 'Claude'],
  ['Calendario comercial', 'Trimestral', 'Picos del trimestre con producto especial y pedido anticipado en web.', 'Claude propone · Rubén valida'],
]

type Paso = { id: string; quien: 'Claude' | 'Rubén'; texto: string }
type Fase = { id: string; titulo: string; robado: string; kpi: string; pasos: Paso[] }

const FASES: Fase[] = [
  { id: 'f1', titulo: 'FASE 1 · MES 1 — Montar la agencia (diagnóstico + sistema)',
    robado: 'Think Paladar (diagnóstico→plan→informe), Comunikoo (auditoría de fugas)',
    kpi: 'Línea base documentada + fotos hechas + rituales activos.',
    pasos: [
      { id: 'f1p1', quien: 'Claude', texto: 'Auditoría de las 3 plataformas marca a marca: posición, fotos, descripciones, tiempos, valoraciones, comisión efectiva real.' },
      { id: 'f1p2', quien: 'Claude', texto: 'Línea base ERP: ticket medio, repetición, margen por plato/canal, horas valle por marca.' },
      { id: 'f1p3', quien: 'Claude', texto: 'Auditoría de fugas nº1: € en comisiones y promos últimos 3 meses → presupuesto para canal propio.' },
      { id: 'f1p4', quien: 'Claude', texto: 'Montar panel de agencia en Notion: rituales, calendario Q3, plantilla de informe mensual.' },
      { id: 'f1p5', quien: 'Rubén', texto: 'Optimizar fichas de Google Business de las marcas (Claude redacta textos; tú las subes, 1 h).' },
      { id: 'f1p6', quien: 'Rubén', texto: 'Sesión de fotos profesional de los 10 platos top (400–800 €). BLOQUEANTE. Uber Eats la regala en plan Standard/Premium: reclamarla.' },
    ] },
  { id: 'f2', titulo: 'FASE 2 · MES 2 — Ingeniería de menú y pricing',
    robado: 'pleez (pricing/promos por reglas), Think Paladar (pricing dinámico), Peckwater (listings)',
    kpi: 'Ticket plataformas +5% · ROI medido por promo · cartas reescritas en 3 canales.',
    pasos: [
      { id: 'f2p1', quien: 'Claude', texto: 'Matriz popularidad×margen de la carta. Subir 5–8% estrellas inelásticas, matar/reformular platos perro.' },
      { id: 'f2p2', quien: 'Claude', texto: 'Reescribir listings estilo Peckwater: nombres apetitosos, descripciones que venden, combos cerrados arriba.' },
      { id: 'f2p3', quien: 'Claude', texto: 'Definir 3 reglas de promo estilo pleez (solo valle, nunca permanentes, presupuesto cerrado) + ROI a 2 semanas.' },
      { id: 'f2p4', quien: 'Claude', texto: 'Primer radar de competencia quincenal de Vallecas.' },
      { id: 'f2p5', quien: 'Rubén', texto: 'Aplicar cambios en paneles Glovo/Uber/Just Eat con el guion exacto (o en sesión conjunta).' },
    ] },
  { id: 'f3', titulo: 'FASE 3 · MES 3 — Lanzar el canal directo',
    robado: 'Delitbee (tienda+Uber Direct), Cheerfy (multi-marca), Deliverect (carta única)',
    kpi: 'Web viva · 100 pedidos directos · coste logístico/pedido < comisión media plataforma.',
    pasos: [
      { id: 'f3p1', quien: 'Claude', texto: 'Construir y desplegar binagre.com: carta sincronizada con ERP, Stripe, Uber Direct API, recogida con descuento.' },
      { id: 'f3p2', quien: 'Claude', texto: 'Precios web 5–10% bajo plataformas (sin 25–30% comisión sigue siendo más rentable por pedido).' },
      { id: 'f3p3', quien: 'Claude', texto: 'Medir conversión carrito→compra contra benchmark Delitbee (60%) y optimizar checkout.' },
      { id: 'f3p4', quien: 'Claude', texto: 'SEO local: 4 guías "comida casera a domicilio Vallecas/Madrid" + enlace de pedido en ficha Google.' },
      { id: 'f3p5', quien: 'Rubén', texto: 'Crear el repo de la web (bloqueante, 10 min con guía) y validar en tu móvil antes del go-live.' },
    ] },
  { id: 'f4', titulo: 'FASE 4 · MES 4 — Captura y trasvase de clientes',
    robado: 'Comunikoo (1ª plataforma, 2ª directo), Cheerfy (CRM + captura en packaging)',
    kpi: 'Base ≥400 clientes · ≥30% pedidos web de clientes captados en plataformas · +50 reseñas.',
    pasos: [
      { id: 'f4p1', quien: 'Claude', texto: 'CRM en ERP: cliente, contacto, frecuencia, plato favorito, canal. Diseño del flyer QR del packaging.' },
      { id: 'f4p2', quien: 'Claude', texto: 'Automatización: WhatsApp/email bienvenida + recordatorio a 10–14 días sin pedido, segmentado.' },
      { id: 'f4p3', quien: 'Claude', texto: 'Encuesta post-pedido: 5★ → Google review; <4★ → alerta para recuperar cliente.' },
      { id: 'f4p4', quien: 'Rubén', texto: 'Imprimir flyers (60–100 €) y meterlos en TODOS los pedidos de plataforma. Disciplina de cocina.' },
    ] },
  { id: 'f5', titulo: 'FASE 5 · MES 5 — Fidelización por hábito',
    robado: 'Cheerfy (puntos/Wallet), Taster (demanda prestada), Binagre (hábito, no descuento)',
    kpi: 'Repetición 30 días +25% · ≥20 suscripciones · primer pico por influencer.',
    pasos: [
      { id: 'f5p1', quien: 'Claude', texto: 'Programa de puntos en web: 5 pedidos → 6º ejecutivo gratis (premio en producto, no descuento).' },
      { id: 'f5p2', quien: 'Claude', texto: 'Suscripción semanal Ofi L-V y Meal Prep con cobro recurrente Stripe: ingreso predecible.' },
      { id: 'f5p3', quien: 'Claude', texto: 'Campañas segmentadas: viernes familia, lunes meal prep, según CRM.' },
      { id: 'f5p4', quien: 'Rubén', texto: 'Cerrar 2–3 microinfluencers food de Madrid (Claude prepara lista, mensaje y trato).' },
    ] },
  { id: 'f6', titulo: 'FASE 6 · MES 6 — Escalar y decidir con números',
    robado: 'Peckwater (validar/matar marcas con datos), Think Paladar (reporting de cierre)',
    kpi: 'Canal directo ≥20% · ticket +12% · playbook documentado como sistema operativo.',
    pasos: [
      { id: 'f6p1', quien: 'Claude', texto: 'P&L por marca virtual. Criterio Peckwater: marca que no rinde tras 8 semanas optimizada → rediseñar o matar.' },
      { id: 'f6p2', quien: 'Claude', texto: 'Replicar playbook (fases 2–5) en la 2ª marca con mejor margen.' },
      { id: 'f6p3', quien: 'Claude', texto: 'Informe semestral: canal directo %, ticket, repetición, ahorro en comisiones, comparativa vs agencia.' },
      { id: 'f6p4', quien: 'Rubén', texto: 'Decisión con Emilio: doblar en canal directo, lanzar/matar marcas, contratar pieza externa puntual si procede.' },
    ] },
]

const TODOS_PASOS = FASES.flatMap(f => f.pasos)

export default function PlaybookAgencia() {
  const [tab, setTab] = useState<'estrategia' | 'plan'>('plan')
  const [estados, setEstados] = useState<Record<string, Estado>>({})
  const [cargando, setCargando] = useState(true)
  const [persistente, setPersistente] = useState(true)

  useEffect(() => {
    let activo = true
    ;(async () => {
      try {
        const { data, error } = await supabase.from('mkt_playbook_estado').select('id, estado')
        if (error) throw error
        if (!activo) return
        const map: Record<string, Estado> = {}
        ;(data || []).forEach((r: any) => { map[r.id] = r.estado as Estado })
        setEstados(map)
      } catch {
        setPersistente(false)
      } finally {
        if (activo) setCargando(false)
      }
    })()
    return () => { activo = false }
  }, [])

  async function setEstado(id: string, estado: Estado) {
    setEstados(prev => ({ ...prev, [id]: estado }))
    if (!persistente) return
    try {
      await supabase.from('mkt_playbook_estado').upsert({ id, estado, updated_at: new Date().toISOString() })
    } catch { /* memoria */ }
  }

  const progreso = useMemo(() => {
    const total = TODOS_PASOS.length
    const hechos = TODOS_PASOS.filter(p => estados[p.id] === 'HECHO').length
    return { total, hechos, pct: total ? Math.round((hechos / total) * 100) : 0 }
  }, [estados])

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 4, color: GREY, fontSize: 13, fontWeight: 600 }}>MKT · CLIENTES</div>
      <h1 style={{ margin: 0, color: DARK, fontSize: 28, fontWeight: 800 }}>Playbook Agencia Delivery</h1>
      <p style={{ color: GREY, fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
        El know-how de las 10 empresas líderes en gestión de food delivery, convertido en un sistema que ejecutamos
        nosotros con Claude — sin contratar a ninguna y haciéndolo mejor.
      </p>

      <div style={{ display: 'flex', gap: 8, margin: '18px 0 22px' }}>
        {([['plan', 'Plan 6 meses'], ['estrategia', 'Estrategia · 10 agencias']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
              background: tab === k ? DARK : '#eef0f5', color: tab === k ? '#fff' : GREY }}>{label}</button>
        ))}
      </div>

      {tab === 'plan' && (
        <>
          <div style={{ background: '#fff', border: '1px solid #e3e6ee', borderRadius: 14, padding: 18, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 800, color: DARK, fontSize: 16 }}>Progreso global</div>
              <div style={{ fontWeight: 800, color: RED, fontSize: 22 }}>{progreso.pct}%</div>
            </div>
            <div style={{ height: 12, background: '#eef0f5', borderRadius: 8, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ width: `${progreso.pct}%`, height: '100%', background: LIME }} />
            </div>
            <div style={{ color: GREY, fontSize: 12, marginTop: 8 }}>
              {progreso.hechos} de {progreso.total} pasos hechos
              {!persistente && ' · (modo memoria: crea la tabla mkt_playbook_estado para guardar entre sesiones)'}
            </div>
          </div>

          {cargando ? <div style={{ color: GREY }}>Cargando…</div> : FASES.map(fase => {
            const totalF = fase.pasos.length
            const hechosF = fase.pasos.filter(p => estados[p.id] === 'HECHO').length
            return (
              <div key={fase.id} style={{ background: '#fff', border: '1px solid #e3e6ee', borderRadius: 14, padding: 18, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <h3 style={{ margin: 0, color: DARK, fontSize: 16, fontWeight: 800 }}>{fase.titulo}</h3>
                  <span style={{ fontSize: 12, color: GREY, whiteSpace: 'nowrap' }}>{hechosF}/{totalF}</span>
                </div>
                <div style={{ fontSize: 12, fontStyle: 'italic', color: GREY, margin: '4px 0 12px' }}>Robado de: {fase.robado}</div>
                {fase.pasos.map(paso => {
                  const est = estados[paso.id] || 'ACTIVO'
                  return (
                    <div key={paso.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid #f0f1f5' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: paso.quien === 'Claude' ? GREY : RED, padding: '2px 7px', borderRadius: 6, marginTop: 2, whiteSpace: 'nowrap' }}>{paso.quien}</span>
                      <span style={{ flex: 1, fontSize: 13.5, color: DARK, lineHeight: 1.45, textDecoration: est === 'HECHO' ? 'line-through' : 'none', opacity: est === 'HECHO' ? 0.55 : 1 }}>{paso.texto}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {ESTADOS.map(e => (
                          <button key={e} onClick={() => setEstado(paso.id, e)} title={e}
                            style={{ width: 26, height: 26, borderRadius: 7, cursor: 'pointer',
                              border: est === e ? `2px solid ${COLOR_ESTADO[e]}` : '1px solid #d8dbe6',
                              background: est === e ? COLOR_ESTADO[e] : '#fff' }} />
                        ))}
                      </div>
                    </div>
                  )
                })}
                <div style={{ marginTop: 12, background: LIME, borderRadius: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: DARK }}>
                  KPI salida: {fase.kpi}
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

      {tab === 'estrategia' && (
        <div style={{ display: 'grid', gap: 14 }}>
          {AGENCIAS.map(a => (
            <div key={a.n} style={{ background: '#fff', border: '1px solid #e3e6ee', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ background: DARK, color: '#fff', padding: '10px 16px', fontWeight: 800, fontSize: 15 }}>
                {a.n}. {a.nombre} <span style={{ fontWeight: 500, opacity: 0.7, fontSize: 12 }}>· {a.meta}</span>
              </div>
              <div style={{ padding: 16, display: 'grid', gap: 8, fontSize: 13, color: DARK, lineHeight: 1.45 }}>
                <div><b style={{ color: GREY }}>Servicios. </b>{a.servicios}</div>
                <div><b style={{ color: GREY }}>Método. </b>{a.metodo}</div>
                <div><b style={{ color: GREY }}>Precio. </b>{a.precio}</div>
                <div style={{ background: LIME, borderRadius: 8, padding: '8px 12px', fontWeight: 600 }}>
                  <b>Con Claude. </b>{a.conClaude}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
