import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { ConfigShell } from '@/components/configuracion/ConfigShell'
import { BigCard } from '@/components/configuracion/BigCard'
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

export default function UsuariosPage() {
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
  const [fColor, setFColor] = useState('#06C167')
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
      setFNombre(u.nombre); setFRol((u.rol ?? 'cocina') as Rol); setFPin(u.pin ?? ''); setFColor(u.avatar_color ?? '#06C167')
    } else {
      setCreating(true); setEditing(null)
      setFNombre(''); setFRol('cocina'); setFPin(''); setFColor('#06C167')
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

  if (loading) return <ConfigShell><ModTitle>Usuarios</ModTitle><div className="p-6 text-[var(--sl-text-muted)]">Cargando...</div></ConfigShell>
  if (error) return <ConfigShell><ModTitle>Usuarios</ModTitle><div className="p-6 bg-[var(--sl-border-error)]/20 text-[var(--sl-border-error)] rounded-xl">{error}</div></ConfigShell>

  const modulos = Array.from(new Set(permisos.map(p => p.modulo)))
    .map(m => ({ m, o: permisos.find(p => p.modulo === m)?.orden ?? 999 }))
    .sort((a, b) => a.o - b.o)
    .map(x => x.m)

  const esAdmin = (usuarioLogueado?.rol ?? usuarioLogueado?.perfil) === 'admin'

  return (
    <ConfigShell>
      <ModTitle>Usuarios</ModTitle>

      <div className="grid grid-cols-2 gap-3.5">
        <BigCard title="Usuarios y roles">
          <table className="sl-cfg-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                {esAdmin && <th>PIN</th>}
                <th>Última conexión</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} onClick={() => open(u)} className="row-click">
                  <td>
                    <Avatar letter={u.nombre.charAt(0).toUpperCase()} color={u.avatar_color ?? '#B01D23'} />
                    <strong>{u.nombre}</strong>
                  </td>
                  <td><RolPill rol={u.rol} /></td>
                  {esAdmin && <td style={{ fontFamily: "ui-monospace,monospace" }}>{u.pin ?? '—'}</td>}
                  <td>{fmtFechaMadrid(u.ultima_conexion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => open()} className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--sl-btn-save-bg)] text-white hover:bg-[#901A1E] tracking-[0.04em]">+ Nuevo usuario</button>
        </BigCard>

        <BigCard title="Matriz de permisos por rol">
          <table className="sl-cfg-table">
            <thead>
              <tr>
                <th>Módulo</th>
                {ROLES.map(r => (
                  <th key={r.value} className="py-3.5 px-3.5 border-b border-[var(--sl-border)] text-[11px] tracking-[0.14em] uppercase text-[var(--sl-text-muted)] font-medium text-center">{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modulos.map(mod => (
                <tr key={mod}>
                  <td>{mod}</td>
                  {ROLES.map(r => {
                    const p = permisos.find(x => x.rol === r.value && x.modulo === mod)
                    const on = p?.permitido ?? false
                    return (
                      <td key={r.value} className="py-3.5 px-3.5 text-center">
                        <button onClick={() => togglePermiso(r.value, mod)}
                          className={`w-6 h-6 rounded-md font-bold text-sm transition ${on ? 'bg-[var(--sl-uber)] text-white hover:bg-[var(--sl-uber-text)]' : 'bg-[var(--sl-border)] text-[var(--sl-text-muted)] hover:bg-[var(--sl-border)]'}`}>
                          {on ? '✓' : '—'}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </BigCard>
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

function RolPill({ rol }: { rol: string | null }) {
  if (!rol) return <span className="text-[var(--sl-text-muted)]">—</span>
  const label = rol.charAt(0).toUpperCase() + rol.slice(1)
  const cls = rol === 'admin' ? 'bg-[var(--sl-btn-save-bg)] text-white' : rol === 'gestor' ? 'bg-[var(--sl-direct)] text-white' : 'bg-[var(--sl-glovo-dot)] text-[var(--sl-glovo-text)]'
  return <span className={`inline-flex px-2.5 py-[3px] rounded-[5px] text-[10px] tracking-[0.06em] font-semibold uppercase ${cls}`}>{label}</span>
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
