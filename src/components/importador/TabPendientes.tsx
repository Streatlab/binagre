/**
 * T-M7-06 — Tab Pendientes
 * Lista imports pendiente_revision o error.
 * Acciones: Reasignar tipo, Editar, Eliminar, Reintentar.
 */

import { useEffect, useState, type CSSProperties } from 'react'
import { Trash2, RefreshCw, Edit2 } from 'lucide-react'
import { useTheme, FONT } from '@/styles/tokens'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toastStore'

/* ─── tipos ────────────────────────────────────────────────────────────────── */

interface ImportLog {
  id: string
  archivo_nombre: string | null
  tipo_detectado: string | null
  estado: string | null
  fecha_subida: string
  detalle: Record<string, unknown> | null
}

const TIPO_LEGIBLE: Record<string, string> = {
  factura_uber_portier:    'Factura Uber/Portier',
  factura_glovo:           'Factura Glovo',
  factura_jeat_rushour:    'Factura Just Eat / RushHour',
  factura_proveedor:       'Factura Proveedor',
  extracto_bancario:       'Extracto Bancario',
  resumen_plataforma_marca:'Resumen Plataforma/Marca',
  nomina:                  'Nómina',
  ventas_plataforma_csv:   'Ventas CSV',
  desconocido:             'Desconocido',
}

const TIPOS_OPCIONES = Object.entries(TIPO_LEGIBLE).map(([v, l]) => ({ value: v, label: l }))

/* ─── modal editar ──────────────────────────────────────────────────────────── */

