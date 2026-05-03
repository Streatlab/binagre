/**
 * Módulo Informes — Gestión de destinatarios
 *
 * Permite añadir, editar y desactivar quién recibe cada tipo de informe
 * y por qué canal (WhatsApp / Email).
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'

interface Destinatario {
  id: string
  nombre: string
  whatsapp: string | null
  email: string | null
  recibe_cierre_diario: boolean
  recibe_cobros_lunes: boolean
  recibe_cierre_semanal: boolean
  recibe_cierre_mensual: boolean
  canal_whatsapp: boolean
  canal_email: boolean
  activo: boolean
}

const NUEVO_VACIO: Omit<Destinatario, 'id'> = {
  nombre: '',
  whatsapp: '',
  email: '',
  recibe_cierre_diario: true,
  recibe_cobros_lunes: true,
  recibe_cierre_semanal: true,
  recibe_cierre_mensual: true,
  canal_whatsapp: true,
  canal_email: true,
  activo: true,
}

export default function Destinatarios() {
  const { T } = useTheme()
  const [lista, setLista] = useState<Destinatario[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<Destinatario | null>(null)
  const [creando, setCreando] = useState<Omit<Destinatario, 'id'> | null>(null)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('notif_destinatarios')
      .select('*')
      .order('nombre')
    setLista(data || [])
    setLoading(false)
  }

  async function guardar(d: Destinatario | (Omit<Destinatario, 'id'> & { id?: string })) {
    if (!d.nombre?.trim()) {
      alert('El nombre es obligatorio')
      return
    }
    if (!d.whatsapp && !d.email) {
      alert('Debe tener al menos WhatsApp o Email')
      return
    }
    const payload = {
      nombre: d.nombre,
      whatsapp: d.whatsapp || null,
      email: d.email || null,
      recibe_cierre_diario: d.recibe_cierre_diario,
      recibe_cobros_lunes: d.recibe_cobros_lunes,
      recibe_cierre_semanal: d.recibe_cierre_semanal,
      recibe_cierre_mensual: d.recibe_cierre_mensual,
      canal_whatsapp: d.canal_whatsapp,
      canal_email: d.canal_email,
      activo: d.activo,
      updated_at: new Date().toISOString(),
    }
    if ('id' in d && d.id) {
      await supabase.from('notif_destinatarios').update(payload).eq('id', d.id)
    } else {
      await supabase.from('notif_destinatarios').insert(payload)
    }
    setEditando(null)
    setCreando(null)
    cargar()
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este destinatario? Su historial se mantiene.')) return
    await supabase.from('notif_destinatarios').delete().eq('id', id)
    cargar()
  }

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto', fontFamily: FONT.body }}>
      <header style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: FONT.heading, fontSize: 28, color: T.pri, margin: 0 }}>
            👥 Destinatarios de informes
          </h1>
          <p style={{ color: T.sec, marginTop: 6, fontSize: 14 }}>
            Quién recibe cada tipo de informe y por qué canal.
          </p>
        </div>
        <button
          onClick={() => setCreando(NUEVO_VACIO)}
          style={{
            background: '#B01D23', color: '#fff', border: 'none', borderRadius: 8,
            padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            fontFamily: FONT.heading, letterSpacing: '0.05em',
          }}
        >
          + Añadir destinatario
        </button>
      </header>

      {loading && <div style={{ color: T.mut }}>Cargando...</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {lista.map(d => (
          <div
            key={d.id}
            style={{
              background: T.card,
              border: `1px solid ${d.activo ? T.brd : T.mut}`,
              borderRadius: 12,
              padding: 16,
              opacity: d.activo ? 1 : 0.55,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontFamily: FONT.heading, fontSize: 18, color: T.pri, margin: 0, marginBottom: 8 }}>
                  {d.nombre}
                  {!d.activo && <span style={{ marginLeft: 8, fontSize: 11, color: T.mut, fontWeight: 400 }}>(inactivo)</span>}
                </h3>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: T.sec, flexWrap: 'wrap', marginBottom: 8 }}>
                  {d.whatsapp && <span>💬 {d.whatsapp}</span>}
                  {d.email && <span>📧 {d.email}</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {d.recibe_cierre_diario && <Pill T={T} label="📅 Diario" />}
                  {d.recibe_cobros_lunes && <Pill T={T} label="💰 Cobros" />}
                  {d.recibe_cierre_semanal && <Pill T={T} label="📊 Semanal" />}
                  {d.recibe_cierre_mensual && <Pill T={T} label="📈 Mensual" />}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setEditando(d)}
                  style={{ background: T.group, color: T.pri, border: `1px solid ${T.brd}`, borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}
                >
                  ✏️ Editar
                </button>
                <button
                  onClick={() => eliminar(d.id)}
                  style={{ background: 'transparent', color: '#B01D23', border: `1px solid #B01D23`, borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}
                >
                  🗑
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(editando || creando) && (
        <Modal
          T={T}
          dest={editando || (creando as Destinatario)}
          esNuevo={!!creando}
          onClose={() => { setEditando(null); setCreando(null) }}
          onSave={guardar}
        />
      )}
    </div>
  )
}

function Pill({ T, label }: { T: ReturnType<typeof useTheme>['T']; label: string }) {
  return (
    <span style={{
      background: T.group, color: T.sec, padding: '3px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 500,
    }}>{label}</span>
  )
}

function Modal({
  T, dest, esNuevo, onClose, onSave,
}: {
  T: ReturnType<typeof useTheme>['T']
  dest: Destinatario | (Omit<Destinatario, 'id'> & { id?: string })
  esNuevo: boolean
  onClose: () => void
  onSave: (d: Destinatario | (Omit<Destinatario, 'id'> & { id?: string })) => void
}) {
  const [form, setForm] = useState(dest)
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 540,
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <h2 style={{ fontFamily: FONT.heading, fontSize: 22, color: T.pri, marginTop: 0, marginBottom: 18 }}>
          {esNuevo ? 'Nuevo destinatario' : 'Editar destinatario'}
        </h2>

        <Field T={T} label="Nombre">
          <input
            value={form.nombre}
            onChange={e => set('nombre', e.target.value)}
            style={inputStyle(T)}
            placeholder="ej: Rubén"
          />
        </Field>

        <Field T={T} label="WhatsApp (con prefijo +34)">
          <input
            value={form.whatsapp || ''}
            onChange={e => set('whatsapp', e.target.value)}
            style={inputStyle(T)}
            placeholder="+34647651051"
          />
        </Field>

        <Field T={T} label="Email">
          <input
            value={form.email || ''}
            onChange={e => set('email', e.target.value)}
            style={inputStyle(T)}
            placeholder="ruben@streatlab.com"
            type="email"
          />
        </Field>

        <div style={{ marginTop: 16, marginBottom: 12, color: T.sec, fontSize: 13, fontWeight: 600 }}>Recibe estos informes:</div>
        <Check T={T} label="📅 Cierre diario (Lun-Sáb 23:30)" v={form.recibe_cierre_diario} on={v => set('recibe_cierre_diario', v)} />
        <Check T={T} label="💰 Cobros pendientes (Lun 09:00)" v={form.recibe_cobros_lunes} on={v => set('recibe_cobros_lunes', v)} />
        <Check T={T} label="📊 Cierre semanal (Dom 23:30)" v={form.recibe_cierre_semanal} on={v => set('recibe_cierre_semanal', v)} />
        <Check T={T} label="📈 Cierre mensual (Día 1, 09:00)" v={form.recibe_cierre_mensual} on={v => set('recibe_cierre_mensual', v)} />

        <div style={{ marginTop: 16, marginBottom: 12, color: T.sec, fontSize: 13, fontWeight: 600 }}>Por qué canal:</div>
        <Check T={T} label="💬 WhatsApp" v={form.canal_whatsapp} on={v => set('canal_whatsapp', v)} />
        <Check T={T} label="📧 Email" v={form.canal_email} on={v => set('canal_email', v)} />

        <div style={{ marginTop: 16 }}>
          <Check T={T} label="Activo (recibe envíos)" v={form.activo} on={v => set('activo', v)} />
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{ background: T.group, color: T.pri, border: `1px solid ${T.brd}`, borderRadius: 8, padding: '10px 18px', fontSize: 14, cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            style={{ background: '#B01D23', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ T, label, children }: { T: ReturnType<typeof useTheme>['T']; label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', color: T.sec, fontSize: 12, marginBottom: 4, fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  )
}

function Check({ T, label, v, on }: { T: ReturnType<typeof useTheme>['T']; label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', color: T.pri, fontSize: 14 }}>
      <input type="checkbox" checked={v} onChange={e => on(e.target.checked)} />
      {label}
    </label>
  )
}

function inputStyle(T: ReturnType<typeof useTheme>['T']): React.CSSProperties {
  return {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: `1px solid ${T.brd}`, background: T.group, color: T.pri,
    fontSize: 14, fontFamily: FONT.body,
  }
}
