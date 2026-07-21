/**
 * RESERVAS — Fondo de maniobra. Neobrutal Food-Pop (tokens canonicos del ERP).
 *
 * Flujo operativo:
 *  1. Cada cobro de plataforma (desde fecha_inicio) -> ORDEN de barrido (% del cobro neto).
 *  2. HERO accionable: "ingresa hoy X / esta semana Y" en un gesto.
 *  3. Marcas "hecho" -> DOTACION sin verificar.
 *  4. El robot sube el extracto -> fn_reserva_conciliar() casa el traspaso con la
 *     dotacion y la marca VERIFICADA. Si no marcaste antes, la crea y barre ordenes FIFO.
 *  5. Dotacion sin verificar > tolerancia -> alerta "el banco no lo confirma".
 *
 * Dotar la reserva NO es gasto -> no computa en P&G. Es tesoreria.
 */
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import {
  OSW, LEX, INK, CREMA, CLARO, OSC, D1, SHADOW, BORDER_CARD,
  VERDE, ROJO, AMA, NAR, AZUL, GRANATE, GRIS, CORP, CLARA, eyebrow, d, E2, EUR, P0,
} from '@/styles/neobrutal'
import { fmtEur } from '@/lib/format'

interface Config { id: number; pct: number; activo: boolean; fecha_inicio: string; match_traspaso: string | null; tolerancia_dias: number }
interface Orden {
  id: string; fecha_cobro: string; plataforma: string
  importe_cobro: number; pct_aplicado: number; importe_reservar: number; estado: string
}
interface Movimiento {
  id: string; fecha: string; tipo: string; importe: number
  destino: string | null; autorizado: boolean; nota: string | null; verificado: boolean
}
interface Agenda {
  hoy: number; hoy_n: number; semana: number; semana_n: number
  total: number; total_n: number; barrido_mes: number; objetivo_mes: number
}

const DESTINOS = ['NOMINAS', 'SS', 'ALQUILER', 'SUMINISTROS', 'PRESTAMO', 'IMPUESTOS', 'OTRO']
const AUTORIZADOS = ['NOMINAS', 'SS', 'ALQUILER', 'SUMINISTROS', 'PRESTAMO', 'IMPUESTOS']
const HOY_ISO = new Date().toISOString().slice(0, 10)

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

