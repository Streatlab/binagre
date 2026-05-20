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
const fI=(n:number):string=>{if(!n)return'—';const a=Math.abs(n);return(n<0?'−':'')+Math.round(a).toLocaleString('es-ES',{useGrouping:true})}
const fD=(n:number):string=>{if(!n)return'—';const a=Math.abs(n);return(n<0?'−':'')+a.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:true})}
const fP=(v:number)=>v?`${v.toFixed(1)}%`:'—'
const po=(p:number,t:number)=>t?(p/t)*100:0
const DESV_PCT=5
const W_LABEL=210
const W_MES=85
const W_PCT=42
const W_TRI=95
const W_YEAR=100
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
const scrollRef=useRef<HTMLDivElement|null>(null)
const tId=filtro==='unificado'?null:filtro
const{ingresos,gastos,facturacionFutura,brutos,pedidosCanal,categorias,benchmarks,comisiones,feesFijos,marcasActivas,loading}=useRunningAnual(año,tId)
useEffect(()=>{(async()=>{const{data}=await supabase.from('resumenes_plataforma_marca_mensual').select('*').eq('año',año);sRes((data||[])as ResRow[])})()},[año])
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
// UNA SOLA tabla: meses + trimestres + AÑO al final
const cols=useMemo(()=>{const c:Col[]=[];for(let q=1;q<=4;q++){QM[q].forEach(m=>c.push({label:MN[m-1],ms:[m],isCur:m===cM}));c.push({label:`${q}T`,ms:QM[q],isQ:true,qn:q})};c.push({label:'AÑO',ms:ALL,isY:true});return c},[])
// Autocentrar mes actual
useEffect(()=>{if(loading)return;const el=scrollRef.current;if(!el)return;const idx=cols.findIndex(c=>c.isCur);if(idx<0)return;let pos=W_LABEL;for(let i=0;i<idx;i++){const c=cols[i];pos+=(c.isY?W_YEAR:(c.isQ?W_TRI:(W_MES+W_PCT)))}
const viewW=el.clientWidth;el.scrollLeft=Math.max(0,pos-viewW/2+W_MES/2)},[loading,cols])
const cN2=useMemo(()=>categorias.filter(c=>c.nivel===2),[categorias])
const cCh=(pid:string)=>categorias.filter(c=>c.parent_id===pid&&c.nivel===3).sort((a,b)=>sumMeses(gastos[b.id]||{},ALL)-sumMeses(gastos[a.id]||{},ALL))
const cQ=(c:Col)=>{for(let q=1;q<=4;q++){if(c.isQ&&c.qn===q)return q;if(!c.isQ&&!c.isY&&QM[q].includes(c.ms[0]))return q};return 0}
const colBg=(c:Col,resumen?:boolean):string=>{if(c.isCur&&!c.isQ&&!c.isY)return CUR_BG;const q=cQ(c);if(c.isQ&&q)return Q_TOT[q-1];if(c.isY)return`${COLORS.redSL}08`;if(q)return resumen?Q_RES[q-1]:Q_MES[q-1];return'transparent'}
const thC=(c:Col):React.CSSProperties=>{const q=cQ(c);const qy=c.isQ||c.isY;return{fontFamily:FONT.heading,fontSize:12,fontWeight:qy?700:(c.isCur?700:500),letterSpacing:'1.5px',textTransform:'uppercase',textAlign:'right',padding:'4px 4px',borderBottom:`1px solid ${COLORS.brd}`,whiteSpace:'nowrap',userSelect:'none',color:qy?(c.isY?COLORS.redSL:QCL[q-1]):(c.isCur?'#fff':COLORS.mut),background:c.isCur&&!qy?BL:(c.isQ&&q?Q_HDR[q-1]:(c.isY?`${COLORS.redSL}14`:(q?Q_MES[q-1]:COLORS.bg)))}}
const th1:React.CSSProperties={fontFamily:FONT.heading,fontSize:12,fontWeight:600,letterSpacing:'1.5px',color:COLORS.mut,textTransform:'uppercase',textAlign:'left',padding:'4px 5px',background:COLORS.bg,borderBottom:`1px solid ${COLORS.brd}`,whiteSpace:'nowrap',position:'sticky',left:0,zIndex:6}
const thP=(c:Col):React.CSSProperties=>({...thC(c),fontSize:9,color:c.isCur?'rgba(255,255,255,.7)':(COLORS.mut+'70'),padding:'4px 1px'})
const td0=(c:Col,resumen?:boolean):React.CSSProperties=>{const qy=c.isQ||c.isY;return{padding:'1px 4px',fontSize:14,fontFamily:FONT.body,color:COLORS.sec,borderBottom:`0.5px solid ${COLORS.brd}18`,whiteSpace:'nowrap',textAlign:'right',verticalAlign:'middle',fontVariantNumeric:'tabular-nums',lineHeight:1.2,fontWeight:qy?600:(c.isCur?500:400),background:colBg(c,resumen)}}
const t1:React.CSSProperties={padding:'1px 5px',fontSize:14,fontFamily:FONT.body,color:COLORS.sec,borderBottom:`0.5px solid ${COLORS.brd}18`,whiteSpace:'nowrap',textAlign:'left',position:'sticky',left:0,zIndex:1,verticalAlign:'middle',background:'#fff'}
const tdP=(c:Col,resumen?:boolean):React.CSSProperties=>({...td0(c,resumen),fontSize:11,color:COLORS.mut+'90',padding:'1px 1px'})
// Tamaño UNIFORME para todos los números
const nZ=():React.CSSProperties=>({fontFamily:FONT.heading,fontSize:15,fontWeight:600,letterSpacing:'0.3px'})
const r1=(bc?:string):React.CSSProperties=>({...t1,background:'#fff',borderLeft:`3px solid ${bc||COLORS.redSL}`,fontSize:14})
const ingLabel:React.CSSProperties={...r1(),fontFamily:FONT.heading,fontSize:14,letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:600}

