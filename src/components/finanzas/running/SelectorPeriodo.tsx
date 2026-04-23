import { periodoMesActual, periodoUltimoMes, periodoUltimos, periodoAnio } from '@/lib/running';
import type { PeriodoRango } from '@/lib/running';

interface Props {
  value: PeriodoRango;
  onChange: (p: PeriodoRango) => void;
}

export default function SelectorPeriodo({ value, onChange }: Props) {
  const opts = [
    { key: 'mes_actual', label: 'Mes actual', build: () => periodoMesActual() },
    { key: 'ultimo_mes', label: 'Último mes', build: () => periodoUltimoMes() },
    { key: 'ult_60d', label: '60 días', build: () => periodoUltimos(60) },
    { key: 'ult_90d', label: '90 días', build: () => periodoUltimos(90) },
    { key: 'anio_' + new Date().getFullYear(), label: 'Año', build: () => periodoAnio(new Date().getFullYear()) },
  ];

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {opts.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.build())}
          style={{
            padding: '9px 16px',
            background: value.key === o.key ? 'var(--rf-red)' : 'var(--rf-bg-card)',
            color: value.key === o.key ? '#fff' : 'var(--rf-text)',
            border: `1px solid ${value.key === o.key ? 'var(--rf-red)' : 'var(--rf-border-input)'}`,
            borderRadius: 8,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'Lexend, sans-serif',
            fontWeight: value.key === o.key ? 500 : 400,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
