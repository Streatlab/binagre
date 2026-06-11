import { useEffect, useMemo, useState } from 'react'
import { Plus, X, Trash2, LayoutGrid, List, Users, CheckCircle2, CircleDashed } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle, pageTitleStyle, tabActiveStyle, tabInactiveStyle } from '@/styles/tokens'

const SIN_ASIGNAR = 'Por asignar'

type Puesto = {
  id: string
  orden: number
  nivel: number
  area: string
  puesto: string
  persona: string
  reporta_a: string | null
  funciones: string | null
  dedicacion_tipo: string
  dedicacion_horas: number | null
  color: string | null
  estado: string
}

const NIVELES: { n: number; label: string }[] = [
  { n: 1, label: 'Dirección' },
  { n: 2, label: 'Responsables' },
  { n: 3, label: 'Equipo base' },
  { n: 4, label: 'Externos / colaboradores' },
]

function fnList(funciones: string | null): string[] {
  if (!funciones) return []
  return funciones.split('|').map(f => f.trim()).filter(Boolean)
}

function dedicLabel(p: Puesto): string {
  if (p.dedicacion_tipo === 'completa') return `Jornada completa${p.dedicacion_horas ? ` · ${p.dedicacion_horas}h` : ''}`
  if (p.dedicacion_tipo === 'parcial') return `Parcial${p.dedicacion_horas ? ` · ${p.dedicacion_horas}h` : ''}`
  if (p.dedicacion_tipo === 'variable') return 'Variable'
  if (p.dedicacion_tipo === 'externo') return 'Externo'
  return p.dedicacion_tipo
}

const EMPTY: Omit<Puesto, 'id'> = {
  orden: 99, nivel: 3, area: 'Cocina', puesto: '', persona: SIN_ASIGNAR,
  reporta_a: '', funciones: '', dedicacion_tipo: 'completa', dedicacion_horas: 40,
  color: '#f5a623', estado: 'objetivo',
}

