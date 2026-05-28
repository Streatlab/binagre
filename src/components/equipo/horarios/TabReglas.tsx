import { useState } from 'react'
import { Plus, Trash2, Save } from 'lucide-react'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { REGLAS_DEFAULT, type ReglasHorario } from './utils'

export default function TabReglas() {
  const { T } = useTheme()
  const [reglas, setReglas] = useState<ReglasHorario>(REGLAS_DEFAULT)
  const [nuevaFranja, setNuevaFranja] = useState('')

  // Persistencia se enchufa a tabla `reglas_horario` (upsert) cuando se entreguen datos.

  const lbl: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 6, display: 'block' }
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: `0.5px solid ${T.brd}`, background: T.inp, color: T.pri, fontFamily: FONT.body, fontSize: 14, boxSizing: 'border-box' }
  const numField = (label: string, key: keyof Omit<ReglasHorario, 'cobertura'>, unidad: string) => (
    <div>
      <label style={lbl}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="number" value={reglas[key]} min={0}
          onChange={e => setReglas(r => ({ ...r, [key]: Number(e.target.value) }))}
          style={{ ...inp, width: 90 }} />
        <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec }}>{unidad}</span>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
      {/* Límites */}
      <div style={cardStyle(T)}>
        <div style={{ fontFamily: FONT.heading, fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', color: T.sec, marginBottom: 16 }}>Límites de jornada</div>
        <div style={{ display: 'grid', gap: 16 }}>
          {numField('Horas máx. / semana', 'horas_max_semana', 'h')}
          {numField('Horas máx. / día', 'horas_max_dia', 'h')}
          {numField('Descanso mín. entre turnos', 'descanso_min_entre_turnos', 'h')}
          {numField('Días libres mín. / semana', 'dias_libres_min_semana', 'días')}
        </div>
      </div>

      {/* Cobertura por franja */}
      <div style={cardStyle(T)}>
        <div style={{ fontFamily: FONT.heading, fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', color: T.sec, marginBottom: 16 }}>Cobertura mínima por franja</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {Object.entries(reglas.cobertura).map(([franja, n]) => (
            <div key={franja} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{franja}</span>
              <input type="number" value={n} min={0}
                onChange={e => setReglas(r => ({ ...r, cobertura: { ...r.cobertura, [franja]: Number(e.target.value) } }))}
                style={{ ...inp, width: 70 }} />
              <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>pers.</span>
              <button onClick={() => setReglas(r => { const c = { ...r.cobertura }; delete c[franja]; return { ...r, cobertura: c } })}
                style={{ border: 'none', background: 'transparent', color: '#B01D23', cursor: 'pointer', padding: 4 }}><Trash2 size={15} /></button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <input placeholder="Nueva franja (ej. Madrugada 00-04)" value={nuevaFranja}
              onChange={e => setNuevaFranja(e.target.value)} style={{ ...inp, flex: 1 }} />
            <button onClick={() => { if (nuevaFranja.trim()) { setReglas(r => ({ ...r, cobertura: { ...r.cobertura, [nuevaFranja.trim()]: 1 } })); setNuevaFranja('') } }}
              style={{ padding: '0 14px', borderRadius: 8, border: 'none', background: '#e8f442', color: '#111', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={14} />Añadir
            </button>
          </div>
        </div>
      </div>

      {/* Guardar */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
        <button style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#FF4757', color: '#fff', fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Save size={15} />Guardar reglas
        </button>
      </div>
    </div>
  )
}
