import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

type Tipo = 'factura' | 'ventas'

interface Props {
  tipo: Tipo
  /** Inicio del periodo (YYYY-MM-DD). Si falta, usa hoy. */
  desde?: string
  /** Fin EXCLUSIVO del periodo (YYYY-MM-DD). Si falta, usa mañana. */
  hasta?: string
}

interface Stats {
  recibidas: number
  correctas: number
  pendientes: number
  buzonConectado: boolean
}

const HOY = () => new Date().toISOString().slice(0, 10)
const MANANA = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) }
const FN: Record<Tipo, string> = { factura: 'ocr-procesar-factura', ventas: 'ocr-procesar-extracto' }

export default function CardFacturasCorreo({ tipo, desde, hasta }: Props) {
  const [s, setS] = useState<Stats | null>(null)
  const d0 = desde ?? HOY()
  const d1 = hasta ?? MANANA()

  async function cargar() {
    const { data: ses } = await supabase
      .from('ocr_sessions')
      .select('total, ok, pendientes, duplicados, errores')
      .like('grupo_id', 'g_correo_%')
      .eq('fn_name', FN[tipo])
      .gte('creado_en', d0 + 'T00:00:00')
      .lt('creado_en', d1 + 'T00:00:00')

    const recibidas = (ses || []).reduce((a, r) => a + (r.total || 0), 0)
    const correctas = (ses || []).reduce((a, r) => a + (r.ok || 0), 0)
    const pendientes = (ses || []).reduce((a, r) => a + (r.pendientes || 0) + (r.errores || 0) + (r.duplicados || 0), 0)

    const { data: estado } = await supabase
      .from('cartero_correo_estado').select('buzon_conectado').eq('id', 1).single()

    setS({ recibidas, correctas, pendientes, buzonConectado: estado?.buzon_conectado ?? false })
  }

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, d0, d1])

  const recibidas = s?.recibidas ?? 0
  const correctas = s?.correctas ?? 0
  const pendientes = s?.pendientes ?? 0
  const tot = correctas + pendientes
  const pctOk = tot > 0 ? (correctas / tot) * 100 : 0
  const pctPend = tot > 0 ? (pendientes / tot) * 100 : 0
  const buzonOk = s?.buzonConectado ?? false
  const esPeriodoHoy = !desde && !hasta

  const barLabel: React.CSSProperties = { fontFamily: 'Lexend, sans-serif', fontSize: 10, color: '#7a8090', display: 'flex', justifyContent: 'space-between', marginBottom: 2 }
  const barTrack: React.CSSProperties = { height: 5, borderRadius: 3, background: '#ebe8e2', overflow: 'hidden' }

  return (
    <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Por correo</span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: buzonOk ? '#1D9E75' : '#E24B4A', flexShrink: 0 }} title={buzonOk ? 'Buzón conectado' : 'Buzón caído'} />
      </div>

      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#111' }}>{recibidas}</div>
      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 4, marginBottom: 12 }}>{esPeriodoHoy ? 'recibidas hoy' : 'recibidas en el periodo'}</div>

      <div style={{ marginBottom: 8 }}>
        <div style={barLabel}><span>Correctas</span><span style={{ color: '#1D9E75', fontWeight: 500 }}>{correctas}</span></div>
        <div style={barTrack}><div style={{ width: `${pctOk}%`, height: '100%', background: '#1D9E75' }} /></div>
      </div>
      <div>
        <div style={barLabel}><span>Pendientes</span><span style={{ color: '#F26B1F', fontWeight: 500 }}>{pendientes}</span></div>
        <div style={barTrack}><div style={{ width: `${pctPend}%`, height: '100%', background: '#F26B1F' }} /></div>
      </div>
    </div>
  )
}
