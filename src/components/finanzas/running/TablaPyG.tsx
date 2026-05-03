import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MESES_CORTO } from '@/lib/running';
import type { GastoRaw, IngresoMensualRaw, FacturacionDiariaRaw, RangoCategoria } from '@/hooks/useRunning';

// ════════════════════════════════════════════════════════
// PLAN CONTABLE REAL — categorias_maestras
// ════════════════════════════════════════════════════════
interface CategoriaMaestra {
  codigo: string;
  nombre: string;
  grupo: string;
  orden_grupo: number;
  orden_sub: number;
  signo: string;
  banda_min_pct: number | null;
  banda_max_pct: number | null;
}

interface MarcaItem { id: string; nombre: string }

interface Props {
  anio: number;
  gastosAnio: GastoRaw[];                    // tiene `categoria` que es el código (PRD-MP, EQP-NOM, etc.)
  ingresosAnio: IngresoMensualRaw[];          // canal: 'UBER EATS' | 'GLOVO' | 'JUST EAT' | 'DIRECTA'
  facturacionAnio?: FacturacionDiariaRaw[];   // facturación bruta por canal
  rangos: RangoCategoria[];                   // legacy, no se usa
}

const TRIM = [
  { label: 'T1', months: [0,1,2], bg: 'var(--rf-q1-bg)', tot: 'var(--rf-q1-tot)', head: 'var(--rf-q1-head)' },
  { label: 'T2', months: [3,4,5], bg: 'var(--rf-q2-bg)', tot: 'var(--rf-q2-tot)', head: 'var(--rf-q2-head)' },
  { label: 'T3', months: [6,7,8], bg: 'var(--rf-q3-bg)', tot: 'var(--rf-q3-tot)', head: 'var(--rf-q3-head)' },
  { label: 'T4', months: [9,10,11], bg: 'var(--rf-q4-bg)', tot: 'var(--rf-q4-tot)', head: 'var(--rf-q4-head)' },
];

const arr12 = (): number[] => [0,0,0,0,0,0,0,0,0,0,0,0];
const sumMonths = (arr: number[], months: number[]) => months.reduce((a, m) => a + (arr[m] || 0), 0);

function valFmt(v: number): string {
  if (!v) return '—';
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

// Mapeo canal IngresosMensuales → label visual + key facturacion_diario
const CANALES_ORDEN: { key: string; label: string; canalIM: string; brutoCol: keyof FacturacionDiariaRaw }[] = [
  { key: 'UE',  label: 'Uber Eats',   canalIM: 'UBER EATS', brutoCol: 'uber_bruto' },
  { key: 'GL',  label: 'Glovo',       canalIM: 'GLOVO',     brutoCol: 'glovo_bruto' },
  { key: 'JE',  label: 'Just Eat',    canalIM: 'JUST EAT',  brutoCol: 'je_bruto' },
  { key: 'WEB', label: 'Tienda online', canalIM: 'WEB',     brutoCol: 'web_bruto' },
  { key: 'DIR', label: 'Venta directa', canalIM: 'DIRECTA', brutoCol: 'directa_bruto' },
];

// Tipo fila
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
  isInfoOnly?: boolean; // facturación bruta no suma a gastos/EBITDA
  canalKey?: string;     // marca esta fila como canal (para sub-marcas)
  isResult?: boolean;
  colorAccent?: string;
}

