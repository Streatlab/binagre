import { BLANCO, GRANATE } from '@/styles/neobrutal'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, ImagePlus } from 'lucide-react'

const btnSaveStyle: CSSProperties = {
  backgroundColor: 'var(--sl-btn-save-bg)', color: 'var(--sl-btn-save-text)',
  fontFamily: 'Oswald, sans-serif', letterSpacing: '1px', padding: '9px 24px',
  borderRadius: '5px', border: 'none', cursor: 'pointer', minHeight: '40px',
}
const btnCancelStyle: CSSProperties = {
  backgroundColor: 'var(--sl-btn-cancel-bg)', color: 'var(--sl-btn-cancel-text)',
  border: '1px solid var(--sl-btn-cancel-border)', fontFamily: 'Oswald, sans-serif',
  letterSpacing: '1px', padding: '9px 24px', borderRadius: '5px', cursor: 'pointer', minHeight: '40px',
}

const ALERGENOS_14 = ['Gluten', 'Lácteos', 'Huevo', 'Pescado', 'Crustáceos', 'Moluscos', 'Frutos secos', 'Cacahuetes', 'Soja', 'Apio', 'Mostaza', 'Sésamo', 'Sulfitos', 'Altramuces']
const METODOS_CONSERVA = ['Tapper', 'Biberón', 'Vacío', 'Congelación']

interface Match { iding: string; nombre: string; precio: number; prov: string }
interface IngLinea { cant: string; ud: string; ingrediente: string; equivalencia: string; grupo?: number; match: Match | null }
interface Conserva { metodo: string; tiempo: string }
interface Ficha {
  id: string; tipo: string; codigo: string | null; nombre: string
  raciones: number | null; tiempo_prep: string | null; edicion: number; fecha: string
  ingredientes: IngLinea[]; pasos: string[]; conservacion: Conserva[]; alergenos: string[]
  foto_url: string | null; estado: string; gama: string | null
}

interface Props {
  ficha: Ficha
  gamasAll: string[]
  onClose: () => void
  onSaved: () => void
}

