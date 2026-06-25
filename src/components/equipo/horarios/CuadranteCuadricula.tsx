/**
 * Cuadrante visual común — Esta Semana, Histórico, Próxima, Plantillas, Generador.
 * Edición inline: cada celda admite hasta 2 turnos (HH:MM). El conteo diario y
 * semanal se recalcula en vivo. Botón Guardar persiste en Supabase (overrides).
 * Los cambios se emiten en vivo a la página para que Exportar use lo que se ve.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ChevronUp, ChevronDown, X, Plus } from 'lucide-react'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { esFestivo, nombreFestivo } from '@/utils/festivosMadrid'
import {
  DIAS, type DiaKey, type Empleado, type Turno, type Tramo,
  horasReales, horasBrutas,
} from './utils'
import {
  cargarOverrides, guardarOverride, claveOverride, normalizarHora,
  type OverridesMap,
} from './overrides'
import { crearEmpleado, desactivarEmpleado, guardarOrden } from './personal'

const FESTIVO_ROJO = '#B01D23'
const SEMANA_SIN_LIBRE = '2026-06-15'

/** Empleados con 30 min de descanso descontado. */
const CON_DESCUENTO = ['Ray', 'Andrés', 'Héctor']

function fmtHM(h: number): string {
  const totalMin = Math.round(h * 60)
  const hh = Math.floor(totalMin / 60)
  const mm = totalMin % 60
  return mm === 0 ? `${hh}h` : `${hh}h ${mm}min`
}

export function nombrePila(nombre: string): string {
  return nombre.trim().split(/\s+/)[0]
}

function descuentoMin(pila: string): number {
  return CON_DESCUENTO.includes(pila) ? 30 : 0
}

function turnoDe(tramos: Tramo[], pila: string): Turno {
  return { empleado_id: '', dia: 'Lun', tramos, descuento_min: descuentoMin(pila) }
}

