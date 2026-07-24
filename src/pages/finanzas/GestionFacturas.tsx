import { AMA, AMA_S, AZUL, BLANCO, BORDE_SUAVE, CLARO, GRANATE, GRIS, INK, NAR, OSC, ROJO, ROSA_S, SHADOW, VERDE, VERDE_S } from '@/styles/neobrutal'
import { DRIVE_TRIM, DRIVE_ANIO_BG, DRIVE_ANIO_TEXT } from '@/styles/palettes'
import { useMultiSort } from '@/hooks/useMultiSort'
import SortableHeader, { ClearSortButton } from '@/components/ui/SortableHeader'
/**
 * GestorDocumental — v16: ordenación canónica multi-criterio
 */

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type CSSProperties,
} from 'react'
import {
  COLORS,
  FONT,
  DROPDOWN_BTN,
} from '@/components/panel/resumen/tokens'
import { useTheme, groupStyle } from '@/styles/tokens'
import TabsPastilla from '@/components/ui/TabsPastilla'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toastStore'
import { fmtEur } from '@/lib/format'
import ModalDescartarFactura, { type FacturaDescartable } from '@/components/documentacion/ModalDescartarFactura'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel, SHADOW_DURA } from '@/components/kit/cantera'
import * as M from '@/lib/marcoDoc'
import BotonImprimir from '@/components/BotonImprimir'

type TabId = 'facturas' | 'ventas' | 'exportar'
type SortColumn = 'fecha' | 'proveedor' | 'nif' | 'importe' | 'categoria' | 'doc' | 'estado'

interface Titular { id: string; nombre: string; color: string; carpeta_drive: string | null }
interface CategoriaPyg { id: string; nivel: number; parent_id: string | null; nombre: string; bloque: string; orden: number }
interface FacturaRow {
  id: string; fecha_factura: string | null; proveedor_nombre: string
  total: number | null; estado: string | null; titular_id: string | null
  pdf_drive_url: string | null; pdf_filename: string | null; pdf_original_name: string | null
  categoria_factura: string | null; nif_emisor: string | null; tipo: string | null
}
interface DriveFiltro { titular_id?: string; anio?: number; trimestre?: number; mes?: number }
interface DriveNode {
  label: string; count: number; importe: number; children?: DriveNode[]
  filtro: DriveFiltro; kind: 'titular' | 'anio' | 'trim' | 'mes'; trimNum?: number
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'facturas', label: 'Facturas' },
  { id: 'ventas',   label: 'Ventas'   },
  { id: 'exportar', label: 'Exportar' },
]

const COLOR_RUBEN  = NAR
const COLOR_EMILIO = AZUL

const MESES_ES = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const MESES_POR_TRIM: Record<number, number[]> = { 1:[1,2,3], 2:[4,5,6], 3:[7,8,9], 4:[10,11,12] }
const TRIM_PALETTE = DRIVE_TRIM
const ANIO_BG = DRIVE_ANIO_BG

