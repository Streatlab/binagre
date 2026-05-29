import { useState, useEffect, useMemo, useRef } from 'react'
import { LayoutGrid, Mic, Printer, Plus, Trash2, GripVertical, X, Check } from 'lucide-react'
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
}

// Detección de acción (micro/freidora/sartén/plancha/horno)
const ACCION_RE = /\b(MICRO|FREIDORA|SART[ÉE]N|PLANCHA|HORNO|FRE[ÍI]R)\b/i
function esAccion(texto: string) { return ACCION_RE.test(texto) }

// Normaliza una frase dictada → línea con tipo
function normalizarLinea(raw: string): Linea {
  let t = raw.trim()
  // tiempos hablados → formato corto
  t = t.replace(/(\d+(?:[.,]\d+)?)\s*minutos?\s*(de\s*)?(microondas|micro)/i, 'MICRO $1 MIN')
       .replace(/(microondas|micro)\s*(\d+(?:[.,]\d+)?)\s*minutos?/i, 'MICRO $2 MIN')
       .replace(/(\d+)\s*minutos?\s*(en\s*)?freidora/i, 'FREIDORA $1 MIN')
       .replace(/freidora\s*(\d+)\s*minutos?/i, 'FREIDORA $1 MIN')
       .replace(/(\d+)\s*minutos?\s*(en\s*)?plancha/i, 'PLANCHA $1 MIN')
       .replace(/(\d+)\s*minutos?\s*(en\s*)?sart[ée]n/i, 'SARTÉN $1 MIN')
  // abreviaturas habituales
  t = t.replace(/\bcucharada\s+sopera\b/gi, 'c.s.')
       .replace(/\bcucharadita\s+de\s+caf[ée]\b/gi, 'c.c.')
       .replace(/\bcucharadas?\b/gi, 'c.s.')
       .replace(/\bgramos?\b/gi, 'gr.')
  return { tipo: esAccion(t) ? 'accion' : 'ing', texto: t.charAt(0).toUpperCase() + t.slice(1) }
}

// Parser de texto dictado completo → esquema
function parsearDictado(texto: string): { nombre: string; lineas: Linea[] } {
  const limpio = texto.replace(/\s+/g, ' ').trim()
  // nombre: "se llama X" o primera frase antes de coma/punto
  let nombre = ''
  const m = limpio.match(/se llama\s+([^,.]+)/i)
  if (m) nombre = m[1].trim()
  let cuerpo = limpio
  if (m) cuerpo = limpio.slice((m.index ?? 0) + m[0].length)
  else {
    const corte = limpio.search(/[,.]/)
    nombre = corte > 0 ? limpio.slice(0, corte).trim() : limpio
    cuerpo = corte > 0 ? limpio.slice(corte + 1) : ''
  }
  const partes = cuerpo.split(/[,.;\n]|\sy\s/).map(s => s.trim()).filter(Boolean)
  return { nombre: nombre.toUpperCase(), lineas: partes.map(normalizarLinea) }
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function Esquemas() {
  const { T, isDark } = useTheme()
  const [esquemas, setEsquemas] = useState<Esquema[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gamaActiva, setGamaActiva] = useState<string>('')
  const [modalAbierto, setModalAbierto] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data, error: e } = await supabase
      .from('esquemas_cocina')
      .select('id,gama,nombre,orden_gama,lineas,activo')
      .eq('activo', true)
      .order('gama')
      .order('orden_gama')
    if (e) setError(e.message)
    else {
      const list = (data as Esquema[]) ?? []
      setEsquemas(list)
      if (!gamaActiva && list.length) setGamaActiva(list[0].gama)
    }
    setLoading(false)
  }

  const gamas = useMemo(() => [...new Set(esquemas.map(e => e.gama))], [esquemas])
  const visibles = useMemo(() => esquemas.filter(e => e.gama === gamaActiva), [esquemas, gamaActiva])

  function imprimir() { window.print() }

  if (loading) return <div style={{ padding: 32, color: T.sec, fontFamily: FONT.body }}>Cargando esquemas…</div>
  if (error) return <div style={{ padding: 32, color: '#B01D23', fontFamily: FONT.body }}>{error}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{PRINT_CSS}</style>

      {/* HEADER (no imprime) */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <LayoutGrid size={24} color="#B01D23" />
        <div style={tituloPaginaStyle(T)}>Esquemas de cocina</div>
        <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>Orden de montaje del tapper · arriba → abajo</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => setModalAbierto(true)} style={btnPrimary}><Mic size={16} /> Dictar plato</button>
          <button onClick={imprimir} style={btnGhost(T)}><Printer size={16} /> Imprimir / PDF</button>
        </div>
      </div>

      {/* TABS GAMA (no imprime) */}
      <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {gamas.map(g => (
          <button key={g} onClick={() => setGamaActiva(g)} style={tabStyle(g === gamaActiva, T)}>{g}</button>
        ))}
      </div>

      {/* TÍTULO IMPRESIÓN (solo imprime) */}
      <div className="solo-print" style={{ display: 'none' }}>
        <div className="print-gama">{gamaActiva}</div>
      </div>

      {/* GRID TARJETAS */}
      <div className="print-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {visibles.map(e => <TarjetaEsquema key={e.id} esquema={e} T={T} isDark={isDark} onChange={cargar} />)}
      </div>

      {modalAbierto && <ModalDictado T={T} gama={gamaActiva} gamas={gamas} onClose={() => setModalAbierto(false)} onSaved={() => { setModalAbierto(false); cargar() }} />}
    </div>
  )
}

