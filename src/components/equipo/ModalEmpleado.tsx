import { AZUL_CL, BLANCO, GRANATE, INK, LIMA, VERDE, GRIS, AMA, OSW } from '@/styles/neobrutal'
import { useEffect, useState } from 'react'
import { X, Trash2, Upload, FileText as FileIcon, ExternalLink, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, tabActiveStyle, tabInactiveStyle } from '@/styles/tokens'
import { useNominasCompletas } from '@/lib/equipo/useNominasCompletas'
import type { NominaCompleta } from '@/lib/equipo/useNominasCompletas'
import FichaEmpleadoAcumulados from '@/components/equipo/FichaEmpleadoAcumulados'
import { MESES_LARGO, clasifColor, clasifLabel, ModalVerNomina } from '@/components/equipo/NominaSoloLectura'
import { fmtEur } from '@/lib/format'

interface DatosPersonales {
  fecha_nacimiento?: string
  direccion?: string
  telefono?: string
  email?: string
  contrato?: string
  numero_ss?: string
  nacionalidad?: string
  lugar_nacimiento?: string
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
  foto_url?: string | null
  dias_vacaciones_anuales?: number | null
  tipo_relacion?: 'plantilla' | 'extra' | 'socio'
}

interface Vacacion { id: string; fecha_inicio: string; fecha_fin: string; dias: number; estado: string; nota: string | null }
interface Permiso { id: string; tipo: string; fecha_inicio: string; fecha_fin: string | null; dias: number; retribuido: boolean; estado: string; nota: string | null }
interface Anticipo { id: string; fecha: string; importe: number; mes_descuento: string | null; estado: string; nota: string | null }
interface Documento { id: string; tipo: string; nombre: string; url: string | null; fecha: string | null }

interface Props { empleado: Empleado | null; onClose: () => void; onSaved: () => void; tabInicial?: TabKey }

const ESTADOS = ['activo', 'baja', 'vacaciones', 'despedido'] as const
const eur = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0)

function estadoColor(e: string): string {
  if (['aprobada', 'disfrutada', 'pagado', 'activo'].includes(e)) return VERDE
  if (['solicitada', 'solicitado'].includes(e)) return AMA
  if (['rechazada', 'descontado'].includes(e)) return GRIS
  return AZUL_CL
}

type TabKey = 'personales' | 'laborales' | 'foto' | 'nominas' | 'documentos' | 'vacaciones' | 'permisos' | 'anticipos'

