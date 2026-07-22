import { BLANCO, GRIS, INK, ROJO, VERDE } from '@/styles/neobrutal'
import { TABCANALES_BG_LIGHT } from '@/styles/palettes'
import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { invalidarCacheConfigCanales } from '@/lib/panel/calcNetoPlataforma'

/* TabCanales · pantalla canónica única para configurar plataformas
   Fórmulas verificadas con facturas reales:
   - Uber Eats: 33 pedidos individuales analizados al céntimo
   - Glovo: 21 pedidos individuales analizados al céntimo
   - Just Eat: 10 facturas (3 marcas distintas) analizadas al céntimo */

interface Canal {
  id: string
  canal: string
  comision_pct: number | null
  comision_pct_prime: number | null
  fijo_eur: number | null
  fee_prime_eur: number | null
  fee_promo_eur: number | null
  fee_periodo_eur: number | null
  fee_periodicidad: string | null
  pct_pedidos_prime_estim: number | null
  pct_pedidos_promo_estim: number | null
  margen_obj_pct: number | null
  activo: boolean
}

const PERIODICIDADES = [
  { value: 'mensual',              label: 'Mensual' },
  { value: 'semanal_por_marca',    label: 'Semanal × marca' },
  { value: 'quincenal_por_marca',  label: 'Quincenal × marca' },
]

// Cómo cobra cada plataforma · texto corto para que se entienda de un vistazo
const COMO_FUNCIONA: Record<string, string> = {
  'Uber Eats':
    'Comisión 30% sobre (Ventas − Promo partner). Pedidos Uber One pagarán 33% próximamente. ' +
    '0,82€ extra por pedido con promoción. Tarifa publicitaria opcional. + IVA 21%. ' +
    'Factura semanal por marca. Pago lunes siguiente.',
  'Glovo':
    'Comisión 30% sobre (Ventas − Promo partner). 0,74€ extra por cada pedido Prime. ' +
    'Tarifa 10€/quincena por marca. + IVA 21%. ' +
    'Factura quincenal por marca. Pago 5-7 días después.',
  'Just Eat':
    'Comisión 30% sobre (Ventas − GastosUsuario × 1,21). Gastos Usuario = envío que paga ' +
    'el cliente, JE lo descuenta del bruto. Gestión 0,30€/pedido. Top Rank opcional. + IVA 21%. ' +
    'Factura quincenal. Pago 5-7 días después.',
  'Web Propia':
    'Sin comisión. 0,50€/pedido pasarela de pago aprox. (Stripe/Redsys). + IVA 21%. ' +
    'Pago directo al instante.',
  'Venta Directa':
    'Sin comisión ni fees. Cobro directo en tienda/efectivo. 100% del bruto al restaurante.',
}

const CICLOS_PAGO: Record<string, string> = {
  uber:   'Semanal lunes a domingo',
  glovo:  'Quincenal 1-15 / 16-fin',
  just:   'Quincenal 1-15 / 16-fin',
  web:    'Al instante',
  direct: 'Al día',
}
function getCiclo(nombre: string): string {
  const n = (nombre || '').toLowerCase()
  if (n.includes('uber')) return CICLOS_PAGO.uber
  if (n.includes('glovo')) return CICLOS_PAGO.glovo
  if (n.includes('just') || n.includes('eat')) return CICLOS_PAGO.just
  if (n.includes('web')) return CICLOS_PAGO.web
  if (n.includes('direct')) return CICLOS_PAGO.direct
  return '—'
}

const CANAL_ORDER = ['Uber Eats', 'Glovo', 'Just Eat', 'Web Propia', 'Venta Directa']

type EditField = 'comision_pct' | 'comision_pct_prime' | 'fijo_eur' | 'fee_prime_eur' | 'fee_promo_eur' | 'fee_periodo_eur' | 'fee_periodicidad' | 'pct_pedidos_prime_estim' | 'pct_pedidos_promo_estim' | 'margen_obj_pct'

