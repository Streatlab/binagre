import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useIsDark } from '@/hooks/useIsDark'
import { KpiCard, KpiGrid } from '@/components/configuracion/KpiCard'
import { BigCard } from '@/components/configuracion/BigCard'

export default function TabCategorias() {
  const isDark = useIsDark()
  const [items, setItems] = useState<string[]>([])
  const [nuevo, setNuevo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = async () => {
    const { data, error } = await supabase
      .from('configuracion')
      .select('valor')
      .eq('clave', 'categorias')
      .maybeSingle()
    if (error) throw error
    let parsed: string[] = []
    if (data?.valor) {
      try { parsed = JSON.parse(data.valor) as string[] } catch { parsed = [] }
    }
    setItems(Array.isArray(parsed) ? parsed : [])
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try { await refetch() }
      catch (e: any) { if (!cancelled) setError(e?.message ?? 'Error') }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  const persist = async (next: string[]) => {
    const { error } = await supabase
      .from('configuracion')
      .upsert({ clave: 'categorias', valor: JSON.stringify(next) }, { onConflict: 'clave' })
    if (error) setError(error.message)
  }

  const add = async () => {
    const val = nuevo.trim()
    if (!val) return
    if (items.includes(val)) { setNuevo(''); return }
    const next = [...items, val]
    setItems(next)
    setNuevo('')
    await persist(next)
  }

  const remove = async (idx: number) => {
    const next = items.filter((_, i) => i !== idx)
    setItems(next)
    await persist(next)
  }

  const mut = isDark ? '#777' : '#9E9588'

  if (loading) return <div style={{ padding: 24, color: mut }}>Cargando categorías…</div>
  if (error) {
    return (
      <div style={{ padding: 16, background: isDark ? '#3a1a1a' : '#FCE0E2', color: isDark ? '#ff8080' : '#B01D23', borderRadius: 12 }}>
        {error}
      </div>
    )
  }

  const chipBg = isDark ? '#1e1e1e' : '#FAF4E4'
  const chipBrd = isDark ? '#2a2a2a' : '#E9E1D0'
  const chipColor = isDark ? '#ffffff' : '#1A1A1A'
  const inputBg = isDark ? '#1e1e1e' : '#ffffff'
  const btnBg = isDark ? '#2a2600' : '#FFF3B8'
  const btnColor = isDark ? '#e8f442' : '#5a4d0a'
  const btnBrd = isDark ? '#4a4000' : '#E8D066'

  return (
    <>
      <KpiGrid>
        <KpiCard label="Categorías" value={items.length} sub="ingredientes" />
        <KpiCard label="Uso" value="—" sub="pendiente cruce con ingredientes" subTone="muted" />
        <KpiCard label="Fuente" value="legacy" sub="configuracion.categorias JSON" subTone="muted" />
        <KpiCard label="Tipo" value="libre" sub="sin FK estricta" subTone="muted" />
      </KpiGrid>

      <BigCard title="Categorías de ingredientes" count={`${items.length}`}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input
            value={nuevo}
            onChange={e => setNuevo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add() }}
            placeholder="Nueva categoría..."
            style={{
              flex: 1,
              padding: '8px 12px',
              border: `1px dashed ${chipBrd}`,
              borderRadius: 8,
              fontSize: 13,
              background: inputBg,
              color: chipColor,
              outline: 'none',
              fontFamily: 'Lexend, sans-serif',
            }}
          />
          <button
            type="button"
            onClick={add}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              background: btnBg,
              color: btnColor,
              border: `1px solid ${btnBrd}`,
              cursor: 'pointer',
              fontFamily: 'Oswald, sans-serif',
            }}
          >
            + Añadir
          </button>
        </div>

        {items.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: mut }}>Sin categorías</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {items.map((it, idx) => (
              <span
                key={`${it}-${idx}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  background: chipBg,
                  border: `1px solid ${chipBrd}`,
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: chipColor,
                  fontFamily: 'Lexend, sans-serif',
                }}
              >
                {it}
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  aria-label={`Eliminar ${it}`}
                  style={{
                    color: mut, cursor: 'pointer', fontSize: 15, lineHeight: 1,
                    background: 'transparent', border: 0, padding: 0,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#B01D23')}
                  onMouseLeave={e => (e.currentTarget.style.color = mut)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </BigCard>
    </>
  )
}
