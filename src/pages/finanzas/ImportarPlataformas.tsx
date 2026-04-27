/**
 * T-F2-09 — Importar Plataformas
 * Dropzone único multi-formato (CSV / XLSX / PDF / imagen).
 * Auto-detecta plataforma por NIF emisor / cabeceras.
 * Filas con marca='SIN_MARCA' → fondo #e8f442 + texto "Marca sin detectar — revisar".
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Upload, AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react'
import { useTheme, FONT, cardStyle, tabActiveStyle, tabInactiveStyle } from '@/styles/tokens'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtDate } from '@/utils/format'
import { toast } from '@/lib/toastStore'

/* ─── tipos ───────────────────────────────────────────────────────────────── */

type TabView = 'importar' | 'historial'

interface ImportLog {
  id: string
  creado_en: string
  plataforma: string
  archivo: string | null
  marca_nombre: string | null
  filas: number | null
  total_pedidos: number | null
  total_bruto: number | null
  estado: string | null
  error: string | null
}

interface VentaRow {
  id: string
  fecha_inicio_periodo: string
  fecha_fin_periodo: string
  plataforma: string
  marca: string
  bruto: number
  neto: number
  pedidos: number
  ticket_medio: number
  ingreso_colaborador: number
  fecha_pago: string | null
  facturas_origen: string[]
}

/* ─── helpers ─────────────────────────────────────────────────────────────── */

const PLATAFORMA_COLOR: Record<string, string> = {
  uber:       '#06C167',
  glovo:      '#aabc00',
  just_eat:   '#f5a623',
  rushour:    '#7F77DD',
  desconocido:'#888888',
}

const PLATAFORMA_LABEL: Record<string, string> = {
  uber:       'Uber Eats',
  glovo:      'Glovo',
  just_eat:   'Just Eat',
  rushour:    'RushHour',
  desconocido:'Desconocido',
}

function labelPlataforma(p: string): string {
  return PLATAFORMA_LABEL[p] ?? p
}

/* ─── componente principal ────────────────────────────────────────────────── */

