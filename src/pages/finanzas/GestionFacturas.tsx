/**
 * GestionFacturas — Listado de facturas tipo Drive.
 *
 * Datos 100% reales desde Supabase:
 * - public.facturas (PDF en pdf_drive_url, ya servido por Supabase Storage)
 * - public.titulares (Rubén, Emilio)
 * - public.categorias_pyg (árbol completo de categorías contables, 105)
 *
 * Estructura del Drive simulado: Titular → Año → Trimestre → Mes,
 * SIEMPRE muestra los 2 titulares, año actual + anterior, T1-T4, 12 meses.
 *
 * Click en fila → abre el PDF (pdf_drive_url) en pestaña nueva.
 * Click en nodo del árbol → filtra la tabla por ese ámbito.
 */

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  type CSSProperties,
} from 'react'
import {
  COLORS,
  FONT,
  DROPDOWN_BTN,
} from '@/components/panel/resumen/tokens'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import TabsPastilla from '@/components/ui/TabsPastilla'
import SubTabsInverso from '@/components/ui/SubTabsInverso'
import { supabase } from '@/lib/supabase'

/* ── Tipos ─────────────────────────────────────────── */
type TabId = 'resumen' | 'facturas' | 'drive' | 'exportar'
type TitularFiltro = 'todos' | string

interface Titular {
  id: string
  nombre: string
  color: string
  carpeta_drive: string | null
}

interface CategoriaPyg {
  id: string
  nivel: number
  parent_id: string | null
  nombre: string
  bloque: string
  orden: number
}

interface FacturaRow {
  id: string
  fecha_factura: string | null
  proveedor_nombre: string
  total: number | null
  estado: string | null
  titular_id: string | null
  pdf_drive_url: string | null
  pdf_filename: string | null
  pdf_original_name: string | null
  categoria_factura: string | null
  nif_emisor: string | null
  tipo: string | null
}

interface DriveFiltro {
  titular_id?: string
  anio?: number
  trimestre?: number
  mes?: number
}

interface DriveNode {
  label: string
  count: number
  importe: number
  children?: DriveNode[]
  filtro: DriveFiltro
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'resumen',  label: 'Resumen' },
  { id: 'facturas', label: 'Facturas' },
  { id: 'drive',    label: 'Drive' },
  { id: 'exportar', label: 'Exportar' },
]

/* ── Helpers ───────────────────────────────────────── */
function fmtFechaCorta(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

function fmtNum(n: number | null | undefined, dec = 2): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '0,00'
  return Number(n).toLocaleString('es-ES', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
}

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const MESES_POR_TRIM: Record<number, number[]> = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
}

function colorEstado(estado: string | null): { bg: string; col: string; lbl: string } {
  switch (estado) {
    case 'asociada':                  return { bg: '#e8f5ec', col: COLORS.ok,    lbl: 'CONCILIADA' }
    case 'pendiente_revision':        return { bg: '#fcf0dc', col: COLORS.warn,  lbl: 'PEND. REV.' }
    case 'pendiente_titular_manual':  return { bg: '#fcf0dc', col: COLORS.warn,  lbl: 'FALTA TITULAR' }
    case 'sin_match':                 return { bg: '#fce8e8', col: COLORS.redSL, lbl: 'SIN MATCH' }
    case 'historica':                 return { bg: '#eef0f4', col: COLORS.mut,   lbl: 'HISTÓRICA' }
    case 'duplicada':                 return { bg: '#fce8e8', col: COLORS.redSL, lbl: 'DUPLICADA' }
    case 'error':                     return { bg: '#fce8e8', col: COLORS.redSL, lbl: 'ERROR' }
    case 'procesando':                return { bg: '#eef0f4', col: COLORS.mut,   lbl: 'PROCESANDO' }
    default:                          return { bg: '#eef0f4', col: COLORS.mut,   lbl: (estado || '—').toUpperCase() }
  }
}

/**
 * Construye el árbol Drive con estructura COMPLETA siempre visible:
 *   - los 2 titulares (siempre)
 *   - año actual + año pasado (siempre)
 *   - T1, T2, T3, T4 (siempre)
 *   - 12 meses (siempre)
 *
 * Los nodos sin facturas se renderizan con count=0 y se ven "apagados".
 */
