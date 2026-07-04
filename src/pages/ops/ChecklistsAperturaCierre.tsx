/**
 * Checklists Operativos — Apertura / Cierres / Limpiezas / Recepción / Histórico
 *
 * - 6 checklists diarios/semanales con plantillas editables (checklist_plantillas).
 * - Impresión en blanco (A4) para rellenar a boli en cocina.
 * - Lectura por foto: se sube la foto del papel rellenado y /api/checklists
 *   (visión Anthropic) marca automáticamente los items cumplidos.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'

// ─── Types ────────────────────────────────────────────────────────────────────

type TipoChecklist = 'apertura' | 'cierre_mediodia' | 'cierre' | 'limpieza' | 'limpieza_fondo' | 'recepcion'

interface ItemEjecucion {
  id: string
  ejecucion_id: string
  plantilla_id: string | null
  item_nombre: string
  completado: boolean
  completado_at: string | null
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

interface Plantilla {
  id: string
  tipo: string
  nombre: string
  orden: number
  activo: boolean
}

// ─── Defaults (fallback si la plantilla en BD está vacía) ────────────────────

const DEFAULTS: Record<TipoChecklist, string[]> = {
  apertura: [
    'Encender equipos frigoríficos',
    'Verificar temperaturas frigoríficos (< 4°C)',
    'Encender hornos y equipos de cocina',
    'Verificar stock mínimo de aperturas',
    'Comprobar limpieza de superficies',
    'Verificar materiales de embalaje',
    'Activar plataformas delivery (Uber, Glovo, JE)',
    'Verificar conexión internet y tablets',
    'Comprobar carta actualizada en plataformas',
    'Briefing equipo',
  ],
  cierre_mediodia: [
    'Desactivar plataformas delivery (pausa mediodía)',
    'Guardar y filmar producto abierto con fecha',
    'Limpiar superficies de trabajo y tablas',
    'Apagar o poner en mínimo freidoras y planchas',
    'Verificar temperaturas cámaras (<4°C)',
    'Vaciar basura si está llena',
    'Fregar utensilios y menaje del turno',
    'Anotar producto agotado o bajo mínimo',
    'Dejar novedades escritas para turno de tarde',
  ],
  cierre: [
    'Desactivar plataformas delivery',
    'Limpiar y desinfectar superficies de trabajo',
    'Limpiar equipos (freidoras, planchas, hornos)',
    'Guardar productos en recipientes herméticos etiquetados',
    'Vaciar y limpiar cubos de basura',
    'Verificar temperaturas frigoríficos y congeladores',
    'Limpiar suelos',
    'Revisar que todo esté apagado',
    'Cerrar llaves de gas',
    'Cierre de caja y registro ventas del día',
    'Dejar novedades escritas',
    'Cierre de aplicaciones ERP',
  ],
  limpieza: [
    'Superficies de trabajo desinfectadas',
    'Planchas y freidoras limpias (aceite filtrado)',
    'Hornos y microondas por dentro',
    'Fregadero y grifería',
    'Suelos barridos y fregados con desengrasante',
    'Cubos de basura vaciados y con bolsa nueva',
    'Tiradores, puertas de cámaras y zonas de contacto',
    'Estanterías de uso diario repasadas',
    'Paños y bayetas a lavar / cambiados',
    'Zona de empaquetado y salida de pedidos limpia',
  ],
  limpieza_fondo: [
    'Cámaras frigoríficas vaciadas y desinfectadas por dentro',
    'Congeladores: revisar escarcha y limpiar juntas',
    'Campana extractora y filtros desengrasados',
    'Detrás y debajo de equipos (planchas, freidoras, mesas)',
    'Paredes y azulejos desengrasados',
    'Estanterías de almacén vaciadas y limpiadas',
    'Desagües y sumideros con desatascador/desinfectante',
    'Techos y lámparas: polvo y grasa',
    'Revisión de plagas: trampas y señales',
    'Cubos de basura lavados con manguera',
    'Microondas, batidoras y pequeño equipo desmontado y limpio',
  ],
  recepcion: [
    'Comprobar albarán contra pedido realizado',
    'Verificar temperatura de refrigerados (<4°C) y congelados (<-18°C)',
    'Revisar fechas de caducidad de todo lo recibido',
    'Comprobar estado de envases (rotos, hinchados, sucios)',
    'Pesar o contar productos clave',
    'Rechazar y anotar producto no conforme',
    'Guardar en cámara/almacén en menos de 15 minutos',
    'Rotar stock: lo nuevo detrás (FIFO)',
    'Guardar albarán/factura en carpeta o subir al ERP',
  ],
}

const TIPO_LABEL: Record<TipoChecklist, string> = {
  apertura: 'Apertura',
  cierre_mediodia: 'Cierre mediodía',
  cierre: 'Cierre noche',
  limpieza: 'Limpieza diaria',
  limpieza_fondo: 'Limpieza a fondo',
  recepcion: 'Recepción proveedores',
}

const TABS: { key: TipoChecklist | 'historico'; label: string }[] = [
  { key: 'apertura', label: 'Apertura' },
  { key: 'cierre_mediodia', label: 'Cierre mediodía' },
  { key: 'cierre', label: 'Cierre noche' },
  { key: 'limpieza', label: 'Limpieza' },
  { key: 'limpieza_fondo', label: 'Limpieza a fondo' },
  { key: 'recepcion', label: 'Recepción' },
  { key: 'historico', label: 'Histórico' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function localDateStr(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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
  if (pct < 30) return '#B01D23'
  if (pct < 70) return '#f5a623'
  return '#1D9E75'
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
        if (!ctx) return reject(new Error('Canvas no disponible'))
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        resolve({ base64: dataUrl.split(',')[1], mime: 'image/jpeg' })
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

// Genera e imprime la versión en papel (en blanco) del checklist.
function imprimirChecklist(tipo: TipoChecklist, nombres: string[]) {
  const filas = nombres.map((n, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td class="check"><div class="box"></div></td>
      <td class="nombre">${n}</td>
      <td class="obs"></td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Checklist ${TIPO_LABEL[tipo]}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 20px; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 2px; }
  .sub { font-size: 11px; color: #555; margin-bottom: 14px; }
  .campos { display: flex; gap: 24px; margin-bottom: 14px; font-size: 13px; }
  .campos .campo { flex: 1; border-bottom: 1px solid #111; padding-bottom: 3px; }
  .campos .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #555; display:block; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #555; border-bottom: 2px solid #111; padding: 4px 6px; }
  td { border-bottom: 1px solid #999; padding: 7px 6px; font-size: 13px; vertical-align: middle; }
  td.num { width: 26px; color: #555; font-size: 11px; }
  td.check { width: 40px; }
  .box { width: 22px; height: 22px; border: 2px solid #111; }
  td.obs { width: 32%; }
  .footer { margin-top: 16px; font-size: 13px; }
  .footer .linea { border-bottom: 1px solid #111; height: 42px; margin-top: 6px; }
  .footer .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #555; }
  .firma { display:flex; gap: 24px; margin-top: 18px; }
  .firma > div { flex: 1; }
  .aviso { margin-top: 12px; font-size: 10px; color: #777; }
</style></head><body>
  <h1>Checklist · ${TIPO_LABEL[tipo]}</h1>
  <div class="sub">Streat Lab · C/ Pico de la Maliciosa 6 · Marca con X la casilla de cada punto cumplido</div>
  <div class="campos">
    <div class="campo"><span class="lbl">Fecha</span>&nbsp;</div>
    <div class="campo"><span class="lbl">Responsable</span>&nbsp;</div>
    <div class="campo"><span class="lbl">Hora</span>&nbsp;</div>
  </div>
  <table>
    <thead><tr><th></th><th>OK</th><th>Punto de control</th><th>Observación</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
  <div class="footer">
    <span class="lbl">Observaciones / Incidencias</span>
    <div class="linea"></div>
  </div>
  <div class="firma">
    <div><span class="lbl" style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#555;">Firma responsable</span><div class="linea" style="border-bottom:1px solid #111;height:42px;margin-top:6px;"></div></div>
  </div>
  <div class="aviso">Al terminar: haz una foto de esta hoja (plana y con luz) y súbela en el ERP → Ops → Checklists. Se rellena solo.</div>
<script>window.onload = function(){ window.print(); }</script>
</body></html>`

  const w = window.open('', '_blank', 'width=900,height=1100')
  if (!w) { alert('El navegador ha bloqueado la ventana de impresión. Permite pop-ups para binagre.vercel.app.'); return }
  w.document.write(html)
  w.document.close()
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChecklistsAperturaCierre() {
  const [activeTab, setActiveTab] = useState<TipoChecklist | 'historico'>('apertura')
  const [ejecucion, setEjecucion] = useState<Ejecucion | null>(null)
  const [items, setItems] = useState<ItemEjecucion[]>([])
  const [historico, setHistorico] = useState<Ejecucion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [nuevoItemTempNombre, setNuevoItemTempNombre] = useState('')
  const [nuevoItemPlantillaNombre, setNuevoItemPlantillaNombre] = useState('')
  const [showAddTemp, setShowAddTemp] = useState(false)
  const [showAddPlantilla, setShowAddPlantilla] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [msgFoto, setMsgFoto] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Load checklist for active tab ──────────────────────────────────────────

  const cargarChecklist = useCallback(async (tipo: TipoChecklist) => {
    setLoading(true)
    setError(null)
    setMsgFoto(null)
    setModoEdicion(false)
    try {
      const hoy = localDateStr()

      const { data: existente, error: errExist } = await supabase
        .from('checklist_ejecuciones')
        .select('*')
        .eq('fecha', hoy)
        .eq('tipo', tipo)
        .maybeSingle()

      if (errExist) throw errExist

      let ejec: Ejecucion

      if (existente) {
        ejec = existente as Ejecucion
      } else {
        const { data: plantData } = await supabase
          .from('checklist_plantillas')
          .select('*')
          .eq('tipo', tipo)
          .eq('activo', true)
          .order('orden')

        let tipedPlant = (plantData ?? []) as Plantilla[]

        if (tipedPlant.length === 0) {
          const seedItems = DEFAULTS[tipo].map((nombre, i) => ({ tipo, nombre, orden: i, activo: true }))
          const { data: seeded } = await supabase
            .from('checklist_plantillas')
            .insert(seedItems)
            .select()
          tipedPlant = (seeded ?? []) as Plantilla[]
        }

        const nombres: string[] = tipedPlant.length > 0
          ? tipedPlant.map((p) => p.nombre)
          : DEFAULTS[tipo]

        const { data: newEjec, error: errEjec } = await supabase
          .from('checklist_ejecuciones')
          .insert({ fecha: hoy, tipo, items_totales: nombres.length, items_completados: 0 })
          .select()
          .single()

        if (errEjec) throw errEjec
        ejec = newEjec as Ejecucion

        const itemsToInsert = nombres.map((nombre, i) => ({
          ejecucion_id: ejec.id,
          plantilla_id: tipedPlant[i]?.id ?? null,
          item_nombre: nombre,
          orden: i,
        }))

        const { error: errItems } = await supabase
          .from('checklist_items_ejecucion')
          .insert(itemsToInsert)

        if (errItems) throw errItems
      }

      const { data: itemsData, error: errItemsLoad } = await supabase
        .from('checklist_items_ejecucion')
        .select('*')
        .eq('ejecucion_id', ejec.id)
        .order('orden')
        .order('created_at')

      if (errItemsLoad) throw errItemsLoad

      setEjecucion(ejec)
      setItems((itemsData ?? []) as ItemEjecucion[])
    } catch (e: unknown) {
      setError(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const cargarHistorico = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: errH } = await supabase
        .from('checklist_ejecuciones')
        .select('*')
        .order('fecha', { ascending: false })
        .order('tipo')
        .limit(60)
      if (errH) throw errH
      setHistorico((data ?? []) as Ejecucion[])
    } catch (e: unknown) {
      setError(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'historico') {
      cargarHistorico()
    } else {
      cargarChecklist(activeTab as TipoChecklist)
    }
  }, [activeTab, cargarChecklist, cargarHistorico])

  // ─── Toggle item ────────────────────────────────────────────────────────────

  const toggleItem = async (item: ItemEjecucion) => {
    if (!ejecucion) return
    const nuevoEstado = !item.completado
    const ahora = nuevoEstado ? new Date().toISOString() : null

    setItems(prev => prev.map(i =>
      i.id === item.id ? { ...i, completado: nuevoEstado, completado_at: ahora } : i
    ))

    const { error: errUpd } = await supabase
      .from('checklist_items_ejecucion')
      .update({ completado: nuevoEstado, completado_at: ahora })
      .eq('id', item.id)

    if (errUpd) {
      setItems(prev => prev.map(i => i.id === item.id ? item : i))
      return
    }

    const updatedItems = items.map(i => i.id === item.id ? { ...i, completado: nuevoEstado } : i)
    const completados = updatedItems.filter(i => i.completado).length
    const totales = updatedItems.length
    const completadoTodo = completados === totales

    await supabase
      .from('checklist_ejecuciones')
      .update({ items_completados: completados, completado: completadoTodo })
      .eq('id', ejecucion.id)

    setEjecucion(prev => prev
      ? { ...prev, items_completados: completados, completado: completadoTodo }
      : prev
    )
  }

  // ─── Responsable ────────────────────────────────────────────────────────────

  const guardarResponsable = async (valor: string) => {
    if (!ejecucion) return
    setEjecucion(prev => prev ? { ...prev, responsable: valor } : prev)
    await supabase.from('checklist_ejecuciones').update({ responsable: valor || null }).eq('id', ejecucion.id)
  }

  // ─── Foto → autorrelleno ────────────────────────────────────────────────────

  const onFotoSeleccionada = async (file: File | null) => {
    if (!file || !ejecucion) return
    setSubiendoFoto(true)
    setMsgFoto(null)
    try {
      const { base64, mime } = await comprimirFoto(file)
      const resp = await fetch('/api/checklists', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ejecucion_id: ejecucion.id, foto_base64: base64, mime }),
      })
      const data = await resp.json() as { ok?: boolean; error?: string; marcados?: number; totales?: number; responsable?: string | null; incidencias?: string | null }
      if (!resp.ok || !data.ok) {
        setMsgFoto(data.error || 'No se pudo procesar la foto.')
        return
      }
      setMsgFoto(`Foto leída: ${data.marcados}/${data.totales} puntos cumplidos${data.responsable ? ` · Responsable: ${data.responsable}` : ''}${data.incidencias ? ` · Incidencias anotadas` : ''}`)
      await cargarChecklist(activeTab as TipoChecklist)
    } catch (e: unknown) {
      setMsgFoto(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSubiendoFoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ─── Add temp item ───────────────────────────────────────────────────────────

  const addItemTemp = async () => {
    if (!ejecucion || !nuevoItemTempNombre.trim()) return
    const { data, error: errAdd } = await supabase
      .from('checklist_items_ejecucion')
      .insert({ ejecucion_id: ejecucion.id, item_nombre: nuevoItemTempNombre.trim(), orden: items.length })
      .select()
      .single()

    if (errAdd || !data) return
    setItems(prev => [...prev, data as ItemEjecucion])
    setNuevoItemTempNombre('')
    setShowAddTemp(false)
    const nuevoTotal = items.length + 1
    await supabase.from('checklist_ejecuciones')
      .update({ items_totales: nuevoTotal })
      .eq('id', ejecucion.id)
    setEjecucion(prev => prev ? { ...prev, items_totales: nuevoTotal } : prev)
  }

  // ─── Plantilla edicion ───────────────────────────────────────────────────────

  const cargarPlantillas = async (tipo: TipoChecklist) => {
    const { data } = await supabase
      .from('checklist_plantillas')
      .select('*')
      .eq('tipo', tipo)
      .order('orden')
    setPlantillas((data ?? []) as Plantilla[])
  }

  const toggleModoEdicion = async () => {
    if (!modoEdicion && activeTab !== 'historico') {
      await cargarPlantillas(activeTab as TipoChecklist)
    }
    setModoEdicion(prev => !prev)
  }

  const addItemPlantilla = async () => {
    if (activeTab === 'historico' || !nuevoItemPlantillaNombre.trim()) return
    const orden = plantillas.length
    const { data, error: errP } = await supabase
      .from('checklist_plantillas')
      .insert({ tipo: activeTab, nombre: nuevoItemPlantillaNombre.trim(), orden })
      .select()
      .single()

    if (errP || !data) return
    setPlantillas(prev => [...prev, data as Plantilla])
    setNuevoItemPlantillaNombre('')
    setShowAddPlantilla(false)
  }

  const deleteItemPlantilla = async (id: string) => {
    await supabase.from('checklist_plantillas').delete().eq('id', id)
    setPlantillas(prev => prev.filter(p => p.id !== id))
  }

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const totalItems = items.length
  const completadosCount = items.filter(i => i.completado).length
  const pct = totalItems > 0 ? Math.round((completadosCount / totalItems) * 100) : 0
  const todoCompleto = totalItems > 0 && completadosCount === totalItems

  const btnPrimario: React.CSSProperties = { padding: '8px 16px', background: '#e8f442', color: '#111111', border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }
  const btnSecundario: React.CSSProperties = { padding: '8px 16px', background: '#222222', border: '1px solid #383838', color: '#cccccc', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: FONT.body, padding: '28px', background: '#111111', minHeight: '100vh', color: '#ffffff' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '3px', color: '#B01D23', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 4px' }}>
          CHECKLISTS OPERATIVOS
        </h1>
        <span style={{ fontFamily: FONT.body, fontSize: 13, color: '#777777' }}>
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '7px 18px',
              borderRadius: 20,
              border: 'none',
              background: activeTab === tab.key ? '#e8f442' : '#1e1e1e',
              color: activeTab === tab.key ? '#111111' : '#cccccc',
              fontFamily: FONT.heading,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 150ms',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div style={{ backgroundColor: '#2d1515', border: '1px solid #aa3030', borderRadius: 8, padding: '14px 18px', color: '#ffaaaa', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ color: '#777777', fontSize: 13, padding: '20px 0' }}>Cargando…</div>
      )}

      {/* ─── Histórico Tab ─────────────────────────────────────────────── */}
      {!loading && !error && activeTab === 'historico' && (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #2a2a2a' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#0a0a0a' }}>
                {['Fecha', 'Tipo', 'Responsable', 'Completados', '%', 'Origen', 'Estado', 'Foto'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#777777', fontWeight: 600, borderBottom: '1px solid #2a2a2a' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historico.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '20px 14px', color: '#777777', textAlign: 'center' }}>Sin registros aún</td>
                </tr>
              ) : historico.map((h, i) => {
                const p = h.items_totales > 0 ? Math.round((h.items_completados / h.items_totales) * 100) : 0
                return (
                  <tr key={h.id} style={{ background: i % 2 === 0 ? '#111111' : '#141414', borderBottom: '1px solid #2a2a2a' }}>
                    <td style={{ padding: '10px 14px', fontFamily: FONT.body }}>{fmtFechaCorta(h.fecha)}</td>
                    <td style={{ padding: '10px 14px', fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: '#cccccc' }}>{TIPO_LABEL[h.tipo as TipoChecklist] ?? h.tipo}</td>
                    <td style={{ padding: '10px 14px', color: '#cccccc' }}>{h.responsable || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>{h.items_completados}/{h.items_totales}</td>
                    <td style={{ padding: '10px 14px', color: progressColor(p), fontWeight: 600 }}>{p}%</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, fontFamily: FONT.heading, letterSpacing: '1px', textTransform: 'uppercase', color: h.origen === 'foto' ? '#e8f442' : '#777777' }}>
                        {h.origen === 'foto' ? '📷 Foto' : 'Manual'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        background: h.completado ? '#1D9E7522' : '#B01D2322',
                        color: h.completado ? '#1D9E75' : '#B01D23',
                        border: `1px solid ${h.completado ? '#1D9E75' : '#B01D23'}`,
                        padding: '2px 10px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontFamily: FONT.heading,
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                      }}>
                        {h.completado ? 'Completado' : 'Pendiente'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {h.foto_url
                        ? <a href={h.foto_url} target="_blank" rel="noreferrer" style={{ color: '#e8f442', fontSize: 12 }}>Ver</a>
                        : <span style={{ color: '#444444' }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Checklist Tab ─────────────────────────────────────────────── */}
      {!loading && !error && activeTab !== 'historico' && !modoEdicion && (
        <div>
          {/* Barra acciones: imprimir + foto + responsable */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => imprimirChecklist(activeTab as TipoChecklist, items.map(i => i.item_nombre))}
              style={btnSecundario}
            >
              🖨 Imprimir en blanco
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={subiendoFoto}
              style={{ ...btnPrimario, opacity: subiendoFoto ? 0.6 : 1 }}
            >
              {subiendoFoto ? 'Leyendo foto…' : '📷 Subir foto del checklist'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={e => onFotoSeleccionada(e.target.files?.[0] ?? null)}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: '#777777' }}>Responsable</span>
              <input
                type="text"
                defaultValue={ejecucion?.responsable ?? ''}
                onBlur={e => guardarResponsable(e.target.value.trim())}
                placeholder="Nombre..."
                style={{ padding: '7px 12px', background: '#1e1e1e', border: '1px solid #383838', borderRadius: 6, color: '#ffffff', fontFamily: FONT.body, fontSize: 13, outline: 'none', width: 140 }}
              />
            </div>
          </div>

          {/* Mensaje resultado foto */}
          {msgFoto && (
            <div style={{ background: msgFoto.startsWith('Foto leída') ? '#1D9E7520' : '#2d1515', border: `1px solid ${msgFoto.startsWith('Foto leída') ? '#1D9E75' : '#aa3030'}`, borderRadius: 8, padding: '10px 16px', fontSize: 13, marginBottom: 16, color: msgFoto.startsWith('Foto leída') ? '#aaffdd' : '#ffaaaa' }}>
              {msgFoto}
            </div>
          )}

          {/* Incidencias leídas de la foto */}
          {ejecucion?.incidencias && (
            <div style={{ background: '#f5a62315', border: '1px solid #f5a623', borderRadius: 8, padding: '10px 16px', fontSize: 13, marginBottom: 16, color: '#ffd894' }}>
              <span style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: '#f5a623', marginRight: 8 }}>Incidencias</span>
              {ejecucion.incidencias}
            </div>
          )}

          {/* Progress bar */}
          {ejecucion && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#777777' }}>
                  Progreso
                </span>
                <span style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 600, color: progressColor(pct) }}>
                  {completadosCount}/{totalItems} — {pct}%
                </span>
              </div>
              <div style={{ background: '#2a2a2a', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: progressColor(pct),
                  borderRadius: 6,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              {todoCompleto && (
                <div style={{ marginTop: 14, background: '#1D9E7520', border: '1px solid #1D9E75', borderRadius: 8, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>✓</span>
                  <div>
                    <div style={{ fontFamily: FONT.heading, fontSize: 14, letterSpacing: '1px', textTransform: 'uppercase', color: '#1D9E75', fontWeight: 700 }}>
                      COMPLETADO
                    </div>
                    <div style={{ fontFamily: FONT.body, fontSize: 12, color: '#cccccc', marginTop: 2 }}>
                      Todos los items del checklist han sido verificados.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {items.map(item => (
              <div
                key={item.id}
                onClick={() => toggleItem(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: `1px solid ${item.completado ? '#1D9E7530' : '#2a2a2a'}`,
                  background: item.completado ? '#1D9E7515' : '#141414',
                  cursor: 'pointer',
                  transition: 'all 150ms',
                  userSelect: 'none',
                }}
              >
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: `2px solid ${item.completado ? '#1D9E75' : '#383838'}`,
                  background: item.completado ? '#1D9E75' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 150ms',
                }}>
                  {item.completado && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7L6 11L12 3" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                <span style={{
                  fontFamily: FONT.body,
                  fontSize: 14,
                  color: item.completado ? '#777777' : '#ffffff',
                  textDecoration: item.completado ? 'line-through' : 'none',
                  flex: 1,
                }}>
                  {item.item_nombre}
                </span>

                {item.completado_at && (
                  <span style={{ fontFamily: FONT.heading, fontSize: 12, color: '#1D9E75', letterSpacing: '0.5px', flexShrink: 0 }}>
                    {fmtHora(item.completado_at)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Add temp item */}
          {showAddTemp ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={nuevoItemTempNombre}
                onChange={e => setNuevoItemTempNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItemTemp()}
                placeholder="Nombre del item temporal..."
                autoFocus
                style={{
                  flex: 1, minWidth: 200, padding: '8px 12px', background: '#1e1e1e', border: '1px solid #383838',
                  borderRadius: 6, color: '#ffffff', fontFamily: FONT.body, fontSize: 13, outline: 'none',
                }}
              />
              <button onClick={addItemTemp} style={btnPrimario}>
                Añadir
              </button>
              <button onClick={() => { setShowAddTemp(false); setNuevoItemTempNombre('') }} style={{ padding: '8px 14px', background: '#222222', border: '1px solid #383838', color: '#cccccc', borderRadius: 6, fontFamily: FONT.body, fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setShowAddTemp(true)} style={btnPrimario}>
                + Añadir item temporal
              </button>
              <button onClick={toggleModoEdicion} style={btnSecundario}>
                Editar plantilla
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Modo edición plantilla ─────────────────────────────────────── */}
      {!loading && !error && activeTab !== 'historico' && modoEdicion && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ fontFamily: FONT.heading, fontSize: 15, letterSpacing: '2px', textTransform: 'uppercase', color: '#e8f442', margin: 0 }}>
              EDITANDO PLANTILLA — {TIPO_LABEL[activeTab as TipoChecklist].toUpperCase()}
            </h2>
            <button
              onClick={toggleModoEdicion}
              style={{ padding: '7px 16px', background: '#B01D23', color: '#ffffff', border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Guardar y cerrar
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {plantillas.length === 0 && (
              <div style={{ color: '#777777', fontSize: 13, padding: '12px 0', fontFamily: FONT.body }}>
                No hay items en la plantilla. Añade items con el botón de abajo.
              </div>
            )}
            {plantillas.map((p, idx) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8 }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 12, color: '#777777', minWidth: 24, textAlign: 'right' }}>
                  {idx + 1}
                </span>
                <span style={{ flex: 1, fontFamily: FONT.body, fontSize: 13, color: '#cccccc' }}>
                  {p.nombre}
                </span>
                <button
                  onClick={() => deleteItemPlantilla(p.id)}
                  style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #B01D23', color: '#B01D23', borderRadius: 4, fontFamily: FONT.body, fontSize: 11, cursor: 'pointer' }}
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>

          {showAddPlantilla ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={nuevoItemPlantillaNombre}
                onChange={e => setNuevoItemPlantillaNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItemPlantilla()}
                placeholder="Nombre del item de plantilla..."
                autoFocus
                style={{ flex: 1, minWidth: 200, padding: '8px 12px', background: '#1e1e1e', border: '1px solid #383838', borderRadius: 6, color: '#ffffff', fontFamily: FONT.body, fontSize: 13, outline: 'none' }}
              />
              <button onClick={addItemPlantilla} style={btnPrimario}>
                Añadir
              </button>
              <button onClick={() => { setShowAddPlantilla(false); setNuevoItemPlantillaNombre('') }} style={{ padding: '8px 14px', background: '#222222', border: '1px solid #383838', color: '#cccccc', borderRadius: 6, fontFamily: FONT.body, fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAddPlantilla(true)} style={btnPrimario}>
              + Añadir item
            </button>
          )}
        </div>
      )}
    </div>
  )
}
