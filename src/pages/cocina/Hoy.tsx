/**
 * Cocina · Hoy — panel global del área de cocina · CANTERA ALEGRE v1.0.
 * Mismo molde que la portada HOY: cabecera → héroe (NARANJA, área Cocina/Ops)
 * + tira de atención pegada → plancha de KPIs sólidos → bloques de papel con
 * ceja. No es una lista infinita: top 5 a rescatar, top 5 confirmables con un
 * clic, calidad del dato y accesos. La cola completa vive en Plato Maestro.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { vincularPlato } from '@/lib/cocina/vincularCliente'
import {
  requiereReceta, sugerirReceta, computeHoyKpis, buildTareasHoy,
  type Tarea, type MaestroLite,
} from '@/lib/cocina/platoHub'
import { BLANCO, GRIS } from '@/styles/neobrutal'
import { INK, CREMA, GRANATE, AMA, VERDE, NARANJA as NAR, AZUL, OSW, LEX, BORDER as BORDER_CARD, BORDER_FINO, SHADOW, eyebrow as eyebrowKit, chip } from '@/styles/kit'
import RutaPantalla from '@/components/ui/RutaPantalla'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'

interface Maestro { id: number; nombre: string; es_extra: boolean | null; receta_id: string | null; euros: number | null }
interface Receta { id: string; nombre: string; coste_rac: number | null }

const eur0 = (n: number) => `${Math.round(n).toLocaleString('es-ES')} €`
const nrm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const eyebrow: CSSProperties = { ...eyebrowKit }

type Fila = Tarea & { maestroIds: number[] }

/* ── piezas locales: cabecera de bloque de papel (título + acción a la derecha) ── */
function CabezaBloque({ head, right }: { head: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: `2px solid ${INK}` }}>
      <span style={eyebrow}>{head}</span>
      {right}
    </div>
  )
}
const btnAcceso: CSSProperties = {
  background: AMA, color: INK, border: `2px solid ${INK}`, boxShadow: SHADOW, textDecoration: 'none',
  padding: '9px 14px', fontFamily: OSW, fontWeight: 700, fontSize: 12.5, letterSpacing: '0.05em', textTransform: 'uppercase',
  display: 'inline-flex', alignItems: 'center', gap: 7,
}
const selectMini: CSSProperties = {
  padding: '5px 8px', maxWidth: 190, border: `2px solid ${INK}`, background: BLANCO, color: INK,
  fontFamily: OSW, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer',
}

