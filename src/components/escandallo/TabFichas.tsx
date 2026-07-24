import { useState, useEffect, useMemo } from 'react'
import React from 'react'
import { supabase } from '@/lib/supabase'
import { Printer, Pencil, AlertTriangle, Link2 } from 'lucide-react'
import ModalEditarFicha from './ModalEditarFicha'
import { fmtEur, fmtNum } from '@/lib/format'
import * as M from '@/lib/marcoDoc'
import BotonImprimir from '@/components/BotonImprimir'
import FichaTecnicaHoja, { ALERGENOS_FICHA, ALERGENOS_FICHA_PIE, type LineaIng } from '@/components/marco/FichaTecnicaHoja'
import { GRANATE, BLANCO, GRIS, INK, CREMA, OSW, LEX } from '@/styles/neobrutal'
import { estiloFiltro, estiloBoton, estiloItemLista, SelectCantera } from '@/components/kit/controles'
import {
  ESCANDALLO_OK_BG, ESCANDALLO_OK_TXT, ESCANDALLO_WARN_BORDE,
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
const TODOS_ALERGENOS = [...ALERGENOS_FICHA, ...ALERGENOS_FICHA_PIE]

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
  const pill = (active: boolean): React.CSSProperties => estiloFiltro(active)

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
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
        <button onClick={() => setGestionGamas(v => !v)} style={{ ...pill(false), borderStyle: 'dashed', color: gestionGamas ? GRANATE : GRIS }}>
          {gestionGamas ? 'Listo' : 'Gestionar gamas'}
        </button>
        {gestionGamas && <button onClick={crearGama} style={{ ...pill(false), borderStyle: 'dashed' }}>+ Nueva gama</button>}
      </div>

      <div className="flex gap-4" style={{ alignItems: 'flex-start' }}>
        <div className="no-print" style={{ width: 220, flexShrink: 0 }}>
          <span style={{ display: 'block', marginBottom: 8, fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: INK }}>{etiquetaLista}</span>
          <div style={{ display: 'flex', flexDirection: 'column', borderTop: `2px solid ${INK}` }}>
            {fichasFiltradas.map(f => {
              const alertas = f.ingredientes.filter(i => i.ingrediente && !i.match && !NO_COSTE(i)).length
              const activo = sel?.id === f.id
              return (
                <button key={f.id} onClick={() => setSel(f)} style={estiloItemLista(activo)}>
                  <span style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', color: activo ? CREMA : GRIS, flexShrink: 0 }}>{f.codigo}</span>
                  <span style={{ flex: 1, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase', fontFamily: LEX }}>{f.nombre}</span>
                  {alertas > 0 && <AlertTriangle size={13} color={activo ? CREMA : ESCANDALLO_WARN_ICON} />}
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

/** "gr" → "gr." · "lata" → "lata" (las palabras completas no llevan punto). */
function fmtUd(ud: string): string {
  const u = (ud ?? '').trim()
  if (!u) return ''
  return u.length <= 3 ? `${u}.` : u
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

  const cells: [string, string][] = [
    ['Tiempo de preparación', f.tiempo_prep ?? '—'],
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
    M.fDato(doc, ctx, true); doc.setFontSize(11)
    if (i === 3) doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2]); else doc.setTextColor(...M.TINTA)
    doc.text(c[1], x + cw / 2, y + 9.6, { align: 'center' })
  })
  y += metaH + 6

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
      const cant = `${fmtCant(ing.cant)} ${fmtUd(ing.ud)}`.trim()
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

  y = secLabelPDF(doc, ctx, pal, cb.x0, cb.x1, 'Preparación', y)
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

  async function generarPdfFicha(bnFlag: boolean) {
    const rec = await M.cargarRecursos()
    return construirFichaPDF(f, ingredientes, alergAuto, costeTanda, costeRac, rec, bnFlag)
  }
  async function descargarPdf() {
    const rec = await M.cargarRecursos()
    M.descargar(construirFichaPDF(f, ingredientes, alergAuto, costeTanda, costeRac, rec, false), `${f.codigo ?? f.tipo}-${f.nombre}`)
  }

  // Datos reales del escandallo → líneas de la hoja imprimible
  const lineasHoja: LineaIng[] = ingredientes.map(i => ({
    ingrediente: i.match?.nombre ?? i.ingrediente,
    cantidad: fmtCant(i.cant),
    unidad: fmtUd(i.ud),
    equivalencia: i.equivalencia || '',
  }))

  return (
    <div className="flex-1 min-w-0">

      {editando && (
        <ModalEditarFicha
          ficha={f}
          gamasAll={gamasAll}
          onClose={() => setEditando(false)}
          onSaved={() => { setEditando(false); onSaved() }}
        />
      )}

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: INK }}>Gama</span>
        <SelectCantera value={f.gama ?? ''} onChange={cambiarGama}>
          <option value="">— Sin gama —</option>
          {gamasAll.map(g => <option key={g} value={g}>{g}</option>)}
        </SelectCantera>
        <button onClick={() => editAlerg ? guardarAlerg() : setEditAlerg(true)} style={estiloBoton({ padding: '7px 12px', fontSize: 12 })}>
          <Pencil size={13} /> {editAlerg ? 'Guardar alérgenos' : 'Editar alérgenos'}
        </button>
      </div>

      {editAlerg && (
        <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {TODOS_ALERGENOS.map(a => {
            const on = alergManual.some(x => x.toLowerCase() === a.toLowerCase())
            return (
              <button key={a} onClick={() => setAlergManual(prev => on ? prev.filter(x => x.toLowerCase() !== a.toLowerCase()) : [...prev, a])}
                style={estiloFiltro(on, { fontSize: 11, padding: '5px 10px' })}>
                {a}
              </button>
            )
          })}
        </div>
      )}

      {sinEnlazar.length > 0 && (
        <div className="no-print" style={{ background: BLANCO, border: `3px solid ${INK}`, borderTop: `7px solid ${ESCANDALLO_WARN_BORDE}`, borderRadius: 0, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={18} color={ESCANDALLO_WARN_BTN} />
          <div style={{ flex: 1, fontSize: 13, color: ESCANDALLO_WARN_TXT }}>
            <strong>{sinEnlazar.length} sin enlazar al escandallo:</strong> {sinEnlazar.map(i => i.ingrediente).join(', ')}.
          </div>
          <button onClick={() => setEditando(true)} style={estiloBoton({ background: ESCANDALLO_WARN_BTN, color: BLANCO, padding: '7px 12px', fontSize: 12 })}>
            <Link2 size={13} /> Resolver
          </button>
        </div>
      )}

      <FichaTecnicaHoja
        area="cocina"
        tipoDoc={f.tipo === 'receta' ? 'Receta' : 'Elaboración previa'}
        nombre={f.nombre}
        gama={f.gama}
        codigo={f.codigo}
        revision={f.edicion}
        tiempoPrep={f.tiempo_prep}
        rendimiento={f.raciones ? `${fmtNum(f.raciones, 0)} rac.` : null}
        costeTanda={fmtEur(costeTanda, { decimals: 2 })}
        costeRacion={fmtEur(costeRac, { decimals: 2 })}
        ingredientes={lineasHoja}
        pasos={f.pasos ?? []}
        conservacion={f.conservacion ?? []}
        alergenos={alergAuto}
      />

      <div className="no-print" style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <BotonImprimir compacto documentoId={f.tipo === 'receta' ? 'cocina.ficha_receta' : 'cocina.ficha_ep'} titulo={`Ficha técnica · ${f.codigo ? f.codigo + ' · ' : ''}${f.nombre}`} generarPdf={opts => generarPdfFicha(opts.bn)} />
        <button onClick={descargarPdf} style={estiloBoton()}><Printer size={15} /> PDF</button>
        <button onClick={() => setEditando(true)} style={estiloBoton()}><Pencil size={15} /> Editar</button>
        <span style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS }}>
          Enlazados al escandallo: {ingredientes.length - sinEnlazar.length}/{ingredientes.length}
          {' · '}
          <span style={{ color: ESCANDALLO_OK_TXT, background: ESCANDALLO_OK_BG, padding: '1px 6px' }}>coste real</span>
        </span>
      </div>
    </div>
  )
}
