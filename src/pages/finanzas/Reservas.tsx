/**
 * RESERVAS — Fondo de maniobra. Look Neobrutal Food-Pop (tokens canonicos).
 *
 * Hero directo: "APARTA HOY X €" — el modulo le dice a Ruben exactamente que
 * traspasar hoy / esta semana / acumulado, agrupado por dia y plataforma.
 *
 * Cada cobro de plataforma (1.1.1/1.1.2/1.1.3) desde fecha_inicio genera una
 * orden de barrido (% configurable). El cobro bancario YA es neto (LEY-NETO-01:
 * aqui no se calculan netos, se lee banco).
 * Dotar reserva NO es gasto -> no computa en P&G.
 */
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import {
  OSW, LEX, INK, OSC, CREMA, CLARO, TRACK, D1,
  VERDE, ROJO, AMA, NAR, AZUL, GRANATE, GRIS,
  SHADOW, BORDER, BORDER_CARD, CORP, CLARA,
  eyebrow, d, E2, ES, P0,
} from '@/styles/neobrutal'
import { fmtEur } from '@/lib/format'

interface Config { id: number; pct: number; activo: boolean; fecha_inicio: string }
interface Orden {
  id: string; fecha_cobro: string; plataforma: string
  importe_cobro: number; pct_aplicado: number; importe_reservar: number; estado: string
}
interface Movimiento {
  id: string; fecha: string; tipo: string; importe: number
  destino: string | null; autorizado: boolean; nota: string | null
}

const DESTINOS = ['NOMINAS', 'SS', 'ALQUILER', 'SUMINISTROS', 'PRESTAMO', 'IMPUESTOS', 'OTRO']
const AUTORIZADOS = ['NOMINAS', 'SS', 'ALQUILER', 'SUMINISTROS', 'PRESTAMO', 'IMPUESTOS']

const CANAL_KEY: Record<string, string> = { 'UBER EATS': 'uber', GLOVO: 'glovo', 'JUST EAT': 'je' }
const canalColor = (p: string) => CORP[CANAL_KEY[p] ?? 'dir'] ?? '#1e2233'
const canalTextoOscuro = (p: string) => CLARA[CANAL_KEY[p] ?? 'dir'] ?? false

