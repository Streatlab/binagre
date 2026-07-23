/**
 * EstadosFinancieros — módulo financiero autocontenido: P&G, Balance y
 * Cash Flow, con vista mensual, comparativa año actual vs año anterior
 * y exportación a CSV en cliente. Estética Neobrutal Food-Pop
 * (referencia de estilo: src/pages/ops/ReclamacionReembolsos.tsx).
 */
import React, { useMemo, useState } from 'react'
import { useEstadosFinancieros, deltaPct, csvFromRows, descargarCsv, type PygAnual, type CashFlowAnual, type BalanceEstado, } from '@/lib/finanzas/useEstadosFinancieros'
import {
  OSW, LEX, INK, CREMA, CLARO, SHADOW, BORDER_CARD, GRANATE, AMA, VERDE, ROJO, NAR, AZUL, GRIS, eyebrow, BLANCO } from '@/styles/neobrutal'
import { fmtEur, fmtPct, fmtDate } from '@/lib/format'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'

type TabKey = 'pyg' | 'balance' | 'cashflow'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const fmt0 = (n: number) => fmtEur(n, { decimals: 0 })
const fmtPctSigned = (n: number | null) => (n == null ? '—' : (n > 0 ? '+' : '') + fmtPct(n, 1))
const deltaColor = (n: number | null) => (n == null ? GRIS : n > 0 ? VERDE : n < 0 ? ROJO : GRIS)

