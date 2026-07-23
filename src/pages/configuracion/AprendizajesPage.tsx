import { BLANCO, BORDE_SUAVE, GRANATE, GRIS, INK, LIMA, ROJO, ROJO_S, VERDE, SHADOW_MINI } from '@/styles/neobrutal'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtDate } from '@/lib/format'
import RutaPantalla from '@/components/ui/RutaPantalla'
import { FONT } from '@/styles/tokens'
import { PantallaCantera, HeroCantera, Papel } from '@/components/kit/cantera'
import {
  APRENDIZAJES_MODULO, APRENDIZAJES_MODULO_DEFAULT, APRENDIZAJES_MODULO_CONFIG_TXT,
  APRENDIZAJES_SEC, APRENDIZAJES_OK_BG, APRENDIZAJES_OK_TXT, ERROR_BANNER_BG, ERROR_BANNER_BORDE,
} from '@/styles/palettes'

interface Aprendizaje {
  id: number
  sintoma: string
  modulo: string
  causa_raiz: string
  regla_preventiva: string
  fecha: string
  origen: string | null
  created_at: string
}

const MODULE_COLORS: Record<string, { bg: string; color: string }> = {
  ...APRENDIZAJES_MODULO,
  configuracion: { bg: INK, color: APRENDIZAJES_MODULO_CONFIG_TXT },
}

function moduleBadge(mod: string) {
  const key = (mod || '').toLowerCase().trim()
  const c = MODULE_COLORS[key] ?? APRENDIZAJES_MODULO_DEFAULT
  return (
    <span style={{
      backgroundColor: c.bg,
      color: c.color,
      border: `1px solid ${c.color}33`,
      borderRadius: 4,
      padding: '2px 8px',
      fontSize: 11,
      fontFamily: FONT.heading,
      letterSpacing: '0.5px',
      textTransform: 'uppercase' as const,
      whiteSpace: 'nowrap' as const,
    }}>
      {mod || '—'}
    </span>
  )
}

