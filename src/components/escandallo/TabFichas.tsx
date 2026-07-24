import { useState, useEffect, useMemo } from 'react'
import React from 'react'
import { supabase } from '@/lib/supabase'
import { Printer, Pencil, AlertTriangle, Link2, Box } from 'lucide-react'
import ModalEditarFicha from './ModalEditarFicha'
import { fmtEur, fmtNum } from '@/lib/format'
import * as M from '@/lib/marcoDoc'
import BotonImprimir from '@/components/BotonImprimir'
import HojaDoc from '@/components/marco/HojaDoc'
import { GRANATE, BLANCO, GRIS, INK } from '@/styles/neobrutal'
import {
  PRINT_BN_BG, PRINT_BN_TXT,
  ESCANDALLO_OK_BG, ESCANDALLO_OK_TXT, ESCANDALLO_WARN_BG, ESCANDALLO_WARN_BORDE,
  ESCANDALLO_WARN_ICON, ESCANDALLO_WARN_BTN, ESCANDALLO_WARN_TXT,
} from '@/styles/palettes'

interface Match { iding: string; nombre: string; precio: number; prov: string }
interface IngLinea { cant: string; ud: string; ingrediente: string; equivalencia: string; grupo?: number; match: Match | null }
interface Conserva { metodo: string; tiempo: string }
interface Ficha {
  id: string; tipo: string; codigo: string | null; nombre: string
  raciones: number | null; tiempo_prep: string | null; edicion: number; fecha: string
  ingredientes: IngLinea[]; pasos: string[]; conservacion: Conserva[]; alergenos: string[]
  foto_url: string | null; estado: string; gama: string | null
}

const NO_COSTE = (i: IngLinea) => i.ud === 'cup' || i.ud === 'cups' || /\bagua\b/.test(i.ingrediente.toLowerCase())
const METODOS_CONSERVA = ['Tapper', 'Biberón', 'Vacío', 'Congelación']
const ALERGENOS_14 = ['Gluten', 'Lácteos', 'Huevo', 'Pescado', 'Crustáceos', 'Moluscos', 'Frutos secos', 'Cacahuetes', 'Soja', 'Apio', 'Mostaza', 'Sésamo', 'Sulfitos', 'Altramuces']

