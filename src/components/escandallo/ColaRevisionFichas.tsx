// ColaRevisionFichas — Pieza 3 (Plato maestro): cola de resolución manual de fichas huérfanas.
// Consume fichas_tecnicas WHERE eps_id IS NULL AND receta_id IS NULL AND estado='vigente'
// (las que el Bloque 5 no pudo fusionar automáticamente: 0 o 2+ candidatos empatados).
// 100% decisión humana: candidato único o no, siempre requiere clic de Rubén (sin auto-resolución).
// Acciones: Enlazar (fn_enlazar_ficha_huerfana, anti-pisado), Crear ficha nueva, Descartar.
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Link2, PlusCircle, XCircle, Inbox } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { GRANATE, BLANCO, GRIS } from '@/styles/neobrutal'
import { ESCANDALLO_OK_BG, ESCANDALLO_OK_TXT, ESCANDALLO_WARN_BG, ESCANDALLO_WARN_BORDE, ESCANDALLO_WARN_TXT } from '@/styles/palettes'
import { campoAporta, type EstadoCampo } from '@/utils/fichasHuerfanas'

interface FichaOrphan {
  id: string; tipo: string; codigo: string | null; nombre: string
  raciones: number | null; foto_url: string | null
  pasos: string[] | null; alergenos: string[] | null; conservacion: { metodo: string; tiempo: string }[] | null
}
interface Candidato {
  target_tipo: 'receta' | 'ep'; target_id: string; target_nombre: string; similitud: number
  ficha_id: string | null; tiene_ficha: boolean
  foto_url: string | null; elaboracion_len: number; alergenos_n: number; conservacion_n: number
}

function PillCampo({ label, estado }: { label: string; estado: EstadoCampo }) {
  const bg = estado.tono === 'ok' ? ESCANDALLO_OK_BG : estado.tono === 'gana' ? ESCANDALLO_WARN_BG : 'transparent'
  const txt = estado.tono === 'ok' ? ESCANDALLO_OK_TXT : estado.tono === 'gana' ? ESCANDALLO_WARN_TXT : GRIS
  const brd = estado.tono === 'sin' ? '1px solid var(--sl-border)' : 'none'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: bg, color: txt, border: brd, borderRadius: 99, padding: '2px 8px', fontSize: 10.5, fontFamily: 'Lexend, sans-serif', whiteSpace: 'nowrap' }}>
      {label}: {estado.texto}
    </span>
  )
}

