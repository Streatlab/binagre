import { AZUL_CL, BLANCO, GRANATE, NAR, ROJO, VERDE } from '@/styles/neobrutal'
import { CORREO_ERROR_BORDE, COBERTURA_VERDE } from '@/styles/palettes'
import { useState, useCallback } from 'react';
import { parseUberGanancias, type EstadisticaPrimePromo } from '../lib/parsers/parserUberGanancias';
import { parseGlovoOrderDetails } from '../lib/parsers/parserGlovoOrderDetails';
import { guardarEstadisticasPrimePromo } from '../lib/parsers/guardarEstadisticasPrimePromo';
import { parseUberArticulosFull, type VentaPlato, type UberArticulosResult } from '../lib/parsers/parserUberArticulos';
import { parseSinqroSoldProductsFull, type SinqroResult, type VentaFranja } from '../lib/parsers/parserSinqroSoldProducts';
import { parseRushourPlataformas, type ResumenPlataforma } from '../lib/parsers/parserRushourPlataformas';
import { parseRushourIngresos, type SerieDiaria } from '../lib/parsers/parserRushourIngresos';
import { parseGlovoClientes, type MetricasClientes } from '../lib/parsers/parserGlovoClientes';
import {
  guardarVentasPlato,
  guardarVentasFranja,
  guardarResumenPlataformas,
  guardarSerieDiaria,
  guardarMetricasClientes,
} from '../lib/parsers/guardarDatosFases';
import { useIsMobile } from '@/hooks/useIsMobile';
import RutaPantalla from '@/components/ui/RutaPantalla';

// ── Neobrutal ────────────────────────────────────────────────────
const NEO_INK = 'var(--neo-ink)';
const NEO_SHADOW = '4px 4px 0 var(--neo-shadow-color)';
const NEO_CARD: React.CSSProperties = { border: `3px solid ${NEO_INK}`, borderRadius: 0, boxShadow: NEO_SHADOW };

// ── Tipos de archivo ────────────────────────────────────────────
const TIPOS = [
  // Fase 1 — activos
  { value: 'uber_ganancias',      label: 'Uber — Detalle de ganancias',          fase: 1, frec: 'Mensual', tag: 'Activo' },
  { value: 'glovo_orders',        label: 'Glovo — Historial de pedidos',          fase: 1, frec: 'Mensual', tag: 'Activo' },
  // Fase 2
  { value: 'uber_articulos',      label: 'Uber — Detalle artículos (plato+hora)', fase: 2, frec: 'Mensual', tag: 'Fase 2' },
  { value: 'sinqro_sold',         label: 'Sinqro — Sold products (plato+hora)',   fase: 2, frec: 'Mensual', tag: 'Fase 2' },
  { value: 'rushour_plataformas', label: 'Rushour — Desglose plataformas',        fase: 2, frec: 'Mensual', tag: 'Fase 2' },
  // Fase 3
  { value: 'rushour_ingresos',    label: 'Rushour — Ingresos totales (diario)',   fase: 3, frec: 'Diario',  tag: 'Fase 3' },
  { value: 'rushour_volumen',     label: 'Rushour — Volumen pedidos (diario)',    fase: 3, frec: 'Diario',  tag: 'Fase 3' },
  // Fase 4
  { value: 'glovo_clientes',      label: 'Glovo — Clientes (CRM)',                fase: 4, frec: 'Mensual', tag: 'Fase 4' },
] as const;

type TipoCSV = (typeof TIPOS)[number]['value'];

type DatosParseados =
  | { kind: 'prime';      data: EstadisticaPrimePromo[] }
  | { kind: 'plato';      data: VentaPlato[];   franjas?: VentaFranja[]; origen: string }
  | { kind: 'plataforma'; data: ResumenPlataforma[] }
  | { kind: 'serie';      data: SerieDiaria[] }
  | { kind: 'clientes';   data: MetricasClientes[] };

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  'Activo': { bg: `${VERDE}22`, color: VERDE },
  'Fase 2': { bg: `${NAR}22`, color: NAR },
  'Fase 3': { bg: NAR, color: NAR },
  'Fase 4': { bg: `${AZUL_CL}22`, color: AZUL_CL },
};

