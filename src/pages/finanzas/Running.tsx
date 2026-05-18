import { useState, useMemo } from 'react'
import { useRunningAnual, sumMeses, sumCatMeses, fmtN } from '@/hooks/useRunningAnual'
import { useTitular } from '@/contexts/TitularContext'

const M = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const QM: Record<number,number[]> = {1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]}
const ALL = [1,2,3,4,5,6,7,8,9,10,11,12]

const BENCH_MAP: Record<string,string> = {
  '2.1':'PRODUCTO','2.2':'RRHH','2.3':'ALQUILER',
  '2.41':'MARKETING','2.42':'INTERNET_VENTAS','2.43':'ADMIN_GENERALES','2.44':'SUMINISTROS'
}

const CSS = `
.rtw{background:#fff;border:0.5px solid #d0c8bc;border-radius:10px;overflow:hidden;margin-bottom:20px}
.rtw table{width:100%;border-collapse:collapse;min-width:1200px}
.rtw th{font-family:'Oswald',sans-serif;font-size:10px;color:#7a8090;text-transform:uppercase;letter-spacing:1.5px;padding:8px 6px;text-align:right;white-space:nowrap;border-bottom:0.5px solid #d0c8bc;font-weight:400;background:rgba(235,232,226,0.7);position:sticky;top:0;z-index:2}
.rtw th:first-child{text-align:left;width:220px;min-width:180px;position:sticky;left:0;z-index:3;background:rgba(235,232,226,0.7)}
.rtw td{padding:6px 6px;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;border-bottom:0.5px solid rgba(208,200,188,0.25);font-size:12px;font-family:'Lexend',sans-serif}
.rtw td:first-child{text-align:left;position:sticky;left:0;z-index:1;font-size:12px}
.rtw tr:hover td{background:rgba(176,29,35,0.04)!important}

/* Filas alternas — estilo Facturación */
.rtw tbody tr.row-even td{background:#fff}
.rtw tbody tr.row-even td:first-child{background:#fff}
.rtw tbody tr.row-odd td{background:rgba(245,243,239,0.6)}
.rtw tbody tr.row-odd td:first-child{background:rgba(245,243,239,0.6)}

.rh td{font-family:'Oswald',sans-serif!important;font-size:10px!important;letter-spacing:1.5px;text-transform:uppercase;color:#7a8090!important;background:rgba(235,232,226,0.7)!important;padding:10px 6px 5px!important;border-bottom:1px solid #d0c8bc!important;font-weight:500}
.rh td:first-child{background:rgba(235,232,226,0.7)!important}
.rg td{font-weight:600;background:rgba(176,29,35,0.035)!important;font-size:12px}
.rg td:first-child{font-family:'Oswald',sans-serif!important;font-size:11px!important;letter-spacing:1px;text-transform:uppercase;color:#B01D23!important;background:rgba(176,29,35,0.035)!important}
.rt td{font-weight:700;background:rgba(176,29,35,0.07)!important;border-top:1.5px solid #d0c8bc!important;font-size:12.5px}
.rt td:first-child{font-family:'Oswald',sans-serif!important;font-size:12px!important;letter-spacing:1px;text-transform:uppercase;color:#B01D23!important;background:rgba(176,29,35,0.07)!important}
.rp td{font-weight:700;background:rgba(176,29,35,0.05)!important;font-size:12px}
.rp td:first-child{font-family:'Oswald',sans-serif!important;font-size:11px!important;letter-spacing:1px;text-transform:uppercase;background:rgba(176,29,35,0.05)!important}
.re td{font-weight:700;background:rgba(29,158,117,0.06)!important;border-top:2px solid #d0c8bc!important;font-size:13px}
.re td:first-child{font-family:'Oswald',sans-serif!important;font-size:12px!important;letter-spacing:1px;text-transform:uppercase;background:rgba(29,158,117,0.06)!important}
.rs td{padding-left:18px!important;color:#3a4050;font-size:11.5px}
.rs td:first-child{padding-left:18px!important;color:#3a4050}
.rs2 td{padding-left:32px!important;color:#7a8090!important;font-size:11px!important}
.rs2 td:first-child{padding-left:32px!important;color:#7a8090!important}
.ri td{color:#7a8090!important;font-style:italic;font-size:11px!important}
.ri td:first-child{font-style:italic;color:#7a8090!important}
.sep td{height:6px!important;border:none!important;background:#f5f3ef!important;padding:0!important}
.s{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px;vertical-align:middle}
.sg{background:#1D9E75}.sr{background:#B01D23}.so{background:#f5a623}
.pos{color:#1D9E75!important}.neg{color:#B01D23!important}.mt{color:#7a8090!important}
.pct{color:#7a8090;font-size:10px}
th.qh{background:rgba(176,29,35,0.06)!important;font-weight:600!important;color:#B01D23!important}
th.qt{cursor:pointer;user-select:none}
th.qt:hover{text-decoration:underline}
td.qv{background:rgba(176,29,35,0.02)!important;font-weight:600!important}
.hid{display:none}
.rfl{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
.rfb{padding:5px 12px;border-radius:6px;border:0.5px solid #d0c8bc;background:transparent;color:#3a4050;font-family:'Lexend',sans-serif;font-size:12px;cursor:pointer;transition:all .15s}
.rfb.on{background:#FF4757;color:#fff;border-color:#FF4757}
.rfb:hover:not(.on){border-color:#999}
.rsi{padding:5px 10px;border-radius:6px;border:0.5px solid #d0c8bc;background:#fff;color:#111;font-family:'Lexend',sans-serif;font-size:12px;width:180px;outline:none}
.rsi:focus{border-color:#f5a623}
.rsi::placeholder{color:#7a8090}
`

