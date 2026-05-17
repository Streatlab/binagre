/**
 * TabResumenV2 — Running V2 tab resumen
 * 3 KPIs + Prime Cost + Break-even + Proyección + Ritmo + Desglose plataformas + Donut gastos
 */
import { useTheme, FONT } from '@/styles/tokens';
import type { RunningV2State } from '@/hooks/useRunningV2';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface Props {
  data: RunningV2State;
}

function fmtEur(v: number): string {
  if (!v || isNaN(v)) return '0 €';
  return Math.round(v).toLocaleString('es-ES') + ' €';
}

function fmtPct(v: number): string {
  return Math.round(v) + '%';
}

function DeltaBadge({ value }: { value: number }) {
  const sign = value >= 0 ? '+' : '';
  const color = value >= 0 ? '#1D9E75' : '#B01D23';
  const arrow = value >= 0 ? '▲' : '▼';
  return (
    <span style={{ fontSize: 12, color, fontWeight: 500 }}>
      {arrow} {sign}{Math.round(value)}% vs anterior
    </span>
  );
}

const COLORES_PLAT: Record<string, string> = {
  'Uber Eats': '#06C167',
  'Glovo': '#e8f442',
  'Just Eat': '#f5a623',
  'Web': '#B01D23',
  'Directa': '#66aaff',
};

const COLORES_GASTO: Record<string, string> = {
  'Producto': '#7B4F2A',
  'Equipo': '#4A5980',
  'Alquiler': '#5A8A6F',
  'Controlables': '#A87C3D',
};

