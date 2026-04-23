import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { BigCard } from '@/components/configuracion/BigCard'
import { EditModal, Field } from '@/components/configuracion/EditModal'
import { Avatar } from '@/components/configuracion/Avatar'
import type { PermisoRol } from '@/types/configuracion'

type RolUsuario = 'admin' | 'gestor' | 'cocina'

interface UsuarioConPin {
  id: string
  nombre: string
  email: string | null
  rol: RolUsuario | null
  pin: string | null
  avatar_color: string | null
  activo: boolean
  ultima_conexion: string | null
}

const ROLES: { value: RolUsuario; label: string }[] = [
  { value: 'admin',  label: 'Admin' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'cocina', label: 'Cocina' },
]

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioConPin[]>([])
  const [permisos, setPermisos] = useState<PermisoRol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<UsuarioConPin | null>(null)
  const [creating, setCreating] = useState(false)
  const [fNombre, setFNombre] = useState('')
  const [fEmail, setFEmail] = useState('')
  const [fRol, setFRol] = useState<RolUsuario>('cocina')
  const [fPin, setFPin] = useState('')
  const [fColor, setFColor] = useState('#B01D23')
  const [saving, setSaving] = useState(false)

  async function refetch() {
    const [u, p] = await Promise.all([
      supabase.from('usuarios').select('id, nombre, email, rol, pin, avatar_color, activo, ultima_conexion').order('rol'),
      supabase.from('permisos_rol').select('*').order('orden'),
    ])
    if (u.error) throw u.error
    if (p.error) throw p.error
    setUsuarios((u.data ?? []) as unknown as UsuarioConPin[])
    setPermisos((p.data ?? []) as unknown as PermisoRol[])
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  function open(u?: UsuarioConPin) {
    if (u) {
      setEditing(u); setCreating(false)
      setFNombre(u.nombre); setFEmail(u.email ?? '')
      setFRol((u.rol ?? 'cocina') as RolUsuario)
      setFPin(u.pin ?? ''); setFColor(u.avatar_color ?? '#B01D23')
    } else {
      setCreating(true); setEditing(null)
      setFNombre(''); setFEmail(''); setFRol('cocina'); setFPin(''); setFColor('#22B573')
    }
  }
  function close() { setEditing(null); setCreating(false) }

  async function handleSave() {
    setSaving(true)
    try {
      const payload: any = {
        nombre: fNombre.trim(),
        email: fEmail.trim() || null,
        rol: fRol,
        perfil: fRol,
        pin: fPin.trim() || null,
        avatar_color: fColor,
        activo: true,
      }
      const q = editing
        ? supabase.from('usuarios').update(payload).eq('id', editing.id)
        : supabase.from('usuarios').insert(payload)
      const { error } = await q
      if (error) throw error
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

  async function togglePermiso(rol: RolUsuario, modulo: string) {
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

  if (loading) return <div className="p-6 text-[#9E9588]">Cargando...</div>
  if (error) return <div className="p-6 bg-[#FCE0E2] text-[#D63A49] rounded-xl">{error}</div>

  const modulos = Array.from(new Set(permisos.map(p => p.modulo)))
    .map(m => ({ modulo: m, orden: permisos.find(p => p.modulo === m)?.orden ?? 999 }))
    .sort((a, b) => a.orden - b.orden)
    .map(m => m.modulo)

  return (
    <>
      <ModTitle>Usuarios</ModTitle>

      <div className="grid grid-cols-2 gap-3.5">
        <BigCard title="Usuarios y roles">
          <table className="w-full text-[13.5px] border-collapse mb-3">
            <thead>
              <tr>
                <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Usuario</th>
                <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Email</th>
                <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Rol</th>
                <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">PIN</th>
                <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Última conexión</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} onClick={() => open(u)} className="border-b border-[#F0E8D5] cursor-pointer hover:bg-[#FAF4E4]">
                  <td className="py-3.5 px-3.5">
                    <Avatar letter={u.nombre.charAt(0).toUpperCase()} color={u.avatar_color ?? '#B01D23'} />
                    <strong>{u.nombre}</strong>
                  </td>
                  <td className="py-3.5 px-3.5">{u.email ?? '—'}</td>
                  <td className="py-3.5 px-3.5"><RolTag rol={u.rol} /></td>
                  <td className="py-3.5 px-3.5 font-mono">{u.pin ? '••••' : '—'}</td>
                  <td className="py-3.5 px-3.5">{fmtFechaRelativaMadrid(u.ultima_conexion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => open()} className="px-3.5 py-2 rounded-lg text-xs font-medium bg-[#B01D23] text-white hover:bg-[#901A1E]">+ Nuevo usuario</button>
        </BigCard>

        <BigCard title="Matriz de permisos por rol">
          <table className="w-full text-[13.5px] border-collapse">
            <thead>
              <tr>
                <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Módulo</th>
                {ROLES.map(r => (
                  <th key={r.value} className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-center">{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modulos.map(mod => (
                <tr key={mod} className="border-b border-[#F0E8D5]">
                  <td className="py-3.5 px-3.5">{mod}</td>
                  {ROLES.map(r => {
                    const p = permisos.find(x => x.rol === r.value && x.modulo === mod)
                    const on = p?.permitido ?? false
                    return (
                      <td key={r.value} className="py-3.5 px-3.5 text-center">
                        <button
                          onClick={() => togglePermiso(r.value, mod)}
                          className={`w-6 h-6 rounded-md font-bold text-sm ${on ? 'bg-[#22B573] text-white hover:bg-[#1a9259]' : 'bg-[#F0E8D5] text-[#9E9588] hover:bg-[#E9E1D0]'}`}
                        >{on ? '✓' : '—'}</button>
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
          onSave={handleSave}
          onCancel={close}
          onDelete={editing ? handleDelete : undefined}
          saving={saving}
          canSave={!!fNombre.trim()}
        >
          <Field label="Nombre"><input value={fNombre} onChange={(e) => setFNombre(e.target.value)} className="w-full px-3 py-2 border border-[#E9E1D0] rounded-lg text-sm" autoFocus /></Field>
          <Field label="Email"><input value={fEmail} onChange={(e) => setFEmail(e.target.value)} className="w-full px-3 py-2 border border-[#E9E1D0] rounded-lg text-sm" /></Field>
          <Field label="Rol"><select value={fRol} onChange={(e) => setFRol(e.target.value as RolUsuario)} className="w-full px-3 py-2 border border-[#E9E1D0] rounded-lg text-sm">{ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></Field>
          <Field label="PIN (4 dígitos)"><input value={fPin} onChange={(e) => setFPin(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} className="w-full px-3 py-2 border border-[#E9E1D0] rounded-lg text-sm font-mono tracking-widest" /></Field>
          <Field label="Color avatar"><input type="color" value={fColor} onChange={(e) => setFColor(e.target.value)} className="w-full h-10 border border-[#E9E1D0] rounded-lg" /></Field>
        </EditModal>
      )}
    </>
  )
}

function RolTag({ rol }: { rol: string | null }) {
  if (!rol) return <span className="text-[#9E9588]">—</span>
  const label = rol.charAt(0).toUpperCase() + rol.slice(1)
  const cls = rol === 'admin' ? 'bg-[#B01D23] text-white' : rol === 'gestor' ? 'bg-[#6AA0D6] text-white' : 'bg-[#DCCF2A] text-[#5c550d]'
  return <span className={`inline-flex px-2.5 py-[3px] rounded-[5px] text-[10px] tracking-[0.06em] font-semibold uppercase ${cls}`}>{label}</span>
}

function fmtFechaRelativaMadrid(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }
  const hh = new Intl.DateTimeFormat('es-ES', opts).format(d)
  const today = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' })
  const todayStr = today.format(new Date())
  const dayStr = today.format(d)
  if (dayStr === todayStr) return `Hoy ${hh}`
  const y = new Date(); y.setDate(y.getDate() - 1)
  if (dayStr === today.format(y)) return `Ayer ${hh}`
  return dayStr
}
