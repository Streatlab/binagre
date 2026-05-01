/**
 * ColDiasPico — Ronda 7
 * R7-07: usar fechaDesde/fechaHasta del periodo seleccionado
 *        Si abarca varios meses → título muestra rango
 *        Si fechaDesde no se proporciona → fallback a mes/año
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtNum, fmtMes } from '@/lib/format'
import { COLOR, OSWALD, LEXEND, cardBig, lbl } from './tokens'

export interface DiaPico {
  idx: number
  nombre: string
  valor: number
  color: string
}

interface Props {
  dias: DiaPico[]
  media: number
  nombreMes?: string
  mes?: number
  año?: number
  fechaDesde?: Date
  fechaHasta?: Date
  onClickDia?: (idxDow: number) => void
}

const NOMBRES_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const POS_X_TEXTO = [35, 100, 165, 230, 295, 360, 425]
const POS_X_BARRA = [15, 80, 145, 210, 275, 340, 405]
const ETIQUETAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const SVG_BASE = 190
const SVG_MAX_H = 125

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ColDiasPico({ dias: diasProp, media: mediaProp, nombreMes, mes, año, fechaDesde, fechaHasta, onClickDia }: Props) {
  const [dias, setDias] = useState<DiaPico[]>(diasProp)
  const [media, setMedia] = useState(mediaProp)
  const [tituloPeriodo, setTituloPeriodo] = useState<string>('')

  useEffect(() => {
    let inicio: string
    let fin: string

    if (fechaDesde && fechaHasta) {
      inicio = toLocalDateStr(fechaDesde)
      fin = toLocalDateStr(fechaHasta)

      const mismoMes = fechaDesde.getMonth() === fechaHasta.getMonth() && fechaDesde.getFullYear() === fechaHasta.getFullYear()
      if (mismoMes) {
        setTituloPeriodo(fmtMes(fechaDesde.getMonth() + 1))
      } else {
        setTituloPeriodo(`${fmtMes(fechaDesde.getMonth() + 1)} – ${fmtMes(fechaHasta.getMonth() + 1)}`)
      }
    } else {
      const mesActual = mes ?? (new Date().getMonth() + 1)
      const añoActual = año ?? new Date().getFullYear()
      inicio = `${añoActual}-${String(mesActual).padStart(2, '0')}-01`
      const lastDay = new Date(añoActual, mesActual, 0).getDate()
      fin = `${añoActual}-${String(mesActual).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      setTituloPeriodo(fmtMes(mesActual) || nombreMes || 'Mes actual')
    }

    supabase
      .from('facturacion_diario')
      .select('fecha,total_bruto')
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) {
          const COLORES = [
            COLOR.diaLun, COLOR.diaMar, COLOR.diaMie, COLOR.diaJue,
            COLOR.diaVie, COLOR.diaSab, COLOR.diaDom,
          ]
          const vacios: DiaPico[] = NOMBRES_LARGOS.map((nombre, i) => ({
            idx: i, nombre, valor: 0, color: COLORES[i],
          }))
          setDias(vacios)
          setMedia(0)
          return
        }

        type Row = { fecha: string; total_bruto: number | null }
        const acum = [0, 0, 0, 0, 0, 0, 0]
        for (const r of data as Row[]) {
          const d = new Date(r.fecha + 'T12:00:00')
          const idx = (d.getDay() + 6) % 7
          acum[idx] += r.total_bruto ?? 0
        }

        const COLORES = [
          COLOR.diaLun, COLOR.diaMar, COLOR.diaMie, COLOR.diaJue,
          COLOR.diaVie, COLOR.diaSab, COLOR.diaDom,
        ]
        const nuevos: DiaPico[] = acum.map((v, i) => ({
          idx: i, nombre: NOMBRES_LARGOS[i], valor: v, color: COLORES[i],
        }))
        const validos = nuevos.filter(d => d.valor > 0)
        const med = validos.length > 0
          ? validos.reduce((a, d) => a + d.valor, 0) / validos.length
          : 0
        setDias(nuevos)
        setMedia(med)
      })
  }, [fechaDesde?.getTime(), fechaHasta?.getTime(), mes, año])

  useEffect(() => { if (!fechaDesde) setDias(diasProp) }, [diasProp])
  useEffect(() => { if (!fechaDesde) setMedia(mediaProp) }, [mediaProp])

  const max = Math.max(...dias.map(d => d.valor), 1)
  const validos = dias.filter(d => d.valor > 0)
  const conMax = [...validos].sort((a, b) => b.valor - a.valor)[0]
  const conMin = [...validos].sort((a, b) => a.valor - b.valor)[0]
  const sinDatos = validos.length === 0

  function altura(val: number): number {
    if (val <= 0) return 0
    const h = (val / max) * SVG_MAX_H
    return Math.max(30, h)
  }

  const mediaH = media > 0 && max > 0 ? Math.min((media / max) * SVG_MAX_H, SVG_MAX_H) : 0
  const mediaY = SVG_BASE - mediaH

  const titulo = `DÍAS PICO — ${tituloPeriodo} - Facturación Bruta`

  return (
    <div>
      <div style={{ ...lbl, marginBottom: 10, textTransform: 'none' }}>{titulo}</div>
      <div style={{ ...cardBig, padding: 18 }}>
        {sinDatos ? (
          <div style={{ textAlign: 'center', color: COLOR.textMut, fontSize: 12, fontFamily: LEXEND, padding: '40px 0' }}>
            Sin datos en este periodo
          </div>
        ) : (
          <svg viewBox="0 0 480 230" style={{ width: '100%', height: 'auto' }} xmlns="http://www.w3.org/2000/svg" fontFamily="Lexend, sans-serif">
            {dias.map((d, i) => (
              <text key={`v${i}`} x={POS_X_TEXTO[i]} y="20" fontSize="11" fill="#7a8090" textAnchor="middle" fontWeight={400}>
                {d.valor > 0 ? fmtNum(d.valor, 2) : ''}
              </text>
            ))}

            {dias.map((d, i) => {
              const h = altura(d.valor)
              return (
                <rect
                  key={`b${i}`}
                  x={POS_X_BARRA[i]}
                  y={SVG_BASE - h}
                  width="40"
                  height={h}
                  fill={d.valor > 0 ? d.color : COLOR.bordeClaro}
                  rx="2"
                  style={{ cursor: onClickDia ? 'pointer' : 'default' }}
                  onClick={() => onClickDia?.(d.idx)}
                />
              )
            })}

            {media > 0 && (
              <>
                <line
                  x1="15" y1={mediaY} x2="445" y2={mediaY}
                  stroke="#3a4050"
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                />
                <text x="445" y={mediaY - 6} fontSize="11" fill="#3a4050" fontWeight="500" textAnchor="end">
                  {`Media: ${fmtNum(media, 2)}`}
                </text>
              </>
            )}

            {dias.map((_d, i) => (
              <text key={`l${i}`} x={POS_X_TEXTO[i]} y="210" fontSize="12" fill={COLOR.textMut} textAnchor="middle">
                {ETIQUETAS[i]}
              </text>
            ))}
          </svg>
        )}

        <div style={{ borderTop: `0.5px solid ${COLOR.borde}`, marginTop: 14, paddingTop: 12 }}>
          <Linea
            label="Día más fuerte"
            valor={conMax ? `${NOMBRES_LARGOS[conMax.idx]} · ${fmtNum(conMax.valor, 2)}` : '—'}
          />
          <Linea
            label="Día más flojo"
            valor={conMin ? `${NOMBRES_LARGOS[conMin.idx]} · ${fmtNum(conMin.valor, 2)}` : '—'}
          />
          <Linea label="Media diaria" valor={fmtNum(media, 2)} />
        </div>
      </div>
    </div>
  )
}

function Linea({ label, valor }: { label: string; valor: string }) {
  return (
    <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontFamily: LEXEND }}>
      <span style={{ color: COLOR.textMut }}>{label}</span>
      <span style={{ color: COLOR.textSec }}>{valor}</span>
    </div>
  )
}
