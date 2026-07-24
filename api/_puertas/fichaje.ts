// FICHAJE · API del quiosco de tablet (ruta pública /fichaje, sin sesión ERP).
// Seguridad: nada se hace sin PIN. El listado de estado solo expone nombre/foto/estado.
// CANDADO 24-jul: desde la tablet NO se puede consultar ni corregir el registro.
// Las acciones admin-* exigen O BIEN la llave de servidor FICHAJE_ADMIN_TOKEN
// (servidor a servidor) O BIEN el PIN de administración (pin_admin en el cuerpo),
// que es como entra el ERP: así ningún secreto viaja al navegador.
// Registro de jornada RD-ley 8/2019: append-only en BD (trigger), correcciones trazadas.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'

const TZ = 'Europe/Madrid'

type Fila = { id: string; empleado_id: string; tipo: string; timestamp: string; correccion: boolean; correccion_motivo: string | null; anula_id: string | null; origen: string | null }

/** Llave de servidor: separa "lo que puede la tablet" de "lo que puede el ERP". */
function esErpAutorizado(req: VercelRequest): boolean {
  const llave = process.env.FICHAJE_ADMIN_TOKEN || ''
  if (!llave) return false
  const enviada = String(req.headers['x-fichaje-admin'] || '')
  return enviada.length > 0 && enviada === llave
}

function hoyMadridISO(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date()) // YYYY-MM-DD
}

