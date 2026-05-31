import { useState, useEffect, useMemo } from 'react'
import React from 'react'
import { supabase } from '@/lib/supabase'
import { Printer, Pencil, AlertTriangle, Link2, Box } from 'lucide-react'

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
const METODOS_CONSERVA = ['Biberón', 'Tapper', 'Vacío', 'Congelación']
const ALERGENOS_14 = ['Gluten', 'Lácteos', 'Huevo', 'Pescado', 'Crustáceos', 'Moluscos', 'Frutos secos', 'Cacahuetes', 'Soja', 'Apio', 'Mostaza', 'Sésamo', 'Sulfitos', 'Altramuces']

function resaltarIngredientes(texto: string, ingredientes: IngLinea[]): React.ReactNode[] {
  const terminos = new Set<string>()
  ingredientes.forEach(i => {
    const n = (i.ingrediente || '').trim().toLowerCase()
    if (!n) return
    terminos.add(n)
    const prim = n.split(/\s+/)[0]
    if (prim.length >= 3) terminos.add(prim)
  })
  if (terminos.size === 0) return [texto]
  const lista = [...terminos].sort((a, b) => b.length - a.length)
  const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\b(${lista.map(escapar).join('|')})\\b`, 'gi')
  const partes: React.ReactNode[] = []
  let last = 0, m: RegExpExecArray | null, k = 0
  while ((m = re.exec(texto)) !== null) {
    if (m.index > last) partes.push(texto.slice(last, m.index))
    partes.push(<strong key={k++}>{m[0]}</strong>)
    last = m.index + m[0].length
  }
  if (last < texto.length) partes.push(texto.slice(last))
  return partes.length ? partes : [texto]
}

export default function TabFichas({ busqueda, tipo }: { busqueda: string; tipo?: 'ep' | 'receta' }) {
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<Ficha | null>(null)
  const [gamaSel, setGamaSel] = useState<string>('')
  const [alergMap, setAlergMap] = useState<Record<string, string[]>>({})
  const [gestionGamas, setGestionGamas] = useState(false)

  useEffect(() => { cargar(); setGamaSel('') }, [tipo])
  useEffect(() => { cargarAlergenos() }, [])

  async function cargarAlergenos() {
    const { data } = await supabase.from('ingredientes').select('nombre_base, nombre, alergenos')
    const map: Record<string, string[]> = {}
    ;(data ?? []).forEach((r: any) => {
      const al = Array.isArray(r.alergenos) ? r.alergenos : []
      if (al.length === 0) return
      const claves = [r.nombre_base, r.nombre].filter(Boolean).map((s: string) => s.replace(/_[A-Z]+$/, '').trim().toLowerCase())
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
    setSel(prev => prev ? (list.find(f => f.id === prev.id) ?? list[0] ?? null) : (list[0] ?? null))
    setLoading(false)
  }

  const gamas = useMemo(() => {
    const set = new Set<string>()
    fichas.forEach(f => { if (f.gama) set.add(f.gama) })
    return [...set].sort()
  }, [fichas])

  // ---- Gestión de gamas (crear / renombrar / eliminar / mover fichas) ----
  async function crearGama() {
    const nombre = window.prompt('Nombre de la nueva gama:')?.trim()
    if (!nombre) return
    // crea la gama "vacía" asignándola a ninguna ficha todavía; aparecerá al asignar.
    // Para que se vea aunque esté vacía, la mostramos localmente.
    setGamaSel(nombre)
    alert(`Gama "${nombre}" lista. Asigna fichas desde el desplegable de cada ficha.`)
    setGamaExtra(prev => prev.includes(nombre) ? prev : [...prev, nombre])
  }
  const [gamaExtra, setGamaExtra] = useState<string[]>([])
  const gamasAll = useMemo(() => {
    const s = new Set<string>([...gamas, ...gamaExtra])
    return [...s].sort()
  }, [gamas, gamaExtra])

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

  if (loading) return <div className="py-10 text-center text-[var(--sl-text-muted)] text-sm">Cargando fichas…</div>

  const etiquetaLista = tipo === 'receta' ? 'Recetas' : tipo === 'ep' ? 'EPS' : 'Fichas EPS / Receta'

  const pill = (active: boolean): React.CSSProperties => ({
    padding: '4px 11px', borderRadius: 99, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
    border: active ? 'none' : '1px solid var(--sl-border)',
    background: active ? '#B01D23' : 'transparent',
    color: active ? '#fff' : 'var(--sl-text-secondary)',
  })

  return (
    <div>
      {/* Filtro + gestión de gamas */}
      <div className="no-print" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <button onClick={() => setGamaSel('')} style={pill(gamaSel === '')}>Todas</button>
        {gamasAll.map(g => (
          <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <button onClick={() => setGamaSel(g)} style={pill(gamaSel === g)}>{g}</button>
            {gestionGamas && (
              <>
                <button onClick={() => renombrarGama(g)} title="Renombrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 12, padding: 2 }}><Pencil size={12} /></button>
                <button onClick={() => eliminarGama(g)} title="Eliminar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B01D23', fontSize: 13, padding: 2 }}>×</button>
              </>
            )}
          </span>
        ))}
        <button onClick={() => setGestionGamas(v => !v)} style={{ ...pill(false), borderStyle: 'dashed', color: gestionGamas ? '#B01D23' : 'var(--sl-text-muted)' }}>
          {gestionGamas ? 'Listo' : 'Gestionar gamas'}
        </button>
        {gestionGamas && <button onClick={crearGama} style={{ ...pill(false), borderStyle: 'dashed' }}>+ Nueva gama</button>}
      </div>

      <div className="flex gap-4" style={{ alignItems: 'flex-start' }}>
        <div className="no-print" style={{ width: 220, flexShrink: 0 }}>
          <span className="text-xs uppercase tracking-wider text-[var(--sl-text-muted)] block mb-2">{etiquetaLista}</span>
          <div className="flex flex-col gap-1">
            {fichas.filter(f =>
              (!gamaSel || f.gama === gamaSel) &&
              (!busqueda || f.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (f.codigo ?? '').toLowerCase().includes(busqueda.toLowerCase()))
            ).map(f => {
              const alertas = f.ingredientes.filter(i => i.ingrediente && !i.match && !NO_COSTE(i)).length
              return (
                <button key={f.id} onClick={() => setSel(f)}
                  className={'text-left px-3 py-2 rounded-lg transition flex items-center gap-2 ' +
                    (sel?.id === f.id ? 'bg-[#ece9e3]' : 'hover:bg-[var(--sl-card)]')}
                  style={{ color: 'var(--sl-text-primary)' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#999', flexShrink: 0 }}>{f.codigo}</span>
                  <span style={{ flex: 1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nombre}</span>
                  {alertas > 0 && <AlertTriangle size={13} color="#d97706" />}
                </button>
              )
            })}
          </div>
        </div>
        {sel ? <FichaDetalle ficha={sel} alergMap={alergMap} gamasAll={gamasAll} onSaved={cargar} /> : <div className="text-[var(--sl-text-muted)] text-sm py-10">Sin fichas.</div>}
      </div>
    </div>
  )
}

function costeLinea(i: IngLinea): number {
  if (!i.match) return 0
  const c = parseFloat((i.cant || '').replace(',', '.'))
  if (isNaN(c)) return 0
  const factor = (i.ud === 'gr' || i.ud === 'g' || i.ud === 'ml') ? c / 1000 : c
  return factor * i.match.precio
}

function FichaDetalle({ ficha: f, alergMap, gamasAll, onSaved }: { ficha: Ficha; alergMap: Record<string, string[]>; gamasAll: string[]; onSaved: () => void }) {
  const costeTanda = f.ingredientes.reduce((s, i) => s + costeLinea(i), 0)
  const costeRac = f.raciones ? costeTanda / f.raciones : 0
  const sinEnlazar = f.ingredientes.filter(i => i.ingrediente && !i.match && !NO_COSTE(i))
  const esReceta = f.tipo === 'receta'

  const alergAuto = useMemo(() => {
    const set = new Set<string>()
    f.ingredientes.forEach(i => {
      const k = (i.ingrediente || '').replace(/_[A-Z]+$/, '').trim().toLowerCase()
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

  const grupos = useMemo(() => {
    const g: Record<number, IngLinea[]> = {}
    f.ingredientes.forEach(i => { const k = i.grupo ?? 1; (g[k] = g[k] || []).push(i) })
    return Object.entries(g).sort((a, b) => Number(a[0]) - Number(b[0]))
  }, [f])
  const hayGrupos = grupos.length > 1
  const totalIng = f.ingredientes.length
  const colsIng = totalIng > 24 ? 3 : totalIng > 12 ? 2 : 1

  function tiempoMetodo(metodo: string): { texto: string; especial?: string } {
    const raiz: Record<string, string[]> = {
      'Biberón': ['biber'], 'Tapper': ['tapper', 'taper', 'tupper'],
      'Vacío': ['vacio', 'vacío', 'vac'], 'Congelación': ['congel'],
    }
    const claves = raiz[metodo] ?? [metodo.toLowerCase().slice(0, 4)]
    const found = (f.conservacion ?? []).find(c => claves.some(k => c.metodo.toLowerCase().includes(k)))
    if (found) return { texto: found.tiempo, especial: found.metodo.toLowerCase() !== metodo.toLowerCase() ? found.metodo : undefined }
    return { texto: 'NO' }
  }

  function imprimir() { window.print() }

  const filaIng = (i: IngLinea, idx: number) => (
    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
      <td style={{ padding: '4px 0' }}>
        <span className="solo-pantalla">{i.match?.nombre ?? i.ingrediente}</span>
        <span className="solo-print-ing" style={{ display: 'none' }}>{i.ingrediente}</span>
      </td>
      <td style={{ textAlign: 'right', fontWeight: 500, width: 64, whiteSpace: 'nowrap' }}>{i.cant}{i.ud ? ` ${i.ud}` : ''}</td>
      <td style={{ textAlign: 'right', color: '#888', width: 78, whiteSpace: 'nowrap' }}>{i.equivalencia || '—'}</td>
      <td className="no-print" style={{ textAlign: 'right', width: 86, paddingLeft: 6 }}>
        {i.match
          ? <span style={{ background: '#dcfce7', color: '#166534', fontSize: 10, padding: '2px 7px', borderRadius: 99 }}>✓ {i.match.prov}</span>
          : NO_COSTE(i)
            ? <span style={{ color: '#aaa', fontSize: 11 }}>no coste</span>
            : <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 10, padding: '2px 7px', borderRadius: 99 }}>⚠ sin enlazar</span>}
      </td>
    </tr>
  )

  return (
    <div className="flex-1 min-w-0">
      <style>{PRINT_CSS}</style>

      {/* Selector de gama de esta ficha */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--sl-text-muted)' }}>Gama:</span>
        <select value={f.gama ?? ''} onChange={e => cambiarGama(e.target.value)}
          style={{ background: 'var(--sl-card)', border: '1px solid var(--sl-border)', borderRadius: 8, padding: '5px 10px', fontSize: 13, color: 'var(--sl-text-primary)' }}>
          <option value="">— Sin gama —</option>
          {gamasAll.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {sinEnlazar.length > 0 && (
        <div className="no-print" style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={18} color="#b45309" />
          <div style={{ flex: 1, fontSize: 13, color: '#92400e' }}>
            <strong>{sinEnlazar.length} sin enlazar al escandallo:</strong> {sinEnlazar.map(i => i.ingrediente).join(', ')}.
          </div>
          <button style={{ background: '#b45309', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Link2 size={13} /> Resolver
          </button>
        </div>
      )}

      <div className="print-ficha" style={{ background: '#fff', border: '1.5px solid #1a1a1a', borderRadius: 10, overflow: 'hidden', color: '#1a1a1a', display: 'flex', flexDirection: 'column' }}>

        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '2px solid #1a1a1a', gap: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 21, fontWeight: 500 }}><span style={{ fontWeight: 700 }}>{f.codigo}.</span> {f.nombre}</div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #ddd', flexShrink: 0 }}>
          <Cell label="PREP." val={f.tiempo_prep ?? '—'} />
          <Cell label="RENDIMIENTO" val={f.raciones ? `${f.raciones} rac.` : '—'} />
          <Cell label="COSTE TANDA" val={`${costeTanda.toFixed(2)} €`} />
          <Cell label="€ / RACIÓN" val={`${costeRac.toFixed(2)} €`} last />
        </div>

        <div style={{ display: 'flex', flexShrink: 0 }}>
          <div style={{ flex: 1, padding: '12px 16px', borderBottom: '2px solid #1a1a1a' }}>
            <Lbl>Ingredientes</Lbl>
            {colsIng === 1 ? (
              grupos.map(([gk, items]) => (
                <div key={gk} style={{ marginBottom: 8 }}>
                  {hayGrupos && <div style={{ fontSize: 11, color: '#888', borderBottom: '1px solid #1a1a1a', paddingBottom: 2, marginBottom: 4 }}>Grupo {gk}</div>}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><tbody>{items.map(filaIng)}</tbody></table>
                </div>
              ))
            ) : (
              <div style={{ columnCount: colsIng, columnGap: 22 }}>
                {grupos.map(([gk, items]) => (
                  <div key={gk} style={{ breakInside: 'avoid', marginBottom: 8 }}>
                    {hayGrupos && <div style={{ fontSize: 11, color: '#888', borderBottom: '1px solid #1a1a1a', paddingBottom: 2, marginBottom: 4 }}>Grupo {gk}</div>}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}><tbody>{items.map(filaIng)}</tbody></table>
                  </div>
                ))}
              </div>
            )}
          </div>

          {esReceta && (
            <div className="no-print" style={{ width: 130, borderLeft: '1px solid #ddd', borderBottom: '2px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#bbb' }}>
              {f.foto_url
                ? <img src={f.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <><Box size={28} /><span style={{ fontSize: 10, marginTop: 4 }}>Foto</span></>}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '2px solid #1a1a1a', flex: 1 }}>
          <Lbl>Preparación</Lbl>
          <ol style={{ margin: 0, paddingLeft: 22, fontSize: 13, lineHeight: 1.55, listStyleType: 'decimal', listStylePosition: 'outside' }}>
            {f.pasos.map((p, idx) => <li key={idx} style={{ marginBottom: 3, display: 'list-item' }}>{resaltarIngredientes(p, f.ingredientes)}</li>)}
          </ol>
        </div>

        <div style={{ display: 'flex', flexShrink: 0 }}>
          <div style={{ flex: 1.3, padding: '10px 16px', borderRight: '1px solid #ddd' }}>
            <Lbl><Box size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Conservación</Lbl>
            <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
              <tbody>
                {METODOS_CONSERVA.map(metodo => {
                  const t = tiempoMetodo(metodo)
                  const esNo = t.texto === 'NO'
                  return (
                    <tr key={metodo} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '3px 0' }}>{t.especial ? <strong>{t.especial}</strong> : metodo}</td>
                      <td style={{ textAlign: 'right', fontWeight: esNo ? 700 : 500, color: esNo ? '#bbb' : '#1a1a1a' }}>{t.texto}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ flex: 1, padding: '10px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Lbl><AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Alérgenos</Lbl>
              <button className="no-print" onClick={() => editAlerg ? guardarAlerg() : setEditAlerg(true)} style={{ background: 'none', border: 'none', color: '#B01D23', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                <Pencil size={11} /> {editAlerg ? 'Guardar' : 'Editar'}
              </button>
            </div>
            {editAlerg ? (
              <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {ALERGENOS_14.map(a => {
                  const on = alergManual.includes(a)
                  return (
                    <button key={a} onClick={() => setAlergManual(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])}
                      style={{ padding: '4px 9px', borderRadius: 99, fontSize: 11, cursor: 'pointer', border: on ? 'none' : '1px solid #ccc', background: on ? '#B01D23' : 'transparent', color: on ? '#fff' : '#666' }}>
                      {a}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{alergAuto.length === 0 ? 'Ninguno' : alergAuto.join(', ')}</div>
            )}
          </div>
        </div>

      </div>

      <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={imprimir} style={btn}><Printer size={15} /> Imprimir / PDF</button>
        <button style={btn}><Pencil size={15} /> Editar</button>
      </div>
    </div>
  )
}

function Cell({ label, val, last }: { label: string; val: any; last?: boolean }) {
  return (
    <div style={{ flex: 1, padding: '8px 12px', textAlign: 'center', borderRight: last ? 'none' : '1px solid #eee' }}>
      <div style={{ fontSize: 10, color: '#888', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 500 }}>{val}</div>
    </div>
  )
}
function Lbl({ children }: { children: any }) {
  return <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1, color: '#666', marginBottom: 8, textTransform: 'uppercase' }}>{children}</div>
}

const btn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--sl-text-secondary)', border: '0.5px solid var(--sl-border)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }

const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 12mm; }
  body * { visibility: hidden; }
  .print-ficha, .print-ficha * { visibility: visible; }
  .no-print { display: none !important; }
  .solo-pantalla { display: none !important; }
  .solo-print-ing { display: inline !important; }
  .print-ficha { position: absolute; left: 0; top: 0; width: 100%; height: 273mm; box-sizing: border-box; }
  .print-ficha ol { list-style-type: decimal !important; padding-left: 22px !important; }
  .print-ficha ol li { display: list-item !important; }
}
`
