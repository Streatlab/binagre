import { useEffect, useState, useMemo, useCallback } from 'react'
import React from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, pageTitleStyle, groupStyle } from '@/styles/tokens'
import type { TokenSet } from '@/styles/tokens'
import { Printer, Download, ShoppingCart, Search, X, Plus, Minus, Save, FolderOpen, AlertTriangle, TrendingUp, ChevronDown, ChevronRight, Link } from 'lucide-react'
import { jsPDF } from 'jspdf'

/* ═══ TYPES ═══ */

interface Prov { id: string; abv: string; nombre: string; nombre_completo: string; categoria: string }
interface Ing { id: string; nombre: string; categoria: string | null; formato: string | null; ud_std: string | null; precio_activo: number | null; precio1: number | null; precio2: number | null; precio3: number | null; stock_minimo: number; stock_actual: number; proveedor_abv: string }
interface Seccion { id: string; nombre: string; orden: number }
interface Partida { id: string; seccion_id: string; nombre: string; orden: number; eps_id: string | null }
interface EpsLinea { eps_id: string; ingrediente_id: string | null; ingrediente_nombre: string; cantidad: number; unidad: string }
interface ListaGuardada { id: string; nombre: string; fecha: string; total: number; items: { id: string; cantidad: number }[]; created_at: string }

/* ═══ HELPERS ═══ */

function abv(n: string): string { const m = n.match(/_([A-Z]{2,4})$/); return m ? m[1] : '???' }
function limpio(n: string): string { return n.replace(/_[A-Z]{2,4}$/, '').trim() }
function eur(v: number): string { return v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

function precioMediaHist(i: Ing): number | null {
  const vals = [i.precio1, i.precio2, i.precio3].filter(v => v && v > 0) as number[]
  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function alertaPrecio(i: Ing): { pct: number; subida: boolean } | null {
  const media = precioMediaHist(i)
  if (!media || !i.precio_activo || media === 0) return null
  const pct = ((i.precio_activo - media) / media) * 100
  if (Math.abs(pct) < 10) return null
  return { pct: Math.round(pct), subida: pct > 0 }
}

/* ═══ PDF ═══ */

const RD: [number, number, number] = [138, 26, 34]
const RS: [number, number, number] = [240, 216, 218]
const GR: [number, number, number] = [201, 201, 201]

function crearPDF(grupos: [string, Ing[]][], provMap: Record<string, Prov>, cantidades: Record<string, number>) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PW = doc.internal.pageSize.getWidth(); const M = 14; const W = PW - M * 2
  let y = M
  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...RD)
  doc.text('LISTA DE COMPRA', M, y + 5)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90)
  doc.text(hoy, PW - M, y + 5, { align: 'right' })
  y += 9; doc.setDrawColor(...RD); doc.setLineWidth(0.5); doc.line(M, y, PW - M, y); y += 6

  for (const [a, items] of grupos) {
    const con = items.filter(i => (cantidades[i.id] || 0) > 0)
    if (con.length === 0) continue
    if (y > 260) { doc.addPage(); y = M }
    doc.setFillColor(...RS); doc.rect(M, y, W, 7, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...RD)
    doc.text(`${(provMap[a]?.nombre ?? a).toUpperCase()}  (${con.length})`, M + 3, y + 5); y += 7
    doc.setFillColor(250, 242, 243); doc.rect(M, y, W, 5, 'F')
    doc.setFontSize(8)
    doc.text('Producto', M + 2, y + 3.5); doc.text('Fmt', M + 80, y + 3.5); doc.text('Ud.', M + 105, y + 3.5)
    doc.text('Cant.', M + 122, y + 3.5); doc.text('Precio', M + 140, y + 3.5); doc.text('Total', W + M - 2, y + 3.5, { align: 'right' }); y += 5
    let tp = 0
    for (const ing of con) {
      if (y > 270) { doc.addPage(); y = M }
      const q = cantidades[ing.id] || 0; const t = q * (ing.precio_activo || 0); tp += t
      doc.setDrawColor(...GR); doc.setLineWidth(0.1); doc.line(M, y + 4.5, M + W, y + 4.5)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(30)
      doc.text(limpio(ing.nombre), M + 2, y + 3.5)
      doc.setTextColor(90); doc.text(ing.formato ?? '', M + 80, y + 3.5); doc.text(ing.ud_std ?? '', M + 105, y + 3.5)
      doc.setFont('helvetica', 'bold'); doc.setTextColor(30); doc.text(q.toString(), M + 124, y + 3.5)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(90); doc.text(ing.precio_activo ? eur(ing.precio_activo) : '', M + 137, y + 3.5)
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...RD); doc.text(eur(t), W + M - 2, y + 3.5, { align: 'right' }); y += 5
    }
    doc.setDrawColor(...[176, 29, 35] as [number, number, number]); doc.setLineWidth(0.3); doc.line(M + 120, y, M + W, y)
    doc.setFontSize(10); doc.text(`Total: ${eur(tp)}`, W + M - 2, y + 4, { align: 'right' }); y += 10
  }
  return doc
}

