import { useEffect, useState, useCallback } from 'react'
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

const PERIODICIDADES: { value: string; label: string }[] = [
  { value: 'semanal_por_marca',   label: 'Semanal × marca' },
  { value: 'quincenal_por_marca', label: 'Quincenal × marca' },
  { value: 'mensual',             label: 'Mensual' },
]

const CICLOS_PAGO: Record<string, string> = {
  'Uber Eats':     'Lunes semanal (lunes a domingo anterior)',
  'Glovo':         '1-15 paga día 5 mes siguiente · 16-fin paga día 20 mes siguiente',
  'Just Eat':      '1-15 paga día 20 mismo mes · 16-fin paga día 5 mes siguiente',
  'Web Propia':    'Pendiente definir',
  'Venta Directa': 'Al día',
}

function getCiclo(nombre: string): string {
  const n = (nombre || '').toLowerCase()
  if (n.includes('uber'))   return CICLOS_PAGO['Uber Eats']
  if (n.includes('glovo'))  return CICLOS_PAGO['Glovo']
  if (n.includes('just') || n.includes('eat')) return CICLOS_PAGO['Just Eat']
  if (n.includes('web'))    return CICLOS_PAGO['Web Propia']
  if (n.includes('direct')) return CICLOS_PAGO['Venta Directa']
  return '—'
}

type EditKey = 'comision_pct' | 'fijo_eur' | 'fee_periodo_eur'

