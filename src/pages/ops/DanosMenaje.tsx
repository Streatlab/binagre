import { BLANCO, GRIS, INK, ROJO_S } from '@/styles/neobrutal'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'
import { toLocalDateStr } from '@/lib/dateRange'
import { COLORS, COLOR } from '@/components/panel/resumen/tokens'


const BG_OPS = INK
interface DanoMenaje {
  id: string
  item: string
  cantidad: number
  coste_unitario: number | null
  coste_total: number | null
  descripcion: string | null
  fecha: string
  created_at: string
}

function fmtEurLocal(n: number | null): string {
  if (n === null) return '—'
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtFecha(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function mesActual(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function DanosMenaje() {
  const [danos, setDanos] = useState<DanoMenaje[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ item: '', cantidad: '1', coste_unitario: '', descripcion: '', fecha: toLocalDateStr(new Date()) })
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase.from('danos_menaje').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false })
      if (e) throw e
      setDanos((data ?? []) as DanoMenaje[])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('42P01') ? 'Tabla danos_menaje no encontrada.' : `Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  async function addDano() {
    if (!form.item.trim()) return
    setSaving(true)
    const cantidad = parseFloat(form.cantidad) || 1
    const costeUnit = form.coste_unitario ? parseFloat(form.coste_unitario) : null
    const costeTotal = costeUnit !== null ? costeUnit * cantidad : null
    const { error: e } = await supabase.from('danos_menaje').insert({
      item: form.item.trim(), cantidad, coste_unitario: costeUnit, coste_total: costeTotal,
      descripcion: form.descripcion || null, fecha: form.fecha,
    })
    if (!e) {
      setForm({ item: '', cantidad: '1', coste_unitario: '', descripcion: '', fecha: toLocalDateStr(new Date()) })
      setShowForm(false)
      await loadData()
    }
    setSaving(false)
  }

  const mes = mesActual()
  const kpiMes = danos.filter(d => d.fecha.startsWith(mes)).reduce((s, d) => s + (d.coste_total ?? 0), 0)
  const kpiTotal = danos.reduce((s, d) => s + (d.coste_total ?? 0), 0)

  return (
    <div style={{ fontFamily: FONT.body, padding: '28px', background: BG_OPS, minHeight: '100vh', color: BLANCO }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '3px', color: COLORS.redSL, fontWeight: 600, textTransform: 'uppercase', margin: '0 0 4px' }}>DAÑOS MENAJE</h1>
          <span style={{ fontSize: 13, color: COLOR.textMut }}>Registro de rotura y pérdida de menaje</span>
        </div>
        <button onClick={() => setShowForm(s => !s)}
          style={{ padding: '8px 18px', background: COLORS.glovo, color: BG_OPS, border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
          + Añadir daño
        </button>
      </div>

      {error && <div style={{ backgroundColor: '#2d1515', border: '1px solid #aa3030', borderRadius: 8, padding: '14px 18px', color: ROJO_S, fontSize: 13, marginBottom: 20 }}>{error}</div>}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div style={{ background: INK, border: '1px solid #2a2a2a', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: COLOR.textMut, marginBottom: 6 }}>Coste Este Mes</div>
          <div style={{ fontFamily: FONT.heading, fontSize: 26, fontWeight: 600, color: COLORS.redSL }}>{fmtEurLocal(kpiMes)}</div>
        </div>
        <div style={{ background: INK, border: '1px solid #2a2a2a', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: COLOR.textMut, marginBottom: 6 }}>Coste Total Histórico</div>
          <div style={{ fontFamily: FONT.heading, fontSize: 26, fontWeight: 600, color: BLANCO }}>{fmtEurLocal(kpiTotal)}</div>
        </div>
      </div>

      {/* Form inline */}
      {showForm && (
        <div style={{ background: INK, border: '1px solid #383838', borderRadius: 10, padding: '20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {[
              { label: 'Ítem', key: 'item', type: 'text', flex: 2 },
              { label: 'Cantidad', key: 'cantidad', type: 'number', flex: 1 },
              { label: 'Coste unitario (€)', key: 'coste_unitario', type: 'number', flex: 1 },
              { label: 'Descripción', key: 'descripcion', type: 'text', flex: 2 },
              { label: 'Fecha', key: 'fecha', type: 'date', flex: 1 },
            ].map(f => (
              <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: f.flex, minWidth: 120 }}>
                <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLOR.textMut }}>{f.label}</label>
                <input type={f.type} value={(form as Record<string, string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ padding: '8px 10px', background: INK, border: '1px solid #2a2a2a', borderRadius: 6, color: BLANCO, fontSize: 13 }} />
              </div>
            ))}
            <button onClick={addDano} disabled={saving}
              style={{ padding: '8px 18px', background: COLORS.redSL, color: BLANCO, border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '8px 14px', background: INK, border: '1px solid #383838', color: GRIS, borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ color: COLOR.textMut, fontSize: 13 }}>Cargando…</div> : (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #2a2a2a' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: INK }}>
                {['Ítem', 'Cantidad', 'Coste Unit.', 'Coste Total', 'Descripción', 'Fecha'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLOR.textMut, fontWeight: 600, borderBottom: '1px solid #2a2a2a', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {danos.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '20px 14px', color: COLOR.textMut, textAlign: 'center' }}>Sin registros aún</td></tr>
              ) : danos.map((d, i) => (
                <tr key={d.id} style={{ background: i % 2 === 0 ? BG_OPS : INK, borderBottom: '1px solid #1e1e1e' }}>
                  <td style={{ padding: '10px 14px', color: BLANCO, fontWeight: 500 }}>{d.item}</td>
                  <td style={{ padding: '10px 14px', color: GRIS }}>{d.cantidad}</td>
                  <td style={{ padding: '10px 14px', color: GRIS }}>{fmtEurLocal(d.coste_unitario)}</td>
                  <td style={{ padding: '10px 14px', color: COLORS.redSL, fontWeight: 600 }}>{fmtEurLocal(d.coste_total)}</td>
                  <td style={{ padding: '10px 14px', color: COLOR.textMut, fontSize: 12 }}>{d.descripcion ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: COLOR.textMut, whiteSpace: 'nowrap' }}>{fmtFecha(d.fecha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
