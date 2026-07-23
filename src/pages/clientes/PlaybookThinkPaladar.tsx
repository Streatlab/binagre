import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { INK, BLANCO, OSW, LEX, GRANATE, VERDE, AMA, GRIS, ROJO } from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel, SHADOW_DURA } from '@/components/kit/cantera'
import { fmtEur, fmtNumES } from '@/utils/format'

/* ═════════════ PLAYBOOK THINK PALADAR ═════════════
   CANTERA ALEGRE v1.0 (área Clientes/Marketing · rosa). Solo capa visual.
   De documento estático a herramienta viva:
   - Realidad: KPIs en vivo (reseñas, facturación, ventas por plato) leídos del ERP
   - Checklist: cada táctica con estado persistente (tabla mkt_playbook_tp_estado, aislada)
   - Resultados: lee crm_campanas reales para ver qué promo se lanzó / funcionó
   - Conexión: enlaces directos a Reseñas, Ventas, Menú Engineering, Plan de campañas
   NO toca mkt_playbook_estado (Playbook Agencia Delivery).
   NOTA: colaboración con Think Paladar finalizada el 30/06/2026. Se conserva como
   manual interno + traspaso de métricas al ERP (ver bloque "Hacerlo solos").
*/

const EST_TABLE = 'mkt_playbook_tp_estado'

type Estado = 'pendiente' | 'aplicando' | 'aplicado' | 'descartado'
const EST_LABEL: Record<Estado, string> = { pendiente: 'Pendiente', aplicando: 'Aplicando', aplicado: 'Aplicado', descartado: 'Descartado' }
const EST_COLOR: Record<Estado, string> = { pendiente: GRIS, aplicando: AMA, aplicado: VERDE, descartado: ROJO }
const EST_NEXT: Record<Estado, Estado> = { pendiente: 'aplicando', aplicando: 'aplicado', aplicado: 'descartado', descartado: 'pendiente' }

type Bloque = { id: string; label: string }
const BLOQUES: Bloque[] = [
  { id: 'realidad', label: 'Realidad' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'resultados', label: 'Resultados' },
  { id: 'metodo', label: 'Metodología' },
  { id: 'reglas', label: 'Reglas clave' },
  { id: 'promos', label: 'Plan de Promos' },
  { id: 'plataformas', label: 'Plataformas' },
  { id: 'cronologia', label: 'Cronología' },
  { id: 'solos', label: 'Hacerlo solos' },
]

/* ── helpers visuales ── */
function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <SeccionLabel bg={GRANATE}>{titulo}</SeccionLabel>
      <Papel ceja={GRANATE}>{children}</Papel>
    </div>
  )
}
function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 7, fontFamily: LEX, fontSize: 13.5, color: INK, lineHeight: 1.5 }}>
      <span style={{ color: GRANATE, flexShrink: 0, fontWeight: 700 }}>·</span>
      <span>{children}</span>
    </div>
  )
}
function Dato({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: INK, fontWeight: 700 }}>{children}</strong>
}
const lblCelda: React.CSSProperties = { fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }
const valCelda: React.CSSProperties = { fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }
const subCelda: React.CSSProperties = { fontFamily: LEX, fontSize: 11.5, marginTop: 4 }

function StatCelda({ label, value, sub, bg = BLANCO, color, first, onClick }: { label: string; value: string; sub?: string; bg?: string; color?: string; first?: boolean; onClick?: () => void }) {
  return (
    <PlanchaCelda bg={bg} color={color} first={first} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div onClick={onClick}>
        <div style={lblCelda}>{label}</div>
        <div style={valCelda}>{value}</div>
        {sub && <div style={subCelda}>{sub}</div>}
      </div>
    </PlanchaCelda>
  )
}