export default function Running() {
  const { filtro, titulares } = useTitular()
  const [año, setAño] = useState(2026)
  const [buscar, setBuscar] = useState('')
  const [qOpen, setQOpen] = useState<Record<number,boolean>>(() => {
    const q = Math.ceil((new Date().getMonth()+1)/3)
    return {1:true, 2:q>=2, 3:q>=3, 4:q>=4}
  })
  const titularId = filtro === 'unificado' ? null : filtro
  const { ingresos, gastos, brutos, categorias, benchmarks, loading } = useRunningAnual(año, titularId)

  const ingTotal = (ms: number[]) => {
    let s = 0
    for (const [cat, map] of Object.entries(ingresos)) { if (cat.startsWith('1.')) s += sumMeses(map, ms) }
    return s
  }
  const gasByPrefix = (prefix: string, ms: number[]) => sumCatMeses(gastos, prefix, ms)
  const gasTotal = (ms: number[]) => gasByPrefix('2.', ms)
  const resultado = (ms: number[]) => ingTotal(ms) - gasTotal(ms)
  const primeCost = (ms: number[]) => { const i = ingTotal(ms); return i ? (gasByPrefix('2.1',ms)+gasByPrefix('2.2',ms))/i*100 : 0 }

  const getBench = (grupo: string) => { const k = BENCH_MAP[grupo]; return k ? benchmarks.find(b=>b.categoria===k) : null }
  const sColor = (pct: number, b: {pct_min:number;pct_max:number}|null|undefined) => {
    if (!b) return 'mt'; if (pct<=b.pct_max) return 'sg'; if (pct<=b.pct_max*1.2) return 'so'; return 'sr'
  }

  const toggleQ = (q: number) => setQOpen(p=>({...p,[q]:!p[q]}))

  type Col = {label:string;ms:number[];isQ?:boolean;qn?:number;isY?:boolean;cls?:string}
  const cols = useMemo(()=>{
    const c: Col[] = []
    for (let q=1;q<=4;q++){
      QM[q].forEach(m=>c.push({label:M[m-1],ms:[m],cls:qOpen[q]?'':`hid q${q}m`}))
      c.push({label:`${qOpen[q]?'▾':'▸'} ${q}T`,ms:QM[q],isQ:true,qn:q})
    }
    c.push({label:'Año',ms:ALL,isY:true})
    return c
  },[qOpen])

  const catN2 = useMemo(()=>categorias.filter(c=>c.nivel===2),[categorias])
  const catChildren = (parentId: string) => categorias.filter(c=>c.parent_id===parentId && c.nivel===3).filter(c=>ALL.some(m=>(gastos[c.id]?.[m]||0)>0)).sort((a,b)=>sumMeses(gastos[b.id]||{},ALL)-sumMeses(gastos[a.id]||{},ALL))

  const Fp = (v: number) => v ? `${v.toFixed(1)}%` : '—'

  const Cells = ({fn,sign,pct}:{fn:(ms:number[])=>number;sign?:boolean;pct?:boolean}) => (<>
    {cols.map((c,i)=>{
      const v = fn(c.ms)
      const cls = [c.cls||'', c.isQ||c.isY?'qv':''].filter(Boolean).join(' ')
      const color = sign ? (v>0?'pos':v<0?'neg':'mt') : ''
      const pre = sign&&v>0?'+':''
      return <td key={i} className={`${cls} ${color}`}>{pct?Fp(v):v?`${pre}${fmtN(v)}`:'—'}</td>
    })}
  </>)

  const visible = (label: string, force?: boolean) => {
    if (force) return true
    if (buscar.length<2) return true
    return label.toLowerCase().includes(buscar.toLowerCase())
  }

  // Contador de filas para alternar sombreado
  let rowIdx = 0
  const rowClass = (base: string) => {
    const alt = rowIdx % 2 === 0 ? 'row-even' : 'row-odd'
    rowIdx++
    return `${base} ${alt}`
  }
  // Reset para filas especiales (headers/separadores no cuentan)
  const resetRow = () => { rowIdx = 0 }

  if (loading) return (
    <div style={{padding:28,background:'#f5f3ef',minHeight:'100vh'}}>
      <style>{CSS}</style>
      <h1 style={{fontFamily:"'Oswald',sans-serif",fontSize:22,letterSpacing:3,textTransform:'uppercase',color:'#B01D23',fontWeight:600}}>Running {año}</h1>
      <p style={{color:'#7a8090',fontSize:13}}>Cargando datos...</p>
    </div>
  )

  const grupos = categorias.filter(c=>c.nivel===1 && c.id.startsWith('2.'))
  const ingCats = categorias.filter(c=>c.parent_id==='1.1' && c.nivel===3)

  // Pre-build rows para poder asignar filas alternas
  resetRow()

  return (
    <div style={{padding:28,background:'#f5f3ef',minHeight:'100vh'}}>
      <style>{CSS}</style>
      <h1 style={{fontFamily:"'Oswald',sans-serif",fontSize:22,letterSpacing:3,textTransform:'uppercase',color:'#B01D23',fontWeight:600,margin:'0 0 4px'}}>Running {año}</h1>
      <p style={{color:'#7a8090',fontSize:12,marginBottom:16}}>Datos reales de Conciliación · Año completo · Trimestres colapsables</p>

      <div className="rfl">
        {[2026,2025].map(a=><button key={a} className={`rfb${año===a?' on':''}`} onClick={()=>setAño(a)}>{a}</button>)}
        <span style={{color:'#7a8090',fontSize:11,margin:'0 4px'}}>|</span>
        {[{id:null as string|null,label:'Todos'},...titulares.map(t=>({id:t.id as string|null,label:t.nombre}))].map(t=>
          <button key={t.id||'all'} className={`rfb${(t.id===titularId||(t.id===null&&!titularId))?' on':''}`}
            onClick={()=>{}}>{t.label}</button>
        )}
        <div style={{flex:1}}/>
        <input className="rsi" placeholder="🔍 Buscar..." value={buscar} onChange={e=>setBuscar(e.target.value)}/>
      </div>

      <div className="rtw" style={{overflowX:'auto'}}>
        <table>
          <thead><tr>
            <th>Running {año}</th>
            {cols.map((c,i)=>(
              <th key={i} className={`${c.cls||''} ${c.isQ||c.isY?'qh':''} ${c.isQ?'qt':''}`}
                onClick={c.qn?()=>toggleQ(c.qn!):undefined}>{c.label}</th>
            ))}
          </tr></thead>
          <tbody>
            <tr className="rh"><td colSpan={99}>Resumen</td></tr>
            <tr className={rowClass('rg')}><td>Ingresos netos</td><Cells fn={ingTotal}/></tr>
            {grupos.map(g=>{
              const b = getBench(g.id); const yi = ingTotal(ALL); const yv = gasByPrefix(g.id,ALL); const yp = yi?yv/yi*100:0; const sc = sColor(yp,b)
              const bInfo = b?` (${b.pct_min}-${b.pct_max}%)`:'';
              return <tr key={g.id} className={rowClass('rg')}><td><span className={`s ${sc}`}/>{g.id} {g.nombre} <span className="pct">{bInfo}</span></td><Cells fn={ms=>gasByPrefix(g.id,ms)}/></tr>
            })}
            <tr className="rt"><td>Total gastos</td><Cells fn={gasTotal}/></tr>
            <tr className="re"><td>Resultado</td><Cells fn={resultado} sign/></tr>
            <tr className={rowClass('rp')}><td>Prime Cost <span className="pct">(obj &lt;60%)</span></td><Cells fn={primeCost} pct/></tr>
            <tr className="sep"><td colSpan={99}/></tr>

            {(() => { resetRow(); return null })()}
            <tr className="rh"><td colSpan={99}>1. Ingresos</td></tr>
            {ingCats.map(c=>visible(c.nombre)&&(
              <tr key={c.id} className={rowClass('rs')}><td>{c.nombre}</td><Cells fn={ms=>sumMeses(ingresos[c.id]||{},ms)}/></tr>
            ))}
            <tr className="rg"><td>1.01 Ingresos netos</td><Cells fn={ingTotal}/></tr>
            <tr className={rowClass('ri')}><td>1.02 Facturación bruta</td><Cells fn={ms=>ms.reduce((s,m)=>s+(brutos[m]?.total||0),0)}/></tr>
            <tr className={rowClass('rs')}><td style={{color:'#7a8090'}}>Pedidos</td><Cells fn={ms=>ms.reduce((s,m)=>s+(brutos[m]?.pedidos||0),0)}/></tr>
            <tr className={rowClass('rs')}><td style={{color:'#7a8090'}}>Ticket medio</td><Cells fn={ms=>{const b=ms.reduce((s,m)=>s+(brutos[m]?.total||0),0);const p=ms.reduce((s,m)=>s+(brutos[m]?.pedidos||0),0);return p?Math.round(b/p*100)/100:0}}/></tr>

            {grupos.map(g=>{
              const b = getBench(g.id); const bLabel = b?` (benchmark ${b.pct_min}-${b.pct_max}%)`:'';
              const subN2 = catN2.filter(c=>c.parent_id===g.id)
              const yi = ingTotal(ALL); const yv = gasByPrefix(g.id,ALL); const yp = yi?yv/yi*100:0; const sc = sColor(yp,b);
              return [
                <tr key={`sep-${g.id}`} className="sep"><td colSpan={99}/></tr>,
                (() => { resetRow(); return null })(),
                <tr key={`hdr-${g.id}`} className="rh"><td colSpan={99}>{g.id} {g.nombre} <span style={{fontWeight:300}}>{bLabel}</span></td></tr>,
                ...subN2.flatMap(sub=>{
                  const children = catChildren(sub.id)
                  return [
                    visible(sub.nombre,true)&&<tr key={sub.id} className={rowClass('rs')}><td>{sub.id} {sub.nombre}</td><Cells fn={ms=>sumCatMeses(gastos,sub.id,ms)}/></tr>,
                    ...children.map(ch=>visible(ch.nombre)&&(
                      <tr key={ch.id} className={rowClass('rs2')}><td>{ch.nombre}</td><Cells fn={ms=>sumMeses(gastos[ch.id]||{},ms)}/></tr>
                    ))
                  ].filter(Boolean)
                }),
                <tr key={`tot-${g.id}`} className="rg"><td><span className={`s ${sc}`}/>{g.id} Total {g.nombre}</td><Cells fn={ms=>gasByPrefix(g.id,ms)}/></tr>,
                b?<tr key={`pct-${g.id}`} className={rowClass('rs')}><td style={{color:'#7a8090'}}>% s/Ingresos</td><Cells fn={ms=>{const i=ingTotal(ms);return i?gasByPrefix(g.id,ms)/i*100:0}} pct/></tr>:null,
              ].filter(Boolean)
            }).flat()}

            <tr className="sep"><td colSpan={99}/></tr>
            <tr className="rt"><td>Total gastos</td><Cells fn={gasTotal}/></tr>
            <tr className="re"><td>EBITDA / Resultado</td><Cells fn={resultado} sign/></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
