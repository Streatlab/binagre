/**
 * ColFacturacionCanal — fórmula unificada
 * - Si hay OCR con neto_real_cobrado: usa ese valor (es el real cobrado)
 * - Si no hay OCR o falta: usa el neto del prop canales (ya calculado con fórmula completa en TabResumen vía calcNetoPorCanal)
 * - Nunca calcula con fórmula simple (sin fees periódicos)
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtPct } from '@/lib/format'
import { COLOR, OSWALD, LEXEND, lbl, lblXs } from './tokens'
import type { CanalStat } from './types'

interface Props {
  canales: CanalStat[]
  mes?: number
  año?: number
}

interface DatosCanal {
  bruto: number | null
  neto: number | null
  margenPct: number | null
  sinDatos: boolean
  fuente: 'ocr_real' | 'calculado' | 'sin_datos'
}

type CanalId = 'uber' | 'glovo' | 'just_eat' | 'web' | 'directa'

async function getNetoRealOCR(canal: CanalId, mes: number, año: number): Promise<{ bruto: number; neto: number } | null> {
  const denorm: Record<CanalId, string[]> = {
    uber: ['uber'], glovo: ['glovo'], just_eat: ['je','just_eat','justeat'], web: ['web'], directa: ['dir','directa'],
  }
  const lastDay = new Date(año, mes, 0).getDate()
  const ini = `${año}-${String(mes).padStart(2,'0')}-01`
  const fin = `${año}-${String(mes).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
  const { data, error } = await supabase
    .from('ventas_plataforma')
    .select('bruto, neto, plataforma')
    .gte('fecha_fin_periodo', ini)
    .lte('fecha_fin_periodo', fin)

  if (error || !data || data.length === 0) return null

  type Row = { bruto: number | null; neto: number | null; plataforma: string | null }
  const acept = denorm[canal]
  const rows = (data as Row[]).filter(d => acept.includes((d.plataforma ?? '').toLowerCase().trim()))
  const tieneRealCobrado = rows.some(d => d.neto !== null && d.neto !== undefined)
  if (!tieneRealCobrado) return null

  const bruto = rows.reduce((s, d) => s + (d.bruto ?? 0), 0)
  const neto = rows.reduce((s, d) => s + (d.neto ?? 0), 0)
  return { bruto, neto }
}

const CANAL_MAP: Record<string, CanalId> = {
  uber: 'uber',
  glovo: 'glovo',
  je: 'just_eat',
  web: 'web',
  dir: 'directa',
}

export default function ColFacturacionCanal({ canales, mes, año }: Props) {
  const mesActual = mes ?? (new Date().getMonth() + 1)
  const añoActual = año ?? new Date().getFullYear()
  const [ocrReales, setOcrReales] = useState<Record<string, { bruto: number; neto: number } | null>>({})

  useEffect(() => {
    const canalesIds: Array<CanalId> = ['uber', 'glovo', 'just_eat', 'web', 'directa']
    Promise.all(
      canalesIds.map(async (c) => {
        const real = await getNetoRealOCR(c, mesActual, añoActual)
        return [c, real] as [CanalId, { bruto: number; neto: number } | null]
      })
    ).then(results => {
      const out: Record<string, { bruto: number; neto: number } | null> = {}
      for (const [k, v] of results) out[k] = v
      setOcrReales(out)
    })
  }, [mesActual, añoActual])

  const map = new Map(canales.map(c => [c.id, c]))

  function getDatos(id: string): DatosCanal {
    const tableKey = CANAL_MAP[id]
    const ocr = tableKey ? ocrReales[tableKey] : undefined
    if (ocr) {
      const margenPct = ocr.bruto > 0 ? (ocr.neto / ocr.bruto) * 100 : 0
      return { bruto: ocr.bruto, neto: ocr.neto, margenPct, sinDatos: false, fuente: 'ocr_real' }
    }
    const c = map.get(id as CanalStat['id'])
    if (c && c.bruto > 0) {
      return { bruto: c.bruto, neto: c.neto, margenPct: c.margen, sinDatos: false, fuente: 'calculado' }
    }
    return { bruto: null, neto: null, margenPct: null, sinDatos: true, fuente: 'sin_datos' }
  }

  const uber  = getDatos('uber')
  const glovo = getDatos('glovo')
  const je    = getDatos('je')
  const web   = getDatos('web')
  const dir   = getDatos('dir')

  return (
    <div>
      <div style={{ ...lbl, marginBottom: 10 }}>FACTURACIÓN POR CANAL</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        <CardCanal
          label="UBER EATS"
          bg={`${COLOR.uber}20`}
          border={COLOR.uber}
          colorLabel={COLOR.verdeOscuro}
          datos={uber}
        />

        <CardCanal
          label="GLOVO"
          bg={`${COLOR.glovo}30`}
          border="rgba(200,180,0,0.30)"
          borderWidth="1px"
          colorLabel={COLOR.glovoDark}
          datos={glovo}
        />

        <CardCanal
          label="JUST EAT"
          bg={`${COLOR.je}20`}
          border={COLOR.je}
          colorLabel={COLOR.jeDark}
          datos={je}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <CardCanalMini
            label="WEB"
            bg={`${COLOR.webSL}10`}
            border={`${COLOR.webSL}50`}
            colorLabel={COLOR.webDark}
            datos={web}
          />
          <CardCanalMini
            label="DIRECTA"
            bg={`${COLOR.directa}20`}
            border={COLOR.directa}
            colorLabel={COLOR.directaDark}
            datos={dir}
          />
        </div>
      </div>
    </div>
  )
}

interface CardCanalProps {
  label: string
  bg: string
  border: string
  borderWidth?: string
  boxShadow?: string
  colorLabel: string
  datos: DatosCanal
}

function CardCanal({ label, bg, border, borderWidth = '0.5px', boxShadow, colorLabel, datos }: CardCanalProps) {
  const tieneDatos = !datos.sinDatos && datos.bruto !== null
  const brutoVal = tieneDatos ? datos.bruto! : 0
  const netoVal = tieneDatos ? (datos.neto ?? 0) : 0
  const margenVal = tieneDatos ? (datos.margenPct ?? 0) : 0

  return (
    <div style={{
      background: bg,
      border: `${borderWidth} solid ${border}`,
      boxShadow: boxShadow ?? undefined,
      borderRadius: 14,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <div>
        <div style={{ ...lblXs, color: colorLabel }}>{label}</div>
        <div style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 600, color: '#111111', marginTop: 2 }}>
          {fmtEur(brutoVal, { showEuro: false, decimals: 2 })}
        </div>
        <div style={{ fontSize: 11, color: '#3a4050', fontFamily: LEXEND }}>Bruto</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 600, color: COLOR.verde }}>
          {fmtEur(netoVal, { showEuro: false, decimals: 2 })}
        </div>
        <div style={{ fontSize: 14, color: COLOR.verde, fontFamily: LEXEND }}>
          {`Margen ${fmtPct(margenVal, 2)}`}
        </div>
      </div>
    </div>
  )
}

function CardCanalMini({ label, bg, border, colorLabel, datos }: Omit<CardCanalProps, 'colorBruto'>) {
  const tieneDatos = !datos.sinDatos && datos.bruto !== null
  const brutoVal = tieneDatos ? datos.bruto! : 0
  const netoVal = tieneDatos ? (datos.neto ?? 0) : 0
  const margenVal = tieneDatos ? (datos.margenPct ?? 0) : 0

  return (
    <div style={{
      background: bg,
      border: `0.5px solid ${border}`,
      borderRadius: 14,
      padding: '10px 12px',
    }}>
      <div style={{ ...lblXs, color: colorLabel }}>{label}</div>
      <div style={{ fontFamily: OSWALD, fontSize: 15, fontWeight: 600, color: '#111111', marginTop: 2 }}>
        {fmtEur(brutoVal, { showEuro: false, decimals: 2 })}
      </div>
      <div style={{ fontSize: 10, color: COLOR.textMut, fontFamily: LEXEND }}>
        {`${fmtEur(netoVal, { showEuro: false, decimals: 2 })} neto · ${fmtPct(margenVal, 2)}`}
      </div>
    </div>
  )
}
