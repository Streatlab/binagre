import { BLANCO, GRIS } from '@/styles/neobrutal'
/**
 * Home "HOY" — portada del ERP · CANTERA ALEGRE v1.0 (22-jul-2026).
 * Área Resumen/HOY → héroe AMARILLO (texto tinta, mark naranja).
 * Estructura del sistema: cabecera → héroe + tira de atención → plancha de KPIs
 * sólidos PEGADOS → bloques de papel con ceja de color y aire 16px → accesos
 * (pulsables = con sombra). Derogados los lavados/pasteles como fondo de tarjeta.
 * Fuentes reales: v_facturacion_diario_unificada + tareas_pendientes.
 * LEY-ANTIFALSOS-01: si falta un dato, se enseña el hueco, nunca se inventa.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { INK, CREMA, GRANATE, AMA, VERDE, NARANJA, AZUL, ROJO, OSW, LEX, BORDER, SHADOW, eyebrow, bigNum, chip } from '@/styles/kit'
import type { CSSProperties, ReactNode } from 'react'
import HeroTocho, { Resaltado } from '@/components/kit/HeroTocho'
import RutaPantalla from '@/components/ui/RutaPantalla'
import { AlertasBanner } from '@/pages/finanzas/PanelAlertas'

type Dia = {
  fecha: string
  total_bruto: number | null
  uber_bruto: number | null
  glovo_bruto: number | null
  je_bruto: number | null
  web_bruto: number | null
  directa_bruto: number | null
}
type TareaRow = {
  id: string
  fecha_esperada: string
  estado: string
  tareas_periodicas: { nombre: string; modulo_destino: string | null; responsable: string | null } | null
}

const eur = (n: number | null | undefined, dec = 0) =>
  n == null ? '—' : n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: dec })
const hoyISO = () => new Date().toISOString().slice(0, 10)
const diasAtras = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

/* ── piezas locales CANTERA ALEGRE ── */
/** Celda de plancha: sólido pegado, sin sombra. */
function Celda({ bg, color, label, children, ultima }: { bg: string; color: string; label: ReactNode; children: ReactNode; ultima?: boolean }) {
  return (
    <div style={{ background: bg, color, padding: '16px 18px', borderRight: ultima ? 'none' : BORDER, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ ...eyebrow, opacity: 0.75 }}>{label}</div>
      <div style={{ ...bigNum, fontSize: 34, color }}>{children}</div>
    </div>
  )
}
/** Bloque de papel con ceja superior de color (7px). Sin sombra. */
function Bloque({ ceja, head, right, children, pad = '12px 15px' }: { ceja: string; head: ReactNode; right?: ReactNode; children: ReactNode; pad?: string }) {
  return (
    <div style={{ background: BLANCO, border: BORDER, borderTop: `7px solid ${ceja}`, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '10px 15px', borderBottom: `2px solid ${INK}` }}>
        <span style={eyebrow}>{head}</span>
        {right}
      </div>
      <div style={{ padding: pad, flex: 1 }}>{children}</div>
    </div>
  )
}
const chipAtencion: CSSProperties = {
  background: BLANCO, color: INK, border: `2px solid ${INK}`, boxShadow: '2px 2px 0 rgba(0,0,0,.45)',
  padding: '3px 10px', fontFamily: OSW, fontWeight: 600, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase',
}

