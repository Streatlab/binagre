import { AZUL_CL, BLANCO, GRANATE, INK, LIMA, NAR, VERDE } from '@/styles/neobrutal'
import { ORG_DORADO, ORG_VIOLETA, LIBRO_ESTADO_OK_BG } from '@/styles/palettes'
import { useEffect, useMemo, useState } from 'react'
import { Plus, X, Trash2, LayoutGrid, List, Users, CheckCircle2, CircleDashed, Pencil, Star } from 'lucide-react'
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
  es_responsable: boolean
  mision: string | null
  hab_duras: string | null
  hab_blandas: string | null
  kpis: string | null
  onboarding: string | null
  capacitacion: string | null
  controles: string | null
  plan_carrera: string | null
  delegacion: string | null
  empleado_id?: string | null
}

const NIVELES: { n: number; label: string }[] = [
  { n: 1, label: 'Dirección' },
  { n: 2, label: 'Responsables' },
  { n: 3, label: 'Equipo base' },
  { n: 4, label: 'Externos / colaboradores' },
]

function lst(v: string | null): string[] {
  if (!v) return []
  return v.split('|').map(f => f.trim()).filter(Boolean)
}

function dedicLabel(p: Puesto): string {
  if (p.dedicacion_tipo === 'completa') return `Jornada completa${p.dedicacion_horas ? ` · ${p.dedicacion_horas}h` : ''}`
  if (p.dedicacion_tipo === 'parcial') return `Parcial${p.dedicacion_horas ? ` · ${p.dedicacion_horas}h` : ''}`
  if (p.dedicacion_tipo === 'variable') return 'Variable'
  if (p.dedicacion_tipo === 'externo') return 'Externo'
  return p.dedicacion_tipo
}

