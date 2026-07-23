/**
 * Módulo Informes — Configuración técnica
 * CANTERA ALEGRE v1.0 (área Equipo · tinta). Solo capa visual; cargar(),
 * comprobarWhatsApp() y actualizar() intactas.
 *
 * Estado de las conexiones (WhatsApp Green API + email Resend),
 * activar/pausar cada informe, ajustar canales.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { INK, GRIS, OSW, LEX, VERDE, GRANATE, AMA } from '@/styles/neobrutal'
import { HeroCantera, Papel, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'

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

  const activos = configs.filter(c => c.activo).length
  const titular = estadoWA === 'conectado'
    ? <>Conexiones OK · {activos} de {configs.length} informes activos.</>
    : estadoWA === 'desconectado'
      ? 'WhatsApp desconectado: revisa la conexión antes de enviar.'
      : 'Estado de las conexiones de envío.'

  return (
    <PantallaCantera>
      {/* 1 · Héroe del área Equipo (tinta) */}
      <HeroCantera
        area="equipo"
        titular={titular}
        etiquetaDato="Informes activos"
        cifra={`${activos} / ${configs.length}`}
        atencion={estadoWA === 'desconectado' ? ['WhatsApp desconectado'] : undefined}
      />

      {/* 2 · Conexiones */}
      <div>
        <SeccionLabel bg={AMA} color={INK}>Conexiones</SeccionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          <Papel ceja={estadoWA === 'conectado' ? VERDE : GRANATE}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <strong style={{ color: INK, fontFamily: LEX }}>💬 WhatsApp (Green API)</strong>
              <EstadoPill v={estadoWA} />
            </div>
            <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, lineHeight: 1.5 }}>
              Envía desde el WhatsApp del bar (623036634) vía Green API.
              {estadoWA === 'desconectado' && ` Estado: ${mensajeWA || 'sin autorizar'}. Escanea el QR en console.green-api.com con el móvil del bar.`}
              {estadoWA === 'conectado' && ' Instancia autorizada y lista para enviar.'}
            </div>
          </Papel>
          <Papel ceja={VERDE}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <strong style={{ color: INK, fontFamily: LEX }}>📧 Email (Resend)</strong>
              <EstadoPill v="conectado" />
            </div>
            <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, lineHeight: 1.5 }}>3.000 emails/mes gratis.</div>
          </Papel>
        </div>
      </div>

      {/* 3 · Configuración por informe */}
      <div>
        <SeccionLabel bg={GRANATE}>Informes</SeccionLabel>
        {loading && <div style={{ color: GRIS, fontFamily: LEX, padding: '12px 0' }}>Cargando…</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {configs.map(c => (
            <Papel key={c.id} ceja={c.activo ? VERDE : GRIS}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontFamily: OSW, fontSize: 16, fontWeight: 700, color: INK, margin: 0, marginBottom: 4, textTransform: 'uppercase' }}>{c.nombre}</h3>
                  <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginBottom: 6 }}>
                    Horario: <code style={{ background: `${INK}0d`, padding: '1px 6px' }}>{c.cron_schedule}</code>
                  </div>
                  <div style={{ fontFamily: LEX, fontSize: 13, color: INK, marginBottom: 12 }}>{c.descripcion}</div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <Toggle label="Activo" v={c.activo} on={v => actualizar(c.id, 'activo', v)} />
                    <Toggle label="WhatsApp" v={c.enviar_whatsapp} on={v => actualizar(c.id, 'enviar_whatsapp', v)} />
                    <Toggle label="Email" v={c.enviar_email} on={v => actualizar(c.id, 'enviar_email', v)} />
                  </div>
                </div>
              </div>
            </Papel>
          ))}
        </div>
      </div>
    </PantallaCantera>
  )
}

function EstadoPill({ v }: { v: 'conectado' | 'desconectado' | 'desconocido' }) {
  const cfg = v === 'conectado'
    ? { bg: VERDE, label: '🟢 OK' }
    : v === 'desconectado'
      ? { bg: GRANATE, label: '🔴 KO' }
      : { bg: GRIS, label: '⚪ —' }
  return (
    <span style={{ background: cfg.bg, color: '#fff', padding: '2px 9px', fontFamily: OSW, fontSize: 11, fontWeight: 700, border: `2px solid ${INK}` }}>
      {cfg.label}
    </span>
  )
}

function Toggle({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: LEX, fontSize: 13, color: INK }}>
      <input type="checkbox" checked={v} onChange={e => on(e.target.checked)} />
      {label}
    </label>
  )
}
