import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/styles/tokens';

/* ════════════════════════════════════════════════════════════
   CASH FLOW · Binagre — card grande estilo Panel Global
   Ingresos por plataforma y periodo (cerrado/abierto), bruto y
   neto, con gráfico de evolución real + proyección.
   Lee v_cashflow_cobros / v_cashflow_pagos (real si hay
   liquidaciones, estimado desde facturación bruta si no).
   ════════════════════════════════════════════════════════════ */

interface Cobro {
  canal: string;
  origen: 'real' | 'estimado';
  p_ini: string;
  p_fin: string;
  fecha_pago: string;
  neto: number;
  estado: 'cobrado' | 'pendiente';
}

const COL: Record<string, string> = {
  'Uber Eats': '#06C167',
  'Glovo': '#F26B1F',
  'Just Eat': '#B01D23',
  'Web Propia': '#1E5BCC',
  'Venta Directa': '#9ba3af',
};
// comisión por canal para derivar bruto desde neto
const COM: Record<string, number> = {
  'Uber Eats': 0.30, 'Glovo': 0.30, 'Just Eat': 0.30, 'Web Propia': 0, 'Venta Directa': 0,
};

const RED_SL = '#B01D23';
const VERDE = '#1D9E75';
const AZUL = '#1E5BCC';
const GRIS = '#9ba3af';

