import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { useTitular } from '@/contexts/TitularContext'
import {
  useTheme,
  FONT,
  pageTitleStyle,
  type TokenSet,
} from '@/styles/tokens'
import DropzoneFacturas, { type SubidaItem } from '@/components/facturas/DropzoneFacturas'
import ModalAsociarManual from '@/components/facturas/ModalAsociarManual'
import ModalDetalleFactura, { type FacturaDetalle } from '@/components/facturas/ModalDetalleFactura'
import { useFacturasTheme, ESTADO_COLOR, ESTADO_NOMBRE } from '@/styles/facturasTheme'
import TitularSelector from '@/components/TitularSelector'

/* ═════════ TYPES ═════════ */

type Rango = '7d' | '30d' | 'mes' | 'trimestre' | 'anio' | 'todo'
type Filtro =
  | 'todas'
  | 'pendientes'
  | 'asociadas'
  | 'faltantes'
  | 'duplicadas'
  | 'error'
  | 'sin_titular'

interface ConciliacionLite {
  id: string
  fecha: string
  importe: number
  concepto: string | null
  proveedor?: string | null
}

interface FacturaGastoRaw {
  id: string
  conciliacion_id: string
  importe_asociado: number
  confianza_match: number | null
  confirmado: boolean
  cruza_cuentas?: boolean | null
  conciliacion: ConciliacionLite | null
}

interface Factura {
  id: string
  proveedor_nombre: string
  numero_factura: string
  fecha_factura: string
  es_recapitulativa: boolean
  periodo_inicio: string | null
  periodo_fin: string | null
  tipo: string
  plataforma: string | null
  total_base: number
  total_iva: number
  total: number
  pdf_drive_url: string | null
  pdf_drive_id: string | null
  pdf_original_name: string | null
  estado: string
  mensaje_matching: string | null
  error_mensaje: string | null
  ocr_confianza: number | null
  ocr_raw: unknown
  titular_id?: string | null
  titular?: { nombre: string; color: string } | null
  created_at: string
  facturas_gastos?: FacturaGastoRaw[]
}

interface Faltante {
  id: string
  proveedor_nombre: string
  frecuencia: string
  periodo_ref: string
  importe_estimado: number | null
  tolerancia_dias: number
  estado: 'ok' | 'falta' | 'en_plazo'
}

/* Fila optimista: representa un archivo en curso o reciente */
interface FilaOptimista {
  id: string
  name: string
  estado: 'uploading' | 'ok' | 'duplicada' | 'error'
  httpStatus?: number
  mensaje?: string
  detalle?: string
  /** datos reales si response ok o duplicada */
  factura?: Partial<Factura>
  /** timestamp para auto-ocultar */
  vence_en?: number
}

/* ═════════ HELPERS ═════════ */

