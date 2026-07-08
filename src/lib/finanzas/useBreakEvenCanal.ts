/**
 * useBreakEvenCanal — break-even (punto de equilibrio) por combinación MARCA × CANAL.
 * Distinto de src/pages/finanzas/PuntoEquilibrio.tsx (que calcula un PE global de la empresa):
 * aquí el break-even se calcula fila a fila para cada marca en cada plataforma, para poder
 * ver qué combinaciones concretas están por debajo o por encima del punto de equilibrio.
 *
 * Fuentes de datos (todas reales, sin cifras inventadas):
 * 1. resumenes_plataforma_marca_mensual → bruto / neto_real_cobrado por marca+plataforma+mes.
 *    Se usa el mes más reciente del año en curso que tenga filas cargadas (snapshot único,
 *    para que el reparto de costes fijos del punto 3 sea coherente con un solo periodo).
 * 2. config_canales → comisión/fees de referencia por canal (solo informativo, NO entra en
 *    el cálculo del margen de contribución real, que sale de neto_real_cobrado/bruto).
 * 3. conciliacion + categorias_pyg → costes fijos reales de la empresa (bloques EQUIPO y
 *    ALQUILER) en el mes de referencia, para prorratear por cuota de ventas de cada combo.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type CanalId = 'uber' | 'glovo' | 'just_eat'

export const CANAL_LABELS: Record<CanalId, string> = {
  uber: 'Uber Eats',
  glovo: 'Glovo',
  just_eat: 'Just Eat',
}

/** Nombre tal cual aparece en config_canales.canal, para cruzar con CanalId. */
const CANAL_CONFIG_NOMBRE: Record<CanalId, string> = {
  uber: 'Uber Eats',
  glovo: 'Glovo',
  just_eat: 'Just Eat',
}

export interface ComboBreakEven {
  marca: string
  canal: CanalId
  bruto: number
  neto: number | null
  pedidos: number
  /** null = sin dato de neto real cobrado o bruto=0 → se muestra "—" y se excluye de rankings */
  margenContribPct: number | null
  costesFijosAsignados: number
  /** null si no hay margen; Infinity si margen <= 0 (no alcanzable) */
  breakEvenVentas: number | null
  alcanzable: boolean
  /** null si no hay margen o si no es alcanzable (breakEven infinito) */
  gap: number | null
}

export interface ConfigCanalRef {
  comisionPct: number
  feePeriodoEur: number
  margenObjPct: number
}

export interface BreakEvenCanalState {
  loading: boolean
  error: string | null
  mesReferencia: { año: number; mes: number } | null
  combos: ComboBreakEven[]
  costesFijosTotalesMes: number
  totalBrutoMes: number
  configCanales: Partial<Record<CanalId, ConfigCanalRef>>
}

