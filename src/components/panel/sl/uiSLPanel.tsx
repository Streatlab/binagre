/**
 * uiSLPanel — piezas del cuadro de mando (Ley Visual SL v2 + acento oliva).
 *
 * Todo lo que el panel necesita y el kit no tenía: palancas de unidad,
 * barra doble bruto/neto, curva del día contra el mismo día de la semana
 * pasada, reparto del euro y franja de frentes abiertos.
 *
 * Regla: ninguna pantalla maqueta esto a mano.
 */
import type { ReactNode } from 'react'
import { C } from './uiSL'
import { OLIVA } from './uiSLFoco'

/* ── Palanca: grupo de botones excluyentes ── */
export function Palanca<T extends string>({ opciones, valor, onChange, compacta }: {
  opciones: Array<{ id: T; label: string }>
  valor: T
  onChange: (v: T) => void
  compacta?: boolean
}) {
  return (
    <div style={{
      display: 'inline-flex', border: `1px solid ${C.line}`, borderRadius: 999,
      overflow: 'hidden', background: C.card,
    }}>
      {opciones.map(o => {
        const on = o.id === valor
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              border: 'none', cursor: 'pointer',
              padding: compacta ? '6px 11px' : '7px 14px',
              fontFamily: "'Nunito', sans-serif",
              fontSize: compacta ? 11 : 11.5,
              fontWeight: 900,
              background: on ? OLIVA.hondo : 'transparent',
              color: on ? '#fff' : C.grisCl,
              minHeight: 34,
            }}
          >{o.label}</button>
        )
      })}
    </div>
  )
}

/* ── Franja de frentes abiertos: lo roto, arriba del todo ── */
export function Frentes({ items }: { items: Array<{ texto: string; onClick?: () => void }> }) {
  if (items.length === 0) return null
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      background: C.rojo, color: '#fff', borderRadius: 14,
      padding: '10px 14px', marginBottom: 12,
    }}>
      <span style={{
        fontSize: 10.5, fontWeight: 900, letterSpacing: '1px',
        background: 'rgba(255,255,255,0.2)', padding: '3px 9px', borderRadius: 999,
      }}>
        {items.length} {items.length === 1 ? 'FRENTE ABIERTO' : 'FRENTES ABIERTOS'}
      </span>
      {items.map((f, i) => (
        <button
          key={i}
          onClick={f.onClick}
          style={{
            background: 'transparent', border: 'none', color: '#fff',
            fontFamily: "'Nunito', sans-serif", fontSize: 12.5, fontWeight: 800,
            cursor: f.onClick ? 'pointer' : 'default',
            textDecoration: f.onClick ? 'underline' : 'none',
            textUnderlineOffset: 3, padding: 0,
          }}
        >{f.texto}</button>
      ))}
    </div>
  )
}

/* ── Estado del robot de ingesta ── */
export function PulsoRobot({ vivo, hace }: { vivo: boolean; hace: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: vivo ? OLIVA.soft : C.track,
      color: vivo ? OLIVA.hondo : C.grisCl,
      fontSize: 10.5, fontWeight: 900, padding: '5px 10px', borderRadius: 999,
      letterSpacing: '0.4px',
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: vivo ? OLIVA.medio : C.grisCl, display: 'inline-block',
      }} />
      {vivo ? `ROBOT EN DIRECTO · ${hace}` : 'ROBOT PARADO'}
    </span>
  )
}

/* ── Reparto del euro: en qué se va lo que facturas ── */
export function Reparto({ tramos, total }: {
  tramos: Array<{ label: string; importe: number; color: string }>
  total: number
}) {
  const suma = Math.max(1, total)
  const fmt = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  return (
    <>
      <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
        {tramos.map((t, i) => (
          <div key={t.label} style={{
            width: `${(t.importe / suma) * 100}%`, background: t.color,
            borderRight: i < tramos.length - 1 ? `2px solid ${C.card}` : 'none',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tramos.map(t => (
          <div key={t.label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 11.5, fontWeight: 800,
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: t.color, display: 'inline-block' }} />
              {t.label}
            </span>
            <span className="slnum" style={{ color: C.ink }}>{fmt(t.importe)}</span>
          </div>
        ))}
      </div>
    </>
  )
}

/* ── Barra doble: bruto (claro) y lo que te queda (sólido) ── */
export function BarraDoble({ label, bruto, neto, maximo, color, pie }: {
  label: string
  bruto: number
  neto: number
  maximo: number
  color: string
  pie: ReactNode
}) {
  const m = Math.max(1, maximo)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 800 }}>
        <span>{label}</span>
        <span className="slnum">{pie}</span>
      </div>
      <div style={{
        height: 10, background: C.track, borderRadius: 6, marginTop: 4,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ width: `${(bruto / m) * 100}%`, height: 10, background: color, opacity: 0.32, borderRadius: 6 }} />
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: `${(neto / m) * 100}%`, height: 10, background: color, borderRadius: 6,
        }} />
      </div>
    </div>
  )
}

