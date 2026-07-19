/**
 * Calculadora de informes — genera el contenido textual de cada tipo
 * a partir de datos reales de Supabase.
 *
 * Cada función devuelve { asunto, contenido } listos para enviar
 * por WhatsApp o email.
 *
 * FIX 18 jul 2026: alineado con el esquema real de Supabase
 * (facturacion_diario.total_bruto/total_pedidos, objetivos_dia_semana.dia/importe,
 * ingresos_mensuales tipo='neto', presupuestos_mensuales.tope).
 * Nuevos: resumen_manana (08:00 email, cierre de ayer) y pulso (16:30 WhatsApp).
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

interface DatosDia {
  total: number
  pedidos: number
  porMarca: Map<string, number>
}

async function datosDia(fechaStr: string): Promise<DatosDia> {
  const { data } = await supabaseAdmin
    .from('facturacion_diario')
    .select('total_bruto, total_pedidos, marca_id, marcas(nombre)')
    .eq('fecha', fechaStr)

  let total = 0
  let pedidos = 0
  const porMarca = new Map<string, number>()
  for (const r of (data || []) as any[]) {
    const bruto = Number(r.total_bruto || 0)
    total += bruto
    pedidos += Number(r.total_pedidos || 0)
    const nombre = r.marcas?.nombre || 'Sin marca'
    porMarca.set(nombre, (porMarca.get(nombre) || 0) + bruto)
  }
  return { total, pedidos, porMarca }
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

/**
 * 1) CIERRE DIARIO — facturación del día por marca vs objetivo y vs hace 7 días
 */
export async function cierreDiario(fecha?: Date): Promise<InformeContenido> {
  const f = fecha ?? new Date()
  const fAnt = new Date(f)
  fAnt.setDate(fAnt.getDate() - 7)

  const [hoy, antes, objetivoDia] = await Promise.all([
    datosDia(isoFecha(f)),
    datosDia(isoFecha(fAnt)),
    objetivoDelDia(f),
  ])

  const deltaPctVsAntes = antes.total > 0 ? ((hoy.total - antes.total) / antes.total) * 100 : 0
  const deltaPctVsObj = objetivoDia > 0 ? ((hoy.total - objetivoDia) / objetivoDia) * 100 : 0

  const fechaLegible = `${DIAS[f.getDay()]} ${f.getDate()}/${f.getMonth() + 1}`

  const wa = [
    `🍴 *CIERRE ${fechaLegible}*`,
    `━━━━━━━━━━━━━━━━━`,
    `💰 Total: *${fmtEur(hoy.total)}* · ${hoy.pedidos} pedidos`,
    objetivoDia > 0 ? `🎯 Objetivo: ${fmtEur(objetivoDia)} ${semaforo(deltaPctVsObj)} ${fmtPct(deltaPctVsObj)}` : '',
    antes.total > 0 ? `📈 vs hace 7 días (${fmtEur(antes.total)}): ${semaforo(deltaPctVsAntes)} ${fmtPct(deltaPctVsAntes)}` : '',
    ``,
    `*Por marca:*`,
    ...Array.from(hoy.porMarca.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([nombre, v]) => {
        const ant = antes.porMarca.get(nombre) || 0
        const delta = ant > 0 ? ((v - ant) / ant) * 100 : 0
        return `${ant > 0 ? semaforo(delta) : '⚪'} ${nombre}: ${fmtEur(v)}`
      }),
    `━━━━━━━━━━━━━━━━━`,
  ].filter(Boolean).join('\n')

  return {
    asunto: `Cierre ${fechaLegible} · ${fmtEur(hoy.total)}`,
    contenido_whatsapp: wa,
    contenido_email: wa,
  }
}

/**
 * 5) RESUMEN DE LA MAÑANA — cierre completo de AYER, para el email de las 08:00.
 * Consolidado (jul 2026): los lunes incluye además los COBROS de la semana, y el
 * día 1 de cada mes incluye el CIERRE MENSUAL. Así todo llega en un solo correo y
 * se evita un segundo envío a las 09:00.
 */
export async function resumenManana(): Promise<InformeContenido> {
  const ahora = new Date()
  const ayer = new Date(ahora)
  ayer.setDate(ayer.getDate() - 1)
  const base = await cierreDiario(ayer)

  let wa = base.contenido_whatsapp.replace('🍴 *CIERRE', '☀️ *AYER ·')
  let em = base.contenido_email.replace('🍴 *CIERRE', '☀️ *AYER ·')
  let asunto = `☀️ Resumen de ayer · ${base.asunto.replace(/^Cierre /, '')}`

  // Lunes → añadir los cobros de la semana en el mismo correo
  if (ahora.getDay() === 1) {
    const c = await cobrosLunes()
    wa += `\n\n${c.contenido_whatsapp}`
    em += `\n\n${c.contenido_email}`
    asunto += ' + cobros semana'
  }

  // Día 1 del mes → añadir el cierre del mes anterior en el mismo correo
  if (ahora.getDate() === 1) {
    const m = await cierreMensual()
    wa += `\n\n${m.contenido_whatsapp}`
    em += `\n\n${m.contenido_email}`
    asunto += ' + cierre mes'
  }

  return { asunto, contenido_whatsapp: wa, contenido_email: em }
}

