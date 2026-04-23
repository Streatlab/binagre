import React from 'react';
import { fmtEur } from '@/lib/format';
import type { TesoreriaRow } from '@/hooks/useRunningFinanciero';

interface Props {
  tesoreria: TesoreriaRow | null;
  ingNetoMes: number;
  mesNombreCorto: string;
}

export default function TesoreriaCard({ tesoreria, ingNetoMes, mesNombreCorto }: Props) {
  const caja = tesoreria?.caja_liquida ?? 0;
  const cobros = tesoreria?.cobros_pendientes ?? 0;
  const pagos = tesoreria?.pagos_pendientes ?? 0;
  const proy30 = caja + cobros - pagos + ingNetoMes;

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
        CAJA HOY
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
        {fmtEur(caja)}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--rf-green)',
          marginBottom: 18,
          paddingBottom: 18,
          borderBottom: '0.5px solid var(--rf-border-card)',
        }}
      >
        <span style={{ fontSize: 11, marginRight: 2 }}>▲</span>
        Proyección 30d: {fmtEur(proy30)}
      </div>

      <Row label="Cobros pendientes" value={fmtEur(cobros, { signed: true })} color="var(--rf-green)" />
      <Row label="Pagos pendientes" value={fmtEur(-pagos, { signed: true })} color="var(--rf-red)" />
      <Row label={`Ing. netos ${mesNombreCorto}`} value={fmtEur(ingNetoMes, { signed: true })} />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '12px 0 8px',
          marginTop: 6,
          borderTop: '0.5px solid var(--rf-border-card)',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        <span>Proyección 30d</span>
        <span style={{ color: 'var(--rf-text-primary)' }}>{fmtEur(proy30)}</span>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--rf-text-secondary)', marginBottom: 6 }}>
          <span>Hoy</span>
          <span>30d</span>
        </div>
        <div style={{ height: 5, background: 'var(--rf-green)', borderRadius: 3 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--rf-text-primary)', marginTop: 6, fontWeight: 500 }}>
          <span>{fmtEur(caja)}</span>
          <span>{fmtEur(proy30)}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13 }}>
      <span>{label}</span>
      <span style={{ color: color || 'var(--rf-text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}