function fmtFechaCorta(iso: string|null): string {
  if (!iso) return '—'
  const [y,m,d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

function fmtNum(n: number|null|undefined, dec=2): string {
  if (n===null||n===undefined||isNaN(Number(n))) return '0,00'
  return Number(n).toLocaleString('es-ES',{minimumFractionDigits:dec,maximumFractionDigits:dec})
}

function trimestreEnCurso(mes: number): number { return Math.ceil(mes/3) }

// ─── PDF — MARCO ÚNICO (src/lib/marcoDoc.ts) — VERTICAL — documentoId finanzas.factura_listado ──
const AREA_PDF: M.Area = 'finanzas'

function construirFacturasListadoPDF(facturas: FacturaRow[], catNombre: Map<string,string>, meta: string, rec: M.Recursos, bn = false) {
  if (facturas.length === 0) return null
  const doc = M.nuevaHoja({ orientation: 'portrait' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA_PDF, bn)
  const cb = M.contentBox(doc)
  const nuevaPagina = () => { M.pintarEspina(doc, AREA_PDF, ctx, bn); return M.pintarCabecera(doc, ctx, { docNombre: 'Listado de facturas', meta, area: AREA_PDF, bn }) }
  let y = nuevaPagina()

  const wFecha = 20, wImporte = 26, wEstado = 30
  const wProv = (cb.w - wFecha - wImporte - wEstado) * 0.55
  const wCat = cb.w - wFecha - wImporte - wEstado - wProv
  const xFecha = cb.x0, xProv = xFecha + wFecha, xCat = xProv + wProv, xImporte = xCat + wCat + wImporte, xEstado = cb.x1

  const cabTabla = () => {
    doc.setFillColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.rect(cb.x0, y, cb.w, 6, 'F')
    M.fTitulo(doc, ctx, true); doc.setFontSize(7); doc.setTextColor(255, 255, 255)
    doc.text('FECHA', xFecha + 1.2, y + 4.2)
    doc.text('PROVEEDOR', xProv + 1.2, y + 4.2)
    doc.text('CATEGORÍA', xCat + 1.2, y + 4.2)
    doc.text('IMPORTE', xImporte - 1.2, y + 4.2, { align: 'right' })
    doc.text('ESTADO', xEstado - wEstado / 2, y + 4.2, { align: 'center' })
    y += 6
  }
  cabTabla()
  let totalImporte = 0
  for (const f of facturas) {
    if (y > cb.bottom - 6) { doc.addPage(); y = nuevaPagina(); cabTabla() }
    totalImporte += f.total ?? 0
    const est = colorEstado(f.estado)
    const catLbl = f.categoria_factura ? `${f.categoria_factura} ${catNombre.get(f.categoria_factura) || ''}`.trim() : '—'
    doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.1); doc.line(cb.x0, y + 4.6, cb.x1, y + 4.6)
    M.fDato(doc, ctx, false); doc.setFontSize(7.6); doc.setTextColor(...M.TINTA)
    doc.text(fmtFechaCorta(f.fecha_factura), xFecha + 1.2, y + 3.6)
    doc.text(f.proveedor_nombre || '—', xProv + 1.2, y + 3.6, { maxWidth: wProv - 2 })
    doc.setTextColor(...M.GRIS)
    doc.text(catLbl, xCat + 1.2, y + 3.6, { maxWidth: wCat - 2 })
    doc.setTextColor(...M.TINTA)
    doc.text(fmtNum(f.total, 2), xImporte - 1.2, y + 3.6, { align: 'right' })
    doc.setFontSize(6.6); doc.setTextColor(...pal.acento)
    doc.text(est.lbl, xEstado - wEstado / 2, y + 3.6, { align: 'center' })
    y += 4.8
  }
  if (y > cb.bottom - 6) { doc.addPage(); y = nuevaPagina(); cabTabla() }
  doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.3); doc.line(cb.x0, y, cb.x1, y)
  y += 1
  M.fDato(doc, ctx, true); doc.setFontSize(9); doc.setTextColor(...pal.acento)
  doc.text(`Total (${facturas.length} facturas)`, xFecha + 1.2, y + 4)
  doc.text(fmtNum(totalImporte, 2), xImporte - 1.2, y + 4, { align: 'right' })

  const totalPag = doc.getNumberOfPages()
  for (let p = 1; p <= totalPag; p++) { doc.setPage(p); M.pintarPaginado(doc, p, totalPag, ctx) }
  return doc
}

function generarMeses(desdeISO: string): {valor: string; label: string}[] {
  const hoy = new Date()
  const [anioI, mesI] = desdeISO.slice(0,7).split('-').map(Number)
  const meses: {valor: string; label: string}[] = []
  let a = hoy.getFullYear(), m = hoy.getMonth() + 1
  while (a > anioI || (a === anioI && m >= mesI)) {
    meses.push({ valor: `${a}-${String(m).padStart(2,'0')}`, label: `${MESES_ES[m]} ${a}` })
    m--
    if (m === 0) { m = 12; a-- }
  }
  return meses
}

// TODO: migrar a v_estado_documento — leer estado de facturas desde la vista en vez de la columna estado directa
function colorEstado(estado: string|null): {bg:string;col:string;lbl:string} {
  switch (estado) {
    case 'asociada':                 return {bg:VERDE_S,col:COLORS.ok,   lbl:'CONCILIADA'}
    case 'pendiente_revision':       return {bg:AMA_S,  col:COLORS.warn, lbl:'PEND. REV.'}
    case 'pendiente_titular_manual': return {bg:AMA_S,  col:COLORS.warn, lbl:'FALTA TITULAR'}
    case 'sin_match':                return {bg:ROSA_S, col:COLORS.redSL,lbl:'SIN MATCH'}
    case 'historica':                return {bg:CLARO,  col:COLORS.mut,  lbl:'HISTÓRICA'}
    case 'duplicada':                return {bg:ROSA_S, col:COLORS.redSL,lbl:'DUPLICADA'}
    case 'no_conciliable':           return {bg:CLARO,  col:COLORS.mut,  lbl:'DESCARTADA'}
    case 'error':                    return {bg:ROSA_S, col:COLORS.redSL,lbl:'ERROR'}
    case 'procesando':               return {bg:CLARO,  col:COLORS.mut,  lbl:'PROCESANDO'}
    default:                         return {bg:CLARO,  col:COLORS.mut,  lbl:(estado||'—').toUpperCase()}
  }
}

function buildDriveTree(facturas: FacturaRow[], titulares: Titular[]): DriveNode[] {
  const counts = new Map<string, Map<number, Map<number, {count:number;importe:number}>>>()
  for (const f of facturas) {
    if (!f.fecha_factura || !f.titular_id) continue
    const d = new Date(f.fecha_factura + 'T00:00:00')
    const anio = d.getFullYear(); const mes = d.getMonth() + 1
    if (!counts.has(f.titular_id)) counts.set(f.titular_id, new Map())
    const tMap = counts.get(f.titular_id)!
    if (!tMap.has(anio)) tMap.set(anio, new Map())
    const aMap = tMap.get(anio)!
    if (!aMap.has(mes)) aMap.set(mes, {count:0,importe:0})
    const node = aMap.get(mes)!
    node.count++; node.importe += Number(f.total||0)
  }
  const hoy = new Date(); const anioActual = hoy.getFullYear()
  const aniosSet = new Set<number>([anioActual, anioActual-1])
  for (const tMap of counts.values()) for (const a of tMap.keys()) aniosSet.add(a)
  const anios = Array.from(aniosSet).sort((a,b)=>b-a)
  const tree: DriveNode[] = []
  for (const t of titulares) {
    const tMap = counts.get(t.id)
    const titNode: DriveNode = {label:t.nombre,count:0,importe:0,children:[],filtro:{titular_id:t.id},kind:'titular'}
    for (const anio of anios) {
      const aMap = tMap?.get(anio)
      const aNode: DriveNode = {label:String(anio),count:0,importe:0,children:[],filtro:{titular_id:t.id,anio},kind:'anio'}
      for (const trim of [1,2,3,4]) {
        const qNode: DriveNode = {label:`T${trim}`,count:0,importe:0,children:[],filtro:{titular_id:t.id,anio,trimestre:trim},kind:'trim',trimNum:trim}
        for (const mes of MESES_POR_TRIM[trim]) {
          const data = aMap?.get(mes) ?? {count:0,importe:0}
          qNode.children!.push({label:MESES_ES[mes],count:data.count,importe:data.importe,filtro:{titular_id:t.id,anio,trimestre:trim,mes},kind:'mes',trimNum:trim})
          qNode.count+=data.count; qNode.importe+=data.importe
        }
        aNode.children!.push(qNode); aNode.count+=qNode.count; aNode.importe+=qNode.importe
      }
      titNode.children!.push(aNode); titNode.count+=aNode.count; titNode.importe+=aNode.importe
    }
    tree.push(titNode)
  }
  return tree
}

function flattenCategorias(cats: CategoriaPyg[]): Array<{id:string;label:string}> {
  const byParent = new Map<string|null, CategoriaPyg[]>()
  for (const c of cats) { const k=c.parent_id??null; if(!byParent.has(k)) byParent.set(k,[]); byParent.get(k)!.push(c) }
  for (const arr of byParent.values()) arr.sort((a,b)=>a.orden-b.orden)
  const out: Array<{id:string;label:string}> = []
  function walk(parent: string|null, depth: number) {
    for (const c of byParent.get(parent)||[]) {
      out.push({id:c.id, label:`${'   '.repeat(depth)}${c.id} ${c.nombre}`})
      walk(c.id, depth+1)
    }
  }
  walk(null, 0); return out
}

export default function GestionFacturas() {
  const { T } = useTheme()
  const [activeTab, setActiveTab] = useState<TabId>('facturas')
  const [titularKey, setTitularKey] = useState<'ruben'|'emilio'>('ruben')
  const [busqueda, setBusqueda] = useState('')
  const [categoriaId, setCategoria] = useState('todas')
  const [driveFiltro, setDriveFiltro] = useState<DriveFiltro>({})
  const [expansionMap, setExpansionMap] = useState<Record<string,boolean>>({})

  const ms = useMultiSort<FacturaRow, SortColumn>({
    getValue: (row, col) => {
      switch(col) {
        case 'fecha':      return row.fecha_factura ?? ''
        case 'proveedor':  return (row.proveedor_nombre || '').toLowerCase()
        case 'nif':        return (row.nif_emisor || '').toLowerCase()
        case 'importe':    return Number(row.total ?? 0)
        case 'categoria':  return row.categoria_factura ?? ''
        case 'doc':        return row.pdf_drive_url ? 1 : 0
        case 'estado':     return row.estado ?? ''
        default:           return ''
      }
    },
    defaultSorts: [{ col: 'fecha', dir: 'desc' }],
  })

  const [mesesDisp, setMesesDisp] = useState<{valor:string;label:string}[]>([])
  const [mesSeleccionado, setMesSeleccionado] = useState<string>('')
  const [bannerVisible, setBannerVisible] = useState(true)
  const [titulares, setTitulares] = useState<Titular[]>([])
  const [categorias, setCategorias] = useState<CategoriaPyg[]>([])
  const [facturas, setFacturas] = useState<FacturaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [descartar, setDescartar] = useState<FacturaDescartable | null>(null)

  const FACTURAS_SELECT = 'id,fecha_factura,proveedor_nombre,total,estado,titular_id,pdf_drive_url,pdf_filename,pdf_original_name,categoria_factura,nif_emisor,tipo'

  const recargarFacturas = useCallback(async () => {
    const { data } = await supabase.from('facturas').select(FACTURAS_SELECT).order('fecha_factura',{ascending:false,nullsFirst:false})
    setFacturas(((data??[]) as unknown as FacturaRow[]).map(f=>({...f,total:f.total===null?null:Number(f.total)})))
  }, [])

  useEffect(() => {
    let cancel = false
    async function load() {
      const [tRes, cRes, fRes, minRes] = await Promise.all([
        supabase.from('titulares').select('id,nombre,color,carpeta_drive').order('orden'),
        supabase.from('categorias_pyg').select('id,nivel,parent_id,nombre,bloque,orden').eq('activa',true).order('orden'),
        supabase.from('facturas')
          .select(FACTURAS_SELECT)
          .order('fecha_factura',{ascending:false,nullsFirst:false}),
        supabase.from('facturas').select('fecha_factura').order('fecha_factura',{ascending:true}).limit(1),
      ])
      if (cancel) return
      setTitulares((tRes.data??[]) as Titular[])
      setCategorias((cRes.data??[]) as CategoriaPyg[])
      setFacturas(((fRes.data??[]) as unknown as FacturaRow[]).map(f=>({...f,total:f.total===null?null:Number(f.total)})))
      const primera = (minRes.data?.[0] as {fecha_factura:string}|undefined)?.fecha_factura ?? new Date().toISOString().slice(0,7)+'-01'
      const lista = generarMeses(primera)
      setMesesDisp(lista)
      const hoy = new Date()
      const mesAnt = new Date(hoy.getFullYear(), hoy.getMonth()-1, 1)
      const mesAntStr = `${mesAnt.getFullYear()}-${String(mesAnt.getMonth()+1).padStart(2,'0')}`
      setMesSeleccionado(lista.find(m=>m.valor===mesAntStr)?.valor ?? lista[1]?.valor ?? lista[0]?.valor ?? '')
      setLoading(false)
    }
    load()
    return () => { cancel=true }
  }, [])

  const titularActivo = useMemo(()=>titulares.find(t=>{
    const n=t.nombre.toLowerCase()
    if(titularKey==='ruben') return n.includes('rubén')||n.includes('ruben')
    return n.includes('emilio')
  })??null, [titulares,titularKey])

  const driveTreeFull = useMemo(()=>buildDriveTree(facturas,titulares),[facturas,titulares])
  const driveTree = useMemo(()=>{
    if(!titularActivo) return []
    return driveTreeFull.filter(t=>t.filtro.titular_id===titularActivo.id)
  },[driveTreeFull,titularActivo])

  useEffect(()=>{ setDriveFiltro({}) },[titularKey])

  useEffect(()=>{
    if(Object.keys(expansionMap).length>0||driveTreeFull.length===0) return
    const init: Record<string,boolean> = {}
    const hoy=new Date(); const anioActual=hoy.getFullYear(); const trimActual=trimestreEnCurso(hoy.getMonth()+1)
    for(const t of driveTreeFull){
      const id=t.filtro.titular_id
      init[`t:${id}`]=true; init[`y:${id}:${anioActual}`]=true; init[`q:${id}:${anioActual}:${trimActual}`]=true
    }
    setExpansionMap(init)
  },[driveTreeFull,expansionMap])

  const categoriasFlat = useMemo(()=>flattenCategorias(categorias),[categorias])
  const catNombre = useMemo(()=>{const m=new Map<string,string>(); for(const c of categorias) m.set(c.id,c.nombre); return m},[categorias])

  const {desdeStr, hastaStr, mesLabel} = useMemo(()=>{
    if(!mesSeleccionado) return {desdeStr:'',hastaStr:'',mesLabel:''}
    const [y,m] = mesSeleccionado.split('-').map(Number)
    const ultimo = new Date(y,m,0).getDate()
    return {
      desdeStr:`${mesSeleccionado}-01`,
      hastaStr:`${mesSeleccionado}-${String(ultimo).padStart(2,'0')}`,
      mesLabel:`${MESES_ES[m]} ${y}`,
    }
  },[mesSeleccionado])

  const facturasFiltradas = useMemo(()=>facturas.filter(f=>{
    if(titularActivo&&f.titular_id!==titularActivo.id) return false
    if(driveFiltro.titular_id&&f.titular_id!==driveFiltro.titular_id) return false
    if(driveFiltro.anio&&f.fecha_factura){
      const d=new Date(f.fecha_factura+'T00:00:00')
      if(d.getFullYear()!==driveFiltro.anio) return false
      if(driveFiltro.trimestre){const trim=Math.ceil((d.getMonth()+1)/3); if(trim!==driveFiltro.trimestre) return false}
      if(driveFiltro.mes&&d.getMonth()+1!==driveFiltro.mes) return false
    }
    if(categoriaId!=='todas'){if(!f.categoria_factura||!f.categoria_factura.startsWith(categoriaId)) return false}
    if(busqueda){
      const q=busqueda.toLowerCase()
      if(!(f.proveedor_nombre||'').toLowerCase().includes(q)&&!(f.nif_emisor||'').toLowerCase().includes(q)&&!String(f.total||'').includes(q)) return false
    }
    return true
  }),[facturas,titularActivo,driveFiltro,categoriaId,busqueda])

  const facturasOrdenadas = useMemo(()=>ms.applySorts(facturasFiltradas),[facturasFiltradas,ms])

  const facturasMes = useMemo(()=>{
    if(!desdeStr||!hastaStr) return [] as FacturaRow[]
    return facturas.filter(f=>{
      if(titularActivo&&f.titular_id!==titularActivo.id) return false
      if(!f.fecha_factura) return false
      return f.fecha_factura>=desdeStr&&f.fecha_factura<=hastaStr
    })
  },[facturas,titularActivo,desdeStr,hastaStr])

  const plazoLabel = useMemo(()=>{
    if(!mesSeleccionado) return '—'
    const [y,m]=mesSeleccionado.split('-').map(Number)
    const sigMes=m===12?1:m+1; const sigAnio=m===12?y+1:y
    const dias=Math.max(0,Math.ceil((new Date(sigAnio,sigMes-1,5).getTime()-new Date().getTime())/(1000*60*60*24)))
    return `hasta el 5 de ${MESES_ES[sigMes].toLowerCase()} · Quedan ${dias} día${dias===1?'':'s'}`
  },[mesSeleccionado])

  const MesDropdown = useCallback(()=>{
    const ref=useRef<HTMLDivElement>(null)
    const [open,setOpen]=useState(false)
    useEffect(()=>{
      function handler(e:MouseEvent){if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)}
      document.addEventListener('mousedown',handler)
      return()=>document.removeEventListener('mousedown',handler)
    },[])
    const labelActual=mesesDisp.find(m=>m.valor===mesSeleccionado)?.label??mesSeleccionado
    return(
      <div ref={ref} style={{position:'relative'}}>
        <button onClick={()=>setOpen(o=>!o)}
          style={{padding:'6px 10px',borderRadius:0,border:`0.5px solid ${T.brd}`,background:T.card,fontSize:13,fontFamily:FONT.body,color:T.pri,cursor:'pointer',display:'flex',alignItems:'center',gap:4,whiteSpace:'nowrap'}}>
          <span>{labelActual}</span>
          <span style={{fontSize:10}}>▾</span>
        </button>
        {open&&(
          <div style={{position:'absolute',top:'100%',right:0,background:T.card,border:`0.5px solid ${T.brd}`,borderRadius:0,zIndex:50,maxHeight:260,overflowY:'auto',boxShadow:SHADOW,minWidth:180}}>
            {mesesDisp.map(m=>(
              <button key={m.valor} onClick={()=>{setMesSeleccionado(m.valor);setOpen(false)}}
                style={{display:'block',width:'100%',textAlign:'left',padding:'8px 12px',background:m.valor===mesSeleccionado?CLARO:'transparent',color:m.valor===mesSeleccionado?ROJO:T.mut,fontFamily:FONT.body,fontSize:13,border:'none',cursor:'pointer'}}>
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  },[mesesDisp,mesSeleccionado,T])

  const HEADERS: {label:string;col:SortColumn;align:'left'|'right'|'center'}[] = [
    {label:'Fecha',col:'fecha',align:'left'},{label:'Proveedor',col:'proveedor',align:'left'},
    {label:'NIF',col:'nif',align:'left'},{label:'Importe',col:'importe',align:'right'},
    {label:'Categoría',col:'categoria',align:'left'},
    {label:'Doc',col:'doc',align:'center'},{label:'Estado',col:'estado',align:'left'},
  ]

  const tdStyle: CSSProperties = {padding:'11px 12px',fontSize:13,fontFamily:FONT.body,color:COLORS.pri,borderBottom:`0.5px solid ${COLORS.brd}`,whiteSpace:'nowrap'}
  const islaStyle: CSSProperties = {background:COLORS.card,border:`0.5px solid ${COLORS.brd}`,borderRadius:0,padding:'4px 6px',display:'flex',alignItems:'center',gap:4}

  // Métricas del héroe: derivadas del mismo listado filtrado que ve la tabla (sin recalcular estado/negocio).
  const totalFiltradas = facturasFiltradas.length
  const conciliadasFiltradas = facturasFiltradas.filter(f=>f.estado==='asociada').length
  const sinDocFiltradas = facturasFiltradas.filter(f=>!f.pdf_drive_url).length
  const importeFiltradas = facturasFiltradas.reduce((a,f)=>a+(f.total||0),0)
  const pctConciliadas = totalFiltradas>0 ? (conciliadasFiltradas/totalFiltradas)*100 : null
  const heroTitular = totalFiltradas===0
    ? 'No hay facturas para este filtro.'
    : `${conciliadasFiltradas} de ${totalFiltradas} facturas ya conciliadas.`
  const heroAtencion = [
    `${totalFiltradas} facturas`,
    sinDocFiltradas>0 ? `${sinDocFiltradas} sin documento` : null,
    `Plazo gestoría ${mesLabel}: ${plazoLabel}`,
  ].filter(Boolean) as string[]

  return(
    <PantallaCantera embedded style={{fontFamily:FONT.body,position:'relative',padding:0}}>

      {bannerVisible&&(
        <div style={{background:AMA_S,border:`2px solid ${AMA}`,borderRadius:0,padding:'8px 16px',display:'flex',alignItems:'center',gap:12,fontFamily:FONT.body,fontSize:13,color:INK}}>
          <span style={{flexShrink:0,fontSize:14}}>⚠️</span>
          <span style={{flex:1,fontSize:13}}>
            Plazo gestoría <strong>{mesLabel}</strong>: {plazoLabel}
          </span>
          <button onClick={()=>setActiveTab('exportar')}
            style={{background:GRANATE,color:BLANCO,border:'none',borderRadius:0,padding:'6px 12px',fontSize:12,fontFamily:'Oswald, sans-serif',fontWeight:600,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.05em',flexShrink:0}}>
            Exportar ZIP
          </button>
          <button onClick={()=>setBannerVisible(false)}
            style={{background:'none',border:'none',cursor:'pointer',color:GRIS,fontSize:16,padding:'0 4px',flexShrink:0,lineHeight:1}}
            title="Cerrar">×</button>
        </div>
      )}

      <HeroCantera
        area="papeleo"
        titular={heroTitular}
        etiquetaDato="Importe de las facturas filtradas"
        cifra={fmtEur(importeFiltradas)}
        resumen={pctConciliadas!=null ? <>Conciliadas: <b>{pctConciliadas.toFixed(0)}%</b></> : undefined}
        atencion={heroAtencion}
      />

      <Plancha>
        <PlanchaCelda bg={BLANCO} first>
          <div style={{fontFamily:FONT.heading,fontSize:11,letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:600,color:COLORS.mut}}>Facturas</div>
          <div style={{fontFamily:FONT.heading,fontWeight:700,fontSize:22,marginTop:6}}>{totalFiltradas}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={VERDE}>
          <div style={{fontFamily:FONT.heading,fontSize:11,letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:600}}>Conciliadas</div>
          <div style={{fontFamily:FONT.heading,fontWeight:700,fontSize:22,marginTop:6}}>{conciliadasFiltradas}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={NAR}>
          <div style={{fontFamily:FONT.heading,fontSize:11,letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:600}}>Sin doc.</div>
          <div style={{fontFamily:FONT.heading,fontWeight:700,fontSize:22,marginTop:6}}>{sinDocFiltradas}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={AZUL}>
          <div style={{fontFamily:FONT.heading,fontSize:11,letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:600}}>Importe</div>
          <div style={{fontFamily:FONT.heading,fontWeight:700,fontSize:22,marginTop:6}}>{fmtEur(importeFiltradas)}</div>
        </PlanchaCelda>
      </Plancha>

      {totalFiltradas>0 && pctConciliadas!=null && (
        pctConciliadas>=80
          ? <FrasePotente significado="logro">Casi todo casado: el papeleo de este filtro está prácticamente al día.</FrasePotente>
          : pctConciliadas>=50
            ? <FrasePotente significado="oportunidad">Vas por buen camino, todavía queda parte por conciliar.</FrasePotente>
            : <FrasePotente significado="peligro">Menos de la mitad conciliada: revisa las facturas sin match antes del cierre.</FrasePotente>
      )}

      <div style={groupStyle(T)}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'flex-end',marginBottom:18,flexWrap:'wrap',gap:12}}>
          <MesDropdown/>
        </div>

        <TabsPastilla tabs={TABS} activeId={activeTab} onChange={(id)=>setActiveTab(id as TabId)}/>

        {activeTab==='facturas'&&(
          <>
            <div style={{display:'flex',gap:10,alignItems:'center',marginTop:14,marginBottom:14,flexWrap:'wrap'}}>
              <ToggleTitular titularKey={titularKey} setTitularKey={setTitularKey}/>
              <input type="text" placeholder="Buscar proveedor, NIF, importe…" value={busqueda} onChange={e=>setBusqueda(e.target.value)}
                style={{flex:1,minWidth:220,height:36,padding:'0 12px',borderRadius:0,border:`0.5px solid ${COLORS.brd}`,background:COLORS.card,fontSize:13,fontFamily:FONT.body,color:COLORS.pri,outline:'none'}}/>
              <div style={{...islaStyle,padding:0,overflow:'hidden'}}>
                <select value={categoriaId} onChange={e=>setCategoria(e.target.value)}
                  style={{...DROPDOWN_BTN,border:'none',background:'transparent',minWidth:280,height:36,paddingRight:28,cursor:'pointer'}}>
                  <option value="todas">Todas las categorías</option>
                  {categoriasFlat.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <ClearSortButton show={ms.showClearButton} onClear={ms.clearSorts} />
              <BotonImprimir compacto documentoId="finanzas.factura_listado" titulo="Listado de facturas" generarPdf={async opts => {
                const rec = await M.cargarRecursos()
                const metaFiltro = [titularActivo?.nombre, driveFiltro.anio ? `${driveFiltro.anio}${driveFiltro.trimestre ? ` T${driveFiltro.trimestre}` : ''}${driveFiltro.mes ? ` · ${MESES_ES[driveFiltro.mes]}` : ''}` : null, categoriaId !== 'todas' ? categoriaId : null].filter(Boolean).join(' · ')
                return construirFacturasListadoPDF(facturasOrdenadas, catNombre, metaFiltro || 'Todas las facturas', rec, opts.bn)
              }} />
            </div>

            <SeccionLabel bg={GRANATE}>Facturas</SeccionLabel>
            <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:14}}>
              <Papel ceja={NAR} pad="14px" style={{fontSize:13,fontFamily:FONT.body,alignSelf:'start'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,paddingBottom:8,borderBottom:`0.5px solid ${COLORS.brd}`}}>
                  <span style={{fontFamily:FONT.heading,fontSize:12,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.pri,fontWeight:600}}>📁 Drive</span>
                  {driveFiltro.anio&&(
                    <button type="button" onClick={()=>setDriveFiltro({})}
                      style={{fontSize:10,padding:'3px 9px',border:'none',background:COLORS.group,borderRadius:0,color:COLORS.sec,cursor:'pointer',fontFamily:FONT.body}}>
                      limpiar
                    </button>
                  )}
                </div>
                {loading&&<div style={{color:COLORS.mut,fontSize:12}}>Cargando…</div>}
                {!loading&&driveTree.map(tNode=>(
                  <NodoArbolItem key={tNode.label} node={tNode} level={0} filtroActivo={driveFiltro} expansionMap={expansionMap}
                    titularColor={titularKey==='ruben'?COLOR_RUBEN:COLOR_EMILIO}
                    onSelect={setDriveFiltro} onToggleExpand={key=>setExpansionMap(m=>({...m,[key]:!m[key]}))}/>
                ))}
              </Papel>

              <Papel ceja={GRANATE} pad="0" style={{overflow:'hidden'}}>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'separate',borderSpacing:0}}>
                    <thead>
                      <tr>
                        {HEADERS.map(h => (
                          <SortableHeader key={h.col} col={h.col} label={h.label}
                            sortIndex={ms.sortIndex(h.col)} sortDir={ms.sortDir(h.col)}
                            onToggle={ms.toggleSort} align={h.align} />
                        ))}
                        <th style={{padding:'11px 12px',fontSize:11,fontFamily:FONT.heading,letterSpacing:1,textTransform:'uppercase',color:COLORS.mut,textAlign:'center'}}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading&&<tr><td colSpan={8} style={{...tdStyle,textAlign:'center',color:COLORS.mut,padding:'40px 12px'}}>Cargando…</td></tr>}
                      {!loading&&facturasOrdenadas.map((f,idx)=>{
                        const est=colorEstado(f.estado)
                        const catLbl=f.categoria_factura?`${f.categoria_factura} ${catNombre.get(f.categoria_factura)||''}`.trim():'—'
                        const isLast=idx===facturasOrdenadas.length-1
                        const tdDoc: CSSProperties = {padding:0,borderBottom:isLast?'none':`0.5px solid ${COLORS.brd}`,verticalAlign:'middle',textAlign:'center'}
                        return(
                          <tr key={f.id} onClick={()=>f.pdf_drive_url&&window.open(f.pdf_drive_url,'_blank','noopener')}
                            style={{cursor:f.pdf_drive_url?'pointer':'default'}}
                            onMouseEnter={e=>(e.currentTarget.style.background=COLORS.bg)}
                            onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                            <td style={tdStyle}>{fmtFechaCorta(f.fecha_factura)}</td>
                            <td style={tdStyle}>{f.proveedor_nombre||'—'}</td>
                            <td style={{...tdStyle,color:COLORS.mut,fontSize:12}}>{f.nif_emisor||'—'}</td>
                            <td style={{...tdStyle,textAlign:'right',fontWeight:500}}>{fmtNum(f.total,2)}</td>
                            <td style={tdStyle}><span style={{background:COLORS.bg,fontSize:11,padding:'3px 9px',borderRadius:0,border:`0.5px solid ${COLORS.brd}`,fontFamily:FONT.body,color:COLORS.sec}}>{catLbl}</span></td>
                            {f.pdf_drive_url?(
                              <td style={tdDoc} onClick={e=>{e.stopPropagation();window.open(f.pdf_drive_url!,'_blank','noopener,noreferrer')}} title="Ver factura">
                                <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:'100%',height:'100%',minHeight:38,fontSize:22,lineHeight:1,color:COLORS.pri,cursor:'pointer',userSelect:'none'}}>📎</div>
                              </td>
                            ):(
                              <td style={tdDoc}>
                                <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:'100%',height:'100%',minHeight:38,fontSize:18,lineHeight:1,color:NAR,fontWeight:600}}>✕</div>
                              </td>
                            )}
                            <td style={tdStyle}><span style={{background:est.bg,color:est.col,fontFamily:FONT.heading,fontSize:9,letterSpacing:'0.5px',padding:'2px 8px',borderRadius:0,fontWeight:500}}>{est.lbl}</span></td>
                            <td style={{...tdDoc,padding:'6px 8px'}} onClick={e=>e.stopPropagation()}>
                              {f.estado==='no_conciliable'?(
                                <span style={{fontSize:11,color:COLORS.mut,fontFamily:FONT.body}}>descartada</span>
                              ):(
                                <button
                                  onClick={()=>setDescartar({
                                    id:f.id, pdf_original_name:f.pdf_original_name, nif_emisor:f.nif_emisor,
                                    proveedor_nombre:f.proveedor_nombre, fecha_factura:f.fecha_factura,
                                    total:f.total, titular_id:f.titular_id,
                                  })}
                                  title="Descartar"
                                  style={{background:'transparent',border:`0.5px solid ${COLORS.brd}`,borderRadius:0,color:NAR,cursor:'pointer',padding:'5px 9px',fontSize:11,fontFamily:FONT.body}}>
                                  Descartar
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {!loading&&facturasOrdenadas.length===0&&(
                        <tr><td colSpan={8} style={{...tdStyle,textAlign:'center',color:COLORS.mut,padding:'40px 12px'}}>Sin facturas para los filtros seleccionados</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Papel>
            </div>
          </>
        )}

        {activeTab==='ventas'&&(
          <>
            <div style={{display:'flex',gap:10,alignItems:'center',marginTop:14,marginBottom:14}}>
              <ToggleTitular titularKey={titularKey} setTitularKey={setTitularKey}/>
            </div>
            <Papel ceja={NAR} style={{marginTop:24,padding:60,textAlign:'center',color:COLORS.mut,fontFamily:FONT.body,fontSize:14}}>
              Subida de resúmenes de ventas (Uber Eats CSV, Glovo, Just Eat) · Próximamente
            </Papel>
          </>
        )}

        {activeTab==='exportar'&&(
          <TabExportar
            titularKey={titularKey}
            setTitularKey={setTitularKey}
            titularId={titularActivo?.id ?? null}
            mesLabel={mesLabel}
            plazoLabel={plazoLabel}
            facturasMes={facturasMes}
            mesSeleccionado={mesSeleccionado}
          />
        )}
      </div>

      {descartar && (
        <ModalDescartarFactura
          factura={descartar}
          onClose={()=>setDescartar(null)}
          onDescartada={({soloEste,afectadas})=>{
            setDescartar(null)
            toast.success(soloEste?'Factura descartada.':`Regla creada: ${afectadas} factura${afectadas!==1?'s':''} descartada${afectadas!==1?'s':''}.`)
            recargarFacturas()
          }}
        />
      )}
    </PantallaCantera>
  )
}

function ToggleTitular({titularKey,setTitularKey}:{titularKey:'ruben'|'emilio';setTitularKey:(k:'ruben'|'emilio')=>void}){
  return(
    <div style={{display:'flex',gap:5}}>
      {(['ruben','emilio'] as const).map(t=>{
        const isActive=titularKey===t
        const bg: string = isActive?(t==='ruben'?COLOR_RUBEN:COLOR_EMILIO):BLANCO
        const clr: string = isActive?BLANCO:OSC
        const bd: string = isActive?'none':`0.5px solid ${COLORS.brd}`
        return(
          <button key={t} onClick={()=>setTitularKey(t)}
            style={{padding:'8px 18px',borderRadius:0,border:bd,background:bg,fontFamily:FONT.body,fontSize:13,color:clr,cursor:'pointer',fontWeight:500,minWidth:90}}>
            {t==='ruben'?'Rubén':'Emilio'}
          </button>
        )
      })}
    </div>
  )
}

function TabExportar({titularKey,setTitularKey,titularId,mesLabel,facturasMes,mesSeleccionado}:{
  titularKey:'ruben'|'emilio'; setTitularKey:(k:'ruben'|'emilio')=>void
  titularId: string|null
  mesLabel:string; plazoLabel:string; facturasMes:FacturaRow[]; mesSeleccionado:string
}){
  const [facturasConfirmadas,setFacturasConfirmadas]=useState(false)
  const [ventasConfirmadas,setVentasConfirmadas]=useState(false)
  const [numResumenesUber,setNumResumenesUber]=useState(0)
  const [checkingUber,setCheckingUber]=useState(true)
  const [generando,setGenerando]=useState(false)
  const [errorZip,setErrorZip]=useState<string|null>(null)

  const numFacturas=facturasMes.length
  const todoOk=facturasConfirmadas&&ventasConfirmadas

  useEffect(()=>{
    if(!mesSeleccionado) return
    setCheckingUber(true)
    setVentasConfirmadas(false)
    supabase.from('ventas_resumenes')
      .select('id',{count:'exact',head:true})
      .eq('mes',mesSeleccionado)
      .eq('plataforma','uber')
      .then(({count})=>{ setNumResumenesUber(count??0); setCheckingUber(false) })
  },[mesSeleccionado,titularKey])

  async function handleGenerarZip() {
    if(!todoOk||!titularId||generando) return
    setGenerando(true)
    setErrorZip(null)
    try {
      const { data, error } = await supabase.functions.invoke('generar-zip-gestoria', {
        body: { mes: mesSeleccionado, titular_id: titularId },
      })
      if (error) {
        const ctx: any = (error as any).context
        let detail = error.message || 'Error'
        if (ctx) {
          try {
            const txt = await ctx.text?.()
            if (txt) {
              try { const j = JSON.parse(txt); detail = `${j.error || detail}${j.step?` (step=${j.step})`:''}`  }
              catch { detail = txt.slice(0,200) }
            }
          } catch {}
        }
        setErrorZip(`Error: ${detail}`)
        return
      }
      if (!data || typeof data !== 'object' || !('url' in (data as any))) {
        setErrorZip('Respuesta inválida del servidor')
        return
      }
      const { url, filename } = data as { url: string; filename: string }
      const a = document.createElement('a')
      a.href = url
      a.download = filename || `gestoria_${mesSeleccionado}.zip`
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch(err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      setErrorZip(`Error: ${msg}`)
    } finally {
      setGenerando(false)
    }
  }

  return(
    <>
      <div style={{display:'flex',gap:10,alignItems:'center',marginTop:14,marginBottom:14}}>
        <ToggleTitular titularKey={titularKey} setTitularKey={setTitularKey}/>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>

        <Papel ceja={GRANATE} pad="20px 22px">
          <p style={{fontFamily:FONT.heading,fontSize:11,letterSpacing:'1.5px',color:COLORS.mut,textTransform:'uppercase',margin:'0 0 14px'}}>
            Antes de exportar
          </p>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:facturasConfirmadas?VERDE_S:ROSA_S,borderRadius:0}}>
              <input type="checkbox" checked={facturasConfirmadas} onChange={e=>setFacturasConfirmadas(e.target.checked)}
                style={{width:18,height:18,accentColor:VERDE,cursor:'pointer',flexShrink:0}}/>
              <span style={{flex:1,fontSize:13,color:facturasConfirmadas?VERDE:GRANATE,fontWeight:500}}>
                Todas las facturas del mes importadas
              </span>
              <span style={{fontSize:12,color:facturasConfirmadas?VERDE:ROJO}}>{numFacturas} facturas</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:ventasConfirmadas?VERDE_S:ROSA_S,borderRadius:0}}>
              <input type="checkbox" checked={ventasConfirmadas} onChange={e=>setVentasConfirmadas(e.target.checked)}
                style={{width:18,height:18,accentColor:VERDE,cursor:'pointer',flexShrink:0}}/>
              <span style={{flex:1,fontSize:13,color:ventasConfirmadas?VERDE:GRANATE,fontWeight:500}}>
                Ventas Uber Eats subidas
              </span>
              <span style={{fontSize:12,color:ventasConfirmadas?VERDE:ROJO}}>
                {checkingUber?'Comprobando…':`${numResumenesUber} resúmenes`}
              </span>
            </div>
          </div>
        </Papel>

        <Papel ceja={NAR} pad="20px 22px">
          <p style={{fontFamily:FONT.heading,fontSize:11,letterSpacing:'1.5px',color:COLORS.mut,textTransform:'uppercase',margin:'0 0 14px'}}>El ZIP contendrá</p>
          <div style={{display:'flex',flexDirection:'column',gap:10,fontSize:13,fontFamily:FONT.body}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:16}}>📁</span>
              <span><strong style={{fontWeight:500}}>Facturas</strong> · {numFacturas} Docs</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:16}}>📁</span>
              <span><strong style={{fontWeight:500}}>Ventas</strong> · {checkingUber?'…':`${numResumenesUber} Resumen${numResumenesUber===1?'':'es'}`} Uber</span>
            </div>
          </div>
        </Papel>

        {errorZip&&(
          <div style={{background:ROSA_S,border:`2px solid ${ROJO}`,borderRadius:0,padding:'10px 14px',fontSize:13,color:COLORS.redSL,fontFamily:FONT.body,wordBreak:'break-word'}}>
            ⚠️ {errorZip}
          </div>
        )}

        <button
          disabled={!todoOk||generando}
          onClick={handleGenerarZip}
          style={{width:'100%',padding:'14px 20px',background:todoOk&&!generando?GRANATE:BORDE_SUAVE,color:BLANCO,border:`3px solid ${INK}`,borderRadius:0,boxShadow:todoOk&&!generando?SHADOW_DURA:'none',fontSize:14,fontWeight:500,fontFamily:FONT.body,cursor:todoOk&&!generando?'pointer':'not-allowed'}}>
          {generando?'Generando ZIP…':`Generar paquete ZIP · ${mesLabel}`}
        </button>
      </div>
    </>
  )
}

