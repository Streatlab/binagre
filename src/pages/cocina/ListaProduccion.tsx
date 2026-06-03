import { useState, useEffect, useCallback } from 'react'
import { ClipboardList, Printer, Plus, Trash2, X, Check, Pencil, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, tituloPaginaStyle } from '@/styles/tokens'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

type Dia = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'

const DIAS: Dia[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const DIAS_LABEL: Record<Dia, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
}

interface CeldaValor {
  hoy: string
  ssp: string
}

interface Partida {
  id: string
  seccion_id: string
  nombre: string
  orden: number
  activa: boolean
}

interface Seccion {
  id: string
  nombre: string
  orden: number
  activa: boolean
}

interface EntradaProduccion {
  id: string
  partida_id: string
  semana_iso: string
  dia: Dia
  hoy: string
  ssp: string
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

function getSemanaISO(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function getSemanaLabel(iso: string): string {
  const [year, week] = iso.split('-W').map(Number)
  const jan4 = new Date(year, 0, 4)
  const startOfWeek = new Date(jan4.getTime() - (((jan4.getDay() || 7) - 1) * 86400000) + ((week - 1) * 7 * 86400000))
  const endOfWeek = new Date(startOfWeek.getTime() + 6 * 86400000)
  const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`
  return `Semana ${week} · ${fmt(startOfWeek)}–${fmt(endOfWeek)}`
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function ListaProduccion() {
  const { T, isDark } = useTheme()

  const [secciones, setSecciones] = useState<Seccion[]>([])
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [entradas, setEntradas] = useState<EntradaProduccion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const hoy = new Date()
  const [semanaActual] = useState(() => getSemanaISO(hoy))
  const [semana, setSemana] = useState(semanaActual)

  const [modalSecciones, setModalSecciones] = useState(false)
  const [modalPartidas, setModalPartidas] = useState(false)
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<Set<string>>(new Set())

  useEffect(() => { cargar() }, [semana])

  async function cargar() {
    setLoading(true)
    const [{ data: secs }, { data: parts }, { data: ents, error: e }] = await Promise.all([
      supabase.from('produccion_secciones').select('*').eq('activa', true).order('orden'),
      supabase.from('produccion_partidas').select('*').eq('activa', true).order('seccion_id').order('orden'),
      supabase.from('produccion_entradas').select('*').eq('semana_iso', semana),
    ])
    if (e) setError(e.message)
    else {
      setSecciones((secs as Seccion[]) ?? [])
      setPartidas((parts as Partida[]) ?? [])
      setEntradas((ents as EntradaProduccion[]) ?? [])
      if (secs?.length) setSeccionesAbiertas(new Set(secs.map((s: Seccion) => s.id)))
    }
    setLoading(false)
  }

  function getCelda(partidaId: string, dia: Dia): CeldaValor {
    const e = entradas.find(e => e.partida_id === partidaId && e.dia === dia)
    return { hoy: e?.hoy ?? '', ssp: e?.ssp ?? '' }
  }

  async function setCelda(partidaId: string, dia: Dia, campo: 'hoy' | 'ssp', valor: string) {
    const existing = entradas.find(e => e.partida_id === partidaId && e.dia === dia)

    setEntradas(prev => {
      const idx = prev.findIndex(e => e.partida_id === partidaId && e.dia === dia)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], [campo]: valor }
        return updated
      }
      return [...prev, {
        id: `tmp-${Date.now()}`,
        partida_id: partidaId,
        semana_iso: semana,
        dia,
        hoy: campo === 'hoy' ? valor : '',
        ssp: campo === 'ssp' ? valor : '',
      }]
    })

    if (existing) {
      await supabase.from('produccion_entradas').update({ [campo]: valor }).eq('id', existing.id)
    } else {
      const { data } = await supabase.from('produccion_entradas')
        .insert({ partida_id: partidaId, semana_iso: semana, dia, hoy: campo === 'hoy' ? valor : '', ssp: campo === 'ssp' ? valor : '' })
        .select().single()
      if (data) {
        setEntradas(prev => prev.map(e =>
          e.partida_id === partidaId && e.dia === dia && e.id.startsWith('tmp-')
            ? (data as EntradaProduccion) : e
        ))
      }
    }
  }

  function toggleSeccion(id: string) {
    setSeccionesAbiertas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function semanaAnterior() {
    const [year, week] = semana.split('-W').map(Number)
    const d = new Date(year, 0, 1 + (week - 1) * 7)
    d.setDate(d.getDate() - 7)
    setSemana(getSemanaISO(d))
  }

  function semanaSiguiente() {
    const [year, week] = semana.split('-W').map(Number)
    const d = new Date(year, 0, 1 + (week - 1) * 7)
    d.setDate(d.getDate() + 7)
    setSemana(getSemanaISO(d))
  }

  if (loading) return <div style={{ padding: 32, color: T.sec, fontFamily: FONT.body }}>Cargando producción…</div>
  if (error) return <div style={{ padding: 32, color: '#B01D23', fontFamily: FONT.body }}>Error: {error}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{PRINT_CSS}</style>

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <ClipboardList size={24} color="#B01D23" />
        <div style={tituloPaginaStyle(T)}>Lista de Producción</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setModalSecciones(true)} style={btnGhost(T)}>
            <Plus size={16} /> Secciones
          </button>
          <button onClick={() => setModalPartidas(true)} style={btnGhost(T)}>
            <Plus size={16} /> Partidas
          </button>
          <button onClick={() => window.print()} style={btnGhost(T)}>
            <Printer size={16} /> Imprimir / PDF
          </button>
        </div>
      </div>

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={semanaAnterior} style={btnGhost(T)}>‹ Anterior</button>
        <div style={{ fontFamily: FONT.heading, fontSize: 15, color: T.pri, letterSpacing: '0.5px' }}>
          {getSemanaLabel(semana)}
          {semana === semanaActual && (
            <span style={{ marginLeft: 8, background: '#B01D23', color: '#fff', borderRadius: 99, fontSize: 10, padding: '2px 8px', fontFamily: FONT.body }}>
              Esta semana
            </span>
          )}
        </div>
        <button onClick={semanaSiguiente} style={btnGhost(T)}>Siguiente ›</button>
        {semana !== semanaActual && (
          <button onClick={() => setSemana(semanaActual)} style={{ ...btnGhost(T), fontSize: 12 }}>Hoy</button>
        )}
      </div>

      <div className="print-area tabla-scroll" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT.body, fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thPartida(T, isDark)}>Partida</th>
              {DIAS.map(dia => (
                <th key={dia} colSpan={2} style={thDia(T, isDark)}>{DIAS_LABEL[dia]}</th>
              ))}
            </tr>
            <tr>
              <th style={thSub(T, isDark)} />
              {DIAS.map(dia => (
                <>
                  <th key={`${dia}-hoy`} style={thSubLabel(T, isDark, false)}>HOY</th>
                  <th key={`${dia}-ssp`} style={thSubLabel(T, isDark, true)}>SSP</th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {secciones.map(sec => {
              const partsSeccion = partidas.filter(p => p.seccion_id === sec.id)
              const isOpen = seccionesAbiertas.has(sec.id)
              return (
                <>
                  <tr key={`sec-${sec.id}`} className="fila-seccion" onClick={() => toggleSeccion(sec.id)} style={{ cursor: 'pointer' }}>
                    <td colSpan={15} style={tdSeccion(T, isDark)}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {isOpen ? <ChevronDown size={14} color="#B01D23" /> : <ChevronRight size={14} color="#B01D23" />}
                        {sec.nombre}
                      </span>
                    </td>
                  </tr>
                  {isOpen && partsSeccion.map((part, idx) => (
                    <tr key={part.id} style={{ background: idx % 2 === 0 ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)') : 'transparent' }}>
                      <td style={tdPartida(T, isDark)}>{part.nombre}</td>
                      {DIAS.map(dia => {
                        const celda = getCelda(part.id, dia)
                        return (
                          <>
                            <td key={`${part.id}-${dia}-hoy`} style={tdCelda(T, isDark, false)}>
                              <input value={celda.hoy} onChange={e => setCelda(part.id, dia, 'hoy', e.target.value)} style={inputCelda(T, isDark, false)} placeholder="—" />
                            </td>
                            <td key={`${part.id}-${dia}-ssp`} style={tdCelda(T, isDark, true)}>
                              <input value={celda.ssp} onChange={e => setCelda(part.id, dia, 'ssp', e.target.value)} style={inputCelda(T, isDark, true)} placeholder="—" />
                            </td>
                          </>
                        )
                      })}
                    </tr>
                  ))}
                </>
              )
            })}
          </tbody>
        </table>
        {secciones.length === 0 && (
          <div className="no-print" style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>
            Sin secciones. Añade secciones y partidas con los botones de arriba.
          </div>
        )}
      </div>

      <div className="no-print" style={{ display: 'flex', gap: 16, fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
        <span><strong style={{ color: T.sec }}>HOY</strong> — Producción urgente</span>
        <span><strong style={{ color: T.sec }}>SSP</strong> — Si se puede: hoy si hay tiempo, si no mañana</span>
      </div>

      {modalSecciones && (
        <ModalGestionSecciones T={T} isDark={isDark} secciones={secciones}
          onClose={() => setModalSecciones(false)} onSaved={() => { setModalSecciones(false); cargar() }} />
      )}
      {modalPartidas && (
        <ModalGestionPartidas T={T} isDark={isDark} secciones={secciones} partidas={partidas}
          onClose={() => setModalPartidas(false)} onSaved={() => { setModalPartidas(false); cargar() }} />
      )}
    </div>
  )
}

// ─── MODAL SECCIONES ──────────────────────────────────────────────────────────

function ModalGestionSecciones({ T, isDark, secciones, onClose, onSaved }: {
  T: ReturnType<typeof useTheme>['T']; isDark: boolean; secciones: Seccion[]
  onClose: () => void; onSaved: () => void
}) {
  const [nueva, setNueva] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')

  async function crear() {
    if (!nueva.trim()) return
    await supabase.from('produccion_secciones').insert({ nombre: nueva.trim().toUpperCase(), orden: secciones.length })
    setNueva(''); onSaved()
  }
  async function renombrar(s: Seccion) {
    if (!editNombre.trim()) return
    await supabase.from('produccion_secciones').update({ nombre: editNombre.trim().toUpperCase() }).eq('id', s.id)
    setEditId(null); onSaved()
  }
  async function eliminar(s: Seccion) {
    if (!confirm(`¿Eliminar sección "${s.nombre}"?`)) return
    await supabase.from('produccion_secciones').update({ activa: false }).eq('id', s.id)
    onSaved()
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalBox, background: T.card, border: `1px solid ${T.brd}` }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 18, color: '#B01D23', letterSpacing: '1px', textTransform: 'uppercase' }}>Secciones</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: T.mut }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={nueva} onChange={e => setNueva(e.target.value)} onKeyDown={e => e.key === 'Enter' && crear()} placeholder="Nueva sección" style={{ ...inputStyle(T), flex: 1 }} />
          <button onClick={crear} style={btnPrimary}><Plus size={16} /> Crear</button>
        </div>
        {secciones.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {editId === s.id ? (
              <>
                <input value={editNombre} onChange={e => setEditNombre(e.target.value)} style={{ ...inputStyle(T), flex: 1 }} />
                <button onClick={() => renombrar(s)} style={iconBtn(T)}><Check size={14} /></button>
                <button onClick={() => setEditId(null)} style={iconBtn(T)}><X size={14} /></button>
              </>
            ) : (
              <>
                <div style={{ flex: 1, fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{s.nombre}</div>
                <button onClick={() => { setEditId(s.id); setEditNombre(s.nombre) }} style={iconBtn(T)}><Pencil size={13} /></button>
                <button onClick={() => eliminar(s)} style={{ ...iconBtn(T), color: '#B01D23' }}><Trash2 size={13} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MODAL PARTIDAS ───────────────────────────────────────────────────────────

function ModalGestionPartidas({ T, isDark, secciones, partidas, onClose, onSaved }: {
  T: ReturnType<typeof useTheme>['T']; isDark: boolean
  secciones: Seccion[]; partidas: Partida[]; onClose: () => void; onSaved: () => void
}) {
  const [seccionFiltro, setSeccionFiltro] = useState(secciones[0]?.id ?? '')
  const [nueva, setNueva] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')

  const partidasSeccion = partidas.filter(p => p.seccion_id === seccionFiltro)

  async function crear() {
    if (!nueva.trim() || !seccionFiltro) return
    const maxOrden = Math.max(0, ...partidasSeccion.map(p => p.orden))
    await supabase.from('produccion_partidas').insert({ nombre: nueva.trim(), seccion_id: seccionFiltro, orden: maxOrden + 1 })
    setNueva(''); onSaved()
  }
  async function renombrar(p: Partida) {
    if (!editNombre.trim()) return
    await supabase.from('produccion_partidas').update({ nombre: editNombre.trim() }).eq('id', p.id)
    setEditId(null); onSaved()
  }
  async function eliminar(p: Partida) {
    if (!confirm(`¿Eliminar partida "${p.nombre}"?`)) return
    await supabase.from('produccion_partidas').update({ activa: false }).eq('id', p.id)
    onSaved()
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalBox, background: T.card, border: `1px solid ${T.brd}`, width: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 18, color: '#B01D23', letterSpacing: '1px', textTransform: 'uppercase' }}>Partidas</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: T.mut }}><X size={20} /></button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lblStyle(T)}>Sección</label>
          <select value={seccionFiltro} onChange={e => setSeccionFiltro(e.target.value)} style={inputStyle(T)}>
            {secciones.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={nueva} onChange={e => setNueva(e.target.value)} onKeyDown={e => e.key === 'Enter' && crear()} placeholder="Nueva partida (ej: Basmati)" style={{ ...inputStyle(T), flex: 1 }} />
          <button onClick={crear} style={btnPrimary}><Plus size={16} /> Añadir</button>
        </div>
        {partidasSeccion.length === 0 && (
          <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.mut, padding: '12px 0' }}>Sin partidas en esta sección.</div>
        )}
        {partidasSeccion.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {editId === p.id ? (
              <>
                <input value={editNombre} onChange={e => setEditNombre(e.target.value)} style={{ ...inputStyle(T), flex: 1 }} />
                <button onClick={() => renombrar(p)} style={iconBtn(T)}><Check size={14} /></button>
                <button onClick={() => setEditId(null)} style={iconBtn(T)}><X size={14} /></button>
              </>
            ) : (
              <>
                <div style={{ flex: 1, fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{p.nombre}</div>
                <button onClick={() => { setEditId(p.id); setEditNombre(p.nombre) }} style={iconBtn(T)}><Pencil size={13} /></button>
                <button onClick={() => eliminar(p)} style={{ ...iconBtn(T), color: '#B01D23' }}><Trash2 size={13} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: '#B01D23', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontFamily: FONT.body, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnGhost = (T: ReturnType<typeof useTheme>['T']): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: T.sec, border: `1px solid ${T.brd}`, borderRadius: 8, padding: '8px 14px', fontFamily: FONT.body, fontSize: 13, fontWeight: 500, cursor: 'pointer' })
const inputStyle = (T: ReturnType<typeof useTheme>['T']): React.CSSProperties => ({ width: '100%', background: T.inp, border: `1px solid ${T.brd}`, borderRadius: 8, color: T.pri, fontFamily: FONT.body, fontSize: 13, padding: '8px 12px', outline: 'none' })
const lblStyle = (T: ReturnType<typeof useTheme>['T']): React.CSSProperties => ({ display: 'block', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 5 })
const iconBtn = (T: ReturnType<typeof useTheme>['T']): React.CSSProperties => ({ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 6, color: T.sec, cursor: 'pointer', padding: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' })
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
const modalBox: React.CSSProperties = { borderRadius: 16, width: 560, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }

const thPartida = (T: ReturnType<typeof useTheme>['T'], isDark: boolean): React.CSSProperties => ({
  fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase',
  textAlign: 'left', padding: '10px 12px',
  background: isDark ? '#1e2233' : '#1a1a1a', color: '#fff',
  border: `1px solid ${isDark ? '#2d3454' : '#333'}`,
  minWidth: 160, position: 'sticky', left: 0, zIndex: 2,
})
const thDia = (T: ReturnType<typeof useTheme>['T'], isDark: boolean): React.CSSProperties => ({
  fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase',
  color: '#fff', textAlign: 'center', padding: '8px 4px',
  background: isDark ? '#1e2233' : '#1a1a1a',
  border: `1px solid ${isDark ? '#2d3454' : '#333'}`,
  minWidth: 100,
})
const thSub = (T: ReturnType<typeof useTheme>['T'], isDark: boolean): React.CSSProperties => ({
  background: isDark ? '#1e2233' : '#1a1a1a',
  border: `1px solid ${isDark ? '#2d3454' : '#333'}`,
  position: 'sticky', left: 0, zIndex: 2,
})
const thSubLabel = (T: ReturnType<typeof useTheme>['T'], isDark: boolean, isSSP = false): React.CSSProperties => ({
  fontFamily: FONT.body, fontSize: 10, color: isSSP ? '#aaa' : '#e8f442',
  textAlign: 'center', padding: '4px 2px',
  background: isDark ? (isSSP ? '#16192a' : '#1a1d30') : (isSSP ? '#2a2a2a' : '#222'),
  border: `1px solid ${isDark ? '#2d3454' : '#333'}`,
  minWidth: 48,
})
const tdSeccion = (T: ReturnType<typeof useTheme>['T'], isDark: boolean): React.CSSProperties => ({
  fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase',
  color: '#B01D23', padding: '6px 12px',
  background: isDark ? 'rgba(176,29,35,0.08)' : 'rgba(176,29,35,0.06)',
  border: `1px solid ${isDark ? '#2d3454' : '#ddd'}`,
  userSelect: 'none',
})
const tdPartida = (T: ReturnType<typeof useTheme>['T'], isDark: boolean): React.CSSProperties => ({
  fontFamily: FONT.body, fontSize: 13, color: T.pri,
  padding: '6px 12px',
  border: `1px solid ${isDark ? '#2d3454' : '#ddd'}`,
  position: 'sticky', left: 0, zIndex: 1,
  background: isDark ? 'var(--sl-bg)' : '#fff',
  whiteSpace: 'nowrap',
})
const tdCelda = (T: ReturnType<typeof useTheme>['T'], isDark: boolean, isSSP = false): React.CSSProperties => ({
  padding: '3px',
  border: `1px solid ${isDark ? '#2d3454' : '#ddd'}`,
  background: isSSP ? (isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)') : 'transparent',
})
const inputCelda = (T: ReturnType<typeof useTheme>['T'], isDark: boolean, isSSP = false): React.CSSProperties => ({
  width: '100%', minWidth: 44, background: 'transparent',
  border: 'none', outline: 'none',
  fontFamily: FONT.body, fontSize: 13,
  color: isSSP ? T.sec : T.pri,
  padding: '4px 6px', textAlign: 'center',
})

const PRINT_CSS = `
.tabla-scroll { overflow-x: auto; }

@media print {
  @page { size: A4 landscape; margin: 5mm; }
  body * { visibility: hidden; }
  .print-area, .print-area * { visibility: visible; }
  .no-print { display: none !important; }
  .print-area { position: absolute; left: 0; top: 0; width: 100%; }
  .tabla-scroll { overflow: visible !important; }
  table { width: 100%; border-collapse: collapse; font-size: 8px; }
  th, td { border: 1px solid #333 !important; padding: 3px 4px !important; }
  th { background: #1a1a1a !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .fila-seccion td { background: #eeeeee !important; color: #B01D23 !important; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  input { border: none !important; background: transparent !important; font-size: 8px; width: 100%; text-align: center; }
  thead th:first-child, tbody td:first-child { position: static !important; }
}
`
