import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

// 6ª card del panel OCR: salud del proceso de conciliación en vivo.
// Lee la vista única v_salud_ocr (creada en BD). Solo lectura.
interface Salud {
  facturas_total: number
  conciliadas: number
  parciales: number
  esperando_banco: number
  pendientes: number
  sin_nif: number
  sin_categoria: number
  sin_drive: number
  ilegibles: number
  glovo_justeat_revisar: number
  pct_conciliado: number
}

export default function CardSaludOcr() {
  const [s, setS] = useState<Salud | null>(null)

  async function cargar() {
    const { data } = await supabase.from('v_salud_ocr').select('*').maybeSingle()
    if (data) {
      // pct_conciliado llega como string desde la vista (numeric); normalizar.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any
      setS({ ...d, pct_conciliado: Number(d.pct_conciliado) || 0 })
    }
  }

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 60_000)
    return () => clearInterval(t)
  }, [])

  const pct = s?.pct_conciliado ?? 0
  const conciliadas = (s?.conciliadas ?? 0) + (s?.parciales ?? 0)
  const huecos = (s?.sin_nif ?? 0) + (s?.sin_categoria ?? 0) + (s?.sin_drive ?? 0) + (s?.ilegibles ?? 0)

  return (
    <div
      style={{
        background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, padding: '16px 16px',
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Salud OCR</span>
      </div>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: pct >= 80 ? '#1D9E75' : pct >= 50 ? '#F26B1F' : '#B01D23' }}>
        {s ? `${pct}%` : '—'}
      </div>
      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 4, marginBottom: 10 }}>
        {s ? `${conciliadas} de ${s.facturas_total} conciliadas` : '—'}
      </div>

      <div style={{ height: 6, borderRadius: 3, background: '#ebe8e2', overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: pct >= 80 ? '#1D9E75' : pct >= 50 ? '#F26B1F' : '#B01D23', transition: 'width 0.4s' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontFamily: 'Lexend, sans-serif', fontSize: 10.5, color: '#7a8090' }}>
        <Fila label="Esperando banco" valor={s?.esperando_banco ?? 0} color="#7a8090" />
        <Fila label="Sin NIF / categoría" valor={(s?.sin_nif ?? 0) + (s?.sin_categoria ?? 0)} color={huecos > 0 ? '#F26B1F' : '#1D9E75'} />
        <Fila label="Glovo/JustEat a separar" valor={s?.glovo_justeat_revisar ?? 0} color={(s?.glovo_justeat_revisar ?? 0) > 0 ? '#F26B1F' : '#1D9E75'} />
      </div>
    </div>
  )
}

function Fila({ label, valor, color }: { label: string; valor: number; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>{label}</span>
      <span style={{ color, fontWeight: 500 }}>{valor}</span>
    </div>
  )
}
