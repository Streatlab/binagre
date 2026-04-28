import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'

interface Empleado {
  id: string
  nombre: string
}

interface Props {
  empleados: Empleado[]
  empleadoPreseleccionado?: string | null
  onClose: () => void
  onSaved: () => void
}

const TIPOS = [
  { value: 'vacaciones', label: 'Vacaciones' },
  { value: 'asuntos_propios', label: 'Asuntos propios' },
  { value: 'baja_medica', label: 'Baja médica' },
  { value: 'permiso_retribuido', label: 'Permiso retribuido' },
  { value: 'otro', label: 'Otro' },
]

export default function ModalSolicitud({ empleados, empleadoPreseleccionado, onClose, onSaved }: Props) {
  const { T, isDark: _isDark } = useTheme()
  const [empleadoId, setEmpleadoId] = useState(empleadoPreseleccionado ?? '')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [tipo, setTipo] = useState<string>('vacaciones')
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!empleadoId) { setError('Selecciona un empleado'); return }
    if (!fechaInicio || !fechaFin) { setError('Las fechas son obligatorias'); return }
    if (fechaFin < fechaInicio) { setError('La fecha fin debe ser posterior a inicio'); return }
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('solicitudes_permisos').insert({
        empleado_id: empleadoId,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tipo,
        estado: 'pendiente',
        nota: nota || null,
      })
      if (err) throw err
      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px',
    background: '#1e1e1e', border: `1px solid ${T.brd}`,
    borderRadius: 6, color: T.pri, fontFamily: FONT.body, fontSize: 13,
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px',
    textTransform: 'uppercase', color: T.mut, marginBottom: 4, display: 'block',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
      <div style={{ backgroundColor: '#1a1a1a', borderRadius: 12, border: `1px solid ${T.brd}`, width: '100%', maxWidth: 460, boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${T.brd}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: FONT.heading, fontSize: 16, letterSpacing: '2px', textTransform: 'uppercase', color: '#B01D23', fontWeight: 600 }}>Solicitar permiso</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.mut }}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Empleado</label>
            <select style={inputStyle} value={empleadoId} onChange={e => setEmpleadoId(e.target.value)} disabled={!!empleadoPreseleccionado}>
              <option value="">Seleccionar empleado…</option>
              {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Fecha inicio</label>
              <input type="date" style={inputStyle} value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Fecha fin</label>
              <input type="date" style={inputStyle} value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Tipo</label>
            <select style={inputStyle} value={tipo} onChange={e => setTipo(e.target.value)}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Nota (opcional)</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }} value={nota} onChange={e => setNota(e.target.value)} placeholder="Descripción adicional…" />
          </div>
          {error && <div style={{ padding: '8px 12px', background: '#B01D2320', color: '#B01D23', borderRadius: 6, fontFamily: FONT.body, fontSize: 13 }}>{error}</div>}
        </div>

        <div style={{ padding: '16px 24px', borderTop: `1px solid ${T.brd}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, border: `1px solid ${T.brd}`, background: '#222222', color: T.pri, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#B01D23', color: '#ffffff', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Enviando…' : 'Solicitar permiso'}
          </button>
        </div>
      </div>
    </div>
  )
}
