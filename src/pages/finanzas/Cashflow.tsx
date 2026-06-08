import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/styles/tokens';
import { ArrowDownCircle, ArrowUpCircle, TrendingUp, CheckCircle2, Clock } from 'lucide-react';

/* ════════════════════════════════════════════════════════════
   CASH FLOW · Binagre
   Cobros pendientes (qué nos pagan las plataformas, cuándo y si
   ya entró), pagos pendientes (facturas de proveedor sin pagar)
   y saldo neto previsto.

   Fuente de cobros:
   - REAL: tablas *_liquidaciones cuando tengan datos (neto y
     fecha de pago certificados por la plataforma).
   - ESTIMADO (fallback): ventas brutas reales (facturacion_diario)
     × comisión de cada plataforma (config_canales) repartidas en
     su calendario de pago. Se activa el real en cuanto llegue.
   ════════════════════════════════════════════════════════════ */

interface Cobro {
  canal: string;
  periodo: string;
  fechaPago: string;   // yyyy-mm-dd
  bruto: number;
  neto: number;
  estado: 'cobrado' | 'pendiente';
  real: boolean;
  color: string;
}

interface Pago {
  proveedor: string;
  fecha: string;
  importe: number;
}

const COLORES_CANAL: Record<string, string> = {
  'Uber Eats': '#06C167',
  'Glovo': '#e8f442',
  'Just Eat': '#f5a623',
  'Web Propia': '#66aaff',
  'Venta Directa': '#B01D23',
};

// Map columna bruto facturacion_diario → nombre canal config_canales
const CANALES_BRUTO: Array<{ key: string; nombre: string }> = [
  { key: 'uber_bruto', nombre: 'Uber Eats' },
  { key: 'glovo_bruto', nombre: 'Glovo' },
  { key: 'je_bruto', nombre: 'Just Eat' },
  { key: 'web_bruto', nombre: 'Web Propia' },
  { key: 'directa_bruto', nombre: 'Venta Directa' },
];

const fmtEur = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, style: 'currency', currency: 'EUR' });

