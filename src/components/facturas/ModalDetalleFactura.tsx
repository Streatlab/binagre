import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtFechaES } from '@/utils/format'
import type { FacturasTokens } from '@/styles/facturasTheme'
import { useTitular } from '@/contexts/TitularContext'

interface FacturaGasto {
  id: string
  conciliacion_id: string
  importe_asociado: number
  confianza_match: number | null
  conciliacion?: {
    id: string
    fecha: string
    importe: number
    concepto: string | null
  } | null
}

export interface FacturaDetalle {
  id: string
  proveedor_nombre: string
  numero_factura: string
  fecha_factura: string
  tipo: string
  plataforma?: string | null
  es_recapitulativa: boolean
  periodo_inicio: string | null
  periodo_fin: string | null
  total_base: number
  total_iva: number
  total: number
  pdf_drive_url: string | null
  pdf_drive_id?: string | null
  pdf_original_name: string | null
  estado: string
  mensaje_matching: string | null
  error_mensaje?: string | null
  ocr_raw: unknown
  titular_id?: string | null
  facturas_gastos?: FacturaGasto[]
}

interface Props {
  T: FacturasTokens
  factura: FacturaDetalle
  onClose: () => void
  onUpdate: () => void
  onOpenAsociarManual?: () => void
}

export default function ModalDetalleFactura({ T, factura, onClose, onUpdate, onOpenAsociarManual }: Props) {
  const [datos, setDatos] = useState<FacturaDetalle>(factura)
  const [gastos, setGastos] = useState<FacturaGasto[]>(factura.facturas_gastos || [])
  const { titulares } = useTitular()
  const titularOriginal = factura.titular_id || null

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('facturas_gastos')
        .select('id, conciliacion_id, importe_asociado, confianza_match, conciliacion(id, fecha, importe, concepto)')
        .eq('factura_id', factura.id)
      if (data) {
        setGastos(
          data.map((r) => ({
            id: r.id as string,
            conciliacion_id: r.conciliacion_id as string,
            importe_asociado: Number(r.importe_asociado),
            confianza_match: (r.confianza_match as number | null) ?? null,
            conciliacion: r.conciliacion as unknown as FacturaGasto['conciliacion'],
          })),
        )
      }
    })()
  }, [factura.id])

  async function guardar() {
    const cambioTitular = (datos.titular_id || null) !== titularOriginal
    try {
      await fetch(`/api/facturas/${factura.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      })
    } catch {
      await supabase
        .from('facturas')
        .update({
          proveedor_nombre: datos.proveedor_nombre,
          numero_factura: datos.numero_factura,
          fecha_factura: datos.fecha_factura,
          total: datos.total,
          titular_id: datos.titular_id || null,
        })
        .eq('id', factura.id)
    }
    if (cambioTitular) {
      try {
        await fetch(`/api/facturas/${factura.id}/rematch`, { method: 'POST' })
      } catch {
        /* dev sin serverless: el rematch no corre, el usuario puede lanzarlo desde el botón */
      }
    }
    onUpdate()
  }

  async function rematchear() {
    try {
      await fetch(`/api/facturas/${factura.id}/rematch`, { method: 'POST' })
    } catch {
      /* dev sin serverless */
    }
    onUpdate()
  }

  async function eliminar() {
    if (!confirm('¿Eliminar factura?')) return
    try {
      await fetch(`/api/facturas/${factura.id}`, { method: 'DELETE' })
    } catch {
      await supabase.from('facturas_gastos').delete().eq('factura_id', factura.id)
      await supabase.from('facturas').delete().eq('id', factura.id)
    }
    onUpdate()
  }

  async function desasociar() {
    if (!confirm('¿Desasociar gastos de esta factura?')) return
    await supabase.from('facturas_gastos').delete().eq('factura_id', factura.id)
    await supabase.from('facturas').update({ estado: 'pendiente_revision' }).eq('id', factura.id)
    onUpdate()
  }

  async function aceptarMatchSugerido() {
    try {
      await fetch(`/api/facturas/${factura.id}/confirmar`, { method: 'POST' })
    } catch {
      await supabase.from('facturas_gastos').update({ confirmado: true }).eq('factura_id', factura.id)
      await supabase.from('facturas').update({ estado: 'asociada' }).eq('id', factura.id)
    }
    onUpdate()
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [subiendoDrive, setSubiendoDrive] = useState(false)
  const [driveMsg, setDriveMsg] = useState<string | null>(null)

  async function onSelectFileParaDrive(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendoDrive(true)
    setDriveMsg(null)
    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      const chunkSize = 0x8000
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)))
      }
      const base64 = btoa(binary)
      const r = await fetch(`/api/facturas/${factura.id}/subir-drive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, nombre: file.name }),
      })
      const resp = await r.json().catch(() => ({}))
      if (!r.ok) {
        setDriveMsg(`Error Drive: ${resp.error || r.statusText}`)
      } else {
        setDriveMsg('Subido a Drive correctamente')
        onUpdate()
      }
    } catch (err) {
      setDriveMsg(err instanceof Error ? err.message : 'Error subiendo archivo')
    } finally {
      setSubiendoDrive(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const esPdf = datos.pdf_drive_url && /\.pdf/i.test(datos.pdf_original_name || '')
  const hayMatches = (gastos?.length ?? 0) > 0
  const driveError = (datos.error_mensaje || '').toLowerCase().startsWith('drive:')
  const sinDrive = !datos.pdf_drive_id

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: T.base,
          borderRadius: 14,
          maxWidth: 900,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${T.border}`,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: T.fontTitle,
                fontSize: 16,
                color: T.text,
                margin: 0,
                letterSpacing: 2,
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              {factura.proveedor_nombre}
            </h2>
            <div style={{ fontFamily: T.fontUi, fontSize: 12, color: T.muted, marginTop: 4 }}>
              Nº {factura.numero_factura} · {fmtFechaES(factura.fecha_factura)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
          }}
        >
          {/* Izq */}
          <div
            style={{
              borderRight: `1px solid ${T.border}`,
              minHeight: 400,
              background: T.group,
            }}
          >
            {esPdf && datos.pdf_drive_url ? (
              <iframe
                src={datos.pdf_drive_url}
                style={{ width: '100%', height: '100%', minHeight: 500, border: 'none' }}
                title="Factura PDF"
              />
            ) : datos.pdf_drive_url ? (
              <div
                style={{
                  padding: 20,
                  color: T.muted,
                  fontFamily: T.fontUi,
                  fontSize: 13,
                }}
              >
                Archivo en Drive —{' '}
                <a
                  href={datos.pdf_drive_url}
                  target="_blank"
                  rel="noopener"
                  style={{ color: '#e8f442' }}
                >
                  abrir externo
                </a>
              </div>
            ) : (
              <pre
                style={{
                  padding: 20,
                  color: T.muted,
                  fontSize: 11,
                  fontFamily: 'Consolas, monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                }}
              >
                {JSON.stringify(datos.ocr_raw, null, 2)}
              </pre>
            )}
          </div>

          {/* Der */}
          <div style={{ padding: 20, overflow: 'auto' }}>
            <SectionLabel T={T}>DATOS EXTRAÍDOS</SectionLabel>
            <CampoEditable
              T={T}
              label="Proveedor"
              value={datos.proveedor_nombre}
              onChange={(v) => setDatos({ ...datos, proveedor_nombre: v })}
            />
            <CampoEditable
              T={T}
              label="Nº factura"
              value={datos.numero_factura}
              onChange={(v) => setDatos({ ...datos, numero_factura: v })}
            />
            <CampoEditable
              T={T}
              label="Fecha"
              value={(datos.fecha_factura || '').slice(0, 10)}
              onChange={(v) => setDatos({ ...datos, fecha_factura: v })}
              type="date"
            />
            <div style={{ marginBottom: 10 }}>
              <label
                style={{
                  fontFamily: T.fontUi,
                  fontSize: 11,
                  color: T.muted,
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Titular
              </label>
              <select
                value={datos.titular_id || ''}
                onChange={(e) =>
                  setDatos({ ...datos, titular_id: e.target.value || null })
                }
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#1e1e1e',
                  color: T.text,
                  border: `1px solid ${T.border}`,
                  borderRadius: 6,
                  fontFamily: T.fontUi,
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              >
                <option value="">— Sin asignar —</option>
                {titulares.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} · {t.nif}
                  </option>
                ))}
              </select>
            </div>
            <CampoEditable
              T={T}
              label="Base"
              value={String(datos.total_base ?? '')}
              onChange={(v) => setDatos({ ...datos, total_base: parseFloat(v) || 0 })}
              type="number"
            />
            <CampoEditable
              T={T}
              label="IVA"
              value={String(datos.total_iva ?? '')}
              onChange={(v) => setDatos({ ...datos, total_iva: parseFloat(v) || 0 })}
              type="number"
            />
            <CampoEditable
              T={T}
              label="Total"
              value={String(datos.total ?? '')}
              onChange={(v) => setDatos({ ...datos, total: parseFloat(v) || 0 })}
              type="number"
            />

            <SectionLabel T={T} marginTop={24}>
              GASTOS ASOCIADOS ({gastos.length})
            </SectionLabel>
            {gastos.length === 0 && (
              <div style={{ fontSize: 12, color: T.muted, fontStyle: 'italic' }}>
                Sin gastos asociados
              </div>
            )}
            {gastos.map((m) => (
              <div
                key={m.id}
                style={{
                  backgroundColor: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 6,
                  fontSize: 12,
                  fontFamily: T.fontUi,
                }}
              >
                <div style={{ color: T.text }}>{m.conciliacion?.concepto || '—'}</div>
                <div
                  style={{
                    color: T.muted,
                    fontSize: 11,
                    marginTop: 3,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>
                    {m.conciliacion ? fmtFechaES(m.conciliacion.fecha) : ''} ·{' '}
                    {fmtEur(Math.abs(m.conciliacion?.importe ?? m.importe_asociado))}
                  </span>
                  {m.confianza_match !== null && (
                    <span style={{ color: '#e8f442' }}>{m.confianza_match}%</span>
                  )}
                </div>
              </div>
            ))}

            {datos.mensaje_matching && (
              <>
                <SectionLabel T={T} marginTop={24}>
                  MATCHING
                </SectionLabel>
                <div
                  style={{
                    fontSize: 12,
                    color: T.secondary,
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    borderRadius: 6,
                    padding: 10,
                    lineHeight: 1.4,
                  }}
                >
                  {datos.mensaje_matching}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Alerta Drive si no está en Drive o hubo error */}
        {(sinDrive || driveError) && (
          <div
            style={{
              padding: '10px 22px',
              borderTop: `1px solid ${T.border}`,
              background: '#A32D2D15',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontFamily: T.fontUi, fontSize: 12, color: '#ff8a8a', fontWeight: 600 }}>
                {driveError ? 'Error subiendo a Drive' : 'PDF original no disponible — re-sube manual'}
              </div>
              <div style={{ fontFamily: T.fontUi, fontSize: 11, color: T.muted, marginTop: 2 }}>
                {datos.error_mensaje || 'El archivo no llegó a Drive. Re-sube para guardarlo en /carpetas/TITULAR/AÑO/…'}
              </div>
              {driveMsg && (
                <div style={{ fontFamily: T.fontUi, fontSize: 11, color: driveMsg.startsWith('Error') ? '#ff8a8a' : '#1D9E75', marginTop: 4 }}>
                  {driveMsg}
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.eml"
              style={{ display: 'none' }}
              onChange={onSelectFileParaDrive}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={subiendoDrive}
              style={{
                padding: '8px 14px',
                backgroundColor: '#A32D2D',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontFamily: T.fontTitle,
                fontSize: 12,
                letterSpacing: 1,
                textTransform: 'uppercase',
                cursor: subiendoDrive ? 'progress' : 'pointer',
                opacity: subiendoDrive ? 0.6 : 1,
              }}
            >
              {subiendoDrive ? 'Subiendo…' : '📤 Re-subir a Drive'}
            </button>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: `1px solid ${T.border}`,
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          {datos.pdf_drive_url && (
            <a
              href={datos.pdf_drive_url}
              target="_blank"
              rel="noopener"
              style={{
                padding: '9px 14px',
                backgroundColor: 'transparent',
                color: T.text,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                fontFamily: T.fontTitle,
                fontSize: 12,
                letterSpacing: 1,
                textTransform: 'uppercase',
                cursor: 'pointer',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              📎 Ver PDF en Drive
            </a>
          )}
          <button
            onClick={eliminar}
            style={{
              padding: '9px 14px',
              backgroundColor: 'transparent',
              color: '#A32D2D',
              border: `1px solid #A32D2D`,
              borderRadius: 8,
              fontFamily: T.fontTitle,
              fontSize: 12,
              letterSpacing: 1,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            🗑️ Borrar factura
          </button>
          <button
            onClick={rematchear}
            style={{
              padding: '9px 14px',
              backgroundColor: 'transparent',
              color: T.text,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              fontFamily: T.fontTitle,
              fontSize: 12,
              letterSpacing: 1,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            🔄 Volver a buscar match
          </button>
          {factura.estado === 'pendiente_revision' && hayMatches && (
            <button
              onClick={aceptarMatchSugerido}
              style={{
                padding: '9px 14px',
                backgroundColor: '#1D9E75',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontFamily: T.fontTitle,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              ✅ Aceptar match sugerido
            </button>
          )}
          {factura.estado === 'pendiente_revision' && !hayMatches && onOpenAsociarManual && (
            <button
              onClick={onOpenAsociarManual}
              style={{
                padding: '9px 14px',
                backgroundColor: '#BA7517',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontFamily: T.fontTitle,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              🔍 Buscar match manual
            </button>
          )}
          {factura.estado === 'asociada' && (
            <button
              onClick={desasociar}
              style={{
                padding: '9px 14px',
                backgroundColor: 'transparent',
                color: '#BA7517',
                border: `1px solid #BA7517`,
                borderRadius: 8,
                fontFamily: T.fontTitle,
                fontSize: 12,
                letterSpacing: 1,
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              ❌ Desasociar
            </button>
          )}
          <button
            onClick={guardar}
            style={{
              padding: '9px 14px',
              backgroundColor: T.accentRed,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontFamily: T.fontTitle,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 1,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            💾 Guardar cambios
          </button>
        </div>
      </div>
    </div>
  )
}

function SectionLabel({
  T,
  children,
  marginTop = 0,
}: {
  T: FacturasTokens
  children: React.ReactNode
  marginTop?: number
}) {
  return (
    <h3
      style={{
        fontFamily: T.fontTitle,
        fontSize: 11,
        color: T.muted,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginTop,
        marginBottom: 8,
        fontWeight: 600,
      }}
    >
      {children}
    </h3>
  )
}

function CampoEditable({
  T,
  label,
  value,
  onChange,
  type = 'text',
}: {
  T: FacturasTokens
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label
        style={{
          fontFamily: T.fontUi,
          fontSize: 11,
          color: T.muted,
          display: 'block',
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          backgroundColor: '#1e1e1e',
          color: T.text,
          border: `1px solid ${T.border}`,
          borderRadius: 6,
          fontFamily: T.fontUi,
          fontSize: 13,
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}
