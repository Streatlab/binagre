import { AZUL_CL, AMA, BLANCO, GRANATE, INK, NAR, VERDE } from '@/styles/neobrutal'
import { Fragment, useEffect, useState, useMemo, useRef, type FormEvent, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtFechaCorta } from '@/styles/tokens'
import { toLocalDateStr } from '@/lib/dateRange'
import { useCalendario, type TipoDia } from '@/contexts/CalendarioContext'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import TabsPastilla from '@/components/ui/TabsPastilla'
import {
  COLORS, FONT, CARDS,
  kpiBig, lblSm, lblXs,
} from '@/components/panel/resumen/tokens'
import { loadConfigCanales, recargarConfigCanales, loadMarcasPorCanal, type CanalConfig as ConfigCanalRow, type MarcasPorCanal } from '@/lib/panel/calcNetoPlataforma'
import { resolverNeto, loadVentasReales, loadRatiosCalibrados } from '@/lib/panel/netoResolver'
import { useIsMobile } from '@/hooks/useIsMobile'
import SortableHeader, { ClearSortButton } from '@/components/ui/SortableHeader'
import { useMultiSort } from '@/hooks/useMultiSort'

const fmt2 = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits:2, maximumFractionDigits:2, useGrouping:true })
const fmtInt = (n: number) => Math.round(n).toLocaleString('es-ES', { useGrouping:true })
// Acepta indistintamente coma o punto como separador decimal
const parseNum = (s: string): number => { const n = parseFloat(String(s ?? '').trim().replace(',', '.')); return isNaN(n) ? 0 : n }
const parseIntES = (s: string): number => Math.round(parseNum(s))
const fmtBru = fmt2
const fmtTM  = fmt2
const fmtKpi = fmt2

// Reparte un total de Just Eat en n pedidos preservando SIEMPRE el total exacto:
// las n-1 primeras líneas llevan el importe base truncado y la última absorbe el resto.
// Se usa para días antiguos que tienen nº de pedidos y total de JE pero no el detalle importe-a-importe,
// de modo que se vean los pedidos uno a uno sin alterar ni el recuento ni el total (y por tanto el TM).
const repartoJE = (total: number, n: number): number[] => {
  const t = total || 0
  if (n <= 1) return [Number(t.toFixed(2))]
  const base = Math.floor((t / n) * 100) / 100
  const arr = Array.from({ length: n - 1 }, () => base)
  return [...arr, Number((t - base * (n - 1)).toFixed(2))]
}

interface AggRow {
  uber_pedidos: number; uber_bruto: number
  glovo_pedidos: number; glovo_bruto: number
  je_pedidos: number; je_bruto: number
  web_pedidos: number; web_bruto: number
  directa_pedidos: number; directa_bruto: number
  total_pedidos: number; total_bruto: number
}
interface RawDiario extends AggRow { id: number; fecha: string; servicio: string; je_items?: number[] }
interface SemanaGroup extends AggRow { year: number; week: number; periodo: string; dias: number }
interface MesGroup extends AggRow { anio: number; mes: number; dias: number; media_diaria: number; vs_anterior: number | null }

type Tab = 'diario' | 'semanas' | 'meses' | 'anual'
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

const SELECT_DIARIO = 'id,fecha,servicio,uber_pedidos,uber_bruto,glovo_pedidos,glovo_bruto,je_pedidos,je_bruto,web_pedidos,web_bruto,directa_pedidos,directa_bruto,total_pedidos,total_bruto,je_items'
const COLOR_TODOS = COLORS.lun
const AZUL_PED = COLORS.lun
const NARANJA_TM = COLORS.sab
const VERDE_NETO = COLORS.ok
// Línea separadora suave entre filas/columnas (más fina que el borde de las cards)
const LINE = COLORS.group

// ── Estilos de tabla canónicos (lenguaje Panel Global: limpio, sin rellenos por celda) ──
const TH_BASE: CSSProperties = { fontFamily:FONT.heading, fontSize:11, fontWeight:500, letterSpacing:'1.5px', textTransform:'uppercase', color:COLORS.mut, padding:'12px 14px', background:'transparent', borderBottom:`1px solid ${LINE}`, whiteSpace:'nowrap' }
const TD_BASE: CSSProperties = { padding:'11px 14px', fontSize:13, fontFamily:FONT.body, color:COLORS.sec, borderBottom:`1px solid ${LINE}`, whiteSpace:'nowrap', verticalAlign:'middle' }
const NUM_CH: CSSProperties = { fontFamily:FONT.heading, fontWeight:500 }                 // bruto por canal
const NUM_KEY: CSSProperties = { fontFamily:FONT.heading, fontWeight:600, color:COLORS.pri } // columna total
const TFOOT_TR: CSSProperties = { background:COLORS.group }
const TFOOT_TD: CSSProperties = { padding:'12px 14px', fontFamily:FONT.heading, fontSize:14, fontWeight:600, borderTop:`1px solid ${COLORS.brd}` }
const TFOOT_LBL: CSSProperties = { padding:'12px 14px', color:COLORS.sec, fontFamily:FONT.heading, fontSize:11, letterSpacing:'1.5px', textTransform:'uppercase', fontWeight:600, borderTop:`1px solid ${COLORS.brd}` }

const SUBTAB_CONTAINER: CSSProperties = {
  display: 'inline-flex',
  gap: 4,
  padding: '3px 4px',
  borderRadius: 10,
  background: COLORS.accent,
  border: `0.5px solid ${COLORS.accent}`,
}
const SUBTAB_ACTIVE: CSSProperties = {
  padding: '4px 10px', borderRadius: 6, border: 'none',
  background: COLORS.card, color: COLORS.pri,
  fontFamily: FONT.heading, fontSize: 10, fontWeight: 700,
  letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer', outline: 'none',
}
const SUBTAB_INACTIVE: CSSProperties = {
  padding: '4px 10px', borderRadius: 6, border: 'none',
  background: 'rgba(255,255,255,0.25)', color: BLANCO,
  fontFamily: FONT.heading, fontSize: 10, fontWeight: 500,
  letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer', outline: 'none',
}

const NEO_INK = 'var(--neo-ink)'
const NEO_SHADOW = '4px 4px 0 var(--neo-shadow-color)'
const NEO_CARD: CSSProperties = { border: `3px solid ${NEO_INK}`, borderRadius: 0, boxShadow: NEO_SHADOW }

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

