/**
 * casarFechaCobro.ts
 *
 * Reparte un cobro de plataforma (real o estimado) al mes/meses de VENTA
 * que le corresponden, segun los plazos documentados en Notion
 * "PLAZOS COBRO PLATAFORMAS - Uber / Glovo / JE / Web" (20/05/2026).
 *
 * Plataformas:
 *  - UBER:  Cobro lunes F -> ventas semana lun-dom anterior a F.
 *           Reparto proporcional al bruto diario de facturacion_diario.
 *  - GLOVO: Cobro dia 1-15 mes Y -> ventas 16-fin mes Y-2.
 *           Cobro dia 16-fin mes Y -> ventas 1-15 mes Y-1.
 *  - JE:    Cobro dia 16-fin mes Y -> ventas 1-15 mes Y.
 *           Cobro dia 1-15 mes Y -> ventas 16-fin mes Y-1.
 *  - WEB / DIRECTA: Cobro inmediato -> mismo mes que la fecha de cobro.
 */

export type CanalKey = 'uber' | 'glovo' | 'je' | 'web' | 'directa'

export interface BrutoDiario {
  fecha: string
  uber_bruto?: number
  glovo_bruto?: number
  je_bruto?: number
  web_bruto?: number
  directa_bruto?: number
}

export interface RepartoMes {
  anio: number
  mes: number
  importe: number
}

const fechaToYM = (f: string): { y: number; m: number; d: number } => {
  const [y, m, d] = f.split('-').map(Number)
  return { y, m, d }
}

const lunesDeSemanaAnterior = (fecha: string): Date => {
  const [y, m, d] = fecha.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay() // 0 dom .. 6 sab
  // Cobro Uber cae en lunes (o mar/mie si festivo). Buscamos el lunes de la
  // semana de VENTA, que es 7 dias antes del lunes del cobro.
  // lunes (1) -> 7, martes (2) -> 8, miercoles (3) -> 9, etc.
  // dow=0 (domingo, no deberia darse): retrocedemos 6 dias al lunes anterior.
  const diasARetroceder = dow === 0 ? 6 : 6 + dow
  dt.setUTCDate(dt.getUTCDate() - diasARetroceder)
  return dt
}

