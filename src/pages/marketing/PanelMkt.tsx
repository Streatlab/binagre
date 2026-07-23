import { AMA, BLANCO, GRANATE, GRIS, INK, VERDE, NAR, OSW, LEX } from '@/styles/neobrutal'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'

// ── Panel MKT · hub del módulo de marketing ──
// Lee datos reales: reseñas, campañas, rendimiento ads/promo, club, playbook TP, benchmark.
// CANTERA ALEGRE v1.0 (área Marketing · rosa). Solo capa visual; datos vía supabase directo (sin hook).

interface ResenaRow { plataforma: string; rating: number | null; num_resenas: number | null; fecha: string }
interface CampanaRow { id: number; nombre: string; canal: string | null; estado: string | null; fecha_inicio: string | null; fecha_fin: string | null; veredicto: string | null; resultado_real: number | null; kpi_meta: number | null }
interface RendRow { canal: string | null; periodo_fin: string | null; ventas: number | null; roi_promo: number | null; roas: number | null; pct_fidelizado: number | null }
interface PlaybookRow { estado: string | null }

const fmtEur = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

const linkStyle: React.CSSProperties = {
  fontFamily: OSW,
  fontWeight: 700,
  fontSize: 12,
  textTransform: 'uppercase',
  color: GRANATE,
  textDecoration: 'none',
  borderBottom: `2px solid ${GRANATE}`,
  marginTop: 10,
  display: 'inline-block',
}