function iniciales(nombre: string): string {
  return nombre.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const EMPTY: Omit<Puesto, 'id'> = {
  orden: 99, nivel: 3, area: 'Cocina', puesto: '', persona: SIN_ASIGNAR,
  reporta_a: '', funciones: '', dedicacion_tipo: 'completa', dedicacion_horas: 40,
  color: NAR, estado: 'objetivo', es_responsable: false,
  mision: '', hab_duras: '', hab_blandas: '', kpis: '', onboarding: '',
  capacitacion: '', controles: '', plan_carrera: '', delegacion: '', empleado_id: null,
}

export default function Organigrama() {
  const { T, isDark } = useTheme()
  const [puestos, setPuestos] = useState<Puesto[]>([])
  const [empById, setEmpById] = useState<Record<string, { foto: string | null; nombre: string }>>({})
  const [empByNombre, setEmpByNombre] = useState<Record<string, { foto: string | null }>>({})
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<'organigrama' | 'tabla'>('organigrama')
  const [detalle, setDetalle] = useState<{ open: boolean; data: Puesto | null; edit: boolean }>({ open: false, data: null, edit: false })

  async function fetchAll() {
    const [pz, emps] = await Promise.all([
      supabase.from('organigrama_puestos').select('*').order('nivel').order('orden'),
      supabase.from('empleados').select('id, nombre, foto_url'),
    ])
    if (!pz.error) setPuestos((pz.data ?? []) as Puesto[])
    const byId: Record<string, { foto: string | null; nombre: string }> = {}
    const byNom: Record<string, { foto: string | null }> = {}
    ;(emps.data ?? []).forEach((e: any) => { byId[e.id] = { foto: e.foto_url ?? null, nombre: e.nombre }; byNom[e.nombre] = { foto: e.foto_url ?? null } })
    setEmpById(byId); setEmpByNombre(byNom)
    setLoading(false)
  }
  useEffect(() => { fetchAll() }, [])

  function fotoDe(p: Puesto): string | null {
    if (p.empleado_id && empById[p.empleado_id]) return empById[p.empleado_id].foto
    if (empByNombre[p.persona]) return empByNombre[p.persona].foto
    return null
  }

  const kpis = useMemo(() => {
    const internos = puestos.filter(p => p.dedicacion_tipo !== 'externo')
    const cubiertos = internos.filter(p => p.persona && p.persona !== SIN_ASIGNAR)
    const fte = puestos.reduce((s, p) => s + (p.dedicacion_horas ? p.dedicacion_horas / 40 : 0), 0)
    return {
      total: puestos.length, cubiertos: cubiertos.length, internos: internos.length,
      porCubrir: internos.length - cubiertos.length,
      pct: internos.length ? Math.round((cubiertos.length / internos.length) * 100) : 0,
      fte: Math.round(fte * 10) / 10,
    }
  }, [puestos])

  return (
    <div style={{ padding: '24px 28px', fontFamily: FONT.body }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={pageTitleStyle(T)}>Organigrama</h1>
        <button
          onClick={() => setDetalle({ open: true, data: { id: '', ...EMPTY } as Puesto, edit: true })}
          style={{ padding: '12px 16px', minHeight: 44, borderRadius: 8, border: 'none', background: LIMA, color: INK, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={14} /> Nuevo puesto
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, margin: '18px 0 26px' }}>
        <KpiCard T={T} label="Puestos" value={String(kpis.total)} icon={<Users size={15} />} />
        <KpiCard T={T} label="Cubiertos" value={`${kpis.cubiertos} / ${kpis.internos}`} icon={<CheckCircle2 size={15} />} accent={VERDE} />
        <KpiCard T={T} label="Por cubrir" value={String(kpis.porCubrir)} icon={<CircleDashed size={15} />} accent={kpis.porCubrir ? ORG_DORADO : T.mut} />
        <KpiCard T={T} label="Cobertura" value={`${kpis.pct}%`} />
        <KpiCard T={T} label="Dedicación objetivo" value={`${kpis.fte} FTE`} />
      </div>

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
        <div style={{ ...cardStyle(T), padding: '34px 18px', overflowX: 'auto' }}>
          <Arbol puestos={puestos} T={T} getFoto={fotoDe} onPick={p => setDetalle({ open: true, data: p, edit: false })} />
        </div>
      ) : (
        <Tabla puestos={puestos} T={T} isDark={isDark} onRow={p => setDetalle({ open: true, data: p, edit: false })} />
      )}

      {detalle.open && detalle.data && (
        <DetalleCargo
          T={T} isDark={isDark}
          data={detalle.data}
          puestos={puestos}
          editInit={detalle.edit}
          onClose={() => setDetalle({ open: false, data: null, edit: false })}
          onSaved={() => { fetchAll(); setDetalle({ open: false, data: null, edit: false }) }}
        />
      )}
    </div>
  )
}

/* ════════════════ ÁRBOL / ORGANIGRAMA CLÁSICO ════════════════ */