function miniBtn(T: ReturnType<typeof useTheme>['T'], disabled: boolean): CSSProperties {
  return {
    width: 18, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${T.brd}`, background: T.card, color: T.mut, borderRadius: 3,
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1, padding: 0,
  }
}

export const ORDEN_PILA = ['Ray', 'Andrés', 'Héctor', 'Emilio', 'Rubén']

export function ordenarEmpleados(emps: Empleado[]): Empleado[] {
  return [...emps].sort((a, b) => {
    const ia = ORDEN_PILA.indexOf(nombrePila(a.nombre))
    const ib = ORDEN_PILA.indexOf(nombrePila(b.nombre))
    const ra = ia === -1 ? Infinity : ia
    const rb = ib === -1 ? Infinity : ib
    if (ra !== rb) return ra - rb
    return a.nombre.localeCompare(b.nombre, 'es')
  })
}

export function isoDeFecha(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fechasSemana(lunes: Date) {
  return DIAS.map((dia, i) => {
    const d = new Date(lunes)
    d.setDate(d.getDate() + i)
    const iso = isoDeFecha(d)
    return { dia, fecha: d, iso, num: d.getDate(), festivo: esFestivo(iso), festNombre: nombreFestivo(iso) }
  })
}

export function expandirTurnos(
  empleados: Empleado[],
  turnosPorPila: Record<string, Partial<Record<DiaKey, Tramo[]>>>,
): Turno[] {
  const ts: Turno[] = []
  for (const emp of empleados) {
    const pila = nombrePila(emp.nombre)
    const turnosEmp = turnosPorPila[pila]
    if (!turnosEmp) continue
    for (const dia of DIAS) {
      const tramos = turnosEmp[dia]
      if (tramos && tramos.length > 0) {
        ts.push({ empleado_id: emp.id, dia, tramos, descuento_min: descuentoMin(pila) })
      }
    }
  }
  return ts
}

interface CuadranteProps {
  empleados: Empleado[]
  turnos: Turno[]
  lunes: Date
  cierres?: Partial<Record<DiaKey, string>>
  mostrarCierre?: boolean
  editable?: boolean
  onEmpleadosChange?: () => void
  onTurnosChange?: (turnos: Turno[]) => void
}

export function CuadranteCuadricula({
  empleados, turnos, lunes, cierres = {}, mostrarCierre = true,
  editable = true, onEmpleadosChange, onTurnosChange,
}: CuadranteProps) {
  const { T } = useTheme()
  const dias = useMemo(() => fechasSemana(lunes), [lunes])
  const ocultarLibre = isoDeFecha(lunes) === SEMANA_SIN_LIBRE
  const cols = `120px repeat(7, minmax(0,1fr)) 110px`

  const idxEmp = useMemo(() => {
    const m: Record<string, number> = {}
    empleados.forEach((e, i) => { m[e.id] = i })
    return m
  }, [empleados])

  // datos[clave] = tramos (vacío = libre). Base: datosReales (props.turnos).
  const [datos, setDatos] = useState<Record<string, Tramo[]>>({})

  const baseDatos = useMemo(() => {
    const m: Record<string, Tramo[]> = {}
    const isoPorDia: Record<string, string> = {}
    dias.forEach(d => { isoPorDia[d.dia] = d.iso })
    for (const t of turnos) {
      const iso = isoPorDia[t.dia]
      if (!iso) continue
      m[claveOverride(t.empleado_id, iso)] = t.tramos
    }
    return m
  }, [turnos, dias])

  useEffect(() => {
    let vivo = true
    setDatos(baseDatos)
    const desde = dias[0].iso
    const hasta = dias[6].iso
    cargarOverrides(desde, hasta).then((ov: OverridesMap) => {
      if (!vivo) return
      setDatos(prev => ({ ...prev, ...ov }))
    })
    return () => { vivo = false }
  }, [baseDatos, dias])

  const empleadosVisibles = useMemo(() => {
    if (editable) return empleados
    return empleados.filter(e =>
      dias.some(d => (datos[claveOverride(e.id, d.iso)] ?? []).length > 0),
    )
  }, [empleados, dias, datos, editable])

  function color(idx: number) {
    const pal = [
      { bg: '#B5D4F4', text: '#042C53' },
      { bg: '#C0DD97', text: '#173404' },
      { bg: '#F4C0D1', text: '#4B1528' },
      { bg: '#FAC775', text: '#412402' },
      { bg: '#9FE1CB', text: '#04342C' },
      { bg: '#CECBF6', text: '#26215C' },
    ]
    return pal[idx % pal.length]
  }

  function totalEmp(empId: string, pila: string) {
    let real = 0, bruto = 0
    for (const d of dias) {
      const tr = datos[claveOverride(empId, d.iso)] ?? []
      if (tr.length === 0) continue
      const tu = turnoDe(tr, pila)
      real += horasReales(tu)
      bruto += horasBrutas(tu)
    }
    return { real, bruto }
  }

  function commit(empId: string, iso: string, tramos: Tramo[]) {
    const k = claveOverride(empId, iso)
    setDatos(prev => ({ ...prev, [k]: tramos }))
  }

  // Emite a la página los turnos efectivos en vivo (para que Exportar use lo que se ve).
  useEffect(() => {
    if (!onTurnosChange) return
    const out: Turno[] = []
    for (const emp of empleados) {
      const pila = nombrePila(emp.nombre)
      for (const d of dias) {
        const tr = datos[claveOverride(emp.id, d.iso)] ?? []
        if (tr.length > 0) out.push({ empleado_id: emp.id, dia: d.dia, tramos: tr, descuento_min: descuentoMin(pila) })
      }
    }
    onTurnosChange(out)
  }, [datos, empleados, dias, onTurnosChange])

  const [guardado, setGuardado] = useState<'idle' | 'guardando' | 'guardado'>('idle')

  async function guardarTodo() {
    setGuardado('guardando')
    for (const emp of empleados) {
      for (const d of dias) {
        const tr = datos[claveOverride(emp.id, d.iso)] ?? []
        await guardarOverride(emp.id, d.iso, tr)
      }
    }
    setGuardado('guardado')
    setTimeout(() => setGuardado('idle'), 2500)
  }

  const [nuevoNombre, setNuevoNombre] = useState('')

  async function moverEmpleado(idx: number, dir: -1 | 1) {
    const j = idx + dir
    if (j < 0 || j >= empleados.length) return
    const ids = empleados.map(e => e.id)
    ;[ids[idx], ids[j]] = [ids[j], ids[idx]]
    await guardarOrden(ids)
    onEmpleadosChange?.()
  }

  async function eliminarEmpleado(emp: Empleado) {
    if (!window.confirm(`¿Quitar a ${nombrePila(emp.nombre)} de los horarios? Su histórico se conserva.`)) return
    await desactivarEmpleado(emp.id)
    onEmpleadosChange?.()
  }

  async function anadirEmpleado() {
    const nombre = nuevoNombre.trim()
    if (!nombre) return
    await crearEmpleado(nombre, empleados.length + 1)
    setNuevoNombre('')
    onEmpleadosChange?.()
  }

  const filaCierre = mostrarCierre && Object.keys(cierres).length > 0

  return (
    <div>
      <style>{`
        .hor-input::placeholder { color: rgba(0,0,0,0.25); }
      `}</style>

      {editable && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          {guardado === 'guardado' && (
            <span style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: '#1D9E75', fontWeight: 600 }}>Guardado ✓</span>
          )}
          <button
            onClick={guardarTodo}
            disabled={guardado === 'guardando'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT.heading, fontSize: 12,
              letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 700,
              color: '#fff', background: guardado === 'guardando' ? '#7a8' : '#1D9E75',
              border: 'none', padding: '8px 20px', borderRadius: 6,
              cursor: guardado === 'guardando' ? 'default' : 'pointer',
            }}
          >
            {guardado === 'guardando' ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      )}

      <div style={{ ...cardStyle(T), padding: 14, overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 3, minWidth: 920 }}>
          <div />
          {dias.map(({ dia, num, festivo, festNombre }) => (
            <div key={dia} title={festNombre ?? undefined}
              style={{ textAlign: 'center', padding: '6px 2px', borderRadius: 4, border: festivo ? `2px solid ${FESTIVO_ROJO}` : 'none' }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: festivo ? FESTIVO_ROJO : T.mut, fontWeight: festivo ? 700 : 500 }}>{dia} {num}</div>
              {festivo && (
                <div style={{ fontFamily: FONT.body, fontSize: 8, fontWeight: 600, color: FESTIVO_ROJO, lineHeight: 1.1, marginTop: 1 }}>{festNombre}</div>
              )}
            </div>
          ))}
          <div style={{ textAlign: 'center', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#B01D23', padding: '6px 2px' }}>Total</div>

          {empleadosVisibles.map((emp, rowIdx) => {
            const pila = nombrePila(emp.nombre)
            const col = color(idxEmp[emp.id] ?? 0)
            const tot = totalEmp(emp.id, pila)
            const hayDif = Math.abs(tot.bruto - tot.real) > 0.001
            return (
              <div key={emp.id} style={{ display: 'contents' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '8px 2px' }}>
                  {editable && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <button onClick={() => moverEmpleado(rowIdx, -1)} disabled={rowIdx === 0}
                        style={miniBtn(T, rowIdx === 0)} title="Subir"><ChevronUp size={12} /></button>
                      <button onClick={() => moverEmpleado(rowIdx, 1)} disabled={rowIdx === empleadosVisibles.length - 1}
                        style={miniBtn(T, rowIdx === empleadosVisibles.length - 1)} title="Bajar"><ChevronDown size={12} /></button>
                    </div>
                  )}
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 18, fontWeight: 600, color: T.pri, letterSpacing: '0.5px', flex: 1 }}>
                    {pila}
                  </span>
                  {editable && (
                    <button onClick={() => eliminarEmpleado(emp)} style={{ ...miniBtn(T, false), color: '#B01D23' }} title="Quitar de horarios">
                      <X size={13} />
                    </button>
                  )}
                </div>

                {dias.map(({ dia, iso, festivo }) => (
                  <Celda
                    key={dia}
                    seedKey={`${iso}-${(datos[claveOverride(emp.id, iso)] ?? []).map(t => t.entrada + t.salida).join('_')}`}
                    tramos={datos[claveOverride(emp.id, iso)] ?? []}
                    pila={pila} col={col} festivo={festivo} editable={editable}
                    ocultarLibre={ocultarLibre} T={T}
                    onCommit={(tr) => commit(emp.id, iso, tr)}
                  />
                ))}

                <div style={{ background: col.bg, color: col.text, borderRadius: 5, padding: '8px 4px', textAlign: 'center', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 3 }}>
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 18, fontWeight: 700 }}>{fmtHM(tot.real)}</span>
                  {hayDif && (
                    <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, fontWeight: 600, color: '#B01D23' }}>/{fmtHM(tot.bruto)}</span>
                  )}
                </div>
              </div>
            )
          })}

          {empleadosVisibles.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '40px 0', textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin datos.</div>
          )}

          {filaCierre && empleadosVisibles.length > 0 && (
            <>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#B01D23', fontWeight: 500, padding: '8px 4px', display: 'flex', alignItems: 'center' }}>Cierra</div>
              {dias.map(({ dia }) => (
                <div key={dia} style={{ fontFamily: FONT.body, fontSize: 11, textAlign: 'center', background: T.group, borderRadius: 4, padding: '6px 2px', fontWeight: 500, color: T.sec, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {cierres[dia] ?? ''}
                </div>
              ))}
              <div />
            </>
          )}
        </div>
      </div>

      {editable && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <input
            value={nuevoNombre}
            onChange={e => setNuevoNombre(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') anadirEmpleado() }}
            placeholder="Nombre de la persona…"
            style={{
              flex: '0 0 240px', maxWidth: 240, fontFamily: FONT.body, fontSize: 13,
              padding: '8px 10px', border: `1px solid ${T.brd}`, borderRadius: 6,
              background: T.card, color: T.pri, outline: 'none',
            }}
          />
          <button
            onClick={anadirEmpleado}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, fontFamily: FONT.heading, fontSize: 11,
              letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600,
              color: '#fff', background: '#1e2233', border: '1px solid #1e2233',
              padding: '8px 14px', borderRadius: 6, cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Añadir persona
          </button>
        </div>
      )}
    </div>
  )
}

function Celda({
  seedKey, tramos, pila, col, festivo, editable, ocultarLibre, T, onCommit,
}: {
  seedKey: string
  tramos: Tramo[]
  pila: string
  col: { bg: string; text: string }
  festivo: boolean
  editable: boolean
  ocultarLibre: boolean
  T: ReturnType<typeof useTheme>['T']
  onCommit: (tramos: Tramo[]) => void
}) {
  // estado local de los 2 tramos (4 campos)
  const [t1e, setT1e] = useState('')
  const [t1s, setT1s] = useState('')
  const [t2e, setT2e] = useState('')
  const [t2s, setT2s] = useState('')

  useEffect(() => {
    setT1e(tramos[0]?.entrada ?? '')
    setT1s(tramos[0]?.salida ?? '')
    setT2e(tramos[1]?.entrada ?? '')
    setT2s(tramos[1]?.salida ?? '')
  }, [seedKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const vacio = tramos.length === 0
  const real = vacio ? 0 : horasReales(turnoDe(tramos, pila))
  const bruto = vacio ? 0 : horasBrutas(turnoDe(tramos, pila))
  const hayDif = !vacio && Math.abs(bruto - real) > 0.001

  function commitDesdeCampos(n1e: string, n1s: string, n2e: string, n2s: string) {
    const e1 = normalizarHora(n1e), s1 = normalizarHora(n1s)
    const e2 = normalizarHora(n2e), s2 = normalizarHora(n2s)
    const out: Tramo[] = []
    if (e1 && s1) out.push({ entrada: e1, salida: s1 })
    if (e2 && s2) out.push({ entrada: e2, salida: s2 })
    out.sort((a, b) => a.entrada.localeCompare(b.entrada))
    onCommit(out)
  }

  const fondo = vacio ? T.group : col.bg
  const texto = vacio ? T.mut : col.text
  const borde = festivo ? `2px solid ${FESTIVO_ROJO}` : 'none'

  if (!editable) {
    return (
      <div style={{ background: fondo, color: texto, borderRadius: 5, padding: '8px 4px', textAlign: 'center', minHeight: 70, display: 'flex', flexDirection: 'column', justifyContent: 'center', border: borde, fontStyle: vacio ? 'italic' : 'normal', fontSize: vacio ? 13 : 16 }}>
        {vacio ? (ocultarLibre ? '' : 'Libre') : (
          <>
            <span style={{ fontWeight: 700, whiteSpace: 'pre-line', fontSize: 16, lineHeight: 1.3 }}>{tramos.map(t => `${t.entrada}–${t.salida}`).join('\n')}</span>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 600, marginTop: 4, opacity: 0.75 }}>
              {fmtHM(real)}{hayDif && <span style={{ color: '#B01D23', opacity: 1, fontWeight: 700 }}> /{fmtHM(bruto)}</span>}
            </span>
          </>
        )}
      </div>
    )
  }

  const inputStyle: CSSProperties = {
    width: 56, textAlign: 'center', fontFamily: 'Oswald, sans-serif', fontSize: 16, fontWeight: 700,
    color: texto, background: 'rgba(255,255,255,0.6)', border: `1px solid ${vacio ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.2)'}`,
    borderRadius: 3, padding: '4px 0', outline: 'none',
  }
  const sep = <span style={{ fontSize: 13, opacity: 0.6 }}>–</span>

  return (
    <div style={{ background: fondo, borderRadius: 5, padding: '6px 3px', textAlign: 'center', minHeight: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, border: borde }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input className="hor-input" style={inputStyle} value={t1e} placeholder="--:--"
          onChange={e => setT1e(e.target.value)}
          onBlur={() => { const v = normalizarHora(t1e); setT1e(v); commitDesdeCampos(v, t1s, t2e, t2s) }} />
        {sep}
        <input className="hor-input" style={inputStyle} value={t1s} placeholder="--:--"
          onChange={e => setT1s(e.target.value)}
          onBlur={() => { const v = normalizarHora(t1s); setT1s(v); commitDesdeCampos(t1e, v, t2e, t2s) }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input className="hor-input" style={inputStyle} value={t2e} placeholder="--:--"
          onChange={e => setT2e(e.target.value)}
          onBlur={() => { const v = normalizarHora(t2e); setT2e(v); commitDesdeCampos(t1e, t1s, v, t2s) }} />
        {sep}
        <input className="hor-input" style={inputStyle} value={t2s} placeholder="--:--"
          onChange={e => setT2s(e.target.value)}
          onBlur={() => { const v = normalizarHora(t2s); setT2s(v); commitDesdeCampos(t1e, t1s, t2e, v) }} />
      </div>
      <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 700, color: texto, opacity: vacio ? 0.4 : 0.85, marginTop: 1 }}>
        {vacio ? '—' : fmtHM(real)}
        {hayDif && <span style={{ color: '#B01D23', opacity: 1 }}> /{fmtHM(bruto)}</span>}
      </span>
    </div>
  )
}
