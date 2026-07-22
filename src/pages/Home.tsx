import { BLANCO } from '@/styles/neobrutal'
/**
 * Home "HOY" — portada del ERP · kit oficial Neobrutal Alegre (18-jul-2026).
 * Fuentes reales: v_facturacion_diario_unificada (robots + en vivo, misma fuente que Panel Global) + tareas_pendientes.
 * LEY-ANTIFALSOS-01: si falta un dato, se enseña el hueco, nunca se inventa.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { INK, CREMA, GRANATE, AMA, VERDE, NARANJA, AZUL, VERDE_S, AMA_S, AZUL_S, ROSA_S, OSW, LEX, BORDER, SHADOW, cardWash, cardHead, eyebrow, bigNum, chip } from '@/styles/kit'
import HeroTocho, { Resaltado } from '@/components/kit/HeroTocho'
import FraseHero, { Sub } from '@/components/kit/FraseHero'
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
    { to: '/cocina/produccion', label: 'Producción', emoji: '📋' },
    { to: '/panel', label: 'Panel Global', emoji: '🧭' },
  ]

  return (
    <div style={{ fontFamily: LEX, maxWidth: 1100, margin: '0 auto', color: INK }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div>
          <span style={{ ...eyebrow, background: VERDE, color: BLANCO, display: 'inline-block', padding: '2px 10px', border: `2px solid ${INK}`, boxShadow: `2px 2px 0 ${INK}` }}>PORTADA</span>
          <h1 style={{ fontFamily: OSW, fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 700, letterSpacing: '0.04em', margin: '4px 0 0', textTransform: 'uppercase' }}>Hoy</h1>
        </div>
        <span style={{ ...eyebrow, color: '#6b5d45' }}>
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      {error && (
        <div style={{ background: ROSA_S, border: BORDER, boxShadow: SHADOW, padding: 12, marginBottom: 12, fontSize: 13 }}>
          No se han podido cargar los datos: {error}
        </div>
      )}

      <AlertasBanner />

      {/* HERO TOCHO */}
      <HeroTocho
        periodo="HOY EN VIVO"
        titular={cargando ? '…' : <>Llevas <Resaltado>{eur(hoy?.total_bruto ?? null)}</Resaltado> vendidos hoy.</>}
        etiquetaDato="AYER · FACTURACIÓN BRUTA"
        dato={cargando ? '…' : eur(totalAyer)}
        delta={delta == null ? undefined : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% semana`}
        deltaPositivo={(delta ?? 0) >= 0}
      />

      {/* FRASE HERO */}
      <div style={{ marginTop: 12 }}>
        <FraseHero>
          {cargando ? 'Leyendo el día…' : (
            <>
              {delta != null && delta >= 0 && <><b>Buena racha:</b> esta semana llevas <Sub wash={VERDE_S} borde={VERDE}>{eur(semana)} (+{delta.toFixed(1)}%)</Sub> frente a la anterior. </>}
              {delta != null && delta < 0 && <><b>Semana floja:</b> llevas <Sub wash={ROSA_S} borde={GRANATE}>{eur(semana)} ({delta.toFixed(1)}%)</Sub> frente a la anterior. </>}
              {delta == null && semana != null && <>Esta semana llevas <b>{eur(semana)}</b>. </>}
              {mejorCanal && <>Ayer tiró del carro <Sub wash={AMA_S} borde={AMA}>{mejorCanal.nombre} ({eur(mejorCanal.v)})</Sub>. </>}
              {nTareas != null && nTareas > 0 && <>Tienes <Sub wash={ROSA_S} borde={GRANATE}>{nTareas} tareas pendientes</Sub>.</>}
              {nTareas === 0 && <>Sin tareas pendientes. 👌</>}
            </>
          )}
        </FraseHero>
      </div>

      {/* KPIs de colores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, margin: '12px 0' }}>
        <div style={cardWash(AMA_S)}>
          <div style={eyebrow}>💰 HOY EN VIVO</div>
          <div style={bigNum}>{cargando ? '…' : eur(hoy?.total_bruto ?? null)}</div>
        </div>
        <div style={cardWash(VERDE_S)}>
          <div style={eyebrow}>📆 AYER</div>
          <div style={bigNum}>{cargando ? '…' : eur(totalAyer)}</div>
        </div>
        <div style={cardWash(AZUL_S)}>
          <div style={eyebrow}>🗓️ ÚLTIMOS 7 DÍAS</div>
          <div style={bigNum}>{cargando ? '…' : eur(semana)}</div>
          {delta != null && <span style={chip(delta >= 0 ? VERDE : GRANATE)}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%</span>}
        </div>
        <div style={cardWash(ROSA_S)}>
          <div style={eyebrow}>🔔 PENDIENTES</div>
          <div style={bigNum}>{nTareas ?? '—'}</div>
        </div>
      </div>

      {/* Bloques */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div style={{ background: BLANCO, border: BORDER, boxShadow: SHADOW, overflow: 'hidden' }}>
          <div style={cardHead(AZUL)}>📊 AYER POR CANAL</div>
          <div style={{ display: 'grid', gap: 8, fontSize: 13, fontWeight: 600, padding: '12px 14px' }}>
            {canales.map(c => {
              const v = ayer?.[c.clave] as number | null
              const pct = totalAyer && v != null && totalAyer > 0 ? (Number(v) / Number(totalAyer)) * 100 : null
              return (
                <div key={c.nombre}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{c.nombre}</span>
                    <span style={{ fontFamily: OSW }}>{cargando ? '…' : `${eur(v)}${pct != null ? ` · ${pct.toFixed(0)}%` : ''}`}</span>
                  </div>
                  <div style={{ height: 13, border: `2px solid ${INK}`, marginTop: 2, background: BLANCO }}>
                    <div style={{ width: `${Math.min(pct ?? 0, 100)}%`, height: '100%', background: c.color, borderRight: pct ? `2px solid ${INK}` : 'none' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ background: BLANCO, border: BORDER, boxShadow: SHADOW, overflow: 'hidden' }}>
          <div style={{ ...cardHead(NARANJA), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🔔 PENDIENTES</span>
            <Link to="/tareas" style={{ color: BLANCO, textDecoration: 'underline', fontSize: 11 }}>VER TODAS →</Link>
          </div>
          <div style={{ padding: '10px 14px' }}>
            {cargando ? '…' : tareas.length === 0 ? (
              <div style={{ fontSize: 13, color: '#6b5d45' }}>Nada pendiente. 👌</div>
            ) : tareas.map((t, i) => (
              <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: i > 0 ? '2px solid rgba(0,0,0,.12)' : 'none', fontSize: 13.5 }}>
                <span style={{ width: 9, height: 9, background: t.estado === 'atrasada' ? GRANATE : AMA, border: `2px solid ${INK}`, flexShrink: 0 }} />
                <span style={{ flex: 1, fontWeight: 600 }}>{t.tareas_periodicas?.nombre ?? 'Tarea'}</span>
                <span style={{ fontFamily: OSW, color: '#6b5d45', fontSize: 11 }}>{t.fecha_esperada?.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {accesos.map(a => (
          <Link key={a.to} to={a.to} style={{ background: CREMA, border: BORDER, boxShadow: SHADOW, padding: '11px 13px', textDecoration: 'none', color: INK, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{a.emoji}</span>
            <span style={{ fontFamily: OSW, fontSize: 15, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
