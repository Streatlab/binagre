// EQUIPO · CONTROL DE PRESENCIA
// Lee el registro legal de fichajes (RD-ley 8/2019) que alimenta el quiosco /fichaje.
// Ya NO usa la tabla `usuarios` ni inserta fichajes a pelo: todo pasa por la API
// protegida (/api/operaciones/fichaje/admin-*), que exige el PIN de administración.
// El registro es inalterable: aquí no se edita nada, solo se AÑADEN correcciones
// con motivo obligatorio, que quedan trazadas como tales.
import { useCallback, useEffect, useState } from 'react'
import type { jsPDF } from 'jspdf'
import { BLANCO, CLARO, GRANATE, GRIS, INK, LIMA, NAR, VERDE } from '@/styles/neobrutal'
import { FONT } from '@/styles/tokens'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel, SHADOW_DURA } from '@/components/kit/cantera'
import * as M from '@/lib/marcoDoc'
import BotonImprimir from '@/components/BotonImprimir'

// ── Tipos ──────────────────────────────────────────────────────────────────

type Evento = { id: string; tipo: string; ts: string; correccion: boolean; motivo: string | null }

type Registro = {
  empleado_id: string
  nombre: string
  previsto_inicio: string | null
  previsto_fin: string | null
  eventos: Evento[]
  estado: string
  min_trabajo: number
  min_pausa: number
  entrada_ts: string | null
  salida_ts: string | null
}

type DiaInforme = {
  fecha: string
  estado: string
  min_trabajo: number
  min_pausa: number
  entrada_ts: string | null
  salida_ts: string | null
  previsto_inicio: string | null
  previsto_fin: string | null
  corregido: boolean
}

type Empleado = { id: string; nombre: string; nif: string | null; fichaje_activo: boolean | null }

// ── Tokens ─────────────────────────────────────────────────────────────────

const PRI = INK
const MUT = GRIS
const ROJO = GRANATE
const FONT_BODY = FONT.body
const FONT_LABEL = FONT.heading
const AREA: M.Area = 'equipo'
const LLAVE_SESION = 'sl.fichaje.pinAdmin'

const TIPOS: Array<{ v: string; t: string }> = [
  { v: 'entrada', t: 'Entrada' },
  { v: 'pausa_inicio', t: 'Empieza pausa' },
  { v: 'pausa_fin', t: 'Vuelve de pausa' },
  { v: 'salida', t: 'Salida' },
]

// ── Utilidades ─────────────────────────────────────────────────────────────

function hoyMadrid(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date())
}

function mesMadrid(): string {
  return hoyMadrid().slice(0, 7)
}

function fmtHora(ts: string | null): string {
  if (!ts) return '—'
  return new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts))
}

function fmtHoraPrevista(h: string | null): string {
  return h ? h.slice(0, 5) : '—'
}

function fmtMin(min: number): string {
  if (!min || min <= 0) return '—'
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`
}

function fmtFechaLarga(f: string): string {
  const [y, m, d] = f.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function nombreTipo(t: string): string {
  return TIPOS.find(x => x.v === t)?.t ?? t
}

function colorEstado(e: string): string {
  return e === 'trabajando' ? VERDE : e === 'pausa' ? NAR : MUT
}

/** Une día + hora local (el ERP se usa desde España) en un instante ISO. */
function isoDesde(fecha: string, hora: string): string {
  return new Date(`${fecha}T${hora}:00`).toISOString()
}

async function llamar<T>(accion: string, cuerpo: Record<string, unknown>, pin: string): Promise<T> {
  const r = await fetch(`/api/operaciones/fichaje/${accion}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...cuerpo, pin_admin: pin }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((j as { error?: string })?.error || 'No se pudo consultar el registro')
  return j as T
}

// ── PDF: parte mensual firmable (marco de documentos, área Equipo) ─────────

