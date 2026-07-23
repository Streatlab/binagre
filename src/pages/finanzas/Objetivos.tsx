import { AZUL, BLANCO, BORDER_FINO, CLARO, GRANATE, GRIS, INK, LIMA, NAR, ROJO, AMA, VERDE } from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'
import { OBJ_ROW_FINDE_BG, OBJ_ROW_HOY_BG, OBJ_ROW_HOY_FESTIVO_BG, OBJ_FESTIVO_BORDE, OBJ_FESTIVO_TXT, OBJ_FESTIVO_PILL_TXT } from '@/styles/palettes'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtNumES } from '@/utils/format'
import { useTheme, semaforoColor, FONT, LAYOUT, tabActiveStyle, tabInactiveStyle, tabsContainerStyle, CANALES } from '@/styles/tokens'
import { useCalendario } from '@/contexts/CalendarioContext'
import { useConfig } from '@/hooks/useConfig'
import { loadConfigCanales, loadMarcasPorCanal, type CanalConfig as CanalConfigCentral, type MarcasPorCanal } from '@/lib/panel/calcNetoPlataforma'
import { resolverNeto, loadVentasReales, loadRatiosCalibrados } from '@/lib/panel/netoResolver'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import { esFestivo as esFestivoMadrid, nombreFestivo } from '@/utils/festivosMadrid'

interface ObjetivoGeneral { tipo: string; importe: number; id: string }
interface ObjetivoDia { dia: number; importe: number; id: string }
interface ObjetivoPresupuesto { id: string; categoria_codigo: string; anio: number; mes: number; importe: number }
interface VentaCanal {
  fecha: string
  total_bruto: number
  uber_bruto: number; glovo_bruto: number; je_bruto: number; web_bruto: number; directa_bruto: number
  uber_pedidos: number; glovo_pedidos: number; je_pedidos: number; web_pedidos: number; directa_pedidos: number
}

