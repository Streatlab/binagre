/**
 * Punto de Equilibrio v7 — fórmula unificada completa:
 *   neto = bruto − (com·bruto + fijo€·pedidos + fee_periodo·periodos·marcas) × 1,21
 * Aplicada tanto en fallback como en cálculo con resúmenes.
 * CANTERA ALEGRE v1.0 (área Resultados · amarillo). Solo capa visual; cálculos intactos.
 */
import { useState, useMemo, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useCalendario } from '@/contexts/CalendarioContext'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import TabsPastilla from '@/components/ui/TabsPastilla'
import { useRunning } from '@/hooks/useRunning'
import { useConfig } from '@/hooks/useConfig'
import { fmtEur, fmtPct } from '@/lib/format'
import { loadMarcasPorCanal, loadConfigCanales, type MarcasPorCanal, type CanalConfig } from '@/lib/panel/calcNetoPlataforma'
import { resolverNeto, loadVentasReales, loadRatiosCalibrados } from '@/lib/panel/netoResolver'
import { OSW, LEX, INK, CREMA, BLANCO, GRIS, VERDE, ROJO, AMA, NAR, AZUL, GRANATE, CORP } from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel, SHADOW_DURA } from '@/components/kit/cantera'
import * as M from '@/lib/marcoDoc'
import BotonImprimir from '@/components/BotonImprimir'

const GRUPOS_FIJOS=['Equipo','Alquiler','Controlables'] as const
const GRUPOS_VARIABLES=['Producto'] as const
const COLOR_GRUPO:Record<string,string>={'Producto':NAR,'Equipo':GRANATE,'Alquiler':AZUL,'Controlables':AZUL}
type Tab='resumen'|'simulador'
interface CanalDatos{bruto:number;neto:number;margenPct:number;pedidos:number}
type CanalId='uber'|'glovo'|'just_eat'|'web'|'directa'
const CANAL_DEF:Array<{id:CanalId;label:string;corp:string}>=[
{id:'uber',label:'UBER EATS',corp:'uber'},
{id:'glovo',label:'GLOVO',corp:'glovo'},
{id:'just_eat',label:'JUST EAT',corp:'je'},
{id:'web',label:'WEB',corp:'web'},
{id:'directa',label:'DIRECTA',corp:'dir'}]
const CONFIG_KEY:Record<CanalId,string>={uber:'Uber Eats',glovo:'Glovo',just_eat:'Just Eat',web:'Web Propia',directa:'Venta Directa'}
void CONFIG_KEY // referencia conservada del original (mapeo de config), no se usa en el render

// Fórmula migrada a calcNetoPorCanal central (Notion 366c8b1f-6139-81a8-95a7-dd0abdf63a91)

/* ── estilos de texto reutilizados dentro de bloques Papel/Plancha ── */
const ETQ:import('react').CSSProperties={fontFamily:OSW,fontSize:11,letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:600}
const CIFRA=(size=24):import('react').CSSProperties=>({fontFamily:OSW,fontWeight:700,fontSize:size,lineHeight:1.05,marginTop:6})
const SUB:import('react').CSSProperties={fontFamily:LEX,fontSize:12,marginTop:4}

/* ═══ PDF — MARCO ÚNICO (src/lib/marcoDoc.ts) — VERTICAL — documentoId finanzas.punto_equilibrio ═══ */
const AREA_PDF:M.Area='finanzas'

