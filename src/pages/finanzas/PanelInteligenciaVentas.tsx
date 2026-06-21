import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import {
  COLOR, COLORS, OSWALD, LEXEND, lbl, lblXs, kpiBig, CARDS, BAR,
} from '@/components/panel/resumen/tokens'

/* ============================================================
   PANEL INTELIGENCIA — pestaña "Detalle ventas" del módulo Ventas.
   Estilo canónico del ERP (tokens spec Panel Global).
   UNIDADES = reales (pedidos_plataforma). IMPORTES = estimados
   (los pedidos llegan sin precio hasta enchufar export con importes).
   ============================================================ */

const TICKET_EST = 14.5            // € ticket medio estimado por pedido
const PESO_PLAT: Record<string, number> = { uber: 0.46, glovo: 0.27, just_eat: 0.15, web: 0.12 }
const COMISION: Record<string, number> = { uber: 0.30, glovo: 0.30, just_eat: 0.30, web: 0.0 }

interface Linea {
  plataforma: string | null
  marca: string | null
  plato: string | null
  tipo_linea: string | null
  precio_bruto: number | null
  hora: string | null
  fecha: string | null
  factura_origen: string | null
}

const fmtPct = (v: number) => `${v.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}%`
const nf0 = (n: number) => Math.round(n).toLocaleString('es-ES')

function agrupa(rows: Linea[], key: (r: Linea) => string | null, filtro?: (r: Linea) => boolean) {
  const m = new Map<string, number>()
  for (const r of rows) {
    if (filtro && !filtro(r)) continue
    const k = (key(r) || '').trim()
    if (!k) continue
    m.set(k, (m.get(k) || 0) + 1)
  }
  return Array.from(m, ([etiqueta, unidades]) => ({ etiqueta, unidades })).sort((a, b) => b.unidades - a.unidades)
}

