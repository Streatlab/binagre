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

// ─── Subtabs: fondo del contenedor = COLORS.accent (#FF4757, igual que "Diario" activo)
// Inactivo: fondo BLANCO PURO, texto gris — los botones no heredan el rojo
// Activo: fondo blanco puro, texto negro COLORS.pri
const SUBTAB_CONTAINER: CSSProperties = {
  ...TABS_PILL.container,
  background: COLORS.accent,
  border: `0.5px solid ${COLORS.accent}`,
  marginBottom: 0, marginTop: 0,
}
const SUBTAB_ACTIVE: CSSProperties = {
  padding: '4px 10px', borderRadius: 5, border: 'none',
  background: '#ffffff', color: COLORS.pri,
  fontFamily: FONT.heading, fontSize: 10, fontWeight: 700,
  letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer',
}
// CLAVE: background blanco puro para anular herencia del contenedor rojo
const SUBTAB_INACTIVE: CSSProperties = {
  padding: '4px 10px', borderRadius: 5, border: 'none',
  background: '#ffffff', color: COLORS.mut,
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
  