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
  /** tras un barrido manual con éxito, para refrescar la tabla del padre */
  onBarrido?: () => void
}

interface Stats {
  recibidas: number
  conciliadas: number
  pendientes: number
  buzonConectado: boolean
}

const HOY = () => new Date().toISOString().slice(0, 10)
const TITULO: Record<Tipo, string> = {
  factura: 'Por correo',
  ventas: 'Ventas por correo',
}

export default function CardFacturasCorreo({ tipo, desde, hasta, activa, onClick, onBarrido }: Props) {
  const [s, setS] = useState<Stats | null>(null)
  const [recogiendo, setRecogiendo] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  async function cargar() {
    // FUENTE REAL: facturas marcadas como origen-correo en el periodo. El cartero
    // IMAP marca cada factura recogida en facturas_origen_correo. Antes esta card
    // leía de ocr_sessions (grupo g_correo_) que el cartero nuevo ya no escribe:
    // por eso mostraba un número viejo fijo y no filtraba.
    const d0 = desde || HOY()
    const hBase = hasta || HOY()
    const hNext = new Date(hBase); hNext.setDate(hNext.getDate() + 1)
    const d1 = hNext.toISOString().slice(0, 10)

    // 1) IDs de facturas origen-correo marcadas en el periodo
    const { data: oc } = await supabase
      .from('facturas_origen_correo')
      .select('factura_id, marcado_en')
      .gte('marcado_en', d0 + 'T00:00:00')
      .lt('marcado_en', d1 + 'T00:00:00')

    const ids = (oc || []).map((r: any) => r.factura_id)
    let conciliadas = 0
    let pendientes = 0

    if (ids.length > 0) {
      // 2) Estado real de esas facturas desde la fuente única (v_estado_factura)
      const { data: estados } = await supabase
        .from('v_estado_factura')
        .select('factura_id, estado_real')
        .in('factura_id', ids)
      for (const e of estados || []) {
        if ((e as any).estado_real === 'conciliada') conciliadas++
        else pendientes++
      }
    }

    const { data: estadoBuzon } = await supabase
      .from('cartero_correo_estado')
      .select('buzon_conectado')
      .eq('id', 1)
      .maybeSingle()

    setS({
      recibidas: ids.length,
      conciliadas,
      pendientes,
      buzonConectado: estadoBuzon?.buzon_conectado ?? false,
    })
  }

  // Barrido manual: trae al instante lo que haya en el buzón (no espera al cron 07:00).
  async function recogerAhora(e: React.MouseEvent) {
    e.stopPropagation()
    if (recogiendo) return
    setRecogiendo(true)
    setAviso(null)
    try {
      const r = await fetch('/api/facturas?action=cartero')
      const j = await r.json()
      if (j.ok) {
        const n = j.nuevas ?? 0, d = j.duplicadas ?? 0, m = j.lectura_manual ?? 0
        setAviso(`Recogidas: ${n} nuevas · ${d} ya estaban · ${m} a revisar`)
        await cargar()
        onBarrido?.()
      } else {
        setAviso(j.error || 'No se pudo recoger el correo')
      }
    } catch (err: any) {
      setAviso(err?.message || 'Error de red')
    } finally {
      setRecogiendo(false)
      setTimeout(() => setAviso(null), 6000)
    }
  }

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, desde, hasta])

  const recibidas = s?.recibidas ?? 0
  const conciliadas = s?.conciliadas ?? 0
  const pendientes = s?.pendientes ?? 0
  const total = conciliadas + pendientes
  const pctOk = total > 0 ? (conciliadas / total) * 100 : 0
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
        <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 10, color: '#7a8090', display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span>Conciliadas</span><span style={{ color: '#1D9E75', fontWeight: 500 }}>{conciliadas}</span></div>
        <div style={{ height: 5, borderRadius: 3, background: '#ebe8e2', overflow: 'hidden' }}><div style={{ width: `${pctOk}%`, height: '100%', background: '#1D9E75' }} /></div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 10, color: '#7a8090', display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span>Pendientes</span><span style={{ color: '#F26B1F', fontWeight: 500 }}>{pendientes}</span></div>
        <div style={{ height: 5, borderRadius: 3, background: '#ebe8e2', overflow: 'hidden' }}><div style={{ width: `${pctPend}%`, height: '100%', background: '#F26B1F' }} /></div>
      </div>

      <button
        onClick={recogerAhora}
        disabled={recogiendo}
        style={{
          width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none',
          background: recogiendo ? '#d0c8bc' : '#B01D23', color: '#fff',
          fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px',
          textTransform: 'uppercase', cursor: recogiendo ? 'wait' : 'pointer', fontWeight: 600,
        }}
      >
        {recogiendo ? 'Recogiendo…' : 'Recoger correo ahora'}
      </button>
      {aviso && (
        <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 10, color: '#3a4050', marginTop: 6, lineHeight: 1.3 }}>{aviso}</div>
      )}
    </div>
  )
}
