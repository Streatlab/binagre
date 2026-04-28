/**
 * T-M7-05 — Tab Histórico
 * Tabla imports_log con filtros: tipo, fecha (SelectorFechaUniversal), estado.
 */

import { useEffect, useState, type CSSProperties } from 'react'
import { ExternalLink } from 'lucide-react'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { supabase } from '@/lib/supabase'
import { fmtDate } from '@/utils/format'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'

/* ─── tipos ────────────────────────────────────────────────────────────────── */

interface ImportLog {
  id: string
  archivo_nombre: string | null
  archivo_url: string | null
  tipo_detectado: string | null
  estado: string | null
  destino_modulo: string | null
  destino_id: string | null
  fecha_subida: string
  user_id: string | null
  detalle: Record<string, unknown> | null
}

const TIPO_LEGIBLE: Record<string, string> = {
  factura_uber_portier:    'Factura Uber/Portier',
  factura_glovo:           'Factura Glovo',
  factura_jeat_rushour:    'Factura Just Eat / RushHour',
  factura_proveedor:       'Factura Proveedor',
  extracto_bancario:       'Extracto Bancario',
  resumen_plataforma_marca:'Resumen Plataforma/Marca',
  nomina:                  'Nómina',
  ventas_plataforma_csv:   'Ventas CSV',
  desconocido:             'Desconocido',
}

const ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
  procesado:          { label: 'Procesado',         color: '#06C167' },
  pendiente_revision: { label: 'Pendiente revisión',color: '#e8f442' },
  error:              { label: 'Error',              color: '#B01D23' },
}

const TIPOS_DROPDOWN = [
  { value: '', label: 'Todos los tipos' },
  ...Object.entries(TIPO_LEGIBLE).map(([v, l]) => ({ value: v, label: l })),
]

const ESTADOS_DROPDOWN = [
  { value: '', label: 'Todos los estados' },
  { value: 'procesado', label: 'Procesado' },
  { value: 'pendiente_revision', label: 'Pendiente revisión' },
  { value: 'error', label: 'Error' },
]

/* ─── modal detalle ─────────────────────────────────────────────────────────── */

