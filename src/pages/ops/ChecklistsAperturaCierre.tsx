/**
 * Checklists de Cocina — Operaciones · Registro diario.
 *
 * Contenido cerrado y validado por Rubén (24-jul-2026):
 *  · 4 checklists tickables: apertura · cierre mediodía · cierre noche · recepción.
 *  · Hojas de referencia: estándar de servicio · calendario de limpiezas · planning mensual.
 *  · Todo editable online (plantilla, hoja semanal, calendario) y descargable en PDF.
 *
 * Pantalla: CANTERA ALEGRE v1.0 — área Ops = héroe naranja.
 * Imprimible: MARCO DOCUMENTOS (src/lib/marcoDoc.ts) vía src/lib/checklistSemanaPdf.ts,
 * apaisado semanal L–D con columnas Hizo / Vf por día.
 * Lectura por foto: /api/checklists (visión) autorrellena lo cumplido.
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  OSW, LEX, INK, CREMA, CLARO, SHADOW, BORDER_CARD, GRANATE, AMA, VERDE, ROJO, NAR, GRIS, BLANCO,
} from '@/styles/neobrutal'
import { HeroCantera, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'
import BotonImprimir from '@/components/BotonImprimir'
import * as M from '@/lib/marcoDoc'
import {
  crearChecklistSemanaPdf, crearHojaTextoPdf, lunesDe, semanaIso, rotuloSemana, fechasSemana,
  DIAS_CORTOS, DIAS_LARGOS, type FilaChecklist,
} from '@/lib/checklistSemanaPdf'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoTickable = 'apertura' | 'cierre_mediodia' | 'cierre' | 'recepcion'
type TipoHoja = TipoTickable | 'estandar_servicio' | 'calendario' | 'planning' | 'historico'
type SubVista = 'hoy' | 'semana' | 'editar'

interface Plantilla {
  id: string
  tipo: string
  nombre: string
  orden: number
  activo: boolean
  requiere_dato: boolean
  tipo_dato: string | null
  nota: string | null
}

interface ItemEjecucion {
  id: string
  ejecucion_id: string
  plantilla_id: string | null
  item_nombre: string
  completado: boolean
  completado_at: string | null
  requiere_dato: boolean
  tipo_dato: string | null
  dato_valor: string | null
}

interface Ejecucion {
  id: string
  fecha: string
  tipo: string
  items_completados: number
  items_totales: number
  completado: boolean
  notas: string | null
  responsable: string | null
  foto_url: string | null
  origen: string | null
  incidencias: string | null
}

interface Celda { hizo?: string; vf?: string }

interface FilaSemana {
  id: string
  tipo: string
  semana_iso: string
  item_nombre: string
  orden: number
  celdas: Record<string, Celda>
}

interface TareaCalendario {
  id: string
  clase: string
  tarea: string
  dias: number[] | null
  semana_ciclo: number | null
  nota: string | null
  orden: number
  activo: boolean
}

// ─── Etiquetas ────────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  apertura: 'Apertura',
  cierre_mediodia: 'Cierre mediodía',
  cierre: 'Cierre noche',
  recepcion: 'Recepción de mercancía',
  estandar_servicio: 'Estándar de servicio',
}

const TIPO_DOC: Record<string, string> = {
  apertura: 'Checklist de apertura',
  cierre_mediodia: 'Checklist de cierre de mediodía',
  cierre: 'Checklist de cierre de noche',
  recepcion: 'Checklist de recepción de mercancía',
  estandar_servicio: 'Estándar de servicio',
}

const TABS: { key: TipoHoja; label: string }[] = [
  { key: 'apertura', label: 'Apertura' },
  { key: 'cierre_mediodia', label: 'Cierre mediodía' },
  { key: 'cierre', label: 'Cierre noche' },
  { key: 'recepcion', label: 'Recepción' },
  { key: 'estandar_servicio', label: 'Estándar de servicio' },
  { key: 'calendario', label: 'Calendario limpiezas' },
  { key: 'planning', label: 'Planning mensual' },
  { key: 'historico', label: 'Histórico' },
]

const TICKABLES: string[] = ['apertura', 'cierre_mediodia', 'cierre', 'recepcion']
const esTickable = (t: TipoHoja): t is TipoTickable => TICKABLES.includes(t)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtHora(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtFechaCorta(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function progressColor(pct: number): string {
  if (pct < 30) return ROJO
  if (pct < 70) return AMA
  return VERDE
}

/** Semana del ciclo rotativo de 3 semanas a partir del número de semana ISO. */
function semanaCiclo(fecha: Date): number {
  const n = parseInt(semanaIso(fecha).split('-W')[1], 10)
  return ((n - 1) % 3) + 1
}

/** Tareas del calendario que tocan una fecha concreta. */
function tareasDelDia(cal: TareaCalendario[], fecha: Date): TareaCalendario[] {
  const dow = ((fecha.getDay() + 6) % 7) + 1 // 1 = lunes … 7 = domingo
  const ciclo = semanaCiclo(fecha)
  const dia = fecha.getDate()
  return cal.filter(t => {
    if (!t.activo) return false
    if (t.clase === 'quincenal') return dia === 1 || dia === 15
    if (!t.dias || !t.dias.includes(dow)) return false
    if (t.clase === 'rotativa') return t.semana_ciclo === ciclo
    return true
  })
}

