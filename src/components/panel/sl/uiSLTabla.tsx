import { BLANCO } from '@/styles/neobrutal'
/**
 * uiSLTabla — extensión del kit SL (Ley Visual SL v2).
 * Vive junto a uiSL.tsx y comparte sus tokens. Aquí van las piezas que
 * uiSL no cubría: navegación por pestañas, barra de herramientas, botones,
 * campos, tabla densa con banda de estado y barra dentro de la celda,
 * ventana modal y esqueleto de carga.
 *
 * Regla: ninguna pantalla maqueta estas piezas a mano. Se importan de aquí.
 */
import type { CSSProperties, ReactNode } from 'react'
import { C, Pill, type Tone } from './uiSL'

/* ── Pestañas: subrayado rojo, sin cajas ── */
export function Tabs<T extends string>({ tabs, activeId, onChange }: {
  tabs: Array<{ id: T; label: string; count?: number }>
  activeId: T
  onChange: (id: T) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${C.line}`, flexWrap: 'wrap' }}>
      {tabs.map(t => {
        const on = t.id === activeId
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '10px 14px', background: 'transparent', border: 'none',
              borderBottom: `3px solid ${on ? C.rojo : 'transparent'}`, marginBottom: -1,
              fontFamily: "'Nunito', sans-serif", fontSize: 12.5, fontWeight: 800,
              color: on ? C.rojo : C.grisCl, cursor: 'pointer',
            }}
          >
            {t.label}
            {t.count != null && (
              <span className="slnum" style={{
                fontSize: 10.5, fontWeight: 800, padding: '1px 7px', borderRadius: 999,
                background: on ? C.rojoSoft : C.track, color: on ? C.rojoSem : C.grisCl,
              }}>{t.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ── Barra de herramientas (filtros + acciones) ── */
export function Toolbar({ children, right }: { children?: ReactNode; right?: ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      marginBottom: 12, justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{children}</div>
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{right}</div>}
    </div>
  )
}

/* ── Botón ── */
export type BotonVar = 'primario' | 'plano' | 'fantasma' | 'peligro'
export function Boton({ children, onClick, variante = 'plano', disabled, style }: {
  children: ReactNode
  onClick?: () => void
  variante?: BotonVar
  disabled?: boolean
  style?: CSSProperties
}) {
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 15px', borderRadius: 999, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 12,
    whiteSpace: 'nowrap', opacity: disabled ? 0.45 : 1, border: '1px solid transparent',
  }
  const varStyles: Record<BotonVar, CSSProperties> = {
    primario:  { background: C.rojo, color: BLANCO },
    plano:     { background: C.card, color: C.gris, border: `1px solid ${C.line}` },
    fantasma:  { background: 'transparent', color: C.grisCl },
    peligro:   { background: C.rojoSoft, color: C.rojoSem },
  }
  return (
    <button disabled={disabled} onClick={onClick} style={{ ...base, ...varStyles[variante], ...style }}>
      {children}
    </button>
  )
}

/* ── Campo de texto / buscador ── */
export function Campo({ valor, onChange, placeholder, ancho = 220, tipo = 'text' }: {
  valor: string
  onChange: (v: string) => void
  placeholder?: string
  ancho?: number | string
  tipo?: string
}) {
  return (
    <input
      type={tipo}
      value={valor}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{
        width: ancho, padding: '8px 13px', borderRadius: 999,
        border: `1px solid ${C.line}`, background: C.card, color: C.ink,
        fontFamily: "'Nunito', sans-serif", fontSize: 12.5, fontWeight: 700,
        outline: 'none',
      }}
    />
  )
}

/* ── Selector ── */
export function Selector<T extends string>({ valor, onChange, opciones, ancho = 170 }: {
  valor: T
  onChange: (v: T) => void
  opciones: Array<{ id: T; label: string }>
  ancho?: number | string
}) {
  return (
    <select
      value={valor}
      onChange={e => onChange(e.target.value as T)}
      style={{
        width: ancho, padding: '8px 13px', borderRadius: 999,
        border: `1px solid ${C.line}`, background: C.card, color: C.gris,
        fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 800,
        cursor: 'pointer', outline: 'none',
      }}
    >
      {opciones.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  )
}

/* ── Filtros rápidos en pastilla ── */
export function Chips<T extends string>({ opciones, activo, onChange }: {
  opciones: Array<{ id: T; label: string; tone?: Tone; count?: number }>
  activo: T | null
  onChange: (id: T | null) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {opciones.map(o => {
        const on = o.id === activo
        return (
          <button
            key={o.id}
            onClick={() => onChange(on ? null : o.id)}
            style={{
              padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${on ? 'transparent' : C.line}`,
              background: on ? C.ink : C.card,
              color: on ? C.card : C.grisCl,
              fontFamily: "'Nunito', sans-serif", fontSize: 11.5, fontWeight: 800,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {o.label}
            {o.count != null && <span className="slnum" style={{ fontSize: 10.5, opacity: 0.85 }}>{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════════════
   Tabla densa
   ══════════════════════════════════════════════ */
export function Tabla({ cabeceras, children }: {
  cabeceras: Array<{ label: string; alinea?: 'izq' | 'der'; ancho?: number | string }>
  children: ReactNode
}) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.line}`, borderRadius: 16,
      boxShadow: C.shadow, overflow: 'hidden',
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Nunito', sans-serif" }}>
          <thead>
            <tr>
              {cabeceras.map((h, i) => (
                <th key={i} style={{
                  padding: '11px 13px', textAlign: h.alinea === 'der' ? 'right' : 'left',
                  fontSize: 10.5, fontWeight: 900, letterSpacing: '0.7px', textTransform: 'uppercase',
                  color: C.grisCl, background: C.track, whiteSpace: 'nowrap',
                  width: h.ancho, borderBottom: `1px solid ${C.line}`,
                }}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
}

/** Fila con banda lateral de estado. La banda es el semáforo, no decoración. */
export function Fila({ tono, children, onClick }: { tono?: Tone; children: ReactNode; onClick?: () => void }) {
  const color = tono
    ? ({ verde: C.verde, rojo: C.rojoSem, ambar: C.ambar, blu: C.blu, neutro: C.line }[tono])
    : 'transparent'
  return (
    <tr
      onClick={onClick}
      style={{
        borderBottom: `1px solid ${C.line}`,
        borderLeft: `4px solid ${color}`,
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      {children}
    </tr>
  )
}

export function Celda({ children, der, mono, fuerte, style }: {
  children: ReactNode
  der?: boolean
  mono?: boolean
  fuerte?: boolean
  style?: CSSProperties
}) {
  return (
    <td style={{
      padding: '11px 13px', textAlign: der ? 'right' : 'left',
      fontSize: 12.5, fontWeight: fuerte ? 900 : 700, color: C.ink,
      verticalAlign: 'middle', ...style,
    }}>
      {mono ? <span className="slnum">{children}</span> : children}
    </td>
  )
}

/* ── Ventana modal ── */
export function Modal({ titulo, sub, onClose, children, pie, ancho = 640 }: {
  titulo: string
  sub?: string
  onClose: () => void
  children: ReactNode
  pie?: ReactNode
  ancho?: number
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,17,22,0.45)',
        display: 'grid', placeItems: 'center', zIndex: 300, padding: 20,
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.card, borderRadius: 20, width: '100%', maxWidth: ancho,
          maxHeight: '86vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,0.28)', overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${C.line}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 15.5, fontWeight: 900, letterSpacing: '-0.25px', color: C.ink }}>{titulo}</div>
            {sub && <div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800, marginTop: 2 }}>{sub}</div>}
          </div>
          <button
            onClick={onClose}
            style={{
              background: C.track, border: 'none', borderRadius: 999, width: 30, height: 30,
              color: C.gris, fontSize: 16, cursor: 'pointer', lineHeight: 1, flexShrink: 0,
            }}
          >×</button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>{children}</div>
        {pie && (
          <div style={{
            padding: '13px 20px', borderTop: `1px solid ${C.line}`, background: C.track,
            display: 'flex', justifyContent: 'flex-end', gap: 8,
          }}>{pie}</div>
        )}
      </div>
    </div>
  )
}

/* ── Esqueleto de carga ── */
export function Skeleton({ alto = 14, ancho = '100%', radio = 8 }: { alto?: number; ancho?: number | string; radio?: number }) {
  return (
    <div style={{
      height: alto, width: ancho, borderRadius: radio, background: C.track,
      animation: 'slpulse 1.2s ease-in-out infinite',
    }} />
  )
}

export function SkeletonTabla({ filas = 6 }: { filas?: number }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, boxShadow: C.shadow }}>
      <style>{`@keyframes slpulse { 0%,100% { opacity: 1 } 50% { opacity: 0.45 } }`}</style>
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 11 }}>
          <Skeleton ancho="18%" />
          <Skeleton ancho="42%" />
          <Skeleton ancho="20%" />
          <Skeleton ancho="20%" />
        </div>
      ))}
    </div>
  )
}

/* ── Zona de subida de documentos ── */
export function Dropzone({ onArchivos, texto = 'Arrastra aquí las facturas o haz clic para elegirlas' }: {
  onArchivos?: (f: FileList) => void
  texto?: string
}) {
  return (
    <label style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 8, padding: '30px 20px', borderRadius: 16, cursor: 'pointer',
      border: `2px dashed ${C.line}`, background: C.track, marginBottom: 14,
    }}>
      <span style={{ fontSize: 22 }}>📄</span>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: C.gris, textAlign: 'center' }}>{texto}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: C.grisCl }}>PDF, imagen, Word o Excel</span>
      <input
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files && onArchivos) onArchivos(e.target.files) }}
      />
    </label>
  )
}

/* ── Cabecera de pantalla ── */
export function PageHead({ titulo, sub, right }: { titulo: string; sub?: string; right?: ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 16, flexWrap: 'wrap', gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px', color: C.ink }}>{titulo}</div>
        {sub && <div style={{ fontSize: 12, color: C.grisCl, fontWeight: 700, marginTop: 2 }}>{sub}</div>}
      </div>
      {right && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{right}</div>}
    </div>
  )
}

/* ── Etiqueta de estado reutilizable (envuelve Pill para uso en tablas) ── */
export function Estado({ tono, children }: { tono: Tone; children: ReactNode }) {
  return <Pill tone={tono} dot>{children}</Pill>
}
