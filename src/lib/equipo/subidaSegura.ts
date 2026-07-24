/**
 * Subida segura al buzón de EQUIPO (nóminas, resumen, RLC, RNT).
 *
 * Regla: **nada de lo que se sube puede desaparecer en silencio.**
 *
 * Orden de las cosas:
 *   1. GUARDAR el archivo (rápido y sin IA) y apuntarlo en el manifiesto.
 *   2. INTENTAR leerlo.
 *   3. Si la lectura falla o tarda demasiado, el archivo YA está a salvo y su
 *      fila queda en 'registrado' → la repesca automática (cada 15 min) lo
 *      recoge y lo procesa solo, hasta 3 intentos.
 *
 * Y el resultado se cuenta con verdad: cuántos son de personal, cuántos NO lo
 * eran y a qué módulo se han reenviado de verdad, y cuántos se han rechazado
 * por no ser de ningún buzón.
 */
import { supabase } from '@/lib/supabase'

const BUCKET = 'ocr-uploads'
const CARPETA = 'equipo'
const TIMEOUT_DOC_MS = 90_000
const EN_PARALELO = 4

export interface ResultadoEquipo {
  nominas: number
  resumenes: number
  segSocial: number
  revisar: number
  /** Reenviados a otro módulo, con el conteo real por módulo. */
  reencaminados: Record<string, number>
  /** Rechazados: ningún módulo del ERP los reconoce. */
  rechazados: { nombre: string; motivo: string }[]
  aRepescar: number
  errores: string[]
}

async function fetchConTimeout(url: string, init: RequestInit, ms = TIMEOUT_DOC_MS): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { ...init, signal: ctrl.signal }) }
  finally { clearTimeout(t) }
}

async function enParalelo<T>(items: T[], limite: number, tarea: (item: T) => Promise<void>) {
  let siguiente = 0
  const obreros = Array.from({ length: Math.min(limite, items.length) }, async () => {
    for (;;) {
      const i = siguiente++
      if (i >= items.length) return
      await tarea(items[i])
    }
  })
  await Promise.all(obreros)
}

function aBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)) as unknown as number[])
  }
  return btoa(bin)
}

