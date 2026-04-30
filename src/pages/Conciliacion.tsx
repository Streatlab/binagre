import { useMemo, useState, type CSSProperties } from 'react'
import { Search, Zap } from 'lucide-react'
import { fmtEur, fmtDate } from '@/utils/format'
import { useTheme, FONT } from '@/styles/tokens'
import { KpiCard } from '@/components/KpiCard'
import { ResumenDashboard } from '@/components/conciliacion/ResumenDashboard'
import ImportDropzone, { type ParsedRow } from '@/components/conciliacion/ImportDropzone'
import { type PeriodoKey } from '@/components/finanzas/running/SelectorPeriodoDropdown'
import { useAniosDisponibles } from '@/hooks/useAniosDisponibles'
import { toast } from '@/lib/toastStore'
import type { Movimiento, Regla } from '@/types/conciliacion'
import { useConciliacion } from '@/hooks/useConciliacion'
import ModalAddGasto from '@/components/finanzas/running/ModalAddGasto'
import TabsPastilla from '@/components/ui/TabsPastilla'
import TabMovimientos from '@/components/conciliacion/TabMovimientos'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'

/* ═══════════════════════════════════════════════════════════
   CATEGORÍAS
   ═══════════════════════════════════════════════════════════ */

/* CATEGORIAS static array removed — now using categoriasBD from Supabase (plan contable) */

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

const STOP_WORDS = new Set(['liquidacion','pedido','nomina','del','de','la','el','por','para','con','sin','abril','marzo','febrero','enero','semana'])

function extraerPatron(concepto: string): string {
  const w = concepto.toLowerCase().split(/\s+/).find(x => x.length > 3 && !STOP_WORDS.has(x))
  return w ?? concepto.slice(0, 10).toLowerCase()
}

