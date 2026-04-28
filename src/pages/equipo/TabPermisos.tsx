import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import ModalSolicitud from '@/components/equipo/ModalSolicitud'
import { syncRango } from '@/utils/calendarioOperativoSync'
import { useAuth } from '@/context/AuthContext'

interface Empleado { id: string; nombre: string }
interface Solicitud {
  id: string
  empleado_id: string
  fecha_inicio: string
  fecha_fin: string
  tipo: string
  estado: 'pendiente' | 'aprobado' | 'rechazado'
  nota?: string
  aprobado_por?: string
  created_at: string
}

type FiltroEstado = 'todas' | 'pendiente' | 'aprobado' | 'rechazado'

const TIPO_LABELS: Record<string, string> = {
  vacaciones: 'Vacaciones',
  asuntos_propios: 'Asuntos propios',
  baja_medica: 'Baja médica',
  permiso_retribuido: 'Permiso retribuido',
  otro: 'Otro',
}

// Mapa tipo solicitud → tipo evento_laboral
const TIPO_EVENTO: Record<string, string> = {
  vacaciones: 'vacaciones',
  asuntos_propios: 'asuntos_propios',
  baja_medica: 'baja_medica',
  permiso_retribuido: 'permiso_retribuido',
  otro: 'asuntos_propios',
}

function estadoBadge(estado: Solicitud['estado']) {
  if (estado === 'aprobado') return { color: '#1D9E75', bg: '#1D9E7520', icon: <CheckCircle size={12} />, label: 'Aprobado' }
  if (estado === 'rechazado') return { color: '#B01D23', bg: '#B01D2320', icon: <XCircle size={12} />, label: 'Rechazado' }
  return { color: '#f5a623', bg: '#f5a62320', icon: <Clock size={12} />, label: 'Pendiente' }
}

