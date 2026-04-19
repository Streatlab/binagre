import { useMemo } from 'react'
import { useConfig } from '@/hooks/useConfig'
import type { EPS, Receta } from './types'
import { thCls, tdCls, fmtES, fmtEurES, fmtPctES, fmtDateES, n, semaforoUsos, semaforoClasses } from './types'

interface Props {
  epsList: EPS[]
  recetasList: Receta[]
  onOpenEps: (eps: EPS) => void
  onOpenReceta: (r: Receta) => void
}

/**
 * Fórmulas calcadas del Excel 01_ESCANDALLO hoja ÍNDICE
 * Lee estructura_pct de useConfig (si no hay, 30%)
 */
function calcIndice(costeRac: number, pvp: number, estructuraPct: number) {
  const estr = estructuraPct / 100
  const com = 0.30 // Uber Eats comisión fija para el Índice
  const neto = pvp > 0 ? pvp / 1.1 : 0
  const costeEstr = costeRac * 1.1 * estr
  const costePlatR = pvp * com
  const costePlatC = pvp * com * 1.21
  const costeTotR = costeRac + costeEstr + costePlatR
  const costeTotC = costeRac + costeEstr + costePlatC
  const margenR = neto - costeTotR
  const margenC = neto - costeTotC
  const pctR = neto > 0 ? (margenR / neto) * 100 : 0
  const pctC = neto > 0 ? (margenC / neto) * 100 : 0
  return { costeEstr, costeTotR, costeTotC, margenR, margenC, pctR, pctC }
}

const EMPTY = <span></span>

export default function TabIndice({ epsList, recetasList, onOpenEps, onOpenReceta }: Props) {
  const cfg = useConfig()

  const rows = useMemo(() => {
    const eps = epsList.map((e, i) => ({ kind: 'EPS' as const, idx: i + 1, data: e }))
    const rec = recetasList.map((r, i) => ({ kind: 'REC' as const, idx: epsList.length + i + 1, data: r }))
    return [...eps, ...rec]
  }, [epsList, recetasList])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Counter label="TOTAL" value={rows.length} />
        <Counter label="EPS" value={epsList.length} valueClass="eps" />
        <Counter label="RECETAS" value={recetasList.length} valueClass="rec" />
      </div>

      <div className="bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-xl overflow-hidden">
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
          <table style={{ tableLayout: 'fixed', width: '1290px' }}>
            <colgroup>
              <col style={{ width: 85 }} />
              <col style={{ width: 250 }} />
              <col style={{ width: 105 }} />
              <col style={{ width: 95 }} />
              <col style={{ width: 55 }} />
              <col style={{ width: 75 }} />
              <col style={{ width: 75 }} />
              <col style={{ width: 85 }} />
              <col style={{ width: 105 }} />
              <col style={{ width: 105 }} />
              <col style={{ width: 105 }} />
              <col style={{ width: 75 }} />
              <col style={{ width: 75 }} />
            </colgroup>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th className={thCls}>CÓDIGO</th>
                <th className={thCls}>NOMBRE</th>
                <th className={thCls + ' text-right'}>COSTE TANDA</th>
                <th className={thCls + ' text-right'}>COSTE/RAC</th>
                <th className={thCls + ' text-center'}>USOS</th>
                <th className={thCls + ' text-right'}>RACIONES</th>
                <th className={thCls + ' text-center'}>FECHA</th>
                <th className={thCls + ' text-right'}>PVP REAL</th>
                <th className={thCls + ' text-right'}>COSTE TOTAL</th>
                <th className={thCls + ' text-right'}>MARGEN € REAL</th>
                <th className={thCls + ' text-right'}>MARGEN € CASH</th>
                <th className={thCls + ' text-center'}>% REAL</th>
                <th className={thCls + ' text-center'}>% CASH</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const isEps = row.kind === 'EPS'
                const d = row.data
                const pvp = isEps ? 0 : n((d as Receta).pvp_uber)
                const costeRac = n(d.coste_rac)
                const calc = !isEps && pvp > 0 ? calcIndice(costeRac, pvp, cfg.estructura_pct) : null
                const usos = isEps ? n((d as EPS).usos) : 0
                const nameCls = isEps ? 'ds-eps-name' : 'ds-rec-name'
                const costeRacDecimals = isEps ? 4 : 2
                const fecha = 'fecha' in d ? d.fecha : null
                return (
                  <tr
                    key={`${row.kind}-${d.id}`}
                    onClick={() => isEps ? onOpenEps(d as EPS) : onOpenReceta(d as Receta)}
                    className="cursor-pointer hover:bg-[var(--sl-thead)] transition-colors"
                  >
                    <td className={tdCls + ' ' + nameCls + ' font-mono text-xs'}>{d.codigo ?? ''}</td>
                    <td className={tdCls + ' font-medium ' + nameCls}>
                      {d.nombre}
                    </td>
                    <td className={tdCls + ' text-right text-[var(--sl-text-secondary)]'}>{fmtEurES(d.coste_tanda, 2)}</td>
                    <td className={tdCls + ' text-right text-[var(--sl-text-primary)] font-semibold'}>{fmtEurES(costeRac, costeRacDecimals)}</td>
                    <td className={tdCls + ' text-center'}>
                      {isEps ? (
                        <span className={'inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ' + semaforoUsos(usos)}>{usos}</span>
                      ) : EMPTY}
                    </td>
                    <td className={tdCls + ' text-right'}>{d.raciones ? fmtES(d.raciones, 0) : EMPTY}</td>
                    <td className={tdCls + ' text-center text-[var(--sl-text-muted)] text-xs'}>{fecha ? fmtDateES(fecha) : ''}</td>

                    {/* Pricing — EPS completamente vacias */}
                    {isEps ? (
                      <>
                        <td className={tdCls}></td>
                        <td className={tdCls}></td>
                        <td className={tdCls}></td>
                        <td className={tdCls}></td>
                        <td className={tdCls}></td>
                        <td className={tdCls}></td>
                      </>
                    ) : calc ? (
                      <>
                        <td className={tdCls + ' text-right text-[var(--sl-text-primary)] font-medium'}>{fmtEurES(pvp, 2)}</td>
                        <td className={tdCls + ' text-right text-[var(--sl-text-secondary)]'}>{fmtEurES(calc.costeTotR, 2)}</td>
                        <td className={tdCls + ' text-right'}>{fmtEurES(calc.margenR, 2)}</td>
                        <td className={tdCls + ' text-right'}>{fmtEurES(calc.margenC, 2)}</td>
                        <td className={tdCls + ' text-center'}>
                          <span className={'inline-block px-2 py-0.5 rounded text-[11px] font-semibold ' + semaforoClasses(calc.pctR)}>
                            {fmtPctES(calc.pctR, 2)}
                          </span>
                        </td>
                        <td className={tdCls + ' text-center'}>
                          <span className={'inline-block px-2 py-0.5 rounded text-[11px] font-semibold ' + semaforoClasses(calc.pctC)}>
                            {fmtPctES(calc.pctC, 2)}
                          </span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={tdCls}></td>
                        <td className={tdCls}></td>
                        <td className={tdCls}></td>
                        <td className={tdCls}></td>
                        <td className={tdCls}></td>
                        <td className={tdCls}></td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Counter({ label, value, valueClass = '' }: { label: string; value: number; valueClass?: string }) {
  return (
    <div className="ds-counter" style={{ cursor: 'default' }}>
      <div className="label">{label}</div>
      <div className={'value' + (valueClass ? ' ' + valueClass : '')}>{value}</div>
    </div>
  )
}
