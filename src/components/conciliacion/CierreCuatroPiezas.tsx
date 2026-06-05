import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { COLORS, OSWALD, LEXEND, CARDS } from '@/components/panel/resumen/tokens'
import { fmtEur } from '@/utils/format'

interface PeriodoData {
  periodo: string
  ventas_plataforma: number
  facturas_recibidas: number
  abono_banco: number
  rushour_csv: number | null
}

export function CierreCuatroPiezas() {
  const [datos, setDatos] = useState<PeriodoData[]>([])
  const [loading, setLoading] = useState(true)
  const [rushourDisponible, setRushourDisponible] = useState(false)

  useEffect(() => {
    async function cargar() {
      const now = new Date()
      const desde = new Date(now.getFullYear(), now.getMonth() - 11, 1)
        .toISOString()
        .slice(0, 10)

      const [vpRes, fRes, cRes, rRes] = await Promise.all([
        supabase
          .from('ventas_plataforma')
          .select('fecha_inicio_periodo, bruto')
          .gte('fecha_inicio_periodo', desde),
        supabase
          .from('facturas')
          .select('fecha_factura, total')
          .not('plataforma', 'is', null)
          .gte('fecha_factura', desde),
        supabase
          .from('conciliacion')
          .select('fecha, importe')
          .gt('importe', 0)
          .gte('fecha', desde),
        supabase
          .from('serie_diaria_rushour')
          .select('fecha, ingresos')
          .gte('fecha', desde),
      ])

      const toMes = (fecha: string | null): string => fecha?.slice(0, 7) ?? ''
      const meses = new Map<string, PeriodoData>()

      const init = (m: string): PeriodoData => ({
        periodo: m,
        ventas_plataforma: 0,
        facturas_recibidas: 0,
        abono_banco: 0,
        rushour_csv: null,
      })

      if (vpRes.data) {
        for (const r of vpRes.data) {
          const m = toMes(r.fecha_inicio_periodo)
          if (!m) continue
          const d = meses.get(m) ?? init(m)
          d.ventas_plataforma += Number(r.bruto ?? 0)
          meses.set(m, d)
        }
      }

      if (fRes.data) {
        for (const r of fRes.data) {
          const m = toMes(r.fecha_factura)
          if (!m) continue
          const d = meses.get(m) ?? init(m)
          d.facturas_recibidas += Number(r.total ?? 0)
          meses.set(m, d)
        }
      }

      if (cRes.data) {
        for (const r of cRes.data) {
          const m = toMes(r.fecha)
          if (!m) continue
          const d = meses.get(m) ?? init(m)
          d.abono_banco += Number(r.importe ?? 0)
          meses.set(m, d)
        }
      }

      const tieneRushour = (rRes.data?.length ?? 0) > 0
      setRushourDisponible(tieneRushour)

      if (rRes.data && tieneRushour) {
        for (const r of rRes.data) {
          const m = toMes(r.fecha)
          if (!m) continue
          const d = meses.get(m) ?? init(m)
          d.rushour_csv = (d.rushour_csv ?? 0) + Number(r.ingresos ?? 0)
          meses.set(m, d)
        }
      }

      const sorted = Array.from(meses.values()).sort((a, b) =>
        b.periodo.localeCompare(a.periodo),
      )
      setDatos(sorted)
      setLoading(false)
    }
    cargar()
  }, [])

  if (loading) {
    return (
      <div style={{ fontFamily: LEXEND, fontSize: 13, color: COLORS.mut, padding: '20px 0' }}>
        Cargando cierre ventas…
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontFamily: OSWALD,
            fontSize: 14,
            letterSpacing: '2px',
            color: COLORS.redSL,
            textTransform: 'uppercase',
          }}
        >
          CIERRE DE 4 PIEZAS — LADO VENTAS
        </div>
        <div style={{ fontFamily: LEXEND, fontSize: 12, color: COLORS.mut, marginTop: 2 }}>
          Solo lectura · Cruce mensual: ventas plataforma · factura recibida · abono banco ·
          Rushour CSV
          {!rushourDisponible && (
            <span
              style={{
                marginLeft: 8,
                background: COLORS.warn + '22',
                color: COLORS.warn,
                fontFamily: OSWALD,
                fontSize: 10,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: 4,
              }}
            >
              Rushour: pendiente CSV
            </span>
          )}
        </div>
      </div>

      {datos.length === 0 ? (
        <div style={{ ...CARDS.std, textAlign: 'center', padding: 40 }}>
          <div style={{ fontFamily: OSWALD, fontSize: 12, letterSpacing: '2px', color: COLORS.mut }}>
            SIN DATOS EN EL PERIODO
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${COLORS.brd}` }}>
                <Th>Periodo</Th>
                <Th align="right">① Ventas plataforma</Th>
                <Th align="right">② Factura recibida</Th>
                <Th align="right">③ Abono banco</Th>
                <Th align="right">{rushourDisponible ? '④ Rushour CSV' : '④ Rushour'}</Th>
                <Th align="right">Descuadre ①–②</Th>
                <Th align="right">Descuadre ②–③</Th>
              </tr>
            </thead>
            <tbody>
              {datos.map(d => {
                const desc12 = d.ventas_plataforma - d.facturas_recibidas
                const desc23 = d.facturas_recibidas - d.abono_banco
                const ok12 = Math.abs(desc12) < 0.05
                const ok23 = Math.abs(desc23) < 0.05
                return (
                  <tr
                    key={d.periodo}
                    style={{ borderBottom: `0.5px solid ${COLORS.brd}` }}
                  >
                    <Td>
                      <span
                        style={{
                          fontFamily: OSWALD,
                          fontWeight: 600,
                          fontSize: 13,
                          color: COLORS.pri,
                        }}
                      >
                        {d.periodo}
                      </span>
                    </Td>
                    <Td align="right">{fmtEur(d.ventas_plataforma)}</Td>
                    <Td align="right">{fmtEur(d.facturas_recibidas)}</Td>
                    <Td align="right">{fmtEur(d.abono_banco)}</Td>
                    <Td align="right">
                      {d.rushour_csv != null ? (
                        fmtEur(d.rushour_csv)
                      ) : (
                        <span
                          style={{
                            fontFamily: OSWALD,
                            fontSize: 10,
                            letterSpacing: '1px',
                            color: COLORS.warn,
                            textTransform: 'uppercase',
                          }}
                        >
                          pendiente CSV
                        </span>
                      )}
                    </Td>
                    <Td align="right">
                      <span
                        style={{
                          fontFamily: OSWALD,
                          fontSize: 13,
                          fontWeight: 600,
                          color: ok12 ? COLORS.ok : COLORS.err,
                        }}
                      >
                        {ok12 ? '—' : fmtEur(desc12)}
                      </span>
                    </Td>
                    <Td align="right">
                      <span
                        style={{
                          fontFamily: OSWALD,
                          fontSize: 13,
                          fontWeight: 600,
                          color: ok23 ? COLORS.ok : COLORS.err,
                        }}
                      >
                        {ok23 ? '—' : fmtEur(desc23)}
                      </span>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 14, fontFamily: LEXEND, fontSize: 11, color: COLORS.mut }}>
        Último año · descuadre en rojo cuando |diferencia| &gt; 0,05 € · No se escribe nada en esta vista.
      </div>
    </div>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: string }) {
  return (
    <th
      style={{
        fontFamily: OSWALD,
        fontSize: 10,
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        color: COLORS.mut,
        padding: '8px 10px',
        textAlign: align as 'left' | 'right' | 'center',
        whiteSpace: 'nowrap',
        fontWeight: 500,
      }}
    >
      {children}
    </th>
  )
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: string }) {
  return (
    <td
      style={{
        fontFamily: LEXEND,
        fontSize: 13,
        color: COLORS.sec,
        padding: '10px 10px',
        textAlign: align as 'left' | 'right' | 'center',
      }}
    >
      {children}
    </td>
  )
}
