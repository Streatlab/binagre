import { useState, useEffect, useMemo, useRef } from 'react'
import { LayoutGrid, Mic, Printer, Plus, Trash2, X, Check, Pencil, Tags, Archive, History } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, tituloPaginaStyle } from '@/styles/tokens'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

type TipoLinea = 'ing' | 'accion'
interface Linea { tipo: TipoLinea; texto: string }
interface Esquema {
  id: string
  gama: string
  nombre: string
  orden_gama: number
  lineas: Linea[]
  activo: boolean
  version: number
  estado: string
  archivado_at: string | null
  updated_at: string
}
interface Gama { id: string; nombre: string; orden: number; activo: boolean }

// Aparatos de cocción para el selector rápido de nubes
const APARATOS = ['MICRO', 'FREIDORA', 'SARTÉN', 'PLANCHA', 'HORNO'] as const

const ACCION_RE = /\b(MICRO|FREIDORA|SART[ÉE]N|PLANCHA|HORNO|FRE[ÍI]R)\b/i
function esAccion(texto: string) { return ACCION_RE.test(texto) }

// Normaliza una frase a línea (tiempos y abreviaturas)
function normalizarLinea(raw: string): Linea {
  let t = raw.trim()
  t = t.replace(/(\d+(?:[.,]\d+)?)\s*minutos?\s*(de\s*)?(microondas|micro)/i, 'MICRO $1 MIN')
       .replace(/(microondas|micro)\s*(?:durante\s*)?(\d+(?:[.,]\d+)?)\s*minutos?/i, 'MICRO $2 MIN')
       .replace(/(\d+)\s*minutos?\s*(en\s*(la\s*)?)?freidora/i, 'FREIDORA $1 MIN')
       .replace(/freidora\s*(?:durante\s*)?(\d+)\s*minutos?/i, 'FREIDORA $1 MIN')
       .replace(/(\d+)\s*minutos?\s*(en\s*(la\s*)?)?plancha/i, 'PLANCHA $1 MIN')
       .replace(/plancha\s*(?:durante\s*)?(\d+)\s*minutos?/i, 'PLANCHA $1 MIN')
       .replace(/(\d+)\s*minutos?\s*(en\s*(la\s*)?)?sart[ée]n/i, 'SARTÉN $1 MIN')
  t = t.replace(/\bcucharada\s+sopera\b/gi, 'c.s.')
       .replace(/\bcucharadita\s+de\s+caf[ée]\b/gi, 'c.c.')
       .replace(/\bcucharadas?\b/gi, 'c.s.')
       .replace(/\bgramos?\b/gi, 'gr.')
  return { tipo: esAccion(t) ? 'accion' : 'ing', texto: t.charAt(0).toUpperCase() + t.slice(1) }
}

