import { useState, useCallback } from 'react';
import { parseUberGanancias, type EstadisticaPrimePromo } from '../lib/parsers/parserUberGanancias';
import { parseGlovoOrderDetails } from '../lib/parsers/parserGlovoOrderDetails';
import { guardarEstadisticasPrimePromo } from '../lib/parsers/guardarEstadisticasPrimePromo';

const TIPOS = [
  { value: 'uber', label: 'Uber — Detalle de ganancias' },
  { value: 'glovo', label: 'Glovo — Historial de pedidos' },
] as const;

type TipoCSV = (typeof TIPOS)[number]['value'];

export default function ImportarVentas() {
  const [tipo, setTipo] = useState<TipoCSV>('uber');
  const [datos, setDatos] = useState<EstadisticaPrimePromo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      setDatos(null);
      setResultado(null);
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const text = ev.target?.result as string;
          const parsed =
            tipo === 'uber' ? parseUberGanancias(text) : parseGlovoOrderDetails(text);

          if (!parsed.length) {
            setError('No se encontraron pedidos válidos en el archivo. Verifica que sea el CSV correcto.');
            return;
          }
          setDatos(parsed);
        } catch (err: any) {
          setError(err.message || 'Error al parsear el archivo');
        }
      };
      reader.readAsText(file, 'UTF-8');
    },
    [tipo]
  );

  const handleGuardar = useCallback(async () => {
    if (!datos?.length) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await guardarEstadisticasPrimePromo(datos);
      if (res.errores.length) {
        setError(res.errores.join('\n'));
      }
      setResultado(
        `✅ ${res.insertados} nuevos · ${res.actualizados} actualizados` +
          (res.errores.length ? ` · ${res.errores.length} errores` : '')
      );
      setDatos(null);
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }, [datos]);

  const handleCancelar = useCallback(() => {
    setDatos(null);
    setError(null);
    setResultado(null);
    setFileName(null);
  }, []);

  const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

  return (
    <div style={{ padding: '28px', maxWidth: 900 }}>
      <h2
        style={{
          fontFamily: "'Oswald', sans-serif",
          fontSize: 22,
          fontWeight: 500,
          color: '#111',
          marginBottom: 24,
        }}
      >
        Importar estadísticas ventas
      </h2>

      {/* Selector tipo */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <label style={{ fontSize: 14, fontWeight: 500, color: '#444' }}>Tipo de archivo:</label>
        <select
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value as TipoCSV);
            setDatos(null);
            setError(null);
            setResultado(null);
            setFileName(null);
          }}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '0.5px solid #d0c8bc',
            fontSize: 14,
            background: '#fff',
          }}
        >
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Upload */}
      <div
        style={{
          border: '2px dashed #d0c8bc',
          borderRadius: 16,
          padding: 32,
          textAlign: 'center',
          background: '#faf9f7',
          marginBottom: 20,
        }}
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleFile}
          style={{ display: 'none' }}
          id="csv-upload"
        />
        <label
          htmlFor="csv-upload"
          style={{
            cursor: 'pointer',
            padding: '10px 24px',
            background: '#B01D23',
            color: '#fff',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Seleccionar CSV
        </label>
        {fileName && (
          <p style={{ marginTop: 12, fontSize: 13, color: '#666' }}>📄 {fileName}</p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 10,
            padding: 16,
            marginBottom: 20,
            color: '#991B1B',
            fontSize: 13,
            whiteSpace: 'pre-wrap',
          }}
        >
          {error}
        </div>
      )}

      {/* Resultado guardado */}
      {resultado && (
        <div
          style={{
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: 10,
            padding: 16,
            marginBottom: 20,
            color: '#166534',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {resultado}
        </div>
      )}

      {/* Tabla preview */}
      {datos && datos.length > 0 && (
        <>
          <div
            style={{
              background: '#fff',
              border: '0.5px solid #d0c8bc',
              borderRadius: 10,
              overflow: 'hidden',
              marginBottom: 20,
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f3ef' }}>
                  <th style={thStyle}>Marca</th>
                  <th style={thStyle}>Mes</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Pedidos</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>% Prime</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>% Promo</th>
                </tr>
              </thead>
              <tbody>
                {datos.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid #eee' }}>
                    <td style={tdStyle}>{d.marca}</td>
                    <td style={tdStyle}>
                      {d.mes}/{d.año}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 500 }}>
                      {d.pedidos_total}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#1D9E75' }}>
                      {fmtPct(d.pct_prime)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#BA7517' }}>
                      {d.pct_promo > 0 ? fmtPct(d.pct_promo) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleGuardar}
              disabled={guardando}
              style={{
                padding: '10px 24px',
                background: guardando ? '#999' : '#1D9E75',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                cursor: guardando ? 'default' : 'pointer',
              }}
            >
              {guardando ? 'Guardando...' : 'Confirmar'}
            </button>
            <button
              onClick={handleCancelar}
              style={{
                padding: '10px 24px',
                background: '#f5f3ef',
                color: '#444',
                border: '0.5px solid #d0c8bc',
                borderRadius: 6,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </>
      )}

      {/* Info */}
      <div
        style={{
          marginTop: 28,
          padding: 16,
          background: '#f5f3ef',
          borderRadius: 10,
          fontSize: 12,
          color: '#666',
          lineHeight: 1.7,
        }}
      >
        <strong>¿De dónde saco estos archivos?</strong>
        <br />
        • Uber → Uber Eats Manager → Informes → Detalle de ganancias (CSV)
        <br />
        • Glovo → Glovo Manager → Historial pedidos (CSV)
        <br />
        <br />
        Al confirmar, el ERP actualiza automáticamente las comisiones reales en Config Canales.
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 500,
  color: '#666',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
};
