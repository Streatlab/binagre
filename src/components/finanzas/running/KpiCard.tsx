import React from 'react';

interface Props {
  label: string;
  value: string;
  valueColor?: string;
  sub?: React.ReactNode;
  subVariant?: 'up'|'down'|'warn'|'neutral';
}

const SUB_COLOR: Record<NonNullable<Props['subVariant']>, string> = {
  up: 'var(--rf-green)',
  down: 'var(--rf-red)',
  warn: 'var(--rf-yellow)',
  neutral: 'var(--rf-text-2)',
};

export default function KpiCard({ label, value, valueColor, sub, subVariant = 'neutral' }: Props) {
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
      }}>{label}</div>
      <div style={{
        fontFamily: 'Lexend, sans-serif',
        fontSize: 44,
        fontWeight: 700,
        color: valueColor || 'var(--rf-text)',
        lineHeight: 1,
        marginBottom: 8,
        letterSpacing: '-0.02em',
      }}>{value}</div>
      {sub !== undefined && (
        <div style={{ fontSize: 12, color: SUB_COLOR[subVariant], fontWeight: 400 }}>{sub}</div>
      )}
    </div>
  );
}
