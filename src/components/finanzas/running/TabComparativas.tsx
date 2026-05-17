/**
 * TabComparativas — Running V2 tab Comparativas
 * Barras actual vs anterior, YTD grid, Top proveedores, Top categorías
 */
import { useTheme, FONT, cardStyle } from '@/styles/tokens';
import type { RunningV2State } from '@/hooks/useRunningV2';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const fmtEur = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });

interface Props {
  data: RunningV2State;
}

export default function TabComparativas({ data }: Props) {
  const { T } = useTheme();
  const c = data.calc;
  const ca = data.calcAnt;

  const barData = [
    { name: 'Ingresos', actual: Math.round(c.ingresosNeto), anterior: Math.round(ca?.ingresosNeto || 0) },
    { name: 'Gastos', actual: Math.round(c.totalGastos), anterior: Math.round(ca?.totalGastos || 0) },
    { name: 'Resultado', actual: Math.round(c.resultado), anterior: Math.round(ca?.resultado || 0) },
  ];

  return (
    <div style={{ marginTop: 18 }}>
      {/* Barras actual vs anterior */}
      <div style={{ ...cardStyle(T), padding: '18px 20px', marginBottom: 20 }}>
        <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>
          ACTUAL VS PERIODO ANTERIOR
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={barData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
            <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: 'Lexend,sans-serif', fill: T.sec }} />
            <YAxis tick={{ fontSize: 11, fontFamily: 'Lexend,sans-serif', fill: T.mut }} />
            <Tooltip formatter={(v: any) => fmtEur(Number(v))} contentStyle={{ fontFamily: 'Lexend,sans-serif', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Lexend,sans-serif' }} />
            <Bar dataKey="actual" name="Actual" fill="#B01D23" radius={[4, 4, 0, 0]} barSize={28} />
            <Bar dataKey="anterior" name="Anterior" fill="#d0c8bc" radius={[4, 4, 0, 0]} barSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* YTD grid */}
      <div style={{ ...cardStyle(T), padding: '18px 20px', marginBottom: 20 }}>
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

      {/* Top proveedores + Top categorías */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>
            TOP 5 PROVEEDORES
          </div>
          {data.topProveedores.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT.body, fontSize: 13 }}>
              <tbody>
                {data.topProveedores.map((p, i) => (
                  <tr key={p.proveedor} style={{ borderBottom: `1px solid ${T.brd}` }}>
                    <td style={{ padding: '6px 4px', color: T.mut, width: 20 }}>{i + 1}</td>
                    <td style={{ padding: '6px 4px', color: T.pri }}>{p.proveedor}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right', color: T.pri, fontWeight: 500 }}>{fmtEur(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: T.mut, fontSize: 12, padding: 12, textAlign: 'center' }}>Sin datos</div>
          )}
        </div>

        <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>
            TOP 5 CATEGORÍAS GASTO
          </div>
          {data.topCategorias.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT.body, fontSize: 13 }}>
              <tbody>
                {data.topCategorias.map((cat, i) => (
                  <tr key={cat.categoria} style={{ borderBottom: `1px solid ${T.brd}` }}>
                    <td style={{ padding: '6px 4px', color: T.mut, width: 20 }}>{i + 1}</td>
                    <td style={{ padding: '6px 4px', color: T.pri }}>{cat.categoria}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right', color: T.pri, fontWeight: 500 }}>{fmtEur(cat.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: T.mut, fontSize: 12, padding: 12, textAlign: 'center' }}>Sin datos</div>
          )}
        </div>
      </div>
    </div>
  );
}
