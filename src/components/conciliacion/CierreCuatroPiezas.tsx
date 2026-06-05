import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { fmtEur } from '@/utils/format'
import { COLORS, FONT, CARDS } from '@/components/panel/resumen/tokens'
import { supabase } from '@/lib/supabase'

interface PiezaMes {
  mes: string
  facturacion_plataforma: number | null
  factura_recibida: number | null
  abono_banco: number | null
  csv_rushour: number | null
}

export default function CierreCuatroPiezas() {
  const [filas, setFilas] = useState<PiezaMes[]>([])
  const [loading, setLoading] = useState(true)
  const [tieneCsvRushour, setTieneCsvRushour] = useState(false)

  useEffect(() => {
    async function cargar() {
      setLoading(true)

      // Facturación plataforma: facturacion_diario agrupado por mes
      const { data: facturacion } = await supabase
        .from('facturacion_diario')
        .select('fecha, total_neto')
        .order('fecha', { ascending: false })

      // Facturas recibidas: suma por mes
      const { data: facturasData } = await supabase
        .from('facturas')
        .select('fecha_factura, total')
        .order('fecha_factura', { ascending: false })

      // Movimientos banco: ingresos (importe > 0) agrupados por mes
      const { data: movData } = await supabase
        .from('conciliacion')
        .select('fecha, importe')
        .gt('importe', 0)
        .order('fecha', { ascending: false })

      // Rushour: intentar ingresos_mensuales
      const { data: rushourData, error: rushErr } = await supabase
        .from('ingresos_mensuales')
        .select('mes, total')
        .order('mes', { ascending: false })

      setTieneCsvRushour(!rushErr && (rushourData?.length ?? 0) > 0)

      // Construir mapa por mes YYYY-MM
      const meses = new Map<string, PiezaMes>()

      const getOrCreate = (mes: string): PiezaMes => {
        if (!meses.has(mes)) {
          meses.set(mes, { mes, facturacion_plataforma: null, factura_recibida: null, abono_banco: null, csv_rushour: null })
        }
        return meses.get(mes)!
      }

      for (const row of (facturacion ?? [])) {
        if (!row.fecha) continue
        const mes = row.fecha.slice(0, 7)
        const p = getOrCreate(mes)
        p.facturacion_plataforma = (p.facturacion_plataforma ?? 0) + Number(row.total_neto ?? 0)
      }

      for (const row of (facturasData ?? [])) {
        if (!row.fecha_factura) continue
        const mes = row.fecha_factura.slice(0, 7)
        const p = getOrCreate(mes)
        p.factura_recibida = (p.factura_recibida ?? 0) + Number(row.total ?? 0)
      }

      for (const row of (movData ?? [])) {
        if (!row.fecha) continue
        const mes = row.fecha.slice(0, 7)
        const p = getOrCreate(mes)
        p.abono_banco = (p.abono_banco ?? 0) + Number(row.importe ?? 0)
      }

      if (rushourData) {
        for (const row of rushourData) {
          if (!row.mes) continue
          const mes = String(row.mes).slice(0, 7)
          const p = getOrCreate(mes)
          p.csv_rushour = (p.csv_rushour ?? 0) + Number(row.total ?? 0)
        }
      }

      // Ordenar por mes desc, tomar los 12 últimos
      const sorted = Array.from(meses.values())
        .sort((a, b) => b.mes.localeCompare(a.mes))
        .slice(0, 12)

      setFilas(sorted)
      setLoading(false)
    }

    cargar()
  }, [])

  return (
    <div style={{ ...CARDS.big, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: '2px', color: COLORS.mut, textTransform: 'uppercase', fontWeight: 500 }}>
          Cierre 4 piezas — solo lectura
        </span>
        {!tieneCsvRushour && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontFamily: FONT.body, fontSize: 11, color: COLORS.warn,
            background: COLORS.warn + '18', padding: '2px 8px', borderRadius: 6,
          }}>
            <AlertCircle size={11} /> CSV Rushour pendiente
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut }}>Cargando…</div>
      ) : filas.length === 0 ? (
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut }}>Sin datos disponibles.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT.body, fontSize: 13 }}>
            <thead>
              <tr>
                {['Mes', 'Facturación plataforma', 'Factura recibida', 'Abono banco', tieneCsvRushour ? 'CSV Rushour' : 'CSV Rushour (pendiente)', 'Descuadre'].map(h => (
                  <th key={h} style={{
                    fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase',
                    color: COLORS.mut, fontWeight: 500, padding: '6px 10px', textAlign: 'right',
                    borderBottom: `1px solid ${COLORS.brd}`,
                    ...(h === 'Mes' ? { textAlign: 'left' } : {}),
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => {
                const vals = [f.facturacion_plataforma, f.factura_recibida, f.abono_banco, f.csv_rushour]
                const presentes = vals.filter(v => v != null) as number[]
                const descuadre = presentes.length >= 2
                  ? Math.max(...presentes) - Math.min(...presentes)
                  : null
                const hayDescuadre = descuadre != null && descuadre > 0.5

                return (
                  <tr key={f.mes} style={{ background: i % 2 === 0 ? 'transparent' : COLORS.group + '66' }}>
                    <td style={{ padding: '8px 10px', color: COLORS.sec, fontWeight: 500 }}>
                      {f.mes.slice(0, 7)}
                    </td>
                    <CeldaEur valor={f.facturacion_plataforma} />
                    <CeldaEur valor={f.factura_recibida} />
                    <CeldaEur valor={f.abono_banco} />
                    <CeldaEur valor={f.csv_rushour} pendiente={!tieneCsvRushour} />
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      {descuadre == null ? (
                        <span style={{ color: COLORS.mut }}>—</span>
                      ) : (
                        <span style={{
                          color: hayDescuadre ? COLORS.err : COLORS.ok,
                          fontWeight: hayDescuadre ? 600 : 400,
                        }}>
                          {hayDescuadre ? fmtEur(descuadre) : '✓'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function CeldaEur({ valor, pendiente }: { valor: number | null; pendiente?: boolean }) {
  if (pendiente) {
    return (
      <td style={{ padding: '8px 10px', textAlign: 'right', color: COLORS.warn, fontStyle: 'italic', fontSize: 11 }}>
        pendiente CSV
      </td>
    )
  }
  return (
    <td style={{ padding: '8px 10px', textAlign: 'right', color: valor == null ? COLORS.mut : COLORS.sec }}>
      {valor == null ? '—' : fmtEur(valor)}
    </td>
  )
}
