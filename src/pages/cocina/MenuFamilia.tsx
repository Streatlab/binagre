import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, pageTitleStyle } from '@/styles/tokens'
import { Plus, X, Trash2, Save, FolderOpen, ChevronLeft, ChevronRight, Printer, Eraser } from 'lucide-react'

const INK = '#0a0a0a'
const AMA = '#FFC400'
const RED = '#B01D23'
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DIA_CORTO = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']

interface Plato { id: string; nombre: string; categoria: string | null; activo: boolean }
interface Asign { id: string; semana_inicio: string; dia: number; plato_id: string | null; plato_nombre: string; orden: number }
interface Plantilla { id: string; nombre: string; dias: Record<string, { nombre: string }[]> }

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

export default function MenuFamilia() {
  const { T, isDark } = useTheme()
  const [semana, setSemana] = useState<Date>(() => lunesDe(new Date()))
  const [platos, setPlatos] = useState<Plato[]>([])
  const [asigns, setAsigns] = useState<Asign[]>([])
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [nuevoPlato, setNuevoPlato] = useState('')
  const [inputDia, setInputDia] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)

  const semIso = iso(semana)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [p, a, t] = await Promise.all([
      supabase.from('menu_familia_platos').select('*').eq('activo', true).order('nombre'),
      supabase.from('menu_familia_semana').select('*').eq('semana_inicio', semIso).order('orden'),
      supabase.from('menu_familia_plantillas').select('*').order('nombre'),
    ])
    setPlatos((p.data as Plato[]) || [])
    setAsigns((a.data as Asign[]) || [])
    setPlantillas((t.data as unknown as Plantilla[]) || [])
    setLoading(false)
  }, [semIso])

  useEffect(() => { cargar() }, [cargar])

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
    await supabase.from('menu_familia_platos').insert({ nombre: n })
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
  async function quitarAsign(id: string) {
    await supabase.from('menu_familia_semana').delete().eq('id', id)
    cargar()
  }
  async function limpiarSemana() {
    if (!confirm('¿Vaciar el menú de toda la semana?')) return
    await supabase.from('menu_familia_semana').delete().eq('semana_inicio', semIso)
    cargar()
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

  /* ── estilos ── */
  const btn = (bg: string, color = '#fff'): React.CSSProperties => ({
    background: bg, color, border: `2px solid ${INK}`, borderRadius: 6,
    boxShadow: `2px 2px 0 ${INK}`, padding: '6px 12px', cursor: 'pointer',
    fontFamily: FONT.heading, fontWeight: 700, fontSize: 13, letterSpacing: '0.04em',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  })
  const navBtn = (): React.CSSProperties => ({
    width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: T.card, color: T.pri, border: `2px solid ${INK}`, borderRadius: 6, cursor: 'pointer',
  })
  const inp: React.CSSProperties = {
    background: T.inp, border: `1.5px solid ${INK}`, borderRadius: 5,
    padding: '4px 8px', color: T.pri, fontFamily: FONT.body, fontSize: 12, width: '100%',
  }
  const celdaBg = isDark ? '#1a1f2e' : '#ffffff'

  return (
    <div style={{ padding: '24px 28px', fontFamily: FONT.body, color: T.pri }}>
      {/* CSS de impresión */}
      <style>{`
        @media print {
          aside { display: none !important; }
          .mf-no-print { display: none !important; }
          .mf-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; }
          .mf-grid { box-shadow: none !important; }
          .mf-cell { break-inside: avoid; }
          @page { size: A4 landscape; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <h1 style={pageTitleStyle(T)}>Menú Familia · Personal</h1>

      {/* barra superior */}
      <div className="mf-no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0', flexWrap: 'wrap' }}>
        <button onClick={() => setSemana(s => addDias(s, -7))} style={navBtn()}><ChevronLeft size={16} /></button>
        <button onClick={() => setSemana(lunesDe(new Date()))} style={{ ...navBtn(), width: 'auto', padding: '0 12px', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase' }}>Hoy</button>
        <button onClick={() => setSemana(s => addDias(s, 7))} style={navBtn()}><ChevronRight size={16} /></button>
        <div style={{ flex: 1 }} />
        <button style={btn('#1e9e54')} onClick={guardarPlantilla}><Save size={15} />Guardar plantilla</button>
        <button style={btn(RED)} onClick={limpiarSemana}><Eraser size={15} />Vaciar</button>
        <button style={btn(INK)} onClick={() => window.print()}><Printer size={15} />Imprimir</button>
      </div>

      <div className="mf-print-area">
        {/* título semana (visible también en impresión) */}
        <div style={{ fontFamily: FONT.heading, fontWeight: 800, fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
          Semana {fmtCorto(semana)} – {fmtCorto(addDias(semana, 6))}
        </div>

        {/* cuadrícula lunes → domingo */}
        <div style={{ overflowX: 'auto' }}>
          <div className="mf-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', gap: 4, minWidth: 880, border: `3px solid ${INK}`, borderRadius: 8, padding: 4, background: INK }}>
            {/* cabeceras */}
            {DIAS.map((_, i) => {
              const fecha = addDias(semana, i)
              const finde = i >= 5
              return (
                <div key={`h-${i}`} style={{ background: finde ? '#FFE08A' : AMA, color: INK, border: `2px solid ${INK}`, borderRadius: 5, padding: '6px 4px', textAlign: 'center' }}>
                  <div style={{ fontFamily: FONT.heading, fontWeight: 800, fontSize: 14, letterSpacing: '0.05em' }}>{DIA_CORTO[i]}</div>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{fmtNum(fecha)}</div>
                </div>
              )
            })}

            {/* celdas */}
            {DIAS.map((_, i) => {
              const dia = i + 1
              const items = asignsPorDia[dia] || []
              return (
                <div key={`c-${i}`} className="mf-cell" style={{ background: celdaBg, border: `2px solid ${INK}`, borderRadius: 5, padding: 6, minHeight: 150, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {items.length === 0 && <span className="mf-no-print" style={{ fontSize: 11, color: T.mut, fontStyle: 'italic' }}>—</span>}
                  {items.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, background: T.group, border: `1px solid ${INK}`, borderRadius: 4, padding: '4px 6px' }}>
                      <span style={{ flex: 1, fontSize: 13, lineHeight: 1.25 }}>{a.plato_nombre}</span>
                      <X className="mf-no-print" size={13} style={{ cursor: 'pointer', color: T.mut, flexShrink: 0, marginTop: 2 }} onClick={() => quitarAsign(a.id)} />
                    </div>
                  ))}
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

      {/* lateral catálogo + plantillas */}
      <div className="mf-no-print" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20, maxWidth: 720 }}>
        <div style={{ background: T.card, border: `2px solid ${INK}`, borderRadius: 8, boxShadow: `3px 3px 0 ${INK}`, padding: 14 }}>
          <h3 style={{ fontFamily: FONT.heading, fontWeight: 700, fontSize: 14, marginBottom: 10, letterSpacing: '0.05em' }}>CATÁLOGO DE PLATOS</h3>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            <input style={inp} placeholder="Nuevo plato…" value={nuevoPlato}
              onChange={e => setNuevoPlato(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') crearPlato() }} />
            <button style={{ ...btn(RED), padding: '6px 10px', boxShadow: 'none' }} onClick={crearPlato}><Plus size={15} /></button>
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {platos.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: T.group, border: `1px solid ${INK}`, borderRadius: 4 }}>
                <span style={{ flex: 1, fontSize: 13 }}>{p.nombre}</span>
                <Trash2 size={14} style={{ cursor: 'pointer', color: T.mut }} onClick={() => borrarPlato(p.id)} />
              </div>
            ))}
            {!platos.length && !loading && <span style={{ fontSize: 12, color: T.mut }}>Sin platos todavía.</span>}
          </div>
        </div>

        <div style={{ background: T.card, border: `2px solid ${INK}`, borderRadius: 8, boxShadow: `3px 3px 0 ${INK}`, padding: 14 }}>
          <h3 style={{ fontFamily: FONT.heading, fontWeight: 700, fontSize: 14, marginBottom: 10, letterSpacing: '0.05em' }}>PLANTILLAS</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {plantillas.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: T.group, border: `1px solid ${INK}`, borderRadius: 4 }}>
                <span style={{ flex: 1, fontSize: 13 }}>{t.nombre}</span>
                <FolderOpen size={15} style={{ cursor: 'pointer', color: '#1e9e54' }} onClick={() => aplicarPlantilla(t)} />
                <Trash2 size={14} style={{ cursor: 'pointer', color: T.mut }} onClick={() => borrarPlantilla(t.id)} />
              </div>
            ))}
            {!plantillas.length && <span style={{ fontSize: 12, color: T.mut }}>Sin plantillas. Monta una semana y pulsa "Guardar plantilla".</span>}
          </div>
        </div>
      </div>

      <datalist id="catalogo-platos">
        {platos.map(p => <option key={p.id} value={p.nombre} />)}
      </datalist>
    </div>
  )
}