export default function TabPermisos() {
  const { T, isDark: _isDark } = useTheme()
  const { usuario } = useAuth()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<FiltroEstado>('todas')
  const [modalOpen, setModalOpen] = useState(false)
  const [notaRej, setNotaRej] = useState<{ id: string; nota: string } | null>(null)

  const isAdmin = ['admin', 'socio'].includes(usuario?.perfil ?? usuario?.rol ?? '')

  async function fetchAll() {
    const [e, s] = await Promise.all([
      supabase.from('empleados').select('id, nombre').eq('estado', 'activo').order('nombre'),
      supabase.from('solicitudes_permisos').select('*').order('created_at', { ascending: false }),
    ])
    setEmpleados((e.data ?? []) as Empleado[])
    setSolicitudes((s.data ?? []) as Solicitud[])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  async function aprobar(id: string) {
    const sol = solicitudes.find(s => s.id === id)
    if (!sol) return
    const { error } = await supabase.from('solicitudes_permisos').update({
      estado: 'aprobado',
      aprobado_por: usuario?.id ?? null,
    }).eq('id', id)
    if (error) { alert('Error: ' + error.message); return }

    // Insertar eventos_laborales para cada fecha del rango
    const fechas: string[] = []
    const cur = new Date(sol.fecha_inicio + 'T12:00:00')
    const end = new Date(sol.fecha_fin + 'T12:00:00')
    while (cur <= end) {
      fechas.push(cur.toISOString().slice(0, 10))
      cur.setDate(cur.getDate() + 1)
    }
    const tipoEvento = TIPO_EVENTO[sol.tipo] ?? 'asuntos_propios'
    await supabase.from('eventos_laborales').insert(
      fechas.map(f => ({ empleado_id: sol.empleado_id, fecha: f, tipo: tipoEvento, nota: `Permiso aprobado: ${sol.id}` }))
    )

    // Sync calendario operativo
    await syncRango(sol.fecha_inicio, sol.fecha_fin)

    await fetchAll()
  }

  async function rechazar(id: string, nota: string) {
    const { error } = await supabase.from('solicitudes_permisos').update({
      estado: 'rechazado',
      nota: nota || null,
      aprobado_por: usuario?.id ?? null,
    }).eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    setNotaRej(null)
    await fetchAll()
  }

  async function revocarAprobacion(id: string) {
    const sol = solicitudes.find(s => s.id === id)
    if (!sol) return
    // Revertir estado
    await supabase.from('solicitudes_permisos').update({ estado: 'pendiente', aprobado_por: null }).eq('id', id)
    // Eliminar eventos laborales creados por este permiso
    await supabase.from('eventos_laborales').delete().like('nota', `%${id}%`)
    // Revertir calendario operativo
    await syncRango(sol.fecha_inicio, sol.fecha_fin)
    await fetchAll()
  }

  const filtradas = filtro === 'todas' ? solicitudes : solicitudes.filter(s => s.estado === filtro)
  const empNombre = (id: string) => empleados.find(e => e.id === id)?.nombre ?? id

  const th: React.CSSProperties = { padding: '10px 14px', fontFamily: FONT.heading, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', color: T.mut, fontWeight: 400, background: T.group, textAlign: 'left' }
  const td: React.CSSProperties = { padding: '12px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri }

  const filtros: { key: FiltroEstado; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'pendiente', label: 'Pendientes' },
    { key: 'aprobado', label: 'Aprobadas' },
    { key: 'rechazado', label: 'Rechazadas' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8 }}>
          {filtros.map(f => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              style={{
                padding: '6px 14px', borderRadius: 6, border: `1px solid ${T.brd}`,
                background: filtro === f.key ? '#B01D23' : T.card,
                color: filtro === f.key ? '#fff' : T.sec,
                fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setModalOpen(true)}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#e8f442', color: '#111111', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer' }}
        >
          + Solicitar permiso
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
      ) : (
        <div style={{ ...cardStyle(T), padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.brd}` }}>
                <th style={th}>Empleado</th>
                <th style={th}>Periodo</th>
                <th style={th}>Tipo</th>
                <th style={th}>Estado</th>
                <th style={th}>Nota</th>
                {isAdmin && <th style={{ ...th, textAlign: 'right' }}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr><td colSpan={isAdmin ? 6 : 5} style={{ padding: '40px 24px', textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin solicitudes.</td></tr>
              ) : filtradas.map(sol => {
                const badge = estadoBadge(sol.estado)
                return (
                  <tr key={sol.id} style={{ borderBottom: `1px solid ${T.brd}` }}>
                    <td style={{ ...td, fontWeight: 600 }}>{empNombre(sol.empleado_id)}</td>
                    <td style={{ ...td, fontSize: 12, color: T.sec }}>
                      {sol.fecha_inicio === sol.fecha_fin ? sol.fecha_inicio : `${sol.fecha_inicio} → ${sol.fecha_fin}`}
                    </td>
                    <td style={td}>{TIPO_LABELS[sol.tipo] ?? sol.tipo}</td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 4, background: badge.bg, color: badge.color, fontSize: 10, fontFamily: FONT.heading, letterSpacing: '1px', textTransform: 'uppercase' }}>
                        {badge.icon}{badge.label}
                      </span>
                    </td>
                    <td style={{ ...td, fontSize: 12, color: T.mut }}>{sol.nota || '—'}</td>
                    {isAdmin && (
                      <td style={{ ...td, textAlign: 'right' }}>
                        {sol.estado === 'pendiente' && (
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button onClick={() => aprobar(sol.id)} style={{ padding: '5px 10px', borderRadius: 5, border: 'none', background: '#1D9E75', color: '#fff', fontFamily: FONT.heading, fontSize: 10, cursor: 'pointer', letterSpacing: '1px' }}>Aprobar</button>
                            <button onClick={() => setNotaRej({ id: sol.id, nota: '' })} style={{ padding: '5px 10px', borderRadius: 5, border: `1px solid ${T.brd}`, background: T.card, color: '#B01D23', fontFamily: FONT.heading, fontSize: 10, cursor: 'pointer', letterSpacing: '1px' }}>Rechazar</button>
                          </div>
                        )}
                        {sol.estado === 'aprobado' && (
                          <button onClick={() => revocarAprobacion(sol.id)} style={{ padding: '5px 10px', borderRadius: 5, border: `1px solid ${T.brd}`, background: T.card, color: T.mut, fontFamily: FONT.heading, fontSize: 10, cursor: 'pointer' }}>Revocar</button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal rechazo con nota */}
      {notaRej && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: '#1a1a1a', borderRadius: 12, border: `1px solid ${T.brd}`, width: 380, padding: 24, boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 14, color: T.pri, marginBottom: 14, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Rechazar solicitud</div>
            <textarea
              placeholder="Motivo del rechazo (obligatorio)…"
              value={notaRej.nota}
              onChange={e => setNotaRej(n => n ? { ...n, nota: e.target.value } : null)}
              style={{ width: '100%', padding: '8px 10px', background: '#1e1e1e', border: `1px solid ${T.brd}`, borderRadius: 6, color: T.pri, fontFamily: FONT.body, fontSize: 13, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button onClick={() => setNotaRej(null)} style={{ padding: '7px 14px', borderRadius: 6, border: `1px solid ${T.brd}`, background: '#222', color: T.pri, fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Cancelar</button>
              <button
                onClick={() => rechazar(notaRej.id, notaRej.nota)}
                disabled={!notaRej.nota.trim()}
                style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#B01D23', color: '#fff', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', cursor: notaRej.nota.trim() ? 'pointer' : 'not-allowed', opacity: notaRej.nota.trim() ? 1 : 0.5 }}
              >
                Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <ModalSolicitud
          empleados={empleados}
          onClose={() => setModalOpen(false)}
          onSaved={() => { fetchAll(); setModalOpen(false) }}
        />
      )}
    </div>
  )
}
