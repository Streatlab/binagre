import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useIsDark } from '@/hooks/useIsDark'
import { KpiCard, KpiGrid } from '@/components/configuracion/KpiCard'
import { BigCard } from '@/components/configuracion/BigCard'
import type {
  CategoriaIngrediente,
  CategoriaPlato,
  SeccionCarta,
} from '@/types/configuracion'

type Subtab = 'ingredientes' | 'platos' | 'secciones'

const SUBPILLS: { id: Subtab; label: string }[] = [
  { id: 'ingredientes', label: 'Ingredientes' },
  { id: 'platos',       label: 'Platos' },
  { id: 'secciones',    label: 'Secciones carta' },
]

export default function TabCategorias() {
  const isDark = useIsDark()
  const [catsIng, setCatsIng] = useState<CategoriaIngrediente[]>([])
  const [catsPlato, setCatsPlato] = useState<CategoriaPlato[]>([])
  const [secciones, setSecciones] = useState<SeccionCarta[]>([])
  const [marcas, setMarcas] = useState<{ id: string; nombre: string }[]>([])
  const [totalIng, setTotalIng] = useState(0)
  const [subtab, setSubtab] = useState<Subtab>('ingredientes')
  const [newCat, setNewCat] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    const [ing, pla, sec, mar, total] = await Promise.all([
      supabase.from('categorias_ingredientes').select('*').order('orden'),
      supabase.from('categorias_platos').select('*').order('orden'),
      supabase.from('secciones_carta').select('*').order('orden'),
      supabase.from('marcas').select('id,nombre').order('nombre'),
      supabase.from('ingredientes').select('id', { count: 'exact', head: true }),
    ])
    if (ing.error) throw ing.error
    if (pla.error) throw pla.error
    if (sec.error) throw sec.error
    if (mar.error) throw mar.error
    setCatsIng(((ing.data ?? []) as unknown as CategoriaIngrediente[]))
    setCatsPlato(((pla.data ?? []) as unknown as CategoriaPlato[]))
    setSecciones(((sec.data ?? []) as unknown as SeccionCarta[]))
    setMarcas(((mar.data ?? []) as unknown as { id: string; nombre: string }[]))
    setTotalIng(total.count ?? 0)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await refetch()
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Error cargando categorías')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function handleAdd() {
    const nombre = newCat.trim()
    if (!nombre) return
    if (subtab === 'secciones') {
      alert('Las secciones se añaden por marca — pendiente UI')
      return
    }
    const tabla = subtab === 'ingredientes' ? 'categorias_ingredientes' : 'categorias_platos'
    const lista = subtab === 'ingredientes' ? catsIng : catsPlato
    const maxOrden = lista.reduce((m, c) => Math.max(m, c.orden), 0)
    const { error } = await supabase.from(tabla).insert({ nombre, orden: maxOrden + 1 })
    if (error) { setError(error.message); return }
    setNewCat('')
    await refetch()
  }

  async function handleDeleteIngrediente(cat: CategoriaIngrediente) {
    const { count } = await supabase
      .from('ingredientes')
      .select('id', { count: 'exact', head: true })
      .eq('categoria_id', cat.id)
    if ((count ?? 0) > 0) {
      alert(`No se puede eliminar "${cat.nombre}": ${count} ingredientes la usan`)
      return
    }
    if (!confirm(`¿Eliminar categoría "${cat.nombre}"?`)) return
    const { error } = await supabase.from('categorias_ingredientes').delete().eq('id', cat.id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  async function handleDeletePlato(cat: CategoriaPlato) {
    if (!confirm(`¿Eliminar categoría "${cat.nombre}"?`)) return
    const { error } = await supabase.from('categorias_platos').delete().eq('id', cat.id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  async function handleDeleteSeccion(sec: SeccionCarta) {
    if (!confirm(`¿Eliminar sección "${sec.nombre}"?`)) return
    const { error } = await supabase.from('secciones_carta').delete().eq('id', sec.id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  const mut = isDark ? '#777777' : '#9E9588'

  if (loading) return <div style={{ padding: 24, color: mut }}>Cargando categorías…</div>
  if (error) {
    return (
      <div
        style={{
          padding: 16,
          background: isDark ? '#3a1a1a' : '#FCE0E2',
          color: isDark ? '#ff8080' : '#B01D23',
          borderRadius: 12,
        }}
      >
        {error}
      </div>
    )
  }

  const subpillActive = (id: Subtab) => id === subtab
  const subpillBg     = (id: Subtab) => subpillActive(id)
    ? (isDark ? '#2a2600' : '#FFF3B8')
    : (isDark ? '#141414' : '#ffffff')
  const subpillColor  = (id: Subtab) => subpillActive(id)
    ? (isDark ? '#e8f442' : '#5a4d0a')
    : (isDark ? '#cccccc' : '#555555')
  const subpillBorder = (id: Subtab) => subpillActive(id)
    ? (isDark ? '#4a4000' : '#E8D066')
    : (isDark ? '#2a2a2a' : '#E9E1D0')

  const chipBg      = isDark ? '#1e1e1e' : '#FAF4E4'
  const chipBorder  = isDark ? '#2a2a2a' : '#E9E1D0'
  const chipColor   = isDark ? '#ffffff' : '#1A1A1A'
  const btnAddBg    = isDark ? '#2a2600' : '#FFF3B8'
  const btnAddColor = isDark ? '#e8f442' : '#5a4d0a'
  const btnAddBrd   = isDark ? '#4a4000' : '#E8D066'
  const inputBg     = isDark ? '#1e1e1e' : '#ffffff'
  const inputBrd    = isDark ? '#2a2a2a' : '#E9E1D0'

  return (
    <>
      <KpiGrid>
        <KpiCard label="Ingredientes" value={catsIng.length} sub="categorías" />
        <KpiCard label="Platos" value={catsPlato.length} sub="categorías" />
        <KpiCard label="Secciones carta" value={secciones.length} sub="por marca" />
        <KpiCard label="Uso" value={totalIng} sub="ingredientes clasificados" />
      </KpiGrid>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {SUBPILLS.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSubtab(s.id)}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: 'Oswald, sans-serif',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontWeight: subpillActive(s.id) ? 600 : 500,
              background: subpillBg(s.id),
              color: subpillColor(s.id),
              border: `1px solid ${subpillBorder(s.id)}`,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {subtab === 'ingredientes' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          <BigCard title="Ingredientes" count={String(catsIng.length)}>
            <Chips
              items={catsIng}
              onRemove={handleDeleteIngrediente}
              chipBg={chipBg}
              chipBorder={chipBorder}
              chipColor={chipColor}
              mut={mut}
            />
            <ChipAdd
              value={newCat}
              onChange={setNewCat}
              onAdd={handleAdd}
              inputBg={inputBg}
              inputBrd={inputBrd}
              inputColor={chipColor}
              btnBg={btnAddBg}
              btnColor={btnAddColor}
              btnBrd={btnAddBrd}
            />
          </BigCard>
          <BigCard title="Platos" count={String(catsPlato.length)}>
            <Chips
              items={catsPlato}
              onRemove={handleDeletePlato}
              chipBg={chipBg}
              chipBorder={chipBorder}
              chipColor={chipColor}
              mut={mut}
            />
            <div style={{ marginTop: 12, fontSize: 11, color: mut }}>
              Cambia a "Platos" para añadir
            </div>
          </BigCard>
        </div>
      )}

      {subtab === 'platos' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          <BigCard title="Platos" count={String(catsPlato.length)}>
            <Chips
              items={catsPlato}
              onRemove={handleDeletePlato}
              chipBg={chipBg}
              chipBorder={chipBorder}
              chipColor={chipColor}
              mut={mut}
            />
            <ChipAdd
              value={newCat}
              onChange={setNewCat}
              onAdd={handleAdd}
              inputBg={inputBg}
              inputBrd={inputBrd}
              inputColor={chipColor}
              btnBg={btnAddBg}
              btnColor={btnAddColor}
              btnBrd={btnAddBrd}
            />
          </BigCard>
          <BigCard title="Ingredientes" count={String(catsIng.length)}>
            <Chips
              items={catsIng}
              onRemove={handleDeleteIngrediente}
              chipBg={chipBg}
              chipBorder={chipBorder}
              chipColor={chipColor}
              mut={mut}
            />
            <div style={{ marginTop: 12, fontSize: 11, color: mut }}>
              Cambia a "Ingredientes" para añadir
            </div>
          </BigCard>
        </div>
      )}

      {subtab === 'secciones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {marcas.length === 0 ? (
            <BigCard title="Secciones">
              <div style={{ padding: 32, textAlign: 'center', color: mut }}>
                Sin marcas registradas
              </div>
            </BigCard>
          ) : (
            marcas.map(m => {
              const secs = secciones.filter(s => s.marca_id === m.id)
              return (
                <BigCard key={m.id} title={m.nombre} count={`${secs.length} secciones`}>
                  <Chips
                    items={secs}
                    onRemove={handleDeleteSeccion}
                    chipBg={chipBg}
                    chipBorder={chipBorder}
                    chipColor={chipColor}
                    mut={mut}
                  />
                </BigCard>
              )
            })
          )}
        </div>
      )}
    </>
  )
}

