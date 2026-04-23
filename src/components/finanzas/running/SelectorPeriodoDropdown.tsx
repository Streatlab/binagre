import { useTheme, FONT } from '@/styles/tokens';

export type PeriodoKey = 'mes' | 'mes_anterior' | '30d' | 'trimestre' | 'anio' | 'personalizado';

interface Props {
  value: PeriodoKey;
  onChange: (k: PeriodoKey) => void;
}

const OPTIONS: { value: PeriodoKey; label: string }[] = [
  { value: 'mes',           label: 'Este mes' },
  { value: 'mes_anterior',  label: 'Mes anterior' },
  { value: '30d',           label: 'Últimos 30 días' },
  { value: 'trimestre',     label: 'Trimestre' },
  { value: 'anio',          label: 'Año' },
  { value: 'personalizado', label: 'Personalizado' },
];

export default function SelectorPeriodoDropdown({ value, onChange }: Props) {
  const { T } = useTheme();
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as PeriodoKey)}
      style={{
        padding: '8px 14px',
        border: `1px solid ${T.brd}`,
        borderRadius: 8,
        backgroundColor: T.card,
        color: T.pri,
        fontFamily: FONT.body,
        fontSize: 13,
        cursor: 'pointer',
        outline: 'none',
      }}
    >
      {OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
