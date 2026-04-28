import { useState } from 'react'
import { useTheme, FONT, tabActiveStyle, tabInactiveStyle, tabsContainerStyle, pageTitleStyle } from '@/styles/tokens'
import TabConteos from '@/components/inventario/TabConteos'
import TabMovimientos from '@/components/inventario/TabMovimientos'
import TabMermas from '@/components/inventario/TabMermas'
import TabAnalisisFoodCost from '@/components/inventario/TabAnalisisFoodCost'

export type PeriodoInventario = 'semana' | 'mes' | 'mes_anterior' | 'tres_meses' | 'anio'

type TabKey = 'conteos' | 'movimientos' | 'mermas' | 'foodcost'

const TABS: { key: TabKey; label: string }[] = [
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

export default function Inventario() {
  const { T, isDark } = useTheme()
  const [tab, setTab] = useState<TabKey>('conteos')
  const [periodo, setPeriodo] = useState<PeriodoInventario>('mes')

  const { desde, hasta } = getPeriodoFechas(periodo)

  return (
    <div style={{ padding: '24px 28px', minHeight: '100vh', background: T.bg, fontFamily: FONT.body }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={pageTitleStyle(T)}>Inventario</h1>

        {/* Selector periodo */}
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
      </div>

      {/* Tabs */}
      <div style={tabsContainerStyle()}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={tab === t.key ? tabActiveStyle(isDark) : tabInactiveStyle(T)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'conteos'     && <TabConteos     desde={desde} hasta={hasta} periodo={periodo} />}
      {tab === 'movimientos' && <TabMovimientos  desde={desde} hasta={hasta} />}
      {tab === 'mermas'      && <TabMermas       desde={desde} hasta={hasta} />}
      {tab === 'foodcost'    && <TabAnalisisFoodCost />}
    </div>
  )
}