const th: React.CSSProperties = { fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: BLANCO, fontWeight: 600, padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { fontFamily: LEX, fontSize: 13, color: INK, padding: '10px 12px', borderBottom: `2px solid ${INK}`, verticalAlign: 'top' }
const linkBtn: React.CSSProperties = { padding: '8px 14px', border: `2px solid ${INK}`, borderRadius: 0, background: BLANCO, color: GRANATE, fontFamily: OSW, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer' }

export default function PlaybookThinkPaladar() {
  const [bloque, setBloque] = useState<string>('realidad')

  const titular = 'Colaboración finalizada el 30 de junio de 2026: ahora Streat Lab opera el delivery solo, con la metodología y los datos reales del ERP.'
  const atencionHero = [
    'Colaboración FINALIZADA 30 jun 2026',
    '9 bloques de conocimiento',
    'Checklist con estado persistente',
    'Datos en vivo del ERP',
  ]

  return (
    <PantallaCantera>
      {/* 1 · Héroe del área Clientes (rosa) */}
      <HeroCantera
        area="marketing"
        titular={titular}
        etiquetaDato="Estado de la colaboración"
        cifra="Cerrada"
        resumen={<>KPI del contrato: <b>15.000 €</b> de facturación Binagre para el mes 2 · fee 450 €/mes × 4 meses</>}
        atencion={atencionHero}
      />

      {/* 2 · Frase potente */}
      <FrasePotente significado="oportunidad">Lo aprendido con Think Paladar ya no depende de su portal: vive dentro del ERP y se actualiza solo con datos reales.</FrasePotente>

      {/* Navegación propia de la pantalla — pastillas planas arriba-derecha */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {BLOQUES.map(b => {
            const on = bloque === b.id
            return (
              <button key={b.id} onClick={() => setBloque(b.id)} style={{
                padding: '7px 13px', border: `2px solid ${INK}`, borderRadius: 0,
                background: on ? GRANATE : BLANCO, color: on ? BLANCO : INK,
                boxShadow: on ? SHADOW_DURA : 'none',
                fontFamily: OSW, fontSize: 11.5, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer',
              }}>{b.label}</button>
            )
          })}
        </div>
      </div>

      {bloque === 'realidad' && <BloqueRealidad />}
      {bloque === 'checklist' && <BloqueChecklist />}
      {bloque === 'resultados' && <BloqueResultados />}
      {bloque === 'metodo' && <BloqueMetodo />}
      {bloque === 'reglas' && <BloqueReglas />}
      {bloque === 'promos' && <BloquePromos />}
      {bloque === 'plataformas' && <BloquePlataformas />}
      {bloque === 'cronologia' && <BloqueCronologia />}
      {bloque === 'solos' && <BloqueSolos />}
    </PantallaCantera>
  )
}

/* ═════════════ REALIDAD — KPIs vivos del ERP + enlaces a módulos ═════════════ */
function BloqueRealidad() {
  const nav = useNavigate()
  const [kpi, setKpi] = useState<{ rating: number; resenas: number; marcas: number } | null>(null)
  const [factMes, setFactMes] = useState<number | null>(null)
  const [topPlatos, setTopPlatos] = useState<{ plato: string; unidades: number; ingresos: number }[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    (async () => {
      // reseñas: última nota por marca+plataforma
      const { data: res } = await supabase.from('crm_resenas_registro').select('marca,plataforma,rating,num_resenas,fecha').order('fecha', { ascending: false })
      if (res) {
        const ult: Record<string, { rating: number; num: number }> = {}
        for (const r of res as any[]) { const k = `${r.marca}|${r.plataforma}`; if (!ult[k]) ult[k] = { rating: Number(r.rating), num: r.num_resenas || 0 } }
        const vals = Object.values(ult)
        const rating = vals.length ? vals.reduce((s, v) => s + v.rating, 0) / vals.length : 0
        const resenas = vals.reduce((s, v) => s + v.num, 0)
        const marcas = new Set((res as any[]).map(r => r.marca)).size
        setKpi({ rating, resenas, marcas })
      }
      // facturación últimos 30 días
      const hace30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
      const { data: fac } = await supabase.from('facturacion_diario').select('total,fecha').gte('fecha', hace30)
      if (fac) setFactMes((fac as any[]).reduce((s, f) => s + Number(f.total || 0), 0))
      // top platos por unidades
      const { data: vp } = await supabase.from('ventas_plato').select('plato,unidades,ingresos_brutos')
      if (vp) {
        const acc: Record<string, { u: number; i: number }> = {}
        for (const v of vp as any[]) { const k = v.plato; if (!acc[k]) acc[k] = { u: 0, i: 0 }; acc[k].u += v.unidades || 0; acc[k].i += Number(v.ingresos_brutos || 0) }
        const arr = Object.entries(acc).map(([plato, x]) => ({ plato, unidades: x.u, ingresos: x.i })).sort((a, b) => b.unidades - a.unidades).slice(0, 6)
        setTopPlatos(arr)
      }
      setCargando(false)
    })()
  }, [])

  if (cargando) return <Papel ceja={GRIS}><div style={{ color: GRIS, fontFamily: LEX }}>Cargando datos reales del ERP…</div></Papel>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <SeccionLabel bg={GRANATE}>La realidad ahora mismo (datos del ERP)</SeccionLabel>
        <Papel ceja={GRANATE}>
          <Plancha style={{ marginBottom: 4 }}>
            <StatCelda first bg={kpi && kpi.rating >= 4.5 ? VERDE : AMA} color={kpi && kpi.rating >= 4.5 ? BLANCO : INK} label="Rating medio" value={kpi ? kpi.rating.toFixed(2) : '—'} sub={kpi ? `${fmtNumES(kpi.resenas)} reseñas · ${kpi.marcas} marcas` : ''} onClick={() => nav('/clientes/resenas')} />
            <StatCelda bg={INK} color={BLANCO} label="Facturación 30d" value={factMes != null ? fmtEur(factMes) : '—'} sub="toca para ver Ventas" onClick={() => nav('/finanzas/ventas-panel?tab=ventas')} />
            <StatCelda bg={GRANATE} label="KPI Inés mes 2" value={fmtEur(15000)} sub="objetivo facturación Binagre" />
          </Plancha>
          <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>Las tarjetas con datos enlazan al módulo de origen. El rating sale de Panel Reseñas; la facturación, de Ventas.</div>
        </Papel>
      </div>

      <div>
        <SeccionLabel bg={AMA} color={INK}>Top platos reales (por unidades vendidas)</SeccionLabel>
        <Papel ceja={AMA} pad={topPlatos.length ? '0' : undefined} style={{ overflowX: 'auto' }}>
          {topPlatos.length === 0 ? (
            <div style={{ color: GRIS, fontSize: 13, fontFamily: LEX, padding: '20px 22px' }}>Aún sin datos de ventas por plato. Cuando entren, el top aparece aquí para decidir qué promocionar.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: INK }}><th style={th}>Plato</th><th style={{ ...th, textAlign: 'right' }}>Unidades</th><th style={{ ...th, textAlign: 'right' }}>Ingresos</th></tr></thead>
              <tbody>
                {topPlatos.map((p, i) => (
                  <tr key={i}>
                    <td style={td}>{p.plato}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: OSW, fontWeight: 700, color: INK }}>{fmtNumES(p.unidades)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtEur(p.ingresos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ padding: topPlatos.length ? '12px 22px' : '0 22px 16px' }}>
            <button onClick={() => nav('/cocina/menu-engineering')} style={linkBtn}>Abrir Menú Engineering →</button>
          </div>
        </Papel>
      </div>

      <div>
        <SeccionLabel bg={GRANATE}>Regla TP que cruza con estos datos</SeccionLabel>
        <Papel ceja={GRANATE}>
          <Bullet>"Lo más vendido" en la app debe ordenarse por <Dato>MARGEN</Dato>, no por unidades. Cruza este top con el margen de Menú Engineering antes de decidir qué subir.</Bullet>
          <Bullet>Actualizar ese bloque cada <Dato>15 días</Dato> con foto excelente.</Bullet>
        </Papel>
      </div>
    </div>
  )
}

/* ═════════════ CHECKLIST — tácticas con estado persistente ═════════════ */
type Tactica = { clave: string; texto: string; grupo: string }
const TACTICAS: Tactica[] = [
  { clave: 'marca-1fuerte', grupo: 'Marca', texto: 'Priorizar 1 marca fuerte sobre muchas débiles' },
  { clave: 'carta-7030', grupo: 'Carta', texto: 'Estructurar carta 70% fija / 30% estacional' },
  { clave: 'carta-mvp12', grupo: 'Carta', texto: 'Lanzar con MVP de 12 referencias, ampliar por demanda' },
  { clave: 'carta-6y6', grupo: 'Carta', texto: '6 entrantes + 6 principales infalibles' },
  { clave: 'pricing-nohinchar', grupo: 'Pricing', texto: 'No hinchar precios para luego descontar' },
  { clave: 'pricing-nodinamico', grupo: 'Pricing', texto: 'No usar precios dinámicos de fin de semana' },
  { clave: 'rating-organico', grupo: 'Ratings', texto: 'Mejorar base orgánica antes de invertir en ads' },
  { clave: 'rating-responder2h', grupo: 'Ratings', texto: 'Responder reseñas en menos de 2 horas' },
  { clave: 'pack-marca', grupo: 'Packaging', texto: 'Packaging con marca por producto estrella' },
  { clave: 'app-combosprimero', grupo: 'App', texto: 'Combos primero en la app' },
  { clave: 'app-topmargen', grupo: 'App', texto: '"Lo más vendido" por margen, actualizar cada 15 días' },
  { clave: 'promo-rotar', grupo: 'Promos', texto: 'Rotar platos en promo para no quemar ninguno' },
  { clave: 'promo-omnibus', grupo: 'Promos', texto: 'Respetar 30 días entre promos mismo producto (Glovo)' },
  { clave: 'promo-segmentar', grupo: 'Promos', texto: 'Segmentar por nuevo/Prime/todos según semana' },
  { clave: 'claims', grupo: 'Operativa', texto: 'Reclamar incidencias a plataformas (estilo TP Claims)' },
  { clave: 'canal-propio', grupo: 'Operativa', texto: 'Activar canal propio (Cheerfy) cuando haya tracción' },
]

function BloqueChecklist() {
  const [estados, setEstados] = useState<Record<string, Estado>>({})
  const [cargando, setCargando] = useState(true)

  async function cargar() {
    const { data } = await supabase.from(EST_TABLE).select('clave,estado')
    const m: Record<string, Estado> = {}
    for (const r of (data as any[]) || []) m[r.clave] = r.estado as Estado
    setEstados(m)
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  async function avanzar(clave: string) {
    const actual = (estados[clave] || 'pendiente') as Estado
    const next = EST_NEXT[actual]
    setEstados(prev => ({ ...prev, [clave]: next }))
    await supabase.from(EST_TABLE).upsert({ clave, estado: next, updated_at: new Date().toISOString() }, { onConflict: 'clave' })
  }

  const grupos = useMemo(() => Array.from(new Set(TACTICAS.map(t => t.grupo))), [])
  const total = TACTICAS.length
  const aplicadas = TACTICAS.filter(t => estados[t.clave] === 'aplicado').length

  if (cargando) return <Papel ceja={GRIS}><div style={{ color: GRIS, fontFamily: LEX }}>Cargando estado del checklist…</div></Papel>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <SeccionLabel bg={VERDE}>Progreso del checklist</SeccionLabel>
        <Plancha>
          <StatCelda first bg={VERDE} label="Aplicadas" value={`${aplicadas}/${total}`} sub="tácticas TP en marcha" />
          <StatCelda bg={GRANATE} label="Progreso" value={`${Math.round((aplicadas / total) * 100)}%`} sub="del playbook implementado" />
        </Plancha>
      </div>
      <div>
        <SeccionLabel bg={GRANATE}>Tácticas Think Paladar · toca para cambiar estado</SeccionLabel>
        <Papel ceja={GRANATE}>
          <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginBottom: 12 }}>Cada toque avanza: Pendiente → Aplicando → Aplicado → Descartado. Se guarda solo.</div>
          {grupos.map(g => (
            <div key={g} style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: INK, fontWeight: 700, marginBottom: 6 }}>{g}</div>
              {TACTICAS.filter(t => t.grupo === g).map(t => {
                const est = (estados[t.clave] || 'pendiente') as Estado
                return (
                  <div key={t.clave} onClick={() => avanzar(t.clave)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', marginBottom: 5, border: `2px solid ${INK}`, background: BLANCO, cursor: 'pointer' }}>
                    <span style={{ flex: 1, fontFamily: LEX, fontSize: 13.5, color: INK }}>{t.texto}</span>
                    <span style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: BLANCO, background: EST_COLOR[est], padding: '3px 9px', whiteSpace: 'nowrap' }}>{EST_LABEL[est]}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </Papel>
      </div>
    </div>
  )
}

/* ═════════════ RESULTADOS — lee campañas reales del ERP ═════════════ */
type Campana = { nombre: string; marca: string; canal: string; tipo: string; estado: string; fecha_inicio: string; fecha_fin: string; presupuesto: number; resultado_real: number | null; veredicto: string | null; aprendizaje: string | null }
const CANAL_LABEL: Record<string, string> = { uber_eats: 'Uber Eats', glovo: 'Glovo', just_eat: 'Just Eat' }

function BloqueResultados() {
  const nav = useNavigate()
  const [camps, setCamps] = useState<Campana[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('crm_campanas').select('nombre,marca,canal,tipo,estado,fecha_inicio,fecha_fin,presupuesto,resultado_real,veredicto,aprendizaje').order('fecha_inicio', { ascending: false })
      setCamps((data as Campana[]) || [])
      setCargando(false)
    })()
  }, [])

  if (cargando) return <Papel ceja={GRIS}><div style={{ color: GRIS, fontFamily: LEX }}>Cargando campañas reales…</div></Papel>

  const conVeredicto = camps.filter(c => c.veredicto)
  const activas = camps.filter(c => c.estado === 'activa' || c.estado === 'en_curso')
  const planificadas = camps.filter(c => c.estado === 'planificada')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <SeccionLabel bg={GRANATE}>Resumen de campañas</SeccionLabel>
        <Plancha>
          <StatCelda first bg={GRANATE} label="Campañas totales" value={String(camps.length)} sub="en el plan" onClick={() => nav('/clientes/crm')} />
          <StatCelda bg={AMA} color={INK} label="Activas" value={String(activas.length)} sub="ahora mismo" />
          <StatCelda bg={VERDE} label="Con veredicto" value={String(conVeredicto.length)} sub="ya evaluadas" />
        </Plancha>
      </div>

      {conVeredicto.length > 0 && (
        <div>
          <SeccionLabel bg={VERDE}>Qué funcionó (campañas con veredicto)</SeccionLabel>
          <Papel ceja={VERDE} pad="0" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: INK }}><th style={th}>Campaña</th><th style={th}>Canal</th><th style={th}>Veredicto</th><th style={th}>Aprendizaje</th></tr></thead>
              <tbody>
                {conVeredicto.map((c, i) => (
                  <tr key={i}>
                    <td style={td}>{c.nombre}</td>
                    <td style={td}>{CANAL_LABEL[c.canal] || c.canal}</td>
                    <td style={{ ...td, fontWeight: 700, color: INK }}>{c.veredicto}</td>
                    <td style={td}>{c.aprendizaje || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Papel>
        </div>
      )}

      <div>
        <SeccionLabel bg={GRANATE}>Próximas campañas planificadas ({planificadas.length})</SeccionLabel>
        <Papel ceja={GRANATE} pad={planificadas.length ? '0' : undefined} style={{ overflowX: 'auto' }}>
          {planificadas.length === 0 ? (
            <div style={{ color: GRIS, fontSize: 13, fontFamily: LEX, padding: '20px 22px' }}>Sin campañas planificadas.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: INK }}><th style={th}>Campaña</th><th style={th}>Marca</th><th style={th}>Canal</th><th style={{ ...th, textAlign: 'right' }}>Presupuesto</th></tr></thead>
              <tbody>
                {planificadas.slice(0, 12).map((c, i) => (
                  <tr key={i}>
                    <td style={td}>{c.nombre}</td>
                    <td style={td}>{c.marca}</td>
                    <td style={td}>{CANAL_LABEL[c.canal] || c.canal}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtEur(c.presupuesto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ padding: planificadas.length ? '12px 22px' : '0 22px 16px' }}>
            <button onClick={() => nav('/clientes/crm')} style={linkBtn}>Abrir CRM / Campañas →</button>
          </div>
        </Papel>
      </div>

      <div>
        <SeccionLabel bg={GRANATE}>Lo más valioso capturado durante TP</SeccionLabel>
        <Papel ceja={GRANATE}>
          <Bullet>Qué promo funcionó en qué plataforma y con qué segmento — con números reales.</Bullet>
          <Bullet>Qué platos en promo generaron recurrencia (el Flash Deal de Glovo es el experimento clave).</Bullet>
          <Bullet>Rellenar el campo <Dato>veredicto</Dato> y <Dato>aprendizaje</Dato> de cada campaña al cerrarla: ahí queda el conocimiento ahora que TP se ha ido.</Bullet>
        </Papel>
      </div>
    </div>
  )
}

/* ═════════════ METODOLOGÍA ═════════════ */
function BloqueMetodo() {
  return (
    <>
      <Seccion titulo="Quién es Think Paladar">
        <Bullet>Agencia especializada en food delivery, sede en Barcelona.</Bullet>
        <Bullet>Consultora asignada: <Dato>Inés Gallarde</Dato> (Sr. Revenue Manager). Co-Founder: <Dato>Eduard Baviera</Dato>.</Bullet>
        <Bullet>Contrato: <Dato>450€/mes × 4 meses</Dato> (abr–jul 2026), pago por SEPA. Producto: "Delivery+".</Bullet>
        <Bullet>Servicio extra <Dato>TP Claims</Dato>: bot que reclama incidencias a plataformas, recupera ~70% (comisión por éxito).</Bullet>
        <Bullet>KPI del contrato: <Dato>15.000€</Dato> de facturación Binagre para el mes 2.</Bullet>
      </Seccion>
      <Seccion titulo="Fase 0 — Auditoría (pre-contrato)">
        <Bullet>Reunión inicial para entender el negocio: marcas, facturación, portfolio, operativa.</Bullet>
        <Bullet>Piden histórico de ventas en Excel/CSV.</Bullet>
        <Bullet>Análisis: peso por marca, peso por plataforma, ticket medio, tendencia mensual.</Bullet>
        <Bullet>Identifican la marca con mayor potencial de crecimiento.</Bullet>
        <Bullet>Propuesta comercial con fee + extras (fotos ~500€, packaging ~1.000€, ads agresivos 3 meses).</Bullet>
      </Seccion>
      <Seccion titulo="Fase 1 — Kick-off (Mes 1)">
        <Bullet>Presentación con análisis de zona, competencia y oportunidad.</Bullet>
        <Bullet>Decisión de <Dato>1 sola marca</Dato> a priorizar.</Bullet>
        <Bullet>Estudio de tendencias + competidores de la zona.</Bullet>
        <Bullet>Propuesta de menú → iteración → menú definitivo.</Bullet>
        <Bullet>Sesión de fotos. Sub-objetivos. Plan de marketing inicial. Objetivos a 4 meses.</Bullet>
      </Seccion>
      <Seccion titulo="Fase 2 a 4 — Lanzamiento, Optimización y Escala">
        <Bullet><Dato>Mes 2 (Lanzamiento):</Dato> marketing activo, stickers/flyers/bolsas, canal propio (Cheerfy), repaso de 2 marcas más.</Bullet>
        <Bullet><Dato>Mes 3 (Optimización):</Dato> ingeniería de menú sobre ventas reales, foco en operaciones.</Bullet>
        <Bullet><Dato>Mes 4 (Escala):</Dato> balance vs KPIs, nuevos objetivos, decisión de continuidad.</Bullet>
      </Seccion>
    </>
  )
}

/* ═════════════ REGLAS CLAVE ═════════════ */
function BloqueReglas() {
  return (
    <>
      <Seccion titulo="Marca y posicionamiento">
        <Bullet><Dato>1 marca fuerte &gt; muchas débiles.</Dato> El cliente asocia marca = producto concreto. Si no sabe qué esperar, no repite.</Bullet>
        <Bullet>Referencia: <Dato>Honest Greens</Dato>. Sabes qué comerás, cuánto pagarás y cuánto tardará.</Bullet>
        <Bullet>"No gana quien tiene más platos, sino quien es <Dato>top of mind</Dato> en un producto concreto."</Bullet>
      </Seccion>
      <Seccion titulo="Carta y menú">
        <Bullet><Dato>Carta corta, ejecución excelente.</Dato> 6+6 infalibles &gt; 15+15 mediocres.</Bullet>
        <Bullet>Estructura <Dato>70/30</Dato>: 70% fija + 30% rotación estacional.</Bullet>
        <Bullet>Combos primero. MVP de <Dato>12 referencias</Dato>; ampliar por demanda.</Bullet>
        <Bullet>Nombre corto y atractivo. Descripción completa. Inés prefiere <Dato>no usar IA</Dato> para describir.</Bullet>
      </Seccion>
      <Seccion titulo="Pricing">
        <Bullet>Zona óptima: entre kebab (1–8€) y gourmet (20–30€). Binagre = <Dato>9–14€ plato / 12–22€ combo</Dato>.</Bullet>
        <Bullet><Dato>NO hinchar precios</Dato> para luego descontar.</Bullet>
        <Bullet><Dato>NO precios dinámicos</Dato> por fin de semana.</Bullet>
      </Seccion>
      <Seccion titulo="Ratings y packaging">
        <Bullet><Dato>Mejorar base orgánica ANTES de ads.</Dato> Con rating bajo, cada euro convierte menos.</Bullet>
        <Bullet>El problema suele ser <Dato>falta de reseñas</Dato>, no exceso de negativas.</Bullet>
        <Bullet>Responder reseñas en <Dato>&lt;2 horas</Dato>. Flyers + packaging con marca para incentivar reseñas.</Bullet>
      </Seccion>
    </>
  )
}

/* ═════════════ PLAN DE PROMOS ═════════════ */
function BloquePromos() {
  return (
    <>
      <Seccion titulo="Lógica general (mayo–julio 2026)">
        <Bullet>Alternar productos promocionados cada pocos días para no quemar ningún plato.</Bullet>
        <Bullet>Alternar agresividad: 20% → 2x1 → 30% → Flash Deals.</Bullet>
        <Bullet>Publicidad siempre activa. Ads + Promo se combinan.</Bullet>
        <Bullet>Target por semana: nuevos (captar) → Prime (ticket) → todos (volumen).</Bullet>
      </Seccion>
      <Seccion titulo="Glovo">
        <Bullet>Publicidad: <Dato>200€/mes</Dato>, todos los usuarios.</Bullet>
        <Bullet>Promo: 20% → 2x1 → 30%.</Bullet>
        <Bullet><Dato>Flash Deals (clave):</Dato> solo nuevos. El cliente percibe 30% pero el coste real es ~50% (Glovo añade 20%). Buena recurrencia.</Bullet>
      </Seccion>
      <Seccion titulo="Uber Eats">
        <Bullet>Publicidad: de 9€/día a <Dato>5€/día</Dato>.</Bullet>
        <Bullet>Promo: 2x1 nuevos → 2x1 Prime → 30% nuevos → 2x1.</Bullet>
        <Bullet>Ventaja: <Dato>segmentar por tipo de usuario</Dato> sea cual sea la promo.</Bullet>
      </Seccion>
      <Seccion titulo="Just Eat">
        <Bullet><Dato>25% sobre ticket final</Dato>, todos los usuarios. Más simple, sin segmentación.</Bullet>
      </Seccion>
      <div>
        <SeccionLabel bg={GRANATE}>Segmentos de público (definición TP)</SeccionLabel>
        <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: INK }}><th style={th}>Segmento</th><th style={th}>Definición</th></tr></thead>
            <tbody>
              <tr><td style={td}><Dato>Nuevos</Dato></td><td style={td}>Nunca ha pedido en tu negocio</td></tr>
              <tr><td style={td}><Dato>Recurrentes</Dato></td><td style={td}>Ha pedido en los últimos 6 meses</td></tr>
              <tr><td style={td}><Dato>Inactivos</Dato></td><td style={td}>No pide desde hace más de 45 días</td></tr>
              <tr><td style={td}><Dato>Prime</Dato></td><td style={td}>Suscrito a envíos premium (Uber One)</td></tr>
            </tbody>
          </table>
        </Papel>
      </div>
    </>
  )
}

/* ═════════════ PLATAFORMAS ═════════════ */
function BloquePlataformas() {
  return (
    <>
      <Seccion titulo="Categorías y estructura de carta en app">
        <Bullet>Categorías: Glovo se piden a Glovo; Uber y JE por correo. El integrador NO las gestiona.</Bullet>
        <Bullet>Orden en app: 1) Lo más vendido (top 3 por <Dato>MARGEN</Dato>, foto excelente, cada 15 días) · 2) Combos · 3) Entrantes · 4) Principales · 5) Postres.</Bullet>
      </Seccion>
      <Seccion titulo="Portadas">
        <Bullet>Inés solicita los cambios a cada plataforma cuando tiene los archivos.</Bullet>
        <Bullet>Portada ideal: <Dato>fondo claro</Dato>, logo centrado, platos grandes arriba y abajo. Evitar fondo rojo.</Bullet>
      </Seccion>
      <Seccion titulo="Ley Ómnibus">
        <Bullet>Glovo: esperar <Dato>30 días</Dato> para repetir descuento en el mismo producto.</Bullet>
        <Bullet>El <Dato>2x1</Dato> no cuenta como descuento de % → evita Ómnibus.</Bullet>
      </Seccion>
      <div>
        <SeccionLabel bg={GRANATE}>Contactos account managers</SeccionLabel>
        <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: INK }}><th style={th}>Plataforma</th><th style={th}>Contacto</th></tr></thead>
            <tbody>
              <tr><td style={td}>Glovo</td><td style={td}>pilar.gonzalez@glovoapp.com</td></tr>
              <tr><td style={td}>Just Eat</td><td style={td}>claudia.abad@justeattakeaway.com · Tamara (config)</td></tr>
              <tr><td style={td}>Uber Eats</td><td style={td}>alvar.noguera@uber.com</td></tr>
            </tbody>
          </table>
        </Papel>
      </div>
    </>
  )
}

