import { useState, useMemo } from 'react'
import { useRunning, sumMeses, sumCatMeses, fmtN, fmtPct } from '@/hooks/useRunning'
import { useTheme, pageTitleStyle, FONT } from '@/styles/tokens'
import { useTitular } from '@/contexts/TitularContext'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const Q_MESES: Record<number, number[]> = { 1:[1,2,3], 2:[4,5,6], 3:[7,8,9], 4:[10,11,12] }
const ALL_MESES = [1,2,3,4,5,6,7,8,9,10,11,12]

const ING_CATS: {cat:string;label:string}[] = [
  {cat:'1.1.1',label:'Uber Eats (neto)'},
  {cat:'1.1.2',label:'Glovo (neto)'},
  {cat:'1.1.3',label:'Just Eat (neto)'},
  {cat:'1.1.4',label:'Tienda Online'},
  {cat:'1.1.5',label:'Venta Directa'},
]

const BENCH_MAP: Record<string,string> = {
  '2.1':'PRODUCTO','2.2':'RRHH','2.3':'ALQUILER',
  '2.41':'MARKETING','2.42':'INTERNET_VENTAS','2.43':'ADMIN_GENERALES','2.44':'SUMINISTROS'
}

export default function Running() {
  const { T } = useTheme()
  const { filtro } = useTitular()
  const [año, setAño] = useState(2026)
  const [buscar, setBuscar] = useState('')
  const [qOpen, setQOpen] = useState<Record<number,boolean>>(() => {
    const mesActual = new Date().getMonth() + 1
    const qActual = Math.ceil(mesActual / 3)
    return { 1: true, 2: qActual >= 2, 3: qActual >= 3, 4: qActual >= 4 }
  })

  const titularId = filtro === 'unificado' ? null : filtro
  const { ingresos, gastos, brutos, categorias, benchmarks, loading } = useRunning(año, titularId)

  const d = useMemo(() => {
    const ingTotal = (meses: number[]) => ING_CATS.reduce((s, c) => s + sumMeses(ingresos[c.cat] || {}, meses), 0)
    const gasProd = (m: number[]) => sumCatMeses(gastos, '2.1', m)
    const gasEquipo = (m: number[]) => sumCatMeses(gastos, '2.2', m)
    const gasAlq = (m: number[]) => sumCatMeses(gastos, '2.3', m)
    const gasCtrl = (m: number[]) => sumCatMeses(gastos, '2.4', m)
    const gasTotal = (m: number[]) => gasProd(m) + gasEquipo(m) + gasAlq(m) + gasCtrl(m)
    const resultado = (m: number[]) => ingTotal(m) - gasTotal(m)
    const primeCost = (m: number[]) => {
      const ing = ingTotal(m)
      if (!ing) return 0
      return (gasProd(m) + gasEquipo(m)) / ing * 100
    }
    return { ingTotal, gasProd, gasEquipo, gasAlq, gasCtrl, gasTotal, resultado, primeCost }
  }, [ingresos, gastos])

  const getBenchmark = (grupo: string) => {
    const key = BENCH_MAP[grupo]
    if (!key) return null
    return benchmarks.find(b => b.categoria === key) || null
  }

  const semaforoColor = (pct: number, bench: {pct_min:number;pct_max:number}|null): string => {
    if (!bench) return T.mut
    if (pct <= bench.pct_max) return '#1D9E75'
    if (pct <= bench.pct_max * 1.2) return '#f5a623'
    return '#B01D23'
  }

  const toggleQ = (q: number) => setQOpen(p => ({ ...p, [q]: !p[q] }))

  type Col = { label: string; meses: number[]; isQ?: boolean; qNum?: number; isYear?: boolean; hidden?: boolean }
  const cols: Col[] = useMemo(() => {
    const c: Col[] = []
    for (let q = 1; q <= 4; q++) {
      const ms = Q_MESES[q]
      const open = qOpen[q]
      ms.forEach(m => c.push({ label: MESES[m-1], meses: [m], hidden: !open }))
      c.push({ label: `${q}T`, meses: ms, isQ: true, qNum: q })
    }
    c.push({ label: 'Año', meses: ALL_MESES, isYear: true })
    return c
  }, [qOpen])

  const Row = ({ label, fn, indent, style, sign, pct, muted, semaforo }: {
    label: string; fn: (m:number[])=>number; indent?: number; style?: 'header'|'group'|'total'|'result'|'prime'|'info'|'sub'
    sign?: boolean; pct?: boolean; muted?: boolean; semaforo?: {grupo:string}
  }) => {
    if (buscar.length >= 2 && !['header','group','total','result','prime'].includes(style||'')) {
      if (!label.toLowerCase().includes(buscar.toLowerCase())) return null
    }

    const rowStyle: React.CSSProperties = {}
    const tdStyle: React.CSSProperties = { paddingLeft: indent ? indent * 14 + 6 : 6 }

    if (style === 'header') {
      Object.assign(rowStyle, { background: T.group })
      Object.assign(tdStyle, { fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: T.mut, fontWeight: 500, padding: '10px 6px 5px', borderBottom: `1px solid ${T.brd}` })
    }
    if (style === 'group') {
      Object.assign(rowStyle, { background: 'rgba(176,29,35,0.035)' })
      Object.assign(tdStyle, { fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase' as const, color: '#B01D23', fontWeight: 600 })
    }
    if (style === 'total') {
      Object.assign(rowStyle, { background: 'rgba(176,29,35,0.07)', borderTop: `1.5px solid ${T.brd}` })
      Object.assign(tdStyle, { fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase' as const, color: '#B01D23', fontWeight: 700 })
    }
    if (style === 'result') {
      Object.assign(rowStyle, { background: 'rgba(29,158,117,0.06)', borderTop: `2px solid ${T.brd}` })
      Object.assign(tdStyle, { fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase' as const, fontWeight: 700 })
    }
    if (style === 'prime') {
      Object.assign(rowStyle, { background: 'rgba(176,29,35,0.05)' })
      Object.assign(tdStyle, { fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase' as const, fontWeight: 700 })
    }
    if (style === 'info') Object.assign(tdStyle, { fontStyle: 'italic', color: T.mut })
    if (style === 'sub' || muted) Object.assign(tdStyle, { color: T.mut, fontSize: 11.5 })

    const semaforoEl = semaforo ? (() => {
      const bench = getBenchmark(semaforo.grupo)
      const yearIng = d.ingTotal(ALL_MESES)
      const yearVal = fn(ALL_MESES)
      const yearPct = yearIng ? yearVal / yearIng * 100 : 0
      const color = semaforoColor(yearPct, bench)
      return <span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:color,marginRight:6,verticalAlign:'middle'}} />
    })() : null

    return (
      <tr style={rowStyle}>
        <td style={{...tdStyle, position:'sticky', left:0, background: rowStyle.background || T.card, zIndex:1}}>
          {semaforoEl}{label}
        </td>
        {cols.map((c, i) => {
          if (c.hidden) return null
          const val = fn(c.meses)
          const isQ = c.isQ || c.isYear
          const tdS: React.CSSProperties = {
            fontWeight: isQ ? 600 : undefined,
            background: c.isYear ? 'rgba(176,29,35,0.04)' : c.isQ ? 'rgba(176,29,35,0.02)' : undefined,
            color: sign ? (val > 0 ? '#1D9E75' : val < 0 ? '#B01D23' : T.mut) : muted ? T.mut : undefined,
          }
          if (pct) return <td key={i} style={tdS}>{val ? `${val.toFixed(1)}%` : '—'}</td>
          const prefix = sign && val > 0 ? '+' : ''
          return <td key={i} style={tdS}>{val ? `${prefix}${fmtN(val)}` : '—'}</td>
        })}
      </tr>
    )
  }

  const Sep = () => <tr><td colSpan={cols.filter(c=>!c.hidden).length + 1} style={{height:6,border:'none',background:T.bg}} /></tr>

  const PctRow = ({ label, fn }: { label: string; fn: (m:number[])=>number }) => (
    <Row label={label} fn={(m) => { const ing = d.ingTotal(m); return ing ? fn(m)/ing*100 : 0 }} style="sub" pct muted />
  )

  if (loading) return (
    <div style={{padding:28}}>
      <h1 style={pageTitleStyle(T)}>Running {año}</h1>
      <p style={{color:T.mut,fontSize:13}}>Cargando datos...</p>
    </div>
  )

  const topProvs = (prefix: string) => {
    const cats = categorias.filter(c => c.id.startsWith(prefix) && c.nivel === 3)
    return cats.filter(c => ALL_MESES.some(m => (gastos[c.id]?.[m] || 0) > 0))
      .sort((a,b) => sumMeses(gastos[b.id]||{}, ALL_MESES) - sumMeses(gastos[a.id]||{}, ALL_MESES))
  }

  return (
    <div style={{padding:28}}>
      <h1 style={pageTitleStyle(T)}>Running {año}</h1>
      <p style={{color:T.mut,fontSize:12,marginBottom:16}}>Datos reales de Conciliación + Facturación · Año completo</p>

      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        {[2026,2025].map(a => (
          <button key={a} onClick={()=>setAño(a)} style={{
            padding:'5px 12px',borderRadius:6,border:`0.5px solid ${año===a?'#FF4757':T.brd}`,
            background:año===a?'#FF4757':'transparent',color:año===a?'#fff':T.sec,
            fontFamily:FONT.body,fontSize:12,cursor:'pointer'
          }}>{a}</button>
        ))}
        <div style={{flex:1}} />
        <input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="🔍 Buscar proveedor..."
          style={{padding:'5px 10px',borderRadius:6,border:`0.5px solid ${T.brd}`,background:T.card,color:T.pri,fontFamily:FONT.body,fontSize:12,width:180,outline:'none'}} />
      </div>

      <div style={{background:T.card,border:`0.5px solid ${T.brd}`,borderRadius:10,overflow:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'auto',minWidth:1200}}>
          <thead>
            <tr>
              <th style={{fontFamily:FONT.heading,fontSize:10,color:T.mut,textTransform:'uppercase',letterSpacing:'1.5px',padding:'8px 6px',textAlign:'left',whiteSpace:'nowrap',borderBottom:`0.5px solid ${T.brd}`,fontWeight:400,background:T.group,position:'sticky',left:0,zIndex:3,minWidth:220}}>
                Running {año}
              </th>
              {cols.map((c, i) => {
                if (c.hidden) return null
                const isQ = c.isQ; const isYear = c.isYear
                return (
                  <th key={i} onClick={isQ && c.qNum ? ()=>toggleQ(c.qNum!) : undefined} style={{
                    fontFamily:FONT.heading,fontSize:10,color: isQ||isYear ? '#B01D23' : T.mut,
                    textTransform:'uppercase',letterSpacing:'1.5px',padding:'8px 6px',textAlign:'right',
                    whiteSpace:'nowrap',borderBottom:`0.5px solid ${T.brd}`,fontWeight: isQ||isYear ? 600 : 400,
                    background: isYear ? 'rgba(176,29,35,0.06)' : isQ ? 'rgba(176,29,35,0.04)' : T.group,
                    cursor: isQ ? 'pointer' : undefined, userSelect: isQ ? 'none' : undefined,
                    position:'sticky',top:0,zIndex:2
                  }}>
                    {isQ && c.qNum ? `${qOpen[c.qNum]?'▾':'▸'} ${c.label}` : c.label}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody style={{fontSize:12}}>
            <Row label="Resumen" fn={()=>0} style="header" />
            <Row label="Ingresos netos" fn={d.ingTotal} style="group" />
            <Row label="2.1 Producto" fn={d.gasProd} style="group" semaforo={{grupo:'2.1'}} />
            <Row label="2.2 Equipo" fn={d.gasEquipo} style="group" semaforo={{grupo:'2.2'}} />
            <Row label="2.3 Alquiler" fn={d.gasAlq} style="group" semaforo={{grupo:'2.3'}} />
            <Row label="2.4 Controlables" fn={d.gasCtrl} style="group" semaforo={{grupo:'2.4'}} />
            <Row label="Total gastos" fn={d.gasTotal} style="total" />
            <Row label="Resultado" fn={d.resultado} style="result" sign />
            <Row label="Prime Cost (obj <60%)" fn={d.primeCost} style="prime" pct />
            <Sep />
            <Row label="1. Ingresos" fn={()=>0} style="header" />
            {ING_CATS.map(c => <Row key={c.cat} label={c.label} fn={(m) => sumMeses(ingresos[c.cat]||{}, m)} indent={1} muted />)}
            <Row label="1.01 Ingresos netos" fn={d.ingTotal} style="group" />
            <Row label="1.02 Facturación bruta" fn={(m) => m.reduce((s,mes) => s + (brutos[mes]?.total||0), 0)} style="info" />
            <Row label="Pedidos" fn={(m) => m.reduce((s,mes) => s + (brutos[mes]?.pedidos||0), 0)} indent={1} muted />
            <Row label="Ticket medio" fn={(m) => { const b = m.reduce((s,mes) => s + (brutos[mes]?.total||0), 0); const p = m.reduce((s,mes) => s + (brutos[mes]?.pedidos||0), 0); return p ? Math.round(b/p*100)/100 : 0 }} indent={1} muted />
            <Sep />
            <Row label="2.1 Producto (25-30%)" fn={()=>0} style="header" />
            <Row label="2.11 Alimentos y bebidas" fn={(m) => sumCatMeses(gastos,'2.11',m)} indent={1} />
            {topProvs('2.11.').slice(0, 5).map(c => <Row key={c.id} label={c.nombre} fn={(m) => sumMeses(gastos[c.id]||{},m)} indent={2} muted />)}
            <Row label="2.12 Packaging" fn={(m) => sumCatMeses(gastos,'2.12',m)} indent={1} />
            <Row label="2.13 Entregas" fn={(m) => sumCatMeses(gastos,'2.13',m)} indent={1} />
            <Row label="2.1 Total Producto" fn={d.gasProd} style="group" semaforo={{grupo:'2.1'}} />
            <PctRow label="% s/Ingresos" fn={d.gasProd} />
            <Sep />
            <Row label="2.2 Equipo (30-35%)" fn={()=>0} style="header" />
            <Row label="2.21 Fijos Equipo" fn={(m) => sumCatMeses(gastos,'2.21',m)} indent={1} />
            {topProvs('2.21.').slice(0, 5).map(c => <Row key={c.id} label={c.nombre} fn={(m) => sumMeses(gastos[c.id]||{},m)} indent={2} muted />)}
            <Row label="2.22 Variables Equipo" fn={(m) => sumCatMeses(gastos,'2.22',m)} indent={1} />
            <Row label="2.2 Total Equipo" fn={d.gasEquipo} style="group" semaforo={{grupo:'2.2'}} />
            <PctRow label="% s/Ingresos" fn={d.gasEquipo} />
            <Sep />
            <Row label="2.3 Alquiler (5-8%)" fn={()=>0} style="header" />
            <Row label="2.31 Alquiler e inmueble" fn={(m) => sumCatMeses(gastos,'2.31',m)} indent={1} />
            {topProvs('2.31.').slice(0, 4).map(c => <Row key={c.id} label={c.nombre} fn={(m) => sumMeses(gastos[c.id]||{},m)} indent={2} muted />)}
            <Row label="2.3 Total Alquiler" fn={d.gasAlq} style="group" semaforo={{grupo:'2.3'}} />
            <Sep />
            <Row label="2.4 Controlables (15-18%)" fn={()=>0} style="header" />
            <Row label="2.41 Marketing" fn={(m) => sumCatMeses(gastos,'2.41',m)} indent={1} />
            <Row label="2.42 Internet y ventas" fn={(m) => sumCatMeses(gastos,'2.42',m)} indent={1} />
            <Row label="2.43 Administración" fn={(m) => sumCatMeses(gastos,'2.43',m)} indent={1} />
            {topProvs('2.43.').slice(0, 4).map(c => <Row key={c.id} label={c.nombre} fn={(m) => sumMeses(gastos[c.id]||{},m)} indent={2} muted />)}
            <Row label="2.44 Suministros" fn={(m) => sumCatMeses(gastos,'2.44',m)} indent={1} />
            {topProvs('2.44.').slice(0, 4).map(c => <Row key={c.id} label={c.nombre} fn={(m) => sumMeses(gastos[c.id]||{},m)} indent={2} muted />)}
            <Row label="2.4 Total Controlables" fn={d.gasCtrl} style="group" semaforo={{grupo:'2.4'}} />
            <Sep />
            <Row label="Total gastos" fn={d.gasTotal} style="total" />
            <Row label="EBITDA / Resultado" fn={d.resultado} style="result" sign />
          </tbody>
        </table>
      </div>
    </div>
  )
}
