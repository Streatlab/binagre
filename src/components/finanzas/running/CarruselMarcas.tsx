/**
 * CarruselMarcas — refactor 3 may 2026 v6
 *
 * REUTILIZA átomos del Panel Global (no copia componentes enteros):
 *  - COLORS (hex canales y semáforo)
 *  - OSWALD, LEXEND (fuentes)
 *  - lbl, lblXs (estilos label)
 *  - BarraCumplimiento (semáforo <50% ámbar, >50% verde, resto rojo)
 *  - fmtNum, fmtEur, colorSemaforo
 *
 * CONSTRUYE estructura propia adaptada a su función:
 *  - Card SL grande con barra cumplimiento mensual sobre objetivo
 *  - 5 canales con barra fina hex canon, sin separadores entre ellos
 *  - Cards por marca con misma estructura proporcionalmente
 *  - Layout horizontal con scroll y chevrones
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { COLORS, OSWALD, LEXEND, lbl, lblXs } from '@/components/panel/resumen/tokens';
import { BarraCumplimiento } from '@/components/ui/BarraCumplimiento';
import { fmtNum, fmtEur } from '@/lib/format';

interface MarcaItem { id: string; nombre: string }

interface FacturacionMarcaRow {
  marca_id: string | null;
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

interface ObjetivoRow { tipo: string; importe: number | null }
interface DiaSemRow { dia: number; importe: number | null }

interface Props {
  periodoDesde: Date;
  periodoHasta: Date;
}

// Hex canon Panel Global tokens.ts (NO inventar)
const CANALES = [
  { id: 'ue',  label: 'Uber Eats',     color: COLORS.uber,    col: 'uber_bruto'    as const, marcaCol: 'ue_bruto'  as const },
  { id: 'gl',  label: 'Glovo',         color: COLORS.glovo,   col: 'glovo_bruto'   as const, marcaCol: 'gl_bruto'  as const },
  { id: 'je',  label: 'Just Eat',      color: COLORS.je,      col: 'je_bruto'      as const, marcaCol: 'je_bruto'  as const },
  { id: 'web', label: 'Tienda online', color: COLORS.web,     col: 'web_bruto'     as const, marcaCol: 'web_bruto' as const },
  { id: 'dir', label: 'Venta directa', color: COLORS.directa, col: 'directa_bruto' as const, marcaCol: 'dir_bruto' as const },
];

// Comisiones canon hasta facturas reales (igual que Panel Global ColFacturacionCanal)
const COMISION_EST: Record<string, number> = {
  ue: 0.30, gl: 0.32, je: 0.28, web: 0.05, dir: 0.0,
};

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface CanalRow {
  id: string;
  label: string;
  color: string;
  importe: number;
  pedidos: number;
}

interface MarcaCardData {
  id: string;
  nombre: string;
  bruto: number;
  brutoAnt: number;
  pedidos: number;
  netoEst: number;
  canales: CanalRow[];
  hayDatos: boolean;
}

export default function CarruselMarcas({ periodoDesde, periodoHasta }: Props) {
  const [loading, setLoading] = useState(true);
  const [totalBruto, setTotalBruto] = useState(0);
  const [totalBrutoAnt, setTotalBrutoAnt] = useState(0);
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [totalNetoEst, setTotalNetoEst] = useState(0);
  const [canalesTotal, setCanalesTotal] = useState<CanalRow[]>([]);
  const [marcas, setMarcas] = useState<MarcaCardData[]>([]);
  const [objetivoMensual, setObjetivoMensual] = useState(0);

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

      const [
        { data: marcasData },
        { data: facData },
        { data: facAntData },
        { data: facMarcaData },
        { data: facMarcaAntData },
        { data: objData },
        { data: diasData },
      ] = await Promise.all([
        supabase.from('marcas').select('id,nombre').eq('estado', 'activa').order('nombre'),
        supabase.from('facturacion_diario')
          .select('fecha,total_bruto,total_pedidos,uber_bruto,glovo_bruto,je_bruto,web_bruto,directa_bruto')
          .gte('fecha', desdeStr).lte('fecha', hastaStr),
        supabase.from('facturacion_diario')
          .select('fecha,total_bruto,total_pedidos,uber_bruto,glovo_bruto,je_bruto,web_bruto,directa_bruto')
          .gte('fecha', isoDate(desdeAnt)).lte('fecha', isoDate(hastaAnt)),
        supabase.from('v_facturacion_marca')
          .select('marca_id,fecha,ue_bruto,gl_bruto,je_bruto,web_bruto,dir_bruto,total_bruto,total_pedidos')
          .gte('fecha', desdeStr).lte('fecha', hastaStr),
        supabase.from('v_facturacion_marca')
          .select('marca_id,fecha,total_bruto')
          .gte('fecha', isoDate(desdeAnt)).lte('fecha', isoDate(hastaAnt)),
        supabase.from('objetivos').select('tipo,importe').in('tipo', ['mensual']),
        supabase.from('objetivos_dia_semana').select('dia,importe'),
      ]);

      if (cancel) return;

      const marcasInfo = (marcasData ?? []) as MarcaItem[];

      // Totales SL del periodo
      let tBruto = 0, tPed = 0, tNeto = 0;
      const canSum: Record<string, number> = {};
      const canPed: Record<string, number> = {};
      for (const f of (facData ?? []) as FacturacionRow[]) {
        tBruto += Number(f.total_bruto || 0);
        tPed   += Number(f.total_pedidos || 0);
        for (const c of CANALES) {
          const v = Number((f as any)[c.col] || 0);
          canSum[c.id] = (canSum[c.id] || 0) + v;
          tNeto += v * (1 - (COMISION_EST[c.id] ?? 0));
        }
      }
      // Pedidos por canal: aprox proporcional a bruto del canal
      for (const c of CANALES) {
        canPed[c.id] = tBruto > 0 ? Math.round((canSum[c.id] / tBruto) * tPed) : 0;
      }

      let tBrutoAnt = 0;
      for (const f of (facAntData ?? []) as FacturacionRow[]) {
        tBrutoAnt += Number(f.total_bruto || 0);
      }

      const canTotal: CanalRow[] = CANALES.map(c => ({
        id: c.id,
        label: c.label,
        color: c.color,
        importe: canSum[c.id] || 0,
        pedidos: canPed[c.id] || 0,
      }));

      // Por marca
      const porMarca: Record<string, { bruto: number; pedidos: number; canales: Record<string, number>; pedCanales: Record<string, number>; netoEst: number }> = {};
      for (const r of (facMarcaData ?? []) as FacturacionMarcaRow[]) {
        if (!r.marca_id) continue;
        const id = r.marca_id;
        porMarca[id] = porMarca[id] || { bruto: 0, pedidos: 0, canales: {}, pedCanales: {}, netoEst: 0 };
        porMarca[id].bruto   += Number(r.total_bruto || 0);
        porMarca[id].pedidos += Number(r.total_pedidos || 0);
        for (const c of CANALES) {
          const v = Number((r as any)[c.marcaCol] || 0);
          porMarca[id].canales[c.id] = (porMarca[id].canales[c.id] || 0) + v;
          porMarca[id].netoEst += v * (1 - (COMISION_EST[c.id] ?? 0));
        }
      }
      // Pedidos por canal por marca (proporcional)
      for (const id of Object.keys(porMarca)) {
        const m = porMarca[id];
        for (const c of CANALES) {
          m.pedCanales[c.id] = m.bruto > 0 ? Math.round((m.canales[c.id] / m.bruto) * m.pedidos) : 0;
        }
      }
      const porMarcaAnt: Record<string, number> = {};
      for (const r of (facMarcaAntData ?? []) as { marca_id: string | null; total_bruto: number | null }[]) {
        if (!r.marca_id) continue;
        porMarcaAnt[r.marca_id] = (porMarcaAnt[r.marca_id] || 0) + Number(r.total_bruto || 0);
      }

      const marcaCards: MarcaCardData[] = marcasInfo.map(m => {
        const data = porMarca[m.id];
        const brutoAnt = porMarcaAnt[m.id] || 0;
        const canales: CanalRow[] = CANALES.map(c => ({
          id: c.id,
          label: c.label,
          color: c.color,
          importe: data?.canales[c.id] || 0,
          pedidos: data?.pedCanales[c.id] || 0,
        }));
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
        if (a.hayDatos !== b.hayDatos) return a.hayDatos ? -1 : 1;
        if (a.hayDatos) return b.bruto - a.bruto;
        return a.nombre.localeCompare(b.nombre);
      });

      // Objetivo mensual: usa override si existe, si no calcula desde dias_semana
      const overrideMensual = ((objData ?? []) as ObjetivoRow[]).find(o => o.tipo === 'mensual');
      let objMes = overrideMensual && Number(overrideMensual.importe || 0) > 0
        ? Number(overrideMensual.importe)
        : 0;
      if (objMes === 0) {
        const sumaSemana = ((diasData ?? []) as DiaSemRow[]).reduce((a, d) => a + Number(d.importe || 0), 0);
        const ano = periodoDesde.getFullYear();
        const mesIdx = periodoDesde.getMonth();
        const diasEnMes = new Date(ano, mesIdx + 1, 0).getDate();
        objMes = (sumaSemana / 7) * diasEnMes;
      }

      setTotalBruto(tBruto);
      setTotalBrutoAnt(tBrutoAnt);
      setTotalPedidos(tPed);
      setTotalNetoEst(tNeto);
      setCanalesTotal(canTotal);
      setMarcas(marcaCards);
      setObjetivoMensual(objMes);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [periodoDesde.getTime(), periodoHasta.getTime()]);

  const tmBruto = totalPedidos > 0 ? totalBruto / totalPedidos : 0;
  const tmNeto  = totalPedidos > 0 ? totalNetoEst / totalPedidos : 0;
  const deltaTotal = totalBrutoAnt > 0 ? ((totalBruto - totalBrutoAnt) / totalBrutoAnt) * 100 : null;

  const pctObjetivo = objetivoMensual > 0 ? (totalBruto / objetivoMensual) * 100 : 0;

  // Estilos comunes
  const cardSL: CSSProperties = {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: '22px 24px',
    border: `0.5px solid ${COLORS.brd}`,
    minWidth: 380,
    maxWidth: 380,
    flex: '0 0 380px',
    scrollSnapAlign: 'start',
    display: 'flex',
    flexDirection: 'column',
  };
  const cardMarca: CSSProperties = {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: '14px 16px',
    border: `0.5px solid ${COLORS.brd}`,
    display: 'flex',
    flexDirection: 'column',
  };
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
  const arrowBtn: CSSProperties = {
    background: COLORS.card,
    border: `0.5px solid ${COLORS.brd}`,
    borderRadius: '50%',
    width: 38,
    height: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: COLORS.pri,
    flexShrink: 0,
    boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
  };

  // Fila canal: pegada a la siguiente, sin separador.
  // Muestra: pedidos azul / TM bruto naranja / TM neto verde — mismos hex que Panel Global CardPedidosTM
  function FilaCanal({ row, totalPed, compact = false }: { row: CanalRow; totalPed: number; compact?: boolean }) {
    if (row.importe === 0) return null;
    const pctBarra = totalPed > 0 ? (row.pedidos / totalPed) * 100 : 0;
    const tBruto = row.pedidos > 0 ? row.importe / row.pedidos : 0;
    const tNeto  = row.pedidos > 0 ? (row.importe * (1 - (COMISION_EST[row.id] ?? 0))) / row.pedidos : 0;
    return (
      <div style={{ padding: compact ? '3px 0' : '5px 0' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: compact ? 11 : 12,
          marginBottom: 3,
          fontFamily: LEXEND,
          color: COLORS.pri,
        }}>
          <span>● {row.label}</span>
          <span>
            <b style={{ color: '#1E5BCC', fontWeight: 600 }}>{fmtNum(row.pedidos, 0)}</b>
            {' / '}
            <b style={{ color: '#F26B1F', fontWeight: 600 }}>{fmtNum(tBruto, 2)}</b>
            {' / '}
            <b style={{ color: COLORS.ok, fontWeight: 600 }}>{fmtNum(tNeto, 2)}</b>
          </span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: COLORS.group, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.max(pctBarra, row.pedidos > 0 ? 2 : 0)}%`,
            background: row.color,
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>
    );
  }

  function scrollBy(delta: number) {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
  }

  if (loading) {
    return (
      <div style={{ background: COLORS.card, border: `0.5px solid ${COLORS.brd}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
        <div style={lbl}>Ingresos por marca</div>
        <div style={{ marginTop: 14, color: COLORS.mut, fontFamily: LEXEND, fontSize: 12 }}>Cargando…</div>
      </div>
    );
  }

  // Card marca: misma estructura proporcionalmente reducida
  function CardMarca({ m }: { m: MarcaCardData }) {
    const tmBrutoM = m.pedidos > 0 ? m.bruto / m.pedidos : 0;
    const tmNetoM  = m.pedidos > 0 ? m.netoEst / m.pedidos : 0;
    const deltaM = m.brutoAnt > 0 ? ((m.bruto - m.brutoAnt) / m.brutoAnt) * 100 : null;
    return (
      <div style={cardMarca}>
        <div style={{
          ...lblXs,
          marginBottom: 4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          opacity: m.hayDatos ? 1 : 0.55,
        }}>{m.nombre}</div>

        {m.hayDatos ? (
          <>
            {/* Bruto Oswald 22 negro + Neto Oswald 16 verde */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: OSWALD, fontSize: 22, fontWeight: 600, color: COLORS.pri, lineHeight: 1.05 }}>
                {fmtNum(m.bruto, 2)}
              </span>
              <span style={{ fontFamily: OSWALD, fontSize: 16, fontWeight: 600, color: COLORS.ok }}>
                {fmtNum(m.netoEst, 2)}
              </span>
            </div>

            {/* delta */}
            {deltaM !== null && (
              <div style={{
                fontFamily: LEXEND,
                fontSize: 11,
                color: deltaM >= 0 ? COLORS.ok : COLORS.err,
                marginTop: 2,
              }}>
                {deltaM >= 0 ? '▲' : '▼'} {Math.abs(Math.round(deltaM))}% vs ant.
              </div>
            )}

            {/* Pedidos azul / TM bruto naranja / TM neto verde */}
            <div style={{ fontFamily: LEXEND, fontSize: 11, marginTop: 8 }}>
              <b style={{ color: '#1E5BCC', fontWeight: 600 }}>{fmtNum(m.pedidos, 0)}</b>
              <span style={{ color: COLORS.mut }}> pedidos · TM </span>
              <b style={{ color: '#F26B1F', fontWeight: 600 }}>{fmtNum(tmBrutoM, 2)}</b>
              <span style={{ color: COLORS.mut }}> / </span>
              <b style={{ color: COLORS.ok, fontWeight: 600 }}>{fmtNum(tmNetoM, 2)}</b>
            </div>

            {/* Canales pegados, sin separador */}
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column' }}>
              {m.canales.map(c => <FilaCanal key={c.id} row={c} totalPed={m.pedidos} compact />)}
            </div>
          </>
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: COLORS.mut,
            fontFamily: LEXEND,
            fontSize: 11,
            fontStyle: 'italic',
          }}>
            Sin datos en el periodo
          </div>
        )}
      </div>
    );
  }

  const columnas: MarcaCardData[][] = [];
  for (let i = 0; i < marcas.length; i += 2) {
    columnas.push(marcas.slice(i, i + 2));
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ ...lbl, marginBottom: 12 }}>Ingresos por marca · período</div>

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
        >
          {/* Card SL grande */}
          <div style={cardSL}>
            <div style={lbl}>STREAT LAB · TOTAL</div>

            {/* Bruto Oswald 38 negro + Neto Oswald 38 verde — calca tamaños CardVentas */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: OSWALD, fontSize: 38, fontWeight: 600, color: COLORS.pri }}>
                  {fmtNum(totalBruto, 2)}
                </div>
                <div style={lblXs}>BRUTO</div>
              </div>
              <div>
                <div style={{ fontFamily: OSWALD, fontSize: 38, fontWeight: 600, color: COLORS.ok }}>
                  {fmtNum(totalNetoEst, 2)}
                </div>
                <div style={{ ...lblXs, color: COLORS.ok }}>NETO ESTIMADO</div>
              </div>
            </div>

            {/* Delta vs anterior */}
            {deltaTotal !== null && (
              <div style={{
                fontSize: 12,
                color: deltaTotal >= 0 ? COLORS.ok : COLORS.err,
                margin: '10px 0 14px',
                fontFamily: LEXEND,
                fontWeight: 500,
              }}>
                {deltaTotal >= 0 ? '▲' : '▼'} {fmtNum(Math.abs(deltaTotal), 1)}% vs período anterior
              </div>
            )}

            {/* Barra cumplimiento mensual gruesa con semáforo — átomo Panel Global */}
            {objetivoMensual > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: LEXEND,
                  fontSize: 11,
                  color: COLORS.mut,
                  marginBottom: 4,
                }}>
                  <span>Objetivo mes: {fmtEur(objetivoMensual, { showEuro: false, decimals: 0 })}</span>
                  <span style={{
                    color: pctObjetivo >= 100 ? COLORS.ok : pctObjetivo >= 50 ? COLORS.warn : COLORS.err,
                    fontWeight: 600,
                  }}>
                    {Math.round(pctObjetivo)}%
                  </span>
                </div>
                <BarraCumplimiento pct={pctObjetivo} altura={10} />
              </div>
            )}

            {/* Pedidos azul Oswald 38 + TM bruto naranja Oswald 38 + TM neto verde Oswald 38 — calca CardPedidosTM */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: OSWALD, fontSize: 28, fontWeight: 600, color: '#1E5BCC' }}>
                  {fmtNum(totalPedidos, 0)}
                </div>
                <div style={{ ...lblXs, color: '#1E5BCC' }}>PEDIDOS</div>
              </div>
              <div>
                <div style={{ fontFamily: OSWALD, fontSize: 28, fontWeight: 600, color: '#F26B1F' }}>
                  {fmtNum(tmBruto, 2)}
                </div>
                <div style={{ ...lblXs, color: '#F26B1F' }}>TM BRUTO</div>
              </div>
              <div>
                <div style={{ fontFamily: OSWALD, fontSize: 28, fontWeight: 600, color: COLORS.ok }}>
                  {fmtNum(tmNeto, 2)}
                </div>
                <div style={{ ...lblXs, color: COLORS.ok }}>TM NETO</div>
              </div>
            </div>

            {/* 5 canales con barra fina hex canon, sin separadores entre ellos */}
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column' }}>
              {canalesTotal.map(c => <FilaCanal key={c.id} row={c} totalPed={totalPedidos} />)}
            </div>
          </div>

          {/* Columnas de cards de marca */}
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
