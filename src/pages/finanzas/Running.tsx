import { useMemo, useState } from 'react';
import { useRunning } from '@/hooks/useRunning';
import { fmtEur } from '@/lib/format';
import { periodoMesActual, CATEGORIAS_ORDEN, statusRango } from '@/lib/running';
import KpiCard from '@/components/finanzas/running/KpiCard';
import IngresosCard from '@/components/finanzas/running/IngresosCard';
import GastosCard from '@/components/finanzas/running/GastosCard';
import TablaPyG from '@/components/finanzas/running/TablaPyG';
import ModalAddGasto from '@/components/finanzas/running/ModalAddGasto';
import SelectorPeriodo from '@/components/finanzas/running/SelectorPeriodo';

const CANAL_META: Record<string, { color: string; bg: string }> = {
  'UBER EATS': { color: 'var(--rf-ch-uber)', bg: 'var(--rf-ch-uber-bg)' },
  'GLOVO':     { color: 'var(--rf-ch-glovo)', bg: 'var(--rf-ch-glovo-bg)' },
  'JUST EAT':  { color: 'var(--rf-ch-justeat)', bg: 'var(--rf-ch-justeat-bg)' },
  'TIENDA ONLINE': { color: 'var(--rf-ch-web)', bg: 'var(--rf-ch-web-bg)' },
  'CAJA':      { color: 'var(--rf-ch-directa)', bg: 'var(--rf-ch-directa-bg)' },
};

