/**
 * TablaPyG — refactor 3 may 2026 v2
 *
 * Reglas (Rubén):
 * - Sin columna "Concepto" sticky. La 1ª columna sticky lleva el label de fila.
 * - T1/T2/T3/T4 (no Q1/Q2/Q3/Q4)
 * - Año: header "2026" en la celda con la altura justa (sin solapar)
 * - Columna % de cada trimestre y de mes: estrecha (32px)
 * - Plan contable REAL desde categorias_maestras (Producto/Equipo/Local/Controlables)
 * - Subcategorías solo aparecen si hay datos > 0; si no hay subs con datos, sin flecha
 * - Canales orden: Uber Eats, Glovo, Just Eat, Tienda online, Venta directa
 * - Sub-filas de canal con desglose por marca SOLO si hay marca_id en facturacion_diario; si no, sin flecha
 * - Facturación bruta = informativa (italic muted, no suma a EBITDA)
 * - Total gastos al final (sumatorio de Producto+Equipo+Local+Controlables)
 * - EBITDA al final (Ingresos netos − Total gastos)
 * - Sin invenciones: 0 datos = "—". Nada de Emilio plataformas / Complemento SL.
 *
 * Verdad de datos:
 *   ingresos_mensuales  → netos por canal (UBER EATS, GLOVO, JUST EAT, DIRECTA, WEB)
 *   facturacion_diario  → bruto por canal (uber_bruto, glovo_bruto, je_bruto, web_bruto, directa_bruto)
 *   gastos.categoria    → código (PRD-MP, EQP-NOM…) que mapea a categorias_maestras
 *   v_facturacion_marca → desglose bruto por marca y canal cuando exista marca_id
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

interface MarcaItem { id: string; nombre: string }

interface FacturacionMarcaRow {
  marca_id: string | null;
  marca_nombre: string | null;
  fecha: string;
  ue_bruto: number | null;
  gl_bruto: number | null;
  je_bruto: number | null;
  web_bruto: number | null;
  dir_bruto: number | null;
  total_bruto: number | null;
}

interface Props {
  anio: number;
  gastosAnio: GastoRaw[];
  ingresosAnio: IngresoMensualRaw[];
  facturacionAnio?: FacturacionDiariaRaw[];
  rangos: RangoCategoria[];
}

// ── Trimestres ──
const TRIM = [
  { label: 'T1', months: [0,1,2] },
  { label: 'T2', months: [3,4,5] },
  { label: 'T3', months: [6,7,8] },
  { label: 'T4', months: [9,10,11] },
];

// ── Canales fijos ──
const CANALES = [
  { key: 'UE',  label: 'Uber Eats',     canalIM: 'UBER EATS', brutoCol: 'uber_bruto',    marcaCol: 'ue_bruto'  },
  { key: 'GL',  label: 'Glovo',         canalIM: 'GLOVO',     brutoCol: 'glovo_bruto',   marcaCol: 'gl_bruto'  },
  { key: 'JE',  label: 'Just Eat',      canalIM: 'JUST EAT',  brutoCol: 'je_bruto',      marcaCol: 'je_bruto'  },
  { key: 'WEB', label: 'Tienda online', canalIM: 'WEB',       brutoCol: 'web_bruto',     marcaCol: 'web_bruto' },
  { key: 'DIR', label: 'Venta directa', canalIM: 'DIRECTA',   brutoCol: 'directa_bruto', marcaCol: 'dir_bruto' },
] as const;

// Grupos de gasto en orden
const GRUPOS_GASTO = [
  { key: 'PRODUCTO',     label: 'Producto' },
  { key: 'EQUIPO',       label: 'Equipo' },
  { key: 'LOCAL',        label: 'Local' },
  { key: 'CONTROLABLES', label: 'Controlables' },
] as const;

const arr12 = (): number[] => [0,0,0,0,0,0,0,0,0,0,0,0];
const sumMonths = (arr: number[], months: number[]) => months.reduce((a, m) => a + (arr[m] || 0), 0);

// Format número en estilo ES "1.234,56", sin símbolo de euro. — vacío si 0/NaN.
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
  if (pctReal === 0) return { color: '#9da4b3', arrow: '' };
  if (pctReal >= min && pctReal <= max) return { color: '#1D9E75', arrow: '●' };
  if (pctReal < min) {
    const pp = Math.round(min - pctReal);
    return { color: pp <= 1 ? '#f5a623' : '#A32D2D', arrow: `▾${pp}` };
  }
  const pp = Math.round(pctReal - max);
  return { color: pp <= 1 ? '#f5a623' : '#A32D2D', arrow: `▴${pp}` };
}

// ── Tipo fila ──
type RowKind = 'h1'|'h2'|'detail'|'subdetail'|'total';
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
  isCanal?: boolean;
  canalKey?: string;
  isSubmarca?: boolean;
}

export default function TablaPyG({ anio, gastosAnio, ingresosAnio, facturacionAnio = [] }: Props) {
  const [collapsedTrim, setCollapsedTrim] = useState<Set<string>>(new Set());
  const [collapsedRow, setCollapsedRow] = useState<Set<string>>(new Set());
  const [catsMaestras, setCatsMaestras] = useState<CategoriaMaestra[]>([]);
  const [marcasActivas, setMarcasActivas] = useState<MarcaItem[]>([]);
  const [facturacionMarcaAnio, setFacturacionMarcaAnio] = useState<FacturacionMarcaRow[]>([]);

  const mesActualIdx = useMemo(() => {
    const hoy = new Date();
    return hoy.getFullYear() === anio ? hoy.getMonth() : -1;
  }, [anio]);

  // Cargar plan contable, marcas y facturación-por-marca del año
  useEffect(() => {
    let cancel = false;
    (async () => {
      const [{ data: cats }, { data: mar }, { data: fm }] = await Promise.all([
        supabase.from('categorias_maestras').select('*').eq('activa', true).order('orden_grupo').order('orden_sub'),
        supabase.from('marcas').select('id,nombre').eq('estado', 'activa').order('nombre'),
        supabase.from('v_facturacion_marca')
          .select('marca_id,marca_nombre,fecha,ue_bruto,gl_bruto,je_bruto,web_bruto,dir_bruto,total_bruto')
          .gte('fecha', `${anio}-01-01`)
          .lte('fecha', `${anio}-12-31`),
      ]);
      if (cancel) return;
      setCatsMaestras((cats ?? []) as CategoriaMaestra[]);
      setMarcasActivas((mar ?? []) as MarcaItem[]);
      setFacturacionMarcaAnio((fm ?? []) as FacturacionMarcaRow[]);
    })();
    return () => { cancel = true; };
  }, [anio]);

  const toggleTrim = (t: string) => setCollapsedTrim(p => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; });
  const toggleRow = (k: string) => setCollapsedRow(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  // ── Agregaciones de ingresos ──
  const ingresos = useMemo(() => {
    const netoPorCanal: Record<string, number[]> = {};
    const netoTotal = arr12();
    const brutoPorCanal: Record<string, number[]> = {};
    const brutoTotal = arr12();

    for (const r of ingresosAnio) {
      if (r.tipo !== 'neto') continue;
      const idx = r.mes - 1;
      if (idx < 0 || idx > 11) continue;
      const c = CANALES.find(cc => cc.canalIM === r.canal);
      const k = c?.key ?? r.canal;
      netoPorCanal[k] = netoPorCanal[k] || arr12();
      netoPorCanal[k][idx] += Number(r.importe || 0);
      netoTotal[idx] += Number(r.importe || 0);
    }
    for (const f of facturacionAnio) {
      const m = Number(f.fecha.slice(5, 7)) - 1;
      if (m < 0 || m > 11) continue;
      for (const c of CANALES) {
        const v = Number((f as any)[c.brutoCol] || 0);
        if (!v) continue;
        brutoPorCanal[c.key] = brutoPorCanal[c.key] || arr12();
        brutoPorCanal[c.key][m] += v;
        brutoTotal[m] += v;
      }
    }
    return { netoPorCanal, netoTotal, brutoPorCanal, brutoTotal };
  }, [ingresosAnio, facturacionAnio]);

  // ── Bruto por marca y canal ──
  const brutoPorMarcaCanal = useMemo(() => {
    // marca_id → canalKey → arr12
    const m: Record<string, Record<string, number[]>> = {};
    for (const r of facturacionMarcaAnio) {
      if (!r.marca_id) continue;
      const idx = Number(r.fecha.slice(5, 7)) - 1;
      if (idx < 0 || idx > 11) continue;
      m[r.marca_id] = m[r.marca_id] || {};
      for (const c of CANALES) {
        const v = Number((r as any)[c.marcaCol] || 0);
        if (!v) continue;
        m[r.marca_id][c.key] = m[r.marca_id][c.key] || arr12();
        m[r.marca_id][c.key][idx] += v;
      }
    }
    return m;
  }, [facturacionMarcaAnio]);

  // Marcas con datos en algún canal
  const marcasConDatos = useMemo(() => {
    const ids = Object.keys(brutoPorMarcaCanal).filter(mid => {
      const canales = brutoPorMarcaCanal[mid];
      return Object.values(canales).some(arr => arr.some(v => v > 0));
    });
    return new Set(ids);
  }, [brutoPorMarcaCanal]);

  // ── Gastos por código ──
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

  const ingNetoTotal = ingresos.netoTotal;

  // ── Construcción de filas ──
  const rows: Row[] = useMemo(() => {
    if (catsMaestras.length === 0) return [];

    const out: Row[] = [];

    // ════ INGRESOS NETOS ════
    out.push({
      key: 'ingresos-netos',
      kind: 'h1',
      label: 'Ingresos netos por venta',
      monthly: ingresos.netoTotal,
      expandable: true,
      pctMode: 'ingresos',
    });
    for (const c of CANALES) {
      const vals = ingresos.netoPorCanal[c.key] ?? arr12();
      // Sub-marcas: solo si hay marcas con datos para este canal
      const marcasParaCanal: { marca: MarcaItem; vals: number[] }[] = [];
      for (const m of marcasActivas) {
        if (!marcasConDatos.has(m.id)) continue;
        const arr = brutoPorMarcaCanal[m.id]?.[c.key];
        if (!arr || !arr.some(v => v > 0)) continue;
        // Nota: aquí los valores son BRUTO por marca (no neto). El neto por marca no existe en BD.
        // Lo dejamos como proxy informativo en italic.
        marcasParaCanal.push({ marca: m, vals: arr });
      }
      const expandable = marcasParaCanal.length > 0;
      out.push({
        key: `in-${c.key}`,
        kind: 'detail',
        label: c.label,
        parentKey: 'ingresos-netos',
        monthly: vals,
        expandable,
        isCanal: true,
        canalKey: c.key,
        pctMode: 'parent',
        parentForPct: 'ingresos-netos',
      });
      for (const { marca, vals } of marcasParaCanal) {
        out.push({
          key: `in-${c.key}-${marca.id}`,
          kind: 'subdetail',
          label: marca.nombre,
          parentKey: `in-${c.key}`,
          monthly: vals,
          isSubmarca: true,
          italic: true,
          pctMode: 'parent',
          parentForPct: `in-${c.key}`,
        });
      }
    }

    // ════ FACTURACIÓN BRUTA (informativa) ════
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
      const marcasParaCanal: { marca: MarcaItem; vals: number[] }[] = [];
      for (const m of marcasActivas) {
        if (!marcasConDatos.has(m.id)) continue;
        const arr = brutoPorMarcaCanal[m.id]?.[c.key];
        if (!arr || !arr.some(v => v > 0)) continue;
        marcasParaCanal.push({ marca: m, vals: arr });
      }
      const expandable = marcasParaCanal.length > 0;
      out.push({
        key: `fb-${c.key}`,
        kind: 'detail',
        label: c.label,
        parentKey: 'fact-bruta',
        monthly: vals,
        expandable,
        isCanal: true,
        canalKey: `fb-${c.key}`,
        pctMode: 'parent',
        parentForPct: 'fact-bruta',
        italic: true,
        isInfoOnly: true,
      });
      for (const { marca, vals } of marcasParaCanal) {
        out.push({
          key: `fb-${c.key}-${marca.id}`,
          kind: 'subdetail',
          label: marca.nombre,
          parentKey: `fb-${c.key}`,
          monthly: vals,
          isSubmarca: true,
          italic: true,
          isInfoOnly: true,
          pctMode: 'parent',
          parentForPct: `fb-${c.key}`,
        });
      }
    }

    // ════ GASTOS por grupo ════
    const totalGastosMensual = arr12();

    for (const grp of GRUPOS_GASTO) {
      const subs = catsMaestras.filter(c => c.grupo === grp.key);
      if (subs.length === 0) continue;

      const grupoMensual = arr12();
      for (const s of subs) {
        const vals = gastosPorCodigo[s.codigo];
        if (!vals) continue;
        for (let i = 0; i < 12; i++) grupoMensual[i] += vals[i];
      }
      for (let i = 0; i < 12; i++) totalGastosMensual[i] += grupoMensual[i];

      // Banda → desde la sub con banda definida
      const subConBanda = subs.find(s => s.banda_min_pct != null && s.banda_max_pct != null);
      const banda = subConBanda
        ? { min: Number(subConBanda.banda_min_pct), max: Number(subConBanda.banda_max_pct) }
        : null;

      // Solo expandible si hay subs con datos
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

    // ════ TOTAL GASTOS ════
    out.push({
      key: 'total-gastos',
      kind: 'total',
      label: 'Total gastos',
      monthly: totalGastosMensual,
      pctMode: 'ingresos',
    });

    // ════ EBITDA ════
    const ebitda = arr12();
    for (let i = 0; i < 12; i++) ebitda[i] = ingNetoTotal[i] - totalGastosMensual[i];
    out.push({
      key: 'ebitda',
      kind: 'total',
      label: 'EBITDA',
      monthly: ebitda,
      pctMode: 'ingresos',
      isResult: true,
    });

    return out;
  }, [catsMaestras, ingresos, gastosPorCodigo, ingNetoTotal, marcasActivas, marcasConDatos, brutoPorMarcaCanal]);

  // map clave → row
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

  // ── Estilos compartidos ──
  const C = {
    bg: '#ffffff',
    bgPanel: '#faf8f4',
    border: '#ebe8e2',
    text: '#111111',
    text2: '#3a4050',
    textMut: '#7a8090',
    textLabel: '#7a8090',
    red: '#B01D23',
    green: '#1D9E75',
    redSoft: '#A32D2D',
    headT: '#f7f3ec',
    bgT:   '#fbf9f5',
    totT:  '#f1ece3',
    yearH: '#fcf2ee',
    yearBg:'#fffaf7',
    mesActual: '#f1f5d9',
    mesActualHead: '#e6efb4',
  };

  const thBase: React.CSSProperties = {
    fontFamily: 'Oswald, sans-serif',
    fontSize: 10,
    letterSpacing: '0.1em',
    fontWeight: 500,
    color: C.textLabel,
    padding: '8px 6px',
    textAlign: 'right',
    borderBottom: `1px solid ${C.border}`,
    textTransform: 'uppercase',
  };

  if (catsMaestras.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.textMut, fontFamily: 'Lexend, sans-serif', fontSize: 12 }}>
        Cargando plan contable…
      </div>
    );
  }

  function calcPct(r: Row, valor: number, denomMes: number, parentValMes: number): { txt: string; color?: string } {
    if (!r.pctMode || !valor) return { txt: '' };
    if (r.pctMode === 'ingresos') return { txt: pctFmt(valor, denomMes), color: C.textMut };
    if (r.pctMode === 'parent')   return { txt: pctFmt(valor, parentValMes), color: C.textMut };
    if (r.pctMode === 'banda' && r.banda) {
      const denom = denomMes;
      if (denom <= 0) return { txt: '', color: C.textMut };
      const pct = (Math.abs(valor) / Math.abs(denom)) * 100;
      const sem = bandaSemaforo(pct, r.banda.min, r.banda.max);
      return { txt: `${Math.round(pct)}% ${sem.arrow}`, color: sem.color };
    }
    return { txt: '' };
  }

  return (
    <div style={{
      background: C.bg,
      borderRadius: 12,
      border: `1px solid ${C.border}`,
      overflowX: 'auto',
      maxHeight: '74vh',
      overflowY: 'auto',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
        <thead>
          {/* Fila 1: trimestres + Año */}
          <tr style={{ position: 'sticky', top: 0, zIndex: 6, background: C.bg }}>
            <th style={{
              ...thBase, textAlign: 'left', paddingLeft: 18, minWidth: 230,
              position: 'sticky', left: 0, background: C.bg, zIndex: 7,
              borderRight: `1px solid ${C.border}`,
            }} rowSpan={2}>
              {/* Sin texto. Es la columna sticky de etiquetas. */}
            </th>
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
                    background: C.headT,
                    cursor: 'pointer',
                    color: C.text,
                    fontWeight: 600,
                    textAlign: 'center',
                    borderLeft: `1px solid ${C.border}`,
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
                background: C.yearH,
                color: C.red,
                fontWeight: 700,
                textAlign: 'center',
                borderLeft: `1px solid ${C.border}`,
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
          {/* Fila 2: meses + columnas % */}
          <tr style={{ position: 'sticky', top: 30, zIndex: 6, background: C.bg }}>
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
                          background: isMesActual ? C.mesActualHead : C.bgT,
                          color: isMesActual ? '#1f3009' : undefined,
                          fontWeight: isMesActual ? 700 : 500,
                          width: 64,
                          minWidth: 64,
                          position: 'relative',
                        }}>
                          {MESES_CORTO[m]}
                          {isMesActual && (
                            <span style={{ position: 'absolute', top: 2, right: 4, color: C.red, fontSize: 8 }}>●</span>
                          )}
                        </th>
                        <th style={{
                          ...thBase,
                          background: isMesActual ? C.mesActualHead : C.bgT,
                          fontSize: 9,
                          opacity: 0.75,
                          width: 32,
                          minWidth: 32,
                          padding: '8px 3px',
                        }}>%</th>
                      </React.Fragment>
                    );
                  })}
                  <th style={{ ...thBase, background: C.totT, fontWeight: 700, width: 72, minWidth: 72 }}>{t.label}</th>
                  <th style={{ ...thBase, background: C.totT, fontSize: 9, opacity: 0.85, width: 32, minWidth: 32, padding: '8px 3px' }}>%</th>
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
            const isH1 = r.kind === 'h1';
            const isDetail = r.kind === 'detail';
            const isSub = r.kind === 'subdetail';
            const isTotal = r.kind === 'total';
            const isResult = !!r.isResult;

            const indent = isSub ? 56 : isDetail ? 36 : 18;
            const labelStyle: React.CSSProperties = {
              padding: isTotal ? '12px 6px 12px 18px'
                     : isSub    ? '6px 6px 6px ' + indent + 'px'
                     : isDetail ? '8px 6px 8px ' + indent + 'px'
                     :            '10px 6px 10px ' + indent + 'px',
              fontFamily: isH1 || isTotal ? 'Oswald, sans-serif' : 'Lexend, sans-serif',
              fontWeight: isTotal ? 700 : isH1 ? 600 : 400,
              fontSize: isTotal ? 12 : isH1 ? 12 : isSub ? 10.5 : 11,
              letterSpacing: isH1 || isTotal ? '0.06em' : 0,
              color: isResult
                ? C.red
                : r.italic
                  ? C.textMut
                  : isH1
                    ? C.text
                    : isDetail
                      ? C.text2
                      : C.text,
              textAlign: 'left',
              cursor: isExpandable ? 'pointer' : undefined,
              userSelect: isExpandable ? 'none' : undefined,
              background: isTotal ? C.bgPanel : C.bg,
              position: 'sticky',
              left: 0,
              zIndex: 1,
              borderTop: isTotal ? `2px solid ${C.border}` : isH1 ? `1px solid ${C.border}` : 'none',
              borderRight: `1px solid ${C.border}`,
              fontStyle: r.italic ? 'italic' : 'normal',
              whiteSpace: 'nowrap',
            };

            const onLabelClick = () => { if (isExpandable) toggleRow(r.key); };

            const yearVal = r.monthly.reduce((a, b) => a + b, 0);
            const ingNetoYear = ingNetoTotal.reduce((a, b) => a + b, 0);
            const parentRow = r.parentForPct ? rowMap[r.parentForPct] : undefined;
            const parentYear = parentRow ? parentRow.monthly.reduce((a, b) => a + b, 0) : 0;

            let yearPct: { txt: string; color?: string } = { txt: '' };
            if (r.pctMode === 'ingresos')      yearPct = { txt: pctFmt(yearVal, ingNetoYear), color: C.red };
            else if (r.pctMode === 'parent')   yearPct = { txt: pctFmt(yearVal, parentYear), color: C.red };
            else if (r.pctMode === 'banda' && r.banda) {
              const pct = ingNetoYear > 0 ? (Math.abs(yearVal) / Math.abs(ingNetoYear)) * 100 : 0;
              const sem = bandaSemaforo(pct, r.banda.min, r.banda.max);
              yearPct = { txt: `${Math.round(pct)}% ${sem.arrow}`, color: sem.color };
            }

            const valStyle = (v: number, bg: string, isPctCell = false): React.CSSProperties => ({
              padding: isTotal ? '12px 6px' : isSub ? '6px 6px' : isDetail ? '8px 6px' : '10px 6px',
              fontFamily: 'Lexend, sans-serif',
              fontSize: isPctCell ? 10 : (isTotal ? 12 : isSub ? 10.5 : 11.5),
              fontWeight: isTotal ? 700 : isH1 ? 600 : 400,
              color: isResult ? (v >= 0 ? C.green : C.red)
                   : (isDetail || isSub) ? C.text2 : C.text,
              textAlign: 'right',
              background: bg,
              borderTop: isTotal ? `2px solid ${C.border}` : isH1 ? `1px solid ${C.border}` : 'none',
              fontStyle: r.italic ? 'italic' : 'normal',
              whiteSpace: 'nowrap',
            });

            const yearStyle: React.CSSProperties = {
              ...valStyle(yearVal, C.yearBg),
              fontSize: isTotal ? 12.5 : 11.5,
              fontWeight: 700,
              color: isResult ? (yearVal >= 0 ? C.green : C.red) : C.text,
            };
            const yearPctStyle: React.CSSProperties = {
              padding: isTotal ? '12px 4px' : isSub ? '6px 4px' : isDetail ? '8px 4px' : '10px 4px',
              fontFamily: 'Lexend, sans-serif',
              fontSize: 10,
              fontWeight: 500,
              color: yearPct.color || C.red,
              textAlign: 'right',
              background: C.yearBg,
              borderTop: isTotal ? `2px solid ${C.border}` : isH1 ? `1px solid ${C.border}` : 'none',
            };

            return (
              <tr key={r.key} onClick={onLabelClick}>
                <td style={labelStyle}>
                  {isExpandable && (
                    <span style={{ display: 'inline-block', width: 10, marginRight: 6, fontSize: 9, color: C.textMut }}>
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
                        const cellBg = isMesActual ? C.mesActual : C.bgT;
                        const denomMes = ingNetoTotal[m] || 0;
                        const parentValMes = parentRow ? parentRow.monthly[m] : 0;
                        const pctCell = calcPct(r, v, denomMes, parentValMes);
                        return (
                          <React.Fragment key={m}>
                            <td style={valStyle(v, cellBg)}>
                              {isResult ? (v > 0 ? `+${valFmt(v)}` : valFmt(v)) : valFmt(v)}
                            </td>
                            <td style={{ ...valStyle(0, cellBg, true), color: pctCell.color || C.textMut, fontWeight: 500 }}>{pctCell.txt}</td>
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
                            <td style={{ ...valStyle(trimVal, C.totT), fontWeight: 700, fontSize: isSub ? 11 : 12 }}>
                              {isResult ? (trimVal > 0 ? `+${valFmt(trimVal)}` : valFmt(trimVal)) : valFmt(trimVal)}
                            </td>
                            <td style={{ ...valStyle(0, C.totT, true), color: pctTrim.color || C.textMut, fontWeight: 500 }}>{pctTrim.txt}</td>
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