function buildDriveTree(facturas: FacturaRow[], titulares: Titular[]): DriveNode[] {
  // 1) Indexar conteos reales: titular > año > mes
  const counts = new Map<string, Map<number, Map<number, { count: number; importe: number }>>>()
  for (const f of facturas) {
    if (!f.fecha_factura || !f.titular_id) continue
    const d = new Date(f.fecha_factura + 'T00:00:00')
    const anio = d.getFullYear()
    const mes  = d.getMonth() + 1

    if (!counts.has(f.titular_id)) counts.set(f.titular_id, new Map())
    const tMap = counts.get(f.titular_id)!
    if (!tMap.has(anio)) tMap.set(anio, new Map())
    const aMap = tMap.get(anio)!
    if (!aMap.has(mes)) aMap.set(mes, { count: 0, importe: 0 })
    const node = aMap.get(mes)!
    node.count += 1
    node.importe += Number(f.total || 0)
  }

  // 2) Determinar años a mostrar: por defecto año actual + anterior
  //    + cualquier año adicional con facturas reales
  const hoy = new Date()
  const anioActual = hoy.getFullYear()
  const aniosSet = new Set<number>([anioActual, anioActual - 1])
  for (const tMap of counts.values()) {
    for (const a of tMap.keys()) aniosSet.add(a)
  }
  const anios = Array.from(aniosSet).sort((a, b) => b - a)  // desc: más recientes arriba

  // 3) Construir árbol completo
  const tree: DriveNode[] = []
  for (const t of titulares) {
    const tMap = counts.get(t.id)
    const titNode: DriveNode = {
      label: t.nombre,
      count: 0, importe: 0, children: [],
      filtro: { titular_id: t.id },
    }

    for (const anio of anios) {
      const aMap = tMap?.get(anio)
      const aNode: DriveNode = {
        label: String(anio),
        count: 0, importe: 0, children: [],
        filtro: { titular_id: t.id, anio },
      }

      for (const trim of [1, 2, 3, 4]) {
        const qNode: DriveNode = {
          label: `T${trim}`,
          count: 0, importe: 0, children: [],
          filtro: { titular_id: t.id, anio, trimestre: trim },
        }

        for (const mes of MESES_POR_TRIM[trim]) {
          const data = aMap?.get(mes) ?? { count: 0, importe: 0 }
          qNode.children!.push({
            label: MESES[mes],
            count: data.count,
            importe: data.importe,
            filtro: { titular_id: t.id, anio, trimestre: trim, mes },
          })
          qNode.count += data.count
          qNode.importe += data.importe
        }

        aNode.children!.push(qNode)
        aNode.count += qNode.count
        aNode.importe += qNode.importe
      }

      titNode.children!.push(aNode)
      titNode.count += aNode.count
      titNode.importe += aNode.importe
    }

    tree.push(titNode)
  }
  return tree
}

