import { useState, useEffect, useMemo } from 'react'
import React from 'react'
import { supabase } from '@/lib/supabase'
import { Printer, FileDown, Pencil, AlertTriangle, Link2 } from 'lucide-react'
import ModalEditarFicha from './ModalEditarFicha'
import { fmtEur, fmtNum } from '@/lib/format'
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
      const claves = [r.nombre_base, r.nombre].filter(Boolean).map((s: string) => limpiarNombre(s).nombre.toLowerCase())
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
      ;(mapaLineas[cod] = mapaLineas[cod] || []).push({
        ingrediente: l.ingrediente_nombre ?? '',
        cant: l.cantidad != null ? String(l.cantidad) : '',
        ud: l.unidad ?? '',
      })
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
  const u = (ud ?? '').trim().replace(/\.$/, '')
  if (!u) return ''
  return u.length <= 3 ? `${u}.` : u.toLowerCase()
}

/**
 * Limpia el nombre del ingrediente para el papel: quita el sufijo de proveedor
 * (_MER, _ALC, _EPS…) esté donde esté y saca la aclaración entre paréntesis
 * ("1 c.s.", "4 hojas") a la columna Equivalencia, que es su sitio.
 */
export function limpiarNombre(n: string): { nombre: string; equivalencia: string } {
  let s = (n ?? '').replace(/_[A-Z]{2,4}\b/g, '').trim()
  let eq = ''
  const m = s.match(/\(([^)]*)\)\s*$/)
  if (m && m.index != null) { eq = m[1].trim(); s = s.slice(0, m.index).trim() }
  return { nombre: s, equivalencia: eq }
}

function costeLinea(i: IngLinea): number {
  if (!i.match) return 0
  const c = parseFloat((i.cant || '').replace(',', '.'))
  if (isNaN(c)) return 0
  const factor = (i.ud === 'gr' || i.ud === 'g' || i.ud === 'ml') ? c / 1000 : c
  return factor * i.match.precio
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
      const k = limpiarNombre(i.ingrediente || '').nombre.toLowerCase()
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

  // ── Datos reales del escandallo → líneas del papel ──
  const lineasHoja: LineaIng[] = ingredientes.map(i => {
    const l = limpiarNombre(i.match?.nombre ?? i.ingrediente)
    return {
      ingrediente: l.nombre,
      cantidad: fmtCant(i.cant),
      unidad: fmtUd(i.ud),
      equivalencia: i.equivalencia || l.equivalencia,
    }
  })

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
            <strong>{sinEnlazar.length} sin enlazar al escandallo:</strong> {sinEnlazar.map(i => limpiarNombre(i.ingrediente).nombre).join(', ')}.
          </div>
          <button onClick={() => setEditando(true)} style={estiloBoton({ background: ESCANDALLO_WARN_BTN, color: BLANCO, padding: '7px 12px', fontSize: 12 })}>
            <Link2 size={13} /> Resolver
          </button>
        </div>
      )}

      <FichaTecnicaHoja
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
        <button onClick={() => window.print()} style={estiloBoton()}><Printer size={15} /> Imprimir</button>
        <button onClick={() => window.print()} style={estiloBoton()} title="En el diálogo, elige «Guardar como PDF»"><FileDown size={15} /> PDF</button>
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
