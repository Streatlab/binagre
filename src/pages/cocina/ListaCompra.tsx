import { useEffect, useState, useMemo } from 'react'
import React from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, pageTitleStyle, groupStyle } from '@/styles/tokens'
import type { TokenSet } from '@/styles/tokens'
import { Printer, Download, ShoppingCart, Search, X, Plus, Minus } from 'lucide-react'
import { jsPDF } from 'jspdf'

/* ─── types ─── */

interface Proveedor { id: string; abv: string; nombre: string; nombre_completo: string; categoria: string; activo: boolean }
interface Ingrediente { id: string; nombre: string; categoria: string | null; formato: string | null; ud_std: string | null; precio_activo: number | null; activo: boolean; proveedor_abv: string }

/* ─── helpers ─── */

function extraerAbv(nombre: string): string { const m = nombre.match(/_([A-Z]{2,4})$/); return m ? m[1] : '???' }
function sinSufijo(nombre: string): string { return nombre.replace(/_[A-Z]{2,4}$/, '').trim() }
function fmtEur(v: number): string { return v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

/* ─── PDF ─── */

const RED: [number, number, number] = [176, 29, 35]
const RED_DARK: [number, number, number] = [138, 26, 34]
const RED_SOFT: [number, number, number] = [240, 216, 218]
const GREY: [number, number, number] = [201, 201, 201]

function generarPDF(grupos: [string, Ingrediente[]][], provMap: Record<string, Proveedor>, cantidades: Record<string, number>) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PW = doc.internal.pageSize.getWidth()
  const M = 14
  const usable = PW - M * 2
  let y = M
  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...RED_DARK)
  doc.text('LISTA DE COMPRA', M, y + 5)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90)
  doc.text(hoy, PW - M, y + 5, { align: 'right' })
  y += 9; doc.setDrawColor(...RED_DARK); doc.setLineWidth(0.5); doc.line(M, y, PW - M, y); y += 6

  for (const [abv, items] of grupos) {
    const conCantidad = items.filter(i => (cantidades[i.id] || 0) > 0)
    if (conCantidad.length === 0) continue
    if (y > 260) { doc.addPage(); y = M }

    const provNombre = provMap[abv]?.nombre ?? abv
    doc.setFillColor(...RED_SOFT); doc.rect(M, y, usable, 7, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...RED_DARK)
    doc.text(`${provNombre.toUpperCase()}  (${conCantidad.length})`, M + 3, y + 5)
    y += 7

    // Header
    doc.setFillColor(250, 242, 243); doc.rect(M, y, usable, 5, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...RED_DARK)
    doc.text('Producto', M + 2, y + 3.5)
    doc.text('Formato', M + 80, y + 3.5)
    doc.text('Ud.', M + 110, y + 3.5)
    doc.text('Cant.', M + 130, y + 3.5)
    doc.text('Precio', M + 148, y + 3.5)
    doc.text('Total', usable + M - 2, y + 3.5, { align: 'right' })
    y += 5

    let totalProv = 0
    for (const ing of conCantidad) {
      if (y > 270) { doc.addPage(); y = M }
      const qty = cantidades[ing.id] || 0
      const total = qty * (ing.precio_activo || 0)
      totalProv += total
      doc.setDrawColor(...GREY); doc.setLineWidth(0.1); doc.line(M, y + 4.5, M + usable, y + 4.5)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(30)
      doc.text(sinSufijo(ing.nombre), M + 2, y + 3.5)
      doc.setTextColor(90)
      doc.text(ing.formato ?? '', M + 80, y + 3.5)
      doc.text(ing.ud_std ?? '', M + 110, y + 3.5)
      doc.setFont('helvetica', 'bold'); doc.setTextColor(30)
      doc.text(qty.toString(), M + 132, y + 3.5)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(90)
      doc.text(ing.precio_activo ? fmtEur(ing.precio_activo) : '', M + 145, y + 3.5)
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...RED_DARK)
      doc.text(fmtEur(total), usable + M - 2, y + 3.5, { align: 'right' })
      y += 5
    }
    // Total proveedor
    doc.setDrawColor(...RED); doc.setLineWidth(0.3); doc.line(M + 130, y, M + usable, y)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...RED_DARK)
    doc.text(`Total ${provNombre}: ${fmtEur(totalProv)}`, usable + M - 2, y + 4, { align: 'right' })
    y += 10
  }
  return doc
}

