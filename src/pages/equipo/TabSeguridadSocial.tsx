/**
 * TabSeguridadSocial — histórico de resúmenes mensuales de Seguridad Social,
 * subida de PDF con extracción IA y previsión simple del próximo pago.
 * Estética Neobrutal Food-Pop. Lee/escribe la tabla `seguridad_social_resumen`.
 */
import { useEffect, useMemo, useState } from 'react'
import { Upload, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtDate } from '@/lib/format'
import {
  OSW, LEX, INK, CREMA, SHADOW, BORDER_CARD,
  AMA, VERDE, AZUL, GRIS, d,
} from '@/styles/neobrutal'

interface SSResumen {
  id: string
  mes: number
  anio: number
  importe: number | null
  fecha_cargo: string | null
  pdf_url: string | null
  estado: 'ok' | 'revisar' | string
}

const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const card: React.CSSProperties = { background: '#fff', border: BORDER_CARD, boxShadow: SHADOW }

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

function computePrevision(rows: SSResumen[]): { importeEstimado: number; fecha: Date; mes: number; anio: number } | null {
  const conImporte = rows
    .filter(r => r.importe != null)
    .sort((a, b) => (a.anio - b.anio) || (a.mes - b.mes))
  if (conImporte.length < 2) return null

  const last3 = conImporte.slice(-3)
  const importeEstimado = last3.reduce((s, r) => s + Number(r.importe), 0) / last3.length

  const diasCargo = rows.filter(r => r.fecha_cargo).map(r => new Date(r.fecha_cargo as string).getDate())
  const diaTypical = diasCargo.length ? Math.round(diasCargo.reduce((s, dd) => s + dd, 0) / diasCargo.length) : 1

  const ultimo = conImporte[conImporte.length - 1]
  let mesSig = ultimo.mes + 1
  let anioSig = ultimo.anio
  if (mesSig > 12) { mesSig = 1; anioSig += 1 }

  return { importeEstimado, fecha: new Date(anioSig, mesSig - 1, diaTypical), mes: mesSig, anio: anioSig }
}

