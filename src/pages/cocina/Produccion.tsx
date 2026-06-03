import { useState, useEffect, useMemo } from 'react'
import React from 'react'
import { ClipboardList, Printer, Plus, Trash2, X, Check, Pencil, Refrigerator } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, pageTitleStyle, groupStyle, tabsContainerStyle, tabActiveStyle, tabInactiveStyle } from '@/styles/tokens'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

type Dia = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'
const DIAS: Dia[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const DIAS_LABEL: Record<Dia, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
}
const TOTAL_COLS = 1 + DIAS.length * 2 + 1 // 16

const PAG_CAP = 24
const HEADER_COST = 3

interface CeldaValor { hoy: string; ssp: string }
interface Partida { id: string; seccion_id: string; nombre: string; orden: number; activa: boolean }
interface Seccion { id: string; nombre: string; orden: number; activa: boolean }
interface EntradaProduccion { id: string; partida_id: string; semana_iso: string; dia: Dia; hoy: string; ssp: string }
interface BloqueImpresion { sec: Seccion; cont: boolean; parts: Partida[] }

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

function paginar(secciones: Seccion[], partidas: Partida[]): BloqueImpresion[][] {
  const paginas: BloqueImpresion[][] = []
  let pagina: BloqueImpresion[] = []
  let usado = 0
  const cerrar = () => { if (pagina.length) { paginas.push(pagina); pagina = []; usado = 0 } }
  for (const sec of secciones) {
    const parts = partidas.filter(p => p.seccion_id === sec.id)
    if (parts.length === 0) continue
    if (usado + HEADER_COST + 1 > PAG_CAP) cerrar()
    let bloque: BloqueImpresion = { sec, cont: false, parts: [] }
    pagina.push(bloque); usado += HEADER_COST
    for (const part of parts) {
      if (usado + 1 > PAG_CAP) {
        cerrar()
        bloque = { sec, cont: true, parts: [] }
        pagina.push(bloque); usado += HEADER_COST
      }
      bloque.parts.push(part); usado += 1
    }
  }
  cerrar()
  return paginas
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────

export default function Produccion() {
  const { T, isDark } = useTheme()
  const [activeTab, setActiveTab] = useState<'lista' | 'camara'>('lista')
  const [secciones, setSecciones] = useState<Seccion[]>([])
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargarBase() }, [])
  async function cargarBase() {
    setLoading(true)
    const [{ data: secs }, { data: parts }] = await Promise.all([
      supabase.from('produccion_secciones').select('*').eq('activa', true).order('orden'),
      supabase.from('produccion_partidas').select('*').eq('activa', true).order('orden'),
    ])
    setSecciones((secs as Seccion[]) ?? [])
    setPartidas((parts as Partida[]) ?? [])
    setLoading(false)
  }

  const tabs = [
    { key: 'lista', label: 'Lista de Producción' },
    { key: 'camara', label: 'Ordenación de Cámara' },
  ]

  return (
    <div style={{ ...groupStyle(T), width: '100%' }}>
      <style>{FICHA_CSS}</style>

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <ClipboardList size={24} color="#B01D23" />
        <h1 style={{ ...pageTitleStyle(T), margin: 0 }}>PRODUCCIÓN</h1>
      </div>

      <div style={tabsContainerStyle()} className="no-print">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as 'lista' | 'camara')}
            style={activeTab === tab.key ? tabActiveStyle(isDark) : tabInactiveStyle(T)}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 24, color: T.sec, fontFamily: FONT.body }}>Cargando producción…</div>
      ) : activeTab === 'lista' ? (
        <TabListaProduccion T={T} secciones={secciones} partidas={partidas} onChanged={cargarBase} />
      ) : (
        <TabOrdenacionCamara T={T} secciones={secciones} partidas={partidas} />
      )}
    </div>
  )
}

// ─── TAB: LISTA DE PRODUCCIÓN (plantilla fija) ─────────────────────────────────

