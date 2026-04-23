import React from 'react';

interface Props {
  label: string;
  value: string;
  valueColor?: string;
  sub?: React.ReactNode;
  subVariant?: 'up' | 'down' | 'warn' | 'neutral';
}

const SUB_COLOR: Record<NonNullable<Props['subVariant']>, string> = {
  up: 'var(--rf-green)',
  down: 'var(--rf-red)',
  warn: 'var(--rf-yellow)',
  neutral: 'var(--rf-text-secondary)',
};

export default function KpiCard({ label, value, valueColor, sub, subVariant = 'neutral' }: Props) {
  return (
    <div
      style={{
        background: 'var(--rf-bg-card)',
        border: '0.5px solid var(--rf-border-card)',
        borderRadius: 12,
        padding: 18,
      }}
    >
      <div
        className="rf-font-header"
        style={{
          fontSize: 11,
          letterSpacing: '0.12em',
          color: 'var(--rf-text-label)',
          fontWeight: 500,
          marginBottom: 10,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        className="rf-font-body"
        style={{
          fontSize: 30,
          fontWeight: 600,
          color: valueColor || 'var(--rf-text-primary)',
          lineHeight: 1,
          marginBottom: 6,
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </div>
      {sub !== undefined && (
        <div style={{ fontSize: 12, color: SUB_COLOR[subVariant], fontWeight: 400 }}>{sub}</div>
      )}
    </div>
  );
}
