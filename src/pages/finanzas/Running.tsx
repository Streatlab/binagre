import { useState, useMemo } from 'react'
import { useRunningAnual, sumMeses, sumCatMeses } from '@/hooks/useRunningAnual'
import { useTitular } from '@/contexts/TitularContext'
import { COLORS, FONT, CARDS, TABS_PILL } from '@/components/panel/resumen/tokens'

const MN = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const QM: Record<number,number[]> = {1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]}
const ALL = [1,2,3,4,5,6,7,8,9,10,11,12]
const BM: Record<string,string> = {'2.1':'PRODUCTO','2.2':'RRHH','2.3':'ALQUILER','2.41':'MARKETING','2.42':'INTERNET_VENTAS','2.43':'ADMIN_GENERALES','2.44':'SUMINISTROS'}
const COM: Record<string,number> = {uber:0.30,glovo:0.32,je:0.28,web:0.05,directa:0}
const curMonth = new Date().getMonth()+1

/* Colores trimestres alternos */
const Q_BG = ['rgba(30,91,204,0.03)','rgba(29,158,117,0.03)','rgba(245,166,35,0.03)','rgba(176,29,35,0.03)']
const Q_HEAD = ['rgba(30,91,204,0.08)','rgba(29,158,117,0.08)','rgba(245,166,35,0.08)','rgba(176,29,35,0.08)']
const Q_COLOR = ['#1E5BCC','#1D9E75','#f5a623','#B01D23']

/* Formato números */
const fmt = (n: number): string => {
  if (!n) return '—'
  const abs = Math.abs(n)
  const str = abs >= 1 ? Math.round(abs).toLocaleString('es-ES') : abs.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})
  return n < 0 ? `−${str}` : str
}
const fmt2 = (n: number): string => {
  if (!n) return '—'
  return (n<0?'−':'') + Math.abs(n).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})
}
const fmtP = (v: number) => v ? `${v.toFixed(1)}%` : '—'
const pctOf = (part: number, total: number) => total ? (part/total)*100 : 0

