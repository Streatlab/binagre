/**
 * PagosCobros — Módulo de gestión de cobros y pagos
 * Tabs: Calendario | Gastos Fijos | Historial
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtDate } from '@/utils/format'

// ─── Helpers de fecha ────────────────────────────────────────────────────────

function toLocalISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d)
  r.setMonth(r.getMonth() + n)
  return r
}

/** Lunes de la semana que contiene d */
function getMondayOfWeek(d: Date): Date {
  const r = new Date(d)
  const dow = r.getDay() // 0=dom
  const diff = dow === 0 ? -6 : 1 - dow
  r.setDate(r.getDate() + diff)
  return r
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface CalendarioItem {
  id: string
  fecha: Date
  tipo: 'COBRO' | 'PAGO'
  concepto: string
  importe: number
}

interface GastoFijo {
  id: number
  concepto: string
  importe: number
  periodicidad: string
  proxima_fecha_pago: string
  activo: boolean
}

interface HistorialItem {
  id: string | number
  fecha: string
  concepto: string
  importe: number
  categoria: string
  tipo: string
}

interface FacturacionRow {
  fecha: string
  uber_bruto: number
  glovo_bruto: number
  je_bruto: number
  web_bruto: number
  directa_bruto: number
}

// ─── Reglas de cobro ─────────────────────────────────────────────────────────

function calcUberCobros(rows: FacturacionRow[], hoy: Date, hasta: Date): CalendarioItem[] {
  const semanas: Record<string, { lunes: Date; importe: number }> = {}
  for (const r of rows) {
    const d = new Date(r.fecha + 'T12:00:00')
    const lunes = getMondayOfWeek(d)
    const key = toLocalISO(lunes)
    if (!semanas[key]) semanas[key] = { lunes, importe: 0 }
    semanas[key].importe += Number(r.uber_bruto) || 0
  }
  const items: CalendarioItem[] = []
  for (const [, s] of Object.entries(semanas)) {
    if (s.importe <= 0) continue
    const fechaCobro = addDays(s.lunes, 7)
    if (fechaCobro > hasta) continue
    if (fechaCobro <= hoy) continue
    items.push({
      id: `uber-${toLocalISO(s.lunes)}`,
      fecha: fechaCobro,
      tipo: 'COBRO',
      concepto: `Uber Eats — semana ${toLocalISO(s.lunes)}`,
      importe: s.importe,
    })
  }
  return items
}

function calcGlovoCobros(rows: FacturacionRow[], hoy: Date, hasta: Date): CalendarioItem[] {
  const quincenas: Record<string, { fecha: Date; importe: number; qLabel: string }> = {}
  for (const r of rows) {
    const d = new Date(r.fecha + 'T12:00:00')
    const dia = d.getDate()
    const mes = d.getMonth()
    const anio = d.getFullYear()
    const qKey = dia <= 15 ? `${anio}-${mes}-1` : `${anio}-${mes}-2`
    if (!quincenas[qKey]) {
      const fechaCobro = dia <= 15
        ? new Date(anio, mes + 1, 5)
        : new Date(anio, mes + 1, 20)
      const label = dia <= 15
        ? `Glovo — 1–15 ${d.toLocaleString('es-ES', { month: 'long' })} ${anio}`
        : `Glovo — 16–fin ${d.toLocaleString('es-ES', { month: 'long' })} ${anio}`
      quincenas[qKey] = { fecha: fechaCobro, importe: 0, qLabel: label }
    }
    quincenas[qKey].importe += Number(r.glovo_bruto) || 0
  }
  const items: CalendarioItem[] = []
  for (const [key, q] of Object.entries(quincenas)) {
    if (q.importe <= 0) continue
    if (q.fecha > hasta) continue
    if (q.fecha <= hoy) continue
    items.push({
      id: `glovo-${key}`,
      fecha: q.fecha,
      tipo: 'COBRO',
      concepto: q.qLabel,
      importe: q.importe,
    })
  }
  return items
}

function calcJECobros(rows: FacturacionRow[], hoy: Date, hasta: Date): CalendarioItem[] {
  const quincenas: Record<string, { fecha: Date; importe: number; qLabel: string }> = {}
  for (const r of rows) {
    const d = new Date(r.fecha + 'T12:00:00')
    const dia = d.getDate()
    const mes = d.getMonth()
    const anio = d.getFullYear()
    const qKey = dia <= 15 ? `${anio}-${mes}-1` : `${anio}-${mes}-2`
    if (!quincenas[qKey]) {
      const fechaCobro = dia <= 15
        ? new Date(anio, mes, 20)
        : new Date(anio, mes + 1, 5)
      const label = dia <= 15
        ? `Just Eat — 1–15 ${d.toLocaleString('es-ES', { month: 'long' })} ${anio}`
        : `Just Eat — 16–fin ${d.toLocaleString('es-ES', { month: 'long' })} ${anio}`
      quincenas[qKey] = { fecha: fechaCobro, importe: 0, qLabel: label }
    }
    quincenas[qKey].importe += Number(r.je_bruto) || 0
  }
  const items: CalendarioItem[] = []
  for (const [key, q] of Object.entries(quincenas)) {
    if (q.importe <= 0) continue
    if (q.fecha > hasta) continue
    if (q.fecha <= hoy) continue
    items.push({
      id: `je-${key}`,
      fecha: q.fecha,
      tipo: 'COBRO',
      concepto: q.qLabel,
      importe: q.importe,
    })
  }
  return items
}

function calcGastosPagos(gastos: GastoFijo[], hoy: Date, hasta: Date): CalendarioItem[] {
  const items: CalendarioItem[] = []
  for (const g of gastos) {
    if (!g.activo) continue
    const base = new Date(g.proxima_fecha_pago + 'T12:00:00')
    const periodos: Date[] = []
    if (g.periodicidad === 'mensual') {
      for (let i = 0; i <= 3; i++) periodos.push(addMonths(base, i))
    } else if (g.periodicidad === 'semanal') {
      let cur = new Date(base)
      while (cur <= hasta) { periodos.push(new Date(cur)); cur = addDays(cur, 7) }
    } else if (g.periodicidad === 'anual') {
      periodos.push(base)
    } else {
      periodos.push(base)
    }
    for (const fecha of periodos) {
      if (fecha <= hoy) continue
      if (fecha > hasta) continue
      items.push({
        id: `gasto-${g.id}-${toLocalISO(fecha)}`,
        fecha,
        tipo: 'PAGO',
        concepto: g.concepto,
        importe: Number(g.importe),
      })
    }
  }
  return items
}

// ─── Componente principal ────────────────────────────────────────────────────

type TabId = 'calendario' | 'gastos' | 'historial'

const TABS: { id: TabId; label: string }[] = [
  { id: 'calendario', label: 'CALENDARIO' },
  { id: 'gastos', label: 'GASTOS FIJOS' },
  { id: 'historial', label: 'HISTORIAL' },
]

export default function PagosCobros() {
  const [tab, setTab] = useState<TabId>('calendario')

  return (
    <div style={{ padding: '28px 28px', fontFamily: 'Lexend, sans-serif', color: 'var(--sl-text-primary)', minHeight: '100vh', backgroundColor: 'var(--sl-app)' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--sl-text-primary)', margin: 0 }}>
          Pagos y Cobros
        </h1>
        <p style={{ fontSize: 13, color: 'var(--sl-text-muted)', margin: '4px 0 0' }}>
          Calendario de cobros de plataformas y gestión de pagos
        </p>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              fontFamily: 'Oswald, sans-serif',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: 1,
              padding: '7px 18px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: tab === t.id ? '#e8f442' : 'var(--sl-card-alt)',
              color: tab === t.id ? 'var(--sl-text-primary)' : 'var(--sl-text-secondary)',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'calendario' && <TabCalendario />}
      {tab === 'gastos' && <TabGastos />}
      {tab === 'historial' && <TabHistorial />}
    </div>
  )
}

// ─── Tab Calendario ──────────────────────────────────────────────────────────

function TabCalendario() {
  const [items, setItems] = useState<CalendarioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const hoy = new Date()
        hoy.setHours(0, 0, 0, 0)
        const hasta = addDays(hoy, 90)
        const desdeFacturacion = addDays(hoy, -56)

        const { data: facData, error: facErr } = await supabase
          .from('facturacion_diario')
          .select('fecha, uber_bruto, glovo_bruto, je_bruto, web_bruto, directa_bruto')
          .gte('fecha', toLocalISO(desdeFacturacion))
          .lte('fecha', toLocalISO(hoy))
          .order('fecha', { ascending: true })

        if (facErr) throw facErr

        const { data: gastosData, error: gastosErr } = await supabase
          .from('gastos_fijos')
          .select('*')
          .eq('activo', true)

        if (gastosErr) throw gastosErr

        const rows: FacturacionRow[] = (facData || []) as FacturacionRow[]
        const gastos: GastoFijo[] = (gastosData || []) as GastoFijo[]

        const all = [
          ...calcUberCobros(rows, hoy, hasta),
          ...calcGlovoCobros(rows, hoy, hasta),
          ...calcJECobros(rows, hoy, hasta),
          ...calcGastosPagos(gastos, hoy, hasta),
        ]
        all.sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
        setItems(all)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error cargando datos')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalCobros = items.filter(i => i.tipo === 'COBRO').reduce((s, i) => s + i.importe, 0)
  const totalPagos = items.filter(i => i.tipo === 'PAGO').reduce((s, i) => s + i.importe, 0)
  const balance = totalCobros - totalPagos

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorMsg msg={error} />

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        <KpiCard label="Cobros pendientes" value={fmtEur(totalCobros)} color="#1D9E75" />
        <KpiCard label="Pagos pendientes" value={fmtEur(totalPagos)} color="#B01D23" />
        <KpiCard label="Balance" value={fmtEur(balance)} color={balance >= 0 ? '#1D9E75' : '#B01D23'} />
      </div>

      {items.length === 0 ? (
        <div style={{ color: 'var(--sl-text-muted)', fontSize: 13, textAlign: 'center', padding: 40 }}>
          No hay cobros ni pagos proyectados en los próximos 90 días.
        </div>
      ) : (
        <div style={{ background: 'var(--sl-card)', border: '0.5px solid var(--sl-border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--sl-thead)' }}>
                {['Fecha', 'Tipo', 'Concepto', 'Importe estimado', 'Estado'].map(h => (
                  <th key={h} style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--sl-text-muted)', padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr
                  key={item.id}
                  style={{ borderTop: '0.5px solid var(--sl-border)' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--sl-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--sl-btn-cancel-text)' }}>
                    {item.fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <TipoBadge tipo={item.tipo} />
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--sl-text-primary)' }}>
                    {item.concepto}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--sl-text-primary)', fontFamily: 'Oswald, sans-serif', textAlign: 'right' }}>
                    {fmtEur(item.importe)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, backgroundColor: '#e8f44220', color: '#e8f442', fontFamily: 'Oswald, sans-serif', letterSpacing: 1 }}>
                      PENDIENTE
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Tab Gastos Fijos ────────────────────────────────────────────────────────

const PERIODICIDADES = ['mensual', 'semanal', 'anual', 'trimestral']

interface FormGasto {
  concepto: string
  importe: string
  periodicidad: string
  proxima_fecha_pago: string
}

const emptyForm: FormGasto = {
  concepto: '',
  importe: '',
  periodicidad: 'mensual',
  proxima_fecha_pago: '',
}

function TabGastos() {
  const [gastos, setGastos] = useState<GastoFijo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormGasto>(emptyForm)
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('gastos_fijos')
      .select('*')
      .order('concepto', { ascending: true })
    setGastos((data || []) as GastoFijo[])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function guardar() {
    if (!form.concepto.trim() || !form.importe || !form.proxima_fecha_pago) return
    setSaving(true)
    const payload = {
      concepto: form.concepto.trim(),
      importe: parseFloat(form.importe.replace(',', '.')),
      periodicidad: form.periodicidad,
      proxima_fecha_pago: form.proxima_fecha_pago,
      activo: true,
    }
    let saveError: { message: string } | null = null
    if (editId !== null) {
      const res = await supabase.from('gastos_fijos').update(payload).eq('id', editId)
      saveError = res.error
    } else {
      const res = await supabase.from('gastos_fijos').insert(payload)
      saveError = res.error
    }
    setSaving(false)
    if (saveError) {
      showToast('Error al guardar: ' + saveError.message, false)
    } else {
      showToast(editId !== null ? 'Gasto actualizado' : 'Gasto añadido', true)
      setShowForm(false)
      setForm(emptyForm)
      setEditId(null)
      cargar()
    }
  }

  async function archivar(id: number) {
    const { error } = await supabase.from('gastos_fijos').update({ activo: false }).eq('id', id)
    if (error) showToast('Error al archivar: ' + error.message, false)
    else { showToast('Gasto archivado', true); cargar() }
  }

  function iniciarEdicion(g: GastoFijo) {
    setForm({
      concepto: g.concepto,
      importe: String(g.importe),
      periodicidad: g.periodicidad,
      proxima_fecha_pago: g.proxima_fecha_pago,
    })
    setEditId(g.id)
    setShowForm(true)
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      {toast && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, backgroundColor: toast.ok ? '#1D9E7520' : '#B01D2320', color: toast.ok ? '#1D9E75' : '#B01D23', fontSize: 13, border: `1px solid ${toast.ok ? '#1D9E75' : '#B01D23'}` }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(v => !v) }}
          style={{ fontFamily: 'Oswald, sans-serif', fontSize: 13, letterSpacing: 1, padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', backgroundColor: '#e8f442', color: 'var(--sl-text-primary)' }}
        >
          + AÑADIR GASTO FIJO
        </button>
      </div>

      {showForm && (
        <div style={{ backgroundColor: 'var(--sl-card-alt)', border: '0.5px solid var(--sl-border)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, letterSpacing: 1.5, color: 'var(--sl-btn-cancel-text)', margin: '0 0 16px', textTransform: 'uppercase' }}>
            {editId !== null ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
            <InputField label="Concepto" value={form.concepto} onChange={v => setForm(f => ({ ...f, concepto: v }))} />
            <InputField label="Importe (€)" value={form.importe} onChange={v => setForm(f => ({ ...f, importe: v }))} type="number" />
            <div>
              <label style={{ display: 'block', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: 1, color: 'var(--sl-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Periodicidad</label>
              <select
                value={form.periodicidad}
                onChange={e => setForm(f => ({ ...f, periodicidad: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--sl-input-edit)', border: '0.5px solid var(--sl-border)', borderRadius: 6, color: 'var(--sl-text-primary)', fontSize: 13, fontFamily: 'Lexend, sans-serif' }}
              >
                {PERIODICIDADES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <InputField label="Próximo pago" value={form.proxima_fecha_pago} onChange={v => setForm(f => ({ ...f, proxima_fecha_pago: v }))} type="date" />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setShowForm(false); setForm(emptyForm); setEditId(null) }}
              style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, padding: '8px 16px', borderRadius: 6, border: '0.5px solid var(--sl-btn-cancel-border)', backgroundColor: 'var(--sl-btn-cancel-bg)', color: 'var(--sl-btn-cancel-text)', cursor: 'pointer' }}
            >
              CANCELAR
            </button>
            <button
              onClick={guardar}
              disabled={saving}
              style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, padding: '8px 20px', borderRadius: 6, border: 'none', backgroundColor: '#B01D23', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'GUARDANDO...' : 'GUARDAR'}
            </button>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--sl-card)', border: '0.5px solid var(--sl-border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--sl-thead)' }}>
              {['Concepto', 'Importe', 'Periodicidad', 'Próximo pago', 'Estado', 'Acciones'].map(h => (
                <th key={h} style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--sl-text-muted)', padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gastos.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--sl-text-muted)', fontSize: 13 }}>
                  Sin gastos fijos registrados.
                </td>
              </tr>
            )}
            {gastos.map(g => (
              <tr
                key={g.id}
                style={{ borderTop: '0.5px solid var(--sl-border)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--sl-hover)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--sl-text-primary)' }}>{g.concepto}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--sl-text-primary)', fontFamily: 'Oswald, sans-serif' }}>{fmtEur(g.importe)}</td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--sl-btn-cancel-text)', textTransform: 'capitalize' }}>{g.periodicidad}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--sl-btn-cancel-text)' }}>{fmtDate(g.proxima_fecha_pago)}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, backgroundColor: g.activo ? '#1D9E7520' : '#77777720', color: g.activo ? '#1D9E75' : 'var(--sl-text-muted)', fontFamily: 'Oswald, sans-serif', letterSpacing: 1 }}>
                    {g.activo ? 'ACTIVO' : 'ARCHIVADO'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => iniciarEdicion(g)}
                      style={{ fontSize: 12, fontFamily: 'Oswald, sans-serif', padding: '5px 12px', borderRadius: 6, border: '0.5px solid var(--sl-btn-cancel-border)', backgroundColor: 'var(--sl-btn-cancel-bg)', color: 'var(--sl-btn-cancel-text)', cursor: 'pointer' }}
                    >
                      EDITAR
                    </button>
                    {g.activo && (
                      <button
                        onClick={() => archivar(g.id)}
                        style={{ fontSize: 12, fontFamily: 'Oswald, sans-serif', padding: '5px 12px', borderRadius: 6, border: 'none', backgroundColor: '#B01D2330', color: '#B01D23', cursor: 'pointer' }}
                      >
                        ARCHIVAR
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab Historial ───────────────────────────────────────────────────────────

type FiltroHistorial = 'todos' | 'ingreso' | 'pago'

function TabHistorial() {
  const [movs, setMovs] = useState<HistorialItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<FiltroHistorial>('todos')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const hoy = new Date()
      const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate())
      const { data } = await supabase
        .from('conciliacion')
        .select('id, fecha, concepto, importe, tipo, categoria')
        .gte('fecha', toLocalISO(desde))
        .in('tipo', ['pago', 'ingreso'])
        .order('fecha', { ascending: false })
        .limit(500)
      setMovs((data || []) as HistorialItem[])
      setLoading(false)
    }
    load()
  }, [])

  const filtrados = filtro === 'todos' ? movs : movs.filter(m => m.tipo === filtro)

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {(['todos', 'ingreso', 'pago'] as FiltroHistorial[]).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            style={{
              fontFamily: 'Oswald, sans-serif',
              fontSize: 12,
              letterSpacing: 1,
              padding: '6px 14px',
              borderRadius: 16,
              border: 'none',
              cursor: 'pointer',
              textTransform: 'uppercase',
              backgroundColor: filtro === f ? '#e8f442' : 'var(--sl-card-alt)',
              color: filtro === f ? 'var(--sl-text-primary)' : 'var(--sl-text-secondary)',
            }}
          >
            {f === 'todos' ? 'Todos' : f === 'ingreso' ? 'Ingresos' : 'Pagos'}
          </button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--sl-text-muted)', alignSelf: 'center', marginLeft: 8 }}>
          {filtrados.length} movimiento{filtrados.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ background: 'var(--sl-card)', border: '0.5px solid var(--sl-border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--sl-thead)' }}>
              {['Fecha', 'Concepto', 'Importe', 'Categoría', 'Tipo'].map(h => (
                <th key={h} style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--sl-text-muted)', padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--sl-text-muted)', fontSize: 13 }}>
                  Sin movimientos en el período.
                </td>
              </tr>
            )}
            {filtrados.map(m => (
              <tr
                key={m.id}
                style={{ borderTop: '0.5px solid var(--sl-border)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--sl-hover)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--sl-btn-cancel-text)' }}>{fmtDate(m.fecha)}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--sl-text-primary)' }}>{m.concepto}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'Oswald, sans-serif', color: m.tipo === 'ingreso' ? '#1D9E75' : '#B01D23', textAlign: 'right' }}>
                  {m.tipo === 'pago' ? '-' : '+'}{fmtEur(Math.abs(Number(m.importe)))}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--sl-text-muted)', textTransform: 'capitalize' }}>{m.categoria || '—'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <TipoBadge tipo={m.tipo === 'ingreso' ? 'COBRO' : 'PAGO'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--sl-card)', border: '0.5px solid var(--sl-border)', borderRadius: 12, padding: '20px 24px' }}>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--sl-text-muted)', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  )
}

function TipoBadge({ tipo }: { tipo: 'COBRO' | 'PAGO' }) {
  const isCobro = tipo === 'COBRO'
  return (
    <span style={{
      fontSize: 11,
      padding: '3px 8px',
      borderRadius: 4,
      backgroundColor: isCobro ? '#1D9E7520' : '#B01D2320',
      color: isCobro ? '#1D9E75' : '#B01D23',
      fontFamily: 'Oswald, sans-serif',
      letterSpacing: 1,
    }}>
      {tipo}
    </span>
  )
}

function InputField({ label, value, onChange, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label style={{ display: 'block', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: 1, color: 'var(--sl-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--sl-input-edit)', border: '0.5px solid var(--sl-border)', borderRadius: 6, color: 'var(--sl-text-primary)', fontSize: 13, fontFamily: 'Lexend, sans-serif', boxSizing: 'border-box' }}
      />
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 48, color: 'var(--sl-text-muted)', fontSize: 13 }}>
      Cargando...
    </div>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div style={{ padding: 24, borderRadius: 8, backgroundColor: '#B01D2320', border: '1px solid #B01D23', color: '#B01D23', fontSize: 13 }}>
      Error: {msg}
    </div>
  )
}
