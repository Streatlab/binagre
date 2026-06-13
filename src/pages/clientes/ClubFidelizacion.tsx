import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, CARDS, lbl, lblSm, kpiMid, TABS_PILL } from '@/components/panel/resumen/tokens'
import { fmtEur, fmtNumES } from '@/utils/format'

/* ═════════════ CLUB DE FIDELIZACIÓN STREAT LAB ═════════════
   Tokens y estilos canónicos Binagre (Panel Global).
   Tablas: crm_club_config, crm_club_niveles, crm_club_recompensas, crm_club_socios, crm_club_movimientos
*/

type Config = { id: number; nombre_programa: string; puntos_por_euro: number; euros_por_100_puntos: number; bienvenida_puntos: number; cumple_puntos: number; activo: boolean }
type Nivel = { id: number; nombre: string; min_pedidos: number; beneficio: string; color: string; orden: number }
type Recompensa = { id: number; nombre: string; coste_puntos: number; tipo: string; activa: boolean }
type Socio = { id: string; nombre: string | null; email: string | null; telefono: string | null; puntos_actuales: number; puntos_historicos: number; nivel_id: number | null; fecha_alta: string; ultima_actividad: string | null }
type Movimiento = { id: number; socio_id: string; fecha: string; tipo: string; puntos: number; motivo: string | null }

const TABS = [
  { id: 'socios', label: 'Socios' },
  { id: 'niveles', label: 'Niveles' },
  { id: 'recompensas', label: 'Recompensas' },
  { id: 'config', label: 'Configuración' },
] as const

const inp: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: `0.5px solid ${COLORS.brd}`, background: COLORS.card, color: COLORS.pri, fontSize: 13, fontFamily: FONT.body, outline: 'none', width: '100%' }
const btnPri: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', background: COLORS.accent, color: '#fff', fontFamily: FONT.body, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnGhost: React.CSSProperties = { padding: '4px 10px', borderRadius: 6, border: `0.5px solid ${COLORS.brd}`, background: 'transparent', color: COLORS.sec, cursor: 'pointer', fontSize: 11, fontFamily: FONT.body }
const th: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLORS.mut, fontWeight: 500, padding: '8px 10px', textAlign: 'left', borderBottom: `1px solid ${COLORS.brd}` }
const td: React.CSSProperties = { fontFamily: FONT.body, fontSize: 13, color: COLORS.sec, padding: '8px 10px', borderBottom: `1px solid ${COLORS.group}` }
const TIPO_RECOMPENSA: Record<string, string> = { descuento: 'Descuento', producto_gratis: 'Producto gratis', envio_gratis: 'Envío gratis', experiencia: 'Experiencia' }

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ ...CARDS.std, flex: 1, minWidth: 170 }}>
      <div style={lbl}>{label}</div>
      <div style={{ ...kpiMid, marginTop: 6, color: color ?? COLORS.pri }}>{value}</div>
      {sub && <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function ClubFidelizacion() {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('socios')
  const [config, setConfig] = useState<Config | null>(null)
  const [niveles, setNiveles] = useState<Nivel[]>([])
  const [recompensas, setRecompensas] = useState<Recompensa[]>([])
  const [socios, setSocios] = useState<Socio[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState('')

  async function cargar() {
    setCargando(true)
    const [cf, n, r, s, m] = await Promise.all([
      supabase.from('crm_club_config').select('*').eq('id', 1).single(),
      supabase.from('crm_club_niveles').select('*').order('orden'),
      supabase.from('crm_club_recompensas').select('*').order('coste_puntos'),
      supabase.from('crm_club_socios').select('*').order('puntos_actuales', { ascending: false }),
      supabase.from('crm_club_movimientos').select('*').order('fecha', { ascending: false }).limit(500),
    ])
    setConfig((cf.data as Config) || null)
    setNiveles((n.data as Nivel[]) || [])
    setRecompensas((r.data as Recompensa[]) || [])
    setSocios((s.data as Socio[]) || [])
    setMovimientos((m.data as Movimiento[]) || [])
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])
  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', padding: '24px 28px', fontFamily: FONT.body, color: COLORS.pri }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: COLORS.redSL, letterSpacing: 3, textTransform: 'uppercase' }}>CLUB DE FIDELIZACIÓN</div>
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut, marginTop: 2 }}>{config?.nombre_programa || 'Club Streat Lab'} · puntos, niveles y recompensas del canal propio</div>
      </div>

      <div style={TABS_PILL.container}>
        {TABS.map(t2 => (
          <button key={t2.id} onClick={() => setTab(t2.id)} style={tab === t2.id ? TABS_PILL.active : TABS_PILL.inactive}>{t2.label}</button>
        ))}
      </div>

      {msg && <div style={{ ...CARDS.std, borderLeft: `3px solid ${COLORS.ok}`, margin: '12px 0', fontSize: 13, color: COLORS.pri }}>{msg}</div>}

      {cargando ? (
        <div style={{ color: COLORS.mut, fontSize: 14, padding: 24 }}>Cargando club...</div>
      ) : (
        <div style={{ marginTop: 14 }}>
          {tab === 'socios' && <TabSocios socios={socios} niveles={niveles} movimientos={movimientos} config={config} onSaved={(t: string) => { cargar(); flash(t) }} />}
          {tab === 'niveles' && <TabNiveles niveles={niveles} socios={socios} />}
          {tab === 'recompensas' && <TabRecompensas recompensas={recompensas} config={config} onSaved={() => { cargar(); flash('Recompensas actualizadas') }} />}
          {tab === 'config' && config && <TabConfig config={config} onSaved={() => { cargar(); flash('Configuración guardada') }} />}
        </div>
      )}
    </div>
  )
}