export default function Facturacion({ embedded = false }: { embedded?: boolean } = {}) {
  const { tipoDia } = useCalendario()
  const isMobile = useIsMobile()
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
  const [configCanales, setConfigCanales] = useState<Record<string, ConfigCanalRow>>({})
  const [marcasPorCanal, setMarcasPorCanal] = useState<MarcasPorCanal>({ uber: 1, glovo: 1, je: 1, web: 1, dir: 1 })

  useEffect(()=>{
    loadConfigCanales().then(setConfigCanales)
    loadMarcasPorCanal().then(setMarcasPorCanal)
    loadVentasReales().then(() => loadRatiosCalibrados())
    const onCfgChange = () => {
      recargarConfigCanales().then(setConfigCanales)
      loadMarcasPorCanal().then(setMarcasPorCanal)
      setRefreshKey(k=>k+1)
    }
    window.addEventListener('config_canales:changed', onCfgChange)
    return () => window.removeEventListener('config_canales:changed', onCfgChange)
  },[])

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
    const desde=toLocalDateStr(periodoDesde); const hasta=toLocalDateStr(periodoHasta)
    return allData.filter(r=>r.fecha>=desde&&r.fecha<=hasta).filter(r=>servicioFiltro==='Todos'||r.servicio===servicioFiltro)
  },[allData,periodoDesde,periodoHasta,servicioFiltro])

  const totals = useMemo(()=>aggregate(filteredData),[filteredData])
  const dias = useMemo(()=>new Set(filteredData.map(r=>r.fecha)).size,[filteredData])
  const netoEstimado = useMemo(()=>{
    const canales: { id:string; bruto:number; pedidos:number }[] = [
      { id:'uber',  bruto:totals.uber_bruto,    pedidos:totals.uber_pedidos },
      { id:'glovo', bruto:totals.glovo_bruto,   pedidos:totals.glovo_pedidos },
      { id:'je',    bruto:totals.je_bruto,      pedidos:totals.je_pedidos },
      { id:'web',   bruto:totals.web_bruto,     pedidos:totals.web_pedidos },
      { id:'dir',   bruto:totals.directa_bruto, pedidos:totals.directa_pedidos },
    ]
    return canales.reduce((acc,c)=> acc + resolverNeto(c.id, c.bruto, c.pedidos, { modo:'agregado_canal', marcasPorCanal, fechaDesde:periodoDesde, fechaHasta:periodoHasta, configCanales, diasConDatos:dias }).neto, 0)
  },[totals, marcasPorCanal, periodoDesde, periodoHasta, configCanales, dias])
  const tm = totals.total_pedidos>0?totals.total_bruto/totals.total_pedidos:0
  const tmNeto = totals.total_pedidos>0?netoEstimado/totals.total_pedidos:0
  const mediadiaria = dias>0?totals.total_bruto/dias:0
  const mediaDiariaNeta = dias>0?netoEstimado/dias:0

  const ultimoDiaConDatos = useMemo(()=>{
    if(allData.length===0) return null
    return allData.reduce((max,r)=>r.fecha>max?r.fecha:max, allData[0].fecha)
  },[allData])

  const toggleCanal=(id: CanalId)=>{
    setCanalesVisibles(prev=>{
      if(prev.includes(id)){ const next=prev.filter(x=>x!==id); return next.length===0?prev:next }
      return [...prev,id]
    })
  }

  return (
    <div style={{ background: embedded ? 'transparent' : 'var(--neo-bg)', minHeight: embedded ? 'auto' : '100vh', padding: embedded ? 0 : (isMobile ? '14px 12px' : '24px 28px'), fontFamily:FONT.body, color:COLORS.pri }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:18, flexWrap:'wrap', gap:12 }}>
        <div>
          {!embedded && <div style={{ fontFamily:FONT.heading, fontSize:22, fontWeight:600, color:COLORS.redSL, letterSpacing:3, textTransform:'uppercase' }}>FACTURACIÓN</div>}
          <div style={{ fontFamily:FONT.body, fontSize:13, color:COLORS.mut, marginTop:2 }}>
            {fmtFechaCorta(toLocalDateStr(periodoDesde))} — {fmtFechaCorta(toLocalDateStr(periodoHasta))}
          </div>
          {ultimoDiaConDatos && (
            <div style={{ fontFamily:FONT.body, fontSize:11, color:COLORS.mut, marginTop:2 }}>
              Último día con datos: {fmtFechaCorta(ultimoDiaConDatos)}
            </div>
          )}
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

interface KpiCardsProps { totals:AggRow; dias:number; tm:number; tmNeto:number; netoEstimado:number; mediadiaria:number; mediaDiariaNeta:number; onAdd:()=>void; onExport?:()=>void }
function KpiCards({ totals, dias, tm, tmNeto, netoEstimado, mediadiaria, mediaDiariaNeta, onAdd, onExport }: KpiCardsProps) {
  const isMobile = useIsMobile()
  const netoLabel = totals.total_bruto > 0 ? `NETO EST. · ${((netoEstimado/totals.total_bruto)*100).toFixed(0)}%` : 'NETO EST.'
  const cardEvo: CSSProperties = { background:COLORS.card, ...NEO_CARD, padding: isMobile ? '16px 16px' : '18px 20px' }
  const lblS: CSSProperties = { fontFamily:FONT.heading, fontSize:11, letterSpacing:'2px', textTransform:'uppercase', color:COLORS.mut }
  return (
    <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 25%', gap:14, marginBottom:14, alignItems:'stretch' }}>
      <div style={cardEvo}>
        <div style={{ ...lblS, marginBottom:12 }}>Facturación</div>
        <div style={{ display:'flex', alignItems:'baseline', gap:18, flexWrap:'wrap' }}>
          <div><div style={{ fontFamily:FONT.heading, fontSize:34, fontWeight:600, color:COLORS.pri, lineHeight:1 }}>{fmtKpi(totals.total_bruto)}</div><div style={{ ...lblXs, marginTop:4 }}>BRUTO</div></div>
          <div><div style={{ fontFamily:FONT.heading, fontSize:34, fontWeight:600, color:VERDE_NETO, lineHeight:1 }}>{fmtKpi(netoEstimado)}</div><div style={{ fontFamily:FONT.heading, fontSize:10, letterSpacing:'1.5px', textTransform:'uppercase', color:VERDE_NETO, fontWeight:500, marginTop:4 }}>{netoLabel}</div></div>
        </div>
        <div style={{ display:'flex', alignItems:'baseline', gap:18, marginTop:16, flexWrap:'wrap' }}>
          <div><div style={{ fontFamily:FONT.heading, fontSize:22, fontWeight:600, color:COLORS.sec, lineHeight:1 }}>{fmtKpi(mediadiaria)}</div><div style={{ ...lblXs, marginTop:4 }}>MEDIA/DÍA</div></div>
          <div><div style={{ fontFamily:FONT.heading, fontSize:22, fontWeight:600, color:VERDE_NETO, lineHeight:1 }}>{fmtKpi(mediaDiariaNeta)}</div><div style={{ fontFamily:FONT.heading, fontSize:10, letterSpacing:'1.5px', textTransform:'uppercase', color:VERDE_NETO, fontWeight:500, marginTop:4 }}>MEDIA/DÍA NETA</div></div>
          <div><div style={{ fontFamily:FONT.heading, fontSize:22, fontWeight:600, color:COLORS.mut, lineHeight:1 }}>{dias}</div><div style={{ ...lblXs, marginTop:4 }}>DÍAS</div></div>
        </div>
      </div>

      <div style={cardEvo}>
        <div style={{ ...lblS, marginBottom:12 }}>Pedidos · Ticket medio</div>
        <div style={{ display:'flex', alignItems:'baseline', gap:18, flexWrap:'wrap' }}>
          <div><div style={{ fontFamily:FONT.heading, fontSize:34, fontWeight:600, color:AZUL_PED, lineHeight:1 }}>{fmtInt(totals.total_pedidos)}</div><div style={{ fontFamily:FONT.heading, fontSize:10, letterSpacing:'1.5px', textTransform:'uppercase', color:AZUL_PED, fontWeight:500, marginTop:4 }}>PEDIDOS</div></div>
          <div><div style={{ fontFamily:FONT.heading, fontSize:34, fontWeight:600, color:NARANJA_TM, lineHeight:1 }}>{fmtTM(tm)}</div><div style={{ fontFamily:FONT.heading, fontSize:10, letterSpacing:'1.5px', textTransform:'uppercase', color:NARANJA_TM, fontWeight:500, marginTop:4 }}>TM BRUTO</div></div>
          <div><div style={{ fontFamily:FONT.heading, fontSize:34, fontWeight:600, color:VERDE_NETO, lineHeight:1 }}>{fmtTM(tmNeto)}</div><div style={{ fontFamily:FONT.heading, fontSize:10, letterSpacing:'1.5px', textTransform:'uppercase', color:VERDE_NETO, fontWeight:500, marginTop:4 }}>TM NETO</div></div>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <div onClick={onAdd} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')onAdd()}}
          style={{ flex:'0 0 70%', ...cardEvo, background:COLORS.redSL, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, userSelect:'none' }}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity='0.88'}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity='1'}}>
          <span style={{ fontSize:20, lineHeight:1, color:BLANCO }}>↑</span>
          <div style={{ fontFamily:FONT.heading, fontSize:12, fontWeight:600, letterSpacing:'2px', color:BLANCO, textTransform:'uppercase' }}>AÑADIR DÍA</div>
          <div style={{ fontFamily:FONT.body, fontSize:10, color:'rgba(255,255,255,0.72)' }}>Fecha · Canales</div>
        </div>
        {onExport && (
          <button onClick={onExport}
            style={{ flex:'0 0 30%', ...cardEvo, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:FONT.body, fontSize:12, color:COLORS.mut, fontWeight:500, background:COLORS.card }}>
            <span style={{ fontSize:13 }}>↓</span> Exportar CSV
          </button>
        )}
      </div>
    </div>
  )
}

