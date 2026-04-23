import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BigCard } from '@/components/configuracion/BigCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'

interface Cat {
  id: string
  nombre: string
  es_ingreso: boolean
  es_gasto: boolean
  orden: number
}

export default function CategoriasPanel() {
  const [cats, setCats] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState('')

  async function refetch() {
    const { data, error } = await supabase.from('categorias_contables').select('*').order('orden')
    if (error) throw error
    setCats((data ?? []) as Cat[])
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  async function togglePin(c: Cat, campo: 'es_ingreso' | 'es_gasto') {
    const { error } = await supabase.from('categorias_contables').update({ [campo]: !c[campo] }).eq('id', c.id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function renombrar(c: Cat, nombre: string) {
    const { error } = await supabase.from('categorias_contables').update({ nombre }).eq('id', c.id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function eliminar(c: Cat) {
    if (!confirm(`Eliminar "${c.nombre}"?`)) return
    const { error } = await supabase.from('categorias_contables').delete().eq('id', c.id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function añadir() {
    if (!nuevo.trim()) return
    const maxOrden = cats.reduce((m, c) => Math.max(m, c.orden), 0)
    const { error } = await supabase
      .from('categorias_contables')
      .insert({ nombre: nuevo.trim(), orden: maxOrden + 1, es_ingreso: true, es_gasto: false, tipo: 'ingreso' })
    if (error) { setError(error.message); return }
    setNuevo(''); await refetch()
  }

  if (loading) return <div className="p-6 text-[var(--sl-text-muted)]">Cargando...</div>
  if (error) return <div className="p-6 bg-[var(--sl-border-error)]/20 text-[var(--sl-border-error)] rounded-xl">{error}</div>

  return (
    <BigCard title="Categorías de conciliación" count={`${cats.length}`}>
      <table className="sl-cfg-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th style={{ textAlign: "center" }}>Tipo</th>
            <th className="num" style={{ width: "80px" }}>—</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            const grupos: { label: string; items: Cat[] }[] = [
              { label: 'Ingresos', items: cats.filter(c => c.es_ingreso && !c.es_gasto) },
              { label: 'Gastos', items: cats.filter(c => c.es_gasto && !c.es_ingreso) },
              { label: 'Ingreso y gasto', items: cats.filter(c => c.es_ingreso && c.es_gasto) },
              { label: 'Sin asignar', items: cats.filter(c => !c.es_ingreso && !c.es_gasto) },
            ]
            return grupos.flatMap(g => g.items.length === 0 ? [] : [
              <tr key={`g-${g.label}`} className="sl-cfg-group-header"><td colSpan={3}>{g.label} · {g.items.length}</td></tr>,
              ...g.items.map(c => (
            <tr key={c.id}>
              <td>
                <InlineEdit value={c.nombre} type="text" onSubmit={(v) => renombrar(c, String(v))} />
              </td>
              <td style={{ textAlign: "center" }}>
                <div className="inline-flex gap-2">
                  <button
                    onClick={() => togglePin(c, 'es_ingreso')}
                    className={`inline-flex items-center px-2.5 py-[3px] rounded-[5px] text-[10px] tracking-[0.06em] font-semibold uppercase transition ${c.es_ingreso ? 'bg-[var(--sl-uber)]/15 text-[var(--sl-uber-text)]' : 'bg-transparent text-[var(--sl-text-muted)] border border-dashed border-[var(--sl-border)] hover:border-[var(--sl-uber)]'}`}
                  >Ingreso</button>
                  <button
                    onClick={() => togglePin(c, 'es_gasto')}
                    className={`inline-flex items-center px-2.5 py-[3px] rounded-[5px] text-[10px] tracking-[0.06em] font-semibold uppercase transition ${c.es_gasto ? 'bg-[var(--sl-border-error)]/20 text-[var(--sl-text-calc)]' : 'bg-transparent text-[var(--sl-text-muted)] border border-dashed border-[var(--sl-border)] hover:border-[var(--sl-border-focus)]'}`}
                  >Gasto</button>
                </div>
              </td>
              <td className="num">
                <button onClick={() => eliminar(c)} className="text-[var(--sl-text-muted)] hover:text-[var(--sl-text-calc)] text-xs">Eliminar</button>
              </td>
            </tr>
              ))
            ])
          })()}
        </tbody>
      </table>
      <div className="flex gap-2">
        <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && añadir()}
          placeholder="Nueva categoría..." className="flex-1 px-3 py-2 border border-dashed border-[var(--sl-border)] rounded-lg text-[13px] bg-[var(--sl-card)] focus:outline-none focus:border-[var(--sl-border-focus)]" />
        <button onClick={añadir} className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--sl-btn-save-bg)] text-white hover:bg-[#901A1E] tracking-[0.04em]">+ Nueva categoría</button>
      </div>
    </BigCard>
  )
}
