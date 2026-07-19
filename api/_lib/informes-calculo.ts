/**
 * Calculadora de informes — genera el contenido textual de cada tipo
 * a partir de datos reales de Supabase.
 *
 * Cada función devuelve { asunto, contenido } listos para enviar
 * por WhatsApp o email.
 *
 * FIX 19 jul 2026: cierre con formato "STREAT LAB" (plataformas + ⭐, TM,
 * objetivo "faltan X", semana, top marcas, top platos EN VIVO desde
 * ventas_vivo con complementos/bebidas excluidos). Pulso con proyección
 * de cierre del día ("a este paso").
 */
import { supabaseAdmin } from './supabase-admin.js'

export type TipoInforme =
  | 'cierre_diario'
  | 'cobros_lunes'
  | 'cierre_semanal'
  | 'cierre_mensual'
  | 'resumen_manana'
  | 'pulso'

export interface InformeContenido {
  asunto: string
  contenido_whatsapp: string
  contenido_email: string
}

const fmtEur = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
const fmtEur2 = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
const fmtNum2 = (n: number) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

function semaforo(deltaPct: number): string {
  if (deltaPct >= 0) return '🟢'
  if (deltaPct >= -10) return '🟡'
  return '🔴'
}

function isoFecha(d: Date): string {
  return d.toISOString().split('T')[0]
}

/** objetivos_dia_semana usa dia 1=lunes … 7=domingo */
function diaIso(d: Date): number {
  const g = d.getDay()
  return g === 0 ? 7 : g
}

async function objetivoDelDia(d: Date): Promise<number> {
  const { data } = await supabaseAdmin
    .from('objetivos_dia_semana')
    .select('importe')
    .eq('dia', diaIso(d))
    .maybeSingle()
  return Number(data?.importe || 0)
}

interface Plataforma { nombre: string; euros: number; pedidos: number }
interface DatosDia {
  total: number
  pedidos: number
  porMarca: Map<string, number>
  plataformas: Plataforma[]
}

async function datosDia(fechaStr: string): Promise<DatosDia> {
  const { data } = await supabaseAdmin
    .from('facturacion_diario')
    .select('total_bruto, total_pedidos, uber_bruto, uber_pedidos, glovo_bruto, glovo_pedidos, je_bruto, je_pedidos, web_bruto, web_pedidos, directa_bruto, directa_pedidos, marca_id, marcas(nombre)')
    .eq('fecha', fechaStr)

  let total = 0
  let pedidos = 0
  const porMarca = new Map<string, number>()
  const acc = { uberE: 0, uberP: 0, glovoE: 0, glovoP: 0, jeE: 0, jeP: 0, webE: 0, webP: 0 }
  for (const r of (data || []) as any[]) {
    const bruto = Number(r.total_bruto || 0)
    total += bruto
    pedidos += Number(r.total_pedidos || 0)
    const nombre = r.marcas?.nombre || 'Sin marca'
    porMarca.set(nombre, (porMarca.get(nombre) || 0) + bruto)
    acc.uberE += Number(r.uber_bruto || 0);  acc.uberP += Number(r.uber_pedidos || 0)
    acc.glovoE += Number(r.glovo_bruto || 0); acc.glovoP += Number(r.glovo_pedidos || 0)
    acc.jeE += Number(r.je_bruto || 0);       acc.jeP += Number(r.je_pedidos || 0)
    acc.webE += Number(r.web_bruto || 0) + Number(r.directa_bruto || 0)
    acc.webP += Number(r.web_pedidos || 0) + Number(r.directa_pedidos || 0)
  }
  const plataformas: Plataforma[] = [
    { nombre: 'Uber', euros: acc.uberE, pedidos: acc.uberP },
    { nombre: 'Glovo', euros: acc.glovoE, pedidos: acc.glovoP },
    { nombre: 'Just Eat', euros: acc.jeE, pedidos: acc.jeP },
    { nombre: 'Web', euros: acc.webE, pedidos: acc.webP },
  ].filter(p => p.euros > 0 || p.pedidos > 0)
  return { total, pedidos, porMarca, plataformas }
}

