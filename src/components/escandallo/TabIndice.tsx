import { useMemo } from 'react'
import type { EPS, Receta } from './types'
import { thCls, tdCls, fmt, n, semaforoUsos, semaforoClasses, ESTRUCTURA_PCT, CANALES } from './types'

interface Props {
  epsList: EPS[]
  recetasList: Receta[]
  onOpenEps: (eps: EPS) => void
  onOpenReceta: (r: Receta) => void
}

/**
 * Calculos de margen para una receta (usando PVP Uber Eats por defecto con comision 30%).
 * Real: coste plataforma sin IVA. Cash: coste plataforma con IVA 21%.
 */
function calcMargenes(costeRac: number, pvp: number, comision: number) {
  if (pvp <= 0) return { costeTotalR: 0, costeTotalC: 0, margenR: 0, margenC: 0, pctR: 0, pctC: 0 }
  const neto = pvp / 1.1
  const estr = ESTRUCTURA_PCT * neto
  const platR = pvp * comision
  const platC = pvp * comision * 1.21
  const costeTotalR = costeRac + estr + platR
  const costeTotalC = costeRac + estr + platC
  const margenR = neto - costeTotalR
  const margenC = neto - costeTotalC
  const pctR = (margenR / neto) * 100
  const pctC = (margenC / neto) * 100
  return { costeTotalR, costeTotalC, margenR, margenC, pctR, pctC }
}

export default function TabIndice({ epsList, recetasList, onOpenEps, onOpenReceta }: Props) {
  const rows = useMemo(() => {
    const eps = epsList.map((e, i) => ({ kind: 'EPS' as const, idx: i + 1, data: e }))
    const rec = recetasList.map((r, i) => ({ kind: 'REC' as const, idx: epsList.length + i + 1, data: r }))
    return [...eps, ...rec]
  }, [epsList, recetasList])

  const uberCom = CANALES[0].comision

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Counter label="TOTAL" value={rows.length} />
        <Counter label="EPS" value={epsList.length} color="text-[#4a9eff]" />
        <Counter label="RECETAS" value={recetasList.length} color="text-accent" />
      </div>

      <div className="bg-card border border-[#333] rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-240px)] overflow-y-auto">
          <table className="w-full" style={{ minWidth: '1600px' }}>
            <thead className="sticky top-0 z-20">
              <tr>
                <th className={thCls + ' w-12 text-right'}>#</th>
                <th className={thCls} style={{ minWidth: 240 }}>NOMBRE</th>
                <th className={thCls + ' text-center w-20'}>ABRIR</th>
                <th className={thCls + ' text-right'}>COSTE TANDA</th>
                <th className={thCls + ' text-right'}>COSTE/RAC</th>
                <th className={thCls + ' text-center'}>USOS</th>
                <th className={thCls + ' text-right'}>RACIONES</th>
                <th className={thCls}>FECHA</th>
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
                const { costeTotalR, margenR, margenC, pctR, pctC } = calcMargenes(costeRac, pvp, uberCom)
                const usos = isEps ? n((d as EPS).usos) : 0
                const nameCls = isEps ? 'text-[#4a9eff] italic' : 'text-white'
                return (
                  <tr key={`${row.kind}-${d.id}`}
                    onClick={() => isEps ? onOpenEps(d as EPS) : onOpenReceta(d as Receta)}
                    className="cursor-pointer hover:bg-[#383838] transition-colors">
                    <td className={tdCls + ' text-right text-[#666]'}>{row.idx}</td>
                    <td className={tdCls + ' font-medium ' + nameCls}>
                      <span className="text-[10px] text-[#666] mr-2">[{row.kind}]</span>
                      {d.nombre}
                    </td>
                    <td className={tdCls + ' text-center'}>
                      <button
                        onClick={() => isEps ? onOpenEps(d as EPS) : onOpenReceta(d as Receta)}
                        className="text-xs px-2.5 py-1 rounded bg-accent/10 text-accent hover:bg-accent/20 transition font-semibold">
                        Abrir
                      </button>
                    </td>
                    <td className={tdCls + ' text-right text-[#aaa]'}>{fmt(d.coste_tanda, 4)}</td>
                    <td className={tdCls + ' text-right text-accent font-medium'}>{fmt(costeRac, 4)}</td>
                    <td className={tdCls + ' text-center'}>
                      {isEps ? (
                        <span className={'inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ' + semaforoUsos(usos)}>{usos}</span>
                      ) : <span className="text-[#666]">—</span>}
                    </td>
                    <td className={tdCls + ' text-right'}>{d.raciones ?? 0}</td>
                    <td className={tdCls + ' text-[#888] text-xs'}>{('fecha' in d ? d.fecha : null) ?? '—'}</td>
                    <td className={tdCls + ' text-right'}>{pvp > 0 ? fmt(pvp) : '—'}</td>
                    <td className={tdCls + ' text-right'}>{pvp > 0 ? fmt(costeTotalR) : '—'}</td>
                    <td className={tdCls + ' text-right'}>{pvp > 0 ? fmt(margenR) : '—'}</td>
                    <td className={tdCls + ' text-right'}>{pvp > 0 ? fmt(margenC) : '—'}</td>
                    <td className={tdCls + ' text-center'}>
                      {pvp > 0 ? (
                        <span className={'inline-block px-2 py-0.5 rounded text-[11px] font-semibold ' + semaforoClasses(pctR)}>
                          {pctR.toFixed(1)}%
                        </span>
                      ) : <span className="text-[#666]">—</span>}
                    </td>
                    <td className={tdCls + ' text-center'}>
                      {pvp > 0 ? (
                        <span className={'inline-block px-2 py-0.5 rounded text-[11px] font-semibold ' + semaforoClasses(pctC)}>
                          {pctC.toFixed(1)}%
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
    <div className="bg-card border border-[#333] rounded-lg px-4 py-2">
      <div className="text-[10px] text-[#888] uppercase tracking-wider">{label}</div>
      <div className={'text-lg font-bold tabular-nums ' + color}>{value}</div>
    </div>
  )
}
