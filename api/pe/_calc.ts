export interface Params {
  alquiler_local?: number | null
  irpf_alquiler?: number | null
  sueldo_ruben?: number | null
  sueldo_emilio?: number | null
  sueldos_empleados?: number | null
  ss_empresa?: number | null
  ss_autonomos?: number | null
  gestoria?: number | null
  luz?: number | null
  agua?: number | null
  gas?: number | null
  telefono?: number | null
  internet?: number | null
  hosting_software?: number | null
  seguros?: number | null
  licencias?: number | null
  think_paladar?: number | null
  otros_fijos?: number | null
  food_cost_pct?: number | null
  packaging_pct?: number | null
  comision_uber_pct?: number | null
  comision_glovo_pct?: number | null
  comision_je_pct?: number | null
  comision_web_pct?: number | null
  comision_directa_pct?: number | null
  objetivo_beneficio_mensual?: number | null
  tasa_fiscal_pct?: number | null
  caja_minima_verde?: number | null
  caja_minima_ambar?: number | null
  iva_pct?: number | null
}

export interface Mix {
  uber: number
  glovo: number
  je: number
  web: number
  directa: number
  total: number
  pedidos: number
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0))
  return isNaN(n) ? 0 : n
}

export function fijosMes(p: Params): number {
  return num(p.alquiler_local) + num(p.irpf_alquiler) +
    num(p.sueldo_ruben) + num(p.sueldo_emilio) + num(p.sueldos_empleados) +
    num(p.ss_empresa) + num(p.ss_autonomos) + num(p.gestoria) +
    num(p.luz) + num(p.agua) + num(p.gas) +
    num(p.telefono) + num(p.internet) + num(p.hosting_software) +
    num(p.seguros) + num(p.licencias) + num(p.think_paladar) + num(p.otros_fijos)
}

export function comisionPonderada(mix: Mix, p: Params): number {
  if (mix.total <= 0) return num(p.comision_uber_pct) || 30
  return (
    mix.uber * num(p.comision_uber_pct) +
    mix.glovo * num(p.comision_glovo_pct) +
    mix.je * num(p.comision_je_pct) +
    mix.web * num(p.comision_web_pct) +
    mix.directa * num(p.comision_directa_pct)
  ) / mix.total
}

export function margenPct(mix: Mix, p: Params): { varPct: number; margenPct: number; comisionPct: number } {
  const comisionPct = comisionPonderada(mix, p)
  const varPct = comisionPct + num(p.food_cost_pct) + num(p.packaging_pct)
  return { varPct, margenPct: 100 - varPct, comisionPct }
}

/** Convierte un importe bruto (con IVA) a base imponible sin IVA. */
export function netearIVA(brutoConIVA: number, ivaPct: number): number {
  const tasa = 1 + num(ivaPct) / 100
  return tasa > 0 ? brutoConIVA / tasa : brutoConIVA
}

export const toNum = num