export default function ImportarPlataformas() {
  const { T, isDark } = useTheme()
  const [tab, setTab] = useState<TabView>('importar')
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [ventas, setVentas] = useState<VentaRow[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [loadingVentas, setLoadingVentas] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function refetchLogs() {
    const { data } = await supabase
      .from('imports_plataformas')
      .select('id, creado_en, plataforma, archivo, marca_nombre, filas, total_pedidos, total_bruto, estado, error')
      .order('creado_en', { ascending: false })
      .limit(30)
    setLogs((data ?? []) as ImportLog[])
    setLoadingLogs(false)
  }

  async function refetchVentas() {
    const hace90 = new Date()
    hace90.setDate(hace90.getDate() - 90)
    const { data } = await supabase
      .from('ventas_plataforma')
      .select('*')
      .gte('fecha_inicio_periodo', hace90.toISOString().slice(0, 10))
      .order('fecha_inicio_periodo', { ascending: false })
      .limit(100)
    setVentas((data ?? []) as VentaRow[])
    setLoadingVentas(false)
  }

  useEffect(() => {
    refetchLogs()
    refetchVentas()
  }, [])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    const toastId = toast.loading(`Procesando ${file.name}…`)
    setUploading(true)
    try {
      // Convertir a base64 (mismo patrón que facturas/upload.ts)
      const arrayBuf = await file.arrayBuffer()
      const base64 = btoa(
        new Uint8Array(arrayBuf).reduce((acc, byte) => acc + String.fromCharCode(byte), '')
      )

      const res = await fetch('/api/importar/plataforma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, nombre: file.name, mimeType: file.type || null }),
      })
      const json = await res.json() as {
        ok: boolean
        plataforma?: string
        marca?: string
        mensaje?: string
        pendiente?: boolean
        advertencias?: string[]
      }

      if (!res.ok || !json.ok) {
        if (json.pendiente) {
          toast.error(`${file.name}\n${json.mensaje ?? 'Sin parser disponible — subir archivo ejemplo'}`, { id: toastId })
        } else {
          toast.error(`Error al importar ${file.name}\n${json.mensaje ?? 'Error desconocido'}`, { id: toastId })
        }
      } else {
        const plataLabel = labelPlataforma(json.plataforma ?? '')
        const marcaLabel = json.marca === 'SIN_MARCA' ? 'marca sin detectar' : (json.marca ?? '?')
        toast.success(`${plataLabel} · ${marcaLabel}\n${file.name} importado`, { id: toastId })
        await refetchLogs()
        await refetchVentas()
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(`Error al importar\n${msg}`, { id: toastId })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  /* ─── estilos ─────────────────────────────────────────────────────────── */

  const page: CSSProperties = {
    background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 28px',
  }
  const th: CSSProperties = {
    padding: '10px 14px', fontFamily: FONT.heading, fontSize: 10,
    textTransform: 'uppercase', letterSpacing: 2, color: T.mut, fontWeight: 400,
    background: T.group, textAlign: 'left',
  }
  const td: CSSProperties = { padding: '10px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri }

  return (
    <div style={page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ color: '#B01D23', fontFamily: FONT.heading, fontSize: 22, fontWeight: 500, letterSpacing: 1, margin: 0, textTransform: 'uppercase' }}>
          Importar Plataformas
        </h2>
        <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
          CSV / XLSX / PDF · auto-detecta plataforma y marca
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setTab('importar')} style={tab === 'importar' ? tabActiveStyle(isDark) : tabInactiveStyle(T)}>Importar</button>
        <button onClick={() => setTab('historial')} style={tab === 'historial' ? tabActiveStyle(isDark) : tabInactiveStyle(T)}>Historial BD</button>
      </div>

      {/* TAB IMPORTAR */}
      {tab === 'importar' && (
        <>
          {/* Dropzone único */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
            onClick={() => !uploading && inputRef.current?.click()}
            style={{
              border: `${dragOver ? 2 : 1.5}px dashed ${dragOver ? '#B01D23' : T.brd}`,
              borderRadius: 14,
              padding: '40px 24px',
              textAlign: 'center',
              cursor: uploading ? 'wait' : 'pointer',
              opacity: uploading ? 0.6 : 1,
              transition: 'border 120ms, background 120ms',
              background: dragOver ? `rgba(176,29,35,0.05)` : T.card,
              marginBottom: 24,
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png"
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
                  Arrastra una factura o haz click
                </div>
                <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginTop: 8 }}>
                  Uber (B88515200) · Glovo (B67282871) · RushHour · Just Eat
                </div>
                <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 4 }}>
                  Formatos: PDF, CSV, XLSX, imagen
                </div>
              </>
            )}
          </div>

          {/* Instrucciones plataformas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 24 }}>
            {[
              { id: 'uber', label: 'Uber / Portier', nif: 'B88515200', color: '#06C167', formatos: 'PDF factura' },
              { id: 'glovo', label: 'Glovo', nif: 'B67282871', color: '#aabc00', formatos: 'PDF (formato A/B)' },
              { id: 'rushour', label: 'RushHour', nif: 'Francés', color: '#7F77DD', formatos: 'PDF · CTR-SW' },
              { id: 'just_eat', label: 'Just Eat', nif: 'Pendiente', color: '#f5a623', formatos: 'Sin parser aún' },
            ].map(p => (
              <div key={p.id} style={{ ...cardStyle(T), display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, marginTop: 4, flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: FONT.heading, fontSize: 12, color: T.pri, letterSpacing: '1px', textTransform: 'uppercase' }}>{p.label}</div>
                  <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 2 }}>NIF: {p.nif}</div>
                  <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.sec, marginTop: 1 }}>{p.formatos}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Últimas importaciones */}
          <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 10 }}>
            Imports recientes
          </div>
          {loadingLogs ? (
            <div style={{ color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>Cargando…</div>
          ) : logs.length === 0 ? (
            <div style={{ color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>Sin imports todavía.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Fecha</th>
                    <th style={th}>Plataforma</th>
                    <th style={th}>Archivo</th>
                    <th style={{ ...th, textAlign: 'right' }}>Total bruto</th>
                    <th style={th}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                      <td style={{ ...td, color: T.sec }}>
                        {new Date(l.creado_en).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ ...td, textTransform: 'uppercase', fontFamily: FONT.heading, fontSize: 11, letterSpacing: 0.5, color: PLATAFORMA_COLOR[l.plataforma] ?? T.mut }}>
                        {labelPlataforma(l.plataforma)}
                      </td>
                      <td style={{ ...td, color: T.sec, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.archivo ?? '—'}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: FONT.heading, fontSize: 12 }}>{fmtEur(Number(l.total_bruto ?? 0))}</td>
                      <td style={td}>
                        {l.estado === 'ok' ? (
                          <span style={{ color: '#06C167', fontFamily: FONT.heading, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={12} /> OK
                          </span>
                        ) : l.estado === 'pendiente' ? (
                          <span style={{ color: '#e8f442', fontFamily: FONT.heading, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={12} /> Pendiente
                          </span>
                        ) : (
                          <span title={l.error ?? ''} style={{ color: '#B01D23', fontFamily: FONT.heading, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertTriangle size={12} /> Error
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* TAB HISTORIAL BD */}
      {tab === 'historial' && (
        <>
          <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 10 }}>
            ventas_plataforma · últimos 90 días
          </div>
          {loadingVentas ? (
            <div style={{ color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>Cargando…</div>
          ) : ventas.length === 0 ? (
            <div style={{ color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>
              Sin datos. Importa la primera factura de plataforma.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Periodo</th>
                    <th style={th}>Plataforma</th>
                    <th style={th}>Marca</th>
                    <th style={{ ...th, textAlign: 'right' }}>Bruto</th>
                    <th style={{ ...th, textAlign: 'right' }}>Neto</th>
                    <th style={{ ...th, textAlign: 'right' }}>Pedidos</th>
                    <th style={{ ...th, textAlign: 'right' }}>Ingreso colab.</th>
                    <th style={th}>Fecha pago</th>
                    <th style={th}>Facturas origen</th>
                  </tr>
                </thead>
                <tbody>
                  {ventas.map(v => {
                    const esSinMarca = v.marca === 'SIN_MARCA'
                    const rowStyle: CSSProperties = {
                      borderBottom: `0.5px solid ${T.brd}`,
                      background: esSinMarca ? '#e8f442' : 'transparent',
                    }
                    const tdColor = esSinMarca ? '#111111' : T.pri
                    return (
                      <tr key={v.id} style={rowStyle}>
                        <td style={{ ...td, color: T.sec, fontSize: 11 }}>
                          {v.fecha_inicio_periodo} – {v.fecha_fin_periodo}
                        </td>
                        <td style={{ ...td, fontFamily: FONT.heading, fontSize: 11, color: PLATAFORMA_COLOR[v.plataforma] ?? T.mut, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {labelPlataforma(v.plataforma)}
                        </td>
                        <td style={{ ...td, color: esSinMarca ? '#B01D23' : tdColor, fontWeight: esSinMarca ? 600 : 400 }}>
                          {esSinMarca ? '⚠ Marca sin detectar — revisar' : v.marca}
                        </td>
                        <td style={{ ...td, textAlign: 'right', color: tdColor }}>{fmtEur(v.bruto)}</td>
                        <td style={{ ...td, textAlign: 'right', color: tdColor }}>{fmtEur(v.neto)}</td>
                        <td style={{ ...td, textAlign: 'right', color: tdColor }}>{v.pedidos ?? 0}</td>
                        <td style={{ ...td, textAlign: 'right', color: tdColor }}>{fmtEur(v.ingreso_colaborador ?? 0)}</td>
                        <td style={{ ...td, color: T.sec, fontSize: 11 }}>{v.fecha_pago ?? '—'}</td>
                        <td style={{ ...td, color: T.sec, fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(v.facturas_origen ?? []).join(', ') || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