function construirPuntoEquilibrioPDF(p:TabResumenProps,rec:M.Recursos,bn=false){
const doc=M.nuevaHoja({orientation:'portrait'})
const ctx=M.preparar(doc,rec)
const pal=M.paleta(AREA_PDF,bn)
const cb=M.contentBox(doc)
const nuevaPagina=()=>{M.pintarEspina(doc,AREA_PDF,ctx,bn);return M.pintarCabecera(doc,ctx,{docNombre:'Punto de equilibrio',meta:p.periodoLabel,area:AREA_PDF,bn})}
let y=nuevaPagina()

const filaKV=(label:string,value:string,bold=false)=>{
if(y>cb.bottom-6){doc.addPage();y=nuevaPagina()}
doc.setDrawColor(...M.LINEA);doc.setLineWidth(0.1);doc.line(cb.x0,y+5.4,cb.x1,y+5.4)
M.fDato(doc,ctx,bold);doc.setFontSize(bold?10:9.5);doc.setTextColor(...(bold?pal.acento:M.TINTA))
doc.text(label,cb.x0+1.5,y+4)
doc.text(value,cb.x1-1.5,y+4,{align:'right'})
y+=6.5
}
const tituloSeccion=(t:string)=>{
if(y>cb.bottom-14){doc.addPage();y=nuevaPagina()}
M.fTitulo(doc,ctx,true);doc.setFontSize(11);doc.setTextColor(pal.acento[0],pal.acento[1],pal.acento[2])
doc.text(t.toUpperCase(),cb.x0,y+4);y+=8
}

tituloSeccion('Comparativa del periodo')
filaKV('Bruto',fmtEur(p.totalBruto,{decimals:2}))
filaKV('Neto',fmtEur(p.totalNeto,{decimals:2}))
filaKV('Punto de equilibrio',p.peMensual!=null?fmtEur(p.peMensual,{decimals:2}):'—',true)
filaKV('Beneficio',fmtEur(p.beneficio,{signed:true,decimals:2}),true)
y+=4

tituloSeccion('Detalle por canal')
for(const c of CANAL_DEF){
const d=p.datosPorCanal[c.id]
const pctMix=p.totalBruto>0?(d.bruto/p.totalBruto)*100:0
filaKV(`${c.label} · bruto ${fmtEur(d.bruto,{decimals:2})} · neto ${fmtEur(d.neto,{decimals:2})}`,`${fmtPct(pctMix,2)} mix`)
}
y+=4

const filasFijos=GRUPOS_FIJOS.map(g=>({label:g,valor:p.gastosPorGrupo[g]??0})).filter(f=>f.valor>0).sort((a,b)=>b.valor-a.valor)
const filasVariables=[...GRUPOS_VARIABLES.map(g=>({label:g,valor:p.gastosPorGrupo[g]??0})),{label:'Comisiones plataformas',valor:p.totalComisiones}].filter(f=>f.valor>0).sort((a,b)=>b.valor-a.valor)

tituloSeccion(`Costes fijos · sin IVA (${fmtEur(p.totalFijos,{decimals:2})})`)
if(filasFijos.length===0){M.fDato(doc,ctx,false);doc.setFontSize(9);doc.setTextColor(...M.GRIS);doc.text('Sin gastos en el periodo',cb.x0+1.5,y+3);y+=7}
else for(const f of filasFijos)filaKV(f.label,fmtEur(f.valor,{decimals:2}))
y+=4

tituloSeccion(`Costes variables · sin IVA (${fmtEur(p.totalVariables,{decimals:2})})`)
if(filasVariables.length===0){M.fDato(doc,ctx,false);doc.setFontSize(9);doc.setTextColor(...M.GRIS);doc.text('Sin gastos en el periodo',cb.x0+1.5,y+3);y+=7}
else for(const f of filasVariables)filaKV(f.label,fmtEur(f.valor,{decimals:2}))

const totalPag=doc.getNumberOfPages()
for(let pg=1;pg<=totalPag;pg++){doc.setPage(pg);M.pintarPaginado(doc,pg,totalPag,ctx)}
return doc
}

