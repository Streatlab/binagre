import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/styles/tokens';

/* ════════════════════════════════════════════════════════════
   CASH FLOW · Binagre — Ingresos
   Lee tablas base (facturacion_diario, config_canales, facturas)
   y calcula cobros estimados: bruto, neto (calcneto comisión),
   fecha de pago por plataforma y estado cobrado/pendiente.
   Cuando se importen liquidaciones reales se sustituye la fuente.
   ════════════════════════════════════════════════════════════ */

type Modo = 'semana' | 'quincena' | 'mes';

interface Cobro {
  canal: string;
  fechaVenta: string;
  fechaPago: string;
  bruto: number;
  neto: number;
  futuro: boolean;
}

const CANAL_COLOR: Record<string, string> = {
  'Uber Eats': '#06C167',
  'Glovo': '#F26B1F',
  'Just Eat': '#B01D23',
  'Web Propia': '#1E5BCC',
  'Venta Directa': '#9ba3af',
};
const ORDEN = ['Uber Eats', 'Glovo', 'Just Eat', 'Web Propia', 'Venta Directa'];

const COLS_BRUTO: Array<{ key: string; nombre: string }> = [
  { key: 'uber_bruto', nombre: 'Uber Eats' },
  { key: 'glovo_bruto', nombre: 'Glovo' },
  { key: 'je_bruto', nombre: 'Just Eat' },
  { key: 'web_bruto', nombre: 'Web Propia' },
  { key: 'directa_bruto', nombre: 'Venta Directa' },
];

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const eur = (n: number, dec = 0) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + ' €';

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parse(s: string) { return new Date(s.slice(0, 10) + 'T12:00:00'); }
function fmtFecha(s: string) { const d = parse(s); return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`; }
function lunes(d: Date) { const x = new Date(d); x.setDate(d.getDate() - ((d.getDay() + 6) % 7)); x.setHours(12, 0, 0, 0); return x; }
function finMes(y: number, m: number) { return new Date(y, m + 1, 0, 12); }

/* fecha de pago estimada por plataforma */
function fechaPago(canal: string, fv: string): string {
  const d = parse(fv); const y = d.getFullYear(); const m = d.getMonth(); const dia = d.getDate();
  if (canal === 'Uber Eats') { const dom = lunes(d); dom.setDate(dom.getDate() + 6); const p = new Date(dom); p.setDate(dom.getDate() + 2); return iso(p); }
  if (canal === 'Glovo') { if (dia <= 15) return iso(new Date(y, m, 22, 12)); const p = finMes(y, m); p.setDate(p.getDate() + 7); return iso(p); }
  if (canal === 'Just Eat') return iso(new Date(y, m + 1, 15, 12));
  return fv; // web / directa: inmediato
}

export default function Cashflow() {
  const { T } = useTheme();
  const [modo, setModo] = useState<Modo>('semana');
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [pagosTotal, setPagosTotal] = useState(0);
  const [pagosN, setPagosN] = useState(0);
  const [loading, setLoading] = useState(true);
  const hoy = iso(new Date());

  useEffect(() => {
    (async () => {
      try {
        const { data: cfg } = await supabase.from('config_canales').select('canal, comision_pct');
        const com: Record<string, number> = {};
        (cfg || []).forEach((c: any) => { com[c.canal] = parseFloat(c.comision_pct || '0'); });

        const desde = new Date(); desde.setDate(desde.getDate() - 120);
        const { data: fact } = await supabase
          .from('facturacion_diario')
          .select('fecha, uber_bruto, glovo_bruto, je_bruto, web_bruto, directa_bruto')
          .gte('fecha', iso(desde)).order('fecha', { ascending: true });

        const list: Cobro[] = [];
        (fact || []).forEach((row: any) => {
          COLS_BRUTO.forEach(({ key, nombre }) => {
            const bruto = parseFloat(row[key] || '0');
            if (bruto <= 0) return;
            const fp = fechaPago(nombre, row.fecha);
            const c = com[nombre] ?? 0;
            list.push({ canal: nombre, fechaVenta: row.fecha, fechaPago: fp, bruto, neto: Math.max(0, bruto * (1 - c)), futuro: fp > hoy });
          });
        });
        setCobros(list);

        const { data: fp } = await supabase.from('facturas').select('total, estado').neq('estado', 'asociada').gt('total', 0);
        setPagosTotal((fp || []).reduce((s: number, f: any) => s + parseFloat(f.total || '0'), 0));
        setPagosN((fp || []).length);
        setLoading(false);
      } catch (e) { console.error(e); setLoading(false); }
    })();
  }, []);

  /* ---- agrupación por periodo de PAGO según modo ---- */
  function bucketKey(fpStr: string) {
    const d = parse(fpStr); const y = d.getFullYear(); const m = d.getMonth();
    if (modo === 'mes') return { k: `${y}-${m}`, label: `${MESES[m]} ${String(y).slice(2)}`, fecha: finMes(y, m) };
    if (modo === 'quincena') { const q = d.getDate() <= 15 ? 1 : 2; return { k: `${y}-${m}-${q}`, label: `${q}ªq ${MESES[m]}`, fecha: q === 1 ? new Date(y, m, 15, 12) : finMes(y, m) }; }
    const l = lunes(d); return { k: iso(l), label: `${l.getDate()}/${l.getMonth() + 1}`, fecha: l };
  }

  const buckets = useMemo(() => {
    const map: Record<string, { label: string; fecha: Date; bruto: number; neto: number; futuro: boolean }> = {};
    cobros.forEach((c) => {
      const b = bucketKey(c.fechaPago);
      if (!map[b.k]) map[b.k] = { label: b.label, fecha: b.fecha, bruto: 0, neto: 0, futuro: true };
      map[b.k].bruto += c.bruto; map[b.k].neto += c.neto;
      if (!c.futuro) map[b.k].futuro = false;
    });
    return Object.values(map).sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  }, [cobros, modo]);

  /* recorte: 8 pasados + todos los futuros */
  const visibles = useMemo(() => {
    const futuros = buckets.filter(b => b.futuro);
    const pasados = buckets.filter(b => !b.futuro).slice(-8);
    return [...pasados, ...futuros];
  }, [buckets]);

  /* tabla por plataforma del rango visible */
  const porPlataforma = useMemo(() => {
    const minF = visibles[0]?.fecha.getTime() ?? 0;
    const agg: Record<string, { bruto: number; neto: number }> = {};
    cobros.forEach((c) => {
      if (bucketKey(c.fechaPago).fecha.getTime() < minF) return;
      if (!agg[c.canal]) agg[c.canal] = { bruto: 0, neto: 0 };
      agg[c.canal].bruto += c.bruto; agg[c.canal].neto += c.neto;
    });
    return ORDEN.filter(c => agg[c]).map(c => ({ canal: c, ...agg[c] }));
  }, [cobros, modo, visibles]);

  /* próximos cobros (pendientes futuros) por plataforma */
  const proximos = useMemo(() => {
    const map: Record<string, { canal: string; fechaPago: string; bruto: number; neto: number }> = {};
    cobros.filter(c => c.futuro).forEach((c) => {
      const k = `${c.canal}-${bucketKey(c.fechaPago).k}`;
      if (!map[k]) map[k] = { canal: c.canal, fechaPago: c.fechaPago, bruto: 0, neto: 0 };
      map[k].bruto += c.bruto; map[k].neto += c.neto;
    });
    return Object.values(map).sort((a, b) => (a.fechaPago < b.fechaPago ? -1 : 1));
  }, [cobros, modo]);

  const seNosDebe = useMemo(() => cobros.filter(c => c.futuro).reduce((s, c) => s + c.neto, 0), [cobros]);
  const finMesIso = useMemo(() => { const d = new Date(); return iso(finMes(d.getFullYear(), d.getMonth())); }, []);
  const hastaFinMes = useMemo(() => cobros.filter(c => c.futuro && c.fechaPago <= finMesIso).reduce((s, c) => s + c.neto, 0), [cobros, finMesIso]);
  const saldo = seNosDebe - pagosTotal;

  /* ---- SVG línea de tiempo ---- */
  const chart = useMemo(() => {
    if (!visibles.length) return null;
    const W = 520, H = 190, pad = { l: 40, r: 14, t: 14, b: 26 };
    const ix = W - pad.l - pad.r, iy = H - pad.t - pad.b;
    const max = Math.max(...visibles.map(b => b.neto)) * 1.15 || 1;
    const X = (i: number) => pad.l + ix * (visibles.length === 1 ? 0.5 : i / (visibles.length - 1));
    const Y = (v: number) => pad.t + iy * (1 - v / max);
    const idxHoy = visibles.findIndex(b => b.futuro);
    const real = visibles.map((b, i) => ({ x: X(i), y: Y(b.neto), fut: b.futuro }));
    const solido = real.filter((_, i) => idxHoy === -1 || i <= idxHoy).map(p => `${p.x} ${p.y}`);
    const punteado = real.filter((_, i) => idxHoy !== -1 && i >= Math.max(0, idxHoy - 0)).map(p => `${p.x} ${p.y}`);
    return { W, H, pad, X, Y, max, visibles, idxHoy, solido, punteado, real };
  }, [visibles]);

  const card: React.CSSProperties = { background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: 20 };
  const lab: React.CSSProperties = { fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.mut, marginBottom: 6 };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: T.sec, fontFamily: 'Lexend, sans-serif' }}>Cargando…</div>;

  return (
    <div style={{ background: T.bg, padding: '20px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 21, fontWeight: 600, color: '#B01D23', letterSpacing: 2.5, textTransform: 'uppercase' }}>CASH FLOW</div>
        <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, padding: '2px 10px', borderRadius: 20, background: '#f5a62318', color: '#a07400', border: '0.5px solid #f5a62340' }}>Estimado desde facturación</span>
      </div>
      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: T.mut, marginBottom: 20 }}>Qué nos paga cada plataforma y cuándo · bruto y neto</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18, alignItems: 'start' }}>

        {/* ════ CARD INGRESOS (50%) ════ */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1D9E75' }}>▼ Ingresos</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['semana', 'quincena', 'mes'] as Modo[]).map(m => (
                <button key={m} onClick={() => setModo(m)} style={{
                  fontFamily: 'Lexend, sans-serif', fontSize: 12, padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                  border: `0.5px solid ${modo === m ? '#FF4757' : T.brd}`, background: modo === m ? '#FF4757' : '#fff', color: modo === m ? '#fff' : T.sec,
                }}>{m === 'semana' ? 'Semanas' : m === 'quincena' ? 'Quincenas' : 'Meses'}</button>
              ))}
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={lab}>Por cobrar hasta fin de mes</div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 34, color: '#1D9E75', lineHeight: 1 }}>{eur(hastaFinMes)}</div>
            </div>
            <div>
              <div style={lab}>Se nos debe (total)</div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 26, color: T.sec, lineHeight: 1.25 }}>{eur(seNosDebe)}</div>
            </div>
          </div>

          {/* GRÁFICO línea de tiempo */}
          {chart && (
            <div style={{ margin: '6px 0 14px' }}>
              <svg viewBox={`0 0 ${chart.W} ${chart.H}`} style={{ width: '100%', height: 'auto' }}>
                {[0, 1, 2, 3].map(g => { const v = chart.max / 3 * g; const y = chart.Y(v); return (
                  <g key={g}>
                    <line x1={chart.pad.l} y1={y} x2={chart.W - chart.pad.r} y2={y} stroke="#efece6" />
                    <text x={chart.pad.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#9ba3af" fontFamily="Lexend">{Math.round(v / 1000)}k</text>
                  </g>); })}
                {chart.visibles.map((b, i) => (
                  <text key={i} x={chart.X(i)} y={chart.H - 8} textAnchor="middle" fontSize="8.5" fill="#9ba3af" fontFamily="Lexend">{b.label}</text>
                ))}
                {chart.idxHoy > 0 && (
                  <line x1={(chart.X(chart.idxHoy - 1) + chart.X(chart.idxHoy)) / 2} y1={chart.pad.t} x2={(chart.X(chart.idxHoy - 1) + chart.X(chart.idxHoy)) / 2} y2={chart.H - chart.pad.b} stroke="#FF4757" strokeWidth="1" strokeDasharray="3 3" />
                )}
                {chart.idxHoy > 0 && (
                  <text x={(chart.X(chart.idxHoy - 1) + chart.X(chart.idxHoy)) / 2} y={chart.pad.t - 2} textAnchor="middle" fontSize="8.5" fill="#FF4757" fontFamily="Oswald">HOY</text>
                )}
                {chart.punteado.length > 1 && <polyline points={chart.punteado.join(' ')} fill="none" stroke="#1E5BCC" strokeWidth="2.5" strokeDasharray="4 3" />}
                {chart.solido.length > 1 && <polyline points={chart.solido.join(' ')} fill="none" stroke="#1D9E75" strokeWidth="2.5" />}
                {chart.real.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill={p.fut ? '#1E5BCC' : '#1D9E75'} />)}
              </svg>
              <div style={{ display: 'flex', gap: 14, fontSize: 11, color: T.sec, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 16, borderTop: '2.5px solid #1D9E75' }} />Cobrado</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 16, borderTop: '2.5px dashed #1E5BCC' }} />Previsto</span>
              </div>
            </div>
          )}

          {/* TABLA por plataforma */}
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.sec, fontWeight: 600, margin: '8px 0 8px' }}>Por plataforma · periodo visible</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Plataforma', 'Bruto', 'Neto'].map((h, i) => (
                <th key={h} style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.mut, fontWeight: 500, textAlign: i ? 'right' : 'left', padding: '6px', borderBottom: `0.5px solid ${T.brd}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {porPlataforma.map(p => (
                <tr key={p.canal}>
                  <td style={{ padding: '9px 6px', borderBottom: '0.5px solid #efece6' }}><span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 600, fontSize: 11.5, textTransform: 'uppercase', color: CANAL_COLOR[p.canal] }}>{p.canal}</span></td>
                  <td style={{ padding: '9px 6px', borderBottom: '0.5px solid #efece6', textAlign: 'right', fontFamily: 'Oswald, sans-serif', color: T.mut }}>{eur(p.bruto)}</td>
                  <td style={{ padding: '9px 6px', borderBottom: '0.5px solid #efece6', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: CANAL_COLOR[p.canal] }}>{eur(p.neto)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* PRÓXIMOS COBROS con fecha real */}
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.sec, fontWeight: 600, margin: '18px 0 8px' }}>Próximos cobros</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {proximos.length === 0 && <div style={{ fontSize: 13, color: T.mut, fontFamily: 'Lexend, sans-serif' }}>Sin cobros futuros previstos.</div>}
            {proximos.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: T.bg, borderRadius: 10, borderLeft: `3px solid ${CANAL_COLOR[p.canal]}` }}>
                <div>
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', color: CANAL_COLOR[p.canal] }}>{p.canal}</div>
                  <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut, marginTop: 2 }}>{fmtFecha(p.fechaPago)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 15, fontWeight: 700, color: T.pri }}>{eur(p.neto)}</div>
                  <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 10, color: T.mut }}>bruto {eur(p.bruto)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ════ COLUMNA DERECHA: GASTOS + SALDO ════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={card}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B01D23', marginBottom: 14 }}>▲ Gastos · por pagar</div>
            <div style={lab}>Facturas de proveedor sin pagar</div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 34, color: '#B01D23', lineHeight: 1 }}>{eur(pagosTotal)}</div>
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut, marginTop: 6 }}>{pagosN} facturas pendientes</div>
          </div>
          <div style={{ ...card, border: `0.5px solid ${saldo >= 0 ? '#1D9E7555' : '#B01D2355'}` }}>
            <div style={lab}>Saldo neto previsto</div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 34, color: saldo >= 0 ? '#1D9E75' : '#B01D23', lineHeight: 1 }}>{saldo < 0 ? '−' : '+'}{eur(Math.abs(saldo))}</div>
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut, marginTop: 6 }}>Se nos debe {eur(seNosDebe)} − por pagar {eur(pagosTotal)}</div>
          </div>
        </div>

      </div>
    </div>
  );
}
