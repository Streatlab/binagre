import { useState, useEffect, useCallback, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { useTheme, FONT, pageTitleStyle, cardStyle, groupStyle } from '@/styles/tokens'

type EstadoFactura = 'procesando' | 'pendiente_revision' | 'asociada' | 'historica' | 'error'

interface Factura {
  id: string
  proveedor_id: string | null
  proveedor_nombre: string
  numero_factura: string
  fecha_factura: string
  es_recapitulativa: boolean
  periodo_inicio: string | null
  periodo_fin: string | null
  tipo: 'proveedor' | 'plataforma' | 'otro'
  plataforma: string | null
  base_4: number
  iva_4: number
  base_10: number
  iva_10: number
  base_21: number
  iva_21: number
  total_base: number
  total_iva: number
  total: number
  pdf_original_name: string | null
  pdf_drive_url: string | null
  pdf_hash: string | null
  estado: EstadoFactura
  error_mensaje: string | null
  ocr_confianza: number | null
  mensaje_matching: string | null
  created_at: string
}

interface FacturaFaltante {
  id: string
  proveedor_nombre: string
  frecuencia: string
  periodo_ref: string
  importe_estimado: number | null
  tolerancia_dias: number
  estado: 'ok' | 'falta' | 'en_plazo'
}

type UploadItem = {
  name: string
  status: 'pending' | 'uploading' | 'ok' | 'duplicada' | 'error'
  factura?: Factura
  mensaje?: string
}

type Tab = 'subir' | 'pendientes' | 'historico' | 'faltantes'

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

export default function Facturas() {
  const { T, isDark } = useTheme()
  const [tab, setTab] = useState<Tab>('subir')
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [faltantes, setFaltantes] = useState<FacturaFaltante[]>([])
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [loading, setLoading] = useState(false)

  const cargarFacturas = useCallback(async () => {
    const { data } = await supabase
      .from('facturas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)
    if (data) setFacturas(data as Factura[])
  }, [])

  const cargarFaltantes = useCallback(async () => {
    const { data } = await supabase.from('facturas_faltantes').select('*')
    if (data) setFaltantes(data as FacturaFaltante[])
  }, [])

  useEffect(() => {
    cargarFacturas()
    cargarFaltantes()
    const sub = supabase
      .channel('facturas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facturas' }, () => {
        cargarFacturas()
      })
      .subscribe()
    return () => {
      sub.unsubscribe()
    }
  }, [cargarFacturas, cargarFaltantes])

  const faltantesCount = useMemo(
    () => faltantes.filter((f) => f.estado === 'falta').length,
    [faltantes],
  )

  const pendientes = useMemo(
    () => facturas.filter((f) => f.estado === 'pendiente_revision'),
    [facturas],
  )

  const subirArchivo = useCallback(async (file: File) => {
    setUploads((prev) => {
      const copy = [...prev]
      const idx = copy.findIndex((u) => u.name === file.name && u.status === 'pending')
      if (idx >= 0) copy[idx] = { ...copy[idx], status: 'uploading' }
      return copy
    })
    try {
      const base64 = await fileToBase64(file)
      const resp = await fetch('/api/facturas/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: file.name, base64, mimeType: file.type || null }),
      })
      const json = await resp.json()
      setUploads((prev) => {
        const copy = [...prev]
        const idx = copy.findIndex((u) => u.name === file.name && u.status === 'uploading')
        if (idx < 0) return copy
        if (json.estado === 'duplicada') {
          copy[idx] = {
            ...copy[idx],
            status: 'duplicada',
            mensaje: `Ya existía: ${json.factura_existente?.proveedor_nombre || '—'}`,
          }
        } else if (json.estado === 'ok') {
          copy[idx] = { ...copy[idx], status: 'ok', factura: json.factura }
        } else if (json.estado === 'multi') {
          const oks = (json.resultados || []).filter(
            (r: { estado: string }) => r.estado === 'ok',
          ).length
          copy[idx] = {
            ...copy[idx],
            status: 'ok',
            mensaje: `${oks}/${json.resultados.length} procesadas (email + adjuntos)`,
          }
        } else if (json.estado === 'error') {
          copy[idx] = { ...copy[idx], status: 'error', mensaje: json.error }
        } else {
          copy[idx] = { ...copy[idx], status: 'error', mensaje: json.error || 'Error' }
        }
        return copy
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error'
      setUploads((prev) => {
        const copy = [...prev]
        const idx = copy.findIndex((u) => u.name === file.name && u.status === 'uploading')
        if (idx >= 0) copy[idx] = { ...copy[idx], status: 'error', mensaje: msg }
        return copy
      })
    }
  }, [])

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length) return
      const initial: UploadItem[] = accepted.map((f) => ({ name: f.name, status: 'pending' }))
      setUploads((prev) => [...initial, ...prev])
      setLoading(true)
      for (const file of accepted) {
        await subirArchivo(file)
      }
      setLoading(false)
      cargarFacturas()
    },
    [cargarFacturas, subirArchivo],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
      'image/heic': ['.heic'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'message/rfc822': ['.eml'],
      'application/vnd.ms-outlook': ['.msg'],
    },
    maxFiles: 20,
  })

  const procesarTextoPegado = useCallback(
    async (texto: string) => {
      if (!texto.trim()) return
      const nombre = `texto_pegado_${Date.now()}.txt`
      const blob = new Blob([texto], { type: 'text/plain' })
      const file = new File([blob], nombre, { type: 'text/plain' })
      setUploads((prev) => [{ name: nombre, status: 'pending' }, ...prev])
      setLoading(true)
      await subirArchivo(file)
      setLoading(false)
      cargarFacturas()
    },
    [cargarFacturas, subirArchivo],
  )

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'subir', label: 'Subir' },
    { key: 'pendientes', label: 'Pendientes', badge: pendientes.length },
    { key: 'historico', label: 'Histórico' },
    { key: 'faltantes', label: 'Faltantes', badge: faltantesCount },
  ]

  return (
    <div style={{ padding: 24, background: T.bg, minHeight: '100vh', fontFamily: FONT.body, color: T.pri }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={pageTitleStyle(T)}>FACTURAS</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${T.brd}`, marginBottom: 20 }}>
        {tabs.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '10px 18px',
                background: active ? T.card : 'transparent',
                border: 'none',
                borderBottom: active ? `2px solid #B01D23` : '2px solid transparent',
                color: active ? T.pri : T.sec,
                fontFamily: FONT.heading,
                fontSize: 13,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontWeight: active ? 600 : 400,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {t.label}
              {typeof t.badge === 'number' && t.badge > 0 && (
                <span
                  style={{
                    background: t.key === 'faltantes' ? '#B01D23' : '#e8f442',
                    color: t.key === 'faltantes' ? '#ffffff' : '#111111',
                    borderRadius: 10,
                    padding: '1px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {t.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'subir' && (
        <TabSubir
          getRootProps={getRootProps}
          getInputProps={getInputProps}
          isDragActive={isDragActive}
          uploads={uploads}
          loading={loading}
          T={T}
          isDark={isDark}
          onPegarTexto={procesarTextoPegado}
        />
      )}

      {tab === 'pendientes' && <TabPendientes facturas={pendientes} T={T} onRefresh={cargarFacturas} />}

      {tab === 'historico' && <TabHistorico facturas={facturas} T={T} />}

      {tab === 'faltantes' && <TabFaltantes faltantes={faltantes} T={T} />}
    </div>
  )
}

/* ───────── TAB: Subir ───────── */

function TabSubir({
  getRootProps,
  getInputProps,
  isDragActive,
  uploads,
  loading,
  T,
  isDark,
  onPegarTexto,
}: {
  getRootProps: () => Record<string, unknown>
  getInputProps: () => Record<string, unknown>
  isDragActive: boolean
  uploads: UploadItem[]
  loading: boolean
  T: ReturnType<typeof useTheme>['T']
  isDark: boolean
  onPegarTexto: (texto: string) => Promise<void>
}) {
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [textoPegado, setTextoPegado] = useState('')

  return (
    <div>
      <div
        {...getRootProps()}
        style={{
          border: `2px dashed ${isDragActive ? '#e8f442' : T.brd}`,
          borderRadius: 12,
          padding: '60px 20px',
          textAlign: 'center',
          background: isDark ? '#141414' : '#fafafa',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <input {...getInputProps()} />
        <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
        <div
          style={{
            fontFamily: FONT.heading,
            fontSize: 16,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: T.pri,
            marginBottom: 8,
          }}
        >
          {isDragActive ? 'SUELTA LOS ARCHIVOS' : 'ARRASTRA TUS FACTURAS AQUÍ'}
        </div>
        <div style={{ color: T.sec, fontSize: 13 }}>
          PDF · Imagen (JPG/PNG/WEBP/HEIC) · Word · Excel · Email (EML/MSG)
        </div>
        <div style={{ color: T.mut, fontSize: 12, marginTop: 8 }}>
          o haz click para seleccionar · hasta 20 archivos
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setShowPasteModal(true)}
          style={{
            padding: '10px 18px',
            background: '#e8f442',
            color: '#111111',
            border: 'none',
            borderRadius: 6,
            fontFamily: FONT.heading,
            fontSize: 12,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          📋 Pegar texto de factura
        </button>
      </div>

      {showPasteModal && (
        <div
          onClick={() => setShowPasteModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1a1a1a',
              borderRadius: 10,
              padding: 24,
              width: '100%',
              maxWidth: 640,
              border: `1px solid ${T.brd}`,
            }}
          >
            <div
              style={{
                fontFamily: FONT.heading,
                fontSize: 14,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                color: T.pri,
                marginBottom: 12,
                fontWeight: 600,
              }}
            >
              PEGAR FACTURA (TEXTO)
            </div>
            <div style={{ color: T.sec, fontSize: 12, marginBottom: 12 }}>
              Pega el contenido de un email, WhatsApp, factura en texto... Claude extraerá los datos.
            </div>
            <textarea
              value={textoPegado}
              onChange={(e) => setTextoPegado(e.target.value)}
              placeholder="Pega aquí el contenido completo de la factura..."
              rows={14}
              style={{
                width: '100%',
                padding: 12,
                background: '#1e1e1e',
                border: `1px solid ${T.brd}`,
                borderRadius: 6,
                color: T.pri,
                fontSize: 13,
                fontFamily: 'Consolas, monospace',
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
              <button
                onClick={() => {
                  setShowPasteModal(false)
                  setTextoPegado('')
                }}
                style={{
                  padding: '8px 16px',
                  background: '#222222',
                  color: T.pri,
                  border: `1px solid ${T.brd}`,
                  borderRadius: 6,
                  fontFamily: FONT.heading,
                  fontSize: 12,
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                disabled={!textoPegado.trim() || loading}
                onClick={async () => {
                  const t = textoPegado
                  setShowPasteModal(false)
                  setTextoPegado('')
                  await onPegarTexto(t)
                }}
                style={{
                  padding: '8px 20px',
                  background: !textoPegado.trim() || loading ? '#444' : '#B01D23',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  fontFamily: FONT.heading,
                  fontSize: 12,
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  cursor: !textoPegado.trim() || loading ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                Procesar
              </button>
            </div>
          </div>
        </div>
      )}

      {uploads.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              fontFamily: FONT.heading,
              fontSize: 12,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: T.mut,
              marginBottom: 10,
            }}
          >
            {loading ? 'PROCESANDO...' : 'RESULTADOS'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {uploads.map((u, i) => (
              <UploadRow key={`${u.name}-${i}`} item={u} T={T} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function UploadRow({ item, T }: { item: UploadItem; T: ReturnType<typeof useTheme>['T'] }) {
  const icon =
    item.status === 'ok'
      ? '✅'
      : item.status === 'duplicada'
        ? '🟰'
        : item.status === 'error'
          ? '❌'
          : item.status === 'uploading'
            ? '⏳'
            : '•'
  const color =
    item.status === 'ok' ? '#1D9E75' : item.status === 'error' ? '#E24B4A' : T.sec
  return (
    <div
      style={{
        ...cardStyle(T),
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
      }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ flex: 1, color: T.pri, fontSize: 14 }}>{item.name}</span>
      {item.factura && (
        <span style={{ color, fontSize: 13, fontFamily: FONT.heading, letterSpacing: 1 }}>
          {fmtEur(item.factura.total)} · {item.factura.estado}
        </span>
      )}
      {item.mensaje && (
        <span style={{ color: T.sec, fontSize: 12 }}>{item.mensaje}</span>
      )}
    </div>
  )
}

/* ───────── TAB: Pendientes ───────── */

function TabPendientes({
  facturas,
  T,
  onRefresh,
}: {
  facturas: Factura[]
  T: ReturnType<typeof useTheme>['T']
  onRefresh: () => void
}) {
  if (facturas.length === 0) {
    return (
      <div style={{ ...cardStyle(T), textAlign: 'center', padding: 40, color: T.sec }}>
        No hay facturas pendientes de revisión.
      </div>
    )
  }

  const confirmar = async (id: string) => {
    await supabase.from('facturas').update({ estado: 'asociada' }).eq('id', id)
    await supabase.from('facturas_gastos').update({ confirmado: true }).eq('factura_id', id)
    onRefresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {facturas.map((f) => (
        <FacturaCard key={f.id} factura={f} T={T} onConfirmar={() => confirmar(f.id)} />
      ))}
    </div>
  )
}

function FacturaCard({
  factura,
  T,
  onConfirmar,
}: {
  factura: Factura
  T: ReturnType<typeof useTheme>['T']
  onConfirmar: () => void
}) {
  const [gastos, setGastos] = useState<
    Array<{ id: string; fecha: string; importe: number; concepto: string; confianza: number | null }>
  >([])

  useEffect(() => {
    supabase
      .from('facturas_gastos')
      .select(
        'conciliacion_id, importe_asociado, confianza_match, conciliacion(id, fecha, importe, concepto)',
      )
      .eq('factura_id', factura.id)
      .then(({ data }) => {
        if (data) {
          const flat = data
            .map((r) => {
              const c = r.conciliacion as unknown as {
                id: string
                fecha: string
                importe: number
                concepto: string
              } | null
              if (!c) return null
              return {
                ...c,
                confianza: r.confianza_match as number | null,
              }
            })
            .filter(
              (c): c is { id: string; fecha: string; importe: number; concepto: string; confianza: number | null } =>
                !!c,
            )
          setGastos(flat)
        }
      })
  }, [factura.id])

  const sumaGastos = gastos.reduce((a, g) => a + Math.abs(Number(g.importe)), 0)
  const cuadra = Math.abs(sumaGastos - Number(factura.total)) < 1
  const confianzaLow = factura.ocr_confianza !== null && factura.ocr_confianza < 0.7

  return (
    <div style={groupStyle(T)}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: FONT.heading,
              fontSize: 11,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: T.mut,
              marginBottom: 6,
            }}
          >
            FACTURA
          </div>
          <div style={{ fontSize: 16, color: T.pri, fontWeight: 600, marginBottom: 4 }}>
            {factura.proveedor_nombre}
          </div>
          <div style={{ fontSize: 12, color: T.sec, marginBottom: 2 }}>
            Nº {factura.numero_factura} · {factura.fecha_factura}
          </div>
          {factura.es_recapitulativa && factura.periodo_inicio && factura.periodo_fin && (
            <div style={{ fontSize: 12, color: T.sec, marginBottom: 2 }}>
              Recapitulativa: {factura.periodo_inicio} → {factura.periodo_fin}
            </div>
          )}
          <div style={{ fontSize: 13, color: T.pri, marginTop: 8 }}>
            <span style={{ color: T.mut }}>Base:</span> {fmtEur(factura.total_base)} ·{' '}
            <span style={{ color: T.mut }}>IVA:</span> {fmtEur(factura.total_iva)}
          </div>
          <div style={{ fontSize: 18, fontFamily: FONT.heading, color: T.pri, marginTop: 6, fontWeight: 600 }}>
            {fmtEur(factura.total)}
          </div>
          {confianzaLow && (
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: '#f5a623',
                background: '#3a2d1a',
                padding: '4px 8px',
                borderRadius: 4,
                display: 'inline-block',
              }}
            >
              ⚠ OCR confianza {((factura.ocr_confianza ?? 0) * 100).toFixed(0)}%
            </div>
          )}
          {factura.mensaje_matching && (
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: T.sec,
                background: T.card,
                padding: '8px 10px',
                borderRadius: 6,
                border: `1px solid ${T.brd}`,
                lineHeight: 1.4,
              }}
            >
              {factura.mensaje_matching}
            </div>
          )}
          {factura.pdf_drive_url && (
            <div style={{ marginTop: 10 }}>
              <a
                href={factura.pdf_drive_url}
                target="_blank"
                rel="noopener"
                style={{ color: '#e8f442', fontSize: 12, textDecoration: 'none' }}
              >
                Ver PDF →
              </a>
            </div>
          )}
        </div>

        <div>
          <div
            style={{
              fontFamily: FONT.heading,
              fontSize: 11,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: T.mut,
              marginBottom: 6,
            }}
          >
            GASTO(S) MATCH
          </div>
          {gastos.length === 0 ? (
            <div style={{ fontSize: 13, color: T.sec }}>Sin gastos asociados</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {gastos.map((g) => (
                <div
                  key={g.id}
                  style={{ fontSize: 12, color: T.sec, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <span style={{ flex: 1 }}>
                    {g.fecha} · {fmtEur(Math.abs(Number(g.importe)))} ·{' '}
                    <span style={{ color: T.mut }}>{g.concepto}</span>
                  </span>
                  {g.confianza !== null && <ConfianzaBadge valor={g.confianza} />}
                </div>
              ))}
              <div
                style={{
                  fontSize: 14,
                  fontFamily: FONT.heading,
                  color: T.pri,
                  marginTop: 4,
                  fontWeight: 600,
                }}
              >
                Total: {fmtEur(sumaGastos)}
              </div>
              {cuadra ? (
                <div style={{ color: '#1D9E75', fontSize: 12 }}>✅ Cuadran</div>
              ) : (
                <div style={{ color: '#E24B4A', fontSize: 12 }}>
                  ⚠ Diferencia {fmtEur(Math.abs(sumaGastos - Number(factura.total)))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={onConfirmar}
            disabled={gastos.length === 0}
            style={{
              padding: '8px 16px',
              background: gastos.length === 0 ? '#444' : '#B01D23',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              fontFamily: FONT.heading,
              fontSize: 12,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              cursor: gastos.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            CONFIRMAR
          </button>
        </div>
      </div>
    </div>
  )
}

/* ───────── TAB: Histórico ───────── */

function TabHistorico({ facturas, T }: { facturas: Factura[]; T: ReturnType<typeof useTheme>['T'] }) {
  const [filtroProv, setFiltroProv] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoFactura | ''>('')

  const filtradas = useMemo(() => {
    return facturas.filter((f) => {
      if (filtroProv && !f.proveedor_nombre.toLowerCase().includes(filtroProv.toLowerCase())) return false
      if (filtroEstado && f.estado !== filtroEstado) return false
      return true
    })
  }, [facturas, filtroProv, filtroEstado])

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input
          value={filtroProv}
          onChange={(e) => setFiltroProv(e.target.value)}
          placeholder="Filtrar por proveedor..."
          style={{
            padding: '8px 12px',
            background: T.inp,
            border: `1px solid ${T.brd}`,
            borderRadius: 6,
            color: T.pri,
            fontSize: 13,
            minWidth: 220,
          }}
        />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as EstadoFactura | '')}
          style={{
            padding: '8px 12px',
            background: T.inp,
            border: `1px solid ${T.brd}`,
            borderRadius: 6,
            color: T.pri,
            fontSize: 13,
          }}
        >
          <option value="">Todos los estados</option>
          <option value="procesando">Procesando</option>
          <option value="pendiente_revision">Pendiente revisión</option>
          <option value="asociada">Asociada</option>
          <option value="historica">Histórica</option>
          <option value="error">Error</option>
        </select>
      </div>

      <div style={{ ...cardStyle(T), padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#0a0a0a' }}>
              <th style={thStyle}>Fecha</th>
              <th style={thStyle}>Proveedor</th>
              <th style={thStyle}>Nº Factura</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Base</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>IVA</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>PDF</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 30, textAlign: 'center', color: T.sec }}>
                  Sin resultados
                </td>
              </tr>
            ) : (
              filtradas.map((f) => (
                <tr key={f.id} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                  <td style={tdStyle(T)}>{f.fecha_factura}</td>
                  <td style={tdStyle(T)}>{f.proveedor_nombre}</td>
                  <td style={tdStyle(T)}>{f.numero_factura}</td>
                  <td style={{ ...tdStyle(T), textAlign: 'right' }}>{fmtEur(f.total_base)}</td>
                  <td style={{ ...tdStyle(T), textAlign: 'right' }}>{fmtEur(f.total_iva)}</td>
                  <td style={{ ...tdStyle(T), textAlign: 'right', fontWeight: 600 }}>{fmtEur(f.total)}</td>
                  <td style={tdStyle(T)}>
                    <EstadoBadge estado={f.estado} />
                  </td>
                  <td style={tdStyle(T)}>
                    {f.pdf_drive_url ? (
                      <a href={f.pdf_drive_url} target="_blank" rel="noopener" style={{ color: '#e8f442' }}>
                        ver
                      </a>
                    ) : (
                      <span style={{ color: T.mut }}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontFamily: FONT.heading,
  fontSize: 11,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: '#aaa',
  fontWeight: 600,
}

function tdStyle(T: ReturnType<typeof useTheme>['T']): React.CSSProperties {
  return { padding: '10px 12px', color: T.pri }
}

function ConfianzaBadge({ valor }: { valor: number }) {
  const { bg, color, label } =
    valor >= 85
      ? { bg: '#1a3a2a', color: '#1D9E75', label: `${Math.round(valor)}%` }
      : valor >= 50
        ? { bg: '#3a2d1a', color: '#f5a623', label: `${Math.round(valor)}%` }
        : { bg: '#3a1a1a', color: '#E24B4A', label: `${Math.round(valor)}%` }
  return (
    <span
      style={{
        background: bg,
        color,
        padding: '1px 6px',
        borderRadius: 4,
        fontSize: 10,
        fontFamily: FONT.heading,
        letterSpacing: 1,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}

function EstadoBadge({ estado }: { estado: EstadoFactura }) {
  const map: Record<EstadoFactura, { bg: string; color: string; label: string }> = {
    procesando: { bg: '#2a2a2a', color: '#aaa', label: 'Procesando' },
    pendiente_revision: { bg: '#3a2d1a', color: '#f5a623', label: 'Revisar' },
    asociada: { bg: '#1a3a2a', color: '#1D9E75', label: 'Asociada' },
    historica: { bg: '#1a2a3a', color: '#66aaff', label: 'Histórica' },
    error: { bg: '#3a1a1a', color: '#E24B4A', label: 'Error' },
  }
  const s = map[estado]
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontFamily: FONT.heading,
        letterSpacing: 1,
        textTransform: 'uppercase',
        fontWeight: 600,
      }}
    >
      {s.label}
    </span>
  )
}

/* ───────── TAB: Faltantes ───────── */

function TabFaltantes({
  faltantes,
  T,
}: {
  faltantes: FacturaFaltante[]
  T: ReturnType<typeof useTheme>['T']
}) {
  const faltan = faltantes.filter((f) => f.estado === 'falta')
  const enPlazo = faltantes.filter((f) => f.estado === 'en_plazo')
  const okAll = faltantes.filter((f) => f.estado === 'ok')

  const diasDesde = (fecha: string) => {
    const d = new Date(fecha)
    const hoy = new Date()
    const diff = Math.floor((hoy.getTime() - d.getTime()) / 86400000)
    return diff
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {faltan.length > 0 && (
        <div style={groupStyle(T)}>
          <div
            style={{
              fontFamily: FONT.heading,
              fontSize: 13,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: '#E24B4A',
              marginBottom: 12,
              fontWeight: 600,
            }}
          >
            ⚠ FALTAN FACTURAS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {faltan.map((f) => (
              <div
                key={f.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: '#2d1515',
                  border: '1px solid #aa3030',
                  borderRadius: 6,
                }}
              >
                <div>
                  <div style={{ color: '#ffaaaa', fontSize: 14, fontWeight: 600 }}>
                    🔴 {f.proveedor_nombre} · {f.frecuencia}
                  </div>
                  <div style={{ color: T.sec, fontSize: 12, marginTop: 2 }}>
                    Esperada hace {diasDesde(f.periodo_ref)} días
                    {f.importe_estimado ? ` · ~${fmtEur(f.importe_estimado)} estimado` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {enPlazo.length > 0 && (
        <div style={groupStyle(T)}>
          <div
            style={{
              fontFamily: FONT.heading,
              fontSize: 13,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: '#f5a623',
              marginBottom: 12,
              fontWeight: 600,
            }}
          >
            EN PLAZO
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {enPlazo.map((f) => (
              <div key={f.id} style={{ color: T.sec, fontSize: 13 }}>
                🟡 {f.proveedor_nombre} · {f.frecuencia} · ref {f.periodo_ref}
              </div>
            ))}
          </div>
        </div>
      )}

      {okAll.length > 0 && (
        <div style={groupStyle(T)}>
          <div
            style={{
              fontFamily: FONT.heading,
              fontSize: 13,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: '#1D9E75',
              marginBottom: 12,
              fontWeight: 600,
            }}
          >
            ✓ RECIBIDAS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {okAll.map((f) => (
              <div key={f.id} style={{ color: T.sec, fontSize: 13 }}>
                ✅ {f.proveedor_nombre} · {f.frecuencia}
              </div>
            ))}
          </div>
        </div>
      )}

      {faltantes.length === 0 && (
        <div style={{ ...cardStyle(T), textAlign: 'center', padding: 40, color: T.sec }}>
          Sin calendario de facturas esperadas.
        </div>
      )}
    </div>
  )
}
