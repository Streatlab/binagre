import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, cardStyle, kpiLabelStyle, kpiValueStyle, dividerStyle, FONT, CANALES } from '@/styles/tokens'
import { rangoPeriodo } from '@/lib/dateRange'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'

interface ConfigCanal {
  id: string
  canal: string
  comision_pct: number
  coste_fijo: number
  margen_obj_pct: number
  activo: boolean
}

type Platform = 'UE' | 'GL' | 'JE'

const LABEL: Record<Platform, string> = { UE: 'Uber Eats', GL: 'Glovo', JE: 'Just Eat' }

function colorPorNombre(n: string): string {
  const s = n.toLowerCase()
  if (s.includes('uber')) return CANALES.find(c => c.id === 'uber')?.color ?? '#06C167'
  if (s.includes('glovo')) return CANALES.find(c => c.id === 'glovo')?.color ?? '#e8f442'
  if (s.includes('just')) return CANALES.find(c => c.id === 'je')?.color ?? '#f5a623'
  if (s.includes('web') || s.includes('rushour')) return CANALES.find(c => c.id === 'web')?.color ?? '#B01D23'
  return CANALES.find(c => c.id === 'dir')?.color ?? '#66aaff'
}

function matchCanal(c: ConfigCanal, key: Platform): boolean {
  const s = c.canal.toLowerCase()
  if (key === 'UE') return s.includes('uber')
  if (key === 'GL') return s.includes('glovo')
  return s.includes('just')
}

function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(2).replace('.', ',') + '%'
}

function colorPlat(key: Platform, isDark: boolean): string {
  if (key === 'UE') return CANALES.find(c => c.id === 'uber')!.color
  if (key === 'JE') return CANALES.find(c => c.id === 'je')!.color
  // Glovo tiene texto específico según tema
  return isDark ? '#e8f442' : '#8a7800'
}

