import { BLANCO, BORDE_SUAVE, CLARO, GRANATE, INK, LIMA, NAR, VERDE } from '@/styles/neobrutal'
import { LIBRO_ESTADO_OK_BG, LIBRO_ESTADO_BAJA_BG, BADGE_PENDIENTE_BG } from '@/styles/palettes'
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import ModalSolicitud from '@/components/equipo/ModalSolicitud'
import { syncRango } from '@/utils/calendarioOperativoSync'
import { useAuth } from '@/context/AuthContext'
import { HeroCantera, Papel, FrasePotente, PantallaCantera, SHADOW_DURA } from '@/components/kit/cantera'
import * as M from '@/lib/marcoDoc'
import BotonImprimir from '@/components/BotonImprimir'

interface Empleado { id: string; nombre: string }
interface Solicitud {
  id: string
  empleado_id: string
  fecha_inicio: string
  fecha_fin: string
  tipo: string
  estado: 'pendiente' | 'aprobado' | 'rechazado'
  nota?: string
  aprobado_por?: string
  created_at: string
}

type FiltroEstado = 'todas' | 'pendiente' | 'aprobado' | 'rechazado'

const TIPO_LABELS: Record<string, string> = {
  vacaciones: 'Vacaciones',
  asuntos_propios: 'Asuntos propios',
  baja_medica: 'Baja médica',
  permiso_retribuido: 'Permiso retribuido',
  otro: 'Otro',
}

// Mapa tipo solicitud → tipo evento_laboral
const TIPO_EVENTO: Record<string, string> = {
  vacaciones: 'vacaciones',
  asuntos_propios: 'asuntos_propios',
  baja_medica: 'baja_medica',
  permiso_retribuido: 'permiso_retribuido',
  otro: 'asuntos_propios',
}

function estadoBadge(estado: Solicitud['estado']) {
  if (estado === 'aprobado') return { color: VERDE, bg: LIBRO_ESTADO_OK_BG, icon: <CheckCircle size={12} />, label: 'Aprobado' }
  if (estado === 'rechazado') return { color: GRANATE, bg: LIBRO_ESTADO_BAJA_BG, icon: <XCircle size={12} />, label: 'Rechazado' }
  return { color: NAR, bg: BADGE_PENDIENTE_BG, icon: <Clock size={12} />, label: 'Pendiente' }
}

// ─── FASE 2: PDF con el marco único (área 'equipo') — botón Imprimir ────────
const AREA: M.Area = 'equipo'
const ESTADO_LABEL: Record<Solicitud['estado'], string> = { aprobado: 'Aprobado', rechazado: 'Rechazado', pendiente: 'Pendiente' }

