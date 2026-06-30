import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { toast } from '@/lib/toastStore'

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
  facturas: number
  resumenes: number
  buzonConectado: boolean
}

const HOY = () => new Date().toISOString().slice(0, 10)
const TITULO: Record<Tipo, string> = {
  factura: 'Por correo',
  ventas: 'Ventas por correo',
}
const TABLAS_LIQUIDACION = ['uber_liquidaciones', 'glovo_liquidaciones', 'justeat_liquidaciones']

export default function CardFacturasCorreo({ tipo, desde, hasta, activa, onClick, onBarrido }: Props) {
  const [s, setS] = useState<Stats | null>(null)
  const [recogiendo, setRecogiendo] = useState(false)

  async function cargar() {
    // TODOS los documentos llegados por correo en el periodo, SEPARADOS:
    //  - Facturas: facturas marcadas como origen-correo (facturas_origen_correo).
    //  - Resúmenes: liquidaciones de plataforma (uber/glovo/justeat) por fecha del resumen.
    const d0 = desde || HOY()
    const hBase = hasta || HOY()
    const hNext = new Date(hBase); hNext.setDate(hNext.getDate() + 1)
    const d1 = hNext.toISOString().slice(0, 10)

    // 1) Facturas origen-correo marcadas en el periodo
    const { data: oc } = await supabase
      .from('facturas_origen_correo')
      .select('factura_id, marcado_en')
      .gte('marcado_en', d0 + 'T00:00:00')
      .lt('marcado_en', d1 + 'T00:00:00')
    const facturas = (oc || []).length

    // 2) Resúmenes de plataforma cuyo periodo cae dentro del rango (por fecha_fin_periodo)
    let resumenes = 0
    for (const tabla of TABLAS_LIQUIDACION) {
      const { count } = await supabase
        .from(tabla)
        .select('id', { count: 'exact', head: true })
        .gte('fecha_fin_periodo', d0)
        .lte('fecha_fin_periodo', hBase)
      resumenes += count || 0
    }

    const { data: estadoBuzon } = await supabase
      .from('cartero_correo_estado')
      .select('buzon_conectado')
      .eq('id', 1)
      .maybeSingle()

    const stats: Stats = {
      facturas,
      resumenes,
      buzonConectado: estadoBuzon?.buzon_conectado ?? false,
    }
    setS(stats)
    return stats
  }

  // Barrido manual: trae al instante lo que haya en el buzón (no espera al cron 07:00).
  // Un ÚNICO toast con lo necesario (facturas + ventas), sin doble conteo.
  async function recogerAhora(e: React.MouseEvent) {
    e.stopPropagation()
    if (recogiendo) return
    setRecogiendo(true)
    const tid = toast.loading('Recogiendo correo…')
    try {
      const r = await fetch('/api/facturas?action=cartero')
      const j = await r.json()
      if (j.ok) {
        const d = j.duplicadas ?? 0, m = j.lectura_manual ?? 0
        // Liquidaciones de venta detectadas en el barrido (resumen Uber, etc.)
        const ventas = Array.isArray(j.resultados)
          ? j.resultados.filter((x: { motivo?: string }) => /resumen|→ ventas|liquidaci/i.test(x?.motivo || '')).length
          : 0
        // Las ventas vienen contadas dentro de 'nuevas'; se descuentan para no duplicar.
        const nFac = Math.max(0, (j.nuevas ?? 0) - ventas)
        await cargar()
        const partes: string[] = []
        partes.push(`${nFac} factura${nFac === 1 ? '' : 's'} nuevas`)
        if (ventas > 0) partes.push(`${ventas} resumen${ventas === 1 ? '' : 'es'} de ventas`)
        if (d > 0) partes.push(`${d} ya estaban`)
        if (m > 0) partes.push(`${m} a revisar`)
        toast.success(`Correo recogido · ${partes.join(' · ')}`, { id: tid })
        onBarrido?.()
      } else {
        toast.error(j.error || 'No se pudo recoger el correo', { id: tid })
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error de red al recoger el correo', { id: tid })
    } finally {
      setRecogiendo(false)
    }
  }

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, desde, hasta])

  const facturas = s?.facturas ?? 0
  const resumenes = s?.resumenes ?? 0
  const total = facturas + resumenes
  const pctFac = total > 0 ? (facturas / total) * 100 : 0
  const pctRes = total > 0 ? (resumenes / total) * 100 : 0
  const buzonOk = s?.buzonConectado ?? false
  const rangoTxt = desde || hasta ? 'documentos en el periodo' : 'documentos hoy'

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

      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#111' }}>{total}</div>
      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 4, marginBottom: 12 }}>{rangoTxt}</div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 10, color: '#7a8090', display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span>Facturas</span><span style={{ color: '#B01D23', fontWeight: 500 }}>{facturas}</span></div>
        <div style={{ height: 5, borderRadius: 3, background: '#ebe8e2', overflow: 'hidden' }}><div style={{ width: `${pctFac}%`, height: '100%', background: '#B01D23' }} /></div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 10, color: '#7a8090', display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span>Resúmenes de ventas</span><span style={{ color: '#1D6FE2', fontWeight: 500 }}>{resumenes}</span></div>
        <div style={{ height: 5, borderRadius: 3, background: '#ebe8e2', overflow: 'hidden' }}><div style={{ width: `${pctRes}%`, height: '100%', background: '#1D6FE2' }} /></div>
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
      {!buzonOk && (
        <a
          href="/api/oauth/google?action=connect"
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 8,
            padding: '8px 10px', borderRadius: 8, border: '0.5px solid #E24B4A',
            background: '#fff', color: '#E24B4A', textAlign: 'center', textDecoration: 'none',
            fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px',
            textTransform: 'uppercase', fontWeight: 600,
          }}
        >
          Reconectar Drive
        </a>
      )}
    </div>
  )
}
