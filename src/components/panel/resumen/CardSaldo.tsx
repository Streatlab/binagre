import { COLOR, LEXEND, card, lblSm, kpiMid, fmtEur0 } from './tokens'

interface Props {
  saldoHoy: number
  cobros7d: number
  pagos7d: number
  cobros30d: number
  pagos30d: number
}

export default function CardSaldo({ saldoHoy, cobros7d, pagos7d, cobros30d, pagos30d }: Props) {
  const proy7d  = saldoHoy + cobros7d  - pagos7d
  const proy30d = saldoHoy + cobros30d - pagos30d

  return (
    <div style={card}>
      <div style={lblSm}>SALDO + PROYECCIÓN</div>
      <div style={{ ...kpiMid, marginTop: 6 }}>{fmtEur0(saldoHoy)}</div>
      <div style={{ fontSize: 11, color: COLOR.textMut, fontFamily: LEXEND }}>caja líquida hoy</div>

      <Block
        items={[
          { label: 'Cobros 7d', valor: `+${fmtEur0(cobros7d)}`, color: COLOR.verde },
          { label: 'Pagos 7d',  valor: `-${fmtEur0(pagos7d)}`,  color: COLOR.rojo  },
          { label: 'Proyección 7d', valor: fmtEur0(proy7d), bold: true },
        ]}
        topBorder
      />

      <Block
        items={[
          { label: 'Cobros 30d', valor: `+${fmtEur0(cobros30d)}`, color: COLOR.verde },
          { label: 'Pagos 30d',  valor: `-${fmtEur0(pagos30d)}`,  color: COLOR.rojo  },
          { label: 'Proyección 30d', valor: fmtEur0(proy30d), bold: true },
        ]}
        gap={8}
      />

      <div style={{ marginTop: 12, height: 6, borderRadius: 3, background: COLOR.verde, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: -2, width: 10, height: 10, borderRadius: '50%', background: COLOR.verde, border: '2px solid #fff' }} />
        <div style={{ position: 'absolute', right: 0, top: -2, width: 10, height: 10, borderRadius: '50%', background: COLOR.verdeOscuro, border: '2px solid #fff' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: COLOR.textMut, marginTop: 4, fontFamily: LEXEND }}>
        <span>Hoy</span>
        <span>30d</span>
      </div>
    </div>
  )
}

interface BlockProps {
  items: Array<{ label: string; valor: string; color?: string; bold?: boolean }>
  topBorder?: boolean
  gap?: number
}

function Block({ items, topBorder, gap }: BlockProps) {
  return (
    <div style={{
      marginTop: gap ?? 14,
      paddingTop: topBorder ? 10 : 0,
      borderTop: topBorder ? `0.5px solid ${COLOR.borde}` : undefined,
    }}>
      {items.map((it, i) => (
        <div key={i} style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          fontFamily: LEXEND,
          fontWeight: it.bold ? 500 : 400,
          marginTop: it.bold ? 6 : 0,
          color: it.bold ? COLOR.textPri : undefined,
        }}>
          <span style={{ color: it.bold ? COLOR.textPri : COLOR.textMut }}>{it.label}</span>
          <span style={{ color: it.color ?? (it.bold ? COLOR.textPri : COLOR.textPri) }}>{it.valor}</span>
        </div>
      ))}
    </div>
  )
}
