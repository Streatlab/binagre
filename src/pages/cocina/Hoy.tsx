/**
 * Hoy — panel de cocina (Bloque 2). 4 KPIs + una lista de tareas ordenada por €,
 * cada fila una frase en cristiano y un botón que la resuelve. Resolver =
 * desaparece. Móvil-friendly, sin tarjetas gigantes. Vincular usa el único
 * vinculador (RPC vincular_plato_maestro), igual que el hub Plato Maestro.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { vincularPlato } from '@/lib/cocina/vincularCliente'
import {
  requiereReceta, sugerirReceta, computeHoyKpis, buildTareasHoy,
  type Tarea, type MaestroLite,
} from '@/lib/cocina/platoHub'
import { C, Card, CardHead, Kpi, KpiGrid, Pill, Nota, Vacio } from '@/components/panel/sl/uiSL'

interface Maestro { id: number; nombre: string; es_extra: boolean | null; receta_id: string | null; euros: number | null }
interface Receta { id: string; nombre: string; coste_rac: number | null }

const KPI_TONO = { pct: 'verde', fc: 'blu', esc: 'rojo', al: 'ambar' } as const

export default function Hoy() {
  const [maestros, setMaestros] = useState<Maestro[]>([])
  const [recetas, setRecetas] = useState<Receta[]>([])
  const [ventas, setVentas] = useState<Map<number, { euros: number; unidades: number }>>(new Map())
  const [ingSinPrecio, setIngSinPrecio] = useState(0)
  const [epHuecos, setEpHuecos] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)

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

  // Platos con su € de ventas y food cost real (coste_rac / precio medio de venta).
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

  const tareas = useMemo(() => buildTareasHoy({
    platos,
    ingredientesSinPrecio: { count: ingSinPrecio },
    epHuecos: { count: epHuecos },
  }), [platos, ingSinPrecio, epHuecos])

  const resolver = useCallback(async (t: Tarea, recetaId: string) => {
    if (!t.maestroId || !recetaId) return
    setBusy(t.maestroId)
    try { await vincularPlato(t.maestroId, recetaId); await cargar() }
    finally { setBusy(null) }
  }, [cargar])

  if (cargando) {
    return <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}><Card><Vacio>Cargando la cocina de hoy…</Vacio></Card></div>
  }

  return (
    <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px' }}>🏠 Hoy</div>
        <div style={{ fontSize: 12, color: C.grisCl, fontWeight: 700, marginTop: 2 }}>Lo que mueve la aguja hoy, ordenado por euros. Resuelve de arriba abajo.</div>
      </div>

      <KpiGrid>
        <Kpi icono="✓" tono={KPI_TONO.pct} label="Ventas con coste" valor={`${Math.round(kpis.pctConCoste)}%`} pie={<Pill tone="verde" dot>calculado</Pill>} />
        <Kpi icono="%" tono={KPI_TONO.fc} label="Food cost medio" valor={`${Math.round(kpis.foodCostMedio)}%`} pie={<Pill tone="blu" dot>real ponderado</Pill>} />
        <Kpi icono="✎" tono={KPI_TONO.esc} label="Recetas por escribir" valor={`${Math.round(kpis.eurosPorEscribir)} €`} pie={<Pill tone="rojo" dot>en ventas</Pill>} />
        <Kpi icono="!" tono={KPI_TONO.al} label="Alertas de precio" valor={String(kpis.alertasPrecio)} pie={<Pill tone="ambar" dot>ingredientes</Pill>} />
      </KpiGrid>

      <Card>
        <CardHead title="Tareas de hoy" sub="Una frase, un botón. Al resolverla desaparece." right={<Pill tone="neutro">{tareas.length}</Pill>} />
        {tareas.length === 0 ? <Vacio>Todo al día. Nada pendiente en cocina. 🎉</Vacio> : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {tareas.slice(0, 80).map(t => (
              <div key={t.key} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '10px 4px', borderBottom: `1px solid ${C.line}` }}>
                <div style={{ flex: '1 1 260px', minWidth: 200, fontSize: 13, fontWeight: 700, color: C.ink }}>
                  {t.euros > 0 && <span className="slnum" style={{ color: C.grisCl, marginRight: 8 }}>{Math.round(t.euros)} €</span>}
                  {t.frase}
                </div>
                <div style={{ flexShrink: 0 }}>{accion(t, recetas, busy, resolver)}</div>
              </div>
            ))}
            {tareas.length > 80 && <Nota tono="blu">Se muestran las 80 de mayor impacto de {tareas.length}.</Nota>}
          </div>
        )}
      </Card>
    </div>
  )
}

function accion(
  t: Tarea,
  recetas: Receta[],
  busy: number | null,
  resolver: (t: Tarea, recetaId: string) => void,
) {
  if (t.tipo === 'vincular' || t.tipo === 'confirmar' || t.tipo === 'foodcost') {
    return (
      <select defaultValue={t.recetaId ?? ''} disabled={busy === t.maestroId} onChange={e => resolver(t, e.target.value)}
        style={{ padding: '7px 10px', borderRadius: 999, minWidth: 200, border: `1px solid ${C.rojoSem}`, background: C.card, color: C.ink, fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
        <option value="">{t.tipo === 'confirmar' ? '— Confirmar receta —' : '— Elegir receta —'}</option>
        {recetas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
      </select>
    )
  }
  if (t.tipo === 'ingsinprecio') return <Link to="/cocina/numeros/datos" style={btn}>Poner precios</Link>
  if (t.tipo === 'ep') return <Link to="/cocina/numeros/datos" style={btn}>Completar EP</Link>
  return <Link to="/cocina/numeros/plato-maestro" style={btn}>Abrir</Link>
}

const btn: React.CSSProperties = { padding: '7px 13px', borderRadius: 999, textDecoration: 'none', background: C.ink, color: '#fff', fontFamily: "'Nunito', sans-serif", fontSize: 11.5, fontWeight: 900, whiteSpace: 'nowrap' }
