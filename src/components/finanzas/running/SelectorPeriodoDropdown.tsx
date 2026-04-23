import { useTheme, FONT } from '@/styles/tokens';

export type PeriodoKey =
  | 'mes'
  | 'mes_anterior'
  | '30d'
  | 'trimestre'
  | 'personalizado'
  | `anio_${number}`;

interface Props {
  value: PeriodoKey;
  onChange: (k: PeriodoKey) => void;
  anios?: number[];
  desde?: string;
  hasta?: string;
  onRangoChange?: (desde: string, hasta: string) => void;
}

const BASE_OPTIONS: { value: PeriodoKey; label: string }[] = [
  { value: 'mes',          label: 'Este mes' },
  { value: 'mes_anterior', label: 'Mes anterior' },
  { value: '30d',          label: 'Últimos 30 días' },
  { value: 'trimestre',    label: 'Trimestre' },
];

export default function SelectorPeriodoDropdown({ value, onChange, anios, desde, hasta, onRangoChange }: Props) {
  const { T } = useTheme();

  const selectStyle = {
    padding: '8px 14px',
    border: `1px solid ${T.brd}`,
    borderRadius: 8,
    backgroundColor: T.card,
    color: T.pri,
    fontFamily: FONT.body,
    fontSize: 13,
    cursor: 'pointer',
    outline: 'none',
  } as const;

  const inputStyle = {
    padding: '7px 10px',
    border: `1px solid ${T.brd}`,
    borderRadius: 8,
    backgroundColor: T.card,
    color: T.pri,
    fontFamily: FONT.body,
    fontSize: 13,
    outline: 'none',
  } as const;

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value as PeriodoKey)}
        style={selectStyle}
      >
        {BASE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        {(anios ?? []).map(a => (
          <option key={`anio_${a}`} value={`anio_${a}`}>{`Año ${a}`}</option>
        ))}
        <option value="personalizado">Personalizado</option>
      </select>

      {value === 'personalizado' && (
        <>
          <input
            type="date"
            value={desde ?? ''}
            onChange={e => onRangoChange?.(e.target.value, hasta ?? '')}
            style={inputStyle}
            aria-label="Desde"
          />
          <span style={{ color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>—</span>
          <input
            type="date"
            value={hasta ?? ''}
            onChange={e => onRangoChange?.(desde ?? '', e.target.value)}
            style={inputStyle}
            aria-label="Hasta"
          />
        </>
      )}
    </div>
  );
}
