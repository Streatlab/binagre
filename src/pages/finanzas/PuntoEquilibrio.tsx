import { useState, useEffect, useMemo, type CSSProperties } from 'react'
import { fmtEur } from '@/utils/format'
import { useTheme, FONT, pageTitleStyle } from '@/styles/tokens'
import type { TokenSet } from '@/styles/tokens'

/* ═══════════════════════════════════════════════════════════
   TIPOS
   ═══════════════════════════════════════════════════════════ */

interface PorDia {
  dow: number
  dia: string
  bruto_medio: number
  estado: 'cubre' | 'ajustado' | 'pierde'
  delta: number
  n_dias: number
}

interface DashboardData {
  fecha: string
  dia_actual: number
  dias_mes: number
  parametros: Record<string, any>
  fijos_mes: number
  comision_pct: number
  variable_pct: number
  margen_pct: number
  pe_mensual: number | null
  pe_diario: number | null
  pe_semanal: number | null
  fijo_diario: number
  bruto_mes: number
  pedidos_mes: number
  bruto_diario_real: number
  proyeccion_mes: number
  dia_cubre_fijos: number | null
  bruto_para_objetivo: number | null
  objetivo_neto: number
  por_dia_semana: PorDia[]
  mix: { uber: number; glovo: number; je: number; web: number; directa: number; total: number; pedidos: number }
  presupuestos: { comida: { target_semana: number; gastado: number }; packaging: { target_semana: number; gastado: number } }
}

interface SimResult {
  fijos_mes: number
  variable_pct: number
  margen_pct: number
  pe_mensual: number
  pe_diario: number
  pe_semanal: number
  bruto_para_objetivo: number
  objetivo_neto: number
}

/* ═══════════════════════════════════════════════════════════
   ESTILOS BASE
   ═══════════════════════════════════════════════════════════ */

const labelStyle = (T: TokenSet): CSSProperties => ({
  fontFamily: FONT.heading,
  fontSize: 11,
  color: T.mut,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  fontWeight: 500,
})

const numGiganteStyle = (T: TokenSet, color?: string): CSSProperties => ({
  fontFamily: FONT.heading,
  fontSize: 36,
  fontWeight: 600,
  color: color || T.pri,
  letterSpacing: '-0.5px',
  lineHeight: 1.05,
  marginTop: 8,
})

const inputStyle = (T: TokenSet): CSSProperties => ({
  padding: '8px 12px',
  backgroundColor: T.inp,
  color: T.pri,
  border: `1px solid ${T.brd}`,
  borderRadius: 6,
  fontFamily: FONT.body,
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
})

const btnPrimario: CSSProperties = {
  padding: '9px 18px',
  backgroundColor: '#B01D23',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontFamily: FONT.heading,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  letterSpacing: '1px',
  textTransform: 'uppercase',
}

const cardBase = (T: TokenSet): CSSProperties => ({
  backgroundColor: T.card,
  borderRadius: 14,
  padding: 22,
  border: `0.5px solid ${T.brd}`,
})

/* ═══════════════════════════════════════════════════════════
   PÁGINA
   ═══════════════════════════════════════════════════════════ */

type Tab = 'dashboard' | 'presupuestos' | 'simulador' | 'dow' | 'config'

