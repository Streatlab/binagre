import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Eye,
  RefreshCw,
  Search,
  SearchCheck,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtFechaES } from '@/utils/format'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useTitular } from '@/contexts/TitularContext'
import {
  ESTADO_COLOR,
  ESTADO_NOMBRE,
  useFacturasTheme,
  type FacturasTokens,
} from '@/styles/facturasTheme'
import DropzoneFacturas, { type SubidaItem } from '@/components/facturas/DropzoneFacturas'
import ModalPegarTexto from '@/components/facturas/ModalPegarTexto'
import ModalAsociarManual from '@/components/facturas/ModalAsociarManual'
import ModalDetalleFactura, {
  type FacturaDetalle,
} from '@/components/facturas/ModalDetalleFactura'
import TitularSelector from '@/components/TitularSelector'

/* ═════════ TYPES ═════════ */

type Rango = '7d' | '30d' | 'mes' | 'trimestre' | 'anio' | 'todo'
type Filtro = 'todas' | 'pendientes' | 'asociadas' | 'faltantes' | 'duplicadas' | 'error'

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
  pdf_original_name: string | null
  estado: string
  mensaje_matching: string | null
  ocr_confianza: number | null
  ocr_raw: unknown
  titular_id?: string | null
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

function diasEntre(desde: string): number {
  const d = new Date(desde)
  const hoy = new Date()
  return Math.max(0, Math.floor((hoy.getTime() - d.getTime()) / 86_400_000))
}

/* ═════════ PAGE ═════════ */

