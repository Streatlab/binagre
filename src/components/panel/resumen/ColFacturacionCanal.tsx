/**
 * ColFacturacionCanal — Fixes 43-51
 * FIX 43: bruto+neto fontSize 24 fontWeight 600
 * FIX 44: fmtEur(bruto, {showEuro:false, decimals:2})
 * FIX 45: fmtEur(neto, {showEuro:false, decimals:2})
 * FIX 46: "Margen X,XX%"
 * FIX 47: "Bruto" con B mayúscula
 * FIX 48: Glovo border 1px solid #5a5500
 * FIX 49-51: calcularDatosCanal desde resumenes_plataforma_marca_mensual (pasado como prop)
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
}

type CanalId = 'uber' | 'glovo' | 'just_eat' | 'web' | 'directa'

async function calcularDatosCanal(canal: CanalId, mes: number, año: number): Promise<DatosCanal> {
  const { data, error } = await supabase
    .from('resumenes_plataforma_marca_mensual')
    .select('bruto, comisiones, fees, cargos_promocion, neto_real_cobrado')
    .eq('plataforma', canal)
    .eq('mes', mes)
    .eq('año', año)

  if (error || !data || data.length === 0) {
    return { bruto: null, neto: null, margenPct: null, sinDatos: true }
  }

  type Row = { bruto: number | null; comisiones: number | null; fees: number | null; cargos_promocion: number | null; neto_real_cobrado: number | null }
  const rows = data as Row[]

  const bruto = rows.reduce((s, d) => s + (d.bruto ?? 0), 0)
  const tieneRealCobrado = rows.some(d => d.neto_real_cobrado !== null && d.neto_real_cobrado !== undefined)

  let neto: number
  if (tieneRealCobrado) {
    neto = rows.reduce((s, d) => s + (d.neto_real_cobrado ?? 0), 0)
  } else {
    const comisiones = rows.reduce((s, d) => s + (d.comisiones ?? 0), 0)
    const fees = rows.reduce((s, d) => s + (d.fees ?? 0), 0)
    const cargos = rows.reduce((s, d) => s + (d.cargos_promocion ?? 0), 0)
    const ivaComisiones = (comisiones + fees + cargos) * 0.21
    neto = bruto - comisiones - fees - cargos - ivaComisiones
  }

  const margenPct = bruto > 0 ? (neto / bruto) * 100 : 0
  return { bruto, neto, margenPct, sinDatos: false }
}

// Mapping de id canal stats → id tabla
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

  const [datosTabla, setDatosTabla] = useState<Record<string, DatosCanal>>({})

  useEffect(() => {
    const canalesIds: Array<CanalId> = ['uber', 'glovo', 'just_eat', 'web', 'directa']
    Promise.all(
      canalesIds.map(async (c) => {
        const d = await calcularDatosCanal(c, mesActual, añoActual)
        return [c, d] as [CanalId, DatosCanal]
      })
    ).then(results => {
      const out: Record<string, DatosCanal> = {}
      for (const [k, v] of results) out[k] = v
      setDatosTabla(out)
    })
  }, [mesActual, añoActual])

  // Fallback a canalStats si tabla vacía
  const map = new Map(canales.map(c => [c.id, c]))

  function getDatos(id: string): { bruto: number | null; neto: number | null; margenPct: number | null; sinDatos: boolean } {
    const tableKey = CANAL_MAP[id]
    const td = tableKey ? datosTabla[tableKey] : undefined
    if (td && !td.sinDatos) return td
    // FIX 50: si tabla tiene datos los usa; si no, fallback a canalStats
    const c = map.get(id as CanalStat['id'])
    if (c && c.bruto > 0) return { bruto: c.bruto, neto: c.neto, margenPct: c.margen, sinDatos: false }
    return { bruto: null, neto: null, margenPct: null, sinDatos: true }
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
          colorBruto={COLOR.verdeOscuro}
          datos={uber}
        />

        {/* R7-06: Glovo border más sutil */}
        <CardCanal
          label="GLOVO"
          bg={`${COLOR.glovo}30`}
          border="rgba(200,180,0,0.30)"
          borderWidth="1px"
          colorLabel={COLOR.glovoDark}
          colorBruto={COLOR.glovoTexto}
          datos={glovo}
        />

        {/* FIX 51: Just Eat muestra datos reales */}
        <CardCanal
          label="JUST EAT"
          bg={`${COLOR.je}20`}
          border={COLOR.je}
          colorLabel={COLOR.jeDark}
          colorBruto={COLOR.jeDark}
          datos={je}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <CardCanalMini
            label="WEB"
            bg={`${COLOR.webSL}10`}
            border={`${COLOR.webSL}50`}
            colorLabel={COLOR.webDark}
            colorBruto={COLOR.webDark}
            datos={web}
          />
          <CardCanalMini
            label="DIRECTA"
            bg={`${COLOR.directa}20`}
            border={COLOR.directa}
            colorLabel={COLOR.directaDark}
            colorBruto={COLOR.directaDark}
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
  colorBruto: string
  datos: { bruto: number | null; neto: number | null; margenPct: number | null; sinDatos: boolean }
}

function CardCanal({ label, bg, border, borderWidth = '0.5px', boxShadow, colorLabel, colorBruto, datos }: CardCanalProps) {
  const tieneDatos = !datos.sinDatos && datos.bruto !== null
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
        {/* FIX 43: fontSize 24 fontWeight 600 */}
        <div style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 600, color: colorBruto, marginTop: 2 }}>
          {/* FIX 44: sin €, decimals:2 */}
          {tieneDatos ? fmtEur(datos.bruto, { showEuro: false, decimals: 2 }) : 'Datos insuficientes'}
        </div>
        {/* FIX 47: "Bruto" con B mayúscula */}
        <div style={{ fontSize: 11, color: colorBruto, fontFamily: LEXEND }}>Bruto</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {/* FIX 43: neto mismo tamaño */}
        <div style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 600, color: COLOR.verde }}>
          {/* FIX 45: neto sin €, decimals:2 */}
          {tieneDatos ? fmtEur(datos.neto, { showEuro: false, decimals: 2 }) : '—'}
        </div>
        {/* FIX 46: "Margen X,XX%" con 2 decimales */}
        <div style={{ fontSize: 14, color: COLOR.verde, fontFamily: LEXEND }}>
          {tieneDatos && datos.margenPct !== null ? `Margen ${fmtPct(datos.margenPct, 2)}` : ''}
        </div>
      </div>
    </div>
  )
}

function CardCanalMini({ label, bg, border, colorLabel, colorBruto, datos }: Omit<CardCanalProps, 'colorBrutoSub'>) {
  const tieneDatos = !datos.sinDatos && datos.bruto !== null
  return (
    <div style={{
      background: bg,
      border: `0.5px solid ${border}`,
      borderRadius: 14,
      padding: '10px 12px',
    }}>
      <div style={{ ...lblXs, color: colorLabel }}>{label}</div>
      <div style={{ fontFamily: OSWALD, fontSize: 15, fontWeight: 600, color: colorBruto, marginTop: 2 }}>
        {tieneDatos ? fmtEur(datos.bruto, { showEuro: false, decimals: 2 }) : '— €'}
      </div>
      <div style={{ fontSize: 10, color: COLOR.textMut, fontFamily: LEXEND }}>
        {tieneDatos
          ? `${fmtEur(datos.neto, { showEuro: false, decimals: 2 })} neto · ${fmtPct(datos.margenPct ?? 0, 2)}`
          : 'sin datos'}
      </div>
    </div>
  )
}