export default function Running() {
  const [periodo, setPeriodo] = useState(periodoMesActual());
  const [modalOpen, setModalOpen] = useState(false);
  const anio = periodo.desde.getFullYear();
  const { loading, error, gastos, gastosAnt, ingresosMes, rangos, reload } = useRunning(periodo, anio);

  const mesesDelPeriodo = useMemo(() => {
    const set = new Set<number>();
    for (let d = new Date(periodo.desde); d <= periodo.hasta; d.setDate(d.getDate()+1)) {
      if (d.getFullYear() === anio) set.add(d.getMonth()+1);
    }
    return Array.from(set);
  }, [periodo, anio]);

  const ingresosPeriodo = useMemo(() => {
    const byCanal: Record<string, { bruto: number; neto: number }> = {};
    ingresosMes.forEach(r => {
      if (!mesesDelPeriodo.includes(r.mes)) return;
      byCanal[r.canal] = byCanal[r.canal] || { bruto: 0, neto: 0 };
      byCanal[r.canal][r.tipo] += r.importe;
    });
    return byCanal;
  }, [ingresosMes, mesesDelPeriodo]);

  const totalBruto = Object.values(ingresosPeriodo).reduce((a,r) => a + r.bruto, 0);
  const totalNeto = Object.values(ingresosPeriodo).reduce((a,r) => a + r.neto, 0);
  const comisiones = totalBruto - totalNeto;

  const rowsIngresos = Object.entries(ingresosPeriodo).map(([canal, v]) => ({
    canal, bruto: v.bruto, neto: v.neto,
    color: CANAL_META[canal]?.color || 'var(--rf-text-2)',
    bgColor: CANAL_META[canal]?.bg || 'var(--rf-bg-panel)',
  })).sort((a,b) => b.bruto - a.bruto);

  const totalGasto = gastos.reduce((a,g) => a + g.importe, 0);
  const totalGastoAnt = gastosAnt.reduce((a,g) => a + g.importe, 0);
  const rangoMap = useMemo(() => {
    const m: Record<string, { min: number; max: number }> = {};
    rangos.forEach(r => { m[r.categoria] = { min: r.pct_min, max: r.pct_max }; });
    return m;
  }, [rangos]);

  const rowsGastos = useMemo(() => {
    return CATEGORIAS_ORDEN.map(cat => {
      const total = gastos.filter(g => g.categoria === cat).reduce((a,g) => a + g.importe, 0);
      const totalAnt = gastosAnt.filter(g => g.categoria === cat).reduce((a,g) => a + g.importe, 0);
      const pct = totalBruto ? (total / totalBruto) * 100 : 0;
      const rango = rangoMap[cat] || { min: 0, max: 999 };
      const delta = totalAnt ? ((total - totalAnt) / totalAnt) * 100 : 0;
      return {
        categoria: cat, total, pctSobreBruto: pct, pctMin: rango.min, pctMax: rango.max,
        status: statusRango(pct, rango.min, rango.max),
        deltaPct: Math.abs(Math.round(delta)),
        deltaSign: (Math.abs(delta) < 0.5 ? 'neutral' : delta > 0 ? 'up' : 'down') as 'up'|'down'|'neutral',
      };
    }).filter(r => r.total > 0);
  }, [gastos, gastosAnt, totalBruto, rangoMap]);

  const resultado = totalNeto - totalGasto;
  const pctResultado = totalNeto ? Math.round((resultado / totalNeto) * 100) : 0;
  const ratio = totalBruto ? (totalGasto / totalBruto) * 100 : 0;

  if (error) {
    return <div style={{ padding:24, background:'var(--rf-bg-page)', minHeight:'100vh' }}>
      <div style={{ background:'var(--rf-red-soft)', border:'1px solid var(--rf-red)', color:'var(--rf-red)', padding:16, borderRadius:8 }}>Error: {error}</div>
    </div>;
  }

  return (
    <div style={{ background:'var(--rf-bg-page)', minHeight:'100vh', padding:'24px 32px' }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <span style={{ fontFamily:'Oswald, sans-serif', fontSize:26, fontWeight:700, color:'var(--rf-red)', letterSpacing:'0.1em', textTransform:'uppercase' }}>Running financiero</span>
        <span style={{ marginLeft:'auto', fontSize:12, color:'var(--rf-text-2)' }}>
          {periodo.desde.toLocaleDateString('es-ES',{ day:'numeric', month:'long' })} — {periodo.hasta.toLocaleDateString('es-ES',{ day:'numeric', month:'long', year:'numeric' })}
        </span>
      </div>
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:24, flexWrap:'wrap' }}>
        <SelectorPeriodo value={periodo} onChange={setPeriodo}/>
        <button onClick={()=>setModalOpen(true)} style={{ marginLeft:'auto', background:'var(--rf-red)', color:'#fff', border:'none', padding:'10px 22px', borderRadius:8, fontFamily:'Oswald, sans-serif', fontSize:12, fontWeight:600, letterSpacing:'0.1em', cursor:'pointer', textTransform:'uppercase' }}>+ Añadir gasto</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:16, marginBottom:20 }} className="rf-kpi-row">
        <KpiCard label="Facturación bruta" value={fmtEur(totalBruto)} sub={`Neto recibido ${fmtEur(totalNeto)}`} subVariant="neutral"/>
        <KpiCard label="Comisiones plataformas" value={fmtEur(comisiones)} valueColor="var(--rf-red)" sub={`${totalBruto ? ((comisiones/totalBruto)*100).toFixed(1) : '0'}% sobre bruto`} subVariant="warn"/>
        <KpiCard label="Total gastos" value={fmtEur(totalGasto)} valueColor="var(--rf-orange)" sub={`${ratio.toFixed(1)}% sobre bruto`} subVariant="warn"/>
        <KpiCard label="Resultado" value={(resultado>=0?'+':'−')+fmtEur(Math.abs(resultado)).replace('−','')} valueColor={resultado>=0?'var(--rf-green)':'var(--rf-red)'} sub={`${resultado>=0?'+':''}${pctResultado}% sobre neto`} subVariant={resultado>=0?'up':'down'}/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:32 }} className="rf-big-row">
        <IngresosCard periodoLabel={periodo.label} rows={rowsIngresos}/>
        <GastosCard periodoLabel={periodo.label} totalGasto={totalGasto} totalGastoAnt={totalGastoAnt} rows={rowsGastos} ratio={ratio}/>
      </div>
      <div style={{ fontFamily:'Oswald, sans-serif', fontSize:13, letterSpacing:'0.1em', color:'var(--rf-text)', fontWeight:600, marginBottom:14, textTransform:'uppercase' }}>PyG detallado · {anio}</div>
      <TablaPyG anio={anio} gastosAnio={gastos} ingresosAnio={ingresosMes} rangos={rangos}/>
      {loading && <div style={{ textAlign:'center', padding:20, color:'var(--rf-text-muted)', fontSize:13 }}>Cargando…</div>}
      <ModalAddGasto open={modalOpen} onClose={()=>setModalOpen(false)} onSaved={reload}/>
      <style>{`@media (max-width: 1024px) { .rf-kpi-row { grid-template-columns: 1fr 1fr !important; } .rf-big-row { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