function construirParteMensual(
  nombre: string,
  nif: string | null,
  mes: string,
  dias: DiaInforme[],
  rec: M.Recursos,
  bn = false,
): jsPDF | null {
  if (dias.length === 0) return null

  const doc = M.nuevaHoja({ orientation: 'landscape' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA, bn)
  const cb = M.contentBox(doc)

  const xFecha = cb.x0 + 1.5
  const xPrev = cb.x0 + cb.w * 0.20
  const xEnt = cb.x0 + cb.w * 0.38
  const xSal = cb.x0 + cb.w * 0.50
  const xPau = cb.x0 + cb.w * 0.62
  const xTra = cb.x0 + cb.w * 0.74
  const xObs = cb.x0 + cb.w * 0.88

  const [y0, m0] = mes.split('-').map(Number)
  const etiquetaMes = new Date(y0, m0 - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  const nuevaPagina = () => {
    M.pintarEspina(doc, AREA, ctx, bn)
    return M.pintarCabecera(doc, ctx, {
      docNombre: 'Registro de Jornada',
      meta: `${etiquetaMes}${nif ? ` · NIF ${nif}` : ''}`,
      tituloCentrado: nombre,
      area: AREA,
      bn,
    })
  }
  let y = nuevaPagina()

  doc.setFillColor(pal.soft2[0], pal.soft2[1], pal.soft2[2]); doc.rect(cb.x0, y, cb.w, 6, 'F')
  M.fTitulo(doc, ctx, true); doc.setFontSize(8); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
  doc.text('Fecha', xFecha, y + 4.2)
  doc.text('Previsto', xPrev, y + 4.2)
  doc.text('Entrada', xEnt, y + 4.2)
  doc.text('Salida', xSal, y + 4.2)
  doc.text('Pausa', xPau, y + 4.2)
  doc.text('Trabajado', xTra, y + 4.2)
  doc.text('Obs.', xObs, y + 4.2)
  y += 6

  let totalMin = 0
  for (const d of dias) {
    if (y > cb.bottom - 22) { doc.addPage(); y = nuevaPagina() }
    doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.1); doc.line(cb.x0, y + 4.6, cb.x1, y + 4.6)
    M.fDato(doc, ctx, false); doc.setFontSize(9); doc.setTextColor(...M.TINTA)
    doc.text(fmtFechaLarga(d.fecha), xFecha, y + 3.6)
    doc.setTextColor(...M.GRIS)
    doc.text(
      d.previsto_inicio ? `${fmtHoraPrevista(d.previsto_inicio)}–${fmtHoraPrevista(d.previsto_fin)}` : '—',
      xPrev, y + 3.6,
    )
    doc.text(fmtHora(d.entrada_ts), xEnt, y + 3.6)
    doc.text(fmtHora(d.salida_ts), xSal, y + 3.6)
    doc.text(fmtMin(d.min_pausa), xPau, y + 3.6)
    doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
    doc.text(fmtMin(d.min_trabajo), xTra, y + 3.6)
    doc.setTextColor(...M.GRIS)
    doc.text(d.corregido ? 'Corregido' : '', xObs, y + 3.6)
    totalMin += d.min_trabajo
    y += 4.8
  }

  y += 3
  if (y > cb.bottom - 20) { doc.addPage(); y = nuevaPagina() }
  doc.setDrawColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.setLineWidth(0.4); doc.line(cb.x0, y, cb.x1, y)
  y += 4
  M.fTitulo(doc, ctx, true); doc.setFontSize(10); doc.setTextColor(...M.TINTA)
  doc.text('TOTAL HORAS DEL MES', xFecha, y)
  doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
  doc.text(fmtMin(totalMin), xTra, y)

  // Firma: exigida por la normativa de registro de jornada.
  y += 14
  if (y > cb.bottom - 6) { doc.addPage(); y = nuevaPagina() + 14 }
  doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.2)
  doc.line(cb.x0, y, cb.x0 + cb.w * 0.34, y)
  doc.line(cb.x0 + cb.w * 0.52, y, cb.x1, y)
  M.fTitulo(doc, ctx, true); doc.setFontSize(8); doc.setTextColor(...M.GRIS)
  doc.text('Firma del trabajador', cb.x0, y + 4)
  doc.text('Firma de la empresa', cb.x0 + cb.w * 0.52, y + 4)

  const totalPag = doc.getNumberOfPages()
  for (let p = 1; p <= totalPag; p++) { doc.setPage(p); M.pintarPaginado(doc, p, totalPag, ctx) }
  return doc
}