interface NodoArbolItemProps {
  node:DriveNode; level:number; filtroActivo:DriveFiltro; expansionMap:Record<string,boolean>
  titularColor:string; onSelect:(f:DriveFiltro)=>void; onToggleExpand:(k:string)=>void
}
function nodeKey(f:DriveFiltro):string{
  if(f.mes) return `m:${f.titular_id}:${f.anio}:${f.trimestre}:${f.mes}`
  if(f.trimestre) return `q:${f.titular_id}:${f.anio}:${f.trimestre}`
  if(f.anio) return `y:${f.titular_id}:${f.anio}`
  return `t:${f.titular_id}`
}
function NodoArbolItem({node,level,filtroActivo,expansionMap,titularColor,onSelect,onToggleExpand}:NodoArbolItemProps){
  const tieneHijos=!!(node.children&&node.children.length>0)
  const myKey=nodeKey(node.filtro); const expandido=expansionMap[myKey]??false
  const esActivo=filtroActivo.titular_id===node.filtro.titular_id&&filtroActivo.anio===node.filtro.anio&&filtroActivo.trimestre===node.filtro.trimestre&&filtroActivo.mes===node.filtro.mes

  let nodoBg: string = 'transparent'
  let nodoColor: string = COLORS.pri
  let nodoFf: string = FONT.body
  let nodoFs: number = 13
  let nodoFw: number = 400
  let nodoBl: string = '3px solid transparent'

  if(node.kind==='titular'){nodoColor=titularColor;nodoFf=FONT.heading;nodoFs=14;nodoFw=600;nodoBl=`3px solid ${titularColor}`}
  else if(node.kind==='anio'){nodoBg=ANIO_BG;nodoColor=DRIVE_ANIO_TEXT;nodoFf=FONT.heading;nodoFw=600}
  else if(node.kind==='trim'&&node.trimNum){const p=TRIM_PALETTE[node.trimNum];nodoBg=p.bg;nodoColor=p.headDark;nodoFf=FONT.heading;nodoFw=700}
  else if(node.kind==='mes'&&node.trimNum){nodoBg=TRIM_PALETTE[node.trimNum].bg+'60'}
  if(esActivo){nodoBg=node.kind==='trim'&&node.trimNum?TRIM_PALETTE[node.trimNum].headDark:titularColor;nodoColor=BLANCO;nodoFw=700;nodoBl=`3px solid ${nodoBg}`}

  return(
    <div>
      <div style={{display:'flex',alignItems:'center',marginBottom:1}}>
        {tieneHijos?(
          <button type="button" onClick={e=>{e.stopPropagation();onToggleExpand(myKey)}}
            style={{width:24,height:28,padding:0,border:'none',background:'transparent',cursor:'pointer',color:COLORS.sec,fontSize:18,fontWeight:700,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>
            {expandido?'▾':'▸'}
          </button>
        ):(
          <span style={{width:24,display:'inline-block',textAlign:'center',color:COLORS.mut,flexShrink:0}}>·</span>
        )}
        <button type="button" onClick={()=>onSelect(node.filtro)}
          style={{width:'100%',display:'flex',alignItems:'center',padding:'6px 8px',paddingLeft:6+level*12,background:nodoBg,border:'none',borderLeft:nodoBl,borderRadius:0,cursor:'pointer',fontFamily:nodoFf,fontSize:nodoFs,textAlign:'left',color:nodoColor,fontWeight:nodoFw,opacity:node.count===0&&!esActivo?0.5:1,marginBottom:node.kind==='titular'?4:1,letterSpacing:node.kind==='titular'?'1px':'normal',textTransform:node.kind==='titular'?'uppercase':'none'}}>
          <span style={{flex:1}}>{node.label}</span>
          <span style={{color:esActivo?BLANCO:COLORS.mut,fontSize:11,marginLeft:8,fontWeight:500,opacity:esActivo?0.9:1}}>{node.count>0?node.count:'—'}</span>
        </button>
      </div>
      {expandido&&tieneHijos&&(
        <div>
          {node.children!.map((child,idx)=>(
            <NodoArbolItem key={`${child.label}-${idx}`} node={child} level={level+1} filtroActivo={filtroActivo} expansionMap={expansionMap} titularColor={titularColor} onSelect={onSelect} onToggleExpand={onToggleExpand}/>
          ))}
        </div>
      )}
    </div>
  )
}