/**
 * 6) PULSO DE LA TARDE (16:30) — venta acumulada del día vs objetivo
 * y referencia del mismo día de la semana pasada (día completo).
 */
export async function pulsoTarde(): Promise<InformeContenido> {
  const f = new Date()
  const fAnt = new Date(f)
  fAnt.setDate(fAnt.getDate() - 7)

  const [hoy, antesCompleto, objetivoDia] = await Promise.all([
    datosDia(isoFecha(f)),
    datosDia(isoFecha(fAnt)),
    objetivoDelDia(f),
  ])

  const pctObjetivo = objetivoDia > 0 ? (hoy.total / objetivoDia) * 100 : 0
  const fechaLegible = `${DIAS[f.getDay()]} ${f.getDate()}/${f.getMonth() + 1}`
  const topMarcas = Array.from(hoy.porMarca.entries()).sort(([, a], [, b]) => b - a).slice(0, 3)

  const wa = [
    `⏱ *PULSO 16:30 · ${fechaLegible}*`,
    `━━━━━━━━━━━━━━━━━`,
    `💰 Llevamos: *${fmtEur(hoy.total)}* · ${hoy.pedidos} pedidos`,
    objetivoDia > 0 ? `🎯 ${pctObjetivo.toFixed(0)}% del objetivo del día (${fmtEur(objetivoDia)})` : '',
    antesCompleto.total > 0 ? `📌 El ${DIAS[fAnt.getDay()].toLowerCase()} pasado cerró en ${fmtEur(antesCompleto.total)}` : '',
    topMarcas.length > 0 ? `` : '',
    topMarcas.length > 0 ? `*Top marcas ahora:*` : '',
    ...topMarcas.map(([n, v], i) => `${i + 1}. ${n}: ${fmtEur(v)}`),
    `━━━━━━━━━━━━━━━━━`,
  ].filter(Boolean).join('\n')

  return {
    asunto: `Pulso 16:30 · ${fmtEur(hoy.total)}${objetivoDia > 0 ? ` (${pctObjetivo.toFixed(0)}% obj.)` : ''}`,
    contenido_whatsapp: wa,
    contenido_email: wa,
  }
}

/**
 * 2) COBROS PENDIENTES SEMANALES — qué nos tienen que ingresar las plataformas.
 * Expande las reglas de facturas_esperadas (frecuencia + días) a fechas
 * concretas de los próximos 7 días.
 */
export async function cobrosLunes(): Promise<InformeContenido> {
  const hoy = new Date()

  const { data: reglas } = await supabaseAdmin
    .from('facturas_esperadas')
    .select('proveedor_nombre, frecuencia, dia_semana, dia_mes_1, dia_mes_2, importe_estimado')
    .eq('activo', true)

  // Expandir ocurrencias de los próximos 7 días según frecuencia
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
 * 3) CIERRE SEMANAL — resumen completo lunes a domingo.
 * Consolidado (jul 2026): al enviarse el domingo por la noche, incluye ARRIBA el
 * cierre del propio domingo (el cierre diario no se manda los domingos), así en un
 * solo WhatsApp va el día + la semana.
 */
export async function cierreSemanal(): Promise<InformeContenido> {
  const hoy = new Date()
  const lunes = new Date(hoy)
  const dia = hoy.getDay()
  const diff = dia === 0 ? 6 : dia - 1
  lunes.setDate(hoy.getDate() - diff)
  const lunesStr = isoFecha(lunes)
  const hoyStr = isoFecha(hoy)

  // Semana anterior
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

  const semanaWa = [
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

  // Cierre del propio domingo arriba (los domingos no se manda cierre diario suelto)
  const cierreHoy = await cierreDiario(hoy)
  const wa = `${cierreHoy.contenido_whatsapp}\n\n${semanaWa}`

  return {
    asunto: `Cierre domingo + semana · ${fmtEur(totalSem)}`,
    contenido_whatsapp: wa,
    contenido_email: wa,
  }
}

/**
 * 4) CIERRE MENSUAL — netos por canal, gastos vs tope de presupuesto, margen
 */
export async function cierreMensual(): Promise<InformeContenido> {
  const hoy = new Date()
  // Mes anterior (al ejecutarse el día 1)
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

  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const mesLegible = `${meses[mes - 1]} ${anio}`

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
 * Dispatcher principal — escoge la calculadora correcta
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