/** Filtra fichajes válidos (sin correcciones-anulación pendientes) y ordena. */
function validos(filas: Fila[]): Fila[] {
  const anulados = new Set(filas.map(f => f.anula_id).filter(Boolean) as string[])
  return filas
    .filter(f => !anulados.has(f.id))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

/** Minutos trabajados y de pausa de una secuencia de fichajes de un día. */
function resumenDia(filas: Fila[], ahora = new Date()) {
  let trabajo = 0, pausa = 0
  let abiertoTrabajo: Date | null = null, abiertaPausa: Date | null = null
  for (const f of filas) {
    const t = new Date(f.timestamp)
    if (f.tipo === 'entrada') abiertoTrabajo = t
    if (f.tipo === 'pausa_inicio' && abiertoTrabajo) { trabajo += (t.getTime() - abiertoTrabajo.getTime()); abiertoTrabajo = null; abiertaPausa = t }
    if (f.tipo === 'pausa_fin' && abiertaPausa) { pausa += (t.getTime() - abiertaPausa.getTime()); abiertaPausa = null; abiertoTrabajo = t }
    if (f.tipo === 'salida' && abiertoTrabajo) { trabajo += (t.getTime() - abiertoTrabajo.getTime()); abiertoTrabajo = null }
  }
  if (abiertoTrabajo) trabajo += (ahora.getTime() - abiertoTrabajo.getTime())
  if (abiertaPausa) pausa += (ahora.getTime() - abiertaPausa.getTime())
  const ultimo = filas[filas.length - 1] || null
  const estado = !ultimo ? 'fuera' : ultimo.tipo === 'entrada' || ultimo.tipo === 'pausa_fin' ? 'trabajando' : ultimo.tipo === 'pausa_inicio' ? 'pausa' : 'fuera'
  const primeraEntrada = filas.find(f => f.tipo === 'entrada') || null
  const salida = [...filas].reverse().find(f => f.tipo === 'salida') || null
  return {
    estado,
    min_trabajo: Math.round(trabajo / 60000),
    min_pausa: Math.round(pausa / 60000),
    ultimo_ts: ultimo?.timestamp || null,
    entrada_ts: primeraEntrada?.timestamp || null,
    salida_ts: salida?.timestamp || null,
  }
}

async function fichajesDelDia(fecha: string): Promise<Fila[]> {
  // fecha es día natural Madrid → traer margen amplio UTC y filtrar en JS
  const desde = new Date(`${fecha}T00:00:00+02:00`); desde.setHours(desde.getHours() - 3)
  const hasta = new Date(`${fecha}T23:59:59+02:00`); hasta.setHours(hasta.getHours() + 3)
  const { data, error } = await supabaseAdmin
    .from('fichajes')
    .select('id, empleado_id, tipo, timestamp, correccion, correccion_motivo, anula_id, origen')
    .gte('timestamp', desde.toISOString())
    .lte('timestamp', hasta.toISOString())
    .order('timestamp', { ascending: true })
  if (error) throw new Error(error.message)
  const enDia = (ts: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date(ts)) === fecha
  return ((data || []) as Fila[]).filter(f => enDia(f.timestamp))
}

async function adminPinOk(pin: string): Promise<boolean> {
  if (!pin) return false
  const { data, error } = await supabaseAdmin.rpc('fn_fichaje_admin_pin_ok', { p_pin: pin })
  if (error) return false
  return data === true
}

/** Puerta de gestión: llave de servidor (máquina) o PIN de administración (ERP). */
async function gestionAutorizada(req: VercelRequest): Promise<boolean> {
  if (esErpAutorizado(req)) return true
  const pin = String((req.body as { pin_admin?: string })?.pin_admin || '')
  return await adminPinOk(pin)
}

// ── GET /api/fichaje/estado ────────────────────────────────────────────────
async function estado(_req: VercelRequest, res: VercelResponse) {
  const fecha = hoyMadridISO()
  const [{ data: emps, error: e1 }, filasDia] = await Promise.all([
    supabaseAdmin
      .from('empleados')
      .select('id, nombre, foto_url, orden')
      .eq('activo', true)
      .eq('fichaje_activo', true)
      .not('pin_hash', 'is', null)
      .neq('es_empleador', true)
      .order('orden', { ascending: true, nullsFirst: false })
      .order('nombre'),
    fichajesDelDia(fecha),
  ])
  if (e1) return res.status(500).json({ error: e1.message })

  const ids = (emps || []).map(e => e.id)
  const { data: hors } = await supabaseAdmin
    .from('horarios')
    .select('empleado_id, hora_inicio, hora_fin, turno_tipo')
    .eq('fecha', fecha)
    .in('empleado_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])

  const porEmp = new Map<string, Fila[]>()
  for (const f of validos(filasDia)) {
    if (!f.empleado_id) continue
    if (!porEmp.has(f.empleado_id)) porEmp.set(f.empleado_id, [])
    porEmp.get(f.empleado_id)!.push(f)
  }

  const hora = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
  const h = parseInt(hora.split(':')[0], 10)
  const turno = h >= 17 || h < 5 ? 'CENA' : 'COMIDA'

  const empleados = (emps || []).map(e => {
    const r = resumenDia(porEmp.get(e.id) || [])
    const horariosEmp = (hors || []).filter(x => x.empleado_id === e.id)
    return {
      id: e.id,
      nombre: e.nombre,
      foto_url: e.foto_url,
      estado: r.estado,
      ultimo_ts: r.ultimo_ts,
      entrada_ts: r.entrada_ts,
      min_trabajo: r.min_trabajo,
      min_pausa: r.min_pausa,
      horario_hoy: horariosEmp.map(x => ({ inicio: x.hora_inicio, fin: x.hora_fin, turno: x.turno_tipo })),
    }
  })
  return res.status(200).json({ fecha, turno, empleados })
}

// ── POST /api/fichaje/fichar {empleado_id, pin, tipo, ts?} ─────────────────
async function fichar(req: VercelRequest, res: VercelResponse) {
  const { empleado_id, pin, tipo, ts } = (req.body || {}) as { empleado_id?: string; pin?: string; tipo?: string; ts?: string }
  if (!empleado_id || !pin || !tipo) return res.status(400).json({ error: 'Faltan datos' })
  const { data, error } = await supabaseAdmin.rpc('fn_fichar', {
    p_emp: empleado_id, p_pin: pin, p_tipo: tipo, p_origen: 'tablet', p_ts: ts || null,
  })
  if (error) return res.status(500).json({ error: error.message })
  const out = data as { ok: boolean; motivo?: string }
  if (!out.ok) return res.status(200).json(out)
  // Resumen del día tras fichar (para la pantalla de confirmación)
  const filas = validos((await fichajesDelDia(hoyMadridISO())).filter(f => f.empleado_id === empleado_id))
  return res.status(200).json({ ...out, resumen: resumenDia(filas) })
}

// ── POST /api/fichaje/quiosco-desbloquear {pin} ────────────────────────────
// Único uso del PIN de administración desde la tablet: soltar el candado del
// dispositivo. No devuelve ningún dato de fichajes.
async function quioscoDesbloquear(req: VercelRequest, res: VercelResponse) {
  const { pin } = (req.body || {}) as { pin?: string }
  const ok = await adminPinOk(pin || '')
  return res.status(200).json({ ok })
}

// ── Acciones de gestión: solo ERP (PIN admin) o llave de servidor ──────────
async function adminEmpleados(_req: VercelRequest, res: VercelResponse) {
  const { data, error } = await supabaseAdmin
    .from('empleados')
    .select('id, nombre, nif, fichaje_activo, orden')
    .eq('activo', true)
    .order('orden', { ascending: true, nullsFirst: false })
    .order('nombre')
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ empleados: data || [] })
}

