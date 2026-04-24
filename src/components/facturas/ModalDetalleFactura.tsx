import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtFechaES } from '@/utils/format'
import type { FacturasTokens } from '@/styles/facturasTheme'

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
  pdf_original_name: string | null
  estado: string
  mensaje_matching: string | null
  ocr_raw: unknown
  facturas_gastos?: FacturaGasto[]
}

interface Props {
  T: FacturasTokens
  factura: FacturaDetalle
  onClose: () => void
  onUpdate: () => void
}

export default function ModalDetalleFactura({ T, factura, onClose, onUpdate }: Props) {
  const [datos, setDatos] = useState<FacturaDetalle>(factura)
  const [gastos, setGastos] = useState<FacturaGasto[]>(factura.facturas_gastos || [])

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
        })
        .eq('id', factura.id)
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

  const esPdf = datos.pdf_drive_url && /\.pdf/i.test(datos.pdf_original_name || '')

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
          backgroundColor: '#1a1a1a',
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
              background: '#0a0a0a',
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

        {/* Footer */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: `1px solid ${T.border}`,
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={eliminar}
            style={{
              padding: '9px 18px',
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
            Eliminar
          </button>
          <button
            onClick={rematchear}
            style={{
              padding: '9px 18px',
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
            Re-matchear
          </button>
          <button
            onClick={guardar}
            style={{
              padding: '9px 18px',
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
            Guardar
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
