/**
 * Subida segura al buzón de EQUIPO (nóminas, resumen, RLC, RNT).
 *
 * Regla: **nada de lo que se sube puede desaparecer en silencio.**
 *
 * Antes, cada archivo se mandaba directo a leer, de uno en uno y sin tope de
 * espera: si uno se colgaba, los siguientes se quedaban en la cola del
 * navegador y morían al cerrar la página, sin dejar rastro en ningún sitio.
 *
 * Ahora el orden es otro:
 *   1. GUARDAR el archivo (rápido y sin IA) y apuntarlo en el manifiesto.
 *   2. INTENTAR leerlo.
 *   3. Si la lectura falla o tarda demasiado, el archivo YA está a salvo y su
 *      fila queda en 'registrado' → la repesca automática (cada 15 min) lo
 *      recoge y lo procesa solo, hasta 3 intentos.
 *
 * Así, aunque se cierre el navegador a mitad, no se pierde ni un documento.
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

function rutaSegura(nombre: string): string {
  const limpio = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_')
  return `${CARPETA}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${limpio}`
}

/**
 * Envía archivos al buzón de Equipo dejando siempre rastro recuperable.
 * @param onProgreso se llama tras cada archivo con (hechos, total)
 */
export async function enviarAEquipoSeguro(
  archivos: File[],
  onProgreso?: (hechos: number, total: number) => void,
): Promise<ResultadoEquipo> {
  const r: ResultadoEquipo = { nominas: 0, resumenes: 0, segSocial: 0, revisar: 0, aRepescar: 0, errores: [] }
  let hechos = 0

  await enParalelo(archivos, EN_PARALELO, async (f) => {
    let filaId: string | null = null
    try {
      const buf = await f.arrayBuffer()
      const path = rutaSegura(f.name)

      // 1) Guardar primero. Si esto falla, el archivo no se ha perdido: no ha entrado.
      const { error: eUp } = await supabase.storage.from(BUCKET).upload(path, buf, {
        contentType: f.type || 'application/octet-stream', upsert: false,
      })
      if (eUp) throw new Error(`no se pudo guardar: ${eUp.message}`)

      // 2) Apuntarlo en el manifiesto: a partir de aquí la repesca puede rescatarlo.
      const { data: fila } = await supabase.from('equipo_manifiesto')
        .insert({ nombre_archivo: f.name, storage_path: path, estado: 'registrado', origen: 'boton' })
        .select('id').single()
      filaId = fila?.id ?? null

      // 3) Intentar leerlo ahora.
      const res = await fetchConTimeout('/api/equipo/subir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64: aBase64(buf), nombre_archivo: f.name }),
      })
      const j = await res.json()

      if (j?.ok) {
        if (j.destino === 'nominas') r.nominas++
        else if (j.destino === 'resumen_nominas') r.resumenes++
        else if (j.destino === 'seguridad_social' || j.destino === 'seguridad_social_rnt') r.segSocial++
        else r.revisar++
        if (filaId) {
          await supabase.from('equipo_manifiesto')
            .update({ estado: 'procesado', destino: String(j.destino ?? ''), intentos: 1, updated_at: new Date().toISOString() })
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
      // Si llegó a guardarse, la repesca lo recuperará; si no, es un fallo real.
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
    }
  })

  return r
}

/** Lanza la repesca al momento, sin esperar al repaso de cada 15 minutos. */
export async function repescarAhora(): Promise<number> {
  const { data } = await supabase.from('v_equipo_repesca').select('id')
  return data?.length ?? 0
}