export default function Organigrama() {
  const { T, isDark } = useTheme()
  const [puestos, setPuestos] = useState<Puesto[]>([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<'organigrama' | 'tabla'>('organigrama')
  const [modal, setModal] = useState<{ open: boolean; data: Puesto | null }>({ open: false, data: null })

  async function fetch() {
    const { data, error } = await supabase
      .from('organigrama_puestos')
      .select('*')
      .order('nivel').order('orden')
    if (!error) setPuestos((data ?? []) as Puesto[])
    setLoading(false)
  }
  useEffect(() => { fetch() }, [])

  const kpis = useMemo(() => {
    const internos = puestos.filter(p => p.dedicacion_tipo !== 'externo')
    const cubiertos = internos.filter(p => p.persona && p.persona !== SIN_ASIGNAR)
    const porCubrir = internos.length - cubiertos.length
    const fte = puestos.reduce((s, p) => s + (p.dedicacion_horas ? p.dedicacion_horas / 40 : 0), 0)
    return {
      total: puestos.length,
      cubiertos: cubiertos.length,
      internos: internos.length,
      porCubrir,
      pct: internos.length ? Math.round((cubiertos.length / internos.length) * 100) : 0,
      fte: Math.round(fte * 10) / 10,
    }
  }, [puestos])

  return (
    <div style={{ padding: '24px 28px', fontFamily: FONT.body }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={pageTitleStyle(T)}>Organigrama</h1>
        <button
          onClick={() => setModal({ open: true, data: { id: '', ...EMPTY } as Puesto })}
          style={{ padding: '12px 16px', minHeight: 44, borderRadius: 8, border: 'none', background: '#e8f442', color: '#111111', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={14} /> Nuevo puesto
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, margin: '18px 0 26px' }}>
        <KpiCard T={T} label="Puestos" value={String(kpis.total)} icon={<Users size={15} />} />
        <KpiCard T={T} label="Cubiertos" value={`${kpis.cubiertos} / ${kpis.internos}`} icon={<CheckCircle2 size={15} />} accent="#1D9E75" />
        <KpiCard T={T} label="Por cubrir" value={String(kpis.porCubrir)} icon={<CircleDashed size={15} />} accent={kpis.porCubrir ? '#e8b341' : T.mut} />
        <KpiCard T={T} label="Cobertura" value={`${kpis.pct}%`} />
        <KpiCard T={T} label="Dedicación objetivo" value={`${kpis.fte} FTE`} />
      </div>

      {/* Vista toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        <button onClick={() => setVista('organigrama')} style={vista === 'organigrama' ? tabActiveStyle(isDark) : tabInactiveStyle(T)}>
          <LayoutGrid size={13} style={{ marginRight: 6, verticalAlign: '-2px' }} />Organigrama
        </button>
        <button onClick={() => setVista('tabla')} style={vista === 'tabla' ? tabActiveStyle(isDark) : tabInactiveStyle(T)}>
          <List size={13} style={{ marginRight: 6, verticalAlign: '-2px' }} />Tabla
        </button>
      </div>

      {loading ? (
        <div style={{ ...cardStyle(T), padding: 32, textAlign: 'center', color: T.mut }}>Cargando organigrama…</div>
      ) : vista === 'organigrama' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          {NIVELES.map(({ n, label }) => {
            const grupo = puestos.filter(p => p.nivel === n)
            if (!grupo.length) return null
            return (
              <div key={n}>
                <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>{label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                  {grupo.map(p => <PuestoCard key={p.id} p={p} T={T} isDark={isDark} onClick={() => setModal({ open: true, data: p })} />)}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <Tabla puestos={puestos} T={T} isDark={isDark} onRow={p => setModal({ open: true, data: p })} />
      )}

      {modal.open && modal.data && (
        <ModalPuesto
          T={T} isDark={isDark}
          data={modal.data}
          onClose={() => setModal({ open: false, data: null })}
          onSaved={() => { fetch(); setModal({ open: false, data: null }) }}
        />
      )}
    </div>
  )
}

function KpiCard({ T, label, value, icon, accent }: { T: any; label: string; value: string; icon?: React.ReactNode; accent?: string }) {
  return (
    <div style={{ ...cardStyle(T), padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 8 }}>
        {icon}{label}
      </div>
      <div style={{ fontFamily: FONT.heading, fontSize: 26, fontWeight: 700, color: accent ?? T.pri, lineHeight: 1 }}>{value}</div>
    </div>
  )
}

function PuestoCard({ p, T, isDark, onClick }: { p: Puesto; T: any; isDark: boolean; onClick: () => void }) {
  const asignado = p.persona && p.persona !== SIN_ASIGNAR
  const funcs = fnList(p.funciones)
  return (
    <div
      onClick={onClick}
      style={{ ...cardStyle(T), width: 270, padding: 0, overflow: 'hidden', cursor: 'pointer', borderTop: `3px solid ${p.color ?? '#B01D23'}` }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 700, color: T.pri, lineHeight: 1.25, marginBottom: 8 }}>{p.puesto}</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 5, fontSize: 12, fontWeight: 600, fontFamily: FONT.body, marginBottom: 10,
          background: asignado ? '#1D9E7522' : T.group, color: asignado ? '#1D9E75' : T.mut }}>
          {p.persona}
        </div>
        <div style={{ fontSize: 11, color: T.sec, marginBottom: 10 }}>{dedicLabel(p)}</div>
        {funcs.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 16, color: T.sec, fontSize: 12, lineHeight: 1.5 }}>
            {funcs.slice(0, 3).map((f, i) => <li key={i}>{f}</li>)}
            {funcs.length > 3 && <li style={{ color: T.mut, listStyle: 'none', marginLeft: -16 }}>+{funcs.length - 3} más</li>}
          </ul>
        )}
      </div>
    </div>
  )
}

function Tabla({ puestos, T, isDark, onRow }: { puestos: Puesto[]; T: any; isDark: boolean; onRow: (p: Puesto) => void }) {
  const th: React.CSSProperties = { padding: '10px 14px', fontFamily: FONT.heading, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', color: T.mut, fontWeight: 400, background: T.group, textAlign: 'left' }
  const td: React.CSSProperties = { padding: '12px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri }
  return (
    <div style={{ ...cardStyle(T), padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.brd}` }}>
              <th style={th}>Puesto</th><th style={th}>Persona</th><th style={th}>Área</th><th style={th}>Dedicación</th><th style={th}>Reporta a</th>
            </tr>
          </thead>
          <tbody>
            {puestos.map(p => {
              const asignado = p.persona && p.persona !== SIN_ASIGNAR
              return (
                <tr key={p.id} onClick={() => onRow(p)} style={{ borderBottom: `1px solid ${T.brd}`, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={td}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: p.color ?? '#B01D23', marginRight: 8 }} />{p.puesto}</td>
                  <td style={{ ...td, color: asignado ? T.pri : T.mut }}>{p.persona}</td>
                  <td style={{ ...td, color: T.sec }}>{p.area}</td>
                  <td style={{ ...td, color: T.sec, fontSize: 12 }}>{dedicLabel(p)}</td>
                  <td style={{ ...td, color: T.sec, fontSize: 12 }}>{p.reporta_a || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ModalPuesto({ T, isDark, data, onClose, onSaved }: { T: any; isDark: boolean; data: Puesto; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Puesto>({ ...data })
  const [saving, setSaving] = useState(false)
  const esNuevo = !data.id

  function up<K extends keyof Puesto>(k: K, v: Puesto[K]) { setForm(f => ({ ...f, [k]: v })) }

  async function guardar() {
    setSaving(true)
    const payload = {
      orden: Number(form.orden) || 0,
      nivel: Number(form.nivel) || 3,
      area: form.area || 'General',
      puesto: form.puesto,
      persona: form.persona || SIN_ASIGNAR,
      reporta_a: form.reporta_a || null,
      funciones: form.funciones || null,
      dedicacion_tipo: form.dedicacion_tipo,
      dedicacion_horas: form.dedicacion_horas === null || form.dedicacion_horas === undefined || (form.dedicacion_horas as any) === '' ? null : Number(form.dedicacion_horas),
      color: form.color || '#B01D23',
      estado: form.persona && form.persona !== SIN_ASIGNAR ? 'cubierto' : 'objetivo',
    }
    if (esNuevo) await supabase.from('organigrama_puestos').insert(payload)
    else await supabase.from('organigrama_puestos').update(payload).eq('id', data.id)
    setSaving(false)
    onSaved()
  }

  async function borrar() {
    if (!data.id) return
    if (!confirm('¿Eliminar este puesto del organigrama?')) return
    await supabase.from('organigrama_puestos').delete().eq('id', data.id)
    onSaved()
  }

  const lbl: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 6, display: 'block' }
  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.brd}`, background: 'var(--sl-app)', color: T.pri, fontFamily: FONT.body, fontSize: 13, boxSizing: 'border-box' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: 14, width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${T.brd}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: `1px solid ${T.brd}` }}>
          <span style={{ fontFamily: FONT.heading, fontSize: 15, fontWeight: 700, color: T.pri }}>{esNuevo ? 'Nuevo puesto' : 'Editar puesto'}</span>
          <X size={20} style={{ cursor: 'pointer', color: T.mut }} onClick={onClose} />
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={lbl}>Puesto</label>
            <input style={inp} value={form.puesto} onChange={e => up('puesto', e.target.value)} placeholder="Ej. Jefe/a de cocina" />
          </div>
          <div>
            <label style={lbl}>Persona asignada</label>
            <input style={inp} value={form.persona} onChange={e => up('persona', e.target.value)} placeholder={SIN_ASIGNAR} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Área</label>
              <input style={inp} value={form.area} onChange={e => up('area', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Nivel</label>
              <select style={inp} value={form.nivel} onChange={e => up('nivel', Number(e.target.value))}>
                {NIVELES.map(n => <option key={n.n} value={n.n}>{n.n} · {n.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>Reporta a</label>
            <input style={inp} value={form.reporta_a ?? ''} onChange={e => up('reporta_a', e.target.value)} placeholder="Puesto superior" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Dedicación</label>
              <select style={inp} value={form.dedicacion_tipo} onChange={e => up('dedicacion_tipo', e.target.value)}>
                <option value="completa">Jornada completa</option>
                <option value="parcial">Parcial</option>
                <option value="variable">Variable</option>
                <option value="externo">Externo</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Horas / semana</label>
              <input style={inp} type="number" value={form.dedicacion_horas ?? ''} onChange={e => up('dedicacion_horas', e.target.value === '' ? null : Number(e.target.value))} placeholder="40" />
            </div>
          </div>
          <div>
            <label style={lbl}>Funciones objetivo (una por línea)</label>
            <textarea
              style={{ ...inp, minHeight: 120, resize: 'vertical' }}
              value={fnList(form.funciones).join('\n')}
              onChange={e => up('funciones', e.target.value.split('\n').map(l => l.trim()).filter(Boolean).join('|'))}
              placeholder={'Planificar la producción diaria\nControl de mermas y stock\nApertura y cierre de cocina'}
            />
          </div>
          <div>
            <label style={lbl}>Color</label>
            <input style={{ ...inp, height: 44, padding: 4 }} type="color" value={form.color ?? '#B01D23'} onChange={e => up('color', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 22px', borderTop: `1px solid ${T.brd}` }}>
          {!esNuevo ? (
            <button onClick={borrar} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 8, border: `1px solid ${T.brd}`, background: 'transparent', color: '#B01D23', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
              <Trash2 size={13} /> Eliminar
            </button>
          ) : <span />}
          <button onClick={guardar} disabled={saving || !form.puesto} style={{ padding: '12px 20px', minHeight: 44, borderRadius: 8, border: 'none', background: '#e8f442', color: '#111111', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, cursor: saving || !form.puesto ? 'default' : 'pointer', opacity: saving || !form.puesto ? 0.5 : 1 }}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
