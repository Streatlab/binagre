/**
 * ProgresoGlobal — panel único de progreso para todo el ERP.
 *
 * LEY-ESTILO-01 · Cantera Alegre:
 *  - El estado vive en la base de datos (papeleo_tareas), no en el navegador:
 *    sobrevive a F5, a cambiar de módulo, a cerrar el navegador y a cambiar de equipo.
 *  - Nunca pide permiso ni bloquea la pantalla. Informa y sigue.
 *  - Sin Pausar/Cancelar. Único control: minimizar.
 *  - Al cambiar de módulo se recoge en un reloj de arena discreto; al pulsarlo se abre.
 *  - Cuando no hay trabajo vivo, no pinta nada ni consulta a ritmo alto.
 *  - Radio 0, planchas sólidas, sombra dura solo en lo pulsable. Rojo solo para rechazados.
 *
 * Se monta UNA vez en el shell (Layout). Cualquier proceso que escriba en
 * papeleo_tareas aparece aquí solo.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { OSW, INK, CREMA, CLARO, VERDE, ROJO, AMA, NAR, GRANATE, GRIS, SHADOW } from '@/styles/neobrutal'

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

const ESTADOS_VIVOS = ['programada', 'en_curso', 'procesando', 'reanudando']

// Acento de héroe por área (Cantera Alegre).
function acentoDe(tipo: string | null): string {
  const t = (tipo || '').toLowerCase()
  if (t.includes('cocina') || t.includes('escandallo') || t.includes('inventario')) return NAR
  if (t.includes('nomina') || t.includes('equipo')) return INK
  if (t.includes('tesoreria') || t.includes('banco') || t.includes('cashflow')) return '#2D5BFF'
  return GRANATE
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
  return tareas.some((t) => t.ultimo_latido && Date.now() - new Date(t.ultimo_latido).getTime() > 90_000)
}

export default function ProgresoGlobal() {
  const location = useLocation()
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [minimizado, setMinimizado] = useState(false)
  const [resumenFinal, setResumenFinal] = useState<string | null>(null)
  const rutaAnterior = useRef(location.pathname)
  const habiaVivo = useRef(false)

  // Al cambiar de módulo → recoger a reloj de arena.
  useEffect(() => {
    if (location.pathname !== rutaAnterior.current) {
      rutaAnterior.current = location.pathname
      setMinimizado(true)
    }
  }, [location.pathname])

  useEffect(() => {
    let cancelado = false
    async function tick() {
      const { data } = await supabase
        .from('papeleo_tareas')
        .select('id,tipo,estado,total_estimado,procesados,ok,errores,ultimo_latido,detalle,updated_at')
        .order('updated_at', { ascending: false })
        .limit(12)
      if (cancelado || !data) return
      const vivas = (data as Tarea[]).filter((t) => ESTADOS_VIVOS.includes((t.estado || '').toLowerCase()))
      setTareas(vivas)
      if (vivas.length > 0) {
        habiaVivo.current = true
        setResumenFinal(null)
      } else if (habiaVivo.current) {
        habiaVivo.current = false
        const proc = (data as Tarea[]).reduce((a, t) => a + (t.procesados || 0), 0)
        setResumenFinal(`Listo · ${proc} documento${proc === 1 ? '' : 's'} procesado${proc === 1 ? '' : 's'}`)
        setTimeout(() => { if (!cancelado) setResumenFinal(null) }, 6000)
      }
    }
    tick()
    const iv = setInterval(tick, tareas.length > 0 ? 2500 : 15000)
    return () => { cancelado = true; clearInterval(iv) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tareas.length])

  const agg = useMemo(() => {
    const total = tareas.reduce((a, t) => a + (t.total_estimado || 0), 0)
    const proc = tareas.reduce((a, t) => a + (t.procesados || 0), 0)
    const ok = tareas.reduce((a, t) => a + (t.ok || 0), 0)
    const err = tareas.reduce((a, t) => a + (t.errores || 0), 0)
    const dup = Math.max(proc - ok - err, 0)
    const pct = total > 0 ? Math.min(Math.round((proc / total) * 100), 100) : (proc > 0 ? 99 : 0)
    const enProceso = Math.max(total - proc, 0)
    return { total, proc, ok, err, dup, pct, enProceso }
  }, [tareas])

  const hayVivo = tareas.length > 0
  if (!hayVivo && !resumenFinal) return null

  const acento = acentoDe(tareas[0]?.tipo ?? null)
  const titulo = tituloDe(tareas[0]?.tipo ?? null)

  // Fin del trabajo: pastilla verde efímera.
  if (!hayVivo && resumenFinal) {
    return (
      <div style={wrap}>
        <div style={{ ...pastilla, borderColor: VERDE }}>
          <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 12, color: VERDE, letterSpacing: 1 }}>✓ {resumenFinal}</span>
        </div>
      </div>
    )
  }

  // Minimizado: reloj de arena.
  if (minimizado) {
    return (
      <button onClick={() => setMinimizado(false)} style={{ ...reloj, borderColor: acento }} title={`${titulo} · ${agg.proc}/${agg.total || '?'}`}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>⏳</span>
        <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 11, color: acento }}>{agg.proc}{agg.total ? `/${agg.total}` : ''}</span>
      </button>
    )
  }

  // Abierto.
  return (
    <div style={wrap}>
      <div style={panel}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ width: 12, height: 12, background: acento, display: 'inline-block' }} />
          <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 14, color: INK, letterSpacing: 0.5, flex: 1, textTransform: 'uppercase' }}>{titulo}</span>
          <button onClick={() => setMinimizado(true)} style={miniBtn} title="Minimizar">—</button>
        </div>

        <div style={{ height: 14, background: CLARO, border: `2px solid ${INK}`, marginBottom: 8 }}>
          <div style={{ height: '100%', width: `${agg.pct}%`, background: acento, transition: 'width .4s' }} />
        </div>
        <div style={{ fontFamily: OSW, fontWeight: 600, fontSize: 12, color: GRIS, marginBottom: 12, letterSpacing: 0.5 }}>
          {agg.total > 0 ? `VAN ${agg.proc} DE ${agg.total}` : `${agg.proc} PROCESADOS`}
          {estaLento(tareas) ? ' · UNO TARDA, SIGUE SOLO' : ''}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <Contador n={agg.total || agg.proc} etq="Lanzados" color={INK} />
          <Contador n={agg.enProceso} etq="En proceso" color="#8a7a00" />
          <Contador n={agg.ok} etq="Correctos" color={VERDE} />
          <Contador n={agg.dup} etq="Duplicados" color={GRIS} />
          <Contador n={agg.err} etq="Rechazados" color={agg.err > 0 ? ROJO : GRIS} />
          <Contador n={agg.proc} etq="Procesados" color={acento} />
        </div>
      </div>
    </div>
  )
}

function Contador({ n, etq, color }: { n: number; etq: string; color: string }) {
  return (
    <div style={{ border: `2px solid ${INK}`, background: '#fff', padding: '8px 6px', textAlign: 'center' }}>
      <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 20, color, lineHeight: 1 }}>{n}</div>
      <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 9, color: GRIS, letterSpacing: 1, marginTop: 3, textTransform: 'uppercase' }}>{etq}</div>
    </div>
  )
}

const wrap: CSSProperties = { position: 'fixed', right: 20, bottom: 20, zIndex: 900, maxWidth: 360 }
const panel: CSSProperties = { background: CREMA, border: `3px solid ${INK}`, padding: 16, boxShadow: SHADOW, width: 340 }
const pastilla: CSSProperties = { border: '3px solid', background: '#fff', padding: '10px 14px', boxShadow: SHADOW }
const reloj: CSSProperties = {
  position: 'fixed', right: 20, bottom: 20, zIndex: 900,
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
  background: '#fff', border: '3px solid', padding: '8px 12px', cursor: 'pointer', boxShadow: SHADOW,
}
const miniBtn: CSSProperties = {
  background: '#fff', border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 700, fontSize: 14,
  color: INK, width: 26, height: 26, cursor: 'pointer', lineHeight: 1,
}
