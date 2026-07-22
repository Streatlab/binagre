/**
 * TabNominas — gestión de nóminas del equipo, estética Neobrutal Food-Pop.
 * Subida de PDF + extracción IA vía /api/nominas/subir, cruce automático
 * con banco (sugerir-matches / asociar-pago / desasociar-pago / confirmar-pago)
 * y ficha acumulada por empleado. La fila de Emilio conserva el cálculo
 * automático (v_nomina_emilio / v_nomina_emilio_detalle) sin tocar su lógica.
 */
import { useEffect, useState, useMemo, Fragment } from 'react'
import { Upload, Download, ChevronDown, ChevronRight, Check, X, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useNominasCompletas } from '@/lib/equipo/useNominasCompletas'
import type { NominaCompleta } from '@/lib/equipo/useNominasCompletas'
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

interface FilaResumen {
  trabajador: string
  bruto: number | null
  neto: number | null
  irpf: number | null
  ss_total: number | null
  coste_empresa: number | null
}

type CandidatoMatch = {
  conciliacion_id: string
  fecha: string
  concepto: string
  proveedor: string
  importe: number
  confianza: number
  motivo: string
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const card: React.CSSProperties = { background: BLANCO, border: BORDER_CARD, boxShadow: SHADOW }

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const idx = result.indexOf(',')
      resolve(idx >= 0 ? result.slice(idx + 1) : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

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
function confColor(score: number): string {
  if (score >= 70) return VERDE
  if (score >= 40) return AMA
  return GRIS
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
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadingResumen, setUploadingResumen] = useState(false)
  const [resumenResultado, setResumenResultado] = useState<{
    mes: number; anio: number
    insertadas: FilaResumen[]; ya_existia: FilaResumen[]; revisar_identidad: FilaResumen[]
  } | null>(null)
  const [pendientesRevision, setPendientesRevision] = useState(0)
  const [verRevision, setVerRevision] = useState(false)

  const { loading: loadingNominas, error: errorNominas, nominas, reload } = useNominasCompletas(selectedAnio)

  async function cargarPendientesRevision() {
    const { count } = await supabase.from('equipo_docs_revision').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente')
    setPendientesRevision(count ?? 0)
  }
  useEffect(() => { cargarPendientesRevision() }, [])

  async function fetchBase() {
    const [e, c, dt] = await Promise.all([
      // Los EXTRA (tipo_relacion='extra') no van en nómina: fuera del selector y
      // de la parrilla de cobertura (se pagan por Bizum/transferencia).
      supabase.from('empleados').select('id, nombre').eq('estado', 'activo').neq('tipo_relacion', 'extra').order('nombre'),
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

  async function handleUploadPdf(empId: string, mes: number, file: File) {
    const key = `${empId}-${mes}`
    setUploading(key)
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/nominas/subir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, nombre_archivo: file.name, empleado_id: empId, mes, anio: selectedAnio }),
      })
      const data = await res.json()
      if (!data.ok) alert('No se pudo procesar la nómina: ' + (data.motivo || 'motivo desconocido'))
      await reload()
    } catch (e) {
      alert('Error al subir: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setUploading(null)
    }
  }

  async function handleUploadResumen(file: File) {
    setUploadingResumen(true)
    setResumenResultado(null)
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/nominas/resumen/subir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, nombre_archivo: file.name }),
      })
      const data = await res.json()
      if (!data.ok) {
        alert('No se pudo procesar el resumen: ' + (data.error || data.motivo_extraccion || 'motivo desconocido'))
        return
      }
      setResumenResultado({
        mes: data.mes, anio: data.anio,
        insertadas: data.insertadas ?? [], ya_existia: data.ya_existia ?? [], revisar_identidad: data.revisar_identidad ?? [],
      })
      await reload()
      await cargarPendientesRevision()
    } catch (e) {
      alert('Error al subir el resumen: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setUploadingResumen(false)
    }
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

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} style={selectNeo}>
          <option value="all">Todos los empleados</option>
          {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <select value={selectedAnio} onChange={e => setSelectedAnio(parseInt(e.target.value))} style={selectNeo}>
          {anios.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <input
          type="file" accept="application/pdf" id="upl-resumen" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadResumen(f); e.target.value = '' }}
        />
        <label
          htmlFor="upl-resumen"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            border: `3px solid ${INK}`, boxShadow: SHADOW, background: GRANATE, color: BLANCO,
            fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase',
            padding: '8px 14px', cursor: uploadingResumen ? 'wait' : 'pointer',
          }}
        >
          <Upload size={13} /> {uploadingResumen ? 'Procesando…' : 'Subir resumen de nóminas'}
        </label>
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

      {resumenResultado && (
        <div style={{ ...card, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 13, textTransform: 'uppercase', marginBottom: 8 }}>
            Resumen {MESES_LARGO[resumenResultado.mes - 1]} {resumenResultado.anio}
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontFamily: LEX, fontSize: 12 }}>
            <span>Guardadas: <strong style={{ color: VERDE }}>{resumenResultado.insertadas.length}</strong></span>
            <span>Ya existían: <strong style={{ color: GRIS }}>{resumenResultado.ya_existia.length}</strong></span>
            <span>Revisar identidad: <strong style={{ color: resumenResultado.revisar_identidad.length > 0 ? ROJO : GRIS }}>{resumenResultado.revisar_identidad.length}</strong></span>
          </div>
          {resumenResultado.revisar_identidad.length > 0 && (
            <div style={{ marginTop: 10, borderTop: `2px solid ${INK}`, paddingTop: 10 }}>
              <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: ROJO, marginBottom: 6 }}>
                Trabajadores sin reconocer — quedan en "documentos por revisar": asígnalos ahí en un clic
              </div>
              {resumenResultado.revisar_identidad.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, fontFamily: LEX, fontSize: 12, padding: '3px 0', flexWrap: 'wrap' }}>
                  <strong>{f.trabajador}</strong>
                  <span>bruto {fmtEur(f.bruto, { decimals: 2 })}</span>
                  <span>neto {fmtEur(f.neto, { decimals: 2 })}</span>
                  <span>IRPF {fmtEur(f.irpf, { decimals: 2 })}</span>
                  <span>SS {fmtEur(f.ss_total, { decimals: 2 })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
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
                        const key = `${emp.id}-${mes}`
                        return (
                          <td key={mes} style={td}>
                            {nom ? (
                              <div
                                onClick={() => setExpandedEmp(emp.id)}
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
                                {nom.pdf_url && (
                                  <a href={nom.pdf_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                                    style={{ display: 'flex', alignItems: 'center', gap: 2, color: AZUL, fontSize: 10, textDecoration: 'none' }}>
                                    <Download size={10} /> PDF
                                  </a>
                                )}
                              </div>
                            ) : (
                              <>
                                <input
                                  type="file" accept="application/pdf" id={`upl-${key}`} style={{ display: 'none' }}
                                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadPdf(emp.id, mes, f); e.target.value = '' }}
                                />
                                <label
                                  htmlFor={`upl-${key}`}
                                  title={`Subir nómina ${MESES[i]} ${selectedAnio}`}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    border: `2px dashed ${INK}`, padding: '4px 7px', cursor: uploading === key ? 'wait' : 'pointer', color: GRIS,
                                  }}
                                >
                                  {uploading === key ? <span style={{ fontSize: 10 }}>…</span> : <Upload size={11} />}
                                </label>
                              </>
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
                            <PanelEmpleado emp={emp} nominasEmp={nominasEmp} anio={selectedAnio} onReload={reload} />
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
        La subida de PDF extrae los importes automáticamente. Revisa las nóminas marcadas "Revisar" antes de darlas por buenas.
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

// ---- Panel de un empleado (no-Emilio): lista de nóminas del año, cada una expandible ----
function PanelEmpleado({ emp, nominasEmp, anio, onReload }: {
  emp: Empleado; nominasEmp: NominaCompleta[]; anio: number; onReload: () => Promise<void> | void;
}) {
  const [expandedMes, setExpandedMes] = useState<number | null>(null)

  return (
    <div style={{ padding: '18px 16px' }}>
      <FichaMini empleadoId={emp.id} anio={anio} />
      {nominasEmp.length === 0 ? (
        <div style={{ color: GRIS, fontFamily: LEX, fontSize: 12 }}>
          {emp.nombre} no tiene nóminas cargadas en {anio}. Sube el PDF de cada mes en las celdas de arriba.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {nominasEmp.map(n => (
            <NominaCard key={n.id} n={n} expanded={expandedMes === n.mes} onToggle={() => setExpandedMes(m => m === n.mes ? null : n.mes)} onReload={onReload} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Card de una nómina concreta: desglose editable + cruce con banco ----
function NominaCard({ n, expanded, onToggle, onReload }: {
  n: NominaCompleta; expanded: boolean; onToggle: () => void; onReload: () => Promise<void> | void;
}) {
  const editable = n.estado === 'revisar'
  const [vals, setVals] = useState({
    importe_bruto: n.importe_bruto ?? 0,
    importe_neto: n.importe_neto ?? 0,
    irpf_retenido: n.irpf_retenido ?? 0,
    ss_trabajador: n.ss_trabajador ?? 0,
    ss_empresa: n.ss_empresa ?? 0,
    coste_empresa: n.coste_empresa ?? 0,
  })
  const [saving, setSaving] = useState<string | null>(null)
  const [candidatos, setCandidatos] = useState<{ individuales: CandidatoMatch[]; combinaciones: CandidatoMatch[][] } | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  async function commitField(field: keyof typeof vals) {
    if (!editable) return
    const original = (n as unknown as Record<string, number | null>)[field]
    if (Number(original ?? 0) === Number(vals[field])) return
    setSaving(field)
    try {
      const { error } = await supabase.from('nominas').update({ [field]: vals[field] }).eq('id', n.id)
      if (error) throw error
      await onReload()
    } catch (e) {
      alert('Error al guardar: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(null)
    }
  }

  async function buscarMatches() {
    setBuscando(true)
    setCandidatos(null)
    try {
      const res = await fetch(`/api/nominas/${n.id}/sugerir-matches`, { method: 'POST' })
      const data = await res.json()
      setCandidatos({ individuales: data.individuales ?? [], combinaciones: data.combinaciones ?? [] })
    } catch (e) {
      alert('Error al buscar movimientos: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBuscando(false)
    }
  }

  async function asociar(c: CandidatoMatch) {
    setBusy(c.conciliacion_id)
    try {
      await fetch(`/api/nominas/${n.id}/asociar-pago`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conciliacion_id: c.conciliacion_id, importe_asociado: c.importe, confianza_match: c.confianza }),
      })
      setCandidatos(null)
      await onReload()
    } finally {
      setBusy(null)
    }
  }

  async function asociarCombo(combo: CandidatoMatch[]) {
    setBusy('combo')
    try {
      for (const c of combo) {
        await fetch(`/api/nominas/${n.id}/asociar-pago`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conciliacion_id: c.conciliacion_id, importe_asociado: c.importe, confianza_match: c.confianza }),
        })
      }
      setCandidatos(null)
      await onReload()
    } finally {
      setBusy(null)
    }
  }

  async function desasociar(conciliacionId: string) {
    setBusy(conciliacionId)
    try {
      await fetch(`/api/nominas/${n.id}/desasociar-pago`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conciliacion_id: conciliacionId }),
      })
      await onReload()
    } finally {
      setBusy(null)
    }
  }

  async function confirmar(conciliacionId: string) {
    setBusy(conciliacionId)
    try {
      await fetch(`/api/nominas/${n.id}/confirmar-pago`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conciliacion_id: conciliacionId }),
      })
      await onReload()
    } finally {
      setBusy(null)
    }
  }

  const campos: [keyof typeof vals, string][] = [
    ['importe_bruto', 'Bruto'], ['importe_neto', 'Neto'], ['irpf_retenido', 'IRPF'],
    ['ss_trabajador', 'SS trabajador'], ['ss_empresa', 'SS empresa'], ['coste_empresa', 'Coste empresa'],
  ]

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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginTop: 8 }}>
              {campos.map(([field, label]) => (
                <div key={field}>
                  <label style={{ display: 'block', fontFamily: OSW, fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS, marginBottom: 3 }}>{label}</label>
                  {editable ? (
                    <input
                      type="number" step="0.01" value={vals[field]}
                      onChange={e => setVals(v => ({ ...v, [field]: parseFloat(e.target.value) || 0 }))}
                      onBlur={() => commitField(field)}
                      disabled={saving === field}
                      style={{ ...inputNeo, borderColor: AMA }}
                    />
                  ) : (
                    <div style={{ padding: '8px 10px', border: `2px solid ${INK}`, fontFamily: LEX, fontSize: 13, background: CLARO }}>
                      {fmtEur(vals[field], { decimals: 2 })}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {editable && <div style={{ fontSize: 11, color: GRIS, marginTop: 4, fontFamily: LEX }}>Nómina marcada para revisar: los campos son editables. Se guardan al salir del campo.</div>}
          </div>

          <div style={{ marginTop: 16 }}>
            <span style={eyebrow(AZUL, BLANCO)}>CRUCE CON BANCO</span>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {n.pagos.length === 0 ? (
                <div style={{ color: GRIS, fontFamily: LEX, fontSize: 12 }}>Sin pagos asociados todavía.</div>
              ) : n.pagos.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, border: `2px solid ${INK}`, padding: '6px 10px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: LEX, fontSize: 11, color: GRIS, whiteSpace: 'nowrap' }}>{fmtDate(p.fecha)}</span>
                  <span style={{ fontFamily: LEX, fontSize: 12, flex: 1, minWidth: 100 }}>{p.concepto}</span>
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 12 }}>{fmtEur(p.importe_asociado, { decimals: 2 })}</span>
                  <span style={{
                    fontFamily: OSW, fontSize: 9, fontWeight: 600, textTransform: 'uppercase', border: `2px solid ${INK}`, padding: '1px 6px',
                    background: p.confirmado ? VERDE : AMA, color: p.confirmado ? BLANCO : INK,
                  }}>{p.confirmado ? 'Confirmado' : 'Sin confirmar'}</span>
                  {!p.confirmado && (
                    <button onClick={() => confirmar(p.conciliacion_id)} disabled={busy === p.conciliacion_id} style={{ ...btnMini, background: VERDE, color: BLANCO }}>
                      <Check size={11} />
                    </button>
                  )}
                  <button onClick={() => desasociar(p.conciliacion_id)} disabled={busy === p.conciliacion_id} style={{ ...btnMini, background: BLANCO, color: ROJO, borderColor: ROJO }}>
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>

            <button onClick={buscarMatches} disabled={buscando} style={{ ...btnMini, background: AMA, marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Search size={12} /> {buscando ? 'Buscando…' : 'Buscar movimiento'}
            </button>

            {candidatos && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {candidatos.individuales.length === 0 && candidatos.combinaciones.length === 0 && (
                  <div style={{ color: GRIS, fontFamily: LEX, fontSize: 12 }}>Sin candidatos encontrados en conciliación.</div>
                )}
                {candidatos.individuales.map(c => (
                  <div key={c.conciliacion_id} onClick={() => busy ? undefined : asociar(c)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, border: `2px solid ${INK}`, padding: '6px 10px', cursor: busy ? 'wait' : 'pointer', background: CLARO, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: LEX, fontSize: 11, color: GRIS, whiteSpace: 'nowrap' }}>{fmtDate(c.fecha)}</span>
                    <span style={{ fontFamily: LEX, fontSize: 12, flex: 1, minWidth: 100 }}>{c.concepto} · {c.proveedor}</span>
                    <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 12 }}>{fmtEur(c.importe, { decimals: 2 })}</span>
                    <span style={{
                      fontFamily: OSW, fontSize: 9, fontWeight: 600, border: `2px solid ${INK}`, padding: '1px 6px',
                      background: confColor(c.confianza), color: c.confianza >= 40 ? INK : BLANCO,
                    }}>{c.confianza}%</span>
                    <span style={{ fontFamily: LEX, fontSize: 10, color: GRIS, width: '100%' }}>{c.motivo}</span>
                  </div>
                ))}
                {candidatos.combinaciones.map((combo, i) => (
                  <div key={i} onClick={() => busy ? undefined : asociarCombo(combo)}
                    style={{ border: `2px dashed ${INK}`, padding: '6px 10px', cursor: busy ? 'wait' : 'pointer', background: CLARO }}>
                    <div style={{ fontFamily: OSW, fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS, marginBottom: 3 }}>Combinación de {combo.length} pagos</div>
                    {combo.map(c => (
                      <div key={c.conciliacion_id} style={{ display: 'flex', gap: 8, fontSize: 11, fontFamily: LEX, color: INK, padding: '1px 0' }}>
                        <span style={{ color: GRIS }}>{fmtDate(c.fecha)}</span>
                        <span style={{ flex: 1 }}>{c.concepto}</span>
                        <span>{fmtEur(c.importe, { decimals: 2 })}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const selectNeo: React.CSSProperties = { background: BLANCO, border: `3px solid ${INK}`, color: INK, padding: '7px 12px', fontFamily: OSW, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', outline: 'none' }
const inputNeo: React.CSSProperties = { padding: '8px 10px', background: BLANCO, border: `2px solid ${INK}`, color: INK, fontFamily: LEX, fontSize: 13, outline: 'none', width: '100%' }
const btnMini: React.CSSProperties = { fontFamily: OSW, fontWeight: 600, fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', border: `2px solid ${INK}`, padding: '5px 10px', cursor: 'pointer', color: INK, whiteSpace: 'nowrap' }
