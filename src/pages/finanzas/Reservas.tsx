/**
 * RESERVAS — Fondo de maniobra. Estilo Neobrutal Food-Pop.
 *
 * Cada cobro de plataforma (1.1.1 / 1.1.2 / 1.1.3) desde la fecha de arranque del plan
 * genera una ORDEN DE BARRIDO: un % del importe cobrado que hay que traspasar al fondo.
 *
 * El % se aplica sobre el NETO REAL (el cobro bancario ya es neto). No duplica logica
 * de neto (LEY-NETO-01): no calcula netos, lee lo que entro en banco.
 *
 * Dotar la reserva NO es un gasto -> no computa en P&G. Es tesoreria.
 */
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import {
  OSW, LEX, INK, CREMA, CLARO, SHADOW, BORDER_CARD,
  VERDE, ROJO, AMA, GRANATE, GRIS, eyebrow,
} from '@/styles/neobrutal'
import { fmtEur, fmtPct } from '@/lib/format'

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
const COLOR_CANAL: Record<string, string> = {
  'UBER EATS': '#06C167', GLOVO: '#FFC244', 'JUST EAT': '#FF8000',
}

export default function Reservas() {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [movs, setMovs] = useState<Movimiento[]>([])
  const [fijosMes, setFijosMes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [pctEdit, setPctEdit] = useState(5)

  async function cargar() {
    setLoading(true)
    const [c, o, m, f] = await Promise.all([
      supabase.from('reserva_config').select('*').eq('id', 1).single(),
      supabase.from('reserva_ordenes').select('*').order('fecha_cobro', { ascending: false }).limit(300),
      supabase.from('reserva_movimientos').select('*').order('fecha', { ascending: false }).limit(100),
      supabase.from('v_reserva_fijos_mes').select('fijos_mes').single(),
    ])
    if (c.data) { setCfg(c.data as Config); setPctEdit(Number((c.data as Config).pct)) }
    setOrdenes((o.data ?? []) as Orden[])
    setMovs((m.data ?? []) as Movimiento[])
    setFijosMes(Number((f.data as { fijos_mes?: number } | null)?.fijos_mes ?? 0))
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  const pendientes = useMemo(() => ordenes.filter(o => o.estado === 'PENDIENTE'), [ordenes])
  const totalPendiente = useMemo(() => pendientes.reduce((a, o) => a + Number(o.importe_reservar), 0), [pendientes])
  const cobradoPendiente = useMemo(() => pendientes.reduce((a, o) => a + Number(o.importe_cobro), 0), [pendientes])
  const dotado = useMemo(() => movs.filter(m => m.tipo === 'DOTACION').reduce((a, m) => a + Number(m.importe), 0), [movs])
  const retirado = useMemo(() => movs.filter(m => m.tipo === 'RETIRADA').reduce((a, m) => a + Number(m.importe), 0), [movs])
  const saldo = dotado - retirado
  const fugas = useMemo(() => movs.filter(m => m.tipo === 'RETIRADA' && !m.autorizado), [movs])
  const cobertura = fijosMes > 0 ? (saldo / fijosMes) * 100 : 0
  const colorCob = cobertura >= 100 ? VERDE : cobertura >= 50 ? AMA : ROJO

  const diasMasAntigua = useMemo(() => {
    if (pendientes.length === 0) return 0
    const min = pendientes.reduce((a, o) => (o.fecha_cobro < a ? o.fecha_cobro : a), pendientes[0].fecha_cobro)
    return Math.floor((Date.now() - new Date(min).getTime()) / 86400000)
  }, [pendientes])
  const nivel: 'ok' | 'aviso' | 'rojo' | 'bloqueo' =
    pendientes.length === 0 ? 'ok' : diasMasAntigua >= 5 ? 'bloqueo' : diasMasAntigua >= 2 ? 'rojo' : 'aviso'
  const bandaBg = nivel === 'bloqueo' ? INK : nivel === 'rojo' ? ROJO : AMA
  const bandaFg = nivel === 'aviso' ? INK : '#fff'

  // Agrupa las ordenes por dia de cobro
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
    await supabase.from('reserva_config').update({ pct: p, updated_at: new Date().toISOString() }).eq('id', 1)
    for (const o of pendientes) {
      await supabase.from('reserva_ordenes')
        .update({ pct_aplicado: p, importe_reservar: Math.round(Number(o.importe_cobro) * p) / 100 })
        .eq('id', o.id)
    }
    setMsg(`Porcentaje guardado: ${p}%`)
    cargar()
  }

  async function toggleActivo() {
    if (!cfg) return
    await supabase.from('reserva_config').update({ activo: !cfg.activo }).eq('id', 1)
    cargar()
  }

  async function marcarCumplida(o: Orden) {
    await supabase.from('reserva_ordenes')
      .update({ estado: 'CUMPLIDA', fecha_cumplida: new Date().toISOString().slice(0, 10) })
      .eq('id', o.id)
    await supabase.from('reserva_movimientos').insert({
      fecha: new Date().toISOString().slice(0, 10),
      tipo: 'DOTACION',
      importe: o.importe_reservar,
      nota: `${o.plataforma} · cobro ${o.fecha_cobro}`,
    })
  }

  async function barrerDia(dia: string, lista: Orden[]) {
    for (const o of lista) await marcarCumplida(o)
    setMsg(`Barrido del ${dia} registrado`)
    cargar()
  }

  async function barrerTodas() {
    for (const o of pendientes) await marcarCumplida(o)
    setMsg('Todas las órdenes registradas como traspasadas')
    cargar()
  }

  async function omitir(o: Orden) {
    await supabase.from('reserva_ordenes').update({ estado: 'OMITIDA' }).eq('id', o.id)
    cargar()
  }

  const [retImporte, setRetImporte] = useState(0)
  const [retDestino, setRetDestino] = useState('NOMINAS')
  async function registrarRetirada() {
    if (retImporte <= 0) return
    await supabase.from('reserva_movimientos').insert({
      fecha: new Date().toISOString().slice(0, 10),
      tipo: 'RETIRADA',
      importe: retImporte,
      destino: retDestino,
      autorizado: AUTORIZADOS.includes(retDestino),
    })
    setRetImporte(0)
    cargar()
  }

  if (loading) {
    return <div style={{ background: CREMA, minHeight: '100vh', padding: 40, fontFamily: OSW, fontSize: 18, letterSpacing: 2, textTransform: 'uppercase', color: INK }}>Cargando reservas…</div>
  }

  return (
    <div style={{ background: CREMA, minHeight: '100vh', padding: '28px 32px' }}>

      {/* CABECERA */}
      <div style={{ marginBottom: 20 }}>
        <span style={eyebrow(AMA)}>Tesorería</span>
        <h1 style={{ fontFamily: OSW, fontWeight: 700, fontSize: 44, lineHeight: 0.95, letterSpacing: '-1px', textTransform: 'uppercase', color: INK, margin: '10px 0 6px' }}>
          Reservas · Fondo de maniobra
        </h1>
        <p style={{ fontFamily: LEX, fontSize: 13.5, color: '#5a5344', maxWidth: 760, margin: 0 }}>
          Un <strong>{cfg?.pct ?? 5}%</strong> de cada cobro de plataforma se aparta para cubrir los gastos fijos y amortizar deuda con socios.
          Apartar dinero no es un gasto: no computa en el P&amp;G.
          {cfg?.fecha_inicio && <> El plan arranca el <strong>{cfg.fecha_inicio}</strong>: lo anterior no cuenta.</>}
        </p>
      </div>

      {msg && (
        <div style={{ background: VERDE, color: '#fff', border: BORDER_CARD, boxShadow: SHADOW, padding: '12px 16px', marginBottom: 16, fontFamily: OSW, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase' }}>
          {msg}
        </div>
      )}

      {/* BANDA DE ALERTA */}
      {nivel !== 'ok' && (
        <div style={{
          background: bandaBg, color: bandaFg, border: BORDER_CARD, boxShadow: SHADOW,
          padding: '16px 20px', marginBottom: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, letterSpacing: 1, textTransform: 'uppercase', lineHeight: 1 }}>
              {nivel === 'bloqueo' ? 'Reserva bloqueante' : nivel === 'rojo' ? 'Reserva en riesgo' : 'Reserva pendiente'}
            </div>
            <div style={{ fontFamily: LEX, fontSize: 13, marginTop: 6, opacity: 0.95 }}>
              {pendientes.length} cobro{pendientes.length === 1 ? '' : 's'} sin barrer · aparta <strong>{fmtEur(totalPendiente, { decimals: 2 })}</strong>
              {diasMasAntigua > 0 && <> · el más antiguo lleva {diasMasAntigua} día{diasMasAntigua === 1 ? '' : 's'}</>}
            </div>
          </div>
          <button onClick={barrerTodas} style={{ ...btn, background: bandaFg === '#fff' ? '#fff' : INK, color: bandaFg === '#fff' ? INK : '#fff' }}>
            Traspaso hecho · marcar todo
          </button>
        </div>
      )}

      {/* TRES CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 16, marginBottom: 18 }}>

        {/* SALDO */}
        <div style={card}>
          <span style={eyebrow(VERDE, '#fff')}>Saldo del fondo</span>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 52, lineHeight: 1, letterSpacing: '-1px', color: INK, marginTop: 12 }}>
            {fmtEur(saldo, { decimals: 2 })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontFamily: LEX, fontSize: 12, color: '#5a5344' }}>
            <span>Entró <strong style={{ fontFamily: OSW, color: VERDE }}>{fmtEur(dotado, { decimals: 2 })}</strong></span>
            <span>Salió <strong style={{ fontFamily: OSW, color: ROJO }}>{fmtEur(retirado, { decimals: 2 })}</strong></span>
          </div>
          <div style={{ height: 16, border: `2px solid ${INK}`, background: CLARO, marginTop: 18, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, cobertura)}%`, height: '100%', background: colorCob, transition: 'width .5s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
            <span style={{ fontFamily: LEX, fontSize: 11.5, color: '#5a5344' }}>
              Cubre gastos fijos de <strong>{fmtEur(fijosMes, { decimals: 0 })}</strong>/mes
            </span>
            <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 20, color: colorCob }}>{fmtPct(cobertura, 0)}</span>
          </div>
        </div>

        {/* % BARRIDO */}
        <div style={card}>
          <span style={eyebrow(AMA)}>Porcentaje de barrido</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12 }}>
            <input
              type="number" min={0} max={35} step={0.5} value={pctEdit}
              onChange={e => setPctEdit(parseFloat(e.target.value) || 0)}
              style={{
                width: 130, fontFamily: OSW, fontWeight: 700, fontSize: 48, lineHeight: 1, color: INK,
                border: BORDER_CARD, background: '#fff', padding: '2px 10px', textAlign: 'right', outline: 'none',
              }}
            />
            <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 36, color: GRIS }}>%</span>
          </div>
          <div style={{ fontFamily: LEX, fontSize: 11.5, color: '#5a5344', marginTop: 8 }}>
            De cada euro neto que entra de plataformas.
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
            {[5, 6, 7, 8, 9, 10].map(v => (
              <button key={v} onClick={() => setPctEdit(v)} style={{
                ...pill,
                background: pctEdit === v ? INK : '#fff',
                color: pctEdit === v ? AMA : INK,
              }}>{v}%</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={guardarPct} style={{ ...btn, background: INK, color: '#fff', flex: 1 }}>Guardar</button>
            <button onClick={toggleActivo} style={{
              ...btn, flex: 1,
              background: cfg?.activo ? VERDE : '#fff',
              color: cfg?.activo ? '#fff' : GRIS,
            }}>{cfg?.activo ? 'Activo' : 'Apagado'}</button>
          </div>
        </div>

        {/* RETIRADA */}
        <div style={card}>
          <span style={eyebrow(GRANATE, '#fff')}>Sacar del fondo</span>
          <p style={{ fontFamily: LEX, fontSize: 12.5, color: '#5a5344', marginTop: 12, marginBottom: 14, lineHeight: 1.5 }}>
            Del fondo solo sale dinero para <strong>nóminas, SS, alquiler, suministros, préstamos e impuestos</strong>. Cualquier otro destino se marca como uso indebido.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input type="number" min={0} step={0.01} value={retImporte || ''} placeholder="Importe"
              onChange={e => setRetImporte(parseFloat(e.target.value) || 0)}
              style={{ padding: '10px 12px', border: BORDER_CARD, background: '#fff', fontFamily: OSW, fontWeight: 600, fontSize: 16, textAlign: 'right', outline: 'none' }} />
            <select value={retDestino} onChange={e => setRetDestino(e.target.value)}
              style={{ padding: '10px 12px', border: BORDER_CARD, background: '#fff', fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: 1, outline: 'none' }}>
              {DESTINOS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button onClick={registrarRetirada} style={{ ...btn, background: GRANATE, color: '#fff', width: '100%', marginTop: 10 }}>Registrar retirada</button>
          {fugas.length > 0 && (
            <div style={{ marginTop: 12, background: ROJO, color: '#fff', border: `2px solid ${INK}`, padding: '10px 12px', fontFamily: OSW, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {fugas.length} fuga{fugas.length === 1 ? '' : 's'} · {fmtEur(fugas.reduce((a, f) => a + Number(f.importe), 0), { decimals: 2 })}
            </div>
          )}
        </div>
      </div>

      {/* ORDENES PENDIENTES */}
      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span style={eyebrow(INK, AMA)}>Órdenes de barrido · {pendientes.length}</span>
          {pendientes.length > 0 && (
            <span style={{ fontFamily: LEX, fontSize: 12, color: '#5a5344' }}>
              Cobrado {fmtEur(cobradoPendiente, { decimals: 2 })} → apartar <strong style={{ fontFamily: OSW, color: VERDE, fontSize: 16 }}>{fmtEur(totalPendiente, { decimals: 2 })}</strong>
            </span>
          )}
        </div>

        {pendientes.length === 0 && (
          <div style={{ fontFamily: OSW, fontSize: 20, letterSpacing: 1, textTransform: 'uppercase', color: VERDE, padding: '24px 0 6px' }}>
            Todo al día · nada pendiente de traspasar
          </div>
        )}

        {porDia.map(([dia, lista]) => {
          const totalDia = lista.reduce((a, o) => a + Number(o.importe_reservar), 0)
          return (
            <div key={dia} style={{ marginTop: 18 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                background: CLARO, border: `2px solid ${INK}`, padding: '8px 12px',
              }}>
                <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 16, letterSpacing: 1, textTransform: 'uppercase', color: INK }}>
                  {dia} · {lista.length} cobro{lista.length === 1 ? '' : 's'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <strong style={{ fontFamily: OSW, fontSize: 20, color: VERDE }}>{fmtEur(totalDia, { decimals: 2 })}</strong>
                  <button onClick={() => barrerDia(dia, lista)} style={{ ...btnMini, background: INK, color: AMA }}>Barrer el día</button>
                </span>
              </div>

              {lista.map((o, i) => (
                <div key={o.id} style={{
                  display: 'grid', gridTemplateColumns: '10px 130px 1fr 110px auto', alignItems: 'center', gap: 12,
                  padding: '10px 12px', background: '#fff',
                  borderLeft: `2px solid ${INK}`, borderRight: `2px solid ${INK}`,
                  borderBottom: i === lista.length - 1 ? `2px solid ${INK}` : '1px solid rgba(0,0,0,.12)',
                }}>
                  <span style={{ width: 10, height: 26, background: COLOR_CANAL[o.plataforma] ?? GRIS, border: `1.5px solid ${INK}` }} />
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 14, letterSpacing: 0.5, color: INK }}>{o.plataforma}</span>
                  <span style={{ fontFamily: LEX, fontSize: 12.5, color: '#5a5344' }}>cobrado {fmtEur(o.importe_cobro, { decimals: 2 })}</span>
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 19, color: VERDE, textAlign: 'right' }}>{fmtEur(o.importe_reservar, { decimals: 2 })}</span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { marcarCumplida(o).then(cargar) }} style={{ ...btnMini, background: VERDE, color: '#fff' }}>Hecho</button>
                    <button onClick={() => omitir(o)} style={{ ...btnMini, background: '#fff', color: GRIS }}>Omitir</button>
                  </span>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* HISTORIAL */}
      <div style={card}>
        <span style={eyebrow(INK, AMA)}>Movimientos del fondo</span>
        {movs.length === 0 && (
          <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS, padding: '18px 0 4px' }}>Sin movimientos todavía.</div>
        )}
        {movs.map((m, i) => (
          <div key={m.id} style={{
            display: 'grid', gridTemplateColumns: '110px 90px 1fr 140px', alignItems: 'center', gap: 12,
            padding: '11px 0', borderBottom: i < movs.length - 1 ? '1px solid rgba(0,0,0,.12)' : 'none',
          }}>
            <span style={{ fontFamily: LEX, fontSize: 12, color: '#5a5344' }}>{m.fecha}</span>
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
              {fmtEur(m.tipo === 'DOTACION' ? Number(m.importe) : -Number(m.importe), { decimals: 2, signed: true })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const card: CSSProperties = {
  background: '#fff', border: BORDER_CARD, boxShadow: SHADOW, padding: '18px 20px',
}
const btn: CSSProperties = {
  border: BORDER_CARD, boxShadow: '3px 3px 0 rgba(0,0,0,.9)', padding: '11px 18px',
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
