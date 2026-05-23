import { useState, useCallback } from 'react';
import { parseUberGanancias, type EstadisticaPrimePromo } from '../lib/parsers/parserUberGanancias';
import { parseGlovoOrderDetails } from '../lib/parsers/parserGlovoOrderDetails';
import { guardarEstadisticasPrimePromo } from '../lib/parsers/guardarEstadisticasPrimePromo';
import { parseUberArticulos, type VentaPlato } from '../lib/parsers/parserUberArticulos';
import { parseSinqroSoldProducts } from '../lib/parsers/parserSinqroSoldProducts';
import { parseRushourPlataformas, type ResumenPlataforma } from '../lib/parsers/parserRushourPlataformas';
import { parseRushourIngresos, type SerieDiaria } from '../lib/parsers/parserRushourIngresos';
import { parseGlovoClientes, type MetricasClientes } from '../lib/parsers/parserGlovoClientes';
import {
  guardarVentasPlato,
  guardarResumenPlataformas,
  guardarSerieDiaria,
  guardarMetricasClientes,
} from '../lib/parsers/guardarDatosFases';

// ── Tipos de archivo ────────────────────────────────────────────
const TIPOS = [
  // Fase 1 — activos
  { value: 'uber_ganancias',      label: 'Uber — Detalle de ganancias',          fase: 1, frec: 'Mensual', tag: 'Activo' },
  { value: 'glovo_orders',        label: 'Glovo — Historial de pedidos',          fase: 1, frec: 'Mensual', tag: 'Activo' },
  // Fase 2
  { value: 'uber_articulos',      label: 'Uber — Detalle artículos (plato)',      fase: 2, frec: 'Mensual', tag: 'Fase 2' },
  { value: 'sinqro_sold',         label: 'Sinqro — Sold products',                fase: 2, frec: 'Mensual', tag: 'Fase 2' },
  { value: 'rushour_plataformas', label: 'Rushour — Desglose plataformas',        fase: 2, frec: 'Mensual', tag: 'Fase 2' },
  // Fase 3
  { value: 'rushour_ingresos',    label: 'Rushour — Ingresos totales (diario)',   fase: 3, frec: 'Diario',  tag: 'Fase 3' },
  { value: 'rushour_volumen',     label: 'Rushour — Volumen pedidos (diario)',    fase: 3, frec: 'Diario',  tag: 'Fase 3' },
  // Fase 4
  { value: 'glovo_clientes',      label: 'Glovo — Clientes (CRM)',                fase: 4, frec: 'Mensual', tag: 'Fase 4' },
] as const;

type TipoCSV = (typeof TIPOS)[number]['value'];

type DatosParseados =
  | { kind: 'prime'; data: EstadisticaPrimePromo[] }
  | { kind: 'plato'; data: VentaPlato[] }
  | { kind: 'plataforma'; data: ResumenPlataforma[] }
  | { kind: 'serie'; data: SerieDiaria[] }
  | { kind: 'clientes'; data: MetricasClientes[] };

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  'Activo': { bg: '#E1F5EE', color: '#085041' },
  'Fase 2': { bg: '#FAEEDA', color: '#633806' },
  'Fase 3': { bg: '#FAECE7', color: '#712B13' },
  'Fase 4': { bg: '#E6F1FB', color: '#0C447C' },
};