function matchPatron(concepto: string, patron: string): boolean {
  if (!patron) return false
  const c = concepto.toLowerCase()
  const p = patron.toLowerCase()
  if (!p.includes('*') && !p.includes('?')) return c.includes(p)
  const esc = p.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const rx = new RegExp('^' + esc.replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
  return rx.test(c)
}

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

function colorContraparte(nombre: string): string | null {
  const n = nombre.toLowerCase().trim()
  if (n.includes('uber')) return '#06C167'
  if (n.includes('glovo')) return '#e8f442'
  if (n.includes('just eat') || n === 'just eat' || n.includes('justeat')) return '#f5a623'
  if (n.includes('rushour') || n.includes('web') || n.includes('tienda')) return '#B01D23'
  return null
}

function calcularLabelPeriodo(periodo: string, customDesde?: string, customHasta?: string): string {
  const now = new Date()
  const mes = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  if (periodo === 'mes') return mes.toUpperCase()
  if (periodo === 'mes_anterior') {
    const ma = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return ma.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()
  }
  if (periodo === 'trimestre') return 'ÚLTIMOS 3 MESES'
  if (periodo.startsWith('anio_')) return `AÑO ${periodo.slice(5)}`
  if (periodo === 'personalizado' && customDesde && customHasta) {
    return `${customDesde} — ${customHasta}`
  }
  return 'ÚLTIMOS 31 DÍAS'
}

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */

type Tab = 'resumen' | 'movimientos'

type FiltroRapido = 'pendientes' | 'asociadas' | 'faltantes' | 'duplicadas' | 'sin_titular' | null

export default function Conciliacion() {
  const { T, isDark } = useTheme()

  const [tab, setTab]           = useState<Tab>('resumen')
  const [periodo, setPeriodo]   = useState<PeriodoKey>('mes')
  const [customDesde, setCustomDesde] = useState<string>('')
  const [customHasta, setCustomHasta] = useState<string>('')
  const aniosDisponibles = useAniosDisponibles()

  // Periodo para TabMovimientos via SelectorFechaUniversal
  const [periodoDesde, setPeriodoDesde] = useState<Date>(() => {
    const h = new Date(); h.setDate(1); h.setHours(0, 0, 0, 0); return h
  })
  const [periodoHasta, setPeriodoHasta] = useState<Date>(() => {
    const h = new Date(); h.setHours(23, 59, 59, 999); return h
  })
  const [periodoLabelSFU, setPeriodoLabelSFU] = useState('Mes en curso')
  const [catFiltro, setCatFiltro] = useState<string>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [filtroCard, setFiltroCard] = useState<'pendientes' | 'ingreso' | 'gasto' | null>(null)
  const toggleFiltroCard = (k: 'pendientes' | 'ingreso' | 'gasto') => {
    setFiltroCard(prev => prev === k ? null : k)
  }
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>(null)
  const [modalGastoOpen, setModalGastoOpen] = useState(false)
  const toggleFiltroRapido = (k: NonNullable<FiltroRapido>) => {
    setFiltroRapido(prev => prev === k ? null : k)
  }
  const [importResult, setImportResult] = useState<{ insertados: number; duplicados: number; omitidos: number } | null>(null)

  const [reglas, setReglas] = useState<Regla[]>([])
  const {
    movimientos: movimientosBD,
    insertMovimientos,
    updateCategoria,
    categorias: categoriasBD,
    loading: loadingBD,
  } = useConciliacion()

  /* — Agrupación para el dropdown: Ingresos arriba, gastos por `grupo` — */
  const dropdownGroups = useMemo(() => {
    const ingresos = categoriasBD.filter(c => c.tipo_parent === 'ingreso')
    const gastos = categoriasBD.filter(c => c.tipo_parent === 'gasto')
    const porGrupo: Record<string, typeof gastos> = {}
    for (const c of gastos) {
      const k = c.grupo ?? 'OTROS'
      ;(porGrupo[k] = porGrupo[k] || []).push(c)
    }
    const gruposOrdenados = Object.keys(porGrupo).sort()
    return { ingresos, gastosPorGrupo: gruposOrdenados.map(g => ({ grupo: g, items: porGrupo[g] })) }
  }, [categoriasBD])

  /* — Lookup código → tipo, para derivar tipo en handleCategorizar — */
  const tipoPorCodigo = useMemo(() => {
    const m: Record<string, 'ingreso' | 'gasto'> = {}
    categoriasBD.forEach(c => { m[c.codigo] = c.tipo_parent })
    return m
  }, [categoriasBD])

  const movimientos = useMemo<Movimiento[]>(
    () => movimientosBD.map(m => ({
      id: m.id,
      fecha: m.fecha,
      concepto: m.concepto,
      importe: Number(m.importe),
      categoria_id: m.categoria,
      contraparte: m.proveedor ?? '',
      gasto_id: m.gasto_id ?? null,
      factura_id: m.factura_id ?? null,
      factura_data: m.factura_data ?? null,
      titular_id: m.titular_id ?? null,
      doc_estado: ((m as unknown as { doc_estado?: 'tiene' | 'falta' | 'no_requiere' | null }).doc_estado) ?? 'falta',
    })),
    [movimientosBD]
  )

  /* — Filtrado por período para TabMovimientos (SelectorFechaUniversal) — */
  const movimientosPeriodo = useMemo(() =>
    movimientos.filter(m => {
      const f = new Date(m.fecha + 'T12:00:00')
      return f >= periodoDesde && f <= periodoHasta
    }),
    [movimientos, periodoDesde, periodoHasta]
  )

  /* — Categorización inline con aprendizaje (persiste en BD) — */
  const handleCategorizar = async (movId: string, catId: string, concepto: string) => {
    const normalizedCat = catId === '' ? null : catId
    const mov = movimientos.find(m => m.id === movId)
    const tipo: 'ingreso' | 'gasto' | null =
      !normalizedCat ? null
      : (tipoPorCodigo[normalizedCat] ?? (mov && mov.importe >= 0 ? 'ingreso' : 'gasto'))

    try {
      await updateCategoria(movId, normalizedCat, tipo)
    } catch (err) {
      console.error('Error guardando categoría:', err)
      return
    }

    if (normalizedCat) {
      const patron = extraerPatron(concepto)
      const similares = movimientos.filter(m =>
        m.id !== movId &&
        !m.categoria_id &&
        matchPatron(m.concepto, patron)
      )
      for (const s of similares) {
        const sTipo: 'ingreso' | 'gasto' = s.importe >= 0 ? 'ingreso' : 'gasto'
        try {
          await updateCategoria(s.id, normalizedCat, sTipo)
        } catch (err) {
          console.error('Error auto-categorizando:', err)
        }
      }
      setReglas(prev => [...prev, { patron, categoria_id: normalizedCat }])
    }
  }

  /* — Cálculo rango actual / anterior según período — */
  const { rangoActual, rangoAnterior, rangoFechasLegible } = useMemo(() => {
    const hoy = new Date()
    hoy.setHours(23, 59, 59, 999)
    let inicio: Date
    let fin: Date = new Date(hoy)

    if (periodo === 'mes') {
      inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    } else if (periodo === 'mes_anterior') {
      inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
      fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59)
    } else if (periodo === 'trimestre') {
      inicio = new Date(hoy)
      inicio.setDate(inicio.getDate() - 89)
    } else if (periodo.startsWith('anio_')) {
      const year = Number(periodo.slice(5))
      inicio = new Date(year, 0, 1)
      fin = new Date(year, 11, 31, 23, 59, 59)
    } else if (periodo === 'personalizado' && customDesde && customHasta) {
      inicio = new Date(customDesde + 'T00:00:00')
      fin = new Date(customHasta + 'T23:59:59')
    } else {
      // '30d' | 'personalizado' sin rango
      inicio = new Date(hoy)
      inicio.setDate(inicio.getDate() - 30)
    }
    inicio.setHours(0, 0, 0, 0)

    const duracionMs = fin.getTime() - inicio.getTime()
    const finAnt = new Date(inicio.getTime() - 24 * 60 * 60 * 1000)
    finAnt.setHours(23, 59, 59, 999)
    const inicioAnt = new Date(finAnt.getTime() - duracionMs)
    inicioAnt.setHours(0, 0, 0, 0)

    const fmt = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    const legible = `${fmt(inicio)} — ${fmt(fin)} ${fin.getFullYear()}`

    return {
      rangoActual: { inicio, fin },
      rangoAnterior: { inicio: inicioAnt, fin: finAnt },
      rangoFechasLegible: legible,
    }
  }, [periodo, customDesde, customHasta])

  /* — Detección de duplicados para filtro rápido — */
  const dedupKeys = useMemo(() => {
    const seen = new Map<string, number>()
    for (const m of movimientos) {
      const key = `${m.importe}|${m.fecha}|${m.concepto}`
      seen.set(key, (seen.get(key) ?? 0) + 1)
    }
    return seen
  }, [movimientos])

  /* — Filtrado principal — */
  const movimientosFiltrados = useMemo(() => {
    return movimientos
      .filter(m => {
        const f = new Date(m.fecha + 'T12:00:00')
        return f >= rangoActual.inicio && f <= rangoActual.fin
      })
      .filter(m => catFiltro === 'todas' || m.categoria_id === catFiltro)
      .filter(m => {
          if (!busqueda) return true
          const q = busqueda.toLowerCase()
          return (
            m.concepto.toLowerCase().includes(q) ||
            (m.contraparte && m.contraparte.toLowerCase().includes(q)) ||
            (m.factura_id && m.factura_id.toLowerCase().includes(q)) ||
            String(Math.abs(m.importe)).includes(q)
          )
        })
      .filter(m => {
        if (filtroCard === 'pendientes') return !m.categoria_id
        if (filtroCard === 'ingreso')    return m.importe > 0
        if (filtroCard === 'gasto')      return m.importe < 0
        return true
      })
      .filter(m => {
        if (!filtroRapido) return true
        if (filtroRapido === 'pendientes')  return !m.categoria_id
        if (filtroRapido === 'asociadas')   return !!m.factura_id
        if (filtroRapido === 'faltantes')   return !!m.categoria_id && !m.factura_id && m.importe < 0
        if (filtroRapido === 'duplicadas') {
          const key = `${m.importe}|${m.fecha}|${m.concepto}`
          return (dedupKeys.get(key) ?? 0) > 1
        }
        if (filtroRapido === 'sin_titular') return !m.titular_id
        return true
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [movimientos, catFiltro, busqueda, rangoActual, filtroCard, filtroRapido, dedupKeys])

  /* — Movimientos del período anterior (comparativas) — */
  const movimientosAnterior = useMemo(() => {
    return movimientos.filter(m => {
      const f = new Date(m.fecha + 'T12:00:00')
      return f >= rangoAnterior.inicio && f <= rangoAnterior.fin
    })
  }, [movimientos, rangoAnterior])

  /* — Derivados reactivos (KPIs Movimientos) — */
  const datos = useMemo(() => {
    const ingresos = movimientosFiltrados.filter(m => m.importe > 0)
    const gastos = movimientosFiltrados.filter(m => m.importe < 0)
    const sumIng = ingresos.reduce((s, m) => s + m.importe, 0)
    const sumGst = Math.abs(gastos.reduce((s, m) => s + m.importe, 0))
    const balance = sumIng - sumGst
    const pendientes = movimientosFiltrados.filter(m => !m.categoria_id).length
    return { ingresos, gastos, sumIng, sumGst, balance, pendientes }
  }, [movimientosFiltrados])

  const periodoLabel = calcularLabelPeriodo(periodo, customDesde, customHasta)

  /* — Mes/año/días restantes (presupuestos) — */
  const hoyDate = new Date()
  const mesNombreRaw = hoyDate.toLocaleDateString('es-ES', { month: 'long' })
  const mesNombre = mesNombreRaw.charAt(0).toUpperCase() + mesNombreRaw.slice(1)
  const anioActual = hoyDate.getFullYear()
  const ultimoDiaMes = new Date(anioActual, hoyDate.getMonth() + 1, 0).getDate()
  const diasRestantes = Math.max(0, ultimoDiaMes - hoyDate.getDate())

  /* ═══════════════════════════════════════════════════════════
     STYLES INLINE
     ═══════════════════════════════════════════════════════════ */

  const labelStyle: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: T.mut,
    marginBottom: 6,
    display: 'block',
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    backgroundColor: T.inp,
    color: T.pri,
    border: `1px solid ${T.brd}`,
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: 13,
    fontFamily: FONT.body,
    outline: 'none',
    minHeight: 40,
  }

  const thStyle: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 10,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: T.mut,
    padding: '10px 12px',
    textAlign: 'left',
    background: T.group,
    borderBottom: `0.5px solid ${T.brd}`,
    fontWeight: 400,
    whiteSpace: 'nowrap',
  }

  const tdStyle: CSSProperties = {
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: FONT.body,
    color: T.pri,
    borderBottom: `0.5px solid ${T.brd}`,
    whiteSpace: 'nowrap',
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */

  return (
    <div style={{ background: '#f5f3ef', padding: '24px 28px' }}>

      {loadingBD && (
        <div style={{ padding: 40, textAlign: 'center', color: '#7a8090', fontFamily: 'Lexend, sans-serif' }}>
          Cargando movimientos…
        </div>
      )}

      {/* HEADER — spec B.1 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{
            color: '#B01D23',
            fontFamily: 'Oswald, sans-serif',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '3px',
            margin: 0,
            textTransform: 'uppercase',
          }}>
            CONCILIACIÓN
          </h2>
          <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090', display: 'block', marginTop: 4 }}>
            {fmtDate(periodoDesde)} — {fmtDate(periodoHasta)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <SelectorFechaUniversal
            nombreModulo="conciliacion"
            defaultOpcion="mes_en_curso"
            onChange={(desde, hasta, label) => {
              setPeriodoDesde(desde)
              setPeriodoHasta(hasta)
              setPeriodoLabelSFU(label)
            }}
          />
        </div>
      </div>

      {/* TABS PASTILLA — spec B.2 */}
      <TabsPastilla
        tabs={[
          { id: 'resumen', label: 'Resumen' },
          { id: 'movimientos', label: 'Movimientos' },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      {/* Pestaña Resumen */}
      {tab === 'resumen' && (
        <ResumenDashboard
          movimientos={movimientosFiltrados}
          movimientosAnterior={movimientosAnterior}
          mesNombre={mesNombre}
          anio={anioActual}
          diasRestantes={diasRestantes}
        />
      )}

      {/* Pestaña Movimientos — nuevo TabMovimientos */}
      {tab === 'movimientos' && (
        <TabMovimientos
          movimientos={movimientosPeriodo}
          periodoLabel={periodoLabelSFU}
          periodoDesde={periodoDesde}
          periodoHasta={periodoHasta}
        />
      )}

      {/* Legacy Movimientos (hidden — mantenido por si acaso) */}
      {false && tab === 'movimientos' && (
        <>
          {/* Sub-header: Dropzone + Filtros Categoría/Buscar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 18 }}>
            <ImportDropzone
              importResult={importResult}
              onFileLoaded={(rows: ParsedRow[], { fileName }) => {
                setImportResult(null)
                const toInsert = rows.map(r => ({
                  fecha: r.fecha,
                  concepto: r.concepto,
                  importe: r.importe,
                  tipo: (r.importe >= 0 ? 'ingreso' : 'gasto') as 'ingreso' | 'gasto',
                  categoria: null,
                  proveedor: r.contraparte ?? null,
                  factura: null,
                  mes: r.fecha?.slice(0, 7) ?? null,
                  link_factura: null,
                  notas: r.notas ?? null,
                  ordenante: r.ordenante ?? null,
                  beneficiario: r.beneficiario ?? null,
                  titular_id: r.titular_id ?? null,
                }))
                const toastId = toast.loading(`📥 Procesando ${fileName}...\n   Parseadas ${rows.length} filas`)
                insertMovimientos(toInsert, (stage, current, total) => {
                  if (stage === 'saving') {
                    toast.loading(`📥 Procesando ${fileName}...\n   Guardando ${current} / ${total} en BD`, { id: toastId })
                  } else {
                    toast.loading(`⚙️ Aplicando reglas automáticas...\n   ${current} / ${total}`, { id: toastId })
                  }
                })
                  .then(({ insertados, duplicados, omitidos }) => {
                    setImportResult({ insertados, duplicados, omitidos })
                    const partes = [
                      `✓ Importación completada`,
                      `   ${rows.length} movimientos leídos`,
                      `   ${insertados} importados, ${duplicados} duplicados (ya existían), ${omitidos} omitidos por reglas`,
                    ]
                    toast.success(partes.join('\n'), { id: toastId })
                  })
                  .catch(err => {
                    console.error('Error importando:', err)
                    toast.error(`✗ Error al importar\n   ${err?.message ?? err}`, { id: toastId })
                  })
              }}
            />
            <div>
              <label style={labelStyle}>Categoría</label>
              <select
                value={catFiltro}
                onChange={e => setCatFiltro(e.target.value)}
                disabled={filtroCard === 'pendientes'}
                style={{
                  ...inputStyle,
                  opacity: filtroCard === 'pendientes' ? 0.5 : 1,
                  cursor: filtroCard === 'pendientes' ? 'not-allowed' : undefined,
                }}
              >
                <option value="todas">Todas</option>
                {dropdownGroups.ingresos.length > 0 && (
                  <optgroup label="INGRESOS">
                    {dropdownGroups.ingresos.map(c => (
                      <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
                    ))}
                  </optgroup>
                )}
                {dropdownGroups.gastosPorGrupo.map(g => (
                  <optgroup key={g.grupo} label={g.grupo}>
                    {g.items.map(c => (
                      <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Buscar</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.mut }} />
                <input
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar proveedor / nº factura / importe / concepto"
                  style={{ ...inputStyle, paddingLeft: 32 }}
                />
              </div>
            </div>
          </div>

          {/* FILTROS RÁPIDOS */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {([
              { key: 'pendientes',  label: 'Pendientes' },
              { key: 'asociadas',   label: 'Asociadas' },
              { key: 'faltantes',   label: 'Faltantes' },
              { key: 'duplicadas',  label: 'Duplicadas' },
              { key: 'sin_titular', label: 'Sin titular' },
            ] as { key: NonNullable<FiltroRapido>; label: string }[]).map(f => (
              <button
                key={f.key}
                onClick={() => toggleFiltroRapido(f.key)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 20,
                  border: filtroRapido === f.key ? '1.5px solid #e8f442' : `1px solid ${T.brd}`,
                  backgroundColor: filtroRapido === f.key ? '#e8f44220' : 'transparent',
                  color: filtroRapido === f.key ? '#e8f442' : T.sec,
                  fontFamily: FONT.heading,
                  fontSize: 11,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.1s ease',
                }}
              >
                {f.label}
              </button>
            ))}
            {filtroRapido && (
              <button
                onClick={() => setFiltroRapido(null)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 20,
                  border: `1px solid ${T.brd}`,
                  backgroundColor: 'transparent',
                  color: T.mut,
                  fontFamily: FONT.body,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                × Quitar
              </button>
            )}
          </div>

          {/* KPIs Movimientos (clickeables → filtran tabla) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5" style={{ marginBottom: 20 }}>
            <KpiClickable
              activo={filtroCard === 'ingreso'}
              onClick={() => toggleFiltroCard('ingreso')}
              T={T}
            >
              <KpiCard
                label="Ingresos netos"
                period={periodoLabel}
                value={fmtEur(datos.sumIng)}
                delta={{ value: '+12.4% vs anterior', trend: 'up' }}
                accent="success"
              />
            </KpiClickable>
            <KpiClickable
              activo={filtroCard === 'gasto'}
              onClick={() => toggleFiltroCard('gasto')}
              T={T}
            >
              <KpiCard
                label="Gastos"
                period={periodoLabel}
                value={fmtEur(datos.sumGst)}
                delta={{ value: '-5.2% vs anterior', trend: 'down' }}
                accent="danger"
              />
            </KpiClickable>
            <KpiCard
              label="Balance neto"
              period={periodoLabel}
              value={fmtEur(datos.balance)}
              accent={datos.balance >= 0 ? 'default' : 'danger'}
            />
            <KpiClickable
              activo={filtroCard === 'pendientes'}
              onClick={() => toggleFiltroCard('pendientes')}
              T={T}
            >
              <KpiCard
                label="Pendientes categorizar"
                period={periodoLabel}
                value={datos.pendientes > 0 ? String(datos.pendientes) : 'Todo al día ✓'}
                accent="warning"
                highlighted
              />
            </KpiClickable>
          </div>

          {/* Banner filtro activo */}
          {filtroCard && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px', marginBottom: 14,
              background: T.group, border: `1px solid ${T.brd}`, borderLeft: '3px solid #B01D23',
              borderRadius: 8, fontFamily: FONT.body, fontSize: 13, color: T.pri,
            }}>
              <span>🔍</span>
              <span>
                Mostrando: <strong>{
                  filtroCard === 'pendientes' ? 'Pendientes categorizar' :
                  filtroCard === 'ingreso' ? 'Solo ingresos' : 'Solo gastos'
                }</strong>
                <span style={{ color: T.mut, marginLeft: 6 }}>
                  ({movimientosFiltrados.length} {movimientosFiltrados.length === 1 ? 'movimiento' : 'movimientos'})
                </span>
              </span>
              <button
                onClick={() => setFiltroCard(null)}
                style={{
                  marginLeft: 'auto',
                  background: 'transparent',
                  border: `1px solid ${T.brd}`,
                  borderRadius: 6,
                  padding: '4px 10px',
                  color: T.pri,
                  fontFamily: FONT.heading,
                  fontSize: 11,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >Quitar filtro ×</button>
            </div>
          )}

          {/* TABLA */}
          <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Concepto</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Importe</th>
                    <th style={thStyle}>Categoría</th>
                    <th style={thStyle}>Contraparte</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Doc</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: T.mut, padding: '28px 12px' }}>
                        Sin movimientos en este rango
                      </td>
                    </tr>
                  ) : movimientosFiltrados.map(m => {
                    const colorCp = colorContraparte(m.contraparte)
                    return (
                      <tr key={m.id}>
                        <td style={{ ...tdStyle, color: T.sec }}>{fmtFecha(m.fecha)}</td>
                        <td style={{ ...tdStyle, color: T.pri, whiteSpace: 'normal' }}>
                          <span>{m.concepto}</span>
                          {m.gasto_id && (
                            <span
                              title="Movimiento sincronizado como gasto en Running"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                marginLeft: 8,
                                padding: '1px 8px',
                                borderRadius: 10,
                                background: '#1D9E7520',
                                color: '#1D9E75',
                                fontFamily: FONT.heading,
                                fontSize: 10,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                fontWeight: 600,
                                verticalAlign: 'middle',
                              }}
                            >✓ Running</span>
                          )}
                        </td>
                        <td style={{
                          ...tdStyle,
                          textAlign: 'right',
                          color: m.importe >= 0 ? '#06C167' : '#B01D23',
                          fontFamily: FONT.heading,
                          fontWeight: 600,
                        }}>
                          {m.importe >= 0 ? '+' : ''}{fmtEur(m.importe)}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <select
                              value={m.categoria_id ?? ''}
                              onChange={e => handleCategorizar(m.id, e.target.value, m.concepto)}
                              style={{
                                backgroundColor: T.inp,
                                color: m.categoria_id ? T.pri : T.mut,
                                border: `1px solid ${m.categoria_id ? T.brd : '#f5a623'}`,
                                borderRadius: 6,
                                padding: '4px 8px',
                                fontFamily: FONT.heading,
                                fontSize: 11,
                                letterSpacing: '1px',
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                                outline: 'none',
                              }}
                            >
                              <option value="">— Categorizar —</option>
                              {dropdownGroups.ingresos.length > 0 && (
                                <optgroup label="INGRESOS">
                                  {dropdownGroups.ingresos.map(c => (
                                    <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
                                  ))}
                                </optgroup>
                              )}
                              {dropdownGroups.gastosPorGrupo.map(g => (
                                <optgroup key={g.grupo} label={g.grupo}>
                                  {g.items.map(c => (
                                    <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                            {m.auto_categorizado && (
                              <Zap size={12} color="#f5a623" aria-label="Auto: regla aplicada" />
                            )}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          {colorCp ? (
                            <span style={{
                              display: 'inline-block',
                              padding: '3px 10px',
                              borderRadius: 6,
                              backgroundColor: colorCp,
                              color: colorCp === '#e8f442' ? '#1a1a1a' : '#ffffff',
                              fontFamily: FONT.heading,
                              fontSize: 11,
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: 0.4,
                            }}>
                              {m.contraparte}
                            </span>
                          ) : (
                            <span style={{ color: T.pri }}>{m.contraparte}</span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {m.factura_id && m.factura_data?.pdf_drive_url ? (
                            <span
                              title={m.factura_data.pdf_filename || 'Abrir factura en Drive'}
                              onClick={() => window.open(m.factura_data!.pdf_drive_url!, '_blank')}
                              style={{ cursor: 'pointer', fontSize: 16, opacity: 0.85 }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
                            >
                              📎
                            </span>
                          ) : (
                            <span style={{ color: T.mut, fontSize: 11 }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer tabla */}
            <div style={{
              padding: '12px 16px',
              borderTop: `1px solid ${T.brd}`,
              color: T.mut,
              fontFamily: FONT.body,
              fontSize: 12,
              textAlign: 'center',
            }}>
              {periodoLabel} · {movimientosFiltrados.length} movimientos
            </div>
          </div>
        </>
      )}
      <ModalAddGasto open={modalGastoOpen} onClose={() => setModalGastoOpen(false)} onSaved={() => { setModalGastoOpen(false) }} />
    </div>
  )
}

/* ─────────────  Wrapper clickeable para KpiCard  ───────────── */

interface KpiClickableProps {
  activo: boolean
  onClick: () => void
  T: ReturnType<typeof useTheme>['T']
  children: React.ReactNode
}

function KpiClickable({ activo, onClick, T, children }: KpiClickableProps) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      style={{
        position: 'relative',
        cursor: 'pointer',
        borderRadius: 10,
        outline: activo ? `2px solid #B01D23` : 'none',
        outlineOffset: -1,
        transition: 'transform 120ms, opacity 120ms',
        opacity: activo ? 1 : 0.97,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
    >
      {children}
      {activo && (
        <span style={{
          position: 'absolute', top: 8, right: 8,
          background: '#B01D23', color: '#fff',
          fontFamily: 'Oswald, sans-serif', fontSize: 9, letterSpacing: 0.6,
          textTransform: 'uppercase', fontWeight: 600,
          padding: '2px 7px', borderRadius: 4,
          pointerEvents: 'none',
        }}>
          ✓ Filtrando
        </span>
      )}
      <span style={{
        position: 'absolute', bottom: 6, right: 10,
        fontSize: 10, color: T.mut, fontFamily: 'Lexend, sans-serif',
        opacity: activo ? 0 : 0.6, pointerEvents: 'none',
      }}>
        Click para filtrar
      </span>
    </div>
  )
}
