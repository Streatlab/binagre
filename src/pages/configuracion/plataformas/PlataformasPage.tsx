import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { ConfigShell } from '@/components/configuracion/ConfigShell'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { useTheme, FONT } from '@/styles/tokens'
import { invalidarCacheConfigCanales } from '@/lib/panel/calcNetoPlataforma'

interface Canal {
  id: string
  canal: string
  comision_pct: number | null
  fijo_eur: number | null
  fee_periodo_eur: number | null
  fee_periodicidad: string | null
  activo: boolean
}

const PERIODICIDAD_OPCIONES = [
  { value: 'mensual',              label: 'Mensual' },
  { value: 'semanal_por_marca',    label: 'Semanal × marca' },
  { value: 'quincenal_por_marca',  label: 'Quincenal × marca' },
]

const CICLOS_PAGO: Record<string, string> = {
  'uber':  'Lunes semanal (lun a dom anterior)',
  'glovo': '1-15 paga día 5 mes sig · 16-fin paga día 20 mes sig',
  'just':  '1-15 paga día 20 mismo mes · 16-fin paga día 5 mes sig',
  'web':   'Pendiente definir',
  'direct':'Al día',
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

type EditCol = 'comision_pct' | 'fijo_eur' | 'fee_periodo_eur' | 'fee_periodicidad'

export default function PlataformasPage() {
  const { T } = useTheme()
  const [canales, setCanales] = useState<Canal[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ id: string; col: EditCol } | null>(null)
  const [editVal, setEditVal] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('config_canales').select('*').order('canal')
    setCanales((data ?? []) as Canal[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const notificarCambio = () => {
    invalidarCacheConfigCanales()
    // Emite ambos nombres por compatibilidad (TabResumen escucha :changed, Facturación _updated)
    window.dispatchEvent(new CustomEvent('config_canales:changed'))
    window.dispatchEvent(new CustomEvent('config_canales_updated'))
  }

  const guardar = async (id: string, col: EditCol, raw: string) => {
    setSaving(true)
    let value: any
    if (col === 'fee_periodicidad') {
      value = raw
    } else {
      const num = parseFloat(raw.replace(',', '.'))
      if (isNaN(num) || num < 0) { setEditing(null); setSaving(false); return }
      value = col === 'comision_pct' ? num / 100 : num
    }
    const { error } = await supabase.from('config_canales').update({ [col]: value }).eq('id', id)
    setSaving(false)
    if (error) { alert(`Error: ${error.message}`); return }
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

  const startEdit = (id: string, col: EditCol, current: any) => {
    setEditing({ id, col })
    if (col === 'comision_pct') setEditVal(current != null ? String(Math.round(current * 10000) / 100) : '0')
    else if (col === 'fee_periodicidad') setEditVal(current ?? 'mensual')
    else setEditVal(current != null ? String(current) : '0')
  }

  const cellEditable: CSSProperties = {
    cursor: 'pointer',
    borderBottom: `1px dashed ${T.mut}`,
    paddingBottom: 1,
  }

  const inp: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 13, fontWeight: 600,
    background: '#fff', color: '#111',
    border: `1px solid ${T.brd}`, borderRadius: 6,
    padding: '3px 8px', width: 90, textAlign: 'right',
  }

  return (
    <ConfigShell>
      <ModTitle>Plataformas y canales</ModTitle>
      <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, marginBottom: 20 }}>
        Comisiones y fees por canal. Los cambios se aplican al instante en Panel Global, Facturación y resto de paneles.
      </div>

      {loading ? (
        <div style={{ color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
      ) : (
        <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 10, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
            <thead>
              <tr style={{ background: '#0a0a0a' }}>
                {['Canal','Comisión %','Fijo / pedido','Fee periodo €','Periodicidad','Ciclo de pago','Activo'].map((h, i) => (
                  <th key={h} style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '10px 14px', textAlign: i===0||i===5 ? 'left' : i===6 ? 'center' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {canales.map(c => {
                const isPctEdit = editing?.id === c.id && editing.col === 'comision_pct'
                const isFijoEdit = editing?.id === c.id && editing.col === 'fijo_eur'
                const isFeeEdit = editing?.id === c.id && editing.col === 'fee_periodo_eur'
                const isPerEdit = editing?.id === c.id && editing.col === 'fee_periodicidad'
                const justSaved = savedId === c.id
                return (
                  <tr key={c.id} style={{ borderTop: `1px solid ${T.brd}`, background: justSaved ? '#1D9E7518' : 'transparent' }}>
                    <td style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, padding: '12px 14px', fontWeight: 500 }}>{c.canal}</td>

                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      {isPctEdit ? (
                        <input type="number" step="0.01" autoFocus value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => guardar(c.id, 'comision_pct', editVal)}
                          onKeyDown={e => { if (e.key === 'Enter') guardar(c.id, 'comision_pct', editVal); if (e.key === 'Escape') setEditing(null) }}
                          style={inp} />
                      ) : (
                        <span onClick={() => startEdit(c.id, 'comision_pct', c.comision_pct)}
                              style={{ ...cellEditable, fontFamily: FONT.heading, fontSize: 13, color: '#e8f442' }}>
                          {c.comision_pct != null ? `${(c.comision_pct * 100).toFixed(2).replace(/\.?0+$/, '')}%` : '—'}
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      {isFijoEdit ? (
                        <input type="number" step="0.01" autoFocus value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => guardar(c.id, 'fijo_eur', editVal)}
                          onKeyDown={e => { if (e.key === 'Enter') guardar(c.id, 'fijo_eur', editVal); if (e.key === 'Escape') setEditing(null) }}
                          style={inp} />
                      ) : (
                        <span onClick={() => startEdit(c.id, 'fijo_eur', c.fijo_eur)}
                              style={{ ...cellEditable, fontFamily: FONT.heading, fontSize: 13, color: T.sec }}>
                          {c.fijo_eur != null ? `${Number(c.fijo_eur).toFixed(2)}€` : '—'}
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      {isFeeEdit ? (
                        <input type="number" step="0.01" autoFocus value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => guardar(c.id, 'fee_periodo_eur', editVal)}
                          onKeyDown={e => { if (e.key === 'Enter') guardar(c.id, 'fee_periodo_eur', editVal); if (e.key === 'Escape') setEditing(null) }}
                          style={inp} />
                      ) : (
                        <span onClick={() => startEdit(c.id, 'fee_periodo_eur', c.fee_periodo_eur)}
                              style={{ ...cellEditable, fontFamily: FONT.heading, fontSize: 13, color: T.sec }}>
                          {c.fee_periodo_eur != null && Number(c.fee_periodo_eur) > 0 ? `${Number(c.fee_periodo_eur).toFixed(2)}€` : '—'}
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      {isPerEdit ? (
                        <select autoFocus value={editVal}
                          onChange={e => { setEditVal(e.target.value); guardar(c.id, 'fee_periodicidad', e.target.value) }}
                          onBlur={() => setEditing(null)}
                          style={{ ...inp, width: 170, textAlign: 'left' }}>
                          {PERIODICIDAD_OPCIONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <span onClick={() => startEdit(c.id, 'fee_periodicidad', c.fee_periodicidad)}
                              style={{ ...cellEditable, fontFamily: FONT.body, fontSize: 12, color: T.sec }}>
                          {PERIODICIDAD_OPCIONES.find(o => o.value === c.fee_periodicidad)?.label ?? (c.fee_periodicidad || '—')}
                        </span>
                      )}
                    </td>

                    <td style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, padding: '12px 14px' }}>{getCiclo(c.canal)}</td>

                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <button onClick={() => toggleActivo(c.id, c.activo)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: c.activo ? '#06C167' : '#555' }} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 14, fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
        {saving ? 'Guardando…' : 'Click en cualquier valor para editarlo. Enter para guardar, Esc para cancelar.'}
      </div>
    </ConfigShell>
  )
}
