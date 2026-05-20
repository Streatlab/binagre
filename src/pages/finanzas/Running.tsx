import{useState,useMemo,useRef,useEffect}from'react'
import{useRunningAnual,sumMeses,sumCatMeses,calcNetoCanal}from'@/hooks/useRunningAnual'
import{useTitular}from'@/contexts/TitularContext'
import{COLORS,FONT,CARDS,TABS_PILL}from'@/components/panel/resumen/tokens'
import{supabase}from'@/lib/supabase'
const MN=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const QM:Record<number,number[]>={1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]}
const ALL=[1,2,3,4,5,6,7,8,9,10,11,12]
const BM:Record<string,string>={'2.1':'PRODUCTO','2.2':'RRHH','2.3':'ALQUILER','2.4':'CONTROLABLES','2.41':'MARKETING','2.42':'INTERNET_VENTAS','2.43':'ADMIN_GENERALES','2.44':'SUMINISTROS'}
const LBL:Record<string,string>={'2.1':'Producto','2.2':'Equipo','2.3':'Local','2.4':'Controlables'}
const RATIO_COLORS:Record<string,string>={'margen':COLORS.ok,'food':'#f5a623','labor':'#1E5BCC','ratio':'#B01D23','coste':'#E24B4A','neto':COLORS.ok,'be':'#1E5BCC','directo':'#f5a623'}
const cM=new Date().getMonth()+1,BL='#1E5BCC'
const Q_MES=['#f5f0dc','#e0f0e4','#ece0f0','#f5e8d8']
const Q_TOT=['#ede5c4','#c8e4cf','#dcc8e8','#ebd4b8']
const Q_RES=['#e6ddb0','#b4d8ba','#cdb4dc','#e0c4a0']
const Q_HDR=['#ddd4a0','#a0ccaa','#bea0d0','#d4b490']
const QCL=['#8a7a20','#1D9E75','#7a40a0','#c07020']
const CUR_BG='rgba(30,91,204,.20)'
const W_LABEL=280
const fI=(n:number):string=>{if(!n)return'—';const a=Math.abs(n);return(n<0?'−':'')+Math.round(a).toLocaleString('es-ES',{useGrouping:true})}
const fD=(n:number):string=>{if(!n)return'—';const a=Math.abs(n);return(n<0?'−':'')+a.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:true})}
const fP=(v:number)=>v?`${v.toFixed(1)}%`:'—'
const po=(p:number,t:number)=>t?(p/t)*100:0
const DESV_PCT=5
type ResRow={plataforma:string;mes:number;año:number;bruto:number;comisiones:number;fees:number;cargos_promocion:number;ads:number;neto_cobrado:number;reembolsos_clientes?:number;tasa_mantenimiento?:number;tasa_uber_one?:number;coste_gestion_je?:number;reembolsos_2x?:number}
export default function Running(){
const{filtro,titulares}=useTitular()
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
const tId=filtro==='unificado'?null:filtro
const{ingresos,gastos,facturacionFutura,brutos,pedidosCanal,categorias,benchmarks,comisiones,feesFijos,marcasActivas,loading}=useRunningAnual(año,tId)
useEffect(()=>{(async()=>{const{data}=await supabase.from('resumenes_plataforma_marca_mensual').select('*').eq('año',año);sRes((data||[])as ResRow[])})()},[año])
useEffect(()=>{
const main=mainRef.current;const top=topRef.current;if(!main||!top)return
let src:HTMLDivElement|null=null
const syncTop=()=>{if(src&&src!==main)return;src=main;top.scrollLeft=main.scrollLeft;requestAnimationFrame(()=>{src=null})}
const syncMain=()=>{if(src&&src!==top)return;src=top;main.scrollLeft=top.scrollLeft;requestAnimationFrame(()=>{src=null})}
main.addEventListener('scroll',syncTop);top.addEventListener('scroll',syncMain)
return()=>{main.removeEventListener('scroll',syncTop);top.removeEventListener('scroll',syncMain)}
},[])
const reembolsos2xUberMes=useMemo(()=>{const m:Record<number,number>={};for(const r of resumenes){if(r.plataforma==='uber'&&r.reembolsos_2x){m[r.mes]=(m[r.mes]||0)+Number(r.reembolsos_2x||0)}};return m},[resumenes])
const reembolsos2xMs=(ms:number[])=>ms.reduce((s,m)=>s+(reembolsos2xUberMes[m]||0),0)
const iT=(ms:number[])=>{let s=0;for(const[c,m]of Object.entries(ingresos)){if(c.startsWith('1.'))s+=sumMeses(m,ms)};return s}
const gP=(p:string,ms:number[])=>sumCatMeses(gastos,p,ms)
const gT=(ms:number[])=>gP('2.',ms)
const re=(ms:number[])=>iM(ms)-gT(ms)
const gB=(g:string)=>{const k=BM[g];return k?benchmarks.find(b=>b.categoria===k):null}
const gF=(ms:number[])=>gP('2.2',ms)+gP('2.3',ms)
const gV=(ms:number[])=>gP('2.1',ms)+gP('2.4',ms)
const pe=(ms:number[])=>ms.reduce((s,m)=>s+(brutos[m]?.pedidos||0),0)
const fB=(ms:number[])=>ms.reduce((s,m)=>{const real=brutos[m]?.total||0;if(real>0)return s+real;return s+(facturacionFutura[m]?.importe||0)},0)
const fBisEst=(ms:number[])=>{for(const m of ms){const real=brutos[m]?.total||0;if(real===0&&facturacionFutura[m]?.importe)return true}return false}
const nE=(ms:number[])=>{
  let s=0
  for(const m of ms){
    const b=brutos[m];const p=pedidosCanal[m];if(!b||!p)continue
    const dias=new Date(año,m,0).getDate()
    s+=calcNetoCanal('uber',b.uber,p.uber,comisiones.uber||0,feesFijos.uber,dias,marcasActivas)
    s+=calcNetoCanal('glovo',b.glovo,p.glovo,comisiones.glovo||0,feesFijos.glovo,dias,marcasActivas)
    s+=calcNetoCanal('je',b.je,p.je,comisiones.je||0,feesFijos.je,dias,marcasActivas)
    s+=calcNetoCanal('web',b.web,p.web,comisiones.web||0,feesFijos.web,dias,marcasActivas)
    s+=calcNetoCanal('directa',b.directa,p.directa,comisiones.directa||0,feesFijos.directa,dias,marcasActivas)
  }
  return s
}
const iM=(ms:number[])=>{const r=iT(ms);const base=r||nE(ms);return base+reembolsos2xMs(ms)}
const iMisEst=(ms:number[])=>iT(ms)===0&&nE(ms)>0
const mB=(ms:number[])=>iM(ms)-gP('2.1',ms)
const tB=(ms:number[])=>{const p=pe(ms);return p?fB(ms)/p:0}
const tN=(ms:number[])=>{const p=pe(ms);return p?iM(ms)/p:0}
const cD=(ms:number[])=>{const i=iM(ms);return i?(gP('2.1',ms)+gP('2.2',ms))/i*100:0}
const vi=(l:string)=>buscar.length<2||l.toLowerCase().includes(buscar.toLowerCase())
const rSum=(plat:string,field:keyof ResRow,ms:number[]):number=>{let s=0;for(const r of resumenes){if(r.plataforma===plat&&ms.includes(r.mes)){const v=r[field];if(typeof v==='number')s+=v}};return s}
type Col={label:string;ms:number[];isQ?:boolean;qn?:number;isY?:boolean;isCur?:boolean}
const cols=useMemo(()=>{const c:Col[]=[];for(let q=1;q<=4;q++){QM[q].forEach(m=>c.push({label:MN[m-1],ms:[m],isCur:m===cM}));c.push({label:`${q}T`,ms:QM[q],isQ:true,qn:q})};c.push({label:'AÑO',ms:ALL,isY:true});return c},[])
const vc=cols
const cN2=useMemo(()=>categorias.filter(c=>c.nivel===2),[categorias])
const cCh=(pid:string)=>categorias.filter(c=>c.parent_id===pid&&c.nivel===3).sort((a,b)=>sumMeses(gastos[b.id]||{},ALL)-sumMeses(gastos[a.id]||{},ALL))
const cQ=(c:Col)=>{for(let q=1;q<=4;q++){if(c.isQ&&c.qn===q)return q;if(!c.isQ&&!c.isY&&QM[q].includes(c.ms[0]))return q};return 0}
// AÑO sin colores, igual que mes normal
const colBg=(c:Col,resumen?:boolean):string=>{if(c.isCur&&!c.isQ&&!c.isY)return CUR_BG;const q=cQ(c);if(c.isQ&&q)return Q_TOT[q-1];if(c.isY)return'#fafafa';if(q)return resumen?Q_RES[q-1]:Q_MES[q-1];return'transparent'}
const thC=(c:Col):React.CSSProperties=>{const q=cQ(c);const qy=c.isQ||c.isY;return{fontFamily:FONT.heading,fontSize:12,fontWeight:qy?700:(c.isCur?700:500),letterSpacing:'1.5px',textTransform:'uppercase',textAlign:'right',padding:'4px 4px',borderBottom:`1px solid ${COLORS.brd}`,whiteSpace:'nowrap',userSelect:'none',color:qy?(c.isY?COLORS.mut:QCL[q-1]):(c.isCur?'#fff':COLORS.mut),background:c.isCur&&!qy?BL:(c.isQ&&q?Q_HDR[q-1]:(c.isY?'#f0ede7':(q?Q_MES[q-1]:COLORS.bg)))}}
// SOMBRA derecha visible para separar la columna sticky
const STICKY_SHADOW='4px 0 8px -2px rgba(0,0,0,.08)'
const th1:React.CSSProperties={fontFamily:FONT.heading,fontSize:12,fontWeight:600,letterSpacing:'1.5px',color:COLORS.mut,textTransform:'uppercase',textAlign:'left',padding:'4px 8px',background:'#fff',borderBottom:`1px solid ${COLORS.brd}`,borderRight:`1px solid ${COLORS.brd}`,whiteSpace:'nowrap',position:'sticky',left:0,zIndex:6,minWidth:W_LABEL,width:W_LABEL,boxShadow:STICKY_SHADOW}
const thP=(c:Col):React.CSSProperties=>({...thC(c),fontSize:9,color:c.isCur?'rgba(255,255,255,.7)':(COLORS.mut+'70'),minWidth:28,padding:'4px 1px',position:'static',boxShadow:'none',borderRight:'none'})
const td0=(c:Col,resumen?:boolean):React.CSSProperties=>{const qy=c.isQ||c.isY;return{padding:'1px 4px',fontSize:15,fontFamily:FONT.body,color:COLORS.sec,borderBottom:`0.5px solid ${COLORS.brd}18`,whiteSpace:'nowrap',textAlign:'right',verticalAlign:'middle',fontVariantNumeric:'tabular-nums',lineHeight:1.2,fontWeight:qy?600:(c.isCur?500:400),background:colBg(c,resumen)}}
// t1 SIEMPRE con fondo SÓLIDO BLANCO obligatorio + sombra derecha para evitar solapamiento
const t1:React.CSSProperties={padding:'1px 8px',fontSize:14,fontFamily:FONT.body,color:COLORS.sec,borderBottom:`0.5px solid ${COLORS.brd}18`,borderRight:`1px solid ${COLORS.brd}30`,whiteSpace:'nowrap',textAlign:'left',position:'sticky',left:0,zIndex:5,verticalAlign:'middle',background:'#fff',minWidth:W_LABEL,width:W_LABEL,boxShadow:STICKY_SHADOW}
const tdP=(c:Col,resumen?:boolean):React.CSSProperties=>({...td0(c,resumen),fontSize:12,color:COLORS.mut+'90',padding:'1px 1px',minWidth:28})
// Tamaños UNIFORMES (AÑO igual que resto)
const nZ=(_c:Col,rz?:boolean):React.CSSProperties=>({fontFamily:FONT.heading,fontSize:rz?16:15,fontWeight:600,letterSpacing:'0.3px'})
const r1=(bc?:string):React.CSSProperties=>({...t1,background:'#fff',borderLeft:`3px solid ${bc||COLORS.redSL}`,fontSize:14})
const rC=(c:Col):React.CSSProperties=>({...td0(c,true)})
const ingLabel:React.CSSProperties={...r1(),fontFamily:FONT.heading,fontSize:14,letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:600}
const Cells=({fn,sign,pct,pctFn,alertMax,vc:vcl,rz,tip,estFn}:{fn:(ms:number[])=>number;sign?:boolean;pct?:boolean;pctFn?:(ms:number[])=>number;alertMax?:number;vc?:string;rz?:boolean;tip?:string;estFn?:(ms:number[])=>boolean})=>(<>{vc.map((c,i)=>{const v=fn(c.ms);const cl=vcl||(sign?(v>0?COLORS.ok:v<0?COLORS.err:COLORS.mut):undefined);const st=rz?rC(c):td0(c);const es=estFn?estFn(c.ms):false;const vt=<td key={i} style={{...st,color:cl||st.color,...(v&&!pct?nZ(c,rz):{}),fontFamily:v&&!pct?FONT.heading:st.fontFamily,fontStyle:es?'italic':undefined}}>{pct?fP(v):v?fI(v):'—'}{es&&v?<span style={{fontSize:9,color:COLORS.mut,marginLeft:2,fontStyle:'normal',fontFamily:FONT.body}} title="Estimado">(est.)</span>:null}</td>;if(pctFn){const pv=pctFn(c.ms);const ov=alertMax&&pv>alertMax;return[vt,<td key={`p${i}`} style={{...tdP(c,rz),color:ov?COLORS.err:undefined,fontWeight:ov?600:undefined}} title={tip}>{pv?(ov?<span style={{display:'inline-flex',alignItems:'center',gap:1}}><span style={{fontSize:11}}>⚠</span>{pv.toFixed(1)}%</span>:`${pv.toFixed(1)}%`):'—'}</td>]}return[vt,<td key={`p${i}`} style={tdP(c,rz)}/>]})}</>)
const CTM=({rz:r}:{rz?:boolean})=>(<>{vc.map((c,i)=>{const p=pe(c.ms);const tb=tB(c.ms);const tn=tN(c.ms);const st=r?rC(c):td0(c);const sz=14;return[<td key={i} style={{...st,fontFamily:FONT.heading,fontSize:sz,fontWeight:600}}>{p?<><span style={{color:BL}}>{fI(p)}</span>{' '}<span style={{color:COLORS.warn,fontSize:sz}}>{fD(tb)}</span><span style={{color:COLORS.mut,fontSize:sz-4}}>/</span><span style={{color:COLORS.ok,fontSize:sz}}>{fD(tn)}</span></>:'—'}</td>,<td key={`p${i}`} style={tdP(c,r)}/>]})}</>)
const CI=({rz:r}:{rz?:boolean})=>(<>{vc.map((c,i)=>{const rv=iT(c.ms);const e=nE(c.ms);const extra=reembolsos2xMs(c.ms);const v=(rv||e)+extra;const es=!rv&&e>0;const st=r?rC(c):td0(c);return[<td key={i} style={{...st,...nZ(c,r),color:COLORS.ok,fontStyle:es?'italic':undefined}}>{v?fI(v):'—'}{es&&<span style={{fontSize:9,color:COLORS.mut,marginLeft:2,fontStyle:'normal',fontFamily:FONT.body}} title="Estimado">(est.)</span>}</td>,<td key={`p${i}`} style={tdP(c,r)}/>]})}</>)
const CR=({fn,rz:r}:{fn:(ms:number[])=>number;rz?:boolean})=>(<>{vc.map((c,i)=>{const v=fn(c.ms);const st=r?rC(c):td0(c);return[<td key={i} style={{...st,fontSize:13,color:COLORS.mut,fontStyle:'italic',fontFamily:FONT.heading}}>{v?fD(v):'—'}</td>,<td key={`p${i}`} style={tdP(c,r)}/>]})}</>)
const CB=({fn,max,min}:{fn:(ms:number[])=>number;max:number;min?:number})=>(<>{vc.map((c,i)=>{const v=fn(c.ms);const mn=min||0;const dentro=v>=mn&&v<=max;const cerca=!dentro&&(v>=mn-DESV_PCT&&v<=max+DESV_PCT);const bc=dentro?COLORS.ok:(cerca?COLORS.warn:'#E24B4A');const pctBar=Math.min(v,100);return[<td key={i} style={{...td0(c),...nZ(c),color:bc}}>{v?fP(v):'—'}<div style={{width:'100%',height:5,borderRadius:3,display:'flex',overflow:'hidden',marginTop:1}}><div style={{height:5,background:bc,width:`${pctBar}%`,borderRadius:'3px 0 0 3px',transition:'width 0.4s ease'}}/><div style={{height:5,background:'#E24B4A',flex:1,borderRadius:'0 3px 3px 0'}}/></div></td>,<td key={`p${i}`} style={tdP(c)}/>]})}</>)
const Sp=({fn}:{fn:(ms:number[])=>number})=>{const vs=ALL.map(m=>fn([m]));const mx=Math.max(...vs.map(v=>Math.abs(v)),1);return<span style={{display:'inline-flex',alignItems:'flex-end',gap:1,height:16,verticalAlign:'middle',marginLeft:6}}>{vs.map((v,i)=><span key={i} style={{width:3,borderRadius:'1px 1px 0 0',height:`${Math.max(Math.abs(v)/mx*16,v?1:0)}px`,background:v>0?COLORS.ok:v<0?COLORS.err:COLORS.brd}}/>)}</span>}
if(loading)return(<div style={{background:COLORS.bg,padding:'20px 24px',minHeight:'100vh'}}><h2 style={{color:COLORS.redSL,fontFamily:FONT.heading,fontSize:22,fontWeight:600,letterSpacing:'3px',margin:0,textTransform:'uppercase'}}>Running {año}</h2><p style={{fontFamily:FONT.body,fontSize:14,color:COLORS.mut,marginTop:4}}>Cargando…</p></div>)
const grupos=categorias.filter(c=>c.nivel===1&&c.id.startsWith('2.'))
const ingC=categorias.filter(c=>c.parent_id==='1.1'&&c.nivel===3)
let ri=0;const aB=()=>{const b=ri%2===0?'#fff':'#f0ede7';ri++;return b};const rA=()=>{ri=0}
const hv={onMouseEnter:(e:React.MouseEvent<HTMLTableRowElement>)=>{e.currentTarget.style.background=`${COLORS.bg}60`},onMouseLeave:(e:React.MouseEvent<HTMLTableRowElement>)=>{e.currentTarget.style.background=''}}
const blToggle=(k:string)=>sBl(p=>({...p,[k]:!p[k]}))
// header section: t1 sticky con fondo sólido propio + resto fila también pintada
const sectionRow=(content:React.ReactNode,cl:string,onClick?:()=>void)=>{const bg=COLORS.bg;return<tr style={{cursor:onClick?'pointer':'default'}} onClick={onClick}>
  <td style={{...t1,background:bg,fontFamily:FONT.heading,fontSize:13,letterSpacing:'2px',textTransform:'uppercase',color:cl,padding:'8px 8px 3px',borderBottom:`1.5px solid ${cl}40`,borderLeft:`3px solid ${cl}`,fontWeight:700}}>{content}</td>
  {vc.map((c,i)=>[<td key={i} style={{background:bg,borderBottom:`1.5px solid ${cl}40`,padding:0}}/>,<td key={`p${i}`} style={{background:bg,borderBottom:`1.5px solid ${cl}40`,padding:0}}/>])}
</tr>}
const sHBl=(l:string,key:string,cl:string)=>sectionRow(<><span style={{display:'inline-block',width:14,color:COLORS.redSL}}>{bloque[key]?'▾':'▸'}</span> {l}</>,cl,()=>blToggle(key))
const sH=(l:string,cl:string,x?:React.ReactNode)=>sectionRow(<>{l}{x}</>,cl)
const gR:React.CSSProperties={...t1,fontFamily:FONT.heading,fontSize:13,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.redSL,fontWeight:600,background:`#fff`}
const tR:React.CSSProperties={...t1,fontFamily:FONT.heading,fontSize:14,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.redSL,fontWeight:700,background:'#fff',borderTop:`2px solid ${COLORS.brd}`}
const rR:React.CSSProperties={...t1,fontFamily:FONT.heading,fontSize:15,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.ok,fontWeight:700,background:'#fff',borderTop:`2px solid ${COLORS.brd}`}
const sp=<tr><td colSpan={99} style={{height:5,border:'none',background:COLORS.bg,padding:0}}/></tr>
const pS:React.CSSProperties={...TABS_PILL.inactive,appearance:'none' as const,paddingRight:22,backgroundImage:"url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%237a8090' fill='none' stroke-width='1.5'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 6px center',cursor:'pointer'}
const rRow=(cl:string):React.CSSProperties=>({...r1(COLORS.ok),fontSize:13,color:cl,fontWeight:700,fontFamily:FONT.heading,textTransform:'uppercase',letterSpacing:'1px'})
const btnSL:React.CSSProperties={padding:'4px 10px',borderRadius:6,border:`1px solid ${COLORS.redSL}`,background:`${COLORS.redSL}10`,fontFamily:FONT.heading,fontSize:11,color:COLORS.redSL,cursor:'pointer',fontWeight:600,letterSpacing:'1px',textTransform:'uppercase'}
const monthHeadersRow=(labelText:string='')=><tr><th style={th1}>{labelText}</th>{vc.map((c,i)=>[<th key={i} style={thC(c)}>{c.label}</th>,<th key={`p${i}`} style={thP(c)}>%</th>])}</tr>
const tW=W_LABEL+vc.reduce((s,c)=>s+(c.isY?95:(c.isQ?100:(85+30))),0)
const tPO=(k:string)=>sPO(p=>({...p,[k]:!p[k]}))
const allPlatOpen=platOpen.uber&&platOpen.glovo&&platOpen.je&&platOpen.web
const togglePlatAll=()=>{const n=!allPlatOpen;sPO({uber:n,glovo:n,je:n,web:n})}
const platHeader=(name:string,color:string,key:string)=>{const bg=`${color}10`;return<tr style={{cursor:'pointer'}} onClick={()=>tPO(key)}>
  <td style={{...t1,background:bg,fontFamily:FONT.heading,fontSize:13,letterSpacing:'1.5px',textTransform:'uppercase',color:color,padding:'6px 8px 3px',borderLeft:`3px solid ${color}`,fontWeight:700}}>{platOpen[key]?'▾':'▸'} {name}</td>
  {vc.map((c,i)=>[<td key={i} style={{background:bg,padding:0}}/>,<td key={`p${i}`} style={{background:bg,padding:0}}/>])}
</tr>}
const platRow=(label:string,plat:string,field:keyof ResRow,negative?:boolean,color?:string)=><tr {...hv}><td style={{...t1,paddingLeft:18,fontSize:12,color:color||COLORS.mut}}>{label}</td>{vc.map((c,i)=>{const v=rSum(plat,field,c.ms);const st=td0(c);return[<td key={i} style={{...st,color:color||(negative?COLORS.err:COLORS.sec),fontFamily:v?FONT.heading:st.fontFamily,...(v?nZ(c):{})}}>{v?(negative?'−':'')+fI(v):'—'}</td>,<td key={`p${i}`} style={tdP(c)}/>]})}</tr>
const platNet=(name:string,plat:string)=><tr><td style={{...t1,paddingLeft:18,fontWeight:700,fontFamily:FONT.heading,fontSize:13,color:COLORS.ok,textTransform:'uppercase',letterSpacing:'1px',borderTop:`1px solid ${COLORS.brd}`}}>= Neto real {name}</td>{vc.map((c,i)=>{const v=rSum(plat,'neto_cobrado',c.ms);const st=td0(c);return[<td key={i} style={{...st,...nZ(c),color:COLORS.ok}}>{v?fI(v):'—'}</td>,<td key={`p${i}`} style={tdP(c)}/>]})}</tr>
const togglePyGAll=()=>{const n=!allBl;sBl({ing:n,dist:n,ratios:n});sAllBl(n)}
const toggleDetAll=()=>{const n=!aO;const nv:Record<string,boolean>={};['1','2.1','2.2','2.3','2.4'].forEach(k=>nv[k]=n);sD(nv);sAO(n)}
return(<div style={{background:COLORS.bg,padding:'20px 24px',minHeight:'100vh'}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:6}}>
<h2 style={{color:COLORS.redSL,fontFamily:FONT.heading,fontSize:22,fontWeight:600,letterSpacing:'3px',margin:0,textTransform:'uppercase'}}>RUNNING {año}</h2>
<div style={{display:'flex',gap:4,alignItems:'center'}}>
<input placeholder="🔍 Buscar..." value={buscar} onChange={e=>sBu(e.target.value)} style={{padding:'5px 10px',borderRadius:8,border:`0.5px solid ${COLORS.brd}`,background:COLORS.card,fontFamily:FONT.body,fontSize:12,color:COLORS.pri,width:140,outline:'none'}}/>
<div style={{...TABS_PILL.container}}><select value={año} onChange={e=>sA(Number(e.target.value))} style={pS}>{[2026,2025,2024].map(a=><option key={a} value={a}>{a}</option>)}</select></div>
<span style={{color:COLORS.brd}}>|</span>
<div style={{...TABS_PILL.container}}>{[{id:null as string|null,label:'Todos'},...titulares.map(t=>({id:t.id as string|null,label:t.nombre}))].map(t=><button key={t.id||'all'} style={(t.id===tId||(t.id===null&&!tId))?TABS_PILL.active:TABS_PILL.inactive} onClick={()=>{}}>{t.label}</button>)}</div>
</div></div>
<div ref={topRef} style={{overflowX:'scroll',overflowY:'hidden',height:14,background:'#e8e5df',borderRadius:7,border:`1px solid ${COLORS.brd}`,marginBottom:6}}><div style={{width:tW,height:1}}/></div>
<div style={{...CARDS.std,padding:0,overflow:'hidden'}}>
<div ref={mainRef} style={{overflowX:'auto',overflowY:'visible',width:'100%'}}>
<table style={{width:tW,borderCollapse:'separate',borderSpacing:0,minWidth:tW}}>
<thead><tr><th style={th1}>PyG <button onClick={togglePyGAll} style={{...btnSL,marginLeft:8}}>{allBl?'▴ Colapsar':'▾ Expandir'}</button></th>{vc.map((c,i)=>[<th key={i} style={thC(c)}>{c.label}</th>,<th key={`p${i}`} style={thP(c)}>%</th>])}</tr></thead>
<tbody>
{sHBl('Ingresos · Gastos · Resultado','ing',COLORS.redSL)}{rA() as any}
{bloque.ing&&<>
<tr {...hv}><td style={{...ingLabel,color:COLORS.sec}}>Facturación bruta</td><Cells fn={fB} estFn={fBisEst} rz/></tr>
<tr><td style={{...ingLabel,color:COLORS.ok}}>Ingresos netos</td><CI rz/></tr>
<tr {...hv}><td style={{...r1(),color:COLORS.mut,fontSize:12}}><span style={{color:BL,fontWeight:600}}>Pedidos</span> · <span style={{color:COLORS.warn}}>TM Bruto</span> / <span style={{color:COLORS.ok}}>TM Neto</span></td><CTM rz/></tr>
{sp}
<tr {...hv}><td style={{...r1(COLORS.err),fontFamily:FONT.heading,fontSize:14,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.sec,fontWeight:600}}>Gastos fijos</td><Cells fn={gF} pctFn={ms=>po(gF(ms),fB(ms))} rz tip="% sobre Facturación bruta"/></tr>
<tr {...hv}><td style={{...r1(COLORS.err),fontFamily:FONT.heading,fontSize:14,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.sec,fontWeight:600}}>Gastos variables</td><Cells fn={gV} pctFn={ms=>po(gV(ms),fB(ms))} rz tip="% sobre Facturación bruta"/></tr>
<tr><td style={{...tR,borderLeft:`3px solid ${COLORS.err}`}}>Total gastos</td><Cells fn={gT} pctFn={ms=>po(gT(ms),fB(ms))} rz tip="% sobre Facturación bruta"/></tr>
{sp}
<tr><td style={{...rR,borderLeft:`3px solid ${COLORS.ok}`}}>Resultado <Sp fn={re}/></td><Cells fn={re} sign rz/></tr>
{sp}
</>}
{sHBl('Distribución de gastos','dist',COLORS.warn)}{rA() as any}
{bloque.dist&&<>
{grupos.map(g=>{const bn=gB(g.id);const bI=bn?` (${bn.pct_min}-${bn.pct_max}%)`:'';const nm=LBL[g.id]||g.nombre;return<tr key={g.id} {...hv}><td style={{...gR,borderLeft:`3px solid ${COLORS.warn}`}}>{nm}<span style={{color:COLORS.mut,fontSize:10,fontWeight:400}}>{bI}</span></td><CB fn={ms=>po(gP(g.id,ms),iM(ms))} max={bn?bn.pct_max:15} min={bn?bn.pct_min:0}/></tr>})}
<tr><td style={{...rR,borderLeft:`3px solid ${COLORS.warn}`}}>Resultado <Sp fn={ms=>po(re(ms),iM(ms))}/></td><Cells fn={ms=>po(re(ms),iM(ms))} pct sign/></tr>
{sp}
</>}
{sHBl('Ratios','ratios',COLORS.ok)}{rA() as any}
{bloque.ratios&&<>
<tr><td style={rRow(RATIO_COLORS.margen)}>MARGEN BRUTO</td><Cells fn={mB} pctFn={ms=>po(mB(ms),iM(ms))} sign vc={COLORS.ok} rz/></tr>
<tr {...hv}><td style={rRow(RATIO_COLORS.food)}>FOOD COST %</td><Cells fn={ms=>po(gP('2.1',ms),iM(ms))} pct rz/></tr>
<tr {...hv}><td style={rRow(RATIO_COLORS.labor)}>LABOR COST %</td><Cells fn={ms=>po(gP('2.2',ms),iM(ms))} pct rz/></tr>
<tr {...hv}><td style={rRow(RATIO_COLORS.ratio)}>RATIO ING/GASTOS</td><Cells fn={ms=>{const g=gT(ms);return g?Math.round(iM(ms)/g*100)/100:0}} rz/></tr>
<tr {...hv}><td style={rRow(RATIO_COLORS.coste)}>COSTE/PEDIDO</td><CR fn={ms=>{const p=pe(ms);return p?gT(ms)/p:0}} rz/></tr>
<tr {...hv}><td style={{...rRow(RATIO_COLORS.coste),paddingLeft:22,fontSize:11,fontWeight:400,fontStyle:'italic',color:COLORS.mut}}>— Fijos/pedido</td><CR fn={ms=>{const p=pe(ms);return p?gF(ms)/p:0}} rz/></tr>
<tr {...hv}><td style={{...rRow(RATIO_COLORS.coste),paddingLeft:22,fontSize:11,fontWeight:400,fontStyle:'italic',color:COLORS.mut}}>— Variables/pedido</td><CR fn={ms=>{const p=pe(ms);return p?gV(ms)/p:0}} rz/></tr>
<tr {...hv}><td style={rRow(RATIO_COLORS.neto)}>MARGEN NETO/PEDIDO</td><CR fn={ms=>{const p=pe(ms);return p?re(ms)/p:0}} rz/></tr>
<tr><td style={{...t1,fontFamily:FONT.heading,fontSize:13,textTransform:'uppercase',color:BL,fontWeight:700,background:'#fff',borderTop:'2px dashed #1E5BCC',borderBottom:'2px dashed #1E5BCC',borderLeft:`3px solid ${BL}`}}>BREAK-EVEN</td><Cells fn={gF}/></tr>
<tr {...hv}><td style={rRow(RATIO_COLORS.directo)}>COSTE DIRECTO</td><Cells fn={cD} pct rz alertMax={60}/></tr>
</>}
<tr><td colSpan={99} style={{height:14,border:'none',background:COLORS.bg,padding:0}}/></tr>
{sH('Desglose por plataforma',COLORS.mut,<>
<button onClick={(e)=>{e.stopPropagation();togglePlatAll()}} style={{...btnSL,marginLeft:10}}>{allPlatOpen?'▴':'▾'}</button>
<span style={{marginLeft:8,fontSize:10,color:COLORS.mut+'90',fontWeight:400,textTransform:'none',letterSpacing:0,cursor:'pointer'}} onClick={()=>sDP(p=>!p)}>{dPlat?'▾':'▸'}</span>
</>)}
{monthHeadersRow('Plataforma')}
{dPlat&&<>
{platHeader('Uber Eats','#1D9E75','uber')}
{platOpen.uber&&<>
{platRow('Bruto pagado por cliente','uber','bruto')}
{platRow('Comisión Uber + IVA','uber','comisiones',true)}
{platRow('Tasa semanal mant. + IVA','uber','tasa_mantenimiento',true)}
{platRow('Tasa Uber One/pedido + IVA','uber','tasa_uber_one',true)}
{platRow('Reembolsos a clientes','uber','reembolsos_clientes',true)}
{platRow('Ads','uber','ads',true)}
{platRow('Reembolsos cobrados 2x','uber','reembolsos_2x',false,COLORS.ok)}
{platNet('Uber','uber')}
</>}
{sp}
{platHeader('Glovo','#FFC244','glovo')}
{platOpen.glovo&&<>
{platRow('Bruto pagado por cliente','glovo','bruto')}
{platRow('Comisión Glovo + IVA','glovo','comisiones',true)}
{platRow('Fees + IVA','glovo','fees',true)}
{platRow('Cargos promoción','glovo','cargos_promocion',true)}
{platRow('Ads','glovo','ads',true)}
{platNet('Glovo','glovo')}
</>}
{sp}
{platHeader('Just Eat','#FF8000','je')}
{platOpen.je&&<>
{platRow('Bruto pagado por cliente','just_eat','bruto')}
{platRow('Comisión Just Eat + IVA','just_eat','comisiones',true)}
{platRow('Coste gestión/pedido + IVA','just_eat','coste_gestion_je',true)}
{platRow('Fees + IVA','just_eat','fees',true)}
{platRow('Ads','just_eat','ads',true)}
{platNet('Just Eat','just_eat')}
</>}
{sp}
{platHeader('Tienda online','#1E5BCC','web')}
{platOpen.web&&<>
{platRow('Bruto pagado por cliente','web','bruto')}
{platRow('Comisión pasarela pago','web','comisiones',true)}
{platNet('Tienda online','web')}
</>}
</>}
<tr><td colSpan={99} style={{height:14,border:'none',background:COLORS.bg,padding:0}}/></tr>
{sH('Detalle por categoría',COLORS.mut,<button onClick={(e)=>{e.stopPropagation();toggleDetAll()}} style={{...btnSL,marginLeft:10}}>{aO?'▴':'▾'}</button>)}{rA() as any}
{monthHeadersRow('Categoría')}
<tr style={{cursor:'pointer'}} onClick={()=>sD(p=>({...p,'1':!p['1']}))}><td style={gR}>{det['1']?'▾':'▸'} 1 · Ingresos por operación</td><Cells fn={iM} estFn={iMisEst}/></tr>
{det['1']&&<>
<tr style={{background:aB()}}><td style={{...t1,paddingLeft:18,fontWeight:600,fontSize:13}}>1.1 · Ingresos netos por ventas</td><Cells fn={iT}/></tr>
{ingC.filter(c=>vi(c.nombre)).map(c=>{const b=aB();const isUber=c.id==='1.1.1'||c.nombre.toLowerCase().includes('uber');return[<tr key={c.id} style={{background:b}} {...hv}><td style={{...t1,paddingLeft:30,fontSize:13}}>{c.id} · {c.nombre}</td><Cells fn={ms=>sumMeses(ingresos[c.id]||{},ms)} pctFn={ms=>po(sumMeses(ingresos[c.id]||{},ms),iM(ms))}/></tr>,isUber?<tr key={c.id+'-r2x'} style={{background:aB()}} {...hv}><td style={{...t1,paddingLeft:46,color:COLORS.mut,fontSize:12}}>1.1.1.1 · Reembolsos Uber 2x</td><Cells fn={reembolsos2xMs}/></tr>:null].filter(Boolean)}).flat()}
<tr style={{background:aB()}}><td style={{...t1,paddingLeft:18,fontWeight:600,fontSize:13}}>1.2 · Facturación bruta por ventas</td><Cells fn={fB} estFn={fBisEst}/></tr>
</>}{sp}
{grupos.map(g=>{const bn=gB(g.id);const bL=bn?` (${bn.pct_min}-${bn.pct_max}%)`:'';const sN=cN2.filter(c=>c.parent_id===g.id);const nm=LBL[g.id]||g.nombre;const op=!!det[g.id];return[
<tr key={`h-${g.id}`} style={{cursor:'pointer'}} onClick={()=>sD(p=>({...p,[g.id]:!p[g.id]}))}><td style={gR}>{op?'▾':'▸'} {g.id} · {nm}<span style={{color:COLORS.mut,fontSize:10,fontWeight:400}}>{bL}</span></td><Cells fn={ms=>gP(g.id,ms)} pctFn={ms=>po(gP(g.id,ms),iM(ms))}/></tr>,
...(op?sN.flatMap(sub=>{const ch=cCh(sub.id);return[
<tr key={sub.id} style={{background:aB(),cursor:'pointer'}} onClick={()=>sD(p=>({...p,[sub.id]:!p[sub.id]}))}><td style={{...t1,paddingLeft:18,fontWeight:600,fontSize:13}}>{det[sub.id]!==false?'▾':'▸'} {sub.id} · {sub.nombre}</td><Cells fn={ms=>sumCatMeses(gastos,sub.id,ms)} pctFn={ms=>po(sumCatMeses(gastos,sub.id,ms),iM(ms))}/></tr>,
...(det[sub.id]!==false?ch.filter(c=>vi(c.nombre)).map(c=><tr key={c.id} style={{background:aB()}} {...hv}><td style={{...t1,paddingLeft:34,color:COLORS.mut,fontSize:12}}>{c.id} · {c.nombre}</td><Cells fn={ms=>sumMeses(gastos[c.id]||{},ms)} pctFn={ms=>po(sumMeses(gastos[c.id]||{},ms),iM(ms))}/></tr>):[]),
].filter(Boolean)}):[]),
sp].filter(Boolean)}).flat()}
</tbody></table></div></div></div>)
}