export default function PuntoEquilibrio() {
  const { T } = useTheme()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch('/api/pe/dashboard')
      .then(async r => {
        const text = await r.text()
        if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${text.slice(0, 300)}`)
        try {
          return JSON.parse(text) as DashboardData
        } catch {
          throw new Error(`Respuesta no JSON (${r.status}). Probable endpoint no desplegado.`)
        }
      })
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message || String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [refreshKey])

  return (
    <div style={{ background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 28px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
        <h1 style={pageTitleStyle(T)}>Punto de Equilibrio</h1>
        <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec }}>
          Simulador de decisiones · datos en vivo
        </span>
      </div>

      <Tabs T={T} tab={tab} setTab={setTab} />

      {loading && (
        <div style={{ padding: 40, color: T.mut, fontFamily: FONT.body }}>Cargando...</div>
      )}

      {!loading && error && (
        <div style={{
          padding: 20,
          borderRadius: 10,
          background: '#A32D2D22',
          borderLeft: '3px solid #A32D2D',
          fontFamily: FONT.body,
          fontSize: 13,
          color: T.pri,
          lineHeight: 1.6,
        }}>
          <strong>Error cargando dashboard PE:</strong>
          <div style={{ marginTop: 6, color: T.sec, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error}</div>
          <div style={{ marginTop: 10, color: T.mut, fontSize: 12 }}>
            Comprueba que el endpoint <code>/api/pe/dashboard</code> está desplegado y que Supabase
            tiene la tabla <code>pe_parametros</code> con un registro global (<code>marca_id IS NULL</code>).
          </div>
        </div>
      )}

      {!loading && !error && data && tab === 'dashboard' && <TabDashboard T={T} data={data} />}
      {!loading && !error && data && tab === 'presupuestos' && <TabPresupuestos T={T} data={data} />}
      {!loading && !error && data && tab === 'simulador' && <TabSimulador T={T} data={data} />}
      {!loading && !error && data && tab === 'dow' && <TabDow T={T} data={data} />}
      {!loading && !error && data && tab === 'config' && (
        <TabConfig T={T} data={data} onSaved={() => setRefreshKey(k => k + 1)} />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   TABS NAV
   ═══════════════════════════════════════════════════════════ */

function Tabs({ T, tab, setTab }: { T: TokenSet; tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'presupuestos', label: 'Presupuestos' },
    { id: 'simulador', label: 'Simulador' },
    { id: 'dow', label: 'Día semana' },
    { id: 'config', label: 'Configuración' },
  ]
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
      {tabs.map(t => {
        const active = tab === t.id
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: active ? 'none' : `0.5px solid ${T.brd}`,
              background: active ? '#FF4757' : 'transparent',
              color: active ? '#fff' : T.sec,
              fontFamily: FONT.body,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 150ms',
            }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   TAB DASHBOARD
   ═══════════════════════════════════════════════════════════ */

function TabDashboard({ T, data }: { T: TokenSet; data: DashboardData }) {
  const estadoGlobal: 'cubre' | 'ajustado' | 'pierde' =
    data.pe_mensual && data.proyeccion_mes >= data.pe_mensual * 1.1 ? 'cubre'
      : data.pe_mensual && data.proyeccion_mes >= data.pe_mensual ? 'ajustado'
      : 'pierde'

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 16 }}>
        <CardDiaCubres T={T} data={data} />
        <CardCuantoFacturar T={T} data={data} />
        <CardEstadoMes T={T} data={data} estado={estadoGlobal} />
      </div>
      <CardCosteNegocio T={T} data={data} />
      <div style={{ height: 16 }} />
      <CardAcciones T={T} data={data} />
    </>
  )
}

function CardDiaCubres({ T, data }: { T: TokenSet; data: DashboardData }) {
  const dia = data.dia_cubre_fijos
  const estaHoy = data.dia_actual
  const yaCubierto = dia != null && estaHoy >= dia
  const color = yaCubierto ? '#1D9E75' : '#BA7517'

  return (
    <div style={{
      ...cardBase(T),
      borderTop: `3px solid ${color}`,
    }}>
      <div style={labelStyle(T)}>¿Cuándo cubro gastos?</div>
      <div style={numGiganteStyle(T, yaCubierto ? '#1D9E75' : T.pri)}>
        Día {dia ?? '—'}
      </div>
      <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginTop: 10, lineHeight: 1.5 }}>
        {dia == null
          ? 'Sin datos suficientes para calcular.'
          : yaCubierto
            ? `Ya cubres fijos (hoy día ${estaHoy}). Todo lo que entre es beneficio.`
            : `Faltan ${dia - estaHoy} días. Llevas ${estaHoy} de ${data.dias_mes}.`
        }
      </div>
    </div>
  )
}

function CardCuantoFacturar({ T, data }: { T: TokenSet; data: DashboardData }) {
  return (
    <div style={cardBase(T)}>
      <div style={labelStyle(T)}>Cuánto facturar</div>
      <div style={{ marginTop: 14 }}>
        <FilaFacturar T={T} label="Cubrir gastos" valor={data.pe_mensual} valorDia={data.pe_diario} />
        <FilaFacturar
          T={T}
          label={`Ganar ${fmtEur(data.objetivo_neto)} limpio`}
          valor={data.bruto_para_objetivo}
          valorDia={data.bruto_para_objetivo != null ? Math.round(data.bruto_para_objetivo / 30) : null}
          destacar
        />
      </div>
    </div>
  )
}

function FilaFacturar({ T, label, valor, valorDia, destacar }: { T: TokenSet; label: string; valor: number | null; valorDia: number | null; destacar?: boolean }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginBottom: 3 }}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{
          fontFamily: FONT.heading,
          fontSize: destacar ? 24 : 18,
          color: destacar ? '#FF4757' : T.pri,
          fontWeight: 600,
        }}>
          {valor != null ? fmtEur(valor) : '—'}
        </span>
        <span style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
          {valorDia != null ? `${fmtEur(valorDia)}/día` : ''}
        </span>
      </div>
    </div>
  )
}

function CardEstadoMes({ T, data, estado }: { T: TokenSet; data: DashboardData; estado: 'cubre' | 'ajustado' | 'pierde' }) {
  const colores: Record<string, { bg: string; label: string }> = {
    cubre: { bg: '#1D9E75', label: 'Vas bien' },
    ajustado: { bg: '#BA7517', label: 'Ajustado' },
    pierde: { bg: '#A32D2D', label: 'Pierdes' },
  }
  const c = colores[estado]
  const gap = data.pe_mensual ? data.proyeccion_mes - data.pe_mensual : 0

  return (
    <div style={{
      backgroundColor: c.bg,
      borderRadius: 14,
      padding: 22,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      minHeight: 180,
    }}>
      <div>
        <div style={{ fontFamily: FONT.heading, fontSize: 11, color: 'rgba(255,255,255,0.75)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
          Estado mes
        </div>
        <div style={{ fontFamily: FONT.heading, fontSize: 32, color: '#fff', fontWeight: 600, marginTop: 8, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>
          {c.label}
        </div>
      </div>
      <div>
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: '#fff', fontWeight: 500 }}>
          {gap >= 0 ? '+' : ''}{fmtEur(gap)} vs PE proyectado
        </div>
        <div style={{ fontFamily: FONT.body, fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
          Bruto mes: {fmtEur(data.bruto_mes)} · Proy: {fmtEur(data.proyeccion_mes)}
        </div>
      </div>
    </div>
  )
}

function CardCosteNegocio({ T, data }: { T: TokenSet; data: DashboardData }) {
  const brutoObjDia = data.bruto_para_objetivo != null ? Math.round(data.bruto_para_objetivo / 30) : 0
  return (
    <div style={cardBase(T)}>
      <div style={labelStyle(T)}>Coste de mantener Streat Lab</div>
      <table style={{ width: '100%', marginTop: 14, fontFamily: FONT.body, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: T.mut, fontSize: 11, fontFamily: FONT.heading, letterSpacing: '1px', textTransform: 'uppercase' }}>
            <th style={{ textAlign: 'left', padding: '6px 0' }}></th>
            <th style={{ textAlign: 'right' }}>Día</th>
            <th style={{ textAlign: 'right' }}>Semana</th>
            <th style={{ textAlign: 'right' }}>Mes</th>
            <th style={{ textAlign: 'right' }}>Año</th>
          </tr>
        </thead>
        <tbody style={{ color: T.pri, fontSize: 14 }}>
          <tr style={{ borderTop: `0.5px solid ${T.brd}` }}>
            <td style={{ padding: '10px 0', color: T.sec }}>Coste fijo</td>
            <td style={{ textAlign: 'right' }}>{fmtEur(data.fijo_diario)}</td>
            <td style={{ textAlign: 'right' }}>{fmtEur(data.fijo_diario * 7)}</td>
            <td style={{ textAlign: 'right' }}>{fmtEur(data.fijos_mes)}</td>
            <td style={{ textAlign: 'right' }}>{fmtEur(data.fijos_mes * 12)}</td>
          </tr>
          <tr style={{ borderTop: `0.5px solid ${T.brd}` }}>
            <td style={{ padding: '10px 0', color: T.sec }}>Bruto para cubrir</td>
            <td style={{ textAlign: 'right', color: '#BA7517' }}>{fmtEur(data.pe_diario)}</td>
            <td style={{ textAlign: 'right', color: '#BA7517' }}>{fmtEur(data.pe_semanal)}</td>
            <td style={{ textAlign: 'right', color: '#BA7517' }}>{fmtEur(data.pe_mensual)}</td>
            <td style={{ textAlign: 'right', color: '#BA7517' }}>{fmtEur((data.pe_mensual ?? 0) * 12)}</td>
          </tr>
          <tr style={{ borderTop: `0.5px solid ${T.brd}` }}>
            <td style={{ padding: '10px 0', color: T.sec }}>Para ganar {fmtEur(data.objetivo_neto)}/mes limpio</td>
            <td style={{ textAlign: 'right', color: '#FF4757', fontWeight: 600 }}>{fmtEur(brutoObjDia)}</td>
            <td style={{ textAlign: 'right', color: '#FF4757', fontWeight: 600 }}>{fmtEur(brutoObjDia * 7)}</td>
            <td style={{ textAlign: 'right', color: '#FF4757', fontWeight: 600 }}>{fmtEur(data.bruto_para_objetivo)}</td>
            <td style={{ textAlign: 'right', color: '#FF4757', fontWeight: 600 }}>{fmtEur((data.bruto_para_objetivo ?? 0) * 12)}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ marginTop: 14, fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
        Margen bruto {data.margen_pct}% · Comisión ponderada {data.comision_pct}% · Food {data.parametros.food_cost_pct}% + Packaging {data.parametros.packaging_pct}%
      </div>
    </div>
  )
}

function CardAcciones({ T, data }: { T: TokenSet; data: DashboardData }) {
  const acciones = calcularAcciones(data)
  if (acciones.length === 0) return null
  return (
    <div style={cardBase(T)}>
      <div style={labelStyle(T)}>Acciones recomendadas</div>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {acciones.map((a, i) => (
          <div key={i} style={{
            padding: 12,
            borderRadius: 8,
            backgroundColor: `${a.color}15`,
            borderLeft: `3px solid ${a.color}`,
          }}>
            <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, fontWeight: 600 }}>
              {a.titulo}
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec, marginTop: 4 }}>
              → {a.sugerencia}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function calcularAcciones(data: DashboardData): { color: string; titulo: string; sugerencia: string }[] {
  const out: { color: string; titulo: string; sugerencia: string }[] = []

  const diasPerder = data.por_dia_semana.filter(d => d.estado === 'pierde' && d.n_dias >= 2)
  if (diasPerder.length > 0) {
    out.push({
      color: '#A32D2D',
      titulo: `${diasPerder.map(d => d.dia).join(' y ')}: pierdes dinero`,
      sugerencia: 'Menú ejecutivo, promo captación esos días, o reducir personal',
    })
  }

  const directas = data.mix.web + data.mix.directa
  const pctDirecta = data.mix.total > 0 ? (directas / data.mix.total) * 100 : 0
  if (pctDirecta < 5 && data.mix.total > 0) {
    const extra = Math.round(data.mix.total * 0.01 * 0.30)
    out.push({
      color: '#BA7517',
      titulo: `Canal directo solo ${pctDirecta.toFixed(1)}% del bruto`,
      sugerencia: `Cada 1% recuperado = +${fmtEur(extra)}/mes limpio (0% comisión)`,
    })
  }

  if (data.pe_mensual && data.proyeccion_mes > data.pe_mensual * 1.3) {
    const margen = data.proyeccion_mes - data.pe_mensual
    out.push({
      color: '#1D9E75',
      titulo: `Margen mensual proyectado ${fmtEur(margen)}`,
      sugerencia: 'Capacidad para absorber contratación o inversión',
    })
  }

  if (data.pe_mensual && data.proyeccion_mes < data.pe_mensual) {
    const falta = data.pe_mensual - data.proyeccion_mes
    out.push({
      color: '#A32D2D',
      titulo: `Proyección mensual por debajo de PE`,
      sugerencia: `Faltan ${fmtEur(falta)} para cubrir. Revisa canal directo y mix de pedidos.`,
    })
  }

  return out
}

/* ═══════════════════════════════════════════════════════════
   TAB PRESUPUESTOS
   ═══════════════════════════════════════════════════════════ */

function TabPresupuestos({ T, data }: { T: TokenSet; data: DashboardData }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <BarraPresupuesto T={T} titulo="Comida esta semana" target={data.presupuestos.comida.target_semana} gastado={data.presupuestos.comida.gastado} />
        <BarraPresupuesto T={T} titulo="Packaging esta semana" target={data.presupuestos.packaging.target_semana} gastado={data.presupuestos.packaging.gastado} />
      </div>
      <div style={{ height: 16 }} />
      <SimuladorGastar T={T} />
    </>
  )
}

function BarraPresupuesto({ T, titulo, target, gastado }: { T: TokenSet; titulo: string; target: number; gastado: number }) {
  const pct = target > 0 ? (gastado / target) * 100 : 0
  const color = pct < 80 ? '#1D9E75' : pct < 100 ? '#BA7517' : '#A32D2D'
  const disponible = Math.max(0, target - gastado)
  return (
    <div style={cardBase(T)}>
      <div style={labelStyle(T)}>{titulo}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 }}>
        <span style={{ fontFamily: FONT.heading, fontSize: 28, color: T.pri, fontWeight: 600 }}>
          {fmtEur(gastado)}
        </span>
        <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.mut }}>
          de {fmtEur(target)}
        </span>
      </div>
      <div style={{ height: 8, backgroundColor: T.brd, borderRadius: 4, marginTop: 12, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(pct, 100)}%`,
          height: '100%',
          backgroundColor: color,
          transition: 'width 0.3s',
        }} />
      </div>
      <div style={{ fontFamily: FONT.body, fontSize: 12, color, marginTop: 8, fontWeight: 500 }}>
        {disponible > 0 ? `Te quedan ${fmtEur(disponible)}` : `Te has pasado ${fmtEur(-disponible)}`}
      </div>
    </div>
  )
}

