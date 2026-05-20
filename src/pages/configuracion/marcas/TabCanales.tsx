import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { invalidarCacheConfigCanales } from '@/lib/panel/calcNetoPlataforma'

/* ═══════════════════════════════════════════════════════════════
   TAB CANALES DE VENTA (Integraciones > Canales)
   Pantalla canónica para configurar comisiones y fees de cada plataforma.
   Estilo Running (sin amarillo). Datos verificados con facturas reales:
   - Glovo: 21 pedidos analizados → comisión 30% (bruto-promo) + 0.74€/Prime + 10€/quincena/marca
   - Uber Eats: 33 pedidos analizados → 30% normal / 33% UberOne (preparado) + 0.82€/pedido con promo
   - IVA 21% sobre TODO (comisión, fees, tarifa publicitaria)
   ═══════════════════════════════════════════════════════════════ */

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

const CICLOS_PAGO: Record<string, string> = {
  uber:    'Lunes semanal (lun a dom anterior)',
  glovo:   '1-15 paga día 5 mes sig · 16-fin paga día 20 mes sig',
  just:    '1-15 paga día 20 mismo mes · 16-fin paga día 5 mes sig',
  web:     'Pendiente definir',
  direct:  'Al día',
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
      // Si está vacío, lo grabamos como null (para comision_pct_prime principalmente)
      value = null
    } else {
      const num = parseFloat(raw.replace(',', '.'))
      if (isNaN(num) || num < 0) { setEditing(null); setSaving(false); return }
      // % se guarda como decimal (0–1)
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

  // ─── ESTILOS Running ───
  const card: CSSProperties = {
    background: T.card, border: `1px solid ${T.brd}`, borderRadius: 12,
    overflow: 'hidden',
  }
  const th: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 10, fontWeight: 500, letterSpacing: '1.5px',
    textTransform: 'uppercase', color: T.mut, padding: '12px 10px',
    background: isDark ? '#0a0a0a' : '#faf8f3',
    borderBottom: `1px solid ${T.brd}`, whiteSpace: 'nowrap', textAlign: 'left',
  }
  const thR: CSSProperties = { ...th, textAlign: 'right' }
  const thC: CSSProperties = { ...th, textAlign: 'center' }
  const td: CSSProperties = {
    padding: '11px 10px', fontFamily: FONT.body, fontSize: 13, color: T.pri,
    borderBottom: `0.5px solid ${T.brd}`, whiteSpace: 'nowrap',
  }
  const tdR: CSSProperties = { ...td, textAlign: 'right' }
  const tdC: CSSProperties = { ...td, textAlign: 'center' }
  const cellEditable: CSSProperties = {
    cursor: 'pointer', borderBottom: `1px dashed ${T.mut}`, paddingBottom: 1,
    fontFamily: FONT.heading, fontSize: 13, color: T.pri,
  }
  const cellEditableSec: CSSProperties = { ...cellEditable, color: T.sec }
  const inp: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 13, fontWeight: 600,
    background: '#fff', color: '#111',
    border: `1px solid ${T.brd}`, borderRadius: 6,
    padding: '4px 8px', width: 80, textAlign: 'right',
    outline: 'none',
  }
  const sel: CSSProperties = { ...inp, width: 160, textAlign: 'left', cursor: 'pointer' }

  if (loading) return <div style={{ padding: 24, color: T.mut, fontFamily: FONT.body }}>Cargando canales…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Banner explicativo */}
      <div style={{
        fontFamily: FONT.body, fontSize: 12, color: T.sec,
        background: isDark ? '#1a1a1a' : '#ffffff',
        padding: '12px 16px', border: `0.5px solid ${T.brd}`, borderRadius: 10,
        lineHeight: 1.55,
      }}>
        <strong style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: T.pri }}>
          Cómo se aplica:
        </strong>{' '}
        Todos los importes se introducen <strong>SIN IVA</strong>. El ERP añade el 21% automáticamente.
        La <strong>Comisión Prime</strong> sustituye a la normal en pedidos de cliente Prime/Uber One.
        Los <strong>Fee Prime</strong> y <strong>Fee Promo</strong> se suman como cargo extra por pedido especial.
        La <strong>Tarifa periódica</strong> se cobra por marca según la periodicidad. Click en cualquier valor para editarlo.
      </div>

      {/* Tabla principal */}
      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1280 }}>
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
                <th style={thR}>% Prime estim.</th>
                <th style={thR}>% Promo estim.</th>
                <th style={th}>Ciclo de pago</th>
                <th style={thR}>Margen obj. %</th>
                <th style={thC}>Activo</th>
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
                const isMargenEdit    = editing?.id === c.id && editing.field === 'margen_obj_pct'
                const justSaved = savedId === c.id

                const fmtPct = (n: number | null) => n == null ? '—' : `${(Number(n) * 100).toFixed(2).replace(/\.?0+$/, '')}%`
                const fmtEur = (n: number | null) => n == null || Number(n) === 0 ? '—' : `${Number(n).toFixed(2)}€`

                return (
                  <tr key={c.id} style={{ background: justSaved ? (isDark ? '#1D9E7520' : '#1D9E7515') : 'transparent', transition: 'background 600ms' }}>
                    <td style={{ ...td, fontFamily: FONT.heading, fontSize: 14, fontWeight: 600 }}>{c.canal}</td>

                    {/* Comisión normal % */}
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

                    {/* Comisión Prime % */}
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

                    {/* Fijo €/pedido */}
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

                    {/* Fee Prime €/ped */}
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

                    {/* Fee Promo €/ped */}
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

                    {/* Tarifa periódica € */}
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

                    {/* Periodicidad */}
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
                          style={{ ...cellEditableSec, fontFamily: FONT.body, fontSize: 12 }}>
                          {PERIODICIDADES.find(o => o.value === c.fee_periodicidad)?.label ?? (c.fee_periodicidad || '—')}
                        </span>
                      )}
                    </td>

                    {/* % pedidos Prime estimado */}
                    <td style={tdR}>
                      {isPctPrimeEdit ? (
                        <input type="number" step="0.5" autoFocus value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => guardar(c.id, 'pct_pedidos_prime_estim', editVal)}
                          onKeyDown={e => { if (e.key === 'Enter') guardar(c.id, 'pct_pedidos_prime_estim', editVal); if (e.key === 'Escape') setEditing(null) }}
                          style={inp} />
                      ) : (
                        <span onClick={() => startEdit(c.id, 'pct_pedidos_prime_estim', c.pct_pedidos_prime_estim)}
                          style={{ ...cellEditableSec, fontFamily: FONT.body, fontSize: 12 }}>
                          {c.pct_pedidos_prime_estim == null || Number(c.pct_pedidos_prime_estim) === 0 ? '—' : `${(Number(c.pct_pedidos_prime_estim) * 100).toFixed(1)}%`}
                        </span>
                      )}
                    </td>

                    {/* % pedidos Promo estimado */}
                    <td style={tdR}>
                      {isPctPromoEdit ? (
                        <input type="number" step="0.5" autoFocus value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => guardar(c.id, 'pct_pedidos_promo_estim', editVal)}
                          onKeyDown={e => { if (e.key === 'Enter') guardar(c.id, 'pct_pedidos_promo_estim', editVal); if (e.key === 'Escape') setEditing(null) }}
                          style={inp} />
                      ) : (
                        <span onClick={() => startEdit(c.id, 'pct_pedidos_promo_estim', c.pct_pedidos_promo_estim)}
                          style={{ ...cellEditableSec, fontFamily: FONT.body, fontSize: 12 }}>
                          {c.pct_pedidos_promo_estim == null || Number(c.pct_pedidos_promo_estim) === 0 ? '—' : `${(Number(c.pct_pedidos_promo_estim) * 100).toFixed(1)}%`}
                        </span>
                      )}
                    </td>

                    {/* Ciclo de pago (lectura) */}
                    <td style={{ ...td, fontSize: 11, color: T.mut, whiteSpace: 'normal', maxWidth: 240 }}>{getCiclo(c.canal)}</td>

                    {/* Margen objetivo % */}
                    <td style={tdR}>
                      {isMargenEdit ? (
                        <input type="number" step="0.1" autoFocus value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => guardar(c.id, 'margen_obj_pct', editVal)}
                          onKeyDown={e => { if (e.key === 'Enter') guardar(c.id, 'margen_obj_pct', editVal); if (e.key === 'Escape') setEditing(null) }}
                          style={inp} />
                      ) : (
                        <span onClick={() => startEdit(c.id, 'margen_obj_pct', c.margen_obj_pct)} style={cellEditableSec}>{fmtPct(c.margen_obj_pct)}</span>
                      )}
                    </td>

                    {/* Activo */}
                    <td style={tdC}>
                      <button onClick={() => toggleActivo(c.id, c.activo)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                        title={c.activo ? 'Activo (click para desactivar)' : 'Inactivo (click para activar)'}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: c.activo ? '#06C167' : '#555' }} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
        {saving ? 'Guardando…' : err ? <span style={{ color: '#dc2626' }}>{err}</span> : 'Click en cualquier valor para editarlo. Enter para guardar, Esc para cancelar. Los cambios se propagan en caliente a Dashboard, Facturación, Running, PE y Objetivos.'}
      </div>
    </div>
  )
}