export default function PanelInteligenciaVentas() {
  const [rows, setRows] = useState<Linea[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let alive = true
    setCargando(true)
    supabase
      .from('pedidos_plataforma')
      .select('plataforma, marca, plato, tipo_linea, precio_bruto, hora, fecha, factura_origen')
      .order('fecha', { ascending: true })
      .then(({ data }) => { if (alive) { setRows((data as Linea[]) ?? []); setCargando(false) } })
    return () => { alive = false }
  }, [])

  const d = useMemo(() => {
    const platos = rows.filter(r => r.tipo_linea === 'plato' || r.tipo_linea === 'bebida' || !r.tipo_linea)
    const pedidos = new Set(rows.map(r => r.factura_origen).filter(Boolean)).size || Math.round(rows.length / 1.8)
    const bruto = pedidos * TICKET_EST
    const canales = (['uber', 'glovo', 'just_eat', 'web'] as const).map(id => {
      const b = bruto * (PESO_PLAT[id] ?? 0)
      const neto = b * (1 - COMISION[id])
      return { id, bruto: b, neto, margen: b > 0 ? (neto / b) * 100 : 0 }
    })
    const comisionTotal = canales.reduce((a, c) => a + (c.bruto - c.neto), 0)
    const porMarca = agrupa(rows, r => r.marca, r => r.tipo_linea !== 'cargo')
    const porProducto = agrupa(platos, r => r.plato).slice(0, 10)
    const porModificador = agrupa(rows, r => r.plato, r => r.tipo_linea === 'modificador').slice(0, 10)
    const porHora = agrupa(rows, r => (r.hora ? `${r.hora.slice(0, 2)}h` : null))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta))
    return { pedidos, bruto, neto: bruto - comisionTotal, comisionTotal, comisionAnual: comisionTotal * (365 / 17), canales, porMarca, porProducto, porModificador, porHora, totalPlatos: platos.length }
  }, [rows])

  if (cargando) return <div style={{ ...CARDS.std, textAlign: 'center', color: COLORS.mut, fontFamily: LEXEND, padding: 28 }}>Cargando…</div>

  const kpis = [
    { label: 'PEDIDOS', value: nf0(d.pedidos), color: COLORS.pri, est: false },
    { label: 'UNIDADES VENDIDAS', value: nf0(d.totalPlatos), color: COLORS.pri, est: false },
    { label: 'FACTURACIÓN (EST.)', value: fmtEur(d.bruto), color: COLORS.redSL, est: true },
    { label: 'TE PAGAN (EST.)', value: fmtEur(d.neto), color: COLORS.ok, est: true },
  ]

  const CANAL_STYLE: Record<string, { label: string; bg: string; border: string; col: string }> = {
    uber: { label: 'UBER EATS', bg: `${COLOR.uber}20`, border: COLOR.uber, col: COLOR.verdeOscuro },
    glovo: { label: 'GLOVO', bg: `${COLOR.glovo}30`, border: 'rgba(200,180,0,0.30)', col: COLOR.glovoDark },
    just_eat: { label: 'JUST EAT', bg: `${COLOR.je}20`, border: COLOR.je, col: COLOR.jeDark },
    web: { label: 'TIENDA ONLINE', bg: `${COLOR.webSL}10`, border: `${COLOR.webSL}50`, col: COLOR.webDark },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Aviso estimación */}
      <div style={{
        display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8,
        background: `${COLORS.glovo}33`, border: `0.5px solid ${COLORS.glovoDark}55`, borderRadius: 10, padding: '5px 12px',
      }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: COLORS.redSL }} />
        <span style={{ ...lblXs, color: COLORS.glovoDark }}>UNIDADES REALES · IMPORTES ESTIMADOS HASTA ENCHUFAR EXPORT</span>
      </div>

      {/* KPIs grandes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {kpis.map(c => (
          <div key={c.label} style={{ ...CARDS.big, padding: '20px 22px' }}>
            <div style={{ ...lbl, fontSize: 11 }}>{c.label}</div>
            <div style={{ ...kpiBig, color: c.color, marginTop: 6 }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Coste de depender */}
      <div style={{ ...CARDS.std, background: `${COLORS.redSL}0d`, border: `0.5px solid ${COLORS.redSL}33` }}>
        <div style={{ ...lbl, color: COLORS.redSL }}>COSTE DE DEPENDER DE PLATAFORMAS</div>
        <div style={{ fontFamily: OSWALD, fontSize: 34, fontWeight: 600, color: COLORS.redSL, lineHeight: 1.05, marginTop: 4 }}>
          {fmtEur(d.comisionAnual)} <span style={{ fontSize: 14, color: COLORS.mut }}>/año proyectado (est.)</span>
        </div>
        <div style={{ fontFamily: LEXEND, fontSize: 12, color: COLORS.sec, marginTop: 6 }}>
          Cada pedido movido a tienda online (0% comisión) recupera ~30% de margen.
        </div>
      </div>

      {/* Facturación por canal — patrón canónico */}
      <div style={{ ...CARDS.std }}>
        <div style={{ ...lbl, marginBottom: 10 }}>FACTURACIÓN POR CANAL (EST.)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {d.canales.map(c => {
            const s = CANAL_STYLE[c.id]
            return (
              <div key={c.id} style={{
                background: s.bg, border: `0.5px solid ${s.border}`, borderRadius: 14, padding: '12px 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              }}>
                <div>
                  <div style={{ ...lblXs, color: s.col }}>{s.label}</div>
                  <div style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 600, color: COLORS.pri, marginTop: 2 }}>{fmtEur(c.bruto)}</div>
                  <div style={{ fontSize: 11, color: COLORS.sec, fontFamily: LEXEND }}>Bruto</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 600, color: COLORS.ok }}>{fmtEur(c.neto)}</div>
                  <div style={{ fontSize: 13, color: COLORS.ok, fontFamily: LEXEND }}>Margen {fmtPct(c.margen)}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Mapa horario (real) */}
      <div style={{ ...CARDS.std }}>
        <div style={{ ...lbl, marginBottom: 12 }}>VENTAS POR FRANJA HORARIA (REAL)</div>
        <BarrasHorizontales data={d.porHora} color={COLORS.redSL} sufijo=" uds" />
      </div>

      {/* Marcas + Productos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ ...CARDS.std }}>
          <div style={{ ...lbl, marginBottom: 12 }}>VENTAS POR MARCA (REAL)</div>
          <BarrasHorizontales data={d.porMarca.slice(0, 13)} color={COLORS.sidebar} sufijo=" uds" />
        </div>
        <div style={{ ...CARDS.std }}>
          <div style={{ ...lbl, marginBottom: 12 }}>TOP PRODUCTOS (REAL)</div>
          <BarrasHorizontales data={d.porProducto} color={COLORS.ok} sufijo="×" />
        </div>
      </div>

      {/* Modificadores + Familias */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ ...CARDS.std }}>
          <div style={{ ...lbl, marginBottom: 12 }}>TOP MODIFICADORES (REAL)</div>
          {d.porModificador.length === 0
            ? <div style={{ fontFamily: LEXEND, fontSize: 13, color: COLORS.mut, padding: '12px 0' }}>Sin modificadores en los pedidos cargados.</div>
            : <BarrasHorizontales data={d.porModificador} color={COLORS.je} sufijo="×" />}
        </div>
        <div style={{ ...CARDS.std }}>
          <div style={{ ...lbl, marginBottom: 12 }}>VENTAS POR FAMILIA / CATEGORÍA</div>
          <div style={{ fontFamily: LEXEND, fontSize: 13, color: COLORS.mut, padding: '12px 0', lineHeight: 1.5 }}>
            Pendiente: requiere mapear cada plato a su familia en Carta (carta_platos vacía).
            En cuanto la carta tenga categorías, este informe sale automático.
          </div>
        </div>
      </div>
    </div>
  )
}

/* Barras horizontales con el patrón de BAR.track del spec */
function BarrasHorizontales({ data, color, sufijo }: { data: Array<{ etiqueta: string; unidades: number }>; color: string; sufijo: string }) {
  const max = Math.max(1, ...data.map(d => d.unidades))
  const total = data.reduce((a, d) => a + d.unidades, 0) || 1
  if (data.length === 0) return <div style={{ fontFamily: LEXEND, fontSize: 13, color: COLORS.mut, padding: '12px 0' }}>Sin datos.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {data.map(d => (
        <div key={d.etiqueta} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 150, fontFamily: LEXEND, fontSize: 12, color: COLORS.sec, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.etiqueta}>{d.etiqueta}</span>
          <div style={{ ...BAR.track, flex: 1, height: 10 }}>
            <div style={{ width: `${(d.unidades / max) * 100}%`, background: color, borderRadius: 4 }} />
          </div>
          <span style={{ width: 78, textAlign: 'right', fontFamily: OSWALD, fontSize: 13, fontWeight: 600, color: COLORS.pri }}>
            {nf0(d.unidades)}{sufijo} <span style={{ color: COLORS.mut, fontSize: 11, fontFamily: LEXEND }}>{Math.round((d.unidades / total) * 100)}%</span>
          </span>
        </div>
      ))}
    </div>
  )
}