export default function TabSeguridadSocial() {
  const [rows, setRows] = useState<SSResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAnio, setSelectedAnio] = useState<number>(new Date().getFullYear())
  const [uploading, setUploading] = useState(false)

  async function fetchAll() {
    const { data, error } = await supabase
      .from('seguridad_social_resumen')
      .select('*')
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
    if (!error) setRows((data ?? []) as SSResumen[])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/nominas/segsocial/subir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, nombre_archivo: file.name }),
      })
      const data = await res.json()
      if (!data.ok) alert('No se pudo procesar el resumen: ' + (data.motivo || 'motivo desconocido'))
      await fetchAll()
    } catch (e) {
      alert('Error al subir: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setUploading(false)
    }
  }

  const anios = useMemo(() => {
    const set = new Set<number>(rows.map(r => r.anio))
    set.add(selectedAnio)
    return Array.from(set).sort((a, b) => b - a)
  }, [rows, selectedAnio])

  const rowsAnio = rows.filter(r => r.anio === selectedAnio).sort((a, b) => b.mes - a.mes)

  const ultimo = rows.length > 0
    ? [...rows].sort((a, b) => (b.anio - a.anio) || (b.mes - a.mes))[0]
    : null

  const prevision = useMemo(() => computePrevision(rows), [rows])

  const mesesSinResumen = useMemo(() => {
    const anioActual = new Date().getFullYear()
    const mesActual = new Date().getMonth() + 1
    const hastaMes = selectedAnio === anioActual ? mesActual : 12
    const presentes = new Set(rowsAnio.map(r => r.mes))
    let huecos = 0
    for (let m = 1; m <= hastaMes; m++) if (!presentes.has(m)) huecos++
    return huecos
  }, [rowsAnio, selectedAnio])

  return (
    <div style={{ fontFamily: LEX, color: INK }}>

      {/* Hero KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ ...card, padding: '16px 20px' }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: GRIS, marginBottom: 6 }}>Último resumen subido</div>
          {ultimo ? (
            <>
              <div style={{ ...d('26px'), lineHeight: 1 }}>{MESES_LARGO[ultimo.mes - 1]} {ultimo.anio}</div>
              <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS, marginTop: 4 }}>{fmtEur(ultimo.importe, { decimals: 2 })}</div>
            </>
          ) : (
            <div style={{ fontFamily: OSW, fontSize: 22, color: GRIS }}>—</div>
          )}
        </div>
        <div style={{ ...card, padding: '16px 20px' }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: GRIS, marginBottom: 6 }}>Próximo pago estimado</div>
          {prevision ? (
            <>
              <div style={{ ...d('26px'), lineHeight: 1 }}>{fmtEur(prevision.importeEstimado, { decimals: 2 })}</div>
              <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS, marginTop: 4 }}>{MESES_LARGO[prevision.mes - 1]} {prevision.anio} · {fmtDate(prevision.fecha)}</div>
            </>
          ) : (
            <div style={{ fontFamily: OSW, fontSize: 22, color: GRIS }}>—</div>
          )}
        </div>
        <div style={{ ...card, padding: '16px 20px', background: mesesSinResumen > 0 ? AMA : '#fff' }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: INK, marginBottom: 6 }}>Meses sin resumen ({selectedAnio})</div>
          <div style={{ ...d('34px', INK), lineHeight: 1 }}>{mesesSinResumen}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={selectedAnio} onChange={e => setSelectedAnio(parseInt(e.target.value))} style={selectNeo}>
          {anios.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <input type="file" accept="application/pdf" id="ss-upload" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
        <label htmlFor="ss-upload" style={{
          ...btnPrim, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: uploading ? 'wait' : 'pointer',
        }}>
          <Upload size={13} /> {uploading ? 'Subiendo…' : 'Subir resumen SS'}
        </label>
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: GRIS, fontFamily: LEX }}>Cargando…</div>
      ) : (
        <div style={{ ...card, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
            <thead>
              <tr style={{ background: INK }}>
                {['Mes', 'Año', 'Importe', 'Fecha de cargo', 'Estado', 'PDF'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsAnio.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: GRIS, fontFamily: LEX }}>Sin resúmenes de {selectedAnio}.</td></tr>
              )}
              {rowsAnio.map(r => (
                <tr key={r.id} style={{ borderBottom: `2px solid ${INK}` }}>
                  <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600 }}>{MESES_LARGO[r.mes - 1]}</td>
                  <td style={{ padding: '10px 12px', color: GRIS }}>{r.anio}</td>
                  <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 700 }}>{fmtEur(r.importe, { decimals: 2 })}</td>
                  <td style={{ padding: '10px 12px', color: GRIS }}>{r.fecha_cargo ? fmtDate(r.fecha_cargo) : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      fontFamily: OSW, fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase',
                      border: `2px solid ${INK}`, padding: '3px 9px',
                      background: r.estado === 'ok' ? VERDE : AMA, color: r.estado === 'ok' ? '#fff' : INK,
                    }}>
                      {r.estado === 'ok' ? 'OK' : 'Revisar'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {r.pdf_url ? (
                      <a href={r.pdf_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: AZUL, fontFamily: OSW, fontWeight: 600, fontSize: 12 }}>
                        <ExternalLink size={11} /> Ver
                      </a>
                    ) : <span style={{ color: GRIS }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: 10, fontSize: 11, color: GRIS, fontFamily: LEX }}>
        La previsión de próximo pago usa el promedio de los últimos 3 importes conocidos y el patrón histórico del día de cargo. Sin histórico suficiente no se inventa dato.
      </p>
    </div>
  )
}

const selectNeo: React.CSSProperties = { background: '#fff', border: `3px solid ${INK}`, color: INK, padding: '7px 12px', fontFamily: OSW, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', outline: 'none' }
const btnPrim: React.CSSProperties = {
  fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase',
  border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '9px 16px',
  background: AMA, color: INK,
}
