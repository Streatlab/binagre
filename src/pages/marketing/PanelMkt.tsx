import { AMA, BLANCO, GRANATE, GRIS, INK, NAR_S, VERDE } from '@/styles/neobrutal'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'

// ── Panel MKT · hub del módulo de marketing ──
// Lee datos reales: reseñas, campañas, rendimiento ads/promo, club, playbook TP, benchmark.

const CREMA = NAR_S
interface ResenaRow { plataforma: string; rating: number | null; num_resenas: number | null; fecha: string }
interface CampanaRow { id: number; nombre: string; canal: string | null; estado: string | null; fecha_inicio: string | null; fecha_fin: string | null; veredicto: string | null; resultado_real: number | null; kpi_meta: number | null }
interface RendRow { canal: string | null; periodo_fin: string | null; ventas: number | null; roi_promo: number | null; roas: number | null; pct_fidelizado: number | null }
interface PlaybookRow { estado: string | null }

const fmtEur = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

const card: React.CSSProperties = {
  background: BLANCO,
  border: `3px solid ${INK}`,
  boxShadow: `3px 3px 0 ${INK}`,
  padding: '16px 18px',
}

const kpiNum: React.CSSProperties = {
  fontFamily: FONT.heading,
  fontWeight: 800,
  fontSize: 40,
  lineHeight: 1,
  color: INK,
}

const kpiLabel: React.CSSProperties = {
  fontFamily: FONT.heading,
  fontWeight: 700,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: GRIS,
  marginBottom: 8,
}

const linkStyle: React.CSSProperties = {
  fontFamily: FONT.heading,
  fontWeight: 800,
  fontSize: 12,
  textTransform: 'uppercase',
  color: GRANATE,
  textDecoration: 'none',
  borderBottom: `2px solid ${GRANATE}`,
  marginTop: 10,
  display: 'inline-block',
}