const eur0 = (n: number) => (n || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';
const eur2 = (n: number) => (n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const fmtFechaCobro = (s: string) => {
  if (!s) return '—';
  const d = new Date(s + 'T12:00:00');
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()].toLowerCase()}`;
};

type Periodo = 'proximos' | 'semana' | 'mes' | 'trimestre' | 'anio';
const PILLS: Array<{ id: Periodo; label: string }> = [
  { id: 'proximos', label: 'Próximos' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
  { id: 'trimestre', label: 'Trimestre' },
  { id: 'anio', label: 'Año' },
];

export default function Cashflow() {
  const { T } = useTheme();
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [cobradoHasta, setCobradoHasta] = useState(0);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>('proximos');

  useEffect(() => {
    const cargar = async () => {
      try {
        const { data } = await supabase
          .from('v_cashflow_cobros')
          .select('canal, origen, p_ini, p_fin, fecha_pago, neto, estado')
          .order('fecha_pago', { ascending: true });
        const rows = (data ?? []).map((c: any) => ({ ...c, neto: parseFloat(c.neto || '0') })) as Cobro[];
        setCobros(rows);
        setCobradoHasta(rows.filter(r => r.estado === 'cobrado').reduce((s, r) => s + r.neto, 0));
        setLoading(false);
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const hoy = useMemo(() => new Date(), []);
  const hoyStr = hoy.toISOString().slice(0, 10);

  // ── horizonte de cobros según pill ──
  const limiteHasta = useMemo(() => {
    const d = new Date(hoy);
    if (periodo === 'proximos') d.setDate(d.getDate() + 30);
    else if (periodo === 'semana') d.setDate(d.getDate() + 7);
    else if (periodo === 'mes') d.setDate(d.getDate() + 31);
    else if (periodo === 'trimestre') d.setDate(d.getDate() + 92);
    else d.setDate(d.getDate() + 366);
    return d.toISOString().slice(0, 10);
  }, [periodo, hoy]);

  const proximos = useMemo(
    () => cobros.filter(c => c.estado === 'pendiente' && c.fecha_pago <= limiteHasta).slice(0, 10),
    [cobros, limiteHasta]
  );
  const totalPorCobrar = useMemo(() => proximos.reduce((s, c) => s + c.neto, 0), [proximos]);
  const proximoTxt = proximos.length
    ? `${proximos[0].canal} el ${fmtFechaCobro(proximos[0].fecha_pago)} · ${eur0(proximos[0].neto)}`
    : 'Sin cobros próximos en el horizonte';

  // ── series mensuales para el gráfico ──
  const chart = useMemo(() => {
    const cob: Record<string, number> = {};
    const pre: Record<string, number> = {};
    const orden: string[] = [];
    cobros.forEach(c => {
      const k = c.fecha_pago.slice(0, 7); // YYYY-MM
      if (!orden.includes(k)) orden.push(k);
      if (c.estado === 'cobrado') cob[k] = (cob[k] || 0) + c.neto;
      else pre[k] = (pre[k] || 0) + c.neto;
    });
    orden.sort();
    // proyección por ritmo: media de últimos 3 meses cobrados
    const cobVals = orden.map(k => cob[k] || 0).filter(v => v > 0);
    const media = cobVals.length ? cobVals.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, cobVals.length) : 0;
    // añadir 2 meses de proyección estimada al final
    const ult = orden[orden.length - 1] || hoyStr.slice(0, 7);
    const extra: string[] = [];
    let [yy, mm] = ult.split('-').map(Number);
    for (let i = 0; i < 2; i++) { mm++; if (mm > 12) { mm = 1; yy++; } extra.push(`${yy}-${String(mm).padStart(2, '0')}`); }
    const labels = [...orden, ...extra];
    const cobrado = labels.map(k => (cob[k] != null ? cob[k] : null));
    const previsto = labels.map(k => (pre[k] != null ? pre[k] : null));
    // unir previsto con último cobrado para continuidad
    const estimado = labels.map((k, i) => (i >= orden.length ? media : null));
    return { labels, cobrado, previsto, estimado };
  }, [cobros, hoyStr]);

  // ── SVG line chart ──
  const svg = useMemo(() => {
    const W = 520, H = 200, pad = { l: 42, r: 12, t: 14, b: 26 };
    const ix = W - pad.l - pad.r, iy = H - pad.t - pad.b;
    const L = chart.labels;
    const all = [...chart.cobrado, ...chart.previsto, ...chart.estimado].filter((v): v is number => v != null);
    if (!all.length) return '';
    const max = Math.max(...all) * 1.1;
    const X = (i: number) => pad.l + ix * (i / Math.max(1, L.length - 1));
    const Y = (v: number) => pad.t + iy * (1 - v / max);
    const path = (arr: (number | null)[]) => {
      let d = '', started = false;
      arr.forEach((v, i) => { if (v == null) return; d += (started ? 'L' : 'M') + X(i) + ' ' + Y(v) + ' '; started = true; });
      return d.trim();
    };
    let s = '';
    for (let g = 0; g <= 3; g++) {
      const v = max / 3 * g, y = Y(v);
      s += `<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="${T.brd}" stroke-width="0.5" opacity="0.5"/>`;
      s += `<text x="${pad.l - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="${T.mut}" font-family="Lexend">${Math.round(v / 1000)}k</text>`;
    }
    L.forEach((k, i) => {
      const m = MESES[Number(k.split('-')[1]) - 1];
      s += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="${T.mut}" font-family="Lexend">${m}</text>`;
    });
    s += `<path d="${path(chart.estimado)}" fill="none" stroke="${GRIS}" stroke-width="2" stroke-dasharray="4 3"/>`;
    s += `<path d="${path(chart.previsto)}" fill="none" stroke="${AZUL}" stroke-width="2.5" stroke-dasharray="4 3"/>`;
    s += `<path d="${path(chart.cobrado)}" fill="none" stroke="${VERDE}" stroke-width="2.5"/>`;
    chart.cobrado.forEach((v, i) => { if (v != null) s += `<circle cx="${X(i)}" cy="${Y(v)}" r="3" fill="${VERDE}"/>`; });
    chart.previsto.forEach((v, i) => { if (v != null) s += `<circle cx="${X(i)}" cy="${Y(v)}" r="3" fill="${AZUL}"/>`; });
    return s;
  }, [chart, T]);

  const card: React.CSSProperties = { background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '22px 20px' };
  const pill = (on: boolean): React.CSSProperties => ({
    fontFamily: 'Lexend, sans-serif', fontSize: 12.5, fontWeight: 500, padding: '6px 14px', borderRadius: 8,
    border: `0.5px solid ${on ? '#FF4757' : T.brd}`, background: on ? '#FF4757' : T.card, color: on ? '#fff' : T.sec, cursor: 'pointer',
  });
  const th: React.CSSProperties = { fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.mut, fontWeight: 500, padding: '6px 6px', borderBottom: `0.5px solid ${T.brd}` };
  const td: React.CSSProperties = { fontSize: 12.5, padding: '9px 6px', borderBottom: `0.5px solid ${T.bg}` };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18, paddingTop: 16 }}>
      <div style={card}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, fontWeight: 600, color: RED_SL, letterSpacing: 2.5, textTransform: 'uppercase' }}>
          CASH FLOW · INGRESOS
        </div>
        <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12.5, color: T.mut, marginTop: 2, marginBottom: 16 }}>
          Qué nos paga cada plataforma y cuándo · bruto y neto
        </div>

        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 18 }}>
          {PILLS.map(p => (
            <button key={p.id} style={pill(periodo === p.id)} onClick={() => setPeriodo(p.id)}>{p.label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: T.sec, fontFamily: 'Lexend, sans-serif' }}>Cargando…</div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 }}>
              <div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>
                  Por cobrar · {PILLS.find(p => p.id === periodo)?.label.toLowerCase()}
                </div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 40, lineHeight: 1, color: VERDE }}>{eur0(totalPorCobrar)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>Cobrado hasta hoy</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 22, color: T.sec }}>{eur0(cobradoHasta)}</div>
              </div>
            </div>
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: T.mut }}>Próximo: {proximoTxt}</div>

            {/* GRÁFICO */}
            <div style={{ margin: '14px 0 16px' }}>
              <svg viewBox="0 0 520 200" style={{ width: '100%', height: 'auto' }} dangerouslySetInnerHTML={{ __html: svg }} />
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: T.sec, marginTop: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 16, borderTop: `2.5px solid ${VERDE}` }} />Cobrado (real)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 16, borderTop: `2.5px dashed ${AZUL}` }} />Previsto (facturado)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 16, borderTop: `2px dashed ${GRIS}` }} />Estimado por ritmo</span>
              </div>
            </div>

            {/* PRÓXIMOS COBROS POR PLATAFORMA */}
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.sec, fontWeight: 600, margin: '8px 0 10px' }}>
              Próximos cobros por plataforma
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}>Plataforma</th>
                  <th style={{ ...th, textAlign: 'left' }}>Cobro</th>
                  <th style={{ ...th, textAlign: 'left' }}>Periodo</th>
                  <th style={{ ...th, textAlign: 'right' }}>Bruto</th>
                  <th style={{ ...th, textAlign: 'right' }}>Neto</th>
                </tr>
              </thead>
              <tbody>
                {proximos.map((c, i) => {
                  const color = COL[c.canal] || GRIS;
                  const bruto = c.neto / (1 - (COM[c.canal] ?? 0));
                  const cerrado = c.p_fin < hoyStr;
                  return (
                    <tr key={i}>
                      <td style={{ ...td, textAlign: 'left' }}><span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 600, fontSize: 11.5, textTransform: 'uppercase', color }}>{c.canal}</span></td>
                      <td style={{ ...td }}>{fmtFechaCobro(c.fecha_pago)}</td>
                      <td style={{ ...td }}>
                        <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 5, background: cerrado ? '#E3F5EC' : '#FFF1D6', color: cerrado ? '#1D7A57' : '#8a6a1f' }}>
                          {cerrado ? 'cerrado' : 'abierto'}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'Oswald, sans-serif', color: T.mut }}>{eur0(bruto)}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontWeight: 700, color }}>{eur0(c.neto)}</td>
                    </tr>
                  );
                })}
                {proximos.length === 0 && (
                  <tr><td colSpan={5} style={{ ...td, color: T.mut, textAlign: 'center' }}>Sin cobros en este periodo.</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