function getISOWeek(d: Date): { year: number; week: number } {
  const dd = new Date(d)
  const day = dd.getDay() || 7
  dd.setDate(dd.getDate() + 4 - day)
  const y = dd.getFullYear()
  const jan1 = new Date(y, 0, 1)
  const week = Math.ceil(((dd.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
  return { year: y, week }
}

function mondayOfWeek(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4)
  const day = jan4.getDay() || 7
  const firstMonday = new Date(jan4)
  firstMonday.setDate(jan4.getDate() - day + 1)
  const result = new Date(firstMonday)
  result.setDate(firstMonday.getDate() + (week - 1) * 7)
  return result
}

function isoWeekFromStr(dateStr: string): { year: number; week: number } {
  return getISOWeek(new Date(dateStr + 'T12:00:00'))
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const NOMBRES_DIA = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']

interface PresupuestoGrupo { grupo: string; label: string; codigos: { codigo: string; nombre: string }[] }

const BLOQUE_LABEL: Record<string, string> = {
  PRODUCTO: 'Producto (COGS)',
  EQUIPO: 'Equipo (Labor)',
  ALQUILER: 'Local (Occupancy)',
  CONTROLABLES: 'Controlables (OPEX)',
}
const BLOQUES_PRESUPUESTO = Object.keys(BLOQUE_LABEL)
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// Festivo Madrid — amarillo SL sólido + texto oscuro legible
const FESTIVO_BG = LIMA
const FESTIVO_BORDE = OBJ_FESTIVO_BORDE
const FESTIVO_TXT = OBJ_FESTIVO_TXT

function barColor(pct: number): string {
  return pct > 0 ? VERDE : ROJO
}

export function Objetivos({ embedded = false }: { embedded?: boolean } = {}) {
  const { T, isDark } = useTheme()
  const { diasCerradosSemana, diasOperativosEnRango, tipoDia } = useCalendario()
  const { canales } = useConfig()

  // Estado config canales + marcas por canal cargado de Supabase
  const [cfgCanalesReal, setCfgCanalesReal] = useState<Record<string, CanalConfigCentral>>({})
  const [marcasPorCanal, setMarcasPorCanal] = useState<MarcasPorCanal>({ uber: 1, glovo: 1, je: 1, web: 1, dir: 1 })
  useEffect(() => {
    loadConfigCanales().then(setCfgCanalesReal)
    loadMarcasPorCanal().then(setMarcasPorCanal)
    loadVentasReales().then(() => loadRatiosCalibrados())
    const onChange = () => {
      loadConfigCanales().then(setCfgCanalesReal)
      loadMarcasPorCanal().then(setMarcasPorCanal)
    }
    window.addEventListener('config_canales:changed', onChange)
    return () => window.removeEventListener('config_canales:changed', onChange)
  }, [])

  // Helper: calcula neto delegando en calcNetoPorCanal central (fórmula real verificada)
  // Incluye: Uber 30%/33% Prime + fee_promo 0,82€ + 2,29€/sem/marca. Glovo 30% + fee_prime 0,74€ + 10€/quincena/marca. JE 30% + 0,30€/ped. IVA 21% sobre todo.
  const calcNetoCompleto = useCallback((ventasRango: VentaCanal[], desde: Date, hasta: Date): { neto: number; bruto: number } => {
    let netoTotal = 0, brutoTotal = 0
    const acum = { uber: {b:0,p:0}, glovo: {b:0,p:0}, je: {b:0,p:0}, web: {b:0,p:0}, dir: {b:0,p:0} }
    for (const r of ventasRango) {
      acum.uber.b  += r.uber_bruto    || 0;  acum.uber.p  += r.uber_pedidos    || 0
      acum.glovo.b += r.glovo_bruto   || 0;  acum.glovo.p += r.glovo_pedidos   || 0
      acum.je.b    += r.je_bruto      || 0;  acum.je.p    += r.je_pedidos      || 0
      acum.web.b   += r.web_bruto     || 0;  acum.web.p   += r.web_pedidos     || 0
      acum.dir.b   += r.directa_bruto || 0;  acum.dir.p   += r.directa_pedidos || 0
      brutoTotal += r.total_bruto || 0
    }
    for (const k of ['uber','glovo','je','web','dir'] as const) {
      const a = acum[k]
      if (a.b <= 0) continue
      const { neto } = resolverNeto(k, a.b, a.p, marcasPorCanal, desde, hasta, cfgCanalesReal)
      netoTotal += neto
    }
    return { neto: netoTotal, bruto: brutoTotal }
  }, [cfgCanalesReal, marcasPorCanal])

  const [presupuestoGrupos, setPresupuestoGrupos] = useState<PresupuestoGrupo[]>([])
  useEffect(() => {
    supabase.from('categorias_pyg').select('id,nombre,bloque').eq('nivel', 3).eq('activa', true)
      .then(({ data }) => {
        if (!data) return
        const mapa: Record<string, PresupuestoGrupo> = {}
        for (const row of data) {
          if (!BLOQUES_PRESUPUESTO.includes(row.bloque)) continue
          if (!mapa[row.bloque]) mapa[row.bloque] = { grupo: row.bloque, label: BLOQUE_LABEL[row.bloque], codigos: [] }
          mapa[row.bloque].codigos.push({ codigo: row.id, nombre: row.nombre })
        }
        setPresupuestoGrupos(BLOQUES_PRESUPUESTO.filter(b => mapa[b]).map(b => mapa[b]))
      })
  }, [])
  const allCodigos = useMemo(() => presupuestoGrupos.flatMap(g => g.codigos.map(c => c.codigo)), [presupuestoGrupos])

  const [activeTab, setActiveTab] = useState<'objetivos' | 'presupuestos'>('objetivos')
  const hoy = useMemo(() => new Date(), [])
  const { year: curYear, week: curWeek } = useMemo(() => getISOWeek(hoy), [hoy])

  const [periodoDesde, setPeriodoDesde] = useState<Date>(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0)
    const dow = d.getDay() || 7; d.setDate(d.getDate() - dow + 1); return d
  })
  const [periodoHasta, setPeriodoHasta] = useState<Date>(() => {
    const d = new Date(); d.setHours(23, 59, 59, 999)
    const dow = d.getDay() || 7; d.setDate(d.getDate() - dow + 7); return d
  })
  const [periodoLabel, setPeriodoLabel] = useState('Semana actual')
  const [weekMon, setWeekMon] = useState<Date>(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0)
    const dow = d.getDay() || 7; d.setDate(d.getDate() - dow + 1); return d
  })

  const handlePeriodo = useCallback((desde: Date, hasta: Date, label: string) => {
    setPeriodoDesde(desde); setPeriodoHasta(hasta); setPeriodoLabel(label)
    const { year, week } = getISOWeek(desde)
    setWeekMon(mondayOfWeek(year, week))
  }, [])

  const weekSun = useMemo(() => { const d = new Date(weekMon); d.setDate(d.getDate() + 6); return d }, [weekMon])
  const weekStart = useMemo(() => toDateStr(weekMon), [weekMon])
  const weekEnd = useMemo(() => toDateStr(weekSun), [weekSun])
  const { week: weekNum } = useMemo(() => getISOWeek(weekMon), [weekMon])
  const weekLabel = `S${weekNum} — ${weekMon.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}`

  const fechaDia = useCallback((dia: number) => {
    const d = new Date(weekMon); d.setDate(weekMon.getDate() + dia - 1); return d
  }, [weekMon])

  const esFinde = (dia: number) => dia >= 5
  const esFestivo = (dia: number) => esFestivoMadrid(toDateStr(fechaDia(dia)))
  const esHoyFlag = (dia: number) => fechaDia(dia).toDateString() === hoy.toDateString()

  const [objetivos, setObjetivos] = useState<ObjetivoGeneral[]>([])
  const [diasSemana, setDiasSemana] = useState<ObjetivoDia[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [histTipo, setHistTipo] = useState<'dias' | 'semanas' | 'meses' | 'anual'>('semanas')
  const [histAnio, setHistAnio] = useState<number>(hoy.getFullYear())
  const [ventas, setVentas] = useState<VentaCanal[]>([])
  const [loading, setLoading] = useState(true)
  const [presAnio, setPresAnio] = useState(hoy.getFullYear())
  const [presData, setPresData] = useState<ObjetivoPresupuesto[]>([])
  const [presLoading, setPresLoading] = useState(false)
  const [presEditing, setPresEditing] = useState<string | null>(null)
  const [presEditVal, setPresEditVal] = useState('')
  const [presSaving, setPresSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    Promise.all([
      supabase.from('objetivos').select('*').in('tipo', ['diario','semanal','mensual','anual']),
      supabase.from('objetivos_dia_semana').select('*').order('dia'),
      supabase.from('facturacion_diario').select('fecha,total_bruto,uber_bruto,glovo_bruto,je_bruto,web_bruto,directa_bruto,uber_pedidos,glovo_pedidos,je_pedidos,web_pedidos,directa_pedidos').order('fecha', { ascending: false }).limit(2000),
    ]).then(([g, d, v]) => {
      if (g.data) setObjetivos(g.data.map((r: any) => ({ tipo: r.tipo, importe: Number(r.importe), id: r.id })))
      if (d.data) setDiasSemana(d.data.map((r: any) => ({ dia: r.dia, importe: Number(r.importe), id: r.id })))
      if (v.data) setVentas(v.data.map((r: any) => ({
        fecha: r.fecha,
        total_bruto: Number(r.total_bruto) || 0,
        uber_bruto: Number(r.uber_bruto)||0, glovo_bruto: Number(r.glovo_bruto)||0, je_bruto: Number(r.je_bruto)||0, web_bruto: Number(r.web_bruto)||0, directa_bruto: Number(r.directa_bruto)||0,
        uber_pedidos: Number(r.uber_pedidos)||0, glovo_pedidos: Number(r.glovo_pedidos)||0, je_pedidos: Number(r.je_pedidos)||0, web_pedidos: Number(r.web_pedidos)||0, directa_pedidos: Number(r.directa_pedidos)||0,
      })))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const loadPresupuestos = useCallback(async (anio: number) => {
    setPresLoading(true)
    const { data } = await supabase.from('objetivos').select('id,categoria_codigo,anio,mes,importe')
      .eq('tipo', 'presupuesto').eq('anio', anio).in('categoria_codigo', allCodigos)
    setPresData((data ?? []).map((r: any) => ({ id: r.id, categoria_codigo: r.categoria_codigo, anio: r.anio, mes: r.mes, importe: Number(r.importe) })))
    setPresLoading(false)
  }, [allCodigos])

  useEffect(() => { if (activeTab === 'presupuestos') loadPresupuestos(presAnio) }, [activeTab, presAnio, loadPresupuestos])

  const saveObjetivoGeneral = async (tipo: string, val: number) => {
    const v = Math.round(val)
    const existing = objetivos.find(o => o.tipo === tipo)
    try {
      if (existing) {
        const { error } = await supabase.from('objetivos').update({ importe: v }).eq('id', existing.id)
        if (error) throw error
        setObjetivos(prev => prev.map(o => o.id === existing.id ? { ...o, importe: v } : o))
      } else {
        const { data, error } = await supabase.from('objetivos').insert({ tipo, importe: v }).select()
        if (error) throw error
        if (data?.[0]) setObjetivos(prev => [...prev, { tipo, importe: v, id: data[0].id }])
      }
      showToast('Objetivo guardado')
    } catch (e: any) {
      showToast(e?.message ?? 'Error al guardar', false)
    }
    setEditingId(null)
  }

  const deleteObjetivoGeneral = async (tipo: string) => {
    const existing = objetivos.find(o => o.tipo === tipo)
    if (existing) {
      await supabase.from('objetivos').delete().eq('id', existing.id)
      setObjetivos(prev => prev.filter(o => o.id !== existing.id))
    }
    setEditingId(null)
  }

  const saveDiaSemana = async (dia: number, val: number) => {
    const v = Math.round(val)
    const existing = diasSemana.find(d => d.dia === dia)
    try {
      if (existing) {
        const { error } = await supabase.from('objetivos_dia_semana').update({ importe: v }).eq('id', existing.id)
        if (error) throw error
        setDiasSemana(prev => prev.map(o => o.id === existing.id ? { ...o, importe: v } : o))
      } else {
        const { data, error } = await supabase.from('objetivos_dia_semana').insert({ dia, importe: v }).select()
        if (error) throw error
        if (data?.[0]) setDiasSemana(prev => [...prev, { dia, importe: v, id: data[0].id }])
      }
      showToast('Objetivo del día guardado')
    } catch (e: any) {
      showToast(e?.message ?? 'Error al guardar', false)
    }
    setEditingId(null)
  }

  const savePresupuesto = async (codigo: string, mes: number, val: number) => {
    setPresSaving(true)
    try {
      // Resolver la fila existente contra BD, no solo contra presData: si allCodigos
      // aún no estaba listo al cargar, presData puede estar vacío y un insert ciego
      // crearía duplicados o perdería la edición. Consulta puntual = idempotente.
      const { data: found, error: findErr } = await supabase.from('objetivos')
        .select('id').eq('tipo', 'presupuesto').eq('categoria_codigo', codigo)
        .eq('anio', presAnio).eq('mes', mes).limit(1)
      if (findErr) throw findErr
      const existingId = found?.[0]?.id
        ?? presData.find(p => p.categoria_codigo === codigo && p.mes === mes && p.anio === presAnio)?.id
      if (existingId) {
        const { error } = await supabase.from('objetivos').update({ importe: val, updated_at: new Date().toISOString() }).eq('id', existingId)
        if (error) throw error
        setPresData(prev => prev.some(p => p.id === existingId)
          ? prev.map(p => p.id === existingId ? { ...p, importe: val } : p)
          : [...prev, { id: existingId, categoria_codigo: codigo, anio: presAnio, mes, importe: val }])
      } else {
        const { data, error } = await supabase.from('objetivos').insert({ tipo: 'presupuesto', categoria_codigo: codigo, anio: presAnio, mes, importe: val }).select()
        if (error) throw error
        if (data?.[0]) setPresData(prev => [...prev, { id: data[0].id, categoria_codigo: codigo, anio: presAnio, mes, importe: val }])
      }
      showToast('Presupuesto guardado')
    } catch (e: any) {
      showToast(e?.message ?? 'Error al guardar', false)
    }
    setPresEditing(null); setPresSaving(false)
  }

  const copiarAnioAnterior = async () => {
    const anioAnt = presAnio - 1
    const { data } = await supabase.from('objetivos').select('*').eq('tipo', 'presupuesto').eq('anio', anioAnt).in('categoria_codigo', allCodigos)
    if (!data?.length) { alert(`No hay datos de presupuesto para ${anioAnt}`); return }
    setPresSaving(true)
    for (const row of data) {
      const existing = presData.find(p => p.categoria_codigo === row.categoria_codigo && p.mes === row.mes)
      if (existing) await supabase.from('objetivos').update({ importe: row.importe, updated_at: new Date().toISOString() }).eq('id', existing.id)
      else await supabase.from('objetivos').insert({ tipo: 'presupuesto', categoria_codigo: row.categoria_codigo, anio: presAnio, mes: row.mes, importe: row.importe })
    }
    await loadPresupuestos(presAnio); setPresSaving(false)
  }

  const hoyStr = toDateStr(hoy)
  const periodoDesdeStr = useMemo(() => toDateStr(periodoDesde), [periodoDesde])
  const periodoHastaStr = useMemo(() => toDateStr(periodoHasta), [periodoHasta])

  const ventasPeriodoArr = useMemo(() => ventas.filter(r => r.fecha >= periodoDesdeStr && r.fecha <= periodoHastaStr), [ventas, periodoDesdeStr, periodoHastaStr])
  const ventasPeriodo = useMemo(() => ventasPeriodoArr.reduce((a, r) => a + r.total_bruto, 0), [ventasPeriodoArr])
  const netoEstPeriodo = useMemo(() => calcNetoCompleto(ventasPeriodoArr, periodoDesde, periodoHasta).neto, [ventasPeriodoArr, periodoDesde, periodoHasta, calcNetoCompleto])
  const PCT_NETO_EST_PERIODO = ventasPeriodo > 0 ? Math.round((netoEstPeriodo / ventasPeriodo) * 100) : 0

  const ventasSemana = useMemo(
    () => ventas.filter(r => r.fecha >= weekStart && r.fecha <= weekEnd).reduce((a, r) => a + r.total_bruto, 0),
    [ventas, weekStart, weekEnd]
  )
  const nDiasCerradosSemana = useMemo(() => diasCerradosSemana(weekMon), [diasCerradosSemana, weekMon])
  const diasOperativosSemana = useMemo(() => diasOperativosEnRango(weekMon, weekSun), [diasOperativosEnRango, weekMon, weekSun])

  const ventasPorDiaSemana = useMemo(() => {
    const map: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }
    for (const r of ventas) {
      if (r.fecha >= weekStart && r.fecha <= weekEnd) {
        const d = new Date(r.fecha + 'T12:00:00')
        map[d.getDay() === 0 ? 7 : d.getDay()] += r.total_bruto
      }
    }
    return map
  }, [ventas, weekStart, weekEnd])

  const currentMonth = hoyStr.slice(0, 7)
  const ventasMes = useMemo(
    () => ventas.filter(r => r.fecha.startsWith(currentMonth)).reduce((a, r) => a + r.total_bruto, 0),
    [ventas, currentMonth]
  )
  const currentYear = hoyStr.slice(0, 4)
  const ventasAno = useMemo(
    () => ventas.filter(r => r.fecha.startsWith(currentYear)).reduce((a, r) => a + r.total_bruto, 0),
    [ventas, currentYear]
  )

  const sumaSemana = useMemo(() => diasSemana.reduce((a, d) => a + Number(d.importe || 0), 0), [diasSemana])
  const sumaMes = useMemo(() => {
    const diasEnMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
    return Math.round((sumaSemana / 7) * diasEnMes)
  }, [sumaSemana, hoy])
  const sumaAno = useMemo(() => {
    const esBis = (hoy.getFullYear() % 4 === 0 && hoy.getFullYear() % 100 !== 0) || hoy.getFullYear() % 400 === 0
    return Math.round((sumaSemana / 7) * (esBis ? 366 : 365))
  }, [sumaSemana, hoy])

  const objSemanal = Math.round(objetivos.find(o => o.tipo === 'semanal')?.importe || 0) || sumaSemana
  const objMensual = Math.round(objetivos.find(o => o.tipo === 'mensual')?.importe || 0) || sumaMes
  const objAnual   = Math.round(objetivos.find(o => o.tipo === 'anual')?.importe   || 0) || sumaAno

  const objPeriodo = useMemo(() => {
    const dias = Math.round((periodoHasta.getTime() - periodoDesde.getTime()) / 86400000) + 1
    return Math.round((sumaSemana / 7) * dias)
  }, [periodoDesde, periodoHasta, sumaSemana])

  const aniosDisponibles = useMemo(() => {
    const set = new Set(ventas.map(r => parseInt(r.fecha.slice(0, 4))))
    const arr = [...set].filter(y => !isNaN(y)).sort((a, b) => b - a)
    if (!arr.length) arr.push(hoy.getFullYear())
    return arr
  }, [ventas, hoy])

  const historico = useMemo(() => {
    const esAnioActual = histAnio === hoy.getFullYear()
    const filtAnio = ventas.filter(r => r.fecha.startsWith(String(histAnio)))
    if (histTipo === 'dias') {
      return [...filtAnio].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 14).map(r => {
        const d = new Date(r.fecha + 'T12:00:00')
        const ds = d.getDay() === 0 ? 7 : d.getDay()
        const enCurso = esAnioActual && r.fecha === hoyStr
        const labelBase = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
        return { label: enCurso ? `${labelBase} (en curso)` : labelBase, real: r.total_bruto, objetivo: diasSemana.find(x => x.dia === ds)?.importe || 0, enCurso }
      })
    }
    if (histTipo === 'semanas') {
      const map = new Map<string, number>()
      for (const r of filtAnio) {
        const { year, week } = isoWeekFromStr(r.fecha)
        const key = `${year}-${String(week).padStart(2, '0')}`
        map.set(key, (map.get(key) || 0) + r.total_bruto)
      }
      const curKey = `${curYear}-${String(curWeek).padStart(2, '0')}`
      return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).map(([key, real]) => {
        const enCurso = esAnioActual && key === curKey
        return { label: enCurso ? `S${parseInt(key.split('-')[1])} (en curso)` : `S${parseInt(key.split('-')[1])}`, real, objetivo: objSemanal, enCurso }
      })
    }
    if (histTipo === 'anual') {
      const total = filtAnio.reduce((a, r) => a + r.total_bruto, 0)
      return [{ label: esAnioActual ? `${histAnio} (en curso)` : String(histAnio), real: total, objetivo: objAnual, enCurso: esAnioActual }]
    }
    const curMonthStr = hoy.toISOString().slice(0, 7)
    const map = new Map<string, number>()
    for (const r of filtAnio) { const m = r.fecha.slice(0, 7); map.set(m, (map.get(m) || 0) + r.total_bruto) }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).map(([key, real]) => {
      const [y, mm] = key.split('-')
      const enCurso = esAnioActual && key === curMonthStr
      const labelBase = new Date(parseInt(y), parseInt(mm) - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
      return { label: enCurso ? `${labelBase} (en curso)` : labelBase, real, objetivo: objMensual, enCurso }
    })
  }, [ventas, histTipo, histAnio, diasSemana, objSemanal, objMensual, objAnual, hoyStr, hoy, curYear, curWeek])

  if (loading) return (
    <div style={{ background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 0, padding: '24px 28px', color: T.sec, fontFamily: FONT.body }}>Cargando…</div>
  )

  const pctPer = objPeriodo > 0 ? Math.round((ventasPeriodo / objPeriodo) * 100) : 0
  const pctSem = objSemanal > 0 ? Math.round((ventasSemana  / objSemanal) * 100) : 0
  const pctMes = objMensual > 0 ? Math.round((ventasMes     / objMensual) * 100) : 0
  const pctAno = objAnual   > 0 ? Math.round((ventasAno     / objAnual)   * 100) : 0

  const INCUMPLIDO = ROJO
  const KPI_SIZE = 36

  const inputSelectStyle = {
    background: T.card,
    border: `1px solid ${T.brd}`,
    color: T.pri, fontFamily: FONT.body, fontSize: 12, borderRadius: 0, padding: '4px 10px', cursor: 'pointer',
  }
  const sectionLabel = { fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase' as const, color: T.mut, margin: '24px 0 10px' }
  const editableNumberStyle = (color: string = T.pri) => ({ color, fontWeight: 600 as const, cursor: 'pointer', borderBottom: `1px dashed ${T.mut}`, paddingBottom: 1 })

  const renderInlineEditNoEur = (id: string, currentVal: number, onSave: (v: number) => void, onReset?: () => void, color: string = T.pri) => {
    const commit = () => {
      const trimmed = editValue.trim()
      if (trimmed === '' && onReset) { onReset(); return }
      const v = parseFloat(trimmed.replace(',', '.'))
      if (!isNaN(v) && v <= 0 && onReset) { onReset(); return }
      if (!isNaN(v) && v > 0) onSave(v)
      else setEditingId(null)
    }
    if (editingId === id) {
      return (
        <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditingId(null) }}
          autoFocus placeholder="vacío o 0 = restaurar"
          style={{ fontFamily: FONT.heading, fontSize: 'inherit', fontWeight: 600, color, background: T.card, border: `1px solid ${T.brd}`, borderRadius: 0, padding: '2px 6px', width: 110, textAlign: 'right' }}
        />
      )
    }
    return (
      <span onClick={() => { setEditingId(id); setEditValue(String(Math.round(currentVal))) }}
        style={editableNumberStyle(color)} title="Click para editar · vacío o 0 restaura el valor calculado">
        {fmtNumES(currentVal, 2)}
      </span>
    )
  }

  const renderPeriodRow = (titulo: string, sub: string, real: number, obj: number, pct: number, editId: string, onSave: (v: number) => void, onReset?: () => void) => {
    const pctCap = Math.min(pct, 100)
    const falta = Math.max(0, obj - real)
    const col = semaforoColor(pct)
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', color: T.mut, textTransform: 'uppercase' }}>
            {titulo} <span style={{ fontWeight: 400, opacity: 0.7 }}>— {sub}</span>
          </span>
          <span style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600, color: col }}>{pct}%</span>
        </div>
        <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec, marginBottom: 6 }}>
          Faltan <span style={{ color: col, fontWeight: 500 }}>{fmtNumES(falta, 2)}</span> de {renderInlineEditNoEur(editId, obj, onSave, onReset)}
        </div>
        <div style={{ height: 4, background: T.brd, borderRadius: 2, display: 'flex', overflow: 'hidden' }}>
          <div style={{ height: 4, background: barColor(pct), width: `${pctCap}%`, transition: 'width 0.4s ease' }} />
          <div style={{ height: 4, background: INCUMPLIDO, width: `${100 - pctCap}%` }} />
        </div>
      </div>
    )
  }

  const getPresVal = (codigo: string, mes: number) => presData.find(p => p.categoria_codigo === codigo && p.mes === mes)?.importe ?? 0
  const totalMesPres = (mes: number) => allCodigos.reduce((a, c) => a + getPresVal(c, mes), 0)
  const totalCodigo = (codigo: string) => Array.from({ length: 12 }, (_, i) => i + 1).reduce((a, m) => a + getPresVal(codigo, m), 0)
  const totalAnual = () => allCodigos.reduce((a, c) => a + totalCodigo(c), 0)
  const commitPresEdit = (codigo: string, mes: number) => {
    const v = parseFloat(presEditVal.replace(',', '.'))
    if (!isNaN(v) && v >= 0) savePresupuesto(codigo, mes, v)
    else setPresEditing(null)
  }

  const tabs = [
    { key: 'objetivos', label: 'Objetivos de venta' },
    { key: 'presupuestos', label: 'Presupuesto de gastos' },
  ]

  void CANALES
  void LAYOUT

  const tituloHero = objPeriodo <= 0
    ? 'El objetivo de ventas del periodo aún no está definido.'
    : pctPer >= 100 ? 'Vas cumpliendo el objetivo de ventas del periodo.' : 'El periodo va por detrás del objetivo de ventas.'
  const atencionHero = [
    `Objetivo semanal ${fmtEur(objSemanal)}`,
    `Objetivo mensual ${fmtEur(objMensual)}`,
    `Objetivo anual ${fmtEur(objAnual)}`,
    nDiasCerradosSemana > 0 ? `${nDiasCerradosSemana} día${nDiasCerradosSemana > 1 ? 's' : ''} cerrado${nDiasCerradosSemana > 1 ? 's' : ''} esta semana` : null,
  ].filter(Boolean) as string[]
  const faltaObjetivo = Math.max(0, objPeriodo - ventasPeriodo)

  return (
    <PantallaCantera embedded={embedded}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: toast.ok ? VERDE : GRANATE, color: BLANCO, padding: '10px 18px', borderRadius: 0, border: `2px solid ${INK}`, fontFamily: FONT.body, fontSize: 13, transition: 'opacity 0.3s' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <SelectorFechaUniversal nombreModulo="objetivos" defaultOpcion="semana_actual" onChange={handlePeriodo} />
      </div>

      {/* 1 · Héroe del área Objetivos (amarillo) */}
      <HeroCantera
        area="objetivos"
        periodo={periodoLabel}
        titular={tituloHero}
        etiquetaDato="Ventas del periodo"
        cifra={fmtEur(ventasPeriodo)}
        variacionPct={objPeriodo > 0 ? pctPer - 100 : null}
        resumen={<>Neto estimado <b>{fmtEur(netoEstPeriodo)}</b> ({PCT_NETO_EST_PERIODO}% sobre bruto).</>}
        atencion={atencionHero}
      />

      {/* 3 · Frase potente (distinta del héroe amarillo) */}
      {objPeriodo > 0 && (
        pctPer >= 100
          ? <FrasePotente significado="logro">Vas por encima del objetivo del periodo: mantén el ritmo para no perder la ventaja.</FrasePotente>
          : <FrasePotente significado="peligro">Faltan {fmtEur(faltaObjetivo)} para llegar al objetivo del periodo.</FrasePotente>
      )}

      <div style={tabsContainerStyle()}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as 'objetivos' | 'presupuestos')}
            style={activeTab === tab.key ? tabActiveStyle(isDark) : tabInactiveStyle(T)}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'objetivos' && (
        <>
          {nDiasCerradosSemana > 0 && (() => {
            const objAjustado = objMensual > 0 && diasOperativosSemana > 0
              ? objMensual / (diasOperativosEnRango(
                  new Date(weekMon.getFullYear(), weekMon.getMonth(), 1),
                  new Date(weekMon.getFullYear(), weekMon.getMonth() + 1, 0),
                ) || 1) * diasOperativosSemana
              : null
            return (
              <div style={{ backgroundColor: LIMA, color: INK, padding: '10px 16px', borderRadius: 0, marginBottom: 12, fontFamily: FONT.heading, fontSize: 13, letterSpacing: 0.5 }}>
                Esta semana hay {nDiasCerradosSemana} día{nDiasCerradosSemana > 1 ? 's' : ''} cerrado{nDiasCerradosSemana > 1 ? 's' : ''}, objetivo ajustado a {objAjustado != null ? fmtNumES(objAjustado, 2) : '—'}
              </div>
            )
          })()}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5" style={{ alignItems: 'start' }}>

            <Papel ceja={VERDE} pad="20px 24px">
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', color: T.mut, textTransform: 'uppercase', marginBottom: 4 }}>
                VENTAS · {periodoLabel.toUpperCase()}
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: FONT.heading, fontSize: KPI_SIZE, fontWeight: 700, color: T.pri, lineHeight: 1, letterSpacing: '-0.5px' }}>
                  {fmtNumES(ventasPeriodo, 2)}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontFamily: FONT.heading, fontSize: KPI_SIZE, fontWeight: 700, color: VERDE, lineHeight: 1, letterSpacing: '-0.5px' }}>
                    {fmtNumES(netoEstPeriodo, 2)}
                  </span>
                  <span style={{ fontFamily: FONT.body, fontSize: 9, color: T.mut, letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: 3 }}>
                    NETO EST. {PCT_NETO_EST_PERIODO}%
                  </span>
                </div>
              </div>

              <div style={{ fontFamily: FONT.body, fontSize: 12, fontWeight: 500, color: semaforoColor(pctPer), marginBottom: 22 }}>
                {pctPer >= 100 ? '▲' : '▼'} {pctPer}% del objetivo · {fmtNumES(objPeriodo, 2)}
              </div>

              {renderPeriodRow('Semanal', weekLabel, ventasSemana, objSemanal, pctSem, 'obj-semanal', (v) => saveObjetivoGeneral('semanal', v), () => deleteObjetivoGeneral('semanal'))}
              {renderPeriodRow('Mensual', hoy.toLocaleDateString('es-ES', { month: 'long' }), ventasMes, objMensual, pctMes, 'obj-mensual', (v) => saveObjetivoGeneral('mensual', v), () => deleteObjetivoGeneral('mensual'))}
              {renderPeriodRow('Anual', String(hoy.getFullYear()), ventasAno, objAnual, pctAno, 'obj-anual', (v) => saveObjetivoGeneral('anual', v), () => deleteObjetivoGeneral('anual'))}
            </Papel>

            <Papel ceja={AZUL} pad="20px 24px">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', color: T.mut, textTransform: 'uppercase' }}>
                  Objetivo por día · {weekLabel}
                </span>
                <span style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1.5px', color: T.mut, textTransform: 'uppercase', opacity: 0.7 }}>click editar</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[1,2,3,4,5,6,7].map((dia, idx) => {
                  const diaData = diasSemana.find(d => d.dia === dia)
                  const importe = diaData?.importe ?? 0
                  const ventasDia = ventasPorDiaSemana[dia] || 0
                  const pct = importe > 0 ? Math.round((ventasDia / importe) * 100) : 0
                  const pctCap = Math.min(pct, 100)
                  const finde = esFinde(dia)
                  const festivo = esFestivo(dia)
                  const hoyFl = esHoyFlag(dia)
                  const fechaDiaD = fechaDia(dia)
                  const fechaDiaStr = toDateStr(fechaDiaD)
                  const festNombre = nombreFestivo(fechaDiaStr)
                  const tipoDiaActual = tipoDia(fechaDiaStr)
                  const esCerrado = tipoDiaActual === 'cerrado' || tipoDiaActual === 'festivo' || tipoDiaActual === 'vacaciones'

                  let rowBg = 'transparent', rowBorderLeft = '3px solid transparent', diaColor = T.sec
                  if (finde) { rowBg = OBJ_ROW_FINDE_BG; rowBorderLeft = `3px solid ${VERDE}`; diaColor = VERDE }
                  if (festivo) { rowBg = FESTIVO_BG; rowBorderLeft = `3px solid ${FESTIVO_BORDE}`; diaColor = FESTIVO_TXT }
                  if (hoyFl) { rowBorderLeft = `3px solid ${AZUL}`; if (!festivo) rowBg = OBJ_ROW_HOY_FESTIVO_BG }

                  const fechaStr = `${fechaDiaD.getDate()} ${fechaDiaD.toLocaleDateString('es-ES', { month: 'short' })}`
                  const editId = `dia-${dia}`
                  const textoFecha = festivo ? FESTIVO_TXT : (hoyFl ? AZUL : T.mut)
                  void esCerrado

                  return (
                    <div key={dia} style={{
                      display: 'grid', gridTemplateColumns: '70px 1fr 80px', alignItems: 'center', gap: 14,
                      padding: hoyFl ? '12px 14px' : '10px 14px', margin: '0 -14px', background: rowBg,
                      borderLeft: rowBorderLeft, borderBottom: idx < 6 ? `0.5px solid ${T.brd}` : 'none',
                      borderRadius: 0,
                    }}>
                      <div>
                        <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', color: festivo ? FESTIVO_TXT : (hoyFl ? AZUL : diaColor), textTransform: 'uppercase', fontWeight: festivo || hoyFl ? 700 : 500 }}>
                          {NOMBRES_DIA[dia - 1]}
                        </div>
                        <div style={{ fontFamily: FONT.body, fontSize: 10, color: textoFecha, marginTop: 1, fontWeight: festivo || hoyFl ? 600 : 400, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          {fechaStr}{hoyFl ? ' · HOY' : ''}
                          {festivo && <span style={{ backgroundColor: FESTIVO_BORDE, color: OBJ_FESTIVO_PILL_TXT, padding: '1px 5px', borderRadius: 0, fontSize: 9, fontFamily: FONT.heading, fontWeight: 700 }} title={festNombre ?? undefined}>FESTIVO</span>}
                          {esCerrado && !festivo && <span style={{ backgroundColor: GRANATE, color: BLANCO, padding: '1px 5px', borderRadius: 0, fontSize: 9, fontFamily: FONT.heading }}>CERRADO</span>}
                          {tipoDiaActual === 'solo_comida' && <span style={{ backgroundColor: LIMA, color: INK, padding: '1px 5px', borderRadius: 0, fontSize: 9, fontFamily: FONT.heading }}>ALM</span>}
                          {tipoDiaActual === 'solo_cena' && <span style={{ backgroundColor: NAR, color: BLANCO, padding: '1px 5px', borderRadius: 0, fontSize: 9, fontFamily: FONT.heading }}>CENA</span>}
                        </div>
                      </div>
                      <div style={{ height: 5, background: T.brd, borderRadius: 3, display: 'flex', overflow: 'hidden' }}>
                        {importe > 0 && (
                          <>
                            <div style={{ height: 5, background: barColor(pct), width: `${pctCap}%`, transition: 'width 0.4s ease' }} />
                            <div style={{ height: 5, background: INCUMPLIDO, width: `${100 - pctCap}%` }} />
                          </>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {editingId === editId ? (
                          <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
                            onBlur={() => { const v = parseFloat(editValue.replace(',', '.')); if (!isNaN(v)) saveDiaSemana(dia, v); else setEditingId(null) }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { const v = parseFloat(editValue.replace(',', '.')); if (!isNaN(v)) saveDiaSemana(dia, v); else setEditingId(null) }
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            autoFocus
                            style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: T.pri, background: T.card, border: `1px solid ${T.brd}`, borderRadius: 0, padding: '3px 6px', width: 72, textAlign: 'right' }}
                          />
                        ) : (
                          <span onClick={() => { setEditingId(editId); setEditValue(String(Math.round(importe))) }}
                            style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: hoyFl || festivo ? 700 : 600, color: festivo ? OBJ_FESTIVO_PILL_TXT : T.pri, cursor: 'pointer' }}>
                            {fmtNumES(importe, 0)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Papel>

          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ ...sectionLabel, margin: 0 }}>Histórico de cumplimiento</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={histTipo} onChange={e => setHistTipo(e.target.value as any)} style={inputSelectStyle}>
                <option value="dias">Por días</option>
                <option value="semanas">Por semanas</option>
                <option value="meses">Por meses</option>
                <option value="anual">Todo el año</option>
              </select>
              <select value={histAnio} onChange={e => setHistAnio(parseInt(e.target.value))} style={inputSelectStyle}>
                {aniosDisponibles.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <Papel ceja={NAR} pad="14px 16px">
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 72px 80px 100px 100px 90px 80px', gap: 6, padding: '6px 0 10px', borderBottom: `0.5px solid ${T.brd}`, fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut }}>
              <span>Período</span><span>Cumplido · Pendiente</span>
              <span style={{ textAlign: 'right' }}>% Real</span>
              <span style={{ textAlign: 'right' }}>Real</span>
              <span style={{ textAlign: 'right' }}>Objetivo</span>
              <span style={{ textAlign: 'right' }}>Desviación</span>
              <span style={{ textAlign: 'right' }}>% Desv.</span>
            </div>
            {historico.length === 0 && (
              <div style={{ padding: '24px 0', textAlign: 'center', fontFamily: FONT.body, fontSize: 13, color: T.mut }}>Sin datos históricos</div>
            )}
            {historico.map((h, idx) => {
              const pct = h.objetivo > 0 ? Math.round((h.real / h.objetivo) * 100) : 0
              const pctCap = Math.min(pct, 100)
              const sc = semaforoColor(pct)
              const bc = barColor(pct)
              const desv = h.real - h.objetivo
              const desvColor = desv >= 0 ? VERDE : ROJO
              const pctDesv = h.objetivo > 0 ? Math.round(((h.real - h.objetivo) / h.objetivo) * 100) : 0
              const enCurso = (h as any).enCurso === true
              return (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 72px 80px 100px 100px 90px 80px', gap: 6, alignItems: 'center', padding: '10px 0', borderBottom: idx < historico.length - 1 ? `0.5px solid ${T.brd}` : 'none', background: enCurso ? OBJ_ROW_HOY_BG : 'transparent', borderLeft: enCurso ? `3px solid ${AZUL}` : '3px solid transparent', paddingLeft: enCurso ? 8 : 0, marginLeft: enCurso ? -8 : 0, borderRadius: 0 }}>
                  <span style={{ fontFamily: FONT.body, fontSize: 13, color: enCurso ? AZUL : T.pri, fontWeight: enCurso ? 600 : 400 }}>{h.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ flex: 1, height: 8, background: T.brd, borderRadius: 4, display: 'flex', overflow: 'hidden' }}>
                      <div style={{ height: 8, background: bc, width: `${pctCap}%` }} />
                      <div style={{ height: 8, background: INCUMPLIDO, width: `${100 - pctCap}%` }} />
                    </div>
                  </div>
                  <span style={{ fontFamily: FONT.heading, fontSize: 12, fontWeight: 600, color: sc, textAlign: 'right' }}>{pct}%</span>
                  <span style={{ fontFamily: FONT.body, fontSize: 13, fontWeight: 500, color: T.pri, textAlign: 'right' }}>{fmtEur(h.real)}</span>
                  <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, textAlign: 'right' }}>{fmtEur(h.objetivo)}</span>
                  <span style={{ fontFamily: FONT.body, fontSize: 13, fontWeight: 500, color: desvColor, textAlign: 'right' }}>{(desv >= 0 ? '+' : '') + fmtEur(desv)}</span>
                  <span style={{ fontFamily: FONT.heading, fontSize: 12, fontWeight: 600, color: desvColor, textAlign: 'right' }}>{(pctDesv >= 0 ? '+' : '') + pctDesv + '%'}</span>
                </div>
              )
            })}
          </Papel>
        </>
      )}

      {activeTab === 'presupuestos' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <select value={presAnio} onChange={e => setPresAnio(parseInt(e.target.value))} style={inputSelectStyle}>
              {[hoy.getFullYear() - 1, hoy.getFullYear(), hoy.getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={copiarAnioAnterior} disabled={presSaving}
              style={{ background: CLARO, color: T.sec, border: BORDER_FINO, borderRadius: 0, padding: '5px 14px', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', cursor: presSaving ? 'default' : 'pointer', opacity: presSaving ? 0.5 : 1 }}>
              Copiar año anterior
            </button>
            {presSaving && <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>Guardando…</span>}
          </div>

          {presLoading ? (
            <div style={{ color: T.mut, fontFamily: FONT.body, padding: '24px 0' }}>Cargando presupuesto…</div>
          ) : (
            presupuestoGrupos.map(grupo => {
              const totalGrupoMes = (mes: number) => grupo.codigos.reduce((a, c) => a + getPresVal(c.codigo, mes), 0)
              const totalGrupoAnual = () => grupo.codigos.reduce((a, c) => a + totalCodigo(c.codigo), 0)
              return (
                <div key={grupo.grupo} style={{ marginBottom: 28 }}>
                  <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: LIMA, marginBottom: 8 }}>{grupo.label}</div>
                  <Papel ceja={GRANATE} pad="0" style={{ overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                      <thead>
                        <tr style={{ background: INK }}>
                          <th style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '8px 12px', textAlign: 'left', position: 'sticky', left: 0, background: INK, zIndex: 1, minWidth: 160 }}>Categoría</th>
                          {MESES.map(m => <th key={m} style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: T.mut, padding: '8px 6px', textAlign: 'right', minWidth: 72 }}>{m}</th>)}
                          <th style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: T.mut, padding: '8px 10px', textAlign: 'right', minWidth: 90 }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.codigos.map(cat => (
                          <tr key={cat.codigo} style={{ borderTop: `1px solid ${T.brd}` }}>
                            <td style={{ fontFamily: FONT.body, fontSize: 12, color: INK, padding: '7px 12px', position: 'sticky', left: 0, background: BLANCO, zIndex: 1 }}>
                              <span style={{ fontFamily: FONT.heading, fontSize: 10, color: LIMA, marginRight: 6 }}>{cat.codigo}</span>
                              {cat.nombre}
                            </td>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => {
                              const cellKey = `${cat.codigo}-${mes}`
                              const val = getPresVal(cat.codigo, mes)
                              return (
                                <td key={mes} style={{ padding: '4px 6px', textAlign: 'right' }}>
                                  {presEditing === cellKey ? (
                                    <input type="number" value={presEditVal} onChange={e => setPresEditVal(e.target.value)}
                                      onBlur={() => commitPresEdit(cat.codigo, mes)}
                                      onKeyDown={e => { if (e.key === 'Enter') commitPresEdit(cat.codigo, mes); if (e.key === 'Escape') setPresEditing(null) }}
                                      autoFocus
                                      style={{ fontFamily: FONT.heading, fontSize: 11, color: T.pri, background: INK, border: `1px solid ${LIMA}`, borderRadius: 0, padding: '3px 5px', width: 66, textAlign: 'right' }}
                                    />
                                  ) : (
                                    <span onClick={() => { setPresEditing(cellKey); setPresEditVal(String(val)) }}
                                      style={{ fontFamily: FONT.heading, fontSize: 11, color: val > 0 ? INK : GRIS, cursor: 'pointer', display: 'block', padding: '3px 2px', borderRadius: 3 }}
                                      title="Clic para editar">
                                      {val > 0 ? fmtEur(val) : '—'}
                                    </span>
                                  )}
                                </td>
                              )
                            })}
                            <td style={{ fontFamily: FONT.heading, fontSize: 11, color: LIMA, padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>
                              {fmtEur(totalCodigo(cat.codigo))}
                            </td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: `2px solid ${T.brd}`, background: INK }}>
                          <td style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px', color: LIMA, padding: '8px 12px', textTransform: 'uppercase', position: 'sticky', left: 0, background: INK, zIndex: 1 }}>
                            Total {grupo.label.split(' ')[0]}
                          </td>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => (
                            <td key={mes} style={{ fontFamily: FONT.heading, fontSize: 11, color: LIMA, padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>
                              {fmtEur(totalGrupoMes(mes))}
                            </td>
                          ))}
                          <td style={{ fontFamily: FONT.heading, fontSize: 12, color: LIMA, padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>
                            {fmtEur(totalGrupoAnual())}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </Papel>
                </div>
              )
            })
          )}

          {!presLoading && (
            <Papel ceja={GRANATE} pad="0" style={{ marginTop: 4, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <tbody>
                  <tr style={{ background: INK }}>
                    <td style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', color: LIMA, padding: '10px 12px', textTransform: 'uppercase', minWidth: 160 }}>Total gastos {presAnio}</td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => (
                      <td key={mes} style={{ fontFamily: FONT.heading, fontSize: 11, color: T.pri, padding: '10px 6px', textAlign: 'right', fontWeight: 600, minWidth: 72 }}>
                        {fmtEur(totalMesPres(mes))}
                      </td>
                    ))}
                    <td style={{ fontFamily: FONT.heading, fontSize: 13, color: LIMA, padding: '10px 10px', textAlign: 'right', fontWeight: 700, minWidth: 90 }}>
                      {fmtEur(totalAnual())}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Papel>
          )}
        </div>
      )}

    </PantallaCantera>
  )
}

export default Objetivos
