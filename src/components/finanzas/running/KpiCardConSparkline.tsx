import type { CSSProperties, ReactNode } from 'react';
import { useTheme, FONT } from '@/styles/tokens';

interface Props {
  label: string;
  value: string;
  valueColor?: string;
  delta?: { value: number; sign: 'up' | 'down' | 'neutral'; favorable?: 'up' | 'down' };
  legend?: string;
  chart?: ReactNode;
}

const VERDE = '#06C167';
const ROJO  = '#B01D23';

export default function KpiCardConSparkline({ label, value, valueColor, delta, legend, chart }: Props) {
  const { T } = useTheme();

  let deltaColor = T.mut;
  let deltaIcon  = '·';
  if (delta && delta.sign !== 'neutral') {
    deltaIcon = delta.sign === 'up' ? '▲' : '▼';
    const fav = delta.favorable ?? 'up';
    const isFav = delta.sign === fav;
    deltaColor = isFav ? VERDE : ROJO;
  }

  const wrap: CSSProperties = {
    backgroundColor: T.card,
    border: `1px solid ${T.brd}`,
    borderRadius: 14,
    padding: '20px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minHeight: 168,
  };

  const labelStyle: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    color: T.mut,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    fontWeight: 500,
    marginBottom: 6,
  };

  const valueStyle: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 36,
    fontWeight: 600,
    lineHeight: 1,
    color: valueColor ?? T.pri,
    letterSpacing: '-0.01em',
  };

  return (
    <div style={wrap}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>
      {delta && (
        <div style={{ fontFamily: FONT.body, fontSize: 12, color: deltaColor, marginTop: 4, fontWeight: 500 }}>
          {deltaIcon} {Math.abs(delta.value)}% vs periodo anterior
        </div>
      )}
      {legend && (
        <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 2 }}>
          {legend}
        </div>
      )}
      {chart && <div style={{ marginTop: 'auto', paddingTop: 12 }}>{chart}</div>}
    </div>
  );
}
