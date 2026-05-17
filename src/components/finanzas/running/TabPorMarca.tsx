/**
 * TabPorMarca — Running V2
 * Selector de marca + ingresos por plataforma + comisiones + margen
 */
import { useMemo, useState } from 'react';
import { useTheme, FONT, CANALES, calcNeto } from '@/styles/tokens';
import type { FactDiaria } from '@/hooks/useRunningV2';

interface Props {
  facturacion: FactDiaria[];
  facturacionYTD: FactDiaria[];
}

interface MarcaResumen {
  marcaId: string;
  bruto: number;
  neto: number;
  comisiones: number;
  pedidos: number;
  porCanal: { canal: string; bruto: number; neto: number; comisiones: number; pedidos: number; color: string }[];
}

function fmtEur(v: number): string {
  if (!v || isNaN(v)) return '0 €';
  return Math.round(v).toLocaleString('es-ES') + ' €';
}

const CANAL_MAP = CANALES.map(c => ({
  id: c.id,
  label: c.label,
  bruKey: c.bruKey,
  pedKey: c.pedKey,
  color: c.color,
  comisionPct: c.comisionPct,
  comisionFijo: c.comisionFijo,
}));

export default function TabPorMarca({ facturacion, facturacionYTD }: Props) {
  const { T } = useTheme();
  void facturacionYTD;

  const marcas = useMemo(() => {
    const map: Record<string, MarcaResumen> = {};

    for (const f of facturacion) {
      const mid = f.marca_id || 'todas';
      if (!map[mid]) {
        map[mid] = {
          marcaId: mid,
          bruto: 0, neto: 0, comisiones: 0, pedidos: 0,
          porCanal: CANAL_MAP.map(c => ({
            canal: c.label, bruto: 0, neto: 0, comisiones: 0, pedidos: 0, color: c.color,
          })),
        };
      }
      for (let i = 0; i < CANAL_MAP.length; i++) {
        const c = CANAL_MAP[i];
        const bruto = Number((f as any)[c.bruKey] || 0);
        const peds = Number((f as any)[c.pedKey] || 0);
        if (!bruto) continue;
        const neto = calcNeto(bruto, peds, { comisionPct: c.comisionPct, comisionFijo: c.comisionFijo });
        const comision = bruto - neto;
        map[mid].bruto += bruto;
        map[mid].neto += neto;
        map[mid].comisiones += comision;
        map[mid].pedidos += peds;
        map[mid].porCanal[i].bruto += bruto;
        map[mid].porCanal[i].neto += neto;
        map[mid].porCanal[i].comisiones += comision;
        map[mid].porCanal[i].pedidos += peds;
      }
    }

    return Object.values(map).sort((a, b) => b.neto - a.neto);
  }, [facturacion]);

  const [selectedMarca, setSelectedMarca] = useState('todas');

  const selected = useMemo(() => {
    if (selectedMarca === 'todas') {
      const consolidated: MarcaResumen = {
        marcaId: 'todas',
        bruto: 0, neto: 0, comisiones: 0, pedidos: 0,
        porCanal: CANAL_MAP.map(c => ({
          canal: c.label, bruto: 0, neto: 0, comisiones: 0, pedidos: 0, color: c.color,
        })),
      };
      for (const m of marcas) {
        consolidated.bruto += m.bruto;
        consolidated.neto += m.neto;
        consolidated.comisiones += m.comisiones;
        consolidated.pedidos += m.pedidos;
        for (let i = 0; i < m.porCanal.length; i++) {
          consolidated.porCanal[i].bruto += m.porCanal[i].bruto;
          consolidated.porCanal[i].neto += m.porCanal[i].neto;
          consolidated.porCanal[i].comisiones += m.porCanal[i].comisiones;
          consolidated.porCanal[i].pedidos += m.porCanal[i].pedidos;
        }
      }
      return consolidated;
    }
    return marcas.find(m => m.marcaId === selectedMarca) || null;
  }, [selectedMarca, marcas]);

  const cardStyle: React.CSSProperties = {
    background: T.card,
    border: `1px solid ${T.brd}`,
    borderRadius: 16,
    padding: 24,
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'Oswald, sans-serif',
    fontSize: 11,
    letterSpacing: '0.14em',
    color: T.mut,
    fontWeight: 500,
    marginBottom: 10,
    textTransform: 'uppercase',
  };

  if (marcas.length === 0) {
    return (
      <div style={{ marginTop: 18, padding: 32, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>
        Sin datos de facturación en este periodo
      </div>
    );
  }

  const margenPct = selected && selected.bruto > 0
    ? ((selected.neto / selected.bruto) * 100)
    : 0;

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedMarca('todas')}
          style={{
            padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: selectedMarca === 'todas' ? '#B01D23' : T.card,
            color: selectedMarca === 'todas' ? '#fff' : T.sec,
            fontFamily: FONT.body, fontSize: 12, fontWeight: 500,
          }}
        >
          Todas
        </button>
        {marcas.filter(m => m.marcaId !== 'todas').map(m => (
          <button
            key={m.marcaId}
            onClick={() => setSelectedMarca(m.marcaId)}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: selectedMarca === m.marcaId ? '#B01D23' : T.card,
              color: selectedMarca === m.marcaId ? '#fff' : T.sec,
              fontFamily: FONT.body, fontSize: 12, fontWeight: 500,
            }}
          >
            {m.marcaId}
          </button>
        ))}
      </div>

      {selected && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
            <div style={cardStyle}>
              <div style={labelStyle}>Ingresos brutos</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: T.pri, fontFamily: 'Lexend' }}>{fmtEur(selected.bruto)}</div>
              <div style={{ fontSize: 11, color: T.mut, marginTop: 4 }}>{selected.pedidos} pedidos</div>
            </div>
            <div style={cardStyle}>
              <div style={labelStyle}>Comisiones plataformas</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#B01D23', fontFamily: 'Lexend' }}>−{fmtEur(selected.comisiones)}</div>
            </div>
            <div style={cardStyle}>
              <div style={labelStyle}>Margen (ingresos − comisiones)</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1D9E75', fontFamily: 'Lexend' }}>{fmtEur(selected.neto)}</div>
              <div style={{ fontSize: 12, color: T.mut, marginTop: 4 }}>Margen: {Math.round(margenPct)}%</div>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={labelStyle}>Desglose por canal</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Lexend', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.brd}` }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: T.mut, fontWeight: 500 }}>Canal</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: T.mut, fontWeight: 500 }}>Bruto</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: T.mut, fontWeight: 500 }}>Comisiones</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: T.mut, fontWeight: 500 }}>Neto</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: T.mut, fontWeight: 500 }}>Pedidos</th>
                </tr>
              </thead>
              <tbody>
                {selected.porCanal.filter(c => c.bruto > 0).map(c => (
                  <tr key={c.canal} style={{ borderBottom: `1px solid ${T.brd}` }}>
                    <td style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
                      {c.canal}
                    </td>
                    <td style={{ textAlign: 'right', padding: '8px' }}>{fmtEur(c.bruto)}</td>
                    <td style={{ textAlign: 'right', padding: '8px', color: '#B01D23' }}>−{fmtEur(c.comisiones)}</td>
                    <td style={{ textAlign: 'right', padding: '8px', color: '#1D9E75', fontWeight: 600 }}>{fmtEur(c.neto)}</td>
                    <td style={{ textAlign: 'right', padding: '8px' }}>{c.pedidos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{
            marginTop: 16, padding: '12px 16px', background: '#fffbeb', border: '1px solid #f5d992',
            borderRadius: 8, fontSize: 12, color: '#8a6d00', fontFamily: FONT.body,
          }}>
            ℹ Los gastos operativos son compartidos entre todas las marcas y no se reparten aquí. Consulta el tab PyG detallado para ver gastos totales.
          </div>
        </>
      )}
    </div>
  );
}
