/**
 * TabComparativas — Running V2
 * Mes actual vs anterior, YTD, top proveedores, top categorías
 */
import { useTheme, FONT } from '@/styles/tokens';
import type { RunningV2State } from '@/hooks/useRunningV2';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
  data: RunningV2State;
}

function fmtEur(v: number): string {
  if (!v || isNaN(v)) return '0 €';
  return Math.round(v).toLocaleString('es-ES') + ' €';
}

export default function TabComparativas({ data }: Props) {
  const { T } = useTheme();
  const { calc, calcAnt, topProveedores, topCategorias } = data;

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
    marginBottom: 14,
    textTransform: 'uppercase',
  };

  const compData = [
    { name: 'Ingresos', actual: calc.ingresosNeto, anterior: calcAnt?.ingresosNeto || 0 },
    { name: 'Gastos', actual: calc.totalGastos, anterior: calcAnt?.totalGastos || 0 },
    { name: 'Resultado', actual: calc.resultado, anterior: calcAnt?.resultado || 0 },
  ];

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={labelStyle}>Mes actual vs anterior</div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={compData} margin={{ left: 0, right: 20 }}>
            <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: 'Lexend' }} />
            <YAxis tick={{ fontSize: 10, fontFamily: 'Lexend' }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
            <Tooltip
              formatter={(v: number) => fmtEur(v)}
              contentStyle={{ fontFamily: 'Lexend', fontSize: 12, borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontFamily: 'Lexend', fontSize: 11 }} />
            <Bar dataKey="actual" name="Mes actual" fill="#B01D23" radius={[4, 4, 0, 0]} barSize={28} />
            <Bar dataKey="anterior" name="Mes anterior" fill="#d0c8bc" radius={[4, 4, 0, 0]} barSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={labelStyle}>Acumulado Year-to-Date</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: T.mut, marginBottom: 4 }}>Ingresos YTD</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1D9E75', fontFamily: 'Lexend' }}>{fmtEur(calc.ytdIngresos)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.mut, marginBottom: 4 }}>Gastos YTD</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#B01D23', fontFamily: 'Lexend' }}>{fmtEur(calc.ytdGastos)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.mut, marginBottom: 4 }}>Resultado YTD</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: calc.ytdResultado >= 0 ? '#1D9E75' : '#B01D23', fontFamily: 'Lexend' }}>
              {calc.ytdResultado >= 0 ? '+' : ''}{fmtEur(calc.ytdResultado)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
        className="rv2-top-row">
        <div style={cardStyle}>
          <div style={labelStyle}>Top 5 proveedores por gasto</div>
          {topProveedores.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Lexend', fontSize: 12 }}>
              <tbody>
                {topProveedores.map((p, i) => (
                  <tr key={p.proveedor} style={{ borderBottom: `1px solid ${T.brd}` }}>
                    <td style={{ padding: '8px 4px', color: T.mut, width: 24, textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ padding: '8px 4px', color: T.pri }}>{p.proveedor}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600, color: T.pri }}>{fmtEur(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: T.mut, fontSize: 12, textAlign: 'center', padding: 16 }}>Sin datos</div>
          )}
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Top 5 categorías por gasto</div>
          {topCategorias.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Lexend', fontSize: 12 }}>
              <tbody>
                {topCategorias.map((c, i) => (
                  <tr key={c.categoria} style={{ borderBottom: `1px solid ${T.brd}` }}>
                    <td style={{ padding: '8px 4px', color: T.mut, width: 24, textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ padding: '8px 4px', color: T.pri }}>{c.categoria}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600, color: T.pri }}>{fmtEur(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: T.mut, fontSize: 12, textAlign: 'center', padding: 16 }}>Sin datos</div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .rv2-top-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