// ─── TARJETA ──────────────────────────────────────────────────────────────────

function TarjetaEsquema({ esquema: e, T, isDark, onChange }: { esquema: Esquema; T: ReturnType<typeof useTheme>['T']; isDark: boolean; onChange: () => void }) {
  async function borrar() {
    if (!confirm(`¿Eliminar "${e.nombre}"?`)) return
    await supabase.from('esquemas_cocina').update({ activo: false }).eq('id', e.id)
    onChange()
  }
  return (
    <div className="print-card" style={{ background: T.card, border: `2px solid ${isDark ? T.brd : '#1a1a1a'}`, borderRadius: 9, overflow: 'hidden', position: 'relative' }}>
      <button onClick={borrar} className="no-print" style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', cursor: 'pointer', color: T.mut, padding: 4 }} title="Eliminar"><Trash2 size={13} /></button>
      <div className="print-head" style={{ background: isDark ? '#1e2233' : '#1a1a1a', color: '#fff', fontFamily: FONT.heading, fontSize: 18, fontWeight: 700, textAlign: 'center', padding: '8px 6px', letterSpacing: '0.5px' }}>{e.nombre}</div>
      <div style={{ padding: '6px 4px' }}>
        {e.lineas.map((l, i) => l.tipo === 'accion'
          ? <div key={i} className="print-act" style={{ background: '#1a1a1a', color: '#fff', fontFamily: FONT.heading, fontSize: 13, fontWeight: 700, textAlign: 'center', borderRadius: 12, padding: '3px 0', margin: '3px 10px', letterSpacing: '0.5px' }}>{l.texto}</div>
          : <div key={i} className="print-ing" style={{ fontFamily: FONT.body, fontSize: 15, textAlign: 'center', padding: '1px 0', color: isDark ? T.pri : '#1a1a1a' }}>{l.texto}</div>
        )}
      </div>
    </div>
  )
}

// ─── MODAL DICTADO ──────────────────────────────────────────────────────────────

