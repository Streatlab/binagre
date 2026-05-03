/**
 * TablaPyG — refactor 3 may 2026 v4
 *
 * Cambios respecto v3 (Rubén):
 * - Paleta trimestres más contrastada (no la pastel apagada). Verde, azul, ámbar, púrpura más vivos.
 * - Separador de miles + 2 decimales en todas las cifras (toLocaleString es-ES).
 * - Fila RESUMEN al inicio con DESGLOSE POR GRUPO (Producto, Equipo, Local, Controlables) + Bruto + Neto + EBITDA, NO un único total plano.
 * - Grupos Producto / Equipo / Local / Controlables = DESPLEGABLES de verdad. Al click se abre/cierra.
 *   Al expandir aparecen las subcategorías con código + nombre tal cual están en categorias_maestras
 *   (ej: "PRD-MP · Materia prima", "EQP-NOM · Sueldos empleados nómina").
 * - Etiquetas de grupo TAL CUAL las muestra Configuración → Bancos y cuentas → Categorías:
 *     PRODUCTO → Producto (COGS), EQUIPO → Equipo (Labor), LOCAL → Local (Occupancy), CONTROLABLES → Controlables (OPEX).
 * - Eliminado Total gastos + EBITDA del FINAL (solo viven en la fila RESUMEN de arriba).
 * - "Facturación neta · estimada" coherente con módulo Facturación.
 * - Neto = bruto * (1 - comisión) por canal mientras no haya facturas reales.
 *   ⚠️ AUTOMÁTICO: si en el futuro resumenes_plataforma_marca_mensual se rellena con neto_real_cobrado,
 *   este componente debe leer de ahí sin que Rubén pida nada.
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

// Paleta trimestres CONTRASTADA (no la pastel apagada anterior).
const TRIM = [
  { label: 'T1', months: [0,1,2],  bg: '#dde8f4', tot: '#b5cae3', head: '#7da3c8' },
  { label: 'T2', months: [3,4,5],  bg: '#dee9d4', tot: '#b6cea3', head: '#7da569' },
  { label: 'T3', months: [6,7,8],  bg: '#f4e8c8', tot: '#e8cf85', head: '#c89945' },
  { label: 'T4', months: [9,10,11],bg: '#e3d8eb', tot: '#bfa6cf', head: '#7e5c9b' },
];
const YEAR_BG   = '#fbe5e8';
const YEAR_HEAD = '#f0b8be';
const MES_ACTUAL_BG   = '#cfe6b8';
const MES_ACTUAL_HEAD = '#92bd64';

const CANALES = [
  { key: 'UE',  label: 'Uber Eats',     brutoCol: 'uber_bruto',    comision: 0.30 },
  { key: 'GL',  label: 'Glovo',         brutoCol: 'glovo_bruto',   comision: 0.32 },
  { key: 'JE',  label: 'Just Eat',      brutoCol: 'je_bruto',      comision: 0.28 },
  { key: 'WEB', label: 'Tienda online', brutoCol: 'web_bruto',     comision: 0.05 },
  { key: 'DIR', label: 'Venta directa', brutoCol: 'directa_bruto', comision: 0.0  },
] as const;

// Etiquetas EXACTAS de Configuración → Categorías
const GRUPOS_GASTO = [
  { key: 'PRODUCTO',     label: 'Producto (COGS)',     color: '#7B4F2A' },
  { key: 'EQUIPO',       label: 'Equipo (Labor)',      color: '#4A5980' },
  { key: 'LOCAL',        label: 'Local (Occupancy)',   color: '#5A8A6F' },
  { key: 'CONTROLABLES', label: 'Controlables (OPEX)', color: '#A87C3D' },
] as const;

const arr12 = (): number[] => [0,0,0,0,0,0,0,0,0,0,0,0];
const sumMonths = (arr: number[], months: number[]) => months.reduce((a, m) => a + (arr[m] || 0), 0);

// Separador miles + 2 decimales (es-ES)
function valFmt(v: number): string {
  if (!v || isNaN(v)) return '—';
  const abs = Math.abs(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `−${abs}` : abs;
}

function pctFmt(num: number, denom: number): string {
  if (!denom || !num) return '';
  const p = (Math.abs(num) / Math.abs(denom)) * 100;
  if (p < 1) return '<1%';
  return `${Math.round(p)}%`;
}

function bandaSemaforo(pctReal: number, min: number, max: number): { color: string; arrow: string } {
  if (pctReal === 0) return { color: '#9da4b3', arrow: '' };
  if (pctReal >= min && pctReal <= max) return { color: '#1D9E75', arrow: '●' };
  if (pctReal < min) {
    const pp = Math.round(min - pctReal);
    return { color: pp <= 1 ? '#f5a623' : '#A32D2D', arrow: `▾${pp}` };
  }
  const pp = Math.round(pctReal - max);
  return { color: pp <= 1 ? '#f5a623' : '#A32D2D', arrow: `▴${pp}` };
}

type RowKind = 'h0'|'h1'|'detail'|'total';
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
  isResult?: boolean;
  colorAccent?: string;
  bgRow?: string;
  isResumen?: boolean;
  bandaPct?: number | null;
}

export default function TablaPyG({ anio, gastosAnio, ingresosAnio, facturacionAnio = [] }: Props) {
  void ingresosAnio;
  const [collapsedTrim, setCollapsedTrim] = useState<Set<string>>(new Set());
  // Por defecto los grupos h1 (PRODUCTO/EQUIPO/LOCAL/CONTROLABLES) arrancan COLAPSADOS
  const [collapsedRow, setCollapsedRow] = useState<Set<string>>(() =>
    new Set(['g-PRODUCTO', 'g-EQUIPO', 'g-LOCAL', 'g-CONTROLABLES', 'fact-bruta'])
  );
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

    // Pre-calcular grupo mensual para resumen
    const grupoMensualMap: Record<string, number[]> = {};
    const totalGastos = arr12();
    for (const grp of GRUPOS_GASTO) {
      const subs = catsMaestras.filter(c => c.grupo === grp.key);
      const grupoMensual = arr12();
      for (const s of subs) {
        const vals = gastosPorCodigo[s.codigo];
        if (!vals) continue;
        for (let i = 0; i < 12; i++) grupoMensual[i] += vals[i];
      }
      grupoMensualMap[grp.key] = grupoMensual;
      for (let i = 0; i < 12; i++) totalGastos[i] += grupoMensual[i];
    }
    const ebitda = arr12();
    for (let i = 0; i < 12; i++) ebitda[i] = ingNetoTotal[i] - totalGastos[i];

    // ════ RESUMEN ARRIBA (estilo Excel Rubén): Bruto, Neto, GASTOS POR GRUPO desglosados, EBITDA ════
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
      colorAccent: '#1D9E75',
    });
    // Una fila por grupo (Producto/Equipo/Local/Controlables) con su % sobre ingresos netos
    for (const grp of GRUPOS_GASTO) {
      const subConBanda = catsMaestras.find(c => c.grupo === grp.key && c.banda_min_pct != null);
      const banda = subConBanda
        ? { min: Number(subConBanda.banda_min_pct), max: Number(subConBanda.banda_max_pct) }
        : null;
      out.push({
        key: `res-${grp.key}`,
        kind: 'h0',
        label: grp.label,
        monthly: grupoMensualMap[grp.key],
        pctMode: banda ? 'banda' : 'ingresos',
        banda,
        isResumen: true,
        colorAccent: grp.color,
      });
    }
    out.push({
      key: 'res-ebitda',
      kind: 'h0',
      label: 'EBITDA',
      monthly: ebitda,
      pctMode: 'ingresos',
      isResumen: true,
      isResult: true,
    });

    // ════ INGRESOS netos por canal — desplegable ════
    out.push({
      key: 'ingresos-netos',
      kind: 'h1',
      label: 'Facturación neta · estimada',
      monthly: ingNetoTotal,
      expandable: true,
      pctMode: 'ingresos',
      colorAccent: '#1D9E75',
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

    // ════ Facturación bruta — desplegable, informativa ════
    if (ingresos.brutoTotal.some(v => v > 0)) {
      out.push({
        key: 'fact-bruta',
        kind: 'h1',
        label: 'Facturación bruta · informativa',
        monthly: ingresos.brutoTotal,
        expandable: true,
        pctMode: null,
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
        });
      }
    }

    // ════ GASTOS por grupo — DESPLEGABLES (el grupo siempre se muestra; flecha SIEMPRE) ════
    for (const grp of GRUPOS_GASTO) {
      const subs = catsMaestras.filter(c => c.grupo === grp.key);
      if (subs.length === 0) continue;
      const subConBanda = subs.find(s => s.banda_min_pct != null && s.banda_max_pct != null);
      const banda = subConBanda
        ? { min: Number(subConBanda.banda_min_pct), max: Number(subConBanda.banda_max_pct) }
        : null;

      out.push({
        key: `g-${grp.key}`,
        kind: 'h1',
        label: grp.label,
        monthly: grupoMensualMap[grp.key],
        expandable: true,
        pctMode: banda ? 'banda' : 'ingresos',
        banda,
        colorAccent: grp.color,
      });
      // Mostrar TODAS las subcategorías del grupo, no solo las que tienen datos.
      // Así Rubén ve la lista completa con sus códigos y nombres exactos.
      for (const s of subs) {
        const vals = gastosPorCodigo[s.codigo] ?? arr12();
        const subBanda = (s.banda_min_pct != null && s.banda_max_pct != null)
          ? { min: Number(s.banda_min_pct), max: Number(s.banda_max_pct) }
          : null;
        out.push({
          key: `s-${s.codigo}`,
          kind: 'detail',
          label: `${s.codigo} · ${s.nombre}`,
          parentKey: `g-${grp.key}`,
          monthly: vals,
          pctMode: subBanda ? 'banda' : 'parent',
          parentForPct: `g-${grp.key}`,
          banda: subBanda,
        });
      }
    }

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
    color: '#7a8090',
    padding: '8px 6px',
    textAlign: 'right',
    borderBottom: '1px solid #ebe8e2',
    textTransform: 'uppercase',
  };

  if (catsMaestras.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#7a8090', fontFamily: 'Lexend, sans-serif', fontSize: 12 }}>
        Cargando plan contable…
      </div>
    );
  }

  function calcPct(r: Row, valor: number, denomMes: number, parentValMes: number): { txt: string; color?: string } {
    if (!r.pctMode || !valor) return { txt: '' };
    if (r.pctMode === 'ingresos') return { txt: pctFmt(valor, denomMes), color: '#7a8090' };
    if (r.pctMode === 'parent')   return { txt: pctFmt(valor, parentValMes), color: '#7a8090' };
    if (r.pctMode === 'banda' && r.banda) {
      const denom = denomMes;
      if (denom <= 0) return { txt: '', color: '#7a8090' };
      const pct = (Math.abs(valor) / Math.abs(denom)) * 100;
      const sem = bandaSemaforo(pct, r.banda.min, r.banda.max);
      return { txt: `${Math.round(pct)}% ${sem.arrow}`, color: sem.color };
    }
    return { txt: '' };
  }

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: 12,
      border: '1px solid #ebe8e2',
      overflowX: 'auto',
      maxHeight: '74vh',
      overflowY: 'auto',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
        <thead>
          <tr style={{ position: 'sticky', top: 0, zIndex: 6, background: '#ffffff' }}>
            <th style={{
              ...thBase, textAlign: 'left', paddingLeft: 18, minWidth: 240,
              position: 'sticky', left: 0, background: '#ffffff', zIndex: 7,
              borderRight: '1px solid #ebe8e2',
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
                    color: '#ffffff',
                    fontWeight: 700,
                    textAlign: 'center',
                    borderLeft: '1px solid #ebe8e2',
                    fontSize: 11,
                    letterSpacing: '0.18em',
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
                background: YEAR_HEAD,
                color: '#7a1218',
                fontWeight: 800,
                textAlign: 'center',
                borderLeft: '1px solid #ebe8e2',
                fontSize: 12,
                letterSpacing: '0.18em',
                padding: '8px 6px',
                width: 110,
                minWidth: 110,
              }}
            >
              {anio}
            </th>
          </tr>
          <tr style={{ position: 'sticky', top: 30, zIndex: 6, background: '#ffffff' }}>
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
                          background: isMesActual ? MES_ACTUAL_HEAD : t.bg,
                          color: isMesActual ? '#1f3009' : undefined,
                          fontWeight: isMesActual ? 700 : 500,
                          width: 64,
                          minWidth: 64,
                          position: 'relative',
                        }}>
                          {MESES_CORTO[m]}
                          {isMesActual && (
                            <span style={{ position: 'absolute', top: 2, right: 4, color: '#7a1218', fontSize: 8 }}>●</span>
                          )}
                        </th>
                        <th style={{
                          ...thBase,
                          background: isMesActual ? MES_ACTUAL_HEAD : t.bg,
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
                ? '#B01D23'
                : r.italic
                  ? '#7a8090'
                  : (isH0 || isH1)
                    ? (r.colorAccent ?? '#111111')
                    : isDetail
                      ? '#3a4050'
                      : '#111111',
              textAlign: 'left',
              cursor: isExpandable ? 'pointer' : undefined,
              userSelect: isExpandable ? 'none' : undefined,
              background: isResumen ? '#faf8f4' : (isTotal ? '#faf8f4' : '#ffffff'),
              position: 'sticky',
              left: 0,
              zIndex: 1,
              borderTop: isTotal ? '2px solid #ebe8e2' : (isH1 || isH0) ? '1px solid #ebe8e2' : 'none',
              borderRight: '1px solid #ebe8e2',
              fontStyle: r.italic ? 'italic' : 'normal',
              whiteSpace: 'nowrap',
            };

            const onLabelClick = () => { if (isExpandable) toggleRow(r.key); };

            const yearVal = r.monthly.reduce((a, b) => a + b, 0);
            const ingNetoYear = ingNetoTotal.reduce((a, b) => a + b, 0);
            const parentRow = r.parentForPct ? rowMap[r.parentForPct] : undefined;
            const parentYear = parentRow ? parentRow.monthly.reduce((a, b) => a + b, 0) : 0;

            let yearPct: { txt: string; color?: string } = { txt: '' };
            if (r.pctMode === 'ingresos')      yearPct = { txt: pctFmt(yearVal, ingNetoYear), color: '#B01D23' };
            else if (r.pctMode === 'parent')   yearPct = { txt: pctFmt(yearVal, parentYear), color: '#B01D23' };
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
                ? (v >= 0 ? '#1D9E75' : '#B01D23')
                : r.colorAccent
                  ? r.colorAccent
                  : (isDetail ? '#3a4050' : '#111111'),
              textAlign: 'right',
              background: isResumen ? '#faf8f4' : bg,
              borderTop: isTotal ? '2px solid #ebe8e2' : (isH1 || isH0) ? '1px solid #ebe8e2' : 'none',
              fontStyle: r.italic ? 'italic' : 'normal',
              whiteSpace: 'nowrap',
            });

            const yearStyle: React.CSSProperties = {
              ...valStyle(yearVal, YEAR_BG),
              fontSize: isTotal ? 13 : 12,
              fontWeight: 700,
              color: isResult ? (yearVal >= 0 ? '#1D9E75' : '#B01D23') : (r.colorAccent || '#111111'),
              background: YEAR_BG,
            };
            const yearPctStyle: React.CSSProperties = {
              padding: isTotal ? '12px 4px' : isDetail ? '8px 4px' : isH0 ? '8px 4px' : '10px 4px',
              fontFamily: 'Lexend, sans-serif',
              fontSize: 10,
              fontWeight: 500,
              color: yearPct.color || '#B01D23',
              textAlign: 'right',
              background: YEAR_BG,
              borderTop: isTotal ? '2px solid #ebe8e2' : (isH1 || isH0) ? '1px solid #ebe8e2' : 'none',
            };

            return (
              <tr key={r.key} onClick={onLabelClick}>
                <td style={labelStyle}>
                  {isExpandable && (
                    <span style={{ display: 'inline-block', width: 10, marginRight: 6, fontSize: 9, color: '#7a8090' }}>
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
                        const cellBg = isMesActual ? MES_ACTUAL_BG : t.bg;
                        const denomMes = ingNetoTotal[m] || 0;
                        const parentValMes = parentRow ? parentRow.monthly[m] : 0;
                        const pctCell = calcPct(r, v, denomMes, parentValMes);
                        return (
                          <React.Fragment key={m}>
                            <td style={valStyle(v, cellBg)}>
                              {isResult ? (v > 0 ? `+${valFmt(v)}` : valFmt(v)) : valFmt(v)}
                            </td>
                            <td style={{ ...valStyle(0, cellBg, true), color: pctCell.color || '#7a8090', fontWeight: 500 }}>{pctCell.txt}</td>
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
                            <td style={{ ...valStyle(0, t.tot, true), color: pctTrim.color || '#7a8090', fontWeight: 500 }}>{pctTrim.txt}</td>
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
