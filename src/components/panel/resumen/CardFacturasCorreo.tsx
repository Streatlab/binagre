import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

type Tipo = 'factura' | 'ventas'

interface Props {
  /** 'factura' usa el canal de facturas; 'ventas' el de extractos/ventas */
  tipo: Tipo
}

interface Stats {
  recibidas: number
  correctas: number
  pendientes: number   // pendientes + errores + duplicados
  buzonConectado: boolean
}

const HOY = () => new Date().toISOString().slice(0, 10)
const FN: Record<Tipo, string> = {
  factura: 'ocr-procesar-factura',
  ventas: 'ocr-procesar-extracto',
}
const TITULO: Record<Tipo, string> = {
  factura: 'Entradas por correo',
  ventas: 'Ventas por correo',
}

export default function CardFacturasCorreo({ tipo }: Props) {
  const [s, setS] = useState<Stats | null>(null)

  async function cargar() {
    const desde = HOY() + 'T00:00:00'
    const { data: ses } = await supabase
      .from('ocr_sessions')
      .select('total, ok, pendientes, duplicados, errores')
      .like('grupo_id', 'g_correo_%')
      .eq('fn_name', FN[tipo])
      .gte('creado_en', desde)

    const recibidas = (ses || []).reduce((a, r) => a + (r.total || 0), 0)
    const correctas = (ses || []).reduce((a, r) => a + (r.ok || 0), 0)
    const pendientes = (ses || []).reduce(
      (a, r) => a + (r.pendientes || 0) + (r.errores || 0) + (r.duplicados || 0),
      0,
    )

    const { data: estado } = await supabase
      .from('cartero_correo_estado')
      .select('buzon_conectado')
      .eq('id', 1)
      .single()

    setS({ recibidas, correctas, pendientes, buzonConectado: estado?.buzon_conectado ?? false })
  }

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo])

  const recibidas = s?.recibidas ?? 0
  const correctas = s?.correctas ?? 0
  const pendientes = s?.pendientes ?? 0
  const total = correctas + pendientes
  const pctOk = total > 0 ? (correctas / total) * 100 : 0
  const pctPend = total > 0 ? (pendientes / total) * 100 : 0
  const buzonOk = s?.buzonConectado ?? false

  const labelStyle: React.CSSProperties = { fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }
  const barLabel: React.CSSProperties = { fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', display: 'flex', justifyContent: 'space-between', marginBottom: 3 }
  const barTrack: React.CSSProperties = { height: 6, borderRadius: 3, background: '#ebe8e2', overflow: 'hidden' }

  return (
    <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={labelStyle}>{TITULO[tipo]}</span>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: buzonOk ? '#1D9E75' : '#E24B4A', flexShrink: 0,
          marginTop: 2,
        }} title={buzonOk ? 'Buzón conectado' : 'Buzón caído'} />
      </div>

      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#111' }}>{recibidas}</div>
      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 4, marginBottom: 14 }}>recibidas hoy</div>

      <div style={{ marginBottom: 10 }}>
        <div style={barLabel}><span>Correctas</span><span style={{ color: '#1D9E75', fontWeight: 500 }}>{correctas}</span></div>
        <div style={barTrack}><div style={{ width: `${pctOk}%`, height: '100%', background: '#1D9E75' }} /></div>
      </div>
      <div>
        <div style={barLabel}><span>Pendientes</span><span style={{ color: '#F26B1F', fontWeight: 500 }}>{pendientes}</span></div>
        <div style={barTrack}><div style={{ width: `${pctPend}%`, height: '100%', background: '#F26B1F' }} /></div>
      </div>

      {!buzonOk && (
        <div style={{ marginTop: 12, fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#E24B4A' }}>
          Buzón no conectado en el último barrido.
        </div>
      )}
    </div>
  )
}
