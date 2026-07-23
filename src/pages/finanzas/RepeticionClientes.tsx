/**
 * RepeticionClientes — % repetición de clientes, frecuencia media y clientes
 * perdidos. CANTERA ALEGRE v1.0 (área Ventas · verde). Solo capa visual; datos vía useRepeticionClientes.
 * Fuente real: crm_clientes (hoy vacía — ver aviso en pantalla).
 */
import React from "react";
import { useRepeticionClientes } from "@/lib/finanzas/useRepeticionClientes";
import { OSW, LEX, INK, CREMA, GRANATE, AMA, VERDE, ROJO, NAR, GRIS, BLANCO } from '@/styles/neobrutal';
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera';
import { fmtPct, fmtNum } from "@/lib/format";

export function RepeticionClientes({ embedded = false }: { embedded?: boolean } = {}) {
  const { loading, error, metricas, porMarca } = useRepeticionClientes();

  if (loading) {
    return (
      <div style={{ padding: 40, color: GRIS, fontFamily: OSW, textTransform: "uppercase", letterSpacing: "1px" }}>
        Cargando repetición de clientes…
      </div>
    );
  }
  if (error) {
    return <div style={{ padding: 40, color: ROJO, fontFamily: LEX }}>Error: {error}</div>;
  }

  const sinDatos = metricas.totalClientes === 0;

  // Titular = frase natural (no dato suelto); la cifra grande va aparte.
  const titular = sinDatos
    ? 'Todavía no hay clientes suficientes para medir repetición.'
    : metricas.pctRepeticion != null && metricas.pctRepeticion >= 30
      ? 'Buena parte de tus clientes vuelve a pedir.'
      : 'Pocos clientes repiten: la fidelización tiene margen de mejora.';

  const atencion = [
    metricas.frecuenciaMedia != null ? `Frecuencia media ${fmtNum(metricas.frecuenciaMedia, 1)} ped./cliente` : null,
    metricas.clientesPerdidos != null ? `${fmtNum(metricas.clientesPerdidos, 0)} clientes perdidos (90 días)` : null,
    `${fmtNum(metricas.totalClientes, 0)} clientes activos`,
  ].filter(Boolean) as string[];

  return (
    <PantallaCantera embedded={embedded}>
      {/* 1 · Héroe del área Ventas (verde) */}
      <HeroCantera
        area="ventas"
        titular={titular}
        etiquetaDato="% de clientes que repiten"
        cifra={metricas.pctRepeticion !== null ? fmtPct(metricas.pctRepeticion, 1) : '—'}
        resumen={metricas.frecuenciaMedia !== null ? <>Cada cliente que repite pide de media <b>{fmtNum(metricas.frecuenciaMedia, 1)}</b> veces.</> : undefined}
        atencion={atencion}
      />

      {/* 2 · Plancha comparativa de KPIs (celdas sólidas pegadas) */}
      <div>
        <SeccionLabel bg={VERDE}>Panorama de clientes</SeccionLabel>
        <Plancha>
          <PlanchaCelda bg={AMA} first>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>% repetición</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{metricas.pctRepeticion !== null ? fmtPct(metricas.pctRepeticion, 1) : '—'}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{fmtNum(metricas.totalClientes, 0)} clientes activos</div>
          </PlanchaCelda>
          <PlanchaCelda bg={VERDE}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Frecuencia media</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{metricas.frecuenciaMedia !== null ? `${fmtNum(metricas.frecuenciaMedia, 1)} ped./cliente` : '—'}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>pedidos por cliente con al menos 1 compra</div>
          </PlanchaCelda>
          <PlanchaCelda bg={GRANATE}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Clientes perdidos (90 días)</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{metricas.clientesPerdidos !== null ? fmtNum(metricas.clientesPerdidos, 0) : '—'}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>sin comprar en los últimos 90 días</div>
          </PlanchaCelda>
        </Plancha>
      </div>

      {/* 3 · Frase potente (color por significado, distinto del héroe verde) */}
      {!sinDatos && metricas.clientesPerdidos !== null && metricas.clientesPerdidos > 0 && (
        <FrasePotente significado="peligro">Cada cliente perdido es un ticket medio menos cada mes: reactivarlo cuesta menos que captar uno nuevo.</FrasePotente>
      )}

      {/* Por marca — papel (sin sombra) */}
      <div>
        <SeccionLabel bg={NAR}>Por marca</SeccionLabel>
        {sinDatos ? (
          <Papel ceja={NAR}>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 16, textTransform: "uppercase", color: INK, marginBottom: 8 }}>
              Sin datos en crm_clientes todavía
            </div>
            <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS }}>
              Este panel se activa solo en cuanto la tabla tenga clientes.
            </div>
          </Papel>
        ) : (
          <Papel ceja={NAR} pad="0" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: LEX }}>
              <thead>
                <tr style={{ background: INK }}>
                  {["Marca", "Nº clientes", "% repetición", "Frecuencia media", "Perdidos"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: h === "Marca" ? "left" : "right", fontFamily: OSW, fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: CREMA, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {porMarca.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 30, textAlign: "center", color: GRIS, fontFamily: LEX }}>No hay datos de marca.</td></tr>
                )}
                {porMarca.map(m => (
                  <tr key={m.marca} style={{ borderBottom: `2px solid ${INK}` }}>
                    <td style={{ padding: "10px 12px", fontFamily: OSW, fontWeight: 600 }}>{m.marca}</td>
                    <td style={{ padding: "10px 12px", textAlign: 'right', color: GRIS }}>{fmtNum(m.numClientes, 0)}</td>
                    <td style={{ padding: "10px 12px", textAlign: 'right', fontFamily: OSW, fontWeight: 700, color: VERDE }}>{m.pctRepeticion !== null ? fmtPct(m.pctRepeticion, 1) : "—"}</td>
                    <td style={{ padding: "10px 12px", textAlign: 'right' }}>{m.frecuenciaMedia !== null ? fmtNum(m.frecuenciaMedia, 1) : "—"}</td>
                    <td style={{ padding: "10px 12px", textAlign: 'right', color: GRANATE, fontWeight: 600 }}>{fmtNum(m.perdidos, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Papel>
        )}
      </div>
    </PantallaCantera>
  );
}

export default RepeticionClientes
