/**
 * cajaExtracto — caja automática desde el extracto bancario real.
 *
 * Sustituye la clave manual `configuracion.saldo_banco_actual` como fuente
 * principal de "caja actual": se calcula sola a partir del ÚLTIMO saldo de
 * `conciliacion.saldo` (columna que trae el saldo bancario tras cada
 * movimiento) de cada `titular_id`, sumando todos los titulares con datos.
 *
 * Un titular sin filas de saldo en el extracto se ignora (no rompe el total).
 * Si NINGÚN titular tiene saldo de extracto, se usa como respaldo la clave
 * manual `configuracion.saldo_banco_actual` (histórico, por si algún día no
 * hay extracto cargado).
 *
 * Encadenado del último día: el extracto trae varias filas con saldo por
 * día (una por movimiento) y no existe una columna fiable de orden dentro
 * del mismo día (orden_linea/created_at llegan vacíos o idénticos en la
 * importación por lotes). Para saber cuál es real y verdaderamente la
 * última, reconstruimos la cadena de saldos del día: la fila B sigue a la
 * fila A si `A.saldo === B.saldo - B.importe` (el saldo de B es el de A más
 * su propio movimiento). La fila "terminal" (a la que ninguna otra fila
 * sigue) es el saldo final del día. Si un movimiento duplicado se omitió en
 * la importación puede quedar más de una fila terminal (hueco en la
 * cadena); en ese caso nos quedamos con la de cadena más corta, porque un
 * fragmento aislado de pocas filas es casi siempre el movimiento más
 * tardío del día que quedó suelto por el hueco, no el arranque de la
 * cadena larga ya encadenada desde el principio del día.
 */
import { supabase } from '@/lib/supabase'

export interface CajaAutomatica {
  caja: number
  origen: 'extracto' | 'manual' | 'sin_datos'
  detalle: { titular_id: string; fecha: string; saldo: number }[]
}

interface FilaSaldo {
  titular_id: string
  fecha: string
  saldo: number
  importe: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Saldo final del día a partir de las filas de ESE día para UN titular. */
function saldoFinalDelDia(filas: FilaSaldo[]): number {
  if (filas.length === 0) return 0
  if (filas.length === 1) return filas[0].saldo

  const tieneSucesor = (f: FilaSaldo) =>
    filas.some(g => g !== f && round2(g.saldo - g.importe) === round2(f.saldo))

  const terminales = filas.filter(f => !tieneSucesor(f))
  if (terminales.length === 1) return terminales[0].saldo
  if (terminales.length === 0) return filas[filas.length - 1].saldo // no debería ocurrir; red de seguridad

  const longitudCadena = (f: FilaSaldo): number => {
    let n = 1
    let cur = f
    let guard = 0
    while (guard++ < filas.length) {
      const prev = filas.find(g => round2(g.saldo) === round2(cur.saldo - cur.importe))
      if (!prev) break
      n++
      cur = prev
    }
    return n
  }

  return terminales.reduce((min, f) => (longitudCadena(f) < longitudCadena(min) ? f : min)).saldo
}

export async function getCajaAutomatica(): Promise<CajaAutomatica> {
  // Ventana de 60 días: de sobra para cubrir el último día con saldo de
  // cada titular y su día anterior (para el encadenado), sin traer todo
  // el histórico de conciliación.
  const desde = new Date()
  desde.setDate(desde.getDate() - 60)
  const desdeISO = desde.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('conciliacion')
    .select('titular_id,fecha,saldo,importe')
    .not('saldo', 'is', null)
    .gte('fecha', desdeISO)
    .order('fecha', { ascending: true })
  if (error) throw error

  const filas = (data || []) as { titular_id: string | null; fecha: string; saldo: string | number; importe: string | number }[]

  const porTitular = new Map<string, FilaSaldo[]>()
  for (const r of filas) {
    if (!r.titular_id) continue
    const arr = porTitular.get(r.titular_id) ?? []
    arr.push({ titular_id: r.titular_id, fecha: r.fecha, saldo: Number(r.saldo), importe: Number(r.importe) })
    porTitular.set(r.titular_id, arr)
  }

  const detalle: CajaAutomatica['detalle'] = []
  for (const [titular_id, filasTitular] of porTitular) {
    const ultimaFecha = filasTitular.reduce((max, f) => (f.fecha > max ? f.fecha : max), filasTitular[0].fecha)
    const filasUltimoDia = filasTitular.filter(f => f.fecha === ultimaFecha)
    const saldo = saldoFinalDelDia(filasUltimoDia)
    detalle.push({ titular_id, fecha: ultimaFecha, saldo })
  }

  if (detalle.length > 0) {
    const caja = detalle.reduce((s, d) => s + d.saldo, 0)
    return { caja, origen: 'extracto', detalle }
  }

  // Respaldo: ningún titular tiene saldo de extracto en los últimos 60 días.
  const { data: cfgRow } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('clave', 'saldo_banco_actual')
    .maybeSingle()
  if (cfgRow?.valor != null && cfgRow.valor !== '') {
    const v = parseFloat(String(cfgRow.valor).replace(',', '.'))
    return { caja: isNaN(v) ? 0 : v, origen: 'manual', detalle: [] }
  }

  return { caja: 0, origen: 'sin_datos', detalle: [] }
}
