import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, pageTitleStyle } from '@/styles/tokens'
import { Plus, X, Trash2, Save, FolderOpen, ChevronLeft, ChevronRight, Utensils, Eraser } from 'lucide-react'

const RED = '#B01D23'
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

interface Plato { id: string; nombre: string; categoria: string | null; activo: boolean }
interface Asign { id: string; semana_inicio: string; dia: number; plato_id: string | null; plato_nombre: string; orden: number }
interface Plantilla { id: string; nombre: string; dias: Record<string, { nombre: string }[]> }

/* ── fecha helpers ── */
function lunesDe(d: Date): Date {
  const x = new Date(d)
  const dow = (x.getDay() + 6) % 7 // 0=lun
  x.setDate(x.getDate() - dow)
  x.setHours(0, 0, 0, 0)
  return x
}
function iso(d: Date): string { return d.toISOString().slice(0, 10) }
function addDias(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function fmtCorto(d: Date): string { return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) }

export default function MenuFamilia() {
  const { T } = useTheme()
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

  /* ── estilos neobrutal ── */
  const cardNeo = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    background: T.card, border: `2px solid ${T.brd}`, borderRadius: 8,
    boxShadow: `3px 3px 0 ${T.brd}`, ...extra,
  })
  const btn = (bg: string, color = '#fff'): React.CSSProperties => ({
    background: bg, color, border: `2px solid ${T.brd}`, borderRadius: 6,
    boxShadow: `2px 2px 0 ${T.brd}`, padding: '6px 12px', cursor: 'pointer',
    fontFamily: FONT.head, fontWeight: 700, fontSize: 13, letterSpacing: '0.04em',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  })
  const inp: React.CSSProperties = {
    background: T.inp, border: `2px solid ${T.brd}`, borderRadius: 6,
    padding: '6px 10px', color: T.pri, fontFamily: FONT.body, fontSize: 13, width: '100%',
  }

  return (
    <div style={{ padding: 24, fontFamily: FONT.body, color: T.pri }}>
      <h1 style={pageTitleStyle(T)}>
        <Utensils size={22} style={{ marginRight: 8, verticalAlign: '-4px', color: RED }} />
        MENÚ FAMILIA · Personal
      </h1>

      {/* barra semana */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0', flexWrap: 'wrap' }}>
        <button style={btn(T.card, T.pri)} onClick={() => setSemana(s => addDias(s, -7))}><ChevronLeft size={16} /></button>
        <div style={{ ...cardNeo({ padding: '8px 16px' }), fontFamily: FONT.head, fontWeight: 700, fontSize: 15 }}>
          Semana {fmtCorto(semana)} – {fmtCorto(addDias(semana, 6))}
        </div>
        <button style={btn(T.card, T.pri)} onClick={() => setSemana(s => addDias(s, 7))}><ChevronRight size={16} /></button>
        <button style={btn(T.card, T.pri)} onClick={() => setSemana(lunesDe(new Date()))}>Hoy</button>
        <div style={{ flex: 1 }} />
        <button style={btn('#1e9e54')} onClick={guardarPlantilla}><Save size={15} />Guardar plantilla</button>
        <button style={btn(RED)} onClick={limpiarSemana}><Eraser size={15} />Vaciar semana</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 20, alignItems: 'start' }}>
        {/* planificador 7 días */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 12 }}>
          {DIAS.map((dn, i) => {
            const dia = i + 1
            const fecha = addDias(semana, i)
            const items = asignsPorDia[dia] || []
            return (
              <div key={dia} style={cardNeo({ padding: 12, minHeight: 150 })}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span style={{ fontFamily: FONT.head, fontWeight: 700, fontSize: 14, letterSpacing: '0.05em' }}>{dn}</span>
                  <span style={{ fontSize: 11, color: T.mut }}>{fmtCorto(fecha)}</span>
                </div>
                {items.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.group, border: `1.5px solid ${T.brd}`, borderRadius: 5, padding: '4px 8px', marginBottom: 5 }}>
                    <span style={{ flex: 1, fontSize: 13 }}>{a.plato_nombre}</span>
                    <X size={14} style={{ cursor: 'pointer', color: T.mut }} onClick={() => quitarAsign(a.id)} />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  <input
                    list="catalogo-platos"
                    style={{ ...inp, fontSize: 12, padding: '4px 8px' }}
                    placeholder="Añadir plato…"
                    value={inputDia[dia] || ''}
                    onChange={e => setInputDia(s => ({ ...s, [dia]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') { const m = platos.find(p => p.nombre === (inputDia[dia] || '')); addAsign(dia, inputDia[dia] || '', m?.id) } }}
                  />
                  <button
                    style={{ ...btn(RED), padding: '4px 8px' }}
                    onClick={() => { const m = platos.find(p => p.nombre === (inputDia[dia] || '')); addAsign(dia, inputDia[dia] || '', m?.id) }}
                  ><Plus size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>

        {/* lateral: catálogo + plantillas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={cardNeo({ padding: 14 })}>
            <h3 style={{ fontFamily: FONT.head, fontWeight: 700, fontSize: 14, marginBottom: 10, letterSpacing: '0.05em' }}>CATÁLOGO DE PLATOS</h3>
            <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
              <input style={inp} placeholder="Nuevo plato…" value={nuevoPlato}
                onChange={e => setNuevoPlato(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') crearPlato() }} />
              <button style={{ ...btn(RED), padding: '6px 10px' }} onClick={crearPlato}><Plus size={15} /></button>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {platos.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: T.group, border: `1.5px solid ${T.brd}`, borderRadius: 5 }}>
                  <span style={{ flex: 1, fontSize: 13 }}>{p.nombre}</span>
                  <Trash2 size={14} style={{ cursor: 'pointer', color: T.mut }} onClick={() => borrarPlato(p.id)} />
                </div>
              ))}
              {!platos.length && !loading && <span style={{ fontSize: 12, color: T.mut }}>Sin platos todavía.</span>}
            </div>
          </div>

          <div style={cardNeo({ padding: 14 })}>
            <h3 style={{ fontFamily: FONT.head, fontWeight: 700, fontSize: 14, marginBottom: 10, letterSpacing: '0.05em' }}>PLANTILLAS</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {plantillas.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: T.group, border: `1.5px solid ${T.brd}`, borderRadius: 5 }}>
                  <span style={{ flex: 1, fontSize: 13 }}>{t.nombre}</span>
                  <FolderOpen size={15} style={{ cursor: 'pointer', color: '#1e9e54' }} onClick={() => aplicarPlantilla(t)} />
                  <Trash2 size={14} style={{ cursor: 'pointer', color: T.mut }} onClick={() => borrarPlantilla(t.id)} />
                </div>
              ))}
              {!plantillas.length && <span style={{ fontSize: 12, color: T.mut }}>Sin plantillas. Monta una semana y pulsa “Guardar plantilla”.</span>}
            </div>
          </div>
        </div>
      </div>

      <datalist id="catalogo-platos">
        {platos.map(p => <option key={p.id} value={p.nombre} />)}
      </datalist>
    </div>
  )
}