/** Huella del contenido: el mismo archivo no se procesa dos veces aunque se envíe dos veces. */
async function huellaDe(buf: ArrayBuffer): Promise<string | null> {
  try {
    const h = await crypto.subtle.digest('SHA-256', buf)
    return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch { return null }
}

function rutaSegura(nombre: string): string {
  const limpio = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_')
  return `${CARPETA}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${limpio}`
}

/**
 * Envía archivos al buzón de Equipo dejando siempre rastro recuperable.
 * @param onProgreso se llama tras cada archivo con (hechos, total)
 */
// ── Progreso visible desde CUALQUIER dispositivo ────────────────────────────
// Para tandas grandes se apunta una tarea en papeleo_tareas (BD): ProgresoGlobal
// la pinta igual en el ordenador, el móvil o tras cerrar y abrir el navegador.
// Si este navegador muere a mitad, el vigilante del servidor cierra la tarea y
// la repesca termina lo ya guardado; lo no subido se recupera resubiendo la
// carpeta (la huella hace que lo ya hecho no se repita).
const UMBRAL_TAREA_VISIBLE = 10

async function abrirTareaProgreso(total: number): Promise<string | null> {
  if (total < UMBRAL_TAREA_VISIBLE) return null
  try {
    const { data } = await supabase.from('papeleo_tareas')
      .insert({ tipo: 'documentacion_subida', estado: 'en_curso', total_estimado: total, procesados: 0, ok: 0, errores: 0, ultimo_latido: new Date().toISOString(), detalle: 'Subiendo documentación…' })
      .select('id').single()
    return data?.id ?? null
  } catch { return null }
}

async function latirTareaProgreso(id: string | null, procesados: number, ok: number, errores: number, detalle?: string): Promise<void> {
  if (!id) return
  try {
    await supabase.from('papeleo_tareas')
      .update({ procesados, ok, errores, ultimo_latido: new Date().toISOString(), updated_at: new Date().toISOString(), ...(detalle ? { detalle } : {}) })
      .eq('id', id)
  } catch { /* el progreso visual nunca rompe la subida */ }
}

async function cerrarTareaProgreso(id: string | null, procesados: number, ok: number, errores: number): Promise<void> {
  if (!id) return
  try {
    await supabase.from('papeleo_tareas')
      .update({ estado: 'completada', procesados, ok, errores, ultimo_latido: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
  } catch { /* idem */ }
}

export async function enviarAEquipoSeguro(
  archivos: File[],
  onProgreso?: (hechos: number, total: number) => void,
): Promise<ResultadoEquipo> {
  const r: ResultadoEquipo = {
    nominas: 0, resumenes: 0, segSocial: 0, revisar: 0,
    reencaminados: {}, rechazados: [], aRepescar: 0, errores: [],
  }
  let hechos = 0
  const tareaId = await abrirTareaProgreso(archivos.length)
  const contarOk = () => r.nominas + r.resumenes + r.segSocial + Object.values(r.reencaminados).reduce((a, n) => a + n, 0)
  const contarErr = () => r.rechazados.length + r.aRepescar

  await enParalelo(archivos, EN_PARALELO, async (f) => {
    let filaId: string | null = null
    try {
      const buf = await f.arrayBuffer()
      const huella = await huellaDe(buf)

      // Anti doble envío: si este mismo contenido ya se procesó, no se repite.
      if (huella) {
        const { data: ya } = await supabase.from('equipo_manifiesto')
          .select('id, estado, destino').eq('huella', huella).eq('estado', 'procesado').maybeSingle()
        if (ya?.id) return
      }

      const path = rutaSegura(f.name)

      // 1) Guardar primero. Si esto falla, el archivo no ha entrado.
      const { error: eUp } = await supabase.storage.from(BUCKET).upload(path, buf, {
        contentType: f.type || 'application/octet-stream', upsert: false,
      })
      if (eUp) throw new Error(`no se pudo guardar: ${eUp.message}`)

      // 2) Apuntarlo: a partir de aquí la repesca puede rescatarlo.
      const { data: fila } = await supabase.from('equipo_manifiesto')
        .insert({ nombre_archivo: f.name, storage_path: path, huella, estado: 'registrado', origen: 'boton' })
        .select('id').single()
      filaId = fila?.id ?? null

      // 3) Intentar leerlo ahora.
      const res = await fetchConTimeout('/api/equipo/subir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64: aBase64(buf), nombre_archivo: f.name }),
      })
      const j = await res.json()

      if (j?.ok) {
        const d = String(j.destino ?? '')
        if (d === 'nominas') r.nominas++
        else if (d === 'resumen_nominas') r.resumenes++
        else if (d === 'seguridad_social' || d === 'archivado_silencioso') r.segSocial++
        else if (d === 'reencaminado') {
          const mod = String(j.modulo || 'otro módulo')
          r.reencaminados[mod] = (r.reencaminados[mod] || 0) + 1
        } else if (d === 'rechazado') {
          r.rechazados.push({ nombre: f.name, motivo: String(j.motivo || 'no reconocido') })
        } else if (d === 'descartado_empleador') {
          // El titular no genera nómina: no es error ni cuenta como nada.
        } else r.revisar++

        if (filaId) {
          await supabase.from('equipo_manifiesto')
            .update({ estado: 'procesado', destino: d, intentos: 1, updated_at: new Date().toISOString() })
            .eq('id', filaId)
        }
      } else {
        // No se pudo leer, pero el archivo está guardado: queda para la repesca.
        r.aRepescar++
        r.errores.push(`${f.name}: ${j?.error || 'no reconocido'}`)
        if (filaId) {
          await supabase.from('equipo_manifiesto')
            .update({ intentos: 1, ultimo_error: String(j?.error ?? 'no reconocido'), updated_at: new Date().toISOString() })
            .eq('id', filaId)
        }
      }
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string }
      const motivo = err?.name === 'AbortError' ? 'tardó demasiado' : (err?.message || 'error de red')
      if (filaId) {
        r.aRepescar++
        await supabase.from('equipo_manifiesto')
          .update({ intentos: 1, ultimo_error: motivo, updated_at: new Date().toISOString() })
          .eq('id', filaId)
      }
      r.errores.push(`${f.name}: ${motivo}`)
    } finally {
      hechos++
      onProgreso?.(hechos, archivos.length)
      if (hechos % 10 === 0 || hechos === archivos.length) {
        await latirTareaProgreso(tareaId, hechos, contarOk(), contarErr(),
          r.rechazados.length > 0 ? `Último al cajón: ${r.rechazados[r.rechazados.length - 1].nombre}` : undefined)
      }
    }
  })

  await cerrarTareaProgreso(tareaId, hechos, contarOk(), contarErr())

  // Rebarrido de conciliación al terminar la tanda (LEY 100%): las facturas
  // recién entradas pueden desbloquear pendientes antiguos. Nunca bloquea.
  if (contarOk() > 0) {
    fetch('/api/facturas?action=reconciliar-pendientes').catch(() => {})
  }

  return r
}
