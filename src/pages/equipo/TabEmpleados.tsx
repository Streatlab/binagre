import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import ModalEmpleado, { type Empleado } from '@/components/equipo/ModalEmpleado'

type EstadoEmpleado = 'activo' | 'baja' | 'vacaciones' | 'despedido'

function estadoColor(estado: EstadoEmpleado): string {
  if (estado === 'activo') return '#1D9E75'
  if (estado === 'baja') return '#888'
  if (estado === 'vacaciones') return '#66aaff'
  return '#B01D23'
}

function calcAntiguedad(fechaAlta?: string | null): string {
  if (!fechaAlta) return '—'
  const diff = Date.now() - new Date(fechaAlta + 'T12:00:00').getTime()
  const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
  const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44))
  if (years > 0) return `${years}a ${months}m`
  return `${months} mes${months !== 1 ? 'es' : ''}`
}

function Avatar({ nombre, color }: { nombre: string; color?: string }) {
  const initials = nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: color ?? '#B01D23',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT.heading, fontSize: 13, fontWeight: 600, color: '#ffffff',
      flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

export default function TabEmpleados() {
  const { T, isDark } = useTheme()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; empleado: Empleado | null }>({ open: false, empleado: null })

  async function fetch() {
    const { data, error } = await supabase
      .from('empleados')
      .select('id, nombre, nif, iban, salario, fecha_alta, estado, datos_personales, drive_folder_id, cargo, email')
      .order('nombre')
    if (!error) setEmpleados((data ?? []) as Empleado[])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const th: React.CSSProperties = {
    padding: '10px 14px', fontFamily: FONT.heading, fontSize: 10,
    textTransform: 'uppercase', letterSpacing: '2px', color: T.mut,
    fontWeight: 400, background: T.group, textAlign: 'left',
  }
  const td: React.CSSProperties = { padding: '12px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut }}>
          {empleados.length} empleado{empleados.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setModal({ open: true, empleado: null })}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#e8f442', color: '#111111', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <UserPlus size={14} />
          Nuevo empleado
        </button>
      </div>

      <div style={{ ...cardStyle(T), padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando empleados…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.brd}` }}>
                <th style={th}>Empleado</th>
                <th style={th}>NIF</th>
                <th style={{ ...th, display: isDark ? undefined : 'none' } as React.CSSProperties}>Cargo</th>
                <th style={th}>Antigüedad</th>
                <th style={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {empleados.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px 24px', textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>
                    Sin empleados registrados. Añade el primero.
                  </td>
                </tr>
              ) : empleados.map(emp => (
                <tr
                  key={emp.id}
                  onClick={() => setModal({ open: true, empleado: emp })}
                  style={{ borderBottom: `1px solid ${T.brd}`, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar nombre={emp.nombre} color={emp.estado === 'despedido' ? '#444' : undefined} />
                      <div>
                        <div style={{ fontWeight: 600, color: T.pri }}>{emp.nombre}</div>
                        <div style={{ fontSize: 11, color: T.mut }}>{emp.datos_personales?.email || emp.email || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...td, color: T.sec, fontSize: 12 }}>{emp.nif || '—'}</td>
                  <td style={{ ...td, color: T.sec }}>{emp.cargo || '—'}</td>
                  <td style={{ ...td, color: T.sec, fontSize: 12 }}>{calcAntiguedad(emp.fecha_alta)}</td>
                  <td style={td}>
                    <span style={{
                      display: 'inline-flex', padding: '4px 10px', borderRadius: 4,
                      fontSize: 10, letterSpacing: '1px', fontWeight: 600,
                      textTransform: 'uppercase', fontFamily: FONT.heading,
                      background: estadoColor(emp.estado as EstadoEmpleado) + '25',
                      color: estadoColor(emp.estado as EstadoEmpleado),
                    }}>
                      {emp.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal.open && (
        <ModalEmpleado
          empleado={modal.empleado}
          onClose={() => setModal({ open: false, empleado: null })}
          onSaved={() => { fetch(); setModal({ open: false, empleado: null }) }}
        />
      )}
    </div>
  )
}
