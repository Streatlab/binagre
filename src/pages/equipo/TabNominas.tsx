/**
 * TabNominas — consulta de nóminas del equipo, estética Neobrutal Alegre kit claro.
 * Vista SOLO LECTURA: la subida de documentos (nómina, resumen de gestoría, RLC/RNT)
 * vive únicamente en Papeleo → Equipo. Esta pestaña muestra lo ya extraído y su
 * cruce con banco (motor en api/_lib/matchNomina.ts, gestionado ahora desde Costes).
 * La fila de Emilio conserva el cálculo automático (v_nomina_emilio /
 * v_nomina_emilio_detalle) sin tocar su lógica.
 */
import { useEffect, useState, useMemo, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useNominasCompletas } from '@/lib/equipo/useNominasCompletas'
import type { NominaCompleta, PagoAsociado } from '@/lib/equipo/useNominasCompletas'
import { useFichaEmpleado } from '@/lib/equipo/useFichaEmpleado'
import ModalRevisionEquipo from '@/components/equipo/ModalRevisionEquipo'
import { fmtEur, fmtDate } from '@/lib/format'
import {
  OSW, LEX, INK, CREMA, CLARO, SHADOW, BORDER_CARD, GRANATE, AMA, VERDE, ROJO, NAR, AZUL, GRIS, eyebrow, d, BLANCO } from '@/styles/neobrutal'

interface Empleado { id: string; nombre: string }

