/**
 * Running Financiero — refactor 3 may 2026
 * - Header copia literal Conciliación: SelectorFechaUniversal + TabsPastilla
 * - Tab Resumen: KPIs originales + CarruselMarcas (cards estilo Conciliación) + Ingresos/Gastos
 * - Tab PyG detallado: TablaPyG nueva con plan contable real
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ResponsiveContainer, BarChart, Bar, Cell, Tooltip, ReferenceLine, AreaChart, Area } from 'recharts';
import { useTheme, FONT, fmtFechaCorta } from '@/styles/tokens';
import { fmtEur } from '@/utils/format';
import { supabase } from '@/lib/supabase';
import { useRunning } from '@/hooks/useRunning';
import { useIVA } from '@/contexts/IVAContext';
import { useCalendario } from '@/contexts/CalendarioContext';
import CashflowRealCard from '@/components/finanzas/running/CashflowRealCard';
import {
  CATEGORIAS_ORDEN, CATEGORIA_COLOR, CATEGORIA_NOMBRE, MESES_CORTO,
  type Categoria, type PeriodoRango,
} from '@/lib/running';

import KpiCardConSparkline from '@/components/finanzas/running/KpiCardConSparkline';
import IngresosCardDonut from '@/components/finanzas/running/IngresosCardDonut';
import GastosCard from '@/components/finanzas/running/GastosCard';
import TablaPyG from '@/components/finanzas/running/TablaPyG';
import CarruselMarcas from '@/components/finanzas/running/CarruselMarcas';
import ModalAddGasto from '@/components/finanzas/running/ModalAddGasto';
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal';
import TabsPastilla from '@/components/ui/TabsPastilla';
import AlertasPresupuestoCard from '@/components/finanzas/running/AlertasPresupuestoCard';
import RitmoMesCard from '@/components/finanzas/running/RitmoMesCard';
import ComparativaMensualCard from '@/components/finanzas/running/ComparativaMensualCard';

const VERDE = '#10B981';
const ROJO = '#C4372C';
const AMBAR = '#F4C542';
const NARANJA = '#FF8C42';

const CANAL_LABEL: { key: 'uber_bruto'|'glovo_bruto'|'je_bruto'|'web_bruto'|'directa_bruto'; label: string }[] = [
  { key: 'uber_bruto',    label: 'Uber Eats' },
  { key: 'glovo_bruto',   label: 'Glovo' },
  { key: 'je_bruto',      label: 'Just Eat' },
  { key: 'web_bruto',     label: 'Tienda online' },
  { key: 'directa_bruto', label: 'Venta directa' },
];

function calcularEstadoRatio(pct: number): { label: string; color: string } {
  if (pct > 100) return { label: 'Crítico',    color: ROJO };
  if (pct >= 90) return { label: 'Al límite',  color: NARANJA };
  if (pct >= 70) return { label: 'Atención',   color: AMBAR };
  return              { label: 'Saludable',    color: VERDE };
}

type RunTab = 'resumen' | 'pyg' | 'comparativas';

export default function Running() {
  const { T } = useTheme();
  const [tab, setTab] = useState<RunTab>('resumen');

  // Selector fecha universal — gestión propia
  const [periodoDesde, setPeriodoDesde] = useState<Date>(() => {
    const h = new Date(); h.setDate(1); h.setHours(0,0,0,0); return h;
  });
  const [periodoHasta, setPeriodoHasta] = useState<Date>(() => {
    const h = new Date(); h.setHours(23,59,59,999); return h;
  });
  const [periodoLabelSFU, setPeriodoLabelSFU] = useState('Mes en curso');

  // Periodo legacy adaptado para useRunning (que requiere PeriodoRango)
  const periodo: PeriodoRango = useMemo(() => ({
    desde: periodoDesde,
    hasta: periodoHasta,
    key: 'mes',
    label: periodoLabelSFU,
  }), [periodoDesde, periodoHasta, periodoLabelSFU]);
  const anio = periodo.desde.getFullYear();

  const [modalOpen, setModalOpen] = useState(false);

  const { modo: modoIVA } = useIVA();
  const brutoFactor = modoIVA === 'sin' ? 1 / 1.10 : 1;

  const { loading, error, gastos, gastosAnt, ingresosMes, facturacion, facturacionAnt, rangos, reload } = useRunning(
    periodo, anio, null, null, modoIVA,
  );

  // Para TablaPyG necesitamos también la facturación de TODO el año (no solo del periodo)
  const [facturacionAnio, setFacturacionAnio] = useState<any[]>([]);
  useEffect(() => {
    let cancel = false;
    (async () => {
      const desde = `${anio}-01-01`;
      const hasta = `${anio}-12-31`;
      const { data } = await supabase.from('facturacion_diario')
        .select('fecha,marca_id,total_bruto,uber_bruto,glovo_bruto,je_bruto,web_bruto,directa_bruto,total_pedidos')
        .gte('fecha', desde)
        .lte('fecha', hasta);
      if (cancel) return;
      setFacturacionAnio(data ?? []);
    })();
    return () => { cancel = true; };
  }, [anio]);

  // Meses del periodo
  const mesesDelPeriodo = useMemo(() => {
    const set = new Set<number>();
    const cur = new Date(periodo.desde);
    while (cur <= periodo.hasta) {
      if (cur.getFullYear() === anio) set.add(cur.getMonth() + 1);
      cur.setDate(cur.getDate() + 1);
    }
    return Array.from(set);
  }, [periodo, anio]);

  // Ingresos netos del periodo
  const totalNeto = useMemo(() => {
    return ingresosMes.filter(r => r.tipo === 'neto' && mesesDelPeriodo.includes(r.mes)).reduce((a, r) => a + r.importe, 0);
  }, [ingresosMes, mesesDelPeriodo]);

  const totalNetoAnt = useMemo(() => {
    const ms = periodo.hasta.getTime() - periodo.desde.getTime();
    const hastaAnt = new Date(periodo.desde); hastaAnt.setDate(hastaAnt.getDate() - 1);
    const desdeAnt = new Date(hastaAnt.getTime() - ms);
    const set = new Set<number>();
    const cur = new Date(desdeAnt);
    while (cur <= hastaAnt) {
      if (cur.getFullYear() === anio) set.add(cur.getMonth() + 1);
      cur.setDate(cur.getDate() + 1);
    }
    return ingresosMes.filter(r => r.tipo === 'neto' && set.has(r.mes)).reduce((a, r) => a + r.importe, 0);
  }, [periodo, ingresosMes, anio]);

  const rowsIngresosNeto = useMemo(() => {
    const byCanal = new Map<string, number>();
    for (const r of ingresosMes) {
      if (r.tipo !== 'neto' || !mesesDelPeriodo.includes(r.mes)) continue;
      byCanal.set(r.canal, (byCanal.get(r.canal) ?? 0) + Number(r.importe || 0));
    }
    return Array.from(byCanal.entries()).map(([canal, importe]) => ({ canal, importe }));
  }, [ingresosMes, mesesDelPeriodo]);

  const totalBruto = useMemo(() => facturacion.reduce((a, f) => a + Number(f.total_bruto || 0), 0) * brutoFactor, [facturacion, brutoFactor]);
  const totalBrutoAnt = useMemo(() => facturacionAnt.reduce((a, f) => a + Number(f.total_bruto || 0), 0) * brutoFactor, [facturacionAnt, brutoFactor]);
  const rowsIngresosBruto = useMemo(() => {
    return CANAL_LABEL.map(c => ({
      canal: c.label,
      importe: facturacion.reduce((a, f) => a + Number((f as any)[c.key] || 0), 0) * brutoFactor,
    }));
  }, [facturacion, brutoFactor]);
  const hayBruto = totalBruto > 0;

  const totalGasto = gastos.reduce((a, g) => a + g.importe, 0);
  const totalGastoAnt = gastosAnt.reduce((a, g) => a + g.importe, 0);

  const rangoMap = useMemo(() => {
    const m: Record<string, { min: number; max: number }> = {};
    rangos.forEach(r => { m[r.categoria] = { min: r.pct_min, max: r.pct_max }; });
    return m;
  }, [rangos]);

  const rowsGastos = useMemo(() => {
    const denominador = totalNeto > 0 ? totalNeto : totalBruto;
    return CATEGORIAS_ORDEN.map(cat => {
      const total = gastos.filter(g => g.categoria === cat).reduce((a, g) => a + g.importe, 0);
      const pctReal = denominador > 0 ? (total / denominador) * 100 : 0;
      const rango = rangoMap[cat] || { min: 0, max: 999 };
      return { categoria: cat, total, pctReal, pctMin: rango.min, pctMax: rango.max };
    }).filter(r => r.total > 0);
  }, [gastos, totalNeto, totalBruto, rangoMap]);

  async function handleUpdateRango(cat: Categoria, pctMin: number, pctMax: number) {
    const { error } = await supabase.from('categorias_rango').upsert({ categoria: cat, pct_min: pctMin, pct_max: pctMax }, { onConflict: 'categoria' });
    if (error) { console.error(error); return; }
    reload();
  }

  // Prime Cost / EBITDA
  const gastosPRD = gastos.filter(g => g.categoria?.startsWith('PRD')).reduce((a, g) => a + g.importe, 0);
  const gastosEQP = gastos.filter(g => g.categoria?.startsWith('EQP')).reduce((a, g) => a + g.importe, 0);
  const gastosLOC = gastos.filter(g => g.categoria?.startsWith('LOC')).reduce((a, g) => a + g.importe, 0);
  const gastosCTR = gastos.filter(g => g.categoria?.startsWith('CTR')).reduce((a, g) => a + g.importe, 0);
  const primeCost = totalNeto > 0 ? ((gastosPRD + gastosEQP) / totalNeto) * 100 : 0;
  const ebitda = totalNeto - (gastosPRD + gastosEQP + gastosLOC + gastosCTR);

  const resultado = totalNeto - totalGasto;
  const resultadoAnt = totalNetoAnt - totalGastoAnt;
  const ratio = totalNeto > 0 ? (totalGasto / totalNeto) * 100 : 0;
  const estadoRatio = calcularEstadoRatio(ratio);
  const semaforoPos = Math.min(100, Math.max(0, ratio));

  const periodoCerrado = useMemo(
    () => (Date.now() - periodo.hasta.getTime()) / 86_400_000 >= 45,
    [periodo.hasta],
  );

  const { diasOperativosEnRango } = useCalendario();
  const diasOperativosPeriodo = useMemo(() => diasOperativosEnRango(periodo.desde, periodo.hasta) || 1, [diasOperativosEnRango, periodo.desde, periodo.hasta]);
  const mediaDiariaBruto = totalBruto > 0 ? totalBruto / diasOperativosPeriodo : 0;

  const dPct = (act: number, ant: number) => ant ? Math.round(((act - ant) / Math.abs(ant)) * 100) : 0;
  const sgn = (n: number): 'up' | 'down' | 'neutral' => Math.abs(n) < 1 ? 'neutral' : n > 0 ? 'up' : 'down';

  const fmtDiaCorto = (iso: string): string => {
    const [, m, d] = iso.split('-');
    return `${Number(d)}/${Number(m)}`;
  };

  const sparkBrutoDiario = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const r of facturacion) {
      const v = Number(r.total_bruto || 0) * brutoFactor;
      byDate.set(r.fecha, (byDate.get(r.fecha) ?? 0) + v);
    }
    return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([fecha, v]) => ({ m: fmtDiaCorto(fecha), v: Math.round(v * 100) / 100, iso: fecha }));
  }, [facturacion, brutoFactor]);

  const sparkNeto = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const v = ingresosMes.filter(r => r.tipo === 'neto' && r.mes === i + 1).reduce((a, r) => a + r.importe, 0);
      return { m: MESES_CORTO[i], v: Math.round(v * 100) / 100 };
    });
  }, [ingresosMes]);

  const GRUPOS_STACK: Categoria[] = ['PRODUCTO', 'RRHH', 'ALQUILER', 'MARKETING', 'ADMIN_GENERALES', 'SUMINISTROS', 'INTERNET_VENTAS'];
  const sparkGastosDiario = useMemo(() => {
    const byDate = new Map<string, Record<string, number>>();
    for (const g of gastos) {
      const row = byDate.get(g.fecha) ?? {};
      row[g.categoria] = (row[g.categoria] ?? 0) + Number(g.importe || 0);
      byDate.set(g.fecha, row);
    }
    return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([fecha, row]) => {
      const entry: Record<string, number | string> = { m: fmtDiaCorto(fecha), iso: fecha };
      for (const cat of GRUPOS_STACK) entry[cat] = Math.round((row[cat] ?? 0) * 100) / 100;
      return entry;
    });
  }, [gastos]);

  const sparkResultadoDiario = useMemo(() => {
    const COMISION_EST = 0.30;
    const bruto = new Map<string, number>();
    const gasto = new Map<string, number>();
    for (const f of facturacion) bruto.set(f.fecha, (bruto.get(f.fecha) ?? 0) + Number(f.total_bruto || 0) * brutoFactor);
    for (const g of gastos) gasto.set(g.fecha, (gasto.get(g.fecha) ?? 0) + Number(g.importe || 0));
    const todas = new Set<string>([...bruto.keys(), ...gasto.keys()]);
    return Array.from(todas).sort().map(fecha => ({
      m: fmtDiaCorto(fecha),
      v: Math.round(((bruto.get(fecha) ?? 0) * (1 - COMISION_EST) - (gasto.get(fecha) ?? 0)) * 100) / 100,
      iso: fecha,
    }));
  }, [facturacion, gastos, brutoFactor]);

  const sparkTooltip = {
    contentStyle: { backgroundColor: '#1A1A1A', border: 'none', color: '#ffffff', fontFamily: FONT.body, borderRadius: 6, fontSize: 11, padding: '4px 8px' } as React.CSSProperties,
    labelStyle: { color: '#ffffff', fontSize: 10 } as React.CSSProperties,
    itemStyle: { color: '#ffffff' } as React.CSSProperties,
    cursor: { fill: 'rgba(196,55,44,0.06)' } as any,
  };

  const SparkArea = ({ data, color, zero = false }: { data: { m: string; v: number }[]; color: string; zero?: boolean }) => (
    <ResponsiveContainer width="100%" height={100}>
      <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {zero && <ReferenceLine y={0} stroke={T.brd} strokeDasharray="2 2" />}
        <Tooltip {...sparkTooltip} formatter={(v) => [fmtEur(Number(v)), '']} labelFormatter={(l) => l} />
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#grad-${color.replace('#','')})`} isAnimationActive={false} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );

  const StackedGastosBars = ({ data }: { data: any[] }) => (
    <ResponsiveContainer width="100%" height={100}>
      <BarChart data={data} margin={{ top: 6, right: 4, bottom: 4, left: 4 }}>
        <Tooltip {...sparkTooltip} formatter={(v, n) => [fmtEur(Number(v)), CATEGORIA_NOMBRE[n as Categoria] ?? String(n)]} labelFormatter={(l) => l} />
        {GRUPOS_STACK.map(cat => (
          <Bar key={cat} dataKey={cat} stackId="g" fill={CATEGORIA_COLOR[cat]} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );

  const SparkLineResultado = ({ data }: { data: { m: string; v: number }[] }) => {
    const dataCol = data.map(d => ({ ...d, color: d.v >= 0 ? VERDE : ROJO }));
    return (
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={dataCol} margin={{ top: 6, right: 4, bottom: 4, left: 4 }}>
          <ReferenceLine y={0} stroke={T.brd} strokeDasharray="2 2" />
          <Tooltip {...sparkTooltip} formatter={(v) => [fmtEur(Number(v)), 'resultado']} labelFormatter={(l) => l} />
          <Bar dataKey="v" isAnimationActive={false} radius={[2, 2, 0, 0]}>
            {dataCol.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const Semaforo = () => (
    <div style={{ height: 36, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div style={{
        position: 'relative', height: 8,
        background: `linear-gradient(to right, ${VERDE} 0%, ${VERDE} 70%, ${AMBAR} 70%, ${AMBAR} 90%, ${NARANJA} 90%, ${NARANJA} 100%, ${ROJO} 100%)`,
        borderRadius: 4,
      }}>
        <div style={{
          position: 'absolute', left: `${Math.min(100, semaforoPos)}%`, top: -4,
          width: 3, height: 16, background: T.pri, borderRadius: 2, transform: 'translateX(-1.5px)',
          boxShadow: `0 0 0 2px ${T.card}`,
        }} />
      </div>
    </div>
  );

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ background: '#FCEBEB', border: '1px solid #B01D23', color: '#A32D2D', padding: 16, borderRadius: 8, fontFamily: FONT.body, fontSize: 13 }}>
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#f5f3ef', padding: '24px 28px' }}>
      {/* HEADER — copia literal Conciliación */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{
            color: '#B01D23',
            fontFamily: 'Oswald, sans-serif',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '3px',
            margin: 0,
            textTransform: 'uppercase',
          }}>
            RUNNING FINANCIERO
          </h2>
          <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090', display: 'block', marginTop: 4 }}>
            {fmtFechaCorta(periodo.desde.toISOString().slice(0,10))} — {fmtFechaCorta(periodo.hasta.toISOString().slice(0,10))}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <SelectorFechaUniversal
            nombreModulo="running"
            defaultOpcion="mes_en_curso"
            onChange={(desde, hasta, label) => {
              setPeriodoDesde(desde);
              setPeriodoHasta(hasta);
              setPeriodoLabelSFU(label);
            }}
          />
        </div>
      </div>

      {/* TABS PASTILLA — copia literal */}
      <TabsPastilla
        tabs={[
          { id: 'resumen', label: 'Resumen' },
          { id: 'pyg', label: 'PyG detallado' },
          { id: 'comparativas', label: 'Comparativas' },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as RunTab)}
      />

      {/* TAB RESUMEN */}
      {tab === 'resumen' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <CashflowRealCard periodoDesde={periodo.desde} periodoHasta={periodo.hasta} />
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: `repeat(${hayBruto ? 8 : 7}, minmax(0, 1fr))`, gap: 16, marginBottom: 16 }}
            className="rf-kpi-row"
          >
            {hayBruto && (
              <KpiCardConSparkline
                label="Facturación bruta"
                value={fmtEur(totalBruto)}
                delta={{ value: dPct(totalBruto, totalBrutoAnt), sign: sgn(dPct(totalBruto, totalBrutoAnt)), favorable: 'up' }}
                chart={<SparkArea data={sparkBrutoDiario} color={VERDE} />}
              />
            )}
            <KpiCardConSparkline
              label="Ingresos netos"
              value={fmtEur(totalNeto)}
              delta={{ value: dPct(totalNeto, totalNetoAnt), sign: sgn(dPct(totalNeto, totalNetoAnt)), favorable: 'up' }}
              legend={!hayBruto ? 'Importa plataformas para ver bruto' : undefined}
              chart={<SparkArea data={sparkNeto} color={VERDE} />}
            />
            <KpiCardConSparkline
              label="Total gastos"
              value={fmtEur(totalGasto)}
              valueColor={NARANJA}
              delta={{ value: dPct(totalGasto, totalGastoAnt), sign: sgn(dPct(totalGasto, totalGastoAnt)), favorable: 'down' }}
              chart={<StackedGastosBars data={sparkGastosDiario} />}
            />
            <KpiCardConSparkline
              label="Resultado"
              value={(resultado >= 0 ? '+' : '−') + fmtEur(Math.abs(resultado)).replace('−', '')}
              valueColor={resultado >= 0 ? VERDE : ROJO}
              delta={{ value: dPct(resultado, resultadoAnt), sign: sgn(dPct(resultado, resultadoAnt)), favorable: 'up' }}
              chart={<SparkLineResultado data={sparkResultadoDiario} />}
            />
            <KpiCardConSparkline
              label="Ratio gastos / netos"
              value={`${ratio.toFixed(1)}%`}
              valueColor={estadoRatio.color}
              legend={`${estadoRatio.label} · objetivo ≤ 85%`}
              chart={<Semaforo />}
            />
            <KpiCardConSparkline
              label="Prime Cost"
              value={`${primeCost.toFixed(1)}%`}
              valueColor={primeCost >= 55 && primeCost <= 65 ? VERDE : primeCost < 55 || primeCost > 75 ? ROJO : AMBAR}
              legend={`COGS+Labor · objetivo 55-65% · ${fmtEur(gastosPRD + gastosEQP)}`}
              chart={undefined}
            />
            <KpiCardConSparkline
              label="EBITDA"
              value={(ebitda >= 0 ? '+' : '−') + fmtEur(Math.abs(ebitda)).replace('−', '')}
              valueColor={ebitda >= 0 ? VERDE : ROJO}
              legend={`Sin provisiones IVA/IRPF`}
              chart={undefined}
            />
            <KpiCardConSparkline
              label="Media diaria"
              value={fmtEur(mediaDiariaBruto)}
              legend={`${diasOperativosPeriodo} días operativos`}
              chart={undefined}
            />
          </div>

          {/* CARRUSEL DE MARCAS — datos REALES del periodo seleccionado */}
          <CarruselMarcas periodoDesde={periodo.desde} periodoHasta={periodo.hasta} />

          {/* Ingresos + Gastos */}
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32, alignItems: 'stretch' }}
            className="rf-big-row"
          >
            <IngresosCardDonut
              totalBruto={totalBruto}
              totalNeto={totalNeto}
              totalBrutoAnt={totalBrutoAnt}
              totalNetoAnt={totalNetoAnt}
              rowsBruto={rowsIngresosBruto}
              rowsNeto={rowsIngresosNeto}
              periodoLabel={periodo.label}
              periodoCerrado={periodoCerrado}
            />
            <GastosCard
              periodoLabel={periodo.label}
              totalGasto={totalGasto}
              totalGastoAnt={totalGastoAnt}
              rows={rowsGastos}
              onUpdateRango={handleUpdateRango}
            />
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: 16, color: T.mut, fontFamily: FONT.body, fontSize: 12 }}>
              Cargando…
            </div>
          )}
        </>
      )}

      {/* TAB PYG DETALLADO */}
      {tab === 'pyg' && (
        <div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, color: '#B01D23', fontWeight: 500, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 12 }}>
            PyG detallado · {anio}
          </div>
          <TablaPyG
            anio={anio}
            gastosAnio={gastos}
            ingresosAnio={ingresosMes}
            facturacionAnio={facturacionAnio}
            rangos={rangos}
          />
          {loading && (
            <div style={{ textAlign: 'center', padding: 16, color: T.mut, fontFamily: FONT.body, fontSize: 12 }}>
              Cargando…
            </div>
          )}
        </div>
      )}

      {/* TAB COMPARATIVAS */}
      {tab === 'comparativas' && (
        <div>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 24, alignItems: 'stretch' }}
            className="rf-smart-row"
          >
            <AlertasPresupuestoCard gastos={gastos} />
            <RitmoMesCard />
            <ComparativaMensualCard />
          </div>
          {loading && (
            <div style={{ textAlign: 'center', padding: 16, color: T.mut, fontFamily: FONT.body, fontSize: 12 }}>
              Cargando…
            </div>
          )}
        </div>
      )}

      <ModalAddGasto open={modalOpen} onClose={() => setModalOpen(false)} onSaved={reload} />

      <style>{`
        @media (max-width: 1280px) {
          .rf-smart-row { grid-template-columns: 1fr 1fr !important; }
          .rf-kpi-row { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 1024px) {
          .rf-kpi-row { grid-template-columns: 1fr 1fr !important; }
          .rf-big-row { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .rf-kpi-row { grid-template-columns: 1fr !important; }
          .rf-smart-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