export default function FacturasPage() {
  const { T } = useFacturasTheme()
  const isMobile = useIsMobile()
  const { filtro: filtroTitular } = useTitular()

  const [facturas, setFacturas] = useState<Factura[]>([])
  const [faltantes, setFaltantes] = useState<Faltante[]>([])
  const [rango, setRango] = useState<Rango>('30d')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [subiendo, setSubiendo] = useState<SubidaItem[]>([])
  const [detalleFactura, setDetalleFactura] = useState<FacturaDetalle | null>(null)
  const [facturaAsociarManual, setFacturaAsociarManual] = useState<Factura | null>(null)
  const [showPasteModal, setShowPasteModal] = useState(false)

  const cargarDatos = useCallback(async () => {
    const desde = calcDesde(rango)

    let qb = supabase
      .from('facturas')
      .select(
        'id, proveedor_nombre, numero_factura, fecha_factura, es_recapitulativa, periodo_inicio, periodo_fin, tipo, plataforma, total_base, total_iva, total, pdf_drive_url, pdf_original_name, estado, mensaje_matching, ocr_confianza, ocr_raw, titular_id, created_at, facturas_gastos(id, conciliacion_id, importe_asociado, confianza_match, confirmado, cruza_cuentas, conciliacion(id, fecha, importe, concepto, proveedor))',
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
  }, [rango, filtroTitular])

  useEffect(() => {
    cargarDatos()
    const sub = supabase
      .channel('facturas-rediseno')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'facturas' },
        () => cargarDatos(),
      )
      .subscribe()
    return () => {
      sub.unsubscribe()
    }
  }, [cargarDatos])

  const faltan = useMemo(() => faltantes.filter((f) => f.estado === 'falta'), [faltantes])

  const kpis = useMemo(() => {
    const totalPeriodo = facturas.reduce((acc, f) => acc + (Number(f.total) || 0), 0)
    const nTotal = facturas.length
    const nPendientes = facturas.filter((f) => f.estado === 'pendiente_revision').length
    const nAsociadas = facturas.filter((f) => f.estado === 'asociada').length
    const nDuplicadas = facturas.filter((f) => f.estado === 'duplicada').length
    const nError = facturas.filter((f) => f.estado === 'error').length
    return { totalPeriodo, nTotal, nPendientes, nAsociadas, nDuplicadas, nError }
  }, [facturas])

  const facturasFiltradas = useMemo<Factura[] | Faltante[]>(() => {
    if (filtro === 'faltantes') return faltan
    let lista = [...facturas]
    const mapEstado: Record<Exclude<Filtro, 'todas' | 'faltantes'>, string> = {
      pendientes: 'pendiente_revision',
      asociadas: 'asociada',
      duplicadas: 'duplicada',
      error: 'error',
    }
    if (filtro !== 'todas') {
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
  }, [facturas, faltan, filtro, busqueda])

  const FILTROS: Array<{ id: Filtro; label: string; color: string; count: number }> = [
    { id: 'todas', label: 'Todas', color: T.accentRed, count: kpis.nTotal },
    { id: 'pendientes', label: 'Pendientes', color: '#BA7517', count: kpis.nPendientes },
    { id: 'asociadas', label: 'Asociadas', color: '#1D9E75', count: kpis.nAsociadas },
    { id: 'faltantes', label: 'Faltantes', color: '#A32D2D', count: faltan.length },
    { id: 'duplicadas', label: 'Duplicadas', color: T.muted, count: kpis.nDuplicadas },
    { id: 'error', label: 'Error', color: '#A32D2D', count: kpis.nError },
  ]

  const subirArchivos = useCallback(
    async (files: File[]) => {
      if (!files.length) return
      for (const file of files) {
        const id =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`
        setSubiendo((s) => [{ id, name: file.name, estado: 'uploading' }, ...s])
        try {
          const base64 = await fileToBase64(file)
          const r = await fetch('/api/facturas/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nombre: file.name,
              base64,
              mimeType: file.type || null,
            }),
          })
          const data = await r.json().catch(() => ({}))
          setSubiendo((s) =>
            s.map((x) =>
              x.id === id
                ? {
                    ...x,
                    estado:
                      data.estado === 'ok'
                        ? 'ok'
                        : data.estado === 'duplicada'
                          ? 'duplicada'
                          : data.estado === 'error'
                            ? 'error'
                            : data.estado || 'ok',
                    total: data.factura?.total,
                    mensaje: data.error || data.motivo,
                  }
                : x,
            ),
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Error'
          setSubiendo((s) => s.map((x) => (x.id === id ? { ...x, estado: 'error', mensaje: msg } : x)))
        }
        setTimeout(() => {
          setSubiendo((s) => s.filter((x) => x.id !== id))
        }, 6000)
      }
      cargarDatos()
    },
    [cargarDatos],
  )

  const procesarTextoPegado = useCallback(
    async (texto: string) => {
      if (!texto.trim()) return
      const nombre = `texto_pegado_${Date.now()}.txt`
      const blob = new Blob([texto], { type: 'text/plain' })
      const file = new File([blob], nombre, { type: 'text/plain' })
      setShowPasteModal(false)
      await subirArchivos([file])
    },
    [subirArchivos],
  )

  async function accion(f: Factura, tipo: 'confirmar' | 'rechazar' | 'reintentar') {
    try {
      await fetch(`/api/facturas/${f.id}/${tipo}`, { method: 'POST' })
    } catch {
      if (tipo === 'confirmar') {
        await supabase.from('facturas_gastos').update({ confirmado: true }).eq('factura_id', f.id)
        await supabase.from('facturas').update({ estado: 'asociada' }).eq('id', f.id)
      } else if (tipo === 'rechazar') {
        await supabase.from('facturas_gastos').delete().eq('factura_id', f.id)
        await supabase
          .from('facturas')
          .update({ estado: 'error', mensaje_matching: 'Descartada manualmente' })
          .eq('id', f.id)
      } else {
        await supabase
          .from('facturas')
          .update({ estado: 'procesando', error_mensaje: null })
          .eq('id', f.id)
      }
    }
    cargarDatos()
  }

  return (
    <div
      style={{
        padding: 24,
        background: T.base,
        minHeight: '100vh',
        fontFamily: T.fontUi,
        color: T.text,
      }}
    >
      <HeaderFacturas T={T} rango={rango} setRango={setRango} />

      <FilaKpis
        T={T}
        kpis={kpis}
        faltantes={faltan.length}
        isMobile={isMobile}
        setFiltro={setFiltro}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '320px 1fr',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <DropzoneFacturas
          T={T}
          onSubir={subirArchivos}
          onPasteClick={() => setShowPasteModal(true)}
          subiendo={subiendo}
        />

        <FiltrosBarra
          T={T}
          busqueda={busqueda}
          setBusqueda={setBusqueda}
          filtro={filtro}
          setFiltro={setFiltro}
          filtros={FILTROS}
        />
      </div>

      {filtro === 'faltantes' ? (
        <TablaFaltantes T={T} faltantes={faltan} />
      ) : (
        <TablaFacturas
          T={T}
          facturas={facturasFiltradas as Factura[]}
          onVer={(f) => setDetalleFactura(f as unknown as FacturaDetalle)}
          onAsociarManual={(f) => setFacturaAsociarManual(f)}
          onAccion={accion}
        />
      )}

      {detalleFactura && (
        <ModalDetalleFactura
          T={T}
          factura={detalleFactura}
          onClose={() => setDetalleFactura(null)}
          onUpdate={() => {
            cargarDatos()
            setDetalleFactura(null)
          }}
        />
      )}
      {showPasteModal && (
        <ModalPegarTexto
          T={T}
          onClose={() => setShowPasteModal(false)}
          onSubmit={procesarTextoPegado}
        />
      )}
      {facturaAsociarManual && (
        <ModalAsociarManual
          T={T}
          factura={facturaAsociarManual}
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

/* ═════════ SUBCOMPONENTES ═════════ */

function HeaderFacturas({
  T,
  rango,
  setRango,
}: {
  T: FacturasTokens
  rango: Rango
  setRango: (r: Rango) => void
}) {
  const labels: Record<Rango, string> = {
    '7d': 'Últimos 7 días',
    '30d': 'Últimos 30 días',
    mes: 'Este mes',
    trimestre: 'Este trimestre',
    anio: 'Este año',
    todo: 'Todo el histórico',
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <h1
          style={{
            color: T.accentRed,
            fontFamily: T.fontTitle,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 3,
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          IMPORTAR FACTURAS
        </h1>
        <TitularSelector />
      </div>
      <select
        value={rango}
        onChange={(e) => setRango(e.target.value as Rango)}
        style={{
          padding: '8px 14px',
          border: `1px solid ${T.border}`,
          borderRadius: 8,
          backgroundColor: T.card,
          color: T.text,
          fontFamily: T.fontUi,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        {(Object.keys(labels) as Rango[]).map((k) => (
          <option key={k} value={k}>
            {labels[k]}
          </option>
        ))}
      </select>
    </div>
  )
}

function FilaKpis({
  T,
  kpis,
  faltantes,
  isMobile,
  setFiltro,
}: {
  T: FacturasTokens
  kpis: {
    totalPeriodo: number
    nTotal: number
    nPendientes: number
    nDuplicadas: number
  }
  faltantes: number
  isMobile: boolean
  setFiltro: (f: Filtro) => void
}) {
  const cards: Array<{
    label: string
    valor: string
    sub: string
    color: string
    onClick?: () => void
  }> = [
    {
      label: 'TOTAL PERIODO',
      valor: fmtEur(kpis.totalPeriodo),
      sub: `${kpis.nTotal} facturas`,
      color: T.accent,
    },
    {
      label: 'PENDIENTES',
      valor: String(kpis.nPendientes),
      sub: 'por asociar',
      color: '#BA7517',
      onClick: () => setFiltro('pendientes'),
    },
    {
      label: 'FALTANTES',
      valor: String(faltantes),
      sub: 'del periodo',
      color: '#A32D2D',
      onClick: () => setFiltro('faltantes'),
    },
    {
      label: 'DUPLICADAS',
      valor: String(kpis.nDuplicadas),
      sub: 'ignoradas',
      color: T.muted,
      onClick: () => setFiltro('duplicadas'),
    },
  ]
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: 16,
      }}
    >
      {cards.map((c, i) => (
        <div
          key={i}
          onClick={c.onClick}
          style={{
            backgroundColor: T.card,
            borderRadius: 12,
            padding: '14px 18px',
            border: `1px solid ${T.border}`,
            borderTop: `3px solid ${c.color}`,
            cursor: c.onClick ? 'pointer' : 'default',
          }}
        >
          <div
            style={{
              fontFamily: T.fontTitle,
              fontSize: 10,
              color: T.muted,
              letterSpacing: 1.3,
              textTransform: 'uppercase',
              marginBottom: 6,
              fontWeight: 600,
            }}
          >
            {c.label}
          </div>
          <div
            style={{
              fontFamily: T.fontTitle,
              fontSize: 24,
              fontWeight: 600,
              color: T.text,
              lineHeight: 1,
            }}
          >
            {c.valor}
          </div>
          <div
            style={{
              fontFamily: T.fontUi,
              fontSize: 11,
              color: T.muted,
              marginTop: 4,
            }}
          >
            {c.sub}
          </div>
        </div>
      ))}
    </div>
  )
}

function FiltrosBarra({
  T,
  busqueda,
  setBusqueda,
  filtro,
  setFiltro,
  filtros,
}: {
  T: FacturasTokens
  busqueda: string
  setBusqueda: (v: string) => void
  filtro: Filtro
  setFiltro: (f: Filtro) => void
  filtros: Array<{ id: Filtro; label: string; color: string; count: number }>
}) {
  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: T.muted,
          }}
        />
        <input
          type="text"
          placeholder="Buscar proveedor, número, importe..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px 10px 36px',
            backgroundColor: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            color: T.text,
            fontFamily: T.fontUi,
            fontSize: 13,
            boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {filtros.map((f) => {
          const active = filtro === f.id
          return (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              style={{
                padding: '8px 14px',
                border: `1px solid ${active ? f.color : T.border}`,
                borderRadius: 20,
                backgroundColor: active ? f.color : 'transparent',
                color: active ? '#fff' : T.text,
                fontFamily: T.fontTitle,
                fontSize: 11,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
              }}
            >
              {f.label}
              {f.count > 0 && (
                <span
                  style={{
                    backgroundColor: active ? 'rgba(255,255,255,0.2)' : T.base,
                    padding: '1px 7px',
                    borderRadius: 10,
                    fontSize: 10,
                  }}
                >
                  {f.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ═════════ TABLA ═════════ */

function TablaFacturas({
  T,
  facturas,
  onVer,
  onAsociarManual,
  onAccion,
}: {
  T: FacturasTokens
  facturas: Factura[]
  onVer: (f: Factura) => void
  onAsociarManual: (f: Factura) => void
  onAccion: (f: Factura, tipo: 'confirmar' | 'rechazar' | 'reintentar') => void
}) {
  if (facturas.length === 0) {
    return (
      <div
        style={{
          backgroundColor: T.card,
          borderRadius: 12,
          padding: 60,
          textAlign: 'center',
          border: `1px solid ${T.border}`,
        }}
      >
        <div style={{ fontFamily: T.fontUi, fontSize: 14, color: T.muted }}>
          No hay facturas con estos filtros
        </div>
      </div>
    )
  }
  return (
    <div
      style={{
        backgroundColor: T.card,
        borderRadius: 12,
        border: `1px solid ${T.border}`,
        overflow: 'hidden',
      }}
    >
      {facturas.map((f, i) => (
        <FilaFactura
          key={f.id}
          factura={f}
          esUltima={i === facturas.length - 1}
          T={T}
          onVer={() => onVer(f)}
          onAsociarManual={() => onAsociarManual(f)}
          onAccion={(tipo) => onAccion(f, tipo)}
        />
      ))}
    </div>
  )
}

function FilaFactura({
  factura,
  esUltima,
  T,
  onVer,
  onAsociarManual,
  onAccion,
}: {
  factura: Factura
  esUltima: boolean
  T: FacturasTokens
  onVer: () => void
  onAsociarManual: () => void
  onAccion: (tipo: 'confirmar' | 'rechazar' | 'reintentar') => void
}) {
  const color = ESTADO_COLOR[factura.estado] || T.muted
  const nombre = ESTADO_NOMBRE[factura.estado] || factura.estado
  return (
    <div
      style={{
        padding: '14px 18px',
        borderBottom: esUltima ? 'none' : `1px solid ${T.border}`,
        display: 'grid',
        gridTemplateColumns: '110px 1fr auto auto',
        gap: 16,
        alignItems: 'center',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: 12,
          backgroundColor: `${color}22`,
          color,
          fontFamily: T.fontTitle,
          fontSize: 10,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          fontWeight: 700,
          textAlign: 'center',
          width: 'fit-content',
        }}
      >
        {nombre}
      </span>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: T.fontTitle,
            fontSize: 15,
            color: T.text,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {factura.proveedor_nombre}
        </div>
        <div style={{ fontFamily: T.fontUi, fontSize: 11, color: T.muted, marginTop: 2 }}>
          {fmtFechaES(factura.fecha_factura)}
          {factura.es_recapitulativa && factura.periodo_inicio && factura.periodo_fin && (
            <>
              {' '}
              · Recapitulativa {fmtFechaES(factura.periodo_inicio)} →{' '}
              {fmtFechaES(factura.periodo_fin)}
            </>
          )}
          {factura.numero_factura && (
            <>
              {' '}
              · Nº {factura.numero_factura}
            </>
          )}
        </div>
        <RazonMatch factura={factura} T={T} />
      </div>

      <div style={{ textAlign: 'right' }}>
        <div
          style={{
            fontFamily: T.fontTitle,
            fontSize: 18,
            color: T.text,
            fontWeight: 600,
          }}
        >
          {fmtEur(factura.total)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <BotonIcono T={T} icon={Eye} onClick={onVer} tooltip="Ver detalle" />
        <AccionesContextuales
          factura={factura}
          T={T}
          onAsociarManual={onAsociarManual}
          onAccion={onAccion}
        />
      </div>
    </div>
  )
}

function BotonIcono({
  T,
  icon: Icon,
  onClick,
  tooltip,
  color,
}: {
  T: FacturasTokens
  icon: React.ComponentType<{ size?: number; color?: string }>
  onClick: () => void
  tooltip: string
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      style={{
        width: 32,
        height: 32,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        backgroundColor: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: color || T.text,
      }}
    >
      <Icon size={14} color={color || T.text} />
    </button>
  )
}

function AccionesContextuales({
  factura,
  T,
  onAsociarManual,
  onAccion,
}: {
  factura: Factura
  T: FacturasTokens
  onAsociarManual: () => void
  onAccion: (tipo: 'confirmar' | 'rechazar' | 'reintentar') => void
}) {
  const matches = factura.facturas_gastos || []

  if (factura.estado === 'asociada') {
    return (
      <>
        <BotonIcono
          T={T}
          icon={Check}
          onClick={() => onAccion('confirmar')}
          tooltip="Confirmar"
          color="#1D9E75"
        />
        <BotonIcono
          T={T}
          icon={X}
          onClick={() => onAccion('rechazar')}
          tooltip="Rechazar"
          color="#A32D2D"
        />
      </>
    )
  }

  if (factura.estado === 'pendiente_revision') {
    return (
      <>
        {matches.length > 0 && (
          <BotonIcono
            T={T}
            icon={Check}
            onClick={() => onAccion('confirmar')}
            tooltip="Aceptar match sugerido"
            color="#1D9E75"
          />
        )}
        <BotonIcono
          T={T}
          icon={SearchCheck}
          onClick={onAsociarManual}
          tooltip="Buscar manual en banco"
        />
        <BotonIcono
          T={T}
          icon={X}
          onClick={() => onAccion('rechazar')}
          tooltip="Descartar"
          color="#A32D2D"
        />
      </>
    )
  }

  if (factura.estado === 'error') {
    return (
      <>
        <BotonIcono
          T={T}
          icon={RefreshCw}
          onClick={() => onAccion('reintentar')}
          tooltip="Reintentar OCR"
        />
        <BotonIcono
          T={T}
          icon={X}
          onClick={() => onAccion('rechazar')}
          tooltip="Descartar"
          color="#A32D2D"
        />
      </>
    )
  }

  return null
}

/* ═════════ RAZÓN MATCH ═════════ */

function BadgeCruzaCuentas() {
  return (
    <span
      style={{
        fontSize: 10,
        padding: '2px 6px',
        borderRadius: 4,
        backgroundColor: '#BA751722',
        color: '#BA7517',
        marginLeft: 8,
        letterSpacing: 0.5,
        fontWeight: 600,
      }}
    >
      ⇄ CUENTA CRUZADA
    </span>
  )
}

function RazonMatch({ factura, T }: { factura: Factura; T: FacturasTokens }) {
  const matches = factura.facturas_gastos || []
  const mensaje = factura.mensaje_matching
  const cruza = matches.some((m) => m.cruza_cuentas)

  if (factura.estado === 'asociada' && matches.length === 1 && matches[0].conciliacion) {
    const g = matches[0].conciliacion
    const conf = matches[0].confianza_match
    return (
      <div style={{ fontFamily: T.fontUi, fontSize: 12, color: '#1D9E75', marginTop: 6 }}>
        ✅ Coincide con gasto del <b>{fmtFechaES(g.fecha)}</b> por{' '}
        <b>{fmtEur(Math.abs(Number(g.importe)))}</b>
        {conf != null && (
          <span style={{ color: T.muted, marginLeft: 8 }}>({Math.round(conf)}% confianza)</span>
        )}
        {cruza && <BadgeCruzaCuentas />}
      </div>
    )
  }

  if (factura.estado === 'asociada' && matches.length > 1) {
    const suma = matches.reduce(
      (a, m) => a + Math.abs(Number(m.conciliacion?.importe ?? m.importe_asociado)),
      0,
    )
    return (
      <div style={{ fontFamily: T.fontUi, fontSize: 12, color: '#1D9E75', marginTop: 6 }}>
        ✅ Recapitulativa: <b>{matches.length} cargos</b> suman <b>{fmtEur(suma)}</b>
        {cruza && <BadgeCruzaCuentas />}
      </div>
    )
  }

  if (factura.estado === 'pendiente_revision') {
    return (
      <div style={{ fontFamily: T.fontUi, fontSize: 12, color: '#BA7517', marginTop: 6 }}>
        ⚠️ {mensaje || 'Sin gastos asociados automáticamente'}
      </div>
    )
  }

  if (factura.tipo === 'plataforma') {
    return (
      <div style={{ fontFamily: T.fontUi, fontSize: 12, color: T.muted, marginTop: 6 }}>
        📱 Liquidación {factura.plataforma}. Se asocia a ingresos, no gastos.
      </div>
    )
  }

  if (factura.estado === 'error' && factura.mensaje_matching) {
    return (
      <div style={{ fontFamily: T.fontUi, fontSize: 12, color: '#A32D2D', marginTop: 6 }}>
        ❌ {factura.mensaje_matching}
      </div>
    )
  }

  return null
}

/* ═════════ FALTANTES ═════════ */

function TablaFaltantes({ T, faltantes }: { T: FacturasTokens; faltantes: Faltante[] }) {
  if (faltantes.length === 0) {
    return (
      <div
        style={{
          backgroundColor: T.card,
          borderRadius: 12,
          padding: 60,
          textAlign: 'center',
          border: `1px solid ${T.border}`,
        }}
      >
        <div style={{ fontFamily: T.fontUi, fontSize: 14, color: T.muted }}>
          ✅ No hay facturas faltantes
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {faltantes.map((f) => (
        <div
          key={f.id}
          style={{
            backgroundColor: T.card,
            border: `1px solid ${T.border}`,
            borderLeft: `4px solid #A32D2D`,
            borderRadius: 10,
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: T.fontTitle,
                fontSize: 14,
                color: T.text,
                fontWeight: 600,
              }}
            >
              {f.proveedor_nombre} · {f.frecuencia}
            </div>
            <div
              style={{
                fontFamily: T.fontUi,
                fontSize: 11,
                color: T.muted,
                marginTop: 3,
              }}
            >
              Esperada hace {diasEntre(f.periodo_ref)} días ({fmtFechaES(f.periodo_ref)})
              {f.importe_estimado ? ` · ~${fmtEur(f.importe_estimado)}` : ''}
            </div>
          </div>
          <button
            style={{
              padding: '8px 14px',
              backgroundColor: T.accentRed,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontFamily: T.fontTitle,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              cursor: 'pointer',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            Subir ahora
          </button>
        </div>
      ))}
    </div>
  )
}
