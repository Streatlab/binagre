/**
 * Punto de Equilibrio v7 — fallback neto unificado: bruto - (com% + fijo€/ped + fee_periodo) * 1.21
 */
import { useState, useMemo, useEffect, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, fmtFechaCorta } from '@/styles/tokens'
import { useCalendario } from '@/contexts/CalendarioContext'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import TabsPastilla from '@/components/ui/TabsPastilla'
import { useRunning } from '@/hooks/useRunning'
import { useConfig, getCanalComision } from '@/hooks/useConfig'
import { cardBig, lbl, lblXs, OSWALD, LEXEND, COLOR } from '@/components/panel/resumen/tokens'
import { fmtEur, fmtPct } from '@/lib/format'

const ROJO=COLOR.rojoSL,VERDE=COLOR.verde,AMBAR=COLOR.ambar,ERR=COLOR.rojo
const MESES_CORTO=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']
const GRUPOS_FIJOS=['Equipo','Alquiler','Controlables'] as const
const GRUPOS_VARIABLES=['Producto'] as const
const COLOR_GRUPO:Record<string,string>={'Producto':'#F26B1F','Equipo':'#B01D23','Alquiler':'#8b5a9f','Controlables':'#4a90d9'}
const IVA=0.21
type Tab='resumen'|'simulador'
interface CanalDatos{bruto:number;neto:number;margenPct:number;pedidos:number}
type CanalId='uber'|'glovo'|'just_eat'|'web'|'directa'
const CANAL_DEF:Array<{id:CanalId;label:string;bg:string;border:string;colorLabel:string;size:'big'|'mini'}>=[
{id:'uber',label:'UBER EATS',bg:`${COLOR.uber}20`,border:COLOR.uber,colorLabel:COLOR.verdeOscuro,size:'big'},
{id:'glovo',label:'GLOVO',bg:`${COLOR.glovo}30`,border:'rgba(200,180,0,0.30)',colorLabel:COLOR.glovoDark,size:'big'},
{id:'just_eat',label:'JUST EAT',bg:`${COLOR.je}20`,border:COLOR.je,colorLabel:COLOR.jeDark,size:'big'},
{id:'web',label:'WEB',bg:`${COLOR.webSL}10`,border:`${COLOR.webSL}50`,colorLabel:COLOR.webDark,size:'mini'},
{id:'directa',label:'DIRECTA',bg:`${COLOR.directa}20`,border:COLOR.directa,colorLabel:COLOR.directaDark,size:'mini'}]
const ID_TO_NOMBRE:Record<CanalId,string>={uber:'Uber Eats',glovo:'Glovo',just_eat:'Just Eat',web:'Web Propia',directa:'Venta Directa'}
function periodosEnRango(periodicidad:string,desde:Date,hasta:Date):number{const dias=Math.max(1,Math.round((hasta.getTime()-desde.getTime())/86400000)+1);switch(periodicidad){case'semanal_por_marca':return Math.ceil(dias/7);case'quincenal_por_marca':return Math.ceil(dias/15);case'mensual':return Math.ceil(dias/30);default:return 0}}
export default function PuntoEquilibrio(){
const{T}=useTheme()
const[tab,setTab]=useState<Tab>('resumen')
const{canales}=useConfig()
const[periodoDesde,setPeriodoDesde]=useState<Date>(()=>{const h=new Date();h.setDate(1);h.setHours(0,0,0,0);return h})
const[periodoHasta,setPeriodoHasta]=useState<Date>(()=>{const h=new Date();h.setHours(23,59,59,999);return h})
const[periodoLabel,setPeriodoLabel]=useState('Mes en curso')
const periodo=useMemo(()=>({desde:periodoDesde,hasta:periodoHasta,key:'pe',label:periodoLabel}),[periodoDesde,periodoHasta,periodoLabel])
const anio=periodo.desde.getFullYear()
const{loading,error,gastos,facturacion}=useRunning(periodo,anio,null,null,'sin')
const{diasOperativosEnRango}=useCalendario()
const brutoPorCanal=useMemo(()=>{const m:Record<CanalId,number>={uber:0,glovo:0,just_eat:0,web:0,directa:0};const ped:Record<CanalId,number>={uber:0,glovo:0,just_eat:0,web:0,directa:0};for(const fr of facturacion as any[]){const f=fr as Record<string,number|null|undefined>;m.uber+=Number(f.uber_bruto||0);m.glovo+=Number(f.glovo_bruto||0);m.just_eat+=Number(f.je_bruto||0);m.web+=Number(f.web_bruto||0);m.directa+=Number(f.directa_bruto||0);ped.uber+=Number(f.uber_pedidos||0);ped.glovo+=Number(f.glovo_pedidos||0);ped.just_eat+=Number(f.je_pedidos||0);ped.web+=Number(f.web_pedidos||0);ped.directa+=Number(f.directa_pedidos||0)};return{bruto:m,pedidos:ped}},[facturacion])
const totalBruto=useMemo(()=>Object.values(brutoPorCanal.bruto).reduce((a,v)=>a+v,0),[brutoPorCanal])
const totalPedidos=useMemo(()=>facturacion.reduce((a,f)=>a+Number((f as any).total_pedidos||0),0),[facturacion])
const meses=useMemo(()=>{const set=new Set<string>();const cur=new Date(periodo.desde);while(cur<=periodo.hasta){set.add(`${cur.getFullYear()}-${cur.getMonth()+1}`);cur.setDate(cur.getDate()+1)};return Array.from(set).map(s=>{const[y,m]=s.split('-').map(Number);return{anio:y,mes:m}})},[periodo])
const[resumenes,setResumenes]=useState<Array<{plataforma:string;mes:number;año:number;bruto:number|null;comisiones:number|null;fees:number|null;cargos_promocion:number|null;neto_real_cobrado:number|null}>>([])
useEffect(()=>{if(meses.length===0)return;let cancel=false;(async()=>{const conditions=meses.map(m=>`and(mes.eq.${m.mes},año.eq.${m.anio})`).join(',');const{data}=await supabase.from('resumenes_plataforma_marca_mensual').select('plataforma, mes, año, bruto, comisiones, fees, cargos_promocion, neto_real_cobrado').or(conditions);if(cancel)return;setResumenes((data??[]) as any)})();return()=>{cancel=true}},[meses.map(m=>`${m.anio}-${m.mes}`).join('|')])
const datosPorCanal=useMemo<Record<CanalId,CanalDatos>>(()=>{const out={} as Record<CanalId,CanalDatos>;const ids:CanalId[]=['uber','glovo','just_eat','web','directa'];for(const c of ids){const filas=resumenes.filter(r=>r.plataforma===c);const brutoFD=brutoPorCanal.bruto[c];const pedFD=brutoPorCanal.pedidos[c];let neto=0;let brutoCalc=0;if(filas.length>0){const tieneReal=filas.some(f=>f.neto_real_cobrado!=null);brutoCalc=filas.reduce((s,f)=>s+(f.bruto??0),0);if(tieneReal){neto=filas.reduce((s,f)=>s+(f.neto_real_cobrado??0),0)}else{const com=filas.reduce((s,f)=>s+(f.comisiones??0),0);const fee=filas.reduce((s,f)=>s+(f.fees??0),0);const car=filas.reduce((s,f)=>s+(f.cargos_promocion??0),0);const ivaCom=(com+fee+car)*IVA;neto=brutoCalc-com-fee-car-ivaCom}}else{
  // FALLBACK SIN OCR: formula UNIFICADA completa con fee fijo, fee periodico e IVA
  const cfg=getCanalComision(canales,ID_TO_NOMBRE[c])
  const fijoTotal=cfg.fijoEur*pedFD
  const periodos=cfg.feePeriodoEur>0?periodosEnRango(cfg.feePeriodicidad,periodoDesde,periodoHasta):0
  const feePeriodoTotal=cfg.feePeriodoEur*periodos
  const baseComisionable=cfg.comisionDec*brutoFD+fijoTotal+feePeriodoTotal
  const ivaComision=baseComisionable*IVA
  neto=Math.max(0,brutoFD-baseComisionable-ivaComision)
};const brutoFinal=filas.length>0?brutoCalc:brutoFD;const margenPct=brutoFinal>0?(neto/brutoFinal)*100:0;out[c]={bruto:brutoFinal,neto,margenPct,pedidos:pedFD}};return out},[resumenes,brutoPorCanal,canales,periodoDesde,periodoHasta])
const totalNeto=useMemo(()=>Object.values(datosPorCanal).reduce((a,c)=>a+c.neto,0),[datosPorCanal])
const margenNetoPct=totalBruto>0?(totalNeto/totalBruto)*100:0
const gastosPorGrupo=useMemo(()=>{const m:Record<string,number>={};for(const gr of gastos as any[]){const g=gr as{categoria?:string;importe?:number};const grupo=String(g.categoria??'');if(!grupo)continue;const importe=Math.abs(Number(g.importe??0));m[grupo]=(m[grupo]??0)+importe};return m},[gastos])
const totalFijos=useMemo(()=>GRUPOS_FIJOS.reduce((a,g)=>a+(gastosPorGrupo[g]??0),0),[gastosPorGrupo])
const totalVariablesGasto=useMemo(()=>GRUPOS_VARIABLES.reduce((a,g)=>a+(gastosPorGrupo[g]??0),0),[gastosPorGrupo])
const totalComisiones=Math.max(0,totalBruto-totalNeto)
const totalVariables=totalVariablesGasto+totalComisiones
const margenContribucion=totalBruto-totalVariables
const margenContribPct=totalBruto>0?(margenContribucion/totalBruto)*100:0
const peMensual=margenContribPct>0?totalFijos/(margenContribPct/100):null
const beneficio=totalBruto-totalVariables-totalFijos
const ebitdaPct=totalBruto>0?(beneficio/totalBruto)*100:0
const diasOperativos=useMemo(()=>diasOperativosEnRango(periodo.desde,periodo.hasta)||1,[diasOperativosEnRango,periodo.desde,periodo.hasta])
const brutoMedioDiario=totalBruto/diasOperativos
const ticketMedioBruto=totalPedidos>0?totalBruto/totalPedidos:0
const ticketMedioNeto=totalPedidos>0?totalNeto/totalPedidos:0
const diaCubreInfo=useMemo(()=>{if(!peMensual||brutoMedioDiario<=0)return{fecha:null as Date|null,diasNecesarios:null as number|null,mesesDelta:0};const diasNecesarios=Math.ceil(peMensual/brutoMedioDiario);const inicio=new Date(periodo.desde.getFullYear(),periodo.desde.getMonth(),1);const cur=new Date(inicio);let contados=0;let safety=0;while(contados<diasNecesarios&&safety<730){if(diasOperativosEnRango(cur,cur)===1)contados++;if(contados>=diasNecesarios)break;cur.setDate(cur.getDate()+1);safety++};const mesesDelta=(cur.getFullYear()-inicio.getFullYear())*12+(cur.getMonth()-inicio.getMonth());return{fecha:cur,diasNecesarios,mesesDelta}},[peMensual,brutoMedioDiario,periodo.desde,diasOperativosEnRango])
const estado:'cubre'|'ajustado'|'pierde'=peMensual==null?'pierde':totalBruto>=peMensual*1.05?'cubre':totalBruto>=peMensual?'ajustado':'pierde'
const colorEstado=estado==='cubre'?VERDE:estado==='ajustado'?AMBAR:ERR
return(<div style={{background:'#f5f3ef',padding:'24px 28px',minHeight:'100vh'}}>
<div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:18,flexWrap:'wrap',gap:12}}>
<div>
<h2 style={{color:ROJO,fontFamily:OSWALD,fontSize:22,fontWeight:600,letterSpacing:'3px',margin:0,textTransform:'uppercase'}}>PUNTO DE EQUILIBRIO</h2>
<span style={{fontFamily:LEXEND,fontSize:13,color:'#7a8090',display:'block',marginTop:4}}>{fmtFechaCorta(periodo.desde.toISOString().slice(0,10))} — {fmtFechaCorta(periodo.hasta.toISOString().slice(0,10))}</span>
</div>
<div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
<SelectorFechaUniversal nombreModulo="punto_equilibrio" defaultOpcion="mes_en_curso" onChange={(desde,hasta,label)=>{setPeriodoDesde(desde);setPeriodoHasta(hasta);setPeriodoLabel(label)}}/>
</div>
</div>
<TabsPastilla tabs={[{id:'resumen',label:'Resumen'},{id:'simulador',label:'Simulador'}]} activeId={tab} onChange={(id)=>setTab(id as Tab)}/>
{error&&<div style={{background:'#FCEBEB',border:`1px solid ${ROJO}`,color:'#A32D2D',padding:16,borderRadius:8,fontFamily:FONT.body,fontSize:13,marginTop:16}}>Error: {error}</div>}
{loading&&!error&&<div style={{padding:40,color:T.mut,fontFamily:FONT.body}}>Cargando datos reales...</div>}
{!loading&&!error&&tab==='resumen'&&<TabResumen totalBruto={totalBruto} totalNeto={totalNeto} totalPedidos={totalPedidos} totalFijos={totalFijos} totalComisiones={totalComisiones} totalVariables={totalVariables} margenContribPct={margenContribPct} margenNetoPct={margenNetoPct} peMensual={peMensual} diaCubreInfo={diaCubreInfo} datosPorCanal={datosPorCanal} gastosPorGrupo={gastosPorGrupo} diasOperativos={diasOperativos} brutoMedioDiario={brutoMedioDiario} colorEstado={colorEstado} beneficio={beneficio} ebitdaPct={ebitdaPct} ticketMedioBruto={ticketMedioBruto} ticketMedioNeto={ticketMedioNeto}/>}
{!loading&&!error&&tab==='simulador'&&<TabSimulador totalBruto={totalBruto} totalFijos={totalFijos} margenContribPct={margenContribPct} peMensual={peMensual} totalPedidos={totalPedidos} brutoMedioDiario={brutoMedioDiario}/>}
</div>)
}
interface TabResumenProps{totalBruto:number;totalNeto:number;totalPedidos:number;totalFijos:number;totalComisiones:number;totalVariables:number;margenContribPct:number;margenNetoPct:number;peMensual:number|null;diaCubreInfo:{fecha:Date|null;diasNecesarios:number|null;mesesDelta:number};datosPorCanal:Record<CanalId,CanalDatos>;gastosPorGrupo:Record<string,number>;diasOperativos:number;brutoMedioDiario:number;colorEstado:string;beneficio:number;ebitdaPct:number;ticketMedioBruto:number;ticketMedioNeto:number}
function TabResumen(p:TabResumenProps){
const filasFijos=GRUPOS_FIJOS.map(g=>({label:g,valor:p.gastosPorGrupo[g]??0,color:COLOR_GRUPO[g]})).filter(f=>f.valor>0).sort((a,b)=>b.valor-a.valor)
const filasVariables=[...GRUPOS_VARIABLES.map(g=>({label:g,valor:p.gastosPorGrupo[g]??0,color:COLOR_GRUPO[g]})),{label:'Comisiones plataformas',valor:p.totalComisiones,color:'#F26B1F'}].filter(f=>f.valor>0).sort((a,b)=>b.valor-a.valor)
return(<div style={{marginTop:16}}>
<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(360px, 1fr))',gap:14,marginBottom:14}}>
<CardFacturacion totalBruto={p.totalBruto} totalNeto={p.totalNeto} margenNetoPct={p.margenNetoPct} totalPedidos={p.totalPedidos} ticketMedioBruto={p.ticketMedioBruto} ticketMedioNeto={p.ticketMedioNeto} datosPorCanal={p.datosPorCanal}/>
<CardPE peMensual={p.peMensual} totalBruto={p.totalBruto} diaCubreInfo={p.diaCubreInfo} colorEstado={p.colorEstado} brutoMedioDiario={p.brutoMedioDiario} diasOperativos={p.diasOperativos} ticketMedioBruto={p.ticketMedioBruto} margenContribPct={p.margenContribPct}/>
<CardResultado beneficio={p.beneficio} ebitdaPct={p.ebitdaPct} totalBruto={p.totalBruto} totalNeto={p.totalNeto} totalFijos={p.totalFijos} totalVariables={p.totalVariables} margenContribPct={p.margenContribPct}/>
</div>
<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(360px, 1fr))',gap:14}}>
<CardCostes titulo="COSTES FIJOS · SIN IVA" total={p.totalFijos} filas={filasFijos} totalBruto={p.totalBruto}/>
<CardCostes titulo="COSTES VARIABLES · SIN IVA" total={p.totalVariables} filas={filasVariables} totalBruto={p.totalBruto}/>
</div>
</div>)
}
function CardFacturacion({totalBruto,totalNeto,margenNetoPct,totalPedidos,ticketMedioBruto,ticketMedioNeto,datosPorCanal}:{totalBruto:number;totalNeto:number;margenNetoPct:number;totalPedidos:number;ticketMedioBruto:number;ticketMedioNeto:number;datosPorCanal:Record<CanalId,CanalDatos>}){
const bigs=CANAL_DEF.filter(c=>c.size==='big')
const minis=CANAL_DEF.filter(c=>c.size==='mini')
return(<div style={cardBig}>
<div style={lbl}>INGRESOS DEL PERIODO</div>
<div style={{display:'flex',alignItems:'baseline',gap:18,marginTop:8,flexWrap:'wrap'}}>
<div><div style={{fontFamily:OSWALD,fontSize:38,fontWeight:600,color:'#111111'}}>{fmtEur(totalBruto,{showEuro:false,decimals:2})}</div><div style={lblXs}>BRUTO</div></div>
<div><div style={{fontFamily:OSWALD,fontSize:38,fontWeight:600,color:VERDE}}>{fmtEur(totalNeto,{showEuro:false,decimals:2})}</div><div style={{fontFamily:OSWALD,fontSize:10,letterSpacing:'1.5px',color:VERDE,textTransform:'uppercase',fontWeight:500}}>NETO · {fmtPct(margenNetoPct,2)}</div></div>
</div>
<div style={{fontFamily:LEXEND,fontSize:12,color:'#3a4050',marginTop:10,marginBottom:16}}><strong style={{fontFamily:OSWALD,fontSize:14}}>{fmtEur(totalPedidos,{showEuro:false,decimals:0})}</strong> pedidos · TM <strong style={{fontFamily:OSWALD}}>{fmtEur(ticketMedioBruto,{showEuro:false,decimals:2})}</strong> bruto / <strong style={{fontFamily:OSWALD,color:VERDE}}>{fmtEur(ticketMedioNeto,{showEuro:false,decimals:2})}</strong> neto</div>
<div style={{display:'flex',flexDirection:'column',gap:10}}>
{bigs.map(c=>{const d=datosPorCanal[c.id];const pctMix=totalBruto>0?(d.bruto/totalBruto)*100:0;return<CardCanalBig key={c.id} label={c.label} bg={c.bg} border={c.border} colorLabel={c.colorLabel} bruto={d.bruto} neto={d.neto} margenPct={d.margenPct} pctMix={pctMix}/>})}
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>{minis.map(c=>{const d=datosPorCanal[c.id];const pctMix=totalBruto>0?(d.bruto/totalBruto)*100:0;return<CardCanalMini key={c.id} label={c.label} bg={c.bg} border={c.border} colorLabel={c.colorLabel} bruto={d.bruto} neto={d.neto} margenPct={d.margenPct} pctMix={pctMix}/>})}</div>
</div>
</div>)
}
function CardCanalBig({label,bg,border,colorLabel,bruto,neto,margenPct,pctMix}:{label:string;bg:string;border:string;colorLabel:string;bruto:number;neto:number;margenPct:number;pctMix:number}){
return(<div style={{background:bg,border:`0.5px solid ${border}`,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
<div><div style={{...lblXs,color:colorLabel}}>{label} · {fmtPct(pctMix,2)}</div><div style={{fontFamily:OSWALD,fontSize:24,fontWeight:600,color:'#111111',marginTop:2}}>{fmtEur(bruto,{showEuro:false,decimals:2})}</div><div style={{fontSize:11,color:'#3a4050',fontFamily:LEXEND}}>Bruto</div></div>
<div style={{textAlign:'right'}}><div style={{fontFamily:OSWALD,fontSize:24,fontWeight:600,color:VERDE}}>{fmtEur(neto,{showEuro:false,decimals:2})}</div><div style={{fontSize:12,color:VERDE,fontFamily:LEXEND}}>Margen {fmtPct(margenPct,2)}</div></div>
</div>)
}
function CardCanalMini({label,bg,border,colorLabel,bruto,neto,margenPct,pctMix}:{label:string;bg:string;border:string;colorLabel:string;bruto:number;neto:number;margenPct:number;pctMix:number}){
return(<div style={{background:bg,border:`0.5px solid ${border}`,borderRadius:14,padding:'10px 12px'}}>
<div style={{...lblXs,color:colorLabel}}>{label} · {fmtPct(pctMix,2)}</div>
<div style={{fontFamily:OSWALD,fontSize:15,fontWeight:600,color:'#111111',marginTop:2}}>{fmtEur(bruto,{showEuro:false,decimals:2})}</div>
<div style={{fontSize:10,color:COLOR.textMut,fontFamily:LEXEND}}>{fmtEur(neto,{showEuro:false,decimals:2})} neto · {fmtPct(margenPct,2)}</div>
</div>)
}
function CardPE({peMensual,totalBruto,diaCubreInfo,colorEstado,brutoMedioDiario,diasOperativos,ticketMedioBruto,margenContribPct}:{peMensual:number|null;totalBruto:number;diaCubreInfo:{fecha:Date|null;diasNecesarios:number|null;mesesDelta:number};colorEstado:string;brutoMedioDiario:number;diasOperativos:number;ticketMedioBruto:number;margenContribPct:number}){
const pctCubierto=peMensual?Math.min(100,(totalBruto/peMensual)*100):0
const fechaPE=diaCubreInfo.fecha,mesesDelta=diaCubreInfo.mesesDelta
let circuloLinea1='—',circuloLinea2='',circuloColor=colorEstado
if(fechaPE&&peMensual){if(mesesDelta===0){circuloLinea1=String(fechaPE.getDate());circuloLinea2=MESES_CORTO[fechaPE.getMonth()]}else{circuloLinea1=`+${mesesDelta}M`;circuloLinea2=MESES_CORTO[fechaPE.getMonth()];if(mesesDelta>=1)circuloColor=ERR;else if(mesesDelta===0&&pctCubierto<100)circuloColor=AMBAR}}else circuloColor=ERR
const pedidosNecesarios=peMensual&&ticketMedioBruto>0?Math.ceil(peMensual/ticketMedioBruto):null
const brutoDiaObjetivo=peMensual!=null?peMensual/diasOperativos:null
const diasNecesarios=diaCubreInfo.diasNecesarios
return(<div style={{...cardBig,background:'linear-gradient(180deg, #fff 0%, #1D9E7508 100%)'}}>
<div style={lbl}>PUNTO DE EQUILIBRIO</div>
<div style={{display:'flex',alignItems:'baseline',gap:18,marginTop:8,flexWrap:'wrap'}}>
<div><div style={{fontFamily:OSWALD,fontSize:38,fontWeight:600,color:'#111111'}}>{peMensual!=null?fmtEur(peMensual,{showEuro:false,decimals:2}):'—'}</div><div style={lblXs}>BRUTO PARA NO PERDER</div></div>
<div><div style={{fontFamily:OSWALD,fontSize:22,fontWeight:600,color:VERDE}}>{fmtPct(margenContribPct,2)}</div><div style={{fontFamily:OSWALD,fontSize:10,letterSpacing:'1.5px',color:VERDE,textTransform:'uppercase',fontWeight:500}}>MARGEN CONTRIB.</div></div>
</div>
<div style={{display:'flex',alignItems:'center',gap:16,marginTop:18}}>
<div style={{width:86,height:86,borderRadius:'50%',background:circuloColor,color:'#fff',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
<div style={{fontFamily:OSWALD,fontSize:24,fontWeight:600,lineHeight:1}}>{circuloLinea1}</div>
{circuloLinea2&&<div style={{fontFamily:OSWALD,fontSize:10,fontWeight:500,letterSpacing:1,marginTop:4}}>{circuloLinea2}</div>}
</div>
<div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
<div><div style={{fontFamily:OSWALD,fontSize:18,fontWeight:600,color:'#111111'}}>{diasNecesarios!=null?fmtEur(diasNecesarios,{showEuro:false,decimals:0}):'—'}</div><div style={lblXs}>DÍAS PARA CUBRIR</div></div>
<div><div style={{fontFamily:OSWALD,fontSize:18,fontWeight:600,color:'#111111'}}>{pedidosNecesarios!=null?fmtEur(pedidosNecesarios,{showEuro:false,decimals:0}):'—'}</div><div style={lblXs}>PEDIDOS NECES.</div></div>
<div><div style={{fontFamily:OSWALD,fontSize:14,fontWeight:600,color:'#111111'}}>{fmtEur(brutoMedioDiario,{showEuro:false,decimals:2})}</div><div style={lblXs}>€/DÍA REAL</div></div>
<div><div style={{fontFamily:OSWALD,fontSize:14,fontWeight:600,color:brutoDiaObjetivo&&brutoMedioDiario>=brutoDiaObjetivo?VERDE:ERR}}>{brutoDiaObjetivo!=null?fmtEur(brutoDiaObjetivo,{showEuro:false,decimals:2}):'—'}</div><div style={lblXs}>€/DÍA OBJETIVO</div></div>
</div>
</div>
{peMensual!=null&&<><div style={{height:8,borderRadius:4,background:'#ebe8e2',overflow:'hidden',marginTop:16}}><div style={{width:`${pctCubierto}%`,height:'100%',background:colorEstado,transition:'width 0.5s ease'}}/></div>
<div style={{display:'flex',justifyContent:'space-between',fontFamily:LEXEND,fontSize:11,color:'#7a8090',marginTop:6}}><span>Cubierto</span><strong style={{color:colorEstado,fontFamily:OSWALD,fontSize:12}}>{fmtPct(pctCubierto,2)}</strong></div></>}
</div>)
}
function CardResultado({beneficio,ebitdaPct,totalBruto,totalNeto,totalFijos,totalVariables,margenContribPct}:{beneficio:number;ebitdaPct:number;totalBruto:number;totalNeto:number;totalFijos:number;totalVariables:number;margenContribPct:number}){
const colorBen=beneficio>=0?VERDE:ERR
const filas=[{label:'Bruto',valor:totalBruto,color:'#111111',signed:false},{label:'Neto estimado',valor:totalNeto,color:VERDE,signed:false},{label:'Costes variables',valor:-totalVariables,color:'#3a4050',signed:true},{label:'Costes fijos',valor:-totalFijos,color:'#3a4050',signed:true}]
return(<div style={cardBig}>
<div style={lbl}>RESULTADO</div>
<div style={{display:'flex',alignItems:'baseline',gap:18,marginTop:8,flexWrap:'wrap'}}>
<div><div style={{fontFamily:OSWALD,fontSize:38,fontWeight:600,color:colorBen}}>{fmtEur(beneficio,{showEuro:false,decimals:2,signed:true})}</div><div style={{fontFamily:OSWALD,fontSize:10,letterSpacing:'1.5px',color:colorBen,textTransform:'uppercase',fontWeight:500}}>BENEFICIO · EBITDA</div></div>
<div><div style={{fontFamily:OSWALD,fontSize:22,fontWeight:600,color:colorBen}}>{fmtPct(ebitdaPct,2)}</div><div style={{fontFamily:OSWALD,fontSize:10,letterSpacing:'1.5px',color:'#7a8090',textTransform:'uppercase',fontWeight:500}}>% S/BRUTO</div></div>
</div>
<div style={{fontFamily:LEXEND,fontSize:12,color:'#3a4050',marginTop:10,marginBottom:14}}>Margen contribución <strong style={{fontFamily:OSWALD,color:VERDE}}>{fmtPct(margenContribPct,2)}</strong></div>
<div style={{display:'flex',flexDirection:'column',gap:8}}>
{filas.map((f,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',fontFamily:LEXEND,fontSize:13}}><span style={{color:'#3a4050'}}>{f.label}</span><span style={{fontFamily:OSWALD,fontWeight:600,color:f.color}}>{fmtEur(f.valor,{showEuro:false,decimals:2,signed:f.signed})}</span></div>)}
<div style={{display:'flex',justifyContent:'space-between',fontFamily:LEXEND,fontSize:13,paddingTop:8,borderTop:'0.5px solid #d0c8bc'}}><span style={{color:'#3a4050',fontWeight:600}}>Resultado</span><span style={{fontFamily:OSWALD,fontWeight:600,color:colorBen}}>{fmtEur(beneficio,{showEuro:false,decimals:2,signed:true})}</span></div>
</div>
</div>)
}
function CardCostes({titulo,total,filas,totalBruto}:{titulo:string;total:number;filas:Array<{label:string;valor:number;color:string}>;totalBruto:number}){
const pctSobreBruto=totalBruto>0?(total/totalBruto)*100:0
return(<div style={cardBig}>
<div style={lbl}>{titulo}</div>
<div style={{display:'flex',alignItems:'baseline',gap:18,marginTop:8,flexWrap:'wrap'}}>
<div><div style={{fontFamily:OSWALD,fontSize:38,fontWeight:600,color:'#111111'}}>{fmtEur(total,{showEuro:false,decimals:2})}</div><div style={lblXs}>TOTAL</div></div>
<div><div style={{fontFamily:OSWALD,fontSize:22,fontWeight:600,color:'#7a8090'}}>{fmtPct(pctSobreBruto,2)}</div><div style={{fontFamily:OSWALD,fontSize:10,letterSpacing:'1.5px',color:'#7a8090',textTransform:'uppercase',fontWeight:500}}>S/BRUTO</div></div>
</div>
<div style={{marginTop:16,display:'flex',flexDirection:'column',gap:0}}>
{filas.length===0&&<div style={{fontFamily:LEXEND,fontSize:12,color:'#7a8090',fontStyle:'italic',padding:'8px 0'}}>Sin gastos en el periodo</div>}
{filas.map((f,i)=>{const pct=totalBruto>0?(f.valor/totalBruto)*100:0;return<div key={i} style={{display:'grid',gridTemplateColumns:'1fr auto auto',alignItems:'center',gap:12,padding:'10px 0',borderBottom:i<filas.length-1?'0.5px solid #ebe8e2':'none'}}><span style={{display:'flex',alignItems:'center',gap:8,fontFamily:LEXEND,fontSize:13,color:'#3a4050'}}><span style={{width:8,height:8,borderRadius:4,background:f.color}}/>{f.label}</span><span style={{fontFamily:OSWALD,fontSize:16,fontWeight:600,color:'#111111',minWidth:110,textAlign:'right'}}>{fmtEur(f.valor,{showEuro:false,decimals:2})}</span><span style={{fontFamily:OSWALD,fontSize:12,color:'#7a8090',minWidth:60,textAlign:'right'}}>{fmtPct(pct,2)}</span></div>})}
</div>
</div>)
}
interface Escenario{id:string;preset:PresetKey;ticketMedio:number;margenPct:number;fijos:number;pedidosMes:number;bloqueado?:boolean}
type PresetKey='base'|'subir-ticket'|'bajar-ticket'|'mas-pedidos'|'menos-pedidos'|'add-cocinero'|'gastar-mas'|'gastar-menos'|'subir-margen'|'bajar-margen'|'custom'
const PRESETS:Array<{key:PresetKey;label:string;tipo:'mejora'|'empeora'|'mixto'|'base'}>=[{key:'base',label:'Datos reales',tipo:'base'},{key:'subir-ticket',label:'↑ Subir ticket medio (+1,00)',tipo:'mejora'},{key:'bajar-ticket',label:'↓ Bajar ticket medio (−1,00)',tipo:'empeora'},{key:'mas-pedidos',label:'↑ +20% pedidos',tipo:'mejora'},{key:'menos-pedidos',label:'↓ −20% pedidos',tipo:'empeora'},{key:'add-cocinero',label:'+ Añadir cocinero (+1.800 fijos)',tipo:'empeora'},{key:'gastar-mas',label:'↑ Gastar más (+10% fijos)',tipo:'empeora'},{key:'gastar-menos',label:'↓ Gastar menos (−10% fijos)',tipo:'mejora'},{key:'subir-margen',label:'↑ Subir margen +3pp',tipo:'mejora'},{key:'bajar-margen',label:'↓ Bajar margen −3pp',tipo:'empeora'},{key:'custom',label:'✎ Personalizado',tipo:'mixto'}]
function aplicarPreset(preset:PresetKey,base:{ticketMedio:number;margenPct:number;fijos:number;pedidos:number}):Omit<Escenario,'id'|'preset'>{switch(preset){case'subir-ticket':return{ticketMedio:base.ticketMedio+1,margenPct:base.margenPct,fijos:base.fijos,pedidosMes:base.pedidos};case'bajar-ticket':return{ticketMedio:Math.max(0,base.ticketMedio-1),margenPct:base.margenPct,fijos:base.fijos,pedidosMes:base.pedidos};case'mas-pedidos':return{ticketMedio:base.ticketMedio,margenPct:base.margenPct,fijos:base.fijos,pedidosMes:Math.round(base.pedidos*1.2)};case'menos-pedidos':return{ticketMedio:base.ticketMedio,margenPct:base.margenPct,fijos:base.fijos,pedidosMes:Math.round(base.pedidos*0.8)};case'add-cocinero':return{ticketMedio:base.ticketMedio,margenPct:base.margenPct,fijos:base.fijos+1800,pedidosMes:base.pedidos};case'gastar-mas':return{ticketMedio:base.ticketMedio,margenPct:base.margenPct,fijos:base.fijos*1.10,pedidosMes:base.pedidos};case'gastar-menos':return{ticketMedio:base.ticketMedio,margenPct:base.margenPct,fijos:base.fijos*0.90,pedidosMes:base.pedidos};case'subir-margen':return{ticketMedio:base.ticketMedio,margenPct:base.margenPct+3,fijos:base.fijos,pedidosMes:base.pedidos};case'bajar-margen':return{ticketMedio:base.ticketMedio,margenPct:Math.max(0.1,base.margenPct-3),fijos:base.fijos,pedidosMes:base.pedidos};default:return{ticketMedio:base.ticketMedio,margenPct:base.margenPct,fijos:base.fijos,pedidosMes:base.pedidos}}}
function TabSimulador(p:{totalBruto:number;totalFijos:number;margenContribPct:number;peMensual:number|null;totalPedidos:number;brutoMedioDiario:number}){
const ticketMedioBase=p.totalPedidos>0?p.totalBruto/p.totalPedidos:0
const baseValores={ticketMedio:ticketMedioBase,margenPct:p.margenContribPct,fijos:p.totalFijos,pedidos:p.totalPedidos}
const baseEscenario:Escenario={id:'base',preset:'base',ticketMedio:ticketMedioBase,margenPct:p.margenContribPct,fijos:p.totalFijos,pedidosMes:p.totalPedidos,bloqueado:true}
const[escenarios,setEscenarios]=useState<Escenario[]>(()=>[baseEscenario,{id:'esc-1',preset:'subir-ticket',...aplicarPreset('subir-ticket',baseValores)},{id:'esc-2',preset:'add-cocinero',...aplicarPreset('add-cocinero',baseValores)},{id:'esc-3',preset:'mas-pedidos',...aplicarPreset('mas-pedidos',baseValores)}])
useEffect(()=>{setEscenarios(prev=>{if(prev.length===0)return prev;return prev.map(e=>{if(e.id==='base')return baseEscenario;if(e.preset==='custom')return e;return{...e,...aplicarPreset(e.preset,baseValores)}})})},[p.totalBruto,p.totalFijos,p.margenContribPct,p.totalPedidos])
function cambiarPreset(id:string,preset:PresetKey){setEscenarios(prev=>prev.map(e=>e.id!==id?e:{...e,preset,...aplicarPreset(preset,baseValores)}))}
function actualizarEscenario(id:string,campo:keyof Escenario,valor:number){setEscenarios(prev=>prev.map(e=>e.id===id?{...e,[campo]:valor,preset:'custom' as PresetKey}:e))}
function añadirEscenario(){setEscenarios(prev=>{if(prev.length>=6)return prev;return[...prev,{id:`esc-${Date.now()}`,preset:'custom',...baseValores,pedidosMes:baseValores.pedidos}]})}
function eliminarEscenario(id:string){if(id==='base')return;setEscenarios(prev=>prev.filter(e=>e.id!==id))}
function calcularEscenario(e:Escenario){const brutoEsperado=e.ticketMedio*e.pedidosMes;const peValor=e.margenPct>0?e.fijos/(e.margenPct/100):null;const diasNec=peValor&&p.brutoMedioDiario>0?Math.ceil(peValor/p.brutoMedioDiario):null;const pedNec=peValor&&e.ticketMedio>0?Math.ceil(peValor/e.ticketMedio):null;const beneficio=peValor!=null?brutoEsperado-peValor:0;return{peValor,diasNec,pedNec,brutoEsperado,beneficio}}
return(<div style={{marginTop:16}}>
<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))',gap:14}}>
{escenarios.map(e=>{const calc=calcularEscenario(e);const calcBase=calcularEscenario(baseEscenario);return<CardEscenario key={e.id} escenario={e} calc={calc} calcBase={calcBase} onChangePreset={(pp)=>cambiarPreset(e.id,pp)} onChange={(c,v)=>actualizarEscenario(e.id,c,v)} onDelete={()=>eliminarEscenario(e.id)}/>})}
{escenarios.length<6&&<button onClick={añadirEscenario} style={{...cardBig,border:'1.5px dashed #d0c8bc',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6,minHeight:320,background:'transparent',fontFamily:OSWALD,color:'#7a8090',fontSize:14,letterSpacing:'1px',textTransform:'uppercase'}}><span style={{fontSize:32,fontWeight:300}}>+</span>Añadir escenario</button>}
</div>
</div>)
}
function CardEscenario({escenario,calc,calcBase,onChangePreset,onChange,onDelete}:{escenario:Escenario;calc:{peValor:number|null;diasNec:number|null;pedNec:number|null;brutoEsperado:number;beneficio:number};calcBase:{peValor:number|null;diasNec:number|null;pedNec:number|null;brutoEsperado:number;beneficio:number};onChangePreset:(p:PresetKey)=>void;onChange:(campo:keyof Escenario,valor:number)=>void;onDelete:()=>void}){
const e=escenario
const tipo=PRESETS.find(p=>p.key===e.preset)?.tipo??'mixto'
const PILL_BG:Record<string,string>={base:'#3a4050',mejora:VERDE,empeora:ERR,mixto:AMBAR}
const PILL_LABEL:Record<string,string>={base:'Base',mejora:'Mejora',empeora:'Empeora',mixto:'Custom'}
const deltaBeneficio=calc.beneficio-calcBase.beneficio
return(<div style={{...cardBig,borderWidth:e.bloqueado?'1.5px':'0.5px',borderColor:e.bloqueado?'#3a4050':'#d0c8bc',borderStyle:'solid'}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:14}}>
<div style={{flex:1}}>
{e.bloqueado?<div style={{fontFamily:OSWALD,fontSize:13,fontWeight:600,letterSpacing:'1px',textTransform:'uppercase',color:'#111111'}}>Datos reales del periodo</div>:<select value={e.preset} onChange={(ev)=>onChangePreset(ev.target.value as PresetKey)} style={{fontFamily:OSWALD,fontSize:13,fontWeight:600,letterSpacing:'0.5px',color:'#111111',background:'#fff',border:'0.5px solid #d0c8bc',borderRadius:6,padding:'5px 8px',cursor:'pointer',width:'100%'}}>{PRESETS.filter(p=>p.key!=='base').map(p=><option key={p.key} value={p.key}>{p.label}</option>)}</select>}
</div>
<div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
<span style={{fontFamily:OSWALD,fontSize:10,fontWeight:500,letterSpacing:'1px',padding:'3px 8px',borderRadius:4,textTransform:'uppercase',background:PILL_BG[tipo],color:'#fff'}}>{PILL_LABEL[tipo]}</span>
{!e.bloqueado&&<button onClick={onDelete} style={{background:'transparent',border:'none',cursor:'pointer',color:'#7a8090',fontSize:18,lineHeight:1,padding:'0 4px'}} title="Eliminar">×</button>}
</div>
</div>
<RowInput label="Ticket medio" value={e.ticketMedio} decimales={2} onChange={v=>onChange('ticketMedio',v)} bloqueado={e.bloqueado}/>
<RowInput label="Margen contribución (%)" value={e.margenPct} decimales={2} onChange={v=>onChange('margenPct',v)} bloqueado={e.bloqueado}/>
<RowInput label="Costes fijos" value={e.fijos} decimales={2} onChange={v=>onChange('fijos',v)} bloqueado={e.bloqueado}/>
<RowInput label="Pedidos mes" value={e.pedidosMes} decimales={0} onChange={v=>onChange('pedidosMes',v)} bloqueado={e.bloqueado}/>
<div style={{background:'#ebe8e2',borderRadius:10,padding:14,marginTop:14}}>
<RowResultado label="Bruto esperado" valor={fmtEur(calc.brutoEsperado,{showEuro:false,decimals:2})} color="#111111"/>
<RowResultado label="Punto equilibrio" valor={calc.peValor!=null?fmtEur(calc.peValor,{showEuro:false,decimals:2}):'—'} color="#111111"/>
<RowResultado label="Pedidos para PE" valor={calc.pedNec!=null?fmtEur(calc.pedNec,{showEuro:false,decimals:0}):'—'} color="#111111"/>
<RowResultado label="Días para PE" valor={calc.diasNec!=null?`${fmtEur(calc.diasNec,{showEuro:false,decimals:0})} días`:'—'} color="#111111"/>
<RowResultado label="Beneficio esperado" valor={fmtEur(calc.beneficio,{showEuro:false,decimals:2,signed:true})} color={calc.beneficio>=0?VERDE:ERR} big/>
{!e.bloqueado&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginTop:10,paddingTop:8,borderTop:'0.5px solid #d0c8bc'}}><span style={{fontFamily:OSWALD,fontSize:10,letterSpacing:'1px',textTransform:'uppercase',color:'#7a8090'}}>Vs base · beneficio</span><span style={{fontFamily:OSWALD,fontSize:14,fontWeight:600,color:deltaBeneficio>0?VERDE:deltaBeneficio<0?ERR:'#7a8090'}}>{fmtEur(deltaBeneficio,{showEuro:false,decimals:2,signed:true})}</span></div>}
</div>
</div>)
}
function RowResultado({label,valor,color,big}:{label:string;valor:string;color:string;big?:boolean}){return(<div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:5}}><span style={{fontFamily:OSWALD,fontSize:10,fontWeight:500,letterSpacing:'1px',textTransform:'uppercase',color:'#7a8090'}}>{label}</span><span style={{fontFamily:OSWALD,fontSize:big?22:15,fontWeight:600,color}}>{valor}</span></div>)}
function RowInput({label,value,decimales,onChange,bloqueado}:{label:string;value:number;decimales:number;onChange:(v:number)=>void;bloqueado?:boolean}){
const styleInput:CSSProperties={width:'100%',padding:'6px 10px',border:'0.5px solid #d0c8bc',borderRadius:6,fontSize:13,fontFamily:OSWALD,fontWeight:500,background:bloqueado?'#ebe8e2':'#fff',color:bloqueado?'#7a8090':'#111111',textAlign:'right',outline:'none',cursor:bloqueado?'not-allowed':'text'}
return(<div style={{display:'grid',gridTemplateColumns:'1fr 110px',gap:10,alignItems:'center',padding:'5px 0'}}><span style={{fontFamily:LEXEND,fontSize:12,color:'#3a4050'}}>{label}</span><input type="number" step={decimales>0?0.01:1} value={Number.isFinite(value)?value.toFixed(decimales):''} disabled={bloqueado} onChange={(ev)=>{const n=parseFloat(ev.target.value);if(!isNaN(n))onChange(n)}} style={styleInput}/></div>)
}
