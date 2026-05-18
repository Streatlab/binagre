/**
 * RUNNING FINANCIERO — NUEVO DESDE CERO (18 may 2026)
 *
 * Módulo completo: Resumen ejecutivo con KPIs, Prime Cost, Break-even,
 * Proyección, Ingresos por canal, Gastos por grupo, Top proveedores,
 * Top categorías, YTD, Comparativa vs anterior.
 *
 * Filtros: Periodo + Titular + Marca
 * Fuentes: gastos, conciliacion, facturacion_diario, categorias_rango, presupuestos
 */
import { useState, useMemo } from 'react';
import { useTheme, FONT, cardStyle, CANALES, calcNeto, semaforoColor } from '@/styles/tokens';
import { useRunningNuevo } from '@/hooks/useRunningNuevo';
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
  PieChart, Pie, LineChart, Line, CartesianGrid,
} from 'recharts';

/* ── Helpers ── */

const fmtEur = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

const TITULARES = [
  { id: null, label: 'Todos' },
  { id: '6ce69d55-60d0-423c-b68b-eb795a0f32fe', label: 'Rubén' },
  { id: 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354', label: 'Emilio' },
] as const;

const GRUPO_COLORS: Record<string, string> = {
  'Producto': '#B01D23', 'Equipo': '#1E5BCC', 'Alquiler': '#f5a623', 'Controlables': '#1D9E75', 'Otros': '#888',
};

function DeltaBadge({ value }: { value: number }) {
  const color = value > 0 ? '#1D9E75' : value < 0 ? '#B01D23' : '#7a8090';
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '–';
  return (
    <span style={{ fontSize: 11, color, fontFamily: FONT.body, fontWeight: 500 }}>
      {arrow} {fmtPct(value)} vs mes anterior
    </span>
  );
}

/* ── Página ── */

export default function RunningNuevo() {
  const { T, isDark } = useTheme();

  const [periodoDesde, setPeriodoDesde] = useState<Date>(() => {
    const h = new Date(); h.setDate(1); h.setHours(0, 0, 0, 0); return h;
  });
  const [periodoHasta, setPeriodoHasta] = useState<Date>(() => {
    const h = new Date(); h.setHours(23, 59, 59, 999); return h;
  });
  const [periodoLabel, setPeriodoLabel] = useState('Mes en curso');
  const [titularIdx, setTitularIdx] = useState(0);
  const [marcaId, setMarcaId] = useState<string | null>(null);

  const titularId = TITULARES[titularIdx].id;
  const d = useRunningNuevo(periodoDesde, periodoHasta, titularId, marcaId);

  /* Marcas desde facturación */
  const marcas = useMemo(() => {
    const set = new Map<string | null, boolean>();
    for (const f of d.facturacion) set.set(f.marca_id, true);
    return [null, ...Array.from(set.keys()).filter(Boolean)];
  }, [d.facturacion]);

  /* Datos para gráfico evolución diaria */
  const evolucionDiaria = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of d.facturacion) {
      let neto = 0;
      for (const canal of CANALES) {
        const bruto = Number((f as any)[canal.bruKey] || 0);
        const pedidos = Number((f as any)[canal.pedKey] || 0);
        if (bruto) neto += calcNeto(bruto, pedidos, canal);
      }
      map[f.fecha] = (map[f.fecha] || 0) + neto;
    }
    return Object.entries(map).sort().map(([fecha, neto]) => ({
      fecha: fecha.slice(5),
      neto: Math.round(neto),
    }));
  }, [d.facturacion]);

  const subtitulo = (() => {
    const fmt = (dt: Date) => {
      const dia = dt.getDate();
      const mes = dt.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
      return `${dia} ${mes} ${dt.getFullYear()}`;
    };
    return `${periodoLabel} · ${fmt(periodoDesde)} — ${fmt(periodoHasta)}`;
  })();

  if (d.error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{
          background: '#FCEBEB', border: '1px solid #B01D23', color: '#A32D2D',
          padding: 16, borderRadius: 8, fontFamily: FONT.body, fontSize: 13,
        }}>
          Error: {d.error}
        </div>
      </div>
    );
  }

  const primeCostColor = d.primeCostPct <= 60 ? '#1D9E75' : d.primeCostPct <= 70 ? '#f5a623' : '#B01D23';

  return (
    <div style={{ background: T.bg, padding: '24px 28px', minHeight: '100vh' }}>
      {/* ══ HEADER ══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 22, fontWeight: 600, color: '#B01D23', letterSpacing: 3, textTransform: 'uppercase' }}>
            RUNNING FINANCIERO
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.mut, marginTop: 2 }}>{subtitulo}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Titular */}
          <div style={{ display: 'flex', gap: 4 }}>
            {TITULARES.map((t, i) => (
              <button key={t.label} onClick={() => setTitularIdx(i)} style={{
                padding: '5px 12px', borderRadius: 6, border: 'none',
                background: i === titularIdx ? '#B01D23' : T.card,
                color: i === titularIdx ? '#fff' : T.sec,
                fontFamily: FONT.body, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>{t.label}</button>
            ))}
          </div>
          {/* Marca */}
          {marcas.length > 2 && (
            <div style={{ display: 'flex', gap: 4 }}>
              {marcas.map(m => (
                <button key={m || 'all'} onClick={() => setMarcaId(m)} style={{
                  padding: '5px 10px', borderRadius: 6, border: 'none',
                  background: marcaId === m ? '#1E5BCC' : T.card,
                  color: marcaId === m ? '#fff' : T.sec,
                  fontFamily: FONT.body, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                }}>{m || 'Todas'}</button>
              ))}
            </div>
          )}
          <SelectorFechaUniversal
            nombreModulo="running-nuevo"
            defaultOpcion="mes_en_curso"
            onChange={(desde, hasta, label) => { setPeriodoDesde(desde); setPeriodoHasta(hasta); setPeriodoLabel(label); }}
          />
        </div>
      </div>

      {d.loading && (
        <div style={{ textAlign: 'center', padding: 40, color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>Cargando…</div>
      )}

      {!d.loading && (
        <>
          {/* ══ FILA 1: 3 KPIs GRANDES ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
            <div style={{ ...cardStyle(T), padding: '20px 22px' }}>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 8 }}>INGRESOS NETOS</div>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 36, fontWeight: 600, color: '#1D9E75', lineHeight: 1 }}>{fmtEur(d.ingresosNeto)}</div>
              <div style={{ marginTop: 6 }}><DeltaBadge value={d.deltaIngresos} /></div>
              <div style={{ fontSize: 11, color: T.mut, fontFamily: FONT.body, marginTop: 4 }}>Bruto: {fmtEur(d.ingresosBruto)}</div>
            </div>
            <div style={{ ...cardStyle(T), padding: '20px 22px' }}>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 8 }}>GASTOS TOTALES</div>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 36, fontWeight: 600, color: '#B01D23', lineHeight: 1 }}>{fmtEur(d.totalGastos)}</div>
              <div style={{ marginTop: 6 }}><DeltaBadge value={d.deltaGastos} /></div>
            </div>
            <div style={{ ...cardStyle(T), padding: '20px 22px' }}>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 8 }}>RESULTADO</div>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 36, fontWeight: 600, color: d.resultado >= 0 ? '#1D9E75' : '#B01D23', lineHeight: 1 }}>{fmtEur(d.resultado)}</div>
              <div style={{ marginTop: 6 }}><DeltaBadge value={d.deltaResultado} /></div>
            </div>
          </div>

          {/* ══ FILA 2: PRIME COST + BREAK-EVEN + PROYECCIÓN ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
            <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>PRIME COST</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: 'Oswald,sans-serif', fontSize: 28, fontWeight: 600, color: primeCostColor }}>{d.primeCostPct.toFixed(1)}%</span>
                <span style={{ fontSize: 12, color: T.mut, fontFamily: FONT.body }}>{fmtEur(d.primeCost)}</span>
              </div>
              <div style={{ height: 6, background: T.brd, borderRadius: 3, marginTop: 10 }}>
                <div style={{ height: 6, borderRadius: 3, background: primeCostColor, width: `${Math.min(d.primeCostPct, 100)}%`, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: 11, color: T.mut, fontFamily: FONT.body, marginTop: 4 }}>
                Objetivo ≤60% · Producto {fmtEur(d.gastoProducto)} + RRHH {fmtEur(d.gastoRRHH)}
              </div>
            </div>

            <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>BREAK-EVEN</div>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 28, fontWeight: 600, color: d.breakEvenSuperado ? '#1D9E75' : '#f5a623' }}>{fmtEur(d.breakEven)}</div>
              <div style={{ fontSize: 12, fontFamily: FONT.body, fontWeight: 500, marginTop: 6, color: d.breakEvenSuperado ? '#1D9E75' : '#B01D23' }}>
                {d.breakEvenSuperado ? `✓ Superado por ${fmtEur(d.ingresosNeto - d.breakEven)}` : `✗ Faltan ${fmtEur(d.breakEven - d.ingresosNeto)}`}
              </div>
            </div>

            <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>PROYECCIÓN CIERRE MES</div>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 28, fontWeight: 600, color: T.pri }}>{fmtEur(d.proyeccion)}</div>
              <div style={{ fontSize: 11, color: T.mut, fontFamily: FONT.body, marginTop: 4 }}>Ritmo: {d.ritmoPct.toFixed(0)}% del break-even</div>
              <div style={{ height: 6, background: T.brd, borderRadius: 3, marginTop: 6 }}>
                <div style={{ height: 6, borderRadius: 3, background: semaforoColor(d.ritmoPct), width: `${Math.min(d.ritmoPct, 100)}%`, transition: 'width 0.5s' }} />
              </div>
            </div>
          </div>

          {/* ══ FILA 3: EVOLUCIÓN DIARIA ══ */}
          {evolucionDiaria.length > 1 && (
            <div style={{ ...cardStyle(T), padding: '18px 20px', marginBottom: 16 }}>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>EVOLUCIÓN DIARIA INGRESOS NETOS</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={evolucionDiaria} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.brd} />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10, fontFamily: FONT.body, fill: T.mut }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: FONT.body, fill: T.mut }} />
                  <Tooltip formatter={(v: any) => fmtEur(Number(v))} contentStyle={{ fontFamily: FONT.body, fontSize: 12 }} />
                  <Line type="monotone" dataKey="neto" stroke="#B01D23" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ══ FILA 4: CANALES + GASTOS DONUT ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>INGRESOS POR CANAL</div>
              {d.canales.length > 0 ? (
                <ResponsiveContainer width="100%" height={d.canales.length * 44 + 10}>
                  <BarChart data={d.canales.map(c => ({ ...c, neto: Math.round(c.neto) }))} layout="vertical" margin={{ left: 0, right: 10 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="canal" width={80} tick={{ fontSize: 12, fontFamily: FONT.body, fill: T.sec }} />
                    <Tooltip formatter={(v: any) => fmtEur(Number(v))} contentStyle={{ fontFamily: FONT.body, fontSize: 12 }} />
                    <Bar dataKey="neto" radius={[0, 4, 4, 0]} barSize={20}>
                      {d.canales.map((c, i) => <Cell key={i} fill={c.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ color: T.mut, fontSize: 12, padding: 20, textAlign: 'center', fontFamily: FONT.body }}>Sin datos</div>}
            </div>

            <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>GASTOS POR GRUPO</div>
              {d.gastosPorGrupo.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <ResponsiveContainer width="50%" height={160}>
                    <PieChart>
                      <Pie data={d.gastosPorGrupo.map(g => ({ name: g.grupo, value: Math.round(g.total) }))} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" stroke="none">
                        {d.gastosPorGrupo.map((g, i) => <Cell key={i} fill={GRUPO_COLORS[g.grupo] || '#888'} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmtEur(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1 }}>
                    {d.gastosPorGrupo.map(g => (
                      <div key={g.grupo} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 12, fontFamily: FONT.body }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: GRUPO_COLORS[g.grupo] || '#888', flexShrink: 0 }} />
                        <span style={{ color: T.sec, flex: 1 }}>{g.grupo}</span>
                        <span style={{ color: T.pri, fontWeight: 500 }}>{fmtEur(g.total)}</span>
                        <span style={{ color: T.mut, fontSize: 11 }}>{g.pct.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <div style={{ color: T.mut, fontSize: 12, padding: 20, textAlign: 'center', fontFamily: FONT.body }}>Sin datos</div>}
            </div>
          </div>

          {/* ══ FILA 5: TOP PROVEEDORES + TOP CATEGORÍAS ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>TOP 5 PROVEEDORES</div>
              {d.topProveedores.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT.body, fontSize: 13 }}>
                  <tbody>
                    {d.topProveedores.map((p, i) => (
                      <tr key={p.proveedor} style={{ borderBottom: `1px solid ${T.brd}` }}>
                        <td style={{ padding: '6px 4px', color: T.mut, width: 20 }}>{i + 1}</td>
                        <td style={{ padding: '6px 4px', color: T.pri }}>{p.proveedor}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', color: T.pri, fontWeight: 500 }}>{fmtEur(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div style={{ color: T.mut, fontSize: 12, padding: 12, textAlign: 'center' }}>Sin datos</div>}
            </div>
            <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>TOP 5 CATEGORÍAS GASTO</div>
              {d.topCategorias.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT.body, fontSize: 13 }}>
                  <tbody>
                    {d.topCategorias.map((c, i) => (
                      <tr key={c.categoria} style={{ borderBottom: `1px solid ${T.brd}` }}>
                        <td style={{ padding: '6px 4px', color: T.mut, width: 20 }}>{i + 1}</td>
                        <td style={{ padding: '6px 4px', color: T.pri }}>{c.categoria}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', color: T.pri, fontWeight: 500 }}>{fmtEur(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div style={{ color: T.mut, fontSize: 12, padding: 12, textAlign: 'center' }}>Sin datos</div>}
            </div>
          </div>

          {/* ══ FILA 6: COMPARATIVA + YTD ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>ACTUAL VS ANTERIOR</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[
                  { name: 'Ingresos', actual: Math.round(d.ingresosNeto), anterior: Math.round(d.antIngresosNeto) },
                  { name: 'Gastos', actual: Math.round(d.totalGastos), anterior: Math.round(d.antGastos) },
                  { name: 'Resultado', actual: Math.round(d.resultado), anterior: Math.round(d.antResultado) },
                ]} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: FONT.body, fill: T.sec }} />
                  <YAxis tick={{ fontSize: 11, fontFamily: FONT.body, fill: T.mut }} />
                  <Tooltip formatter={(v: any) => fmtEur(Number(v))} contentStyle={{ fontFamily: FONT.body, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12, fontFamily: FONT.body }} />
                  <Bar dataKey="actual" name="Actual" fill="#B01D23" radius={[4, 4, 0, 0]} barSize={28} />
                  <Bar dataKey="anterior" name="Anterior" fill="#d0c8bc" radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>ACUMULADO AÑO (YTD)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: T.mut, fontFamily: FONT.body, marginBottom: 2 }}>Ingresos</div>
                  <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 24, fontWeight: 600, color: '#1D9E75' }}>{fmtEur(d.ytdIngresos)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: T.mut, fontFamily: FONT.body, marginBottom: 2 }}>Gastos</div>
                  <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 24, fontWeight: 600, color: '#B01D23' }}>{fmtEur(d.ytdGastos)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: T.mut, fontFamily: FONT.body, marginBottom: 2 }}>Resultado</div>
                  <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 24, fontWeight: 600, color: d.ytdResultado >= 0 ? '#1D9E75' : '#B01D23' }}>{fmtEur(d.ytdResultado)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ══ FILA 7: DESGLOSE POR CANAL (tabla) ══ */}
          {d.canales.length > 0 && (
            <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>DESGLOSE POR CANAL</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT.body, fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${T.brd}` }}>
                    <th style={{ textAlign: 'left', padding: '8px 6px', color: T.mut, fontWeight: 500, fontSize: 11 }}>Canal</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', color: T.mut, fontWeight: 500, fontSize: 11 }}>Bruto</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', color: T.mut, fontWeight: 500, fontSize: 11 }}>Pedidos</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', color: T.mut, fontWeight: 500, fontSize: 11 }}>Comisiones</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', color: T.mut, fontWeight: 500, fontSize: 11 }}>Neto</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', color: T.mut, fontWeight: 500, fontSize: 11 }}>% Total</th>
                  </tr>
                </thead>
                <tbody>
                  {d.canales.map(c => (
                    <tr key={c.canal} style={{ borderBottom: `1px solid ${T.brd}` }}>
                      <td style={{ padding: '8px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                        {c.canal}
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 6px', color: T.pri }}>{fmtEur(c.bruto)}</td>
                      <td style={{ textAlign: 'right', padding: '8px 6px', color: T.sec }}>{c.pedidos}</td>
                      <td style={{ textAlign: 'right', padding: '8px 6px', color: '#B01D23' }}>{fmtEur(c.comisiones)}</td>
                      <td style={{ textAlign: 'right', padding: '8px 6px', color: '#1D9E75', fontWeight: 500 }}>{fmtEur(c.neto)}</td>
                      <td style={{ textAlign: 'right', padding: '8px 6px', color: T.sec }}>
                        {d.ingresosBruto > 0 ? ((c.bruto / d.ingresosBruto) * 100).toFixed(1) + '%' : '–'}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: `2px solid ${T.brd}`, fontWeight: 600 }}>
                    <td style={{ padding: '8px 6px', color: T.pri }}>TOTAL</td>
                    <td style={{ textAlign: 'right', padding: '8px 6px', color: T.pri }}>{fmtEur(d.ingresosBruto)}</td>
                    <td style={{ textAlign: 'right', padding: '8px 6px', color: T.sec }}>{d.canales.reduce((s, c) => s + c.pedidos, 0)}</td>
                    <td style={{ textAlign: 'right', padding: '8px 6px', color: '#B01D23' }}>{fmtEur(d.canales.reduce((s, c) => s + c.comisiones, 0))}</td>
                    <td style={{ textAlign: 'right', padding: '8px 6px', color: '#1D9E75' }}>{fmtEur(d.ingresosNeto)}</td>
                    <td style={{ textAlign: 'right', padding: '8px 6px', color: T.sec }}>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