function SimuladorGastar({ T }: { T: TokenSet }) {
  const [importe, setImporte] = useState<number>(0)
  const [categoria, setCategoria] = useState('PRD-ALI')
  const [resultado, setResultado] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function evaluar() {
    if (importe <= 0) return
    setLoading(true)
    try {
      const r = await fetch('/api/pe/puedo-gastar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importe, categoria }),
      })
      setResultado(await r.json())
    } finally {
      setLoading(false)
    }
  }

  const estadoColor = resultado?.estado === 'verde' ? '#1D9E75'
    : resultado?.estado === 'ambar' ? '#BA7517' : '#A32D2D'

  return (
    <div style={cardBase(T)}>
      <div style={labelStyle(T)}>¿Puedo gastar ahora?</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, marginTop: 14 }}>
        <input
          type="number"
          placeholder="Importe €"
          value={importe || ''}
          onChange={(e) => setImporte(parseFloat(e.target.value) || 0)}
          style={inputStyle(T)}
        />
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={inputStyle(T)}>
          <option value="PRD-ALI">Comida</option>
          <option value="PRD-PKG">Packaging</option>
          <option value="SUMINISTROS">Suministros</option>
          <option value="OTROS">Otros</option>
        </select>
        <button onClick={evaluar} disabled={loading || importe <= 0} style={{ ...btnPrimario, opacity: loading || importe <= 0 ? 0.6 : 1 }}>
          {loading ? 'Evaluando...' : 'Evaluar'}
        </button>
      </div>

      {resultado && (
        <div style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 8,
          backgroundColor: `${estadoColor}22`,
          borderLeft: `3px solid ${estadoColor}`,
        }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 16, color: T.pri, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
            {resultado.estado === 'verde' ? 'Sí' : resultado.estado === 'ambar' ? 'Cuidado' : 'No'}
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec, marginTop: 4 }}>
            {resultado.recomendacion}
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 8 }}>
            Caja actual: {fmtEur(resultado.caja_actual)} · Caja después: {fmtEur(resultado.caja_despues)} · Gastado categoría mes: {fmtEur(resultado.gastado_con_esto)}
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   TAB SIMULADOR
   ═══════════════════════════════════════════════════════════ */