function resaltarIngredientes(texto: string, ingredientes: IngLinea[]): React.ReactNode[] {
  const terminos = new Set<string>()
  ingredientes.forEach(i => {
    const n = (i.ingrediente || '').trim().toLowerCase()
    if (!n) return
    terminos.add(n)
    const prim = n.split(/\s+/)[0]
    if (prim.length >= 3) terminos.add(prim)
  })
  if (terminos.size === 0) return [texto]
  const lista = [...terminos].sort((a, b) => b.length - a.length)
  const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\b(${lista.map(escapar).join('|')})\\b`, 'gi')
  const partes: React.ReactNode[] = []
  let last = 0, m: RegExpExecArray | null, k = 0
  while ((m = re.exec(texto)) !== null) {
    if (m.index > last) partes.push(texto.slice(last, m.index))
    partes.push(<strong key={k++}>{m[0]}</strong>)
    last = m.index + m[0].length
  }
  if (last < texto.length) partes.push(texto.slice(last))
  return partes.length ? partes : [texto]
}

export default function TabFichas({ busqueda, tipo }: { busqueda: string; tipo?: 'ep' | 'receta' }) {
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<Ficha | null>(null)
  const [gamaSel, setGamaSel] = useState<string>('')
  const [alergMap, setAlergMap] = useState<Record<string, string[]>>({})
  const [gestionGamas, setGestionGamas] = useState(false)
  const [costesReales, setCostesReales] = useState<Record<string, { tanda: number; rac: number }>>({})
  const [lineasReales, setLineasReales] = useState<Record<string, { ingrediente: string; cant: string; ud: string }[]>>({})

  useEffect(() => { cargar(); setGamaSel('') }, [tipo])
  useEffect(() => { cargarAlergenos() }, [])

  async function cargarAlergenos() {
    const { data } = await supabase.from('ingredientes').select('nombre_base, nombre, alergenos')
    const map: Record<string, string[]> = {}
    ;(data ?? []).forEach((r: any) => {
      const al = Array.isArray(r.alergenos) ? r.alergenos : []
      if (al.length === 0) return
      const claves = [r.nombre_base, r.nombre].filter(Boolean).map((s: string) => s.replace(/_[A-Z]+$/, '').trim().toLowerCase())
      claves.forEach(k => { if (k) map[k] = al })
    })
    setAlergMap(map)
  }

  async function cargar() {
    setLoading(true)
    let q = supabase.from('fichas_tecnicas').select('*').eq('estado', 'vigente')
    if (tipo) q = q.eq('tipo', tipo)
    const { data } = await q.order('codigo')
    const list = (data as Ficha[]) ?? []
    setFichas(list)
    const mapaCostes: Record<string, { tanda: number; rac: number }> = {}
    const [epsRes, recRes] = await Promise.all([
      supabase.from('eps').select('codigo, coste_tanda, coste_rac'),
      supabase.from('recetas').select('codigo, coste_tanda, coste_rac'),
    ])
    ;[...(epsRes.data ?? []), ...(recRes.data ?? [])].forEach((r: any) => {
      if (r.codigo) mapaCostes[r.codigo] = { tanda: Number(r.coste_tanda) || 0, rac: Number(r.coste_rac) || 0 }
    })
    setCostesReales(mapaCostes)
    const mapaLineas: Record<string, { ingrediente: string; cant: string; ud: string }[]> = {}
    const [epsLinRes, recLinRes, epsCodRes, recCodRes] = await Promise.all([
      supabase.from('eps_lineas').select('eps_id, ingrediente_nombre, cantidad, unidad'),
      supabase.from('recetas_lineas').select('receta_id, ingrediente_nombre, cantidad, unidad'),
      supabase.from('eps').select('id, codigo'),
      supabase.from('recetas').select('id, codigo'),
    ])
    const epsCod: Record<string, string> = {}
    ;(epsCodRes.data ?? []).forEach((e: any) => { if (e.codigo) epsCod[e.id] = e.codigo })
    const recCod: Record<string, string> = {}
    ;(recCodRes.data ?? []).forEach((r: any) => { if (r.codigo) recCod[r.id] = r.codigo })
    const pushLinea = (cod: string | undefined, l: any) => {
      if (!cod) return
      const nombre = (l.ingrediente_nombre ?? '').replace(/_[A-Z]+$/, '').trim()
      ;(mapaLineas[cod] = mapaLineas[cod] || []).push({ ingrediente: nombre, cant: l.cantidad != null ? String(l.cantidad) : '', ud: l.unidad ?? '' })
    }
    ;(epsLinRes.data ?? []).forEach((l: any) => pushLinea(epsCod[l.eps_id], l))
    ;(recLinRes.data ?? []).forEach((l: any) => pushLinea(recCod[l.receta_id], l))
    setLineasReales(mapaLineas)
    setSel(prev => prev ? (list.find(f => f.id === prev.id) ?? list[0] ?? null) : (list[0] ?? null))
    setLoading(false)
  }

  const gamas = useMemo(() => {
    const set = new Set<string>()
    fichas.forEach(f => { if (f.gama) set.add(f.gama) })
    return [...set].sort()
  }, [fichas])

  const [gamaExtra, setGamaExtra] = useState<string[]>([])
  const gamasAll = useMemo(() => {
    const s = new Set<string>([...gamas, ...gamaExtra])
    return [...s].sort()
  }, [gamas, gamaExtra])

  async function crearGama() {
    const nombre = window.prompt('Nombre de la nueva gama:')?.trim()
    if (!nombre) return
    setGamaSel(nombre)
    setGamaExtra(prev => prev.includes(nombre) ? prev : [...prev, nombre])
  }
  async function renombrarGama(g: string) {
    const nuevo = window.prompt(`Renombrar gama "${g}" a:`, g)?.trim()
    if (!nuevo || nuevo === g) return
    await supabase.from('fichas_tecnicas').update({ gama: nuevo }).eq('gama', g).eq('tipo', tipo!)
    setGamaExtra(prev => prev.map(x => x === g ? nuevo : x))
    if (gamaSel === g) setGamaSel(nuevo)
    cargar()
  }
  async function eliminarGama(g: string) {
    if (!confirm(`Eliminar la gama "${g}"? Las fichas quedarán sin gama (no se borran).`)) return
    await supabase.from('fichas_tecnicas').update({ gama: null }).eq('gama', g).eq('tipo', tipo!)
    setGamaExtra(prev => prev.filter(x => x !== g))
    if (gamaSel === g) setGamaSel('')
    cargar()
  }

  const fichasFiltradas = useMemo(() => fichas.filter(f =>
    (!gamaSel || f.gama === gamaSel) &&
    (!busqueda || f.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (f.codigo ?? '').toLowerCase().includes(busqueda.toLowerCase()))
  ), [fichas, gamaSel, busqueda])

  useEffect(() => {
    if (!fichasFiltradas.length) return
    setSel(prev => (prev && fichasFiltradas.some(f => f.id === prev.id)) ? prev : fichasFiltradas[0])
  }, [fichasFiltradas])

  if (loading) return <div className="py-10 text-center text-[var(--sl-text-muted)] text-sm">Cargando fichas…</div>

  const etiquetaLista = tipo === 'receta' ? 'Recetas' : tipo === 'ep' ? 'EPS' : 'Fichas EPS / Receta'

  const pill = (active: boolean): React.CSSProperties => ({
    padding: '4px 11px', borderRadius: 0, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
    border: active ? 'none' : '1px solid var(--sl-border)',
    background: active ? GRANATE : 'transparent',
    color: active ? BLANCO : 'var(--sl-text-secondary)',
  })

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <button onClick={() => setGamaSel('')} style={pill(gamaSel === '')}>Todas</button>
        {gamasAll.map(g => (
          <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <button onClick={() => setGamaSel(g)} style={pill(gamaSel === g)}>{g}</button>
            {gestionGamas && (
              <>
                <button onClick={() => renombrarGama(g)} title="Renombrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRIS, fontSize: 12, padding: 2 }}><Pencil size={12} /></button>
                <button onClick={() => eliminarGama(g)} title="Eliminar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRANATE, fontSize: 13, padding: 2 }}>×</button>
              </>
            )}
          </span>
        ))}
        <button onClick={() => setGestionGamas(v => !v)} style={{ ...pill(false), borderStyle: 'dashed', color: gestionGamas ? GRANATE : 'var(--sl-text-muted)' }}>
          {gestionGamas ? 'Listo' : 'Gestionar gamas'}
        </button>
        {gestionGamas && <button onClick={crearGama} style={{ ...pill(false), borderStyle: 'dashed' }}>+ Nueva gama</button>}
      </div>

      <div className="flex gap-4" style={{ alignItems: 'flex-start' }}>
        <div className="no-print" style={{ width: 220, flexShrink: 0 }}>
          <span className="text-xs uppercase tracking-wider text-[var(--sl-text-muted)] block mb-2" style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '0.1em' }}>{etiquetaLista}</span>
          <div className="flex flex-col gap-1">
            {fichasFiltradas.map(f => {
              const alertas = f.ingredientes.filter(i => i.ingrediente && !i.match && !NO_COSTE(i)).length
              return (
                <button key={f.id} onClick={() => setSel(f)}
                  className={'text-left px-3 py-2 rounded-lg transition flex items-center gap-2 ' +
                    (sel?.id === f.id ? 'bg-[var(--sl-thead)]' : 'hover:bg-[var(--sl-card)]')}
                  style={{ color: 'var(--sl-text-primary)' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: GRIS, flexShrink: 0 }}>{f.codigo}</span>
                  <span style={{ flex: 1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase', fontFamily: 'Lexend, sans-serif' }}>{f.nombre}</span>
                  {alertas > 0 && <AlertTriangle size={13} color={ESCANDALLO_WARN_ICON} />}
                </button>
              )
            })}
          </div>
        </div>
        {sel ? <FichaDetalle ficha={sel} alergMap={alergMap} gamasAll={gamasAll} onSaved={cargar} costeReal={sel.codigo ? costesReales[sel.codigo] : undefined} lineasEP={sel.codigo ? lineasReales[sel.codigo] : undefined} /> : <div className="text-[var(--sl-text-muted)] text-sm py-10">Sin fichas.</div>}
      </div>
    </div>
  )
}

function fmtCant(c: string): string {
  const s = (c ?? '').trim()
  if (!s || !/^[\d.,]+$/.test(s)) return s
  const n = Number(s.replace(/\./g, '').replace(',', '.'))
  if (!isFinite(n)) return s
  return n.toLocaleString('es-ES', { maximumFractionDigits: 3 })
}

function costeLinea(i: IngLinea): number {
  if (!i.match) return 0
  const c = parseFloat((i.cant || '').replace(',', '.'))
  if (isNaN(c)) return 0
  const factor = (i.ud === 'gr' || i.ud === 'g' || i.ud === 'ml') ? c / 1000 : c
  return factor * i.match.precio
}

/* ═══ FICHA TÉCNICA — PDF con MARCO ÚNICO (src/lib/marcoDoc.ts) ═══ */

const AREA_F: M.Area = 'cocina'

function secLabelPDF(doc: any, ctx: M.Ctx, pal: M.Paleta, x0: number, x1: number, txt: string, y: number): number {
  M.fTitulo(doc, ctx, true); doc.setFontSize(10); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
  doc.text(txt.toUpperCase(), x0, y + 3)
  doc.setDrawColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.setLineWidth(0.4); doc.line(x0, y + 4.6, x1, y + 4.6)
  return y + 8.5
}

function construirFichaPDF(f: Ficha, ingredientes: IngLinea[], alergenos: string[], costeTanda: number, costeRac: number, rec: M.Recursos, bn = false) {
  const doc = M.nuevaHoja({ orientation: 'portrait' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA_F, bn)
  const cb = M.contentBox(doc)

  M.pintarEspina(doc, AREA_F, ctx, bn)
  let y = M.pintarCabecera(doc, ctx, {
    docNombre: f.codigo ?? (f.tipo === 'receta' ? 'REC' : 'EP'),
    tituloCentrado: (f.nombre ?? '').replace(/\.\s*$/, ''),
    area: AREA_F, bn,
  })

  const ensure = (h: number) => {
    if (y + h > cb.bottom) { doc.addPage(); M.pintarEspina(doc, AREA_F, ctx, bn); y = cb.top + 2 }
  }

  // Meta: Prep · Rendimiento · Coste tanda · €/Ración
  const cells: [string, string][] = [
    ['Prep.', f.tiempo_prep ?? '—'],
    ['Rendimiento', f.raciones ? `${fmtNum(f.raciones)} rac.` : '—'],
    ['Coste tanda', fmtEur(costeTanda, { decimals: 2 })],
    ['€ / Ración', fmtEur(costeRac, { decimals: 2 })],
  ]
  const metaH = 12, cw = cb.w / 4
  M.tablaWrap(doc, cb.x0, y, cb.w, metaH)
  cells.forEach((c, i) => {
    const x = cb.x0 + i * cw
    if (i > 0) { doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.2); doc.line(x, y + 1.5, x, y + metaH - 1.5) }
    M.fTitulo(doc, ctx, true); doc.setFontSize(7); doc.setTextColor(...M.GRIS)
    doc.text(c[0].toUpperCase(), x + cw / 2, y + 4.6, { align: 'center' })
    M.fDato(doc, ctx, true); doc.setFontSize(11); doc.setTextColor(...M.TINTA)
    doc.text(c[1], x + cw / 2, y + 9.6, { align: 'center' })
  })
  y += metaH + 6

  // Ingredientes (tabla, 2 columnas si son muchos)
  y = secLabelPDF(doc, ctx, pal, cb.x0, cb.x1, 'Ingredientes', y)
  const rowH = 5
  const nCol = ingredientes.length >= 16 ? 2 : 1
  const gap = 8
  const colW = (cb.w - gap * (nCol - 1)) / nCol
  const per = Math.ceil(ingredientes.length / nCol) || 1
  let maxY = y
  for (let c = 0; c < nCol; c++) {
    const x = cb.x0 + c * (colW + gap)
    let yy = y
    ingredientes.slice(c * per, (c + 1) * per).forEach(ing => {
      const nom = ing.match?.nombre ?? ing.ingrediente
      const cant = `${fmtCant(ing.cant)}${ing.ud ? ` ${ing.ud}.` : ''}`
      M.fDato(doc, ctx, true); doc.setFontSize(9.5); doc.setTextColor(...M.GRIS)
      const cantW = doc.getTextWidth(cant)
      M.fDato(doc, ctx, false); doc.setTextColor(...M.TINTA)
      M.fitFont(doc, nom, colW - cantW - 4, 9.5, 7)
      doc.text(nom, x, yy + 3.4)
      M.fDato(doc, ctx, true); doc.setFontSize(9.5); doc.setTextColor(...M.GRIS)
      doc.text(cant, x + colW, yy + 3.4, { align: 'right' })
      doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.1); doc.line(x, yy + rowH - 0.6, x + colW, yy + rowH - 0.6)
      yy += rowH
    })
    if (yy > maxY) maxY = yy
  }
  y = maxY + 6

  // Elaboración: pasos numerados con badge de acento (radio único)
  y = secLabelPDF(doc, ctx, pal, cb.x0, cb.x1, 'Elaboración', y)
  const badge = 5.2
  const pasos = f.pasos ?? []
  if (!pasos.length) {
    M.fDato(doc, ctx, false); doc.setFontSize(10); doc.setTextColor(...M.GRIS); doc.text('—', cb.x0, y + 3); y += 6
  }
  pasos.forEach((paso, idx) => {
    M.fDato(doc, ctx, false); doc.setFontSize(10)
    const tx = cb.x0 + badge + 3
    const lines = doc.splitTextToSize(paso, cb.x1 - tx) as string[]
    const blockH = Math.max(badge, lines.length * 4.5) + 2.6
    ensure(blockH)
    doc.setFillColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.roundedRect(cb.x0, y, badge, badge, M.R, M.R, 'F')
    M.fTitulo(doc, ctx, true); doc.setFontSize(9); doc.setTextColor(255, 255, 255)
    doc.text(String(idx + 1), cb.x0 + badge / 2, y + badge / 2 + 1.3, { align: 'center' })
    M.fDato(doc, ctx, false); doc.setFontSize(10); doc.setTextColor(...M.TINTA)
    doc.text(lines, tx, y + 3.4)
    y += blockH
  })
  y += 4

  // Alérgenos: pills (mismo radio)
  ensure(14)
  y = secLabelPDF(doc, ctx, pal, cb.x0, cb.x1, 'Alérgenos', y)
  if (!alergenos.length) {
    M.fDato(doc, ctx, false); doc.setFontSize(10); doc.setTextColor(...M.GRIS); doc.text('Ninguno', cb.x0, y + 3)
  } else {
    let px = cb.x0, py = y
    alergenos.forEach(a => {
      M.fDato(doc, ctx, true); doc.setFontSize(8)
      const w = doc.getTextWidth(a) + 4.8
      if (px + w > cb.x1) { px = cb.x0; py += 6.5 }
      M.pill(doc, px, py, a, AREA_F, ctx, { bn })
      px += w + 2
    })
  }

  const tp = doc.getNumberOfPages()
  for (let p = 1; p <= tp; p++) { doc.setPage(p); M.pintarPaginado(doc, p, tp, ctx) }
  return doc
}

function FichaDetalle({ ficha: f, alergMap, gamasAll, onSaved, costeReal, lineasEP }: { ficha: Ficha; alergMap: Record<string, string[]>; gamasAll: string[]; onSaved: () => void; costeReal?: { tanda: number; rac: number }; lineasEP?: { ingrediente: string; cant: string; ud: string }[] }) {
  const tienePropios = (f.ingredientes ?? []).some(i => i.ingrediente && i.cant)
  const ingredientes: IngLinea[] = tienePropios
    ? f.ingredientes
    : (lineasEP ?? []).map(l => ({ cant: l.cant, ud: l.ud, ingrediente: l.ingrediente, equivalencia: '', match: { iding: '', nombre: l.ingrediente, precio: 0, prov: 'EP' } }))
  const costeTandaCalc = ingredientes.reduce((s, i) => s + costeLinea(i), 0)
  const costeTanda = costeReal && costeReal.tanda > 0 ? costeReal.tanda : costeTandaCalc
  const costeRac = costeReal && costeReal.rac > 0 ? costeReal.rac : (f.raciones ? costeTanda / f.raciones : 0)
  const sinEnlazar = ingredientes.filter(i => i.ingrediente && !i.match && !NO_COSTE(i))
  const esReceta = f.tipo === 'receta'
  const [editando, setEditando] = useState(false)

  const alergAuto = useMemo(() => {
    const set = new Set<string>()
    ingredientes.forEach(i => {
      const k = (i.ingrediente || '').replace(/_[A-Z]+$/, '').trim().toLowerCase()
      const al = alergMap[k]
      if (al) al.forEach(a => set.add(a))
    })
    ;(f.alergenos ?? []).forEach(a => set.add(a))
    return [...set]
  }, [f, alergMap])

  const [editAlerg, setEditAlerg] = useState(false)
  const [alergManual, setAlergManual] = useState<string[]>(alergAuto)
  useEffect(() => { setAlergManual(alergAuto) }, [f.id])

  async function guardarAlerg() {
    await supabase.from('fichas_tecnicas').update({ alergenos: alergManual }).eq('id', f.id)
    setEditAlerg(false)
    onSaved()
  }

  async function cambiarGama(g: string) {
    await supabase.from('fichas_tecnicas').update({ gama: g || null }).eq('id', f.id)
    onSaved()
  }

  const grupos = useMemo(() => {
    const g: Record<number, IngLinea[]> = {}
    ingredientes.forEach(i => { const k = i.grupo ?? 1; (g[k] = g[k] || []).push(i) })
    return Object.entries(g).sort((a, b) => Number(a[0]) - Number(b[0]))
  }, [f])
  const hayGrupos = grupos.length > 1
  const totalIng = ingredientes.length
  const colsIng = totalIng >= 28 ? 3 : totalIng >= 14 ? 2 : 1

  function tiempoMetodo(metodo: string): { texto: string; especial?: string } {
    const raiz: Record<string, string[]> = {
      'Biberón': ['biber'], 'Tapper': ['tapper', 'taper', 'tupper'],
      'Vacío': ['vacio', 'vacío', 'vac'], 'Congelación': ['congel'],
    }
    const claves = raiz[metodo] ?? [metodo.toLowerCase().slice(0, 4)]
    const found = (f.conservacion ?? []).find(c => claves.some(k => c.metodo.toLowerCase().includes(k)))
    if (found) return { texto: found.tiempo, especial: found.metodo.toLowerCase() !== metodo.toLowerCase() ? found.metodo : undefined }
    return { texto: 'NO' }
  }

  const [bn, setBn] = useState(false)
  async function generarPdfFicha(bnFlag: boolean) {
    const rec = await M.cargarRecursos()
    return construirFichaPDF(f, ingredientes, alergAuto, costeTanda, costeRac, rec, bnFlag)
  }
  async function descargarPdf() {
    const rec = await M.cargarRecursos()
    M.descargar(construirFichaPDF(f, ingredientes, alergAuto, costeTanda, costeRac, rec, bn), `${f.codigo ?? f.tipo}-${f.nombre}`)
  }

  const theadIng = (
    <thead>
      <tr>
        <th style={{ padding: 0 }}></th>
        <th style={{ padding: 0, width: 64 }}></th>
        <th style={{ padding: 0, width: 78 }}></th>
        <th className="no-print" style={{ width: 86 }} />
      </tr>
    </thead>
  )

  const filaIng = (i: IngLinea, idx: number) => (
    <tr key={idx} className="ficha-tr">
      <td style={{ padding: '1px 0' }}>
        <span className="solo-pantalla">{i.match?.nombre ?? i.ingrediente}</span>
        <span className="solo-print-ing" style={{ display: 'none' }}>{i.ingrediente}</span>
      </td>
      <td style={{ textAlign: 'right', fontWeight: 500, width: 64, whiteSpace: 'nowrap', padding: '1px 0' }}>{fmtCant(i.cant)}{i.ud ? ` ${i.ud}.` : ''}</td>
      <td className="ficha-equiv" style={{ textAlign: 'right', width: 78, whiteSpace: 'nowrap', padding: '1px 0' }}>{i.equivalencia || '—'}</td>
      <td className="no-print" style={{ textAlign: 'right', width: 86, paddingLeft: 6 }}>
        {i.match
          ? <span style={{ background: ESCANDALLO_OK_BG, color: ESCANDALLO_OK_TXT, fontSize: 10, padding: '2px 7px', borderRadius: 0 }}>✓ {i.match.prov}</span>
          : NO_COSTE(i)
            ? <span style={{ color: GRIS, fontSize: 11 }}>no coste</span>
            : <span style={{ background: ESCANDALLO_WARN_BG, color: ESCANDALLO_WARN_TXT, fontSize: 10, padding: '2px 7px', borderRadius: 0 }}>⚠ sin enlazar</span>}
      </td>
    </tr>
  )

  return (
    <div className="flex-1 min-w-0">
      <style>{FICHA_CSS}</style>

      {editando && (
        <ModalEditarFicha
          ficha={f}
          gamasAll={gamasAll}
          onClose={() => setEditando(false)}
          onSaved={() => { setEditando(false); onSaved() }}
        />
      )}

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--sl-text-muted)', fontFamily: 'Lexend, sans-serif' }}>Gama:</span>
        <select value={f.gama ?? ''} onChange={e => cambiarGama(e.target.value)} className="ds-input" style={{ width: 'auto' }}>
          <option value="">— Sin gama —</option>
          {gamasAll.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {sinEnlazar.length > 0 && (
        <div className="no-print" style={{ background: ESCANDALLO_WARN_BG, border: `1px solid ${ESCANDALLO_WARN_BORDE}`, borderRadius: 0, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={18} color={ESCANDALLO_WARN_BTN} />
          <div style={{ flex: 1, fontSize: 13, color: ESCANDALLO_WARN_TXT }}>
            <strong>{sinEnlazar.length} sin enlazar al escandallo:</strong> {sinEnlazar.map(i => i.ingrediente).join(', ')}.
          </div>
          <button onClick={() => setEditando(true)} style={{ background: ESCANDALLO_WARN_BTN, color: BLANCO, border: 'none', borderRadius: 0, padding: '5px 10px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Link2 size={13} /> Resolver
          </button>
        </div>
      )}

      <div className="print-ficha">
      <HojaDoc area="cocina" docNombre={f.codigo ?? ''} tituloCentrado={(f.nombre ?? '').replace(/\.\s*$/, '')}>

        <div className="ficha-meta">
          <div className="cell"><div className="lbl">Prep.</div><div className="val">{f.tiempo_prep ?? '—'}</div></div>
          <div className="cell"><div className="lbl">Rendimiento</div><div className="val">{f.raciones ? `${fmtNum(f.raciones, 0)} rac.` : '—'}</div></div>
          <div className="cell"><div className="lbl">Coste tanda</div><div className="val val-calc">{fmtEur(costeTanda, { decimals: 2 })}</div></div>
          <div className="cell"><div className="lbl">€ / Ración</div><div className="val val-calc">{fmtEur(costeRac, { decimals: 2 })}</div></div>
        </div>

        <div className="ficha-section" style={{ display: 'flex' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ficha-seclabel" style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
              <span style={{ flex: 1 }}>Ingredientes</span>
              <span style={{ width: 64, textAlign: 'right', fontSize: 9, letterSpacing: '0.08em' }}>Cantidad</span>
              <span style={{ width: 78, textAlign: 'right', fontSize: 9, letterSpacing: '0.08em' }}>Equivalencia</span>
              <span className="no-print" style={{ width: 86 }} />
            </div>
            {colsIng === 1 ? (
              grupos.map(([gk, items]) => (
                <div key={gk} style={{ marginBottom: 8 }}>
                  {hayGrupos && <div className="ficha-grupo">Grupo {gk}</div>}
                  <table className="ficha-table ficha-table-ing">{theadIng}<tbody>{items.map(filaIng)}</tbody></table>
                </div>
              ))
            ) : (
              <div style={{ columnCount: colsIng, columnGap: 22 }}>
                {grupos.map(([gk, items]) => (
                  <div key={gk} style={{ breakInside: 'avoid', marginBottom: 8 }}>
                    {hayGrupos && <div className="ficha-grupo">Grupo {gk}</div>}
                    <table className="ficha-table ficha-table-ing">{theadIng}<tbody>{items.map(filaIng)}</tbody></table>
                  </div>
                ))}
              </div>
            )}
          </div>

          {esReceta && (
            <div className="no-print ficha-foto">
              {f.foto_url
                ? <img src={f.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <><Box size={28} /><span style={{ fontSize: 10, marginTop: 4 }}>Foto</span></>}
            </div>
          )}
        </div>

        <div className="ficha-section sec-prep">
          <div className="ficha-seclabel">Preparación</div>
          <ol className="ficha-steps">
            {f.pasos.length ? f.pasos.map((p, idx) => <li key={idx}>{resaltarIngredientes(p, ingredientes)}</li>) : <li style={{ listStyle: 'none', marginLeft: -22, color: 'var(--text-muted)' }}>—</li>}
          </ol>
        </div>

        <div className="ficha-section" style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: 1.3 }}>
            <div className="ficha-seclabel"><Box size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Conservación</div>
            <table className="ficha-table">
              <tbody>
                {METODOS_CONSERVA.map(metodo => {
                  const t = tiempoMetodo(metodo)
                  const esNo = t.texto === 'NO'
                  return (
                    <tr key={metodo} className="ficha-tr">
                      <td style={{ padding: '4px 0' }}>{t.especial ? <strong>{t.especial}</strong> : metodo}</td>
                      <td style={{ textAlign: 'right', fontWeight: esNo ? 700 : 500 }} className={esNo ? 'ficha-equiv' : ''}>{t.texto}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ position: 'relative' }}>
              <div className="ficha-seclabel"><AlertTriangle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Alérgenos</div>
              <button className="no-print" onClick={() => editAlerg ? guardarAlerg() : setEditAlerg(true)} style={{ position: 'absolute', top: -2, right: 0, background: 'none', border: 'none', color: 'var(--m-acento)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                <Pencil size={11} /> {editAlerg ? 'Guardar' : 'Editar'}
              </button>
            </div>
            {editAlerg ? (
              <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {ALERGENOS_14.map(a => {
                  const on = alergManual.includes(a)
                  return (
                    <button key={a} onClick={() => setAlergManual(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])}
                      style={{ padding: '4px 9px', borderRadius: 0, fontSize: 11, cursor: 'pointer', border: on ? 'none' : '1px solid var(--sl-border)', background: on ? 'var(--m-acento)' : 'transparent', color: on ? BLANCO : 'var(--sl-text-secondary)' }}>
                      {a}
                    </button>
                  )
                })}
              </div>
            ) : (
              alergAuto.length === 0
                ? <div className="ficha-alerg-val">Ninguno</div>
                : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingTop: 2 }}>
                    {alergAuto.map(a => (
                      <span key={a} style={{ padding: '3px 9px', borderRadius: 0, fontSize: 11, fontFamily: "'Oswald', sans-serif", background: 'var(--m-soft)', color: 'var(--m-acento)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{a}</span>
                    ))}
                  </div>
            )}
          </div>
        </div>

      </HojaDoc>
      </div>

      <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setBn(v => !v)} style={{ ...btn, background: bn ? PRINT_BN_BG : 'transparent', color: bn ? PRINT_BN_TXT : 'var(--sl-text-secondary)' }} title="Imprimir en blanco y negro">{bn ? 'B/N' : 'Color'}</button>
        <BotonImprimir compacto documentoId={f.tipo === 'receta' ? 'cocina.ficha_receta' : 'cocina.ficha_ep'} titulo={`Ficha técnica · ${f.codigo ? f.codigo + ' · ' : ''}${f.nombre}`} generarPdf={opts => generarPdfFicha(opts.bn)} />
        <button onClick={descargarPdf} style={btn}><Printer size={15} /> PDF</button>
        <button onClick={() => setEditando(true)} style={btn}><Pencil size={15} /> Editar</button>
      </div>
    </div>
  )
}

const btn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--sl-text-secondary)', border: '0.5px solid var(--sl-border)', borderRadius: 0, padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.04em' }

const FICHA_CSS = `
/* ── Ficha EPS/Receta — misma superficie clara que el modal Ingredientes (--bg-card) ── */
.ficha-card {
  font-family: 'Lexend', sans-serif;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-primary);
  overflow: hidden;
  display: flex; flex-direction: column;
  min-height: 78vh;
}
.sec-prep { flex: 1 1 auto; min-height: 120px; }
.ficha-head {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--sl-border-strong);
}
.ficha-id {
  background: var(--accent-yellow); color: var(--sl-btn-add-alt-text);
  font-family: 'Lexend', sans-serif; font-weight: 600; font-size: 12px;
  padding: 3px 12px; border-radius: 20px; white-space: nowrap; flex-shrink: 0;
}
.ficha-title {
  font-family: 'Oswald', sans-serif; font-weight: 500; font-size: 21px;
  letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-primary);
  line-height: 1.15;
}
.ficha-meta { display: flex; border-bottom: 1px solid var(--border); }
.ficha-meta .cell { flex: 1; padding: 10px 14px; text-align: center; border-right: 1px solid var(--border); }
.ficha-meta .cell:last-child { border-right: none; }
.ficha-meta .lbl { font-family: 'Oswald', sans-serif; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); }
.ficha-meta .val { font-family: 'Lexend', sans-serif; font-size: 16px; font-weight: 600; color: var(--text-primary); }
.ficha-meta .val-calc { display: inline-block; background: var(--bg-input-calc); border: 1px solid var(--border-calc); color: var(--text-input-calc); border-radius: 6px; padding: 2px 10px; font-size: 14px; margin-top: 2px; }
.ficha-section { padding: 14px 20px; border-bottom: 1px solid var(--border); }
.ficha-section:last-child { border-bottom: none; }
.ficha-seclabel {
  font-family: 'Oswald', sans-serif; font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.14em; color: var(--text-label-sec);
  padding-bottom: 5px; border-bottom: 1px solid var(--sl-border-strong); margin-bottom: 10px;
}
.ficha-grupo { font-family: 'Oswald', sans-serif; font-size: 11px; color: var(--text-muted); border-bottom: 1px solid var(--sl-border-strong); padding-bottom: 2px; margin-bottom: 4px; letter-spacing: 0.06em; text-transform: uppercase; }
.ficha-table { width: 100%; border-collapse: collapse; font-family: 'Lexend', sans-serif; font-size: 13px; }
.ficha-table td { padding: 3px 0; color: var(--text-primary); vertical-align: top; }
.ficha-equiv { color: var(--text-muted); }
.ficha-steps { margin: 0; padding-left: 22px; font-family: 'Lexend', sans-serif; font-size: 13px; line-height: 1.55; list-style-type: decimal; list-style-position: outside; color: var(--text-primary); }
.ficha-steps li { margin-bottom: 4px; display: list-item; }
.ficha-alerg-val { font-family: 'Lexend', sans-serif; font-size: 13px; line-height: 1.5; color: var(--text-primary); }
.ficha-foto { width: 130px; flex-shrink: 0; margin-left: 16px; border: 1px solid var(--border); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-direction: column; color: var(--text-muted); overflow: hidden; }

