import { Fragment, useMemo, useState, type CSSProperties } from 'react'
import { COLORS, FONT, CARDS } from '@/components/panel/resumen/tokens'
import { fmtFechaCorta } from '@/styles/tokens'
import type { TipoDia } from '@/contexts/CalendarioContext'

// =========================================================================
// COMPONENTES MOBILE PARA FACTURACIÓN
// Cards verticales con TODO el detalle visible (no se oculta nada vs tabla)
// 0 datos perdidos, 0 datos inventados, conectado a las mismas fuentes
// =========================================================================

const fmt2 = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })
const fmtInt = (n: number) => Math.round(n).toLocaleString('es-ES', { useGrouping: true })

// ── Lenguaje NEOBRUTAL (idéntico a Facturacion.tsx desktop) ──
const NEO_INK = 'var(--neo-ink)'
const NEO_SHADOW = '4px 4px 0 var(--neo-shadow-color)'
const NEO_CARD: CSSProperties = { border: `3px solid ${NEO_INK}`, borderRadius: 0, boxShadow: NEO_SHADOW }

export interface AggRow {
  uber_pedidos: number; uber_bruto: number
  glovo_pedidos: number; glovo_bruto: number
  je_pedidos: number; je_bruto: number
  web_pedidos: number; web_bruto: number
  directa_pedidos: number; directa_bruto: number
  total_pedidos: number; total_bruto: number
}
export interface RawDiario extends AggRow { id: number; fecha: string; servicio: string }
export interface SemanaGroup extends AggRow { year: number; week: number; periodo: string; dias: number }
export interface MesGroup extends AggRow { anio: number; mes: number; dias: number; media_diaria: number; vs_anterior: number | null }

export type CanalId = 'uber' | 'glovo' | 'je' | 'web' | 'dir'
export interface CanalCol { id: CanalId; label: string; ped: keyof AggRow; bru: keyof AggRow; color: string; bg: string }

