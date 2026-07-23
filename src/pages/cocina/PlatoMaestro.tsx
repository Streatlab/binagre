/**
 * PlatoMaestro — Hub de platos (LEY-PLATO-01). platos_maestros es la ÚNICA
 * identidad del plato. Aquí (y en la pestaña Hoy) vive el ÚNICO vinculador:
 * vincular una vez sobre el maestro se refleja en análisis, Carta, Pareto y
 * Coste por plato a la vez (RPC vincular_plato_maestro). Coste por plato y Carta
 * redirigen su acción aquí. Ver docs/LEY_PLATO_01.md.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { vincularPlato, desvincularPlato } from '@/lib/cocina/vincularCliente'
import { requiereReceta, sugerirReceta } from '@/lib/cocina/platoHub'
import {
  C, Card, CardHead, Hero, HeroPill, Kpi, KpiGrid, Pill, Nota, Vacio, Atencion,
  eur0, num0, pct1,
} from '@/components/panel/sl/uiSL'
import RutaPantalla from '@/components/ui/RutaPantalla'

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
    return <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}><Card><Vacio>Cargando platos maestros…</Vacio></Card></div>
  }

  return (
    <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}>
      <div style={{ marginBottom: 14 }}>
        <RutaPantalla niveles={['Plato maestro']} subtitulo="La identidad única de cada plato. Vincula aquí una vez y se aplica en todo: Análisis, Pareto, Coste y Carta." />
      </div>

      <Hero
        eyebrow="PLATOS CON RECETA CONOCIDA"
        titular={pctCubierto >= 80 ? 'Casi todo lo que vendes tiene su receta detrás' : 'Falta receta en buena parte de lo que vendes'}
        valor={pct1(pctCubierto)}
        sub={`${eur0(stats.eCon)} con receta · ${eur0(stats.eSin)} sin vincular`}
        objetivo={{ pct: pctCubierto, label: 'VINCULADO' }}
        right={<>
          <HeroPill solid>{num0(stats.conReceta)} vinculados</HeroPill>
          <HeroPill>{num0(stats.sinReceta)} sin receta</HeroPill>
        </>}
      />

      {aviso && <Nota tono="verde">{aviso}</Nota>}

      {propuestas.length > 0 && (
        <Card>
          <CardHead title="Propuestas de vínculo por confirmar" sub="El nombre coincide con una receta que ya tienes. Confirma con un clic." right={<Pill tone="blu">{propuestas.length}</Pill>} />
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Plato</th><th>Receta propuesta</th><th></th></tr></thead>
              <tbody>
                {propuestas.map(p => {
                  const m = maestros.find(x => x.id === p.plato_maestro_id)
                  return (
                    <tr key={p.id}>
                      <td>{m?.nombre ?? p.plato_maestro_id}</td>
                      <td>{recetaNombre.get(p.receta_id) ?? '—'}</td>
                      <td>
                        <button disabled={busy === p.plato_maestro_id} onClick={() => vincular(p.plato_maestro_id, p.receta_id)}
                          style={{ padding: '7px 13px', borderRadius: 999, border: 'none', background: C.verde, color: '#fff', fontFamily: "'Nunito', sans-serif", fontSize: 11.5, fontWeight: 900, cursor: 'pointer' }}>
                          {busy === p.plato_maestro_id ? 'Guardando…' : 'Confirmar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {revision.length > 0 && (
        <Atencion tono="ambar" cifra={`${revision.length}`}>
          <b>Platos en cola de revisión.</b> Su nombre casaba con más de un plato maestro, así que no se vinculó nada solo:
          {' '}{revision.slice(0, 5).map(r => r.plato_muestra || r.motivo).join(' · ')}{revision.length > 5 ? '…' : ''}
        </Atencion>
      )}

      <KpiGrid>
        <Kpi icono="✓" tono="verde" label="Vinculados" valor={num0(stats.conReceta)} pie={<Pill tone="verde" dot>{eur0(stats.eCon)}</Pill>} />
        <Kpi icono="✕" tono="rojo" label="Sin receta" valor={num0(stats.sinReceta)} pie={<Pill tone="rojo" dot>{eur0(stats.eSin)}</Pill>} />
        <Kpi icono="?" tono="blu" label="Sugeridas en vivo" valor={num0(sugerencias.size)} pie={<Pill tone="blu" dot>por confirmar</Pill>} />
        <Kpi icono="🥤" tono="neutro" label="Bebidas / extras" valor={num0(stats.bebidas)} pie={<Pill tone="neutro" dot>no piden receta</Pill>} />
      </KpiGrid>

      <Card>
        <CardHead
          title="Platos maestros ordenados por lo que facturan"
          sub="Un plato = una identidad. Vincula su receta aquí."
          right={
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {FILTROS.map(f => {
                const on = f.id === filtro
                return (
                  <button key={f.id} onClick={() => setFiltro(f.id)}
                    style={{ padding: '6px 12px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${on ? C.rojo : C.line}`, background: on ? C.rojoSoft : C.card, color: on ? C.rojoSem : C.gris, fontFamily: "'Nunito', sans-serif", fontSize: 11.5, fontWeight: 900 }}>{f.label}</button>
                )
              })}
            </div>
          }
        />
        {lista.length === 0 ? <Vacio>Nada en esta lista.</Vacio> : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th style={{ width: 30 }}>#</th><th>Plato</th><th>Factura</th><th>Receta vinculada</th></tr></thead>
              <tbody>
                {lista.slice(0, 150).map((m, i) => {
                  const sug = sugerencias.get(m.id)
                  return (
                    <tr key={m.id}>
                      <td className="slnum" style={{ color: C.grisCl, fontSize: 11 }}>{i + 1}</td>
                      <td style={{ maxWidth: 340 }}>{m.nombre}</td>
                      <td className="slnum" style={{ minWidth: 90 }}>{eur0(Number(m.euros) || 0)}</td>
                      <td>
                        {filtro === 'bebidas' ? (
                          <Pill tone="neutro" dot>No pide receta</Pill>
                        ) : (
                          <>
                            <select value={m.receta_id ?? ''} disabled={busy === m.id} onChange={e => vincular(m.id, e.target.value)}
                              style={{ padding: '7px 10px', borderRadius: 999, minWidth: 220, border: `1px solid ${m.receta_id ? C.line : C.rojoSem}`, background: C.card, color: m.receta_id ? C.ink : C.rojoSem, fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                              <option value="">— Falta la receta —</option>
                              {recetas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                            </select>
                            {!m.receta_id && sug && (
                              <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                                <Pill tone="blu" dot>Se parece a «{sug.nombre}» · {Math.round(sug.score * 100)}%</Pill>
                                <button disabled={busy === m.id} onClick={() => vincular(m.id, sug.recetaId)}
                                  style={{ padding: '4px 10px', borderRadius: 999, border: 'none', background: C.verde, color: '#fff', fontFamily: "'Nunito', sans-serif", fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>Confirmar</button>
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
            {lista.length > 150 && <Nota tono="blu">Se muestran los 150 que más facturan de {num0(lista.length)}.</Nota>}
          </div>
        )}
        <Nota tono="ambar">Si el plato no tiene receta aún, créala en Cocina · Operativa → Libro de Recetas y vuelve a vincularla aquí.</Nota>
      </Card>
    </div>
  )
}
