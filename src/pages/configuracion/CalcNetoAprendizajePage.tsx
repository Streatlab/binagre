import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtPct } from '@/lib/format'
import { FONT } from '@/styles/tokens'
import { ConfigShell } from '@/components/configuracion/ConfigShell'
import {
  calcNetoPorCanal,
  loadConfigCanales,
  loadMarcasPorCanal,
} from '@/lib/panel/calcNetoPlataforma'

/* ── tipos ────────────────────────────────────────────────── */
interface ResumenRow {
  plataforma: string
  mes: number
  anio: number  // columna en BD puede llamarse "año" o "anio" — se mapea abajo
  bruto: number
  comisiones: number | null
  fees: number | null
  cargos_promocion: number | null
  neto_real_cobrado: number
  pedidos: number
}

interface DesviacionRow {
  id: number
  canal: string
  mes: number
  anio: number
  bruto: number
  neto_teorico: number
  neto_real: number
  desviacion_eur: number
  desviacion_pct: number
  estado: 'pendiente' | 'aprobado' | 'descartado'
  created_at: string
}

interface FilaCalculo {
  canal: string
  mes: number
  bruto: number
  pedidos: number
  netoTeorico: number
  netoReal: number
  desvEur: number
  desvPct: number
  estado: 'ok' | 'alerta' | 'rojo'
}

/* ── helpers ──────────────────────────────────────────────── */
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const CANAL_LABEL: Record<string, string> = {
  uber: 'Uber Eats',
  glovo: 'Glovo',
  je: 'Just Eat',
  justeat: 'Just Eat',
  web: 'Web',
  directa: 'Directa',
  dir: 'Directa',
}

const CANAL_COLOR: Record<string, string> = {
  uber:    '#06C167',
  glovo:   '#e8f442',
  je:      '#f5a623',
  justeat: '#f5a623',
  web:     '#B01D23',
  directa: '#66aaff',
  dir:     '#66aaff',
}