export default function ImportarVentas() {
  const [tipo, setTipo] = useState<TipoCSV>('uber_ganancias');
  const [datos, setDatos] = useState<DatosParseados | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

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
          case 'uber_articulos':
            parsed = { kind: 'plato', data: parseUberArticulos(text) }; break;
          case 'sinqro_sold':
            parsed = { kind: 'plato', data: parseSinqroSoldProducts(text) }; break;
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
      } catch (err: any) {
        setError(err.message || 'Error al parsear el archivo');
      }
    };
    reader.readAsText(file, 'UTF-8');
  }, [tipo]);

  const handleGuardar = useCallback(async () => {
    if (!datos) return;
    setGuardando(true); setError(null);
    try {
      let res;
      if (datos.kind === 'prime')      res = await guardarEstadisticasPrimePromo(datos.data);
      else if (datos.kind === 'plato') res = await guardarVentasPlato(datos.data);
      else if (datos.kind === 'plataforma') res = await guardarResumenPlataformas(datos.data);
      else if (datos.kind === 'serie') res = await guardarSerieDiaria(datos.data);
      else                             res = await guardarMetricasClientes(datos.data);

      if (res.errores.length) setError(res.errores.join('\n'));
      setResultado(`✅ ${res.insertados} nuevos · ${res.actualizados} actualizados` + (res.errores.length ? ` · ${res.errores.length} errores` : ''));
      setDatos(null);
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
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
    <div style={{ padding: '28px', maxWidth: 960 }}>
      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, fontWeight: 500, color: '#111', marginBottom: 6 }}>
        Importar datos de ventas
      </h2>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>
        Sube los CSVs de cada plataforma para mantener el ERP actualizado con datos reales.
      </p>

      {/* Selector tipo */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 14, fontWeight: 500, color: '#444' }}>Tipo de archivo:</label>
        <select
          value={tipo}
          onChange={e => { setTipo(e.target.value as TipoCSV); setDatos(null); setError(null); setResultado(null); setFileName(null); }}
          style={{ padding: '8px 12px', borderRadius: 6, border: '0.5px solid #d0c8bc', fontSize: 14, background: '#fff', minWidth: 300 }}
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
          <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, ...TAG_COLORS[tipoInfo.tag] }}>
            {tipoInfo.tag} · {tipoInfo.frec}
          </span>
        )}
      </div>

      {/* Upload */}
      <div style={{ border: '2px dashed #d0c8bc', borderRadius: 16, padding: 32, textAlign: 'center', background: '#faf9f7', marginBottom: 20 }}>
        <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} id="csv-upload" key={tipo} />
        <label htmlFor="csv-upload" style={{ cursor: 'pointer', padding: '10px 24px', background: '#B01D23', color: '#fff', borderRadius: 6, fontSize: 14, fontWeight: 500 }}>
          Seleccionar CSV
        </label>
        {fileName && <p style={{ marginTop: 12, fontSize: 13, color: '#666' }}>📄 {fileName}</p>}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 16, marginBottom: 20, color: '#991B1B', fontSize: 13, whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: 16, marginBottom: 20, color: '#166534', fontSize: 14, fontWeight: 500 }}>
          {resultado}
        </div>
      )}

      {/* Preview tabla */}
      {datos && (
        <>
          <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 10, overflow: 'auto', marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f3ef' }}>
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
                  <tr key={i} style={{ borderBottom: '0.5px solid #eee' }}>
                    <td style={td}>{d.marca}</td>
                    <td style={td}>{d.mes}/{d.año}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 500 }}>{d.pedidos_total}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#1D9E75' }}>{fmtPct(d.pct_prime)}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#BA7517' }}>{d.pct_promo > 0 ? fmtPct(d.pct_promo) : '—'}</td>
                  </tr>
                ))}
                {datos.kind === 'plato' && datos.data.slice(0, 50).map((d, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid #eee' }}>
                    <td style={td}>{d.canal}</td><td style={td}>{d.marca}</td><td style={td}>{d.plato}</td>
                    <td style={td}>{d.mes}/{d.año}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{d.unidades}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#1D9E75' }}>{fmtEur(d.ingresos_brutos)} €</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtEur(d.precio_medio)} €</td>
                  </tr>
                ))}
                {datos.kind === 'plataforma' && datos.data.slice(0, 50).map((d, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid #eee' }}>
                    <td style={td}>{d.canal}</td><td style={td}>{d.marca}</td>
                    <td style={td}>{d.mes}/{d.año}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{d.pedidos}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#1D9E75' }}>{fmtEur(d.ingresos)} €</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtEur(d.ticket_medio)} €</td>
                  </tr>
                ))}
                {datos.kind === 'serie' && datos.data.slice(0, 50).map((d, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid #eee' }}>
                    <td style={td}>{d.fecha}</td><td style={td}>{d.marca}</td><td style={td}>{d.canal}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{d.pedidos || '—'}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#1D9E75' }}>{d.ingresos > 0 ? `${fmtEur(d.ingresos)} €` : '—'}</td>
                  </tr>
                ))}
                {datos.kind === 'clientes' && datos.data.slice(0, 50).map((d, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid #eee' }}>
                    <td style={td}>{d.marca}</td><td style={td}>{d.mes}/{d.año}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{d.clientes_total}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#1D9E75' }}>{d.clientes_nuevos}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{d.clientes_recurrentes}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#378ADD' }}>{fmtPct(d.pct_nuevos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {datos.data.length > 50 && (
              <div style={{ padding: '8px 14px', fontSize: 12, color: '#666', borderTop: '0.5px solid #eee' }}>
                Mostrando 50 de {datos.data.length} registros
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleGuardar} disabled={guardando}
              style={{ padding: '10px 24px', background: guardando ? '#999' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: guardando ? 'default' : 'pointer' }}>
              {guardando ? 'Guardando...' : `Confirmar (${datos.data.length} registros)`}
            </button>
            <button onClick={handleCancelar}
              style={{ padding: '10px 24px', background: '#f5f3ef', color: '#444', border: '0.5px solid #d0c8bc', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {/* Info archivos */}
      <div style={{ marginTop: 28, padding: 16, background: '#f5f3ef', borderRadius: 10, fontSize: 12, color: '#666', lineHeight: 1.8 }}>
        <strong>¿De dónde se descarga cada archivo?</strong><br />
        <strong>Mensual (día ~5):</strong> U1: Uber Eats Manager → Informes → Detalle ganancias · G1: Glovo Manager → Historial pedidos<br />
        <strong>Semanal:</strong> U5: Uber Eats Manager → Facturación (subir en OCR)<br />
        <strong>Quincenal:</strong> G2: Glovo Manager → Facturación · J1: Just Eat → Facturación (subir en OCR)<br />
        <strong>Fase 2:</strong> U3: Uber → Informes nivel artículo · S1: Sinqro → Exports · R3: Rushour → Negocio → Desglose plataforma<br />
        <strong>Fase 3:</strong> R4+R5: Rushour → Informes → Ingresos / Volumen<br />
        <strong>Fase 4:</strong> G5: Glovo Manager → Rendimiento → Clientes
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: '#666' };
const td: React.CSSProperties = { padding: '10px 14px' };
