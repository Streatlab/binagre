/**
 * Módulo Informes — Gestión de destinatarios
 * CANTERA ALEGRE v1.0 (área Equipo · tinta). Solo capa visual; cargar(), guardar()
 * y eliminar() intactas.
 *
 * Permite añadir, editar y desactivar quién recibe cada tipo de informe
 * y por qué canal (WhatsApp / Email).
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { INK, GRIS, OSW, LEX, VERDE, GRANATE, BLANCO } from '@/styles/neobrutal'
import { HeroCantera, Papel, PantallaCantera, SeccionLabel, SHADOW_DURA } from '@/components/kit/cantera'

interface Destinatario {
  id: string
  nombre: string
  whatsapp: string | null
  email: string | null
  recibe_resumen_manana: boolean
  recibe_pulso: boolean
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
  recibe_resumen_manana: true,
  recibe_pulso: true,
  recibe_cierre_diario: true,
  recibe_cobros_lunes: true,
  recibe_cierre_semanal: true,
  recibe_cierre_mensual: true,
  canal_whatsapp: true,
  canal_email: true,
  activo: true,
}

export default function Destinatarios() {
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
      recibe_resumen_manana: d.recibe_resumen_manana,
      recibe_pulso: d.recibe_pulso,
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

  const activos = lista.filter(d => d.activo).length
  const titular = lista.length === 0
    ? 'Sin destinatarios configurados todavía.'
    : <>{activos} de {lista.length} destinatarios activos reciben informes.</>

  return (
    <PantallaCantera>
      {/* 1 · Héroe del área Equipo (tinta) */}
      <HeroCantera
        area="equipo"
        titular={titular}
        etiquetaDato="Destinatarios activos"
        cifra={`${activos} / ${lista.length}`}
        pills={
          <button
            onClick={() => setCreando(NUEVO_VACIO)}
            style={{ background: GRANATE, color: BLANCO, border: `2px solid ${INK}`, boxShadow: SHADOW_DURA, padding: '6px 14px', fontFamily: OSW, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            + Añadir destinatario
          </button>
        }
      />

      {loading && <div style={{ color: GRIS, fontFamily: LEX, padding: '12px 0' }}>Cargando…</div>}

      {/* 2 · Lista de destinatarios */}
      <div>
        <SeccionLabel bg={GRANATE}>Destinatarios</SeccionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lista.map(d => (
            <Papel key={d.id} ceja={d.activo ? VERDE : GRIS} style={{ opacity: d.activo ? 1 : 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontFamily: OSW, fontSize: 18, fontWeight: 700, color: INK, margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                    {d.nombre}
                    {!d.activo && <span style={{ marginLeft: 8, fontFamily: LEX, fontSize: 11, color: GRIS, fontWeight: 400, textTransform: 'none' }}>(inactivo)</span>}
                  </h3>
                  <div style={{ display: 'flex', gap: 16, fontFamily: LEX, fontSize: 13, color: INK, flexWrap: 'wrap', marginBottom: 8 }}>
                    {d.whatsapp && <span>💬 {d.whatsapp}</span>}
                    {d.email && <span>📧 {d.email}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {d.recibe_resumen_manana && <Pill label="☀️ Mañana" />}
                    {d.recibe_pulso && <Pill label="⏱ Pulso" />}
                    {d.recibe_cierre_diario && <Pill label="📅 Diario" />}
                    {d.recibe_cobros_lunes && <Pill label="💰 Cobros" />}
                    {d.recibe_cierre_semanal && <Pill label="📊 Semanal" />}
                    {d.recibe_cierre_mensual && <Pill label="📈 Mensual" />}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditando(d)} style={{ background: BLANCO, color: INK, border: `2px solid ${INK}`, padding: '6px 12px', fontFamily: OSW, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer' }}>✏️ Editar</button>
                  <button onClick={() => eliminar(d.id)} style={{ background: BLANCO, color: GRANATE, border: `2px solid ${GRANATE}`, padding: '6px 12px', fontFamily: OSW, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🗑</button>
                </div>
              </div>
            </Papel>
          ))}
        </div>
      </div>

      {(editando || creando) && (
        <Modal
          dest={editando || (creando as Destinatario)}
          esNuevo={!!creando}
          onClose={() => { setEditando(null); setCreando(null) }}
          onSave={guardar}
        />
      )}
    </PantallaCantera>
  )
}

function Pill({ label }: { label: string }) {
  return (
    <span style={{ background: `${INK}0d`, color: INK, border: `2px solid ${INK}`, padding: '3px 10px', fontFamily: LEX, fontSize: 11, fontWeight: 500 }}>{label}</span>
  )
}

function Modal({
  dest, esNuevo, onClose, onSave,
}: {
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
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
        <Papel ceja={GRANATE} style={{ boxShadow: SHADOW_DURA }}>
          <h2 style={{ fontFamily: OSW, fontSize: 20, fontWeight: 700, color: INK, marginTop: 0, marginBottom: 18, textTransform: 'uppercase' }}>
            {esNuevo ? 'Nuevo destinatario' : 'Editar destinatario'}
          </h2>

          <Field label="Nombre">
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)} style={inputStyle} placeholder="ej: Rubén" />
          </Field>

          <Field label="WhatsApp (con prefijo +34)">
            <input value={form.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} style={inputStyle} placeholder="+34647651051" />
          </Field>

          <Field label="Email">
            <input value={form.email || ''} onChange={e => set('email', e.target.value)} style={inputStyle} placeholder="ruben@streatlab.com" type="email" />
          </Field>

          <div style={{ marginTop: 16, marginBottom: 12, fontFamily: OSW, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: GRIS, fontWeight: 700 }}>Recibe estos informes</div>
          <Check label="☀️ Resumen mañana (todos los días 08:00)" v={form.recibe_resumen_manana} on={v => set('recibe_resumen_manana', v)} />
          <Check label="⏱ Pulso de la tarde (todos los días 16:30)" v={form.recibe_pulso} on={v => set('recibe_pulso', v)} />
          <Check label="📅 Cierre diario (Lun-Sáb 23:29)" v={form.recibe_cierre_diario} on={v => set('recibe_cierre_diario', v)} />
          <Check label="💰 Cobros pendientes (Lun 09:00)" v={form.recibe_cobros_lunes} on={v => set('recibe_cobros_lunes', v)} />
          <Check label="📊 Cierre semanal (Dom 23:30)" v={form.recibe_cierre_semanal} on={v => set('recibe_cierre_semanal', v)} />
          <Check label="📈 Cierre mensual (Día 1, 09:00)" v={form.recibe_cierre_mensual} on={v => set('recibe_cierre_mensual', v)} />

          <div style={{ marginTop: 16, marginBottom: 12, fontFamily: OSW, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: GRIS, fontWeight: 700 }}>Por qué canal</div>
          <Check label="💬 WhatsApp" v={form.canal_whatsapp} on={v => set('canal_whatsapp', v)} />
          <Check label="📧 Email" v={form.canal_email} on={v => set('canal_email', v)} />

          <div style={{ marginTop: 16 }}>
            <Check label="Activo (recibe envíos)" v={form.activo} on={v => set('activo', v)} />
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
            <button onClick={onClose} style={{ background: `${INK}0d`, color: INK, border: `2px solid ${INK}`, padding: '10px 18px', fontFamily: OSW, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={() => onSave(form)} style={{ background: GRANATE, color: BLANCO, border: `2px solid ${INK}`, boxShadow: SHADOW_DURA, padding: '10px 18px', fontFamily: OSW, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>Guardar</button>
          </div>
        </Papel>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontFamily: OSW, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: GRIS, marginBottom: 4, fontWeight: 700 }}>{label}</label>
      {children}
    </div>
  )
}

function Check({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', color: INK, fontFamily: LEX, fontSize: 14 }}>
      <input type="checkbox" checked={v} onChange={e => on(e.target.checked)} />
      {label}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: `2px solid ${INK}`, borderRadius: 0,
  background: BLANCO, color: INK, fontFamily: LEX, fontSize: 14,
}