/** Suma facturación bruta del lunes de la semana de f hasta f incluido */
async function semanaHasta(f: Date): Promise<number> {
  const lunes = new Date(f)
  const dia = f.getDay()
  lunes.setDate(f.getDate() - (dia === 0 ? 6 : dia - 1))
  const { data } = await supabaseAdmin
    .from('facturacion_diario')
    .select('total_bruto')
    .gte('fecha', isoFecha(lunes))
    .lte('fecha', isoFecha(f))
  return (data || []).reduce((s, r: any) => s + Number(r.total_bruto || 0), 0)
}

/** Top platos del día EN VIVO (ventas_vivo), excluidos bebidas/salsas/extras */
async function topPlatosVivo(fechaStr: string, limite = 5): Promise<Array<{ plato: string; uds: number }>> {
  const { data, error } = await supabaseAdmin.rpc('fn_top_platos_dia', { p_fecha: fechaStr, p_limit: limite })
  if (error || !data) return []
  return (data as any[]).map(r => ({ plato: r.plato, uds: Number(r.uds || 0) }))
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/**
 * 1) CIERRE DIARIO — formato STREAT LAB, en vivo
 */
export async function cierreDiario(fecha?: Date): Promise<InformeContenido> {
  const f = fecha ?? new Date()
  const fAnt = new Date(f)
  fAnt.setDate(fAnt.getDate() - 7)
  const fechaStr = isoFecha(f)

  const [hoy, antes, objetivoDia, semana, platos] = await Promise.all([
    datosDia(fechaStr),
    datosDia(isoFecha(fAnt)),
    objetivoDelDia(f),
    semanaHasta(f),
    topPlatosVivo(fechaStr, 5),
  ])

  const deltaVsAntes = antes.total > 0 ? ((hoy.total - antes.total) / antes.total) * 100 : 0
  const flecha = deltaVsAntes >= 0 ? '▲' : '▼'
  const pctInt = Math.round(deltaVsAntes)
  const tm = hoy.pedidos > 0 ? hoy.total / hoy.pedidos : 0
  const fechaLarga = `${f.getDate()} de ${MESES[f.getMonth()]}`
  const lider = hoy.plataformas.reduce((a, b) => (b.euros > a.euros ? b : a), { euros: -1 } as Plataforma)

  const wa = [
    `📊 *STREAT LAB · Facturación ${fechaLarga}*`,
    `*${fmtEur2(hoy.total)}*`,
    antes.total > 0 ? `${flecha} ${pctInt >= 0 ? '+' : ''}${pctInt}% vs semana pasada` : '',
    ``,
    ...hoy.plataformas.map(p =>
      `🛵 ${p.nombre} — ${fmtEur2(p.euros)} · ${p.pedidos} ped${p.nombre === lider.nombre ? ' ⭐' : ''}`),
    `📦 ${hoy.pedidos} pedidos · TM ${fmtNum2(tm)}`,
    objetivoDia > 0
      ? (hoy.total >= objetivoDia
          ? `🎯 Objetivo ${fmtEur2(objetivoDia)}: superado +${fmtEur2(hoy.total - objetivoDia)} ✅`
          : `🎯 Objetivo ${fmtEur2(objetivoDia)}: faltan ${fmtEur2(objetivoDia - hoy.total)} ❌`)
      : '',
    semana > 0 ? `📅 Semana: ${fmtEur2(semana)}` : '',
    ``,
    `🏆 *Top marcas:*`,
    ...Array.from(hoy.porMarca.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([n, v], i) => `${i + 1}. ${n} — ${fmtNum2(v)}`),
    ...(platos.length > 0
      ? [``, `🍽️ *Top platos:*`, ...platos.map((p, i) => `${i + 1}. ${p.plato} (${p.uds}u)`)]
      : []),
  ].filter(Boolean).join('\n')

  return {
    asunto: `Cierre ${fechaLarga} · ${fmtEur2(hoy.total)}`,
    contenido_whatsapp: wa,
    contenido_email: wa,
  }
}

/**
 * 5) RESUMEN DE LA MAÑANA — cierre completo de AYER (email 08:00)
 */
export async function resumenManana(): Promise<InformeContenido> {
  const ayer = new Date()
  ayer.setDate(ayer.getDate() - 1)
  const base = await cierreDiario(ayer)
  const wa = base.contenido_whatsapp.replace('📊 *STREAT LAB · Facturación', '☀️ *AYER · Facturación')
  return {
    asunto: `☀️ Resumen de ayer · ${base.asunto.replace(/^Cierre /, '')}`,
    contenido_whatsapp: wa,
    contenido_email: wa,
  }
}

/**
 * 6) PULSO DE LA TARDE (16:30) — venta acumulada EN VIVO vs objetivo,
 * proyección de cierre del día y referencia del mismo día pasado.
 */
export async function pulsoTarde(): Promise<InformeContenido> {
  const f = new Date()
  const fAnt = new Date(f)
  fAnt.setDate(fAnt.getDate() - 7)
  const fechaStr = isoFecha(f)

  // Acumulado del día EN VIVO (snapshot TOTAL de ventas_vivo)
  const { data: vivo } = await supabaseAdmin
    .from('ventas_vivo')
    .select('facturacion, pedidos')
    .eq('fecha', fechaStr)
    .eq('plataforma', 'TOTAL')
    .order('momento', { ascending: false })
    .limit(1)
    .maybeSingle()

  const acum = Number((vivo as any)?.facturacion || 0)
  const pedidos = Number((vivo as any)?.pedidos || 0)

  const [antes, objetivoDia, platos] = await Promise.all([
    datosDia(isoFecha(fAnt)),
    objetivoDelDia(f),
    topPlatosVivo(fechaStr, 3),
  ])

  const pctObjetivo = objetivoDia > 0 ? (acum / objetivoDia) * 100 : 0

  // Proyección "a este paso": jornada de venta 12:00–24:00 (Madrid)
  const ahoraMadrid = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
  const horaDec = ahoraMadrid.getHours() + ahoraMadrid.getMinutes() / 60
  const frac = Math.min(1, Math.max(0.08, (horaDec - 12) / 12))
  const proyeccion = frac > 0 ? acum / frac : acum

  const fechaLegible = `${DIAS[f.getDay()]} ${f.getDate()}/${f.getMonth() + 1}`

  const wa = [
    `⏱ *PULSO 16:30 · ${fechaLegible}*`,
    `━━━━━━━━━━━━━━━━━`,
    `💰 Llevamos: *${fmtEur2(acum)}* · ${pedidos} pedidos`,
    objetivoDia > 0 ? `🎯 ${pctObjetivo.toFixed(0)}% del objetivo del día (${fmtEur2(objetivoDia)})` : '',
    acum > 0 ? `🔮 A este paso, cerramos el día en ~${fmtEur2(proyeccion)}` : '',
    antes.total > 0 ? `📌 El ${DIAS[fAnt.getDay()].toLowerCase()} pasado cerró en ${fmtEur2(antes.total)}` : '',
    ...(platos.length > 0
      ? [``, `🍽️ *Top platos ahora:*`, ...platos.map((p, i) => `${i + 1}. ${p.plato} (${p.uds}u)`)]
      : []),
    `━━━━━━━━━━━━━━━━━`,
  ].filter(Boolean).join('\n')

  return {
    asunto: `Pulso 16:30 · ${fmtEur2(acum)}${objetivoDia > 0 ? ` (${pctObjetivo.toFixed(0)}% obj.)` : ''}`,
    contenido_whatsapp: wa,
    contenido_email: wa,
  }
}

/**
 * 2) COBROS PENDIENTES SEMANALES
 */
export async function cobrosLunes(): Promise<InformeContenido> {
  const hoy = new Date()

  const { data: reglas } = await supabaseAdmin
    .from('facturas_esperadas')
    .select('proveedor_nombre, frecuencia, dia_semana, dia_mes_1, dia_mes_2, importe_estimado')
    .eq('activo', true)

  const proximos: Array<{ fecha: Date; nombre: string; importe: number | null }> = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(hoy)
    d.setDate(hoy.getDate() + i)
    for (const r of (reglas || []) as any[]) {
      const nombre = r.proveedor_nombre || 'Plataforma'
      const importe = r.importe_estimado != null ? Number(r.importe_estimado) : null
      const coincideSemana = r.dia_semana != null && d.getDay() === Number(r.dia_semana)
      const coincideMes = [r.dia_mes_1, r.dia_mes_2].some((dm: any) => dm != null && Number(dm) === d.getDate())
      const esSemanal = r.frecuencia === 'semanal' && coincideSemana
      const esPorDiaMes = ['quincenal', 'mensual', 'bimensual'].includes(r.frecuencia) && coincideMes
      if (esSemanal || esPorDiaMes) {
        proximos.push({ fecha: new Date(d), nombre, importe })
      }
    }
  }
  proximos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime())

  const total = proximos.reduce((s, p) => s + (p.importe || 0), 0)
  const hayImportes = proximos.some(p => p.importe != null)

  const wa = [
    `💰 *COBROS ESTA SEMANA*`,
    `━━━━━━━━━━━━━━━━━`,
    hayImportes ? `Total estimado: *${fmtEur(total)}*` : '',
    ...(proximos.length === 0
      ? ['Sin cobros previstos esta semana.']
      : proximos.map(p => {
          const fecha = p.fecha.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })
          return `${fecha} · ${p.nombre}${p.importe != null ? `: ${fmtEur(p.importe)}` : ''}`
        })),
    `━━━━━━━━━━━━━━━━━`,
  ].filter(Boolean).join('\n')

  return {
    asunto: hayImportes ? `Cobros esta semana · ${fmtEur(total)}` : `Cobros esta semana · ${proximos.length} previstos`,
    contenido_whatsapp: wa,
    contenido_email: wa,
  }
}

