/**
 * RESERVAS — Fondo de maniobra.
 *
 * Cada cobro de plataforma (categorias 1.1.1 / 1.1.2 / 1.1.3) genera una ORDEN DE BARRIDO:
 * un % configurable (5-10%) del importe cobrado que hay que traspasar a la cuenta de reserva.
 *
 * El % se aplica sobre el NETO REAL: el cobro bancario de la plataforma ya es neto.
 * No duplica logica de neto (LEY-NETO-01): no calcula netos, lee lo que entro en banco.
 *
 * Contabilidad: dotar la reserva NO es un gasto -> no computa en P&G. Es tesoreria.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cardBig, lbl, lblXs, OSWALD, LEXEND, COLOR } from '@/components/panel/resumen/tokens'
import { fmtEur, fmtPct } from '@/lib/format'

const ROJO = COLOR.rojoSL
const VERDE = COLOR.verde
const AMBAR = COLOR.ambar
const ERR = COLOR.rojo

interface Config { id: number; pct: number; activo: boolean; cuenta_destino: string | null }
interface Orden {
  id: string
  fecha_cobro: string
  plataforma: string
  importe_cobro: number
  pct_aplicado: number
  importe_reservar: number
  estado: string
}
interface Movimiento {
  id: string
  fecha: string
  tipo: string
  importe: number
  destino: string | null
  autorizado: boolean
  nota: string | null
}

const DESTINOS = ['NOMINAS', 'SS', 'ALQUILER', 'SUMINISTROS', 'PRESTAMO', 'IMPUESTOS', 'OTRO']
const DESTINOS_AUTORIZADOS = ['NOMINAS', 'SS', 'ALQUILER', 'SUMINISTROS', 'PRESTAMO', 'IMPUESTOS']

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
      supabase.from('reserva_ordenes').select('*').order('fecha_cobro', { ascending: false }).limit(200),
      supabase.from('reserva_movimientos').select('*').order('fecha', { ascending: false }).limit(100),
      supabase.from('gastos_fijos').select('importe').eq('activo', true),
    ])
    if (c.data) { setCfg(c.data as Config); setPctEdit(Number((c.data as Config).pct)) }
    setOrdenes((o.data ?? []) as Orden[])
    setMovs((m.data ?? []) as Movimiento[])
    setFijosMes(((f.data ?? []) as Array<{ importe: number }>).reduce((a, r) => a + Number(r.importe || 0), 0))
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  const pendientes = useMemo(() => ordenes.filter(o => o.estado === 'PENDIENTE'), [ordenes])
  const totalPendiente = useMemo(() => pendientes.reduce((a, o) => a + Number(o.importe_reservar), 0), [pendientes])
  const dotado = useMemo(() => movs.filter(m => m.tipo === 'DOTACION').reduce((a, m) => a + Number(m.importe), 0), [movs])
  const retirado = useMemo(() => movs.filter(m => m.tipo === 'RETIRADA').reduce((a, m) => a + Number(m.importe), 0), [movs])
  const saldo = dotado - retirado
  const fugas = useMemo(() => movs.filter(m => m.tipo === 'RETIRADA' && !m.autorizado), [movs])
  const cobertura = fijosMes > 0 ? (saldo / fijosMes) * 100 : 0
  const colorCob = cobertura >= 100 ? VERDE : cobertura >= 50 ? AMBAR : ERR

  // Antiguedad de la orden pendiente mas vieja -> nivel de alerta
  const diasMasAntigua = useMemo(() => {
    if (pendientes.length === 0) return 0
    const min = pendientes.reduce((a, o) => (o.fecha_cobro < a ? o.fecha_cobro : a), pendientes[0].fecha_cobro)
    return Math.floor((Date.now() - new Date(min).getTime()) / 86400000)
  }, [pendientes])
  const nivelAlerta: 'ok' | 'aviso' | 'rojo' | 'bloqueo' =
    pendientes.length === 0 ? 'ok' : diasMasAntigua >= 5 ? 'bloqueo' : diasMasAntigua >= 2 ? 'rojo' : 'aviso'

  async function guardarPct() {
    const p = Math.min(35, Math.max(0, pctEdit))
    await supabase.from('reserva_config').update({ pct: p, updated_at: new Date().toISOString() }).eq('id', 1)
    // Recalcula las ordenes aun pendientes con el nuevo %
    for (const o of pendientes) {
      await supabase.from('reserva_ordenes')
        .update({ pct_aplicado: p, importe_reservar: Math.round(Number(o.importe_cobro) * p) / 100 })
        .eq('id', o.id)
    }
    setMsg(`Porcentaje actualizado a ${p}%`)
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
      nota: `Barrido ${o.plataforma} · cobro ${o.fecha_cobro}`,
    })
    cargar()
  }

  async function omitir(o: Orden) {
    await supabase.from('reserva_ordenes').update({ estado: 'OMITIDA' }).eq('id', o.id)
    cargar()
  }

  async function barrerTodas() {
    for (const o of pendientes) await marcarCumplida(o)
    setMsg('Todas las órdenes marcadas como traspasadas')
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
      autorizado: DESTINOS_AUTORIZADOS.includes(retDestino),
    })
    setRetImporte(0)
    cargar()
  }

  if (loading) return <div style={{ padding: 40, fontFamily: LEXEND, color: '#7a8090' }}>Cargando reservas...</div>

  return (
    <div style={{ background: '#f5f3ef', padding: '24px 28px', minHeight: '100vh' }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ color: ROJO, fontFamily: OSWALD, fontSize: 22, fontWeight: 600, letterSpacing: '3px', margin: 0, textTransform: 'uppercase' }}>RESERVAS · FONDO DE MANIOBRA</h2>
        <span style={{ fontFamily: LEXEND, fontSize: 13, color: '#7a8090', display: 'block', marginTop: 4 }}>
          Un {cfg?.pct ?? 5}% de cada cobro de plataforma se aparta para cubrir los gastos fijos y amortizar deuda. No es un gasto: no computa en P&amp;G.
        </span>
      </div>

      {msg && <div style={{ background: '#EAF7F0', border: `1px solid ${VERDE}`, color: '#1a6b4a', padding: 12, borderRadius: 8, fontFamily: LEXEND, fontSize: 13, marginBottom: 14 }}>{msg}</div>}

      {nivelAlerta !== 'ok' && (
        <div style={{
          background: nivelAlerta === 'bloqueo' ? '#3a0d0d' : nivelAlerta === 'rojo' ? '#FCEBEB' : '#FFF6E5',
          border: `2px solid ${nivelAlerta === 'aviso' ? AMBAR : ERR}`,
          color: nivelAlerta === 'bloqueo' ? '#fff' : nivelAlerta === 'rojo' ? '#A32D2D' : '#8a6100',
          padding: 16, borderRadius: 10, fontFamily: LEXEND, fontSize: 14, marginBottom: 14,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span>
            <strong style={{ fontFamily: OSWALD, letterSpacing: 1 }}>
              {nivelAlerta === 'bloqueo' ? 'RESERVA BLOQUEANTE' : nivelAlerta === 'rojo' ? 'RESERVA EN RIESGO' : 'RESERVA PENDIENTE'}
            </strong>
            {' · '}{pendientes.length} orden{pendientes.length === 1 ? '' : 'es'} sin traspasar · {fmtEur(totalPendiente, { decimals: 2 })}
            {diasMasAntigua > 0 && ` · la más antigua lleva ${diasMasAntigua} día${diasMasAntigua === 1 ? '' : 's'}`}
          </span>
          <button onClick={barrerTodas} style={btnPrimario}>Traspaso hecho — marcar todas</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 14 }}>
        {/* Saldo y cobertura */}
        <div style={cardBig}>
          <div style={lbl}>SALDO DEL FONDO</div>
          <div style={{ fontFamily: OSWALD, fontSize: 38, fontWeight: 600, color: '#111111', marginTop: 8 }}>{fmtEur(saldo, { showEuro: false, decimals: 2 })}</div>
          <div style={lblXs}>DOTADO {fmtEur(dotado, { showEuro: false, decimals: 2 })} · RETIRADO {fmtEur(retirado, { showEuro: false, decimals: 2 })}</div>
          <div style={{ height: 8, borderRadius: 4, background: '#ebe8e2', overflow: 'hidden', marginTop: 16 }}>
            <div style={{ width: `${Math.min(100, cobertura)}%`, height: '100%', background: colorCob, transition: 'width .5s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LEXEND, fontSize: 11, color: '#7a8090', marginTop: 6 }}>
            <span>Cobertura de gastos fijos ({fmtEur(fijosMes, { decimals: 0 })}/mes)</span>
            <strong style={{ color: colorCob, fontFamily: OSWALD, fontSize: 12 }}>{fmtPct(cobertura, 0)}</strong>
          </div>
        </div>

        {/* Config */}
        <div style={cardBig}>
          <div style={lbl}>PORCENTAJE DE BARRIDO</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
            <input
              type="number" min={0} max={35} step={0.5} value={pctEdit}
              onChange={e => setPctEdit(parseFloat(e.target.value) || 0)}
              style={{ width: 110, fontFamily: OSWALD, fontSize: 34, fontWeight: 600, color: '#111111', border: '0.5px solid #d0c8bc', borderRadius: 8, padding: '4px 10px', textAlign: 'right', background: '#fff' }}
            />
            <span style={{ fontFamily: OSWALD, fontSize: 28, color: '#7a8090' }}>%</span>
          </div>
          <div style={{ ...lblXs, marginTop: 4 }}>SOBRE CADA COBRO NETO DE PLATAFORMA</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {[5, 6, 7, 8, 9, 10].map(v => (
              <button key={v} onClick={() => setPctEdit(v)} style={{ ...btnPill, background: pctEdit === v ? '#111' : '#fff', color: pctEdit === v ? '#fff' : '#3a4050' }}>{v}%</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={guardarPct} style={btnPrimario}>Guardar %</button>
            <button onClick={toggleActivo} style={{ ...btnSecundario, borderColor: cfg?.activo ? VERDE : '#d0c8bc', color: cfg?.activo ? VERDE : '#7a8090' }}>
              {cfg?.activo ? 'Barrido activo' : 'Barrido apagado'}
            </button>
          </div>
        </div>

        {/* Retirada */}
        <div style={cardBig}>
          <div style={lbl}>SACAR DINERO DEL FONDO</div>
          <div style={{ fontFamily: LEXEND, fontSize: 12, color: '#3a4050', marginTop: 8, marginBottom: 12 }}>
            Del fondo solo debe salir dinero para nóminas, SS, alquiler, suministros, préstamos e impuestos. Cualquier otro destino queda marcado como uso indebido.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input type="number" min={0} step={0.01} value={retImporte || ''} placeholder="Importe"
              onChange={e => setRetImporte(parseFloat(e.target.value) || 0)}
              style={{ padding: '8px 10px', border: '0.5px solid #d0c8bc', borderRadius: 6, fontFamily: OSWALD, fontSize: 14, textAlign: 'right', background: '#fff' }} />
            <select value={retDestino} onChange={e => setRetDestino(e.target.value)}
              style={{ padding: '8px 10px', border: '0.5px solid #d0c8bc', borderRadius: 6, fontFamily: OSWALD, fontSize: 13, background: '#fff' }}>
              {DESTINOS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button onClick={registrarRetirada} style={{ ...btnSecundario, marginTop: 10, width: '100%' }}>Registrar retirada</button>
          {fugas.length > 0 && (
            <div style={{ marginTop: 12, background: '#FCEBEB', border: `1px solid ${ERR}`, color: '#A32D2D', padding: 10, borderRadius: 8, fontFamily: LEXEND, fontSize: 12 }}>
              <strong>{fugas.length} retirada{fugas.length === 1 ? '' : 's'} sin justificar</strong> · {fmtEur(fugas.reduce((a, f) => a + Number(f.importe), 0), { decimals: 2 })}
            </div>
          )}
        </div>
      </div>

      {/* Ordenes pendientes */}
      <div style={{ ...cardBig, marginBottom: 14 }}>
        <div style={lbl}>ÓRDENES DE BARRIDO PENDIENTES · {pendientes.length}</div>
        {pendientes.length === 0 && <div style={{ fontFamily: LEXEND, fontSize: 13, color: '#7a8090', fontStyle: 'italic', padding: '14px 0' }}>Todo al día. No hay traspasos pendientes.</div>}
        {pendientes.map((o, i) => (
          <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 120px 120px auto', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < pendientes.length - 1 ? '0.5px solid #ebe8e2' : 'none' }}>
            <span style={{ fontFamily: LEXEND, fontSize: 12, color: '#7a8090' }}>{o.fecha_cobro}</span>
            <span style={{ fontFamily: OSWALD, fontSize: 14, fontWeight: 600, color: '#111111', letterSpacing: 0.5 }}>{o.plataforma}</span>
            <span style={{ fontFamily: LEXEND, fontSize: 12, color: '#3a4050', textAlign: 'right' }}>cobrado {fmtEur(o.importe_cobro, { decimals: 2 })}</span>
            <span style={{ fontFamily: OSWALD, fontSize: 17, fontWeight: 600, color: VERDE, textAlign: 'right' }}>{fmtEur(o.importe_reservar, { decimals: 2 })}</span>
            <span style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => marcarCumplida(o)} style={btnMini}>Traspaso hecho</button>
              <button onClick={() => omitir(o)} style={{ ...btnMini, background: '#fff', color: '#7a8090', border: '0.5px solid #d0c8bc' }}>Omitir</button>
            </span>
          </div>
        ))}
      </div>

      {/* Historial */}
      <div style={cardBig}>
        <div style={lbl}>MOVIMIENTOS DEL FONDO</div>
        {movs.length === 0 && <div style={{ fontFamily: LEXEND, fontSize: 13, color: '#7a8090', fontStyle: 'italic', padding: '14px 0' }}>Sin movimientos todavía.</div>}
        {movs.map((m, i) => (
          <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '110px 110px 1fr 130px', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: i < movs.length - 1 ? '0.5px solid #ebe8e2' : 'none' }}>
            <span style={{ fontFamily: LEXEND, fontSize: 12, color: '#7a8090' }}>{m.fecha}</span>
            <span style={{ fontFamily: OSWALD, fontSize: 11, letterSpacing: 1, padding: '3px 8px', borderRadius: 4, textAlign: 'center', background: m.tipo === 'DOTACION' ? VERDE : m.autorizado ? '#3a4050' : ERR, color: '#fff' }}>
              {m.tipo === 'DOTACION' ? 'ENTRA' : m.autorizado ? 'SALE' : 'FUGA'}
            </span>
            <span style={{ fontFamily: LEXEND, fontSize: 12, color: '#3a4050' }}>{m.destino ?? m.nota ?? '—'}</span>
            <span style={{ fontFamily: OSWALD, fontSize: 15, fontWeight: 600, textAlign: 'right', color: m.tipo === 'DOTACION' ? VERDE : ERR }}>
              {fmtEur(m.tipo === 'DOTACION' ? Number(m.importe) : -Number(m.importe), { decimals: 2, signed: true })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const btnPrimario: React.CSSProperties = {
  background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px',
  fontFamily: OSWALD, fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer',
}
const btnSecundario: React.CSSProperties = {
  background: '#fff', color: '#3a4050', border: '1px solid #d0c8bc', borderRadius: 8, padding: '9px 16px',
  fontFamily: OSWALD, fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer',
}
const btnMini: React.CSSProperties = {
  background: '#111', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px',
  fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', cursor: 'pointer',
}
const btnPill: React.CSSProperties = {
  border: '0.5px solid #d0c8bc', borderRadius: 20, padding: '5px 12px',
  fontFamily: OSWALD, fontSize: 12, fontWeight: 600, cursor: 'pointer',
}
