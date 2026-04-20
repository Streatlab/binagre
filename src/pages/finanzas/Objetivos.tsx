import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { useTheme, groupStyle, cardStyle, kpiLabelStyle, FONT } from '@/styles/tokens'

interface ObjetivosData {
  diario: number
  semanal: number
  mensual: number
  anual: number
}

const DEFAULT: ObjetivosData = { diario: 700, semanal: 5000, mensual: 20000, anual: 240000 }

const META = [
  { key: 'diario'  as const, label: 'Diario',  sub: 'Ventas por día' },
  { key: 'semanal' as const, label: 'Semanal', sub: 'Lun – Dom' },
  { key: 'mensual' as const, label: 'Mensual', sub: 'Mes natural' },
  { key: 'anual'   as const, label: 'Anual',   sub: 'Año natural' },
]

export default function Objetivos() {
  const { T, isDark } = useTheme()
  const [obj, setObj] = useState<ObjetivosData>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('objetivos').select('tipo,importe').then(({ data, error }) => {
      if (!error && data) {
        const next = { ...DEFAULT }
        for (const r of data as { tipo: string; importe: number | string }[]) {
          if (r.tipo === 'diario' || r.tipo === 'semanal' || r.tipo === 'mensual' || r.tipo === 'anual') {
            next[r.tipo] = Number(r.importe)
          }
        }
        setObj(next)
      }
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    const rows = (Object.keys(obj) as (keyof ObjetivosData)[]).map(tipo => ({ tipo, importe: obj[tipo] }))
    const { error } = await supabase.from('objetivos').upsert(rows, { onConflict: 'tipo' })
    setSaving(false)
    setMessage(error ? `Error: ${error.message}` : 'Guardado correctamente')
    setTimeout(() => setMessage(null), 3000)
  }

  const inputStyle = {
    width: '100%',
    background: isDark ? '#3a4058' : '#ffffff',
    color: T.pri,
    border: `1px solid ${isDark ? '#4a5270' : '#cccccc'}`,
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 16,
    fontFamily: FONT.heading,
    outline: 'none',
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div>

  return (
    <div style={{ fontFamily: FONT.body }}>
      <div style={groupStyle(T)}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '3px', textTransform: 'uppercase', color: T.emphasis, fontWeight: 600, margin: 0 }}>
            Objetivos
          </h1>
          <p style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, margin: '6px 0 0' }}>
            Metas de ventas que aparecen en el Panel Global
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, marginBottom: 20 }}>
          {META.map(({ key, label, sub }) => (
            <div key={key} style={cardStyle(T)}>
              <div style={{ ...kpiLabelStyle(T), marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 11, color: T.mut, marginBottom: 10 }}>{sub}</div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={obj[key]}
                onChange={e => setObj(p => ({ ...p, [key]: Number(e.target.value) || 0 }))}
                style={inputStyle}
              />
              <div style={{ marginTop: 6, fontSize: 12, color: T.sec }}>
                {fmtEur(obj[key])}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              background: T.emphasis,
              color: isDark ? '#1a1a00' : '#ffffff',
              border: 'none',
              cursor: saving ? 'default' : 'pointer',
              fontFamily: FONT.heading,
              fontSize: 13,
              letterSpacing: '1px',
              fontWeight: 600,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          {message && (
            <span style={{ fontSize: 13, color: message.startsWith('Error') ? '#E24B4A' : '#1D9E75' }}>
              {message}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
