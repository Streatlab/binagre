/**
 * TESORERÍA · FIJOS & RESERVA — Neobrutal Food-Pop (tokens canónicos).
 *
 * Une el fondo de reserva con la agenda de gastos fijos del mes:
 * ¿cubre lo apartado los fijos que tengo que pagar este mes?
 */
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import {
  OSW, LEX, INK, CREMA, CLARO, GRIS, SHADOW, BORDER_CARD,
  VERDE, ROJO, AMA, AZUL, GRANATE, eyebrow, d, E2, P0,
} from '@/styles/neobrutal'

interface Fijo {
  id: number; concepto: string; importe: number; dia: string
  estimado: boolean; categoria: string | null; nota: string | null
}
interface Movimiento {
  id: string; fecha: string; tipo: string; importe: number
  destino: string | null; autorizado: boolean; nota: string | null
}

const DESTINOS = ['NOMINAS', 'SS', 'ALQUILER', 'SUMINISTROS', 'PRESTAMO', 'IMPUESTOS', 'OTRO']
const AUTORIZADOS = ['NOMINAS', 'SS', 'ALQUILER', 'SUMINISTROS', 'PRESTAMO', 'IMPUESTOS']
const hoyIso = () => new Date().toISOString().slice(0, 10)

export default function TesoreriaFijosReserva() {
  const [fijos, setFijos] = useState<Fijo[]>([])
  const [saldoReserva, setSaldoReserva] = useState(0)
  const [pct, setPct] = useState(5)
  const [ordenesPendientes, setOrdenesPendientes] = useState(0)
  const [movs, setMovs] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const [nConcepto, setNConcepto] = useState('')
  const [nImporte, setNImporte] = useState(0)
  const [nDia, setNDia] = useState(hoyIso())

  async function cargar() {
    const [f, cob, cfg, panel, m] = await Promise.all([
      supabase.from('v_tesoreria_fijos_mes').select('id,concepto,importe,dia,estimado,categoria,nota').order('dia', { ascending: true }),
      supabase.from('v_tesoreria_cobertura').select('saldo_reserva').single(),
      supabase.from('reserva_config').select('pct').eq('id', 1).single(),
      supabase.from('v_reserva_panel').select('ordenes_pendientes').single(),
      supabase.from('reserva_movimientos').select('*').order('fecha', { ascending: false }).limit(8),
    ])
    setFijos((f.data ?? []).map(r => ({ ...r, importe: Number(r.importe) })) as Fijo[])
    setSaldoReserva(Number((cob.data as { saldo_reserva?: number } | null)?.saldo_reserva ?? 0))
    setPct(Number((cfg.data as { pct?: number } | null)?.pct ?? 5))
    setOrdenesPendientes(Number((panel.data as { ordenes_pendientes?: number } | null)?.ordenes_pendientes ?? 0))
    setMovs((m.data ?? []) as Movimiento[])
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  const totalFijos = useMemo(() => fijos.reduce((a, x) => a + x.importe, 0), [fijos])
  const coberturaPct = totalFijos > 0 ? (saldoReserva / totalFijos) * 100 : 0
  const falta = Math.max(totalFijos - saldoReserva, 0)
  const colorCob = coberturaPct >= 100 ? VERDE : coberturaPct >= 60 ? AMA : ROJO

  async function guardarImporte(fijo: Fijo, nuevoImporte: number) {
    setFijos(prev => prev.map(x => x.id === fijo.id ? { ...x, importe: nuevoImporte } : x))
    await supabase.from('gastos_fijos').update({ importe: nuevoImporte }).eq('id', fijo.id)
  }

  async function confirmarReal(fijo: Fijo) {
    setFijos(prev => prev.map(x => x.id === fijo.id ? { ...x, estimado: false } : x))
    await supabase.from('gastos_fijos').update({ estimado: false }).eq('id', fijo.id)
    setMsg(`${fijo.concepto} confirmado como real`)
  }

  async function anadirFijo() {
    if (!nConcepto.trim() || nImporte <= 0) { setMsg('Pon concepto e importe'); return }
    setOcupado(true)
    await supabase.from('gastos_fijos').insert({
      concepto: nConcepto.trim(), importe: nImporte, proxima_fecha_pago: nDia,
      periodicidad: 'mensual', activo: true, estimado: true,
    })
    setNConcepto(''); setNImporte(0); setNDia(hoyIso()); setNuevo(false)
    setOcupado(false)
    cargar()
  }

  const [retImporte, setRetImporte] = useState(0)
  const [retDestino, setRetDestino] = useState('NOMINAS')
  async function registrarRetirada() {
    if (retImporte <= 0 || retImporte > saldoReserva) {
      setMsg(retImporte > saldoReserva ? 'No puedes sacar más de lo que hay en el fondo' : 'Pon un importe')
      return
    }
    setOcupado(true)
    await supabase.from('reserva_movimientos').insert({
      fecha: hoyIso(), tipo: 'RETIRADA', importe: retImporte, destino: retDestino,
      autorizado: AUTORIZADOS.includes(retDestino),
    })
    setRetImporte(0)
    setOcupado(false)
    cargar()
  }

  if (loading) {
    return <div style={{ background: CREMA, minHeight: '100vh', padding: 40, ...d('20px'), color: GRIS }}>Cargando tesorería…</div>
  }

  const hoy = hoyIso()
  let separadorPuesto = false

  return (
    <div style={{ background: CREMA, minHeight: '100vh', padding: '28px 32px' }}>

      {/* CABECERA */}
      <div style={{ marginBottom: 18 }}>
        <span style={eyebrow(AMA)}>Tesorería</span>
        <h1 style={{ ...d('42px'), margin: '10px 0 0' }}>Fijos &amp; Reserva</h1>
      </div>

      {msg && (
        <div style={{ background: VERDE, color: '#fff', border: BORDER_CARD, boxShadow: SHADOW, padding: '12px 16px', marginBottom: 16, fontFamily: OSW, fontWeight: 600, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase' }}
          onClick={() => setMsg(null)}>
          {msg}
        </div>
      )}

      {/* ══ BLOQUE A · COBERTURA ══ */}
      <div style={{ ...card, marginBottom: 18, padding: '24px 26px' }}>
        <span style={eyebrow(colorCob, '#fff')}>Cobertura del fondo</span>
        <div style={{ ...d('64px', INK), marginTop: 14 }}>{E2(saldoReserva)} €</div>
        <div style={{ height: 20, border: `2px solid ${INK}`, background: CLARO, marginTop: 16, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, Math.max(0, coberturaPct))}%`, height: '100%', background: colorCob, transition: 'width .5s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontFamily: LEX, fontSize: 14, color: INK }}>
            Cubres <strong>{E2(saldoReserva)} de {E2(totalFijos)} €</strong> de fijos este mes
            {falta > 0 && <> · <strong style={{ color: ROJO }}>te faltan {E2(falta)} €</strong></>}
          </span>
          <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, color: colorCob }}>{P0(coberturaPct)}</span>
        </div>
        <div style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS, marginTop: 10 }}>
          % dotación actual: {pct}% de cada ingreso
        </div>
      </div>

      {/* ══ BLOQUE B · AGENDA DE FIJOS DEL MES ══ */}
      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span style={eyebrow(INK, AMA)}>Agenda del mes</span>
          <button onClick={() => setNuevo(v => !v)} style={{ ...btnMini, background: AMA, color: INK }}>+ Añadir gasto fijo</button>
        </div>

        {nuevo && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px auto', gap: 8, marginTop: 14, alignItems: 'center' }}>
            <input placeholder="Concepto" value={nConcepto} onChange={e => setNConcepto(e.target.value)}
              style={inputEdit} />
            <input type="number" min={0} step={0.01} placeholder="Importe €" value={nImporte || ''}
              onChange={e => setNImporte(parseFloat(e.target.value) || 0)} style={{ ...inputEdit, textAlign: 'right' }} />
            <input type="date" value={nDia} onChange={e => setNDia(e.target.value)} style={inputEdit} />
            <button disabled={ocupado} onClick={anadirFijo} style={{ ...btnMini, background: VERDE, color: '#fff' }}>Guardar</button>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          {fijos.length === 0 && (
            <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS, padding: '8px 0' }}>Sin gastos fijos activos este mes.</div>
          )}
          {fijos.map((fj, i) => {
            const mostrarSeparador = !separadorPuesto && fj.dia >= hoy
            if (mostrarSeparador) separadorPuesto = true
            return (
              <div key={fj.id}>
                {mostrarSeparador && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0', color: GRIS, fontFamily: OSW, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
                    <div style={{ flex: 1, borderTop: `2px dashed ${GRIS}` }} /> — hoy — <div style={{ flex: 1, borderTop: `2px dashed ${GRIS}` }} />
                  </div>
                )}
                <div style={{
                  display: 'grid', gridTemplateColumns: '90px 1fr 140px 130px 150px', alignItems: 'center', gap: 12,
                  padding: '10px 4px', borderBottom: i === fijos.length - 1 ? 'none' : '1px solid var(--neo-track)',
                }}>
                  <span style={{ fontFamily: LEX, fontSize: 12.5, color: GRIS }}>{fj.dia.slice(8, 10)}/{fj.dia.slice(5, 7)}</span>
                  <span style={{ fontFamily: LEX, fontSize: 13.5, color: INK }}>{fj.concepto}</span>
                  <input type="number" min={0} step={0.01} value={fj.importe}
                    onChange={e => guardarImporte(fj, parseFloat(e.target.value) || 0)}
                    style={{ ...inputEdit, textAlign: 'right', padding: '6px 8px', fontSize: 14 }} />
                  <span style={{
                    fontFamily: OSW, fontWeight: 700, fontSize: 11, letterSpacing: 0.5, textAlign: 'center',
                    padding: '4px 8px', border: `2px solid ${INK}`, textTransform: 'uppercase',
                    background: fj.estimado ? AMA : VERDE, color: fj.estimado ? INK : '#fff',
                  }}>{fj.estimado ? '🟡 Estimado' : '🟢 Fijo'}</span>
                  {fj.estimado ? (
                    <button onClick={() => confirmarReal(fj)} style={{ ...btnMini, background: '#fff', color: INK }}>Confirmar como real</button>
                  ) : <span />}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 10, marginTop: 16, paddingTop: 14, borderTop: `2px solid ${INK}` }}>
          <span style={{ fontFamily: LEX, fontSize: 13, color: GRIS }}>Total fijos del mes</span>
          <span style={{ ...d('30px', INK) }}>{E2(totalFijos)} €</span>
        </div>
      </div>

      {/* ══ BLOQUE C · MOVIMIENTOS DE RESERVA ══ */}
      <div style={card}>
        <span style={eyebrow(GRANATE, '#fff')}>Movimientos de reserva</span>
        <div style={{ display: 'flex', gap: 24, marginTop: 14, flexWrap: 'wrap', fontFamily: LEX, fontSize: 12.5, color: GRIS }}>
          <span>Saldo teórico <strong style={{ fontFamily: OSW, color: INK }}>{E2(saldoReserva)} €</strong></span>
          <span>Órdenes pendientes de reservar <strong style={{ fontFamily: OSW, color: INK }}>{ordenesPendientes}</strong></span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginTop: 14, alignItems: 'center' }}>
          <input type="number" min={0} step={0.01} value={retImporte || ''} placeholder="Importe €"
            onChange={e => setRetImporte(parseFloat(e.target.value) || 0)} style={{ ...inputEdit, textAlign: 'right' }} />
          <select value={retDestino} onChange={e => setRetDestino(e.target.value)} style={inputEdit}>
            {DESTINOS.map(dd => <option key={dd} value={dd}>{dd}</option>)}
          </select>
          <button disabled={ocupado || saldoReserva <= 0} onClick={registrarRetirada}
            style={{ ...btnMini, background: saldoReserva > 0 ? GRANATE : CLARO, color: saldoReserva > 0 ? '#fff' : GRIS }}>
            Registrar retirada
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          {movs.length === 0 && (
            <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS, padding: '8px 0' }}>Sin movimientos todavía.</div>
          )}
          {movs.map((m, i) => (
            <div key={m.id} style={{
              display: 'grid', gridTemplateColumns: '105px 82px 1fr 130px', alignItems: 'center', gap: 12,
              padding: '9px 0', borderBottom: i < movs.length - 1 ? '1px solid var(--neo-track)' : 'none',
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
              <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 16, textAlign: 'right', color: m.tipo === 'DOTACION' ? VERDE : ROJO }}>
                {m.tipo === 'DOTACION' ? '+' : '−'}{E2(Number(m.importe))} €
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const card: CSSProperties = {
  background: 'var(--neo-card, #fff)', border: BORDER_CARD, boxShadow: SHADOW, padding: '18px 20px',
}
const btnMini: CSSProperties = {
  border: `2px solid ${INK}`, padding: '8px 14px',
  fontFamily: OSW, fontWeight: 700, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', cursor: 'pointer',
}
const inputEdit: CSSProperties = {
  padding: '9px 10px', border: `2px solid ${AZUL}`, background: '#fff',
  fontFamily: OSW, fontWeight: 600, fontSize: 13, outline: 'none', color: INK,
}
