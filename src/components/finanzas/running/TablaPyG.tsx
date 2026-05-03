/**
 * TablaPyG — refactor 3 may 2026 v5 (FUENTE DE VERDAD: categorias_pyg + Excel Rubén)
 *
 * Cambios respecto v4 (Rubén):
 * - Categorías y nombres EXACTOS de categorias_pyg (Configuración → Bancos y cuentas → Categorías)
 *   con código tipo 1.1.4, 2.11.1, etc. NO PRD-MP / EQP-NOM que están obsoletos.
 * - Estructura del Excel "Balance 2026":
 *     // RESUMEN //  ← bloque superior con los KPI agregados y % s/Ingresos
 *     // INGRESOS // ← desplegable con 1.1 Netos y 1.2 Bruto
 *     // GASTOS //   ← desplegable con bloques 2.1, 2.2, 2.3, 2.4 (cada uno desplegable a subgrupos 2.11, 2.12 ...)
 * - Bandas % sobre ingresos (del Excel):
 *     2.1 Producto      25-30%
 *     2.2 Equipo (RRHH) 30-35%
 *     2.3 Alquiler      5-8%
 *     2.4 Controlables  15-18%
 * - Mapeo gastos.grupo (legacy) → bloque PyG:
 *     PRODUCTO        → 2.1 Producto
 *     RRHH            → 2.2 Equipo
 *     ALQUILER        → 2.3 Alquiler
 *     MARKETING       → 2.41 Marketing  (dentro de 2.4)
 *     INTERNET_VENTAS → 2.42 Internet y ventas (dentro de 2.4)
 *     ADMIN_GENERALES → 2.43 Administración y generales (dentro de 2.4)
 *     SUMINISTROS     → 2.44 Suministros (dentro de 2.4)
 * - Sin códigos PRD-MP, EQP-NOM, etc. en pantalla. Eliminados.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MESES_CORTO } from '@/lib/running';
import type { GastoRaw, IngresoMensualRaw, FacturacionDiariaRaw, RangoCategoria } from '@/hooks/useRunning';

interface CatPyG {
  id: string;
  nivel: number;
  parent_id: string | null;
  nombre: string;
  bloque: string | null;
  computa_pyg: boolean;
  orden: number | null;
}

interface Props {
  anio: number;
  gastosAnio: GastoRaw[];
  ingresosAnio: IngresoMensualRaw[];
  facturacionAnio?: FacturacionDiariaRaw[];
  rangos: RangoCategoria[];
}

// Trimestres con paleta contrastada
const TRIM = [
  { label: '1T', months: [0,1,2],  bg: '#dde8f4', tot: '#b5cae3', head: '#7da3c8' },
  { label: '2T', months: [3,4,5],  bg: '#dee9d4', tot: '#b6cea3', head: '#7da569' },
  { label: '3T', months: [6,7,8],  bg: '#f4e8c8', tot: '#e8cf85', head: '#c89945' },
  { label: '4T', months: [9,10,11],bg: '#e3d8eb', tot: '#bfa6cf', head: '#7e5c9b' },
];
const YEAR_BG = '#fbe5e8';
const YEAR_HEAD = '#f0b8be';
const MES_ACTUAL_BG = '#cfe6b8';
const MES_ACTUAL_HEAD = '#92bd64';

// Bandas % sobre ingresos por bloque (definidas en el Excel)
const BANDAS_BLOQUE: Record<string, { min: number; max: number }> = {
  '2.1': { min: 25, max: 30 },
  '2.2': { min: 30, max: 35 },
  '2.3': { min: 5,  max: 8  },
  '2.4': { min: 15, max: 18 },
};

// Colores acento por bloque
const COLOR_BLOQUE: Record<string, string> = {
  '2.1': '#7B4F2A', // producto - marrón
  '2.2': '#4A5980', // equipo - azul gris
  '2.3': '#5A8A6F', // alquiler - verde apagado
  '2.4': '#A87C3D', // controlables - mostaza
};

// Mapeo gastos.grupo (legacy) → ID de bloque PyG nivel 1 ó 2
function grupoLegacyToBloquePyG(grupo: string | null | undefined): string | null {
  switch (grupo) {
    case 'PRODUCTO':        return '2.1';
    case 'RRHH':            return '2.2';
    case 'ALQUILER':        return '2.3';
    case 'MARKETING':       return '2.4';   // dentro de Controlables
    case 'INTERNET_VENTAS': return '2.4';
    case 'ADMIN_GENERALES': return '2.4';
    case 'SUMINISTROS':     return '2.4';
    default: return null;
  }
}

// Mapeo gastos.grupo → ID de subgrupo PyG nivel 2 (cuando aplica)
function grupoLegacyToSubgrupoPyG(grupo: string | null | undefined): string | null {
  switch (grupo) {
    case 'MARKETING':       return '2.41';
    case 'INTERNET_VENTAS': return '2.42';
    case 'ADMIN_GENERALES': return '2.43';
    case 'SUMINISTROS':     return '2.44';
    default: return null;
  }
}

// Canales para ingresos
const CANALES = [
  { key: 'UE',  label: 'Uber Eats',     id_neto: '1.1.1', id_bruto: '1.2.1', brutoCol: 'uber_bruto',    comision: 0.30 },
  { key: 'GL',  label: 'Glovo',         id_neto: '1.1.2', id_bruto: '1.2.2', brutoCol: 'glovo_bruto',   comision: 0.32 },
  { key: 'JE',  label: 'Just Eat',      id_neto: '1.1.3', id_bruto: '1.2.3', brutoCol: 'je_bruto',      comision: 0.28 },
  { key: 'WEB', label: 'Tienda online', id_neto: '1.1.4', id_bruto: '1.2.4', brutoCol: 'web_bruto',     comision: 0.05 },
  { key: 'DIR', label: 'Venta directa', id_neto: '1.1.5', id_bruto: '1.2.5', brutoCol: 'directa_bruto', comision: 0.0  },
] as const;

const arr12 = (): number[] => [0,0,0,0,0,0,0,0,0,0,0,0];
const sumMonths = (arr: number[], months: number[]) => months.reduce((a, m) => a + (arr[m] || 0), 0);

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

type RowKind = 'h0' | 'h1' | 'h2' | 'detail' | 'separator';
interface Row {
  key: string;
  kind: RowKind;
  label: string;            // "1.1.4 Venta Tienda online"
  monthly: number[];
  parentKey?: string;
  expandable?: boolean;
  pctMode?: 'ingresos' | 'banda' | 'parent' | null;
  parentForPct?: string;
  banda?: { min: number; max: number } | null;
  italic?: boolean;
  isResult?: boolean;
  colorAccent?: string;
  isResumen?: boolean;
  isSeparator?: boolean;
}

export default function TablaPyG({ anio, gastosAnio, ingresosAnio, facturacionAnio = [] }: Props) {
  void ingresosAnio;
  const [collapsedTrim, setCollapsedTrim] = useState<Set<string>>(new Set());
  const [collapsedRow, setCollapsedRow] = useState<Set<string>>(() =>
    new Set(['blk-1', 'blk-2.1', 'blk-2.2', 'blk-2.3', 'blk-2.4', 'sub-1.2'])
  );
  const [cats, setCats] = useState<CatPyG[]>([]);

  const mesActualIdx = useMemo(() => {
    const hoy = new Date();
    return hoy.getFullYear() === anio ? hoy.getMonth() : -1;
  }, [anio]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from('categorias_pyg')
        .select('id,nivel,parent_id,nombre,bloque,computa_pyg,orden')
        .eq('activa', true)
        .order('orden', { ascending: true })
        .order('id', { ascending: true });
      if (cancel) return;
      setCats((data ?? []) as CatPyg[]);
    })();
    return () => { cancel = true; };
  }, []);

  const toggleTrim = (t: string) => setCollapsedTrim(p => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; });
  const toggleRow = (k: string) => setCollapsedRow(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  // Agregaciones
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

  // Gastos: agrego por bloque (2.1, 2.2, 2.3, 2.4) y por subgrupo (2.41 etc).
  // No tengo IDs hoja de categorias_pyg en gastos.categoria — solo grupos legacy.
  // Por ahora muestro los totales por bloque y subgrupo; las hojas no agregan.
  const gastosAgg = useMemo(() => {
    const porBloque: Record<string, number[]> = {};   // 2.1, 2.2, 2.3, 2.4
    const porSubgrupo: Record<string, number[]> = {}; // 2.41, 2.42, 2.43, 2.44 (resto va al bloque sin subdividir)
    const totalGastos = arr12();
    for (const g of gastosAnio) {
      const m = Number(g.fecha.slice(5, 7)) - 1;
      if (m < 0 || m > 11) continue;
      const grupo = (g as any).grupo as string | null | undefined; // legacy field
      const bloque = grupoLegacyToBloquePyG(grupo);
      if (!bloque) continue;
      const importe = Number(g.importe || 0);
      porBloque[bloque] = porBloque[bloque] || arr12();
      porBloque[bloque][m] += importe;
      totalGastos[m] += importe;
      const sub = grupoLegacyToSubgrupoPyG(grupo);
      if (sub) {
        porSubgrupo[sub] = porSubgrupo[sub] || arr12();
        porSubgrupo[sub][m] += importe;
      }
    }
    return { porBloque, porSubgrupo, totalGastos };
  }, [gastosAnio]);

  const ingNetoTotal = ingresos.netoEstTotal;

  const rows: Row[] = useMemo(() => {
    if (cats.length === 0) return [];
    const out: Row[] = [];

    const ebitda = arr12();
    for (let i = 0; i < 12; i++) ebitda[i] = ingNetoTotal[i] - gastosAgg.totalGastos[i];

    // ════════════ // RESUMEN //  ════════════
    out.push({ key: 'sep-resumen', kind: 'separator', label: '// RESUMEN //', monthly: arr12(), isSeparator: true });

    out.push({
      key: 'res-1.02',
      kind: 'h0',
      label: '1.02 Facturación bruta por ventas',
      monthly: ingresos.brutoTotal,
      pctMode: null,
      isResumen: true,
      italic: true,
    });
    out.push({
      key: 'res-1.01',
      kind: 'h0',
      label: '1.01 Ingresos netos por ventas',
      monthly: ingNetoTotal,
      pctMode: null,
      isResumen: true,
      colorAccent: '#1D9E75',
    });
    // 4 bloques de gasto con su banda
    for (const bk of ['2.1', '2.2', '2.3', '2.4'] as const) {
      const cat = cats.find(c => c.id === bk && c.nivel === 1);
      const banda = BANDAS_BLOQUE[bk];
      const label = `${bk} ${cat?.nombre ?? ''}`.trim();
      const labelBanda = banda ? `${label} (${banda.min}%-${banda.max}%)` : label;
      out.push({
        key: `res-${bk}`,
        kind: 'h0',
        label: labelBanda,
        monthly: gastosAgg.porBloque[bk] ?? arr12(),
        pctMode: 'banda',
        banda,
        isResumen: true,
        colorAccent: COLOR_BLOQUE[bk],
      });
    }
    out.push({
      key: 'res-totalgastos',
      kind: 'h0',
      label: 'Total gastos',
      monthly: gastosAgg.totalGastos,
      pctMode: 'ingresos',
      isResumen: true,
    });
    out.push({
      key: 'res-ebitda',
      kind: 'h0',
      label: 'Resultado',
      monthly: ebitda,
      pctMode: 'ingresos',
      isResumen: true,
      isResult: true,
    });

    // ════════════ // INGRESOS // ════════════
    out.push({ key: 'sep-ingresos', kind: 'separator', label: '// INGRESOS //', monthly: arr12(), isSeparator: true });

    // 1.1 Ingresos netos
    out.push({
      key: 'blk-1.1',
      kind: 'h1',
      label: '1.1 Ingresos netos por ventas',
      monthly: ingNetoTotal,
      expandable: true,
      pctMode: null,
      colorAccent: '#1D9E75',
    });
    for (const c of CANALES) {
      const vals = ingresos.netoEstPorCanal[c.key] ?? arr12();
      if (!vals.some(v => v > 0)) continue;
      const cat = cats.find(x => x.id === c.id_neto);
      out.push({
        key: `n-${c.key}`,
        kind: 'detail',
        label: `${c.id_neto} ${cat?.nombre ?? c.label}`,
        parentKey: 'blk-1.1',
        monthly: vals,
        pctMode: 'parent',
        parentForPct: 'blk-1.1',
      });
    }

    // 1.2 Facturación bruta (informativa, colapsada por defecto)
    if (ingresos.brutoTotal.some(v => v > 0)) {
      out.push({
        key: 'sub-1.2',
        kind: 'h1',
        label: '1.2 Facturación bruta por ventas',
        monthly: ingresos.brutoTotal,
        expandable: true,
        pctMode: null,
        italic: true,
      });
      for (const c of CANALES) {
        const vals = ingresos.brutoPorCanal[c.key] ?? arr12();
        if (!vals.some(v => v > 0)) continue;
        const cat = cats.find(x => x.id === c.id_bruto);
        out.push({
          key: `b-${c.key}`,
          kind: 'detail',
          label: `${c.id_bruto} ${cat?.nombre ?? c.label}`,
          parentKey: 'sub-1.2',
          monthly: vals,
          pctMode: 'parent',
          parentForPct: 'sub-1.2',
          italic: true,
        });
      }
    }

    // ════════════ // GASTOS // ════════════
    out.push({ key: 'sep-gastos', kind: 'separator', label: '// GASTOS //', monthly: arr12(), isSeparator: true });

    for (const bk of ['2.1', '2.2', '2.3', '2.4'] as const) {
      const cat = cats.find(c => c.id === bk && c.nivel === 1);
      const banda = BANDAS_BLOQUE[bk];
      const label = `${bk} ${cat?.nombre ?? ''}`.trim();
      const labelBanda = banda ? `${label} (${banda.min}%-${banda.max}%)` : label;
      const monthly = gastosAgg.porBloque[bk] ?? arr12();

      out.push({
        key: `blk-${bk}`,
        kind: 'h1',
        label: labelBanda,
        monthly,
        expandable: true,
        pctMode: 'banda',
        banda,
        colorAccent: COLOR_BLOQUE[bk],
      });

      // Subgrupos nivel 2 (solo para 2.4 que está subdividido en 2.41/42/43/44 con datos legacy)
      if (bk === '2.4') {
        for (const subId of ['2.41', '2.42', '2.43', '2.44']) {
          const subCat = cats.find(c => c.id === subId);
          const subVals = gastosAgg.porSubgrupo[subId] ?? arr12();
          if (!subVals.some(v => v > 0)) continue;
          out.push({
            key: `sub-${subId}`,
            kind: 'detail',
            label: `${subId} ${subCat?.nombre ?? ''}`.trim(),
            parentKey: `blk-${bk}`,
            monthly: subVals,
            pctMode: 'parent',
            parentForPct: `blk-${bk}`,
          });
        }
      }
      // Para 2.1, 2.2, 2.3: los datos legacy aún no permiten subdividir hoja por hoja
      // (gastos.categoria tiene PRD-MP, EQP-NOM... que están deprecated).
      // Se subdividirán automáticamente cuando gastos.categoria se actualice a IDs categorias_pyg.
    }

    return out;
  }, [cats, ingresos, gastosAgg, ingNetoTotal]);

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

  if (cats.length === 0) {
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
              ...thBase, textAlign: 'left', paddingLeft: 18, minWidth: 280,
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
            const isResult = !!r.isResult;
            const isResumen = !!r.isResumen;
            const isSeparator = !!r.isSeparator;

            // separador "// SECCIÓN //"
            if (isSeparator) {
              const colCount = TRIM.reduce((acc, t) => {
                const isCol = collapsedTrim.has(t.label);
                return acc + (isCol ? 2 : (t.months.length * 2) + 2);
              }, 0) + 2 + 1; // +2 año, +1 etiqueta
              return (
                <tr key={r.key}>
                  <td colSpan={colCount} style={{
                    padding: '14px 18px 6px',
                    fontFamily: 'Oswald, sans-serif',
                    fontSize: 10,
                    letterSpacing: '0.2em',
                    color: '#7a8090',
                    background: '#faf8f4',
                    fontWeight: 600,
                    borderTop: '2px solid #ebe8e2',
                    textTransform: 'uppercase',
                  }}>
                    {r.label}
                  </td>
                </tr>
              );
            }

            const indent = isDetail ? 36 : 18;
            const labelStyle: React.CSSProperties = {
              padding: isDetail ? '8px 6px 8px ' + indent + 'px'
                                : (isH0 ? '8px 6px 8px 18px' : '10px 6px 10px 18px'),
              fontFamily: (isH1 || isH0) ? 'Oswald, sans-serif' : 'Lexend, sans-serif',
              fontWeight: (isH0 || isH1) ? 600 : 400,
              fontSize: isH0 ? 11 : isH1 ? 12 : 11,
              letterSpacing: (isH1 || isH0) ? '0.06em' : 0,
              textTransform: 'none' as const,
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
              background: isResumen ? '#faf8f4' : '#ffffff',
              position: 'sticky',
              left: 0,
              zIndex: 1,
              borderTop: (isH1 || isH0) ? '1px solid #ebe8e2' : 'none',
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
              padding: isDetail ? '8px 6px' : isH0 ? '8px 6px' : '10px 6px',
              fontFamily: 'Lexend, sans-serif',
              fontSize: isPctCell ? 10 : (isH0 ? 11 : 11.5),
              fontWeight: (isH0 || isH1) ? 600 : 400,
              color: isResult
                ? (v >= 0 ? '#1D9E75' : '#B01D23')
                : r.colorAccent
                  ? r.colorAccent
                  : (isDetail ? '#3a4050' : '#111111'),
              textAlign: 'right',
              background: isResumen ? '#faf8f4' : bg,
              borderTop: (isH1 || isH0) ? '1px solid #ebe8e2' : 'none',
              fontStyle: r.italic ? 'italic' : 'normal',
              whiteSpace: 'nowrap',
            });

            const yearStyle: React.CSSProperties = {
              ...valStyle(yearVal, YEAR_BG),
              fontSize: 12,
              fontWeight: 700,
              color: isResult ? (yearVal >= 0 ? '#1D9E75' : '#B01D23') : (r.colorAccent || '#111111'),
              background: YEAR_BG,
            };
            const yearPctStyle: React.CSSProperties = {
              padding: isDetail ? '8px 4px' : isH0 ? '8px 4px' : '10px 4px',
              fontFamily: 'Lexend, sans-serif',
              fontSize: 10,
              fontWeight: 500,
              color: yearPct.color || '#B01D23',
              textAlign: 'right',
              background: YEAR_BG,
              borderTop: (isH1 || isH0) ? '1px solid #ebe8e2' : 'none',
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