function toIso(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const FORM_EMPTY = {
  sintoma: '',
  modulo: '',
  causa_raiz: '',
  regla_preventiva: '',
  fecha: toIso(new Date()),
}

export default function AprendizajesPage() {
  const [rows, setRows] = useState<Aprendizaje[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...FORM_EMPTY })
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('erp_aprendizajes')
      .select('*')
      .order('fecha', { ascending: false })
    if (!error && data) setRows(data as Aprendizaje[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(r =>
      (r.sintoma || '').toLowerCase().includes(q) ||
      (r.modulo || '').toLowerCase().includes(q) ||
      (r.regla_preventiva || '').toLowerCase().includes(q) ||
      (r.origen || '').toLowerCase().includes(q)
    )
  }, [rows, search])

  async function handleSave() {
    if (!form.sintoma.trim() || !form.modulo.trim()) {
      setFeedback({ ok: false, msg: 'Síntoma y módulo son obligatorios.' })
      return
    }
    setSaving(true)
    const { error } = await supabase.from('erp_aprendizajes').insert({
      sintoma: form.sintoma.trim(),
      modulo: form.modulo.trim(),
      causa_raiz: form.causa_raiz.trim(),
      regla_preventiva: form.regla_preventiva.trim(),
      fecha: form.fecha,
      origen: 'manual',
    })
    setSaving(false)
    if (error) {
      setFeedback({ ok: false, msg: 'Error al guardar: ' + error.message })
    } else {
      setFeedback({ ok: true, msg: 'Aprendizaje guardado correctamente.' })
      setForm({ ...FORM_EMPTY })
      setShowForm(false)
      load()
    }
    setTimeout(() => setFeedback(null), 4000)
  }

  const TH: React.CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: APRENDIZAJES_SEC,
    padding: '10px 12px',
    textAlign: 'left',
    backgroundColor: INK,
    borderBottom: `1px solid ${BORDE_SUAVE}`,
    whiteSpace: 'nowrap',
  }

  const TD: React.CSSProperties = {
    fontFamily: FONT.body,
    fontSize: 13,
    color: GRIS,
    padding: '10px 12px',
    borderBottom: `1px solid ${BORDE_SUAVE}`,
    verticalAlign: 'top',
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: BLANCO,
    border: `2px solid ${INK}`,
    borderRadius: 0,
    color: INK,
    fontFamily: FONT.body,
    fontSize: 13,
    padding: '7px 10px',
    width: '100%',
    outline: 'none',
    resize: 'vertical' as const,
  }

  const totalRegistrado = rows.length

  return (
    <PantallaCantera>
      <RutaPantalla niveles={['Ajustes', 'Aprendizajes ERP']} />

      {/* Héroe: nº de aprendizajes registrados (área Papeleo · granate) */}
      <HeroCantera
        area="papeleo"
        titular={totalRegistrado === 0 ? 'Todavía no hay aprendizajes registrados.' : `${totalRegistrado} aprendizajes registrados para no repetir errores.`}
        etiquetaDato="Aprendizajes en la base"
        cifra={String(totalRegistrado)}
      />

      {/* Buscador y alta */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Buscar aprendizajes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, width: 220, resize: undefined }}
        />
        <button
          onClick={() => { setShowForm(v => !v); setFeedback(null) }}
          style={{ backgroundColor: LIMA, color: INK, border: `2px solid ${INK}`, boxShadow: SHADOW_MINI, borderRadius: 0, padding: '7px 16px', fontFamily: FONT.heading, fontSize: 13, letterSpacing: '0.5px', cursor: 'pointer', textTransform: 'uppercase' }}
        >
          {showForm ? 'Cancelar' : '+ Añadir aprendizaje'}
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{ backgroundColor: feedback.ok ? APRENDIZAJES_OK_BG : ERROR_BANNER_BG, border: `1px solid ${feedback.ok ? VERDE : ERROR_BANNER_BORDE}`, color: feedback.ok ? APRENDIZAJES_OK_TXT : ROJO_S, borderRadius: 4, padding: '10px 14px', fontFamily: FONT.body, fontSize: 13 }}>
          {feedback.msg}
        </div>
      )}

      {/* Form inline */}
      {showForm && (
        <Papel ceja={LIMA}>
          <h2 style={{ fontFamily: FONT.heading, fontSize: 15, color: INK, letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 16px' }}>Nuevo aprendizaje</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontFamily: FONT.heading, fontSize: 11, color: GRIS, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>Síntoma *</label>
              <textarea rows={3} value={form.sintoma} onChange={e => setForm(f => ({ ...f, sintoma: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: FONT.heading, fontSize: 11, color: GRIS, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>Módulo *</label>
              <input value={form.modulo} onChange={e => setForm(f => ({ ...f, modulo: e.target.value }))} style={{ ...inputStyle, resize: undefined }} placeholder="facturacion, ocr, conciliacion…" />
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: FONT.heading, fontSize: 11, color: GRIS, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>Causa raíz</label>
              <textarea rows={3} value={form.causa_raiz} onChange={e => setForm(f => ({ ...f, causa_raiz: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: FONT.heading, fontSize: 11, color: GRIS, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>Regla preventiva</label>
              <textarea rows={3} value={form.regla_preventiva} onChange={e => setForm(f => ({ ...f, regla_preventiva: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: FONT.heading, fontSize: 11, color: GRIS, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>Fecha</label>
              <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} style={{ ...inputStyle, resize: undefined }} />
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ backgroundColor: GRANATE, color: BLANCO, border: `2px solid ${INK}`, boxShadow: SHADOW_MINI, borderRadius: 0, padding: '8px 20px', fontFamily: FONT.heading, fontSize: 13, letterSpacing: '0.5px', cursor: saving ? 'not-allowed' : 'pointer', textTransform: 'uppercase', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm({ ...FORM_EMPTY }) }}
              style={{ backgroundColor: BLANCO, color: GRIS, border: `2px solid ${INK}`, borderRadius: 0, padding: '8px 16px', fontFamily: FONT.heading, fontSize: 13, cursor: 'pointer', textTransform: 'uppercase' }}
            >
              Cancelar
            </button>
          </div>
        </Papel>
      )}

      {/* Table */}
      <Papel ceja={GRANATE} pad="0" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: GRIS, fontFamily: FONT.body }}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: GRIS, fontFamily: FONT.body }}>
            {search ? 'Sin resultados para la búsqueda.' : 'No hay aprendizajes registrados aún.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Fecha</th>
                  <th style={TH}>Módulo</th>
                  <th style={TH}>Síntoma</th>
                  <th style={TH}>Regla preventiva</th>
                  <th style={TH}>Origen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id} style={{ transition: 'background 0.1s' }}>
                    <td style={{ ...TD, color: GRIS, fontSize: 12, whiteSpace: 'nowrap' }}>{row.fecha ? fmtDate(row.fecha) : '—'}</td>
                    <td style={TD}>{moduleBadge(row.modulo)}</td>
                    <td style={{ ...TD, maxWidth: 320, color: INK }}>{row.sintoma || '—'}</td>
                    <td style={{ ...TD, maxWidth: 380, color: GRIS, fontSize: 12 }}>{row.regla_preventiva || '—'}</td>
                    <td style={{ ...TD, color: GRIS, fontSize: 12 }}>{row.origen || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Papel>
      <div style={{ color: GRIS, fontSize: 11, fontFamily: FONT.body }}>
        {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
        {search ? ` (filtrado de ${rows.length})` : ''}
      </div>
    </PantallaCantera>
  )
}
