import { useEffect, useState, type CSSProperties } from 'react';
import { useTheme, FONT } from '@/styles/tokens';
import { fmtEur } from '@/utils/format';
import { supabase } from '@/lib/supabase';

interface MarcaItem { id: string; nombre: string }

interface MarcaKpi {
  id: string;
  nombre: string;
  bruto: number;
  pedidos: number;
  ticketMedio: number;
  pctTotal: number;
  hayDatos: boolean;
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

const VERDE = '#1D9E75';
const ROJO = '#A32D2D';

export default function CarruselMarcas({ periodoDesde, periodoHasta }: Props) {
  const { T } = useTheme();
  const [loading, setLoading] = useState(true);
  const [marcas, setMarcas] = useState<MarcaItem[]>([]);

  // Totales del periodo (verdad real desde facturacion_diario)
  const [totalBruto, setTotalBruto] = useState(0);
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [totalBrutoAnt, setTotalBrutoAnt] = useState(0);

  // Por marca: solo si facturacion_diario.marca_id != null
  const [porMarca, setPorMarca] = useState<Record<string, { bruto: number; pedidos: number }>>({});

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

      const [{ data: marcasData }, { data: facData }, { data: facAntData }] = await Promise.all([
        supabase.from('marcas').select('id,nombre').eq('estado', 'activa').order('nombre'),
        supabase.from('facturacion_diario')
          .select('marca_id,total_bruto,total_pedidos')
          .gte('fecha', desdeStr)
          .lte('fecha', hastaStr),
        supabase.from('facturacion_diario')
          .select('total_bruto')
          .gte('fecha', isoDate(desdeAnt))
          .lte('fecha', isoDate(hastaAnt)),
      ]);

      if (cancel) return;

      setMarcas((marcasData ?? []) as MarcaItem[]);

      let tBruto = 0;
      let tPed = 0;
      const pm: Record<string, { bruto: number; pedidos: number }> = {};
      for (const f of (facData ?? [])) {
        const b = Number((f as any).total_bruto ?? 0);
        const p = Number((f as any).total_pedidos ?? 0);
        tBruto += b;
        tPed += p;
        const mid = (f as any).marca_id;
        if (mid) {
          pm[mid] = pm[mid] || { bruto: 0, pedidos: 0 };
          pm[mid].bruto += b;
          pm[mid].pedidos += p;
        }
      }
      let tBrutoAnt = 0;
      for (const f of (facAntData ?? [])) {
        tBrutoAnt += Number((f as any).total_bruto ?? 0);
      }

      setTotalBruto(tBruto);
      setTotalPedidos(tPed);
      setTotalBrutoAnt(tBrutoAnt);
      setPorMarca(pm);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [periodoDesde.getTime(), periodoHasta.getTime()]);

  const ticketMedio = totalPedidos > 0 ? totalBruto / totalPedidos : 0;
  const deltaPct = totalBrutoAnt > 0 ? ((totalBruto - totalBrutoAnt) / totalBrutoAnt) * 100 : null;

  // Construir cards de marca (solo si hay marca_id en BD; si no, todas en placeholder)
  const cardsMarca: MarcaKpi[] = marcas.map(m => {
    const datos = porMarca[m.id];
    const bruto = datos?.bruto ?? 0;
    const pedidos = datos?.pedidos ?? 0;
    const tm = pedidos > 0 ? bruto / pedidos : 0;
    const pct = totalBruto > 0 ? (bruto / totalBruto) * 100 : 0;
    return {
      id: m.id,
      nombre: m.nombre,
      bruto,
      pedidos,
      ticketMedio: tm,
      pctTotal: pct,
      hayDatos: !!datos && datos.bruto > 0,
    };
  });
  const algunaMarcaConDatos = cardsMarca.some(c => c.hayDatos);