const thLabel: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, whiteSpace: 'nowrap' }
const thNum: React.CSSProperties = { padding: '10px 10px', textAlign: 'right', fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, whiteSpace: 'nowrap' }
const tdLabel: React.CSSProperties = { padding: '9px 12px', fontFamily: OSW, fontSize: 13, whiteSpace: 'nowrap', textAlign: 'left' }
const tdNum: React.CSSProperties = { padding: '9px 10px', fontFamily: OSW, fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

export function EstadosFinancieros({ embedded = false }: { embedded?: boolean } = {}) {
  const currentYear = new Date().getFullYear()
  const [año, setAño] = useState(currentYear)
  const [tab, setTab] = useState<TabKey>('pyg')
  const [comparar, setComparar] = useState(false)

  const { loading, error, pyg, pygAnterior, balance, cashFlow, cashFlowAnterior } = useEstadosFinancieros(año)

  const años = useMemo(() => [currentYear, currentYear - 1, currentYear - 2, currentYear - 3], [currentYear])

  const card: React.CSSProperties = { background: BLANCO, border: BORDER_CARD, boxShadow: SHADOW }
  const btnPrim: React.CSSProperties = {
    fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase',
    border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '8px 14px', cursor: 'pointer',
    background: GRANATE, color: BLANCO, whiteSpace: 'nowrap',
  }
  const selectNeo: React.CSSProperties = {
    background: BLANCO, border: `3px solid ${INK}`, color: INK, padding: '7px 12px',
    fontFamily: OSW, fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.5px', cursor: 'pointer', outline: 'none',
  }

  if (loading) {
    return <div style={{ padding: 40, color: GRIS, fontFamily: OSW, textTransform: 'uppercase', letterSpacing: '1px' }}>Cargando estados financieros…</div>
  }
  if (error) {
    return <div style={{ padding: 40, color: ROJO, fontFamily: LEX }}>Error: {error}</div>
  }
  if (!pyg || !balance || !cashFlow) {
    return <div style={{ padding: 40, color: GRIS, fontFamily: LEX }}>Sin datos.</div>
  }

  const handleExportPyg = () => {
    const totGasto = (fn: (m: PygAnual['meses'][number]) => number) => pyg.meses.reduce((s, m) => s + fn(m), 0)
    const headers = ['Concepto', ...MESES, 'Total']
    const rows: (string | number)[][] = [
      ['Ingresos', ...pyg.meses.map(m => m.ingresos.toFixed(2)), pyg.totalIngresos.toFixed(2)],
      ['Producto', ...pyg.meses.map(m => m.producto.toFixed(2)), totGasto(m => m.producto).toFixed(2)],
      ['Equipo', ...pyg.meses.map(m => m.equipo.toFixed(2)), totGasto(m => m.equipo).toFixed(2)],
      ['Controlables', ...pyg.meses.map(m => m.controlables.toFixed(2)), totGasto(m => m.controlables).toFixed(2)],
      ['Alquiler', ...pyg.meses.map(m => m.alquiler.toFixed(2)), totGasto(m => m.alquiler).toFixed(2)],
      ['Otros gastos', ...pyg.meses.map(m => m.otrosGastos.toFixed(2)), totGasto(m => m.otrosGastos).toFixed(2)],
      ['Total gastos', ...pyg.meses.map(m => m.totalGastos.toFixed(2)), pyg.totalGastos.toFixed(2)],
      ['Resultado del ejercicio', ...pyg.meses.map(m => m.resultado.toFixed(2)), pyg.resultadoEjercicio.toFixed(2)],
    ]
    descargarCsv(`pyg_${año}.csv`, csvFromRows(headers, rows))
  }

  const handleExportBalance = () => {
    const headers = ['Concepto', 'Importe']
    const rows: (string | number)[][] = [
      ['Fecha', fmtDate(balance.fecha)],
      ['Caja', balance.caja.toFixed(2)],
      ['Cobros pendientes de plataformas', balance.cobrosPendientesPlataformas.toFixed(2)],
      ['Activo total', balance.activo.toFixed(2)],
      ['Facturas de proveedor pendientes (pasivo operativo)', balance.pasivoFacturasPendientes.toFixed(2)],
      ['Pasivo total', balance.pasivo.toFixed(2)],
      ['Patrimonio neto (estimado, residual)', balance.patrimonioNeto.toFixed(2)],
    ]
    descargarCsv(`balance_${balance.fecha}.csv`, csvFromRows(headers, rows))
  }

  const handleExportCashFlow = () => {
    const tot = (fn: (m: CashFlowAnual['meses'][number]) => number) => cashFlow.meses.reduce((s, m) => s + fn(m), 0)
    const headers = ['Concepto', ...MESES, 'Total']
    const rows: (string | number)[][] = [
      ['Operativo', ...cashFlow.meses.map(m => m.operativo.toFixed(2)), tot(m => m.operativo).toFixed(2)],
      ['Inversión', ...cashFlow.meses.map(m => m.inversion.toFixed(2)), tot(m => m.inversion).toFixed(2)],
      ['Financiación', ...cashFlow.meses.map(m => m.financiacion.toFixed(2)), tot(m => m.financiacion).toFixed(2)],
      ['Flujo neto del mes', ...cashFlow.meses.map(m => m.flujoNeto.toFixed(2)), cashFlow.flujoNetoAcumulado.toFixed(2)],
    ]
    descargarCsv(`cashflow_${año}.csv`, csvFromRows(headers, rows))
  }

  const cajaNota = balance.cajaOrigen === 'extracto' ? `extracto real a ${fmtDate(balance.fecha)}`
    : balance.cajaOrigen === 'manual' ? `manual a ${fmtDate(balance.fecha)}`
    : 'sin saldo de banco disponible'

  return (
    <PantallaCantera embedded={embedded} style={{ fontFamily: LEX, color: INK }}>

      {/* Filtros propios arriba-derecha */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select style={selectNeo} value={año} onChange={e => setAño(Number(e.target.value))}>
          {años.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={() => setComparar(c => !c)} style={{ ...selectNeo, background: comparar ? AMA : BLANCO }}>
          {comparar ? '✓ ' : ''}Comparar con {año - 1}
        </button>
      </div>

      {/* 1 · Héroe del área Resultados (amarillo) */}
      <HeroCantera
        area="eeff"
        periodo={String(año)}
        titular={pyg.resultadoEjercicio >= 0 ? 'El ejercicio cierra en positivo: los ingresos cubren los gastos.' : 'El ejercicio va en negativo: los gastos superan a los ingresos.'}
        etiquetaDato="Resultado del ejercicio"
        cifra={fmt0(pyg.resultadoEjercicio)}
        resumen={<>Ingresos <b>{fmt0(pyg.totalIngresos)}</b> · Gastos <b>{fmt0(pyg.totalGastos)}</b> · Caja actual <b>{fmt0(balance.caja)}</b> ({cajaNota})</>}
        atencion={[
          `Caja actual ${fmt0(balance.caja)}`,
          `Flujo neto acumulado ${fmt0(cashFlow.flujoNetoAcumulado)}`,
          `Ingresos ${fmt0(pyg.totalIngresos)}`,
          `Gastos ${fmt0(pyg.totalGastos)}`,
        ]}
      />

      {/* 2 · Plancha comparativa (celdas sólidas pegadas) */}
      <div>
        <SeccionLabel bg={AMA} color={INK}>Resultado · caja · flujo {año}</SeccionLabel>
        <Plancha>
          <PlanchaCelda bg={pyg.resultadoEjercicio >= 0 ? VERDE : ROJO} first>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 6 }}>Resultado del ejercicio {año}</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 28, lineHeight: 1 }}>{fmt0(pyg.resultadoEjercicio)}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 6 }}>Ingresos {fmt0(pyg.totalIngresos)} · Gastos {fmt0(pyg.totalGastos)}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={AZUL}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 6 }}>Caja actual</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 28, lineHeight: 1 }}>{fmt0(balance.caja)}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 6 }}>{cajaNota}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={INK} color={AMA}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 6, color: AMA }}>Flujo neto acumulado {año}</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 28, lineHeight: 1, color: AMA }}>{fmt0(cashFlow.flujoNetoAcumulado)}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 6, color: BLANCO }}>real, ya ejecutado (sin inversión)</div>
          </PlanchaCelda>
        </Plancha>
      </div>

      {/* 3 · Frase potente (color por significado, distinto del héroe amarillo) */}
      {pyg.resultadoEjercicio >= 0
        ? <FrasePotente significado="logro">El ejercicio cierra en positivo: cada euro de resultado es margen ya asegurado.</FrasePotente>
        : <FrasePotente significado="peligro">El ejercicio va en negativo: revisa gastos antes de que se coma la caja.</FrasePotente>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {([
          ['pyg', 'P&G'],
          ['balance', 'Balance'],
          ['cashflow', 'Cash Flow'],
        ] as [TabKey, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '9px 18px', border: `3px solid ${INK}`,
            background: tab === k ? GRANATE : BLANCO, color: tab === k ? BLANCO : INK,
            boxShadow: tab === k ? SHADOW : 'none',
            fontFamily: OSW, fontSize: 13, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
          }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'pyg' && (
        <PygTabla pyg={pyg} pygAnterior={pygAnterior} comparar={comparar} btnPrim={btnPrim} onExport={handleExportPyg} />
      )}
      {tab === 'balance' && (
        <BalanceTabla balance={balance} btnPrim={btnPrim} onExport={handleExportBalance} />
      )}
      {tab === 'cashflow' && (
        <CashFlowTabla cashFlow={cashFlow} cashFlowAnterior={cashFlowAnterior} comparar={comparar} btnPrim={btnPrim} onExport={handleExportCashFlow} />
      )}
    </PantallaCantera>
  )
}

