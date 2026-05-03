import { useEffect, useState, type CSSProperties } from 'react';
import { useTheme, FONT } from '@/styles/tokens';
import { fmtEur } from '@/utils/format';
import { supabase } from '@/lib/supabase';

interface MarcaActiva {
  id: string;
  nombre: string;
  color?: string | null;
}

interface MarcaKpi {
  id: string;
  nombre: string;
  color: string;
  bruto: number;
  pedidos: number;
  tm: number;
  pctTotal: number;
  deltaPct: number | null;
  /** Porcentajes 0-100 sobre el bruto de la marca, en orden UE / GL / JE / Web / Directa */
  mixCanales: { uber: number; glovo: number; je: number; web: number; directa: number };
}

interface Props {
  periodoLabel: string;
}

const COLORES_FALLBACK = ['#B01D23', '#185FA5', '#0F6E56', '#854F0B', '#5A3D9E', '#C8500A'];

export default function CarruselMarcas({ periodoLabel }: Props) {
  const { T } = useTheme();
  const [loading, setLoading] = useState(true);
  const [marcas, setMarcas] = useState<MarcaKpi[]>([]);
  const [totalBruto, setTotalBruto] = useState(0);
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [totalTm, setTotalTm] = useState(0);
  const [totalDelta, setTotalDelta] = useState<number | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data: marcasData } = await supabase
        .from('marcas')
        .select('id, nombre, color, activa, estado')
        .order('nombre');
      if (cancel) return;
      const activas: MarcaActiva[] = (marcasData ?? [])
        .filter((m: any) => m.activa !== false && m.estado !== 'pausada')
        .map((m: any) => ({ id: m.id, nombre: m.nombre, color: m.color }));

      // Mientras facturacion_diario no tenga marca_id, no podemos romper el % por marca.
      // Mostramos las marcas activas sin datos reales y un mensaje cuando proceda.
      const kpis: MarcaKpi[] = activas.map((m, i) => ({
        id: m.id,
        nombre: m.nombre,
        color: m.color || COLORES_FALLBACK[i % COLORES_FALLBACK.length],
        bruto: 0,
        pedidos: 0,
        tm: 0,
        pctTotal: 0,
        deltaPct: null,
        mixCanales: { uber: 0, glovo: 0, je: 0, web: 0, directa: 0 },
      }));

      setMarcas(kpis);
      setTotalBruto(0);
      setTotalPedidos(0);
      setTotalTm(0);
      setTotalDelta(null);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, []);

  const wrap: CSSProperties = {
    backgroundColor: T.card,
    border: `1px solid ${T.brd}`,
    borderRadius: 14,
    padding: '18px 20px',
    marginBottom: 16,
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 8,
  };

  const labelStyle: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    color: T.mut,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    fontWeight: 500,
  };

  const subStyle: CSSProperties = {
    fontFamily: FONT.body,
    fontSize: 11,
    color: T.mut,
  };

  const cardBase: CSSProperties = {
    background: T.card,
    border: `0.5px solid ${T.brd}`,
    borderRadius: 12,
    padding: '14px 16px',
    minWidth: 240,
    maxWidth: 240,
    cursor: 'pointer',
    transition: 'border-color 150ms, transform 150ms',
  };

  if (loading) {
    return (
      <div style={wrap}>
        <div style={headerStyle}>
          <div style={labelStyle}>INGRESOS POR MARCA · {periodoLabel.toUpperCase()}</div>
        </div>
        <div style={{ padding: 20, textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 12 }}>
          Cargando marcas…
        </div>
      </div>
    );
  }

  if (marcas.length === 0) {
    return (
      <div style={wrap}>
        <div style={headerStyle}>
          <div style={labelStyle}>INGRESOS POR MARCA · {periodoLabel.toUpperCase()}</div>
        </div>
        <div style={{
          padding: '24px 20px',
          textAlign: 'center',
          fontFamily: FONT.body,
          fontSize: 13,
          color: T.mut,
          background: T.group,
          borderRadius: 10,
          border: `1px dashed ${T.brd}`,
        }}>
          Sin marcas activas. Da de alta marcas en Configuración → Marcas.
        </div>
      </div>
    );
  }

  // Mientras no hay datos por marca, mostramos cards con placeholder claro
  const hayDatos = marcas.some(m => m.bruto > 0);

  return (
    <div style={wrap}>
      <div style={headerStyle}>
        <div style={labelStyle}>INGRESOS POR MARCA · {periodoLabel.toUpperCase()}</div>
        <div style={subStyle}>{marcas.length} marca{marcas.length === 1 ? '' : 's'} activa{marcas.length === 1 ? '' : 's'}{!hayDatos && ' · datos por marca pendientes'}</div>
      </div>

      <div className="rf-marcas-scroll">
        {marcas.map(m => (
          <div
            key={m.id}
            className="rf-marca-card"
            style={cardBase}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = m.color; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = T.brd; }}
          >
            <div style={{ fontFamily: FONT.heading, fontSize: 13, color: T.pri, letterSpacing: 0.7, textTransform: 'uppercase', fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: m.color }}></span>
              {m.nombre}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: `0.5px solid ${T.group}` }}>
              <span style={{ fontSize: 10, color: T.mut, fontFamily: FONT.body }}>Ingresos brutos</span>
              <span style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: hayDatos ? T.pri : T.mut }}>{hayDatos ? fmtEur(m.bruto) : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: `0.5px solid ${T.group}` }}>
              <span style={{ fontSize: 10, color: T.mut, fontFamily: FONT.body }}>Pedidos</span>
              <span style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: hayDatos ? T.pri : T.mut }}>{hayDatos ? m.pedidos : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: `0.5px solid ${T.group}` }}>
              <span style={{ fontSize: 10, color: T.mut, fontFamily: FONT.body }}>Ticket medio</span>
              <span style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: hayDatos ? T.pri : T.mut }}>{hayDatos ? fmtEur(m.tm) : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0' }}>
              <span style={{ fontSize: 10, color: T.mut, fontFamily: FONT.body }}>% del total</span>
              <span style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: hayDatos ? T.pri : T.mut }}>
                {hayDatos ? `${Math.round(m.pctTotal)}%` : '—'}
                {m.deltaPct !== null && (
                  <span style={{ fontSize: 10, marginLeft: 4, color: m.deltaPct >= 0 ? '#1D9E75' : '#B01D23' }}>
                    {m.deltaPct >= 0 ? '▴' : '▾'}{Math.abs(Math.round(m.deltaPct))}pp
                  </span>
                )}
              </span>
            </div>
            <div style={{ height: 4, background: T.group, borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: hayDatos ? `${m.pctTotal}%` : '0%', background: m.color }}></div>
            </div>
            {hayDatos ? (
              <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>
                <div title="Uber Eats" style={{ flex: m.mixCanales.uber || 0.01, height: 6, borderRadius: 2, background: '#06C167' }}></div>
                <div title="Glovo" style={{ flex: m.mixCanales.glovo || 0.01, height: 6, borderRadius: 2, background: '#e8f442' }}></div>
                <div title="Just Eat" style={{ flex: m.mixCanales.je || 0.01, height: 6, borderRadius: 2, background: '#f5a623' }}></div>
                <div title="Web" style={{ flex: m.mixCanales.web || 0.01, height: 6, borderRadius: 2, background: '#B01D23' }}></div>
                <div title="Directa" style={{ flex: m.mixCanales.directa || 0.01, height: 6, borderRadius: 2, background: '#66aaff' }}></div>
              </div>
            ) : (
              <div style={{ marginTop: 8, height: 6, background: T.group, borderRadius: 2 }}></div>
            )}
          </div>
        ))}

        {/* Total Streat Lab */}
        <div className="rf-marca-card" style={{ ...cardBase, background: T.group, border: 'none', cursor: 'default' }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 13, color: T.sec, letterSpacing: 0.7, textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>
            Total Streat Lab
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `0.5px solid ${T.brd}` }}>
            <span style={{ fontSize: 10, color: T.mut, fontFamily: FONT.body }}>Ingresos brutos</span>
            <span style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: hayDatos ? T.pri : T.mut }}>{hayDatos ? fmtEur(totalBruto) : '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `0.5px solid ${T.brd}` }}>
            <span style={{ fontSize: 10, color: T.mut, fontFamily: FONT.body }}>Pedidos</span>
            <span style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: hayDatos ? T.pri : T.mut }}>{hayDatos ? totalPedidos : '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `0.5px solid ${T.brd}` }}>
            <span style={{ fontSize: 10, color: T.mut, fontFamily: FONT.body }}>Ticket medio</span>
            <span style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: hayDatos ? T.pri : T.mut }}>{hayDatos ? fmtEur(totalTm) : '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ fontSize: 10, color: T.mut, fontFamily: FONT.body }}>vs anterior</span>
            <span style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: totalDelta == null ? T.mut : totalDelta >= 0 ? '#1D9E75' : '#B01D23' }}>
              {totalDelta == null ? '—' : `${totalDelta >= 0 ? '▴' : '▾'}${Math.abs(Math.round(totalDelta))}%`}
            </span>
          </div>
        </div>
      </div>

      {!hayDatos && (
        <div style={{ marginTop: 10, fontSize: 10, color: T.mut, fontStyle: 'italic', fontFamily: FONT.body }}>
          Datos por marca pendientes de activación. Cuando se importen ventas con marca asignada (campo marca_id en facturacion_diario o en pedidos), las cifras se rellenarán automáticamente.
        </div>
      )}
    </div>
  );
}