export default function ModalEditarFicha({ ficha, gamasAll, onClose, onSaved }: Props) {
  const [nombre, setNombre] = useState(ficha.nombre)
  const [codigo, setCodigo] = useState(ficha.codigo ?? '')
  const [raciones, setRaciones] = useState(ficha.raciones != null ? String(ficha.raciones) : '')
  const [prep, setPrep] = useState(ficha.tiempo_prep ?? '')
  const [gama, setGama] = useState(ficha.gama ?? '')
  const [ingredientes, setIngredientes] = useState<IngLinea[]>(ficha.ingredientes ?? [])
  const [pasos, setPasos] = useState<string[]>(ficha.pasos?.length ? ficha.pasos : [''])
  const [conserva, setConserva] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    ;(ficha.conservacion ?? []).forEach(c => { m[c.metodo] = c.tiempo })
    return m
  })
  const [alergenos, setAlergenos] = useState<string[]>(ficha.alergenos ?? [])
  const [fotoUrl, setFotoUrl] = useState<string | null>(ficha.foto_url ?? null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const esReceta = ficha.tipo === 'receta'

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const setIng = (idx: number, k: keyof IngLinea, v: string) =>
    setIngredientes(prev => prev.map((it, i) => i === idx ? { ...it, [k]: v } : it))
  const addIng = () => setIngredientes(prev => [...prev, { cant: '', ud: '', ingrediente: '', equivalencia: '', grupo: 1, match: null }])
  const delIng = (idx: number) => setIngredientes(prev => prev.filter((_, i) => i !== idx))

  const setPaso = (idx: number, v: string) => setPasos(prev => prev.map((p, i) => i === idx ? v : p))
  const addPaso = () => setPasos(prev => [...prev, ''])
  const delPaso = (idx: number) => setPasos(prev => prev.filter((_, i) => i !== idx))

  const toggleAlerg = (a: string) => setAlergenos(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  const setConservaMetodo = (m: string, v: string) => setConserva(prev => ({ ...prev, [m]: v }))

  async function subirFoto(file: File) {
    setErr(null)
    setSubiendoFoto(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${ficha.id}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('fichas-fotos').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('fichas-fotos').getPublicUrl(path)
      setFotoUrl(data.publicUrl)
    } catch (e: any) {
      setErr('No se pudo subir la foto: ' + (e.message ?? ''))
    } finally {
      setSubiendoFoto(false)
    }
  }

  async function guardar() {
    setErr(null)
    if (!nombre.trim()) { setErr('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      const conservacionArr = METODOS_CONSERVA
        .filter(m => (conserva[m] ?? '').trim())
        .map(m => ({ metodo: m, tiempo: conserva[m].trim() }))
      const payload = {
        nombre: nombre.trim(),
        codigo: codigo.trim() || null,
        raciones: raciones ? Number(raciones.replace(',', '.')) : null,
        tiempo_prep: prep.trim() || null,
        gama: gama || null,
        ingredientes: ingredientes.filter(i => i.ingrediente.trim()),
        pasos: pasos.filter(p => p.trim()),
        conservacion: conservacionArr,
        alergenos,
        foto_url: fotoUrl,
        edicion: (ficha.edicion ?? 1) + 1,
      }
      const { error } = await supabase.from('fichas_tecnicas').update(payload).eq('id', ficha.id)
      if (error) throw error
      onSaved()
    } catch (e: any) {
      setErr(e.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 overflow-y-auto" onClick={onClose}>
      <div className="ds-modal w-full max-w-4xl my-8 shadow-2xl" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="ds-modal-title">Editar {ficha.tipo === 'receta' ? 'Receta' : 'EPS'}</h3>
          <button onClick={onClose} className="text-[var(--sl-text-muted)] hover:text-[var(--sl-text-primary)] transition text-lg leading-none">×</button>
        </div>

        <div className="space-y-4">
          {/* Identidad */}
          <div>
            <div className="ds-section-label">Identidad</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="ds-label">Código</label>
                <input value={codigo} onChange={e => setCodigo(e.target.value)} className="ds-input" placeholder="EPS001" />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label className="ds-label">Nombre</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)} className="ds-input" />
              </div>
              <div>
                <label className="ds-label">Gama</label>
                <select value={gama} onChange={e => setGama(e.target.value)} className="ds-input">
                  <option value="">— Sin gama —</option>
                  {gamasAll.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div>
                <label className="ds-label">Raciones</label>
                <input value={raciones} onChange={e => setRaciones(e.target.value)} className="ds-input" />
              </div>
              <div>
                <label className="ds-label">Tiempo prep.</label>
                <input value={prep} onChange={e => setPrep(e.target.value)} className="ds-input" placeholder="20 min" />
              </div>
            </div>
          </div>

          {/* Foto (solo recetas) */}
          {esReceta && (
            <div>
              <div className="ds-section-label">Foto de presentación</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 96, height: 96, borderRadius: 8, border: '1px solid var(--sl-border)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sl-input-edit)', flexShrink: 0 }}>
                  {fotoUrl
                    ? <img src={fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <ImagePlus size={26} color="var(--sl-text-muted)" />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px dashed var(--sl-border)', borderRadius: 8, color: 'var(--sl-text-secondary)', padding: '7px 14px', fontSize: 13, cursor: 'pointer', width: 'fit-content' }}>
                    <ImagePlus size={15} /> {subiendoFoto ? 'Subiendo…' : (fotoUrl ? 'Cambiar foto' : 'Subir foto')}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f) }} />
                  </label>
                  {fotoUrl && (
                    <button onClick={() => setFotoUrl(null)} style={{ background: 'none', border: 'none', color: GRANATE, fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>Quitar foto</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Ingredientes */}
          <div>
            <div className="ds-section-label">Ingredientes</div>
            <div className="space-y-2">
              {ingredientes.map((i, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input value={i.ingrediente} onChange={e => setIng(idx, 'ingrediente', e.target.value)} className="ds-input" style={{ gridColumn: 'span 5' }} placeholder="Ingrediente" />
                  <input value={i.cant} onChange={e => setIng(idx, 'cant', e.target.value)} className="ds-input" style={{ gridColumn: 'span 2' }} placeholder="Cant." />
                  <input value={i.ud} onChange={e => setIng(idx, 'ud', e.target.value)} className="ds-input" style={{ gridColumn: 'span 2' }} placeholder="ud" />
                  <input value={i.equivalencia} onChange={e => setIng(idx, 'equivalencia', e.target.value)} className="ds-input" style={{ gridColumn: 'span 2' }} placeholder="equiv." />
                  <button onClick={() => delIng(idx)} style={{ gridColumn: 'span 1', background: 'transparent', border: '0.5px solid var(--sl-border)', borderRadius: 6, color: GRANATE, cursor: 'pointer', padding: 7, display: 'flex', justifyContent: 'center' }}><Trash2 size={14} /></button>
                </div>
              ))}
              <button onClick={addIng} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px dashed var(--sl-border)', borderRadius: 8, color: 'var(--sl-text-secondary)', padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>
                <Plus size={15} /> Añadir ingrediente
              </button>
            </div>
          </div>

          {/* Preparación */}
          <div>
            <div className="ds-section-label">Preparación</div>
            <div className="space-y-2">
              {pasos.map((p, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <span style={{ paddingTop: 9, fontSize: 13, color: 'var(--sl-text-muted)', width: 20 }}>{idx + 1}.</span>
                  <textarea value={p} onChange={e => setPaso(idx, e.target.value)} className="ds-input" style={{ flex: 1, minHeight: 38, resize: 'vertical' }} />
                  <button onClick={() => delPaso(idx)} style={{ background: 'transparent', border: '0.5px solid var(--sl-border)', borderRadius: 6, color: GRANATE, cursor: 'pointer', padding: 7, marginTop: 1 }}><Trash2 size={14} /></button>
                </div>
              ))}
              <button onClick={addPaso} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px dashed var(--sl-border)', borderRadius: 8, color: 'var(--sl-text-secondary)', padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>
                <Plus size={15} /> Añadir paso
              </button>
            </div>
          </div>

          {/* Conservación */}
          <div>
            <div className="ds-section-label">Conservación</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {METODOS_CONSERVA.map(m => (
                <div key={m}>
                  <label className="ds-label">{m}</label>
                  <input value={conserva[m] ?? ''} onChange={e => setConservaMetodo(m, e.target.value)} className="ds-input" placeholder={m === 'Tapper' ? '5 días' : 'NO'} />
                </div>
              ))}
            </div>
          </div>

          {/* Alérgenos */}
          <div>
            <div className="ds-section-label">Alérgenos</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ALERGENOS_14.map(a => {
                const on = alergenos.includes(a)
                return (
                  <button key={a} type="button" onClick={() => toggleAlerg(a)}
                    style={{ padding: '7px 14px', borderRadius: 99, fontFamily: 'Lexend, sans-serif', fontSize: 13, cursor: 'pointer', border: on ? 'none' : '1px solid var(--sl-border)', background: on ? GRANATE : 'transparent', color: on ? BLANCO : 'var(--sl-text-secondary)' }}>
                    {a}
                  </button>
                )
              })}
            </div>
          </div>

          {err && <p className="text-rojo text-sm">{err}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-[var(--sl-border)]">
          <button onClick={onClose} style={btnCancelStyle}>CANCELAR</button>
          <button onClick={guardar} disabled={saving} style={{ ...btnSaveStyle, opacity: saving ? 0.5 : 1 }}>
            {saving ? 'GUARDANDO…' : 'GUARDAR'}
          </button>
        </div>
      </div>
    </div>
  )
}