export default function PlataformasPage() {
  const { T, isDark } = useTheme()
  const [canales, setCanales] = useState<Canal[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ id: string; key: EditKey } | null>(null)
  const [editVal, setEditVal] = useState<string>('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const cargar = useCallback(() => {
    setLoading(true)
    supabase.from('config_canales').select('*').order('canal').then(({ data }) => {
      setCanales((data ?? []) as Canal[])
      setLoading(false)
    })
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const notificarCambio = () => {
    invalidarCacheConfigCanales()
    window.dispatchEvent(new CustomEvent('config_canales:changed'))
  }

  const guardarCampo = async (id: string, key: EditKey, raw: string) => {
    const num = parseFloat(raw.replace(',', '.'))
    if (isNaN(num) || num < 0) { setEditing(null); return }
    setSavingId(id)
    const { error } = await supabase.from('config_canales').update({ [key]: num }).eq('id', id)
    if (!error) {
      setCanales(prev => prev.map(c => c.id === id ? { ...c, [key]: num } : c))
      notificarCambio()
    }
    setEditing(null)
    setSavingId(null)
  }

  const guardarPeriodicidad = async (id: string, value: string) => {
    setSavingId(id)
    const { error } = await supabase.from('config_canales').update({ fee_periodicidad: value }).eq('id', id)
    if (!error) {
      setCanales(prev => prev.map(c => c.id === id ? { ...c, fee_periodicidad: value } : c))
      notificarCambio()
    }
    setSavingId(null)
  }

  const toggleActivo = async (id: string, current: boolean) => {
    setSavingId(id)
    const { error } = await supabase.from('config_canales').update({ activo: !current }).eq('id', id)
    if (!error) {
      setCanales(prev => prev.map(c => c.id === id ? { ...c, activo: !current } : c))
      notificarCambio()
    }
    setSavingId(null)
  }

  const startEdit = (id: string, key: EditKey, current: number | null) => {
    setEditing({ id, key })
    setEditVal(current != null ? String(current) : '')
  }

  const renderEditableNum = (
    canal: Canal, key: EditKey, suffix: string, color: string,
  ) => {
    const isEdit = editing?.id === canal.id && editing?.key === key
    const val = canal[key]
    if (isEdit) {
      return (
        <input
          type="number" step="0.01" min="0"
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onBlur={() => guardarCampo(canal.id, key, editVal)}
          onKeyDown={e => {
            if (e.key === 'Enter') guardarCampo(canal.id, key, editVal)
            if (e.key === 'Escape') setEditing(null)
          }}
          autoFocus
          style={{
            fontFamily: FONT.heading, fontSize: 13, color,
            background: isDark ? '#3a4058' : '#fff',
            border: `1px solid ${T.brd}`, borderRadius: 6,
            padding: '3px 6px', width: 90, textAlign: 'right',
          }}
        />
      )
    }
    return (
      <span
        onClick={() => startEdit(canal.id, key, val)}
        style={{
          fontFamily: FONT.heading, fontSize: 13, color,
          cursor: 'pointer', borderBottom: `1px dashed ${T.mut}`,
          paddingBottom: 1,
        }}
        title="Click para editar"
      >
        {val != null ? `${val}${suffix}` : '—'}
      </span>
    )
  }

  return (
    <ConfigShell>
      <ModTitle>Plataformas y canales</ModTitle>
      <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, marginBottom: 20 }}>
        Comisiones, fees y periodicidad por plataforma. Click en cualquier valor para editar.
        Los cambios se reflejan al instante en Panel Global y Facturación.
      </div>

      {loading ? (
        <div style={{ color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
      ) : (
        <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 10, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead>
              <tr style={{ background: '#0a0a0a' }}>
                <th style={th(T)}>Canal</th>
                <th style={{ ...th(T), textAlign: 'right' }}>Comisión %</th>
                <th style={{ ...th(T), textAlign: 'right' }}>Fija/pedido</th>
                <th style={{ ...th(T), textAlign: 'right' }}>Fee periodo</th>
                <th style={th(T)}>Periodicidad</th>
                <th style={th(T)}>Ciclo de pago</th>
                <th style={{ ...th(T), textAlign: 'center' }}>Activo</th>
              </tr>
            </thead>
            <tbody>
              {canales.map(c => (
                <tr key={c.id} style={{ borderTop: `1px solid ${T.brd}`, opacity: savingId === c.id ? 0.6 : 1 }}>
                  <td style={td(T, { fontWeight: 500, color: T.pri })}>{c.canal}</td>
                  <td style={{ ...td(T), textAlign: 'right' }}>
                    {renderEditableNum(c, 'comision_pct', '%', '#e8f442')}
                  </td>
                  <td style={{ ...td(T), textAlign: 'right' }}>
                    {renderEditableNum(c, 'fijo_eur', '€', T.sec)}
                  </td>
                  <td style={{ ...td(T), textAlign: 'right' }}>
                    {renderEditableNum(c, 'fee_periodo_eur', '€', T.sec)}
                  </td>
                  <td style={td(T)}>
                    <select
                      value={c.fee_periodicidad ?? 'mensual'}
                      onChange={e => guardarPeriodicidad(c.id, e.target.value)}
                      style={{
                        background: isDark ? '#3a4058' : '#fff',
                        border: `1px solid ${T.brd}`, borderRadius: 6,
                        padding: '3px 8px', fontFamily: FONT.body, fontSize: 12,
                        color: T.sec, cursor: 'pointer',
                      }}
                    >
                      {PERIODICIDADES.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={td(T, { fontSize: 11, color: T.mut })}>{getCiclo(c.canal)}</td>
                  <td style={{ ...td(T), textAlign: 'center' }}>
                    <button
                      onClick={() => toggleActivo(c.id, c.activo)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 4, display: 'inline-flex', alignItems: 'center',
                      }}
                      title={c.activo ? 'Desactivar' : 'Activar'}
                    >
                      <span style={{
                        display: 'inline-block', width: 10, height: 10,
                        borderRadius: '50%', backgroundColor: c.activo ? '#06C167' : '#555',
                      }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ConfigShell>
  )
}

const th = (T: any) => ({
  fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px',
  textTransform: 'uppercase' as const, color: T.mut,
  padding: '10px 14px', textAlign: 'left' as const,
})

const td = (T: any, extra: React.CSSProperties = {}) => ({
  fontFamily: FONT.body, fontSize: 13, color: T.sec,
  padding: '10px 14px', ...extra,
})
