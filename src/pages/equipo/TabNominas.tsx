import { useEffect, useState, Fragment } from 'react'
import { Download, Upload, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
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
  const [expanded, setExpanded] = useState<string | null>(null)
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

  const th: React.CSSProperties = {
    padding: '10px 12px', fontFamily: FONT.heading, fontSize: 10,
    textTransform: 'uppercase', letterSpacing: '2px', color: T.mut,
    fontWeight: 400, background: T.group, textAlign: 'center',
  }
  const td: React.CSSProperties = { padding: '10px 12px', fontFamily: FONT.body, fontSize: 12, color: T.pri, textAlign: 'center' }

  const anios = [selectedAnio - 1, selectedAnio, selectedAnio + 1]

  // ---- Cálculo automático sueldo Emilio ----
  const calcAnio = calc
    .filter(r => r.anio === selectedAnio)
    .sort((a, b) => b.mes - a.mes)

  function detalleMes(anio: number, mes: number, clase: string) {
    return detalle
      .filter(d => d.anio === anio && d.mes === mes && d.clase === clase)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
  }

  const labelClase: Record<string, string> = {
    ingreso_plataforma: 'Ingresos plataforma (Uber / Glovo / Just Eat)',
    gasto_negocio: 'Gastos del negocio',
    ignorado: 'Ignorados (no cuentan)',
  }

  return (
    <div>
      {/* ============ PANEL SUELDO EMILIO ============ */}
      <div style={{ ...cardStyle(T), padding: 18, marginBottom: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0, fontFamily: FONT.heading, fontSize: 15, color: T.pri, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Sueldo Emilio · cálculo automático
          </h3>
          <span style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
            Base 1.200 € − ingresos plataforma + gastos negocio = adeudado
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
        ) : calcAnio.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 12 }}>
            Sin movimientos de Emilio en {selectedAnio}. En cuanto se importe el extracto del mes, aparece aquí.
          </div>
        ) : (
          <div style={{ marginTop: 14, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.brd}` }}>
                  <th style={{ ...th, textAlign: 'left', width: 36 }}></th>
                  <th style={{ ...th, textAlign: 'left' }}>Mes</th>
                  <th style={{ ...th, textAlign: 'right' }}>Ingresos plataforma</th>
                  <th style={{ ...th, textAlign: 'right' }}>Gastos negocio</th>
                  <th style={{ ...th, textAlign: 'right' }}>Adeudado a Emilio</th>
                </tr>
              </thead>
              <tbody>
                {calcAnio.map(r => {
                  const key = `${r.anio}-${r.mes}`
                  const open = expanded === key
                  return (
                    <Fragment key={key}>
                      <tr
                        onClick={() => setExpanded(open ? null : key)}
                        style={{ borderBottom: `1px solid ${T.brd}`, cursor: 'pointer' }}
                      >
                        <td style={{ ...td, textAlign: 'center', color: T.mut }}>
                          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>{MESES[r.mes - 1]} {r.anio}</td>
                        <td style={{ ...td, textAlign: 'right', color: '#1D9E75' }}>+ {fmtEur(r.ingresos_plataforma)}</td>
                        <td style={{ ...td, textAlign: 'right', color: '#B01D23' }}>+ {fmtEur(r.gastos_negocio)}</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 700, fontSize: 14, color: T.pri }}>{fmtEur(r.adeudado)}</td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={5} style={{ padding: '12px 16px', background: T.group }}>
                            {(['ingreso_plataforma', 'gasto_negocio', 'ignorado'] as const).map(clase => {
                              const items = detalleMes(r.anio, r.mes, clase)
                              if (items.length === 0) return null
                              return (
                                <div key={clase} style={{ marginBottom: 12 }}>
                                  <div style={{ fontFamily: FONT.heading, fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: T.mut, marginBottom: 6 }}>
                                    {labelClase[clase]}
                                  </div>
                                  {items.map(it => (
                                    <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontFamily: FONT.body, fontSize: 11.5, color: T.pri, padding: '3px 0', opacity: clase === 'ignorado' ? 0.5 : 1 }}>
                                      <span style={{ color: T.mut, minWidth: 64 }}>{fmtDate(it.fecha)}</span>
                                      <span style={{ flex: 1 }}>{it.proveedor || it.concepto}</span>
                                      <span style={{ fontVariantNumeric: 'tabular-nums', color: it.importe < 0 ? '#B01D23' : '#1D9E75' }}>{fmtEur(it.importe)}</span>
                                    </div>
                                  ))}
                                </div>
                              )
                            })}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
            <p style={{ marginTop: 10, fontSize: 10.5, color: T.mut, fontFamily: FONT.body }}>
              Ingresos = abonos Uber / Glovo / Just Eat en su cuenta. Gastos = compras del negocio (Mercadona, proveedores…). Traspasos entre sus cuentas y sueldos no cuentan. Abre cada mes para ver el detalle.
            </p>
          </div>
        )}
      </div>

      {/* ============ GRID NÓMINAS PDF ============ */}
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
                <th style={{ ...th, textAlign: 'left', minWidth: 160 }}>Empleado</th>
                {MESES.map((m, i) => <th key={i} style={th}>{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {empsFiltrados.length === 0 ? (
                <tr><td colSpan={13} style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin empleados activos.</td></tr>
              ) : empsFiltrados.map(emp => (
                <tr key={emp.id} style={{ borderBottom: `1px solid ${T.brd}` }}>
                  <td style={{ ...td, textAlign: 'left', fontWeight: 600, padding: '12px 14px' }}>{emp.nombre}</td>
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
              ))}
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
