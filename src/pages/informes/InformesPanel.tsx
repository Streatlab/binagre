/**
 * Módulo Informes — Panel principal
 * CANTERA ALEGRE v1.0 (área Equipo · tinta). Solo capa visual; NADA de lógica de
 * envío/robots/WhatsApp/crons se toca — cargar(), enviarManual(), abrirModalWhatsApp(),
 * toggleSeleccion(), toggleTodos(), confirmarEnvioWhatsApp() y toggleActivo() intactas.
 *
 * Estado de los informes automáticos: resumen mañana, pulso tarde,
 * cierre diario, cobros lunes, cierre semanal, cierre mensual.
 * Permite enviar manualmente (eligiendo WhatsApp o Email) y ver historial reciente.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { INK, GRIS, OSW, LEX, VERDE, ROJO, GRANATE, AMA, BLANCO } from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, Papel, PantallaCantera, SeccionLabel, SHADOW_DURA } from '@/components/kit/cantera'

type TipoInforme = 'cierre_diario' | 'cobros_lunes' | 'cierre_semanal' | 'cierre_mensual' | 'resumen_manana' | 'pulso'

interface InformeConfig {
  id: string
  tipo: TipoInforme
  nombre: string
  descripcion: string
  cron_schedule: string
  activo: boolean
  enviar_whatsapp: boolean
  enviar_email: boolean
  ultima_ejecucion: string | null
  proxima_ejecucion: string | null
}

interface EnvioReciente {
  id: string
  tipo: TipoInforme
  destinatario_nombre: string | null
  canal: 'whatsapp' | 'email'
  destino: string
  estado: 'pendiente' | 'enviado' | 'fallido'
  enviado_at: string | null
  created_at: string
}

const ICONOS: Record<string, string> = {
  resumen_manana: '☀️',
  pulso: '⏱',
  cierre_diario: '📅',
  cobros_lunes: '💰',
  cierre_semanal: '📊',
  cierre_mensual: '📈',
}

const HORARIOS_LEGIBLES: Record<string, string> = {
  resumen_manana: 'Todos los días · 08:00',
  pulso: 'Todos los días · 16:30',
  cierre_diario: 'Lun-Sáb · 23:29',
  cobros_lunes: 'Lunes · 09:00',
  cierre_semanal: 'Domingo · 23:30',
  cierre_mensual: 'Día 1 · 09:00',
}

// Orden de presentación: cronológico dentro del día
const ORDEN_TIPOS: string[] = ['resumen_manana', 'cobros_lunes', 'cierre_mensual', 'pulso', 'cierre_diario', 'cierre_semanal']

// Columna de notif_destinatarios que indica si recibe cada informe
const FLAG_INFORME: Record<TipoInforme, string> = {
  cierre_diario: 'recibe_cierre_diario',
  cobros_lunes: 'recibe_cobros_lunes',
  cierre_semanal: 'recibe_cierre_semanal',
  cierre_mensual: 'recibe_cierre_mensual',
  resumen_manana: 'recibe_resumen_manana',
  pulso: 'recibe_pulso',
}

interface DestinatarioWA { id: string; nombre: string; whatsapp: string }
interface ModalWA { tipo: TipoInforme; cargando: boolean; lista: DestinatarioWA[]; seleccion: Set<string> }

export default function InformesPanel() {
  const navigate = useNavigate()
  const [configs, setConfigs] = useState<InformeConfig[]>([])
  const [envios, setEnvios] = useState<EnvioReciente[]>([])
  const [enviando, setEnviando] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalWA, setModalWA] = useState<ModalWA | null>(null)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    const { data: c } = await supabase
      .from('notif_config')
      .select('*')
    const ordenadas = (c || []).sort((a: InformeConfig, b: InformeConfig) => {
      const ia = ORDEN_TIPOS.indexOf(a.tipo)
      const ib = ORDEN_TIPOS.indexOf(b.tipo)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    const { data: e } = await supabase
      .from('notif_envios')
      .select('id, tipo, destinatario_nombre, canal, destino, estado, enviado_at, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    setConfigs(ordenadas)
    setEnvios(e || [])
    setLoading(false)
  }

  async function enviarManual(tipo: TipoInforme, canales: { whatsapp?: boolean; email?: boolean }, destinatarioIds?: string[]) {
    if (enviando) return
    const key = `${tipo}:${canales.whatsapp ? 'wa' : ''}${canales.email ? 'em' : ''}`
    setEnviando(key)
    try {
      const res = await fetch('/api/informes/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, canales, destinatarioIds }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert('Error: ' + (json.error || 'desconocido'))
      } else if ((json.enviados || 0) === 0 && (json.fallidos || 0) === 0) {
        alert('No se envió a nadie. Revisa que haya destinatarios con ese canal activado para este informe.')
      } else if ((json.fallidos || 0) > 0) {
        const motivos = (json.detalle || [])
          .filter((d: any) => !d.ok)
          .map((d: any) => `• ${d.destinatario} (${d.canal}): ${d.error || 'error'}`)
          .join('\n')
        alert(`Enviados: ${json.enviados || 0}  ·  Fallidos: ${json.fallidos || 0}\n\nMotivo:\n${motivos}`)
        cargar()
      } else {
        // Envío correcto: sin aviso, solo refrescamos el historial de "Últimos envíos"
        cargar()
      }
    } catch (err) {
      alert('Error de red: ' + (err as Error).message)
    } finally {
      setEnviando(null)
    }
  }

  // Modal de selección de destinatarios (solo WhatsApp)
  async function abrirModalWhatsApp(tipo: TipoInforme) {
    if (enviando) return
    setModalWA({ tipo, cargando: true, lista: [], seleccion: new Set() })
    const flag = FLAG_INFORME[tipo]
    let q = supabase
      .from('notif_destinatarios')
      .select('id, nombre, whatsapp')
      .eq('activo', true)
      .eq('canal_whatsapp', true)
      .eq(flag, true)
    const { data } = await q
    const lista = (data || []).filter((d: any) => d.whatsapp) as DestinatarioWA[]
    setModalWA({ tipo, cargando: false, lista, seleccion: new Set(lista.map(d => d.id)) })
  }

  function toggleSeleccion(id: string) {
    setModalWA(prev => {
      if (!prev) return prev
      const s = new Set(prev.seleccion)
      s.has(id) ? s.delete(id) : s.add(id)
      return { ...prev, seleccion: s }
    })
  }

  function toggleTodos() {
    setModalWA(prev => {
      if (!prev) return prev
      const todos = prev.seleccion.size === prev.lista.length
      return { ...prev, seleccion: todos ? new Set() : new Set(prev.lista.map(d => d.id)) }
    })
  }

  async function confirmarEnvioWhatsApp() {
    if (!modalWA) return
    const ids = Array.from(modalWA.seleccion)
    const tipo = modalWA.tipo
    setModalWA(null)
    if (ids.length === 0) return
    await enviarManual(tipo, { whatsapp: true }, ids)
  }

  async function toggleActivo(id: string, activo: boolean) {
    await supabase.from('notif_config').update({ activo: !activo }).eq('id', id)
    cargar()
  }

  // ── Datos de estado para el héroe (agregados de lo ya cargado, nada inventado) ──
  const activos = configs.filter(c => c.activo).length
  const ultimaEjecucion = configs.reduce<string | null>((max, c) => {
    if (!c.ultima_ejecucion) return max
    if (!max || c.ultima_ejecucion > max) return c.ultima_ejecucion
    return max
  }, null)
  const titular = configs.length === 0
    ? 'Sin informes automáticos configurados todavía.'
    : <>{activos} de {configs.length} informes automáticos activos, enviando por WhatsApp y email.</>

  return (
    <PantallaCantera>
      {/* 1 · Héroe del área Equipo (tinta) */}
      <HeroCantera
        area="equipo"
        titular={titular}
        etiquetaDato="Últimos envíos registrados"
        cifra={envios.length.toLocaleString('es-ES')}
        resumen={ultimaEjecucion ? <>Última ejecución: <b>{new Date(ultimaEjecucion).toLocaleString('es-ES')}</b></> : undefined}
      />

      {/* Filtros planos: atajos de navegación */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/informes/destinatarios')} style={filtroBtn}>👥 Gestionar destinatarios</button>
        <button onClick={() => navigate('/informes/historial')} style={filtroBtn}>🕒 Ver historial completo</button>
        <button onClick={() => navigate('/informes/configuracion')} style={filtroBtn}>⚙️ Configuración</button>
      </div>

      {/* 2 · Cards de informes */}
      <div>
        <SeccionLabel bg={AMA} color={INK}>Informes automáticos</SeccionLabel>
        {loading && <div style={{ color: GRIS, fontFamily: LEX, padding: '12px 0' }}>Cargando…</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {configs.map(c => (
            <Papel key={c.id} ceja={c.activo ? VERDE : GRIS} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{ICONOS[c.tipo] || '📄'}</div>
                  <h3 style={{ fontFamily: OSW, fontSize: 16, fontWeight: 700, color: INK, margin: 0, marginBottom: 4, textTransform: 'uppercase' }}>{c.nombre}</h3>
                  <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>{HORARIOS_LEGIBLES[c.tipo] || c.cron_schedule}</div>
                </div>
                <button
                  onClick={() => toggleActivo(c.id, c.activo)}
                  style={{
                    background: c.activo ? VERDE : GRIS, color: BLANCO, border: `2px solid ${INK}`,
                    padding: '4px 10px', fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                    textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  {c.activo ? 'Activo' : 'Pausado'}
                </button>
              </div>

              <p style={{ color: INK, fontFamily: LEX, fontSize: 13, margin: 0, lineHeight: 1.45 }}>{c.descripcion}</p>

              <div style={{ display: 'flex', gap: 8, fontFamily: LEX, fontSize: 11, color: GRIS }}>
                {c.enviar_whatsapp && <span>💬 WhatsApp</span>}
                {c.enviar_email && <span>📧 Email</span>}
              </div>

              <div style={{ borderTop: `2px solid ${INK}`, paddingTop: 10, fontFamily: LEX, fontSize: 11, color: GRIS }}>
                {c.ultima_ejecucion ? <>Último envío: {new Date(c.ultima_ejecucion).toLocaleString('es-ES')}</> : <>Sin ejecutar aún</>}
              </div>

              {/* Enviar ahora — el usuario elige canal por informe */}
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: GRIS }}>Enviar ahora por</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => abrirModalWhatsApp(c.tipo)}
                    disabled={!!enviando}
                    style={{
                      flex: 1, background: enviando === `${c.tipo}:wa` ? GRIS : VERDE, color: BLANCO,
                      border: `2px solid ${INK}`, boxShadow: SHADOW_DURA, padding: '10px 8px', fontFamily: OSW,
                      fontSize: 13, fontWeight: 700, letterSpacing: '0.03em', cursor: enviando ? 'wait' : 'pointer',
                    }}
                  >
                    {enviando === `${c.tipo}:wa` ? 'Enviando…' : '💬 WhatsApp'}
                  </button>
                  <button
                    onClick={() => enviarManual(c.tipo, { email: true })}
                    disabled={!!enviando}
                    style={{
                      flex: 1, background: enviando === `${c.tipo}:em` ? GRIS : GRANATE, color: BLANCO,
                      border: `2px solid ${INK}`, boxShadow: SHADOW_DURA, padding: '10px 8px', fontFamily: OSW,
                      fontSize: 13, fontWeight: 700, letterSpacing: '0.03em', cursor: enviando ? 'wait' : 'pointer',
                    }}
                  >
                    {enviando === `${c.tipo}:em` ? 'Enviando…' : '📧 Email'}
                  </button>
                </div>
              </div>
            </Papel>
          ))}
        </div>
      </div>

      {/* 3 · Últimos envíos */}
      <div>
        <SeccionLabel bg={GRANATE}>Últimos envíos</SeccionLabel>
        {envios.length === 0 ? (
          <Papel ceja={GRANATE}><div style={{ color: GRIS, fontFamily: LEX, textAlign: 'center', padding: '20px 0' }}>Aún no hay envíos registrados.</div></Papel>
        ) : (
          <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
              <thead>
                <tr style={{ background: INK }}>
                  {['Cuándo', 'Informe', 'Destinatario', 'Canal', 'Estado'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#fff8e7', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {envios.map(e => (
                  <tr key={e.id} style={{ borderBottom: `2px solid ${INK}` }}>
                    <td style={{ padding: '10px 12px' }}>{new Date(e.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600 }}>{ICONOS[e.tipo] || '📄'} {e.tipo.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '10px 12px' }}>{e.destinatario_nombre || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{e.canal === 'whatsapp' ? '💬' : '📧'} {e.destino}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '3px 9px', fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                        border: `2px solid ${INK}`,
                        background: e.estado === 'enviado' ? VERDE : e.estado === 'fallido' ? ROJO : GRIS,
                        color: BLANCO,
                      }}>
                        {e.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Papel>
        )}
      </div>

      {/* Modal: elegir destinatarios de WhatsApp — estilo Papel + sombra dura sobre backdrop */}
      {modalWA && (
        <div
          onClick={() => setModalWA(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <Papel ceja={VERDE} pad="0" style={{ boxShadow: SHADOW_DURA, display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
              <div style={{ padding: '18px 20px', borderBottom: `2px solid ${INK}` }}>
                <h3 style={{ fontFamily: OSW, fontSize: 17, fontWeight: 700, color: INK, margin: 0, textTransform: 'uppercase' }}>💬 Enviar por WhatsApp</h3>
                <p style={{ color: GRIS, fontFamily: LEX, fontSize: 13, margin: '6px 0 0' }}>Elige a quién enviar este informe.</p>
              </div>

              <div style={{ padding: '8px 20px', overflowY: 'auto', flex: 1 }}>
                {modalWA.cargando ? (
                  <div style={{ color: GRIS, fontFamily: LEX, padding: '16px 0' }}>Cargando destinatarios…</div>
                ) : modalWA.lista.length === 0 ? (
                  <div style={{ color: GRIS, fontFamily: LEX, padding: '16px 0' }}>No hay destinatarios con WhatsApp activo para este informe.</div>
                ) : (
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', cursor: 'pointer', borderBottom: `2px solid ${INK}` }}>
                      <input type="checkbox" checked={modalWA.seleccion.size === modalWA.lista.length && modalWA.lista.length > 0} onChange={toggleTodos} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                      <span style={{ fontFamily: OSW, fontWeight: 700, color: INK, fontSize: 14, textTransform: 'uppercase' }}>Todos</span>
                    </label>
                    {modalWA.lista.map(d => (
                      <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={modalWA.seleccion.has(d.id)} onChange={() => toggleSeleccion(d.id)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                        <span style={{ flex: 1, minWidth: 0, color: INK, fontFamily: LEX, fontSize: 14 }}>{d.nombre}</span>
                        <span style={{ color: GRIS, fontFamily: LEX, fontSize: 12 }}>{d.whatsapp}</span>
                      </label>
                    ))}
                  </>
                )}
              </div>

              <div style={{ padding: '14px 20px', borderTop: `2px solid ${INK}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setModalWA(null)} style={{ background: BLANCO, border: `2px solid ${INK}`, padding: '10px 16px', cursor: 'pointer', color: INK, fontFamily: OSW, fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>Cancelar</button>
                <button
                  onClick={confirmarEnvioWhatsApp}
                  disabled={modalWA.cargando || modalWA.seleccion.size === 0}
                  style={{
                    background: modalWA.seleccion.size === 0 ? GRIS : VERDE, color: BLANCO, border: `2px solid ${INK}`,
                    boxShadow: SHADOW_DURA, padding: '10px 18px', cursor: modalWA.seleccion.size === 0 ? 'not-allowed' : 'pointer',
                    fontFamily: OSW, fontSize: 13, fontWeight: 700, textTransform: 'uppercase',
                  }}
                >
                  Enviar ({modalWA.seleccion.size})
                </button>
              </div>
            </Papel>
          </div>
        </div>
      )}
    </PantallaCantera>
  )
}

const filtroBtn: React.CSSProperties = {
  padding: '8px 14px', border: `2px solid ${INK}`, background: BLANCO, borderRadius: 0,
  fontFamily: LEX, fontSize: 13, fontWeight: 600, color: INK, cursor: 'pointer',
}
