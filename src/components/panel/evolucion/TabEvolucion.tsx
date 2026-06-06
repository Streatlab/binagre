/**
 * Tab Evolución — Panel Global
 * Reutiliza las cards reales del Resumen (CardVentas, CardPedidosTM,
 * ColFacturacionCanal, ColDiasPico) con la MISMA lógica de cálculo,
 * y añade una capa de comparación temporal (vs semana / mes / año anterior)
 * controlada por subtabs a la derecha. Titular dinámico arriba con datos vivos.
 * Sin datos hardcodeados: todo lee de facturacion_diario + objetivos.
 */
import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { calcNetoPorCanal, loadConfigCanales, recargarConfigCanales, loadMarcasPorCanal, type CanalConfig, type MarcasPorCanal } from '@/lib/panel/calcNetoPlataforma'
import { fmtEur } from '@/lib/format'
import { COLOR, LEXEND, OSWALD, row3, cardBig, lbl, SUBTABS } from '../resumen/tokens'
import CardVentas from '../resumen/CardVentas'
import CardPedidosTM from '../resumen/CardPedidosTM'
import ColFacturacionCanal from '../resumen/ColFacturacionCanal'
import ColDiasPico, { type DiaPico } from '../resumen/ColDiasPico'
import type { RowFacturacion, CanalStat, ObjetivosVentas } from '../resumen/types'

interface Props {
  rowsPeriodo: RowFacturacion[]
  rowsAll: RowFacturacion[]
  fechaDesde: Date
  fechaHasta: Date
  canalesFiltro: string[]
  onFiltrarDiaSemana?: (idxDow: number) => void
}

type Comparar = 'semana' | 'mes' | 'anio'

const NOMBRES_DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const COLORES_DIAS = [COLOR.diaLun, COLOR.diaMar, COLOR.diaMie, COLOR.diaJue, COLOR.diaVie, COLOR.diaSab, COLOR.diaDom]

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function startOfWeekStr(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return toLocalDateStr(monday)
}
function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
// Desplaza un rango hacia atrás según el modo de comparación
function shiftRango(desde: Date, hasta: Date, modo: Comparar): { desde: string; hasta: string } {
  const d = new Date(desde), h = new Date(hasta)
  if (modo === 'semana') { d.setDate(d.getDate() - 7); h.setDate(h.getDate() - 7) }
  else if (modo === 'mes') { d.setMonth(d.getMonth() - 1); h.setMonth(h.getMonth() - 1) }
  else { d.setFullYear(d.getFullYear() - 1); h.setFullYear(h.getFullYear() - 1) }
  return { desde: toLocalDateStr(d), hasta: toLocalDateStr(h) }
}

