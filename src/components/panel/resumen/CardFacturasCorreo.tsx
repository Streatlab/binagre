import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

type Tipo = 'factura' | 'ventas'

interface Props {
  /** 'factura' usa el canal de facturas; 'ventas' el de extractos/ventas */
  tipo: Tipo
  /** rango opcional; si no se pasa, usa HOY */
  desde?: string
  hasta?: string
  /** marca visual de filtro activo */
  activa?: boolean
  /** al pulsar la card (para filtrar la tabla por origen correo) */
  onClick?: () => void
}

interface Stats {
  recibidas: number
  correctas: number
  pendientes: number
  buzonConectado: boolean
}

const HOY = () => new Date().toISOString().slice(0, 10)
const FN: Record<Tipo, string> = {
  factura: 'ocr-procesar-factura',
  ventas: 'ocr-procesar-extracto',
}
const TITULO: Record<Tipo, string> = {
  factura: 'Por correo',
  ventas: 'Ventas por correo',
}

export default function CardFacturasCorreo({ tipo, desde, hasta, activa, onClick }: Props) {
  const [s, setS] = useState<Stats | null>(null)

  async function cargar() {
    const d0 = (desde || HOY()) + 'T00:00:00'
    const hBase = hasta || HOY()
    const hNext = new Date(hBase); hNext.setDate(hNext.getDate() + 1)
    const d1 = hNext.toISOString().slice(0, 10) + 'T00:00:00'

    const { data: ses } = await supabase
      .from('ocr_sessions')
      .select('total, ok, pendientes, duplicados, errores')
      .like('grupo_id', 'g_correo_%')
      .eq('fn_name', FN[tipo])
      .gte('creado_en', d0)
      .lt('creado_en', d1)

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
  }, [tipo, desde, hasta])

  const recibidas = s?.recibidas ?? 0
  const correctas = s?.correctas ?? 0
  const pendientes = s?.pendientes ?? 0
  const total = correctas + pendientes
  const pctOk = total > 0 ? (correctas / total) * 100 : 0
  const pctPend = total > 0 ? (pendientes / total) * 100 : 0
  const buzonOk = s?.buzonConectado ?? false
  const rangoTxt = desde || hasta ? 'en el periodo' : 'recibidas hoy'

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        border: activa ? '1px solid #FF4757' : '0.5px solid #d0c8bc',
        borderRadius: 14, padding: '16px 16px',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: activa ? '0 0 0 3px #FF475715' : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>{TITULO[tipo]}</span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: buzonOk ? '#1D9E75' : '#E24B4A', flexShrink: 0, marginTop: 2 }} title={buzonOk ? 'Buzón conectado' : 'Buzón caído'} />
      </div>

      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#111' }}>{recibidas}</div>
      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 4, marginBottom: 12 }}>{rangoTxt}</div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 10, color: '#7a8090', display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span>Correctas</span><span style={{ color: '#1D9E75', fontWeight: 500 }}>{correctas}</span></div>
        <div style={{ height: 5, borderRadius: 3, background: '#ebe8e2', overflow: 'hidden' }}><div style={{ width: `${pctOk}%`, height: '100%', background: '#1D9E75' }} /></div>
      </div>
      <div>
        <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 10, color: '#7a8090', display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span>Pendientes</span><span style={{ color: '#F26B1F', fontWeight: 500 }}>{pendientes}</span></div>
        <div style={{ height: 5, borderRadius: 3, background: '#ebe8e2', overflow: 'hidden' }}><div style={{ width: `${pctPend}%`, height: '100%', background: '#F26B1F' }} /></div>
      </div>
    </div>
  )
}