interface ChipItem { id: string; nombre: string }

interface ChipsProps<T extends ChipItem> {
  items: T[]
  onRemove: (item: T) => void
  chipBg: string
  chipBorder: string
  chipColor: string
  mut: string
}

function Chips<T extends ChipItem>({ items, onRemove, chipBg, chipBorder, chipColor, mut }: ChipsProps<T>) {
  if (!items.length) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: mut, fontSize: 13 }}>
        Sin categorías
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map(it => (
        <span
          key={it.id}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            background: chipBg,
            border: `1px solid ${chipBorder}`,
            borderRadius: 8,
            fontSize: 12.5,
            fontWeight: 500,
            color: chipColor,
            fontFamily: 'Lexend, sans-serif',
          }}
        >
          {it.nombre}
          <button
            type="button"
            onClick={() => onRemove(it)}
            aria-label={`Eliminar ${it.nombre}`}
            style={{
              color: mut,
              cursor: 'pointer',
              fontSize: 15,
              lineHeight: 1,
              background: 'transparent',
              border: 0,
              padding: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#B01D23')}
            onMouseLeave={e => (e.currentTarget.style.color = mut)}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )
}

interface ChipAddProps {
  value: string
  onChange: (v: string) => void
  onAdd: () => void
  inputBg: string
  inputBrd: string
  inputColor: string
  btnBg: string
  btnColor: string
  btnBrd: string
}

function ChipAdd({ value, onChange, onAdd, inputBg, inputBrd, inputColor, btnBg, btnColor, btnBrd }: ChipAddProps) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onAdd() }}
        placeholder="Nueva categoría..."
        style={{
          flex: 1,
          padding: '8px 12px',
          border: `1px dashed ${inputBrd}`,
          borderRadius: 8,
          fontSize: 12.5,
          background: inputBg,
          color: inputColor,
          outline: 'none',
          fontFamily: 'Lexend, sans-serif',
        }}
      />
      <button
        type="button"
        onClick={onAdd}
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
  )
}