// ----- KPIs hero mobile (siempre arriba, todo visible) -----
interface KpiHeroMobileProps {
  totals: AggRow
  dias: number
  tm: number
  tmNeto: number
  netoEstimado: number
  mediadiaria: number
  mediaDiariaNeta: number
  onAdd: () => void
  onExport?: () => void
}
export function KpiHeroMobile({ totals, dias, tm, tmNeto, netoEstimado, mediadiaria, mediaDiariaNeta, onAdd, onExport }: KpiHeroMobileProps) {
  const pctNeto = totals.total_bruto > 0 ? Math.round((netoEstimado / totals.total_bruto) * 100) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
      {/* HERO: Bruto + Neto */}
      <div style={{ ...CARDS.big, ...NEO_CARD, padding: '16px 16px 14px' }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: COLORS.mut, marginBottom: 6 }}>
          FACTURACIÓN BRUTA · NETA
        </div>
        <div style={{ fontFamily: FONT.heading, fontSize: 'clamp(26px, 9vw, 34px)', fontWeight: 700, color: COLORS.pri, lineHeight: 1, letterSpacing: '-0.5px' }}>
          {fmt2(totals.total_bruto)}
        </div>
        <div style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLORS.mut, marginTop: 3 }}>
          BRUTO
        </div>
        <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 700, color: COLORS.ok, lineHeight: 1, marginTop: 10, letterSpacing: '-0.3px' }}>
          {fmt2(netoEstimado)}
        </div>
        <div style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLORS.ok, marginTop: 3 }}>
          NETO EST. · {pctNeto}%
        </div>
      </div>

      {/* GRID 2x: Pedidos+TM | Media/día */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ ...CARDS.big, ...NEO_CARD, padding: '12px 12px 10px' }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLORS.mut, marginBottom: 4 }}>
            PEDIDOS · TM
          </div>
          <div style={{ fontFamily: FONT.heading, fontSize: 'clamp(20px, 6vw, 24px)', fontWeight: 700, color: COLORS.lun, lineHeight: 1 }}>
            {fmtInt(totals.total_pedidos)}
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, marginTop: 6 }}>
            TM <span style={{ color: COLORS.warn, fontWeight: 600 }}>{fmt2(tm)}</span> bru · <span style={{ color: COLORS.ok, fontWeight: 600 }}>{fmt2(tmNeto)}</span> net
          </div>
        </div>
        <div style={{ ...CARDS.big, ...NEO_CARD, padding: '12px 12px 10px' }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLORS.mut, marginBottom: 4 }}>
            MEDIA/DÍA · {dias} D
          </div>
          <div style={{ fontFamily: FONT.heading, fontSize: 'clamp(20px, 6vw, 24px)', fontWeight: 700, color: COLORS.pri, lineHeight: 1 }}>
            {fmt2(mediadiaria)}
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, marginTop: 6 }}>
            Neto <span style={{ color: COLORS.ok, fontWeight: 600 }}>{fmt2(mediaDiariaNeta)}</span>
          </div>
        </div>
      </div>

      {/* Botones acción */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onAdd}
          style={{ flex: 2, minHeight: 44, padding: '12px 14px', ...NEO_CARD, background: COLORS.redSL, color: '#fff',
            fontFamily: FONT.heading, fontSize: 12, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>+</span> Añadir día
        </button>
        {onExport && (
          <button onClick={onExport}
            style={{ flex: 1, minHeight: 44, padding: '12px 14px', ...NEO_CARD, background: COLORS.card, color: COLORS.mut,
              fontFamily: FONT.heading, fontSize: 12, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <span>↓</span> CSV
          </button>
        )}
      </div>
    </div>
  )
}

// ----- Día card mobile (DIARIO) -----
interface DayCardProps {
  row: RawDiario
  cols: CanalCol[]
  tipoDia: TipoDia
  isSubtotal?: boolean
  subtotalAgg?: AggRow
  onClick: () => void
}
export function DayCardMobile({ row, cols, tipoDia, isSubtotal, subtotalAgg, onClick }: DayCardProps) {
  const esCerrado = tipoDia === 'cerrado' || tipoDia === 'festivo' || tipoDia === 'vacaciones'
  const data = isSubtotal && subtotalAgg ? subtotalAgg : row
  const totalBruto = data.total_bruto
  const maxCanal = Math.max(...cols.map(c => (data[c.bru] as number) || 0), 1)

  const today = new Date().toISOString().slice(0, 10) === row.fecha

  return (
    <div onClick={onClick}
      style={{
        ...CARDS.std,
        ...NEO_CARD,
        padding: 0,
        overflow: 'hidden',
        opacity: esCerrado ? 0.55 : 1,
        cursor: 'pointer',
        border: today ? `3px solid ${COLORS.redSL}` : `3px solid ${NEO_INK}`,
      }}>
      {/* Header */}
      <div style={{
        padding: '11px 14px 9px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        borderBottom: `0.5px solid ${COLORS.brd}`,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 65 }}>
          <span style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: today ? COLORS.redSL : COLORS.pri }}>
            {new Date(row.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '').toUpperCase()}
          </span>
          <span style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut }}>
            {fmtFechaCorta(row.fecha)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {today && <Badge color="#fff" bg={COLORS.redSL} solid label="HOY" />}
          {isSubtotal ? <Badge color={COLORS.lun} bg={`${COLORS.lun}18`} label="TODOS" /> : <ServicioBadgeMobile s={row.servicio} />}
          {esCerrado && <Badge color="#fff" bg={COLORS.redSL} solid label="CERRADO" />}
          {tipoDia === 'solo_comida' && <Badge color="#111" bg={COLORS.glovo} solid label="ALM" />}
          {tipoDia === 'solo_cena' && <Badge color="#fff" bg={COLORS.je} solid label="CENA" />}
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 17, fontWeight: 700, color: COLORS.pri, lineHeight: 1 }}>
            {fmt2(totalBruto)}
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 10, color: COLORS.mut, marginTop: 2 }}>
            {fmtInt(data.total_pedidos)} ped.
          </div>
        </div>
      </div>

      {/* Canales con barras horizontales */}
      <div style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {cols.map(c => {
          const ped = (data[c.ped] as number) || 0
          const bru = (data[c.bru] as number) || 0
          const widthPct = maxCanal > 0 ? Math.max(2, (bru / maxCanal) * 100) : 0
          const empty = ped === 0 && bru === 0
          return (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '14px 60px 1fr 90px', gap: 8, alignItems: 'center', opacity: empty ? 0.4 : 1 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, marginLeft: 3 }} />
              <span style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, fontWeight: 500 }}>
                {c.label}
              </span>
              <div style={{ height: 5, background: `${COLORS.brd}80`, borderRadius: 3, overflow: 'hidden' }}>
                {bru > 0 && <div style={{ height: '100%', width: `${widthPct}%`, background: c.color, borderRadius: 3 }} />}
              </div>
              <span style={{ fontFamily: FONT.heading, fontSize: 12, fontWeight: 600, color: empty ? COLORS.mut : COLORS.sec, textAlign: 'right', letterSpacing: '-0.2px' }}>
                {empty ? '—' : (
                  <Fragment>
                    {fmt2(bru)}<span style={{ fontSize: 9, color: COLORS.mut, fontWeight: 400, marginLeft: 4 }}>· {fmtInt(ped)}</span>
                  </Fragment>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ----- Semana card mobile -----
interface SemanaCardProps {
  row: SemanaGroup
  cols: CanalCol[]
  onClick: () => void
}
export function SemanaCardMobile({ row, cols, onClick }: SemanaCardProps) {
  const maxCanal = Math.max(...cols.map(c => (row[c.bru] as number) || 0), 1)
  return (
    <div onClick={onClick} style={{ ...CARDS.std, ...NEO_CARD, padding: 0, overflow: 'hidden', cursor: 'pointer' }}>
      <div style={{ padding: '11px 14px 9px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottom: `0.5px solid ${COLORS.brd}` }}>
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 700, color: COLORS.redSL, letterSpacing: '1px' }}>
            S{row.week}
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, marginTop: 2 }}>
            {row.periodo} · {row.dias} días
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 17, fontWeight: 700, color: COLORS.pri, lineHeight: 1 }}>
            {fmt2(row.total_bruto)}
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 10, color: COLORS.mut, marginTop: 2 }}>
            {fmtInt(row.total_pedidos)} ped.
          </div>
        </div>
      </div>
      <div style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {cols.map(c => {
          const ped = (row[c.ped] as number) || 0
          const bru = (row[c.bru] as number) || 0
          const widthPct = maxCanal > 0 ? Math.max(2, (bru / maxCanal) * 100) : 0
          const empty = bru === 0 && ped === 0
          return (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '14px 60px 1fr 90px', gap: 8, alignItems: 'center', opacity: empty ? 0.4 : 1 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, marginLeft: 3 }} />
              <span style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, fontWeight: 500 }}>{c.label}</span>
              <div style={{ height: 5, background: `${COLORS.brd}80`, borderRadius: 3, overflow: 'hidden' }}>
                {bru > 0 && <div style={{ height: '100%', width: `${widthPct}%`, background: c.color, borderRadius: 3 }} />}
              </div>
              <span style={{ fontFamily: FONT.heading, fontSize: 12, fontWeight: 600, color: empty ? COLORS.mut : COLORS.sec, textAlign: 'right' }}>
                {empty ? '—' : (
                  <Fragment>
                    {fmt2(bru)}<span style={{ fontSize: 9, color: COLORS.mut, fontWeight: 400, marginLeft: 4 }}>· {fmtInt(ped)}</span>
                  </Fragment>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ----- Mes card mobile -----
interface MesCardProps {
  row: MesGroup
  cols: CanalCol[]
}
const MES_NOMBRE: Record<number, string> = { 1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto', 9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre' }
export function MesCardMobile({ row, cols }: MesCardProps) {
  const maxCanal = Math.max(...cols.map(c => (row[c.bru] as number) || 0), 1)
  return (
    <div style={{ ...CARDS.std, ...NEO_CARD, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '11px 14px 9px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottom: `0.5px solid ${COLORS.brd}` }}>
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 700, color: COLORS.pri, letterSpacing: '0.5px' }}>
            {MES_NOMBRE[row.mes]}
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, marginTop: 2 }}>
            {row.dias} días · Media/día {fmt2(row.media_diaria)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 17, fontWeight: 700, color: COLORS.pri, lineHeight: 1 }}>
            {fmt2(row.total_bruto)}
          </div>
          <div style={{ marginTop: 4 }}>
            {row.vs_anterior !== null
              ? <DesvBadgeMobile pct={row.vs_anterior} />
              : <span style={{ fontFamily: FONT.body, fontSize: 10, color: COLORS.mut }}>—</span>}
          </div>
        </div>
      </div>
      <div style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {cols.map(c => {
          const ped = (row[c.ped] as number) || 0
          const bru = (row[c.bru] as number) || 0
          const widthPct = maxCanal > 0 ? Math.max(2, (bru / maxCanal) * 100) : 0
          const empty = bru === 0 && ped === 0
          return (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '14px 60px 1fr 90px', gap: 8, alignItems: 'center', opacity: empty ? 0.4 : 1 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, marginLeft: 3 }} />
              <span style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, fontWeight: 500 }}>{c.label}</span>
              <div style={{ height: 5, background: `${COLORS.brd}80`, borderRadius: 3, overflow: 'hidden' }}>
                {bru > 0 && <div style={{ height: '100%', width: `${widthPct}%`, background: c.color, borderRadius: 3 }} />}
              </div>
              <span style={{ fontFamily: FONT.heading, fontSize: 12, fontWeight: 600, color: empty ? COLORS.mut : COLORS.sec, textAlign: 'right' }}>
                {empty ? '—' : (
                  <Fragment>
                    {fmt2(bru)}<span style={{ fontSize: 9, color: COLORS.mut, fontWeight: 400, marginLeft: 4 }}>· {fmtInt(ped)}</span>
                  </Fragment>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ----- Año card mobile -----
interface AnioRow { anio: number; bruto: number; pedidos: number; mediaMensual: number; mediaTicket: number }
interface AnioCardProps {
  row: AnioRow
  delta: number | null
  maxBruto: number
}
export function AnioCardMobile({ row, delta, maxBruto }: AnioCardProps) {
  const widthPct = maxBruto > 0 ? Math.round((row.bruto / maxBruto) * 100) : 0
  return (
    <div style={{ ...CARDS.std, ...NEO_CARD, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 700, color: COLORS.redSL, letterSpacing: '1px' }}>
          {row.anio}
        </div>
        <div style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 700, color: COLORS.pri, lineHeight: 1 }}>
          {fmt2(row.bruto)}
        </div>
      </div>
      <div style={{ height: 5, background: `${COLORS.brd}80`, borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ height: '100%', width: `${widthPct}%`, background: COLORS.redSL, borderRadius: 3 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1.2px', textTransform: 'uppercase', color: COLORS.mut, marginBottom: 2 }}>
            vs Anterior
          </div>
          {delta !== null ? <DesvBadgeMobile pct={delta} /> : <span style={{ fontSize: 11, color: COLORS.mut }}>—</span>}
        </div>
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1.2px', textTransform: 'uppercase', color: COLORS.mut, marginBottom: 2 }}>
            Media mensual
          </div>
          <div style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600, color: COLORS.sec }}>
            {fmt2(row.mediaMensual)}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1.2px', textTransform: 'uppercase', color: COLORS.mut, marginBottom: 2 }}>
            Pedidos
          </div>
          <div style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600, color: COLORS.sec }}>
            {fmtInt(row.pedidos)}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1.2px', textTransform: 'uppercase', color: COLORS.mut, marginBottom: 2 }}>
            Ticket medio
          </div>
          <div style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600, color: COLORS.sec }}>
            {fmt2(row.mediaTicket)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ----- Totals row mobile (siempre al final de la lista) -----
interface TotalsRowMobileProps {
  label: string
  totals: AggRow
  cols: CanalCol[]
}
export function TotalsRowMobile({ label, totals, cols }: TotalsRowMobileProps) {
  return (
    <div style={{
      ...CARDS.std,
      ...NEO_CARD,
      padding: '12px 14px',
      background: `${COLORS.bg}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: COLORS.mut, fontWeight: 600 }}>
          {label}
        </span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 700, color: COLORS.pri, lineHeight: 1 }}>
            {fmt2(totals.total_bruto)}
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 10, color: COLORS.mut, marginTop: 2 }}>
            {fmtInt(totals.total_pedidos)} ped.
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {cols.map(c => {
          const ped = (totals[c.ped] as number) || 0
          const bru = (totals[c.bru] as number) || 0
          if (bru === 0 && ped === 0) return null
          return (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color }} />
                <span style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut }}>{c.label}</span>
              </div>
              <span style={{ fontFamily: FONT.heading, fontSize: 11, fontWeight: 600, color: c.color }}>
                {fmt2(bru)} <span style={{ color: COLORS.mut, fontWeight: 400, fontSize: 10 }}>· {fmtInt(ped)}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ----- Helpers de badges -----
function Badge({ color, bg, label, solid }: { color: string; bg: string; label: string; solid?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 7px', borderRadius: 5,
      background: solid ? bg : bg,
      color: solid ? color : color,
      fontFamily: FONT.heading, fontSize: 9, fontWeight: 600,
      letterSpacing: '0.8px', textTransform: 'uppercase',
    }}>{label}</span>
  )
}

function ServicioBadgeMobile({ s }: { s: string }) {
  const color = s === 'ALM' ? COLORS.warn : s === 'CENAS' ? '#7c3aed' : s === 'TODO' ? COLORS.lun : COLORS.mut
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 7px', borderRadius: 5,
      background: `${color}18`, color,
      fontFamily: FONT.heading, fontSize: 9, fontWeight: 600,
      letterSpacing: '0.8px', textTransform: 'uppercase',
    }}>{s === 'TODO' ? 'TODOS' : s}</span>
  )
}

function DesvBadgeMobile({ pct }: { pct: number }) {
  const pos = pct >= 0
  const color = pos ? COLORS.ok : COLORS.err
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
      background: `${color}18`, color, fontFamily: FONT.body,
    }}>{pos ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%</span>
  )
}

// ----- Empty state mobile -----
export function EmptyStateMobile({ msg }: { msg: string }) {
  return (
    <div style={{ ...CARDS.std, ...NEO_CARD, padding: 32, textAlign: 'center', fontFamily: FONT.body, fontSize: 13, color: COLORS.mut }}>
      {msg}
    </div>
  )
}

// ----- Sort selector mobile -----
export type SortColMobile = 'fecha' | 'total' | 'pedidos'
interface SortSelectorProps {
  sortCol: SortColMobile
  sortDir: 'asc' | 'desc'
  onChange: (col: SortColMobile, dir: 'asc' | 'desc') => void
}
export function SortSelectorMobile({ sortCol, sortDir, onChange }: SortSelectorProps) {
  const [open, setOpen] = useState(false)
  const labels: Record<SortColMobile, string> = { fecha: 'Fecha', total: 'Total €', pedidos: 'Pedidos' }
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          padding: '6px 12px', borderRadius: 0, background: COLORS.card,
          border: `3px solid ${NEO_INK}`, boxShadow: open ? NEO_SHADOW : 'none',
          fontFamily: FONT.heading, fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
          color: COLORS.mut, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
        {labels[sortCol]} {sortDir === 'asc' ? '↑' : '↓'}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', right: 0, background: COLORS.card, ...NEO_CARD, padding: 4, zIndex: 30, minWidth: 130 }}>
          {(['fecha', 'total', 'pedidos'] as SortColMobile[]).map(col => (
            <Fragment key={col}>
              <button onClick={() => { onChange(col, 'desc'); setOpen(false) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: 6, border: 'none', background: 'none', fontFamily: FONT.body, fontSize: 12, color: sortCol === col && sortDir === 'desc' ? COLORS.redSL : COLORS.sec, cursor: 'pointer', fontWeight: sortCol === col && sortDir === 'desc' ? 600 : 400 }}>
                {labels[col]} ↓
              </button>
              <button onClick={() => { onChange(col, 'asc'); setOpen(false) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: 6, border: 'none', background: 'none', fontFamily: FONT.body, fontSize: 12, color: sortCol === col && sortDir === 'asc' ? COLORS.redSL : COLORS.sec, cursor: 'pointer', fontWeight: sortCol === col && sortDir === 'asc' ? 600 : 400 }}>
                {labels[col]} ↑
              </button>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}

// ----- Section title mobile -----
export function SectionTitleMobile({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 0 10px' }}>
      <span style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: COLORS.mut, fontWeight: 500 }}>
        {title}
      </span>
      {right}
    </div>
  )
}

// ----- Year selector mobile -----
interface YearSelectorProps {
  years: number[]
  selected: number
  onChange: (y: number) => void
}
export function YearSelectorMobile({ years, selected, onChange }: YearSelectorProps) {
  if (years.length <= 1) return null
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10, paddingBottom: 4 }}>
      {years.map(y => (
        <button key={y} onClick={() => onChange(y)}
          style={{
            flexShrink: 0, minHeight: 44, padding: '6px 16px', borderRadius: 0,
            border: `3px solid ${NEO_INK}`,
            boxShadow: selected === y ? NEO_SHADOW : 'none',
            background: selected === y ? COLORS.redSL : COLORS.card,
            color: selected === y ? '#fff' : COLORS.mut,
            fontFamily: FONT.heading, fontSize: 11, fontWeight: 700,
            letterSpacing: '1px', cursor: 'pointer',
          }}>
          {y}
        </button>
      ))}
    </div>
  )
}

export type { TipoDia } from '@/contexts/CalendarioContext'
void useMemo
type _CSS = CSSProperties
type __unused = _CSS