function ModalEditar({
  log,
  onClose,
  onSave,
}: {
  log: ImportLog
  onClose: () => void
  onSave: () => void
}) {
  const [tipo, setTipo] = useState(log.tipo_detectado ?? '')
  const [nota, setNota] = useState((log.detalle?.nota as string) ?? '')
  const [saving, setSaving] = useState(false)

  async function guardar() {
    setSaving(true)
    try {
      await supabase
        .from('imports_log')
        .update({
          tipo_detectado: tipo || null,
          estado: 'pendiente_revision',
          detalle: { ...(log.detalle ?? {}), nota },
        })
        .eq('id', log.id)
      toast.success('Import actualizado')
      onSave()
      onClose()
    } catch (e: unknown) {
      toast.error(`Error al guardar: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: CSSProperties = {
    background: '#1e1e1e',
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    color: '#ffffff',
    fontFamily: 'Lexend, sans-serif',
    fontSize: 13,
    padding: '7px 10px',
    width: '100%',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: '#1a1a1a', borderRadius: 14, padding: 28, minWidth: 380, maxWidth: 500, width: '90%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, color: '#B01D23', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 18 }}>
          Editar import
        </div>
        <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#777777', marginBottom: 16 }}>
          {log.archivo_nombre}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: '#777777', display: 'block', marginBottom: 4 }}>
            Tipo
          </label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={inputStyle}>
            <option value="">— Sin asignar —</option>
            {TIPOS_OPCIONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: '#777777', display: 'block', marginBottom: 4 }}>
            Nota interna
          </label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="Anotar contexto o motivo de revisión…"
          />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={guardar}
            disabled={saving}
            style={{ background: '#B01D23', border: 'none', borderRadius: 6, color: '#ffffff', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', padding: '8px 18px', cursor: 'pointer' }}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            onClick={onClose}
            style={{ background: '#222222', border: '1px solid #383838', borderRadius: 6, color: '#cccccc', fontFamily: 'Lexend, sans-serif', fontSize: 13, padding: '7px 18px', cursor: 'pointer' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── componente principal ─────────────────────────────────────────────────── */

interface Props {
  refresh?: number
  onRefresh?: () => void
}

export default function TabPendientes({ refresh, onRefresh }: Props) {
  const { T } = useTheme()
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [loading, setLoading] = useState(true)
  const [reasignando, setReasignando] = useState<Record<string, string>>({})
  const [editando, setEditando] = useState<ImportLog | null>(null)

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('imports_log')
      .select('id, archivo_nombre, tipo_detectado, estado, fecha_subida, detalle')
      .in('estado', ['pendiente_revision', 'error'])
      .order('fecha_subida', { ascending: false })
      .limit(100)
    setLogs((data ?? []) as ImportLog[])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este import del historial?')) return
    await supabase.from('imports_log').delete().eq('id', id)
    toast.success('Import eliminado')
    await cargar()
    onRefresh?.()
  }

  async function reasignar(id: string, nuevoTipo: string) {
    if (!nuevoTipo) return
    await supabase
      .from('imports_log')
      .update({ tipo_detectado: nuevoTipo, estado: 'pendiente_revision' })
      .eq('id', id)
    toast.success(`Tipo reasignado: ${TIPO_LEGIBLE[nuevoTipo] ?? nuevoTipo}`)
    await cargar()
    onRefresh?.()
  }

  async function reintentar(log: ImportLog) {
    toast.error(`Reintento de parser para "${log.archivo_nombre ?? ''}" requiere archivo original. Actualiza el estado manualmente.`)
  }

  const th: CSSProperties = {
    padding: '10px 14px',
    fontFamily: FONT.heading,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: T.mut,
    fontWeight: 400,
    background: '#0a0a0a',
    textAlign: 'left',
  }
  const td: CSSProperties = { padding: '10px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri }

  const selectStyle: CSSProperties = {
    background: '#1e1e1e',
    border: `1px solid ${T.brd}`,
    borderRadius: 6,
    color: T.pri,
    fontFamily: FONT.body,
    fontSize: 12,
    padding: '4px 8px',
  }

  return (
    <div>
      {loading ? (
        <div style={{ color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>Cargando…</div>
      ) : logs.length === 0 ? (
        <div style={{ color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>Sin pendientes.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Fecha</th>
                <th style={th}>Archivo</th>
                <th style={th}>Tipo detectado</th>
                <th style={th}>Estado</th>
                <th style={th}>Motivo</th>
                <th style={th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const estadoColor = log.estado === 'error' ? '#B01D23' : '#e8f442'
                const motivo = (log.detalle?.mensaje as string) ?? (log.detalle?.error as string) ?? '—'
                return (
                  <tr key={log.id} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                    <td style={{ ...td, color: T.sec, fontSize: 11 }}>
                      {new Date(log.fecha_subida).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ ...td, color: T.sec, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.archivo_nombre ?? '—'}
                    </td>
                    <td style={td}>
                      <select
                        value={reasignando[log.id] ?? log.tipo_detectado ?? ''}
                        onChange={(e) => {
                          const val = e.target.value
                          setReasignando(prev => ({ ...prev, [log.id]: val }))
                          reasignar(log.id, val)
                        }}
                        style={selectStyle}
                      >
                        <option value="">— Sin tipo —</option>
                        {TIPOS_OPCIONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td style={td}>
                      <span style={{ color: estadoColor, fontFamily: FONT.heading, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {log.estado === 'error' ? 'Error' : 'Pendiente'}
                      </span>
                    </td>
                    <td style={{ ...td, color: T.mut, fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {motivo}
                    </td>
                    <td style={{ ...td, padding: '8px 14px' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          title="Editar"
                          onClick={() => setEditando(log)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#66aaff', padding: 4 }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          title="Reintentar parser"
                          onClick={() => reintentar(log)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e8f442', padding: 4 }}
                        >
                          <RefreshCw size={14} />
                        </button>
                        <button
                          title="Eliminar"
                          onClick={() => eliminar(log.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B01D23', padding: 4 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <ModalEditar
          log={editando}
          onClose={() => setEditando(null)}
          onSave={() => { cargar(); onRefresh?.() }}
        />
      )}
    </div>
  )
}
