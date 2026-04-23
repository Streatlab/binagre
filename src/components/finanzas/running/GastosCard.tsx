import React from 'react';
import { fmtEur } from '@/lib/format';
import type { Categoria } from '@/lib/running';
import { CATEGORIA_NOMBRE, CATEGORIA_COLOR } from '@/lib/running';

interface Row {
  categoria: Categoria;
  total: number;
  pctSobreBruto: number;
  pctMin: number;
  pctMax: number;
  status: 'ok'|'warn'|'bad';
  deltaPct: number;
  deltaSign: 'up'|'down'|'neutral';
}

interface Props {
  periodoLabel: string;
  totalGasto: number;
  totalGastoAnt: number;
  rows: Row[];
  ratio: number;
}

const STATUS_COLOR = {
  ok: 'var(--rf-green)',
  warn: 'var(--rf-yellow)',
  bad: 'var(--rf-red)',
};

export default function GastosCard({ periodoLabel, totalGasto, totalGastoAnt, rows, ratio }: Props) {
  const delta = totalGastoAnt ? ((totalGasto - totalGastoAnt) / totalGastoAnt) * 100 : 0;
  const deltaSign: 'up'|'down'|'neutral' = Math.abs(delta) < 0.5 ? 'neutral' : delta > 0 ? 'up' : 'down';
  const deltaColor = deltaSign === 'up' ? 'var(--rf-red)' : deltaSign === 'down' ? 'var(--rf-green)' : 'var(--rf-text-2)';

  return (
    <div style={{
      background: 'var(--rf-bg-card)',
      border: '1px solid var(--rf-border)',
      borderRadius: 16,
      padding: 28,
    }}>
      <div style={{
        fontFamily: 'Oswald, sans-serif',
        fontSize: 11,
        letterSpacing: '0.14em',
        color: 'var(--rf-text-label)',
        fontWeight: 500,
        marginBottom: 14,
        textTransform: 'uppercase',
      }}>Gastos · {periodoLabel}</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 8 }}>
        <span style={{ fontSize: 44, fontWeight: 700, color: 'var(--rf-text)', lineHeight: 1, letterSpacing: '-0.02em' }}>
          {fmtEur(totalGasto)}
        </span>
        <span style={{ fontSize: 13, color: deltaColor }}>
          {deltaSign === 'up' ? '▲' : deltaSign === 'down' ? '▼' : '—'} {Math.abs(Math.round(delta))}% vs periodo anterior
        </span>
      </div>

      <div style={{
        padding: '10px 14px',
        background: 'var(--rf-bg-panel)',
        borderRadius: 8,
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, color: 'var(--rf-text-2)' }}>Ratio gastos / facturación bruta</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--rf-text)' }}>{ratio.toFixed(1)}%</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => (
          <div key={r.categoria}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%', background: CATEGORIA_COLOR[r.categoria], flexShrink: 0,
              }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--rf-text)' }}>
                {CATEGORIA_NOMBRE[r.categoria]}
                <span style={{ fontSize: 10, color: 'var(--rf-text-muted)', marginLeft: 6 }}>
                  objetivo {r.pctMin}-{r.pctMax}%
                </span>
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--rf-text)', minWidth: 90, textAlign: 'right' }}>
                {fmtEur(r.total)}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 600, color: STATUS_COLOR[r.status], minWidth: 52, textAlign: 'right',
              }}>
                {r.pctSobreBruto.toFixed(1)}%
              </span>
            </div>
            <div style={{ height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${Math.min(100, (r.pctSobreBruto / r.pctMax) * 100)}%`,
                background: STATUS_COLOR[r.status], borderRadius: 2,
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
