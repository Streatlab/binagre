import { useState, useEffect, useMemo } from 'react'
import React from 'react'
import { ClipboardList, Printer, Plus, Trash2, X, Check, Pencil } from 'lucide-react'
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
interface Partida { id: string; seccion_id: string; nombre: string; orden: number; activa: boolean; biberon?: boolean }
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

// Agrupa por lado físico. Solo izquierda y derecha (lo demás no va en los carteles de cámara).
function agruparLados(secciones: Seccion[]): { titulo: string; secs: Seccion[] }[] {
  const izq = secciones.filter(s => s.nombre.toUpperCase().startsWith('IZQUIERDA'))
  const der = secciones.filter(s => s.nombre.toUpperCase().startsWith('DERECHA'))
  const grupos: { titulo: string; secs: Seccion[] }[] = []
  if (izq.length) grupos.push({ titulo: 'PARTE IZQUIERDA', secs: izq })
  if (der.length) grupos.push({ titulo: 'PARTE DERECHA', secs: der })
  return grupos
}

// Devuelve las filas de una lista de partidas insertando un subencabezado "Biberones:" antes del primer biberón
type FilaItem = { kind: 'sub'; label: string } | { kind: 'part'; part: Partida }
function conBiberones(parts: Partida[]): FilaItem[] {
  const out: FilaItem[] = []
  let metido = false
  for (const p of parts) {
    if (p.biberon && !metido) { out.push({ kind: 'sub', label: 'Biberones:' }); metido = true }
    out.push({ kind: 'part', part: p })
  }
  return out
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

  const filaPartidaPantalla = (part: Partida) => (
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
  )

  const filaPartidaImpresion = (part: Partida) => (
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
                      {conBiberones(partidas.filter(p => p.seccion_id === sec.id)).map((f, i) =>
                        f.kind === 'sub'
                          ? <tr key={`sub-${i}`} className="fila-bib"><td colSpan={TOTAL_COLS} className="td-bib">{f.label}</td></tr>
                          : filaPartidaPantalla(f.part)
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* VISTA IMPRESIÓN paginada */}
      <div className="vista-impresion lista-print">
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
                  {conBiberones(b.parts).map((f, i) =>
                    f.kind === 'sub'
                      ? <tr key={`sub-${i}`} className="fila-bib"><td colSpan={TOTAL_COLS} className="td-bib">{f.label}</td></tr>
                      : filaPartidaImpresion(f.part)
                  )}
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

// ─── TAB: ORDENACIÓN DE CÁMARA (2 hojas: izquierda / derecha) ──────────────────

function TabOrdenacionCamara({ T, secciones, partidas }: { T: ReturnType<typeof useTheme>['T']; secciones: Seccion[]; partidas: Partida[] }) {
  const grupos = useMemo(() => agruparLados(secciones), [secciones])

  return (
    <>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, maxWidth: 640 }}>
          Una hoja A4 por lado de la cámara (izquierda / derecha), con todas sus baldas y los productos en grande para pegar en la puerta.
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={() => window.print()} style={btnGhost}><Printer size={15} /> Imprimir / PDF</button>
        </div>
      </div>

      <div className="camara-wrap">
        {grupos.map((g, gi) => (
          <div key={gi} className="hoja-camara" style={{ breakAfter: gi < grupos.length - 1 ? 'page' : 'auto' }}>
            <div className="camara-lado-head">{g.titulo}</div>
            <div className="camara-cols" style={{ gridTemplateColumns: `repeat(${g.secs.length}, 1fr)` }}>
              {g.secs.map(sec => {
                const parts = partidas.filter(p => p.seccion_id === sec.id)
                const muchos = parts.length > 12
                return (
                  <div key={sec.id} className="camara-balda">
                    <div className="camara-balda-head">{sec.nombre}</div>
                    <ul className={`camara-balda-list ${muchos ? 'dos-cols' : ''}`}>
                      {conBiberones(parts).map((f, i) =>
                        f.kind === 'sub'
                          ? <li key={`sub-${i}`} className="camara-bib-head">{f.label}</li>
                          : <li key={f.part.id} className="camara-balda-item">{f.part.nombre}</li>
                      )}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
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
                <div style={{ flex: 1, fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{p.nombre}{p.biberon ? ' · biberón' : ''}</div>
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
.td-bib { font-family: 'Oswald', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #8a1a22; padding: 3px 8px 3px 20px; background: rgba(176,29,35,0.04); }

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

/* Carteles cámara — preview en pantalla */
.camara-wrap { display: flex; flex-direction: column; gap: 22px; }
.hoja-camara { border: 2px solid #B01D23; border-radius: 12px; overflow: hidden; background: var(--bg-card); }
.camara-lado-head { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 30px; letter-spacing: 0.05em; text-transform: uppercase; color: #fff; background: #B01D23; padding: 14px 22px; }
.camara-cols { display: grid; gap: 0; }
.camara-balda { border-right: 1px solid var(--sl-border); padding: 0 0 10px 0; }
.camara-balda:last-child { border-right: none; }
.camara-balda-head { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 18px; letter-spacing: 0.04em; text-transform: uppercase; color: #B01D23; padding: 10px 16px; border-bottom: 2px solid rgba(176,29,35,0.25); }
.camara-balda-list { list-style: none; margin: 0; padding: 10px 16px; }
.camara-balda-item { font-family: 'Lexend', sans-serif; font-size: 18px; line-height: 1.7; color: var(--text-primary); }
.camara-bib-head { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 17px; text-transform: uppercase; letter-spacing: 0.04em; color: #B01D23; margin-top: 6px; }
.camara-balda-list.dos-cols { column-count: 2; column-gap: 24px; }
.camara-balda-list.dos-cols .camara-balda-item, .camara-balda-list.dos-cols .camara-bib-head { break-inside: avoid; }

/* ───────── IMPRESIÓN ───────── */
@media print {
  @page { size: A4 landscape; }
  html, body { background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body * { visibility: hidden; }
  .vista-impresion, .vista-impresion *, .camara-wrap, .camara-wrap * { visibility: visible; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .vista-pantalla, .no-print { display: none !important; }

  /* ---- Lista de producción ---- */
  .lista-print { display: block; position: absolute; left: 0; top: 0; width: 100%; color: #111; font-family: 'Lexend', sans-serif; }
  .lista-print .hoja { width: 100%; }
  .print-head { display: flex; align-items: baseline; gap: 14px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #9a3b42; }
  .print-title { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 18px; text-transform: uppercase; letter-spacing: 0.05em; color: #9a3b42; }
  .print-week { font-family: 'Oswald', sans-serif; font-size: 12px; text-transform: uppercase; color: #555; }
  .print-pag { margin-left: auto; font-family: 'Oswald', sans-serif; font-size: 12px; text-transform: uppercase; color: #555; }

  .prod-table-print { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 12px; }
  .prod-table-print th, .prod-table-print td { border-right: 1px solid #c9c9c9 !important; border-bottom: 1px solid #c9c9c9 !important; }
  .prod-table-print th.dia-ini, .prod-table-print td.dia-ini { border-left: 2.5px solid #cf7b81 !important; }
  .th-seccion-print { font-family: 'Oswald', sans-serif; font-size: 12.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; text-align: left; color: #8a1a22 !important; background: #f0d8da !important; padding: 5px 8px !important; border: 1px solid #d9b3b6 !important; }
  .prod-table-print .th-partida { background: #f5e2e3 !important; color: #8a1a22 !important; padding: 4px 6px !important; position: static !important; font-size: 10.5px; min-width: 0; }
  .prod-table-print .th-dia { background: #f5e2e3 !important; color: #8a1a22 !important; padding: 3px 2px !important; font-size: 10.5px; }
  .prod-table-print .th-sub-empty { background: #f0d8da !important; position: static !important; }
  .prod-table-print .th-sub-hoy { background: #f0d8da !important; color: #8a1a22 !important; font-size: 9.5px; }
  .prod-table-print .th-sub-ssp { background: #e6c7ca !important; color: #7a1419 !important; font-size: 9.5px; }
  .prod-table-print .td-partida { color: #111 !important; background: #fff !important; padding: 2px 6px !important; position: static !important; font-size: 11px; }
  .prod-table-print .td-bib { color: #8a1a22 !important; background: #f7eeef !important; font-size: 10px; padding: 2px 6px 2px 18px !important; }
  .prod-table-print .td-celda { padding: 0 !important; height: 20px; }
  .prod-table-print .td-celda-hoy { background: #fff !important; }
  .prod-table-print .td-celda-ssp { background: #f7eeef !important; }
  .prod-table-print .celda-print { display: inline !important; color: #111 !important; font-size: 11px; padding: 0 2px; }

  /* ---- Ordenación de cámara: 1 hoja A4 horizontal por lado ---- */
  .camara-wrap { display: block; position: absolute; left: 0; top: 0; width: 100%; }
  .hoja-camara { border: 3px solid #B01D23 !important; border-radius: 8px; overflow: hidden; page-break-after: always; break-after: page; height: 176mm; display: flex; flex-direction: column; }
  .hoja-camara:last-child { page-break-after: auto; break-after: auto; }
  .camara-lado-head { font-size: 40px !important; background: #f0d8da !important; color: #8a1a22 !important; border-bottom: 3px solid #B01D23 !important; padding: 12px 22px !important; flex: 0 0 auto; }
  .camara-cols { display: grid; flex: 1 1 auto; gap: 0; min-height: 0; }
  .camara-balda { border-right: 2px solid #d9b3b6 !important; padding: 0; display: flex; flex-direction: column; min-height: 0; }
  .camara-balda:last-child { border-right: none; }
  .camara-balda-head { font-size: 22px !important; color: #8a1a22 !important; background: #faf0f1 !important; border-bottom: 2px solid #e0bcc0 !important; padding: 7px 14px !important; flex: 0 0 auto; }
  .camara-balda-list { padding: 10px 16px !important; flex: 1 1 auto; }
  .camara-balda-item { font-size: 26px !important; line-height: 1.7 !important; color: #111 !important; }
  .camara-bib-head { font-size: 22px !important; color: #8a1a22 !important; margin-top: 4px; }
  .camara-balda-list.dos-cols { column-count: 2; column-gap: 16px; padding: 10px 14px !important; }
  .camara-balda-list.dos-cols .camara-balda-item { font-size: 21px !important; line-height: 1.5 !important; break-inside: avoid; }
  .camara-balda-list.dos-cols .camara-bib-head { font-size: 19px !important; break-inside: avoid; }
}
`
