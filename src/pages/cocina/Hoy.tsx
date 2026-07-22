/**
 * Hoy — panel de cocina (Bloque 2), piel neobrutal uniforme con el resto del ERP.
 * 4 KPIs + lista de tareas ordenada por €, una frase y un botón por fila.
 * Tareas de vincular con el MISMO nombre de plato se agrupan en una sola fila
 * (resolverla vincula todos los maestros del grupo a la vez).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { vincularPlato } from '@/lib/cocina/vincularCliente'
import {
  requiereReceta, sugerirReceta, computeHoyKpis, buildTareasHoy,
  type Tarea, type MaestroLite,
} from '@/lib/cocina/platoHub'
import { OSW, LEX, INK, CREMA, BLANCO, GRANATE, AMA, VERDE, NAR, AZUL, GRIS, BORDE_SUAVE } from '@/styles/neobrutal'

interface Maestro { id: number; nombre: string; es_extra: boolean | null; receta_id: string | null; euros: number | null }
interface Receta { id: string; nombre: string; coste_rac: number | null }

const SOMBRA = `5px 5px 0 ${INK}`
const nrm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const eur0 = (n: number) => `${Math.round(n).toLocaleString('es-ES')} €`

type Fila = Tarea & { maestroIds: number[] }

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

  // Agrupar tareas de vincular/confirmar con el mismo nombre de plato en UNA fila.
  const filas = useMemo<Fila[]>(() => {
    const base = buildTareasHoy({ platos, ingredientesSinPrecio: { count: ingSinPrecio }, epHuecos: { count: epHuecos } })
    const out: Fila[] = []
    const grupos = new Map<string, Fila>()
    const nombreDe = (t: Tarea) => {
      const m = t.frase.match(/«([^»]+)»/)
      return m ? nrm(m[1]) : null
    }
    for (const t of base) {
      const agrupable = (t.tipo === 'vincular' || t.tipo === 'confirmar') && t.maestroId != null
      const k = agrupable ? `${t.tipo}:${nombreDe(t)}` : null
      if (k && grupos.has(k)) {
        const g = grupos.get(k)!
        g.maestroIds.push(t.maestroId!)
        g.euros += t.euros
        g.frase = g.frase.replace(/vende [\d.,]+ €/, `vende ${eur0(g.euros)}`)
      } else {
        const f: Fila = { ...t, maestroIds: t.maestroId != null ? [t.maestroId] : [] }
        out.push(f)
        if (k) grupos.set(k, f)
      }
    }
    return out.sort((a, b) => b.euros - a.euros)
  }, [platos, ingSinPrecio, epHuecos])

  const resolver = useCallback(async (f: Fila, recetaId: string) => {
    if (!f.maestroIds.length || !recetaId) return
    setBusy(f.key)
    try { for (const id of f.maestroIds) await vincularPlato(id, recetaId); await cargar() }
    finally { setBusy(null) }
  }, [cargar])

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', background: CREMA, padding: '26px 30px', fontFamily: LEX }}>
        <div style={cardStyle}><div style={{ padding: 22, fontFamily: OSW, fontWeight: 700, textTransform: 'uppercase', color: GRIS }}>Cargando la cocina de hoy…</div></div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: CREMA, padding: '26px 30px', fontFamily: LEX }}>
      {/* Cabecera uniforme con el resto del ERP */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: OSW, fontWeight: 800, fontSize: 34, letterSpacing: '0.02em', textTransform: 'uppercase', color: GRANATE }}>Cocina · Hoy</div>
        <div style={{ fontFamily: LEX, fontSize: 13, fontWeight: 600, color: INK, marginTop: 2 }}>Lo que mueve la aguja hoy, ordenado por euros. Resuelve de arriba abajo.</div>
      </div>

      {/* KPIs neobrutal */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 18 }}>
        <KpiCard color={VERDE} label="Ventas con coste" valor={`${Math.round(kpis.pctConCoste)}%`} pie="calculado" />
        <KpiCard color={AZUL} label="Food cost medio" valor={`${Math.round(kpis.foodCostMedio)}%`} pie="real ponderado" />
        <KpiCard color={GRANATE} label="Recetas por escribir" valor={eur0(kpis.eurosPorEscribir)} pie="en ventas" />
        <KpiCard color={NAR} label="Alertas de precio" valor={String(kpis.alertasPrecio)} pie="ingredientes" />
      </div>

      {/* Tareas */}
      <div style={cardStyle}>
        <div style={{ background: INK, color: BLANCO, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: OSW, fontWeight: 800, fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.03em', flex: 1 }}>Tareas de hoy</span>
          <span style={{ fontFamily: OSW, fontWeight: 800, fontSize: 13, background: AMA, color: INK, border: `2px solid ${BLANCO}`, padding: '1px 9px' }}>{filas.length}</span>
        </div>
        {filas.length === 0 ? (
          <div style={{ padding: 22, fontFamily: OSW, fontWeight: 700, textTransform: 'uppercase', color: GRIS }}>Todo al día. Nada pendiente en cocina.</div>
        ) : (
          <div>
            {filas.slice(0, 80).map((f, i) => (
              <div key={f.key} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '9px 16px', background: i % 2 ? '#faf6ee' : BLANCO, borderTop: i > 0 ? `1.5px solid ${BORDE_SUAVE}` : 'none' }}>
                <span style={{ fontFamily: OSW, fontWeight: 800, fontSize: 17, color: INK, minWidth: 74, textAlign: 'right' }}>{f.euros > 0 ? eur0(f.euros) : '—'}</span>
                <span style={{ flex: '1 1 280px', minWidth: 220, fontFamily: LEX, fontSize: 13.5, fontWeight: 600, color: INK }}>
                  {f.frase}
                  {f.maestroIds.length > 1 && <span style={{ marginLeft: 8, fontFamily: OSW, fontWeight: 700, fontSize: 10.5, background: AMA, border: `1.5px solid ${INK}`, padding: '1px 6px', textTransform: 'uppercase' }}>{f.maestroIds.length} variantes</span>}
                </span>
                <span style={{ flexShrink: 0 }}>{accion(f, recetas, busy, resolver)}</span>
              </div>
            ))}
            {filas.length > 80 && <div style={{ padding: '9px 16px', fontFamily: LEX, fontSize: 12, fontWeight: 600, color: GRIS, borderTop: `1.5px solid ${BORDE_SUAVE}` }}>Se muestran las 80 de mayor impacto de {filas.length}.</div>}
          </div>
        )}
      </div>
    </div>
  )
}