// Redimensiona la foto a máx 1568px de lado largo y devuelve base64 JPEG.
function comprimirFoto(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la foto'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Formato de imagen no válido'))
      img.onload = () => {
        const MAX = 1568
        let { width, height } = img
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas no disponible')); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve({ base64: canvas.toDataURL('image/jpeg', 0.85).split(',')[1], mime: 'image/jpeg' })
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ChecklistsAperturaCierre() {
  const [tab, setTab] = useState<TipoHoja>('apertura')
  const [sub, setSub] = useState<SubVista>('hoy')

  const [ejecucion, setEjecucion] = useState<Ejecucion | null>(null)
  const [items, setItems] = useState<ItemEjecucion[]>([])
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [semana, setSemana] = useState<FilaSemana[]>([])
  const [lunes, setLunes] = useState<Date>(() => lunesDe(new Date()))
  const [calendario, setCalendario] = useState<TareaCalendario[]>([])
  const [historico, setHistorico] = useState<Ejecucion[]>([])
  const [incentivoEur, setIncentivoEur] = useState<number | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [nuevoItem, setNuevoItem] = useState('')
  const [mesPlanning, setMesPlanning] = useState<Date>(() => new Date())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const semanaKey = useMemo(() => semanaIso(lunes), [lunes])
  const fechas = useMemo(() => fechasSemana(lunes), [lunes])

  // ─── Cargas ─────────────────────────────────────────────────────────────────

  const cargarIncentivo = useCallback(async () => {
    const { data } = await supabase.from('incentivos_config').select('glob_checklist, checklist_eur').limit(1).maybeSingle()
    const v = data as { glob_checklist?: number | null; checklist_eur?: number | null } | null
    setIncentivoEur(v?.glob_checklist ?? v?.checklist_eur ?? null)
  }, [])

  const cargarPlantillas = useCallback(async (tipo: string) => {
    const { data, error: e } = await supabase
      .from('checklist_plantillas')
      .select('*').eq('tipo', tipo).eq('activo', true).order('orden')
    if (e) throw e
    const lista = (data ?? []) as Plantilla[]
    setPlantillas(lista)
    return lista
  }, [])

  const cargarHoy = useCallback(async (tipo: TipoTickable) => {
    setLoading(true); setError(null); setAviso(null)
    try {
      const hoy = localDateStr()
      const plant = await cargarPlantillas(tipo)

      const { data: existente, error: e1 } = await supabase
        .from('checklist_ejecuciones').select('*').eq('fecha', hoy).eq('tipo', tipo).maybeSingle()
      if (e1) throw e1

      let ejec: Ejecucion
      if (existente) {
        ejec = existente as Ejecucion
      } else {
        const { data: nueva, error: e2 } = await supabase
          .from('checklist_ejecuciones')
          .insert({ fecha: hoy, tipo, items_totales: plant.length, items_completados: 0 })
          .select().single()
        if (e2) throw e2
        ejec = nueva as Ejecucion
        if (plant.length > 0) {
          const filas = plant.map((p, i) => ({
            ejecucion_id: ejec.id,
            plantilla_id: p.id,
            item_nombre: p.nombre,
            orden: i,
            requiere_dato: p.requiere_dato,
            tipo_dato: p.tipo_dato,
          }))
          const { error: e3 } = await supabase.from('checklist_items_ejecucion').insert(filas)
          if (e3) throw e3
        }
      }

      const { data: its, error: e4 } = await supabase
        .from('checklist_items_ejecucion').select('*').eq('ejecucion_id', ejec.id).order('orden').order('created_at')
      if (e4) throw e4

      setEjecucion(ejec)
      setItems((its ?? []) as ItemEjecucion[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [cargarPlantillas])

  const cargarSemana = useCallback(async (tipo: TipoTickable, key: string) => {
    setLoading(true); setError(null)
    try {
      const plant = await cargarPlantillas(tipo)
      const { data, error: e } = await supabase
        .from('checklist_semana').select('*').eq('tipo', tipo).eq('semana_iso', key).order('orden')
      if (e) throw e
      let filas = (data ?? []) as FilaSemana[]
      if (filas.length === 0 && plant.length > 0) {
        const nuevas = plant.map((p, i) => ({ tipo, semana_iso: key, item_nombre: p.nombre, orden: i, celdas: {} }))
        const { data: ins, error: e2 } = await supabase.from('checklist_semana').insert(nuevas).select()
        if (e2) throw e2
        filas = ((ins ?? []) as FilaSemana[]).sort((a, b) => a.orden - b.orden)
      }
      setSemana(filas)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [cargarPlantillas])

  const cargarCalendario = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data, error: e } = await supabase.from('checklist_calendario').select('*').order('orden')
      if (e) throw e
      setCalendario((data ?? []) as TareaCalendario[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const cargarHistorico = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data, error: e } = await supabase
        .from('checklist_ejecuciones').select('*').order('fecha', { ascending: false }).order('tipo').limit(80)
      if (e) throw e
      setHistorico((data ?? []) as Ejecucion[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarIncentivo() }, [cargarIncentivo])

  useEffect(() => {
    if (tab === 'historico') { cargarHistorico(); return }
    if (tab === 'calendario' || tab === 'planning') { cargarCalendario(); return }
    if (tab === 'estandar_servicio') { cargarPlantillas('estandar_servicio').catch(() => setError('No se pudo cargar el estándar')); return }
    if (sub === 'hoy') cargarHoy(tab)
    else if (sub === 'semana') cargarSemana(tab, semanaKey)
    else cargarPlantillas(tab).catch(() => setError('No se pudo cargar el contenido'))
  }, [tab, sub, semanaKey, cargarHoy, cargarSemana, cargarPlantillas, cargarCalendario, cargarHistorico])

  // ─── Acciones: checklist de hoy ─────────────────────────────────────────────

  const refrescarContador = async (nuevos: ItemEjecucion[]) => {
    if (!ejecucion) return
    const completados = nuevos.filter(i => i.completado).length
    const totalItems = nuevos.length
    const todo = completados === totalItems && totalItems > 0
    await supabase.from('checklist_ejecuciones')
      .update({ items_completados: completados, completado: todo })
      .eq('id', ejecucion.id)
    setEjecucion(prev => prev ? { ...prev, items_completados: completados, completado: todo } : prev)
  }

  const toggleItem = async (item: ItemEjecucion) => {
    if (item.requiere_dato && !item.completado && !(item.dato_valor || '').trim()) {
      setAviso('Este punto necesita el dato (temperatura, foto o nota) antes de marcarlo.')
      return
    }
    setAviso(null)
    const nuevo = !item.completado
    const ahora = nuevo ? new Date().toISOString() : null
    const nuevos = items.map(i => i.id === item.id ? { ...i, completado: nuevo, completado_at: ahora } : i)
    setItems(nuevos)
    const { error: e } = await supabase.from('checklist_items_ejecucion')
      .update({ completado: nuevo, completado_at: ahora }).eq('id', item.id)
    if (e) { setItems(items); return }
    await refrescarContador(nuevos)
  }

  const guardarDato = async (item: ItemEjecucion, valor: string) => {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, dato_valor: valor } : i))
    await supabase.from('checklist_items_ejecucion').update({ dato_valor: valor || null }).eq('id', item.id)
  }

  const guardarResponsable = async (valor: string) => {
    if (!ejecucion) return
    setEjecucion(prev => prev ? { ...prev, responsable: valor } : prev)
    await supabase.from('checklist_ejecuciones').update({ responsable: valor || null }).eq('id', ejecucion.id)
  }

  const onFoto = async (file: File | null) => {
    if (!file || !ejecucion) return
    setSubiendoFoto(true); setAviso(null)
    try {
      const { base64, mime } = await comprimirFoto(file)
      const resp = await fetch('/api/checklists', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ejecucion_id: ejecucion.id, foto_base64: base64, mime }),
      })
      const data = await resp.json() as { ok?: boolean; error?: string; marcados?: number; totales?: number; responsable?: string | null }
      if (!resp.ok || !data.ok) { setAviso(data.error || 'No se pudo procesar la foto.'); return }
      setAviso(`Foto leída: ${data.marcados}/${data.totales} puntos cumplidos${data.responsable ? ` · ${data.responsable}` : ''}`)
      if (esTickable(tab)) await cargarHoy(tab)
    } catch (e: unknown) {
      setAviso(e instanceof Error ? e.message : String(e))
    } finally {
      setSubiendoFoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ─── Acciones: hoja semanal ─────────────────────────────────────────────────

  const guardarCelda = async (fila: FilaSemana, diaIdx: number, campo: 'hizo' | 'vf', valor: string) => {
    const celdas: Record<string, Celda> = { ...(fila.celdas || {}) }
    const actual: Celda = { ...(celdas[String(diaIdx)] || {}) }
    if (valor) actual[campo] = valor.slice(0, 4).toUpperCase()
    else delete actual[campo]
    if (Object.keys(actual).length === 0) delete celdas[String(diaIdx)]
    else celdas[String(diaIdx)] = actual
    setSemana(prev => prev.map(f => f.id === fila.id ? { ...f, celdas } : f))
    await supabase.from('checklist_semana').update({ celdas, updated_at: new Date().toISOString() }).eq('id', fila.id)
  }

  const renombrarFilaSemana = async (fila: FilaSemana, nombre: string) => {
    setSemana(prev => prev.map(f => f.id === fila.id ? { ...f, item_nombre: nombre } : f))
    await supabase.from('checklist_semana').update({ item_nombre: nombre }).eq('id', fila.id)
  }

  const moverSemana = (dias: number) => {
    const d = new Date(lunes); d.setDate(d.getDate() + dias); setLunes(lunesDe(d))
  }

  // ─── Acciones: editor de contenido ──────────────────────────────────────────

  const guardarPlantilla = async (p: Plantilla, cambios: Partial<Plantilla>) => {
    setPlantillas(prev => prev.map(x => x.id === p.id ? { ...x, ...cambios } : x))
    await supabase.from('checklist_plantillas').update(cambios).eq('id', p.id)
  }

  const moverPlantilla = async (idx: number, dir: -1 | 1) => {
    const destino = idx + dir
    if (destino < 0 || destino >= plantillas.length) return
    const lista = [...plantillas]
    const tmp = lista[idx]; lista[idx] = lista[destino]; lista[destino] = tmp
    const conOrden = lista.map((p, i) => ({ ...p, orden: i + 1 }))
    setPlantillas(conOrden)
    await Promise.all(conOrden.map(p => supabase.from('checklist_plantillas').update({ orden: p.orden }).eq('id', p.id)))
  }

  const anadirPlantilla = async () => {
    const nombre = nuevoItem.trim()
    if (!nombre) return
    const orden = plantillas.length + 1
    const { data, error: e } = await supabase.from('checklist_plantillas')
      .insert({ tipo: tab, nombre, orden, activo: true }).select().single()
    if (e || !data) return
    setPlantillas(prev => [...prev, data as Plantilla])
    setNuevoItem('')
  }

  const borrarPlantilla = async (p: Plantilla) => {
    setPlantillas(prev => prev.filter(x => x.id !== p.id))
    await supabase.from('checklist_plantillas').update({ activo: false }).eq('id', p.id)
  }

  // ─── Acciones: calendario ───────────────────────────────────────────────────

  const guardarTarea = async (t: TareaCalendario, cambios: Partial<TareaCalendario>) => {
    setCalendario(prev => prev.map(x => x.id === t.id ? { ...x, ...cambios } : x))
    await supabase.from('checklist_calendario').update(cambios).eq('id', t.id)
  }

  const toggleDiaTarea = async (t: TareaCalendario, dia: number) => {
    const dias = new Set(t.dias ?? [])
    if (dias.has(dia)) dias.delete(dia); else dias.add(dia)
    await guardarTarea(t, { dias: Array.from(dias).sort((a, b) => a - b) })
  }

  // ─── PDFs ───────────────────────────────────────────────────────────────────

  const pdfSemanal = async (bn: boolean, conDatos: boolean) => {
    const rec = await M.cargarRecursos()
    const origen: { item_nombre: string; celdas: Record<string, Celda> }[] = semana.length > 0
      ? semana.map(f => ({ item_nombre: f.item_nombre, celdas: f.celdas || {} }))
      : plantillas.map(p => ({ item_nombre: p.nombre, celdas: {} }))

    const filas: FilaChecklist[] = origen.map(f => {
      const plant = plantillas.find(p => p.nombre === f.item_nombre)
      return {
        nombre: f.item_nombre,
        requiereDato: plant?.requiere_dato,
        tipoDato: plant?.tipo_dato ?? null,
        celdas: conDatos ? Array.from({ length: 7 }, (_, d) => f.celdas[String(d)] || {}) : undefined,
      }
    })

    return crearChecklistSemanaPdf(rec, {
      docNombre: TIPO_DOC[tab] ?? 'Checklist',
      tituloCentrado: TIPO_LABEL[tab] ?? '',
      meta: `${rotuloSemana(lunes)} · C/ Pico de la Maliciosa 6`,
      filas,
      incentivoTexto: incentivoEur ? `INCENTIVO ${incentivoEur} €` : null,
      notaPie: 'Hizo = iniciales de quien lo hace · Vf = verificación. Al terminar la semana: foto de la hoja → ERP · Operaciones · Checklists.',
      bn,
    })
  }

  const pdfEstandar = async (bn: boolean) => {
    const rec = await M.cargarRecursos()
    const grupos: Record<string, string[]> = {}
    plantillas.forEach(p => {
      const g = p.nota || 'General'
      if (!grupos[g]) grupos[g] = []
      grupos[g].push(p.nombre)
    })
    return crearHojaTextoPdf(rec, {
      docNombre: 'Estándar de servicio',
      tituloCentrado: 'Norma de cocina',
      meta: 'C/ Pico de la Maliciosa 6 · Streat Lab',
      bloques: Object.entries(grupos).map(([titulo, lineas]) => ({ titulo, lineas })),
      bn,
    })
  }

  const pdfCalendario = async (bn: boolean) => {
    const rec = await M.cargarRecursos()
    const nombreDias = (d: number[] | null) => (d ?? []).map(x => DIAS_LARGOS[x - 1]).join(', ')
    const fijas = calendario.filter(t => t.clase === 'fija' && t.activo).map(t => `${t.tarea} — ${nombreDias(t.dias)}`)
    const rot = calendario.filter(t => t.clase === 'rotativa' && t.activo)
      .sort((a, b) => (a.semana_ciclo ?? 0) - (b.semana_ciclo ?? 0))
      .map(t => `Semana ${t.semana_ciclo} · ${nombreDias(t.dias)} — ${t.tarea}`)
    const quin = calendario.filter(t => t.clase === 'quincenal' && t.activo).map(t => `${t.tarea}${t.nota ? ` (${t.nota})` : ''}`)
    return crearHojaTextoPdf(rec, {
      docNombre: 'Calendario de limpiezas',
      tituloCentrado: 'Cocina',
      meta: 'Ciclo rotativo de 3 semanas · Streat Lab',
      bloques: [
        { titulo: 'Fijas cada semana', lineas: fijas },
        { titulo: 'Rotativas (ciclo de 3 semanas)', lineas: rot },
        { titulo: 'Quincenal', lineas: quin },
      ],
      bn,
    })
  }

  const pdfPlanning = async (bn: boolean) => {
    const rec = await M.cargarRecursos()
    const y = mesPlanning.getFullYear(); const m = mesPlanning.getMonth()
    const ultimo = new Date(y, m + 1, 0).getDate()
    const lineas: string[] = []
    for (let d = 1; d <= ultimo; d++) {
      const f = new Date(y, m, d)
      const t = tareasDelDia(calendario, f).map(x => x.tarea)
      lineas.push(`${String(d).padStart(2, '0')} ${DIAS_CORTOS[(f.getDay() + 6) % 7]} — ${t.length ? t.join(' · ') : 'sin tarea extra'}`)
    }
    return crearHojaTextoPdf(rec, {
      docNombre: 'Planning mensual de limpiezas',
      tituloCentrado: mesPlanning.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
      meta: 'Generado desde el calendario del ERP',
      bloques: [{ titulo: 'Día a día', lineas }],
      bn,
    })
  }

  // ─── Estilos ────────────────────────────────────────────────────────────────

  const btnBase: React.CSSProperties = {
    fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase',
    border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '9px 16px', cursor: 'pointer', color: INK, borderRadius: 0,
  }
  const btnPrimario: React.CSSProperties = { ...btnBase, background: AMA }
  const btnSecundario: React.CSSProperties = { ...btnBase, background: CLARO }
  const inputNeo: React.CSSProperties = {
    padding: '8px 10px', background: BLANCO, border: `3px solid ${INK}`, color: INK,
    fontFamily: LEX, fontSize: 14, outline: 'none', borderRadius: 0,
  }
  const celdaInput: React.CSSProperties = {
    width: '100%', border: 'none', outline: 'none', background: 'transparent',
    fontFamily: OSW, fontWeight: 600, fontSize: 12, textAlign: 'center', textTransform: 'uppercase',
  }

  // ─── Derivados ──────────────────────────────────────────────────────────────

  const totalItems = items.length
  const hechos = items.filter(i => i.completado).length
  const pct = totalItems > 0 ? Math.round((hechos / totalItems) * 100) : 0
  const completo = totalItems > 0 && hechos === totalItems
  const tareasHoy = useMemo(() => tareasDelDia(calendario, new Date()), [calendario])
  const etiqueta = (TIPO_LABEL[tab] ?? '').toLowerCase()

  const titularHero = tab === 'historico'
    ? (historico.length ? `${historico.length} registros en el histórico de checklists.` : 'Aún no hay histórico de checklists.')
    : tab === 'calendario' ? 'Calendario de limpiezas de la cocina, editable.'
    : tab === 'planning' ? 'Planning mensual generado desde el calendario.'
    : tab === 'estandar_servicio' ? 'Estándar de servicio: la norma fija de la cocina.'
    : sub === 'semana' ? `Hoja semanal de ${etiqueta} lista para imprimir o rellenar aquí.`
    : sub === 'editar' ? `Editando el contenido de ${etiqueta}.`
    : totalItems === 0 ? `Checklist de ${etiqueta} sin cargar todavía.`
    : completo ? `Checklist de ${etiqueta} completado.`
    : hechos === 0 ? `Checklist de ${etiqueta} sin empezar.`
    : `Checklist de ${etiqueta} en marcha.`

  const mostrarEditor = (esTickable(tab) && sub === 'editar') || tab === 'estandar_servicio'

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <PantallaCantera>

      {/* Tabs de hoja */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSub('hoy') }}
            style={{
              padding: '8px 16px', border: `3px solid ${INK}`, borderRadius: 0,
              background: tab === t.key ? GRANATE : BLANCO,
              color: tab === t.key ? BLANCO : INK,
              boxShadow: tab === t.key ? SHADOW : 'none',
              fontFamily: OSW, fontSize: 13, fontWeight: 600, letterSpacing: '1px',
              textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Subvistas de los checklists tickables */}
      {esTickable(tab) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {([['hoy', 'Hoy'], ['semana', 'Hoja semanal'], ['editar', 'Editar contenido']] as [SubVista, string][]).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setSub(k)}
              style={{
                padding: '6px 14px', border: `2px solid ${INK}`, borderRadius: 0,
                background: sub === k ? NAR : BLANCO, color: sub === k ? BLANCO : INK,
                fontFamily: OSW, fontSize: 12, fontWeight: 600, letterSpacing: '1px',
                textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      <HeroCantera
        area="ops"
        periodo={new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, c => c.toUpperCase())}
        titular={titularHero}
        etiquetaDato={esTickable(tab) && sub === 'hoy' && totalItems > 0 ? 'Progreso del checklist' : undefined}
        cifra={esTickable(tab) && sub === 'hoy' && totalItems > 0 ? `${hechos}/${totalItems} — ${pct}%` : undefined}
        atencion={[
          esTickable(tab) && sub === 'hoy' && ejecucion?.responsable ? `Responsable: ${ejecucion.responsable}` : null,
          incentivoEur ? `Incentivo checklists: ${incentivoEur} €` : null,
          tareasHoy.length ? `Hoy toca: ${tareasHoy.map(t => t.tarea).join(' · ')}` : null,
        ].filter(Boolean) as string[]}
      />

      {error && <Papel ceja={ROJO} style={{ background: ROJO, color: BLANCO }}>{error}</Papel>}
      {aviso && <Papel ceja={AMA}>{aviso}</Papel>}
      {loading && (
        <div style={{ color: GRIS, fontFamily: OSW, textTransform: 'uppercase', letterSpacing: '1px', fontSize: 13, padding: '20px 0' }}>Cargando…</div>
      )}

      {/* ─── HOY ─────────────────────────────────────────────────────── */}
      {!loading && esTickable(tab) && sub === 'hoy' && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <BotonImprimir
              compacto
              documentoId={`operaciones.checklist_${tab}`}
              titulo={TIPO_DOC[tab] ?? 'Checklist'}
              generarPdf={async opts => pdfSemanal(!!opts.bn, false)}
            />
            <button onClick={() => fileInputRef.current?.click()} disabled={subiendoFoto} style={{ ...btnPrimario, opacity: subiendoFoto ? 0.6 : 1 }}>
              {subiendoFoto ? 'Leyendo foto…' : 'Subir foto'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={e => onFoto(e.target.files?.[0] ?? null)} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <span style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS }}>Responsable</span>
              <input type="text" defaultValue={ejecucion?.responsable ?? ''} onBlur={e => guardarResponsable(e.target.value.trim())}
                placeholder="Nombre…" style={{ ...inputNeo, width: 150 }} />
            </div>
          </div>

          {totalItems > 0 && (
            completo
              ? <FrasePotente significado="logro">Checklist de {etiqueta} completado: todo listo.</FrasePotente>
              : pct < 50
                ? <FrasePotente significado="peligro">Quedan {totalItems - hechos} puntos por marcar en este checklist.</FrasePotente>
                : <FrasePotente significado="coste">Quedan {totalItems - hechos} puntos para cerrar el checklist.</FrasePotente>
          )}

          <div>
            <SeccionLabel bg={NAR}>Puntos de control</SeccionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map(item => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                  border: BORDER_CARD, borderRadius: 0,
                  boxShadow: item.completado ? 'none' : SHADOW,
                  background: item.completado ? CLARO : BLANCO,
                }}>
                  <div onClick={() => toggleItem(item)} style={{
                    width: 30, height: 30, border: `3px solid ${INK}`, cursor: 'pointer',
                    background: item.completado ? VERDE : BLANCO,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {item.completado && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7L6 11L12 3" stroke={BLANCO} strokeWidth="3" strokeLinecap="square" />
                      </svg>
                    )}
                  </div>

                  <span onClick={() => toggleItem(item)} style={{
                    fontFamily: LEX, fontSize: 15, flex: 1, cursor: 'pointer', userSelect: 'none',
                    color: item.completado ? GRIS : INK,
                    textDecoration: item.completado ? 'line-through' : 'none',
                  }}>
                    {item.item_nombre}
                  </span>

                  {item.requiere_dato && (
                    <input
                      type={item.tipo_dato === 'numero' ? 'number' : 'text'}
                      defaultValue={item.dato_valor ?? ''}
                      onBlur={e => guardarDato(item, e.target.value.trim())}
                      placeholder={item.tipo_dato === 'numero' ? 'ºC' : item.tipo_dato === 'foto' ? 'Enviada' : 'Nota'}
                      style={{ ...inputNeo, width: 120, borderColor: (item.dato_valor || '').trim() ? INK : ROJO }}
                    />
                  )}

                  {item.completado_at && (
                    <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 13, color: VERDE, flexShrink: 0 }}>
                      {fmtHora(item.completado_at)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ─── HOJA SEMANAL ────────────────────────────────────────────── */}
      {!loading && esTickable(tab) && sub === 'semana' && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => moverSemana(-7)} style={btnSecundario}>← Semana</button>
            <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 15, textTransform: 'uppercase', letterSpacing: '1px' }}>
              {rotuloSemana(lunes)}
            </span>
            <button onClick={() => moverSemana(7)} style={btnSecundario}>Semana →</button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <BotonImprimir
                compacto
                documentoId={`operaciones.checklist_${tab}_semana`}
                titulo={`${TIPO_DOC[tab] ?? 'Checklist'} · semana`}
                etiqueta="Imprimir en blanco"
                generarPdf={async opts => pdfSemanal(!!opts.bn, false)}
              />
              <BotonImprimir
                compacto
                documentoId={`operaciones.checklist_${tab}_semana_datos`}
                titulo={`${TIPO_DOC[tab] ?? 'Checklist'} · semana rellenada`}
                etiqueta="Imprimir rellenada"
                generarPdf={async opts => pdfSemanal(!!opts.bn, true)}
              />
            </div>
          </div>

          <Papel ceja={NAR} pad="0" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
              <thead>
                <tr style={{ background: INK }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, minWidth: 260 }}>
                    Punto de control
                  </th>
                  {fechas.map((f, i) => (
                    <th key={i} colSpan={2} style={{ padding: '8px 4px', textAlign: 'center', fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: CREMA, borderLeft: `3px solid ${CREMA}` }}>
                      {DIAS_CORTOS[i]} {f.getDate()}
                    </th>
                  ))}
                </tr>
                <tr style={{ background: INK }}>
                  <th aria-label="vacio" />
                  {fechas.map((_, i) => (
                    <React.Fragment key={i}>
                      <th style={{ padding: '2px 4px', fontFamily: OSW, fontSize: 9, color: CREMA, borderLeft: `3px solid ${CREMA}` }}>Hizo</th>
                      <th style={{ padding: '2px 4px', fontFamily: OSW, fontSize: 9, color: VERDE }}>Vf</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {semana.map(fila => (
                  <tr key={fila.id} style={{ borderBottom: `2px solid ${INK}` }}>
                    <td style={{ padding: '4px 8px' }}>
                      <input
                        defaultValue={fila.item_nombre}
                        onBlur={e => renombrarFilaSemana(fila, e.target.value.trim() || fila.item_nombre)}
                        style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontFamily: LEX, fontSize: 13 }}
                      />
                    </td>
                    {fechas.map((_, d) => {
                      const c = (fila.celdas || {})[String(d)] || {}
                      return (
                        <React.Fragment key={d}>
                          <td style={{ borderLeft: `3px solid ${INK}`, width: 42 }}>
                            <input defaultValue={c.hizo ?? ''} maxLength={4}
                              onBlur={e => guardarCelda(fila, d, 'hizo', e.target.value.trim())}
                              style={celdaInput} />
                          </td>
                          <td style={{ borderLeft: `1px solid ${GRIS}`, width: 38 }}>
                            <input defaultValue={c.vf ?? ''} maxLength={4}
                              onBlur={e => guardarCelda(fila, d, 'vf', e.target.value.trim())}
                              style={{ ...celdaInput, color: VERDE }} />
                          </td>
                        </React.Fragment>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Papel>
          <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>
            Hizo = iniciales de quien lo hace · Vf = verificación. Se guarda solo al salir de cada casilla.
          </div>
        </>
      )}

      {/* ─── EDITOR DE CONTENIDO ─────────────────────────────────────── */}
      {!loading && mostrarEditor && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <SeccionLabel bg={AMA}>{(TIPO_LABEL[tab] ?? '').toUpperCase()} — CONTENIDO EDITABLE</SeccionLabel>
            <div style={{ marginLeft: 'auto' }}>
              {tab === 'estandar_servicio' && (
                <BotonImprimir compacto documentoId="operaciones.estandar_servicio" titulo="Estándar de servicio"
                  generarPdf={async opts => pdfEstandar(!!opts.bn)} />
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {plantillas.map((p, idx) => (
              <div key={p.id} style={{ background: BLANCO, border: BORDER_CARD, borderRadius: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 13, color: GRIS, minWidth: 24, textAlign: 'right' }}>{idx + 1}</span>
                <input
                  defaultValue={p.nombre}
                  onBlur={e => guardarPlantilla(p, { nombre: e.target.value.trim() || p.nombre })}
                  style={{ ...inputNeo, flex: 1, minWidth: 240, border: 'none', padding: '4px 6px' }}
                />
                {tab === 'estandar_servicio' && (
                  <input
                    defaultValue={p.nota ?? ''}
                    onBlur={e => guardarPlantilla(p, { nota: e.target.value.trim() || null })}
                    placeholder="Apartado"
                    style={{ ...inputNeo, width: 170, padding: '4px 6px' }}
                  />
                )}
                <label style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={p.requiere_dato}
                    onChange={e => guardarPlantilla(p, { requiere_dato: e.target.checked, tipo_dato: e.target.checked ? (p.tipo_dato ?? 'texto') : null })} />
                  Dato obligatorio
                </label>
                {p.requiere_dato && (
                  <select value={p.tipo_dato ?? 'texto'} onChange={e => guardarPlantilla(p, { tipo_dato: e.target.value })}
                    style={{ ...inputNeo, padding: '4px 6px' }}>
                    <option value="numero">Número</option>
                    <option value="foto">Foto</option>
                    <option value="texto">Nota</option>
                  </select>
                )}
                <button onClick={() => moverPlantilla(idx, -1)} style={{ ...btnSecundario, boxShadow: 'none', padding: '4px 8px', fontSize: 11 }}>↑</button>
                <button onClick={() => moverPlantilla(idx, 1)} style={{ ...btnSecundario, boxShadow: 'none', padding: '4px 8px', fontSize: 11 }}>↓</button>
                <button onClick={() => borrarPlantilla(p)} style={{ padding: '4px 10px', background: BLANCO, border: `2px solid ${ROJO}`, color: ROJO, fontFamily: OSW, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', cursor: 'pointer', borderRadius: 0 }}>
                  Quitar
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input value={nuevoItem} onChange={e => setNuevoItem(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') anadirPlantilla() }}
              placeholder="Nuevo punto de control…" style={{ ...inputNeo, flex: 1, minWidth: 240 }} />
            <button onClick={anadirPlantilla} style={btnPrimario}>+ Añadir</button>
          </div>
        </>
      )}

      {/* ─── CALENDARIO ──────────────────────────────────────────────── */}
      {!loading && tab === 'calendario' && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <SeccionLabel bg={NAR}>Calendario de limpiezas</SeccionLabel>
            <div style={{ marginLeft: 'auto' }}>
              <BotonImprimir compacto documentoId="operaciones.calendario_limpiezas" titulo="Calendario de limpiezas"
                generarPdf={async opts => pdfCalendario(!!opts.bn)} />
            </div>
          </div>

          <Papel ceja={NAR} pad="0" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
              <thead>
                <tr style={{ background: INK }}>
                  {['Clase', 'Tarea', 'L', 'M', 'X', 'J', 'V', 'S', 'D', 'Semana ciclo'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: CREMA }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calendario.map(t => (
                  <tr key={t.id} style={{ borderBottom: `2px solid ${INK}`, opacity: t.activo ? 1 : 0.45 }}>
                    <td style={{ padding: '6px 10px', fontFamily: OSW, fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: t.clase === 'rotativa' ? GRANATE : t.clase === 'quincenal' ? NAR : GRIS }}>
                      {t.clase}
                    </td>
                    <td style={{ padding: '4px 8px', minWidth: 300 }}>
                      <input defaultValue={t.tarea} onBlur={e => guardarTarea(t, { tarea: e.target.value.trim() || t.tarea })}
                        style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontFamily: LEX, fontSize: 13 }} />
                    </td>
                    {[1, 2, 3, 4, 5, 6, 7].map(d => (
                      <td key={d} style={{ padding: '4px 6px', textAlign: 'center' }}>
                        <input type="checkbox" checked={(t.dias ?? []).includes(d)} disabled={t.clase === 'quincenal'}
                          onChange={() => toggleDiaTarea(t, d)} />
                      </td>
                    ))}
                    <td style={{ padding: '4px 8px' }}>
                      {t.clase === 'rotativa' ? (
                        <select value={t.semana_ciclo ?? 1} onChange={e => guardarTarea(t, { semana_ciclo: Number(e.target.value) })}
                          style={{ ...inputNeo, padding: '3px 6px' }}>
                          <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                        </select>
                      ) : <span style={{ color: GRIS }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Papel>
          <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>
            Fijas = todas las semanas · Rotativas = una por semana en ciclo de 3 · Quincenal = días 1 y 15.
          </div>
        </>
      )}

      {/* ─── PLANNING MENSUAL ────────────────────────────────────────── */}
      {!loading && tab === 'planning' && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => setMesPlanning(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} style={btnSecundario}>← Mes</button>
            <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 15, textTransform: 'uppercase', letterSpacing: '1px' }}>
              {mesPlanning.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => setMesPlanning(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} style={btnSecundario}>Mes →</button>
            <div style={{ marginLeft: 'auto' }}>
              <BotonImprimir compacto documentoId="operaciones.planning_mensual_limpiezas" titulo="Planning mensual de limpiezas"
                generarPdf={async opts => pdfPlanning(!!opts.bn)} />
            </div>
          </div>

          <Papel ceja={NAR} pad="0" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
              <thead>
                <tr style={{ background: INK }}>
                  {['Día', 'Semana ciclo', 'Tareas del día'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: CREMA }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: new Date(mesPlanning.getFullYear(), mesPlanning.getMonth() + 1, 0).getDate() }, (_, i) => {
                  const f = new Date(mesPlanning.getFullYear(), mesPlanning.getMonth(), i + 1)
                  const tar = tareasDelDia(calendario, f)
                  const domingo = f.getDay() === 0
                  return (
                    <tr key={i} style={{ borderBottom: `2px solid ${INK}`, background: domingo ? CLARO : BLANCO }}>
                      <td style={{ padding: '6px 10px', fontFamily: OSW, fontWeight: 700 }}>
                        {String(i + 1).padStart(2, '0')} {DIAS_CORTOS[(f.getDay() + 6) % 7]}
                      </td>
                      <td style={{ padding: '6px 10px', color: GRIS }}>{semanaCiclo(f)}</td>
                      <td style={{ padding: '6px 10px' }}>
                        {tar.length === 0 ? <span style={{ color: GRIS }}>—</span> : tar.map(t => t.tarea).join(' · ')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Papel>
        </>
      )}

      {/* ─── HISTÓRICO ───────────────────────────────────────────────── */}
      {!loading && tab === 'historico' && (
        <Papel ceja={NAR} pad="0" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
            <thead>
              <tr style={{ background: INK }}>
                {['Fecha', 'Tipo', 'Responsable', 'Puntos', '%', 'Origen', 'Estado'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historico.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '20px 14px', color: GRIS, textAlign: 'center' }}>Sin registros aún</td></tr>
              ) : historico.map(h => {
                const p = h.items_totales > 0 ? Math.round((h.items_completados / h.items_totales) * 100) : 0
                return (
                  <tr key={h.id} style={{ borderBottom: `2px solid ${INK}` }}>
                    <td style={{ padding: '10px 14px' }}>{fmtFechaCorta(h.fecha)}</td>
                    <td style={{ padding: '10px 14px', fontFamily: OSW, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase' }}>{TIPO_LABEL[h.tipo] ?? h.tipo}</td>
                    <td style={{ padding: '10px 14px' }}>{h.responsable || '—'}</td>
                    <td style={{ padding: '10px 14px', fontFamily: OSW, fontWeight: 700 }}>{h.items_completados}/{h.items_totales}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontFamily: OSW, fontWeight: 700, color: BLANCO, background: progressColor(p), border: `2px solid ${INK}`, padding: '2px 8px' }}>{p}%</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: h.origen === 'foto' ? GRANATE : GRIS }}>
                      {h.origen === 'foto' ? 'Foto' : 'Manual'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: h.completado ? VERDE : ROJO, color: BLANCO, border: `2px solid ${INK}`, padding: '3px 10px', fontSize: 11, fontFamily: OSW, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
                        {h.completado ? 'Completado' : 'Pendiente'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Papel>
      )}
    </PantallaCantera>
  )
}
