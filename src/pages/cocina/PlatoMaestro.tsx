/**
 * PlatoMaestro — Hub de platos (LEY-PLATO-01). platos_maestros es la ÚNICA
 * identidad del plato. Aquí (y en la pestaña Hoy) vive el ÚNICO vinculador:
 * vincular una vez sobre el maestro se refleja en análisis, Carta, Pareto y
 * Coste por plato a la vez (RPC vincular_plato_maestro). Coste por plato y Carta
 * redirigen su acción aquí. Ver docs/LEY_PLATO_01.md.
 *
 * CANTERA ALEGRE v1.0 (área Cocina · naranja). Solo capa visual; datos vía Supabase.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { vincularPlato, desvincularPlato } from '@/lib/cocina/vincularCliente'
import { requiereReceta, sugerirReceta } from '@/lib/cocina/platoHub'
import { eur0, num0, pct1 } from '@/components/panel/sl/uiSL'
import {
  OSW, LEX, INK, GRIS, GRANATE, VERDE, AMA, AZUL, BLANCO,
  VERDE_S, AMA_S, AZUL_S, ROSA_S,
  cardHead, pill,
} from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'

interface Maestro { id: number; nombre: string; es_extra: boolean | null; receta_id: string | null; euros: number | null }
interface Receta { id: string; nombre: string; coste_rac: number | null }
interface Propuesta { id: number; plato_maestro_id: number; receta_id: string; motivo: string | null }
interface Revision { id: number; motivo: string; plato_muestra: string | null }

type Filtro = 'sin' | 'con' | 'bebidas'

const FILTROS: Array<{ id: Filtro; label: string }> = [
  { id: 'sin', label: 'Sin receta' },
  { id: 'con', label: 'Ya vinculados' },
  { id: 'bebidas', label: 'Bebidas / extras' },
]

function Vacio({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 32, textAlign: 'center', color: GRIS, fontFamily: LEX, fontSize: 13, fontWeight: 600 }}>{children}</div>
}

function Nota({ tono = 'verde', children }: { tono?: 'verde' | 'rojo' | 'ambar' | 'blu'; children: React.ReactNode }) {
  const map = { verde: VERDE_S, rojo: ROSA_S, ambar: AMA_S, blu: AZUL_S } as const
  const borde = { verde: VERDE, rojo: GRANATE, ambar: AMA, blu: AZUL } as const
  return (
    <div style={{ padding: '11px 14px', background: map[tono], border: `2px solid ${borde[tono]}`, fontFamily: LEX, fontSize: 12.5, fontWeight: 600, color: INK, lineHeight: 1.5 }}>
      {children}
    </div>
  )
}

export default function PlatoMaestro() {
  const [maestros, setMaestros] = useState<Maestro[]>([])
  const [recetas, setRecetas] = useState<Receta[]>([])
  const [propuestas, setPropuestas] = useState<Propuesta[]>([])
  const [revision, setRevision] = useState<Revision[]>([])
  const [filtro, setFiltro] = useState<Filtro>('sin')
  const [cargando, setCargando] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [{ data: pm }, { data: rec }, { data: pr }, { data: rv }] = await Promise.all([
      supabase.from('platos_maestros').select('id, nombre, es_extra, receta_id, euros').eq('activo', true).order('euros', { ascending: false, nullsFirst: false }),
      supabase.from('recetas').select('id, nombre, coste_rac').order('nombre'),
      supabase.from('platos_propuestas_vinculo').select('id, plato_maestro_id, receta_id, motivo').eq('estado', 'pendiente'),
      supabase.from('platos_revision').select('id, motivo, plato_muestra').eq('estado', 'pendiente').order('id'),
    ])
    setMaestros((pm ?? []) as Maestro[])
    setRecetas((rec ?? []) as Receta[])
    setPropuestas((pr ?? []) as Propuesta[])
    setRevision((rv ?? []) as Revision[])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const recetaNombre = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of recetas) m.set(r.id, r.nombre)
    return m
  }, [recetas])

  const vincular = useCallback(async (maestroId: number, recetaId: string) => {
    setBusy(maestroId)
    try {
      if (recetaId) await vincularPlato(maestroId, recetaId)
      else await desvincularPlato(maestroId)
      setAviso('Vínculo guardado. Se refleja en Análisis, Pareto, Coste por plato y Carta.')
      await cargar()
    } catch (e: any) { setAviso('No se pudo guardar: ' + (e?.message || 'error')) }
    finally { setBusy(null) }
  }, [cargar])

  // Stats sobre platos que SÍ piden receta (bebidas/extras nunca cuentan).
  const stats = useMemo(() => {
    const s = { platos: 0, conReceta: 0, sinReceta: 0, eCon: 0, eSin: 0, total: 0, bebidas: 0 }
    for (const m of maestros) {
      if (!requiereReceta(m)) { s.bebidas++; continue }
      const e = Number(m.euros) || 0
      s.platos++; s.total += e
      if (m.receta_id) { s.conReceta++; s.eCon += e } else { s.sinReceta++; s.eSin += e }
    }
    return s
  }, [maestros])

  const pctCubierto = stats.total > 0 ? (stats.eCon / stats.total) * 100 : 0

  // Sugerencias en vivo (normPlato exacto o similitud alta) para platos sin receta.
  const sugerencias = useMemo(() => {
    const m = new Map<number, { recetaId: string; nombre: string; score: number }>()
    if (recetas.length === 0) return m
    for (const p of maestros) {
      if (!requiereReceta(p) || p.receta_id) continue
      const s = sugerirReceta(p.nombre, recetas)
      if (s) m.set(p.id, s)
    }
    return m
  }, [maestros, recetas])

  const lista = useMemo(() => {
    const base = maestros.filter(m => {
      if (filtro === 'bebidas') return !requiereReceta(m)
      if (!requiereReceta(m)) return false
      if (filtro === 'sin') return !m.receta_id
      return !!m.receta_id
    })
    return base
  }, [maestros, filtro])

  if (cargando) {
    return (
      <PantallaCantera embedded>
        <Papel ceja={GRANATE}><Vacio>Cargando platos maestros…</Vacio></Papel>
      </PantallaCantera>
    )
  }

  return (
    <PantallaCantera embedded>
      {/* HÉROE (naranja · área Cocina) */}
      <HeroCantera
        area="cocina"
        titular={pctCubierto >= 80 ? 'Casi todo lo que vendes tiene su receta detrás.' : 'Falta receta en buena parte de lo que vendes.'}
        etiquetaDato="Facturación con receta vinculada"
        cifra={pct1(pctCubierto)}
        resumen={<>{eur0(stats.eCon)} con receta · {eur0(stats.eSin)} sin vincular</>}
        atencion={[
          `${num0(stats.conReceta)} vinculados`,
          `${num0(stats.sinReceta)} sin receta`,
          sugerencias.size > 0 ? `${sugerencias.size} sugeridas en vivo` : null,
          revision.length > 0 ? `${revision.length} en cola de revisión` : null,
        ].filter(Boolean) as string[]}
      />

      {aviso && <Nota tono="verde">{aviso}</Nota>}

      {propuestas.length > 0 && (
        <Papel ceja={AZUL} pad="0" style={{ overflow: 'hidden' }}>
          <div style={{ ...cardHead(AZUL), display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>Propuestas de vínculo por confirmar</div>
            <span style={pill(AZUL_S, AZUL)}>{propuestas.length}</span>
          </div>
          <div style={{ padding: '14px 16px' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: INK }}>
                    {['Plato', 'Receta propuesta', ''].map(h => (
                      <th key={h} style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: BLANCO, fontWeight: 600, textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {propuestas.map(p => {
                    const m = maestros.find(x => x.id === p.plato_maestro_id)
                    return (
                      <tr key={p.id}>
                        <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}` }}>{m?.nombre ?? p.plato_maestro_id}</td>
                        <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}` }}>{recetaNombre.get(p.receta_id) ?? '—'}</td>
                        <td style={{ padding: '9px 12px', borderBottom: `2px solid ${INK}`, textAlign: 'right' }}>
                          <button
                            disabled={busy === p.plato_maestro_id}
                            onClick={() => vincular(p.plato_maestro_id, p.receta_id)}
                            style={{ background: VERDE, color: BLANCO, border: `2px solid ${INK}`, boxShadow: '2px 2px 0 var(--neo-shadow-color)', padding: '7px 12px', fontFamily: OSW, fontWeight: 700, fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >{busy === p.plato_maestro_id ? 'Guardando…' : 'Confirmar'}</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Papel>
      )}

      {revision.length > 0 && (
        <Nota tono="ambar">
          <b>{revision.length} platos en cola de revisión.</b> Su nombre casaba con más de un plato maestro, así que no se vinculó nada solo:
          {' '}{revision.slice(0, 5).map(r => r.plato_muestra || r.motivo).join(' · ')}{revision.length > 5 ? '…' : ''}
        </Nota>
      )}

      {/* PLANCHA DE KPIs: sólidos pegados */}
      <div>
        <SeccionLabel bg={GRANATE}>KPIs de vinculación</SeccionLabel>
        <Plancha>
          <PlanchaCelda bg={VERDE} color={BLANCO} first>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Vinculados</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }}>{num0(stats.conReceta)}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{eur0(stats.eCon)}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={GRANATE} color={BLANCO}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Sin receta</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }}>{num0(stats.sinReceta)}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{eur0(stats.eSin)}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={AZUL} color={BLANCO}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Sugeridas en vivo</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }}>{num0(sugerencias.size)}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>por confirmar</div>
          </PlanchaCelda>
          <PlanchaCelda bg={AMA} color={INK}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Bebidas / extras</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }}>{num0(stats.bebidas)}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>no piden receta</div>
          </PlanchaCelda>
        </Plancha>
      </div>

      {/* FRASE POTENTE (color por significado, distinto del héroe naranja) */}
      {sugerencias.size > 0 && (
        <FrasePotente significado="oportunidad">
          {sugerencias.size} sugerencias listas para confirmar con un clic: revisa la lista antes de escribir recetas desde cero.
        </FrasePotente>
      )}

      <Papel ceja={GRANATE} pad="0" style={{ overflow: 'hidden' }}>
        <div style={{ ...cardHead(GRANATE), display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div>Platos maestros ordenados por lo que facturan</div>
            <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 500, marginTop: 2, textTransform: 'none', letterSpacing: 0 }}>Un plato = una identidad. Vincula su receta aquí.</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FILTROS.map(f => {
              const on = f.id === filtro
              return (
                <button key={f.id} onClick={() => setFiltro(f.id)}
                  style={{
                    padding: '6px 12px', cursor: 'pointer',
                    background: on ? BLANCO : 'transparent',
                    color: on ? GRANATE : BLANCO,
                    border: `2px solid ${BLANCO}`,
                    fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
                  }}>{f.label}</button>
              )
            })}
          </div>
        </div>

        <div style={{ padding: '14px 16px' }}>
          {lista.length === 0 ? (
            <Vacio>Nada en esta lista.</Vacio>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: INK }}>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: BLANCO, fontWeight: 600, textAlign: 'left', width: 30 }}>#</th>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: BLANCO, fontWeight: 600, textAlign: 'left' }}>Plato</th>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: BLANCO, fontWeight: 600, textAlign: 'right' }}>Factura</th>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: BLANCO, fontWeight: 600, textAlign: 'left' }}>Receta vinculada</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.slice(0, 150).map((m, i) => {
                    const sug = sugerencias.get(m.id)
                    return (
                      <tr key={m.id}>
                        <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 11, color: GRIS, borderBottom: `2px solid ${INK}` }}>{i + 1}</td>
                        <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}`, maxWidth: 340 }}>{m.nombre}</td>
                        <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}`, textAlign: 'right', minWidth: 90 }}>{eur0(Number(m.euros) || 0)}</td>
                        <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}` }}>
                          {filtro === 'bebidas' ? (
                            <span style={pill('var(--sl-thead)', GRIS)}>No pide receta</span>
                          ) : (
                            <>
                              <select
                                value={m.receta_id ?? ''}
                                disabled={busy === m.id}
                                onChange={e => vincular(m.id, e.target.value)}
                                style={{
                                  padding: '6px 10px', minWidth: 220,
                                  border: `2px solid ${m.receta_id ? INK : GRANATE}`,
                                  background: BLANCO, color: m.receta_id ? INK : GRANATE,
                                  fontFamily: LEX, fontSize: 13, fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                <option value="">— Falta la receta —</option>
                                {recetas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                              </select>
                              {!m.receta_id && sug && (
                                <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <span style={pill(AZUL_S, AZUL)}>Se parece a «{sug.nombre}» · {Math.round(sug.score * 100)}%</span>
                                  <button disabled={busy === m.id} onClick={() => vincular(m.id, sug.recetaId)}
                                    style={{ padding: '4px 10px', border: `2px solid ${INK}`, background: VERDE, color: BLANCO, fontFamily: OSW, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>Confirmar</button>
                                </div>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {lista.length > 150 && <div style={{ marginTop: 10 }}><Nota tono="blu">Se muestran los 150 que más facturan de {num0(lista.length)}.</Nota></div>}
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <Nota tono="ambar">Si el plato no tiene receta aún, créala en Cocina · Operativa → Libro de Recetas y vuelve a vincularla aquí.</Nota>
          </div>
        </div>
      </Papel>
    </PantallaCantera>
  )
}