function TabDiario({ allData, cols, weekFilter, onEdit, onAdd, tipoDia, totals, dias, tm, tmNeto, netoEstimado, mediadiaria, mediaDiariaNeta }: { allData:RawDiario[]; cols:typeof ALL_COLS; weekFilter:{year:number;week:number}|null; onEdit:(r:RawDiario)=>void; onAdd:()=>void; tipoDia:(f:string)=>TipoDia; totals:AggRow; dias:number; tm:number; tmNeto:number; netoEstimado:number; mediadiaria:number; mediaDiariaNeta:number }) {
  const ms = useMultiSort('facturacion_diario')
  const rows = useMemo(()=>{
    let data=allData
    if(weekFilter){ const [from,to]=weekBounds(weekFilter.year,weekFilter.week); data=data.filter(r=>r.fecha>=from&&r.fecha<=to) }
    const getters: Record<string, (r: RawDiario) => any> = {
      fecha: r => r.fecha, serv: r => r.servicio,
      uber: r => r.uber_bruto, glovo: r => r.glovo_bruto, je: r => r.je_bruto,
      web: r => r.web_bruto, dir: r => r.directa_bruto, total: r => r.total_bruto,
    }
    const ordered = ms.sorts.length > 0 ? ms.applySort([...data], getters) : [...data].sort((a,b)=>b.fecha.localeCompare(a.fecha))
    return ordered
  },[allData,weekFilter,ms.sorts])
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
  // Celda base (sin relleno por canal): texto limpio, línea inferior suave
  const td = (extra?: CSSProperties): CSSProperties => ({ ...TD_BASE, ...extra })
  const bb = (isLast:boolean): CSSProperties => ({ borderBottom: isLast ? 'none' : `1px solid ${LINE}` })
  const sep: CSSProperties = { borderLeft:`1px solid ${LINE}` } // separador suave entre grupos de canal
  if(allData.length===0) return (<><KpiCards totals={totals} dias={dias} tm={tm} tmNeto={tmNeto} netoEstimado={netoEstimado} mediadiaria={mediadiaria} mediaDiariaNeta={mediaDiariaNeta} onAdd={onAdd} onExport={exportar} /><div style={{ ...CARDS.std, padding:48, textAlign:'center', fontFamily:FONT.body, fontSize:13, color:COLORS.mut }}>Sin datos en este periodo</div></>)
  return (
    <>
      <KpiCards totals={totals} dias={dias} tm={tm} tmNeto={tmNeto} netoEstimado={netoEstimado} mediadiaria={mediadiaria} mediaDiariaNeta={mediaDiariaNeta} onAdd={onAdd} onExport={exportar} />
      {ms.showClearButton && <div style={{marginBottom:10}}><ClearSortButton show={true} onClear={ms.clearSorts} /></div>}
      {weekFilter && <div style={{ marginBottom:10 }}><span style={{ padding:'4px 10px', background:`${COLORS.redSL}12`, color:COLORS.redSL, borderRadius:8, border:`0.5px solid ${COLORS.redSL}30`, fontFamily:FONT.body, fontSize:12 }}>S{weekFilter.week}</span></div>}
      <div style={{ ...CARDS.std, ...NEO_CARD, padding:0, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', whiteSpace:'nowrap', minWidth:860 }}>
            <thead>
              <tr>
                <SortableHeader col="fecha" label="Fecha" sortIndex={ms.sortIndex('fecha')} sortDir={ms.sortDir('fecha')} onToggle={ms.toggleSort} align="left" rowSpan={2} style={{ background:'transparent', paddingLeft:18 }} />
                <SortableHeader col="serv" label="Serv." sortIndex={ms.sortIndex('serv')} sortDir={ms.sortDir('serv')} onToggle={ms.toggleSort} align="left" rowSpan={2} style={{ background:'transparent' }} />
                {cols.map(c=>(<SortableHeader key={c.id} col={c.id} label={c.label} sortIndex={ms.sortIndex(c.id)} sortDir={ms.sortDir(c.id)} onToggle={ms.toggleSort} align="center" colSpan={2} style={{ background:'transparent', color:c.color, borderBottom:`2px solid ${c.color}`, borderLeft:`1px solid ${LINE}` }} />))}
                <SortableHeader col="total" label="Total" sortIndex={ms.sortIndex('total')} sortDir={ms.sortDir('total')} onToggle={ms.toggleSort} align="center" colSpan={2} style={{ background:'transparent', borderBottom:`2px solid ${COLORS.pri}`, borderLeft:`1px solid ${LINE}` }} />
              </tr>
              <tr>
                {cols.map(c=>(<Fragment key={c.id}><th style={{ ...TH_BASE, ...sep, padding:'7px 14px', textAlign:'center', fontSize:9, letterSpacing:'1px' }}>Ped</th><th style={{ ...TH_BASE, padding:'7px 14px', textAlign:'right', fontSize:9, letterSpacing:'1px' }}>Bruto</th></Fragment>))}
                <th style={{ ...TH_BASE, ...sep, padding:'7px 14px', textAlign:'center', fontSize:9, letterSpacing:'1px', color:COLORS.sec }}>Ped</th>
                <th style={{ ...TH_BASE, padding:'7px 14px', textAlign:'right', fontSize:9, letterSpacing:'1px', color:COLORS.sec }}>Bruto</th>
              </tr>
            </thead>
            <tbody>
              {rowsConSub.map((item,idx)=>{
                if(item.type==='subtotal'){
                  const s=item.agg; const isLast=idx===rowsConSub.length-1
                  return (<tr key={`sub-${item.fecha}`} style={{ background:`${COLOR_TODOS}06` }}>
                    <td style={td({ ...bb(isLast), color:COLORS.mut, fontSize:12, paddingLeft:18 })}>{fmtFechaCorta(item.fecha)}</td>
                    <td style={td(bb(isLast))}><ServicioBadge s="TODO" /></td>
                    {cols.map(c=>{ const p=(s[c.ped] as number)||0; const b=(s[c.bru] as number)||0; return (<Fragment key={c.id}><td style={td({ ...bb(isLast), ...sep, textAlign:'center', color:p>0?COLORS.sec:COLORS.mut })}>{p>0?fmtInt(p):'—'}</td><td style={td({ ...bb(isLast), ...NUM_CH, textAlign:'right', color:b>0?COLORS.sec:COLORS.mut })}>{b>0?fmtBru(b):'—'}</td></Fragment>) })}
                    <td style={td({ ...bb(isLast), ...sep, textAlign:'center', color:COLORS.sec })}>{fmtInt(s.total_pedidos)}</td>
                    <td style={td({ ...bb(isLast), ...NUM_KEY, textAlign:'right' })}>{fmtBru(s.total_bruto)}</td>
                  </tr>)
                }
                const {r}=item; const tipo=tipoDia(r.fecha); const esCerrado=tipo==='cerrado'||tipo==='festivo'||tipo==='vacaciones'; const isLast=idx===rowsConSub.length-1
                return (<tr key={r.id} onClick={()=>onEdit(r)} style={{ cursor:'pointer', opacity:esCerrado?0.6:1, transition:'background 120ms' }} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=COLORS.bg}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=''}}>
                  <td style={td({ ...bb(isLast), color:COLORS.mut, fontSize:12, paddingLeft:18 })}><div style={{ display:'flex', alignItems:'center', gap:6 }}>{fmtFechaCorta(r.fecha)}<TipoPill tipo={tipo} /></div></td>
                  <td style={td(bb(isLast))}><ServicioBadge s={r.servicio} /></td>
                  {cols.map(c=>{ const p=(r[c.ped] as number)||0; const b=(r[c.bru] as number)||0; return (<Fragment key={c.id}><td style={td({ ...bb(isLast), ...sep, textAlign:'center', color:p>0?COLORS.sec:COLORS.mut })}>{p>0?fmtInt(p):'—'}</td><td style={td({ ...bb(isLast), ...NUM_CH, textAlign:'right', color:b>0?COLORS.sec:COLORS.mut })}>{b>0?fmtBru(b):'—'}</td></Fragment>) })}
                  <td style={td({ ...bb(isLast), ...sep, textAlign:'center', color:COLORS.sec })}>{fmtInt(r.total_pedidos)}</td>
                  <td style={td({ ...bb(isLast), ...NUM_KEY, textAlign:'right' })}>{fmtBru(r.total_bruto)}</td>
                </tr>)
              })}
            </tbody>
            <tfoot>
              <tr style={TFOOT_TR}>
                <td style={{ ...TFOOT_LBL, paddingLeft:18 }} colSpan={2}>Total</td>
                {cols.map(c=>(<Fragment key={c.id}><td style={{ ...TFOOT_TD, ...sep, textAlign:'center', color:c.color }}>{fmtInt(rowTotals[c.ped] as number)}</td><td style={{ ...TFOOT_TD, textAlign:'right', color:c.color }}>{fmtBru(rowTotals[c.bru] as number)}</td></Fragment>))}
                <td style={{ ...TFOOT_TD, ...sep, textAlign:'center', color:COLORS.sec }}>{fmtInt(rowTotals.total_pedidos)}</td>
                <td style={{ ...TFOOT_TD, textAlign:'right', color:COLORS.pri }}>{fmtBru(rowTotals.total_bruto)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  )
}

