/**
 * Módulo Informes — Historial completo de envíos
 *
 * Lista todos los envíos con filtros por tipo, estado, canal y fecha.
 * Permite reenviar fallos.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'

type TipoInforme = 'cierre_diario' | 'cobros_lunes' | 'cierre_semanal' | 'cierre_mensual'
type Estado = 'pendiente' | 'enviado' | 'fallido'
type Canal = 'whatsapp' | 'email'

interface Envio {
  id: string
  tipo: TipoInforme
  destinatario_nombre: string | null
  canal: Canal
  destino: string
  asunto: string | null
  contenido: string
  estado: Estado
  error_mensaje: string | null
  enviado_at: string | null
  created_at: string
}

const ICONOS: Record<TipoInforme, string> = {
  cierre_diario: '📅',
  cobros_lunes: '💰',
  cierre_semanal: '📊',
  cierre_mensual: '📈',
}

export default function Historial() {
  const { T } = useTheme()
  const [envios, setEnvios] = useState<Envio[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<TipoInforme | ''>('')
  const [filtroEstado, setFiltroEstado] = useState<Estado | ''>('')
  const [verContenido, setVerContenido] = useState<Envio | null>(null)

  useEffect(() => {
    cargar()
  }, [filtroTipo, filtroEstado])

  async function cargar() {
    setLoading(true)
    let q = supabase
      .from('notif_envios')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (filtroTipo) q = q.eq('tipo', filtroTipo)
    if (filtroEstado) q = q.eq('estado', filtroEstado)
    const { data } = await q
    setEnvios(data || [])
    setLoading(false)
  }

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto', fontFamily: FONT.body }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: FONT.heading, fontSize: 28, color: T.pri, margin: 0 }}>
          🕒 Historial de envíos
        </h1>
        <p style={{ color: T.sec, marginTop: 6, fontSize: 14 }}>
          Últimos 200 envíos. Filtrable por tipo y estado.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value as TipoInforme | '')}
          style={selectStyle(T)}
        >
          <option value="">Todos los informes</option>
          <option value="cierre_diario">📅 Cierre diario</option>
          <option value="cobros_lunes">💰 Cobros lunes</option>
          <option value="cierre_semanal">📊 Cierre semanal</option>
          <option value="cierre_mensual">📈 Cierre mensual</option>
        </select>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value as Estado | '')}
          style={selectStyle(T)}
        >
          <option value="">Todos los estados</option>
          <option value="enviado">✅ Enviados</option>
          <option value="fallido">❌ Fallidos</option>
          <option value="pendiente">⏳ Pendientes</option>
        </select>
      </div>

      {loading && <div style={{ color: T.mut }}>Cargando...</div>}

      {!loading && envios.length === 0 && (
        <div style={{ background: T.card, padding: 32, borderRadius: 12, border: `1px solid ${T.brd}`, color: T.mut, textAlign: 'center' }}>
          No hay envíos con esos filtros.
        </div>
      )}

      {!loading && envios.length > 0 && (
        <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.brd}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: T.group }}>
              <tr>
                <th style={th(T)}>Cuándo</th>
                <th style={th(T)}>Informe</th>
                <th style={th(T)}>Para</th>
                <th style={th(T)}>Canal</th>
                <th style={th(T)}>Estado</th>
                <th style={th(T)}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {envios.map(e => (
                <tr key={e.id} style={{ borderTop: `1px solid ${T.brd}` }}>
                  <td style={td(T)}>
                    {new Date(e.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={td(T)}>{ICONOS[e.tipo]} {e.tipo.replace('_', ' ')}</td>
                  <td style={td(T)}>{e.destinatario_nombre || '—'}</td>
                  <td style={td(T)}>
                    {e.canal === 'whatsapp' ? '💬' : '📧'} {e.destino}
                  </td>
                  <td style={td(T)}>
                    <Estado e={e.estado} T={T} />
                    {e.error_mensaje && (
                      <div style={{ fontSize: 11, color: '#B01D23', marginTop: 2 }}>{e.error_mensaje}</div>
                    )}
                  </td>
                  <td style={td(T)}>
                    <button
                      onClick={() => setVerContenido(e)}
                      style={{ background: 'transparent', color: T.pri, border: `1px solid ${T.brd}`, borderRadius: 4, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {verContenido && (
        <div
          onClick={() => setVerContenido(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={ev => ev.stopPropagation()}
            style={{ background: T.card, borderRadius: 12, padding: 20, width: '100%', maxWidth: 600, maxHeight: '85vh', overflow: 'auto' }}
          >
            <h3 style={{ fontFamily: FONT.heading, color: T.pri, marginTop: 0 }}>
              {ICONOS[verContenido.tipo]} {verContenido.tipo.replace('_', ' ')}
            </h3>
            <div style={{ fontSize: 12, color: T.mut, marginBottom: 12 }}>
              Para {verContenido.destinatario_nombre} · {verContenido.canal} · {verContenido.destino}
            </div>
            {verContenido.asunto && (
              <div style={{ fontWeight: 600, color: T.pri, marginBottom: 8 }}>
                Asunto: {verContenido.asunto}
              </div>
            )}
            <pre style={{ background: T.group, padding: 16, borderRadius: 8, color: T.pri, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, fontFamily: 'inherit' }}>
              {verContenido.contenido}
            </pre>
            <button
              onClick={() => setVerContenido(null)}
              style={{ marginTop: 12, background: '#B01D23', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Estado({ e, T }: { e: 'pendiente' | 'enviado' | 'fallido'; T: ReturnType<typeof useTheme>['T'] }) {
  const cfg = e === 'enviado'
    ? { bg: '#06C16720', fg: '#06C167', label: '✅ ENVIADO' }
    : e === 'fallido'
      ? { bg: '#B01D2320', fg: '#B01D23', label: '❌ FALLIDO' }
      : { bg: T.brd, fg: T.mut, label: '⏳ PENDIENTE' }
  return (
    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.fg }}>
      {cfg.label}
    </span>
  )
}

function th(T: ReturnType<typeof useTheme>['T']): React.CSSProperties {
  return { padding: 10, textAlign: 'left', color: T.sec, fontWeight: 600, fontSize: 12 }
}

function td(T: ReturnType<typeof useTheme>['T']): React.CSSProperties {
  return { padding: 10, color: T.pri }
}

function selectStyle(T: ReturnType<typeof useTheme>['T']): React.CSSProperties {
  return {
    padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${T.brd}`, background: T.card, color: T.pri,
    fontSize: 14, fontFamily: FONT.body, cursor: 'pointer',
  }
}
