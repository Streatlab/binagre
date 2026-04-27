import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'
import { type TipoDia, TIPO_LABEL, useCalendario } from '@/contexts/CalendarioContext'

const TODOS_TIPOS: TipoDia[] = ['operativo', 'solo_comida', 'solo_cena', 'cerrado', 'festivo', 'vacaciones']

interface Props {
  fecha: string   // 'YYYY-MM-DD'
  tipoActual: TipoDia
  onClose: () => void
}

export default function ModalTipoDia({ fecha, tipoActual, onClose }: Props) {
  const { refetch } = useCalendario()
  const [tipo, setTipo] = useState<TipoDia>(tipoActual)
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fmt = new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const guardar = async () => {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('calendario_operativo')
      .upsert({ fecha, tipo, nota: nota || null, updated_at: new Date().toISOString() }, { onConflict: 'fecha' })
    if (err) { setError(err.message); setSaving(false); return }
    await refetch()
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.65)',
      }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '28px 32px', width: 380, maxWidth: '95vw' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 4px', fontFamily: FONT.heading, fontSize: 16, color: '#e8f442', letterSpacing: 1, textTransform: 'uppercase' }}>
          Tipo de día
        </h2>
        <p style={{ margin: '0 0 20px', fontFamily: FONT.body, fontSize: 12, color: '#777' }}>{fmt}</p>

        <label style={{ fontFamily: FONT.heading, fontSize: 11, color: '#aaa', letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
          Tipo
        </label>
        <select
          value={tipo}
          onChange={e => setTipo(e.target.value as TipoDia)}
          style={{ width: '100%', padding: '8px 12px', backgroundColor: '#1e1e1e', color: '#fff', border: '1px solid #383838', borderRadius: 6, fontFamily: FONT.body, fontSize: 13, marginBottom: 16 }}
        >
          {TODOS_TIPOS.map(t => (
            <option key={t} value={t}>{TIPO_LABEL[t]}</option>
          ))}
        </select>

        <label style={{ fontFamily: FONT.heading, fontSize: 11, color: '#aaa', letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
          Nota (opcional)
        </label>
        <input
          type="text"
          value={nota}
          onChange={e => setNota(e.target.value)}
          placeholder="Ej: Festivo local San Isidro"
          style={{ width: '100%', padding: '8px 12px', backgroundColor: '#1e1e1e', color: '#fff', border: '1px solid #383838', borderRadius: 6, fontFamily: FONT.body, fontSize: 13, marginBottom: 20, boxSizing: 'border-box' }}
        />

        {error && (
          <div style={{ color: '#ffaaaa', fontFamily: FONT.body, fontSize: 12, marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '9px 18px', backgroundColor: '#222', border: '1px solid #383838', borderRadius: 8, color: '#ccc', fontFamily: FONT.heading, fontSize: 12, cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase' }}
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving}
            style={{ padding: '9px 18px', backgroundColor: '#B01D23', border: 'none', borderRadius: 8, color: '#fff', fontFamily: FONT.heading, fontSize: 12, cursor: saving ? 'not-allowed' : 'pointer', letterSpacing: 1, textTransform: 'uppercase', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