export default function TabEvolucion({
  rowsPeriodo, rowsAll, fechaDesde, fechaHasta, canalesFiltro, onFiltrarDiaSemana,
}: Props) {
  const [comparar, setComparar] = useState<Comparar>(() => (localStorage.getItem('evolucion_comparar') as Comparar) || 'semana')
  const setCompararPersist = useCallback((c: Comparar) => {
    setComparar(c); localStorage.setItem('evolucion_comparar', c)
  }, [])

  const [objetivos, setObjetivos] = useState<ObjetivosVentas>({ diario: 0, semanal: 0, mensual: 0, anual: 0 })
  const [configCanales, setConfigCanales] = useState<Record<string, CanalConfig>>({})
  const [marcasPorCanal, setMarcasPorCanal] = useState<MarcasPorCanal>({ uber: 1, glovo: 1, je: 1, web: 1, dir: 1 })

  useEffect(() => {
    loadConfigCanales().then(setConfigCanales)
    loadMarcasPorCanal().then(setMarcasPorCanal)
    const onChange = () => { recargarConfigCanales().then(setConfigCanales); loadMarcasPorCanal().then(setMarcasPorCanal) }
    window.addEventListener('config_canales:changed', onChange)
    return () => window.removeEventListener('config_canales:changed', onChange)
  }, [])

  const loadObjetivos = useCallback(async () => {
    const [resObj, resDias] = await Promise.all([
      supabase.from('objetivos').select('tipo,importe').in('tipo', ['diario', 'semanal', 'mensual', 'anual']),
      supabase.from('objetivos_dia_semana').select('dia,importe'),
    ])
    const overrides: Partial<Record<'diario' | 'semanal' | 'mensual' | 'anual', number>> = {}
    for (const r of (resObj.data ?? []) as { tipo: string; importe: number }[]) {
      if (r.tipo === 'diario' || r.tipo === 'semanal' || r.tipo === 'mensual' || r.tipo === 'anual') overrides[r.tipo] = Number(r.importe)
    }
    const dias = (resDias.data ?? []) as { dia: number; importe: number }[]
    const findDia = (d: number) => Number(dias.find(x => x.dia === d)?.importe || 0)
    const sumaSemana = dias.reduce((a, d) => a + Number(d.importe || 0), 0)
    const hoyD = new Date()
    const ano = hoyD.getFullYear()
    const diasEnMes = new Date(ano, hoyD.getMonth() + 1, 0).getDate()
    const esBis = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0
    const dAno = esBis ? 366 : 365
    const diaActual = hoyD.getDay() === 0 ? 7 : hoyD.getDay()
    const mediaDia = sumaSemana / 7
    const use = (k: 'diario' | 'semanal' | 'mensual' | 'anual') => overrides[k] !== undefined && (overrides[k] as number) > 0
    setObjetivos({
      diario:  use('diario')  ? (overrides.diario  as number) : findDia(diaActual),
      semanal: use('semanal') ? (overrides.semanal as number) : sumaSemana,
      mensual: use('mensual') ? (overrides.mensual as number) : mediaDia * diasEnMes,
      anual:   use('anual')   ? (overrides.anual   as number) : mediaDia * dAno,
    })
  }, [])
  useEffect(() => { loadObjetivos() }, [loadObjetivos])

  const diasConDatosPeriodo = useMemo(
    () => new Set(rowsPeriodo.filter(r => (r.total_bruto || 0) > 0).map(r => r.fecha)).size,
    [rowsPeriodo]
  )

  const canalStats: CanalStat[] = useMemo(() => {
    const filt = canalesFiltro.length > 0
    const ids: Array<CanalStat['id']> = ['uber', 'glovo', 'je', 'web', 'dir']
    const visibles = filt ? ids.filter(id => canalesFiltro.includes(id)) : ids
    const labels: Record<CanalStat['id'], string> = { uber: 'Uber Eats', glovo: 'Glovo', je: 'Just Eat', web: 'Web', dir: 'Directa' }
    const colores: Record<CanalStat['id'], string> = { uber: COLOR.uber, glovo: COLOR.glovo, je: COLOR.je, web: COLOR.webSL, dir: COLOR.directa }
    const totalBruto = rowsPeriodo.reduce((a, r) => a + (r.total_bruto || 0), 0)
    return visibles.map(id => {
      const brutoKey = `${id === 'dir' ? 'directa' : id}_bruto` as keyof RowFacturacion
      const pedKey = `${id === 'dir' ? 'directa' : id}_pedidos` as keyof RowFacturacion
      const bruto = rowsPeriodo.reduce((a, r) => a + (Number(r[brutoKey]) || 0), 0)
      const pedidos = rowsPeriodo.reduce((a, r) => a + (Number(r[pedKey]) || 0), 0)
      const { neto, margenPct } = calcNetoPorCanal(id, bruto, pedidos, { modo: 'agregado_canal', marcasPorCanal, fechaDesde, fechaHasta, configCanales, diasConDatos: diasConDatosPeriodo })
      return { id, label: labels[id], color: colores[id], bruto, neto, pedidos, pct: totalBruto > 0 ? (bruto / totalBruto) * 100 : 0, ticket: pedidos > 0 ? bruto / pedidos : 0, margen: margenPct }
    })
  }, [rowsPeriodo, canalesFiltro, configCanales, marcasPorCanal, fechaDesde, fechaHasta, diasConDatosPeriodo])

  const ventasPeriodo = useMemo(() => rowsPeriodo.reduce((a, r) => a + (r.total_bruto || 0), 0), [rowsPeriodo])
  const pedidosPeriodo = useMemo(() => rowsPeriodo.reduce((a, r) => a + (r.total_pedidos || 0), 0), [rowsPeriodo])
  const tmBruto = pedidosPeriodo > 0 ? ventasPeriodo / pedidosPeriodo : 0
  const netoEstimado = useMemo(() => canalStats.reduce((a, c) => a + c.neto, 0), [canalStats])
  const tmNeto = pedidosPeriodo > 0 ? netoEstimado / pedidosPeriodo : 0
  const pctNeto = ventasPeriodo > 0 ? (netoEstimado / ventasPeriodo) * 100 : 0

  // Comparación temporal real según subtab
  const comp = useMemo(() => {
    const { desde, hasta } = shiftRango(fechaDesde, fechaHasta, comparar)
    const prev = rowsAll.filter(r => r.fecha >= desde && r.fecha <= hasta)
    const pVentas = prev.reduce((a, r) => a + (r.total_bruto || 0), 0)
    const pPedidos = prev.reduce((a, r) => a + (r.total_pedidos || 0), 0)
    const pTm = pPedidos > 0 ? pVentas / pPedidos : 0
    const hay = prev.some(r => (r.total_bruto || 0) > 0)
    return {
      hay,
      varVentas: hay && pVentas > 0 ? ((ventasPeriodo - pVentas) / pVentas) * 100 : null,
      varPedidos: hay && pPedidos > 0 ? ((pedidosPeriodo - pPedidos) / pPedidos) * 100 : null,
      varTM: hay && pTm > 0 ? ((tmBruto - pTm) / pTm) * 100 : null,
      pVentas, pPedidos,
    }
  }, [rowsAll, fechaDesde, fechaHasta, comparar, ventasPeriodo, pedidosPeriodo, tmBruto])

  // ventas semana/mes/año en curso (para barras de cumplimiento de CardVentas)
  const ventasSemana = useMemo(() => {
    const ws = startOfWeekStr(); const monday = parseLocalDate(ws)
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
    const we = toLocalDateStr(sunday)
    return rowsAll.filter(r => r.fecha >= ws && r.fecha <= we).reduce((a, r) => a + (r.total_bruto || 0), 0)
  }, [rowsAll])
  const ventasMes = useMemo(() => {
    const m = toLocalDateStr(new Date()).slice(0, 7)
    return rowsAll.filter(r => r.fecha.startsWith(m)).reduce((a, r) => a + (r.total_bruto || 0), 0)
  }, [rowsAll])
  const ventasAno = useMemo(() => {
    const a = toLocalDateStr(new Date()).slice(0, 4)
    return rowsAll.filter(r => r.fecha.startsWith(a)).reduce((a2, r) => a2 + (r.total_bruto || 0), 0)
  }, [rowsAll])

  const nSemana = isoWeek(new Date())
  const nombreMes = new Date().toLocaleDateString('es-ES', { month: 'long' })
  const ano = new Date().getFullYear()

  const diasPico: DiaPico[] = useMemo(() => {
    const m = toLocalDateStr(new Date()).slice(0, 7)
    const acum = [0, 0, 0, 0, 0, 0, 0]
    for (const r of rowsAll) {
      if (!r.fecha.startsWith(m)) continue
      const d = parseLocalDate(r.fecha)
      acum[(d.getDay() + 6) % 7] += r.total_bruto || 0
    }
    return acum.map((v, i) => ({ idx: i, nombre: NOMBRES_DIAS[i], valor: v, color: COLORES_DIAS[i] }))
  }, [rowsAll])
  const mediaDiariaPico = useMemo(() => {
    const validos = diasPico.filter(d => d.valor > 0)
    return validos.length ? validos.reduce((a, d) => a + d.valor, 0) / validos.length : 0
  }, [diasPico])

  async function saveObjetivoVenta(tipo: 'semanal' | 'mensual' | 'anual', valor: number | null) {
    if (valor == null) { await supabase.from('objetivos').delete().eq('tipo', tipo); await loadObjetivos(); return }
    setObjetivos(p => ({ ...p, [tipo]: valor }))
    await supabase.from('objetivos').upsert({ tipo, importe: valor }, { onConflict: 'tipo' })
    await loadObjetivos()
  }

  // ── Titular dinámico ──
  const labelComp = comparar === 'semana' ? 'semana anterior' : comparar === 'mes' ? 'mes anterior' : 'año anterior'
  const titular = useMemo(() => {
    const v = comp.varVentas
    const colDelta = v == null ? COLOR.textMut : v >= 0 ? COLOR.verde : COLOR.rojo
    const frase2col = comp.varPedidos == null ? COLOR.textMut : comp.varPedidos >= 0 ? COLOR.verde : COLOR.rojo
    return {
      big: v == null ? 'SIN HISTÓRICO PARA COMPARAR' : 'EL NEGOCIO VA',
      pct: v,
      colDelta,
      frases: [
        { txt: `Facturación bruta ${fmtEur(ventasPeriodo, { decimals: 2 })} · neto estimado ${fmtEur(netoEstimado, { decimals: 2 })} (${pctNeto.toFixed(1)}%) · ticket medio ${fmtEur(tmBruto, { decimals: 2 })}.`, color: COLOR.textSec },
        comp.varPedidos == null
          ? { txt: `${pedidosPeriodo} pedidos en el periodo. Sin histórico de la ${labelComp} para comparar.`, color: COLOR.textMut }
          : { txt: `${pedidosPeriodo} pedidos · ${comp.varPedidos >= 0 ? '+' : ''}${comp.varPedidos.toFixed(1)}% vs ${labelComp}.`, color: frase2col },
      ],
    }
  }, [comp, ventasPeriodo, netoEstimado, pctNeto, tmBruto, pedidosPeriodo, labelComp])

  const compararTabs: { id: Comparar; label: string }[] = [
    { id: 'semana', label: 'vs semana ant.' },
    { id: 'mes', label: 'vs mes ant.' },
    { id: 'anio', label: 'vs año ant.' },
  ]

  const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 } as const

  return (
    <div style={{ background: COLOR.bgPagina, color: COLOR.textPri, fontFamily: LEXEND, padding: '20px 0', borderRadius: 12, marginTop: 18 }}>

      {/* ── TITULAR DINÁMICO ── */}
      <div style={{ ...cardBig, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
          <div style={lbl}>EVOLUCIÓN</div>
          {/* subtabs comparación a la derecha */}
          <div style={{ display: 'inline-flex', gap: 6 }}>
            {compararTabs.map(t => (
              <button key={t.id} onClick={() => setCompararPersist(t.id)} style={comparar === t.id ? SUBTABS.active : SUBTABS.inactive}>{t.label}</button>
            ))}
          </div>
        </div>
        <div style={{ fontFamily: OSWALD, fontSize: 'clamp(26px,4vw,40px)', fontWeight: 600, lineHeight: 1.05, color: COLOR.textPri }}>
          {titular.big}{' '}
          {titular.pct != null && (
            <span style={{ color: titular.colDelta, background: `${titular.colDelta}22`, padding: '0 8px', borderRadius: 6 }}>
              {titular.pct >= 0 ? '+' : ''}{titular.pct.toFixed(1)}%
            </span>
          )}{' '}
          {titular.pct != null && <span>VS {labelComp.toUpperCase()}.</span>}
        </div>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {titular.frases.map((f, i) => (
            <div key={i} style={{ fontFamily: LEXEND, fontSize: 14, color: f.color, fontWeight: 500 }}>{f.txt}</div>
          ))}
        </div>
      </div>

      {/* ── FILA 1: Facturación + Pedidos/TM (cards reales del Resumen) ── */}
      <div style={{ ...row3, gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 14 }}>
        <CardVentas
          bruto={ventasPeriodo}
          netoEstimado={netoEstimado}
          variacionPct={comp.varVentas}
          ventasSemana={ventasSemana}
          ventasMes={ventasMes}
          ventasAno={ventasAno}
          nSemana={nSemana}
          mes={new Date().getMonth() + 1}
          ano={ano}
          objetivos={objetivos}
          onSaveObjetivo={saveObjetivoVenta}
          refetchObjetivos={loadObjetivos}
        />
        <CardPedidosTM
          pedidos={pedidosPeriodo}
          tmBruto={tmBruto}
          tmNeto={tmNeto}
          pedidosDeltaPct={comp.varPedidos}
          tmDeltaPct={comp.varTM}
          canales={canalStats}
        />
      </div>

      {/* ── FILA 2: Facturación por canal + Días pico (cards reales) ── */}
      <div style={grid2}>
        <ColFacturacionCanal canales={canalStats} />
        <ColDiasPico
          dias={diasPico}
          media={mediaDiariaPico}
          nombreMes={nombreMes}
          fechaDesde={fechaDesde}
          fechaHasta={fechaHasta}
          onClickDia={onFiltrarDiaSemana}
        />
      </div>
    </div>
  )
}
