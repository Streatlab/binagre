import { useState, useEffect, useMemo } from 'react'
import { useTheme, FONT, pageTitleStyle, groupStyle, cardStyle } from '@/styles/tokens'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { fmtEur } from '@/utils/format'

interface Inventario {
  id: string
  fecha: string
  estado: 'ABIERTO' | 'CERRADO'
  usuario: string
  created_at: string
}

interface Ingrediente {
  id: string
  iding: string
  nombre: string
  ud_std: string
  precio_activo: number | null
}

interface LineaInventario {
  id?: string
  inventario_id?: string
  iding: string
  cantidad: number | null
  unidad: string
  coste_unitario?: number | null
  nombre?: string
}

type Vista = 'lista' | 'nuevo' | 'detalle'

export default function CocinaInventario() {
  const { T } = useTheme()
  const { usuario } = useAuth()

  const [vista, setVista] = useState<Vista>('lista')
  const [inventarios, setInventarios] = useState<Inventario[]>([])
  const [cargandoInv, setCargandoInv] = useState(false)
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [cargandoIng, setCargandoIng] = useState(false)
  const [lineas, setLineas] = useState<LineaInventario[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [cerrando, setCerrando] = useState<string | null>(null)
  const [inventarioActivo, setInventarioActivo] = useState<Inventario | null>(null)
  const [lineasDetalle, setLineasDetalle] = useState<LineaInventario[]>([])

  // Carga lista inventarios
  async function cargarInventarios() {
    setCargandoInv(true)
    const { data } = await supabase
      .from('inventarios')
      .select('*')
      .order('fecha', { ascending: false })
    setInventarios((data as Inventario[]) ?? [])
    setCargandoInv(false)
  }

  // Carga ingredientes
  async function cargarIngredientes() {
    setCargandoIng(true)
    const { data } = await supabase
      .from('ingredientes')
      .select('id, iding, nombre, ud_std, precio_activo')
      .eq('activo', true)
      .order('iding', { ascending: true })
    const rows = (data as Ingrediente[]) ?? []
    setIngredientes(rows)
    // Inicializar lineas con cantidad null para cada ingrediente
    setLineas(rows.map(ing => ({
      iding: ing.iding,
      cantidad: null,
      unidad: ing.ud_std ?? '',
      nombre: ing.nombre,
    })))
    setCargandoIng(false)
  }

  useEffect(() => {
    cargarInventarios()
  }, [])

  // Ingredientes filtrados por búsqueda
  const lineasFiltradas = useMemo(() => {
    if (!busqueda.trim()) return lineas
    const q = busqueda.toLowerCase()
    return lineas.filter(l =>
      l.nombre?.toLowerCase().includes(q) || l.iding.toLowerCase().includes(q)
    )
  }, [lineas, busqueda])

  // Food cost badge: si hay >= 2 inventarios CERRADOS → real, sino teórico
  const foodCostBadge = useMemo(() => {
    const cerrados = inventarios.filter(i => i.estado === 'CERRADO')
    return cerrados.length >= 2 ? 'real' : 'teorico'
  }, [inventarios])

  function handleNuevoInventario() {
    cargarIngredientes()
    setVista('nuevo')
    setBusqueda('')
  }

  function handleCantidadChange(iding: string, val: string) {
    const num = val === '' ? null : parseFloat(val.replace(',', '.'))
    setLineas(prev => prev.map(l => l.iding === iding ? { ...l, cantidad: isNaN(num as number) ? null : num } : l))
  }

  async function handleGuardarInventario() {
    setGuardando(true)
    const fechaHoy = new Date().toISOString().slice(0, 10)
    const { data: inv, error: errInv } = await supabase
      .from('inventarios')
      .insert({ fecha: fechaHoy, estado: 'ABIERTO', usuario: usuario?.nombre ?? 'Desconocido' })
      .select()
      .single()
    if (errInv || !inv) { setGuardando(false); return }

    const lineasConCantidad = lineas.filter(l => l.cantidad !== null && l.cantidad !== undefined)
    if (lineasConCantidad.length > 0) {
      const ing = ingredientes.reduce<Record<string, Ingrediente>>((acc, i) => { acc[i.iding] = i; return acc }, {})
      await supabase.from('inventario_lineas').insert(
        lineasConCantidad.map(l => ({
          inventario_id: inv.id,
          iding: l.iding,
          cantidad: l.cantidad,
          unidad: l.unidad,
          coste_unitario: ing[l.iding]?.precio_activo ?? null,
        }))
      )
    }
    setGuardando(false)
    setVista('lista')
    cargarInventarios()
  }

  async function handleCerrarInventario(inv: Inventario) {
    setCerrando(inv.id)
    // Copiar precio_activo de ingredientes a coste_unitario de las líneas
    const { data: lineasInv } = await supabase
      .from('inventario_lineas')
      .select('id, iding')
      .eq('inventario_id', inv.id)

    if (lineasInv && lineasInv.length > 0) {
      const idings = lineasInv.map((l: { iding: string }) => l.iding)
      const { data: ingsData } = await supabase
        .from('ingredientes')
        .select('iding, precio_activo')
        .in('iding', idings)
      const precioMap: Record<string, number | null> = {}
      ;(ingsData ?? []).forEach((i: { iding: string; precio_activo: number | null }) => {
        precioMap[i.iding] = i.precio_activo
      })
      // Actualizar cada línea
      await Promise.all(
        lineasInv.map((l: { id: string; iding: string }) =>
          supabase
            .from('inventario_lineas')
            .update({ coste_unitario: precioMap[l.iding] ?? null })
            .eq('id', l.id)
        )
      )
    }

    await supabase.from('inventarios').update({ estado: 'CERRADO' }).eq('id', inv.id)
    setCerrando(null)
    cargarInventarios()
  }

  async function handleVerDetalle(inv: Inventario) {
    setInventarioActivo(inv)
    const { data } = await supabase
      .from('inventario_lineas')
      .select('*, ingredientes!left(nombre)')
      .eq('inventario_id', inv.id)
      .order('iding')
    setLineasDetalle(
      ((data as any[]) ?? []).map(l => ({
        id: l.id,
        inventario_id: l.inventario_id,
        iding: l.iding,
        cantidad: l.cantidad,
        unidad: l.unidad,
        coste_unitario: l.coste_unitario,
        nombre: l.ingredientes?.nombre ?? l.iding,
      }))
    )
    setVista('detalle')
  }

  // ─── RENDER LISTA ─────────────────────────────────────────────────────────
  if (vista === 'lista') {
    return (
      <div style={{ background: 'var(--sl-app)', minHeight: '100vh', padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '3px', textTransform: 'uppercase', color: '#B01D23', margin: 0 }}>
            Inventario Cocina
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              padding: '4px 12px',
              borderRadius: 6,
              fontFamily: FONT.heading,
              fontSize: 10,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              fontWeight: 600,
              background: foodCostBadge === 'real' ? '#1D9E7520' : '#e8f44220',
              color: foodCostBadge === 'real' ? '#1D9E75' : '#e8f442',
              border: `0.5px solid ${foodCostBadge === 'real' ? '#1D9E75' : '#e8f442'}`,
            }}>
              Food cost {foodCostBadge === 'real' ? 'real' : 'teórico (escandallo)'}
            </span>
            <button
              onClick={handleNuevoInventario}
              style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#e8f442', color: 'var(--sl-text-primary)', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600, minHeight: 44 }}
            >
              + Nuevo inventario
            </button>
          </div>
        </div>

        {cargandoInv ? (
          <div style={{ fontFamily: FONT.body, fontSize: 13, color: 'var(--sl-text-muted)', padding: '32px 0' }}>Cargando…</div>
        ) : inventarios.length === 0 ? (
          <div style={{ background: 'var(--sl-card)', border: '0.5px solid var(--sl-border)', borderRadius: 14, padding: '48px 28px', textAlign: 'center' }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 16, color: 'var(--sl-text-muted)', letterSpacing: 1, marginBottom: 8 }}>Sin inventarios</div>
            <div style={{ fontFamily: FONT.body, fontSize: 13, color: 'var(--sl-text-muted)' }}>Crea el primer inventario para empezar</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {inventarios.map(inv => (
              <div
                key={inv.id}
                style={{ background: 'var(--sl-card)', border: '0.5px solid var(--sl-border)', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: 6,
                    fontFamily: FONT.heading,
                    fontSize: 10,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    background: inv.estado === 'ABIERTO' ? '#e8f44215' : '#1D9E7515',
                    color: inv.estado === 'ABIERTO' ? '#e8f442' : '#1D9E75',
                    border: `0.5px solid ${inv.estado === 'ABIERTO' ? '#e8f44250' : '#1D9E7550'}`,
                  }}>
                    {inv.estado}
                  </span>
                  <div>
                    <div style={{ fontFamily: FONT.heading, fontSize: 14, color: 'var(--sl-text-primary)', letterSpacing: '1px' }}>
                      {new Date(inv.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                    <div style={{ fontFamily: FONT.body, fontSize: 12, color: 'var(--sl-text-muted)', marginTop: 2 }}>
                      {inv.usuario}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleVerDetalle(inv)}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '0.5px solid var(--sl-border)', background: 'var(--sl-btn-cancel-bg)', color: 'var(--sl-btn-cancel-text)', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', minHeight: 36 }}
                  >
                    Ver
                  </button>
                  {inv.estado === 'ABIERTO' && (
                    <button
                      onClick={() => handleCerrarInventario(inv)}
                      disabled={cerrando === inv.id}
                      style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#B01D23', color: '#fff', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: cerrando === inv.id ? 'default' : 'pointer', opacity: cerrando === inv.id ? 0.6 : 1, minHeight: 36 }}
                    >
                      {cerrando === inv.id ? 'Cerrando…' : 'Cerrar'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── RENDER DETALLE ────────────────────────────────────────────────────────
  if (vista === 'detalle' && inventarioActivo) {
    const totalCoste = lineasDetalle.reduce((s, l) => s + ((l.cantidad ?? 0) * (l.coste_unitario ?? 0)), 0)
    return (
      <div style={{ background: 'var(--sl-app)', minHeight: '100vh', padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
          <button onClick={() => setVista('lista')} style={{ padding: '8px 14px', borderRadius: 8, border: '0.5px solid var(--sl-border)', background: 'var(--sl-btn-cancel-bg)', color: 'var(--sl-btn-cancel-text)', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', minHeight: 36 }}>
            ← Volver
          </button>
          <div>
            <h2 style={{ fontFamily: FONT.heading, fontSize: 18, letterSpacing: '2px', textTransform: 'uppercase', color: '#B01D23', margin: 0 }}>
              Inventario {new Date(inventarioActivo.fecha + 'T12:00:00').toLocaleDateString('es-ES')}
            </h2>
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: 'var(--sl-text-muted)', marginTop: 2 }}>
              {inventarioActivo.usuario} · <span style={{ color: inventarioActivo.estado === 'ABIERTO' ? '#e8f442' : '#1D9E75' }}>{inventarioActivo.estado}</span>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', fontFamily: FONT.heading, fontSize: 14, color: 'var(--sl-text-primary)', letterSpacing: '1px' }}>
            Total coste: <span style={{ color: '#e8f442' }}>{fmtEur(totalCoste)}</span>
          </div>
        </div>
        <div style={{ background: 'var(--sl-card)', border: '0.5px solid var(--sl-border)', borderRadius: 14, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontFamily: FONT.body, fontSize: 13, minWidth: 500 }}>
            <thead>
              <tr style={{ background: 'var(--sl-thead)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--sl-text-muted)', borderBottom: '0.5px solid var(--sl-border)' }}>IDING</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--sl-text-muted)', borderBottom: '0.5px solid var(--sl-border)' }}>Nombre</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--sl-text-muted)', borderBottom: '0.5px solid var(--sl-border)' }}>Cantidad</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--sl-text-muted)', borderBottom: '0.5px solid var(--sl-border)' }}>Unidad</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--sl-text-muted)', borderBottom: '0.5px solid var(--sl-border)' }}>Coste unit.</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--sl-text-muted)', borderBottom: '0.5px solid var(--sl-border)' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {lineasDetalle.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--sl-text-muted)' }}>Sin líneas registradas</td></tr>
              ) : lineasDetalle.map((l, i) => {
                const isLast = i === lineasDetalle.length - 1
                const total = (l.cantidad ?? 0) * (l.coste_unitario ?? 0)
                return (
                  <tr key={l.id ?? l.iding}>
                    <td style={{ padding: '9px 16px', borderBottom: isLast ? 'none' : '0.5px solid var(--sl-border)', color: 'var(--sl-text-secondary)', fontFamily: FONT.heading, fontSize: 12 }}>{l.iding}</td>
                    <td style={{ padding: '9px 16px', borderBottom: isLast ? 'none' : '0.5px solid var(--sl-border)', color: 'var(--sl-text-primary)' }}>{l.nombre ?? l.iding}</td>
                    <td style={{ padding: '9px 16px', borderBottom: isLast ? 'none' : '0.5px solid var(--sl-border)', textAlign: 'right', color: 'var(--sl-text-primary)' }}>{l.cantidad ?? '—'}</td>
                    <td style={{ padding: '9px 16px', borderBottom: isLast ? 'none' : '0.5px solid var(--sl-border)', color: 'var(--sl-text-secondary)' }}>{l.unidad}</td>
                    <td style={{ padding: '9px 16px', borderBottom: isLast ? 'none' : '0.5px solid var(--sl-border)', textAlign: 'right', color: 'var(--sl-text-secondary)', fontFamily: FONT.heading, fontSize: 12 }}>{l.coste_unitario != null ? fmtEur(l.coste_unitario) : '—'}</td>
                    <td style={{ padding: '9px 16px', borderBottom: isLast ? 'none' : '0.5px solid var(--sl-border)', textAlign: 'right', color: '#e8f442', fontFamily: FONT.heading, fontSize: 13 }}>{fmtEur(total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ─── RENDER NUEVO ──────────────────────────────────────────────────────────
  return (
    <div style={{ background: 'var(--sl-app)', minHeight: '100vh', padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setVista('lista')} style={{ padding: '8px 14px', borderRadius: 8, border: '0.5px solid var(--sl-border)', background: 'var(--sl-btn-cancel-bg)', color: 'var(--sl-btn-cancel-text)', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', minHeight: 36 }}>
          ← Volver
        </button>
        <h2 style={{ fontFamily: FONT.heading, fontSize: 18, letterSpacing: '2px', textTransform: 'uppercase', color: '#B01D23', margin: 0 }}>
          Nuevo inventario
        </h2>
      </div>

      {/* Filtro */}
      <div style={{ marginBottom: 14 }}>
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o IDING…"
          style={{ width: '100%', maxWidth: 400, padding: '10px 14px', borderRadius: 10, border: '0.5px solid var(--sl-border)', background: 'var(--sl-input-edit)', color: 'var(--sl-text-primary)', fontFamily: FONT.body, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {cargandoIng ? (
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: 'var(--sl-text-muted)', padding: '32px 0' }}>Cargando ingredientes…</div>
      ) : (
        <>
          <div style={{ background: 'var(--sl-card)', border: '0.5px solid var(--sl-border)', borderRadius: 14, overflowX: 'auto', marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontFamily: FONT.body, fontSize: 13, minWidth: 480 }}>
              <thead>
                <tr style={{ background: 'var(--sl-thead)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--sl-text-muted)', borderBottom: '0.5px solid var(--sl-border)' }}>IDING</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--sl-text-muted)', borderBottom: '0.5px solid var(--sl-border)' }}>Nombre</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--sl-text-muted)', borderBottom: '0.5px solid var(--sl-border)' }}>Unidad</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--sl-text-muted)', borderBottom: '0.5px solid var(--sl-border)', width: 130 }}>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {lineasFiltradas.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--sl-text-muted)' }}>Sin resultados</td></tr>
                ) : lineasFiltradas.map((l, i) => {
                  const isLast = i === lineasFiltradas.length - 1
                  return (
                    <tr key={l.iding}>
                      <td style={{ padding: '8px 16px', borderBottom: isLast ? 'none' : '0.5px solid var(--sl-border)', color: 'var(--sl-text-secondary)', fontFamily: FONT.heading, fontSize: 12 }}>{l.iding}</td>
                      <td style={{ padding: '8px 16px', borderBottom: isLast ? 'none' : '0.5px solid var(--sl-border)', color: 'var(--sl-text-primary)' }}>{l.nombre}</td>
                      <td style={{ padding: '8px 16px', borderBottom: isLast ? 'none' : '0.5px solid var(--sl-border)', color: 'var(--sl-text-secondary)' }}>{l.unidad}</td>
                      <td style={{ padding: '8px 16px', borderBottom: isLast ? 'none' : '0.5px solid var(--sl-border)', textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.cantidad === null ? '' : l.cantidad}
                          onChange={e => handleCantidadChange(l.iding, e.target.value)}
                          placeholder="—"
                          style={{ width: 90, padding: '6px 10px', borderRadius: 8, border: '0.5px solid var(--sl-border)', background: 'var(--sl-input-edit)', color: 'var(--sl-text-primary)', fontFamily: FONT.body, fontSize: 13, outline: 'none', textAlign: 'right' }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setVista('lista')}
              style={{ padding: '12px 24px', borderRadius: 8, border: '0.5px solid var(--sl-border)', background: 'var(--sl-btn-cancel-bg)', color: 'var(--sl-btn-cancel-text)', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', minHeight: 44 }}
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardarInventario}
              disabled={guardando}
              style={{ padding: '12px 24px', borderRadius: 8, border: 'none', background: '#B01D23', color: '#fff', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', cursor: guardando ? 'default' : 'pointer', opacity: guardando ? 0.6 : 1, minHeight: 44 }}
            >
              {guardando ? 'Guardando…' : 'Guardar inventario'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
