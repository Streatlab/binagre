import { useEffect, useState, Fragment } from 'react'
import { Download, Upload, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle, sectionLabelStyle, dividerStyle } from '@/styles/tokens'
import { fmtEur, fmtDate } from '@/utils/format'

interface Empleado { id: string; nombre: string }
interface Nomina {
  id: string
  empleado_id: string
  mes: number
  anio: number
  importe_bruto: number | null
  importe_neto: number | null
  pdf_url: string | null
}
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

export default function TabNominas() {
  const { T, isDark: _isDark } = useTheme()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [nominas, setNominas] = useState<Nomina[]>([])
  const [calc, setCalc] = useState<NominaCalc[]>([])
  const [detalle, setDetalle] = useState<NominaDetalle[]>([])
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null)
  const [hoverMes, setHoverMes] = useState<number | null>(null)
  const [selectedEmp, setSelectedEmp] = useState<string>('all')
  const [selectedAnio, setSelectedAnio] = useState<number>(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)

  async function fetchAll() {
    const [e, n, c, d] = await Promise.all([
      supabase.from('empleados').select('id, nombre').eq('estado', 'activo').order('nombre'),
      supabase.from('nominas').select('*').order('anio', { ascending: false }).order('mes'),
      supabase.from('v_nomina_emilio').select('*'),
      supabase.from('v_nomina_emilio_detalle').select('*'),
    ])
    setEmpleados((e.data ?? []) as Empleado[])
    setNominas((n.data ?? []) as Nomina[])
    setCalc((c.data ?? []) as unknown as NominaCalc[])
    setDetalle((d.data ?? []) as unknown as NominaDetalle[])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const empsFiltrados = selectedEmp === 'all' ? empleados : empleados.filter(e => e.id === selectedEmp)
  const emilio = empleados.find(e => /emilio/i.test(e.nombre))
  const emilioId = emilio?.id ?? null

  function getNomina(empId: string, mes: number): Nomina | undefined {
    return nominas.find(n => n.empleado_id === empId && n.mes === mes && n.anio === selectedAnio)
  }

  async function handleUpload(empId: string, mes: number) {
    const key = `${empId}-${mes}`
    const url = prompt(`Introduce la URL de descarga del PDF de nómina (${MESES[mes - 1]} ${selectedAnio}):`)
    if (!url) return
    const bruto = parseFloat(prompt('Importe bruto (€):') ?? '0') || null
    const neto = parseFloat(prompt('Importe neto (€):') ?? '0') || null
    setUploading(key)
    try {
      const { error } = await supabase.from('nominas').upsert({
        empleado_id: empId, mes, anio: selectedAnio,
        importe_bruto: bruto, importe_neto: neto, pdf_url: url,
      }, { onConflict: 'empleado_id,anio,mes' })
      if (error) throw error
      await fetchAll()
    } catch (e) {
      alert('Error: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setUploading(null)
    }
  }

  function toggleEmp(empId: string) {
    setHoverMes(null)
    setExpandedEmp(expandedEmp === empId ? null : empId)
  }

  const th: React.CSSProperties = {
    padding: '10px 12px', fontFamily: FONT.heading, fontSize: 10,
    textTransform: 'uppercase', letterSpacing: '2px', color: T.mut,
    fontWeight: 400, background: T.group, textAlign: 'center',
  }
  const td: React.CSSProperties = { padding: '10px 12px', fontFamily: FONT.body, fontSize: 12, color: T.pri, textAlign: 'center' }

  const anios = [selectedAnio - 1, selectedAnio, selectedAnio + 1]

  const calcAnio = calc.filter(r => r.anio === selectedAnio).sort((a, b) => a.mes - b.mes)
  function detalleMes(mes: number, clase: string) {
    return detalle
      .filter(d => d.anio === selectedAnio && d.mes === mes && d.clase === clase)
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
  }
  const labelClase: Record<string, string> = {
    ingreso_plataforma: 'Ingresos plataforma',
    gasto_negocio: 'Gastos del negocio',
  }

  // ---- Línea de desglose dentro de card mensual ----
  function Linea({ label, val, color, signo }: { label: string; val: number; color: string; signo?: string }) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '2px 0' }}>
        <span style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut }}>{label}</span>
        <span style={{ fontFamily: FONT.body, fontSize: 12, color, fontVariantNumeric: 'tabular-nums' }}>{signo}{fmtEur(val)}</span>
      </div>
    )
  }

  // ---- Bloque cálculo Emilio (dentro de su fila) ----
  function PanelEmilio() {
    if (calcAnio.length === 0) {
      return (
        <div style={{ padding: '20px 16px', color: T.mut, fontFamily: FONT.body, fontSize: 12 }}>
          Sin movimientos de {selectedAnio}. En cuanto se importe el extracto del mes, aparece aquí.
        </div>
      )
    }
    return (
      <div style={{ padding: '18px 16px' }}>
        <div style={{ ...sectionLabelStyle(T), marginBottom: 4 }}>Sueldo · cálculo automático {selectedAnio}</div>
        <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginBottom: 16, maxWidth: 640 }}>
          Base 1.350 € − ingresos Uber / Glovo / Just Eat + gastos del negocio (Mercadona, proveedores…) = adeudado. Los traspasos a sueldo y Hacienda no cuentan. Pasa el ratón por un mes para ver sus ingresos y gastos.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(178px,1fr))', gap: 12, alignItems: 'start' }}>
          {calcAnio.map(r => {
            const hov = hoverMes === r.mes
            return (
              <div
                key={r.mes}
                onMouseEnter={() => setHoverMes(r.mes)}
                onMouseLeave={() => setHoverMes(m => (m === r.mes ? null : m))}
                style={{
                  ...cardStyle(T),
                  border: `1px solid ${hov ? '#B01D23' : T.brd}`,
                  boxShadow: hov ? '0 0 0 1px #B01D23' : 'none',
                  transition: 'border-color 150ms, box-shadow 150ms',
                }}
              >
                <div style={{ ...sectionLabelStyle(T), fontSize: 11 }}>{MESES[r.mes - 1]} {r.anio}</div>
                <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: '1.9rem', lineHeight: 1, color: '#B01D23', margin: '8px 0 2px' }}>
                  {fmtEur(r.adeudado)}
                </div>
                <div style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 8 }}>
                  Adeudado a Emilio
                </div>
                <div style={dividerStyle(T)} />
                <Linea label="Ingresos plataforma" val={r.ingresos_plataforma} color="#1D9E75" signo="− " />
                <Linea label="Gastos negocio" val={r.gastos_negocio} color="#1D9E75" signo="+ " />
                <Linea label="Base" val={r.base} color={T.sec} />

                {hov && (
                  <>
                    <div style={dividerStyle(T)} />
                    {(['ingreso_plataforma', 'gasto_negocio'] as const).map(clase => {
                      const items = detalleMes(r.mes, clase)
                      if (items.length === 0) return null
                      return (
                        <div key={clase} style={{ marginTop: 6 }}>
                          <div style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: T.mut, marginBottom: 3 }}>
                            {labelClase[clase]}
                          </div>
                          {items.map(it => (
                            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontFamily: FONT.body, fontSize: 10.5, color: T.pri, padding: '1px 0' }}>
                              <span style={{ color: T.mut, whiteSpace: 'nowrap' }}>{fmtDate(it.fecha)}</span>
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.proveedor || it.concepto}</span>
                              <span style={{ fontVariantNumeric: 'tabular-nums', color: it.importe < 0 ? '#B01D23' : '#1D9E75' }}>{fmtEur(it.importe)}</span>
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

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <select
          value={selectedEmp}
          onChange={e => setSelectedEmp(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 6, border: `1px solid ${T.brd}`, background: T.inp, color: T.pri, fontFamily: FONT.body, fontSize: 13 }}
        >
          <option value="all">Todos los empleados</option>
          {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <select
          value={selectedAnio}
          onChange={e => setSelectedAnio(parseInt(e.target.value))}
          style={{ padding: '7px 12px', borderRadius: 6, border: `1px solid ${T.brd}`, background: T.inp, color: T.pri, fontFamily: FONT.body, fontSize: 13 }}
        >
          {anios.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
      ) : (
        <div style={{ ...cardStyle(T), padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.brd}` }}>
                <th style={{ ...th, textAlign: 'left', minWidth: 190 }}>Empleado</th>
                {MESES.map((m, i) => <th key={i} style={th}>{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {empsFiltrados.length === 0 ? (
                <tr><td colSpan={13} style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin empleados activos.</td></tr>
              ) : empsFiltrados.map(emp => {
                const open = expandedEmp === emp.id
                const tieneCalc = emp.id === emilioId
                return (
                  <Fragment key={emp.id}>
                    <tr style={{ borderBottom: `1px solid ${T.brd}`, background: open ? T.group : 'transparent' }}>
                      <td
                        onClick={() => toggleEmp(emp.id)}
                        style={{ ...td, textAlign: 'left', fontWeight: 600, padding: '12px 14px', cursor: 'pointer', userSelect: 'none' }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: T.mut }}>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                          {emp.nombre}
                          {tieneCalc && (
                            <span style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: '#B01D23', border: '1px solid #B01D23', borderRadius: 4, padding: '1px 5px' }}>
                              Cálculo auto
                            </span>
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
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <span style={{ fontSize: 11, color: '#1D9E75' }}>{fmtEur(nom.importe_neto)}</span>
                                {nom.pdf_url && (
                                  <a href={nom.pdf_url} target="_blank" rel="noreferrer"
                                    style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#66aaff', fontSize: 10, textDecoration: 'none' }}>
                                    <Download size={10} /> PDF
                                  </a>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => handleUpload(emp.id, mes)}
                                disabled={uploading === key}
                                title={`Subir nómina ${MESES[i]} ${selectedAnio}`}
                                style={{ background: 'none', border: `1px dashed ${T.brd}`, borderRadius: 4, padding: '3px 6px', cursor: 'pointer', color: T.mut, fontSize: 10 }}
                              >
                                {uploading === key ? '…' : <Upload size={10} />}
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={13} style={{ padding: 0, background: T.group, borderBottom: `1px solid ${T.brd}` }}>
                          {tieneCalc ? <PanelEmilio /> : (
                            <div style={{ padding: '18px 16px', fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
                              {emp.nombre} cobra por nómina fija. Sube el PDF de cada mes en las celdas de arriba.
                            </div>
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
      <p style={{ marginTop: 10, fontSize: 11, color: T.mut, fontFamily: FONT.body }}>
        TODO: Upload automático a Drive requiere OAuth scope drive.file. Actualmente se registra URL manual.
      </p>
    </div>
  )
}
