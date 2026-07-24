import { AZUL_CL, BLANCO, CREMA, GRANATE, INK, LIMA, NAR, VERDE } from '@/styles/neobrutal'
import { LIBRO_ESTADO_OK_BG, LIBRO_ESTADO_BAJA_BG, BADGE_PENDIENTE_BG, TABPORTAL_TODAY_BG } from '@/styles/palettes'
import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, tabActiveStyle, tabInactiveStyle } from '@/styles/tokens'
import { useAuth } from '@/context/AuthContext'
import ModalSolicitud from '@/components/equipo/ModalSolicitud'
import { fmtEur } from '@/utils/format'
import { HeroCantera, Papel, FrasePotente, PantallaCantera, SeccionLabel, SHADOW_DURA, Plancha, PlanchaCelda } from '@/components/kit/cantera'

type PortalTab = 'horario' | 'incentivos' | 'permisos' | 'nominas' | 'contrato'

interface Horario {
  id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  turno_tipo: string
}

interface Solicitud {
  id: string
  fecha_inicio: string
  fecha_fin: string
  tipo: string
  estado: string
  nota?: string
}

interface Nomina {
  id: string
  mes: number
  anio: number
  importe_bruto: number | null
  importe_neto: number | null
  pdf_url: string | null
}

interface IncentivoVista {
  facturacion_real: number
  facturacion_manual: boolean
  fact_min: number
  multiplicador: number
  muerte: boolean
  eur_reembolsos: number
  eur_inventario: number
  eur_retrasos: number
  eur_valoracion: number
  eur_vacio: number
  eur_checklist: number
  eur_fechado: number
  penalizacion: number
  tope_total: number
  total_pagar: number
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const TIPO_LABELS: Record<string, string> = {
  vacaciones: 'Vacaciones',
  asuntos_propios: 'Asuntos propios',
  baja_medica: 'Baja médica',
  permiso_retribuido: 'Permiso retribuido',
  otro: 'Otro',
}

export default function TabPortal() {
  const { T, isDark } = useTheme()
  const { usuario } = useAuth()
  const [activeTab, setActiveTab] = useState<PortalTab>('horario')
  const [empleado, setEmpleado] = useState<{ id: string; nombre: string; fecha_alta?: string; datos_personales?: Record<string, string>; drive_folder_id?: string } | null>(null)
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [nominas, setNominas] = useState<Nomina[]>([])
  const [incentivo, setIncentivo] = useState<IncentivoVista | null>(null)
  const [factAcum, setFactAcum] = useState(0)
  const [tramos, setTramos] = useState<{ fact_min: number; fact_t2: number; fact_t3: number; mult_n1: number; mult_n2: number; mult_n3: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalPermiso, setModalPermiso] = useState(false)
  const [listaEmpleados, setListaEmpleados] = useState<{ id: string; nombre: string }[]>([])
  const [selEmpleado, setSelEmpleado] = useState<string>('')

  const isAdmin = ['admin', 'socio'].includes(usuario?.perfil ?? usuario?.rol ?? '')
  const empleadoIdFromUser = (usuario as unknown as Record<string, unknown>)?.empleado_id as string | undefined
  const empIdEfectivo = empleadoIdFromUser ?? (isAdmin ? (selEmpleado || undefined) : undefined)

  useEffect(() => {
    if (isAdmin && !empleadoIdFromUser) {
      supabase.from('incentivos_empleado').select('empleado_id, empleados(nombre)').eq('activo', true).then(({ data }) => {
        setListaEmpleados(((data ?? []) as any[]).map(r => ({ id: r.empleado_id, nombre: r.empleados?.nombre ?? '—' })).sort((a, b) => a.nombre.localeCompare(b.nombre)))
      })
    }
  }, [isAdmin, empleadoIdFromUser])

  useEffect(() => {
    const empId = empIdEfectivo
    if (!empId) { setLoading(false); return }
    setLoading(true)

    const fetchData = async () => {
      const past14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const future30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const now = new Date()

      const [emp, h, s, n, inc] = await Promise.all([
        supabase.from('empleados').select('id, nombre, fecha_alta, datos_personales, drive_folder_id').eq('id', empId).maybeSingle(),
        supabase.from('horarios').select('id, fecha, hora_inicio, hora_fin, turno_tipo').eq('empleado_id', empId).gte('fecha', past14).lte('fecha', future30).order('fecha'),
        supabase.from('solicitudes_permisos').select('id, fecha_inicio, fecha_fin, tipo, estado, nota').eq('empleado_id', empId).order('created_at', { ascending: false }),
        supabase.from('nominas').select('id, mes, anio, importe_bruto, importe_neto, pdf_url').eq('empleado_id', empId).order('anio', { ascending: false }).order('mes', { ascending: false }),
        supabase.from('v_incentivos_total').select('*').eq('empleado_id', empId).eq('mes', now.getMonth() + 1).eq('anio', now.getFullYear()).maybeSingle(),
      ])

      const desdeMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const hastaMes = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10)
      const [ventas, cfgT] = await Promise.all([
        supabase.from('v_facturacion_diario_unificada').select('total_bruto').gte('fecha', desdeMes).lt('fecha', hastaMes),
        supabase.from('incentivos_config').select('fact_min, fact_t2, fact_t3, mult_n1, mult_n2, mult_n3').eq('id', 1).maybeSingle(),
      ])
      setFactAcum(((ventas.data ?? []) as any[]).reduce((acc, x) => acc + Number(x.total_bruto || 0), 0))
      setTramos((cfgT.data ?? null) as typeof tramos)

      setEmpleado(emp.data as typeof empleado ?? null)
      setHorarios((h.data ?? []) as Horario[])
      setSolicitudes((s.data ?? []) as Solicitud[])
      setNominas((n.data ?? []) as Nomina[])
      setIncentivo((inc.data ?? null) as IncentivoVista | null)
      setLoading(false)
    }
    fetchData()
  }, [empIdEfectivo])