export default function ImportarVentas() {
  const [tipo, setTipo] = useState<TipoCSV>('uber_ganancias');
  const [datos, setDatos] = useState<DatosParseados | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const tipoInfo = TIPOS.find(t => t.value === tipo)!;

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null); setDatos(null); setResultado(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        let parsed: DatosParseados;
        switch (tipo) {
          case 'uber_ganancias':
            parsed = { kind: 'prime', data: parseUberGanancias(text) }; break;
          case 'glovo_orders':
            parsed = { kind: 'prime', data: parseGlovoOrderDetails(text) }; break;
          case 'uber_articulos': {
            const res: UberArticulosResult = parseUberArticulosFull(text);
            parsed = { kind: 'plato', data: res.platos, franjas: res.franjas, origen: 'uber' };
            break;
          }
          case 'sinqro_sold': {
            const res: SinqroResult = parseSinqroSoldProductsFull(text);
            parsed = { kind: 'plato', data: res.platos, franjas: res.franjas, origen: 'sincro' };
            break;
          }
          case 'rushour_plataformas':
            parsed = { kind: 'plataforma', data: parseRushourPlataformas(text) }; break;
          case 'rushour_ingresos':
            parsed = { kind: 'serie', data: parseRushourIngresos(text, 'ingresos') }; break;
          case 'rushour_volumen':
            parsed = { kind: 'serie', data: parseRushourIngresos(text, 'volumen') }; break;
          case 'glovo_clientes':
            parsed = { kind: 'clientes', data: parseGlovoClientes(text) }; break;
          default:
            throw new Error('Tipo de archivo no reconocido');
        }
        if (!parsed.data.length) {
          setError('No se encontraron registros válidos. Verifica que el archivo sea correcto.');
          return;
        }
        setDatos(parsed);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error al parsear el archivo');
      }
    };
    reader.readAsText(file, 'UTF-8');
  }, [tipo]);

  const handleGuardar = useCallback(async () => {
    if (!datos) return;
    setGuardando(true); setError(null);
    try {
      let res;
      if (datos.kind === 'prime') {
        res = await guardarEstadisticasPrimePromo(datos.data);
      } else if (datos.kind === 'plato') {
        // Guardar platos con origen
        res = await guardarVentasPlato(datos.data, datos.origen);
        // Guardar franjas si las hay
        if (datos.franjas && datos.franjas.length > 0) {
          const resFranja = await guardarVentasFranja(datos.franjas);
          res = {
            insertados: res.insertados + resFranja.insertados,
            actualizados: res.actualizados + resFranja.actualizados,
            errores: [...res.errores, ...resFranja.errores],
          };
        }
      } else if (datos.kind === 'plataforma') {
        res = await guardarResumenPlataformas(datos.data);
      } else if (datos.kind === 'serie') {
        res = await guardarSerieDiaria(datos.data);
      } else {
        res = await guardarMetricasClientes(datos.data);
      }

      if (res.errores.length) setError(res.errores.join('\n'));
      setResultado(
        `✅ ${res.insertados} nuevos · ${res.actualizados} actualizados` +
        (datos.kind === 'plato' && datos.franjas?.length
          ? ` · ${datos.franjas.length} franjas horarias`
          : '') +
        (res.errores.length ? ` · ${res.errores.length} errores` : '')
      );
      setDatos(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }, [datos]);

  const handleCancelar = useCallback(() => {
    setDatos(null); setError(null); setResultado(null); setFileName(null);
  }, []);

  const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const fmtEur = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 960, background: 'var(--neo-bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <RutaPantalla niveles={['Importar ventas']} subtitulo="Sube los CSVs de cada plataforma para mantener el ERP actualizado con datos reales." />
      </div>

      {/* Selector tipo */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--sl-text-secondary)' }}>Tipo de archivo:</label>
        <select
          value={tipo}
          onChange={e => { setTipo(e.target.value as TipoCSV); setDatos(null); setError(null); setResultado(null); setFileName(null); }}
          style={{ padding: '10px 12px', minHeight: 44, borderRadius: 0, border: `3px solid ${NEO_INK}`, fontSize: 14, fontWeight: 600, background: 'var(--sl-card)', color: 'var(--sl-text-primary)', minWidth: 0, width: '100%', maxWidth: 340, boxSizing: 'border-box' }}
        >
          {[1,2,3,4].map(fase => (
            <optgroup key={fase} label={`Fase ${fase}${fase === 1 ? ' — Activo' : ''}`}>
              {TIPOS.filter(t => t.fase === fase).map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {tipoInfo && (
          <span style={{ padding: '4px 10px', border: `2px solid ${NEO_INK}`, borderRadius: 0, fontSize: 11, fontWeight: 700, ...TAG_COLORS[tipoInfo.tag] }}>
            {tipoInfo.tag} · {tipoInfo.frec}
          </span>
        )}
      </div>

      {/* Upload */}
      <div style={{ ...NEO_CARD, padding: 'clamp(18px,4vw,32px)', textAlign: 'center', background: 'var(--sl-card)', marginBottom: 20 }}>
        <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} id="csv-upload" key={tipo} />
        <label htmlFor="csv-upload" style={{ cursor: 'pointer', display: 'inline-block', padding: '13px 24px', minHeight: 44, boxSizing: 'border-box', background: GRANATE, color: BLANCO, border: `3px solid ${NEO_INK}`, borderRadius: 0, boxShadow: NEO_SHADOW, fontSize: 14, fontWeight: 700, textTransform: 'uppercase' }}>
          Seleccionar CSV
        </label>
        {fileName && <p style={{ marginTop: 12, fontSize: 13, color: 'var(--sl-text-muted)' }}>📄 {fileName}</p>}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: CORREO_ERROR_BORDE + '18', border: `3px solid ${CORREO_ERROR_BORDE}`, borderRadius: 0, boxShadow: NEO_SHADOW, padding: 16, marginBottom: 20, color: ROJO, fontSize: 13, fontWeight: 600, whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div style={{ background: COBERTURA_VERDE + '18', border: `3px solid ${COBERTURA_VERDE}`, borderRadius: 0, boxShadow: NEO_SHADOW, padding: 16, marginBottom: 20, color: VERDE, fontSize: 14, fontWeight: 700 }}>
          {resultado}
        </div>
      )}

      {/* Preview tabla */}
      {datos && (
        <>
          <div style={{ background: 'var(--sl-card)', ...NEO_CARD, overflowX: 'auto', marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
              <thead>
                <tr style={{ background: 'var(--sl-app)' }}>
                  {datos.kind === 'prime' && <>
                    <th style={th}>Marca</th><th style={th}>Mes</th>
                    <th style={{ ...th, textAlign: 'right' }}>Pedidos</th>
                    <th style={{ ...th, textAlign: 'right' }}>% Prime</th>
                    <th style={{ ...th, textAlign: 'right' }}>% Promo</th>
                  </>}
                  {datos.kind === 'plato' && <>
                    <th style={th}>Canal</th><th style={th}>Marca</th><th style={th}>Plato</th>
                    <th style={th}>Mes</th>
                    <th style={{ ...th, textAlign: 'right' }}>Uds</th>
                    <th style={{ ...th, textAlign: 'right' }}>Ingresos</th>
                    <th style={{ ...th, textAlign: 'right' }}>Precio medio</th>
                    {datos.franjas && datos.franjas.length > 0 &&
                      <th style={{ ...th, textAlign: 'right', color: VERDE }}>
                        +{datos.franjas.length} franjas
                      </th>
                    }
                  </>}
                  {datos.kind === 'plataforma' && <>
                    <th style={th}>Canal</th><th style={th}>Marca</th><th style={th}>Mes</th>
                    <th style={{ ...th, textAlign: 'right' }}>Pedidos</th>
                    <th style={{ ...th, textAlign: 'right' }}>Ingresos</th>
                    <th style={{ ...th, textAlign: 'right' }}>Ticket medio</th>
                  </>}
                  {datos.kind === 'serie' && <>
                    <th style={th}>Fecha</th><th style={th}>Marca</th><th style={th}>Canal</th>
                    <th style={{ ...th, textAlign: 'right' }}>Pedidos</th>
                    <th style={{ ...th, textAlign: 'right' }}>Ingresos</th>
                  </>}
                  {datos.kind === 'clientes' && <>
                    <th style={th}>Marca</th><th style={th}>Mes</th>
                    <th style={{ ...th, textAlign: 'right' }}>Total</th>
                    <th style={{ ...th, textAlign: 'right' }}>Nuevos</th>
                    <th style={{ ...th, textAlign: 'right' }}>Recurrentes</th>
                    <th style={{ ...th, textAlign: 'right' }}>% Nuevos</th>
                  </>}
                </tr>
              </thead>
              <tbody>
                {datos.kind === 'prime' && datos.data.slice(0, 50).map((d, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid var(--sl-border)' }}>
                    <td style={td}>{d.marca}</td>
                    <td style={td}>{d.mes}/{d.año}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 500 }}>{d.pedidos_total}</td>
                    <td style={{ ...td, textAlign: 'right', color: VERDE }}>{fmtPct(d.pct_prime)}</td>
                    <td style={{ ...td, textAlign: 'right', color: NAR }}>{d.pct_promo > 0 ? fmtPct(d.pct_promo) : '—'}</td>
                  </tr>
                ))}
                {datos.kind === 'plato' && datos.data.slice(0, 50).map((d, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid var(--sl-border)' }}>
                    <td style={td}>{d.canal}</td><td style={td}>{d.marca}</td><td style={td}>{d.plato}</td>
                    <td style={td}>{d.mes}/{d.año}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{d.unidades}</td>
                    <td style={{ ...td, textAlign: 'right', color: VERDE }}>{fmtEur(d.ingresos_brutos)} €</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtEur(d.precio_medio)} €</td>
                    {datos.franjas && datos.franjas.length > 0 && <td style={td}></td>}
                  </tr>
                ))}
                {datos.kind === 'plataforma' && datos.data.slice(0, 50).map((d, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid var(--sl-border)' }}>
                    <td style={td}>{d.canal}</td><td style={td}>{d.marca}</td>
                    <td style={td}>{d.mes}/{d.año}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{d.pedidos}</td>
                    <td style={{ ...td, textAlign: 'right', color: VERDE }}>{fmtEur(d.ingresos)} €</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtEur(d.ticket_medio)} €</td>
                  </tr>
                ))}
                {datos.kind === 'serie' && datos.data.slice(0, 50).map((d, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid var(--sl-border)' }}>
                    <td style={td}>{d.fecha}</td><td style={td}>{d.marca}</td><td style={td}>{d.canal}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{d.pedidos || '—'}</td>
                    <td style={{ ...td, textAlign: 'right', color: VERDE }}>{d.ingresos > 0 ? `${fmtEur(d.ingresos)} €` : '—'}</td>
                  </tr>
                ))}
                {datos.kind === 'clientes' && datos.data.slice(0, 50).map((d, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid var(--sl-border)' }}>
                    <td style={td}>{d.marca}</td><td style={td}>{d.mes}/{d.año}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{d.clientes_total}</td>
                    <td style={{ ...td, textAlign: 'right', color: VERDE }}>{d.clientes_nuevos}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{d.clientes_recurrentes}</td>
                    <td style={{ ...td, textAlign: 'right', color: AZUL_CL }}>{fmtPct(d.pct_nuevos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {datos.data.length > 50 && (
              <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--sl-text-muted)', borderTop: '0.5px solid var(--sl-border)' }}>
                Mostrando 50 de {datos.data.length} registros
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={handleGuardar} disabled={guardando}
              style={{ padding: '12px 24px', minHeight: 44, flex: isMobile ? '1 1 100%' : '0 0 auto', background: guardando ? 'var(--sl-text-muted)' : VERDE, color: BLANCO, border: `3px solid ${NEO_INK}`, borderRadius: 0, boxShadow: NEO_SHADOW, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', cursor: guardando ? 'default' : 'pointer' }}>
              {guardando ? 'Guardando...' : `Confirmar (${datos.data.length} platos${datos.kind === 'plato' && datos.franjas?.length ? ` + ${datos.franjas.length} franjas` : ''})`}
            </button>
            <button onClick={handleCancelar}
              style={{ padding: '12px 24px', minHeight: 44, flex: isMobile ? '1 1 100%' : '0 0 auto', background: 'var(--sl-app)', color: 'var(--sl-text-secondary)', border: `3px solid ${NEO_INK}`, borderRadius: 0, boxShadow: NEO_SHADOW, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {/* Info archivos */}
      <div style={{ marginTop: 28, padding: 16, background: 'var(--sl-app)', ...NEO_CARD, fontSize: 12, color: 'var(--sl-text-muted)', lineHeight: 1.8 }}>
        <strong>¿De dónde se descarga cada archivo?</strong><br />
        <strong>Mensual (día ~5):</strong> U1: Uber Eats Manager → Informes → Detalle ganancias · G1: Glovo Manager → Historial pedidos<br />
        <strong>Semanal:</strong> U5: Uber Eats Manager → Facturación (subir en OCR)<br />
        <strong>Quincenal:</strong> G2: Glovo Manager → Facturación · J1: Just Eat → Facturación (subir en OCR)<br />
        <strong>Fase 2:</strong> U4: Uber → Informes nivel artículo · S1: Sinqro → Exports → Sold products · R3: Rushour → Negocio → Desglose plataforma<br />
        <strong>Fase 3:</strong> R4+R5: Rushour → Informes → Ingresos / Volumen<br />
        <strong>Fase 4:</strong> G5: Glovo Manager → Rendimiento → Clientes
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: 'var(--sl-text-muted)' };
const td: React.CSSProperties = { padding: '10px 14px' };
