import { useState, type CSSProperties } from 'react'
import {
  COLOR, OSWALD, LEXEND, card, lbl, lblSm, editable,
  semaforoCumplGrupo,
} from './tokens'
import { fmtEur } from '@/lib/format'

export type GrupoGasto = 'producto' | 'equipo' | 'local' | 'controlables'

interface GrupoData {
  gasto: number
  presupuesto: number
  /** Para Producto: food cost = COGS/Netos. Para resto: % s/netos */
  pctSobreNetos: number
}

interface Props {
  data: Record<GrupoGasto, GrupoData>
  onSavePresupuesto: (grupo: GrupoGasto, valor: number | null) => Promise<void>
  onToast: (msg: string, type: 'success' | 'warning') => void
}

const GRUPOS: { id: GrupoGasto; label: string; sub: string; banda: string; subRightLabel: string }[] = [
  { id: 'producto',     label: 'PRODUCTO · COGS',  sub: 'food cost',      banda: 'Banda 25-30%', subRightLabel: 'food cost' },
  { id: 'equipo',       label: 'EQUIPO · LABOR',   sub: '% s/netos',      banda: 'Banda 30-35%', subRightLabel: '% s/netos' },
  { id: 'local',        label: 'LOCAL · OCCUPANCY',sub: '% s/netos',      banda: 'Banda 5-10%',  subRightLabel: '% s/netos' },
  { id: 'controlables', label: 'CONTROLABLES · OPEX', sub: '% s/netos',   banda: 'Banda 13-18%', subRightLabel: '% s/netos' },
]

export default function ColGruposGasto({ data, onSavePresupuesto, onToast }: Props) {
  const [editing, setEditing] = useState<GrupoGasto | null>(null)
  const [editVal, setEditVal] = useState<string>('')

  function startEdit(g: GrupoGasto) {
    setEditing(g)
    setEditVal(String(data[g].presupuesto))
  }

  async function commit(g: GrupoGasto) {
    const trimmed = editVal.trim()
    if (trimmed === '') {
      await onSavePresupuesto(g, null)
      onToast('Restaurado', 'warning')
    } else {
      const num = parseFloat(trimmed.replace(',', '.'))
      if (!isNaN(num) && num > 0) {
        await onSavePresupuesto(g, num)
        onToast('Objetivo actualizado', 'success')
      }
    }
    setEditing(null)
  }

  return (
    <div>
      <div style={{ ...lbl, marginBottom: 10 }}>GRUPOS DE GASTO · CONSUMO vs PRESUPUESTO</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {GRUPOS.map(g => {
          const d = data[g.id]
          const pctCumpl = d.presupuesto > 0 ? Math.round((d.gasto / d.presupuesto) * 100) : 0
          const semCumpl = semaforoCumplGrupo(pctCumpl)
          const colorCumpl = semCumpl
          const desv = d.gasto - d.presupuesto
          const semDesv = desv > 0 ? COLOR.rojo : COLOR.verde
          const semSub = (() => {
            // Banda específica para color del food cost / % s/netos del header derecho
            const p = d.pctSobreNetos
            if (g.id === 'producto') return p >= 25 && p <= 30 ? COLOR.verde : (p > 30 ? COLOR.rojo : COLOR.ambar)
            if (g.id === 'equipo')   return p >= 30 && p <= 35 ? COLOR.verde : (p > 35 ? COLOR.rojo : COLOR.ambar)
            if (g.id === 'local')    return p >= 5  && p <= 10 ? COLOR.verde : (p > 10 ? COLOR.rojo : COLOR.ambar)
            return p >= 13 && p <= 18 ? COLOR.verde : (p > 18 ? COLOR.rojo : COLOR.ambar)
          })()

          const isEditing = editing === g.id
          const filled = Math.min(pctCumpl, 100)
          const remaining = Math.max(0, 100 - pctCumpl)
          const overflow = pctCumpl > 100

          return (
            <div key={g.id} style={{ ...card, padding: '12px 14px 14px 14px', overflow: 'visible' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={lblSm}>{g.label}</div>
                {g.id === 'producto' && (
                  <div style={{ fontSize: 11, color: COLOR.textMut, fontFamily: LEXEND }}>
                    Food Cost{' '}
                    <span style={{ color: COLOR.verde, fontWeight: 500 }}>{d.pctSobreNetos.toFixed(0)}%</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                <div>
                  <span style={{ fontFamily: OSWALD, fontSize: 18, fontWeight: 600, color: COLOR.textPri }}>
                    {fmtEur(d.gasto, { decimals: 0 })}
                  </span>
                  <span style={{ fontSize: 12, color: COLOR.textMut, fontFamily: LEXEND }}>
                    {' / '}
                    {isEditing ? (
                      <input
                        autoFocus
                        type="number"
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        onBlur={() => commit(g.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commit(g.id)
                          if (e.key === 'Escape') setEditing(null)
                        }}
                        style={{
                          width: 90, padding: '1px 6px', borderRadius: 4,
                          border: `1px solid ${COLOR.rojoAccent}`, background: '#fff',
                          fontFamily: OSWALD, fontSize: 13, color: COLOR.textPri, outline: 'none',
                        }}
                      />
                    ) : (
                      <span
                        style={editable as CSSProperties}
                        onClick={() => startEdit(g.id)}
                        title="Click para editar presupuesto"
                      >
                        {fmtEur(d.presupuesto, { decimals: 0 })}
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: semCumpl, fontWeight: 500, fontFamily: LEXEND }}>
                  {pctCumpl}%
                </div>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: COLOR.bordeClaro, overflow: 'hidden', display: 'flex', margin: '6px 0 4px' }}>
                {overflow ? (
                  <div style={{ height: '100%', width: '100%', background: COLOR.rojo, transition: 'width 0.5s ease' }} />
                ) : (
                  <>
                    <div style={{ height: '100%', width: `${filled}%`, background: colorCumpl, transition: 'width 0.5s ease' }} />
                    <div style={{ height: '100%', width: `${remaining}%`, background: COLOR.rojo }} />
                  </>
                )}
              </div>
              <div style={{ fontSize: 10, color: COLOR.textMut, display: 'flex', justifyContent: 'space-between', fontFamily: LEXEND }}>
                <span></span>
                <span style={{ color: desv < 0 ? COLOR.verde : COLOR.rojo }}>
                  {desv < 0 ? '' : '+'}{fmtEur(Math.abs(desv), { decimals: 0 })} desv
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