function ModalDetalle({ log, onClose }: { log: ImportLog; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: '#1a1a1a', borderRadius: 14, padding: 28, minWidth: 380, maxWidth: 560, width: '90%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, color: '#B01D23', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 18 }}>
          Detalle import
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>
          <tbody>
            {[
              ['Archivo', log.archivo_nombre ?? '—'],
              ['Tipo', TIPO_LEGIBLE[log.tipo_detectado ?? ''] ?? log.tipo_detectado ?? '—'],
              ['Estado', ESTADO_CONFIG[log.estado ?? '']?.label ?? log.estado ?? '—'],
              ['Destino', log.destino_modulo ?? '—'],
              ['Fecha subida', fmtDate(log.fecha_subida)],
            ].map(([label, value]) => (
              <tr key={label} style={{ borderBottom: '0.5px solid #2a2a2a' }}>
                <td style={{ padding: '8px 10px', color: '#777777', width: 140, verticalAlign: 'top' }}>{label}</td>
                <td style={{ padding: '8px 10px', color: '#ffffff' }}>{value}</td>
              </tr>
            ))}
            {log.detalle && (
              <tr style={{ borderBottom: '0.5px solid #2a2a2a' }}>
                <td style={{ padding: '8px 10px', color: '#777777', verticalAlign: 'top' }}>Detalle</td>
                <td style={{ padding: '8px 10px', color: '#cccccc', fontSize: 11 }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {JSON.stringify(log.detalle, null, 2)}
                  </pre>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {log.archivo_url && (
          <a
            href={log.archivo_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, color: '#66aaff', fontFamily: 'Lexend, sans-serif', fontSize: 13 }}
          >
            <ExternalLink size={14} /> Ver archivo original
          </a>
        )}
        <button
          onClick={onClose}
          style={{ marginTop: 20, background: '#222222', border: '1px solid #383838', borderRadius: 6, color: '#cccccc', fontFamily: 'Lexend, sans-serif', fontSize: 13, padding: '7px 18px', cursor: 'pointer', display: 'block' }}
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}

/* ─── componente principal ─────────────────────────────────────────────────── */

interface Props {
  refresh?: number
}

export default function TabHistorico({ refresh }: Props) {
  const { T } = useTheme()
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [fechaDesde, setFechaDesde] = useState<Date | null>(null)
  const [fechaHasta, setFechaHasta] = useState<Date | null>(null)
  const [detalle, setDetalle] = useState<ImportLog | null>(null)

  async function cargar() {
    setLoading(true)
    let q = supabase
      .from('imports_log')
      .select('*')
      .order('fecha_subida', { ascending: false })
      .limit(200)

    if (filtroTipo) q = q.eq('tipo_detectado', filtroTipo)
    if (filtroEstado) q = q.eq('estado', filtroEstado)
    if (fechaDesde) q = q.gte('fecha_subida', fechaDesde.toISOString())
    if (fechaHasta) {
      const hasta = new Date(fechaHasta)
      hasta.setHours(23, 59, 59, 999)
      q = q.lte('fecha_subida', hasta.toISOString())
    }

    const { data } = await q
    setLogs((data ?? []) as ImportLog[])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [filtroTipo, filtroEstado, fechaDesde, fechaHasta, refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  const th: CSSProperties = {
    padding: '10px 14px',
    fontFamily: FONT.heading,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: T.mut,
    fontWeight: 400,
    background: '#0a0a0a',
    textAlign: 'left',
  }
  const td: CSSProperties = { padding: '10px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri }

  const selectStyle: CSSProperties = {
    background: '#1e1e1e',
    border: `1px solid ${T.brd}`,
    borderRadius: 6,
    color: T.pri,
    fontFamily: FONT.body,
    fontSize: 13,
    padding: '6px 10px',
  }

  return (
    <div>
      {/* Filtros */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 4 }}>Tipo</div>
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={selectStyle}>
            {TIPOS_DROPDOWN.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 4 }}>Estado</div>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={selectStyle}>
            {ESTADOS_DROPDOWN.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 4 }}>Fecha</div>
          <SelectorFechaUniversal
            nombreModulo="importador-historico"
            onChange={(desde, hasta) => { setFechaDesde(desde); setFechaHasta(hasta) }}
          />
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div style={{ color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>Cargando…</div>
      ) : logs.length === 0 ? (
        <div style={{ color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>Sin imports en este rango.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Fecha</th>
                <th style={th}>Tipo</th>
                <th style={th}>Archivo</th>
                <th style={th}>Destino</th>
                <th style={th}>Estado</th>
                <th style={th}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const estadoCfg = ESTADO_CONFIG[log.estado ?? ''] ?? { label: log.estado ?? '—', color: '#777777' }
                return (
                  <tr
                    key={log.id}
                    style={{ borderBottom: `0.5px solid ${T.brd}`, cursor: 'pointer' }}
                    onClick={() => setDetalle(log)}
                  >
                    <td style={{ ...td, color: T.sec, fontSize: 11 }}>
                      {new Date(log.fecha_subida).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ ...td, fontSize: 11, fontFamily: FONT.heading, letterSpacing: 0.5 }}>
                      {TIPO_LEGIBLE[log.tipo_detectado ?? ''] ?? log.tipo_detectado ?? '—'}
                    </td>
                    <td style={{ ...td, color: T.sec, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.archivo_nombre ?? '—'}
                    </td>
                    <td style={{ ...td, color: T.mut, fontSize: 11 }}>{log.destino_modulo ?? '—'}</td>
                    <td style={td}>
                      <span style={{ color: estadoCfg.color, fontFamily: FONT.heading, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                        {estadoCfg.label}
                      </span>
                    </td>
                    <td style={td}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDetalle(log) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#66aaff', fontFamily: FONT.body, fontSize: 12 }}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {detalle && <ModalDetalle log={detalle} onClose={() => setDetalle(null)} />}
    </div>
  )
}
