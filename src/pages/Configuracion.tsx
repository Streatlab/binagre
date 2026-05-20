import { useEffect, useState, type FormEvent, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, CARDS } from '@/components/panel/resumen/tokens'

/* ═══════ TYPES ═══════ */

interface Proveedor { id: string; abv: string; nombre_completo: string; categoria: string | null; marca_asociada?: string | null; activo: boolean }
interface Canal {
  id: string
  canal: string
  comision_pct: number | null
  comision_pct_prime: number | null
  fijo_eur: number | null
  coste_fijo: number | null
  fee_prime_eur: number | null
  fee_promo_eur: number | null
  fee_periodo_eur: number | null
  fee_periodicidad: string | null
  margen_deseado_pct?: number | null
  activo?: boolean
}

type Section = 'plataformas' | 'costes' | 'proveedores' | 'categorias' | 'unidades'

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'plataformas', label: 'Plataformas' },
  { key: 'costes', label: 'Costes' },
  { key: 'proveedores', label: 'Proveedores/ABV' },
  { key: 'categorias', label: 'Categorías' },
  { key: 'unidades', label: 'Unidades' },
]

const inputCls = 'w-full bg-[var(--sl-app)] border border-[var(--sl-border)] rounded-md px-3 py-2 text-sm text-[var(--sl-text-primary)] focus:outline-none focus:border-accent font-sans'
const btnPrimary = 'px-4 py-2 bg-accent text-black text-sm font-semibold rounded-md hover:brightness-110 transition font-ui uppercase tracking-wider'
const btnSecondary = 'px-4 py-2 text-sm text-[var(--sl-text-secondary)] border border-[var(--sl-border)] rounded-md hover:text-[var(--sl-text-primary)] hover:border-[#555] transition font-sans'
const thCfg = 'px-4 py-3 text-left text-[10px] uppercase tracking-[1.5px] text-[var(--sl-text-muted)] font-semibold bg-[var(--sl-thead)] border-b border-[var(--sl-border)] font-ui'
const rowCls = (idx: number) => idx % 2 === 0 ? 'bg-[var(--sl-card)]' : 'bg-[var(--sl-card-alt)]'
const tdCfg = 'px-4 py-2.5 border-b border-[var(--sl-border)] font-sans text-[0.82rem] text-[var(--sl-text-primary)]'

const CANAL_ORDER = ['Uber Eats', 'Glovo', 'Just Eat', 'Web Propia', 'Venta Directa']

const PERIODICIDADES: { value: string; label: string }[] = [
  { value: 'semanal_por_marca', label: 'Semanal/marca' },
  { value: 'quincenal_por_marca', label: 'Quincenal/marca' },
  { value: 'mensual', label: 'Mensual' },
]

export default function Configuracion() {
  const [section, setSection] = useState<Section>('plataformas')
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey(k => k + 1)

  const [isDark, setIsDark] = useState(
    typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark'
  )
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  const textPri   = isDark ? '#f0f0ff' : '#1a1a1a'
  const textSec   = isDark ? '#7080a8' : '#6b7280'
  const border    = isDark ? '#2a2a2a' : '#d0c8bc'
  const accent    = '#FF4757'
  const accentFg  = '#ffffff'

  return (
    <div style={{ fontFamily: 'Lexend, sans-serif', color: textPri }}>
      <h1 style={{
        fontFamily: 'Oswald, sans-serif',
        fontSize: '1.1rem',
        letterSpacing: '3px',
        color: textSec,
        marginBottom: 20,
        textTransform: 'uppercase',
      }}>
        Configuración
      </h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {SECTIONS.map(s => {
          const active = section === s.key
          return (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              style={{
                fontFamily: 'Lexend, sans-serif',
                fontSize: 13,
                backgroundColor: active ? accent : 'transparent',
                color: active ? accentFg : textSec,
                padding: '6px 14px',
                borderRadius: 6,
                border: active ? 'none' : `0.5px solid ${border}`,
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'background 150ms',
              }}
            >
              {s.label}
            </button>
          )
        })}
      </div>
      {section === 'plataformas' && <SecPlataformas key={refreshKey} />}
      {section === 'costes' && <SecCostes key={refreshKey} />}
      {section === 'proveedores' && <SecProveedores key={refreshKey} onRefresh={refresh} />}
      {section === 'categorias' && <SecCategorias key={`c-${refreshKey}`} onRefresh={refresh} />}
      {section === 'unidades' && <SecUnidades key={`u-${refreshKey}`} onRefresh={refresh} />}
    </div>
  )
}