  // Estilos — copia literal del patrón de Conciliación / Panel Global
  const cardBase: CSSProperties = {
    backgroundColor: T.card,
    borderRadius: 14,
    padding: '20px 22px',
    border: `1px solid ${T.brd}`,
    minWidth: 220,
    maxWidth: 220,
    flex: '0 0 220px',
    scrollSnapAlign: 'start',
    display: 'flex',
    flexDirection: 'column',
  };

  const cardTotalStyle: CSSProperties = {
    ...cardBase,
    minWidth: 280,
    maxWidth: 280,
    flex: '0 0 280px',
    background: T.group,
    border: `2px solid ${T.brd}`,
  };

  const labelStyle: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 10,
    color: T.mut,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: 500,
    marginBottom: 8,
  };

  const numGrande: CSSProperties = {
    fontFamily: 'Oswald, sans-serif',
    fontSize: 28,
    fontWeight: 600,
    color: T.pri,
    lineHeight: 1.05,
    marginBottom: 2,
  };

  const numTotal: CSSProperties = {
    fontFamily: 'Oswald, sans-serif',
    fontSize: 38,
    fontWeight: 600,
    color: T.pri,
    lineHeight: 1,
    marginBottom: 4,
  };

  if (loading) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
        <div style={{ ...labelStyle, marginBottom: 0 }}>Ingresos por marca</div>
        <div style={{ marginTop: 14, color: T.mut, fontFamily: FONT.body, fontSize: 12 }}>Cargando…</div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Header sección */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ ...labelStyle, marginBottom: 0 }}>Ingresos por marca · período</div>
        <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
          {marcas.length} marca{marcas.length === 1 ? '' : 's'} activa{marcas.length === 1 ? '' : 's'}
          {!algunaMarcaConDatos && ' · datos por marca pendientes'}
        </div>
      </div>

      {/* Carrusel horizontal */}
      <div className="rf-marcas-scroll">
        {/* Card Total Streat Lab — datos reales */}
        <div style={cardTotalStyle}>
          <div style={labelStyle}>TOTAL STREAT LAB</div>
          <div style={numTotal}>{fmtEur(totalBruto)}</div>
          {deltaPct !== null && (
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: deltaPct >= 0 ? VERDE : ROJO, marginBottom: 6, fontWeight: 500 }}>
              {deltaPct >= 0 ? '▲' : '▼'} {Math.abs(Math.round(deltaPct))}% vs período anterior
            </div>
          )}
          <div style={{ height: 1, background: T.brd, margin: '10px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>Pedidos</span>
            <span style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, color: T.pri }}>{totalPedidos}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>Ticket medio</span>
            <span style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, color: T.pri }}>{fmtEur(ticketMedio)}</span>
          </div>
        </div>

        {/* Cards de marcas */}
        {cardsMarca.map(m => (
          <div key={m.id} style={cardBase}>
            <div style={{ ...labelStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nombre}</div>
            <div style={{ ...numGrande, color: m.hayDatos ? T.pri : T.mut }}>
              {m.hayDatos ? fmtEur(m.bruto) : '—'}
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginBottom: 6 }}>
              {m.hayDatos ? `${Math.round(m.pctTotal)}% del total` : 'sin datos'}
            </div>
            <div style={{ height: 1, background: T.brd, margin: '8px 0 10px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut }}>Pedidos</span>
              <span style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600, color: m.hayDatos ? T.pri : T.mut }}>
                {m.hayDatos ? m.pedidos : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut }}>TM</span>
              <span style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600, color: m.hayDatos ? T.pri : T.mut }}>
                {m.hayDatos ? fmtEur(m.ticketMedio) : '—'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {!algunaMarcaConDatos && (
        <div style={{ marginTop: 8, fontSize: 10.5, color: T.mut, fontStyle: 'italic', fontFamily: FONT.body }}>
          Cuando los pedidos se importen con marca asignada, las cards se rellenarán automáticamente. La card Total Streat Lab ya muestra datos reales del periodo.
        </div>
      )}
    </div>
  );
}
