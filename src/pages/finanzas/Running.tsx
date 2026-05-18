import { useState, useMemo, type CSSProperties } from 'react'
import { useRunningAnual, sumMeses, sumCatMeses, fmtN } from '@/hooks/useRunningAnual'
import { useTitular } from '@/contexts/TitularContext'
import { COLORS, FONT, CARDS, TABS_PILL } from '@/components/panel/resumen/tokens'

const M = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const QM: Record<number,number[]> = {1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]}
const ALL = [1,2,3,4,5,6,7,8,9,10,11,12]
const BENCH_MAP: Record<string,string> = {'2.1':'PRODUCTO','2.2':'RRHH','2.3':'ALQUILER','2.41':'MARKETING','2.42':'INTERNET_VENTAS','2.43':'ADMIN_GENERALES','2.44':'SUMINISTROS'}

const thBase: CSSProperties = {fontFamily:FONT.heading,fontSize:10,fontWeight:500,letterSpacing:'2px',textTransform:'uppercase',color:COLORS.mut,padding:'10px 8px',background:COLORS.bg,borderBottom:`0.5px solid ${COLORS.brd}`,whiteSpace:'nowrap',textAlign:'right',position:'sticky',top:0,zIndex:2}
const thFirst: CSSProperties = {...thBase,textAlign:'left',width:220,minWidth:180,position:'sticky',left:0,zIndex:3}
const thQ: CSSProperties = {...thBase,background:`${COLORS.redSL}08`,fontWeight:600,color:COLORS.redSL,cursor:'pointer',userSelect:'none'}
const thY: CSSProperties = {...thBase,background:`${COLORS.redSL}08`,fontWeight:600,color:COLORS.redSL}
const tdBase: CSSProperties = {padding:'7px 8px',fontSize:12,fontFamily:FONT.body,color:COLORS.sec,borderBottom:`0.5px solid ${COLORS.brd}`,whiteSpace:'nowrap',textAlign:'right',verticalAlign:'middle',fontVariantNumeric:'tabular-nums'}
const tdFirst: CSSProperties = {...tdBase,textAlign:'left',position:'sticky',left:0,zIndex:1,fontSize:12}
const ROW_EVEN = '#ffffff'
const ROW_ODD = '#fafaf7'
const bgH = COLORS.bg
const bgG = `${COLORS.redSL}06`
const bgT = `${COLORS.redSL}0C`
const bgR = `${COLORS.ok}0C`
const secHdr: CSSProperties = {...tdFirst,background:bgH,fontFamily:FONT.heading,fontSize:10,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.mut,padding:'10px 8px 5px',borderBottom:`1px solid ${COLORS.brd}`,fontWeight:500}
const grpTd: CSSProperties = {...tdFirst,fontFamily:FONT.heading,fontSize:11,letterSpacing:'1px',textTransform:'uppercase',color:COLORS.redSL,fontWeight:600,background:bgG}
const totTd: CSSProperties = {...tdFirst,fontFamily:FONT.heading,fontSize:12,letterSpacing:'1px',textTransform:'uppercase',color:COLORS.redSL,fontWeight:700,background:bgT,borderTop:`1.5px solid ${COLORS.brd}`}
const resTd: CSSProperties = {...tdFirst,fontFamily:FONT.heading,fontSize:12,letterSpacing:'1px',textTransform:'uppercase',color:COLORS.ok,fontWeight:700,background:bgR,borderTop:`2px solid ${COLORS.brd}`}
const dot = (c:string): CSSProperties => ({display:'inline-block',width:7,height:7,borderRadius:'50%',background:c,marginRight:4,verticalAlign:'middle'})
const sep = <td colSpan={99} style={{height:6,border:'none',background:bgH,padding:0}}/>

