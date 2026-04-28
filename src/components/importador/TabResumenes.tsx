/**
 * T-M7-07 — Tab Resúmenes plataforma
 * Tabla ventas_plataforma_marca_mensual con filtros.
 * Modal detalle con link Drive + botones "Ir a Running" y "Ver en Panel Marcas".
 */

import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, TrendingUp, Tag } from 'lucide-react'
import { useTheme, FONT } from '@/styles/tokens'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtNum } from '@/utils/format'

/* ─── tipos ────────────────────────────────────────────────────────────────── */

interface ResumenRow {
  id: string
  mes: number
  anio: number
  plataforma: string
  marca: string
  bruto: number | null
  pedidos: number | null
  comisiones: number | null
  fees: number | null
  cargos_promocion: number | null
  ads: number | null
  neto_cobrado: number | null
  archivo_origen: string | null
  fecha_subida: string
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const PLATAFORMA_COLOR: Record<string, string> = {
  uber:     '#06C167',
  glovo:    '#aabc00',
  just_eat: '#f5a623',
  rushour:  '#7F77DD',
}

/* ─── modal detalle ─────────────────────────────────────────────────────────── */

function ModalDetalle({ row, onClose }: { row: ResumenRow; onClose: () => void }) {
  const navigate = useNavigate()

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: '#1a1a1a', borderRadius: 14, padding: 28, minWidth: 400, maxWidth: 560, width: '90%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, color: '#B01D23', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          {row.plataforma.toUpperCase()} · {row.marca}
        </div>
        <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#777777', marginBottom: 20 }}>
          {MESES[(row.mes ?? 1) - 1]} {row.anio}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Lexend, sans-serif', fontSize: 13, marginBottom: 20 }}>
          <tbody>
            {[
              ['Bruto', fmtEur(row.bruto ?? 0)],
              ['Pedidos', fmtNum(row.pedidos ?? 0)],
              ['Comisiones', fmtEur(row.comisiones ?? 0)],
              ['Fees', fmtEur(row.fees ?? 0)],
              ['Cargos promoción', fmtEur(row.cargos_promocion ?? 0)],
              ['ADS', fmtEur(row.ads ?? 0)],
              ['Neto cobrado', fmtEur(row.neto_cobrado ?? 0)],
            ].map(([label, value]) => (
              <tr key={label} style={{ borderBottom: '0.5px solid #2a2a2a' }}>
                <td style={{ padding: '8px 10px', color: '#777777', width: 160 }}>{label}</td>
                <td style={{ padding: '8px 10px', color: '#ffffff', textAlign: 'right' }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {row.archivo_origen && (
          <a
            href={row.archivo_origen}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, color: '#66aaff', fontFamily: 'Lexend, sans-serif', fontSize: 13 }}
          >
            <ExternalLink size={14} /> Ver PDF original
          </a>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => { navigate(`/finanzas/running?plataforma=${row.plataforma}&mes=${row.mes}&anio=${row.anio}`); onClose() }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#B01D23', border: 'none', borderRadius: 6, color: '#ffffff', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', padding: '8px 14px', cursor: 'pointer' }}
          >
            <TrendingUp size={14} /> Ir a Running
          </button>
          <button
            onClick={() => { navigate(`/configuracion/marcas?plataforma=${row.plataforma}&mes=${row.mes}&anio=${row.anio}`); onClose() }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#222222', border: '1px solid #383838', borderRadius: 6, color: '#cccccc', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', padding: '8px 14px', cursor: 'pointer' }}
          >
            <Tag size={14} /> Ver en Panel Marcas
          </button>
          <button
            onClick={onClose}
            style={{ background: '#222222', border: '1px solid #383838', borderRadius: 6, color: '#cccccc', fontFamily: 'Lexend, sans-serif', fontSize: 13, padding: '7px 18px', cursor: 'pointer' }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── componente principal ─────────────────────────────────────────────────── */

interface Props {
  refresh?: number
}

export default function TabResumenes({ refresh }: Props) {
  const { T } = useTheme()
  const [rows, setRows] = useState<ResumenRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroPla, setFiltroPla] = useState('')
  const [filtroMarca, setFiltroMarca] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroAnio, setFiltroAnio] = useState('')
  const [detalle, setDetalle] = useState<ResumenRow | null>(null)

  async function cargar() {
    setLoading(true)
    let q = supabase
      .from('ventas_plataforma_marca_mensual')
      .select('*')
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
      .limit(500)

    if (filtroPla) q = q.eq('plataforma', filtroPla)
    if (filtroMarca) q = q.ilike('marca', `%${filtroMarca}%`)
    if (filtroMes) q = q.eq('mes', parseInt(filtroMes))
    if (filtroAnio) q = q.eq('anio', parseInt(filtroAnio))

    const { data } = await q
    setRows((data ?? []) as ResumenRow[])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [filtroPla, filtroMarca, filtroMes, filtroAnio, refresh]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const anoActual = new Date().getFullYear()
  const anios = [anoActual, anoActual - 1, anoActual - 2].map(String)

  return (
    <div>
      {/* Filtros */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20, alignItems: 'flex-end' }}>
        {[
          {
            label: 'Plataforma',
            value: filtroPla,
            onChange: setFiltroPla,
            options: [
              { value: '', label: 'Todas' },
              { value: 'uber', label: 'Uber Eats' },
              { value: 'glovo', label: 'Glovo' },
              { value: 'just_eat', label: 'Just Eat' },
              { value: 'rushour', label: 'RushHour' },
            ],
          },
          {
            label: 'Mes',
            value: filtroMes,
            onChange: setFiltroMes,
            options: [
              { value: '', label: 'Todos' },
              ...MESES.map((m, i) => ({ value: String(i + 1), label: m })),
            ],
          },
          {
            label: 'Año',
            value: filtroAnio,
            onChange: setFiltroAnio,
            options: [
              { value: '', label: 'Todos' },
              ...anios.map(a => ({ value: a, label: a })),
            ],
          },
        ].map(f => (
          <div key={f.label}>
            <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 4 }}>{f.label}</div>
            <select value={f.value} onChange={(e) => f.onChange(e.target.value)} style={selectStyle}>
              {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        ))}
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 4 }}>Marca</div>
          <input
            type="text"
            placeholder="Filtrar marca…"
            value={filtroMarca}
            onChange={(e) => setFiltroMarca(e.target.value)}
            style={{ ...selectStyle, minWidth: 140 }}
          />
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div style={{ color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>Cargando…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>Sin resúmenes. Sube un XLSX con columnas Mes, Plataforma, Marca.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Mes</th>
                <th style={th}>Año</th>
                <th style={th}>Plataforma</th>
                <th style={th}>Marca</th>
                <th style={{ ...th, textAlign: 'right' }}>Bruto</th>
                <th style={{ ...th, textAlign: 'right' }}>Neto</th>
                <th style={{ ...th, textAlign: 'right' }}>ADS</th>
                <th style={{ ...th, textAlign: 'right' }}>Pedidos</th>
                <th style={th}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row.id}
                  style={{ borderBottom: `0.5px solid ${T.brd}`, cursor: 'pointer' }}
                  onClick={() => setDetalle(row)}
                >
                  <td style={{ ...td, color: T.sec }}>
                    {MESES[(row.mes ?? 1) - 1]}
                  </td>
                  <td style={{ ...td, color: T.sec }}>{row.anio}</td>
                  <td style={{ ...td, fontFamily: FONT.heading, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: PLATAFORMA_COLOR[row.plataforma] ?? T.mut }}>
                    {row.plataforma}
                  </td>
                  <td style={td}>{row.marca}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtEur(row.bruto ?? 0)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtEur(row.neto_cobrado ?? 0)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtEur(row.ads ?? 0)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtNum(row.pedidos ?? 0)}</td>
                  <td style={td}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDetalle(row) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#66aaff', fontFamily: FONT.body, fontSize: 12 }}
                    >
                      Detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detalle && <ModalDetalle row={detalle} onClose={() => setDetalle(null)} />}
    </div>
  )
}
