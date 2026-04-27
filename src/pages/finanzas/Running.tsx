import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell, Tooltip, ReferenceLine, AreaChart, Area } from 'recharts';
import { useTheme, FONT } from '@/styles/tokens';
import { fmtEur } from '@/utils/format';
import { supabase } from '@/lib/supabase';
import { useRunning } from '@/hooks/useRunning';
import { useSueldos } from '@/hooks/useSueldos';
import { useIVA } from '@/contexts/IVAContext';
import IVAToggle from '@/components/IVAToggle';
import CashflowRealCard from '@/components/finanzas/running/CashflowRealCard';
import {
  CATEGORIAS_ORDEN, CATEGORIA_COLOR, CATEGORIA_NOMBRE, MESES_CORTO,
  type Categoria, type PeriodoRango,
} from '@/lib/running';

import KpiCardConSparkline from '@/components/finanzas/running/KpiCardConSparkline';
import IngresosCardDonut from '@/components/finanzas/running/IngresosCardDonut';
import GastosCard from '@/components/finanzas/running/GastosCard';
import TablaPyG from '@/components/finanzas/running/TablaPyG';
import ModalAddGasto from '@/components/finanzas/running/ModalAddGasto';
import SelectorPeriodoDropdown, { type PeriodoKey } from '@/components/finanzas/running/SelectorPeriodoDropdown';
import { useAniosDisponibles } from '@/hooks/useAniosDisponibles';
import MarcasCard from '@/components/finanzas/running/MarcasCard';
import AlertasPresupuestoCard from '@/components/finanzas/running/AlertasPresupuestoCard';
import RitmoMesCard from '@/components/finanzas/running/RitmoMesCard';
import ComparativaMensualCard from '@/components/finanzas/running/ComparativaMensualCard';

const VERDE = '#10B981';
const ROJO  = '#C4372C';
const AMBAR = '#F4C542';
const NARANJA = '#FF8C42';

const CANAL_LABEL: { key: 'uber_bruto'|'glovo_bruto'|'je_bruto'|'web_bruto'|'directa_bruto'; label: string }[] = [
  { key: 'uber_bruto',    label: 'Uber Eats' },
  { key: 'glovo_bruto',   label: 'Glovo' },
  { key: 'je_bruto',      label: 'Just Eat' },
  { key: 'web_bruto',     label: 'Web' },
  { key: 'directa_bruto', label: 'Directa' },
];

function calcularPeriodo(key: PeriodoKey, customDesde?: string, customHasta?: string): PeriodoRango {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = hoy.getMonth();
  const fmt = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  if (key === 'mes_anterior') {
    const desde = new Date(y, m - 1, 1);
    const hasta = new Date(y, m, 0);
    return { desde, hasta, key, label: `${fmt(desde)} – ${fmt(hasta)} ${desde.getFullYear()}` };
  }
  if (key === '30d') {
    const hasta = new Date(); const desde = new Date(); desde.setDate(desde.getDate() - 29);
    return { desde, hasta, key, label: 'Últimos 30 días' };
  }
  if (key === 'trimestre') {
    const hasta = new Date(); const desde = new Date(); desde.setDate(desde.getDate() - 89);
    return { desde, hasta, key, label: 'Últimos 3 meses' };
  }
  if (typeof key === 'string' && key.startsWith('anio_')) {
    const year = Number(key.slice(5));
    const desde = new Date(year, 0, 1); const hasta = new Date(year, 11, 31);
    return { desde, hasta, key, label: `Año ${year}` };
  }
  if (key === 'personalizado' && customDesde && customHasta) {
    const desde = new Date(customDesde + 'T00:00:00');
    const hasta = new Date(customHasta + 'T23:59:59');
    return { desde, hasta, key, label: `${fmt(desde)} – ${fmt(hasta)} ${hasta.getFullYear()}` };
  }
  const desde = new Date(y, m, 1);
  const hasta = new Date(y, m + 1, 0);
  return { desde, hasta, key, label: `${fmt(desde)} – ${fmt(hasta)} ${y}` };
}

function calcularEstadoRatio(pct: number): { label: string; color: string } {
  if (pct > 100) return { label: 'Crítico',    color: ROJO };
  if (pct >= 90) return { label: 'Al límite',  color: NARANJA };
  if (pct >= 70) return { label: 'Atención',   color: AMBAR };
  return              { label: 'Saludable',    color: VERDE };
}

