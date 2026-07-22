/**
 * Análisis Horizontal / Vertical — lectura del P&G (conciliacion + categorias_pyg).
 * Estética Neobrutal Food-Pop (@/styles/neobrutal), calcada de la referencia
 * src/pages/ops/ReclamacionReembolsos.tsx: hero KPIs arriba, celdas de tabla
 * SIEMPRE blancas, cabecera INK con texto crema Oswald mayúsculas, color solo
 * en el valor semántico, bordes 3px INK + SHADOW.
 */
import React, { useMemo, useState } from "react";
import { useAnalisisHV, BLOQUES_ORDEN, type FilaCategoria, } from "../../lib/finanzas/useAnalisisHV";
import {
  OSW, LEX, INK, CREMA, SHADOW, BORDER_CARD, GRANATE, AMA, VERDE, ROJO, NAR, GRIS, eyebrow, BLANCO } from '@/styles/neobrutal';
import { fmtEur, fmtPct } from "@/lib/format";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

type Vista = "vertical" | "horizontal";

const fmtDeltaPP = (v: number | null) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${fmtEur(v, { showEuro: false, decimals: 1, signed: false })} pp`;

export function AnalisisHorizontalVertical({ embedded = false }: { embedded?: boolean } = {}) {
  const añoActual = new Date().getFullYear();
  const [año, setAño] = useState(añoActual);
  const [vista, setVista] = useState<Vista>("vertical");

  const hv = useAnalisisHV(año);

  const añosDisponibles = useMemo(() => [añoActual, añoActual - 1, añoActual - 2], [añoActual]);

  const card: React.CSSProperties = { background: BLANCO, border: BORDER_CARD, boxShadow: SHADOW };

  if (hv.loading) {
    return (
      <div style={{ padding: 40, color: GRIS, fontFamily: OSW, textTransform: "uppercase", letterSpacing: "1px" }}>
        Cargando análisis…
      </div>
    );
  }
  if (hv.error) {
    return <div style={{ padding: 40, color: ROJO, fontFamily: LEX }}>Error: {hv.error}</div>;
  }

  const mesR = hv.mesReciente;
  const pctGastoMesR = mesR != null ? hv.gastoTotalPct[mesR] : null;
  const deltaTendencia = mesR != null ? hv.deltaGastoTotalPP[mesR] : null;
  const mejora = deltaTendencia != null && deltaTendencia < 0;
  const empeora = deltaTendencia != null && deltaTendencia > 0;

  return (
    <div style={{ fontFamily: LEX, padding: embedded ? 0 : 28, background: embedded ? 'transparent' : CREMA, minHeight: embedded ? 'auto' : "100vh", color: INK }}>

      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        {!embedded && (
          <div>
            <span style={eyebrow(NAR, BLANCO)}>FINANZAS</span>
            <h1 style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 0.95, letterSpacing: "-0.5px", textTransform: "uppercase", color: GRANATE, margin: "10px 0 6px" }}>
              ANÁLISIS HORIZONTAL / VERTICAL
            </h1>
            <span style={{ fontFamily: LEX, fontSize: 13, color: GRIS }}>Peso de cada gasto sobre ventas y su evolución mes a mes</span>
          </div>
        )}
        <select
          value={año}
          onChange={e => setAño(Number(e.target.value))}
          style={{ background: BLANCO, border: `3px solid ${INK}`, color: INK, padding: "7px 14px", fontFamily: OSW, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", cursor: "pointer", outline: "none", boxShadow: SHADOW }}
        >
          {añosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Hero KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div style={{ ...card, padding: "16px 20px", background: hv.categoriaAlerta ? ROJO : BLANCO }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: hv.categoriaAlerta ? BLANCO : GRIS, marginBottom: 6 }}>
            Gasto que más creció este mes
          </div>
          {hv.categoriaAlerta ? (
            <>
              <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1, color: BLANCO }}>
                ⚠ {hv.categoriaAlerta.label}
              </div>
              <div style={{ fontFamily: LEX, fontSize: 12, color: BLANCO, marginTop: 6 }}>
                {fmtDeltaPP(hv.categoriaAlerta.deltaPP)} sobre ventas frente al mes anterior · se come el margen
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1, color: INK }}>Sin variación destacada</div>
              <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 6 }}>Ningún gasto ha subido su peso sobre ventas este mes</div>
            </>
          )}
        </div>

        <div style={{ ...card, padding: "16px 20px" }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: GRIS, marginBottom: 6 }}>% gasto total sobre ventas</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 1, color: INK }}>{pctGastoMesR != null ? fmtPct(pctGastoMesR, 1) : "—"}</div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 6 }}>
            {mesR != null ? `${MESES[mesR - 1]} ${año} · último mes con ventas registradas` : "Sin ventas registradas en este año"}
          </div>
        </div>

        <div style={{ ...card, padding: "16px 20px", background: mejora ? VERDE : empeora ? ROJO : BLANCO }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: mejora || empeora ? BLANCO : GRIS, marginBottom: 6 }}>Tendencia</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1, color: mejora || empeora ? BLANCO : INK }}>
            {deltaTendencia == null ? "—" : mejora ? "Mejora" : empeora ? "Empeora" : "Estable"}
          </div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: mejora || empeora ? BLANCO : GRIS, marginTop: 6 }}>
            {deltaTendencia == null ? "Sin mes anterior para comparar" : `${fmtDeltaPP(deltaTendencia)} de gasto sobre ventas vs. mes anterior`}
          </div>
        </div>
      </div>

      {/* Toggle de vista */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {([
          ["vertical", "Vertical · % sobre ventas"],
          ["horizontal", "Horizontal · variación mes a mes"],
        ] as [Vista, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setVista(k)} style={{
            padding: "8px 16px", border: `3px solid ${INK}`,
            background: vista === k ? GRANATE : BLANCO, color: vista === k ? BLANCO : INK,
            boxShadow: vista === k ? SHADOW : "none",
            fontFamily: OSW, fontSize: 13, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", cursor: "pointer",
          }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ ...card, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: LEX, minWidth: 920 }}>
          <thead>
            <tr style={{ background: INK }}>
              <th style={{ padding: "10px 12px", textAlign: "left", fontFamily: OSW, fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: CREMA, fontWeight: 600, whiteSpace: "nowrap", minWidth: 180 }}>
                Categoría de gasto
              </th>
              {MESES.map((m, i) => (
                <th key={m} style={{
                  padding: "10px 8px", textAlign: "right", fontFamily: OSW, fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase",
                  color: hv.mesReciente === i + 1 ? AMA : CREMA, fontWeight: 600, whiteSpace: "nowrap",
                }}>
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Fila de totales */}
            <tr style={{ borderBottom: `3px solid ${INK}` }}>
              <td style={{ padding: "10px 12px", fontFamily: OSW, fontWeight: 700, fontSize: 13, textTransform: "uppercase", color: GRANATE }}>
                {vista === "vertical" ? "% gasto total sobre ventas" : "Variación gasto total"}
              </td>
              {MESES.map((_, i) => {
                const m = i + 1;
                const val = vista === "vertical" ? hv.gastoTotalPct[m] : hv.deltaGastoTotalImportePct[m];
                const tieneVentas = hv.ventas[m] > 0;
                return (
                  <td key={m} style={{ padding: "10px 8px", textAlign: "right", fontFamily: OSW, fontWeight: 700, fontSize: 13, color: GRANATE, whiteSpace: "nowrap" }}>
                    {vista === "vertical"
                      ? (tieneVentas ? fmtPct(val as number, 1) : "—")
                      : (val == null ? "—" : `${(val as number) > 0 ? "+" : ""}${fmtPct(val as number, 1)}`)}
                  </td>
                );
              })}
            </tr>

            {BLOQUES_ORDEN.map(bloque => {
              const fila = hv.filas.find(f => f.bloque === bloque) as FilaCategoria;
              const esAlerta = hv.categoriaAlerta?.bloque === bloque;
              const colorTexto = esAlerta ? ROJO : INK;
              return (
                <tr key={bloque} style={{ borderBottom: `2px solid ${INK}` }}>
                  <td style={{ padding: "10px 12px", fontFamily: OSW, fontWeight: 600, fontSize: 13, color: colorTexto, whiteSpace: "nowrap" }}>
                    {esAlerta && <span title="El gasto que más se come el margen este mes" style={{ marginRight: 6 }}>⚠</span>}
                    {fila.label}
                  </td>
                  {MESES.map((_, i) => {
                    const m = i + 1;
                    const tieneVentas = hv.ventas[m] > 0;
                    let contenido: string;
                    if (vista === "vertical") {
                      contenido = tieneVentas ? fmtPct(fila.pctVertical[m], 1) : "—";
                    } else {
                      const d = fila.deltaImportePct[m];
                      contenido = d == null ? "—" : `${d > 0 ? "+" : ""}${fmtPct(d, 1)}`;
                    }
                    return (
                      <td key={m} style={{
                        padding: "10px 8px", textAlign: "right", fontFamily: OSW, fontWeight: esAlerta ? 700 : 600, fontSize: 13,
                        color: colorTexto, whiteSpace: "nowrap",
                      }}>
                        {contenido}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, fontFamily: LEX, fontSize: 12, color: GRIS }}>
        Vertical: % de cada bloque de gasto sobre las ventas de ese mes · Horizontal: variación % del importe de cada bloque respecto al mes anterior.
        Enero no tiene mes anterior dentro del año → se muestra “—”.
      </div>
    </div>
  );
}

export default AnalisisHorizontalVertical
