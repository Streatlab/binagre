import React, { useMemo, useState } from 'react';
import { MESES_CORTO, CATEGORIA_NOMBRE, CATEGORIA_COLOR } from '@/lib/running';
import type { Categoria } from '@/lib/running';
import type { GastoRaw, IngresoMensualRaw, RangoCategoria } from '@/hooks/useRunning';
import { normalizarConcepto } from '@/lib/normalizarConcepto';

interface SueldosEmilioProps {
  plataformas: number;
  complementoSL: number;
  total: number;
}

interface Props {
  anio: number;
  gastosAnio: GastoRaw[];
  ingresosAnio: IngresoMensualRaw[];
  rangos: RangoCategoria[];
  /** Opcional: desglose sueldo Emilio para subfila RRHH */
  sueldosEmilio?: SueldosEmilioProps;
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
  /** Tipo de % a mostrar: 'ingresos' (vs ingresos netos), 'grupo' (vs total grupo padre), 'banda' (vs banda objetivo + desviación), null (sin %) */
  pctMode?: 'ingresos' | 'grupo' | 'banda' | null;
  /** Para pctMode='grupo': clave del row padre cuyo total se usa como denominador */
  pctGrupoParent?: string;
  /** Para pctMode='banda': banda objetivo */
  banda?: { min: number; max: number };
  /** Permite expansión a sub-filas marcas (canales: UE, GL, JE) */
  canalKey?: string;
}

