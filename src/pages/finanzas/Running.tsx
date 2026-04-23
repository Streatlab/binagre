import React, { useMemo, useState } from 'react';
import { useRunningFinanciero } from '@/hooks/useRunningFinanciero';
import { fmtEur } from '@/lib/format';
import {
  MESES_CORTO,
  MESES_LARGO,
  diasEnMes,
  statusPresupuesto,
  deltaPct,
  proyeccionMes,
  NOMBRES_CATEGORIA,
  TOKEN_CATEGORIA,
} from '@/lib/running-calc';
import KpiCard from '@/components/finanzas/running/KpiCard';
import BigBreakdownCard from '@/components/finanzas/running/BigBreakdownCard';
import TesoreriaCard from '@/components/finanzas/running/TesoreriaCard';
import PresupuestoCard from '@/components/finanzas/running/PresupuestoCard';
import TablaPyG from '@/components/finanzas/running/TablaPyG';
import ModalAddGasto from '@/components/finanzas/running/ModalAddGasto';

const MARCAS = ['Todas', 'Binagre', 'Ninja Ramen', 'Greta la Green', 'French TacOH LA LA', 'London Fish & Chips', 'Brunch pero bien', 'La Cocina de Carmucha'];

export default function Running() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [marca, setMarca] = useState('Todas');
  const [modalOpen, setModalOpen] = useState(false);
  const data = useRunningFinanciero(anio, marca);

  const mesActual = data.mesActual;
  const mesNombreLargo = MESES_LARGO[mesActual - 1];
  const mesNombreCorto = MESES_CORTO[mesActual - 1].toLowerCase();
  const mesAntCorto = mesActual > 1 ? MESES_CORTO[mesActual - 2].toLowerCase() : '';
  const diaActual = hoy.getDate();
  const diasMes = diasEnMes(anio, mesActual);
  const diasRestantes = Math.max(0, diasMes - diaActual);

  const ingMes = data.ingresosPorMes.find((x) => x.mes === mesActual);
  const ingMesAnt = data.ingresosPorMes.find((x) => x.mes === mesActual - 1);
  const gastosMes = data.gastosPorMes[mesActual] || [];
  const gastosMesAnt = data.gastosPorMes[mesActual - 1] || [];

  const ingNetoYTD = useMemo(() => data.ingresosPorMes.reduce((a, r) => a + r.neto, 0), [data.ingresosPorMes]);
  const ingBrutoYTD = useMemo(() => data.ingresosPorMes.reduce((a, r) => a + r.bruto, 0), [data.ingresosPorMes]);
  const comisionesYTD = useMemo(() => data.ingresosPorMes.reduce((a, r) => a + r.comisiones, 0), [data.ingresosPorMes]);
  const gastosYTD = useMemo(() => Object.values(data.gastosPorMes).flat().reduce((a, g) => a + g.total, 0), [data.gastosPorMes]);
  const resultadoYTD = ingNetoYTD - gastosYTD;
  const pctResultYTD = ingNetoYTD ? Math.round((resultadoYTD / ingNetoYTD) * 100) : 0;
  const pctComisionesBruto = ingBrutoYTD ? Math.round((comisionesYTD / ingBrutoYTD) * 100) : 0;

  const gastoMesTotal = gastosMes.reduce((a, g) => a + g.total, 0);
  const gastoMesAntTotal = gastosMesAnt.reduce((a, g) => a + g.total, 0);
  const breakevenMes = gastoMesTotal;
  const proyIngNetoMes = proyeccionMes(ingMes?.neto || 0, diaActual, diasMes);
  const breakevenCubierto = proyIngNetoMes >= breakevenMes;
  const breakevenPct = breakevenMes > 0 ? Math.round(((proyIngNetoMes - breakevenMes) / breakevenMes) * 100) : 0;

  const trendIngresos = deltaPct(ingMes?.bruto || 0, ingMesAnt?.bruto || 0);
  const ingresosRows = ingMes
    ? [
        { color: 'var(--rf-ch-uber)', name: 'Uber Eats', value: fmtEur(ingMes.uber), delta: deltaPct(ingMes.uber, ingMesAnt?.uber || 0), pct: ingMes.bruto ? Math.round((ingMes.uber / ingMes.bruto) * 100) : 0 },
        { color: 'var(--rf-ch-glovo)', name: 'Glovo', value: fmtEur(ingMes.glovo), delta: deltaPct(ingMes.glovo, ingMesAnt?.glovo || 0), pct: ingMes.bruto ? Math.round((ingMes.glovo / ingMes.bruto) * 100) : 0 },
        { color: 'var(--rf-ch-justeat)', name: 'Just Eat', value: fmtEur(ingMes.justeat), delta: deltaPct(ingMes.justeat, ingMesAnt?.justeat || 0), pct: ingMes.bruto ? Math.round((ingMes.justeat / ingMes.bruto) * 100) : 0 },
        { color: 'var(--rf-ch-web)', name: 'Web / Directa', value: fmtEur(ingMes.web), delta: deltaPct(ingMes.web, ingMesAnt?.web || 0), pct: ingMes.bruto ? Math.round((ingMes.web / ingMes.bruto) * 100) : 0 },
      ]
    : [];

  const trendGastos = deltaPct(gastoMesTotal, gastoMesAntTotal);
  const gastosRows = [...gastosMes]
    .sort((a, b) => b.total - a.total)
    .map((g) => {
      const ant = gastosMesAnt.find((x) => x.categoria === g.categoria)?.total || 0;
      return {
        color: TOKEN_CATEGORIA[g.categoria],
        name: NOMBRES_CATEGORIA[g.categoria],
        value: fmtEur(g.total),
        delta: deltaPct(g.total, ant),
        pct: gastoMesTotal ? Math.round((g.total / gastoMesTotal) * 100) : 0,
      };
    });

  if (data.error) {
    return (
      <div style={{ padding: 24, background: 'var(--rf-bg-page)', minHeight: '100vh' }}>
        <div style={{ background: 'var(--rf-red-soft)', border: '0.5px solid var(--rf-red)', color: 'var(--rf-red)', padding: 16, borderRadius: 8 }}>
          Error cargando Running Financiero: {data.error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--rf-bg-page)', minHeight: '100vh', padding: 24 }}>
      <div style={{ background: 'var(--rf-bg-panel)', borderRadius: 16, padding: 24, border: '0.5px solid var(--rf-border-card)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <span className="rf-font-header" style={{ fontSize: 22, fontWeight: 600, color: 'var(--rf-red)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Running financiero
          </span>
          <span className="rf-font-body" style={{ fontSize: 13, color: 'var(--rf-text-secondary)', fontWeight: 400 }}>
            — {mesNombreLargo} {anio}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--rf-text-secondary)' }}>
            1 {mesNombreCorto} — {diaActual} {mesNombreCorto} {anio} · día {diaActual}/{diasMes}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ background: 'var(--rf-bg-card)', border: '0.5px solid var(--rf-border-input)', padding: '8px 14px', borderRadius: 6, fontSize: 13, color: 'var(--rf-text-primary)', fontFamily: 'Lexend, sans-serif' }}>
            {[anio - 1, anio, anio + 1].map((y) => (
              <option key={y} value={y}>Año {y}</option>
            ))}
          </select>
          <select value={marca} onChange={(e) => setMarca(e.target.value)} style={{ background: 'var(--rf-bg-card)', border: '0.5px solid var(--rf-border-input)', padding: '8px 14px', borderRadius: 6, fontSize: 13, color: 'var(--rf-text-primary)', fontFamily: 'Lexend, sans-serif' }}>
            {MARCAS.map((m) => (
              <option key={m} value={m}>{m === 'Todas' ? 'Todas las marcas' : m}</option>
            ))}
          </select>
          <button onClick={() => setModalOpen(true)} style={{ background: 'var(--rf-red)', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, fontFamily: 'Oswald, sans-serif', fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', cursor: 'pointer', marginLeft: 'auto', textTransform: 'uppercase' }}>
            + Añadir gasto
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          {['Mensual', 'Trimestre', 'Anual'].map((t, i) => (
            <button key={t} style={{ padding: '9px 18px', background: i === 0 ? 'var(--rf-red)' : 'var(--rf-bg-card)', color: i === 0 ? '#fff' : 'var(--rf-text-primary)', border: `0.5px solid ${i === 0 ? 'var(--rf-red)' : 'var(--rf-border-input)'}`, borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'Lexend, sans-serif' }}>
              {t}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button style={{ padding: '9px 18px', background: 'transparent', color: 'var(--rf-text-secondary)', border: '0.5px solid var(--rf-border-input)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'Lexend, sans-serif' }}>⭳ Exportar CSV</button>
            <button style={{ padding: '9px 18px', background: 'transparent', color: 'var(--rf-text-secondary)', border: '0.5px solid var(--rf-border-input)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'Lexend, sans-serif' }}>⭳ PDF mes</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }} className="rf-kpi-row">
          <KpiCard label="Ing. netos YTD" value={fmtEur(ingNetoYTD)} sub={`Brutos ${fmtEur(ingBrutoYTD)}`} subVariant="neutral" />
          <KpiCard label="Comisiones" value={fmtEur(comisionesYTD)} valueColor="var(--rf-red)" sub={`${pctComisionesBruto}% s/ fact. bruta`} subVariant="warn" />
          <KpiCard
            label="Resultado YTD"
            value={(resultadoYTD >= 0 ? '+' : '−') + fmtEur(Math.abs(resultadoYTD)).replace('−', '')}
            valueColor={resultadoYTD >= 0 ? 'var(--rf-green)' : 'var(--rf-red)'}
            sub={<><span style={{ fontSize: 11, marginRight: 2 }}>{resultadoYTD >= 0 ? '▲' : '▼'}</span>{pctResultYTD}% s/ingresos netos</>}
            subVariant={resultadoYTD >= 0 ? 'up' : 'down'}
          />
          <KpiCard
            label="Breakeven mes"
            value={fmtEur(breakevenMes)}
            sub={<><span style={{ fontSize: 11, marginRight: 2 }}>{breakevenCubierto ? '▲' : '▼'}</span>Proyección {fmtEur(proyIngNetoMes)} · {breakevenPct >= 0 ? '+' : ''}{breakevenPct}%</>}
            subVariant={breakevenCubierto ? 'up' : 'warn'}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }} className="rf-big-row">
          <BigBreakdownCard
            header={`Ingresos brutos · ${mesNombreCorto}`}
            value={fmtEur(ingMes?.bruto || 0)}
            trend={{ sign: trendIngresos.sign, text: `${trendIngresos.sign === 'neutral' ? '—' : trendIngresos.sign === 'up' ? '+' : '−'}${trendIngresos.valueAbs}% vs ${mesAntCorto || 'mes ant.'} (${fmtEur(ingMesAnt?.bruto || 0)})` }}
            rows={ingresosRows}
          />
          <BigBreakdownCard
            header={`Gastos · ${mesNombreCorto}`}
            value={fmtEur(gastoMesTotal)}
            trend={{ sign: trendGastos.sign, text: `${trendGastos.sign === 'neutral' ? '—' : trendGastos.sign === 'up' ? '+' : '−'}${trendGastos.valueAbs}% vs ${mesAntCorto || 'mes ant.'}` }}
            rows={gastosRows}
          />
          <TesoreriaCard tesoreria={data.tesoreriaHoy} ingNetoMes={ingMes?.neto || 0} mesNombreCorto={mesNombreCorto} />
        </div>

        <div className="rf-font-header" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--rf-text-label)', fontWeight: 500, marginBottom: 12, textTransform: 'uppercase' }}>
          Presupuestos · {mesNombreLargo} {anio} · {diasRestantes} días restantes
        </div>
        {data.presupuestosMesActual.length === 0 ? (
          <div style={{ background: 'var(--rf-bg-card)', border: '0.5px dashed var(--rf-border-card)', borderRadius: 12, padding: 20, textAlign: 'center', color: 'var(--rf-text-muted)', fontSize: 13, marginBottom: 20 }}>
            No hay presupuestos definidos para {mesNombreLargo} {anio}.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }} className="rf-presup-row">
            {data.presupuestosMesActual.map((p) => (
              <PresupuestoCard
                key={p.categoria}
                nombre={NOMBRES_CATEGORIA[p.categoria]}
                gasto={p.gasto}
                tope={p.tope}
                status={statusPresupuesto(p.gasto, p.tope)}
                ritmoPorDia={diaActual > 0 ? p.gasto / diaActual : undefined}
                diasRestantes={diasRestantes}
              />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div className="rf-font-header" style={{ fontSize: 13, letterSpacing: '0.1em', color: 'var(--rf-text-primary)', fontWeight: 500, textTransform: 'uppercase' }}>
            P&amp;G detallado · {anio}
          </div>
        </div>

        <TablaPyG ingresosPorMes={data.ingresosPorMes} gastosPorMes={data.gastosPorMes} mesActual={mesActual} anio={anio} />

        {data.loading && (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--rf-text-muted)', fontSize: 13 }}>Cargando…</div>
        )}
      </div>

      <ModalAddGasto open={modalOpen} onClose={() => setModalOpen(false)} onSaved={data.reload} marcas={MARCAS} />

      <style>{`
        @media (max-width: 1024px) {
          .rf-kpi-row { grid-template-columns: 1fr 1fr !important; }
          .rf-big-row { grid-template-columns: 1fr !important; }
          .rf-presup-row { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
