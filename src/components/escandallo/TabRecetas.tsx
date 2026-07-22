import { useEffect, useMemo, useState } from 'react'
import type { Receta } from './types'
import { fmtES, fmtDateES, n } from './types'
import { supabase } from '@/lib/supabase'
import { semaforoColor } from '@/styles/tokens'
import { calcNetoPorCanal, useConfigCanales } from '@/lib/panel/calcNetoPlataforma'
import { useConfig } from '@/hooks/useConfig'
import { INK, CREMA, OSW, LEX, AMA, GRANATE, GRIS, BLANCO } from '@/styles/neobrutal'
import { th, thR, thC, td, tdNum, tdCod, zebra, BAND } from './estilosTabla'
import CabeceraEscandallo from './CabeceraEscandallo'

interface Props { recetasList: Receta[]; busqueda?: string; onBuscar: (v: string) => void; onSelect: (r: Receta) => void; onNew?: () => void }

/** Canales visibles en tabla. Claves canónicas de calcNetoPorCanal
 *  (normalizarCanalId: 'just_eat'→'je', 'directa'→'dir'). */
const CANALES: Array<{ clave: string; campo: keyof Receta; label: string }> = [
  { clave: 'uber',    campo: 'pvp_uber',    label: 'UE' },
  { clave: 'glovo',   campo: 'pvp_glovo',   label: 'GL' },
  { clave: 'je',      campo: 'pvp_je',      label: 'JE' },
  { clave: 'web',     campo: 'pvp_web',     label: 'WEB' },
  { clave: 'dir',     campo: 'pvp_directa', label: 'DIR' },
]

/** Margen% por canal a nivel plato vía calcNetoPorCanal central (modo 'plato').
 *  Referencia fórmula: Notion 366c8b1f-6139-81a8-95a7-dd0abdf63a91
 */
function margenCanal(r: Receta, canal: string, pvp: number, configCanales: Record<string, any>, estructuraPct: number): number {
  if (pvp <= 0) return 0
  const { neto } = calcNetoPorCanal(canal, pvp, 1, { modo: 'plato', configCanales })
  if (neto <= 0) return 0
  const estr = estructuraPct > 1 ? estructuraPct / 100 : estructuraPct
  const estructura = estr * neto
  return ((neto - n(r.coste_rac) - estructura) / neto) * 100
}

