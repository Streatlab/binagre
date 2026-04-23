import type { CSSProperties } from 'react';
import { useTheme, FONT, kpiValueStyle } from '@/styles/tokens';
import { fmtEur } from '@/utils/format';
import type { Categoria } from '@/lib/running';
import { CATEGORIA_NOMBRE, CATEGORIA_COLOR } from '@/lib/running';

const VERDE = '#06C167';
const ROJO  = '#B01D23';
const AMBAR = '#f5a623';

const STATUS_COLOR: Record<'ok'|'warn'|'bad', string> = {
  ok:   VERDE,
  warn: AMBAR,
  bad:  ROJO,
};

interface Row {
  categoria: Categoria;
  total: number;
  pctSobreBruto: number;
  pctMin: number;
  pctMax: number;
  status: 'ok'|'warn'|'bad';
}

interface Props {
  periodoLabel: string;
  totalGasto: number;
  totalGastoAnt: number;
  rows: Row[];
  ratio: number;
}

export default function GastosCard({ periodoLabel, totalGasto, totalGastoAnt, rows, ratio }: Props) {
  const { T } = useTheme();

  const deltaPct = totalGastoAnt !== 0 ? ((totalGasto - totalGastoAnt) / totalGastoAnt) * 100 : 0;
  const deltaSym = deltaPct > 0 ? '▲' : deltaPct < 0 ? '▼' : '·';
  const deltaColor = deltaPct > 0 ? ROJO : deltaPct < 0 ? VERDE : T.mut;

  const wrap: CSSProperties = {
    backgroundColor: T.card,
    border: `1px solid ${T.brd}`,
    borderRadius: 14,
    padding: '22px 24px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  };

  const labelStyle: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    color: T.mut,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    fontWeight: 500,
    marginBottom: 8,
  };

  return (
    <div style={wrap}>
      <div style={labelStyle}>GASTOS · {periodoLabel.toUpperCase()}</div>
      <div style={{ ...kpiValueStyle(T), marginBottom: 4 }}>{fmtEur(totalGasto)}</div>
      <div style={{ fontFamily: FONT.body, fontSize: 12, color: deltaColor, marginTop: 4, fontWeight: 500 }}>
        {deltaSym} {Math.abs(Math.round(deltaPct))}% vs periodo anterior
      </div>

      <div style={{
        marginTop: 12,
        padding: '8px 12px',
        background: T.group,
        borderRadius: 8,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: FONT.body,
        fontSize: 12,
        color: T.pri,
      }}>
        <span style={{ color: T.mut }}>Ratio gastos / facturación bruta</span>
        <span style={{ fontFamily: FONT.heading, fontWeight: 500, letterSpacing: 0.5 }}>{ratio.toFixed(1)}%</span>
      </div>

      <div style={{ height: 1, backgroundColor: T.brd, margin: '14px 0' }} />

      {rows.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13, padding: 20 }}>
          Sin gastos en este periodo
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(r => {
            const colorBarra = STATUS_COLOR[r.status];
            const fillPct = Math.min(100, (r.pctSobreBruto / Math.max(r.pctMax, 1)) * 100);
            return (
              <div key={r.categoria}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORIA_COLOR[r.categoria], flexShrink: 0 }} />
                  <span style={{ flex: 1, fontFamily: FONT.body, fontSize: 13, color: T.pri }}>
                    {CATEGORIA_NOMBRE[r.categoria]}
                    <span style={{ fontFamily: FONT.body, fontSize: 10, color: T.mut, marginLeft: 6 }}>
                      objetivo {r.pctMin}-{r.pctMax}%
                    </span>
                  </span>
                  <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, fontWeight: 500, minWidth: 86, textAlign: 'right' }}>
                    {fmtEur(r.total)}
                  </span>
                  <span style={{ fontFamily: FONT.heading, fontSize: 11, color: colorBarra, fontWeight: 500, minWidth: 50, textAlign: 'right', letterSpacing: 0.5 }}>
                    {r.pctSobreBruto.toFixed(1)}%
                  </span>
                </div>
                <div style={{ height: 3, background: T.bg, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${fillPct}%`, background: colorBarra, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
