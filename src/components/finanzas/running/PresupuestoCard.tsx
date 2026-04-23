import React from 'react';
import { fmtEur } from '@/lib/format';

interface Props {
  nombre: string;
  gasto: number;
  tope: number;
  status: 'ok' | 'warn' | 'bad';
  ritmoPorDia?: number;
  diasRestantes: number;
}

const BG: Record<Props['status'], { bg: string; border: string; fill: string; badgeBg: string; badgeText: string; badgeLabel: string }> = {
  ok: {
    bg: 'var(--rf-presup-ok-bg)',
    border: 'var(--rf-presup-ok-border)',
    fill: 'var(--rf-bar-good)',
    badgeBg: 'rgba(26,135,84,0.12)',
    badgeText: 'var(--rf-green)',
    badgeLabel: 'EN RITMO',
  },
  warn: {
    bg: 'var(--rf-presup-warn-bg)',
    border: 'var(--rf-presup-warn-border)',
    fill: 'var(--rf-bar-warn)',
    badgeBg: 'rgba(232,154,60,0.18)',
    badgeText: '#b06c00',
    badgeLabel: 'AL LÍMITE',
  },
  bad: {
    bg: 'var(--rf-presup-bad-bg)',
    border: 'var(--rf-presup-bad-border)',
    fill: 'var(--rf-bar-bad)',
    badgeBg: 'rgba(196,48,43,0.15)',
    badgeText: 'var(--rf-red)',
    badgeLabel: 'SUPERADO',
  },
};

export default function PresupuestoCard({ nombre, gasto, tope, status, ritmoPorDia, diasRestantes }: Props) {
  const style = BG[status];
  const pctNum = tope > 0 ? Math.round((gasto / tope) * 100) : 0;
  const queda = tope - gasto;

  return (
    <div
      style={{
        background: style.bg,
        border: `0.5px solid ${style.border}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span
          className="rf-font-header"
          style={{ fontSize: 12, letterSpacing: '0.1em', color: 'var(--rf-text-primary)', fontWeight: 500, textTransform: 'uppercase' }}
        >
          {nombre}
        </span>
        <span
          className="rf-font-header"
          style={{
            fontSize: 10,
            letterSpacing: '0.08em',
            padding: '3px 8px',
            borderRadius: 4,
            fontWeight: 500,
            background: style.badgeBg,
            color: style.badgeText,
          }}
        >
          {style.badgeLabel}
        </span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--rf-text-primary)', lineHeight: 1, marginBottom: 3 }}>
        {fmtEur(gasto)}
        <span style={{ fontSize: 12, color: 'var(--rf-text-secondary)', fontWeight: 400, marginLeft: 4 }}>gasto</span>
      </div>
      <div style={{ fontSize: 14, color: 'var(--rf-text-secondary)', marginBottom: 12 }}>
        {fmtEur(tope)}
        <span style={{ fontSize: 11 }}> tope</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--rf-text-secondary)', marginBottom: 4 }}>
        <span>{status === 'bad' ? 'Superado' : 'Consumido'}</span>
        <span style={{ fontWeight: 500, color: 'var(--rf-text-primary)' }}>{pctNum}%</span>
      </div>
      <div style={{ height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, background: style.fill, width: `${Math.min(100, pctNum)}%` }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--rf-text-muted)', textAlign: 'right', marginTop: 6 }}>
        {status === 'bad'
          ? `Excedido en ${fmtEur(Math.abs(queda))}`
          : ritmoPorDia !== undefined
          ? `Ritmo: ${fmtEur(ritmoPorDia, { decimals: 2 })}/día · queda ${fmtEur(queda)}`
          : `Queda ${fmtEur(queda)} · ${diasRestantes}d`}
      </div>
    </div>
  );
}