  const tabs: { key: PortalTab; label: string }[] = [
    { key: 'horario', label: 'Mi horario' },
    { key: 'incentivos', label: 'Mis incentivos' },
    { key: 'permisos', label: 'Mis permisos' },
    { key: 'nominas', label: 'Mis nóminas' },
    { key: 'contrato', label: 'Mi contrato' },
  ]

  const td: React.CSSProperties = { padding: '10px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri }
  const th: React.CSSProperties = { ...td, fontFamily: FONT.heading, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', color: T.mut, background: T.group }

  const hoyISO = new Date().toISOString().slice(0, 10)
  const turnosFuturos = useMemo(() => horarios.filter(h => h.fecha >= hoyISO).length, [horarios, hoyISO])
  const pendientesPortal = useMemo(() => solicitudes.filter(s => s.estado === 'pendiente').length, [solicitudes])
  const mesActual = new Date().getMonth()

  // Realidad de hoy y previsión de cierre: siempre las dos, en casillas separadas.
  const hoyD = new Date()
  const diasMes = new Date(hoyD.getFullYear(), hoyD.getMonth() + 1, 0).getDate()
  const diasPasados = Math.min(hoyD.getDate(), diasMes)
  const ritmoDia = diasPasados > 0 ? factAcum / diasPasados : 0
  const factProy = ritmoDia * diasMes
  const multDe = (base: number) => {
    if (!tramos) return 0
    if (base >= Number(tramos.fact_t3)) return Number(tramos.mult_n3)
    if (base >= Number(tramos.fact_t2)) return Number(tramos.mult_n2)
    if (base >= Number(tramos.fact_min)) return Number(tramos.mult_n1)
    return 0
  }
  const baseManual = incentivo?.facturacion_manual ? Number(incentivo.facturacion_real) : null
  const multProy = multDe(baseManual ?? factProy)
  const multHoy = multDe(baseManual ?? factAcum)
  const conceptos = incentivo
    ? Number(incentivo.eur_reembolsos) + Number(incentivo.eur_inventario) + Number(incentivo.eur_retrasos) + Number(incentivo.eur_valoracion)
      + Number(incentivo.eur_vacio) + Number(incentivo.eur_checklist) + Number(incentivo.eur_fechado)
    : 0
  const totalCon = (mult: number) => !incentivo || incentivo.muerte || mult === 0
    ? 0
    : Math.min(Number(incentivo.tope_total), Math.max(0, conceptos - Number(incentivo.penalizacion)) * mult)
  const totalProy = totalCon(multProy)
  const totalHoy = totalCon(multHoy)

  // Admin sin empleado vinculado: selector de empleado para ver su portal
  const selectorAdmin = isAdmin && !empleadoIdFromUser ? (
    <Papel ceja={LIMA}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', color: INK, fontWeight: 700 }}>Ver portal como</div>
        <select value={selEmpleado} onChange={e => setSelEmpleado(e.target.value)}
          style={{ padding: '8px 12px', border: `2px solid ${INK}`, borderRadius: 0, background: BLANCO, color: INK, fontFamily: FONT.heading, fontSize: 13 }}>
          <option value="">— Elige empleado —</option>
          {listaEmpleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </div>
    </Papel>
  ) : null

  if (isAdmin && !empleadoIdFromUser && !selEmpleado) {
    return <PantallaCantera embedded>{selectorAdmin}</PantallaCantera>
  }

  // Guard: empleado sin empleado_id
  if (!isAdmin && !empleadoIdFromUser) {
    return (
      <PantallaCantera embedded>
        <Papel ceja={GRANATE}>
          <div style={{ fontFamily: FONT.heading, fontSize: 14, color: GRANATE }}>Sin acceso al Portal</div>
          <p style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, marginTop: 8 }}>Tu usuario no está vinculado a ningún empleado. Contacta con el administrador.</p>
        </Papel>
      </PantallaCantera>
    )
  }

  if (loading) return <PantallaCantera embedded><Papel ceja={GRANATE} style={{ textAlign: 'center', color: T.mut }}>Cargando portal…</Papel></PantallaCantera>

  return (
    <PantallaCantera embedded>
      {selectorAdmin}
      {empleado && (
        <HeroCantera
          area="equipo"
          titular={`Hola, ${empleado.nombre.split(' ')[0]}`}
          etiquetaDato="Hoy tienes ganado / vas camino de cobrar"
          cifra={incentivo ? `${Math.round(totalHoy)} € → ${Math.round(totalProy)} € [EST]` : '—'}
          resumen={incentivo
            ? <>La cocina lleva <b>{Math.round(factAcum).toLocaleString('es-ES')} €</b> en {diasPasados} días; al ritmo de hoy cerraría en <b>{Math.round(factProy).toLocaleString('es-ES')} €</b>. Se corrige cada día con lo que se factura de verdad.</>
            : 'Todavía no hay mediciones guardadas de este mes.'}
          atencion={[
            multHoy > 0 ? `Hoy ×${multHoy}` : 'Hoy el candado está cerrado',
            multProy > 0 ? `Previsión ×${multProy} [EST]` : 'Previsión: sigue cerrado',
            pendientesPortal > 0 ? `${pendientesPortal} solicitudes pendientes` : null,
            `${turnosFuturos} turnos próximos`,
          ]}
        />
      )}

      {pendientesPortal > 0 ? (
        <FrasePotente significado="oportunidad">Tienes {pendientesPortal} solicitud{pendientesPortal !== 1 ? 'es' : ''} de permiso esperando respuesta.</FrasePotente>
      ) : turnosFuturos === 0 ? (
        <FrasePotente significado="coste">No tienes turnos asignados en los próximos 30 días: contacta con tu responsable.</FrasePotente>
      ) : (
        <FrasePotente significado="logro">Todo en orden: turnos y solicitudes al día.</FrasePotente>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={activeTab === t.key ? tabActiveStyle(isDark) : tabInactiveStyle(T)}>{t.label}</button>
        ))}
      </div>

      {/* Mis incentivos */}
      {activeTab === 'incentivos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!incentivo ? (
            <Papel ceja={GRANATE}>
              <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec }}>Aún no hay mediciones de incentivos guardadas para {MESES[mesActual]}. En cuanto se guarden, verás aquí tu contador.</div>
            </Papel>
          ) : (
            <>
              <Plancha>
                <PlanchaCelda first bg={BLANCO}>
                  <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: INK }}>Realidad · llevamos hoy</div>
                  <div style={{ fontFamily: FONT.heading, fontSize: 30, fontWeight: 700, color: INK }}>{Math.round(factAcum).toLocaleString('es-ES')} €</div>
                  <div style={{ fontFamily: FONT.body, fontSize: 12, color: INK }}>{diasPasados} de {diasMes} días · {Math.round(ritmoDia).toLocaleString('es-ES')} €/día</div>
                </PlanchaCelda>
                <PlanchaCelda bg={multHoy > 0 && !incentivo.muerte ? VERDE : GRANATE} color={BLANCO}>
                  <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Con lo de hoy cobrarías</div>
                  <div style={{ fontFamily: FONT.heading, fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>{Math.round(totalHoy)} €</div>
                  <div style={{ fontFamily: FONT.body, fontSize: 12 }}>{incentivo.muerte ? 'Regla de muerte activada' : multHoy === 0 ? `Aún no se llega a ${Number(incentivo.fact_min).toLocaleString('es-ES')} €` : `Multiplicador ×${multHoy}`}</div>
                </PlanchaCelda>
                <PlanchaCelda bg={CREMA} color={INK}>
                  <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Previsión · cierre del mes</div>
                  <div style={{ fontFamily: FONT.heading, fontSize: 30, fontWeight: 700 }}>{Math.round(factProy).toLocaleString('es-ES')} € [EST]</div>
                  <div style={{ fontFamily: FONT.body, fontSize: 12 }}>El bote se abre a {Number(incentivo.fact_min).toLocaleString('es-ES')} €</div>
                </PlanchaCelda>
                <PlanchaCelda bg={multProy > 0 && !incentivo.muerte ? VERDE : GRANATE} color={BLANCO}>
                  <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Vas camino de cobrar</div>
                  <div style={{ fontFamily: FONT.heading, fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>{Math.round(totalProy)} € [EST]</div>
                  <div style={{ fontFamily: FONT.body, fontSize: 12 }}>{incentivo.muerte ? 'Regla de muerte activada' : multProy === 0 ? 'Al ritmo de hoy el mes cierra cerrado' : `Multiplicador ×${multProy} · tope ${Math.round(incentivo.tope_total)} €`}</div>
                </PlanchaCelda>
              </Plancha>

              <SeccionLabel bg={VERDE}>Cómo se compone tu incentivo</SeccionLabel>
              <Papel ceja={VERDE} pad="0">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {([
                      ['Colectivo · Reembolsos de clientes', incentivo.eur_reembolsos],
                      ['Colectivo · Inventario permanente', incentivo.eur_inventario],
                      ['Colectivo · Entregas a tiempo', incentivo.eur_retrasos],
                      ['Colectivo · Valoración de clientes', incentivo.eur_valoracion],
                      ['Individual · Vacío de cámara', incentivo.eur_vacio],
                      ['Individual · Checklists verificados', incentivo.eur_checklist],
                      ['Individual · Fechado y conservación', incentivo.eur_fechado],
                    ] as Array<[string, number]>).map(([label, eur], i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.brd}` }}>
                        <td style={{ ...td, color: INK }}>{label}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: FONT.heading, fontWeight: 700, color: Number(eur) > 0 ? VERDE : T.mut }}>{Math.round(Number(eur))} €</td>
                      </tr>
                    ))}
                    {Number(incentivo.penalizacion) > 0 && (
                      <tr style={{ borderBottom: `1px solid ${T.brd}` }}>
                        <td style={{ ...td, color: GRANATE, fontWeight: 600 }}>Penalización por tardes</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: FONT.heading, fontWeight: 700, color: GRANATE }}>−{Math.round(Number(incentivo.penalizacion))} €</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Papel>
              <div style={{ fontFamily: FONT.body, fontSize: 12, color: INK }}>
                Lo marcado [EST] es la previsión con el ritmo de ventas de este mes; se corrige cada día y el pago final se calcula con el mes cerrado. Cero reembolsos suma premio extra. Una cancelación de pedido o un cierre de tienda deja el incentivo a 0 € para toda la cocina.
              </div>
            </>
          )}
        </div>
      )}

      {/* Mi horario */}
      {activeTab === 'horario' && (
        <div>
          <p style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginBottom: 12 }}>Vista lectura · 14 días atrás + 30 días adelante</p>
          {horarios.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin turnos asignados en este periodo.</div>
          ) : (
            <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.brd}` }}>
                    <th style={th}>Fecha</th>
                    <th style={th}>Turno</th>
                    <th style={th}>Horario</th>
                  </tr>
                </thead>
                <tbody>
                  {horarios.map(h => {
                    const isToday = h.fecha === new Date().toISOString().slice(0, 10)
                    const isFuture = h.fecha > new Date().toISOString().slice(0, 10)
                    return (
                      <tr key={h.id} style={{ borderBottom: `1px solid ${T.brd}`, background: isToday ? TABPORTAL_TODAY_BG : 'transparent' }}>
                        <td style={{ ...td, fontWeight: isToday ? 700 : 400, color: isToday ? GRANATE : isFuture ? T.pri : T.sec }}>
                          {new Date(h.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
                          {isToday && <span style={{ marginLeft: 8, fontSize: 10, color: GRANATE, fontFamily: FONT.heading }}>HOY</span>}
                        </td>
                        <td style={td}>
                          <span style={{
                            padding: '3px 8px', borderRadius: 0, fontSize: 10,
                            background: h.turno_tipo === 'comida' ? LIBRO_ESTADO_OK_BG : BADGE_PENDIENTE_BG,
                            color: h.turno_tipo === 'comida' ? VERDE : NAR,
                            fontFamily: FONT.heading, letterSpacing: '1px', textTransform: 'uppercase',
                          }}>
                            {h.turno_tipo}
                          </span>
                        </td>
                        <td style={{ ...td, fontFamily: 'monospace' }}>{h.hora_inicio} – {h.hora_fin}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Papel>
          )}
        </div>
      )}

      {/* Mis permisos */}
      {activeTab === 'permisos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={() => setModalPermiso(true)} style={{ padding: '8px 16px', border: `3px solid ${INK}`, boxShadow: SHADOW_DURA, borderRadius: 0, background: LIMA, color: INK, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer' }}>
              + Solicitar permiso
            </button>
          </div>
          {solicitudes.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin solicitudes de permisos.</div>
          ) : (
            <Papel ceja={GRANATE} pad="0">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: `1px solid ${T.brd}` }}><th style={th}>Periodo</th><th style={th}>Tipo</th><th style={th}>Estado</th><th style={th}>Nota</th></tr></thead>
                <tbody>
                  {solicitudes.map(s => (
                    <tr key={s.id} style={{ borderBottom: `1px solid ${T.brd}` }}>
                      <td style={{ ...td, fontSize: 12 }}>{s.fecha_inicio === s.fecha_fin ? s.fecha_inicio : `${s.fecha_inicio} → ${s.fecha_fin}`}</td>
                      <td style={td}>{TIPO_LABELS[s.tipo] ?? s.tipo}</td>
                      <td style={td}>
                        <span style={{ padding: '3px 8px', borderRadius: 0, fontSize: 10, fontFamily: FONT.heading, letterSpacing: '1px', textTransform: 'uppercase', background: s.estado === 'aprobado' ? LIBRO_ESTADO_OK_BG : s.estado === 'rechazado' ? LIBRO_ESTADO_BAJA_BG : BADGE_PENDIENTE_BG, color: s.estado === 'aprobado' ? VERDE : s.estado === 'rechazado' ? GRANATE : NAR }}>
                          {s.estado}
                        </span>
                      </td>
                      <td style={{ ...td, color: T.mut, fontSize: 12 }}>{s.nota || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Papel>
          )}
        </div>
      )}

      {/* Mis nóminas */}
      {activeTab === 'nominas' && (
        <div>
          {nominas.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin nóminas registradas.</div>
          ) : (
            <Papel ceja={GRANATE} pad="0">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: `1px solid ${T.brd}` }}><th style={th}>Periodo</th><th style={th}>Bruto</th><th style={th}>Neto</th><th style={th}>PDF</th></tr></thead>
                <tbody>
                  {nominas.map(n => (
                    <tr key={n.id} style={{ borderBottom: `1px solid ${T.brd}` }}>
                      <td style={td}>{MESES[n.mes - 1]} {n.anio}</td>
                      <td style={{ ...td, color: T.sec }}>{fmtEur(n.importe_bruto)}</td>
                      <td style={{ ...td, color: VERDE, fontWeight: 600 }}>{fmtEur(n.importe_neto)}</td>
                      <td style={td}>
                        {n.pdf_url ? (
                          <a href={n.pdf_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: AZUL_CL, fontSize: 12, textDecoration: 'none' }}>
                            <Download size={12} /> Descargar
                          </a>
                        ) : <span style={{ color: T.mut, fontSize: 12 }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Papel>
          )}
        </div>
      )}

      {/* Mi contrato */}
      {activeTab === 'contrato' && (
        <Papel ceja={GRANATE} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut }}>Información de contrato</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 4 }}>Fecha de alta</div>
              <div style={{ fontFamily: FONT.body, fontSize: 14, color: T.pri }}>{empleado?.fecha_alta ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 4 }}>Tipo de contrato</div>
              <div style={{ fontFamily: FONT.body, fontSize: 14, color: T.pri }}>{empleado?.datos_personales?.contrato ?? '—'}</div>
            </div>
          </div>
          {empleado?.drive_folder_id ? (
            <div>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>Documentos en Drive</div>
              <a
                href={`https://drive.google.com/drive/folders/${empleado.drive_folder_id}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 0, background: INK, border: `1px solid ${T.brd}`, color: AZUL_CL, textDecoration: 'none', fontFamily: FONT.body, fontSize: 13 }}
              >
                Abrir carpeta Drive
              </a>
            </div>
          ) : (
            <div style={{ color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>Carpeta Drive no configurada. Contacta con el administrador.</div>
          )}
        </Papel>
      )}

      {/* Modal solicitud permiso */}
      {modalPermiso && empIdEfectivo && (
        <ModalSolicitud
          empleados={empleado ? [{ id: empleado.id, nombre: empleado.nombre }] : []}
          empleadoPreseleccionado={empIdEfectivo}
          onClose={() => setModalPermiso(false)}
          onSaved={() => {
            setModalPermiso(false)
            const empId = empIdEfectivo
            if (empId) {
              supabase.from('solicitudes_permisos').select('id, fecha_inicio, fecha_fin, tipo, estado, nota').eq('empleado_id', empId).order('created_at', { ascending: false }).then(({ data }) => setSolicitudes((data ?? []) as Solicitud[]))
            }
          }}
        />
      )}
    </PantallaCantera>
  )
}
