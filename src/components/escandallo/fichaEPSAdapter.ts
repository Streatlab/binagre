/* ============================================================================
   fichaEPSAdapter.ts · Streat Lab · ERP Binagre
   ----------------------------------------------------------------------------
   Traduce los datos REALES del escandallo (fichas_tecnicas + eps_lineas /
   recetas_lineas + costes de eps/recetas) al contrato del documento aprobado
   `FichaEPSPrint`. Aquí NO hay decisiones de diseño: solo formato de datos.

   Lo que hace:
     · Limpia el nombre del ingrediente (quita el sufijo de proveedor _MER/_ALC/_EPS…
       y la aclaración entre paréntesis, que en el papel no va: la columna
       Equivalencia se rellena a mano).
     · Formatea cantidades a español y normaliza la unidad ("gr" → "gr.").
     · Pone en <b> los ingredientes citados dentro de cada paso.
     · Reparte la conservación en los 4 métodos del documento.
   ========================================================================== */
import type { FichaEPSData, FichaEPSIngrediente } from './FichaEPSPrint'

export interface LineaOrigen { ingrediente: string; cantidad: string | number | null; unidad: string | null }
export interface ConservaOrigen { metodo: string; tiempo: string }

export interface FichaOrigen {
  tipo: string                 // 'ep' | 'receta'
  codigo: string | null
  nombre: string
  gama: string | null
  edicion: number | null
  tiempo_prep: string | null
  raciones: number | null
  pasos: string[] | null
  conservacion: ConservaOrigen[] | null
  alergenos: string[] | null
}

/** Quita el sufijo de proveedor y la aclaración entre paréntesis. */
export function limpiarIngrediente(n: string): string {
  let s = (n ?? '').replace(/_[A-Z]{2,4}\b/g, '').trim()
  s = s.replace(/\s*\([^)]*\)\s*$/, '').trim()
  return s
}

/** "gr" → "gr." · "lata" → "lata" (las palabras completas no llevan punto). */
export function normalizarUnidad(u: string | null): string {
  const s = (u ?? '').trim().replace(/\.$/, '')
  if (!s) return ''
  return s.length <= 3 ? `${s}.` : s.toLowerCase()
}

function numES(v: string | number | null): string {
  if (v == null) return ''
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.'))
  if (!isFinite(n)) return String(v)
  return n.toLocaleString('es-ES', { maximumFractionDigits: 3 })
}

export function eurES(n: number): string {
  return `${(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

function escaparHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Marca en <b> los ingredientes citados dentro del texto de un paso. */
export function resaltarPaso(texto: string, ingredientes: FichaEPSIngrediente[]): string {
  const terminos = new Set<string>()
  ingredientes.forEach(i => {
    const n = (i.nombre || '').trim().toLowerCase()
    if (!n) return
    terminos.add(n)
    const prim = n.split(/\s+/)[0]
    if (prim.length >= 3) terminos.add(prim)
  })
  const html = escaparHtml(texto)
  if (!terminos.size) return html
  const lista = [...terminos].sort((a, b) => b.length - a.length)
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\b(${lista.map(esc).join('|')})\\b`, 'gi')
  return html.replace(re, m => `<b>${m}</b>`)
}

const RAIZ: Record<string, string[]> = {
  taper: ['tapper', 'taper', 'tupper', 'táper'],
  biberon: ['biber'],
  vacio: ['vacio', 'vacío', 'vac'],
  congelacion: ['congel'],
}
function tiempoDe(cons: ConservaOrigen[] | null, clave: keyof typeof RAIZ): string {
  const hit = (cons ?? []).find(c => RAIZ[clave].some(k => (c.metodo ?? '').toLowerCase().includes(k)))
  return hit?.tiempo ?? ''
}

/** Claves de alérgeno que entiende el documento, a partir del texto guardado. */
const ALERG_KEYS: Record<string, string> = {
  gluten: 'Gluten', lacteos: 'Lácteos', lácteos: 'Lácteos', leche: 'Lácteos',
  huevo: 'Huevos', huevos: 'Huevos', soja: 'Soja',
  'frutos secos': 'Frutos secos', frutos_secos: 'Frutos secos',
  crustaceos: 'Crustáceos', crustáceos: 'Crustáceos',
  pescado: 'Pescado', moluscos: 'Moluscos', cacahuetes: 'Cacahuetes',
  apio: 'Apio', mostaza: 'Mostaza', sesamo: 'Sésamo', sésamo: 'Sésamo',
  sulfitos: 'Sulfitos', altramuces: 'Altramuces',
}

/** Construye el objeto que consume el documento imprimible. */
export function toFichaEPS(
  f: FichaOrigen,
  lineas: LineaOrigen[],
  costes: { tanda: number; racion: number },
): FichaEPSData {
  const ingredientes: FichaEPSIngrediente[] = (lineas ?? [])
    .map(l => ({
      nombre: limpiarIngrediente(l.ingrediente),
      cantidad: numES(l.cantidad),
      unidad: normalizarUnidad(l.unidad),
    }))
    .filter(i => i.nombre)

  const pasos = (f.pasos ?? []).map(p => resaltarPaso(p, ingredientes))

  const alergenosPresentes = (f.alergenos ?? [])
    .map(a => ALERG_KEYS[(a ?? '').trim().toLowerCase()])
    .filter(Boolean)

  return {
    tipo: f.tipo === 'receta' ? 'REC' : 'EPS',
    codigo: f.codigo ?? '',
    nombre: (f.nombre ?? '').replace(/\.\s*$/, ''),
    categoria: f.gama ?? '',
    revision: String(f.edicion ?? 1).padStart(2, '0'),
    tiempoPreparacion: f.tiempo_prep ?? '',
    rendimiento: f.raciones ? `${f.raciones.toLocaleString('es-ES')} rac.` : '',
    costeTanda: eurES(costes.tanda),
    costeRacion: eurES(costes.racion),
    ingredientes,
    pasos,
    conservacion: {
      taper: tiempoDe(f.conservacion, 'taper'),
      biberon: tiempoDe(f.conservacion, 'biberon'),
      vacio: tiempoDe(f.conservacion, 'vacio'),
      congelacion: tiempoDe(f.conservacion, 'congelacion'),
    },
    alergenosPresentes,
  }
}