const fmtDia = (s: string) => {
  if (!s) return '';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y.slice(2)}`;
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function finDeMes(year: number, monthIdx: number): Date {
  return new Date(year, monthIdx + 1, 0, 12);
}

/* Devuelve clave de periodo + etiqueta + fecha de pago estimada según canal */
function periodoDePago(canal: string, fechaStr: string): { key: string; label: string; fechaPago: string } {
  const d = new Date(fechaStr + 'T12:00:00');
  const y = d.getFullYear();
  const mi = d.getMonth();
  const dia = d.getDate();

  if (canal === 'Uber Eats') {
    // semana lunes-domingo; pago el miércoles siguiente al domingo
    const off = (d.getDay() + 6) % 7;
    const lunes = new Date(d); lunes.setDate(d.getDate() - off); lunes.setHours(12, 0, 0, 0);
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
    const pago = new Date(domingo); pago.setDate(domingo.getDate() + 3);
    return {
      key: `UE-${iso(lunes)}`,
      label: `Sem. ${fmtDia(iso(lunes))}–${fmtDia(iso(domingo))}`,
      fechaPago: iso(pago),
    };
  }
  if (canal === 'Glovo') {
    // quincenal; pago ~7 días tras fin de quincena
    if (dia <= 15) {
      return { key: `GL-${y}-${mi}-1`, label: `1ª quinc. ${MESES[mi]} ${y}`, fechaPago: iso(new Date(y, mi, 22, 12)) };
    }
    const finQ = finDeMes(y, mi);
    const pago = new Date(finQ); pago.setDate(finQ.getDate() + 7);
    return { key: `GL-${y}-${mi}-2`, label: `2ª quinc. ${MESES[mi]} ${y}`, fechaPago: iso(pago) };
  }
  if (canal === 'Just Eat') {
    // mensual; pago el día 15 del mes siguiente
    return { key: `JE-${y}-${mi}`, label: `${MESES[mi]} ${y}`, fechaPago: iso(new Date(y, mi + 1, 15, 12)) };
  }
  // Web Propia / Venta Directa: cobro inmediato (pasarela)
  return { key: `${canal}-${fechaStr}`, label: fmtDia(fechaStr), fechaPago: fechaStr };
}

export default function Cashflow() {
  const { T } = useTheme();
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [modoReal, setModoReal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        const hoy = iso(new Date());

        // 1) comisiones por canal
        const { data: cfg } = await supabase
          .from('config_canales')
          .select('canal, comision_pct, fee_periodo_eur');
        const comision: Record<string, number> = {};
        const fee: Record<string, number> = {};
        (cfg || []).forEach((c: any) => {
          comision[c.canal] = parseFloat(c.comision_pct || '0');
          fee[c.canal] = parseFloat(c.fee_periodo_eur || '0');
        });

        // 2) ¿hay liquidaciones reales?
        const [{ count: nUber }, { count: nGlovo }, { count: nJe }] = await Promise.all([
          supabase.from('uber_liquidaciones').select('*', { count: 'exact', head: true }),
          supabase.from('glovo_liquidaciones').select('*', { count: 'exact', head: true }),
          supabase.from('justeat_liquidaciones').select('*', { count: 'exact', head: true }),
        ]);
        const hayReal = (nUber || 0) + (nGlovo || 0) + (nJe || 0) > 0;
        setModoReal(hayReal);

        const cobrosList: Cobro[] = [];

        if (hayReal) {
          // ── COBROS REALES ──
          const [uber, glovo, je] = await Promise.all([
            supabase.from('uber_liquidaciones').select('fecha_deposito, pago_neto, ventas_bruto, conciliacion_id'),
            supabase.from('glovo_liquidaciones').select('fecha_factura, ingreso_colaborador, ventas_bruto, conciliacion_id'),
            supabase.from('justeat_liquidaciones').select('fecha_abono, ingreso_colaborador, total_ventas, conciliacion_id'),
          ]);
          (uber.data || []).forEach((r: any) => cobrosList.push({
            canal: 'Uber Eats', periodo: fmtDia(r.fecha_deposito), fechaPago: r.fecha_deposito,
            bruto: +r.ventas_bruto || 0, neto: +r.pago_neto || 0,
            estado: r.conciliacion_id ? 'cobrado' : 'pendiente', real: true, color: COLORES_CANAL['Uber Eats'],
          }));
          (glovo.data || []).forEach((r: any) => cobrosList.push({
            canal: 'Glovo', periodo: fmtDia(r.fecha_factura), fechaPago: r.fecha_factura,
            bruto: +r.ventas_bruto || 0, neto: +r.ingreso_colaborador || 0,
            estado: r.conciliacion_id ? 'cobrado' : 'pendiente', real: true, color: COLORES_CANAL['Glovo'],
          }));
          (je.data || []).forEach((r: any) => cobrosList.push({
            canal: 'Just Eat', periodo: fmtDia(r.fecha_abono), fechaPago: r.fecha_abono,
            bruto: +r.total_ventas || 0, neto: +r.ingreso_colaborador || 0,
            estado: r.conciliacion_id ? 'cobrado' : 'pendiente', real: true, color: COLORES_CANAL['Just Eat'],
          }));
        } else {
          // ── COBROS ESTIMADOS desde facturación bruta ──
          const desde = new Date(); desde.setDate(desde.getDate() - 75);
          const { data: fact } = await supabase
            .from('facturacion_diario')
            .select('fecha, uber_bruto, glovo_bruto, je_bruto, web_bruto, directa_bruto')
            .gte('fecha', iso(desde))
            .order('fecha', { ascending: true });

          const grupos: Record<string, { canal: string; periodo: string; fechaPago: string; bruto: number }> = {};
          (fact || []).forEach((row: any) => {
            CANALES_BRUTO.forEach(({ key, nombre }) => {
              const bruto = parseFloat(row[key] || '0');
              if (bruto <= 0) return;
              const p = periodoDePago(nombre, row.fecha);
              const gk = `${nombre}|${p.key}`;
              if (!grupos[gk]) grupos[gk] = { canal: nombre, periodo: p.label, fechaPago: p.fechaPago, bruto: 0 };
              grupos[gk].bruto += bruto;
            });
          });

          Object.values(grupos).forEach((g) => {
            const com = comision[g.canal] ?? 0;
            const neto = Math.max(0, g.bruto * (1 - com) - (fee[g.canal] ?? 0));
            cobrosList.push({
              canal: g.canal, periodo: g.periodo, fechaPago: g.fechaPago,
              bruto: g.bruto, neto,
              estado: g.fechaPago <= hoy ? 'cobrado' : 'pendiente',
              real: false, color: COLORES_CANAL[g.canal] || '#999',
            });
          });
        }

        cobrosList.sort((a, b) => (a.fechaPago < b.fechaPago ? 1 : -1));
        setCobros(cobrosList);

        // 3) PAGOS PENDIENTES — facturas de proveedor sin conciliar
        const { data: fpend } = await supabase
          .from('facturas')
          .select('proveedor_nombre, fecha_factura, total, estado')
          .neq('estado', 'asociada')
          .gt('total', 0)
          .order('fecha_factura', { ascending: false })
          .limit(200);
        setPagos((fpend || []).map((f: any) => ({
          proveedor: f.proveedor_nombre || 'Sin proveedor',
          fecha: f.fecha_factura,
          importe: parseFloat(f.total || '0'),
        })));

        setLoading(false);
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const cobrosPendientes = useMemo(() => cobros.filter(c => c.estado === 'pendiente'), [cobros]);
  const totalCobrosPend = useMemo(() => cobrosPendientes.reduce((s, c) => s + c.neto, 0), [cobrosPendientes]);
  const totalPagos = useMemo(() => pagos.reduce((s, p) => s + p.importe, 0), [pagos]);
  const saldo = totalCobrosPend - totalPagos;

  const card: React.CSSProperties = { background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: 20 };
  const labelKpi: React.CSSProperties = {
    fontFamily: 'Oswald, sans-serif', fontSize: 11, color: T.mut, fontWeight: 500,
    textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8,
  };
  const valorKpi: React.CSSProperties = { fontFamily: 'Oswald, sans-serif', fontSize: 34, fontWeight: 600, lineHeight: 1 };
  const colTitulo: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
    fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.14em',
  };

  return (
    <div style={{ background: T.bg, padding: '24px 4px', minHeight: '60vh' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 600, color: '#B01D23', letterSpacing: 3, textTransform: 'uppercase' }}>
          CASH FLOW
        </div>
        <span style={{
          fontFamily: 'Lexend, sans-serif', fontSize: 11, fontWeight: 500, padding: '2px 10px', borderRadius: 20,
          background: modoReal ? '#1D9E7515' : '#f5a62318', color: modoReal ? '#1D9E75' : '#a07400',
          border: `0.5px solid ${modoReal ? '#1D9E7540' : '#f5a62340'}`,
        }}>
          {modoReal ? 'Datos reales de liquidación' : 'Estimado desde facturación'}
        </span>
      </div>
      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: T.mut, marginBottom: 24 }}>
        Qué nos tienen que pagar, cuándo y qué nos queda por pagar
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: T.sec, fontFamily: 'Lexend, sans-serif' }}>Cargando…</div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
            <div style={card}>
              <div style={labelKpi}>Cobros pendientes</div>
              <div style={{ ...valorKpi, color: '#1D9E75' }}>{fmtEur(totalCobrosPend)}</div>
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut, marginTop: 6 }}>
                {cobrosPendientes.length} liquidaciones por entrar
              </div>
            </div>
            <div style={card}>
              <div style={labelKpi}>Pagos pendientes</div>
              <div style={{ ...valorKpi, color: '#B01D23' }}>{fmtEur(totalPagos)}</div>
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut, marginTop: 6 }}>
                {pagos.length} facturas sin pagar
              </div>
            </div>
            <div style={{ ...card, border: `0.5px solid ${saldo >= 0 ? '#1D9E7555' : '#B01D2355'}` }}>
              <div style={labelKpi}>Saldo neto previsto</div>
              <div style={{ ...valorKpi, color: saldo >= 0 ? '#1D9E75' : '#B01D23' }}>{fmtEur(saldo)}</div>
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut, marginTop: 6 }}>
                Cobros pendientes − pagos pendientes
              </div>
            </div>
          </div>

          {/* Dos columnas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 24 }}>
            {/* COBROS */}
            <div style={card}>
              <div style={{ ...colTitulo, color: '#1D9E75' }}>
                <ArrowDownCircle size={20} /> Cobros · qué nos pagan
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cobros.slice(0, 18).map((c, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', background: T.bg, borderRadius: 10, borderLeft: `3px solid ${c.color}`,
                    opacity: c.estado === 'cobrado' ? 0.62 : 1,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 600, color: c.color === '#e8f442' ? '#8a7800' : c.color, textTransform: 'uppercase' }}>
                        {c.canal}
                      </div>
                      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.sec, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.periodo}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                        {c.estado === 'cobrado'
                          ? <><CheckCircle2 size={11} color="#1D9E75" /><span style={{ fontSize: 11, color: '#1D9E75', fontFamily: 'Lexend, sans-serif' }}>Cobrado</span></>
                          : <><Clock size={11} color="#f5a623" /><span style={{ fontSize: 11, color: '#a07400', fontFamily: 'Lexend, sans-serif' }}>Pendiente · pago {fmtDia(c.fechaPago)}</span></>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 15, fontWeight: 600, color: T.pri }}>{fmtEur(c.neto)}</div>
                      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 10, color: T.mut }}>bruto {fmtEur(c.bruto)}</div>
                    </div>
                  </div>
                ))}
                {cobros.length === 0 && <div style={{ color: T.mut, fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>Sin datos de cobros aún.</div>}
              </div>
            </div>

            {/* PAGOS */}
            <div style={card}>
              <div style={{ ...colTitulo, color: '#B01D23' }}>
                <ArrowUpCircle size={20} /> Pagos · facturas por pagar
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pagos.slice(0, 18).map((p, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', background: T.bg, borderRadius: 10, borderLeft: '3px solid #B01D23',
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, fontWeight: 500, color: T.pri, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                        {p.proveedor}
                      </div>
                      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut, marginTop: 2 }}>{fmtDia(p.fecha)}</div>
                    </div>
                    <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 15, fontWeight: 600, color: '#B01D23', whiteSpace: 'nowrap' }}>{fmtEur(p.importe)}</div>
                  </div>
                ))}
                {pagos.length === 0 && <div style={{ color: T.mut, fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>Nada pendiente de pago.</div>}
              </div>
            </div>
          </div>

          {/* CRUCE DE FLUJOS */}
          <div style={card}>
            <div style={{ ...colTitulo, color: T.sec }}>
              <TrendingUp size={20} /> Cruce de flujos
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, fontSize: 13, fontFamily: 'Lexend, sans-serif', color: T.pri }}>
              <div>Total cobros pendientes</div>
              <div style={{ fontWeight: 600, color: '#1D9E75', textAlign: 'right' }}>{fmtEur(totalCobrosPend)}</div>
              <div>Total pagos pendientes</div>
              <div style={{ fontWeight: 600, color: '#B01D23', textAlign: 'right' }}>−{fmtEur(totalPagos)}</div>
              <div style={{ borderTop: `0.5px solid ${T.brd}`, paddingTop: 12, fontWeight: 600 }}>Saldo neto previsto</div>
              <div style={{ borderTop: `0.5px solid ${T.brd}`, paddingTop: 12, fontWeight: 600, textAlign: 'right', color: saldo >= 0 ? '#1D9E75' : '#B01D23' }}>{fmtEur(saldo)}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
