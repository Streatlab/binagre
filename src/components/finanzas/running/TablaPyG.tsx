/**
 * TablaPyG — refactor 3 may 2026 v3
 *
 * Cambios respecto v2 (Rubén):
 * - VUELVE paleta pastel trimestres (var(--rf-q1-bg)…) en headers Y celdas. Year column rosa pastel.
 * - Fila "RESUMEN" arriba con: Bruto · Neto estimado · Total gastos · EBITDA (estilo del Excel).
 * - Grupos Producto/Equipo/Local/Controlables son DESPLEGABLES (igual que canales).
 *   Si no tienen subs con datos, NO sale flecha.
 * - Ingresos netos = bruto − comisiones plataforma estimadas (UE 30%, GL 32%, JE 28%, Web 5%, Directa 0%)
 *   mientras no haya facturas reales. Etiqueta "estimado".
 *   ⚠️ AUTOMÁTICO: si en el futuro se rellena resumenes_plataforma_marca_mensual con netos reales,
 *   este componente debe leer de ahí (TODO en CTR-OTR del backlog).
 * - Etiqueta "Facturación neta" (alineada con módulo Facturación) en lugar de "Ingresos netos por venta".
 */
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MESES_CORTO } from '@/lib/running';
import type { GastoRaw, IngresoMensualRaw, FacturacionDiariaRaw, RangoCategoria } from '@/hooks/useRunning';

interface CategoriaMaestra {
  codigo: string;
  nombre: string;
  grupo: string;
  orden_grupo: number;
  orden_sub: number;
  banda_min_pct: number | null;
  banda_max_pct: number | null;
}

interface Props {
  anio: number;
  gastosAnio: GastoRaw[];
  ingresosAnio: IngresoMensualRaw[];
  facturacionAnio?: FacturacionDiariaRaw[];
  rangos: RangoCategoria[];
}

// ── Trimestres con paleta pastel del CSS ──
const TRIM = [
  { label: 'T1', months: [0,1,2],  bg: 'var(--rf-q1-bg)', tot: 'var(--rf-q1-tot)', head: 'var(--rf-q1-head)' },
  { label: 'T2', months: [3,4,5],  bg: 'var(--rf-q2-bg)', tot: 'var(--rf-q2-tot)', head: 'var(--rf-q2-head)' },
  { label: 'T3', months: [6,7,8],  bg: 'var(--rf-q3-bg)', tot: 'var(--rf-q3-tot)', head: 'var(--rf-q3-head)' },
  { label: 'T4', months: [9,10,11],bg: 'var(--rf-q4-bg)', tot: 'var(--rf-q4-tot)', head: 'var(--rf-q4-head)' },
];

// ── Canales con su % comisión estimada (igual que Panel Global ColFacturacionCanal) ──
const CANALES = [
  { key: 'UE',  label: 'Uber Eats',     canalIM: 'UBER EATS', brutoCol: 'uber_bruto',    comision: 0.30, color: '#06C167' },
  { key: 'GL',  label: 'Glovo',         canalIM: 'GLOVO',     brutoCol: 'glovo_bruto',   comision: 0.32, color: '#e8f442' },
  { key: 'JE',  label: 'Just Eat',      canalIM: 'JUST EAT',  brutoCol: 'je_bruto',      comision: 0.28, color: '#f5a623' },
  { key: 'WEB', label: 'Tienda online', canalIM: 'WEB',       brutoCol: 'web_bruto',     comision: 0.05, color: '#B01D23' },
  { key: 'DIR', label: 'Venta directa', canalIM: 'DIRECTA',   brutoCol: 'directa_bruto', comision: 0.0,  color: '#66aaff' },
] as const;

const GRUPOS_GASTO = [
  { key: 'PRODUCTO',     label: 'Producto',     color: '#7B4F2A' },
  { key: 'EQUIPO',       label: 'Equipo',       color: '#4A5980' },
  { key: 'LOCAL',        label: 'Local',        color: '#5A8A6F' },
  { key: 'CONTROLABLES', label: 'Controlables', color: '#A87C3D' },
] as const;