function TabSemanas({ allData, cols, onDrill, totals, dias, tm, tmNeto, netoEstimado, mediadiaria, mediaDiariaNeta, onAdd }: { allData:RawDiario[]; cols:typeof ALL_COLS; onDrill:(y:number,w:number)=>void; totals:AggRow; dias:number; tm:number; tmNeto:number; netoEstimado:number; mediadiaria:number; mediaDiariaNeta:number; onAdd:()=>void }) {
  const rows = useMemo(()=>buildSemanas(allData).slice(0,12),[allData])
  const exportar=()=>{ downloadCSV('facturacion_semanas.csv',['Semana','Periodo','Dias',...cols.map(c=>c.label),'Total Ped','Total Bruto'],rows.map(r=>[`S${r.week}`,r.periodo,r.dias,...cols.map(c=>r[c.bru] as number),r.total_pedidos,r.total_bruto])) }
  const bb = (isLast:boolean): CSSProperties => ({ borderBottom: isLast ? 'none' : `1px solid ${LINE}` })
  if(rows.length===0) return (<><KpiCards totals={totals} dias={dias} tm={tm} tmNeto={tmNeto} netoEstimado={netoEstimado} mediadiaria={mediadiaria} mediaDiariaNeta={mediaDiariaNeta} onAdd={onAdd} onExport={exportar} /><div style={{ ...CARDS.std, padding:48, textAlign:'center', fontFamily:FONT.body, fontSize:13, color:COLORS.mut }}>Sin datos en este periodo</div></>)
  return (
    <>
      <KpiCards totals={totals} dias={dias} tm={tm} tmNeto={tmNeto} netoEstimado={netoEstimado} mediadiaria={mediadiaria} mediaDiariaNeta={mediaDiariaNeta} onAdd={onAdd} onExport={exportar} />
      <div style={{ ...CARDS.std, ...NEO_CARD, padding:0, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', whiteSpace:'nowrap' }}>
            <thead><tr><th style={TH_BASE}>Sem</th><th style={TH_BASE}>Periodo</th><th style={{ ...TH_BASE, textAlign:'center' }}>Días</th>{cols.map(c=><th key={c.id} style={{ ...TH_BASE, color:c.color, textAlign:'right' }}>{c.label}</th>)}<th style={{ ...TH_BASE, color:COLORS.sec, textAlign:'right' }}>Total</th></tr></thead>
            <tbody>
              {rows.map((r,idx)=>(<tr key={`${r.year}-${r.week}`} onClick={()=>onDrill(r.year,r.week)} style={{ cursor:'pointer', transition:'background 120ms' }} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=COLORS.bg}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=''}}>
                <td style={{ ...TD_BASE, ...bb(idx===rows.length-1), fontFamily:FONT.heading, fontWeight:600, color:COLORS.pri }}>S{r.week}</td>
                <td style={{ ...TD_BASE, ...bb(idx===rows.length-1), color:COLORS.mut }}>{r.periodo}</td>
                <td style={{ ...TD_BASE, ...bb(idx===rows.length-1), textAlign:'center', color:COLORS.mut }}>{r.dias}</td>
                {cols.map(c=>(<td key={c.id} style={{ ...TD_BASE, ...bb(idx===rows.length-1), ...NUM_CH, textAlign:'right', color:(r[c.bru] as number)>0?COLORS.sec:COLORS.mut }}>{(r[c.bru] as number)>0?fmtBru(r[c.bru] as number):'—'}</td>))}
                <td style={{ ...TD_BASE, ...bb(idx===rows.length-1), ...NUM_KEY, textAlign:'right' }}>{fmtBru(r.total_bruto)}</td>
              </tr>))}
            </tbody>
            <tfoot><tr style={TFOOT_TR}><td style={TFOOT_LBL} colSpan={3}>Total</td>{cols.map(c=>(<td key={c.id} style={{ ...TFOOT_TD, textAlign:'right', color:c.color }}>{fmtBru(totals[c.bru] as number)}</td>))}<td style={{ ...TFOOT_TD, textAlign:'right', color:COLORS.pri }}>{fmtBru(totals.total_bruto)}</td></tr></tfoot>
          </table>
        </div>
      </div>
      <p style={{ fontSize:10, color:COLORS.mut, marginTop:8, fontFamily:FONT.body }}>Haz clic en una semana para ver el detalle diario</p>
    </>
  )
}

