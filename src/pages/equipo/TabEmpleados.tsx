import { AZUL_CL, BLANCO, GRANATE, INK, LIMA, VERDE } from '@/styles/neobrutal'
import { useEffect, useState } from 'react'
import { UserPlus, Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import ModalEmpleado, { type Empleado } from '@/components/equipo/ModalEmpleado'
import { archivarEmpleado, reactivarEmpleado, eliminarEmpleadoDuro } from '@/components/equipo/horarios/personal'

type EstadoEmpleado = 'activo' | 'baja' | 'vacaciones' | 'despedido' | 'inactivo'

function estadoColor(estado: EstadoEmpleado): string {
  if (estado === 'activo') return VERDE
  if (estado === 'baja') return '#888'
  if (estado === 'vacaciones') return AZUL_CL
  return GRANATE
}

function esArchivado(estado: string): boolean {
  return ['inactivo', 'baja', 'despedido'].includes(estado)
}

function calcAntiguedad(fechaAlta?: string | null): string {
  if (!fechaAlta) return '—'
  const diff = Date.now() - new Date(fechaAlta + 'T12:00:00').getTime()
  const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
  const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44))
  if (years > 0) return `${years}a ${months}m`
  return `${months} mes${months !== 1 ? 'es' : ''}`
}

function Avatar({ nombre, color, foto }: { nombre: string; color?: string; foto?: string | null }) {
  const initials = nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: color ?? GRANATE, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT.heading, fontSize: 13, fontWeight: 600, color: BLANCO,
      flexShrink: 0,
    }}>
      {foto ? <img src={foto} alt={nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
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
      .select('id, nombre, nif, iban, salario, fecha_alta, estado, datos_personales, drive_folder_id, cargo, email, foto_url, dias_vacaciones_anuales')
      .order('nombre')
    if (!error) setEmpleados((data ?? []) as Empleado[])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  async function onArchivar(emp: Empleado) {
    if (esArchivado(emp.estado as string)) {
      await reactivarEmpleado(emp.id!)
    } else {
      if (!window.confirm(`¿Pasar a ${emp.nombre} a antiguos empleados? Deja de aparecer en horarios pero conserva su histórico.`)) return
      await archivarEmpleado(emp.id!)
    }
    fetch()
  }

  async function onBorrar(emp: Empleado) {
    if (!window.confirm(`BORRAR DEFINITIVAMENTE a ${emp.nombre}. Se elimina su ficha y sus horarios. Esta acción NO se puede deshacer. ¿Continuar?`)) return
    await eliminarEmpleadoDuro(emp.id!)
    fetch()
  }

  const th: React.CSSProperties = {
    padding: '10px 14px', fontFamily: FONT.heading, fontSize: 10,
    textTransform: 'uppercase', letterSpacing: '2px', color: T.mut,
    fontWeight: 400, background: T.group, textAlign: 'left',
  }
  const thSticky: React.CSSProperties = { ...th, position: 'sticky', left: 0, zIndex: 5 }
  const td: React.CSSProperties = { padding: '12px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri }
  const tdSticky: React.CSSProperties = { ...td, position: 'sticky', left: 0, zIndex: 5, background: 'var(--sl-app)' }

  const accionBtn: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 6, border: `1px solid ${T.brd}`,
    background: T.card, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut }}>
          {empleados.length} empleado{empleados.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setModal({ open: true, empleado: null })}
          style={{ padding: '12px 16px', minHeight: 44, borderRadius: 8, border: 'none', background: LIMA, color: INK, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <UserPlus size={14} />
          Nuevo empleado
        </button>
      </div>

      <div style={{ ...cardStyle(T), padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando empleados…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.brd}` }}>
                <th style={thSticky}>Empleado</th>
                <th style={th}>NIF</th>
                <th style={{ ...th, display: isDark ? undefined : 'none' } as React.CSSProperties}>Cargo</th>
                <th style={th}>Antigüedad</th>
                <th style={th}>Estado</th>
                <th style={{ ...th, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empleados.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 24px', textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>
                    Sin empleados registrados. Añade el primero.
                  </td>
                </tr>
              ) : empleados.map(emp => {
                const archivado = esArchivado(emp.estado as string)
                return (
                <tr
                  key={emp.id}
                  onClick={() => setModal({ open: true, empleado: emp })}
                  style={{ borderBottom: `1px solid ${T.brd}`, cursor: 'pointer', opacity: archivado ? 0.6 : 1 }}
                  onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={tdSticky}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar nombre={emp.nombre} foto={emp.foto_url} color={archivado ? '#444' : undefined} />
                      <div>
                        <div style={{ fontWeight: 600, color: T.pri }}>{emp.nombre}</div>
                        <div style={{ fontSize: 11, color: T.mut }}>{emp.datos_personales?.email || emp.email || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...td, color: T.sec, fontSize: 12 }}>{emp.nif || '—'}</td>
                  <td style={{ ...td, color: T.sec, display: isDark ? undefined : 'none' } as React.CSSProperties}>{emp.cargo || '—'}</td>
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
                  <td style={{ ...td, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button onClick={() => onArchivar(emp)} style={accionBtn}
                        title={archivado ? 'Reactivar' : 'Pasar a antiguos'}>
                        {archivado ? <ArchiveRestore size={15} color={VERDE} /> : <Archive size={15} color={T.sec} />}
                      </button>
                      <button onClick={() => onBorrar(emp)} style={accionBtn} title="Borrar definitivamente">
                        <Trash2 size={15} color={GRANATE} />
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
          </div>
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
