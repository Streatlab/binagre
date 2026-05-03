/**
 * Running Financiero — refactor 3 may 2026 v3
 *
 * Cambio CLAVE (Rubén pidió "calca esto" señalando Panel Global > Resumen):
 * - Tab Resumen ahora monta TabResumen del Panel Global directamente.
 *   Misma estructura: 3 cards top (Facturación / Pedidos·TM / Resultado),
 *   3 columnas medias (Facturación canal / Grupos gasto / Días pico),
 *   3 cards inferiores (Saldo / Ratio / PE), 3 cards finales (Provisiones / Top ventas).
 * - TabResumen lee internamente: ingresos_mensuales, gastos, presupuestos, pe_parametros,
 *   provisiones, objetivos. NO inventa nada.
 * - El header del Running se mantiene (título + selector fecha + tabs).
 * - El tab "PyG detallado" sigue mostrando TablaPyG.
 * - El tab "Comparativas" se conserva.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTheme, FONT } from '@/styles/tokens';
import { supabase } from '@/lib/supabase';
import { useRunning } from '@/hooks/useRunning';
import { useIVA } from '@/contexts/IVAContext';
import TablaPyG from '@/components/finanzas/running/TablaPyG';
import ModalAddGasto from '@/components/finanzas/running/ModalAddGasto';
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal';
import TabsPastilla from '@/components/ui/TabsPastilla';
import AlertasPresupuestoCard from '@/components/finanzas/running/AlertasPresupuestoCard';
import RitmoMesCard from '@/components/finanzas/running/RitmoMesCard';
import ComparativaMensualCard from '@/components/finanzas/running/ComparativaMensualCard';
import TabResumen from '@/components/panel/resumen/TabResumen';
import type { RowFacturacion } from '@/components/panel/resumen/types';
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

type RunTab = 'resumen' | 'pyg' | 'comparativas';

const TablaPyGAny = TablaPyG as any;

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Running() {
  const { T } = useTheme();
  const [tab, setTab] = useState<RunTab>('resumen');

  const [periodoDesde, setPeriodoDesde] = useState<Date>(() => {
    const h = new Date(); h.setDate(1); h.setHours(0,0,0,0); return h;
  });
  const [periodoHasta, setPeriodoHasta] = useState<Date>(() => {
    const h = new Date(); h.setHours(23,59,59,999); return h;
  });
  const [periodoLabelSFU, setPeriodoLabelSFU] = useState('Mes en curso');

  const periodo: PeriodoRango = useMemo(() => ({
    desde: periodoDesde,
    hasta: periodoHasta,
    key: 'mes',
    label: periodoLabelSFU,
  }), [periodoDesde, periodoHasta, periodoLabelSFU]);
  const anio = periodo.desde.getFullYear();

  const [modalOpen, setModalOpen] = useState(false);

  const { modo: modoIVA } = useIVA();

  const { loading, error, gastos, ingresosMes, rangos, reload } = useRunning(
    periodo, anio, null, null, modoIVA,
  );

  // Para TablaPyG necesitamos también la facturación de TODO el año
  const [facturacionAnio, setFacturacionAnio] = useState<any[]>([]);
  useEffect(() => {
    let cancel = false;
    (async () => {
      const desde = `${anio}-01-01`;
      const hasta = `${anio}-12-31`;
      const { data } = await supabase.from('facturacion_diario')
        .select('fecha,marca_id,total_bruto,uber_bruto,glovo_bruto,je_bruto,web_bruto,directa_bruto,total_pedidos')
        .gte('fecha', desde)
        .lte('fecha', hasta);
      if (cancel) return;
      setFacturacionAnio(data ?? []);
    })();
    return () => { cancel = true; };
  }, [anio]);

  // ── DATA para TabResumen: rowsPeriodo + rowsAll desde facturacion_diario ──
  // TabResumen necesita las columnas: fecha, total_bruto, total_pedidos, y por canal *_bruto / *_pedidos
  const [rowsAll, setRowsAll] = useState<RowFacturacion[]>([]);
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from('facturacion_diario')
        .select('fecha, total_bruto, total_pedidos, uber_bruto, uber_pedidos, glovo_bruto, glovo_pedidos, je_bruto, je_pedidos, web_bruto, web_pedidos, directa_bruto, directa_pedidos');
      if (cancel) return;
      setRowsAll((data ?? []) as RowFacturacion[]);
    })();
    return () => { cancel = true; };
  }, []);

  const rowsPeriodo: RowFacturacion[] = useMemo(() => {
    const desde = toLocalDateStr(periodoDesde);
    const hasta = toLocalDateStr(periodoHasta);
    return rowsAll.filter(r => r.fecha >= desde && r.fecha <= hasta);
  }, [rowsAll, periodoDesde, periodoHasta]);

  const subtitulo = buildSubtitulo(periodoLabelSFU, periodoDesde, periodoHasta);

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ background: '#FCEBEB', border: '1px solid #B01D23', color: '#A32D2D', padding: 16, borderRadius: 8, fontFamily: FONT.body, fontSize: 13 }}>
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#f5f3ef', padding: '24px 28px' }}>
      {/* HEADER — copia LITERAL Panel Global */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 18,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <div style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: 22,
            fontWeight: 600,
            color: '#B01D23',
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}>
            RUNNING FINANCIERO
          </div>
          <div style={{
            fontFamily: 'Lexend, sans-serif',
            fontSize: 13,
            color: '#7a8090',
            marginTop: 2,
          }}>
            {subtitulo}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SelectorFechaUniversal
            nombreModulo="running"
            defaultOpcion="mes_en_curso"
            onChange={(desde, hasta, label) => {
              setPeriodoDesde(desde);
              setPeriodoHasta(hasta);
              setPeriodoLabelSFU(label);
            }}
          />
        </div>
      </div>

      {/* TABS — copia LITERAL Conciliación */}
      <TabsPastilla
        tabs={[
          { id: 'resumen', label: 'Resumen' },
          { id: 'pyg', label: 'PyG detallado' },
          { id: 'comparativas', label: 'Comparativas' },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as RunTab)}
      />

      {/* TAB RESUMEN — calca Panel Global > Resumen */}
      {tab === 'resumen' && (
        <TabResumen
          rowsPeriodo={rowsPeriodo}
          rowsAll={rowsAll}
          fechaDesde={periodoDesde}
          fechaHasta={periodoHasta}
          canalesFiltro={[]}
        />
      )}

      {/* TAB PYG DETALLADO */}
      {tab === 'pyg' && (
        <div style={{ marginTop: 18 }}>
          <TablaPyGAny
            anio={anio}
            gastosAnio={gastos}
            ingresosAnio={ingresosMes}
            facturacionAnio={facturacionAnio}
            rangos={rangos}
          />
          {loading && (
            <div style={{ textAlign: 'center', padding: 16, color: T.mut, fontFamily: FONT.body, fontSize: 12 }}>
              Cargando…
            </div>
          )}
        </div>
      )}

      {/* TAB COMPARATIVAS */}
      {tab === 'comparativas' && (
        <div style={{ marginTop: 18 }}>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 24, alignItems: 'stretch' }}
            className="rf-smart-row"
          >
            <AlertasPresupuestoCard gastos={gastos} />
            <RitmoMesCard />
            <ComparativaMensualCard />
          </div>
          {loading && (
            <div style={{ textAlign: 'center', padding: 16, color: T.mut, fontFamily: FONT.body, fontSize: 12 }}>
              Cargando…
            </div>
          )}
        </div>
      )}

      <ModalAddGasto open={modalOpen} onClose={() => setModalOpen(false)} onSaved={reload} />

      <style>{`
        @media (max-width: 1280px) {
          .rf-smart-row { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 600px) {
          .rf-smart-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
