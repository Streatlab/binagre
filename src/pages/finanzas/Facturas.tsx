import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { useTitular } from '@/contexts/TitularContext'
import {
  useTheme,
  FONT,
  tabActiveStyle,
  tabInactiveStyle,
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
type Tab = 'resumen' | 'subir'
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

/* ═════════ HELPERS ═════════ */

function calcDesde(rango: Rango): string | null {
  const hoy = new Date()
  const d = new Date(hoy)
  switch (rango) {
    case '7d':
      d.setDate(d.getDate() - 7)
      return d.toISOString().slice(0, 10)
    case '30d':
      d.setDate(d.getDate() - 30)
      return d.toISOString().slice(0, 10)
    case 'mes':
      return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
    case 'trimestre': {
      const tri = Math.floor(hoy.getMonth() / 3) * 3
      return new Date(hoy.getFullYear(), tri, 1).toISOString().slice(0, 10)
    }
    case 'anio':
      return new Date(hoy.getFullYear(), 0, 1).toISOString().slice(0, 10)
    case 'todo':
    default:
      return null
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

/* ═════════ PAGE ═════════ */

export default function FacturasPage() {
  const { T, isDark } = useTheme()
  const { T: TF } = useFacturasTheme()
  const { filtro: filtroTitular } = useTitular()

  const [facturas, setFacturas] = useState<Factura[]>([])
  const [faltantes, setFaltantes] = useState<Faltante[]>([])
  const [rango, setRango] = useState<Rango>('30d')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [tab, setTab] = useState<Tab>('resumen')
  const [busqueda, setBusqueda] = useState('')
  const [subiendo, setSubiendo] = useState<SubidaItem[]>([])
  const [detalleFactura, setDetalleFactura] = useState<FacturaDetalle | null>(null)
  const [facturaAsociarManual, setFacturaAsociarManual] = useState<Factura | null>(null)
  const [loading, setLoading] = useState(true)

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
      .channel('facturas-rediseno-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facturas' }, () => cargarDatos())
      .subscribe()
    return () => { sub.unsubscribe() }
  }, [cargarDatos])

  const faltan = useMemo(() => faltantes.filter((f) => f.estado === 'falta'), [faltantes])

  const kpis = useMemo(() => {
    const totalPeriodo = facturas.reduce((acc, f) => acc + (Number(f.total) || 0), 0)
    return {
      totalPeriodo,
      nTotal: facturas.length,
      nPendientes: facturas.filter((f) => f.estado === 'pendiente_revision').length,
      nAsociadas: facturas.filter((f) => f.estado === 'asociada').length,
      nDuplicadas: facturas.filter((f) => f.estado === 'duplicada').length,
      nError: facturas.filter((f) => f.estado === 'error').length,
      nSinTitular: facturas.filter((f) => !f.titular_id).length,
    }
  }, [facturas])

  const facturasFiltradas = useMemo<Factura[]>(() => {
    if (filtro === 'faltantes') return []
    let lista = [...facturas]
    if (filtro === 'sin_titular') {
      lista = lista.filter((f) => !f.titular_id)
    } else if (filtro !== 'todas') {
      const mapEstado: Record<Exclude<Filtro, 'todas' | 'faltantes' | 'sin_titular'>, string> = {
        pendientes: 'pendiente_revision',
        asociadas: 'asociada',
        duplicadas: 'duplicada',
        error: 'error',
      }
      lista = lista.filter((f) => f.estado === mapEstado[filtro])
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim()
      lista = lista.filter(
        (f) =>
          (f.proveedor_nombre || '').toLowerCase().includes(q) ||
          (f.numero_factura || '').toLowerCase().includes(q) ||
          String(f.total || '').includes(q),
      )
    }
    return lista
  }, [facturas, filtro, busqueda])

  /* — Upload — */

  const subirArchivos = useCallback(async (files: File[]) => {
    if (!files.length) return
    for (const file of files) {
      const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`
      setSubiendo((s) => [{ id, name: file.name, estado: 'uploading' }, ...s])
      try {
        const base64 = await fileToBase64(file)
        const r = await fetch('/api/facturas/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: file.name, base64, mimeType: file.type || null }),
        })
        const data = await r.json().catch(() => ({}))
        setSubiendo((s) => s.map((x) => x.id === id ? {
          ...x,
          estado: data.estado === 'ok' ? 'ok'
            : data.estado === 'duplicada' ? 'duplicada'
            : data.estado === 'error' ? 'error'
            : data.estado || 'ok',
          total: data.factura?.total,
          mensaje: data.error || data.motivo,
        } : x))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error'
        setSubiendo((s) => s.map((x) => (x.id === id ? { ...x, estado: 'error', mensaje: msg } : x)))
      }
      setTimeout(() => { setSubiendo((s) => s.filter((x) => x.id !== id)) }, 6000)
    }
    cargarDatos()
  }, [cargarDatos])

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

  const selectStyle: CSSProperties = {
    padding: '8px 14px',
    border: `0.5px solid ${T.brd}`,
    borderRadius: 8,
    backgroundColor: T.inp,
    color: T.pri,
    fontFamily: FONT.body,
    fontSize: 13,
    cursor: 'pointer',
    outline: 'none',
  }

  return (
    <div style={{ background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 28px' }}>

      {/* HEADER — título + desplegable filtro + toggle titular + rango */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={pageTitleStyle(T)}>Importar Facturas</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} style={selectStyle}>
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
          <select value={rango} onChange={(e) => setRango(e.target.value as Rango)} style={selectStyle}>
            {(Object.keys(labelRango) as Rango[]).map((k) => (
              <option key={k} value={k}>{labelRango[k]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 4, background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, padding: 4, width: 'fit-content', marginBottom: 18 }}>
        {(['resumen', 'subir'] as Tab[]).map(k => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={tab === k ? tabActiveStyle(isDark) : tabInactiveStyle(T)}
          >
            {k === 'resumen' ? 'Resumen' : 'Subir'}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ padding: 40, color: T.mut, fontFamily: FONT.body, textAlign: 'center' }}>Cargando…</div>
      )}

      {!loading && tab === 'resumen' && (
        <>
          <ResumenFacturasKpis T={T} kpis={kpis} faltantes={faltan.length} />
          <div style={{ height: 16 }} />
          {filtro === 'faltantes' ? (
            <TablaFaltantes T={T} faltantes={faltan} />
          ) : (
            <>
              <BuscadorBar T={T} busqueda={busqueda} setBusqueda={setBusqueda} total={facturasFiltradas.length} />
              <TablaFacturasDensa
                T={T}
                facturas={facturasFiltradas}
                onClick={(f) => setDetalleFactura(f as unknown as FacturaDetalle)}
              />
            </>
          )}
        </>
      )}

      {!loading && tab === 'subir' && (
        <DropzoneFacturas
          T={TF}
          onSubir={subirArchivos}
          subiendo={subiendo}
        />
      )}

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
    </div>
  )
}

/* ═════════ RESUMEN · KPIs ═════════ */

function ResumenFacturasKpis({ T, kpis, faltantes }: { T: TokenSet; kpis: { totalPeriodo: number; nTotal: number; nPendientes: number; nAsociadas: number; nDuplicadas: number; nError: number; nSinTitular: number }; faltantes: number }) {
  const items: { label: string; value: string; color: string; sub?: string }[] = [
    { label: 'Total periodo', value: fmtEur(kpis.totalPeriodo), color: '#FF4757', sub: `${kpis.nTotal} facturas` },
    { label: 'Pendientes', value: String(kpis.nPendientes), color: '#BA7517', sub: 'por asociar' },
    { label: 'Faltantes', value: String(faltantes), color: '#A32D2D', sub: 'del periodo' },
    { label: 'Asociadas', value: String(kpis.nAsociadas), color: '#1D9E75' },
    { label: 'Duplicadas', value: String(kpis.nDuplicadas), color: T.mut },
    { label: 'Sin titular', value: String(kpis.nSinTitular), color: T.mut },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
      {items.map((k, i) => (
        <div key={i} style={{
          background: T.card,
          border: `0.5px solid ${T.brd}`,
          borderTop: `3px solid ${k.color}`,
          borderRadius: 12,
          padding: '14px 18px',
        }}>
          <div style={{
            fontFamily: FONT.heading,
            fontSize: 10,
            color: T.mut,
            letterSpacing: '1.3px',
            textTransform: 'uppercase',
            marginBottom: 6,
            fontWeight: 600,
          }}>{k.label}</div>
          <div style={{
            fontFamily: FONT.heading,
            fontSize: 22,
            fontWeight: 600,
            color: T.pri,
            lineHeight: 1,
          }}>{k.value}</div>
          {k.sub && (
            <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 4 }}>{k.sub}</div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ═════════ BUSCADOR ═════════ */

function BuscadorBar({ T, busqueda, setBusqueda, total }: { T: TokenSet; busqueda: string; setBusqueda: (v: string) => void; total: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 420 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.mut }} />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar proveedor, nº factura, importe…"
          style={{
            width: '100%',
            padding: '8px 12px 8px 34px',
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
      <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>{total} resultado{total === 1 ? '' : 's'}</span>
    </div>
  )
}

/* ═════════ TABLA DENSA ═════════ */

function TablaFacturasDensa({ T, facturas, onClick }: { T: TokenSet; facturas: Factura[]; onClick: (f: Factura) => void }) {
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
    position: 'sticky',
    top: 0,
  }
  const tdStyle: CSSProperties = {
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: FONT.body,
    color: T.pri,
    borderBottom: `0.5px solid ${T.brd}`,
    whiteSpace: 'nowrap',
  }

  if (facturas.length === 0) {
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
            {facturas.map((f) => {
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
                  <td style={{ ...tdStyle, fontFamily: 'Consolas, monospace', fontSize: 12, color: T.sec }}>{truncar(f.numero_factura, 20)}</td>
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
                          background: f.titular.color, border: `0.5px solid ${T.brd}`,
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
  }
  const tdStyle: CSSProperties = {
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: FONT.body,
    color: T.pri,
    borderBottom: `0.5px solid ${T.brd}`,
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
          {faltantes.map((f) => (
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
