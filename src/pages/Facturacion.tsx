import { Fragment, useEffect, useState, useMemo, type FormEvent, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { fmtFechaCorta } from '@/styles/tokens'
import { useCalendario, type TipoDia } from '@/contexts/CalendarioContext'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import TabsPastilla from '@/components/ui/TabsPastilla'
import {
  COLORS, FONT, CARDS, LAYOUT, TABS_PILL,
  kpiBig, lblSm, lblXs,
} from '@/components/panel/resumen/tokens'

// ─── Formato ──────────────────────────────────────────────────
const fmt2 = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits:2, maximumFractionDigits:2, useGrouping:true })
const fmtInt = (n: number) => Math.round(n).toLocaleString('es-ES', { useGrouping:true })
const fmtBru = fmt2
const fmtTM  = fmt2
const fmtKpi = fmt2
const fmtEurN = (n: number) => fmtEur(n)

interface AggRow {
  uber_pedidos: number; uber_bruto: number
  glovo_pedidos: number; glovo_bruto: number
  je_pedidos: number; je_bruto: number
  web_pedidos: number; web_bruto: number
  directa_pedidos: number; directa_bruto: number
  total_pedidos: number; total_bruto: number
}
interface RawDiario extends AggRow { id: number; fecha: string; servicio: string }
interface SemanaGroup extends AggRow { year: number; week: number; periodo: string; dias: number }
interface MesGroup extends AggRow { anio: number; mes: number; dias: number; media_diaria: number; vs_anterior: number | null }

type Tab = 'diario' | 'semanas' | 'meses' | 'anual'
type SortDir = 'asc' | 'desc'
type SortCol = 'fecha' | 'serv' | 'uber' | 'glovo' | 'je' | 'web' | 'dir' | 'total'
type CanalId = 'uber' | 'glovo' | 'je' | 'web' | 'dir'

const ALL_COLS: { id: CanalId; label: string; ped: keyof AggRow; bru: keyof AggRow; color: string; bg: string }[] = [
  { id: 'uber',  label: 'Uber Eats', ped: 'uber_pedidos',    bru: 'uber_bruto',    color: COLORS.uber,      bg: `${COLORS.uber}12` },
  { id: 'glovo', label: 'Glovo',     ped: 'glovo_pedidos',   bru: 'glovo_bruto',   color: COLORS.glovoDark, bg: `${COLORS.glovo}30` },
  { id: 'je',    label: 'Just Eat',  ped: 'je_pedidos',      bru: 'je_bruto',      color: COLORS.je,        bg: `${COLORS.je}18` },
  { id: 'web',   label: 'Web',       ped: 'web_pedidos',     bru: 'web_bruto',     color: COLORS.web,       bg: `${COLORS.web}12` },
  { id: 'dir',   label: 'Directa',   ped: 'directa_pedidos', bru: 'directa_bruto', color: COLORS.directa,   bg: `${COLORS.directa}12` },
]

const TABS_CFG: { key: Tab; label: string }[] = [
  { key: 'diario',  label: 'Diario'  },
  { key: 'semanas', label: 'Semanas' },
  { key: 'meses',   label: 'Meses'   },
  { key: 'anual',   label: 'Año'     },
]

const MES_NOMBRE: Record<number, string> = {
  1:'Enero',2:'Febrero',3:'Marzo',4:'Abril',5:'Mayo',6:'Junio',
  7:'Julio',8:'Agosto',9:'Septiembre',10:'Octubre',11:'Noviembre',12:'Diciembre',
}

const SELECT_DIARIO = 'id,fecha,servicio,uber_pedidos,uber_bruto,glovo_pedidos,glovo_bruto,je_pedidos,je_bruto,web_pedidos,web_bruto,directa_pedidos,directa_bruto,total_pedidos,total_bruto'
const NETO_FACTOR = 0.66
const COLOR_TODOS = COLORS.lun

// ─── Subtabs — fondo COLORS.accent (#FF4757, mismo que tab Diario activa) ──
// Botones: inactivo blanco/gris, activo blanco con texto negro COLORS.pri
const SUBTAB_CONTAINER: CSSProperties = {
  ...TABS_PILL.container,
  background: COLORS.accent,   // #FF4757 — el mismo rojo de "Diario" activo
  border: `0.5px solid ${COLORS.accent}`,
  marginBottom: 0, marginTop: 0,
}
const SUBTAB_ACTIVE: CSSProperties = {
  padding: '4px 10px', borderRadius: 5, border: 'none',
  background: '#ffffff', color: COLORS.pri,           // blanco con texto negro
  fontFamily: FONT.heading, fontSize: 10, fontWeight: 600,
  letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer',
}
const SUBTAB_INACTIVE: CSSProperties = {
  padding: '4px 10px', borderRadius: 5, border: 'none',
  background: 'rgba(255,255,255,0.2)', color: '#ffffff', // blanco semitransparente
  fontFamily: FONT.heading, fontSize: 10, fontWeight: 500,
  letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer',
}

function aggregate(rows: RawDiario[]): AggRow {
  const a: AggRow = { uber_pedidos:0,uber_bruto:0,glovo_pedidos:0,glovo_bruto:0,je_pedidos:0,je_bruto:0,web_pedidos:0,web_bruto:0,directa_pedidos:0,directa_bruto:0,total_pedidos:0,total_bruto:0 }
  for (const r of rows) {
    for (const c of ALL_COLS) { ;(a[c.ped] as number)+=(r[c.ped] as number)||0; ;(a[c.bru] as number)+=(r[c.bru] as number)||0 }
    a.total_pedidos+=r.total_pedidos||0; a.total_bruto+=r.total_bruto||0
  }
  return a
}

function isoWeek(dateStr: string): { year: number; week: number } {
  const d=new Date(dateStr+'T12:00:00'); const day=d.getDay()||7; d.setDate(d.getDate()+4-day)
  const y=d.getFullYear(); const jan1=new Date(y,0,1)
  return { year:y, week:Math.ceil(((d.getTime()-jan1.getTime())/86400000+1)/7) }
}

function weekBounds(year: number, week: number): [string,string] {
  const jan4=new Date(Date.UTC(year,0,4)); const dow=jan4.getUTCDay()||7
  const w1Mon=new Date(jan4); w1Mon.setUTCDate(jan4.getUTCDate()-dow+1)
  const mon=new Date(w1Mon); mon.setUTCDate(w1Mon.getUTCDate()+(week-1)*7)
  const sun=new Date(mon); sun.setUTCDate(mon.getUTCDate()+6)
  const fmt=(d:Date)=>d.toISOString().slice(0,10); return [fmt(mon),fmt(sun)]
}

function buildSemanas(rows: RawDiario[]): SemanaGroup[] {
  const map=new Map<string,{rows:RawDiario[];year:number;week:number}>()
  for (const r of rows) {
    const {year,week}=isoWeek(r.fecha); const key=`${year}-${week}`
    let e=map.get(key); if(!e){e={rows:[],year,week};map.set(key,e)}; e.rows.push(r)
  }
  const result: SemanaGroup[]=[]
  for (const {rows:wRows,year,week} of map.values()) {
    const agg=aggregate(wRows); const [from,to]=weekBounds(year,week)
    result.push({year,week,periodo:`${from} → ${to}`,dias:new Set(wRows.map(r=>r.fecha)).size,...agg})
  }
  return result.sort((a,b)=>a.year===b.year?b.week-a.week:b.year-a.year)
}

function buildMeses(rows: RawDiario[]): MesGroup[] {
  const map=new Map<string,RawDiario[]>()
  for (const r of rows) { const k=r.fecha.slice(0,7); let arr=map.get(k); if(!arr){arr=[];map.set(k,arr)}; arr.push(r) }
  const sorted=[...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]))
  const result: MesGroup[]=[]; let prev: number|null=null
  for (const [key,mRows] of sorted) {
    const [yStr,mStr]=key.split('-'); const agg=aggregate(mRows)
    const dias=new Set(mRows.map(r=>r.fecha)).size
    const vs_anterior=prev!==null&&prev>0?((agg.total_bruto-prev)/prev)*100:null
    result.push({anio:Number(yStr),mes:Number(mStr),dias,...agg,media_diaria:dias>0?agg.total_bruto/dias:0,vs_anterior})
    prev=agg.total_bruto
  }
  return result.reverse()
}

