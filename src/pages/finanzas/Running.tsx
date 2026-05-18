import { useState, useMemo } from 'react'
import { useRunningAnual, sumMeses, sumCatMeses } from '@/hooks/useRunningAnual'
import { useTitular } from '@/contexts/TitularContext'

const M = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const QM: Record<number,number[]> = {1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]}
const ALL = [1,2,3,4,5,6,7,8,9,10,11,12]
const BM: Record<string,string> = {'2.1':'PRODUCTO','2.2':'RRHH','2.3':'ALQUILER','2.41':'MARKETING','2.42':'INTERNET_VENTAS','2.43':'ADMIN_GENERALES','2.44':'SUMINISTROS'}

const fmt = (n: number): string => {
  if (!n) return '—'
  const abs = Math.abs(n)
  const str = abs >= 1 ? Math.round(abs).toLocaleString('es-ES') : abs.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})
  return n < 0 ? `−${str}` : str
}
const fmt2 = (n: number): string => {
  if (!n) return '—'
  const abs = Math.abs(n)
  return (n<0?'−':'') + abs.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})
}
const fmtP = (v: number) => v ? `${v.toFixed(1)}%` : '—'
const pctOf = (part: number, total: number) => total ? (part/total)*100 : 0

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
  const vis=(l:string,f?:boolean)=>{if(f)return true;if(buscar.length<2)return true;return l.toLowerCase().includes(buscar.toLowerCase())}

  const thSt: React.CSSProperties = {fontFamily:'Oswald, sans-serif',fontSize:10,fontWeight:500,letterSpacing:'2px',color:'#7a8090',textTransform:'uppercase',textAlign:'right',padding:'10px 12px',background:'#f5f3ef',borderBottom:'0.5px solid #d0c8bc',whiteSpace:'nowrap',cursor:'pointer',userSelect:'none',position:'sticky',top:0,zIndex:2}
  const thFi: React.CSSProperties = {...thSt,textAlign:'left',width:220,minWidth:180,position:'sticky',left:0,zIndex:3}
  const thQs: React.CSSProperties = {...thSt,background:'rgba(176,29,35,0.06)',fontWeight:600,color:'#B01D23'}
  const thYr: React.CSSProperties = {...thSt,background:'rgba(176,29,35,0.06)',fontWeight:600,color:'#B01D23',cursor:'default'}
  const thPct: React.CSSProperties = {...thSt,fontSize:8,letterSpacing:'1px',color:'#b0a898',minWidth:42,padding:'10px 4px'}
  const tdSt: React.CSSProperties = {padding:'8px 12px',fontSize:13,fontFamily:'Lexend, sans-serif',color:'#3a4050',borderBottom:'0.5px solid #ebe8e2',whiteSpace:'nowrap',textAlign:'right',verticalAlign:'middle',fontVariantNumeric:'tabular-nums',lineHeight:1.4}
  const tdFi: React.CSSProperties = {...tdSt,textAlign:'left',position:'sticky',left:0,zIndex:1}
  const tdPct: React.CSSProperties = {...tdSt,fontSize:10,color:'#b0a898',padding:'8px 4px',minWidth:42}
  /* Fila ratio por pedido — gris cursiva pequeña */
  const tdRatio: React.CSSProperties = {...tdSt,fontSize:10,color:'#b0a898',fontStyle:'italic'}
  const tdRatioFi: React.CSSProperties = {...tdFi,fontSize:10,color:'#b0a898',fontStyle:'italic',paddingLeft:20}

  const Cells=({fn,sign,pct,bg,pctFn}:{fn:(ms:number[])=>number;sign?:boolean;pct?:boolean;bg?:string;pctFn?:(ms:number[])=>number})=>(<>{cols.map((c,i)=>{if(c.hid)return null;const v=fn(c.ms);const cl=sign?(v>0?'#1D9E75':v<0?'#E24B4A':'#7a8090'):undefined;const cBg=c.isQ||c.isY?'rgba(176,29,35,0.02)':(bg||undefined);const fw:any=c.isQ||c.isY?600:undefined;const pre=sign&&v>0?'+':'';const valTd=<td key={i} style={{...tdSt,background:cBg,fontWeight:fw,color:cl||tdSt.color,fontFamily:v&&!pct?'Oswald, sans-serif':tdSt.fontFamily,fontSize:v&&!pct?14:tdSt.fontSize,letterSpacing:v&&!pct?'0.5px':undefined}}>{pct?fmtP(v):v?`${pre}${fmt(v)}`:'—'}</td>;if(pctFn){const pv=pctFn(c.ms);return[valTd,<td key={`p${i}`} style={{...tdPct,background:cBg}}>{pv?`${pv.toFixed(1)}%`:'—'}</td>]}return valTd})}</>)
  /* Cells para ratio por pedido — sin pctFn, formato 2 decimales */
  const CellsRatio=({fn,bg}:{fn:(ms:number[])=>number;bg?:string})=>(<>{cols.map((c,i)=>{if(c.hid)return null;const v=fn(c.ms);const cBg=c.isQ||c.isY?'rgba(176,29,35,0.02)':(bg||undefined);return[<td key={i} style={{...tdRatio,background:cBg}}>{v?fmt2(v):'—'}</td>,<td key={`p${i}`} style={{...tdPct,background:cBg}}/>]})}</>)

  if(loading)return(<div style={{background:'#f5f3ef',padding:'24px 28px',minHeight:'100vh'}}><h2 style={{color:'#B01D23',fontFamily:'Oswald, sans-serif',fontSize:22,fontWeight:600,letterSpacing:'3px',margin:0,textTransform:'uppercase'}}>Running {año}</h2><p style={{fontFamily:'Lexend, sans-serif',fontSize:13,color:'#7a8090',marginTop:4}}>Cargando…</p></div>)

  const grupos=categorias.filter(c=>c.nivel===1&&c.id.startsWith('2.'))
  const ingC=categorias.filter(c=>c.parent_id==='1.1'&&c.nivel===3)
  let ri=0;const aB=()=>{const b=ri%2===0?'#ffffff':'#fafaf7';ri++;return b};const rA=()=>{ri=0}
  const hv={onMouseEnter:(e:React.MouseEvent<HTMLTableRowElement>)=>{(e.currentTarget).style.background='#f5f3ef60'},onMouseLeave:(e:React.MouseEvent<HTMLTableRowElement>)=>{(e.currentTarget).style.background=''}}

  const secH=(label:string)=><tr><td colSpan={99} style={{...tdFi,background:'#f5f3ef',fontFamily:'Oswald, sans-serif',fontSize:10,letterSpacing:'2px',textTransform:'uppercase',color:'#7a8090',padding:'12px 12px 6px',borderBottom:'1px solid #d0c8bc',fontWeight:500}}>{label}</td></tr>
  const grpS: React.CSSProperties={...tdFi,fontFamily:'Oswald, sans-serif',fontSize:11,letterSpacing:'1.5px',textTransform:'uppercase',color:'#B01D23',fontWeight:600,background:'rgba(176,29,35,0.04)'}
  const totS: React.CSSProperties={...tdFi,fontFamily:'Oswald, sans-serif',fontSize:12,letterSpacing:'1.5px',textTransform:'uppercase',color:'#B01D23',fontWeight:700,background:'rgba(176,29,35,0.07)',borderTop:'1.5px solid #d0c8bc'}
  const resS: React.CSSProperties={...tdFi,fontFamily:'Oswald, sans-serif',fontSize:12,letterSpacing:'1.5px',textTransform:'uppercase',color:'#1D9E75',fontWeight:700,background:'rgba(29,158,117,0.06)',borderTop:'2px solid #d0c8bc'}
  const sepR=<tr><td colSpan={99} style={{height:6,border:'none',background:'#f5f3ef',padding:0}}/></tr>
  const tabSt=(on:boolean): React.CSSProperties=>({padding:'5px 12px',borderRadius:5,border:on?'none':'0.5px solid #d0c8bc',background:on?'#FF4757':'transparent',color:on?'#fff':'#3a4050',fontFamily:'Lexend, sans-serif',fontSize:13,fontWeight:500,cursor:'pointer'})

  const gFijos=(ms:number[])=>gP('2.2',ms)+gP('2.3',ms)
  const gVar=(ms:number[])=>gP('2.1',ms)+gP('2.4',ms)
  const pedidos=(ms:number[])=>ms.reduce((s,m)=>s+(brutos[m]?.pedidos||0),0)
  /* Ratio por pedido: valor / nº pedidos */
  const ratioPed=(valueFn:(ms:number[])=>number)=>(ms:number[])=>{const p=pedidos(ms);return p?valueFn(ms)/p:0}

  const visibleCols = cols.filter(c=>!c.hid)

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
          <table style={{width:'100%',borderCollapse:'separate',borderSpacing:0,fontFamily:'Lexend, sans-serif',fontSize:13,minWidth:1400}}>
            <thead><tr>
              <th style={thFi}>PyG DETALLADO</th>
              {visibleCols.map((c,i)=>[
                <th key={i} style={c.isY?thYr:c.isQ?thQs:thSt} onClick={c.qn?()=>tQ(c.qn!):undefined}>{c.label}</th>,
                <th key={`p${i}`} style={{...thPct,background:c.isQ||c.isY?'rgba(176,29,35,0.06)':thPct.background}}>% s/IN</th>
              ])}
            </tr></thead>
            <tbody>
              {/* ══════ PyG DETALLADO — RESUMEN (estructura Excel) ══════ */}
              {secH('PyG Detallado')}
              {rA() as any}
              {/* INGRESOS POR OPERACIONES */}
              {(()=>{const b=aB();return<tr style={{background:b}} {...hv}><td style={grpS}>Ingresos por operaciones</td><Cells fn={iT} bg='rgba(176,29,35,0.04)'/></tr>})()}
              {/* NÚMERO DE PEDIDOS */}
              {(()=>{const b=aB();return<tr style={{background:b}} {...hv}><td style={{...tdFi,paddingLeft:20,color:'#7a8090'}}>Número de pedidos</td><Cells fn={pedidos}/></tr>})()}
              {/* GASTOS FIJOS */}
              {(()=>{const b=aB();return<tr style={{background:b}} {...hv}><td style={{...tdFi,fontWeight:600}}>Gastos fijos</td><Cells fn={gFijos} pctFn={ms=>pctOf(gFijos(ms),iT(ms))}/></tr>})()}
              {/* Ratio GF por pedido */}
              <tr><td style={tdRatioFi}>por pedido</td><CellsRatio fn={ratioPed(gFijos)}/></tr>
              {/* GASTOS VARIABLES */}
              {(()=>{const b=aB();return<tr style={{background:b}} {...hv}><td style={{...tdFi,fontWeight:600}}>Gastos variables</td><Cells fn={gVar} pctFn={ms=>pctOf(gVar(ms),iT(ms))}/></tr>})()}
              {/* Ratio GV por pedido */}
              <tr><td style={tdRatioFi}>por pedido</td><CellsRatio fn={ratioPed(gVar)}/></tr>
              {/* TOTAL GASTOS */}
              <tr><td style={totS}>Total gastos (GF + GV)</td><Cells fn={gT} pctFn={ms=>pctOf(gT(ms),iT(ms))} bg='rgba(176,29,35,0.07)'/></tr>
              {/* Ratio Total por pedido */}
              <tr><td style={tdRatioFi}>por pedido</td><CellsRatio fn={ratioPed(gT)}/></tr>
              {/* RESULTADO */}
              <tr><td style={resS}>Resultado</td><Cells fn={res} sign bg='rgba(29,158,117,0.06)'/></tr>
              {sepR}

              {/* ══════ RATIOS SOBRE VENTAS (% s/IN) ══════ */}
              {secH('Ratios sobre ventas')}
              {rA() as any}
              {grupos.map(g=>{const bn=gB(g.id);const sc=sC(pctOf(gP(g.id,ALL),iT(ALL)),bn);const bI=bn?` (${bn.pct_min}-${bn.pct_max}%)`:'';const b=aB();return<tr key={g.id} style={{background:b}} {...hv}><td style={grpS}><span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:sc,marginRight:5,verticalAlign:'middle'}}/>{g.nombre}<span style={{color:'#7a8090',fontSize:10,fontWeight:400,letterSpacing:'1px'}}>{bI}</span></td><Cells fn={ms=>pctOf(gP(g.id,ms),iT(ms))} pct/></tr>})}
              <tr><td style={totS}>Total gastos</td><Cells fn={ms=>pctOf(gT(ms),iT(ms))} pct bg='rgba(176,29,35,0.07)'/></tr>
              <tr><td style={resS}>Beneficio</td><Cells fn={ms=>pctOf(res(ms),iT(ms))} pct sign bg='rgba(29,158,117,0.06)'/></tr>
              {sepR}

              {/* ══════ DISTRIBUCIÓN DE GASTOS (% s/GS) ══════ */}
              {(()=>{
                /* Header cambia a % s/GS */
                return <tr><td colSpan={99} style={{...tdFi,background:'#f5f3ef',fontFamily:'Oswald, sans-serif',fontSize:10,letterSpacing:'2px',textTransform:'uppercase',color:'#7a8090',padding:'12px 12px 6px',borderBottom:'1px solid #d0c8bc',fontWeight:500}}>Distribución de gastos</td></tr>
              })()}
              {rA() as any}
              {grupos.map(g=>{const bn=gB(g.id);const sc=sC(pctOf(gP(g.id,ALL),iT(ALL)),bn);const bI=bn?` (${bn.pct_min}-${bn.pct_max}%)`:'';const b=aB();return<tr key={`d-${g.id}`} style={{background:b}} {...hv}><td style={grpS}><span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:sc,marginRight:5,verticalAlign:'middle'}}/>{g.id} {g.nombre}<span style={{color:'#7a8090',fontSize:10,fontWeight:400,letterSpacing:'1px'}}>{bI}</span></td><Cells fn={ms=>gP(g.id,ms)} pctFn={ms=>pctOf(gP(g.id,ms),gT(ms))} bg='rgba(176,29,35,0.04)'/></tr>})}
              <tr><td style={totS}>Total gastos</td><Cells fn={gT} bg='rgba(176,29,35,0.07)'/></tr>
              {sepR}

              {/* ══════ // RESUMEN // — Desglose completo ══════ */}
              {secH('// Resumen //')}
              {rA() as any}
              {/* 1.01 INGRESOS POR VENTAS */}
              {(()=>{const b=aB();return<tr style={{background:b}} {...hv}><td style={grpS}>1.01 Ingresos por ventas</td><Cells fn={iT} bg='rgba(176,29,35,0.04)'/></tr>})()}
              {/* Desglose por canal */}
              {ingC.map(c=>{if(!vis(c.nombre))return null;const b=aB();return<tr key={c.id} style={{background:b}} {...hv}><td style={{...tdFi,paddingLeft:20}}>{c.nombre}</td><Cells fn={ms=>sumMeses(ingresos[c.id]||{},ms)} pctFn={ms=>pctOf(sumMeses(ingresos[c.id]||{},ms),iT(ms))}/></tr>})}
              {/* Facturación bruta */}
              {(()=>{const b=aB();return<tr style={{background:b}}><td style={{...tdFi,fontStyle:'italic',color:'#7a8090'}}>Facturación bruta</td><Cells fn={ms=>ms.reduce((s,m)=>s+(brutos[m]?.total||0),0)}/></tr>})()}
              {/* Pedidos */}
              {(()=>{const b=aB();return<tr style={{background:b}}><td style={{...tdFi,paddingLeft:20,color:'#7a8090'}}>Pedidos</td><Cells fn={pedidos}/></tr>})()}
              {/* Ticket medio */}
              {(()=>{const b=aB();return<tr style={{background:b}}><td style={{...tdFi,paddingLeft:20,color:'#7a8090'}}>Ticket medio</td><Cells fn={ms=>{const bt=ms.reduce((s,m)=>s+(brutos[m]?.total||0),0);const p=pedidos(ms);return p?Math.round(bt/p*100)/100:0}}/></tr>})()}
              {/* TOTAL INGRESOS */}
              <tr><td style={grpS}>Total ingresos</td><Cells fn={iT} bg='rgba(176,29,35,0.04)'/></tr>
              {sepR}

              {/* ══════ GASTOS POR GRUPO DETALLADO ══════ */}
              {grupos.map(g=>{const bn=gB(g.id);const bL=bn?` (benchmark ${bn.pct_min}-${bn.pct_max}%)`:'';const sN=cN2.filter(c=>c.parent_id===g.id);const sc=sC(pctOf(gP(g.id,ALL),iT(ALL)),bn);return[
                secH(`${g.id} ${g.nombre}${bL}`),
                (rA(),null) as any,
                ...sN.flatMap(sub=>{const ch=cCh(sub.id);return[vis(sub.nombre,true)?(()=>{const b=aB();return<tr key={sub.id} style={{background:b}} {...hv}><td style={{...tdFi,paddingLeft:20}}>{sub.id} {sub.nombre}</td><Cells fn={ms=>sumCatMeses(gastos,sub.id,ms)} pctFn={ms=>pctOf(sumCatMeses(gastos,sub.id,ms),iT(ms))}/></tr>})():null,...ch.map(c=>{if(!vis(c.nombre))return null;const b=aB();return<tr key={c.id} style={{background:b}} {...hv}><td style={{...tdFi,paddingLeft:34,color:'#7a8090',fontSize:12}}>{c.nombre}</td><Cells fn={ms=>sumMeses(gastos[c.id]||{},ms)} pctFn={ms=>pctOf(sumMeses(gastos[c.id]||{},ms),iT(ms))}/></tr>})].filter(Boolean)}),
                <tr key={`t-${g.id}`}><td style={grpS}><span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:sc,marginRight:5,verticalAlign:'middle'}}/>{g.id} Total {g.nombre}</td><Cells fn={ms=>gP(g.id,ms)} pctFn={ms=>pctOf(gP(g.id,ms),iT(ms))} bg='rgba(176,29,35,0.04)'/></tr>,
                sepR,
              ].filter(Boolean)}).flat()}
              <tr><td style={totS}>Total gastos</td><Cells fn={gT} pctFn={ms=>pctOf(gT(ms),iT(ms))} bg='rgba(176,29,35,0.07)'/></tr>
              {/* Prime Cost */}
              {(()=>{const b=aB();return<tr style={{background:b}} {...hv}><td style={{...tdFi,fontFamily:'Oswald, sans-serif',fontSize:11,letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:700}}>Prime Cost <span style={{color:'#7a8090',fontSize:10,fontWeight:400}}>(obj &lt;60%)</span></td><Cells fn={pc} pct/></tr>})()}
              <tr><td style={resS}>EBITDA / Resultado</td><Cells fn={res} sign pctFn={ms=>pctOf(res(ms),iT(ms))} bg='rgba(29,158,117,0.06)'/></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
