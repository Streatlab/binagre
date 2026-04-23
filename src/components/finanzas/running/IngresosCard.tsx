import React from 'react';
import { fmtEur } from '@/lib/format';

interface CanalRow {
  canal: string;
  bruto: number;
  neto: number;
  color: string;
  bgColor: string;
}

interface Props {
  periodoLabel: string;
  rows: CanalRow[];
}

export default function IngresosCard({ periodoLabel, rows }: Props) {
  const totalBruto = rows.reduce((a, r) => a + r.bruto, 0);
  const totalNeto = rows.reduce((a, r) => a + r.neto, 0);
  const comisiones = totalBruto - totalNeto;
  const pctRetencion = totalBruto ? (comisiones / totalBruto) * 100 : 0;

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
      }}>Facturación · {periodoLabel}</div>

      <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--rf-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Bruto plataformas</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--rf-text)', lineHeight: 1 }}>{fmtEur(totalBruto)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--rf-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Neto recibido</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--rf-green)', lineHeight: 1 }}>{fmtEur(totalNeto)}</div>
        </div>
      </div>

      <div style={{
        padding: '10px 14px',
        background: 'var(--rf-red-soft)',
        borderRadius: 8,
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, color: 'var(--rf-red)', fontWeight: 500 }}>Retenido por plataformas</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--rf-red)' }}>
          {fmtEur(comisiones)} · {pctRetencion.toFixed(1)}%
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r) => {
          const retenido = r.bruto - r.neto;
          const pctRet = r.bruto ? (retenido / r.bruto) * 100 : 0;
          return (
            <div key={r.canal} style={{
              background: r.bgColor,
              borderRadius: 8,
              padding: '10px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: r.color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>{r.canal}</span>
                <span style={{ fontSize: 11, color: 'var(--rf-text-2)' }}>
                  −{pctRet.toFixed(0)}% comisión
                </span>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                <span style={{ color: 'var(--rf-text-2)' }}>Bruto <strong style={{ color: 'var(--rf-text)' }}>{fmtEur(r.bruto)}</strong></span>
                <span style={{ color: 'var(--rf-text-2)' }}>Neto <strong style={{ color: 'var(--rf-green)' }}>{fmtEur(r.neto)}</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
