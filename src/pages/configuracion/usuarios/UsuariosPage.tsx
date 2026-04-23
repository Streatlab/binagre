import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { ConfigShell } from '@/components/configuracion/ConfigShell'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'
import { EditModal, Field } from '@/components/configuracion/EditModal'
import { Avatar } from '@/components/configuracion/Avatar'
import { useAuth } from '@/context/AuthContext'

type Rol = 'admin' | 'gestor' | 'cocina'

interface Usuario {
  id: string
  nombre: string
  rol: Rol | null
  pin: string | null
  avatar_color: string | null
  ultima_conexion: string | null
  activo: boolean
  email: string | null
}

interface Permiso { rol: Rol; modulo: string; permitido: boolean; orden: number }

const ROLES: { value: Rol; label: string }[] = [
  { value: 'admin',  label: 'Admin' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'cocina', label: 'Cocina' },
]

function rolColor(rol: Rol | null): string {
  if (rol === 'admin') return '#B01D23'
  if (rol === 'gestor') return '#66aaff'
  if (rol === 'cocina') return '#e8f442'
  return '#7080a8'
}

export default function UsuariosPage() {
  const { T, isDark } = useTheme()
  const { usuario: usuarioLogueado } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [permisos, setPermisos] = useState<Permiso[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Usuario | null>(null)
  const [creating, setCreating] = useState(false)
  const [fNombre, setFNombre] = useState('')
  const [fRol, setFRol] = useState<Rol>('cocina')
  const [fPin, setFPin] = useState('')
  const [fColor, setFColor] = useState('#22B573')
  const [saving, setSaving] = useState(false)

  async function refetch() {
    const [u, p] = await Promise.all([
      supabase.from('usuarios').select('id, nombre, email, rol, perfil, pin, avatar_color, activo, ultima_conexion').order('rol'),
      supabase.from('permisos_rol').select('*').order('orden'),
    ])
    if (u.error) throw u.error
    if (p.error) throw p.error
    setUsuarios((u.data ?? []) as unknown as Usuario[])
    setPermisos((p.data ?? []) as unknown as Permiso[])
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  function open(u?: Usuario) {
    if (u) {
      setEditing(u); setCreating(false)
      setFNombre(u.nombre); setFRol((u.rol ?? 'cocina') as Rol); setFPin(u.pin ?? ''); setFColor(u.avatar_color ?? '#22B573')
    } else {
      setCreating(true); setEditing(null)
      setFNombre(''); setFRol('cocina'); setFPin(''); setFColor('#22B573')
    }
  }
  function close() { setEditing(null); setCreating(false) }

  async function handleSave() {
    setSaving(true)
    try {
      const payload: any = {
        nombre: fNombre.trim(),
        rol: fRol, perfil: fRol,
        pin: fPin.trim() || null,
        avatar_color: fColor,
        activo: true,
      }
      const q = editing
        ? supabase.from('usuarios').update(payload).eq('id', editing.id)
        : supabase.from('usuarios').insert(payload)
      const { error } = await q; if (error) throw error
      await refetch(); close()
    } catch (e: any) { setError(e?.message ?? 'Error') } finally { setSaving(false) }
  }
  async function handleDelete() {
    if (!editing) return
    if (!confirm(`Eliminar usuario "${editing.nombre}"?`)) return
    const { error } = await supabase.from('usuarios').delete().eq('id', editing.id)
    if (error) { setError(error.message); return }
    await refetch(); close()
  }

  async function togglePermiso(rol: Rol, modulo: string) {
    const p = permisos.find(x => x.rol === rol && x.modulo === modulo)
    if (!p) {
      const { error } = await supabase.from('permisos_rol').insert({ rol, modulo, permitido: true, orden: 999 })
      if (error) { setError(error.message); return }
    } else {
      const { error } = await supabase.from('permisos_rol').update({ permitido: !p.permitido }).eq('rol', rol).eq('modulo', modulo)
      if (error) { setError(error.message); return }
    }
    await refetch()
  }

  if (loading) {
    return <ConfigShell><ModTitle>Usuarios</ModTitle><div style={{ padding: 24, color: T.mut, fontFamily: FONT.body }}>Cargando…</div></ConfigShell>
  }
  if (error) {
    return (
      <ConfigShell>
        <ModTitle>Usuarios</ModTitle>
        <div style={{ padding: 16, background: '#B01D2320', color: '#B01D23', borderRadius: 10, fontFamily: FONT.body }}>{error}</div>
      </ConfigShell>
    )
  }

  const modulos = Array.from(new Set(permisos.map(p => p.modulo)))
    .map(m => ({ m, o: permisos.find(p => p.modulo === m)?.orden ?? 999 }))
    .sort((a, b) => a.o - b.o)
    .map(x => x.m)

  const esAdmin = (usuarioLogueado?.rol ?? usuarioLogueado?.perfil) === 'admin'

  const th: React.CSSProperties = {
    padding: '10px 14px',
    fontFamily: FONT.heading,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '2px',
    color: T.mut,
    fontWeight: 400,
    background: T.group,
    textAlign: 'left',
  }
  const td: React.CSSProperties = { padding: '10px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri }

  const okBg = isDark ? 'rgba(34, 181, 115, 0.22)' : '#D4F0E0'
  const okFg = isDark ? '#22B573' : '#027b4b'
  const offBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'

  return (
    <ConfigShell>
      <ModTitle>Usuarios</ModTitle>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14 }}>
        {/* Usuarios y roles */}
        <ConfigGroupCard title="Usuarios y roles">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderTop: `0.5px solid ${T.brd}`, borderBottom: `0.5px solid ${T.brd}`, background: T.group }}>
                  <th style={th}>Usuario</th>
                  <th style={th}>Rol</th>
                  {esAdmin && <th style={th}>PIN</th>}
                  <th style={{ ...th, textAlign: 'right' }}>Última conexión</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={esAdmin ? 4 : 3} style={{ padding: '32px 22px', textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>
                      Sin usuarios.
                    </td>
                  </tr>
                ) : usuarios.map(u => (
                  <tr key={u.id} onClick={() => open(u)} style={{ borderBottom: `0.5px solid ${T.brd}`, cursor: 'pointer' }}>
                    <td style={td}>
                      <Avatar letter={u.nombre.charAt(0).toUpperCase()} color={u.avatar_color ?? rolColor(u.rol)} />
                      <strong style={{ color: T.pri }}>{u.nombre}</strong>
                    </td>
                    <td style={td}><RolPill rol={u.rol} isDark={isDark} /></td>
                    {esAdmin && (
                      <td style={{ ...td, fontFamily: FONT.body, color: u.pin ? T.pri : T.mut, letterSpacing: u.pin ? 2 : 0 }}>
                        {u.pin ? '••••' : '—'}
                      </td>
                    )}
                    <td style={{ ...td, textAlign: 'right', color: T.sec }}>{fmtFechaMadrid(u.ultima_conexion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              padding: '14px 22px 18px',
              borderTop: `0.5px solid ${T.brd}`,
              background: T.bg,
            }}
          >
            <button
              onClick={() => open()}
              style={{
                padding: '7px 14px',
                borderRadius: 6,
                border: 'none',
                background: '#B01D23',
                color: '#ffffff',
                fontFamily: FONT.heading,
                fontSize: 11,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >+ Nuevo usuario</button>
          </div>
        </ConfigGroupCard>

        {/* Matriz de permisos */}
        <ConfigGroupCard title="Matriz de permisos por rol">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderTop: `0.5px solid ${T.brd}`, borderBottom: `0.5px solid ${T.brd}`, background: T.group }}>
                  <th style={th}>Módulo</th>
                  {ROLES.map(r => (
                    <th key={r.value} style={{ ...th, textAlign: 'center' }}>{r.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modulos.map(mod => (
                  <tr
                    key={mod}
                    style={{ borderBottom: `0.5px solid ${T.brd}` }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...td, fontWeight: 600 }}>{mod}</td>
                    {ROLES.map(r => {
                      const p = permisos.find(x => x.rol === r.value && x.modulo === mod)
                      const on = p?.permitido ?? false
                      return (
                        <td key={r.value} style={{ ...td, textAlign: 'center' }}>
                          <button
                            onClick={() => togglePermiso(r.value, mod)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              border: 'none',
                              fontSize: 14,
                              fontWeight: 700,
                              cursor: 'pointer',
                              background: on ? okBg : offBg,
                              color: on ? okFg : T.mut,
                              transition: 'all 0.15s',
                            }}
                          >{on ? <Check size={16} strokeWidth={2.5} /> : '—'}</button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ConfigGroupCard>
      </div>

      {(editing || creating) && (
        <EditModal
          title={editing ? 'Editar usuario' : 'Nuevo usuario'}
          onSave={handleSave} onCancel={close}
          onDelete={editing ? handleDelete : undefined}
          saving={saving} canSave={!!fNombre.trim()}
        >
          <Field label="Nombre"><input value={fNombre} onChange={(e) => setFNombre(e.target.value)} autoFocus className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--sl-border-focus)]" /></Field>
          <Field label="Rol">
            <select value={fRol} onChange={(e) => setFRol(e.target.value as Rol)} className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm bg-[var(--sl-card)] focus:outline-none focus:border-[var(--sl-border-focus)]">
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="PIN"><input value={fPin} onChange={(e) => setFPin(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--sl-border-focus)]" /></Field>
          <Field label="Color avatar"><input type="color" value={fColor} onChange={(e) => setFColor(e.target.value)} className="w-full h-10 border border-[var(--sl-border)] rounded-lg" /></Field>
        </EditModal>
      )}
    </ConfigShell>
  )
}

function RolPill({ rol, isDark }: { rol: Rol | null; isDark: boolean }) {
  if (!rol) return <span style={{ color: '#7080a8' }}>—</span>
  const label = rol.charAt(0).toUpperCase() + rol.slice(1)
  const palette: Record<Rol, { bg: string; fg: string }> = {
    admin:  { bg: isDark ? 'rgba(176,29,35,0.28)' : '#FCEBEB', fg: isDark ? '#F09595' : '#A32D2D' },
    gestor: { bg: isDark ? 'rgba(12,68,124,0.30)' : '#E6F1FB', fg: isDark ? '#89B5DF' : '#0C447C' },
    cocina: { bg: isDark ? 'rgba(186,117,23,0.26)' : '#FAEEDA', fg: isDark ? '#F5C36B' : '#854F0B' },
  }
  const p = palette[rol]
  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '5px 14px',
        borderRadius: 5,
        fontSize: 11,
        letterSpacing: '0.06em',
        fontWeight: 600,
        textTransform: 'uppercase',
        background: p.bg,
        color: p.fg,
        fontFamily: FONT.heading,
      }}
    >{label}</span>
  )
}

function fmtFechaMadrid(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const hh = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(d)
  const today = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' })
  const todayStr = today.format(new Date())
  const dayStr = today.format(d)
  if (dayStr === todayStr) return `Hoy ${hh}`
  const y = new Date(); y.setDate(y.getDate() - 1)
  if (dayStr === today.format(y)) return `Ayer ${hh}`
  return dayStr
}
