/**
 * FondoReserva — Fondo de maniobra. Neobrutal Food-Pop (tokens canonicos).
 *
 * Extraido de la antigua pagina Reservas para poder vivir como pestaña dentro
 * de Pagos y Cobros. Incluye:
 *  - Barrido de cobros de plataforma al fondo (DOTACION vinculada, reversible).
 *  - Boton "Deshacer" por dotacion (doble confirmacion) via RPC transaccional.
 *  - Cobertura contra el objetivo REAL de fijos (reserva_config.objetivo_fijos_mes).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import {
  OSW, LEX, INK, CREMA, CLARO, OSC, D1, SHADOW, BORDER_CARD,
  VERDE, ROJO, AMA, NAR, AZUL, GRANATE, GRIS, CORP, CLARA, eyebrow, d, E2, EUR, P0,
} from '@/styles/neobrutal'
import { fmtEur } from '@/lib/format'

interface Config { id: number; pct: number; activo: boolean; fecha_inicio: string; objetivo_fijos_mes: number }
interface Orden {
  id: string; fecha_cobro: string; plataforma: string
  importe_cobro: number; pct_aplicado: number; importe_reservar: number; estado: string
}
interface Movimiento {
  id: string; fecha: string; tipo: string; importe: number
  destino: string | null; autorizado: boolean; nota: string | null
}
interface Agenda {
  hoy: number; hoy_n: number; semana: number; semana_n: number
  total: number; total_n: number; barrido_mes: number; objetivo_mes: number
}
interface FijoMes { concepto: string; importe: number; dia: string; estimado: boolean }

const DESTINOS = ['NOMINAS', 'SS', 'ALQUILER', 'SUMINISTROS', 'PRESTAMO', 'IMPUESTOS', 'OTRO']
const AUTORIZADOS = ['NOMINAS', 'SS', 'ALQUILER', 'SUMINISTROS', 'PRESTAMO', 'IMPUESTOS']

function canalKey(plataforma: string): string {
  const p = plataforma.toUpperCase()
  if (p.includes('UBER')) return 'uber'
  if (p.includes('GLOVO')) return 'glovo'
  if (p.includes('JUST')) return 'je'
  return 'dir'
}
function fechaBonita(iso: string): string {
  const dt = new Date(iso + 'T00:00:00')
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const diff = Math.round((hoy.getTime() - dt.getTime()) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  return dt.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
}

export function FondoReserva({ embedded = false }: { embedded?: boolean }) {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [movs, setMovs] = useState<Movimiento[]>([])
  const [fijosMedia, setFijosMedia] = useState(0)
  const [objetivoReal, setObjetivoReal] = useState(0)
  const [saldoTeorico, setSaldoTeorico] = useState(0)
  const [fijosMes, setFijosMes] = useState<FijoMes[]>([])
  const [agenda, setAgenda] = useState<Agenda | null>(null)
  const [loading, setLoading] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [pctEdit, setPctEdit] = useState(5)
  const [confirmDeshacer, setConfirmDeshacer] = useState<string | null>(null)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function cargar() {
    const [c, o, m, f, a, p, fm] = await Promise.all([
      supabase.from('reserva_config').select('*').eq('id', 1).single(),
      supabase.from('reserva_ordenes').select('*').order('fecha_cobro', { ascending: false }).limit(300),
      supabase.from('reserva_movimientos').select('*').order('fecha', { ascending: false }).limit(100),
      supabase.from('v_reserva_fijos_mes').select('fijos_mes').single(),
      supabase.from('v_reserva_agenda').select('*').single(),
      supabase.from('v_reserva_panel').select('saldo_teorico').single(),
      supabase.from('v_tesoreria_fijos_mes').select('concepto,importe,dia,estimado').order('dia', { ascending: true }).order('concepto', { ascending: true }),
    ])
    setFijosMes(((fm.data ?? []) as FijoMes[]).map(r => ({ ...r, importe: Number(r.importe) })))
    if (c.data) {
      const cd = c.data as Config
      setCfg(cd); setPctEdit(Number(cd.pct)); setObjetivoReal(Number(cd.objetivo_fijos_mes ?? 0))
    }
    setSaldoTeorico(Number((p.data as { saldo_teorico?: number } | null)?.saldo_teorico ?? 0))
    setOrdenes((o.data ?? []) as Orden[])
    setMovs((m.data ?? []) as Movimiento[])
    setFijosMedia(Number((f.data as { fijos_mes?: number } | null)?.fijos_mes ?? 0))
    if (a.data) {
      const raw = a.data as Record<string, unknown>
      setAgenda({
        hoy: Number(raw.hoy ?? 0), hoy_n: Number(raw.hoy_n ?? 0),
        semana: Number(raw.semana ?? 0), semana_n: Number(raw.semana_n ?? 0),
        total: Number(raw.total ?? 0), total_n: Number(raw.total_n ?? 0),
        barrido_mes: Number(raw.barrido_mes ?? 0), objetivo_mes: Number(raw.objetivo_mes ?? 0),
      })
    }
    setLoading(false)
  }
  useEffect(() => { cargar(); return () => { if (confirmTimer.current) clearTimeout(confirmTimer.current) } }, [])

  const pendientes = useMemo(() => ordenes.filter(o => o.estado === 'PENDIENTE'), [ordenes])
  const totalPendiente = agenda?.total ?? 0
  const dotado = useMemo(() => movs.filter(m => m.tipo === 'DOTACION').reduce((a, m) => a + Number(m.importe), 0), [movs])
  const retirado = useMemo(() => movs.filter(m => m.tipo === 'RETIRADA').reduce((a, m) => a + Number(m.importe), 0), [movs])
  // Saldo real desde el servidor (v_reserva_panel), no la suma de los últimos 100 movimientos.
  const saldo = saldoTeorico
  const fugas = useMemo(() => movs.filter(m => m.tipo === 'RETIRADA' && !m.autorizado), [movs])
  // Cobertura contra el objetivo REAL de fijos del mes (no la media historica).
  const objetivo = objetivoReal > 0 ? objetivoReal : fijosMedia
  const cobertura = objetivo > 0 ? (saldo / objetivo) * 100 : 0
  const colorCob = cobertura >= 100 ? VERDE : cobertura >= 60 ? AMA : ROJO

  // "Hasta dónde llega el fondo": rellena los fijos del mes (ordenados por fecha)
  // con el saldo actual y con el saldo + lo pendiente de barrer. Marca cada fijo
  // como cubierto ya / cubierto si barres lo pendiente / al descubierto.
  const alcance = useMemo(() => {
    const conPendiente = saldo + (agenda?.total ?? 0)
    let acc = 0
    let nCub = 0, nBar = 0
    let ultimoCub = ''
    let faltaSiguiente = 0
    const rows = fijosMes.map(fj => {
      acc += fj.importe
      let estado: 'cub' | 'bar' | 'desc'
      if (acc <= saldo + 0.001) { estado = 'cub'; nCub++; ultimoCub = fj.concepto }
      else {
        estado = acc <= conPendiente + 0.001 ? 'bar' : 'desc'
        if (estado === 'bar') nBar++
        if (faltaSiguiente === 0) faltaSiguiente = acc - saldo // primer fijo no cubierto por el saldo
      }
      return { ...fj, estado }
    })
    return { rows, nCub, nBar, ultimoCub, faltaSiguiente, total: fijosMes.length }
  }, [fijosMes, saldo, agenda])

  const diasMasAntigua = useMemo(() => {
    if (pendientes.length === 0) return 0
    const min = pendientes.reduce((a, o) => (o.fecha_cobro < a ? o.fecha_cobro : a), pendientes[0].fecha_cobro)
    return Math.floor((Date.now() - new Date(min + 'T00:00:00').getTime()) / 86400000)
  }, [pendientes])
  const nivel: 'ok' | 'aviso' | 'rojo' | 'bloqueo' =
    pendientes.length === 0 ? 'ok' : diasMasAntigua >= 5 ? 'bloqueo' : diasMasAntigua >= 2 ? 'rojo' : 'aviso'

  const mixCanal = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const o of pendientes) {
      const k = canalKey(o.plataforma)
      acc[k] = (acc[k] ?? 0) + Number(o.importe_reservar)
    }
    return acc
  }, [pendientes])

  const porDia = useMemo(() => {
    const m = new Map<string, Orden[]>()
    for (const o of pendientes) {
      const arr = m.get(o.fecha_cobro) ?? []
      arr.push(o); m.set(o.fecha_cobro, arr)
    }
    return Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [pendientes])

  async function guardarPct() {
    const p = Math.min(35, Math.max(0, pctEdit))
    setOcupado(true)
    await supabase.from('reserva_config').update({ pct: p, updated_at: new Date().toISOString() }).eq('id', 1)
    for (const o of pendientes) {
      await supabase.from('reserva_ordenes')
        .update({ pct_aplicado: p, importe_reservar: Math.round(Number(o.importe_cobro) * p) / 100 })
        .in('id', [o.id])
    }
    setMsg(`Porcentaje guardado: ${p}% · órdenes pendientes recalculadas`)
    setOcupado(false)
    cargar()
  }

  async function toggleActivo() {
    if (!cfg) return
    await supabase.from('reserva_config').update({ activo: !cfg.activo }).eq('id', 1)
    cargar()
  }

  async function cumplirLote(lista: Orden[], etiqueta: string) {
    if (lista.length === 0) return
    setOcupado(true)
    const total = lista.reduce((a, o) => a + Number(o.importe_reservar), 0)
    // Barrido atómico en servidor: inserta la dotación y vincula las órdenes en
    // una sola transacción (movimiento_traspaso_id) para poder deshacer.
    const { error } = await supabase.rpc('fn_reserva_cumplir_lote', {
      p_orden_ids: lista.map(o => o.id),
      p_nota: `${etiqueta} · ${lista.length} cobro${lista.length === 1 ? '' : 's'}`,
    })
    setMsg(error ? `No se pudo ingresar: ${error.message}` : `Ingresado en el fondo: ${E2(total)} € (${etiqueta.toLowerCase()})`)
    setOcupado(false)
    cargar()
  }

  function pedirDeshacer(id: string) {
    if (confirmDeshacer === id) { ejecutarDeshacer(id); return }
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    setConfirmDeshacer(id)
    confirmTimer.current = setTimeout(() => setConfirmDeshacer(null), 4000)
  }
  async function ejecutarDeshacer(id: string) {
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    setConfirmDeshacer(null)
    setOcupado(true)
    await supabase.rpc('fn_reserva_deshacer_dotacion', { p_mov_id: id })
    setMsg('Dotación deshecha · reabiertas las órdenes')
    setOcupado(false)
    cargar()
  }

  async function omitir(o: Orden) {
    await supabase.from('reserva_ordenes').update({ estado: 'OMITIDA' }).eq('id', o.id)
    cargar()
  }

  const [retImporte, setRetImporte] = useState(0)
  const [retDestino, setRetDestino] = useState('NOMINAS')
  async function registrarRetirada() {
    if (retImporte <= 0 || retImporte > saldo) {
      setMsg(retImporte > saldo ? 'No puedes sacar más de lo que hay en el fondo' : 'Pon un importe')
      return
    }
    await supabase.from('reserva_movimientos').insert({
      fecha: new Date().toISOString().slice(0, 10),
      tipo: 'RETIRADA', importe: retImporte, destino: retDestino,
      autorizado: AUTORIZADOS.includes(retDestino),
    })
    setRetImporte(0)
    cargar()
  }

  const wrap: CSSProperties = embedded
    ? { padding: 0 }
    : { background: CREMA, minHeight: '100vh', padding: '28px 32px' }

  if (loading) {
    return <div style={{ ...(embedded ? {} : { background: CREMA, minHeight: '100vh' }), padding: embedded ? 8 : 40, ...d('20px'), color: GRIS }}>Cargando fondo…</div>
  }

  const ordenesHoy = pendientes.filter(o => o.fecha_cobro === new Date().toISOString().slice(0, 10))
  const semanaIni = (() => { const dt = new Date(); const day = (dt.getDay() + 6) % 7; dt.setDate(dt.getDate() - day); return dt.toISOString().slice(0, 10) })()
  const ordenesSemana = pendientes.filter(o => o.fecha_cobro >= semanaIni)

  return (
    <div style={wrap}>

      {/* CABECERA (solo en modo pagina completa) */}
      {!embedded && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <div>
            <span style={eyebrow(AMA)}>Tesorería · desde {cfg?.fecha_inicio ?? ''}</span>
            <h1 style={{ ...d('42px'), margin: '10px 0 0' }}>Reservas</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>Barrido</span>
            <button onClick={toggleActivo} style={{
              ...btn, padding: '8px 14px',
              background: cfg?.activo ? VERDE : '#fff', color: cfg?.activo ? '#fff' : GRIS,
            }}>{cfg?.activo ? 'Activo' : 'Apagado'}</button>
          </div>
        </div>
      )}

      {embedded && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>Barrido {cfg?.fecha_inicio ? `· desde ${cfg.fecha_inicio}` : ''}</span>
          <button onClick={toggleActivo} style={{
            ...btn, padding: '8px 14px',
            background: cfg?.activo ? VERDE : '#fff', color: cfg?.activo ? '#fff' : GRIS,
          }}>{cfg?.activo ? 'Activo' : 'Apagado'}</button>
        </div>
      )}

      {msg && (
        <div onClick={() => setMsg(null)} style={{ background: VERDE, color: '#fff', border: BORDER_CARD, boxShadow: SHADOW, padding: '12px 16px', marginBottom: 16, fontFamily: OSW, fontWeight: 600, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' }}>
          {msg}
        </div>
      )}

      {/* ══ HERO · QUE TIENES QUE INGRESAR ══ */}
      <div style={{
        background: nivel === 'bloqueo' ? OSC : AMA, color: nivel === 'bloqueo' ? D1 : INK,
        border: BORDER_CARD, boxShadow: SHADOW, padding: '24px 26px', marginBottom: 18,
      }}>
        {totalPendiente > 0 ? (
          <>
            <span style={eyebrow(nivel === 'bloqueo' ? ROJO : INK, nivel === 'bloqueo' ? '#fff' : AMA)}>
              {nivel === 'bloqueo' ? `Llevas ${diasMasAntigua} días sin barrer` : 'Ingresa en el fondo'}
            </span>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28, flexWrap: 'wrap', marginTop: 14 }}>
              <div>
                <div style={{ ...d('64px', nivel === 'bloqueo' ? D1 : INK) }}>{E2(totalPendiente)} €</div>
                <div style={{ fontFamily: LEX, fontSize: 13, marginTop: 6, opacity: 0.85 }}>
                  {agenda && agenda.hoy > 0 && <><strong>{E2(agenda.hoy)} € de hoy</strong> · </>}
                  {agenda && agenda.semana > 0 && agenda.semana !== totalPendiente && <>{E2(agenda.semana)} € de esta semana · </>}
                  {pendientes.length} cobro{pendientes.length === 1 ? '' : 's'} de plataforma al {cfg?.pct ?? 5}%
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginLeft: 'auto' }}>
                {ordenesHoy.length > 0 && (
                  <button disabled={ocupado} onClick={() => cumplirLote(ordenesHoy, 'Barrido de hoy')}
                    style={{ ...btn, background: '#fff', color: INK }}>
                    Ingresado lo de hoy · {E2(agenda?.hoy ?? 0)} €
                  </button>
                )}
                {ordenesSemana.length > 0 && ordenesSemana.length !== pendientes.length && (
                  <button disabled={ocupado} onClick={() => cumplirLote(ordenesSemana, 'Barrido de la semana')}
                    style={{ ...btn, background: '#fff', color: INK }}>
                    Lo de la semana · {E2(agenda?.semana ?? 0)} €
                  </button>
                )}
                <button disabled={ocupado} onClick={() => cumplirLote(pendientes, 'Barrido total')}
                  style={{ ...btn, background: VERDE, color: '#fff' }}>
                  Todo ingresado · {E2(totalPendiente)} €
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', height: 14, border: `2px solid ${INK}`, marginTop: 18, overflow: 'hidden', background: '#fff' }}>
              {(['uber', 'glovo', 'je'] as const).map(k => {
                const v = mixCanal[k] ?? 0
                if (v <= 0 || totalPendiente <= 0) return null
                return <div key={k} style={{ width: `${(v / totalPendiente) * 100}%`, background: CORP[k] }} />
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
              {(['uber', 'glovo', 'je'] as const).map(k => {
                const v = mixCanal[k] ?? 0
                if (v <= 0) return null
                const nombre = k === 'uber' ? 'Uber Eats' : k === 'glovo' ? 'Glovo' : 'Just Eat'
                return (
                  <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: LEX, fontSize: 11.5 }}>
                    <span style={{ width: 12, height: 12, background: CORP[k], border: `1.5px solid ${INK}`, display: 'inline-block' }} />
                    {nombre} <strong style={{ fontFamily: OSW }}>{E2(v)} €</strong>
                  </span>
                )
              })}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ ...d('40px') }}>Todo al día ✓</div>
            <div style={{ fontFamily: LEX, fontSize: 13.5 }}>
              No hay nada pendiente de ingresar. En cuanto entre un cobro de plataforma, aquí verás cuánto apartar.
            </div>
          </div>
        )}
      </div>

      {/* ══ TRES CARDS ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 18 }}>

        {/* SALDO + COBERTURA */}
        <div style={card}>
          <span style={eyebrow(VERDE, '#fff')}>Fondo acumulado</span>
          <div style={{ ...d('48px'), marginTop: 12 }}>{E2(saldo)} €</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontFamily: LEX, fontSize: 12, color: GRIS }}>
            <span>Entró <strong style={{ fontFamily: OSW, color: VERDE }}>{E2(dotado)}</strong></span>
            <span>Salió <strong style={{ fontFamily: OSW, color: ROJO }}>{E2(retirado)}</strong></span>
          </div>
          <div style={{ height: 18, border: `2px solid ${INK}`, background: CLARO, marginTop: 16, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, Math.max(0, cobertura))}%`, height: '100%', background: colorCob, transition: 'width .5s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
            <span style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS }}>
              de los <strong>{EUR(objetivo)}</strong> de fijos reales del mes
            </span>
            <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, color: colorCob }}>{P0(cobertura)}</span>
          </div>
          <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS, marginTop: 6 }}>
            Objetivo real = suma de gastos fijos activos del mes. Media 3 meses: <strong>{EUR(fijosMedia)}</strong>.
          </div>
        </div>

        {/* MES EN CURSO */}
        <div style={card}>
          <span style={eyebrow(AZUL, '#fff')}>Este mes</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div>
              <div style={{ ...d('34px', VERDE) }}>{E2(agenda?.barrido_mes ?? 0)} €</div>
              <div style={miniLbl}>Ya ingresado</div>
            </div>
            <div>
              <div style={{ ...d('34px', NAR) }}>{E2(totalPendiente)} €</div>
              <div style={miniLbl}>Pendiente</div>
            </div>
          </div>
          {(agenda?.objetivo_mes ?? 0) > 0 && (
            <>
              <div style={{ height: 14, border: `2px solid ${INK}`, background: CLARO, marginTop: 16, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, ((agenda?.barrido_mes ?? 0) / (agenda?.objetivo_mes ?? 1)) * 100)}%`,
                  height: '100%', background: VERDE,
                }} />
              </div>
              <div style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS, marginTop: 8 }}>
                Objetivo del mes: <strong style={{ fontFamily: OSW }}>{E2(agenda?.objetivo_mes ?? 0)} €</strong> ({cfg?.pct}% de lo cobrado)
              </div>
            </>
          )}
          <div style={{ marginTop: 14, borderTop: `2px solid ${INK}`, paddingTop: 12 }}>
            <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginRight: 8 }}>% de barrido</span>
            <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap', verticalAlign: 'middle' }}>
              {[5, 6, 7, 8, 9, 10].map(v => (
                <button key={v} onClick={() => setPctEdit(v)} style={{
                  ...pill, background: pctEdit === v ? INK : '#fff', color: pctEdit === v ? AMA : INK,
                }}>{v}</button>
              ))}
            </span>
            {pctEdit !== Number(cfg?.pct ?? 5) && (
              <button disabled={ocupado} onClick={guardarPct} style={{ ...btnMini, background: INK, color: AMA, marginLeft: 8 }}>
                Guardar {pctEdit}%
              </button>
            )}
          </div>
        </div>

        {/* RETIRADA */}
        <div style={card}>
          <span style={eyebrow(GRANATE, '#fff')}>Pagar con el fondo</span>
          <p style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 12, marginBottom: 12, lineHeight: 1.5 }}>
            Solo para <strong style={{ color: INK }}>nóminas, SS, alquiler, suministros, préstamos e impuestos</strong>. Otro destino queda marcado como fuga.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input type="number" min={0} step={0.01} value={retImporte || ''} placeholder="Importe €"
              onChange={e => setRetImporte(parseFloat(e.target.value) || 0)}
              style={{ padding: '10px 12px', border: BORDER_CARD, background: '#fff', fontFamily: OSW, fontWeight: 600, fontSize: 16, textAlign: 'right', outline: 'none', color: INK }} />
            <select value={retDestino} onChange={e => setRetDestino(e.target.value)}
              style={{ padding: '10px 12px', border: BORDER_CARD, background: '#fff', fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: 1, outline: 'none', color: INK }}>
              {DESTINOS.map(dd => <option key={dd} value={dd}>{dd}</option>)}
            </select>
          </div>
          <button onClick={registrarRetirada} disabled={saldo <= 0}
            style={{ ...btn, background: saldo > 0 ? GRANATE : CLARO, color: saldo > 0 ? '#fff' : GRIS, width: '100%', marginTop: 10, cursor: saldo > 0 ? 'pointer' : 'not-allowed' }}>
            Registrar retirada
          </button>
          {saldo <= 0 && (
            <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS, marginTop: 8 }}>El fondo está a cero: primero ingresa.</div>
          )}
          {fugas.length > 0 && (
            <div style={{ marginTop: 12, background: ROJO, color: '#fff', border: `2px solid ${INK}`, padding: '10px 12px', fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {fugas.length} fuga{fugas.length === 1 ? '' : 's'} · {E2(fugas.reduce((a, f) => a + Number(f.importe), 0))} €
            </div>
          )}
        </div>
      </div>

      {/* ══ HASTA DONDE LLEGA EL FONDO ══ */}
      {alcance.total > 0 && (
        <div style={{ ...card, marginBottom: 18 }}>
          <span style={eyebrow(AZUL, '#fff')}>Hasta dónde llega el fondo</span>
          <p style={{ fontFamily: LEX, fontSize: 12, color: GRIS, margin: '12px 0 4px', lineHeight: 1.5 }}>
            Tus fijos del mes ordenados por fecha, rellenados con el saldo de hoy
            (<strong style={{ color: VERDE }}>{E2(saldo)} €</strong>)
            {(agenda?.total ?? 0) > 0 && <> y con lo pendiente de barrer (<strong style={{ color: NAR }}>{E2(agenda?.total ?? 0)} €</strong>)</>}.
          </p>
          <div style={{ ...d('22px'), margin: '10px 0 4px' }}>
            {alcance.nCub === alcance.total
              ? <>El fondo cubre <span style={{ color: VERDE }}>los {alcance.total} fijos</span> ✓</>
              : <>El fondo cubre <span style={{ color: alcance.nCub > 0 ? VERDE : ROJO }}>{alcance.nCub} de {alcance.total}</span> fijos</>}
          </div>
          {alcance.nCub > 0 && alcance.nCub < alcance.total && (
            <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginBottom: 4 }}>
              Llegas hasta <strong style={{ color: INK }}>{alcance.ultimoCub}</strong>
              {alcance.faltaSiguiente > 0 && <> · te faltan <strong style={{ color: ROJO }}>{E2(alcance.faltaSiguiente)} €</strong> para el siguiente</>}
            </div>
          )}

          <div style={{ marginTop: 12, border: `2px solid ${INK}` }}>
            {alcance.rows.map((r, i) => {
              const est = r.estado === 'cub'
                ? { bg: VERDE, txt: '#fff', label: 'Cubierto', wash: '#E2F7EC' }
                : r.estado === 'bar'
                ? { bg: NAR, txt: '#fff', label: 'Con barrido', wash: '#FFF1E6' }
                : { bg: ROJO, txt: '#fff', label: 'Descubierto', wash: '#FFE8E9' }
              return (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '54px 1fr 110px 130px', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: est.wash,
                  borderBottom: i < alcance.rows.length - 1 ? `1px solid ${INK}` : 'none',
                }}>
                  <span style={{ fontFamily: LEX, fontSize: 12, color: INK }}>{r.dia.slice(8, 10)}/{r.dia.slice(5, 7)}</span>
                  <span style={{ fontFamily: LEX, fontSize: 12.5, color: INK }}>
                    {r.concepto}
                    {r.estimado && <span style={{ fontFamily: OSW, fontSize: 9.5, color: '#aabc00', marginLeft: 6, letterSpacing: 0.5 }}>🟡 EST</span>}
                  </span>
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 14, color: INK, textAlign: 'right' }}>{E2(r.importe)} €</span>
                  <span style={{
                    justifySelf: 'end', fontFamily: OSW, fontWeight: 700, fontSize: 10.5, letterSpacing: 0.5,
                    textTransform: 'uppercase', padding: '3px 8px', border: `2px solid ${INK}`,
                    background: est.bg, color: est.txt,
                  }}>{est.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══ ORDENES POR DIA ══ */}
      {porDia.length > 0 && (
        <div style={{ ...card, marginBottom: 18 }}>
          <span style={eyebrow(INK, AMA)}>Detalle por día</span>
          {porDia.map(([dia, lista]) => {
            const totalDia = lista.reduce((a, o) => a + Number(o.importe_reservar), 0)
            return (
              <div key={dia} style={{ marginTop: 16 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  background: CLARO, border: `2px solid ${INK}`, padding: '9px 14px',
                }}>
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 16, letterSpacing: 0.5, textTransform: 'uppercase', color: INK }}>
                    {fechaBonita(dia)} <span style={{ color: GRIS, fontSize: 13 }}>· {lista.length} cobro{lista.length === 1 ? '' : 's'}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <strong style={{ fontFamily: OSW, fontSize: 20, color: VERDE }}>{E2(totalDia)} €</strong>
                    <button disabled={ocupado} onClick={() => cumplirLote(lista, `Barrido del ${dia}`)} style={{ ...btnMini, background: INK, color: AMA }}>
                      Ingresado
                    </button>
                  </span>
                </div>
                {lista.map((o, i) => {
                  const k = canalKey(o.plataforma)
                  return (
                    <div key={o.id} style={{
                      display: 'grid', gridTemplateColumns: 'auto 1fr 120px auto', alignItems: 'center', gap: 12,
                      padding: '9px 14px', background: '#fff',
                      borderLeft: `2px solid ${INK}`, borderRight: `2px solid ${INK}`,
                      borderBottom: i === lista.length - 1 ? `2px solid ${INK}` : '1px solid var(--neo-track)',
                    }}>
                      <span style={{
                        fontFamily: OSW, fontWeight: 700, fontSize: 11.5, letterSpacing: 0.5, textTransform: 'uppercase',
                        background: CORP[k], color: CLARA[k] ? INK : '#fff',
                        border: `2px solid ${INK}`, padding: '3px 8px',
                      }}>{o.plataforma}</span>
                      <span style={{ fontFamily: LEX, fontSize: 12.5, color: GRIS }}>cobrado {E2(o.importe_cobro)} €</span>
                      <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 18, color: VERDE, textAlign: 'right' }}>{E2(o.importe_reservar)} €</span>
                      <button onClick={() => omitir(o)} style={{ ...btnMini, background: '#fff', color: GRIS }}>Omitir</button>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* ══ HISTORIAL ══ */}
      <div style={card}>
        <span style={eyebrow(INK, AMA)}>Movimientos del fondo</span>
        {movs.length === 0 && (
          <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS, padding: '16px 0 4px' }}>
            Sin movimientos todavía. El primero aparecerá cuando marques un barrido como ingresado.
          </div>
        )}
        {movs.map((m, i) => {
          const esConfirm = confirmDeshacer === m.id
          return (
            <div key={m.id} style={{
              display: 'grid', gridTemplateColumns: '105px 82px 1fr 130px 130px', alignItems: 'center', gap: 12,
              padding: '10px 0', borderBottom: i < movs.length - 1 ? '1px solid var(--neo-track)' : 'none',
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
              <span style={{ fontFamily: LEX, fontSize: 12.5, color: GRIS }}>{m.destino ?? m.nota ?? '—'}</span>
              <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 17, textAlign: 'right', color: m.tipo === 'DOTACION' ? VERDE : ROJO }}>
                {fmtEur(m.tipo === 'DOTACION' ? Number(m.importe) : -Number(m.importe), { decimals: 2, signed: true })}
              </span>
              {m.tipo === 'DOTACION' ? (
                <button disabled={ocupado} onClick={() => pedirDeshacer(m.id)} style={{
                  ...btnMini, justifySelf: 'end',
                  background: esConfirm ? ROJO : '#fff', color: esConfirm ? '#fff' : GRIS,
                  borderColor: esConfirm ? ROJO : INK,
                }}>
                  {esConfirm ? '¿Seguro?' : 'Deshacer'}
                </button>
              ) : <span />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const card: CSSProperties = {
  background: 'var(--neo-card, #fff)', border: BORDER_CARD, boxShadow: SHADOW, padding: '18px 20px',
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
  border: `2px solid ${INK}`, padding: '5px 10px',
  fontFamily: OSW, fontWeight: 700, fontSize: 13, cursor: 'pointer',
}
const miniLbl: CSSProperties = {
  fontFamily: OSW, fontWeight: 600, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, marginTop: 4,
}

export default FondoReserva
