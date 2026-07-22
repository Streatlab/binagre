/**
 * CabeceraEscandallo.tsx — Cabecera amarilla ÚNICA de todas las pestañas del Escandallo.
 *
 * Misma tarjeta neobrutal (AMA, borde 4px, sombra dura) en Índice, Ingredientes,
 * Mermas, EPS y Recetas: solo cambian el título, las pastillas y el dato.
 * Integra dentro de la misma tarjeta: título · pastillas-filtro · buscador ·
 * botones de desplazamiento (sin leyenda) · botón Nuevo.
 */
import type { CSSProperties } from 'react'
import { INK, AMA, OSW, LEX, SHADOW, VERDE, BLANCO } from '@/styles/neobrutal'

export interface PillCfg {
  label: string
  value: number
  color?: string
  active?: boolean
  onClick?: () => void
}

export interface ScrollCtl {
  onInicio: () => void
  onLeft: () => void
  onRight: () => void
  onFin: () => void
}

interface Props {
  titulo: string
  pills: PillCfg[]
  busqueda: string
  onBuscar: (v: string) => void
  placeholder?: string
  onNew?: () => void
  nuevoLabel?: string
  scroll?: ScrollCtl
  /** Botones extra (p.ej. "Categorías") junto al botón Nuevo. */
  extra?: React.ReactNode
}

export default function CabeceraEscandallo({
  titulo, pills, busqueda, onBuscar, placeholder, onNew, nuevoLabel = '+ Nuevo', scroll, extra,
}: Props) {
  return (
    <div style={{ background: AMA, border: `4px solid ${INK}`, boxShadow: SHADOW, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Fila 1: título + pastillas + Nuevo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, lineHeight: 1, letterSpacing: '1px', textTransform: 'uppercase', color: INK }}>{titulo}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {pills.map((p, i) => <Pill key={i} {...p} />)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {extra}
          {onNew && (
            <button onClick={onNew} style={btnNuevo}>{nuevoLabel}</button>
          )}
        </div>
      </div>

      {/* Fila 2: buscador (con aspa para limpiar, B9) + desplazamiento (sin leyenda) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240, display: 'flex' }}>
          <input
            value={busqueda}
            onChange={e => onBuscar(e.target.value)}
            placeholder={placeholder ?? '🔎  Buscar por nombre, ABV, proveedor, categoría…'}
            style={{
              flex: 1, background: BLANCO, border: `2px solid ${INK}`, borderRadius: 0,
              padding: '10px 32px 10px 14px', fontFamily: LEX, fontSize: 14, color: INK, outline: 'none',
            }}
          />
          {busqueda && (
            <button type="button" onClick={() => onBuscar('')} aria-label="Limpiar búsqueda" title="Limpiar"
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: INK, fontFamily: OSW, fontWeight: 700, fontSize: 18, lineHeight: 1, cursor: 'pointer' }}>✕</button>
          )}
        </div>
        {scroll && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button type="button" onClick={scroll.onInicio} style={scrollBtn} aria-label="Inicio">⏮</button>
            <button type="button" onClick={scroll.onLeft} style={scrollBtn} aria-label="Izquierda">◀</button>
            <button type="button" onClick={scroll.onRight} style={scrollBtn} aria-label="Derecha">▶</button>
            <button type="button" onClick={scroll.onFin} style={scrollBtn} aria-label="Fin">⏭</button>
          </div>
        )}
      </div>
    </div>
  )
}

function Pill({ label, value, color, active, onClick }: PillCfg) {
  const c = color ?? INK
  return (
    <button onClick={onClick} type="button" disabled={!onClick} style={{
      cursor: onClick ? 'pointer' : 'default', display: 'flex', alignItems: 'baseline', gap: 7,
      background: active ? c : BLANCO, border: `2px solid ${INK}`, borderRadius: 0,
      boxShadow: active ? `3px 3px 0 ${INK}` : 'none', padding: '6px 12px', transition: 'all 120ms',
    }}>
      <span style={{ fontFamily: OSW, fontSize: 10.5, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: active ? BLANCO : INK }}>{label}</span>
      <span style={{ fontFamily: OSW, fontSize: 19, fontWeight: 700, lineHeight: 1, color: active ? BLANCO : c }}>{value}</span>
    </button>
  )
}

const btnNuevo: CSSProperties = {
  fontFamily: OSW, fontWeight: 700, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase',
  background: VERDE, color: BLANCO, border: `2px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`,
  padding: '10px 18px', cursor: 'pointer', borderRadius: 0,
}

/** Botón secundario (fondo blanco) reutilizable en las cabeceras del Escandallo. */
export const btnSecundarioEsc: CSSProperties = {
  fontFamily: OSW, fontWeight: 700, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase',
  background: BLANCO, color: INK, border: `2px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`,
  padding: '10px 18px', cursor: 'pointer', borderRadius: 0,
}

const scrollBtn: CSSProperties = {
  fontFamily: OSW, fontWeight: 700, fontSize: 14, background: BLANCO, color: INK,
  border: `2px solid ${INK}`, boxShadow: `2px 2px 0 ${INK}`, borderRadius: 0,
  padding: '8px 12px', cursor: 'pointer', minWidth: 42, minHeight: 40,
}
