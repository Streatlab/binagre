import type { CSSProperties } from 'react';
import { useTheme, FONT } from '@/styles/tokens';
import { fmtEur } from '@/utils/format';

interface MarcaRow {
  marca: string;
  bruto: number;
  pedidos: number;
  tm: number;
  deltaPct: number | null;
}

interface Props {
  periodoLabel: string;
  rows?: MarcaRow[];
}

const VERDE = '#06C167';
const ROJO  = '#B01D23';

export default function MarcasCard({ periodoLabel, rows = [] }: Props) {
  const { T } = useTheme();

  const wrap: CSSProperties = {
    backgroundColor: T.card,
    border: `1px solid ${T.brd}`,
    borderRadius: 14,
    padding: '22px 24px',
    display: 'flex',
    flexDirection: 'column',
  };

  const labelStyle: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    color: T.mut,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    fontWeight: 500,
    marginBottom: 14,
  };

  if (rows.length === 0) {
    return (
      <div style={wrap}>
        <div style={labelStyle}>INGRESOS POR MARCA · {periodoLabel.toUpperCase()}</div>
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          fontFamily: FONT.body,
          fontSize: 13,
          color: T.mut,
          background: T.group,
          borderRadius: 10,
          border: `1px dashed ${T.brd}`,
        }}>
          Sin datos de ventas por marca todavía. Importa CSV desde plataformas en el módulo de importación (próximamente).
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={labelStyle}>INGRESOS POR MARCA · {periodoLabel.toUpperCase()}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {rows.map(m => {
          const deltaColor = m.deltaPct == null ? T.mut : m.deltaPct > 0 ? VERDE : m.deltaPct < 0 ? ROJO : T.mut;
          const deltaSym = m.deltaPct == null ? '·' : m.deltaPct > 0 ? '▲' : m.deltaPct < 0 ? '▼' : '·';
          return (
            <div key={m.marca} style={{
              background: T.group,
              border: `1px solid ${T.brd}`,
              borderRadius: 10,
              padding: '14px 16px',
            }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 12, color: T.pri, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 500, marginBottom: 6 }}>
                {m.marca}
              </div>
              <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: T.pri, lineHeight: 1, marginBottom: 4 }}>
                {fmtEur(m.bruto)}
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginBottom: 6 }}>
                {m.pedidos} pedidos · TM {fmtEur(m.tm)}
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 11, color: deltaColor, fontWeight: 500 }}>
                {deltaSym} {m.deltaPct == null ? '—' : `${Math.abs(Math.round(m.deltaPct))}%`} vs anterior
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
