/**
 * RendimientoAdsPromo — Marketing › Rendimiento Ads & Promo
 *
 * Internaliza en el ERP las métricas que antes vivían solo en el portal de
 * Think Paladar (relación finalizada 30/06/2026): inversión ads/promo, ROI,
 * % venta orgánica, ROAS/CPC, salud de cliente, fee por promo.
 * Lee/escribe mkt_rendimiento_ads_promo (Supabase).
 * CANTERA ALEGRE v1.0 (área Marketing · rosa). Solo capa visual; datos/lógica intactos.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  INK, CREMA, AMA, VERDE, ROJO, NAR, AZUL, GRANATE, GRIS, CORP, OSW, LEX, EUR, E2, P0, N, BLANCO } from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'

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
const CANAL_COLOR: Record<string, string> = { glovo: CORP.glovo, uber_eats: VERDE, just_eat: CORP.je }
const CANAL_CLARO: Record<string, boolean> = { glovo: true, uber_eats: true, just_eat: false }

const th: React.CSSProperties = { fontFamily: OSW, fontSize: 11, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, padding: '9px 10px', textAlign: 'left', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { fontFamily: LEX, fontSize: 13.5, color: INK, padding: '9px 10px', borderBottom: `1px solid ${INK}22` }
const inp: React.CSSProperties = { padding: '8px 10px', border: `2px solid ${INK}`, background: BLANCO, color: INK, fontSize: 13, fontFamily: LEX, outline: 'none' }
const btn: React.CSSProperties = { padding: '9px 16px', border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, background: AMA, color: INK, fontFamily: OSW, fontWeight: 700, fontSize: 13, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer' }
const btnGhost: React.CSSProperties = { padding: '7px 12px', border: `2px solid ${INK}`, background: 'transparent', color: INK, fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer' }

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

  if (cargando) return <PantallaCantera><div style={{ padding: 40, fontFamily: OSW, color: GRIS, textTransform: 'uppercase', letterSpacing: '1px' }}>Cargando rendimiento…</div></PantallaCantera>

  const titular = filas.length === 0
    ? 'Sin registros todavía: carga el primer periodo.'
    : tot.depMedio != null && tot.depMedio > 50
      ? 'Las ventas dependen demasiado de la promo.'
      : tot.roasMedio != null && tot.roasMedio >= 1
        ? 'Los ads y las promos están dando retorno positivo.'
        : 'El retorno de ads y promos pide revisión.'

  const atencion = [
    tot.roasMedio != null ? `ROAS medio ${tot.roasMedio.toFixed(1)}x` : null,
    tot.fidelMedio != null ? `${P0(tot.fidelMedio)} fidelizado` : null,
    tot.depMedio != null ? `${P0(tot.depMedio)} dependiente de promo` : null,
    filas.length ? `${N(tot.pedidos)} pedidos` : null,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera>
      {/* Filtros propios: periodo + alta, arriba-derecha */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        {periodos.length > 1 && (
          <select value={periodo} onChange={e => setPeriodo(e.target.value)} style={inp}>
            <option value="todos">Todos los periodos</option>
            {periodos.map(p => { const [ini, fin] = p.split('_'); return <option key={p} value={p}>{ini} → {fin}</option> })}
          </select>
        )}
        <button onClick={() => setMostrarForm(v => !v)} style={btn}>{mostrarForm ? 'Cerrar' : '+ Nuevo registro'}</button>
      </div>

      {msg && <Papel ceja={VERDE} pad="10px 16px" style={{ fontSize: 13, color: INK }}>{msg}</Papel>}

      {/* 1 · Héroe del área Marketing (rosa) */}
      <HeroCantera
        area="marketing"
        titular={titular}
        etiquetaDato="Ventas vía promo/ads"
        cifra={EUR(tot.ventas)}
        resumen={filas.length ? <>Inversión {EUR(tot.inversion)} · Ticket medio {E2(tot.ticketMedio)} €</> : 'Internalizado tras la ruptura con Think Paladar (30/06/2026).'}
        atencion={atencion}
      />

      {/* FORMULARIO ALTA MANUAL — papel, sin sombra salvo el botón (pulsable) */}
      {mostrarForm && (
        <Papel ceja={AMA}>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 18, textTransform: 'uppercase', color: INK, marginBottom: 14 }}>Nuevo registro de periodo</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <label style={{ ...lblForm, flex: '1 1 150px' }}>Canal<select value={form.canal} onChange={e => setForm({ ...form, canal: e.target.value as Fila['canal'] })} style={inp}><option value="glovo">Glovo</option><option value="uber_eats">Uber Eats</option><option value="just_eat">Just Eat</option></select></label>
            <label style={{ ...lblForm, flex: '1 1 150px' }}>Inicio<input type="date" value={form.periodo_inicio} onChange={e => setForm({ ...form, periodo_inicio: e.target.value })} style={inp} /></label>
            <label style={{ ...lblForm, flex: '1 1 150px' }}>Fin<input type="date" value={form.periodo_fin} onChange={e => setForm({ ...form, periodo_fin: e.target.value })} style={inp} /></label>
            <label style={{ ...lblForm, flex: '1 1 150px' }}>Ventas €<input type="number" value={form.ventas} onChange={e => setForm({ ...form, ventas: Number(e.target.value) })} style={inp} /></label>
            <label style={{ ...lblForm, flex: '1 1 150px' }}>Pedidos<input type="number" value={form.pedidos} onChange={e => setForm({ ...form, pedidos: Number(e.target.value) })} style={inp} /></label>
            <label style={{ ...lblForm, flex: '1 1 150px' }}>Inversión Ads €<input type="number" value={form.inversion_ads} onChange={e => setForm({ ...form, inversion_ads: Number(e.target.value) })} style={inp} /></label>
            <label style={{ ...lblForm, flex: '1 1 150px' }}>Inversión Promo €<input type="number" value={form.inversion_promo} onChange={e => setForm({ ...form, inversion_promo: Number(e.target.value) })} style={inp} /></label>
            <label style={{ ...lblForm, flex: '1 1 150px' }}>ROI promo (x)<input type="number" step="0.1" value={form.roi_promo ?? ''} onChange={e => setForm({ ...form, roi_promo: e.target.value === '' ? null : Number(e.target.value) })} style={inp} /></label>
            <label style={{ ...lblForm, flex: '1 1 150px' }}>% venta orgánica<input type="number" step="0.1" value={form.venta_organica_pct ?? ''} onChange={e => setForm({ ...form, venta_organica_pct: e.target.value === '' ? null : Number(e.target.value) })} style={inp} /></label>
            <label style={{ ...lblForm, flex: '1 1 150px' }}>ROAS (x)<input type="number" step="0.1" value={form.roas ?? ''} onChange={e => setForm({ ...form, roas: e.target.value === '' ? null : Number(e.target.value) })} style={inp} /></label>
            <label style={{ ...lblForm, flex: '1 1 150px' }}>CPC €<input type="number" step="0.01" value={form.cpc ?? ''} onChange={e => setForm({ ...form, cpc: e.target.value === '' ? null : Number(e.target.value) })} style={inp} /></label>
            <label style={{ ...lblForm, flex: '1 1 150px' }}>% fidelizado<input type="number" step="0.1" value={form.pct_fidelizado ?? ''} onChange={e => setForm({ ...form, pct_fidelizado: e.target.value === '' ? null : Number(e.target.value) })} style={inp} /></label>
            <label style={{ ...lblForm, flex: '1 1 150px' }}>% dependiente<input type="number" step="0.1" value={form.pct_dependiente ?? ''} onChange={e => setForm({ ...form, pct_dependiente: e.target.value === '' ? null : Number(e.target.value) })} style={inp} /></label>
            <label style={{ ...lblForm, flex: '1 1 150px' }}>Tiempo entrega min<input type="number" step="0.5" value={form.tiempo_entrega_min ?? ''} onChange={e => setForm({ ...form, tiempo_entrega_min: e.target.value === '' ? null : Number(e.target.value) })} style={inp} /></label>
            <label style={{ ...lblForm, flex: '1 1 150px' }}>Rating<input type="number" step="0.01" value={form.rating ?? ''} onChange={e => setForm({ ...form, rating: e.target.value === '' ? null : Number(e.target.value) })} style={inp} /></label>
          </div>
          <button onClick={guardar} style={{ ...btn, marginTop: 16 }}>Guardar registro</button>
        </Papel>
      )}

      {filas.length === 0 ? (
        <Papel ceja={GRIS}><div style={{ fontFamily: LEX, fontWeight: 600, color: INK }}>Sin registros todavía. Pulsa «+ Nuevo registro» para cargar el primer periodo.</div></Papel>
      ) : (
        <>
          {/* 2 · Plancha de KPIs (celdas sólidas pegadas) */}
          <div>
            <SeccionLabel bg={GRANATE}>KPIs del periodo</SeccionLabel>
            <Plancha>
              <PlanchaCelda bg={GRANATE} first>
                <div style={{ fontFamily: OSW, fontSize: 11.5, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Ventas vía promo/ads</div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, margin: '6px 0 2px' }}>{EUR(tot.ventas)}</div>
                <div style={{ fontFamily: LEX, fontSize: 12 }}>{N(tot.pedidos)} pedidos</div>
              </PlanchaCelda>
              <PlanchaCelda bg={AZUL}>
                <div style={{ fontFamily: OSW, fontSize: 11.5, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Inversión total</div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, margin: '6px 0 2px' }}>{EUR(tot.inversion)}</div>
                <div style={{ fontFamily: LEX, fontSize: 12 }}>Ads {E2(tot.ads)} · Promo {E2(tot.promo)}</div>
              </PlanchaCelda>
              <PlanchaCelda bg={NAR}>
                <div style={{ fontFamily: OSW, fontSize: 11.5, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Ticket medio</div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, margin: '6px 0 2px' }}>{E2(tot.ticketMedio)} €</div>
              </PlanchaCelda>
              <PlanchaCelda bg={tot.roasMedio != null && tot.roasMedio >= 1 ? VERDE : ROJO}>
                <div style={{ fontFamily: OSW, fontSize: 11.5, letterSpacing: '1.5px', textTransform: 'uppercase' }}>ROAS medio (ads)</div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, margin: '6px 0 2px' }}>{tot.roasMedio != null ? tot.roasMedio.toFixed(1) + 'x' : '—'}</div>
              </PlanchaCelda>
              <PlanchaCelda bg={tot.fidelMedio != null && tot.fidelMedio >= 30 ? VERDE : NAR}>
                <div style={{ fontFamily: OSW, fontSize: 11.5, letterSpacing: '1.5px', textTransform: 'uppercase' }}>% Fidelizado</div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, margin: '6px 0 2px' }}>{tot.fidelMedio != null ? P0(tot.fidelMedio) : '—'}</div>
                <div style={{ fontFamily: LEX, fontSize: 12 }}>{tot.depMedio != null ? `${P0(tot.depMedio)} dependiente de promo` : ''}</div>
              </PlanchaCelda>
            </Plancha>
          </div>

          {/* 3 · Frase potente (color por significado, distinto del héroe rosa) */}
          {tot.depMedio != null && tot.depMedio > 50 ? (
            <FrasePotente significado="peligro">Más de la mitad de las ventas depende de promo ({P0(tot.depMedio)}). Sin fidelización real, cortar la inversión hunde las ventas.</FrasePotente>
          ) : tot.roasMedio != null && tot.roasMedio >= 1 ? (
            <FrasePotente significado="logro">El retorno de ads y promos es positivo: cada euro invertido vuelve multiplicado.</FrasePotente>
          ) : (
            <FrasePotente significado="coste">El ROAS medio está por debajo de 1x: revisa la inversión en ads antes de escalarla.</FrasePotente>
          )}

          {/* POR CANAL — papel por plataforma (sin sombra) */}
          <div>
            <SeccionLabel bg={NAR}>Por plataforma</SeccionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {porCanal.map(([canal, fs]) => {
                const inv = fs.reduce((s, f) => s + Number(f.inversion_ads) + Number(f.inversion_promo), 0)
                const ventasC = fs.reduce((s, f) => s + Number(f.ventas), 0)
                const roiVals = fs.filter(f => f.roi_promo != null).map(f => f.roi_promo as number)
                const roiMedio = roiVals.length ? roiVals.reduce((a, b) => a + b, 0) / roiVals.length : null
                const roasVals = fs.filter(f => f.roas != null).map(f => f.roas as number)
                const roasMedio = roasVals.length ? roasVals.reduce((a, b) => a + b, 0) / roasVals.length : null
                const col = CANAL_COLOR[canal]
                return (
                  <Papel key={canal} ceja={col} style={{ flex: '1 1 300px' }}>
                    <span style={{ display: 'inline-block', background: col, color: CANAL_CLARO[canal] ? INK : BLANCO, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', padding: '4px 12px' }}>{CANAL_LABEL[canal]}</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
                      <div style={{ flex: '1 1 45%' }}><div style={lblSm}>Inversión</div><div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 20, color: AZUL }}>{EUR(inv)}</div></div>
                      <div style={{ flex: '1 1 45%' }}><div style={lblSm}>Ventas generadas</div><div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 20, color: GRANATE }}>{EUR(ventasC)}</div></div>
                      <div style={{ flex: '1 1 45%' }}><div style={lblSm}>ROI promo</div><div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 20, color: roiMedio != null && roiMedio >= 1 ? VERDE : ROJO }}>{roiMedio != null ? roiMedio.toFixed(1) + 'x' : '—'}</div></div>
                      <div style={{ flex: '1 1 45%' }}><div style={lblSm}>ROAS ads</div><div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 20, color: roasMedio != null && roasMedio >= 1 ? VERDE : ROJO }}>{roasMedio != null ? roasMedio.toFixed(1) + 'x' : '—'}</div></div>
                    </div>
                  </Papel>
                )
              })}
            </div>
          </div>

          {/* TABLA DETALLE — papel (sin sombra) */}
          <div>
            <SeccionLabel bg={GRANATE}>Detalle por periodo</SeccionLabel>
            <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: INK }}>
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
                      <td style={td}><span style={{ display: 'inline-block', background: CANAL_COLOR[f.canal], color: CANAL_CLARO[f.canal] ? INK : BLANCO, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 600, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', padding: '2px 9px' }}>{CANAL_LABEL[f.canal]}</span></td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: OSW, fontWeight: 700 }}>{E2(f.ventas)} €</td>
                      <td style={{ ...td, textAlign: 'right' }}>{N(f.pedidos)}</td>
                      <td style={{ ...td, textAlign: 'right', color: AZUL }}>{E2(f.inversion_ads)} €</td>
                      <td style={{ ...td, textAlign: 'right', color: AZUL }}>{E2(f.inversion_promo)} €</td>
                      <td style={{ ...td, textAlign: 'right', color: f.roi_promo != null && f.roi_promo >= 1 ? VERDE : GRIS }}>{f.roi_promo != null ? f.roi_promo.toFixed(1) + 'x' : '—'}</td>
                      <td style={{ ...td, textAlign: 'right', color: f.roas != null ? (f.roas >= 1 ? VERDE : ROJO) : GRIS }}>{f.roas != null ? f.roas.toFixed(1) + 'x' : '—'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{f.venta_organica_pct != null ? P0(f.venta_organica_pct) : '—'}</td>
                      <td style={{ ...td, fontSize: 11, color: GRIS, textTransform: 'uppercase', fontFamily: OSW }}>{f.fuente}</td>
                      <td style={td}><button onClick={() => borrar(f.id)} style={{ ...btnGhost, borderColor: ROJO, color: ROJO }}>Borrar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, padding: '10px 12px' }}>Fuente «think_paladar» = último export del portal antes de la ruptura (30/06/2026). A partir de ahora, carga manual o futura integración con Glovo/Uber/Just Eat.</div>
            </Papel>
          </div>
        </>
      )}
    </PantallaCantera>
  )
}

const lblForm: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontFamily: OSW, fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', color: GRIS }
const lblSm: React.CSSProperties = { fontFamily: OSW, fontSize: 10.5, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS }
