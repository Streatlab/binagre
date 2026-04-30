import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtDate } from '@/utils/format'
import { toast } from '@/lib/toastStore'
import type { Movimiento } from '@/types/conciliacion'
import { getNewId } from '@/lib/categoryMapping'

interface CatPyg { id: string; nombre: string; nivel: number; parent_id: string | null }
interface Titular { id: string; nombre: string }

interface Props {
  movimiento: Movimiento | null
  categoriasPyg: CatPyg[]
  titulares: Titular[]
  onClose: () => void
  onSaved: (m: Movimiento) => void
}

export default function ModalDetalleMovimiento({ movimiento, categoriasPyg, titulares, onClose, onSaved }: Props) {
  const [selectedBloque, setSelectedBloque] = useState('')
  const [selectedSubgrupo, setSelectedSubgrupo] = useState('')
  const [selectedDetalle, setSelectedDetalle] = useState('')
  const [titularId, setTitularId] = useState('')
  const [noRequiere, setNoRequiere] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!movimiento) return

    const catId = getNewId(movimiento.categoria_id) ?? movimiento.categoria_id

    if (catId && categoriasPyg.length > 0) {
      const cat = categoriasPyg.find(c => c.id === catId)
      if (cat) {
        if (cat.nivel === 3 && cat.parent_id) {
          const parent = categoriasPyg.find(c => c.id === cat.parent_id)
          if (parent) {
            if (parent.nivel === 2 && parent.parent_id) {
              setSelectedBloque(parent.parent_id)
              setSelectedSubgrupo(parent.id)
              setSelectedDetalle(cat.id)
            } else if (parent.nivel === 1) {
              setSelectedBloque(parent.id)
              setSelectedSubgrupo('')
              setSelectedDetalle(cat.id)
            }
          }
        }
      }
    }

    setTitularId(movimiento.titular_id ?? '')
    setNoRequiere(movimiento.doc_estado === 'no_requiere')
  }, [movimiento, categoriasPyg])

  if (!movimiento) return null

  const bloques = categoriasPyg.filter(c => c.nivel === 1)

  const subgrupos = selectedBloque
    ? categoriasPyg.filter(c => c.nivel === 2 && c.parent_id === selectedBloque)
    : []

  const detalles = selectedSubgrupo
    ? categoriasPyg.filter(c => c.nivel === 3 && c.parent_id === selectedSubgrupo)
    : selectedBloque
    ? categoriasPyg.filter(c => c.nivel === 3 && c.parent_id === selectedBloque)
    : []

  async function handleGuardar() {
    setSaving(true)
    try {
      const docEstado = noRequiere ? 'no_requiere' : (movimiento!.doc_estado === 'tiene' ? 'tiene' : 'falta')

      const updates: Record<string, unknown> = {
        titular_id: titularId || null,
        doc_estado: docEstado,
      }
      if (selectedDetalle) {
        updates.categoria = selectedDetalle
      }

      const { error } = await supabase.from('conciliacion').update(updates).eq('id', movimiento!.id)
      if (error) throw error

      // Si asignó categoría a un movimiento que no tenía (o cambió), crear regla automática
      const categoriaAnterior = movimiento!.categoria_id
      if (selectedDetalle && selectedDetalle !== categoriaAnterior) {
        const palabras = movimiento!.concepto.toUpperCase().split(/\s+/).filter(w => w.length > 3)
        const keyword = palabras[0] ?? movimiento!.concepto.slice(0, 10).toUpperCase()
        await supabase.from('reglas_conciliacion').upsert({
          patron: keyword.toLowerCase(),
          categoria_codigo: selectedDetalle,
          asigna_como: movimiento!.importe >= 0 ? 'ingreso' : 'gasto',
          activa: true,
          prioridad: 10,
          creada_por_usuario: true,
        }, { onConflict: 'patron' })
      }

      toast.success('Movimiento actualizado')
      onSaved({
        ...movimiento!,
        categoria_id: selectedDetalle || movimiento!.categoria_id,
        titular_id: (updates.titular_id as string | null),
        doc_estado: updates.doc_estado as 'tiene' | 'falta' | 'no_requiere',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const titularNombre = titulares.find(t => t.id === movimiento.titular_id)?.nombre ?? ''
  const _isRuben = titularNombre.toLowerCase().includes('rubén') || titularNombre.toLowerCase().includes('ruben')
  const _isEmilio = titularNombre.toLowerCase().includes('emilio')

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, padding: '28px 32px', maxWidth: 560, width: '90%', boxShadow: '0 8px 30px rgba(0,0,0,0.06)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* TOP */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase', marginBottom: 4 }}>
              Detalle movimiento · {fmtDate(movimiento.fecha)}
            </div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 18, fontWeight: 600, color: '#111', letterSpacing: '0.5px' }}>
              {movimiento.concepto.length > 50 ? movimiento.concepto.slice(0, 50) + '…' : movimiento.concepto}
            </div>
          </div>
          <button onClick={onClose} style={{ fontSize: 18, color: '#7a8090', cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }}>✕</button>
        </div>

        {/* DATOS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: 22, fontSize: 13, padding: '14px 0', borderTop: '0.5px solid #ebe8e2', borderBottom: '0.5px solid #ebe8e2' }}>
          <div style={{ color: '#7a8090', fontFamily: 'Lexend, sans-serif' }}>Importe</div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 500, letterSpacing: '0.5px', color: movimiento.importe >= 0 ? '#1D9E75' : '#E24B4A', textAlign: 'right' }}>
            {movimiento.importe >= 0 ? '+' : ''}{fmtEur(movimiento.importe)}
          </div>
          <div style={{ color: '#7a8090', fontFamily: 'Lexend, sans-serif' }}>Contraparte</div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 500, letterSpacing: '0.5px', color: '#111', textAlign: 'right' }}>
            {movimiento.contraparte || '—'}
          </div>
        </div>

        {/* CATEGORÍA - 3 selects encadenados */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase', marginBottom: 8 }}>Categoría</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <select
              value={selectedBloque}
              onChange={e => { setSelectedBloque(e.target.value); setSelectedSubgrupo(''); setSelectedDetalle('') }}
              style={{ padding: '9px 12px', borderRadius: 8, border: '0.5px solid #d0c8bc', background: '#fff', color: '#111', fontFamily: 'Lexend, sans-serif', fontSize: 13, cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}
            >
              <option value="">Bloque</option>
              {bloques.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
            <select
              value={selectedSubgrupo}
              onChange={e => { setSelectedSubgrupo(e.target.value); setSelectedDetalle('') }}
              disabled={!selectedBloque || subgrupos.length === 0}
              style={{ padding: '9px 12px', borderRadius: 8, border: '0.5px solid #d0c8bc', background: '#fff', color: '#111', fontFamily: 'Lexend, sans-serif', fontSize: 13, cursor: 'pointer', width: '100%', boxSizing: 'border-box', opacity: (!selectedBloque || subgrupos.length === 0) ? 0.5 : 1 }}
            >
              <option value="">Grupo</option>
              {subgrupos.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
            <select
              value={selectedDetalle}
              onChange={e => setSelectedDetalle(e.target.value)}
              disabled={!selectedBloque}
              style={{ padding: '9px 12px', borderRadius: 8, border: selectedDetalle ? '0.5px solid #FF4757' : '0.5px solid #d0c8bc', background: selectedDetalle ? '#FF475710' : '#fff', color: selectedDetalle ? '#FF4757' : '#111', fontFamily: 'Lexend, sans-serif', fontSize: 13, cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}
            >
              <option value="">Detalle</option>
              {detalles.map(d => <option key={d.id} value={d.id}>{d.id} · {d.nombre}</option>)}
            </select>
          </div>
        </div>

        {/* TITULAR */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase', marginBottom: 8 }}>Titular</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {titulares
              .filter(t => {
                const n = t.nombre.toLowerCase()
                return n.includes('rubén') || n.includes('ruben') || n.includes('emilio')
              })
              .slice(0, 2)
              .map(t => {
                const n = t.nombre.toLowerCase()
                const isR = n.includes('rubén') || n.includes('ruben')
                const isActive = titularId === t.id
                const activeColor = isR ? '#F26B1F' : '#1E5BCC'
                return (
                  <button
                    key={t.id}
                    onClick={() => setTitularId(isActive ? '' : t.id)}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border: isActive ? 'none' : '0.5px solid #d0c8bc',
                      background: isActive ? activeColor : '#fff',
                      color: isActive ? '#fff' : '#3a4050',
                      fontFamily: 'Lexend, sans-serif',
                      fontSize: 13,
                      cursor: 'pointer',
                      textAlign: 'center',
                      fontWeight: 500,
                    }}
                  >
                    {t.nombre}
                  </button>
                )
              })}
          </div>
        </div>

        {/* CHECKBOX no requiere */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#3a4050', cursor: 'pointer', marginBottom: 22, padding: '10px 12px', background: '#f5f3ef', borderRadius: 8 }}>
          <input
            type="checkbox"
            checked={noRequiere}
            onChange={e => setNoRequiere(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#FF4757', margin: 0 }}
          />
          <span>No requiere documento</span>
        </label>

        {/* FOOTER */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: 8, border: '0.5px solid #d0c8bc', background: 'transparent', color: '#3a4050', fontFamily: 'Lexend, sans-serif', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={saving}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#FF4757', color: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