export default function TablaPyG({ anio, gastosAnio, ingresosAnio, facturacionAnio = [] }: Props) {
  const [collapsedTrim, setCollapsedTrim] = useState<Set<string>>(new Set());
  const [collapsedRow, setCollapsedRow] = useState<Set<string>>(new Set());
  const [canalesExpanded, setCanalesExpanded] = useState<Set<string>>(new Set());
  const [catsMaestras, setCatsMaestras] = useState<CategoriaMaestra[]>([]);
  const [marcasActivas, setMarcasActivas] = useState<MarcaItem[]>([]);

  // Mes actual destacado solo si la tabla muestra el año en curso
  const mesActualIdx = useMemo(() => {
    const hoy = new Date();
    return hoy.getFullYear() === anio ? hoy.getMonth() : -1;
  }, [anio]);

  // Cargar plan contable y marcas activas (verdad)
  useEffect(() => {
    let cancel = false;
    (async () => {
      const [{ data: cats }, { data: mar }] = await Promise.all([
        supabase.from('categorias_maestras').select('*').eq('activa', true).order('orden_grupo').order('orden_sub'),
        supabase.from('marcas').select('id,nombre').eq('estado', 'activa').order('nombre'),
      ]);
      if (cancel) return;
      setCatsMaestras((cats ?? []) as CategoriaMaestra[]);
      setMarcasActivas((mar ?? []) as MarcaItem[]);
    })();
    return () => { cancel = true; };
  }, []);

  const toggleTrim = (t: string) => setCollapsedTrim(p => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; });
  const toggleRow = (k: string) => setCollapsedRow(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleCanal = (k: string) => setCanalesExpanded(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  // Agregaciones por canal y mes
  const ingresos = useMemo(() => {
    const netoPorCanal: Record<string, number[]> = {};
    const netoTotal = arr12();
    const brutoPorCanal: Record<string, number[]> = {};
    const brutoTotal = arr12();

    // Netos desde ingresos_mensuales (canal IM en MAYÚSCULAS)
    for (const r of ingresosAnio) {
      if (r.tipo !== 'neto') continue;
      const idx = r.mes - 1;
      if (idx < 0 || idx > 11) continue;
      const canalCfg = CANALES_ORDEN.find(c => c.canalIM === r.canal);
      const k = canalCfg?.key ?? r.canal;
      netoPorCanal[k] = netoPorCanal[k] || arr12();
      netoPorCanal[k][idx] += Number(r.importe || 0);
      netoTotal[idx] += Number(r.importe || 0);
    }
    // Brutos desde facturacion_diario (columnas separadas)
    for (const f of facturacionAnio) {
      const m = Number(f.fecha.slice(5, 7)) - 1;
      if (m < 0 || m > 11) continue;
      for (const c of CANALES_ORDEN) {
        const v = Number((f as any)[c.brutoCol] || 0);
        if (!v) continue;
        brutoPorCanal[c.key] = brutoPorCanal[c.key] || arr12();
        brutoPorCanal[c.key][m] += v;
        brutoTotal[m] += v;
      }
    }
    return { netoPorCanal, netoTotal, brutoPorCanal, brutoTotal };
  }, [ingresosAnio, facturacionAnio]);

  // Agregaciones por código de categoria_maestra (gastos.categoria es el código)
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

  // Construcción de filas según orden_grupo / orden_sub
  const rows: Row[] = useMemo(() => {
    if (catsMaestras.length === 0) return [];

    const out: Row[] = [];

    // ════ INGRESOS ════
    // h1 Ingresos netos
    out.push({
      key: 'ingresos-netos',
      kind: 'h1',
      label: 'Ingresos netos',
      monthly: ingresos.netoTotal,
      expandable: true,
      pctMode: 'ingresos',
      colorAccent: 'var(--rf-green)',
    });
    for (const c of CANALES_ORDEN) {
      const vals = ingresos.netoPorCanal[c.key] ?? arr12();
      out.push({
        key: `in-${c.key}`,
        kind: 'detail',
        label: c.label,
        parentKey: 'ingresos-netos',
        monthly: vals,
        expandable: true, // expandible para sub-marcas placeholder
        canalKey: c.key,
        pctMode: 'parent',
        parentForPct: 'ingresos-netos',
      });
    }

    // h1 Facturación bruta (informativa, no se incluye en cálculo gastos/ebitda)
    out.push({
      key: 'fact-bruta',
      kind: 'h1',
      label: 'Facturación bruta (informativa)',
      monthly: ingresos.brutoTotal,
      expandable: true,
      pctMode: null,
      isInfoOnly: true,
      italic: true,
    });
    for (const c of CANALES_ORDEN) {
      const vals = ingresos.brutoPorCanal[c.key] ?? arr12();
      out.push({
        key: `fb-${c.key}`,
        kind: 'detail',
        label: c.label,
        parentKey: 'fact-bruta',
        monthly: vals,
        expandable: true,
        canalKey: c.key,
        pctMode: 'parent',
        parentForPct: 'fact-bruta',
        italic: true,
        isInfoOnly: true,
      });
    }

    // ════ GASTOS por grupo (PRODUCTO, EQUIPO, LOCAL, CONTROLABLES) ════
    const gruposGasto = ['PRODUCTO', 'EQUIPO', 'LOCAL', 'CONTROLABLES'];
    const grupoLabel: Record<string, string> = {
      PRODUCTO:     'Producto',
      EQUIPO:       'Equipo',
      LOCAL:        'Local',
      CONTROLABLES: 'Controlables',
    };
    const grupoColor: Record<string, string> = {
      PRODUCTO:     '#e89a3c',
      EQUIPO:       '#B01D23',
      LOCAL:        '#8b5a9f',
      CONTROLABLES: '#4a90d9',
    };

    const totalGastosMensual = arr12();

    for (const grupo of gruposGasto) {
      const subs = catsMaestras.filter(c => c.grupo === grupo);
      if (subs.length === 0) continue;

      // Sumar valores del grupo
      const grupoMensual = arr12();
      for (const s of subs) {
        const vals = gastosPorCodigo[s.codigo];
        if (!vals) continue;
        for (let i = 0; i < 12; i++) grupoMensual[i] += vals[i];
      }
      for (let i = 0; i < 12; i++) totalGastosMensual[i] += grupoMensual[i];

      // ¿Tiene banda? → tomar de la subcategoría con banda
      const subConBanda = subs.find(s => s.banda_min_pct != null && s.banda_max_pct != null);
      const banda = subConBanda
        ? { min: Number(subConBanda.banda_min_pct), max: Number(subConBanda.banda_max_pct) }
        : null;

      // Solo expandible si tiene subcategorías con datos (>0 al menos en alguna)
      const subsConDatos = subs.filter(s => gastosPorCodigo[s.codigo] && gastosPorCodigo[s.codigo].some(v => v > 0));
      const expandable = subsConDatos.length > 0;

      out.push({
        key: `g-${grupo}`,
        kind: 'h1',
        label: grupoLabel[grupo],
        monthly: grupoMensual,
        expandable,
        pctMode: banda ? 'banda' : 'ingresos',
        banda,
        colorAccent: grupoColor[grupo],
      });

      for (const s of subs) {
        const vals = gastosPorCodigo[s.codigo];
        if (!vals || !vals.some(v => v > 0)) continue; // sin datos → no mostrar fila vacía
        out.push({
          key: `s-${s.codigo}`,
          kind: 'detail',
          label: s.nombre,
          parentKey: `g-${grupo}`,
          monthly: vals,
          pctMode: 'parent',
          parentForPct: `g-${grupo}`,
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
      colorAccent: 'var(--rf-red)',
    });

    // ════ EBITDA = Ingresos netos − Total gastos ════
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
  }, [catsMaestras, ingresos, gastosPorCodigo, ingNetoTotal]);

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

  // Estilos
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

  // Render
  if (catsMaestras.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--rf-text-muted)', fontFamily: 'Lexend, sans-serif', fontSize: 12 }}>
        Cargando plan contable…
      </div>
    );
  }

  // Cálculo de cuántas columnas habrá según trimestres expandidos
  const colCount = TRIM.reduce((s, t) => s + (collapsedTrim.has(t.label) ? 2 : (t.months.length * 2) + 2), 0) + 2;
  // (sin la columna "Concepto" como header textual: se sustituye por columna sticky vacía)

  // Helper: cálculo de % para una celda
  function calcPct(r: Row, valor: number, denomMes: number, parentValMes: number): { txt: string; color?: string } {
    if (!r.pctMode || !valor) return { txt: '' };
    if (r.pctMode === 'ingresos') {
      return { txt: pctFmt(valor, denomMes), color: 'var(--rf-text-muted)' };
    }
    if (r.pctMode === 'parent') {
      return { txt: pctFmt(valor, parentValMes), color: 'var(--rf-text-muted)' };
    }
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
      maxHeight: '72vh',
      overflowY: 'auto',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
        <thead>
          {/* Fila 1: trimestres */}
          <tr style={{ position: 'sticky', top: 0, zIndex: 6, background: 'var(--rf-bg-card)' }}>
            <th style={{ ...thBase, textAlign: 'left', paddingLeft: 18, minWidth: 240, position: 'sticky', left: 0, background: 'var(--rf-bg-card)', zIndex: 7, borderRight: '1px solid var(--rf-border)' }} rowSpan={2}>
              {/* sin texto - Rubén pidió quitar "Concepto" */}
            </th>
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
                  title={isColTrim ? 'Expandir trimestre' : 'Colapsar trimestre'}
                >
                  {isColTrim ? '▶ ' : '▼ '}{t.label}{isMesActualEnTrim ? ' · actual' : ''}
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
                fontSize: 11,
                letterSpacing: '0.15em',
                padding: '8px 6px',
              }}
            >
              {anio}
            </th>
          </tr>
          {/* Fila 2: meses + % por mes/trimestre */}
          <tr style={{ position: 'sticky', top: 30, zIndex: 6, background: 'var(--rf-bg-card)' }}>
            {TRIM.map(t => {
              const isColTrim = collapsedTrim.has(t.label);
              return (
                <React.Fragment key={t.label}>
                  {!isColTrim && t.months.map(m => {
                    const isMesActual = m === mesActualIdx;
                    return (
                      <React.Fragment key={`m-${m}`}>
                        <th style={{
                          ...thBase,
                          background: isMesActual ? 'var(--rf-mes-actual-head)' : t.bg,
                          color: isMesActual ? '#1f3009' : undefined,
                          fontWeight: isMesActual ? 700 : 500,
                          width: 70,
                          minWidth: 70,
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
                          width: 36,
                          minWidth: 36,
                          padding: '8px 4px',
                        }}>%</th>
                      </React.Fragment>
                    );
                  })}
                  <th style={{ ...thBase, background: t.tot, fontWeight: 700, width: 78, minWidth: 78 }}>{t.label}</th>
                  <th style={{ ...thBase, background: t.tot, fontSize: 9, opacity: 0.85, width: 36, minWidth: 36, padding: '8px 4px' }}>%</th>
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
            const isCanalRow = !!r.canalKey;

            const isH1 = r.kind === 'h1';
            const isDetail = r.kind === 'detail';
            const isTotal = r.kind === 'total';
            const isResult = !!r.isResult;

            // Estilos por tipo
            const labelStyle: React.CSSProperties = {
              padding: isTotal ? '12px 6px 12px 18px' : isDetail ? '8px 6px 8px 38px' : '10px 6px 10px 18px',
              fontFamily: isH1 || isTotal ? 'Oswald, sans-serif' : 'Lexend, sans-serif',
              fontWeight: isTotal ? 700 : isH1 ? 600 : 400,
              fontSize: isTotal ? 12 : isH1 ? 12 : 11,
              letterSpacing: isH1 || isTotal ? '0.06em' : 0,
              color: isResult
                ? 'var(--rf-red)'
                : r.italic
                  ? 'var(--rf-text-muted)'
                  : isH1
                    ? 'var(--rf-text)'
                    : isDetail
                      ? 'var(--rf-text-2)'
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
            };

            const onLabelClick = () => {
              if (isCanalRow) toggleCanal(r.key);
              else if (isExpandable) toggleRow(r.key);
            };

            // Total año
            const yearVal = r.monthly.reduce((a, b) => a + b, 0);
            const ingNetoYear = ingNetoTotal.reduce((a, b) => a + b, 0);
            const parentRow = r.parentForPct ? rowMap[r.parentForPct] : undefined;
            const parentYear = parentRow ? parentRow.monthly.reduce((a, b) => a + b, 0) : 0;

            let yearPct: { txt: string; color?: string } = { txt: '' };
            if (r.pctMode === 'ingresos') yearPct = { txt: pctFmt(yearVal, ingNetoYear), color: 'var(--rf-red)' };
            else if (r.pctMode === 'parent') yearPct = { txt: pctFmt(yearVal, parentYear), color: 'var(--rf-red)' };
            else if (r.pctMode === 'banda' && r.banda) {
              const pct = ingNetoYear > 0 ? (Math.abs(yearVal) / Math.abs(ingNetoYear)) * 100 : 0;
              const sem = bandaSemaforo(pct, r.banda.min, r.banda.max);
              yearPct = { txt: `${Math.round(pct)}% ${sem.arrow}`, color: sem.color };
            }

            // Estilos de valor por celda
            const valStyle = (v: number, bg: string, isPctCell = false): React.CSSProperties => ({
              padding: isTotal ? '12px 6px' : isDetail ? '8px 6px' : '10px 6px',
              fontFamily: 'Lexend, sans-serif',
              fontSize: isPctCell ? 10 : (isTotal ? 12 : 11.5),
              fontWeight: isTotal ? 700 : isH1 ? 600 : 400,
              color: isResult
                ? (v >= 0 ? 'var(--rf-green)' : 'var(--rf-red)')
                : r.colorAccent
                  ? r.colorAccent
                  : (isDetail ? 'var(--rf-text-2)' : 'var(--rf-text)'),
              textAlign: 'right',
              background: bg,
              borderTop: isTotal ? '2px solid var(--rf-border)' : isH1 ? '1px solid var(--rf-border)' : 'none',
              fontStyle: r.italic ? 'italic' : 'normal',
              whiteSpace: 'nowrap',
            });

            const yearStyle: React.CSSProperties = {
              ...valStyle(yearVal, 'var(--rf-year-bg)'),
              fontSize: isTotal ? 13 : 12,
              fontWeight: 700,
              color: isResult ? (yearVal >= 0 ? 'var(--rf-green)' : 'var(--rf-red)') : (r.colorAccent || 'var(--rf-text)'),
            };
            const yearPctStyle: React.CSSProperties = {
              padding: isTotal ? '12px 4px' : isDetail ? '8px 4px' : '10px 4px',
              fontFamily: 'Lexend, sans-serif',
              fontSize: 10,
              fontWeight: 500,
              color: yearPct.color || 'var(--rf-red)',
              textAlign: 'right',
              background: 'var(--rf-year-bg)',
              borderTop: isTotal ? '2px solid var(--rf-border)' : isH1 ? '1px solid var(--rf-border)' : 'none',
            };

            // Render fila principal
            const mainRow = (
              <tr key={r.key} onClick={onLabelClick}>
                <td style={labelStyle}>
                  {isExpandable && (
                    <span style={{ display: 'inline-block', width: 10, marginRight: 6, fontSize: 9, color: 'var(--rf-text-muted)' }}>
                      {isCanalRow
                        ? (canalesExpanded.has(r.key) ? '▼' : '▶')
                        : (isCollapsed ? '▶' : '▼')}
                    </span>
                  )}
                  {r.label}
                </td>
                {TRIM.map(t => {
                  const isColTrim = collapsedTrim.has(t.label);
                  return (
                    <React.Fragment key={t.label}>
                      {!isColTrim && t.months.map(m => {
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
                      {/* Total trimestre */}
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

            // Sub-filas placeholder de marcas si es canal expandido
            const subRows: React.ReactNode[] = [];
            if (isCanalRow && canalesExpanded.has(r.key)) {
              subRows.push(
                <tr key={`${r.key}-marcas-placeholder`}>
                  <td colSpan={colCount} style={{
                    padding: '8px 6px 8px 56px',
                    fontFamily: 'Lexend, sans-serif',
                    fontSize: 10.5,
                    color: 'var(--rf-text-muted)',
                    fontStyle: 'italic',
                    background: 'var(--rf-bg-panel)',
                    borderBottom: '1px solid var(--rf-border)',
                  }}>
                    Desglose por marca de {r.label} — {marcasActivas.length} marcas activas. Datos pendientes de asignar marca a cada pedido.
                  </td>
                </tr>
              );
            }

            return <React.Fragment key={r.key}>{mainRow}{subRows}</React.Fragment>;
          })}
        </tbody>
      </table>
    </div>
  );
}
