import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { useIsDark } from '@/hooks/useIsDark'
import { KpiCard, KpiGrid } from '@/components/configuracion/KpiCard'
import { BigCard } from '@/components/configuracion/BigCard'
import { Toolbar, Spacer, BtnRed } from '@/components/configuracion/Toolbar'
import { Avatar } from '@/components/configuracion/Avatar'
import { StatusTag } from '@/components/configuracion/StatusTag'
import { Table, THead, TBody, TH, TR, TD, TotalTR } from '@/components/configuracion/ConfigTable'
import type { EstadoMarca, RolUsuario } from '@/types/configuracion'

interface Usuario {
  id: string
  nombre: string
  rol: RolUsuario
  avatar_color: string | null
  email: string | null
}

interface MarcaLite {
  id: string
  nombre: string
  cocina: string | null
  responsable_id: string | null
  objetivo_mes: number
  estado: EstadoMarca
}

export default function TabUsuariosMarcas() {
  const isDark = useIsDark()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [marcas, setMarcas] = useState<MarcaLite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const [u, m] = await Promise.all([
          supabase.from('usuarios').select('id, nombre, rol, avatar_color, email').in('rol', ['admin', 'cocina']),
          supabase.from('marcas').select('id, nombre, cocina, responsable_id, objetivo_mes, estado'),
        ])
        if (u.error) throw u.error
        if (m.error) throw m.error
        if (cancelled) return
        setUsuarios(((u.data ?? []) as unknown as Usuario[]))
        setMarcas(((m.data ?? []) as unknown as MarcaLite[]).map(mm => ({
          ...mm,
          objetivo_mes: Number(mm.objetivo_mes) || 0,
        })))
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Error cargando usuarios')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const gruposPorUsuario = useMemo(() => {
    return usuarios.map(u => {
      const suyas = marcas.filter(m => m.responsable_id === u.id)
      const activas = suyas.filter(m => m.estado === 'activa')
      const obj = suyas.reduce((a, m) => a + (m.estado === 'activa' ? m.objetivo_mes : 0), 0)
      return { usuario: u, marcas: suyas, activas, objetivoTotal: obj }
    })
  }, [usuarios, marcas])

  const conMarcas = gruposPorUsuario.filter(g => g.marcas.length > 0)
  const sinAsignar = marcas.filter(m => !m.responsable_id).length

  if (loading) {
    return <div style={{ padding: 24, color: isDark ? '#777' : '#9E9588' }}>Cargando…</div>
  }
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

  const handleAsignar = () => alert('Pendiente: asignar responsable (próximo sprint)')

  const avatarLetra = (nombre: string) => (nombre[0] ?? '?').toUpperCase()
  const rolLabel = (r: RolUsuario) => (r === 'admin' ? 'Admin' : 'Cocina')

  return (
    <>
      <KpiGrid>
        <KpiCard
          label="Responsables asignados"
          value={conMarcas.length}
          sub={`${usuarios.length - conMarcas.length} sin marcas`}
          subTone="muted"
        />
        {gruposPorUsuario.slice(0, 2).map(g => (
          <KpiCard
            key={g.usuario.id}
            label={`Marcas · ${g.usuario.nombre}`}
            value={g.marcas.length}
            sub={`${g.activas.length} activa${g.activas.length !== 1 ? 's' : ''}`}
            subTone={g.activas.length > 0 ? 'pos' : 'muted'}
          />
        ))}
        <KpiCard
          label="Sin asignar"
          value={sinAsignar}
          sub={sinAsignar === 0 ? 'todas asignadas' : 'requiere asignación'}
          subTone={sinAsignar === 0 ? 'pos' : 'neg'}
        />
      </KpiGrid>

      <Toolbar>
        <Spacer />
        <BtnRed onClick={handleAsignar}>+ Asignar responsable</BtnRed>
      </Toolbar>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: conMarcas.length <= 2 ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(480px, 1fr))',
          gap: 14,
        }}
      >
        {conMarcas.length === 0 && (
          <BigCard title="Sin asignaciones">
            <div style={{ padding: 12, color: isDark ? '#777' : '#9E9588' }}>
              No hay marcas asignadas a ningún responsable todavía.
            </div>
          </BigCard>
        )}
        {conMarcas.map(g => {
          const tot = g.objetivoTotal
          return (
            <BigCard
              key={g.usuario.id}
              title={
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Avatar letter={avatarLetra(g.usuario.nombre)} color={g.usuario.avatar_color} />
                  <span
                    style={{
                      color: isDark ? '#fff' : '#1A1A1A',
                      fontFamily: 'Lexend, sans-serif',
                      fontWeight: 600,
                      textTransform: 'none',
                      letterSpacing: 'normal',
                      marginRight: 10,
                      fontSize: 14,
                    }}
                  >
                    {g.usuario.nombre}
                  </span>
                  <StatusTag variant={g.usuario.rol === 'admin' ? 'admin' : 'cocina'}>
                    {rolLabel(g.usuario.rol)}
                  </StatusTag>
                </span>
              }
              count={`${g.marcas.length} marca${g.marcas.length !== 1 ? 's' : ''}`}
            >
              <Table>
                <THead>
                  <tr>
                    <TH>Marca</TH>
                    <TH>Cocina</TH>
                    <TH num>Obj. mes</TH>
                    <TH>Estado</TH>
                  </tr>
                </THead>
                <TBody>
                  {g.marcas.map(m => (
                    <TR key={m.id}>
                      <TD bold>{m.nombre}</TD>
                      <TD muted>{m.cocina ?? '—'}</TD>
                      <TD num bold>{m.estado === 'pausada' ? '—' : fmtEur(m.objetivo_mes)}</TD>
                      <TD>
                        <StatusTag variant={m.estado === 'activa' ? 'ok' : 'off'}>
                          {m.estado === 'activa' ? 'Activa' : 'Pausada'}
                        </StatusTag>
                      </TD>
                    </TR>
                  ))}
                  <TotalTR>
                    <TD bold muted>TOTAL</TD>
                    <TD>—</TD>
                    <TD num bold>{fmtEur(tot)}</TD>
                    <TD muted>{g.activas.length}/{g.marcas.length} act.</TD>
                  </TotalTR>
                </TBody>
              </Table>
            </BigCard>
          )
        })}
      </div>
    </>
  )
}