export default function PanelMkt() {
  const [resenas, setResenas] = useState<ResenaRow[]>([])
  const [campanas, setCampanas] = useState<CampanaRow[]>([])
  const [rend, setRend] = useState<RendRow[]>([])
  const [playbook, setPlaybook] = useState<PlaybookRow[]>([])
  const [socios, setSocios] = useState(0)
  const [competidores, setCompetidores] = useState(0)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const [r1, r2, r3, r4, r5, r6] = await Promise.all([
        supabase.from('crm_resenas_registro').select('plataforma, rating, num_resenas, fecha').order('fecha', { ascending: false }).limit(60),
        supabase.from('crm_campanas').select('id, nombre, canal, estado, fecha_inicio, fecha_fin, veredicto, resultado_real, kpi_meta').order('fecha_inicio', { ascending: false }).limit(50),
        supabase.from('mkt_rendimiento_ads_promo').select('canal, periodo_fin, ventas, roi_promo, roas, pct_fidelizado').order('periodo_fin', { ascending: false }).limit(12),
        supabase.from('mkt_playbook_tp_estado').select('estado'),
        supabase.from('crm_club_socios').select('id', { count: 'exact', head: true }),
        supabase.from('mkt_benchmark_competidores').select('id', { count: 'exact', head: true }),
      ])
      setResenas((r1.data as ResenaRow[]) ?? [])
      setCampanas((r2.data as CampanaRow[]) ?? [])
      setRend((r3.data as RendRow[]) ?? [])
      setPlaybook((r4.data as PlaybookRow[]) ?? [])
      setSocios(r5.count ?? 0)
      setCompetidores(r6.count ?? 0)
      setCargando(false)
    }
    cargar()
  }, [])

  // Última nota por plataforma
  const notaPorPlataforma: Record<string, ResenaRow> = {}
  for (const r of resenas) {
    const key = r.plataforma ?? '—'
    if (!notaPorPlataforma[key]) notaPorPlataforma[key] = r
  }
  const plataformas = Object.entries(notaPorPlataforma)
  const notaMedia = plataformas.length
    ? plataformas.reduce((acc, [, r]) => acc + (Number(r.rating) || 0), 0) / plataformas.length
    : null

  const hoy = new Date().toISOString().slice(0, 10)
  const activas = campanas.filter(c => {
    const enFechas = (!c.fecha_inicio || c.fecha_inicio <= hoy) && (!c.fecha_fin || c.fecha_fin >= hoy)
    const estadoActivo = (c.estado ?? '').toLowerCase().includes('activ') || (c.estado ?? '').toLowerCase().includes('curso')
    return estadoActivo || (enFechas && !(c.estado ?? '').toLowerCase().includes('cerr') && !(c.estado ?? '').toLowerCase().includes('final'))
  })
  const conVeredicto = campanas.filter(c => c.veredicto && c.veredicto.trim() !== '')
  const sinVeredictoCerradas = campanas.filter(c => c.fecha_fin && c.fecha_fin < hoy && (!c.veredicto || c.veredicto.trim() === ''))

  const ultimoRend = rend[0]
  const tacticasAplicadas = playbook.filter(p => (p.estado ?? '').toLowerCase().includes('aplicado')).length
  const tacticasEnCurso = playbook.filter(p => (p.estado ?? '').toLowerCase().includes('aplicando')).length

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200 }}>
      {/* Hero */}
      <div style={{ background: AMA, border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, padding: '18px 22px', marginBottom: 24 }}>
        <h1 style={{ fontFamily: FONT.heading, fontWeight: 800, fontSize: 28, textTransform: 'uppercase', letterSpacing: '0.02em', color: INK, margin: 0 }}>
          Panel MKT
        </h1>
        <p style={{ fontFamily: FONT.body, fontSize: 14, color: INK, margin: '6px 0 0' }}>
          Estado real del marketing: reseñas, campañas, rendimiento y fidelización en un vistazo.
        </p>
      </div>

      {cargando ? (
        <div style={{ fontFamily: FONT.body, color: GRIS }}>Cargando datos…</div>
      ) : (
        <>
          {/* Fila KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 18, marginBottom: 24 }}>
            <div style={card}>
              <div style={kpiLabel}>⭐ Nota media plataformas</div>
              <div style={kpiNum}>{notaMedia != null ? notaMedia.toFixed(2) : '—'}</div>
              <div style={{ fontFamily: FONT.body, fontSize: 12, color: GRIS, marginTop: 8 }}>
                {plataformas.map(([p, r]) => `${p}: ${r.rating ?? '—'}`).join(' · ') || 'Sin registros'}
              </div>
              <Link to="/clientes/resenas" style={linkStyle}>Panel Reseñas →</Link>
            </div>

            <div style={card}>
              <div style={kpiLabel}>📣 Campañas activas</div>
              <div style={kpiNum}>{activas.length}</div>
              <div style={{ fontFamily: FONT.body, fontSize: 12, color: GRIS, marginTop: 8 }}>
                {campanas.length} totales · {conVeredicto.length} con veredicto
              </div>
              <Link to="/marketing/plan" style={linkStyle}>Plan Campañas →</Link>
            </div>

            <div style={card}>
              <div style={kpiLabel}>📈 Último ROI promo</div>
              <div style={kpiNum}>{ultimoRend?.roi_promo != null ? `${Number(ultimoRend.roi_promo).toFixed(1)}x` : '—'}</div>
              <div style={{ fontFamily: FONT.body, fontSize: 12, color: GRIS, marginTop: 8 }}>
                {ultimoRend ? `${ultimoRend.canal ?? '—'} · ventas ${fmtEur(ultimoRend.ventas)} · ROAS ${ultimoRend.roas ?? '—'}` : 'Sin datos de rendimiento'}
              </div>
              <Link to="/marketing/rendimiento-ads-promo" style={linkStyle}>Rendimiento →</Link>
            </div>

            <div style={card}>
              <div style={kpiLabel}>🎖️ Socios club</div>
              <div style={kpiNum}>{socios}</div>
              <div style={{ fontFamily: FONT.body, fontSize: 12, color: GRIS, marginTop: 8 }}>
                Fidelización canal propio
              </div>
              <Link to="/clientes/club" style={linkStyle}>Club →</Link>
            </div>
          </div>

          {/* Fila 2: alertas + playbook + benchmark */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
            {/* Alertas accionables */}
            <div style={{ ...card, borderColor: sinVeredictoCerradas.length ? GRANATE : INK }}>
              <div style={{ ...kpiLabel, color: sinVeredictoCerradas.length ? GRANATE : GRIS }}>🔔 Acción pendiente</div>
              {sinVeredictoCerradas.length ? (
                <>
                  <div style={{ fontFamily: FONT.heading, fontWeight: 800, fontSize: 16, color: INK, marginBottom: 6 }}>
                    {sinVeredictoCerradas.length} campañas cerradas sin veredicto
                  </div>
                  <ul style={{ fontFamily: FONT.body, fontSize: 13, color: GRIS, margin: 0, paddingLeft: 18 }}>
                    {sinVeredictoCerradas.slice(0, 5).map(c => (
                      <li key={c.id}>{c.nombre} ({c.canal ?? '—'})</li>
                    ))}
                  </ul>
                  <div style={{ fontFamily: FONT.body, fontSize: 12, color: GRIS, marginTop: 8 }}>
                    Sin veredicto no hay aprendizaje: apúntalo en Plan Campañas.
                  </div>
                </>
              ) : (
                <div style={{ fontFamily: FONT.body, fontSize: 13, color: VERDE, fontWeight: 700 }}>
                  ✓ Todas las campañas cerradas tienen veredicto
                </div>
              )}
            </div>

            {/* Playbook TP */}
            <div style={card}>
              <div style={kpiLabel}>📘 Playbook Think Paladar</div>
              <div style={{ fontFamily: FONT.heading, fontWeight: 800, fontSize: 22, color: INK }}>
                {tacticasAplicadas} aplicadas · {tacticasEnCurso} en curso
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 12, color: GRIS, marginTop: 8 }}>
                {playbook.length === 0 ? 'Ninguna táctica marcada aún — empieza por las de mayor impacto.' : `${playbook.length} tácticas con estado registrado.`}
              </div>
              <Link to="/clientes/playbook-tp" style={linkStyle}>Abrir Playbook →</Link>
            </div>

            {/* Benchmark */}
            <div style={card}>
              <div style={kpiLabel}>🎯 Benchmark competencia</div>
              <div style={{ fontFamily: FONT.heading, fontWeight: 800, fontSize: 22, color: INK }}>
                {competidores} competidores mapeados
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 12, color: GRIS, marginTop: 8 }}>
                Manual, plan 90 días y carta maestra de 68 platos.
              </div>
              <Link to="/clientes/benchmark" style={linkStyle}>Abrir Benchmark →</Link>
            </div>
          </div>

          {/* Últimas campañas con veredicto */}
          <div style={{ ...card, marginTop: 24, background: CREMA }}>
            <div style={kpiLabel}>🧠 Últimos aprendizajes de campañas</div>
            {conVeredicto.length === 0 ? (
              <div style={{ fontFamily: FONT.body, fontSize: 13, color: GRIS }}>Aún no hay veredictos registrados.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {conVeredicto.slice(0, 6).map(c => (
                  <div key={c.id} style={{ background: BLANCO, border: `2px solid ${INK}`, padding: '8px 12px', display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: FONT.heading, fontWeight: 800, fontSize: 13, textTransform: 'uppercase', color: INK }}>{c.nombre}</span>
                    <span style={{ fontFamily: FONT.body, fontSize: 12, color: GRIS }}>{c.canal ?? '—'}</span>
                    <span style={{ fontFamily: FONT.body, fontSize: 12, color: GRANATE, fontWeight: 700 }}>{c.veredicto}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