function TabMeses({ allData, cols, totals, dias, tm, tmNeto, netoEstimado, mediadiaria, mediaDiariaNeta, onAdd }: { allData:RawDiario[]; cols:typeof ALL_COLS; totals:AggRow; dias:number; tm:number; tmNeto:number; netoEstimado:number; mediadiaria:number; mediaDiariaNeta:number; onAdd:()=>void }) {
  const allRows = useMemo(()=>buildMeses(allData),[allData])
  const years = useMemo(()=>{const s=new Set(allRows.map(r=>r.anio));return [...s].sort((a,b)=>b-a)},[allRows])
  const [selYear,setSelYear]=useState(new Date().getFullYear())
  useEffect(()=>{if(years.length>0&&!years.includes(selYear))setSelYear(years[0])},[years,selYear])
  const rows=useMemo(()=>allRows.filter(r=>r.anio===selYear),[allRows,selYear])
  const yearTotal=useMemo(()=>{ const a=aggregate(allData.filter(r=>r.fecha.startsWith(String(selYear)))); const d=new Set(allData.filter(r=>r.fecha.startsWith(String(selYear))).map(r=>r.fecha)).size; return{...a,dias:d} },[allData,selYear])
  const exportar=()=>{ downloadCSV(`facturacion_meses_${selYear}.csv`,['Mes','Dias',...cols.map(c=>c.label),'Total Ped','Total Bruto','Media Diaria','vs Anterior'],rows.map(r=>{const vs=r.vs_anterior!==null?r.vs_anterior.toFixed(1)+'%':'';return[MES_NOMBRE[r.mes],r.dias,...cols.map(c=>r[c.bru] as number),r.total_pedidos,r.total_bruto,r.media_diaria.toFixed(2),vs]})) }
  const bb = (isLast:boolean): CSSProperties => ({ borderBottom: isLast ? 'none' : `1px solid ${LINE}` })
  if(allRows.length===0) return (<><KpiCards totals={totals} dias={dias} tm={tm} tmNeto={tmNeto} netoEstimado={netoEstimado} mediadiaria={mediadiaria} mediaDiariaNeta={mediaDiariaNeta} onAdd={onAdd} onExport={exportar} /><div style={{ ...CARDS.std, padding:48, textAlign:'center', fontFamily:FONT.body, fontSize:13, color:COLORS.mut }}>Sin datos en este periodo</div></>)
  return (
    <>
      <KpiCards totals={totals} dias={dias} tm={tm} tmNeto={tmNeto} netoEstimado={netoEstimado} mediadiaria={mediadiaria} mediaDiariaNeta={mediaDiariaNeta} onAdd={onAdd} onExport={exportar} />
      {years.length>1&&(<div style={{ marginBottom:12 }}><select value={selYear} onChange={e=>setSelYear(Number(e.target.value))} style={{ padding:'9px 14px', borderRadius:10, border:`0.5px solid ${COLORS.brd}`, background:COLORS.card, fontFamily:FONT.body, fontSize:13, color:COLORS.sec, cursor:'pointer' }}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></div>)}
      <div style={{ ...CARDS.std, ...NEO_CARD, padding:0, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', whiteSpace:'nowrap' }}>
            <thead><tr><th style={TH_BASE}>Mes</th><th style={{ ...TH_BASE, textAlign:'center' }}>Días</th>{cols.map(c=><th key={c.id} style={{ ...TH_BASE, color:c.color, textAlign:'right' }}>{c.label}</th>)}<th style={{ ...TH_BASE, color:COLORS.sec, textAlign:'right' }}>Total</th><th style={{ ...TH_BASE, textAlign:'right' }}>Media/día</th><th style={{ ...TH_BASE, textAlign:'right' }}>vs Anterior</th></tr></thead>
            <tbody>
              {rows.map((r,idx)=>(<tr key={r.mes} style={{ transition:'background 120ms' }} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=COLORS.bg}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=''}}>
                <td style={{ ...TD_BASE, ...bb(idx===rows.length-1), fontFamily:FONT.heading, fontWeight:600, color:COLORS.pri }}>{MES_NOMBRE[r.mes]}</td>
                <td style={{ ...TD_BASE, ...bb(idx===rows.length-1), textAlign:'center', color:COLORS.mut }}>{r.dias}</td>
                {cols.map(c=>(<td key={c.id} style={{ ...TD_BASE, ...bb(idx===rows.length-1), ...NUM_CH, textAlign:'right', color:(r[c.bru] as number)>0?COLORS.sec:COLORS.mut }}>{(r[c.bru] as number)>0?fmtBru(r[c.bru] as number):'—'}</td>))}
                <td style={{ ...TD_BASE, ...bb(idx===rows.length-1), ...NUM_KEY, textAlign:'right' }}>{fmtBru(r.total_bruto)}</td>
                <td style={{ ...TD_BASE, ...bb(idx===rows.length-1), textAlign:'right', color:COLORS.mut }}>{r.dias>0?fmtBru(r.media_diaria):'—'}</td>
                <td style={{ ...TD_BASE, ...bb(idx===rows.length-1), textAlign:'right' }}>{r.vs_anterior!==null?<DesvBadge pct={r.vs_anterior} />:<span style={{ color:COLORS.mut }}>—</span>}</td>
              </tr>))}
            </tbody>
            <tfoot><tr style={TFOOT_TR}><td style={TFOOT_LBL} colSpan={2}>{selYear} Total</td>{cols.map(c=>(<td key={c.id} style={{ ...TFOOT_TD, textAlign:'right', color:c.color }}>{fmtBru(yearTotal[c.bru] as number)}</td>))}<td style={{ ...TFOOT_TD, textAlign:'right', color:COLORS.pri }}>{fmtBru(yearTotal.total_bruto)}</td><td style={{ ...TFOOT_TD, textAlign:'right', color:COLORS.sec }}>{yearTotal.dias>0?fmtBru(yearTotal.total_bruto/yearTotal.dias):'—'}</td><td style={{ ...TFOOT_TD }} /></tr></tfoot>
          </table>
        </div>
      </div>
    </>
  )
}

