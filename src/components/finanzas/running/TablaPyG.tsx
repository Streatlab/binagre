import React, { useMemo, useState } from 'react';
import { MESES_CORTO } from '@/lib/running-calc';
import type { IngresoMes, GastoAggCat } from '@/hooks/useRunningFinanciero';
import type { CategoriaGasto } from '@/lib/running-calc';

interface Props {
  ingresosPorMes: IngresoMes[];
  gastosPorMes: Record<number, GastoAggCat[]>;
  mesActual: number;
  anio: number;
}

type Row =
  | { type: 'lvl1'; id: string; label: string; values: number[]; pcts: (number | null)[]; valColor?: string }
  | { type: 'lvl2'; id: string; parent: string; label: string; values: number[]; pcts: (number | null)[] }
  | { type: 'lvl3'; parent: string; label: string; sublabel?: string; values: number[]; pcts: (number | null)[]; bgAlt?: boolean }
  | { type: 'lvl3-trigger'; id: string; parent: string; label: string; values: number[]; pcts: (number | null)[] }
  | { type: 'result'; label: string; values: number[]; pcts: (number | null)[] };

function valOrDash(v: number): string {
  if (v === 0) return '—';
  const abs = Math.abs(v).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return v < 0 ? `−${abs}` : abs;
}

function pctOrDash(p: number | null): string {
  if (p === null || p === undefined) return '—';
  return String(Math.round(p));
}