/** Hoja de permisos / vacaciones con las solicitudes visibles en pantalla (filtro aplicado). Sin filas → null. */
function construirPermisosPDF(solicitudes: Solicitud[], empNombre: (id: string) => string, filtroLabel: string, rec: M.Recursos, bn = false) {
  if (solicitudes.length === 0) return null

  const doc = M.nuevaHoja({ orientation: 'portrait' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA, bn)
  const cb = M.contentBox(doc)

  const xEmp = cb.x0 + 1.5
  const xPeriodo = cb.x0 + cb.w * 0.30
  const xTipo = cb.x0 + cb.w * 0.58
  const xEstado = cb.x1 - 1.5

  const nuevaPagina = () => {
    M.pintarEspina(doc, AREA, ctx, bn)
    return M.pintarCabecera(doc, ctx, { docNombre: 'Hoja de Permisos', meta: filtroLabel, area: AREA, bn })
  }
  let y = nuevaPagina()

  doc.setFillColor(pal.soft2[0], pal.soft2[1], pal.soft2[2]); doc.rect(cb.x0, y, cb.w, 6, 'F')
  M.fTitulo(doc, ctx, true); doc.setFontSize(8); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
  doc.text('Empleado', xEmp, y + 4.2)
  doc.text('Periodo', xPeriodo, y + 4.2)
  doc.text('Tipo', xTipo, y + 4.2)
  doc.text('Estado', xEstado, y + 4.2, { align: 'right' })
  y += 6

  for (const sol of solicitudes) {
    if (y > cb.bottom - 6) { doc.addPage(); y = nuevaPagina() }
    doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.1); doc.line(cb.x0, y + 4.6, cb.x1, y + 4.6)
    M.fDato(doc, ctx, true); doc.setFontSize(9); doc.setTextColor(...M.TINTA)
    doc.text(empNombre(sol.empleado_id), xEmp, y + 3.6)
    M.fDato(doc, ctx, false); doc.setTextColor(...M.GRIS)
    doc.text(sol.fecha_inicio === sol.fecha_fin ? sol.fecha_inicio : `${sol.fecha_inicio} → ${sol.fecha_fin}`, xPeriodo, y + 3.6)
    doc.setTextColor(...M.TINTA)
    doc.text(TIPO_LABELS[sol.tipo] ?? sol.tipo, xTipo, y + 3.6)
    doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
    doc.text(ESTADO_LABEL[sol.estado], xEstado, y + 3.6, { align: 'right' })
    y += 4.8
  }

  const totalPag = doc.getNumberOfPages()
  for (let p = 1; p <= totalPag; p++) { doc.setPage(p); M.pintarPaginado(doc, p, totalPag, ctx) }
  return doc
}

