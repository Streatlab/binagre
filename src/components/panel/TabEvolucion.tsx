/**
 * TabEvolucion — Panel Global · pestaña Evolución
 * Bloques añadidos (sin reescribir lo original):
 *   3.1 Peso tienda online (web + directa)
 *   3.4 Ticket medio (total_pedidos existe en BD)
 *   3.5 Mejor/peor día de semana
 *   3.6 Racha de objetivo (tabla objetivos, tipo='diario')
 * Omitidos por ausencia de datos:
 *   3.2 Ranking marcas (marca_id siempre NULL en facturacion_diario)
 *   3.3 Comida vs cena (sin granularidad horaria)
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, CARDS, lbl, kpiMid } from '@/components/panel/resumen/tokens'
import { fmtEur, fmtNum } from '@/utils/format'
import type { RowFacturacion } from '@/components/panel/resumen/types'

interface Props { rowsAll: RowFacturacion[] }

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const DIAS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const COMISIONES: Record<string, number> = {
  uber: 0.30, glovo: 0.30, je: 0.30, web: 0.07, directa: 0.00,
}
const CANALES_IDS = ['uber', 'glovo', 'je', 'web', 'directa'] as const

function netoDeRow(r: RowFacturacion): number {
  return CANALES_IDS.reduce((s, c) => {
    const bruto = (r as unknown as Record<string, number>)[`${c}_bruto`] ?? 0
    return s + bruto * (1 - COMISIONES[c])
  }, 0)
}

function kpiCard(label: string, value: string, sub?: string, valueColor?: string) {
  return (
    <div style={{ ...CARDS.std, flex: 1, minWidth: 160 }}>
      <div style={lbl}>{label}</div>
      <div style={{ ...kpiMid, marginTop: 6, color: valueColor ?? COLORS.pri }}>{value}</div>
      {sub && <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Bloque 3.1: Card Peso Tienda Online ─────────────────────
function CardPesoOnline({ rowsAll }: { rowsAll: RowFacturacion[] }) {
  // Serie últimos 12 meses
  const mesMap: Record<string, { total: number; online: number }> = {}
  rowsAll.forEach(r => {
    const key = r.fecha.slice(0, 7)
    if (!mesMap[key]) mesMap[key] = { total: 0, online: 0 }
    mesMap[key].total += r.total_bruto
    mesMap[key].online += (r.web_bruto ?? 0) + (r.directa_bruto ?? 0)
  })
  const keys = Object.keys(mesMap).sort().slice(-12)
  if (keys.length === 0) return null

  const ultimo = keys[keys.length - 1]
  const penultimo = keys.length >= 2 ? keys[keys.length - 2] : null

  const pctActual = mesMap[ultimo].total > 0
    ? (mesMap[ultimo].online / mesMap[ultimo].total) * 100 : 0
  const pctAnterior = penultimo && mesMap[penultimo].total > 0
    ? (mesMap[penultimo].online / mesMap[penultimo].total) * 100 : null
  const delta = pctAnterior !== null ? pctActual - pctAnterior : null

  const frase = delta !== null
    ? `La tienda online pesa ${pctActual.toFixed(1)}% (${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pts vs mes anterior)`
    : `La tienda online pesa ${pctActual.toFixed(1)}%`

  const [, mUlt] = ultimo.split('-')
  const yUlt = ultimo.split('-')[0]

  return (
    <div style={{ ...CARDS.std, border: `1.5px solid ${COLORS.directa}40`, marginBottom: 14 }}>
      <div style={lbl}>Peso tienda online (web + directa)</div>
      <div style={{ ...kpiMid, marginTop: 6, color: COLORS.directa }}>{pctActual.toFixed(1)}%</div>
      <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.sec, marginTop: 4 }}>{frase}</div>

      {/* Mini gráfico de barras mensual */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48, marginTop: 12, overflowX: 'auto' }}>
        {keys.map(k => {
          const pct = mesMap[k].total > 0 ? (mesMap[k].online / mesMap[k].total) * 100 : 0
          const h = Math.max(3, (pct / 100) * 44)
          const isActual = k === ultimo
          const [, m] = k.split('-')
          return (
            <div key={k} style={{ flex: 1, minWidth: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: '100%', height: h, background: isActual ? COLORS.directa : COLORS.directa + '55', borderRadius: '2px 2px 0 0' }} />
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 9, color: isActual ? COLORS.directa : COLORS.mut, textTransform: 'uppercase' }}>
                {MESES_ES[parseInt(m, 10) - 1]}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, marginTop: 4 }}>
        {MESES_ES[parseInt(mUlt, 10) - 1]} {yUlt}
      </div>
    </div>
  )
}