/* ═══════ PLATAFORMAS · estilo Running ═══════ */

function SecPlataformas() {
  const [rows, setRows] = useState<Canal[]>([])
  const [loading, setLoading] = useState(true)
  const [guardado, setGuardado] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    ;(async () => {
      const { data } = await supabase.from('config_canales').select('*')
      if (!c) {
        const sorted = ((data as Canal[]) ?? []).sort((a, b) => {
          const ia = CANAL_ORDER.indexOf(a.canal)
          const ib = CANAL_ORDER.indexOf(b.canal)
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
        })
        setRows(sorted)
        setLoading(false)
      }
    })()
    return () => { c = true }
  }, [])

  const updateLocal = (id: string, field: keyof Canal, displayVal: string) => {
    let numVal: number | string | null = parseFloat(displayVal)
    if (isNaN(numVal as number)) numVal = 0
    // Para campos % en pantalla guardamos como decimal (0-1)
    if (field === 'comision_pct' || field === 'comision_pct_prime') {
      numVal = (numVal as number) / 100
    }
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: numVal } : r))
  }

  const updatePeriodicidad = (id: string, value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, fee_periodicidad: value } : r))
  }

  const handleGuardar = async () => {
    setSaving(true); setErr(null)
    const payload = rows.map(r => ({
      id: r.id,
      canal: r.canal,
      comision_pct: r.comision_pct,
      comision_pct_prime: r.comision_pct_prime,
      fijo_eur: r.fijo_eur,
      coste_fijo: r.fijo_eur, // mantener sincronizados
      fee_prime_eur: r.fee_prime_eur,
      fee_promo_eur: r.fee_promo_eur,
      fee_periodo_eur: r.fee_periodo_eur,
      fee_periodicidad: r.fee_periodicidad,
      margen_deseado_pct: r.margen_deseado_pct,
      activo: r.activo ?? true,
    }))
    const { error } = await supabase.from('config_canales').upsert(payload, { onConflict: 'canal' })
    setSaving(false)
    if (error) { setErr(error.message); return }
    // Dispara evento global → Dashboard / Facturación / Running / PE recargan en caliente
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('config_canales:changed'))
    }
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
  }

  if (loading) return <Loader />

  // ─── ESTILOS estilo Running ───
  const card: CSSProperties = { ...CARDS.std, padding: 0, overflow: 'hidden' }
  const tableSty: CSSProperties = { width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 1100 }
  const th: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: COLORS.mut,
    padding: '10px 10px',
    background: COLORS.bg,
    borderBottom: `1px solid ${COLORS.brd}`,
    whiteSpace: 'nowrap',
    textAlign: 'left',
  }
  const thR: CSSProperties = { ...th, textAlign: 'right' }
  const thC: CSSProperties = { ...th, textAlign: 'center' }
  const tdSty: CSSProperties = {
    padding: '8px 10px',
    fontSize: 13,
    fontFamily: FONT.body,
    color: COLORS.sec,
    borderBottom: `0.5px solid ${COLORS.brd}`,
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
  }
  const tdRight: CSSProperties = { ...tdSty, textAlign: 'right' }
  const inp: CSSProperties = {
    width: 80,
    background: '#fff',
    border: `0.5px solid ${COLORS.brd}`,
    borderRadius: 6,
    padding: '5px 8px',
    fontFamily: FONT.heading,
    fontSize: 13,
    color: COLORS.pri,
    textAlign: 'right',
    outline: 'none',
  }
  const sel: CSSProperties = {
    ...inp,
    width: 150,
    textAlign: 'left',
    cursor: 'pointer',
    appearance: 'auto' as const,
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        fontFamily: FONT.body, fontSize: 12, color: COLORS.mut,
        background: '#fff', padding: '10px 14px',
        border: `0.5px solid ${COLORS.brd}`, borderRadius: 10,
      }}>
        <strong style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: COLORS.sec }}>Cómo se aplica:</strong>{' '}
        Todos los importes se introducen SIN IVA. El ERP añade el 21% automáticamente.
        La <strong>Comisión Prime</strong> sustituye a la normal en pedidos de cliente Prime/Uber One.
        Los <strong>Fee Prime</strong> y <strong>Fee Promo</strong> se suman como cargo extra por pedido especial.
        La <strong>Tarifa periódica</strong> se cobra por marca según la periodicidad indicada.
      </div>

      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableSty}>
            <thead>
              <tr>
                <th style={th}>Canal</th>
                <th style={thR}>Comisión normal %</th>
                <th style={thR}>Comisión Prime %</th>
                <th style={thR}>Fijo €/pedido</th>
                <th style={thR}>Fee Prime €/ped</th>
                <th style={thR}>Fee Promo €/ped</th>
                <th style={thR}>Tarifa periódica €</th>
                <th style={thC}>Periodicidad</th>
                <th style={thR}>Margen objetivo %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const bg = idx % 2 === 0 ? '#fff' : '#f5f3ef'
                const comNorm = Math.round((Number(r.comision_pct ?? 0)) * 100 * 100) / 100
                const comPrime = r.comision_pct_prime != null
                  ? Math.round(Number(r.comision_pct_prime) * 100 * 100) / 100
                  : ''
                return (
                  <tr key={r.id} style={{ background: bg }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${COLORS.bg}80` }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = bg }}>
                    <td style={{ ...tdSty, fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: COLORS.pri }}>{r.canal}</td>
                    <td style={tdRight}>
                      <input type="number" step="0.01" defaultValue={comNorm}
                        onBlur={e => updateLocal(r.id, 'comision_pct', e.target.value)} style={inp} />
                    </td>
                    <td style={tdRight}>
                      <input type="number" step="0.01"
                        defaultValue={comPrime === '' ? '' : comPrime}
                        placeholder="—"
                        onBlur={e => {
                          if (e.target.value === '' || e.target.value === '0') {
                            setRows(prev => prev.map(x => x.id === r.id ? { ...x, comision_pct_prime: null } : x))
                          } else {
                            updateLocal(r.id, 'comision_pct_prime', e.target.value)
                          }
                        }}
                        style={inp} />
                    </td>
                    <td style={tdRight}>
                      <input type="number" step="0.01" defaultValue={r.fijo_eur ?? 0}
                        onBlur={e => updateLocal(r.id, 'fijo_eur', e.target.value)} style={inp} />
                    </td>
                    <td style={tdRight}>
                      <input type="number" step="0.01" defaultValue={r.fee_prime_eur ?? 0}
                        onBlur={e => updateLocal(r.id, 'fee_prime_eur', e.target.value)} style={inp} />
                    </td>
                    <td style={tdRight}>
                      <input type="number" step="0.01" defaultValue={r.fee_promo_eur ?? 0}
                        onBlur={e => updateLocal(r.id, 'fee_promo_eur', e.target.value)} style={inp} />
                    </td>
                    <td style={tdRight}>
                      <input type="number" step="0.01" defaultValue={r.fee_periodo_eur ?? 0}
                        onBlur={e => updateLocal(r.id, 'fee_periodo_eur', e.target.value)} style={inp} />
                    </td>
                    <td style={{ ...tdSty, textAlign: 'center' }}>
                      <select value={r.fee_periodicidad ?? 'mensual'}
                        onChange={e => updatePeriodicidad(r.id, e.target.value)} style={sel}>
                        {PERIODICIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </td>
                    <td style={tdRight}>
                      <input type="number" step="0.1" defaultValue={r.margen_deseado_pct ?? 15}
                        onBlur={e => updateLocal(r.id, 'margen_deseado_pct', e.target.value)} style={inp} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={handleGuardar}
          disabled={saving}
          style={{
            background: guardado ? '#16a34a' : COLORS.redSL,
            color: '#fff',
            border: 'none',
            padding: '10px 24px',
            borderRadius: 6,
            fontFamily: FONT.heading,
            fontSize: 12,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? 'GUARDANDO…' : guardado ? 'GUARDADO ✓' : 'GUARDAR'}
        </button>
        {err && <span style={{ color: COLORS.err, fontSize: 12, fontFamily: FONT.body }}>{err}</span>}
        {!isMobile && (
          <span style={{ marginLeft: 'auto', fontFamily: FONT.body, fontSize: 11, color: COLORS.mut }}>
            Los cambios se propagan en caliente a Dashboard, Facturación, Running, PE y Objetivos al guardar.
          </span>
        )}
      </div>
    </div>
  )
}

function SecCostes() {
  const [estructura, setEstructura] = useState('30')
  const [paramsId, setParamsId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    ;(async () => {
      const { data } = await supabase.from('parametros_escandallo').select('id, estructura_pct').limit(1).maybeSingle()
      if (!c) {
        if (data) {
          setParamsId((data as { id: string }).id)
          setEstructura(String((data as { estructura_pct: number | string }).estructura_pct))
        }
        setLoading(false)
      }
    })()
    return () => { c = true }
  }, [])

  const handleGuardar = async () => {
    if (!paramsId) { setErr('Sin registro de parámetros'); return }
    setSaving(true); setErr(null)
    const { error } = await supabase
      .from('parametros_escandallo')
      .update({ estructura_pct: Number(estructura) || 0, updated_at: new Date().toISOString() })
      .eq('id', paramsId)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
  }

  if (loading) return <Loader />

  return (
    <div className="space-y-6 max-w-lg">
      <div className="bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-xs text-[var(--sl-text-muted)] mb-1.5">Coste estructura (%)</label>
          <input type="number" step="0.1" value={estructura} onChange={e => setEstructura(e.target.value)} className={inputCls} />
          <p className="text-[11px] text-[var(--sl-text-muted)] mt-1">Se aplica sobre PVP neto (sin IVA) en todas las recetas</p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleGuardar}
            disabled={saving}
            style={{
              background: guardado ? '#16a34a' : '#B01D23',
              color: '#fff',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '5px',
              fontFamily: 'Oswald, sans-serif',
              fontSize: '.78rem',
              letterSpacing: '1px',
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? 'GUARDANDO…' : guardado ? 'GUARDADO ✓' : 'GUARDAR'}
          </button>
          {err && <span className="text-xs text-[#dc2626]">{err}</span>}
        </div>
      </div>

      <SecFoodCostUmbral />
    </div>
  )
}

function SecFoodCostUmbral() {
  const [umbral, setUmbral] = useState('32')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    ;(async () => {
      const { data } = await supabase
        .from('configuracion')
        .select('valor')
        .eq('clave', 'config_food_cost_umbral')
        .maybeSingle()
      if (!c) {
        if (data) setUmbral(String((data as { valor: string }).valor))
        setLoading(false)
      }
    })()
    return () => { c = true }
  }, [])

  const handleGuardar = async () => {
    const val = parseFloat(umbral)
    if (isNaN(val) || val < 0 || val > 100) { setErr('Valor entre 0 y 100'); return }
    setSaving(true); setErr(null)
    const { error } = await supabase
      .from('configuracion')
      .upsert({ clave: 'config_food_cost_umbral', valor: String(val) }, { onConflict: 'clave' })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
  }

  if (loading) return null

  return (
    <div className="bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-xl p-6 space-y-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-[var(--sl-text-muted)] mb-3" style={{ fontFamily: 'Oswald, sans-serif' }}>
          Alerta Food Cost
        </div>
        <label className="block text-xs text-[var(--sl-text-muted)] mb-1.5">Umbral food cost (%)</label>
        <input
          type="number"
          step="0.5"
          min={0}
          max={100}
          value={umbral}
          onChange={e => setUmbral(e.target.value)}
          className={inputCls}
          style={{ maxWidth: 120 }}
        />
        <p className="text-[11px] text-[var(--sl-text-muted)] mt-1">
          Si el food cost de una receta supera este %, se muestra badge rojo y banner de alerta. Default: 32%.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleGuardar}
          disabled={saving}
          style={{
            background: guardado ? '#16a34a' : '#B01D23',
            color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '5px',
            fontFamily: 'Oswald, sans-serif', fontSize: '.78rem', letterSpacing: '1px',
            cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? 'GUARDANDO…' : guardado ? 'GUARDADO ✓' : 'GUARDAR'}
        </button>
        {err && <span className="text-xs text-[#dc2626]">{err}</span>}
      </div>
    </div>
  )
}

function SecProveedores({ onRefresh }: { onRefresh: () => void }) {
  const [rows, setRows] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Proveedor | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('config_proveedores').select('*').order('abv')
    setRows((data as Proveedor[]) ?? []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleDelete = async (id: string, abv: string) => {
    if (!confirm(`¿Eliminar proveedor ${abv}?`)) return
    await supabase.from('config_proveedores').delete().eq('id', id)
    setRows(prev => prev.filter(r => r.id !== id))
  }

  if (loading) return <Loader />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--sl-text-muted)]">{rows.length} proveedores</span>
        <button onClick={() => setShowAdd(true)} className={btnPrimary + ' ml-auto'}>+ Añadir proveedor</button>
      </div>
      <div className="bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr>
            <th className={thCfg}>Categoría</th>
            <th className={thCfg}>ABV</th>
            <th className={thCfg}>Nombre</th>
            <th className={thCfg}>Marca Principal</th>
            <th className={thCfg + ' text-center'} style={{ width: 80 }}></th>
          </tr></thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.id} onClick={() => setEdit(r)} className={'cursor-pointer hover:bg-[var(--sl-thead)] ' + rowCls(idx)}>
                <td className={tdCfg + ' text-[var(--sl-text-secondary)]'}>{r.categoria ?? '—'}</td>
                <td className={tdCfg + ' text-[var(--sl-text-primary)] font-mono text-xs font-bold'}>{r.abv}</td>
                <td className={tdCfg + ' text-[var(--sl-text-primary)]'}>{r.nombre_completo}</td>
                <td className={tdCfg + ' text-[var(--sl-text-secondary)]'}>{r.marca_asociada ?? '—'}</td>
                <td className={tdCfg + ' text-center'}>
                  <button onClick={e => { e.stopPropagation(); handleDelete(r.id, r.abv) }} className="text-xs text-[var(--sl-text-muted)] hover:text-[#dc2626] transition">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAdd && <ProvModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); onRefresh() }} />}
      {edit && <ProvModal existing={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); onRefresh() }} />}
    </div>
  )
}

function ProvModal({ existing, onClose, onSaved }: { existing?: Proveedor; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!existing
  const [f, setF] = useState({ abv: existing?.abv ?? '', nombre_completo: existing?.nombre_completo ?? '', categoria: existing?.categoria ?? '', marca_asociada: existing?.marca_asociada ?? '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!f.abv.trim() || !f.nombre_completo.trim()) { setErr('ABV y nombre son obligatorios'); return }
    setSaving(true)
    const payload = { abv: f.abv.trim().toUpperCase(), nombre_completo: f.nombre_completo.trim(), categoria: f.categoria || null, marca_asociada: f.marca_asociada || null, activo: true }
    const { error } = isEdit
      ? await supabase.from('config_proveedores').update(payload).eq('id', existing!.id)
      : await supabase.from('config_proveedores').insert(payload)
    setSaving(false)
    if (error) { setErr(error.message); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Editar proveedor' : 'Añadir proveedor'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <CfgField label="ABV" value={f.abv} onChange={v => setF(p => ({ ...p, abv: v }))} placeholder="MER" />
          <CfgField label="Nombre" value={f.nombre_completo} onChange={v => setF(p => ({ ...p, nombre_completo: v }))} placeholder="Mercadona" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <CfgField label="Categoría" value={f.categoria} onChange={v => setF(p => ({ ...p, categoria: v }))} placeholder="Supermercado" />
          <CfgField label="Marca Principal" value={f.marca_asociada} onChange={v => setF(p => ({ ...p, marca_asociada: v }))} placeholder="Hacendado" />
        </div>
        {err && <p className="text-[#dc2626] text-sm">{err}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary + ' flex-1'}>Cancelar</button>
          <button type="submit" disabled={saving} className={btnPrimary + ' flex-1 disabled:opacity-50'}>{saving ? 'Guardando…' : isEdit ? 'Actualizar' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}

function SecCategorias({ onRefresh }: { onRefresh: () => void }) {
  return <EditableList clave="categorias" colLabel="Categoría" placeholder="Nueva categoría…" onRefresh={onRefresh} />
}

function SecUnidades({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <EditableList clave="formatos_compra" colLabel="Formatos de Compra" placeholder="Nuevo formato…" onRefresh={onRefresh} />
      <EditableList clave="unidades_estandar" colLabel="Unidades Estándar" placeholder="Nueva unidad…" onRefresh={onRefresh} />
      <EditableList clave="unidades_minimas" colLabel="Unidades Mínimas" placeholder="Nueva unidad mín…" onRefresh={onRefresh} />
    </div>
  )
}

function EditableList({ clave, colLabel, placeholder, onRefresh }: { clave: string; colLabel: string; placeholder: string; onRefresh: () => void }) {
  const [items, setItems] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [nuevo, setNuevo] = useState('')

  useEffect(() => {
    let c = false
    ;(async () => {
      const { data } = await supabase.from('configuracion').select('*').eq('clave', clave).maybeSingle()
      if (!c) {
        const list = data?.valor ? JSON.parse(data.valor) : []
        setItems(Array.isArray(list) ? list : [])
        setLoading(false)
      }
    })()
    return () => { c = true }
  }, [clave])

  const persist = async (next: string[]) => {
    await supabase.from('configuracion').upsert({ clave, valor: JSON.stringify(next) }, { onConflict: 'clave' })
    onRefresh()
  }

  const add = async () => {
    if (!nuevo.trim()) return
    const next = [...items, nuevo.trim()]
    setItems(next); setNuevo('')
    await persist(next)
  }

  const remove = async (idx: number) => {
    const next = items.filter((_, i) => i !== idx)
    setItems(next)
    await persist(next)
  }

  if (loading) return <Loader />

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input value={nuevo} onChange={e => setNuevo(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={placeholder} className={inputCls} />
        <button onClick={add} className={btnPrimary} style={{ whiteSpace: 'nowrap' }}>+</button>
      </div>
      <div className="bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr>
            <th className={thCfg}>{colLabel}</th>
            <th className={thCfg + ' text-right'} style={{ width: 70 }}></th>
          </tr></thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={2} className="p-6 text-center text-[var(--sl-text-muted)] text-sm">Sin items</td></tr>
            ) : items.map((it, idx) => (
              <tr key={idx} className={rowCls(idx)}>
                <td className={tdCfg + ' text-[var(--sl-text-primary)]'}>{it}</td>
                <td className={tdCfg + ' text-right'}>
                  <button onClick={() => remove(idx)} className="text-xs text-[var(--sl-text-muted)] hover:text-[#dc2626] transition">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sl-border)]">
          <h3 className="text-[var(--sl-text-primary)] font-semibold">{title}</h3>
          <button onClick={onClose} className="text-[var(--sl-text-muted)] hover:text-[var(--sl-text-primary)] text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function CfgField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs text-[var(--sl-text-muted)] mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
    </div>
  )
}

function Loader() {
  return (
    <div className="bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-xl p-12 text-center">
      <div className="inline-block h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-[var(--sl-text-muted)] text-sm mt-3">Cargando…</p>
    </div>
  )
}
