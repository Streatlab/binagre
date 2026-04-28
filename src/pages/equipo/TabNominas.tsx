import { useEffect, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { fmtEur } from '@/utils/format'

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

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default function TabNominas() {
  const { T, isDark: _isDark } = useTheme()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [nominas, setNominas] = useState<Nomina[]>([])
  const [selectedEmp, setSelectedEmp] = useState<string>('all')
  const [selectedAnio, setSelectedAnio] = useState<number>(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)

  async function fetchAll() {
    const [e, n] = await Promise.all([
      supabase.from('empleados').select('id, nombre').eq('estado', 'activo').order('nombre'),
      supabase.from('nominas').select('*').order('anio', { ascending: false }).order('mes'),
    ])
    setEmpleados((e.data ?? []) as Empleado[])
    setNominas((n.data ?? []) as Nomina[])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const empsFiltrados = selectedEmp === 'all' ? empleados : empleados.filter(e => e.id === selectedEmp)

  function getNomina(empId: string, mes: number): Nomina | undefined {
    return nominas.find(n => n.empleado_id === empId && n.mes === mes && n.anio === selectedAnio)
  }

  async function handleUpload(empId: string, mes: number) {
    const key = `${empId}-${mes}`
    // TODO: upload real a Drive cuando haya OAuth scope drive.file
    // Por ahora: pedir URL manual al usuario
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
