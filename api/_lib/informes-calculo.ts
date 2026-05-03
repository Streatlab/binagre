/**
 * Calculadora de informes — genera el contenido textual de cada tipo
 * a partir de datos reales de Supabase.
 *
 * Cada función devuelve { asunto, contenido } listos para enviar
 * por WhatsApp o email.
 */
import { supabaseAdmin } from './supabase-admin.js'

export type TipoInforme = 'cierre_diario' | 'cobros_lunes' | 'cierre_semanal' | 'cierre_mensual'

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

/**
 * 1) CIERRE DIARIO — facturación del día por marca y plataforma
 */
export async function cierreDiario(fecha?: Date): Promise<InformeContenido> {
  const f = fecha ?? new Date()
  const fechaStr = f.toISOString().split('T')[0]

  // Día anterior comparable (mismo día semana anterior)
  const fAnt = new Date(f)
  fAnt.setDate(fAnt.getDate() - 7)
  const fechaAntStr = fAnt.toISOString().split('T')[0]

  // Datos del día y semana anterior
  const { data: hoy } = await supabaseAdmin
    .from('facturacion_diario')
    .select('total, marca_id, marcas(nombre)')
    .eq('fecha', fechaStr)

  const { data: antes } = await supabaseAdmin
    .from('facturacion_diario')
    .select('total, marca_id')
    .eq('fecha', fechaAntStr)

  // Objetivo del día (de la tabla objetivos_dia_semana)
  const diaSemana = f.getDay() // 0=domingo, 6=sábado
  const { data: objetivos } = await supabaseAdmin
    .from('objetivos_dia_semana')
    .select('objetivo')
    .eq('dia_semana', diaSemana)
    .single()

  const totalHoy = (hoy || []).reduce((s, r: any) => s + Number(r.total || 0), 0)
  const totalAntes = (antes || []).reduce((s, r: any) => s + Number(r.total || 0), 0)
  const objetivoDia = Number(objetivos?.objetivo || 0)

  const deltaPctVsAntes = totalAntes > 0 ? ((totalHoy - totalAntes) / totalAntes) * 100 : 0
  const deltaPctVsObj = objetivoDia > 0 ? ((totalHoy - objetivoDia) / objetivoDia) * 100 : 0

  // Por marca
  const porMarca = new Map<string, { hoy: number; antes: number }>()
  for (const r of hoy || []) {
    const nombre = (r as any).marcas?.nombre || 'Sin marca'
    const cur = porMarca.get(nombre) || { hoy: 0, antes: 0 }
    cur.hoy += Number((r as any).total || 0)
    porMarca.set(nombre, cur)
  }

  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const fechaLegible = `${dias[f.getDay()]} ${f.getDate()}/${f.getMonth() + 1}`

  // WhatsApp (corto)
  const wa = [
    `🍴 *CIERRE ${fechaLegible}*`,
    `━━━━━━━━━━━━━━━━━`,
    `💰 Total: *${fmtEur(totalHoy)}*`,
    objetivoDia > 0 ? `🎯 Objetivo: ${fmtEur(objetivoDia)} ${semaforo(deltaPctVsObj)} ${fmtPct(deltaPctVsObj)}` : '',
    `📈 vs hace 7 días: ${fmtPct(deltaPctVsAntes)}`,
    ``,
    `*Por marca:*`,
    ...Array.from(porMarca.entries())
      .sort(([, a], [, b]) => b.hoy - a.hoy)
      .map(([nombre, v]) => `${semaforo(0)} ${nombre}: ${fmtEur(v.hoy)}`),
    `━━━━━━━━━━━━━━━━━`,
  ].filter(Boolean).join('\n')

  // Email (más completo, mismo cuerpo)
  const email = wa

  return {
    asunto: `Cierre ${fechaLegible} · ${fmtEur(totalHoy)}`,
    contenido_whatsapp: wa,
    contenido_email: email,
  }
}

/**
 * 2) COBROS PENDIENTES SEMANALES — qué nos tienen que ingresar las plataformas
 */
export async function cobrosLunes(): Promise<InformeContenido> {
  const hoy = new Date()
  const finSemana = new Date(hoy)
  finSemana.setDate(hoy.getDate() + 7)

  const hoyStr = hoy.toISOString().split('T')[0]
  const finStr = finSemana.toISOString().split('T')[0]

  const { data: pendientes } = await supabaseAdmin
    .from('facturas_esperadas')
    .select('*')
    .gte('fecha_esperada', hoyStr)
    .lte('fecha_esperada', finStr)
    .order('fecha_esperada')

  const total = (pendientes || []).reduce((s, p: any) => s + Number(p.importe || 0), 0)

  const wa = [
    `💰 *COBROS ESTA SEMANA*`,
    `━━━━━━━━━━━━━━━━━`,
    `Total esperado: *${fmtEur(total)}*`,
    ``,
    ...((pendientes || []).length === 0
      ? ['Sin cobros previstos esta semana.']
      : (pendientes || []).map((p: any) => {
          const fecha = new Date(p.fecha_esperada).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })
          return `${fecha} · ${p.proveedor || p.concepto || 'Plataforma'}: ${fmtEur(Number(p.importe || 0))}`
        })),
    `━━━━━━━━━━━━━━━━━`,
  ].join('\n')

  return {
    asunto: `Cobros esta semana · ${fmtEur(total)}`,
    contenido_whatsapp: wa,
    contenido_email: wa,
  }
}

