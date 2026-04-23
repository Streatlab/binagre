import { useMemo, type CSSProperties } from 'react'
import { useTheme, FONT } from '@/styles/tokens'
import { fmtEur } from '@/utils/format'
import { normalizarConcepto } from '@/lib/normalizarConcepto'
import type { GastoRaw } from '@/hooks/useRunning'

interface Props {
  periodoLabel: string
  gastos: GastoRaw[]
}

interface Row { nombre: string; total: number; count: number }

function proveedorKey(g: GastoRaw): string {
  if (g.proveedor && g.proveedor.trim()) return g.proveedor.trim().toLowerCase()
  const norm = normalizarConcepto(g.concepto ?? '')
  return norm || (g.concepto ?? '').toLowerCase().slice(0, 20)
}

function proveedorLabel(g: GastoRaw): string {
  if (g.proveedor && g.proveedor.trim()) return g.proveedor.trim()
  const norm = normalizarConcepto(g.concepto ?? '')
  if (norm) return norm.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return (g.concepto ?? '(sin concepto)').slice(0, 30)
}

export default function TopProveedoresCard({ periodoLabel, gastos }: Props) {
  const { T } = useTheme()

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>()
    for (const g of gastos) {
      const k = proveedorKey(g)
      if (!k) continue
      const acc = map.get(k) ?? { nombre: proveedorLabel(g), total: 0, count: 0 }
      acc.total += Number(g.importe) || 0
      acc.count += 1
      map.set(k, acc)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 10)
  }, [gastos])

  const max = rows[0]?.total ?? 1
  const wrap: CSSProperties = {
    backgroundColor: T.card, border: `1px solid ${T.brd}`, borderRadius: 14,
    padding: '20px 22px', display: 'flex', flexDirection: 'column', height: '100%',
  }
  const labelStyle: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 11, color: T.mut, letterSpacing: 1.3,
    textTransform: 'uppercase', fontWeight: 500, marginBottom: 14,
  }

  return (
    <div style={wrap}>
      <div style={labelStyle}>Ranking de gastos · {periodoLabel}</div>
      {rows.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>
          Sin gastos en este periodo
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r, i) => {
            const pct = max > 0 ? (r.total / max) * 100 : 0
            return (
              <div key={r.nombre} style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 10, alignItems: 'center' }}>
                <span style={{
                  fontFamily: FONT.heading, fontSize: 11, color: T.mut,
                  fontWeight: 600, textAlign: 'right', letterSpacing: 0.3,
                }}>
                  #{i + 1}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontFamily: FONT.body, fontSize: 12.5, color: T.pri, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.nombre}
                    </span>
                    <span style={{ fontFamily: FONT.body, fontSize: 10, color: T.mut, flexShrink: 0 }}>
                      {r.count} {r.count === 1 ? 'compra' : 'compras'}
                    </span>
                  </div>
                  <div style={{ height: 3, background: T.bg, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#E8440A', borderRadius: 2 }} />
                  </div>
                </div>
                <span style={{ fontFamily: FONT.heading, fontSize: 12.5, color: T.pri, fontWeight: 500, letterSpacing: 0.3, minWidth: 62, textAlign: 'right' }}>
                  {fmtEur(r.total)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
