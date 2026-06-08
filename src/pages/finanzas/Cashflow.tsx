import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/styles/tokens';
import { ArrowDownCircle, ArrowUpCircle, TrendingUp } from 'lucide-react';

interface Cobro {
  canal: string;
  fecha: string;
  cantidad: number;
  color: string;
}

interface Pago {
  concepto: string;
  fecha: string;
  cantidad: number;
  canal: string;
  color: string;
}

const COLORES_CANAL: Record<string, string> = {
  'Uber Eats': '#06C167',
  'Glovo': '#aabc00',
  'Just Eat': '#f5a623',
  'Web Propia': '#ff6b70',
  'Venta Directa': '#66aaff',
};

const fmtEur = (n: number) => {
  return n.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: 'currency',
    currency: 'EUR'
  });
};

export default function Cashflow() {
  const { T } = useTheme();
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const { data: factDatos } = await supabase
          .from('facturacion_diario')
          .select('fecha, uber_bruto, glovo_bruto, je_bruto, web_bruto, directa_bruto')
          .gte('fecha', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('fecha', { ascending: false });

        const { data: configCanales } = await supabase
          .from('config_canales')
          .select('canal, comision_pct, fee_periodo_eur, fee_periodicidad, fee_prime_eur, fee_promo_eur');

        if (factDatos) {
          const cobrosPorFecha: Record<string, Cobro> = {};

          for (const row of factDatos) {
            const fecha = row.fecha;
            const canales = [
              { nombre: 'Uber Eats', monto: parseFloat(row.uber_bruto || '0') },
              { nombre: 'Glovo', monto: parseFloat(row.glovo_bruto || '0') },
              { nombre: 'Just Eat', monto: parseFloat(row.je_bruto || '0') },
              { nombre: 'Web Propia', monto: parseFloat(row.web_bruto || '0') },
              { nombre: 'Venta Directa', monto: parseFloat(row.directa_bruto || '0') },
            ];

            for (const c of canales) {
              if (c.monto > 0) {
                const key = `${fecha}-${c.nombre}`;
                cobrosPorFecha[key] = {
                  canal: c.nombre,
                  fecha,
                  cantidad: c.monto,
                  color: COLORES_CANAL[c.nombre] || '#cccccc',
                };
              }
            }
          }

          setCobros(Object.values(cobrosPorFecha).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()));
        }

        if (configCanales) {
          const pagosCalculados: Pago[] = [];
          const hoy = new Date();

          for (const config of configCanales) {
            const canal = config.canal;
            const color = COLORES_CANAL[canal] || '#cccccc';
            const comision = parseFloat(config.comision_pct || '0');
            const fee = parseFloat(config.fee_periodo_eur || '0');

            if (canal === 'Uber Eats') {
              pagosCalculados.push({
                concepto: 'Comisión semanal',
                fecha: new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                cantidad: 2.29 * 4,
                canal,
                color,
              });
            } else if (canal === 'Glovo') {
              pagosCalculados.push({
                concepto: 'Fee quincenal',
                fecha: new Date(hoy.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                cantidad: 10,
                canal,
                color,
              });
            }
          }

          setPagos(pagosCalculados);
        }

        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    cargarDatos();
  }, []);

  const totalCobros = useMemo(() => cobros.reduce((sum, c) => sum + c.cantidad, 0), [cobros]);
  const totalPagos = useMemo(() => pagos.reduce((sum, p) => sum + p.cantidad, 0), [pagos]);
  const saldo = totalCobros - totalPagos;

  return (
    <div style={{ background: T.bg, padding: '24px 28px', minHeight: '100vh' }}>
      <div style={{
        fontFamily: 'Oswald, sans-serif',
        fontSize: 22,
        fontWeight: 600,
        color: '#B01D23',
        letterSpacing: 3,
        textTransform: 'uppercase',
        marginBottom: 4,
      }}>
        CASH FLOW
      </div>
      <div style={{
        fontFamily: 'Lexend, sans-serif',
        fontSize: 13,
        color: T.mut,
        marginBottom: 24,
      }}>
        Previsión de tesorería
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: T.sec }}>Cargando datos...</div>
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 32,
          }}>
            <div style={{
              background: T.card,
              border: `1px solid ${T.brd}`,
              borderRadius: 12,
              padding: 20,
            }}>
              <div style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: 11,
                color: T.mut,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                marginBottom: 8,
              }}>Cobros Pendientes</div>
              <div style={{
                fontFamily: 'Lexend, sans-serif',
                fontSize: 28,
                fontWeight: 700,
                color: '#06C167',
                lineHeight: 1,
              }}>{fmtEur(totalCobros)}</div>
            </div>

            <div style={{
              background: T.card,
              border: `1px solid ${T.brd}`,
              borderRadius: 12,
              padding: 20,
            }}>
              <div style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: 11,
                color: T.mut,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                marginBottom: 8,
              }}>Pagos Pendientes</div>
              <div style={{
                fontFamily: 'Lexend, sans-serif',
                fontSize: 28,
                fontWeight: 700,
                color: '#B01D23',
                lineHeight: 1,
              }}>{fmtEur(totalPagos)}</div>
            </div>

            <div style={{
              background: T.card,
              border: `1px solid ${saldo >= 0 ? '#06C167' : '#B01D23'}33`,
              borderRadius: 12,
              padding: 20,
            }}>
              <div style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: 11,
                color: T.mut,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                marginBottom: 8,
              }}>Saldo Neto</div>
              <div style={{
                fontFamily: 'Lexend, sans-serif',
                fontSize: 28,
                fontWeight: 700,
                color: saldo >= 0 ? '#06C167' : '#B01D23',
                lineHeight: 1,
              }}>{fmtEur(saldo)}</div>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 24,
            marginBottom: 24,
          }}>
            <div style={{
              background: T.card,
              border: `1px solid ${T.brd}`,
              borderRadius: 12,
              padding: '24px 20px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
                fontFamily: 'Oswald, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: '#06C167',
              }}>
                <ArrowDownCircle size={20} />
                Cobros Pendientes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {cobros.slice(0, 10).map((c, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    background: T.bg,
                    borderRadius: 8,
                    borderLeft: `3px solid ${c.color}`,
                  }}>
                    <div>
                      <div style={{
                        fontFamily: 'Oswald, sans-serif',
                        fontSize: 11,
                        fontWeight: 600,
                        color: c.color,
                        textTransform: 'uppercase',
                      }}>{c.canal}</div>
                      <div style={{
                        fontFamily: 'Lexend, sans-serif',
                        fontSize: 12,
                        color: T.mut,
                        marginTop: 2,
                      }}>{c.fecha}</div>
                    </div>
                    <div style={{
                      fontFamily: 'Lexend, sans-serif',
                      fontSize: 12,
                      fontWeight: 600,
                      color: c.color,
                    }}>{fmtEur(c.cantidad)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              background: T.card,
              border: `1px solid ${T.brd}`,
              borderRadius: 12,
              padding: '24px 20px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
                fontFamily: 'Oswald, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: '#B01D23',
              }}>
                <ArrowUpCircle size={20} />
                Pagos Pendientes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pagos.map((p, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    background: T.bg,
                    borderRadius: 8,
                    borderLeft: `3px solid ${p.color}`,
                  }}>
                    <div>
                      <div style={{
                        fontFamily: 'Oswald, sans-serif',
                        fontSize: 11,
                        fontWeight: 600,
                        color: p.color,
                        textTransform: 'uppercase',
                      }}>{p.canal}</div>
                      <div style={{
                        fontFamily: 'Lexend, sans-serif',
                        fontSize: 12,
                        color: T.mut,
                        marginTop: 2,
                      }}>{p.concepto} · {p.fecha}</div>
                    </div>
                    <div style={{
                      fontFamily: 'Lexend, sans-serif',
                      fontSize: 12,
                      fontWeight: 600,
                      color: p.color,
                    }}>{fmtEur(p.cantidad)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{
            background: T.card,
            border: `1px solid ${T.brd}`,
            borderRadius: 12,
            padding: '24px 20px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
              fontFamily: 'Oswald, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: T.sec,
            }}>
              <TrendingUp size={20} />
              Cruce de Flujos
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 16,
              fontSize: 12,
              fontFamily: 'Lexend, sans-serif',
            }}>
              <div>Total Cobros Pendientes:</div>
              <div style={{ fontWeight: 600, color: '#06C167' }}>{fmtEur(totalCobros)}</div>

              <div>Total Pagos Pendientes:</div>
              <div style={{ fontWeight: 600, color: '#B01D23' }}>-{fmtEur(totalPagos)}</div>

              <div style={{
                borderTop: `1px solid ${T.brd}`,
                paddingTop: 12,
                fontWeight: 600,
              }}>Saldo Neto Esperado:</div>
              <div style={{
                borderTop: `1px solid ${T.brd}`,
                paddingTop: 12,
                fontWeight: 600,
                color: saldo >= 0 ? '#06C167' : '#B01D23',
              }}>{fmtEur(saldo)}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