export default function Hoy() {
  const [maestros, setMaestros] = useState<Maestro[]>([])
  const [recetas, setRecetas] = useState<Receta[]>([])
  const [ventas, setVentas] = useState<Map<number, { euros: number; unidades: number }>>(new Map())
  const [ingSinPrecio, setIngSinPrecio] = useState(0)
  const [epHuecos, setEpHuecos] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [pm, rec, mp, ing, eps] = await Promise.all([
      supabase.from('platos_maestros').select('id, nombre, es_extra, receta_id, euros').eq('activo', true),
      supabase.from('recetas').select('id, nombre, coste_rac'),
      supabase.from('mapeo_plato_receta').select('plato_maestro_id, euros, unidades'),
      supabase.from('ingredientes').select('eur_std, eur_min'),
      supabase.from('eps_lineas').select('eur_ud_neta'),
    ])
    setMaestros((pm.data ?? []) as Maestro[])
    setRecetas((rec.data ?? []) as Receta[])
    const v = new Map<number, { euros: number; unidades: number }>()
    for (const r of (mp.data ?? []) as any[]) {
      if (r.plato_maestro_id == null) continue
      const cur = v.get(r.plato_maestro_id) ?? { euros: 0, unidades: 0 }
      cur.euros += Number(r.euros) || 0
      cur.unidades += Number(r.unidades) || 0
      v.set(r.plato_maestro_id, cur)
    }
    setVentas(v)
    setIngSinPrecio(((ing.data ?? []) as any[]).filter(i => !(Number(i.eur_std) > 0) && !(Number(i.eur_min) > 0)).length)
    setEpHuecos(((eps.data ?? []) as any[]).filter(l => !(Number(l.eur_ud_neta) > 0)).length)
    setCargando(false)
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const costeReceta = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of recetas) if (r.coste_rac != null) m.set(r.id, Number(r.coste_rac))
    return m
  }, [recetas])

  const platos = useMemo(() => maestros.map(m => {
    const vt = ventas.get(m.id)
    const euros = vt?.euros ?? Number(m.euros) ?? 0
    const precioMedio = vt && vt.unidades > 0 ? vt.euros / vt.unidades : 0
    const coste = m.receta_id ? costeReceta.get(m.receta_id) : undefined
    const foodCostPct = coste != null && precioMedio > 0 ? (coste / precioMedio) * 100 : null
    const sugerencia = !m.receta_id && requiereReceta(m) ? sugerirReceta(m.nombre, recetas) : null
    return { ...m, euros, foodCostPct, sugerencia } as MaestroLite & { foodCostPct: number | null; sugerencia: any }
  }), [maestros, ventas, costeReceta, recetas])

  const kpis = useMemo(() => computeHoyKpis({ platos: platos.map(p => ({ euros: p.euros || 0, receta_id: p.receta_id, es_extra: p.es_extra, foodCostPct: p.foodCostPct })), alertasPrecio: ingSinPrecio }), [platos, ingSinPrecio])

  // Tareas agrupadas por nombre (variantes del mismo plato = una fila)
  const filas = useMemo<Fila[]>(() => {
    const base = buildTareasHoy({ platos, ingredientesSinPrecio: { count: 0 }, epHuecos: { count: 0 } })
    const out: Fila[] = []
    const grupos = new Map<string, Fila>()
    const nombreDe = (t: Tarea) => { const m = t.frase.match(/«([^»]+)»/); return m ? nrm(m[1]) : null }
    for (const t of base) {
      const agrupable = (t.tipo === 'vincular' || t.tipo === 'confirmar') && t.maestroId != null
      const k = agrupable ? `${t.tipo}:${nombreDe(t)}` : null
      if (k && grupos.has(k)) {
        const g = grupos.get(k)!
        g.maestroIds.push(t.maestroId!)
        g.euros += t.euros
      } else {
        const f: Fila = { ...t, maestroIds: t.maestroId != null ? [t.maestroId] : [] }
        out.push(f)
        if (k) grupos.set(k, f)
      }
    }
    return out.sort((a, b) => b.euros - a.euros)
  }, [platos])

  const rescatar   = useMemo(() => filas.filter(f => f.tipo === 'vincular' || f.tipo === 'escribir'), [filas])
  const confirmar  = useMemo(() => filas.filter(f => f.tipo === 'confirmar'), [filas])
  const fcRaros    = useMemo(() => filas.filter(f => f.tipo === 'foodcost'), [filas])
  const nombrePlato = (f: Fila) => { const m = f.frase.match(/«([^»]+)»/); return m ? m[1] : f.frase }
  const top5resc = rescatar.slice(0, 5)
  const top5conf = confirmar.slice(0, 5)

  const resolver = useCallback(async (f: Fila, recetaId: string) => {
    if (!f.maestroIds.length || !recetaId) return
    setBusy(f.key)
    try { for (const id of f.maestroIds) await vincularPlato(id, recetaId); await cargar() }
    finally { setBusy(null) }
  }, [cargar])

  const fc = Math.round(kpis.foodCostMedio)
  const fcBueno = fc > 0 && fc <= 35

  const atencion = cargando ? [] : ([
    `${rescatar.length} platos sin receta`,
    confirmar.length > 0 ? `${confirmar.length} confirmables con 1 clic` : null,
    fcRaros.length > 0 ? `${fcRaros.length} food cost raros` : null,
    ingSinPrecio > 0 ? `${ingSinPrecio} ingredientes sin precio` : null,
    epHuecos > 0 ? `${epHuecos} líneas de EP sin coste` : null,
  ].filter(Boolean) as string[])

  return (
    <PantallaCantera>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <RutaPantalla niveles={['Hoy']} />
        <span style={{ ...eyebrow, color: GRIS }}>
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      {/* HÉROE (naranja · área Cocina) + tira de atención */}
      <HeroCantera
        area="cocina"
        periodo={new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        titular={cargando ? '…' : <>De cada 100 € vendidos, solo <b>{Math.round(kpis.pctConCoste)} €</b> tienen su coste calculado.</>}
        etiquetaDato="Ventas sin receta · por rescatar"
        cifra={cargando ? '…' : eur0(kpis.eurosPorEscribir)}
        resumen={cargando ? undefined : <>Food cost real: <b>{fc}%</b>{fcBueno ? ' · dentro de objetivo.' : ' · por encima de lo saludable.'}</>}
        atencion={atencion}
      />

      {/* PLANCHA DE KPIs: sólidos pegados */}
      <div>
        <SeccionLabel bg={NAR}>KPIs de cocina</SeccionLabel>
        <Plancha>
          <PlanchaCelda bg={NAR} color={INK} first>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>🧾 Ventas con coste</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 28, lineHeight: 1.05, marginTop: 6 }}>{cargando ? '…' : `${Math.round(kpis.pctConCoste)}%`}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={fcBueno ? VERDE : GRANATE} color={BLANCO}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>🍽️ Food cost real</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 28, lineHeight: 1.05, marginTop: 6 }}>{cargando ? '…' : `${fc}%`}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={AMA} color={INK}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>💶 Por rescatar</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 28, lineHeight: 1.05, marginTop: 6 }}>{cargando ? '…' : eur0(kpis.eurosPorEscribir)}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={INK} color={CREMA}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>⚠️ Sin precio</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 28, lineHeight: 1.05, marginTop: 6 }}>{cargando ? '…' : ingSinPrecio}</div>
          </PlanchaCelda>
        </Plancha>
      </div>

      {/* FRASE POTENTE (color por significado, distinto del héroe naranja) */}
      {!cargando && (
        rescatar.length > 0
          ? <FrasePotente significado="coste">Cada plato sin receta esconde su margen real: resuélvelo antes de fijar precios.</FrasePotente>
          : <FrasePotente significado="logro">Toda la carta tiene receta: el food cost real refleja lo que de verdad pasa en cocina.</FrasePotente>
      )}

      {/* BLOQUES DE PAPEL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <Papel ceja={NAR}>
          <CabezaBloque head="🍲 TOP 5 A RESCATAR"
            right={<Link to="/cocina/operativa/plato-maestro" style={{ ...eyebrow, color: GRANATE, textDecoration: 'none' }}>Ver los {rescatar.length} →</Link>} />
          {cargando ? <span style={{ fontSize: 13 }}>Cargando…</span> : top5resc.length === 0 ? (
            <span style={{ fontSize: 13, fontWeight: 600 }}>Nada por rescatar. Todo con receta. 👌</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {top5resc.map((f, i) => (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i > 0 ? `1.5px solid ${CREMA}` : 'none' }}>
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 15, minWidth: 62, textAlign: 'right' }}>{eur0(f.euros)}</span>
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {nombrePlato(f)}
                    {f.maestroIds.length > 1 && <span style={{ marginLeft: 6, ...chip(AMA, INK), fontSize: 10 }}>{f.maestroIds.length} variantes</span>}
                  </span>
                  <select defaultValue="" disabled={busy === f.key} onChange={e => resolver(f, e.target.value)} style={selectMini}>
                    <option value="">Vincular…</option>
                    {recetas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </Papel>

        <Papel ceja={VERDE}>
          <CabezaBloque head="✅ CONFIRMAR CON 1 CLIC"
            right={confirmar.length > 5 ? <span style={{ ...eyebrow, color: GRIS }}>{confirmar.length} en total</span> : undefined} />
          {cargando ? <span style={{ fontSize: 13 }}>Cargando…</span> : top5conf.length === 0 ? (
            <span style={{ fontSize: 13, fontWeight: 600 }}>Sin sugerencias pendientes.</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {top5conf.map((f, i) => (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i > 0 ? `1.5px solid ${CREMA}` : 'none' }}>
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 15, minWidth: 62, textAlign: 'right' }}>{eur0(f.euros)}</span>
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{nombrePlato(f)}</span>
                  <button disabled={busy === f.key} onClick={() => f.recetaId && resolver(f, f.recetaId)}
                    style={{ background: VERDE, color: BLANCO, border: `2px solid ${INK}`, boxShadow: SHADOW, padding: '5px 11px', fontFamily: OSW, fontWeight: 700, fontSize: 11.5, textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {busy === f.key ? '…' : 'Confirmar'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Papel>

        <Papel ceja={AZUL}>
          <CabezaBloque head="🧮 CALIDAD DEL DATO" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, fontWeight: 600 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>{ingSinPrecio} ingredientes sin precio</span>
              <Link to="/cocina/dinero/datos" style={{ ...eyebrow, color: GRANATE, textDecoration: 'none' }}>Poner precios →</Link>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>{epHuecos} líneas de EP sin coste</span>
              <Link to="/cocina/dinero/datos" style={{ ...eyebrow, color: GRANATE, textDecoration: 'none' }}>Completar →</Link>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>{fcRaros.length} platos con food cost raro</span>
              <Link to="/cocina/dinero/analisis" style={{ ...eyebrow, color: GRANATE, textDecoration: 'none' }}>Revisar →</Link>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ color: fcRaros.length + (ingSinPrecio > 0 ? 1 : 0) > 0 ? INK : VERDE }}>
                Cada dato bueno afina el margen real por plato.
              </span>
            </div>
          </div>
        </Papel>

        <Papel ceja={GRANATE}>
          <CabezaBloque head="⚡ ACCESOS DE COCINA" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Link to="/cocina/operativa/recetas" style={btnAcceso}>📋 Libro de Recetas</Link>
            <Link to="/cocina/operativa/produccion" style={btnAcceso}>🏭 Producción</Link>
            <Link to="/cocina/operativa/plato-maestro" style={btnAcceso}>🍲 Plato Maestro</Link>
            <Link to="/cocina/dinero/datos" style={btnAcceso}>⚖️ Escandallo</Link>
            <Link to="/cocina/dinero/analisis" style={btnAcceso}>📊 Menú Engineering</Link>
          </div>
        </Papel>
      </div>
    </PantallaCantera>
  )
}
