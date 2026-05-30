import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Printer, Pencil, AlertTriangle, Link2, Box, Snowflake } from 'lucide-react'

interface Match { iding: string; nombre: string; precio: number; prov: string }
interface IngLinea { cant: string; ud: string; ingrediente: string; equivalencia: string; grupo?: number; match: Match | null }
interface Conserva { metodo: string; tiempo: string }
interface Ficha {
  id: string; tipo: string; codigo: string | null; nombre: string
  raciones: number | null; tiempo_prep: string | null; edicion: number; fecha: string
  ingredientes: IngLinea[]; pasos: string[]; conservacion: Conserva[]; alergenos: string[]
  foto_url: string | null; estado: string
}

const NO_COSTE = (i: IngLinea) => i.ud === 'cup' || i.ud === 'cups' || i.ingrediente.toLowerCase() === 'agua'

const METODOS_CONSERVA = ['Biberón', 'Tapper', 'Vacío', 'Congelación']

export default function TabFichas({ busqueda }: { busqueda: string }) {
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<Ficha | null>(null)

  useEffect(() => { cargar() }, [])
  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('fichas_tecnicas').select('*').eq('estado', 'vigente').order('codigo')
    const list = (data as Ficha[]) ?? []
    setFichas(list)
    setSel(prev => prev ? (list.find(f => f.id === prev.id) ?? list[0] ?? null) : (list[0] ?? null))
    setLoading(false)
  }

  const visibles = useMemo(() =>
    fichas.filter(f => !busqueda || f.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (f.codigo ?? '').toLowerCase().includes(busqueda.toLowerCase()))
    , [fichas, busqueda])

  if (loading) return <div className="py-10 text-center text-[var(--sl-text-muted)] text-sm">Cargando fichas…</div>

  return (
    <div className="flex gap-4" style={{ alignItems: 'flex-start' }}>
      <div className="no-print" style={{ width: 220, flexShrink: 0 }}>
        <span className="text-xs uppercase tracking-wider text-[var(--sl-text-muted)] block mb-2">Fichas EP / Receta</span>
        <div className="flex flex-col gap-1">
          {visibles.map(f => {
            const alertas = f.ingredientes.filter(i => i.ingrediente && !i.match && !NO_COSTE(i)).length
            return (
              <button key={f.id} onClick={() => setSel(f)}
                className={'text-left px-3 py-2 rounded-lg text-sm transition flex items-center gap-2 ' +
                  (sel?.id === f.id ? 'bg-accent text-[#111]' : 'text-[var(--sl-text-secondary)] hover:bg-[var(--sl-card)]')}>
                <span className="font-medium" style={{ fontSize: 11, opacity: 0.7 }}>{f.codigo}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nombre}</span>
                {alertas > 0 && <AlertTriangle size={13} color="#d97706" />}
              </button>
            )
          })}
        </div>
      </div>
      {sel ? <FichaDetalle ficha={sel} /> : <div className="text-[var(--sl-text-muted)] text-sm py-10">Sin fichas.</div>}
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