function flattenCategorias(cats: CategoriaPyg[]): Array<{ id: string; label: string }> {
  const byParent = new Map<string | null, CategoriaPyg[]>()
  for (const c of cats) {
    const k = c.parent_id ?? null
    if (!byParent.has(k)) byParent.set(k, [])
    byParent.get(k)!.push(c)
  }
  for (const arr of byParent.values()) arr.sort((a, b) => a.orden - b.orden)
  const out: Array<{ id: string; label: string }> = []
  function walk(parent: string | null, depth: number) {
    const hijos = byParent.get(parent) || []
    for (const c of hijos) {
      const indent = '   '.repeat(depth)
      out.push({ id: c.id, label: `${indent}${c.id} ${c.nombre}` })
      walk(c.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════ */
export default function GestionFacturas() {
  const [activeTab, setActiveTab]   = useState<TabId>('facturas')
  const [titularFiltro, setTitular] = useState<TitularFiltro>('todos')
  const [busqueda, setBusqueda]     = useState('')
  const [categoriaId, setCategoria] = useState<string>('todas')
  const [periodoLabel, setPeriodoLabel] = useState('Mes en curso')
  const [fechaDesde, setFechaDesde] = useState<Date | null>(null)
  const [fechaHasta, setFechaHasta] = useState<Date | null>(null)
  const [driveFiltro, setDriveFiltro] = useState<DriveFiltro>({})
  const [expansionMap, setExpansionMap] = useState<Record<string, boolean>>({})

  const [titulares, setTitulares]   = useState<Titular[]>([])
  const [categorias, setCategorias] = useState<CategoriaPyg[]>([])
  const [facturas, setFacturas]     = useState<FacturaRow[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    let cancel = false
    async function load() {
      const [tRes, cRes, fRes] = await Promise.all([
        supabase.from('titulares').select('id, nombre, color, carpeta_drive').order('orden'),
        supabase.from('categorias_pyg').select('id, nivel, parent_id, nombre, bloque, orden').eq('activa', true).order('orden'),
        supabase.from('facturas')
          .select('id, fecha_factura, proveedor_nombre, total, estado, titular_id, pdf_drive_url, pdf_filename, pdf_original_name, categoria_factura, nif_emisor, tipo')
          .order('fecha_factura', { ascending: false, nullsFirst: false }),
      ])
      if (cancel) return
      setTitulares((tRes.data ?? []) as Titular[])
      setCategorias((cRes.data ?? []) as CategoriaPyg[])
      setFacturas(((fRes.data ?? []) as unknown as FacturaRow[]).map(f => ({
        ...f,
        total: f.total === null ? null : Number(f.total),
      })))
      setLoading(false)
    }
    load()
    return () => { cancel = true }
  }, [])

  const handleFecha = useCallback((desde: Date, hasta: Date, label: string) => {
    setFechaDesde(desde); setFechaHasta(hasta); setPeriodoLabel(label)
  }, [])

  const driveTree = useMemo(() => buildDriveTree(facturas, titulares), [facturas, titulares])

  // Inicialización árbol expandido: titulares + año actual + sus 4 trimestres expandidos
  useEffect(() => {
    if (Object.keys(expansionMap).length > 0) return
    if (driveTree.length === 0) return
    const init: Record<string, boolean> = {}
    const anioActual = new Date().getFullYear()
    for (const t of driveTree) {
      const titId = t.filtro.titular_id
      init[`t:${titId}`] = true
      // expandir el año actual
      init[`y:${titId}:${anioActual}`] = true
      // expandir T1-T4 del año actual
      for (const trim of [1, 2, 3, 4]) {
        init[`q:${titId}:${anioActual}:${trim}`] = true
      }
    }
    setExpansionMap(init)
  }, [driveTree, expansionMap])

  const categoriasFlat = useMemo(() => flattenCategorias(categorias), [categorias])
  const catNombre = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categorias) m.set(c.id, c.nombre)
    return m
  }, [categorias])

  const facturasFiltradas = useMemo(() => {
    return facturas.filter(f => {
      if (titularFiltro !== 'todos' && f.titular_id !== titularFiltro) return false
      if (driveFiltro.titular_id && f.titular_id !== driveFiltro.titular_id) return false
      if (driveFiltro.anio && f.fecha_factura) {
        const d = new Date(f.fecha_factura + 'T00:00:00')
        if (d.getFullYear() !== driveFiltro.anio) return false
        if (driveFiltro.trimestre) {
          const trim = Math.ceil((d.getMonth() + 1) / 3)
          if (trim !== driveFiltro.trimestre) return false
        }
        if (driveFiltro.mes && d.getMonth() + 1 !== driveFiltro.mes) return false
      }
      if (fechaDesde && fechaHasta && f.fecha_factura) {
        const d = new Date(f.fecha_factura + 'T00:00:00')
        if (d < fechaDesde || d > fechaHasta) return false
      }
      if (categoriaId !== 'todas') {
        if (!f.categoria_factura) return false
        if (!f.categoria_factura.startsWith(categoriaId)) return false
      }
      if (busqueda) {
        const q = busqueda.toLowerCase()
        const hit = (f.proveedor_nombre || '').toLowerCase().includes(q)
                  || (f.nif_emisor || '').toLowerCase().includes(q)
                  || String(f.total || '').includes(q)
        if (!hit) return false
      }
      return true
    })
  }, [facturas, titularFiltro, driveFiltro, fechaDesde, fechaHasta, categoriaId, busqueda])

  const totalImporte = facturasFiltradas.reduce((s, f) => s + Number(f.total || 0), 0)

  const breadcrumbDrive = useMemo(() => {
    if (!driveFiltro.titular_id) return null
    const t = titulares.find(x => x.id === driveFiltro.titular_id)
    const parts: string[] = [t?.nombre || '?']
    if (driveFiltro.anio) parts.push(String(driveFiltro.anio))
    if (driveFiltro.trimestre) parts.push(`T${driveFiltro.trimestre}`)
    if (driveFiltro.mes) parts.push(MESES[driveFiltro.mes])
    return parts.join(' › ')
  }, [driveFiltro, titulares])

  const titularesTabs = useMemo(() => [
    { id: 'todos', label: 'Todos' },
    ...titulares.map(t => ({ id: t.id, label: t.nombre })),
  ], [titulares])

  const thStyle: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px',
    textTransform: 'uppercase', color: COLORS.mut, padding: '10px 12px',
    textAlign: 'left', background: COLORS.group,
    borderBottom: `0.5px solid ${COLORS.brd}`, fontWeight: 400, whiteSpace: 'nowrap',
  }
  const tdStyle: CSSProperties = {
    padding: '11px 12px', fontSize: 13, fontFamily: FONT.body, color: COLORS.pri,
    borderBottom: `0.5px solid ${COLORS.brd}`, whiteSpace: 'nowrap',
  }

  const islaStyle: CSSProperties = {
    background: COLORS.card,
    border: `0.5px solid ${COLORS.brd}`,
    borderRadius: 8,
    padding: '4px 6px',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  }

  return (
    <div style={{ background: COLORS.bg, padding: '24px 28px', minHeight: '100%' }}>

      {/* HEADER */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 18, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h2 style={{
            color: COLORS.redSL, fontFamily: FONT.heading, fontSize: 22,
            fontWeight: 600, letterSpacing: '3px', margin: 0, textTransform: 'uppercase',
          }}>
            GESTIÓN DE FACTURAS
          </h2>
          <span style={{
            fontFamily: FONT.body, fontSize: 13, color: COLORS.mut,
            display: 'block', marginTop: 4,
          }}>
            {periodoLabel}
          </span>
        </div>
        <SelectorFechaUniversal
          nombreModulo="gestion_facturas"
          defaultOpcion="mes_en_curso"
          onChange={handleFecha}
        />
      </div>

      <TabsPastilla
        tabs={TABS}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
      />

      {activeTab === 'facturas' && (
        <>
          {/* FILA ÚNICA: titular + buscador + dropdown categorías + exportar */}
          <div style={{
            display: 'flex', gap: 10, alignItems: 'center',
            marginTop: 14, marginBottom: 14, flexWrap: 'wrap',
          }}>
            {titulares.length > 0 && (
              <div style={islaStyle}>
                <SubTabsInverso
                  tabs={titularesTabs}
                  activeId={titularFiltro}
                  onChange={(id) => setTitular(id as TitularFiltro)}
                />
              </div>
            )}

            <input
              type="text"
              placeholder="Buscar proveedor, NIF, importe…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                flex: 1, minWidth: 220, height: 36, padding: '0 12px',
                borderRadius: 8, border: `0.5px solid ${COLORS.brd}`,
                background: COLORS.card, fontSize: 13, fontFamily: FONT.body,
                color: COLORS.pri, outline: 'none',
              }}
            />

            <div style={{ ...islaStyle, padding: 0, overflow: 'hidden' }}>
              <select
                value={categoriaId}
                onChange={(e) => setCategoria(e.target.value)}
                style={{
                  ...DROPDOWN_BTN,
                  border: 'none',
                  background: 'transparent',
                  minWidth: 280, height: 36, paddingRight: 28,
                  cursor: 'pointer',
                }}
              >
                <option value="todas">Todas las categorías</option>
                {categoriasFlat.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setActiveTab('exportar')}
              style={{
                height: 36, padding: '0 16px', borderRadius: 8, border: 'none',
                background: COLORS.redSL, color: '#fff', fontSize: 13,
                fontFamily: FONT.body, fontWeight: 500, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              Exportar →
            </button>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14,
          }}>
            {/* Drive */}
            <div style={{
              background: COLORS.card, border: `0.5px solid ${COLORS.brd}`,
              borderRadius: 14, padding: 16, fontSize: 13, fontFamily: FONT.body,
              alignSelf: 'start',
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 12,
              }}>
                <span style={{
                  fontFamily: FONT.heading, fontSize: 11,
                  letterSpacing: '1.5px', textTransform: 'uppercase',
                  color: COLORS.mut, fontWeight: 500,
                }}>
                  Drive
                </span>
                {(driveFiltro.titular_id || driveFiltro.anio) && (
                  <button
                    type="button"
                    onClick={() => setDriveFiltro({})}
                    style={{
                      fontSize: 10, padding: '3px 9px', border: 'none',
                      background: COLORS.group, borderRadius: 4,
                      color: COLORS.sec, cursor: 'pointer', fontFamily: FONT.body,
                    }}
                  >
                    limpiar
                  </button>
                )}
              </div>

              {loading && <div style={{ color: COLORS.mut, fontSize: 12 }}>Cargando…</div>}

              {!loading && driveTree.map(tNode => (
                <NodoArbolItem
                  key={tNode.label}
                  node={tNode}
                  level={0}
                  filtroActivo={driveFiltro}
                  expansionMap={expansionMap}
                  onSelect={(filtro) => setDriveFiltro(filtro)}
                  onToggleExpand={(key) =>
                    setExpansionMap(m => ({ ...m, [key]: !m[key] }))
                  }
                />
              ))}
            </div>

            {/* Tabla */}
            <div style={{
              background: COLORS.card, border: `0.5px solid ${COLORS.brd}`,
              borderRadius: 14, overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 18px', borderBottom: `0.5px solid ${COLORS.group}`,
              }}>
                <div style={{
                  fontFamily: FONT.heading, fontSize: 10,
                  letterSpacing: '1.5px', color: COLORS.mut, textTransform: 'uppercase',
                }}>
                  {breadcrumbDrive || (titularFiltro === 'todos'
                    ? 'Todos los titulares'
                    : titulares.find(t => t.id === titularFiltro)?.nombre || '—')}
                </div>
                <div style={{
                  fontFamily: FONT.body, fontSize: 14, fontWeight: 500,
                  color: COLORS.pri, marginTop: 2,
                }}>
                  {facturasFiltradas.length} facturas · {fmtNum(totalImporte, 2)}
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Fecha</th>
                      <th style={thStyle}>Proveedor</th>
                      <th style={thStyle}>NIF</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Importe</th>
                      <th style={thStyle}>Categoría</th>
                      <th style={thStyle}>Titular</th>
                      <th style={thStyle}>PDF</th>
                      <th style={thStyle}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={8} style={{
                          ...tdStyle, textAlign: 'center', color: COLORS.mut, padding: '40px 12px',
                        }}>Cargando…</td>
                      </tr>
                    )}
                    {!loading && facturasFiltradas.map(f => {
                      const tit = titulares.find(t => t.id === f.titular_id)
                      const est = colorEstado(f.estado)
                      const catLbl = f.categoria_factura
                        ? `${f.categoria_factura} ${catNombre.get(f.categoria_factura) || ''}`.trim()
                        : '—'
                      return (
                        <tr
                          key={f.id}
                          onClick={() => f.pdf_drive_url && window.open(f.pdf_drive_url, '_blank', 'noopener')}
                          style={{ cursor: f.pdf_drive_url ? 'pointer' : 'default' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.bg)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td style={tdStyle}>{fmtFechaCorta(f.fecha_factura)}</td>
                          <td style={tdStyle}>{f.proveedor_nombre || '—'}</td>
                          <td style={{ ...tdStyle, color: COLORS.mut, fontSize: 12 }}>{f.nif_emisor || '—'}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 500 }}>{fmtNum(f.total, 2)}</td>
                          <td style={tdStyle}>
                            <span style={{
                              background: COLORS.bg, fontSize: 11, padding: '3px 9px',
                              borderRadius: 4, border: `0.5px solid ${COLORS.brd}`,
                              fontFamily: FONT.body, color: COLORS.sec,
                            }}>{catLbl}</span>
                          </td>
                          <td style={{ ...tdStyle, fontSize: 12 }}>
                            {tit ? <span style={{ color: tit.color || COLORS.pri }}>● {tit.nombre}</span>
                                 : <span style={{ color: COLORS.mut }}>—</span>}
                          </td>
                          <td style={{ ...tdStyle, fontSize: 12 }}>
                            {f.pdf_drive_url ? (
                              <a
                                href={f.pdf_drive_url}
                                target="_blank" rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{ color: COLORS.ok, fontWeight: 500, textDecoration: 'none' }}
                              >Ver PDF</a>
                            ) : <span style={{ color: COLORS.err }}>—</span>}
                          </td>
                          <td style={tdStyle}>
                            <span style={{
                              background: est.bg, color: est.col, fontFamily: FONT.heading,
                              fontSize: 9, letterSpacing: '0.5px', padding: '2px 8px',
                              borderRadius: 9, fontWeight: 500,
                            }}>{est.lbl}</span>
                          </td>
                        </tr>
                      )
                    })}
                    {!loading && facturasFiltradas.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{
                          ...tdStyle, textAlign: 'center', color: COLORS.mut, padding: '40px 12px',
                        }}>Sin facturas para los filtros seleccionados</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{
                padding: '12px 18px', borderTop: `0.5px solid ${COLORS.group}`,
                display: 'flex', justifyContent: 'space-between',
                fontSize: 11, fontFamily: FONT.body, color: COLORS.mut,
              }}>
                <span>{facturasFiltradas.length} de {facturas.length} facturas totales</span>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab !== 'facturas' && (
        <div style={{
          marginTop: 24, padding: 60, textAlign: 'center',
          background: COLORS.card, border: `0.5px solid ${COLORS.brd}`,
          borderRadius: 14, color: COLORS.mut, fontFamily: FONT.body, fontSize: 14,
        }}>
          {TABS.find(t => t.id === activeTab)?.label} · Próximamente
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   ÁRBOL DRIVE — clicable de verdad (botones nativos)
   ══════════════════════════════════════════════════════ */
interface NodoArbolItemProps {
  node: DriveNode
  level: number
  filtroActivo: DriveFiltro
  expansionMap: Record<string, boolean>
  onSelect: (filtro: DriveFiltro) => void
  onToggleExpand: (key: string) => void
}

function nodeKey(filtro: DriveFiltro): string {
  if (filtro.mes) return `m:${filtro.titular_id}:${filtro.anio}:${filtro.trimestre}:${filtro.mes}`
  if (filtro.trimestre) return `q:${filtro.titular_id}:${filtro.anio}:${filtro.trimestre}`
  if (filtro.anio) return `y:${filtro.titular_id}:${filtro.anio}`
  return `t:${filtro.titular_id}`
}

function NodoArbolItem({
  node, level, filtroActivo, expansionMap, onSelect, onToggleExpand,
}: NodoArbolItemProps) {
  const tieneHijos = !!(node.children && node.children.length > 0)
  const myKey = nodeKey(node.filtro)
  const expandido = expansionMap[myKey] ?? false
  const sinFacturas = node.count === 0

  const esActivo =
    filtroActivo.titular_id === node.filtro.titular_id &&
    filtroActivo.anio === node.filtro.anio &&
    filtroActivo.trimestre === node.filtro.trimestre &&
    filtroActivo.mes === node.filtro.mes

  // Color según estado:
  //   - activo: rojo SL con fondo claro
  //   - sin facturas: gris muted
  //   - normal: principal
  const rowColor = esActivo
    ? COLORS.redSL
    : (sinFacturas ? COLORS.mut : COLORS.pri)

  const rowStyle: CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center',
    padding: '5px 6px', paddingLeft: 4 + level * 12,
    background: esActivo ? '#FF475715' : 'transparent',
    border: 'none',
    borderLeft: esActivo ? `3px solid ${COLORS.redSL}` : '3px solid transparent',
    borderRadius: esActivo ? '0 4px 4px 0' : 0,
    cursor: 'pointer',
    fontFamily: FONT.body, fontSize: 13, textAlign: 'left',
    color: rowColor,
    fontWeight: esActivo ? 500 : 400,
    opacity: sinFacturas && !esActivo ? 0.55 : 1,
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {tieneHijos ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleExpand(myKey) }}
            style={{
              width: 20, height: 26, padding: 0, border: 'none',
              background: 'transparent', cursor: 'pointer',
              color: COLORS.mut, fontSize: 11,
            }}
            aria-label={expandido ? 'Contraer' : 'Expandir'}
          >
            {expandido ? '▾' : '▸'}
          </button>
        ) : (
          <span style={{ width: 20, display: 'inline-block', textAlign: 'center', color: COLORS.mut }}>·</span>
        )}

        <button
          type="button"
          onClick={() => onSelect(node.filtro)}
          style={rowStyle}
        >
          <span style={{ flex: 1 }}>{node.label}</span>
          <span style={{ color: COLORS.mut, fontSize: 11, marginLeft: 8 }}>
            {node.count > 0 ? node.count : '—'}
          </span>
        </button>
      </div>

      {expandido && tieneHijos && (
        <div>
          {node.children!.map((child, idx) => (
            <NodoArbolItem
              key={`${child.label}-${idx}`}
              node={child}
              level={level + 1}
              filtroActivo={filtroActivo}
              expansionMap={expansionMap}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  )
}
