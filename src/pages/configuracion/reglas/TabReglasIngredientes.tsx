import { BLANCO, GRANATE, GRIS, LEX } from '@/styles/neobrutal'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { Plus, Trash2, Check, X, Pencil } from 'lucide-react'
import { PantallaCantera, HeroCantera, Papel } from '@/components/kit/cantera'

interface Regla {
  id: string
  alias: string
  ingrediente_canonico: string
  iding: string | null
  activo: boolean
}

export default function TabReglasIngredientes() {
  const { T } = useTheme()
  const [reglas, setReglas] = useState<Regla[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [nuevoAlias, setNuevoAlias] = useState('')
  const [nuevoCanonico, setNuevoCanonico] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editAlias, setEditAlias] = useState('')
  const [editCanonico, setEditCanonico] = useState('')

  useEffect(() => { cargar() }, [])
  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('reglas_ingredientes').select('*').order('alias')
    setReglas((data as Regla[]) ?? [])
    setLoading(false)
  }

  async function crear() {
    if (!nuevoAlias.trim() || !nuevoCanonico.trim()) return
    await supabase.from('reglas_ingredientes').insert({ alias: nuevoAlias.trim().toLowerCase(), ingrediente_canonico: nuevoCanonico.trim() })
    setNuevoAlias(''); setNuevoCanonico(''); cargar()
  }
  async function guardarEdit(id: string) {
    if (!editAlias.trim() || !editCanonico.trim()) return
    await supabase.from('reglas_ingredientes').update({ alias: editAlias.trim().toLowerCase(), ingrediente_canonico: editCanonico.trim() }).eq('id', id)
    setEditId(null); cargar()
  }
  async function borrar(id: string) {
    if (!confirm('¿Eliminar esta regla?')) return
    await supabase.from('reglas_ingredientes').delete().eq('id', id)
    cargar()
  }

  const visibles = reglas.filter(r => !busca || r.alias.includes(busca.toLowerCase()) || r.ingrediente_canonico.toLowerCase().includes(busca.toLowerCase()))

  const inp: React.CSSProperties = { background: T.inp, border: `1px solid ${T.brd}`, borderRadius: 0, color: T.pri, fontFamily: FONT.body, fontSize: 13, padding: '8px 12px', outline: 'none' }
  const btnP: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: GRANATE, color: BLANCO, border: 'none', borderRadius: 0, padding: '8px 14px', fontFamily: FONT.body, fontSize: 13, cursor: 'pointer' }
  const ico: React.CSSProperties = { background: 'transparent', border: `0.5px solid ${T.brd}`, borderRadius: 0, color: T.sec, cursor: 'pointer', padding: 5, display: 'flex' }

  if (loading) return (
    <PantallaCantera embedded>
      <Papel ceja={GRIS}><div style={{ padding: 32, textAlign: 'center', color: GRIS, fontFamily: LEX, fontSize: 13, fontWeight: 600 }}>Cargando reglas…</div></Papel>
    </PantallaCantera>
  )

  return (
    <PantallaCantera embedded>
      <HeroCantera
        area="equipo"
        titular={reglas.length === 0 ? 'Todavía no hay reglas de normalización' : 'Así traduce el dictado a ingredientes reales del escandallo'}
        etiquetaDato={reglas.length > 0 ? 'Reglas activas' : undefined}
        cifra={reglas.length > 0 ? String(reglas.length) : undefined}
        resumen="Cuando dictas una ficha, estas reglas convierten lo que dices (ej. «arroz») en el ingrediente real del escandallo (ej. «Arroz largo_ALC»). El sistema las reutiliza en todas las elaboraciones."
      />

      {/* Crear nueva */}
      <Papel ceja={GRANATE} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={nuevoAlias} onChange={e => setNuevoAlias(e.target.value)} placeholder="Cuando digo… (ej: arroz)" style={{ ...inp, flex: 1, minWidth: 160 }} />
        <input value={nuevoCanonico} onChange={e => setNuevoCanonico(e.target.value)} placeholder="Usar ingrediente… (ej: Arroz largo_ALC)" style={{ ...inp, flex: 1.4, minWidth: 200 }} />
        <button onClick={crear} style={btnP}><Plus size={16} /> Añadir regla</button>
      </Papel>

      <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar regla…" style={{ ...inp, maxWidth: 280 }} />

      {/* Lista */}
      <Papel ceja={GRANATE} pad="0" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT.body, fontSize: 14 }}>
          <thead>
            <tr style={{ background: T.group }}>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, letterSpacing: 1, color: T.mut, textTransform: 'uppercase' }}>Cuando digo</th>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, letterSpacing: 1, color: T.mut, textTransform: 'uppercase' }}>Usar ingrediente</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(r => (
              <tr key={r.id} style={{ borderTop: `0.5px solid ${T.brd}` }}>
                {editId === r.id ? (
                  <>
                    <td style={{ padding: '8px 14px' }}><input value={editAlias} onChange={e => setEditAlias(e.target.value)} style={{ ...inp, width: '100%' }} /></td>
                    <td style={{ padding: '8px 14px' }}><input value={editCanonico} onChange={e => setEditCanonico(e.target.value)} style={{ ...inp, width: '100%' }} /></td>
                    <td style={{ padding: '8px 14px' }}><div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => guardarEdit(r.id)} style={ico}><Check size={14} /></button>
                      <button onClick={() => setEditId(null)} style={ico}><X size={14} /></button>
                    </div></td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: '10px 14px', color: T.pri }}>{r.alias}</td>
                    <td style={{ padding: '10px 14px', color: T.pri }}>{r.ingrediente_canonico}</td>
                    <td style={{ padding: '10px 14px' }}><div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => { setEditId(r.id); setEditAlias(r.alias); setEditCanonico(r.ingrediente_canonico) }} style={ico}><Pencil size={13} /></button>
                      <button onClick={() => borrar(r.id)} style={{ ...ico, color: GRANATE }}><Trash2 size={13} /></button>
                    </div></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Papel>
    </PantallaCantera>
  )
}