function ModalDictado({ T, gama, gamas, onClose, onSaved }: { T: ReturnType<typeof useTheme>['T']; gama: string; gamas: string[]; onClose: () => void; onSaved: () => void }) {
  const [escuchando, setEscuchando] = useState(false)
  const [texto, setTexto] = useState('')
  const [nombre, setNombre] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])
  const [gamaSel, setGamaSel] = useState(gama || gamas[0] || '')
  const [guardando, setGuardando] = useState(false)
  const recRef = useRef<any>(null)

  function toggleVoz() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Tu navegador no soporta dictado por voz. Escribe el plato manualmente.'); return }
    if (escuchando) { recRef.current?.stop(); setEscuchando(false); return }
    const rec = new SR()
    rec.lang = 'es-ES'; rec.continuous = true; rec.interimResults = true
    rec.onresult = (ev: any) => {
      let full = ''
      for (let i = 0; i < ev.results.length; i++) full += ev.results[i][0].transcript + ' '
      setTexto(full.trim())
    }
    rec.onend = () => setEscuchando(false)
    rec.start(); recRef.current = rec; setEscuchando(true)
  }

  function procesar() {
    const { nombre: n, lineas: l } = parsearDictado(texto)
    setNombre(n); setLineas(l)
  }

  async function guardar() {
    if (!nombre.trim() || !gamaSel) { alert('Falta nombre o gama'); return }
    setGuardando(true)
    const { data: max } = await supabase.from('esquemas_cocina').select('orden_gama').eq('gama', gamaSel).order('orden_gama', { ascending: false }).limit(1)
    const orden = ((max?.[0]?.orden_gama as number) ?? 0) + 1
    await supabase.from('esquemas_cocina').insert({ gama: gamaSel, nombre: nombre.toUpperCase().trim(), orden_gama: orden, lineas })
    setGuardando(false); onSaved()
  }

  function editarLinea(i: number, texto: string) { setLineas(prev => prev.map((l, idx) => idx === i ? { ...l, texto } : l)) }
  function toggleTipo(i: number) { setLineas(prev => prev.map((l, idx) => idx === i ? { ...l, tipo: l.tipo === 'ing' ? 'accion' : 'ing' } : l)) }
  function borrarLinea(i: number) { setLineas(prev => prev.filter((_, idx) => idx !== i)) }
  function moverLinea(i: number, dir: -1 | 1) {
    setLineas(prev => { const a = [...prev]; const j = i + dir; if (j < 0 || j >= a.length) return prev;[a[i], a[j]] = [a[j], a[i]]; return a })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={ev => ev.stopPropagation()} style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 16, width: 560, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 18, color: '#B01D23', letterSpacing: '1px', textTransform: 'uppercase' }}>Dictar plato</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: T.mut }}><X size={20} /></button>
        </div>

        {/* Gama */}
        <div style={{ marginBottom: 12 }}>
          <label style={lblStyle(T)}>Gama</label>
          <select value={gamaSel} onChange={ev => setGamaSel(ev.target.value)} style={inputStyle(T)}>
            {gamas.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        {/* Voz + texto */}
        <div style={{ marginBottom: 12 }}>
          <label style={lblStyle(T)}>Dicta o escribe el plato</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea value={texto} onChange={ev => setTexto(ev.target.value)} rows={3} placeholder="Ej: Pollo karaage al limón, tres trozos de pollo crujiente, arroz blanco, tres minutos microondas, salsa de limón, furikake, sésamo"
              style={{ ...inputStyle(T), resize: 'vertical', flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={toggleVoz} style={escuchando ? btnPrimary : btnGhost(T)}><Mic size={16} /> {escuchando ? 'Detener' : 'Hablar'}</button>
            <button onClick={procesar} style={btnGhost(T)}><Check size={16} /> Procesar texto</button>
          </div>
        </div>

        {/* Nombre detectado */}
        {(nombre || lineas.length > 0) && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={lblStyle(T)}>Nombre del plato</label>
              <input value={nombre} onChange={ev => setNombre(ev.target.value)} style={inputStyle(T)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={lblStyle(T)}>Líneas (orden de montaje · pulsa para marcar acción)</label>
              {lineas.map((l, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <button onClick={() => moverLinea(i, -1)} style={miniBtn(T)}>▲</button>
                    <button onClick={() => moverLinea(i, 1)} style={miniBtn(T)}>▼</button>
                  </div>
                  <input value={l.texto} onChange={ev => editarLinea(i, ev.target.value)} style={{ ...inputStyle(T), flex: 1 }} />
                  <button onClick={() => toggleTipo(i)} title="Ingrediente / Acción"
                    style={{ ...miniBtn(T), background: l.tipo === 'accion' ? '#1a1a1a' : 'transparent', color: l.tipo === 'accion' ? '#fff' : T.sec, padding: '4px 8px', width: 'auto', fontSize: 11 }}>
                    {l.tipo === 'accion' ? 'Acción' : 'Ingr.'}
                  </button>
                  <button onClick={() => borrarLinea(i)} style={{ ...miniBtn(T), color: '#B01D23' }}><Trash2 size={13} /></button>
                </div>
              ))}
              <button onClick={() => setLineas(prev => [...prev, { tipo: 'ing', texto: '' }])} style={{ ...btnGhost(T), marginTop: 6 }}><Plus size={14} /> Añadir línea</button>
            </div>
            <button onClick={guardar} disabled={guardando} style={{ ...btnPrimary, width: '100%', justifyContent: 'center', opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando…' : 'Guardar plato'}
            </button>
          </>
        )}
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

// CSS impresión: A4 vertical, blanco y negro, oculta UI
const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 9mm; }
  body * { visibility: hidden; }
  .print-grid, .print-grid *, .solo-print, .solo-print * { visibility: visible; }
  .no-print { display: none !important; }
  .solo-print { display: block !important; }
  .print-gama { font-family: Oswald, sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: #999; text-align: center; margin-bottom: 12px; }
  .print-grid { position: absolute; left: 0; top: 0; width: 100%; column-count: 3 !important; column-gap: 11px; display: block !important; }
  .print-card { break-inside: avoid; margin-bottom: 11px; border: 2px solid #1a1a1a !important; }
  .print-head { background: #1a1a1a !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-act { background: #1a1a1a !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-ing { color: #1a1a1a !important; }
}
`
