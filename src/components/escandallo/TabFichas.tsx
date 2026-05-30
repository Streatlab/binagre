import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { FileText, Printer, Mic, Plus, Trash2, X, Check, Pencil, AlertTriangle, Link2 } from 'lucide-react'

interface Match { iding: string; nombre: string; precio: number; prov: string }
interface IngLinea { cant: string; ud: string; ingrediente: string; equivalencia: string; match: Match | null }
interface Ficha {
  id: string; tipo: string; codigo: string | null; nombre: string
  raciones: number | null; tiempo_prep: string | null; edicion: number; fecha: string
  ingredientes: IngLinea[]; pasos: string[]; estado: string
}

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
    if (!sel && list.length) setSel(list[0])
    setLoading(false)
  }

  const visibles = useMemo(() =>
    fichas.filter(f => !busqueda || f.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (f.codigo ?? '').toLowerCase().includes(busqueda.toLowerCase()))
    , [fichas, busqueda])

  if (loading) return <div className="py-10 text-center text-[var(--sl-text-muted)] text-sm">Cargando fichas…</div>

  return (
    <div className="flex gap-4" style={{ alignItems: 'flex-start' }}>
      {/* Lista lateral */}
      <div className="no-print" style={{ width: 220, flexShrink: 0 }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wider text-[var(--sl-text-muted)]">Fichas EP / Receta</span>
        </div>
        <div className="flex flex-col gap-1">
          {visibles.map(f => {
            const alertas = f.ingredientes.filter(i => i.ingrediente && !i.match && i.ud !== 'cups' && i.ingrediente.toLowerCase() !== 'agua').length
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

      {/* Ficha */}
      {sel ? <FichaDetalle ficha={sel} onChange={cargar} /> : <div className="text-[var(--sl-text-muted)] text-sm py-10">Sin fichas.</div>}
    </div>
  )
}

function FichaDetalle({ ficha: f, onChange }: { ficha: Ficha; onChange: () => void }) {
  const conPrecio = f.ingredientes.filter(i => i.match)
  const costeTanda = conPrecio.reduce((s, i) => {
    const c = parseFloat(i.cant); if (isNaN(c)) return s
    const factor = i.ud === 'gr' ? c / 1000 : c
    return s + factor * (i.match?.precio ?? 0)
  }, 0)
  const costeRac = f.raciones ? costeTanda / f.raciones : 0
  const sinEnlazar = f.ingredientes.filter(i => i.ingrediente && !i.match && i.ud !== 'cups' && i.ingrediente.toLowerCase() !== 'agua')

  function imprimir() { window.print() }

  return (
    <div className="flex-1 min-w-0">
      <style>{PRINT_CSS}</style>

      {/* Alerta en directo */}
      {sinEnlazar.length > 0 && (
        <div className="no-print" style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={18} color="#b45309" />
          <div style={{ flex: 1, fontSize: 13, color: '#92400e' }}>
            <strong>{sinEnlazar.length} ingrediente(s) sin enlazar al escandallo:</strong> {sinEnlazar.map(i => i.ingrediente).join(', ')}.
          </div>
          <button style={{ background: '#b45309', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Link2 size={13} /> Resolver
          </button>
        </div>
      )}

      <div className="print-ficha" style={{ background: 'var(--sl-card)', border: '0.5px solid var(--sl-border)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Cabecera */}
        <div className="print-head" style={{ background: '#1e2233', color: '#fff', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e8f442', letterSpacing: 1 }}>{f.codigo}</span>
            <span style={{ fontSize: 18, fontWeight: 600 }}>{f.nombre}</span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.65 }}>Ed. {f.edicion} · {new Date(f.fecha).toLocaleDateString('es-ES')}{f.tiempo_prep ? ` · ${f.tiempo_prep}` : ''}</div>
        </div>

        <div style={{ padding: '14px 18px' }}>
          {/* Costes */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <Kpi label="Coste tanda" val={`${costeTanda.toFixed(2)} €`} />
            <Kpi label="Raciones" val={f.raciones ?? '—'} />
            <Kpi label="Coste / ración" val={`${costeRac.toFixed(2)} €`} />
          </div>

          {/* Ingredientes */}
          <div style={{ fontSize: 11, color: 'var(--sl-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Ingredientes</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ color: 'var(--sl-text-muted)', fontSize: 12, textAlign: 'left' }}>
                <th style={{ padding: '4px 0', fontWeight: 400 }}>Cant.</th>
                <th style={{ padding: '4px 0', fontWeight: 400 }}>Ud.</th>
                <th style={{ padding: '4px 0', fontWeight: 400 }}>Ingrediente</th>
                <th style={{ padding: '4px 0', fontWeight: 400 }}>Equivalencia</th>
                <th style={{ padding: '4px 0', fontWeight: 400, textAlign: 'right' }} className="no-print">Enlace</th>
              </tr>
            </thead>
            <tbody>
              {f.ingredientes.map((i, idx) => {
                const noCoste = i.ud === 'cups' || i.ingrediente.toLowerCase() === 'agua'
                return (
                  <tr key={idx} style={{ borderTop: '0.5px solid var(--sl-border)' }}>
                    <td style={{ padding: '7px 0', fontWeight: 500 }}>{i.cant}</td>
                    <td>{i.ud}</td>
                    <td>{i.ingrediente}</td>
                    <td style={{ color: 'var(--sl-text-muted)' }}>{i.equivalencia || '—'}</td>
                    <td style={{ textAlign: 'right' }} className="no-print">
                      {i.match
                        ? <span style={{ background: '#dcfce7', color: '#166534', fontSize: 11, padding: '2px 8px', borderRadius: 99 }}>✓ {i.match.prov} · {i.match.precio.toFixed(2)}€</span>
                        : noCoste
                          ? <span style={{ color: 'var(--sl-text-muted)', fontSize: 12 }}>no coste</span>
                          : <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 11, padding: '2px 8px', borderRadius: 99 }}>⚠ sin enlazar</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pasos */}
          <div style={{ fontSize: 11, color: 'var(--sl-text-muted)', textTransform: 'uppercase', letterSpacing: 1, margin: '16px 0 6px' }}>Preparación</div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
            {f.pasos.map((p, idx) => <li key={idx}>{p}</li>)}
          </ol>

          {/* Botones */}
          <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button onClick={imprimir} style={btn}><Printer size={15} /> Imprimir / PDF</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, val }: { label: string; val: any }) {
  return (
    <div style={{ background: 'var(--sl-group, rgba(0,0,0,0.03))', borderRadius: 8, padding: '8px 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--sl-text-muted)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--sl-text-primary)' }}>{val}</div>
    </div>
  )
}

const btn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--sl-text-secondary)', border: '0.5px solid var(--sl-border)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }

const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 12mm; }
  body * { visibility: hidden; }
  .print-ficha, .print-ficha * { visibility: visible; }
  .no-print { display: none !important; }
  .print-ficha { position: absolute; left: 0; top: 0; width: 100%; border: 2px solid #1a1a1a !important; }
  .print-head { background: #1a1a1a !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`