/**
 * 3) CIERRE SEMANAL
 */
export async function cierreSemanal(): Promise<InformeContenido> {
  const hoy = new Date()
  const lunes = new Date(hoy)
  const dia = hoy.getDay()
  const diff = dia === 0 ? 6 : dia - 1
  lunes.setDate(hoy.getDate() - diff)
  const lunesStr = isoFecha(lunes)
  const hoyStr = isoFecha(hoy)

  const lunesAnt = new Date(lunes)
  lunesAnt.setDate(lunes.getDate() - 7)
  const domingoAnt = new Date(lunesAnt)
  domingoAnt.setDate(lunesAnt.getDate() + 6)

  const { data: estaSem } = await supabaseAdmin
    .from('facturacion_diario')
    .select('total_bruto, marca_id, marcas(nombre)')
    .gte('fecha', lunesStr)
    .lte('fecha', hoyStr)

  const { data: semAnt } = await supabaseAdmin
    .from('facturacion_diario')
    .select('total_bruto')
    .gte('fecha', isoFecha(lunesAnt))
    .lte('fecha', isoFecha(domingoAnt))

  const totalSem = (estaSem || []).reduce((s, r: any) => s + Number(r.total_bruto || 0), 0)
  const totalSemAnt = (semAnt || []).reduce((s, r: any) => s + Number(r.total_bruto || 0), 0)
  const delta = totalSemAnt > 0 ? ((totalSem - totalSemAnt) / totalSemAnt) * 100 : 0

  const porMarca = new Map<string, number>()
  for (const r of estaSem || []) {
    const nombre = (r as any).marcas?.nombre || 'Sin marca'
    porMarca.set(nombre, (porMarca.get(nombre) || 0) + Number((r as any).total_bruto || 0))
  }

  const ranking = Array.from(porMarca.entries()).sort(([, a], [, b]) => b - a)
  const fechaLegible = `${lunes.getDate()}/${lunes.getMonth() + 1} - ${hoy.getDate()}/${hoy.getMonth() + 1}`

  const wa = [
    `📊 *CIERRE SEMANAL*`,
    `${fechaLegible}`,
    `━━━━━━━━━━━━━━━━━`,
    `Facturación: *${fmtEur(totalSem)}*`,
    totalSemAnt > 0 ? `vs sem anterior (${fmtEur(totalSemAnt)}): ${semaforo(delta)} ${fmtPct(delta)}` : '',
    ``,
    `*Top marcas:*`,
    ...ranking.slice(0, 5).map(([n, v], i) => `${i + 1}. ${n}: ${fmtEur(v)}`),
    `━━━━━━━━━━━━━━━━━`,
  ].filter(Boolean).join('\n')

  return {
    asunto: `Cierre semanal · ${fmtEur(totalSem)}`,
    contenido_whatsapp: wa,
    contenido_email: wa,
  }
}