export function PuntoEquilibrio({ embedded = false }: { embedded?: boolean } = {}){
const[tab,setTab]=useState<Tab>('resumen')
const{canales}=useConfig()
void canales // hook conservado del original (sin uso en el render, no se toca lógica)
const[periodoDesde,setPeriodoDesde]=useState<Date>(()=>{const h=new Date();h.setDate(1);h.setHours(0,0,0,0);return h})
const[periodoHasta,setPeriodoHasta]=useState<Date>(()=>{const h=new Date();h.setHours(23,59,59,999);return h})
const[periodoLabel,setPeriodoLabel]=useState('Mes en curso')
const periodo=useMemo(()=>({desde:periodoDesde,hasta:periodoHasta,key:'pe',label:periodoLabel}),[periodoDesde,periodoHasta,periodoLabel])
const anio=periodo.desde.getFullYear()
const{loading,error,gastos,facturacion}=useRunning(periodo,anio,null,null,'sin')
const{diasOperativosEnRango}=useCalendario()
const[marcasPorCanal,setMarcasPorCanal]=useState<MarcasPorCanal>({uber:1,glovo:1,je:1,web:1,dir:1})
const[configCanales,setConfigCanales]=useState<Record<string,CanalConfig>>({})
useEffect(()=>{loadMarcasPorCanal().then(setMarcasPorCanal);loadConfigCanales().then(setConfigCanales);loadVentasReales().then(()=>loadRatiosCalibrados())},[])
const brutoPorCanal=useMemo(()=>{const m:Record<CanalId,number>={uber:0,glovo:0,just_eat:0,web:0,directa:0};const ped:Record<CanalId,number>={uber:0,glovo:0,just_eat:0,web:0,directa:0};for(const fr of facturacion as any[]){const f=fr as Record<string,number|null|undefined>;m.uber+=Number(f.uber_bruto||0);m.glovo+=Number(f.glovo_bruto||0);m.just_eat+=Number(f.je_bruto||0);m.web+=Number(f.web_bruto||0);m.directa+=Number(f.directa_bruto||0);ped.uber+=Number(f.uber_pedidos||0);ped.glovo+=Number(f.glovo_pedidos||0);ped.just_eat+=Number(f.je_pedidos||0);ped.web+=Number(f.web_pedidos||0);ped.directa+=Number(f.directa_pedidos||0)};return{bruto:m,pedidos:ped}},[facturacion])
const totalBruto=useMemo(()=>Object.values(brutoPorCanal.bruto).reduce((a,v)=>a+v,0),[brutoPorCanal])
const totalPedidos=useMemo(()=>facturacion.reduce((a,f)=>a+Number((f as any).total_pedidos||0),0),[facturacion])
const diasPeriodo=useMemo(()=>{const ms=periodo.hasta.getTime()-periodo.desde.getTime();return Math.max(1,Math.ceil(ms/(1000*60*60*24))+1)},[periodo.desde,periodo.hasta])
void diasPeriodo // conservado del original (sin uso directo en el render)
const meses=useMemo(()=>{const set=new Set<string>();const cur=new Date(periodo.desde);while(cur<=periodo.hasta){set.add(`${cur.getFullYear()}-${cur.getMonth()+1}`);cur.setDate(cur.getDate()+1)};return Array.from(set).map(s=>{const[y,m]=s.split('-').map(Number);return{anio:y,mes:m}})},[periodo])
const[resumenes,setResumenes]=useState<Array<{plataforma:string;mes:number;año:number;bruto:number|null;neto_real_cobrado:number|null}>>([])
useEffect(()=>{if(meses.length===0)return;let cancel=false;(async()=>{const conditions=meses.map(m=>`and(mes.eq.${m.mes},año.eq.${m.anio})`).join(',');const{data}=await supabase.from('resumenes_plataforma_marca_mensual').select('plataforma, mes, año, bruto, neto_real_cobrado').or(conditions);if(cancel)return;setResumenes((data??[]) as any)})();return()=>{cancel=true}},[meses.map(m=>`${m.anio}-${m.mes}`).join('|')])
// FÓRMULA UNIFICADA: si hay neto_real_cobrado en BBDD (OCR), úsalo; si no, calcNetoPorCanal central
const datosPorCanal=useMemo<Record<CanalId,CanalDatos>>(()=>{const out={} as Record<CanalId,CanalDatos>;const ids:CanalId[]=['uber','glovo','just_eat','web','directa'];const mapCanal:Record<CanalId,string>={uber:'uber',glovo:'glovo',just_eat:'je',web:'web',directa:'dir'};for(const c of ids){const filas=resumenes.filter(r=>r.plataforma===c);const brutoFD=brutoPorCanal.bruto[c];const pedFD=brutoPorCanal.pedidos[c];let neto=0;let brutoCalc=0;const tieneReal=filas.length>0&&filas.some(f=>f.neto_real_cobrado!=null);if(tieneReal){brutoCalc=filas.reduce((s,f)=>s+(f.bruto??0),0);neto=filas.reduce((s,f)=>s+(f.neto_real_cobrado??0),0)}else{neto=resolverNeto(mapCanal[c],brutoFD,pedFD,marcasPorCanal,periodo.desde,periodo.hasta,configCanales).neto};const brutoFinal=tieneReal?brutoCalc:brutoFD;const margenPct=brutoFinal>0?(neto/brutoFinal)*100:0;out[c]={bruto:brutoFinal,neto,margenPct,pedidos:pedFD}};return out},[resumenes,brutoPorCanal,marcasPorCanal,periodo.desde,periodo.hasta,configCanales])
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
const colorEstado=estado==='cubre'?VERDE:estado==='ajustado'?AMA:ROJO

const filtros=(
  <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
    <SelectorFechaUniversal nombreModulo="punto_equilibrio" defaultOpcion="mes_en_curso" onChange={(desde,hasta,label)=>{setPeriodoDesde(desde);setPeriodoHasta(hasta);setPeriodoLabel(label)}}/>
  </div>
)

return(
  <PantallaCantera embedded={embedded}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
      <TabsPastilla tabs={[{id:'resumen',label:'Resumen'},{id:'simulador',label:'Simulador'}]} activeId={tab} onChange={(id)=>setTab(id as Tab)}/>
      <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        {filtros}
        {!loading&&!error&&(
          <BotonImprimir compacto documentoId="finanzas.punto_equilibrio" titulo={`Punto de equilibrio · ${periodoLabel}`} generarPdf={async opts=>{
            const rec=await M.cargarRecursos()
            return construirPuntoEquilibrioPDF({totalBruto,totalNeto,totalPedidos,totalFijos,totalComisiones,totalVariables,margenContribPct,margenNetoPct,peMensual,diaCubreInfo,datosPorCanal,gastosPorGrupo,diasOperativos,brutoMedioDiario,colorEstado,beneficio,ebitdaPct,ticketMedioBruto,ticketMedioNeto,periodoLabel,estado},rec,opts.bn)
          }}/>
        )}
      </div>
    </div>
    {error&&<Papel ceja={ROJO}><div style={{color:ROJO,fontFamily:LEX,fontSize:13}}>Error: {error}</div></Papel>}
    {loading&&!error&&<div style={{padding:40,color:GRIS,fontFamily:OSW,textTransform:'uppercase',letterSpacing:'1px'}}>Cargando datos reales…</div>}
    {!loading&&!error&&tab==='resumen'&&<TabResumen totalBruto={totalBruto} totalNeto={totalNeto} totalPedidos={totalPedidos} totalFijos={totalFijos} totalComisiones={totalComisiones} totalVariables={totalVariables} margenContribPct={margenContribPct} margenNetoPct={margenNetoPct} peMensual={peMensual} diaCubreInfo={diaCubreInfo} datosPorCanal={datosPorCanal} gastosPorGrupo={gastosPorGrupo} diasOperativos={diasOperativos} brutoMedioDiario={brutoMedioDiario} colorEstado={colorEstado} beneficio={beneficio} ebitdaPct={ebitdaPct} ticketMedioBruto={ticketMedioBruto} ticketMedioNeto={ticketMedioNeto} periodoLabel={periodoLabel} estado={estado}/>}
    {!loading&&!error&&tab==='simulador'&&<TabSimulador totalBruto={totalBruto} totalFijos={totalFijos} margenContribPct={margenContribPct} peMensual={peMensual} totalPedidos={totalPedidos} brutoMedioDiario={brutoMedioDiario}/>}
  </PantallaCantera>
)
}