const hoyISO = () => new Date().toISOString().slice(0, 10)
const lunesISO = () => {
  const t = new Date()
  const day = (t.getDay() + 6) % 7 // lunes=0
  t.setDate(t.getDate() - day)
  return t.toISOString().slice(0, 10)
}
const fechaBonita = (iso: string) => {
  const dt = new Date(iso + 'T00:00:00')
  return dt.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function Reservas() {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [movs, setMovs] = useState<Movimiento[]>([])
  const [fijosMes, setFijosMes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [pctEdit, setPctEdit] = useState(5)
  const [verConfig, setVerConfig] = useState(false)
  const [verDetalle, setVerDetalle] = useState<Record<string, boolean>>({})

  async function cargar() {
    const [c, o, m, f] = await Promise.all([
      supabase.from('reserva_config').select('*').eq('id', 1).single(),
      supabase.from('reserva_ordenes').select('*').order('fecha_cobro', { ascending: false }).limit(400),
      supabase.from('reserva_movimientos').select('*').order('fecha', { ascending: false }).limit(120),
      supabase.from('v_reserva_fijos_mes').select('fijos_mes').single(),
    ])
    if (c.data) { setCfg(c.data as Config); setPctEdit(Number((c.data as Config).pct)) }
    setOrdenes((o.data ?? []) as Orden[])
    setMovs((m.data ?? []) as Movimiento[])
    setFijosMes(Number((f.data as { fijos_mes?: number } | null)?.fijos_mes ?? 0))
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  /* ── Derivados ── */
  const pendientes = useMemo(() => ordenes.filter(o => o.estado === 'PENDIENTE'), [ordenes])
  const totalPendiente = useMemo(() => pendientes.reduce((a, o) => a + Number(o.importe_reservar), 0), [pendientes])
  const hoy = hoyISO()
  const lunes = lunesISO()
  const pendHoy = useMemo(() => pendientes.filter(o => o.fecha_cobro === hoy), [pendientes, hoy])
  const pendSemana = useMemo(() => pendientes.filter(o => o.fecha_cobro >= lunes), [pendientes, lunes])
  const totalHoy = pendHoy.reduce((a, o) => a + Number(o.importe_reservar), 0)
  const totalSemana = pendSemana.reduce((a, o) => a + Number(o.importe_reservar), 0)

  const dotado = useMemo(() => movs.filter(m => m.tipo === 'DOTACION').reduce((a, m) => a + Number(m.importe), 0), [movs])
  const retirado = useMemo(() => movs.filter(m => m.tipo === 'RETIRADA').reduce((a, m) => a + Number(m.importe), 0), [movs])
  const saldo = dotado - retirado
  const fugas = useMemo(() => movs.filter(m => m.tipo === 'RETIRADA' && !m.autorizado), [movs])
  const cobertura = fijosMes > 0 ? (saldo / fijosMes) * 100 : 0
  const colorCob = cobertura >= 100 ? VERDE : cobertura >= 50 ? AMA : ROJO

  // Dotado este mes (ritmo)
  const mesActual = hoy.slice(0, 7)
  const dotadoMes = useMemo(
    () => movs.filter(m => m.tipo === 'DOTACION' && m.fecha.startsWith(mesActual)).reduce((a, m) => a + Number(m.importe), 0),
    [movs, mesActual],
  )

  const diasMasAntigua = useMemo(() => {
    if (pendientes.length === 0) return 0
    const min = pendientes.reduce((a, o) => (o.fecha_cobro < a ? o.fecha_cobro : a), pendientes[0].fecha_cobro)
    return Math.floor((Date.now() - new Date(min + 'T00:00:00').getTime()) / 86400000)
  }, [pendientes])
  const nivel: 'ok' | 'aviso' | 'rojo' | 'bloqueo' =
    pendientes.length === 0 ? 'ok' : diasMasAntigua >= 5 ? 'bloqueo' : diasMasAntigua >= 2 ? 'rojo' : 'aviso'

  // Agrupado por dia -> dentro, resumen por plataforma
  const porDia = useMemo(() => {
    const map = new Map<string, Orden[]>()
    for (const o of pendientes) {
      const arr = map.get(o.fecha_cobro) ?? []
      arr.push(o); map.set(o.fecha_cobro, arr)
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [pendientes])

  const resumenCanal = (lista: Orden[]) => {
    const m = new Map<string, { cobrado: number; reservar: number; n: number }>()
    for (const o of lista) {
      const r = m.get(o.plataforma) ?? { cobrado: 0, reservar: 0, n: 0 }
      r.cobrado += Number(o.importe_cobro); r.reservar += Number(o.importe_reservar); r.n += 1
      m.set(o.plataforma, r)
    }
    return Array.from(m.entries()).sort((a, b) => b[1].reservar - a[1].reservar)
  }

  /* ── Acciones ── */
  async function marcarCumplida(o: Orden) {
    await supabase.from('reserva_ordenes')
      .update({ estado: 'CUMPLIDA', fecha_cumplida: hoyISO() })
      .eq('id', o.id)
    await supabase.from('reserva_movimientos').insert({
      fecha: hoyISO(), tipo: 'DOTACION', importe: o.importe_reservar,
      nota: `${o.plataforma} · cobro ${o.fecha_cobro}`,
    })
  }
  async function barrerLista(lista: Orden[], etiqueta: string) {
    if (lista.length === 0 || busy) return
    setBusy(true)
    for (const o of lista) await marcarCumplida(o)
    setMsg(`Hecho: ${etiqueta} · ${fmtEur(lista.reduce((a, o) => a + Number(o.importe_reservar), 0), { decimals: 2 })} al fondo`)
    await cargar()
    setBusy(false)
  }
  async function omitir(o: Orden) {
    await supabase.from('reserva_ordenes').update({ estado: 'OMITIDA' }).eq('id', o.id)
    cargar()
  }
  async function guardarPct() {
    const p = Math.min(35, Math.max(0, pctEdit))
    setBusy(true)
    await supabase.from('reserva_config').update({ pct: p, updated_at: new Date().toISOString() }).eq('id', 1)
    for (const o of pendientes) {
      await supabase.from('reserva_ordenes')
        .update({ pct_aplicado: p, importe_reservar: Math.round(Number(o.importe_cobro) * p) / 100 })
        .eq('id', o.id)
    }
    setMsg(`Porcentaje guardado: ${p}%`)
    await cargar()
    setBusy(false)
  }
  async function toggleActivo() {
    if (!cfg) return
    await supabase.from('reserva_config').update({ activo: !cfg.activo }).eq('id', 1)
    cargar()
  }
  const [retImporte, setRetImporte] = useState(0)
  const [retDestino, setRetDestino] = useState('NOMINAS')
  async function registrarRetirada() {
    if (retImporte <= 0) return
    await supabase.from('reserva_movimientos').insert({
      fecha: hoyISO(), tipo: 'RETIRADA', importe: retImporte,
      destino: retDestino, autorizado: AUTORIZADOS.includes(retDestino),
    })
    setMsg(`Retirada registrada: ${fmtEur(retImporte, { decimals: 2 })} → ${retDestino}`)
    setRetImporte(0)
    cargar()
  }

  if (loading) {
    return (
      <div style={{ background: CREMA, minHeight: '100vh', padding: 40 }}>
        <span style={{ ...d('20px'), color: GRIS }}>Cargando reservas…</span>
      </div>
    )
  }

  const heroImporte = totalHoy > 0 ? totalHoy : totalSemana > 0 ? totalSemana : totalPendiente
  const heroTitulo = totalHoy > 0 ? 'Aparta hoy' : totalSemana > 0 ? 'Aparta esta semana' : pendientes.length > 0 ? 'Pendiente de apartar' : 'Todo al día'

  return (
    <div style={{ background: CREMA, minHeight: '100vh', padding: '28px 32px 60px' }}>

      {/* ── CABECERA ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <span style={eyebrow(AMA)}>Tesorería · Plan de ahorro</span>
          <h1 style={{ ...d('42px'), margin: '10px 0 4px' }}>Reservas</h1>
          <p style={{ fontFamily: LEX, fontSize: 13, color: GRIS, margin: 0, maxWidth: 720 }}>
            El {cfg?.pct ?? 5}% de cada cobro de plataforma va al fondo. Desde el {cfg?.fecha_inicio ?? '2026-07-12'}. No es un gasto: no toca el P&G.
          </p>
        </div>
        <button onClick={() => setVerConfig(v => !v)} style={{ ...btn, background: verConfig ? INK : '#fff', color: verConfig ? AMA : INK }}>
          ⚙ Ajustes
        </button>
      </div>

      {msg && (
        <div style={{ background: VERDE, color: '#fff', border: BORDER_CARD, boxShadow: SHADOW, padding: '12px 16px', marginBottom: 16, fontFamily: OSW, fontWeight: 600, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* ── HERO: qué tienes que hacer AHORA ── */}
      <div style={{
        background: nivel === 'ok' ? VERDE : nivel === 'bloqueo' ? OSC : nivel === 'rojo' ? ROJO : AMA,
        color: nivel === 'aviso' ? INK : (nivel === 'bloqueo' ? D1 : '#fff'),
        border: BORDER, boxShadow: SHADOW, padding: '26px 28px', marginBottom: 18,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20,
      }}>
        <div>
          <div style={{ fontFamily: OSW, fontWeight: 600, fontSize: 15, letterSpacing: 2.5, textTransform: 'uppercase', opacity: 0.85 }}>
            {heroTitulo}
          </div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 64, lineHeight: 0.95, letterSpacing: '-2px', marginTop: 6 }}>
            {pendientes.length === 0 ? '0 €' : fmtEur(heroImporte, { decimals: 2 })}
          </div>
          <div style={{ fontFamily: LEX, fontSize: 13, marginTop: 10, opacity: 0.9 }}>
            {pendientes.length === 0
              ? 'No hay traspasos pendientes. Cuando entre un cobro, aquí verás cuánto apartar.'
              : <>Traspasa este importe a la cuenta de reserva del BBVA.
                 {totalPendiente > heroImporte && <> Acumulado total: <strong>{fmtEur(totalPendiente, { decimals: 2 })}</strong> ({pendientes.length} cobros).</>}
                 {diasMasAntigua >= 2 && <> El más antiguo lleva <strong>{diasMasAntigua} días</strong> esperando.</>}
                </>}
          </div>
        </div>
        {pendientes.length > 0 && (
          <button
            disabled={busy}
            onClick={() => barrerLista(pendientes, 'todo el pendiente')}
            style={{
              ...btn, fontSize: 16, padding: '16px 26px',
              background: nivel === 'aviso' ? INK : '#fff',
              color: nivel === 'aviso' ? AMA : INK,
              opacity: busy ? 0.6 : 1,
            }}>
            {busy ? 'Registrando…' : `He traspasado ${fmtEur(totalPendiente, { decimals: 2 })}`}
          </button>
        )}
      </div>

      {/* ── 3 CARDS DE ESTADO ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 18 }}>

        {/* Saldo + cobertura */}
        <div style={card}>
          <span style={eyebrow(VERDE, '#fff')}>Fondo acumulado</span>
          <div style={{ ...d('46px'), marginTop: 12 }}>{E2(saldo)} €</div>
          <div style={{ height: 18, border: `2px solid ${INK}`, background: TRACK, marginTop: 16, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, cobertura)}%`, height: '100%', background: colorCob, transition: 'width .5s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
            <span style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS }}>
              de {fmtEur(fijosMes, { decimals: 0 })} de gastos fijos/mes
            </span>
            <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, color: colorCob }}>{P0(cobertura)}</span>
          </div>
          <div style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS, marginTop: 6 }}>
            Cuando esta barra llegue al 100%, las nóminas, la SS y el alquiler del mes están cubiertos antes de empezar.
          </div>
        </div>

        {/* Ritmo del mes */}
        <div style={card}>
          <span style={eyebrow(AZUL, '#fff')}>Este mes</span>
          <div style={{ ...d('46px', VERDE), marginTop: 12 }}>{ES(dotadoMes)}</div>
          <div style={{ fontFamily: LEX, fontSize: 12.5, color: GRIS, marginTop: 10, lineHeight: 1.5 }}>
            Dotado al fondo en {new Date().toLocaleDateString('es-ES', { month: 'long' })}.
            {totalSemana > 0 && <> Esta semana quedan <strong style={{ color: INK }}>{fmtEur(totalSemana, { decimals: 2 })}</strong> por apartar.</>}
          </div>
          {fugas.length > 0 && (
            <div style={{ marginTop: 12, background: ROJO, color: '#fff', border: `2px solid ${INK}`, padding: '8px 12px', fontFamily: OSW, fontWeight: 600, fontSize: 12.5, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              ⚠ {fugas.length} fuga{fugas.length === 1 ? '' : 's'} · {fmtEur(fugas.reduce((a, f) => a + Number(f.importe), 0), { decimals: 2 })}
            </div>
          )}
        </div>

        {/* Retirada */}
        <div style={card}>
          <span style={eyebrow(GRANATE, '#fff')}>Pagar desde el fondo</span>
          <p style={{ fontFamily: LEX, fontSize: 12, color: GRIS, margin: '12px 0 12px', lineHeight: 1.5 }}>
            Solo para <strong style={{ color: INK }}>nóminas, SS, alquiler, suministros, préstamos e impuestos</strong>. Otro destino = fuga marcada en rojo.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input type="number" min={0} step={0.01} value={retImporte || ''} placeholder="Importe €"
              onChange={e => setRetImporte(parseFloat(e.target.value) || 0)}
              style={inputBase} />
            <select value={retDestino} onChange={e => setRetDestino(e.target.value)} style={{ ...inputBase, textAlign: 'left', fontSize: 13, letterSpacing: 1 }}>
              {DESTINOS.map(dd => <option key={dd} value={dd}>{dd}</option>)}
            </select>
          </div>
          <button onClick={registrarRetirada} style={{ ...btn, background: GRANATE, color: '#fff', width: '100%', marginTop: 10 }}>
            Registrar pago
          </button>
        </div>
      </div>

      {/* ── AJUSTES (plegado) ── */}
      {verConfig && (
        <div style={{ ...card, marginBottom: 18, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={eyebrow(AMA)}>Porcentaje de barrido</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <input type="number" min={0} max={35} step={0.5} value={pctEdit}
              onChange={e => setPctEdit(parseFloat(e.target.value) || 0)}
              style={{ ...inputBase, width: 110, fontSize: 34 }} />
            <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 28, color: GRIS }}>%</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[5, 6, 7, 8, 9, 10].map(v => (
              <button key={v} onClick={() => setPctEdit(v)}
                style={{ ...pill, background: pctEdit === v ? INK : '#fff', color: pctEdit === v ? AMA : INK }}>{v}%</button>
            ))}
          </div>
          <button disabled={busy} onClick={guardarPct} style={{ ...btn, background: INK, color: '#fff', opacity: busy ? 0.6 : 1 }}>Guardar</button>
          <button onClick={toggleActivo} style={{ ...btn, background: cfg?.activo ? VERDE : '#fff', color: cfg?.activo ? '#fff' : GRIS }}>
            {cfg?.activo ? 'Barrido activo' : 'Barrido apagado'}
          </button>
        </div>
      )}

      {/* ── ÓRDENES POR DÍA ── */}
      {porDia.map(([dia, lista]) => {
        const totalDia = lista.reduce((a, o) => a + Number(o.importe_reservar), 0)
        const cobradoDia = lista.reduce((a, o) => a + Number(o.importe_cobro), 0)
        const canales = resumenCanal(lista)
        const abierto = !!verDetalle[dia]
        const esHoy = dia === hoy
        return (
          <div key={dia} style={{ ...card, marginBottom: 16, padding: 0, overflow: 'hidden' }}>
            {/* Cabecera del día */}
            <div style={{
              background: esHoy ? AMA : CLARO, borderBottom: `3px solid ${INK}`,
              padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
            }}>
              <div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 19, letterSpacing: 0.5, textTransform: 'uppercase', color: INK }}>
                  {esHoy ? '● Hoy · ' : ''}{fechaBonita(dia)}
                </div>
                <div style={{ fontFamily: LEX, fontSize: 12, color: '#5a5344', marginTop: 2 }}>
                  {lista.length} cobro{lista.length === 1 ? '' : 's'} · entraron {fmtEur(cobradoDia, { decimals: 2 })}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 28, color: VERDE }}>{fmtEur(totalDia, { decimals: 2 })}</span>
                <button disabled={busy} onClick={() => barrerLista(lista, `barrido del ${dia}`)}
                  style={{ ...btn, background: INK, color: AMA, opacity: busy ? 0.6 : 1 }}>
                  He traspasado esto
                </button>
              </div>
            </div>

            {/* Resumen por plataforma */}
            <div style={{ padding: '14px 20px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {canales.map(([plat, r]) => (
                <div key={plat} style={{
                  border: `2px solid ${INK}`, background: canalColor(plat),
                  color: canalTextoOscuro(plat) ? INK : '#fff',
                  padding: '8px 14px', display: 'flex', alignItems: 'baseline', gap: 10,
                }}>
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>{plat}</span>
                  <span style={{ fontFamily: LEX, fontSize: 11, opacity: 0.85 }}>{r.n}×</span>
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 17 }}>{fmtEur(r.reservar, { decimals: 2 })}</span>
                </div>
              ))}
              <button onClick={() => setVerDetalle(v => ({ ...v, [dia]: !abierto }))}
                style={{ ...btnMini, background: '#fff', color: GRIS, marginLeft: 'auto' }}>
                {abierto ? 'Ocultar detalle' : `Ver ${lista.length} cobros`}
              </button>
            </div>

            {/* Detalle línea a línea (plegado por defecto) */}
            {abierto && (
              <div style={{ borderTop: `2px solid ${INK}` }}>
                {lista.map((o, i) => (
                  <div key={o.id} style={{
                    display: 'grid', gridTemplateColumns: '10px 120px 1fr 110px auto', alignItems: 'center', gap: 12,
                    padding: '9px 20px', background: '#fff',
                    borderBottom: i < lista.length - 1 ? '1px solid rgba(0,0,0,.1)' : 'none',
                  }}>
                    <span style={{ width: 10, height: 24, background: canalColor(o.plataforma), border: `1.5px solid ${INK}` }} />
                    <span style={{ fontFamily: OSW, fontWeight: 600, fontSize: 13, color: INK }}>{o.plataforma}</span>
                    <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>cobrado {fmtEur(o.importe_cobro, { decimals: 2 })}</span>
                    <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 17, color: VERDE, textAlign: 'right' }}>{fmtEur(o.importe_reservar, { decimals: 2 })}</span>
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button disabled={busy} onClick={() => barrerLista([o], `${o.plataforma} ${o.fecha_cobro}`)} style={{ ...btnMini, background: VERDE, color: '#fff' }}>Hecho</button>
                      <button onClick={() => omitir(o)} style={{ ...btnMini, background: '#fff', color: GRIS }}>Omitir</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {pendientes.length === 0 && (
        <div style={{ ...card, marginBottom: 16, textAlign: 'center', padding: '30px 20px' }}>
          <div style={{ ...d('24px', VERDE) }}>✓ Todo barrido</div>
          <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS, marginTop: 8 }}>
            La próxima orden aparecerá sola cuando el robot suba el siguiente cobro de plataforma.
          </div>
        </div>
      )}

      {/* ── HISTORIAL ── */}
      <div style={card}>
        <span style={eyebrow(INK, AMA)}>Movimientos del fondo</span>
        {movs.length === 0 && (
          <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS, padding: '18px 0 4px' }}>
            Sin movimientos todavía. El primero se creará cuando marques tu primer traspaso.
          </div>
        )}
        {movs.map((m, i) => (
          <div key={m.id} style={{
            display: 'grid', gridTemplateColumns: '105px 82px 1fr 140px', alignItems: 'center', gap: 12,
            padding: '11px 0', borderBottom: i < movs.length - 1 ? '1px solid rgba(0,0,0,.1)' : 'none',
          }}>
            <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>{m.fecha}</span>
            <span style={{
              fontFamily: OSW, fontWeight: 700, fontSize: 11, letterSpacing: 1, textAlign: 'center',
              padding: '4px 6px', border: `2px solid ${INK}`, textTransform: 'uppercase',
              background: m.tipo === 'DOTACION' ? VERDE : m.autorizado ? CLARO : ROJO,
              color: m.tipo === 'DOTACION' ? '#fff' : m.autorizado ? INK : '#fff',
            }}>
              {m.tipo === 'DOTACION' ? 'Entra' : m.autorizado ? 'Sale' : 'Fuga'}
            </span>
            <span style={{ fontFamily: LEX, fontSize: 12.5, color: '#5a5344' }}>{m.destino ?? m.nota ?? '—'}</span>
            <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 17, textAlign: 'right', color: m.tipo === 'DOTACION' ? VERDE : ROJO }}>
              {ES(m.tipo === 'DOTACION' ? Number(m.importe) : -Number(m.importe))} €
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── estilos base ── */
const card: CSSProperties = {
  background: '#fff', border: BORDER_CARD, boxShadow: SHADOW, padding: '18px 20px',
}
const btn: CSSProperties = {
  border: BORDER_CARD, boxShadow: '3px 3px 0 var(--neo-shadow-color)', padding: '11px 18px',
  fontFamily: OSW, fontWeight: 700, fontSize: 13.5, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer',
}
const btnMini: CSSProperties = {
  border: `2px solid ${INK}`, padding: '6px 10px',
  fontFamily: OSW, fontWeight: 700, fontSize: 11.5, letterSpacing: 0.5, textTransform: 'uppercase', cursor: 'pointer',
}
const pill: CSSProperties = {
  border: `2px solid ${INK}`, padding: '6px 12px',
  fontFamily: OSW, fontWeight: 700, fontSize: 13, cursor: 'pointer',
}
const inputBase: CSSProperties = {
  padding: '10px 12px', border: `3px solid ${INK}`, background: '#fff',
  fontFamily: OSW, fontWeight: 700, fontSize: 18, textAlign: 'right', outline: 'none',
}
