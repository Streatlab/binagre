/**
 * Módulo Informes — Panel principal
 *
 * Estado de los 4 informes automáticos: cierre diario, cobros lunes,
 * cierre semanal, cierre mensual. Permite enviar manualmente y ver
 * historial reciente.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'

type TipoInforme = 'cierre_diario' | 'cobros_lunes' | 'cierre_semanal' | 'cierre_mensual'

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

const ICONOS: Record<TipoInforme, string> = {
  cierre_diario: '📅',
  cobros_lunes: '💰',
  cierre_semanal: '📊',
  cierre_mensual: '📈',
}

const HORARIOS_LEGIBLES: Record<TipoInforme, string> = {
  cierre_diario: 'Lun-Sáb · 23:30',
  cobros_lunes: 'Lunes · 09:00',
  cierre_semanal: 'Domingo · 23:30',
  cierre_mensual: 'Día 1 · 09:00',
}

export default function InformesPanel() {
  const { T } = useTheme()
  const navigate = useNavigate()
  const [configs, setConfigs] = useState<InformeConfig[]>([])
  const [envios, setEnvios] = useState<EnvioReciente[]>([])
  const [enviando, setEnviando] = useState<TipoInforme | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    const { data: c } = await supabase
      .from('notif_config')
      .select('*')
      .order('tipo')
    const { data: e } = await supabase
      .from('notif_envios')
      .select('id, tipo, destinatario_nombre, canal, destino, estado, enviado_at, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    setConfigs(c || [])
    setEnvios(e || [])
    setLoading(false)
  }

  async function enviarManual(tipo: TipoInforme) {
    if (enviando) return
    setEnviando(tipo)
    try {
      const res = await fetch('/api/informes/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert('Error: ' + (json.error || 'desconocido'))
      } else {
        alert(`✅ Enviado: ${json.enviados || 0} OK · ${json.fallidos || 0} KO`)
        cargar()
      }
    } catch (err) {
      alert('Error de red: ' + (err as Error).message)
    } finally {
      setEnviando(null)
    }
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

      {/* Cards de los 4 informes */}
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
                <div style={{ fontSize: 22, marginBottom: 4 }}>{ICONOS[c.tipo]}</div>
                <h3 style={{ fontFamily: FONT.heading, fontSize: 16, color: T.pri, margin: 0, marginBottom: 4 }}>
                  {c.nombre}
                </h3>
                <div style={{ fontSize: 12, color: T.mut }}>{HORARIOS_LEGIBLES[c.tipo]}</div>
              </div>
              <button
                onClick={() => toggleActivo(c.id, c.activo)}
                style={{
                  background: c.activo ? '#06C167' : T.brd,
                  color: '#fff',
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

            <button
              onClick={() => enviarManual(c.tipo)}
              disabled={!!enviando}
              style={{
                marginTop: 'auto',
                background: enviando === c.tipo ? T.mut : '#B01D23',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 14,
                fontWeight: 600,
                cursor: enviando ? 'wait' : 'pointer',
                fontFamily: FONT.heading,
                letterSpacing: '0.05em',
              }}
            >
              {enviando === c.tipo ? 'Enviando...' : 'Enviar ahora'}
            </button>
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
                      {ICONOS[e.tipo]} {e.tipo.replace('_', ' ')}
                    </td>
                    <td style={{ padding: 10, color: T.pri }}>{e.destinatario_nombre || '—'}</td>
                    <td style={{ padding: 10, color: T.sec }}>
                      {e.canal === 'whatsapp' ? '💬' : '📧'} {e.destino}
                    </td>
                    <td style={{ padding: 10 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                        background: e.estado === 'enviado' ? '#06C16720' : e.estado === 'fallido' ? '#B01D2320' : T.brd,
                        color: e.estado === 'enviado' ? '#06C167' : e.estado === 'fallido' ? '#B01D23' : T.mut,
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
    </div>
  )
}
