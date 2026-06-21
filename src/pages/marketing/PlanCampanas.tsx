import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, CARDS, lbl, lblSm, kpiMid } from '@/components/panel/resumen/tokens'
import { fmtEur, fmtNumES } from '@/utils/format'

/* ═════════════ PLAN ADS & PROMOS · Jul–Dic 2026 ═════════════
   Lectura directa de crm_campanas filtrada por codigo_promo LIKE 'PLAN-%'.
   Vista de solo lectura del Plan Maestro: KPIs, reparto por canal/marca y cronograma.
   La gestión operativa (estado, métricas, cierre) vive en CRM Streat Lab (/clientes/crm).
*/

type Campana = {
  id: number; nombre: string; marca: string | null; producto: string | null
  canal: string; tipo: string; objetivo_smart: string; kpi_principal: string
  kpi_meta: number | null; codigo_promo: string | null; mecanica: string | null
  mecanica_plataforma: string | null; fecha_inicio: string; fecha_fin: string | null
  presupuesto: number; estado: string
}

const CANAL_LABEL: Record<string, string> = { uber_eats: 'Uber Eats', glovo: 'Glovo', just_eat: 'Just Eat', web: 'Web propia' }
const CANAL_COLOR: Record<string, string> = { uber_eats: COLORS.uber, glovo: COLORS.glovo, just_eat: COLORS.je, web: COLORS.web }
const CANAL_TXT: Record<string, string> = { glovo: COLORS.glovoText }
const MECANICA_LABEL: Record<string, string> = { '2x1_bogo': '2x1 (BOGO)', descuento_item: '% descuento', pct_pedido: 'Gasta más ahorra más', nuevo_usuario: 'Artículo gratis', envio_gratis: 'Envío gratis', ads_posicion: 'Ads / posición' }
const ESTADO_COLOR: Record<string, string> = { planificada: COLORS.mut, borrador: COLORS.mut, activa: COLORS.ok, pausada: COLORS.warn, cerrada: COLORS.err }
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const th: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLORS.mut, fontWeight: 500, padding: '8px 10px', textAlign: 'left', borderBottom: `1px solid ${COLORS.brd}` }
const td: React.CSSProperties = { fontFamily: FONT.body, fontSize: 13, color: COLORS.sec, padding: '8px 10px', borderBottom: `1px solid ${COLORS.group}` }

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