function FichaDetalle({ ficha: f }: { ficha: Ficha }) {
  const costeTanda = f.ingredientes.reduce((s, i) => s + costeLinea(i), 0)
  const costeRac = f.raciones ? costeTanda / f.raciones : 0
  const sinEnlazar = f.ingredientes.filter(i => i.ingrediente && !i.match && !NO_COSTE(i))
  const esReceta = f.tipo === 'receta'

  const grupos = useMemo(() => {
    const g: Record<number, IngLinea[]> = {}
    f.ingredientes.forEach(i => { const k = i.grupo ?? 1; (g[k] = g[k] || []).push(i) })
    return Object.entries(g).sort((a, b) => Number(a[0]) - Number(b[0]))
  }, [f])
  const hayGrupos = grupos.length > 1

  // Conservación: siempre los 4 métodos. El que no tenga dato => NO.
  function tiempoMetodo(metodo: string): { texto: string; especial?: string } {
    const raiz: Record<string, string[]> = {
      'Biberón': ['biber'],
      'Tapper': ['tapper', 'taper', 'tupper'],
      'Vacío': ['vacio', 'vacío', 'vac'],
      'Congelación': ['congel'],
    }
    const claves = raiz[metodo] ?? [metodo.toLowerCase().slice(0, 4)]
    const found = (f.conservacion ?? []).find(c => {
      const m = c.metodo.toLowerCase()
      return claves.some(k => m.includes(k))
    })
    if (found) return { texto: found.tiempo, especial: found.metodo.toLowerCase() !== metodo.toLowerCase() ? found.metodo : undefined }
    return { texto: 'NO' }
  }

  // QR enlaza directo a ESTA ficha (no al índice)
  const qrData = encodeURIComponent(`https://binagre.vercel.app/escandallo?tab=fichas&ficha=${f.codigo}`)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${qrData}`

  function imprimir() { window.print() }

  return (
    <div className="flex-1 min-w-0">
      <style>{PRINT_CSS}</style>

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

      <div className="print-ficha" style={{ background: '#fff', border: '1.5px solid #1a1a1a', borderRadius: 10, overflow: 'hidden', color: '#1a1a1a' }}>

        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '2px solid #1a1a1a', gap: 10 }}>
          <div style={{ fontSize: 21, fontWeight: 500 }}><span style={{ fontWeight: 700 }}>{f.codigo}.</span> {f.nombre}</div>
          <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 12, color: '#666', lineHeight: 1.4 }}>Ed. {f.edicion}<br />{new Date(f.fecha).toLocaleDateString('es-ES')}</div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #ddd' }}>
          <Cell label="PREP." val={f.tiempo_prep ?? '—'} />
          <Cell label="RENDIMIENTO" val={f.raciones ? `${f.raciones} rac.` : '—'} />
          <Cell label="COSTE TANDA" val={`${costeTanda.toFixed(2)} €`} />
          <Cell label="€ / RACIÓN" val={`${costeRac.toFixed(2)} €`} last />
        </div>

        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1, padding: '12px 16px', borderBottom: '2px solid #1a1a1a' }}>
            <Lbl>Ingredientes</Lbl>
            {grupos.map(([gk, items]) => (
              <div key={gk} style={{ marginBottom: 10 }}>
                {hayGrupos && <div style={{ fontSize: 11, color: '#888', borderBottom: '1px solid #1a1a1a', paddingBottom: 2, marginBottom: 4 }}>Grupo {gk}</div>}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <tbody>
                    {items.map((i, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                        {/* En pantalla: nombre interno con proveedor (match.nombre). En impresión: nombre limpio. */}
                        <td style={{ padding: '5px 0' }}>
                          <span className="solo-pantalla">{i.match?.nombre ?? i.ingrediente}</span>
                          <span className="solo-print-ing" style={{ display: 'none' }}>{i.ingrediente}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 500, width: 70 }}>{i.cant}{i.ud ? ` ${i.ud}` : ''}</td>
                        <td style={{ textAlign: 'right', color: '#888', width: 95 }}>{i.equivalencia || '—'}</td>
                        <td className="no-print" style={{ textAlign: 'right', width: 90, paddingLeft: 8 }}>
                          {i.match
                            ? <span style={{ background: '#dcfce7', color: '#166534', fontSize: 10, padding: '2px 7px', borderRadius: 99 }}>✓ {i.match.prov}</span>
                            : NO_COSTE(i)
                              ? <span style={{ color: '#aaa', fontSize: 11 }}>no coste</span>
                              : <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 10, padding: '2px 7px', borderRadius: 99 }}>⚠ sin enlazar</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {esReceta && (
            <div className="no-print" style={{ width: 130, borderLeft: '1px solid #ddd', borderBottom: '2px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#bbb' }}>
              {f.foto_url
                ? <img src={f.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <><Box size={28} /><span style={{ fontSize: 10, marginTop: 4 }}>Foto</span></>}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '2px solid #1a1a1a' }}>
          <Lbl>Preparación</Lbl>
          <ol style={{ margin: 0, paddingLeft: 22, fontSize: 13.5, lineHeight: 1.6, listStyleType: 'decimal', listStylePosition: 'outside' }}>
            {f.pasos.map((p, idx) => <li key={idx} style={{ marginBottom: 3, display: 'list-item' }}>{p}</li>)}
          </ol>
        </div>

        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1.3, padding: '10px 16px', borderRight: '1px solid #ddd' }}>
            <Lbl><Box size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Conservación</Lbl>
            <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
              <tbody>
                {METODOS_CONSERVA.map(metodo => {
                  const t = tiempoMetodo(metodo)
                  const esNo = t.texto === 'NO'
                  return (
                    <tr key={metodo} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '3px 0' }}>
                        {metodo === 'Congelación' && <Snowflake size={13} style={{ verticalAlign: -2, marginRight: 4 }} />}
                        {t.especial ? <strong>{t.especial}</strong> : metodo}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: esNo ? 700 : 500, color: esNo ? '#bbb' : '#1a1a1a' }}>{t.texto}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ flex: 1, padding: '10px 16px' }}>
            <Lbl><AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Alérgenos</Lbl>
            {(f.alergenos ?? []).length === 0
              ? <span style={{ border: '1.5px solid #1a1a1a', borderRadius: 99, padding: '3px 10px', fontSize: 12 }}>Ninguno</span>
              : <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{f.alergenos.map(a => <span key={a} style={{ border: '1.5px solid #1a1a1a', borderRadius: 99, padding: '3px 10px', fontSize: 12 }}>{a}</span>)}</div>}
          </div>
          <div style={{ width: 90, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid #ddd' }}>
            <img src={qrUrl} alt="QR ficha" width={64} height={64} style={{ display: 'block' }} />
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
  .print-ficha { position: absolute; left: 0; top: 0; width: 100%; }
  .print-ficha ol { list-style-type: decimal !important; padding-left: 22px !important; }
  .print-ficha ol li { display: list-item !important; }
  .print-ficha img { display: block !important; }
}
`
