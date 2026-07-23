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
  OSW, LEX, INK, CREMA, SHADOW, AMA, VERDE, ROJO, GRIS, BLANCO } from '@/styles/neobrutal';
import RutaPantalla from '@/components/ui/RutaPantalla';
import { Plancha, PlanchaCelda, Papel, FrasePotente } from '@/components/kit/cantera';

/** Bloque compacto para la portada "Hoy": si no hay alertas, no ocupa espacio. */
export function AlertasBanner() {
  const { alertas, rojas, ambar, masUrgente, loading, error } = usePanelAlertas();
  if (loading || error || alertas.length === 0) return null;

  const color = rojas.length > 0 ? ROJO : AMA;
  const fg = rojas.length > 0 ? BLANCO : INK;

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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <RutaPantalla niveles={['Panel de alertas']} subtitulo="Ratios financieros fuera de rango · solo avisa cuando algo se rompe" />
      </div>

      {rojas.length > 0 ? (
        <FrasePotente significado="peligro">Hay {rojas.length} alerta{rojas.length !== 1 ? 's' : ''} roja{rojas.length !== 1 ? 's' : ''}: revisa {masUrgente ?? 'el ratio afectado'} antes de que empeore.</FrasePotente>
      ) : ambar.length > 0 ? (
        <FrasePotente significado="coste">Hay {ambar.length} alerta{ambar.length !== 1 ? 's' : ''} ámbar en vigilancia: sin urgencia, pero no las pierdas de vista.</FrasePotente>
      ) : (
        <FrasePotente significado="logro">Todo sano: ningún ratio financiero fuera de rango.</FrasePotente>
      )}

      <Plancha style={{ marginBottom: 20 }}>
        <PlanchaCelda first bg={rojas.length > 0 ? ROJO : BLANCO} color={rojas.length > 0 ? BLANCO : INK}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: "2px", textTransform: "uppercase" }}>Alertas rojas</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 1, marginTop: 6 }}>{rojas.length}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={ambar.length > 0 ? AMA : BLANCO} color={INK}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: "2px", textTransform: "uppercase" }}>Alertas ámbar</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 1, marginTop: 6 }}>{ambar.length}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={BLANCO} color={INK}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: GRIS }}>Más urgente</div>
          <div style={{
            fontFamily: OSW, fontWeight: 700, fontSize: masUrgente ? 17 : 18, lineHeight: 1.15, marginTop: 6,
            color: masUrgente ? INK : VERDE, textTransform: masUrgente ? "none" : "uppercase",
          }}>
            {masUrgente ?? "Ninguna — todo sano"}
          </div>
        </PlanchaCelda>
      </Plancha>

      {todoSano ? (
        <Papel ceja={VERDE} style={{ padding: "60px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 10, color: VERDE }}>✓</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 20, textTransform: "uppercase", color: VERDE, letterSpacing: "0.5px" }}>
            Todo sano — ningún ratio fuera de rango
          </div>
        </Papel>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {alertas.map(a => <FilaAlerta key={a.id} alerta={a} />)}
        </div>
      )}
    </div>
  );
}

function FilaAlerta({ alerta }: { alerta: Alerta }) {
  const color = alerta.severidad === "roja" ? ROJO : AMA;
  return (
    <Papel ceja={color} pad="0" style={{ display: "flex", overflow: "hidden" }}>
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
    </Papel>
  );
}