const cardStyle: CSSProperties = { background: BLANCO, border: `3px solid ${INK}`, boxShadow: SOMBRA, overflow: 'hidden' }

function KpiCard({ color, label, valor, pie }: { color: string; label: string; valor: string; pie: string }) {
  return (
    <div style={{ background: BLANCO, border: `3px solid ${INK}`, boxShadow: SOMBRA }}>
      <div style={{ height: 7, background: color, borderBottom: `3px solid ${INK}` }} />
      <div style={{ padding: '10px 14px 12px' }}>
        <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 12.5, letterSpacing: '0.07em', textTransform: 'uppercase', color: INK }}>{label}</div>
        <div style={{ fontFamily: OSW, fontWeight: 800, fontSize: 34, lineHeight: 1.05, color: INK, marginTop: 2 }}>{valor}</div>
        <div style={{ fontFamily: LEX, fontSize: 11.5, fontWeight: 600, color: GRIS, marginTop: 2 }}>{pie}</div>
      </div>
    </div>
  )
}

const btnStyle: CSSProperties = { padding: '7px 14px', textDecoration: 'none', background: AMA, color: INK, border: `2px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, fontFamily: OSW, fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap', display: 'inline-block' }

function accion(
  f: Fila,
  recetas: Receta[],
  busy: string | null,
  resolver: (f: Fila, recetaId: string) => void,
) {
  if (f.tipo === 'vincular' || f.tipo === 'confirmar' || f.tipo === 'foodcost') {
    return (
      <select defaultValue={f.recetaId ?? ''} disabled={busy === f.key} onChange={e => resolver(f, e.target.value)}
        style={{ padding: '7px 10px', minWidth: 200, border: `2px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, background: BLANCO, color: INK, fontFamily: OSW, fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>
        <option value="">{f.tipo === 'confirmar' ? '— Confirmar receta —' : '— Elegir receta —'}</option>
        {recetas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
      </select>
    )
  }
  if (f.tipo === 'ingsinprecio') return <Link to="/cocina/numeros/datos" style={btnStyle}>Poner precios</Link>
  if (f.tipo === 'ep') return <Link to="/cocina/numeros/datos" style={btnStyle}>Completar EP</Link>
  return <Link to="/cocina/numeros/plato-maestro" style={btnStyle}>Abrir</Link>
}