const Cells=({fn,sign,pct,pctFn,alertMax,vc:vcl,tip,estFn}:{fn:(ms:number[])=>number;sign?:boolean;pct?:boolean;pctFn?:(ms:number[])=>number;alertMax?:number;vc?:string;tip?:string;estFn?:(ms:number[])=>boolean})=>(<>{cols.map((c,i)=>{const v=fn(c.ms);const cl=vcl||(sign?(v>0?COLORS.ok:v<0?COLORS.err:COLORS.mut):undefined);const st=td0(c);const es=estFn?estFn(c.ms):false;const vt=<td key={i} style={{...st,color:cl||st.color,...(v&&!pct?nZ():{}),fontFamily:v&&!pct?FONT.heading:st.fontFamily,fontStyle:es?'italic':undefined}}>{pct?fP(v):v?fI(v):'—'}{es&&v?<span style={{fontSize:9,color:COLORS.mut,marginLeft:2,fontStyle:'normal',fontFamily:FONT.body}} title="Estimado">(est.)</span>:null}</td>;if(c.isY)return vt;if(pctFn){const pv=pctFn(c.ms);const ov=alertMax&&pv>alertMax;return[vt,<td key={`p${i}`} style={{...tdP(c),color:ov?COLORS.err:undefined,fontWeight:ov?600:undefined}} title={tip}>{pv?(ov?<span style={{display:'inline-flex',alignItems:'center',gap:1}}><span style={{fontSize:11}}>⚠</span>{pv.toFixed(1)}%</span>:`${pv.toFixed(1)}%`):'—'}</td>]}return[vt,<td key={`p${i}`} style={tdP(c)}/>]})}</>)
const CTM=()=>(<>{cols.map((c,i)=>{const p=pe(c.ms);const tb=tB(c.ms);const tn=tN(c.ms);const st=td0(c);return[<td key={i} style={{...st,fontFamily:FONT.heading,fontSize:13,fontWeight:600}}>{p?<><span style={{color:BL}}>{fI(p)}</span>{' '}<span style={{color:COLORS.warn}}>{fD(tb)}</span><span style={{color:COLORS.mut}}>/</span><span style={{color:COLORS.ok}}>{fD(tn)}</span></>:'—'}</td>,c.isY?null:<td key={`p${i}`} style={tdP(c)}/>].filter(Boolean)})}</>)
const CI=()=>(<>{cols.map((c,i)=>{const rv=iT(c.ms);const e=nE(c.ms);const extra=reembolsos2xMs(c.ms);const v=(rv||e)+extra;const es=!rv&&e>0;const st=td0(c);return[<td key={i} style={{...st,...nZ(),color:COLORS.ok,fontStyle:es?'italic':undefined}}>{v?fI(v):'—'}{es&&<span style={{fontSize:9,color:COLORS.mut,marginLeft:2,fontStyle:'normal',fontFamily:FONT.body}} title="Estimado">(est.)</span>}</td>,c.isY?null:<td key={`p${i}`} style={tdP(c)}/>].filter(Boolean)})}</>)
const CR=({fn}:{fn:(ms:number[])=>number})=>(<>{cols.map((c,i)=>{const v=fn(c.ms);const st=td0(c);return[<td key={i} style={{...st,fontSize:13,color:COLORS.mut,fontStyle:'italic',fontFamily:FONT.heading}}>{v?fD(v):'—'}</td>,c.isY?null:<td key={`p${i}`} style={tdP(c)}/>].filter(Boolean)})}</>)
const CB=({fn,max,min}:{fn:(ms:number[])=>number;max:number;min?:number})=>(<>{cols.map((c,i)=>{const v=fn(c.ms);const mn=min||0;const dentro=v>=mn&&v<=max;const cerca=!dentro&&(v>=mn-DESV_PCT&&v<=max+DESV_PCT);const bc=dentro?COLORS.ok:(cerca?COLORS.warn:'#E24B4A');const pctBar=Math.min(v,100);return[<td key={i} style={{...td0(c),...nZ(),color:bc}}>{v?fP(v):'—'}<div style={{width:'100%',height:4,borderRadius:3,display:'flex',overflow:'hidden',marginTop:1}}><div style={{height:4,background:bc,width:`${pctBar}%`,borderRadius:'3px 0 0 3px',transition:'width 0.4s ease'}}/><div style={{height:4,background:'#E24B4A',flex:1,borderRadius:'0 3px 3px 0'}}/></div></td>,c.isY?null:<td key={`p${i}`} style={tdP(c)}/>].filter(Boolean)})}</>)
const Sp=({fn}:{fn:(ms:number[])=>number})=>{const vs=ALL.map(m=>fn([m]));const mx=Math.max(...vs.map(v=>Math.abs(v)),1);return<span style={{display:'inline-flex',alignItems:'flex-end',gap:1,height:16,verticalAlign:'middle',marginLeft:6}}>{vs.map((v,i)=><span key={i} style={{width:3,borderRadius:'1px 1px 0 0',height:`${Math.max(Math.abs(v)/mx*16,v?1:0)}px`,background:v>0?COLORS.ok:v<0?COLORS.err:COLORS.brd}}/>)}</span>}

