/**
 * CarruselMarcas — refactor 3 may 2026 v2
 *
 * Reglas (Rubén):
 * - Estilo card EXACTO de Conciliación ResumenDashboard:
 *   cardBase blanco, label Oswald 11px uppercase, número gigante Oswald 38px,
 *   delta verde/rojo, divider 1px, filas con punto color + nombre + importe + delta + % + barra horizontal.
 * - Card 1 = "Streat Lab" total con datos REALES de facturacion_diario (bruto + pedidos + ticket medio + delta vs anterior).
 *   Desglose por canal con barras (Uber/Glovo/Just Eat/Tienda online/Venta directa).
 * - Cards siguientes = una por marca activa, con datos REALES desde v_facturacion_marca cuando exista marca_id.
 * - Marcas SIN datos no se muestran (no más "—" placeholder).
 * - Sin leyenda inferior tipo "cuando los pedidos sin parts…". Cero copywriting innecesario.
 * - Carrusel con scroll horizontal cómodo: chevrones laterales que mueven 320px.
 * - SIN SÍMBOLO DE EURO en ningún número (pedido explícito).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme, FONT, kpiValueStyle } from '@/styles/tokens';
import { supabase } from '@/lib/supabase';

interface MarcaItem { id: string; nombre: string }

interface FacturacionMarcaRow {
  marca_id: string | null;
  marca_nombre: string | null;
  fecha: string;
  ue_bruto: number | null;
  gl_bruto: number | null;
  je_bruto: number | null;
  web_bruto: number | null;
  dir_bruto: number | null;
  total_bruto: number | null;
  total_pedidos: number | null;
}

interface FacturacionRow {
  fecha: string;
  total_bruto: number | null;
  total_pedidos: number | null;
  uber_bruto: number | null;
  glovo_bruto: number | null;
  je_bruto: number | null;
  web_bruto: number | null;
  directa_bruto: number | null;
}

interface Props {
  periodoDesde: Date;
  periodoHasta: Date;
}

const VERDE = '#1D9E75';
const ROJO  = '#A32D2D';

const CANALES = [
  { key: 'ue',  label: 'Uber Eats',     color: '#06C167', col: 'uber_bruto'    as const, marcaCol: 'ue_bruto'  as const },
  { key: 'gl',  label: 'Glovo',         color: '#e8f442', col: 'glovo_bruto'   as const, marcaCol: 'gl_bruto'  as const },
  { key: 'je',  label: 'Just Eat',      color: '#f5a623', col: 'je_bruto'      as const, marcaCol: 'je_bruto'  as const },
  { key: 'web', label: 'Tienda online', color: '#B01D23', col: 'web_bruto'     as const, marcaCol: 'web_bruto' as const },
  { key: 'dir', label: 'Venta directa', color: '#66aaff', col: 'directa_bruto' as const, marcaCol: 'dir_bruto' as const },
];

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Formato número estilo ES "1.234,56", SIN símbolo de euro
function fmtNum(v: number, decimals = 2): string {
  if (!v || isNaN(v)) return '0,00';
  const fixed = v.toFixed(decimals);
  const [int, dec] = fixed.split('.');
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimals > 0 ? `${intFmt},${dec}` : intFmt;
}

interface CanalDistRow { key: string; label: string; color: string; importe: number; pct: number; deltaPct: number | null }

interface MarcaCardData {
  id: string;
  nombre: string;
  bruto: number;
  brutoAnt: number;
  pedidos: number;
  canales: CanalDistRow[];
}

export default function CarruselMarcas({ periodoDesde, periodoHasta }: Props) {
  const { T } = useTheme();
  const [loading, setLoading] = useState(true);
  const [totalBruto, setTotalBruto] = useState(0);
  const [totalBrutoAnt, setTotalBrutoAnt] = useState(0);
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [canalesTotal, setCanalesTotal] = useState<CanalDistRow[]>([]);
  const [marcas, setMarcas] = useState<MarcaCardData[]>([]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);

      const desdeStr = isoDate(periodoDesde);
      const hastaStr = isoDate(periodoHasta);

      // Periodo anterior (mismo tamaño)
      const ms = periodoHasta.getTime() - periodoDesde.getTime();
      const desdeAnt = new Date(periodoDesde.getTime() - ms - 86400000);
      const hastaAnt = new Date(periodoDesde.getTime() - 86400000);

      const [{ data: marcasData }, { data: facData }, { data: facAntData }, { data: facMarcaData }, { data: facMarcaAntData }] = await Promise.all([
        supabase.from('marcas').select('id,nombre').eq('estado', 'activa').order('nombre'),
        supabase.from('facturacion_diario')
          .select('fecha,total_bruto,total_pedidos,uber_bruto,glovo_bruto,je_bruto,web_bruto,directa_bruto')
          .gte('fecha', desdeStr).lte('fecha', hastaStr),
        supabase.from('facturacion_diario')
          .select('fecha,total_bruto,total_pedidos,uber_bruto,glovo_bruto,je_bruto,web_bruto,directa_bruto')
          .gte('fecha', isoDate(desdeAnt)).lte('fecha', isoDate(hastaAnt)),
        supabase.from('v_facturacion_marca')
          .select('marca_id,marca_nombre,fecha,ue_bruto,gl_bruto,je_bruto,web_bruto,dir_bruto,total_bruto,total_pedidos')
          .gte('fecha', desdeStr).lte('fecha', hastaStr),
        supabase.from('v_facturacion_marca')
          .select('marca_id,marca_nombre,fecha,ue_bruto,gl_bruto,je_bruto,web_bruto,dir_bruto,total_bruto,total_pedidos')
          .gte('fecha', isoDate(desdeAnt)).lte('fecha', isoDate(hastaAnt)),
      ]);

      if (cancel) return;

      const marcasInfo = (marcasData ?? []) as MarcaItem[];

      // ── Total Streat Lab ──
      let tBruto = 0;
      let tPed = 0;
      const canSum: Record<string, number> = {};
      for (const f of (facData ?? []) as FacturacionRow[]) {
        tBruto += Number(f.total_bruto || 0);
        tPed   += Number(f.total_pedidos || 0);
        for (const c of CANALES) {
          canSum[c.key] = (canSum[c.key] || 0) + Number((f as any)[c.col] || 0);
        }
      }
      let tBrutoAnt = 0;
      const canSumAnt: Record<string, number> = {};
      for (const f of (facAntData ?? []) as FacturacionRow[]) {
        tBrutoAnt += Number(f.total_bruto || 0);
        for (const c of CANALES) {
          canSumAnt[c.key] = (canSumAnt[c.key] || 0) + Number((f as any)[c.col] || 0);
        }
      }
      const canTotal: CanalDistRow[] = CANALES.map(c => {
        const importe = canSum[c.key] || 0;
        const importeAnt = canSumAnt[c.key] || 0;
        const pct = tBruto > 0 ? Math.round((importe / tBruto) * 100) : 0;
        const deltaPct = importeAnt > 0 ? ((importe - importeAnt) / importeAnt) * 100 : null;
        return { key: c.key, label: c.label, color: c.color, importe, pct, deltaPct };
      }).filter(r => r.importe > 0);

      // ── Por marca ──
      const porMarca: Record<string, { bruto: number; pedidos: number; canales: Record<string, number> }> = {};
      for (const r of (facMarcaData ?? []) as FacturacionMarcaRow[]) {
        if (!r.marca_id) continue;
        const id = r.marca_id;
        porMarca[id] = porMarca[id] || { bruto: 0, pedidos: 0, canales: {} };
        porMarca[id].bruto   += Number(r.total_bruto || 0);
        porMarca[id].pedidos += Number(r.total_pedidos || 0);
        for (const c of CANALES) {
          porMarca[id].canales[c.key] = (porMarca[id].canales[c.key] || 0) + Number((r as any)[c.marcaCol] || 0);
        }
      }
      const porMarcaAnt: Record<string, number> = {};
      for (const r of (facMarcaAntData ?? []) as FacturacionMarcaRow[]) {
        if (!r.marca_id) continue;
        porMarcaAnt[r.marca_id] = (porMarcaAnt[r.marca_id] || 0) + Number(r.total_bruto || 0);
      }

      const marcaCards: MarcaCardData[] = marcasInfo
        .map(m => {
          const data = porMarca[m.id];
          if (!data || data.bruto <= 0) return null;
          const brutoAnt = porMarcaAnt[m.id] || 0;
          const canales: CanalDistRow[] = CANALES.map(c => {
            const importe = data.canales[c.key] || 0;
            const pct = data.bruto > 0 ? Math.round((importe / data.bruto) * 100) : 0;
            return { key: c.key, label: c.label, color: c.color, importe, pct, deltaPct: null };
          }).filter(r => r.importe > 0);
          return {
            id: m.id,
            nombre: m.nombre,
            bruto: data.bruto,
            brutoAnt,
            pedidos: data.pedidos,
            canales,
          };
        })
        .filter((x): x is MarcaCardData => x !== null)
        .sort((a, b) => b.bruto - a.bruto);

      setTotalBruto(tBruto);
      setTotalBrutoAnt(tBrutoAnt);
      setTotalPedidos(tPed);
      setCanalesTotal(canTotal);
      setMarcas(marcaCards);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [periodoDesde.getTime(), periodoHasta.getTime()]);

  const ticketMedio = totalPedidos > 0 ? totalBruto / totalPedidos : 0;
  const deltaTotal = totalBrutoAnt > 0 ? ((totalBruto - totalBrutoAnt) / totalBrutoAnt) * 100 : null;

  // ── Estilos copiados literal de Conciliación ResumenDashboard ──
  const cardBase: CSSProperties = {
    backgroundColor: T.card,
    borderRadius: 14,
    padding: '22px 24px',
    border: `1px solid ${T.brd}`,
    minWidth: 320,
    maxWidth: 320,
    flex: '0 0 320px',
    scrollSnapAlign: 'start',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  };

  const labelCard: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    color: T.mut,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontWeight: 500,
  };

  const numGigante: CSSProperties = {
    ...kpiValueStyle(T),
    marginBottom: 4,
  };

  const divider: CSSProperties = { height: 1, backgroundColor: T.brd, margin: '16px 0' };

  // Filas distribución estilo FilaDistribucion
  function FilaCanal({ label, color, importe, pct, deltaPct }: CanalDistRow) {
    let deltaSym = '=';
    let deltaCol = T.mut;
    if (deltaPct !== null) {
      if (deltaPct > 0) deltaSym = '▲';
      else if (deltaPct < 0) deltaSym = '▼';
      if (deltaPct !== 0) deltaCol = deltaPct > 0 ? VERDE : ROJO;
    }
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{
              fontFamily: FONT.body, fontSize: 13, color: T.pri,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{label}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '76px 44px 32px', gap: 8, alignItems: 'center' }}>
            <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, fontWeight: 500, textAlign: 'right' }}>
              {fmtNum(importe)}
            </span>
            <span style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: 0.5, color: deltaCol, textAlign: 'right' }}>
              {deltaPct === null ? '—' : `${deltaSym} ${Math.abs(Math.round(deltaPct))}%`}
            </span>
            <span style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: 0.5, color: T.mut, textAlign: 'right' }}>
              {pct}%
            </span>
          </div>
        </div>
        <div style={{ height: 3, backgroundColor: T.bg, borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
          <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color }} />
        </div>
      </div>
    );
  }

  function scrollBy(delta: number) {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  }

  if (loading) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
        <div style={{ ...labelCard, marginBottom: 0 }}>Ingresos por marca</div>
        <div style={{ marginTop: 14, color: T.mut, fontFamily: FONT.body, fontSize: 12 }}>Cargando…</div>
      </div>
    );
  }

  const arrowBtn: CSSProperties = {
    background: T.card,
    border: `1px solid ${T.brd}`,
    borderRadius: '50%',
    width: 38,
    height: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: T.pri,
    flexShrink: 0,
    boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Header sección */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ ...labelCard, marginBottom: 0 }}>Ingresos por marca · período</div>
      </div>

      {/* Carrusel con flechas */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button style={arrowBtn} onClick={() => scrollBy(-340)} aria-label="Anterior">
            <ChevronLeft size={20} />
          </button>
        </div>
        <div
          ref={scrollRef}
          style={{
            display: 'flex',
            gap: 16,
            overflowX: 'auto',
            scrollBehavior: 'smooth',
            scrollSnapType: 'x mandatory',
            paddingBottom: 6,
            flex: 1,
            scrollbarWidth: 'thin',
          }}
          className="rf-marcas-scroll"
        >
          {/* Card Streat Lab — datos REALES */}
          <div style={cardBase}>
            <div style={labelCard}>STREAT LAB · TOTAL</div>
            <div style={numGigante}>{fmtNum(totalBruto)}</div>
            {deltaTotal !== null && (
              <div style={{
                fontFamily: FONT.body, fontSize: 12,
                color: deltaTotal >= 0 ? VERDE : ROJO,
                marginTop: 4, fontWeight: 500,
              }}>
                {deltaTotal >= 0 ? '▲' : '▼'} {Math.abs(Math.round(deltaTotal))}% vs período anterior
              </div>
            )}
            <div style={divider} />
            {/* Pedidos / Ticket medio */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri }}>Pedidos</span>
              <span style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, color: T.pri }}>{totalPedidos}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${T.brd}` }}>
              <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri }}>Ticket medio</span>
              <span style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, color: T.pri }}>{fmtNum(ticketMedio)}</span>
            </div>
            {/* Distribución por canal con barras */}
            <div style={{ marginTop: 10 }}>
              {canalesTotal.length === 0 ? (
                <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, padding: '8px 0' }}>
                  Sin datos en el periodo.
                </div>
              ) : (
                canalesTotal.map(c => <FilaCanal key={c.key} {...c} />)
              )}
            </div>
          </div>

          {/* Cards de marcas con datos */}
          {marcas.map(m => {
            const deltaM = m.brutoAnt > 0 ? ((m.bruto - m.brutoAnt) / m.brutoAnt) * 100 : null;
            const tmM = m.pedidos > 0 ? m.bruto / m.pedidos : 0;
            return (
              <div key={m.id} style={cardBase}>
                <div style={{ ...labelCard, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nombre}</div>
                <div style={numGigante}>{fmtNum(m.bruto)}</div>
                {deltaM !== null && (
                  <div style={{
                    fontFamily: FONT.body, fontSize: 12,
                    color: deltaM >= 0 ? VERDE : ROJO,
                    marginTop: 4, fontWeight: 500,
                  }}>
                    {deltaM >= 0 ? '▲' : '▼'} {Math.abs(Math.round(deltaM))}% vs período anterior
                  </div>
                )}
                <div style={divider} />
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri }}>Pedidos</span>
                  <span style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, color: T.pri }}>{m.pedidos}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${T.brd}` }}>
                  <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri }}>Ticket medio</span>
                  <span style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, color: T.pri }}>{fmtNum(tmM)}</span>
                </div>
                <div style={{ marginTop: 10 }}>
                  {m.canales.map(c => <FilaCanal key={c.key} {...c} />)}
                </div>
              </div>
            );
          })}

          {marcas.length === 0 && (
            <div style={{ ...cardBase, alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, textAlign: 'center' }}>
                Aún no hay desglose de pedidos por marca en el periodo seleccionado.
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button style={arrowBtn} onClick={() => scrollBy(340)} aria-label="Siguiente">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
