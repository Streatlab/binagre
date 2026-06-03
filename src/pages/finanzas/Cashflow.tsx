/**
 * Cashflow — placeholder (17 may 2026)
 * Próximamente: previsión tesorería 30/60/90 días
 */
import { useTheme, FONT } from '@/styles/tokens';
import { Wallet, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

const cards = [
  { label: 'Saldo actual', icon: Wallet, color: '#1D9E75' },
  { label: 'Cobros pendientes 30d', icon: ArrowDownCircle, color: '#06C167' },
  { label: 'Pagos pendientes 30d', icon: ArrowUpCircle, color: '#B01D23' },
];

export default function Cashflow() {
  const { T } = useTheme();

  return (
    <div style={{ background: '#f5f3ef', padding: '24px 28px', minHeight: '100vh' }}>
      <div style={{
        fontFamily: 'Oswald, sans-serif',
        fontSize: 22,
        fontWeight: 600,
        color: '#B01D23',
        letterSpacing: 3,
        textTransform: 'uppercase',
        marginBottom: 4,
      }}>
        CASHFLOW
      </div>
      <div style={{
        fontFamily: 'Lexend, sans-serif',
        fontSize: 13,
        color: '#7a8090',
        marginBottom: 24,
      }}>
        Próximamente
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 16,
        marginBottom: 32,
      }}>
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} style={{
              background: T.card,
              border: `1px solid ${T.brd}`,
              borderRadius: 16,
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}>
              <Icon size={32} color={c.color} strokeWidth={1.5} />
              <div style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: 11,
                letterSpacing: '0.14em',
                color: T.mut,
                fontWeight: 500,
                textTransform: 'uppercase',
              }}>{c.label}</div>
              <div style={{
                fontFamily: 'Lexend, sans-serif',
                fontSize: 36,
                fontWeight: 700,
                color: T.brd,
                lineHeight: 1,
              }}>—</div>
            </div>
          );
        })}
      </div>

      <div style={{
        background: T.card,
        border: `1px solid ${T.brd}`,
        borderRadius: 12,
        padding: '32px 24px',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: FONT.body,
          fontSize: 14,
          color: T.sec,
          lineHeight: 1.6,
        }}>
          Este módulo mostrará la previsión de tesorería a 30/60/90 días.
          <br />
          <span style={{ color: T.mut, fontSize: 12 }}>
            Saldo real en banco · Cobros pendientes · Pagos pendientes · Alertas de tensión
          </span>
        </div>
      </div>
    </div>
  );
}
