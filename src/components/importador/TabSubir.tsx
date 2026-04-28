/**
 * T-M7-04 — Tab Subir
 * Dropzone único multi-formato. Detección automática del tipo de archivo.
 * Routing post-detección a tabla destino en Supabase.
 */

import { useRef, useState, type CSSProperties } from 'react'
import {
  Upload,
  RefreshCw,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
} from 'lucide-react'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { toast } from '@/lib/toastStore'

/* ─── tipos ────────────────────────────────────────────────────────────────── */

type TipoDetectado =
  | 'factura_uber_portier'
  | 'factura_glovo'
  | 'factura_jeat_rushour'
  | 'factura_proveedor'
  | 'extracto_bancario'
  | 'resumen_plataforma_marca'
  | 'nomina'
  | 'ventas_plataforma_csv'
  | 'desconocido'

interface ArchivoPreview {
  nombre: string
  tamanio: number
  tipo: string
}

const TIPO_LEGIBLE: Record<TipoDetectado, string> = {
  factura_uber_portier:    'Factura Uber/Portier',
  factura_glovo:           'Factura Glovo',
  factura_jeat_rushour:    'Factura Just Eat / RushHour',
  factura_proveedor:       'Factura Proveedor',
  extracto_bancario:       'Extracto Bancario',
  resumen_plataforma_marca:'Resumen Plataforma/Marca',
  nomina:                  'Nómina',
  ventas_plataforma_csv:   'Ventas Plataforma CSV',
  desconocido:             'Tipo desconocido',
}

const DESTINO_MODULO: Record<TipoDetectado, string> = {
  factura_uber_portier:    'facturas',
  factura_glovo:           'facturas',
  factura_jeat_rushour:    'facturas',
  factura_proveedor:       'facturas',
  extracto_bancario:       'movimientos_bancarios',
  resumen_plataforma_marca:'ventas_plataforma_marca_mensual',
  nomina:                  'nominas',
  ventas_plataforma_csv:   'ventas_plataforma',
  desconocido:             'pendiente',
}

/* ─── detección cliente-side para tipos no-PDF ─────────────────────────────── */

async function detectarTipo(file: File, contenidoTexto?: string): Promise<TipoDetectado> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const texto = (contenidoTexto ?? '').toLowerCase()

  // Regla 1-4: PDF/imagen → delegar al backend (OCR NIF)
  // Aquí solo hacemos detección por texto extraído si viene del backend
  if (texto.includes('b88515200')) return 'factura_uber_portier'
  if (texto.includes('b67282871')) return 'factura_glovo'
  if (
    texto.includes('rushour') ||
    texto.includes('just eat') ||
    texto.includes('takeaway')
  ) return 'factura_jeat_rushour'

  // Regla 5: CSV extracto bancario
  if (ext === 'csv') {
    const cabecera = texto.slice(0, 500)
    if (
      cabecera.includes('fecha') &&
      cabecera.includes('concepto') &&
      (cabecera.includes('beneficiario') || cabecera.includes('bbva'))
    ) return 'extracto_bancario'

    // Regla 8: CSV ventas plataforma diario
    if (cabecera.includes('canal') && cabecera.includes('pedidos') && cabecera.includes('bruto')) {
      return 'ventas_plataforma_csv'
    }
  }

  // Regla 6: XLSX con cabecera Mes+Plataforma+Marca
  if (ext === 'xlsx' || ext === 'xls') {
    // Sin parsear XLSX en cliente, delegar al backend
    return 'desconocido'
  }

  // Regla 7: PDF nómina
  if (texto.includes('nómina') || texto.includes('nomina') || texto.includes('salario neto')) {
    if (texto.includes('iban')) return 'nomina'
  }

  return 'desconocido'
}