export default function TabCanales() {
  const { T, isDark } = useTheme()
  const [canales, setCanales] = useState<ConfigCanal[]>([])
  const [tms, setTms] = useState<Record<Platform, number>>({ UE: 0, GL: 0, JE: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    const [cRes, fRes] = await Promise.all([
      supabase.from('config_canales').select('*').order('comision_pct', { ascending: false }),
      supabase.from('v_facturacion_marca').select('*').gte('fecha', rangoPeriodo('30d')[0]).lte('fecha', rangoPeriodo('30d')[1]),
    ])
    if (cRes.error) throw cRes.error
    if (fRes.error) throw fRes.error

    setCanales(((cRes.data ?? []) as unknown as ConfigCanal[]).map(c => ({
      ...c,
      comision_pct: Number(c.comision_pct) || 0,
      coste_fijo: Number(c.coste_fijo) || 0,
      margen_obj_pct: Number(c.margen_obj_pct) || 0,
    })))

    const fact = (fRes.data ?? []) as any[]
    const sum = (k: string) => fact.reduce((a, x) => a + Number(x[k] ?? 0), 0)
    const pedidos = fact.reduce((a, x) => a + Number(x.total_pedidos ?? 0), 0)
    const ventas = { UE: sum('ue_bruto'), GL: sum('gl_bruto'), JE: sum('je_bruto') }
    const totalVentas = ventas.UE + ventas.GL + ventas.JE
    const TM_FALLBACK = 20
    const next: Record<Platform, number> = { UE: TM_FALLBACK, GL: TM_FALLBACK, JE: TM_FALLBACK }
    if (totalVentas > 0 && pedidos > 0) {
      const pedUE = pedidos * (ventas.UE / totalVentas)
      const pedGL = pedidos * (ventas.GL / totalVentas)
      const pedJE = pedidos * (ventas.JE / totalVentas)
      if (pedUE > 0) next.UE = ventas.UE / pedUE
      if (pedGL > 0) next.GL = ventas.GL / pedGL
      if (pedJE > 0) next.JE = ventas.JE / pedJE
    }
    setTms(next)
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  async function update(id: string, campo: string, valor: number) {
    const { error } = await supabase.from('config_canales').update({ [campo]: valor }).eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  const comisionNeta = useMemo<Record<Platform, number>>(() => {
    const calc = (k: Platform): number => {
      const c = canales.find(x => matchCanal(x, k))
      if (!c) return NaN
      const tm = tms[k]
      if (tm <= 0) return c.comision_pct
      return c.comision_pct + (c.coste_fijo / tm) * 100
    }
    return { UE: calc('UE'), GL: calc('GL'), JE: calc('JE') }
  }, [canales, tms])

  const mejorCanal: Platform = useMemo(() => {
    const vals: [Platform, number][] = [
      ['UE', comisionNeta.UE], ['GL', comisionNeta.GL], ['JE', comisionNeta.JE],
    ]
    return vals.filter(([, v]) => Number.isFinite(v)).sort((a, b) => a[1] - b[1])[0]?.[0] ?? 'UE'
  }, [comisionNeta])

  if (loading) return <div style={{ padding: 24, color: T.mut, fontFamily: FONT.body }}>Cargando canales…</div>
  if (error) {
    return (
      <div style={{ padding: 16, background: '#B01D2320', color: '#B01D23', borderRadius: 10, fontFamily: FONT.body }}>
        {error}
      </div>
    )
  }

  const margenNetoMejor = 100 - (comisionNeta[mejorCanal] ?? 0)

  const th: React.CSSProperties = {
    padding: '12px 16px',
    fontFamily: FONT.heading,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '1.3px',
    color: T.mut,
    fontWeight: 500,
    background: T.bg,
    borderBottom: `1px solid ${T.brd}`,
    textAlign: 'left',
  }
  const thNum: React.CSSProperties = { ...th, textAlign: 'right' }
  const td: React.CSSProperties = { padding: '12px 16px', fontFamily: FONT.body, fontSize: 13, color: T.pri }

  // Semáforo comisión neta (FIX 1.9)
  const colorComision = (pct: number): string => {
    if (!Number.isFinite(pct)) return T.mut
    if (pct <= 3.5) return isDark ? '#5DCAA5' : '#1D9E75'
    if (pct <= 4.5) return isDark ? '#F5C36B' : '#BA7517'
    return isDark ? '#F09595' : '#A32D2D'
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 22 }}>
        <div style={cardStyle(T)}>
          <div style={{ ...kpiLabelStyle(T), marginBottom: 8 }}>Comisión óptima neta</div>
          <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginBottom: 10 }}>
            real sobre ticket medio últimos 30 días
          </div>
          <div style={dividerStyle(T)} />
          {(['UE', 'GL', 'JE'] as const).map((k, idx, arr) => (
            <div
              key={k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '7px 0',
                borderBottom: idx < arr.length - 1 ? `0.5px solid ${T.brd}` : 'none',
              }}
            >
              <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{LABEL[k]}</span>
              <span
                style={{
                  fontFamily: FONT.heading,
                  fontSize: 16,
                  fontWeight: 600,
                  color: colorComision(comisionNeta[k]),
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtPct(comisionNeta[k])}
              </span>
            </div>
          ))}
        </div>

        <div style={cardStyle(T)}>
          <div style={{ ...kpiLabelStyle(T), marginBottom: 8 }}>Mejor margen plataforma</div>
          <div
            style={{
              fontFamily: FONT.heading,
              fontSize: 64,
              fontWeight: 500,
              color: T.pri,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtPct(margenNetoMejor)}
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 14, color: colorPlat(mejorCanal, isDark), marginTop: 8, fontWeight: 500 }}>
            {LABEL[mejorCanal]}
          </div>
        </div>
      </div>

      <ConfigGroupCard title="Canales de venta" subtitle={`${canales.length}`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Canal</th>
                <th style={thNum}>Comisión</th>
                <th style={thNum}>Coste fijo</th>
                <th style={thNum}>Margen deseado</th>
              </tr>
            </thead>
            <tbody>
              {canales.map(c => (
                <tr key={c.id} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                  <td style={{ ...td, fontWeight: 600 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: colorPorNombre(c.canal),
                        marginRight: 10,
                        verticalAlign: 'middle',
                      }}
                    />
                    {c.canal}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <InlineEdit
                      value={c.comision_pct}
                      type="percent" align="right" min={0} max={100} step={0.01}
                      onSubmit={(v) => update(c.id, 'comision_pct', typeof v === 'number' ? v : parseFloat(String(v)))}
                    />
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <InlineEdit
                      value={c.coste_fijo}
                      type="currency" align="right" min={0} step={0.01}
                      onSubmit={(v) => update(c.id, 'coste_fijo', typeof v === 'number' ? v : parseFloat(String(v)))}
                    />
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <InlineEdit
                      value={c.margen_obj_pct}
                      type="percent" align="right" min={0} max={100} step={0.01}
                      onSubmit={(v) => update(c.id, 'margen_obj_pct', typeof v === 'number' ? v : parseFloat(String(v)))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ConfigGroupCard>
    </>
  )
}