export default function Running(){
  const {filtro,titulares}=useTitular()
  const [año,setAño]=useState(2026)
  const [buscar,setBuscar]=useState('')
  const [qO,setQO]=useState<Record<number,boolean>>(()=>{const q=Math.ceil((new Date().getMonth()+1)/3);return{1:true,2:q>=2,3:q>=3,4:q>=4}})
  const tId=filtro==='unificado'?null:filtro
  const {ingresos,gastos,brutos,categorias,benchmarks,loading}=useRunningAnual(año,tId)
  const iT=(ms:number[])=>{let s=0;for(const[c,m]of Object.entries(ingresos)){if(c.startsWith('1.'))s+=sumMeses(m,ms)};return s}
  const gP=(p:string,ms:number[])=>sumCatMeses(gastos,p,ms)
  const gT=(ms:number[])=>gP('2.',ms)
  const res=(ms:number[])=>iT(ms)-gT(ms)
  const pc=(ms:number[])=>{const i=iT(ms);return i?(gP('2.1',ms)+gP('2.2',ms))/i*100:0}
  const gB=(g:string)=>{const k=BENCH_MAP[g];return k?benchmarks.find(b=>b.categoria===k):null}
  const sC=(p:number,b:{pct_min:number;pct_max:number}|null|undefined)=>{if(!b)return COLORS.mut;if(p<=b.pct_max)return COLORS.ok;if(p<=b.pct_max*1.2)return COLORS.warn;return COLORS.err}
  const tQ=(q:number)=>setQO(p=>({...p,[q]:!p[q]}))
  type Col={label:string;ms:number[];isQ?:boolean;qn?:number;isY?:boolean;hid?:boolean}
  const cols=useMemo(()=>{const c:Col[]=[];for(let q=1;q<=4;q++){QM[q].forEach(m=>c.push({label:M[m-1],ms:[m],hid:!qO[q]}));c.push({label:`${qO[q]?'▾':'▸'} ${q}T`,ms:QM[q],isQ:true,qn:q})};c.push({label:'Año',ms:ALL,isY:true});return c},[qO])
  const cN2=useMemo(()=>categorias.filter(c=>c.nivel===2),[categorias])
  const cCh=(pid:string)=>categorias.filter(c=>c.parent_id===pid&&c.nivel===3).filter(c=>ALL.some(m=>(gastos[c.id]?.[m]||0)>0)).sort((a,b)=>sumMeses(gastos[b.id]||{},ALL)-sumMeses(gastos[a.id]||{},ALL))
  const Fp=(v:number)=>v?`${v.toFixed(1)}%`:'—'
  const Cells=({fn,sign,pct,bg}:{fn:(ms:number[])=>number;sign?:boolean;pct?:boolean;bg?:string})=>(<>{cols.map((c,i)=>{if(c.hid)return null;const v=fn(c.ms);const cl=sign?(v>0?COLORS.ok:v<0?COLORS.err:COLORS.mut):undefined;const pre=sign&&v>0?'+':'';const cBg=c.isQ||c.isY?`${COLORS.redSL}04`:(bg||undefined);const fw:number|undefined=c.isQ||c.isY?600:undefined;return<td key={i} style={{...tdBase,background:cBg,fontWeight:fw,color:cl||tdBase.color}}>{pct?Fp(v):v?`${pre}${fmtN(v)}`:'—'}</td>})}</>)
  const vis=(l:string,f?:boolean)=>{if(f)return true;if(buscar.length<2)return true;return l.toLowerCase().includes(buscar.toLowerCase())}
  if(loading)return(<div style={{padding:'24px 28px',background:COLORS.bg,minHeight:'100vh'}}><h1 style={{fontFamily:FONT.heading,fontSize:22,letterSpacing:3,textTransform:'uppercase',color:COLORS.redSL,fontWeight:600}}>Running {año}</h1><p style={{color:COLORS.mut,fontSize:13,fontFamily:FONT.body}}>Cargando…</p></div>)
  const grupos=categorias.filter(c=>c.nivel===1&&c.id.startsWith('2.'))
  const ingC=categorias.filter(c=>c.parent_id==='1.1'&&c.nivel===3)
  let ri=0;const aB=()=>{const b=ri%2===0?ROW_EVEN:ROW_ODD;ri++;return b};const rA=()=>{ri=0}
  const hv=(bg:string)=>({onMouseEnter:(e:React.MouseEvent<HTMLTableRowElement>)=>{(e.currentTarget).style.background=`${COLORS.bg}80`},onMouseLeave:(e:React.MouseEvent<HTMLTableRowElement>)=>{(e.currentTarget).style.background=bg}})
  return(
    <div style={{padding:'24px 28px',background:COLORS.bg,minHeight:'100vh',fontFamily:FONT.body,color:COLORS.pri}}>
      <h1 style={{fontFamily:FONT.heading,fontSize:22,letterSpacing:3,textTransform:'uppercase',color:COLORS.redSL,fontWeight:600,margin:'0 0 4px'}}>Running {año}</h1>
      <p style={{color:COLORS.mut,fontSize:12,marginBottom:16}}>Datos reales de Conciliación · Año completo · Trimestres colapsables</p>
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        {[2026,2025].map(a=><button key={a} onClick={()=>setAño(a)} style={año===a?{...TABS_PILL.active,fontSize:12}:{...TABS_PILL.inactive,fontSize:12}}>{a}</button>)}
        <span style={{color:COLORS.mut,fontSize:11,margin:'0 4px'}}>|</span>
        {[{id:null as string|null,label:'Todos'},...titulares.map(t=>({id:t.id as string|null,label:t.nombre}))].map(t=><button key={t.id||'all'} style={(t.id===tId||(t.id===null&&!tId))?{...TABS_PILL.active,fontSize:12}:{...TABS_PILL.inactive,fontSize:12}} onClick={()=>{}}>{t.label}</button>)}
        <div style={{flex:1}}/><input placeholder="🔍 Buscar..." value={buscar} onChange={e=>setBuscar(e.target.value)} style={{padding:'5px 10px',borderRadius:8,border:`0.5px solid ${COLORS.brd}`,background:COLORS.card,color:COLORS.pri,fontFamily:FONT.body,fontSize:12,width:180,outline:'none'}}/>
      </div>
      <div style={{...CARDS.std,padding:0,overflow:'hidden'}}><div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'separate',borderSpacing:0,whiteSpace:'nowrap',minWidth:1200}}>
          <thead><tr><th style={thFirst}>Running {año}</th>{cols.map((c,i)=>{if(c.hid)return null;return<th key={i} style={c.isY?thY:c.isQ?thQ:thBase} onClick={c.qn?()=>tQ(c.qn!):undefined}>{c.label}</th>})}</tr></thead>
          <tbody>
            <tr><td colSpan={99} style={secHdr}>Resumen</td></tr>
            {rA() as any}
            {(()=>{const b=aB();return<tr style={{background:b}} {...hv(b)}><td style={grpTd}>Ingresos netos</td><Cells fn={iT} bg={bgG}/></tr>})()}
            {grupos.map(g=>{const bn=gB(g.id);const yi=iT(ALL);const yv=gP(g.id,ALL);const yp=yi?yv/yi*100:0;const sc=sC(yp,bn);const bI=bn?` (${bn.pct_min}-${bn.pct_max}%)`:'';const b=aB();return<tr key={g.id} style={{background:b}} {...hv(b)}><td style={grpTd}><span style={dot(sc)}/>{g.id} {g.nombre}<span style={{color:COLORS.mut,fontSize:10,fontWeight:400}}>{bI}</span></td><Cells fn={ms=>gP(g.id,ms)} bg={bgG}/></tr>})}
            <tr style={{background:bgT}}><td style={totTd}>Total gastos</td><Cells fn={gT} bg={bgT}/></tr>
            <tr style={{background:bgR}}><td style={resTd}>Resultado</td><Cells fn={res} sign bg={bgR}/></tr>
            {(()=>{const b=aB();return<tr style={{background:b}} {...hv(b)}><td style={{...tdFirst,fontFamily:FONT.heading,fontSize:11,letterSpacing:'1px',textTransform:'uppercase',fontWeight:700}}>Prime Cost <span style={{color:COLORS.mut,fontSize:10,fontWeight:400}}>(obj &lt;60%)</span></td><Cells fn={pc} pct/></tr>})()}
            <tr>{sep}</tr>
            <tr><td colSpan={99} style={secHdr}>1. Ingresos</td></tr>
            {rA() as any}
            {ingC.map(c=>{if(!vis(c.nombre))return null;const b=aB();return<tr key={c.id} style={{background:b}} {...hv(b)}><td style={{...tdFirst,paddingLeft:18,color:COLORS.sec}}>{c.nombre}</td><Cells fn={ms=>sumMeses(ingresos[c.id]||{},ms)}/></tr>})}
            <tr style={{background:bgG}}><td style={grpTd}>1.01 Ingresos netos</td><Cells fn={iT} bg={bgG}/></tr>
            {(()=>{const b=aB();return<tr style={{background:b}}><td style={{...tdFirst,fontStyle:'italic',color:COLORS.mut}}>1.02 Facturación bruta</td><Cells fn={ms=>ms.reduce((s,m)=>s+(brutos[m]?.total||0),0)}/></tr>})()}
            {(()=>{const b=aB();return<tr style={{background:b}}><td style={{...tdFirst,paddingLeft:18,color:COLORS.mut}}>Pedidos</td><Cells fn={ms=>ms.reduce((s,m)=>s+(brutos[m]?.pedidos||0),0)}/></tr>})()}
            {(()=>{const b=aB();return<tr style={{background:b}}><td style={{...tdFirst,paddingLeft:18,color:COLORS.mut}}>Ticket medio</td><Cells fn={ms=>{const bt=ms.reduce((s,m)=>s+(brutos[m]?.total||0),0);const p=ms.reduce((s,m)=>s+(brutos[m]?.pedidos||0),0);return p?Math.round(bt/p*100)/100:0}}/></tr>})()}
            {grupos.map(g=>{const bn=gB(g.id);const bL=bn?` (benchmark ${bn.pct_min}-${bn.pct_max}%)`:'';const sN=cN2.filter(c=>c.parent_id===g.id);const yi=iT(ALL);const yv=gP(g.id,ALL);const yp=yi?yv/yi*100:0;const sc=sC(yp,bn);return[
              <tr key={`s-${g.id}`}>{sep}</tr>,
              <tr key={`h-${g.id}`}><td colSpan={99} style={secHdr}>{g.id} {g.nombre}<span style={{fontWeight:300}}>{bL}</span></td></tr>,
              (rA(),null) as any,
              ...sN.flatMap(sub=>{const ch=cCh(sub.id);return[vis(sub.nombre,true)?(()=>{const b=aB();return<tr key={sub.id} style={{background:b}} {...hv(b)}><td style={{...tdFirst,paddingLeft:18,color:COLORS.sec}}>{sub.id} {sub.nombre}</td><Cells fn={ms=>sumCatMeses(gastos,sub.id,ms)}/></tr>})():null,...ch.map(c=>{if(!vis(c.nombre))return null;const b=aB();return<tr key={c.id} style={{background:b}} {...hv(b)}><td style={{...tdFirst,paddingLeft:32,color:COLORS.mut,fontSize:11}}>{c.nombre}</td><Cells fn={ms=>sumMeses(gastos[c.id]||{},ms)}/></tr>})].filter(Boolean)}),
              <tr key={`t-${g.id}`} style={{background:bgG}}><td style={grpTd}><span style={dot(sc)}/>{g.id} Total {g.nombre}</td><Cells fn={ms=>gP(g.id,ms)} bg={bgG}/></tr>,
              bn?(()=>{const b=aB();return<tr key={`p-${g.id}`} style={{background:b}}><td style={{...tdFirst,paddingLeft:18,color:COLORS.mut}}>% s/Ingresos</td><Cells fn={ms=>{const i=iT(ms);return i?gP(g.id,ms)/i*100:0}} pct/></tr>})():null,
            ].filter(Boolean)}).flat()}
            <tr>{sep}</tr>
            <tr style={{background:bgT}}><td style={totTd}>Total gastos</td><Cells fn={gT} bg={bgT}/></tr>
            <tr style={{background:bgR}}><td style={resTd}>EBITDA / Resultado</td><Cells fn={res} sign bg={bgR}/></tr>
          </tbody>
        </table>
      </div></div>
    </div>
  )
}
