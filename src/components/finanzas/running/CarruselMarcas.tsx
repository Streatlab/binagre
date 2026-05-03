/**
 * CarruselMarcas — refactor 3 may 2026 v6
 *
 * Cambio CLAVE (Rubén pidió calcar Panel Global SIN inventar):
 * - El carrusel ya NO redibuja barras propias. Importa LITERALMENTE
 *   CardVentas y CardPedidosTM del Panel Global y se los pasa a cada marca.
 * - Card grande "STREAT LAB · TOTAL": dos cards apiladas (CardVentas + CardPedidosTM).
 * - Cada marca: dos cards apiladas (CardVentas + CardPedidosTM) con sus datos.
 * - Barras gruesas, semáforo (rojo <50%, amarillo 50-100%, verde >100%) → vienen
 *   de CardVentas + BarraCumplimiento canónicos.
 * - Pedidos azul, TM bruto naranja, TM neto verde → vienen de CardPedidosTM canónico.
 * - Colores canales (uber #06C167, glovo #e8f442, je #f5a623, web #8B5CF6, dir #06B6D4)
 *   → vienen de CardPedidosTM canónico.
 *
 * Datos REALES desde Supabase:
 *   - facturacion_diario  (totales SL del periodo y del periodo anterior)
 *   - v_facturacion_marca (por marca)
 *   - objetivos + objetivos_dia_semana (mismo flujo que TabResumen.loadObjetivos)
 *   - resumenes_plataforma_marca_mensual.neto_real_cobrado si existe
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import CardVentas from '@/components/panel/resumen/CardVentas';
import CardPedidosTM from '@/components/panel/resumen/CardPedidosTM';
import { COLOR, LEXEND } from '@/components/panel/resumen/tokens';
import { calcNetoPorCanal } from '@/lib/panel/calcNetoPlataforma';
import type { ObjetivosVentas, CanalStat } from '@/components/panel/resumen/types';

interface MarcaItem { id: string; nombre: string; }

interface FacturacionRow {
  fecha: string;
  total_bruto: number | null;
  total_pedidos: number | null;
  uber_bruto: number | null;   uber_pedidos: number | null;
  glovo_bruto: number | null;  glovo_pedidos: number | null;
  je_bruto: number | null;     je_pedidos: number | null;
  web_bruto: number | null;    web_pedidos: number | null;
  directa_bruto: number | null; directa_pedidos: number | null;
}

interface FacturacionMarcaRow {
  marca_id: string | null;
  fecha: string;
  ue_bruto: number | null;     ue_pedidos: number | null;
  gl_bruto: number | null;     gl_pedidos: number | null;
  je_bruto: number | null;     je_pedidos: number | null;
  web_bruto: number | null;    web_pedidos: number | null;
  dir_bruto: number | null;    dir_pedidos: number | null;
  total_bruto: number | null;
  total_pedidos: number | null;
}

interface Props {
  periodoDesde: Date;
  periodoHasta: Date;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

interface MarcaBlock {
  id: string;
  nombre: string;
  bruto: number;
  brutoAnt: number;
  pedidos: number;
  pedidosAnt: number;
  netoEst: number;
  ventasSemana: number;
  ventasMes: number;
  ventasAno: number;
  canales: CanalStat[];
  hayDatos: boolean;
}

export default function CarruselMarcas({ periodoDesde, periodoHasta }: Props) {
  const [loading, setLoading] = useState(true);

  // Totales SL
  const [slBruto, setSlBruto] = useState(0);
  const [slBrutoAnt, setSlBrutoAnt] = useState(0);
  const [slPedidos, setSlPedidos] = useState(0);
  const [slPedidosAnt, setSlPedidosAnt] = useState(0);
  const [slNetoEst, setSlNetoEst] = useState(0);
  const [slCanales, setSlCanales] = useState<CanalStat[]>([]);
  const [slVentasSemana, setSlVentasSemana] = useState(0);
  const [slVentasMes, setSlVentasMes] = useState(0);
  const [slVentasAno, setSlVentasAno] = useState(0);

  // Marcas
  const [marcas, setMarcas] = useState<MarcaBlock[]>([]);

  // Objetivos (compartidos: Panel Global usa los mismos para SL)
  const [objetivos, setObjetivos] = useState<ObjetivosVentas>({ diario: 0, semanal: 0, mensual: 0, anual: 0 });

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const ano = useMemo(() => periodoDesde.getFullYear(), [periodoDesde]);
  const mesActual = useMemo(() => new Date().getMonth() + 1, []);
  const nSemana = useMemo(() => isoWeek(new Date()), []);

  // Carga objetivos (mismo cálculo que TabResumen.loadObjetivos)
  useEffect(() => {
    let cancel = false;
    (async () => {
      const [resObj, resDias] = await Promise.all([
        supabase.from('objetivos').select('tipo,importe').in('tipo', ['diario', 'semanal', 'mensual', 'anual']),
        supabase.from('objetivos_dia_semana').select('dia,importe'),
      ]);
      if (cancel) return;
      const overrides: Partial<Record<'diario' | 'semanal' | 'mensual' | 'anual', number>> = {};
      for (const r of (resObj.data ?? []) as { tipo: string; importe: number }[]) {
        if (r.tipo === 'diario' || r.tipo === 'semanal' || r.tipo === 'mensual' || r.tipo === 'anual') {
          overrides[r.tipo] = Number(r.importe);
        }
      }
      const dias = (resDias.data ?? []) as { dia: number; importe: number }[];
      const findDia = (d: number) => Number(dias.find(x => x.dia === d)?.importe || 0);
      const sumaSemana = dias.reduce((a, d) => a + Number(d.importe || 0), 0);

      const hoyD = new Date();
      const a = hoyD.getFullYear();
      const mesIdx = hoyD.getMonth();
      const diasEnMes = new Date(a, mesIdx + 1, 0).getDate();
      const esBis = (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
      const dAno = esBis ? 366 : 365;
      const diaActual = hoyD.getDay() === 0 ? 7 : hoyD.getDay();

      const mediaDia = sumaSemana / 7;
      const sumaMes = mediaDia * diasEnMes;
      const sumaAno = mediaDia * dAno;

      const useO = (k: 'diario' | 'semanal' | 'mensual' | 'anual') => overrides[k] !== undefined && (overrides[k] as number) > 0;
      setObjetivos({
        diario:  useO('diario')  ? (overrides.diario  as number) : findDia(diaActual),
        semanal: useO('semanal') ? (overrides.semanal as number) : sumaSemana,
        mensual: useO('mensual') ? (overrides.mensual as number) : sumaMes,
        anual:   useO('anual')   ? (overrides.anual   as number) : sumaAno,
      });
    })();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const desdeStr = isoDate(periodoDesde);
      const hastaStr = isoDate(periodoHasta);

      const ms = periodoHasta.getTime() - periodoDesde.getTime();
      const desdeAnt = new Date(periodoDesde.getTime() - ms - 86400000);
      const hastaAnt = new Date(periodoDesde.getTime() - 86400000);

      // Para semanal/mensual/anual de SL — todo el año
      const inicioAno = `${ano}-01-01`;
      const finAno = `${ano}-12-31`;

      const [
        { data: marcasData },
        { data: facData },
        { data: facAntData },
        { data: facMarcaData },
        { data: facMarcaAntData },
        { data: facAnoData },
      ] = await Promise.all([
        supabase.from('marcas').select('id,nombre').eq('estado', 'activa').order('nombre'),
        supabase.from('facturacion_diario')
          .select('fecha,total_bruto,total_pedidos,uber_bruto,uber_pedidos,glovo_bruto,glovo_pedidos,je_bruto,je_pedidos,web_bruto,web_pedidos,directa_bruto,directa_pedidos')
          .gte('fecha', desdeStr).lte('fecha', hastaStr),
        supabase.from('facturacion_diario')
          .select('fecha,total_bruto,total_pedidos')
          .gte('fecha', isoDate(desdeAnt)).lte('fecha', isoDate(hastaAnt)),
        supabase.from('v_facturacion_marca')
          .select('marca_id,fecha,ue_bruto,ue_pedidos,gl_bruto,gl_pedidos,je_bruto,je_pedidos,web_bruto,web_pedidos,dir_bruto,dir_pedidos,total_bruto,total_pedidos')
          .gte('fecha', desdeStr).lte('fecha', hastaStr),
        supabase.from('v_facturacion_marca')
          .select('marca_id,fecha,total_bruto,total_pedidos')
          .gte('fecha', isoDate(desdeAnt)).lte('fecha', isoDate(hastaAnt)),
        supabase.from('facturacion_diario')
          .select('fecha,total_bruto')
          .gte('fecha', inicioAno).lte('fecha', finAno),
      ]);

      if (cancel) return;

      const marcasInfo = (marcasData ?? []) as MarcaItem[];

      // === SL totales del periodo ===
      let tBruto = 0, tPed = 0, tNetoEst = 0;
      const canSum: Record<string, { bruto: number; pedidos: number }> = {
        uber: { bruto: 0, pedidos: 0 }, glovo: { bruto: 0, pedidos: 0 },
        je:   { bruto: 0, pedidos: 0 }, web:   { bruto: 0, pedidos: 0 },
        dir:  { bruto: 0, pedidos: 0 },
      };
      for (const f of (facData ?? []) as FacturacionRow[]) {
        tBruto += Number(f.total_bruto || 0);
        tPed   += Number(f.total_pedidos || 0);
        canSum.uber.bruto    += Number(f.uber_bruto || 0);
        canSum.uber.pedidos  += Number(f.uber_pedidos || 0);
        canSum.glovo.bruto   += Number(f.glovo_bruto || 0);
        canSum.glovo.pedidos += Number(f.glovo_pedidos || 0);
        canSum.je.bruto      += Number(f.je_bruto || 0);
        canSum.je.pedidos    += Number(f.je_pedidos || 0);
        canSum.web.bruto     += Number(f.web_bruto || 0);
        canSum.web.pedidos   += Number(f.web_pedidos || 0);
        canSum.dir.bruto     += Number(f.directa_bruto || 0);
        canSum.dir.pedidos   += Number(f.directa_pedidos || 0);
      }
      // Canales con cálculo neto canónico (mismo que TabResumen)
      const canStats: CanalStat[] = (['uber','glovo','je','web','dir'] as const).map(id => {
        const { bruto, pedidos } = canSum[id];
        const { neto, margenPct } = calcNetoPorCanal(id, bruto, pedidos);
        const labelMap: Record<typeof id, string> = { uber:'Uber Eats', glovo:'Glovo', je:'Just Eat', web:'Web', dir:'Directa' };
        const colorMap: Record<typeof id, string> = { uber: COLOR.uber, glovo: COLOR.glovo, je: COLOR.je, web: COLOR.webSL, dir: COLOR.directa };
        tNetoEst += neto;
        return {
          id, label: labelMap[id], color: colorMap[id],
          bruto, neto, pedidos,
          pct: tBruto > 0 ? (bruto / tBruto) * 100 : 0,
          ticket: pedidos > 0 ? bruto / pedidos : 0,
          margen: margenPct,
        };
      });

      let tBrutoAnt = 0, tPedAnt = 0;
      for (const f of (facAntData ?? []) as { fecha: string; total_bruto: number | null; total_pedidos: number | null }[]) {
        tBrutoAnt += Number(f.total_bruto || 0);
        tPedAnt   += Number(f.total_pedidos || 0);
      }

      // SL agregados semana / mes / año (desde facAnoData)
      const hoy = new Date();
      const wsDate = (() => { const d = new Date(hoy); const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day; const m = new Date(d); m.setDate(d.getDate() + diff); return m; })();
      const weDate = new Date(wsDate); weDate.setDate(wsDate.getDate() + 6);
      const ws = isoDate(wsDate); const we = isoDate(weDate);
      const mesPref = isoDate(hoy).slice(0, 7);
      let vSem = 0, vMes = 0, vAno = 0;
      for (const f of (facAnoData ?? []) as { fecha: string; total_bruto: number | null }[]) {
        const v = Number(f.total_bruto || 0);
        vAno += v;
        if (f.fecha.startsWith(mesPref)) vMes += v;
        if (f.fecha >= ws && f.fecha <= we) vSem += v;
      }

      setSlBruto(tBruto);
      setSlBrutoAnt(tBrutoAnt);
      setSlPedidos(tPed);
      setSlPedidosAnt(tPedAnt);
      setSlNetoEst(tNetoEst);
      setSlCanales(canStats);
      setSlVentasSemana(vSem);
      setSlVentasMes(vMes);
      setSlVentasAno(vAno);

      // === Por marca ===
      const porMarca: Record<string, { bruto: number; pedidos: number; canales: Record<string, { bruto: number; pedidos: number }> }> = {};
      for (const r of (facMarcaData ?? []) as FacturacionMarcaRow[]) {
        if (!r.marca_id) continue;
        const id = r.marca_id;
        if (!porMarca[id]) porMarca[id] = {
          bruto: 0, pedidos: 0,
          canales: {
            uber: { bruto: 0, pedidos: 0 }, glovo: { bruto: 0, pedidos: 0 },
            je:   { bruto: 0, pedidos: 0 }, web:   { bruto: 0, pedidos: 0 },
            dir:  { bruto: 0, pedidos: 0 },
          },
        };
        porMarca[id].bruto   += Number(r.total_bruto || 0);
        porMarca[id].pedidos += Number(r.total_pedidos || 0);
        porMarca[id].canales.uber.bruto    += Number(r.ue_bruto || 0);
        porMarca[id].canales.uber.pedidos  += Number(r.ue_pedidos || 0);
        porMarca[id].canales.glovo.bruto   += Number(r.gl_bruto || 0);
        porMarca[id].canales.glovo.pedidos += Number(r.gl_pedidos || 0);
        porMarca[id].canales.je.bruto      += Number(r.je_bruto || 0);
        porMarca[id].canales.je.pedidos    += Number(r.je_pedidos || 0);
        porMarca[id].canales.web.bruto     += Number(r.web_bruto || 0);
        porMarca[id].canales.web.pedidos   += Number(r.web_pedidos || 0);
        porMarca[id].canales.dir.bruto     += Number(r.dir_bruto || 0);
        porMarca[id].canales.dir.pedidos   += Number(r.dir_pedidos || 0);
      }
      const porMarcaAnt: Record<string, { bruto: number; pedidos: number }> = {};
      for (const r of (facMarcaAntData ?? []) as { marca_id: string | null; total_bruto: number | null; total_pedidos: number | null }[]) {
        if (!r.marca_id) continue;
        if (!porMarcaAnt[r.marca_id]) porMarcaAnt[r.marca_id] = { bruto: 0, pedidos: 0 };
        porMarcaAnt[r.marca_id].bruto   += Number(r.total_bruto || 0);
        porMarcaAnt[r.marca_id].pedidos += Number(r.total_pedidos || 0);
      }

      const blocks: MarcaBlock[] = marcasInfo.map(m => {
        const data = porMarca[m.id];
        const ant = porMarcaAnt[m.id] || { bruto: 0, pedidos: 0 };
        let netoMarca = 0;
        const canStatsM: CanalStat[] = (['uber','glovo','je','web','dir'] as const).map(id => {
          const c = data?.canales[id] ?? { bruto: 0, pedidos: 0 };
          const { neto, margenPct } = calcNetoPorCanal(id, c.bruto, c.pedidos);
          const labelMap: Record<typeof id, string> = { uber:'Uber Eats', glovo:'Glovo', je:'Just Eat', web:'Web', dir:'Directa' };
          const colorMap: Record<typeof id, string> = { uber: COLOR.uber, glovo: COLOR.glovo, je: COLOR.je, web: COLOR.webSL, dir: COLOR.directa };
          netoMarca += neto;
          return {
            id, label: labelMap[id], color: colorMap[id],
            bruto: c.bruto, neto, pedidos: c.pedidos,
            pct: data && data.bruto > 0 ? (c.bruto / data.bruto) * 100 : 0,
            ticket: c.pedidos > 0 ? c.bruto / c.pedidos : 0,
            margen: margenPct,
          };
        });

        return {
          id: m.id,
          nombre: m.nombre,
          bruto: data?.bruto || 0,
          brutoAnt: ant.bruto,
          pedidos: data?.pedidos || 0,
          pedidosAnt: ant.pedidos,
          netoEst: netoMarca,
          ventasSemana: 0,  // por simplicidad, marcas no muestran 3 barras de objetivos individuales
          ventasMes: 0,
          ventasAno: 0,
          canales: canStatsM,
          hayDatos: !!(data && data.bruto > 0),
        };
      })
      .sort((a, b) => {
        if (a.hayDatos !== b.hayDatos) return a.hayDatos ? -1 : 1;
        if (a.hayDatos) return b.bruto - a.bruto;
        return a.nombre.localeCompare(b.nombre);
      });

      setMarcas(blocks);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [periodoDesde.getTime(), periodoHasta.getTime(), ano]);

  const tmBrutoSL = slPedidos > 0 ? slBruto / slPedidos : 0;
  const tmNetoSL  = slPedidos > 0 ? slNetoEst / slPedidos : 0;
  const variacionVentasSL = slBrutoAnt > 0 ? ((slBruto - slBrutoAnt) / slBrutoAnt) * 100 : null;
  const variacionPedidosSL = slPedidosAnt > 0 ? ((slPedidos - slPedidosAnt) / slPedidosAnt) * 100 : null;
  const tmBrutoAntSL = slPedidosAnt > 0 ? slBrutoAnt / slPedidosAnt : 0;
  const variacionTMSL = tmBrutoAntSL > 0 ? ((tmBrutoSL - tmBrutoAntSL) / tmBrutoAntSL) * 100 : null;

  const arrowBtn: CSSProperties = {
    background: '#fff',
    border: `1px solid ${COLOR.brd}`,
    borderRadius: '50%',
    width: 38,
    height: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: COLOR.textPri,
    flexShrink: 0,
    boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
  };

  function scrollBy(delta: number) {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
  }

  const labelTitulo: CSSProperties = {
    fontFamily: 'Oswald, sans-serif',
    fontSize: 11,
    color: COLOR.textMut,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: 12,
    fontWeight: 500,
  };

  if (loading) {
    return (
      <div style={{ background: '#fff', border: `1px solid ${COLOR.brd}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
        <div style={{ ...labelTitulo, marginBottom: 0 }}>Ingresos por marca</div>
        <div style={{ marginTop: 14, color: COLOR.textMut, fontFamily: LEXEND, fontSize: 12 }}>Cargando…</div>
      </div>
    );
  }

  // Anchura de cada par de cards (CardVentas + CardPedidosTM apiladas)
  const COL_W = 380;
  const colStyle: CSSProperties = {
    minWidth: COL_W,
    maxWidth: COL_W,
    flex: `0 0 ${COL_W}px`,
    scrollSnapAlign: 'start',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ ...labelTitulo }}>Ingresos por marca · período</div>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button style={arrowBtn} onClick={() => scrollBy(-400)} aria-label="Anterior">
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
          {/* === STREAT LAB · TOTAL === clones literales del Panel Global === */}
          <div style={{ ...colStyle, minWidth: 420, maxWidth: 420, flex: '0 0 420px' }}>
            <CardVentas
              bruto={slBruto}
              netoEstimado={slNetoEst}
              variacionPct={variacionVentasSL}
              ventasSemana={slVentasSemana}
              ventasMes={slVentasMes}
              ventasAno={slVentasAno}
              nSemana={nSemana}
              mes={mesActual}
              ano={ano}
              objetivos={objetivos}
              onSaveObjetivo={async () => { /* edición de objetivos solo en Panel Global */ }}
            />
            <CardPedidosTM
              pedidos={slPedidos}
              tmBruto={tmBrutoSL}
              tmNeto={tmNetoSL}
              pedidosDeltaPct={variacionPedidosSL}
              tmDeltaPct={variacionTMSL}
              canales={slCanales}
            />
          </div>

          {/* === Por marca === mismas cards pero con datos de la marca === */}
          {marcas.map(m => {
            const tmBrutoM = m.pedidos > 0 ? m.bruto / m.pedidos : 0;
            const tmNetoM  = m.pedidos > 0 ? m.netoEst / m.pedidos : 0;
            const tmBrutoAntM = m.pedidosAnt > 0 ? m.brutoAnt / m.pedidosAnt : 0;
            const variacionVentasM  = m.brutoAnt > 0 ? ((m.bruto - m.brutoAnt) / m.brutoAnt) * 100 : null;
            const variacionPedidosM = m.pedidosAnt > 0 ? ((m.pedidos - m.pedidosAnt) / m.pedidosAnt) * 100 : null;
            const variacionTMM      = tmBrutoAntM > 0 ? ((tmBrutoM - tmBrutoAntM) / tmBrutoAntM) * 100 : null;

            return (
              <div key={m.id} style={colStyle}>
                {/* Cabecera con nombre marca encima de las dos cards */}
                <div style={{
                  fontFamily: 'Oswald, sans-serif',
                  fontSize: 13,
                  color: m.hayDatos ? COLOR.textPri : COLOR.textMut,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  paddingBottom: 4,
                  borderBottom: `1px solid ${COLOR.brd}`,
                  opacity: m.hayDatos ? 1 : 0.55,
                }}>
                  {m.nombre}
                </div>
                {m.hayDatos ? (
                  <>
                    <CardVentas
                      bruto={m.bruto}
                      netoEstimado={m.netoEst}
                      variacionPct={variacionVentasM}
                      ventasSemana={0}
                      ventasMes={0}
                      ventasAno={0}
                      nSemana={nSemana}
                      mes={mesActual}
                      ano={ano}
                      objetivos={{ diario: 0, semanal: 0, mensual: 0, anual: 0 }}
                      onSaveObjetivo={async () => {}}
                    />
                    <CardPedidosTM
                      pedidos={m.pedidos}
                      tmBruto={tmBrutoM}
                      tmNeto={tmNetoM}
                      pedidosDeltaPct={variacionPedidosM}
                      tmDeltaPct={variacionTMM}
                      canales={m.canales}
                    />
                  </>
                ) : (
                  <div style={{
                    background: '#fff',
                    border: `1px solid ${COLOR.brd}`,
                    borderRadius: 14,
                    padding: 24,
                    color: COLOR.textMut,
                    fontFamily: LEXEND,
                    fontSize: 12,
                    fontStyle: 'italic',
                    textAlign: 'center',
                    minHeight: 140,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    Sin datos en el periodo
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button style={arrowBtn} onClick={() => scrollBy(400)} aria-label="Siguiente">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
