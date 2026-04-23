import type { CSSProperties } from 'react';
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
  'Uber Eats':     '#06C167',
  'Glovo':         '#e8f442',
  'Just Eat':      '#f5a623',
  'Web':           '#B01D23',
  'Directa':       '#66aaff',
};

// Comisión media estimada plataformas (mientras no tengamos histórico cerrado).
const COMISION_ESTIMADA = 0.30;

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
  periodoCerrado: boolean; // true si han pasado ≥ 45 días desde el fin del periodo
}

export default function IngresosCardDonut({
  totalBruto,
  totalNeto,
  totalBrutoAnt,
  totalNetoAnt,
  rowsBruto,
  rowsNeto,
  periodoLabel,
  periodoCerrado,
}: Props) {
  const { T } = useTheme();

  const hayBruto = totalBruto > 0;
  const hayNeto  = totalNeto > 0;

  /* — Número grande: bruto cuando existe, sino neto — */
  const bigValue    = hayBruto ? totalBruto : totalNeto;
  const bigValueAnt = hayBruto ? totalBrutoAnt : totalNetoAnt;

  /* — Breakdown: SIEMPRE neto cuando exista (cuadra con el KPI "Ingresos netos") — */
  const breakdownRows  = hayNeto ? rowsNeto : rowsBruto;
  const breakdownTotal = hayNeto ? totalNeto : totalBruto;
  const breakdownLabel = hayNeto ? 'Neto por canal' : 'Bruto por canal';

  const deltaPct   = bigValueAnt !== 0 ? ((bigValue - bigValueAnt) / bigValueAnt) * 100 : 0;
  const deltaColor = deltaPct > 0 ? VERDE : deltaPct < 0 ? ROJO : T.mut;
  const deltaSym   = deltaPct > 0 ? '▲' : deltaPct < 0 ? '▼' : '·';

  /* — Comisión y dinero en tránsito — */
  const comisionReal    = hayBruto && hayNeto ? totalBruto - totalNeto : 0;
  const comisionRealPct = hayBruto && totalBruto > 0 ? (comisionReal / totalBruto) * 100 : 0;
  const netoEsperado    = totalBruto * (1 - COMISION_ESTIMADA);
  const enTransito      = Math.max(0, netoEsperado - totalNeto);
  const comisionEstEur  = totalBruto * COMISION_ESTIMADA;

  const rows = breakdownRows
    .filter(r => r.importe > 0)
    .map(r => ({ name: r.canal, value: r.importe, color: COLOR_CANAL[r.canal] ?? '#888' }))
    .sort((a, b) => b.value - a.value);

  const maxValue = rows[0]?.value ?? 1;

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

  const infoLine: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    fontFamily: FONT.body,
    fontSize: 12,
    padding: '3px 0',
  };

  return (
    <div style={wrap}>
      <div style={labelStyle}>INGRESOS · {periodoLabel.toUpperCase()}</div>
      <div style={{ ...kpiValueStyle(T), marginBottom: 4 }}>{fmtEur(bigValue)}</div>
      <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 2, letterSpacing: 0.2 }}>
        {hayBruto ? 'Bruto facturado' : hayNeto ? 'Neto recibido' : 'Sin ingresos'}
      </div>
      <div style={{ fontFamily: FONT.body, fontSize: 12, color: deltaColor, marginTop: 6, fontWeight: 500 }}>
        {deltaSym} {Math.abs(Math.round(deltaPct))}% vs periodo anterior
      </div>

      {hayBruto && hayNeto && (
        <div style={{ marginTop: 14, padding: '10px 12px', background: T.group, borderRadius: 8 }}>
          <div style={infoLine}>
            <span style={{ color: T.mut }}>Neto recibido</span>
            <span style={{ color: T.pri, fontWeight: 500, fontFamily: FONT.heading, letterSpacing: 0.3 }}>{fmtEur(totalNeto)}</span>
          </div>
          {periodoCerrado ? (
            <div style={infoLine}>
              <span style={{ color: T.mut }}>Comisión real</span>
              <span style={{ color: ROJO, fontWeight: 500, fontFamily: FONT.heading, letterSpacing: 0.3 }}>
                −{fmtEur(comisionReal)} ({comisionRealPct.toFixed(1)}%)
              </span>
            </div>
          ) : (
            <>
              <div style={infoLine}>
                <span style={{ color: T.mut }}>En tránsito <span style={{ fontSize: 10, opacity: 0.7 }}>estimado</span></span>
                <span style={{ color: T.pri, fontFamily: FONT.heading, letterSpacing: 0.3 }}>{fmtEur(enTransito)}</span>
              </div>
              <div style={infoLine}>
                <span style={{ color: T.mut }}>Comisión plataformas <span style={{ fontSize: 10, opacity: 0.7 }}>~{Math.round(COMISION_ESTIMADA * 100)}%</span></span>
                <span style={{ color: ROJO, fontFamily: FONT.heading, letterSpacing: 0.3 }}>−{fmtEur(comisionEstEur)}</span>
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 10, color: T.mut, fontStyle: 'italic', marginTop: 4 }}>
                Liquidaciones en curso — comisión real disponible al cierre de mes
              </div>
            </>
          )}
        </div>
      )}

      <div style={{ height: 1, backgroundColor: T.brd, margin: '16px 0' }} />

      {rows.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13, padding: 30 }}>
          Sin ingresos en este periodo
        </div>
      ) : (
        <>
          <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginBottom: 8, letterSpacing: 0.3 }}>
            {breakdownLabel}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map(r => {
              const pct = breakdownTotal > 0 ? (r.value / breakdownTotal) * 100 : 0;
              const fillPct = maxValue > 0 ? (r.value / maxValue) * 100 : 0;
              return (
                <div key={r.name}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{r.name}</span>
                    <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, fontWeight: 500, minWidth: 86, textAlign: 'right' }}>
                      {fmtEur(r.value)}
                    </span>
                    <span style={{ fontFamily: FONT.heading, fontSize: 11, color: T.mut, fontWeight: 500, minWidth: 44, textAlign: 'right', letterSpacing: 0.5 }}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ height: 4, background: T.bg, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${fillPct}%`, background: r.color, borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