/**
 * 4) CIERRE MENSUAL
 */
export async function cierreMensual(): Promise<InformeContenido> {
  const hoy = new Date()
  const mes = hoy.getMonth() === 0 ? 12 : hoy.getMonth()
  const anio = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear()
  const mesPrev = mes === 1 ? 12 : mes - 1
  const anioPrev = mes === 1 ? anio - 1 : anio

  const [{ data: ingresos }, { data: ingresosPrev }, { data: gastos }, { data: presupuestos }] = await Promise.all([
    supabaseAdmin.from('ingresos_mensuales').select('importe').eq('anio', anio).eq('mes', mes).eq('tipo', 'neto'),
    supabaseAdmin.from('ingresos_mensuales').select('importe').eq('anio', anioPrev).eq('mes', mesPrev).eq('tipo', 'neto'),
    supabaseAdmin.from('gastos').select('importe')
      .gte('fecha', `${anio}-${String(mes).padStart(2, '0')}-01`)
      .lte('fecha', `${anio}-${String(mes).padStart(2, '0')}-31`),
    supabaseAdmin.from('presupuestos_mensuales').select('tope').eq('anio', anio).eq('mes', mes),
  ])

  const totalIng = (ingresos || []).reduce((s, r: any) => s + Number(r.importe || 0), 0)
  const totalIngPrev = (ingresosPrev || []).reduce((s, r: any) => s + Number(r.importe || 0), 0)
  const totalGas = (gastos || []).reduce((s, r: any) => s + Number(r.importe || 0), 0)
  const presupGas = (presupuestos || []).reduce((s, r: any) => s + Number(r.tope || 0), 0)
  const margen = totalIng - totalGas
  const deltaIng = totalIngPrev > 0 ? ((totalIng - totalIngPrev) / totalIngPrev) * 100 : 0
  const deltaGas = presupGas > 0 ? ((totalGas - presupGas) / presupGas) * 100 : 0

  const mesesAbbr = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const mesLegible = `${mesesAbbr[mes - 1]} ${anio}`

  const wa = [
    `📈 *CIERRE MENSUAL · ${mesLegible}*`,
    `━━━━━━━━━━━━━━━━━`,
    `💰 Ingresos netos: ${fmtEur(totalIng)}`,
    totalIngPrev > 0 ? `   vs mes anterior: ${semaforo(deltaIng)} ${fmtPct(deltaIng)}` : '',
    ``,
    `💸 Gastos: ${fmtEur(totalGas)}`,
    presupGas > 0 ? `   vs presupuesto (${fmtEur(presupGas)}): ${semaforo(-deltaGas)} ${fmtPct(deltaGas)}` : '',
    ``,
    `📊 *Margen: ${fmtEur(margen)}*`,
    `━━━━━━━━━━━━━━━━━`,
  ].filter(Boolean).join('\n')

  return {
    asunto: `Cierre ${mesLegible} · Margen ${fmtEur(margen)}`,
    contenido_whatsapp: wa,
    contenido_email: wa,
  }
}

/**
 * Dispatcher principal
 */
export async function calcularInforme(tipo: TipoInforme): Promise<InformeContenido> {
  switch (tipo) {
    case 'cierre_diario': return cierreDiario()
    case 'cobros_lunes': return cobrosLunes()
    case 'cierre_semanal': return cierreSemanal()
    case 'cierre_mensual': return cierreMensual()
    case 'resumen_manana': return resumenManana()
    case 'pulso': return pulsoTarde()
  }
}