const TRIM = [
  { label: 'Q1', months: [0,1,2], bg: 'var(--rf-q1-bg)', tot: 'var(--rf-q1-tot)', head: 'var(--rf-q1-head)' },
  { label: 'Q2', months: [3,4,5], bg: 'var(--rf-q2-bg)', tot: 'var(--rf-q2-tot)', head: 'var(--rf-q2-head)' },
  { label: 'Q3', months: [6,7,8], bg: 'var(--rf-q3-bg)', tot: 'var(--rf-q3-tot)', head: 'var(--rf-q3-head)' },
  { label: 'Q4', months: [9,10,11], bg: 'var(--rf-q4-bg)', tot: 'var(--rf-q4-tot)', head: 'var(--rf-q4-head)' },
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

function pctFmt(num: number, denom: number): string {
  if (!denom || !num) return '—';
  const p = (Math.abs(num) / Math.abs(denom)) * 100;
  if (p < 0.5) return '<1%';
  return `${Math.round(p)}%`;
}

/** Color y flecha de desviación vs banda objetivo */
function bandaSemaforo(pctReal: number, min: number, max: number): { color: string; arrow: string } {
  if (pctReal === 0) return { color: 'var(--rf-text-muted)', arrow: '' };
  if (pctReal >= min && pctReal <= max) return { color: 'var(--rf-banda-ok)', arrow: '●' };
  if (pctReal < min) {
    const pp = Math.round(min - pctReal);
    if (pp <= 1) return { color: 'var(--rf-banda-warn)', arrow: `▾${pp}` };
    return { color: 'var(--rf-banda-err)', arrow: `▾${pp}` };
  }
  // pctReal > max
  const pp = Math.round(pctReal - max);
  if (pp <= 1) return { color: 'var(--rf-banda-warn)', arrow: `▴${pp}` };
  return { color: 'var(--rf-banda-err)', arrow: `▴${pp}` };
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

export default function TablaPyG({ gastosAnio, ingresosAnio, rangos, sueldosEmilio }: Props) {
  const [collapsedTrim, setCollapsedTrim] = useState<Set<string>>(new Set());
  const [collapsedRow, setCollapsedRow] = useState<Set<string>>(new Set());
  const [rrhhExpanded, setRrhhExpanded] = useState(false);
  // Canales con sub-marcas expandidos (placeholder para cuando facturacion_diario tenga marca_id)
  const [canalesExpanded, setCanalesExpanded] = useState<Set<string>>(new Set());

  // Mes actual: solo destacar si la tabla muestra el año en curso
  const mesActualIdx = useMemo(() => {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    // Si gastosAnio o ingresosAnio cubren el año actual, marcamos el mes
    const primerGasto = gastosAnio[0]?.fecha;
    const primerIngreso = ingresosAnio[0];
    const anioTabla = primerGasto ? Number(primerGasto.slice(0, 4)) : (primerIngreso ? primerIngreso.anio : anio);
    return anioTabla === anio ? hoy.getMonth() : -1;
  }, [gastosAnio, ingresosAnio]);

  const toggleTrim = (t: string) => setCollapsedTrim(p => { const n = new Set(p); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const toggleRow = (k: string) => setCollapsedRow(p => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const toggleCanal = (k: string) => setCanalesExpanded(p => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });

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

  const gastosFijos = useMemo(() => {
    return [...Array(12)].map((_,i) =>
      gastos.perCat.RRHH[i] + gastos.perCat.ALQUILER[i] + gastos.perCat.MARKETING[i] +
      gastos.perCat.INTERNET_VENTAS[i] + gastos.perCat.ADMIN_GENERALES[i] + gastos.perCat.SUMINISTROS[i]
    );
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
    out.push({ key: 'ingresos-op', kind: 'h1', label: 'Ingresos por operaciones', monthly: ingresos.neto, colorAccent: 'var(--rf-green)', pctMode: 'ingresos' });
    out.push({ key: 'gastos-fijos', kind: 'h1', label: 'Gastos fijos', monthly: gastosFijos, colorAccent: 'var(--rf-text-2)', pctMode: 'ingresos' });
    out.push({ key: 'gastos-var', kind: 'h1', label: 'Gastos variables', monthly: gastos.perCat.PRODUCTO, colorAccent: 'var(--rf-orange)', pctMode: 'banda', banda: rangoMap['PRODUCTO'] ? { min: rangoMap['PRODUCTO'].pct_min, max: rangoMap['PRODUCTO'].pct_max } : { min: 25, max: 30 } });
    out.push({ key: 'total-gastos', kind: 'h1', label: 'Total gastos', monthly: totalGastos, colorAccent: 'var(--rf-red)', pctMode: 'ingresos' });
    out.push({ key: 'resultado', kind: 'result', label: 'Resultado', monthly: resultado, pctMode: 'ingresos' });

    out.push({ key: 'sec-dist', kind: 'section', label: 'DISTRIBUCIÓN DE GASTOS', monthly: arr12() });
    (['PRODUCTO','RRHH','ALQUILER','MARKETING','INTERNET_VENTAS','ADMIN_GENERALES','SUMINISTROS'] as Categoria[]).forEach(cat => {
      const rango = rangoMap[cat];
      const subl = rango ? `${rango.pct_min}-${rango.pct_max}%` : '';
      out.push({
        key: `dist-${cat}`, kind: 'h1', label: CATEGORIA_NOMBRE[cat], sublabel: subl,
        monthly: gastos.perCat[cat], colorAccent: CATEGORIA_COLOR[cat],
        pctMode: 'banda',
        banda: rango ? { min: rango.pct_min, max: rango.pct_max } : { min: 0, max: 100 },
      });
    });

    out.push({ key: 'sec-detalle', kind: 'section', label: 'DETALLE COMPLETO', monthly: arr12() });

    out.push({ key: 'g-10', kind: 'h1', label: '1.0 Ingresos por operación', monthly: ingresos.neto, colorAccent: 'var(--rf-green)', pctMode: 'ingresos' });
    out.push({ key: 'g-101', kind: 'h2', label: '1.01 Ingresos netos por ventas', parent: 'g-10', monthly: ingresos.neto, pctMode: 'grupo', pctGrupoParent: 'g-10' });
    Object.entries(ingresos.perCanalNeto).forEach(([canal, vals]) => {
      out.push({ key: `g-101-${canal}`, kind: 'detail', label: canal, parent: 'g-101', monthly: vals, pctMode: 'grupo', pctGrupoParent: 'g-101', canalKey: canal });
    });
    out.push({ key: 'g-102', kind: 'h2', label: '1.02 Facturación bruta por ventas', parent: 'g-10', monthly: ingresos.bruto, pctMode: 'grupo', pctGrupoParent: 'g-10' });
    Object.entries(ingresos.perCanalBruto).forEach(([canal, vals]) => {
      out.push({ key: `g-102-${canal}`, kind: 'detail', label: canal, parent: 'g-102', monthly: vals, pctMode: 'grupo', pctGrupoParent: 'g-102', canalKey: canal });
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
      const rango = rangoMap[grp.cat];
      out.push({
        key: grp.id, kind: 'h1', label: grp.label,
        monthly: gastos.perCat[grp.cat], colorAccent: CATEGORIA_COLOR[grp.cat],
        pctMode: 'banda',
        banda: rango ? { min: rango.pct_min, max: rango.pct_max } : { min: 0, max: 100 },
      });
      grp.subcats.forEach(sc => {
        const subcatKey = `${grp.cat}::${sc.code}`;
        const subcatVals = gastos.perSubcat[subcatKey] || arr12();
        const subcatRowKey = `${grp.id}-${sc.code}`;
        out.push({ key: subcatRowKey, kind: 'h2', label: sc.label, parent: grp.id, monthly: subcatVals, pctMode: 'grupo', pctGrupoParent: grp.id });
        const proveedoresSubcat = Object.entries(gastos.perProveedor)
          .filter(([, c]) => c.categoria === grp.cat && c.subcat === sc.code)
          .sort(([, a], [, b]) => b.vals.reduce((s, v) => s + v, 0) - a.vals.reduce((s, v) => s + v, 0));
        proveedoresSubcat.forEach(([k, c]) => {
          out.push({ key: `${subcatRowKey}-${k}`, kind: 'detail', label: c.label, parent: subcatRowKey, monthly: c.vals, pctMode: 'grupo', pctGrupoParent: subcatRowKey });
        });
      });
    });

    return out;
  }, [ingresos, gastos, totalGastos, gastosFijos, resultado, rangoMap]);

  const rowMap = useMemo(() => {
    const m: Record<string, Row> = {};
    rows.forEach(r => { m[r.key] = r; });
    return m;
  }, [rows]);

  const isHidden = (parent?: string): boolean => {
    if (!parent) return false;
    if (collapsedRow.has(parent)) return true;
    const parentRow = rows.find(r => r.key === parent);
    return parentRow ? isHidden(parentRow.parent) : false;
  };

  /** Calcula % a mostrar en una celda (mes o trimestre) según pctMode */
  function calcPct(r: Row, valor: number, denomIngresosMes: number): { txt: string; color?: string } {
    if (!r.pctMode || !valor) return { txt: '' };
    if (r.pctMode === 'ingresos') {
      return { txt: pctFmt(valor, denomIngresosMes), color: 'var(--rf-text-muted)' };
    }
    if (r.pctMode === 'grupo' && r.pctGrupoParent) {
      const parent = rowMap[r.pctGrupoParent];
      if (!parent) return { txt: '' };
      return { txt: pctFmt(valor, denomIngresosMes /* placeholder, se sobrescribe abajo con parent vals */), color: 'var(--rf-text-muted)' };
    }
    if (r.pctMode === 'banda' && r.banda) {
      const pct = denomIngresosMes > 0 ? (Math.abs(valor) / Math.abs(denomIngresosMes)) * 100 : 0;
      const sem = bandaSemaforo(pct, r.banda.min, r.banda.max);
      return { txt: `${Math.round(pct)}% ${sem.arrow}`, color: sem.color };
    }
    return { txt: '' };
  }

  /** % grupo necesita el valor del padre en el mismo periodo */
  function calcPctGrupo(r: Row, valor: number, mesIdx: number, trimMonths?: number[]): { txt: string; color?: string } {
    if (r.pctMode !== 'grupo' || !r.pctGrupoParent || !valor) return { txt: '' };
    const parent = rowMap[r.pctGrupoParent];
    if (!parent) return { txt: '' };
    const denom = trimMonths !== undefined ? sumMonths(parent.monthly, trimMonths) : (parent.monthly[mesIdx] || 0);
    return { txt: pctFmt(valor, denom), color: 'var(--rf-text-muted)' };
  }

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
      maxHeight: '70vh', overflowY: 'auto',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1400 }}>
        <thead>
          <tr style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--rf-bg-card)' }}>
            <th style={{ ...thBase, textAlign: 'left', paddingLeft: 24, minWidth: 280, position: 'sticky', left: 0, background: 'var(--rf-bg-card)', zIndex: 6 }} rowSpan={2}>Concepto</th>
            {TRIM.map(t => {
              const isColTrim = collapsedTrim.has(t.label);
              const isMesActualEnTrim = mesActualIdx >= 0 && t.months.includes(mesActualIdx);
              const colSpan = isColTrim ? 2 : (t.months.length * 2) + 2;
              return (
                <th
                  key={t.label}
                  colSpan={colSpan}
                  onClick={() => toggleTrim(t.label)}
                  style={{
                    ...thBase, background: t.head, cursor: 'pointer',
                    color: 'var(--rf-text)', fontWeight: 600, textAlign: 'center',
                    borderLeft: '1px solid var(--rf-border)',
                  }}
                  title={isColTrim ? 'Expandir trimestre' : 'Colapsar trimestre'}
                >
                  {isColTrim ? '▶ ' : '▼ '}{t.label}{isMesActualEnTrim ? ' · actual' : ''}
                </th>
              );
            })}
            <th style={{ ...thBase, background: 'var(--rf-year-head)', color: 'var(--rf-red)', fontWeight: 700, textAlign: 'center', borderLeft: '1px solid var(--rf-border)' }} colSpan={2} rowSpan={2}>AÑO</th>
          </tr>
          <tr style={{ position: 'sticky', top: 38, zIndex: 5, background: 'var(--rf-bg-card)' }}>
            {TRIM.map(t => {
              const isColTrim = collapsedTrim.has(t.label);
              return (
                <React.Fragment key={t.label}>
                  {!isColTrim && t.months.map(m => {
                    const isMesActual = m === mesActualIdx;
                    return (
                      <React.Fragment key={`m-${m}`}>
                        <th style={{ ...thBase, background: isMesActual ? 'var(--rf-mes-actual-head)' : t.bg, color: isMesActual ? '#1f3009' : undefined, fontWeight: isMesActual ? 700 : 500, position: 'relative' }}>
                          {MESES_CORTO[m]}
                          {isMesActual && <span style={{ position: 'absolute', top: 2, right: 4, color: '#B01D23', fontSize: 8 }}>●</span>}
                        </th>
                        <th style={{ ...thBase, background: isMesActual ? 'var(--rf-mes-actual-head)' : t.bg, fontSize: 9, opacity: 0.75 }}>%</th>
                      </React.Fragment>
                    );
                  })}
                  <th style={{ ...thBase, background: t.tot, fontWeight: 700 }}>{t.label}</th>
                  <th style={{ ...thBase, background: t.tot, fontSize: 9, opacity: 0.85 }}>%</th>
                </React.Fragment>
              );
            })}
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
                  <td colSpan={1 + TRIM.reduce((s,t) => s + (collapsedTrim.has(t.label) ? 2 : (t.months.length * 2) + 2), 0) + 2} style={{
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

            const valStyleBase = (v: number, bg: string): React.CSSProperties => ({
              padding: isResult ? '14px 8px' : isDetail ? '8px 8px' : '10px 8px',
              fontFamily: 'Lexend, sans-serif',
              fontSize: isResult ? 13 : 12,
              fontWeight: isResult ? 700 : isH1 ? 600 : isH2 ? 500 : 400,
              color: isResult ? (v >= 0 ? 'var(--rf-green)' : 'var(--rf-red)')
                     : r.colorAccent ? r.colorAccent
                     : isDetail ? 'var(--rf-text-2)'
                     : 'var(--rf-text)',
              textAlign: 'right',
              background: bg,
              borderTop: isResult ? '2px solid var(--rf-border)' : isH1 ? '1px solid var(--rf-border)' : 'none',
            });
            const pctStyleBase = (color: string | undefined, bg: string): React.CSSProperties => ({
              padding: isResult ? '14px 6px' : isDetail ? '8px 6px' : '10px 6px',
              fontFamily: 'Lexend, sans-serif',
              fontSize: 10,
              fontWeight: 500,
              color: color ?? 'var(--rf-text-muted)',
              textAlign: 'right',
              background: bg,
              borderTop: isResult ? '2px solid var(--rf-border)' : isH1 ? '1px solid var(--rf-border)' : 'none',
              opacity: 0.95,
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
            const yearPctStyle: React.CSSProperties = {
              ...yearStyle,
              padding: '10px 8px',
              fontSize: 10,
              fontWeight: 500,
              color: 'var(--rf-red)',
              opacity: 0.85,
            };

            const isRrhhRow = r.key === 'dist-RRHH' || r.key === 'g-22';
            const showRrhhToggle = isRrhhRow && !!sueldosEmilio;

            // Cálculo % año
            let yearPct: { txt: string; color?: string } = { txt: '' };
            if (r.pctMode === 'ingresos') {
              const ing = ingresos.neto.reduce((a,b) => a+b, 0);
              yearPct = { txt: pctFmt(year, ing), color: 'var(--rf-red)' };
            } else if (r.pctMode === 'grupo' && r.pctGrupoParent) {
              const parent = rowMap[r.pctGrupoParent];
              if (parent) yearPct = { txt: pctFmt(year, parent.monthly.reduce((a,b)=>a+b,0)), color: 'var(--rf-red)' };
            } else if (r.pctMode === 'banda' && r.banda) {
              const ing = ingresos.neto.reduce((a,b) => a+b, 0);
              const pct = ing > 0 ? (Math.abs(year) / Math.abs(ing)) * 100 : 0;
              const sem = bandaSemaforo(pct, r.banda.min, r.banda.max);
              yearPct = { txt: `${Math.round(pct)}% ${sem.arrow}`, color: sem.color };
            }

            return (
              <React.Fragment key={r.key}>
              <tr onClick={isCollapsible ? () => {
                if (isRrhhRow && showRrhhToggle) setRrhhExpanded(p => !p);
                else toggleRow(r.key);
              } : undefined}>
                <td style={labelStyle}>
                  {isCollapsible && (
                    <span style={{ display: 'inline-block', width: 10, marginRight: 6, fontSize: 9, color: 'var(--rf-text-muted)' }}>
                      {(isRrhhRow ? rrhhExpanded : !isCollapsed) ? '▼' : '▶'}
                    </span>
                  )}
                  {/* Toggle marcas en filas detail de canales */}
                  {isDetail && r.canalKey && (
                    <span
                      onClick={(e) => { e.stopPropagation(); toggleCanal(r.key); }}
                      style={{ display: 'inline-block', width: 10, marginRight: 6, fontSize: 9, color: 'var(--rf-text-muted)', cursor: 'pointer' }}
                      title="Ver marcas (próximamente)"
                    >
                      {canalesExpanded.has(r.key) ? '▼' : '▶'}
                    </span>
                  )}
                  {r.label}
                  {r.sublabel && <span style={{ fontSize: 10, color: 'var(--rf-text-muted)', marginLeft: 6 }}>· {r.sublabel}</span>}
                  {showRrhhToggle && (
                    <span style={{ fontSize: 9, color: 'var(--rf-text-muted)', marginLeft: 8 }}>
                      {rrhhExpanded ? '(colapsar desglose)' : '(ver desglose Emilio)'}
                    </span>
                  )}
                </td>
                {TRIM.map(t => {
                  const isColTrim = collapsedTrim.has(t.label);
                  return (
                    <React.Fragment key={t.label}>
                      {!isColTrim && t.months.map(m => {
                        const isMesActual = m === mesActualIdx;
                        const cellBg = isMesActual ? 'var(--rf-mes-actual)' : t.bg;
                        const v = r.monthly[m];
                        // Calcular % de la celda
                        let pctCell: { txt: string; color?: string } = { txt: '' };
                        if (r.pctMode === 'ingresos') {
                          pctCell = { txt: pctFmt(v, ingresos.neto[m]), color: 'var(--rf-text-muted)' };
                        } else if (r.pctMode === 'grupo' && r.pctGrupoParent) {
                          pctCell = calcPctGrupo(r, v, m);
                        } else if (r.pctMode === 'banda' && r.banda) {
                          const denom = ingresos.neto[m];
                          if (denom > 0 && v) {
                            const pct = (Math.abs(v) / Math.abs(denom)) * 100;
                            const sem = bandaSemaforo(pct, r.banda.min, r.banda.max);
                            pctCell = { txt: `${Math.round(pct)}% ${sem.arrow}`, color: sem.color };
                          }
                        }
                        return (
                          <React.Fragment key={m}>
                            <td style={valStyleBase(v, cellBg)}>
                              {isResult ? (v > 0 ? `+${valFmt(v)}` : valFmt(v)) : valFmt(v)}
                            </td>
                            <td style={pctStyleBase(pctCell.color, cellBg)}>{pctCell.txt}</td>
                          </React.Fragment>
                        );
                      })}
                      {/* Total trimestre */}
                      {(() => {
                        const trimVal = sumMonths(r.monthly, t.months);
                        let pctTrim: { txt: string; color?: string } = { txt: '' };
                        if (r.pctMode === 'ingresos') {
                          const ingTrim = sumMonths(ingresos.neto, t.months);
                          pctTrim = { txt: pctFmt(trimVal, ingTrim), color: 'var(--rf-text-muted)' };
                        } else if (r.pctMode === 'grupo' && r.pctGrupoParent) {
                          pctTrim = calcPctGrupo(r, trimVal, 0, t.months);
                        } else if (r.pctMode === 'banda' && r.banda) {
                          const ingTrim = sumMonths(ingresos.neto, t.months);
                          if (ingTrim > 0 && trimVal) {
                            const pct = (Math.abs(trimVal) / Math.abs(ingTrim)) * 100;
                            const sem = bandaSemaforo(pct, r.banda.min, r.banda.max);
                            pctTrim = { txt: `${Math.round(pct)}% ${sem.arrow}`, color: sem.color };
                          }
                        }
                        return (
                          <>
                            <td style={{ ...valStyleBase(trimVal, t.tot), fontWeight: 700 }}>
                              {isResult ? (trimVal > 0 ? `+${valFmt(trimVal)}` : valFmt(trimVal)) : valFmt(trimVal)}
                            </td>
                            <td style={pctStyleBase(pctTrim.color, t.tot)}>{pctTrim.txt}</td>
                          </>
                        );
                      })()}
                    </React.Fragment>
                  );
                })}
                <td style={yearStyle}>
                  {isResult ? (year > 0 ? `+${valFmt(year)}` : valFmt(year)) : valFmt(year)}
                </td>
                <td style={{ ...yearPctStyle, color: yearPct.color || 'var(--rf-red)' }}>{yearPct.txt}</td>
              </tr>
              {/* Sub-filas marcas (placeholder) cuando se expande un canal */}
              {isDetail && r.canalKey && canalesExpanded.has(r.key) && (
                <tr>
                  <td colSpan={1 + TRIM.reduce((s,t) => s + (collapsedTrim.has(t.label) ? 2 : (t.months.length * 2) + 2), 0) + 2} style={{
                    padding: '8px 8px 8px 80px',
                    fontFamily: 'Lexend, sans-serif',
                    fontSize: 11,
                    color: 'var(--rf-text-muted)',
                    background: 'var(--rf-bg-panel)',
                    fontStyle: 'italic',
                    borderBottom: '1px solid var(--rf-border)',
                  }}>
                    Desglose por marca virtual de {r.label} — pendiente de activar al añadir <code style={{ background: 'var(--rf-bg-card)', padding: '1px 4px', borderRadius: 3, fontSize: 10 }}>marca_id</code> a facturacion_diario
                  </td>
                </tr>
              )}
              {/* Subfilas RRHH Emilio: Plataformas + Complemento SL */}
              {showRrhhToggle && rrhhExpanded && sueldosEmilio && (
                <>
                  <tr>
                    <td style={{ padding: '7px 8px 7px 56px', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: 'var(--rf-text-2)', background: 'var(--rf-bg-card)', position: 'sticky', left: 0, zIndex: 1 }}>
                      Emilio · Plataformas
                    </td>
                    {TRIM.map(t => {
                      const isColTrim = collapsedTrim.has(t.label);
                      return (
                        <React.Fragment key={t.label}>
                          {!isColTrim && t.months.map(m => (
                            <React.Fragment key={m}>
                              <td style={{ padding: '7px 8px', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: 'var(--rf-text-2)', textAlign: 'right', background: t.bg }}>—</td>
                              <td style={{ padding: '7px 6px', fontFamily: 'Lexend, sans-serif', fontSize: 10, color: 'var(--rf-text-muted)', textAlign: 'right', background: t.bg }}></td>
                            </React.Fragment>
                          ))}
                          <td style={{ padding: '7px 8px', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: 'var(--rf-text-2)', textAlign: 'right', background: t.tot, fontWeight: 600 }}>
                            {valFmt(sueldosEmilio.plataformas / 4)}
                          </td>
                          <td style={{ padding: '7px 6px', fontFamily: 'Lexend, sans-serif', fontSize: 10, color: 'var(--rf-text-muted)', textAlign: 'right', background: t.tot }}></td>
                        </React.Fragment>
                      );
                    })}
                    <td style={{ padding: '7px 12px', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: 'var(--rf-text-2)', textAlign: 'right', background: 'var(--rf-year-bg)', fontWeight: 700 }}>
                      {valFmt(sueldosEmilio.plataformas)}
                    </td>
                    <td style={{ padding: '7px 8px', fontFamily: 'Lexend, sans-serif', fontSize: 10, color: 'var(--rf-red)', textAlign: 'right', background: 'var(--rf-year-bg)' }}></td>
                  </tr>
                  <tr>
                    <td style={{ padding: '7px 8px 7px 56px', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: 'var(--rf-text-2)', background: 'var(--rf-bg-card)', position: 'sticky', left: 0, zIndex: 1 }}>
                      Emilio · Complemento SL
                    </td>
                    {TRIM.map(t => {
                      const isColTrim = collapsedTrim.has(t.label);
                      return (
                        <React.Fragment key={t.label}>
                          {!isColTrim && t.months.map(m => (
                            <React.Fragment key={m}>
                              <td style={{ padding: '7px 8px', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: 'var(--rf-text-2)', textAlign: 'right', background: t.bg }}>—</td>
                              <td style={{ padding: '7px 6px', background: t.bg }}></td>
                            </React.Fragment>
                          ))}
                          <td style={{ padding: '7px 8px', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: 'var(--rf-text-2)', textAlign: 'right', background: t.tot, fontWeight: 600 }}>
                            {valFmt(sueldosEmilio.complementoSL / 4)}
                          </td>
                          <td style={{ padding: '7px 6px', background: t.tot }}></td>
                        </React.Fragment>
                      );
                    })}
                    <td style={{ padding: '7px 12px', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: 'var(--rf-text-2)', textAlign: 'right', background: 'var(--rf-year-bg)', fontWeight: 700 }}>
                      {valFmt(sueldosEmilio.complementoSL)}
                    </td>
                    <td style={{ padding: '7px 8px', background: 'var(--rf-year-bg)' }}></td>
                  </tr>
                  <tr>
                    <td style={{ padding: '7px 8px 7px 56px', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: 'var(--rf-text-2)', background: 'var(--rf-bg-card)', position: 'sticky', left: 0, zIndex: 1, fontStyle: 'italic' }}>
                      Rubén · pendiente
                    </td>
                    {TRIM.map(t => {
                      const isColTrim = collapsedTrim.has(t.label);
                      return (
                        <React.Fragment key={t.label}>
                          {!isColTrim && t.months.map(m => (
                            <React.Fragment key={m}>
                              <td style={{ padding: '7px 8px', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: 'var(--rf-text-muted)', textAlign: 'right', background: t.bg }}>—</td>
                              <td style={{ padding: '7px 6px', background: t.bg }}></td>
                            </React.Fragment>
                          ))}
                          <td style={{ padding: '7px 8px', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: 'var(--rf-text-muted)', textAlign: 'right', background: t.tot }}>—</td>
                          <td style={{ padding: '7px 6px', background: t.tot }}></td>
                        </React.Fragment>
                      );
                    })}
                    <td style={{ padding: '7px 12px', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: 'var(--rf-text-muted)', textAlign: 'right', background: 'var(--rf-year-bg)' }}>—</td>
                    <td style={{ padding: '7px 8px', background: 'var(--rf-year-bg)' }}></td>
                  </tr>
                </>
              )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