export default function Reservas() {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [movs, setMovs] = useState<Movimiento[]>([])
  const [fijosMes, setFijosMes] = useState(0)
  const [agenda, setAgenda] = useState<Agenda | null>(null)
  const [noVerif, setNoVerif] = useState<{ id: string; importe: number; dias_sin_verificar: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<{ txt: string; tipo: 'ok' | 'err' } | null>(null)
  const [pctEdit, setPctEdit] = useState(5)

  async function cargar() {
    const [c, o, m, f, a, nv] = await Promise.all([
      supabase.from('reserva_config').select('*').eq('id', 1).single(),
      supabase.from('reserva_ordenes').select('*').order('fecha_cobro', { ascending: false }).limit(300),
      supabase.from('reserva_movimientos').select('*').order('fecha', { ascending: false }).limit(100),
      supabase.from('v_reserva_fijos_mes').select('fijos_mes').single(),
      supabase.from('v_reserva_agenda').select('*').single(),
      supabase.from('v_reserva_no_verificadas').select('*'),
    ])
    if (c.data) { setCfg(c.data as Config); setPctEdit(Number((c.data as Config).pct)) }
    setOrdenes((o.data ?? []) as Orden[])
    setMovs((m.data ?? []) as Movimiento[])
    setFijosMes(Number((f.data as { fijos_mes?: number } | null)?.fijos_mes ?? 0))
    setNoVerif((nv.data ?? []) as { id: string; importe: number; dias_sin_verificar: number }[])
    if (a.data) {
      const r = a.data as Record<string, unknown>
      setAgenda({
        hoy: Number(r.hoy ?? 0), hoy_n: Number(r.hoy_n ?? 0),
        semana: Number(r.semana ?? 0), semana_n: Number(r.semana_n ?? 0),
        total: Number(r.total ?? 0), total_n: Number(r.total_n ?? 0),
        barrido_mes: Number(r.barrido_mes ?? 0), objetivo_mes: Number(r.objetivo_mes ?? 0),
      })
    }
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  const pendientes = useMemo(() => ordenes.filter(o => o.estado === 'PENDIENTE'), [ordenes])
  const totalPendiente = agenda?.total ?? 0
  const dotado = useMemo(() => movs.filter(m => m.tipo === 'DOTACION').reduce((a, m) => a + Number(m.importe), 0), [movs])
  const dotadoSinVerif = useMemo(() => movs.filter(m => m.tipo === 'DOTACION' && !m.verificado).reduce((a, m) => a + Number(m.importe), 0), [movs])
  const retirado = useMemo(() => movs.filter(m => m.tipo === 'RETIRADA').reduce((a, m) => a + Number(m.importe), 0), [movs])
  const saldo = dotado - retirado
  const fugas = useMemo(() => movs.filter(m => m.tipo === 'RETIRADA' && !m.autorizado), [movs])
  const cobertura = fijosMes > 0 ? (saldo / fijosMes) * 100 : 0
  const colorCob = cobertura >= 100 ? VERDE : cobertura >= 50 ? AMA : ROJO

  const diasMasAntigua = useMemo(() => {
    if (pendientes.length === 0) return 0
    const min = pendientes.reduce((a, o) => (o.fecha_cobro < a ? o.fecha_cobro : a), pendientes[0].fecha_cobro)
    return Math.floor((Date.now() - new Date(min + 'T00:00:00').getTime()) / 86400000)
  }, [pendientes])
  const nivel: 'ok' | 'aviso' | 'rojo' | 'bloqueo' =
    pendientes.length === 0 ? 'ok' : diasMasAntigua >= 5 ? 'bloqueo' : diasMasAntigua >= 2 ? 'rojo' : 'aviso'

  const mixCanal = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const o of pendientes) { const k = canalKey(o.plataforma); acc[k] = (acc[k] ?? 0) + Number(o.importe_reservar) }
    return acc
  }, [pendientes])

  const porDia = useMemo(() => {
    const m = new Map<string, Orden[]>()
    for (const o of pendientes) { const arr = m.get(o.fecha_cobro) ?? []; arr.push(o); m.set(o.fecha_cobro, arr) }
    return Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [pendientes])

  const ordenesHoy = useMemo(() => pendientes.filter(o => o.fecha_cobro === HOY_ISO), [pendientes])
  const semanaIni = useMemo(() => { const dt = new Date(); const day = (dt.getDay() + 6) % 7; dt.setDate(dt.getDate() - day); return dt.toISOString().slice(0, 10) }, [])
  const ordenesSemana = useMemo(() => pendientes.filter(o => o.fecha_cobro >= semanaIni), [pendientes, semanaIni])

  async function guardarPct() {
    const p = Math.min(35, Math.max(0, pctEdit))
    setOcupado(true)
    await supabase.from('reserva_config').update({ pct: p, updated_at: new Date().toISOString() }).eq('id', 1)
    // Recalcula todas las pendientes de una sola vez (redondeo en cliente por robustez)
    await Promise.all(pendientes.map(o =>
      supabase.from('reserva_ordenes')
        .update({ pct_aplicado: p, importe_reservar: Math.round(Number(o.importe_cobro) * p) / 100 })
        .eq('id', o.id)
    ))
    setMsg({ txt: `Porcentaje guardado: ${p}% · pendientes recalculadas`, tipo: 'ok' })
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
    const total = Math.round(lista.reduce((a, o) => a + Number(o.importe_reservar), 0) * 100) / 100
    await supabase.from('reserva_ordenes').update({ estado: 'CUMPLIDA', fecha_cumplida: HOY_ISO }).in('id', lista.map(o => o.id))
    await supabase.from('reserva_movimientos').insert({
      fecha: HOY_ISO, tipo: 'DOTACION', importe: total, verificado: false,
      nota: `${etiqueta} · ${lista.length} cobro${lista.length === 1 ? '' : 's'}`,
    })
    setMsg({ txt: `Apartado ${E2(total)} € · pendiente de que el banco lo confirme`, tipo: 'ok' })
    setOcupado(false)
    cargar()
  }

  async function omitir(o: Orden) {
    await supabase.from('reserva_ordenes').update({ estado: 'OMITIDA' }).eq('id', o.id)
    cargar()
  }

  async function detectarTraspasos() {
    setOcupado(true)
    const { data, error } = await supabase.rpc('fn_reserva_conciliar')
    setOcupado(false)
    if (error) { setMsg({ txt: 'No se pudo revisar el banco', tipo: 'err' }); return }
    const r = (data ?? {}) as { ok?: boolean; motivo?: string; verificadas?: number; creadas?: number }
    if (r.ok === false && r.motivo === 'sin_cuenta_reserva_configurada') {
      setMsg({ txt: 'Configura primero la cuenta de reserva (abajo) para que el robot la reconozca', tipo: 'err' })
      return
    }
    const tot = (r.verificadas ?? 0) + (r.creadas ?? 0)
    setMsg({ txt: tot > 0 ? `Banco revisado · ${tot} traspaso${tot === 1 ? '' : 's'} confirmado${tot === 1 ? '' : 's'}` : 'Banco revisado · sin traspasos nuevos', tipo: 'ok' })
    cargar()
  }

  const [cuentaEdit, setCuentaEdit] = useState('')
  useEffect(() => { setCuentaEdit(cfg?.match_traspaso ?? '') }, [cfg])
  async function guardarCuenta() {
    await supabase.from('reserva_config').update({ match_traspaso: cuentaEdit.trim() || null }).eq('id', 1)
    setMsg({ txt: 'Cuenta de reserva guardada', tipo: 'ok' })
    cargar()
  }

  const [retImporte, setRetImporte] = useState(0)
  const [retDestino, setRetDestino] = useState('NOMINAS')
  async function registrarRetirada() {
    if (retImporte <= 0) { setMsg({ txt: 'Pon un importe', tipo: 'err' }); return }
    if (retImporte > saldo) { setMsg({ txt: 'No puedes sacar más de lo que hay en el fondo', tipo: 'err' }); return }
    await supabase.from('reserva_movimientos').insert({
      fecha: HOY_ISO, tipo: 'RETIRADA', importe: retImporte, destino: retDestino,
      autorizado: AUTORIZADOS.includes(retDestino), verificado: false,
    })
    setRetImporte(0)
    cargar()
  }

  if (loading) {
    return <div style={{ background: CREMA, minHeight: '100vh', padding: 40, ...d('20px'), color: GRIS }}>Cargando reservas…</div>
  }

  return (
    <div style={{ background: CREMA, minHeight: '100vh', padding: '28px 32px' }}>

      {/* CABECERA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <span style={eyebrow(AMA)}>Tesorería · desde {cfg?.fecha_inicio ?? ''}</span>
          <h1 style={{ ...d('42px'), margin: '10px 0 0' }}>Reservas</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button disabled={ocupado} onClick={detectarTraspasos} style={{ ...btn, padding: '8px 14px', background: AZUL, color: '#fff' }}>
            Revisar banco
          </button>
          <button onClick={toggleActivo} style={{ ...btn, padding: '8px 14px', background: cfg?.activo ? VERDE : '#fff', color: cfg?.activo ? '#fff' : GRIS }}>
            {cfg?.activo ? 'Barrido activo' : 'Barrido apagado'}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ background: msg.tipo === 'ok' ? VERDE : ROJO, color: '#fff', border: BORDER_CARD, boxShadow: SHADOW, padding: '12px 16px', marginBottom: 16, fontFamily: OSW, fontWeight: 600, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase' }}>
          {msg.txt}
        </div>
      )}

      {/* ALERTA: dotaciones que el banco no confirma */}
      {noVerif.length > 0 && (
        <div style={{ background: ROJO, color: '#fff', border: BORDER_CARD, boxShadow: SHADOW, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 18, letterSpacing: 1, textTransform: 'uppercase' }}>El banco no confirma {noVerif.length} traspaso{noVerif.length === 1 ? '' : 's'}</div>
          <div style={{ fontFamily: LEX, fontSize: 12.5, marginTop: 4, opacity: 0.95 }}>
            Marcaste como hecho {E2(noVerif.reduce((a, n) => a + Number(n.importe), 0))} € pero no aparece el movimiento en la cuenta de reserva. Comprueba que hiciste el traspaso.
          </div>
        </div>
      )}

      {/* ══ HERO ══ */}
      <div style={{ background: nivel === 'bloqueo' ? OSC : AMA, color: nivel === 'bloqueo' ? D1 : INK, border: BORDER_CARD, boxShadow: SHADOW, padding: '24px 26px', marginBottom: 18 }}>
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
                  {pendientes.length} cobro{pendientes.length === 1 ? '' : 's'} al {cfg?.pct ?? 5}%
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginLeft: 'auto' }}>
                {ordenesHoy.length > 0 && (
                  <button disabled={ocupado} onClick={() => cumplirLote(ordenesHoy, 'Barrido de hoy')} style={{ ...btn, background: '#fff', color: INK }}>
                    Ingresado hoy · {E2(agenda?.hoy ?? 0)} €
                  </button>
                )}
                {ordenesSemana.length > 0 && ordenesSemana.length !== pendientes.length && (
                  <button disabled={ocupado} onClick={() => cumplirLote(ordenesSemana, 'Barrido de la semana')} style={{ ...btn, background: '#fff', color: INK }}>
                    La semana · {E2(agenda?.semana ?? 0)} €
                  </button>
                )}
                <button disabled={ocupado} onClick={() => cumplirLote(pendientes, 'Barrido total')} style={{ ...btn, background: VERDE, color: '#fff' }}>
                  Todo · {E2(totalPendiente)} €
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
            <div style={{ fontFamily: LEX, fontSize: 13.5 }}>Nada pendiente de ingresar. En cuanto entre un cobro de plataforma, aquí verás cuánto apartar.</div>
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
          {dotadoSinVerif > 0 && (
            <div style={{ fontFamily: LEX, fontSize: 11, color: NAR, marginTop: 4 }}>
              {E2(dotadoSinVerif)} € aún sin confirmar por el banco
            </div>
          )}
          <div style={{ height: 18, border: `2px solid ${INK}`, background: CLARO, marginTop: 14, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, Math.max(0, cobertura))}%`, height: '100%', background: colorCob, transition: 'width .5s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
            <span style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS }}>de los <strong>{EUR(fijosMes)}</strong> de fijos al mes</span>
            <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, color: colorCob }}>{P0(cobertura)}</span>
          </div>
          <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS, marginTop: 6 }}>Nóminas, SS, alquiler, suministros y servicios (media 3 meses).</div>
        </div>

        {/* ESTE MES + % */}
        <div style={card}>
          <span style={eyebrow(AZUL, '#fff')}>Este mes</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div><div style={{ ...d('34px', VERDE) }}>{E2(agenda?.barrido_mes ?? 0)} €</div><div style={miniLbl}>Ya ingresado</div></div>
            <div><div style={{ ...d('34px', NAR) }}>{E2(totalPendiente)} €</div><div style={miniLbl}>Pendiente</div></div>
          </div>
          {(agenda?.objetivo_mes ?? 0) > 0 && (
            <>
              <div style={{ height: 14, border: `2px solid ${INK}`, background: CLARO, marginTop: 16, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, ((agenda?.barrido_mes ?? 0) / (agenda?.objetivo_mes ?? 1)) * 100)}%`, height: '100%', background: VERDE }} />
              </div>
              <div style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS, marginTop: 8 }}>
                Objetivo del mes: <strong style={{ fontFamily: OSW }}>{E2(agenda?.objetivo_mes ?? 0)} €</strong> ({cfg?.pct}% de lo cobrado)
              </div>
            </>
          )}
          <div style={{ marginTop: 14, borderTop: `2px solid ${INK}`, paddingTop: 12, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginRight: 2 }}>% barrido</span>
            {[5, 6, 7, 8, 9, 10].map(v => (
              <button key={v} onClick={() => setPctEdit(v)} style={{ ...pill, background: pctEdit === v ? INK : '#fff', color: pctEdit === v ? AMA : INK }}>{v}</button>
            ))}
            {pctEdit !== Number(cfg?.pct ?? 5) && (
              <button disabled={ocupado} onClick={guardarPct} style={{ ...btnMini, background: INK, color: AMA }}>Guardar {pctEdit}%</button>
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
            Registrar pago
          </button>
          {saldo <= 0 && <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS, marginTop: 8 }}>El fondo está a cero: primero ingresa.</div>}
          {fugas.length > 0 && (
            <div style={{ marginTop: 12, background: ROJO, color: '#fff', border: `2px solid ${INK}`, padding: '10px 12px', fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {fugas.length} fuga{fugas.length === 1 ? '' : 's'} · {E2(fugas.reduce((a, f) => a + Number(f.importe), 0))} €
            </div>
          )}
        </div>
      </div>

      {/* ══ DETALLE POR DIA ══ */}
      {porDia.length > 0 && (
        <div style={{ ...card, marginBottom: 18 }}>
          <span style={eyebrow(INK, AMA)}>Detalle por día</span>
          {porDia.map(([dia, lista]) => {
            const totalDia = lista.reduce((a, o) => a + Number(o.importe_reservar), 0)
            return (
              <div key={dia} style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: CLARO, border: `2px solid ${INK}`, padding: '9px 14px' }}>
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 16, letterSpacing: 0.5, textTransform: 'uppercase', color: INK }}>
                    {fechaBonita(dia)} <span style={{ color: GRIS, fontSize: 13 }}>· {lista.length} cobro{lista.length === 1 ? '' : 's'}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <strong style={{ fontFamily: OSW, fontSize: 20, color: VERDE }}>{E2(totalDia)} €</strong>
                    <button disabled={ocupado} onClick={() => cumplirLote(lista, `Barrido del ${dia}`)} style={{ ...btnMini, background: INK, color: AMA }}>Ingresado</button>
                  </span>
                </div>
                {lista.map((o, i) => {
                  const k = canalKey(o.plataforma)
                  return (
                    <div key={o.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 120px auto', alignItems: 'center', gap: 12, padding: '9px 14px', background: '#fff', borderLeft: `2px solid ${INK}`, borderRight: `2px solid ${INK}`, borderBottom: i === lista.length - 1 ? `2px solid ${INK}` : '1px solid var(--neo-track)' }}>
                      <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 11.5, letterSpacing: 0.5, textTransform: 'uppercase', background: CORP[k], color: CLARA[k] ? INK : '#fff', border: `2px solid ${INK}`, padding: '3px 8px' }}>{o.plataforma}</span>
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
      <div style={{ ...card, marginBottom: 18 }}>
        <span style={eyebrow(INK, AMA)}>Movimientos del fondo</span>
        {movs.length === 0 && <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS, padding: '16px 0 4px' }}>Sin movimientos todavía. El primero aparecerá cuando marques un barrido como ingresado.</div>}
        {movs.map((m, i) => (
          <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '105px 82px 1fr auto 130px', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < movs.length - 1 ? '1px solid var(--neo-track)' : 'none' }}>
            <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>{m.fecha}</span>
            <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 11, letterSpacing: 1, textAlign: 'center', padding: '4px 6px', border: `2px solid ${INK}`, textTransform: 'uppercase', background: m.tipo === 'DOTACION' ? VERDE : m.autorizado ? CLARO : ROJO, color: m.tipo === 'DOTACION' ? '#fff' : m.autorizado ? INK : '#fff' }}>
              {m.tipo === 'DOTACION' ? 'Entra' : m.autorizado ? 'Sale' : 'Fuga'}
            </span>
            <span style={{ fontFamily: LEX, fontSize: 12.5, color: GRIS }}>{m.destino ?? m.nota ?? '—'}</span>
            <span>
              {m.tipo === 'DOTACION' && (
                <span style={{ fontFamily: OSW, fontWeight: 600, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', padding: '2px 7px', border: `1.5px solid ${m.verificado ? VERDE : NAR}`, color: m.verificado ? VERDE : NAR }}>
                  {m.verificado ? '✓ banco' : 'sin confirmar'}
                </span>
              )}
            </span>
            <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 17, textAlign: 'right', color: m.tipo === 'DOTACION' ? VERDE : ROJO }}>
              {fmtEur(m.tipo === 'DOTACION' ? Number(m.importe) : -Number(m.importe), { decimals: 2, signed: true })}
            </span>
          </div>
        ))}
      </div>

      {/* ══ COMO FUNCIONA + CUENTA ══ */}
      <div style={{ ...card, background: 'var(--neo-bg-2, #f3f0e8)' }}>
        <span style={eyebrow(GRIS, '#fff')}>Cómo se automatiza</span>
        <ol style={{ fontFamily: LEX, fontSize: 12.5, color: INK, lineHeight: 1.7, margin: '12px 0 14px', paddingLeft: 20 }}>
          <li>Entra un cobro de Uber/Glovo/Just Eat → se crea la orden con el {cfg?.pct ?? 5}% a apartar.</li>
          <li>Tú traspasas ese dinero en el BBVA y pulsas «Ingresado».</li>
          <li>El robot sube el extracto y <strong>confirma solo</strong> que el traspaso existe (sello «✓ banco»).</li>
          <li>Si dijiste «hecho» y el banco no lo confirma en {cfg?.tolerancia_dias ?? 3} días → alerta roja.</li>
        </ol>
        <div style={{ borderTop: `2px solid ${INK}`, paddingTop: 12 }}>
          <div style={{ fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: INK, marginBottom: 8 }}>Cuenta de reserva (para que el robot la reconozca)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={cuentaEdit} onChange={e => setCuentaEdit(e.target.value)} placeholder="Texto o IBAN del traspaso, ej. RESERVA o ES12…"
              style={{ flex: 1, minWidth: 240, padding: '10px 12px', border: BORDER_CARD, background: '#fff', fontFamily: LEX, fontSize: 13, outline: 'none', color: INK }} />
            <button onClick={guardarCuenta} style={{ ...btnMini, background: INK, color: AMA, padding: '8px 14px' }}>Guardar cuenta</button>
          </div>
          <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS, marginTop: 6 }}>
            {cfg?.match_traspaso ? `Ahora el robot busca "${cfg.match_traspaso}" en los traspasos del extracto.` : 'Sin configurar: el robot aún no puede confirmar traspasos automáticamente.'}
          </div>
        </div>
      </div>
    </div>
  )
}

const card: CSSProperties = { background: 'var(--neo-card, #fff)', border: BORDER_CARD, boxShadow: SHADOW, padding: '18px 20px' }
const btn: CSSProperties = { border: BORDER_CARD, boxShadow: '3px 3px 0 var(--neo-shadow-color)', padding: '11px 18px', fontFamily: OSW, fontWeight: 700, fontSize: 13.5, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' }
const btnMini: CSSProperties = { border: `2px solid ${INK}`, padding: '6px 10px', fontFamily: OSW, fontWeight: 700, fontSize: 11.5, letterSpacing: 0.5, textTransform: 'uppercase', cursor: 'pointer' }
const pill: CSSProperties = { border: `2px solid ${INK}`, padding: '5px 10px', fontFamily: OSW, fontWeight: 700, fontSize: 13, cursor: 'pointer' }
const miniLbl: CSSProperties = { fontFamily: OSW, fontWeight: 600, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, marginTop: 4 }