/* ── Curva del día: hoy contra el mismo día de la semana pasada ── */
export function CurvaDia({ horas, hoy, pasado }: {
  horas: number[]
  hoy: number[]
  pasado: number[]
}) {
  const max = Math.max(...hoy, ...pasado, 1)
  const W = 340, H = 110, base = 92
  const paso = W / Math.max(1, horas.length)
  const acum: number[] = []
  hoy.reduce((s, v) => { const n = s + v; acum.push(n); return n }, 0)
  const maxAcum = Math.max(...acum, 1)
  const linea = acum.map((v, i) => `${(i * paso + paso / 2).toFixed(1)},${(base - (v / maxAcum) * 80).toFixed(1)}`).join(' ')

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Venta por hora comparada con el mismo día de la semana pasada">
      {horas.map((h, i) => {
        const x = i * paso
        const hP = (pasado[i] / max) * 78
        const hH = (hoy[i] / max) * 78
        const w = Math.max(4, paso * 0.28)
        return (
          <g key={h}>
            <rect x={x + paso * 0.12} y={base - hP} width={w} height={Math.max(0, hP)} rx={3} fill="#D3D1C7" />
            <rect x={x + paso * 0.48} y={base - hH} width={w} height={Math.max(0, hH)} rx={3} fill={hoy[i] >= pasado[i] ? C.naranja : C.amarillo} />
          </g>
        )
      })}
      <polyline points={linea} fill="none" stroke={OLIVA.medio} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {horas.map((h, i) => (
        i % 3 === 0 ? (
          <text key={`t${h}`} x={i * paso + paso / 2} y={H - 4} textAnchor="middle" fontFamily="Nunito" fontSize="8" fontWeight="800" fill={C.grisCl}>
            {h}h
          </text>
        ) : null
      ))}
    </svg>
  )
}

/* ── Minigráfico de línea para las tarjetas ── */
export function Mini({ puntos, color }: { puntos: number[]; color: string }) {
  if (puntos.length < 2) return null
  const max = Math.max(...puntos), min = Math.min(...puntos)
  const r = (max - min) || 1
  const pts = puntos.map((v, i) => `${(i * (58 / (puntos.length - 1))).toFixed(1)},${(20 - ((v - min) / r) * 18).toFixed(1)}`).join(' ')
  return (
    <svg width={60} height={22} viewBox="0 0 60 22" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ── Tarjeta densa: valor + dos comparativas + minigráfico + pie ── */
export function Tarjeta({ label, valor, d1, d2, sube, pie, spark }: {
  label: string
  valor: string
  d1: string
  d2: string
  sube: boolean
  pie: string
  spark: number[]
}) {
  const col = sube ? OLIVA.hondo : C.rojoSem
  const bg = sube ? OLIVA.soft : C.rojoSoft
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.line}`, borderRadius: 16,
      padding: '12px 13px', boxShadow: C.shadow,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.7px', color: C.grisCl }}>
          {label.toUpperCase()}
        </div>
        <Mini puntos={spark} color={sube ? OLIVA.medio : C.rojoSem} />
      </div>
      <div className="slnum" style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.9px', margin: '1px 0 5px' }}>
        {valor}
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 5 }}>
        <span style={{ background: bg, color: col, fontSize: 10, fontWeight: 900, padding: '2px 7px', borderRadius: 999 }}>
          {d1} sem.
        </span>
        <span style={{ border: `1px solid ${C.line}`, color: C.grisCl, fontSize: 10, fontWeight: 900, padding: '2px 7px', borderRadius: 999 }}>
          {d2} mes
        </span>
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.grisCl }}>{pie}</div>
    </div>
  )
}
