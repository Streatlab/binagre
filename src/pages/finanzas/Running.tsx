/**
 * Running V2 — 17 may 2026
 * 4 tabs: Resumen | PyG detallado | Por marca | Comparativas
 * Datos de conciliación + facturacion_diario reales.
 */
import { useMemo, useState } from 'react';
import { useTheme, FONT } from '@/styles/tokens';
import { useRunningV2 } from '@/hooks/useRunningV2';
import { useIVA } from '@/contexts/IVAContext';
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal';
import TabsPastilla from '@/components/ui/TabsPastilla';
import TablaPyG from '@/components/finanzas/running/TablaPyG';
import TabResumenV2 from '@/components/finanzas/running/TabResumenV2';
import TabPorMarca from '@/components/finanzas/running/TabPorMarca';
import TabComparativas from '@/components/finanzas/running/TabComparativas';
import ModalAddGasto from '@/components/finanzas/running/ModalAddGasto';
import type { PeriodoRango } from '@/lib/running';

function buildSubtitulo(label: string, desde: Date, hasta: Date): string {
  const fmtDate = (d: Date) => {
    const dia = d.getDate();
    const mes = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
    const anio = d.getFullYear();
    return `${dia} ${mes} ${anio}`;
  };
  return `${label} · ${fmtDate(desde)} — ${fmtDate(hasta)}`;
}

type RunTab = 'resumen' | 'pyg' | 'marcas' | 'comparativas';

const TITULARES = [
  { id: null, label: 'Todos' },
  { id: '6ce69d55-60d0-423c-b68b-eb795a0f32fe', label: 'Rubén' },
  { id: 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354', label: 'Emilio' },
] as const;

export default function Running() {
  const { T } = useTheme();
  const [tab, setTab] = useState<RunTab>('resumen');
  const [modalOpen, setModalOpen] = useState(false);

  const [periodoDesde, setPeriodoDesde] = useState<Date>(() => {
    const h = new Date(); h.setDate(1); h.setHours(0, 0, 0, 0); return h;
  });
  const [periodoHasta, setPeriodoHasta] = useState<Date>(() => {
    const h = new Date(); h.setHours(23, 59, 59, 999); return h;
  });
  const [periodoLabel, setPeriodoLabel] = useState('Mes en curso');

  const [titularIdx, setTitularIdx] = useState(0);
  const titularId = TITULARES[titularIdx].id;

  const periodo: PeriodoRango = useMemo(() => ({
    desde: periodoDesde,
    hasta: periodoHasta,
    key: 'mes',
    label: periodoLabel,
  }), [periodoDesde, periodoHasta, periodoLabel]);

  const anio = periodo.desde.getFullYear();
  const { modo: modoIVA } = useIVA();

  const data = useRunningV2(periodo, titularId, null, modoIVA);

  const subtitulo = buildSubtitulo(periodoLabel, periodoDesde, periodoHasta);

  if (data.error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{
          background: '#FCEBEB', border: '1px solid #B01D23', color: '#A32D2D',
          padding: 16, borderRadius: 8, fontFamily: FONT.body, fontSize: 13,
        }}>
          Error: {data.error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#f5f3ef', padding: '24px 28px' }}>
      {/* HEADER */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 18, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{
            fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 600,
            color: '#B01D23', letterSpacing: 3, textTransform: 'uppercase',
          }}>
            RUNNING FINANCIERO
          </div>
          <div style={{
            fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090', marginTop: 2,
          }}>
            {subtitulo}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Selector Titular */}
          <div style={{ display: 'flex', gap: 4 }}>
            {TITULARES.map((t, i) => (
              <button
                key={t.label}
                onClick={() => setTitularIdx(i)}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none',
                  background: i === titularIdx ? '#B01D23' : T.card,
                  color: i === titularIdx ? '#fff' : T.sec,
                  fontFamily: FONT.body, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <SelectorFechaUniversal
            nombreModulo="running"
            defaultOpcion="mes_en_curso"
            onChange={(desde, hasta, label) => {
              setPeriodoDesde(desde);
              setPeriodoHasta(hasta);
              setPeriodoLabel(label);
            }}
          />
        </div>
      </div>

      {/* TABS */}
      <TabsPastilla
        tabs={[
          { id: 'resumen', label: 'Resumen' },
          { id: 'pyg', label: 'PyG detallado' },
          { id: 'marcas', label: 'Por marca' },
          { id: 'comparativas', label: 'Comparativas' },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as RunTab)}
      />

      {/* CONTENIDO */}
      {data.loading && (
        <div style={{
          textAlign: 'center', padding: 24, color: T.mut,
          fontFamily: FONT.body, fontSize: 12,
        }}>
          Cargando datos…
        </div>
      )}

      {!data.loading && tab === 'resumen' && (
        <TabResumenV2 data={data} />
      )}

      {!data.loading && tab === 'pyg' && (
        <div style={{ marginTop: 18 }}>
          <TablaPyG
            anio={anio}
            gastosAnio={data.gastos.map(g => ({
              fecha: g.fecha,
              categoria: g.grupo as any,
              subcategoria: g.subcategoria,
              proveedor: g.proveedor,
              concepto: g.concepto,
              importe: g.importe,
              marca: g.marca,
            }))}
            ingresosAnio={[]}
            facturacionAnio={data.facturacion}
            rangos={data.rangos}
          />
        </div>
      )}

      {!data.loading && tab === 'marcas' && (
        <TabPorMarca
          facturacion={data.facturacion}
          facturacionYTD={data.facturacionYTD}
        />
      )}

      {!data.loading && tab === 'comparativas' && (
        <TabComparativas data={data} />
      )}

      <ModalAddGasto open={modalOpen} onClose={() => setModalOpen(false)} onSaved={data.reload} />
    </div>
  );
}
