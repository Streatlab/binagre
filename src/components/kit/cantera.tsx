/**
 * kit/cantera.tsx — piezas canónicas CANTERA ALEGRE v1.0 para el CUERPO de las
 * pantallas. Se REUTILIZAN, no se reescriben por pantalla. Anatomía extraída de la
 * referencia validada `panel/resumen/ResumenLanding.tsx`.
 *
 * Reglas de superficie:
 *  · Papel  = bloque blanco, borde 3px tinta, ceja superior 7px del color de familia,
 *             radio 0, SIN sombra. Para contenido informativo.
 *  · Plancha = tarjetas sólidas PEGADAS separadas por borde 3px (KPIs comparables).
 *  · Sombra dura 3px 3px 0 tinta SOLO en lo pulsable y en el resumen/neto del héroe.
 */
import type { ReactNode, CSSProperties } from 'react'
import { INK, CREMA, BLANCO, AMA, VERDE, ROSA, AZUL, NAR, GRANATE, ROJO, GRIS, OSW, LEX } from '@/styles/neobrutal'

export const SHADOW_DURA = `3px 3px 0 ${INK}`
export const MAXW = 1360

/**
 * Verde salvia del área Equipo en el MARCO DE DOCUMENTOS (#5C8A6E). Solo para las
 * superficies que representan papel imprimible; NUNCA como color de pantalla del ERP
 * (fuera de los 12 tokens de LEY-ESTILO-01).
 */
export const VERDE_EQUIPO = '#5C8A6E'

/** Color de héroe por área (la ley). */
export type AreaCantera = 'resumen' | 'cashflow' | 'tesoreria' | 'ventas' | 'facturacion' | 'papeleo' | 'cocina' | 'ops' | 'marcas' | 'marketing' | 'equipo' | 'objetivos' | 'eeff'
const AREA_BG: Record<AreaCantera, string> = {
  resumen: AMA, objetivos: AMA, eeff: AMA,
  cashflow: AZUL, tesoreria: AZUL,
  ventas: VERDE, facturacion: VERDE,
  papeleo: GRANATE,
  cocina: NAR, ops: NAR,
  marcas: ROSA, marketing: ROSA,
  equipo: INK,
}
/** Sobre amarillo, tinta; sobre el resto de vivos, blanco/crema. */
export function textoSobre(bg: string): string {
  return bg === AMA ? INK : (bg === INK ? CREMA : BLANCO)
}

/** Pastilla / eyebrow canónica. */
export function Pill({ children, bg = BLANCO, color, fontSize = 13 }: { children: ReactNode; bg?: string; color?: string; fontSize?: number }) {
  return (
    <span style={{ display: 'inline-block', background: bg, color: color ?? (bg === AMA ? INK : bg === BLANCO || bg === CREMA ? INK : BLANCO), border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 600, fontSize, letterSpacing: '2px', textTransform: 'uppercase', padding: '4px 12px' }}>{children}</span>
  )
}

/** Bloque de papel con ceja de color de familia (sin sombra). */
export function Papel({ ceja, children, pad, style }: { ceja: string; children: ReactNode; pad?: string; style?: CSSProperties }) {
  return <div style={{ background: BLANCO, border: `3px solid ${INK}`, borderTop: `7px solid ${ceja}`, borderRadius: 0, padding: pad ?? '20px 22px', ...style }}>{children}</div>
}

