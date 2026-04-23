import React, { useMemo, useState } from 'react';
import { MESES_CORTO, CATEGORIA_NOMBRE, CATEGORIA_COLOR } from '@/lib/running';
import type { Categoria } from '@/lib/running';
import type { GastoRaw, IngresoMensualRaw, RangoCategoria } from '@/hooks/useRunning';
import { normalizarConcepto } from '@/lib/normalizarConcepto';

interface Props {
  anio: number;
  gastosAnio: GastoRaw[];
  ingresosAnio: IngresoMensualRaw[];
  rangos: RangoCategoria[];
}

type RowKind = 'section'|'h1'|'h2'|'detail'|'result';
interface Row {
  key: string;
  kind: RowKind;
  label: string;
  sublabel?: string;
  monthly: number[];
  parent?: string;
  colorAccent?: string;
}

const TRIM = [
  { label: 'Q1', months: [0,1,2], bg: 'var(--rf-q1-bg)' },
  { label: 'Q2', months: [3,4,5], bg: 'var(--rf-q2-bg)' },
  { label: 'Q3', months: [6,7,8], bg: 'var(--rf-q3-bg)' },
  { label: 'Q4', months: [9,10,11], bg: 'var(--rf-q4-bg)' },
];

function sumMonths(arr: number[], months: number[]): number {
  return months.reduce((a, m) => a + (arr[m] || 0), 0);
}

function arr12(): number[] { return [0,0,0,0,0,0,0,0,0,0,0,0]; }

function valFmt(v: number): string {
  if (!v) return '—';
  const [int, dec] = Math.abs(v).toFixed(2).split('.');
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const out = `${intFmt},${dec}`;
  return v < 0 ? `−${out}` : out;
}

function proveedorKey(g: { proveedor: string | null; concepto: string | null }): string {
  if (g.proveedor && g.proveedor.trim()) return g.proveedor.trim().toLowerCase();
  return normalizarConcepto(g.concepto ?? '') || (g.concepto ?? '').toLowerCase().slice(0, 20);
}

function proveedorLabel(g: { proveedor: string | null; concepto: string | null }): string {
  if (g.proveedor && g.proveedor.trim()) return g.proveedor.trim();
  const norm = normalizarConcepto(g.concepto ?? '');
  if (norm) return norm.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return (g.concepto ?? '(sin concepto)').slice(0, 30);
}

