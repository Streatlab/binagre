import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTheme, FONT, kpiValueStyle } from '@/styles/tokens';
import { fmtEur } from '@/utils/format';
import type { Categoria } from '@/lib/running';
import { CATEGORIA_NOMBRE, CATEGORIA_COLOR } from '@/lib/running';

const VERDE = '#06C167';
const ROJO  = '#B01D23';
const AMBAR = '#f5a623';

interface Row {
  categoria: Categoria;
  total: number;
  pctReal: number;
  pctMin: number;
  pctMax: number;
}

interface Props {
  periodoLabel: string;
  totalGasto: number;
  totalGastoAnt: number;
  rows: Row[];
  onUpdateRango?: (cat: Categoria, pctMin: number, pctMax: number) => Promise<void> | void;
}

function statusColor(pctReal: number, _pctMin: number, pctMax: number): string {
  // Gastar menos que el mínimo no penaliza — sólo se marca rojo/ámbar si se excede el máximo.
  if (pctReal <= pctMax) return VERDE;
  if (pctReal - pctMax <= 5) return AMBAR;
  return ROJO;
}

export default function GastosCard({ periodoLabel, totalGasto, totalGastoAnt, rows, onUpdateRango }: Props) {
  const { T } = useTheme();

  const deltaPct = totalGastoAnt !== 0 ? ((totalGasto - totalGastoAnt) / totalGastoAnt) * 100 : 0;
  const deltaSym = deltaPct > 0 ? '▲' : deltaPct < 0 ? '▼' : '·';
  const deltaColor = deltaPct > 0 ? ROJO : deltaPct < 0 ? VERDE : T.mut;

  const wrap: CSSProperties = {
    backgroundColor: T.card,
    border: `1px solid ${T.brd}`,
    borderRadius: 14,
    padding: '22px 24px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  };

  const labelStyle: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    color: T.mut,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    fontWeight: 500,
    marginBottom: 8,
  };

  return (
    <div style={wrap}>
      <div style={labelStyle}>GASTOS · {periodoLabel.toUpperCase()}</div>
      <div style={{ ...kpiValueStyle(T), marginBottom: 4 }}>{fmtEur(totalGasto)}</div>
      <div style={{ fontFamily: FONT.body, fontSize: 12, color: deltaColor, marginTop: 4, fontWeight: 500 }}>
        {deltaSym} {Math.abs(Math.round(deltaPct))}% vs periodo anterior
      </div>

      <div style={{ height: 1, backgroundColor: T.brd, margin: '14px 0' }} />

      {rows.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13, padding: 20 }}>
          Sin gastos en este periodo
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(r => (
            <CategoriaFila
              key={r.categoria}
              row={r}
              onUpdate={onUpdateRango}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoriaFila({ row, onUpdate }: { row: Row; onUpdate?: Props['onUpdateRango'] }) {
  const { T } = useTheme();
  const [editing, setEditing] = useState(false);
  const [min, setMin] = useState(String(row.pctMin));
  const [max, setMax] = useState(String(row.pctMax));
  const [flash, setFlash] = useState(false);
  const saving = useRef(false);

  useEffect(() => {
    if (!editing) {
      setMin(String(row.pctMin));
      setMax(String(row.pctMax));
    }
  }, [row.pctMin, row.pctMax, editing]);

  const color = statusColor(row.pctReal, row.pctMin, row.pctMax);
  const bajoMinimo = row.pctReal < row.pctMin;
  const tooltipBajoMin = 'Por debajo del rango objetivo — revisa si falta registrar gastos';
  const barraMax = Math.max(row.pctMax, row.pctReal, 1);
  const fillPct = Math.min(100, (row.pctReal / barraMax) * 100);
  const rangoFillStart = Math.min(100, (row.pctMin / barraMax) * 100);
  const rangoFillEnd = Math.min(100, (row.pctMax / barraMax) * 100);

  async function commit() {
    if (saving.current) return;
    const nMin = parseFloat(min.replace(',', '.'));
    const nMax = parseFloat(max.replace(',', '.'));
    if (!Number.isFinite(nMin) || !Number.isFinite(nMax) || nMin < 0 || nMax < nMin) {
      setMin(String(row.pctMin)); setMax(String(row.pctMax));
      setEditing(false);
      return;
    }
    if (nMin === row.pctMin && nMax === row.pctMax) { setEditing(false); return; }
    saving.current = true;
    try {
      await onUpdate?.(row.categoria, nMin, nMax);
      setFlash(true);
      setTimeout(() => setFlash(false), 250);
    } finally {
      saving.current = false;
      setEditing(false);
    }
  }

  const inputStyle: CSSProperties = {
    width: 34,
    padding: '1px 4px',
    border: `1px solid ${T.brd}`,
    borderRadius: 4,
    background: T.inp,
    color: T.pri,
    fontFamily: FONT.body,
    fontSize: 10,
    textAlign: 'center',
    outline: 'none',
  };

  return (
    <div style={{ transition: 'background 250ms', background: flash ? `${VERDE}22` : 'transparent', borderRadius: 6, padding: flash ? '2px 4px' : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORIA_COLOR[row.categoria], flexShrink: 0 }} />
        <span style={{ flex: 1, fontFamily: FONT.body, fontSize: 13, color: T.pri }}>
          {CATEGORIA_NOMBRE[row.categoria]}
          {editing ? (
            <span style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, color: T.mut }}>
              objetivo
              <input type="number" step="0.5" min="0" value={min} onChange={e => setMin(e.target.value)}
                onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
                autoFocus style={inputStyle} />
              <span>-</span>
              <input type="number" step="0.5" min="0" value={max} onChange={e => setMax(e.target.value)}
                onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
                style={inputStyle} />
              <span>%</span>
            </span>
          ) : (
            <span
              onClick={() => onUpdate && setEditing(true)}
              title={onUpdate ? 'Click para editar objetivo' : undefined}
              style={{
                fontFamily: FONT.body, fontSize: 10, color: T.mut, marginLeft: 6,
                cursor: onUpdate ? 'pointer' : 'default',
                textDecoration: onUpdate ? 'underline dotted' : 'none',
                textUnderlineOffset: 2,
              }}
            >
              objetivo {row.pctMin}-{row.pctMax}%
            </span>
          )}
        </span>
        <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, fontWeight: 500, minWidth: 86, textAlign: 'right' }}>
          {fmtEur(row.total)}
        </span>
        <span
          title={bajoMinimo ? tooltipBajoMin : undefined}
          style={{
            fontFamily: FONT.heading, fontSize: 11, color, fontWeight: 500,
            minWidth: 50, textAlign: 'right', letterSpacing: 0.5,
            cursor: bajoMinimo ? 'help' : 'default',
          }}
        >
          {row.pctReal.toFixed(1)}%{bajoMinimo ? ' ↓' : ''}
        </span>
      </div>
      <div style={{ height: 5, background: T.bg, borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          position: 'absolute', left: `${rangoFillStart}%`, width: `${Math.max(0, rangoFillEnd - rangoFillStart)}%`,
          height: '100%', background: `${VERDE}33`, borderLeft: `1px dashed ${VERDE}88`, borderRight: `1px dashed ${VERDE}88`,
        }} />
        <div style={{ height: '100%', width: `${fillPct}%`, background: color, borderRadius: 3, position: 'relative', zIndex: 1 }} />
      </div>
    </div>
  );
}