export default function TabRecetas({ recetasList, busqueda = '', onBuscar, onSelect, onNew }: Props) {
  const configCanales = useConfigCanales()
  const { estructura_pct, estructura_fuente } = useConfig()
  const [ingsPorReceta, setIngsPorReceta] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('recetas_lineas').select('receta_id, ingrediente_nombre')
      const map: Record<string, string[]> = {}
      for (const l of data ?? []) {
        if (!l.receta_id) continue
        if (!map[l.receta_id]) map[l.receta_id] = []
        map[l.receta_id].push((l.ingrediente_nombre ?? '').toLowerCase())
      }
      setIngsPorReceta(map)
    }
    load()
  }, [recetasList])

  const filtered = useMemo(() => {
    let list = recetasList
    const q = busqueda.trim().toLowerCase()
    if (q) {
      list = list.filter(r =>
        (r.nombre ?? '').toLowerCase().includes(q) ||
        (r.codigo ?? '').toLowerCase().includes(q) ||
        (r.categoria ?? '').toLowerCase().includes(q) ||
        (ingsPorReceta[r.id] ?? []).some(ing => ing.includes(q))
      )
    }
    return list
  }, [recetasList, busqueda, ingsPorReceta])

  const margenMedio = useMemo(() => {
    const conPvp = filtered.filter(r => n(r.pvp_uber) > 0)
    if (!conPvp.length) return null
    const suma = conPvp.reduce((acc, r) => acc + margenCanal(r, 'uber', n(r.pvp_uber), configCanales, estructura_pct), 0)
    return suma / conPvp.length
  }, [filtered, configCanales, estructura_pct])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <CabeceraEscandallo
        titulo="Recetas"
        busqueda={busqueda}
        onBuscar={onBuscar}
        onNew={onNew}
        nuevoLabel="+ Nueva Receta"
        pills={[{ label: 'Total', value: recetasList.length }]}
      />

      <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '.5px', textTransform: 'uppercase', color: GRIS }}>
        Coste de estructura aplicado: {fmtES(estructura_pct, 1)}% · {estructura_fuente === 'running' ? 'Running real (3 meses)' : 'manual (Configuración)'}
      </div>

      {busqueda.trim() && (
        <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '.5px', textTransform: 'uppercase', color: GRIS }}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{busqueda}"
        </div>
      )}

      <div style={{ background: CREMA, border: `5px solid ${INK}`, boxShadow: `7px 7px 0 ${INK}` }}>
        {!filtered.length ? (
          <p style={{ color: GRIS, fontFamily: OSW, textAlign: 'center', padding: 40, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase' }}>
            Sin recetas
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'auto', width: '100%' }}>
              <thead>
                <tr>
                  <th style={th}>CÓDIGO</th>
                  <th style={th}>RECETA</th>
                  <th style={thR}>RAC.</th>
                  <th style={thR}>COSTE/RAC €</th>
                  <th style={thR}>PVP UE €</th>
                  {CANALES.map(c => <th key={c.clave} style={thC}>{c.label} %</th>)}
                  <th style={{ ...thC, borderRight: 'none' }}>FECHA</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => {
                  const mUber = margenCanal(r, 'uber', n(r.pvp_uber), configCanales, estructura_pct)
                  const hasPvpUber = n(r.pvp_uber) > 0
                  const band = hasPvpUber ? semaforoColor(mUber) : GRIS
                  const bg = zebra(idx)
                  return (
                    <tr key={r.id} onClick={() => onSelect(r)} style={{ cursor: 'pointer', background: bg }}>
                      <td style={{ ...tdCod, color: GRANATE, borderLeft: `${BAND}px solid ${band}` }}>{r.codigo ?? ''}</td>
                      <td style={td}>
                        <div style={{ fontFamily: LEX, fontSize: 15, fontWeight: 700, color: INK, lineHeight: 1.05, whiteSpace: 'normal' }}>{r.nombre}</div>
                        {(r.categoria || r.unidad) && (
                          <div style={{ fontFamily: OSW, fontSize: 12, fontWeight: 600, letterSpacing: '.3px', textTransform: 'uppercase', color: '#5a4f3a', marginTop: 1 }}>
                            {[r.categoria, r.unidad].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>
                      <td style={tdNum}>{r.raciones ? fmtES(r.raciones, 0) : ''}</td>
                      <td style={tdNum}>{fmtES(r.coste_rac, 2)}</td>
                      <td style={tdNum}>{hasPvpUber ? fmtES(r.pvp_uber, 2) : ''}</td>
                      {CANALES.map(c => {
                        const pvp = n(r[c.campo] as number | null | undefined)
                        if (pvp <= 0) {
                          return <td key={c.clave} style={{ ...td, textAlign: 'center' }}><span style={{ fontFamily: OSW, color: GRIS, fontSize: 13 }}>—</span></td>
                        }
                        const m = margenCanal(r, c.clave, pvp, configCanales, estructura_pct)
                        const col = semaforoColor(m)
                        return (
                          <td key={c.clave} style={{ ...td, padding: 0, textAlign: 'center' }}>
                            <div style={{ background: col, color: BLANCO, fontFamily: OSW, fontWeight: 700, fontSize: 15, padding: '6px 4px', borderLeft: `2px solid ${INK}`, borderRight: `2px solid ${INK}` }}>
                              {m.toFixed(0)}%
                            </div>
                          </td>
                        )
                      })}
                      <td style={{ ...td, textAlign: 'center', color: GRIS, fontSize: 13, fontFamily: OSW, borderRight: 'none' }}>{r.fecha ? fmtDateES(r.fecha) : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5 + CANALES.length - 1} style={{ background: INK, color: CREMA, fontFamily: OSW, fontWeight: 700, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase', padding: '9px 12px', borderTop: `5px solid ${INK}` }}>
                    {filtered.length} receta{filtered.length !== 1 ? 's' : ''} · margen medio Uber
                  </td>
                  <td style={{ background: INK, textAlign: 'center', borderTop: `5px solid ${INK}`, padding: 8 }}>
                    {margenMedio != null ? (
                      <span style={{ display: 'inline-block', background: AMA, color: INK, fontFamily: OSW, fontWeight: 700, fontSize: 18, border: `3px solid ${INK}`, padding: '6px 10px' }}>{margenMedio.toFixed(0)}%</span>
                    ) : <span style={{ color: CREMA, fontFamily: OSW }}>—</span>}
                  </td>
                  <td style={{ background: INK, borderTop: `5px solid ${INK}` }} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {!!filtered.length && (
          <div style={{ background: '#F7EACE', borderTop: `3px solid ${INK}`, padding: '10px 14px', display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: INK }}>Margen por canal (UE · GL · JE · WEB · DIR):</span>
            {[
              { c: semaforoColor(60), t: 'Sano · cubre gastos + margen (≥50%)' },
              { c: semaforoColor(20), t: 'Ajustado · cubre gastos (1–49%)' },
              { c: semaforoColor(0), t: 'Pierde dinero (≤0%)' },
            ].map((it, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: LEX, fontSize: 12, fontWeight: 600, color: INK }}>
                <span style={{ width: 14, height: 14, background: it.c, border: `2px solid ${INK}`, display: 'inline-block' }} />
                {it.t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
