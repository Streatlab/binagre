import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell } from 'recharts';
import { useTheme, FONT } from '@/styles/tokens';
import { fmtEur } from '@/utils/format';
import { supabase } from '@/lib/supabase';
import { useRunning } from '@/hooks/useRunning';
import {
  CATEGORIAS_ORDEN, CATEGORIA_COLOR, statusRango, MESES_CORTO,
  type PeriodoRango,
} from '@/lib/running';

import KpiCardConSparkline from '@/components/finanzas/running/KpiCardConSparkline';
import IngresosCardDonut from '@/components/finanzas/running/IngresosCardDonut';
import GastosCard from '@/components/finanzas/running/GastosCard';
import TablaPyG from '@/components/finanzas/running/TablaPyG';
import ModalAddGasto from '@/components/finanzas/running/ModalAddGasto';
import SelectorPeriodoDropdown, { type PeriodoKey } from '@/components/finanzas/running/SelectorPeriodoDropdown';
import MarcasCard from '@/components/finanzas/running/MarcasCard';
import AlertasPresupuestoCard from '@/components/finanzas/running/AlertasPresupuestoCard';
import TopProveedoresCard from '@/components/finanzas/running/TopProveedoresCard';
import RitmoMesCard from '@/components/finanzas/running/RitmoMesCard';
import ComparativaMensualCard from '@/components/finanzas/running/ComparativaMensualCard';

const VERDE = '#06C167';
const ROJO  = '#B01D23';
const NARANJA = '#E8440A';

function calcularPeriodo(key: PeriodoKey): PeriodoRango {
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
  if (key === 'anio') {
    const desde = new Date(y, 0, 1); const hasta = new Date(y, 11, 31);
    return { desde, hasta, key, label: `Año ${y}` };
  }
  // 'mes' y 'personalizado' → mes actual por defecto
  const desde = new Date(y, m, 1);
  const hasta = new Date(y, m + 1, 0);
  return { desde, hasta, key, label: `${fmt(desde)} – ${fmt(hasta)} ${y}` };
}

function calcularEstadoRatio(pct: number): { label: string; color: string } {
  if (pct >= 90) return { label: 'Crítico',    color: ROJO };
  if (pct >= 75) return { label: 'Al límite',  color: '#f5a623' };
  return                { label: 'Saludable', color: VERDE };
}

