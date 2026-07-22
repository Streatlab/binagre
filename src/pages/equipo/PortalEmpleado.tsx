/**
 * Portal del empleado — vista de autoservicio (D·Tanda 5).
 * Muestra los datos del usuario autenticado y accesos directos a lo suyo:
 * su horario, su fichaje/presencia y sus tareas. Sin dependencias de BD nuevas.
 */
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme, FONT } from '@/styles/tokens'
import { GRANATE, BLANCO } from '@/styles/neobrutal'

const ACCESOS = [
  { to: '/equipo/horarios', emoji: '🗓️', label: 'Mi horario', desc: 'Turnos asignados de la semana' },
  { to: '/equipo/presencia', emoji: '🕐', label: 'Mi presencia', desc: 'Fichajes de entrada y salida' },
  { to: '/ops/registro-diario/tareas', emoji: '📝', label: 'Mis tareas', desc: 'Tareas operativas del turno' },
]

export default function PortalEmpleado() {
  const { usuario } = useAuth()
  const { T } = useTheme()

  return (
    <div style={{ width: '100%' }}>
      <div style={{ background: GRANATE, color: BLANCO, borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.85 }}>
          Portal del empleado
        </div>
        <div style={{ fontFamily: FONT.heading, fontSize: 26, fontWeight: 700, marginTop: 4 }}>
          Hola, {usuario?.nombre ?? 'equipo'}
        </div>
        {usuario?.perfil && (
          <div style={{ fontFamily: FONT.body, fontSize: 13, opacity: 0.9, marginTop: 2, textTransform: 'capitalize' }}>
            {usuario.perfil}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {ACCESOS.map(a => (
          <Link key={a.to} to={a.to} style={{
            display: 'block', textDecoration: 'none',
            background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 12, padding: '18px 20px',
          }}>
            <div style={{ fontSize: 26 }}>{a.emoji}</div>
            <div style={{ fontFamily: FONT.heading, fontSize: 15, fontWeight: 600, color: T.pri, marginTop: 8 }}>{a.label}</div>
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec, marginTop: 3 }}>{a.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