export default function TabCanales() {
  const { T, isDark } = useTheme()
  const [rows, setRows] = useState<Canal[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ id: string; field: EditField } | null>(null)
  const [editVal, setEditVal] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('config_canales').select('*')
    if (error) { setErr(error.message); setLoading(false); return }
    const sorted = ((data as Canal[]) ?? []).sort((a, b) => {
      const ia = CANAL_ORDER.indexOf(a.canal); const ib = CANAL_ORDER.indexOf(b.canal)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    setRows(sorted)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const notificarCambio = () => {
    invalidarCacheConfigCanales()
    window.dispatchEvent(new CustomEvent('config_canales:changed'))
    window.dispatchEvent(new CustomEvent('config_canales_updated'))
  }

  const guardar = async (id: string, field: EditField, raw: string) => {
    setSaving(true); setErr(null)
    let value: any
    if (field === 'fee_periodicidad') {
      value = raw
    } else if (raw === '' || raw === '—') {
      value = null
    } else {
      const num = parseFloat(raw.replace(',', '.'))
      if (isNaN(num) || num < 0) { setEditing(null); setSaving(false); return }
      if (field === 'comision_pct' || field === 'comision_pct_prime' || field === 'margen_obj_pct' || field === 'pct_pedidos_prime_estim' || field === 'pct_pedidos_promo_estim') {
        value = num / 100
      } else {
        value = num
      }
    }
    const { error } = await supabase.from('config_canales').update({ [field]: value }).eq('id', id)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setEditing(null)
    setSavedId(id)
    setTimeout(() => setSavedId(null), 1500)
    await load()
    notificarCambio()
  }

  const toggleActivo = async (id: string, activo: boolean) => {
    await supabase.from('config_canales').update({ activo: !activo }).eq('id', id)
    await load()
    notificarCambio()
  }

  const startEdit = (id: string, field: EditField, current: any) => {
    setEditing({ id, field })
    if (field === 'fee_periodicidad') {
      setEditVal(current ?? 'mensual')
    } else if (current == null) {
      setEditVal('')
    } else if (field === 'comision_pct' || field === 'comision_pct_prime' || field === 'margen_obj_pct' || field === 'pct_pedidos_prime_estim' || field === 'pct_pedidos_promo_estim') {
      setEditVal(String(Math.round(Number(current) * 10000) / 100))
    } else {
      setEditVal(String(current))
    }
  }

  // ─── Estilos: Running, números grandes legibles ───
  const card: CSSProperties = {
    background: T.card, border: `1px solid ${T.brd}`, borderRadius: 12, overflow: 'hidden',
  }
  const th: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 11, fontWeight: 500, letterSpacing: '1.4px',
    textTransform: 'uppercase', color: T.mut, padding: '14px 12px',
    background: isDark ? INK : TABCANALES_BG_LIGHT,
    borderBottom: `1px solid ${T.brd}`, whiteSpace: 'nowrap', textAlign: 'left',
  }
  const thR: CSSProperties = { ...th, textAlign: 'right' }
  const thC: CSSProperties = { ...th, textAlign: 'center' }
  const td: CSSProperties = {
    padding: '14px 12px', fontFamily: FONT.body, fontSize: 15, color: T.pri,
    borderBottom: `0.5px solid ${T.brd}`, whiteSpace: 'nowrap',
  }
  const tdR: CSSProperties = { ...td, textAlign: 'right' }
  const tdC: CSSProperties = { ...td, textAlign: 'center' }
  const cellEditable: CSSProperties = {
    cursor: 'pointer', borderBottom: `1px dashed ${T.mut}`, paddingBottom: 1,
    fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, color: T.pri,
    fontVariantNumeric: 'tabular-nums',
  }
  const cellEditableSec: CSSProperties = { ...cellEditable, color: T.sec, fontWeight: 500 }
  const inp: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 16, fontWeight: 600,
    background: BLANCO, color: INK,
    border: `1px solid ${T.brd}`, borderRadius: 6,
    padding: '5px 10px', width: 90, textAlign: 'right', outline: 'none',
  }
  const sel: CSSProperties = { ...inp, width: 170, textAlign: 'left', cursor: 'pointer' }

  if (loading) return <div style={{ padding: 24, color: T.mut, fontFamily: FONT.body }}>Cargando canales…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1480 }}>
            <thead>
              <tr>
                <th style={th}>Canal</th>
                <th style={thR}>Comisión %</th>
                <th style={thR}>Comisión Prime %</th>
                <th style={thR}>Fijo €/ped</th>
                <th style={thR}>Fee Prime €/ped</th>
                <th style={thR}>Fee Promo €/ped</th>
                <th style={thR}>Tarifa periódica €</th>
                <th style={thC}>Periodicidad</th>
                <th style={thR}>% Prime</th>
                <th style={thR}>% Promo</th>
                <th style={th}>Ciclo de pago</th>
                <th style={thC}>Activo</th>
                <th style={{ ...th, minWidth: 360, maxWidth: 420 }}>Cómo funciona</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const isComEdit       = editing?.id === c.id && editing.field === 'comision_pct'
                const isComPrimeEdit  = editing?.id === c.id && editing.field === 'comision_pct_prime'
                const isFijoEdit      = editing?.id === c.id && editing.field === 'fijo_eur'
                const isFeePrimeEdit  = editing?.id === c.id && editing.field === 'fee_prime_eur'
                const isFeePromoEdit  = editing?.id === c.id && editing.field === 'fee_promo_eur'
                const isFeePerEdit    = editing?.id === c.id && editing.field === 'fee_periodo_eur'
                const isPerEdit       = editing?.id === c.id && editing.field === 'fee_periodicidad'
                const isPctPrimeEdit  = editing?.id === c.id && editing.field === 'pct_pedidos_prime_estim'
                const isPctPromoEdit  = editing?.id === c.id && editing.field === 'pct_pedidos_promo_estim'
                const justSaved = savedId === c.id

                const fmtPct = (n: number | null) => n == null ? '—' : `${(Number(n) * 100).toFixed(2).replace(/\.?0+$/, '')}%`
                const fmtEur = (n: number | null) => n == null || Number(n) === 0 ? '—' : `${Number(n).toFixed(2)}€`

                return (
                  <tr key={c.id} style={{ background: justSaved ? (isDark ? '#1D9E7520' : '#1D9E7515') : 'transparent', transition: 'background 600ms' }}>
                    <td style={{ ...td, fontFamily: FONT.heading, fontSize: 16, fontWeight: 600 }}>{c.canal}</td>

                    <td style={tdR}>
                      {isComEdit ? (
                        <input type="number" step="0.01" autoFocus value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => guardar(c.id, 'comision_pct', editVal)}
                          onKeyDown={e => { if (e.key === 'Enter') guardar(c.id, 'comision_pct', editVal); if (e.key === 'Escape') setEditing(null) }}
                          style={inp} />
                      ) : (
                        <span onClick={() => startEdit(c.id, 'comision_pct', c.comision_pct)} style={cellEditable}>{fmtPct(c.comision_pct)}</span>
                      )}
                    </td>

                    <td style={tdR}>
                      {isComPrimeEdit ? (
                        <input type="number" step="0.01" autoFocus value={editVal} placeholder="—"
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => guardar(c.id, 'comision_pct_prime', editVal)}
                          onKeyDown={e => { if (e.key === 'Enter') guardar(c.id, 'comision_pct_prime', editVal); if (e.key === 'Escape') setEditing(null) }}
                          style={inp} />
                      ) : (
                        <span onClick={() => startEdit(c.id, 'comision_pct_prime', c.comision_pct_prime)} style={cellEditableSec}>{fmtPct(c.comision_pct_prime)}</span>
                      )}
                    </td>

                    <td style={tdR}>
                      {isFijoEdit ? (
                        <input type="number" step="0.01" autoFocus value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => guardar(c.id, 'fijo_eur', editVal)}
                          onKeyDown={e => { if (e.key === 'Enter') guardar(c.id, 'fijo_eur', editVal); if (e.key === 'Escape') setEditing(null) }}
                          style={inp} />
                      ) : (
                        <span onClick={() => startEdit(c.id, 'fijo_eur', c.fijo_eur)} style={cellEditableSec}>{fmtEur(c.fijo_eur)}</span>
                      )}
                    </td>

                    <td style={tdR}>
                      {isFeePrimeEdit ? (
                        <input type="number" step="0.01" autoFocus value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => guardar(c.id, 'fee_prime_eur', editVal)}
                          onKeyDown={e => { if (e.key === 'Enter') guardar(c.id, 'fee_prime_eur', editVal); if (e.key === 'Escape') setEditing(null) }}
                          style={inp} />
                      ) : (
                        <span onClick={() => startEdit(c.id, 'fee_prime_eur', c.fee_prime_eur)} style={cellEditableSec}>{fmtEur(c.fee_prime_eur)}</span>
                      )}
                    </td>

                    <td style={tdR}>
                      {isFeePromoEdit ? (
                        <input type="number" step="0.01" autoFocus value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => guardar(c.id, 'fee_promo_eur', editVal)}
                          onKeyDown={e => { if (e.key === 'Enter') guardar(c.id, 'fee_promo_eur', editVal); if (e.key === 'Escape') setEditing(null) }}
                          style={inp} />
                      ) : (
                        <span onClick={() => startEdit(c.id, 'fee_promo_eur', c.fee_promo_eur)} style={cellEditableSec}>{fmtEur(c.fee_promo_eur)}</span>
                      )}
                    </td>

                    <td style={tdR}>
                      {isFeePerEdit ? (
                        <input type="number" step="0.01" autoFocus value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => guardar(c.id, 'fee_periodo_eur', editVal)}
                          onKeyDown={e => { if (e.key === 'Enter') guardar(c.id, 'fee_periodo_eur', editVal); if (e.key === 'Escape') setEditing(null) }}
                          style={inp} />
                      ) : (
                        <span onClick={() => startEdit(c.id, 'fee_periodo_eur', c.fee_periodo_eur)} style={cellEditableSec}>{fmtEur(c.fee_periodo_eur)}</span>
                      )}
                    </td>

                    <td style={tdC}>
                      {isPerEdit ? (
                        <select autoFocus value={editVal}
                          onChange={e => { setEditVal(e.target.value); guardar(c.id, 'fee_periodicidad', e.target.value) }}
                          onBlur={() => setEditing(null)}
                          style={sel}>
                          {PERIODICIDADES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <span onClick={() => startEdit(c.id, 'fee_periodicidad', c.fee_periodicidad)}
                          style={{ ...cellEditableSec, fontFamily: FONT.body, fontSize: 13 }}>
                          {PERIODICIDADES.find(o => o.value === c.fee_periodicidad)?.label ?? (c.fee_periodicidad || '—')}
                        </span>
                      )}
                    </td>

                    <td style={tdR}>
                      {isPctPrimeEdit ? (
                        <input type="number" step="0.5" autoFocus value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => guardar(c.id, 'pct_pedidos_prime_estim', editVal)}
                          onKeyDown={e => { if (e.key === 'Enter') guardar(c.id, 'pct_pedidos_prime_estim', editVal); if (e.key === 'Escape') setEditing(null) }}
                          style={inp} />
                      ) : (
                        <span onClick={() => startEdit(c.id, 'pct_pedidos_prime_estim', c.pct_pedidos_prime_estim)}
                          style={cellEditableSec}>
                          {c.pct_pedidos_prime_estim == null || Number(c.pct_pedidos_prime_estim) === 0 ? '—' : `${(Number(c.pct_pedidos_prime_estim) * 100).toFixed(1)}%`}
                        </span>
                      )}
                    </td>

                    <td style={tdR}>
                      {isPctPromoEdit ? (
                        <input type="number" step="0.5" autoFocus value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => guardar(c.id, 'pct_pedidos_promo_estim', editVal)}
                          onKeyDown={e => { if (e.key === 'Enter') guardar(c.id, 'pct_pedidos_promo_estim', editVal); if (e.key === 'Escape') setEditing(null) }}
                          style={inp} />
                      ) : (
                        <span onClick={() => startEdit(c.id, 'pct_pedidos_promo_estim', c.pct_pedidos_promo_estim)}
                          style={cellEditableSec}>
                          {c.pct_pedidos_promo_estim == null || Number(c.pct_pedidos_promo_estim) === 0 ? '—' : `${(Number(c.pct_pedidos_promo_estim) * 100).toFixed(1)}%`}
                        </span>
                      )}
                    </td>

                    <td style={{ ...td, fontSize: 12, color: T.mut }}>{getCiclo(c.canal)}</td>

                    <td style={tdC}>
                      <button onClick={() => toggleActivo(c.id, c.activo)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                        title={c.activo ? 'Activo (click para desactivar)' : 'Inactivo (click para activar)'}>
                        <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', backgroundColor: c.activo ? VERDE : GRIS }} />
                      </button>
                    </td>

                    <td style={{
                      padding: '14px 14px',
                      fontFamily: FONT.body, fontSize: 12,
                      color: T.sec, lineHeight: 1.55,
                      borderBottom: `0.5px solid ${T.brd}`,
                      whiteSpace: 'normal', minWidth: 360, maxWidth: 420,
                    }}>
                      {COMO_FUNCIONA[c.canal] ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
        {saving ? 'Guardando…' : err ? <span style={{ color: ROJO }}>{err}</span> : 'Click en cualquier valor para editarlo. Enter para guardar, Esc para cancelar.'}
      </div>
    </div>
  )
}
