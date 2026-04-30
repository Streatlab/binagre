import { COLOR, OSWALD, LEXEND, lbl, lblXs, fmtEur0 } from './tokens'
import type { CanalStat } from './types'

interface Props {
  canales: CanalStat[]
}

export default function ColFacturacionCanal({ canales }: Props) {
  const map = new Map(canales.map(c => [c.id, c]))

  const uber  = map.get('uber')
  const glovo = map.get('glovo')
  const je    = map.get('je')
  const web   = map.get('web')
  const dir   = map.get('dir')

  return (
    <div>
      <div style={{ ...lbl, marginBottom: 10 }}>FACTURACIÓN POR CANAL</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        <CardCanal
          label="UBER EATS"
          bg={`${COLOR.uber}20`}
          border={COLOR.uber}
          colorLabel={COLOR.verdeOscuro}
          colorBruto={COLOR.verdeOscuro}
          colorBrutoSub={COLOR.verdeOscuro}
          stat={uber}
        />

        <CardCanal
          label="GLOVO"
          bg={`${COLOR.glovo}30`}
          border={COLOR.glovoDark}
          borderWidth="1px"
          colorLabel={COLOR.glovoDark}
          colorBruto={COLOR.glovoTexto}
          colorBrutoSub={COLOR.glovoDark}
          stat={glovo}
        />

        <CardCanal
          label="JUST EAT"
          bg={`${COLOR.je}20`}
          border={COLOR.je}
          colorLabel={COLOR.jeDark}
          colorBruto={COLOR.jeDark}
          colorBrutoSub={COLOR.jeDark}
          stat={je}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <CardCanalMini
            label="WEB"
            bg={`${COLOR.webSL}10`}
            border={`${COLOR.webSL}50`}
            colorLabel={COLOR.webDark}
            colorBruto={COLOR.webDark}
            stat={web}
          />
          <CardCanalMini
            label="DIRECTA"
            bg={`${COLOR.directa}20`}
            border={COLOR.directa}
            colorLabel={COLOR.directaDark}
            colorBruto={COLOR.directaDark}
            stat={dir}
          />
        </div>
      </div>
    </div>
  )
}

interface CardCanalProps {
  label: string
  bg: string
  border: string
  borderWidth?: string
  colorLabel: string
  colorBruto: string
  colorBrutoSub: string
  stat: CanalStat | undefined
}

function CardCanal({ label, bg, border, borderWidth = '0.5px', colorLabel, colorBruto, colorBrutoSub, stat }: CardCanalProps) {
  const tieneDatos = (stat?.bruto ?? 0) > 0
  return (
    <div style={{
      background: bg,
      border: `${borderWidth} solid ${border}`,
      borderRadius: 14,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <div>
        <div style={{ ...lblXs, color: colorLabel }}>{label}</div>
        <div style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 600, color: colorBruto, marginTop: 2 }}>
          {tieneDatos ? fmtEur0(stat!.bruto) : 'Datos insuficientes'}
        </div>
        <div style={{ fontSize: 11, color: colorBrutoSub, fontFamily: LEXEND }}>bruto</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: OSWALD, fontSize: 20, fontWeight: 600, color: COLOR.verde }}>
          {tieneDatos ? fmtEur0(stat!.neto) : '—'}
        </div>
        <div style={{ fontSize: 14, color: COLOR.verde, fontFamily: LEXEND }}>
          {tieneDatos ? `Margen ${Math.round(stat!.margen)}%` : ''}
        </div>
      </div>
    </div>
  )
}

function CardCanalMini({ label, bg, border, colorLabel, colorBruto, stat }: Omit<CardCanalProps, 'colorBrutoSub'>) {
  const tieneDatos = (stat?.bruto ?? 0) > 0
  return (
    <div style={{
      background: bg,
      border: `0.5px solid ${border}`,
      borderRadius: 14,
      padding: '10px 12px',
    }}>
      <div style={{ ...lblXs, color: colorLabel }}>{label}</div>
      <div style={{ fontFamily: OSWALD, fontSize: 15, fontWeight: 600, color: colorBruto, marginTop: 2 }}>
        {tieneDatos ? fmtEur0(stat!.bruto) : '— €'}
      </div>
      <div style={{ fontSize: 10, color: COLOR.textMut, fontFamily: LEXEND }}>
        {tieneDatos ? `${fmtEur0(stat!.neto)} neto · ${Math.round(stat!.margen)}%` : 'sin datos'}
      </div>
    </div>
  )
}
