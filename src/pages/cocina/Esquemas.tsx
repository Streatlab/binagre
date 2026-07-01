import { useState, useEffect, useMemo, useRef } from 'react'
import { LayoutGrid, Mic, Printer, Plus, Trash2, X, Check, Pencil, Tags, Archive, History } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, tituloPaginaStyle } from '@/styles/tokens'
import { jsPDF } from 'jspdf'

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

// ─── IMPRESIÓN PDF (A4 vertical · cabecera de gama por página + contador X/Y de gama + contador general grande + tarjetas redondeadas) ──

const GREY_BG: [number, number, number] = [226, 226, 226]
const INK_C: [number, number, number] = [26, 26, 26]
const CARD_R = 2.2 // radio de esquina de las tarjetas (mm) — mismo look redondeado que la vista en pantalla

function alturaCard(e: Esquema): number {
  return 8 + e.lineas.length * 4.4 + 3
}

function construirEsquemasPDF(grupos: { nombre: string; platos: Esquema[] }[]) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PW = doc.internal.pageSize.getWidth()
  const PH = doc.internal.pageSize.getHeight()
  const M = 8, bandH = 12, footerH = 14
  const usableW = PW - M * 2
  const nCols = 3, colGap = 5
  const colW = (usableW - colGap * (nCols - 1)) / nCols
  const topY = M + bandH + 3
  const availH = (PH - footerH - 4) - topY

  type Page = { gama: string; cols: { e: Esquema; y: number }[][]; gp: number; gt: number }
  const pages: Page[] = []
  for (const grupo of grupos) {
    const gPages: { cols: { e: Esquema; y: number }[][] }[] = []
    let colH = [0, 0, 0]
    let cols: { e: Esquema; y: number }[][] = [[], [], []]
    const pushPage = () => { gPages.push({ cols }); colH = [0, 0, 0]; cols = [[], [], []] }
    for (const e of grupo.platos) {
      const h = alturaCard(e)
      let ci = 0
      for (let k = 1; k < nCols; k++) if (colH[k] < colH[ci]) ci = k
      if (colH[ci] + h > availH && colH[ci] > 0) { pushPage(); ci = 0 }
      cols[ci].push({ e, y: colH[ci] })
      colH[ci] += h + 4
    }
    if (cols.some(c => c.length)) pushPage()
    gPages.forEach((p, i) => pages.push({ gama: grupo.nombre, cols: p.cols, gp: i + 1, gt: gPages.length }))
  }

  const total = pages.length
  pages.forEach((pg, pi) => {
    if (pi > 0) doc.addPage()
    // banda de gama (en cada página de la gama), nombre centrado
    doc.setFillColor(...INK_C); doc.roundedRect(M, M, usableW, bandH, 2, 2, 'F')
    doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
    let fs = 20; doc.setFontSize(fs)
    while (fs > 11 && doc.getTextWidth(pg.gama.toUpperCase()) > usableW - 32) { fs -= 1; doc.setFontSize(fs) }
    doc.text(pg.gama.toUpperCase(), PW / 2, M + bandH - 3.6, { align: 'center' })
    doc.setFontSize(15)
    doc.text(`${pg.gp}/${pg.gt}`, PW - M - 4, M + bandH - 3.6, { align: 'right' })

    pg.cols.forEach((col, ci) => {
      const x = M + ci * (colW + colGap)
      col.forEach(({ e, y }) => {
        const cy = topY + y
        const h = alturaCard(e)
        // tarjeta redondeada (mismo look que la vista en pantalla)
        doc.setDrawColor(...INK_C); doc.setLineWidth(0.4); doc.roundedRect(x, cy, colW, h, CARD_R, CARD_R, 'S')
        doc.setFillColor(...GREY_BG); doc.roundedRect(x, cy, colW, 8, CARD_R, CARD_R, 'F')
        doc.setFillColor(...GREY_BG); doc.rect(x, cy + 4, colW, 4, 'F') // tapa el redondeo inferior de la cabecera para que case con la raya
        doc.setDrawColor(...INK_C); doc.line(x, cy + 8, x + colW, cy + 8)
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK_C)
        let tf = 12; doc.setFontSize(tf)
        while (tf > 7 && doc.getTextWidth(e.nombre) > colW - 4) { tf -= 0.5; doc.setFontSize(tf) }
        doc.text(e.nombre, x + colW / 2, cy + 5.7, { align: 'center' })
        let ly = cy + 8
        e.lineas.forEach((l, li) => {
          if (l.tipo === 'accion') {
            const prevAccion = li > 0 && e.lineas[li - 1].tipo === 'accion'
            const nextAccion = li < e.lineas.length - 1 && e.lineas[li + 1].tipo === 'accion'
            doc.setDrawColor(...INK_C); doc.setLineWidth(0.4)
            if (!prevAccion) doc.line(x + 4, ly + 0.5, x + colW - 4, ly + 0.5)
            if (!nextAccion) doc.line(x + 4, ly + 4, x + colW - 4, ly + 4)
            doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
            doc.text(l.texto, x + colW / 2, ly + 3.2, { align: 'center' })
          } else {
            doc.setFont('helvetica', 'normal'); let lf = 9; doc.setFontSize(lf)
            while (lf > 6 && doc.getTextWidth(l.texto) > colW - 3) { lf -= 0.5; doc.setFontSize(lf) }
            doc.text(l.texto, x + colW / 2, ly + 3.1, { align: 'center' })
          }
          ly += 4.4
        })
      })
    })

    // contador general GRANDE, centrado abajo
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK_C); doc.setFontSize(24)
    doc.text(`${pi + 1} / ${total}`, PW / 2, PH - 5, { align: 'center' })
  })

  const url = doc.output('bloburl')
  const win = window.open(url as unknown as string, '_blank')
  if (win) win.addEventListener('load', () => { try { win.focus(); win.print() } catch { /* imprime desde el visor */ } })
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

  function imprimir() {
    const platos = esquemas.filter(e => e.gama === gamaActiva && e.estado === 'vigente')
    if (platos.length) construirEsquemasPDF([{ nombre: gamaActiva, platos }])
  }
  function imprimirTodo() {
    const orden = ['Asiática', 'Casera', 'Raciones', 'Binagre', 'Italiana', 'Green', 'French Tacos']
    const nombres = Array.from(new Set([...orden, ...gamas.map(g => g.nombre)]))
    const grupos = nombres
      .map(n => ({ nombre: n, platos: esquemas.filter(e => e.gama === n && e.estado === 'vigente') }))
      .filter(x => x.platos.length > 0)
    if (grupos.length) construirEsquemasPDF(grupos)
  }

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
        {e.lineas.map((l, i) => {
          if (l.tipo !== 'accion') {
            return <div key={i} className="print-ing" style={{ fontFamily: "'Barlow Semi Condensed','Oswald',sans-serif", fontWeight: 600, fontSize: 16, lineHeight: 1.1, textAlign: 'center', padding: '0', color: isDark ? T.pri : '#1a1a1a' }}>{l.texto}</div>
          }
          const prevAccion = i > 0 && e.lineas[i - 1].tipo === 'accion'
          const nextAccion = i < e.lineas.length - 1 && e.lineas[i + 1].tipo === 'accion'
          const brd = `2px solid ${isDark ? T.brd : '#1a1a1a'}`
          return (
            <div key={i} className="print-act" style={{
              background: 'transparent', color: isDark ? T.pri : '#1a1a1a', fontFamily: FONT.heading, fontSize: 15, fontWeight: 600, textAlign: 'center',
              borderTop: prevAccion ? 'none' : brd,
              borderBottom: nextAccion ? 'none' : brd,
              padding: '2px 0',
              marginTop: prevAccion ? 0 : 5, marginBottom: nextAccion ? 0 : 5, marginLeft: 8, marginRight: 8,
              letterSpacing: '1px',
            }}>{l.texto}</div>
          )
        })}
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

// Vista: masonry uniforme (tarjetas mismo ancho, fluyen sin huecos). Impresión: PDF (jsPDF) generado en construirEsquemasPDF.
const PRINT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Semi+Condensed:wght@500;600;700&display=swap');
.esquemas-masonry { column-count: 4; column-gap: 14px; }
.esquemas-masonry .esquema-card { break-inside: avoid; margin-bottom: 14px; display: inline-block; width: 100%; }
@media (max-width: 1100px) { .esquemas-masonry { column-count: 3; } }
@media (max-width: 800px)  { .esquemas-masonry { column-count: 2; } }
@media (max-width: 520px)  { .esquemas-masonry { column-count: 1; } }
`
