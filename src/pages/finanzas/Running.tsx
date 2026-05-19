import{useState,useMemo}from'react'
import{useRunningAnual,sumMeses,sumCatMeses}from'@/hooks/useRunningAnual'
import{useTitular}from'@/contexts/TitularContext'
import{COLORS,FONT,CARDS,TABS_PILL}from'@/components/panel/resumen/tokens'
const MN=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const QM:Record<number,number[]>={1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]}
const ALL=[1,2,3,4,5,6,7,8,9,10,11,12]
const BM:Record<string,string>={'2.1':'PRODUCTO','2.2':'RRHH','2.3':'ALQUILER','2.41':'MARKETING','2.42':'INTERNET_VENTAS','2.43':'ADMIN_GENERALES','2.44':'SUMINISTROS'}
const LBL:Record<string,string>={'2.1':'Producto','2.2':'Equipo','2.3':'Local','2.4':'Controlables'}
const COM:Record<string,number>={uber:.30,glovo:.32,je:.28,web:.05,directa:0}
const cM=new Date().getMonth()+1,BL='#1E5BCC'
const QBG=['rgba(30,91,204,.04)','rgba(29,158,117,.04)','rgba(245,166,35,.04)','rgba(176,29,35,.04)']
const QHD=['rgba(30,91,204,.12)','rgba(29,158,117,.12)','rgba(245,166,35,.12)','rgba(176,29,35,.12)']
const QCL=['#1E5BCC','#1D9E75','#f5a623','#B01D23']
const fI=(n:number):string=>{if(!n)return'—';const a=Math.abs(n);return(n<0?'−':'')+Math.round(a).toLocaleString('es-ES',{useGrouping:true})}
const fD=(n:number):string=>{if(!n)return'—';const a=Math.abs(n);return(n<0?'−':'')+a.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:true})}
const fP=(v:number)=>v?`${v.toFixed(1)}%`:'—'
const po=(p:number,t:number)=>t?(p/t)*100:0
const CA=`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`
export default function Running(){
const{filtro,titulares}=useTitular()
const[año,sA]=useState(2026)
const[buscar,sBu]=useState('')
const[qO,sQ]=useState<Record<number,boolean>>(()=>{const q=Math.ceil(cM/3);return{1:true,2:q>=2,3:q>=3,4:q>=4}})
const[det,sD]=useState<Record<string,boolean>>({'1':true,'2.1':true,'2.2':true,'2.3':true,'2.4':true})
const[aO,sAO]=useState(true)
const tId=filtro==='unificado'?null:filtro
const{ingresos,gastos,brutos,diasOp,categorias,benchmarks,loading}=useRunningAnual(año,tId)
const iT=(ms:number[])=>{let s=0;for(const[c,m]of Object.entries(ingresos)){if(c.startsWith('1.'))s+=sumMeses(m,ms)};return s}
const gP=(p:string,ms:number[])=>sumCatMeses(gastos,p,ms)
const gT=(ms:number[])=>gP('2.',ms)
const re=(ms:number[])=>iT(ms)-gT(ms)
const gB=(g:string)=>{const k=BM[g];return k?benchmarks.find(b=>b.categoria===k):null}
const sC=(p:number,b:{pct_min:number;pct_max:number}|null|undefined)=>{if(!b)return COLORS.mut;if(p<=b.pct_max)return COLORS.ok;if(p<=b.pct_max*1.2)return COLORS.warn;return COLORS.err}
const tQ=(q:number)=>sQ(p=>({...p,[q]:!p[q]}))
const gF=(ms:number[])=>gP('2.2',ms)+gP('2.3',ms)
const gV=(ms:number[])=>gP('2.1',ms)+gP('2.4',ms)
const pe=(ms:number[])=>ms.reduce((s,m)=>s+(brutos[m]?.pedidos||0),0)
const fB=(ms:number[])=>ms.reduce((s,m)=>s+(brutos[m]?.total||0),0)
const nE=(ms:number[])=>ms.reduce((s,m)=>{const b=brutos[m];if(!b)return s;return s+b.uber*(1-COM.uber)+b.glovo*(1-COM.glovo)+b.je*(1-COM.je)+b.web*(1-COM.web)+b.directa*(1-COM.directa)},0)
const iM=(ms:number[])=>{const r=iT(ms);return r||nE(ms)}
const mB=(ms:number[])=>iM(ms)-gP('2.1',ms)
const oD=(ms:number[])=>{const d=ms.reduce((s,m)=>s+(diasOp[m]||0),0);return d?iM(ms)/d:0}
const tB=(ms:number[])=>{const p=pe(ms);return p?fB(ms)/p:0}
const tN=(ms:number[])=>{const p=pe(ms);return p?iM(ms)/p:0}
const cD=(ms:number[])=>{const i=iM(ms);return i?(gP('2.1',ms)+gP('2.2',ms))/i*100:0}
const vi=(l:string)=>buscar.length<2||l.toLowerCase().includes(buscar.toLowerCase())
type Col={label:string;ms:number[];isQ?:boolean;qn?:number;isY?:boolean;hid?:boolean;isCur?:boolean}
const cols=useMemo(()=>{const c:Col[]=[];for(let q=1;q<=4;q++){QM[q].forEach(m=>c.push({label:MN[m-1],ms:[m],hid:!qO[q],isCur:m===cM}));c.push({label:`${qO[q]?'▾':'▸'} ${q}T`,ms:QM[q],isQ:true,qn:q})};c.push({label:'AÑO',ms:ALL,isY:true});return c},[qO])
const vc=cols.filter(c=>!c.hid||c.isY)
const cN2=useMemo(()=>categorias.filter(c=>c.nivel===2),[categorias])
const cCh=(pid:string)=>categorias.filter(c=>c.parent_id===pid&&c.nivel===3).filter(c=>ALL.some(m=>(gastos[c.id]?.[m]||0)>0)).sort((a,b)=>sumMeses(gastos[b.id]||{},ALL)-sumMeses(gastos[a.id]||{},ALL))
const cQ=(c:Col)=>{for(let q=1;q<=4;q++){if(c.isQ&&c.qn===q)return q;if(!c.isQ&&!c.isY&&QM[q].includes(c.ms[0]))return q};return 0}
const thC=(c:Col):React.CSSProperties=>{const q=cQ(c);const qy=c.isQ||c.isY;return{fontFamily:FONT.heading,fontSize:11,fontWeight:qy?700:500,letterSpacing:'1.5px',textTransform:'uppercase',textAlign:'right',padding:'5px 2px',borderBottom:`1px solid ${COLORS.brd}`,whiteSpace:'nowrap',position:'sticky',top:0,zIndex:2,cursor:c.isQ?'pointer':'default',userSelect:'none',color:qy?(c.isY?COLORS.redSL:QCL[q-1]):COLORS.mut,background:qy?(c.isY?`${COLORS.redSL}14`:QHD[q-1]):(q?QBG[q-1]:COLORS.bg)}}
const th1:React.CSSProperties={fontFamily:FONT.heading,fontSize:11,fontWeight:600,letterSpacing:'1.5px',color:COLORS.mut,textTransform:'uppercase',textAlign:'left',padding:'5px 6px',background:COLORS.bg,borderBottom:`1px solid ${COLORS.brd}`,whiteSpace:'nowrap',position:'sticky',left:0,top:0,zIndex:4,minWidth:200}
const thP=(c:Col):React.CSSProperties=>({...thC(c),fontSize:9,color:COLORS.mut+'70',minWidth:28,padding:'5px 1px'})
const td0=(c:Col):React.CSSProperties=>{const q=cQ(c);const qy=c.isQ||c.isY;return{padding:'2px 2px',fontSize:15,fontFamily:FONT.body,color:COLORS.sec,borderBottom:`0.5px solid ${COLORS.brd}18`,whiteSpace:'nowrap',textAlign:'right',verticalAlign:'middle',fontVariantNumeric:'tabular-nums',lineHeight:1.2,fontWeight:qy?600:400,background:qy?(c.isY?`${COLORS.redSL}08`:QBG[q-1]):(q?QBG[q-1]:undefined)}}
const t1:React.CSSProperties={padding:'2px 6px',fontSize:14,fontFamily:FONT.body,color:COLORS.sec,borderBottom:`0.5px solid ${COLORS.brd}18`,whiteSpace:'nowrap',textAlign:'left',position:'sticky',left:0,zIndex:1,verticalAlign:'middle',background:'#fff'}
const tdP=(c:Col):React.CSSProperties=>({...td0(c),fontSize:11,color:COLORS.mut+'90',padding:'2px 1px',minWidth:28})
const nZ=(c:Col,rz?:boolean):React.CSSProperties=>({fontFamily:FONT.heading,fontSize:c.isY?(rz?22:18):(c.isQ?(rz?19:16):(c.isCur?(rz?18:16):(rz?17:15))),fontWeight:c.isY?700:(c.isQ||c.isCur?600:500),letterSpacing:'0.3px'})
const RB='#fdf6ed'
const r1=(bc?:string):React.CSSProperties=>({...t1,background:RB,borderLeft:`3px solid ${bc||COLORS.redSL}`,fontSize:14})
const rC=(c:Col):React.CSSProperties=>({...td0(c),background:c.isY?`${COLORS.redSL}10`:(c.isQ?td0(c).background:RB)})
const ingLabel:React.CSSProperties={...r1(),fontFamily:FONT.heading,fontSize:14,letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:600}
const Cells=({fn,sign,pct,pctFn,alertMax,vc:vcl,rz,tip}:{fn:(ms:number[])=>number;sign?:boolean;pct?:boolean;pctFn?:(ms:number[])=>number;alertMax?:number;vc?:string;rz?:boolean;tip?:string})=>(<>{vc.map((c,i)=>{const v=fn(c.ms);const cl=vcl||(sign?(v>0?COLORS.ok:v<0?COLORS.err:COLORS.mut):undefined);const pr=sign&&v>0?'+':'';const st=rz?rC(c):td0(c);const vt=<td key={i} style={{...st,color:cl||st.color,...(v&&!pct?nZ(c,rz):{}),fontFamily:v&&!pct?FONT.heading:st.fontFamily}}>{pct?fP(v):v?`${pr}${fI(v)}`:'—'}</td>;if(pctFn){const pv=pctFn(c.ms);const ov=alertMax&&pv>alertMax;return[vt,<td key={`p${i}`} style={{...tdP(c),color:ov?COLORS.err:undefined,fontWeight:ov?600:undefined,background:rz?RB:tdP(c).background}} title={tip}>{pv?(ov?<span style={{display:'inline-flex',alignItems:'center',gap:1}}><span style={{fontSize:10,animation:'pulse 2s infinite'}}>⚠</span>{pv.toFixed(1)}%</span>:`${pv.toFixed(1)}%`):'—'}</td>]}return vt})}</>)
const CTM=({rz:r}:{rz?:boolean})=>(<>{vc.map((c,i)=>{const p=pe(c.ms);const tb=tB(c.ms);const tn=tN(c.ms);const st=r?rC(c):td0(c);const sz=c.isY?18:(c.isQ?16:15);return[<td key={i} style={{...st,fontFamily:FONT.heading,fontSize:sz,fontWeight:c.isY?700:(c.isQ?600:500)}}>{p?<><span style={{color:BL}}>{fI(p)}</span>{' '}<span style={{color:COLORS.warn,fontSize:sz}}>{fD(tb)}</span><span style={{color:COLORS.mut,fontSize:sz-4}}>/</span><span style={{color:COLORS.ok,fontSize:sz}}>{fD(tn)}</span></>:'—'}</td>,<td key={`p${i}`} style={{...tdP(c),background:r?RB:tdP(c).background}}/>]})}</>)
const CI=({rz:r}:{rz?:boolean})=>(<>{vc.map((c,i)=>{const rv=iT(c.ms);const e=nE(c.ms);const v=rv||e;const es=!rv&&e>0;const st=r?rC(c):td0(c);return[<td key={i} style={{...st,...nZ(c,r),color:COLORS.ok,fontStyle:es?'italic':undefined}}>{v?fI(v):'—'}{es&&<span style={{fontSize:9,color:COLORS.mut,marginLeft:2}}>(est.)</span>}</td>,<td key={`p${i}`} style={{...tdP(c),background:r?RB:tdP(c).background}}/>]})}</>)
const CR=({fn,rz:r}:{fn:(ms:number[])=>number;rz?:boolean})=>(<>{vc.map((c,i)=>{const v=fn(c.ms);const st=r?rC(c):td0(c);return[<td key={i} style={{...st,fontSize:13,color:COLORS.mut,fontStyle:'italic',fontFamily:FONT.heading}}>{v?fD(v):'—'}</td>,<td key={`p${i}`} style={{...tdP(c),background:r?RB:tdP(c).background}}/>]})}</>)
const CB=({fn,max}:{fn:(ms:number[])=>number;max:number})=>(<>{vc.map((c,i)=>{const v=fn(c.ms);const bc=!v?COLORS.err:(v<=max*.5?COLORS.ok:(v<=max?COLORS.warn:COLORS.err));const bw=v?Math.min(v/max*100,100):100;return[<td key={i} style={{...td0(c),...nZ(c),color:v>max?COLORS.err:undefined}}>{v?fP(v):'—'}<div style={{width:'100%',height:5,borderRadius:3,background:COLORS.err+'30',marginTop:1,overflow:'hidden'}}><div style={{height:'100%',borderRadius:3,background:bc,width:`${bw}%`}}/></div></td>,<td key={`p${i}`} style={tdP(c)}/>]})}</>)
const Sp=({fn}:{fn:(ms:number[])=>number})=>{const vs=ALL.map(m=>fn([m]));const mx=Math.max(...vs.map(v=>Math.abs(v)),1);return<span style={{display:'inline-flex',alignItems:'flex-end',gap:1,height:16,verticalAlign:'middle',marginLeft:6}}>{vs.map((v,i)=><span key={i} style={{width:3,borderRadius:'1px 1px 0 0',height:`${Math.max(Math.abs(v)/mx*16,v?1:0)}px`,background:v>0?COLORS.ok:v<0?COLORS.err:COLORS.brd}}/>)}</span>}
if(loading)return(<div style={{background:COLORS.bg,padding:'20px 24px',minHeight:'100vh'}}><h2 style={{color:COLORS.redSL,fontFamily:FONT.heading,fontSize:22,fontWeight:600,letterSpacing:'3px',margin:0,textTransform:'uppercase'}}>Running {año}</h2><p style={{fontFamily:FONT.body,fontSize:13,color:COLORS.mut,marginTop:4}}>Cargando…</p></div>)
const grupos=categorias.filter(c=>c.nivel===1&&c.id.startsWith('2.'))
const ingC=categorias.filter(c=>c.parent_id==='1.1'&&c.nivel===3)
let ri=0;const aB=()=>{const b=ri%2===0?'#fff':'#fafaf8';ri++;return b};const rA=()=>{ri=0}
const hv={onMouseEnter:(e:React.MouseEvent<HTMLTableRowElement>)=>{e.currentTarget.style.background=`${COLORS.bg}60`},onMouseLeave:(e:React.MouseEvent<HTMLTableRowElement>)=>{e.currentTarget.style.background=''}}
const sH=(l:string,cl:string,x?:React.ReactNode)=><tr><td colSpan={99} style={{...t1,background:COLORS.bg,fontFamily:FONT.heading,fontSize:12,letterSpacing:'2px',textTransform:'uppercase',color:cl,padding:'8px 6px 3px',borderBottom:`1.5px solid ${cl}40`,borderLeft:`3px solid ${cl}`,fontWeight:700}}>{l}{x}</td></tr>
const gR:React.CSSProperties={...t1,fontFamily:FONT.heading,fontSize:13,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.redSL,fontWeight:600,background:`${COLORS.redSL}06`}
const tR:React.CSSProperties={...t1,fontFamily:FONT.heading,fontSize:14,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.redSL,fontWeight:700,background:`${COLORS.redSL}0C`,borderTop:`2px solid ${COLORS.brd}`}
const rR:React.CSSProperties={...t1,fontFamily:FONT.heading,fontSize:15,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.ok,fontWeight:700,background:`${COLORS.ok}0C`,borderTop:`2px solid ${COLORS.brd}`}
const sp=<tr><td colSpan={99} style={{height:6,border:'none',background:COLORS.bg,padding:0}}/></tr>
const pS:React.CSSProperties={...TABS_PILL.inactive,appearance:'none' as const,paddingRight:22,backgroundImage:`url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%237a8090' fill='none' stroke-width='1.5'/%3E%3C/svg%3E")`,backgroundRepeat:'no-repeat',backgroundPosition:'right 6px center',cursor:'pointer'}
return(<div style={{background:COLORS.bg,padding:'20px 24px',minHeight:'100vh'}}><style>{CA}</style>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:6}}>
<h2 style={{color:COLORS.redSL,fontFamily:FONT.heading,fontSize:22,fontWeight:600,letterSpacing:'3px',margin:0,textTransform:'uppercase'}}>RUNNING {año}</h2>
<div style={{display:'flex',gap:4,alignItems:'center'}}>
<input placeholder="🔍 Buscar..." value={buscar} onChange={e=>sBu(e.target.value)} style={{padding:'5px 10px',borderRadius:8,border:`0.5px solid ${COLORS.brd}`,background:COLORS.card,fontFamily:FONT.body,fontSize:12,color:COLORS.pri,width:140,outline:'none'}}/>
<div style={{...TABS_PILL.container}}><select value={año} onChange={e=>sA(Number(e.target.value))} style={pS}>{[2026,2025,2024].map(a=><option key={a} value={a}>{a}</option>)}</select></div>
<span style={{color:COLORS.brd}}>|</span>
<div style={{...TABS_PILL.container}}>{[{id:null as string|null,label:'Todos'},...titulares.map(t=>({id:t.id as string|null,label:t.nombre}))].map(t=><button key={t.id||'all'} style={(t.id===tId||(t.id===null&&!tId))?TABS_PILL.active:TABS_PILL.inactive} onClick={()=>{}}>{t.label}</button>)}</div>
</div></div>
<div style={{...CARDS.std,padding:0,overflow:'hidden'}}><div style={{overflowX:'auto'}}>
<table style={{width:'100%',borderCollapse:'separate',borderSpacing:0,minWidth:1100}}>
<thead><tr><th style={th1}>PyG</th>{vc.map((c,i)=>[<th key={i} style={thC(c)} onClick={c.qn?()=>tQ(c.qn!):undefined}>{c.label}</th>,<th key={`p${i}`} style={thP(c)}>%</th>])}</tr></thead>
<tbody>
{sH('INGRESOS',COLORS.redSL)}{rA() as any}
<tr style={{background:RB}} {...hv}><td style={{...ingLabel,color:COLORS.sec}}>1.2 Facturación bruta</td><Cells fn={fB} rz/></tr>
<tr style={{background:RB}}><td style={{...ingLabel,color:COLORS.ok}}>1.1 Ingresos netos</td><CI rz/></tr>
<tr style={{background:RB}} {...hv}><td style={{...r1(),color:COLORS.mut}}><span style={{color:BL,fontWeight:600}}>Pedidos</span> · <span style={{color:COLORS.warn}}>TM Bruto</span> / <span style={{color:COLORS.ok}}>TM Neto</span></td><CTM rz/></tr>
<tr style={{background:RB}} {...hv}><td style={{...r1(),color:COLORS.mut}}>Objetivo diario</td><Cells fn={oD} rz/></tr>
{sp}
{sH('GASTOS',COLORS.err)}{rA() as any}
<tr style={{background:RB}} {...hv}><td style={{...r1(COLORS.err),fontFamily:FONT.heading,fontSize:14,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.sec,fontWeight:600}}>Gastos fijos</td><Cells fn={gF} pctFn={ms=>po(gF(ms),fB(ms))} rz tip="% sobre Facturación bruta"/></tr>
<tr style={{background:RB}}><td style={{...r1(COLORS.err),paddingLeft:18,fontSize:13,color:COLORS.mut,fontStyle:'italic'}}>por pedido</td><CR fn={ms=>{const p=pe(ms);return p?gF(ms)/p:0}} rz/></tr>
<tr style={{background:RB}} {...hv}><td style={{...r1(COLORS.err),fontFamily:FONT.heading,fontSize:14,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.sec,fontWeight:600}}>Gastos variables</td><Cells fn={gV} pctFn={ms=>po(gV(ms),fB(ms))} rz tip="% sobre Facturación bruta"/></tr>
<tr style={{background:RB}}><td style={{...r1(COLORS.err),paddingLeft:18,fontSize:13,color:COLORS.mut,fontStyle:'italic'}}>por pedido</td><CR fn={ms=>{const p=pe(ms);return p?gV(ms)/p:0}} rz/></tr>
<tr><td style={{...tR,background:RB,borderLeft:`3px solid ${COLORS.err}`}}>Total gastos</td><Cells fn={gT} pctFn={ms=>po(gT(ms),fB(ms))} rz tip="% sobre Facturación bruta"/></tr>
{sp}
<tr><td style={{...rR,background:RB,borderLeft:`3px solid ${COLORS.ok}`,fontSize:16}}>Resultado <Sp fn={re}/></td><Cells fn={re} sign rz/></tr>
{sp}
{sH('Distribución de gastos · % s/Ingresos netos',COLORS.warn)}{rA() as any}
{grupos.map(g=>{const bn=gB(g.id);const sc=sC(po(gP(g.id,ALL),iM(ALL)),bn);const bI=bn?` (${bn.pct_min}-${bn.pct_max}%)`:'';const nm=LBL[g.id]||g.nombre;const b=aB();return<tr key={g.id} style={{background:b}} {...hv}><td style={{...gR,borderLeft:`3px solid ${COLORS.warn}`}}><span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:sc,marginRight:5,verticalAlign:'middle'}}/>{nm}<span style={{color:COLORS.mut,fontSize:10,fontWeight:400,textDecoration:'underline dashed',cursor:'pointer'}}>{bI}</span></td><CB fn={ms=>po(gP(g.id,ms),iM(ms))} max={bn?bn.pct_max:20}/></tr>})}
<tr><td style={{...tR,borderLeft:`3px solid ${COLORS.warn}`}}>Total gastos</td><Cells fn={ms=>po(gT(ms),iM(ms))} pct/></tr>
<tr><td style={{...rR,borderLeft:`3px solid ${COLORS.warn}`}}>Resultado <Sp fn={ms=>po(re(ms),iM(ms))}/></td><Cells fn={ms=>po(re(ms),iM(ms))} pct sign/></tr>
{sp}
{sH('Indicadores',COLORS.ok)}{rA() as any}
<tr style={{background:RB}}><td style={{...r1(COLORS.ok),fontFamily:FONT.heading,fontSize:14,textTransform:'uppercase',color:COLORS.ok,fontWeight:700}}>Margen bruto</td><Cells fn={mB} pctFn={ms=>po(mB(ms),iM(ms))} sign vc={COLORS.ok} rz/></tr>
<tr><td style={{...t1,fontFamily:FONT.heading,fontSize:13,textTransform:'uppercase',color:BL,fontWeight:600,background:'rgba(30,91,204,.04)',borderTop:'2px dashed #1E5BCC',borderBottom:'2px dashed #1E5BCC',borderLeft:`3px solid ${BL}`}}>Break-even</td><Cells fn={gF}/></tr>
<tr style={{background:RB}} {...hv}><td style={{...r1(COLORS.ok),fontFamily:FONT.heading,fontSize:13,textTransform:'uppercase',fontWeight:700}}>Coste directo <span style={{color:COLORS.mut,fontSize:10,fontWeight:400}}>(Producto + Equipo · obj &lt;60%)</span></td><Cells fn={cD} pct rz alertMax={60}/></tr>
<tr><td colSpan={99} style={{height:14,border:'none',background:COLORS.bg,padding:0}}/></tr>
{sH('Detalle por categoría',COLORS.mut,<button onClick={()=>{const n=!aO;const nv:Record<string,boolean>={};['1','2.1','2.2','2.3','2.4'].forEach(k=>nv[k]=n);sD(nv);sAO(n)}} style={{float:'right',padding:'2px 8px',borderRadius:5,border:`0.5px solid ${COLORS.brd}`,background:COLORS.card,fontFamily:FONT.body,fontSize:11,color:COLORS.mut,cursor:'pointer'}}>{aO?'▴ Colapsar':'▾ Expandir'}</button>)}{rA() as any}
<tr style={{cursor:'pointer'}} onClick={()=>sD(p=>({...p,'1':!p['1']}))}><td style={gR}>{det['1']?'▾':'▸'} 1 · Ingresos por operación</td><Cells fn={iM}/></tr>
{det['1']&&<>
<tr style={{background:aB()}}><td style={{...t1,paddingLeft:14,fontWeight:600}}>1.1 · Ingresos netos por ventas</td><Cells fn={iT}/></tr>
{ingC.filter(c=>vi(c.nombre)).map(c=>{const b=aB();return<tr key={c.id} style={{background:b}} {...hv}><td style={{...t1,paddingLeft:26}}>{c.id} · {c.nombre}</td><Cells fn={ms=>sumMeses(ingresos[c.id]||{},ms)} pctFn={ms=>po(sumMeses(ingresos[c.id]||{},ms),iM(ms))}/></tr>})}
<tr style={{background:aB()}}><td style={{...t1,paddingLeft:14,fontWeight:600}}>1.2 · Facturación bruta por ventas</td><Cells fn={fB}/></tr>
</>}{sp}
{grupos.map(g=>{const bn=gB(g.id);const bL=bn?` (${bn.pct_min}-${bn.pct_max}%)`:'';const sN=cN2.filter(c=>c.parent_id===g.id);const sc=sC(po(gP(g.id,ALL),iM(ALL)),bn);const nm=LBL[g.id]||g.nombre;const op=!!det[g.id];return[
<tr key={`h-${g.id}`} style={{cursor:'pointer'}} onClick={()=>sD(p=>({...p,[g.id]:!p[g.id]}))}><td style={gR}>{op?'▾':'▸'} {g.id} · {nm}<span style={{color:COLORS.mut,fontSize:10,fontWeight:400}}>{bL}</span></td><Cells fn={ms=>gP(g.id,ms)} pctFn={ms=>po(gP(g.id,ms),iM(ms))}/></tr>,
...(op?sN.flatMap(sub=>{const ch=cCh(sub.id);return[
<tr key={sub.id} style={{background:aB()}}><td style={{...t1,paddingLeft:14,fontWeight:600}}>{sub.id} · {sub.nombre}</td><Cells fn={ms=>sumCatMeses(gastos,sub.id,ms)} pctFn={ms=>po(sumCatMeses(gastos,sub.id,ms),iM(ms))}/></tr>,
...ch.filter(c=>vi(c.nombre)).map(c=><tr key={c.id} style={{background:aB()}} {...hv}><td style={{...t1,paddingLeft:28,color:COLORS.mut,fontSize:13}}>{c.id} · {c.nombre}</td><Cells fn={ms=>sumMeses(gastos[c.id]||{},ms)} pctFn={ms=>po(sumMeses(gastos[c.id]||{},ms),iM(ms))}/></tr>),
<tr key={`st-${sub.id}`} style={{background:'#fafaf8'}}><td style={{...t1,paddingLeft:14,fontWeight:600,color:COLORS.mut,fontSize:12}}>Subtotal {sub.nombre}</td><Cells fn={ms=>sumCatMeses(gastos,sub.id,ms)}/></tr>
].filter(Boolean)}):[]),
...(op?[<tr key={`t-${g.id}`}><td style={gR}><span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:sc,marginRight:5,verticalAlign:'middle'}}/>{g.id} Total {nm}</td><Cells fn={ms=>gP(g.id,ms)} pctFn={ms=>po(gP(g.id,ms),iM(ms))}/></tr>]:[]),sp].filter(Boolean)}).flat()}
<tr><td style={tR}>Total gastos</td><Cells fn={gT} pctFn={ms=>po(gT(ms),iM(ms))} alertMax={100}/></tr>
<tr><td style={rR}>Resultado</td><Cells fn={re} sign pctFn={ms=>po(re(ms),iM(ms))}/></tr>
</tbody></table></div></div></div>)}