function PygTabla({ pyg, pygAnterior, comparar, btnPrim, onExport }: {
  pyg: PygAnual; pygAnterior: PygAnual | null; comparar: boolean;
  btnPrim: React.CSSProperties; onExport: () => void;
}) {
  type Fila = { label: string; color?: string; bold?: boolean; get: (m: PygAnual['meses'][number]) => number; total: number; totalAnterior: number }

  const totalAnt = (fn: (m: PygAnual['meses'][number]) => number) => pygAnterior ? pygAnterior.meses.reduce((s, m) => s + fn(m), 0) : 0
  const totalAct = (fn: (m: PygAnual['meses'][number]) => number) => pyg.meses.reduce((s, m) => s + fn(m), 0)

  const filas: Fila[] = [
    { label: 'Ingresos', color: VERDE, get: m => m.ingresos, total: pyg.totalIngresos, totalAnterior: totalAnt(m => m.ingresos) },
    { label: 'Producto', get: m => m.producto, total: totalAct(m => m.producto), totalAnterior: totalAnt(m => m.producto) },
    { label: 'Equipo', get: m => m.equipo, total: totalAct(m => m.equipo), totalAnterior: totalAnt(m => m.equipo) },
    { label: 'Controlables', get: m => m.controlables, total: totalAct(m => m.controlables), totalAnterior: totalAnt(m => m.controlables) },
    { label: 'Alquiler', get: m => m.alquiler, total: totalAct(m => m.alquiler), totalAnterior: totalAnt(m => m.alquiler) },
    { label: 'Otros gastos', get: m => m.otrosGastos, total: totalAct(m => m.otrosGastos), totalAnterior: totalAnt(m => m.otrosGastos) },
    { label: 'Total gastos', color: ROJO, bold: true, get: m => m.totalGastos, total: pyg.totalGastos, totalAnterior: totalAnt(m => m.totalGastos) },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={onExport} style={btnPrim}>Exportar CSV</button>
      </div>
      <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
          <thead>
            <tr style={{ background: INK }}>
              <th style={thLabel}>Concepto</th>
              {MESES.map(m => <th key={m} style={thNum}>{m}</th>)}
              <th style={thNum}>Total</th>
              {comparar && <th style={thNum}>Δ% vs {pyg.año - 1}</th>}
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <React.Fragment key={f.label}>
                <tr style={{ borderBottom: `2px solid ${INK}`, borderLeft: `10px solid ${f.color || CLARO}` }}>
                  <td style={{ ...tdLabel, fontWeight: f.bold ? 700 : 600 }}>{f.label}</td>
                  {pyg.meses.map(m => <td key={m.mes} style={{ ...tdNum, color: f.color || INK, fontWeight: f.bold ? 700 : 600 }}>{fmt0(f.get(m))}</td>)}
                  <td style={{ ...tdNum, color: f.color || INK, fontWeight: 700 }}>{fmt0(f.total)}</td>
                  {comparar && (
                    <td style={{ ...tdNum, color: deltaColor(deltaPct(f.total, f.totalAnterior)), fontWeight: 700 }}>
                      {fmtPctSigned(deltaPct(f.total, f.totalAnterior))}
                    </td>
                  )}
                </tr>
                {comparar && (
                  <tr style={{ borderBottom: `2px solid ${INK}`, background: CLARO }}>
                    <td style={{ ...tdLabel, fontSize: 11, color: GRIS, fontWeight: 400 }}>{f.label} · {pyg.año - 1}</td>
                    {(pygAnterior?.meses || []).map(m => <td key={m.mes} style={{ ...tdNum, fontSize: 12, color: GRIS }}>{fmt0(f.get(m))}</td>)}
                    <td style={{ ...tdNum, fontSize: 12, color: GRIS, fontWeight: 600 }}>{fmt0(f.totalAnterior)}</td>
                    <td style={tdNum} />
                  </tr>
                )}
              </React.Fragment>
            ))}
            <tr style={{ borderTop: `3px solid ${INK}`, borderLeft: `10px solid ${pyg.resultadoEjercicio >= 0 ? VERDE : ROJO}` }}>
              <td style={{ ...tdLabel, fontWeight: 700, fontSize: 14, textTransform: 'uppercase' }}>Resultado del ejercicio</td>
              {pyg.meses.map(m => <td key={m.mes} style={{ ...tdNum, fontWeight: 700, color: m.resultado >= 0 ? VERDE : ROJO }}>{fmt0(m.resultado)}</td>)}
              <td style={{ ...tdNum, fontWeight: 700, fontSize: 15, color: pyg.resultadoEjercicio >= 0 ? VERDE : ROJO }}>{fmt0(pyg.resultadoEjercicio)}</td>
              {comparar && (
                <td style={{ ...tdNum, fontWeight: 700, color: deltaColor(deltaPct(pyg.resultadoEjercicio, pygAnterior?.resultadoEjercicio || 0)) }}>
                  {fmtPctSigned(deltaPct(pyg.resultadoEjercicio, pygAnterior?.resultadoEjercicio || 0))}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </Papel>
    </div>
  )
}

