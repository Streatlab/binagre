import { AMA_S, AZUL, AZUL_CL, BLANCO, GRANATE, GRIS, INK, NAR, VERDE } from '@/styles/neobrutal'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { Plus, X, Trash2, Save, FolderOpen, ChevronLeft, ChevronRight, Printer, Eraser, GripVertical } from 'lucide-react'
import { HeroCantera, Papel, PantallaCantera, FrasePotente } from '@/components/kit/cantera'
import type { jsPDF } from 'jspdf'
import * as M from '@/lib/marcoDoc'
import BotonImprimir from '@/components/BotonImprimir'

const OSWALD = "'Oswald', sans-serif"
const LEXEND = "'Lexend', sans-serif"
const SHADOW = `4px 4px 0 ${INK}`
const SHADOW_SM = `3px 3px 0 ${INK}`
const RED = GRANATE

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DIA_CORTO = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']
const DIA_COLOR = [AZUL, VERDE, NAR, GRANATE, AZUL_CL, NAR, VERDE]

interface Plato { id: string; nombre: string; categoria: string | null; activo: boolean; receta_id: string | null }
interface RecetaLite { id: string; nombre: string; coste_rac: number | null }
interface Asign { id: string; semana_inicio: string; dia: number; plato_id: string | null; plato_nombre: string; orden: number }
interface Plantilla { id: string; nombre: string; dias: Record<string, { nombre: string }[]> }

type Drag = { tipo: 'cat' | 'mov'; nombre: string; id?: string; platoId?: string }

/* ── fecha helpers ── */
function lunesDe(d: Date): Date {
  const x = new Date(d)
  const dow = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - dow)
  x.setHours(0, 0, 0, 0)
  return x
}
function iso(d: Date): string { return d.toISOString().slice(0, 10) }
function addDias(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function fmtCorto(d: Date): string { return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) }
function fmtNum(d: Date): string { return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) }

/* ═══ PDF — MARCO ÚNICO (src/lib/marcoDoc.ts) — VERTICAL ═══ */

const AREA_MF: M.Area = 'cocina'

function crearPDF(
  semana: Date,
  asignsPorDia: Record<number, Asign[]>,
  costeDePlatoId: (platoId: string | null) => number | null,
  rec: M.Recursos,
  bn = false,
): jsPDF | null {
  const totalPlatos = Object.values(asignsPorDia).reduce((s, arr) => s + arr.length, 0)
  if (totalPlatos === 0) return null

  const doc = M.nuevaHoja({ orientation: 'portrait' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA_MF, bn)
  const cb = M.contentBox(doc)
  const meta = `Semana ${fmtCorto(semana)} – ${fmtCorto(addDias(semana, 6))}`

  const nuevaPagina = () => {
    M.pintarEspina(doc, AREA_MF, ctx, bn)
    return M.pintarCabecera(doc, ctx, { docNombre: 'Menú Familia', meta, tituloCentrado: 'MENÚ FAMILIA', area: AREA_MF, bn })
  }
  let y = nuevaPagina()
  const rowH = 5.2

  for (let dia = 1; dia <= 7; dia++) {
    const items = asignsPorDia[dia] || []
    const fecha = fmtNum(addDias(semana, dia - 1))
    const bodyH = items.length ? items.length * rowH : rowH
    const blockH = 8 + bodyH + 3

    if (y + blockH > cb.bottom) { doc.addPage(); y = nuevaPagina() }

    M.tarjeta(doc, cb.x0, y, cb.w, blockH, AREA_MF, { bn })
    M.fTitulo(doc, ctx, true); doc.setFontSize(10.5); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
    doc.text(DIAS[dia - 1].toUpperCase(), cb.x0 + 3.5, y + 5.8)
    M.fDato(doc, ctx, false); doc.setFontSize(8.5); doc.setTextColor(...M.GRIS)
    doc.text(fecha, cb.x1 - 3.5, y + 5.8, { align: 'right' })

    doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.2)
    doc.line(cb.x0 + 3, y + 7.6, cb.x1 - 3, y + 7.6)

    let yy = y + 7.6 + 3.9
    if (!items.length) {
      M.fDato(doc, ctx, false); doc.setFontSize(8.5); doc.setTextColor(...M.GRIS)
      doc.text('Sin platos asignados', cb.x0 + 3.5, yy)
    } else {
      items.forEach(a => {
        const coste = costeDePlatoId(a.plato_id)
        M.fDato(doc, ctx, false); doc.setFontSize(9.5); doc.setTextColor(...M.TINTA)
        doc.text(a.plato_nombre, cb.x0 + 3.5, yy, { maxWidth: cb.w - 40 })
        if (coste != null) {
          doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
          doc.text(`${fmtEur(coste)}/rac.`, cb.x1 - 3.5, yy, { align: 'right' })
        }
        yy += rowH
      })
    }
    y += blockH + 4
  }

  const totalPag = doc.getNumberOfPages()
  for (let p = 1; p <= totalPag; p++) { doc.setPage(p); M.pintarPaginado(doc, p, totalPag, ctx) }
  return doc
}

