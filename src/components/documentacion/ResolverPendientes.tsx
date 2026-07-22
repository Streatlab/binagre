/**
 * ResolverPendientes v2 — único punto de entrada del trabajo pesado de Papeleo.
 * Ya NO ejecuta nada él mismo en bucle: crea filas en papeleo_tareas y dispara
 * un tick inmediato; el motor (cron papeleo-agenda-tick, cada 5 min, SOLO si
 * hay algo programado/cortado) hace el resto en servidor. Superpersistencia:
 * recargar o cerrar la pestaña no afecta — el toast de progreso se realimenta
 * de papeleo_tareas y reaparece solo con tareas activas.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toastStore'
import { HORAS_FIJAS, bandaQueChoca, proximaOcurrencia } from '@/lib/papeleoHoras'
import { OSW, LEX, INK, VERDE, ROJO, AMA, GRIS, SHADOW, BORDER_CARD, BLANCO } from '@/styles/neobrutal'

interface Inventario {
  en_storage: number
  releer_ocr: number
  archivar_drive: number
  limpieza: number
  total: number
}

interface TareaFila {
  id: string
  tipo: string
  estado: string
  programada_para: string | null
  ultimo_latido: string | null
  procesados: number
  ok: number
  errores: number
  created_at: string
}

// El cron papeleo-agenda-tick late cada 5 min. Si una tarea en_curso lleva más
// de esto sin latido, o una programada vencida sigue esperando, el motor de
// servidor no está avanzando (cron caído, endpoint roto tras un deploy…): el
// cliente lo espolea con un tick y lo dice en claro. Umbral = 2+ ticks perdidos.
const MOTOR_ATASCADO_MS = 12 * 60 * 1000
const NUDGE_THROTTLE_MS = 60 * 1000

const UMBRAL_LOTES = 300

const TIPOS_INVENTARIO: { tipo: string; campo: keyof Inventario }[] = [
  { tipo: 'despertar_dormidos', campo: 'en_storage' },
  { tipo: 'releer_ocr', campo: 'releer_ocr' },
  { tipo: 'archivar_drive', campo: 'archivar_drive' },
  { tipo: 'limpieza', campo: 'limpieza' },
]

const ETIQUETA_TIPO: Record<string, string> = {
  despertar_dormidos: 'Documentos dormidos',
  releer_ocr: 'Relecturas',
  archivar_drive: 'Archivado a Drive',
  limpieza: 'Limpieza de trastero',
  conciliar: 'Conciliación',
}

async function jget(url: string): Promise<Record<string, unknown>> {
  const r = await fetch(url, { method: 'GET' })
  try { return (await r.json()) as Record<string, unknown> } catch { return {} }
}
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)

export default function ResolverPendientes({ onDone }: { onDone?: () => void }) {
  const [comprobando, setComprobando] = useState(false)
  const [inventario, setInventario] = useState<Inventario | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [posponiendo, setPosponiendo] = useState(false)
  const [horaElegida, setHoraElegida] = useState<string>(HORAS_FIJAS[0])
  const [otraHora, setOtraHora] = useState('')
  const [errorHora, setErrorHora] = useState<string | null>(null)

  const [tareas, setTareas] = useState<TareaFila[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Ids de todas las tareas que hemos visto activas en esta tanda: al vaciarse
  // las activas, consultamos su estado FINAL real para no cantar "resuelto"
  // cuando alguna acabó en error (fallo silencioso = justo lo que se veta).
  const vigiladas = useRef<Set<string>>(new Set())
  const tareasPrevias = useRef(0)

  // Reintenta solo las tareas que terminaron en error: vuelven a 'programada'
  // conservando su cursor (retoman donde murieron) y se dispara un tick.
  const reintentarErroradas = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    await supabase.from('papeleo_tareas')
      .update({ estado: 'programada', programada_para: new Date().toISOString(), detalle: null })
      .in('id', ids)
    ids.forEach((id) => vigiladas.current.add(id))
    jget('/api/facturas?action=agenda-tick').catch(() => {})
    cargarTareasRef.current?.()
  }, [])

  // Cierre honesto: cuando ya no queda ninguna activa, mira cómo acabaron de
  // verdad las que vigilábamos. Si todas completaron → éxito; si alguna erró →
  // aviso con el número y botón «Reintentar» (un aviso sin acción no puede
  // existir). Nunca un "resuelto" que oculte un fallo.
  const cierreHonesto = useCallback(async () => {
    const ids = [...vigiladas.current]
    vigiladas.current.clear()
    if (ids.length === 0) { onDone?.(); return }
    const { data } = await supabase
      .from('papeleo_tareas')
      .select('id, estado, errores')
      .in('id', ids)
    const filas = (data as { id: string; estado: string; errores: number }[] | null) || []
    const conError = filas.filter((f) => f.estado === 'error')
    if (conError.length > 0) {
      const ids2 = conError.map((f) => f.id)
      toast.aviso(
        `${conError.length} tarea${conError.length === 1 ? '' : 's'} no pudo terminar. Puedes reintentarlo.`,
        { duration: 60000, action: { label: 'Reintentar', onClick: () => reintentarErroradas(ids2) } },
      )
    } else {
      toast.success('Pendientes resueltos.')
    }
    onDone?.()
  }, [onDone, reintentarErroradas])

  const ultimoNudge = useRef(0)

  const cargarTareas = useCallback(async () => {
    const { data } = await supabase
      .from('papeleo_tareas')
      .select('id, tipo, estado, programada_para, ultimo_latido, procesados, ok, errores, created_at')
      .in('estado', ['programada', 'en_curso', 'pausada'])
      .order('created_at', { ascending: false })
      .limit(20)
    const activas = (data as TareaFila[] | null) || []
    activas.forEach((t) => vigiladas.current.add(t.id))
    setTareas(activas)

    // Watchdog + autocuración: si el motor de servidor lleva rato sin avanzar
    // (cron caído / endpoint roto), lo espoleamos desde aquí. Nudge idempotente
    // (el claim es atómico) y con throttle para no martillear.
    const ahora = Date.now()
    const atascado = activas.some((t) => {
      if (t.estado === 'en_curso') return !t.ultimo_latido || (ahora - new Date(t.ultimo_latido).getTime()) > MOTOR_ATASCADO_MS
      if (t.estado === 'programada' && t.programada_para) return (ahora - new Date(t.programada_para).getTime()) > MOTOR_ATASCADO_MS
      return false
    })
    if (atascado && ahora - ultimoNudge.current > NUDGE_THROTTLE_MS) {
      ultimoNudge.current = ahora
      jget('/api/facturas?action=agenda-tick').catch(() => {})
    }

    if (tareasPrevias.current > 0 && activas.length === 0) await cierreHonesto()
    tareasPrevias.current = activas.length
  }, [cierreHonesto])

  const cargarTareasRef = useRef<(() => void) | null>(null)
  cargarTareasRef.current = cargarTareas

  useEffect(() => {
    cargarTareas()
    pollRef.current = setInterval(cargarTareas, 15000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [cargarTareas])

  async function comprobarInventario() {
    if (comprobando) return
    setComprobando(true)
    try {
      const inv = await jget('/api/facturas?action=resolver-inventario')
      const datos: Inventario = {
        en_storage: num(inv.en_storage), releer_ocr: num(inv.releer_ocr),
        archivar_drive: num(inv.archivar_drive), limpieza: num(inv.limpieza),
        total: num(inv.total),
      }
      setInventario(datos)
      if (datos.total === 0) return
      if (datos.total <= UMBRAL_LOTES) {
        await lanzarAhora(datos)
      } else {
        setModalAbierto(true)
      }
    } finally {
      setComprobando(false)
    }
  }

  async function crearTareas(datos: Inventario, programadaPara: string) {
    const filas = TIPOS_INVENTARIO
      .filter((t) => datos[t.campo] > 0)
      .map((t) => ({
        tipo: t.tipo, estado: 'programada' as const, programada_para: programadaPara,
        total_estimado: datos[t.campo],
      }))
    if (filas.length === 0) return
    await supabase.from('papeleo_tareas').insert(filas)
  }

  async function lanzarAhora(datos: Inventario) {
    await crearTareas(datos, new Date().toISOString())
    // Dispara un tick inmediato para no esperar los 5 min del cron; el resto
    // lo termina el motor en servidor aunque se cierre la pestaña.
    jget('/api/facturas?action=agenda-tick').catch(() => {})
    setModalAbierto(false)
    await cargarTareas()
  }

  async function posponer() {
    const hhmm = horaElegida === 'otra' ? otraHora : horaElegida
    const choque = bandaQueChoca(hhmm)
    if (choque) { setErrorHora(`A esa hora trabajan ${choque}; elige otra`); return }
    if (!inventario) return
    setPosponiendo(true)
    try {
      const cuando = proximaOcurrencia(hhmm)
      await crearTareas(inventario, cuando.toISOString())
      setModalAbierto(false)
      await cargarTareas()
    } finally {
      setPosponiendo(false)
    }
  }

  const hayPausadas = tareas.some((t) => t.estado === 'pausada')
  const motorAtascado = tareas.some((t) => {
    const ref = t.estado === 'en_curso' ? t.ultimo_latido : t.estado === 'programada' ? t.programada_para : null
    return !!ref && (Date.now() - new Date(ref).getTime()) > MOTOR_ATASCADO_MS
  }) && !hayPausadas

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
      {tareas.length === 0 ? (
        <button
          onClick={comprobarInventario}
          disabled={comprobando}
          style={{
            background: comprobando ? GRIS : VERDE, color: BLANCO, border: BORDER_CARD, boxShadow: SHADOW,
            padding: '10px 18px', fontFamily: OSW, fontWeight: 700, fontSize: 13, letterSpacing: '1.5px',
            textTransform: 'uppercase', cursor: comprobando ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <RefreshCw size={16} strokeWidth={2.6} style={comprobando ? { animation: 'sl-spin 1s linear infinite' } : undefined} />
          {comprobando ? 'Comprobando…' : 'Resolver pendientes'}
        </button>
      ) : motorAtascado ? (
        <div style={{
          background: BLANCO, border: BORDER_CARD, boxShadow: SHADOW, padding: '10px 14px',
          minWidth: 260, maxWidth: 360, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={16} strokeWidth={2.6} color={AMA} style={{ flexShrink: 0 }} />
          <span style={{ fontFamily: LEX, fontSize: 12.5, color: INK }}>
            Una tarea tardó en responder; se reanuda sola. No hace falta que hagas nada.
          </span>
        </div>
      ) : null}

      {modalAbierto && inventario && (
        <div
          onClick={() => setModalAbierto(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', border: BORDER_CARD, boxShadow: SHADOW, padding: 24, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.5px', color: INK }}>
              {inventario.total} documentos pendientes
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <FilaInventario label="Documentos dormidos" valor={inventario.en_storage} />
              <FilaInventario label="Relecturas" valor={inventario.releer_ocr} />
              <FilaInventario label="Archivado a Drive" valor={inventario.archivar_drive} />
              <FilaInventario label="Limpieza de trastero" valor={inventario.limpieza} />
            </div>
            <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>
              Es mucho volumen — puede procesarse ahora por lotes o programarse para una hora sin robots.
            </span>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => lanzarAhora(inventario)} style={btnGrande(VERDE)}>Procesar ahora por lotes</button>
              <button onClick={() => setPosponiendo((v) => !v)} style={btnGrande('#222222')}>Posponer</button>
            </div>

            {posponiendo && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: `1px solid ${INK}`, paddingTop: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {HORAS_FIJAS.map((h) => (
                    <button
                      key={h}
                      onClick={() => { setHoraElegida(h); setErrorHora(null) }}
                      style={chipHora(horaElegida === h)}
                    >
                      {h}
                    </button>
                  ))}
                  <button
                    onClick={() => { setHoraElegida('otra'); setErrorHora(null) }}
                    style={chipHora(horaElegida === 'otra')}
                  >
                    Otra hora
                  </button>
                </div>
                {horaElegida === 'otra' && (
                  <input
                    type="time"
                    value={otraHora}
                    onChange={(e) => { setOtraHora(e.target.value); setErrorHora(null) }}
                    style={{ fontFamily: LEX, fontSize: 13, padding: '8px 10px', border: `1px solid ${INK}`, color: INK, width: 140 }}
                  />
                )}
                {errorHora && (
                  <span style={{ fontFamily: LEX, fontSize: 12, color: ROJO, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={14} strokeWidth={2.6} /> {errorHora}
                  </span>
                )}
                <button
                  onClick={posponer}
                  disabled={posponiendoDisabled(horaElegida, otraHora, posponiendo)}
                  style={{ ...btnGrande(VERDE), alignSelf: 'flex-start' }}
                >
                  {posponiendo ? 'Programando…' : 'Confirmar hora'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes sl-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function posponiendoDisabled(horaElegida: string, otraHora: string, posponiendo: boolean): boolean {
  if (posponiendo) return true
  return horaElegida === 'otra' && !otraHora
}

function FilaInventario({ label, valor }: { label: string; valor: number }) {
  if (valor === 0) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LEX, fontSize: 13, color: INK }}>
      <span>{label}</span>
      <span style={{ fontFamily: OSW, fontWeight: 700 }}>{valor}</span>
    </div>
  )
}

function btnGrande(bg: string): React.CSSProperties {
  return {
    background: bg, color: '#fff', border: BORDER_CARD, boxShadow: SHADOW,
    padding: '9px 16px', fontFamily: OSW, fontWeight: 700, fontSize: 12.5, letterSpacing: '1px',
    textTransform: 'uppercase', cursor: 'pointer',
  }
}


function chipHora(activa: boolean): React.CSSProperties {
  return {
    background: activa ? INK : '#fff', color: activa ? '#fff' : INK, border: `1px solid ${INK}`,
    padding: '6px 12px', fontFamily: LEX, fontSize: 12.5, cursor: 'pointer',
  }
}