export default function TablaPyG({ gastosAnio, ingresosAnio, rangos }: Props) {
  const [collapsedTrim, setCollapsedTrim] = useState<Set<string>>(new Set());
  const [collapsedRow, setCollapsedRow] = useState<Set<string>>(new Set());

  const toggleTrim = (t: string) => setCollapsedTrim(p => { const n = new Set(p); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const toggleRow = (k: string) => setCollapsedRow(p => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const ingresos = useMemo(() => {
    const bruto = arr12();
    const neto = arr12();
    const perCanalBruto: Record<string, number[]> = {};
    const perCanalNeto: Record<string, number[]> = {};
    ingresosAnio.forEach(r => {
      const idx = r.mes - 1;
      if (r.tipo === 'bruto') {
        bruto[idx] += r.importe;
        perCanalBruto[r.canal] = perCanalBruto[r.canal] || arr12();
        perCanalBruto[r.canal][idx] += r.importe;
      } else {
        neto[idx] += r.importe;
        perCanalNeto[r.canal] = perCanalNeto[r.canal] || arr12();
        perCanalNeto[r.canal][idx] += r.importe;
      }
    });
    return { bruto, neto, perCanalBruto, perCanalNeto };
  }, [ingresosAnio]);

  const gastos = useMemo(() => {
    const perCat: Record<Categoria, number[]> = {
      PRODUCTO: arr12(), RRHH: arr12(), ALQUILER: arr12(),
      MARKETING: arr12(), SUMINISTROS: arr12(), INTERNET_VENTAS: arr12(), ADMIN_GENERALES: arr12(),
    };
    const perSubcat: Record<string, number[]> = {};
    // Agrupado por proveedor normalizado (no por concepto bruto)
    const perProveedor: Record<string, { subcat: string; categoria: Categoria; label: string; vals: number[] }> = {};
    gastosAnio.forEach(g => {
      const idx = Number(g.fecha.slice(5,7)) - 1;
      const cat = g.categoria as Categoria;
      perCat[cat][idx] += g.importe;
      if (g.subcategoria) {
        const k = `${cat}::${g.subcategoria}`;
        perSubcat[k] = perSubcat[k] || arr12();
        perSubcat[k][idx] += g.importe;
      }
      const provKey = proveedorKey(g);
      if (provKey) {
        const k = `${cat}::${g.subcategoria || '_'}::${provKey}`;
        if (!perProveedor[k]) {
          perProveedor[k] = {
            subcat: g.subcategoria || '',
            categoria: cat,
            label: proveedorLabel(g),
            vals: arr12(),
          };
        }
        perProveedor[k].vals[idx] += g.importe;
      }
    });
    return { perCat, perSubcat, perProveedor };
  }, [gastosAnio]);

  const totalGastos = useMemo(() => {
    const r = arr12();
    (Object.values(gastos.perCat) as number[][]).forEach(arr => arr.forEach((v, i) => r[i] += v));
    return r;
  }, [gastos]);

  const resultado = useMemo(() => ingresos.neto.map((n, i) => n - totalGastos[i]), [ingresos.neto, totalGastos]);

  const rangoMap = useMemo(() => {
    const m: Record<string, RangoCategoria> = {};
    rangos.forEach(r => { m[r.categoria] = r; });
    return m;
  }, [rangos]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    out.push({ key: 'sec-resumen', kind: 'section', label: 'RESUMEN', monthly: arr12() });
    out.push({ key: 'ingresos-op', kind: 'h1', label: 'Ingresos por operaciones', monthly: ingresos.neto, colorAccent: 'var(--rf-green)' });
    out.push({ key: 'gastos-fijos', kind: 'h1', label: 'Gastos fijos', monthly: [...Array(12)].map((_,i) =>
      gastos.perCat.RRHH[i] + gastos.perCat.ALQUILER[i] + gastos.perCat.MARKETING[i] +
      gastos.perCat.INTERNET_VENTAS[i] + gastos.perCat.ADMIN_GENERALES[i] + gastos.perCat.SUMINISTROS[i]
    ), colorAccent: 'var(--rf-text-2)' });
    out.push({ key: 'gastos-var', kind: 'h1', label: 'Gastos variables', monthly: gastos.perCat.PRODUCTO, colorAccent: 'var(--rf-orange)' });
    out.push({ key: 'total-gastos', kind: 'h1', label: 'Total gastos', monthly: totalGastos, colorAccent: 'var(--rf-red)' });
    out.push({ key: 'resultado', kind: 'result', label: 'Resultado', monthly: resultado });

    out.push({ key: 'sec-dist', kind: 'section', label: 'DISTRIBUCIÓN DE GASTOS', monthly: arr12() });
    (['PRODUCTO','RRHH','ALQUILER','MARKETING','INTERNET_VENTAS','ADMIN_GENERALES','SUMINISTROS'] as Categoria[]).forEach(cat => {
      const rango = rangoMap[cat];
      const subl = rango ? `${rango.pct_min}-${rango.pct_max}%` : '';
      out.push({
        key: `dist-${cat}`, kind: 'h1', label: CATEGORIA_NOMBRE[cat], sublabel: subl,
        monthly: gastos.perCat[cat], colorAccent: CATEGORIA_COLOR[cat],
      });
    });

    out.push({ key: 'sec-detalle', kind: 'section', label: 'DETALLE COMPLETO', monthly: arr12() });

    out.push({ key: 'g-10', kind: 'h1', label: '1.0 Ingresos por operación', monthly: ingresos.neto, colorAccent: 'var(--rf-green)' });
    out.push({ key: 'g-101', kind: 'h2', label: '1.01 Ingresos netos por ventas', parent: 'g-10', monthly: ingresos.neto });
    Object.entries(ingresos.perCanalNeto).forEach(([canal, vals]) => {
      out.push({ key: `g-101-${canal}`, kind: 'detail', label: canal, parent: 'g-101', monthly: vals });
    });
    out.push({ key: 'g-102', kind: 'h2', label: '1.02 Facturación bruta por ventas', parent: 'g-10', monthly: ingresos.bruto });
    Object.entries(ingresos.perCanalBruto).forEach(([canal, vals]) => {
      out.push({ key: `g-102-${canal}`, kind: 'detail', label: canal, parent: 'g-102', monthly: vals });
    });

    const GRUPOS: { id: string; label: string; cat: Categoria; subcats: { code: string; label: string }[] }[] = [
      { id: 'g-21', label: '2.1 Producto', cat: 'PRODUCTO', subcats: [
        { code: 'ALIMENTOS', label: '2.11 Alimentos y bebidas' },
        { code: 'ENTREGAS', label: '2.12 Entregas' },
      ]},
      { id: 'g-22', label: '2.2 Recursos humanos', cat: 'RRHH', subcats: [
        { code: 'FIJOS_RRHH', label: '2.21 Fijos RRHH' },
        { code: 'VARIABLES_RRHH', label: '2.22 Variables RRHH' },
      ]},
      { id: 'g-23', label: '2.3 Alquiler', cat: 'ALQUILER', subcats: [
        { code: 'ALQUILER_INMUEBLE', label: '2.31 Alquiler e inmueble' },
      ]},
      { id: 'g-24-mkt', label: '2.41 Marketing', cat: 'MARKETING', subcats: [
        { code: 'MARKETING', label: '2.41 Marketing' },
      ]},
      { id: 'g-24-int', label: '2.42 Internet y ventas', cat: 'INTERNET_VENTAS', subcats: [
        { code: 'INTERNET_VENTAS', label: '2.42 Internet y ventas' },
      ]},
      { id: 'g-24-adm', label: '2.43 Administración/Generales', cat: 'ADMIN_GENERALES', subcats: [
        { code: 'ADMIN_GENERALES', label: '2.43 Administración/Generales' },
      ]},
      { id: 'g-24-sum', label: '2.44 Suministros', cat: 'SUMINISTROS', subcats: [
        { code: 'SUMINISTROS', label: '2.44 Suministros' },
      ]},
    ];

    GRUPOS.forEach(grp => {
      out.push({
        key: grp.id, kind: 'h1', label: grp.label,
        monthly: gastos.perCat[grp.cat], colorAccent: CATEGORIA_COLOR[grp.cat],
      });
      grp.subcats.forEach(sc => {
        const subcatKey = `${grp.cat}::${sc.code}`;
        const subcatVals = gastos.perSubcat[subcatKey] || arr12();
        const subcatRowKey = `${grp.id}-${sc.code}`;
        out.push({ key: subcatRowKey, kind: 'h2', label: sc.label, parent: grp.id, monthly: subcatVals });
        const proveedoresSubcat = Object.entries(gastos.perProveedor)
          .filter(([, c]) => c.categoria === grp.cat && c.subcat === sc.code)
          .sort(([, a], [, b]) => b.vals.reduce((s, v) => s + v, 0) - a.vals.reduce((s, v) => s + v, 0));
        proveedoresSubcat.forEach(([k, c]) => {
          out.push({ key: `${subcatRowKey}-${k}`, kind: 'detail', label: c.label, parent: subcatRowKey, monthly: c.vals });
        });
      });
    });

    return out;
  }, [ingresos, gastos, totalGastos, resultado, rangoMap]);

  const isHidden = (parent?: string): boolean => {
    if (!parent) return false;
    if (collapsedRow.has(parent)) return true;
    const parentRow = rows.find(r => r.key === parent);
    return parentRow ? isHidden(parentRow.parent) : false;
  };

  const thBase: React.CSSProperties = {
    fontFamily: 'Oswald, sans-serif',
    fontSize: 11, letterSpacing: '0.1em', fontWeight: 500,
    color: 'var(--rf-text-label)', padding: '12px 8px',
    textAlign: 'right', borderBottom: '1px solid var(--rf-border)',
    textTransform: 'uppercase',
  };

  return (
    <div style={{
      background: 'var(--rf-bg-card)', borderRadius: 16,
      border: '1px solid var(--rf-border)', overflowX: 'auto',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
        <thead>
          <tr>
            <th style={{ ...thBase, textAlign: 'left', paddingLeft: 24, minWidth: 280, position: 'sticky', left: 0, background: 'var(--rf-bg-card)', zIndex: 1 }}>Concepto</th>
            {TRIM.map(t => {
              const isColTrim = collapsedTrim.has(t.label);
              return (
                <React.Fragment key={t.label}>
                  {!isColTrim && t.months.map(m => (
                    <th key={`m-${m}`} style={{ ...thBase, background: t.bg }}>{MESES_CORTO[m]}</th>
                  ))}
                  <th
                    onClick={() => toggleTrim(t.label)}
                    style={{
                      ...thBase, background: t.bg, cursor: 'pointer',
                      color: 'var(--rf-text)', fontWeight: 600,
                    }}
                    title={isColTrim ? 'Expandir trimestre' : 'Colapsar trimestre'}
                  >
                    {isColTrim ? '▶ ' : '▼ '}{t.label}
                  </th>
                </React.Fragment>
              );
            })}
            <th style={{ ...thBase, background: 'var(--rf-year-bg)', color: 'var(--rf-red)', fontWeight: 700 }}>AÑO</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            if (isHidden(r.parent)) return null;
            const isSection = r.kind === 'section';
            const isResult = r.kind === 'result';
            const isH1 = r.kind === 'h1';
            const isH2 = r.kind === 'h2';
            const isDetail = r.kind === 'detail';

            if (isSection) {
              return (
                <tr key={r.key}>
                  <td colSpan={12 + 4 + 1 + 1} style={{
                    background: 'var(--rf-bg-panel)',
                    padding: '14px 24px',
                    fontFamily: 'Oswald, sans-serif',
                    fontSize: 11, letterSpacing: '0.14em', fontWeight: 600,
                    color: 'var(--rf-red)', textTransform: 'uppercase',
                    borderTop: '2px solid var(--rf-border)',
                    borderBottom: '1px solid var(--rf-border)',
                  }}>{r.label}</td>
                </tr>
              );
            }

            const isCollapsible = isH1 || isH2;
            const isCollapsed = collapsedRow.has(r.key);
            const year = r.monthly.reduce((a,b) => a+b, 0);

            const labelStyle: React.CSSProperties = {
              padding: isResult ? '14px 8px 14px 24px' : isDetail ? '8px 8px 8px 56px' : isH2 ? '10px 8px 10px 40px' : '12px 8px 12px 24px',
              fontFamily: isResult || isH1 ? 'Oswald, sans-serif' : 'Lexend, sans-serif',
              fontWeight: isResult ? 700 : isH1 ? 600 : isH2 ? 500 : 400,
              fontSize: isResult ? 13 : isH1 ? 12 : isH2 ? 12 : 11,
              letterSpacing: isResult || isH1 ? '0.06em' : 0,
              color: isResult ? 'var(--rf-red)' : isH1 ? 'var(--rf-text)' : isDetail ? 'var(--rf-text-2)' : 'var(--rf-text)',
              textAlign: 'left',
              cursor: isCollapsible ? 'pointer' : undefined,
              userSelect: isCollapsible ? 'none' : undefined,
              background: isResult ? 'var(--rf-bg-panel)' : 'var(--rf-bg-card)',
              position: 'sticky', left: 0, zIndex: 1,
              borderTop: isResult ? '2px solid var(--rf-border)' : isH1 ? '1px solid var(--rf-border)' : 'none',
            };

            const valStyle = (v: number, trim: typeof TRIM[number]): React.CSSProperties => ({
              padding: isResult ? '14px 8px' : isDetail ? '8px 8px' : '10px 8px',
              fontFamily: 'Lexend, sans-serif',
              fontSize: isResult ? 13 : 12,
              fontWeight: isResult ? 700 : isH1 ? 600 : isH2 ? 500 : 400,
              color: isResult ? (v >= 0 ? 'var(--rf-green)' : 'var(--rf-red)')
                     : r.colorAccent ? r.colorAccent
                     : isDetail ? 'var(--rf-text-2)'
                     : 'var(--rf-text)',
              textAlign: 'right',
              background: trim.bg,
              borderTop: isResult ? '2px solid var(--rf-border)' : isH1 ? '1px solid var(--rf-border)' : 'none',
            });
            const yearStyle: React.CSSProperties = {
              padding: isResult ? '14px 12px' : '10px 12px',
              fontFamily: 'Lexend, sans-serif',
              fontSize: isResult ? 14 : isH1 ? 13 : 12,
              fontWeight: 700,
              color: isResult ? (year >= 0 ? 'var(--rf-green)' : 'var(--rf-red)')
                     : r.colorAccent ? r.colorAccent
                     : 'var(--rf-text)',
              textAlign: 'right',
              background: 'var(--rf-year-bg)',
              borderTop: isResult ? '2px solid var(--rf-border)' : isH1 ? '1px solid var(--rf-border)' : 'none',
            };

            return (
              <tr key={r.key} onClick={isCollapsible ? () => toggleRow(r.key) : undefined}>
                <td style={labelStyle}>
                  {isCollapsible && (
                    <span style={{ display: 'inline-block', width: 10, marginRight: 6, fontSize: 9, color: 'var(--rf-text-muted)' }}>
                      {isCollapsed ? '▶' : '▼'}
                    </span>
                  )}
                  {r.label}
                  {r.sublabel && <span style={{ fontSize: 10, color: 'var(--rf-text-muted)', marginLeft: 6 }}>· {r.sublabel}</span>}
                </td>
                {TRIM.map(t => {
                  const isColTrim = collapsedTrim.has(t.label);
                  return (
                    <React.Fragment key={t.label}>
                      {!isColTrim && t.months.map(m => (
                        <td key={m} style={valStyle(r.monthly[m], t)}>
                          {isResult ? (r.monthly[m] > 0 ? `+${valFmt(r.monthly[m])}` : valFmt(r.monthly[m])) : valFmt(r.monthly[m])}
                        </td>
                      ))}
                      <td style={{ ...valStyle(sumMonths(r.monthly, t.months), t), fontWeight: 700 }}>
                        {valFmt(sumMonths(r.monthly, t.months))}
                      </td>
                    </React.Fragment>
                  );
                })}
                <td style={yearStyle}>
                  {isResult ? (year > 0 ? `+${valFmt(year)}` : valFmt(year)) : valFmt(year)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