interface MarcaOption { id: string; nombre: string }

export default function Running() {
  const { T } = useTheme();
  const [periodoKey, setPeriodoKey] = useState<PeriodoKey>('mes');
  const [customDesde, setCustomDesde] = useState<string>('');
  const [customHasta, setCustomHasta] = useState<string>('');
  const periodo = useMemo(
    () => calcularPeriodo(periodoKey, customDesde, customHasta),
    [periodoKey, customDesde, customHasta],
  );
  const anio = periodo.desde.getFullYear();
  const [modalOpen, setModalOpen] = useState(false);
  const aniosDisponibles = useAniosDisponibles();

  /* — Marcas activas para filtro — */
  const [marcasOpts, setMarcasOpts] = useState<MarcaOption[]>([]);
  const [marcaSel, setMarcaSel] = useState<string>(''); // '' = todas
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase.from('marcas').select('id, nombre, activa, estado').order('nombre');
      if (cancel) return;
      const activas = (data ?? []).filter((m: any) => m.activa !== false && m.estado !== 'pausada');
      setMarcasOpts(activas.map((m: any) => ({ id: m.id, nombre: m.nombre })));
    })();
    return () => { cancel = true };
  }, []);
  const marcaSelNombre = marcaSel ? (marcasOpts.find(m => m.id === marcaSel)?.nombre ?? null) : null;

  // Titular selector: null = todos, RUBEN_ID = Rubén, EMILIO_ID = Emilio
  // Nota: la tabla `gastos` e `ingresos_mensuales` no tienen titular_id, por lo que
  // los KPIs principales (ingresos/gastos/resultado) son datos del negocio global.
  // El selector afecta únicamente la tarjeta de Sueldos del periodo.
  const [titularSel, setTitularSel] = useState<'todos' | 'ruben' | 'emilio'>('todos');

  const { modo: modoIVA } = useIVA();
  const brutoFactor = modoIVA === 'sin' ? 1 / 1.10 : 1; // hostelería 10%

  const { loading, error, gastos, gastosAnt, ingresosMes, facturacion, facturacionAnt, rangos, reload } = useRunning(
    periodo, anio, marcaSel || null, marcaSelNombre, modoIVA,
  );

  const sueldosDetalle = useSueldos(periodo.desde, periodo.hasta);

  /* — Meses del periodo — */
  const mesesDelPeriodo = useMemo(() => {
    const set = new Set<number>();
    const cur = new Date(periodo.desde);
    while (cur <= periodo.hasta) {
      if (cur.getFullYear() === anio) set.add(cur.getMonth() + 1);
      cur.setDate(cur.getDate() + 1);
    }
    return Array.from(set);
  }, [periodo, anio]);

  /* — Ingresos netos desde ingresos_mensuales — */
  const totalNeto = useMemo(() => {
    return ingresosMes
      .filter(r => r.tipo === 'neto' && mesesDelPeriodo.includes(r.mes))
      .reduce((a, r) => a + r.importe, 0);
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
    return ingresosMes
      .filter(r => r.tipo === 'neto' && set.has(r.mes))
      .reduce((a, r) => a + r.importe, 0);
  }, [periodo, ingresosMes, anio]);

  const rowsIngresosNeto = useMemo(() => {
    const byCanal = new Map<string, number>();
    for (const r of ingresosMes) {
      if (r.tipo !== 'neto' || !mesesDelPeriodo.includes(r.mes)) continue;
      byCanal.set(r.canal, (byCanal.get(r.canal) ?? 0) + Number(r.importe || 0));
    }
    return Array.from(byCanal.entries()).map(([canal, importe]) => ({ canal, importe }));
  }, [ingresosMes, mesesDelPeriodo]);

  /* — Facturación bruta desde facturacion_diario (REAL) — sin IVA usa /1.10 — */
  const totalBruto = useMemo(
    () => facturacion.reduce((a, f) => a + Number(f.total_bruto || 0), 0) * brutoFactor,
    [facturacion, brutoFactor],
  );
  const totalBrutoAnt = useMemo(
    () => facturacionAnt.reduce((a, f) => a + Number(f.total_bruto || 0), 0) * brutoFactor,
    [facturacionAnt, brutoFactor],
  );
  const rowsIngresosBruto = useMemo(() => {
    return CANAL_LABEL.map(c => ({
      canal: c.label,
      importe: facturacion.reduce((a, f) => a + Number((f as any)[c.key] || 0), 0) * brutoFactor,
    }));
  }, [facturacion, brutoFactor]);
  const hayBruto = totalBruto > 0;

  /* — Total gastos periodo y anterior — */
  const totalGasto    = gastos.reduce((a, g) => a + g.importe, 0);
  const totalGastoAnt = gastosAnt.reduce((a, g) => a + g.importe, 0);

  /* — Rangos por categoría — */
  const rangoMap = useMemo(() => {
    const m: Record<string, { min: number; max: number }> = {};
    rangos.forEach(r => { m[r.categoria] = { min: r.pct_min, max: r.pct_max }; });
    return m;
  }, [rangos]);

  /* — Filas gastos (pctReal = sobre ingresos netos) — */
  const rowsGastos = useMemo(() => {
    const denominador = totalNeto > 0 ? totalNeto : totalBruto;
    return CATEGORIAS_ORDEN.map(cat => {
      const total = gastos.filter(g => g.categoria === cat).reduce((a, g) => a + g.importe, 0);
      const pctReal = denominador > 0 ? (total / denominador) * 100 : 0;
      const rango = rangoMap[cat] || { min: 0, max: 999 };
      return {
        categoria: cat,
        total,
        pctReal,
        pctMin: rango.min,
        pctMax: rango.max,
      };
    }).filter(r => r.total > 0);
  }, [gastos, totalNeto, totalBruto, rangoMap]);

  async function handleUpdateRango(cat: Categoria, pctMin: number, pctMax: number) {
    const { error } = await supabase.from('categorias_rango')
      .upsert({ categoria: cat, pct_min: pctMin, pct_max: pctMax }, { onConflict: 'categoria' });
    if (error) { console.error(error); return; }
    reload();
  }

  /* — Resultado y ratio — */
  const resultado    = totalNeto - totalGasto;
  const resultadoAnt = totalNetoAnt - totalGastoAnt;
  const ratio = totalNeto > 0 ? (totalGasto / totalNeto) * 100 : 0;
  const estadoRatio = calcularEstadoRatio(ratio);
  const semaforoPos = Math.min(100, Math.max(0, ratio));

  /* — Periodo cerrado: ≥45 días desde fin del periodo para asegurar liquidaciones cobradas — */
  const periodoCerrado = useMemo(
    () => (Date.now() - periodo.hasta.getTime()) / 86_400_000 >= 45,
    [periodo.hasta],
  );

  /* — Ventas por marca (derivado de facturacion del hook) — */
  interface MarcaRow { marca: string; bruto: number; pedidos: number; tm: number; deltaPct: number | null }
  const [marcaIdToNombre, setMarcaIdToNombre] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase.from('marcas').select('id, nombre');
      if (cancel) return;
      const m: Record<string, string> = {};
      for (const r of (data ?? []) as { id: string; nombre: string }[]) m[r.id] = r.nombre;
      setMarcaIdToNombre(m);
    })();
    return () => { cancel = true };
  }, []);

  const marcasRows: MarcaRow[] = useMemo(() => {
    const porMarca = new Map<string, { bruto: number; pedidos: number }>();
    for (const r of facturacion) {
      if (!r.marca_id) continue;
      const acc = porMarca.get(r.marca_id) ?? { bruto: 0, pedidos: 0 };
      acc.bruto += Number(r.total_bruto || 0);
      acc.pedidos += Number(r.total_pedidos || 0);
      porMarca.set(r.marca_id, acc);
    }
    const porMarcaAnt = new Map<string, number>();
    for (const r of facturacionAnt) {
      if (!r.marca_id) continue;
      porMarcaAnt.set(r.marca_id, (porMarcaAnt.get(r.marca_id) ?? 0) + Number(r.total_bruto || 0));
    }
    return Array.from(porMarca.entries())
      .map(([id, v]) => {
        const brutoAnt = porMarcaAnt.get(id) ?? 0;
        const deltaPct = brutoAnt > 0 ? ((v.bruto - brutoAnt) / brutoAnt) * 100 : null;
        return {
          marca: marcaIdToNombre[id] ?? '(sin nombre)',
          bruto: v.bruto,
          pedidos: v.pedidos,
          tm: v.pedidos > 0 ? v.bruto / v.pedidos : 0,
          deltaPct,
        };
      })
      .sort((a, b) => b.bruto - a.bruto);
  }, [facturacion, facturacionAnt, marcaIdToNombre]);

  const dPct = (act: number, ant: number) => ant ? Math.round(((act - ant) / Math.abs(ant)) * 100) : 0;
  const sgn = (n: number): 'up' | 'down' | 'neutral' => Math.abs(n) < 1 ? 'neutral' : n > 0 ? 'up' : 'down';

  /* — Label amigable para fecha ISO — */
  const fmtDiaCorto = (iso: string): string => {
    const [, m, d] = iso.split('-');
    return `${Number(d)}/${Number(m)}`;
  };

  /* — Sparkline facturación bruta: diario del periodo desde `facturacion` ya cargada — */
  const sparkBrutoDiario = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const r of facturacion) {
      const v = Number(r.total_bruto || 0) * brutoFactor;
      byDate.set(r.fecha, (byDate.get(r.fecha) ?? 0) + v);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, v]) => ({ m: fmtDiaCorto(fecha), v: Math.round(v * 100) / 100, iso: fecha }));
  }, [facturacion, brutoFactor]);

  /* — Sparkline neto: mensual del año (12 puntos, siempre tiene forma) — */
  const sparkNeto = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const v = ingresosMes
        .filter(r => r.tipo === 'neto' && r.mes === i + 1)
        .reduce((a, r) => a + r.importe, 0);
      return { m: MESES_CORTO[i], v: Math.round(v * 100) / 100 };
    });
  }, [ingresosMes]);

  /* — Sparkline gastos: stacked por grupo principal, diario del periodo — */
  const GRUPOS_STACK: Categoria[] = ['PRODUCTO', 'RRHH', 'ALQUILER', 'MARKETING', 'ADMIN_GENERALES', 'SUMINISTROS', 'INTERNET_VENTAS'];
  const sparkGastosDiario = useMemo(() => {
    const byDate = new Map<string, Record<string, number>>();
    for (const g of gastos) {
      const row = byDate.get(g.fecha) ?? {};
      row[g.categoria] = (row[g.categoria] ?? 0) + Number(g.importe || 0);
      byDate.set(g.fecha, row);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, row]) => {
        const entry: Record<string, number | string> = { m: fmtDiaCorto(fecha), iso: fecha };
        for (const cat of GRUPOS_STACK) entry[cat] = Math.round((row[cat] ?? 0) * 100) / 100;
        return entry;
      });
  }, [gastos]);

  /* — Sparkline resultado: diario del periodo (bruto*0.70 - gastos) — */
  const sparkResultadoDiario = useMemo(() => {
    const COMISION_EST = 0.30;
    const bruto = new Map<string, number>();
    const gasto = new Map<string, number>();
    for (const f of facturacion) {
      bruto.set(f.fecha, (bruto.get(f.fecha) ?? 0) + Number(f.total_bruto || 0) * brutoFactor);
    }
    for (const g of gastos) {
      gasto.set(g.fecha, (gasto.get(g.fecha) ?? 0) + Number(g.importe || 0));
    }
    const todas = new Set<string>([...bruto.keys(), ...gasto.keys()]);
    return Array.from(todas).sort().map(fecha => ({
      m: fmtDiaCorto(fecha),
      v: Math.round(((bruto.get(fecha) ?? 0) * (1 - COMISION_EST) - (gasto.get(fecha) ?? 0)) * 100) / 100,
      iso: fecha,
    }));
  }, [facturacion, gastos, brutoFactor]);

  const sparkTooltip = {
    contentStyle: {
      backgroundColor: '#1A1A1A',
      border: 'none',
      color: '#ffffff',
      fontFamily: FONT.body,
      borderRadius: 6,
      fontSize: 11,
      padding: '4px 8px',
    } as React.CSSProperties,
    labelStyle: { color: '#ffffff', fontSize: 10 } as React.CSSProperties,
    itemStyle: { color: '#ffffff' } as React.CSSProperties,
    cursor: { fill: 'rgba(196,55,44,0.06)' } as any,
  };

  const SparkArea = ({ data, color, zero = false }: { data: { m: string; v: number }[]; color: string; zero?: boolean }) => (
    <ResponsiveContainer width="100%" height={100}>
      <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {zero && <ReferenceLine y={0} stroke={T.brd} strokeDasharray="2 2" />}
        <Tooltip
          {...sparkTooltip}
          formatter={(v) => [fmtEur(Number(v)), '']}
          labelFormatter={(l) => l}
        />
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2}
          fill={`url(#grad-${color.replace('#','')})`} isAnimationActive={false} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );

  const StackedGastosBars = ({ data }: { data: any[] }) => (
    <ResponsiveContainer width="100%" height={100}>
      <BarChart data={data} margin={{ top: 6, right: 4, bottom: 4, left: 4 }}>
        <Tooltip
          {...sparkTooltip}
          formatter={(v, n) => [fmtEur(Number(v)), CATEGORIA_NOMBRE[n as Categoria] ?? String(n)]}
          labelFormatter={(l) => l}
        />
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
          <Tooltip
            {...sparkTooltip}
            formatter={(v) => [fmtEur(Number(v)), 'resultado']}
            labelFormatter={(l) => l}
          />
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
        position: 'relative',
        height: 8,
        background: `linear-gradient(to right, ${VERDE} 0%, ${VERDE} 70%, ${AMBAR} 70%, ${AMBAR} 90%, ${NARANJA} 90%, ${NARANJA} 100%, ${ROJO} 100%)`,
        borderRadius: 4,
      }}>
        <div style={{
          position: 'absolute',
          left: `${Math.min(100, semaforoPos)}%`,
          top: -4,
          width: 3,
          height: 16,
          background: T.pri,
          borderRadius: 2,
          transform: 'translateX(-1.5px)',
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

  const wrapPage: CSSProperties = {
    background: T.group,
    border: `0.5px solid ${T.brd}`,
    borderRadius: 16,
    padding: '24px 28px',
  };

  const selectBase: CSSProperties = {
    padding: '8px 14px',
    border: `1px solid ${T.brd}`,
    borderRadius: 8,
    backgroundColor: T.card,
    color: T.pri,
    fontFamily: FONT.body,
    fontSize: 13,
    cursor: 'pointer',
    outline: 'none',
  };

  return (
    <div style={wrapPage}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{
          color: ROJO, fontFamily: FONT.heading, fontSize: 22, fontWeight: 500,
          letterSpacing: 1, margin: 0, textTransform: 'uppercase',
        }}>
          Running financiero
        </h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>{periodo.label}</span>
          <IVAToggle />
          <select
            value={marcaSel}
            onChange={e => setMarcaSel(e.target.value)}
            style={selectBase}
            title="Filtrar por marca"
          >
            <option value="">Todas las marcas</option>
            {marcasOpts.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
          <select
            value={titularSel}
            onChange={e => setTitularSel(e.target.value as 'todos' | 'ruben' | 'emilio')}
            style={selectBase}
            title="Filtrar por titular"
          >
            <option value="todos">Todos los socios</option>
            <option value="ruben">Rubén</option>
            <option value="emilio">Emilio</option>
          </select>
          <SelectorPeriodoDropdown
            value={periodoKey}
            onChange={setPeriodoKey}
            anios={aniosDisponibles}
            desde={customDesde}
            hasta={customHasta}
            onRangoChange={(d, h) => { setCustomDesde(d); setCustomHasta(h); }}
          />
          <button
            onClick={() => setModalOpen(true)}
            style={{
              padding: '8px 16px',
              background: ROJO,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontFamily: FONT.heading,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: 1,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            + Añadir gasto
          </button>
        </div>
      </div>

      {/* Cashflow Real — fuera del toggle IVA, siempre con IVA (caja real) */}
      <div style={{ marginBottom: 16 }}>
        <CashflowRealCard periodoDesde={periodo.desde} periodoHasta={periodo.hasta} />
      </div>

      {/* KPIs (4 cards; 5 si hay facturación bruta) */}
      <div
        style={{ display: 'grid', gridTemplateColumns: `repeat(${hayBruto ? 5 : 4}, minmax(0, 1fr))`, gap: 16, marginBottom: 16 }}
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
      </div>

      {/* INGRESOS + GASTOS */}
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

      {/* Cards inteligentes (3 medianas) */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 32, alignItems: 'stretch' }}
        className="rf-smart-row"
      >
        <AlertasPresupuestoCard gastos={gastos} />
        <RitmoMesCard />
        <ComparativaMensualCard />
      </div>

      {/* Tabla PyG */}
      <div style={{
        fontFamily: FONT.heading, fontSize: 14, color: ROJO, fontWeight: 500,
        letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 12,
      }}>
        PyG detallado · {anio}
      </div>
      <div style={{ marginBottom: 16 }}>
        <TablaPyG
          anio={anio}
          gastosAnio={gastos}
          ingresosAnio={ingresosMes}
          rangos={rangos}
          sueldosEmilio={sueldosDetalle.loading ? undefined : sueldosDetalle.emilio}
        />
      </div>

      {/* Ingresos por marca */}
      <MarcasCard periodoLabel={periodo.label} rows={marcasRows} />

      {/* Sueldos del periodo (calculados desde Conciliación, CA-1) */}
      {/* El complemento SL que Rubén paga a Emilio aparece como gasto de Rubén — correcto aunque se filtre por Rubén */}
      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <div style={{
          fontFamily: FONT.heading, fontSize: 14, color: ROJO, fontWeight: 500,
          letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 12,
        }}>
          Sueldos del periodo
        </div>
        <div style={{
          background: T.card,
          border: `0.5px solid ${T.brd}`,
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#0a0a0a' }}>
                <th style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: T.sec, padding: '8px 16px', textAlign: 'left' }}>Persona</th>
                <th style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: T.sec, padding: '8px 16px', textAlign: 'right' }}>Detalle</th>
                <th style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: T.sec, padding: '8px 16px', textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {/* Fila Emilio — visible cuando titular = todos o emilio */}
              {titularSel !== 'ruben' && (
                <tr style={{ borderTop: `0.5px solid ${T.brd}` }}>
                  <td style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, padding: '10px 16px' }}>Emilio</td>
                  <td style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec, padding: '10px 16px', textAlign: 'right' }}>
                    {sueldosDetalle.loading ? '…' : (
                      `Plataformas ${fmtEur(sueldosDetalle.emilio.plataformas)} + Complemento SL ${fmtEur(sueldosDetalle.emilio.complementoSL)} = Total ${fmtEur(sueldosDetalle.emilio.total)}`
                    )}
                  </td>
                  <td style={{ fontFamily: FONT.heading, fontSize: 14, color: T.pri, padding: '10px 16px', textAlign: 'right' }}>
                    {sueldosDetalle.loading ? '…' : fmtEur(sueldosDetalle.emilio.total)}
                  </td>
                </tr>
              )}
              {/* Fila Rubén — visible cuando titular = todos o ruben */}
              {titularSel !== 'emilio' && (
                <tr style={{ borderTop: `0.5px solid ${T.brd}` }}>
                  <td style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, padding: '10px 16px' }}>Rubén</td>
                  <td style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, padding: '10px 16px', textAlign: 'right' }}>
                    pendiente lógica
                  </td>
                  <td style={{ fontFamily: FONT.heading, fontSize: 14, color: T.mut, padding: '10px 16px', textAlign: 'right' }}>
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {/* Promedio últimos 90 días Emilio */}
          {!sueldosDetalle.loading && titularSel !== 'ruben' && (
            <div style={{ padding: '8px 16px', fontFamily: FONT.body, fontSize: 11, color: T.mut, borderTop: `0.5px solid ${T.brd}` }}>
              Promedio últimos 90d Emilio: {fmtEur(sueldosDetalle.ultimos90d.emilio_mensual_real)}/mes
            </div>
          )}
          {sueldosDetalle.error && (
            <div style={{ padding: '8px 16px', fontFamily: FONT.body, fontSize: 11, color: '#B01D23' }}>
              Error sueldos: {sueldosDetalle.error}
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 16, color: T.mut, fontFamily: FONT.body, fontSize: 12 }}>
          Cargando…
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