const arr12 = (): number[] => [0,0,0,0,0,0,0,0,0,0,0,0];
const sumMonths = (arr: number[], months: number[]) => months.reduce((a, m) => a + (arr[m] || 0), 0);

function valFmt(v: number): string {
  if (!v || isNaN(v)) return '—';
  const [int, dec] = Math.abs(v).toFixed(2).split('.');
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const out = `${intFmt},${dec}`;
  return v < 0 ? `−${out}` : out;
}

function pctFmt(num: number, denom: number): string {
  if (!denom || !num) return '';
  const p = (Math.abs(num) / Math.abs(denom)) * 100;
  if (p < 1) return '<1%';
  return `${Math.round(p)}%`;
}

function bandaSemaforo(pctReal: number, min: number, max: number): { color: string; arrow: string } {
  if (pctReal === 0) return { color: 'var(--rf-text-muted)', arrow: '' };
  if (pctReal >= min && pctReal <= max) return { color: 'var(--rf-banda-ok)', arrow: '●' };
  if (pctReal < min) {
    const pp = Math.round(min - pctReal);
    return { color: pp <= 1 ? 'var(--rf-banda-warn)' : 'var(--rf-banda-err)', arrow: `▾${pp}` };
  }
  const pp = Math.round(pctReal - max);
  return { color: pp <= 1 ? 'var(--rf-banda-warn)' : 'var(--rf-banda-err)', arrow: `▴${pp}` };
}

type RowKind = 'h0'|'h1'|'detail'|'subdetail'|'total';
interface Row {
  key: string;
  kind: RowKind;
  label: string;
  monthly: number[];
  parentKey?: string;
  expandable?: boolean;
  pctMode?: 'ingresos' | 'banda' | 'parent' | null;
  parentForPct?: string;
  banda?: { min: number; max: number } | null;
  italic?: boolean;
  isInfoOnly?: boolean;
  isResult?: boolean;
  colorAccent?: string;
  isResumen?: boolean;
  isSubMarca?: boolean;
}

