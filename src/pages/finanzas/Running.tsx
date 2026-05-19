import { useState, useMemo } from 'react'
import { useRunningAnual, sumMeses, sumCatMeses } from '@/hooks/useRunningAnual'
import { useTitular } from '@/contexts/TitularContext'
import { COLORS, FONT, CARDS, TABS_PILL } from '@/components/panel/resumen/tokens'
const MN=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const QM:Record<number,number[]>={1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]}
const ALL=[1,2,3,4,5,6,7,8,9,10,11,12]
const BM:Record<string,string>={'2.1':'PRODUCTO','2.2':'RRHH','2.3':'ALQUILER','2.41':'MARKETING','2.42':'INTERNET_VENTAS','2.43':'ADMIN_GENERALES','2.44':'SUMINISTROS'}
const LBL:Record<string,string>={'2.1':'Producto','2.2':'Equipo','2.3':'Local','2.4':'Controlables'}
const COM:Record<string,number>={uber:0.30,glovo:0.32,je:0.28,web:0.05,directa:0}
const curM=new Date().getMonth()+1
const QBG=['rgba(30,91,204,0.04)','rgba(29,158,117,0.04)','rgba(245,166,35,0.04)','rgba(176,29,35,0.04)']
const QHD=['rgba(30,91,204,0.12)','rgba(29,158,117,0.12)','rgba(245,166,35,0.12)','rgba(176,29,35,0.12)']
const QCL=['#1E5BCC','#1D9E75','#f5a623','#B01D23']
const fmt=(n:number):string=>{if(!n)return'—';const a=Math.abs(n);const s=a>=1?Math.round(a).toLocaleString('es-ES'):a.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2});return n<0?`−${s}`:s}
const f2=(n:number):string=>{if(!n)return'—';return(n<0?'−':'')+Math.abs(n).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})}
const fP=(v:number)=>v?`${v.toFixed(1)}%`:'—'
const po=(p:number,t:number)=>t?(p/t)*100:0
const CSS=`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`
export default function Running(){
const{filtro,titulares}=useTitular()
const[año,sA]=useState(2026)
const[qO,sQ]=useState<Record<number,boolean>>(()=>{const q=Math.ceil(curM/3);return{1:true,2:q>=2,3:q>=3,4:q>=4}})
const[det,sD]=useState<Record<string,boolean>>({})
const[allOpen,sAO]=useState(false)
const tId=filtro==='unificado'?null:filtro
const{ingresos,gastos,brutos,diasOp,categorias,benchmarks,loading}=useRunningAnual(año,tId)
const iT=(ms:number[])=>{let s=0;for(const[c,m]of Object.entries(ingresos)){if(c.startsWith('1.'))s+=sumMeses(m,ms)};return s}
const gP=(p:string,ms:number[])=>sumCatMeses(gastos,p,ms)
const gT=(ms:number[])=>gP('2.',ms)
const res=(ms:number[])=>iT(ms)-gT(ms)
const gB=(g:string)=>{const k=BM[g];return k?benchmarks.find(b=>b.categoria===k):null}
const sC=(p:number,b:{pct_min:number;pct_max:number}|null|undefined)=>{if(!b)return COLORS.mut;if(p<=b.pct_max)return COLORS.ok;if(p<=b.pct_max*1.2)return COLORS.warn;return COLORS.err}
const tQ=(q:number)=>sQ(p=>({...p,[q]:!p[q]}))
const gF=(ms:number[])=>gP('2.2',ms)+gP('2.3',ms)
const gV=(ms:number[])=>gP('2.1',ms)+gP('2.4',ms)
const ped=(ms:number[])=>ms.reduce((s,m)=>s+(brutos[m]?.pedidos||0),0)
const fB=(ms:number[])=>ms.reduce((s,m)=>s+(brutos[m]?.total||0),0)
const nE=(ms:number[])=>ms.reduce((s,m)=>{const b=brutos[m];if(!b)return s;return s+(b.uber*(1-COM.uber))+(b.glovo*(1-COM.glovo))+(b.je*(1-COM.je))+(b.web*(1-COM.web))+(b.directa*(1-COM.directa))},0)
const iM=(ms:number[])=>{const r=iT(ms);return r||nE(ms)}
const mB=(ms:number[])=>iM(ms)-gP('2.1',ms)
const mD=(ms:number[])=>{const d=ms.reduce((s,m)=>s+(diasOp[m]||0),0);return d?iM(ms)/d:0}
const tB=(ms:number[])=>{const p=ped(ms);return p?fB(ms)/p:0}
const tN=(ms:number[])=>{const p=ped(ms);return p?iM(ms)/p:0}
const cd=(ms:number[])=>{const i=iM(ms);return i?(gP('2.1',ms)+gP('2.2',ms))/i*100:0}
type Col={label:string;ms:number[];isQ?:boolean;qn?:number;isY?:boolean;hid?:boolean;isCur?:boolean}
const cols=useMemo(()=>{const c:Col[]=[];for(let q=1;q<=4;q++){QM[q].forEach(m=>c.push({label:MN[m-1],ms:[m],hid:!qO[q],isCur:m===curM}));c.push({label:`${qO[q]?'▾':'▸'} ${q}T`,ms:QM[q],isQ:true,qn:q})};c.push({label:'AÑO',ms:ALL,isY:true});return c},[qO])
const vc=cols.filter(c=>!c.hid||c.isY)
const cN2=useMemo(()=>categorias.filter(c=>c.nivel===2),[categorias])
const cCh=(pid:string)=>categorias.filter(c=>c.parent_id===pid&&c.nivel===3).filter(c=>ALL.some(m=>(gastos[c.id]?.[m]||0)>0)).sort((a,b)=>sumMeses(gastos[b.id]||{},ALL)-sumMeses(gastos[a.id]||{},ALL))
const vi=(l:string)=>{return l.toLowerCase()}
const cQ=(c:Col)=>{for(let q=1;q<=4;q++){if(c.isQ&&c.qn===q)return q;if(!c.isQ&&!c.isY&&QM[q].includes(c.ms[0]))return q};return 0}
/* ── Estilos — SIN sticky right para AÑO ── */
const thS=(c:Col):React.CSSProperties=>{const q=cQ(c);const qy=c.isQ||c.isY;return{fontFamily:FONT.heading,fontSize:10,fontWeight:qy?700:500,letterSpacing:'1.5px',textTransform:'uppercase' as const,textAlign:'right' as const,padding:'8px 4px',borderBottom:`0.5px solid ${COLORS.brd}`,whiteSpace:'nowrap' as const,position:'sticky' as const,top:0,zIndex:2,cursor:c.isQ?'pointer':'default',userSelect:'none' as const,color:qy?(c.isY?COLORS.redSL:QCL[q-1]):COLORS.mut,background:qy?(c.isY?`${COLORS.redSL}14`:QHD[q-1]):(q?QBG[q-1]:COLORS.bg)}}
const th1:React.CSSProperties={fontFamily:FONT.heading,fontSize:10,fontWeight:500,letterSpacing:'1.5px',color:COLORS.mut,textTransform:'uppercase',textAlign:'left',padding:'8px 10px',background:COLORS.bg,borderBottom:`0.5px solid ${COLORS.brd}`,whiteSpace:'nowrap',position:'sticky',left:0,top:0,zIndex:4,width:180,minWidth:160}
const thP=(c:Col):React.CSSProperties=>({...thS(c),fontSize:8,letterSpacing:'0.5px',color:COLORS.mut+'80',minWidth:28,padding:'8px 2px'})
const tdc=(c:Col):React.CSSProperties=>{const q=cQ(c);const qy=c.isQ||c.isY;return{padding:'4px 4px',fontSize:13,fontFamily:FONT.body,color:COLORS.sec,borderBottom:`0.5px solid ${COLORS.brd}20`,whiteSpace:'nowrap',textAlign:'right',verticalAlign:'middle',fontVariantNumeric:'tabular-nums',lineHeight:1.3,fontWeight:qy?600:400,background:qy?(c.isY?`${COLORS.redSL}08`:QBG[q-1]):(q?QBG[q-1]:undefined)}}
const td1:React.CSSProperties={padding:'4px 10px',fontSize:12,fontFamily:FONT.body,color:COLORS.sec,borderBottom:`0.5px solid ${COLORS.brd}20`,whiteSpace:'nowrap',textAlign:'left',position:'sticky',left:0,zIndex:1,verticalAlign:'middle',background:'#fff'}
const tdP=(c:Col):React.CSSProperties=>({...tdc(c),fontSize:9,color:COLORS.mut+'99',padding:'4px 2px',minWidth:28})
const nS=(c:Col,rz?:boolean):React.CSSProperties=>({fontFamily:FONT.heading,fontSize:c.isY?(rz?20:16):(c.isQ?(rz?17:15):(c.isCur?(rz?16:15):(rz?15:14))),fontWeight:c.isY?700:(c.isQ||c.isCur?600:500),letterSpacing:'0.3px'})
const rBg='#fdf6ed'
const r1:React.CSSProperties={...td1,background:rBg,borderLeft:`3px solid ${COLORS.redSL}`}
const rC=(c:Col):React.CSSProperties=>({...tdc(c),background:c.isY?`${COLORS.redSL}10`:(c.isQ?tdc(c).background:rBg)})
const Cells=({fn,sign,pct,pctFn,alertMax,vc:vcl,rz}:{fn:(ms:number[])=>number;sign?:boolean;pct?:boolean;pctFn?:(ms:number[])=>number;alertMax?:number;vc?:string;rz?:boolean})=>(<>{vc.map((c,i)=>{const v=fn(c.ms);const cl=vcl||(sign?(v>0?COLORS.ok:v<0?COLORS.err:COLORS.mut):undefined);const pre=sign&&v>0?'+':'';const st=rz?rC(c):tdc(c);const vt=<td key={i} style={{...st,color:cl||st.color,...(v&&!pct?nS(c,rz):{}),fontFamily:v&&!pct?FONT.heading:st.fontFamily}}>{pct?fP(v):v?`${pre}${fmt(v)}`:'—'}</td>;if(pctFn){const pv=pctFn(c.ms);const ov=alertMax&&pv>alertMax;return[vt,<td key={`p${i}`} style={{...tdP(c),color:ov?COLORS.err:undefined,fontWeight:ov?600:undefined,background:rz?rBg:tdP(c).background}}>{pv?(ov?<span style={{display:'inline-flex',alignItems:'center',gap:1}}><span style={{fontSize:10,animation:'pulse 2s infinite'}}>⚠</span>{pv.toFixed(1)}%</span>:`${pv.toFixed(1)}%`):'—'}</td>]}return vt})}</>)
/* TM: pedidos + TMB + TMN — MISMO tamaño Oswald, TM con 2 decimales */
const CTM=({rz:r}:{rz?:boolean})=>(<>{vc.map((c,i)=>{const p=ped(c.ms);const tb=tB(c.ms);const tn=tN(c.ms);const st=r?rC(c):tdc(c);const sz=c.isY?16:(c.isQ?15:14);return[<td key={i} style={{...st,fontFamily:FONT.heading,fontSize:sz,fontWeight:c.isY?700:(c.isQ?600:500),letterSpacing:'0.3px'}}>{p?<><span style={{color:COLORS.sec}}>{fmt(p)}</span>{' '}<span style={{color:COLORS.warn,fontSize:sz}}>{f2(tb)}</span><span style={{color:COLORS.mut,fontSize:sz-4}}>/</span><span style={{color:COLORS.ok,fontSize:sz}}>{f2(tn)}</span></>:'—'}</td>,<td key={`p${i}`} style={{...tdP(c),background:r?rBg:tdP(c).background}}/>]})}</>)
const CI=({rz:r}:{rz?:boolean})=>(<>{vc.map((c,i)=>{const rv=iT(c.ms);const e=nE(c.ms);const v=rv||e;const est=!rv&&e>0;const st=r?rC(c):tdc(c);return[<td key={i} style={{...st,...nS(c,r),fontStyle:est?'italic':undefined,color:est?COLORS.ok:undefined}}>{v?fmt(v):'—'}{est&&<span style={{fontSize:8,color:COLORS.mut,marginLeft:2}}>(est.)</span>}</td>,<td key={`p${i}`} style={{...tdP(c),background:r?rBg:tdP(c).background}}/>]})}</>)
const CR=({fn,rz:r}:{fn:(ms:number[])=>number;rz?:boolean})=>(<>{vc.map((c,i)=>{const v=fn(c.ms);const st=r?rC(c):tdc(c);return[<td key={i} style={{...st,fontSize:10,color:COLORS.mut,fontStyle:'italic'}}>{v?f2(v):'—'}</td>,<td key={`p${i}`} style={{...tdP(c),background:r?rBg:tdP(c).background}}/>]})}</>)
const CB=({fn,max}:{fn:(ms:number[])=>number;max:number})=>(<>{vc.map((c,i)=>{const v=fn(c.ms);const col=v<=max*0.5?COLORS.ok:v<=max?COLORS.warn:COLORS.err;return[<td key={i} style={{...tdc(c),...nS(c),color:v>max?COLORS.err:undefined}}>{v?fP(v):'—'}{v>0&&<div style={{display:'block',width:'100%',height:4,borderRadius:2,background:'#ebe8e2',marginTop:2,overflow:'hidden'}}><div style={{height:'100%',borderRadius:2,background:col,width:`${Math.min(v/max*100,100)}%`}}/></div>}</td>,<td key={`p${i}`} style={tdP(c)}/>]})}</>)
const Sp=({fn}:{fn:(ms:number[])=>number})=>{const vs=ALL.map(m=>fn([m]));const mx=Math.max(...vs.map(v=>Math.abs(v)),1);return<span style={{display:'inline-flex',alignItems:'flex-end',gap:1,height:14,verticalAlign:'middle',marginLeft:6}}>{vs.map((v,i)=><span key={i} style={{width:3,borderRadius:'1px 1px 0 0',height:`${Math.max(Math.abs(v)/mx*14,v?1:0)}px`,background:v>0?COLORS.ok:v<0?COLORS.err:COLORS.brd}}/>)}</span>}
if(loading)return(<div style={{background:COLORS.bg,padding:'24px 28px',minHeight:'100vh'}}><h2 style={{color:COLORS.redSL,fontFamily:FONT.heading,fontSize:22,fontWeight:600,letterSpacing:'3px',margin:0,textTransform:'uppercase'}}>Running {año}</h2><p style={{fontFamily:FONT.body,fontSize:13,color:COLORS.mut,marginTop:4}}>Cargando…</p></div>)
const grupos=categorias.filter(c=>c.nivel===1&&c.id.startsWith('2.'))
const ingC=categorias.filter(c=>c.parent_id==='1.1'&&c.nivel===3)
let ri=0;const aB=()=>{const b=ri%2===0?'#fff':'#fafaf8';ri++;return b};const rA=()=>{ri=0}
const hv={onMouseEnter:(e:React.MouseEvent<HTMLTableRowElement>)=>{e.currentTarget.style.background=`${COLORS.bg}60`},onMouseLeave:(e:React.MouseEvent<HTMLTableRowElement>)=>{e.currentTarget.style.background=''}}
const sH=(l:string,x?:React.ReactNode)=><tr><td colSpan={99} style={{...td1,background:COLORS.bg,fontFamily:FONT.heading,fontSize:10,letterSpacing:'2px',textTransform:'uppercase',color:COLORS.mut,padding:'12px 10px 5px',borderBottom:`1px solid ${COLORS.brd}`,fontWeight:500}}>{l}{x}</td></tr>
const gTd:React.CSSProperties={...td1,fontFamily:FONT.heading,fontSize:11,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.redSL,fontWeight:600,background:`${COLORS.redSL}06`}
const tTd:React.CSSProperties={...td1,fontFamily:FONT.heading,fontSize:12,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.redSL,fontWeight:700,background:`${COLORS.redSL}0C`,borderTop:`2px solid ${COLORS.brd}`}
const rTd:React.CSSProperties={...td1,fontFamily:FONT.heading,fontSize:13,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.ok,fontWeight:700,background:`${COLORS.ok}0C`,borderTop:`2px solid ${COLORS.brd}`}
const bTd:React.CSSProperties={...td1,fontFamily:FONT.heading,fontSize:10,letterSpacing:'1.5px',textTransform:'uppercase',color:'#1E5BCC',fontWeight:600,background:'rgba(30,91,204,0.04)',borderTop:'2px dashed #1E5BCC'}
const sep=<tr><td colSpan={99} style={{height:5,border:'none',background:COLORS.bg,padding:0}}/></tr>
const rH:React.CSSProperties={background:COLORS.redSL,color:'#fff',fontFamily:FONT.heading,fontSize:11,letterSpacing:'2px',textTransform:'uppercase',fontWeight:600,padding:'10px 10px',borderBottom:'none',textAlign:'left',position:'sticky',left:0,zIndex:1}
/* Dropdown año */
const selSt:React.CSSProperties={padding:'5px 12px',borderRadius:8,border:`0.5px solid ${COLORS.brd}`,background:COLORS.card,fontFamily:FONT.body,fontSize:13,color:COLORS.sec,cursor:'pointer',outline:'none'}
return(<div style={{background:COLORS.bg,padding:'24px 28px',minHeight:'100vh'}}><style>{CSS}</style>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:8}}>
<h2 style={{color:COLORS.redSL,fontFamily:FONT.heading,fontSize:22,fontWeight:600,letterSpacing:'3px',margin:0,textTransform:'uppercase'}}>RUNNING {año}</h2>
<div style={{display:'flex',gap:5,alignItems:'center'}}>
<div style={{...TABS_PILL.container}}>{[{id:null as string|null,label:'Todos'},...titulares.map(t=>({id:t.id as string|null,label:t.nombre}))].map(t=><button key={t.id||'all'} style={(t.id===tId||(t.id===null&&!tId))?TABS_PILL.active:TABS_PILL.inactive} onClick={()=>{}}>{t.label}</button>)}</div>
<select value={año} onChange={e=>sA(Number(e.target.value))} style={selSt}>{[2026,2025,2024].map(a=><option key={a} value={a}>{a}</option>)}</select>
</div></div>
<div style={{...CARDS.std,padding:0,overflow:'hidden'}}><div style={{overflowX:'auto'}}>
<table style={{width:'100%',borderCollapse:'separate',borderSpacing:0,minWidth:1100}}>
<thead><tr><th style={th1}>PyG</th>{vc.map((c,i)=>[<th key={i} style={thS(c)} onClick={c.qn?()=>tQ(c.qn!):undefined}>{c.label}</th>,<th key={`p${i}`} style={thP(c)}>%</th>])}</tr></thead>
<tbody>
<tr><td colSpan={99} style={rH}>RESUMEN</td></tr>{rA() as any}
<tr style={{background:rBg}} {...hv}><td style={{...r1,fontStyle:'italic',color:COLORS.mut,fontSize:11}}>Facturación bruta</td><Cells fn={fB} rz/></tr>
<tr style={{background:rBg}}><td style={{...r1,fontFamily:FONT.heading,fontSize:13,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.redSL,fontWeight:700}}>Ingresos netos</td><CI rz/></tr>
<tr style={{background:rBg}} {...hv}><td style={{...r1,color:COLORS.mut,fontSize:11}}>Pedidos · <span style={{color:COLORS.warn}}>TM Bruto</span> / <span style={{color:COLORS.ok}}>TM Neto</span></td><CTM rz/></tr>
<tr style={{background:rBg}} {...hv}><td style={{...r1,color:COLORS.mut,fontSize:11}}>€/día abierto</td><Cells fn={mD} rz/></tr>
<tr style={{background:rBg}}><td style={{...r1,fontFamily:FONT.heading,fontSize:13,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.ok,fontWeight:700,borderLeft:`3px solid ${COLORS.ok}`}}><span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:COLORS.ok,marginRight:6,verticalAlign:'middle'}}/>Margen bruto</td><Cells fn={mB} pctFn={ms=>po(mB(ms),iM(ms))} sign vc={COLORS.ok} rz/></tr>
<tr style={{background:rBg}} {...hv}><td style={{...r1,fontWeight:600}}>Gastos fijos</td><Cells fn={gF} pctFn={ms=>po(gF(ms),iM(ms))} rz alertMax={50}/></tr>
<tr style={{background:rBg}}><td style={{...r1,paddingLeft:22,fontSize:10,color:COLORS.mut,fontStyle:'italic'}}>% s/Facturación bruta</td><Cells fn={ms=>po(gF(ms),fB(ms))} pct rz/></tr>
<tr style={{background:rBg}}><td style={{...r1,paddingLeft:22,fontSize:10,color:COLORS.mut,fontStyle:'italic'}}>por pedido</td><CR fn={ms=>{const p=ped(ms);return p?gF(ms)/p:0}} rz/></tr>
<tr style={{background:rBg}} {...hv}><td style={{...r1,fontWeight:600}}>Gastos variables</td><Cells fn={gV} pctFn={ms=>po(gV(ms),iM(ms))} rz alertMax={60}/></tr>
<tr style={{background:rBg}}><td style={{...r1,paddingLeft:22,fontSize:10,color:COLORS.mut,fontStyle:'italic'}}>por pedido</td><CR fn={ms=>{const p=ped(ms);return p?gV(ms)/p:0}} rz/></tr>
<tr><td style={{...tTd,background:rBg,borderLeft:`3px solid ${COLORS.redSL}`}}>Total gastos</td><Cells fn={gT} pctFn={ms=>po(gT(ms),iM(ms))} alertMax={100} rz/></tr>
<tr style={{background:rBg}}><td style={{...r1,paddingLeft:22,fontSize:10,color:COLORS.mut,fontStyle:'italic'}}>por pedido</td><CR fn={ms=>{const p=ped(ms);return p?gT(ms)/p:0}} rz/></tr>
<tr><td style={{...bTd,background:rBg,borderLeft:`3px solid #1E5BCC`}}>Mínimo para cubrir fijos</td><Cells fn={gF} rz/></tr>
<tr><td style={{...rTd,background:rBg,fontSize:14,borderLeft:`3px solid ${COLORS.ok}`}}>Resultado <Sp fn={res}/></td><Cells fn={res} sign rz/></tr>
<tr style={{background:rBg}} {...hv}><td style={{...r1,fontFamily:FONT.heading,fontSize:10,letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:700}}>Coste directo <span style={{color:COLORS.mut,fontSize:9,fontWeight:400}}>(Producto + Equipo · obj &lt;60%)</span></td><Cells fn={cd} pct rz alertMax={60}/></tr>
{sep}
{sH('Distribución de gastos · % sobre Ingresos netos')}{rA() as any}
{grupos.map(g=>{const bn=gB(g.id);const sc=sC(po(gP(g.id,ALL),iM(ALL)),bn);const bI=bn?` (${bn.pct_min}-${bn.pct_max}%)`:'';const nm=LBL[g.id]||g.nombre;const b=aB();return<tr key={g.id} style={{background:b}} {...hv}><td style={gTd}><span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:sc,marginRight:5,verticalAlign:'middle'}}/>{nm}<span style={{color:COLORS.mut,fontSize:9,fontWeight:400,letterSpacing:'1px',textDecoration:'underline dashed',cursor:'pointer'}}>{bI}</span></td><CB fn={ms=>po(gP(g.id,ms),iM(ms))} max={bn?bn.pct_max:20}/></tr>})}
<tr><td style={tTd}>Total gastos</td><Cells fn={ms=>po(gT(ms),iM(ms))} pct alertMax={100}/></tr>
<tr><td style={rTd}>Resultado <Sp fn={ms=>po(res(ms),iM(ms))}/></td><Cells fn={ms=>po(res(ms),iM(ms))} pct sign/></tr>
{sep}
{sH('Detalle por categoría',<button onClick={()=>{const nxt=!allOpen;const nv:Record<string,boolean>={};['1','2.1','2.2','2.3','2.4'].forEach(k=>nv[k]=nxt);sD(nv);sAO(nxt)}} style={{float:'right',padding:'3px 10px',borderRadius:5,border:`0.5px solid ${COLORS.brd}`,background:COLORS.card,fontFamily:FONT.body,fontSize:10,color:COLORS.mut,cursor:'pointer'}}>{allOpen?'▴ Colapsar todo':'▾ Expandir todo'}</button>)}{rA() as any}
<tr style={{cursor:'pointer'}} onClick={()=>sD(p=>({...p,'1':!p['1']}))}><td style={gTd}>{det['1']?'▾':'▸'} 1. Ingresos</td><Cells fn={iM}/></tr>
{det['1']&&ingC.map(c=>{const b=aB();return<tr key={c.id} style={{background:b}} {...hv}><td style={{...td1,paddingLeft:24,fontSize:12}}>{c.nombre}</td><Cells fn={ms=>sumMeses(ingresos[c.id]||{},ms)} pctFn={ms=>po(sumMeses(ingresos[c.id]||{},ms),iM(ms))}/></tr>})}
{sep}
{grupos.map(g=>{const bn=gB(g.id);const bL=bn?` (${bn.pct_min}-${bn.pct_max}%)`:'';const sN=cN2.filter(c=>c.parent_id===g.id);const sc=sC(po(gP(g.id,ALL),iM(ALL)),bn);const nm=LBL[g.id]||g.nombre;const op=!!det[g.id];return[
<tr key={`h-${g.id}`} style={{cursor:'pointer'}} onClick={()=>sD(p=>({...p,[g.id]:!p[g.id]}))}><td style={gTd}>{op?'▾':'▸'} {g.id} {nm}<span style={{color:COLORS.mut,fontSize:9,fontWeight:400}}>{bL}</span></td><Cells fn={ms=>gP(g.id,ms)} pctFn={ms=>po(gP(g.id,ms),iM(ms))}/></tr>,
...(op?sN.flatMap(sub=>{const ch=cCh(sub.id);return[
<tr key={sub.id} style={{background:aB()}} {...hv}><td style={{...td1,paddingLeft:24,fontSize:12}}>{sub.nombre}</td><Cells fn={ms=>sumCatMeses(gastos,sub.id,ms)} pctFn={ms=>po(sumCatMeses(gastos,sub.id,ms),iM(ms))}/></tr>,
...ch.map(c=>{return<tr key={c.id} style={{background:aB()}} {...hv}><td style={{...td1,paddingLeft:36,color:COLORS.mut,fontSize:11}}>{c.nombre}</td><Cells fn={ms=>sumMeses(gastos[c.id]||{},ms)} pctFn={ms=>po(sumMeses(gastos[c.id]||{},ms),iM(ms))}/></tr>})].filter(Boolean)}):[]),
<tr key={`t-${g.id}`}><td style={gTd}><span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:sc,marginRight:5,verticalAlign:'middle'}}/>{g.id} Total {nm}</td><Cells fn={ms=>gP(g.id,ms)} pctFn={ms=>po(gP(g.id,ms),iM(ms))}/></tr>,sep].filter(Boolean)}).flat()}
<tr><td style={tTd}>Total gastos</td><Cells fn={gT} pctFn={ms=>po(gT(ms),iM(ms))} alertMax={100}/></tr>
<tr><td style={rTd}>Resultado</td><Cells fn={res} sign pctFn={ms=>po(res(ms),iM(ms))}/></tr>
</tbody></table></div></div></div>)}