export default function ModalEmpleado({ empleado, onClose, onSaved, tabInicial }: Props) {
  const { T, isDark } = useTheme()
  const isNew = !empleado?.id
  const empId = empleado?.id

  const [tab, setTab] = useState<TabKey>(tabInicial ?? 'personales')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [nombre, setNombre] = useState(empleado?.nombre ?? '')
  const [nif, setNif] = useState(empleado?.nif ?? '')
  const [cargo, setCargo] = useState(empleado?.cargo ?? '')
  const [fechaNac, setFechaNac] = useState(empleado?.datos_personales?.fecha_nacimiento ?? '')
  const [direccion, setDireccion] = useState(empleado?.datos_personales?.direccion ?? '')
  const [telefono, setTelefono] = useState(empleado?.datos_personales?.telefono ?? '')
  const [emailEmp, setEmailEmp] = useState(empleado?.datos_personales?.email ?? empleado?.email ?? '')
  const [fotoUrl, setFotoUrl] = useState<string>(empleado?.foto_url ?? '')

  const [fechaAlta, setFechaAlta] = useState(empleado?.fecha_alta ?? '')
  const [estado, setEstado] = useState<typeof ESTADOS[number]>(empleado?.estado ?? 'activo')
  const [salario, setSalario] = useState(empleado?.salario?.toString() ?? '')
  const [iban, setIban] = useState(empleado?.iban ?? '')
  const [contrato, setContrato] = useState(empleado?.datos_personales?.contrato ?? '')
  const [ss, setSs] = useState(empleado?.datos_personales?.numero_ss ?? '')
  const [diasVac, setDiasVac] = useState((empleado?.dias_vacaciones_anuales ?? 30).toString())

  const [vacaciones, setVacaciones] = useState<Vacacion[]>([])
  const [permisos, setPermisos] = useState<Permiso[]>([])
  const [anticipos, setAnticipos] = useState<Anticipo[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [uploading, setUploading] = useState(false)

  async function fetchHijos() {
    if (!empId) return
    const [v, p, a, d] = await Promise.all([
      supabase.from('empleado_vacaciones').select('*').eq('empleado_id', empId).order('fecha_inicio', { ascending: false }),
      supabase.from('empleado_permisos').select('*').eq('empleado_id', empId).order('fecha_inicio', { ascending: false }),
      supabase.from('empleado_anticipos').select('*').eq('empleado_id', empId).order('fecha', { ascending: false }),
      supabase.from('empleado_documentos').select('*').eq('empleado_id', empId).order('fecha', { ascending: false }),
    ])
    setVacaciones((v.data ?? []) as Vacacion[])
    setPermisos((p.data ?? []) as Permiso[])
    setAnticipos((a.data ?? []) as Anticipo[])
    setDocumentos((d.data ?? []) as Documento[])
  }
  useEffect(() => { fetchHijos() }, [empId])

  const anuales = parseFloat(diasVac) || 0
  const vacUsadas = vacaciones.filter(v => ['aprobada', 'disfrutada'].includes(v.estado)).reduce((s, v) => s + Number(v.dias || 0), 0)
  const vacDisfrutadas = vacaciones.filter(v => v.estado === 'disfrutada').reduce((s, v) => s + Number(v.dias || 0), 0)
  const vacRestantes = anuales - vacUsadas
  const anticiposPend = anticipos.filter(a => a.estado !== 'descontado').reduce((s, a) => s + Number(a.importe || 0), 0)

  const antiguedad = (() => {
    if (!fechaAlta) return null
    const diff = Date.now() - new Date(fechaAlta + 'T12:00:00').getTime()
    const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
    const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44))
    if (years > 0) return `${years}a ${months}m`
    return `${months} mes${months !== 1 ? 'es' : ''}`
  })()

  async function subirFoto(file: File) {
    setUploading(true); setError(null)
    try {
      const path = `${empId ?? 'tmp'}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('empleados-fotos').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('empleados-fotos').getPublicUrl(path)
      setFotoUrl(data.publicUrl)
      if (empId) await supabase.from('empleados').update({ foto_url: data.publicUrl }).eq('id', empId)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setUploading(false) }
  }

  async function handleSave() {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError(null)
    try {
      const datosPersonales: DatosPersonales = {
        ...(empleado?.datos_personales ?? {}),
        fecha_nacimiento: fechaNac || undefined, direccion: direccion || undefined,
        telefono: telefono || undefined, email: emailEmp || undefined,
        contrato: contrato || undefined, numero_ss: ss || undefined,
      }
      const payload: Record<string, unknown> = {
        nombre: nombre.trim(), nif: nif.trim() || null, iban: iban.trim() || null,
        salario: salario ? parseFloat(salario) : null, fecha_alta: fechaAlta || null,
        estado, datos_personales: datosPersonales, email: emailEmp || null,
        cargo: cargo.trim() || null, foto_url: fotoUrl || null,
        dias_vacaciones_anuales: parseFloat(diasVac) || 30,
      }
      if (isNew) {
        const { error: err } = await supabase.from('empleados').insert(payload)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('empleados').update(payload).eq('id', empId!)
        if (err) throw err
      }
      onSaved(); onClose()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', background: T.inp, border: `1px solid ${T.brd}`, borderRadius: 0, color: T.pri, fontFamily: FONT.body, fontSize: 13, boxSizing: 'border-box' }
  const calcStyle: React.CSSProperties = { background: `${VERDE}20`, border: `1px solid ${VERDE}`, color: VERDE, padding: '8px 10px', borderRadius: 0, fontFamily: FONT.body, fontSize: 13 }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'personales', label: 'Personales' },
    { key: 'laborales', label: 'Laborales' },
    { key: 'foto', label: 'Foto' },
    { key: 'nominas', label: 'Nóminas' },
    { key: 'documentos', label: 'Documentos' },
    { key: 'vacaciones', label: 'Vacaciones' },
    { key: 'permisos', label: 'Permisos' },
    { key: 'anticipos', label: 'Anticipos' },
  ]

  const initials = nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const needsSave = isNew

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 16, overflowY: 'auto' }}>
      <div onMouseDown={e => e.stopPropagation()} style={{ background: T.card, borderRadius: 0, border: `1px solid ${T.brd}`, width: '100%', maxWidth: 620, margin: '24px 0', boxShadow: '0 24px 48px rgba(0,0,0,0.35)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${T.brd}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, background: GRANATE, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: BLANCO, fontFamily: FONT.heading, fontWeight: 600, fontSize: 18 }}>
              {fotoUrl ? <img src={fotoUrl} alt={nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (initials || '—')}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 16, color: T.pri, fontWeight: 700, lineHeight: 1.2 }}>{nombre || (isNew ? 'Nuevo empleado' : 'Empleado')}</div>
              <div style={{ fontSize: 12, color: T.sec, marginTop: 2 }}>{cargo || '—'}</div>
              {!isNew && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  <Chip color={estadoColor(estado)}>{estado}</Chip>
                  {antiguedad && <Chip color={AZUL_CL}>{antiguedad}</Chip>}
                  <Chip color={vacRestantes < 0 ? GRANATE : VERDE}>{vacRestantes} días vac.</Chip>
                  {anticiposPend > 0 && <Chip color={AMA}>{eur(anticiposPend)} anticipo</Chip>}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.mut, padding: 4 }}><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div style={{ padding: '16px 24px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={tab === t.key ? tabActiveStyle(isDark) : tabInactiveStyle(T)}>{t.label}</button>
          ))}
        </div>

        <div style={{ padding: '20px 24px' }}>
          {tab === 'personales' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Nombre completo *"><input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre y apellidos" /></Field>
              <Field label="NIF / DNI / NIE"><input style={inputStyle} value={nif} onChange={e => setNif(e.target.value)} placeholder="12345678X" /></Field>
              <Field label="Fecha de nacimiento"><input type="date" style={inputStyle} value={fechaNac} onChange={e => setFechaNac(e.target.value)} /></Field>
              <Field label="Dirección"><input style={inputStyle} value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Calle, número, ciudad" /></Field>
              <Field label="Teléfono"><input style={inputStyle} value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+34 600 000 000" /></Field>
              <Field label="Email"><input type="email" style={inputStyle} value={emailEmp} onChange={e => setEmailEmp(e.target.value)} placeholder="empleado@email.com" /></Field>
            </div>
          )}

          {tab === 'laborales' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Cargo / Puesto"><input style={inputStyle} value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ej. Responsable de cocina" /></Field>
              <Field label="Fecha de alta"><input type="date" style={inputStyle} value={fechaAlta} onChange={e => setFechaAlta(e.target.value)} /></Field>
              {fechaAlta && <Field label="Antigüedad (calculada)"><div style={calcStyle}>{antiguedad ?? '—'}</div></Field>}
              <Field label="Estado"><select style={inputStyle} value={estado} onChange={e => setEstado(e.target.value as typeof ESTADOS[number])}>{ESTADOS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}</select></Field>
              <Field label="Salario bruto mensual (€)"><input type="number" step="0.01" style={inputStyle} value={salario} onChange={e => setSalario(e.target.value)} placeholder="Según convenio si vacío" /></Field>
              <Field label="IBAN"><input style={inputStyle} value={iban} onChange={e => setIban(e.target.value)} placeholder="ES00 0000 0000 0000 0000 0000" /></Field>
              <Field label="Tipo de contrato"><input style={inputStyle} value={contrato} onChange={e => setContrato(e.target.value)} placeholder="Indefinido / Temporal / Fijo discontinuo..." /></Field>
              <Field label="Número Seguridad Social"><input style={inputStyle} value={ss} onChange={e => setSs(e.target.value)} placeholder="00/00000000/00" /></Field>
              <Field label="Días de vacaciones al año"><input type="number" style={inputStyle} value={diasVac} onChange={e => setDiasVac(e.target.value)} placeholder="30" /></Field>
            </div>
          )}

          {tab === 'foto' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 120, height: 120, borderRadius: '50%', background: GRANATE, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: BLANCO, fontFamily: FONT.heading, fontSize: 36, fontWeight: 600 }}>
                {fotoUrl ? <img src={fotoUrl} alt={nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (initials || '—')}
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 0, background: LIMA, color: INK, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer' }}>
                <Upload size={14} />{uploading ? 'Subiendo…' : 'Subir foto'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f) }} />
              </label>
              {needsSave && <div style={{ textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 12 }}>Guarda primero el empleado para fijar la foto.</div>}
            </div>
          )}

          {tab === 'nominas' && (
            needsSave ? <SaveFirst T={T} /> : <TabFichaFinanciera empId={empId!} />
          )}

          {tab === 'documentos' && (
            needsSave ? <SaveFirst T={T} /> : (
              <div>
                <AltaDocumento empId={empId!} onSaved={fetchHijos} inputStyle={inputStyle} T={T} setError={setError} />
                <ListaDocumentos T={T} docs={documentos} onDel={async (id) => { await supabase.from('empleado_documentos').delete().eq('id', id); fetchHijos() }} />
              </div>
            )
          )}

          {tab === 'vacaciones' && (
            needsSave ? <SaveFirst T={T} /> : (
              <div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                  <MiniKpi T={T} label="Anuales" value={`${anuales}`} />
                  <MiniKpi T={T} label="Disfrutadas" value={`${vacDisfrutadas}`} />
                  <MiniKpi T={T} label="Aprob.+disfr." value={`${vacUsadas}`} />
                  <MiniKpi T={T} label="Restantes" value={`${vacRestantes}`} accent={vacRestantes < 0 ? GRANATE : VERDE} />
                </div>
                <AltaVacacion empId={empId!} onSaved={fetchHijos} inputStyle={inputStyle} T={T} />
                <ListaHijos T={T} vacios="Sin vacaciones registradas" filas={vacaciones.map(v => ({
                  id: v.id, izq: `${v.fecha_inicio} → ${v.fecha_fin}`, centro: `${v.dias} días`, estado: v.estado, nota: v.nota,
                  onDel: async () => { await supabase.from('empleado_vacaciones').delete().eq('id', v.id); fetchHijos() },
                }))} />
              </div>
            )
          )}

          {tab === 'permisos' && (
            needsSave ? <SaveFirst T={T} /> : (
              <div>
                <AltaPermiso empId={empId!} onSaved={fetchHijos} inputStyle={inputStyle} T={T} />
                <ListaHijos T={T} vacios="Sin permisos registrados" filas={permisos.map(p => ({
                  id: p.id, izq: p.tipo, centro: `${p.dias} día(s)${p.retribuido ? '' : ' · no retrib.'}`, estado: p.estado, nota: p.nota,
                  onDel: async () => { await supabase.from('empleado_permisos').delete().eq('id', p.id); fetchHijos() },
                }))} />
              </div>
            )
          )}

          {tab === 'anticipos' && (
            needsSave ? <SaveFirst T={T} /> : (
              <div>
                <div style={{ marginBottom: 14 }}><MiniKpi T={T} label="Pendiente de descontar" value={eur(anticiposPend)} accent={anticiposPend > 0 ? AMA : T.pri} /></div>
                <AltaAnticipo empId={empId!} onSaved={fetchHijos} inputStyle={inputStyle} T={T} />
                <ListaHijos T={T} vacios="Sin anticipos registrados" filas={anticipos.map(a => ({
                  id: a.id, izq: `${a.fecha}${a.mes_descuento ? ` · desc. ${a.mes_descuento}` : ''}`, centro: eur(Number(a.importe)), estado: a.estado, nota: a.nota,
                  onDel: async () => { await supabase.from('empleado_anticipos').delete().eq('id', a.id); fetchHijos() },
                }))} />
              </div>
            )
          )}

          {error && <div style={{ marginTop: 12, padding: '8px 12px', background: `${GRANATE}20`, color: GRANATE, borderRadius: 0, fontFamily: FONT.body, fontSize: 13 }}>{error}</div>}
        </div>

        <div style={{ padding: '16px 24px', borderTop: `1px solid ${T.brd}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 0, border: `1px solid ${T.brd}`, background: T.inp, color: T.pri, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 0, border: 'none', background: GRANATE, color: BLANCO, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Guardando…' : isNew ? 'Crear empleado' : 'Guardar cambios'}</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { T } = useTheme()
  return <div><label style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 4, display: 'block' }}>{label}</label>{children}</div>
}