const linkClaro: React.CSSProperties = {
  fontFamily: OSW,
  fontWeight: 700,
  fontSize: 11,
  textTransform: 'uppercase',
  color: BLANCO,
  textDecoration: 'none',
  borderBottom: `2px solid ${BLANCO}`,
  marginTop: 8,
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

  const titular = notaMedia == null
    ? 'Aún no hay reseñas registradas: activa el seguimiento por plataforma.'
    : notaMedia >= 4.5 ? 'Las plataformas valoran muy bien la marca.'
    : notaMedia >= 4 ? 'Buena nota media, con margen de mejora.'
    : 'La nota media pide atención: revisa los comentarios recientes.'

  const atencion = [
    activas.length ? `${activas.length} campañas activas` : null,
    sinVeredictoCerradas.length ? `${sinVeredictoCerradas.length} cerradas sin veredicto` : null,
    socios ? `${socios} socios club` : null,
    competidores ? `${competidores} competidores mapeados` : null,
  ].filter(Boolean) as string[]

  if (cargando) {
    return (
      <PantallaCantera>
        <div style={{ padding: 40, color: GRIS, fontFamily: OSW, textTransform: 'uppercase', letterSpacing: '1px' }}>Cargando datos…</div>
      </PantallaCantera>
    )
  }

  return (
    <PantallaCantera>
      {/* 1 · Héroe del área Marketing (rosa) */}
      <HeroCantera
        area="marketing"
        titular={titular}
        etiquetaDato="Nota media plataformas"
        cifra={notaMedia != null ? notaMedia.toFixed(2) : '—'}
        resumen={plataformas.length ? <>{plataformas.map(([p, r]) => `${p}: ${r.rating ?? '—'}`).join(' · ')}</> : 'Sin registros de reseñas todavía.'}
        atencion={atencion}
      />

      {/* 2 · Plancha de KPIs del hub (celdas sólidas pegadas) */}
      <div>
        <SeccionLabel bg={GRANATE}>Estado del módulo</SeccionLabel>
        <Plancha>
          <PlanchaCelda bg={GRANATE} first>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Campañas activas</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 28, lineHeight: 1.05, marginTop: 6 }}>{activas.length}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{campanas.length} totales · {conVeredicto.length} con veredicto</div>
            <Link to="/marketing/plan" style={linkClaro}>Plan Campañas →</Link>
          </PlanchaCelda>
          <PlanchaCelda bg={AMA} color={INK}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Último ROI promo</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 28, lineHeight: 1.05, marginTop: 6 }}>{ultimoRend?.roi_promo != null ? `${Number(ultimoRend.roi_promo).toFixed(1)}x` : '—'}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{ultimoRend ? `${ultimoRend.canal ?? '—'} · ventas ${fmtEur(ultimoRend.ventas)}` : 'Sin datos de rendimiento'}</div>
            <Link to="/marketing/rendimiento-ads-promo" style={{ ...linkClaro, color: INK, borderBottomColor: INK }}>Rendimiento →</Link>
          </PlanchaCelda>
          <PlanchaCelda bg={VERDE}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Socios club</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 28, lineHeight: 1.05, marginTop: 6 }}>{socios}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>Fidelización canal propio</div>
            <Link to="/clientes/club" style={linkClaro}>Club →</Link>
          </PlanchaCelda>
          <PlanchaCelda bg={NAR}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Playbook Think Paladar</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 20, lineHeight: 1.05, marginTop: 6 }}>{tacticasAplicadas} aplicadas · {tacticasEnCurso} en curso</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{playbook.length === 0 ? 'Ninguna táctica marcada aún' : `${playbook.length} con estado registrado`}</div>
            <Link to="/clientes/playbook-tp" style={linkClaro}>Playbook →</Link>
          </PlanchaCelda>
        </Plancha>
      </div>

      {/* 3 · Frase potente (color por significado, distinto del héroe rosa) */}
      {sinVeredictoCerradas.length > 0 ? (
        <FrasePotente significado="coste">{sinVeredictoCerradas.length} campañas cerradas sin veredicto: sin aprendizaje no hay mejora, ciérralo en Plan Campañas.</FrasePotente>
      ) : (
        <FrasePotente significado="logro">Todas las campañas cerradas tienen veredicto registrado: el aprendizaje está al día.</FrasePotente>
      )}

      {/* Acción pendiente — papel (sin sombra) */}
      {sinVeredictoCerradas.length > 0 && (
        <div>
          <SeccionLabel bg={GRANATE}>Acción pendiente</SeccionLabel>
          <Papel ceja={GRANATE}>
            <ul style={{ fontFamily: LEX, fontSize: 13, color: INK, margin: 0, paddingLeft: 18 }}>
              {sinVeredictoCerradas.slice(0, 5).map(c => (
                <li key={c.id}>{c.nombre} ({c.canal ?? '—'})</li>
              ))}
            </ul>
          </Papel>
        </div>
      )}

      {/* Benchmark — papel (sin sombra) */}
      <div>
        <SeccionLabel bg={NAR}>Benchmark competencia</SeccionLabel>
        <Papel ceja={NAR}>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 20, color: INK }}>{competidores} competidores mapeados</div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 6 }}>Manual, plan 90 días y carta maestra de 68 platos.</div>
          <Link to="/clientes/benchmark" style={linkStyle}>Abrir Benchmark →</Link>
        </Papel>
      </div>

      {/* Últimas campañas con veredicto — papel (sin sombra) */}
      <div>
        <SeccionLabel bg={AMA} color={INK}>Últimos aprendizajes de campañas</SeccionLabel>
        <Papel ceja={AMA}>
          {conVeredicto.length === 0 ? (
            <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS }}>Aún no hay veredictos registrados.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {conVeredicto.slice(0, 6).map(c => (
                <div key={c.id} style={{ background: BLANCO, border: `2px solid ${INK}`, padding: '8px 12px', display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 13, textTransform: 'uppercase', color: INK }}>{c.nombre}</span>
                  <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>{c.canal ?? '—'}</span>
                  <span style={{ fontFamily: LEX, fontSize: 12, color: GRANATE, fontWeight: 700 }}>{c.veredicto}</span>
                </div>
              ))}
            </div>
          )}
        </Papel>
      </div>
    </PantallaCantera>
  )
}