function normCanal(p: string): string {
  const v = (p || '').toLowerCase().trim()
  if (v === 'just_eat' || v === 'justeat') return 'je'
  if (v === 'directa') return 'dir'
  return v
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function desvColor(pct: number): string {
  const abs = Math.abs(pct)
  if (abs < 3) return '#1D9E75'
  if (abs < 10) return '#e8f442'
  return '#B01D23'
}

function estadoFromPct(abs: number, umbral: number): FilaCalculo['estado'] {
  if (abs < 3) return 'ok'
  if (abs < umbral) return 'alerta'
  return 'rojo'
}

const TH: React.CSSProperties = {
  fontFamily: 'Oswald,sans-serif',
  fontSize: 11,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  color: '#9ba8c0',
  padding: '10px 12px',
  textAlign: 'left',
  backgroundColor: '#0a0a0a',
  borderBottom: '1px solid #2a2a2a',
  whiteSpace: 'nowrap',
}

const TD: React.CSSProperties = {
  fontFamily: 'Lexend,sans-serif',
  fontSize: 13,
  color: '#cccccc',
  padding: '9px 12px',
  borderBottom: '1px solid #1c1c1c',
  verticalAlign: 'middle',
}

/* ── componente ───────────────────────────────────────────── */
export default function CalcNetoAprendizajePage() {
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [umbral, setUmbral] = useState(5)
  const [filas, setFilas] = useState<FilaCalculo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [propuestas, setPropuestas] = useState<DesviacionRow[]>([])
  const [loadingProp, setLoadingProp] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  /* cargar propuestas pendientes */
  async function cargarPropuestas() {
    setLoadingProp(true)
    const { data } = await supabase
      .from('calcneto_desviaciones')
      .select('*')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
    setPropuestas((data as DesviacionRow[]) ?? [])
    setLoadingProp(false)
  }

  /* calcular tabla comparativa */
  async function calcular() {
    setLoading(true)
    setError(null)
    try {
      const [configCanales, marcasPorCanal] = await Promise.all([
        loadConfigCanales(),
        loadMarcasPorCanal(),
      ])

      const { data, error: err } = await supabase
        .from('resumenes_plataforma_marca_mensual')
        .select('plataforma, mes, año, bruto, comisiones, fees, cargos_promocion, neto_real_cobrado, pedidos')
        .eq('año', anio)

      if (err) throw new Error(err.message)
      if (!data || data.length === 0) { setFilas([]); setLoading(false); return }

      /* agrupar por canal + mes */
      const agr: Record<string, { bruto: number; pedidos: number; netoReal: number }> = {}
      for (const row of data as any[]) {
        const canal = normCanal(row.plataforma)
        const mes = Number(row.mes)
        const key = `${canal}_${mes}`
        if (!agr[key]) agr[key] = { bruto: 0, pedidos: 0, netoReal: 0 }
        agr[key].bruto    += Number(row.bruto ?? 0)
        agr[key].pedidos  += Number(row.pedidos ?? 0)
        agr[key].netoReal += Number(row.neto_real_cobrado ?? 0)
      }

      const resultado: FilaCalculo[] = []
      for (const [key, vals] of Object.entries(agr)) {
        const [canal, mesStr] = key.split('_')
        const mes = Number(mesStr)
        const dDesde = new Date(anio, mes - 1, 1)
        const dHasta = new Date(anio, mes - 1, lastDayOfMonth(anio, mes))
        const { neto: netoTeorico } = calcNetoPorCanal(
          canal,
          vals.bruto,
          vals.pedidos,
          { modo: 'agregado_canal', fechaDesde: dDesde, fechaHasta: dHasta, marcasPorCanal, configCanales },
        )
        const desvEur = vals.netoReal - netoTeorico
        const desvPct = netoTeorico !== 0 ? (desvEur / Math.abs(netoTeorico)) * 100 : 0
        const abs = Math.abs(desvPct)
        resultado.push({
          canal,
          mes,
          bruto: vals.bruto,
          pedidos: vals.pedidos,
          netoTeorico,
          netoReal: vals.netoReal,
          desvEur,
          desvPct,
          estado: estadoFromPct(abs, umbral),
        })
      }

      resultado.sort((a, b) => a.mes - b.mes || a.canal.localeCompare(b.canal))
      setFilas(resultado)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => { calcular(); cargarPropuestas() }, [anio])

  /* recalcular estado al cambiar umbral */
  const filasConUmbral = useMemo(() =>
    filas.map(f => ({ ...f, estado: estadoFromPct(Math.abs(f.desvPct), umbral) as FilaCalculo['estado'] })),
    [filas, umbral]
  )

  /* proponer ajuste */
  async function proponerAjuste(f: FilaCalculo) {
    const { error: err } = await supabase.from('calcneto_desviaciones').insert({
      canal: f.canal,
      mes: f.mes,
      anio: anio,
      bruto: f.bruto,
      neto_teorico: f.netoTeorico,
      neto_real: f.netoReal,
      desviacion_eur: f.desvEur,
      desviacion_pct: f.desvPct,
      estado: 'pendiente',
    })
    if (err) {
      setFeedback('Error al guardar propuesta: ' + err.message)
    } else {
      setFeedback('Propuesta guardada correctamente.')
      cargarPropuestas()
    }
    setTimeout(() => setFeedback(null), 3500)
  }

  /* actualizar estado propuesta */
  async function actualizarEstado(id: number, estado: 'aprobado' | 'descartado') {
    const { error: err } = await supabase
      .from('calcneto_desviaciones')
      .update({ estado })
      .eq('id', id)
    if (!err) cargarPropuestas()
  }

  return (
    <ConfigShell>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'Oswald,sans-serif', fontSize: 22, letterSpacing: '3px', color: '#B01D23', fontWeight: 600, textTransform: 'uppercase', margin: 0 }}>
          Aprendizaje calcNeto
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: '#777777' }}>Año</span>
          <select
            value={anio}
            onChange={e => setAnio(Number(e.target.value))}
            style={{ backgroundColor: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 4, color: '#ffffff', fontFamily: 'Lexend,sans-serif', fontSize: 13, padding: '6px 10px', cursor: 'pointer' }}
          >
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: '#777777' }}>Umbral alerta: {umbral}%</span>
          <input
            type="range" min={1} max={20} step={1}
            value={umbral}
            onChange={e => setUmbral(Number(e.target.value))}
            style={{ width: 120, accentColor: '#e8f442' }}
          />
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{ backgroundColor: '#0d2d1a', border: '1px solid #1d9e75', color: '#4ade80', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontFamily: 'Lexend,sans-serif', fontSize: 13 }}>
          {feedback}
        </div>
      )}

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { color: '#1D9E75', label: '< 3% — OK' },
          { color: '#e8f442', label: '3–10% — Alerta' },
          { color: '#B01D23', label: '> 10% — Error' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: l.color }} />
            <span style={{ fontFamily: 'Lexend,sans-serif', fontSize: 11, color: '#9ba8c0' }}>{l.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ backgroundColor: '#484f66', color: '#d0d8ff', fontSize: 10, padding: '1px 6px', borderRadius: 3, fontFamily: 'Oswald,sans-serif', letterSpacing: '0.5px' }}>ESTIMADO</span>
          <span style={{ fontFamily: 'Lexend,sans-serif', fontSize: 11, color: '#9ba8c0' }}>neto teórico calculado por fórmula</span>
        </div>
      </div>

      {/* Tabla comparativa */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#777', fontFamily: 'Lexend,sans-serif' }}>Calculando…</div>
      ) : error ? (
        <div style={{ backgroundColor: '#2d1515', border: '1px solid #aa3030', color: '#ffaaaa', borderRadius: 4, padding: '12px 16px', fontFamily: 'Lexend,sans-serif', fontSize: 13 }}>
          Error: {error}
        </div>
      ) : (
        <div style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a', borderRadius: 6, overflowX: 'auto', marginBottom: 32 }}>
          {filasConUmbral.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#777', fontFamily: 'Lexend,sans-serif' }}>No hay datos para {anio}.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Canal</th>
                  <th style={TH}>Mes</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Bruto</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Neto teórico</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Neto real</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Desv. (€)</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Desv. (%)</th>
                  <th style={TH}>Estado</th>
                  <th style={TH}></th>
                </tr>
              </thead>
              <tbody>
                {filasConUmbral.map((f, i) => {
                  const canalColor = CANAL_COLOR[f.canal] ?? '#888'
                  const rowBg = f.estado === 'rojo'
                    ? '#2a1515'
                    : i % 2 === 0 ? '#141414' : '#111111'
                  return (
                    <tr key={`${f.canal}_${f.mes}`} style={{ backgroundColor: rowBg }}>
                      <td style={TD}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: canalColor, display: 'inline-block' }} />
                          <span style={{ color: '#ffffff' }}>{CANAL_LABEL[f.canal] ?? f.canal}</span>
                        </span>
                      </td>
                      <td style={{ ...TD, color: '#9ba8c0' }}>{MESES[f.mes - 1]}</td>
                      <td style={{ ...TD, textAlign: 'right', color: '#cccccc' }}>{fmtEur(f.bruto, { decimals: 0 })}</td>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ backgroundColor: '#484f66', color: '#d0d8ff', fontSize: 9, padding: '1px 5px', borderRadius: 3, fontFamily: 'Oswald,sans-serif', letterSpacing: '0.5px' }}>EST</span>
                          <span style={{ color: '#cccccc' }}>{fmtEur(f.netoTeorico, { decimals: 0 })}</span>
                        </span>
                      </td>
                      <td style={{ ...TD, textAlign: 'right', color: '#ffffff' }}>{fmtEur(f.netoReal, { decimals: 0 })}</td>
                      <td style={{ ...TD, textAlign: 'right', color: desvColor(f.desvPct) }}>{fmtEur(f.desvEur, { decimals: 0, signed: true })}</td>
                      <td style={{ ...TD, textAlign: 'right', color: desvColor(f.desvPct), fontWeight: 600 }}>{fmtPct(f.desvPct)}</td>
                      <td style={TD}>
                        <span style={{
                          backgroundColor: f.estado === 'ok' ? '#0d2d1a' : f.estado === 'alerta' ? '#2d2800' : '#2d1515',
                          color: f.estado === 'ok' ? '#4ade80' : f.estado === 'alerta' ? '#e8f442' : '#ffaaaa',
                          border: `1px solid ${f.estado === 'ok' ? '#1d9e75' : f.estado === 'alerta' ? '#e8f44233' : '#aa3030'}`,
                          fontSize: 10, padding: '2px 8px', borderRadius: 3,
                          fontFamily: 'Oswald,sans-serif', letterSpacing: '0.5px', textTransform: 'uppercase',
                        }}>
                          {f.estado === 'ok' ? 'OK' : f.estado === 'alerta' ? 'Alerta' : 'Error'}
                        </span>
                      </td>
                      <td style={TD}>
                        {f.estado !== 'ok' && (
                          <button
                            onClick={() => proponerAjuste(f)}
                            style={{
                              backgroundColor: '#e8f442', color: '#111111',
                              border: 'none', borderRadius: 4,
                              padding: '5px 10px', fontFamily: 'Oswald,sans-serif',
                              fontSize: 11, letterSpacing: '0.5px', cursor: 'pointer',
                              textTransform: 'uppercase', whiteSpace: 'nowrap',
                            }}
                          >
                            Proponer ajuste
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Panel propuestas pendientes */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontFamily: 'Oswald,sans-serif', fontSize: 16, letterSpacing: '2px', textTransform: 'uppercase', color: '#e8f442', margin: '0 0 16px' }}>
          Propuestas pendientes
        </h2>
        {loadingProp ? (
          <div style={{ color: '#777', fontFamily: 'Lexend,sans-serif', fontSize: 13 }}>Cargando propuestas…</div>
        ) : propuestas.length === 0 ? (
          <div style={{ color: '#555', fontFamily: 'Lexend,sans-serif', fontSize: 13 }}>No hay propuestas pendientes.</div>
        ) : (
          <div style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a', borderRadius: 6, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Canal</th>
                  <th style={TH}>Periodo</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Neto teórico</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Neto real</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Desv. (€)</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Desv. (%)</th>
                  <th style={TH}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {propuestas.map((p, i) => (
                  <tr key={p.id} style={{ backgroundColor: i % 2 === 0 ? '#141414' : '#111111' }}>
                    <td style={{ ...TD, color: '#ffffff' }}>{CANAL_LABEL[p.canal] ?? p.canal}</td>
                    <td style={{ ...TD, color: '#9ba8c0' }}>{MESES[p.mes - 1]} {p.anio}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>{fmtEur(p.neto_teorico, { decimals: 0 })}</td>
                    <td style={{ ...TD, textAlign: 'right', color: '#ffffff' }}>{fmtEur(p.neto_real, { decimals: 0 })}</td>
                    <td style={{ ...TD, textAlign: 'right', color: desvColor(p.desviacion_pct) }}>{fmtEur(p.desviacion_eur, { decimals: 0, signed: true })}</td>
                    <td style={{ ...TD, textAlign: 'right', color: desvColor(p.desviacion_pct), fontWeight: 600 }}>{fmtPct(p.desviacion_pct)}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => actualizarEstado(p.id, 'aprobado')}
                          style={{ backgroundColor: '#1D9E75', color: '#ffffff', border: 'none', borderRadius: 4, padding: '5px 12px', fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: '0.5px', cursor: 'pointer', textTransform: 'uppercase' }}
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => actualizarEstado(p.id, 'descartado')}
                          style={{ backgroundColor: '#222222', color: '#cccccc', border: '1px solid #383838', borderRadius: 4, padding: '5px 12px', fontFamily: 'Oswald,sans-serif', fontSize: 11, cursor: 'pointer', textTransform: 'uppercase' }}
                        >
                          Descartar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ConfigShell>
  )
}
