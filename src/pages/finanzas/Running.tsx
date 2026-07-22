import{useState,useMemo,useRef,useEffect}from'react'
import{useRunningAnual,sumMeses,sumCatMeses,calcNetoCanal}from'@/hooks/useRunningAnual'
import{calcDesglosePorCanal,type DesgloseCanal}from'@/lib/panel/calcNetoPlataforma'
import{OSW,LEX,INK,CREMA,CLARO,VERDE,ROJO,NAR,AZUL,AMA,GRANATE,GRIS,SHADOW,BORDER_CARD,CORP,CLARA,eyebrow}from'@/styles/neobrutal'
import{supabase}from'@/lib/supabase'
const MN=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const QM:Record<number,number[]>={1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]}
const ALL=[1,2,3,4,5,6,7,8,9,10,11,12]
const BM:Record<string,string>={'2.1':'PRODUCTO','2.2':'RRHH','2.3':'ALQUILER','2.4':'CONTROLABLES'}
const LBL:Record<string,string>={'2.1':'Producto','2.2':'Equipo','2.3':'Local','2.4':'Controlables'}
const RATIO_COLORS:Record<string,string>={'margen':VERDE,'food':NAR,'labor':AZUL,'ratio':GRANATE,'coste':ROJO,'neto':VERDE,'directo':NAR}
const BLANCO='#ffffff',MUT='#5a4f3a'
const BRD_V='2px solid rgba(20,15,8,.14)'
const DESV_PCT=5
const semColor=(pct:number)=>pct>=50?VERDE:pct>=25?NAR:ROJO
const fI=(n:number)=>{if(!n)return'—';const a=Math.abs(n);return(n<0?'−':'')+Math.round(a).toLocaleString('es-ES',{useGrouping:true})}
const fD=(n:number)=>{if(!n)return'—';const a=Math.abs(n);return(n<0?'−':'')+a.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:true})}
const fP=(v:number)=>v?`${v.toFixed(1)}%`:'—'
const po=(p:number,t:number)=>t?(p/t)*100:0
type Col={label:string;ms:number[];isQ?:boolean;qn?:number;isY?:boolean}
type ResRow={plataforma:string;mes:number;año:number;bruto:number;comisiones:number;fees:number;cargos_promocion:number;neto_real_cobrado:number;pedidos?:number}
const EstB=()=><span style={{fontFamily:OSW,fontSize:9,fontWeight:700,border:'1.5px solid #5a4f3a',color:'#3d362a',padding:'0 3px',marginLeft:3,textTransform:'uppercase',verticalAlign:'middle'}}>est</span>
export function Running({ embedded = false }: { embedded?: boolean } = {}){
const[año,sA]=useState(2026)
const[buscar,sBu]=useState('')
const[det,sD]=useState<Record<string,boolean>>({'1':true,'2.1':true,'2.2':true,'2.3':true,'2.4':true})
const[aO,sAO]=useState(true)
const[bloque,sBl]=useState<Record<string,boolean>>({ing:true,dist:true,ratios:true})
const[allBl,sAllBl]=useState(true)
const[dPlat,sDP]=useState(true)
const[platOpen,sPO]=useState<Record<string,boolean>>({uber:true,glovo:true,je:true,web:true})
const[resumenes,sRes]=useState<ResRow[]>([])
const mainRef=useRef<HTMLDivElement>(null)
const topRef=useRef<HTMLDivElement>(null)
const{ingresos,gastos,facturacionFutura,brutos,pedidosCanal,adsPlataforma,categorias,benchmarks,comisiones,feesFijos,marcasActivas,objetivosMensuales,loading}=useRunningAnual(año,null)
useEffect(()=>{(async()=>{const{data}=await supabase.from('ventas_plataforma').select('plataforma, fecha_fin_periodo, bruto, neto, pedidos').gte('fecha_fin_periodo',`${año}-01-01`).lte('fecha_fin_periodo',`${año}-12-31`);const denorm:Record<string,string>={uber:'uber',glovo:'glovo',je:'just_eat',just_eat:'just_eat',justeat:'just_eat',web:'web',dir:'directa',directa:'directa'};const mapped=(data||[]).filter((r:any)=>r.neto!=null).map((r:any)=>{const d=new Date((r.fecha_fin_periodo as string)+'T00:00:00');const p=(r.plataforma||'').toLowerCase().trim();return{plataforma:denorm[p]??p,mes:d.getMonth()+1,año:d.getFullYear(),bruto:Number(r.bruto??0),comisiones:0,fees:0,cargos_promocion:0,neto_real_cobrado:Number(r.neto??0),pedidos:Number(r.pedidos??0)}});sRes(mapped as ResRow[])})()},[año])
useEffect(()=>{
const main=mainRef.current;const top=topRef.current;if(!main||!top)return
let src:HTMLDivElement|null=null
const syncTop=()=>{if(src&&src!==main)return;src=main;top.scrollLeft=main.scrollLeft;requestAnimationFrame(()=>{src=null})}
const syncMain=()=>{if(src&&src!==top)return;src=top;main.scrollLeft=top.scrollLeft;requestAnimationFrame(()=>{src=null})}
main.addEventListener('scroll',syncTop);top.addEventListener('scroll',syncMain)
return()=>{main.removeEventListener('scroll',syncTop);top.removeEventListener('scroll',syncMain)}
},[])
const desgloseCache=useMemo(()=>{
const cache:Record<string,DesgloseCanal>={}
for(let m=1;m<=12;m++){
const b=brutos[m];const p=pedidosCanal[m];if(!b||!p)continue
const fIni=new Date(año,m-1,1);const fFin=new Date(año,m,0)
cache[`uber-${m}`]=calcDesglosePorCanal('uber',b.uber,p.uber,marcasActivas,fIni,fFin)
cache[`glovo-${m}`]=calcDesglosePorCanal('glovo',b.glovo,p.glovo,marcasActivas,fIni,fFin)
cache[`je-${m}`]=calcDesglosePorCanal('je',b.je,p.je,marcasActivas,fIni,fFin)
cache[`web-${m}`]=calcDesglosePorCanal('web',b.web,p.web,marcasActivas,fIni,fFin)
}
return cache
},[brutos,pedidosCanal,marcasActivas,año])
const sumDesg=(canal:string,campo:keyof DesgloseCanal,ms:number[]):number=>ms.reduce((s,m)=>{const d=desgloseCache[`${canal}-${m}`];return s+(d?Number(d[campo]||0):0)},0)
const adsC=(canal:'uber'|'glovo'|'je',ms:number[])=>ms.reduce((s,m)=>s+(adsPlataforma[m]?.[canal]||0),0)
const adsT=(ms:number[])=>adsC('uber',ms)+adsC('glovo',ms)+adsC('je',ms)
const iT=(ms:number[])=>{let s=0;for(const[c,m]of Object.entries(ingresos)){if(c.startsWith('1.'))s+=sumMeses(m,ms)};return s}
const gP=(p:string,ms:number[])=>sumCatMeses(gastos,p,ms)
const gT=(ms:number[])=>gP('2.',ms)
const re=(ms:number[])=>iM(ms)-gT(ms)
const gB=(g:string)=>{const k=BM[g];return k?benchmarks.find(b=>b.categoria===k):null}
const gF=(ms:number[])=>gP('2.2',ms)+gP('2.3',ms)
const gV=(ms:number[])=>gP('2.1',ms)+gP('2.4',ms)
const pe=(ms:number[])=>ms.reduce((s,m)=>s+(brutos[m]?.pedidos||0),0)
const fB=(ms:number[])=>ms.reduce((s,m)=>{const real=brutos[m]?.total||0;if(real>0)return s+real;return s+(facturacionFutura[m]?.importe||0)},0)
const fBisEst=(ms:number[])=>{for(const m of ms){if(!brutos[m]?.total&&facturacionFutura[m]?.importe)return true}return false}
const objFact=(ms:number[])=>ms.reduce((s,m)=>s+(objetivosMensuales[m]||0),0)
const nE=(ms:number[])=>{let s=0;for(const m of ms){const b=brutos[m];const p=pedidosCanal[m];if(!b||!p)continue;const d=new Date(año,m,0).getDate();s+=calcNetoCanal('uber',b.uber,p.uber,comisiones.uber||0,feesFijos.uber,d,marcasActivas)+calcNetoCanal('glovo',b.glovo,p.glovo,comisiones.glovo||0,feesFijos.glovo,d,marcasActivas)+calcNetoCanal('je',b.je,p.je,comisiones.je||0,feesFijos.je,d,marcasActivas)+calcNetoCanal('web',b.web,p.web,comisiones.web||0,feesFijos.web,d,marcasActivas)+calcNetoCanal('directa',b.directa,p.directa,comisiones.directa||0,feesFijos.directa,d,marcasActivas)};return s}
const iM=(ms:number[])=>{const r=iT(ms);return r||nE(ms)}
const iMisEst=(ms:number[])=>!iT(ms)&&!!nE(ms)
const mB=(ms:number[])=>iM(ms)-gP('2.1',ms)
const tB=(ms:number[])=>{const p=pe(ms);return p?fB(ms)/p:0}
const tN=(ms:number[])=>{const p=pe(ms);return p?iM(ms)/p:0}
const cD=(ms:number[])=>{const i=iM(ms);return i?(gP('2.1',ms)+gP('2.2',ms))/i*100:0}
const vi=(l:string)=>buscar.length<2||l.toLowerCase().includes(buscar.toLowerCase())
const vc=useMemo(()=>{const c:Col[]=[];for(let q=1;q<=4;q++){QM[q].forEach(m=>c.push({label:MN[m-1],ms:[m]}));c.push({label:`${q}T`,ms:QM[q],isQ:true,qn:q})};c.push({label:'AÑO',ms:ALL,isY:true});return c},[])
const cN2=useMemo(()=>categorias.filter(c=>c.nivel===2),[categorias])
const cCh=(pid:string)=>categorias.filter(c=>c.parent_id===pid&&c.nivel===3).sort((a,b)=>sumMeses(gastos[b.id]||{},ALL)-sumMeses(gastos[a.id]||{},ALL))
const W_LABEL=280
// Cabecera: todo INK texto crema (patrón homogéneo ERP). Trimestre/año: negrita, no color de fondo
const th1:React.CSSProperties={fontFamily:OSW,fontSize:12,fontWeight:700,letterSpacing:'1.5px',color:CREMA,textTransform:'uppercase',textAlign:'left',padding:'10px 12px',background:INK,borderRight:'2px solid #4a3f2c',whiteSpace:'nowrap',position:'sticky',left:0,zIndex:6,minWidth:W_LABEL,width:W_LABEL}
const t1:React.CSSProperties={padding:'9px 12px',fontSize:13,fontFamily:LEX,color:INK,borderBottom:`2px solid ${INK}`,borderRight:`3px solid ${INK}`,whiteSpace:'nowrap',textAlign:'left',position:'sticky',left:0,zIndex:5,verticalAlign:'middle',background:BLANCO,minWidth:W_LABEL,width:W_LABEL}
const thC=(c:Col):React.CSSProperties=>({fontFamily:OSW,fontSize:12,fontWeight:c.isQ||c.isY?700:600,letterSpacing:'1.5px',textTransform:'uppercase',textAlign:'right',padding:'10px 8px',background:INK,borderRight:'2px solid #4a3f2c',whiteSpace:'nowrap',userSelect:'none',color:c.isY?AMA:c.isQ?'#fff':CREMA})
const thP=(c:Col):React.CSSProperties=>({...thC(c),fontSize:9,minWidth:28,padding:'10px 2px'})
// Celdas de datos: SIEMPRE fondo blanco. Color solo en el texto (semántico). Cero fondos pastel
const tdBase=(cl?:string,zona?:'pyg'|'det'):React.CSSProperties=>({padding:'8px 8px',fontSize:14,fontFamily:OSW,color:cl||(zona==='det'?INK:AZUL),borderBottom:`2px solid ${INK}`,borderRight:BRD_V,whiteSpace:'nowrap',textAlign:'right',verticalAlign:'middle',fontVariantNumeric:'tabular-nums',lineHeight:1.2,fontWeight:600,background:BLANCO})
const tdP=():React.CSSProperties=>({...tdBase(),fontSize:11,color:MUT,padding:'8px 2px',minWidth:28,fontFamily:LEX,fontWeight:400,borderRight:BRD_V})
const tdRes=(v:number):React.CSSProperties=>({...tdBase(),color:v>0?VERDE:v<0?ROJO:GRIS,fontWeight:700})
// Fila: fondo blanco, borde inferior INK, banda lateral de estado (color) — patrón tabla ERP
const r1=(bc?:string):React.CSSProperties=>({...t1,borderLeft:`12px solid ${bc||GRANATE}`})
const ingLabel:React.CSSProperties={...r1(),fontFamily:OSW,fontSize:14,letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:600}
const gR:React.CSSProperties={...t1,fontFamily:OSW,fontSize:13,letterSpacing:'1.5px',textTransform:'uppercase',color:GRANATE,fontWeight:600}
const tR:React.CSSProperties={...t1,fontFamily:OSW,fontSize:14,letterSpacing:'1.5px',textTransform:'uppercase',color:GRANATE,fontWeight:700,borderTop:`3px solid ${INK}`}
const rR:React.CSSProperties={...t1,fontFamily:OSW,fontSize:15,letterSpacing:'1.5px',textTransform:'uppercase',color:VERDE,fontWeight:700,borderTop:`3px solid ${INK}`}
const sp=<tr><td colSpan={99} style={{height:8,border:'none',background:CREMA,padding:0}}/></tr>
const rRow=(cl:string):React.CSSProperties=>({...r1(cl),fontSize:13,color:cl,fontWeight:700,fontFamily:OSW,textTransform:'uppercase',letterSpacing:'1px'})
const btnSL:React.CSSProperties={padding:'5px 12px',border:`3px solid ${INK}`,background:AMA,fontFamily:OSW,fontSize:11,color:INK,cursor:'pointer',fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',boxShadow:SHADOW}
const pS:React.CSSProperties={appearance:'none' as const,padding:'7px 28px 7px 14px',border:`3px solid ${INK}`,background:BLANCO,fontFamily:OSW,fontWeight:700,fontSize:13,color:INK,cursor:'pointer',boxShadow:SHADOW,textTransform:'uppercase',backgroundImage:"url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23140f08' fill='none' stroke-width='2'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 9px center'}
const tW=W_LABEL+vc.reduce((s,c)=>s+(c.isY?95:(c.isQ?100:115)),0)
const hv={onMouseEnter:(e:React.MouseEvent<HTMLTableRowElement>)=>{e.currentTarget.style.background=CLARO},onMouseLeave:(e:React.MouseEvent<HTMLTableRowElement>)=>{e.currentTarget.style.background=''}}
const blToggle=(k:string)=>sBl(p=>({...p,[k]:!p[k]}))
const Sp=({fn}:{fn:(ms:number[])=>number})=>{const vs=ALL.map(m=>fn([m]));const mx=Math.max(...vs.map(v=>Math.abs(v)),1);return<span style={{display:'inline-flex',alignItems:'flex-end',gap:1,height:16,verticalAlign:'middle',marginLeft:6}}>{vs.map((v,i)=><span key={i} style={{width:3,height:`${Math.max(Math.abs(v)/mx*16,v?1:0)}px`,background:v>0?VERDE:v<0?ROJO:GRIS}}/>)}</span>}
const CB=({fn,max,min}:{fn:(ms:number[])=>number;max:number;min?:number})=>(<>{vc.map((c,i)=>{const v=fn(c.ms);const mn=min||0;const dentro=v>=mn&&v<=max;const cerca=!dentro&&v>=mn-DESV_PCT&&v<=max+DESV_PCT;const bc=dentro?VERDE:cerca?NAR:ROJO;return[<td key={i} style={{...tdBase(bc)}}>{v?fP(v):'—'}<div style={{width:'100%',height:6,display:'flex',overflow:'hidden',marginTop:2,border:`1px solid ${INK}`}}><div style={{height:6,background:bc,width:`${Math.min(v,100)}%`,transition:'width 0.4s ease'}}/><div style={{height:6,background:CLARO,flex:1}}/></div></td>,<td key={`p${i}`} style={tdP()}/>]})}</>)
const Cells=({fn,cl,sign,pct,pctFn,alertMax,esRes,estFn,tip,zona}:{fn:(ms:number[])=>number;cl?:string;sign?:boolean;pct?:boolean;pctFn?:(ms:number[])=>number;alertMax?:number;esRes?:boolean;estFn?:(ms:number[])=>boolean;tip?:string;zona?:'pyg'|'det'})=>(<>{vc.map((c,i)=>{const v=fn(c.ms);const isEst=estFn?.(c.ms)??false;const defColor=zona==='det'?INK:AZUL;const color=cl||(sign?(v>0?VERDE:v<0?ROJO:GRIS):defColor);const st=esRes?tdRes(v):tdBase(color,zona);const vt=<td key={i} style={{...st,color:esRes?st.color:color,fontWeight:esRes?700:600}}>{pct?fP(v):v?fI(v):'—'}{isEst&&v?<EstB/>:null}</td>;if(pctFn){const pv=pctFn(c.ms);const ov=!!(alertMax&&pv>alertMax);return[vt,<td key={`p${i}`} style={{...tdP(),color:ov?ROJO:undefined,fontWeight:ov?700:undefined}} title={tip}>{pv?(ov?<span style={{display:'inline-flex',alignItems:'center',gap:1}}><span style={{fontSize:11}}>⚠</span>{pv.toFixed(1)}%</span>:`${pv.toFixed(1)}%`):'—'}</td>]};return[vt,<td key={`p${i}`} style={tdP()}/>]})}</>)
const CellsObj=()=>(<>{vc.map((c,i)=>{const obj=objFact(c.ms);const pct=obj?(fB(c.ms)/obj)*100:0;const col=semColor(pct);return[<td key={i} style={{...tdBase(INK)}}>{obj?<div style={{display:'flex',flexDirection:'column',gap:2}}><span>{fI(obj)}</span><div style={{width:'100%',height:5,display:'flex',overflow:'hidden',border:`1px solid ${INK}`}}><div style={{height:5,background:col,width:`${Math.min(pct,100)}%`,transition:'width 0.4s ease'}}/><div style={{height:5,background:CLARO,flex:1}}/></div></div>:'—'}</td>,<td key={`p${i}`} style={{...tdP(),color:obj?col:undefined,fontWeight:obj?700:400}}>{obj?`${Math.round(pct)}%`:'—'}</td>]})}</>)
const CTM=()=>(<>{vc.map((c,i)=>{const p=pe(c.ms);const tb=tB(c.ms);const tn=tN(c.ms);return[<td key={i} style={{...tdBase()}}>{p?<><span style={{color:NAR}}>{fI(p)}</span>{' '}<span style={{color:AZUL}}>{fD(tb)}</span><span style={{color:MUT,fontSize:11}}>/</span><span style={{color:VERDE}}>{fD(tn)}</span></>:'—'}</td>,<td key={`p${i}`} style={tdP()}/>]})}</>)
const CI=()=>(<>{vc.map((c,i)=>{const rv=iT(c.ms);const e=nE(c.ms);const v=rv||e;const es=!rv&&!!e;return[<td key={i} style={{...tdBase(VERDE),fontWeight:700}}>{v?fI(v):'—'}{es&&<EstB/>}</td>,<td key={`p${i}`} style={tdP()}/>]})}</>)
const CR=({fn}:{fn:(ms:number[])=>number})=>(<>{vc.map((c,i)=>{const v=fn(c.ms);return[<td key={i} style={{...tdBase(MUT)}}>{v?fD(v):'—'}</td>,<td key={`p${i}`} style={tdP()}/>]})}</>)
const sectionRow=(content:React.ReactNode,cl:string,onClick?:()=>void)=><tr style={{cursor:onClick?'pointer':'default'}} onClick={onClick}>
  <td style={{...t1,background:INK,fontFamily:OSW,fontSize:14,letterSpacing:'2px',textTransform:'uppercase',color:cl,padding:'11px 12px',borderBottom:`3px solid ${INK}`,borderLeft:`12px solid ${cl}`,borderRight:`3px solid ${INK}`,fontWeight:700}}>{content}</td>
  {vc.map((c,i)=>[<td key={i} style={{background:INK,borderBottom:`3px solid ${INK}`,padding:0}}/>,<td key={`p${i}`} style={{background:INK,borderBottom:`3px solid ${INK}`,padding:0}}/>])}
</tr>
const sHBl=(l:string,key:string,cl:string)=>sectionRow(<><span style={{display:'inline-block',width:14}}>{bloque[key]?'▾':'▸'}</span> {l}</>,cl,()=>blToggle(key))
const sH=(l:string,cl:string,x?:React.ReactNode)=>sectionRow(<>{l}{x}</>,cl,undefined)
const mhRow=(label:string)=><tr><th style={th1}>{label}</th>{vc.map((c,i)=>[<th key={i} style={thC(c)}>{c.label}</th>,<th key={`p${i}`} style={thP(c)}>%</th>])}</tr>
const tPO=(k:string)=>sPO(p=>({...p,[k]:!p[k]}))
const allPlatOpen=platOpen.uber&&platOpen.glovo&&platOpen.je&&platOpen.web
// Cabecera de plataforma: pastilla de color de marca a la izquierda, resto banda INK (no toda la fila de color)
const platHeader=(name:string,key:string)=>{const bg=CORP[key]||INK;const tx=CLARA[key]?INK:'#fff';return<tr style={{cursor:'pointer'}} onClick={()=>tPO(key)}>
  <td style={{...t1,background:INK,color:CREMA,fontFamily:OSW,fontSize:13,letterSpacing:'1.5px',textTransform:'uppercase',padding:'9px 12px',borderTop:`3px solid ${INK}`,borderBottom:`3px solid ${INK}`,borderLeft:`12px solid ${bg}`,fontWeight:700}}>{platOpen[key]?'▾':'▸'} <span style={{background:bg,color:tx,border:`2px solid ${bg}`,padding:'1px 8px',marginLeft:2}}>{name}</span></td>
  {vc.map((c,i)=>[<td key={i} style={{background:INK,borderTop:`3px solid ${INK}`,borderBottom:`3px solid ${INK}`,padding:0}}/>,<td key={`p${i}`} style={{background:INK,borderTop:`3px solid ${INK}`,borderBottom:`3px solid ${INK}`,padding:0}}/>])}
</tr>}
const platRowEst=(label:string,canal:string,campo:keyof DesgloseCanal,negative=true)=><tr {...hv}><td style={{...t1,paddingLeft:22,fontSize:12,color:MUT}}>{label}</td>{vc.map((c,i)=>{const v=sumDesg(canal,campo,c.ms);return[<td key={i} style={{...tdBase(negative?ROJO:VERDE)}}>{v?(negative?'−':'')+fI(v):'—'}{v?<EstB/>:null}</td>,<td key={`p${i}`} style={tdP()}/>]})}</tr>
const platRowBruto=(plat:'uber'|'glovo'|'je'|'web')=><tr {...hv}><td style={{...t1,paddingLeft:22,fontSize:12,color:MUT}}>Bruto pagado por cliente</td>{vc.map((c,i)=>{const v=c.ms.reduce((s,m)=>s+(brutos[m]?.[plat]||0),0);return[<td key={i} style={{...tdBase()}}>{v?fI(v):'—'}</td>,<td key={`p${i}`} style={tdP()}/>]})}</tr>
const platNetoEst=(name:string,canal:string)=><tr><td style={{...t1,paddingLeft:22,fontWeight:700,fontFamily:OSW,fontSize:13,color:VERDE,textTransform:'uppercase',letterSpacing:'1px'}}>= Neto estimado {name}</td>{vc.map((c,i)=>{const v=sumDesg(canal,'neto',c.ms);return[<td key={i} style={{...tdBase(VERDE),fontWeight:700}}>{v?fI(v):'—'}{v?<EstB/>:null}</td>,<td key={`p${i}`} style={tdP()}/>]})}</tr>
const platNetoReal=(name:string,plat:string)=><tr><td style={{...t1,paddingLeft:22,fontWeight:700,fontFamily:OSW,fontSize:13,color:VERDE,textTransform:'uppercase',letterSpacing:'1px'}}>= Neto real cobrado {name}</td>{vc.map((c,i)=>{let v=0;for(const r of resumenes){if(r.plataforma===plat&&c.ms.includes(r.mes))v+=Number(r.neto_real_cobrado||0)};return[<td key={i} style={{...tdBase(v?VERDE:GRIS),fontWeight:v?700:600}}>{v?fI(v):'—'}</td>,<td key={`p${i}`} style={tdP()}/>]})}</tr>
const togglePyGAll=()=>{const n=!allBl;sBl({ing:n,dist:n,ratios:n});sAllBl(n)}
const toggleDetAll=()=>{const n=!aO;const nv:Record<string,boolean>={};['1','2.1','2.2','2.3','2.4'].forEach(k=>nv[k]=n);sD(nv);sAO(n)}
if(loading)return(<div style={{background:CREMA,padding:'28px',minHeight:'100vh'}}><span style={eyebrow(GRANATE,'#fff')}>Finanzas · P&G anual</span><h1 style={{color:GRANATE,fontFamily:OSW,fontSize:34,fontWeight:700,letterSpacing:'-0.5px',lineHeight:0.95,margin:'10px 0 0',textTransform:'uppercase'}}>Running {año}</h1><p style={{fontFamily:LEX,fontSize:14,color:GRIS,marginTop:8}}>Cargando…</p></div>)
const grupos=categorias.filter(c=>c.nivel===1&&c.id.startsWith('2.'))
const ingC=categorias.filter(c=>c.parent_id==='1.1'&&c.nivel===3)
const resAño=re(ALL)
const card:React.CSSProperties={background:BLANCO,border:BORDER_CARD,boxShadow:SHADOW,padding:'16px 20px',minWidth:0}
const kpiLbl=(color:string):React.CSSProperties=>({fontFamily:OSW,fontSize:11,letterSpacing:'2px',textTransform:'uppercase',color,marginBottom:6})
const kpiNum=(color:string):React.CSSProperties=>({fontFamily:OSW,fontWeight:700,fontSize:34,lineHeight:1,color})
const kpiSub=(color:string):React.CSSProperties=>({fontFamily:LEX,fontSize:12,color,marginTop:6})
return(<div style={{fontFamily:LEX,padding:embedded?0:28,background:embedded?'transparent':CREMA,minHeight:embedded?'auto':'100vh',color:INK}}>
<div style={{marginBottom:20,display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
{!embedded && (
<div>
<span style={eyebrow(GRANATE,'#fff')}>Finanzas · P&G anual</span>
<h1 style={{fontFamily:OSW,fontWeight:700,fontSize:34,lineHeight:0.95,letterSpacing:'-0.5px',textTransform:'uppercase',color:GRANATE,margin:'10px 0 6px'}}>Running {año}</h1>
<span style={{fontFamily:LEX,fontSize:13,color:GRIS}}>Cuenta de resultados anual · real y estimado</span>
</div>
)}
<div style={{display:'flex',gap:8,alignItems:'center'}}>
<input placeholder="🔍 Buscar..." value={buscar} onChange={e=>sBu(e.target.value)} style={{padding:'7px 12px',border:`3px solid ${INK}`,background:BLANCO,fontFamily:LEX,fontSize:13,color:INK,width:150,outline:'none',boxShadow:SHADOW}}/>
<select value={año} onChange={e=>sA(Number(e.target.value))} style={pS}>{[2026,2025,2024].map(a=><option key={a} value={a}>{a}</option>)}</select>
</div></div>
<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:14,marginBottom:18}}>
<div style={card}><div style={kpiLbl(MUT)}>Facturación bruta {año}</div><div style={kpiNum(AZUL)}>{fI(fB(ALL))} €{fBisEst(ALL)?<EstB/>:null}</div><div style={kpiSub(GRIS)}>{fI(pe(ALL))} pedidos · TM bruto {fD(tB(ALL))} €</div></div>
<div style={{...card,background:VERDE}}><div style={kpiLbl('#fff')}>Ingresos netos {año}</div><div style={kpiNum('#fff')}>{fI(iM(ALL))} €{iMisEst(ALL)?<EstB/>:null}</div><div style={kpiSub('#fff')}>TM neto {fD(tN(ALL))} € · Gastos {fI(gT(ALL))} €</div></div>
<div style={{...card,background:resAño>=0?INK:ROJO}}><div style={kpiLbl(resAño>=0?AMA:'#fff')}>Resultado {año}</div><div style={kpiNum(resAño>=0?AMA:'#fff')}>{fI(resAño)} €{iMisEst(ALL)?<EstB/>:null}</div><div style={kpiSub('#fff')}>{fP(po(resAño,iM(ALL)))} sobre ingresos netos</div></div>
</div>
<div ref={topRef} style={{overflowX:'scroll',overflowY:'hidden',height:16,background:CLARO,border:`3px solid ${INK}`,marginBottom:8}}><div style={{width:tW,height:1}}/></div>
<div style={{background:BLANCO,border:`4px solid ${INK}`,boxShadow:SHADOW,overflow:'hidden'}}>
<div ref={mainRef} style={{overflowX:'auto',overflowY:'visible',width:'100%'}}>
<table style={{width:tW,borderCollapse:'separate',borderSpacing:0,minWidth:tW}}>
<thead><tr><th style={th1}>PyG <button onClick={togglePyGAll} style={{...btnSL,marginLeft:8}}>{allBl?'▴ Colapsar':'▾ Expandir'}</button></th>{vc.map((c,i)=>[<th key={i} style={thC(c)}>{c.label}</th>,<th key={`p${i}`} style={thP(c)}>%</th>])}</tr></thead>
<tbody>
{sHBl('Ingresos · Gastos · Resultado','ing',GRANATE)}
{bloque.ing&&<>
<tr {...hv}><td style={{...ingLabel,color:INK,fontWeight:600}}>Facturación bruta</td><Cells fn={fB} estFn={fBisEst}/></tr>
<tr {...hv}><td style={{...ingLabel,color:MUT,fontSize:13,fontWeight:400}}>Objetivo facturación</td><CellsObj/></tr>
<tr><td style={{...ingLabel,color:VERDE,fontWeight:600}}>Ingresos netos</td><CI/></tr>
<tr {...hv}><td style={{...r1(),color:MUT,fontSize:12}}><span style={{color:NAR}}>Pedidos</span> · <span style={{color:AZUL}}>TM Bruto</span> / <span style={{color:VERDE}}>TM Neto</span></td><CTM/></tr>
{sp}
<tr {...hv}><td style={{...r1(ROJO),fontFamily:OSW,fontSize:14,letterSpacing:'1.5px',textTransform:'uppercase',color:INK,fontWeight:600}}>Gastos fijos</td><Cells fn={gF} pctFn={ms=>po(gF(ms),fB(ms))} tip="% s/ Facturación bruta"/></tr>
<tr {...hv}><td style={{...r1(ROJO),fontFamily:OSW,fontSize:14,letterSpacing:'1.5px',textTransform:'uppercase',color:INK,fontWeight:600}}>Gastos variables</td><Cells fn={gV} pctFn={ms=>po(gV(ms),fB(ms))} tip="% s/ Facturación bruta"/></tr>
<tr><td style={{...tR,borderLeft:`12px solid ${ROJO}`}}>Total gastos</td><Cells fn={gT} pctFn={ms=>po(gT(ms),fB(ms))} tip="% s/ Facturación bruta"/></tr>
{sp}
<tr><td style={{...rR,borderLeft:`12px solid ${VERDE}`}}>Resultado <Sp fn={re}/></td><Cells fn={re} sign esRes estFn={iMisEst}/></tr>
{sp}
</>}
{sHBl('Distribución de gastos','dist',NAR)}
{bloque.dist&&<>
{grupos.map(g=>{const bn=gB(g.id);const nm=LBL[g.id]||g.nombre;return<tr key={g.id} {...hv}><td style={{...gR,borderLeft:`12px solid ${NAR}`}}>{nm}{bn?<span style={{color:MUT,fontSize:10,fontWeight:400}}> ({bn.pct_min}-{bn.pct_max}%)</span>:null}</td><CB fn={ms=>po(gP(g.id,ms),iM(ms))} max={bn?bn.pct_max:15} min={bn?bn.pct_min:0}/></tr>})}
<tr><td style={{...rR,borderLeft:`12px solid ${NAR}`}}>Resultado <Sp fn={ms=>po(re(ms),iM(ms))}/></td><Cells fn={ms=>po(re(ms),iM(ms))} pct sign esRes estFn={iMisEst}/></tr>
{sp}
</>}
{sHBl('Ratios','ratios',VERDE)}
{bloque.ratios&&<>
<tr><td style={rRow(RATIO_COLORS.margen)}>MARGEN BRUTO</td><Cells fn={mB} pctFn={ms=>po(mB(ms),iM(ms))} sign cl={VERDE} esRes/></tr>
<tr {...hv}><td style={rRow(RATIO_COLORS.food)}>FOOD COST %</td><Cells fn={ms=>po(gP('2.1',ms),iM(ms))} pct/></tr>
<tr {...hv}><td style={rRow(RATIO_COLORS.labor)}>LABOR COST %</td><Cells fn={ms=>po(gP('2.2',ms),iM(ms))} pct/></tr>
<tr {...hv}><td style={rRow(RATIO_COLORS.ratio)}>RATIO ING/GASTOS</td><Cells fn={ms=>{const g=gT(ms);return g?Math.round(iM(ms)/g*100)/100:0}}/></tr>
<tr {...hv}><td style={rRow(RATIO_COLORS.coste)}>COSTE/PEDIDO</td><CR fn={ms=>{const p=pe(ms);return p?gT(ms)/p:0}}/></tr>
<tr {...hv}><td style={{...rRow(RATIO_COLORS.coste),paddingLeft:22,fontSize:11,fontWeight:400,color:MUT}}>— Fijos/pedido</td><CR fn={ms=>{const p=pe(ms);return p?gF(ms)/p:0}}/></tr>
<tr {...hv}><td style={{...rRow(RATIO_COLORS.coste),paddingLeft:22,fontSize:11,fontWeight:400,color:MUT}}>— Variables/pedido</td><CR fn={ms=>{const p=pe(ms);return p?gV(ms)/p:0}}/></tr>
<tr {...hv}><td style={rRow(RATIO_COLORS.neto)}>MARGEN NETO/PEDIDO</td><CR fn={ms=>{const p=pe(ms);return p?re(ms)/p:0}}/></tr>
<tr><td style={{...t1,fontFamily:OSW,fontSize:13,textTransform:'uppercase',color:AZUL,fontWeight:700,borderTop:`2px dashed ${AZUL}`,borderLeft:`12px solid ${AZUL}`}}>BREAK-EVEN</td><Cells fn={gF}/></tr>
<tr {...hv}><td style={rRow(RATIO_COLORS.directo)}>COSTE DIRECTO</td><Cells fn={cD} pct alertMax={60}/></tr>
</>}
<tr><td colSpan={99} style={{height:16,border:'none',background:CREMA,padding:0}}/></tr>
{sH('Desglose por plataforma',AMA,<>
<button onClick={(e)=>{e.stopPropagation();const n=!allPlatOpen;sPO({uber:n,glovo:n,je:n,web:n})}} style={{...btnSL,marginLeft:10}}>{allPlatOpen?'▴':'▾'}</button>
<span style={{marginLeft:8,fontSize:10,color:CREMA,cursor:'pointer'}} onClick={()=>sDP(p=>!p)}>{dPlat?'▾':'▸'}</span>
</>)}
{mhRow('Plataforma')}
{dPlat&&<>
{platHeader('Uber Eats','uber')}
{platOpen.uber&&<>{platRowBruto('uber')}{platRowEst('Comisión Uber + IVA (30/33%)','uber','comisionConIva')}{platRowEst('Tasa Uber One/pedido + IVA (0,82€)','uber','feePromoConIva')}{platRowEst('Tasa semanal mant. + IVA (2,29€ × marcas)','uber','feePeriodicoConIva')}{platNetoEst('Uber','uber')}{platNetoReal('Uber','uber')}</>}
{sp}
{platHeader('Glovo','glovo')}
{platOpen.glovo&&<>{platRowBruto('glovo')}{platRowEst('Comisión Glovo + IVA (30%)','glovo','comisionConIva')}{platRowEst('Fee Prime + IVA (0,74€ × prime)','glovo','feePrimeConIva')}{platRowEst('Cuota quincenal + IVA (10€ × marcas)','glovo','feePeriodicoConIva')}{platNetoEst('Glovo','glovo')}{platNetoReal('Glovo','glovo')}</>}
{sp}
{platHeader('Just Eat','je')}
{platOpen.je&&<>{platRowBruto('je')}{platRowEst('Comisión Just Eat + IVA (30%)','je','comisionConIva')}{platRowEst('Coste gestión/pedido + IVA (0,30€)','je','fijoPedidoConIva')}{platNetoEst('Just Eat','je')}{platNetoReal('Just Eat','just_eat')}</>}
{sp}
{platHeader('Tienda online','web')}
{platOpen.web&&<>{platRowBruto('web')}{platRowEst('Pasarela pago + IVA (0,50€/pedido)','web','fijoPedidoConIva')}{platNetoEst('Tienda online','web')}{platNetoReal('Tienda online','web')}</>}
</>}
<tr><td colSpan={99} style={{height:16,border:'none',background:CREMA,padding:0}}/></tr>
{sH('Detalle por categoría',AMA,<button onClick={(e)=>{e.stopPropagation();toggleDetAll()}} style={{...btnSL,marginLeft:10}}>{aO?'▴':'▾'}</button>)}
{mhRow('Categoría')}
<tr style={{cursor:'pointer'}} onClick={()=>sD(p=>({...p,'1':!p['1']}))}><td style={gR}>{det['1']?'▾':'▸'} 1 · Ingresos por operación</td><Cells fn={iM} estFn={iMisEst} zona="det"/></tr>
{det['1']&&<>
<tr {...hv}><td style={{...t1,paddingLeft:22,fontWeight:600,fontSize:13}}>1.1 · Ingresos netos por ventas</td><Cells fn={iT} zona="det"/></tr>
{ingC.filter(c=>vi(c.nombre)).map(c=><tr key={c.id} {...hv}><td style={{...t1,paddingLeft:34,fontSize:13}}>{c.id} · {c.nombre}</td><Cells fn={ms=>sumMeses(ingresos[c.id]||{},ms)} pctFn={ms=>po(sumMeses(ingresos[c.id]||{},ms),iM(ms))} zona="det"/></tr>)}
<tr {...hv}><td style={{...t1,paddingLeft:22,fontWeight:600,fontSize:13}}>1.2 · Facturación bruta</td><Cells fn={fB} estFn={fBisEst} zona="det"/></tr>
</>}{sp}
{grupos.map(g=>{const bn=gB(g.id);const bL=bn?` (${bn.pct_min}-${bn.pct_max}%)`:'';const sN=cN2.filter(c=>c.parent_id===g.id);const nm=LBL[g.id]||g.nombre;const op=!!det[g.id];return[
<tr key={`h-${g.id}`} style={{cursor:'pointer'}} onClick={()=>sD(p=>({...p,[g.id]:!p[g.id]}))}><td style={gR}>{op?'▾':'▸'} {g.id} · {nm}<span style={{color:MUT,fontSize:10,fontWeight:400}}>{bL}</span></td><Cells fn={ms=>gP(g.id,ms)} pctFn={ms=>po(gP(g.id,ms),iM(ms))} zona="det"/></tr>,
...(op?sN.flatMap(sub=>{const ch=cCh(sub.id);return[
<tr key={sub.id} style={{cursor:'pointer'}} onClick={()=>sD(p=>({...p,[sub.id]:!p[sub.id]}))} {...hv}><td style={{...t1,paddingLeft:22,fontWeight:600,fontSize:13}}>{det[sub.id]!==false?'▾':'▸'} {sub.id} · {sub.nombre}</td><Cells fn={ms=>sumCatMeses(gastos,sub.id,ms)} pctFn={ms=>po(sumCatMeses(gastos,sub.id,ms),iM(ms))} zona="det"/></tr>,
...(det[sub.id]!==false?ch.filter(c=>vi(c.nombre)).map(c=><tr key={c.id} {...hv}><td style={{...t1,paddingLeft:38,color:MUT,fontSize:12}}>{c.id} · {c.nombre}</td><Cells fn={ms=>sumMeses(gastos[c.id]||{},ms)} pctFn={ms=>po(sumMeses(gastos[c.id]||{},ms),iM(ms))} zona="det"/></tr>):[]),
].filter(Boolean)}):[]),sp].filter(Boolean)}).flat()}
{sp}
{sH('Ads plataformas',AMA,<span style={{color:CREMA,fontSize:10,fontWeight:400,marginLeft:8,textTransform:'none',letterSpacing:0,fontFamily:LEX}}>informativo · no computa en P y G</span>)}
{mhRow('Plataforma')}
<tr><td style={gR}>2.41.5 · Ads plataformas</td><Cells fn={adsT} zona="det"/></tr>
<tr {...hv}><td style={{...t1,paddingLeft:22,fontSize:13}}>Ads Uber Eats</td><Cells fn={ms=>adsC('uber',ms)} zona="det"/></tr>
<tr {...hv}><td style={{...t1,paddingLeft:22,fontSize:13}}>Ads Glovo</td><Cells fn={ms=>adsC('glovo',ms)} zona="det"/></tr>
<tr {...hv}><td style={{...t1,paddingLeft:22,fontSize:13}}>Ads Just Eat</td><Cells fn={ms=>adsC('je',ms)} zona="det"/></tr>
</tbody></table></div></div></div>)
}

export default Running
