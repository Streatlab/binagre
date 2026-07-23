import { useState } from 'react'
import { useTheme, FONT } from '@/styles/tokens'
import TabsPastilla from '@/components/ui/TabsPastilla'
import { HeroCantera, PantallaCantera } from '@/components/kit/cantera'
import TabConteos from '@/components/inventario/TabConteos'
import TabMovimientos from '@/components/inventario/TabMovimientos'
import TabMermas from '@/components/inventario/TabMermas'
import TabAnalisisFoodCost from '@/components/inventario/TabAnalisisFoodCost'
import TabStockReal from '@/components/compras/TabStockReal'
import TabComprasEntradas from '@/components/compras/TabComprasEntradas'
import TabPreciosProveedor from '@/components/compras/TabPreciosProveedor'
import TabListasCompra from '@/components/compras/TabListasCompra'
import TabPricingGen from '@/components/compras/TabPricingGen'
import TabMenusMarcas from '@/components/compras/TabMenusMarcas'
import TabPatronesPrecio from '@/components/compras/TabPatronesPrecio'

export type PeriodoInventario = 'semana' | 'mes' | 'mes_anterior' | 'tres_meses' | 'anio'

type TabKey = 'stockreal' | 'entradas' | 'precios' | 'listas' | 'pricing' | 'menus' | 'patrones' | 'conteos' | 'movimientos' | 'mermas' | 'foodcost'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'stockreal',    label: 'Stock Real' },
  { key: 'entradas',     label: 'Compras' },
  { key: 'precios',      label: 'Precios Proveedor' },
  { key: 'listas',       label: 'Listas de Compra' },
  { key: 'pricing',      label: 'Pricing' },
  { key: 'menus',        label: 'Menús' },
  { key: 'patrones',     label: 'Patrones Precio' },
  { key: 'conteos',      label: 'Conteos' },
  { key: 'movimientos',  label: 'Movimientos' },
  { key: 'mermas',       label: 'Mermas' },
  { key: 'foodcost',     label: 'Análisis Food Cost' },
]

const PERIODOS: { key: PeriodoInventario; label: string }[] = [
  { key: 'semana',       label: 'Semana actual' },
  { key: 'mes',          label: 'Mes actual' },
  { key: 'mes_anterior', label: 'Mes anterior' },
  { key: 'tres_meses',   label: 'Últimos 3 meses' },
  { key: 'anio',         label: 'Año actual' },
]

export function getPeriodoFechas(periodo: PeriodoInventario): { desde: string; hasta: string } {
  const hoy = new Date()
  const iso = (d: Date) => d.toISOString().split('T')[0]

  if (periodo === 'semana') {
    const dow = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() - dow)
    return { desde: iso(lunes), hasta: iso(hoy) }
  }
  if (periodo === 'mes') {
    return {
      desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
      hasta: iso(hoy),
    }
  }
  if (periodo === 'mes_anterior') {
    const y = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear()
    const m = hoy.getMonth() === 0 ? 11 : hoy.getMonth() - 1
    return {
      desde: iso(new Date(y, m, 1)),
      hasta: iso(new Date(y, m + 1, 0)),
    }
  }
  if (periodo === 'tres_meses') {
    const desde = new Date(hoy)
    desde.setMonth(hoy.getMonth() - 3)
    return { desde: iso(desde), hasta: iso(hoy) }
  }
  // anio
  return {
    desde: iso(new Date(hoy.getFullYear(), 0, 1)),
    hasta: iso(hoy),
  }
}

const CON_PERIODO: TabKey[] = ['conteos', 'movimientos', 'mermas']

export default function Inventario() {
  const { T } = useTheme()
  const [tab, setTab] = useState<TabKey>('stockreal')
  const [periodo, setPeriodo] = useState<PeriodoInventario>('mes')

  const { desde, hasta } = getPeriodoFechas(periodo)

  return (
    <PantallaCantera embedded>
      {/* HÉROE (azul · área Compras) */}
      <HeroCantera
        area="cashflow"
        titular="Stock, compras y precios de proveedor, todo en el mismo sitio."
        resumen={<>Estás en <b>{TABS.find(t => t.key === tab)?.label ?? ''}</b></>}
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        {CON_PERIODO.includes(tab) && (
          <select
            value={periodo}
            onChange={e => setPeriodo(e.target.value as PeriodoInventario)}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: `0.5px solid ${T.brd}`,
              background: T.inp,
              color: T.pri,
              fontSize: 13,
              fontFamily: FONT.body,
              cursor: 'pointer',
            }}
          >
            {PERIODOS.map(p => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        )}
      </div>

      <TabsPastilla tabs={TABS.map(t => ({ id: t.key, label: t.label }))} activeId={tab} onChange={id => setTab(id as TabKey)} />

      <div style={{ height: 16 }} />

      {/* Tab content */}
      {tab === 'stockreal'   && <TabStockReal />}
      {tab === 'entradas'    && <TabComprasEntradas />}
      {tab === 'precios'     && <TabPreciosProveedor />}
      {tab === 'listas'      && <TabListasCompra />}
      {tab === 'pricing'     && <TabPricingGen />}
      {tab === 'menus'       && <TabMenusMarcas />}
      {tab === 'patrones'    && <TabPatronesPrecio />}
      {tab === 'conteos'     && <TabConteos     desde={desde} hasta={hasta} periodo={periodo} />}
      {tab === 'movimientos' && <TabMovimientos  desde={desde} hasta={hasta} />}
      {tab === 'mermas'      && <TabMermas       desde={desde} hasta={hasta} />}
      {tab === 'foodcost'    && <TabAnalisisFoodCost />}
    </PantallaCantera>
  )
}
