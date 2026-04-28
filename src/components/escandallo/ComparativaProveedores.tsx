/**
 * T-F4-11 — ComparativaProveedores
 * Compara precios últimos 30 días por proveedor para un ingrediente.
 * Muestra recomendación de ahorro.
 */
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'

interface ProveedorStats {
  proveedor: string
  precio_medio: number
  n_muestras: number
}

interface Props {
  ingredienteId: string
  proveedorPrincipal?: string | null
  /** Consumo mensual estimado en unidades (para cálculo ahorro) */
  consumoMensualEst?: number
}

export function ComparativaProveedores({ ingredienteId, proveedorPrincipal, consumoMensualEst = 50 }: Props) {
  const { T } = useTheme()
  const [stats, setStats] = useState<ProveedorStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fecha30 = new Date(); fecha30.setDate(fecha30.getDate() - 30)
    ;(async () => {
      const { data } = await supabase
        .from('precios_ingredientes')
        .select('proveedor, precio_unitario')
        .eq('ingrediente_id', ingredienteId)
        .gte('fecha', fecha30.toISOString().slice(0, 10))

      if (!cancelled) {
        // Agrupar por proveedor
        const grupos: Record<string, number[]> = {}
        for (const r of (data ?? []) as { proveedor: string; precio_unitario: number }[]) {
          if (!grupos[r.proveedor]) grupos[r.proveedor] = []
          grupos[r.proveedor].push(r.precio_unitario)
        }

        const result: ProveedorStats[] = Object.entries(grupos).map(([proveedor, precios]) => ({
          proveedor,
          precio_medio: precios.reduce((a, b) => a + b, 0) / precios.length,
          n_muestras: precios.length,
        })).sort((a, b) => a.precio_medio - b.precio_medio)

        setStats(result)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [ingredienteId])

  if (loading || stats.length < 2) return null

  const principal = proveedorPrincipal
    ? stats.find(s => s.proveedor === proveedorPrincipal)
    : stats[stats.length - 1] // el más caro si no hay principal

  const mejor = stats[0]

  const thStyle: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px',
    textTransform: 'uppercase', color: T.mut, padding: '7px 10px',
    textAlign: 'left', background: '#0a0a0a', borderBottom: `1px solid ${T.brd}`,
  }
  const tdStyle: CSSProperties = {
    fontFamily: FONT.body, fontSize: 12, color: T.pri,
    padding: '7px 10px', borderBottom: `0.5px solid ${T.brd}`,
  }

  return (
    <div style={{
      background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, padding: '14px 16px', marginTop: 12,
    }}>
      <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 10 }}>
        Comparativa proveedores — últimos 30 días
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Proveedor</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Precio medio</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Δ% vs principal</th>
            <th style={thStyle}>Recomendación</th>
          </tr>
        </thead>
        <tbody>
          {stats.map(s => {
            const esPrincipal = s.proveedor === proveedorPrincipal
            const esMejor = s.proveedor === mejor.proveedor
            const deltaPct = principal
              ? ((s.precio_medio - principal.precio_medio) / principal.precio_medio) * 100
              : 0
            const ahorroMes = principal && s.precio_medio < principal.precio_medio
              ? (principal.precio_medio - s.precio_medio) * consumoMensualEst
              : null

            return (
              <tr key={s.proveedor} style={{ background: esMejor ? '#1D9E7511' : 'transparent' }}>
                <td style={tdStyle}>
                  <span style={{ color: esPrincipal ? '#e8f442' : T.pri }}>
                    {s.proveedor}
                    {esPrincipal && <span style={{ fontSize: 9, marginLeft: 4, color: T.mut }}>principal</span>}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>
                  {s.precio_medio.toLocaleString('es-ES', { minimumFractionDigits: 4 })} €
                  <span style={{ color: T.mut, fontSize: 10, marginLeft: 4 }}>({s.n_muestras})</span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {principal && !esPrincipal ? (
                    <span style={{ color: deltaPct < 0 ? '#1D9E75' : '#E24B4A' }}>
                      {deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%
                    </span>
                  ) : '—'}
                </td>
                <td style={tdStyle}>
                  {esMejor && !esPrincipal && ahorroMes != null && ahorroMes > 0 ? (
                    <span style={{ color: '#1D9E75', fontSize: 11 }}>
                      Cambia a {s.proveedor}, ahorras ~{ahorroMes.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/mes
                    </span>
                  ) : esPrincipal ? (
                    <span style={{ color: T.mut, fontSize: 11 }}>Proveedor actual</span>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