function primerDiaMes(año: number, mes: number): string {
  return `${año}-${String(mes).padStart(2, '0')}-01`
}
function ultimoDiaMes(año: number, mes: number): string {
  const d = new Date(año, mes, 0) // día 0 del mes siguiente = último día del mes actual
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useBreakEvenCanal(): BreakEvenCanalState {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mesReferencia, setMesReferencia] = useState<{ año: number; mes: number } | null>(null)
  const [combos, setCombos] = useState<ComboBreakEven[]>([])
  const [costesFijosTotalesMes, setCostesFijosTotalesMes] = useState(0)
  const [totalBrutoMes, setTotalBrutoMes] = useState(0)
  const [configCanales, setConfigCanales] = useState<Partial<Record<CanalId, ConfigCanalRef>>>({})

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const añoActual = new Date().getFullYear()

        // 1. Config de canales (referencia informativa, no entra en el cálculo real)
        const { data: cfgRows, error: cfgErr } = await supabase
          .from('config_canales')
          .select('canal,comision_pct,fee_periodo_eur,margen_obj_pct')
          .eq('activo', true)
        if (cfgErr) throw cfgErr
        if (cancel) return
        const cfgMap: Partial<Record<CanalId, ConfigCanalRef>> = {}
        for (const id of Object.keys(CANAL_CONFIG_NOMBRE) as CanalId[]) {
          const row = (cfgRows ?? []).find(r => r.canal === CANAL_CONFIG_NOMBRE[id])
          if (row) {
            cfgMap[id] = {
              comisionPct: Number(row.comision_pct ?? 0) * 100,
              feePeriodoEur: Number(row.fee_periodo_eur ?? 0),
              margenObjPct: Number(row.margen_obj_pct ?? 0) * 100,
            }
          }
        }
        setConfigCanales(cfgMap)

        // 2. Resúmenes marca × plataforma del año en curso → mes más reciente con datos
        const { data: resumenes, error: resErr } = await supabase
          .from('resumenes_plataforma_marca_mensual')
          .select('marca,plataforma,mes,año,bruto,comisiones,fees,cargos_promocion,neto_real_cobrado,pedidos')
          .eq('año', añoActual)
          .order('mes', { ascending: false })
          .returns<{ marca: string; plataforma: string; mes: number; año: number; bruto: number | null; comisiones: number | null; fees: number | null; cargos_promocion: number | null; neto_real_cobrado: number | null; pedidos: number | null }[]>()
        if (resErr) throw resErr
        if (cancel) return

        if (!resumenes || resumenes.length === 0) {
          // TODO fuente de datos: sin filas en resumenes_plataforma_marca_mensual para el año en curso.
          setMesReferencia(null)
          setCombos([])
          setCostesFijosTotalesMes(0)
          setTotalBrutoMes(0)
          setLoading(false)
          return
        }

        const mesMax = Math.max(...resumenes.map(r => Number(r.mes)))
        const filasMes = resumenes.filter(r => Number(r.mes) === mesMax)
        setMesReferencia({ año: añoActual, mes: mesMax })

        const totalBruto = filasMes.reduce((s, r) => s + Number(r.bruto ?? 0), 0)
        setTotalBrutoMes(totalBruto)

        // 3. Costes fijos reales de la empresa (EQUIPO + ALQUILER) del mes de referencia
        const { data: catRows, error: catErr } = await supabase
          .from('categorias_pyg')
          .select('id,nombre,bloque')
          .in('bloque', ['EQUIPO', 'ALQUILER'])
        if (catErr) throw catErr
        if (cancel) return
        const idsFijos = (catRows ?? []).map(c => c.id)

        let costesFijos = 0
        if (idsFijos.length > 0) {
          const { data: conciRows, error: conciErr } = await supabase
            .from('conciliacion')
            .select('fecha,importe,categoria,tipo')
            .eq('tipo', 'gasto')
            .in('categoria', idsFijos)
            .gte('fecha', primerDiaMes(añoActual, mesMax))
            .lte('fecha', ultimoDiaMes(añoActual, mesMax))
          if (conciErr) throw conciErr
          if (cancel) return
          costesFijos = (conciRows ?? []).reduce((s, r) => s + Math.abs(Number(r.importe ?? 0)), 0)
        }
        // TODO fuente de datos: si idsFijos está vacío (categorias_pyg sin EQUIPO/ALQUILER
        // activos), costesFijosTotalesMes queda en 0 y el break-even de todas las combos
        // coincide con "0 € de fijos que cubrir" — no se inventa un importe de referencia.
        setCostesFijosTotalesMes(costesFijos)

        // 4. Cálculo por combinación marca × canal
        const out: ComboBreakEven[] = filasMes
          .filter(r => r.plataforma === 'uber' || r.plataforma === 'glovo' || r.plataforma === 'just_eat')
          .map(r => {
            const bruto = Number(r.bruto ?? 0)
            const netoRaw = r.neto_real_cobrado
            const neto = netoRaw == null ? null : Number(netoRaw)
            const margenContribPct = bruto > 0 && neto != null ? neto / bruto : null
            // Reparto proporcional a ventas: NO es una imputación contable exacta por marca,
            // es una aproximación (no existe esa granularidad de costes fijos en BD).
            const costesFijosAsignados = totalBruto > 0 ? costesFijos * (bruto / totalBruto) : 0
            let breakEvenVentas: number | null = null
            let alcanzable = true
            let gap: number | null = null
            if (margenContribPct != null) {
              if (margenContribPct <= 0) {
                breakEvenVentas = Infinity
                alcanzable = false
                gap = null
              } else {
                breakEvenVentas = costesFijosAsignados / margenContribPct
                gap = bruto - breakEvenVentas
              }
            }
            return {
              marca: r.marca,
              canal: r.plataforma as CanalId,
              bruto,
              neto,
              pedidos: Number(r.pedidos ?? 0),
              margenContribPct,
              costesFijosAsignados,
              breakEvenVentas,
              alcanzable,
              gap,
            }
          })

        setCombos(out)
        setLoading(false)
      } catch (e) {
        if (cancel) return
        setError(e instanceof Error ? e.message : 'Error al cargar break-even')
        setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [])

  return { loading, error, mesReferencia, combos, costesFijosTotalesMes, totalBrutoMes, configCanales }
}

export interface BreakEvenKpis {
  breakEvenGlobal: number
  peorCombo: ComboBreakEven | null
  canalMasRentable: { canal: CanalId; margenMedioPct: number } | null
}

/**
 * KPIs derivados de las combinaciones ya calculadas.
 * DECISIÓN AUTÓNOMA: para "marca más lejos del equilibrio" se prioriza cualquier combo
 * "No alcanzable" (margen <= 0, nunca puede cubrir sus fijos asignados) sobre las combos
 * con gap negativo pero finito, porque no poder alcanzar break-even es una situación peor
 * que estar simplemente por debajo. Entre combos no alcanzables se ordena por bruto
 * descendente (la que más factura sin poder cubrir fijos es la más urgente).
 */
export function computeBreakEvenKpis(combos: ComboBreakEven[]): BreakEvenKpis {
  const alcanzables = combos.filter(c => c.breakEvenVentas != null && Number.isFinite(c.breakEvenVentas) && c.margenContribPct != null && c.margenContribPct > 0)
  const breakEvenGlobal = alcanzables.reduce((s, c) => s + (c.breakEvenVentas as number), 0)

  const noAlcanzables = combos.filter(c => !c.alcanzable && c.margenContribPct != null)
  let peorCombo: ComboBreakEven | null = null
  if (noAlcanzables.length > 0) {
    peorCombo = [...noAlcanzables].sort((a, b) => b.bruto - a.bruto)[0]
  } else {
    const conGap = combos.filter(c => c.gap != null)
    if (conGap.length > 0) {
      peorCombo = [...conGap].sort((a, b) => (a.gap as number) - (b.gap as number))[0]
    }
  }

  const porCanal = new Map<CanalId, { suma: number; n: number }>()
  for (const c of combos) {
    if (c.margenContribPct == null) continue
    const cur = porCanal.get(c.canal) ?? { suma: 0, n: 0 }
    cur.suma += c.margenContribPct
    cur.n += 1
    porCanal.set(c.canal, cur)
  }
  let canalMasRentable: BreakEvenKpis['canalMasRentable'] = null
  for (const [canal, v] of porCanal) {
    const media = v.n > 0 ? (v.suma / v.n) * 100 : -Infinity
    if (!canalMasRentable || media > canalMasRentable.margenMedioPct) {
      canalMasRentable = { canal, margenMedioPct: media }
    }
  }

  return { breakEvenGlobal, peorCombo, canalMasRentable }
}