export default function ColaRevisionFichas() {
  const [fichas, setFichas] = useState<FichaOrphan[]>([])
  const [candidatos, setCandidatos] = useState<Record<string, Candidato[]>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [creando, setCreando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('fichas_tecnicas')
      .select('id, tipo, codigo, nombre, raciones, foto_url, pasos, alergenos, conservacion')
      .is('eps_id', null).is('receta_id', null).eq('estado', 'vigente')
      .order('nombre')
    const list = (data as FichaOrphan[]) ?? []
    setFichas(list)
    const mapa: Record<string, Candidato[]> = {}
    await Promise.all(list.map(async f => {
      const { data: cs } = await supabase.rpc('fn_candidatos_ficha_huerfana', { p_orphan_id: f.id, p_limit: 5 })
      mapa[f.id] = (cs as Candidato[]) ?? []
    }))
    setCandidatos(mapa)
    setLoading(false)
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const enlazar = useCallback(async (f: FichaOrphan, c: Candidato) => {
    if (!confirm(`¿Enlazar "${f.nombre}" con ${c.target_tipo === 'ep' ? 'el EP' : 'la receta'} "${c.target_nombre}"? Los campos vacíos del candidato se completan con los de esta ficha; los que ya tiene no se tocan.`)) return
    setBusy(f.id)
    const { data, error } = await supabase.rpc('fn_enlazar_ficha_huerfana', { p_orphan_id: f.id, p_target_tipo: c.target_tipo, p_target_id: c.target_id })
    setBusy(null)
    const r = Array.isArray(data) ? data[0] : data
    if (error || !r?.ok) { setAviso(`No se pudo enlazar: ${error?.message ?? r?.motivo ?? '—'}`); return }
    setAviso(`"${f.nombre}" enlazada con "${c.target_nombre}".`)
    await cargar()
  }, [cargar])

  const descartar = useCallback(async (f: FichaOrphan) => {
    if (!confirm(`¿Descartar "${f.nombre}"? Queda huérfana pero marcada como revisada: no volverá a aparecer en esta cola.`)) return
    setBusy(f.id)
    const { error } = await supabase.from('fichas_tecnicas').update({ estado: 'descartada' }).eq('id', f.id)
    setBusy(null)
    if (error) { setAviso(`Error al descartar: ${error.message}`); return }
    setAviso(`"${f.nombre}" descartada.`)
    await cargar()
  }, [cargar])

  const crearNueva = useCallback(async (f: FichaOrphan) => {
    const etiqueta = f.tipo === 'ep' ? 'EP' : 'receta'
    if (!confirm(`¿Crear ${etiqueta} nueva llamada "${f.nombre}" a partir de esta ficha? Se usarán sus datos (raciones, pasos, alérgenos, foto).`)) return
    setCreando(f.id)
    const elaboracion = (f.pasos ?? []).join('\n') || null
    const alergArr = f.alergenos ?? []
    let newId: string | null = null
    if (f.tipo === 'ep') {
      const { data, error } = await supabase.from('eps')
        .insert({ nombre: f.nombre, raciones: f.raciones, preparacion: elaboracion, alergenos: alergArr })
        .select('id').single()
      if (error) { setCreando(null); setAviso(`Error al crear EP: ${error.message}`); return }
      newId = data.id
    } else {
      const { data, error } = await supabase.from('recetas')
        .insert({ nombre: f.nombre, raciones: f.raciones, elaboracion, alergenos: alergArr, foto_url: f.foto_url })
        .select('id').single()
      if (error) { setCreando(null); setAviso(`Error al crear receta: ${error.message}`); return }
      newId = data.id
    }
    // Fusiona el resto (conservación, foto si quedó fuera, gama) y borra el duplicado huérfano.
    const { data: r2, error: err2 } = await supabase.rpc('fn_enlazar_ficha_huerfana', { p_orphan_id: f.id, p_target_tipo: f.tipo, p_target_id: newId })
    setCreando(null)
    const r = Array.isArray(r2) ? r2[0] : r2
    if (err2 || !r?.ok) { setAviso(`${etiqueta === 'EP' ? 'EP' : 'Receta'} creada, pero no se pudo completar la fusión: ${err2?.message ?? r?.motivo ?? '—'}`); await cargar(); return }
    setAviso(`${etiqueta === 'EP' ? 'EP' : 'Receta'} "${f.nombre}" creada y ficha enlazada.`)
    await cargar()
  }, [cargar])

  if (loading) return null
  if (fichas.length === 0) return null

  return (
    <div className="no-print" style={{ background: 'var(--sl-card)', border: `1px solid ${ESCANDALLO_WARN_BORDE}`, borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Inbox size={17} color={GRANATE} />
        <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--sl-text-primary)' }}>
          Fichas por revisar ({fichas.length})
        </span>
      </div>
      <p style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-muted)', margin: '0 0 12px' }}>
        Quedaron sin fusión automática: sin candidato claro, o dos candidatos empatados. Decide tú: enlaza con el correcto, crea la ficha desde cero, o descarta.
      </p>

      {aviso && (
        <div style={{ background: ESCANDALLO_OK_BG, color: ESCANDALLO_OK_TXT, borderRadius: 8, padding: '7px 12px', fontSize: 12.5, fontFamily: 'Lexend, sans-serif', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span>{aviso}</span>
          <button onClick={() => setAviso(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ESCANDALLO_OK_TXT, fontSize: 13, lineHeight: 1 }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {fichas.map(f => {
          const cs = candidatos[f.id] ?? []
          const busyF = busy === f.id
          const creandoF = creando === f.id
          const hTiene = { foto: !!f.foto_url, pasos: (f.pasos ?? []).length > 0, alerg: (f.alergenos ?? []).length > 0, conserv: (f.conservacion ?? []).length > 0 }
          return (
            <div key={f.id} style={{ background: 'var(--sl-thead)', border: '1px solid var(--sl-border)', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: f.tipo === 'ep' ? '#2D5BFF22' : `${GRANATE}22`, color: f.tipo === 'ep' ? '#2D5BFF' : GRANATE, borderRadius: 99, padding: '2px 9px' }}>
                  {f.tipo === 'ep' ? 'EP' : 'Receta'}
                </span>
                <span style={{ fontSize: 11, color: GRIS, fontFamily: 'Lexend, sans-serif' }}>{f.codigo}</span>
                <b style={{ fontFamily: 'Lexend, sans-serif', fontSize: 14, color: 'var(--sl-text-primary)', textTransform: 'uppercase' }}>{f.nombre}</b>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <PillCampo label="Foto" estado={{ texto: hTiene.foto ? 'sí' : 'no', tono: hTiene.foto ? 'ok' : 'sin' }} />
                  <PillCampo label="Elaboración" estado={{ texto: hTiene.pasos ? 'sí' : 'no', tono: hTiene.pasos ? 'ok' : 'sin' }} />
                  <PillCampo label="Alérgenos" estado={{ texto: hTiene.alerg ? 'sí' : 'no', tono: hTiene.alerg ? 'ok' : 'sin' }} />
                  <PillCampo label="Conservación" estado={{ texto: hTiene.conserv ? 'sí' : 'no', tono: hTiene.conserv ? 'ok' : 'sin' }} />
                </span>
              </div>

              {cs.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: ESCANDALLO_WARN_BG, border: `1px solid ${ESCANDALLO_WARN_BORDE}`, borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
                  <AlertTriangle size={14} color={ESCANDALLO_WARN_TXT} />
                  <span style={{ fontSize: 12, color: ESCANDALLO_WARN_TXT, fontFamily: 'Lexend, sans-serif' }}>Sin candidato con parecido suficiente. No adivinamos: crea la ficha desde cero o descarta.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                  {cs.map(c => {
                    const cTiene = { foto: !!c.foto_url, pasos: c.elaboracion_len > 0, alerg: c.alergenos_n > 0, conserv: c.conservacion_n > 0 }
                    return (
                      <div key={`${c.target_tipo}-${c.target_id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'var(--sl-card)', border: '1px solid var(--sl-border)', borderRadius: 8, padding: '7px 10px' }}>
                        <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: c.target_tipo === 'ep' ? '#2D5BFF' : GRANATE }}>
                          {c.target_tipo === 'ep' ? 'EP' : 'Receta'}
                        </span>
                        <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: 'var(--sl-text-primary)', flexShrink: 0 }}>{c.target_nombre}</span>
                        <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, fontWeight: 600, color: BLANCO, background: c.similitud >= 0.9 ? '#0FB86B' : c.similitud >= 0.55 ? ESCANDALLO_WARN_BORDE : GRIS, borderRadius: 99, padding: '1px 8px' }}>
                          {Math.round(c.similitud * 100)}%
                        </span>
                        <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <PillCampo label="Foto" estado={campoAporta(hTiene.foto, cTiene.foto)} />
                          <PillCampo label="Elaboración" estado={campoAporta(hTiene.pasos, cTiene.pasos)} />
                          <PillCampo label="Alérgenos" estado={campoAporta(hTiene.alerg, cTiene.alerg)} />
                          <PillCampo label="Conservación" estado={campoAporta(hTiene.conserv, cTiene.conserv)} />
                        </span>
                        <button onClick={() => enlazar(f, c)} disabled={busyF || creandoF}
                          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, background: GRANATE, color: BLANCO, border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 500, cursor: busyF ? 'default' : 'pointer', opacity: busyF ? 0.6 : 1, fontFamily: 'Oswald, sans-serif', letterSpacing: '0.03em' }}>
                          <Link2 size={12} /> {busyF ? 'Enlazando…' : 'Enlazar'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => crearNueva(f)} disabled={busyF || creandoF}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--sl-text-secondary)', border: '1px solid var(--sl-border)', borderRadius: 7, padding: '6px 12px', fontSize: 12, cursor: creandoF ? 'default' : 'pointer', opacity: creandoF ? 0.6 : 1, fontFamily: 'Oswald, sans-serif', letterSpacing: '0.03em' }}>
                  <PlusCircle size={13} /> {creandoF ? 'Creando…' : `Crear ${f.tipo === 'ep' ? 'EP' : 'receta'} nueva`}
                </button>
                <button onClick={() => descartar(f)} disabled={busyF || creandoF}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: GRIS, border: '1px solid var(--sl-border)', borderRadius: 7, padding: '6px 12px', fontSize: 12, cursor: busyF ? 'default' : 'pointer', opacity: busyF ? 0.6 : 1, fontFamily: 'Oswald, sans-serif', letterSpacing: '0.03em' }}>
                  <XCircle size={13} /> Descartar
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