const fmtDate = (dt: Date): string => {
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * UBER: reparto del cobro entre dias de la semana de venta segun peso del bruto
 * diario sobre el bruto semanal.
 */
export function repartirCobroUber(
  fechaCobro: string,
  importeCobro: number,
  brutosDiarios: BrutoDiario[]
): RepartoMes[] {
  const lunes = lunesDeSemanaAnterior(fechaCobro)
  const dias: string[] = []
  for (let i = 0; i < 7; i++) {
    const dt = new Date(lunes)
    dt.setUTCDate(lunes.getUTCDate() + i)
    dias.push(fmtDate(dt))
  }

  const brutoPorDia: Record<string, number> = {}
  let brutoSemana = 0
  for (const d of dias) {
    const row = brutosDiarios.find((r) => r.fecha === d)
    const b = Number(row?.uber_bruto || 0)
    brutoPorDia[d] = b
    brutoSemana += b
  }

  const reparto: Record<string, number> = {}
  if (brutoSemana > 0) {
    for (const d of dias) {
      reparto[d] = importeCobro * (brutoPorDia[d] / brutoSemana)
    }
  } else {
    // Fallback: no hay bruto registrado esa semana (raro, ajustes Uber).
    for (const d of dias) reparto[d] = importeCobro / 7
  }

  const porMes: Record<string, number> = {}
  for (const [d, v] of Object.entries(reparto)) {
    const { y, m } = fechaToYM(d)
    const k = `${y}-${m}`
    porMes[k] = (porMes[k] || 0) + v
  }

  return Object.entries(porMes).map(([k, importe]) => {
    const [y, m] = k.split('-').map(Number)
    return { anio: y, mes: m, importe }
  })
}

/**
 * GLOVO: cobro dia 1-15 mes Y -> ventas 16-fin mes Y-2.
 *        cobro dia 16-fin mes Y -> ventas 1-15 mes Y-1.
 */
export function repartirCobroGlovo(
  fechaCobro: string,
  importeCobro: number,
  brutosDiarios: BrutoDiario[]
): RepartoMes[] {
  const { y, m, d } = fechaToYM(fechaCobro)
  let anioVenta: number
  let mesVenta: number
  let diaIni: number
  let diaFin: number

  if (d <= 15) {
    mesVenta = m - 2
    anioVenta = y
    if (mesVenta <= 0) { mesVenta += 12; anioVenta -= 1 }
    diaIni = 16
    diaFin = new Date(anioVenta, mesVenta, 0).getDate()
  } else {
    mesVenta = m - 1
    anioVenta = y
    if (mesVenta <= 0) { mesVenta += 12; anioVenta -= 1 }
    diaIni = 1
    diaFin = 15
  }

  return repartirQuincena(anioVenta, mesVenta, diaIni, diaFin, importeCobro, brutosDiarios, 'glovo_bruto')
}

/**
 * JUST EAT: cobro dia 16-fin mes Y -> ventas 1-15 mes Y.
 *           cobro dia 1-15 mes Y -> ventas 16-fin mes Y-1.
 */
export function repartirCobroJE(
  fechaCobro: string,
  importeCobro: number,
  brutosDiarios: BrutoDiario[]
): RepartoMes[] {
  const { y, m, d } = fechaToYM(fechaCobro)
  let anioVenta: number
  let mesVenta: number
  let diaIni: number
  let diaFin: number

  if (d >= 16) {
    anioVenta = y
    mesVenta = m
    diaIni = 1
    diaFin = 15
  } else {
    mesVenta = m - 1
    anioVenta = y
    if (mesVenta <= 0) { mesVenta += 12; anioVenta -= 1 }
    diaIni = 16
    diaFin = new Date(anioVenta, mesVenta, 0).getDate()
  }

  return repartirQuincena(anioVenta, mesVenta, diaIni, diaFin, importeCobro, brutosDiarios, 'je_bruto')
}

/**
 * WEB / DIRECTA: cobro inmediato -> mismo mes que la fecha del cobro.
 */
export function repartirCobroInmediato(
  fechaCobro: string,
  importeCobro: number
): RepartoMes[] {
  const { y, m } = fechaToYM(fechaCobro)
  return [{ anio: y, mes: m, importe: importeCobro }]
}

function repartirQuincena(
  anioVenta: number,
  mesVenta: number,
  diaIni: number,
  diaFin: number,
  importeCobro: number,
  brutosDiarios: BrutoDiario[],
  campoBruto: keyof BrutoDiario
): RepartoMes[] {
  const dias: string[] = []
  for (let dd = diaIni; dd <= diaFin; dd++) {
    const fechaStr = `${anioVenta}-${String(mesVenta).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
    dias.push(fechaStr)
  }

  let brutoTotal = 0
  const brutoPorDia: Record<string, number> = {}
  for (const f of dias) {
    const row = brutosDiarios.find((r) => r.fecha === f)
    const b = Number(row?.[campoBruto] || 0)
    brutoPorDia[f] = b
    brutoTotal += b
  }

  if (brutoTotal === 0) {
    return [{ anio: anioVenta, mes: mesVenta, importe: importeCobro }]
  }

  let acumulado = 0
  for (const f of dias) {
    acumulado += importeCobro * (brutoPorDia[f] / brutoTotal)
  }
  return [{ anio: anioVenta, mes: mesVenta, importe: acumulado }]
}

/**
 * Dispatcher: dado canal + fecha + importe + brutos diarios, devuelve reparto.
 */
export function repartirCobro(
  canal: CanalKey,
  fechaCobro: string,
  importeCobro: number,
  brutosDiarios: BrutoDiario[]
): RepartoMes[] {
  switch (canal) {
    case 'uber':    return repartirCobroUber(fechaCobro, importeCobro, brutosDiarios)
    case 'glovo':   return repartirCobroGlovo(fechaCobro, importeCobro, brutosDiarios)
    case 'je':      return repartirCobroJE(fechaCobro, importeCobro, brutosDiarios)
    case 'web':
    case 'directa': return repartirCobroInmediato(fechaCobro, importeCobro)
  }
}