/** Plancha: contenedor de celdas sólidas pegadas (separadas por borde 3px). */
export function Plancha({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', border: `3px solid ${INK}`, borderRadius: 0, overflow: 'hidden', ...style }}>{children}</div>
}
export function PlanchaCelda({ children, bg = BLANCO, color, first, style }: { children: ReactNode; bg?: string; color?: string; first?: boolean; style?: CSSProperties }) {
  return <div style={{ flex: '1 1 190px', minWidth: 170, background: bg, color: color ?? (bg === AMA ? INK : bg === BLANCO ? INK : BLANCO), padding: '16px 20px', borderLeft: first ? 'none' : `3px solid ${INK}`, ...style }}>{children}</div>
}

/** Chip de variación: triángulo + signo + color juntos. */
export function ChipVariacion({ pct }: { pct: number | null }) {
  if (pct == null || !isFinite(pct)) return null
  const pos = pct >= 0
  const s = Math.abs(pct).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
  return <span style={{ background: pos ? VERDE : GRANATE, color: BLANCO, border: `2px solid ${INK}`, padding: '3px 9px', fontFamily: OSW, fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>{pos ? '▲ +' : '▼ −'}{s} %</span>
}

/**
 * HeroCantera — héroe del área. Todo lo recibe ya formateado (no calcula nada):
 * el titular es una frase natural (no un dato suelto), la cifra ya trae € donde aplica.
 * La tira de atención va blanca y pegada debajo (máx 4 chips).
 */
export function HeroCantera({
  area, claim = 'COMER BIEN. AQUÍ Y AHORA.', periodo, pills, titular,
  etiquetaDato, cifra, variacionPct, resumen, atencion,
}: {
  area: AreaCantera
  claim?: string
  periodo?: string
  pills?: ReactNode
  titular: ReactNode
  etiquetaDato?: string
  cifra?: ReactNode
  variacionPct?: number | null
  resumen?: ReactNode
  atencion?: ReactNode[]
}) {
  const bg = AREA_BG[area]
  const fg = textoSobre(bg)
  const chips = (atencion ?? []).filter(Boolean).slice(0, 4)
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ background: bg, color: fg, border: `3px solid ${INK}`, borderRadius: 0, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Pill bg={BLANCO}>{claim}</Pill>
          {periodo && <Pill bg={INK} color={CREMA} fontSize={12}>{periodo}</Pill>}
          {pills}
        </div>
        <div style={{ fontFamily: OSW, fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 700, lineHeight: 1.12, marginTop: 12, textTransform: 'uppercase' }}>{titular}</div>
        {etiquetaDato && <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '0.12em', marginTop: 12, textTransform: 'uppercase' }}>{etiquetaDato}</div>}
        {(cifra != null || variacionPct != null) && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 6, background: BLANCO, color: INK, border: `3px solid ${INK}`, boxShadow: SHADOW_DURA, padding: '8px 14px' }}>
            {cifra != null && <span style={{ fontFamily: OSW, fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 700, lineHeight: 1 }}>{cifra}</span>}
            {variacionPct != null && <ChipVariacion pct={variacionPct} />}
          </div>
        )}
        {resumen && <div style={{ fontFamily: LEX, fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>{resumen}</div>}
      </div>
      {chips.length > 0 && (
        <div style={{ background: BLANCO, color: INK, border: `3px solid ${INK}`, borderTop: 'none', borderRadius: 0, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: NAR, fontWeight: 700 }}>Atención →</span>
          {chips.map((c, i) => (
            <span key={i} style={{ fontFamily: LEX, fontSize: 12.5, border: `2px solid ${INK}`, padding: '3px 9px', background: CREMA }}>{c}</span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Frase potente: 1 por pantalla, color por SIGNIFICADO (distinta del héroe). */
export type Significado = 'peligro' | 'coste' | 'oportunidad' | 'logro'
const SIG_COLOR: Record<Significado, string> = { peligro: ROJO, coste: GRANATE, oportunidad: ROSA, logro: VERDE }
export function FrasePotente({ significado, children }: { significado: Significado; children: ReactNode }) {
  const col = SIG_COLOR[significado]
  return (
    <Papel ceja={col} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <span style={{ width: 10, alignSelf: 'stretch', background: col, flexShrink: 0 }} />
      <div style={{ fontFamily: OSW, fontSize: 'clamp(16px, 2.1vw, 20px)', fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: col, lineHeight: 1.25 }}>{children}</div>
    </Papel>
  )
}

/** Contenedor de pantalla: columna con aire 16px, ancho máx 1360, fondo crema. */
export function PantallaCantera({ children, embedded, style }: { children: ReactNode; embedded?: boolean; style?: CSSProperties }) {
  return (
    <div style={{ fontFamily: LEX, color: INK, background: embedded ? 'transparent' : CREMA, minHeight: embedded ? 'auto' : '100vh', padding: embedded ? 0 : '24px 28px', ...style }}>
      <div style={{ maxWidth: MAXW, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
    </div>
  )
}

/** Etiqueta de sección (eyebrow suelta sobre un bloque). */
export function SeccionLabel({ children, bg = NAR, color }: { children: ReactNode; bg?: string; color?: string }) {
  return <div style={{ marginBottom: 10 }}><Pill bg={bg} color={color}>{children}</Pill></div>
}

export { INK as _INK }
