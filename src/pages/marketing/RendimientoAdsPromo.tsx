/**
 * RendimientoAdsPromo — Marketing › Rendimiento Ads & Promo
 *
 * Internaliza en el ERP las métricas que antes vivían solo en el portal de
 * Think Paladar (relación finalizada 30/06/2026): inversión ads/promo, ROI,
 * % venta orgánica, ROAS/CPC, salud de cliente, fee por promo.
 * Lee/escribe mkt_rendimiento_ads_promo (Supabase). Estilo neobrutal Food-Pop
 * canónico (src/styles/neobrutal.ts) — sombra dura, fondo crema, Oswald/Lexend.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  INK, OSC, CREMA, CLARO, AMA, VERDE, ROJO, NAR, AZUL, GRANATE, GRIS, TRACK, OSW, LEX, PAD, SHADOW, d, eyebrow, EUR, E2, P0, P2, N, BLANCO } from '@/styles/neobrutal'

type Fila = {
  id: number; marca: string; canal: 'glovo' | 'uber_eats' | 'just_eat'
  periodo_inicio: string; periodo_fin: string
  ventas: number; pedidos: number; ticket_medio: number
  inversion_ads: number; inversion_promo: number
  roi_promo: number | null; venta_organica_pct: number | null; fee_promo: number | null
  impresiones: number | null; menu_views: number | null; conversion_pct: number | null
  cpc: number | null; ads_pedidos: number | null; roas: number | null
  clientes_nuevos: number | null; clientes_ocasionales: number | null; clientes_frecuentes: number | null
  pct_fidelizado: number | null; pct_dependiente: number | null; pct_natural: number | null
  tiempo_entrega_min: number | null; rating: number | null
  fuente: string; notas: string | null
}

const CANAL_LABEL: Record<string, string> = { glovo: 'Glovo', uber_eats: 'Uber Eats', just_eat: 'Just Eat' }
const CANAL_COLOR: Record<string, string> = { glovo: '#FFC244', uber_eats: VERDE, just_eat: '#FF8000' }
const CANAL_CLARO: Record<string, boolean> = { glovo: true, uber_eats: true, just_eat: false }

const th: React.CSSProperties = { fontFamily: OSW, fontSize: 11, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#6b5d45', fontWeight: 600, padding: '9px 10px', textAlign: 'left', borderBottom: `2px solid ${INK}` }
const td: React.CSSProperties = { fontFamily: LEX, fontSize: 13.5, color: INK, padding: '9px 10px', borderBottom: `1px solid ${INK}22` }
const inp: React.CSSProperties = { padding: '8px 10px', border: `2px solid ${INK}`, background: BLANCO, color: INK, fontSize: 13, fontFamily: LEX, outline: 'none' }
const btn: React.CSSProperties = { padding: '9px 16px', border: `3px solid ${INK}`, boxShadow: SHADOW, background: AMA, color: INK, fontFamily: OSW, fontWeight: 700, fontSize: 13, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer' }
const btnGhost: React.CSSProperties = { padding: '7px 12px', border: `2px solid ${INK}`, background: 'transparent', color: INK, fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer' }

function Kpi({ label, value, sub, color = INK }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: BLANCO, border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '16px 18px', flex: 1, minWidth: 160 }}>
      <div style={{ fontFamily: OSW, fontSize: 11.5, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6b5d45' }}>{label}</div>
      <div style={{ ...d('clamp(24px,3vw,34px)', color), margin: '6px 0 2px' }}>{value}</div>
      {sub && <div style={{ fontFamily: LEX, fontSize: 12, fontWeight: 600, color: '#6b5d45' }}>{sub}</div>}
    </div>
  )
}

const VACIO: Omit<Fila, 'id'> = {
  marca: 'Binagre', canal: 'glovo', periodo_inicio: '', periodo_fin: '',
  ventas: 0, pedidos: 0, ticket_medio: 0, inversion_ads: 0, inversion_promo: 0,
  roi_promo: null, venta_organica_pct: null, fee_promo: null,
  impresiones: null, menu_views: null, conversion_pct: null, cpc: null, ads_pedidos: null, roas: null,
  clientes_nuevos: null, clientes_ocasionales: null, clientes_frecuentes: null,
  pct_fidelizado: null, pct_dependiente: null, pct_natural: null,
  tiempo_entrega_min: null, rating: null, fuente: 'manual', notas: null,
}

export default function RendimientoAdsPromo() {
  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)
  const [periodo, setPeriodo] = useState<string>('todos')
  const [form, setForm] = useState<typeof VACIO>(VACIO)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [msg, setMsg] = useState('')

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('mkt_rendimiento_ads_promo').select('*').order('periodo_inicio', { ascending: false })
    setFilas((data as Fila[]) || [])
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(''), 2500) }

  async function guardar() {
    if (!form.periodo_inicio || !form.periodo_fin) { flash('Falta el periodo (inicio y fin)'); return }
    const { error } = await supabase.from('mkt_rendimiento_ads_promo').upsert(form, { onConflict: 'marca,canal,periodo_inicio,periodo_fin' })
    if (error) { flash('Error al guardar: ' + error.message); return }
    flash('Guardado')
    setForm(VACIO)
    setMostrarForm(false)
    cargar()
  }

  async function borrar(id: number) {
    await supabase.from('mkt_rendimiento_ads_promo').delete().eq('id', id)
    setFilas(fs => fs.filter(f => f.id !== id))
    flash('Registro eliminado')
  }

  const periodos = useMemo(() => Array.from(new Set(filas.map(f => `${f.periodo_inicio}_${f.periodo_fin}`))), [filas])
  const filasPeriodo = periodo === 'todos' ? filas : filas.filter(f => `${f.periodo_inicio}_${f.periodo_fin}` === periodo)

  const tot = useMemo(() => {
    const ventas = filasPeriodo.reduce((s, f) => s + Number(f.ventas), 0)
    const pedidos = filasPeriodo.reduce((s, f) => s + Number(f.pedidos), 0)
    const ads = filasPeriodo.reduce((s, f) => s + Number(f.inversion_ads), 0)
    const promo = filasPeriodo.reduce((s, f) => s + Number(f.inversion_promo), 0)
    const inversion = ads + promo
    const ticketMedio = pedidos > 0 ? ventas / pedidos : 0
    const roasVals = filasPeriodo.filter(f => f.roas != null && f.ads_pedidos != null && f.ads_pedidos > 0).map(f => f.roas as number)
    const roasMedio = roasVals.length ? roasVals.reduce((a, b) => a + b, 0) / roasVals.length : null
    const fidelVals = filasPeriodo.filter(f => f.pct_fidelizado != null)
    const fidelMedio = fidelVals.length ? fidelVals.reduce((s, f) => s + Number(f.pct_fidelizado), 0) / fidelVals.length : null
    const depMedio = fidelVals.length ? fidelVals.reduce((s, f) => s + Number(f.pct_dependiente), 0) / fidelVals.length : null
    return { ventas, pedidos, ads, promo, inversion, ticketMedio, roasMedio, fidelMedio, depMedio }
  }, [filasPeriodo])

  const porCanal = useMemo(() => {
    const m: Record<string, Fila[]> = {}
    filasPeriodo.forEach(f => { (m[f.canal] ||= []).push(f) })
    return Object.entries(m)
  }, [filasPeriodo])

  if (cargando) return <div style={{ background: CREMA, minHeight: '100vh', padding: 40, fontFamily: OSW, color: '#6b5d45', textTransform: 'uppercase', letterSpacing: '1px' }}>Cargando rendimiento…</div>

  return (
    <div style={{ background: CREMA, minHeight: '100vh', fontFamily: LEX, color: INK }}>
      {/* HERO */}
      <section style={{ background: AMA, borderBottom: `4px solid ${INK}`, padding: `30px ${PAD}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <span style={eyebrow(BLANCO)}>Marketing</span>
            <div style={{ ...d('clamp(26px,3.6vw,44px)'), margin: '12px 0 6px' }}>Rendimiento Ads &amp; Promo</div>
            <div style={{ fontFamily: LEX, fontSize: 14, fontWeight: 600 }}>Internalizado tras la ruptura con Think Paladar (30/06/2026) · inversión, ROI, ROAS y salud de cliente por canal</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {periodos.length > 1 && (
              <select value={periodo} onChange={e => setPeriodo(e.target.value)} style={inp}>
                <option value="todos">Todos los periodos</option>
                {periodos.map(p => { const [ini, fin] = p.split('_'); return <option key={p} value={p}>{ini} → {fin}</option> })}
              </select>
            )}
            <button onClick={() => setMostrarForm(v => !v)} style={btn}>{mostrarForm ? 'Cerrar' : '+ Nuevo registro'}</button>
          </div>
        </div>
      </section>

      {msg && <div style={{ background: VERDE, color: BLANCO, borderBottom: `4px solid ${INK}`, padding: `10px ${PAD}`, fontFamily: OSW, fontSize: 13, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{msg}</div>}

      {/* FORMULARIO ALTA MANUAL */}
      {mostrarForm && (
        <section style={{ background: BLANCO, borderBottom: `4px solid ${INK}`, padding: `26px ${PAD}` }}>
          <div style={{ ...d('20px'), marginBottom: 14 }}>Nuevo registro de periodo</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
            <label style={lblForm}>Canal<select value={form.canal} onChange={e => setForm({ ...form, canal: e.target.value as Fila['canal'] })} style={inp}><option value="glovo">Glovo</option><option value="uber_eats">Uber Eats</option><option value="just_eat">Just Eat</option></select></label>
            <label style={lblForm}>Inicio<input type="date" value={form.periodo_inicio} onChange={e => setForm({ ...form, periodo_inicio: e.target.value })} style={inp} /></label>
            <label style={lblForm}>Fin<input type="date" value={form.periodo_fin} onChange={e => setForm({ ...form, periodo_fin: e.target.value })} style={inp} /></label>
            <label style={lblForm}>Ventas €<input type="number" value={form.ventas} onChange={e => setForm({ ...form, ventas: Number(e.target.value) })} style={inp} /></label>
            <label style={lblForm}>Pedidos<input type="number" value={form.pedidos} onChange={e => setForm({ ...form, pedidos: Number(e.target.value) })} style={inp} /></label>
            <label style={lblForm}>Inversión Ads €<input type="number" value={form.inversion_ads} onChange={e => setForm({ ...form, inversion_ads: Number(e.target.value) })} style={inp} /></label>
            <label style={lblForm}>Inversión Promo €<input type="number" value={form.inversion_promo} onChange={e => setForm({ ...form, inversion_promo: Number(e.target.value) })} style={inp} /></label>
            <label style={lblForm}>ROI promo (x)<input type="number" step="0.1" value={form.roi_promo ?? ''} onChange={e => setForm({ ...form, roi_promo: e.target.value === '' ? null : Number(e.target.value) })} style={inp} /></label>
            <label style={lblForm}>% venta orgánica<input type="number" step="0.1" value={form.venta_organica_pct ?? ''} onChange={e => setForm({ ...form, venta_organica_pct: e.target.value === '' ? null : Number(e.target.value) })} style={inp} /></label>
            <label style={lblForm}>ROAS (x)<input type="number" step="0.1" value={form.roas ?? ''} onChange={e => setForm({ ...form, roas: e.target.value === '' ? null : Number(e.target.value) })} style={inp} /></label>
            <label style={lblForm}>CPC €<input type="number" step="0.01" value={form.cpc ?? ''} onChange={e => setForm({ ...form, cpc: e.target.value === '' ? null : Number(e.target.value) })} style={inp} /></label>
            <label style={lblForm}>% fidelizado<input type="number" step="0.1" value={form.pct_fidelizado ?? ''} onChange={e => setForm({ ...form, pct_fidelizado: e.target.value === '' ? null : Number(e.target.value) })} style={inp} /></label>
            <label style={lblForm}>% dependiente<input type="number" step="0.1" value={form.pct_dependiente ?? ''} onChange={e => setForm({ ...form, pct_dependiente: e.target.value === '' ? null : Number(e.target.value) })} style={inp} /></label>
            <label style={lblForm}>Tiempo entrega min<input type="number" step="0.5" value={form.tiempo_entrega_min ?? ''} onChange={e => setForm({ ...form, tiempo_entrega_min: e.target.value === '' ? null : Number(e.target.value) })} style={inp} /></label>
            <label style={lblForm}>Rating<input type="number" step="0.01" value={form.rating ?? ''} onChange={e => setForm({ ...form, rating: e.target.value === '' ? null : Number(e.target.value) })} style={inp} /></label>
          </div>
          <button onClick={guardar} style={{ ...btn, marginTop: 16 }}>Guardar registro</button>
        </section>
      )}

      {filas.length === 0 ? (
        <section style={{ padding: `40px ${PAD}` }}>
          <div style={{ background: BLANCO, border: `3px solid ${INK}`, boxShadow: SHADOW, padding: 24, fontFamily: LEX, fontWeight: 600 }}>Sin registros todavía. Pulsa «+ Nuevo registro» para cargar el primer periodo.</div>
        </section>
      ) : (
        <>
          {/* KPIs */}
          <section style={{ padding: `26px ${PAD} 0` }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Kpi label="Ventas vía promo/ads" value={EUR(tot.ventas)} sub={`${N(tot.pedidos)} pedidos`} color={GRANATE} />
              <Kpi label="Inversión total" value={EUR(tot.inversion)} sub={`Ads ${E2(tot.ads)} · Promo ${E2(tot.promo)}`} color={AZUL} />
              <Kpi label="Ticket medio" value={E2(tot.ticketMedio) + ' €'} color={NAR} />
              <Kpi label="ROAS medio (ads)" value={tot.roasMedio != null ? tot.roasMedio.toFixed(1) + 'x' : '—'} color={tot.roasMedio != null && tot.roasMedio >= 1 ? VERDE : ROJO} />
              <Kpi label="% Fidelizado" value={tot.fidelMedio != null ? P0(tot.fidelMedio) : '—'} sub={tot.depMedio != null ? `${P0(tot.depMedio)} dependiente de promo` : undefined} color={tot.fidelMedio != null && tot.fidelMedio >= 30 ? VERDE : NAR} />
            </div>
          </section>

          {/* ALERTA dependencia */}
          {tot.depMedio != null && tot.depMedio > 50 && (
            <section style={{ padding: `18px ${PAD} 0` }}>
              <div style={{ background: OSC, color: CREMA, border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, fontFamily: OSW, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <span style={{ ...eyebrow(ROJO, BLANCO), fontSize: 11 }}>Riesgo</span>
                Más de la mitad de las ventas depende de promo ({P0(tot.depMedio)}). Sin fidelización real, cortar la inversión hunde las ventas.
              </div>
            </section>
          )}

          {/* POR CANAL */}
          <section style={{ padding: `26px ${PAD}` }}>
            <div style={{ ...d('20px'), marginBottom: 14 }}>Por plataforma</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
              {porCanal.map(([canal, fs]) => {
                const inv = fs.reduce((s, f) => s + Number(f.inversion_ads) + Number(f.inversion_promo), 0)
                const ventasC = fs.reduce((s, f) => s + Number(f.ventas), 0)
                const roiVals = fs.filter(f => f.roi_promo != null).map(f => f.roi_promo as number)
                const roiMedio = roiVals.length ? roiVals.reduce((a, b) => a + b, 0) / roiVals.length : null
                const roasVals = fs.filter(f => f.roas != null).map(f => f.roas as number)
                const roasMedio = roasVals.length ? roasVals.reduce((a, b) => a + b, 0) / roasVals.length : null
                const col = CANAL_COLOR[canal]
                return (
                  <div key={canal} style={{ background: BLANCO, border: `3px solid ${INK}`, borderLeft: `12px solid ${col}`, boxShadow: SHADOW, padding: '16px 18px' }}>
                    <span style={{ ...eyebrow(col, CANAL_CLARO[canal] ? INK : BLANCO), fontSize: 13 }}>{CANAL_LABEL[canal]}</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginTop: 14 }}>
                      <div><div style={lblSm}>Inversión</div><div style={d('20px', AZUL)}>{EUR(inv)}</div></div>
                      <div><div style={lblSm}>Ventas generadas</div><div style={d('20px', GRANATE)}>{EUR(ventasC)}</div></div>
                      <div><div style={lblSm}>ROI promo</div><div style={d('20px', roiMedio != null && roiMedio >= 1 ? VERDE : ROJO)}>{roiMedio != null ? roiMedio.toFixed(1) + 'x' : '—'}</div></div>
                      <div><div style={lblSm}>ROAS ads</div><div style={d('20px', roasMedio != null && roasMedio >= 1 ? VERDE : ROJO)}>{roasMedio != null ? roasMedio.toFixed(1) + 'x' : '—'}</div></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* TABLA DETALLE */}
          <section style={{ padding: `0 ${PAD} 36px` }}>
            <div style={{ ...d('20px'), marginBottom: 12 }}>Detalle por periodo</div>
            <div style={{ background: BLANCO, border: `3px solid ${INK}`, boxShadow: SHADOW, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}>Periodo</th><th style={th}>Canal</th>
                  <th style={{ ...th, textAlign: 'right' }}>Ventas</th><th style={{ ...th, textAlign: 'right' }}>Pedidos</th>
                  <th style={{ ...th, textAlign: 'right' }}>Inv. Ads</th><th style={{ ...th, textAlign: 'right' }}>Inv. Promo</th>
                  <th style={{ ...th, textAlign: 'right' }}>ROI</th><th style={{ ...th, textAlign: 'right' }}>ROAS</th>
                  <th style={{ ...th, textAlign: 'right' }}>% Org.</th><th style={th}>Fuente</th><th style={th}></th>
                </tr></thead>
                <tbody>
                  {filasPeriodo.map(f => (
                    <tr key={f.id}>
                      <td style={{ ...td, whiteSpace: 'nowrap', fontFamily: OSW, fontWeight: 600 }}>{f.periodo_inicio} → {f.periodo_fin}</td>
                      <td style={td}><span style={{ ...eyebrow(CANAL_COLOR[f.canal], CANAL_CLARO[f.canal] ? INK : BLANCO), fontSize: 11 }}>{CANAL_LABEL[f.canal]}</span></td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: OSW, fontWeight: 700 }}>{E2(f.ventas)} €</td>
                      <td style={{ ...td, textAlign: 'right' }}>{N(f.pedidos)}</td>
                      <td style={{ ...td, textAlign: 'right', color: AZUL }}>{E2(f.inversion_ads)} €</td>
                      <td style={{ ...td, textAlign: 'right', color: AZUL }}>{E2(f.inversion_promo)} €</td>
                      <td style={{ ...td, textAlign: 'right', color: f.roi_promo != null && f.roi_promo >= 1 ? VERDE : GRIS }}>{f.roi_promo != null ? f.roi_promo.toFixed(1) + 'x' : '—'}</td>
                      <td style={{ ...td, textAlign: 'right', color: f.roas != null ? (f.roas >= 1 ? VERDE : ROJO) : GRIS }}>{f.roas != null ? f.roas.toFixed(1) + 'x' : '—'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{f.venta_organica_pct != null ? P0(f.venta_organica_pct) : '—'}</td>
                      <td style={{ ...td, fontSize: 11, color: '#6b5d45', textTransform: 'uppercase', fontFamily: OSW }}>{f.fuente}</td>
                      <td style={td}><button onClick={() => borrar(f.id)} style={{ ...btnGhost, borderColor: ROJO, color: ROJO }}>Borrar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontFamily: LEX, fontSize: 12, color: '#6b5d45', marginTop: 10 }}>Fuente «think_paladar» = último export del portal antes de la ruptura (30/06/2026). A partir de ahora, carga manual o futura integración con Glovo/Uber/Just Eat.</div>
          </section>
        </>
      )}
    </div>
  )
}

const lblForm: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontFamily: OSW, fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#6b5d45' }
const lblSm: React.CSSProperties = { fontFamily: OSW, fontSize: 10.5, letterSpacing: '1px', textTransform: 'uppercase', color: '#6b5d45' }