function TabSimulador({ T, data }: { T: TokenSet; data: DashboardData }) {
  const [p, setP] = useState<Record<string, any>>(() => ({ ...data.parametros }))
  const [resultado, setResultado] = useState<SimResult | null>(null)

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await fetch('/api/pe/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      })
      setResultado(await r.json())
    }, 250)
    return () => clearTimeout(t)
  }, [p])

  const set = (k: string, v: number) => setP(prev => ({ ...prev, [k]: v }))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
      <div style={cardBase(T)}>
        <div style={labelStyle(T)}>Ajusta parámetros</div>
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Slider T={T} label="Sueldos empleados" value={Number(p.sueldos_empleados || 0)} min={0} max={10000} step={100} onChange={v => set('sueldos_empleados', v)} fmt={fmtEur} />
          <Slider T={T} label="Think Paladar" value={Number(p.think_paladar || 0)} min={0} max={3000} step={50} onChange={v => set('think_paladar', v)} fmt={fmtEur} />
          <Slider T={T} label="Alquiler local" value={Number(p.alquiler_local || 0)} min={0} max={2500} step={50} onChange={v => set('alquiler_local', v)} fmt={fmtEur} />
          <Slider T={T} label="Sueldo Rubén" value={Number(p.sueldo_ruben || 0)} min={0} max={4000} step={50} onChange={v => set('sueldo_ruben', v)} fmt={fmtEur} />
          <Slider T={T} label="Sueldo Emilio" value={Number(p.sueldo_emilio || 0)} min={0} max={4000} step={50} onChange={v => set('sueldo_emilio', v)} fmt={fmtEur} />
          <Slider T={T} label="Food cost" value={Number(p.food_cost_pct || 0)} min={15} max={45} step={0.5} onChange={v => set('food_cost_pct', v)} fmt={v => `${v}%`} />
          <Slider T={T} label="Packaging" value={Number(p.packaging_pct || 0)} min={0} max={5} step={0.1} onChange={v => set('packaging_pct', v)} fmt={v => `${v}%`} />
          <Slider T={T} label="Objetivo neto/mes" value={Number(p.objetivo_beneficio_mensual || 0)} min={0} max={15000} step={100} onChange={v => set('objetivo_beneficio_mensual', v)} fmt={fmtEur} />
        </div>
      </div>

      <div style={cardBase(T)}>
        <div style={labelStyle(T)}>Impacto</div>
        {resultado && (
          <>
            <div style={numGiganteStyle(T, '#FF4757')}>
              {fmtEur(resultado.pe_mensual)}
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginTop: 2 }}>
              PE simulado ({fmtEur(resultado.pe_diario)}/día · {fmtEur(resultado.pe_semanal)}/semana)
            </div>

            <div style={{ height: 1, backgroundColor: T.brd, margin: '18px 0' }} />

            <Comparar T={T} label="PE mensual actual" a={data.pe_mensual ?? 0} b={resultado.pe_mensual} />
            <Comparar T={T} label="Fijos mes" a={data.fijos_mes} b={resultado.fijos_mes} />
            <Comparar T={T} label="Margen %" a={data.margen_pct} b={resultado.margen_pct} pct />
            <Comparar T={T} label={`Bruto para ganar ${fmtEur(resultado.objetivo_neto)}`} a={data.bruto_para_objetivo ?? 0} b={resultado.bruto_para_objetivo} />

            <div style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 8,
              backgroundColor: T.group,
              fontFamily: FONT.body,
              fontSize: 12,
              color: T.pri,
              lineHeight: 1.5,
            }}>
              {data.pe_mensual && resultado.pe_mensual > data.pe_mensual
                ? `Necesitas facturar ${fmtEur(resultado.pe_mensual - data.pe_mensual)} más/mes para mantener posición.`
                : data.pe_mensual
                  ? `Ahorras ${fmtEur(data.pe_mensual - resultado.pe_mensual)} de objetivo mensual.`
                  : '—'}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Slider({ T, label, value, min = 0, max, step, onChange, fmt }: { T: TokenSet; label: string; value: number; min?: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec }}>{label}</span>
        <span style={{ fontFamily: FONT.heading, fontSize: 14, color: T.pri, fontWeight: 600 }}>{fmt(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#FF4757' }}
      />
    </div>
  )
}

