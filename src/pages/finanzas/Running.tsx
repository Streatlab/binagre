import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell } from 'recharts';
import { useTheme, FONT } from '@/styles/tokens';
import { fmtEur } from '@/utils/format';
import { supabase } from '@/lib/supabase';
import { useRunning } from '@/hooks/useRunning';
import {
  CATEGORIAS_ORDEN, CATEGORIA_COLOR, MESES_CORTO,
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
import TopProveedoresCard from '@/components/finanzas/running/TopProveedoresCard';
import RitmoMesCard from '@/components/finanzas/running/RitmoMesCard';
import ComparativaMensualCard from '@/components/finanzas/running/ComparativaMensualCard';

const VERDE = '#06C167';
const ROJO  = '#B01D23';
const AMBAR = '#f5a623';
const NARANJA = '#E8440A';

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

  const { loading, error, gastos, gastosAnt, ingresosMes, facturacion, facturacionAnt, rangos, reload } = useRunning(
    periodo, anio, marcaSel || null, marcaSelNombre,
  );

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

  /* — Facturación bruta desde facturacion_diario (REAL) — */
  const totalBruto = useMemo(
    () => facturacion.reduce((a, f) => a + Number(f.total_bruto || 0), 0),
    [facturacion],
  );
  const totalBrutoAnt = useMemo(
    () => facturacionAnt.reduce((a, f) => a + Number(f.total_bruto || 0), 0),
    [facturacionAnt],
  );
  const rowsIngresosBruto = useMemo(() => {
    return CANAL_LABEL.map(c => ({
      canal: c.label,
      importe: facturacion.reduce((a, f) => a + Number((f as any)[c.key] || 0), 0),
    }));
  }, [facturacion]);
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

  /* — Sparkline facturación bruta desde facturacion_diario (últimos 6 meses) — */
  const [sparkBrutoData, setSparkBrutoData] = useState<{ m: string; v: number }[]>([]);
  useEffect(() => {
    let cancel = false;
    (async () => {
      const hoy = new Date();
      const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1);
      const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      const fmtISO = (d: Date) => {
        const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      };
      let q = supabase.from('facturacion_diario').select('fecha, total_bruto, marca_id')
        .gte('fecha', fmtISO(desde)).lte('fecha', fmtISO(hasta));
      if (marcaSel) q = q.eq('marca_id', marcaSel);
      const { data } = await q;
      if (cancel) return;
      const out: { m: string; v: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const ref = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        const key = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
        const v = (data ?? []).filter((r: any) => (r.fecha || '').startsWith(key))
          .reduce((a, r: any) => a + Number(r.total_bruto || 0), 0);
        out.push({ m: MESES_CORTO[ref.getMonth()], v });
      }
      setSparkBrutoData(out);
    })();
    return () => { cancel = true };
  }, [marcaSel]);

  const sparkNeto = useMemo(() => {
    const hoy = new Date();
    const out: { m: string; v: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const ref = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      if (ref.getFullYear() !== anio) { out.push({ m: MESES_CORTO[ref.getMonth()], v: 0 }); continue; }
      const v = ingresosMes
        .filter(r => r.tipo === 'neto' && r.mes === ref.getMonth() + 1)
        .reduce((a, r) => a + r.importe, 0);
      out.push({ m: MESES_CORTO[ref.getMonth()], v });
    }
    return out;
  }, [ingresosMes, anio]);

  const barrasGastos = useMemo(() => {
    return CATEGORIAS_ORDEN.map(cat => ({
      cat,
      total: gastos.filter(g => g.categoria === cat).reduce((a, g) => a + g.importe, 0),
      color: CATEGORIA_COLOR[cat] ?? T.mut,
    }));
  }, [gastos, T.mut]);

  const SparkLine = ({ data, color }: { data: { v: number }[]; color: string }) => (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );

  const MiniBars = ({ data }: { data: { cat: string; total: number; color: string }[] }) => (
    <ResponsiveContainer width="100%" height={36}>
      <BarChart data={data}>
        <Bar dataKey="total" radius={[2, 2, 0, 0]} isAnimationActive={false}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

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
          <select
            value={marcaSel}
            onChange={e => setMarcaSel(e.target.value)}
            style={selectBase}
            title="Filtrar por marca"
          >
            <option value="">Todas las marcas</option>
            {marcasOpts.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
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
            chart={<SparkLine data={sparkBrutoData} color={ROJO} />}
          />
        )}
        <KpiCardConSparkline
          label="Ingresos netos"
          value={fmtEur(totalNeto)}
          delta={{ value: dPct(totalNeto, totalNetoAnt), sign: sgn(dPct(totalNeto, totalNetoAnt)), favorable: 'up' }}
          legend={!hayBruto ? 'Importa plataformas para ver bruto' : undefined}
          chart={<SparkLine data={sparkNeto} color={ROJO} />}
        />
        <KpiCardConSparkline
          label="Total gastos"
          value={fmtEur(totalGasto)}
          valueColor={NARANJA}
          delta={{ value: dPct(totalGasto, totalGastoAnt), sign: sgn(dPct(totalGasto, totalGastoAnt)), favorable: 'down' }}
          chart={<MiniBars data={barrasGastos} />}
        />
        <KpiCardConSparkline
          label="Resultado"
          value={(resultado >= 0 ? '+' : '−') + fmtEur(Math.abs(resultado)).replace('−', '')}
          valueColor={resultado >= 0 ? VERDE : ROJO}
          delta={{ value: dPct(resultado, resultadoAnt), sign: sgn(dPct(resultado, resultadoAnt)), favorable: 'up' }}
          chart={<SparkLine data={sparkNeto} color={resultado >= 0 ? VERDE : ROJO} />}
        />
        <KpiCardConSparkline
          label="Ratio gastos / netos"
          value={`${ratio.toFixed(1)}%`}
          valueColor={estadoRatio.color}
          legend={estadoRatio.label}
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
        />
        <GastosCard
          periodoLabel={periodo.label}
          totalGasto={totalGasto}
          totalGastoAnt={totalGastoAnt}
          rows={rowsGastos}
          onUpdateRango={handleUpdateRango}
        />
      </div>

      {/* Cards inteligentes (4 medianas) */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 32, alignItems: 'stretch' }}
        className="rf-smart-row"
      >
        <AlertasPresupuestoCard gastos={gastos} />
        <TopProveedoresCard periodoLabel={periodo.label} gastos={gastos} />
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
        <TablaPyG anio={anio} gastosAnio={gastos} ingresosAnio={ingresosMes} rangos={rangos} />
      </div>

      {/* Ingresos por marca */}
      <MarcasCard periodoLabel={periodo.label} rows={marcasRows} />

      {loading && (
        <div style={{ textAlign: 'center', padding: 16, color: T.mut, fontFamily: FONT.body, fontSize: 12 }}>
          Cargando…
        </div>
      )}

      <ModalAddGasto open={modalOpen} onClose={() => setModalOpen(false)} onSaved={reload} />

      <style>{`
        @media (max-width: 1280px) {
          .rf-smart-row { grid-template-columns: 1fr 1fr !important; }
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
