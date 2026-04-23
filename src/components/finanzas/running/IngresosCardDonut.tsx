import type { CSSProperties } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useTheme, FONT, kpiValueStyle } from '@/styles/tokens';
import { fmtEur } from '@/utils/format';

const VERDE = '#06C167';
const ROJO  = '#B01D23';

export const COLOR_CANAL: Record<string, string> = {
  'UBER EATS':     '#06C167',
  'GLOVO':         '#e8f442',
  'JUST EAT':      '#f5a623',
  'TIENDA ONLINE': '#B01D23',
  'CAJA':          '#66aaff',
  // fallbacks comunes
  'Uber Eats':     '#06C167',
  'Glovo':         '#e8f442',
  'Just Eat':      '#f5a623',
  'Web':           '#B01D23',
  'Directa':       '#66aaff',
};

interface CanalRow {
  canal: string;
  importe: number;
}

interface Props {
  totalBruto: number;
  totalNeto: number;
  totalBrutoAnt: number;
  totalNetoAnt: number;
  rowsBruto: CanalRow[];
  rowsNeto: CanalRow[];
  periodoLabel: string;
}

export default function IngresosCardDonut({
  totalBruto,
  totalNeto,
  totalBrutoAnt,
  totalNetoAnt,
  rowsBruto,
  rowsNeto,
  periodoLabel,
}: Props) {
  const { T } = useTheme();

  const hayBruto = totalBruto > 0;
  const hayNeto  = totalNeto > 0;

  const totalRef    = hayBruto ? totalBruto : totalNeto;
  const totalRefAnt = hayBruto ? totalBrutoAnt : totalNetoAnt;
  const rowsRef     = hayBruto ? rowsBruto : rowsNeto;

  const deltaPct = totalRefAnt !== 0 ? ((totalRef - totalRefAnt) / totalRefAnt) * 100 : 0;
  const deltaColor = deltaPct > 0 ? VERDE : deltaPct < 0 ? ROJO : T.mut;
  const deltaSym = deltaPct > 0 ? '▲' : deltaPct < 0 ? '▼' : '·';

  const data = rowsRef
    .filter(r => r.importe > 0)
    .map(r => ({ name: r.canal, value: r.importe, color: COLOR_CANAL[r.canal] ?? '#888' }))
    .sort((a, b) => b.value - a.value);

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

  const subLabel = hayBruto && hayNeto ? 'Bruto · Neto' : hayNeto ? 'Neto recibido' : 'Facturación bruta';

  return (
    <div style={wrap}>
      <div style={labelStyle}>INGRESOS · {periodoLabel.toUpperCase()}</div>

      {hayBruto && hayNeto ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ ...kpiValueStyle(T) }}>{fmtEur(totalBruto)}</div>
          <span style={{ fontFamily: FONT.body, fontSize: 14, color: T.mut }}>·</span>
          <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 500, color: T.pri, letterSpacing: '-0.01em' }}>
            {fmtEur(totalNeto)}
          </div>
        </div>
      ) : (
        <div style={{ ...kpiValueStyle(T), marginBottom: 4 }}>{fmtEur(totalRef)}</div>
      )}

      <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 2, letterSpacing: 0.3 }}>
        {subLabel}
      </div>

      <div style={{ fontFamily: FONT.body, fontSize: 12, color: deltaColor, marginTop: 6, fontWeight: 500 }}>
        {deltaSym} {Math.abs(Math.round(deltaPct))}% vs periodo anterior
      </div>

      <div style={{ height: 1, backgroundColor: T.brd, margin: '16px 0' }} />

      {data.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13, padding: 30 }}>
          Sin ingresos en este periodo
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 20, alignItems: 'center' }} className="rf-donut-grid">
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: T.card, border: `1px solid ${T.brd}`, color: T.pri, fontFamily: FONT.body, borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => fmtEur(Number(v))}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.map(d => {
              const pct = totalRef > 0 ? (d.value / totalRef) * 100 : 0;
              return (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontFamily: FONT.body, fontSize: 12, color: T.pri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.name}
                  </span>
                  <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.pri, fontWeight: 500 }}>
                    {fmtEur(d.value)}
                  </span>
                  <span style={{ fontFamily: FONT.heading, fontSize: 11, color: T.mut, letterSpacing: 0.5, minWidth: 36, textAlign: 'right' }}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <style>{`@media (max-width: 640px) { .rf-donut-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