function TabListaProduccion({ T, secciones, partidas, onChanged }: { T: ReturnType<typeof useTheme>['T']; secciones: Seccion[]; partidas: Partida[]; onChanged: () => void }) {
  const [entradas, setEntradas] = useState<EntradaProduccion[]>([])
  const [modalSecciones, setModalSecciones] = useState(false)
  const [modalPartidas, setModalPartidas] = useState(false)
  const semana = useMemo(() => getSemanaISO(new Date()), [])

  useEffect(() => {
    supabase.from('produccion_entradas').select('*').eq('semana_iso', semana)
      .then(({ data }) => setEntradas((data as EntradaProduccion[]) ?? []))
  }, [semana])

  function getCelda(partidaId: string, dia: Dia): CeldaValor {
    const e = entradas.find(e => e.partida_id === partidaId && e.dia === dia)
    return { hoy: e?.hoy ?? '', ssp: e?.ssp ?? '' }
  }
  async function setCelda(partidaId: string, dia: Dia, campo: 'hoy' | 'ssp', valor: string) {
    const existing = entradas.find(e => e.partida_id === partidaId && e.dia === dia)
    setEntradas(prev => {
      const idx = prev.findIndex(e => e.partida_id === partidaId && e.dia === dia)
      if (idx >= 0) { const u = [...prev]; u[idx] = { ...u[idx], [campo]: valor }; return u }
      return [...prev, { id: `tmp-${Date.now()}`, partida_id: partidaId, semana_iso: semana, dia, hoy: campo === 'hoy' ? valor : '', ssp: campo === 'ssp' ? valor : '' }]
    })
    if (existing) await supabase.from('produccion_entradas').update({ [campo]: valor }).eq('id', existing.id)
    else {
      const { data } = await supabase.from('produccion_entradas')
        .insert({ partida_id: partidaId, semana_iso: semana, dia, hoy: campo === 'hoy' ? valor : '', ssp: campo === 'ssp' ? valor : '' })
        .select().single()
      if (data) setEntradas(prev => prev.map(e => e.partida_id === partidaId && e.dia === dia && e.id.startsWith('tmp-') ? (data as EntradaProduccion) : e))
    }
  }

  const paginas = useMemo(() => paginar(secciones, partidas), [secciones, partidas])
  const hayContenido = secciones.length > 0

  const cabeceraDias = (
    <>
      <th className="th-partida th-partida-ini">Producto</th>
      {DIAS.map(dia => <th key={dia} colSpan={2} className="th-dia dia-ini">{DIAS_LABEL[dia]}</th>)}
      <th className="th-partida th-partida-fin">Producto</th>
    </>
  )
  const subCabecera = (
    <>
      <th className="th-sub-empty" />
      {DIAS.map(dia => (
        <React.Fragment key={dia}>
          <th className="th-sub th-sub-hoy dia-ini">HOY</th>
          <th className="th-sub th-sub-ssp">SSP</th>
        </React.Fragment>
      ))}
      <th className="th-sub-empty" />
    </>
  )

  return (
    <>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 14, color: T.pri, letterSpacing: '0.5px' }}>
          Plantilla · {getSemanaLabel(semana)}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setModalSecciones(true)} style={btnGhost}><Plus size={15} /> Secciones</button>
          <button onClick={() => setModalPartidas(true)} style={btnGhost}><Plus size={15} /> Partidas</button>
          <button onClick={() => window.print()} style={btnGhost}><Printer size={15} /> Imprimir / PDF</button>
        </div>
      </div>

      {/* VISTA PANTALLA */}
      <div className="vista-pantalla ficha-card">
        <div className="ficha-head">
          <span className="ficha-title">Lista de Producción</span>
          <span className="ficha-week">{getSemanaLabel(semana)}</span>
        </div>
        <div className="ficha-section" style={{ borderBottom: 'none', paddingBottom: 6 }}>
          {!hayContenido ? (
            <div style={{ padding: 36, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin secciones todavía.</div>
          ) : (
            <div className="prod-table-wrap">
              <table className="prod-table">
                <thead><tr>{cabeceraDias}</tr><tr>{subCabecera}</tr></thead>
                <tbody>
                  {secciones.map(sec => (
                    <React.Fragment key={sec.id}>
                      <tr className="fila-seccion"><td colSpan={TOTAL_COLS} className="td-seccion">{sec.nombre}</td></tr>
                      {partidas.filter(p => p.seccion_id === sec.id).map(part => (
                        <tr key={part.id} className="fila-partida">
                          <td className="td-partida td-partida-ini">{part.nombre}</td>
                          {DIAS.map(dia => {
                            const c = getCelda(part.id, dia)
                            return (
                              <React.Fragment key={dia}>
                                <td className="td-celda td-celda-hoy dia-ini"><input value={c.hoy} onChange={e => setCelda(part.id, dia, 'hoy', e.target.value)} className="celda-input" /></td>
                                <td className="td-celda td-celda-ssp"><input value={c.ssp} onChange={e => setCelda(part.id, dia, 'ssp', e.target.value)} className="celda-input celda-ssp" /></td>
                              </React.Fragment>
                            )
                          })}
                          <td className="td-partida td-partida-fin">{part.nombre}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* VISTA IMPRESIÓN paginada */}
      <div className="vista-impresion">
        {paginas.map((bloques, pi) => (
          <div key={pi} className="hoja" style={{ breakAfter: pi < paginas.length - 1 ? 'page' : 'auto' }}>
            <div className="print-head">
              <span className="print-title">Lista de Producción</span>
              <span className="print-week">{getSemanaLabel(semana)}</span>
              <span className="print-pag">Página {pi + 1} de {paginas.length}</span>
            </div>
            {bloques.map((b, bi) => (
              <table key={bi} className="prod-table prod-table-print">
                <thead>
                  <tr><th colSpan={TOTAL_COLS} className="th-seccion-print">{b.sec.nombre}{b.cont ? ' · (CONTINÚA)' : ''}</th></tr>
                  <tr>{cabeceraDias}</tr>
                  <tr>{subCabecera}</tr>
                </thead>
                <tbody>
                  {b.parts.map(part => (
                    <tr key={part.id} className="fila-partida">
                      <td className="td-partida td-partida-ini">{part.nombre}</td>
                      {DIAS.map(dia => {
                        const c = getCelda(part.id, dia)
                        return (
                          <React.Fragment key={dia}>
                            <td className="td-celda td-celda-hoy dia-ini"><span className="celda-print">{c.hoy}</span></td>
                            <td className="td-celda td-celda-ssp"><span className="celda-print">{c.ssp}</span></td>
                          </React.Fragment>
                        )
                      })}
                      <td className="td-partida td-partida-fin">{part.nombre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        ))}
      </div>

      {modalSecciones && <ModalGestionSecciones T={T} secciones={secciones} onClose={() => setModalSecciones(false)} onSaved={() => { setModalSecciones(false); onChanged() }} />}
      {modalPartidas && <ModalGestionPartidas T={T} secciones={secciones} partidas={partidas} onClose={() => setModalPartidas(false)} onSaved={() => { setModalPartidas(false); onChanged() }} />}
    </>
  )
}

// ─── TAB: ORDENACIÓN DE CÁMARA (carteles A4, uno por balda) ─────────────────────

function TabOrdenacionCamara({ T, secciones, partidas }: { T: ReturnType<typeof useTheme>['T']; secciones: Seccion[]; partidas: Partida[] }) {
  return (
    <>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, maxWidth: 620 }}>
          Un cartel por balda para pegar en cada puerta de la cámara. Solo los productos, en grande. Al imprimir sale cada balda en su propia hoja A4.
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={() => window.print()} style={btnGhost}><Printer size={15} /> Imprimir / PDF</button>
        </div>
      </div>

      <div className="camara-wrap">
        {secciones.map(sec => {
          const parts = partidas.filter(p => p.seccion_id === sec.id)
          if (parts.length === 0) return null
          const dosCols = parts.length > 9
          return (
            <div key={sec.id} className="cartel">
              <div className="cartel-head">{sec.nombre}</div>
              <ul className={`cartel-list ${dosCols ? 'cols-2' : ''}`}>
                {parts.map(p => <li key={p.id} className="cartel-item">{p.nombre}</li>)}
              </ul>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ─── MODAL SECCIONES ──────────────────────────────────────────────────────────

function ModalGestionSecciones({ T, secciones, onClose, onSaved }: { T: ReturnType<typeof useTheme>['T']; secciones: Seccion[]; onClose: () => void; onSaved: () => void }) {
  const [nueva, setNueva] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  async function crear() { if (!nueva.trim()) return; await supabase.from('produccion_secciones').insert({ nombre: nueva.trim().toUpperCase(), orden: secciones.length }); setNueva(''); onSaved() }
  async function renombrar(s: Seccion) { if (!editNombre.trim()) return; await supabase.from('produccion_secciones').update({ nombre: editNombre.trim().toUpperCase() }).eq('id', s.id); setEditId(null); onSaved() }
  async function eliminar(s: Seccion) { if (!confirm(`¿Eliminar sección "${s.nombre}"?`)) return; await supabase.from('produccion_secciones').update({ activa: false }).eq('id', s.id); onSaved() }
  return (
    <div style={overlay} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalBox, background: T.card, border: `0.5px solid ${T.brd}` }}>
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

function ModalGestionPartidas({ T, secciones, partidas, onClose, onSaved }: { T: ReturnType<typeof useTheme>['T']; secciones: Seccion[]; partidas: Partida[]; onClose: () => void; onSaved: () => void }) {
  const [seccionFiltro, setSeccionFiltro] = useState(secciones[0]?.id ?? '')
  const [nueva, setNueva] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const partidasSeccion = partidas.filter(p => p.seccion_id === seccionFiltro)
  async function crear() { if (!nueva.trim() || !seccionFiltro) return; await supabase.from('produccion_partidas').insert({ nombre: nueva.trim(), seccion_id: seccionFiltro, orden: 999 }); setNueva(''); onSaved() }
  async function renombrar(p: Partida) { if (!editNombre.trim()) return; await supabase.from('produccion_partidas').update({ nombre: editNombre.trim() }).eq('id', p.id); setEditId(null); onSaved() }
  async function eliminar(p: Partida) { if (!confirm(`¿Eliminar partida "${p.nombre}"?`)) return; await supabase.from('produccion_partidas').update({ activa: false }).eq('id', p.id); onSaved() }
  return (
    <div style={overlay} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalBox, background: T.card, border: `0.5px solid ${T.brd}`, width: 560 }}>
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
          <input value={nueva} onChange={e => setNueva(e.target.value)} onKeyDown={e => e.key === 'Enter' && crear()} placeholder="Nueva partida" style={{ ...inputStyle(T), flex: 1 }} />
          <button onClick={crear} style={btnPrimary}><Plus size={16} /> Añadir</button>
        </div>
        <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginBottom: 10 }}>Se reordena alfabéticamente al guardar.</div>
        {partidasSeccion.length === 0 && <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.mut, padding: '12px 0' }}>Sin partidas en esta sección.</div>}
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

// ─── ESTILOS BOTONES / MODALES ─────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: '#B01D23', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontFamily: FONT.body, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnGhost: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--sl-text-secondary)', border: '0.5px solid var(--sl-border)', borderRadius: 8, padding: '8px 14px', fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 500, cursor: 'pointer', letterSpacing: '0.04em' }
const inputStyle = (T: ReturnType<typeof useTheme>['T']): React.CSSProperties => ({ width: '100%', background: T.inp, border: `1px solid ${T.brd}`, borderRadius: 8, color: T.pri, fontFamily: FONT.body, fontSize: 13, padding: '8px 12px', outline: 'none' })
const lblStyle = (T: ReturnType<typeof useTheme>['T']): React.CSSProperties => ({ display: 'block', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 5 })
const iconBtn = (T: ReturnType<typeof useTheme>['T']): React.CSSProperties => ({ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 6, color: T.sec, cursor: 'pointer', padding: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' })
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
const modalBox: React.CSSProperties = { borderRadius: 16, width: 560, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }

// ─── CSS ────────────────────────────────────────────────────────────────────

const FICHA_CSS = `
.ficha-card { font-family: 'Lexend', sans-serif; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; color: var(--text-primary); overflow: hidden; display: flex; flex-direction: column; }
.ficha-head { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--sl-border-strong); }
.ficha-title { font-family: 'Oswald', sans-serif; font-weight: 500; font-size: 21px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-primary); }
.ficha-week { margin-left: auto; font-family: 'Oswald', sans-serif; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); }
.ficha-section { padding: 14px 20px; }

.prod-table-wrap { overflow-x: auto; }
.prod-table { width: 100%; border-collapse: separate; border-spacing: 0; font-family: 'Lexend', sans-serif; font-size: 13px; }
.prod-table th, .prod-table td { border-right: 1px solid var(--sl-border-strong); border-bottom: 1px solid var(--sl-border-strong); }
.prod-table th.dia-ini, .prod-table td.dia-ini { border-left: 3px solid #B01D23 !important; }

.th-partida { font-family: 'Oswald', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; text-align: left; padding: 6px 8px; background: #B01D23; color: #fff; min-width: 120px; }
.th-partida-ini { position: sticky; left: 0; z-index: 2; }
.th-dia { font-family: 'Oswald', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; text-align: center; padding: 5px 2px; background: #B01D23; color: #fff; }
.th-sub-empty { background: #8c161c; }
.th-sub { font-family: 'Oswald', sans-serif; font-size: 10px; font-weight: 600; text-align: center; padding: 2px 1px; color: #fff; }
.th-sub-hoy { background: #8c161c; }
.th-sub-ssp { background: #6e1116; color: #f0c9cb; }
.td-seccion { font-family: 'Oswald', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #B01D23; padding: 5px 8px; background: rgba(176,29,35,0.07); }

.td-partida { font-family: 'Lexend', sans-serif; font-size: 13.5px; color: var(--text-primary); padding: 1px 8px; white-space: nowrap; background: var(--bg-card); }
.td-partida-ini { position: sticky; left: 0; z-index: 1; }
.td-partida-fin { text-align: right; }
.td-celda { padding: 0; }
.td-celda-hoy { background: var(--bg-card); }
.td-celda-ssp { background: rgba(176,29,35,0.06); }
.celda-input { width: 100%; min-width: 34px; background: transparent; border: none; outline: none; font-family: 'Lexend', sans-serif; font-size: 14px; color: var(--text-primary); padding: 1px 3px; text-align: center; }
.celda-ssp { color: var(--text-muted); }
.celda-print { display: none; }

.vista-impresion { display: none; }

/* Carteles cámara — vista pantalla (preview) */
.camara-wrap { display: flex; flex-direction: column; gap: 20px; }
.cartel { border: 2px solid #B01D23; border-radius: 12px; overflow: hidden; background: var(--bg-card); }
.cartel-head { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 30px; letter-spacing: 0.04em; text-transform: uppercase; color: #fff; background: #B01D23; padding: 14px 22px; }
.cartel-list { list-style: none; margin: 0; padding: 18px 22px; }
.cartel-list.cols-2 { column-count: 2; column-gap: 40px; }
.cartel-item { font-family: 'Lexend', sans-serif; font-size: 22px; line-height: 1.7; color: var(--text-primary); break-inside: avoid; border-bottom: 1px dashed var(--sl-border); }

/* ───────── IMPRESIÓN ───────── */
@media print {
  html, body { background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body * { visibility: hidden; }
  .vista-impresion, .vista-impresion *, .camara-wrap, .camara-wrap * { visibility: visible; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .vista-pantalla, .no-print { display: none !important; }

  /* ---- Lista de producción ---- */
  .vista-impresion { display: block; position: absolute; left: 0; top: 0; width: 100%; color: #111; font-family: 'Lexend', sans-serif; }
  @page { size: A4 landscape; margin: 22mm 20mm 22mm 20mm; }
  .hoja { width: 100%; }
  .print-head { display: flex; align-items: baseline; gap: 14px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #9a3b42; }
  .print-title { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 18px; text-transform: uppercase; letter-spacing: 0.05em; color: #9a3b42; }
  .print-week { font-family: 'Oswald', sans-serif; font-size: 12px; text-transform: uppercase; color: #555; }
  .print-pag { margin-left: auto; font-family: 'Oswald', sans-serif; font-size: 12px; text-transform: uppercase; color: #555; }

  .prod-table-print { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 12px; }
  .prod-table-print th, .prod-table-print td { border-right: 1px solid #c9c9c9 !important; border-bottom: 1px solid #c9c9c9 !important; }
  .prod-table-print th.dia-ini, .prod-table-print td.dia-ini { border-left: 2.5px solid #cf7b81 !important; }

  /* Tonos SUAVES para que imprima bien en color y B/N */
  .th-seccion-print { font-family: 'Oswald', sans-serif; font-size: 12.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; text-align: left; color: #8a1a22 !important; background: #f0d8da !important; padding: 5px 8px !important; border: 1px solid #d9b3b6 !important; }
  .prod-table-print .th-partida { background: #f5e2e3 !important; color: #8a1a22 !important; padding: 4px 6px !important; position: static !important; font-size: 10.5px; min-width: 0; }
  .prod-table-print .th-dia { background: #f5e2e3 !important; color: #8a1a22 !important; padding: 3px 2px !important; font-size: 10.5px; }
  .prod-table-print .th-sub-empty { background: #f0d8da !important; position: static !important; }
  .prod-table-print .th-sub-hoy { background: #f0d8da !important; color: #8a1a22 !important; font-size: 9.5px; }
  .prod-table-print .th-sub-ssp { background: #e6c7ca !important; color: #7a1419 !important; font-size: 9.5px; }
  .prod-table-print .td-partida { color: #111 !important; background: #fff !important; padding: 2px 6px !important; position: static !important; font-size: 11px; }
  .prod-table-print .td-celda { padding: 0 !important; height: 20px; }
  .prod-table-print .td-celda-hoy { background: #fff !important; }
  .prod-table-print .td-celda-ssp { background: #f7eeef !important; }
  .prod-table-print .celda-print { display: inline !important; color: #111 !important; font-size: 11px; padding: 0 2px; }

  /* ---- Ordenación de cámara: un cartel por hoja A4 vertical ---- */
  .camara-wrap { display: block; position: absolute; left: 0; top: 0; width: 100%; }
  .cartel { page-break-after: always; break-after: page; border: 3px solid #B01D23 !important; border-radius: 10px; margin: 0 0 0 0; min-height: 250mm; }
  .cartel:last-child { page-break-after: auto; break-after: auto; }
  .cartel-head { font-size: 40px !important; background: #f0d8da !important; color: #8a1a22 !important; border-bottom: 3px solid #B01D23 !important; padding: 20px 26px !important; }
  .cartel-list { padding: 26px 30px !important; }
  .cartel-item { font-size: 30px !important; line-height: 2 !important; color: #111 !important; border-bottom: 1px solid #ccc !important; }
}
@media print { @page :first { margin: 22mm 20mm; } }
`
