import { useMemo, useState, useEffect } from 'react'
import { useTheme, fmtFechaCorta } from '@/styles/tokens'
import { ResumenDashboard } from '@/components/conciliacion/ResumenDashboard'
import { useAniosDisponibles } from '@/hooks/useAniosDisponibles'
import { toast } from '@/lib/toastStore'
import type { Movimiento } from '@/types/conciliacion'
import { useConciliacion } from '@/hooks/useConciliacion'
import TabsPastilla from '@/components/ui/TabsPastilla'
import TabMovimientos from '@/components/conciliacion/TabMovimientos'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import { normalizarConcepto, matchPatron, inicializarStopwords } from '@/lib/normalizarConcepto'
import { fechaLocalStr } from '@/utils/fechaLocal'
import { PanelCobertura } from '@/components/conciliacion/PanelCobertura'

type PeriodoKey = 'mes' | 'mes_anterior' | 'trimestre' | '30d' | 'personalizado' | string

const ModalAddGasto = ({ open }: { open: boolean; onClose: () => void; onSaved: () => void }) =>
  open ? null : null

const TAB_STORAGE_KEY = 'conciliacion:tab'

type Tab = 'resumen' | 'movimientos'

function loadTab(): Tab {
  try {
    const raw = sessionStorage.getItem(TAB_STORAGE_KEY)
    if (raw === 'movimientos' || raw === 'resumen')
      return raw
  } catch { /* swallow */ }
  return 'movimientos'
}

function saveTab(t: Tab) {
  try { sessionStorage.setItem(TAB_STORAGE_KEY, t) } catch { /* swallow */ }
}

type FiltroRapido = 'pendientes' | 'asociadas' | 'faltantes' | 'duplicadas' | 'sin_titular' | null

