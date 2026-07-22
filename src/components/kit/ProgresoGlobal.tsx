/**
 * ProgresoGlobal — panel único de progreso para todo el ERP.
 *
 * Filosofía (LEY-ESTILO-01 · Cantera Alegre):
 *  - El estado vive en la base de datos (papeleo_tareas), no en el navegador:
 *    sobrevive a F5, a cambiar de módulo, a cerrar el navegador y a cambiar de equipo.
 *  - Nunca pide permiso ni bloquea la pantalla. Informa y sigue.
 *  - Sin botones de Pausar/Cancelar. Único control: minimizar.
 *  - Al cambiar de módulo se recoge en un reloj de arena discreto; al pulsarlo se abre.
 *  - Cuando no hay trabajo vivo, no pinta nada ni consulta.
 *  - Radio 0, planchas sólidas, sombra dura solo en lo pulsable. Rojo solo para rechazados.
 *
 * Se monta UNA vez en el shell (Layout). Cualquier proceso largo del ERP que escriba
 * en papeleo_tareas aparece aquí automáticamente.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { OSW, LEX, INK, CREMA, CLARO, VERDE, ROJO, AMA, GRANATE, GRIS, SHADOW } from '@/styles/neobrutal'

type Tarea = {
  id: string
  tipo: string | null
  estado: string
  total_estimado: number | null
  procesados: number | null
  ok: number | null
  errores: number | null
  ultimo_latido: string | null
  detalle: string | null
  updated_at: string | null
}

// Color de héroe por área (Cantera Alegre): el tipo de tarea decide el acento.
function acentoDe(tipo: string | null): string {
  const t = (tipo || '').toLowerCase()
  if (t.includes('cocina') || t.includes('escandallo') || t.includes('inventario')) return '#C85A2A' // naranja
  if (t.includes('nomina') || t.includes('equipo')) return INK                                      // tinta
  if (t.includes('tesoreria') || t.includes('banco') || t.includes('cashflow')) return '#4B5A72'    // azul
  return GRANATE // papeleo / conciliación / facturas → granate (defecto)
}

const ESTADOS_VIVOS = ['programada', 'en_curso', 'procesando', 'reanudando']

export default function ProgresoGlobal() {
  const location = useLocation()
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [abierto, setAbierto] = useState(true)
  const [cerradoManual, setCerradoManual] = useState(false)
  const [resumenFinal, setResumenFinal] = useState<string | null>(null)
  const rutaAnterior = useRef(location.pathname)
  const habiaVivo = useRef(false)

  // Al cambiar de módulo, recoger el panel a reloj de arena (no molestar).
  useEffect(() => {
    if (location.pathname !== rutaAnterior.current) {
      rutaAnterior.current = location.pathname
      setAbierto(false)
    }
  }, [location.pathname])

  // Sondear la BD solo mientras hay trabajo vivo; si no hay, descansa a intervalo largo.
  useEffect(() => {
    let cancelado = false
    async function tick() {
      const { data } = await supabase
        .from('papeleo_tareas')
        .select('id,tipo,estado,total_estimado,procesados,ok,errores,ultimo_latido,detalle,updated_at')
        .order('updated_at', { ascending: false })
        .limit(12)
      if (cancelado || !data) return

      const vivas = data.filter((t) => ESTADOS_VIVOS.includes((t.estado || '').toLowerCase()))
      setTareas(vivas)

      if (vivas.length > 0) {
        habiaVivo.current = true
        setResumenFinal(null)
        setCerradoManual(false)
      } else if (habiaVivo.current) {
        // Acaba de terminar: resumen breve y desaparecer.
        habiaVivo.current = false
        const recien = data.find((t) => ['completada', 'completado', 'ok'].includes((t.estado || '').toLowerCase()))
        const proc = data.reduce((a, t) => a + (t.procesados || 0), 0)
        setResumenFinal(recien ? `Listo · ${proc} documento${proc === 1 ? '' : 's'} procesado${proc === 1 ? '' : 's'}` : null)
        setTimeout(() => setResumenFinal(null), 6000)
      }
    }
    tick()
    const hayVivo = tareas.length > 0
    const ms = hayVivo ? 2500 : 15000
    const iv = setInterval(tick, ms)
    return () => { cancelado = true; clearInterval(iv) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tareas.length])

  const agg = useMemo(() => {
    const total = tareas.reduce((a, t) => a + (t.total_estimado || 0), 0)
    const proc = tareas.reduce((a, t) => a + (t.procesados || 0), 0)
    const ok = tareas.reduce((a, t) => a + (t.ok || 0), 0)
    const err = tareas.reduce((a, t) => a + (t.errores || 0), 0)
    const dup = Math.max(proc - ok - err, 0) // procesados que no son ni ok ni error → duplicados/omitidos
    const pct = total > 0 ? Math.min(Math.round((proc / total) * 100), 100) : (proc > 0 ? 99 : 0)
    return { total, proc, ok, err, dup, pct }
  }, [tareas])

  const hayVivo = tareas.length > 0
  if (!hayVivo && !resumenFinal) return null

  const acento = acentoDe(tareas[0]?.tipo ?? null)
  const titulo = tituloDe(tareas[0]?.tipo ?? null)

  // ---- Reloj de arena (minimizado) ----
  if (!hayVivo && resumenFinal) {
    return (
      <div style={wrapFlotante}>
        <div style={{ ...pastilla, borderColor: VERDE, background: '#fff' }}>
          <span style={{ ...OSW(12, 800), color: VERDE, letterSpacing: 1 }}>✓ {resumenFinal}</span>
        </div>
      </div>
    )
  }

  if (!abierto || cerradoManual) {
    return (
      <button onClick={() => { setAbierto(true); setCerradoManual(false) }} style={{ ...relojBtn, borderColor: acento }} title={`${titulo} · ${agg.proc}/${agg.total || '?'}`}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>⏳</span>
        <span style={{ ...OSW(11, 800), color: acento, letterSpacing: 0.5 }}>{agg.proc}{agg.total ? `/${agg.total}` : ''}</span>
      </button>
    )
  }

  // ---- Panel abierto ----
  return (
    <div style={wrapFlotante}>
      <div style={{ ...panel, borderColor: INK }}>
        {/* Cabecera: acento del área + título + minimizar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ width: 12, height: 12, background: acento, display: 'inline-block' }} />
          <span style={{ ...OSW(14, 800), color: INK, letterSpacing: 0.5, flex: 1 }}>{titulo}</span>
          <button onClick={() => setCerradoManual(true)} style={miniBtn} title="Minimizar">—</button>
        </div>

        {/* Barra de progreso: bloques sólidos, radio 0 */}
        <div style={{ height: 14, background: CLARO, border: `2px solid ${INK}`, marginBottom: 10, position: 'relative' }}>
          <div style={{ height: '100%', width: `${agg.pct}%`, background: acento, transition: 'width .4s' }} />
        </div>
        <div style={{ ...LEX(12), color: GRIS, marginBottom: 12 }}>
          {agg.total > 0 ? `Van ${agg.proc} de ${agg.total}` : `${agg.proc} procesados`}
          {estaLento(tareas) ? ' · uno está tardando, sigue solo' : ''}
        </div>

        {/* Contadores: bloques papel, rojo SOLO en rechazados */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <Contador n={agg.total || agg.proc} etq="Lanzados" color={INK} />
          <Contador n={hayVivo ? Math.max(agg.total - agg.proc, 0) : 0} etq="En proceso" color={AMA} oscuro="#8a7a00" />
          <Contador n={agg.ok} etq="Correctos" color={VERDE} />
          <Contador n={agg.dup} etq="Duplicados" color={GRIS} />
          <Contador n={agg.err} etq="Rechazados" color={agg.err > 0 ? ROJO : GRIS} />
          <Contador n={agg.proc} etq="Procesados" color={acento} />
        </div>
      </div>
    </div>
  )
}