function calcDesde(rango: Rango): string | null {
  const hoy = new Date()
  const d = new Date(hoy)
  switch (rango) {
    case '7d':  d.setDate(d.getDate() - 7);  return d.toISOString().slice(0, 10)
    case '30d': d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
    case 'mes': return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
    case 'trimestre': {
      const tri = Math.floor(hoy.getMonth() / 3) * 3
      return new Date(hoy.getFullYear(), tri, 1).toISOString().slice(0, 10)
    }
    case 'anio': return new Date(hoy.getFullYear(), 0, 1).toISOString().slice(0, 10)
    case 'todo':
    default: return null
  }
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(sub))
  }
  return btoa(binary)
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00')
  if (isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`
}

function truncar(s: string | null | undefined, n: number): string {
  if (!s) return '—'
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

const LABEL_STYLE = (T: TokenSet): CSSProperties => ({
  display: 'block', marginBottom: 6,
  fontFamily: FONT.heading, fontSize: 10, color: T.mut,
  letterSpacing: '1.3px', textTransform: 'uppercase', fontWeight: 500,
})

const SELECT_STYLE = (T: TokenSet): CSSProperties => ({
  padding: '8px 14px',
  border: `0.5px solid ${T.brd}`,
  borderRadius: 8,
  backgroundColor: T.inp,
  color: T.pri,
  fontFamily: FONT.body,
  fontSize: 13,
  cursor: 'pointer',
  outline: 'none',
})

/* ═════════ PAGE ═════════ */

export default function FacturasPage() {
  const { T } = useTheme()
  const { T: TF } = useFacturasTheme()
  const { filtro: filtroTitular } = useTitular()

  const [facturas, setFacturas] = useState<Factura[]>([])
  const [faltantes, setFaltantes] = useState<Faltante[]>([])
  const [rango, setRango] = useState<Rango>('30d')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [optimistas, setOptimistas] = useState<FilaOptimista[]>([])
  const [detalleFactura, setDetalleFactura] = useState<FacturaDetalle | null>(null)
  const [facturaAsociarManual, setFacturaAsociarManual] = useState<Factura | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState<FilaOptimista | null>(null)

  const cargarDatos = useCallback(async () => {
    const desde = calcDesde(rango)
    let qb = supabase
      .from('facturas')
      .select(
        'id, proveedor_nombre, numero_factura, fecha_factura, es_recapitulativa, periodo_inicio, periodo_fin, tipo, plataforma, total_base, total_iva, total, pdf_drive_url, pdf_drive_id, pdf_original_name, estado, mensaje_matching, error_mensaje, ocr_confianza, ocr_raw, titular_id, created_at, titular:titulares(nombre, color), facturas_gastos(id, conciliacion_id, importe_asociado, confianza_match, confirmado, cruza_cuentas, conciliacion(id, fecha, importe, concepto, proveedor))',
      )
      .order('fecha_factura', { ascending: false })
      .limit(500)
    if (desde) qb = qb.gte('fecha_factura', desde)
    if (filtroTitular !== 'unificado') qb = qb.eq('titular_id', filtroTitular)
    const { data: facturasData } = await qb

    const { data: faltantesData } = await supabase
      .from('facturas_faltantes')
      .select('*')

    setFacturas((facturasData as unknown as Factura[]) || [])
    setFaltantes((faltantesData as unknown as Faltante[]) || [])
    setLoading(false)
  }, [rango, filtroTitular])

  useEffect(() => {
    cargarDatos()
    const sub = supabase
      .channel('facturas-rediseno-v4')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facturas' }, () => cargarDatos())
      .subscribe()
    return () => { sub.unsubscribe() }
  }, [cargarDatos])

  // Auto-ocultar filas optimistas caducadas (solo para ok/duplicada; error se queda hasta dismiss)
  useEffect(() => {
    if (optimistas.length === 0) return
    const t = setInterval(() => {
      const ahora = Date.now()
      setOptimistas(prev => prev.filter(o => !o.vence_en || o.vence_en > ahora))
    }, 1000)
    return () => clearInterval(t)
  }, [optimistas.length])

  const faltan = useMemo(() => faltantes.filter(f => f.estado === 'falta'), [faltantes])

  const kpis = useMemo(() => {
    const totalPeriodo = facturas.reduce((acc, f) => acc + (Number(f.total) || 0), 0)
    return {
      totalPeriodo,
      nTotal: facturas.length,
      nPendientes: facturas.filter(f => f.estado === 'pendiente_revision').length,
      nAsociadas: facturas.filter(f => f.estado === 'asociada').length,
      nDuplicadas: facturas.filter(f => f.estado === 'duplicada').length,
      nError: facturas.filter(f => f.estado === 'error').length,
      nSinTitular: facturas.filter(f => !f.titular_id).length,
    }
  }, [facturas])

  const facturasFiltradas = useMemo<Factura[]>(() => {
    if (filtro === 'faltantes') return []
    let lista = [...facturas]
    if (filtro === 'sin_titular') {
      lista = lista.filter(f => !f.titular_id)
    } else if (filtro !== 'todas') {
      const mapEstado: Record<Exclude<Filtro, 'todas' | 'faltantes' | 'sin_titular'>, string> = {
        pendientes: 'pendiente_revision',
        asociadas: 'asociada',
        duplicadas: 'duplicada',
        error: 'error',
      }
      lista = lista.filter(f => f.estado === mapEstado[filtro])
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim()
      lista = lista.filter(f =>
        (f.proveedor_nombre || '').toLowerCase().includes(q) ||
        (f.numero_factura || '').toLowerCase().includes(q) ||
        String(f.total || '').includes(q),
      )
    }
    return lista
  }, [facturas, filtro, busqueda])

  /* — Upload con optimistic rows — */

  const subirArchivos = useCallback(async (files: File[]) => {
    if (!files.length) return
    for (const file of files) {
      const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`
      setOptimistas(prev => [{ id, name: file.name, estado: 'uploading' }, ...prev])
      try {
        const base64 = await fileToBase64(file)
        const r = await fetch('/api/facturas/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: file.name, base64, mimeType: file.type || null }),
        })
        const rawText = await r.text()
        let data: any = {}
        try { data = rawText ? JSON.parse(rawText) : {} } catch {
          data = { _raw: rawText }
        }

        const status = r.status
        // HTTP no-2xx → marcar fila como error con detalle completo
        if (!r.ok) {
          const msg = data.error || rawText.slice(0, 200) || r.statusText
          console.error('[facturas/upload]', status, data)
          setOptimistas(prev => prev.map(x => x.id === id ? {
            ...x,
            estado: 'error',
            httpStatus: status,
            mensaje: `HTTP ${status}: ${msg}`,
            detalle: rawText,
          } : x))
          continue
        }

        const estadoSrv = data.estado as string | undefined
        if (estadoSrv === 'ok') {
          setOptimistas(prev => prev.map(x => x.id === id ? {
            ...x,
            estado: 'ok',
            factura: data.factura,
            vence_en: Date.now() + 4000,
          } : x))
        } else if (estadoSrv === 'duplicada') {
          const ex = data.factura_existente || {}
          setOptimistas(prev => prev.map(x => x.id === id ? {
            ...x,
            estado: 'duplicada',
            mensaje: data.motivo || 'Ya existe',
            factura: ex,
            vence_en: Date.now() + 7000,
          } : x))
        } else if (estadoSrv === 'error') {
          console.error('[facturas/upload] estado error:', data)
          setOptimistas(prev => prev.map(x => x.id === id ? {
            ...x,
            estado: 'error',
            mensaje: data.error || 'Error desconocido',
            detalle: JSON.stringify(data, null, 2),
          } : x))
        } else if (estadoSrv === 'multi') {
          // Email con varios adjuntos — aplana
          const resultados: any[] = data.resultados || []
          resultados.forEach((res, i) => {
            const subId = `${id}-${i}`
            setOptimistas(prev => [{
              id: subId,
              name: res.archivo || file.name,
              estado: res.estado === 'ok' ? 'ok' : res.estado === 'duplicada' ? 'duplicada' : 'error',
              mensaje: res.motivo || res.error,
              factura: res.factura || res.factura_existente,
              vence_en: res.estado === 'error' ? undefined : Date.now() + 6000,
            }, ...prev.filter(p => p.id !== id)])
          })
        } else {
          console.warn('[facturas/upload] respuesta sin estado conocido:', data)
          setOptimistas(prev => prev.map(x => x.id === id ? {
            ...x,
            estado: 'error',
            mensaje: `Respuesta inesperada (HTTP ${status})`,
            detalle: JSON.stringify(data, null, 2),
          } : x))
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[facturas/upload] excepción:', err)
        setOptimistas(prev => prev.map(x => x.id === id ? {
          ...x,
          estado: 'error',
          mensaje: msg,
          detalle: err instanceof Error ? err.stack || err.message : String(err),
        } : x))
      }
    }
    cargarDatos()
  }, [cargarDatos])

  function dismissOptimista(id: string) {
    setOptimistas(prev => prev.filter(o => o.id !== id))
  }

  const labelRango: Record<Rango, string> = {
    '7d': 'Últimos 7 días',
    '30d': 'Últimos 30 días',
    mes: 'Este mes',
    trimestre: 'Este trimestre',
    anio: 'Este año',
    todo: 'Todo el histórico',
  }

  const labelFiltro: Record<Filtro, string> = {
    todas: 'Todas',
    pendientes: 'Pendientes',
    asociadas: 'Asociadas',
    faltantes: 'Faltantes',
    duplicadas: 'Duplicadas',
    error: 'Error',
    sin_titular: 'Sin titular',
  }

  return (
    <div style={{ background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 28px' }}>

      {/* BARRA SUPERIOR: título · +Subir · filtro estado · titular · rango */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ ...pageTitleStyle(T), margin: 0 }}>Importar Facturas</h1>

        <button
          onClick={() => setShowUpload(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: '#B01D23',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontFamily: FONT.heading,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} strokeWidth={3} /> Subir facturas
        </button>

        <div style={{ flex: 1 }} />

        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as Filtro)}
          style={SELECT_STYLE(T)}
        >
          {(Object.keys(labelFiltro) as Filtro[]).map(k => {
            const n = k === 'faltantes' ? faltan.length
              : k === 'todas' ? kpis.nTotal
              : k === 'pendientes' ? kpis.nPendientes
              : k === 'asociadas' ? kpis.nAsociadas
              : k === 'duplicadas' ? kpis.nDuplicadas
              : k === 'error' ? kpis.nError
              : kpis.nSinTitular
            return <option key={k} value={k}>{labelFiltro[k]} ({n})</option>
          })}
        </select>

        <TitularSelector />

        <select
          value={rango}
          onChange={(e) => setRango(e.target.value as Rango)}
          style={SELECT_STYLE(T)}
        >
          {(Object.keys(labelRango) as Rango[]).map((k) => (
            <option key={k} value={k}>{labelRango[k]}</option>
          ))}
        </select>
      </div>

      {/* KPI + BÚSQUEDA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: 16, marginBottom: 16 }}>
        <CardKpiGrande T={T} kpis={kpis} faltantes={faltan.length} />
        <PanelBuscador T={T} buscar={busqueda} setBuscar={setBusqueda} />
      </div>

      {loading && (
        <div style={{ padding: 40, color: T.mut, fontFamily: FONT.body, textAlign: 'center' }}>Cargando…</div>
      )}

      {!loading && filtro === 'faltantes' ? (
        <TablaFaltantes T={T} faltantes={faltan} />
      ) : !loading && (
        <TablaFacturasDensa
          T={T}
          optimistas={optimistas}
          facturas={facturasFiltradas}
          onClick={(f) => setDetalleFactura(f as unknown as FacturaDetalle)}
          onDismissOptimista={dismissOptimista}
          onClickError={(o) => setErrorDetalle(o)}
        />
      )}

      {/* Modal de subida */}
      {showUpload && (
        <UploadModal
          T={T}
          TF={TF}
          onClose={() => setShowUpload(false)}
          onSubir={async (files) => {
            setShowUpload(false)
            await subirArchivos(files)
          }}
          subiendo={optimistas
            .filter(o => o.estado === 'uploading')
            .map<SubidaItem>(o => ({ id: o.id, name: o.name, estado: 'uploading' }))}
        />
      )}

      {/* Modal detalle factura */}
      {detalleFactura && (
        <ModalDetalleFactura
          T={TF}
          factura={detalleFactura}
          onClose={() => setDetalleFactura(null)}
          onUpdate={() => {
            cargarDatos()
            setDetalleFactura(null)
          }}
          onOpenAsociarManual={() => {
            const f = facturas.find(x => x.id === detalleFactura.id) || null
            setFacturaAsociarManual(f)
            setDetalleFactura(null)
          }}
        />
      )}
      {facturaAsociarManual && (
        <ModalAsociarManual
          T={TF}
          factura={facturaAsociarManual as any}
          onClose={() => setFacturaAsociarManual(null)}
          onUpdate={() => {
            cargarDatos()
            setFacturaAsociarManual(null)
          }}
        />
      )}

      {/* Modal de detalle de error de upload */}
      {errorDetalle && (
        <ErrorModal T={T} item={errorDetalle} onClose={() => setErrorDetalle(null)} />
      )}
    </div>
  )
}

