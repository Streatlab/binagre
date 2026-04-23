import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { useIsDark } from '@/hooks/useIsDark'
import { KpiCard, KpiGrid } from '@/components/configuracion/KpiCard'
import { BigCard } from '@/components/configuracion/BigCard'
import { Table, THead, TBody, TH, TR, TD } from '@/components/configuracion/ConfigTable'

interface ConfigCanal {
  id: string
  canal: string
  comision_pct: number
  coste_fijo: number
  margen_obj_pct: number
  recargo_pvp_texto: string | null
  activo: boolean
}

const ABV_MAP: Record<string, string> = {
  'uber eats': 'UE',
  'glovo': 'GL',
  'just eat': 'JE',
  'web propia': 'WEB',
  'web': 'WEB',
  'venta directa': 'DIR',
  'rushour': 'WEB',
}

const COLOR_MAP: Record<string, string> = {
  UE: '#06C167',
  GL: '#e8f442',
  JE: '#f5a623',
  WEB: '#B01D23',
  DIR: '#66aaff',
}

function abvFromCanal(canal: string): string {
  return ABV_MAP[canal.toLowerCase()] ?? canal.slice(0, 3).toUpperCase()
}

export default function TabCanales() {
  const isDark = useIsDark()
  const [canales, setCanales] = useState<ConfigCanal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('config_canales')
          .select('*')
          .order('comision_pct', { ascending: false })
        if (error) throw error
        if (cancelled) return
        setCanales(((data ?? []) as unknown as ConfigCanal[]).map(c => ({
          ...c,
          comision_pct: Number(c.comision_pct) || 0,
          coste_fijo: Number(c.coste_fijo) || 0,
          margen_obj_pct: Number(c.margen_obj_pct) || 0,
        })))
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Error cargando canales')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const kpis = useMemo(() => {
    const activos = canales.filter(c => c.activo).length
    const conCom = canales.filter(c => c.comision_pct > 0)
    const comMedia = conCom.length > 0
      ? conCom.reduce((a, c) => a + c.comision_pct, 0) / conCom.length
      : 0
    const mejor = canales
      .filter(c => c.activo)
      .sort((a, b) => a.comision_pct - b.comision_pct)[0] ?? null
    return { activos, comMedia, mejor }
  }, [canales])

  const mut = isDark ? '#777777' : '#9E9588'
  const subtle = isDark ? '#888888' : '#6E6656'

  if (loading) return <div style={{ padding: 24, color: mut }}>Cargando canales…</div>
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
        <KpiCard
          label="Canales activos"
          value={kpis.activos}
          sub={`de ${canales.length} configurados`}
          subTone="muted"
        />
        <KpiCard
          label="Comisión media"
          value={kpis.comMedia.toFixed(1)}
          unit="%"
          sub="canales con comisión"
        />
        <KpiCard
          label="Mejor margen"
          value={kpis.mejor?.canal ?? '—'}
          sub={kpis.mejor ? `${kpis.mejor.comision_pct.toFixed(1)}% comisión` : 'sin datos'}
          subTone="pos"
        />
        <KpiCard
          label="Canal #1 ventas"
          value="—"
          sub="pendiente métrica"
          subTone="muted"
        />
      </KpiGrid>

      <BigCard title="Canales de venta" count={`${canales.length} configurados`}>
        <Table>
          <THead>
            <tr>
              <TH>Canal</TH>
              <TH>ABV</TH>
              <TH num>Comisión</TH>
              <TH num>Coste fijo</TH>
              <TH>Recargo sobre PVP</TH>
            </tr>
          </THead>
          <TBody>
            {canales.map(c => {
              const abv = abvFromCanal(c.canal)
              const color = COLOR_MAP[abv] ?? '#888'
              return (
                <TR key={c.id}>
                  <TD bold>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: color,
                        marginRight: 10,
                        verticalAlign: 'middle',
                      }}
                    />
                    {c.canal}
                  </TD>
                  <TD>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        background: '#1A1A1A',
                        color: '#ffffff',
                        borderRadius: 4,
                        fontSize: 10,
                        letterSpacing: '0.04em',
                        fontWeight: 700,
                        fontFamily: 'Oswald, sans-serif',
                      }}
                    >
                      {abv}
                    </span>
                  </TD>
                  <TD num bold>{c.comision_pct.toFixed(1)} %</TD>
                  <TD num bold>{fmtEur(c.coste_fijo)}</TD>
                  <TD style={{ fontSize: 12.5, color: subtle }}>{c.recargo_pvp_texto ?? '—'}</TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      </BigCard>
    </>
  )
}
