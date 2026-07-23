import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { INK, BLANCO, OSW, LEX, GRANATE, VERDE, AMA, GRIS, ROSA } from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel, SHADOW_DURA } from '@/components/kit/cantera'
import { fmtEur, fmtNumES } from '@/utils/format'

/* ═════════════ CLUB DE FIDELIZACIÓN STREAT LAB ═════════════
   CANTERA ALEGRE v1.0 (área Clientes/Marketing · rosa). Solo capa visual.
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

const inp: React.CSSProperties = { padding: '8px 10px', border: `2px solid ${INK}`, borderRadius: 0, background: BLANCO, color: INK, fontSize: 13, fontFamily: LEX, outline: 'none', width: '100%' }
const btnPri: React.CSSProperties = { padding: '9px 16px', border: `2px solid ${INK}`, borderRadius: 0, background: GRANATE, color: BLANCO, fontFamily: OSW, fontSize: 13, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer', boxShadow: SHADOW_DURA }
const btnGhost: React.CSSProperties = { padding: '6px 12px', border: `2px solid ${INK}`, borderRadius: 0, background: BLANCO, color: INK, cursor: 'pointer', fontSize: 11, fontFamily: OSW, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }
const th: React.CSSProperties = { fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: BLANCO, fontWeight: 600, padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { fontFamily: LEX, fontSize: 13, color: INK, padding: '10px 12px', borderBottom: `2px solid ${INK}` }
const lblXsLocal: React.CSSProperties = { fontFamily: OSW, fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: GRIS }
const lblCelda: React.CSSProperties = { fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }
const valCelda: React.CSSProperties = { fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }
const subCelda: React.CSSProperties = { fontFamily: LEX, fontSize: 12, marginTop: 4 }
const TIPO_RECOMPENSA: Record<string, string> = { descuento: 'Descuento', producto_gratis: 'Producto gratis', envio_gratis: 'Envío gratis', experiencia: 'Experiencia' }

function StatCelda({ label, value, sub, bg = BLANCO, color, first }: { label: string; value: string; sub?: string; bg?: string; color?: string; first?: boolean }) {
  return (
    <PlanchaCelda bg={bg} color={color} first={first}>
      <div style={lblCelda}>{label}</div>
      <div style={valCelda}>{value}</div>
      {sub && <div style={subCelda}>{sub}</div>}
    </PlanchaCelda>
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

  if (cargando) {
    return (
      <PantallaCantera>
        <div style={{ padding: 40, color: GRIS, fontFamily: OSW, textTransform: 'uppercase', letterSpacing: '1px' }}>Cargando club…</div>
      </PantallaCantera>
    )
  }

  const totalPuntos = socios.reduce((s, x) => s + (x.puntos_actuales || 0), 0)
  const valorEstimado = config ? totalPuntos / 100 * config.euros_por_100_puntos : 0
  const activosUlt30 = socios.filter(s => s.ultima_actividad && s.ultima_actividad >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)).length

  const titular = socios.length === 0
    ? 'El club aún no tiene socios: cada alta desde el canal propio suma fidelización sin comisión de plataforma.'
    : `${config?.nombre_programa || 'El club'} mueve ${fmtNumES(totalPuntos)} puntos en circulación entre ${socios.length} socios.`

  const atencionHero = [
    socios.length ? `${socios.length} socios` : null,
    activosUlt30 ? `${activosUlt30} activos últimos 30d` : null,
    recompensas.filter(r => r.activa).length ? `${recompensas.filter(r => r.activa).length} recompensas activas` : null,
    config && !config.activo ? 'Programa inactivo' : null,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera>
      {/* 1 · Héroe del área Clientes (rosa) */}
      <HeroCantera
        area="marketing"
        titular={titular}
        etiquetaDato="Puntos en circulación"
        cifra={fmtNumES(totalPuntos)}
        resumen={<>Valor estimado del pasivo del club: <b>{fmtEur(valorEstimado)}</b></>}
        atencion={atencionHero}
      />

      {/* 2 · Plancha de KPIs del hub */}
      <div>
        <SeccionLabel bg={GRANATE}>Estado del club</SeccionLabel>
        <Plancha>
          <StatCelda first bg={GRANATE} label="Socios" value={String(socios.length)} />
          <StatCelda bg={AMA} color={INK} label="Puntos en circulación" value={fmtNumES(totalPuntos)} />
          <StatCelda bg={INK} color={BLANCO} label="Valor estimado" value={fmtEur(valorEstimado)} sub="pasivo del club" />
          <StatCelda bg={VERDE} label="Activos últimos 30d" value={String(activosUlt30)} />
        </Plancha>
      </div>

      {/* 3 · Frase potente */}
      {config && !config.activo ? (
        <FrasePotente significado="peligro">El programa está marcado como inactivo: revisa la Configuración antes de seguir dando de alta socios.</FrasePotente>
      ) : (
        <FrasePotente significado="oportunidad">Cada socio del club es un cliente sin comisión de plataforma: la palanca de fidelización más rentable.</FrasePotente>
      )}

      {msg && (
        <div style={{ background: BLANCO, border: `3px solid ${INK}`, borderLeft: `7px solid ${VERDE}`, borderRadius: 0, padding: '10px 16px', fontFamily: LEX, fontSize: 13, color: INK }}>{msg}</div>
      )}

      {/* Navegación propia de la pantalla — pastillas planas arriba-derecha */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map(t2 => {
            const on = tab === t2.id
            return (
              <button key={t2.id} onClick={() => setTab(t2.id)} style={{
                padding: '8px 16px', border: `2px solid ${INK}`, borderRadius: 0,
                background: on ? GRANATE : BLANCO, color: on ? BLANCO : INK,
                boxShadow: on ? SHADOW_DURA : 'none',
                fontFamily: OSW, fontSize: 12.5, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
              }}>{t2.label}</button>
            )
          })}
        </div>
      </div>

      {tab === 'socios' && <TabSocios socios={socios} niveles={niveles} movimientos={movimientos} config={config} onSaved={(t: string) => { cargar(); flash(t) }} />}
      {tab === 'niveles' && <TabNiveles niveles={niveles} socios={socios} />}
      {tab === 'recompensas' && <TabRecompensas recompensas={recompensas} config={config} onSaved={() => { cargar(); flash('Recompensas actualizadas') }} />}
      {tab === 'config' && config && <TabConfig config={config} onSaved={() => { cargar(); flash('Configuración guardada') }} />}
    </PantallaCantera>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <SeccionLabel bg={GRANATE}>Alta de socio{config?.bienvenida_puntos ? ` (+${config.bienvenida_puntos} pts bienvenida)` : ''}</SeccionLabel>
        <Papel ceja={GRANATE}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <input placeholder="Nombre" value={alta.nombre} onChange={e => setAlta({ ...alta, nombre: e.target.value })} style={{ ...inp, flex: '1 1 160px' }} />
            <input placeholder="Email" value={alta.email} onChange={e => setAlta({ ...alta, email: e.target.value })} style={{ ...inp, flex: '1 1 160px' }} />
            <input placeholder="Teléfono" value={alta.telefono} onChange={e => setAlta({ ...alta, telefono: e.target.value })} style={{ ...inp, flex: '1 1 160px' }} />
            <button onClick={altaSocio} style={btnPri}>Alta socio</button>
          </div>
        </Papel>
      </div>

      <div>
        <SeccionLabel bg={INK} color={BLANCO}>Socios del club — {socios.length}</SeccionLabel>
        <Papel ceja={INK} pad="0" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: INK }}>
              <th style={th}>Socio</th><th style={th}>Nivel</th><th style={{ ...th, textAlign: 'right' }}>Puntos</th><th style={{ ...th, textAlign: 'right' }}>Histórico</th><th style={th}>Última actividad</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {socios.length === 0 && <tr><td colSpan={6} style={{ ...td, color: GRIS }}>Sin socios todavía. Da de alta a tus primeros clientes del canal propio.</td></tr>}
              {socios.map(s => {
                const n = nivelDe(s)
                return (
                  <>
                    <tr key={s.id}>
                      <td style={td}>{s.nombre || s.email || s.telefono || '—'}</td>
                      <td style={td}>{n ? <span style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: 700, padding: '2px 8px', border: `2px solid ${INK}`, background: n.color, color: BLANCO }}>{n.nombre}</span> : '—'}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: OSW, color: GRANATE, fontWeight: 700 }}>{fmtNumES(s.puntos_actuales)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{fmtNumES(s.puntos_historicos)}</td>
                      <td style={td}>{s.ultima_actividad || '—'}</td>
                      <td style={td}><button onClick={() => setAccId(accId === s.id ? null : s.id)} style={btnGhost}>Puntos</button></td>
                    </tr>
                    {accId === s.id && (
                      <tr key={s.id + '-acc'}>
                        <td colSpan={6} style={{ ...td, background: BLANCO }}>
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
                            <div style={{ marginTop: 8, fontFamily: LEX, fontSize: 12, color: GRIS }}>
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
        </Papel>
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
    <div>
      <SeccionLabel bg={ROSA}>Niveles del programa</SeccionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        {niveles.map(n => (
          <div key={n.id} style={{ flex: '1 1 260px', minWidth: 240 }}>
            <Papel ceja={n.color}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontFamily: OSW, fontSize: 17, fontWeight: 700, color: n.color, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{n.nombre}</div>
                <span style={{ fontFamily: OSW, fontSize: 22, fontWeight: 700, color: INK }}>{conteo[n.id] || 0}</span>
              </div>
              <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginBottom: 8 }}>Desde {n.min_pedidos} pedidos · {conteo[n.id] || 0} socios</div>
              <div style={{ fontFamily: LEX, fontSize: 13, color: INK }}>{n.beneficio}</div>
            </Papel>
          </div>
        ))}
      </div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <SeccionLabel bg={GRANATE}>Recompensas del club</SeccionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {recompensas.map(r => (
            <div key={r.id} style={{ flex: '1 1 220px', minWidth: 200, opacity: r.activa ? 1 : 0.55 }}>
              <Papel ceja={r.activa ? VERDE : GRIS}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontFamily: OSW, fontSize: 15, fontWeight: 700, color: INK }}>{r.nombre}</div>
                  <button onClick={() => toggle(r)} style={{ ...btnGhost, color: r.activa ? VERDE : GRIS }}>{r.activa ? 'Activa' : 'Inactiva'}</button>
                </div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, color: GRANATE, marginTop: 6 }}>{fmtNumES(r.coste_puntos)} <span style={{ fontSize: 13, color: GRIS, fontWeight: 400 }}>pts</span></div>
                <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 2 }}>
                  {TIPO_RECOMPENSA[r.tipo] || r.tipo}{config ? ` · ≈ ${fmtEur(r.coste_puntos / 100 * config.euros_por_100_puntos)}` : ''}
                </div>
              </Papel>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SeccionLabel bg={AMA} color={INK}>Nueva recompensa</SeccionLabel>
        <Papel ceja={AMA}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <input placeholder="Nombre" value={nueva.nombre} onChange={e => setNueva({ ...nueva, nombre: e.target.value })} style={{ ...inp, flex: '1 1 150px' }} />
            <input type="number" placeholder="Coste en puntos" value={nueva.coste_puntos} onChange={e => setNueva({ ...nueva, coste_puntos: e.target.value })} style={{ ...inp, flex: '1 1 150px' }} />
            <select value={nueva.tipo} onChange={e => setNueva({ ...nueva, tipo: e.target.value })} style={{ ...inp, flex: '1 1 150px' }}>
              {Object.entries(TIPO_RECOMPENSA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={crear} style={btnPri}>Crear</button>
          </div>
        </Papel>
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
    <div style={{ flex: '1 1 200px' }}>
      <div style={{ ...lblXsLocal, marginBottom: 4 }}>{label}</div>
      <input type={type} value={String(c[key])} onChange={e => setC({ ...c, [key]: e.target.value } as any)} style={inp} />
    </div>
  )
  return (
    <div>
      <SeccionLabel bg={GRANATE}>Reglas del programa</SeccionLabel>
      <Papel ceja={GRANATE} style={{ maxWidth: 620 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {field('Nombre del programa', 'nombre_programa', 'text')}
          {field('Puntos por € gastado', 'puntos_por_euro')}
          {field('€ por cada 100 puntos', 'euros_por_100_puntos')}
          {field('Puntos de bienvenida', 'bienvenida_puntos')}
          {field('Puntos de cumpleaños', 'cumple_puntos')}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: LEX, fontSize: 13, color: INK, cursor: 'pointer', marginTop: 14 }}>
          <input type="checkbox" checked={c.activo} onChange={e => setC({ ...c, activo: e.target.checked })} style={{ accentColor: GRANATE }} /> Programa activo
        </label>
        <div style={{ marginTop: 16 }}><button onClick={guardar} style={btnPri}>Guardar configuración</button></div>
        <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 14, lineHeight: 1.5 }}>
          Equivalencia actual: 1 € gastado = {c.puntos_por_euro} pts · 100 pts = {fmtEur(Number(c.euros_por_100_puntos))}. El club solo aplica al canal propio (web/directa); en plataformas no hay identidad de cliente.
        </div>
      </Papel>
    </div>
  )
}
