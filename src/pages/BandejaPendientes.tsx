import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ──────────────────────────────────────────────────────────────────────────
// BANDEJA DE PENDIENTES (cola única de Documentación)
// Lee la vista v_bandeja_pendientes: TODO documento que aún no está 100% OK
// (sin importe, sin NIF, sin titular, sin categoría, sin Drive, sin conciliar,
// o con importe pendiente de releer) aparece aquí con su motivo. Garantía de
// que nada se pierde: si un documento no sale perfecto, está en esta lista.
// Solo lectura. No inventa nada ni concilia: es el panel de control de lo que
// falta para llegar al 100%.
// ──────────────────────────────────────────────────────────────────────────

type Pendiente = {
  id: string
  proveedor_nombre: string | null
  total: number | null
  fecha_factura: string | null
  estado: string | null
  motivo: string
}

const ORDEN_MOTIVOS = [
  'Sin importe',
  'Importe pendiente de releer',
  'Sin NIF',
  'Sin categoría',
  'Sin titular',
  'Sin Drive',
  'Sin conciliar',
  'Otro',
]

function fmtEur(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export default function BandejaPendientes() {
  const [filas, setFilas] = useState<Pendiente[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setCargando(true)
      const { data, error } = await supabase
        .from('v_bandeja_pendientes')
        .select('id, proveedor_nombre, total, fecha_factura, estado, motivo')
        .limit(5000)
      if (!vivo) return
      if (error) setError(error.message)
      else setFilas((data as Pendiente[]) || [])
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [])

  const porMotivo = useMemo(() => {
    const m = new Map<string, number>()
    for (const f of filas) m.set(f.motivo, (m.get(f.motivo) ?? 0) + 1)
    return m
  }, [filas])

  const motivosOrdenados = useMemo(() => {
    const presentes = Array.from(porMotivo.keys())
    return presentes.sort((a, b) => {
      const ia = ORDEN_MOTIVOS.indexOf(a); const ib = ORDEN_MOTIVOS.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
  }, [porMotivo])

  const visibles = useMemo(
    () => (filtro ? filas.filter(f => f.motivo === filtro) : filas),
    [filas, filtro],
  )

  const wrap: React.CSSProperties = { background: '#f5f3ef', padding: '24px 28px', minHeight: '100%' }
  const h2: React.CSSProperties = { color: '#B01D23', fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 600, letterSpacing: '3px', margin: 0, textTransform: 'uppercase' }
  const sub: React.CSSProperties = { fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090', display: 'block', marginTop: 4 }

  return (
    <div style={wrap}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={h2}>PENDIENTES</h2>
        <span style={sub}>
          {cargando ? 'Cargando…' : `${filas.length} documento${filas.length === 1 ? '' : 's'} aún sin cerrar al 100%`}
        </span>
      </div>

      {error && (
        <div style={{ background: '#fde8e8', color: '#B01D23', padding: '10px 14px', borderRadius: 8, fontFamily: 'Lexend, sans-serif', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Chips por motivo */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <button
          onClick={() => setFiltro(null)}
          style={chip(filtro === null)}
        >
          Todos · {filas.length}
        </button>
        {motivosOrdenados.map(mt => (
          <button key={mt} onClick={() => setFiltro(mt)} style={chip(filtro === mt)}>
            {mt} · {porMotivo.get(mt)}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1e2233', color: '#fff', textAlign: 'left' }}>
              <th style={th}>Motivo</th>
              <th style={th}>Proveedor</th>
              <th style={{ ...th, textAlign: 'right' }}>Importe</th>
              <th style={th}>Fecha</th>
              <th style={th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {!cargando && visibles.length === 0 && (
              <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#7a8090', padding: '24px' }}>
                Nada pendiente. Todo al 100%.
              </td></tr>
            )}
            {visibles.map(f => (
              <tr key={f.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={td}><span style={badge(f.motivo)}>{f.motivo}</span></td>
                <td style={td}>{f.proveedor_nombre || '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmtEur(f.total)}</td>
                <td style={td}>{f.fecha_factura || '—'}</td>
                <td style={{ ...td, color: '#7a8090' }}>{f.estado || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 14px', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600 }
const td: React.CSSProperties = { padding: '9px 14px' }

function chip(activo: boolean): React.CSSProperties {
  return {
    background: activo ? '#B01D23' : '#fff',
    color: activo ? '#fff' : '#484f66',
    border: '1px solid ' + (activo ? '#B01D23' : '#dcd7d0'),
    borderRadius: 999,
    padding: '6px 14px',
    fontFamily: 'Oswald, sans-serif',
    fontSize: 11,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontWeight: 600,
  }
}

function badge(motivo: string): React.CSSProperties {
  const rojo = motivo === 'Sin importe' || motivo === 'Importe pendiente de releer' || motivo === 'Sin NIF'
  return {
    background: rojo ? '#fde8e8' : '#eef0f4',
    color: rojo ? '#B01D23' : '#484f66',
    borderRadius: 6,
    padding: '3px 9px',
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  }
}
