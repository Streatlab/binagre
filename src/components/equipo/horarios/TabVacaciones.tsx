import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { useMultiSort } from '@/hooks/useMultiSort'
import SortableHeader, { ClearSortButton } from '@/components/ui/SortableHeader'

interface Empleado { id: string; nombre: string }
interface Solicitud {
  id: string
  empleado_id: string
  fecha_inicio: string
  fecha_fin: string
  tipo: string
  estado: 'pendiente' | 'aprobado' | 'rechazado'
  nota?: string
  created_at: string
}

type FiltroEstado = 'todas' | 'pendiente' | 'aprobado' | 'rechazado'
type Col = 'empleado' | 'periodo' | 'tipo' | 'estado' | 'nota'

const TIPO_LABELS: Record<string, string> = {
  vacaciones: 'Vacaciones',
  asuntos_propios: 'Asuntos propios',
  baja_medica: 'Baja médica',
  permiso_retribuido: 'Permiso retribuido',
  otro: 'Otro',
}

const ESTADO_ORDEN: Record<string, number> = { pendiente: 0, aprobado: 1, rechazado: 2 }

function estadoBadge(estado: Solicitud['estado']) {
  if (estado === 'aprobado') return { color: '#1D9E75', bg: '#1D9E7520', icon: <CheckCircle size={12} />, label: 'Aprobado' }
  if (estado === 'rechazado') return { color: '#B01D23', bg: '#B01D2320', icon: <XCircle size={12} />, label: 'Rechazado' }
  return { color: '#f5a623', bg: '#f5a62320', icon: <Clock size={12} />, label: 'Pendiente' }
}

export default function TabVacaciones() {
  const { T } = useTheme()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<FiltroEstado>('todas')

  const { handleSort, clearSorts, sortIndex, sortDir, applySort, showClearButton } =
    useMultiSort<Solicitud, Col>({ defaultSorts: [{ col: 'periodo', dir: 'desc' }] })

  useEffect(() => {
    Promise.all([
      supabase.from('empleados').select('id,nombre').eq('estado', 'activo').order('nombre'),
      supabase.from('solicitudes_permisos').select('*').order('fecha_inicio', { ascending: false }),
    ]).then(([e, s]) => {
      setEmpleados((e.data ?? []) as Empleado[])
      setSolicitudes((s.data ?? []) as Solicitud[])
      setLoading(false)
    })
  }, [])

  const empNombre = (id: string) => empleados.find(e => e.id === id)?.nombre ?? id

  const filtradas = useMemo(
    () => filtro === 'todas' ? solicitudes : solicitudes.filter(s => s.estado === filtro),
    [filtro, solicitudes]
  )

  const filasOrden = applySort(filtradas, {
    empleado: s => empNombre(s.empleado_id),
    periodo: s => s.fecha_inicio,
    tipo: s => TIPO_LABELS[s.tipo] ?? s.tipo,
    estado: s => ESTADO_ORDEN[s.estado] ?? 99,
    nota: s => s.nota ?? '',
  })

  const td: React.CSSProperties = { padding: '12px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri }

  const filtros: { key: FiltroEstado; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'pendiente', label: 'Pendientes' },
    { key: 'aprobado', label: 'Aprobadas' },
    { key: 'rechazado', label: 'Rechazadas' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {filtros.map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            style={{ padding: '6px 14px', borderRadius: 6, border: `0.5px solid ${T.brd}`, background: filtro === f.key ? '#FF4757' : T.card, color: filtro === f.key ? '#fff' : T.sec, fontFamily: FONT.body, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            {f.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <ClearSortButton show={showClearButton} onClear={clearSorts} />
        </div>
      </div>

      <div style={{ ...cardStyle(T), padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <SortableHeader col="empleado" label="Empleado" sortIndex={sortIndex('empleado')} sortDir={sortDir('empleado')} onToggle={handleSort} />
                <SortableHeader col="periodo"  label="Periodo"  sortIndex={sortIndex('periodo')}  sortDir={sortDir('periodo')}  onToggle={handleSort} />
                <SortableHeader col="tipo"     label="Tipo"     sortIndex={sortIndex('tipo')}     sortDir={sortDir('tipo')}     onToggle={handleSort} />
                <SortableHeader col="estado"   label="Estado"   sortIndex={sortIndex('estado')}   sortDir={sortDir('estado')}   onToggle={handleSort} />
                <SortableHeader col="nota"     label="Nota"     sortIndex={sortIndex('nota')}     sortDir={sortDir('nota')}     onToggle={handleSort} />
              </tr>
            </thead>
            <tbody>
              {filasOrden.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '40px 24px', textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin solicitudes.</td></tr>
              ) : filasOrden.map(sol => {
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
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
