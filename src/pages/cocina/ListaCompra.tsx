import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  useTheme,
  FONT,
  pageTitleStyle,
  groupStyle,
  cardStyle,
  sectionLabelStyle,
  tabActiveStyle,
  tabInactiveStyle,
  tabsContainerStyle,
} from '@/styles/tokens'
import type { TokenSet } from '@/styles/tokens'
import { Printer, Download, ShoppingCart, Package, ChevronDown, ChevronRight, Search, X } from 'lucide-react'

/* ─── types ─── */

interface Proveedor {
  id: string
  abv: string
  nombre: string
  nombre_completo: string
  categoria: string
  activo: boolean
}

interface Ingrediente {
  id: string
  nombre: string
  categoria: string | null
  formato: string | null
  ud_std: string | null
  precio_activo: number | null
  activo: boolean
  proveedor_abv: string
}

interface ProduccionSeccion {
  id: string
  nombre: string
  orden: number
}

interface ProduccionPartida {
  id: string
  seccion_id: string
  nombre: string
  orden: number
  activa: boolean
  biberon: boolean
  solo_camara: boolean
}

interface LineaCompra extends Ingrediente {
  cantidad: number
  checked: boolean
}

/* ─── helpers ─── */

function extraerAbvProveedor(nombre: string): string {
  const m = nombre.match(/_([A-Z]{2,4})$/)
  return m ? m[1] : '???'
}

function nombreSinSufijo(nombre: string): string {
  return nombre.replace(/_[A-Z]{2,4}$/, '').trim()
}