export default function Conciliacion({ periodoExterno }: { periodoExterno?: { desde: Date; hasta: Date } } = {}) {
  // Modo integrado: dentro del supermódulo Documentación. La cabecera, el selector
  // de fechas, la card gigante de cobertura y la pestaña Resumen viven fuera (en
  // Documentación). Aquí queda solo la tabla de Movimientos.
  const integrado = !!periodoExterno
  const { isDark } = useTheme()
  const [tab, setTab] = useState<Tab>(loadTab())
  const [periodo] = useState<PeriodoKey>('mes')
  const [customDesde] = useState<string>('')
  const [customHasta] = useState<string>('')
  useAniosDisponibles()
  useEffect(() => { saveTab(tab) }, [tab])
  useEffect(() => { inicializarStopwords() }, [])
  const [periodoDesdeInt, setPeriodoDesdeInt] = useState<Date>(() => {
    const h = new Date(); h.setDate(1); h.setHours(0, 0, 0, 0); return h
  })
  const [periodoHastaInt, setPeriodoHastaInt] = useState<Date>(() => {
    const h = new Date(); h.setHours(23, 59, 59, 999); return h
  })
  const [periodoLabelSFU, setPeriodoLabelSFU] = useState('Mes en curso')
  const periodoDesde = periodoExterno?.desde ?? periodoDesdeInt
  const periodoHasta = periodoExterno?.hasta ?? periodoHastaInt
  const [filtroCard, setFiltroCard] = useState<'pendientes' | 'ingreso' | 'gasto' | null>(null)
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>(null)
  const [modalGastoOpen, setModalGastoOpen] = useState(false)
  const [ultimaPropagacion, setUltimaPropagacion] = useState<string[] | null>(null)
  const { movimientos: movimientosBD, updateCategoria, categorias: categoriasBD } = useConciliacion()

  const tipoPorCodigo = useMemo(() => {
    const m: Record<string, 'ingreso' | 'gasto'> = {}
    categoriasBD.forEach(c => { m[c.codigo] = c.tipo_parent })
    return m
  }, [categoriasBD])

  const movimientos = useMemo<Movimiento[]>(
    () =>
      movimientosBD.map(m => ({
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
        doc_estado: m.doc_estado_real ?? 'falta',
      })),
    [movimientosBD],
  )

  const { rangoActual, rangoAnterior } = useMemo(() => {
    const hoy = new Date(); hoy.setHours(23, 59, 59, 999)
    let inicio: Date; let fin: Date = new Date(hoy)
    if (periodo === 'mes') { inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1) }
    else if (periodo === 'mes_anterior') {
      inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
      fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59)
    }
    else if (periodo === 'trimestre') { inicio = new Date(hoy); inicio.setDate(inicio.getDate() - 89) }
    else if (periodo.startsWith('anio_')) {
      const year = Number(periodo.slice(5)); inicio = new Date(year, 0, 1); fin = new Date(year, 11, 31, 23, 59, 59)
    }
    else if (periodo === 'personalizado' && customDesde && customHasta) {
      inicio = new Date(customDesde + 'T00:00:00'); fin = new Date(customHasta + 'T23:59:59')
    }
    else { inicio = new Date(hoy); inicio.setDate(inicio.getDate() - 30) }
    inicio.setHours(0, 0, 0, 0)
    const duracionMs = fin.getTime() - inicio.getTime()
    const finAnt = new Date(inicio.getTime() - 24 * 60 * 60 * 1000); finAnt.setHours(23, 59, 59, 999)
    const inicioAnt = new Date(finAnt.getTime() - duracionMs); inicioAnt.setHours(0, 0, 0, 0)
    return {
      rangoActual: { inicio, fin },
      rangoAnterior: { inicio: inicioAnt, fin: finAnt },
    }
  }, [periodo, customDesde, customHasta])

  const dedupKeys = useMemo(() => {
    const seen = new Map<string, number>()
    for (const m of movimientos) {
      const key = `${m.importe}|${m.fecha}|${m.concepto}`
      seen.set(key, (seen.get(key) ?? 0) + 1)
    }
    return seen
  }, [movimientos])

  const movimientosFiltrados = useMemo(() => {
    return movimientos
      .filter(m => {
        const f = new Date(m.fecha + 'T12:00:00')
        return f >= rangoActual.inicio && f <= rangoActual.fin
      })
      .filter(m => {
        if (filtroCard === 'pendientes') return !m.categoria_id
        if (filtroCard === 'ingreso') return m.importe > 0
        if (filtroCard === 'gasto') return m.importe < 0
        return true
      })
      .filter(m => {
        if (!filtroRapido) return true
        if (filtroRapido === 'pendientes') return !m.categoria_id
        if (filtroRapido === 'asociadas') return !!m.factura_id
        if (filtroRapido === 'faltantes') return !!m.categoria_id && !m.factura_id && m.importe < 0
        if (filtroRapido === 'duplicadas') {
          const key = `${m.importe}|${m.fecha}|${m.concepto}`
          return (dedupKeys.get(key) ?? 0) > 1
        }
        if (filtroRapido === 'sin_titular') return !m.titular_id
        return true
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [movimientos, rangoActual, filtroCard, filtroRapido, dedupKeys])

  const movimientosAnterior = useMemo(() => {
    return movimientos.filter(m => {
      const f = new Date(m.fecha + 'T12:00:00')
      return f >= rangoAnterior.inicio && f <= rangoAnterior.fin
    })
  }, [movimientos, rangoAnterior])

  const handleDeshacerPropagacion = async () => {
    if (!ultimaPropagacion) return
    for (const movId of ultimaPropagacion) {
      try { await updateCategoria(movId, null, null) } catch {}
    }
    setUltimaPropagacion(null)
    toast.success(
      `${ultimaPropagacion.length} movimiento${ultimaPropagacion.length > 1 ? 's' : ''} revertido${ultimaPropagacion.length > 1 ? 's' : ''}`,
    )
  }

  const hoyDate = new Date()
  const mesNombreRaw = hoyDate.toLocaleDateString('es-ES', { month: 'long' })
  const mesNombre = mesNombreRaw.charAt(0).toUpperCase() + mesNombreRaw.slice(1)
  const anioActual = hoyDate.getFullYear()
  const ultimoDiaMes = new Date(anioActual, hoyDate.getMonth() + 1, 0).getDate()
  const diasRestantes = Math.max(0, ultimoDiaMes - hoyDate.getDate())

  return (
    <div style={{ background: integrado ? 'transparent' : '#f5f3ef', padding: integrado ? 0 : '24px 28px' }}>
      {!integrado && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ color: '#B01D23', fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 600, letterSpacing: '3px', margin: 0, textTransform: 'uppercase' }}>
              CONCILIACIÓN
            </h2>
            <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090', display: 'block', marginTop: 4 }}>
              {fmtFechaCorta(fechaLocalStr(periodoDesde))} — {fmtFechaCorta(fechaLocalStr(periodoHasta))}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <SelectorFechaUniversal
              nombreModulo="conciliacion"
              defaultOpcion="mes_en_curso"
              onChange={(desde, hasta, label) => {
                setPeriodoDesdeInt(desde)
                setPeriodoHastaInt(hasta)
                setPeriodoLabelSFU(label)
              }}
            />
          </div>
        </div>
      )}

      {/* Card gigante de cobertura y pestaña Resumen: solo en modo standalone */}
      {!integrado && <PanelCobertura />}

      {!integrado && (
        <TabsPastilla
          tabs={[
            { id: 'resumen', label: 'Resumen' },
            { id: 'movimientos', label: 'Movimientos' },
          ]}
          activeId={tab}
          onChange={(id) => setTab(id as Tab)}
        />
      )}

      {!integrado && tab === 'resumen' && (
        <ResumenDashboard
          movimientos={movimientosFiltrados}
          movimientosAnterior={movimientosAnterior}
          mesNombre={mesNombre}
          anio={anioActual}
          diasRestantes={diasRestantes}
        />
      )}

      {(integrado || tab === 'movimientos') && (
        <TabMovimientos
          periodoLabel={integrado ? '' : periodoLabelSFU}
          periodoDesde={periodoDesde}
          periodoHasta={periodoHasta}
        />
      )}

      <ModalAddGasto
        open={modalGastoOpen}
        onClose={() => setModalGastoOpen(false)}
        onSaved={() => { setModalGastoOpen(false) }}
      />

      {ultimaPropagacion && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1e2233', color: '#fff', borderRadius: 10, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 14, zIndex: 200, fontFamily: 'Lexend, sans-serif', fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
          <span>{ultimaPropagacion.length} movimiento{ultimaPropagacion.length > 1 ? 's' : ''} categorizados</span>
          <button onClick={handleDeshacerPropagacion} style={{ background: '#e8f442', color: '#1e2233', border: 'none', borderRadius: 6, padding: '5px 12px', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>Deshacer</button>
          <button onClick={() => setUltimaPropagacion(null)} style={{ background: 'transparent', color: '#aaa', border: 'none', fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        </div>
      )}
    </div>
  )
}
