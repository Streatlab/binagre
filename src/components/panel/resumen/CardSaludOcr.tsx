import { BLANCO, BORDE_SUAVE, GRANATE, GRIS, INK, NAR, OSC, VERDE } from '@/styles/neobrutal'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { fmtNumES } from '../../../utils/format'

// 6ª card del panel OCR: salud del proceso en vivo.
// Lee la vista única v_salud_ocr (creada en BD). Solo lectura.
// Muestra, del total de facturas que han entrado, cuántas están bien en cada eje
// (número + % sobre el total). Números con separador de miles y SIN símbolo de euro.
// Se refresca SOLA: al entrar o salir cualquier factura (evento 'facturas:changed')
// y, como red de seguridad, cada 30 s.
interface Salud {
  facturas_total: number
  pct_conciliado: number
  con_titular: number
  con_drive: number
  con_categoria: number
  con_conciliada: number
  con_contraparte: number
  con_nif: number
  con_importe: number
}

export default function CardSaludOcr() {
  const [s, setS] = useState<Salud | null>(null)

  async function cargar() {
    const { data } = await supabase.from('v_salud_ocr').select('*').maybeSingle()
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any
      setS({
        facturas_total: Number(d.facturas_total) || 0,
        pct_conciliado: Number(d.pct_conciliado) || 0,
        con_titular: Number(d.con_titular) || 0,
        con_drive: Number(d.con_drive) || 0,
        con_categoria: Number(d.con_categoria) || 0,
        con_conciliada: Number(d.con_conciliada) || 0,
        con_contraparte: Number(d.con_contraparte) || 0,
        con_nif: Number(d.con_nif) || 0,
        con_importe: Number(d.con_importe) || 0,
      })
    }
  }

  useEffect(() => {
    cargar()
    // Refresco inmediato cada vez que entra o sale una factura.
    const onCambio = () => { cargar() }
    window.addEventListener('facturas:changed', onCambio)
    // Red de seguridad: refresco periódico por si algún cambio no emitió evento.
    const t = setInterval(cargar, 30_000)
    return () => {
      window.removeEventListener('facturas:changed', onCambio)
      clearInterval(t)
    }
  }, [])

  const total = s?.facturas_total ?? 0
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  const filas: { label: string; valor: number }[] = s
    ? [
        { label: 'Con titular', valor: s.con_titular },
        { label: 'En Drive', valor: s.con_drive },
        { label: 'Con categoría', valor: s.con_categoria },
        { label: 'Conciliadas', valor: s.con_conciliada },
        { label: 'Con contraparte', valor: s.con_contraparte },
        { label: 'Con NIF', valor: s.con_nif },
        { label: 'Con importe', valor: s.con_importe },
      ]
    : []

  return (
    <div style={{ background: BLANCO, border: `0.5px solid ${BORDE_SUAVE}`, borderRadius: 0, padding: '16px 16px' }}>
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: GRIS, textTransform: 'uppercase' }}>Salud OCR</span>
      </div>

      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: INK }}>
        {s ? fmtNumES(total) : '—'}
      </div>
      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: GRIS, marginTop: 4, marginBottom: 12 }}>
        han entrado
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'Lexend, sans-serif', fontSize: 11.5, color: OSC }}>
        {filas.map((f) => {
          const p = pct(f.valor)
          const color = p >= 95 ? VERDE : p >= 70 ? NAR : GRANATE
          return (
            <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ color: GRIS }}>{f.label}</span>
              <span style={{ whiteSpace: 'nowrap' }}>
                <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 600, color: INK }}>{fmtNumES(f.valor)}</span>
                <span style={{ color, fontWeight: 600, marginLeft: 6 }}>{p}%</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
