import { useMemo } from 'react'
import type { EPS, Receta } from './types'
import { thCls, tdCls, fmtES, fmtEurES, fmtPctES, fmtDateES, n, semaforoUsos, semaforoClasses } from './types'

interface Props {
  epsList: EPS[]
  recetasList: Receta[]
  onOpenEps: (eps: EPS) => void
  onOpenReceta: (r: Receta) => void
}

/**
 * Formulas exactas del Excel 01_ESCANDALLO / hoja INDICE:
 *   Coste estructura = coste_rac * 1.1 * 0.30
 *   Coste plataforma Real = pvp_uber * 0.30
 *   Coste plataforma Cash = pvp_uber * 0.30 * 1.21
 *   Coste total Real = coste_rac + coste_estructura + coste_plataforma_real
 *   Margen € Real = pvp_uber/1.1 − coste_total_real
 *   % Real = Margen € Real / (pvp_uber/1.1)
 *   Margen € Cash = pvp_uber/1.1 − (coste_rac + coste_estructura + coste_plataforma_cash)
 *   % Cash = Margen € Cash / (pvp_uber/1.1)
 */
function calcIndice(costeRac: number, pvp: number) {
  const neto = pvp > 0 ? pvp / 1.1 : 0
  const costeEstr = costeRac * 1.1 * 0.30
  const costePlatR = pvp * 0.30
  const costePlatC = pvp * 0.30 * 1.21
  const costeTotR = costeRac + costeEstr + costePlatR
  const costeTotC = costeRac + costeEstr + costePlatC
  const margenR = neto - costeTotR
  const margenC = neto - costeTotC
  const pctR = neto > 0 ? (margenR / neto) * 100 : 0
  const pctC = neto > 0 ? (margenC / neto) * 100 : 0
  return { costeEstr, costeTotR, costeTotC, margenR, margenC, pctR, pctC }
}

export default function TabIndice({ epsList, recetasList, onOpenEps, onOpenReceta }: Props) {
  const rows = useMemo(() => {
    const eps = epsList.map((e, i) => ({ kind: 'EPS' as const, idx: i + 1, data: e }))
    const rec = recetasList.map((r, i) => ({ kind: 'REC' as const, idx: epsList.length + i + 1, data: r }))
    return [...eps, ...rec]
  }, [epsList, recetasList])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Counter label="TOTAL" value={rows.length} />
        <Counter label="EPS" value={epsList.length} color="text-[#4a9eff]" />
        <Counter label="RECETAS" value={recetasList.length} color="text-accent" />
      </div>

      <div className="bg-card border border-[#444] rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-240px)] overflow-y-auto">
          <table className="w-full" style={{ minWidth: '1600px' }}>
            <thead className="sticky top-0 z-20">
              <tr>
                <th className={thCls + ' w-12 text-right'}>#</th>
                <th className={thCls} style={{ minWidth: 260 }}>NOMBRE</th>
                <th className={thCls + ' text-center w-16'}>ABRIR</th>
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
                const calc = !isEps ? calcIndice(costeRac, pvp) : null
                const usos = isEps ? n((d as EPS).usos) : 0
                const nameCls = isEps ? 'text-[#4a9eff] italic' : 'text-white'
                const costeRacDecimals = isEps ? 4 : 2
                return (
                  <tr
                    key={`${row.kind}-${d.id}`}
                    onClick={() => isEps ? onOpenEps(d as EPS) : onOpenReceta(d as Receta)}
                    className="cursor-pointer hover:bg-[#383838] transition-colors"
                  >
                    <td className={tdCls + ' text-right text-[#666]'}>{row.idx}</td>
                    <td className={tdCls + ' font-medium ' + nameCls}>
                      <span className="text-[10px] text-[#666] mr-2">[{row.kind}]</span>
                      {d.nombre}
                    </td>
                    <td className={tdCls + ' text-center text-accent text-base'}>→</td>
                    <td className={tdCls + ' text-right text-[#aaa]'}>{fmtEurES(d.coste_tanda, 2)}</td>
                    <td className={tdCls + ' text-right text-accent font-medium'}>{fmtEurES(costeRac, costeRacDecimals)}</td>
                    <td className={tdCls + ' text-center'}>
                      {isEps ? (
                        <span className={'inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ' + semaforoUsos(usos)}>{usos}</span>
                      ) : <span className="text-[#666]">—</span>}
                    </td>
                    <td className={tdCls + ' text-right'}>{d.raciones ? fmtES(d.raciones, 0) : '—'}</td>
                    <td className={tdCls + ' text-center text-[#888] text-xs'}>{fmtDateES('fecha' in d ? d.fecha : null)}</td>
                    <td className={tdCls + ' text-right'}>{pvp > 0 ? fmtEurES(pvp, 2) : '—'}</td>
                    <td className={tdCls + ' text-right'}>{calc && pvp > 0 ? fmtEurES(calc.costeTotR, 2) : '—'}</td>
                    <td className={tdCls + ' text-right'}>{calc && pvp > 0 ? fmtEurES(calc.margenR, 2) : '—'}</td>
                    <td className={tdCls + ' text-right'}>{calc && pvp > 0 ? fmtEurES(calc.margenC, 2) : '—'}</td>
                    <td className={tdCls + ' text-center'}>
                      {calc && pvp > 0 ? (
                        <span className={'inline-block px-2 py-0.5 rounded text-[11px] font-semibold ' + semaforoClasses(calc.pctR)}>
                          {fmtPctES(calc.pctR, 2)}
                        </span>
                      ) : <span className="text-[#666]">—</span>}
                    </td>
                    <td className={tdCls + ' text-center'}>
                      {calc && pvp > 0 ? (
                        <span className={'inline-block px-2 py-0.5 rounded text-[11px] font-semibold ' + semaforoClasses(calc.pctC)}>
                          {fmtPctES(calc.pctC, 2)}
                        </span>
                      ) : <span className="text-[#666]">—</span>}
                    </td>
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

function Counter({ label, value, color = 'text-white' }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-card border border-[#444] rounded-lg px-4 py-2">
      <div className="text-[10px] text-[#888] uppercase tracking-wider">{label}</div>
      <div className={'text-lg font-bold tabular-nums ' + color}>{value}</div>
    </div>
  )
}
