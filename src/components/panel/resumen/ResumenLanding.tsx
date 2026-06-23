/**
 * ResumenLanding — capa de presentación "landing conversora" para la pestaña
 * Resumen del Panel Global. NO calcula nada: recibe los datos ya derivados por
 * TabResumen y las funciones de guardado, así toda la lógica sigue intacta.
 * Solo display + interacciones cableadas (objetivos, presupuestos, ratio,
 * días pico, top ventas). Sin datos inventados: todo viene por props.
 */
import { useState } from 'react'
import type { CanalStat, ObjetivosVentas, PagoProximoItem, TopVentaItem } from './types'
import type { GrupoGasto } from './ColGruposGasto'
import type { DiaPico } from './ColDiasPico'

const INK = '#140f08'
const CREMA = '#FCEFD6'
const ROSA = '#FF2E63'
const AMA = '#FFC400'
const VERDE = '#0FB86B'
const NAR = '#FF6A1A'
const AZUL = '#2D5BFF'
const OSW = "'Oswald', sans-serif"
const LEX = "'Lexend', sans-serif"

const display = (size: string, color = INK): React.CSSProperties => ({ fontFamily: OSW, fontWeight: 700, fontSize: size, lineHeight: 0.95, letterSpacing: '-0.5px', textTransform: 'uppercase', color })
const eyebrow = (bg: string, color = INK): React.CSSProperties => ({ display: 'inline-block', background: bg, color, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', padding: '4px 12px' })
const cta = (bg: string, color = '#fff'): React.CSSProperties => ({ display: 'inline-block', background: bg, color, border: `3px solid ${INK}`, boxShadow: `5px 5px 0 ${INK}`, fontFamily: OSW, fontWeight: 700, fontSize: 16, letterSpacing: '1px', textTransform: 'uppercase', padding: '12px 22px', cursor: 'pointer' })

const eur0 = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €'
const eur1 = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' €'
const pct0 = (n: number) => Math.round(Number.isFinite(n) ? n : 0) + ' %'
const delta = (v: number | null) => (v == null ? '—' : (v >= 0 ? '▲ ' : '▼ ') + Math.abs(v).toFixed(1) + '%')

interface GrupoData { gasto: number; presupuesto: number; pctSobreNetos: number }

interface Props {
  periodoLabel?: string
  datosDemo: boolean
  ventasPeriodo: number
  netoEstimado: number
  variacionVentas: number | null
  pedidosPeriodo: number
  tmBruto: number
  tmNeto: number
  variacionPedidos: number | null
  ventasSemana: number
  ventasMes: number
  ventasAno: number
  ebitda: number
  ebitdaPct: number
  primeCostPct: number
  resultadoLimpio: number
  ratioActual: number
  objetivoRatio: number
  objetivos: ObjetivosVentas
  canalStats: CanalStat[]
  grupos: Record<GrupoGasto, GrupoData>
  diasPico: DiaPico[]
  mediaDiariaPico: number
  saldo: { saldoHoy: number; cobros7d: number; pagos7d: number; cobros30d: number; pagos30d: number }
  pe: { peBruto: number; acumulado: number; pctProgreso: number; diaVerdeEstimado: { fecha: string; diaSemana: string } | null }
  provisiones: { totalAGuardar: number; provIVA: number; provIRPF: number; proximosPagos: PagoProximoItem[] }
  topItems: TopVentaItem[]
  topDatosDemo: boolean
  topTab: 'productos' | 'modificadores'
  onTopTab: (t: 'productos' | 'modificadores') => void
  onSaveObjetivoVenta: (tipo: 'semanal' | 'mensual' | 'anual', valor: number | null) => void
  onSaveObjetivoRatio: (valor: number | null) => void
  onSavePresupuestoGrupo: (grupo: GrupoGasto, valor: number | null) => void
  onFiltrarDiaSemana?: (idx: number) => void
}

function EditNum({ value, onSave, suffix = ' €' }: { value: number; onSave: (v: number | null) => void; suffix?: string }) {
  const [edit, setEdit] = useState(false)
  const [val, setVal] = useState(String(Math.round(value)))
  if (!edit) {
    return <button onClick={() => { setVal(String(Math.round(value))); setEdit(true) }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: OSW, fontWeight: 700, fontSize: 'inherit', color: 'inherit', textDecoration: 'underline dotted', padding: 0 }}>{value > 0 ? Math.round(value).toLocaleString('es-ES') + suffix : 'fijar'}</button>
  }
  const commit = () => { const n = parseFloat(val.replace(',', '.')); onSave(Number.isFinite(n) ? n : null); setEdit(false) }
  return <input autoFocus value={val} onChange={e => setVal(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEdit(false) }} style={{ width: 110, fontFamily: OSW, fontWeight: 700, fontSize: 18, border: `2px solid ${INK}`, padding: '2px 8px', background: '#fff' }} />
}

function Banda({ children, bg, color = '#fff' }: { children: React.ReactNode; bg: string; color?: string }) {
  return <div style={{ background: bg, color, padding: '34px 40px', borderBottom: `4px solid ${INK}` }}><div style={display('clamp(26px,3.6vw,44px)', color)}>{children}</div></div>
}

export default function ResumenLanding(p: Props) {
  const comisionPct = p.ventasPeriodo > 0 ? (1 - p.netoEstimado / p.ventasPeriodo) * 100 : 0
  const margenNetoPct = p.ventasPeriodo > 0 ? (p.netoEstimado / p.ventasPeriodo) * 100 : 0
  const web = p.canalStats.find(c => c.id === 'web')
  const webPct = web ? web.pct : 0
  const objetivosRows: Array<{ k: 'semanal' | 'mensual' | 'anual'; lbl: string; real: number; obj: number }> = [
    { k: 'semanal', lbl: 'Semana', real: p.ventasSemana, obj: p.objetivos.semanal },
    { k: 'mensual', lbl: 'Mes', real: p.ventasMes, obj: p.objetivos.mensual },
    { k: 'anual', lbl: 'Año', real: p.ventasAno, obj: p.objetivos.anual },
  ]
  const gruposRows: Array<{ k: GrupoGasto; lbl: string }> = [
    { k: 'producto', lbl: 'Producto' }, { k: 'equipo', lbl: 'Equipo' }, { k: 'local', lbl: 'Local' }, { k: 'controlables', lbl: 'Controlables' },
  ]
  const maxDia = Math.max(1, ...p.diasPico.map(d => d.valor))

  return (
    <div style={{ background: CREMA, fontFamily: LEX, color: INK, border: `4px solid ${INK}`, marginTop: 4 }}>
      {p.datosDemo && <div style={{ background: AMA, borderBottom: `4px solid ${INK}`, padding: '8px 40px', fontFamily: OSW, letterSpacing: '1px', fontSize: 13, textTransform: 'uppercase' }}>Datos demo · BD vacía o sin datos en este periodo</div>}

      {/* 1 · HERO */}
      <section style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', borderBottom: `4px solid ${INK}`, background: AMA }}>
        <div style={{ padding: '48px 40px 44px', borderRight: `4px solid ${INK}` }}>
          <span style={eyebrow('#fff')}>Comer bien. Aquí y ahora.</span>
          <div style={{ ...display('clamp(34px,4.8vw,60px)'), margin: '18px 0 16px', maxWidth: 620 }}>{p.pedidosPeriodo > 0 ? `Has servido ${p.pedidosPeriodo.toLocaleString('es-ES')} pedidos.` : 'Aún no hay pedidos en este periodo.'}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: OSW, fontSize: 13, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>Facturado · {p.periodoLabel ?? 'periodo'}</div>
              <div style={display('clamp(48px,8vw,100px)')}>{eur0(p.ventasPeriodo)}</div>
            </div>
            {p.variacionVentas != null && <div style={{ ...eyebrow(p.variacionVentas >= 0 ? VERDE : ROSA, '#fff'), fontSize: 18, padding: '8px 14px', marginBottom: 12 }}>{delta(p.variacionVentas)}</div>}
          </div>
          <div style={{ fontFamily: LEX, fontSize: 14, marginTop: 12, fontWeight: 600 }}>Neto estimado {eur0(p.netoEstimado)}</div>
        </div>
        <div style={{ background: CREMA, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', border: `3px solid ${INK}`, boxShadow: `8px 8px 0 ${INK}`, padding: '20px 22px', width: '100%', maxWidth: 280, transform: 'rotate(-3deg)' }}>
            <div style={{ ...display('15px'), borderBottom: `2px dashed ${INK}`, paddingBottom: 10 }}>· Resumen del periodo ·</div>
            {[['Pedidos', p.pedidosPeriodo.toLocaleString('es-ES')], ['Ticket bruto', eur1(p.tmBruto)], ['Ticket neto', eur1(p.tmNeto)], ['Resultado', eur0(p.ebitda)]].map(([l, v], i) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '9px 0', borderBottom: i < 3 ? `1px dotted ${INK}55` : 'none' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{l}</span>
                <span style={display('20px', i === 3 ? (p.ebitda >= 0 ? VERDE : ROSA) : INK)}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2 · PRUEBA SOCIAL */}
      <section style={{ background: INK, borderBottom: `4px solid ${INK}`, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
        {[[delta(p.variacionVentas), 'vs periodo anterior', p.variacionVentas != null && p.variacionVentas < 0 ? ROSA : VERDE], [eur1(p.tmBruto), 'ticket medio', AMA], [pct0(margenNetoPct), 'margen neto', ROSA], [eur0(p.ebitda), 'resultado', p.ebitda >= 0 ? VERDE : ROSA]].map(([v, l, c], i) => (
          <div key={i} style={{ padding: '24px 22px', borderRight: i < 3 ? '1px solid #3a342a' : 'none' }}>
            <div style={display('clamp(22px,3.2vw,38px)', c as string)}>{v}</div>
            <div style={{ fontFamily: OSW, letterSpacing: '1.5px', fontSize: 12, color: '#9b9384', textTransform: 'uppercase', marginTop: 6 }}>{l}</div>
          </div>
        ))}
      </section>

      {/* 3 · CANALES */}
      <section style={{ padding: '46px 40px', borderBottom: `4px solid ${INK}` }}>
        <span style={eyebrow(AMA)}>Por dónde entra el hambre</span>
        <div style={{ ...display('clamp(26px,3.4vw,40px)'), margin: '16px 0 24px' }}>Reparto de tu facturación por canal.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {p.canalStats.filter(c => c.bruto > 0 || c.pedidos > 0).map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', height: 50, border: `3px solid ${INK}`, background: '#fff' }}>
              <div style={{ width: `${Math.max(c.pct, 6)}%`, height: '100%', background: c.color, display: 'flex', alignItems: 'center', paddingLeft: 16, minWidth: 130 }}>
                <span style={display('17px', '#fff')}>{c.label}</span>
              </div>
              <span style={{ ...display('19px'), marginLeft: 16 }}>{Math.round(c.pct)}%</span>
              <span style={{ fontFamily: OSW, fontSize: 14, marginLeft: 'auto', paddingRight: 16, opacity: 0.6 }}>{eur0(c.bruto)} · {c.pedidos} ped.</span>
            </div>
          ))}
          {p.canalStats.every(c => c.bruto === 0 && c.pedidos === 0) && <div style={{ fontFamily: OSW, letterSpacing: '1px', opacity: 0.5 }}>Sin ventas registradas en el periodo.</div>}
        </div>
      </section>

      {/* 4 · GANCHO WEB */}
      <section style={{ background: ROSA, color: '#fff', padding: '50px 40px', borderBottom: `4px solid ${INK}` }}>
        <div style={{ ...display('clamp(30px,4.6vw,56px)', '#fff'), maxWidth: 940 }}>Las comisiones se llevan <span style={{ background: '#fff', color: ROSA, padding: '0 10px' }}>{pct0(comisionPct)}</span> de lo que vendes.</div>
        <div style={{ fontSize: 'clamp(16px,1.9vw,21px)', fontWeight: 600, marginTop: 18, maxWidth: 760 }}>Tu web trae el {pct0(webPct)}. Cada cliente que vuelve por la web es comida que cobras entera, sin comisión de plataforma.</div>
        <div style={{ marginTop: 24 }}><span style={cta(INK)}>Empuja tu web →</span></div>
      </section>

      {/* 5 · OBJETIVOS (editable) */}
      <section style={{ padding: '46px 40px', borderBottom: `4px solid ${INK}` }}>
        <span style={eyebrow(VERDE, '#fff')}>Tus objetivos</span>
        <div style={{ ...display('clamp(24px,3vw,36px)'), margin: '16px 0 22px' }}>Cómo vas frente a lo que te marcaste. Toca la cifra para cambiarla.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {objetivosRows.map(o => {
            const prog = o.obj > 0 ? Math.min(100, (o.real / o.obj) * 100) : 0
            return (
              <div key={o.k}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <span style={display('22px')}>{o.lbl} · {eur0(o.real)}</span>
                  <span style={{ fontFamily: LEX, fontSize: 14, fontWeight: 600 }}>Objetivo <EditNum value={o.obj} onSave={v => p.onSaveObjetivoVenta(o.k, v)} /> · {Math.round(prog)}%</span>
                </div>
                <div style={{ height: 16, border: `3px solid ${INK}`, background: '#fff' }}><div style={{ width: `${prog}%`, height: '100%', background: prog >= 100 ? VERDE : prog >= 60 ? AMA : NAR }} /></div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 6 · GASTOS (editable) */}
      <section style={{ padding: '46px 40px', borderBottom: `4px solid ${INK}` }}>
        <span style={eyebrow(NAR, '#fff')}>En qué se va el dinero</span>
        <div style={{ ...display('clamp(24px,3vw,36px)'), margin: '16px 0 22px' }}>Prime cost {pct0(p.primeCostPct)}. Presupuesto editable por grupo.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 0, border: `3px solid ${INK}` }}>
          {gruposRows.map((g, i) => {
            const d = p.grupos[g.k]
            return (
              <div key={g.k} style={{ padding: '18px 20px', borderRight: i % 2 === 0 ? `3px solid ${INK}` : 'none', borderBottom: i < 2 ? `3px solid ${INK}` : 'none', background: '#fff' }}>
                <div style={{ fontFamily: OSW, fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.6 }}>{g.lbl}</div>
                <div style={{ ...display('clamp(28px,4vw,40px)'), marginTop: 6 }}>{eur0(d.gasto)}</div>
                <div style={{ fontFamily: LEX, fontSize: 13, fontWeight: 600, marginTop: 6 }}>{Math.round(d.pctSobreNetos)}% s/ neto · pres. <EditNum value={d.presupuesto} onSave={v => p.onSavePresupuestoGrupo(g.k, v)} /></div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 7 · DÍAS PICO (click filtra) */}
      <section style={{ padding: '46px 40px', borderBottom: `4px solid ${INK}` }}>
        <span style={eyebrow(AZUL, '#fff')}>Días fuertes</span>
        <div style={{ ...display('clamp(24px,3vw,36px)'), margin: '16px 0 6px' }}>Media diaria {eur0(p.mediaDiariaPico)}.</div>
        <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 20 }}>Toca un día para filtrar el panel.</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 150 }}>
          {p.diasPico.map(d => (
            <button key={d.idx} onClick={() => p.onFiltrarDiaSemana?.(d.idx)} title={eur0(d.valor)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
              <div style={{ width: '100%', height: `${(d.valor / maxDia) * 110}px`, minHeight: 4, background: d.color, border: `3px solid ${INK}` }} />
              <span style={{ fontFamily: OSW, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase' }}>{d.nombre}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 8 · SALUD FINANCIERA (saldo · ratio · PE) */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: `4px solid ${INK}` }}>
        <div style={{ padding: '30px 28px', borderRight: `4px solid ${INK}`, background: '#fff' }}>
          <span style={eyebrow(CREMA)}>Saldo estimado</span>
          <div style={{ ...display('clamp(32px,4.4vw,48px)'), margin: '12px 0 14px' }}>{eur0(p.saldo.saldoHoy)}</div>
          <div style={{ fontFamily: LEX, fontSize: 13, fontWeight: 600, lineHeight: 1.9 }}>
            <div>Cobros 7 d · {eur0(p.saldo.cobros7d)}</div>
            <div>Pagos 7 d · {eur0(p.saldo.pagos7d)}</div>
            <div>Cobros 30 d · {eur0(p.saldo.cobros30d)}</div>
            <div>Pagos 30 d · {eur0(p.saldo.pagos30d)}</div>
          </div>
        </div>
        <div style={{ padding: '30px 28px', borderRight: `4px solid ${INK}`, background: '#fff' }}>
          <span style={eyebrow(CREMA)}>Ratio ingresos / gastos</span>
          <div style={{ ...display('clamp(32px,4.4vw,48px)', p.ratioActual >= p.objetivoRatio ? VERDE : NAR), margin: '12px 0 14px' }}>{(Number.isFinite(p.ratioActual) ? p.ratioActual : 0).toFixed(1)}×</div>
          <div style={{ fontFamily: LEX, fontSize: 14, fontWeight: 600 }}>Objetivo <EditNum value={p.objetivoRatio} onSave={p.onSaveObjetivoRatio} suffix="×" /></div>
          <div style={{ height: 12, border: `3px solid ${INK}`, background: CREMA, marginTop: 12 }}><div style={{ width: `${Math.min(100, p.objetivoRatio > 0 ? (p.ratioActual / p.objetivoRatio) * 100 : 0)}%`, height: '100%', background: p.ratioActual >= p.objetivoRatio ? VERDE : NAR }} /></div>
        </div>
        <div style={{ padding: '30px 28px', background: '#fff' }}>
          <span style={eyebrow(CREMA)}>Punto de equilibrio</span>
          <div style={{ ...display('clamp(32px,4.4vw,48px)'), margin: '12px 0 14px' }}>{Math.round(p.pe.pctProgreso)}%</div>
          <div style={{ height: 12, border: `3px solid ${INK}`, background: CREMA }}><div style={{ width: `${Math.min(100, p.pe.pctProgreso)}%`, height: '100%', background: p.pe.pctProgreso >= 100 ? VERDE : AMA }} /></div>
          <div style={{ fontFamily: LEX, fontSize: 13, fontWeight: 600, marginTop: 12 }}>{p.pe.diaVerdeEstimado ? `Día verde · ${p.pe.diaVerdeEstimado.diaSemana} ${p.pe.diaVerdeEstimado.fecha}` : `Umbral ${eur0(p.pe.peBruto)}`}</div>
        </div>
      </section>

      {/* 9 · TOP + PROVISIONES */}
      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', borderBottom: `4px solid ${INK}` }}>
        <div style={{ padding: '32px 36px', borderRight: `4px solid ${INK}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <span style={eyebrow(VERDE, '#fff')}>Lo que más sale</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['productos', 'modificadores'] as const).map(t => (
                <button key={t} onClick={() => p.onTopTab(t)} style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', padding: '5px 12px', cursor: 'pointer', border: `2px solid ${INK}`, background: p.topTab === t ? INK : '#fff', color: p.topTab === t ? '#fff' : INK }}>{t}</button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            {p.topItems.length === 0 || p.topDatosDemo
              ? <div style={{ fontFamily: OSW, letterSpacing: '1px', opacity: 0.5, padding: '20px 0' }}>Sin datos de {p.topTab} en el periodo todavía.</div>
              : p.topItems.slice(0, 6).map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderTop: i === 0 ? `3px solid ${INK}` : `2px solid ${INK}22` }}>
                  <span style={{ ...display('clamp(22px,3vw,32px)', i === 0 ? ROSA : INK), width: 48 }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ fontFamily: LEX, fontWeight: 600, fontSize: 15, flex: 1 }}>{t.nombre}</span>
                  <span style={display('clamp(18px,2.4vw,26px)')}>{eur0(t.total ?? 0)}</span>
                </div>
              ))}
          </div>
        </div>
        <div style={{ padding: '32px 36px', background: '#fff' }}>
          <span style={eyebrow(AMA)}>A guardar · impuestos</span>
          <div style={{ ...display('clamp(32px,4.4vw,48px)', NAR), margin: '12px 0 14px' }}>{eur0(p.provisiones.totalAGuardar)}</div>
          <div style={{ fontFamily: LEX, fontSize: 13, fontWeight: 600, lineHeight: 1.9 }}>
            <div>IVA · {eur0(p.provisiones.provIVA)}</div>
            <div>IRPF · {eur0(p.provisiones.provIRPF)}</div>
          </div>
          {p.provisiones.proximosPagos.length > 0 && <>
            <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.6, margin: '14px 0 8px' }}>Próximos pagos</div>
            {p.provisiones.proximosPagos.slice(0, 4).map((x, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LEX, fontSize: 13, fontWeight: 600, padding: '3px 0' }}><span>{x.concepto}</span><span>{eur0(x.importe)}</span></div>
            ))}
          </>}
        </div>
      </section>

      {/* 10 · CIERRE */}
      <section style={{ background: AMA, padding: '50px 40px', borderBottom: `4px solid ${INK}`, textAlign: 'center' }}>
        <span style={eyebrow('#fff')}>Al final del periodo</span>
        <div style={{ ...display('clamp(52px,10vw,116px)', p.ebitda >= 0 ? INK : ROSA), margin: '16px 0 8px' }}>{eur0(p.ebitda)}</div>
        <div style={display('clamp(18px,2.4vw,28px)')}>Margen {pct0(p.ebitdaPct)} · comer bien también deja margen.</div>
      </section>

      {/* 11 · FOOTER MARCA */}
      <section style={{ background: INK, color: CREMA, padding: '40px', textAlign: 'center' }}>
        <div style={display('clamp(34px,6vw,72px)', CREMA)}>Binagre es hogar.</div>
        <div style={{ fontFamily: OSW, letterSpacing: '6px', fontSize: 15, color: AMA, marginTop: 12, textTransform: 'uppercase' }}>Guisar · Comer bien. Aquí y ahora.</div>
      </section>
    </div>
  )
}