function Arbol({ puestos, T, getFoto, onPick }: { puestos: Puesto[]; T: any; getFoto: (p: Puesto) => string | null; onPick: (p: Puesto) => void }) {
  const byOrden = (a: Puesto, b: Puesto) => a.orden - b.orden
  const dir = puestos.filter(p => p.nivel === 1).sort(byOrden)
  const resp = puestos.filter(p => p.nivel === 2).sort(byOrden)
  const base = puestos.filter(p => p.nivel === 3).sort(byOrden)
  const ext = puestos.filter(p => p.nivel === 4).sort(byOrden)

  const line = T.brd
  const css = `
    .oc{display:flex;flex-direction:column;align-items:center;min-width:max-content;margin:0 auto}
    .oc-lbl{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${T.mut};margin:0 0 14px}
    .oc-row{display:flex;justify-content:center;gap:18px;flex-wrap:wrap}
    .oc-stem{width:2px;height:26px;background:${line}}
    .oc-fan{display:flex;justify-content:center;gap:18px;flex-wrap:wrap;position:relative;padding-top:26px}
    .oc-fan::before{content:'';position:absolute;top:0;left:12%;right:12%;height:2px;background:${line}}
    .oc-fan>.ocw{position:relative}
    .oc-fan>.ocw::before{content:'';position:absolute;top:-26px;left:50%;width:2px;height:26px;background:${line};transform:translateX(-50%)}
    .oc-ext{margin-top:34px;padding-top:24px;border-top:1px dashed ${line};width:100%;display:flex;flex-direction:column;align-items:center}
  `
  return (
    <>
      <style>{css}</style>
      <div className="oc">
        <div className="oc-lbl">Dirección</div>
        <div className="oc-row">{dir.map(p => <OcNode key={p.id} p={p} T={T} foto={getFoto(p)} onClick={() => onPick(p)} />)}</div>

        {resp.length > 0 && <>
          <div className="oc-stem" />
          <div className="oc-row">{resp.map(p => <OcNode key={p.id} p={p} T={T} foto={getFoto(p)} onClick={() => onPick(p)} />)}</div>
        </>}

        {base.length > 0 && <>
          <div className="oc-stem" />
          <div className="oc-fan">{base.map(p => <div className="ocw" key={p.id}><OcNode p={p} T={T} foto={getFoto(p)} onClick={() => onPick(p)} /></div>)}</div>
        </>}
      </div>

      {ext.length > 0 && (
        <div className="oc-ext">
          <div className="oc-lbl">Colaboradores externos</div>
          <div className="oc-row">{ext.map(p => <OcNode key={p.id} p={p} T={T} foto={getFoto(p)} dashed onClick={() => onPick(p)} />)}</div>
        </div>
      )}
    </>
  )
}

