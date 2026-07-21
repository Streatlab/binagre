import { useEffect, useState, useMemo, useCallback } from 'react'
import React from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, pageTitleStyle, groupStyle } from '@/styles/tokens'
import type { TokenSet } from '@/styles/tokens'
import { Printer, Download, ShoppingCart, Search, Trash2, RotateCcw, Share2, ListChecks, Scale, ChevronDown, ChevronRight } from 'lucide-react'
import * as M from '@/lib/marcoDoc'
import HojaDoc from '@/components/marco/HojaDoc'
import {
  PROVEEDOR_LABEL, construirBloques, compararSupers, metaSemana, semanaISO, eur,
} from '@/lib/listaCompra'
import type { IngredienteLC, CategoriaLC, ProductoLC, ProveedorBloque } from '@/lib/listaCompra'

const fmtPct = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })}%`

/* ═══ PDF — MARCO ÚNICO (src/lib/marcoDoc.ts) — LANDSCAPE ═══ */

const AREA: M.Area = 'cocina'

function crearPDF(bloques: ProveedorBloque[], meta: string, rec: M.Recursos, bn = false) {
  const doc = M.nuevaHoja({ orientation: 'landscape' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA, bn)
  const cb = M.contentBox(doc)

  const xProd = cb.x0 + 1.5
  const xUd = cb.x0 + cb.w * 0.74
  const xPrec = cb.x1 - 1.5

  const nuevaPagina = () => {
    M.pintarEspina(doc, AREA, ctx, bn)
    return M.pintarCabecera(doc, ctx, { docNombre: 'Lista de Compra', meta, area: AREA, bn })
  }
  let y = nuevaPagina()
  let primerBloque = true

  for (const bloque of bloques) {
    if (bloque.total === 0) continue
    if (!primerBloque) y += 3
    primerBloque = false
    if (y > cb.bottom - 22) { doc.addPage(); y = nuevaPagina() }

    doc.setFillColor(pal.acento[0], pal.acento[1], pal.acento[2])
    doc.roundedRect(cb.x0, y, cb.w, 7.5, M.R, M.R, 'F')
    M.fTitulo(doc, ctx, true); doc.setFontSize(12); doc.setTextColor(255, 255, 255)
    doc.text(`${PROVEEDOR_LABEL[bloque.prov].toUpperCase()}  ·  ${bloque.total} ref.`, cb.x0 + 3, y + 5.3)
    y += 10.5

    for (const cat of bloque.categorias) {
      if (y > cb.bottom - 15) { doc.addPage(); y = nuevaPagina() }
      doc.setFillColor(pal.soft[0], pal.soft[1], pal.soft[2]); doc.rect(cb.x0, y, cb.w, 6, 'F')
      M.fTitulo(doc, ctx, true); doc.setFontSize(9); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
      doc.text(`${cat.catNombre.toUpperCase()}  (${cat.items.length})`, cb.x0 + 2.5, y + 4.2)
      y += 6
      doc.setFillColor(pal.soft2[0], pal.soft2[1], pal.soft2[2]); doc.rect(cb.x0, y, cb.w, 5, 'F')
      M.fTitulo(doc, ctx, true); doc.setFontSize(7.5); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
      doc.text('Producto', xProd, y + 3.4)
      doc.text('Ud. mínima', xUd, y + 3.4)
      doc.text('Precio', xPrec, y + 3.4, { align: 'right' })
      y += 5

      for (const li of cat.items) {
        if (y > cb.bottom - 6) { doc.addPage(); y = nuevaPagina() }
        doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.1); doc.line(cb.x0, y + 4.6, cb.x1, y + 4.6)
        M.fDato(doc, ctx, false); doc.setFontSize(9); doc.setTextColor(...M.TINTA)
        doc.text(li.nombreMostrar, xProd, y + 3.6)
        doc.setTextColor(...M.GRIS); doc.text(li.unidad, xUd, y + 3.6)
        if (li.precio != null) {
          doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
          doc.text(eur(li.precio), xPrec, y + 3.6, { align: 'right' })
        } else {
          doc.setTextColor(...M.GRIS); doc.text('—', xPrec, y + 3.6, { align: 'right' })
        }
        y += 4.8
      }
      y += 2
    }
  }

  const totalPag = doc.getNumberOfPages()
  for (let p = 1; p <= totalPag; p++) { doc.setPage(p); M.pintarPaginado(doc, p, totalPag, ctx) }
  return doc
}

/* ═══ COMPONENT ═══ */

export default function ListaCompra() {
  const { T } = useTheme()
  const [ingredientes, setIngredientes] = useState<IngredienteLC[]>([])
  const [categorias, setCategorias] = useState<CategoriaLC[]>([])
  const [productos, setProductos] = useState<ProductoLC[]>([])
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const [busq, setBusq] = useState('')
  const [vista, setVista] = useState<'lista' | 'papelera'>('lista')
  const [bn, setBn] = useState(false)
  const [cmpOpen, setCmpOpen] = useState(false)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const [iR, cR, pR, eR] = await Promise.all([
        supabase.from('ingredientes')
          .select('id,nombre,nombre_base,abv,categoria_id,ud_std,ud_min,precio_activo,activo')
          .eq('activo', true).order('nombre'),
        supabase.from('categorias_ingredientes').select('id,nombre,orden').eq('activa', true).order('orden'),
        supabase.from('ingrediente_productos')
          .select('ingrediente_id,proveedor,unidad_minima_txt,precio_robot,activo').eq('activo', true),
        supabase.from('lista_compra_excluidos').select('ingrediente_id'),
      ])
      // Regla de negocio: ABV EPS/MRM = elaboraciones propias, no son ingredientes comprables.
      setIngredientes(((iR.data ?? []) as any[])
        .filter(i => i.abv !== 'EPS' && i.abv !== 'MRM')
        .map(i => ({
          id: i.id, nombre: i.nombre, nombre_base: i.nombre_base, abv: i.abv,
          categoria_id: i.categoria_id, ud_std: i.ud_std, ud_min: i.ud_min,
          precio_activo: i.precio_activo != null ? Number(i.precio_activo) : null,
        })))
      setCategorias((cR.data ?? []) as CategoriaLC[])
      setProductos(((pR.data ?? []) as any[]).map(p => ({
        ingrediente_id: p.ingrediente_id, proveedor: p.proveedor,
        unidad_minima_txt: p.unidad_minima_txt,
        precio_robot: p.precio_robot != null ? Number(p.precio_robot) : null,
      })))
      setExcluidos(new Set(((eR.data ?? []) as any[]).map(e => e.ingrediente_id as string)))
      setLoading(false)
    })()
  }, [])

  const ahora = useMemo(() => new Date(), [])
  const semanaN = useMemo(() => semanaISO(ahora), [ahora])
  const metaTexto = useMemo(() => metaSemana(ahora), [ahora])

  const ingredientesFiltrados = useMemo(() => {
    if (!busq.trim()) return ingredientes
    const q = busq.toLowerCase()
    return ingredientes.filter(i => (i.nombre_base ?? i.nombre).toLowerCase().includes(q))
  }, [ingredientes, busq])

  const bloques = useMemo(
    () => construirBloques(ingredientesFiltrados, categorias, productos, excluidos),
    [ingredientesFiltrados, categorias, productos, excluidos],
  )

  const totalRefs = useMemo(() => bloques.reduce((s, b) => s + b.total, 0), [bloques])

  const comparativa = useMemo(
    () => compararSupers(ingredientes, productos, excluidos),
    [ingredientes, productos, excluidos],
  )

  const papeleraItems = useMemo(() => {
    const catMap = new Map(categorias.map(c => [c.id, c.nombre]))
    return ingredientes
      .filter(i => excluidos.has(i.id))
      .map(i => ({ ing: i, catNombre: (i.categoria_id && catMap.get(i.categoria_id)) || 'Sin clasificar' }))
      .sort((a, b) => (a.ing.nombre_base ?? a.ing.nombre).localeCompare(b.ing.nombre_base ?? b.ing.nombre, 'es'))
  }, [ingredientes, categorias, excluidos])

  const quitar = useCallback(async (id: string) => {
    setExcluidos(prev => new Set(prev).add(id))
    const { error } = await supabase.from('lista_compra_excluidos').upsert({ ingrediente_id: id })
    if (error) setExcluidos(prev => { const n = new Set(prev); n.delete(id); return n })
  }, [])

  const devolver = useCallback(async (id: string) => {
    setExcluidos(prev => { const n = new Set(prev); n.delete(id); return n })
    const { error } = await supabase.from('lista_compra_excluidos').delete().eq('ingrediente_id', id)
    if (error) setExcluidos(prev => new Set(prev).add(id))
  }, [])

  const handlePrint = async () => { const rec = await M.cargarRecursos(); M.abrirImprimir(crearPDF(bloques, metaTexto, rec, bn)) }
  const handlePDF = async () => { const rec = await M.cargarRecursos(); M.descargar(crearPDF(bloques, metaTexto, rec, bn), `lista-compra-semana-${semanaN}`) }
  const handleShare = async () => {
    const rec = await M.cargarRecursos()
    const doc = crearPDF(bloques, metaTexto, rec, bn)
    const blob = doc.output('blob')
    const nombre = `lista-compra-semana-${semanaN}.pdf`
    const file = new File([blob], nombre, { type: 'application/pdf' })
    const navAny = navigator as Navigator & { canShare?: (data: { files?: File[] }) => boolean; share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void> }
    if (navAny.canShare && navAny.canShare({ files: [file] }) && navAny.share) {
      try { await navAny.share({ files: [file], title: 'Lista de Compra', text: nombre }); return }
      catch { /* usuario canceló */ }
    }
    M.descargar(doc, `lista-compra-semana-${semanaN}`)
  }

  if (loading) return <div style={{ ...groupStyle(T), width: '100%' }}><h1 style={pageTitleStyle(T)}>Lista de Compra</h1><div style={{ padding: 36, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div></div>

  return (
    <div style={{ ...groupStyle(T), width: '100%' }}>
      <style>{CSS}</style>

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <ShoppingCart size={24} color="#B01D23" />
        <h1 style={{ ...pageTitleStyle(T), margin: 0 }}>Lista de Compra</h1>
      </div>

      {/* Botones */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 14, color: T.pri, letterSpacing: '0.5px' }}>{metaTexto}</div>
        <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>{totalRefs} referencias</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setVista(v => (v === 'lista' ? 'papelera' : 'lista'))} style={btnGhost}>
            {vista === 'lista' ? <Trash2 size={14} /> : <ListChecks size={14} />}
            {vista === 'lista' ? `Papelera (${papeleraItems.length})` : 'Volver a la lista'}
          </button>
          <button onClick={() => setBn(v => !v)} style={{ ...btnGhost, background: bn ? '#e7e7e7' : 'transparent', color: bn ? '#111' : 'var(--sl-text-secondary)' }} title="Imprimir en blanco y negro">{bn ? 'B/N' : 'Color'}</button>
          <button onClick={handlePrint} style={btnGhost}><Printer size={14} /> Imprimir</button>
          <button onClick={handleShare} style={btnGhost}><Share2 size={14} /> Compartir</button>
          <button onClick={handlePDF} style={btnPrimary}><Download size={14} /> PDF</button>
        </div>
      </div>

      {/* Filtro */}
      {vista === 'lista' && (
        <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 360 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.mut }} />
            <input value={busq} onChange={e => setBusq(e.target.value)} placeholder="Buscar ingrediente…" style={{ ...inputSt(T), width: '100%', paddingLeft: 30 }} />
          </div>
        </div>
      )}

      {/* Comparador Mercadona vs Alcampo — ahorro potencial (solo pantalla) */}
      {vista === 'lista' && comparativa.nComparables > 0 && (
        <div className="no-print" style={{ border: `1px solid ${T.brd}`, borderRadius: 12, background: T.card, marginBottom: 16, overflow: 'hidden' }}>
          <button
            onClick={() => setCmpOpen(o => !o)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <Scale size={18} color="#B01D23" />
            <span style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.pri }}>
              Comparador Mercadona vs Alcampo
            </span>
            <span style={{ fontFamily: FONT.body, fontSize: 12.5, color: T.mut, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <span><b style={{ color: T.pri }}>{comparativa.nComparables}</b> comparables</span>
              <span>Mercadona gana en <b style={{ color: VERDE }}>{comparativa.nMercadona}</b></span>
              <span>Alcampo en <b style={{ color: VERDE }}>{comparativa.nAlcampo}</b></span>
              {comparativa.nEmpate > 0 && <span>· {comparativa.nEmpate} empate</span>}
              <span>· dif. media <b style={{ color: '#B01D23' }}>{fmtPct(comparativa.ahorroMedioPct)}</b></span>
            </span>
            <span style={{ marginLeft: 'auto', color: T.mut }}>{cmpOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
          </button>

          {cmpOpen && (
            <div style={{ borderTop: `1px solid ${T.brd}`, maxHeight: 340, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT.body }}>
                <thead>
                  <tr style={{ background: T.group, position: 'sticky', top: 0 }}>
                    <th style={thCmp(T)}>Ingrediente</th>
                    <th style={{ ...thCmp(T), textAlign: 'right' }}>Mercadona</th>
                    <th style={{ ...thCmp(T), textAlign: 'right' }}>Alcampo</th>
                    <th style={{ ...thCmp(T), textAlign: 'right' }}>Más barato</th>
                  </tr>
                </thead>
                <tbody>
                  {comparativa.items.map(it => {
                    const merGana = it.cheaper === 'mercadona'
                    const alcGana = it.cheaper === 'alcampo'
                    return (
                      <tr key={it.ingId} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                        <td style={{ ...tdCmp(T), color: T.pri }}>{it.nombre} <span style={{ color: T.mut, fontSize: 11 }}>/{it.unidad}</span></td>
                        <td style={{ ...tdCmp(T), textAlign: 'right', fontWeight: merGana ? 700 : 400, color: merGana ? VERDE : T.mut }}>{eur(it.mercadona)}</td>
                        <td style={{ ...tdCmp(T), textAlign: 'right', fontWeight: alcGana ? 700 : 400, color: alcGana ? VERDE : T.mut }}>{eur(it.alcampo)}</td>
                        <td style={{ ...tdCmp(T), textAlign: 'right' }}>
                          {it.cheaper === 'empate' ? (
                            <span style={{ color: T.mut, fontSize: 12 }}>igual</span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#1D9E7518', color: VERDE, borderRadius: 6, padding: '2px 8px', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '0.04em' }}>
                              {merGana ? 'Mercadona' : 'Alcampo'} · −{fmtPct(it.ahorroPct)}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Vista: LISTA (documento) */}
      {vista === 'lista' && (
        <HojaDoc area="cocina" docNombre="Lista de Compra" meta={`${metaTexto} · ${totalRefs} ref.`}>
          <div className="ficha-section">
            {totalRefs === 0 ? (
              <div style={{ padding: 36, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin ingredientes</div>
            ) : (
              <div className="prod-table-wrap">
                <table className="prod-table">
                  <thead><tr>
                    <th className="th-partida th-partida-ini">Producto</th>
                    <th className="th-dia">Ud. mínima</th>
                    <th className="th-dia">Precio</th>
                    <th className="th-dia" style={{ minWidth: 60 }}>Quitar</th>
                  </tr></thead>
                  <tbody>
                    {bloques.map(bloque => bloque.total === 0 ? null : (
                      <React.Fragment key={bloque.prov}>
                        <tr className="fila-proveedor"><td colSpan={4} className="td-proveedor">
                          {PROVEEDOR_LABEL[bloque.prov]} <span style={{ fontWeight: 400, fontSize: 11 }}>{bloque.total} ref.</span>
                        </td></tr>
                        {bloque.categorias.map(cat => (
                          <React.Fragment key={cat.catId}>
                            <tr className="fila-seccion"><td colSpan={4} className="td-seccion">
                              {cat.catNombre} <span style={{ fontWeight: 400, fontSize: 11 }}>{cat.items.length} ref.</span>
                            </td></tr>
                            {cat.items.map(li => (
                              <tr key={`${bloque.prov}-${li.ing.id}`} className="fila-partida">
                                <td className="td-partida td-partida-ini">{li.nombreMostrar}</td>
                                <td className="td-celda td-cat">{li.unidad}</td>
                                <td className="td-celda td-precio">
                                  {li.precio != null ? eur(li.precio) : '—'}
                                  {li.origenPrecio === 'escandallo' && <span className="badge-fallback" title="Precio de escandallo (sin precio de robot)"> *</span>}
                                </td>
                                <td className="td-celda" style={{ textAlign: 'center' }}>
                                  <button className="qty-btn" title="Quitar de la lista" onClick={() => quitar(li.ing.id)}><Trash2 size={13} /></button>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </HojaDoc>
      )}

      {/* Vista: PAPELERA */}
      {vista === 'papelera' && (
        <div className="no-print" style={{ border: `1px solid ${T.brd}`, borderRadius: 10, background: T.card, overflow: 'hidden' }}>
          {papeleraItems.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>La papelera está vacía</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.group, borderBottom: `1px solid ${T.brd}` }}>
                  <th style={thPap(T)}>Producto</th>
                  <th style={thPap(T)}>Categoría</th>
                  <th style={{ ...thPap(T), width: 120, textAlign: 'right' }} />
                </tr>
              </thead>
              <tbody>
                {papeleraItems.map(({ ing, catNombre }) => (
                  <tr key={ing.id} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                    <td style={tdPap(T)}>{ing.nombre_base ?? ing.nombre}</td>
                    <td style={{ ...tdPap(T), color: T.mut }}>{catNombre}</td>
                    <td style={{ ...tdPap(T), textAlign: 'right' }}>
                      <button onClick={() => devolver(ing.id)} style={btnGhost}><RotateCcw size={13} /> Devolver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

/* ═══ STYLES ═══ */

const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: '#B01D23', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontFamily: FONT.body, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnGhost: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--sl-text-secondary)', border: '0.5px solid var(--sl-border)', borderRadius: 8, padding: '8px 14px', fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 500, cursor: 'pointer', letterSpacing: '0.04em' }
const inputSt = (T: TokenSet): React.CSSProperties => ({ background: T.inp, border: `1px solid ${T.brd}`, borderRadius: 8, color: T.pri, fontFamily: FONT.body, fontSize: 13, padding: '7px 12px', outline: 'none' })
const thPap = (T: TokenSet): React.CSSProperties => ({ padding: '10px 14px', fontFamily: FONT.heading, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', color: T.mut, fontWeight: 400, textAlign: 'left' })
const tdPap = (T: TokenSet): React.CSSProperties => ({ padding: '10px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri })

const VERDE = '#1D9E75'
const thCmp = (T: TokenSet): React.CSSProperties => ({ padding: '8px 14px', fontFamily: FONT.heading, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '1.5px', color: T.mut, fontWeight: 400, textAlign: 'left', whiteSpace: 'nowrap' })
const tdCmp = (T: TokenSet): React.CSSProperties => ({ padding: '7px 14px', fontFamily: FONT.body, fontSize: 12.5, whiteSpace: 'nowrap' })

const CSS = `
.ficha-section{padding:0}
.prod-table-wrap{overflow-x:auto}
.prod-table{width:100%;border-collapse:separate;border-spacing:0;font-family:'Lexend',sans-serif;font-size:13px}
.prod-table th,.prod-table td{border-right:1px solid var(--sl-border-strong);border-bottom:1px solid var(--sl-border-strong)}
.th-partida{font-family:'Oswald',sans-serif;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;text-align:left;padding:6px 8px;background:var(--m-acento);color:#fff;min-width:200px}
.th-partida-ini{position:sticky;left:0;z-index:2}
.th-dia{font-family:'Oswald',sans-serif;font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;text-align:center;padding:5px 8px;background:var(--m-acento);color:#fff;white-space:nowrap}
.td-proveedor{font-family:'Oswald',sans-serif;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#fff;padding:6px 8px;background:var(--m-acento)}
.td-seccion{font-family:'Oswald',sans-serif;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--m-acento);padding:5px 8px;background:var(--m-soft2)}
.td-partida{font-family:'Lexend',sans-serif;font-size:13.5px;color:var(--text-primary);padding:4px 8px;white-space:nowrap;background:var(--bg-card)}
.td-partida-ini{position:sticky;left:0;z-index:1}
.td-celda{padding:3px 8px;font-size:12px;color:var(--text-secondary);text-align:center;background:var(--bg-card)}
.td-cat{text-align:left;white-space:nowrap}
.td-precio{text-align:right;white-space:nowrap;font-weight:600;color:var(--m-acento)}
.badge-fallback{color:var(--text-muted);font-weight:400}
.qty-btn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;border:1px solid var(--sl-border);background:var(--bg-card);color:var(--text-secondary);cursor:pointer;padding:0;transition:background 120ms}
.qty-btn:hover{background:var(--m-soft2,rgba(176,29,35,.08));color:var(--m-acento,#B01D23)}
@media print{@page{size:A4 landscape;margin:12mm}html,body{background:#fff!important}.no-print{display:none!important}}
`