// ── Bloque 3.4: Card Ticket Medio ───────────────────────────
function CardTicketMedio({ rowsAll }: { rowsAll: RowFacturacion[] }) {
  // total_pedidos existe en BD — mostrar siempre
  const mesMap: Record<string, { bruto: number; pedidos: number }> = {}
  rowsAll.forEach(r => {
    const key = r.fecha.slice(0, 7)
    if (!mesMap[key]) mesMap[key] = { bruto: 0, pedidos: 0 }
    mesMap[key].bruto += r.total_bruto
    mesMap[key].pedidos += r.total_pedidos
  })
  const keys = Object.keys(mesMap).sort().slice(-12)
  if (keys.length === 0) return null

  const ultimo = keys[keys.length - 1]
  const penultimo = keys.length >= 2 ? keys[keys.length - 2] : null

  const tmActual = mesMap[ultimo].pedidos > 0 ? mesMap[ultimo].bruto / mesMap[ultimo].pedidos : 0
  const tmAnterior = penultimo && mesMap[penultimo].pedidos > 0
    ? mesMap[penultimo].bruto / mesMap[penultimo].pedidos : null
  const delta = tmAnterior !== null ? tmActual - tmAnterior : null
  const deltaColor = delta === null ? COLORS.mut : delta >= 0 ? COLORS.ok : COLORS.err
  const deltaStr = delta !== null ? `${delta >= 0 ? '+' : ''}${fmtEur(delta)} vs mes anterior` : ''

  // Serie mensual
  const maxTm = Math.max(...keys.map(k => mesMap[k].pedidos > 0 ? mesMap[k].bruto / mesMap[k].pedidos : 0), 1)

  return (
    <div style={{ ...CARDS.std, marginBottom: 14 }}>
      <div style={lbl}>Ticket medio mensual</div>
      <div style={{ ...kpiMid, marginTop: 6, color: COLORS.pri }}>{fmtEur(tmActual)}</div>
      {deltaStr && (
        <div style={{ fontFamily: FONT.body, fontSize: 12, color: deltaColor, marginTop: 2 }}>{deltaStr}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48, marginTop: 12, overflowX: 'auto' }}>
        {keys.map(k => {
          const tm = mesMap[k].pedidos > 0 ? mesMap[k].bruto / mesMap[k].pedidos : 0
          const h = maxTm > 0 ? Math.max(3, (tm / maxTm) * 44) : 3
          const isActual = k === ultimo
          const [, m] = k.split('-')
          return (
            <div key={k} style={{ flex: 1, minWidth: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: '100%', height: h, background: isActual ? COLORS.redSL : COLORS.redSL + '55', borderRadius: '2px 2px 0 0' }} />
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 9, color: isActual ? COLORS.redSL : COLORS.mut, textTransform: 'uppercase' }}>
                {MESES_ES[parseInt(m, 10) - 1]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Bloque 3.5: Mejor/Peor Día de Semana ────────────────────
function CardDiaSemana({ rowsAll }: { rowsAll: RowFacturacion[] }) {
  // Agrupar bruto por día de semana (0=Dom...6=Sáb)
  const diaMap: Record<number, { suma: number; count: number }> = {}
  for (let i = 0; i < 7; i++) diaMap[i] = { suma: 0, count: 0 }

  rowsAll.forEach(r => {
    const d = new Date(r.fecha + 'T00:00:00').getDay()
    diaMap[d].suma += r.total_bruto
    diaMap[d].count += 1
  })

  const medias = Object.entries(diaMap).map(([d, v]) => ({
    dia: parseInt(d),
    media: v.count > 0 ? v.suma / v.count : 0,
  })).filter(x => x.media > 0)

  if (medias.length === 0) return null

  const maxMedia = Math.max(...medias.map(x => x.media))
  const minMedia = Math.min(...medias.map(x => x.media))
  const mejor = medias.find(x => x.media === maxMedia)!
  const peor = medias.find(x => x.media === minMedia)!

  // Colores por día
  const DIA_COLORS: Record<number, string> = {
    0: COLORS.dom, 1: COLORS.lun, 2: COLORS.mar, 3: COLORS.mie,
    4: COLORS.jue, 5: COLORS.vie, 6: COLORS.sab,
  }

  return (
    <div style={{ ...CARDS.std, marginBottom: 14 }}>
      <div style={lbl}>Media por día de semana</div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, color: COLORS.ok, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 2 }}>Mejor</div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 600, color: COLORS.ok }}>{DIAS_ES[mejor.dia]}</div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut }}>{fmtEur(mejor.media)} / día</div>
        </div>
        <div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, color: COLORS.err, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 2 }}>Peor</div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 600, color: COLORS.err }}>{DIAS_ES[peor.dia]}</div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut }}>{fmtEur(peor.media)} / día</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 72, marginTop: 14 }}>
        {[1, 2, 3, 4, 5, 6, 0].map(d => {
          const { suma, count } = diaMap[d]
          const media = count > 0 ? suma / count : 0
          const h = maxMedia > 0 ? Math.max(3, (media / maxMedia) * 64) : 3
          const isMejor = d === mejor.dia
          const isPeor = d === peor.dia
          const barColor = isMejor ? COLORS.ok : isPeor ? COLORS.err : DIA_COLORS[d]
          return (
            <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: '100%', height: h, background: barColor, borderRadius: '3px 3px 0 0' }} />
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, color: isMejor ? COLORS.ok : isPeor ? COLORS.err : COLORS.mut, textTransform: 'uppercase' }}>
                {DIAS_ES[d].slice(0, 3)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Bloque 3.6: Racha de Objetivo ───────────────────────────
interface ObjetivoDia {
  anio: number
  mes: number
  importe: number
}

function CardRachaObjetivo({ rowsAll }: { rowsAll: RowFacturacion[] }) {
  const [objetivos, setObjetivos] = useState<ObjetivoDia[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('objetivos')
      .select('anio, mes, importe')
      .eq('tipo', 'diario')
      .then(({ data }) => {
        setObjetivos((data ?? []) as ObjetivoDia[])
        setLoading(false)
      })
  }, [])

  if (loading) return null
  if (objetivos.length === 0) return null // sin objetivo configurado → omitir

  // Construir mapa objetivo por YYYY-MM
  const objMap: Record<string, number> = {}
  objetivos.forEach(o => {
    const key = `${o.anio}-${String(o.mes).padStart(2, '0')}`
    objMap[key] = o.importe
  })

  // Ordenar filas por fecha desc y contar racha actual de días cumpliendo objetivo
  const sorted = [...rowsAll].sort((a, b) => b.fecha.localeCompare(a.fecha))
  let racha = 0
  for (const r of sorted) {
    const mesKey = r.fecha.slice(0, 7)
    const obj = objMap[mesKey]
    if (obj === undefined) break // sin objetivo para ese mes → romper racha
    if (r.total_bruto >= obj) {
      racha++
    } else {
      break
    }
  }

  // Encontrar el objetivo del último mes con datos
  const ultimaFecha = sorted[0]?.fecha
  const objActual = ultimaFecha ? objMap[ultimaFecha.slice(0, 7)] : undefined

  if (objActual === undefined) return null

  const rachaColor = racha >= 7 ? COLORS.ok : racha >= 3 ? COLORS.warn : COLORS.err
  const rachaLabel = racha === 0 ? 'Sin racha activa'
    : racha === 1 ? '1 día consecutivo'
    : `${racha} días consecutivos`

  return (
    <div style={{ ...CARDS.std, marginBottom: 14 }}>
      <div style={lbl}>Racha de objetivo diario</div>
      <div style={{ ...kpiMid, marginTop: 6, color: rachaColor }}>{fmtNum(racha)}</div>
      <div style={{ fontFamily: FONT.body, fontSize: 12, color: rachaColor, marginTop: 2 }}>{rachaLabel}</div>
      <div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, marginTop: 4 }}>
        Objetivo: {fmtEur(objActual)} / día
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────
export default function TabEvolucion({ rowsAll }: Props) {
  if (!rowsAll.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: COLORS.mut, fontFamily: FONT.body, fontSize: 14 }}>
        Sin datos históricos disponibles
      </div>
    )
  }

  // Agrupar por año-mes
  const mesMap: Record<string, { bruto: number; pedidos: number; neto: number }> = {}
  rowsAll.forEach(r => {
    const key = r.fecha.slice(0, 7) // YYYY-MM
    if (!mesMap[key]) mesMap[key] = { bruto: 0, pedidos: 0, neto: 0 }
    mesMap[key].bruto += r.total_bruto
    mesMap[key].pedidos += r.total_pedidos
    mesMap[key].neto += netoDeRow(r)
  })

  // Últimos 12 meses ordenados
  const todosMeses = Object.keys(mesMap).sort()
  const ultimos12 = todosMeses.slice(-12)

  // Mejor y peor mes (en bruto)
  const mejorMes = ultimos12.reduce((best, key) =>
    mesMap[key].bruto > mesMap[best].bruto ? key : best, ultimos12[0])
  const peorMes = ultimos12.reduce((worst, key) =>
    mesMap[key].bruto < mesMap[worst].bruto ? key : worst, ultimos12[0])

  // Mes actual (último en ultimos12)
  const mesActualKey = ultimos12[ultimos12.length - 1]
  const mesActual = mesMap[mesActualKey]

  // Mismo mes año anterior
  const [yActual, mActual] = mesActualKey.split('-')
  const mesAnteriorKey = `${parseInt(yActual) - 1}-${mActual}`
  const mesAnterior = mesMap[mesAnteriorKey]
  const tendenciaPct = mesAnterior && mesAnterior.bruto > 0
    ? ((mesActual.bruto - mesAnterior.bruto) / mesAnterior.bruto) * 100
    : null

  const maxBruto = Math.max(...ultimos12.map(k => mesMap[k].bruto), 1)

  const thStyle: React.CSSProperties = {
    fontFamily: 'Oswald, sans-serif',
    fontSize: 11,
    letterSpacing: '1.5px',
    color: COLORS.mut,
    textTransform: 'uppercase',
    fontWeight: 500,
    padding: '8px 10px',
    textAlign: 'left',
    borderBottom: `1px solid ${COLORS.brd}`,
  }

  const tdStyle: React.CSSProperties = {
    fontFamily: FONT.body,
    fontSize: 13,
    color: COLORS.sec,
    padding: '8px 10px',
    borderBottom: `1px solid ${COLORS.group}`,
  }

  const tdR: React.CSSProperties = { ...tdStyle, textAlign: 'right' }

  function fmtMesKey(key: string): string {
    const [y, m] = key.split('-')
    return `${MESES_ES[parseInt(m, 10) - 1]} ${y}`
  }

  const tendenciaColor = tendenciaPct === null ? COLORS.mut
    : tendenciaPct >= 0 ? COLORS.ok : COLORS.err

  const tendenciaStr = tendenciaPct === null ? 'Sin datos año anterior'
    : `${tendenciaPct >= 0 ? '+' : ''}${tendenciaPct.toFixed(1)}%`

  return (
    <div style={{ paddingTop: 12 }}>

      {/* 3.1 Peso tienda online — card destacada arriba */}
      <CardPesoOnline rowsAll={rowsAll} />

      {/* KPI cards originales */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        {kpiCard('Tendencia vs año ant.', tendenciaStr, fmtMesKey(mesActualKey), tendenciaColor)}
        {kpiCard('Mejor mes (12m)', fmtMesKey(mejorMes), fmtEur(mesMap[mejorMes].bruto))}
        {kpiCard('Peor mes (12m)', fmtMesKey(peorMes), fmtEur(mesMap[peorMes].bruto))}
      </div>

      {/* Gráfico de barras — evolución mensual */}
      <div style={{ ...CARDS.std, marginBottom: 14 }}>
        <div style={{ ...lbl, marginBottom: 16 }}>Evolución mensual — ventas brutas (últimos 12 meses)</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, overflowX: 'auto' }}>
          {ultimos12.map(key => {
            const { bruto } = mesMap[key]
            const h = maxBruto > 0 ? Math.max(4, (bruto / maxBruto) * 108) : 4
            const isMejor = key === mejorMes
            const isPeor = key === peorMes
            const barColor = isMejor ? COLORS.ok : isPeor ? COLORS.err : COLORS.redSL
            const [, m] = key.split('-')
            return (
              <div key={key} style={{ flex: 1, minWidth: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontFamily: FONT.body, fontSize: 10, color: COLORS.mut, textAlign: 'center' }}>
                  {fmtEur(bruto).replace(' €', '')}
                </span>
                <div style={{ width: '100%', height: h, background: barColor, borderRadius: '3px 3px 0 0' }} />
                <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, color: COLORS.mut, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {MESES_ES[parseInt(m, 10) - 1]}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 3.4 Ticket medio + 3.5 Día de semana + 3.6 Racha — fila de cards extras */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: '1 1 260px' }}><CardTicketMedio rowsAll={rowsAll} /></div>
        <div style={{ flex: '1 1 260px' }}><CardDiaSemana rowsAll={rowsAll} /></div>
        <div style={{ flex: '1 1 220px' }}><CardRachaObjetivo rowsAll={rowsAll} /></div>
      </div>

      {/* Tabla mensual */}
      <div style={CARDS.std}>
        <div style={{ ...lbl, marginBottom: 12 }}>Detalle mensual</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Mes</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Pedidos</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Bruto</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Neto est.</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Ticket medio</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>vs año ant.</th>
            </tr>
          </thead>
          <tbody>
            {[...ultimos12].reverse().map(key => {
              const { bruto, pedidos, neto } = mesMap[key]
              const ticket = pedidos > 0 ? bruto / pedidos : 0
              const [y, m] = key.split('-')
              const antKey = `${parseInt(y) - 1}-${m}`
              const ant = mesMap[antKey]
              const vsAnt = ant && ant.bruto > 0
                ? ((bruto - ant.bruto) / ant.bruto) * 100
                : null
              const isMejor = key === mejorMes
              const isPeor = key === peorMes
              return (
                <tr key={key} style={isMejor ? { background: COLORS.ok + '11' } : isPeor ? { background: COLORS.err + '11' } : undefined}>
                  <td style={tdStyle}>
                    {fmtMesKey(key)}
                    {isMejor && <span style={{ marginLeft: 8, fontSize: 10, color: COLORS.ok, fontFamily: 'Oswald, sans-serif' }}>MEJOR</span>}
                    {isPeor && <span style={{ marginLeft: 8, fontSize: 10, color: COLORS.err, fontFamily: 'Oswald, sans-serif' }}>PEOR</span>}
                  </td>
                  <td style={{ ...tdR, fontFamily: 'Oswald, sans-serif', color: COLORS.pri }}>{fmtNum(pedidos)}</td>
                  <td style={tdR}>{fmtEur(bruto)}</td>
                  <td style={{ ...tdR, color: COLORS.ok }}>{fmtEur(neto)}</td>
                  <td style={tdR}>{fmtEur(ticket)}</td>
                  <td style={{ ...tdR, fontFamily: 'Oswald, sans-serif', fontSize: 12, color: vsAnt === null ? COLORS.mut : vsAnt >= 0 ? COLORS.ok : COLORS.err }}>
                    {vsAnt === null ? '—' : `${vsAnt >= 0 ? '+' : ''}${vsAnt.toFixed(1)}%`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

    </div>
  )
}