function fmtEur(v: number): string {
  return v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/* ─── component ─── */

export default function ListaCompra() {
  const { T, isDark } = useTheme()

  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [secciones, setSecciones] = useState<ProduccionSeccion[]>([])
  const [partidas, setPartidas] = useState<ProduccionPartida[]>([])
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState<'compra' | 'produccion'>('compra')
  const [filtroProveedor, setFiltroProveedor] = useState<string>('TODOS')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS')
  const [busqueda, setBusqueda] = useState('')
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<Record<string, boolean>>({})

  const printRef = useRef<HTMLDivElement>(null)

  /* ─── load data ─── */

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [pRes, iRes, sRes, paRes] = await Promise.all([
        supabase.from('config_proveedores').select('*').eq('activo', true).order('nombre'),
        supabase.from('ingredientes').select('id,nombre,categoria,formato,ud_std,precio_activo,activo').eq('activo', true).order('categoria').order('nombre'),
        supabase.from('produccion_secciones').select('*').eq('activa', true).order('orden'),
        supabase.from('produccion_partidas').select('*').eq('activa', true).order('orden'),
      ])
      setProveedores((pRes.data ?? []) as Proveedor[])
      const ings = ((iRes.data ?? []) as any[]).map(i => ({
        ...i,
        precio_activo: i.precio_activo ? Number(i.precio_activo) : null,
        proveedor_abv: extraerAbvProveedor(i.nombre),
      })) as Ingrediente[]
      setIngredientes(ings)
      setSecciones((sRes.data ?? []) as ProduccionSeccion[])
      setPartidas((paRes.data ?? []) as ProduccionPartida[])
      // Abrir primera sección
      const firstOpen: Record<string, boolean> = {}
      if (sRes.data?.[0]) firstOpen[sRes.data[0].id] = true
      setSeccionesAbiertas(firstOpen)
      setLoading(false)
    }
    load()
  }, [])

  /* ─── derived ─── */

  const proveedorMap = useMemo(() => {
    const m: Record<string, Proveedor> = {}
    proveedores.forEach(p => { m[p.abv] = p })
    return m
  }, [proveedores])

  const categorias = useMemo(() => {
    const set = new Set<string>()
    ingredientes.forEach(i => { if (i.categoria) set.add(i.categoria) })
    return Array.from(set).sort()
  }, [ingredientes])

  const ingredientesFiltrados = useMemo(() => {
    return ingredientes.filter(i => {
      if (filtroProveedor !== 'TODOS' && i.proveedor_abv !== filtroProveedor) return false
      if (filtroCategoria !== 'TODAS' && i.categoria !== filtroCategoria) return false
      if (busqueda) {
        const q = busqueda.toLowerCase()
        if (!i.nombre.toLowerCase().includes(q) && !(i.categoria ?? '').toLowerCase().includes(q)) return false
      }
      // Excluir agua
      if (/^agua/i.test(i.nombre)) return false
      // Excluir internos (EPS, MRM)
      if (i.proveedor_abv === 'EPS' || i.proveedor_abv === 'MRM') return false
      return true
    })
  }, [ingredientes, filtroProveedor, filtroCategoria, busqueda])

  const gruposPorProveedor = useMemo(() => {
    const groups: Record<string, Ingrediente[]> = {}
    ingredientesFiltrados.forEach(i => {
      const abv = i.proveedor_abv
      if (!groups[abv]) groups[abv] = []
      groups[abv].push(i)
    })
    // Ordenar por nombre de proveedor
    return Object.entries(groups).sort(([a], [b]) => {
      const pA = proveedorMap[a]?.nombre ?? a
      const pB = proveedorMap[b]?.nombre ?? b
      return pA.localeCompare(pB)
    })
  }, [ingredientesFiltrados, proveedorMap])

  const totalGeneral = useMemo(() => {
    let total = 0
    ingredientesFiltrados.forEach(i => {
      const qty = cantidades[i.id] || 0
      total += qty * (i.precio_activo || 0)
    })
    return total
  }, [ingredientesFiltrados, cantidades])

  const itemsConCantidad = useMemo(() => {
    return ingredientesFiltrados.filter(i => (cantidades[i.id] || 0) > 0).length
  }, [ingredientesFiltrados, cantidades])

  /* ─── handlers ─── */

  const setCantidad = (id: string, v: number) => {
    setCantidades(prev => ({ ...prev, [id]: Math.max(0, v) }))
  }

  const toggleCheck = (id: string) => {
    setChecks(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleSeccion = (id: string) => {
    setSeccionesAbiertas(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportCSV = () => {
    const lines: string[] = ['Proveedor;Ingrediente;Categoría;Formato;Unidad;Precio;Cantidad;Total']
    gruposPorProveedor.forEach(([abv, items]) => {
      const provNombre = proveedorMap[abv]?.nombre ?? abv
      items.forEach(i => {
        const qty = cantidades[i.id] || 0
        if (qty > 0) {
          lines.push([
            provNombre,
            nombreSinSufijo(i.nombre),
            i.categoria ?? '',
            i.formato ?? '',
            i.ud_std ?? '',
            (i.precio_activo ?? 0).toFixed(2),
            qty.toString(),
            (qty * (i.precio_activo ?? 0)).toFixed(2),
          ].join(';'))
        }
      })
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lista-compra-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const limpiarTodo = () => {
    setCantidades({})
    setChecks({})
  }

  /* ─── render ─── */

  if (loading) {
    return (
      <div style={{ padding: 28 }}>
        <h1 style={pageTitleStyle(T)}>Lista de Compra</h1>
        <div style={{ ...cardStyle(T), textAlign: 'center', padding: 40 }}>
          <p style={{ fontFamily: FONT.body, color: T.mut, fontSize: 14 }}>Cargando datos…</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 28, maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <h1 style={{ ...pageTitleStyle(T), margin: 0 }}>Lista de Compra</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionBtn T={T} icon={<Printer size={14} />} label="Imprimir" onClick={handlePrint} />
          <ActionBtn T={T} icon={<Download size={14} />} label="CSV" onClick={handleExportCSV} />
          {itemsConCantidad > 0 && (
            <ActionBtn T={T} icon={<X size={14} />} label="Limpiar" onClick={limpiarTodo} danger />
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 18 }}>
        <KpiMini T={T} label="Proveedores" value={gruposPorProveedor.length.toString()} />
        <KpiMini T={T} label="Ingredientes" value={ingredientesFiltrados.length.toString()} />
        <KpiMini T={T} label="En lista" value={itemsConCantidad.toString()} accent />
        <KpiMini T={T} label="Total estimado" value={fmtEur(totalGeneral)} accent={totalGeneral > 0} />
      </div>

      {/* Tabs */}
      <div style={tabsContainerStyle()}>
        <button style={tab === 'compra' ? tabActiveStyle(isDark) : tabInactiveStyle(T)} onClick={() => setTab('compra')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ShoppingCart size={14} /> Lista de Compra</span>
        </button>
        <button style={tab === 'produccion' ? tabActiveStyle(isDark) : tabInactiveStyle(T)} onClick={() => setTab('produccion')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Package size={14} /> Hoja de Producción</span>
        </button>
      </div>

      {tab === 'compra' && (
        <TabCompra
          T={T}
          isDark={isDark}
          proveedores={proveedores}
          proveedorMap={proveedorMap}
          categorias={categorias}
          gruposPorProveedor={gruposPorProveedor}
          filtroProveedor={filtroProveedor}
          setFiltroProveedor={setFiltroProveedor}
          filtroCategoria={filtroCategoria}
          setFiltroCategoria={setFiltroCategoria}
          busqueda={busqueda}
          setBusqueda={setBusqueda}
          cantidades={cantidades}
          setCantidad={setCantidad}
          checks={checks}
          toggleCheck={toggleCheck}
          printRef={printRef}
        />
      )}

      {tab === 'produccion' && (
        <TabProduccion
          T={T}
          isDark={isDark}
          secciones={secciones}
          partidas={partidas}
          seccionesAbiertas={seccionesAbiertas}
          toggleSeccion={toggleSeccion}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   TAB: Lista de Compra
   ═══════════════════════════════════════════════════════════ */

function TabCompra({
  T, isDark, proveedores, proveedorMap, categorias, gruposPorProveedor,
  filtroProveedor, setFiltroProveedor, filtroCategoria, setFiltroCategoria,
  busqueda, setBusqueda, cantidades, setCantidad, checks, toggleCheck, printRef,
}: {
  T: TokenSet; isDark: boolean
  proveedores: Proveedor[]
  proveedorMap: Record<string, Proveedor>
  categorias: string[]
  gruposPorProveedor: [string, Ingrediente[]][]
  filtroProveedor: string; setFiltroProveedor: (v: string) => void
  filtroCategoria: string; setFiltroCategoria: (v: string) => void
  busqueda: string; setBusqueda: (v: string) => void
  cantidades: Record<string, number>; setCantidad: (id: string, v: number) => void
  checks: Record<string, boolean>; toggleCheck: (id: string) => void
  printRef: React.RefObject<HTMLDivElement | null>
}) {
  const inputStyle: React.CSSProperties = {
    padding: '5px 8px',
    borderRadius: 6,
    border: `0.5px solid ${T.brd}`,
    background: T.inp,
    color: T.pri,
    fontSize: 13,
    fontFamily: FONT.body,
    minWidth: 0,
  }

  const proveedoresExternos = proveedores.filter(p => p.abv !== 'EPS' && p.abv !== 'MRM')

  return (
    <div ref={printRef}>
      {/* Filtros */}
      <div style={{ ...groupStyle(T), marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.mut }} />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar ingrediente…"
            style={{ ...inputStyle, width: '100%', paddingLeft: 30 }}
          />
        </div>
        <select value={filtroProveedor} onChange={e => setFiltroProveedor(e.target.value)} style={{ ...inputStyle, flex: '0 0 auto' }}>
          <option value="TODOS">Todos los proveedores</option>
          {proveedoresExternos.map(p => (
            <option key={p.abv} value={p.abv}>{p.nombre} ({p.abv})</option>
          ))}
        </select>
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={{ ...inputStyle, flex: '0 0 auto' }}>
          <option value="TODAS">Todas las categorías</option>
          {categorias.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Grupos por proveedor */}
      {gruposPorProveedor.length === 0 ? (
        <div style={{ ...cardStyle(T), textAlign: 'center', padding: 40 }}>
          <p style={{ fontFamily: FONT.body, color: T.mut, fontSize: 14 }}>No hay ingredientes con los filtros actuales</p>
        </div>
      ) : (
        gruposPorProveedor.map(([abv, items]) => (
          <ProveedorGroup
            key={abv}
            abv={abv}
            items={items}
            proveedor={proveedorMap[abv]}
            T={T}
            isDark={isDark}
            cantidades={cantidades}
            setCantidad={setCantidad}
            checks={checks}
            toggleCheck={toggleCheck}
          />
        ))
      )}
    </div>
  )
}

/* ─── Grupo proveedor ─── */

function ProveedorGroup({
  abv, items, proveedor, T, isDark, cantidades, setCantidad, checks, toggleCheck,
}: {
  abv: string; items: Ingrediente[]; proveedor?: Proveedor
  T: TokenSet; isDark: boolean
  cantidades: Record<string, number>; setCantidad: (id: string, v: number) => void
  checks: Record<string, boolean>; toggleCheck: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const nombre = proveedor?.nombre ?? abv
  const cat = proveedor?.categoria ?? ''

  const totalGrupo = items.reduce((sum, i) => {
    const qty = cantidades[i.id] || 0
    return sum + qty * (i.precio_activo || 0)
  }, 0)

  const itemsEnLista = items.filter(i => (cantidades[i.id] || 0) > 0).length

  const thStyle: React.CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: T.mut,
    padding: '8px 10px',
    textAlign: 'left',
    borderBottom: `1px solid ${T.brd}`,
    whiteSpace: 'nowrap',
  }

  const tdStyle: React.CSSProperties = {
    fontFamily: FONT.body,
    fontSize: 13,
    color: T.pri,
    padding: '7px 10px',
    borderBottom: `0.5px solid ${T.brd}`,
    verticalAlign: 'middle',
  }

  return (
    <div style={{ ...groupStyle(T), marginBottom: 14 }}>
      {/* Header proveedor */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 0, margin: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {open ? <ChevronDown size={16} color={T.mut} /> : <ChevronRight size={16} color={T.mut} />}
          <span style={{ fontFamily: FONT.heading, fontSize: 16, color: '#B01D23', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>
            {nombre}
          </span>
          <span style={{ fontFamily: FONT.heading, fontSize: 11, color: T.mut, letterSpacing: '1px', textTransform: 'uppercase' }}>
            {cat}
          </span>
          <span style={{
            fontFamily: FONT.body, fontSize: 11, color: '#fff', background: '#B01D23',
            borderRadius: 10, padding: '1px 8px', minWidth: 20, textAlign: 'center',
          }}>
            {items.length}
          </span>
          {itemsEnLista > 0 && (
            <span style={{
              fontFamily: FONT.body, fontSize: 11, color: '#fff', background: '#1D9E75',
              borderRadius: 10, padding: '1px 8px',
            }}>
              {itemsEnLista} en lista
            </span>
          )}
        </div>
        {totalGrupo > 0 && (
          <span style={{ fontFamily: FONT.heading, fontSize: 14, color: '#1D9E75', fontWeight: 600 }}>
            {fmtEur(totalGrupo)}
          </span>
        )}
      </button>

      {/* Table */}
      {open && (
        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 30 }}></th>
                <th style={thStyle}>Ingrediente</th>
                <th style={thStyle}>Categoría</th>
                <th style={thStyle}>Formato</th>
                <th style={thStyle}>Ud.</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Precio</th>
                <th style={{ ...thStyle, textAlign: 'center', width: 80 }}>Cant.</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map(i => {
                const qty = cantidades[i.id] || 0
                const checked = checks[i.id] || false
                const total = qty * (i.precio_activo || 0)
                const rowBg = checked
                  ? (isDark ? 'rgba(29,158,117,0.08)' : 'rgba(29,158,117,0.06)')
                  : 'transparent'
                return (
                  <tr key={i.id} style={{ background: rowBg, transition: 'background 150ms' }}>
                    <td style={tdStyle}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCheck(i.id)}
                        style={{ cursor: 'pointer', accentColor: '#1D9E75', width: 15, height: 15 }}
                      />
                    </td>
                    <td style={{ ...tdStyle, fontWeight: qty > 0 ? 600 : 400, textDecoration: checked ? 'line-through' : 'none', color: checked ? T.mut : T.pri }}>
                      {nombreSinSufijo(i.nombre)}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12, color: T.sec }}>{i.categoria ?? '—'}</td>
                    <td style={{ ...tdStyle, fontSize: 12, color: T.sec }}>{i.formato ?? '—'}</td>
                    <td style={{ ...tdStyle, fontSize: 12, color: T.sec }}>{i.ud_std ?? '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontSize: 12, color: T.sec }}>
                      {i.precio_activo ? fmtEur(i.precio_activo) : '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <input
                        type="number"
                        min={0}
                        value={qty || ''}
                        onChange={e => setCantidad(i.id, Number(e.target.value) || 0)}
                        placeholder="0"
                        style={{
                          width: 56,
                          padding: '3px 6px',
                          borderRadius: 4,
                          border: `0.5px solid ${qty > 0 ? '#1D9E75' : T.brd}`,
                          background: qty > 0 ? (isDark ? 'rgba(29,158,117,0.12)' : 'rgba(29,158,117,0.08)') : T.inp,
                          color: T.pri,
                          fontSize: 13,
                          fontFamily: FONT.body,
                          textAlign: 'center',
                        }}
                      />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: total > 0 ? 600 : 400, color: total > 0 ? '#1D9E75' : T.mut }}>
                      {total > 0 ? fmtEur(total) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   TAB: Hoja de Producción
   ═══════════════════════════════════════════════════════════ */

function TabProduccion({
  T, isDark, secciones, partidas, seccionesAbiertas, toggleSeccion,
}: {
  T: TokenSet; isDark: boolean
  secciones: ProduccionSeccion[]
  partidas: ProduccionPartida[]
  seccionesAbiertas: Record<string, boolean>
  toggleSeccion: (id: string) => void
}) {
  return (
    <div>
      <p style={{ ...sectionLabelStyle(T), marginBottom: 14 }}>
        Secciones de cocina · {partidas.length} partidas activas
      </p>

      {secciones.map(sec => {
        const items = partidas.filter(p => p.seccion_id === sec.id)
        const isOpen = seccionesAbiertas[sec.id] ?? false

        return (
          <div key={sec.id} style={{ ...groupStyle(T), marginBottom: 12 }}>
            <button
              onClick={() => toggleSeccion(sec.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', width: '100%',
                display: 'flex', alignItems: 'center', gap: 10, padding: 0,
              }}
            >
              {isOpen ? <ChevronDown size={16} color={T.mut} /> : <ChevronRight size={16} color={T.mut} />}
              <span style={{ fontFamily: FONT.heading, fontSize: 14, color: '#B01D23', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>
                {sec.nombre}
              </span>
              <span style={{
                fontFamily: FONT.body, fontSize: 11, color: '#fff', background: '#B01D23',
                borderRadius: 10, padding: '1px 8px',
              }}>
                {items.length}
              </span>
            </button>

            {isOpen && (
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>
                {items.map(p => (
                  <div
                    key={p.id}
                    style={{
                      ...cardStyle(T),
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 14px',
                    }}
                  >
                    <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, flex: 1 }}>
                      {p.nombre}
                    </span>
                    {p.biberon && (
                      <span style={{ fontSize: 10, color: T.mut, fontFamily: FONT.heading, letterSpacing: '1px', textTransform: 'uppercase', background: isDark ? '#2a3050' : '#e8e4dc', borderRadius: 4, padding: '1px 5px' }}>
                        BIB
                      </span>
                    )}
                    {p.solo_camara && (
                      <span style={{ fontSize: 10, color: '#66aaff', fontFamily: FONT.heading, letterSpacing: '1px', textTransform: 'uppercase', background: isDark ? '#1a2540' : '#e0eaff', borderRadius: 4, padding: '1px 5px' }}>
                        CÁM
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {secciones.length === 0 && (
        <div style={{ ...cardStyle(T), textAlign: 'center', padding: 40 }}>
          <p style={{ fontFamily: FONT.body, color: T.mut, fontSize: 14 }}>No hay secciones de producción configuradas</p>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTES UI
   ═══════════════════════════════════════════════════════════ */

function KpiMini({ T, label, value, accent }: { T: TokenSet; label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ ...cardStyle(T), textAlign: 'center', padding: '12px 10px' }}>
      <p style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, margin: '0 0 4px' }}>
        {label}
      </p>
      <p style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: accent ? '#1D9E75' : T.pri, margin: 0, lineHeight: 1.1 }}>
        {value}
      </p>
    </div>
  )
}

function ActionBtn({ T, icon, label, onClick, danger }: { T: TokenSet; icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 6,
        border: `0.5px solid ${danger ? '#B01D23' : T.brd}`,
        background: danger ? 'rgba(176,29,35,0.1)' : 'transparent',
        color: danger ? '#B01D23' : T.sec,
        fontFamily: FONT.body, fontSize: 12,
        cursor: 'pointer', transition: 'background 150ms',
      }}
    >
      {icon} {label}
    </button>
  )
}