function downloadCSV(filename: string, headers: string[], rows: (string|number)[][]) {
  const esc=(v:string|number)=>{const s=String(v);return s.includes(';')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`:`${s}`}
  const blob=new Blob(['\uFEFF',[headers.map(esc).join(';'),...rows.map(r=>r.map(esc).join(';'))].join('\r\n')],{type:'text/csv;charset=utf-8'})
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url)
}

export default function Facturacion() {
  const { tipoDia } = useCalendario()
  const [tab, setTab] = useState<Tab>('diario')
  const [canalesVisibles, setCanalesVisibles] = useState<CanalId[]>(['uber','glovo','je','web','dir'])
  const [dropCanalOpen, setDropCanalOpen] = useState(false)
  const [servicioFiltro, setServicioFiltro] = useState('Todos')
  const [allData, setAllData] = useState<RawDiario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [weekFilter, setWeekFilter] = useState<{year:number;week:number}|null>(null)
  const [editRow, setEditRow] = useState<RawDiario|null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [periodoDesde, setPeriodoDesde] = useState<Date>(()=>{ const h=new Date();h.setDate(1);h.setHours(0,0,0,0);return h })
  const [periodoHasta, setPeriodoHasta] = useState<Date>(()=>{ const h=new Date();h.setHours(23,59,59,999);return h })

  useEffect(()=>{
    const handler=(e:MouseEvent)=>{ if(!(e.target as HTMLElement).closest('[data-drop-canal]')) setDropCanalOpen(false) }
    document.addEventListener('click',handler); return ()=>document.removeEventListener('click',handler)
  },[])

  const refresh = () => setRefreshKey(k=>k+1)

  useEffect(()=>{
    let cancelled=false; setLoading(true); setError(null)
    ;(async()=>{
      try {
        const {data,error:e}=await supabase.from('facturacion_diario').select(SELECT_DIARIO).order('fecha',{ascending:false})
        if(e) throw e; if(!cancelled) setAllData((data as RawDiario[])??[])
      } catch(e:unknown){ if(!cancelled) setError(e instanceof Error?e.message:'Error al cargar') }
      finally{ if(!cancelled) setLoading(false) }
    })()
    return ()=>{ cancelled=true }
  },[refreshKey])

  const cols = useMemo(()=>ALL_COLS.filter(c=>canalesVisibles.includes(c.id)),[canalesVisibles])

  const filteredData = useMemo(()=>{
    const desde=periodoDesde.toISOString().slice(0,10); const hasta=periodoHasta.toISOString().slice(0,10)
    return allData.filter(r=>r.fecha>=desde&&r.fecha<=hasta).filter(r=>servicioFiltro==='Todos'||r.servicio===servicioFiltro)
  },[allData,periodoDesde,periodoHasta,servicioFiltro])

  const totals = useMemo(()=>aggregate(filteredData),[filteredData])
  const dias = useMemo(()=>new Set(filteredData.map(r=>r.fecha)).size,[filteredData])
  const netoEstimado = totals.total_bruto*NETO_FACTOR
  const tm = totals.total_pedidos>0?totals.total_bruto/totals.total_pedidos:0
  const tmNeto = totals.total_pedidos>0?netoEstimado/totals.total_pedidos:0
  const mediadiaria = dias>0?totals.total_bruto/dias:0
  const mediaDiariaNeta = dias>0?netoEstimado/dias:0

  const toggleCanal=(id: CanalId)=>{
    setCanalesVisibles(prev=>{
      if(prev.includes(id)){ const next=prev.filter(x=>x!==id); return next.length===0?prev:next }
      return [...prev,id]
    })
  }

  return (
    <div style={{ background:COLORS.bg, minHeight:'100vh', padding:'24px 28px', fontFamily:FONT.body, color:COLORS.pri }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:18, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontFamily:FONT.heading, fontSize:22, fontWeight:600, color:COLORS.redSL, letterSpacing:3, textTransform:'uppercase' }}>FACTURACIÓN</div>
          <div style={{ fontFamily:FONT.body, fontSize:13, color:COLORS.mut, marginTop:2 }}>
            {fmtFechaCorta(periodoDesde.toISOString().slice(0,10))} — {fmtFechaCorta(periodoHasta.toISOString().slice(0,10))}
          </div>
        </div>
        <SelectorFechaUniversal nombreModulo="facturacion" defaultOpcion="mes_en_curso" onChange={(desde,hasta)=>{ setPeriodoDesde(desde); setPeriodoHasta(hasta) }} />
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:18, flexWrap:'wrap' }}>
        <TabsPastilla tabs={TABS_CFG.map(t=>({id:t.key,label:t.label}))} activeId={tab} onChange={id=>{ setTab(id as Tab); if(id!=='diario') setWeekFilter(null) }} />
        <div style={{ width:1, height:24, background:COLORS.brd, flexShrink:0, marginLeft:2, marginRight:2 }} />
        <div style={SUBTAB_CONTAINER}>
          {['Todos','ALM','CENAS'].map(s=>(
            <button key={s} onClick={()=>setServicioFiltro(s)} style={servicioFiltro===s ? SUBTAB_ACTIVE : SUBTAB_INACTIVE}>{s}</button>
          ))}
          <div style={{ position:'relative' }} data-drop-canal="canales">
            <button onClick={e=>{e.stopPropagation();setDropCanalOpen(p=>!p)}}
              style={{ ...SUBTAB_INACTIVE, display:'inline-flex', alignItems:'center', gap:3 }}>
              {canalesVisibles.length===5?'Canales':`${canalesVisibles.length} canales`} <span style={{ fontSize:9 }}>▾</span>
            </button>
            {dropCanalOpen && (
              <div style={{ position:'absolute', top:'110%', left:0, background:COLORS.card, border:`0.5px solid ${COLORS.brd}`, borderRadius:10, padding:'6px 0', zIndex:20, minWidth:160, boxShadow:'0 4px 16px rgba(0,0,0,0.08)' }}>
                {ALL_COLS.map(c=>(
                  <label key={c.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 14px', cursor:'pointer', fontFamily:FONT.body, fontSize:13, color:COLORS.sec }}>
                    <input type="checkbox" checked={canalesVisibles.includes(c.id)} onChange={()=>toggleCanal(c.id)} style={{ width:13, height:13, accentColor:c.color }} />
                    <span style={{ width:8, height:8, borderRadius:'50%', background:c.color, flexShrink:0 }} />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ ...CARDS.std, padding:48, textAlign:'center', fontFamily:FONT.body, fontSize:13, color:COLORS.mut }}>Cargando…</div>
      ) : error ? (
        <div style={{ ...CARDS.std, padding:32, textAlign:'center' }}>
          <p style={{ color:COLORS.err, fontSize:13, fontFamily:FONT.body }}>{error}</p>
          <button onClick={refresh} style={{ marginTop:12, fontSize:12, color:COLORS.sec, background:'none', border:'none', textDecoration:'underline', cursor:'pointer', fontFamily:FONT.body }}>Reintentar</button>
        </div>
      ) : (
        <>
          {tab==='diario'  && <TabDiario allData={filteredData} cols={cols} weekFilter={weekFilter} onEdit={setEditRow} onAdd={()=>setShowAdd(true)} tipoDia={tipoDia} totals={totals} dias={dias} tm={tm} tmNeto={tmNeto} netoEstimado={netoEstimado} mediadiaria={mediadiaria} mediaDiariaNeta={mediaDiariaNeta} />}
          {tab==='semanas' && <TabSemanas allData={filteredData} cols={cols} onDrill={(y,w)=>{setWeekFilter({year:y,week:w});setTab('diario')}} totals={totals} dias={dias} tm={tm} tmNeto={tmNeto} netoEstimado={netoEstimado} mediadiaria={mediadiaria} mediaDiariaNeta={mediaDiariaNeta} onAdd={()=>setShowAdd(true)} />}
          {tab==='meses'   && <TabMeses allData={filteredData} cols={cols} totals={totals} dias={dias} tm={tm} tmNeto={tmNeto} netoEstimado={netoEstimado} mediadiaria={mediadiaria} mediaDiariaNeta={mediaDiariaNeta} onAdd={()=>setShowAdd(true)} />}
          {tab==='anual'   && <TabAnual allData={filteredData} totals={totals} dias={dias} tm={tm} tmNeto={tmNeto} netoEstimado={netoEstimado} mediadiaria={mediadiaria} mediaDiariaNeta={mediaDiariaNeta} onAdd={()=>setShowAdd(true)} />}
        </>
      )}

      {showAdd && <DayModal allData={allData} onClose={()=>setShowAdd(false)} onSaved={()=>{setShowAdd(false);refresh()}} />}
      {editRow && <DayModal allData={allData} existing={editRow} onClose={()=>setEditRow(null)} onSaved={()=>{setEditRow(null);refresh()}} />}
    </div>
  )
}

// ─── KPI Cards ─────────────────────────────────────────────────
interface KpiCardsProps { totals:AggRow; dias:number; tm:number; tmNeto:number; netoEstimado:number; mediadiaria:number; mediaDiariaNeta:number; onAdd:()=>void; onExport?:()=>void }
function KpiCards({ totals, dias, tm, tmNeto, netoEstimado, mediadiaria, mediaDiariaNeta, onAdd, onExport }: KpiCardsProps) {
  const netoLabel = `NETO EST. · ${(NETO_FACTOR*100).toFixed(0)}%`
  // kpiBig = 38px — mismo para bruto, neto, medias bruta y neta
  // Medias: 32px — más grandes que antes (28) pero menores que los totales (38)
  const MEDIA_SIZE = 32
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 25%', gap:14, marginBottom:14, alignItems:'stretch' }}>

      {/* Card 1: Facturación — 2 columnas internas */}
      <div style={CARDS.big}>
        <div style={{ ...lblSm, marginBottom:12 }}>FACTURACIÓN</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, alignItems:'start' }}>
          {/* Izq: Bruto + Neto — ambos kpiBig (38px) */}
          <div>
            <div style={{ ...kpiBig, lineHeight:1 }}>{fmtKpi(totals.total_bruto)}</div>
            <div style={{ ...lblXs, marginTop:3, marginBottom:14 }}>BRUTO</div>
            <div style={{ ...kpiBig, lineHeight:1, color:COLORS.ok }}>{fmtKpi(netoEstimado)}</div>
            <div style={{ fontFamily:FONT.heading, fontSize:10, letterSpacing:'1.5px', textTransform:'uppercase', color:COLORS.ok, marginTop:3 }}>{netoLabel}</div>
          </div>
          {/* Der: Media bruta + Media neta — ambas 32px */}
          <div>
            <div style={{ fontFamily:FONT.heading, fontSize:MEDIA_SIZE, fontWeight:600, color:COLORS.sec, lineHeight:1 }}>{fmtKpi(mediadiaria)}</div>
            <div style={{ ...lblXs, color:COLORS.mut, marginTop:3, marginBottom:14 }}>MEDIA/DÍA BRUTA</div>
            <div style={{ fontFamily:FONT.heading, fontSize:MEDIA_SIZE, fontWeight:600, color:COLORS.ok, lineHeight:1 }}>{fmtKpi(mediaDiariaNeta)}</div>
            <div style={{ fontFamily:FONT.heading, fontSize:9, letterSpacing:'1.5px', textTransform:'uppercase', color:COLORS.ok, marginTop:3 }}>MEDIA/DÍA NETA</div>
          </div>
        </div>
        <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ fontFamily:FONT.heading, fontSize:14, fontWeight:600, color:COLORS.mut }}>{dias}</span>
          <span style={{ ...lblXs, color:COLORS.mut }}>DÍAS</span>
        </div>
      </div>

      {/* Card 2: Pedidos + TM */}
      <div style={CARDS.big}>
        <div style={{ ...lblSm, marginBottom:12 }}>PEDIDOS · TM</div>
        <div style={{ display:'flex', alignItems:'baseline', gap:14, flexWrap:'wrap' }}>
          <div><div style={{ ...kpiBig, lineHeight:1, color:COLORS.lun }}>{fmtInt(totals.total_pedidos)}</div><div style={{ ...lblXs, marginTop:3 }}>PEDIDOS</div></div>
          <div><div style={{ ...kpiBig, lineHeight:1, color:COLORS.warn }}>{fmtTM(tm)}</div><div style={{ fontFamily:FONT.heading, fontSize:10, letterSpacing:'1.5px', textTransform:'uppercase', color:COLORS.warn, marginTop:3 }}>TM BRUTO</div></div>
          <div><div style={{ ...kpiBig, lineHeight:1, color:COLORS.ok }}>{fmtTM(tmNeto)}</div><div style={{ fontFamily:FONT.heading, fontSize:10, letterSpacing:'1.5px', textTransform:'uppercase', color:COLORS.ok, marginTop:3 }}>TM NETO</div></div>
        </div>
      </div>

      {/* Columna 25%: Añadir Día + Exportar */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <div onClick={onAdd} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')onAdd()}}
          style={{ flex:'0 0 70%', ...CARDS.big, background:COLORS.redSL, border:'none', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, userSelect:'none', padding:'20px 16px' }}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity='0.88'}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity='1'}}>
          <span style={{ fontSize:24, lineHeight:1, color:'#fff' }}>↑</span>
          <div style={{ fontFamily:FONT.heading, fontSize:13, fontWeight:600, letterSpacing:'2px', color:'#fff', textTransform:'uppercase' }}>AÑADIR DÍA</div>
          <div style={{ fontFamily:FONT.body, fontSize:11, color:'rgba(255,255,255,0.72)' }}>Fecha · Canales</div>
        </div>
        {onExport && (
          <button onClick={onExport}
            style={{ flex:'0 0 30%', ...CARDS.big, border:`0.5px solid ${COLORS.brd}`, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:FONT.body, fontSize:12, color:COLORS.mut, fontWeight:500, background:COLORS.card, padding:'10px 16px' }}>
            <span style={{ fontSize:14 }}>↓</span> Exportar CSV
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Tab Diario ────────────────────────────────────────────────
function TabDiario({ allData, cols, weekFilter, onEdit, onAdd, tipoDia, totals, dias, tm, tmNeto, netoEstimado, mediadiaria, mediaDiariaNeta }: { allData:RawDiario[]; cols:typeof ALL_COLS; weekFilter:{year:number;week:number}|null; onEdit:(r:RawDiario)=>void; onAdd:()=>void; tipoDia:(f:string)=>TipoDia; totals:AggRow; dias:number; tm:number; tmNeto:number; netoEstimado:number; mediadiaria:number; mediaDiariaNeta:number }) {
  const [sortCol, setSortCol] = useState<SortCol>('fecha')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const rows = useMemo(()=>{
    let data=allData
    if(weekFilter){ const [from,to]=weekBounds(weekFilter.year,weekFilter.week); data=data.filter(r=>r.fecha>=from&&r.fecha<=to) }
    return [...data].sort((a,b)=>{
      let va: number|string=0, vb: number|string=0
      if(sortCol==='fecha'){va=a.fecha;vb=b.fecha} else if(sortCol==='serv'){va=a.servicio;vb=b.servicio}
      else if(sortCol==='uber'){va=a.uber_bruto;vb=b.uber_bruto} else if(sortCol==='glovo'){va=a.glovo_bruto;vb=b.glovo_bruto}
      else if(sortCol==='je'){va=a.je_bruto;vb=b.je_bruto} else if(sortCol==='web'){va=a.web_bruto;vb=b.web_bruto}
      else if(sortCol==='dir'){va=a.directa_bruto;vb=b.directa_bruto} else if(sortCol==='total'){va=a.total_bruto;vb=b.total_bruto}
      if(typeof va==='string') return sortDir==='asc'?va.localeCompare(vb as string):(vb as string).localeCompare(va)
      return sortDir==='asc'?(va as number)-(vb as number):(vb as number)-(va as number)
    })
  },[allData,weekFilter,sortCol,sortDir])
  const rowTotals = useMemo(()=>aggregate(rows),[rows])
  const fechaCount = useMemo(()=>{ const m=new Map<string,number>(); for(const r of rows) m.set(r.fecha,(m.get(r.fecha)??0)+1); return m },[rows])
  const subtotalMap = useMemo(()=>{ const m=new Map<string,AggRow>(); for(const [f,c] of fechaCount) if(c>1) m.set(f,aggregate(allData.filter(r=>r.fecha===f))); return m },[allData,fechaCount])
  const rowsConSub = useMemo(()=>{
    type Item={type:'subtotal';fecha:string;agg:AggRow}|{type:'row';r:RawDiario}
    const result: Item[]=[]; let lastFecha=''
    for(const r of rows){ if(r.fecha!==lastFecha){ if((fechaCount.get(r.fecha)??1)>1) result.push({type:'subtotal',fecha:r.fecha,agg:subtotalMap.get(r.fecha)!}); lastFecha=r.fecha }; result.push({type:'row',r}) }
    return result
  },[rows,fechaCount,subtotalMap])
  const exportar=()=>{ downloadCSV('facturacion_diario.csv',['Fecha','Servicio','UE Ped','UE Bruto','GL Ped','GL Bruto','JE Ped','JE Bruto','Web Ped','Web Bruto','Dir Ped','Dir Bruto','Total Ped','Total Bruto'],rows.map(r=>[r.fecha,r.servicio,r.uber_pedidos,r.uber_bruto,r.glovo_pedidos,r.glovo_bruto,r.je_pedidos,r.je_bruto,r.web_pedidos,r.web_bruto,r.directa_pedidos,r.directa_bruto,r.total_pedidos,r.total_bruto])) }
  const handleSort=(col:SortCol)=>{ if(sortCol===col) setSortDir(d=>d==='asc'?'desc':'asc'); else{setSortCol(col);setSortDir('asc')} }
  const arr=(col:SortCol)=>sortCol===col?(sortDir==='asc'?' ↑':' ↓'):''
  const thBase=(col:SortCol,align:'left'|'right'|'center'='left'): CSSProperties=>({ fontFamily:FONT.heading, fontSize:10, fontWeight:500, letterSpacing:'2px', textTransform:'uppercase', textAlign:align, color:sortCol===col?COLORS.redSL:COLORS.mut, padding:'10px 12px', background:COLORS.bg, borderBottom:`0.5px solid ${COLORS.brd}`, whiteSpace:'nowrap', cursor:'pointer', userSelect:'none' })
  const thCol=(col:SortCol,color:string,bg:string): CSSProperties=>({ ...thBase(col,'center'), background:bg, color:sortCol===col?color:`${color}99` })
  const tdBase: CSSProperties={ padding:'9px 12px', fontSize:13, fontFamily:FONT.body, color:COLORS.sec, borderBottom:`0.5px solid ${COLORS.brd}`, whiteSpace:'nowrap', verticalAlign:'middle' }
  if(allData.length===0) return <div style={{ ...CARDS.std, padding:48, textAlign:'center', fontFamily:FONT.body, fontSize:13, color:COLORS.mut }}>Sin datos de facturación diaria</div>
  return (
    <>
      <KpiCards totals={totals} dias={dias} tm={tm} tmNeto={tmNeto} netoEstimado={netoEstimado} mediadiaria={mediadiaria} mediaDiariaNeta={mediaDiariaNeta} onAdd={onAdd} onExport={exportar} />
      {weekFilter && <div style={{ marginBottom:10 }}><span style={{ padding:'4px 10px', background:`${COLORS.redSL}12`, color:COLORS.redSL, borderRadius:8, border:`0.5px solid ${COLORS.redSL}30`, fontFamily:FONT.body, fontSize:12 }}>S{weekFilter.week}</span></div>}
      <div style={{ ...CARDS.std, padding:0, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0, whiteSpace:'nowrap', minWidth:860 }}>
            <thead>
              <tr>
                <th onClick={()=>handleSort('fecha')} style={{...thBase('fecha'),paddingLeft:16}} rowSpan={2}>Fecha{arr('fecha')}</th>
                <th onClick={()=>handleSort('serv')} style={thBase('serv')} rowSpan={2}>Serv.{arr('serv')}</th>
                {cols.map(c=>(<th key={c.id} colSpan={2} onClick={()=>handleSort(c.id as SortCol)} style={thCol(c.id as SortCol,c.color,c.bg)}>{c.label}{arr(c.id as SortCol)}</th>))}
                <th colSpan={2} onClick={()=>handleSort('total')} style={thBase('total','center')}>Total{arr('total')}</th>
              </tr>
              <tr>
                {cols.map(c=>(<Fragment key={c.id}><th style={{ padding:'5px 10px', textAlign:'center', background:c.bg, borderBottom:`0.5px solid ${COLORS.brd}`, fontFamily:FONT.heading, fontSize:9, letterSpacing:'1.5px', textTransform:'uppercase', color:COLORS.mut, fontWeight:400 }}>Ped</th><th style={{ padding:'5px 10px', textAlign:'right', background:c.bg, borderBottom:`0.5px solid ${COLORS.brd}`, fontFamily:FONT.heading, fontSize:9, letterSpacing:'1.5px', textTransform:'uppercase', color:COLORS.mut, fontWeight:400 }}>Bruto</th></Fragment>))}
                <th style={{ padding:'5px 10px', textAlign:'center', background:COLORS.bg, borderBottom:`0.5px solid ${COLORS.brd}`, fontFamily:FONT.heading, fontSize:9, letterSpacing:'1.5px', textTransform:'uppercase', color:COLORS.mut, fontWeight:400 }}>Ped</th>
                <th style={{ padding:'5px 10px', textAlign:'right', background:COLORS.bg, borderBottom:`0.5px solid ${COLORS.brd}`, fontFamily:FONT.heading, fontSize:9, letterSpacing:'1.5px', textTransform:'uppercase', color:COLORS.mut, fontWeight:400 }}>Bruto</th>
              </tr>
            </thead>
            <tbody>
              {rowsConSub.map((item,idx)=>{
                if(item.type==='subtotal'){
                  const s=item.agg; const isLast=idx===rowsConSub.length-1
                  return (<tr key={`sub-${item.fecha}`} style={{ background:`${COLOR_TODOS}08` }}>
                    <td style={{ ...tdBase, color:COLORS.mut, fontSize:12, borderBottom:isLast?'none':`0.5px solid ${COLORS.brd}`, paddingLeft:16 }}>{fmtFechaCorta(item.fecha)}</td>
                    <td style={{ ...tdBase, borderBottom:isLast?'none':`0.5px solid ${COLORS.brd}` }}><ServicioBadge s="TODO" /></td>
                    {cols.map(c=>{ const p=(s[c.ped] as number)||0; const b=(s[c.bru] as number)||0; return (<Fragment key={c.id}><td style={{ ...tdBase, textAlign:'center', background:c.bg, color:p>0?COLORS.sec:COLORS.mut, borderBottom:isLast?'none':`0.5px solid ${COLORS.brd}` }}>{p>0?fmtInt(p):'—'}</td><td style={{ ...tdBase, textAlign:'right', background:c.bg, color:b>0?COLORS.sec:COLORS.mut, borderBottom:isLast?'none':`0.5px solid ${COLORS.brd}` }}>{b>0?fmtBru(b):'—'}</td></Fragment>) })}
                    <td style={{ ...tdBase, textAlign:'center', color:COLORS.sec, borderBottom:isLast?'none':`0.5px solid ${COLORS.brd}` }}>{fmtInt(s.total_pedidos)}</td>
                    <td style={{ ...tdBase, textAlign:'right', color:COLORS.sec, borderBottom:isLast?'none':`0.5px solid ${COLORS.brd}` }}>{fmtBru(s.total_bruto)}</td>
                  </tr>)
                }
                const {r}=item; const tipo=tipoDia(r.fecha); const esCerrado=tipo==='cerrado'||tipo==='festivo'||tipo==='vacaciones'; const isLast=idx===rowsConSub.length-1
                return (<tr key={r.id} onClick={()=>onEdit(r)} style={{ cursor:'pointer', opacity:esCerrado?0.6:1 }} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=`${COLORS.bg}80`}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=''}}>
                  <td style={{ ...tdBase, color:COLORS.mut, fontSize:12, borderBottom:isLast?'none':`0.5px solid ${COLORS.brd}`, paddingLeft:16 }}><div style={{ display:'flex', alignItems:'center', gap:6 }}>{fmtFechaCorta(r.fecha)}<TipoPill tipo={tipo} /></div></td>
                  <td style={{ ...tdBase, borderBottom:isLast?'none':`0.5px solid ${COLORS.brd}` }}><ServicioBadge s={r.servicio} /></td>
                  {cols.map(c=>{ const p=(r[c.ped] as number)||0; const b=(r[c.bru] as number)||0; return (<Fragment key={c.id}><td style={{ ...tdBase, textAlign:'center', background:c.bg, color:p>0?COLORS.sec:COLORS.mut, borderBottom:isLast?'none':`0.5px solid ${COLORS.brd}` }}>{p>0?fmtInt(p):'—'}</td><td style={{ ...tdBase, textAlign:'right', background:c.bg, color:b>0?COLORS.sec:COLORS.mut, borderBottom:isLast?'none':`0.5px solid ${COLORS.brd}` }}>{b>0?fmtBru(b):'—'}</td></Fragment>) })}
                  <td style={{ ...tdBase, textAlign:'center', borderBottom:isLast?'none':`0.5px solid ${COLORS.brd}` }}>{fmtInt(r.total_pedidos)}</td>
                  <td style={{ ...tdBase, textAlign:'right', borderBottom:isLast?'none':`0.5px solid ${COLORS.brd}` }}>{fmtBru(r.total_bruto)}</td>
                </tr>)
              })}
            </tbody>
            <tfoot>
              <tr style={{ background:COLORS.bg }}>
                <td style={{ padding:'10px 12px 10px 16px', color:COLORS.mut, fontFamily:FONT.heading, fontSize:10, letterSpacing:'2px', textTransform:'uppercase', borderTop:`0.5px solid ${COLORS.brd}` }} colSpan={2}>Total</td>
                {cols.map(c=>(<Fragment key={c.id}><td style={{ padding:'10px 12px', textAlign:'center', color:c.color, background:c.bg, fontFamily:FONT.heading, fontSize:14, fontWeight:600, borderTop:`0.5px solid ${COLORS.brd}` }}>{fmtInt(rowTotals[c.ped] as number)}</td><td style={{ padding:'10px 12px', textAlign:'right', color:c.color, background:c.bg, fontFamily:FONT.heading, fontSize:14, fontWeight:600, borderTop:`0.5px solid ${COLORS.brd}` }}>{fmtBru(rowTotals[c.bru] as number)}</td></Fragment>))}
                <td style={{ padding:'10px 12px', textAlign:'center', color:COLORS.sec, fontFamily:FONT.heading, fontSize:14, fontWeight:600, borderTop:`0.5px solid ${COLORS.brd}` }}>{fmtInt(rowTotals.total_pedidos)}</td>
                <td style={{ padding:'10px 12px', textAlign:'right', color:COLORS.sec, fontFamily:FONT.heading, fontSize:14, fontWeight:600, borderTop:`0.5px solid ${COLORS.brd}` }}>{fmtBru(rowTotals.total_bruto)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  )
}

// ─── Tab Semanas ───────────────────────────────────────────────
function TabSemanas({ allData, cols, onDrill, totals, dias, tm, tmNeto, netoEstimado, mediadiaria, mediaDiariaNeta, onAdd }: { allData:RawDiario[]; cols:typeof ALL_COLS; onDrill:(y:number,w:number)=>void; totals:AggRow; dias:number; tm:number; tmNeto:number; netoEstimado:number; mediadiaria:number; mediaDiariaNeta:number; onAdd:()=>void }) {
  const rows = useMemo(()=>buildSemanas(allData).slice(0,12),[allData])
  const exportar=()=>{ downloadCSV('facturacion_semanas.csv',['Semana','Periodo','Dias',...cols.map(c=>c.label),'Total Ped','Total Bruto'],rows.map(r=>[`S${r.week}`,r.periodo,r.dias,...cols.map(c=>r[c.bru] as number),r.total_pedidos,r.total_bruto])) }
  const thS: CSSProperties={ fontFamily:FONT.heading, fontSize:10, fontWeight:500, letterSpacing:'2px', textTransform:'uppercase', color:COLORS.mut, padding:'10px 12px', background:COLORS.bg, borderBottom:`0.5px solid ${COLORS.brd}`, whiteSpace:'nowrap' }
  const tdS: CSSProperties={ padding:'9px 12px', fontSize:13, fontFamily:FONT.body, color:COLORS.sec, borderBottom:`0.5px solid ${COLORS.brd}`, whiteSpace:'nowrap' }
  if(rows.length===0) return <div style={{ ...CARDS.std, padding:48, textAlign:'center', fontFamily:FONT.body, fontSize:13, color:COLORS.mut }}>Sin datos semanales</div>
  return (
    <>
      <KpiCards totals={totals} dias={dias} tm={tm} tmNeto={tmNeto} netoEstimado={netoEstimado} mediadiaria={mediadiaria} mediaDiariaNeta={mediaDiariaNeta} onAdd={onAdd} onExport={exportar} />
      <div style={{ ...CARDS.std, padding:0, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0, whiteSpace:'nowrap' }}>
            <thead><tr><th style={thS}>Sem</th><th style={thS}>Periodo</th><th style={{ ...thS, textAlign:'center' }}>Días</th>{cols.map(c=><th key={c.id} style={{ ...thS, background:c.bg, color:`${c.color}99`, textAlign:'right' }}>{c.label}</th>)}<th style={{ ...thS, textAlign:'right' }}>Total</th></tr></thead>
            <tbody>
              {rows.map((r,idx)=>(<tr key={`${r.year}-${r.week}`} onClick={()=>onDrill(r.year,r.week)} style={{ cursor:'pointer' }} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=`${COLORS.bg}80`}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=''}}>
                <td style={{ ...tdS, fontFamily:FONT.heading, fontWeight:600, borderBottom:idx===rows.length-1?'none':`0.5px solid ${COLORS.brd}` }}>S{r.week}</td>
                <td style={{ ...tdS, color:COLORS.mut, borderBottom:idx===rows.length-1?'none':`0.5px solid ${COLORS.brd}` }}>{r.periodo}</td>
                <td style={{ ...tdS, textAlign:'center', color:COLORS.mut, borderBottom:idx===rows.length-1?'none':`0.5px solid ${COLORS.brd}` }}>{r.dias}</td>
                {cols.map(c=>(<td key={c.id} style={{ ...tdS, textAlign:'right', background:c.bg, color:(r[c.bru] as number)>0?COLORS.sec:COLORS.mut, borderBottom:idx===rows.length-1?'none':`0.5px solid ${COLORS.brd}` }}>{(r[c.bru] as number)>0?fmtBru(r[c.bru] as number):'—'}</td>))}
                <td style={{ ...tdS, textAlign:'right', fontWeight:600, borderBottom:idx===rows.length-1?'none':`0.5px solid ${COLORS.brd}` }}>{fmtBru(r.total_bruto)}</td>
              </tr>))}
            </tbody>
            <tfoot><tr style={{ background:COLORS.bg }}><td style={{ padding:'10px 12px', color:COLORS.mut, fontFamily:FONT.heading, fontSize:10, letterSpacing:'2px', textTransform:'uppercase', borderTop:`0.5px solid ${COLORS.brd}` }} colSpan={3}>Total</td>{cols.map(c=>(<td key={c.id} style={{ padding:'10px 12px', textAlign:'right', color:c.color, background:c.bg, fontFamily:FONT.heading, fontSize:14, fontWeight:600, borderTop:`0.5px solid ${COLORS.brd}` }}>{fmtBru(totals[c.bru] as number)}</td>))}<td style={{ padding:'10px 12px', textAlign:'right', color:COLORS.sec, fontFamily:FONT.heading, fontSize:14, fontWeight:600, borderTop:`0.5px solid ${COLORS.brd}` }}>{fmtBru(totals.total_bruto)}</td></tr></tfoot>
          </table>
        </div>
      </div>
      <p style={{ fontSize:10, color:COLORS.mut, marginTop:8, fontFamily:FONT.body }}>Haz clic en una semana para ver el detalle diario</p>
    </>
  )
}

// ─── Tab Meses ─────────────────────────────────────────────────
function TabMeses({ allData, cols, totals, dias, tm, tmNeto, netoEstimado, mediadiaria, mediaDiariaNeta, onAdd }: { allData:RawDiario[]; cols:typeof ALL_COLS; totals:AggRow; dias:number; tm:number; tmNeto:number; netoEstimado:number; mediadiaria:number; mediaDiariaNeta:number; onAdd:()=>void }) {
  const allRows = useMemo(()=>buildMeses(allData),[allData])
  const years = useMemo(()=>{const s=new Set(allRows.map(r=>r.anio));return [...s].sort((a,b)=>b-a)},[allRows])
  const [selYear,setSelYear]=useState(new Date().getFullYear())
  useEffect(()=>{if(years.length>0&&!years.includes(selYear))setSelYear(years[0])},[years,selYear])
  const rows=useMemo(()=>allRows.filter(r=>r.anio===selYear),[allRows,selYear])
  const yearTotal=useMemo(()=>{ const a=aggregate(allData.filter(r=>r.fecha.startsWith(String(selYear)))); const d=new Set(allData.filter(r=>r.fecha.startsWith(String(selYear))).map(r=>r.fecha)).size; return{...a,dias:d} },[allData,selYear])
  const exportar=()=>{ downloadCSV(`facturacion_meses_${selYear}.csv`,['Mes','Dias',...cols.map(c=>c.label),'Total Ped','Total Bruto','Media Diaria','vs Anterior'],rows.map(r=>{const vs=r.vs_anterior!==null?r.vs_anterior.toFixed(1)+'%':'';return[MES_NOMBRE[r.mes],r.dias,...cols.map(c=>r[c.bru] as number),r.total_pedidos,r.total_bruto,r.media_diaria.toFixed(2),vs]})) }
  const thS: CSSProperties={ fontFamily:FONT.heading, fontSize:10, fontWeight:500, letterSpacing:'2px', textTransform:'uppercase', color:COLORS.mut, padding:'10px 12px', background:COLORS.bg, borderBottom:`0.5px solid ${COLORS.brd}`, whiteSpace:'nowrap' }
  const tdS: CSSProperties={ padding:'9px 12px', fontSize:13, fontFamily:FONT.body, color:COLORS.sec, borderBottom:`0.5px solid ${COLORS.brd}`, whiteSpace:'nowrap' }
  if(allRows.length===0) return <div style={{ ...CARDS.std, padding:48, textAlign:'center', fontFamily:FONT.body, fontSize:13, color:COLORS.mut }}>Sin datos mensuales</div>
  return (
    <>
      <KpiCards totals={totals} dias={dias} tm={tm} tmNeto={tmNeto} netoEstimado={netoEstimado} mediadiaria={mediadiaria} mediaDiariaNeta={mediaDiariaNeta} onAdd={onAdd} onExport={exportar} />
      {years.length>1&&(<div style={{ marginBottom:12 }}><select value={selYear} onChange={e=>setSelYear(Number(e.target.value))} style={{ padding:'9px 14px', borderRadius:10, border:`0.5px solid ${COLORS.brd}`, background:COLORS.card, fontFamily:FONT.body, fontSize:13, color:COLORS.sec, cursor:'pointer' }}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></div>)}
      <div style={{ ...CARDS.std, padding:0, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0, whiteSpace:'nowrap' }}>
            <thead><tr><th style={thS}>Mes</th><th style={{ ...thS, textAlign:'center' }}>Días</th>{cols.map(c=><th key={c.id} style={{ ...thS, background:c.bg, color:`${c.color}99`, textAlign:'right' }}>{c.label}</th>)}<th style={{ ...thS, textAlign:'right' }}>Media/día</th><th style={{ ...thS, textAlign:'right' }}>vs Anterior</th></tr></thead>
            <tbody>
              {rows.map((r,idx)=>(<tr key={r.mes} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=`${COLORS.bg}80`}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=''}}>
                <td style={{ ...tdS, fontFamily:FONT.heading, fontWeight:600, borderBottom:idx===rows.length-1?'none':`0.5px solid ${COLORS.brd}` }}>{MES_NOMBRE[r.mes]}</td>
                <td style={{ ...tdS, textAlign:'center', color:COLORS.mut, borderBottom:idx===rows.length-1?'none':`0.5px solid ${COLORS.brd}` }}>{r.dias}</td>
                {cols.map(c=>(<td key={c.id} style={{ ...tdS, textAlign:'right', background:c.bg, color:(r[c.bru] as number)>0?COLORS.sec:COLORS.mut, borderBottom:idx===rows.length-1?'none':`0.5px solid ${COLORS.brd}` }}>{(r[c.bru] as number)>0?fmtBru(r[c.bru] as number):'—'}</td>))}
                <td style={{ ...tdS, textAlign:'right', color:COLORS.mut, borderBottom:idx===rows.length-1?'none':`0.5px solid ${COLORS.brd}` }}>{r.dias>0?fmtBru(r.media_diaria):'—'}</td>
                <td style={{ ...tdS, textAlign:'right', borderBottom:idx===rows.length-1?'none':`0.5px solid ${COLORS.brd}` }}>{r.vs_anterior!==null?<DesvBadge pct={r.vs_anterior} />:<span style={{ color:COLORS.mut }}>—</span>}</td>
              </tr>))}
            </tbody>
            <tfoot><tr style={{ background:COLORS.bg }}><td style={{ padding:'10px 12px', color:COLORS.mut, fontFamily:FONT.heading, fontSize:10, letterSpacing:'2px', textTransform:'uppercase', borderTop:`0.5px solid ${COLORS.brd}` }} colSpan={2}>{selYear} Total</td>{cols.map(c=>(<td key={c.id} style={{ padding:'10px 12px', textAlign:'right', color:c.color, background:c.bg, fontFamily:FONT.heading, fontSize:14, fontWeight:600, borderTop:`0.5px solid ${COLORS.brd}` }}>{fmtBru(yearTotal[c.bru] as number)}</td>))}<td style={{ padding:'10px 12px', textAlign:'right', color:COLORS.sec, fontFamily:FONT.heading, fontSize:14, fontWeight:600, borderTop:`0.5px solid ${COLORS.brd}` }}>{yearTotal.dias>0?fmtBru(yearTotal.total_bruto/yearTotal.dias):'—'}</td><td style={{ padding:'10px 12px', borderTop:`0.5px solid ${COLORS.brd}` }} /></tr></tfoot>
          </table>
        </div>
      </div>
    </>
  )
}

// ─── Tab Anual ─────────────────────────────────────────────────
function TabAnual({ allData, totals, dias, tm, tmNeto, netoEstimado, mediadiaria, mediaDiariaNeta, onAdd }: { allData:RawDiario[]; totals:AggRow; dias:number; tm:number; tmNeto:number; netoEstimado:number; mediadiaria:number; mediaDiariaNeta:number; onAdd:()=>void }) {
  const years = useMemo(()=>{ const m=new Map<number,{bruto:number;pedidos:number}>(); for(const r of allData){ const y=parseInt(r.fecha.slice(0,4)); if(!m.has(y))m.set(y,{bruto:0,pedidos:0}); const c=m.get(y)!; c.bruto+=r.total_bruto||0; c.pedidos+=r.total_pedidos||0 }; return [...m.entries()].sort((a,b)=>b[0]-a[0]).map(([anio,v])=>({anio,bruto:v.bruto,pedidos:v.pedidos,mediaMensual:v.bruto/12,mediaTicket:v.pedidos>0?v.bruto/v.pedidos:0})) },[allData])
  const maxBruto=Math.max(...years.map(y=>y.bruto),1)
  const exportar=()=>{ downloadCSV('facturacion_anual.csv',['Año','Bruto','Media mensual','Pedidos','Ticket medio'],years.map(y=>[y.anio,y.bruto,y.mediaMensual,y.pedidos,y.mediaTicket])) }
  const thS: CSSProperties={ fontFamily:FONT.heading, fontSize:10, letterSpacing:'1.5px', textTransform:'uppercase', color:COLORS.mut, padding:'10px 14px', textAlign:'left', background:COLORS.bg, borderBottom:`0.5px solid ${COLORS.brd}` }
  const tdS: CSSProperties={ padding:'12px 14px', fontSize:13, fontFamily:FONT.body, color:COLORS.sec, borderBottom:`0.5px solid ${COLORS.brd}` }
  return (
    <div>
      <KpiCards totals={totals} dias={dias} tm={tm} tmNeto={tmNeto} netoEstimado={netoEstimado} mediadiaria={mediadiaria} mediaDiariaNeta={mediaDiariaNeta} onAdd={onAdd} onExport={exportar} />
      <div style={{ ...CARDS.std, padding:0, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0 }}>
          <thead><tr><th style={thS}>Año</th><th style={{ ...thS, textAlign:'right' }}>Facturación bruta</th><th style={thS}>vs año anterior</th><th style={{ ...thS, textAlign:'right' }}>Media mensual</th><th style={{ ...thS, textAlign:'right' }}>Pedidos</th><th style={{ ...thS, textAlign:'right' }}>Ticket medio</th></tr></thead>
          <tbody>
            {years.map((y,idx)=>{ const prev=years[idx+1]; const delta=prev?((y.bruto-prev.bruto)/prev.bruto)*100:null; const barW=`${Math.round((y.bruto/maxBruto)*100)}%`
              return (<tr key={y.anio} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=`${COLORS.bg}80`}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=''}}>
                <td style={{ ...tdS, fontFamily:FONT.heading, color:COLORS.redSL, fontWeight:600, borderBottom:idx===years.length-1?'none':`0.5px solid ${COLORS.brd}` }}>{y.anio}</td>
                <td style={{ ...tdS, textAlign:'right', borderBottom:idx===years.length-1?'none':`0.5px solid ${COLORS.brd}` }}><div style={{ fontFamily:FONT.heading, fontSize:14, fontWeight:600, marginBottom:4 }}>{fmtBru(y.bruto)}</div><div style={{ height:4, background:COLORS.brd, borderRadius:2, overflow:'hidden' }}><div style={{ height:4, width:barW, background:COLORS.redSL, borderRadius:2 }} /></div></td>
                <td style={{ ...tdS, borderBottom:idx===years.length-1?'none':`0.5px solid ${COLORS.brd}` }}>{delta!=null?<DesvBadge pct={delta} />:<span style={{ color:COLORS.mut }}>—</span>}</td>
                <td style={{ ...tdS, textAlign:'right', color:COLORS.mut, borderBottom:idx===years.length-1?'none':`0.5px solid ${COLORS.brd}` }}>{fmtBru(y.mediaMensual)}</td>
                <td style={{ ...tdS, textAlign:'right', color:COLORS.mut, borderBottom:idx===years.length-1?'none':`0.5px solid ${COLORS.brd}` }}>{fmtInt(y.pedidos)}</td>
                <td style={{ ...tdS, textAlign:'right', color:COLORS.mut, borderBottom:idx===years.length-1?'none':`0.5px solid ${COLORS.brd}` }}>{fmtTM(y.mediaTicket)}</td>
              </tr>)
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Modal ─────────────────────────────────────────────────────
interface FormFields { uber_pedidos:string;uber_bruto:string;glovo_pedidos:string;glovo_bruto:string;je_ped:string;je_bru:string;web_pedidos:string;web_bruto:string;directa_ped:string;directa_bru:string }
const FORM_COLS: { label:string; ped:keyof FormFields; bru:keyof FormFields }[] = [{label:'Uber Eats',ped:'uber_pedidos',bru:'uber_bruto'},{label:'Glovo',ped:'glovo_pedidos',bru:'glovo_bruto'},{label:'Web',ped:'web_pedidos',bru:'web_bruto'},{label:'Venta Directa',ped:'directa_ped',bru:'directa_bru'}]
const CANAL_COLORS_M: Record<string,{bg:string;border:string;label:string}> = {'Uber Eats':{bg:'#06C16712',border:'#06C167',label:'#06C167'},'Glovo':{bg:'#e8f44218',border:'#8a7800',label:'#8a7800'},'Web':{bg:'#B01D2312',border:'#B01D23',label:'#B01D23'},'Venta Directa':{bg:'#66aaff12',border:'#66aaff',label:'#66aaff'}}

function DayModal({ allData, existing, onClose, onSaved }: { allData:RawDiario[]; existing?:RawDiario; onClose:()=>void; onSaved:()=>void }) {
  const isEdit=!!existing
  const [fecha,setFecha]=useState(existing?.fecha??new Date().toISOString().slice(0,10))
  const [servicio,setServicio]=useState(existing?.servicio??'TODO')
  const [fields,setFields]=useState<FormFields>(()=>{ if(!existing) return {uber_pedidos:'',uber_bruto:'',glovo_pedidos:'',glovo_bruto:'',je_ped:'',je_bru:'',web_pedidos:'',web_bruto:'',directa_ped:'0',directa_bru:'0.00'}; return {uber_pedidos:String(existing.uber_pedidos||''),uber_bruto:String(existing.uber_bruto||''),glovo_pedidos:String(existing.glovo_pedidos||''),glovo_bruto:String(existing.glovo_bruto||''),je_ped:String(existing.je_pedidos||''),je_bru:String(existing.je_bruto||''),web_pedidos:String(existing.web_pedidos||''),web_bruto:String(existing.web_bruto||''),directa_ped:String(existing.directa_pedidos||0),directa_bru:String(existing.directa_bruto||0)} })
  const [saving,setSaving]=useState(false)
  const [formError,setFormError]=useState<string|null>(null)
  const [jeItems,setJeItems]=useState<number[]>(existing&&(existing.je_bruto??0)>0?[existing.je_bruto]:[])
  const [jeInput,setJeInput]=useState('')
  useEffect(()=>{const t=jeItems.reduce((a,b)=>a+b,0);setFields(f=>({...f,je_ped:String(jeItems.length),je_bru:t.toFixed(2)}))},[jeItems])
  const set=(k:keyof FormFields,v:string)=>setFields(p=>({...p,[k]:v}))
  const filaAlm=useMemo(()=>allData.find(r=>r.fecha===fecha&&r.servicio==='ALM'&&r.id!==existing?.id),[allData,fecha,existing?.id])
  const handleSubmit=async(e:FormEvent)=>{
    e.preventDefault(); setFormError(null); if(!fecha){setFormError('Selecciona una fecha');return}
    if(servicio==='CENAS_ALM'){
      if(!filaAlm){setFormError('No hay fila ALM para este día.');return}
      const ub=Math.max(0,(parseFloat(fields.uber_bruto)||0)-(filaAlm.uber_bruto||0)); const gb=Math.max(0,(parseFloat(fields.glovo_bruto)||0)-(filaAlm.glovo_bruto||0)); const jb=Math.max(0,(parseFloat(fields.je_bru)||0)-(filaAlm.je_bruto||0)); const wb=Math.max(0,(parseFloat(fields.web_bruto)||0)-(filaAlm.web_bruto||0)); const db=Math.max(0,(parseFloat(fields.directa_bru)||0)-(filaAlm.directa_bruto||0))
      const up=Math.max(0,(Math.round(parseFloat(fields.uber_pedidos)||0))-(filaAlm.uber_pedidos||0)); const gp=Math.max(0,(Math.round(parseFloat(fields.glovo_pedidos)||0))-(filaAlm.glovo_pedidos||0)); const jp=Math.max(0,(Math.round(parseFloat(fields.je_ped)||0))-(filaAlm.je_pedidos||0)); const wp=Math.max(0,(Math.round(parseFloat(fields.web_pedidos)||0))-(filaAlm.web_pedidos||0)); const dp=Math.max(0,(Math.round(parseFloat(fields.directa_ped)||0))-(filaAlm.directa_pedidos||0))
      const tp=up+gp+jp+wp+dp; const tb=ub+gb+jb+wb+db; if(tp===0&&tb===0){setFormError('El total es igual o menor al ALM.');return}
      const p={fecha,servicio:'CENAS',uber_pedidos:up,uber_bruto:parseFloat(ub.toFixed(2)),glovo_pedidos:gp,glovo_bruto:parseFloat(gb.toFixed(2)),je_pedidos:jp,je_bruto:parseFloat(jb.toFixed(2)),web_pedidos:wp,web_bruto:parseFloat(wb.toFixed(2)),directa_pedidos:dp,directa_bruto:parseFloat(db.toFixed(2)),total_pedidos:tp,total_bruto:parseFloat(tb.toFixed(2))}
      setSaving(true); if(isEdit){const{error:de}=await supabase.from('facturacion_diario').delete().eq('id',existing!.id);if(de){setSaving(false);setFormError(de.message);return}}
      const{error}=await supabase.from('facturacion_diario').insert(p); setSaving(false); if(error){setFormError(error.message);return}; onSaved(); return
    }
    const up=Math.round(parseFloat(fields.uber_pedidos)||0); const ub=parseFloat(fields.uber_bruto)||0; const gp=Math.round(parseFloat(fields.glovo_pedidos)||0); const gb=parseFloat(fields.glovo_bruto)||0; const jp=Math.round(parseFloat(fields.je_ped)||0); const jb=parseFloat(fields.je_bru)||0; const wp=Math.round(parseFloat(fields.web_pedidos)||0); const wb=parseFloat(fields.web_bruto)||0; const dp=Math.round(parseFloat(fields.directa_ped)||0); const db=parseFloat(fields.directa_bru)||0
    const tp=up+gp+jp+wp+dp; const tb=ub+gb+jb+wb+db; if(tp===0&&tb===0){setFormError('Introduce datos en al menos un canal');return}
    const p={fecha,servicio,uber_pedidos:up,uber_bruto:ub,glovo_pedidos:gp,glovo_bruto:gb,je_pedidos:jp,je_bruto:jb,web_pedidos:wp,web_bruto:wb,directa_pedidos:dp,directa_bruto:db,total_pedidos:tp,total_bruto:tb}
    setSaving(true); const{error}=isEdit?await supabase.from('facturacion_diario').update(p).eq('id',existing!.id):await supabase.from('facturacion_diario').insert(p); setSaving(false); if(error){setFormError(error.message);return}; onSaved()
  }
  const handleDelete=async()=>{ if(!confirm('¿Eliminar este día?'))return; const{error}=await supabase.from('facturacion_diario').delete().eq('id',existing!.id); if(error){setFormError(error.message);return}; onSaved() }
  const inp: CSSProperties={ width:'100%', background:'#fff', color:'#111', border:'1px solid #d0c8bc', borderRadius:8, padding:'8px 12px', fontSize:13, fontFamily:FONT.body, outline:'none' }
  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', padding:16 }} onClick={onClose}>
      <div style={{ background:'#fff', border:`0.5px solid ${COLORS.brd}`, borderRadius:16, width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:`0.5px solid ${COLORS.brd}` }}>
          <h3 style={{ color:'#111', fontFamily:FONT.heading, fontSize:16, fontWeight:600, margin:0, letterSpacing:'2px' }}>{isEdit?'EDITAR DÍA':'AÑADIR DÍA'}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:COLORS.mut, fontSize:24, cursor:'pointer', lineHeight:1, padding:0 }}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding:20, display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'flex', gap:12, alignItems:'flex-end' }}>
            <div style={{ flex:'0 0 43%' }}><label style={{ display:'block', fontSize:11, color:COLORS.mut, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.5px', fontFamily:FONT.heading }}>Fecha</label><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={inp} /></div>
            <div style={{ flex:1 }}><label style={{ display:'block', fontSize:11, color:COLORS.mut, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.5px', fontFamily:FONT.heading }}>Servicio</label><div style={{ display:'flex', gap:4 }}>{[{key:'TODO',label:'TODOS'},{key:'ALM',label:'ALM'},{key:'CENAS',label:'CENAS'},{key:'CENAS_ALM',label:'CENAS/ALM'}].map(s=>{ const isA=servicio===s.key; const isCA=s.key==='CENAS_ALM'; return (<button key={s.key} type="button" onClick={()=>setServicio(s.key)} style={{ flex:1, padding:'8px 4px', borderRadius:8, fontSize:10, fontWeight:600, border:isA?'none':`0.5px solid ${COLORS.brd}`, background:isA?(isCA?'#7c3aed':COLORS.redSL):'#fff', color:isA?'#fff':COLORS.mut, cursor:'pointer', fontFamily:FONT.heading, letterSpacing:'0.5px', whiteSpace:'nowrap' }}>{s.label}</button>) })}</div></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {FORM_COLS.slice(0,2).map(c=>{const cc=CANAL_COLORS_M[c.label];return(<div key={c.label} style={{ background:cc?.bg??'#f5f5f5', border:`1px solid ${cc?.border??'#ccc'}`, borderRadius:10, padding:12 }}><p style={{ fontSize:11, fontWeight:600, marginBottom:10, color:cc?.label??'#666', fontFamily:FONT.heading, letterSpacing:1, textTransform:'uppercase' }}>{c.label}</p><div style={{ display:'flex', flexDirection:'column', gap:10 }}><div><label style={{ display:'block', fontSize:10, color:COLORS.mut, marginBottom:4 }}>Pedidos</label><input type="number" min="0" placeholder="0" value={fields[c.ped]} onChange={e=>set(c.ped,e.target.value)} style={inp} /></div><div><label style={{ display:'block', fontSize:10, color:COLORS.mut, marginBottom:4 }}>Bruto (EUR)</label><input type="number" min="0" step="0.01" placeholder="0.00" value={fields[c.bru]} onChange={e=>set(c.bru,e.target.value)} style={inp} /></div></div></div>)})}
          </div>
          <div style={{ background:'#f5a62312', border:'1px solid #f5a623', borderRadius:10, padding:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}><span style={{ fontFamily:FONT.heading, fontSize:11, letterSpacing:2, color:'#f5a623', textTransform:'uppercase' }}>Just Eat</span>{jeItems.length>0&&<span style={{ fontFamily:FONT.body, fontSize:12, color:COLORS.mut }}>{jeItems.length} pedido{jeItems.length!==1?'s':''} · {jeItems.reduce((a,b)=>a+b,0).toFixed(2)} €</span>}</div>
            {jeItems.length>0&&(<div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>{jeItems.map((item,idx)=>(<div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderRadius:8, background:'#fff', border:`0.5px solid ${COLORS.brd}` }}><span style={{ fontFamily:FONT.body, fontSize:13 }}>{item.toFixed(2)} €</span><button type="button" onClick={()=>setJeItems(p=>p.filter((_,i)=>i!==idx))} style={{ background:'none', border:'none', cursor:'pointer', color:COLORS.err, fontSize:18, lineHeight:1, padding:'0 4px' }}>×</button></div>))}</div>)}
            <div style={{ display:'flex', gap:8, alignItems:'center' }}><input type="number" step="0.01" min="0" placeholder="Importe (€)" value={jeInput} onChange={e=>setJeInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();const v=parseFloat(jeInput);if(v>0){setJeItems(p=>[...p,v]);setJeInput('')}}}} style={{ ...inp, flex:1, width:'auto', padding:'6px 10px' }} /><button type="button" onClick={()=>{const v=parseFloat(jeInput);if(v>0){setJeItems(p=>[...p,v]);setJeInput('')}}} style={{ padding:'6px 14px', borderRadius:8, background:'#f5a623', color:'#fff', border:'none', cursor:'pointer', fontFamily:FONT.heading, fontSize:14, fontWeight:600, flexShrink:0 }}>+</button></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {FORM_COLS.slice(2).map(c=>{const cc=CANAL_COLORS_M[c.label];return(<div key={c.label} style={{ background:cc?.bg??'#f5f5f5', border:`1px solid ${cc?.border??'#ccc'}`, borderRadius:10, padding:12 }}><p style={{ fontSize:11, fontWeight:600, marginBottom:10, color:cc?.label??'#666', fontFamily:FONT.heading, letterSpacing:1, textTransform:'uppercase' }}>{c.label}</p><div style={{ display:'flex', flexDirection:'column', gap:10 }}><div><label style={{ display:'block', fontSize:10, color:COLORS.mut, marginBottom:4 }}>Pedidos</label><input type="number" min="0" placeholder="0" value={fields[c.ped]} onChange={e=>set(c.ped,e.target.value)} style={inp} /></div><div><label style={{ display:'block', fontSize:10, color:COLORS.mut, marginBottom:4 }}>Bruto (EUR)</label><input type="number" min="0" step="0.01" placeholder="0.00" value={fields[c.bru]} onChange={e=>set(c.bru,e.target.value)} style={inp} /></div></div></div>)})}
          </div>
          {formError&&<p style={{ color:COLORS.err, fontSize:12, margin:0, fontFamily:FONT.body }}>{formError}</p>}
          <div style={{ display:'flex', gap:12, paddingTop:8 }}>
            {isEdit&&(<button type="button" onClick={handleDelete} style={{ flex:1, padding:'10px 16px', borderRadius:8, fontSize:13, fontWeight:600, border:`1px solid ${COLORS.redSL}`, background:'none', color:COLORS.redSL, cursor:'pointer', fontFamily:FONT.body }}>Eliminar</button>)}
            <button type="button" onClick={onClose} style={{ flex:1, padding:'10px 16px', borderRadius:8, fontSize:13, fontWeight:600, border:`0.5px solid ${COLORS.brd}`, background:'none', color:COLORS.mut, cursor:'pointer', fontFamily:FONT.body }}>Cancelar</button>
            <button type="submit" disabled={saving} style={{ flex:1, padding:'10px 16px', borderRadius:8, fontSize:13, fontWeight:600, border:'none', background:COLORS.redSL, color:'#fff', cursor:saving?'not-allowed':'pointer', fontFamily:FONT.body, opacity:saving?0.6:1 }}>{saving?'Guardando...':isEdit?'Actualizar':'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ServicioBadge({ s }: { s:string }) {
  const color = s==='ALM' ? COLORS.warn : s==='CENAS' ? '#7c3aed' : s==='TODO' ? COLOR_TODOS : COLORS.mut
  return (<span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:6, fontFamily:FONT.heading, fontSize:10, letterSpacing:'1.5px', fontWeight:500, textTransform:'uppercase', background:`${color}15`, color }}>{s==='TODO'?'TODOS':s}</span>)
}
function TipoPill({ tipo }: { tipo:TipoDia }) {
  if(tipo==='cerrado'||tipo==='festivo'||tipo==='vacaciones') return (<span style={{ background:COLORS.redSL, color:'#fff', padding:'2px 6px', borderRadius:4, fontSize:9, fontFamily:FONT.heading, letterSpacing:0.5, textTransform:'uppercase' }}>CERRADO</span>)
  if(tipo==='solo_comida') return (<span style={{ background:COLORS.glovo, color:'#111', padding:'2px 6px', borderRadius:4, fontSize:9, fontFamily:FONT.heading, letterSpacing:0.5 }}>ALM</span>)
  if(tipo==='solo_cena') return (<span style={{ background:COLORS.je, color:'#fff', padding:'2px 6px', borderRadius:4, fontSize:9, fontFamily:FONT.heading, letterSpacing:0.5 }}>CENA</span>)
  return null
}
function DesvBadge({ pct }: { pct:number }) {
  const pos=pct>=0; const color=pos?COLORS.ok:COLORS.err
  return (<span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:999, background:`${color}18`, color, fontFamily:FONT.body }}>{pos?'▲':'▼'} {Math.abs(pct).toFixed(1)}%</span>)
}