export default function Home() {
  const [dias, setDias] = useState<Dia[]>([])
  const [tareas, setTareas] = useState<TareaRow[]>([])
  const [nTareas, setNTareas] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let off = false
    ;(async () => {
      try {
        const [ventas, pend] = await Promise.all([
          supabase.from('v_facturacion_diario_unificada')
            .select('fecha,total_bruto,uber_bruto,glovo_bruto,je_bruto,web_bruto,directa_bruto')
            .gte('fecha', diasAtras(15)).order('fecha', { ascending: false }),
          supabase.from('tareas_pendientes')
            .select('id, fecha_esperada, estado, tareas_periodicas(nombre, modulo_destino, responsable)', { count: 'exact' })
            .in('estado', ['pendiente', 'atrasada'])
            .order('fecha_esperada', { ascending: true }).limit(5),
        ])
        if (off) return
        if (ventas.error) throw ventas.error
        setDias((ventas.data as Dia[]) ?? [])
        setTareas(((pend.data ?? []) as unknown) as TareaRow[])
        setNTareas(pend.count ?? null)
      } catch (e: unknown) {
        if (!off) setError(e instanceof Error ? e.message : 'Error al cargar')
      } finally { if (!off) setCargando(false) }
    })()
    return () => { off = true }
  }, [])

  // La vista trae VARIAS filas por día (facturación se parte por titular Rubén/Emilio,
  // más la fila "en vivo"). Sumamos todas las filas de la misma fecha; antes se cogía
  // una sola y el total del día salía corto (p. ej. ayer 702 € en vez de 890 €).
  const porFecha = useMemo(() => {
    const acc: Record<string, Dia> = {}
    const suma = (a: number | null, b: number | null) =>
      a == null && b == null ? null : (a ?? 0) + (b ?? 0)
    for (const d of dias) {
      const e = acc[d.fecha]
      if (!e) { acc[d.fecha] = { ...d }; continue }
      e.total_bruto   = suma(e.total_bruto, d.total_bruto)
      e.uber_bruto    = suma(e.uber_bruto, d.uber_bruto)
      e.glovo_bruto   = suma(e.glovo_bruto, d.glovo_bruto)
      e.je_bruto      = suma(e.je_bruto, d.je_bruto)
      e.web_bruto     = suma(e.web_bruto, d.web_bruto)
      e.directa_bruto = suma(e.directa_bruto, d.directa_bruto)
    }
    return acc
  }, [dias])
  const hoy = porFecha[hoyISO()]
  const ayer = porFecha[diasAtras(1)]
  const suma = (desde: number, hasta: number) => {
    let acc = 0, hay = false
    for (let i = desde; i <= hasta; i++) {
      const d = porFecha[diasAtras(i)]
      if (d?.total_bruto != null) { acc += Number(d.total_bruto); hay = true }
    }
    return hay ? acc : null
  }
  const semana = suma(1, 7)
  const semanaAnt = suma(8, 14)
  const delta = semana != null && semanaAnt != null && semanaAnt > 0 ? ((semana - semanaAnt) / semanaAnt) * 100 : null

  const canales: { clave: keyof Dia; nombre: string; color: string }[] = [
    { clave: 'uber_bruto', nombre: 'UBER EATS', color: VERDE },
    { clave: 'glovo_bruto', nombre: 'GLOVO', color: AMA },
    { clave: 'je_bruto', nombre: 'JUST EAT', color: NARANJA },
    { clave: 'web_bruto', nombre: 'WEB PROPIA', color: GRANATE },
  ]
  const totalAyer = ayer?.total_bruto ?? null
  const mejorCanal = useMemo(() => {
    if (!ayer) return null
    let best: { nombre: string; v: number } | null = null
    for (const c of canales) {
      const v = Number(ayer[c.clave] ?? 0)
      if (!best || v > best.v) best = { nombre: c.nombre, v }
    }
    return best && best.v > 0 ? best : null
  }, [ayer])

  const accesos = [
    { to: '/finanzas/papeleo?tab=bandeja', label: 'Subir factura', emoji: '📥' },
    { to: '/finanzas/ventas-panel?tab=ventas', label: 'Ventas', emoji: '💰' },
    { to: '/cocina/operativa', label: 'Producción', emoji: '📋' },
    { to: '/panel', label: 'Panel Global', emoji: '🧭' },
  ]

  return (
    <div style={{ fontFamily: LEX, maxWidth: 1100, margin: '0 auto', color: INK, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Cabecera · CANTERA ALEGRE v4 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <RutaPantalla niveles={['Hoy']} subtitulo={new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} />
      </div>

      {error && (
        <div style={{ background: BLANCO, border: BORDER, borderTop: `7px solid ${ROJO}`, padding: 12, fontSize: 13 }}>
          No se han podido cargar los datos: {error}
        </div>
      )}

      <AlertasBanner />

      {/* HÉROE (amarillo · área Resumen/HOY) + tira de atención pegada */}
      <div>
        <HeroTocho
          periodo="HOY EN VIVO"
          titular={cargando ? '…' : <>Llevas <Resaltado>{eur(hoy?.total_bruto ?? null)}</Resaltado> vendidos hoy.</>}
          etiquetaDato="AYER · FACTURACIÓN BRUTA"
          dato={cargando ? '…' : eur(totalAyer)}
          delta={delta == null ? undefined : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% semana`}
          deltaPositivo={(delta ?? 0) >= 0}
        />
        <div style={{ background: INK, color: CREMA, border: BORDER, borderTop: 'none', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ ...eyebrow, color: CREMA }}>ATENCIÓN →</span>
          {cargando ? <span style={{ fontFamily: OSW, fontSize: 12 }}>Leyendo el día…</span> : (
            <>
              {delta != null && semana != null && (
                <span style={chipAtencion}>{delta >= 0 ? 'Buena racha' : 'Semana floja'}: {eur(semana)} · {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%</span>
              )}
              {delta == null && semana != null && <span style={chipAtencion}>Esta semana: {eur(semana)}</span>}
              {mejorCanal && <span style={chipAtencion}>Ayer tiró {mejorCanal.nombre} · {eur(mejorCanal.v)}</span>}
              {nTareas != null && nTareas > 0 && <span style={chipAtencion}>{nTareas} tareas pendientes</span>}
              {nTareas === 0 && <span style={chipAtencion}>Sin tareas pendientes 👌</span>}
            </>
          )}
        </div>
      </div>

      {/* PLANCHA DE KPIs: sólidos pegados, sin sombra */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', border: BORDER }}>
        <Celda bg={AMA} color={INK} label="💰 HOY EN VIVO">{cargando ? '…' : eur(hoy?.total_bruto ?? null)}</Celda>
        <Celda bg={VERDE} color={BLANCO} label="📆 AYER">{cargando ? '…' : eur(totalAyer)}</Celda>
        <Celda bg={AZUL} color={BLANCO} label="🗓️ ÚLTIMOS 7 DÍAS">
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span>{cargando ? '…' : eur(semana)}</span>
            {delta != null && <span style={{ ...chip(delta >= 0 ? VERDE : ROJO), fontSize: 12 }}>{delta >= 0 ? '▲ +' : '▼ −'}{Math.abs(delta).toFixed(1)}%</span>}
          </span>
        </Celda>
        <Celda bg={INK} color={CREMA} label="🔔 PENDIENTES" ultima>{nTareas ?? '—'}</Celda>
      </div>

      {/* BLOQUES DE PAPEL con ceja y aire */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <Bloque ceja={AZUL} head="📊 AYER POR CANAL">
          <div style={{ display: 'grid', gap: 12, fontSize: 13, fontWeight: 600 }}>
            {canales.map(c => {
              const v = ayer?.[c.clave] as number | null
              const pct = totalAyer && v != null && totalAyer > 0 ? (Number(v) / Number(totalAyer)) * 100 : null
              return (
                <div key={c.nombre}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: OSW, fontSize: 11.5, letterSpacing: '0.1em' }}>{c.nombre}</span>
                    <span style={{ fontFamily: OSW }}>{cargando ? '…' : `${eur(v)}${pct != null ? ` · ${pct.toFixed(0)}%` : ''}`}</span>
                  </div>
                  <div style={{ height: 14, border: `2px solid ${INK}`, marginTop: 4, background: CREMA }}>
                    <div style={{ width: `${Math.min(pct ?? 0, 100)}%`, height: '100%', background: c.color, borderRight: pct ? `2px solid ${INK}` : 'none' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Bloque>

        <Bloque ceja={NARANJA} head="🔔 PENDIENTES" right={
          <Link to="/tareas" style={{ ...eyebrow, color: INK, textDecoration: 'underline' }}>VER TODAS →</Link>
        } pad="10px 15px">
          {cargando ? '…' : tareas.length === 0 ? (
            <div style={{ fontSize: 13, color: GRIS }}>Nada pendiente. 👌</div>
          ) : tareas.map((t, i) => (
            <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,.14)' : 'none', fontSize: 13.5 }}>
              <span style={{ width: 9, height: 9, background: t.estado === 'atrasada' ? ROJO : AMA, border: `2px solid ${INK}`, flexShrink: 0 }} />
              <span style={{ flex: 1, fontWeight: 600 }}>{t.tareas_periodicas?.nombre ?? 'Tarea'}</span>
              <span style={{ fontFamily: OSW, color: GRIS, fontSize: 11 }}>{t.fecha_esperada?.slice(5)}</span>
            </div>
          ))}
        </Bloque>
      </div>

      {/* ACCESOS RÁPIDOS: pulsables → con sombra */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
        {accesos.map(a => (
          <Link key={a.to} to={a.to} style={{ background: BLANCO, border: BORDER, boxShadow: SHADOW, padding: '11px 13px', textDecoration: 'none', color: INK, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{a.emoji}</span>
            <span style={{ fontFamily: OSW, fontSize: 15, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