export default function TablaPyG({ ingresosPorMes, gastosPorMes, mesActual }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(['g-102']));

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const meses = useMemo(() => Array.from({ length: mesActual }, (_, i) => i + 1), [mesActual]);

  const rows: Row[] = useMemo(() => {
    const rs: Row[] = [];
    const valsIn = (fn: (im: IngresoMes) => number): number[] => {
      const arr = meses.map((m) => {
        const r = ingresosPorMes[m - 1];
        return r ? fn(r) : 0;
      });
      const ytd = arr.reduce((a, b) => a + b, 0);
      return [...arr, ytd];
    };
    const valsGasto = (cat: CategoriaGasto): number[] => {
      const arr = meses.map((m) => {
        const agg = (gastosPorMes[m] || []).find((x) => x.categoria === cat);
        return agg ? -Math.abs(agg.total) : 0;
      });
      const ytd = arr.reduce((a, b) => a + b, 0);
      return [...arr, ytd];
    };
    const pctSobre = (vals: number[], base: number[]): (number | null)[] =>
      vals.map((v, i) => (base[i] ? Math.round((Math.abs(v) / Math.abs(base[i])) * 100) : null));

    const bruto = valsIn((r) => r.bruto);
    rs.push({ type: 'lvl1', id: 'g-10', label: '1.0 INGRESOS', values: bruto, pcts: bruto.map(() => 100), valColor: 'var(--rf-ch-uber)' });

    const netos = valsIn((r) => r.neto);
    rs.push({ type: 'lvl2', id: 'g-101', parent: 'g-10', label: '1.01 Netos ventas', values: netos, pcts: pctSobre(netos, bruto) });

    const uber = valsIn((r) => r.uber);
    rs.push({ type: 'lvl3', parent: 'g-101', label: 'Uber Eats', values: uber, pcts: pctSobre(uber, netos) });
    const glovo = valsIn((r) => r.glovo);
    rs.push({ type: 'lvl3', parent: 'g-101', label: 'Glovo', values: glovo, pcts: pctSobre(glovo, netos) });
    const justeat = valsIn((r) => r.justeat);
    rs.push({ type: 'lvl3', parent: 'g-101', label: 'Just Eat', values: justeat, pcts: pctSobre(justeat, netos) });
    const web = valsIn((r) => r.web);
    rs.push({ type: 'lvl3', parent: 'g-101', label: 'Web / Directa', values: web, pcts: pctSobre(web, netos) });

    rs.push({ type: 'lvl2', id: 'g-102', parent: 'g-10', label: '1.02 Fact. bruta', values: bruto, pcts: bruto.map(() => 100) });

    // PRODUCTO
    const prodVals = valsGasto('PRODUCTO');
    rs.push({ type: 'lvl1', id: 'g-21', label: '2.1 PRODUCTO', values: prodVals, pcts: pctSobre(prodVals, bruto), valColor: 'var(--rf-gasto-producto)' });
    rs.push({ type: 'lvl2', id: 'g-211', parent: 'g-21', label: '2.11 Alimentos y bebidas', values: prodVals, pcts: prodVals.map(() => 100) });

    const provTotales = new Map<string, { abv: string | null; total: number; porMes: Map<number, number> }>();
    meses.forEach((m) => {
      const agg = (gastosPorMes[m] || []).find((x) => x.categoria === 'PRODUCTO');
      (agg?.porProveedor || []).forEach((p) => {
        if (!provTotales.has(p.proveedor)) provTotales.set(p.proveedor, { abv: p.abv, total: 0, porMes: new Map() });
        const rec = provTotales.get(p.proveedor)!;
        rec.total += p.total;
        rec.porMes.set(m, (rec.porMes.get(m) || 0) + p.total);
      });
    });
    const sortedProv = Array.from(provTotales.entries()).sort((a, b) => b[1].total - a[1].total);
    const top3 = sortedProv.slice(0, 3);
    const restoProv = sortedProv.slice(3);

    top3.forEach(([nombre, rec]) => {
      const vals = [...meses.map((m) => -(rec.porMes.get(m) || 0)), -rec.total];
      rs.push({ type: 'lvl3', parent: 'g-211', label: nombre, sublabel: rec.abv ? `(${rec.abv})` : undefined, values: vals, pcts: pctSobre(vals, prodVals) });
    });
    if (restoProv.length > 0) {
      const restoPorMes = meses.map((m) => restoProv.reduce((acc, [, rec]) => acc - (rec.porMes.get(m) || 0), 0));
      const restoYtd = restoProv.reduce((acc, [, rec]) => acc - rec.total, 0);
      const restoVals = [...restoPorMes, restoYtd];
      rs.push({ type: 'lvl3-trigger', id: 'g-211-otros', parent: 'g-211', label: `+ ${restoProv.length} proveedores más`, values: restoVals, pcts: pctSobre(restoVals, prodVals) });
      restoProv.forEach(([nombre, rec]) => {
        const vals = [...meses.map((m) => -(rec.porMes.get(m) || 0)), -rec.total];
        rs.push({ type: 'lvl3', parent: 'g-211-otros', label: nombre, sublabel: rec.abv ? `(${rec.abv})` : undefined, values: vals, pcts: pctSobre(vals, prodVals), bgAlt: true });
      });
    }

    // RRHH
    const rrhhVals = valsGasto('RRHH');
    rs.push({ type: 'lvl1', id: 'g-22', label: '2.2 RRHH', values: rrhhVals, pcts: pctSobre(rrhhVals, bruto), valColor: 'var(--rf-gasto-rrhh)' });
    rs.push({ type: 'lvl2', id: 'g-221', parent: 'g-22', label: '2.21 Fijos RRHH', values: rrhhVals, pcts: rrhhVals.map(() => 100) });

    const conceptosRrhh = new Map<string, Map<number, number>>();
    meses.forEach((m) => {
      const agg = (gastosPorMes[m] || []).find((x) => x.categoria === 'RRHH');
      (agg?.porConcepto || []).forEach((c) => {
        if (!conceptosRrhh.has(c.concepto)) conceptosRrhh.set(c.concepto, new Map());
        conceptosRrhh.get(c.concepto)!.set(m, (conceptosRrhh.get(c.concepto)!.get(m) || 0) + c.total);
      });
    });
    Array.from(conceptosRrhh.entries()).forEach(([concepto, porMes]) => {
      const vals = [...meses.map((m) => -(porMes.get(m) || 0)), -Array.from(porMes.values()).reduce((a, b) => a + b, 0)];
      rs.push({ type: 'lvl3', parent: 'g-221', label: concepto, values: vals, pcts: pctSobre(vals, rrhhVals) });
    });

    // ALQUILER
    const alqVals = valsGasto('ALQUILER');
    rs.push({ type: 'lvl1', id: 'g-23', label: '2.3 ALQUILER', values: alqVals, pcts: pctSobre(alqVals, bruto), valColor: 'var(--rf-gasto-alquiler)' });
    rs.push({ type: 'lvl2', id: 'g-231', parent: 'g-23', label: '2.31 Alquiler inmueble', values: alqVals, pcts: alqVals.map(() => 100) });

    // CONTROLABLES
    const mktVals = valsGasto('MARKETING');
    const intVals = valsGasto('INTERNET_VENTAS');
    const admVals = valsGasto('ADMIN_GENERALES');
    const sumVals = valsGasto('SUMINISTROS');
    const ctrlVals = mktVals.map((_, i) => mktVals[i] + intVals[i] + admVals[i] + sumVals[i]);
    rs.push({ type: 'lvl1', id: 'g-24', label: '2.4 CONTROLABLES', values: ctrlVals, pcts: pctSobre(ctrlVals, bruto), valColor: 'var(--rf-gasto-sumin)' });
    rs.push({ type: 'lvl2', id: 'g-241', parent: 'g-24', label: '2.41 Marketing', values: mktVals, pcts: pctSobre(mktVals, ctrlVals) });
    rs.push({ type: 'lvl2', id: 'g-242', parent: 'g-24', label: '2.42 Internet y ventas', values: intVals, pcts: pctSobre(intVals, ctrlVals) });
    rs.push({ type: 'lvl2', id: 'g-243', parent: 'g-24', label: '2.43 Admin/Generales', values: admVals, pcts: pctSobre(admVals, ctrlVals) });
    rs.push({ type: 'lvl2', id: 'g-244', parent: 'g-24', label: '2.44 Suministros', values: sumVals, pcts: pctSobre(sumVals, ctrlVals) });

    const cats: CategoriaGasto[] = ['PRODUCTO', 'RRHH', 'ALQUILER', 'MARKETING', 'INTERNET_VENTAS', 'ADMIN_GENERALES', 'SUMINISTROS'];
    const totalGastos = cats.map((c) => valsGasto(c));
    const resultadoVals = netos.map((n, i) => n + totalGastos.reduce((acc, arr) => acc + arr[i], 0));
    rs.push({ type: 'result', label: 'RESULTADO', values: resultadoVals, pcts: pctSobre(resultadoVals, netos) });

    return rs;
  }, [ingresosPorMes, gastosPorMes, meses]);

  const isHidden = (parent: string): boolean => {
    if (collapsed.has(parent)) return true;
    const parentRow = rows.find((r: any) => r.id === parent) as any;
    if (parentRow && parentRow.parent) return isHidden(parentRow.parent);
    return false;
  };

  const thBase: React.CSSProperties = {
    fontFamily: 'Oswald, sans-serif',
    fontSize: 11,
    letterSpacing: '0.1em',
    fontWeight: 500,
    color: 'var(--rf-text-label)',
    padding: '12px 8px',
    textAlign: 'right',
    borderBottom: '1px solid var(--rf-border-card)',
  };
  const tdBase: React.CSSProperties = {
    padding: '10px 8px',
    textAlign: 'right',
    fontSize: 13,
    color: 'var(--rf-text-primary)',
    borderBottom: '0.5px solid var(--rf-border-card)',
    fontFamily: 'Lexend, sans-serif',
  };
  const pctTd: React.CSSProperties = { fontSize: 11, color: 'var(--rf-text-muted)', padding: '10px 4px', textAlign: 'right' };
  const currentBg = { background: 'var(--rf-current-bg)' };

  return (
    <div
      style={{
        background: 'var(--rf-bg-card)',
        borderRadius: 12,
        border: '0.5px solid var(--rf-border-card)',
        overflowX: 'auto',
        marginBottom: 20,
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
        <thead>
          <tr>
            <th style={{ ...thBase, textAlign: 'left', paddingLeft: 24 }}>CONCEPTO</th>
            {meses.map((m) => {
              const isCurrent = m === mesActual;
              return (
                <React.Fragment key={m}>
                  <th style={{ ...thBase, color: isCurrent ? 'var(--rf-red)' : 'var(--rf-text-label)', ...(isCurrent ? currentBg : {}) }}>
                    {MESES_CORTO[m - 1]}
                  </th>
                  <th style={{ ...thBase, fontSize: 10, fontWeight: 400, padding: '12px 4px', ...(isCurrent ? currentBg : {}) }}>%</th>
                </React.Fragment>
              );
            })}
            <th style={{ ...thBase, color: 'var(--rf-text-primary)', fontWeight: 600 }}>YTD</th>
            <th style={{ ...thBase, fontSize: 10, fontWeight: 400, padding: '12px 4px' }}>%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            if ('parent' in r && r.parent && isHidden(r.parent)) return null;

            if (r.type === 'result') {
              return (
                <tr key={idx} style={{ background: 'var(--rf-bg-panel)' }}>
                  <td
                    style={{
                      ...tdBase,
                      textAlign: 'left',
                      paddingLeft: 24,
                      padding: '14px 8px 14px 24px',
                      fontFamily: 'Oswald, sans-serif',
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      fontSize: 12,
                      borderTop: '1.5px solid var(--rf-border-card)',
                      borderBottom: 'none',
                      color: 'var(--rf-red)',
                    }}
                  >
                    {r.label}
                  </td>
                  {r.values.map((v, i) => {
                    const isLast = i === r.values.length - 1;
                    const colMes = meses[i];
                    const isCurrent = !isLast && colMes === mesActual;
                    return (
                      <React.Fragment key={i}>
                        <td
                          style={{
                            ...tdBase,
                            padding: '14px 8px',
                            fontFamily: 'Oswald, sans-serif',
                            fontWeight: 600,
                            letterSpacing: '0.08em',
                            fontSize: 12,
                            borderTop: '1.5px solid var(--rf-border-card)',
                            borderBottom: 'none',
                            color: v >= 0 ? 'var(--rf-green)' : 'var(--rf-red)',
                            ...(isCurrent ? currentBg : {}),
                          }}
                        >
                          {v === 0 ? '—' : v > 0 ? `+${valOrDash(v)}` : valOrDash(v)}
                        </td>
                        <td
                          style={{
                            ...pctTd,
                            padding: '14px 4px',
                            fontFamily: 'Oswald, sans-serif',
                            fontWeight: 600,
                            fontSize: 11,
                            color: (r.pcts[i] ?? 0) >= 0 ? 'var(--rf-green)' : 'var(--rf-red)',
                            ...(isCurrent ? currentBg : {}),
                          }}
                        >
                          {pctOrDash(r.pcts[i])}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              );
            }

            const isLvl1 = r.type === 'lvl1';
            const isLvl2 = r.type === 'lvl2';
            const isTrigger = r.type === 'lvl3-trigger';
            const isCollapsible = isLvl1 || isLvl2 || isTrigger;
            const rowId = 'id' in r ? (r as any).id : undefined;
            const collapsedNow = rowId && collapsed.has(rowId);

            return (
              <tr
                key={idx}
                onClick={isCollapsible && rowId ? () => toggle(rowId) : undefined}
                style={{
                  cursor: isCollapsible ? 'pointer' : undefined,
                  userSelect: isCollapsible ? 'none' : undefined,
                  background:
                    isLvl1 ? 'rgba(232,244,66,0.06)' : r.type === 'lvl3' && (r as any).bgAlt ? 'rgba(0,0,0,0.02)' : undefined,
                }}
              >
                <td
                  style={{
                    ...tdBase,
                    textAlign: 'left',
                    paddingLeft: isLvl1 ? 24 : isLvl2 ? 36 : r.type === 'lvl3-trigger' ? 52 : ('bgAlt' in r && r.bgAlt) ? 68 : 52,
                    padding: isLvl1 ? '14px 8px 14px 24px' : r.type === 'lvl3' ? '8px 8px' : '10px 8px',
                    fontFamily: isLvl1 ? 'Oswald, sans-serif' : 'Lexend, sans-serif',
                    fontWeight: isLvl1 ? 500 : isLvl2 ? 500 : 400,
                    letterSpacing: isLvl1 ? '0.06em' : 0,
                    fontSize: isLvl1 ? 12 : r.type === 'lvl3' ? 12 : 13,
                    color: isLvl1 ? 'var(--rf-red)' : 'var(--rf-text-primary)',
                    borderTop: isLvl1 ? '1px solid var(--rf-border-card)' : 'none',
                  }}
                >
                  {isCollapsible && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 10,
                        marginRight: 6,
                        color: 'var(--rf-text-muted)',
                        fontSize: 9,
                        transform: collapsedNow ? 'rotate(-90deg)' : 'none',
                      }}
                    >
                      ▼
                    </span>
                  )}
                  {r.label}
                  {'sublabel' in r && r.sublabel && (
                    <span style={{ color: 'var(--rf-text-muted)', fontSize: 10, marginLeft: 4 }}>{r.sublabel}</span>
                  )}
                </td>
                {r.values.map((v, i) => {
                  const isLast = i === r.values.length - 1;
                  const colMes = meses[i];
                  const isCurrent = !isLast && colMes === mesActual;
                  const valColor = isLvl1 && 'valColor' in r && r.valColor ? r.valColor : undefined;
                  return (
                    <React.Fragment key={i}>
                      <td
                        style={{
                          ...tdBase,
                          padding: isLvl1 ? '14px 8px' : r.type === 'lvl3' ? '8px 8px' : '10px 8px',
                          fontWeight: isLvl1 || isLvl2 ? 500 : 400,
                          color: valColor || (r.type === 'lvl3' ? 'var(--rf-text-secondary)' : 'var(--rf-text-primary)'),
                          borderTop: isLvl1 ? '1px solid var(--rf-border-card)' : 'none',
                          ...(isCurrent ? currentBg : {}),
                        }}
                      >
                        {valOrDash(v)}
                      </td>
                      <td style={{ ...pctTd, ...(isCurrent ? currentBg : {}) }}>{pctOrDash(r.pcts[i])}</td>
                    </React.Fragment>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