export default function TabPermisos() {
  const { T, isDark: _isDark } = useTheme()
  const { usuario } = useAuth()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<FiltroEstado>('todas')
  const [modalOpen, setModalOpen] = useState(false)
  const [notaRej, setNotaRej] = useState<{ id: string; nota: string } | null>(null)

  const isAdmin = ['admin', 'socio'].includes(usuario?.perfil ?? usuario?.rol ?? '')

  async function fetchAll() {
    const [e, s] = await Promise.all([
      supabase.from('empleados').select('id, nombre').eq('estado', 'activo').order('nombre'),
      supabase.from('solicitudes_permisos').select('*').order('created_at', { ascending: false }),
    ])
    setEmpleados((e.data ?? []) as Empleado[])
    setSolicitudes((s.data ?? []) as Solicitud[])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  async function aprobar(id: string) {
    const sol = solicitudes.find(s => s.id === id)
    if (!sol) return
    const { error } = await supabase.from('solicitudes_permisos').update({
      estado: 'aprobado',
      aprobado_por: usuario?.id ?? null,
    }).eq('id', id)
    if (error) { alert('Error: ' + error.message); return }

    // Insertar eventos_laborales para cada fecha del rango
    const fechas: string[] = []
    const cur = new Date(sol.fecha_inicio + 'T12:00:00')
    const end = new Date(sol.fecha_fin + 'T12:00:00')
    while (cur <= end) {
      fechas.push(cur.toISOString().slice(0, 10))
      cur.setDate(cur.getDate() + 1)
    }
    const tipoEvento = TIPO_EVENTO[sol.tipo] ?? 'asuntos_propios'
    await supabase.from('eventos_laborales').insert(
      fechas.map(f => ({ empleado_id: sol.empleado_id, fecha: f, tipo: tipoEvento, nota: `Permiso aprobado: ${sol.id}` }))
    )

    // Sync calendario operativo
    await syncRango(sol.fecha_inicio, sol.fecha_fin)

    await fetchAll()
  }

  async function rechazar(id: string, nota: string) {
    const { error } = await supabase.from('solicitudes_permisos').update({
      estado: 'rechazado',
      nota: nota || null,
      aprobado_por: usuario?.id ?? null,
    }).eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    setNotaRej(null)
    await fetchAll()
  }

  async function revocarAprobacion(id: string) {
    const sol = solicitudes.find(s => s.id === id)
    if (!sol) return
    // Revertir estado
    await supabase.from('solicitudes_permisos').update({ estado: 'pendiente', aprobado_por: null }).eq('id', id)
    // Eliminar eventos laborales creados por este permiso
    await supabase.from('eventos_laborales').delete().like('nota', `%${id}%`)
    // Revertir calendario operativo
    await syncRango(sol.fecha_inicio, sol.fecha_fin)
    await fetchAll()
  }

  const filtradas = filtro === 'todas' ? solicitudes : solicitudes.filter(s => s.estado === filtro)
  const empNombre = (id: string) => empleados.find(e => e.id === id)?.nombre ?? id

  const th: React.CSSProperties = { padding: '10px 14px', fontFamily: FONT.heading, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', color: T.mut, fontWeight: 400, background: T.group, textAlign: 'left' }
  const td: React.CSSProperties = { padding: '12px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri }

  const filtros: { key: FiltroEstado; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'pendiente', label: 'Pendientes' },
    { key: 'aprobado', label: 'Aprobadas' },
    { key: 'rechazado', label: 'Rechazadas' },
  ]

  const pendientesCount = useMemo(() => solicitudes.filter(s => s.estado === 'pendiente').length, [solicitudes])

  return (
    <PantallaCantera embedded>
      <HeroCantera
        area="equipo"
        titular={pendientesCount > 0
          ? `Tienes ${pendientesCount} permiso${pendientesCount !== 1 ? 's' : ''} pendiente${pendientesCount !== 1 ? 's' : ''} de revisar`
          : 'No hay permisos pendientes de revisar'}
        etiquetaDato="Solicitudes pendientes"
        cifra={String(pendientesCount)}
        resumen={<>{solicitudes.length} solicitud{solicitudes.length !== 1 ? 'es' : ''} registrada{solicitudes.length !== 1 ? 's' : ''} en total.</>}
        atencion={[pendientesCount > 0 ? `${pendientesCount} pendientes` : null, `${solicitudes.length} totales`]}
      />

      {pendientesCount > 0 ? (
        <FrasePotente significado="oportunidad">Hay {pendientesCount} solicitud{pendientesCount !== 1 ? 'es' : ''} esperando aprobación: revísalas antes de que se acumulen.</FrasePotente>
      ) : (
        <FrasePotente significado="logro">Todas las solicitudes de permisos están al día.</FrasePotente>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8 }}>
          {filtros.map(f => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              style={{
                padding: '6px 14px', border: `2px solid ${INK}`, borderRadius: 0,
                background: filtro === f.key ? GRANATE : BLANCO,
                color: filtro === f.key ? BLANCO : T.sec,
                fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <BotonImprimir
            compacto
            documentoId="equipo.permisos_vacaciones"
            titulo={`Hoja de permisos / vacaciones · ${filtros.find(f => f.key === filtro)?.label ?? ''}`}
            generarPdf={async opts => {
              const rec = await M.cargarRecursos()
              const filtroLabel = filtros.find(f => f.key === filtro)?.label ?? 'Todas'
              return construirPermisosPDF(filtradas, empNombre, filtroLabel, rec, opts.bn)
            }}
          />
          <button
            onClick={() => setModalOpen(true)}
            style={{ padding: '8px 16px', border: `3px solid ${INK}`, boxShadow: SHADOW_DURA, borderRadius: 0, background: LIMA, color: INK, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer' }}
          >
            + Solicitar permiso
          </button>
        </div>
      </div>

      {loading ? (
        <Papel ceja={GRANATE} style={{ textAlign: 'center', color: T.mut }}>Cargando…</Papel>
      ) : (
        <Papel ceja={GRANATE} pad="0" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.brd}` }}>
                <th style={th}>Empleado</th>
                <th style={th}>Periodo</th>
                <th style={th}>Tipo</th>
                <th style={th}>Estado</th>
                <th style={th}>Nota</th>
                {isAdmin && <th style={{ ...th, textAlign: 'right' }}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr><td colSpan={isAdmin ? 6 : 5} style={{ padding: '40px 24px', textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin solicitudes.</td></tr>
              ) : filtradas.map(sol => {
                const badge = estadoBadge(sol.estado)
                return (
                  <tr key={sol.id} style={{ borderBottom: `1px solid ${T.brd}` }}>
                    <td style={{ ...td, fontWeight: 600 }}>{empNombre(sol.empleado_id)}</td>
                    <td style={{ ...td, fontSize: 12, color: T.sec }}>
                      {sol.fecha_inicio === sol.fecha_fin ? sol.fecha_inicio : `${sol.fecha_inicio} → ${sol.fecha_fin}`}
                    </td>
                    <td style={td}>{TIPO_LABELS[sol.tipo] ?? sol.tipo}</td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 0, background: badge.bg, color: badge.color, fontSize: 10, fontFamily: FONT.heading, letterSpacing: '1px', textTransform: 'uppercase' }}>
                        {badge.icon}{badge.label}
                      </span>
                    </td>
                    <td style={{ ...td, fontSize: 12, color: T.mut }}>{sol.nota || '—'}</td>
                    {isAdmin && (
                      <td style={{ ...td, textAlign: 'right' }}>
                        {sol.estado === 'pendiente' && (
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button onClick={() => aprobar(sol.id)} style={{ padding: '5px 10px', borderRadius: 0, border: 'none', background: VERDE, color: BLANCO, fontFamily: FONT.heading, fontSize: 10, cursor: 'pointer', letterSpacing: '1px' }}>Aprobar</button>
                            <button onClick={() => setNotaRej({ id: sol.id, nota: '' })} style={{ padding: '5px 10px', borderRadius: 0, border: `1px solid ${T.brd}`, background: T.card, color: GRANATE, fontFamily: FONT.heading, fontSize: 10, cursor: 'pointer', letterSpacing: '1px' }}>Rechazar</button>
                          </div>
                        )}
                        {sol.estado === 'aprobado' && (
                          <button onClick={() => revocarAprobacion(sol.id)} style={{ padding: '5px 10px', borderRadius: 0, border: `1px solid ${T.brd}`, background: T.card, color: T.mut, fontFamily: FONT.heading, fontSize: 10, cursor: 'pointer' }}>Revocar</button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Papel>
      )}

      {/* Modal rechazo con nota */}
      {notaRej && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: INK, borderRadius: 0, border: `1px solid ${T.brd}`, width: 380, padding: 24, boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 14, color: T.pri, marginBottom: 14, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Rechazar solicitud</div>
            <textarea
              placeholder="Motivo del rechazo (obligatorio)…"
              value={notaRej.nota}
              onChange={e => setNotaRej(n => n ? { ...n, nota: e.target.value } : null)}
              style={{ width: '100%', padding: '8px 10px', background: INK, border: `1px solid ${T.brd}`, borderRadius: 0, color: T.pri, fontFamily: FONT.body, fontSize: 13, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button onClick={() => setNotaRej(null)} style={{ padding: '7px 14px', borderRadius: 0, border: `1px solid ${T.brd}`, background: CLARO, color: T.pri, fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Cancelar</button>
              <button
                onClick={() => rechazar(notaRej.id, notaRej.nota)}
                disabled={!notaRej.nota.trim()}
                style={{ padding: '7px 16px', borderRadius: 0, border: 'none', background: GRANATE, color: BLANCO, fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', cursor: notaRej.nota.trim() ? 'pointer' : 'not-allowed', opacity: notaRej.nota.trim() ? 1 : 0.5 }}
              >
                Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <ModalSolicitud
          empleados={empleados}
          onClose={() => setModalOpen(false)}
          onSaved={() => { fetchAll(); setModalOpen(false) }}
        />
      )}
    </PantallaCantera>
  )
}
