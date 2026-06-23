/**
 * calcPorCobrar — "lo que te deben las plataformas a día de hoy".
 * Porta la lógica de la pestaña Cashflow (ciclos de pago por plataforma + frontera
 * de cobro del banco + cierre histórico 19-jun) para poder mostrar el pendiente
 * de cobro también en el Resumen, sin tocar Cashflow.
 *
 * Pendiente = liquidaciones de Uber/Glovo/Just Eat cuyo pago aún no ha entrado en banco
 * (la conciliación de esa plataforma no ha llegado a esa fecha) y que son posteriores al
 * cierre histórico. Web/Directa cobran al instante → nunca cuentan como pendiente.
 */
import { calcNetoPorCanal, type CanalConfig, type MarcasPorCanal } from '@/lib/panel/calcNetoPlataforma'

export interface RowPorCobrar {
  fecha: string
  servicio?: string | null
  uber_bruto?: number; uber_pedidos?: number
  glovo_bruto?: number; glovo_pedidos?: number
  je_bruto?: number; je_pedidos?: number
  web_bruto?: number; web_pedidos?: number
  directa_bruto?: number; directa_pedidos?: number
  [k: string]: number | string | null | undefined
}

export interface CanalPendiente { id: string; label: string; color: string; neto: number }
export interface PorCobrarResult {
  total: number
  hastaFinMes: number
  porCanal: CanalPendiente[]
  top: CanalPendiente | null
  nLiquidaciones: number
}

const CIERRE_HIST = '2026-06-19'
const CANALES = [
  { id: 'uber', label: 'Uber Eats', color: '#06C167', bk: 'uber_bruto', pk: 'uber_pedidos' },
  { id: 'glovo', label: 'Glovo', color: '#FFC244', bk: 'glovo_bruto', pk: 'glovo_pedidos' },
  { id: 'je', label: 'Just Eat', color: '#FF8000', bk: 'je_bruto', pk: 'je_pedidos' },
] as const

function toLocal(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function parse(s: string) { return new Date(s.slice(0, 10) + 'T12:00:00') }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(d.getDate() + n); return r }
function mondayOf(d: Date) { const r = new Date(d); const w = r.getDay() || 7; r.setDate(r.getDate() - w + 1); r.setHours(12, 0, 0, 0); return r }
function finDeMes(y: number, m: number) { return new Date(y, m + 1, 0, 12) }
function pagoUber(domingo: Date, fest: Set<string>): string { let p = addDays(domingo, 1); for (let i = 0; i < 7 && fest.has(toLocal(p)); i++) p = addDays(p, 1); return toLocal(p) }
function pagoGlovo(y: number, m: number, q: 1 | 2): string { return toLocal(new Date(y, m + 1, q === 1 ? 5 : 20, 12)) }
function pagoJE(y: number, m: number, q: 1 | 2): string { return q === 1 ? toLocal(new Date(y, m, 20, 12)) : toLocal(new Date(y, m + 1, 5, 12)) }

export function calcPorCobrar(
  rows: RowPorCobrar[],
  opts: {
    config: Record<string, CanalConfig>
    marcasPorCanal: MarcasPorCanal
    festivos: Set<string>
    frontera: Record<string, string>
  },
): PorCobrarResult {
  const { config, marcasPorCanal, festivos, frontera } = opts
  const hoy = toLocal(new Date())
  const finMesStr = (() => { const d = new Date(); return toLocal(finDeMes(d.getFullYear(), d.getMonth())) })()

  // Dedupe por servicio: si un día tiene fila TODO, ignora ALM/CENAS de ese día.
  const todo = new Set<string>()
  for (const r of rows) if (r.servicio === 'TODO') todo.add(r.fecha)
  const agg = new Map<string, Record<string, number>>()
  for (const r of rows) {
    if (todo.has(r.fecha)) { if (r.servicio !== 'TODO') continue }
    else { if (r.servicio !== 'ALM' && r.servicio !== 'CENAS' && r.servicio != null && r.servicio !== '') continue }
    const a = agg.get(r.fecha) ?? {}
    for (const c of CANALES) {
      a[c.bk] = (a[c.bk] ?? 0) + (Number(r[c.bk]) || 0)
      a[c.pk] = (a[c.pk] ?? 0) + (Number(r[c.pk]) || 0)
    }
    agg.set(r.fecha, a)
  }

  type G = { canal: typeof CANALES[number]; ini: string; fin: string; pago: string; bruto: number; ped: number; dias: Set<string> }
  const grupos = new Map<string, G>()
  const push = (key: string, canal: typeof CANALES[number], ini: string, fin: string, pago: string, bruto: number, ped: number, f: string) => {
    let g = grupos.get(key)
    if (!g) { g = { canal, ini, fin, pago, bruto: 0, ped: 0, dias: new Set() }; grupos.set(key, g) }
    g.bruto += bruto; g.ped += ped; g.dias.add(f)
  }
  for (const [f, a] of agg) {
    const d = parse(f); const y = d.getFullYear(); const m = d.getMonth(); const q: 1 | 2 = d.getDate() <= 15 ? 1 : 2
    for (const c of CANALES) {
      const bruto = a[c.bk] ?? 0; const ped = a[c.pk] ?? 0
      if (bruto <= 0) continue
      if (c.id === 'uber') {
        const lun = mondayOf(d); const dom = addDays(lun, 6)
        push('U' + toLocal(lun), c, toLocal(lun), toLocal(dom), pagoUber(dom, festivos), bruto, ped, f)
      } else {
        const ini = toLocal(new Date(y, m, q === 1 ? 1 : 16, 12))
        const fin = q === 1 ? toLocal(new Date(y, m, 15, 12)) : toLocal(finDeMes(y, m))
        const pago = c.id === 'glovo' ? pagoGlovo(y, m, q) : pagoJE(y, m, q)
        push(`${c.id}${y}-${m}-${q}`, c, ini, fin, pago, bruto, ped, f)
      }
    }
  }

  const cobradoBanco = (canal: string, pago: string) => {
    if (pago <= CIERRE_HIST) return true
    const fr = frontera[canal]
    return !!fr && pago <= fr
  }

  const porCanalMap: Record<string, number> = { uber: 0, glovo: 0, je: 0 }
  let total = 0, hastaFinMes = 0, nLiquidaciones = 0
  for (const g of grupos.values()) {
    if (cobradoBanco(g.canal.id, g.pago)) continue
    const { neto } = calcNetoPorCanal(g.canal.id, g.bruto, g.ped, {
      modo: 'agregado_canal', marcasPorCanal, fechaDesde: parse(g.ini), fechaHasta: parse(g.fin), configCanales: config, diasConDatos: g.dias.size,
    })
    porCanalMap[g.canal.id] += neto
    total += neto
    nLiquidaciones += 1
    if (g.pago <= finMesStr) hastaFinMes += neto
  }

  const porCanal: CanalPendiente[] = CANALES.map(c => ({ id: c.id, label: c.label, color: c.color, neto: porCanalMap[c.id] || 0 }))
  const top = [...porCanal].sort((a, b) => b.neto - a.neto)[0] ?? null
  return { total, hastaFinMes, porCanal, top: top && top.neto > 0 ? top : null, nLiquidaciones }
}