function BalanceTabla({ balance, btnPrim, onExport }: {
  balance: BalanceEstado; btnPrim: React.CSSProperties; onExport: () => void;
}) {
  const filas: { label: string; value: number; color?: string; bold?: boolean; nota?: string }[] = [
    { label: 'Caja', value: balance.caja, color: AZUL },
    { label: 'Cobros pendientes de plataformas', value: balance.cobrosPendientesPlataformas, color: AZUL },
    { label: 'ACTIVO TOTAL', value: balance.activo, color: VERDE, bold: true },
    { label: 'Facturas de proveedor vivas sin conciliar', value: balance.pasivoFacturasPendientes, color: NAR, nota: 'últimos 60 días; no incluye saldo vivo de préstamos: esa tabla no existe en BD' },
    { label: 'PASIVO TOTAL', value: balance.pasivo, color: ROJO, bold: true },
    { label: 'PATRIMONIO NETO (estimado, residual)', value: balance.patrimonioNeto, color: balance.patrimonioNeto >= 0 ? VERDE : ROJO, bold: true },
  ]
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>
          Foto a fecha {fmtDate(balance.fecha)}{balance.cajaOrigen === 'sin_datos' ? ' · sin saldo de banco disponible (caja = 0)' : ''}
        </span>
        <button onClick={onExport} style={btnPrim}>Exportar CSV</button>
      </div>
      <Papel ceja={AZUL} pad="0" style={{ maxWidth: 640 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, fontFamily: LEX }}>
          <tbody>
            {filas.map(f => (
              <tr key={f.label} style={{ borderBottom: `2px solid ${INK}`, borderLeft: `10px solid ${f.color || CLARO}` }}>
                <td style={{ padding: '10px 14px', fontFamily: OSW, fontWeight: f.bold ? 700 : 600, textTransform: f.bold ? 'uppercase' : 'none', letterSpacing: f.bold ? '1px' : 'normal', fontSize: 13 }}>
                  {f.label}
                  {f.nota && <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS, marginTop: 2, textTransform: 'none', fontWeight: 400 }}>{f.nota}</div>}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: OSW, fontWeight: f.bold ? 700 : 600, fontSize: f.bold ? 16 : 14, color: f.color || INK }}>{fmt0(f.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Papel>
    </div>
  )
}

