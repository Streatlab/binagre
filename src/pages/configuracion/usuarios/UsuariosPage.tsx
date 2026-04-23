import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtFechaRelativa } from '@/utils/format'
import { useIsDark } from '@/hooks/useIsDark'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { KpiCard, KpiGrid } from '@/components/configuracion/KpiCard'
import { BigCard } from '@/components/configuracion/BigCard'
import { Toolbar, Spacer, BtnRed } from '@/components/configuracion/Toolbar'
import { Avatar } from '@/components/configuracion/Avatar'
import { StatusTag } from '@/components/configuracion/StatusTag'
import { Table, THead, TBody, TH, TR, TD } from '@/components/configuracion/ConfigTable'
import type { UsuarioErp, PermisoRol } from '@/types/configuracion'

export default function UsuariosPage() {
  const isDark = useIsDark()
  const [usuarios, setUsuarios] = useState<UsuarioErp[]>([])
  const [permisos, setPermisos] = useState<PermisoRol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [u, p] = await Promise.all([
          supabase.from('usuarios').select('id, nombre, email, rol, avatar_color, activo, ultima_conexion').order('rol'),
          supabase.from('permisos_rol').select('*').order('orden'),
        ])
        if (u.error) throw u.error
        if (p.error) throw p.error
        if (cancelled) return
        setUsuarios((u.data ?? []) as unknown as UsuarioErp[])
        setPermisos((p.data ?? []) as unknown as PermisoRol[])
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Error cargando usuarios')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const { activos, roles, modulosOrdenados, ultConexion } = useMemo(() => {
    const activos = usuarios.filter(u => u.activo)
    const roles = new Set(usuarios.map(u => u.rol).filter((r): r is 'admin' | 'cocina' => !!r))
    const modulosMap = new Map<string, number>()
    for (const p of permisos) if (!modulosMap.has(p.modulo)) modulosMap.set(p.modulo, p.orden)
    const modulosOrdenados = Array.from(modulosMap.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([m]) => m)
    const ultConexion = [...usuarios]
      .filter(u => u.ultima_conexion)
      .sort((a, b) => (b.ultima_conexion ?? '').localeCompare(a.ultima_conexion ?? ''))[0]
    return { activos, roles, modulosOrdenados, ultConexion }
  }, [usuarios, permisos])

  const mut = isDark ? '#777777' : '#9E9588'

  if (loading) return <div style={{ padding: 24, color: mut }}>Cargando usuarios…</div>
  if (error) {
    return (
      <div
        style={{
          padding: 16,
          background: isDark ? '#3a1a1a' : '#FCE0E2',
          color: isDark ? '#ff8080' : '#B01D23',
          borderRadius: 12,
        }}
      >
        {error}
      </div>
    )
  }

  const okColor = isDark ? '#06C167' : '#22B573'

  return (
    <>
      <ModTitle>Usuarios</ModTitle>

      <KpiGrid>
        <KpiCard
          label="Activos"
          value={activos.length}
          sub={activos.map(u => u.nombre).join(' + ') || '—'}
        />
        <KpiCard label="Roles" value={roles.size} sub="admin · cocina" />
        <KpiCard label="Módulos" value={modulosOrdenados.length} sub="con permisos" />
        <KpiCard
          label="Últ. conexión"
          value={fmtFechaRelativa(ultConexion?.ultima_conexion ?? null)}
          sub={ultConexion?.nombre ?? '—'}
        />
      </KpiGrid>

      <Toolbar>
        <Spacer />
        <BtnRed onClick={() => alert('Pendiente: modal nuevo usuario')}>+ Nuevo usuario</BtnRed>
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
                  <TH>Conexión</TH>
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
                    <TD muted>{fmtFechaRelativa(u.ultima_conexion)}</TD>
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
    </>
  )
}
