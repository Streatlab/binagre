/**
 * Módulo Informes — Historial completo de envíos
 * CANTERA ALEGRE v1.0 (área Equipo · tinta). Solo capa visual; cargar() y filtros intactos.
 *
 * Lista todos los envíos con filtros por tipo y estado.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { INK, GRIS, OSW, LEX, VERDE, ROJO, GRANATE, BLANCO } from '@/styles/neobrutal'
import { HeroCantera, Papel, PantallaCantera, SeccionLabel, SHADOW_DURA } from '@/components/kit/cantera'

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

  const enviados = envios.filter(e => e.estado === 'enviado').length
  const fallidos = envios.filter(e => e.estado === 'fallido').length

  const titular = envios.length === 0
    ? 'Sin envíos registrados con estos filtros.'
    : <>{enviados} de {envios.length} envíos completados correctamente.</>

  return (
    <PantallaCantera>
      {/* 1 · Héroe del área Equipo (tinta) */}
      <HeroCantera
        area="equipo"
        titular={titular}
        etiquetaDato="Envíos listados · últimos 200"
        cifra={envios.length.toLocaleString('es-ES')}
        resumen={fallidos > 0 ? <>Hay <b>{fallidos}</b> envíos fallidos en esta lista.</> : undefined}
        atencion={fallidos > 0 ? [`${fallidos} fallidos`] : undefined}
      />

      {/* Filtros planos */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as TipoInforme | '')} style={selectStyle}>
          <option value="">Todos los informes</option>
          <option value="cierre_diario">📅 Cierre diario</option>
          <option value="cobros_lunes">💰 Cobros lunes</option>
          <option value="cierre_semanal">📊 Cierre semanal</option>
          <option value="cierre_mensual">📈 Cierre mensual</option>
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as Estado | '')} style={selectStyle}>
          <option value="">Todos los estados</option>
          <option value="enviado">✅ Enviados</option>
          <option value="fallido">❌ Fallidos</option>
          <option value="pendiente">⏳ Pendientes</option>
        </select>
      </div>

      {/* Tabla de envíos */}
      <div>
        <SeccionLabel bg={GRANATE}>Envíos</SeccionLabel>
        {loading && <div style={{ color: GRIS, fontFamily: LEX, padding: '12px 0' }}>Cargando…</div>}
        {!loading && envios.length === 0 && (
          <Papel ceja={GRANATE}><div style={{ color: GRIS, fontFamily: LEX, textAlign: 'center', padding: '20px 0' }}>No hay envíos con esos filtros.</div></Papel>
        )}
        {!loading && envios.length > 0 && (
          <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
              <thead>
                <tr style={{ background: INK }}>
                  {['Cuándo', 'Informe', 'Para', 'Canal', 'Estado', 'Acción'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#fff8e7', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {envios.map(e => (
                  <tr key={e.id} style={{ borderBottom: `2px solid ${INK}` }}>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{new Date(e.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, whiteSpace: 'nowrap' }}>{ICONOS[e.tipo]} {e.tipo.replace('_', ' ')}</td>
                    <td style={{ padding: '10px 12px' }}>{e.destinatario_nombre || '—'}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{e.canal === 'whatsapp' ? '💬' : '📧'} {e.destino}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <EstadoPill e={e.estado} />
                      {e.error_mensaje && <div style={{ fontFamily: LEX, fontSize: 11, color: GRANATE, marginTop: 2 }}>{e.error_mensaje}</div>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button onClick={() => setVerContenido(e)} style={{ background: BLANCO, color: INK, border: `2px solid ${INK}`, padding: '4px 10px', fontFamily: OSW, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer' }}>Ver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Papel>
        )}
      </div>

      {verContenido && (
        <div
          onClick={() => setVerContenido(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div onClick={ev => ev.stopPropagation()} style={{ width: '100%', maxWidth: 600, maxHeight: '85vh', overflow: 'auto' }}>
            <Papel ceja={GRANATE} style={{ boxShadow: SHADOW_DURA }}>
              <h3 style={{ fontFamily: OSW, fontSize: 18, fontWeight: 700, color: INK, marginTop: 0, textTransform: 'uppercase' }}>{ICONOS[verContenido.tipo]} {verContenido.tipo.replace('_', ' ')}</h3>
              <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginBottom: 12 }}>Para {verContenido.destinatario_nombre} · {verContenido.canal} · {verContenido.destino}</div>
              {verContenido.asunto && <div style={{ fontFamily: LEX, fontWeight: 600, color: INK, marginBottom: 8 }}>Asunto: {verContenido.asunto}</div>}
              <pre style={{ background: `${INK}0d`, border: `2px solid ${INK}`, padding: 16, color: INK, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, fontFamily: 'inherit' }}>{verContenido.contenido}</pre>
              <button onClick={() => setVerContenido(null)} style={{ marginTop: 12, background: GRANATE, color: BLANCO, border: `2px solid ${INK}`, boxShadow: SHADOW_DURA, padding: '8px 16px', fontFamily: OSW, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>Cerrar</button>
            </Papel>
          </div>
        </div>
      )}
    </PantallaCantera>
  )
}

function EstadoPill({ e }: { e: Estado }) {
  const cfg = e === 'enviado'
    ? { bg: VERDE, label: '✅ ENVIADO' }
    : e === 'fallido'
      ? { bg: ROJO, label: '❌ FALLIDO' }
      : { bg: GRIS, label: '⏳ PENDIENTE' }
  return (
    <span style={{ padding: '3px 9px', fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', border: `2px solid ${INK}`, background: cfg.bg, color: BLANCO }}>
      {cfg.label}
    </span>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '8px 12px', border: `2px solid ${INK}`, borderRadius: 0, background: BLANCO, color: INK,
  fontSize: 13, fontFamily: LEX, cursor: 'pointer',
}