// ── Piezas ─────────────────────────────────────────────────────────────────

function Kpi({ label, value, color, first }: { label: string; value: string | number; color?: string; first?: boolean }) {
  return (
    <PlanchaCelda first={first} bg={BLANCO} color={color ?? PRI}>
      <div style={{ fontFamily: FONT_LABEL, fontSize: 11, color: MUT, letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: FONT_LABEL, fontSize: 28, fontWeight: 700, color: color ?? PRI }}>{value}</div>
    </PlanchaCelda>
  )
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: FONT_LABEL, fontSize: 13, fontWeight: 600, letterSpacing: '1px',
        textTransform: 'uppercase' as const, padding: '8px 18px', borderRadius: 0,
        border: `3px solid ${INK}`, boxShadow: active ? SHADOW_DURA : 'none',
        background: active ? ROJO : BLANCO, color: active ? BLANCO : MUT, cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

const inputStyle = {
  background: BLANCO, border: `2px solid ${INK}`, borderRadius: 0, color: PRI,
  fontFamily: FONT_BODY, fontSize: 13, padding: '6px 10px',
}

const btnStyle = (bg: string, color = BLANCO) => ({
  fontFamily: FONT_LABEL, fontSize: 12, fontWeight: 700, letterSpacing: '0.5px',
  textTransform: 'uppercase' as const, padding: '7px 16px', border: `3px solid ${INK}`,
  boxShadow: SHADOW_DURA, borderRadius: 0, cursor: 'pointer', background: bg, color,
})

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: FONT_LABEL, fontSize: 11, color: MUT, letterSpacing: '1px', marginBottom: 4, textTransform: 'uppercase' as const }}>
      {children}
    </div>
  )
}

// ── Pantalla ───────────────────────────────────────────────────────────────

