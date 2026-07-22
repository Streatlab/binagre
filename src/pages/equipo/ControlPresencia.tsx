import { BLANCO, GRANATE, GRIS, INK, LIMA, VERDE } from '@/styles/neobrutal'
import { PRESENCIA_WASH_VERDE_BG, PRESENCIA_WASH_ROJO_BG, PRESENCIA_SALIDA_TXT } from '@/styles/palettes'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'

// ── Types ──────────────────────────────────────────────────────────────────

interface Usuario {
  id: string
  nombre: string
  email?: string | null
  activo?: boolean | null
}

interface Fichaje {
  id: string
  usuario_id: string
  tipo: 'entrada' | 'salida'
  timestamp: string
  nota: string | null
  created_at: string
}

interface EstadoEmpleado {
  usuario: Usuario
  dentro: boolean
  horaEntrada: string | null
  horasHoy: number
}

// ── Constants ──────────────────────────────────────────────────────────────

const BG = INK
const CARD = INK
const CARD2 = INK
const BRD = INK
const BRD2 = INK
const PRI = BLANCO
const MUT = GRIS
const ROJO = GRANATE
const AMARILLO = LIMA
const FONT_BODY = FONT.body
const FONT_LABEL = FONT.heading

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtHora(ts: string): string {
  return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function fmtFecha(ts: string): string {
  return new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtHorasFmt(h: number): string {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return `${hh}h ${mm.toString().padStart(2, '0')}m`
}

function hoyISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function mesInicioISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function calcHorasEntrePares(fichajes: Fichaje[]): number {
  const sorted = [...fichajes].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  let total = 0
  let entrada: Date | null = null
  for (const f of sorted) {
    if (f.tipo === 'entrada') {
      entrada = new Date(f.timestamp)
    } else if (f.tipo === 'salida' && entrada) {
      total += (new Date(f.timestamp).getTime() - entrada.getTime()) / 3600000
      entrada = null
    }
  }
  if (entrada) {
    total += (Date.now() - entrada.getTime()) / 3600000
  }
  return total
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiBadge({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      background: CARD,
      border: `1px solid ${BRD}`,
      borderRadius: 10,
      padding: '14px 20px',
      minWidth: 140,
    }}>
      <div style={{ fontFamily: FONT_LABEL, fontSize: 11, color: MUT, letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: FONT_LABEL, fontSize: 28, fontWeight: 700, color: color ?? PRI }}>{value}</div>
    </div>
  )
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: FONT_LABEL,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '1px',
        textTransform: 'uppercase' as const,
        padding: '8px 18px',
        borderRadius: 6,
        border: active ? `1px solid ${ROJO}` : `1px solid ${BRD}`,
        background: active ? ROJO : 'transparent',
        color: active ? BLANCO : MUT,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function ControlPresencia() {
  const [tab, setTab] = useState<'ahora' | 'hoy' | 'historico'>('ahora')
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [fichajesHoy, setFichajesHoy] = useState<Fichaje[]>([])
  const [loading, setLoading] = useState(true)
  const [tableExists, setTableExists] = useState(true)
  const [inicializando, setInicializando] = useState(false)
  const [fichandoId, setFichandoId] = useState<string | null>(null)

  // Histórico
  const [histUsuarioId, setHistUsuarioId] = useState<string>('')
  const [histDesde, setHistDesde] = useState<string>(mesInicioISO())
  const [histHasta, setHistHasta] = useState<string>(hoyISO())
  const [fichajesHist, setFichajesHist] = useState<Fichaje[]>([])
  const [loadingHist, setLoadingHist] = useState(false)

  const cargarTodo = useCallback(async () => {
    setLoading(true)
    try {
      const { data: uData, error: uErr } = await supabase
        .from('usuarios')
        .select('id, nombre, email, activo')
        .order('nombre')

      if (uErr) { setLoading(false); return }
      const activos = (uData ?? []).filter((u: Usuario) => u.activo !== false)
      setUsuarios(activos)
      if (activos.length > 0) {
        setHistUsuarioId(prev => prev || activos[0].id)
      }

      const hoy = hoyISO()
      const { data: fData, error: fErr } = await supabase
        .from('fichajes')
        .select('*')
        .gte('timestamp', `${hoy}T00:00:00`)
        .lte('timestamp', `${hoy}T23:59:59`)
        .order('timestamp', { ascending: true })

      if (fErr && (fErr as { code?: string }).code === '42P01') {
        setTableExists(false)
        setLoading(false)
        return
      }

      setTableExists(true)
      setFichajesHoy((fData as Fichaje[]) ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarTodo() }, [cargarTodo])

  const estadoActual: EstadoEmpleado[] = usuarios.map(u => {
    const mis = fichajesHoy.filter(f => f.usuario_id === u.id)
    const sorted = [...mis].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const ultimo = sorted[sorted.length - 1]
    const dentro = ultimo?.tipo === 'entrada'
    const primeraEntrada = sorted.find(f => f.tipo === 'entrada')
    return {
      usuario: u,
      dentro,
      horaEntrada: primeraEntrada ? fmtHora(primeraEntrada.timestamp) : null,
      horasHoy: calcHorasEntrePares(mis),
    }
  })

  const dentroCount = estadoActual.filter(e => e.dentro).length

  async function fichar(usuarioId: string, tipo: 'entrada' | 'salida') {
    setFichandoId(usuarioId)
    await supabase.from('fichajes').insert({
      usuario_id: usuarioId,
      tipo,
      timestamp: new Date().toISOString(),
      nota: null,
    })
    setFichandoId(null)
    cargarTodo()
  }

  async function inicializarBD() {
    setInicializando(true)
    const sql = `CREATE TABLE IF NOT EXISTS fichajes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id uuid REFERENCES usuarios(id),
      tipo text CHECK (tipo IN ('entrada','salida')),
      timestamp timestamptz DEFAULT now(),
      nota text,
      created_at timestamptz DEFAULT now()
    );`
    // Intenta via rpc si existe, si no, muestra aviso
    const { error } = await supabase.rpc('execute_sql' as never, { query: sql })
    if (error) {
      alert('No se pudo crear la tabla automáticamente. Ejecuta el SQL manualmente en Supabase:\n\n' + sql)
    }
    setInicializando(false)
    cargarTodo()
  }

  async function cargarHistorico() {
    if (!histUsuarioId) return
    setLoadingHist(true)
    const { data } = await supabase
      .from('fichajes')
      .select('*')
      .eq('usuario_id', histUsuarioId)
      .gte('timestamp', `${histDesde}T00:00:00`)
      .lte('timestamp', `${histHasta}T23:59:59`)
      .order('timestamp', { ascending: true })
    setFichajesHist((data as Fichaje[]) ?? [])
    setLoadingHist(false)
  }

  useEffect(() => {
    if (tab === 'historico' && histUsuarioId) cargarHistorico()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, histUsuarioId, histDesde, histHasta])

  type DiaResumen = {
    fecha: string
    entrada: string | null
    salida: string | null
    horas: number
    nota: string | null
  }

  function agruparPorDia(fics: Fichaje[]): DiaResumen[] {
    const dias: Record<string, Fichaje[]> = {}
    for (const f of fics) {
      const dia = f.timestamp.slice(0, 10)
      if (!dias[dia]) dias[dia] = []
      dias[dia].push(f)
    }
    return Object.entries(dias).map(([fecha, fs]) => {
      const sorted = [...fs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      const e = sorted.find(f => f.tipo === 'entrada')
      const s = [...sorted].reverse().find(f => f.tipo === 'salida')
      return {
        fecha,
        entrada: e ? fmtHora(e.timestamp) : null,
        salida: s ? fmtHora(s.timestamp) : null,
        horas: calcHorasEntrePares(fs),
        nota: e?.nota ?? s?.nota ?? null,
      }
    }).sort((a, b) => a.fecha.localeCompare(b.fecha))
  }

  const diasHist = agruparPorDia(fichajesHist)
  const totalHorasPeriodo = diasHist.reduce((acc, d) => acc + d.horas, 0)

  const inputStyle = {
    background: INK,
    border: `1px solid ${BRD2}`,
    borderRadius: 6,
    color: PRI,
    fontFamily: FONT_BODY,
    fontSize: 13,
    padding: '6px 10px',
  }

  if (loading) {
    return (
      <div style={{ background: BG, minHeight: '100vh', padding: '28px', fontFamily: FONT_BODY, color: MUT }}>
        Cargando...
      </div>
    )
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', padding: '28px', fontFamily: FONT_BODY }}>
      <h1 style={{ fontFamily: FONT_LABEL, fontSize: 22, letterSpacing: '3px', textTransform: 'uppercase', color: ROJO, fontWeight: 600, margin: '0 0 20px' }}>
        Control de Presencia
      </h1>

      {!tableExists && (
        <div style={{ backgroundColor: INK, border: `1px solid ${AMARILLO}`, borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
          <p style={{ color: AMARILLO, fontFamily: FONT_LABEL, fontSize: 14, margin: '0 0 8px', letterSpacing: '1px' }}>
            TABLA FICHAJES NO ENCONTRADA
          </p>
          <p style={{ color: MUT, fontSize: 13, margin: '0 0 16px' }}>
            La tabla <code style={{ color: PRI }}>fichajes</code> no existe. Pulsa para intentar crearla (requiere RPC <code style={{ color: PRI }}>execute_sql</code> habilitado).
          </p>
          <button
            onClick={inicializarBD}
            disabled={inicializando}
            style={{ background: AMARILLO, color: INK, fontFamily: FONT_LABEL, fontSize: 13, fontWeight: 700, letterSpacing: '1px', padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', textTransform: 'uppercase' }}
          >
            {inicializando ? 'Inicializando...' : 'Inicializar BD'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <TabBtn label="Ahora" active={tab === 'ahora'} onClick={() => setTab('ahora')} />
        <TabBtn label="Hoy" active={tab === 'hoy'} onClick={() => setTab('hoy')} />
        <TabBtn label="Historico" active={tab === 'historico'} onClick={() => setTab('historico')} />
      </div>

      {/* ── TAB: AHORA ── */}
      {tab === 'ahora' && (
        <div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
            <KpiBadge label="Dentro ahora" value={`${dentroCount} / ${usuarios.length}`} color={VERDE} />
            <KpiBadge label="Total empleados" value={usuarios.length} />
            <KpiBadge label="Fuera" value={usuarios.length - dentroCount} color={MUT} />
          </div>

          {estadoActual.length === 0 && (
            <p style={{ color: MUT, fontSize: 14 }}>No hay empleados activos.</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {estadoActual.map(e => (
              <div
                key={e.usuario.id}
                style={{
                  background: CARD,
                  border: `1px solid ${BRD}`,
                  borderRadius: 10,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <div style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: e.dentro ? VERDE : BRD2,
                  flexShrink: 0,
                  boxShadow: e.dentro ? `0 0 6px ${VERDE}` : 'none',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FONT_LABEL, fontSize: 14, color: PRI, fontWeight: 600 }}>{e.usuario.nombre}</div>
                  <div style={{ fontSize: 12, color: MUT, marginTop: 2 }}>
                    {e.dentro
                      ? `Entro: ${e.horaEntrada ?? '—'} · ${fmtHorasFmt(e.horasHoy)} acum. hoy`
                      : e.horasHoy > 0
                        ? `Fuera · ${fmtHorasFmt(e.horasHoy)} acum. hoy`
                        : 'Sin fichajes hoy'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 80 }}>
                  <div style={{ fontFamily: FONT_LABEL, fontSize: 16, color: e.horasHoy > 0 ? AMARILLO : MUT }}>
                    {e.horasHoy > 0 ? fmtHorasFmt(e.horasHoy) : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: MUT }}>hoy</div>
                </div>
                <button
                  disabled={fichandoId === e.usuario.id || !tableExists}
                  onClick={() => fichar(e.usuario.id, e.dentro ? 'salida' : 'entrada')}
                  style={{
                    fontFamily: FONT_LABEL,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase' as const,
                    padding: '7px 16px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: fichandoId === e.usuario.id ? 'not-allowed' : 'pointer',
                    background: e.dentro ? ROJO : VERDE,
                    color: BLANCO,
                    opacity: fichandoId === e.usuario.id ? 0.6 : 1,
                    minWidth: 110,
                  }}
                >
                  {fichandoId === e.usuario.id
                    ? 'Fichando...'
                    : e.dentro
                      ? 'Fichar Salida'
                      : 'Fichar Entrada'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: HOY ── */}
      {tab === 'hoy' && (
        <div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
            <KpiBadge
              label="Horas-persona hoy"
              value={fmtHorasFmt(fichajesHoy.length > 0 ? calcHorasEntrePares(fichajesHoy) : 0)}
              color={AMARILLO}
            />
            <KpiBadge label="Fichajes" value={fichajesHoy.length} />
          </div>

          {fichajesHoy.length === 0 ? (
            <p style={{ color: MUT, fontSize: 14 }}>Sin fichajes hoy.</p>
          ) : (
            <div style={{ background: CARD, border: `1px solid ${BRD}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '90px 1fr 100px 1fr',
                background: INK,
                padding: '10px 16px',
                fontFamily: FONT_LABEL,
                fontSize: 11,
                color: MUT,
                letterSpacing: '1.5px',
                textTransform: 'uppercase' as const,
              }}>
                <div>Hora</div>
                <div>Empleado</div>
                <div>Tipo</div>
                <div>Nota</div>
              </div>
              {fichajesHoy.map((f, i) => {
                const u = usuarios.find(uu => uu.id === f.usuario_id)
                return (
                  <div
                    key={f.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '90px 1fr 100px 1fr',
                      padding: '10px 16px',
                      background: i % 2 === 0 ? CARD : CARD2,
                      borderTop: `1px solid ${BRD}`,
                      fontSize: 13,
                      color: PRI,
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ fontFamily: FONT_LABEL, color: AMARILLO }}>{fmtHora(f.timestamp)}</div>
                    <div>{u?.nombre ?? f.usuario_id.slice(0, 8)}</div>
                    <div>
                      <span style={{
                        background: f.tipo === 'entrada' ? PRESENCIA_WASH_VERDE_BG : PRESENCIA_WASH_ROJO_BG,
                        color: f.tipo === 'entrada' ? VERDE : PRESENCIA_SALIDA_TXT,
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 11,
                        fontFamily: FONT_LABEL,
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase' as const,
                      }}>
                        {f.tipo}
                      </span>
                    </div>
                    <div style={{ color: MUT }}>{f.nota ?? '—'}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: HISTORICO ── */}
      {tab === 'historico' && (
        <div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontFamily: FONT_LABEL, fontSize: 11, color: MUT, letterSpacing: '1px', marginBottom: 4, textTransform: 'uppercase' as const }}>Empleado</div>
              <select
                value={histUsuarioId}
                onChange={ev => setHistUsuarioId(ev.target.value)}
                style={{ ...inputStyle, minWidth: 180 }}
              >
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontFamily: FONT_LABEL, fontSize: 11, color: MUT, letterSpacing: '1px', marginBottom: 4, textTransform: 'uppercase' as const }}>Desde</div>
              <input type="date" value={histDesde} onChange={ev => setHistDesde(ev.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontFamily: FONT_LABEL, fontSize: 11, color: MUT, letterSpacing: '1px', marginBottom: 4, textTransform: 'uppercase' as const }}>Hasta</div>
              <input type="date" value={histHasta} onChange={ev => setHistHasta(ev.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
            <KpiBadge label="Total horas periodo" value={fmtHorasFmt(totalHorasPeriodo)} color={AMARILLO} />
            <KpiBadge label="Dias trabajados" value={diasHist.filter(d => d.horas > 0).length} />
          </div>

          {loadingHist ? (
            <p style={{ color: MUT, fontSize: 14 }}>Cargando...</p>
          ) : diasHist.length === 0 ? (
            <p style={{ color: MUT, fontSize: 14 }}>Sin registros en el periodo.</p>
          ) : (
            <div style={{ background: CARD, border: `1px solid ${BRD}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '120px 90px 90px 90px 1fr',
                background: INK,
                padding: '10px 16px',
                fontFamily: FONT_LABEL,
                fontSize: 11,
                color: MUT,
                letterSpacing: '1.5px',
                textTransform: 'uppercase' as const,
              }}>
                <div>Fecha</div>
                <div>Entrada</div>
                <div>Salida</div>
                <div>Horas</div>
                <div>Nota</div>
              </div>
              {diasHist.map((d, i) => (
                <div
                  key={d.fecha}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '120px 90px 90px 90px 1fr',
                    padding: '10px 16px',
                    background: i % 2 === 0 ? CARD : CARD2,
                    borderTop: `1px solid ${BRD}`,
                    fontSize: 13,
                    color: PRI,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontFamily: FONT_LABEL, color: AMARILLO }}>{fmtFecha(d.fecha + 'T12:00:00')}</div>
                  <div style={{ color: VERDE }}>{d.entrada ?? '—'}</div>
                  <div style={{ color: PRESENCIA_SALIDA_TXT }}>{d.salida ?? '—'}</div>
                  <div style={{ color: d.horas > 0 ? PRI : MUT }}>{d.horas > 0 ? fmtHorasFmt(d.horas) : '—'}</div>
                  <div style={{ color: MUT }}>{d.nota ?? '—'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
