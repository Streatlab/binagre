/**
 * GestorDocumental — Tabs: Facturas / Ventas / Exportar
 * v13: muestra error completo (status, step, body) en pantalla para diagnosticar
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

type TabId = 'facturas' | 'ventas' | 'exportar'
type SortColumn = 'fecha' | 'proveedor' | 'nif' | 'importe' | 'categoria' | 'doc' | 'estado'
type SortDir = 'asc' | 'desc'

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

const COLOR_RUBEN  = '#F26B1F'
const COLOR_EMILIO = '#1E5BCC'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const MESES_ES = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const MESES_POR_TRIM: Record<number, number[]> = { 1:[1,2,3], 2:[4,5,6], 3:[7,8,9], 4:[10,11,12] }
const TRIM_PALETTE: Record<number, {bg:string;headDark:string}> = {
  1:{bg:'#dde8f4',headDark:'#3a5f80'},
  2:{bg:'#dee9d4',headDark:'#3d6027'},
  3:{bg:'#f4e8c8',headDark:'#7d5a1a'},
  4:{bg:'#e3d8eb',headDark:'#4a3163'},
}
const ANIO_BG = '#fbe5e8'

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

function colorEstado(estado: string|null): {bg:string;col:string;lbl:string} {
  switch (estado) {
    case 'asociada':                 return {bg:'#e8f5ec',col:COLORS.ok,   lbl:'CONCILIADA'}
    case 'pendiente_revision':       return {bg:'#fcf0dc',col:COLORS.warn, lbl:'PEND. REV.'}
    case 'pendiente_titular_manual': return {bg:'#fcf0dc',col:COLORS.warn, lbl:'FALTA TITULAR'}
    case 'sin_match':                return {bg:'#fce8e8',col:COLORS.redSL,lbl:'SIN MATCH'}
    case 'historica':                return {bg:'#eef0f4',col:COLORS.mut,  lbl:'HISTÓRICA'}
    case 'duplicada':                return {bg:'#fce8e8',col:COLORS.redSL,lbl:'DUPLICADA'}
    case 'error':                    return {bg:'#fce8e8',col:COLORS.redSL,lbl:'ERROR'}
    case 'procesando':               return {bg:'#eef0f4',col:COLORS.mut,  lbl:'PROCESANDO'}
    default:                         return {bg:'#eef0f4',col:COLORS.mut,  lbl:(estado||'—').toUpperCase()}
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
  const [sortColumn, setSortColumn] = useState<SortColumn>('fecha')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [mesesDisp, setMesesDisp] = useState<{valor:string;label:string}[]>([])
  const [mesSeleccionado, setMesSeleccionado] = useState<string>('')
  const [bannerVisible, setBannerVisible] = useState(true)
  const [titulares, setTitulares] = useState<Titular[]>([])
  const [categorias, setCategorias] = useState<CategoriaPyg[]>([])
  const [facturas, setFacturas] = useState<FacturaRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    async function load() {
      const [tRes, cRes, fRes, minRes] = await Promise.all([
        supabase.from('titulares').select('id,nombre,color,carpeta_drive').order('orden'),
        supabase.from('categorias_pyg').select('id,nivel,parent_id,nombre,bloque,orden').eq('activa',true).order('orden'),
        supabase.from('facturas')
          .select('id,fecha_factura,proveedor_nombre,total,estado,titular_id,pdf_drive_url,pdf_filename,pdf_original_name,categoria_factura,nif_emisor,tipo')
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

  function handleSort(col: SortColumn){
    if(sortColumn===col) setSortDir(d=>d==='asc'?'desc':'asc')
    else{setSortColumn(col);setSortDir('asc')}
  }

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

  const facturasOrdenadas = useMemo(()=>{
    const arr=[...facturasFiltradas]; const dv=sortDir==='asc'?1:-1
    arr.sort((a,b)=>{
      let va:string|number='',vb:string|number=''
      switch(sortColumn){
        case 'fecha':     va=a.fecha_factura??'';vb=b.fecha_factura??'';break
        case 'proveedor': va=(a.proveedor_nombre||'').toLowerCase();vb=(b.proveedor_nombre||'').toLowerCase();break
        case 'nif':       va=(a.nif_emisor||'').toLowerCase();vb=(b.nif_emisor||'').toLowerCase();break
        case 'importe':   va=Number(a.total||0);vb=Number(b.total||0);break
        case 'categoria': va=a.categoria_factura||'';vb=b.categoria_factura||'';break
        case 'doc':    va=a.pdf_drive_url?1:0;vb=b.pdf_drive_url?1:0;break
        case 'estado': va=a.estado||'';vb=b.estado||'';break
      }
      return va<vb?-dv:va>vb?dv:0
    })
    return arr
  },[facturasFiltradas,sortColumn,sortDir])

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
          style={{padding:'6px 10px',borderRadius:8,border:`0.5px solid ${T.brd}`,background:T.card,fontSize:13,fontFamily:FONT.body,color:T.pri,cursor:'pointer',display:'flex',alignItems:'center',gap:4,whiteSpace:'nowrap'}}>
          <span>{labelActual}</span>
          <span style={{fontSize:10}}>▾</span>
        </button>
        {open&&(
          <div style={{position:'absolute',top:'100%',right:0,background:T.card,border:`0.5px solid ${T.brd}`,borderRadius:8,zIndex:50,maxHeight:260,overflowY:'auto',boxShadow:'0 4px 12px rgba(0,0,0,0.06)',minWidth:180}}>
            {mesesDisp.map(m=>(
              <button key={m.valor} onClick={()=>{setMesSeleccionado(m.valor);setOpen(false)}}
                style={{display:'block',width:'100%',textAlign:'left',padding:'8px 12px',background:m.valor===mesSeleccionado?'#FF475715':'transparent',color:m.valor===mesSeleccionado?'#FF4757':T.mut,fontFamily:FONT.body,fontSize:13,border:'none',cursor:'pointer'}}>
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
  const islaStyle: CSSProperties = {background:COLORS.card,border:`0.5px solid ${COLORS.brd}`,borderRadius:8,padding:'4px 6px',display:'flex',alignItems:'center',gap:4}

  return(
    <div style={{fontFamily:FONT.body,position:'relative'}}>

      {bannerVisible&&(
        <div style={{background:'#fff3cd',border:'1px solid #ffc107',borderRadius:8,padding:'8px 16px',marginBottom:12,display:'flex',alignItems:'center',gap:12,fontFamily:FONT.body,fontSize:13,color:'#111111'}}>
          <span style={{flexShrink:0,fontSize:14}}>⚠️</span>
          <span style={{flex:1,fontSize:13}}>
            Plazo gestoría <strong>{mesLabel}</strong>: {plazoLabel}
          </span>
          <button onClick={()=>setActiveTab('exportar')}
            style={{background:'#B01D23',color:'#ffffff',border:'none',borderRadius:6,padding:'6px 12px',fontSize:12,fontFamily:'Oswald, sans-serif',fontWeight:600,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.05em',flexShrink:0}}>
            Exportar ZIP
          </button>
          <button onClick={()=>setBannerVisible(false)}
            style={{background:'none',border:'none',cursor:'pointer',color:'#666',fontSize:16,padding:'0 4px',flexShrink:0,lineHeight:1}}
            title="Cerrar">×</button>
        </div>
      )}

      <div style={groupStyle(T)}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:18,flexWrap:'wrap',gap:12}}>
          <h2 style={{color:COLORS.redSL,fontFamily:FONT.heading,fontSize:22,fontWeight:600,letterSpacing:'3px',margin:0,textTransform:'uppercase'}}>
            GESTOR DOCUMENTAL
          </h2>
          <MesDropdown/>
        </div>

        <TabsPastilla tabs={TABS} activeId={activeTab} onChange={(id)=>setActiveTab(id as TabId)}/>

        {activeTab==='facturas'&&(
          <>
            <div style={{display:'flex',gap:10,alignItems:'center',marginTop:14,marginBottom:14,flexWrap:'wrap'}}>
              <ToggleTitular titularKey={titularKey} setTitularKey={setTitularKey}/>
              <input type="text" placeholder="Buscar proveedor, NIF, importe…" value={busqueda} onChange={e=>setBusqueda(e.target.value)}
                style={{flex:1,minWidth:220,height:36,padding:'0 12px',borderRadius:8,border:`0.5px solid ${COLORS.brd}`,background:COLORS.card,fontSize:13,fontFamily:FONT.body,color:COLORS.pri,outline:'none'}}/>
              <div style={{...islaStyle,padding:0,overflow:'hidden'}}>
                <select value={categoriaId} onChange={e=>setCategoria(e.target.value)}
                  style={{...DROPDOWN_BTN,border:'none',background:'transparent',minWidth:280,height:36,paddingRight:28,cursor:'pointer'}}>
                  <option value="todas">Todas las categorías</option>
                  {categoriasFlat.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:14}}>
              <div style={{background:COLORS.card,border:`0.5px solid ${COLORS.brd}`,borderRadius:14,padding:14,fontSize:13,fontFamily:FONT.body,alignSelf:'start'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,paddingBottom:8,borderBottom:`0.5px solid ${COLORS.brd}`}}>
                  <span style={{fontFamily:FONT.heading,fontSize:12,letterSpacing:'1.5px',textTransform:'uppercase',color:COLORS.pri,fontWeight:600}}>📁 Drive</span>
                  {driveFiltro.anio&&(
                    <button type="button" onClick={()=>setDriveFiltro({})}
                      style={{fontSize:10,padding:'3px 9px',border:'none',background:COLORS.group,borderRadius:4,color:COLORS.sec,cursor:'pointer',fontFamily:FONT.body}}>
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
              </div>

              <div style={{background:COLORS.card,border:`0.5px solid ${COLORS.brd}`,borderRadius:14,overflow:'hidden'}}>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'separate',borderSpacing:0}}>
                    <thead>
                      <tr>
                        {HEADERS.map(h=>{
                          const isActive=sortColumn===h.col
                          return(
                            <th key={h.col} onClick={()=>handleSort(h.col)}
                              style={{fontFamily:FONT.heading,fontSize:10,fontWeight:500,letterSpacing:'2px',color:isActive?COLORS.redSL:COLORS.mut,textTransform:'uppercase',textAlign:h.align,padding:'10px 12px',background:COLORS.group,borderBottom:`0.5px solid ${COLORS.brd}`,whiteSpace:'nowrap',cursor:'pointer',userSelect:'none'}}>
                              {h.label}{isActive?(sortDir==='asc'?' ↑':' ↓'):''}
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {loading&&<tr><td colSpan={7} style={{...tdStyle,textAlign:'center',color:COLORS.mut,padding:'40px 12px'}}>Cargando…</td></tr>}
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
                            <td style={tdStyle}><span style={{background:COLORS.bg,fontSize:11,padding:'3px 9px',borderRadius:4,border:`0.5px solid ${COLORS.brd}`,fontFamily:FONT.body,color:COLORS.sec}}>{catLbl}</span></td>
                            {f.pdf_drive_url?(
                              <td style={tdDoc} onClick={e=>{e.stopPropagation();window.open(f.pdf_drive_url!,'_blank','noopener,noreferrer')}} title="Ver factura">
                                <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:'100%',height:'100%',minHeight:38,fontSize:22,lineHeight:1,color:COLORS.pri,cursor:'pointer',userSelect:'none'}}>📎</div>
                              </td>
                            ):(
                              <td style={tdDoc}>
                                <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:'100%',height:'100%',minHeight:38,fontSize:18,lineHeight:1,color:'#F26B1F',fontWeight:600}}>✕</div>
                              </td>
                            )}
                            <td style={tdStyle}><span style={{background:est.bg,color:est.col,fontFamily:FONT.heading,fontSize:9,letterSpacing:'0.5px',padding:'2px 8px',borderRadius:9,fontWeight:500}}>{est.lbl}</span></td>
                          </tr>
                        )
                      })}
                      {!loading&&facturasOrdenadas.length===0&&(
                        <tr><td colSpan={7} style={{...tdStyle,textAlign:'center',color:COLORS.mut,padding:'40px 12px'}}>Sin facturas para los filtros seleccionados</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab==='ventas'&&(
          <>
            <div style={{display:'flex',gap:10,alignItems:'center',marginTop:14,marginBottom:14}}>
              <ToggleTitular titularKey={titularKey} setTitularKey={setTitularKey}/>
            </div>
            <div style={{marginTop:24,padding:60,textAlign:'center',background:COLORS.card,border:`0.5px solid ${COLORS.brd}`,borderRadius:14,color:COLORS.mut,fontFamily:FONT.body,fontSize:14}}>
              Subida de resúmenes de ventas (Uber Eats CSV, Glovo, Just Eat) · Próximamente
            </div>
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
    </div>
  )
}

function ToggleTitular({titularKey,setTitularKey}:{titularKey:'ruben'|'emilio';setTitularKey:(k:'ruben'|'emilio')=>void}){
  return(
    <div style={{display:'flex',gap:5}}>
      {(['ruben','emilio'] as const).map(t=>{
        const isActive=titularKey===t
        const bg: string = isActive?(t==='ruben'?COLOR_RUBEN:COLOR_EMILIO):'#fff'
        const clr: string = isActive?'#fff':'#3a4050'
        const bd: string = isActive?'none':`0.5px solid ${COLORS.brd}`
        return(
          <button key={t} onClick={()=>setTitularKey(t)}
            style={{padding:'8px 18px',borderRadius:8,border:bd,background:bg,fontFamily:FONT.body,fontSize:13,color:clr,cursor:'pointer',fontWeight:500,minWidth:90}}>
            {t==='ruben'?'Rubén':'Emilio'}
          </button>
        )
      })}
    </div>
  )
}

function TabExportar({titularKey,setTitularKey,titularId,mesLabel,plazoLabel,facturasMes,mesSeleccionado}:{
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
      // Obtener token de sesión
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token ?? SUPABASE_ANON_KEY

      const url = `${SUPABASE_URL}/functions/v1/generar-zip-gestoria`
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ mes: mesSeleccionado, titular_id: titularId }),
      })

      // Si la respuesta no es OK, intenta leer body como texto y lo muestra entero
      if (!resp.ok) {
        const bodyText = await resp.text().catch(()=>'(no body)')
        let msg = `HTTP ${resp.status}`
        try {
          const j = JSON.parse(bodyText)
          if (j.error) msg += ` · ${j.error}`
          if (j.step)  msg += ` (step=${j.step})`
        } catch {
          msg += ` · ${bodyText.slice(0,200)}`
        }
        setErrorZip(msg)
        return
      }

      // Verifica que el content-type es zip antes de descargar
      const ct = resp.headers.get('content-type') || ''
      if (!ct.includes('zip')) {
        const bodyText = await resp.text().catch(()=>'(no body)')
        setErrorZip(`Respuesta inesperada (content-type=${ct}): ${bodyText.slice(0,200)}`)
        return
      }

      const buf = await resp.arrayBuffer()
      if (buf.byteLength === 0) {
        setErrorZip('ZIP vacío recibido del servidor')
        return
      }
      const blob = new Blob([buf], { type: 'application/zip' })
      const titNombre = titularKey==='ruben'?'RUBEN':'EMILIO'
      const zipName = `gestoria_${mesSeleccionado}_${titNombre}.zip`
      const dl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href=dl; a.download=zipName; a.click()
      URL.revokeObjectURL(dl)
    } catch(err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      setErrorZip(`Error red/cliente: ${msg}`)
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

        <div style={{background:COLORS.card,border:`0.5px solid ${COLORS.brd}`,borderRadius:14,padding:'20px 22px'}}>
          <p style={{fontFamily:FONT.heading,fontSize:11,letterSpacing:'1.5px',color:COLORS.mut,textTransform:'uppercase',margin:'0 0 14px'}}>
            Antes de exportar
          </p>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:facturasConfirmadas?'#EAF3DE':'#FCEBEB',borderRadius:8}}>
              <input type="checkbox" checked={facturasConfirmadas} onChange={e=>setFacturasConfirmadas(e.target.checked)}
                style={{width:18,height:18,accentColor:'#639922',cursor:'pointer',flexShrink:0}}/>
              <span style={{flex:1,fontSize:13,color:facturasConfirmadas?'#173404':'#501313',fontWeight:500}}>
                Todas las facturas del mes importadas
              </span>
              <span style={{fontSize:12,color:facturasConfirmadas?'#3B6D11':'#A32D2D'}}>{numFacturas} facturas</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:ventasConfirmadas?'#EAF3DE':'#FCEBEB',borderRadius:8}}>
              <input type="checkbox" checked={ventasConfirmadas} onChange={e=>setVentasConfirmadas(e.target.checked)}
                style={{width:18,height:18,accentColor:'#639922',cursor:'pointer',flexShrink:0}}/>
              <span style={{flex:1,fontSize:13,color:ventasConfirmadas?'#173404':'#501313',fontWeight:500}}>
                Ventas Uber Eats subidas
              </span>
              <span style={{fontSize:12,color:ventasConfirmadas?'#3B6D11':'#A32D2D'}}>
                {checkingUber?'Comprobando…':`${numResumenesUber} resúmenes`}
              </span>
            </div>
          </div>
        </div>

        <div style={{background:COLORS.card,border:`0.5px solid ${COLORS.brd}`,borderRadius:14,padding:'20px 22px'}}>
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
        </div>

        {errorZip&&(
          <div style={{background:'#fce8e8',border:'1px solid #f5c2c7',borderRadius:8,padding:'10px 14px',fontSize:13,color:COLORS.redSL,fontFamily:FONT.body,wordBreak:'break-word'}}>
            ⚠️ {errorZip}
          </div>
        )}

        <button
          disabled={!todoOk||generando}
          onClick={handleGenerarZip}
          style={{width:'100%',padding:'14px 20px',background:todoOk&&!generando?'#111':'#d0c8bc',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:500,fontFamily:FONT.body,cursor:todoOk&&!generando?'pointer':'not-allowed'}}>
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
  else if(node.kind==='anio'){nodoBg=ANIO_BG;nodoColor='#7a1218';nodoFf=FONT.heading;nodoFw=600}
  else if(node.kind==='trim'&&node.trimNum){const p=TRIM_PALETTE[node.trimNum];nodoBg=p.bg;nodoColor=p.headDark;nodoFf=FONT.heading;nodoFw=700}
  else if(node.kind==='mes'&&node.trimNum){nodoBg=TRIM_PALETTE[node.trimNum].bg+'60'}
  if(esActivo){nodoBg=node.kind==='trim'&&node.trimNum?TRIM_PALETTE[node.trimNum].headDark:titularColor;nodoColor='#fff';nodoFw=700;nodoBl=`3px solid ${nodoBg}`}

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
          style={{width:'100%',display:'flex',alignItems:'center',padding:'6px 8px',paddingLeft:6+level*12,background:nodoBg,border:'none',borderLeft:nodoBl,borderRadius:node.kind==='mes'?'0 4px 4px 0':'0 6px 6px 0',cursor:'pointer',fontFamily:nodoFf,fontSize:nodoFs,textAlign:'left',color:nodoColor,fontWeight:nodoFw,opacity:node.count===0&&!esActivo?0.5:1,marginBottom:node.kind==='titular'?4:1,letterSpacing:node.kind==='titular'?'1px':'normal',textTransform:node.kind==='titular'?'uppercase':'none'}}>
          <span style={{flex:1}}>{node.label}</span>
          <span style={{color:esActivo?'#fff':COLORS.mut,fontSize:11,marginLeft:8,fontWeight:500,opacity:esActivo?0.9:1}}>{node.count>0?node.count:'—'}</span>
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
