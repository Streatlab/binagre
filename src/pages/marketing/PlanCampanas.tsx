import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, CARDS, lbl, lblSm, kpiMid } from '@/components/panel/resumen/tokens'
import { fmtEur, fmtNumES } from '@/utils/format'

/* ═════════════ PLAN DE CAMPAÑAS — Ads & Promos Jul-Dic 2026 ═════════════
   Módulo Marketing. Lee las campañas del plan (codigo_promo PLAN-*) de crm_campanas.
   Solo lectura: la edición y registro de métricas vive en CRM Streat Lab (/clientes/crm).
   Tokens canónicos Binagre.
*/

type Campana = {
  id: number; nombre: string; marca: string | null; producto: string | null; canal: string; tipo: string
  mecanica_plataforma: string | null; objetivo_smart: string; kpi_principal: string; kpi_meta: number | null
  codigo_promo: string | null; mecanica: string | null; fecha_inicio: string; fecha_fin: string | null
  presupuesto: number; estado: string
}

const CANAL_LABEL: Record<string, string> = { uber_eats: 'Uber Eats', glovo: 'Glovo', just_eat: 'Just Eat', web: 'Web propia' }
const CANAL_COLOR: Record<string, string> = { uber_eats: COLORS.uber, glovo: COLORS.glovo, just_eat: COLORS.je, web: COLORS.web }
const CANAL_TXT: Record<string, string> = { glovo: COLORS.glovoText }
const MEC_LABEL: Record<string, string> = { '2x1_bogo': '2x1 (BOGO)', descuento_item: '% descuento', pct_pedido: 'Gasta más ahorra más', nuevo_usuario: 'Artículo gratis', envio_gratis: 'Envío gratis', sellos: 'Sellos', ads_posicion: 'Ads / posición' }
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const th: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLORS.mut, fontWeight: 500, padding: '8px 10px', textAlign: 'left', borderBottom: `1px solid ${COLORS.brd}` }
const td: React.CSSProperties = { fontFamily: FONT.body, fontSize: 13, color: COLORS.sec, padding: '8px 10px', borderBottom: `1px solid ${COLORS.group}` }