function OrgAvatar({ nombre, foto, color }: { nombre: string; foto: string | null; color: string }) {
  return (
    <div style={{
      width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
      background: color, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT.heading, fontSize: 15, fontWeight: 600, color: BLANCO,
    }}>
      {foto ? <img src={foto} alt={nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (iniciales(nombre) || '—')}
    </div>
  )
}

function OcNode({ p, T, onClick, foto, dashed }: { p: Puesto; T: any; onClick: () => void; foto: string | null; dashed?: boolean }) {
  const asignado = p.persona && p.persona !== SIN_ASIGNAR
  const color = asignado ? (p.color ?? GRANATE) : (T.mut as string)
  return (
    <div onClick={onClick}
      style={{
        ...cardStyle(T), width: 240, padding: '14px 16px', cursor: 'pointer',
        borderStyle: dashed ? 'dashed' : 'solid',
        transition: 'transform 120ms, box-shadow 120ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.16)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <OrgAvatar nombre={asignado ? p.persona : p.puesto} foto={foto} color={color} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 700, color: asignado ? T.pri : T.mut, lineHeight: 1.2, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asignado ? p.persona : 'Por asignar'}</div>
            {p.es_responsable && <Star size={13} color={ORG_DORADO} fill={ORG_DORADO} style={{ flexShrink: 0 }} />}
          </div>
          <div style={{ fontSize: 12, color: T.sec, marginTop: 3, lineHeight: 1.3 }}>{p.puesto}</div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ T, label, value, icon, accent }: { T: any; label: string; value: string; icon?: React.ReactNode; accent?: string }) {
  return (
    <div style={{ ...cardStyle(T), padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 8 }}>{icon}{label}</div>
      <div style={{ fontFamily: FONT.heading, fontSize: 26, fontWeight: 700, color: accent ?? T.pri, lineHeight: 1 }}>{value}</div>
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
          <thead><tr style={{ borderBottom: `1px solid ${T.brd}` }}>
            <th style={th}>Puesto</th><th style={th}>Persona</th><th style={th}>Área</th><th style={th}>Dedicación</th><th style={th}>Reporta a</th>
          </tr></thead>
          <tbody>
            {puestos.map(p => {
              const asignado = p.persona && p.persona !== SIN_ASIGNAR
              return (
                <tr key={p.id} onClick={() => onRow(p)} style={{ borderBottom: `1px solid ${T.brd}`, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={td}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: p.color ?? GRANATE, marginRight: 8 }} />{p.puesto}{p.es_responsable && <Star size={11} color={ORG_DORADO} fill={ORG_DORADO} style={{ marginLeft: 6, verticalAlign: '-1px' }} />}</td>
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

function Seccion({ T, titulo, children }: { T: any; titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 8 }}>{titulo}</div>
      {children}
    </div>
  )
}

function Lista({ T, items, dot = GRANATE }: { T: any; items: string[]; dot?: string }) {
  if (!items.length) return <div style={{ color: T.mut, fontSize: 13 }}>—</div>
  return (
    <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: 'flex', gap: 8, color: T.sec, fontSize: 13, lineHeight: 1.45 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, marginTop: 6, flexShrink: 0 }} />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}

function DetalleCargo({ T, data, puestos, editInit, onClose, onSaved }: { T: any; isDark: boolean; data: Puesto; puestos: Puesto[]; editInit: boolean; onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<'view' | 'edit'>(editInit ? 'edit' : 'view')
  const [form, setForm] = useState<Puesto>({ ...data })
  const [saving, setSaving] = useState(false)
  const esNuevo = !data.id
  function up<K extends keyof Puesto>(k: K, v: Puesto[K]) { setForm(f => ({ ...f, [k]: v })) }

  const subordinados = puestos.filter(p => p.reporta_a && data.puesto && p.reporta_a === data.puesto)
  const asignado = data.persona && data.persona !== SIN_ASIGNAR

  async function guardar() {
    setSaving(true)
    const payload: any = {
      orden: Number(form.orden) || 0, nivel: Number(form.nivel) || 3,
      area: form.area || 'General', puesto: form.puesto,
      persona: form.persona || SIN_ASIGNAR, reporta_a: form.reporta_a || null,
      funciones: form.funciones || null, dedicacion_tipo: form.dedicacion_tipo,
      dedicacion_horas: form.dedicacion_horas === null || (form.dedicacion_horas as any) === '' ? null : Number(form.dedicacion_horas),
      color: form.color || GRANATE,
      estado: form.persona && form.persona !== SIN_ASIGNAR ? 'cubierto' : 'objetivo',
      es_responsable: !!form.es_responsable,
      mision: form.mision || null, hab_duras: form.hab_duras || null, hab_blandas: form.hab_blandas || null,
      kpis: form.kpis || null, onboarding: form.onboarding || null, capacitacion: form.capacitacion || null,
      controles: form.controles || null, plan_carrera: form.plan_carrera || null, delegacion: form.delegacion || null,
    }
    if (esNuevo) await supabase.from('organigrama_puestos').insert(payload)
    else await supabase.from('organigrama_puestos').update(payload).eq('id', data.id)
    setSaving(false); onSaved()
  }
  async function borrar() {
    if (!data.id) return
    if (!confirm('¿Eliminar este puesto del organigrama?')) return
    await supabase.from('organigrama_puestos').delete().eq('id', data.id); onSaved()
  }

  const lbl: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 6, display: 'block' }
  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.brd}`, background: T.inp, color: T.pri, fontFamily: FONT.body, fontSize: 13, boxSizing: 'border-box' }
  const ta = (lines = 5): React.CSSProperties => ({ ...inp, minHeight: lines * 22, resize: 'vertical' })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, padding: 16, overflowY: 'auto' }}>
      <div onMouseDown={e => e.stopPropagation()} style={{ background: T.card, borderRadius: 14, width: 'min(720px, 100%)', margin: '24px 0', border: `1px solid ${T.brd}`, borderTop: `4px solid ${data.color ?? GRANATE}` }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px', borderBottom: `1px solid ${T.brd}`, gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 700, color: T.pri, lineHeight: 1.2 }}>{esNuevo ? 'Nuevo puesto' : data.puesto}</div>
            {!esNuevo && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <span style={{ padding: '3px 9px', borderRadius: 5, fontSize: 12, fontWeight: 600, background: asignado ? LIBRO_ESTADO_OK_BG : T.group, color: asignado ? VERDE : T.mut }}>{data.persona}</span>
                <span style={{ fontSize: 12, color: T.sec }}>{data.area} · {dedicLabel(data)}</span>
                {data.es_responsable && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: ORG_DORADO }}><Star size={12} fill={ORG_DORADO} />Responsable de área</span>}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {mode === 'view' && (
              <button onClick={() => setMode('edit')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, border: `1px solid ${T.brd}`, background: 'transparent', color: T.pri, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}><Pencil size={13} />Editar</button>
            )}
            <X size={22} style={{ cursor: 'pointer', color: T.mut }} onClick={onClose} />
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {mode === 'view' ? (
            <>
              {data.mision && <Seccion T={T} titulo="Misión del puesto"><div style={{ color: T.pri, fontSize: 14, lineHeight: 1.5 }}>{data.mision}</div></Seccion>}

              <Seccion T={T} titulo="Cadena de mando">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: T.sec }}>
                  <div><span style={{ color: T.mut }}>Depende de: </span><span style={{ color: T.pri }}>{data.reporta_a || '— (cúpula)'}</span></div>
                  <div><span style={{ color: T.mut }}>Le reportan: </span><span style={{ color: T.pri }}>{subordinados.length ? subordinados.map(s => s.puesto).join(', ') : '—'}</span></div>
                </div>
              </Seccion>

              <Seccion T={T} titulo="Funciones"><Lista T={T} items={lst(data.funciones)} /></Seccion>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
                <Seccion T={T} titulo="Habilidades duras"><Lista T={T} items={lst(data.hab_duras)} dot={AZUL_CL} /></Seccion>
                <Seccion T={T} titulo="Habilidades blandas"><Lista T={T} items={lst(data.hab_blandas)} dot={ORG_VIOLETA} /></Seccion>
              </div>

              <Seccion T={T} titulo="Indicadores de desempeño (KPIs)"><Lista T={T} items={lst(data.kpis)} dot={VERDE} /></Seccion>
              <Seccion T={T} titulo="Controles de cumplimiento y rendimiento"><Lista T={T} items={lst(data.controles)} dot={ORG_DORADO} /></Seccion>
              <Seccion T={T} titulo="Onboarding"><Lista T={T} items={lst(data.onboarding)} dot={ORG_VIOLETA} /></Seccion>
              <Seccion T={T} titulo="Plan de capacitación"><Lista T={T} items={lst(data.capacitacion)} dot={VERDE} /></Seccion>

              {data.plan_carrera && <Seccion T={T} titulo="Plan de carrera / ascenso"><div style={{ color: T.sec, fontSize: 13, lineHeight: 1.5 }}>{data.plan_carrera}</div></Seccion>}
              {data.delegacion && <Seccion T={T} titulo="Plan de delegación"><div style={{ color: T.sec, fontSize: 13, lineHeight: 1.5 }}>{data.delegacion}</div></Seccion>}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div><label style={lbl}>Puesto</label><input style={inp} value={form.puesto} onChange={e => up('puesto', e.target.value)} placeholder="Ej. Responsable de cocina" /></div>
              <div><label style={lbl}>Persona asignada</label><input style={inp} value={form.persona} onChange={e => up('persona', e.target.value)} placeholder={SIN_ASIGNAR} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Área</label><input style={inp} value={form.area} onChange={e => up('area', e.target.value)} /></div>
                <div><label style={lbl}>Nivel</label><select style={inp} value={form.nivel} onChange={e => up('nivel', Number(e.target.value))}>{NIVELES.map(n => <option key={n.n} value={n.n}>{n.n} · {n.label}</option>)}</select></div>
              </div>
              <div><label style={lbl}>Reporta a</label><input style={inp} value={form.reporta_a ?? ''} onChange={e => up('reporta_a', e.target.value)} placeholder="Puesto superior" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Dedicación</label><select style={inp} value={form.dedicacion_tipo} onChange={e => up('dedicacion_tipo', e.target.value)}>
                  <option value="completa">Jornada completa</option><option value="parcial">Parcial</option><option value="variable">Variable</option><option value="externo">Externo</option>
                </select></div>
                <div><label style={lbl}>Horas / semana</label><input style={inp} type="number" value={form.dedicacion_horas ?? ''} onChange={e => up('dedicacion_horas', e.target.value === '' ? null : Number(e.target.value))} placeholder="40" /></div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.pri, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form.es_responsable} onChange={e => up('es_responsable', e.target.checked)} />
                Responsable de área
              </label>
              <div><label style={lbl}>Misión del puesto</label><textarea style={ta(2)} value={form.mision ?? ''} onChange={e => up('mision', e.target.value)} /></div>
              <CampoLista lbl="Funciones (una por línea)" T={T} ta={ta} value={form.funciones} onChange={v => up('funciones', v)} />
              <CampoLista lbl="Habilidades duras (una por línea)" T={T} ta={ta} value={form.hab_duras} onChange={v => up('hab_duras', v)} />
              <CampoLista lbl="Habilidades blandas (una por línea)" T={T} ta={ta} value={form.hab_blandas} onChange={v => up('hab_blandas', v)} />
              <CampoLista lbl="Indicadores de desempeño / KPIs (uno por línea)" T={T} ta={ta} value={form.kpis} onChange={v => up('kpis', v)} />
              <CampoLista lbl="Controles de cumplimiento (uno por línea)" T={T} ta={ta} value={form.controles} onChange={v => up('controles', v)} />
              <CampoLista lbl="Onboarding (uno por línea)" T={T} ta={ta} value={form.onboarding} onChange={v => up('onboarding', v)} />
              <CampoLista lbl="Plan de capacitación (uno por línea)" T={T} ta={ta} value={form.capacitacion} onChange={v => up('capacitacion', v)} />
              <div><label style={lbl}>Plan de carrera / ascenso</label><textarea style={ta(2)} value={form.plan_carrera ?? ''} onChange={e => up('plan_carrera', e.target.value)} /></div>
              <div><label style={lbl}>Plan de delegación</label><textarea style={ta(2)} value={form.delegacion ?? ''} onChange={e => up('delegacion', e.target.value)} /></div>
              <div><label style={lbl}>Color de acento</label><input style={{ ...inp, height: 44, padding: 4 }} type="color" value={form.color ?? GRANATE} onChange={e => up('color', e.target.value)} /></div>
            </div>
          )}
        </div>

        {mode === 'edit' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: `1px solid ${T.brd}` }}>
            {!esNuevo ? (
              <button onClick={borrar} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 8, border: `1px solid ${T.brd}`, background: 'transparent', color: GRANATE, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}><Trash2 size={13} /> Eliminar</button>
            ) : <span />}
            <div style={{ display: 'flex', gap: 8 }}>
              {!esNuevo && <button onClick={() => setMode('view')} style={{ padding: '12px 16px', borderRadius: 8, border: `1px solid ${T.brd}`, background: 'transparent', color: T.pri, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Cancelar</button>}
              <button onClick={guardar} disabled={saving || !form.puesto} style={{ padding: '12px 20px', minHeight: 44, borderRadius: 8, border: 'none', background: LIMA, color: INK, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, cursor: saving || !form.puesto ? 'default' : 'pointer', opacity: saving || !form.puesto ? 0.5 : 1 }}>{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CampoLista({ lbl, T, ta, value, onChange }: { lbl: string; T: any; ta: (n?: number) => React.CSSProperties; value: string | null; onChange: (v: string) => void }) {
  const labelStyle: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 6, display: 'block' }
  return (
    <div>
      <label style={labelStyle}>{lbl}</label>
      <textarea style={ta(5)} value={lst(value).join('\n')} onChange={e => onChange(e.target.value.split('\n').map(l => l.trim()).filter(Boolean).join('|'))} />
    </div>
  )
}