function iconoArchivo(nombre: string): React.ReactNode {
  const ext = nombre.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return <FileImage size={28} color="#66aaff" />
  if (['xlsx', 'xls', 'csv'].includes(ext)) return <FileSpreadsheet size={28} color="#06C167" />
  if (ext === 'pdf') return <FileText size={28} color="#B01D23" />
  if (['doc', 'docx'].includes(ext)) return <File size={28} color="#f5a623" />
  return <File size={28} color="#777777" />
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* ─── componente principal ─────────────────────────────────────────────────── */

interface Props {
  onUploadSuccess?: () => void
}

export default function TabSubir({ onUploadSuccess }: Props) {
  const { T, isDark } = useTheme()
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<ArchivoPreview | null>(null)
  const [tipoManual, setTipoManual] = useState<TipoDetectado | ''>('')
  const [mostrarManual, setMostrarManual] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    setPreview({ nombre: file.name, tamanio: file.size, tipo: file.type })
    setUploading(true)
    setMostrarManual(false)
    setTipoManual('')

    const toastId = toast.loading(`Procesando ${file.name}…`)

    try {
      const arrayBuf = await file.arrayBuffer()
      const base64 = btoa(
        new Uint8Array(arrayBuf).reduce((acc, byte) => acc + String.fromCharCode(byte), '')
      )

      // Llamar al endpoint unificado
      const res = await fetch('/api/importar/plataforma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64,
          nombre: file.name,
          mimeType: file.type || null,
          modulo: 'importador',
        }),
      })

      let json: {
        ok: boolean
        tipo_detectado?: TipoDetectado
        plataforma?: string
        marca?: string
        importe?: number
        mensaje?: string
        destino_id?: string
        pendiente?: boolean
        advertencias?: string[]
      } = { ok: false }

      try { json = await res.json() } catch { /* parse error */ }

      const tipo = json.tipo_detectado ?? 'desconocido'
      const legible = TIPO_LEGIBLE[tipo as TipoDetectado] ?? tipo
      const destino = DESTINO_MODULO[tipo as TipoDetectado] ?? 'pendiente'
      const estado = destino === 'pendiente' ? 'pendiente_revision' :
                     json.ok ? 'procesado' : 'error'

      // Registrar en imports_log
      const { data: { session } } = await supabase.auth.getSession()
      await supabase.from('imports_log').insert({
        archivo_nombre: file.name,
        archivo_url: null,
        tipo_detectado: tipo,
        estado,
        destino_modulo: destino === 'pendiente' ? null : destino,
        destino_id: json.destino_id ?? null,
        user_id: session?.user?.id ?? null,
        detalle: {
          plataforma: json.plataforma,
          marca: json.marca,
          importe: json.importe,
          mensaje: json.mensaje,
          advertencias: json.advertencias,
        },
      })

      if (!json.ok || destino === 'pendiente') {
        if (destino === 'pendiente') {
          toast.error(
            `Tipo no detectado para ${file.name}. Revisar en tab Pendientes.`,
            { id: toastId }
          )
          setMostrarManual(true)
        } else {
          const motivo = json.mensaje ?? 'Error desconocido'
          toast.error(
            `No se pudo procesar: ${motivo}. Revisar en tab Pendientes.`,
            { id: toastId }
          )
        }
      } else {
        const importeStr = json.importe != null ? ` (${fmtEur(json.importe)})` : ''
        const detalleClave = json.marca
          ? `${json.plataforma ?? ''} · ${json.marca}`
          : (json.plataforma ?? '')
        toast.success(
          `Subido: ${legible} — ${detalleClave}${importeStr}`,
          { id: toastId }
        )
        onUploadSuccess?.()
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      // Registrar error en imports_log
      try {
        const { data: { session } } = await supabase.auth.getSession()
        await supabase.from('imports_log').insert({
          archivo_nombre: file.name,
          archivo_url: null,
          tipo_detectado: 'desconocido',
          estado: 'error',
          destino_modulo: null,
          destino_id: null,
          user_id: session?.user?.id ?? null,
          detalle: { error: msg },
        })
      } catch { /* silent */ }
      toast.error(`No se pudo procesar: ${msg}. Revisar en tab Pendientes.`, { id: toastId })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const dropzoneBorder = dragOver ? '#B01D23' : T.brd
  const dropzoneBg = dragOver ? 'rgba(176,29,35,0.05)' : T.card

  const labelEstilo: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 10,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: T.mut,
    marginBottom: 8,
  }

  return (
    <div>
      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          border: `${dragOver ? 2 : 1.5}px dashed ${dropzoneBorder}`,
          borderRadius: 14,
          padding: '40px 24px',
          textAlign: 'center',
          cursor: uploading ? 'wait' : 'pointer',
          opacity: uploading ? 0.6 : 1,
          transition: 'border 120ms, background 120ms',
          background: dropzoneBg,
          marginBottom: 20,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls,.doc,.docx"
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: T.sec }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontFamily: FONT.body, fontSize: 14 }}>Procesando archivo…</span>
          </div>
        ) : (
          <>
            <Upload size={32} color={T.mut} style={{ marginBottom: 12 }} />
            <div style={{ fontFamily: FONT.heading, fontSize: 16, color: T.pri, letterSpacing: '1px', textTransform: 'uppercase' }}>
              Arrastra o haz clic para seleccionar
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginTop: 8 }}>
              PDF · CSV · XLSX · Imágenes · Doc
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 4 }}>
              Uber · Glovo · Just Eat · RushHour · Extracto bancario · Nóminas
            </div>
          </>
        )}
      </div>

      {/* Preview archivo */}
      {preview && !uploading && (
        <div style={{ ...cardStyle(T), display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          {iconoArchivo(preview.nombre)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {preview.nombre}
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 2 }}>
              {fmtBytes(preview.tamanio)}
            </div>
          </div>
        </div>
      )}

      {/* Selector manual de tipo si no detectado */}
      {mostrarManual && (
        <div style={{ ...cardStyle(T), marginBottom: 20, border: `1px solid #aa3030`, backgroundColor: '#2d1515' }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 11, color: '#ffaaaa', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>
            Tipo no detectado automaticamente — asignar manualmente
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={tipoManual}
              onChange={(e) => setTipoManual(e.target.value as TipoDetectado)}
              style={{
                background: '#1e1e1e',
                border: `1px solid ${T.brd}`,
                borderRadius: 6,
                color: T.pri,
                fontFamily: FONT.body,
                fontSize: 13,
                padding: '6px 10px',
              }}
            >
              <option value="">— Seleccionar tipo —</option>
              {Object.entries(TIPO_LEGIBLE).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            {tipoManual && (
              <button
                onClick={async () => {
                  if (!preview || !tipoManual) return
                  const { data: { session } } = await supabase.auth.getSession()
                  await supabase
                    .from('imports_log')
                    .update({ tipo_detectado: tipoManual, estado: 'pendiente_revision' })
                    .eq('archivo_nombre', preview.nombre)
                    .order('fecha_subida', { ascending: false })
                    .limit(1)
                  toast.success(`Tipo asignado: ${TIPO_LEGIBLE[tipoManual]}`)
                  setMostrarManual(false)
                  setTipoManual('')
                }}
                style={{
                  background: '#B01D23',
                  border: 'none',
                  borderRadius: 6,
                  color: '#ffffff',
                  fontFamily: FONT.heading,
                  fontSize: 11,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  padding: '7px 14px',
                  cursor: 'pointer',
                }}
              >
                Asignar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Info plataformas */}
      <div style={{ marginBottom: 8 }}>
        <div style={labelEstilo}>Detección automática</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 24 }}>
        {[
          { id: 'uber',     label: 'Uber / Portier',  nif: 'B88515200',  color: '#06C167', formatos: 'PDF factura' },
          { id: 'glovo',    label: 'Glovo',            nif: 'B67282871',  color: '#aabc00', formatos: 'PDF (formato A/B)' },
          { id: 'rushour',  label: 'RushHour',         nif: 'Francés',    color: '#7F77DD', formatos: 'PDF · CTR-SW' },
          { id: 'just_eat', label: 'Just Eat',         nif: 'Pendiente',  color: '#f5a623', formatos: 'Sin parser aún' },
          { id: 'banco',    label: 'Extracto BBVA',    nif: 'CSV',        color: '#66aaff', formatos: 'CSV FECHA;CONCEPTO' },
          { id: 'resumen',  label: 'Resumen Plataforma',nif: 'XLSX',      color: '#e8f442', formatos: 'Mes+Plataforma+Marca' },
          { id: 'nomina',   label: 'Nómina',           nif: 'PDF+IBAN',   color: '#cccccc', formatos: 'NÓMINA + IBAN' },
        ].map(p => (
          <div key={p.id} style={{ ...cardStyle(T), display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, marginTop: 4, flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: FONT.heading, fontSize: 11, color: T.pri, letterSpacing: '1px', textTransform: 'uppercase' }}>{p.label}</div>
              <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 1 }}>NIF: {p.nif}</div>
              <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.sec, marginTop: 1 }}>{p.formatos}</div>
            </div>
          </div>
        ))}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
