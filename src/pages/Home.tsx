/**
 * Home "HOY" — portada del ERP.
 * Responde en una pantalla: ¿cuánto vendimos ayer?, ¿cómo va hoy?, ¿qué tengo pendiente?
 * Fuentes reales: facturacion_diario (robots) + tareas_pendientes. Sin datos inventados:
 * si una fuente no tiene dato, se muestra el hueco (LEY-ANTIFALSOS-01).
 */
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'

const INK = '#0a0a0a'
const CREMA = '#FCEFD6'
const GRANATE = '#B01D23'
const AMA = '#FFC400'
const VERDE = '#0FB86B'
const CARD: CSSProperties = { background: '#fff', border: `3px solid ${INK}`, boxShadow: `5px 5px 0 ${INK}` }

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

const eur = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

const hoyISO = () => new Date().toISOString().slice(0, 10)
const diasAtras = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
}

export default function Home() {
  const [dias, setDias] = useState<Dia[]>([])
  const [tareas, setTareas] = useState<TareaRow[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let off = false
    ;(async () => {
      try {
        const [ventas, pend] = await Promise.all([
          supabase
            .from('facturacion_diario')
            .select('fecha,total_bruto,uber_bruto,glovo_bruto,je_bruto,web_bruto,directa_bruto')
            .gte('fecha', diasAtras(15))
            .order('fecha', { ascending: false }),
          supabase
            .from('tareas_pendientes')
            .select('id, fecha_esperada, estado, tareas_periodicas(nombre, modulo_destino, responsable)')
            .in('estado', ['pendiente', 'atrasada'])
            .order('fecha_esperada', { ascending: true })
            .limit(5),
        ])
        if (off) return
        if (ventas.error) throw ventas.error
        setDias((ventas.data as Dia[]) ?? [])
        setTareas(((pend.data ?? []) as unknown) as TareaRow[])
      } catch (e: unknown) {
        if (!off) setError(e instanceof Error ? e.message : 'Error al cargar')
      } finally {
        if (!off) setCargando(false)
      }
    })()
    return () => { off = true }
  }, [])

  const porFecha = useMemo(() => Object.fromEntries(dias.map(d => [d.fecha, d])), [dias])
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
  const semanaAnterior = suma(8, 14)
  const deltaSemana = semana != null && semanaAnterior != null && semanaAnterior > 0
    ? ((semana - semanaAnterior) / semanaAnterior) * 100 : null

  const canales: { clave: keyof Dia; nombre: string }[] = [
    { clave: 'uber_bruto', nombre: 'Uber Eats' },
    { clave: 'glovo_bruto', nombre: 'Glovo' },
    { clave: 'je_bruto', nombre: 'Just Eat' },
    { clave: 'web_bruto', nombre: 'Web' },
    { clave: 'directa_bruto', nombre: 'Directa' },
  ]

  const accesos = [
    { to: '/finanzas/documentacion', label: 'Subir factura', emoji: '📥' },
    { to: '/finanzas/ventas', label: 'Ventas', emoji: '💰' },
    { to: '/cocina/produccion', label: 'Producción', emoji: '📋' },
    { to: '/panel', label: 'Panel Global', emoji: '🧭' },
  ]

  const head: CSSProperties = { fontFamily: FONT.heading, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }

  return (
    <div style={{ fontFamily: 'Lexend, sans-serif', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ ...head, fontSize: 'clamp(24px, 4vw, 34px)', margin: 0 }}>HOY</h1>
        <span style={{ color: '#484f66', fontSize: 13 }}>
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      {error && (
        <div style={{ ...CARD, background: '#FBE4E5', padding: 12, marginBottom: 16, fontSize: 13 }}>
          No se han podido cargar los datos: {error}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
        {[
          { titulo: 'Ventas hoy (en vivo)', valor: eur(hoy?.total_bruto ?? null), bg: AMA },
          { titulo: 'Ventas ayer', valor: eur(ayer?.total_bruto ?? null), bg: '#fff' },
          {
            titulo: 'Últimos 7 días', valor: eur(semana), bg: '#fff',
            pie: deltaSemana == null ? undefined : `${deltaSemana >= 0 ? '▲' : '▼'} ${Math.abs(deltaSemana).toFixed(1)}% vs 7 anteriores`,
            pieColor: deltaSemana == null ? undefined : deltaSemana >= 0 ? VERDE : GRANATE,
          },
        ].map(k => (
          <div key={k.titulo} style={{ ...CARD, background: k.bg, padding: '14px 16px' }}>
            <div style={{ ...head, fontSize: 12, color: '#484f66' }}>{k.titulo}</div>
            <div style={{ ...head, fontSize: 34, lineHeight: 1.15 }}>{cargando ? '…' : k.valor}</div>
            {k.pie && <div style={{ fontSize: 12, fontWeight: 700, color: k.pieColor }}>{k.pie}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginBottom: 16 }}>
        {/* Ayer por canal */}
        <div style={{ ...CARD, padding: '14px 16px' }}>
          <div style={{ ...head, fontSize: 13, marginBottom: 8 }}>Ayer por canal</div>
          {canales.map(c => (
            <div key={c.nombre} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: `1.5px solid rgba(0,0,0,.12)`, fontSize: 14 }}>
              <span>{c.nombre}</span>
              <span style={{ fontWeight: 800 }}>{cargando ? '…' : eur((ayer?.[c.clave] as number | null) ?? null)}</span>
            </div>
          ))}
        </div>

        {/* Tareas */}
        <div style={{ ...CARD, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ ...head, fontSize: 13 }}>Pendientes</span>
            <Link to="/tareas" style={{ ...head, fontSize: 11, color: GRANATE, textDecoration: 'none' }}>Ver todas →</Link>
          </div>
          {cargando ? '…' : tareas.length === 0 ? (
            <div style={{ fontSize: 13, color: '#484f66' }}>Nada pendiente. 👌</div>
          ) : tareas.map(t => (
            <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', borderTop: `1.5px solid rgba(0,0,0,.12)`, fontSize: 13.5 }}>
              <span style={{ width: 8, height: 8, background: t.estado === 'atrasada' ? GRANATE : AMA, border: `1.5px solid ${INK}`, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{t.tareas_periodicas?.nombre ?? 'Tarea'}</span>
              <span style={{ color: '#484f66', fontSize: 11 }}>{t.fecha_esperada?.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Accesos rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        {accesos.map(a => (
          <Link key={a.to} to={a.to} style={{ ...CARD, background: CREMA, padding: '12px 14px', textDecoration: 'none', color: INK, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{a.emoji}</span>
            <span style={{ ...head, fontSize: 14 }}>{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
