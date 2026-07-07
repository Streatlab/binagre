/**
 * Ticket medio — por marca, por canal y global. Evolución temporal.
 * Palanca de crecimiento sin más pedidos: subir el ticket medio.
 * Estética Neobrutal Food-Pop (@/styles/neobrutal).
 */
import React, { useMemo } from "react";
import { useTicketMedio } from "@/lib/finanzas/useTicketMedio";
import type { CanalTicket } from "@/lib/finanzas/useTicketMedio";
import {
  OSW, LEX, INK, CREMA, SHADOW, BORDER_CARD,
  GRANATE, AMA, VERDE, ROJO, NAR, GRIS, CORP, eyebrow, d, DELTA,
} from "@/styles/neobrutal";
import { fmtEur, fmtNum } from "@/lib/format";

const CANAL_CORP_KEY: Record<CanalTicket, string> = {
  uber: "uber", glovo: "glovo", just_eat: "je", web: "web", directa: "dir",
};

const MESES_LABEL = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fmtMesEtiqueta(mes: string): string {
  // mes = 'YYYY-MM'
  const [y, m] = mes.split("-");
  const idx = Number(m) - 1;
  return `${MESES_LABEL[idx] ?? m} ${y}`;
}

export default function TicketMedio() {
  const { loading, error, ticketGlobalUltimoMes, mesUltimoMes, mejorMarca, tendenciaPct, porMarca, porCanal, evolucion } = useTicketMedio();

  const maxTicketCanal = useMemo(
    () => Math.max(1, ...porCanal.map(c => c.ticketMedio)),
    [porCanal],
  );

  const card: React.CSSProperties = { background: "#fff", border: BORDER_CARD, boxShadow: SHADOW };

  if (loading) return <div style={{ padding: 40, color: GRIS, fontFamily: OSW, textTransform: "uppercase", letterSpacing: "1px" }}>Cargando ticket medio…</div>;
  if (error) return <div style={{ padding: 40, color: ROJO, fontFamily: LEX }}>Error: {error}</div>;

  const tendenciaPositiva = tendenciaPct !== null && tendenciaPct >= 0;
  const tendenciaColor = tendenciaPct === null ? GRIS : tendenciaPositiva ? VERDE : ROJO;

  return (
    <div style={{ fontFamily: LEX, padding: 28, background: CREMA, minHeight: "100vh", color: INK }}>

      <div style={{ marginBottom: 20 }}>
        <span style={eyebrow(NAR, "#fff")}>FINANZAS</span>
        <h1 style={{ ...d("34px", GRANATE), margin: "10px 0 6px" }}>TICKET MEDIO</h1>
        <span style={{ fontFamily: LEX, fontSize: 13, color: GRIS }}>Por marca, por canal y global · palanca de crecimiento sin más pedidos</span>
      </div>

      {/* Hero KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 22 }}>
        <div style={{ ...card, padding: "16px 20px", background: AMA }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: INK, marginBottom: 6 }}>Ticket medio global</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 1, color: INK }}>
            {ticketGlobalUltimoMes !== null ? fmtEur(ticketGlobalUltimoMes, { decimals: 2 }) : "—"}
          </div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: INK, marginTop: 6 }}>
            {mesUltimoMes ? `Mes de ${fmtMesEtiqueta(mesUltimoMes)}` : "Sin datos"}
          </div>
        </div>

        <div style={{ ...card, padding: "16px 20px", background: "#fff" }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: GRIS, marginBottom: 6 }}>Mejor marca por ticket</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, lineHeight: 1.1, color: INK }}>
            {mejorMarca ? mejorMarca.marca : "—"}
          </div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, color: GRANATE, marginTop: 6 }}>
            {mejorMarca ? fmtEur(mejorMarca.ticketMedio, { decimals: 2 }) : "—"}
          </div>
        </div>

        <div style={{ ...card, padding: "16px 20px", background: tendenciaColor, color: "#fff" }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: "#fff", marginBottom: 6 }}>Tendencia</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 1, color: "#fff" }}>
            {DELTA(tendenciaPct)}
          </div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: "#fff", marginTop: 6 }}>
            Mes actual vs mes anterior
          </div>
        </div>
      </div>

      {/* Por canal — mini gráfico de barras */}
      <div style={{ marginBottom: 22 }}>
        <span style={eyebrow(NAR, "#fff")}>POR CANAL</span>
        <div style={{ ...card, padding: "16px 20px", marginTop: 10 }}>
          {porCanal.every(c => c.pedidos === 0) ? (
            <div style={{ color: GRIS, fontSize: 13, fontFamily: LEX }}>Sin datos de canal.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {porCanal.map(c => {
                const color = CORP[CANAL_CORP_KEY[c.canal]] ?? GRIS;
                const widthPct = c.pedidos > 0 ? Math.max(4, (c.ticketMedio / maxTicketCanal) * 100) : 0;
                return (
                  <div key={c.canal} style={{ display: "grid", gridTemplateColumns: "110px 1fr 100px", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: OSW, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: INK }}>{c.label}</span>
                    <div style={{ background: "#f0ece0", border: `2px solid ${INK}`, height: 18, position: "relative" }}>
                      <div style={{ background: color, width: `${widthPct}%`, height: "100%" }} />
                    </div>
                    <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 14, textAlign: "right", color: c.pedidos > 0 ? INK : GRIS }}>
                      {c.pedidos > 0 ? fmtEur(c.ticketMedio, { decimals: 2 }) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Por marca */}
      <div style={{ marginBottom: 22 }}>
        <span style={eyebrow(NAR, "#fff")}>POR MARCA</span>
        <div style={{ ...card, overflowX: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: LEX }}>
            <thead>
              <tr style={{ background: INK }}>
                {["Marca", "Ticket medio", "Pedidos", "Bruto"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: h === "Marca" ? "left" : "right", fontFamily: OSW, fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: CREMA, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {porMarca.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 30, textAlign: "center", color: GRIS, fontFamily: LEX }}>No hay datos de marca.</td></tr>
              )}
              {porMarca.map(row => (
                <tr key={row.marca} style={{ borderBottom: `2px solid ${INK}` }}>
                  <td style={{ padding: "10px 12px", fontFamily: OSW, fontWeight: 600 }}>{row.marca}</td>
                  <td style={{ padding: "10px 12px", fontFamily: OSW, fontWeight: 700, textAlign: "right", color: GRANATE }}>{fmtEur(row.ticketMedio, { decimals: 2 })}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: GRIS }}>{fmtNum(row.pedidos, 0)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>{fmtEur(row.bruto, { decimals: 0 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evolución temporal */}
      <div style={{ marginBottom: 10 }}>
        <span style={eyebrow(NAR, "#fff")}>EVOLUCIÓN · ÚLTIMOS 12 MESES</span>
        <div style={{ ...card, overflowX: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: LEX }}>
            <thead>
              <tr style={{ background: INK }}>
                {["Mes", "Ticket medio", "Variación vs mes anterior"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: h === "Mes" ? "left" : "right", fontFamily: OSW, fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: CREMA, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {evolucion.length === 0 && (
                <tr><td colSpan={3} style={{ padding: 30, textAlign: "center", color: GRIS, fontFamily: LEX }}>No hay evolución disponible.</td></tr>
              )}
              {evolucion.map(row => {
                const varColor = row.variacion === null ? GRIS : row.variacion >= 0 ? VERDE : ROJO;
                return (
                  <tr key={row.mes} style={{ borderBottom: `2px solid ${INK}` }}>
                    <td style={{ padding: "10px 12px", fontFamily: OSW, fontWeight: 600, textTransform: "uppercase" }}>{fmtMesEtiqueta(row.mes)}</td>
                    <td style={{ padding: "10px 12px", fontFamily: OSW, fontWeight: 700, textAlign: "right" }}>{fmtEur(row.ticketMedio, { decimals: 2 })}</td>
                    <td style={{ padding: "10px 12px", fontFamily: OSW, fontWeight: 700, textAlign: "right", color: varColor }}>{DELTA(row.variacion)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
