import { BLANCO, GRANATE, VERDE } from '@/styles/neobrutal'
/**
 * Módulo Informes — Panel principal
 *
 * Estado de los informes automáticos: resumen mañana, pulso tarde,
 * cierre diario, cobros lunes, cierre semanal, cierre mensual.
 * Permite enviar manualmente (eligiendo WhatsApp o Email) y ver historial reciente.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'

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
  const { T } = useTheme()
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

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto', fontFamily: FONT.body }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: FONT.heading, fontSize: 28, color: T.pri, margin: 0, letterSpacing: '0.5px' }}>
          📑 Informes automáticos
        </h1>
        <p style={{ color: T.sec, marginTop: 6, fontSize: 14 }}>
          Envío programado a destinatarios configurados por WhatsApp y email.
        </p>
      </header>

      {/* Cards de informes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
        {loading && <div style={{ color: T.mut }}>Cargando...</div>}
        {configs.map(c => (
          <div
            key={c.id}
            style={{
              background: T.card,
              border: `1px solid ${T.brd}`,
              borderRadius: 12,
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{ICONOS[c.tipo] || '📄'}</div>
                <h3 style={{ fontFamily: FONT.heading, fontSize: 16, color: T.pri, margin: 0, marginBottom: 4 }}>
                  {c.nombre}
                </h3>
                <div style={{ fontSize: 12, color: T.mut }}>{HORARIOS_LEGIBLES[c.tipo] || c.cron_schedule}</div>
              </div>
              <button
                onClick={() => toggleActivo(c.id, c.activo)}
                style={{
                  background: c.activo ? VERDE : T.brd,
                  color: BLANCO,
                  border: 'none',
                  borderRadius: 999,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                  flexShrink: 0,
                }}
              >
                {c.activo ? 'ACTIVO' : 'PAUSADO'}
              </button>
            </div>

            <p style={{ color: T.sec, fontSize: 13, margin: 0, lineHeight: 1.45 }}>
              {c.descripcion}
            </p>

            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: T.mut }}>
              {c.enviar_whatsapp && <span>💬 WhatsApp</span>}
              {c.enviar_email && <span>📧 Email</span>}
            </div>

            <div style={{ borderTop: `1px solid ${T.brd}`, paddingTop: 10, fontSize: 11, color: T.mut }}>
              {c.ultima_ejecucion
                ? <>Último envío: {new Date(c.ultima_ejecucion).toLocaleString('es-ES')}</>
                : <>Sin ejecutar aún</>}
            </div>

            {/* Enviar ahora — el usuario elige canal por informe */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11, color: T.mut }}>Enviar ahora por:</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => abrirModalWhatsApp(c.tipo)}
                  disabled={!!enviando}
                  style={{
                    flex: 1,
                    background: enviando === `${c.tipo}:wa` ? T.mut : VERDE,
                    color: BLANCO,
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 8px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: enviando ? 'wait' : 'pointer',
                    fontFamily: FONT.heading,
                    letterSpacing: '0.03em',
                  }}
                >
                  {enviando === `${c.tipo}:wa` ? 'Enviando…' : '💬 WhatsApp'}
                </button>
                <button
                  onClick={() => enviarManual(c.tipo, { email: true })}
                  disabled={!!enviando}
                  style={{
                    flex: 1,
                    background: enviando === `${c.tipo}:em` ? T.mut : GRANATE,
                    color: BLANCO,
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 8px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: enviando ? 'wait' : 'pointer',
                    fontFamily: FONT.heading,
                    letterSpacing: '0.03em',
                  }}
                >
                  {enviando === `${c.tipo}:em` ? 'Enviando…' : '📧 Email'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Atajos */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/informes/destinatarios')}
          style={{
            background: T.card, border: `1px solid ${T.brd}`, borderRadius: 8,
            padding: '10px 16px', cursor: 'pointer', color: T.pri, fontSize: 14,
          }}
        >
          👥 Gestionar destinatarios
        </button>
        <button
          onClick={() => navigate('/informes/historial')}
          style={{
            background: T.card, border: `1px solid ${T.brd}`, borderRadius: 8,
            padding: '10px 16px', cursor: 'pointer', color: T.pri, fontSize: 14,
          }}
        >
          🕒 Ver historial completo
        </button>
        <button
          onClick={() => navigate('/informes/configuracion')}
          style={{
            background: T.card, border: `1px solid ${T.brd}`, borderRadius: 8,
            padding: '10px 16px', cursor: 'pointer', color: T.pri, fontSize: 14,
          }}
        >
          ⚙️ Configuración
        </button>
      </div>

      {/* Últimos envíos */}
      <section>
        <h2 style={{ fontFamily: FONT.heading, fontSize: 18, color: T.pri, marginBottom: 12, letterSpacing: '0.05em' }}>
          🕒 Últimos envíos
        </h2>
        {envios.length === 0 ? (
          <div style={{ background: T.card, padding: 24, borderRadius: 12, border: `1px solid ${T.brd}`, color: T.mut, textAlign: 'center' }}>
            Aún no hay envíos registrados.
          </div>
        ) : (
          <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.brd}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: T.group }}>
                <tr>
                  <th style={{ padding: 10, textAlign: 'left', color: T.sec, fontWeight: 600 }}>Cuándo</th>
                  <th style={{ padding: 10, textAlign: 'left', color: T.sec, fontWeight: 600 }}>Informe</th>
                  <th style={{ padding: 10, textAlign: 'left', color: T.sec, fontWeight: 600 }}>Destinatario</th>
                  <th style={{ padding: 10, textAlign: 'left', color: T.sec, fontWeight: 600 }}>Canal</th>
                  <th style={{ padding: 10, textAlign: 'left', color: T.sec, fontWeight: 600 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {envios.map(e => (
                  <tr key={e.id} style={{ borderTop: `1px solid ${T.brd}` }}>
                    <td style={{ padding: 10, color: T.sec }}>
                      {new Date(e.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: 10, color: T.pri }}>
                      {ICONOS[e.tipo] || '📄'} {e.tipo.replace(/_/g, ' ')}
                    </td>
                    <td style={{ padding: 10, color: T.pri }}>{e.destinatario_nombre || '—'}</td>
                    <td style={{ padding: 10, color: T.sec }}>
                      {e.canal === 'whatsapp' ? '💬' : '📧'} {e.destino}
                    </td>
                    <td style={{ padding: 10 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                        background: e.estado === 'enviado' ? `${VERDE}20` : e.estado === 'fallido' ? `${GRANATE}20` : T.brd,
                        color: e.estado === 'enviado' ? VERDE : e.estado === 'fallido' ? GRANATE : T.mut,
                      }}>
                        {e.estado.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal: elegir destinatarios de WhatsApp */}
      {modalWA && (
        <div
          onClick={() => setModalWA(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: T.card, border: `1px solid ${T.brd}`, borderRadius: 14,
              width: '100%', maxWidth: 420, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.brd}` }}>
              <h3 style={{ fontFamily: FONT.heading, fontSize: 17, color: T.pri, margin: 0 }}>
                💬 Enviar por WhatsApp
              </h3>
              <p style={{ color: T.sec, fontSize: 13, margin: '6px 0 0' }}>
                Elige a quién enviar este informe.
              </p>
            </div>

            <div style={{ padding: '8px 20px', overflowY: 'auto', flex: 1 }}>
              {modalWA.cargando ? (
                <div style={{ color: T.mut, padding: '16px 0' }}>Cargando destinatarios…</div>
              ) : modalWA.lista.length === 0 ? (
                <div style={{ color: T.mut, padding: '16px 0' }}>
                  No hay destinatarios con WhatsApp activo para este informe.
                </div>
              ) : (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', cursor: 'pointer', borderBottom: `1px solid ${T.brd}` }}>
                    <input
                      type="checkbox"
                      checked={modalWA.seleccion.size === modalWA.lista.length && modalWA.lista.length > 0}
                      onChange={toggleTodos}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: 600, color: T.pri, fontSize: 14 }}>Todos</span>
                  </label>
                  {modalWA.lista.map(d => (
                    <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={modalWA.seleccion.has(d.id)}
                        onChange={() => toggleSeleccion(d.id)}
                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                      />
                      <span style={{ flex: 1, minWidth: 0, color: T.pri, fontSize: 14 }}>{d.nombre}</span>
                      <span style={{ color: T.mut, fontSize: 12 }}>{d.whatsapp}</span>
                    </label>
                  ))}
                </>
              )}
            </div>

            <div style={{ padding: '14px 20px', borderTop: `1px solid ${T.brd}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setModalWA(null)}
                style={{
                  background: T.card, border: `1px solid ${T.brd}`, borderRadius: 8,
                  padding: '10px 16px', cursor: 'pointer', color: T.sec, fontSize: 14,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEnvioWhatsApp}
                disabled={modalWA.cargando || modalWA.seleccion.size === 0}
                style={{
                  background: modalWA.seleccion.size === 0 ? T.mut : VERDE,
                  color: BLANCO, border: 'none', borderRadius: 8,
                  padding: '10px 18px', cursor: modalWA.seleccion.size === 0 ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontWeight: 600, fontFamily: FONT.heading,
                }}
              >
                Enviar ({modalWA.seleccion.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
