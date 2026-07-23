import { GRANATE, VERDE, GRIS } from '@/styles/neobrutal'
/**
 * Módulo Informes — Configuración técnica
 *
 * Estado de las conexiones (WhatsApp Green API + email Resend),
 * activar/pausar cada informe, ajustar canales.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'

type TipoInforme = 'cierre_diario' | 'cobros_lunes' | 'cierre_semanal' | 'cierre_mensual' | 'resumen_manana' | 'pulso'

interface Config {
  id: string
  tipo: TipoInforme
  nombre: string
  descripcion: string
  cron_schedule: string
  activo: boolean
  enviar_whatsapp: boolean
  enviar_email: boolean
}

const ORDEN_TIPOS: string[] = ['resumen_manana', 'cobros_lunes', 'cierre_mensual', 'pulso', 'cierre_diario', 'cierre_semanal']

export default function ConfiguracionInformes() {
  const { T } = useTheme()
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(true)
  const [estadoWA, setEstadoWA] = useState<'conectado' | 'desconectado' | 'desconocido'>('desconocido')
  const [mensajeWA, setMensajeWA] = useState<string>('')

  useEffect(() => {
    cargar()
    comprobarWhatsApp()
  }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('notif_config')
      .select('*')
    const ordenadas = (data || []).sort((a: Config, b: Config) => {
      const ia = ORDEN_TIPOS.indexOf(a.tipo)
      const ib = ORDEN_TIPOS.indexOf(b.tipo)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    setConfigs(ordenadas)
    setLoading(false)
  }

  async function comprobarWhatsApp() {
    try {
      const res = await fetch('/api/informes/whatsapp-status')
      if (!res.ok) {
        setEstadoWA('desconocido')
        return
      }
      const json = await res.json()
      setEstadoWA(json.conectado ? 'conectado' : 'desconectado')
      setMensajeWA(json.mensaje || '')
    } catch {
      setEstadoWA('desconocido')
    }
  }

  async function actualizar(id: string, campo: keyof Config, valor: boolean | string) {
    await supabase.from('notif_config').update({ [campo]: valor, updated_at: new Date().toISOString() }).eq('id', id)
    cargar()
  }

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: '0 auto', fontFamily: FONT.body }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: FONT.heading, fontSize: 28, color: T.pri, margin: 0 }}>
          ⚙️ Configuración informes
        </h1>
        <p style={{ color: T.sec, marginTop: 6, fontSize: 14 }}>
          Activa o pausa los envíos automáticos y revisa el estado de las conexiones.
        </p>
      </header>

      {/* Estado de conexiones */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={subtitle(T)}>🔌 Conexiones</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          <div style={cardStyle(T)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <strong style={{ color: T.pri }}>💬 WhatsApp (Green API)</strong>
              <Estado v={estadoWA} />
            </div>
            <div style={{ fontSize: 12, color: T.mut, lineHeight: 1.5 }}>
              Envía desde el WhatsApp del bar (623036634) vía Green API.
              {estadoWA === 'desconectado' && ` Estado: ${mensajeWA || 'sin autorizar'}. Escanea el QR en console.green-api.com con el móvil del bar.`}
              {estadoWA === 'conectado' && ' Instancia autorizada y lista para enviar.'}
            </div>
          </div>
          <div style={cardStyle(T)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <strong style={{ color: T.pri }}>📧 Email (Resend)</strong>
              <Estado v="conectado" />
            </div>
            <div style={{ fontSize: 12, color: T.mut, lineHeight: 1.5 }}>
              3.000 emails/mes gratis.
            </div>
          </div>
        </div>
      </section>

      {/* Configuración por informe */}
      <section>
        <h2 style={subtitle(T)}>📋 Informes</h2>
        {loading && <div style={{ color: T.mut }}>Cargando...</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {configs.map(c => (
            <div key={c.id} style={cardStyle(T)}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontFamily: FONT.heading, fontSize: 16, color: T.pri, margin: 0, marginBottom: 4 }}>
                    {c.nombre}
                  </h3>
                  <div style={{ fontSize: 12, color: T.mut, marginBottom: 6 }}>
                    Horario: <code style={{ background: T.group, padding: '1px 6px', borderRadius: 3 }}>{c.cron_schedule}</code>
                  </div>
                  <div style={{ fontSize: 13, color: T.sec, marginBottom: 12 }}>{c.descripcion}</div>

                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <Toggle T={T} label="Activo" v={c.activo} on={v => actualizar(c.id, 'activo', v)} />
                    <Toggle T={T} label="WhatsApp" v={c.enviar_whatsapp} on={v => actualizar(c.id, 'enviar_whatsapp', v)} />
                    <Toggle T={T} label="Email" v={c.enviar_email} on={v => actualizar(c.id, 'enviar_email', v)} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Estado({ v }: { v: 'conectado' | 'desconectado' | 'desconocido' }) {
  const cfg = v === 'conectado'
    ? { bg: `${VERDE}20`, fg: VERDE, label: '🟢 OK' }
    : v === 'desconectado'
      ? { bg: `${GRANATE}20`, fg: GRANATE, label: '🔴 KO' }
      : { bg: `${GRIS}20`, fg: GRIS, label: '⚪ —' }
  return (
    <span style={{ background: cfg.bg, color: cfg.fg, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
      {cfg.label}
    </span>
  )
}

function Toggle({ T, label, v, on }: { T: ReturnType<typeof useTheme>['T']; label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: T.pri }}>
      <input type="checkbox" checked={v} onChange={e => on(e.target.checked)} />
      {label}
    </label>
  )
}

function subtitle(T: ReturnType<typeof useTheme>['T']): React.CSSProperties {
  return { fontFamily: FONT.heading, fontSize: 16, color: T.pri, marginBottom: 12, letterSpacing: '0.05em' }
}

function cardStyle(T: ReturnType<typeof useTheme>['T']): React.CSSProperties {
  return { background: T.card, border: `1px solid ${T.brd}`, borderRadius: 12, padding: 16 }
}