if(loading)return(<div style={{background:COLORS.bg,padding:'20px 24px',minHeight:'100vh'}}><h2 style={{color:COLORS.redSL,fontFamily:FONT.heading,fontSize:22,fontWeight:600,letterSpacing:'3px',margin:0,textTransform:'uppercase'}}>Running {año}</h2><p style={{fontFamily:FONT.body,fontSize:14,color:COLORS.mut,marginTop:4}}>Cargando…</p></div>)
const grupos=categorias.filter(c=>c.nivel===1&&c.id.startsWith('2.'))
const ingC=categorias.filter(c=>c.parent_id==='1.1'&&c.nivel===3)
let ri=0;const aB=()=>{const b=ri%2===0?'#fff':'#f0ede7';ri++;return b};const rA=()=>{ri=0}
const hv={onMouseEnter:(e:React.MouseEvent<HTMLTableRowElement>)=>{e.currentTarget.style.background=`${COLORS.bg}60`},onMouseLeave:(e:React.MouseEvent<HTMLTableRowElement>)=>{e.currentTarget.style.background=''}}
const blToggle=(k:string)=>sBl(p=>({...p,[k]:!p[k]}))
const sHBl=(l:string,key:string,cl:string)=><tr key={`hbl-${key}`} style={{cursor:'pointer'}} onClick={()=>blToggle(key)}><td colSpan={99} style={{...t1,background:COLORS.bg,fontFamily:FONT.heading,fontSize:13,letterSpacing:'2px',textTransform:'uppercase',color:cl,padding:'8px 5px 3px',borderBottom:`1.5px solid ${cl}40`,borderLeft:`3px solid ${cl}`,fontWeight:700}}><span style={{display:'inline-block',width:14,color:COLORS.redSL}}>{bloque[key]?'▾':'▸'}</span> {l}</td></tr>
const sH=(l:string,cl:string,x?:React.ReactNode)=><tr key={`h-${l}`}><td colSpan={99} style={{...t1,background:COLORS.bg,fontFamily:FONT.heading,fontSize:13,letterSpacing:'2px',textTransform:'uppercase',color:cl,padding:'8px 5px 3px',borderBottom:`1.5px solid ${cl}40`,borderLeft:`3px solid ${cl}`,fontWeight:700}}>{l}{x}</td></tr>
const gR:React.CSSProperties={...t1,fontFamily:FONT.heading,fontSize:14,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.redSL,fontWeight:600,background:`${COLORS.redSL}06`}
const tR:React.CSSProperties={...t1,fontFamily:FONT.heading,fontSize:14,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.redSL,fontWeight:700,background:`${COLORS.redSL}0C`,borderTop:`2px solid ${COLORS.brd}`}
const rR:React.CSSProperties={...t1,fontFamily:FONT.heading,fontSize:15,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.ok,fontWeight:700,background:`${COLORS.ok}0C`,borderTop:`2px solid ${COLORS.brd}`}
const sp=(k:string)=><tr key={`sp-${k}`}><td colSpan={99} style={{height:5,border:'none',background:COLORS.bg,padding:0}}/></tr>
const pS:React.CSSProperties={...TABS_PILL.inactive,appearance:'none' as const,paddingRight:22,backgroundImage:"url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%237a8090' fill='none' stroke-width='1.5'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 6px center',cursor:'pointer'}
const rRow=(cl:string):React.CSSProperties=>({...r1(COLORS.ok),fontSize:13,color:cl,fontWeight:700,fontFamily:FONT.heading,textTransform:'uppercase',letterSpacing:'1px'})
const btnSL:React.CSSProperties={padding:'4px 10px',borderRadius:6,border:`1px solid ${COLORS.redSL}`,background:`${COLORS.redSL}10`,fontFamily:FONT.heading,fontSize:11,color:COLORS.redSL,cursor:'pointer',fontWeight:600,letterSpacing:'1px',textTransform:'uppercase'}

const tPO=(k:string)=>sPO(p=>({...p,[k]:!p[k]}))
const allPlatOpen=platOpen.uber&&platOpen.glovo&&platOpen.je&&platOpen.web
const togglePlatAll=()=>{const n=!allPlatOpen;sPO({uber:n,glovo:n,je:n,web:n})}
const platHeader=(name:string,color:string,key:string)=><tr key={`ph-${key}`} style={{cursor:'pointer'}} onClick={()=>tPO(key)}><td colSpan={99} style={{...t1,background:`${color}10`,fontFamily:FONT.heading,fontSize:13,letterSpacing:'1.5px',textTransform:'uppercase',color:color,padding:'6px 5px 3px',borderLeft:`3px solid ${color}`,fontWeight:700}}>{platOpen[key]?'▾':'▸'} {name}</td></tr>
const platRow=(label:string,plat:string,field:keyof ResRow,negative?:boolean,color?:string)=>(<tr key={`pl-${plat}-${field}`} {...hv}><td style={{...t1,paddingLeft:14,fontSize:13,color:color||COLORS.mut}}>{label}</td>{cols.map((c,i)=>{const v=rSum(plat,field,c.ms);const st=td0(c);return[<td key={i} style={{...st,color:color||(negative?COLORS.err:COLORS.sec),fontFamily:v?FONT.heading:st.fontFamily,...(v?nZ():{})}}>{v?(negative?'−':'')+fI(v):'—'}</td>,c.isY?null:<td key={`p${i}`} style={tdP(c)}/>].filter(Boolean)})}</tr>)
const platNet=(name:string,plat:string)=><tr key={`pn-${plat}`}><td style={{...t1,paddingLeft:14,fontWeight:700,fontFamily:FONT.heading,fontSize:13,color:COLORS.ok,textTransform:'uppercase',letterSpacing:'1px',borderTop:`1px solid ${COLORS.brd}`}}>= Neto real cobrado {name}</td>{cols.map((c,i)=>{const v=rSum(plat,'neto_cobrado',c.ms);const st=td0(c);return[<td key={i} style={{...st,...nZ(),color:COLORS.ok}}>{v?fI(v):'—'}</td>,c.isY?null:<td key={`p${i}`} style={tdP(c)}/>].filter(Boolean)})}</tr>
const togglePyGAll=()=>{const n=!allBl;sBl({ing:n,dist:n,ratios:n});sAllBl(n)}
const toggleDetAll=()=>{const n=!aO;const nv:Record<string,boolean>={};['1','2.1','2.2','2.3','2.4'].forEach(k=>nv[k]=n);sD(nv);sAO(n)}

// Calcular ancho total para forzar scroll
const totalW=W_LABEL+cols.reduce((s,c)=>s+(c.isY?W_YEAR:(c.isQ?W_TRI:(W_MES+W_PCT))),0)

const buildRows=()=>{
  const rows:React.ReactNode[]=[]
  rA()
  rows.push(sHBl('Ingresos · Gastos · Resultado','ing',COLORS.redSL))
  if(bloque.ing){
    rows.push(<tr key="fb" {...hv}><td style={{...ingLabel,color:COLORS.sec}}>Facturación bruta</td><Cells fn={fB} estFn={fBisEst}/></tr>)
    rows.push(<tr key="in"><td style={{...ingLabel,color:COLORS.ok}}>Ingresos netos</td><CI/></tr>)
    rows.push(<tr key="pd" {...hv}><td style={{...r1(),color:COLORS.mut}}><span style={{color:BL,fontWeight:600}}>Pedidos</span> · <span style={{color:COLORS.warn}}>TM Bruto</span> / <span style={{color:COLORS.ok}}>TM Neto</span></td><CTM/></tr>)
    rows.push(sp('a'))
    rows.push(<tr key="gf" {...hv}><td style={{...r1(COLORS.err),fontFamily:FONT.heading,fontSize:14,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.sec,fontWeight:600}}>Gastos fijos</td><Cells fn={gF} pctFn={ms=>po(gF(ms),fB(ms))} tip="% sobre Facturación bruta"/></tr>)
    rows.push(<tr key="gv" {...hv}><td style={{...r1(COLORS.err),fontFamily:FONT.heading,fontSize:14,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.sec,fontWeight:600}}>Gastos variables</td><Cells fn={gV} pctFn={ms=>po(gV(ms),fB(ms))} tip="% sobre Facturación bruta"/></tr>)
    rows.push(<tr key="tg"><td style={{...tR,borderLeft:`3px solid ${COLORS.err}`}}>Total gastos</td><Cells fn={gT} pctFn={ms=>po(gT(ms),fB(ms))} tip="% sobre Facturación bruta"/></tr>)
    rows.push(sp('b'))
    rows.push(<tr key="res"><td style={{...rR,borderLeft:`3px solid ${COLORS.ok}`}}>Resultado <span style={{fontSize:10,color:COLORS.mut,fontWeight:400}}>(Ingresos − Gastos)</span> <Sp fn={re}/></td><Cells fn={re} sign/></tr>)
    rows.push(sp('c'))
  }
  rows.push(sHBl('Distribución de gastos · % s/Ingresos netos','dist',COLORS.warn))
  if(bloque.dist){
    for(const g of grupos){
      const bn=gB(g.id);const bI=bn?` (${bn.pct_min}-${bn.pct_max}%)`:'';const nm=LBL[g.id]||g.nombre
      rows.push(<tr key={`gd-${g.id}`} {...hv}><td style={{...gR,borderLeft:`3px solid ${COLORS.warn}`}}>{nm}<span style={{color:COLORS.mut,fontSize:10,fontWeight:400}}>{bI}</span></td><CB fn={ms=>po(gP(g.id,ms),iM(ms))} max={bn?bn.pct_max:15} min={bn?bn.pct_min:0}/></tr>)
    }
    rows.push(<tr key="resd"><td style={{...rR,borderLeft:`3px solid ${COLORS.warn}`}}>Resultado <Sp fn={ms=>po(re(ms),iM(ms))}/></td><Cells fn={ms=>po(re(ms),iM(ms))} pct sign/></tr>)
    rows.push(sp('d'))
  }
  rows.push(sHBl('Ratios','ratios',COLORS.ok))
  if(bloque.ratios){
    rows.push(<tr key="mb"><td style={rRow(RATIO_COLORS.margen)}>MARGEN BRUTO <span style={{fontSize:10,color:COLORS.mut,fontWeight:400}}>(Ingresos − Producto)</span></td><Cells fn={mB} pctFn={ms=>po(mB(ms),iM(ms))} sign vc={COLORS.ok}/></tr>)
    rows.push(<tr key="fc" {...hv}><td style={rRow(RATIO_COLORS.food)}>FOOD COST % <span style={{fontSize:10,color:COLORS.mut,fontWeight:400}}>(Producto / Ingresos)</span></td><Cells fn={ms=>po(gP('2.1',ms),iM(ms))} pct/></tr>)
    rows.push(<tr key="lc" {...hv}><td style={rRow(RATIO_COLORS.labor)}>LABOR COST % <span style={{fontSize:10,color:COLORS.mut,fontWeight:400}}>(Equipo / Ingresos)</span></td><Cells fn={ms=>po(gP('2.2',ms),iM(ms))} pct/></tr>)
    rows.push(<tr key="ri" {...hv}><td style={rRow(RATIO_COLORS.ratio)}>RATIO ING/GASTOS <span style={{fontSize:10,color:COLORS.mut,fontWeight:400}}>(€ por € gastado)</span></td><Cells fn={ms=>{const g=gT(ms);return g?Math.round(iM(ms)/g*100)/100:0}}/></tr>)
    rows.push(<tr key="cp" {...hv}><td style={rRow(RATIO_COLORS.coste)}>COSTE POR PEDIDO <span style={{fontSize:10,color:COLORS.mut,fontWeight:400}}>(Gastos / Pedidos)</span></td><CR fn={ms=>{const p=pe(ms);return p?gT(ms)/p:0}}/></tr>)
    rows.push(<tr key="cpf" {...hv}><td style={{...rRow(RATIO_COLORS.coste),paddingLeft:20,fontSize:12,fontWeight:400,fontStyle:'italic',color:COLORS.mut}}>— Fijos/pedido</td><CR fn={ms=>{const p=pe(ms);return p?gF(ms)/p:0}}/></tr>)
    rows.push(<tr key="cpv" {...hv}><td style={{...rRow(RATIO_COLORS.coste),paddingLeft:20,fontSize:12,fontWeight:400,fontStyle:'italic',color:COLORS.mut}}>— Variables/pedido</td><CR fn={ms=>{const p=pe(ms);return p?gV(ms)/p:0}}/></tr>)
    rows.push(<tr key="mn" {...hv}><td style={rRow(RATIO_COLORS.neto)}>MARGEN NETO/PEDIDO <span style={{fontSize:10,color:COLORS.mut,fontWeight:400}}>(Resultado / Pedidos)</span></td><CR fn={ms=>{const p=pe(ms);return p?re(ms)/p:0}}/></tr>)
    rows.push(<tr key="be"><td style={{...t1,fontFamily:FONT.heading,fontSize:13,textTransform:'uppercase',color:BL,fontWeight:700,background:'rgba(30,91,204,.06)',borderTop:'2px dashed #1E5BCC',borderBottom:'2px dashed #1E5BCC',borderLeft:`3px solid ${BL}`}}>BREAK-EVEN <span style={{fontSize:10,color:COLORS.mut,fontWeight:400}}>(Mínimo para cubrir fijos)</span></td><Cells fn={gF}/></tr>)
    rows.push(<tr key="cd" {...hv}><td style={rRow(RATIO_COLORS.directo)}>COSTE DIRECTO <span style={{color:COLORS.mut,fontSize:10,fontWeight:400}}>(Producto + Equipo · obj &lt;60%)</span></td><Cells fn={cD} pct alertMax={60}/></tr>)
  }
  rows.push(<tr key="spe1"><td colSpan={99} style={{height:14,border:'none',background:COLORS.bg,padding:0}}/></tr>)
  rows.push(sH('Desglose por plataforma',COLORS.mut,<>
    <button onClick={(e)=>{e.stopPropagation();togglePlatAll()}} style={{...btnSL,marginLeft:10}}>{allPlatOpen?'▴ Colapsar todo':'▾ Expandir todo'}</button>
    <span style={{marginLeft:8,fontSize:10,color:COLORS.mut+'90',fontWeight:400,textTransform:'none',letterSpacing:0,cursor:'pointer'}} onClick={()=>sDP(p=>!p)}>{dPlat?'▾ ocultar':'▸ mostrar'}</span>
  </>))
  if(dPlat){
    const plats:Array<[string,string,string]>=[['Uber Eats','#1D9E75','uber'],['Glovo','#FFC244','glovo'],['Just Eat','#FF8000','je'],['Tienda online','#1E5BCC','web']]
    for(const[name,color,key] of plats){
      rows.push(platHeader(name,color,key))
      if(platOpen[key]){
        const platDb=key==='je'?'just_eat':key
        const platRows:Array<[string,keyof ResRow,boolean?,string?]>=key==='uber'?[
          ['Bruto pagado por cliente','bruto'],['Comisión Uber + IVA','comisiones',true],
          ['Tasa semanal mantenimiento + IVA','tasa_mantenimiento',true],['Tasa Uber One/pedido + IVA','tasa_uber_one',true],
          ['Reembolsos a clientes','reembolsos_clientes',true],['Ads','ads',true],
          ['Reembolsos cobrados 2x (extra)','reembolsos_2x',false,COLORS.ok],
        ]:key==='glovo'?[
          ['Bruto pagado por cliente','bruto'],['Comisión Glovo + IVA','comisiones',true],
          ['Fees + IVA','fees',true],['Cargos promoción','cargos_promocion',true],['Ads','ads',true],
        ]:key==='je'?[
          ['Bruto pagado por cliente','bruto'],['Comisión Just Eat + IVA','comisiones',true],
          ['Coste gestión/pedido + IVA','coste_gestion_je',true],['Fees + IVA','fees',true],['Ads','ads',true],
        ]:[
          ['Bruto pagado por cliente','bruto'],['Comisión pasarela pago','comisiones',true],
        ]
        for(const[label,field,neg,col] of platRows){
          rows.push(platRow(label,platDb,field,neg,col))
        }
        rows.push(platNet(name,platDb))
      }
      rows.push(sp(`plat-${key}`))
    }
  }
  rows.push(<tr key="spe2"><td colSpan={99} style={{height:14,border:'none',background:COLORS.bg,padding:0}}/></tr>)
  rows.push(sH('Detalle por categoría',COLORS.mut,<button onClick={(e)=>{e.stopPropagation();toggleDetAll()}} style={{...btnSL,marginLeft:10}}>{aO?'▴ Colapsar todo':'▾ Expandir todo'}</button>))
  rows.push(<tr key="d1" style={{cursor:'pointer'}} onClick={()=>sD(p=>({...p,'1':!p['1']}))}><td style={gR}>{det['1']?'▾':'▸'} 1 · Ingresos por operación</td><Cells fn={iM} estFn={iMisEst}/></tr>)
  if(det['1']){
    rows.push(<tr key="d11" style={{background:aB()}}><td style={{...t1,paddingLeft:14,fontWeight:600}}>1.1 · Ingresos netos por ventas</td><Cells fn={iT}/></tr>)
    for(const c of ingC.filter(c=>vi(c.nombre))){
      const b=aB();const isUber=c.id==='1.1.1'||c.nombre.toLowerCase().includes('uber')
      rows.push(<tr key={`ic-${c.id}`} style={{background:b}} {...hv}><td style={{...t1,paddingLeft:26}}>{c.id} · {c.nombre}</td><Cells fn={ms=>sumMeses(ingresos[c.id]||{},ms)} pctFn={ms=>po(sumMeses(ingresos[c.id]||{},ms),iM(ms))}/></tr>)
      if(isUber){
        const b2=aB()
        rows.push(<tr key={`r2x-${c.id}`} style={{background:b2}} {...hv}><td style={{...t1,paddingLeft:42,color:COLORS.mut,fontSize:13}}>1.1.1.1 · Reembolsos Uber 2x</td><Cells fn={reembolsos2xMs}/></tr>)
      }
    }
    rows.push(<tr key="d12" style={{background:aB()}}><td style={{...t1,paddingLeft:14,fontWeight:600}}>1.2 · Facturación bruta por ventas</td><Cells fn={fB} estFn={fBisEst}/></tr>)
  }
  rows.push(sp('e'))
  for(const g of grupos){
    const bn=gB(g.id);const bL=bn?` (${bn.pct_min}-${bn.pct_max}%)`:'';const sN=cN2.filter(c=>c.parent_id===g.id);const nm=LBL[g.id]||g.nombre;const op=!!det[g.id]
    rows.push(<tr key={`gh-${g.id}`} style={{cursor:'pointer'}} onClick={()=>sD(p=>({...p,[g.id]:!p[g.id]}))}><td style={gR}>{op?'▾':'▸'} {g.id} · {nm}<span style={{color:COLORS.mut,fontSize:10,fontWeight:400}}>{bL}</span></td><Cells fn={ms=>gP(g.id,ms)} pctFn={ms=>po(gP(g.id,ms),iM(ms))}/></tr>)
    if(op){
      for(const sub of sN){
        const ch=cCh(sub.id);const subOp=det[sub.id]!==false
        rows.push(<tr key={`s-${sub.id}`} style={{background:aB(),cursor:'pointer'}} onClick={()=>sD(p=>({...p,[sub.id]:!p[sub.id]}))}><td style={{...t1,paddingLeft:14,fontWeight:600}}>{subOp?'▾':'▸'} {sub.id} · {sub.nombre}</td><Cells fn={ms=>sumCatMeses(gastos,sub.id,ms)} pctFn={ms=>po(sumCatMeses(gastos,sub.id,ms),iM(ms))}/></tr>)
        if(subOp){
          for(const c of ch.filter(c=>vi(c.nombre))){
            rows.push(<tr key={`c-${c.id}`} style={{background:aB()}} {...hv}><td style={{...t1,paddingLeft:28,color:COLORS.mut,fontSize:13}}>{c.id} · {c.nombre}</td><Cells fn={ms=>sumMeses(gastos[c.id]||{},ms)} pctFn={ms=>po(sumMeses(gastos[c.id]||{},ms),iM(ms))}/></tr>)
          }
        }
      }
    }
    rows.push(sp(`grp-${g.id}`))
  }
  return rows
}
const rows=buildRows()

// Generar <col> tags para fijar anchos (esto es lo que fuerza scroll)
const colGroup=<colgroup>
  <col style={{width:W_LABEL,minWidth:W_LABEL}}/>
  {cols.flatMap((c,i)=>c.isY?[<col key={i} style={{width:W_YEAR,minWidth:W_YEAR}}/>]:c.isQ?[<col key={i} style={{width:W_TRI,minWidth:W_TRI}}/>]:[<col key={i} style={{width:W_MES,minWidth:W_MES}}/>,<col key={`p${i}`} style={{width:W_PCT,minWidth:W_PCT}}/>])}
</colgroup>

return(<div style={{background:COLORS.bg,padding:'20px 24px',minHeight:'100vh'}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:6}}>
<h2 style={{color:COLORS.redSL,fontFamily:FONT.heading,fontSize:22,fontWeight:600,letterSpacing:'3px',margin:0,textTransform:'uppercase'}}>RUNNING {año}</h2>
<div style={{display:'flex',gap:4,alignItems:'center'}}>
<input placeholder="🔍 Buscar..." value={buscar} onChange={e=>sBu(e.target.value)} style={{padding:'5px 10px',borderRadius:8,border:`0.5px solid ${COLORS.brd}`,background:COLORS.card,fontFamily:FONT.body,fontSize:12,color:COLORS.pri,width:140,outline:'none'}}/>
<div style={{...TABS_PILL.container}}><select value={año} onChange={e=>sA(Number(e.target.value))} style={pS}>{[2026,2025,2024].map(a=><option key={a} value={a}>{a}</option>)}</select></div>
<span style={{color:COLORS.brd}}>|</span>
<div style={{...TABS_PILL.container}}>{[{id:null as string|null,label:'Todos'},...titulares.map(t=>({id:t.id as string|null,label:t.nombre}))].map(t=><button key={t.id||'all'} style={(t.id===tId||(t.id===null&&!tId))?TABS_PILL.active:TABS_PILL.inactive} onClick={()=>{}}>{t.label}</button>)}</div>
</div></div>
<div style={{...CARDS.std,padding:0,overflow:'hidden'}}>
<div ref={scrollRef} style={{overflowX:'auto',overflowY:'visible',width:'100%'}}>
<table style={{borderCollapse:'separate',borderSpacing:0,tableLayout:'fixed',width:totalW}}>
{colGroup}
<thead><tr><th style={th1}>PyG <button onClick={togglePyGAll} style={{...btnSL,marginLeft:8}}>{allBl?'▴ Colapsar todo':'▾ Expandir todo'}</button></th>{cols.flatMap((c,i)=>c.isY?[<th key={i} style={thC(c)}>{c.label}</th>]:[<th key={i} style={thC(c)}>{c.label}</th>,<th key={`p${i}`} style={thP(c)}>%</th>])}</tr></thead>
<tbody>{rows}</tbody></table>
</div></div></div>)
}
