/**
 * Checklists Operativos — estética Neobrutal Food-Pop (tokens de @/styles/neobrutal).
 *
 * - 6 checklists (apertura, cierres, limpiezas, recepción) con plantillas editables.
 * - Impresión bajo la LEY DE IMPRESIÓN (src/lib/impresion.ts + docs/LEY_IMPRESION.md).
 * - Lectura por foto: /api/checklists (visión) autorrellena lo cumplido.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  OSW, LEX, INK, CREMA, CLARO, SHADOW, BORDER_CARD,
  GRANATE, AMA, VERDE, ROJO, GRIS, eyebrow,
} from '@/styles/neobrutal'
import {
  nuevoDocA4, pintarMarco, pintarCabecera, pintarCamposId, pintarPie,
  abrirImprimir, descargar, P_INK, P_GREY, P_LINE, P_WRITE, P_RED_SOFT2, P_RED_DARK, MARGEN, BOX,
} from '@/lib/impresion'

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
  if (pct < 30) return ROJO
  if (pct < 70) return AMA
  return VERDE
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

// ─── PDF del checklist (LEY DE IMPRESIÓN) ─────────────────────────────────────

function construirChecklistPDF(tipo: TipoChecklist, nombres: string[]) {
  const doc = nuevoDocA4('portrait')
  const PW = doc.internal.pageSize.getWidth()
  const PH = doc.internal.pageSize.getHeight()
  const usableW = PW - MARGEN * 2

  let y = pintarCabecera(doc, `Checklist · ${TIPO_LABEL[tipo]}`, 'C/ Pico de la Maliciosa 6')
  y = pintarCamposId(doc, y, ['Fecha', 'Responsable', 'Hora'])

  // Subcabecera de la tabla
  doc.setFillColor(...P_RED_SOFT2); doc.rect(MARGEN, y, usableW, 6, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...P_RED_DARK)
  doc.text('OK', MARGEN + 9, y + 4)
  doc.text('PUNTO DE CONTROL', MARGEN + 22, y + 4)
  doc.text('OBSERVACIÓN', MARGEN + usableW * 0.66, y + 4)
  y += 8

  // Filas: altura adaptada para caber en una hoja dejando sitio al pie (40mm)
  const dispon = PH - MARGEN - 42 - y
  const rowH = Math.max(8, Math.min(12, dispon / Math.max(nombres.length, 1)))

  nombres.forEach((nombre, i) => {
    // número
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...P_GREY)
    doc.text(String(i + 1), MARGEN + 2, y + rowH / 2 + 1.2)
    // casilla
    doc.setDrawColor(...P_INK); doc.setLineWidth(0.5)
    doc.rect(MARGEN + 7, y + (rowH - BOX) / 2, BOX, BOX)
    // nombre
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...P_INK)
    doc.text(nombre, MARGEN + 22, y + rowH / 2 + 1.4)
    // línea de observación
    doc.setDrawColor(...P_WRITE); doc.setLineWidth(0.3)
    doc.line(MARGEN + usableW * 0.66, y + rowH - 2.2, MARGEN + usableW - 2, y + rowH - 2.2)
    // separador
    doc.setDrawColor(...P_LINE); doc.setLineWidth(0.15)
    doc.line(MARGEN, y + rowH, MARGEN + usableW, y + rowH)
    y += rowH
  })

  pintarPie(doc, 'Al terminar: foto de la hoja (plana, con luz) → ERP · Ops · Checklists. Se rellena solo.')
  pintarMarco(doc)
  return doc
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

  // ─── Carga ───────────────────────────────────────────────────────────────────

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

  // ─── Estilos neobrutal ───────────────────────────────────────────────────────

  const btnBase: React.CSSProperties = {
    fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase',
    border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '9px 16px', cursor: 'pointer', color: INK,
  }
  const btnPrimario: React.CSSProperties = { ...btnBase, background: AMA }
  const btnSecundario: React.CSSProperties = { ...btnBase, background: CLARO }
  const btnGranate: React.CSSProperties = { ...btnBase, background: GRANATE, color: '#ffffff' }
  const inputNeo: React.CSSProperties = {
    padding: '9px 12px', background: '#ffffff', border: `3px solid ${INK}`, color: INK,
    fontFamily: LEX, fontSize: 14, outline: 'none',
  }
  const card: React.CSSProperties = { background: '#ffffff', border: BORDER_CARD, boxShadow: SHADOW }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: LEX, padding: '28px', background: CREMA, minHeight: '100vh', color: INK }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <span style={eyebrow(AMA)}>OPERACIONES</span>
        <h1 style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 0.95, letterSpacing: '-0.5px', textTransform: 'uppercase', color: GRANATE, margin: '10px 0 6px' }}>
          CHECKLISTS OPERATIVOS
        </h1>
        <span style={{ fontFamily: LEX, fontSize: 13, color: GRIS }}>
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px',
              border: `3px solid ${INK}`,
              background: activeTab === tab.key ? GRANATE : '#ffffff',
              color: activeTab === tab.key ? '#ffffff' : INK,
              boxShadow: activeTab === tab.key ? SHADOW : 'none',
              fontFamily: OSW,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ ...card, background: ROJO, color: '#ffffff', padding: '12px 18px', fontFamily: LEX, fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ color: GRIS, fontFamily: OSW, textTransform: 'uppercase', letterSpacing: '1px', fontSize: 13, padding: '20px 0' }}>Cargando…</div>
      )}

      {/* ─── Histórico ─────────────────────────────────────────────── */}
      {!loading && !error && activeTab === 'historico' && (
        <div style={{ ...card, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
            <thead>
              <tr style={{ background: INK }}>
                {['Fecha', 'Tipo', 'Responsable', 'Puntos', '%', 'Origen', 'Estado', 'Foto'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, fontWeight: 600 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historico.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '20px 14px', color: GRIS, textAlign: 'center' }}>Sin registros aún</td>
                </tr>
              ) : historico.map(h => {
                const p = h.items_totales > 0 ? Math.round((h.items_completados / h.items_totales) * 100) : 0
                return (
                  <tr key={h.id} style={{ borderBottom: `2px solid ${INK}` }}>
                    <td style={{ padding: '10px 14px' }}>{fmtFechaCorta(h.fecha)}</td>
                    <td style={{ padding: '10px 14px', fontFamily: OSW, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase' }}>{TIPO_LABEL[h.tipo as TipoChecklist] ?? h.tipo}</td>
                    <td style={{ padding: '10px 14px' }}>{h.responsable || '—'}</td>
                    <td style={{ padding: '10px 14px', fontFamily: OSW, fontWeight: 700 }}>{h.items_completados}/{h.items_totales}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontFamily: OSW, fontWeight: 700, color: '#ffffff', background: progressColor(p), border: `2px solid ${INK}`, padding: '2px 8px' }}>{p}%</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: h.origen === 'foto' ? GRANATE : GRIS }}>
                      {h.origen === 'foto' ? '📷 Foto' : 'Manual'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        background: h.completado ? VERDE : ROJO,
                        color: '#ffffff',
                        border: `2px solid ${INK}`,
                        padding: '3px 10px',
                        fontSize: 11,
                        fontFamily: OSW,
                        fontWeight: 600,
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                      }}>
                        {h.completado ? 'Completado' : 'Pendiente'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {h.foto_url
                        ? <a href={h.foto_url} target="_blank" rel="noreferrer" style={{ color: GRANATE, fontFamily: OSW, fontWeight: 600, textTransform: 'uppercase', fontSize: 12 }}>Ver</a>
                        : <span style={{ color: GRIS }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Checklist del día ─────────────────────────────────────── */}
      {!loading && !error && activeTab !== 'historico' && !modoEdicion && (
        <div>
          {/* Acciones */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => imprimirDesde(activeTab as TipoChecklist, items.map(i => i.item_nombre), 'imprimir')}
              style={btnSecundario}
            >
              🖨 Imprimir
            </button>
            <button
              onClick={() => imprimirDesde(activeTab as TipoChecklist, items.map(i => i.item_nombre), 'descargar')}
              style={btnSecundario}
            >
              ⬇ PDF
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={subiendoFoto}
              style={{ ...btnPrimario, opacity: subiendoFoto ? 0.6 : 1 }}
            >
              {subiendoFoto ? 'Leyendo foto…' : '📷 Subir foto'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={e => onFotoSeleccionada(e.target.files?.[0] ?? null)}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <span style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS }}>Responsable</span>
              <input
                type="text"
                defaultValue={ejecucion?.responsable ?? ''}
                onBlur={e => guardarResponsable(e.target.value.trim())}
                placeholder="Nombre..."
                style={{ ...inputNeo, width: 150 }}
              />
            </div>
          </div>

          {/* Mensaje resultado foto */}
          {msgFoto && (
            <div style={{ ...card, background: msgFoto.startsWith('Foto leída') ? VERDE : ROJO, color: '#ffffff', padding: '10px 16px', fontSize: 13, marginBottom: 16, fontFamily: LEX }}>
              {msgFoto}
            </div>
          )}

          {/* Incidencias */}
          {ejecucion?.incidencias && (
            <div style={{ ...card, background: AMA, padding: '10px 16px', fontSize: 13, marginBottom: 16 }}>
              <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', marginRight: 10 }}>Incidencias</span>
              {ejecucion.incidencias}
            </div>
          )}

          {/* Progreso */}
          {ejecucion && (
            <div style={{ ...card, padding: '16px 18px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>
                  Progreso
                </span>
                <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 28, lineHeight: 1, color: progressColor(pct) }}>
                  {completadosCount}/{totalItems} <span style={{ fontSize: 18 }}>— {pct}%</span>
                </span>
              </div>
              <div style={{ background: CLARO, border: `2px solid ${INK}`, height: 16, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: progressColor(pct), borderRight: pct > 0 && pct < 100 ? `2px solid ${INK}` : 'none', transition: 'width 0.4s ease' }} />
              </div>
              {todoCompleto && (
                <div style={{ marginTop: 14, background: VERDE, border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 22, color: '#ffffff' }}>✓</span>
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 15, letterSpacing: '1px', textTransform: 'uppercase', color: '#ffffff' }}>
                    Checklist completado
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
            {items.map(item => (
              <div
                key={item.id}
                onClick={() => toggleItem(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 16px',
                  border: BORDER_CARD,
                  boxShadow: item.completado ? 'none' : SHADOW,
                  background: item.completado ? CLARO : '#ffffff',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <div style={{
                  width: 28,
                  height: 28,
                  border: `3px solid ${INK}`,
                  background: item.completado ? VERDE : '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {item.completado && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7L6 11L12 3" stroke="#ffffff" strokeWidth="3" strokeLinecap="square" />
                    </svg>
                  )}
                </div>

                <span style={{
                  fontFamily: LEX,
                  fontSize: 15,
                  color: item.completado ? GRIS : INK,
                  textDecoration: item.completado ? 'line-through' : 'none',
                  flex: 1,
                }}>
                  {item.item_nombre}
                </span>

                {item.completado_at && (
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 13, color: VERDE, flexShrink: 0 }}>
                    {fmtHora(item.completado_at)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Añadir item temporal */}
          {showAddTemp ? (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={nuevoItemTempNombre}
                onChange={e => setNuevoItemTempNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItemTemp()}
                placeholder="Nombre del item temporal..."
                autoFocus
                style={{ ...inputNeo, flex: 1, minWidth: 200 }}
              />
              <button onClick={addItemTemp} style={btnPrimario}>Añadir</button>
              <button onClick={() => { setShowAddTemp(false); setNuevoItemTempNombre('') }} style={btnSecundario}>Cancelar</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={() => setShowAddTemp(true)} style={btnPrimario}>+ Item temporal</button>
              <button onClick={toggleModoEdicion} style={btnSecundario}>Editar plantilla</button>
            </div>
          )}
        </div>
      )}

      {/* ─── Edición plantilla ─────────────────────────────────────── */}
      {!loading && !error && activeTab !== 'historico' && modoEdicion && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
            <span style={eyebrow(AMA)}>EDITANDO PLANTILLA — {TIPO_LABEL[activeTab as TipoChecklist].toUpperCase()}</span>
            <button onClick={toggleModoEdicion} style={btnGranate}>Guardar y cerrar</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            {plantillas.length === 0 && (
              <div style={{ color: GRIS, fontSize: 13, padding: '12px 0', fontFamily: LEX }}>
                No hay items en la plantilla. Añade items con el botón de abajo.
              </div>
            )}
            {plantillas.map((p, idx) => (
              <div key={p.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', boxShadow: 'none' }}>
                <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 13, color: GRIS, minWidth: 24, textAlign: 'right' }}>
                  {idx + 1}
                </span>
                <span style={{ flex: 1, fontFamily: LEX, fontSize: 14 }}>
                  {p.nombre}
                </span>
                <button
                  onClick={() => deleteItemPlantilla(p.id)}
                  style={{ padding: '4px 10px', background: '#ffffff', border: `2px solid ${ROJO}`, color: ROJO, fontFamily: OSW, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', cursor: 'pointer' }}
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>

          {showAddPlantilla ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={nuevoItemPlantillaNombre}
                onChange={e => setNuevoItemPlantillaNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItemPlantilla()}
                placeholder="Nombre del item de plantilla..."
                autoFocus
                style={{ ...inputNeo, flex: 1, minWidth: 200 }}
              />
              <button onClick={addItemPlantilla} style={btnPrimario}>Añadir</button>
              <button onClick={() => { setShowAddPlantilla(false); setNuevoItemPlantillaNombre('') }} style={btnSecundario}>Cancelar</button>
            </div>
          ) : (
            <button onClick={() => setShowAddPlantilla(true)} style={btnPrimario}>+ Añadir item</button>
          )}
        </div>
      )}
    </div>
  )
}

// Genera el PDF bajo la LEY DE IMPRESIÓN y lo imprime o descarga.
function imprimirDesde(tipo: TipoChecklist, nombres: string[], modo: 'imprimir' | 'descargar') {
  const doc = construirChecklistPDF(tipo, nombres)
  if (modo === 'imprimir') abrirImprimir(doc)
  else descargar(doc, `checklist-${TIPO_LABEL[tipo]}`)
}
