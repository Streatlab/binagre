// FICHAJE · Quiosco de tablet (ruta pública /fichaje, instalable como PWA propia).
// CANTERA ALEGRE v1.0 · área EQUIPO → héroe TINTA (texto crema, mark amarillo).
// Radio 0 · sombra dura 3px solo en lo pulsable · rojo exclusivo de lo negativo.
// Registro legal RD-ley 8/2019: la BD es append-only; aquí solo se pulsa y se ve.
import React, { useCallback, useEffect, useRef, useState } from 'react'

// ── Tokens Cantera Alegre (12 canónicos, superficie autónoma sin theme del ERP) ──
const TINTA = '#241D12'
const CREMA = '#FCEFD6'
const CLARO = '#F6E7C8'
const BLANCO = '#ffffff'
const AMA = '#FFC400'
const VERDE = '#0FB86B'
const ROJO = '#FF1E27'   // exclusivo de lo negativo (SALIDA, error PIN)
const MUT = '#6B5D45'
const OSW = "'Oswald', sans-serif"
const LEX = "'Lexend', sans-serif"
const SOMBRA = `3px 3px 0 ${TINTA}`
const BORDE = `3px solid ${TINTA}`

type Estado = 'fuera' | 'trabajando' | 'pausa'
type Emp = {
  id: string; nombre: string; foto_url: string | null; estado: Estado
  ultimo_ts: string | null; entrada_ts: string | null; min_trabajo: number; min_pausa: number
  horario_hoy: { inicio: string; fin: string; turno: string | null }[]
}
type Tipo = 'entrada' | 'salida' | 'pausa_inicio' | 'pausa_fin'
type Pantalla = 'home' | 'pin' | 'accion' | 'confirm' | 'adminpin' | 'admin'

const API = '/api/operaciones/fichaje'
const COLA_KEY = 'fichaje_cola_offline'

const fmtHora = (ts: string) => new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
const fmtMin = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : null)
const iniciales = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('')

const ETIQUETA: Record<Tipo, string> = { entrada: 'ENTRADA', salida: 'SALIDA', pausa_inicio: 'INICIO PAUSA', pausa_fin: 'FIN PAUSA' }
const COLOR_ACCION: Record<Tipo, string> = { entrada: VERDE, salida: ROJO, pausa_inicio: AMA, pausa_fin: AMA }

// Cola offline: si la red falla, el fichaje se guarda local y se reenvía al volver
function colaLeer(): Array<{ empleado_id: string; pin: string; tipo: Tipo; ts: string }> {
  try { return JSON.parse(localStorage.getItem(COLA_KEY) || '[]') } catch { return [] }
}
function colaGuardar(items: ReturnType<typeof colaLeer>) { localStorage.setItem(COLA_KEY, JSON.stringify(items)) }