function Contador({ n, etq, color, oscuro }: { n: number; etq: string; color: string; oscuro?: string }) {
  return (
    <div style={{ border: `2px solid ${INK}`, background: '#fff', padding: '8px 6px', textAlign: 'center' }}>
      <div style={{ ...OSW(20, 800), color: oscuro || color, lineHeight: 1 }}>{n}</div>
      <div style={{ ...OSW(9, 700), color: GRIS, letterSpacing: 1, marginTop: 3, textTransform: 'uppercase' }}>{etq}</div>
    </div>
  )
}

function tituloDe(tipo: string | null): string {
  const t = (tipo || '').toLowerCase()
  if (t.includes('equipo') || t.includes('nomina')) return 'Leyendo documentos de equipo'
  if (t.includes('concil')) return 'Conciliando con el banco'
  if (t.includes('plataforma') || t.includes('import')) return 'Importando liquidaciones'
  if (t.includes('escandallo')) return 'Procesando escandallo'
  if (t.includes('robot')) return 'Robots trabajando'
  return 'Procesando documentos'
}

function estaLento(tareas: Tarea[]): boolean {
  return tareas.some((t) => {
    if (!t.ultimo_latido) return false
    return Date.now() - new Date(t.ultimo_latido).getTime() > 90_000
  })
}

const wrapFlotante: React.CSSProperties = {
  position: 'fixed', right: 20, bottom: 20, zIndex: 900, maxWidth: 360,
}
const panel: React.CSSProperties = {
  background: CREMA, border: '3px solid', padding: 16, boxShadow: SHADOW, width: 340,
}
const pastilla: React.CSSProperties = {
  border: '3px solid', padding: '10px 14px', boxShadow: SHADOW,
}
const relojBtn: React.CSSProperties = {
  position: 'fixed', right: 20, bottom: 20, zIndex: 900,
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
  background: '#fff', border: '3px solid', padding: '8px 12px', cursor: 'pointer',
  boxShadow: SHADOW,
}
const miniBtn: React.CSSProperties = {
  background: '#fff', border: `2px solid ${INK}`, ...OSW(14, 800), color: INK,
  width: 26, height: 26, cursor: 'pointer', lineHeight: 1,
}