export default function Running(){
  const {filtro,titulares}=useTitular()
  const [año,setAño]=useState(2026)
  const [buscar,setBuscar]=useState('')
  const [tab,setTab]=useState<'resumen'|'detalle'>('resumen')
  const [qO,setQO]=useState<Record<number,boolean>>(()=>{const q=Math.ceil(curMonth/3);return{1:true,2:q>=2,3:q>=3,4:q>=4}})
  const tId=filtro==='unificado'?null:filtro
  const {ingresos,gastos,brutos,diasOp,categorias,benchmarks,loading}=useRunningAnual(año,tId)

  const iT=(ms:number[])=>{let s=0;for(const[c,m]of Object.entries(ingresos)){if(c.startsWith('1.'))s+=sumMeses(m,ms)};return s}
  const gP=(p:string,ms:number[])=>sumCatMeses(gastos,p,ms)
  const gT=(ms:number[])=>gP('2.',ms)
  const res=(ms:number[])=>iT(ms)-gT(ms)
  const pc=(ms:number[])=>{const i=iT(ms);return i?(gP('2.1',ms)+gP('2.2',ms))/i*100:0}
  const gB=(g:string)=>{const k=BM[g];return k?benchmarks.find(b=>b.categoria===k):null}
  const sC=(p:number,b:{pct_min:number;pct_max:number}|null|undefined)=>{if(!b)return COLORS.mut;if(p<=b.pct_max)return COLORS.ok;if(p<=b.pct_max*1.2)return COLORS.warn;return COLORS.err}
  const tQ=(q:number)=>setQO(p=>({...p,[q]:!p[q]}))
  const gFijos=(ms:number[])=>gP('2.2',ms)+gP('2.3',ms)
  const gVar=(ms:number[])=>gP('2.1',ms)+gP('2.4',ms)
  const pedidos=(ms:number[])=>ms.reduce((s,m)=>s+(brutos[m]?.pedidos||0),0)
  const ratioPed=(vFn:(ms:number[])=>number)=>(ms:number[])=>{const p=pedidos(ms);return p?vFn(ms)/p:0}
  const facBruta=(ms:number[])=>ms.reduce((s,m)=>s+(brutos[m]?.total||0),0)
  const netoEst=(ms:number[])=>ms.reduce((s,m)=>{const b=brutos[m];if(!b)return s;return s+(b.uber*(1-COM.uber))+(b.glovo*(1-COM.glovo))+(b.je*(1-COM.je))+(b.web*(1-COM.web))+(b.directa*(1-COM.directa))},0)
  const iMixed=(ms:number[])=>{const r=iT(ms);return r||netoEst(ms)}
  const iIsEst=(ms:number[])=>!iT(ms)&&netoEst(ms)>0
  const mBruto=(ms:number[])=>iMixed(ms)-gP('2.1',ms)
  const dOp=(ms:number[])=>ms.reduce((s,m)=>s+(diasOp[m]||0),0)
  const mediaD=(ms:number[])=>{const d=dOp(ms);return d?iMixed(ms)/d:0}
  const tmBruto=(ms:number[])=>{const p=pedidos(ms);return p?facBruta(ms)/p:0}
  const tmNeto=(ms:number[])=>{const p=pedidos(ms);return p?iMixed(ms)/p:0}

  type Col={label:string;ms:number[];isQ?:boolean;qn?:number;isY?:boolean;hid?:boolean;isCur?:boolean}
  const cols=useMemo(()=>{
    const c:Col[]=[]
    for(let q=1;q<=4;q++){
      QM[q].forEach(m=>c.push({label:MN[m-1],ms:[m],hid:!qO[q],isCur:m===curMonth}))
      c.push({label:`${qO[q]?'▾':'▸'} ${q}T`,ms:QM[q],isQ:true,qn:q})
    }
    c.push({label:'AÑO',ms:ALL,isY:true})
    return c
  },[qO])
  const cN2=useMemo(()=>categorias.filter(c=>c.nivel===2),[categorias])
  const cCh=(pid:string)=>categorias.filter(c=>c.parent_id===pid&&c.nivel===3).filter(c=>ALL.some(m=>(gastos[c.id]?.[m]||0)>0)).sort((a,b)=>sumMeses(gastos[b.id]||{},ALL)-sumMeses(gastos[a.id]||{},ALL))
  const vis=(l:string,f?:boolean)=>{if(f)return true;if(buscar.length<2)return true;return l.toLowerCase().includes(buscar.toLowerCase())}

  /* ── Qué trimestre pertenece un col ── */
  const colQ=(c:Col)=>{for(let q=1;q<=4;q++){if(c.isQ&&c.qn===q)return q;if(!c.isQ&&!c.isY&&QM[q].includes(c.ms[0]))return q};return 0}

  /* ── Estilos TH ── */
  const thBase=(c:Col): React.CSSProperties => {
    const q=colQ(c)
    const isQorY=c.isQ||c.isY
    return {fontFamily:FONT.heading,fontSize:10,fontWeight:isQorY?600:500,letterSpacing:'2px',textTransform:'uppercase',textAlign:'right',padding:'10px 10px',borderBottom:`0.5px solid ${COLORS.brd}`,whiteSpace:'nowrap',position:'sticky',top:0,zIndex:2,cursor:c.isQ?'pointer':'default',userSelect:'none',color:isQorY?(c.isY?COLORS.redSL:Q_COLOR[q-1]):COLORS.mut,background:isQorY?(c.isY?`${COLORS.redSL}0C`:Q_HEAD[q-1]):(q?Q_BG[q-1]:COLORS.bg)}
  }
  const thFirst: React.CSSProperties = {fontFamily:FONT.heading,fontSize:10,fontWeight:500,letterSpacing:'2px',color:COLORS.mut,textTransform:'uppercase',textAlign:'left',padding:'10px 12px',background:COLORS.bg,borderBottom:`0.5px solid ${COLORS.brd}`,whiteSpace:'nowrap',position:'sticky',left:0,top:0,zIndex:4,width:260,minWidth:220}
  const thPct=(c:Col): React.CSSProperties => {const q=colQ(c);return{...thBase(c),fontSize:8,letterSpacing:'1px',color:COLORS.mut+'90',minWidth:40,padding:'10px 3px'}}

  /* ── Estilos TD ── */
  const tdBase=(c:Col,highlight?:boolean): React.CSSProperties => {
    const q=colQ(c);const isQorY=c.isQ||c.isY
    return {padding:c.isCur?'8px 10px':'7px 10px',fontSize:c.isCur?14:(isQorY?13:13),fontFamily:FONT.body,color:COLORS.sec,borderBottom:`0.5px solid ${COLORS.brd}20`,whiteSpace:'nowrap',textAlign:'right',verticalAlign:'middle',fontVariantNumeric:'tabular-nums',lineHeight:1.4,fontWeight:isQorY?600:(c.isCur?500:400),background:isQorY?(c.isY?`${COLORS.redSL}04`:Q_BG[q-1]+'80'):(q?Q_BG[q-1]:undefined)}
  }
  const tdFi: React.CSSProperties = {padding:'8px 12px',fontSize:13,fontFamily:FONT.body,color:COLORS.sec,borderBottom:`0.5px solid ${COLORS.brd}20`,whiteSpace:'nowrap',textAlign:'left',position:'sticky',left:0,zIndex:1,verticalAlign:'middle',background:'#fff'}
  const tdPctS=(c:Col): React.CSSProperties => ({...tdBase(c),fontSize:10,color:COLORS.mut+'aa',padding:'7px 3px',minWidth:40})

  /* ── Cells ── */
  const Cells=({fn,sign,pct,pctFn,alertMax,valColor}:{fn:(ms:number[])=>number;sign?:boolean;pct?:boolean;pctFn?:(ms:number[])=>number;alertMax?:number;valColor?:string})=>(<>{cols.map((c,i)=>{if(c.hid&&!c.isY)return null;const v=fn(c.ms);const cl=valColor||(sign?(v>0?COLORS.ok:v<0?COLORS.err:COLORS.mut):undefined);const pre=sign&&v>0?'+':'';const valTd=<td key={i} style={{...tdBase(c),color:cl||tdBase(c).color,fontFamily:v&&!pct?FONT.heading:FONT.body,fontSize:v&&!pct?(c.isCur?16:(c.isQ||c.isY?14:14)):tdBase(c).fontSize,letterSpacing:v&&!pct?'0.5px':undefined}}>{pct?fmtP(v):v?`${pre}${fmt(v)}`:'—'}</td>;if(pctFn){const pv=pctFn(c.ms);const over=alertMax&&pv>alertMax;return[valTd,<td key={`p${i}`} style={{...tdPctS(c),color:over?COLORS.err:undefined}}>{pv?(over?<span style={{display:'inline-flex',alignItems:'center',gap:2}}><span style={{fontSize:11,animation:'pulse 2s infinite'}}>⚠</span>{pv.toFixed(1)}%</span>:`${pv.toFixed(1)}%`):'—'}</td>]}return valTd})}</>)
  const CellsRatio=({fn}:{fn:(ms:number[])=>number})=>(<>{cols.map((c,i)=>{if(c.hid&&!c.isY)return null;const v=fn(c.ms);return[<td key={i} style={{...tdBase(c),fontSize:10,color:COLORS.mut,fontStyle:'italic'}}>{v?fmt2(v):'—'}</td>,<td key={`p${i}`} style={tdPctS(c)}/>]})}</>)
  const CellsIng=()=>(<>{cols.map((c,i)=>{if(c.hid&&!c.isY)return null;const r=iT(c.ms);const e=netoEst(c.ms);const v=r||e;const est=!r&&e>0;return[<td key={i} style={{...tdBase(c),fontFamily:FONT.heading,fontSize:c.isCur?16:(c.isQ||c.isY?14:14),letterSpacing:'0.5px',fontStyle:est?'italic':undefined,color:est?COLORS.ok:undefined}}>{v?fmt(v):'—'}{est&&<span style={{fontSize:8,color:COLORS.mut,marginLeft:3}}>(est.)</span>}</td>,<td key={`p${i}`} style={tdPctS(c)}/>]})}</>)
  const Spark=({fn}:{fn:(ms:number[])=>number})=>{const vals=ALL.map(m=>fn([m]));const mx=Math.max(...vals.map(v=>Math.abs(v)),1);return<span style={{display:'inline-flex',alignItems:'flex-end',gap:1,height:16,verticalAlign:'middle',marginLeft:6}}>{vals.map((v,i)=><span key={i} style={{width:3,borderRadius:'1px 1px 0 0',height:`${Math.max(Math.abs(v)/mx*16,v?1:0)}px`,background:v>0?COLORS.ok:v<0?COLORS.err:COLORS.brd}}/>)}</span>}

  if(loading)return(<div style={{background:COLORS.bg,padding:'24px 28px',minHeight:'100vh'}}><h2 style={{color:COLORS.redSL,fontFamily:FONT.heading,fontSize:22,fontWeight:600,letterSpacing:'3px',margin:0,textTransform:'uppercase'}}>Running {año}</h2><p style={{fontFamily:FONT.body,fontSize:13,color:COLORS.mut,marginTop:4}}>Cargando…</p></div>)

  const grupos=categorias.filter(c=>c.nivel===1&&c.id.startsWith('2.'))
  const ingC=categorias.filter(c=>c.parent_id==='1.1'&&c.nivel===3)
  let ri=0;const aB=()=>{const b=ri%2===0?'#ffffff':'#fafaf8';ri++;return b};const rA=()=>{ri=0}
  const hv={onMouseEnter:(e:React.MouseEvent<HTMLTableRowElement>)=>{(e.currentTarget).style.background=`${COLORS.bg}60`},onMouseLeave:(e:React.MouseEvent<HTMLTableRowElement>)=>{(e.currentTarget).style.background=''}}
  const visibleCols=cols.filter(c=>!c.hid||c.isY)

  const secH=(label:string)=><tr><td colSpan={99} style={{...tdFi,background:COLORS.bg,fontFamily:FONT.heading,fontSize:10,letterSpacing:'2px',textTransform:'uppercase',color:COLORS.mut,padding:'14px 12px 6px',borderBottom:`1px solid ${COLORS.brd}`,fontWeight:500}}>{label}</td></tr>
  const grpTd: React.CSSProperties={...tdFi,fontFamily:FONT.heading,fontSize:11,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.redSL,fontWeight:600,background:`${COLORS.redSL}06`}
  const totTd: React.CSSProperties={...tdFi,fontFamily:FONT.heading,fontSize:12,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.redSL,fontWeight:700,background:`${COLORS.redSL}0C`,borderTop:`1.5px solid ${COLORS.brd}`}
  const resTd: React.CSSProperties={...tdFi,fontFamily:FONT.heading,fontSize:12,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.ok,fontWeight:700,background:`${COLORS.ok}0C`,borderTop:`2px solid ${COLORS.brd}`}
  const beTd: React.CSSProperties={...tdFi,fontFamily:FONT.heading,fontSize:10,letterSpacing:'1.5px',textTransform:'uppercase',color:'#1E5BCC',fontWeight:600,background:'rgba(30,91,204,0.04)',borderTop:'2px dashed #1E5BCC'}
  const sepR=<tr><td colSpan={99} style={{height:6,border:'none',background:COLORS.bg,padding:0}}/></tr>
  const cssAnim=`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`

  return(
    <div style={{background:COLORS.bg,padding:'24px 28px',minHeight:'100vh'}}>
      <style>{cssAnim}</style>
      <h2 style={{color:COLORS.redSL,fontFamily:FONT.heading,fontSize:22,fontWeight:600,letterSpacing:'3px',margin:0,textTransform:'uppercase'}}>RUNNING {año}</h2>
      <span style={{fontFamily:FONT.body,fontSize:13,color:COLORS.mut,display:'block',marginTop:4,marginBottom:18}}>Datos reales de Conciliación · Año completo · Trimestres colapsables</span>

      <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{...TABS_PILL.container}}>{[2026,2025].map(a=><button key={a} onClick={()=>setAño(a)} style={año===a?TABS_PILL.active:TABS_PILL.inactive}>{a}</button>)}</div>
        <span style={{color:COLORS.brd,margin:'0 2px'}}>|</span>
        <div style={{...TABS_PILL.container}}>{[{id:null as string|null,label:'Todos'},...titulares.map(t=>({id:t.id as string|null,label:t.nombre}))].map(t=><button key={t.id||'all'} style={(t.id===tId||(t.id===null&&!tId))?TABS_PILL.active:TABS_PILL.inactive} onClick={()=>{}}>{t.label}</button>)}</div>
        <div style={{flex:1}}/>
        <input placeholder="🔍 Buscar..." value={buscar} onChange={e=>setBuscar(e.target.value)} style={{padding:'10px 14px',borderRadius:10,border:`0.5px solid ${COLORS.brd}`,background:COLORS.card,fontFamily:FONT.body,fontSize:13,color:COLORS.pri,width:180,outline:'none',boxSizing:'border-box'}}/>
      </div>

      <div style={{...TABS_PILL.container,marginBottom:14}}>
        <button onClick={()=>setTab('resumen')} style={tab==='resumen'?TABS_PILL.active:TABS_PILL.inactive}>Resumen</button>
        <button onClick={()=>setTab('detalle')} style={tab==='detalle'?TABS_PILL.active:TABS_PILL.inactive}>Detalle</button>
      </div>

      <div style={{...CARDS.std,padding:0,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'separate',borderSpacing:0,minWidth:1500}}>
            <thead><tr>
              <th style={thFirst}>PyG DETALLADO</th>
              {visibleCols.map((c,i)=>[
                <th key={i} style={thBase(c)} onClick={c.qn?()=>tQ(c.qn!):undefined}>{c.label}</th>,
                <th key={`p${i}`} style={thPct(c)}>%</th>
              ])}
            </tr></thead>
            <tbody>
              {secH('PyG Detallado')}
              {rA() as any}
              {/* Facturación bruta */}
              {(()=>{const b=aB();return<tr style={{background:b}} {...hv}><td style={{...tdFi,fontStyle:'italic',color:COLORS.mut}}>Facturación bruta</td><Cells fn={facBruta}/></tr>})()}
              {/* Ingresos netos */}
              <tr><td style={grpTd}>Ingresos netos</td><CellsIng/></tr>
              {/* Pedidos */}
              {(()=>{const b=aB();return<tr style={{background:b}} {...hv}><td style={{...tdFi,paddingLeft:20,color:COLORS.mut}}>Nº Pedidos</td><Cells fn={pedidos}/></tr>})()}
              {/* TM Bruto */}
              {(()=>{const b=aB();return<tr style={{background:b}} {...hv}><td style={{...tdFi,paddingLeft:20,color:COLORS.warn,fontWeight:500}}>TM Bruto</td><Cells fn={tmBruto} valColor={COLORS.warn}/></tr>})()}
              {/* TM Neto */}
              {(()=>{const b=aB();return<tr style={{background:b}} {...hv}><td style={{...tdFi,paddingLeft:20,color:COLORS.ok,fontWeight:500}}>TM Neto</td><Cells fn={tmNeto} valColor={COLORS.ok}/></tr>})()}
              {/* Media/día */}
              {(()=>{const b=aB();return<tr style={{background:b}} {...hv}><td style={{...tdFi,paddingLeft:20,color:COLORS.mut}}>Media/día operativo</td><Cells fn={mediaD}/></tr>})()}
              {sepR}
              {/* Margen bruto */}
              <tr><td style={{...grpTd,color:COLORS.ok}}>Margen bruto</td><Cells fn={mBruto} pctFn={ms=>pctOf(mBruto(ms),iMixed(ms))} sign valColor={COLORS.ok}/></tr>
              {sepR}
              {/* Gastos fijos */}
              {(()=>{const b=aB();return<tr style={{background:b}} {...hv}><td style={{...tdFi,fontWeight:600}}>Gastos fijos</td><Cells fn={gFijos} pctFn={ms=>pctOf(gFijos(ms),iMixed(ms))}/></tr>})()}
              <tr><td style={{...tdFi,fontSize:10,color:COLORS.mut,fontStyle:'italic',paddingLeft:20,background:'#fafaf8'}}>por pedido</td><CellsRatio fn={ratioPed(gFijos)}/></tr>
              {/* Gastos variables */}
              {(()=>{const b=aB();return<tr style={{background:b}} {...hv}><td style={{...tdFi,fontWeight:600}}>Gastos variables</td><Cells fn={gVar} pctFn={ms=>pctOf(gVar(ms),iMixed(ms))}/></tr>})()}
              <tr><td style={{...tdFi,fontSize:10,color:COLORS.mut,fontStyle:'italic',paddingLeft:20,background:'#fafaf8'}}>por pedido</td><CellsRatio fn={ratioPed(gVar)}/></tr>
              {/* Total gastos */}
              <tr><td style={totTd}>Total gastos</td><Cells fn={gT} pctFn={ms=>pctOf(gT(ms),iMixed(ms))} alertMax={100}/></tr>
              <tr><td style={{...tdFi,fontSize:10,color:COLORS.mut,fontStyle:'italic',paddingLeft:20,background:'#fafaf8'}}>por pedido</td><CellsRatio fn={ratioPed(gT)}/></tr>
              {/* Break-even */}
              <tr><td style={beTd}>☰ Break-even mensual</td><Cells fn={gFijos}/></tr>
              {/* Resultado */}
              <tr><td style={resTd}>Resultado <Spark fn={res}/></td><Cells fn={res} sign/></tr>
              {sepR}

              {/* Ratios sobre ventas */}
              {secH('Ratios sobre ventas')}
              {rA() as any}
              {grupos.map(g=>{const bn=gB(g.id);const sc=sC(pctOf(gP(g.id,ALL),iMixed(ALL)),bn);const bI=bn?` (${bn.pct_min}-${bn.pct_max}%)`:'';const b=aB();return<tr key={g.id} style={{background:b}} {...hv}><td style={grpTd}><span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:sc,marginRight:5,verticalAlign:'middle'}}/>{g.nombre}<span style={{color:COLORS.mut,fontSize:10,fontWeight:400,letterSpacing:'1px'}}>{bI}</span></td><Cells fn={ms=>pctOf(gP(g.id,ms),iMixed(ms))} pct alertMax={bn?bn.pct_max:undefined}/></tr>})}
              <tr><td style={totTd}>Total gastos</td><Cells fn={ms=>pctOf(gT(ms),iMixed(ms))} pct alertMax={100}/></tr>
              <tr><td style={resTd}>Beneficio <Spark fn={ms=>pctOf(res(ms),iMixed(ms))}/></td><Cells fn={ms=>pctOf(res(ms),iMixed(ms))} pct sign/></tr>
              {(()=>{const b=aB();return<tr style={{background:b}} {...hv}><td style={{...tdFi,fontFamily:FONT.heading,fontSize:11,letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:700}}>Prime Cost <span style={{color:COLORS.mut,fontSize:10,fontWeight:400}}>(obj &lt;60%)</span></td><Cells fn={pc} pct alertMax={60}/></tr>})()}

              {/* Tab Detalle */}
              {tab==='detalle'&&<>
                {sepR}
                {secH('Desglose ingresos')}
                {rA() as any}
                <tr><td style={grpTd}>Ingresos por ventas</td><Cells fn={iMixed}/></tr>
                {ingC.map(c=>{if(!vis(c.nombre))return null;const b=aB();return<tr key={c.id} style={{background:b}} {...hv}><td style={{...tdFi,paddingLeft:20}}>{c.nombre}</td><Cells fn={ms=>sumMeses(ingresos[c.id]||{},ms)} pctFn={ms=>pctOf(sumMeses(ingresos[c.id]||{},ms),iMixed(ms))}/></tr>})}
                {sepR}
                {secH('Distribución gastos (% s/GS)')}
                {rA() as any}
                {grupos.map(g=>{const bn=gB(g.id);const sc=sC(pctOf(gP(g.id,ALL),iMixed(ALL)),bn);const bI=bn?` (${bn.pct_min}-${bn.pct_max}%)`:'';const b=aB();return<tr key={`d-${g.id}`} style={{background:b}} {...hv}><td style={grpTd}><span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:sc,marginRight:5,verticalAlign:'middle'}}/>{g.id} {g.nombre}<span style={{color:COLORS.mut,fontSize:10,fontWeight:400,letterSpacing:'1px'}}>{bI}</span></td><Cells fn={ms=>gP(g.id,ms)} pctFn={ms=>pctOf(gP(g.id,ms),gT(ms))}/></tr>})}
                <tr><td style={totTd}>Total gastos</td><Cells fn={gT}/></tr>
                {sepR}
                {grupos.map(g=>{const bn=gB(g.id);const bL=bn?` (${bn.pct_min}-${bn.pct_max}%)`:'';const sN=cN2.filter(c=>c.parent_id===g.id);const sc=sC(pctOf(gP(g.id,ALL),iMixed(ALL)),bn);return[
                  secH(`${g.id} ${g.nombre}${bL}`),
                  (rA(),null) as any,
                  ...sN.flatMap(sub=>{const ch=cCh(sub.id);return[vis(sub.nombre,true)?(()=>{const b=aB();return<tr key={sub.id} style={{background:b}} {...hv}><td style={{...tdFi,paddingLeft:20}}>{sub.id} {sub.nombre}</td><Cells fn={ms=>sumCatMeses(gastos,sub.id,ms)} pctFn={ms=>pctOf(sumCatMeses(gastos,sub.id,ms),iMixed(ms))}/></tr>})():null,...ch.map(c=>{if(!vis(c.nombre))return null;const b=aB();return<tr key={c.id} style={{background:b}} {...hv}><td style={{...tdFi,paddingLeft:34,color:COLORS.mut,fontSize:12}}>{c.nombre}</td><Cells fn={ms=>sumMeses(gastos[c.id]||{},ms)} pctFn={ms=>pctOf(sumMeses(gastos[c.id]||{},ms),iMixed(ms))}/></tr>})].filter(Boolean)}),
                  <tr key={`t-${g.id}`}><td style={grpTd}><span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:sc,marginRight:5,verticalAlign:'middle'}}/>{g.id} Total {g.nombre}</td><Cells fn={ms=>gP(g.id,ms)} pctFn={ms=>pctOf(gP(g.id,ms),iMixed(ms))}/></tr>,
                  sepR,
                ].filter(Boolean)}).flat()}
                <tr><td style={totTd}>Total gastos</td><Cells fn={gT} pctFn={ms=>pctOf(gT(ms),iMixed(ms))} alertMax={100}/></tr>
                <tr><td style={resTd}>EBITDA / Resultado</td><Cells fn={res} sign pctFn={ms=>pctOf(res(ms),iMixed(ms))}/></tr>
              </>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