async function post(action: string, body: unknown) {
  const r = await fetch(`${API}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return r.json()
}

export default function Fichaje() {
  const [pantalla, setPantalla] = useState<Pantalla>('home')
  const [emps, setEmps] = useState<Emp[]>([])
  const [turno, setTurno] = useState('COMIDA')
  const [sel, setSel] = useState<Emp | null>(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  const [bloqueoSeg, setBloqueoSeg] = useState(0)
  const [confirm, setConfirm] = useState<{ tipo: Tipo; hora: string; resumen?: { min_trabajo: number; min_pausa: number } } | null>(null)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [reloj, setReloj] = useState(new Date())
  const [enviando, setEnviando] = useState(false)
  // Admin
  const [adminPin, setAdminPin] = useState('')
  const [adminData, setAdminData] = useState<{ fecha: string; registros: Array<{ empleado_id: string; nombre: string; estado: string; min_trabajo: number; min_pausa: number; entrada_ts: string | null; salida_ts: string | null; eventos: Array<{ id: string; tipo: string; ts: string; correccion: boolean }> }> } | null>(null)
  const [adminError, setAdminError] = useState<string | null>(null)
  const holdRef = useRef<number | null>(null)
  const [holding, setHolding] = useState(false)
  const idleRef = useRef<number | null>(null)

  // Manifest propio del quiosco → instalable como app SOLO de /fichaje
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
    const prev = link?.href
    if (link) link.href = '/fichaje.webmanifest'
    document.title = 'Fichaje · Streat Lab'
    return () => { if (link && prev) link.href = prev }
  }, [])

  useEffect(() => {
    const t = setInterval(() => setReloj(new Date()), 1000)
    const on = () => setOffline(false), off = () => setOffline(true)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { clearInterval(t); window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`${API}/estado`)
      const j = await r.json()
      if (j.empleados) { setEmps(j.empleados); setTurno(j.turno) }
      setOffline(false)
    } catch { setOffline(true) }
  }, [])

  useEffect(() => { cargar(); const t = setInterval(cargar, 30000); return () => clearInterval(t) }, [cargar])

  // Reenvío de la cola offline al recuperar conexión
  useEffect(() => {
    if (offline) return
    const cola = colaLeer()
    if (!cola.length) return
    ;(async () => {
      const restantes: typeof cola = []
      for (const item of cola) {
        try { const j = await post('fichar', item); if (!j) restantes.push(item) } catch { restantes.push(item) }
      }
      colaGuardar(restantes)
      cargar()
    })()
  }, [offline, cargar])

  // Vuelta sola al inicio si nadie toca nada (15 s en PIN, 25 s en acción)
  useEffect(() => {
    if (idleRef.current) window.clearTimeout(idleRef.current)
    if (pantalla === 'pin' || pantalla === 'adminpin') idleRef.current = window.setTimeout(irInicio, 15000)
    if (pantalla === 'accion') idleRef.current = window.setTimeout(irInicio, 25000)
    return () => { if (idleRef.current) window.clearTimeout(idleRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pantalla, pin, adminPin])

  // Cuenta atrás de bloqueo
  useEffect(() => {
    if (bloqueoSeg <= 0) return
    const t = setTimeout(() => setBloqueoSeg(s => s - 1), 1000)
    if (bloqueoSeg === 1) setTimeout(() => { setPinError(null); setIntento(0) }, 1000)
    return () => clearTimeout(t)
  }, [bloqueoSeg])

  function irInicio() {
    setPantalla('home'); setSel(null); setPin(''); setPinError(null); setIntento(0)
    setBloqueoSeg(0); setAdminPin(''); setAdminError(null); setAdminData(null)
  }

  function tocarEmpleado(e: Emp) { setSel(e); setPin(''); setPinError(null); setIntento(0); setPantalla('pin') }

  function tecla(n: string, esAdmin = false) {
    const set = esAdmin ? setAdminPin : setPin
    const val = esAdmin ? adminPin : pin
    if (n === 'del') return set(val.slice(0, -1))
    if (val.length >= 6) return
    const nuevo = val + n
    set(nuevo)
    if (nuevo.length === 6) {
      if (esAdmin) validarAdmin(nuevo)
      else setTimeout(() => setPantalla('accion'), 150) // el PIN se valida al fichar
    }
  }

  async function ficharAccion(tipo: Tipo) {
    if (!sel || enviando) return
    setEnviando(true)
    const cuerpo = { empleado_id: sel.id, pin, tipo, ts: new Date().toISOString() }
    try {
      const j = await post('fichar', cuerpo)
      setEnviando(false)
      if (j.ok) {
        setConfirm({ tipo, hora: fmtHora(j.ts), resumen: j.resumen })
        setPantalla('confirm')
        setTimeout(() => { irInicio(); cargar() }, 3500)
        return
      }
      if (j.motivo === 'pin_incorrecto') { setIntento(j.intento || 1); setPinError('PIN INCORRECTO'); setPin(''); setPantalla('pin'); return }
      if (j.motivo === 'bloqueado') { setBloqueoSeg(j.segundos || 60); setPantalla('pin'); return }
      if (j.motivo === 'transicion_invalida') { cargar(); setPinError(null); return }
      setPinError('ERROR AL FICHAR')
    } catch {
      // Sin red: a la cola y confirmación igual (se guardan al volver la conexión)
      colaGuardar([...colaLeer(), cuerpo])
      setEnviando(false)
      setConfirm({ tipo, hora: fmtHora(cuerpo.ts) })
      setPantalla('confirm')
      setTimeout(() => irInicio(), 3500)
    }
  }

  async function validarAdmin(p: string) {
    setAdminError(null)
    const j = await post('admin-registros', { pin: p })
    if (j.registros) { setAdminData(j); setPantalla('admin') }
    else { setAdminError('PIN DE ADMINISTRADOR INCORRECTO'); setAdminPin('') }
  }

  function logoDown() {
    setHolding(true)
    holdRef.current = window.setTimeout(() => { setHolding(false); setAdminPin(''); setPantalla('adminpin') }, 3000)
  }
  function logoUp() { setHolding(false); if (holdRef.current) window.clearTimeout(holdRef.current) }

  // ── piezas UI ──
  const boton = (bg: string, fg: string): React.CSSProperties => ({
    background: bg, color: fg, border: BORDE, borderRadius: 0, boxShadow: SOMBRA,
    fontFamily: OSW, fontWeight: 700, letterSpacing: 2, cursor: 'pointer', textTransform: 'uppercase',
  })

  const Cabecera = ({ children }: { children?: React.ReactNode }) => (
    <div style={{ background: TINTA, color: CREMA, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', gap: 16 }}>
      <div
        onMouseDown={logoDown} onMouseUp={logoUp} onMouseLeave={logoUp}
        onTouchStart={logoDown} onTouchEnd={logoUp}
        style={{ cursor: 'pointer', minWidth: 170, position: 'relative', userSelect: 'none' }}
      >
        <div style={{ fontFamily: OSW, fontWeight: 600, fontSize: 22, letterSpacing: 4 }}>STREAT LAB</div>
        <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: 3, color: AMA, marginTop: 2 }}>FICHAJE · EQUIPO</div>
        {holding && <div style={{ position: 'absolute', left: 0, bottom: -6, height: 4, background: AMA, animation: 'fichajeHold 3s linear forwards' }} />}
      </div>
      <div style={{ textAlign: 'center', flex: 1 }}>
        <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 'clamp(48px,8vw,84px)', lineHeight: 1, letterSpacing: 2, fontVariantNumeric: 'tabular-nums' }}>
          {reloj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })}
        </div>
        <div style={{ fontFamily: LEX, fontSize: 'clamp(13px,1.8vw,17px)', color: CLARO, marginTop: 2 }}>
          {reloj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' })}
        </div>
      </div>
      <div style={{ minWidth: 170, display: 'flex', justifyContent: 'flex-end' }}>
        {children ?? (
          <div style={{ fontFamily: OSW, fontWeight: 600, fontSize: 14, letterSpacing: 2, background: AMA, color: TINTA, padding: '8px 14px' }}>
            TURNO · {turno}
          </div>
        )}
      </div>
    </div>
  )

  const Avatar = ({ e, size }: { e: Emp; size: number }) => (
    <div style={{ width: size, height: size, borderRadius: '50%', border: BORDE, overflow: 'hidden', background: CLARO, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      {e.foto_url
        ? <img src={e.foto_url} alt={e.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
        : <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: size * 0.38, color: TINTA }}>{iniciales(e.nombre)}</span>}
    </div>
  )

  const Teclado = ({ esAdmin = false }: { esAdmin?: boolean }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(84px, 118px))', gap: 14 }}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((n, i) => n === '' ? <div key={i} /> : (
        <button key={i} onClick={() => tecla(n, esAdmin)}
          style={{ ...boton(BLANCO, TINTA), fontSize: n === 'del' ? 26 : 36, padding: '18px 0', minHeight: 76 }}>
          {n === 'del' ? '⌫' : n}
        </button>
      ))}
    </div>
  )

  const Puntos = ({ val, error }: { val: string; error: boolean }) => (
    <div style={{ display: 'flex', gap: 13, animation: error ? 'fichajeShake .4s' : undefined }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ width: 24, height: 24, borderRadius: '50%', border: `3px solid ${error ? ROJO : TINTA}`, background: i < val.length ? (error ? ROJO : TINTA) : 'transparent' }} />
      ))}
    </div>
  )

  const puntoEstado = (s: Estado) => s === 'trabajando' ? VERDE : s === 'pausa' ? AMA : MUT
  const etiquetaEstado = (e: Emp) => {
    if (e.estado === 'trabajando') return `Trabajando desde ${e.entrada_ts ? fmtHora(e.entrada_ts) : '—'}`
    if (e.estado === 'pausa') return 'En pausa'
    const h = e.horario_hoy[0]
    return h ? `Se te espera a las ${hhmm(h.inicio)}` : 'Fuera'
  }

  // ── render ──
  return (
    <div style={{ minHeight: '100vh', background: CREMA, color: TINTA, fontFamily: LEX, display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
      <style>{`
        @keyframes fichajeShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-10px)}50%{transform:translateX(10px)}75%{transform:translateX(-8px)}}
        @keyframes fichajeHold{from{width:0}to{width:100%}}
        @keyframes fichajePop{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}
      `}</style>

      {offline && (
        <div style={{ background: AMA, color: TINTA, textAlign: 'center', padding: '10px 16px', fontFamily: OSW, fontWeight: 600, letterSpacing: 1.5, fontSize: 15, borderBottom: BORDE }}>
          SIN CONEXIÓN — LOS FICHAJES SE GUARDAN IGUAL
        </div>
      )}

      {/* ══ INICIO ══ */}
      {pantalla === 'home' && (<>
        <Cabecera />
        <div style={{ flex: 1, width: '100%', maxWidth: 1360, margin: '0 auto', padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(230px, 44vw), 1fr))', gap: 16, alignContent: 'start' }}>
          {emps.map(e => (
            <div key={e.id} onClick={() => tocarEmpleado(e)}
              style={{ background: BLANCO, border: BORDE, borderTop: `7px solid ${puntoEstado(e.estado)}`, boxShadow: SOMBRA, cursor: 'pointer', padding: '22px 14px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, minHeight: 190 }}>
              <div style={{ position: 'relative' }}>
                <Avatar e={e} size={96} />
                <div style={{ position: 'absolute', right: 0, bottom: 0, width: 24, height: 24, borderRadius: '50%', border: `3px solid ${BLANCO}`, background: puntoEstado(e.estado) }} />
              </div>
              <div style={{ fontFamily: OSW, fontWeight: 600, fontSize: 'clamp(20px,2.6vw,26px)', letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.1 }}>{e.nombre.split(' ')[0]}</div>
              <div style={{ fontFamily: LEX, fontSize: 14, color: MUT, textAlign: 'center' }}>{etiquetaEstado(e)}</div>
            </div>
          ))}
          {!emps.length && <div style={{ fontFamily: LEX, color: MUT, padding: 20 }}>Cargando equipo…</div>}
        </div>
        <div style={{ textAlign: 'center', padding: '0 0 14px', fontFamily: LEX, fontSize: 12, color: MUT }}>
          Toca tu tarjeta para fichar · mantén pulsado STREAT LAB para administración
        </div>
      </>)}

      {/* ══ PIN empleado / admin ══ */}
      {(pantalla === 'pin' || pantalla === 'adminpin') && (<>
        <Cabecera>
          <button onClick={irInicio} style={{ ...boton(BLANCO, TINTA), fontSize: 17, padding: '12px 20px' }}>← VOLVER</button>
        </Cabecera>
        {bloqueoSeg > 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 'clamp(28px,4.5vw,44px)', color: ROJO, letterSpacing: 1 }}>TARJETA BLOQUEADA</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 'clamp(64px,12vw,110px)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{bloqueoSeg}</div>
            <div style={{ fontFamily: LEX, fontSize: 16, color: MUT, textAlign: 'center', maxWidth: 420 }}>3 intentos fallidos. Espera a que termine la cuenta atrás o avisa al responsable.</div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 'clamp(24px,5vw,70px)', padding: '20px 16px 30px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, minWidth: 260 }}>
              {pantalla === 'pin' && sel && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Avatar e={sel} size={64} />
                  <div style={{ fontFamily: OSW, fontWeight: 600, fontSize: 'clamp(22px,3.2vw,30px)', textTransform: 'uppercase', boxShadow: `inset 0 -12px 0 ${AMA}` }}>{sel.nombre.split(' ')[0]}</div>
                </div>
              )}
              {pantalla === 'adminpin' && (
                <div style={{ fontFamily: OSW, fontWeight: 600, fontSize: 24, letterSpacing: 2, boxShadow: `inset 0 -12px 0 ${AMA}` }}>ADMINISTRACIÓN</div>
              )}
              <div style={{ fontFamily: OSW, fontSize: 14, letterSpacing: 3, color: MUT }}>INTRODUCE TU PIN</div>
              <Puntos val={pantalla === 'pin' ? pin : adminPin} error={!!pinError || !!adminError} />
              {(pinError || adminError) ? (
                <div style={{ fontFamily: OSW, fontWeight: 600, fontSize: 18, color: ROJO, letterSpacing: 1 }}>
                  {pantalla === 'pin' ? `PIN INCORRECTO · INTENTO ${intento} DE 3` : adminError}
                </div>
              ) : (
                <div style={{ fontFamily: LEX, fontSize: 14, color: MUT }}>6 cifras</div>
              )}
            </div>
            <Teclado esAdmin={pantalla === 'adminpin'} />
          </div>
        )}
      </>)}

      {/* ══ ACCIÓN ══ */}
      {pantalla === 'accion' && sel && (() => {
        const acciones: Tipo[] = sel.estado === 'fuera' ? ['entrada'] : sel.estado === 'trabajando' ? ['pausa_inicio', 'salida'] : ['pausa_fin']
        return (<>
          <Cabecera>
            <button onClick={irInicio} style={{ ...boton(BLANCO, TINTA), fontSize: 17, padding: '12px 20px' }}>← VOLVER</button>
          </Cabecera>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Avatar e={sel} size={72} />
              <div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 'clamp(28px,4vw,40px)', textTransform: 'uppercase', lineHeight: 1 }}>Hola, {sel.nombre.split(' ')[0]}</div>
                <div style={{ fontFamily: LEX, fontSize: 16, color: MUT, marginTop: 6 }}>
                  {sel.estado === 'trabajando' && `Trabajando desde ${sel.entrada_ts ? fmtHora(sel.entrada_ts) : '—'} · llevas ${fmtMin(sel.min_trabajo)}`}
                  {sel.estado === 'pausa' && `En pausa · ${fmtMin(sel.min_pausa)} de pausa hoy`}
                  {sel.estado === 'fuera' && (sel.horario_hoy[0] ? `Hoy se te espera de ${hhmm(sel.horario_hoy[0].inicio)} a ${hhmm(sel.horario_hoy[0].fin)}` : 'Hoy no tienes horario asignado')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
              {acciones.map(t => (
                <button key={t} disabled={enviando} onClick={() => ficharAccion(t)}
                  style={{ ...boton(COLOR_ACCION[t], t === 'pausa_inicio' || t === 'pausa_fin' ? TINTA : BLANCO), fontSize: 'clamp(26px,4vw,40px)', padding: '34px 48px', minWidth: 260, opacity: enviando ? 0.6 : 1 }}>
                  {ETIQUETA[t]}
                </button>
              ))}
            </div>
          </div>
        </>)
      })()}

      {/* ══ CONFIRMACIÓN ══ */}
      {pantalla === 'confirm' && confirm && (
        <div style={{ flex: 1, background: COLOR_ACCION[confirm.tipo], color: confirm.tipo === 'pausa_inicio' || confirm.tipo === 'pausa_fin' ? TINTA : BLANCO, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, animation: 'fichajePop .25s' }}>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 'clamp(90px,16vw,150px)', lineHeight: 1 }}>✓</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 'clamp(30px,5vw,52px)', letterSpacing: 2 }}>{ETIQUETA[confirm.tipo]} REGISTRADA · {confirm.hora}</div>
          {confirm.tipo === 'salida' && confirm.resumen && (
            <div style={{ fontFamily: LEX, fontSize: 'clamp(17px,2.5vw,22px)' }}>
              Hoy: {fmtMin(confirm.resumen.min_trabajo)} trabajadas · {fmtMin(confirm.resumen.min_pausa)} de pausa. ¡Hasta mañana!
            </div>
          )}
        </div>
      )}

      {/* ══ ADMIN ══ */}
      {pantalla === 'admin' && adminData && (<>
        <Cabecera>
          <button onClick={irInicio} style={{ ...boton(BLANCO, TINTA), fontSize: 17, padding: '12px 20px' }}>← SALIR</button>
        </Cabecera>
        <div style={{ flex: 1, width: '100%', maxWidth: 1100, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: BLANCO, borderTop: `7px solid ${TINTA}`, border: BORDE, padding: 18 }}>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, letterSpacing: 1, marginBottom: 12 }}>REGISTROS DE HOY · {adminData.fecha}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: LEX, fontSize: 14.5 }}>
              <thead>
                <tr style={{ fontFamily: OSW, letterSpacing: 1, fontSize: 12, color: MUT, textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>EMPLEADO</th><th>ENTRADA</th><th>SALIDA</th><th>PAUSAS</th><th style={{ textAlign: 'right' }}>TOTAL</th><th>EVENTOS</th>
                </tr>
              </thead>
              <tbody>
                {adminData.registros.map(r => (
                  <tr key={r.empleado_id} style={{ borderTop: `2px solid ${CLARO}` }}>
                    <td style={{ padding: '10px 8px', fontFamily: OSW, fontWeight: 600 }}>{r.nombre}</td>
                    <td>{r.entrada_ts ? fmtHora(r.entrada_ts) : '—'}</td>
                    <td>{r.salida_ts ? fmtHora(r.salida_ts) : '—'}</td>
                    <td>{fmtMin(r.min_pausa)}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtMin(r.min_trabajo)}</td>
                    <td style={{ color: MUT, fontSize: 13 }}>{r.eventos.map(ev => `${ETIQUETA[ev.tipo as Tipo] || ev.tipo} ${fmtHora(ev.ts)}${ev.correccion ? '*' : ''}`).join(' · ')}</td>
                  </tr>
                ))}
                {!adminData.registros.length && <tr><td colSpan={6} style={{ padding: 16, color: MUT }}>Sin fichajes hoy.</td></tr>}
              </tbody>
            </table>
            <div style={{ fontFamily: LEX, fontSize: 12, color: MUT, marginTop: 10 }}>
              * = corrección manual (queda trazada). Las correcciones y el informe mensual completo están en el ERP → Equipo → Presencia.
            </div>
          </div>
        </div>
      </>)}
    </div>
  )
}