function Pill({ text, bg, txt }: { text: string; bg: string; txt?: string }) {
  return <span style={{ fontSize: 10, fontFamily: FONT.heading, letterSpacing: '0.5px', padding: '2px 8px', borderRadius: 4, background: bg, color: txt ?? '#fff', textTransform: 'uppercase' }}>{text}</span>
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ ...CARDS.std, flex: 1, minWidth: 160 }}>
      <div style={lbl}>{label}</div>
      <div style={{ ...kpiMid, marginTop: 6, color: color ?? COLORS.pri }}>{value}</div>
      {sub && <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function PlanCampanas() {
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [cargando, setCargando] = useState(true)
  const [canalSel, setCanalSel] = useState('todos')

  useEffect(() => {
    (async () => {
      setCargando(true)
      const { data } = await supabase.from('crm_campanas').select('*').like('codigo_promo', 'PLAN-%').order('fecha_inicio', { ascending: true })
      setCampanas((data as Campana[]) || [])
      setCargando(false)
    })()
  }, [])

  const porCanal = useMemo(() => {
    const m: Record<string, { n: number; eur: number }> = {}
    for (const c of campanas) {
      if (!m[c.canal]) m[c.canal] = { n: 0, eur: 0 }
      m[c.canal].n += 1; m[c.canal].eur += Number(c.presupuesto) || 0
    }
    return m
  }, [campanas])

  const presupuestoTotal = campanas.reduce((s, c) => s + (Number(c.presupuesto) || 0), 0)
  const marcas = new Set(campanas.map(c => c.marca).filter(Boolean)).size
  const lista = campanas.filter(c => canalSel === 'todos' || c.canal === canalSel)

  // Cronograma
  const fechas = campanas.flatMap(c => [c.fecha_inicio, c.fecha_fin].filter(Boolean) as string[])
  const min = fechas.length ? fechas.reduce((a, b) => (a < b ? a : b)) : '2026-07-01'
  const max = fechas.length ? fechas.reduce((a, b) => (a > b ? a : b)) : '2026-12-31'
  const minD = new Date(min + 'T00:00:00'), maxD = new Date(max + 'T00:00:00')
  const totalMs = Math.max(1, maxD.getTime() - minD.getTime())
  const pos = (d: string) => ((new Date(d + 'T00:00:00').getTime() - minD.getTime()) / totalMs) * 100
  const meses: { label: string; left: number }[] = []
  const cur = new Date(minD.getFullYear(), minD.getMonth(), 1)
  while (cur <= maxD) {
    meses.push({ label: `${MESES[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`, left: Math.max(0, ((cur.getTime() - minD.getTime()) / totalMs) * 100) })
    cur.setMonth(cur.getMonth() + 1)
  }

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', padding: '24px 28px', fontFamily: FONT.body, color: COLORS.pri }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: COLORS.redSL, letterSpacing: 3, textTransform: 'uppercase' }}>Plan de Campañas</div>
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut, marginTop: 2 }}>Ads & Promos · julio – diciembre 2026 · Uber Eats · Glovo · Just Eat. Meta semestre: +70% facturación, +40% beneficio, ×3 nuevos clientes, recompra 35%.</div>
      </div>

      {cargando ? (
        <div style={{ color: COLORS.mut, fontSize: 14, padding: 24 }}>Cargando plan...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* KPIs */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <KpiCard label="Campañas del plan" value={String(campanas.length)} sub={`${marcas} marcas`} color={COLORS.redSL} />
            <KpiCard label="Presupuesto total" value={fmtEur(presupuestoTotal)} sub="6 meses (ads + promos)" />
            <KpiCard label="Uber Eats" value={fmtEur(porCanal.uber_eats?.eur || 0)} sub={`${porCanal.uber_eats?.n || 0} campañas`} color={COLORS.uber} />
            <KpiCard label="Just Eat" value={fmtEur(porCanal.just_eat?.eur || 0)} sub={`${porCanal.just_eat?.n || 0} campañas`} color={COLORS.je} />
            <KpiCard label="Glovo" value={fmtEur(porCanal.glovo?.eur || 0)} sub={`${porCanal.glovo?.n || 0} campañas`} color={COLORS.glovoText || COLORS.glovo} />
          </div>

          {/* Filtro canal */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['todos', 'uber_eats', 'just_eat', 'glovo'].map(c => (
              <button key={c} onClick={() => setCanalSel(c)} style={{ padding: '4px 12px', borderRadius: 6, border: `0.5px solid ${canalSel === c ? COLORS.accent : COLORS.brd}`, background: 'transparent', color: canalSel === c ? COLORS.accent : COLORS.sec, cursor: 'pointer', fontSize: 12, fontFamily: FONT.body, fontWeight: canalSel === c ? 600 : 400 }}>
                {c === 'todos' ? 'Todos' : CANAL_LABEL[c]}
              </button>
            ))}
          </div>

          {/* Cronograma */}
          <div style={CARDS.big}>
            <div style={{ ...lbl, marginBottom: 12 }}>Cronograma del semestre</div>
            <div style={{ position: 'relative', height: 18, marginLeft: 210, marginBottom: 6 }}>
              {meses.map((m, i) => (
                <span key={i} style={{ position: 'absolute', left: `${m.left}%`, fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: COLORS.mut }}>{m.label}</span>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lista.map(c => {
                const x1 = pos(c.fecha_inicio), x2 = c.fecha_fin ? pos(c.fecha_fin) : x1 + 4
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 200, flexShrink: 0, fontFamily: FONT.body, fontSize: 12, color: COLORS.sec, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ color: CANAL_TXT[c.canal] || CANAL_COLOR[c.canal], fontWeight: 600 }}>{c.marca || 'Multi'}</span> <span style={{ color: COLORS.mut }}>· {c.producto || c.tipo}</span>
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: 22, background: COLORS.group, borderRadius: 6 }}>
                      <div style={{ position: 'absolute', left: `${x1}%`, width: `${Math.max(4, x2 - x1)}%`, top: 2, bottom: 2, background: CANAL_COLOR[c.canal] || COLORS.mut, borderRadius: 5, display: 'flex', alignItems: 'center', paddingLeft: 8, overflow: 'hidden' }}>
                        <span style={{ fontFamily: FONT.heading, fontSize: 9, color: CANAL_TXT[c.canal] || '#fff', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{MEC_LABEL[c.mecanica_plataforma || ''] || c.tipo}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tabla detalle */}
          <div style={CARDS.std}>
            <div style={{ ...lbl, marginBottom: 12 }}>Detalle de campañas</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}>Campaña</th><th style={th}>Producto</th><th style={th}>Plataforma</th><th style={th}>Mecánica</th><th style={th}>Duración</th><th style={th}>Objetivo</th><th style={{ ...th, textAlign: 'right' }}>Presupuesto</th>
                </tr></thead>
                <tbody>
                  {lista.map(c => (
                    <tr key={c.id}>
                      <td style={td}>
                        <div style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600, color: COLORS.pri }}>{c.nombre}</div>
                        <div style={{ fontSize: 11, color: COLORS.mut }}>{c.marca || 'Multi'}{c.codigo_promo ? ` · ${c.codigo_promo}` : ''}</div>
                      </td>
                      <td style={td}>{c.producto || '—'}</td>
                      <td style={td}><Pill text={CANAL_LABEL[c.canal] || c.canal} bg={CANAL_COLOR[c.canal] || COLORS.mut} txt={CANAL_TXT[c.canal]} /></td>
                      <td style={td}>{MEC_LABEL[c.mecanica_plataforma || ''] || '—'}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{c.fecha_inicio.slice(5)} → {c.fecha_fin ? c.fecha_fin.slice(5) : '—'}</td>
                      <td style={{ ...td, maxWidth: 300, fontSize: 12 }}>{c.objetivo_smart}<div style={{ color: COLORS.mut, fontSize: 11, marginTop: 2 }}>{c.mecanica}</div></td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: FONT.heading, color: COLORS.pri }}>{fmtEur(Number(c.presupuesto))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ ...lblSm, marginTop: 12, color: COLORS.mut }}>El registro de métricas y el cambio de estado de cada campaña se gestionan en CRM Streat Lab → Campañas.</div>
          </div>
        </div>
      )}
    </div>
  )
}