/* ─── component ─── */

export default function ListaCompra() {
  const { T, isDark } = useTheme()
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroProveedor, setFiltroProveedor] = useState('TODOS')
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS')
  const [busqueda, setBusqueda] = useState('')
  const [cantidades, setCantidades] = useState<Record<string, number>>({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [pRes, iRes] = await Promise.all([
        supabase.from('config_proveedores').select('*').eq('activo', true).order('nombre'),
        supabase.from('ingredientes').select('id,nombre,categoria,formato,ud_std,precio_activo,activo').eq('activo', true).order('categoria').order('nombre'),
      ])
      setProveedores((pRes.data ?? []) as Proveedor[])
      setIngredientes(((iRes.data ?? []) as any[]).map(i => ({ ...i, precio_activo: i.precio_activo ? Number(i.precio_activo) : null, proveedor_abv: extraerAbv(i.nombre) })))
      setLoading(false)
    }
    load()
  }, [])

  const provMap = useMemo(() => { const m: Record<string, Proveedor> = {}; proveedores.forEach(p => { m[p.abv] = p }); return m }, [proveedores])
  const categorias = useMemo(() => Array.from(new Set(ingredientes.map(i => i.categoria).filter(Boolean) as string[])).sort(), [ingredientes])

  const filtrados = useMemo(() => ingredientes.filter(i => {
    if (filtroProveedor !== 'TODOS' && i.proveedor_abv !== filtroProveedor) return false
    if (filtroCategoria !== 'TODAS' && i.categoria !== filtroCategoria) return false
    if (busqueda && !i.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
    if (/^agua/i.test(i.nombre)) return false
    if (i.proveedor_abv === 'EPS' || i.proveedor_abv === 'MRM') return false
    return true
  }), [ingredientes, filtroProveedor, filtroCategoria, busqueda])

  const grupos = useMemo(() => {
    const g: Record<string, Ingrediente[]> = {}
    filtrados.forEach(i => { if (!g[i.proveedor_abv]) g[i.proveedor_abv] = []; g[i.proveedor_abv].push(i) })
    return Object.entries(g).sort(([a], [b]) => (provMap[a]?.nombre ?? a).localeCompare(provMap[b]?.nombre ?? b))
  }, [filtrados, provMap])

  const totalGeneral = useMemo(() => filtrados.reduce((s, i) => s + (cantidades[i.id] || 0) * (i.precio_activo || 0), 0), [filtrados, cantidades])
  const itemsEnLista = useMemo(() => filtrados.filter(i => (cantidades[i.id] || 0) > 0).length, [filtrados, cantidades])

  const setCant = (id: string, v: number) => setCantidades(prev => ({ ...prev, [id]: Math.max(0, v) }))
  const limpiar = () => { setCantidades({}); }

  const handlePrint = () => {
    const doc = generarPDF(grupos, provMap, cantidades)
    const url = doc.output('bloburl')
    const win = window.open(url as unknown as string, '_blank')
    if (win) win.addEventListener('load', () => { try { win.focus(); win.print() } catch {} })
  }
  const handleDownload = () => {
    const hoy = new Date().toISOString().slice(0, 10)
    generarPDF(grupos, provMap, cantidades).save(`lista-compra-${hoy}.pdf`)
  }

  if (loading) return (
    <div style={{ ...groupStyle(T), width: '100%' }}>
      <h1 style={pageTitleStyle(T)}>Lista de Compra</h1>
      <div style={{ padding: 36, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
    </div>
  )

  const provExternos = proveedores.filter(p => p.abv !== 'EPS' && p.abv !== 'MRM')
  const hoy = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, c => c.toUpperCase())

  return (
    <div style={{ ...groupStyle(T), width: '100%' }}>
      <style>{LISTA_CSS}</style>

      {/* Header */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <ShoppingCart size={24} color="#B01D23" />
        <h1 style={{ ...pageTitleStyle(T), margin: 0 }}>Lista de Compra</h1>
      </div>

      {/* Botones */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 14, color: T.pri, letterSpacing: '0.5px' }}>{hoy}</div>
        <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
          {itemsEnLista > 0 && <>{itemsEnLista} productos · {fmtEur(totalGeneral)}</>}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {itemsEnLista > 0 && <button onClick={limpiar} style={btnGhost}><X size={15} /> Limpiar</button>}
          <button onClick={handlePrint} style={btnGhost}><Printer size={15} /> Imprimir</button>
          <button onClick={handleDownload} style={btnPrimary}><Download size={15} /> Descargar PDF</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: '1 1 180px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.mut }} />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar…" style={{ ...inputSt(T), width: '100%', paddingLeft: 30 }} />
        </div>
        <select value={filtroProveedor} onChange={e => setFiltroProveedor(e.target.value)} style={inputSt(T)}>
          <option value="TODOS">Todos proveedores</option>
          {provExternos.map(p => <option key={p.abv} value={p.abv}>{p.nombre} ({p.abv})</option>)}
        </select>
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={inputSt(T)}>
          <option value="TODAS">Todas categorías</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Tabla estilo producción */}
      <div className="ficha-card">
        <div className="ficha-head">
          <span className="ficha-title">Lista de Compra</span>
          <span className="ficha-week">{hoy}{itemsEnLista > 0 ? ` · ${itemsEnLista} productos · ${fmtEur(totalGeneral)}` : ''}</span>
        </div>
        <div className="ficha-section">
          {grupos.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin ingredientes con estos filtros</div>
          ) : (
            <div className="prod-table-wrap">
              <table className="prod-table">
                <thead>
                  <tr>
                    <th className="th-partida th-partida-ini">Producto</th>
                    <th className="th-dia">Categoría</th>
                    <th className="th-dia">Formato</th>
                    <th className="th-dia">Ud.</th>
                    <th className="th-dia">Precio</th>
                    <th className="th-dia" style={{ minWidth: 110 }}>Cantidad</th>
                    <th className="th-dia">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map(([abv, items]) => {
                    const provNombre = provMap[abv]?.nombre ?? abv
                    const totalProv = items.reduce((s, i) => s + (cantidades[i.id] || 0) * (i.precio_activo || 0), 0)
                    const itemsProv = items.filter(i => (cantidades[i.id] || 0) > 0).length
                    return (
                      <React.Fragment key={abv}>
                        <tr className="fila-seccion">
                          <td colSpan={7} className="td-seccion">
                            {provNombre}
                            <span style={{ marginLeft: 10, fontWeight: 400, fontSize: 11 }}>
                              {items.length} ref.{itemsProv > 0 ? ` · ${itemsProv} en lista · ${fmtEur(totalProv)}` : ''}
                            </span>
                          </td>
                        </tr>
                        {items.map(ing => {
                          const qty = cantidades[ing.id] || 0
                          const total = qty * (ing.precio_activo || 0)
                          return (
                            <tr key={ing.id} className={`fila-partida${qty > 0 ? ' fila-activa' : ''}`}>
                              <td className="td-partida td-partida-ini">{sinSufijo(ing.nombre)}</td>
                              <td className="td-celda td-cat">{ing.categoria ?? ''}</td>
                              <td className="td-celda td-cat">{ing.formato ?? ''}</td>
                              <td className="td-celda td-cat">{ing.ud_std ?? ''}</td>
                              <td className="td-celda td-precio">{ing.precio_activo ? fmtEur(ing.precio_activo) : '—'}</td>
                              <td className="td-celda td-cantidad">
                                <div className="qty-wrap">
                                  <button className="qty-btn" onClick={() => setCant(ing.id, qty - 1)} disabled={qty <= 0}>
                                    <Minus size={13} />
                                  </button>
                                  <input type="number" min={0} value={qty || ''} onChange={e => setCant(ing.id, Number(e.target.value) || 0)} placeholder="0" className="celda-input" />
                                  <button className="qty-btn qty-btn-plus" onClick={() => setCant(ing.id, qty + 1)}>
                                    <Plus size={13} />
                                  </button>
                                </div>
                              </td>
                              <td className={`td-celda td-total${total > 0 ? ' td-total-activo' : ''}`}>{total > 0 ? fmtEur(total) : '—'}</td>
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
    </div>
  )
}

/* ─── estilos botones ─── */

const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: '#B01D23', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontFamily: FONT.body, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnGhost: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--sl-text-secondary)', border: '0.5px solid var(--sl-border)', borderRadius: 8, padding: '8px 14px', fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 500, cursor: 'pointer', letterSpacing: '0.04em' }
const inputSt = (T: TokenSet): React.CSSProperties => ({ background: T.inp, border: `1px solid ${T.brd}`, borderRadius: 8, color: T.pri, fontFamily: FONT.body, fontSize: 13, padding: '7px 12px', outline: 'none' })

/* ─── CSS ─── */

const LISTA_CSS = `
.ficha-card { font-family: 'Lexend', sans-serif; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; color: var(--text-primary); overflow: hidden; display: flex; flex-direction: column; }
.ficha-head { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--sl-border-strong); }
.ficha-title { font-family: 'Oswald', sans-serif; font-weight: 500; font-size: 21px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-primary); }
.ficha-week { margin-left: auto; font-family: 'Oswald', sans-serif; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); }
.ficha-section { padding: 0; }

.prod-table-wrap { overflow-x: auto; }
.prod-table { width: 100%; border-collapse: separate; border-spacing: 0; font-family: 'Lexend', sans-serif; font-size: 13px; }
.prod-table th, .prod-table td { border-right: 1px solid var(--sl-border-strong); border-bottom: 1px solid var(--sl-border-strong); }

.th-partida { font-family: 'Oswald', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; text-align: left; padding: 6px 8px; background: #B01D23; color: #fff; min-width: 160px; }
.th-partida-ini { position: sticky; left: 0; z-index: 2; }
.th-dia { font-family: 'Oswald', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; text-align: center; padding: 5px 8px; background: #B01D23; color: #fff; white-space: nowrap; }

.td-seccion { font-family: 'Oswald', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #B01D23; padding: 5px 8px; background: rgba(176,29,35,0.07); }

.td-partida { font-family: 'Lexend', sans-serif; font-size: 13.5px; color: var(--text-primary); padding: 4px 8px; white-space: nowrap; background: var(--bg-card); }
.td-partida-ini { position: sticky; left: 0; z-index: 1; }

.td-celda { padding: 3px 8px; font-size: 12px; color: var(--text-secondary); text-align: center; background: var(--bg-card); }
.td-cat { text-align: left; white-space: nowrap; }
.td-precio { text-align: right; white-space: nowrap; font-size: 12px; }
.td-total { text-align: right; white-space: nowrap; font-size: 13px; font-weight: 400; color: var(--text-muted); }
.td-total-activo { font-weight: 700; color: #1D9E75; }
.td-cantidad { padding: 2px 4px; }

.fila-activa .td-partida { font-weight: 600; }
.fila-activa .td-celda { background: rgba(29,158,117,0.04); }

.qty-wrap { display: flex; align-items: center; justify-content: center; gap: 2px; }
.qty-btn { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--sl-border); background: var(--bg-card); color: var(--text-secondary); cursor: pointer; padding: 0; transition: background 120ms; }
.qty-btn:hover { background: rgba(176,29,35,0.08); color: #B01D23; }
.qty-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.qty-btn-plus { background: rgba(176,29,35,0.06); border-color: rgba(176,29,35,0.2); color: #B01D23; }
.qty-btn-plus:hover { background: rgba(176,29,35,0.14); }
.celda-input { width: 44px; min-width: 36px; background: transparent; border: 1px solid var(--sl-border); border-radius: 4px; outline: none; font-family: 'Lexend', sans-serif; font-size: 14px; font-weight: 600; color: var(--text-primary); padding: 2px 2px; text-align: center; }
.celda-input::-webkit-inner-spin-button, .celda-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.celda-input[type=number] { -moz-appearance: textfield; }

@media print {
  @page { size: A4 portrait; margin: 12mm; }
  html, body { background: #fff !important; }
  body * { visibility: hidden; }
  .no-print { display: none !important; }
}
`