export default function MenuFamilia() {
  const [semana, setSemana] = useState<Date>(() => lunesDe(new Date()))
  const [platos, setPlatos] = useState<Plato[]>([])
  const [asigns, setAsigns] = useState<Asign[]>([])
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [recetas, setRecetas] = useState<RecetaLite[]>([])
  const [nuevoPlato, setNuevoPlato] = useState('')
  const [inputDia, setInputDia] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const dragRef = useRef<Drag | null>(null)
  const [overDia, setOverDia] = useState<number | null>(null)

  const semIso = iso(semana)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [p, a, t, r] = await Promise.all([
      supabase.from('menu_familia_platos').select('*').eq('activo', true).order('nombre'),
      supabase.from('menu_familia_semana').select('*').eq('semana_inicio', semIso).order('orden'),
      supabase.from('menu_familia_plantillas').select('*').order('nombre'),
      supabase.from('recetas').select('id, nombre, coste_rac'),
    ])
    setPlatos((p.data as Plato[]) || [])
    setAsigns((a.data as Asign[]) || [])
    setPlantillas((t.data as unknown as Plantilla[]) || [])
    setRecetas((r.data as RecetaLite[]) || [])
    setLoading(false)
  }, [semIso])

  useEffect(() => { cargar() }, [cargar])

  // Tanda F6: coste del Escandallo por plato (receta_id -> recetas.coste_rac).
  const recetaPorId = useMemo(() => new Map(recetas.map(r => [r.id, r])), [recetas])
  const platoPorId = useMemo(() => new Map(platos.map(p => [p.id, p])), [platos])
  function costeDePlato(p: Plato | undefined): number | null {
    if (!p?.receta_id) return null
    return recetaPorId.get(p.receta_id)?.coste_rac ?? null
  }
  function buscarRecetaPorNombre(nombre: string): string | null {
    const norm = nombre.trim().toLowerCase()
    return recetas.find(r => r.nombre.trim().toLowerCase() === norm)?.id ?? null
  }

  const asignsPorDia = useMemo(() => {
    const m: Record<number, Asign[]> = {}
    for (let d = 1; d <= 7; d++) m[d] = []
    asigns.forEach(a => { (m[a.dia] = m[a.dia] || []).push(a) })
    return m
  }, [asigns])

  /* ── catálogo ── */
  async function crearPlato() {
    const n = nuevoPlato.trim()
    if (!n) return
    await supabase.from('menu_familia_platos').insert({ nombre: n, receta_id: buscarRecetaPorNombre(n) })
    setNuevoPlato('')
    cargar()
  }
  async function borrarPlato(id: string) {
    await supabase.from('menu_familia_platos').update({ activo: false }).eq('id', id)
    cargar()
  }

  /* ── planning ── */
  async function addAsign(dia: number, nombre: string, platoId?: string) {
    const n = nombre.trim()
    if (!n) return
    const orden = (asignsPorDia[dia]?.length || 0)
    await supabase.from('menu_familia_semana').insert({
      semana_inicio: semIso, dia, plato_id: platoId || null, plato_nombre: n, orden,
    })
    setInputDia(s => ({ ...s, [dia]: '' }))
    cargar()
  }
  async function moverAsign(id: string, dia: number) {
    const orden = (asignsPorDia[dia]?.length || 0)
    await supabase.from('menu_familia_semana').update({ dia, orden }).eq('id', id)
    cargar()
  }
  async function quitarAsign(id: string) {
    await supabase.from('menu_familia_semana').delete().eq('id', id)
    cargar()
  }
  async function limpiarSemana() {
    if (!confirm('¿Vaciar el menú de toda la semana?')) return
    await supabase.from('menu_familia_semana').delete().eq('semana_inicio', semIso)
    cargar()
  }

  /* ── drag & drop ── */
  function onDropDia(dia: number) {
    const data = dragRef.current
    dragRef.current = null
    setOverDia(null)
    if (!data) return
    if (data.tipo === 'cat') addAsign(dia, data.nombre, data.platoId)
    else if (data.tipo === 'mov' && data.id) moverAsign(data.id, dia)
  }

  /* ── plantillas ── */
  async function guardarPlantilla() {
    const nombre = prompt('Nombre de la plantilla:')
    if (!nombre?.trim()) return
    const dias: Record<string, { nombre: string }[]> = {}
    for (let d = 1; d <= 7; d++) dias[String(d)] = (asignsPorDia[d] || []).map(a => ({ nombre: a.plato_nombre }))
    await supabase.from('menu_familia_plantillas').insert({ nombre: nombre.trim(), dias })
    cargar()
  }
  async function aplicarPlantilla(t: Plantilla) {
    if (!confirm(`Aplicar "${t.nombre}" a esta semana? Reemplaza el menú actual.`)) return
    await supabase.from('menu_familia_semana').delete().eq('semana_inicio', semIso)
    const rows: { semana_inicio: string; dia: number; plato_nombre: string; orden: number }[] = []
    for (let d = 1; d <= 7; d++) {
      const items = t.dias?.[String(d)] || []
      items.forEach((it, i) => rows.push({ semana_inicio: semIso, dia: d, plato_nombre: it.nombre, orden: i }))
    }
    if (rows.length) await supabase.from('menu_familia_semana').insert(rows)
    cargar()
  }
  async function borrarPlantilla(id: string) {
    if (!confirm('¿Borrar plantilla?')) return
    await supabase.from('menu_familia_plantillas').delete().eq('id', id)
    cargar()
  }

  /* ── estilos brutalistas ── */
  const btn = (bg: string, color = BLANCO): React.CSSProperties => ({
    background: bg, color, border: `3px solid ${INK}`, borderRadius: 0, boxShadow: SHADOW_SM,
    padding: '7px 13px', cursor: 'pointer', fontFamily: OSWALD, fontWeight: 600, fontSize: 12,
    letterSpacing: '0.5px', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 6,
  })
  const navBtn: React.CSSProperties = {
    width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: BLANCO, color: INK, border: `3px solid ${INK}`, borderRadius: 0, boxShadow: SHADOW_SM, cursor: 'pointer',
  }
  const inp: React.CSSProperties = {
    background: BLANCO, border: `2px solid ${INK}`, borderRadius: 0,
    padding: '5px 8px', color: INK, fontFamily: LEXEND, fontSize: 12, width: '100%',
  }
  const h3: React.CSSProperties = { fontFamily: OSWALD, fontWeight: 600, fontSize: 13, marginBottom: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: INK }
  const chip: React.CSSProperties = {
    display: 'flex', alignItems: 'flex-start', gap: 5, background: BLANCO, border: `2px solid ${INK}`,
    borderRadius: 0, padding: '4px 6px', cursor: 'grab',
  }

  const sinEscandallo = platos.filter(p => costeDePlato(p) == null).length

  return (
    <PantallaCantera embedded style={{ fontFamily: LEXEND, color: INK }}>
      <style>{`
        @media print {
          aside { display: none !important; }
          .mf-no-print { display: none !important; }
          .mf-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; }
          .mf-grid, .mf-cell, .mf-head { box-shadow: none !important; }
          .mf-cell { break-inside: avoid; }
          @page { size: A4 landscape; margin: 12mm; }
          body { background: ${BLANCO} !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* HÉROE (naranja · área Cocina) */}
      <HeroCantera
        area="cocina"
        titular={`Menú familia listo para la semana del ${fmtCorto(semana)}.`}
        resumen="Comidas del personal · planificación semanal. Arrastra platos del catálogo a cada día."
        atencion={[
          platos.length > 0 ? `${platos.length} platos en catálogo` : null,
          sinEscandallo > 0 ? `${sinEscandallo} sin escandallo` : null,
          plantillas.length > 0 ? `${plantillas.length} plantillas guardadas` : null,
        ].filter(Boolean) as string[]}
      />

      {/* barra superior */}
      <div className="mf-no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setSemana(s => addDias(s, -7))} style={navBtn}><ChevronLeft size={16} /></button>
        <button onClick={() => setSemana(lunesDe(new Date()))} style={{ ...navBtn, width: 'auto', padding: '0 12px', fontFamily: OSWALD, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase' }}>Hoy</button>
        <button onClick={() => setSemana(s => addDias(s, 7))} style={navBtn}><ChevronRight size={16} /></button>
        <div style={{ flex: 1 }} />
        <button style={btn(VERDE)} onClick={guardarPlantilla}><Save size={15} />Plantilla</button>
        <button style={btn(RED)} onClick={limpiarSemana}><Eraser size={15} />Vaciar</button>
        <button style={btn(INK)} onClick={() => window.print()}><Printer size={15} />Imprimir</button>
        <BotonImprimir
          compacto
          documentoId="cocina.menu_familia"
          titulo={`Menú Familia · ${fmtCorto(semana)}–${fmtCorto(addDias(semana, 6))}`}
          generarPdf={async opts => {
            const rec = await M.cargarRecursos()
            return crearPDF(semana, asignsPorDia, id => (id ? costeDePlato(platoPorId.get(id)) : null), rec, opts.bn)
          }}
        />
      </div>

      <div className="mf-print-area">
        <div style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 18, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
          Semana {fmtCorto(semana)} – {fmtCorto(addDias(semana, 6))}
        </div>

        {/* cuadrícula lunes → domingo */}
        <div style={{ overflowX: 'auto' }}>
          <div className="mf-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(124px, 1fr))', gap: 10, minWidth: 920 }}>
            {/* cabeceras */}
            {DIAS.map((_, i) => (
              <div key={`h-${i}`} className="mf-head" style={{ background: DIA_COLOR[i], color: BLANCO, border: `3px solid ${INK}`, borderRadius: 0, boxShadow: SHADOW_SM, padding: '7px 4px', textAlign: 'center' }}>
                <div style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 15, letterSpacing: '1px' }}>{DIA_CORTO[i]}</div>
                <div style={{ fontSize: 11, fontWeight: 600, fontFamily: LEXEND }}>{fmtNum(addDias(semana, i))}</div>
              </div>
            ))}

            {/* celdas */}
            {DIAS.map((_, i) => {
              const dia = i + 1
              const items = asignsPorDia[dia] || []
              const over = overDia === dia
              return (
                <div
                  key={`c-${i}`}
                  className="mf-cell"
                  onDragOver={e => { e.preventDefault(); setOverDia(dia) }}
                  onDragLeave={() => setOverDia(o => (o === dia ? null : o))}
                  onDrop={() => onDropDia(dia)}
                  style={{ background: over ? AMA_S : BLANCO, border: `3px solid ${INK}`, borderRadius: 0, boxShadow: SHADOW, padding: 7, minHeight: 160, display: 'flex', flexDirection: 'column', gap: 5, outline: over ? `3px dashed ${DIA_COLOR[i]}` : 'none', outlineOffset: -6 }}
                >
                  {items.length === 0 && <span className="mf-no-print" style={{ fontSize: 11, color: GRIS, fontStyle: 'italic' }}>arrastra un plato aquí</span>}
                  {items.map(a => {
                    const coste = a.plato_id ? costeDePlato(platoPorId.get(a.plato_id)) : null
                    return (
                      <div
                        key={a.id}
                        draggable
                        onDragStart={() => { dragRef.current = { tipo: 'mov', id: a.id, nombre: a.plato_nombre } }}
                        style={chip}
                      >
                        <GripVertical className="mf-no-print" size={13} style={{ color: GRIS, flexShrink: 0, marginTop: 1 }} />
                        <span style={{ flex: 1, fontSize: 13, lineHeight: 1.25, fontFamily: LEXEND }}>
                          {a.plato_nombre}
                          {coste != null && <span style={{ display: 'block', fontSize: 10, color: VERDE, fontFamily: OSWALD, fontWeight: 600 }}>{fmtEur(coste)}/rac.</span>}
                        </span>
                        <X className="mf-no-print" size={13} style={{ cursor: 'pointer', color: GRIS, flexShrink: 0, marginTop: 1 }} onClick={() => quitarAsign(a.id)} />
                      </div>
                    )
                  })}
                  <div className="mf-no-print" style={{ display: 'flex', gap: 3, marginTop: 'auto' }}>
                    <input
                      list="catalogo-platos"
                      style={inp}
                      placeholder="+ plato"
                      value={inputDia[dia] || ''}
                      onChange={e => setInputDia(s => ({ ...s, [dia]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') { const m = platos.find(p => p.nombre === (inputDia[dia] || '')); addAsign(dia, inputDia[dia] || '', m?.id) } }}
                    />
                    <button style={{ ...btn(RED), padding: '4px 7px', boxShadow: 'none' }} onClick={() => { const m = platos.find(p => p.nombre === (inputDia[dia] || '')); addAsign(dia, inputDia[dia] || '', m?.id) }}><Plus size={13} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {sinEscandallo > 0 ? (
        <FrasePotente significado="coste">{sinEscandallo} platos del catálogo van sin escandallo: no sabes lo que cuesta darle de comer al equipo ese día.</FrasePotente>
      ) : platos.length > 0 ? (
        <FrasePotente significado="logro">Todo el catálogo tiene escandallo: sabes exactamente lo que cuesta cada comida del personal.</FrasePotente>
      ) : null}

      {/* catálogo + plantillas */}
      <div className="mf-no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <Papel ceja={NAR} style={{ flex: '1 1 320px', minWidth: 280, boxShadow: 'none' }}>
          <h3 style={h3}>Catálogo de platos · arrastra a un día</h3>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            <input style={inp} placeholder="Nuevo plato…" value={nuevoPlato}
              onChange={e => setNuevoPlato(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') crearPlato() }} />
            <button style={{ ...btn(RED), padding: '6px 10px', boxShadow: 'none' }} onClick={crearPlato}><Plus size={15} /></button>
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {platos.map(p => {
              const coste = costeDePlato(p)
              return (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => { dragRef.current = { tipo: 'cat', nombre: p.nombre, platoId: p.id } }}
                  style={chip}
                >
                  <GripVertical size={14} style={{ color: GRIS, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13 }}>{p.nombre}</span>
                  {coste != null ? (
                    <span style={{ fontSize: 11, color: VERDE, fontFamily: OSWALD, fontWeight: 600 }}>{fmtEur(coste)}/rac.</span>
                  ) : (
                    <span style={{ fontSize: 10, color: NAR, fontFamily: OSWALD, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sin escandallo</span>
                  )}
                  <Trash2 size={14} style={{ cursor: 'pointer', color: GRIS }} onClick={() => borrarPlato(p.id)} />
                </div>
              )
            })}
            {!platos.length && !loading && <span style={{ fontSize: 12, color: GRIS }}>Sin platos todavía.</span>}
          </div>
        </Papel>

        <Papel ceja={NAR} style={{ flex: '1 1 240px', minWidth: 220, boxShadow: 'none' }}>
          <h3 style={h3}>Plantillas</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {plantillas.map(t => (
              <div key={t.id} style={{ ...chip, cursor: 'default' }}>
                <span style={{ flex: 1, fontSize: 13 }}>{t.nombre}</span>
                <FolderOpen size={15} style={{ cursor: 'pointer', color: VERDE }} onClick={() => aplicarPlantilla(t)} />
                <Trash2 size={14} style={{ cursor: 'pointer', color: GRIS }} onClick={() => borrarPlantilla(t.id)} />
              </div>
            ))}
            {!plantillas.length && <span style={{ fontSize: 12, color: GRIS }}>Sin plantillas. Monta una semana y pulsa "Plantilla".</span>}
          </div>
        </Papel>
      </div>

      <datalist id="catalogo-platos">
        {platos.map(p => <option key={p.id} value={p.nombre} />)}
      </datalist>
    </PantallaCantera>
  )
}