/* ═════════ CARD KPI GRANDE ═════════ */

function CardKpiGrande({ T, kpis, faltantes }: {
  T: TokenSet
  kpis: { totalPeriodo: number; nTotal: number; nPendientes: number; nAsociadas: number; nDuplicadas: number; nSinTitular: number }
  faltantes: number
}) {
  const filas = [
    { label: 'Pendientes', n: kpis.nPendientes, color: '#BA7517' },
    { label: 'Asociadas', n: kpis.nAsociadas, color: '#1D9E75' },
    { label: 'Faltantes', n: faltantes, color: '#A32D2D' },
    { label: 'Duplicadas', n: kpis.nDuplicadas, color: T.mut },
    { label: 'Sin titular', n: kpis.nSinTitular, color: T.mut },
  ]
  return (
    <div style={{
      backgroundColor: T.card,
      borderRadius: 16,
      padding: '24px 28px',
      border: `0.5px solid ${T.brd}`,
    }}>
      <div style={{
        fontFamily: FONT.heading, fontSize: 11, color: T.mut,
        letterSpacing: '1.3px', textTransform: 'uppercase', fontWeight: 500,
      }}>
        Total facturas del periodo
      </div>
      <div style={{
        fontFamily: FONT.heading, fontSize: 40, color: T.pri,
        fontWeight: 600, marginTop: 8, letterSpacing: '-0.5px', lineHeight: 1,
      }}>
        {fmtEur(kpis.totalPeriodo)}
      </div>
      <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.mut, marginTop: 6 }}>
        {kpis.nTotal} factura{kpis.nTotal === 1 ? '' : 's'}
      </div>
      <div style={{ height: 1, backgroundColor: T.brd, margin: '18px 0' }} />
      {filas.map(r => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: r.color, marginRight: 12 }} />
          <span style={{ flex: 1, fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{r.label}</span>
          <span style={{ fontFamily: FONT.heading, fontSize: 16, color: T.pri, fontWeight: 600 }}>{r.n}</span>
        </div>
      ))}
    </div>
  )
}