/* ═════════════ CRONOLOGÍA ═════════════ */
function BloqueCronologia() {
  const filas: [string, string][] = [
    ['4 mar', 'Primera reunión. Rubén envía facturación y portfolio'],
    ['12–17 mar', 'Presupuesto 600€/mes. Negociación: es para 1 marca'],
    ['23–24 mar', 'Cierre 450€/mes × 4 meses. Datos para contrato + SEPA'],
    ['1 abr', 'KICK-OFF. Decisión: arrancar con marca española'],
    ['6 abr', 'Manifiesto Binagre. Feedback: foco guisos, carta 70/30, max 6+6'],
    ['8–10 abr', 'Marcas españolas + contactos plataformas + PuntoQpack'],
    ['14–17 abr', 'Iteración de menú entre SL e Inés'],
    ['21–22 abr', 'Pricing: NO precios dinámicos, NO hinchar precios'],
    ['28 abr', 'Aplazado lanzamiento del 4 al 11 mayo (cocinero nuevo)'],
    ['29 abr–7 may', 'Portadas/logos validados y enviados a plataformas'],
    ['12 may', 'Arranque fijado 16 may. Promos arrancan con 2x1'],
    ['13 may', 'Retraso: fotógrafa lesionada + cocinero deja el puesto'],
    ['21 may', 'Inés envía Plan de Marketing completo (promos may–jul)'],
    ['22 may', 'Ajuste de portada: fondo claro en vez de rojo'],
    ['jun', 'Mes operando con TP. Binagre (Glovo+Uber): 1.527,60€ · 44 pedidos · ticket 34,72€'],
    ['30 jun', 'FIN de la colaboración con Think Paladar. Streat Lab pasa a operar el delivery por su cuenta'],
  ]
  return (
    <div>
      <SeccionLabel bg={GRANATE}>Línea temporal de la colaboración</SeccionLabel>
      <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: INK }}><th style={{ ...th, width: 120 }}>Fecha</th><th style={th}>Hito</th></tr></thead>
          <tbody>
            {filas.map(([f, h], i) => (
              <tr key={i}>
                <td style={{ ...td, fontFamily: OSW, color: GRANATE, fontWeight: 700, whiteSpace: 'nowrap' }}>{f}</td>
                <td style={td}>{h}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Papel>
    </div>
  )
}

/* ═════════════ HACERLO SOLOS ═════════════ */
function BloqueSolos() {
  return (
    <>
      <Seccion titulo="Cierre TP · datos finales del portal (jun 2026)">
        <Bullet>Relación <Dato>finalizada el 30 jun 2026</Dato>. Perdemos acceso a su portal → estas métricas se internalizan en el ERP.</Bullet>
        <Bullet>Mes jun (Binagre, Glovo+Uber): <Dato>1.527,60€</Dato> · 44 pedidos · ticket <Dato>34,72€</Dato>. Inversión ads 175€ + promo 262€.</Bullet>
        <Bullet>Salud de cliente: <Dato>12,5% fidelizado</Dato> · 58,3% dependiente de promo · 29,2% natural. Clientes frecuentes: <Dato>0</Dato>.</Bullet>
        <Bullet>Promos rinden (ROI ~6,8x) pero <Dato>Uber Ads no convirtió</Dato> (ROAS 0). Glovo es el motor del volumen.</Bullet>
      </Seccion>
      <Seccion titulo="Dónde vive ahora cada métrica del portal (dentro del ERP)">
        <Bullet>Ventas · pedidos · ticket por canal y marca → <Dato>Finanzas › Ventas</Dato> + <Dato>Analytics › Revenue</Dato>.</Bullet>
        <Bullet>Inversión ads/promo · ROI · % orgánica · ROAS · CPC → <Dato>Marketing › Plan de campañas</Dato> + bloque Resultados de este Playbook.</Bullet>
        <Bullet>Segmentación y salud de cliente (nuevo/recurrente, fidelizado/dependiente) → <Dato>Clientes › CRM</Dato>.</Bullet>
        <Bullet>Rating por plataforma → <Dato>Clientes › Reseñas</Dato>. Tiempo de entrega y aceptación → <Dato>Operativa</Dato>.</Bullet>
      </Seccion>
      <Seccion titulo="Lo que TP no hace (y necesitamos cubrir)">
        <Bullet>Diseño de marca / imagen (lo hace Marcos por nuestra cuenta).</Bullet>
        <Bullet>Precios dinámicos · gestión de integradores · community manager.</Bullet>
        <Bullet>Escandallo y pricing desde el coste (ellos trabajan con márgenes estimados).</Bullet>
      </Seccion>
      <Seccion titulo="Las 12 claves para operar solos">
        <Bullet><Dato>1.</Dato> Auditoría propia cada trimestre: ventas por marca, peso, ticket, tendencia.</Bullet>
        <Bullet><Dato>2.</Dato> Estudio de competencia en apps: ratings, reseñas, fotos, carta del top 10.</Bullet>
        <Bullet><Dato>3.</Dato> Carta MVP → validar → ampliar.</Bullet>
        <Bullet><Dato>4.</Dato> Plan de promos semanal alternando 2x1, %, combo. Respetar Ómnibus.</Bullet>
        <Bullet><Dato>5.</Dato> Fotos profesionales innegociables.</Bullet>
        <Bullet><Dato>6.</Dato> Packaging diferenciado por producto estrella.</Bullet>
        <Bullet><Dato>7.</Dato> Responder reseñas en &lt;2h.</Bullet>
        <Bullet><Dato>8.</Dato> En la app: combos primero, luego top por margen, luego categorías.</Bullet>
        <Bullet><Dato>9.</Dato> Actualizar "Lo más vendido" cada 15 días con top 3 por margen.</Bullet>
        <Bullet><Dato>10.</Dato> Reclamaciones a plataformas: recuperar ~70% de incidencias.</Bullet>
        <Bullet><Dato>11.</Dato> Cheerfy o similar para canal propio cuando haya tracción.</Bullet>
        <Bullet><Dato>12.</Dato> Ingeniería de menú con datos reales cada 2 semanas.</Bullet>
      </Seccion>
    </>
  )
}