export default function PlanCampanas() {
  const [camp, setCamp] = useState<Campana[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    (async () => {
      setCargando(true)
      const { data } = await supabase.from('crm_campanas').select('*').like('codigo_promo', 'PLAN-%').order('fecha_inicio')
      setCamp((data as Campana[]) || [])
      setCargando(false)
    })()
  }, [])

  const presupuestoTotal = useMemo(() => camp.reduce((s, c) => s + Number(c.presupuesto || 0), 0), [camp])
  const porCanal = useMemo(() => {
    const m: Record<string, { n: number; eur: number }> = {}
    camp.forEach(c => { if (!m[c.canal]) m[c.canal] = { n: 0, eur: 0 }; m[c.canal].n++; m[c.canal].eur += Number(c.presupuesto || 0) })
    return m
  }, [camp])
  const marcas = useMemo(() => Array.from(new Set(camp.map(c => c.marca).filter(Boolean))) as string[], [camp])

  // cronograma
  const fechas = camp.flatMap(c => [c.fecha_inicio, c.fecha_fin].filter(Boolean) as string[])
  const min = fechas.length ? fechas.reduce((a, b) => (a < b ? a : b)) : ''
  const max = fechas.length ? fechas.reduce((a, b) => (a > b ? a : b)) : ''
  const minD = min ? new Date(min + 'T00:00:00') : new Date()
  const maxD = max ? new Date(max + 'T00:00:00') : new Date()
  const totalMs = Math.max(1, maxD.getTime() - minD.getTime())
  const pos = (d: string) => ((new Date(d + 'T00:00:00').getTime() - minD.getTime()) / totalMs) * 100
  const meses: { label: string; left: number }[] = []
  if (min) {
    const cur = new Date(minD.getFullYear(), minD.getMonth(), 1)
    while (cur <= maxD) { meses.push({ label: `${MESES[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`, left: Math.max(0, ((cur.getTime() - minD.getTime()) / totalMs) * 100) }); cur.setMonth(cur.getMonth() + 1) }
  }

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', padding: '24px 28px', fontFamily: FONT.body, color: COLORS.pri }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: COLORS.redSL, letterSpacing: 3, textTransform: 'uppercase' }}>Plan Ads &amp; Promos · Jul–Dic 2026</div>
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut, marginTop: 2 }}>24 campañas Uber Eats · Glovo · Just Eat. Gestión operativa en CRM Streat Lab.</div>
      </div>

      {cargando ? (
        <div style={{ color: COLORS.mut, fontSize: 14, padding: 24 }}>Cargando plan...</div>
      ) : camp.length === 0 ? (
        <div style={{ ...CARDS.std, color: COLORS.mut }}>No hay campañas del plan cargadas (codigo_promo PLAN-*).</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* KPIs */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <KpiCard label="Campañas" value={String(camp.length)} sub={`${marcas.length} marcas`} color={COLORS.redSL} />
            <KpiCard label="Presupuesto total" value={fmtEur(presupuestoTotal)} sub="semestre" color={COLORS.ok} />
            {Object.entries(porCanal).map(([c, v]) => (
              <KpiCard key={c} label={CANAL_LABEL[c] || c} value={fmtEur(v.eur)} sub={`${v.n} campañas`} color={CANAL_TXT[c] || CANAL_COLOR[c]} />
            ))}
          </div>

          {/* Cronograma */}
          <div style={CARDS.big}>
            <div style={{ ...lbl, marginBottom: 12 }}>Cronograma del plan</div>
            <div style={{ position: 'relative', height: 18, marginLeft: 210, marginBottom: 6 }}>
              {meses.map((m, i) => (
                <span key={i} style={{ position: 'absolute', left: `${m.left}%`, fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: COLORS.mut }}>{m.label}</span>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {camp.map(c => {
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

          {/* Tabla detalle */}
          <div style={CARDS.std}>
            <div style={{ ...lblSm, marginBottom: 12 }}>Detalle de campañas</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}>Campaña</th><th style={th}>Marca</th><th style={th}>Canal</th><th style={th}>Mecánica</th><th style={th}>Duración</th><th style={th}>Objetivo</th><th style={{ ...th, textAlign: 'right' }}>Presupuesto</th><th style={th}>Estado</th>
                </tr></thead>
                <tbody>
                  {camp.map(c => (
                    <tr key={c.id}>
                      <td style={td}>
                        <div style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600, color: COLORS.pri }}>{c.nombre}</div>
                        {c.codigo_promo && <div style={{ fontSize: 11, color: COLORS.mut }}>{c.codigo_promo}</div>}
                      </td>
                      <td style={td}>{c.marca || 'Multi'}</td>
                      <td style={td}><Pill text={CANAL_LABEL[c.canal] || c.canal} bg={CANAL_COLOR[c.canal] || COLORS.mut} txt={CANAL_TXT[c.canal]} /></td>
                      <td style={td}>{MECANICA_LABEL[c.mecanica_plataforma || ''] || '—'}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{c.fecha_inicio.slice(5)} → {c.fecha_fin ? c.fecha_fin.slice(5) : '—'}</td>
                      <td style={{ ...td, maxWidth: 260, fontSize: 12 }}>{c.objetivo_smart}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: FONT.heading, color: COLORS.pri }}>{fmtEur(Number(c.presupuesto))}</td>
                      <td style={td}><span style={{ color: ESTADO_COLOR[c.estado] || COLORS.mut, fontFamily: FONT.heading, fontSize: 11, textTransform: 'uppercase' }}>{c.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