.ficha-table-ing { font-size: 15px; }
.ficha-table-ing td { padding: 1px 0 !important; line-height: 1.12; }

/* ── IMPRESIÓN: papel blanco, márgenes reales, ficha ocupa la hoja ── */
@media print {
  @page { size: A4 portrait; margin: 16mm; }
  html, body { background: #fff !important; }
  body * { visibility: hidden; }
  .print-ficha, .print-ficha * { visibility: visible; }
  .no-print { display: none !important; }
  .solo-pantalla { display: none !important; }
  .solo-print-ing { display: inline !important; }
  .print-ficha {
    position: absolute; left: 0; top: 0; width: 100%;
    min-height: 245mm; box-sizing: border-box; padding: 6mm;
    display: flex; flex-direction: column;
    background: #fff !important; color: ${INK} !important;
    border: 1px solid ${INK} !important; border-radius: 6px !important;
  }
  .print-ficha .sec-prep { flex: 1 1 auto; min-height: 60mm; }
  .print-ficha .ficha-head { border-bottom: 2px solid ${INK} !important; padding: 4mm 6mm; }
  .print-ficha .ficha-id { background: ${INK} !important; color: #fff !important; font-size: 21px !important; padding: 2px 14px !important; }
  .print-ficha .ficha-table-ing { font-size: 16px !important; }
  .print-ficha .ficha-table-ing td { padding: 0.4mm 0 !important; line-height: 1.1 !important; }
  .print-ficha .ficha-title { color: ${INK} !important; }
  .print-ficha .ficha-meta { border-color: ${GRIS} !important; }
  .print-ficha .ficha-meta .cell { border-color: ${GRIS} !important; }
  .print-ficha .ficha-meta .lbl { color: ${GRIS} !important; }
  .print-ficha .ficha-meta .val { color: ${INK} !important; }
  .print-ficha .ficha-meta .val-calc { background: #fff !important; border-color: ${INK} !important; color: ${INK} !important; }
  .print-ficha .ficha-section { border-color: ${GRIS} !important; padding: 4mm 6mm; }
  .print-ficha .ficha-seclabel { color: ${GRIS} !important; border-color: ${INK} !important; }
  .print-ficha .ficha-grupo { color: ${GRIS} !important; border-color: ${INK} !important; }
  .print-ficha .ficha-table td { color: ${INK} !important; }
  .print-ficha .ficha-table th { color: ${GRIS} !important; }
  .print-ficha .ficha-equiv { color: ${GRIS} !important; }
  .print-ficha .ficha-steps, .print-ficha .ficha-alerg-val { color: ${INK} !important; }
  .print-ficha ol { list-style-type: decimal !important; padding-left: 22px !important; }
  .print-ficha ol li { display: list-item !important; }
}
`