function TabAnual({ allData, totals, dias, tm, tmNeto, netoEstimado, mediadiaria, mediaDiariaNeta, onAdd }: { allData:RawDiario[]; totals:AggRow; dias:number; tm:number; tmNeto:number; netoEstimado:number; mediadiaria:number; mediaDiariaNeta:number; onAdd:()=>void }) {
  const years = useMemo(()=>{ const m=new Map<number,{bruto:number;pedidos:number}>(); for(const r of allData){ const y=parseInt(r.fecha.slice(0,4)); if(!m.has(y))m.set(y,{bruto:0,pedidos:0}); const c=m.get(y)!; c.bruto+=r.total_bruto||0; c.pedidos+=r.total_pedidos||0 }; return [...m.entries()].sort((a,b)=>b[0]-a[0]).map(([anio,v])=>({anio,bruto:v.bruto,pedidos:v.pedidos,mediaMensual:v.bruto/12,mediaTicket:v.pedidos>0?v.bruto/v.pedidos:0})) },[allData])
  const maxBruto=Math.max(...years.map(y=>y.bruto),1)
  const exportar=()=>{ downloadCSV('facturacion_anual.csv',['Año','Bruto','Media mensual','Pedidos','Ticket medio'],years.map(y=>[y.anio,y.bruto,y.mediaMensual,y.pedidos,y.mediaTicket])) }
  const bb = (isLast:boolean): CSSProperties => ({ borderBottom: isLast ? 'none' : `1px solid ${LINE}` })
  return (
    <div>
      <KpiCards totals={totals} dias={dias} tm={tm} tmNeto={tmNeto} netoEstimado={netoEstimado} mediadiaria={mediadiaria} mediaDiariaNeta={mediaDiariaNeta} onAdd={onAdd} onExport={exportar} />
      <div style={{ ...CARDS.std, ...NEO_CARD, padding:0, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr><th style={TH_BASE}>Año</th><th style={{ ...TH_BASE, textAlign:'right' }}>Facturación bruta</th><th style={TH_BASE}>vs año anterior</th><th style={{ ...TH_BASE, textAlign:'right' }}>Media mensual</th><th style={{ ...TH_BASE, textAlign:'right' }}>Pedidos</th><th style={{ ...TH_BASE, textAlign:'right' }}>Ticket medio</th></tr></thead>
          <tbody>
            {years.map((y,idx)=>{ const prev=years[idx+1]; const delta=prev?((y.bruto-prev.bruto)/prev.bruto)*100:null; const barW=`${Math.round((y.bruto/maxBruto)*100)}%`
              return (<tr key={y.anio} style={{ transition:'background 120ms' }} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=COLORS.bg}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=''}}>
                <td style={{ ...TD_BASE, ...bb(idx===years.length-1), fontFamily:FONT.heading, color:COLORS.redSL, fontWeight:600, fontSize:15 }}>{y.anio}</td>
                <td style={{ ...TD_BASE, ...bb(idx===years.length-1), textAlign:'right' }}><div style={{ fontFamily:FONT.heading, fontSize:15, fontWeight:600, color:COLORS.pri, marginBottom:5 }}>{fmtBru(y.bruto)}</div><div style={{ height:5, background:COLORS.group, borderRadius:3, overflow:'hidden' }}><div style={{ height:5, width:barW, background:COLORS.redSL, borderRadius:3 }} /></div></td>
                <td style={{ ...TD_BASE, ...bb(idx===years.length-1) }}>{delta!=null?<DesvBadge pct={delta} />:<span style={{ color:COLORS.mut }}>—</span>}</td>
                <td style={{ ...TD_BASE, ...bb(idx===years.length-1), ...NUM_CH, textAlign:'right', color:COLORS.sec }}>{fmtBru(y.mediaMensual)}</td>
                <td style={{ ...TD_BASE, ...bb(idx===years.length-1), textAlign:'right', color:COLORS.mut }}>{fmtInt(y.pedidos)}</td>
                <td style={{ ...TD_BASE, ...bb(idx===years.length-1), ...NUM_CH, textAlign:'right', color:COLORS.sec }}>{fmtTM(y.mediaTicket)}</td>
              </tr>)
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface FormFields { uber_pedidos:string;uber_bruto:string;glovo_pedidos:string;glovo_bruto:string;je_ped:string;je_bru:string;web_pedidos:string;web_bruto:string;directa_ped:string;directa_bru:string }
const FORM_COLS: { label:string; ped:keyof FormFields; bru:keyof FormFields }[] = [{label:'Uber Eats',ped:'uber_pedidos',bru:'uber_bruto'},{label:'Glovo',ped:'glovo_pedidos',bru:'glovo_bruto'},{label:'Web',ped:'web_pedidos',bru:'web_bruto'},{label:'Venta Directa',ped:'directa_ped',bru:'directa_bru'}]
const CANAL_COLORS_M: Record<string,{bg:string;border:string;label:string}> = {'Uber Eats':{bg:`${VERDE}12`,border:VERDE,label:VERDE},'Glovo':{bg:`${AMA}18`,border:INK,label:INK},'Web':{bg:`${GRANATE}12`,border:GRANATE,label:GRANATE},'Venta Directa':{bg:`${AZUL_CL}12`,border:AZUL_CL,label:AZUL_CL}}

type JeItem = { raw:string; alm:boolean }

function DayModal({ allData, existing, onClose, onSaved }: { allData:RawDiario[]; existing?:RawDiario; onClose:()=>void; onSaved:()=>void }) {
  const isEdit=!!existing
  const hoy=toLocalDateStr(new Date())
  const almDe=(f:string)=>allData.find(r=>r.fecha===f&&r.servicio==='ALM'&&r.id!==existing?.id)
  const [fecha,setFecha]=useState(existing?.fecha??hoy)
  // Autoselección: si ya existe fila ALM del día y es un alta nueva -> abrir directamente en CENAS/ALM
  const [servicio,setServicio]=useState<string>(()=> existing?.servicio ?? (almDe(existing?.fecha??hoy)?'CENAS_ALM':'ALM'))
  const [fields,setFields]=useState<FormFields>(()=>{ if(!existing) return {uber_pedidos:'',uber_bruto:'',glovo_pedidos:'',glovo_bruto:'',je_ped:'',je_bru:'',web_pedidos:'',web_bruto:'',directa_ped:'0',directa_bru:'0.00'}; return {uber_pedidos:String(existing.uber_pedidos||''),uber_bruto:String(existing.uber_bruto||''),glovo_pedidos:String(existing.glovo_pedidos||''),glovo_bruto:String(existing.glovo_bruto||''),je_ped:String(existing.je_pedidos||''),je_bru:String(existing.je_bruto||''),web_pedidos:String(existing.web_pedidos||''),web_bruto:String(existing.web_bruto||''),directa_ped:String(existing.directa_pedidos||0),directa_bru:String(existing.directa_bruto||0)} })
  const [saving,setSaving]=useState(false)
  const [formError,setFormError]=useState<string|null>(null)
  const [jeItems,setJeItems]=useState<JeItem[]>(()=>{
    if(existing){
      if(Array.isArray(existing.je_items)&&existing.je_items.length>0) return existing.je_items.map(v=>({raw:String(Number(v)),alm:false}))
      // Día antiguo con nº de pedidos y total de JE pero sin detalle guardado: lo mostramos pedido a pedido
      // repartiendo el total de forma exacta (preserva recuento y total -> el ticket medio no se falsea).
      if((existing.je_bruto??0)>0) return repartoJE(existing.je_bruto??0, existing.je_pedidos||1).map(v=>({raw:String(v),alm:false}))
    }
    return []
  })
  const [jeInput,setJeInput]=useState('')
  const jeRef=useRef<HTMLInputElement|null>(null)
  const jeOrig = { count: Number(existing?.je_pedidos ?? 0), bruto: Number(existing?.je_bruto ?? 0), hadItems: !!(existing && Array.isArray(existing.je_items) && existing.je_items.length>0) }

  const filaAlm=useMemo(()=>allData.find(r=>r.fecha===fecha&&r.servicio==='ALM'&&r.id!==existing?.id),[allData,fecha,existing?.id])
  const esCenasAlm=servicio==='CENAS_ALM'

  // Al activar CENAS/ALM precargamos los pedidos JE del almuerzo: cada uno en su línea, visibles, editables y persistentes
  // (se mantienen en su fila ALM, no se duplican en la cena). Si el almuerzo tiene varios pedidos pero no se guardó el
  // detalle importe-a-importe, se reparte el total de forma exacta para verlos uno a uno sin alterar recuento ni total.
  useEffect(()=>{
    if(isEdit) return
    if(esCenasAlm&&filaAlm){
      const njAlm=filaAlm.je_pedidos||0; const jbAlm=filaAlm.je_bruto??0
      const ref:JeItem[]=(Array.isArray(filaAlm.je_items)&&filaAlm.je_items.length>0)
        ? filaAlm.je_items.map(v=>({raw:String(Number(v)),alm:true}))
        : (jbAlm>0 ? repartoJE(jbAlm, njAlm||1).map(v=>({raw:String(v),alm:true})) : [])
      setJeItems(prev=>[...ref,...prev.filter(i=>!i.alm)])
    } else {
      setJeItems(prev=>prev.filter(i=>!i.alm))
    }
  },[esCenasAlm,filaAlm,isEdit])

  // El total JE editable refleja solo los pedidos de la CENA (los del almuerzo viven en su propia fila ALM)
  useEffect(()=>{ const ed=jeItems.filter(i=>!i.alm); const t=ed.reduce((a,b)=>a+parseNum(b.raw),0); setFields(f=>({...f,je_ped:String(ed.length),je_bru:t.toFixed(2)})) },[jeItems])

  const set=(k:keyof FormFields,v:string)=>setFields(p=>({...p,[k]:v}))
  const addJe=()=>{ const v=parseNum(jeInput); if(v>0){ setJeItems(p=>[...p,{raw:String(v),alm:false}]); setJeInput(''); requestAnimationFrame(()=>jeRef.current?.focus()) } }

  const almByLabel:Record<string,{p:number;b:number}>={
    'Uber Eats':{p:filaAlm?.uber_pedidos||0,b:filaAlm?.uber_bruto||0},
    'Glovo':{p:filaAlm?.glovo_pedidos||0,b:filaAlm?.glovo_bruto||0},
    'Web':{p:filaAlm?.web_pedidos||0,b:filaAlm?.web_bruto||0},
    'Venta Directa':{p:filaAlm?.directa_pedidos||0,b:filaAlm?.directa_bruto||0},
  }
  const phPed=(label:string)=> esCenasAlm&&filaAlm ? `Almuerzo: ${almByLabel[label].p||0}` : '0'
  const phBru=(label:string)=> esCenasAlm&&filaAlm ? `Almuerzo: ${fmt2(almByLabel[label].b||0)}` : '0.00'

  const handleSubmit=async(e?:FormEvent)=>{
    e?.preventDefault(); setFormError(null); if(!fecha){setFormError('Selecciona una fecha');return}
    const edJe=jeItems.filter(i=>!i.alm)

    if(esCenasAlm){
      if(!filaAlm){setFormError('No hay fila ALM para este día.');return}
      // UE/Glovo/Web/Directa: se introduce el TOTAL del día -> restamos el almuerzo para obtener la cena
      const ub=Math.max(0,parseNum(fields.uber_bruto)-(filaAlm.uber_bruto||0)); const gb=Math.max(0,parseNum(fields.glovo_bruto)-(filaAlm.glovo_bruto||0)); const wb=Math.max(0,parseNum(fields.web_bruto)-(filaAlm.web_bruto||0)); const db=Math.max(0,parseNum(fields.directa_bru)-(filaAlm.directa_bruto||0))
      const up=Math.max(0,parseIntES(fields.uber_pedidos)-(filaAlm.uber_pedidos||0)); const gp=Math.max(0,parseIntES(fields.glovo_pedidos)-(filaAlm.glovo_pedidos||0)); const wp=Math.max(0,parseIntES(fields.web_pedidos)-(filaAlm.web_pedidos||0)); const dp=Math.max(0,parseIntES(fields.directa_ped)-(filaAlm.directa_pedidos||0))
      // JE: solo los pedidos de la cena (los del almuerzo ya viven en su propia fila ALM)
      const jb=edJe.reduce((a,b)=>a+parseNum(b.raw),0); const jp=edJe.length
      const tp=up+gp+jp+wp+dp; const tb=ub+gb+jb+wb+db; if(tp===0&&tb===0){setFormError('El total es igual o menor al ALM.');return}
      const p={fecha,servicio:'CENAS',uber_pedidos:up,uber_bruto:parseFloat(ub.toFixed(2)),glovo_pedidos:gp,glovo_bruto:parseFloat(gb.toFixed(2)),je_pedidos:jp,je_bruto:parseFloat(jb.toFixed(2)),web_pedidos:wp,web_bruto:parseFloat(wb.toFixed(2)),directa_pedidos:dp,directa_bruto:parseFloat(db.toFixed(2)),total_pedidos:tp,total_bruto:parseFloat(tb.toFixed(2)),je_items:edJe.map(i=>parseNum(i.raw))}
      setSaving(true)
      // Si el usuario editó/borró/añadió pedidos JE del almuerzo, propagamos el cambio a la fila ALM (sin duplicarlo en la cena)
      const almJe=jeItems.filter(i=>i.alm).map(i=>parseNum(i.raw))
      const origAlm=(Array.isArray(filaAlm.je_items)&&filaAlm.je_items.length>0)?filaAlm.je_items.map(Number):(filaAlm.je_pedidos>0?repartoJE(filaAlm.je_bruto??0, filaAlm.je_pedidos):((filaAlm.je_bruto??0)>0?[filaAlm.je_bruto]:[]))
      if(JSON.stringify(almJe)!==JSON.stringify(origAlm)){
        const najb=almJe.reduce((a,b)=>a+b,0); const najp=almJe.length
        const nalmTotalBru=parseFloat(((filaAlm.total_bruto||0)-(filaAlm.je_bruto||0)+najb).toFixed(2))
        const nalmTotalPed=(filaAlm.total_pedidos||0)-(filaAlm.je_pedidos||0)+najp
        const{error:ae}=await supabase.from('facturacion_diario').update({je_pedidos:najp,je_bruto:parseFloat(najb.toFixed(2)),total_pedidos:nalmTotalPed,total_bruto:nalmTotalBru,je_items:almJe}).eq('id',filaAlm.id).select('id')
        if(ae){setSaving(false);setFormError(`Error actualizando JE del almuerzo: ${ae.message} [${ae.code}]`);return}
      }
      const{error:ie}=await supabase.from('facturacion_diario').insert(p); setSaving(false)
      if(ie){setFormError(`Error guardando CENAS: ${ie.message} [${ie.code}]`);return}
      onSaved(); return
    }

    const up=parseIntES(fields.uber_pedidos); const ub=parseNum(fields.uber_bruto)
    const gp=parseIntES(fields.glovo_pedidos); const gb=parseNum(fields.glovo_bruto)
    // Día antiguo sin detalle JE y no tocado -> conservamos recuento y total originales (no inventar ni perder pedidos)
    const edSuma=edJe.reduce((a,b)=>a+parseNum(b.raw),0)
    const jeFallbackIntacto = isEdit && !jeOrig.hadItems && jeOrig.count>0 && edJe.length===jeOrig.count && Math.abs(edSuma-jeOrig.bruto)<0.005
    const jp = jeFallbackIntacto ? jeOrig.count : edJe.length
    const jb = jeFallbackIntacto ? jeOrig.bruto : edSuma
    const jeItemsSave = jeFallbackIntacto ? [] : edJe.map(i=>parseNum(i.raw))
    const wp=parseIntES(fields.web_pedidos); const wb=parseNum(fields.web_bruto)
    const dp=parseIntES(fields.directa_ped); const db=parseNum(fields.directa_bru)
    const tp=up+gp+jp+wp+dp; const tb=ub+gb+jb+wb+db
    if(tp===0&&tb===0){setFormError('Introduce datos en al menos un canal');return}
    const p={fecha,servicio,uber_pedidos:up,uber_bruto:ub,glovo_pedidos:gp,glovo_bruto:gb,je_pedidos:jp,je_bruto:jb,web_pedidos:wp,web_bruto:wb,directa_pedidos:dp,directa_bruto:db,total_pedidos:tp,total_bruto:tb,je_items:jeItemsSave}

    setSaving(true)
    if(isEdit){
      const{data:upd,error:ue}=await supabase.from('facturacion_diario').update(p).eq('id',existing!.id).select('id')
      setSaving(false)
      if(ue){setFormError(`Error actualizando: ${ue.message} [${ue.code}]`);return}
      if(!upd||upd.length===0){setFormError('No se actualizó ninguna fila. Recarga la página e inténtalo de nuevo.');return}
      onSaved()
    } else {
      const{error:ie}=await supabase.from('facturacion_diario').insert(p)
      setSaving(false)
      if(ie){setFormError(`Error insertando: ${ie.message} [${ie.code}]`);return}
      onSaved()
    }
  }

  const handleDelete=async()=>{ if(!confirm('¿Eliminar este día?'))return; const{error}=await supabase.from('facturacion_diario').delete().eq('id',existing!.id); if(error){setFormError(`Error borrando: ${error.message} [${error.code}]`);return}; onSaved() }
  const inp: CSSProperties={ width:'100%', background:COLORS.card, color:COLORS.pri, border:`1px solid ${COLORS.brd}`, borderRadius:8, padding:'8px 12px', fontSize:13, fontFamily:FONT.body, outline:'none' }
  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', padding:16 }}>
      <div style={{ background:'var(--sl-modal-bg)', border:`0.5px solid ${COLORS.brd}`, borderRadius:16, width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:`0.5px solid ${COLORS.brd}` }}>
          <h3 style={{ color:COLORS.pri, fontFamily:FONT.heading, fontSize:16, fontWeight:600, margin:0, letterSpacing:'2px' }}>{isEdit?'EDITAR DÍA':'AÑADIR DÍA'}</h3>
          <button onClick={onClose} title="Cerrar (cancela los cambios)" style={{ background:'none', border:'none', color:COLORS.mut, fontSize:24, cursor:'pointer', lineHeight:1, padding:0 }}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding:20, display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'flex', gap:12, alignItems:'flex-end' }}>
            <div style={{ flex:'0 0 43%' }}><label style={{ display:'block', fontSize:11, color:COLORS.mut, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.5px', fontFamily:FONT.heading }}>Fecha</label><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={inp} /></div>
            <div style={{ flex:1 }}><label style={{ display:'block', fontSize:11, color:COLORS.mut, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.5px', fontFamily:FONT.heading }}>Servicio</label><div style={{ display:'flex', gap:4 }}>{[{key:'ALM',label:'ALM'},{key:'CENAS',label:'CENAS'},{key:'TODO',label:'TODOS'},{key:'CENAS_ALM',label:'CENAS/ALM'}].map(s=>{ const isA=servicio===s.key; const isCA=s.key==='CENAS_ALM'; return (<button key={s.key} type="button" onClick={()=>setServicio(s.key)} style={{ flex:1, padding:'8px 4px', borderRadius:8, fontSize:10, fontWeight:600, border:isA?'none':`0.5px solid ${COLORS.brd}`, background:isA?(isCA?'#7c3aed':COLORS.redSL):BLANCO, color:isA?BLANCO:COLORS.mut, cursor:'pointer', fontFamily:FONT.heading, letterSpacing:'0.5px', whiteSpace:'nowrap' }}>{s.label}</button>) })}</div></div>
          </div>
          {esCenasAlm&&!filaAlm&&<p style={{ margin:0, fontSize:11, color:COLORS.warn, fontFamily:FONT.body }}>No hay almuerzo guardado para esta fecha. Selecciona otro servicio o crea primero el ALM.</p>}
          {esCenasAlm&&filaAlm&&<p style={{ margin:0, fontSize:11, color:COLORS.mut, fontFamily:FONT.body }}>Introduce el TOTAL del día en cada canal (la referencia gris es lo que ya hubo en el almuerzo). En Just Eat los pedidos del almuerzo ya están cargados: añade debajo solo los de la cena.</p>}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {FORM_COLS.slice(0,2).map(c=>{const cc=CANAL_COLORS_M[c.label];return(<div key={c.label} style={{ background:cc?.bg??'var(--sl-thead)', border:`1px solid ${cc?.border??'var(--sl-border)'}`, borderRadius:10, padding:12 }}><p style={{ fontSize:11, fontWeight:600, marginBottom:10, color:cc?.label??COLORS.mut, fontFamily:FONT.heading, letterSpacing:1, textTransform:'uppercase' }}>{c.label}</p><div style={{ display:'flex', flexDirection:'column', gap:10 }}><div><label style={{ display:'block', fontSize:10, color:COLORS.mut, marginBottom:4 }}>Pedidos</label><input type="text" inputMode="numeric" placeholder={phPed(c.label)} value={fields[c.ped]} onChange={e=>set(c.ped,e.target.value)} style={inp} /></div><div><label style={{ display:'block', fontSize:10, color:COLORS.mut, marginBottom:4 }}>Bruto (EUR)</label><input type="text" inputMode="decimal" placeholder={phBru(c.label)} value={fields[c.bru]} onChange={e=>set(c.bru,e.target.value)} style={inp} /></div></div></div>)})}
          </div>
          <div style={{ background:`${NAR}12`, border:`1px solid ${NAR}`, borderRadius:10, padding:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}><span style={{ fontFamily:FONT.heading, fontSize:11, letterSpacing:2, color:NAR, textTransform:'uppercase' }}>Just Eat</span>{jeItems.length>0&&<span style={{ fontFamily:FONT.body, fontSize:12, color:COLORS.mut }}>{jeItems.length} pedido{jeItems.length!==1?'s':''} · {jeItems.reduce((a,b)=>a+parseNum(b.raw),0).toFixed(2)} €</span>}</div>
            {jeItems.length>0&&(<div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>{jeItems.map((item,idx)=>(<div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderRadius:8, background:item.alm?'var(--sl-hover)':COLORS.card, border:`0.5px solid ${COLORS.brd}` }}><div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}><span style={{ fontFamily:FONT.heading, fontSize:11, color:COLORS.mut, width:18, flexShrink:0 }}>{idx+1}.</span><input type="text" inputMode="decimal" value={item.raw} onChange={e=>{const nv=e.target.value; setJeItems(p=>p.map((it,i)=>i===idx?{...it,raw:nv}:it))}} style={{ ...inp, width:96, padding:'4px 8px' }} /><span style={{ fontFamily:FONT.body, fontSize:12, color:COLORS.mut }}>€</span>{item.alm&&<span style={{ fontSize:9, letterSpacing:1, color:NAR, fontFamily:FONT.heading, textTransform:'uppercase' }}>almuerzo</span>}</div><button type="button" onClick={()=>setJeItems(p=>p.filter((_,i)=>i!==idx))} style={{ background:'none', border:'none', cursor:'pointer', color:COLORS.err, fontSize:18, lineHeight:1, padding:'0 4px' }}>×</button></div>))}</div>)}
            <div style={{ display:'flex', gap:8, alignItems:'center' }}><input ref={jeRef} type="text" inputMode="decimal" placeholder="Importe (€)" value={jeInput} onChange={e=>setJeInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addJe()}}} style={{ ...inp, flex:1, width:'auto', padding:'6px 10px' }} /><button type="button" onClick={addJe} style={{ padding:'6px 14px', borderRadius:8, background:NAR, color:BLANCO, border:'none', cursor:'pointer', fontFamily:FONT.heading, fontSize:14, fontWeight:600, flexShrink:0 }}>+</button></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {FORM_COLS.slice(2).map(c=>{const cc=CANAL_COLORS_M[c.label];return(<div key={c.label} style={{ background:cc?.bg??'var(--sl-thead)', border:`1px solid ${cc?.border??'var(--sl-border)'}`, borderRadius:10, padding:12 }}><p style={{ fontSize:11, fontWeight:600, marginBottom:10, color:cc?.label??COLORS.mut, fontFamily:FONT.heading, letterSpacing:1, textTransform:'uppercase' }}>{c.label}</p><div style={{ display:'flex', flexDirection:'column', gap:10 }}><div><label style={{ display:'block', fontSize:10, color:COLORS.mut, marginBottom:4 }}>Pedidos</label><input type="text" inputMode="numeric" placeholder={phPed(c.label)} value={fields[c.ped]} onChange={e=>set(c.ped,e.target.value)} style={inp} /></div><div><label style={{ display:'block', fontSize:10, color:COLORS.mut, marginBottom:4 }}>Bruto (EUR)</label><input type="text" inputMode="decimal" placeholder={phBru(c.label)} value={fields[c.bru]} onChange={e=>set(c.bru,e.target.value)} style={inp} /></div></div></div>)})}
          </div>
          {formError&&<p style={{ color:COLORS.err, fontSize:12, margin:0, fontFamily:FONT.body, background:`${COLORS.err}18`, padding:'8px 12px', borderRadius:8, border:`1px solid ${COLORS.err}30` }}>{formError}</p>}
          <div style={{ display:'flex', gap:12, paddingTop:8 }}>
            {isEdit&&(<button type="button" onClick={handleDelete} style={{ flex:1, padding:'10px 16px', borderRadius:8, fontSize:13, fontWeight:600, border:`1px solid ${COLORS.redSL}`, background:'none', color:COLORS.redSL, cursor:'pointer', fontFamily:FONT.body }}>Eliminar</button>)}
            <button type="button" onClick={onClose} style={{ flex:1, padding:'10px 16px', borderRadius:8, fontSize:13, fontWeight:600, border:`0.5px solid ${COLORS.brd}`, background:'none', color:COLORS.mut, cursor:'pointer', fontFamily:FONT.body }}>Cancelar</button>
            <button type="submit" disabled={saving} style={{ flex:1, padding:'10px 16px', borderRadius:8, fontSize:13, fontWeight:600, border:'none', background:COLORS.redSL, color:BLANCO, cursor:saving?'not-allowed':'pointer', fontFamily:FONT.body, opacity:saving?0.6:1 }}>{saving?'Guardando...':isEdit?'Actualizar':'Guardar'}</button>
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
  if(tipo==='cerrado'||tipo==='festivo'||tipo==='vacaciones') return (<span style={{ background:COLORS.redSL, color:BLANCO, padding:'2px 6px', borderRadius:4, fontSize:9, fontFamily:FONT.heading, letterSpacing:0.5, textTransform:'uppercase' }}>CERRADO</span>)
  if(tipo==='solo_comida') return (<span style={{ background:COLORS.glovo, color:INK, padding:'2px 6px', borderRadius:4, fontSize:9, fontFamily:FONT.heading, letterSpacing:0.5 }}>ALM</span>)
  if(tipo==='solo_cena') return (<span style={{ background:COLORS.je, color:BLANCO, padding:'2px 6px', borderRadius:4, fontSize:9, fontFamily:FONT.heading, letterSpacing:0.5 }}>CENA</span>)
  return null
}
function DesvBadge({ pct }: { pct:number }) {
  const pos=pct>=0; const color=pos?COLORS.ok:COLORS.err
  return (<span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:999, background:`${color}18`, color, fontFamily:FONT.body }}>{pos?'▲':'▼'} {Math.abs(pct).toFixed(1)}%</span>)
}
