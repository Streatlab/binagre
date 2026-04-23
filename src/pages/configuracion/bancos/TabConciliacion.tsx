import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { useIsDark } from '@/hooks/useIsDark'
import { KpiCard, KpiGrid } from '@/components/configuracion/KpiCard'
import { BigCard } from '@/components/configuracion/BigCard'
import { StatusTag } from '@/components/configuracion/StatusTag'
import { Table, THead, TBody, TH, TR, TD, TotalTR } from '@/components/configuracion/ConfigTable'
import type { CategoriaIngreso, CategoriaGasto, TipoGasto, CanalAbv } from '@/types/configuracion'

type SubPill = 'categorias' | 'reglas'

const CANAL_BG: Record<CanalAbv, { bg: string; color: string }> = {
  UE:  { bg: '#06C167', color: '#ffffff' },
  GL:  { bg: '#a89a20', color: '#ffffff' },
  JE:  { bg: '#f5a623', color: '#ffffff' },
  WEB: { bg: '#B01D23', color: '#ffffff' },
  DIR: { bg: '#66aaff', color: '#ffffff' },
}

function CodigoIngreso({ codigo, canal }: { codigo: string; canal: CanalAbv | null }) {
  const s = canal ? CANAL_BG[canal] : { bg: '#1A1A1A', color: '#ffffff' }
  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '2px 8px',
        borderRadius: 5,
        fontSize: 10,
        letterSpacing: '0.06em',
        fontWeight: 700,
        textTransform: 'uppercase',
        background: s.bg,
        color: s.color,
        fontFamily: 'Oswald, sans-serif',
      }}
    >
      {codigo}
    </span>
  )
}

function CodigoGasto({ codigo }: { codigo: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '2px 8px',
        borderRadius: 5,
        fontSize: 10,
        letterSpacing: '0.06em',
        fontWeight: 700,
        textTransform: 'uppercase',
        background: '#1A1A1A',
        color: '#ffffff',
        fontFamily: 'Oswald, sans-serif',
      }}
    >
      {codigo}
    </span>
  )
}

const TIPO_LABEL: Record<TipoGasto, string> = {
  fijo: 'Fijo',
  var:  'Var',
  pers: 'Pers',
  mkt:  'Mkt',
}

export default function TabConciliacion() {
  const isDark = useIsDark()
  const [ingresos, setIngresos] = useState<CategoriaIngreso[]>([])
  const [gastos, setGastos] = useState<CategoriaGasto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pill, setPill] = useState<SubPill>('categorias')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const [iRes, gRes] = await Promise.all([
          supabase.from('categorias_ingresos').select('*').order('importe_mes', { ascending: false }),
          supabase.from('categorias_gastos').select('*').order('importe_mes', { ascending: false }),
        ])
        if (iRes.error) throw iRes.error
        if (gRes.error) throw gRes.error
        if (cancelled) return
        setIngresos((iRes.data as CategoriaIngreso[]) ?? [])
        setGastos((gRes.data as CategoriaGasto[]) ?? [])
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Error cargando categorías')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const muted = isDark ? '#777' : '#9E9588'
  const totalIng = ingresos.reduce((a, r) => a + Number(r.importe_mes ?? 0), 0)
  const totalGas = gastos.reduce((a, r) => a + Number(r.importe_mes ?? 0), 0)
  const tiposGasto = Array.from(new Set(gastos.map(g => g.tipo)))

  if (loading) {
    return <div style={{ padding: 24, color: muted }}>Cargando categorías…</div>
  }
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

  const subPillStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 14px',
    borderRadius: 6,
    background: active ? '#FFF3B8' : (isDark ? '#1e1e1e' : '#ffffff'),
    border: `1px solid ${active ? '#E8D066' : (isDark ? '#2a2a2a' : '#E9E1D0')}`,
    color: active ? '#5a4d0a' : (isDark ? '#cccccc' : '#555555'),
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'Lexend, sans-serif',
    cursor: 'pointer',
  })

  return (
    <>
      <KpiGrid>
        <KpiCard
          label="Cat. ingresos"
          value={ingresos.length}
          sub="por canal"
        />
        <KpiCard
          label="Cat. gastos"
          value={gastos.length}
          sub={tiposGasto.length > 0 ? tiposGasto.join(' · ') : 'sin tipos'}
        />
        <KpiCard
          label="Ingresos mes"
          value={fmtEur(totalIng)}
          sub={ingresos.length > 0 ? `${ingresos.length} categoría${ingresos.length !== 1 ? 's' : ''}` : 'sin datos'}
        />
        <KpiCard
          label="Gastos mes"
          value={fmtEur(totalGas)}
          sub={gastos.length > 0 ? `${gastos.length} categoría${gastos.length !== 1 ? 's' : ''}` : 'sin datos'}
        />
      </KpiGrid>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button type="button" style={subPillStyle(pill === 'categorias')} onClick={() => setPill('categorias')}>
          Categorías
        </button>
        <button type="button" style={subPillStyle(pill === 'reglas')} onClick={() => setPill('reglas')}>
          Reglas automáticas
        </button>
      </div>

      {pill === 'reglas' ? (
        <BigCard title="Reglas automáticas">
          <div style={{ padding: 24, color: muted, textAlign: 'center' }}>Pendiente</div>
        </BigCard>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          <BigCard title={`Ingresos · ${ingresos.length} categoría${ingresos.length !== 1 ? 's' : ''}`}>
            {ingresos.length === 0 ? (
              <div style={{ padding: 24, color: muted, textAlign: 'center' }}>Sin categorías.</div>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Código</TH>
                    <TH>Categoría</TH>
                    <TH num>Mes</TH>
                    <TH num>%</TH>
                  </tr>
                </THead>
                <TBody>
                  {ingresos.map(r => (
                    <TR key={r.id}>
                      <TD><CodigoIngreso codigo={r.codigo} canal={r.canal_abv} /></TD>
                      <TD>{r.nombre}</TD>
                      <TD num>{fmtEur(r.importe_mes)}</TD>
                      <TD num muted>{Number(r.pct_mes ?? 0).toFixed(0)} %</TD>
                    </TR>
                  ))}
                  <TotalTR>
                    <TD bold muted>TOTAL</TD>
                    <TD>—</TD>
                    <TD num bold>{fmtEur(totalIng)}</TD>
                    <TD num bold>100 %</TD>
                  </TotalTR>
                </TBody>
              </Table>
            )}
          </BigCard>

          <BigCard title={`Gastos · ${gastos.length} categoría${gastos.length !== 1 ? 's' : ''}`}>
            {gastos.length === 0 ? (
              <div style={{ padding: 24, color: muted, textAlign: 'center' }}>Sin categorías.</div>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Código</TH>
                    <TH>Categoría</TH>
                    <TH>Tipo</TH>
                    <TH num>Mes</TH>
                  </tr>
                </THead>
                <TBody>
                  {gastos.map(r => (
                    <TR key={r.id}>
                      <TD><CodigoGasto codigo={r.codigo} /></TD>
                      <TD>{r.nombre}</TD>
                      <TD>
                        <StatusTag variant={r.tipo}>{TIPO_LABEL[r.tipo]}</StatusTag>
                      </TD>
                      <TD num>{fmtEur(r.importe_mes)}</TD>
                    </TR>
                  ))}
                  <TotalTR>
                    <TD bold muted>TOTAL</TD>
                    <TD>—</TD>
                    <TD>—</TD>
                    <TD num bold>{fmtEur(totalGas)}</TD>
                  </TotalTR>
                </TBody>
              </Table>
            )}
          </BigCard>
        </div>
      )}
    </>
  )
}
