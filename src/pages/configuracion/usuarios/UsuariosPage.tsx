import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtFechaRelativa } from '@/utils/format'
import { useIsDark } from '@/hooks/useIsDark'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { BigCard } from '@/components/configuracion/BigCard'
import { Toolbar, Spacer, BtnRed } from '@/components/configuracion/Toolbar'
import { Avatar } from '@/components/configuracion/Avatar'
import { StatusTag } from '@/components/configuracion/StatusTag'
import { Table, THead, TBody, TH, TR, TD } from '@/components/configuracion/ConfigTable'
import { ConfigModal, ConfigField, useInputStyle, ModalActions } from '@/components/configuracion/ConfigModal'
import type { UsuarioErp, PermisoRol, RolUsuario } from '@/types/configuracion'

interface UsuarioConPin extends UsuarioErp {
  pin: string | null
  perfil?: string | null
}

export default function UsuariosPage() {
  const isDark = useIsDark()
  const [usuarios, setUsuarios] = useState<UsuarioConPin[]>([])
  const [permisos, setPermisos] = useState<PermisoRol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<{ editing: UsuarioConPin | null } | null>(null)

  const refetch = async () => {
    const [u, p] = await Promise.all([
      supabase.from('usuarios').select('id, nombre, email, rol, perfil, pin, avatar_color, activo, ultima_conexion').order('rol'),
      supabase.from('permisos_rol').select('*').order('orden'),
    ])
    if (u.error) throw u.error
    if (p.error) throw p.error
    setUsuarios((u.data ?? []) as unknown as UsuarioConPin[])
    setPermisos((p.data ?? []) as unknown as PermisoRol[])
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try { await refetch() }
      catch (e: any) { if (!cancelled) setError(e?.message ?? 'Error') }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  const handleDelete = async (u: UsuarioConPin) => {
    if (!confirm(`¿Eliminar usuario ${u.nombre}?`)) return
    const { error } = await supabase.from('usuarios').delete().eq('id', u.id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  const mut = isDark ? '#777' : '#9E9588'

  if (loading) return <div style={{ padding: 24, color: mut }}>Cargando usuarios…</div>
  if (error) {
    return (
      <div style={{ padding: 16, background: isDark ? '#3a1a1a' : '#FCE0E2', color: isDark ? '#ff8080' : '#B01D23', borderRadius: 12 }}>
        {error}
      </div>
    )
  }

  const okColor = isDark ? '#06C167' : '#22B573'
  const modulosMap = new Map<string, number>()
  for (const p of permisos) if (!modulosMap.has(p.modulo)) modulosMap.set(p.modulo, p.orden)
  const modulosOrdenados = Array.from(modulosMap.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([m]) => m)

  return (
    <>
      <ModTitle>Usuarios</ModTitle>

      <Toolbar>
        <Spacer />
        <BtnRed onClick={() => setModal({ editing: null })}>+ Nuevo usuario</BtnRed>
      </Toolbar>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
        <BigCard title="Usuarios y roles">
          {usuarios.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: mut }}>
              Sin usuarios registrados
            </div>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Usuario</TH>
                  <TH>Email</TH>
                  <TH>Rol</TH>
                  <TH>PIN</TH>
                  <TH>Conexión</TH>
                  <TH num>Acciones</TH>
                </tr>
              </THead>
              <TBody>
                {usuarios.map(u => (
                  <TR key={u.id}>
                    <TD bold>
                      <Avatar
                        letter={(u.nombre[0] ?? '?').toUpperCase()}
                        color={u.avatar_color ?? '#B01D23'}
                      />
                      {u.nombre}
                    </TD>
                    <TD muted>{u.email ?? '—'}</TD>
                    <TD>
                      {u.rol === 'admin' && <StatusTag variant="admin">Admin</StatusTag>}
                      {u.rol === 'cocina' && <StatusTag variant="cocina">Cocina</StatusTag>}
                      {!u.rol && <span style={{ color: mut }}>—</span>}
                    </TD>
                    <TD muted style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: 2 }}>
                      {u.pin ? '••••' : '—'}
                    </TD>
                    <TD muted>{fmtFechaRelativa(u.ultima_conexion)}</TD>
                    <TD num>
                      <button
                        onClick={() => setModal({ editing: u })}
                        style={{
                          background: 'none', border: 'none', color: '#B01D23',
                          fontSize: 11, cursor: 'pointer', marginRight: 12, padding: 0,
                          fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase',
                          fontWeight: 600, letterSpacing: '0.04em',
                        }}
                      >Editar</button>
                      <button
                        onClick={() => handleDelete(u)}
                        style={{
                          background: 'none', border: 'none', color: mut,
                          fontSize: 11, cursor: 'pointer', padding: 0,
                          fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase',
                          fontWeight: 600, letterSpacing: '0.04em',
                        }}
                      >Eliminar</button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </BigCard>

        <BigCard title="Matriz de permisos por rol">
          <Table>
            <THead>
              <tr>
                <TH>Módulo</TH>
                <TH num>Admin</TH>
                <TH num>Cocina</TH>
              </tr>
            </THead>
            <TBody>
              {modulosOrdenados.map(mod => {
                const admin = permisos.find(p => p.modulo === mod && p.rol === 'admin')?.permitido ?? false
                const cocina = permisos.find(p => p.modulo === mod && p.rol === 'cocina')?.permitido ?? false
                return (
                  <TR key={mod}>
                    <TD bold>{mod}</TD>
                    <TD num bold style={{ color: admin ? okColor : mut }}>
                      {admin ? '✓' : '—'}
                    </TD>
                    <TD num bold style={{ color: cocina ? okColor : mut }}>
                      {cocina ? '✓' : '—'}
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        </BigCard>
      </div>

      {modal && (
        <UsuarioModal
          editing={modal.editing}
          onClose={() => setModal(null)}
          onSaved={refetch}
        />
      )}
    </>
  )
}

function UsuarioModal({
  editing, onClose, onSaved,
}: {
  editing: UsuarioConPin | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const inputStyle = useInputStyle()
  const [nombre, setNombre] = useState(editing?.nombre ?? '')
  const [email, setEmail] = useState(editing?.email ?? '')
  const [rol, setRol] = useState<RolUsuario>(editing?.rol ?? 'cocina')
  const [pin, setPin] = useState(editing?.pin ?? '')
  const [avatarColor, setAvatarColor] = useState(editing?.avatar_color ?? '#B01D23')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!nombre.trim() || !pin.trim()) return
    setSaving(true); setError(null)
    const payload: any = {
      nombre: nombre.trim(),
      email: email.trim() || null,
      rol,
      perfil: rol,
      pin: pin.trim(),
      avatar_color: avatarColor,
      activo: true,
    }
    const q = editing
      ? supabase.from('usuarios').update(payload).eq('id', editing.id)
      : supabase.from('usuarios').insert(payload)
    const { error } = await q
    setSaving(false)
    if (error) { setError(error.message); return }
    await onSaved()
    onClose()
  }

  return (
    <ConfigModal title={`${editing ? 'Editar' : 'Nuevo'} usuario`} onClose={onClose}>
      <ConfigField label="Nombre">
        <input value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} />
      </ConfigField>
      <ConfigField label="Email">
        <input value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="usuario@streatlab.es" />
      </ConfigField>
      <ConfigField label="Rol">
        <select value={rol} onChange={e => setRol(e.target.value as RolUsuario)} style={inputStyle}>
          <option value="admin">Admin</option>
          <option value="cocina">Cocina</option>
        </select>
      </ConfigField>
      <ConfigField label="PIN (4 dígitos)">
        <input
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          style={{ ...inputStyle, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: 4 }}
          placeholder="0000"
          maxLength={4}
        />
      </ConfigField>
      <ConfigField label="Color avatar">
        <input
          type="color"
          value={avatarColor}
          onChange={e => setAvatarColor(e.target.value)}
          style={{ ...inputStyle, height: 38, padding: 2, cursor: 'pointer' }}
        />
      </ConfigField>
      {error && (
        <div style={{ marginTop: 12, padding: 8, background: '#FCE0E2', color: '#B01D23', fontSize: 12, borderRadius: 6 }}>
          {error}
        </div>
      )}
      <ModalActions
        onCancel={onClose}
        onSave={handleSave}
        saving={saving}
        disabled={!nombre.trim() || !pin.trim() || pin.length !== 4}
      />
    </ConfigModal>
  )
}