/* ═══ COMPONENT ═══ */

export default function ListaCompra() {
  const { T, isDark } = useTheme()
  const [proveedores, setProveedores] = useState<Prov[]>([])
  const [ingredientes, setIngredientes] = useState<Ing[]>([])
  const [secciones, setSecciones] = useState<Seccion[]>([])
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [epsLineas, setEpsLineas] = useState<EpsLinea[]>([])
  const [listas, setListas] = useState<ListaGuardada[]>([])
  const [loading, setLoading] = useState(true)

  const [filtroP, setFiltroP] = useState('TODOS')
  const [filtroC, setFiltroC] = useState('TODAS')
  const [busq, setBusq] = useState('')
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [tandas, setTandas] = useState<Record<string, number>>({})
  const [prodOpen, setProdOpen] = useState(false)
  const [modalGuardar, setModalGuardar] = useState(false)
  const [modalCargar, setModalCargar] = useState(false)
  const [nombreLista, setNombreLista] = useState('')

  useEffect(() => {
    (async () => {
      setLoading(true)
      const [pR, iR, sR, paR, elR, lR] = await Promise.all([
        supabase.from('config_proveedores').select('*').eq('activo', true).order('nombre'),
        supabase.from('ingredientes').select('id,nombre,categoria,formato,ud_std,precio_activo,precio1,precio2,precio3,stock_minimo,stock_actual,activo').eq('activo', true).order('categoria').order('nombre'),
        supabase.from('produccion_secciones').select('*').eq('activa', true).order('orden'),
        supabase.from('produccion_partidas').select('*').eq('activa', true).order('orden'),
        supabase.from('eps_lineas').select('eps_id,ingrediente_id,ingrediente_nombre,cantidad,unidad'),
        supabase.from('listas_compra').select('*').order('created_at', { ascending: false }).limit(20),
      ])
      setProveedores((pR.data ?? []) as Prov[])
      setIngredientes(((iR.data ?? []) as any[]).map(i => ({
        ...i,
        precio_activo: i.precio_activo ? Number(i.precio_activo) : null,
        precio1: i.precio1 ? Number(i.precio1) : null,
        precio2: i.precio2 ? Number(i.precio2) : null,
        precio3: i.precio3 ? Number(i.precio3) : null,
        stock_minimo: Number(i.stock_minimo) || 0,
        stock_actual: Number(i.stock_actual) || 0,
        proveedor_abv: abv(i.nombre),
      })))
      setSecciones((sR.data ?? []) as Seccion[])
      setPartidas((paR.data ?? []) as Partida[])
      setEpsLineas(((elR.data ?? []) as any[]).map(l => ({ ...l, cantidad: Number(l.cantidad) || 0 })))
      setListas((lR.data ?? []) as ListaGuardada[])
      setLoading(false)
    })()
  }, [])

  const provMap = useMemo(() => { const m: Record<string, Prov> = {}; proveedores.forEach(p => { m[p.abv] = p }); return m }, [proveedores])
  const ingMap = useMemo(() => { const m: Record<string, Ing> = {}; ingredientes.forEach(i => { m[i.id] = i; m[i.nombre] = i }); return m }, [ingredientes])
  const categorias = useMemo(() => Array.from(new Set(ingredientes.map(i => i.categoria).filter(Boolean) as string[])).sort(), [ingredientes])

  /* ─── Feature 1: Producción → ingredientes ─── */
  const calcDesdeProduccion = useCallback(() => {
    const nuevo: Record<string, number> = { ...cantidades }
    for (const part of partidas) {
      const t = tandas[part.id] || 0
      if (t <= 0 || !part.eps_id) continue
      const lineas = epsLineas.filter(l => l.eps_id === part.eps_id)
      for (const l of lineas) {
        const ing = l.ingrediente_id ? ingMap[l.ingrediente_id] : ingMap[l.ingrediente_nombre]
        if (!ing) continue
        nuevo[ing.id] = (nuevo[ing.id] || 0) + Math.ceil(l.cantidad * t)
      }
    }
    setCantidades(nuevo)
  }, [tandas, partidas, epsLineas, ingMap, cantidades])

  /* ─── Feature 3: Auto-prefill stock mínimo ─── */
  const prefillStock = useCallback(() => {
    const nuevo: Record<string, number> = { ...cantidades }
    ingredientes.forEach(i => {
      if (i.stock_minimo > 0 && i.stock_actual < i.stock_minimo) {
        const falta = Math.ceil(i.stock_minimo - i.stock_actual)
        nuevo[i.id] = Math.max(nuevo[i.id] || 0, falta)
      }
    })
    setCantidades(nuevo)
  }, [ingredientes, cantidades])

  /* ─── Feature 4: filtrado + dedup ─── */
  const filtrados = useMemo(() => {
    const seen = new Set<string>()
    return ingredientes.filter(i => {
      if (filtroP !== 'TODOS' && i.proveedor_abv !== filtroP) return false
      if (filtroC !== 'TODAS' && i.categoria !== filtroC) return false
      if (busq && !i.nombre.toLowerCase().includes(busq.toLowerCase())) return false
      if (/^agua/i.test(i.nombre)) return false
      if (i.proveedor_abv === 'EPS' || i.proveedor_abv === 'MRM') return false
      const key = i.nombre.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [ingredientes, filtroP, filtroC, busq])

  const grupos = useMemo(() => {
    const g: Record<string, Ing[]> = {}
    filtrados.forEach(i => { if (!g[i.proveedor_abv]) g[i.proveedor_abv] = []; g[i.proveedor_abv].push(i) })
    return Object.entries(g).sort(([a], [b]) => (provMap[a]?.nombre ?? a).localeCompare(provMap[b]?.nombre ?? b))
  }, [filtrados, provMap])

  const totalGen = useMemo(() => filtrados.reduce((s, i) => s + (cantidades[i.id] || 0) * (i.precio_activo || 0), 0), [filtrados, cantidades])
  const enLista = useMemo(() => filtrados.filter(i => (cantidades[i.id] || 0) > 0).length, [filtrados, cantidades])

  /* ─── Feature 6: alertas precio ─── */
  const alertasPrecio = useMemo(() => {
    let count = 0
    filtrados.forEach(i => { if (alertaPrecio(i)) count++ })
    return count
  }, [filtrados])

  const alertasStock = useMemo(() => ingredientes.filter(i => i.stock_minimo > 0 && i.stock_actual < i.stock_minimo).length, [ingredientes])

  const setCant = (id: string, v: number) => setCantidades(prev => ({ ...prev, [id]: Math.max(0, v) }))

  /* ─── Feature 2: guardar / cargar ─── */
  const guardarLista = async () => {
    const items = Object.entries(cantidades).filter(([, v]) => v > 0).map(([id, cantidad]) => ({ id, cantidad }))
    const nombre = nombreLista.trim() || `Lista ${new Date().toLocaleDateString('es-ES')}`
    const { data } = await supabase.from('listas_compra').insert({ nombre, total: totalGen, items }).select().single()
    if (data) setListas(prev => [data as ListaGuardada, ...prev])
    setModalGuardar(false); setNombreLista('')
  }

  const cargarLista = (l: ListaGuardada) => {
    const nuevo: Record<string, number> = {}
    l.items.forEach(it => { nuevo[it.id] = it.cantidad })
    setCantidades(nuevo); setModalCargar(false)
  }

  const borrarLista = async (id: string) => {
    await supabase.from('listas_compra').delete().eq('id', id)
    setListas(prev => prev.filter(l => l.id !== id))
  }

  const handlePrint = () => { const d = crearPDF(grupos, provMap, cantidades); const u = d.output('bloburl'); const w = window.open(u as unknown as string, '_blank'); if (w) w.addEventListener('load', () => { try { w.focus(); w.print() } catch {} }) }
  const handlePDF = () => { crearPDF(grupos, provMap, cantidades).save(`lista-compra-${new Date().toISOString().slice(0, 10)}.pdf`) }

  if (loading) return <div style={{ ...groupStyle(T), width: '100%' }}><h1 style={pageTitleStyle(T)}>Lista de Compra</h1><div style={{ padding: 36, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div></div>

  const hoy = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, c => c.toUpperCase())
  const provExt = proveedores.filter(p => p.abv !== 'EPS' && p.abv !== 'MRM')
  const partidasConEps = partidas.filter(p => p.eps_id)
  const partidasSinEps = partidas.filter(p => !p.eps_id)

  return (
    <div style={{ ...groupStyle(T), width: '100%' }}>
      <style>{CSS}</style>

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <ShoppingCart size={24} color="#B01D23" />
        <h1 style={{ ...pageTitleStyle(T), margin: 0 }}>Lista de Compra</h1>
      </div>

      {/* Botones */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 14, color: T.pri, letterSpacing: '0.5px' }}>{hoy}</div>
        {enLista > 0 && <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>{enLista} prod. · {eur(totalGen)}</span>}
        {alertasPrecio > 0 && <span style={{ fontFamily: FONT.body, fontSize: 11, color: '#f5a623', display: 'flex', alignItems: 'center', gap: 3 }}><TrendingUp size={12} /> {alertasPrecio} subidas</span>}
        {alertasStock > 0 && <span style={{ fontFamily: FONT.body, fontSize: 11, color: '#B01D23', display: 'flex', alignItems: 'center', gap: 3 }}><AlertTriangle size={12} /> {alertasStock} bajo mín.</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {alertasStock > 0 && <button onClick={prefillStock} style={btnGhost}><AlertTriangle size={14} /> Auto stock</button>}
          <button onClick={() => setModalGuardar(true)} style={btnGhost}><Save size={14} /> Guardar</button>
          <button onClick={() => setModalCargar(true)} style={btnGhost}><FolderOpen size={14} /> Cargar</button>
          {enLista > 0 && <button onClick={() => setCantidades({})} style={btnGhost}><X size={14} /> Limpiar</button>}
          <button onClick={handlePrint} style={btnGhost}><Printer size={14} /> Imprimir</button>
          <button onClick={handlePDF} style={btnPrimary}><Download size={14} /> PDF</button>
        </div>
      </div>

      {/* Panel Producción */}
      <div className="no-print" style={{ marginBottom: 14 }}>
        <button onClick={() => setProdOpen(o => !o)} style={{ ...btnGhost, width: '100%', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link size={14} /> Desde Producción ({partidasConEps.length} enlazadas / {partidas.length} total)
          </span>
          {prodOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {prodOpen && (
          <div style={{ border: `1px solid ${T.brd}`, borderRadius: 8, padding: 14, marginTop: 8, background: T.card }}>
            {partidasConEps.length === 0 ? (
              <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.mut, textAlign: 'center', padding: 16 }}>
                Ninguna partida tiene EPS enlazada. Enlázalas desde el módulo Producción para calcular ingredientes automáticamente.
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 8, marginBottom: 12 }}>
                  {secciones.map(sec => {
                    const pts = partidasConEps.filter(p => p.seccion_id === sec.id)
                    if (pts.length === 0) return null
                    return (
                      <div key={sec.id}>
                        <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#B01D23', marginBottom: 6 }}>{sec.nombre}</div>
                        {pts.map(p => (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.pri, flex: 1 }}>{p.nombre}</span>
                            <div className="qty-wrap">
                              <button className="qty-btn" onClick={() => setTandas(prev => ({ ...prev, [p.id]: Math.max(0, (prev[p.id] || 0) - 1) }))}><Minus size={11} /></button>
                              <input type="number" min={0} value={tandas[p.id] || ''} onChange={e => setTandas(prev => ({ ...prev, [p.id]: Number(e.target.value) || 0 }))} placeholder="0" className="celda-input" style={{ width: 38 }} />
                              <button className="qty-btn qty-btn-plus" onClick={() => setTandas(prev => ({ ...prev, [p.id]: (prev[p.id] || 0) + 1 }))}><Plus size={11} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
                <button onClick={calcDesdeProduccion} style={btnPrimary}>Calcular ingredientes ({Object.values(tandas).filter(v => v > 0).length} partidas)</button>
              </>
            )}
            {partidasSinEps.length > 0 && (
              <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 10 }}>
                {partidasSinEps.length} partidas sin EPS: {partidasSinEps.slice(0, 5).map(p => p.nombre).join(', ')}{partidasSinEps.length > 5 ? '…' : ''}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: '1 1 180px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.mut }} />
          <input value={busq} onChange={e => setBusq(e.target.value)} placeholder="Buscar…" style={{ ...inputSt(T), width: '100%', paddingLeft: 30 }} />
        </div>
        <select value={filtroP} onChange={e => setFiltroP(e.target.value)} style={inputSt(T)}>
          <option value="TODOS">Todos proveedores</option>
          {provExt.map(p => <option key={p.abv} value={p.abv}>{p.nombre} ({p.abv})</option>)}
        </select>
        <select value={filtroC} onChange={e => setFiltroC(e.target.value)} style={inputSt(T)}>
          <option value="TODAS">Todas categorías</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div className="ficha-card">
        <div className="ficha-head">
          <span className="ficha-title">Lista de Compra</span>
          <span className="ficha-week">{hoy}{enLista > 0 ? ` · ${enLista} prod. · ${eur(totalGen)}` : ''}</span>
        </div>
        <div className="ficha-section">
          {grupos.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin ingredientes</div>
          ) : (
            <div className="prod-table-wrap">
              <table className="prod-table">
                <thead><tr>
                  <th className="th-partida th-partida-ini">Producto</th>
                  <th className="th-dia">Cat.</th>
                  <th className="th-dia">Formato</th>
                  <th className="th-dia">Ud.</th>
                  <th className="th-dia">Precio</th>
                  <th className="th-dia" style={{ minWidth: 110 }}>Cantidad</th>
                  <th className="th-dia">Total</th>
                </tr></thead>
                <tbody>
                  {grupos.map(([a, items]) => {
                    const pn = provMap[a]?.nombre ?? a
                    const tp = items.reduce((s, i) => s + (cantidades[i.id] || 0) * (i.precio_activo || 0), 0)
                    const ip = items.filter(i => (cantidades[i.id] || 0) > 0).length
                    return (
                      <React.Fragment key={a}>
                        <tr className="fila-seccion"><td colSpan={7} className="td-seccion">
                          {pn} <span style={{ fontWeight: 400, fontSize: 11 }}>{items.length} ref.{ip > 0 ? ` · ${ip} en lista · ${eur(tp)}` : ''}</span>
                        </td></tr>
                        {items.map(ing => {
                          const q = cantidades[ing.id] || 0; const tot = q * (ing.precio_activo || 0)
                          const pa = alertaPrecio(ing)
                          const stockBajo = ing.stock_minimo > 0 && ing.stock_actual < ing.stock_minimo
                          return (
                            <tr key={ing.id} className={`fila-partida${q > 0 ? ' fila-activa' : ''}${stockBajo ? ' fila-stock' : ''}`}>
                              <td className="td-partida td-partida-ini">
                                {limpio(ing.nombre)}
                                {stockBajo && <span className="badge-stock" title={`Stock: ${ing.stock_actual} / Mín: ${ing.stock_minimo}`}>▼</span>}
                                {pa && <span className={`badge-precio${pa.subida ? ' badge-sube' : ' badge-baja'}`} title={`${pa.subida ? '+' : ''}${pa.pct}% vs media`}>{pa.subida ? '↑' : '↓'}{Math.abs(pa.pct)}%</span>}
                              </td>
                              <td className="td-celda td-cat">{ing.categoria ?? ''}</td>
                              <td className="td-celda td-cat">{ing.formato ?? ''}</td>
                              <td className="td-celda td-cat">{ing.ud_std ?? ''}</td>
                              <td className="td-celda td-precio">{ing.precio_activo ? eur(ing.precio_activo) : '—'}</td>
                              <td className="td-celda td-cantidad">
                                <div className="qty-wrap">
                                  <button className="qty-btn" onClick={() => setCant(ing.id, q - 1)} disabled={q <= 0}><Minus size={13} /></button>
                                  <input type="number" min={0} value={q || ''} onChange={e => setCant(ing.id, Number(e.target.value) || 0)} placeholder="0" className="celda-input" />
                                  <button className="qty-btn qty-btn-plus" onClick={() => setCant(ing.id, q + 1)}><Plus size={13} /></button>
                                </div>
                              </td>
                              <td className={`td-celda td-total${tot > 0 ? ' td-total-activo' : ''}`}>{tot > 0 ? eur(tot) : '—'}</td>
                            </tr>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal guardar */}
      {modalGuardar && (
        <div style={overlay} onClick={() => setModalGuardar(false)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, background: T.card, border: `0.5px solid ${T.brd}` }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 18, color: '#B01D23', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 14 }}>Guardar lista</div>
            <input value={nombreLista} onChange={e => setNombreLista(e.target.value)} placeholder={`Lista ${new Date().toLocaleDateString('es-ES')}`} style={{ ...inputSt(T), width: '100%', marginBottom: 12 }} />
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginBottom: 14 }}>{enLista} productos · {eur(totalGen)}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalGuardar(false)} style={btnGhost}>Cancelar</button>
              <button onClick={guardarLista} style={btnPrimary}><Save size={14} /> Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cargar */}
      {modalCargar && (
        <div style={overlay} onClick={() => setModalCargar(false)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, background: T.card, border: `0.5px solid ${T.brd}`, width: 480 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontFamily: FONT.heading, fontSize: 18, color: '#B01D23', letterSpacing: '1px', textTransform: 'uppercase' }}>Listas guardadas</span>
              <button onClick={() => setModalCargar(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: T.mut }}><X size={18} /></button>
            </div>
            {listas.length === 0 ? (
              <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.mut, padding: 20, textAlign: 'center' }}>No hay listas guardadas</div>
            ) : listas.map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `0.5px solid ${T.brd}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, fontWeight: 500 }}>{l.nombre}</div>
                  <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut }}>{new Date(l.fecha).toLocaleDateString('es-ES')} · {l.items.length} prod. · {eur(l.total)}</div>
                </div>
                <button onClick={() => cargarLista(l)} style={btnPrimary}>Cargar</button>
                <button onClick={() => borrarLista(l.id)} style={{ ...btnGhost, color: '#B01D23', borderColor: 'rgba(176,29,35,0.3)' }}><X size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══ STYLES ═══ */

const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: '#B01D23', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontFamily: FONT.body, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnGhost: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--sl-text-secondary)', border: '0.5px solid var(--sl-border)', borderRadius: 8, padding: '8px 14px', fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 500, cursor: 'pointer', letterSpacing: '0.04em' }
const inputSt = (T: TokenSet): React.CSSProperties => ({ background: T.inp, border: `1px solid ${T.brd}`, borderRadius: 8, color: T.pri, fontFamily: FONT.body, fontSize: 13, padding: '7px 12px', outline: 'none' })
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
const modalBox: React.CSSProperties = { borderRadius: 16, width: 400, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }

const CSS = `
.ficha-card{font-family:'Lexend',sans-serif;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;color:var(--text-primary);overflow:hidden;display:flex;flex-direction:column}
.ficha-head{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--sl-border-strong)}
.ficha-title{font-family:'Oswald',sans-serif;font-weight:500;font-size:21px;letter-spacing:.04em;text-transform:uppercase;color:var(--text-primary)}
.ficha-week{margin-left:auto;font-family:'Oswald',sans-serif;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted)}
.ficha-section{padding:0}
.prod-table-wrap{overflow-x:auto}
.prod-table{width:100%;border-collapse:separate;border-spacing:0;font-family:'Lexend',sans-serif;font-size:13px}
.prod-table th,.prod-table td{border-right:1px solid var(--sl-border-strong);border-bottom:1px solid var(--sl-border-strong)}
.th-partida{font-family:'Oswald',sans-serif;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;text-align:left;padding:6px 8px;background:#B01D23;color:#fff;min-width:160px}
.th-partida-ini{position:sticky;left:0;z-index:2}
.th-dia{font-family:'Oswald',sans-serif;font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;text-align:center;padding:5px 8px;background:#B01D23;color:#fff;white-space:nowrap}
.td-seccion{font-family:'Oswald',sans-serif;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#B01D23;padding:5px 8px;background:rgba(176,29,35,.07)}
.td-partida{font-family:'Lexend',sans-serif;font-size:13.5px;color:var(--text-primary);padding:4px 8px;white-space:nowrap;background:var(--bg-card)}
.td-partida-ini{position:sticky;left:0;z-index:1}
.td-celda{padding:3px 8px;font-size:12px;color:var(--text-secondary);text-align:center;background:var(--bg-card)}
.td-cat{text-align:left;white-space:nowrap}
.td-precio{text-align:right;white-space:nowrap}
.td-total{text-align:right;white-space:nowrap;font-size:13px;font-weight:400;color:var(--text-muted)}
.td-total-activo{font-weight:700;color:#1D9E75}
.td-cantidad{padding:2px 4px}
.fila-activa .td-partida{font-weight:600}
.fila-activa .td-celda{background:rgba(29,158,117,.04)}
.fila-stock .td-partida{border-left:3px solid #B01D23}
.qty-wrap{display:flex;align-items:center;justify-content:center;gap:2px}
.qty-btn{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;border:1px solid var(--sl-border);background:var(--bg-card);color:var(--text-secondary);cursor:pointer;padding:0;transition:background 120ms}
.qty-btn:hover{background:rgba(176,29,35,.08);color:#B01D23}
.qty-btn:disabled{opacity:.3;cursor:not-allowed}
.qty-btn-plus{background:rgba(176,29,35,.06);border-color:rgba(176,29,35,.2);color:#B01D23}
.qty-btn-plus:hover{background:rgba(176,29,35,.14)}
.celda-input{width:44px;min-width:36px;background:transparent;border:1px solid var(--sl-border);border-radius:4px;outline:none;font-family:'Lexend',sans-serif;font-size:14px;font-weight:600;color:var(--text-primary);padding:2px 2px;text-align:center}
.celda-input::-webkit-inner-spin-button,.celda-input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.celda-input[type=number]{-moz-appearance:textfield}
.badge-stock{display:inline-block;margin-left:6px;font-size:10px;color:#B01D23;vertical-align:middle}
.badge-precio{display:inline-block;margin-left:6px;font-size:9px;padding:0 4px;border-radius:3px;vertical-align:middle;font-family:'Oswald',sans-serif;letter-spacing:.5px}
.badge-sube{background:rgba(245,166,35,.15);color:#c47600}
.badge-baja{background:rgba(29,158,117,.12);color:#1D9E75}
@media print{@page{size:A4 portrait;margin:12mm}html,body{background:#fff!important}.no-print{display:none!important}}
`
