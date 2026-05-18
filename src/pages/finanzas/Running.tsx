import { useState, useMemo } from 'react'
import { useRunningAnual, sumMeses, sumCatMeses, fmtN } from '@/hooks/useRunningAnual'
import { useTitular } from '@/contexts/TitularContext'

const M = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const QM: Record<number,number[]> = {1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]}
const ALL = [1,2,3,4,5,6,7,8,9,10,11,12]
const BM: Record<string,string> = {'2.1':'PRODUCTO','2.2':'RRHH','2.3':'ALQUILER','2.41':'MARKETING','2.42':'INTERNET_VENTAS','2.43':'ADMIN_GENERALES','2.44':'SUMINISTROS'}

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
  const gB=(g:string)=>{const k=BM[g];return k?benchmarks.find(b=>b.categoria===k):null}
  const sC=(p:number,b:{pct_min:number;pct_max:number}|null|undefined)=>{if(!b)return'#7a8090';if(p<=b.pct_max)return'#1D9E75';if(p<=b.pct_max*1.2)return'#f5a623';return'#E24B4A'}
  const tQ=(q:number)=>setQO(p=>({...p,[q]:!p[q]}))
  type Col={label:string;ms:number[];isQ?:boolean;qn?:number;isY?:boolean;hid?:boolean}
  const cols=useMemo(()=>{const c:Col[]=[];for(let q=1;q<=4;q++){QM[q].forEach(m=>c.push({label:M[m-1],ms:[m],hid:!qO[q]}));c.push({label:`${qO[q]?'▾':'▸'} ${q}T`,ms:QM[q],isQ:true,qn:q})};c.push({label:'Año',ms:ALL,isY:true});return c},[qO])
  const cN2=useMemo(()=>categorias.filter(c=>c.nivel===2),[categorias])
  const cCh=(pid:string)=>categorias.filter(c=>c.parent_id===pid&&c.nivel===3).filter(c=>ALL.some(m=>(gastos[c.id]?.[m]||0)>0)).sort((a,b)=>sumMeses(gastos[b.id]||{},ALL)-sumMeses(gastos[a.id]||{},ALL))
  const Fp=(v:number)=>v?`${v.toFixed(1)}%`:'—'
  const vis=(l:string,f?:boolean)=>{if(f)return true;if(buscar.length<2)return true;return l.toLowerCase().includes(buscar.toLowerCase())}

  /* ── Estilos COPIADOS LITERAL de TabMovimientos / Conciliación ── */
  const thSt: React.CSSProperties = {fontFamily:'Oswald, sans-serif',fontSize:10,fontWeight:500,letterSpacing:'2px',color:'#7a8090',textTransform:'uppercase',textAlign:'right',padding:'10px 12px',background:'#f5f3ef',borderBottom:'0.5px solid #d0c8bc',whiteSpace:'nowrap',cursor:'pointer',userSelect:'none',position:'sticky',top:0,zIndex:2}
  const thFi: React.CSSProperties = {...thSt,textAlign:'left',width:220,minWidth:180,position:'sticky',left:0,zIndex:3}
  const thQs: React.CSSProperties = {...thSt,background:'rgba(176,29,35,0.06)',fontWeight:600,color:'#B01D23'}
  const thYr: React.CSSProperties = {...thSt,background:'rgba(176,29,35,0.06)',fontWeight:600,color:'#B01D23',cursor:'default'}
  const tdSt: React.CSSProperties = {padding:'8px 12px',fontSize:13,fontFamily:'Lexend, sans-serif',color:'#3a4050',borderBottom:'0.5px solid #ebe8e2',whiteSpace:'nowrap',textAlign:'right',verticalAlign:'middle',fontVariantNumeric:'tabular-nums',lineHeight:1.4}
  const tdFi: React.CSSProperties = {...tdSt,textAlign:'left',position:'sticky',left:0,zIndex:1}

  const Cells=({fn,sign,pct,bg}:{fn:(ms:number[])=>number;sign?:boolean;pct?:boolean;bg?:string})=>(<>{cols.map((c,i)=>{if(c.hid)return null;const v=fn(c.ms);const cl=sign?(v>0?'#1D9E75':v<0?'#E24B4A':'#7a8090'):undefined;const cBg=c.isQ||c.isY?'rgba(176,29,35,0.02)':(bg||undefined);const fw:any=c.isQ||c.isY?600:undefined;const pre=sign&&v>0?'+':'';return<td key={i} style={{...tdSt,background:cBg,fontWeight:fw,color:cl||tdSt.color,fontFamily:v&&!pct?'Oswald, sans-serif':tdSt.fontFamily,fontSize:v&&!pct?14:tdSt.fontSize,letterSpacing:v&&!pct?'0.5px':undefined}}>{pct?Fp(v):v?`${pre}${fmtN(v)}`:'—'}</td>})}</>)

  if(loading)return(<div style={{background:'#f5f3ef',padding:'24px 28px',minHeight:'100vh'}}><h2 style={{color:'#B01D23',fontFamily:'Oswald, sans-serif',fontSize:22,fontWeight:600,letterSpacing:'3px',margin:0,textTransform:'uppercase'}}>Running {año}</h2><p style={{fontFamily:'Lexend, sans-serif',fontSize:13,color:'#7a8090',marginTop:4}}>Cargando…</p></div>)

  const grupos=categorias.filter(c=>c.nivel===1&&c.id.startsWith('2.'))
  const ingC=categorias.filter(c=>c.parent_id==='1.1'&&c.nivel===3)
  let ri=0;const aB=()=>{const b=ri%2===0?'#ffffff':'#fafaf7';ri++;return b};const rA=()=>{ri=0}
  const hv={onMouseEnter:(e:React.MouseEvent<HTMLTableRowElement>)=>{(e.currentTarget).style.background='#f5f3ef60'},onMouseLeave:(e:React.MouseEvent<HTMLTableRowElement>)=>{(e.currentTarget).style.background=''}}

  /* Filas sección header */
  const secH=(label:string)=><tr><td colSpan={99} style={{...tdFi,background:'#f5f3ef',fontFamily:'Oswald, sans-serif',fontSize:10,letterSpacing:'2px',textTransform:'uppercase',color:'#7a8090',padding:'12px 12px 6px',borderBottom:'1px solid #d0c8bc',fontWeight:500}}>{label}</td></tr>
  /* Fila grupo (rojo SL) */
  const grpS: React.CSSProperties={...tdFi,fontFamily:'Oswald, sans-serif',fontSize:11,letterSpacing:'1.5px',textTransform:'uppercase',color:'#B01D23',fontWeight:600,background:'rgba(176,29,35,0.04)'}
  /* Fila total */
  const totS: React.CSSProperties={...tdFi,fontFamily:'Oswald, sans-serif',fontSize:12,letterSpacing:'1.5px',textTransform:'uppercase',color:'#B01D23',fontWeight:700,background:'rgba(176,29,35,0.07)',borderTop:'1.5px solid #d0c8bc'}
  /* Fila resultado */
  const resS: React.CSSProperties={...tdFi,fontFamily:'Oswald, sans-serif',fontSize:12,letterSpacing:'1.5px',textTransform:'uppercase',color:'#1D9E75',fontWeight:700,background:'rgba(29,158,117,0.06)',borderTop:'2px solid #d0c8bc'}
  /* Separador */
  const sepR=<tr><td colSpan={99} style={{height:6,border:'none',background:'#f5f3ef',padding:0}}/></tr>

  /* Tabs estilo literal Conciliación */
  const tabSt=(on:boolean): React.CSSProperties=>({padding:'5px 12px',borderRadius:5,border:on?'none':'0.5px solid #d0c8bc',background:on?'#FF4757':'transparent',color:on?'#fff':'#3a4050',fontFamily:'Lexend, sans-serif',fontSize:13,fontWeight:500,cursor:'pointer'})

  return(
    <div style={{background:'#f5f3ef',padding:'24px 28px',minHeight:'100vh'}}>
      <h2 style={{color:'#B01D23',fontFamily:'Oswald, sans-serif',fontSize:22,fontWeight:600,letterSpacing:'3px',margin:0,textTransform:'uppercase'}}>RUNNING {año}</h2>
      <span style={{fontFamily:'Lexend, sans-serif',fontSize:13,color:'#7a8090',display:'block',marginTop:4,marginBottom:18}}>Datos reales de Conciliación · Año completo · Trimestres colapsables</span>

      <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{background:'#fff',border:'0.5px solid #d0c8bc',borderRadius:10,padding:'4px 6px',display:'inline-flex',gap:4}}>
          {[2026,2025].map(a=><button key={a} onClick={()=>setAño(a)} style={tabSt(año===a)}>{a}</button>)}
        </div>
        <span style={{color:'#d0c8bc',margin:'0 2px'}}>|</span>
        <div style={{background:'#fff',border:'0.5px solid #d0c8bc',borderRadius:10,padding:'4px 6px',display:'inline-flex',gap:4}}>
          {[{id:null as string|null,label:'Todos'},...titulares.map(t=>({id:t.id as string|null,label:t.nombre}))].map(t=><button key={t.id||'all'} style={tabSt(t.id===tId||(t.id===null&&!tId))} onClick={()=>{}}>{t.label}</button>)}
        </div>
        <div style={{flex:1}}/>
        <input placeholder="🔍 Buscar..." value={buscar} onChange={e=>setBuscar(e.target.value)} style={{padding:'10px 14px',borderRadius:10,border:'0.5px solid #d0c8bc',background:'#fff',fontFamily:'Lexend, sans-serif',fontSize:13,color:'#111',width:180,outline:'none',boxSizing:'border-box'}}/>
      </div>

      <div style={{background:'#fff',border:'0.5px solid #d0c8bc',borderRadius:14,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'separate',borderSpacing:0,fontFamily:'Lexend, sans-serif',fontSize:13,minWidth:1200}}>
            <thead><tr><th style={thFi}>Running {año}</th>{cols.map((c,i)=>{if(c.hid)return null;return<th key={i} style={c.isY?thYr:c.isQ?thQs:thSt} onClick={c.qn?()=>tQ(c.qn!):undefined}>{c.label}</th>})}</tr></thead>
            <tbody>
              {secH('Resumen')}
              {rA() as any}
              {(()=>{const b=aB();return<tr style={{background:b}} {...hv}><td style={grpS}>Ingresos netos</td><Cells fn={iT} bg='rgba(176,29,35,0.04)'/></tr>})()}
              {grupos.map(g=>{const bn=gB(g.id);const yi=iT(ALL);const yv=gP(g.id,ALL);const yp=yi?yv/yi*100:0;const sc=sC(yp,bn);const bI=bn?` (${bn.pct_min}-${bn.pct_max}%)`:'';const b=aB();return<tr key={g.id} style={{background:b}} {...hv}><td style={grpS}><span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:sc,marginRight:5,verticalAlign:'middle'}}/>{g.id} {g.nombre}<span style={{color:'#7a8090',fontSize:10,fontWeight:400,letterSpacing:'1px'}}>{bI}</span></td><Cells fn={ms=>gP(g.id,ms)} bg='rgba(176,29,35,0.04)'/></tr>})}
              <tr><td style={totS}>Total gastos</td><Cells fn={gT} bg='rgba(176,29,35,0.07)'/></tr>
              <tr><td style={resS}>Resultado</td><Cells fn={res} sign bg='rgba(29,158,117,0.06)'/></tr>
              {(()=>{const b=aB();return<tr style={{background:b}} {...hv}><td style={{...tdFi,fontFamily:'Oswald, sans-serif',fontSize:11,letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:700}}>Prime Cost <span style={{color:'#7a8090',fontSize:10,fontWeight:400}}>(obj &lt;60%)</span></td><Cells fn={pc} pct/></tr>})()}
              {sepR}
              {secH('1. Ingresos')}
              {rA() as any}
              {ingC.map(c=>{if(!vis(c.nombre))return null;const b=aB();return<tr key={c.id} style={{background:b}} {...hv}><td style={{...tdFi,paddingLeft:20}}>{c.nombre}</td><Cells fn={ms=>sumMeses(ingresos[c.id]||{},ms)}/></tr>})}
              <tr><td style={grpS}>1.01 Ingresos netos</td><Cells fn={iT} bg='rgba(176,29,35,0.04)'/></tr>
              {(()=>{const b=aB();return<tr style={{background:b}}><td style={{...tdFi,fontStyle:'italic',color:'#7a8090'}}>1.02 Facturación bruta</td><Cells fn={ms=>ms.reduce((s,m)=>s+(brutos[m]?.total||0),0)}/></tr>})()}
              {(()=>{const b=aB();return<tr style={{background:b}}><td style={{...tdFi,paddingLeft:20,color:'#7a8090'}}>Pedidos</td><Cells fn={ms=>ms.reduce((s,m)=>s+(brutos[m]?.pedidos||0),0)}/></tr>})()}
              {(()=>{const b=aB();return<tr style={{background:b}}><td style={{...tdFi,paddingLeft:20,color:'#7a8090'}}>Ticket medio</td><Cells fn={ms=>{const bt=ms.reduce((s,m)=>s+(brutos[m]?.total||0),0);const p=ms.reduce((s,m)=>s+(brutos[m]?.pedidos||0),0);return p?Math.round(bt/p*100)/100:0}}/></tr>})()}
              {grupos.map(g=>{const bn=gB(g.id);const bL=bn?` (benchmark ${bn.pct_min}-${bn.pct_max}%)`:'';const sN=cN2.filter(c=>c.parent_id===g.id);const yi=iT(ALL);const yv=gP(g.id,ALL);const yp=yi?yv/yi*100:0;const sc=sC(yp,bn);return[
                sepR,
                secH(`${g.id} ${g.nombre}${bL}`),
                (rA(),null) as any,
                ...sN.flatMap(sub=>{const ch=cCh(sub.id);return[vis(sub.nombre,true)?(()=>{const b=aB();return<tr key={sub.id} style={{background:b}} {...hv}><td style={{...tdFi,paddingLeft:20}}>{sub.id} {sub.nombre}</td><Cells fn={ms=>sumCatMeses(gastos,sub.id,ms)}/></tr>})():null,...ch.map(c=>{if(!vis(c.nombre))return null;const b=aB();return<tr key={c.id} style={{background:b}} {...hv}><td style={{...tdFi,paddingLeft:34,color:'#7a8090',fontSize:12}}>{c.nombre}</td><Cells fn={ms=>sumMeses(gastos[c.id]||{},ms)}/></tr>})].filter(Boolean)}),
                <tr key={`t-${g.id}`}><td style={grpS}><span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:sc,marginRight:5,verticalAlign:'middle'}}/>{g.id} Total {g.nombre}</td><Cells fn={ms=>gP(g.id,ms)} bg='rgba(176,29,35,0.04)'/></tr>,
                bn?(()=>{const b=aB();return<tr key={`p-${g.id}`} style={{background:b}}><td style={{...tdFi,paddingLeft:20,color:'#7a8090'}}>% s/Ingresos</td><Cells fn={ms=>{const i=iT(ms);return i?gP(g.id,ms)/i*100:0}} pct/></tr>})():null,
              ].filter(Boolean)}).flat()}
              {sepR}
              <tr><td style={totS}>Total gastos</td><Cells fn={gT} bg='rgba(176,29,35,0.07)'/></tr>
              <tr><td style={resS}>EBITDA / Resultado</td><Cells fn={res} sign bg='rgba(29,158,117,0.06)'/></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
