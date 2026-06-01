import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { COLOR, COLORS, LEXEND, OSWALD, card, lblSm, kpiBig } from './tokens'

interface Stats {
  recibidas: number
  correctas: number
  conFallo: number   // pendientes + errores + duplicados
  buzonConectado: boolean
  ultimoBarrido: string | null
}

const HOY = () => new Date().toISOString().slice(0, 10)

export default function CardFacturasCorreo() {
  const [s, setS] = useState<Stats | null>(null)
  const [cargando, setCargando] = useState(true)

  async function cargar() {
    setCargando(true)
    const desde = HOY() + 'T00:00:00'
    const { data: ses } = await supabase
      .from('ocr_sessions')
      .select('total, ok, pendientes, duplicados, errores')
      .like('grupo_id', 'g_correo_%')
      .gte('creado_en', desde)

    const recibidas = (ses || []).reduce((a, r) => a + (r.total || 0), 0)
    const correctas = (ses || []).reduce((a, r) => a + (r.ok || 0), 0)
    const conFallo = (ses || []).reduce(
      (a, r) => a + (r.pendientes || 0) + (r.errores || 0) + (r.duplicados || 0),
      0,
    )

    const { data: estado } = await supabase
      .from('cartero_correo_estado')
      .select('buzon_conectado, ultimo_barrido')
      .eq('id', 1)
      .single()

    setS({
      recibidas,
      correctas,
      conFallo,
      buzonConectado: estado?.buzon_conectado ?? false,
      ultimoBarrido: estado?.ultimo_barrido ?? null,
    })
    setCargando(false)
  }

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 60_000)
    return () => clearInterval(t)
  }, [])

  const buzonOk = s?.buzonConectado ?? false

  return (
    <div style={{ ...card, borderLeft: `3px solid ${COLORS.uber}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={lblSm}>FACTURAS POR CORREO · HOY</div>
        <span
          title={s?.ultimoBarrido ? 'Último barrido: ' + new Date(s.ultimoBarrido).toLocaleString('es-ES') : ''}
          style={{
            background: buzonOk ? COLOR.verde : COLOR.rojo,
            color: '#fff',
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 9,
            fontWeight: 500,
            fontFamily: OSWALD,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}
        >
          {buzonOk ? 'Buzón OK' : 'Buzón caído'}
        </span>
      </div>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        <span style={kpiBig}>{cargando ? '—' : s?.recibidas ?? 0}</span>
        <span style={{ fontFamily: LEXEND, fontSize: 13, color: COLOR.textMut, marginBottom: 8 }}>recibidas</span>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px 0', background: '#f3faf6', borderRadius: 8 }}>
          <div style={{ fontFamily: OSWALD, fontSize: 22, fontWeight: 600, color: COLOR.verde }}>
            {cargando ? '—' : s?.correctas ?? 0}
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: 1, color: COLOR.textMut, textTransform: 'uppercase' }}>
            Correctas
          </div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px 0', background: '#fdf3f3', borderRadius: 8 }}>
          <div style={{ fontFamily: OSWALD, fontSize: 22, fontWeight: 600, color: COLOR.rojo }}>
            {cargando ? '—' : s?.conFallo ?? 0}
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: 1, color: COLOR.textMut, textTransform: 'uppercase' }}>
            Con fallo
          </div>
        </div>
      </div>

      {!buzonOk && (
        <div style={{ marginTop: 12, fontFamily: LEXEND, fontSize: 12, color: COLOR.rojo, textAlign: 'center' }}>
          El buzón no conectó en el último barrido. Puede que falten facturas.
        </div>
      )}
    </div>
  )
}
