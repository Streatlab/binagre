import React from 'react';

export interface BreakdownRow {
  color: string;
  name: string;
  value: string;
  delta?: { sign: 'up' | 'down' | 'neutral'; valueAbs: number };
  pct: number;
}

interface Props {
  header: string;
  value: string;
  trend?: { sign: 'up' | 'down' | 'neutral'; text: string };
  rows: BreakdownRow[];
}

const TREND_COLOR = {
  up: 'var(--rf-green)',
  down: 'var(--rf-red)',
  neutral: 'var(--rf-text-secondary)',
};

export default function BigBreakdownCard({ header, value, trend, rows }: Props) {
  return (
    <div
      style={{
        background: 'var(--rf-bg-card)',
        border: '0.5px solid var(--rf-border-card)',
        borderRadius: 12,
        padding: 22,
      }}
    >
      <div
        className="rf-font-header"
        style={{
          fontSize: 11,
          letterSpacing: '0.12em',
          color: 'var(--rf-text-label)',
          fontWeight: 500,
          marginBottom: 12,
          textTransform: 'uppercase',
        }}
      >
        {header}
      </div>
      <div
        className="rf-font-body"
        style={{
          fontSize: 36,
          fontWeight: 600,
          color: 'var(--rf-text-primary)',
          lineHeight: 1,
          marginBottom: 8,
          letterSpacing: '-0.015em',
        }}
      >
        {value}
      </div>
      {trend && (
        <div
          style={{
            fontSize: 12,
            color: TREND_COLOR[trend.sign],
            marginBottom: 18,
            paddingBottom: 18,
            borderBottom: '0.5px solid var(--rf-border-card)',
          }}
        >
          <span style={{ fontSize: 11, marginRight: 2 }}>
            {trend.sign === 'up' ? '▲' : trend.sign === 'down' ? '▼' : '—'}
          </span>
          {trend.text}
        </div>
      )}
      {rows.map((r, i) => (
        <div key={i}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                flexShrink: 0,
                background: r.color,
              }}
            />
            <span style={{ flex: 1, fontSize: 13, color: 'var(--rf-text-primary)' }}>{r.name}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--rf-text-primary)', minWidth: 80, textAlign: 'right' }}>
              {r.value}
            </span>
            <span
              style={{
                fontSize: 11,
                minWidth: 44,
                textAlign: 'right',
                color:
                  r.delta?.sign === 'up'
                    ? 'var(--rf-green)'
                    : r.delta?.sign === 'down'
                    ? 'var(--rf-red)'
                    : 'var(--rf-text-secondary)',
              }}
            >
              {r.delta
                ? r.delta.sign === 'neutral'
                  ? '—'
                  : `${r.delta.sign === 'up' ? '▲' : '▼'} ${r.delta.valueAbs}%`
                : ''}
            </span>
            <span style={{ fontSize: 11, color: 'var(--rf-text-muted)', minWidth: 32, textAlign: 'right' }}>
              {r.pct}%
            </span>
          </div>
          <div
            style={{
              height: 3,
              background: r.color,
              borderRadius: 2,
              marginTop: 2,
              marginBottom: 4,
              opacity: 0.7,
              width: `${Math.min(100, r.pct)}%`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
