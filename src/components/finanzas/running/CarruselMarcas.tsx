/**
 * CarruselMarcas — refactor 3 may 2026 v3
 *
 * Reglas (Rubén):
 * - Card Streat Lab grande: pedidos #1E5BCC, TM bruto #F26B1F naranja, TM neto verde, separados por "/"
 * - Quita las 2 líneas separadoras (la de pedidos y la de TM)
 * - 5 canales con barras: Uber, Glovo, Just Eat, Web (#8B5CF6), Directa (#06B6D4)
 * - Todas las marcas activas aparecen, con o sin datos. Las marcas se renderizan en cards medianas
 *   (mitad de altura) en filas de a 2 (grid 2 columnas).
 * - Sin símbolo €.
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
const AZUL_PEDIDOS = '#1E5BCC';
const NARANJA_BRUTO = '#F26B1F';

const CANALES = [
  { id: 'ue',  label: 'Uber Eats',     color: '#06C167', col: 'uber_bruto'    as const, marcaCol: 'ue_bruto'  as const },
  { id: 'gl',  label: 'Glovo',         color: '#e8f442', col: 'glovo_bruto'   as const, marcaCol: 'gl_bruto'  as const },
  { id: 'je',  label: 'Just Eat',      color: '#f5a623', col: 'je_bruto'      as const, marcaCol: 'je_bruto'  as const },
  { id: 'web', label: 'Tienda online', color: '#8B5CF6', col: 'web_bruto'     as const, marcaCol: 'web_bruto' as const },
  { id: 'dir', label: 'Venta directa', color: '#06B6D4', col: 'directa_bruto' as const, marcaCol: 'dir_bruto' as const },
];

// Margen estimado plataforma → neto = bruto * (1 - comision)
const COMISION_EST: Record<string, number> = {
  ue: 0.30, gl: 0.32, je: 0.28, web: 0.05, dir: 0.0,
};

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtNum(v: number, decimals = 2): string {
  if (!v || isNaN(v)) return '0,00';
  const fixed = v.toFixed(decimals);
  const [int, dec] = fixed.split('.');
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimals > 0 ? `${intFmt},${dec}` : intFmt;
}
function fmtInt(v: number): string {
  if (!v || isNaN(v)) return '0';
  return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

interface CanalDistRow {
  id: string;
  label: string;
  color: string;
  importe: number;
  pct: number;
}

interface MarcaCardData {
  id: string;
  nombre: string;
  bruto: number;
  brutoAnt: number;
  pedidos: number;
  netoEst: number;
  canales: CanalDistRow[];
  hayDatos: boolean;
}

export default function CarruselMarcas({ periodoDesde, periodoHasta }: Props) {
  const { T } = useTheme();
  const [loading, setLoading] = useState(true);
  const [totalBruto, setTotalBruto] = useState(0);
  const [totalBrutoAnt, setTotalBrutoAnt] = useState(0);
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [totalNetoEst, setTotalNetoEst] = useState(0);
  const [canalesTotal, setCanalesTotal] = useState<CanalDistRow[]>([]);
  const [marcas, setMarcas] = useState<MarcaCardData[]>([]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);

      const desdeStr = isoDate(periodoDesde);
      const hastaStr = isoDate(periodoHasta);

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

      let tBruto = 0;
      let tPed = 0;
      let tNeto = 0;
      const canSum: Record<string, number> = {};
      for (const f of (facData ?? []) as FacturacionRow[]) {
        tBruto += Number(f.total_bruto || 0);
        tPed   += Number(f.total_pedidos || 0);
        for (const c of CANALES) {
          const v = Number((f as any)[c.col] || 0);
          canSum[c.id] = (canSum[c.id] || 0) + v;
          tNeto += v * (1 - (COMISION_EST[c.id] ?? 0));
        }
      }
      let tBrutoAnt = 0;
      for (const f of (facAntData ?? []) as FacturacionRow[]) {
        tBrutoAnt += Number(f.total_bruto || 0);
      }
      const canTotal: CanalDistRow[] = CANALES.map(c => {
        const importe = canSum[c.id] || 0;
        const pct = tBruto > 0 ? Math.round((importe / tBruto) * 100) : 0;
        return { id: c.id, label: c.label, color: c.color, importe, pct };
      });

      const porMarca: Record<string, { bruto: number; pedidos: number; canales: Record<string, number>; netoEst: number }> = {};
      for (const r of (facMarcaData ?? []) as FacturacionMarcaRow[]) {
        if (!r.marca_id) continue;
        const id = r.marca_id;
        porMarca[id] = porMarca[id] || { bruto: 0, pedidos: 0, canales: {}, netoEst: 0 };
        porMarca[id].bruto   += Number(r.total_bruto || 0);
        porMarca[id].pedidos += Number(r.total_pedidos || 0);
        for (const c of CANALES) {
          const v = Number((r as any)[c.marcaCol] || 0);
          porMarca[id].canales[c.id] = (porMarca[id].canales[c.id] || 0) + v;
          porMarca[id].netoEst += v * (1 - (COMISION_EST[c.id] ?? 0));
        }
      }
      const porMarcaAnt: Record<string, number> = {};
      for (const r of (facMarcaAntData ?? []) as FacturacionMarcaRow[]) {
        if (!r.marca_id) continue;
        porMarcaAnt[r.marca_id] = (porMarcaAnt[r.marca_id] || 0) + Number(r.total_bruto || 0);
      }

      // TODAS las marcas activas, con datos o sin datos
      const marcaCards: MarcaCardData[] = marcasInfo.map(m => {
        const data = porMarca[m.id];
        const brutoAnt = porMarcaAnt[m.id] || 0;
        const canales: CanalDistRow[] = CANALES.map(c => {
          const importe = data?.canales[c.id] || 0;
          const pct = data && data.bruto > 0 ? Math.round((importe / data.bruto) * 100) : 0;
          return { id: c.id, label: c.label, color: c.color, importe, pct };
        });
        return {
          id: m.id,
          nombre: m.nombre,
          bruto: data?.bruto || 0,
          brutoAnt,
          pedidos: data?.pedidos || 0,
          netoEst: data?.netoEst || 0,
          canales,
          hayDatos: !!(data && data.bruto > 0),
        };
      })
      .sort((a, b) => {
        // Con datos primero, dentro de cada grupo por bruto desc o por nombre
        if (a.hayDatos !== b.hayDatos) return a.hayDatos ? -1 : 1;
        if (a.hayDatos) return b.bruto - a.bruto;
        return a.nombre.localeCompare(b.nombre);
      });

      setTotalBruto(tBruto);
      setTotalBrutoAnt(tBrutoAnt);
      setTotalPedidos(tPed);
      setTotalNetoEst(tNeto);
      setCanalesTotal(canTotal);
      setMarcas(marcaCards);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [periodoDesde.getTime(), periodoHasta.getTime()]);

  const tmBruto = totalPedidos > 0 ? totalBruto / totalPedidos : 0;
  const tmNeto  = totalPedidos > 0 ? totalNetoEst / totalPedidos : 0;
  const deltaTotal = totalBrutoAnt > 0 ? ((totalBruto - totalBrutoAnt) / totalBrutoAnt) * 100 : null;

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

  // === Card Streat Lab grande (full height) ===
  const cardSL: CSSProperties = {
    backgroundColor: T.card,
    borderRadius: 14,
    padding: '22px 24px',
    border: `1px solid ${T.brd}`,
    minWidth: 360,
    maxWidth: 360,
    flex: '0 0 360px',
    scrollSnapAlign: 'start',
    display: 'flex',
    flexDirection: 'column',
  };

  // === Cards de marca medianas (mitad de altura, en grid 1x2 dentro de columna) ===
  const COL_MARCA_W = 320;
  const colMarca: CSSProperties = {
    minWidth: COL_MARCA_W,
    maxWidth: COL_MARCA_W,
    flex: `0 0 ${COL_MARCA_W}px`,
    scrollSnapAlign: 'start',
    display: 'grid',
    gridTemplateRows: '1fr 1fr',
    gap: 12,
  };
  const cardMarca: CSSProperties = {
    backgroundColor: T.card,
    borderRadius: 14,
    padding: '14px 16px',
    border: `1px solid ${T.brd}`,
    display: 'flex',
    flexDirection: 'column',
  };

  function FilaCanal({ row }: { row: CanalDistRow }) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
            <span style={{
              fontFamily: FONT.body, fontSize: 12, color: T.pri,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{row.label}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.pri, fontWeight: 500 }}>
              {fmtNum(row.importe)}
            </span>
            <span style={{ fontFamily: FONT.heading, fontSize: 11, color: T.mut, minWidth: 30, textAlign: 'right' }}>
              {row.pct}%
            </span>
          </div>
        </div>
        <div style={{ height: 4, backgroundColor: T.bg, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${row.pct}%`, height: '100%', backgroundColor: row.color }} />
        </div>
      </div>
    );
  }

  function scrollBy(delta: number) {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
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

  // Agrupar marcas en columnas de 2
  const columnas: MarcaCardData[][] = [];
  for (let i = 0; i < marcas.length; i += 2) {
    columnas.push(marcas.slice(i, i + 2));
  }

  function CardMarca({ m }: { m: MarcaCardData }) {
    const tmBrutoM = m.pedidos > 0 ? m.bruto / m.pedidos : 0;
    const tmNetoM  = m.pedidos > 0 ? m.netoEst / m.pedidos : 0;
    const deltaM = m.brutoAnt > 0 ? ((m.bruto - m.brutoAnt) / m.brutoAnt) * 100 : null;
    return (
      <div style={cardMarca}>
        <div style={{
          ...labelCard,
          marginBottom: 4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          opacity: m.hayDatos ? 1 : 0.5,
        }}>{m.nombre}</div>
        {m.hayDatos ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 600, color: AZUL_PEDIDOS, lineHeight: 1 }}>{fmtInt(m.pedidos)}</div>
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri }}>
                <span style={{ color: NARANJA_BRUTO, fontWeight: 600 }}>{fmtNum(tmBrutoM)}</span>
                {' / '}
                <span style={{ color: VERDE, fontWeight: 600 }}>{fmtNum(tmNetoM)}</span>
              </div>
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 2 }}>
              pedidos · TM bruto / TM neto
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, fontWeight: 600, color: T.pri }}>{fmtNum(m.bruto)}</span>
              {deltaM !== null && (
                <span style={{ fontFamily: FONT.body, fontSize: 11, color: deltaM >= 0 ? VERDE : ROJO }}>
                  {deltaM >= 0 ? '▲' : '▼'} {Math.abs(Math.round(deltaM))}%
                </span>
              )}
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {m.canales.filter(c => c.importe > 0).map(c => <FilaCanal key={c.id} row={c} />)}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 11, fontStyle: 'italic' }}>
            Sin datos en el periodo
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ ...labelCard, marginBottom: 0 }}>Ingresos por marca · período</div>
      </div>

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
          {/* Card Streat Lab grande */}
          <div style={cardSL}>
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

            {/* Pedidos · TM bruto / TM neto en línea, sin separadores horizontales */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 30, fontWeight: 600, color: AZUL_PEDIDOS, lineHeight: 1 }}>{fmtInt(totalPedidos)}</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 9, letterSpacing: '1.5px', color: AZUL_PEDIDOS, textTransform: 'uppercase', fontWeight: 500, marginTop: 2 }}>PEDIDOS</div>
              </div>
              <div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 30, fontWeight: 600, color: NARANJA_BRUTO, lineHeight: 1 }}>{fmtNum(tmBruto)}</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 9, letterSpacing: '1.5px', color: NARANJA_BRUTO, textTransform: 'uppercase', fontWeight: 500, marginTop: 2 }}>TM BRUTO</div>
              </div>
              <div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 30, fontWeight: 600, color: VERDE, lineHeight: 1 }}>{fmtNum(tmNeto)}</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 9, letterSpacing: '1.5px', color: VERDE, textTransform: 'uppercase', fontWeight: 500, marginTop: 2 }}>TM NETO</div>
              </div>
            </div>

            {/* Distribución 5 canales con barras */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {canalesTotal.map(c => <FilaCanal key={c.id} row={c} />)}
            </div>
          </div>

          {/* Columnas de 2 marcas cada una */}
          {columnas.map((col, idx) => (
            <div key={`col-${idx}`} style={colMarca}>
              {col.map(m => <CardMarca key={m.id} m={m} />)}
              {col.length === 1 && <div />}
            </div>
          ))}
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