async function adminRegistros(req: VercelRequest, res: VercelResponse) {
  const dia = String((req.body as { fecha?: string })?.fecha || hoyMadridISO())
  const filas = await fichajesDelDia(dia)
  const { data: emps } = await supabaseAdmin.from('empleados').select('id, nombre').eq('activo', true)
  const nombres = new Map((emps || []).map(e => [e.id, e.nombre]))
  const { data: hors } = await supabaseAdmin
    .from('horarios')
    .select('empleado_id, hora_inicio, hora_fin')
    .eq('fecha', dia)
  const porEmp = new Map<string, Fila[]>()
  for (const f of validos(filas)) {
    if (!f.empleado_id) continue
    if (!porEmp.has(f.empleado_id)) porEmp.set(f.empleado_id, [])
    porEmp.get(f.empleado_id)!.push(f)
  }
  const registros = [...porEmp.entries()].map(([id, fs]) => {
    const hor = (hors || []).find(h => h.empleado_id === id)
    return {
      empleado_id: id,
      nombre: nombres.get(id) || '¿?',
      previsto_inicio: hor?.hora_inicio || null,
      previsto_fin: hor?.hora_fin || null,
      eventos: fs.map(f => ({ id: f.id, tipo: f.tipo, ts: f.timestamp, correccion: f.correccion, motivo: f.correccion_motivo })),
      ...resumenDia(fs),
    }
  })
  // Quien tenía horario previsto y no aparece: ausencia visible
  for (const h of hors || []) {
    if (!porEmp.has(h.empleado_id)) {
      registros.push({
        empleado_id: h.empleado_id,
        nombre: nombres.get(h.empleado_id) || '¿?',
        previsto_inicio: h.hora_inicio,
        previsto_fin: h.hora_fin,
        eventos: [],
        estado: 'fuera',
        min_trabajo: 0,
        min_pausa: 0,
        ultimo_ts: null,
        entrada_ts: null,
        salida_ts: null,
      })
    }
  }
  registros.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return res.status(200).json({ fecha: dia, registros })
}

async function adminCorregir(req: VercelRequest, res: VercelResponse) {
  const { empleado_id, tipo, ts, motivo, anula_id } = (req.body || {}) as Record<string, string | undefined>
  if (!empleado_id || !motivo || (!anula_id && (!tipo || !ts))) return res.status(400).json({ error: 'Faltan datos (motivo obligatorio)' })
  if (anula_id) {
    // Anulación pura: fila de corrección que anula otra, sin evento nuevo
    const { data: orig } = await supabaseAdmin.from('fichajes').select('tipo, timestamp').eq('id', anula_id).single()
    if (!orig) return res.status(404).json({ error: 'Fichaje a anular no encontrado' })
    const { error } = await supabaseAdmin.from('fichajes').insert({
      empleado_id, tipo: tipo || orig.tipo, timestamp: ts || orig.timestamp,
      origen: 'admin', correccion: true, correccion_motivo: motivo, anula_id,
    })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }
  // Alta manual de un evento olvidado (queda marcado como corrección)
  const { error } = await supabaseAdmin.from('fichajes').insert({
    empleado_id, tipo, timestamp: ts, origen: 'admin', correccion: true, correccion_motivo: motivo,
  })
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}

