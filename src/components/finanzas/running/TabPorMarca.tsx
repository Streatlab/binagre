/**
 * TabPorMarca — Running V2 tab Por Marca
 */
import { useState, useMemo } from 'react';
import { useTheme, FONT, cardStyle, CANALES, calcNeto } from '@/styles/tokens';
import type { FactDiaria } from '@/hooks/useRunningV2';

const fmtEur = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });

interface Props {
  facturacion: FactDiaria[];
  facturacionYTD: FactDiaria[];
}

export default function TabPorMarca({ facturacion, facturacionYTD }: Props) {
  const { T } = useTheme();

  const marcas = useMemo(() => {
    const set = new Map<string | null, boolean>();
    for (const f of facturacion) set.set(f.marca_id, true);
    const arr = Array.from(set.keys());
    return arr.length > 0 ? arr : [null];
  }, [facturacion]);

  const [selectedMarca, setSelectedMarca] = useState<string | null>(marcas[0]);

  const marcaCalc = useMemo(() => {
    const filtered = selectedMarca
      ? facturacion.filter(f => f.marca_id === selectedMarca)
      : facturacion;

    let totalBruto = 0, totalComisiones = 0, totalNeto = 0;
    const canalMap: Record<string, { bruto: number; pedidos: number; comision: number; neto: number }> = {};
    for (const c of CANALES) canalMap[c.id] = { bruto: 0, pedidos: 0, comision: 0, neto: 0 };

    for (const f of filtered) {
      for (const canal of CANALES) {
        const bruto = Number((f as any)[canal.bruKey] || 0);
        const pedidos = Number((f as any)[canal.pedKey] || 0);
        if (!bruto) continue;
        const neto = calcNeto(bruto, pedidos, canal);
        const comision = bruto - neto;
        canalMap[canal.id].bruto += bruto;
        canalMap[canal.id].pedidos += pedidos;
        canalMap[canal.id].comision += comision;
        canalMap[canal.id].neto += neto;
        totalBruto += bruto;
        totalComisiones += comision;
        totalNeto += neto;
      }
    }

    const canales = CANALES
      .map(c => ({ id: c.id, label: c.label, color: c.color, ...canalMap[c.id] }))
      .filter(c => c.bruto > 0);

    return { bruto: totalBruto, comisiones: totalComisiones, neto: totalNeto, canales };
  }, [facturacion, selectedMarca]);

  return (
    <div style={{ marginTop: 18 }}>
      {marcas.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {marcas.map(m => (
            <button
              key={m || 'all'}
              onClick={() => setSelectedMarca(m)}
              style={{
                padding: '5px 14px', borderRadius: 6, border: 'none',
                background: selectedMarca === m ? '#B01D23' : T.card,
                color: selectedMarca === m ? '#fff' : T.sec,
                fontFamily: FONT.body, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}
            >
              {m || 'Todas las marcas'}
            </button>
          ))}
        </div>
      )}

      {/* 3 Cards KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>
            BRUTO
          </div>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 28, fontWeight: 600, color: T.pri }}>
            {fmtEur(marcaCalc.bruto)}
          </div>
        </div>
        <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>
            COMISIONES
          </div>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 28, fontWeight: 600, color: '#B01D23' }}>
            {fmtEur(marcaCalc.comisiones)}
          </div>
          <div style={{ fontSize: 11, color: T.mut, fontFamily: FONT.body, marginTop: 4 }}>
            {marcaCalc.bruto > 0 ? ((marcaCalc.comisiones / marcaCalc.bruto) * 100).toFixed(1) : '0'}% del bruto
          </div>
        </div>
        <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>
            MARGEN NETO
          </div>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 28, fontWeight: 600, color: '#1D9E75' }}>
            {fmtEur(marcaCalc.neto)}
          </div>
        </div>
      </div>

      {/* Tabla desglose por canal */}
      <div style={{ ...cardStyle(T), padding: '18px 20px' }}>
        <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>
          DESGLOSE POR CANAL
        </div>
        {marcaCalc.canales.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT.body, fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.brd}` }}>
                <th style={{ textAlign: 'left', padding: '8px 6px', color: T.mut, fontWeight: 500, fontSize: 11 }}>Canal</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', color: T.mut, fontWeight: 500, fontSize: 11 }}>Bruto</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', color: T.mut, fontWeight: 500, fontSize: 11 }}>Pedidos</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', color: T.mut, fontWeight: 500, fontSize: 11 }}>Comisión</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', color: T.mut, fontWeight: 500, fontSize: 11 }}>Neto</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', color: T.mut, fontWeight: 500, fontSize: 11 }}>%</th>
              </tr>
            </thead>
            <tbody>
              {marcaCalc.canales.map(c => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${T.brd}` }}>
                  <td style={{ padding: '8px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                    {c.label}
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 6px', color: T.pri }}>{fmtEur(c.bruto)}</td>
                  <td style={{ textAlign: 'right', padding: '8px 6px', color: T.sec }}>{c.pedidos}</td>
                  <td style={{ textAlign: 'right', padding: '8px 6px', color: '#B01D23' }}>{fmtEur(c.comision)}</td>
                  <td style={{ textAlign: 'right', padding: '8px 6px', color: '#1D9E75', fontWeight: 500 }}>{fmtEur(c.neto)}</td>
                  <td style={{ textAlign: 'right', padding: '8px 6px', color: T.sec }}>
                    {marcaCalc.bruto > 0 ? ((c.bruto / marcaCalc.bruto) * 100).toFixed(1) + '%' : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ color: T.mut, fontSize: 12, fontFamily: FONT.body, padding: 20, textAlign: 'center' }}>
            Sin datos de facturación
          </div>
        )}
      </div>

      {/* Aviso gastos compartidos */}
      <div style={{
        marginTop: 14, padding: '10px 14px', borderRadius: 8,
        background: '#FFF8E1', border: '1px solid #f5a623',
        fontSize: 12, fontFamily: FONT.body, color: '#8B6914',
      }}>
        ⚠️ Los gastos no se desglosan por marca — son compartidos a nivel cocina.
      </div>
    </div>
  );
}
