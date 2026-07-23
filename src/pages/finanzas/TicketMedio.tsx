/**
 * Ticket medio — por marca, por canal y global. Evolución temporal.
 * Palanca de crecimiento sin más pedidos: subir el ticket medio.
 * CANTERA ALEGRE v1.0 (área Ventas · verde). Solo capa visual; datos vía useTicketMedio.
 */
import React from "react";
import { useTicketMedio } from "@/lib/finanzas/useTicketMedio";
import type { CanalTicket } from "@/lib/finanzas/useTicketMedio";
import { OSW, LEX, INK, CREMA, GRANATE, AZUL, VERDE, ROJO, NAR, GRIS, CORP, BLANCO } from '@/styles/neobrutal';
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera';
import { fmtEur, fmtNum } from "@/lib/format";

const CANAL_CORP_KEY: Record<CanalTicket, string> = {
  uber: "uber", glovo: "glovo", just_eat: "je", web: "web", directa: "dir",
};
const MESES_LABEL = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtMesEtiqueta(mes: string): string {
  const [y, m] = mes.split("-");
  const idx = Number(m) - 1;
  return `${MESES_LABEL[idx] ?? m} ${y}`;
}

export function TicketMedio({ embedded = false }: { embedded?: boolean } = {}) {
  const { loading, error, ticketGlobalUltimoMes, mesUltimoMes, mejorMarca, tendenciaPct, porMarca, porCanal, evolucion } = useTicketMedio();

  if (loading) return <div style={{ padding: 40, color: GRIS, fontFamily: OSW, textTransform: "uppercase", letterSpacing: "1px" }}>Cargando ticket medio…</div>;
  if (error) return <div style={{ padding: 40, color: ROJO, fontFamily: LEX }}>Error: {error}</div>;

  const tendenciaPositiva = tendenciaPct !== null && tendenciaPct >= 0;
  const canalesActivos = porCanal.filter(c => c.pedidos > 0);

  // Titular = frase natural (no dato suelto); la cifra grande va aparte.
  const titular = ticketGlobalUltimoMes == null
    ? 'Aún no hay ticket medio este mes.'
    : tendenciaPct == null ? 'Tu ticket medio del mes, sin comparativa previa.'
    : tendenciaPositiva ? 'Subes el ticket medio: cada pedido deja un poco más.'
    : 'El ticket medio afloja respecto al mes pasado.';

  const atencion = [
    mejorMarca ? `Mejor marca: ${mejorMarca.marca}` : null,
    tendenciaPct != null ? `Tendencia ${tendenciaPositiva ? '+' : '−'}${Math.abs(tendenciaPct).toLocaleString('es-ES', { maximumFractionDigits: 1 })}% vs mes anterior` : null,
    canalesActivos.length > 0 ? `${canalesActivos.length} canales activos` : null,
  ].filter(Boolean) as string[];

  return (
    <PantallaCantera embedded={embedded}>
      {/* 1 · Héroe del área Ventas (verde) */}
      <HeroCantera
        area="ventas"
        periodo={mesUltimoMes ? fmtMesEtiqueta(mesUltimoMes) : undefined}
        titular={titular}
        etiquetaDato="Ticket medio global"
        cifra={ticketGlobalUltimoMes != null ? fmtEur(ticketGlobalUltimoMes, { decimals: 2 }) : '—'}
        variacionPct={tendenciaPct}
        resumen={mejorMarca ? <>Mejor marca por ticket: <b>{mejorMarca.marca}</b> · {fmtEur(mejorMarca.ticketMedio, { decimals: 2 })}</> : undefined}
        atencion={atencion}
      />

      {/* 2 · Plancha comparativa por canal (celdas sólidas pegadas) */}
      {canalesActivos.length > 0 && (
        <div>
          <SeccionLabel bg={VERDE}>Ticket medio por canal</SeccionLabel>
          <Plancha>
            {canalesActivos.map((c, i) => {
              const bg = CORP[CANAL_CORP_KEY[c.canal]] ?? INK;
              const fg = c.canal === 'glovo' ? INK : BLANCO;
              return (
                <PlanchaCelda key={c.canal} bg={bg} color={fg} first={i === 0}>
                  <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>{c.label}</div>
                  <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(c.ticketMedio, { decimals: 2 })}</div>
                  <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{fmtNum(c.pedidos, 0)} pedidos</div>
                </PlanchaCelda>
              );
            })}
          </Plancha>
        </div>
      )}

      {/* 3 · Frase potente (color por significado, distinto del héroe verde) */}
      {tendenciaPct != null && (
        tendenciaPositiva
          ? <FrasePotente significado="oportunidad">Cada euro de ticket medio es margen sin coste de adquisición: la palanca más barata para crecer.</FrasePotente>
          : <FrasePotente significado="peligro">El ticket medio cae: revisa upselling y combos antes de que arrastre la facturación.</FrasePotente>
      )}

      {/* Por marca — papel (sin sombra) */}
      <div>
        <SeccionLabel bg={GRANATE}>Por marca</SeccionLabel>
        <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
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
        </Papel>
      </div>

      {/* Evolución — papel (sin sombra) */}
      <div>
        <SeccionLabel bg={NAR}>Evolución · últimos 12 meses</SeccionLabel>
        <Papel ceja={NAR} pad="0" style={{ overflowX: 'auto' }}>
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
                const tri = row.variacion === null ? '—' : row.variacion >= 0 ? '▲ +' : '▼ −';
                return (
                  <tr key={row.mes} style={{ borderBottom: `2px solid ${INK}` }}>
                    <td style={{ padding: "10px 12px", fontFamily: OSW, fontWeight: 600, textTransform: "uppercase" }}>{fmtMesEtiqueta(row.mes)}</td>
                    <td style={{ padding: "10px 12px", fontFamily: OSW, fontWeight: 700, textAlign: "right" }}>{fmtEur(row.ticketMedio, { decimals: 2 })}</td>
                    <td style={{ padding: "10px 12px", fontFamily: OSW, fontWeight: 700, textAlign: "right", color: varColor }}>{row.variacion === null ? '—' : `${tri}${Math.abs(row.variacion).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Papel>
      </div>
    </PantallaCantera>
  );
}

export default TicketMedio