// Trocea SOLO los ingredientes (sin intentar adivinar el nombre)
function trocearIngredientes(texto: string): Linea[] {
  return texto.replace(/\s+/g, ' ').trim()
    .split(/[,.;\n]|\sy\s/).map(s => s.trim()).filter(Boolean)
    .map(normalizarLinea)
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function Esquemas() {
  const { T, isDark } = useTheme()
  const [esquemas, setEsquemas] = useState<Esquema[]>([])
  const [gamas, setGamas] = useState<Gama[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gamaActiva, setGamaActiva] = useState<string>('')
  const [verHistorico, setVerHistorico] = useState(false)
  const [editando, setEditando] = useState<Esquema | 'nuevo' | null>(null)
  const [gestorGamas, setGestorGamas] = useState(false)
  const [imprimiendoTodo, setImprimiendoTodo] = useState(false)

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    if (!imprimiendoTodo) return
    const after = () => setImprimiendoTodo(false)
    window.addEventListener('afterprint', after)
    const t = setTimeout(() => window.print(), 350)
    return () => { clearTimeout(t); window.removeEventListener('afterprint', after) }
  }, [imprimiendoTodo])

  async function cargar() {
    setLoading(true)
    const [{ data: esq, error: e1 }, { data: gms }] = await Promise.all([
      supabase.from('esquemas_cocina').select('*').order('gama').order('orden_gama'),
      supabase.from('esquemas_gamas').select('*').eq('activo', true).order('orden').order('nombre'),
    ])
    if (e1) setError(e1.message)
    else {
      const list = (esq as Esquema[]) ?? []
      setEsquemas(list)
      const gmList = (gms as Gama[]) ?? []
      setGamas(gmList)
      if (!gamaActiva && gmList.length) setGamaActiva(gmList[0].nombre)
    }
    setLoading(false)
  }

  const visibles = useMemo(() =>
    esquemas.filter(e => e.gama === gamaActiva && (verHistorico ? e.estado !== 'vigente' : e.estado === 'vigente'))
    , [esquemas, gamaActiva, verHistorico])

  function imprimir() { window.print() }
  function imprimirTodo() { setImprimiendoTodo(true) }

  if (loading) return <div style={{ padding: 32, color: T.sec, fontFamily: FONT.body }}>Cargando esquemas…</div>
  if (error) return <div style={{ padding: 32, color: '#B01D23', fontFamily: FONT.body }}>{error}</div>

  const todasGamasVigentes = gamas
    .map(g => ({ g, platos: esquemas.filter(e => e.gama === g.nombre && e.estado === 'vigente') }))
    .filter(x => x.platos.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{PRINT_CSS}</style>

      {/* HEADER */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <LayoutGrid size={24} color="#B01D23" />
        <div style={tituloPaginaStyle(T)}>Esquemas de cocina</div>
        <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>Orden de montaje del tapper · arriba → abajo</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setEditando('nuevo')} style={btnPrimary}><Plus size={16} /> Nuevo plato</button>
          <button onClick={() => setGestorGamas(true)} style={btnGhost(T)}><Tags size={16} /> Gamas</button>
          <button onClick={() => setVerHistorico(v => !v)} style={verHistorico ? btnPrimary : btnGhost(T)}><History size={16} /> {verHistorico ? 'Ver vigentes' : 'Histórico'}</button>
          <button onClick={imprimir} style={btnGhost(T)}><Printer size={16} /> Imprimir / PDF</button>
          <button onClick={imprimirTodo} style={btnPrimary}><Printer size={16} /> Imprimir todo (PDF)</button>
        </div>
      </div>

      {/* TABS GAMA */}
      <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {gamas.map(g => (
          <button key={g.id} onClick={() => setGamaActiva(g.nombre)} style={tabStyle(g.nombre === gamaActiva, T)}>{g.nombre}</button>
        ))}
      </div>

      {/* ÁREA DE IMPRESIÓN */}
      {imprimiendoTodo ? (
        <div className="print-area">
          {todasGamasVigentes.map(({ g, platos }, gi) => (
            <div key={g.id} style={{ breakBefore: gi > 0 ? 'page' : 'auto' }}>
              <div className="print-gama">{g.nombre}</div>
              <div className="print-grid esquemas-masonry">
                {platos.map(e => <TarjetaEsquema key={e.id} esquema={e} T={T} isDark={isDark} onEdit={() => {}} onChange={cargar} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="print-area">
          <div className="solo-print" style={{ display: 'none' }}>
            <div className="print-gama">{gamaActiva}{verHistorico ? ' · Histórico' : ''}</div>
          </div>
          <div className="print-grid esquemas-masonry">
            {visibles.length === 0
              ? <div className="no-print" style={{ padding: 30, color: T.mut, fontFamily: FONT.body, fontSize: 14 }}>Sin platos {verHistorico ? 'en histórico' : 'vigentes'} en esta gama.</div>
              : visibles.map(e => <TarjetaEsquema key={e.id} esquema={e} T={T} isDark={isDark} onEdit={() => setEditando(e)} onChange={cargar} />)}
          </div>
        </div>
      )}

      {editando && (
        <ModalFicha
          T={T}
          esquema={editando === 'nuevo' ? null : editando}
          gamaDefault={gamaActiva}
          gamas={gamas}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); cargar() }}
        />
      )}
      {gestorGamas && <ModalGamas T={T} gamas={gamas} onClose={() => setGestorGamas(false)} onSaved={cargar} />}
    </div>
  )
}

// ─── TARJETA (estilo Green uniforme) ───────────────────────────────────────────

function TarjetaEsquema({ esquema: e, T, isDark, onEdit, onChange }: { esquema: Esquema; T: ReturnType<typeof useTheme>['T']; isDark: boolean; onEdit: () => void; onChange: () => void }) {
  async function descatalogar() {
    if (!confirm(`¿Descatalogar "${e.nombre}"? Pasará al histórico, no se borra.`)) return
    await supabase.from('esquemas_cocina').update({ estado: 'descatalogado', archivado_at: new Date().toISOString() }).eq('id', e.id)
    onChange()
  }
  async function restaurar() {
    await supabase.from('esquemas_cocina').update({ estado: 'vigente', archivado_at: null }).eq('id', e.id)
    onChange()
  }
  const archivado = e.estado !== 'vigente'

  return (
    <div className="print-card esquema-card" style={{ background: T.card, border: `2px solid ${isDark ? T.brd : '#1a1a1a'}`, borderRadius: 9, overflow: 'hidden', position: 'relative', opacity: archivado ? 0.7 : 1 }}>
      <div className="no-print" style={{ position: 'absolute', top: 3, right: 3, display: 'flex', gap: 2 }}>
        {!archivado && <button onClick={onEdit} style={iconBtn(T)} title="Editar"><Pencil size={12} /></button>}
        {!archivado
          ? <button onClick={descatalogar} style={iconBtn(T)} title="Descatalogar"><Archive size={12} /></button>
          : <button onClick={restaurar} style={iconBtn(T)} title="Restaurar"><Check size={12} /></button>}
      </div>
      <div className="print-head" style={{ background: isDark ? '#1e2233' : '#e2e2e2', color: isDark ? T.pri : '#1a1a1a', fontFamily: "'Anton','Oswald',sans-serif", fontSize: 30, fontWeight: 400, lineHeight: 1, textAlign: 'center', padding: '6px 8px 5px', letterSpacing: '0.5px', borderBottom: `2px solid #1a1a1a` }}>{e.nombre}</div>
      <div style={{ padding: '5px 9px 6px' }}>
        {e.lineas.map((l, i) => l.tipo === 'accion'
          ? <div key={i} className="print-act" style={{ background: 'transparent', color: isDark ? T.pri : '#1a1a1a', fontFamily: FONT.heading, fontSize: 15, fontWeight: 600, textAlign: 'center', borderTop: `2px solid ${isDark ? T.brd : '#1a1a1a'}`, borderBottom: `2px solid ${isDark ? T.brd : '#1a1a1a'}`, padding: '2px 0', margin: '5px 8px', letterSpacing: '1px' }}>{l.texto}</div>
          : <div key={i} className="print-ing" style={{ fontFamily: "'Barlow Semi Condensed','Oswald',sans-serif", fontWeight: 600, fontSize: 16, lineHeight: 1.1, textAlign: 'center', padding: '0', color: isDark ? T.pri : '#1a1a1a' }}>{l.texto}</div>
        )}
      </div>
      {archivado && e.archivado_at && (
        <div className="no-print" style={{ fontFamily: FONT.body, fontSize: 10, color: T.mut, textAlign: 'center', padding: '2px 0 5px' }}>
          Archivado {new Date(e.archivado_at).toLocaleDateString('es-ES')}
        </div>
      )}
    </div>
  )
}

// ─── MODAL FICHA (crear / editar · rompecabezas + dictado) ──────────────────────

function ModalFicha({ T, esquema, gamaDefault, gamas, onClose, onSaved }: { T: ReturnType<typeof useTheme>['T']; esquema: Esquema | null; gamaDefault: string; gamas: Gama[]; onClose: () => void; onSaved: () => void }) {
  const edicion = !!esquema
  const [nombre, setNombre] = useState(esquema?.nombre ?? '')
  const [gamaSel, setGamaSel] = useState(esquema?.gama ?? gamaDefault ?? gamas[0]?.nombre ?? '')
  const [lineas, setLineas] = useState<Linea[]>(esquema?.lineas ?? [])
  const [guardando, setGuardando] = useState(false)

  // dictado de ingredientes (paso 2, NO toca el nombre)
  const [dictado, setDictado] = useState('')
  const [escuchando, setEscuchando] = useState(false)
  const recRef = useRef<any>(null)

  function toggleVoz() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Tu navegador no soporta dictado por voz. Escribe los ingredientes a mano.'); return }
    if (escuchando) { recRef.current?.stop(); setEscuchando(false); return }
    const rec = new SR()
    rec.lang = 'es-ES'; rec.continuous = true; rec.interimResults = true
    rec.onresult = (ev: any) => {
      let full = ''
      for (let i = 0; i < ev.results.length; i++) full += ev.results[i][0].transcript + ' '
      setDictado(full.trim())
    }
    rec.onend = () => setEscuchando(false)
    rec.start(); recRef.current = rec; setEscuchando(true)
  }

  function añadirDesdeDictado() {
    const nuevas = trocearIngredientes(dictado)
    if (nuevas.length) { setLineas(prev => [...prev, ...nuevas]); setDictado('') }
  }

  function editarLinea(i: number, texto: string) { setLineas(prev => prev.map((l, idx) => idx === i ? { ...l, texto } : l)) }
  function toggleTipo(i: number) { setLineas(prev => prev.map((l, idx) => idx === i ? { ...l, tipo: l.tipo === 'ing' ? 'accion' : 'ing' } : l)) }
  function borrarLinea(i: number) { setLineas(prev => prev.filter((_, idx) => idx !== i)) }
  function moverLinea(i: number, dir: -1 | 1) {
    setLineas(prev => { const a = [...prev]; const j = i + dir; if (j < 0 || j >= a.length) return prev;[a[i], a[j]] = [a[j], a[i]]; return a })
  }
  function añadirIng() { setLineas(prev => [...prev, { tipo: 'ing', texto: '' }]) }
  function añadirNube(aparato: string) { setLineas(prev => [...prev, { tipo: 'accion', texto: `${aparato} ` }]) }

  async function guardar() {
    if (!nombre.trim() || !gamaSel) { alert('Falta nombre o gama'); return }
    const limpias = lineas.filter(l => l.texto.trim())
    setGuardando(true)

    if (edicion && esquema) {
      // VERSIONADO: archiva la versión actual con fecha, crea la nueva como vigente
      await supabase.from('esquemas_cocina').update({ estado: 'archivado', activo: false, archivado_at: new Date().toISOString() }).eq('id', esquema.id)
      await supabase.from('esquemas_cocina').insert({
        gama: gamaSel, nombre: nombre.toUpperCase().trim(), orden_gama: esquema.orden_gama,
        lineas: limpias, version: (esquema.version ?? 1) + 1, estado: 'vigente', activo: true,
      })
    } else {
      const { data: max } = await supabase.from('esquemas_cocina').select('orden_gama').eq('gama', gamaSel).order('orden_gama', { ascending: false }).limit(1)
      const orden = ((max?.[0]?.orden_gama as number) ?? 0) + 1
      await supabase.from('esquemas_cocina').insert({ gama: gamaSel, nombre: nombre.toUpperCase().trim(), orden_gama: orden, lineas: limpias })
    }
    setGuardando(false); onSaved()
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div onClick={ev => ev.stopPropagation()} style={{ ...modalBox, background: T.card, border: `0.5px solid ${T.brd}` }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 18, color: '#B01D23', letterSpacing: '1px', textTransform: 'uppercase' }}>{edicion ? 'Editar plato' : 'Nuevo plato'}</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: T.mut }}><X size={20} /></button>
        </div>

        {edicion && <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginBottom: 12 }}>Al guardar, la versión actual se archiva en el histórico con su fecha. Esta pasa a ser la vigente.</div>}

        {/* Nombre + gama */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 2 }}>
            <label style={lblStyle(T)}>Nombre del plato</label>
            <input value={nombre} onChange={ev => setNombre(ev.target.value)} placeholder="Ej: Pollo karaage limón" style={inputStyle(T)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lblStyle(T)}>Gama</label>
            <select value={gamaSel} onChange={ev => setGamaSel(ev.target.value)} style={inputStyle(T)}>
              {gamas.map(g => <option key={g.id} value={g.nombre}>{g.nombre}</option>)}
            </select>
          </div>
        </div>

        {/* LÍNEAS — rompecabezas */}
        <label style={lblStyle(T)}>Ingredientes y pasos (orden de montaje)</label>
        <div style={{ marginBottom: 8 }}>
          {lineas.map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <button onClick={() => moverLinea(i, -1)} style={miniBtn(T)}>▲</button>
                <button onClick={() => moverLinea(i, 1)} style={miniBtn(T)}>▼</button>
              </div>
              <input value={l.texto} onChange={ev => editarLinea(i, ev.target.value)}
                style={{ ...inputStyle(T), flex: 1, fontWeight: l.tipo === 'accion' ? 700 : 400 }} />
              <button onClick={() => toggleTipo(i)} title="Ingrediente / Acción"
                style={{ ...miniBtn(T), background: l.tipo === 'accion' ? '#1a1a1a' : 'transparent', color: l.tipo === 'accion' ? '#fff' : T.sec, padding: '4px 8px', width: 'auto', fontSize: 11 }}>
                {l.tipo === 'accion' ? 'Nube' : 'Ingr.'}
              </button>
              <button onClick={() => borrarLinea(i)} style={{ ...miniBtn(T), color: '#B01D23' }}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>

        {/* Añadir ingrediente / nubes rápidas */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <button onClick={añadirIng} style={btnGhost(T)}><Plus size={14} /> Ingrediente</button>
          {APARATOS.map(a => (
            <button key={a} onClick={() => añadirNube(a)} style={{ ...btnGhost(T), fontSize: 12 }}>+ {a}</button>
          ))}
        </div>

        {/* Dictado SOLO ingredientes */}
        <div style={{ border: `0.5px dashed ${T.brd}`, borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <label style={lblStyle(T)}>Dictar ingredientes (se añaden a la lista, no tocan el nombre)</label>
          <textarea value={dictado} onChange={ev => setDictado(ev.target.value)} rows={2}
            placeholder="Ej: tres trozos de pollo crujiente, arroz blanco, tres minutos microondas, salsa de limón, furikake"
            style={{ ...inputStyle(T), resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={toggleVoz} style={escuchando ? btnPrimary : btnGhost(T)}><Mic size={16} /> {escuchando ? 'Detener' : 'Hablar'}</button>
            <button onClick={añadirDesdeDictado} style={btnGhost(T)}><Check size={16} /> Añadir a la lista</button>
          </div>
        </div>

        <button onClick={guardar} disabled={guardando} style={{ ...btnPrimary, width: '100%', justifyContent: 'center', opacity: guardando ? 0.6 : 1 }}>
          {guardando ? 'Guardando…' : (edicion ? 'Guardar cambios' : 'Crear plato')}
        </button>
      </div>
    </div>
  )
}

// ─── MODAL GESTOR DE GAMAS ──────────────────────────────────────────────────────

function ModalGamas({ T, gamas, onClose, onSaved }: { T: ReturnType<typeof useTheme>['T']; gamas: Gama[]; onClose: () => void; onSaved: () => void }) {
  const [nueva, setNueva] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')

  async function crear() {
    if (!nueva.trim()) return
    await supabase.from('esquemas_gamas').insert({ nombre: nueva.trim(), orden: gamas.length })
    setNueva(''); onSaved()
  }
  async function renombrar(g: Gama) {
    if (!editNombre.trim()) return
    // renombra la gama y todos sus platos
    await supabase.from('esquemas_gamas').update({ nombre: editNombre.trim() }).eq('id', g.id)
    await supabase.from('esquemas_cocina').update({ gama: editNombre.trim() }).eq('gama', g.nombre)
    setEditId(null); onSaved()
  }
  async function eliminar(g: Gama) {
    if (!confirm(`¿Eliminar la gama "${g.nombre}"? Los platos NO se borran, quedan en histórico.`)) return
    await supabase.from('esquemas_gamas').update({ activo: false }).eq('id', g.id)
    await supabase.from('esquemas_cocina').update({ estado: 'descatalogado', archivado_at: new Date().toISOString() }).eq('gama', g.nombre).eq('estado', 'vigente')
    onSaved()
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div onClick={ev => ev.stopPropagation()} style={{ ...modalBox, width: 460, background: T.card, border: `0.5px solid ${T.brd}` }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 18, color: '#B01D23', letterSpacing: '1px', textTransform: 'uppercase' }}>Gamas</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: T.mut }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={nueva} onChange={ev => setNueva(ev.target.value)} placeholder="Nueva gama (ej: Italiana)" style={{ ...inputStyle(T), flex: 1 }} />
          <button onClick={crear} style={btnPrimary}><Plus size={16} /> Crear</button>
        </div>

        {gamas.map(g => (
          <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {editId === g.id ? (
              <>
                <input value={editNombre} onChange={ev => setEditNombre(ev.target.value)} style={{ ...inputStyle(T), flex: 1 }} />
                <button onClick={() => renombrar(g)} style={iconBtn(T)} title="Guardar"><Check size={14} /></button>
                <button onClick={() => setEditId(null)} style={iconBtn(T)} title="Cancelar"><X size={14} /></button>
              </>
            ) : (
              <>
                <div style={{ flex: 1, fontFamily: FONT.body, fontSize: 14, color: T.pri }}>{g.nombre}</div>
                <button onClick={() => { setEditId(g.id); setEditNombre(g.nombre) }} style={iconBtn(T)} title="Renombrar"><Pencil size={13} /></button>
                <button onClick={() => eliminar(g)} style={{ ...iconBtn(T), color: '#B01D23' }} title="Eliminar"><Trash2 size={13} /></button>
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
const btnGhost = (T: ReturnType<typeof useTheme>['T']): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: T.sec, border: `0.5px solid ${T.brd}`, borderRadius: 8, padding: '8px 14px', fontFamily: FONT.body, fontSize: 13, fontWeight: 500, cursor: 'pointer' })
const tabStyle = (active: boolean, T: ReturnType<typeof useTheme>['T']): React.CSSProperties => ({ padding: '6px 14px', borderRadius: 99, border: active ? 'none' : `0.5px solid ${T.brd}`, background: active ? '#B01D23' : 'transparent', color: active ? '#fff' : T.sec, fontFamily: FONT.body, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' })
const lblStyle = (T: ReturnType<typeof useTheme>['T']): React.CSSProperties => ({ display: 'block', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 5 })
const inputStyle = (T: ReturnType<typeof useTheme>['T']): React.CSSProperties => ({ width: '100%', background: T.inp, border: `1px solid ${T.brd}`, borderRadius: 8, color: T.pri, fontFamily: FONT.body, fontSize: 13, padding: '8px 12px', outline: 'none' })
const miniBtn = (T: ReturnType<typeof useTheme>['T']): React.CSSProperties => ({ background: 'transparent', border: `0.5px solid ${T.brd}`, borderRadius: 6, color: T.sec, cursor: 'pointer', fontSize: 10, lineHeight: 1, padding: '2px 5px', width: 24 })
const iconBtn = (T: ReturnType<typeof useTheme>['T']): React.CSSProperties => ({ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 6, color: T.sec, cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' })
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
const modalBox: React.CSSProperties = { borderRadius: 16, width: 600, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }

// Vista: masonry uniforme (tarjetas mismo ancho, fluyen sin huecos). Impresión: A4 vertical B/N compacto.
const PRINT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Semi+Condensed:wght@500;600;700&display=swap');
.esquemas-masonry { column-count: 4; column-gap: 14px; }
.esquemas-masonry .esquema-card { break-inside: avoid; margin-bottom: 14px; display: inline-block; width: 100%; }
@media (max-width: 1100px) { .esquemas-masonry { column-count: 3; } }
@media (max-width: 800px)  { .esquemas-masonry { column-count: 2; } }
@media (max-width: 520px)  { .esquemas-masonry { column-count: 1; } }

@media print {
  @page { size: A4 portrait; margin: 6mm; }
  body * { visibility: hidden; }
  .print-area, .print-area * { visibility: visible; }
  .no-print { display: none !important; }
  .solo-print { display: block !important; }
  .print-area { position: absolute; left: 0; right: 0; top: 0; padding: 10mm; box-sizing: border-box; }
  .print-gama { font-family: Oswald, sans-serif; font-size: 30px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #fff; background: #1a1a1a; text-align: center; margin: 0 0 13px; padding: 9px 8px; border-radius: 3px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-grid { column-count: 3 !important; column-gap: 15px; }
  .print-card { break-inside: avoid; margin-bottom: 16px; border: 1.5px solid #1a1a1a !important; border-radius: 6px; box-sizing: border-box; }
  .print-head { background: #e2e2e2 !important; color: #1a1a1a !important; font-family: 'Anton','Oswald',sans-serif !important; font-size: 31px !important; font-weight: 400 !important; line-height: 1 !important; letter-spacing: 0.5px !important; border-bottom: 2px solid #1a1a1a !important; padding: 6px 8px 5px !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-act { background: transparent !important; color: #1a1a1a !important; border-top: 2px solid #1a1a1a !important; border-bottom: 2px solid #1a1a1a !important; border-radius: 0 !important; margin: 5px 8px !important; }
  .print-ing { color: #1a1a1a !important; font-family: 'Barlow Semi Condensed','Oswald',sans-serif !important; font-weight: 600 !important; font-size: 16px !important; line-height: 1.1 !important; }
}
`
