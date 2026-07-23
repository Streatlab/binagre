import { BLANCO, GRIS, INK, GRANATE, AZUL, OSW, LEX } from '@/styles/neobrutal'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Papel } from '@/components/kit/cantera'
import { type TipoDia, TIPO_LABEL, useCalendario } from '@/contexts/CalendarioContext'

const TODOS_TIPOS: TipoDia[] = ['operativo', 'solo_comida', 'solo_cena', 'cerrado', 'festivo', 'vacaciones']

interface Props {
  onClose: () => void
}

function toKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ModalRangoBulk({ onClose }: Props) {
  const { refetch } = useCalendario()
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [tipo, setTipo] = useState<TipoDia>('vacaciones')
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<number | null>(null)

  const aplicar = async () => {
    if (!desde || !hasta) { setError('Selecciona fecha inicio y fin.'); return }
    const start = new Date(desde + 'T12:00:00')
    const end   = new Date(hasta + 'T12:00:00')
    if (end < start) { setError('La fecha fin debe ser igual o posterior al inicio.'); return }

    setSaving(true)
    setError(null)

    const rows: { fecha: string; tipo: TipoDia; nota: string | null; updated_at: string }[] = []
    const cur = new Date(start)
    const now = new Date().toISOString()
    while (cur <= end) {
      rows.push({ fecha: toKey(cur), tipo, nota: nota || null, updated_at: now })
      cur.setDate(cur.getDate() + 1)
    }

    // Upsert in batches of 100
    const BATCH = 100
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const { error: err } = await supabase
        .from('calendario_operativo')
        .upsert(batch, { onConflict: 'fecha' })
      if (err) { setError(err.message); setSaving(false); return }
    }

    setOk(rows.length)
    await refetch()
    setSaving(false)
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
      <div style={{ width: 420, maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
        <Papel ceja={AZUL} style={{ padding: '24px 28px' }}>
          <h2 style={{ margin: '0 0 4px', fontFamily: OSW, fontWeight: 700, fontSize: 18, color: INK, letterSpacing: 1, textTransform: 'uppercase' }}>
            Marcar rango
          </h2>
          <p style={{ margin: '0 0 20px', fontFamily: LEX, fontSize: 12.5, color: GRIS, fontWeight: 600 }}>
            Aplica un tipo a todas las fechas del rango seleccionado.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontFamily: OSW, fontWeight: 700, fontSize: 11, color: GRIS, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Desde</label>
              <input
                type="date"
                value={desde}
                onChange={e => setDesde(e.target.value)}
                min="2026-01-01"
                max="2027-12-31"
                style={{ width: '100%', padding: '8px 12px', backgroundColor: BLANCO, color: INK, border: `2px solid ${INK}`, borderRadius: 0, fontFamily: LEX, fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontFamily: OSW, fontWeight: 700, fontSize: 11, color: GRIS, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Hasta</label>
              <input
                type="date"
                value={hasta}
                onChange={e => setHasta(e.target.value)}
                min="2026-01-01"
                max="2027-12-31"
                style={{ width: '100%', padding: '8px 12px', backgroundColor: BLANCO, color: INK, border: `2px solid ${INK}`, borderRadius: 0, fontFamily: LEX, fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <label style={{ fontFamily: OSW, fontWeight: 700, fontSize: 11, color: GRIS, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Tipo</label>
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value as TipoDia)}
            style={{ width: '100%', padding: '8px 12px', backgroundColor: BLANCO, color: INK, border: `2px solid ${INK}`, borderRadius: 0, fontFamily: LEX, fontSize: 13, marginBottom: 16 }}
          >
            {TODOS_TIPOS.map(t => (
              <option key={t} value={t}>{TIPO_LABEL[t]}</option>
            ))}
          </select>

          <label style={{ fontFamily: OSW, fontWeight: 700, fontSize: 11, color: GRIS, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Nota (opcional)</label>
          <input
            type="text"
            value={nota}
            onChange={e => setNota(e.target.value)}
            placeholder="Ej: Vacaciones agosto"
            style={{ width: '100%', padding: '8px 12px', backgroundColor: BLANCO, color: INK, border: `2px solid ${INK}`, borderRadius: 0, fontFamily: LEX, fontSize: 13, marginBottom: 20, boxSizing: 'border-box' }}
          />

          {error && <div style={{ color: GRANATE, fontFamily: LEX, fontWeight: 600, fontSize: 12, marginBottom: 12 }}>{error}</div>}
          {ok !== null && (
            <div style={{ color: INK, fontFamily: LEX, fontWeight: 600, fontSize: 12, marginBottom: 12 }}>
              {ok} días actualizados correctamente.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{ padding: '9px 18px', backgroundColor: 'transparent', border: `2px solid ${INK}`, borderRadius: 0, color: INK, fontFamily: OSW, fontWeight: 700, fontSize: 12, cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase' }}
            >
              {ok !== null ? 'Cerrar' : 'Cancelar'}
            </button>
            {ok === null && (
              <button
                onClick={aplicar}
                disabled={saving}
                style={{ padding: '9px 18px', backgroundColor: GRANATE, border: `2px solid ${INK}`, boxShadow: '3px 3px 0 ' + INK, borderRadius: 0, color: BLANCO, fontFamily: OSW, fontWeight: 700, fontSize: 12, cursor: saving ? 'not-allowed' : 'pointer', letterSpacing: 1, textTransform: 'uppercase', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Aplicando...' : 'Aplicar'}
              </button>
            )}
          </div>
        </Papel>
      </div>
    </div>
  )
}