function Chip({ children, color }: { children: React.ReactNode; color: string }) {
  return <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 0, fontSize: 11, fontWeight: 600, fontFamily: FONT.body, background: color + '22', color }}>{children}</span>
}

function MiniKpi({ T, label, value, accent }: { T: any; label: string; value: string; accent?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 110, background: T.group, border: `1px solid ${T.brd}`, borderRadius: 0, padding: '10px 12px' }}>
      <div style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 700, color: accent ?? T.pri }}>{value}</div>
    </div>
  )
}

function SaveFirst({ T }: { T: any }) {
  return <div style={{ padding: '24px 0', textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>Guarda primero el empleado para gestionar este apartado.</div>
}

/** Nóminas del año + acumulados reales del empleado (kit Neobrutal Alegre claro,
 *  igual que Nóminas/Costes: aquí manda ese estilo aunque el resto del modal use
 *  el tema T genérico). Reutiliza useNominasCompletas/useFichaEmpleado, no
 *  duplica su lógica. */
function TabFichaFinanciera({ empId }: { empId: string }) {
  const anioActual = new Date().getFullYear()
  const [anio, setAnio] = useState(anioActual)
  const { loading, nominas, reload } = useNominasCompletas(anio)
  const [verNomina, setVerNomina] = useState<NominaCompleta | null>(null)

  const nominasEmp = nominas.filter(n => n.empleado_id === empId).sort((a, b) => a.mes - b.mes)

  return (
    <div>
      <select
        value={anio} onChange={e => setAnio(parseInt(e.target.value))}
        style={{ background: BLANCO, border: `3px solid ${INK}`, color: INK, padding: '6px 10px', fontFamily: OSW, fontSize: 12, fontWeight: 600, marginBottom: 14, cursor: 'pointer', outline: 'none' }}
      >
        {[anioActual - 1, anioActual, anioActual + 1].map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      <FichaEmpleadoAcumulados empleadoId={empId} anio={anio} />

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: GRIS, fontFamily: FONT.body, fontSize: 13 }}>Cargando…</div>
      ) : nominasEmp.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: GRIS, fontFamily: FONT.body, fontSize: 13 }}>Sin nóminas cargadas en {anio}.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {nominasEmp.map(n => (
            <div
              key={n.id} onClick={() => setVerNomina(n)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexWrap: 'wrap',
                border: `2px solid ${INK}`, borderLeft: `6px solid ${clasifColor(n.clasificacion)}`, padding: '8px 12px', background: BLANCO,
              }}
            >
              <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 12, minWidth: 80 }}>{MESES_LARGO[n.mes - 1]}</span>
              <span style={{ fontFamily: FONT.body, fontSize: 12, color: GRIS }}>Neto {fmtEur(n.importe_neto, { decimals: 2 })}</span>
              <span style={{ marginLeft: 'auto', fontFamily: OSW, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: clasifColor(n.clasificacion) }}>{clasifLabel(n.clasificacion)}</span>
              <ChevronRight size={14} color={GRIS} />
            </div>
          ))}
        </div>
      )}

      {verNomina && <ModalVerNomina n={verNomina} onClose={() => setVerNomina(null)} onConfirmado={reload} />}
    </div>
  )
}

