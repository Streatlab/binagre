import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { Plus, Trash2, Check, X, Pencil } from 'lucide-react'

interface Regla {
  id: string
  patron: string | null
  set_proveedor: string | null
  categoria_codigo: string | null
  borrar: boolean
  prioridad: number
  activa: boolean
}

// Tras crear/editar una regla, dispara el barrido de re-conciliación para que las
// facturas pendientes que ahora cuadran con esta regla se concilien solas
// (autopropaga a pasadas y futuras). Best-effort: no bloquea la UI si falla.
function reconciliarPendientes() {
  fetch('/api/facturas?action=reconciliar-pendientes').catch(() => {})
}

export default function TabReglasConciliacion() {
  const { T } = useTheme()
  const [reglas, setReglas] = useState<Regla[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [nPatron, setNPatron] = useState('')
  const [nProv, setNProv] = useState('')
  const [nCat, setNCat] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [ePatron, setEPatron] = useState('')
  const [eProv, setEProv] = useState('')
  const [eCat, setECat] = useState('')

  useEffect(() => { cargar() }, [])
  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('reglas_conciliacion').select('*').order('prioridad')
    setReglas((data as Regla[]) ?? [])
    setLoading(false)
  }

  async function crear() {
    if (!nPatron.trim()) return
    const maxP = reglas.reduce((m, r) => Math.max(m, r.prioridad ?? 0), 0)
    await supabase.from('reglas_conciliacion').insert({
      patron: nPatron.trim(),
      set_proveedor: nProv.trim() || null,
      categoria_codigo: nCat.trim() || null,
      borrar: false, prioridad: maxP + 1, activa: true,
    })
    setNPatron(''); setNProv(''); setNCat(''); cargar()
    reconciliarPendientes()
  }
  async function guardarEdit(id: string) {
    await supabase.from('reglas_conciliacion').update({
      patron: ePatron.trim() || null,
      set_proveedor: eProv.trim() || null,
      categoria_codigo: eCat.trim() || null,
    }).eq('id', id)
    setEditId(null); cargar()
    reconciliarPendientes()
  }
  async function toggleActiva(id: string, activa: boolean) {
    await supabase.from('reglas_conciliacion').update({ activa: !activa }).eq('id', id)
    cargar()
    reconciliarPendientes()
  }
  async function borrar(id: string) {
    if (!confirm('¿Eliminar esta regla?')) return
    await supabase.from('reglas_conciliacion').delete().eq('id', id)
    cargar()
  }

  const visibles = reglas.filter(r => !busca ||
    (r.patron ?? '').toLowerCase().includes(busca.toLowerCase()) ||
    (r.set_proveedor ?? '').toLowerCase().includes(busca.toLowerCase()) ||
    (r.categoria_codigo ?? '').toLowerCase().includes(busca.toLowerCase()))

  const inp: React.CSSProperties = { background: T.inp, border: `1px solid ${T.brd}`, borderRadius: 8, color: T.pri, fontFamily: FONT.body, fontSize: 13, padding: '8px 12px', outline: 'none' }
  const btnP: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: '#B01D23', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontFamily: FONT.body, fontSize: 13, cursor: 'pointer' }
  const ico: React.CSSProperties = { background: 'transparent', border: `0.5px solid ${T.brd}`, borderRadius: 6, color: T.sec, cursor: 'pointer', padding: 5, display: 'flex' }

  if (loading) return <div style={{ padding: 24, color: T.mut, fontFamily: FONT.body }}>Cargando reglas…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
        Cuando un movimiento del banco contiene el texto del patrón, el sistema le asigna automáticamente el proveedor y la categoría indicados. Se usan en OCR y Conciliación. Al guardar una regla, las facturas pendientes que ahora cuadran se reconcilian solas.
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={nPatron} onChange={e => setNPatron(e.target.value)} placeholder="Si el concepto contiene… (ej: MERCADONA)" style={{ ...inp, flex: 1.3, minWidth: 180 }} />
        <input value={nProv} onChange={e => setNProv(e.target.value)} placeholder="Proveedor (opcional)" style={{ ...inp, flex: 1, minWidth: 140 }} />
        <input value={nCat} onChange={e => setNCat(e.target.value)} placeholder="Categoría (opcional)" style={{ ...inp, flex: 1, minWidth: 140 }} />
        <button onClick={crear} style={btnP}><Plus size={16} /> Añadir</button>
      </div>

      <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar regla…" style={{ ...inp, maxWidth: 280 }} />

      <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT.body, fontSize: 14 }}>
          <thead>
            <tr style={{ background: T.group }}>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, letterSpacing: 1, color: T.mut, textTransform: 'uppercase' }}>Si contiene</th>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, letterSpacing: 1, color: T.mut, textTransform: 'uppercase' }}>Proveedor</th>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, letterSpacing: 1, color: T.mut, textTransform: 'uppercase' }}>Categoría</th>
              <th style={{ width: 70, textAlign: 'center', padding: '10px 8px', fontSize: 11, color: T.mut, textTransform: 'uppercase' }}>Activa</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(r => (
              <tr key={r.id} style={{ borderTop: `0.5px solid ${T.brd}`, opacity: r.activa ? 1 : 0.5 }}>
                {editId === r.id ? (
                  <>
                    <td style={{ padding: '8px 14px' }}><input value={ePatron} onChange={e => setEPatron(e.target.value)} style={{ ...inp, width: '100%' }} /></td>
                    <td style={{ padding: '8px 14px' }}><input value={eProv} onChange={e => setEProv(e.target.value)} style={{ ...inp, width: '100%' }} /></td>
                    <td style={{ padding: '8px 14px' }}><input value={eCat} onChange={e => setECat(e.target.value)} style={{ ...inp, width: '100%' }} /></td>
                    <td></td>
                    <td style={{ padding: '8px 14px' }}><div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => guardarEdit(r.id)} style={ico}><Check size={14} /></button>
                      <button onClick={() => setEditId(null)} style={ico}><X size={14} /></button>
                    </div></td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: '10px 14px', color: T.pri }}>{r.borrar ? <span style={{ color: '#B01D23' }}>🗑 {r.patron} (borrar)</span> : r.patron}</td>
                    <td style={{ padding: '10px 14px', color: T.sec }}>{r.set_proveedor ?? '—'}</td>
                    <td style={{ padding: '10px 14px', color: T.sec }}>{r.categoria_codigo ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => toggleActiva(r.id, r.activa)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                        <span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', background: r.activa ? '#06C167' : '#999' }} />
                      </button>
                    </td>
                    <td style={{ padding: '10px 14px' }}><div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => { setEditId(r.id); setEPatron(r.patron ?? ''); setEProv(r.set_proveedor ?? ''); setECat(r.categoria_codigo ?? '') }} style={ico}><Pencil size={13} /></button>
                      <button onClick={() => borrar(r.id)} style={{ ...ico, color: '#B01D23' }}><Trash2 size={13} /></button>
                    </div></td>
                  </>
                )}
              </tr>
            ))}
            {visibles.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: T.mut }}>Sin reglas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
