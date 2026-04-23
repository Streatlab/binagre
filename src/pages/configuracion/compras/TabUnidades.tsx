import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useIsDark } from '@/hooks/useIsDark'
import { KpiCard, KpiGrid } from '@/components/configuracion/KpiCard'
import { BigCard } from '@/components/configuracion/BigCard'

type Clave = 'formatos_compra' | 'unidades_estandar' | 'unidades_minimas'

const COLUMNAS: { clave: Clave; titulo: string; placeholder: string }[] = [
  { clave: 'formatos_compra',   titulo: 'Formatos de compra',   placeholder: 'Nuevo formato...' },
  { clave: 'unidades_estandar', titulo: 'Unidades estándar',    placeholder: 'Nueva unidad...' },
  { clave: 'unidades_minimas',  titulo: 'Unidades mínimas',     placeholder: 'Nueva unidad mín...' },
]

interface ListState {
  clave: Clave
  items: string[]
}

export default function TabUnidades() {
  const isDark = useIsDark()
  const [listas, setListas] = useState<ListState[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = async () => {
    const { data, error } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .in('clave', COLUMNAS.map(c => c.clave))
    if (error) throw error
    const byKey = new Map<string, string>()
    for (const r of (data ?? []) as { clave: string; valor: string }[]) byKey.set(r.clave, r.valor)
    const next: ListState[] = COLUMNAS.map(c => {
      let items: string[] = []
      const raw = byKey.get(c.clave)
      if (raw) {
        try { items = JSON.parse(raw) as string[] } catch { items = [] }
      }
      return { clave: c.clave, items: Array.isArray(items) ? items : [] }
    })
    setListas(next)
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

  const persist = async (clave: Clave, items: string[]) => {
    const { error } = await supabase
      .from('configuracion')
      .upsert({ clave, valor: JSON.stringify(items) }, { onConflict: 'clave' })
    if (error) setError(error.message)
  }

  const add = async (clave: Clave, valor: string) => {
    const val = valor.trim()
    if (!val) return
    setListas(prev => prev.map(l => {
      if (l.clave !== clave) return l
      if (l.items.includes(val)) return l
      const next = [...l.items, val]
      persist(clave, next)
      return { ...l, items: next }
    }))
  }

  const remove = async (clave: Clave, idx: number) => {
    setListas(prev => prev.map(l => {
      if (l.clave !== clave) return l
      const next = l.items.filter((_, i) => i !== idx)
      persist(clave, next)
      return { ...l, items: next }
    }))
  }

  const mut = isDark ? '#777' : '#9E9588'

  if (loading) return <div style={{ padding: 24, color: mut }}>Cargando unidades…</div>
  if (error) {
    return (
      <div style={{ padding: 16, background: isDark ? '#3a1a1a' : '#FCE0E2', color: isDark ? '#ff8080' : '#B01D23', borderRadius: 12 }}>
        {error}
      </div>
    )
  }

  return (
    <>
      <KpiGrid>
        <KpiCard label="Formatos" value={listas[0]?.items.length ?? 0} sub="de compra" />
        <KpiCard label="Estándar" value={listas[1]?.items.length ?? 0} sub="Kg · L · Ud." />
        <KpiCard label="Mínimas" value={listas[2]?.items.length ?? 0} sub="gr · ml · ud" />
        <KpiCard label="Fuente" value="legacy" sub="configuracion.* JSON" subTone="muted" />
      </KpiGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
        {COLUMNAS.map((col, i) => {
          const lista = listas[i] ?? { clave: col.clave, items: [] }
          return (
            <ListaEditable
              key={col.clave}
              titulo={col.titulo}
              placeholder={col.placeholder}
              items={lista.items}
              onAdd={v => add(col.clave, v)}
              onRemove={idx => remove(col.clave, idx)}
            />
          )
        })}
      </div>
    </>
  )
}

function ListaEditable({
  titulo, placeholder, items, onAdd, onRemove,
}: {
  titulo: string
  placeholder: string
  items: string[]
  onAdd: (v: string) => void
  onRemove: (idx: number) => void
}) {
  const isDark = useIsDark()
  const [nuevo, setNuevo] = useState('')

  const mut = isDark ? '#777' : '#9E9588'
  const chipBg = isDark ? '#1e1e1e' : '#FAF4E4'
  const chipBrd = isDark ? '#2a2a2a' : '#E9E1D0'
  const chipColor = isDark ? '#ffffff' : '#1A1A1A'
  const inputBg = isDark ? '#1e1e1e' : '#ffffff'
  const btnBg = isDark ? '#2a2600' : '#FFF3B8'
  const btnColor = isDark ? '#e8f442' : '#5a4d0a'
  const btnBrd = isDark ? '#4a4000' : '#E8D066'

  const handleAdd = () => {
    onAdd(nuevo)
    setNuevo('')
  }

  return (
    <BigCard title={titulo} count={`${items.length}`}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input
          value={nuevo}
          onChange={e => setNuevo(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '7px 10px',
            border: `1px dashed ${chipBrd}`,
            borderRadius: 8,
            fontSize: 12.5,
            background: inputBg,
            color: chipColor,
            outline: 'none',
            fontFamily: 'Lexend, sans-serif',
          }}
        />
        <button
          type="button"
          onClick={handleAdd}
          style={{
            padding: '7px 12px',
            borderRadius: 8,
            fontSize: 11,
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
          +
        </button>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: mut, fontSize: 12 }}>Sin items</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {items.map((it, idx) => (
            <span
              key={`${it}-${idx}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                background: chipBg,
                border: `1px solid ${chipBrd}`,
                borderRadius: 6,
                fontSize: 12,
                color: chipColor,
                fontFamily: 'Lexend, sans-serif',
              }}
            >
              {it}
              <button
                type="button"
                onClick={() => onRemove(idx)}
                aria-label={`Eliminar ${it}`}
                style={{ color: mut, cursor: 'pointer', fontSize: 14, lineHeight: 1, background: 'transparent', border: 0, padding: 0 }}
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
  )
}