export default function TablaPyG({ anio, gastosAnio, ingresosAnio, facturacionAnio = [] }: Props) {
  const [collapsedTrim, setCollapsedTrim] = useState<Set<string>>(new Set());
  const [collapsedRow, setCollapsedRow] = useState<Set<string>>(new Set());
  const [catsMaestras, setCatsMaestras] = useState<CategoriaMaestra[]>([]);

  const mesActualIdx = useMemo(() => {
    const hoy = new Date();
    return hoy.getFullYear() === anio ? hoy.getMonth() : -1;
  }, [anio]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data: cats } = await supabase
        .from('categorias_maestras')
        .select('*')
        .eq('activa', true)
        .order('orden_grupo')
        .order('orden_sub');
      if (cancel) return;
      setCatsMaestras((cats ?? []) as CategoriaMaestra[]);
    })();
    return () => { cancel = true; };
  }, []);

  const toggleTrim = (t: string) => setCollapsedTrim(p => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; });
  const toggleRow = (k: string) => setCollapsedRow(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  // ── Bruto por canal y mensual ──
  const ingresos = useMemo(() => {
    const brutoPorCanal: Record<string, number[]> = {};
    const brutoTotal = arr12();
    const netoEstPorCanal: Record<string, number[]> = {};
    const netoEstTotal = arr12();

    for (const f of facturacionAnio) {
      const m = Number(f.fecha.slice(5, 7)) - 1;
      if (m < 0 || m > 11) continue;
      for (const c of CANALES) {
        const v = Number((f as any)[c.brutoCol] || 0);
        if (!v) continue;
        brutoPorCanal[c.key] = brutoPorCanal[c.key] || arr12();
        brutoPorCanal[c.key][m] += v;
        brutoTotal[m] += v;

        const neto = v * (1 - c.comision);
        netoEstPorCanal[c.key] = netoEstPorCanal[c.key] || arr12();
        netoEstPorCanal[c.key][m] += neto;
        netoEstTotal[m] += neto;
      }
    }
    return { brutoPorCanal, brutoTotal, netoEstPorCanal, netoEstTotal };
  }, [facturacionAnio]);

  const gastosPorCodigo = useMemo(() => {
    const m: Record<string, number[]> = {};
    for (const g of gastosAnio) {
      const cod = (g.categoria as unknown as string) ?? '';
      if (!cod) continue;
      const idx = Number(g.fecha.slice(5, 7)) - 1;
      if (idx < 0 || idx > 11) continue;
      m[cod] = m[cod] || arr12();
      m[cod][idx] += Number(g.importe || 0);
    }
    return m;
  }, [gastosAnio]);

  const ingNetoTotal = ingresos.netoEstTotal;

  const rows: Row[] = useMemo(() => {
    if (catsMaestras.length === 0) return [];
    const out: Row[] = [];

    // ════ RESUMEN ════
    // Calculamos antes para poder ponerlo arriba
    const totalGastosMensual = arr12();
    const grupoMensualMap: Record<string, number[]> = {};
    for (const grp of GRUPOS_GASTO) {
      const subs = catsMaestras.filter(c => c.grupo === grp.key);
      const grupoMensual = arr12();
      for (const s of subs) {
        const vals = gastosPorCodigo[s.codigo];
        if (!vals) continue;
        for (let i = 0; i < 12; i++) grupoMensual[i] += vals[i];
      }
      grupoMensualMap[grp.key] = grupoMensual;
      for (let i = 0; i < 12; i++) totalGastosMensual[i] += grupoMensual[i];
    }
    const ebitda = arr12();
    for (let i = 0; i < 12; i++) ebitda[i] = ingNetoTotal[i] - totalGastosMensual[i];

    out.push({
      key: 'res-bruto',
      kind: 'h0',
      label: 'Facturación bruta',
      monthly: ingresos.brutoTotal,
      pctMode: null,
      isResumen: true,
      italic: true,
    });
    out.push({
      key: 'res-neto',
      kind: 'h0',
      label: 'Facturación neta · estimada',
      monthly: ingNetoTotal,
      pctMode: null,
      isResumen: true,
      colorAccent: 'var(--rf-green)',
    });
    out.push({
      key: 'res-gastos',
      kind: 'h0',
      label: 'Total gastos',
      monthly: totalGastosMensual,
      pctMode: 'ingresos',
      isResumen: true,
      colorAccent: '#E89A3C',
    });
    out.push({
      key: 'res-ebitda',
      kind: 'h0',
      label: 'EBITDA',
      monthly: ebitda,
      pctMode: 'ingresos',
      isResumen: true,
      isResult: true,
    });

    // ════ INGRESOS netos por canal (desplegable) ════
    out.push({
      key: 'ingresos-netos',
      kind: 'h1',
      label: 'Facturación neta · estimada',
      monthly: ingNetoTotal,
      expandable: true,
      pctMode: 'ingresos',
      colorAccent: 'var(--rf-green)',
    });
    for (const c of CANALES) {
      const vals = ingresos.netoEstPorCanal[c.key] ?? arr12();
      if (!vals.some(v => v > 0)) continue;
      out.push({
        key: `in-${c.key}`,
        kind: 'detail',
        label: c.label,
        parentKey: 'ingresos-netos',
        monthly: vals,
        pctMode: 'parent',
        parentForPct: 'ingresos-netos',
      });
    }

    // ════ Facturación bruta (desplegable, informativa) ════
    if (ingresos.brutoTotal.some(v => v > 0)) {
      out.push({
        key: 'fact-bruta',
        kind: 'h1',
        label: 'Facturación bruta · informativa',
        monthly: ingresos.brutoTotal,
        expandable: true,
        pctMode: null,
        isInfoOnly: true,
        italic: true,
      });
      for (const c of CANALES) {
        const vals = ingresos.brutoPorCanal[c.key] ?? arr12();
        if (!vals.some(v => v > 0)) continue;
        out.push({
          key: `fb-${c.key}`,
          kind: 'detail',
          label: c.label,
          parentKey: 'fact-bruta',
          monthly: vals,
          pctMode: 'parent',
          parentForPct: 'fact-bruta',
          italic: true,
          isInfoOnly: true,
        });
      }
    }

    // ════ GASTOS por grupo (desplegables) ════
    for (const grp of GRUPOS_GASTO) {
      const subs = catsMaestras.filter(c => c.grupo === grp.key);
      if (subs.length === 0) continue;
      const grupoMensual = grupoMensualMap[grp.key];

      const subConBanda = subs.find(s => s.banda_min_pct != null && s.banda_max_pct != null);
      const banda = subConBanda
        ? { min: Number(subConBanda.banda_min_pct), max: Number(subConBanda.banda_max_pct) }
        : null;

      const subsConDatos = subs.filter(s => gastosPorCodigo[s.codigo] && gastosPorCodigo[s.codigo].some(v => v > 0));
      const expandable = subsConDatos.length > 0;

      out.push({
        key: `g-${grp.key}`,
        kind: 'h1',
        label: grp.label,
        monthly: grupoMensual,
        expandable,
        pctMode: banda ? 'banda' : 'ingresos',
        banda,
        colorAccent: grp.color,
      });
      for (const s of subsConDatos) {
        out.push({
          key: `s-${s.codigo}`,
          kind: 'detail',
          label: s.nombre,
          parentKey: `g-${grp.key}`,
          monthly: gastosPorCodigo[s.codigo],
          pctMode: 'parent',
          parentForPct: `g-${grp.key}`,
        });
      }
    }

    // ════ TOTAL GASTOS + EBITDA (también al final, doble vista) ════
    out.push({
      key: 'total-gastos',
      kind: 'total',
      label: 'Total gastos',
      monthly: totalGastosMensual,
      pctMode: 'ingresos',
    });
    out.push({
      key: 'ebitda',
      kind: 'total',
      label: 'EBITDA',
      monthly: ebitda,
      pctMode: 'ingresos',
      isResult: true,
    });

    return out;
  }, [catsMaestras, ingresos, gastosPorCodigo, ingNetoTotal]);

  const rowMap = useMemo(() => {
    const m: Record<string, Row> = {};
    for (const r of rows) m[r.key] = r;
    return m;
  }, [rows]);

  const isHidden = (parentKey?: string): boolean => {
    if (!parentKey) return false;
    if (collapsedRow.has(parentKey)) return true;
    const parent = rowMap[parentKey];
    if (!parent) return false;
    return isHidden(parent.parentKey);
  };

  const thBase: React.CSSProperties = {
    fontFamily: 'Oswald, sans-serif',
    fontSize: 10,
    letterSpacing: '0.1em',
    fontWeight: 500,
    color: 'var(--rf-text-label)',
    padding: '8px 6px',
    textAlign: 'right',
    borderBottom: '1px solid var(--rf-border)',
    textTransform: 'uppercase',
  };

  if (catsMaestras.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--rf-text-muted)', fontFamily: 'Lexend, sans-serif', fontSize: 12 }}>
        Cargando plan contable…
      </div>
    );
  }

  function calcPct(r: Row, valor: number, denomMes: number, parentValMes: number): { txt: string; color?: string } {
    if (!r.pctMode || !valor) return { txt: '' };
    if (r.pctMode === 'ingresos') return { txt: pctFmt(valor, denomMes), color: 'var(--rf-text-muted)' };
    if (r.pctMode === 'parent')   return { txt: pctFmt(valor, parentValMes), color: 'var(--rf-text-muted)' };
    if (r.pctMode === 'banda' && r.banda) {
      const denom = denomMes;
      if (denom <= 0) return { txt: '', color: 'var(--rf-text-muted)' };
      const pct = (Math.abs(valor) / Math.abs(denom)) * 100;
      const sem = bandaSemaforo(pct, r.banda.min, r.banda.max);
      return { txt: `${Math.round(pct)}% ${sem.arrow}`, color: sem.color };
    }
    return { txt: '' };
  }

  return (
    <div style={{
      background: 'var(--rf-bg-card)',
      borderRadius: 12,
      border: '1px solid var(--rf-border)',
      overflowX: 'auto',
      maxHeight: '74vh',
      overflowY: 'auto',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
        <thead>
          <tr style={{ position: 'sticky', top: 0, zIndex: 6, background: 'var(--rf-bg-card)' }}>
            <th style={{
              ...thBase, textAlign: 'left', paddingLeft: 18, minWidth: 230,
              position: 'sticky', left: 0, background: 'var(--rf-bg-card)', zIndex: 7,
              borderRight: '1px solid var(--rf-border)',
            }} rowSpan={2} />
            {TRIM.map(t => {
              const isCol = collapsedTrim.has(t.label);
              const isMesActualEnTrim = mesActualIdx >= 0 && t.months.includes(mesActualIdx);
              const colSpan = isCol ? 2 : (t.months.length * 2) + 2;
              return (
                <th
                  key={t.label}
                  colSpan={colSpan}
                  onClick={() => toggleTrim(t.label)}
                  style={{
                    ...thBase,
                    background: t.head,
                    cursor: 'pointer',
                    color: 'var(--rf-text)',
                    fontWeight: 600,
                    textAlign: 'center',
                    borderLeft: '1px solid var(--rf-border)',
                    fontSize: 11,
                    letterSpacing: '0.15em',
                  }}
                >
                  {isCol ? '▶ ' : '▼ '}{t.label}{isMesActualEnTrim ? ' · actual' : ''}
                </th>
              );
            })}
            <th
              colSpan={2}
              rowSpan={2}
              style={{
                ...thBase,
                background: 'var(--rf-year-head)',
                color: 'var(--rf-red)',
                fontWeight: 700,
                textAlign: 'center',
                borderLeft: '1px solid var(--rf-border)',
                fontSize: 12,
                letterSpacing: '0.15em',
                padding: '8px 6px',
                width: 110,
                minWidth: 110,
              }}
            >
              {anio}
            </th>
          </tr>
          <tr style={{ position: 'sticky', top: 30, zIndex: 6, background: 'var(--rf-bg-card)' }}>
            {TRIM.map(t => {
              const isCol = collapsedTrim.has(t.label);
              return (
                <React.Fragment key={t.label}>
                  {!isCol && t.months.map(m => {
                    const isMesActual = m === mesActualIdx;
                    return (
                      <React.Fragment key={`m-${m}`}>
                        <th style={{
                          ...thBase,
                          background: isMesActual ? 'var(--rf-mes-actual-head)' : t.bg,
                          color: isMesActual ? '#1f3009' : undefined,
                          fontWeight: isMesActual ? 700 : 500,
                          width: 64,
                          minWidth: 64,
                          position: 'relative',
                        }}>
                          {MESES_CORTO[m]}
                          {isMesActual && (
                            <span style={{ position: 'absolute', top: 2, right: 4, color: 'var(--rf-red)', fontSize: 8 }}>●</span>
                          )}
                        </th>
                        <th style={{
                          ...thBase,
                          background: isMesActual ? 'var(--rf-mes-actual-head)' : t.bg,
                          fontSize: 9,
                          opacity: 0.75,
                          width: 32,
                          minWidth: 32,
                          padding: '8px 3px',
                        }}>%</th>
                      </React.Fragment>
                    );
                  })}
                  <th style={{ ...thBase, background: t.tot, fontWeight: 700, width: 72, minWidth: 72 }}>{t.label}</th>
                  <th style={{ ...thBase, background: t.tot, fontSize: 9, opacity: 0.85, width: 32, minWidth: 32, padding: '8px 3px' }}>%</th>
                </React.Fragment>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map(r => {
            if (isHidden(r.parentKey)) return null;
            const isExpandable = !!r.expandable;
            const isCollapsed = collapsedRow.has(r.key);
            const isH0 = r.kind === 'h0';
            const isH1 = r.kind === 'h1';
            const isDetail = r.kind === 'detail';
            const isTotal = r.kind === 'total';
            const isResult = !!r.isResult;
            const isResumen = !!r.isResumen;

            const indent = isDetail ? 36 : 18;
            const labelStyle: React.CSSProperties = {
              padding: isTotal ? '12px 6px 12px 18px'
                     : isDetail ? '8px 6px 8px ' + indent + 'px'
                     :            (isH0 ? '8px 6px 8px 18px' : '10px 6px 10px 18px'),
              fontFamily: (isH1 || isTotal || isH0) ? 'Oswald, sans-serif' : 'Lexend, sans-serif',
              fontWeight: isTotal ? 700 : (isH0 || isH1) ? 600 : 400,
              fontSize: isTotal ? 12 : isH0 ? 11 : isH1 ? 12 : 11,
              letterSpacing: (isH1 || isTotal || isH0) ? '0.06em' : 0,
              textTransform: isH0 ? ('uppercase' as const) : ('none' as const),
              color: isResult
                ? 'var(--rf-red)'
                : r.italic
                  ? 'var(--rf-text-muted)'
                  : (isH0 || isH1)
                    ? 'var(--rf-text)'
                    : isDetail
                      ? 'var(--rf-text-2)'
                      : 'var(--rf-text)',
              textAlign: 'left',
              cursor: isExpandable ? 'pointer' : undefined,
              userSelect: isExpandable ? 'none' : undefined,
              background: isResumen ? 'var(--rf-bg-panel)' : (isTotal ? 'var(--rf-bg-panel)' : 'var(--rf-bg-card)'),
              position: 'sticky',
              left: 0,
              zIndex: 1,
              borderTop: isTotal ? '2px solid var(--rf-border)' : (isH1 || isH0) ? '1px solid var(--rf-border)' : 'none',
              borderRight: '1px solid var(--rf-border)',
              fontStyle: r.italic ? 'italic' : 'normal',
              whiteSpace: 'nowrap',
            };

            const onLabelClick = () => { if (isExpandable) toggleRow(r.key); };

            const yearVal = r.monthly.reduce((a, b) => a + b, 0);
            const ingNetoYear = ingNetoTotal.reduce((a, b) => a + b, 0);
            const parentRow = r.parentForPct ? rowMap[r.parentForPct] : undefined;
            const parentYear = parentRow ? parentRow.monthly.reduce((a, b) => a + b, 0) : 0;

            let yearPct: { txt: string; color?: string } = { txt: '' };
            if (r.pctMode === 'ingresos')      yearPct = { txt: pctFmt(yearVal, ingNetoYear), color: 'var(--rf-red)' };
            else if (r.pctMode === 'parent')   yearPct = { txt: pctFmt(yearVal, parentYear), color: 'var(--rf-red)' };
            else if (r.pctMode === 'banda' && r.banda) {
              const pct = ingNetoYear > 0 ? (Math.abs(yearVal) / Math.abs(ingNetoYear)) * 100 : 0;
              const sem = bandaSemaforo(pct, r.banda.min, r.banda.max);
              yearPct = { txt: `${Math.round(pct)}% ${sem.arrow}`, color: sem.color };
            }

            const valStyle = (v: number, bg: string, isPctCell = false): React.CSSProperties => ({
              padding: isTotal ? '12px 6px' : isDetail ? '8px 6px' : isH0 ? '8px 6px' : '10px 6px',
              fontFamily: 'Lexend, sans-serif',
              fontSize: isPctCell ? 10 : (isTotal ? 12 : isH0 ? 11 : 11.5),
              fontWeight: isTotal ? 700 : (isH0 || isH1) ? 600 : 400,
              color: isResult
                ? (v >= 0 ? 'var(--rf-green)' : 'var(--rf-red)')
                : r.colorAccent
                  ? r.colorAccent
                  : (isDetail ? 'var(--rf-text-2)' : 'var(--rf-text)'),
              textAlign: 'right',
              background: isResumen ? 'var(--rf-bg-panel)' : bg,
              borderTop: isTotal ? '2px solid var(--rf-border)' : (isH1 || isH0) ? '1px solid var(--rf-border)' : 'none',
              fontStyle: r.italic ? 'italic' : 'normal',
              whiteSpace: 'nowrap',
            });

            const yearStyle: React.CSSProperties = {
              ...valStyle(yearVal, 'var(--rf-year-bg)'),
              fontSize: isTotal ? 13 : 12,
              fontWeight: 700,
              color: isResult ? (yearVal >= 0 ? 'var(--rf-green)' : 'var(--rf-red)') : (r.colorAccent || 'var(--rf-text)'),
              background: 'var(--rf-year-bg)',
            };
            const yearPctStyle: React.CSSProperties = {
              padding: isTotal ? '12px 4px' : isDetail ? '8px 4px' : isH0 ? '8px 4px' : '10px 4px',
              fontFamily: 'Lexend, sans-serif',
              fontSize: 10,
              fontWeight: 500,
              color: yearPct.color || 'var(--rf-red)',
              textAlign: 'right',
              background: 'var(--rf-year-bg)',
              borderTop: isTotal ? '2px solid var(--rf-border)' : (isH1 || isH0) ? '1px solid var(--rf-border)' : 'none',
            };

            return (
              <tr key={r.key} onClick={onLabelClick}>
                <td style={labelStyle}>
                  {isExpandable && (
                    <span style={{ display: 'inline-block', width: 10, marginRight: 6, fontSize: 9, color: 'var(--rf-text-muted)' }}>
                      {isCollapsed ? '▶' : '▼'}
                    </span>
                  )}
                  {r.label}
                </td>
                {TRIM.map(t => {
                  const isCol = collapsedTrim.has(t.label);
                  return (
                    <React.Fragment key={t.label}>
                      {!isCol && t.months.map(m => {
                        const v = r.monthly[m];
                        const isMesActual = m === mesActualIdx;
                        const cellBg = isMesActual ? 'var(--rf-mes-actual)' : t.bg;
                        const denomMes = ingNetoTotal[m] || 0;
                        const parentValMes = parentRow ? parentRow.monthly[m] : 0;
                        const pctCell = calcPct(r, v, denomMes, parentValMes);
                        return (
                          <React.Fragment key={m}>
                            <td style={valStyle(v, cellBg)}>
                              {isResult ? (v > 0 ? `+${valFmt(v)}` : valFmt(v)) : valFmt(v)}
                            </td>
                            <td style={{ ...valStyle(0, cellBg, true), color: pctCell.color || 'var(--rf-text-muted)', fontWeight: 500 }}>{pctCell.txt}</td>
                          </React.Fragment>
                        );
                      })}
                      {(() => {
                        const trimVal = sumMonths(r.monthly, t.months);
                        const denomTrim = sumMonths(ingNetoTotal, t.months);
                        const parentTrim = parentRow ? sumMonths(parentRow.monthly, t.months) : 0;
                        const pctTrim = calcPct(r, trimVal, denomTrim, parentTrim);
                        return (
                          <>
                            <td style={{ ...valStyle(trimVal, t.tot), fontWeight: 700, fontSize: 12 }}>
                              {isResult ? (trimVal > 0 ? `+${valFmt(trimVal)}` : valFmt(trimVal)) : valFmt(trimVal)}
                            </td>
                            <td style={{ ...valStyle(0, t.tot, true), color: pctTrim.color || 'var(--rf-text-muted)', fontWeight: 500 }}>{pctTrim.txt}</td>
                          </>
                        );
                      })()}
                    </React.Fragment>
                  );
                })}
                <td style={yearStyle}>{isResult ? (yearVal > 0 ? `+${valFmt(yearVal)}` : valFmt(yearVal)) : valFmt(yearVal)}</td>
                <td style={yearPctStyle}>{yearPct.txt}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
