/**
 * CardSaldo — Saldo cuentas Streat Lab
 * H.2 tablas facturas/gastos_fijos no existen → mostrar "Datos insuficientes"
 * El saldo real se lee de cuentas_bancarias (columna saldo_actual).
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/lib/format'
import { COLOR, LEXEND, OSWALD, card, lblSm, kpiMid } from './tokens'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Props {}

export default function CardSaldo(_props: Props) {
  const [saldo, setSaldo] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase
      .from('cuentas_bancarias')
      .select('saldo_actual')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const total = (data as { saldo_actual: number | null }[]).reduce(
            (a, r) => a + (Number(r.saldo_actual) || 0),
            0
          )
          setSaldo(total)
        } else {
          setSaldo(null)
        }
        setCargando(false)
      })
  }, [])

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div style={lblSm}>SALDO CUENTAS STREAT LAB</div>
        <span
          title="Suma del saldo actual de todas las cuentas bancarias registradas en el ERP"
          style={{ fontSize: 11, color: COLOR.textMut, cursor: 'help', fontFamily: LEXEND }}
        >
          ⓘ
        </span>
      </div>

      <div style={{ ...kpiMid, marginTop: 6 }}>
        {cargando ? '…' : saldo !== null ? `${fmtEur(saldo, { showEuro: false, decimals: 0 })} €` : '—'}
      </div>
      <div style={{ fontSize: 11, color: COLOR.textMut, fontFamily: LEXEND }}>
        Saldo total cuentas Streat Lab
      </div>

      {/* Cobros 7d / 30d — tabla facturas no existe */}
      <InsufiBlock
        titulo="Cobros 7d / 30d"
        nota="Pendiente tabla facturas"
      />

      {/* Pagos 7d / 30d — tablas gastos_fijos / facturas no existen */}
      <InsufiBlock
        titulo="Pagos 7d / 30d"
        nota="Pendiente tablas gastos_fijos"
      />
    </div>
  )
}

function InsufiBlock({ titulo, nota }: { titulo: string; nota: string }) {
  return (
    <div style={{
      marginTop: 14,
      paddingTop: 10,
      borderTop: `0.5px solid ${COLOR.borde}`,
    }}>
      <div style={{ fontSize: 11, fontFamily: OSWALD, letterSpacing: '1px', color: COLOR.textMut, textTransform: 'uppercase', marginBottom: 4 }}>
        {titulo}
      </div>
      <div style={{ fontSize: 11, color: COLOR.textMut, fontFamily: LEXEND, fontStyle: 'italic' }}>
        Datos insuficientes — {nota}
      </div>
    </div>
  )
}
