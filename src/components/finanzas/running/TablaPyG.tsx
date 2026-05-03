/**
 * TablaPyG — refactor 3 may 2026 v3
 *
 * Reglas (Rubén):
 * - Recupera paleta de COLORES (CSS vars rf-q1, rf-q2, rf-q3, rf-q4, rf-year-bg, mes actual)
 * - Recupera RESUMEN previo (Ingresos / Gastos / Resultado) arriba de la tabla
 * - Categorías literales de configuracion: usa categorias_maestras
 * - DESPLEGABLES siempre visibles (flecha siempre, aunque no haya subs todavía con datos
 *   muestra "sin datos en el periodo" para que el usuario sepa que están y se rellenarán)
 * - Sub-marcas en canales de ingresos: SIEMPRE expandibles; muestran TODAS las marcas activas,
 *   con datos o "sin datos"
 * - Año "2026" en la celda con altura suficiente
 * - Sin columna "Concepto"
 * - T1/T2/T3/T4
 * - Total gastos + EBITDA al final
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
}

interface Props {
  anio: number;
  gastosAnio: GastoRaw[];
  ingresosAnio: IngresoMensualRaw[];
  facturacionAnio?: FacturacionDiariaRaw[];
  rangos: RangoCategoria[];
}

const TRIM = [
  { label: 'T1', months: [0,1,2], bg: 'var(--rf-q1-bg)', tot: 'var(--rf-q1-tot)', head: 'var(--rf-q1-head)' },
  { label: 'T2', months: [3,4,5], bg: 'var(--rf-q2-bg)', tot: 'var(--rf-q2-tot)', head: 'var(--rf-q2-head)' },
  { label: 'T3', months: [6,7,8], bg: 'var(--rf-q3-bg)', tot: 'var(--rf-q3-tot)', head: 'var(--rf-q3-head)' },
  { label: 'T4', months: [9,10,11], bg: 'var(--rf-q4-bg)', tot: 'var(--rf-q4-tot)', head: 'var(--rf-q4-head)' },
];

const CANALES = [
  { key: 'UE',  label: 'Uber Eats',     canalIM: 'UBER EATS', brutoCol: 'uber_bruto',    marcaCol: 'ue_bruto',  color: '#06C167' },
  { key: 'GL',  label: 'Glovo',         canalIM: 'GLOVO',     brutoCol: 'glovo_bruto',   marcaCol: 'gl_bruto',  color: '#e8f442' },
  { key: 'JE',  label: 'Just Eat',      canalIM: 'JUST EAT',  brutoCol: 'je_bruto',      marcaCol: 'je_bruto',  color: '#f5a623' },
  { key: 'WEB', label: 'Tienda online', canalIM: 'WEB',       brutoCol: 'web_bruto',     marcaCol: 'web_bruto', color: '#8B5CF6' },
  { key: 'DIR', label: 'Venta directa', canalIM: 'DIRECTA',   brutoCol: 'directa_bruto', marcaCol: 'dir_bruto', color: '#06B6D4' },
] as const;

const GRUPOS_GASTO = [
  { key: 'PRODUCTO',     label: 'Producto',     color: '#e89a3c' }, // naranja
  { key: 'EQUIPO',       label: 'Equipo',       color: '#B01D23' }, // rojo
  { key: 'LOCAL',        label: 'Local',        color: '#8b5a9f' }, // morado
  { key: 'CONTROLABLES', label: 'Controlables', color: '#4a90d9' }, // azul
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

type RowKind = 'h1'|'detail'|'subdetail'|'total';
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
  isSinDatos?: boolean;
  colorAccent?: string;
}

export default function TablaPyG({ anio, gastosAnio, ingresosAnio, facturacionAnio = [] }: Props) {
  const [collapsedTrim, setCollapsedTrim] = useState<Set<string>>(new Set());
  // Por defecto: TODOS los grupos colapsados (igual que un PyG)
  const [collapsedRow, setCollapsedRow] = useState<Set<string>>(new Set([
    'ingresos-netos', 'fact-bruta', 'g-PRODUCTO', 'g-EQUIPO', 'g-LOCAL', 'g-CONTROLABLES',
    'in-UE', 'in-GL', 'in-JE', 'in-WEB', 'in-DIR',
    'fb-UE', 'fb-GL', 'fb-JE', 'fb-WEB', 'fb-DIR',
  ]));
  const [catsMaestras, setCatsMaestras] = useState<CategoriaMaestra[]>([]);
  const [marcasActivas, setMarcasActivas] = useState<MarcaItem[]>([]);
  const [facturacionMarcaAnio, setFacturacionMarcaAnio] = useState<FacturacionMarcaRow[]>([]);

  const mesActualIdx = useMemo(() => {
    const hoy = new Date();
    return hoy.getFullYear() === anio ? hoy.getMonth() : -1;
  }, [anio]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [{ data: cats }, { data: mar }, { data: fm }] = await Promise.all([
        supabase.from('categorias_maestras').select('*').eq('activa', true).order('orden_grupo').order('orden_sub'),
        supabase.from('marcas').select('id,nombre').eq('estado', 'activa').order('nombre'),
        supabase.from('v_facturacion_marca')
          .select('marca_id,marca_nombre,fecha,ue_bruto,gl_bruto,je_bruto,web_bruto,dir_bruto')
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
  const toggleRow  = (k: string) => setCollapsedRow(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  // ── Agregaciones ingresos ──
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

  // marca_id → canalKey → arr12
  const brutoPorMarcaCanal = useMemo(() => {
    const m: Record<string, Record<string, number[]>> = {};
    for (const r of facturacionMarcaAnio) {
      if (!r.marca_id) continue;
      const idx = Number(r.fecha.slice(5, 7)) - 1;
      if (idx < 0 || idx > 11) continue;
      m[r.marca_id] = m[r.marca_id] || {};
      for (const c of CANALES) {
        const v = Number((r as any)[c.marcaCol] || 0);
        m[r.marca_id][c.key] = m[r.marca_id][c.key] || arr12();
        m[r.marca_id][c.key][idx] += v;
      }
    }
    return m;
  }, [facturacionMarcaAnio]);

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

  const rows: Row[] = useMemo(() => {
    if (catsMaestras.length === 0) return [];
    const out: Row[] = [];

    // ════ INGRESOS NETOS POR VENTA ════
    out.push({
      key: 'ingresos-netos',
      kind: 'h1',
      label: 'Ingresos netos por venta',
      monthly: ingresos.netoTotal,
      expandable: true,
      pctMode: 'ingresos',
      colorAccent: 'var(--rf-green)',
    });
    for (const c of CANALES) {
      const vals = ingresos.netoPorCanal[c.key] ?? arr12();
      out.push({
        key: `in-${c.key}`,
        kind: 'detail',
        label: c.label,
        parentKey: 'ingresos-netos',
        monthly: vals,
        expandable: true,
        pctMode: 'parent',
        parentForPct: 'ingresos-netos',
        colorAccent: c.color,
      });
      // Sub-marcas: TODAS las activas
      for (const m of marcasActivas) {
        const arr = brutoPorMarcaCanal[m.id]?.[c.key];
        const tieneVals = arr && arr.some(v => v > 0);
        out.push({
          key: `in-${c.key}-${m.id}`,
          kind: 'subdetail',
          label: m.nombre,
          parentKey: `in-${c.key}`,
          monthly: tieneVals ? arr : arr12(),
          italic: true,
          isSinDatos: !tieneVals,
          pctMode: 'parent',
          parentForPct: `in-${c.key}`,
        });
      }
    }

    // ════ FACTURACIÓN BRUTA INFORMATIVA ════
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
      out.push({
        key: `fb-${c.key}`,
        kind: 'detail',
        label: c.label,
        parentKey: 'fact-bruta',
        monthly: vals,
        expandable: true,
        pctMode: 'parent',
        parentForPct: 'fact-bruta',
        italic: true,
        isInfoOnly: true,
        colorAccent: c.color,
      });
      for (const m of marcasActivas) {
        const arr = brutoPorMarcaCanal[m.id]?.[c.key];
        const tieneVals = arr && arr.some(v => v > 0);
        out.push({
          key: `fb-${c.key}-${m.id}`,
          kind: 'subdetail',
          label: m.nombre,
          parentKey: `fb-${c.key}`,
          monthly: tieneVals ? arr : arr12(),
          italic: true,
          isInfoOnly: true,
          isSinDatos: !tieneVals,
          pctMode: 'parent',
          parentForPct: `fb-${c.key}`,
        });
      }
    }

    // ════ GASTOS POR GRUPO ════
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

      const subConBanda = subs.find(s => s.banda_min_pct != null && s.banda_max_pct != null);
      const banda = subConBanda
        ? { min: Number(subConBanda.banda_min_pct), max: Number(subConBanda.banda_max_pct) }
        : null;

      out.push({
        key: `g-${grp.key}`,
        kind: 'h1',
        label: grp.label,
        monthly: grupoMensual,
        expandable: true, // SIEMPRE
        pctMode: banda ? 'banda' : 'ingresos',
        banda,
        colorAccent: grp.color,
      });

      // TODAS las subcategorías, con o sin datos
      for (const s of subs) {
        const vals = gastosPorCodigo[s.codigo];
        const tieneVals = vals && vals.some(v => v > 0);
        out.push({
          key: `s-${s.codigo}`,
          kind: 'detail',
          label: s.nombre,
          parentKey: `g-${grp.key}`,
          monthly: tieneVals ? vals : arr12(),
          isSinDatos: !tieneVals,
          pctMode: 'parent',
          parentForPct: `g-${grp.key}`,
        });
      }
    }

    out.push({
      key: 'total-gastos',
      kind: 'total',
      label: 'Total gastos',
      monthly: totalGastosMensual,
      pctMode: 'ingresos',
      colorAccent: 'var(--rf-red)',
    });

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
  }, [catsMaestras, ingresos, gastosPorCodigo, ingNetoTotal, marcasActivas, brutoPorMarcaCanal]);

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

  // ── Resumen totales para el bloque superior ──
  const totalIngresos = useMemo(() => ingresos.netoTotal.reduce((a,b) => a+b, 0), [ingresos.netoTotal]);
  const totalGastosYr = useMemo(() => {
    const tot = arr12();
    for (const grp of GRUPOS_GASTO) {
      const subs = catsMaestras.filter(c => c.grupo === grp.key);
      for (const s of subs) {
        const vals = gastosPorCodigo[s.codigo];
        if (!vals) continue;
        for (let i = 0; i < 12; i++) tot[i] += vals[i];
      }
    }
    return tot.reduce((a,b) => a+b, 0);
  }, [catsMaestras, gastosPorCodigo]);
  const resultadoYr = totalIngresos - totalGastosYr;

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

  // ── RESUMEN PYG ARRIBA ──
  const cardResumen: React.CSSProperties = {
    background: 'var(--rf-bg-card)',
    border: '1px solid var(--rf-border)',
    borderRadius: 12,
    padding: '16px 20px',
    flex: 1,
  };
  const labelResumen: React.CSSProperties = {
    fontFamily: 'Oswald, sans-serif',
    fontSize: 10,
    letterSpacing: 1.5,
    color: 'var(--rf-text-label)',
    textTransform: 'uppercase',
    marginBottom: 6,
  };
  const numResumen: React.CSSProperties = {
    fontFamily: 'Oswald, sans-serif',
    fontSize: 28,
    fontWeight: 600,
    color: 'var(--rf-text)',
    lineHeight: 1,
  };

  return (
    <div>
      {/* Bloque resumen previo al PyG */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={cardResumen}>
          <div style={labelResumen}>INGRESOS NETOS · {anio}</div>
          <div style={{ ...numResumen, color: 'var(--rf-green)' }}>{valFmt(totalIngresos)}</div>
        </div>
        <div style={cardResumen}>
          <div style={labelResumen}>TOTAL GASTOS · {anio}</div>
          <div style={{ ...numResumen, color: 'var(--rf-orange)' }}>{valFmt(totalGastosYr)}</div>
        </div>
        <div style={cardResumen}>
          <div style={labelResumen}>RESULTADO · {anio}</div>
          <div style={{ ...numResumen, color: resultadoYr >= 0 ? 'var(--rf-green)' : 'var(--rf-red)' }}>
            {resultadoYr >= 0 ? '+' : ''}{valFmt(resultadoYr)}
          </div>
        </div>
      </div>

      {/* TABLA PYG */}
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
                  fontSize: 13,
                  letterSpacing: '0.12em',
                  padding: '12px 8px',
                  width: 120,
                  minWidth: 120,
                  verticalAlign: 'middle',
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
                              <span style={{ position: 'absolute', top: 2, right: 4, color: '#B01D23', fontSize: 8 }}>●</span>
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
                  ? 'var(--rf-red)'
                  : r.isSinDatos ? 'var(--rf-text-muted)'
                  : r.italic ? 'var(--rf-text-muted)'
                  : isH1 ? 'var(--rf-text)'
                  : isDetail ? 'var(--rf-text-2)'
                  : 'var(--rf-text)',
                textAlign: 'left',
                cursor: isExpandable ? 'pointer' : undefined,
                userSelect: isExpandable ? 'none' : undefined,
                background: isTotal ? 'var(--rf-bg-panel)' : 'var(--rf-bg-card)',
                position: 'sticky',
                left: 0,
                zIndex: 1,
                borderTop: isTotal ? '2px solid var(--rf-border)' : isH1 ? '1px solid var(--rf-border)' : 'none',
                borderRight: '1px solid var(--rf-border)',
                fontStyle: r.italic ? 'italic' : 'normal',
                whiteSpace: 'nowrap',
                opacity: r.isSinDatos ? 0.7 : 1,
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
                padding: isTotal ? '12px 6px' : isSub ? '6px 6px' : isDetail ? '8px 6px' : '10px 6px',
                fontFamily: 'Lexend, sans-serif',
                fontSize: isPctCell ? 10 : (isTotal ? 12 : isSub ? 10.5 : 11.5),
                fontWeight: isTotal ? 700 : isH1 ? 600 : 400,
                color: isResult ? (v >= 0 ? 'var(--rf-green)' : 'var(--rf-red)')
                     : r.isSinDatos ? 'var(--rf-text-muted)'
                     : r.colorAccent && isH1 ? r.colorAccent
                     : (isDetail || isSub) ? 'var(--rf-text-2)'
                     : 'var(--rf-text)',
                textAlign: 'right',
                background: bg,
                borderTop: isTotal ? '2px solid var(--rf-border)' : isH1 ? '1px solid var(--rf-border)' : 'none',
                fontStyle: r.italic ? 'italic' : 'normal',
                whiteSpace: 'nowrap',
                opacity: r.isSinDatos ? 0.65 : 1,
              });

              const yearStyle: React.CSSProperties = {
                ...valStyle(yearVal, 'var(--rf-year-bg)'),
                fontSize: isTotal ? 13 : 12,
                fontWeight: 700,
                color: isResult ? (yearVal >= 0 ? 'var(--rf-green)' : 'var(--rf-red)')
                     : r.colorAccent ? r.colorAccent
                     : 'var(--rf-text)',
              };
              const yearPctStyle: React.CSSProperties = {
                padding: isTotal ? '12px 4px' : isSub ? '6px 4px' : isDetail ? '8px 4px' : '10px 4px',
                fontFamily: 'Lexend, sans-serif',
                fontSize: 10,
                fontWeight: 500,
                color: yearPct.color || 'var(--rf-red)',
                textAlign: 'right',
                background: 'var(--rf-year-bg)',
                borderTop: isTotal ? '2px solid var(--rf-border)' : isH1 ? '1px solid var(--rf-border)' : 'none',
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
                    {r.isSinDatos && (
                      <span style={{ marginLeft: 8, fontSize: 9, color: 'var(--rf-text-muted)', fontStyle: 'italic', fontWeight: 400 }}>
                        sin datos en el periodo
                      </span>
                    )}
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
                              <td style={{ ...valStyle(trimVal, t.tot), fontWeight: 700, fontSize: isSub ? 11 : 12 }}>
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
    </div>
  );
}