function CashFlowTabla({ cashFlow, cashFlowAnterior, comparar, btnPrim, onExport }: {
  cashFlow: CashFlowAnual; cashFlowAnterior: CashFlowAnual | null; comparar: boolean;
  btnPrim: React.CSSProperties; onExport: () => void;
}) {
  type Fila = { label: string; color?: string; get: (m: CashFlowAnual['meses'][number]) => number; total: number; totalAnterior: number; nota?: string }

  const totalAnt = (fn: (m: CashFlowAnual['meses'][number]) => number) => cashFlowAnterior ? cashFlowAnterior.meses.reduce((s, m) => s + fn(m), 0) : 0
  const totalAct = (fn: (m: CashFlowAnual['meses'][number]) => number) => cashFlow.meses.reduce((s, m) => s + fn(m), 0)

  const filas: Fila[] = [
    { label: 'Operativo', color: AZUL, get: m => m.operativo, total: totalAct(m => m.operativo), totalAnterior: totalAnt(m => m.operativo) },
    { label: 'Inversión', color: GRIS, get: m => m.inversion, total: 0, totalAnterior: 0, nota: 'sin categoría CAPEX distinguible en la taxonomía actual — columna en 0' },
    { label: 'Financiación', color: NAR, get: m => m.financiacion, total: totalAct(m => m.financiacion), totalAnterior: totalAnt(m => m.financiacion) },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={onExport} style={btnPrim}>Exportar CSV</button>
      </div>
      <Papel ceja={NAR} pad="0" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
          <thead>
            <tr style={{ background: INK }}>
              <th style={thLabel}>Concepto</th>
              {MESES.map(m => <th key={m} style={thNum}>{m}</th>)}
              <th style={thNum}>Total</th>
              {comparar && <th style={thNum}>Δ% vs {cashFlow.año - 1}</th>}
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <React.Fragment key={f.label}>
                <tr style={{ borderBottom: `2px solid ${INK}`, borderLeft: `10px solid ${f.color || CLARO}` }}>
                  <td style={{ ...tdLabel, fontWeight: 600 }}>
                    {f.label}
                    {f.nota && <div style={{ fontFamily: LEX, fontSize: 10, color: GRIS, fontWeight: 400, whiteSpace: 'normal' }}>{f.nota}</div>}
                  </td>
                  {cashFlow.meses.map(m => <td key={m.mes} style={{ ...tdNum, color: f.color || INK }}>{fmt0(f.get(m))}</td>)}
                  <td style={{ ...tdNum, color: f.color || INK, fontWeight: 700 }}>{fmt0(f.total)}</td>
                  {comparar && (
                    <td style={{ ...tdNum, color: deltaColor(deltaPct(f.total, f.totalAnterior)), fontWeight: 700 }}>
                      {fmtPctSigned(deltaPct(f.total, f.totalAnterior))}
                    </td>
                  )}
                </tr>
                {comparar && (
                  <tr style={{ borderBottom: `2px solid ${INK}`, background: CLARO }}>
                    <td style={{ ...tdLabel, fontSize: 11, color: GRIS, fontWeight: 400 }}>{f.label} · {cashFlow.año - 1}</td>
                    {(cashFlowAnterior?.meses || []).map(m => <td key={m.mes} style={{ ...tdNum, fontSize: 12, color: GRIS }}>{fmt0(f.get(m))}</td>)}
                    <td style={{ ...tdNum, fontSize: 12, color: GRIS, fontWeight: 600 }}>{fmt0(f.totalAnterior)}</td>
                    <td style={tdNum} />
                  </tr>
                )}
              </React.Fragment>
            ))}
            <tr style={{ borderTop: `3px solid ${INK}`, borderLeft: `10px solid ${cashFlow.flujoNetoAcumulado >= 0 ? VERDE : ROJO}` }}>
              <td style={{ ...tdLabel, fontWeight: 700, fontSize: 14, textTransform: 'uppercase' }}>Flujo neto del mes</td>
              {cashFlow.meses.map(m => <td key={m.mes} style={{ ...tdNum, fontWeight: 700, color: m.flujoNeto >= 0 ? VERDE : ROJO }}>{fmt0(m.flujoNeto)}</td>)}
              <td style={{ ...tdNum, fontWeight: 700, fontSize: 15, color: cashFlow.flujoNetoAcumulado >= 0 ? VERDE : ROJO }}>{fmt0(cashFlow.flujoNetoAcumulado)}</td>
              {comparar && (
                <td style={{ ...tdNum, fontWeight: 700, color: deltaColor(deltaPct(cashFlow.flujoNetoAcumulado, cashFlowAnterior?.flujoNetoAcumulado || 0)) }}>
                  {fmtPctSigned(deltaPct(cashFlow.flujoNetoAcumulado, cashFlowAnterior?.flujoNetoAcumulado || 0))}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </Papel>
    </div>
  )
}

export default EstadosFinancieros