export default function Running() {
  const { T } = useTheme();
  const [periodoKey, setPeriodoKey] = useState<PeriodoKey>('mes');
  const periodo = useMemo(() => calcularPeriodo(periodoKey), [periodoKey]);
  const anio = periodo.desde.getFullYear();
  const [modalOpen, setModalOpen] = useState(false);

  const { loading, error, gastos, gastosAnt, ingresosMes, rangos, reload } = useRunning(periodo, anio);

  /* — Meses dentro del periodo (para agregar ingresos mensuales) — */
  const mesesDelPeriodo = useMemo(() => {
    const set = new Set<number>();
    const cur = new Date(periodo.desde);
    while (cur <= periodo.hasta) {
      if (cur.getFullYear() === anio) set.add(cur.getMonth() + 1);
      cur.setDate(cur.getDate() + 1);
    }
    return Array.from(set);
  }, [periodo, anio]);

  /* — Agregado ingresos por canal en el periodo — */
  const ingresosPeriodo = useMemo(() => {
    const byCanal: Record<string, { bruto: number; neto: number }> = {};
    ingresosMes.forEach(r => {
      if (!mesesDelPeriodo.includes(r.mes)) return;
      byCanal[r.canal] = byCanal[r.canal] || { bruto: 0, neto: 0 };
      byCanal[r.canal][r.tipo] += r.importe;
    });
    return byCanal;
  }, [ingresosMes, mesesDelPeriodo]);

  const totalBruto = Object.values(ingresosPeriodo).reduce((a, r) => a + r.bruto, 0);
  const totalNeto  = Object.values(ingresosPeriodo).reduce((a, r) => a + r.neto, 0);

  const rowsIngresos = Object.entries(ingresosPeriodo).map(([canal, v]) => ({
    canal, importe: v.bruto,
  }));

  /* — Periodo anterior: aproximamos bruto/neto (ingresos mensuales del año) — */
  const totalBrutoAnt = useMemo(() => {
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
      .filter(r => r.tipo === 'bruto' && set.has(r.mes))
      .reduce((a, r) => a + r.importe, 0);
  }, [periodo, ingresosMes, anio]);

  /* — Total gastos periodo y anterior — */
  const totalGasto    = gastos.reduce((a, g) => a + g.importe, 0);
  const totalGastoAnt = gastosAnt.reduce((a, g) => a + g.importe, 0);

  /* — Filas gastos por categoría — */
  const rangoMap = useMemo(() => {
    const m: Record<string, { min: number; max: number }> = {};
    rangos.forEach(r => { m[r.categoria] = { min: r.pct_min, max: r.pct_max }; });
    return m;
  }, [rangos]);

  const rowsGastos = useMemo(() => {
    return CATEGORIAS_ORDEN.map(cat => {
      const total = gastos.filter(g => g.categoria === cat).reduce((a, g) => a + g.importe, 0);
      const pct = totalBruto ? (total / totalBruto) * 100 : 0;
      const rango = rangoMap[cat] || { min: 0, max: 999 };
      return {
        categoria: cat,
        total,
        pctSobreBruto: pct,
        pctMin: rango.min,
        pctMax: rango.max,
        status: statusRango(pct, rango.min, rango.max),
      };
    }).filter(r => r.total > 0);
  }, [gastos, totalBruto, rangoMap]);

  /* — Resultado y ratio — */
  const resultado = totalNeto - totalGasto;
  const ratio     = totalBruto ? (totalGasto / totalBruto) * 100 : 0;

  /* — Resultado anterior (estimado) — */
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
  const resultadoAnt = totalNetoAnt - totalGastoAnt;

  /* — Ventas por marca (Card MarcasCard) — */
  interface MarcaRow { marca: string; bruto: number; pedidos: number; tm: number; deltaPct: number | null }
  const [marcasRows, setMarcasRows] = useState<MarcaRow[]>([])
  useEffect(() => {
    let cancel = false
    ;(async () => {
      const ms = periodo.hasta.getTime() - periodo.desde.getTime()
      const hastaAnt = new Date(periodo.desde); hastaAnt.setDate(hastaAnt.getDate() - 1)
      const desdeAnt = new Date(hastaAnt.getTime() - ms)
      const fmtISO = (d: Date) => {
        const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
      }
      const [act, ant] = await Promise.all([
        supabase.from('facturacion_diario')
          .select('marca_id, total_pedidos, total_bruto, marcas(nombre)')
          .gte('fecha', fmtISO(periodo.desde)).lte('fecha', fmtISO(periodo.hasta)),
        supabase.from('facturacion_diario')
          .select('marca_id, total_bruto')
          .gte('fecha', fmtISO(desdeAnt)).lte('fecha', fmtISO(hastaAnt)),
      ])
      if (cancel) return
      if (act.error || ant.error) { console.error(act.error ?? ant.error); return }

      type Row = { marca_id: string | null; total_pedidos: number | null; total_bruto: number | string | null; marcas: { nombre: string } | { nombre: string }[] | null }
      const porMarca = new Map<string, { nombre: string; bruto: number; pedidos: number }>()
      for (const r of (act.data ?? []) as unknown as Row[]) {
        if (!r.marca_id) continue
        const m = Array.isArray(r.marcas) ? r.marcas[0] : r.marcas
        const nombre = m?.nombre ?? '(sin marca)'
        const acc = porMarca.get(r.marca_id) ?? { nombre, bruto: 0, pedidos: 0 }
        acc.bruto += Number(r.total_bruto ?? 0)
        acc.pedidos += Number(r.total_pedidos ?? 0)
        porMarca.set(r.marca_id, acc)
      }
      const porMarcaAnt = new Map<string, number>()
      for (const r of (ant.data ?? []) as unknown as Row[]) {
        if (!r.marca_id) continue
        porMarcaAnt.set(r.marca_id, (porMarcaAnt.get(r.marca_id) ?? 0) + Number(r.total_bruto ?? 0))
      }
      const rows: MarcaRow[] = Array.from(porMarca.entries()).map(([id, v]) => {
        const brutoAnt = porMarcaAnt.get(id) ?? 0
        const deltaPct = brutoAnt > 0 ? ((v.bruto - brutoAnt) / brutoAnt) * 100 : null
        return {
          marca: v.nombre,
          bruto: v.bruto,
          pedidos: v.pedidos,
          tm: v.pedidos > 0 ? v.bruto / v.pedidos : 0,
          deltaPct,
        }
      }).sort((a, b) => b.bruto - a.bruto)
      setMarcasRows(rows)
    })()
    return () => { cancel = true }
  }, [periodo.desde.getTime(), periodo.hasta.getTime()])

  const dPct = (act: number, ant: number) => ant ? Math.round(((act - ant) / Math.abs(ant)) * 100) : 0;
  const sgn = (n: number): 'up' | 'down' | 'neutral' => Math.abs(n) < 1 ? 'neutral' : n > 0 ? 'up' : 'down';

  /* — Sparkline ingresos: últimos 6 meses (bruto mensual) — */
  const sparkIngresos = useMemo(() => {
    const hoy = new Date();
    const out: { m: string; v: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const ref = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      if (ref.getFullYear() !== anio) { out.push({ m: MESES_CORTO[ref.getMonth()], v: 0 }); continue; }
      const v = ingresosMes
        .filter(r => r.tipo === 'bruto' && r.mes === ref.getMonth() + 1)
        .reduce((a, r) => a + r.importe, 0);
      out.push({ m: MESES_CORTO[ref.getMonth()], v });
    }
    return out;
  }, [ingresosMes, anio]);

  /* — Sparkline resultado: 6 meses (neto - gasto del periodo no se tiene; usamos solo neto como proxy) — */
  const sparkResultado = useMemo(() => {
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

  /* — Mini-barras gastos por categoría (periodo) — */
  const barrasGastos = useMemo(() => {
    return CATEGORIAS_ORDEN.map(cat => ({
      cat,
      total: gastos.filter(g => g.categoria === cat).reduce((a, g) => a + g.importe, 0),
      color: CATEGORIA_COLOR[cat] ?? T.mut,
    }));
  }, [gastos, T.mut]);

  const estadoRatio = calcularEstadoRatio(ratio);
  const semaforoPos = Math.min(100, Math.max(0, (ratio / 100) * 100));

  /* — Mini-charts inline — */
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
        background: 'linear-gradient(to right, #C0DD97 0%, #C0DD97 50%, #FAC775 50%, #FAC775 75%, #F09595 75%, #F09595 100%)',
        borderRadius: 4,
      }}>
        <div style={{
          position: 'absolute',
          left: `${semaforoPos}%`,
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
          <SelectorPeriodoDropdown value={periodoKey} onChange={setPeriodoKey} />
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

      {/* KPIs (4 cards con mini-gráfico) */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}
        className="rf-kpi-row"
      >
        <KpiCardConSparkline
          label="Facturación bruta"
          value={fmtEur(totalBruto)}
          delta={{ value: dPct(totalBruto, totalBrutoAnt), sign: sgn(dPct(totalBruto, totalBrutoAnt)), favorable: 'up' }}
          chart={<SparkLine data={sparkIngresos} color={ROJO} />}
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
          chart={<SparkLine data={sparkResultado} color={resultado >= 0 ? VERDE : ROJO} />}
        />
        <KpiCardConSparkline
          label="Ratio gastos / facturación"
          value={`${ratio.toFixed(1)}%`}
          valueColor={estadoRatio.color}
          legend={estadoRatio.label}
          chart={<Semaforo />}
        />
      </div>

      {/* INGRESOS (donut) + GASTOS (lista) */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32, alignItems: 'stretch' }}
        className="rf-big-row"
      >
        <IngresosCardDonut
          total={totalBruto}
          totalAnt={totalBrutoAnt}
          rows={rowsIngresos}
          periodoLabel={periodo.label}
        />
        <GastosCard
          periodoLabel={periodo.label}
          totalGasto={totalGasto}
          totalGastoAnt={totalGastoAnt}
          rows={rowsGastos}
          ratio={ratio}
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
