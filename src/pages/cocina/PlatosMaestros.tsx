/**
 * PlatosMaestros — Bloque 6 · UI de gestión del plato maestro.
 *
 * Punto único donde Cocina ve el catálogo real de platos (platos_maestros + platos_alias),
 * decide qué se fusiona (platos_duplicados / fn_fusionar_maestros), qué alias sueltos se
 * cuelgan de qué maestro (fn_sugerir_alias_maestro, siempre con confirmación humana) y qué
 * fichas huérfanas del Bloque 5 quedan por resolver a mano.
 *
 * Reutiliza: unificar_plato, platos_duplicados (Tanda 8) + fn_sugerir_alias_maestro,
 * fn_fusionar_maestros, fn_fusionar_ficha_huerfana (nuevas de este bloque).
 * Estilo: Neobrutal (@/styles/neobrutal), mismo patrón que CostePlato.tsx / TabEquivalencias.tsx.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  OSW, LEX, INK, CREMA, CLARO, GRIS, GRANATE, VERDE, AMA, AZUL, BLANCO,
  VERDE_S, AMA_S, ROSA_S, AZUL_S,
  SHADOW, BORDER, BORDER_CARD, d, cardWash, cardHead, pill,
} from '@/styles/neobrutal'
import RutaPantalla from '@/components/ui/RutaPantalla'

interface Maestro {
  id: number
  nombre: string
  clave: string
  euros: number
  unidades: number
  n_variantes: number
  receta_id: string | null
  gama: string | null
  activo: boolean | null
}
interface Alias {
  id: number
  alias_norm: string
  alias: string
  maestro_id: number | null
  euros: number | null
  confianza: number | null
  origen: string | null
}
interface Dup {
  id: number
  plato_a: string
  plato_b: string
  euros_a: number
  euros_b: number
  parecido: number
  decision: string
  canonico: string | null
}
interface Sugerencia {
  plato_norm: string
  plato_muestra: string
  euros: number
  unidades: number
  maestro_id: number
  maestro_nombre: string
  similitud: number
}
interface FichaHuerfana {
  id: string
  tipo: string
  nombre: string
}
interface RecetaOpt { id: string; nombre: string }
interface EpOpt { id: string; nombre: string }

type Filtro = 'sin_receta' | 'con_receta' | 'todos'

const nf0 = (n: number) => Math.round(n || 0).toLocaleString('es-ES', { useGrouping: true })
const eur0 = (n: number) => `${nf0(n)} €`
const pct1 = (n: number) => `${(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

const btn = (bg: string, color = BLANCO): React.CSSProperties => ({
  padding: '6px 12px', cursor: 'pointer', border: `2px solid ${INK}`, background: bg, color,
  fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
})
const inp: React.CSSProperties = {
  fontFamily: LEX, fontSize: 13, padding: '7px 10px', border: `2px solid ${INK}`, background: BLANCO, color: INK,
}
const th: React.CSSProperties = { padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'left' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}` }

function Vacio({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 24, textAlign: 'center', color: GRIS, fontFamily: LEX, fontSize: 13, fontWeight: 600 }}>{children}</div>
}
function Nota({ tono = 'verde', children }: { tono?: 'verde' | 'rojo' | 'ambar' | 'blu'; children: React.ReactNode }) {
  const map = { verde: VERDE_S, rojo: ROSA_S, ambar: AMA_S, blu: AZUL_S } as const
  const borde = { verde: VERDE, rojo: GRANATE, ambar: AMA, blu: AZUL } as const
  return (
    <div style={{ marginTop: 14, padding: '11px 14px', background: map[tono], border: `2px solid ${borde[tono]}`, fontFamily: LEX, fontSize: 12.5, fontWeight: 600, color: INK, lineHeight: 1.5 }}>
      {children}
    </div>
  )
}

export default function PlatosMaestros() {
  const [maestros, setMaestros] = useState<Maestro[]>([])
  const [alias, setAlias] = useState<Alias[]>([])
  const [dups, setDups] = useState<Dup[]>([])
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([])
  const [fichasHuerfanas, setFichasHuerfanas] = useState<FichaHuerfana[]>([])
  const [siblings, setSiblings] = useState<Record<string, { receta_id: string | null; eps_id: string | null }[]>>({})
  const [recetasOpt, setRecetasOpt] = useState<RecetaOpt[]>([])
  const [epsOpt, setEpsOpt] = useState<EpOpt[]>([])

  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('sin_receta')
  const [busca, setBusca] = useState('')
  const [expandido, setExpandido] = useState<Set<number>>(new Set())
  const [guardando, setGuardando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [nuevoNombre, setNuevoNombre] = useState<string | null>(null)
  const [manualAlias, setManualAlias] = useState('')
  const [manualMaestro, setManualMaestro] = useState('')
  const [rechazadas, setRechazadas] = useState<Set<string>>(new Set())
  const [dragNorm, setDragNorm] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [{ data: m }, { data: a }, { data: du }, { data: sug }, { data: fh }, { data: rec }, { data: ep }] = await Promise.all([
      supabase.from('platos_maestros').select('id,nombre,clave,euros,unidades,n_variantes,receta_id,gama,activo')
        .or('activo.is.null,activo.eq.true').order('euros', { ascending: false }),
      supabase.from('platos_alias').select('id,alias_norm,alias,maestro_id,euros,confianza,origen'),
      supabase.from('platos_duplicados').select('*').order('parecido', { ascending: false }),
      supabase.rpc('fn_sugerir_alias_maestro', { p_umbral: 0.55 }),
      supabase.from('fichas_tecnicas').select('id,tipo,nombre').is('eps_id', null).is('receta_id', null).order('nombre'),
      supabase.from('recetas').select('id,nombre').order('nombre'),
      supabase.from('eps').select('id,nombre').order('nombre'),
    ])
    setMaestros((m ?? []) as Maestro[])
    setAlias((a ?? []) as Alias[])
    setDups((du ?? []) as Dup[])
    setSugerencias((sug ?? []) as Sugerencia[])
    setFichasHuerfanas((fh ?? []) as FichaHuerfana[])
    setRecetasOpt((rec ?? []) as RecetaOpt[])
    setEpsOpt((ep ?? []) as EpOpt[])

    const nombres = [...new Set((fh ?? []).map((f: any) => f.nombre))]
    if (nombres.length) {
      const { data: sib } = await supabase.from('fichas_tecnicas').select('nombre,receta_id,eps_id').in('nombre', nombres)
      const grouped: Record<string, { receta_id: string | null; eps_id: string | null }[]> = {}
      for (const s of (sib ?? []) as any[]) {
        if (!s.receta_id && !s.eps_id) continue
        grouped[s.nombre] = [...(grouped[s.nombre] ?? []), { receta_id: s.receta_id, eps_id: s.eps_id }]
      }
      setSiblings(grouped)
    } else {
      setSiblings({})
    }
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const aliasPorMaestro = useMemo(() => {
    const map = new Map<number, Alias[]>()
    for (const al of alias) {
      if (al.maestro_id == null) continue
      map.set(al.maestro_id, [...(map.get(al.maestro_id) ?? []), al])
    }
    return map
  }, [alias])

  /* ── Estadísticas ── */
  const stats = useMemo(() => {
    let conReceta = 0, sinReceta = 0, eCon = 0, eSin = 0
    for (const m of maestros) {
      const e = Number(m.euros) || 0
      if (m.receta_id) { conReceta++; eCon += e } else { sinReceta++; eSin += e }
    }
    const total = eCon + eSin
    return { conReceta, sinReceta, eCon, eSin, pct: total > 0 ? (eCon / total) * 100 : 0 }
  }, [maestros])

  const dupPendientes = useMemo(() => dups.filter(d => d.decision === 'pendiente'), [dups])
  const dupResueltos = dups.length - dupPendientes.length

  /* ── Lista principal ── */
  const lista = useMemo(() => {
    let base = maestros
    if (filtro === 'sin_receta') base = base.filter(m => !m.receta_id)
    else if (filtro === 'con_receta') base = base.filter(m => !!m.receta_id)
    const q = busca.trim().toLowerCase()
    if (q) {
      base = base.filter(m => m.nombre.toLowerCase().includes(q)
        || (aliasPorMaestro.get(m.id) ?? []).some(al => al.alias.toLowerCase().includes(q)))
    }
    return base
  }, [maestros, filtro, busca, aliasPorMaestro])

  /* ── Acciones: maestro ── */
  const crearMaestro = useCallback(async () => {
    const nombre = (nuevoNombre ?? '').trim()
    if (!nombre) { setAviso('Falta el nombre del plato.'); return }
    setGuardando('crear')
    const { data: clave } = await supabase.rpc('norm_plato', { t: nombre })
    const { error } = await supabase.from('platos_maestros').insert({ nombre, clave, activo: true })
    setGuardando(null)
    if (error) { setAviso(`Error: ${error.message}`); return }
    setNuevoNombre(null); setAviso(`Plato maestro "${nombre}" creado.`); await cargar()
  }, [nuevoNombre, cargar])

  const toggleExpand = (id: number) => {
    setExpandido(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  /* ── Acciones: alias ── */
  const asignarAlias = useCallback(async (aliasNorm: string, aliasMuestra: string, euros: number, maestroId: number, origen: 'manual' | 'sugerido', confianza: number | null) => {
    setGuardando(`al-${aliasNorm}`)
    const { error } = await supabase.from('platos_alias')
      .upsert({ alias_norm: aliasNorm, alias: aliasMuestra, maestro_id: maestroId, euros, origen, confianza, updated_at: new Date().toISOString() }, { onConflict: 'alias_norm' })
    setGuardando(null)
    if (error) { setAviso(`Error: ${error.message}`); return }
    setAviso(`"${aliasMuestra}" vinculado.`); await cargar()
  }, [cargar])

  const desasignarAlias = useCallback(async (a: Alias) => {
    if (!confirm(`¿Quitar "${a.alias}" de este plato maestro? Queda suelto.`)) return
    setGuardando(`des-${a.id}`)
    await supabase.from('platos_alias').update({ maestro_id: null, updated_at: new Date().toISOString() }).eq('id', a.id)
    setGuardando(null)
    setAviso(`"${a.alias}" desasignado.`); await cargar()
  }, [cargar])

  const asignarManual = useCallback(async () => {
    const texto = manualAlias.trim()
    if (!texto || !manualMaestro) { setAviso('Falta el texto de la variante o el maestro destino.'); return }
    const { data: norm } = await supabase.rpc('norm_plato', { t: texto })
    await asignarAlias(norm as string, texto, 0, Number(manualMaestro), 'manual', 1)
    setManualAlias(''); setManualMaestro('')
  }, [manualAlias, manualMaestro, asignarAlias])

  /* ── Acciones: fusión de maestros ── */
  const fusionarMaestros = useCallback(async (canonicoId: number, duplicadoId: number) => {
    const canon = maestros.find(m => m.id === canonicoId)
    const dup = maestros.find(m => m.id === duplicadoId)
    if (!canon || !dup) return
    let msg = `¿Fusionar "${dup.nombre}" dentro de "${canon.nombre}"? Se juntan ventas y alias.`
    if (canon.receta_id && dup.receta_id && canon.receta_id !== dup.receta_id) {
      msg += '\n\nOJO: ambos tienen receta distinta. Se conserva la del canónico.'
    }
    if (!confirm(msg)) return
    setGuardando(`fus-${duplicadoId}`)
    const { data, error } = await supabase.rpc('fn_fusionar_maestros', { p_canonico_id: canonicoId, p_duplicado_id: duplicadoId })
    setGuardando(null)
    if (error) { setAviso(`Error: ${error.message}`); return }
    const r = Array.isArray(data) ? data[0] : data
    setAviso(`Fusionado. ${r?.alias_movidos ?? 0} alias movidos, ${r?.lineas_movidas ?? 0} líneas de venta reagrupadas.`)
    await cargar()
  }, [maestros, cargar])

  const marcarDistinto = useCallback(async (dd: Dup) => {
    setGuardando(`ddist-${dd.id}`)
    await supabase.from('platos_duplicados').update({ decision: 'distinto', updated_at: new Date().toISOString() }).eq('id', dd.id)
    setGuardando(null); await cargar()
  }, [cargar])

  /* ── Acciones: fichas huérfanas (Bloque 5) ── */
  const fusionarFicha = useCallback(async (f: FichaHuerfana) => {
    setGuardando(`ficha-${f.id}`)
    const { data, error } = await supabase.rpc('fn_fusionar_ficha_huerfana', { p_orphan_id: f.id })
    setGuardando(null)
    const r = Array.isArray(data) ? data[0] : data
    if (error || !r?.ok) { setAviso(`No fusionada: ${error?.message ?? r?.motivo ?? '—'}`); return }
    setAviso('Ficha huérfana fusionada y duplicado eliminado.'); await cargar()
  }, [cargar])

  const vincularFichaManual = useCallback(async (f: FichaHuerfana, targetId: string) => {
    if (!targetId) return
    setGuardando(`fichaman-${f.id}`)
    const campo = f.tipo === 'ep' ? 'eps_id' : 'receta_id'
    const { error } = await supabase.from('fichas_tecnicas').update({ [campo]: targetId }).eq('id', f.id)
    setGuardando(null)
    if (error) { setAviso(`Error: ${error.message}`); return }
    setAviso('Ficha vinculada manualmente.'); await cargar()
  }, [cargar])

  /* ── Drag & drop de sugerencias sobre filas de maestro ── */
  const onDropEnMaestro = useCallback(async (maestroId: number) => {
    if (!dragNorm) return
    const s = sugerencias.find(x => x.plato_norm === dragNorm)
    setDragNorm(null)
    if (!s) return
    await asignarAlias(s.plato_norm, s.plato_muestra, s.euros, maestroId, 'sugerido', s.similitud)
  }, [dragNorm, sugerencias, asignarAlias])

  if (cargando) {
    return (
      <div style={{ fontFamily: LEX, padding: 28, background: CREMA, minHeight: '100vh', color: INK }}>
        <div style={{ background: BLANCO, border: BORDER, boxShadow: SHADOW }}><Vacio>Cargando platos maestros…</Vacio></div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: LEX, padding: 28, background: CREMA, minHeight: '100vh', color: INK }}>
      <div style={{ marginBottom: 14 }}>
        <RutaPantalla niveles={['Plato maestro']} subtitulo="El catálogo real de lo que vendes: un plato, un nombre, sus variantes colgando. Fusiona duplicados y prioriza qué recetas faltan por euros." />
      </div>

      {/* Hero */}
      <div style={{ background: GRANATE, border: BORDER_CARD, boxShadow: SHADOW, padding: '18px 22px', marginBottom: 16, color: BLANCO }}>
        <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.85 }}>PLATOS MAESTROS CON RECETA</div>
        <div style={{ ...d('clamp(30px,4.2vw,40px)', BLANCO) }}>{pct1(stats.pct)}</div>
        <div style={{ fontFamily: LEX, fontSize: 12, opacity: 0.92, fontWeight: 600, marginTop: 8 }}>
          {eur0(stats.eCon)} con receta · {eur0(stats.eSin)} de la cola pendiente
        </div>
      </div>

      {aviso && <Nota tono="verde">{aviso}</Nota>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 16, marginTop: aviso ? 16 : 0 }}>
        <div style={cardWash(VERDE_S)}>
          <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Con receta</div>
          <div style={{ ...d('26px', VERDE), margin: '6px 0' }}>{nf0(stats.conReceta)}</div>
          <span style={pill(VERDE_S, VERDE)}>{eur0(stats.eCon)}</span>
        </div>
        <div style={cardWash(ROSA_S)}>
          <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Sin receta (cola)</div>
          <div style={{ ...d('26px', GRANATE), margin: '6px 0' }}>{nf0(stats.sinReceta)}</div>
          <span style={pill(ROSA_S, GRANATE)}>{eur0(stats.eSin)}</span>
        </div>
        <div style={cardWash(AZUL_S)}>
          <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Duplicados</div>
          <div style={{ ...d('26px', AZUL), margin: '6px 0' }}>{nf0(dupPendientes.length)}</div>
          <span style={pill(AZUL_S, AZUL)}>de {nf0(dups.length)} sugeridos · {dupResueltos} resueltos</span>
        </div>
        <div style={cardWash(AMA_S)}>
          <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Fichas huérfanas</div>
          <div style={{ ...d('26px', AMA), margin: '6px 0' }}>{nf0(fichasHuerfanas.length)}</div>
          <span style={pill(AMA_S, AMA)}>del Bloque 5, por resolver</span>
        </div>
      </div>

      {/* ── Fichas huérfanas (cola de revisión Bloque 5) ── */}
      {fichasHuerfanas.length > 0 && (
        <div style={{ background: BLANCO, border: BORDER, boxShadow: SHADOW, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ ...cardHead(AMA), color: INK }}>Fichas huérfanas por resolver ({fichasHuerfanas.length})</div>
          <div style={{ padding: '14px 16px' }}>
            <p style={{ fontFamily: LEX, fontSize: 12, color: GRIS, margin: '0 0 10px' }}>
              Quedaron sin fusión automática del Bloque 5: o no hay candidato, o hay más de uno empatado. Resuélvelas aquí.
            </p>
            {fichasHuerfanas.map(f => {
              const sib = siblings[f.nombre] ?? []
              const tieneHermano = sib.length > 0
              const busyF = guardando === `ficha-${f.id}` || guardando === `fichaman-${f.id}`
              return (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderBottom: `1px solid ${CLARO}` }}>
                  <span style={pill(f.tipo === 'ep' ? AZUL_S : VERDE_S, f.tipo === 'ep' ? AZUL : VERDE)}>{f.tipo === 'ep' ? 'EP' : 'Receta'}</span>
                  <b style={{ fontFamily: LEX, fontSize: 13 }}>{f.nombre}</b>
                  {tieneHermano ? (
                    <>
                      <span style={{ fontSize: 12, color: GRIS }}>Ya existe una ficha vinculada con el mismo nombre.</span>
                      <button style={btn(VERDE)} disabled={busyF} onClick={() => fusionarFicha(f)}>{busyF ? 'Fusionando…' : 'Fusionar en la existente'}</button>
                    </>
                  ) : (
                    <>
                      <select style={{ ...inp, minWidth: 220 }} disabled={busyF}
                        onChange={e => vincularFichaManual(f, e.target.value)} defaultValue="">
                        <option value="">{f.tipo === 'ep' ? '— vincular a EP —' : '— vincular a receta —'}</option>
                        {(f.tipo === 'ep' ? epsOpt : recetasOpt).map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                      </select>
                      <span style={{ fontSize: 12, color: GRANATE }}>Sin candidato claro. Si no existe aún, créala en Cocina → {f.tipo === 'ep' ? 'EPS' : 'Recetas'}.</span>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Duplicados pendientes ── */}
      {dupPendientes.length > 0 && (
        <div style={{ background: BLANCO, border: BORDER, boxShadow: SHADOW, overflow: 'hidden', marginBottom: 16 }}>
          <div style={cardHead(GRANATE)}>Platos que parecen el mismo ({dupPendientes.length})</div>
          <div style={{ padding: '14px 16px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: INK }}><th style={th}>Se parecen</th><th style={thR}>Parecido</th><th style={th}>¿Son el mismo?</th></tr></thead>
              <tbody>
                {dupPendientes.slice(0, 50).map(dd => {
                  const busy = guardando === `ddist-${dd.id}`
                  const ma = maestros.find(m => m.nombre === dd.plato_a)
                  const mb = maestros.find(m => m.nombre === dd.plato_b)
                  return (
                    <tr key={dd.id}>
                      <td style={td}><div>{dd.plato_a}</div><div style={{ color: GRIS, fontSize: 12 }}>{dd.plato_b}</div></td>
                      <td style={{ ...td, textAlign: 'right' }}>{Math.round(Number(dd.parecido) * 100)}%</td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {ma && mb ? (
                            <button style={btn(VERDE)} disabled={busy} onClick={() => fusionarMaestros(ma.id, mb.id)}>Fusionar (b→a)</button>
                          ) : <span style={{ fontSize: 11, color: GRIS }}>Maestro no localizado, fusiona desde la tabla de abajo.</span>}
                          <button style={btn(BLANCO, INK)} disabled={busy} onClick={() => marcarDistinto(dd)}>Son distintos</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Sugerencias de alias (siempre con confirmación humana) ── */}
      {sugerencias.filter(s => !rechazadas.has(s.plato_norm)).length > 0 && (
        <div style={{ background: BLANCO, border: `3px solid ${AZUL}`, boxShadow: SHADOW, padding: 12, marginBottom: 16 }}>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 14, letterSpacing: '.5px', textTransform: 'uppercase', color: AZUL, marginBottom: 8 }}>
            Alias sueltos con sugerencia ({sugerencias.filter(s => !rechazadas.has(s.plato_norm)).length})
          </div>
          <p style={{ fontFamily: LEX, fontSize: 12, color: GRIS, margin: '0 0 10px' }}>
            Nombres de venta que no cuelgan aún de ningún plato maestro y se parecen mucho a uno que ya existe. Arrastra la tarjeta sobre otra fila de la tabla para cambiar el destino, o confirma/rechaza aquí.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sugerencias.filter(s => !rechazadas.has(s.plato_norm)).map(s => {
              const busy = guardando === `al-${s.plato_norm}`
              return (
                <div key={s.plato_norm} draggable onDragStart={() => setDragNorm(s.plato_norm)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontFamily: LEX, fontSize: 13, cursor: 'grab' }}>
                  <span><b>{s.plato_muestra}</b> ({eur0(s.euros)}) ≈ <b style={{ color: AZUL }}>{s.maestro_nombre}</b> <span style={pill(AZUL_S, AZUL)}>{Math.round(s.similitud * 100)}%</span></span>
                  <button style={btn(VERDE)} disabled={busy} onClick={() => asignarAlias(s.plato_norm, s.plato_muestra, s.euros, s.maestro_id, 'sugerido', s.similitud)}>{busy ? 'Vinculando…' : 'Confirmar'}</button>
                  <button style={btn(BLANCO, INK)} onClick={() => setRechazadas(prev => new Set(prev).add(s.plato_norm))}>Rechazar</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Asignación manual de alias ── */}
      <div style={{ background: BLANCO, border: BORDER, boxShadow: SHADOW, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '.5px', textTransform: 'uppercase', color: GRIS }}>Asignar alias manual:</span>
        <input placeholder="Nombre de la variante" value={manualAlias} onChange={e => setManualAlias(e.target.value)} style={{ ...inp, minWidth: 240 }} />
        <select value={manualMaestro} onChange={e => setManualMaestro(e.target.value)} style={{ ...inp, minWidth: 220 }}>
          <option value="">— plato maestro destino —</option>
          {maestros.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <button style={btn(AMA, INK)} onClick={asignarManual}>Vincular</button>
      </div>

      {/* ── Tabla principal ── */}
      <div style={{ background: BLANCO, border: BORDER, boxShadow: SHADOW, overflow: 'hidden' }}>
        <div style={{ ...cardHead(GRANATE), display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div>Cola priorizada por euros — qué receta crear primero</div>
            <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 500, marginTop: 2, textTransform: 'none', letterSpacing: 0 }}>Ordenada de más a menos facturación. Filtra, busca, expande alias, crea o fusiona.</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['sin_receta', 'con_receta', 'todos'] as Filtro[]).map(f => {
              const on = f === filtro
              const label = f === 'sin_receta' ? 'Sin receta' : f === 'con_receta' ? 'Con receta' : 'Todos'
              return (
                <button key={f} onClick={() => setFiltro(f)}
                  style={{ padding: '6px 12px', cursor: 'pointer', background: on ? BLANCO : 'transparent', color: on ? GRANATE : BLANCO, border: `2px solid ${BLANCO}`, fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</button>
              )
            })}
          </div>
        </div>

        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <input placeholder="Buscar plato o alias…" value={busca} onChange={e => setBusca(e.target.value)} style={{ ...inp, minWidth: 260 }} />
            <span style={{ fontFamily: OSW, fontSize: 12, color: GRIS }}>{lista.length} de {maestros.length}</span>
            {nuevoNombre === null ? (
              <button style={btn(AMA, INK)} onClick={() => setNuevoNombre('')}>+ Nuevo plato maestro</button>
            ) : (
              <span style={{ display: 'flex', gap: 6 }}>
                <input placeholder="Nombre del plato" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} style={inp} />
                <button style={btn(VERDE)} disabled={guardando === 'crear'} onClick={crearMaestro}>Crear</button>
                <button style={btn(BLANCO, INK)} onClick={() => setNuevoNombre(null)}>Cancelar</button>
              </span>
            )}
          </div>

          {lista.length === 0 ? <Vacio>Nada en esta lista.</Vacio> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: INK }}>
                    <th style={th}>Plato</th>
                    <th style={thR}>Euros</th>
                    <th style={thR}>Uds</th>
                    <th style={thR}>Variantes</th>
                    <th style={th}>Receta</th>
                    <th style={th}>Fusionar en…</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.slice(0, 150).map(m => {
                    const als = aliasPorMaestro.get(m.id) ?? []
                    const isOpen = expandido.has(m.id)
                    return (
                      <Fragment key={m.id}>
                        <tr
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => onDropEnMaestro(m.id)}
                          style={{ background: dragNorm ? AMA_S : undefined }}
                        >
                          <td style={{ ...td, maxWidth: 340, cursor: als.length ? 'pointer' : 'default' }} onClick={() => als.length && toggleExpand(m.id)}>
                            {als.length > 0 && <span style={{ color: GRIS, marginRight: 4 }}>{isOpen ? '▾' : '▸'}</span>}
                            {m.nombre}
                            {als.length > 0 && <span style={{ color: GRIS, fontSize: 11 }}> · {als.length} alias</span>}
                          </td>
                          <td style={{ ...td, textAlign: 'right' }}>{eur0(Number(m.euros) || 0)}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{nf0(Number(m.unidades) || 0)}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{m.n_variantes ?? als.length}</td>
                          <td style={td}>{m.receta_id ? <span style={pill(VERDE_S, VERDE)}>Tiene receta</span> : <span style={pill(ROSA_S, GRANATE)}>Falta</span>}</td>
                          <td style={td}>
                            <select style={{ ...inp, minWidth: 200 }} defaultValue=""
                              disabled={guardando === `fus-${m.id}`}
                              onChange={e => { if (e.target.value) fusionarMaestros(Number(e.target.value), m.id); e.target.value = '' }}>
                              <option value="">— elegir canónico —</option>
                              {maestros.filter(x => x.id !== m.id).map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                            </select>
                          </td>
                        </tr>
                        {isOpen && als.map(al => (
                          <tr key={`al-${al.id}`} style={{ background: CLARO }}>
                            <td style={{ ...td, paddingLeft: 32, fontSize: 12, color: GRIS }} colSpan={4}>↳ {al.alias} {al.origen === 'sugerido' && <span style={pill(AZUL_S, AZUL)}>sugerido</span>}</td>
                            <td style={td} colSpan={2}>
                              <button style={btn(BLANCO, INK)} disabled={guardando === `des-${al.id}`} onClick={() => desasignarAlias(al)}>Quitar alias</button>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
              {lista.length > 150 && <Nota tono="blu">Se muestran los 150 primeros de {nf0(lista.length)}. Usa el buscador para acotar.</Nota>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