/* ═════════════ SOCIOS ═════════════ */
function TabSocios({ socios, niveles, movimientos, config, onSaved }: { socios: Socio[]; niveles: Nivel[]; movimientos: Movimiento[]; config: Config | null; onSaved: (t: string) => void }) {
  const [alta, setAlta] = useState({ nombre: '', email: '', telefono: '' })
  const [accId, setAccId] = useState<string | null>(null)
  const [acc, setAcc] = useState({ tipo: 'gana', puntos: '', motivo: '' })

  const totalPuntos = socios.reduce((s, x) => s + (x.puntos_actuales || 0), 0)
  const nivelDe = (s: Socio) => niveles.find(n => n.id === s.nivel_id)

  function nivelInicial() { return niveles[0]?.id ?? null }

  async function altaSocio() {
    if (!alta.email && !alta.telefono) return
    const bienvenida = config?.bienvenida_puntos ?? 0
    const { data } = await supabase.from('crm_club_socios').insert({ nombre: alta.nombre || null, email: alta.email || null, telefono: alta.telefono || null, puntos_actuales: bienvenida, puntos_historicos: bienvenida, nivel_id: nivelInicial(), ultima_actividad: new Date().toISOString().slice(0, 10) }).select().single()
    if (data && bienvenida > 0) await supabase.from('crm_club_movimientos').insert({ socio_id: (data as Socio).id, tipo: 'gana', puntos: bienvenida, motivo: 'Bienvenida' })
    setAlta({ nombre: '', email: '', telefono: '' }); onSaved('Socio dado de alta')
  }

  async function aplicarMovimiento(s: Socio) {
    const p = Number(acc.puntos) || 0
    if (!p) return
    const delta = acc.tipo === 'canjea' ? -p : p
    const nuevos = Math.max(0, (s.puntos_actuales || 0) + delta)
    const hist = acc.tipo === 'gana' ? (s.puntos_historicos || 0) + p : s.puntos_historicos
    await supabase.from('crm_club_movimientos').insert({ socio_id: s.id, tipo: acc.tipo, puntos: p, motivo: acc.motivo || null })
    await supabase.from('crm_club_socios').update({ puntos_actuales: nuevos, puntos_historicos: hist, ultima_actividad: new Date().toISOString().slice(0, 10) }).eq('id', s.id)
    setAccId(null); setAcc({ tipo: 'gana', puntos: '', motivo: '' }); onSaved('Movimiento aplicado')
  }

  const movDe = (id: string) => movimientos.filter(m => m.socio_id === id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard label="Socios" value={String(socios.length)} />
        <KpiCard label="Puntos en circulación" value={fmtNumES(totalPuntos)} color={COLORS.redSL} />
        <KpiCard label="Valor estimado" value={fmtEur(config ? totalPuntos / 100 * config.euros_por_100_puntos : 0)} sub="pasivo del club" color={COLORS.warn} />
      </div>

      <div style={CARDS.std}>
        <div style={{ ...lblSm, marginBottom: 12 }}>Alta de socio{config?.bienvenida_puntos ? ` (+${config.bienvenida_puntos} pts bienvenida)` : ''}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, alignItems: 'center' }}>
          <input placeholder="Nombre" value={alta.nombre} onChange={e => setAlta({ ...alta, nombre: e.target.value })} style={inp} />
          <input placeholder="Email" value={alta.email} onChange={e => setAlta({ ...alta, email: e.target.value })} style={inp} />
          <input placeholder="Teléfono" value={alta.telefono} onChange={e => setAlta({ ...alta, telefono: e.target.value })} style={inp} />
          <button onClick={altaSocio} style={btnPri}>Alta socio</button>
        </div>
      </div>

      <div style={CARDS.std}>
        <div style={{ ...lbl, marginBottom: 12 }}>Socios del club</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Socio</th><th style={th}>Nivel</th><th style={{ ...th, textAlign: 'right' }}>Puntos</th><th style={{ ...th, textAlign: 'right' }}>Histórico</th><th style={th}>Última actividad</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {socios.length === 0 && <tr><td colSpan={6} style={{ ...td, color: COLORS.mut }}>Sin socios todavía. Da de alta a tus primeros clientes del canal propio.</td></tr>}
              {socios.map(s => {
                const n = nivelDe(s)
                return (
                  <>
                    <tr key={s.id}>
                      <td style={td}>{s.nombre || s.email || s.telefono || '—'}</td>
                      <td style={td}>{n ? <span style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4, background: n.color, color: '#fff' }}>{n.nombre}</span> : '—'}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: FONT.heading, color: COLORS.redSL, fontWeight: 600 }}>{fmtNumES(s.puntos_actuales)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{fmtNumES(s.puntos_historicos)}</td>
                      <td style={td}>{s.ultima_actividad || '—'}</td>
                      <td style={td}><button onClick={() => setAccId(accId === s.id ? null : s.id)} style={btnGhost}>Puntos</button></td>
                    </tr>
                    {accId === s.id && (
                      <tr key={s.id + '-acc'}>
                        <td colSpan={6} style={{ ...td, background: COLORS.bg }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <select value={acc.tipo} onChange={e => setAcc({ ...acc, tipo: e.target.value })} style={{ ...inp, width: 140 }}>
                              <option value="gana">Ganar puntos</option>
                              <option value="canjea">Canjear puntos</option>
                              <option value="ajuste">Ajuste manual</option>
                            </select>
                            <input type="number" placeholder="Puntos" value={acc.puntos} onChange={e => setAcc({ ...acc, puntos: e.target.value })} style={{ ...inp, width: 110 }} />
                            <input placeholder="Motivo" value={acc.motivo} onChange={e => setAcc({ ...acc, motivo: e.target.value })} style={{ ...inp, width: 220 }} />
                            <button onClick={() => aplicarMovimiento(s)} style={btnPri}>Aplicar</button>
                          </div>
                          {movDe(s.id).length > 0 && (
                            <div style={{ marginTop: 8, fontFamily: FONT.body, fontSize: 12, color: COLORS.mut }}>
                              {movDe(s.id).slice(0, 5).map(m => (
                                <div key={m.id}>{m.fecha.slice(0, 10)} · {m.tipo} {m.tipo === 'canjea' ? '-' : '+'}{m.puntos} {m.motivo ? `· ${m.motivo}` : ''}</div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ═════════════ NIVELES ═════════════ */
function TabNiveles({ niveles, socios }: { niveles: Nivel[]; socios: Socio[] }) {
  const conteo = useMemo(() => {
    const m: Record<number, number> = {}
    socios.forEach(s => { if (s.nivel_id) m[s.nivel_id] = (m[s.nivel_id] || 0) + 1 })
    return m
  }, [socios])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
      {niveles.map(n => (
        <div key={n.id} style={{ ...CARDS.std, borderTop: `3px solid ${n.color}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 17, fontWeight: 600, color: n.color, letterSpacing: '0.5px' }}>{n.nombre}</div>
            <span style={{ fontFamily: FONT.heading, fontSize: 20, fontWeight: 600, color: COLORS.pri }}>{conteo[n.id] || 0}</span>
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginBottom: 8 }}>Desde {n.min_pedidos} pedidos · {conteo[n.id] || 0} socios</div>
          <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.sec }}>{n.beneficio}</div>
        </div>
      ))}
    </div>
  )
}

/* ═════════════ RECOMPENSAS ═════════════ */
function TabRecompensas({ recompensas, config, onSaved }: { recompensas: Recompensa[]; config: Config | null; onSaved: () => void }) {
  const [nueva, setNueva] = useState({ nombre: '', coste_puntos: '', tipo: 'descuento' })
  async function crear() {
    if (!nueva.nombre || !nueva.coste_puntos) return
    await supabase.from('crm_club_recompensas').insert({ nombre: nueva.nombre, coste_puntos: Number(nueva.coste_puntos), tipo: nueva.tipo, activa: true })
    setNueva({ nombre: '', coste_puntos: '', tipo: 'descuento' }); onSaved()
  }
  async function toggle(r: Recompensa) { await supabase.from('crm_club_recompensas').update({ activa: !r.activa }).eq('id', r.id); onSaved() }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
        {recompensas.map(r => (
          <div key={r.id} style={{ ...CARDS.std, opacity: r.activa ? 1 : 0.55 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 15, fontWeight: 600, color: COLORS.pri }}>{r.nombre}</div>
              <button onClick={() => toggle(r)} style={{ ...btnGhost, color: r.activa ? COLORS.ok : COLORS.mut }}>{r.activa ? 'Activa' : 'Inactiva'}</button>
            </div>
            <div style={{ ...kpiMid, color: COLORS.redSL, marginTop: 6 }}>{fmtNumES(r.coste_puntos)} <span style={{ fontSize: 13, color: COLORS.mut }}>pts</span></div>
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 2 }}>
              {TIPO_RECOMPENSA[r.tipo] || r.tipo}{config ? ` · ≈ ${fmtEur(r.coste_puntos / 100 * config.euros_por_100_puntos)}` : ''}
            </div>
          </div>
        ))}
      </div>

      <div style={CARDS.std}>
        <div style={{ ...lblSm, marginBottom: 12 }}>Nueva recompensa</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, alignItems: 'center' }}>
          <input placeholder="Nombre" value={nueva.nombre} onChange={e => setNueva({ ...nueva, nombre: e.target.value })} style={inp} />
          <input type="number" placeholder="Coste en puntos" value={nueva.coste_puntos} onChange={e => setNueva({ ...nueva, coste_puntos: e.target.value })} style={inp} />
          <select value={nueva.tipo} onChange={e => setNueva({ ...nueva, tipo: e.target.value })} style={inp}>
            {Object.entries(TIPO_RECOMPENSA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={crear} style={btnPri}>Crear</button>
        </div>
      </div>
    </div>
  )
}

/* ═════════════ CONFIG ═════════════ */
function TabConfig({ config, onSaved }: { config: Config; onSaved: () => void }) {
  const [c, setC] = useState<Config>(config)
  async function guardar() {
    await supabase.from('crm_club_config').update({
      nombre_programa: c.nombre_programa, puntos_por_euro: Number(c.puntos_por_euro), euros_por_100_puntos: Number(c.euros_por_100_puntos),
      bienvenida_puntos: Number(c.bienvenida_puntos), cumple_puntos: Number(c.cumple_puntos), activo: c.activo,
    }).eq('id', 1)
    onSaved()
  }
  const field = (label: string, key: keyof Config, type = 'number') => (
    <div>
      <div style={{ ...lblSm, marginBottom: 4 }}>{label}</div>
      <input type={type} value={String(c[key])} onChange={e => setC({ ...c, [key]: e.target.value } as any)} style={inp} />
    </div>
  )
  return (
    <div style={{ ...CARDS.std, maxWidth: 560 }}>
      <div style={{ ...lbl, marginBottom: 14 }}>Reglas del programa</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
        {field('Nombre del programa', 'nombre_programa', 'text')}
        {field('Puntos por € gastado', 'puntos_por_euro')}
        {field('€ por cada 100 puntos', 'euros_por_100_puntos')}
        {field('Puntos de bienvenida', 'bienvenida_puntos')}
        {field('Puntos de cumpleaños', 'cumple_puntos')}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT.body, fontSize: 13, color: COLORS.sec, cursor: 'pointer', marginTop: 14 }}>
        <input type="checkbox" checked={c.activo} onChange={e => setC({ ...c, activo: e.target.checked })} style={{ accentColor: COLORS.accent }} /> Programa activo
      </label>
      <div style={{ marginTop: 16 }}><button onClick={guardar} style={btnPri}>Guardar configuración</button></div>
      <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 14, lineHeight: 1.5 }}>
        Equivalencia actual: 1 € gastado = {c.puntos_por_euro} pts · 100 pts = {fmtEur(Number(c.euros_por_100_puntos))}. El club solo aplica al canal propio (web/directa); en plataformas no hay identidad de cliente.
      </div>
    </div>
  )
}
