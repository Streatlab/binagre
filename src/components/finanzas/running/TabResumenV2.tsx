/**
 * TabResumenV2 — Running V2 tab Resumen
 * 3 KPIs grandes + Prime Cost + Break-even + Proyección + Ingresos por plataforma + Gastos donut + YTD
 */
import { useTheme, FONT, cardStyle, semaforoColor } from '@/styles/tokens';
import type { RunningV2State } from '@/hooks/useRunningV2';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts';

const fmtEur = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

function DeltaBadge({ value }: { value: number }) {
  const color = value > 0 ? '#1D9E75' : value < 0 ? '#B01D23' : '#7a8090';
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '–';
  return (
    <span style={{ fontSize: 12, color, fontFamily: FONT.body, fontWeight: 500 }}>
      {arrow} {fmtPct(value)} vs anterior
    </span>
  );
}

interface Props {
  data: RunningV2State;
}

export default function TabResumenV2({ data }: Props) {
  const { T } = useTheme();
  const c = data.calc;

  const PLAT_COLORS: Record<string, string> = {
    'Uber Eats': '#06C167', 'Glovo': '#e8f442', 'Just Eat': '#f5a623', 'Web': '#B01D23', 'Directa': '#66aaff',
  };

  const platData = c.ingresosPorPlataforma.map(p => ({
    name: p.canal,
    neto: Math.round(p.neto),
    bruto: Math.round(p.bruto),
    color: PLAT_COLORS[p.canal] || '#888',
  }));

  const donutData = c.gastosPorGrupo.map(g => ({
    name: g.grupo,
    value: Math.round(g.total),
  }));
  const GRUPO_COLORS: Record<string, string> = {
    'Producto': '#B01D23', 'Equipo': '#1E5BCC', 'Alquiler': '#f5a623', 'Controlables': '#1D9E75',
  };

  const primeCostColor = c.primeCostPct <= 60 ? '#1D9E75' : c.primeCostPct <= 70 ? '#f5a623' : '#B01D23';
  const beStatus = c.ingresosNeto >= c.breakEven;

  return (
    <div style={{ marginTop: 18 }}>
      {/* KPIs grandes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        {/* Ingresos netos */}
        <div style={{ ...cardStyle(T), padding: '20px 22px' }}>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 8 }}>
            INGRESOS NETOS
          </div>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 36, fontWeight: 600, color: '#1D9E75', lineHeight: 1 }}>
            {fmtEur(c.ingresosNeto)}
          </div>
          <div style={{ marginTop: 6 }}><DeltaBadge value={c.deltaIngresos} /></div>
          <div style={{ fontSize: 11, color: T.mut, fontFamily: FONT.body, marginTop: 4 }}>
            Bruto: {fmtEur(c.ingresosBruto)}
          </div>
        </div>

        {/* Gastos */}
        <div style={{ ...cardStyle(T), padding: '20px 22px' }}>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 8 }}>
            GASTOS
          </div>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 36, fontWeight: 600, color: '#B01D23', lineHeight: 1 }}>
            {fmtEur(c.totalGastos)}
          </div>
          <div style={{ marginTop: 6 }}><DeltaBadge value={c.deltaGastos} /></div>
        </div>

        {/* Resultado */}
        <div style={{ ...cardStyle(T), padding: '20px 22px' }}>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 8 }}>
            RESULTADO
          </div>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 36, fontWeight: 600, color: c.resultado >= 0 ? '#1D9E75' : '#B01D23', lineHeight: 1 }}>
            {fmtEur(c.resultado)}
          </div>
          <div style={{ marginTop: 6 }}><DeltaBadge value={c.deltaResultado} /></div>
        </div>
      </div>

      {/* Prime Cost + Break-even + Proyección */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        {/* Prime Cost */}
        <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>
            PRIME COST
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: 'Oswald,sans-serif', fontSize: 28, fontWeight: 600, color: primeCostColor }}>
              {c.primeCostPct.toFixed(1)}%
            </span>
            <span style={{ fontSize: 12, color: T.mut, fontFamily: FONT.body }}>
              {fmtEur(c.primeCost)}
            </span>
          </div>
          <div style={{ height: 6, background: T.brd, borderRadius: 3, marginTop: 10 }}>
            <div style={{
              height: 6, borderRadius: 3, background: primeCostColor,
              width: `${Math.min(c.primeCostPct / 100 * 100, 100)}%`,
              transition: 'width 0.5s',
            }} />
          </div>
          <div style={{ fontSize: 11, color: T.mut, fontFamily: FONT.body, marginTop: 4 }}>
            Objetivo: ≤60% · Producto {fmtEur(c.gastoProducto)} + RRHH {fmtEur(c.gastoRRHH)}
          </div>
        </div>

        {/* Break-even */}
        <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>
            BREAK-EVEN
          </div>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 28, fontWeight: 600, color: beStatus ? '#1D9E75' : '#f5a623' }}>
            {fmtEur(c.breakEven)}
          </div>
          <div style={{
            fontSize: 12, fontFamily: FONT.body, fontWeight: 500, marginTop: 6,
            color: beStatus ? '#1D9E75' : '#B01D23',
          }}>
            {beStatus
              ? `✓ Superado por ${fmtEur(c.ingresosNeto - c.breakEven)}`
              : `✗ Faltan ${fmtEur(c.breakEven - c.ingresosNeto)}`
            }
          </div>
        </div>

        {/* Proyección cierre mes */}
        <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>
            PROYECCIÓN CIERRE MES
          </div>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 28, fontWeight: 600, color: T.pri }}>
            {fmtEur(c.proyeccion)}
          </div>
          <div style={{ fontSize: 11, color: T.mut, fontFamily: FONT.body, marginTop: 4 }}>
            Ritmo: {c.ritmo.pct.toFixed(0)}% del break-even
          </div>
          <div style={{ height: 6, background: T.brd, borderRadius: 3, marginTop: 6 }}>
            <div style={{
              height: 6, borderRadius: 3,
              background: semaforoColor(c.ritmo.pct),
              width: `${Math.min(c.ritmo.pct, 100)}%`,
              transition: 'width 0.5s',
            }} />
          </div>
        </div>
      </div>

      {/* Ingresos por plataforma + Gastos donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        {/* Barras plataforma */}
        <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>
            INGRESOS POR PLATAFORMA (NETO)
          </div>
          {platData.length > 0 ? (
            <ResponsiveContainer width="100%" height={platData.length * 44 + 10}>
              <BarChart data={platData} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12, fontFamily: 'Lexend,sans-serif', fill: T.sec }} />
                <Tooltip
                  formatter={(v: number) => fmtEur(v)}
                  contentStyle={{ fontFamily: 'Lexend,sans-serif', fontSize: 12 }}
                />
                <Bar dataKey="neto" radius={[0, 4, 4, 0]} barSize={20}>
                  {platData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: T.mut, fontSize: 12, fontFamily: FONT.body, padding: 20, textAlign: 'center' }}>
              Sin datos de facturación en este periodo
            </div>
          )}
        </div>

        {/* Donut gastos */}
        <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>
            DISTRIBUCIÓN GASTOS
          </div>
          {donutData.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%" cy="50%"
                    innerRadius={40} outerRadius={65}
                    dataKey="value"
                    stroke="none"
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={GRUPO_COLORS[entry.name] || '#888'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtEur(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {donutData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 12, fontFamily: FONT.body }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: GRUPO_COLORS[d.name] || '#888', flexShrink: 0 }} />
                    <span style={{ color: T.sec, flex: 1 }}>{d.name}</span>
                    <span style={{ color: T.pri, fontWeight: 500 }}>{fmtEur(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: T.mut, fontSize: 12, fontFamily: FONT.body, padding: 20, textAlign: 'center' }}>
              Sin gastos en este periodo
            </div>
          )}
        </div>
      </div>

      {/* YTD */}
      <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
        <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>
          ACUMULADO AÑO (YTD)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: T.mut, fontFamily: FONT.body, marginBottom: 2 }}>Ingresos</div>
            <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 22, fontWeight: 600, color: '#1D9E75' }}>{fmtEur(c.ytdIngresos)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.mut, fontFamily: FONT.body, marginBottom: 2 }}>Gastos</div>
            <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 22, fontWeight: 600, color: '#B01D23' }}>{fmtEur(c.ytdGastos)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.mut, fontFamily: FONT.body, marginBottom: 2 }}>Resultado</div>
            <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 22, fontWeight: 600, color: c.ytdResultado >= 0 ? '#1D9E75' : '#B01D23' }}>
              {fmtEur(c.ytdResultado)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
