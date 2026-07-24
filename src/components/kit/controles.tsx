/**
 * kit/controles.tsx — CONTROLES canónicos CANTERA ALEGRE v1.0.
 * Buscadores, filtros, botones y listas del ERP: una sola verdad, sin radios
 * redondeados ni bordes finos grises heredados del kit antiguo.
 *
 * Reglas (LEY-ESTILO-01):
 *  · Radio 0 SIEMPRE.
 *  · Campos y filtros: planos, borde 2px tinta, sin sombra (no son la estrella).
 *  · Pulsables de acción: sombra dura 3px tinta.
 *  · Activo de filtro/lista: tinta sólida con texto crema. El ROSA queda
 *    reservado a las pestañas (TabsPastilla / TabsContainer).
 */
import type { CSSProperties, ReactNode } from 'react'
import { INK, CREMA, BLANCO, OSW, LEX } from '@/styles/neobrutal'

export const SHADOW_DURA = `3px 3px 0 ${INK}`

/** Buscador / campo de texto canónico. */
export function BuscadorCantera({
  value, onChange, placeholder, style,
}: { value: string; onChange: (v: string) => void; placeholder?: string; style?: CSSProperties }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        flex: 1, minWidth: 180, background: BLANCO, color: INK,
        border: `2px solid ${INK}`, borderRadius: 0, outline: 'none',
        padding: '11px 14px', fontFamily: LEX, fontSize: 14,
        ...style,
      }}
    />
  )
}

/** Select canónico (misma piel que el buscador). */
export function SelectCantera({
  value, onChange, children, style,
}: { value: string; onChange: (v: string) => void; children: ReactNode; style?: CSSProperties }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: BLANCO, color: INK, border: `2px solid ${INK}`, borderRadius: 0,
        padding: '9px 12px', fontFamily: OSW, fontSize: 13, letterSpacing: '0.5px',
        textTransform: 'uppercase', cursor: 'pointer', ...style,
      }}
    >
      {children}
    </select>
  )
}

/** Filtro plano (gamas, categorías…). Activo = tinta sólida. */
export function estiloFiltro(activo: boolean, extra?: CSSProperties): CSSProperties {
  return {
    fontFamily: OSW, fontSize: 12.5, fontWeight: 600, letterSpacing: '0.6px',
    textTransform: 'uppercase', padding: '7px 13px', borderRadius: 0, cursor: 'pointer',
    whiteSpace: 'nowrap', border: `2px solid ${INK}`,
    background: activo ? INK : 'transparent',
    color: activo ? CREMA : INK,
    ...extra,
  }
}

/** Botón de acción (pulsable → sombra dura). */
export function estiloBoton(extra?: CSSProperties): CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    background: BLANCO, color: INK, border: `2px solid ${INK}`, borderRadius: 0,
    boxShadow: SHADOW_DURA, padding: '9px 15px',
    fontFamily: OSW, fontSize: 13, fontWeight: 600, letterSpacing: '0.6px',
    textTransform: 'uppercase', cursor: 'pointer', ...extra,
  }
}

/** Item de lista lateral (fichas, personas…). Activo = tinta sólida. */
export function estiloItemLista(activo: boolean): CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
    padding: '9px 12px', borderRadius: 0, cursor: 'pointer',
    border: `2px solid ${INK}`, borderTop: 'none',
    background: activo ? INK : BLANCO,
    color: activo ? CREMA : INK,
    fontFamily: LEX, fontSize: 14,
  }
}