interface NominaCalc {
  anio: number
  mes: number
  ingresos_plataforma: number
  gastos_negocio: number
  base: number
  adeudado: number
}
interface NominaDetalle {
  id: string
  fecha: string
  anio: number
  mes: number
  concepto: string | null
  proveedor: string | null
  importe: number
  tipo: string
  clase: string
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const card: React.CSSProperties = { background: BLANCO, border: BORDER_CARD, boxShadow: SHADOW }

function clasifColor(c: NominaCompleta['clasificacion']): string {
  switch (c) {
    case 'cuadra': return VERDE
    case 'pagado_de_mas': return AZUL
    case 'pagado_de_menos': return ROJO
    case 'sin_pago': return GRIS
  }
}
function clasifLabel(c: NominaCompleta['clasificacion']): string {
  switch (c) {
    case 'cuadra': return 'Cuadra'
    case 'pagado_de_mas': return 'Pagado de más'
    case 'pagado_de_menos': return 'Pagado de menos'
    case 'sin_pago': return 'Sin pago'
  }
}

export default function TabNominas() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [calc, setCalc] = useState<NominaCalc[]>([])
  const [detalle, setDetalle] = useState<NominaDetalle[]>([])
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null)
  const [hoverMes, setHoverMes] = useState<number | null>(null)
  const [selectedEmp, setSelectedEmp] = useState<string>('all')
  const [selectedAnio, setSelectedAnio] = useState<number>(new Date().getFullYear())
  const [loadingBase, setLoadingBase] = useState(true)
  const [pendientesRevision, setPendientesRevision] = useState(0)
  const [verRevision, setVerRevision] = useState(false)
  const [verNomina, setVerNomina] = useState<NominaCompleta | null>(null)

  const { loading: loadingNominas, error: errorNominas, nominas, reload } = useNominasCompletas(selectedAnio)

  async function cargarPendientesRevision() {
    const { count } = await supabase.from('equipo_docs_revision').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente')
    setPendientesRevision(count ?? 0)
  }
  useEffect(() => { cargarPendientesRevision() }, [])

  async function fetchBase() {
    const [e, c, dt] = await Promise.all([
      // Solo tipo_relacion='plantilla' tiene nómina (LEY-PRUDENCIA-01, regla 2):
      // los EXTRA (Fernando) se pagan por Bizum y el SOCIO (Rubén) nunca tiene nómina.
      supabase.from('empleados').select('id, nombre').eq('estado', 'activo').eq('tipo_relacion', 'plantilla').order('nombre'),
      supabase.from('v_nomina_emilio').select('*'),
      supabase.from('v_nomina_emilio_detalle').select('*'),
    ])
    setEmpleados((e.data ?? []) as Empleado[])
    setCalc((c.data ?? []) as unknown as NominaCalc[])
    setDetalle((dt.data ?? []) as unknown as NominaDetalle[])
    setLoadingBase(false)
  }

  useEffect(() => { fetchBase() }, [])

  const loading = loadingBase || loadingNominas
  const empsFiltrados = selectedEmp === 'all' ? empleados : empleados.filter(e => e.id === selectedEmp)
  const emilio = empleados.find(e => /emilio/i.test(e.nombre))
  const emilioId = emilio?.id ?? null

  function getNomina(empId: string, mes: number): NominaCompleta | undefined {
    return nominas.find(n => n.empleado_id === empId && n.mes === mes)
  }

  function toggleEmp(empId: string) {
    setHoverMes(null)
    setExpandedEmp(expandedEmp === empId ? null : empId)
  }

  const anios = [selectedAnio - 1, selectedAnio, selectedAnio + 1]

  const calcAnio = calc.filter(r => r.anio === selectedAnio).sort((a, b) => a.mes - b.mes)
  function detalleMes(mes: number, clase: string) {
    return detalle
      .filter(dd => dd.anio === selectedAnio && dd.mes === mes && dd.clase === clase)
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
  }
  const labelClase: Record<string, string> = {
    ingreso_plataforma: 'Ingresos plataforma',
    gasto_negocio: 'Gastos del negocio',
  }

  // ---- KPIs hero ----
  const kpi = useMemo(() => {
    const total = nominas.length
    const revisar = nominas.filter(n => n.estado === 'revisar').length
    const descuadre = nominas.filter(n => n.clasificacion !== 'cuadra')
    const sumaDiferencias = descuadre.reduce((s, n) => s + Math.abs(Number(n.diferencia) || 0), 0)
    return { total, revisar, descuadreCount: descuadre.length, sumaDiferencias }
  }, [nominas])

  const th: React.CSSProperties = {
    padding: '10px 8px', fontFamily: OSW, fontSize: 10, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '1.5px', color: CREMA, textAlign: 'center',
  }
  const td: React.CSSProperties = { padding: '8px 6px', fontFamily: LEX, fontSize: 12, color: INK, textAlign: 'center', verticalAlign: 'top' }

  if (errorNominas) return <div style={{ padding: 30, color: ROJO, fontFamily: LEX }}>Error cargando nóminas: {errorNominas}</div>

  return (
    <div style={{ fontFamily: LEX, color: INK }}>

      {/* Hero KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ ...card, padding: '16px 20px' }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: GRIS, marginBottom: 6 }}>Nóminas del año {selectedAnio}</div>
          <div style={{ ...d('34px'), lineHeight: 1 }}>{kpi.total}</div>
        </div>
        <div style={{ ...card, padding: '16px 20px', background: kpi.revisar > 0 ? AMA : BLANCO }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: INK, marginBottom: 6 }}>Pendientes de revisar</div>
          <div style={{ ...d('34px', INK), lineHeight: 1 }}>{kpi.revisar}</div>
        </div>
        <div style={{ ...card, padding: '16px 20px', background: kpi.descuadreCount > 0 ? ROJO : BLANCO }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: kpi.descuadreCount > 0 ? BLANCO : GRIS, marginBottom: 6 }}>Diferencias sin cuadrar</div>
          <div style={{ ...d('34px', kpi.descuadreCount > 0 ? BLANCO : INK), lineHeight: 1 }}>{kpi.descuadreCount}</div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: kpi.descuadreCount > 0 ? BLANCO : GRIS, marginTop: 4 }}>{fmtEur(kpi.sumaDiferencias, { decimals: 2 })}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} style={selectNeo}>
          <option value="all">Todos los empleados</option>
          {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <select value={selectedAnio} onChange={e => setSelectedAnio(parseInt(e.target.value))} style={selectNeo}>
          {anios.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <Link
          to="/finanzas/papeleo?tab=equipo"
          style={{ fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase', color: GRANATE, textDecoration: 'none' }}
        >
          Subir documentos → Papeleo · Equipo
        </Link>

        {pendientesRevision > 0 && (
          <button
            onClick={() => setVerRevision(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              border: `3px solid ${INK}`, boxShadow: SHADOW, background: AMA, color: INK,
              fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase',
              padding: '8px 14px', cursor: 'pointer',
            }}
          >
            {pendientesRevision} documento{pendientesRevision !== 1 ? 's' : ''} por revisar
          </button>
        )}
      </div>

      {verRevision && (
        <ModalRevisionEquipo
          onClose={() => setVerRevision(false)}
          onResuelto={() => { cargarPendientesRevision(); reload() }}
        />
      )}

      {verNomina && (
        <ModalVerNomina n={verNomina} onClose={() => setVerNomina(null)} />
      )}

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: GRIS, fontFamily: LEX }}>Cargando…</div>
      ) : (
        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: INK }}>
                <th style={{ ...th, textAlign: 'left', minWidth: 190 }}>Empleado</th>
                {MESES.map((m, i) => <th key={i} style={th}>{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {empsFiltrados.length === 0 ? (
                <tr><td colSpan={13} style={{ padding: 40, textAlign: 'center', color: GRIS, fontFamily: LEX }}>Sin empleados activos.</td></tr>
              ) : empsFiltrados.map(emp => {
                const open = expandedEmp === emp.id
                const tieneCalc = emp.id === emilioId
                const nominasEmp = nominas.filter(n => n.empleado_id === emp.id).sort((a, b) => a.mes - b.mes)
                return (
                  <Fragment key={emp.id}>
                    <tr style={{ borderBottom: `2px solid ${INK}`, background: open ? CLARO : BLANCO }}>
                      <td
                        onClick={() => toggleEmp(emp.id)}
                        style={{ ...td, textAlign: 'left', fontFamily: OSW, fontWeight: 600, fontSize: 13, padding: '10px 12px', cursor: 'pointer', userSelect: 'none' }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: GRIS }}>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                          {emp.nombre}
                          {tieneCalc && (
                            <span style={{ ...eyebrow(GRANATE, BLANCO), fontSize: 9, padding: '1px 6px' }}>Cálculo auto</span>
                          )}
                        </span>
                      </td>
                      {MESES.map((_m, i) => {
                        const mes = i + 1
                        const nom = getNomina(emp.id, mes)
                        return (
                          <td key={mes} style={td}>
                            {nom ? (
                              <div
                                onClick={() => setVerNomina(nom)}
                                style={{
                                  borderLeft: `4px solid ${clasifColor(nom.clasificacion)}`,
                                  paddingLeft: 6, textAlign: 'left', cursor: 'pointer',
                                  display: 'flex', flexDirection: 'column', gap: 3,
                                }}
                                title={clasifLabel(nom.clasificacion)}
                              >
                                <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 12, color: INK }}>{fmtEur(nom.importe_neto, { decimals: 0 })}</span>
                                <span style={{
                                  fontFamily: OSW, fontSize: 9, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase',
                                  border: `2px solid ${INK}`, padding: '1px 5px', width: 'fit-content',
                                  background: nom.estado === 'ok' ? VERDE : AMA, color: nom.estado === 'ok' ? BLANCO : INK,
                                }}>
                                  {nom.estado === 'ok' ? 'OK' : 'Revisar'}
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: GRIS }} title="Sube el PDF por Papeleo → Equipo">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={13} style={{ padding: 0, background: CLARO, borderBottom: `2px solid ${INK}` }}>
                          {tieneCalc ? (
                            <PanelEmilio calcAnio={calcAnio} selectedAnio={selectedAnio} hoverMes={hoverMes} setHoverMes={setHoverMes} detalleMes={detalleMes} labelClase={labelClase} />
                          ) : (
                            <PanelEmpleado emp={emp} nominasEmp={nominasEmp} anio={selectedAnio} />
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ marginTop: 10, fontSize: 11, color: GRIS, fontFamily: LEX }}>
        Vista de solo consulta. Sube documentos desde Papeleo · Equipo.
      </p>
    </div>
  )
}

// ---- Línea de desglose dentro de card mensual (Emilio) ----
function Linea({ label, val, color, signo }: { label: string; val: number; color: string; signo?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '2px 0' }}>
      <span style={{ fontFamily: LEX, fontSize: 11, color: GRIS }}>{label}</span>
      <span style={{ fontFamily: LEX, fontSize: 12, color, fontVariantNumeric: 'tabular-nums' }}>{signo}{fmtEur(val, { decimals: 0 })}</span>
    </div>
  )
}

// ---- Bloque cálculo Emilio (re-estilizado neobrutal, MISMA lógica) ----
function PanelEmilio({ calcAnio, selectedAnio, hoverMes, setHoverMes, detalleMes, labelClase }: {
  calcAnio: NominaCalc[]; selectedAnio: number; hoverMes: number | null; setHoverMes: (fn: (m: number | null) => number | null) => void;
  detalleMes: (mes: number, clase: string) => NominaDetalle[]; labelClase: Record<string, string>;
}) {
  if (calcAnio.length === 0) {
    return (
      <div style={{ padding: '20px 16px', color: GRIS, fontFamily: LEX, fontSize: 12 }}>
        Sin movimientos de {selectedAnio}. En cuanto se importe el extracto del mes, aparece aquí.
      </div>
    )
  }
  return (
    <div style={{ padding: '18px 16px' }}>
      <span style={eyebrow(NAR, BLANCO)}>SUELDO · CÁLCULO AUTOMÁTICO {selectedAnio}</span>
      <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS, margin: '10px 0 16px', maxWidth: 640 }}>
        Base 1.350 € − ingresos Uber / Glovo / Just Eat + gastos del negocio (Mercadona, proveedores…) = adeudado. Los traspasos a sueldo y Hacienda no cuentan. Pasa el ratón por un mes para ver sus ingresos y gastos.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(178px,1fr))', gap: 12, alignItems: 'start' }}>
        {calcAnio.map(r => {
          const hov = hoverMes === r.mes
          return (
            <div
              key={r.mes}
              onMouseEnter={() => setHoverMes(() => r.mes)}
              onMouseLeave={() => setHoverMes(m => (m === r.mes ? null : m))}
              style={{ ...card, padding: 12, border: `3px solid ${INK}`, boxShadow: hov ? SHADOW : 'none' }}
            >
              <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>{MESES[r.mes - 1]} {r.anio}</div>
              <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: '1.9rem', lineHeight: 1, color: GRANATE, margin: '8px 0 2px' }}>
                {fmtEur(r.adeudado, { decimals: 0 })}
              </div>
              <div style={{ fontFamily: OSW, fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', color: GRIS, marginBottom: 8 }}>
                Adeudado a Emilio
              </div>
              <div style={{ borderTop: `2px solid ${INK}`, marginBottom: 4 }} />
              <Linea label="Ingresos plataforma" val={r.ingresos_plataforma} color={VERDE} signo="− " />
              <Linea label="Gastos negocio" val={r.gastos_negocio} color={VERDE} signo="+ " />
              <Linea label="Base" val={r.base} color={INK} />

              {hov && (
                <>
                  <div style={{ borderTop: `2px solid ${INK}`, margin: '6px 0 4px' }} />
                  {(['ingreso_plataforma', 'gasto_negocio'] as const).map(clase => {
                    const items = detalleMes(r.mes, clase)
                    if (items.length === 0) return null
                    return (
                      <div key={clase} style={{ marginTop: 6 }}>
                        <div style={{ fontFamily: OSW, fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS, marginBottom: 3 }}>
                          {labelClase[clase]}
                        </div>
                        {items.map(it => (
                          <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontFamily: LEX, fontSize: 10.5, color: INK, padding: '1px 0' }}>
                            <span style={{ color: GRIS, whiteSpace: 'nowrap' }}>{fmtDate(it.fecha)}</span>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.proveedor || it.concepto}</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums', color: it.importe < 0 ? ROJO : VERDE }}>{fmtEur(it.importe, { decimals: 0 })}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- Ficha acumulada del empleado (6 mini-cards) ----
function FichaMini({ empleadoId, anio }: { empleadoId: string; anio: number }) {
  const { loading, error, ficha } = useFichaEmpleado(empleadoId, anio)
  if (loading) return <div style={{ padding: '10px 0', color: GRIS, fontFamily: LEX, fontSize: 12 }}>Cargando ficha…</div>
  if (error || !ficha) return null
  const items: [string, number, string][] = [
    ['Bruto acumulado', ficha.brutoAcumulado, INK],
    ['Neto pagado real', ficha.netoPagadoReal, VERDE],
    ['IRPF acumulado (Hacienda)', ficha.irpfAcumulado, NAR],
    ['SS empresa acumulada', ficha.ssEmpresaAcumulada, AZUL],
    ['Coste real total', ficha.costeRealTotal, GRANATE],
    ['Diferencias acumuladas', ficha.diferenciasAcumuladas, ficha.diferenciasAcumuladas < 0 ? ROJO : ficha.diferenciasAcumuladas > 0 ? AZUL : GRIS],
  ]
  return (
    <div style={{ marginBottom: 18 }}>
      <span style={eyebrow(AMA, INK)}>FICHA DEL EMPLEADO · {anio}</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 10 }}>
        {items.map(([label, val, color]) => (
          <div key={label} style={{ ...card, padding: '10px 12px' }}>
            <div style={{ fontFamily: OSW, fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS, marginBottom: 4 }}>{label}</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 17, color }}>{fmtEur(val, { decimals: 2, signed: label === 'Diferencias acumuladas' })}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Panel de un empleado (no-Emilio): lista de nóminas del año, cada una expandible (solo lectura) ----
function PanelEmpleado({ emp, nominasEmp, anio }: {
  emp: Empleado; nominasEmp: NominaCompleta[]; anio: number;
}) {
  const [expandedMes, setExpandedMes] = useState<number | null>(null)

  return (
    <div style={{ padding: '18px 16px' }}>
      <FichaMini empleadoId={emp.id} anio={anio} />
      {nominasEmp.length === 0 ? (
        <div style={{ color: GRIS, fontFamily: LEX, fontSize: 12 }}>
          {emp.nombre} no tiene nóminas cargadas en {anio}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {nominasEmp.map(n => (
            <NominaCard key={n.id} n={n} expanded={expandedMes === n.mes} onToggle={() => setExpandedMes(m => m === n.mes ? null : n.mes)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Lista de pagos del banco asociados a una nómina, solo lectura ----
function ListaPagosSoloLectura({ pagos }: { pagos: PagoAsociado[] }) {
  if (pagos.length === 0) {
    return <div style={{ color: GRIS, fontFamily: LEX, fontSize: 12 }}>Sin pagos asociados todavía.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {pagos.map(p => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, border: `2px solid ${INK}`, padding: '6px 10px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: LEX, fontSize: 11, color: GRIS, whiteSpace: 'nowrap' }}>{fmtDate(p.fecha)}</span>
          <span style={{ fontFamily: LEX, fontSize: 12, flex: 1, minWidth: 100 }}>{p.concepto}</span>
          <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 12 }}>{fmtEur(p.importe_asociado, { decimals: 2 })}</span>
          <span style={{
            fontFamily: OSW, fontSize: 9, fontWeight: 600, textTransform: 'uppercase', border: `2px solid ${INK}`, padding: '1px 6px',
            background: p.confirmado ? VERDE : AMA, color: p.confirmado ? BLANCO : INK,
          }}>{p.confirmado ? 'Confirmado' : 'Sin confirmar'}</span>
        </div>
      ))}
    </div>
  )
}

// ---- Desglose de una nómina, solo lectura (mismo valor visual en card y modal) ----
function DesgloseSoloLectura({ n }: { n: NominaCompleta }) {
  const campos: [number | null, string][] = [
    [n.importe_bruto, 'Bruto'], [n.importe_neto, 'Neto'], [n.irpf_retenido, 'IRPF'],
    [n.ss_trabajador, 'SS trabajador'], [n.ss_empresa, 'SS empresa'], [n.coste_empresa, 'Coste empresa'],
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
      {campos.map(([val, label]) => (
        <div key={label}>
          <label style={{ display: 'block', fontFamily: OSW, fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS, marginBottom: 3 }}>{label}</label>
          <div style={{ padding: '8px 10px', border: `2px solid ${INK}`, fontFamily: LEX, fontSize: 13, background: CLARO }}>
            {fmtEur(val, { decimals: 2 })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---- Card de una nómina concreta, solo lectura ----
function NominaCard({ n, expanded, onToggle }: {
  n: NominaCompleta; expanded: boolean; onToggle: () => void;
}) {
  return (
    <div style={{ ...card, padding: 0, borderLeft: `6px solid ${clasifColor(n.clasificacion)}` }}>
      <div onClick={onToggle} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexWrap: 'wrap' }}>
        <span style={{ color: GRIS }}>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 13, textTransform: 'uppercase', minWidth: 90 }}>{MESES_LARGO[n.mes - 1]}</span>
        <span style={{
          fontFamily: OSW, fontSize: 9, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase',
          border: `2px solid ${INK}`, padding: '2px 7px',
          background: n.estado === 'ok' ? VERDE : AMA, color: n.estado === 'ok' ? BLANCO : INK,
        }}>{n.estado === 'ok' ? 'OK' : 'Revisar'}</span>
        <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>Bruto {fmtEur(n.importe_bruto, { decimals: 2 })}</span>
        <span style={{ fontFamily: LEX, fontSize: 12, color: INK, fontWeight: 600 }}>Neto {fmtEur(n.importe_neto, { decimals: 2 })}</span>
        <span style={{ marginLeft: 'auto', fontFamily: OSW, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: clasifColor(n.clasificacion) }}>
          {clasifLabel(n.clasificacion)}
        </span>
        <span style={{ fontFamily: LEX, fontSize: 12, color: clasifColor(n.clasificacion) }}>{fmtEur(n.diferencia, { decimals: 2, signed: true })}</span>
        {n.pdf_url && (
          <a href={n.pdf_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', gap: 3, color: AZUL, fontSize: 11, textDecoration: 'none' }}>
            <Download size={11} /> PDF
          </a>
        )}
      </div>

      {expanded && (
        <div style={{ padding: '0 14px 16px', borderTop: `2px solid ${INK}` }}>
          <div style={{ marginTop: 12 }}>
            <span style={eyebrow(CLARO, INK)}>DESGLOSE</span>
            <div style={{ marginTop: 8 }}>
              <DesgloseSoloLectura n={n} />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <span style={eyebrow(AZUL, BLANCO)}>CRUCE CON BANCO</span>
            <div style={{ marginTop: 8 }}>
              <ListaPagosSoloLectura pagos={n.pagos} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Modal VER: nómina de una celda, solo lectura ----
function ModalVerNomina({ n, onClose }: { n: NominaCompleta; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 130, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: CREMA, border: BORDER_CARD, boxShadow: '8px 8px 0 rgba(0,0,0,0.25)', padding: 24, width: '100%', maxWidth: 720, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontFamily: OSW, fontSize: 15, letterSpacing: '2px', textTransform: 'uppercase', color: GRANATE }}>
              {n.empleado_nombre} · {MESES_LARGO[n.mes - 1]} {n.anio}
            </div>
            <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: clasifColor(n.clasificacion), marginTop: 4 }}>
              {clasifLabel(n.clasificacion)} · diferencia {fmtEur(n.diferencia, { decimals: 2, signed: true })}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: GRIS, fontFamily: LEX, fontSize: 13, cursor: 'pointer' }}>Cerrar</button>
        </div>

        {n.pdf_url ? (
          <div style={{ marginBottom: 16 }}>
            <iframe src={n.pdf_url} title="Nómina PDF" style={{ width: '100%', height: 380, border: `2px solid ${INK}` }} />
            <a href={n.pdf_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, color: AZUL, fontFamily: LEX, fontSize: 12, textDecoration: 'none' }}>
              <Download size={12} /> Abrir PDF en pestaña nueva
            </a>
          </div>
        ) : (
          <div style={{ color: GRIS, fontFamily: LEX, fontSize: 12, marginBottom: 16 }}>Sin PDF asociado.</div>
        )}

        <span style={eyebrow(CLARO, INK)}>DESGLOSE</span>
        <div style={{ marginTop: 8, marginBottom: 16 }}>
          <DesgloseSoloLectura n={n} />
        </div>

        <span style={eyebrow(AZUL, BLANCO)}>PAGOS DEL BANCO</span>
        <div style={{ marginTop: 8 }}>
          <ListaPagosSoloLectura pagos={n.pagos} />
        </div>
      </div>
    </div>
  )
}

const selectNeo: React.CSSProperties = { background: BLANCO, border: `3px solid ${INK}`, color: INK, padding: '7px 12px', fontFamily: OSW, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', outline: 'none' }
