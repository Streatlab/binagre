import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { fmtEur } from '@/utils/format'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'

export default function ProvisionesPanel() {
  const { T } = useTheme()
  const [base, setBase] = useState<string>('850')
  const [pct, setPct] = useState<string>('19')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null)
  const [provHist, setProvHist] = useState<{ tipo: string; count: number; total: number; pendiente: number }[]>([])

  async function refetch() {
    setLoading(true)
    const [cfg, hist] = await Promise.all([
      supabase.from('configuracion').select('clave, valor').in('clave', ['alquiler_base_mensual', 'alquiler_irpf_pct']),
      supabase.from('provisiones').select('tipo, importe, estado'),
    ])
    for (const r of (cfg.data ?? []) as { clave: string; valor: string }[]) {
      if (r.clave === 'alquiler_base_mensual') setBase(r.valor)
      if (r.clave === 'alquiler_irpf_pct') setPct(r.valor)
    }
    const porTipo = new Map<string, { count: number; total: number; pendiente: number }>()
    for (const p of (hist.data ?? []) as { tipo: string; importe: number; estado: string }[]) {
      const acc = porTipo.get(p.tipo) ?? { count: 0, total: 0, pendiente: 0 }
      acc.count += 1
      acc.total += Number(p.importe) || 0
      if (p.estado === 'pendiente') acc.pendiente += Number(p.importe) || 0
      porTipo.set(p.tipo, acc)
    }
    setProvHist(Array.from(porTipo.entries()).map(([tipo, v]) => ({ tipo, ...v })))
    setLoading(false)
  }

  useEffect(() => { refetch() }, [])

  async function guardar() {
    const nBase = parseFloat(base.replace(',', '.'))
    const nPct = parseFloat(pct.replace(',', '.'))
    if (!Number.isFinite(nBase) || nBase < 0 || !Number.isFinite(nPct) || nPct < 0) {
      setMsg({ tipo: 'err', texto: 'Valores no válidos' }); return
    }
    setSaving(true); setMsg(null)
    const ups = [
      supabase.from('configuracion').upsert({ clave: 'alquiler_base_mensual', valor: String(nBase) }, { onConflict: 'clave' }),
      supabase.from('configuracion').upsert({ clave: 'alquiler_irpf_pct', valor: String(nPct) }, { onConflict: 'clave' }),
    ]
    const results = await Promise.all(ups)
    for (const r of results) {
      if (r.error) { setMsg({ tipo: 'err', texto: r.error.message }); setSaving(false); return }
    }
    setMsg({ tipo: 'ok', texto: 'Configuración guardada' })
    setSaving(false)
    setTimeout(() => setMsg(null), 2500)
  }

  async function recalcular() {
    setSaving(true); setMsg(null)
    // Regenerar provisiones IVA e IRPF de los periodos conocidos
    const trimestres: string[] = [
      '2023-Q3','2023-Q4',
      '2024-Q1','2024-Q2','2024-Q3','2024-Q4',
      '2025-Q1','2025-Q2','2025-Q3','2025-Q4',
      '2026-Q1','2026-Q2',
    ]
    for (const q of trimestres) {
      const { error } = await supabase.rpc('calcular_iva_trimestral', { p_periodo: q })
      if (error) { setMsg({ tipo: 'err', texto: error.message }); setSaving(false); return }
    }
    // IRPF desde julio 2023 hasta mes actual
    const desde = new Date(2023, 6, 1)
    const hoy = new Date()
    const cur = new Date(desde)
    while (cur <= hoy) {
      const periodo = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
      const { error } = await supabase.rpc('calcular_irpf_alquiler_mes', { p_periodo: periodo })
      if (error) { setMsg({ tipo: 'err', texto: error.message }); setSaving(false); return }
      cur.setMonth(cur.getMonth() + 1)
    }
    setMsg({ tipo: 'ok', texto: 'Provisiones recalculadas' })
    setSaving(false)
    await refetch()
    setTimeout(() => setMsg(null), 3000)
  }

  const nBase = parseFloat(base.replace(',', '.')) || 0
  const nPct = parseFloat(pct.replace(',', '.')) || 0
  const retencionMensual = nBase * (nPct / 100)

  const label: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: T.mut, marginBottom: 4, fontWeight: 500,
  }
  const input: CSSProperties = {
    width: 120, padding: '7px 10px', background: T.inp, color: T.pri,
    border: `1px solid ${T.brd}`, borderRadius: 6, fontFamily: FONT.body, fontSize: 13,
    outline: 'none',
  }
  const btnPrimary: CSSProperties = {
    padding: '8px 16px', borderRadius: 6, border: 'none',
    background: '#B01D23', color: '#fff',
    fontFamily: FONT.heading, fontSize: 11, letterSpacing: 1,
    textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer',
  }
  const btnGhost: CSSProperties = {
    padding: '8px 16px', borderRadius: 6, border: `0.5px solid ${T.brd}`,
    background: T.card, color: T.pri,
    fontFamily: FONT.heading, fontSize: 11, letterSpacing: 1,
    textTransform: 'uppercase', fontWeight: 500, cursor: 'pointer',
  }

  return (
    <>
      <ConfigGroupCard title="Provisiones automáticas" subtitle="IRPF alquiler mensual">
        <div style={{ padding: '14px 22px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <div>
            <div style={label}>Alquiler base mensual</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input value={base} onChange={e => setBase(e.target.value)} inputMode="decimal" style={input} />
              <span style={{ color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>€</span>
            </div>
          </div>
          <div>
            <div style={label}>Retención IRPF</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input value={pct} onChange={e => setPct(e.target.value)} inputMode="decimal" style={input} />
              <span style={{ color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>%</span>
            </div>
          </div>
          <div>
            <div style={label}>Provisión mensual</div>
            <div style={{ fontFamily: FONT.heading, fontSize: 24, fontWeight: 500, color: T.pri, letterSpacing: '-0.01em' }}>
              {fmtEur(retencionMensual)}
            </div>
          </div>
        </div>
        <div style={{ padding: '0 22px 18px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={guardar} disabled={saving || loading} style={btnPrimary}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button onClick={recalcular} disabled={saving || loading} style={btnGhost}>
            Recalcular provisiones históricas
          </button>
          {msg && (
            <span style={{
              fontFamily: FONT.body, fontSize: 12,
              color: msg.tipo === 'ok' ? '#06C167' : '#B01D23',
            }}>
              {msg.texto}
            </span>
          )}
        </div>
      </ConfigGroupCard>

      <div style={{ height: 14 }} />

      <ConfigGroupCard title="Resumen provisiones" subtitle={loading ? 'cargando…' : `${provHist.reduce((a, b) => a + b.count, 0)} registros`}>
        <div style={{ padding: '12px 22px 18px' }}>
          {provHist.length === 0 ? (
            <div style={{ color: T.mut, fontFamily: FONT.body, fontSize: 13, padding: 12 }}>Sin provisiones</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontFamily: FONT.heading, fontSize: 10, color: T.mut, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 500, borderBottom: `1px solid ${T.brd}` }}>Tipo</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontFamily: FONT.heading, fontSize: 10, color: T.mut, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 500, borderBottom: `1px solid ${T.brd}` }}>Registros</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontFamily: FONT.heading, fontSize: 10, color: T.mut, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 500, borderBottom: `1px solid ${T.brd}` }}>Total</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontFamily: FONT.heading, fontSize: 10, color: T.mut, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 500, borderBottom: `1px solid ${T.brd}` }}>Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {provHist.map(p => (
                  <tr key={p.tipo}>
                    <td style={{ padding: '8px', fontFamily: FONT.body, fontSize: 13, color: T.pri, borderBottom: `0.5px solid ${T.brd}` }}>
                      {p.tipo === 'IVA_TRIM' ? 'IVA trimestral' : p.tipo === 'IRPF_ALQ' ? 'IRPF alquiler mensual' : p.tipo}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: FONT.body, fontSize: 13, color: T.pri, borderBottom: `0.5px solid ${T.brd}`, fontVariantNumeric: 'tabular-nums' }}>
                      {p.count}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: FONT.heading, fontSize: 13, color: T.pri, fontWeight: 500, borderBottom: `0.5px solid ${T.brd}`, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtEur(p.total)}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: FONT.heading, fontSize: 13, color: '#B01D23', fontWeight: 500, borderBottom: `0.5px solid ${T.brd}`, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtEur(p.pendiente)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </ConfigGroupCard>
    </>
  )
}