async function adminInforme(req: VercelRequest, res: VercelResponse) {
  const { empleado_id, mes } = (req.body || {}) as Record<string, string | undefined>
  if (!empleado_id || !mes) return res.status(400).json({ error: 'Faltan datos' })
  const [y, m] = mes.split('-').map(Number)
  const dias = new Date(y, m, 0).getDate()
  const salida: Array<Record<string, unknown>> = []
  const desde = new Date(`${mes}-01T00:00:00+02:00`); desde.setHours(desde.getHours() - 3)
  const hastaD = new Date(`${mes}-${String(dias).padStart(2, '0')}T23:59:59+02:00`); hastaD.setHours(hastaD.getHours() + 3)
  const { data, error } = await supabaseAdmin
    .from('fichajes')
    .select('id, empleado_id, tipo, timestamp, correccion, correccion_motivo, anula_id, origen')
    .eq('empleado_id', empleado_id)
    .gte('timestamp', desde.toISOString())
    .lte('timestamp', hastaD.toISOString())
    .order('timestamp', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  const { data: hors } = await supabaseAdmin
    .from('horarios').select('fecha, hora_inicio, hora_fin')
    .eq('empleado_id', empleado_id)
    .gte('fecha', `${mes}-01`).lte('fecha', `${mes}-${String(dias).padStart(2, '0')}`)
  const { data: emp } = await supabaseAdmin.from('empleados').select('nombre, nif').eq('id', empleado_id).single()
  const fmtDia = (ts: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date(ts))
  const vals = validos((data || []) as Fila[])
  for (let d = 1; d <= dias; d++) {
    const f = `${mes}-${String(d).padStart(2, '0')}`
    const fs = vals.filter(x => fmtDia(x.timestamp) === f)
    const hor = (hors || []).find(h => h.fecha === f)
    if (!fs.length && !hor) continue
    const r = fs.length
      ? resumenDia(fs, new Date(fs[fs.length - 1].timestamp))
      : { estado: 'fuera', min_trabajo: 0, min_pausa: 0, ultimo_ts: null, entrada_ts: null, salida_ts: null }
    salida.push({ fecha: f, ...r, previsto_inicio: hor?.hora_inicio || null, previsto_fin: hor?.hora_fin || null, corregido: fs.some(x => x.correccion) })
  }
  return res.status(200).json({ empleado_id, nombre: emp?.nombre || '', nif: emp?.nif || null, mes, dias: salida })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || '')
  try {
    // Puertas abiertas a la tablet: solo ver quién ficha, fichar y soltar el candado.
    if (action === 'estado') return await estado(req, res)
    if (action === 'fichar') return await fichar(req, res)
    if (action === 'quiosco-desbloquear') return await quioscoDesbloquear(req, res)

    // Puertas cerradas: gestión del registro. Llave de servidor o PIN de admin.
    if (action === 'admin-registros' || action === 'admin-corregir' || action === 'admin-informe' || action === 'admin-empleados') {
      if (!(await gestionAutorizada(req))) return res.status(403).json({ error: 'Acceso no autorizado' })
      if (action === 'admin-registros') return await adminRegistros(req, res)
      if (action === 'admin-corregir') return await adminCorregir(req, res)
      if (action === 'admin-empleados') return await adminEmpleados(req, res)
      return await adminInforme(req, res)
    }

    return res.status(404).json({ error: `unknown action: ${action}` })
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Error' })
  }
}