export default function ControlPresencia() {
  const [pin, setPin] = useState<string>('')
  const [pinInput, setPinInput] = useState('')
  const [errorPin, setErrorPin] = useState('')

  const [tab, setTab] = useState<'dia' | 'parte'>('dia')
  const [fecha, setFecha] = useState<string>(hoyMadrid())
  const [registros, setRegistros] = useState<Registro[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  // Corrección: añadir evento olvidado
  const [addPara, setAddPara] = useState<string | null>(null)
  const [addTipo, setAddTipo] = useState('entrada')
  const [addHora, setAddHora] = useState('09:00')
  const [addMotivo, setAddMotivo] = useState('')

  // Corrección: anular evento
  const [anular, setAnular] = useState<{ id: string; empleado_id: string } | null>(null)
  const [anularMotivo, setAnularMotivo] = useState('')

  // Parte mensual
  const [parteEmp, setParteEmp] = useState('')
  const [parteMes, setParteMes] = useState(mesMadrid())
  const [parteDias, setParteDias] = useState<DiaInforme[]>([])
  const [parteCargando, setParteCargando] = useState(false)

  useEffect(() => {
    const guardado = sessionStorage.getItem(LLAVE_SESION)
    if (guardado) setPin(guardado)
  }, [])

  const cargarDia = useCallback(async () => {
    if (!pin) return
    setCargando(true); setError('')
    try {
      const r = await llamar<{ registros: Registro[] }>('admin-registros', { fecha }, pin)
      setRegistros(r.registros || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setCargando(false)
    }
  }, [pin, fecha])

  const cargarEmpleados = useCallback(async () => {
    if (!pin) return
    try {
      const r = await llamar<{ empleados: Empleado[] }>('admin-empleados', {}, pin)
      setEmpleados(r.empleados || [])
      setParteEmp(prev => prev || (r.empleados?.[0]?.id ?? ''))
    } catch { /* silencio: el día ya avisa si el PIN falla */ }
  }, [pin])

  useEffect(() => { if (pin) { cargarDia(); cargarEmpleados() } }, [pin, cargarDia, cargarEmpleados])

  const cargarParte = useCallback(async () => {
    if (!pin || !parteEmp) return
    setParteCargando(true)
    try {
      const r = await llamar<{ dias: DiaInforme[] }>('admin-informe', { empleado_id: parteEmp, mes: parteMes }, pin)
      setParteDias(r.dias || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setParteCargando(false)
    }
  }, [pin, parteEmp, parteMes])

  useEffect(() => { if (tab === 'parte') cargarParte() }, [tab, cargarParte])

  async function entrar() {
    setErrorPin('')
    try {
      await llamar('admin-registros', { fecha: hoyMadrid() }, pinInput)
      sessionStorage.setItem(LLAVE_SESION, pinInput)
      setPin(pinInput)
      setPinInput('')
    } catch {
      setErrorPin('PIN de administración incorrecto.')
    }
  }

  function salir() {
    sessionStorage.removeItem(LLAVE_SESION)
    setPin(''); setRegistros([]); setEmpleados([]); setParteDias([])
  }

  async function guardarAlta(empleadoId: string) {
    if (!addMotivo.trim()) { setError('El motivo es obligatorio: el registro es inalterable y toda corrección queda trazada.'); return }
    try {
      await llamar('admin-corregir', {
        empleado_id: empleadoId, tipo: addTipo, ts: isoDesde(fecha, addHora), motivo: addMotivo.trim(),
      }, pin)
      setAddPara(null); setAddMotivo(''); setError('')
      cargarDia()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  async function guardarAnulacion() {
    if (!anular) return
    if (!anularMotivo.trim()) { setError('El motivo es obligatorio para anular un fichaje.'); return }
    try {
      await llamar('admin-corregir', {
        empleado_id: anular.empleado_id, anula_id: anular.id, motivo: anularMotivo.trim(),
      }, pin)
      setAnular(null); setAnularMotivo(''); setError('')
      cargarDia()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  // ── Candado: sin PIN no se ve el registro ────────────────────────────────
  if (!pin) {
    return (
      <PantallaCantera embedded style={{ fontFamily: FONT_BODY }}>
        <HeroCantera
          area="equipo"
          titular="El registro de jornada está protegido"
          etiquetaDato="Acceso"
          cifra="PIN"
          resumen={<>Solo con el PIN de administración se pueden ver y corregir los fichajes del equipo.</>}
          atencion={['Registro inalterable', 'Correcciones trazadas']}
        />
        <Papel ceja={GRANATE}>
          <Etiqueta>PIN de administración</Etiqueta>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="password"
              inputMode="numeric"
              value={pinInput}
              onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => { if (e.key === 'Enter') entrar() }}
              placeholder="······"
              style={{ ...inputStyle, fontSize: 20, letterSpacing: '8px', width: 160 }}
            />
            <button onClick={entrar} style={btnStyle(VERDE)}>Entrar</button>
          </div>
          {errorPin && <p style={{ color: ROJO, fontSize: 13, marginTop: 10 }}>{errorPin}</p>}
        </Papel>
      </PantallaCantera>
    )
  }

  const dentro = registros.filter(r => r.estado === 'trabajando').length
  const enPausa = registros.filter(r => r.estado === 'pausa').length
  const conRegistro = registros.filter(r => r.eventos.length > 0).length
  const ausentes = registros.filter(r => r.previsto_inicio && r.eventos.length === 0)
  const minTotal = registros.reduce((a, r) => a + r.min_trabajo, 0)
  const esHoy = fecha === hoyMadrid()
  const empParte = empleados.find(e => e.id === parteEmp)
  const minParte = parteDias.reduce((a, d) => a + d.min_trabajo, 0)

  return (
    <PantallaCantera embedded style={{ fontFamily: FONT_BODY }}>
      <HeroCantera
        area="equipo"
        titular={esHoy
          ? (dentro > 0 ? `Ahora mismo hay ${dentro} persona${dentro !== 1 ? 's' : ''} trabajando` : 'Ahora mismo no hay nadie fichado dentro')
          : `Registro del ${fmtFechaLarga(fecha)}`}
        etiquetaDato={esHoy ? 'Dentro ahora' : 'Con registro'}
        cifra={esHoy ? String(dentro) : String(conRegistro)}
        resumen={<>{fmtMin(minTotal)} de jornada registrada · {conRegistro} persona{conRegistro !== 1 ? 's' : ''} con fichajes.</>}
        atencion={[`${dentro} trabajando`, `${enPausa} en pausa`, `${ausentes.length} sin fichar`]}
      />

      {ausentes.length > 0 ? (
        <FrasePotente significado="peligro">
          {ausentes.length} persona{ausentes.length !== 1 ? 's' : ''} con turno previsto y sin ningún fichaje: {ausentes.map(a => a.nombre).join(', ')}.
        </FrasePotente>
      ) : conRegistro === 0 ? (
        <FrasePotente significado="coste">Sin fichajes en esta fecha: comprueba que la tablet del quiosco esté encendida.</FrasePotente>
      ) : (
        <FrasePotente significado="logro">Registro de jornada al día: {conRegistro} persona{conRegistro !== 1 ? 's' : ''} y {fmtMin(minTotal)} anotadas.</FrasePotente>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <TabBtn label="Día" active={tab === 'dia'} onClick={() => setTab('dia')} />
        <TabBtn label="Parte mensual" active={tab === 'parte'} onClick={() => setTab('parte')} />
        <button onClick={salir} style={{ ...btnStyle(BLANCO, MUT), marginLeft: 'auto', boxShadow: 'none' }}>Bloquear</button>
      </div>

      {error && (
        <div style={{ border: `3px solid ${INK}`, background: BLANCO, padding: '10px 14px', color: ROJO, fontSize: 13 }}>{error}</div>
      )}

      {/* ── DÍA ── */}
      {tab === 'dia' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SeccionLabel bg={GRANATE}>Fecha</SeccionLabel>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: -12 }}>
            <div>
              <Etiqueta>Día</Etiqueta>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle} />
            </div>
            <button onClick={cargarDia} style={btnStyle(INK)}>Actualizar</button>
          </div>

          <Plancha>
            <Kpi first label="Trabajando" value={dentro} color={VERDE} />
            <Kpi label="En pausa" value={enPausa} color={NAR} />
            <Kpi label="Sin fichar" value={ausentes.length} color={ausentes.length ? ROJO : MUT} />
            <Kpi label="Jornada del día" value={fmtMin(minTotal)} />
          </Plancha>

          {cargando ? (
            <p style={{ color: MUT, fontSize: 14 }}>Cargando registro…</p>
          ) : registros.length === 0 ? (
            <p style={{ color: MUT, fontSize: 14 }}>Sin fichajes ni turnos previstos en esta fecha.</p>
          ) : (
            registros.map(r => (
              <Papel key={r.empleado_id} ceja={r.eventos.length === 0 && r.previsto_inicio ? ROJO : GRANATE}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: colorEstado(r.estado), flexShrink: 0 }} />
                  <div style={{ fontFamily: FONT_LABEL, fontSize: 16, color: PRI, fontWeight: 700 }}>{r.nombre}</div>
                  <div style={{ fontSize: 12, color: MUT }}>
                    Previsto {r.previsto_inicio ? `${fmtHoraPrevista(r.previsto_inicio)}–${fmtHoraPrevista(r.previsto_fin)}` : 'sin turno'}
                    {' · '}Entrada {fmtHora(r.entrada_ts)} · Salida {fmtHora(r.salida_ts)}
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 18, alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: FONT_LABEL, fontSize: 18, color: PRI }}>{fmtMin(r.min_trabajo)}</div>
                      <div style={{ fontSize: 11, color: MUT }}>trabajado</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: FONT_LABEL, fontSize: 18, color: MUT }}>{fmtMin(r.min_pausa)}</div>
                      <div style={{ fontSize: 11, color: MUT }}>pausa</div>
                    </div>
                    <button
                      onClick={() => { setAddPara(addPara === r.empleado_id ? null : r.empleado_id); setAddMotivo(''); setError('') }}
                      style={btnStyle(LIMA, INK)}
                    >
                      {addPara === r.empleado_id ? 'Cancelar' : 'Añadir fichaje'}
                    </button>
                  </div>
                </div>

                {r.eventos.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    {r.eventos.map(ev => (
                      <div
                        key={ev.id}
                        style={{
                          border: `2px solid ${INK}`, background: ev.correccion ? CLARO : BLANCO,
                          padding: '6px 10px', display: 'flex', gap: 8, alignItems: 'center',
                        }}
                      >
                        <span style={{ fontFamily: FONT_LABEL, fontSize: 13, color: PRI }}>{fmtHora(ev.ts)}</span>
                        <span style={{ fontSize: 12, color: MUT }}>{nombreTipo(ev.tipo)}</span>
                        {ev.correccion && (
                          <span title={ev.motivo ?? ''} style={{ fontFamily: FONT_LABEL, fontSize: 10, color: NAR, letterSpacing: '0.5px' }}>CORREGIDO</span>
                        )}
                        <button
                          onClick={() => { setAnular({ id: ev.id, empleado_id: r.empleado_id }); setAnularMotivo(''); setError('') }}
                          style={{ background: 'none', border: 'none', color: ROJO, fontSize: 11, cursor: 'pointer', fontFamily: FONT_LABEL, letterSpacing: '0.5px' }}
                        >
                          ANULAR
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {anular?.empleado_id === r.empleado_id && (
                  <div style={{ marginTop: 12, borderTop: `2px solid ${INK}`, paddingTop: 12, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <Etiqueta>Motivo de la anulación (obligatorio)</Etiqueta>
                      <input
                        value={anularMotivo}
                        onChange={e => setAnularMotivo(e.target.value)}
                        placeholder="Ej.: fichaje duplicado por error"
                        style={{ ...inputStyle, width: '100%' }}
                      />
                    </div>
                    <button onClick={guardarAnulacion} style={btnStyle(ROJO)}>Anular</button>
                    <button onClick={() => setAnular(null)} style={{ ...btnStyle(BLANCO, MUT), boxShadow: 'none' }}>Cancelar</button>
                  </div>
                )}

                {addPara === r.empleado_id && (
                  <div style={{ marginTop: 12, borderTop: `2px solid ${INK}`, paddingTop: 12, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div>
                      <Etiqueta>Qué</Etiqueta>
                      <select value={addTipo} onChange={e => setAddTipo(e.target.value)} style={inputStyle}>
                        {TIPOS.map(t => <option key={t.v} value={t.v}>{t.t}</option>)}
                      </select>
                    </div>
                    <div>
                      <Etiqueta>Hora</Etiqueta>
                      <input type="time" value={addHora} onChange={e => setAddHora(e.target.value)} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <Etiqueta>Motivo (obligatorio)</Etiqueta>
                      <input
                        value={addMotivo}
                        onChange={e => setAddMotivo(e.target.value)}
                        placeholder="Ej.: se dejó el móvil y no pudo fichar"
                        style={{ ...inputStyle, width: '100%' }}
                      />
                    </div>
                    <button onClick={() => guardarAlta(r.empleado_id)} style={btnStyle(VERDE)}>Guardar</button>
                  </div>
                )}
              </Papel>
            ))
          )}
        </div>
      )}

      {/* ── PARTE MENSUAL ── */}
      {tab === 'parte' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SeccionLabel bg={GRANATE}>Parte para inspección</SeccionLabel>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: -12 }}>
            <div>
              <Etiqueta>Empleado</Etiqueta>
              <select value={parteEmp} onChange={e => setParteEmp(e.target.value)} style={{ ...inputStyle, minWidth: 200 }}>
                {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div>
              <Etiqueta>Mes</Etiqueta>
              <input type="month" value={parteMes} onChange={e => setParteMes(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <BotonImprimir
                compacto
                documentoId="equipo.registro_jornada_mes"
                titulo={`Registro de jornada · ${empParte?.nombre ?? ''}`}
                generarPdf={async opts => {
                  if (!empParte) return null
                  const rec = await M.cargarRecursos()
                  return construirParteMensual(empParte.nombre, empParte.nif, parteMes, parteDias, rec, opts.bn)
                }}
              />
            </div>
          </div>

          <Plancha>
            <Kpi first label="Horas del mes" value={fmtMin(minParte)} />
            <Kpi label="Días con jornada" value={parteDias.filter(d => d.min_trabajo > 0).length} />
            <Kpi label="Días corregidos" value={parteDias.filter(d => d.corregido).length} color={parteDias.some(d => d.corregido) ? NAR : MUT} />
          </Plancha>

          {parteCargando ? (
            <p style={{ color: MUT, fontSize: 14 }}>Cargando parte…</p>
          ) : parteDias.length === 0 ? (
            <p style={{ color: MUT, fontSize: 14 }}>Sin jornadas ni turnos previstos en el mes.</p>
          ) : (
            <Papel ceja={GRANATE} pad="0" style={{ overflow: 'hidden' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '110px 140px 90px 90px 100px 110px 1fr',
                background: INK, padding: '10px 16px', fontFamily: FONT_LABEL, fontSize: 11,
                color: BLANCO, letterSpacing: '1.5px', textTransform: 'uppercase' as const,
              }}>
                <div>Fecha</div><div>Previsto</div><div>Entrada</div><div>Salida</div><div>Pausa</div><div>Trabajado</div><div>Obs.</div>
              </div>
              {parteDias.map((d, i) => (
                <div
                  key={d.fecha}
                  style={{
                    display: 'grid', gridTemplateColumns: '110px 140px 90px 90px 100px 110px 1fr',
                    padding: '10px 16px', background: i % 2 === 0 ? BLANCO : CLARO,
                    borderTop: `1px solid ${INK}`, fontSize: 13, color: PRI, alignItems: 'center',
                  }}
                >
                  <div style={{ fontFamily: FONT_LABEL }}>{fmtFechaLarga(d.fecha)}</div>
                  <div style={{ color: MUT }}>{d.previsto_inicio ? `${fmtHoraPrevista(d.previsto_inicio)}–${fmtHoraPrevista(d.previsto_fin)}` : '—'}</div>
                  <div style={{ color: VERDE }}>{fmtHora(d.entrada_ts)}</div>
                  <div style={{ color: MUT }}>{fmtHora(d.salida_ts)}</div>
                  <div style={{ color: MUT }}>{fmtMin(d.min_pausa)}</div>
                  <div style={{ color: d.min_trabajo > 0 ? PRI : ROJO }}>{d.min_trabajo > 0 ? fmtMin(d.min_trabajo) : 'Sin fichar'}</div>
                  <div style={{ color: NAR, fontSize: 11, fontFamily: FONT_LABEL }}>{d.corregido ? 'CORREGIDO' : ''}</div>
                </div>
              ))}
            </Papel>
          )}
        </div>
      )}
    </PantallaCantera>
  )
}