/**
 * 3) CIERRE SEMANAL — resumen completo lunes a domingo
 */
export async function cierreSemanal(): Promise<InformeContenido> {
  const hoy = new Date()
  const lunes = new Date(hoy)
  const dia = hoy.getDay()
  const diff = dia === 0 ? 6 : dia - 1
  lunes.setDate(hoy.getDate() - diff)
  const lunesStr = lunes.toISOString().split('T')[0]
  const hoyStr = hoy.toISOString().split('T')[0]

  // Semana anterior
  const lunesAnt = new Date(lunes)
  lunesAnt.setDate(lunes.getDate() - 7)
  const domingoAnt = new Date(lunesAnt)
  domingoAnt.setDate(lunesAnt.getDate() + 6)

  const { data: estaSem } = await supabaseAdmin
    .from('facturacion_diario')
    .select('total, marca_id, marcas(nombre)')
    .gte('fecha', lunesStr)
    .lte('fecha', hoyStr)

  const { data: semAnt } = await supabaseAdmin
    .from('facturacion_diario')
    .select('total')
    .gte('fecha', lunesAnt.toISOString().split('T')[0])
    .lte('fecha', domingoAnt.toISOString().split('T')[0])

  const totalSem = (estaSem || []).reduce((s, r: any) => s + Number(r.total || 0), 0)
  const totalSemAnt = (semAnt || []).reduce((s, r: any) => s + Number(r.total || 0), 0)
  const delta = totalSemAnt > 0 ? ((totalSem - totalSemAnt) / totalSemAnt) * 100 : 0

  const porMarca = new Map<string, number>()
  for (const r of estaSem || []) {
    const nombre = (r as any).marcas?.nombre || 'Sin marca'
    porMarca.set(nombre, (porMarca.get(nombre) || 0) + Number((r as any).total || 0))
  }

  const ranking = Array.from(porMarca.entries()).sort(([, a], [, b]) => b - a)
  const fechaLegible = `${lunes.getDate()}/${lunes.getMonth() + 1} - ${hoy.getDate()}/${hoy.getMonth() + 1}`

  const wa = [
    `📊 *CIERRE SEMANAL*`,
    `${fechaLegible}`,
    `━━━━━━━━━━━━━━━━━`,
    `Facturación: *${fmtEur(totalSem)}*`,
    `vs sem anterior: ${semaforo(delta)} ${fmtPct(delta)}`,
    ``,
    `*Top marcas:*`,
    ...ranking.slice(0, 5).map(([n, v], i) => `${i + 1}. ${n}: ${fmtEur(v)}`),
    `━━━━━━━━━━━━━━━━━`,
  ].join('\n')

  return {
    asunto: `Cierre semanal · ${fmtEur(totalSem)}`,
    contenido_whatsapp: wa,
    contenido_email: wa,
  }
}

/**
 * 4) CIERRE MENSUAL — ingresos vs presupuesto, gastos, margen
 */
export async function cierreMensual(): Promise<InformeContenido> {
  const hoy = new Date()
  // Mes anterior (al ejecutarse el día 1)
  const mes = hoy.getMonth() === 0 ? 12 : hoy.getMonth()
  const anio = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear()

  const { data: ingresos } = await supabaseAdmin
    .from('ingresos_mensuales')
    .select('importe')
    .eq('anio', anio)
    .eq('mes', mes)

  const { data: gastos } = await supabaseAdmin
    .from('gastos')
    .select('importe')
    .gte('fecha', `${anio}-${String(mes).padStart(2, '0')}-01`)
    .lte('fecha', `${anio}-${String(mes).padStart(2, '0')}-31`)

  const { data: presupuestos } = await supabaseAdmin
    .from('presupuestos_mensuales')
    .select('importe, tipo')
    .eq('anio', anio)
    .eq('mes', mes)

  const totalIng = (ingresos || []).reduce((s, r: any) => s + Number(r.importe || 0), 0)
  const totalGas = (gastos || []).reduce((s, r: any) => s + Number(r.importe || 0), 0)
  const presupIng = (presupuestos || []).filter((p: any) => p.tipo === 'ingreso').reduce((s, r: any) => s + Number(r.importe || 0), 0)
  const presupGas = (presupuestos || []).filter((p: any) => p.tipo === 'gasto').reduce((s, r: any) => s + Number(r.importe || 0), 0)
  const margen = totalIng - totalGas
  const deltaIng = presupIng > 0 ? ((totalIng - presupIng) / presupIng) * 100 : 0
  const deltaGas = presupGas > 0 ? ((totalGas - presupGas) / presupGas) * 100 : 0

  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const mesLegible = `${meses[mes - 1]} ${anio}`

  const wa = [
    `📈 *CIERRE MENSUAL · ${mesLegible}*`,
    `━━━━━━━━━━━━━━━━━`,
    `💰 Ingresos: ${fmtEur(totalIng)}`,
    presupIng > 0 ? `   vs presup: ${semaforo(deltaIng)} ${fmtPct(deltaIng)}` : '',
    ``,
    `💸 Gastos: ${fmtEur(totalGas)}`,
    presupGas > 0 ? `   vs presup: ${semaforo(-deltaGas)} ${fmtPct(deltaGas)}` : '',
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
  }
}