function Comparar({ T, label, a, b, pct }: { T: TokenSet; label: string; a: number; b: number; pct?: boolean }) {
  const delta = b - a
  const signo = delta >= 0 ? '+' : ''
  const deltaColor = delta === 0 ? T.mut : delta > 0 ? '#A32D2D' : '#1D9E75'
  // Para margen_pct (mayor = mejor), invertir semántica visual
  const isMargenPct = label.toLowerCase().includes('margen')
  const color = isMargenPct ? (delta === 0 ? T.mut : delta > 0 ? '#1D9E75' : '#A32D2D') : deltaColor
  const fmt = pct ? (v: number) => `${v.toFixed(1)}%` : fmtEur
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'baseline', padding: '6px 0', borderBottom: `0.5px solid ${T.brd}` }}>
      <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec }}>{label}</span>
      <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>{fmt(a)} → {fmt(b)}</span>
      <span style={{ fontFamily: FONT.heading, fontSize: 12, fontWeight: 600, color, minWidth: 80, textAlign: 'right' }}>
        {signo}{fmt(delta)}
      </span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   TAB DÍA SEMANA
   ═══════════════════════════════════════════════════════════ */

function TabDow({ T, data }: { T: TokenSet; data: DashboardData }) {
  const peDiario = data.pe_diario ?? 0
  return (
    <>
      <div style={{ ...cardBase(T), marginBottom: 16 }}>
        <div style={labelStyle(T)}>Umbral diario</div>
        <div style={{ display: 'flex', gap: 24, marginTop: 10, alignItems: 'baseline' }}>
          <div>
            <div style={{ fontFamily: FONT.heading, fontSize: 24, color: '#BA7517', fontWeight: 600 }}>{fmtEur(peDiario)}</div>
            <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut }}>Bruto/día para cubrir fijos</div>
          </div>
          <div>
            <div style={{ fontFamily: FONT.heading, fontSize: 24, color: T.pri, fontWeight: 600 }}>{fmtEur(data.bruto_diario_real)}</div>
            <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut }}>Bruto medio/día este mes</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {data.por_dia_semana.map(d => {
          const color = d.estado === 'cubre' ? '#1D9E75' : d.estado === 'ajustado' ? '#BA7517' : '#A32D2D'
          const label = d.estado === 'cubre' ? 'Cubre' : d.estado === 'ajustado' ? 'Ajustado' : 'Pierde'
          return (
            <div key={d.dow} style={{
              ...cardBase(T),
              borderLeft: `3px solid ${color}`,
              padding: '16px 18px',
            }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 12, color: T.sec, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 500 }}>
                {d.dia}
              </div>
              <div style={{ fontFamily: FONT.heading, fontSize: 22, color: T.pri, fontWeight: 600, marginTop: 6 }}>
                {fmtEur(d.bruto_medio)}
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 11, color, marginTop: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {label} · {d.delta >= 0 ? '+' : ''}{fmtEur(d.delta)}
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 10, color: T.mut, marginTop: 4 }}>
                {d.n_dias} días · 90d
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════
   TAB CONFIGURACIÓN
   ═══════════════════════════════════════════════════════════ */

interface CampoDef {
  key: string
  label: string
  tipo: 'eur' | 'pct'
}

const SECCIONES: { titulo: string; campos: CampoDef[] }[] = [
  {
    titulo: 'Fijos estructurales', campos: [
      { key: 'alquiler_local', label: 'Alquiler local', tipo: 'eur' },
      { key: 'irpf_alquiler', label: 'IRPF alquiler', tipo: 'eur' },
      { key: 'sueldo_ruben', label: 'Sueldo Rubén', tipo: 'eur' },
      { key: 'sueldo_emilio', label: 'Sueldo Emilio', tipo: 'eur' },
      { key: 'ss_autonomos', label: 'SS autónomos', tipo: 'eur' },
    ],
  },
  {
    titulo: 'Empleados', campos: [
      { key: 'sueldos_empleados', label: 'Sueldos empleados', tipo: 'eur' },
      { key: 'ss_empresa', label: 'SS empresa', tipo: 'eur' },
    ],
  },
  {
    titulo: 'Suministros', campos: [
      { key: 'luz', label: 'Luz', tipo: 'eur' },
      { key: 'agua', label: 'Agua', tipo: 'eur' },
      { key: 'gas', label: 'Gas', tipo: 'eur' },
      { key: 'telefono', label: 'Teléfono', tipo: 'eur' },
      { key: 'internet', label: 'Internet', tipo: 'eur' },
    ],
  },
  {
    titulo: 'Servicios', campos: [
      { key: 'gestoria', label: 'Gestoría', tipo: 'eur' },
      { key: 'hosting_software', label: 'Hosting / Software', tipo: 'eur' },
      { key: 'seguros', label: 'Seguros', tipo: 'eur' },
      { key: 'licencias', label: 'Licencias', tipo: 'eur' },
    ],
  },
  {
    titulo: 'Contratos externos', campos: [
      { key: 'think_paladar', label: 'Think Paladar', tipo: 'eur' },
      { key: 'otros_fijos', label: 'Otros fijos', tipo: 'eur' },
    ],
  },
  {
    titulo: 'Objetivos', campos: [
      { key: 'objetivo_beneficio_mensual', label: 'Beneficio neto mensual', tipo: 'eur' },
    ],
  },
  {
    titulo: 'Variables (% sobre bruto)', campos: [
      { key: 'food_cost_pct', label: 'Food cost', tipo: 'pct' },
      { key: 'packaging_pct', label: 'Packaging', tipo: 'pct' },
      { key: 'comision_uber_pct', label: 'Comisión Uber', tipo: 'pct' },
      { key: 'comision_glovo_pct', label: 'Comisión Glovo', tipo: 'pct' },
      { key: 'comision_je_pct', label: 'Comisión JustEat', tipo: 'pct' },
      { key: 'comision_web_pct', label: 'Comisión Web', tipo: 'pct' },
      { key: 'comision_directa_pct', label: 'Comisión Directa', tipo: 'pct' },
    ],
  },
]

function TabConfig({ T, data, onSaved }: { T: TokenSet; data: DashboardData; onSaved: () => void }) {
  const [valores, setValores] = useState<Record<string, number>>(() => {
    const out: Record<string, number> = {}
    SECCIONES.forEach(s => s.campos.forEach(c => {
      out[c.key] = Number(data.parametros[c.key] ?? 0)
    }))
    return out
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string>('')

  const totalFijos = useMemo(() => {
    return ['alquiler_local', 'irpf_alquiler', 'sueldo_ruben', 'sueldo_emilio', 'sueldos_empleados',
      'ss_empresa', 'ss_autonomos', 'gestoria', 'luz', 'agua', 'gas', 'telefono', 'internet',
      'hosting_software', 'seguros', 'licencias', 'think_paladar', 'otros_fijos']
      .reduce((a, k) => a + (valores[k] || 0), 0)
  }, [valores])

  async function guardar() {
    setSaving(true)
    setMsg('')
    try {
      const { supabase } = await import('@/lib/supabase')
      const { error } = await supabase
        .from('pe_parametros')
        .update(valores)
        .eq('id', data.parametros.id)
      if (error) { setMsg(`Error: ${error.message}`); return }
      setMsg('Guardado')
      onSaved()
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(''), 2500)
    }
  }

  return (
    <>
      <div style={{ ...cardBase(T), marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={labelStyle(T)}>Total fijos mes</div>
          <div style={{ fontFamily: FONT.heading, fontSize: 28, color: T.pri, fontWeight: 600, marginTop: 4 }}>
            {fmtEur(totalFijos)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {msg && <span style={{ fontFamily: FONT.body, fontSize: 13, color: msg.startsWith('Error') ? '#A32D2D' : '#1D9E75' }}>{msg}</span>}
          <button onClick={guardar} disabled={saving} style={{ ...btnPrimario, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {SECCIONES.map(sec => (
          <div key={sec.titulo} style={cardBase(T)}>
            <div style={labelStyle(T)}>{sec.titulo}</div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sec.campos.map(c => (
                <div key={c.key} style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 10, alignItems: 'center' }}>
                  <label style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec }}>{c.label}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      value={valores[c.key] ?? 0}
                      step={c.tipo === 'pct' ? 0.1 : 1}
                      onChange={e => setValores(prev => ({ ...prev, [c.key]: parseFloat(e.target.value) || 0 }))}
                      style={{
                        ...inputStyle(T),
                        width: '100%',
                        textAlign: 'right',
                        paddingRight: 28,
                      }}
                    />
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: FONT.body, fontSize: 12, color: T.mut, pointerEvents: 'none' }}>
                      {c.tipo === 'pct' ? '%' : '€'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