/* ═════════ BUSCADOR ═════════ */

function PanelBuscador({ T, buscar, setBuscar }: { T: TokenSet; buscar: string; setBuscar: (v: string) => void }) {
  return (
    <div style={{
      backgroundColor: T.card,
      borderRadius: 16,
      padding: 22,
      border: `0.5px solid ${T.brd}`,
    }}>
      <label style={LABEL_STYLE(T)}>Buscar</label>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.mut }} />
        <input
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Proveedor, número, importe…"
          style={{
            width: '100%',
            padding: '10px 14px 10px 34px',
            backgroundColor: T.inp,
            color: T.pri,
            border: `0.5px solid ${T.brd}`,
            borderRadius: 8,
            fontFamily: FONT.body,
            fontSize: 13,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 10, lineHeight: 1.4 }}>
        Filtra por proveedor, número de factura o importe exacto.
      </div>
    </div>
  )
}

/* ═════════ TABLA DENSA (con filas optimistas) ═════════ */

function TablaFacturasDensa({
  T,
  optimistas,
  facturas,
  onClick,
  onDismissOptimista,
  onClickError,
}: {
  T: TokenSet
  optimistas: FilaOptimista[]
  facturas: Factura[]
  onClick: (f: Factura) => void
  onDismissOptimista: (id: string) => void
  onClickError: (o: FilaOptimista) => void
}) {
  const thStyle: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px',
    textTransform: 'uppercase', color: T.mut, padding: '10px 12px',
    textAlign: 'left', background: T.group, borderBottom: `0.5px solid ${T.brd}`,
    fontWeight: 400, whiteSpace: 'nowrap', position: 'sticky', top: 0,
  }
  const tdStyle: CSSProperties = {
    padding: '10px 12px', fontSize: 13, fontFamily: FONT.body, color: T.pri,
    borderBottom: `0.5px solid ${T.brd}`, whiteSpace: 'nowrap',
  }

  if (optimistas.length === 0 && facturas.length === 0) {
    return (
      <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 12, padding: 40, textAlign: 'center', fontFamily: FONT.body, color: T.mut, fontSize: 13 }}>
        Sin facturas para este filtro.
      </div>
    )
  }

  return (
    <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>Fecha</th>
              <th style={thStyle}>Proveedor</th>
              <th style={thStyle}>Nº factura</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Base</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>IVA</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
              <th style={thStyle}>Match</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Titular</th>
            </tr>
          </thead>
          <tbody>
            {/* Filas optimistas (archivos en curso o recientes) */}
            {optimistas.map(o => <FilaOptimistaRow key={o.id} T={T} item={o} tdStyle={tdStyle} onDismiss={onDismissOptimista} onClickError={onClickError} />)}

            {/* Facturas reales */}
            {facturas.map(f => {
              const color = ESTADO_COLOR[f.estado] || T.mut
              const gastos = f.facturas_gastos || []
              const nMatches = gastos.length
              const totalMatch = gastos.reduce((a, g) => a + Math.abs(Number(g.importe_asociado || 0)), 0)
              const matchText = nMatches > 0
                ? `✓ ${nMatches} cargo${nMatches > 1 ? 's' : ''} · ${fmtEur(totalMatch)}`
                : f.estado === 'pendiente_revision' ? 'Sin match'
                : f.estado === 'duplicada' ? 'Duplicada'
                : f.estado === 'error' ? 'Error'
                : '—'
              const matchColor = nMatches > 0 ? '#1D9E75'
                : f.estado === 'pendiente_revision' ? '#BA7517'
                : f.estado === 'error' ? '#A32D2D'
                : T.mut
              return (
                <tr
                  key={f.id}
                  onClick={() => onClick(f)}
                  style={{ cursor: 'pointer', transition: 'background 120ms' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = T.group }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block' }} />
                      <span style={{ fontSize: 12, color: T.sec }}>{ESTADO_NOMBRE[f.estado] || f.estado}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>{fechaCorta(f.fecha_factura)}</td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{truncar(f.proveedor_nombre, 32)}</td>
                  <td style={{ ...tdStyle, fontFamily: 'Consolas, monospace', fontSize: 12, color: T.sec }}>{truncar(f.numero_factura, 18)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: T.sec }}>{fmtEur(f.total_base)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: T.sec }}>{fmtEur(f.total_iva)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmtEur(f.total)}</td>
                  <td style={{ ...tdStyle, fontSize: 12, color: matchColor }}>{matchText}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {f.titular ? (
                      <span
                        title={f.titular.nombre}
                        style={{
                          display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
                          background: f.titular.color, border: `2px solid ${T.card}`,
                        }}
                      />
                    ) : <span style={{ color: T.mut, fontSize: 11 }}>—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ═════════ FILA OPTIMISTA ═════════ */

function FilaOptimistaRow({
  T, item, tdStyle, onDismiss, onClickError,
}: {
  T: TokenSet
  item: FilaOptimista
  tdStyle: CSSProperties
  onDismiss: (id: string) => void
  onClickError: (o: FilaOptimista) => void
}) {
  const color =
    item.estado === 'uploading' ? T.mut
      : item.estado === 'ok' ? '#1D9E75'
      : item.estado === 'duplicada' ? '#7080a8'
      : '#A32D2D'

  const icon =
    item.estado === 'uploading' ? <Spinner color={T.mut} />
      : item.estado === 'ok' ? '✓'
      : item.estado === 'duplicada' ? '🟰'
      : '❌'

  const etiqueta =
    item.estado === 'uploading' ? 'Procesando'
      : item.estado === 'ok' ? 'Nueva'
      : item.estado === 'duplicada' ? 'Duplicada'
      : 'Error'

  const bg = item.estado === 'error'
    ? 'rgba(163,45,45,0.06)'
    : item.estado === 'duplicada'
    ? 'rgba(112,128,168,0.06)'
    : item.estado === 'ok'
    ? 'rgba(29,158,117,0.06)'
    : 'transparent'

  const f = item.factura as any
  const proveedor = f?.proveedor_nombre || item.name
  const numero = f?.numero_factura
  const total = f?.total
  const base = f?.total_base
  const iva = f?.total_iva
  const fecha = f?.fecha_factura

  const isError = item.estado === 'error'

  return (
    <tr
      style={{ background: bg, cursor: isError ? 'pointer' : 'default' }}
      onClick={() => { if (isError) onClickError(item) }}
    >
      <td style={tdStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color,
          }}>{icon}</span>
          <span style={{ fontSize: 12, color: T.sec }}>{etiqueta}</span>
        </div>
      </td>
      <td style={tdStyle}>{fecha ? fechaCorta(fecha) : '—'}</td>
      <td style={{ ...tdStyle, fontWeight: 500, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {truncar(proveedor, 40)}
        {item.mensaje && (
          <div style={{ fontSize: 11, color: T.mut, fontWeight: 400, marginTop: 2, whiteSpace: 'normal' }}>
            {item.mensaje}
          </div>
        )}
      </td>
      <td style={{ ...tdStyle, fontFamily: 'Consolas, monospace', fontSize: 12, color: T.sec }}>
        {numero ? truncar(numero, 18) : '—'}
      </td>
      <td style={{ ...tdStyle, textAlign: 'right', color: T.sec }}>{base != null ? fmtEur(base) : '—'}</td>
      <td style={{ ...tdStyle, textAlign: 'right', color: T.sec }}>{iva != null ? fmtEur(iva) : '—'}</td>
      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{total != null ? fmtEur(total) : '—'}</td>
      <td style={{ ...tdStyle, fontSize: 12, color }}>
        {item.estado === 'uploading' ? 'OCR en curso…'
          : item.estado === 'error' ? 'Ver error'
          : item.estado === 'duplicada' ? 'Ya existía'
          : 'Procesada'}
      </td>
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(item.id) }}
          title="Quitar fila"
          style={{
            background: 'transparent', border: 'none', color: T.mut,
            cursor: 'pointer', padding: 4, display: 'inline-flex', alignItems: 'center',
          }}
        >
          <X size={14} />
        </button>
      </td>
    </tr>
  )
}

/* ═════════ SPINNER ═════════ */

function Spinner({ color }: { color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 12,
        height: 12,
        border: `2px solid ${color}`,
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'facturas-spin 0.8s linear infinite',
      }}
    >
      <style>{`@keyframes facturas-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  )
}

/* ═════════ TABLA FALTANTES ═════════ */

function TablaFaltantes({ T, faltantes }: { T: TokenSet; faltantes: Faltante[] }) {
  if (faltantes.length === 0) {
    return (
      <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 12, padding: 40, textAlign: 'center', fontFamily: FONT.body, color: T.mut, fontSize: 13 }}>
        No hay facturas faltantes.
      </div>
    )
  }
  const thStyle: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px',
    textTransform: 'uppercase', color: T.mut, padding: '10px 12px',
    textAlign: 'left', background: T.group, borderBottom: `0.5px solid ${T.brd}`,
    fontWeight: 400,
  }
  const tdStyle: CSSProperties = {
    padding: '10px 12px', fontSize: 13, fontFamily: FONT.body,
    color: T.pri, borderBottom: `0.5px solid ${T.brd}`,
  }
  return (
    <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Proveedor</th>
            <th style={thStyle}>Frecuencia</th>
            <th style={thStyle}>Período</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Estimado</th>
          </tr>
        </thead>
        <tbody>
          {faltantes.map(f => (
            <tr key={f.id}>
              <td style={tdStyle}>{f.proveedor_nombre}</td>
              <td style={tdStyle}><span style={{ fontSize: 12, color: T.sec }}>{f.frecuencia}</span></td>
              <td style={tdStyle}>{f.periodo_ref}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{f.importe_estimado ? fmtEur(f.importe_estimado) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ═════════ UPLOAD MODAL ═════════ */

function UploadModal({ T, TF, onClose, onSubir, subiendo }: {
  T: TokenSet
  TF: ReturnType<typeof useFacturasTheme>['T']
  onClose: () => void
  onSubir: (files: File[]) => void | Promise<void>
  subiendo: SubidaItem[]
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: TF.base,
          border: `1px solid ${TF.border}`,
          borderRadius: 14,
          width: 'min(560px, 100%)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 22px', borderBottom: `1px solid ${TF.border}`,
        }}>
          <h2 style={{
            fontFamily: FONT.heading, fontSize: 14, color: T.pri, margin: 0,
            letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600,
          }}>
            Subir facturas
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.mut, cursor: 'pointer', padding: 4 }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: 22 }}>
          <DropzoneFacturas
            T={TF}
            onSubir={onSubir}
            subiendo={subiendo}
          />
          <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 12, lineHeight: 1.5 }}>
            Al soltar los archivos, el modal se cierra y verás el progreso en la tabla principal.
            Cada fila se actualiza cuando termina el OCR. Si algo falla, podrás ver el error en la misma fila.
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═════════ ERROR MODAL ═════════ */

function ErrorModal({ T, item, onClose }: { T: TokenSet; item: FilaOptimista; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 950,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.card, border: `1px solid ${T.brd}`, borderRadius: 14,
          width: 'min(600px, 100%)', maxHeight: '80vh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px', borderBottom: `1px solid ${T.brd}`, background: '#A32D2D15',
        }}>
          <div>
            <div style={{ fontFamily: FONT.heading, fontSize: 11, color: '#A32D2D', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>
              Error al subir
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, marginTop: 3 }}>
              {item.name}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.mut, cursor: 'pointer', padding: 4 }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: 20, overflow: 'auto' }}>
          <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, lineHeight: 1.5, fontWeight: 600 }}>
            {item.mensaje || 'Error desconocido'}
          </div>
          {item.httpStatus && (
            <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 4 }}>
              HTTP {item.httpStatus}
            </div>
          )}
          {item.detalle && (
            <pre style={{
              marginTop: 14, padding: 12, background: T.group, borderRadius: 8,
              fontFamily: 'Consolas, monospace', fontSize: 11,
              color: T.sec, maxHeight: 300, overflow: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {item.detalle}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