interface TabResumenProps{totalBruto:number;totalNeto:number;totalPedidos:number;totalFijos:number;totalComisiones:number;totalVariables:number;margenContribPct:number;margenNetoPct:number;peMensual:number|null;diaCubreInfo:{fecha:Date|null;diasNecesarios:number|null;mesesDelta:number};datosPorCanal:Record<CanalId,CanalDatos>;gastosPorGrupo:Record<string,number>;diasOperativos:number;brutoMedioDiario:number;colorEstado:string;beneficio:number;ebitdaPct:number;ticketMedioBruto:number;ticketMedioNeto:number;periodoLabel:string;estado:'cubre'|'ajustado'|'pierde'}

function TabResumen(p:TabResumenProps){
const filasFijos=GRUPOS_FIJOS.map(g=>({label:g,valor:p.gastosPorGrupo[g]??0,color:COLOR_GRUPO[g]})).filter(f=>f.valor>0).sort((a,b)=>b.valor-a.valor)
const filasVariables=[...GRUPOS_VARIABLES.map(g=>({label:g,valor:p.gastosPorGrupo[g]??0,color:COLOR_GRUPO[g]})),{label:'Comisiones plataformas',valor:p.totalComisiones,color:NAR}].filter(f=>f.valor>0).sort((a,b)=>b.valor-a.valor)

const titular = p.estado==='cubre'
  ? 'Este periodo superas el punto de equilibrio.'
  : p.estado==='ajustado'
  ? 'Vas justo para cubrir el punto de equilibrio.'
  : 'Este periodo no llegas a cubrir el punto de equilibrio.'

const pctVsObjetivo = p.peMensual!=null && p.peMensual>0 ? ((p.totalBruto/p.peMensual)-1)*100 : null

const atencion=[
  `Bruto ${fmtEur(p.totalBruto,{decimals:2})}`,
  `Beneficio ${fmtEur(p.beneficio,{signed:true,decimals:2})}`,
  p.diaCubreInfo.diasNecesarios!=null?`${p.diaCubreInfo.diasNecesarios} días para cubrir`:null,
  `Margen contrib. ${fmtPct(p.margenContribPct,2)}`,
].filter(Boolean) as string[]

return(
  <div style={{display:'flex',flexDirection:'column',gap:16}}>
    {/* 1 · Héroe del área Resultados (amarillo) */}
    <HeroCantera
      area="eeff"
      periodo={p.periodoLabel}
      titular={titular}
      etiquetaDato="Punto de equilibrio · bruto necesario para no perder"
      cifra={p.peMensual!=null?fmtEur(p.peMensual,{decimals:2}):'—'}
      variacionPct={pctVsObjetivo}
      resumen={<>Facturas <b>{fmtEur(p.totalBruto,{decimals:2})}</b> sobre un objetivo de <b>{p.peMensual!=null?fmtEur(p.peMensual,{decimals:2}):'—'}</b>.</>}
      atencion={atencion}
    />

    {/* 2 · Plancha comparativa del periodo */}
    <div>
      <SeccionLabel bg={AMA} color={INK}>Comparativa del periodo</SeccionLabel>
      <Plancha>
        <PlanchaCelda bg={BLANCO} first>
          <div style={ETQ}>Bruto</div>
          <div style={CIFRA(24)}>{fmtEur(p.totalBruto,{decimals:2})}</div>
          <div style={SUB}>{fmtEur(p.totalPedidos,{showEuro:false,decimals:0})} pedidos · TM {fmtEur(p.ticketMedioBruto,{decimals:2})}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={VERDE}>
          <div style={ETQ}>Neto</div>
          <div style={CIFRA(24)}>{fmtEur(p.totalNeto,{decimals:2})}</div>
          <div style={SUB}>{fmtPct(p.margenNetoPct,2)} margen · TM {fmtEur(p.ticketMedioNeto,{decimals:2})}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={AMA} color={INK}>
          <div style={ETQ}>Punto equilibrio</div>
          <div style={CIFRA(24)}>{p.peMensual!=null?fmtEur(p.peMensual,{decimals:2}):'—'}</div>
          <div style={SUB}>margen contrib. {fmtPct(p.margenContribPct,2)}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={p.beneficio>=0?VERDE:ROJO}>
          <div style={ETQ}>Beneficio</div>
          <div style={CIFRA(24)}>{fmtEur(p.beneficio,{signed:true,decimals:2})}</div>
          <div style={SUB}>{fmtPct(p.ebitdaPct,2)} s/bruto</div>
        </PlanchaCelda>
      </Plancha>
    </div>

    {/* 3 · Frase potente */}
    {p.estado==='pierde' ? (
      <FrasePotente significado="coste">Te faltan {p.peMensual!=null?fmtEur(Math.max(0,p.peMensual-p.totalBruto),{decimals:2}):'—'} de bruto para cubrir costes: sube el bruto diario o recorta fijos.</FrasePotente>
    ) : (
      <FrasePotente significado="oportunidad">Cada euro por encima del punto de equilibrio es margen puro: empújalo con más pedidos o subiendo ticket.</FrasePotente>
    )}

    {/* Progreso hacia el punto de equilibrio */}
    <BloqueProgreso peMensual={p.peMensual} totalBruto={p.totalBruto} diaCubreInfo={p.diaCubreInfo} colorEstado={p.colorEstado} brutoMedioDiario={p.brutoMedioDiario} diasOperativos={p.diasOperativos} ticketMedioBruto={p.ticketMedioBruto}/>

    {/* Detalle por canal */}
    <div>
      <SeccionLabel bg={NAR}>Detalle por canal</SeccionLabel>
      <Papel ceja={NAR} pad="0" style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,fontFamily:LEX}}>
          <thead>
            <tr style={{background:INK}}>
              {['Canal','Bruto','Neto','Margen','Mix'].map((h,i)=>(
                <th key={h} style={{padding:'10px 12px',textAlign:i===0?'left':'right',fontFamily:OSW,fontSize:11,letterSpacing:'1.5px',textTransform:'uppercase',color:CREMA,fontWeight:600,whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CANAL_DEF.map(c=>{
              const d=p.datosPorCanal[c.id]
              const pctMix=p.totalBruto>0?(d.bruto/p.totalBruto)*100:0
              const color=CORP[c.corp]??INK
              return(
                <tr key={c.id} style={{borderBottom:`2px solid ${INK}`}}>
                  <td style={{padding:'10px 12px',fontFamily:OSW,fontWeight:600,textTransform:'uppercase',color,whiteSpace:'nowrap'}}>{c.label}</td>
                  <td style={{padding:'10px 12px',fontFamily:OSW,fontWeight:600,textAlign:'right',whiteSpace:'nowrap'}}>{fmtEur(d.bruto,{decimals:2})}</td>
                  <td style={{padding:'10px 12px',fontFamily:OSW,fontWeight:600,textAlign:'right',whiteSpace:'nowrap',color:VERDE}}>{fmtEur(d.neto,{decimals:2})}</td>
                  <td style={{padding:'10px 12px',fontFamily:OSW,fontWeight:700,textAlign:'right',whiteSpace:'nowrap'}}>{d.bruto>0?fmtPct(d.margenPct,2):'—'}</td>
                  <td style={{padding:'10px 12px',fontFamily:LEX,textAlign:'right',whiteSpace:'nowrap',color:GRIS}}>{fmtPct(pctMix,2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Papel>
    </div>

    {/* Costes fijos / variables */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))',gap:16}}>
      <BloqueCostes titulo="Costes fijos · sin IVA" ceja={GRANATE} total={p.totalFijos} filas={filasFijos} totalBruto={p.totalBruto}/>
      <BloqueCostes titulo="Costes variables · sin IVA" ceja={NAR} total={p.totalVariables} filas={filasVariables} totalBruto={p.totalBruto}/>
    </div>
  </div>
)
}

function BloqueProgreso({peMensual,totalBruto,diaCubreInfo,colorEstado,brutoMedioDiario,diasOperativos,ticketMedioBruto}:{peMensual:number|null;totalBruto:number;diaCubreInfo:{fecha:Date|null;diasNecesarios:number|null;mesesDelta:number};colorEstado:string;brutoMedioDiario:number;diasOperativos:number;ticketMedioBruto:number}){
const pctCubierto=peMensual?Math.min(100,(totalBruto/peMensual)*100):0
const pedidosNecesarios=peMensual&&ticketMedioBruto>0?Math.ceil(peMensual/ticketMedioBruto):null
const brutoDiaObjetivo=peMensual!=null?peMensual/diasOperativos:null
const diasNecesarios=diaCubreInfo.diasNecesarios
return(
  <div>
    <SeccionLabel bg={AMA} color={INK}>Progreso hacia el punto de equilibrio</SeccionLabel>
    <Papel ceja={AMA}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))',gap:14}}>
        <div><div style={CIFRA(18)}>{diasNecesarios!=null?fmtEur(diasNecesarios,{showEuro:false,decimals:0}):'—'}</div><div style={ETQ}>Días para cubrir</div></div>
        <div><div style={CIFRA(18)}>{pedidosNecesarios!=null?fmtEur(pedidosNecesarios,{showEuro:false,decimals:0}):'—'}</div><div style={ETQ}>Pedidos necesarios</div></div>
        <div><div style={CIFRA(18)}>{fmtEur(brutoMedioDiario,{decimals:2})}</div><div style={ETQ}>€/día real</div></div>
        <div><div style={{...CIFRA(18),color:brutoDiaObjetivo!=null&&brutoMedioDiario>=brutoDiaObjetivo?VERDE:ROJO}}>{brutoDiaObjetivo!=null?fmtEur(brutoDiaObjetivo,{decimals:2}):'—'}</div><div style={ETQ}>€/día objetivo</div></div>
      </div>
      {peMensual!=null&&<>
        <div style={{height:10,border:`2px solid ${INK}`,marginTop:16,overflow:'hidden',background:CREMA}}>
          <div style={{width:`${pctCubierto}%`,height:'100%',background:colorEstado,transition:'width 0.5s ease'}}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',fontFamily:LEX,fontSize:12,color:GRIS,marginTop:6}}>
          <span>Cubierto</span>
          <strong style={{color:colorEstado,fontFamily:OSW,fontSize:13}}>{fmtPct(pctCubierto,2)}</strong>
        </div>
      </>}
    </Papel>
  </div>
)
}

function BloqueCostes({titulo,ceja,total,filas,totalBruto}:{titulo:string;ceja:string;total:number;filas:Array<{label:string;valor:number;color:string}>;totalBruto:number}){
const pctSobreBruto=totalBruto>0?(total/totalBruto)*100:0
return(
  <div>
    <SeccionLabel bg={ceja}>{titulo}</SeccionLabel>
    <Papel ceja={ceja}>
      <div style={{display:'flex',alignItems:'baseline',gap:16,marginBottom:14}}>
        <div style={CIFRA(28)}>{fmtEur(total,{decimals:2})}</div>
        <div style={{fontFamily:LEX,fontSize:12,color:GRIS}}>{fmtPct(pctSobreBruto,2)} s/bruto</div>
      </div>
      {filas.length===0&&<div style={{fontFamily:LEX,fontSize:12,color:GRIS,fontStyle:'italic'}}>Sin gastos en el periodo</div>}
      {filas.map((f,i)=>{
        const pct=totalBruto>0?(f.valor/totalBruto)*100:0
        return(
          <div key={i} style={{display:'grid',gridTemplateColumns:'1fr auto auto',alignItems:'center',gap:12,padding:'9px 0',borderBottom:i<filas.length-1?`2px solid ${CREMA}`:'none'}}>
            <span style={{display:'flex',alignItems:'center',gap:8,fontFamily:LEX,fontSize:13,color:INK}}>
              <span style={{width:9,height:9,background:f.color,border:`1px solid ${INK}`,flexShrink:0}}/>{f.label}
            </span>
            <span style={{fontFamily:OSW,fontSize:15,fontWeight:600,color:INK,minWidth:100,textAlign:'right'}}>{fmtEur(f.valor,{decimals:2})}</span>
            <span style={{fontFamily:OSW,fontSize:12,color:GRIS,minWidth:56,textAlign:'right'}}>{fmtPct(pct,2)}</span>
          </div>
        )
      })}
    </Papel>
  </div>
)
}

/* ── Simulador ── */
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
return(
  <div>
    <SeccionLabel bg={AMA} color={INK}>Escenarios simulados</SeccionLabel>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))',gap:14}}>
      {escenarios.map(e=>{const calc=calcularEscenario(e);const calcBase=calcularEscenario(baseEscenario);return<CardEscenario key={e.id} escenario={e} calc={calc} calcBase={calcBase} onChangePreset={(pp)=>cambiarPreset(e.id,pp)} onChange={(c,v)=>actualizarEscenario(e.id,c,v)} onDelete={()=>eliminarEscenario(e.id)}/>})}
      {escenarios.length<6&&(
        <button onClick={añadirEscenario} style={{background:BLANCO,border:`3px dashed ${INK}`,borderRadius:0,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6,minHeight:260,fontFamily:OSW,color:GRIS,fontSize:13,letterSpacing:'1px',textTransform:'uppercase',boxShadow:SHADOW_DURA}}>
          <span style={{fontSize:30,fontWeight:300,lineHeight:1}}>+</span>Añadir escenario
        </button>
      )}
    </div>
  </div>
)
}
const PILL_BG:Record<string,string>={base:GRIS,mejora:VERDE,empeora:ROJO,mixto:AMA}
const PILL_LABEL:Record<string,string>={base:'Base',mejora:'Mejora',empeora:'Empeora',mixto:'Custom'}
function CardEscenario({escenario,calc,calcBase,onChangePreset,onChange,onDelete}:{escenario:Escenario;calc:{peValor:number|null;diasNec:number|null;pedNec:number|null;brutoEsperado:number;beneficio:number};calcBase:{peValor:number|null;diasNec:number|null;pedNec:number|null;brutoEsperado:number;beneficio:number};onChangePreset:(p:PresetKey)=>void;onChange:(campo:keyof Escenario,valor:number)=>void;onDelete:()=>void}){
const e=escenario
const tipo=PRESETS.find(pr=>pr.key===e.preset)?.tipo??'mixto'
const deltaBeneficio=calc.beneficio-calcBase.beneficio
return(
  <Papel ceja={PILL_BG[tipo]}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:14}}>
      <div style={{flex:1}}>
        {e.bloqueado?(
          <div style={{fontFamily:OSW,fontSize:13,fontWeight:600,letterSpacing:'1px',textTransform:'uppercase',color:INK}}>Datos reales del periodo</div>
        ):(
          <select value={e.preset} onChange={(ev)=>onChangePreset(ev.target.value as PresetKey)} style={{fontFamily:OSW,fontSize:12,fontWeight:600,letterSpacing:'0.5px',color:INK,background:BLANCO,border:`2px solid ${INK}`,borderRadius:0,padding:'6px 8px',cursor:'pointer',width:'100%'}}>
            {PRESETS.filter(pr=>pr.key!=='base').map(pr=><option key={pr.key} value={pr.key}>{pr.label}</option>)}
          </select>
        )}
      </div>
      <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
        <span style={{fontFamily:OSW,fontSize:10,fontWeight:600,letterSpacing:'1px',padding:'3px 8px',textTransform:'uppercase',background:PILL_BG[tipo],color:BLANCO,border:`2px solid ${INK}`}}>{PILL_LABEL[tipo]}</span>
        {!e.bloqueado&&<button onClick={onDelete} style={{background:'transparent',border:'none',cursor:'pointer',color:GRIS,fontSize:18,lineHeight:1,padding:'0 4px'}} title="Eliminar">×</button>}
      </div>
    </div>
    <RowInput label="Ticket medio" value={e.ticketMedio} decimales={2} onChange={v=>onChange('ticketMedio',v)} bloqueado={e.bloqueado}/>
    <RowInput label="Margen contribución (%)" value={e.margenPct} decimales={2} onChange={v=>onChange('margenPct',v)} bloqueado={e.bloqueado}/>
    <RowInput label="Costes fijos" value={e.fijos} decimales={2} onChange={v=>onChange('fijos',v)} bloqueado={e.bloqueado}/>
    <RowInput label="Pedidos mes" value={e.pedidosMes} decimales={0} onChange={v=>onChange('pedidosMes',v)} bloqueado={e.bloqueado}/>
    <div style={{background:CREMA,border:`2px solid ${INK}`,padding:14,marginTop:14}}>
      <RowResultado label="Bruto esperado" valor={fmtEur(calc.brutoEsperado,{decimals:2})} color={INK}/>
      <RowResultado label="Punto equilibrio" valor={calc.peValor!=null?fmtEur(calc.peValor,{decimals:2}):'—'} color={INK}/>
      <RowResultado label="Pedidos para PE" valor={calc.pedNec!=null?fmtEur(calc.pedNec,{showEuro:false,decimals:0}):'—'} color={INK}/>
      <RowResultado label="Días para PE" valor={calc.diasNec!=null?`${fmtEur(calc.diasNec,{showEuro:false,decimals:0})} días`:'—'} color={INK}/>
      <RowResultado label="Beneficio esperado" valor={fmtEur(calc.beneficio,{signed:true,decimals:2})} color={calc.beneficio>=0?VERDE:ROJO} big/>
      {!e.bloqueado&&(
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginTop:10,paddingTop:8,borderTop:`2px solid ${BLANCO}`}}>
          <span style={{fontFamily:OSW,fontSize:10,letterSpacing:'1px',textTransform:'uppercase',color:GRIS}}>Vs base · beneficio</span>
          <span style={{fontFamily:OSW,fontSize:14,fontWeight:700,color:deltaBeneficio>0?VERDE:deltaBeneficio<0?ROJO:GRIS}}>{fmtEur(deltaBeneficio,{signed:true,decimals:2})}</span>
        </div>
      )}
    </div>
  </Papel>
)
}
function RowResultado({label,valor,color,big}:{label:string;valor:string;color:string;big?:boolean}){
return(
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:5}}>
    <span style={{fontFamily:OSW,fontSize:10,fontWeight:500,letterSpacing:'1px',textTransform:'uppercase',color:GRIS}}>{label}</span>
    <span style={{fontFamily:OSW,fontSize:big?20:15,fontWeight:700,color}}>{valor}</span>
  </div>
)
}
function RowInput({label,value,decimales,onChange,bloqueado}:{label:string;value:number;decimales:number;onChange:(v:number)=>void;bloqueado?:boolean}){
if(bloqueado){
  return(
    <div style={{display:'grid',gridTemplateColumns:'1fr 110px',gap:10,alignItems:'center',padding:'5px 0'}}>
      <span style={{fontFamily:LEX,fontSize:12,color:INK}}>{label}</span>
      <div style={{padding:'6px 10px',border:`2px solid ${INK}`,fontSize:13,fontFamily:OSW,fontWeight:600,background:CREMA,color:GRIS,textAlign:'right'}}>{Number.isFinite(value)?value.toFixed(decimales):'—'}</div>
    </div>
  )
}
return(
  <div style={{display:'grid',gridTemplateColumns:'1fr 110px',gap:10,alignItems:'center',padding:'5px 0'}}>
    <span style={{fontFamily:LEX,fontSize:12,color:INK}}>{label}</span>
    <input type="number" step={decimales>0?0.01:1} value={Number.isFinite(value)?value.toFixed(decimales):''} onChange={(ev)=>{const n=parseFloat(ev.target.value);if(!isNaN(n))onChange(n)}} style={{width:'100%',padding:'6px 10px',border:`2px solid ${INK}`,borderRadius:0,fontSize:13,fontFamily:OSW,fontWeight:600,background:BLANCO,color:INK,textAlign:'right',outline:'none'}}/>
  </div>
)
}

export default PuntoEquilibrio
