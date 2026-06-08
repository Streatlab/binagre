import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/styles/tokens';
import { ArrowDownCircle, ArrowUpCircle, TrendingUp, Clock, Info } from 'lucide-react';

interface Cobro {
  canal: string;
  origen: 'real' | 'estimado';
  p_ini: string;
  p_fin: string;
  fecha_pago: string;
  neto: number;
  estado: 'cobrado' | 'pendiente';
}

interface Pago {
  id: string;
  proveedor: string;
  fecha_factura: string;
  total: number;
  categoria_factura: string | null;
  estado: string;
}

const COLOR_CANAL: Record<string, string> = {
  'Uber Eats': '#06C167',
  'Glovo': '#F26B1F',
  'Just Eat': '#B01D23',
  'Web Propia': '#1E5BCC',
  'Venta Directa': '#9ba3af',
};

const fmtEur0 = (n: number) =>
  (n || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0, style: 'currency', currency: 'EUR' });
const fmtEur2 = (n: number) =>
  (n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, style: 'currency', currency: 'EUR' });

const fmtFecha = (s: string) => {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' });
};

const RED_SL = '#B01D23';
const VERDE = '#1D9E75';

export default function Cashflow() {
  const { T } = useTheme();
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        const { data: dCobros } = await supabase
          .from('v_cashflow_cobros')
          .select('canal, origen, p_ini, p_fin, fecha_pago, neto, estado')
          .order('fecha_pago', { ascending: true });

        const { data: dPagos } = await supabase
          .from('v_cashflow_pagos')
          .select('id, proveedor, fecha_factura, total, categoria_factura, estado')
          .order('fecha_factura', { ascending: true });

        setCobros((dCobros ?? []).map((c: any) => ({ ...c, neto: parseFloat(c.neto || '0') })) as Cobro[]);
        setPagos((dPagos ?? []).map((p: any) => ({ ...p, total: parseFloat(p.total || '0') })) as Pago[]);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const cobrosPend = useMemo(() => cobros.filter(c => c.estado === 'pendiente'), [cobros]);
  const totalCobrosPend = useMemo(() => cobrosPend.reduce((s, c) => s + c.neto, 0), [cobrosPend]);
  const totalPagosPend = useMemo(() => pagos.reduce((s, p) => s + p.total, 0), [pagos]);
  const saldo = totalCobrosPend - totalPagosPend;
  const hayReal = useMemo(() => cobros.some(c => c.origen === 'real'), [cobros]);

  const headerTab = (icon: React.ReactNode, txt: string, color: string) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
      fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.14em', color,
    }}>
      {icon}{txt}
    </div>
  );

  const card: React.CSSProperties = {
    background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 20px',
  };

  const kpiCard = (label: string, valor: string, color: string, sub?: string) => (
    <div style={{ ...card, padding: 20, borderRadius: 16 }}>
      <div style={{
        fontFamily: 'Oswald, sans-serif', fontSize: 11, color: T.mut, fontWeight: 500,
        textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10,
      }}>{label}</div>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 38, fontWeight: 700, color, lineHeight: 1 }}>{valor}</div>
      {sub && <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut, marginTop: 8 }}>{sub}</div>}
    </div>
  );

  const badge = (txt: string, color: string, bg: string) => (
    <span style={{
      fontFamily: 'Lexend, sans-serif', fontSize: 10, fontWeight: 600, color,
      background: bg, padding: '2px 7px', borderRadius: 6, letterSpacing: '0.02em',
    }}>{txt}</span>
  );

  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{
        fontFamily: 'Oswald, sans-serif', fontSize: 18, fontWeight: 600, color: RED_SL,
        letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2,
      }}>
        CASH FLOW
      </div>
      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: T.mut, marginBottom: 18 }}>
        Cobros por recibir, pagos por hacer y saldo previsto
      </div>

      {!loading && !hayReal && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', marginBottom: 18,
          background: '#FFF7E6', border: '0.5px solid #F2C46B', borderRadius: 10,
          fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#8a6a1f',
        }}>
          <Info size={15} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>Datos <strong>estimados</strong> a partir de ventas brutas × comisión de cada plataforma. Se sustituyen automáticamente por las liquidaciones reales en cuanto se importen los resúmenes de venta.</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: T.sec, fontFamily: 'Lexend, sans-serif' }}>Cargando datos…</div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
            {kpiCard('Cobros pendientes', fmtEur0(totalCobrosPend), VERDE, `${cobrosPend.length} cobros por recibir`)}
            {kpiCard('Pagos pendientes', fmtEur0(totalPagosPend), RED_SL, `${pagos.length} facturas por pagar`)}
            {kpiCard('Saldo neto previsto', fmtEur0(saldo), saldo >= 0 ? VERDE : RED_SL, saldo >= 0 ? 'A favor' : 'En contra')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 20 }}>
            {/* COBROS */}
            <div style={card}>
              {headerTab(<ArrowDownCircle size={18} />, 'Cobros pendientes', VERDE)}
              {cobrosPend.length === 0 ? (
                <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut, padding: '8px 0' }}>
                  Sin cobros pendientes en el horizonte.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {cobrosPend.map((c, i) => {
                    const color = COLOR_CANAL[c.canal] || '#cccccc';
                    return (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: 12, background: T.bg, borderRadius: 10, borderLeft: `3px solid ${color}`,
                      }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, fontWeight: 600, color, textTransform: 'uppercase' }}>{c.canal}</span>
                            {c.origen === 'estimado'
                              ? badge('ESTIM.', '#8a6a1f', '#FFF1D6')
                              : badge('REAL', VERDE, '#E3F5EC')}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut, marginTop: 3 }}>
                            <Clock size={11} /> Pago previsto {fmtFecha(c.fecha_pago)}
                          </div>
                        </div>
                        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, fontWeight: 700, color }}>{fmtEur2(c.neto)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* PAGOS */}
            <div style={card}>
              {headerTab(<ArrowUpCircle size={18} />, 'Pagos pendientes', RED_SL)}
              {pagos.length === 0 ? (
                <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut, padding: '8px 0' }}>
                  Sin facturas pendientes de pago.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 520, overflowY: 'auto' }}>
                  {pagos.slice(0, 60).map((p, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: 12, background: T.bg, borderRadius: 10, borderLeft: `3px solid ${RED_SL}`,
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, fontWeight: 600, color: T.pri, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{p.proveedor}</div>
                        <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut, marginTop: 3 }}>Factura {fmtFecha(p.fecha_factura)}</div>
                      </div>
                      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 15, fontWeight: 700, color: RED_SL }}>{fmtEur2(p.total)}</div>
                    </div>
                  ))}
                  {pagos.length > 60 && (
                    <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: T.mut, textAlign: 'center', paddingTop: 4 }}>
                      … y {pagos.length - 60} facturas más
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* CRUCE */}
          <div style={card}>
            {headerTab(<TrendingUp size={18} />, 'Cruce de flujos', T.sec)}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, fontSize: 13, fontFamily: 'Lexend, sans-serif', maxWidth: 520 }}>
              <div style={{ color: T.pri }}>Total cobros pendientes</div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: VERDE }}>{fmtEur2(totalCobrosPend)}</div>

              <div style={{ color: T.pri }}>Total pagos pendientes</div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: RED_SL }}>&minus;{fmtEur2(totalPagosPend)}</div>

              <div style={{ borderTop: `0.5px solid ${T.brd}`, paddingTop: 12, fontWeight: 600, color: T.pri }}>Saldo neto previsto</div>
              <div style={{ borderTop: `0.5px solid ${T.brd}`, paddingTop: 12, fontFamily: 'Oswald, sans-serif', fontSize: 18, fontWeight: 700, color: saldo >= 0 ? VERDE : RED_SL }}>{fmtEur2(saldo)}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