function ListaHijos({ T, filas, vacios }: { T: any; vacios: string; filas: { id: string; izq: string; centro: string; estado: string; nota: string | null; onDel: () => void }[] }) {
  if (!filas.length) return <div style={{ padding: '18px 0', textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>{vacios}</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
      {filas.map(f => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: T.group, border: `1px solid ${T.brd}`, borderRadius: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{f.izq} · <span style={{ color: T.sec }}>{f.centro}</span></div>
            {f.nota && <div style={{ fontSize: 11, color: T.mut, marginTop: 2 }}>{f.nota}</div>}
          </div>
          <Chip color={estadoColor(f.estado)}>{f.estado}</Chip>
          <button onClick={f.onDel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRANATE, padding: 4 }}><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  )
}

function ListaDocumentos({ T, docs, onDel }: { T: any; docs: Documento[]; onDel: (id: string) => void }) {
  if (!docs.length) return <div style={{ padding: '18px 0', textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>Sin documentos. Sube el contrato, nóminas, bajas…</div>
  const tipoColor: Record<string, string> = { Contrato: AZUL_CL, 'Nómina': VERDE, Baja: AMA, Otro: GRIS }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
      {docs.map(d => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: T.group, border: `1px solid ${T.brd}`, borderRadius: 0 }}>
          <FileIcon size={16} style={{ color: T.mut, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.nombre}</div>
            <div style={{ fontSize: 11, color: T.mut, marginTop: 2 }}>{d.fecha ?? ''}</div>
          </div>
          <Chip color={tipoColor[d.tipo] ?? GRIS}>{d.tipo}</Chip>
          {d.url && <a href={d.url} target="_blank" rel="noreferrer" style={{ color: AZUL_CL, display: 'flex', padding: 4 }}><ExternalLink size={14} /></a>}
          <button onClick={() => onDel(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRANATE, padding: 4 }}><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  )
}

function AltaDocumento({ empId, onSaved, inputStyle, T, setError }: { empId: string; onSaved: () => void; inputStyle: React.CSSProperties; T: any; setError: (s: string | null) => void }) {
  const [tipo, setTipo] = useState('Contrato')
  const [nombre, setNombre] = useState('')
  const [fecha, setFecha] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  async function subir(file: File) {
    setSubiendo(true); setError(null)
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${empId}/${Date.now()}_${safe}`
      const { error: upErr } = await supabase.storage.from('empleados-docs').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('empleados-docs').getPublicUrl(path)
      await supabase.from('empleado_documentos').insert({ empleado_id: empId, tipo, nombre: nombre.trim() || file.name, url: data.publicUrl, fecha: fecha || new Date().toISOString().slice(0, 10) })
      setNombre(''); setFecha(''); onSaved()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setSubiendo(false) }
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'end' }}>
      <div><label style={lblMini(T)}>Tipo</label><select style={inputStyle} value={tipo} onChange={e => setTipo(e.target.value)}>{['Contrato', 'Nómina', 'Baja', 'Otro'].map(t => <option key={t}>{t}</option>)}</select></div>
      <div><label style={lblMini(T)}>Fecha</label><input type="date" style={inputStyle} value={fecha} onChange={e => setFecha(e.target.value)} /></div>
      <div style={{ gridColumn: '1 / -1' }}><label style={lblMini(T)}>Nombre (opcional)</label><input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Nómina mayo 2026" /></div>
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 0, background: LIMA, color: INK, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer' }}>
          <Upload size={14} />{subiendo ? 'Subiendo…' : 'Subir documento'}
          <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) subir(f) }} />
        </label>
      </div>
    </div>
  )
}

function AltaVacacion({ empId, onSaved, inputStyle, T }: { empId: string; onSaved: () => void; inputStyle: React.CSSProperties; T: any }) {
  const [ini, setIni] = useState(''); const [fin, setFin] = useState(''); const [estado, setEstado] = useState('solicitada'); const [nota, setNota] = useState('')
  const dias = (() => { if (!ini || !fin) return 0; const d = Math.round((new Date(fin).getTime() - new Date(ini).getTime()) / 86400000) + 1; return d > 0 ? d : 0 })()
  async function add() { if (!ini || !fin) return; await supabase.from('empleado_vacaciones').insert({ empleado_id: empId, fecha_inicio: ini, fecha_fin: fin, dias, estado, nota: nota || null }); setIni(''); setFin(''); setNota(''); onSaved() }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
      <div><label style={lblMini(T)}>Desde</label><input type="date" style={inputStyle} value={ini} onChange={e => setIni(e.target.value)} /></div>
      <div><label style={lblMini(T)}>Hasta</label><input type="date" style={inputStyle} value={fin} onChange={e => setFin(e.target.value)} /></div>
      <div><label style={lblMini(T)}>{dias} d</label><select style={inputStyle} value={estado} onChange={e => setEstado(e.target.value)}><option value="solicitada">Solicitada</option><option value="aprobada">Aprobada</option><option value="disfrutada">Disfrutada</option><option value="rechazada">Rechazada</option></select></div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder="Nota (opcional)" value={nota} onChange={e => setNota(e.target.value)} />
        <button onClick={add} style={btnAdd}>Añadir</button>
      </div>
    </div>
  )
}

function AltaPermiso({ empId, onSaved, inputStyle, T }: { empId: string; onSaved: () => void; inputStyle: React.CSSProperties; T: any }) {
  const [tipo, setTipo] = useState('Asuntos propios'); const [ini, setIni] = useState(''); const [fin, setFin] = useState(''); const [dias, setDias] = useState('1'); const [estado, setEstado] = useState('solicitada'); const [retrib, setRetrib] = useState(true); const [nota, setNota] = useState('')
  async function add() { if (!ini) return; await supabase.from('empleado_permisos').insert({ empleado_id: empId, tipo, fecha_inicio: ini, fecha_fin: fin || null, dias: parseFloat(dias) || 1, retribuido: retrib, estado, nota: nota || null }); setIni(''); setFin(''); setNota(''); onSaved() }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'end' }}>
      <div><label style={lblMini(T)}>Tipo</label><select style={inputStyle} value={tipo} onChange={e => setTipo(e.target.value)}>{['Asuntos propios', 'Médico', 'Baja IT', 'Maternidad/Paternidad', 'Mudanza', 'Examen', 'Otro'].map(t => <option key={t}>{t}</option>)}</select></div>
      <div><label style={lblMini(T)}>Estado</label><select style={inputStyle} value={estado} onChange={e => setEstado(e.target.value)}><option value="solicitada">Solicitada</option><option value="aprobada">Aprobada</option><option value="disfrutada">Disfrutada</option><option value="rechazada">Rechazada</option></select></div>
      <div><label style={lblMini(T)}>Desde</label><input type="date" style={inputStyle} value={ini} onChange={e => setIni(e.target.value)} /></div>
      <div><label style={lblMini(T)}>Hasta</label><input type="date" style={inputStyle} value={fin} onChange={e => setFin(e.target.value)} /></div>
      <div><label style={lblMini(T)}>Días</label><input type="number" step="0.5" style={inputStyle} value={dias} onChange={e => setDias(e.target.value)} /></div>
      <div><label style={lblMini(T)}>Retribuido</label><select style={inputStyle} value={retrib ? '1' : '0'} onChange={e => setRetrib(e.target.value === '1')}><option value="1">Sí</option><option value="0">No</option></select></div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder="Nota (opcional)" value={nota} onChange={e => setNota(e.target.value)} />
        <button onClick={add} style={btnAdd}>Añadir</button>
      </div>
    </div>
  )
}

function AltaAnticipo({ empId, onSaved, inputStyle, T }: { empId: string; onSaved: () => void; inputStyle: React.CSSProperties; T: any }) {
  const [fecha, setFecha] = useState(''); const [importe, setImporte] = useState(''); const [mes, setMes] = useState(''); const [estado, setEstado] = useState('solicitado'); const [nota, setNota] = useState('')
  async function add() { if (!importe) return; await supabase.from('empleado_anticipos').insert({ empleado_id: empId, fecha: fecha || new Date().toISOString().slice(0, 10), importe: parseFloat(importe) || 0, mes_descuento: mes || null, estado, nota: nota || null }); setImporte(''); setMes(''); setNota(''); onSaved() }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'end' }}>
      <div><label style={lblMini(T)}>Fecha</label><input type="date" style={inputStyle} value={fecha} onChange={e => setFecha(e.target.value)} /></div>
      <div><label style={lblMini(T)}>Importe (€)</label><input type="number" step="0.01" style={inputStyle} value={importe} onChange={e => setImporte(e.target.value)} placeholder="0.00" /></div>
      <div><label style={lblMini(T)}>Mes de descuento</label><input style={inputStyle} value={mes} onChange={e => setMes(e.target.value)} placeholder="Ej. 2026-07" /></div>
      <div><label style={lblMini(T)}>Estado</label><select style={inputStyle} value={estado} onChange={e => setEstado(e.target.value)}><option value="solicitado">Solicitado</option><option value="pagado">Pagado</option><option value="descontado">Descontado</option></select></div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder="Nota (opcional)" value={nota} onChange={e => setNota(e.target.value)} />
        <button onClick={add} style={btnAdd}>Añadir</button>
      </div>
    </div>
  )
}

const btnAdd: React.CSSProperties = { padding: '8px 16px', borderRadius: 0, border: 'none', background: LIMA, color: INK, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
const lblMini = (T: any): React.CSSProperties => ({ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: T.mut, marginBottom: 3, display: 'block' })