export default function TabResumenV2({ data }: Props) {
  const { T } = useTheme();
  const { calc } = data;

  const cardStyle: React.CSSProperties = {
    background: T.card,
    border: `1px solid ${T.brd}`,
    borderRadius: 16,
    padding: 24,
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'Oswald, sans-serif',
    fontSize: 11,
    letterSpacing: '0.14em',
    color: T.mut,
    fontWeight: 500,
    marginBottom: 10,
    textTransform: 'uppercase',
  };

  const bigNumStyle = (color?: string): React.CSSProperties => ({
    fontFamily: 'Lexend, sans-serif',
    fontSize: 36,
    fontWeight: 700,
    color: color || T.pri,
    lineHeight: 1,
    marginBottom: 6,
    letterSpacing: '-0.02em',
  });

  const platData = calc.ingresosPorPlataforma.map(p => ({
    name: p.canal,
    value: p.neto,
    fill: COLORES_PLAT[p.canal] || '#888',
  }));

  const gastoGrupos = [
    { name: 'Producto', value: calc.gastoProducto },
    { name: 'Equipo', value: calc.gastoRRHH },
    { name: 'Alquiler', value: calc.gastoAlquiler },
    { name: 'Controlables', value: calc.gastoControlables },
  ].filter(g => g.value > 0);

  const primeCostColor = calc.primeCostPct <= 60 ? '#1D9E75' : calc.primeCostPct <= 65 ? '#f5a623' : '#B01D23';

  return (
    <div style={{ marginTop: 18 }}>
      {/* 3 KPI CARDS GRANDES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>Ingresos netos</div>
          <div style={bigNumStyle('#1D9E75')}>{fmtEur(calc.ingresosNeto)}</div>
          <DeltaBadge value={calc.deltaIngresos} />
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Total gastos</div>
          <div style={bigNumStyle('#B01D23')}>{fmtEur(calc.totalGastos)}</div>
          <DeltaBadge value={calc.deltaGastos} />
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Resultado neto</div>
          <div style={bigNumStyle(calc.resultado >= 0 ? '#1D9E75' : '#B01D23')}>
            {calc.resultado >= 0 ? '+' : ''}{fmtEur(calc.resultado)}
          </div>
          <DeltaBadge value={calc.deltaResultado} />
        </div>
      </div>

      {/* SEGUNDA FILA: Prime Cost + Break-even + Proyección */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>Prime Cost (Producto + RRHH)</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ ...bigNumStyle(primeCostColor), fontSize: 32 }}>{fmtPct(calc.primeCostPct)}</span>
            <span style={{ fontSize: 12, color: T.mut }}>obj. &lt;60%</span>
          </div>
          <div style={{
            height: 6, background: T.brd, borderRadius: 3, marginTop: 10, overflow: 'hidden',
          }}>
            <div style={{
              height: 6, width: `${Math.min(calc.primeCostPct, 100)}%`,
              background: primeCostColor, borderRadius: 3, transition: 'width 0.5s',
            }} />
          </div>
          <div style={{ fontSize: 11, color: T.mut, marginTop: 6 }}>
            {fmtEur(calc.primeCost)} de {fmtEur(calc.ingresosNeto)}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Break-even mensual</div>
          <div style={{ ...bigNumStyle(), fontSize: 28 }}>{fmtEur(calc.breakEven)}</div>
          <div style={{ fontSize: 11, color: T.mut, marginTop: 4 }}>
            Necesitas vender esto para cubrir fijos
          </div>
          {calc.ingresosNeto > 0 && (
            <div style={{
              fontSize: 12, fontWeight: 500, marginTop: 6,
              color: calc.ingresosNeto >= calc.breakEven ? '#1D9E75' : '#B01D23',
            }}>
              {calc.ingresosNeto >= calc.breakEven
                ? `✓ Superado por ${fmtEur(calc.ingresosNeto - calc.breakEven)}`
                : `✗ Faltan ${fmtEur(calc.breakEven - calc.ingresosNeto)}`}
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Proyección cierre mes</div>
          <div style={{ ...bigNumStyle(), fontSize: 28 }}>{fmtEur(calc.proyeccion)}</div>
          <div style={{ fontSize: 11, color: T.mut, marginTop: 4 }}>
            A ritmo actual, cerrarás el mes con estos ingresos netos
          </div>
        </div>
      </div>

      {/* TERCERA FILA: Ingresos por plataforma + Donut gastos */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}
        className="rv2-charts-row">
        <div style={cardStyle}>
          <div style={labelStyle}>Ingresos netos por plataforma</div>
          {platData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={platData} layout="vertical" margin={{ left: 0, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name" type="category" width={90} tick={{ fontSize: 11, fontFamily: 'Lexend' }}
                />
                <Tooltip
                  formatter={(v: number) => fmtEur(v)}
                  contentStyle={{ fontFamily: 'Lexend', fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                  {platData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: T.mut, fontSize: 12, padding: 24, textAlign: 'center' }}>Sin datos</div>
          )}
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Distribución gastos</div>
          {gastoGrupos.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={gastoGrupos}
                    cx="50%" cy="50%"
                    innerRadius={40} outerRadius={65}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {gastoGrupos.map((g, i) => (
                      <Cell key={i} fill={COLORES_GASTO[g.name] || '#888'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => fmtEur(v)}
                    contentStyle={{ fontFamily: 'Lexend', fontSize: 12, borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 }}>
                {gastoGrupos.map(g => (
                  <div key={g.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: T.sec }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: COLORES_GASTO[g.name] || '#888' }} />
                    {g.name}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: T.mut, fontSize: 12, padding: 24, textAlign: 'center' }}>Sin datos</div>
          )}
        </div>
      </div>

      {/* YTD */}
      <div style={{
        ...cardStyle, display: 'flex', gap: 32, flexWrap: 'wrap', padding: '16px 24px',
      }}>
        <div>
          <div style={{ ...labelStyle, marginBottom: 4 }}>Acumulado YTD</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: T.mut }}>Ingresos</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1D9E75', fontFamily: 'Lexend' }}>{fmtEur(calc.ytdIngresos)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: T.mut }}>Gastos</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#B01D23', fontFamily: 'Lexend' }}>{fmtEur(calc.ytdGastos)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: T.mut }}>Resultado</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: calc.ytdResultado >= 0 ? '#1D9E75' : '#B01D23', fontFamily: 'Lexend' }}>
            {calc.ytdResultado >= 0 ? '+' : ''}{fmtEur(calc.ytdResultado)}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .rv2-charts-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
