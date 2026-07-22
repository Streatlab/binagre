/**
 * Panel de Alertas — dispara alertas SOLO cuando un ratio financiero se rompe.
 * Estética Neobrutal Food-Pop (@/styles/neobrutal).
 * Módulo autocontenido: lee de src/lib/finanzas/usePanelAlertas.ts, sin
 * depender de otros hooks de otros módulos.
 */
import React from "react";
import { Link } from "react-router-dom";
import { usePanelAlertas } from "../../lib/finanzas/usePanelAlertas";
import type { Alerta } from "../../lib/finanzas/usePanelAlertas";
import {
  OSW, LEX, INK, CREMA, SHADOW, BORDER_CARD, GRANATE, AMA, VERDE, ROJO, NAR, GRIS, eyebrow, BLANCO } from '@/styles/neobrutal';

/** Bloque compacto para la portada "Hoy": si no hay alertas, no ocupa espacio. */
export function AlertasBanner() {
  const { alertas, rojas, ambar, masUrgente, loading, error } = usePanelAlertas();
  if (loading || error || alertas.length === 0) return null;

  const color = rojas.length > 0 ? ROJO : AMA;
  const fg = rojas.length > 0 ? '#fff' : INK;

  return (
    <Link to="/finanzas/panel-alertas" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      background: color, color: fg, border: `3px solid ${INK}`, boxShadow: SHADOW,
      padding: '12px 16px', marginBottom: 14, textDecoration: 'none',
    }}>
      <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        ⚠ {rojas.length > 0 ? `${rojas.length} alerta${rojas.length === 1 ? '' : 's'} roja${rojas.length === 1 ? '' : 's'}` : `${ambar.length} alerta${ambar.length === 1 ? '' : 's'} ámbar`}
        {masUrgente && <span style={{ fontFamily: LEX, fontWeight: 400, marginLeft: 8 }}>· {masUrgente}</span>}
      </span>
      <span style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '0.5px', textDecoration: 'underline' }}>VER TODAS →</span>
    </Link>
  );
}

export default function PanelAlertas() {
  const { alertas, rojas, ambar, masUrgente, loading, error } = usePanelAlertas();

  const card: React.CSSProperties = { background: BLANCO, border: BORDER_CARD, boxShadow: SHADOW };

  if (loading) {
    return (
      <div style={{ padding: 40, color: GRIS, fontFamily: OSW, textTransform: "uppercase", letterSpacing: "1px" }}>
        Cargando alertas…
      </div>
    );
  }
  if (error) {
    return <div style={{ padding: 40, color: ROJO, fontFamily: LEX }}>Error: {error}</div>;
  }

  const todoSano = alertas.length === 0;

  return (
    <div style={{ fontFamily: LEX, padding: 28, background: CREMA, minHeight: "100vh", color: INK }}>

      <div style={{ marginBottom: 20 }}>
        <span style={eyebrow(NAR, BLANCO)}>FINANZAS</span>
        <h1 style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 0.95, letterSpacing: "-0.5px", textTransform: "uppercase", color: GRANATE, margin: "10px 0 6px" }}>
          PANEL DE ALERTAS
        </h1>
        <span style={{ fontFamily: LEX, fontSize: 13, color: GRIS }}>
          Ratios financieros fuera de rango · solo avisa cuando algo se rompe
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 24 }}>
        <div style={{ ...card, padding: "16px 20px", background: rojas.length > 0 ? ROJO : BLANCO }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: rojas.length > 0 ? BLANCO : INK, marginBottom: 6 }}>
            Alertas rojas
          </div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 1, color: rojas.length > 0 ? BLANCO : INK }}>
            {rojas.length}
          </div>
        </div>
        <div style={{ ...card, padding: "16px 20px", background: ambar.length > 0 ? AMA : BLANCO }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: INK, marginBottom: 6 }}>
            Alertas ámbar
          </div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 1, color: INK }}>
            {ambar.length}
          </div>
        </div>
        <div style={{ ...card, padding: "16px 20px" }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: GRIS, marginBottom: 6 }}>
            Más urgente
          </div>
          <div style={{
            fontFamily: OSW, fontWeight: 700, fontSize: masUrgente ? 17 : 18, lineHeight: 1.15,
            color: masUrgente ? INK : VERDE, textTransform: masUrgente ? "none" : "uppercase",
          }}>
            {masUrgente ?? "Ninguna — todo sano"}
          </div>
        </div>
      </div>

      {todoSano ? (
        <div style={{ ...card, padding: "60px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 10, color: VERDE }}>✓</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 20, textTransform: "uppercase", color: VERDE, letterSpacing: "0.5px" }}>
            Todo sano — ningún ratio fuera de rango
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {alertas.map(a => <FilaAlerta key={a.id} alerta={a} card={card} />)}
        </div>
      )}
    </div>
  );
}

function FilaAlerta({ alerta, card }: { alerta: Alerta; card: React.CSSProperties }) {
  const color = alerta.severidad === "roja" ? ROJO : AMA;
  return (
    <div style={{ ...card, display: "flex", padding: 0, overflow: "hidden" }}>
      <div style={{ width: 10, background: color, flexShrink: 0 }} />
      <div style={{ padding: "14px 18px", flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{
              background: color, color: alerta.severidad === "roja" ? BLANCO : INK,
              border: `2px solid ${INK}`, padding: "2px 8px", fontSize: 10,
              fontFamily: OSW, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase",
            }}>
              {alerta.severidad === "roja" ? "Roja" : "Ámbar"}
            </span>
            <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 15, textTransform: "uppercase", color: INK }}>
              {alerta.titulo}
            </span>
          </div>
          <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS }}>{alerta.detalle}</div>
        </div>
        {alerta.valor && (
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 20, color: alerta.severidad === "roja" ? ROJO : INK, whiteSpace: "nowrap" }}>
            {alerta.valor}
          </div>
        )}
      </div>
    </div>
  );
}
