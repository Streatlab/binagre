import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, tabActiveStyle, tabInactiveStyle } from '@/styles/tokens'

interface DatosPersonales {
  fecha_nacimiento?: string
  direccion?: string
  telefono?: string
  email?: string
  contrato?: string
  numero_ss?: string
}

export interface Empleado {
  id?: string
  nombre: string
  nif: string
  iban: string
  salario: number | null
  fecha_alta: string
  estado: 'activo' | 'baja' | 'vacaciones' | 'despedido'
  datos_personales: DatosPersonales
  drive_folder_id?: string
  cargo?: string
  email?: string
}

interface Props {
  empleado: Empleado | null
  onClose: () => void
  onSaved: () => void
}

const ESTADOS = ['activo', 'baja', 'vacaciones', 'despedido'] as const

export default function ModalEmpleado({ empleado, onClose, onSaved }: Props) {
  const { T, isDark } = useTheme()
  const isNew = !empleado?.id

  const [tab, setTab] = useState<'personales' | 'laborales' | 'documentos'>('personales')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Datos personales
  const [nombre, setNombre] = useState(empleado?.nombre ?? '')
  const [nif, setNif] = useState(empleado?.nif ?? '')
  const [fechaNac, setFechaNac] = useState(empleado?.datos_personales?.fecha_nacimiento ?? '')
  const [direccion, setDireccion] = useState(empleado?.datos_personales?.direccion ?? '')
  const [telefono, setTelefono] = useState(empleado?.datos_personales?.telefono ?? '')
  const [emailEmp, setEmailEmp] = useState(empleado?.datos_personales?.email ?? empleado?.email ?? '')

  // Datos laborales
  const [fechaAlta, setFechaAlta] = useState(empleado?.fecha_alta ?? '')
  const [estado, setEstado] = useState<typeof ESTADOS[number]>(empleado?.estado ?? 'activo')
  const [salario, setSalario] = useState(empleado?.salario?.toString() ?? '')
  const [iban, setIban] = useState(empleado?.iban ?? '')
  const [contrato, setContrato] = useState(empleado?.datos_personales?.contrato ?? '')
  const [ss, setSs] = useState(empleado?.datos_personales?.numero_ss ?? '')

  // Antigüedad calculada
  const antiguedad = (() => {
    if (!fechaAlta) return null
    const diff = Date.now() - new Date(fechaAlta + 'T12:00:00').getTime()
    const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
    const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44))
    if (years > 0) return `${years} año${years > 1 ? 's' : ''} ${months} mes${months !== 1 ? 'es' : ''}`
    return `${months} mes${months !== 1 ? 'es' : ''}`
  })()

  async function handleSave() {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    setError(null)
    try {
      const datosPersonales: DatosPersonales = {
        fecha_nacimiento: fechaNac || undefined,
        direccion: direccion || undefined,
        telefono: telefono || undefined,
        email: emailEmp || undefined,
        contrato: contrato || undefined,
        numero_ss: ss || undefined,
      }
      const payload: Record<string, unknown> = {
        nombre: nombre.trim(),
        nif: nif.trim() || null,
        iban: iban.trim() || null,
        salario: salario ? parseFloat(salario) : null,
        fecha_alta: fechaAlta || null,
        estado,
        datos_personales: datosPersonales,
        email: emailEmp || null,
        cargo: contrato || null,
      }

      let savedId = empleado?.id

      if (isNew) {
        const { data, error: err } = await supabase.from('empleados').insert(payload).select('id').single()
        if (err) throw err
        savedId = data.id

        // DECISIÓN AUTÓNOMA: crear carpeta Drive es un stub si la API no tiene write scope
        // TODO: implementar Drive folder creation cuando Google OAuth tenga scope drive.file
        // Por ahora se guarda drive_folder_id=null y se muestra instrucción al usuario
        console.log('[ModalEmpleado] Drive folder creation: TODO - requires drive.file OAuth scope')
      } else {
        const { error: err } = await supabase.from('empleados').update(payload).eq('id', empleado!.id!)
        if (err) throw err
      }

      console.log('[ModalEmpleado] Saved empleado', savedId)
      onSaved()
      onClose()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    background: '#1e1e1e',
    border: `1px solid ${T.brd}`,
    borderRadius: 6,
    color: T.pri,
    fontFamily: FONT.body,
    fontSize: 13,
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: T.mut,
    marginBottom: 4,
    display: 'block',
  }

  const calcStyle: React.CSSProperties = {
    backgroundColor: '#2d1515',
    border: '1px solid #aa3030',
    color: '#ffaaaa',
    padding: '8px 10px',
    borderRadius: 6,
    fontFamily: FONT.body,
    fontSize: 13,
  }

  const tabs: { key: 'personales' | 'laborales' | 'documentos'; label: string }[] = [
    { key: 'personales', label: 'Datos personales' },
    { key: 'laborales', label: 'Datos laborales' },
    { key: 'documentos', label: 'Documentos' },
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: 12, border: `1px solid ${T.brd}`,
        width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${T.brd}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: FONT.heading, fontSize: 16, letterSpacing: '2px', textTransform: 'uppercase', color: '#B01D23', fontWeight: 600 }}>
            {isNew ? 'Nuevo empleado' : 'Editar empleado'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.mut, padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs internas */}
        <div style={{ padding: '16px 24px 0', display: 'flex', gap: 8 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={tab === t.key ? tabActiveStyle(isDark) : tabInactiveStyle(T)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px' }}>
          {tab === 'personales' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nombre completo *</label>
                <input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre y apellidos" />
              </div>
              <div>
                <label style={labelStyle}>NIF / DNI</label>
                <input style={inputStyle} value={nif} onChange={e => setNif(e.target.value)} placeholder="12345678X" />
              </div>
              <div>
                <label style={labelStyle}>Fecha de nacimiento</label>
                <input type="date" style={inputStyle} value={fechaNac} onChange={e => setFechaNac(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Dirección</label>
                <input style={inputStyle} value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Calle, número, ciudad" />
              </div>
              <div>
                <label style={labelStyle}>Teléfono</label>
                <input style={inputStyle} value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+34 600 000 000" />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" style={inputStyle} value={emailEmp} onChange={e => setEmailEmp(e.target.value)} placeholder="empleado@email.com" />
              </div>
            </div>
          )}

          {tab === 'laborales' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Fecha de alta</label>
                <input type="date" style={inputStyle} value={fechaAlta} onChange={e => setFechaAlta(e.target.value)} />
              </div>
              {fechaAlta && (
                <div>
                  <label style={labelStyle}>Antigüedad (calculada)</label>
                  <div style={calcStyle}>{antiguedad ?? '—'}</div>
                </div>
              )}
              <div>
                <label style={labelStyle}>Estado</label>
                <select style={inputStyle} value={estado} onChange={e => setEstado(e.target.value as typeof ESTADOS[number])}>
                  {ESTADOS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Salario bruto mensual (€)</label>
                <input type="number" step="0.01" style={inputStyle} value={salario} onChange={e => setSalario(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label style={labelStyle}>IBAN</label>
                <input style={inputStyle} value={iban} onChange={e => setIban(e.target.value)} placeholder="ES00 0000 0000 0000 0000 0000" />
              </div>
              <div>
                <label style={labelStyle}>Tipo de contrato</label>
                <input style={inputStyle} value={contrato} onChange={e => setContrato(e.target.value)} placeholder="Indefinido / Temporal / Obra..." />
              </div>
              <div>
                <label style={labelStyle}>Número Seguridad Social</label>
                <input style={inputStyle} value={ss} onChange={e => setSs(e.target.value)} placeholder="28/00000000/00" />
              </div>
            </div>
          )}

          {tab === 'documentos' && (
            <div style={{ padding: '16px 0', textAlign: 'center' }}>
              <div style={{ color: T.mut, fontFamily: FONT.body, fontSize: 13, lineHeight: 1.6 }}>
                <p style={{ marginBottom: 12 }}>Los documentos (contrato, nóminas, bajas) se almacenan en Google Drive.</p>
                <p style={{ marginBottom: 12, color: '#e8f442' }}>
                  Carpeta: <code style={{ background: '#1e1e1e', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>
                    Equipo/{nif || 'NIF'}_{nombre.replace(/\s+/g, '_') || 'Nombre'}
                  </code>
                </p>
                <p style={{ color: T.mut, fontSize: 12 }}>
                  TODO: La creación automática de carpeta Drive requiere OAuth scope drive.file.<br />
                  Crear manualmente en Drive y actualizar el campo drive_folder_id.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#B01D2320', color: '#B01D23', borderRadius: 6, fontFamily: FONT.body, fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${T.brd}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 6, border: `1px solid ${T.brd}`, background: '#222222', color: T.pri, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#B01D23', color: '#ffffff', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Guardando…' : isNew ? 'Crear empleado' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
