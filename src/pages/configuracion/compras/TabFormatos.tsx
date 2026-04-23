import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useIsDark } from '@/hooks/useIsDark'
import { KpiCard, KpiGrid } from '@/components/configuracion/KpiCard'
import { BigCard } from '@/components/configuracion/BigCard'
import { Table, THead, TBody, TH, TR, TD } from '@/components/configuracion/ConfigTable'
import type { FormatoCompra } from '@/types/configuracion'

const FORMATOS_BASE = new Set(['Kilo (kg)', 'Litro (L)', 'Unidad (ud)', 'Gramo (g)', 'Mililitro (ml)', 'Docena'])

type Subtab = 'formatos' | 'estandar' | 'minimas'

const SUBPILLS: { id: Subtab; label: string }[] = [
  { id: 'formatos', label: 'Formatos compra' },
  { id: 'estandar', label: 'Unidades estándar' },
  { id: 'minimas',  label: 'Unidades mínimas' },
]

export default function TabFormatos() {
  const isDark = useIsDark()
  const [formatos, setFormatos] = useState<FormatoCompra[]>([])
  const [subtab, setSubtab] = useState<Subtab>('formatos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('formatos_compra')
          .select('*')
          .order('orden')
        if (error) throw error
        if (cancelled) return
        setFormatos(((data ?? []) as unknown as FormatoCompra[]).map(f => ({
          ...f,
          factor_conversion: f.factor_conversion != null ? Number(f.factor_conversion) : null,
        })))
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Error cargando formatos')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const mut = isDark ? '#777777' : '#9E9588'

  if (loading) return <div style={{ padding: 24, color: mut }}>Cargando formatos…</div>
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

  const grupoLabel = (g: string) => g.charAt(0).toUpperCase() + g.slice(1)

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

  return (
    <>
      <KpiGrid>
        <KpiCard label="Formatos" value={formatos.length} sub="de compra" />
        <KpiCard label="U. estándar" value={3} sub="g · ml · ud" />
        <KpiCard label="U. mínimas" value={4} sub="g · ml · ud · porción" />
        <KpiCard label="Grupos" value={3} sub="sólido · líquido · pieza" />
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

      {subtab === 'formatos' && (
        <BigCard title="Formatos de compra" count="cómo se compra a proveedores">
          <Table>
            <THead>
              <tr>
                <TH>Formato</TH>
                <TH>Grupo</TH>
                <TH>Unidad base</TH>
                <TH num>Factor conv.</TH>
                <TH>Ejemplo</TH>
              </tr>
            </THead>
            <TBody>
              {formatos.map(f => (
                <TR key={f.id}>
                  <TD bold={FORMATOS_BASE.has(f.nombre)}>{f.nombre}</TD>
                  <TD muted>{grupoLabel(f.grupo)}</TD>
                  <TD muted>{f.unidad_base}</TD>
                  <TD num bold={f.factor_conversion != null}>
                    {f.factor_conversion == null
                      ? <span style={{ color: mut, fontWeight: 400 }}>variable</span>
                      : f.factor_conversion.toLocaleString('es-ES')}
                  </TD>
                  <TD muted>{f.ejemplo ?? '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </BigCard>
      )}

      {(subtab === 'estandar' || subtab === 'minimas') && (
        <BigCard title={subtab === 'estandar' ? 'Unidades estándar' : 'Unidades mínimas'}>
          <div style={{ padding: 32, textAlign: 'center', color: mut }}>
            Pendiente implementación
          </div>
        </BigCard>
      )}
    </>
  )
}
