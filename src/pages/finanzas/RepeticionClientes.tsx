/**
 * RepeticionClientes — % repetición de clientes, frecuencia media y clientes
 * perdidos. Estética Neobrutal Food-Pop (@/styles/neobrutal).
 * Fuente real: crm_clientes (hoy vacía — ver aviso en pantalla).
 */
import React from "react";
import { useRepeticionClientes } from "@/lib/finanzas/useRepeticionClientes";
import {
  OSW, LEX, INK, CREMA, SHADOW, BORDER_CARD,
  GRANATE, AMA, VERDE, ROJO, NAR, GRIS, eyebrow,
} from "@/styles/neobrutal";
import { fmtPct, fmtNum } from "@/lib/format";

const card: React.CSSProperties = { background: "#fff", border: BORDER_CARD, boxShadow: SHADOW };

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

  return (
    <div style={{ fontFamily: LEX, padding: embedded ? 0 : 28, background: embedded ? 'transparent' : CREMA, minHeight: embedded ? 'auto' : "100vh", color: INK }}>

      {!embedded && (
        <div style={{ marginBottom: 20 }}>
          <span style={eyebrow(NAR, "#fff")}>FINANZAS</span>
          <h1 style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 0.95, letterSpacing: "-0.5px", textTransform: "uppercase", color: GRANATE, margin: "10px 0 6px" }}>
            REPETICIÓN DE CLIENTES
          </h1>
          <span style={{ fontFamily: LEX, fontSize: 13, color: GRIS }}>% de clientes que repiten, frecuencia media de pedidos y clientes perdidos</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 20 }}>
        <HeroKpi
          label="% repetición"
          value={metricas.pctRepeticion !== null ? fmtPct(metricas.pctRepeticion, 1) : "—"}
          sub={`${fmtNum(metricas.totalClientes, 0)} clientes activos`}
          bg={AMA}
          fg={INK}
        />
        <HeroKpi
          label="Frecuencia media"
          value={metricas.frecuenciaMedia !== null ? `${fmtNum(metricas.frecuenciaMedia, 1)} ped./cliente` : "—"}
          sub="pedidos por cliente con al menos 1 compra"
          bg={VERDE}
          fg="#fff"
        />
        <HeroKpi
          label="Clientes perdidos (90 días)"
          value={metricas.clientesPerdidos !== null ? fmtNum(metricas.clientesPerdidos, 0) : "—"}
          sub="sin comprar en los últimos 90 días"
          bg={GRANATE}
          fg="#fff"
        />
      </div>

      {sinDatos ? (
        <div style={{ ...card, padding: "22px 24px", background: "#fff" }}>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 16, textTransform: "uppercase", color: INK, marginBottom: 8 }}>
            Sin datos en crm_clientes todavía
          </div>
          <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS }}>
            Este panel se activa solo en cuanto la tabla tenga clientes.
          </div>
        </div>
      ) : (
        <div style={{ ...card, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: LEX }}>
            <thead>
              <tr style={{ background: INK }}>
                {["Marca", "Nº clientes", "% repetición", "Frecuencia media", "Perdidos"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontFamily: OSW, fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: CREMA, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {porMarca.map(m => (
                <tr key={m.marca} style={{ borderBottom: `2px solid ${INK}` }}>
                  <td style={{ padding: "10px 12px", fontFamily: OSW, fontWeight: 600 }}>{m.marca}</td>
                  <td style={{ padding: "10px 12px" }}>{fmtNum(m.numClientes, 0)}</td>
                  <td style={{ padding: "10px 12px" }}>{m.pctRepeticion !== null ? fmtPct(m.pctRepeticion, 1) : "—"}</td>
                  <td style={{ padding: "10px 12px" }}>{m.frecuenciaMedia !== null ? fmtNum(m.frecuenciaMedia, 1) : "—"}</td>
                  <td style={{ padding: "10px 12px" }}>{fmtNum(m.perdidos, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HeroKpi({ label, value, sub, bg, fg }: { label: string; value: string; sub: string; bg: string; fg: string }) {
  return (
    <div style={{ ...card, padding: "16px 20px", background: bg }}>
      <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: fg, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 30, lineHeight: 1, color: fg }}>{value}</div>
      <div style={{ fontFamily: LEX, fontSize: 12, color: fg, marginTop: 6, opacity: 0.9 }}>{sub}</div>
    </div>
  );
}

export default RepeticionClientes
