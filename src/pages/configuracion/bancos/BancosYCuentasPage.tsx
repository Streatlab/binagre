import { BLANCO, BORDE_SUAVE, CLARO, CREMA, GRANATE, GRIS, INK, OSC, ROJO } from '@/styles/neobrutal'
import { CORREO_ALERTA_BORDE } from '@/styles/palettes'
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toastStore'
import ReglasPanel from './ReglasPanel'
import ReglasGlobalesPanel from './ReglasGlobalesPanel'
import CuentasPanel from './CuentasPanel'
import RutaPantalla from '@/components/ui/RutaPantalla'
import TabsPastilla from '@/components/ui/TabsPastilla'

interface CategoriaPyg {
  id: string
  nivel: number
  parent_id: string | null
  nombre: string
  bloque: string
  computa_pyg: boolean
  activa: boolean
  orden: number
}

function stripBanda(nombre: string): string {
  return nombre.replace(/\s*·?\s*banda\s+[\d.]+-[\d.]+\s*%/i, '').trim()
}

const SUBTAB_ITEMS: { id: string; label: string; path: string }[] = [
  { id: 'cuentas', label: 'Cuentas bancarias', path: '/configuracion/bancos-y-cuentas/cuentas' },
  { id: 'categorias', label: 'Categorías', path: '/configuracion/bancos-y-cuentas/categorias' },
  { id: 'reglas', label: 'Reglas de matching', path: '/configuracion/bancos-y-cuentas/reglas' },
  { id: 'reglas-globales', label: 'Reglas del sistema', path: '/configuracion/bancos-y-cuentas/reglas-globales' },
]

export default function BancosYCuentasPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const path = location.pathname
  const subTab = path.endsWith('cuentas') ? 'cuentas'
    : path.endsWith('reglas-globales') ? 'reglas-globales'
    : path.endsWith('reglas') ? 'reglas'
    : 'categorias'

  const [categorias, setCategorias] = useState<CategoriaPyg[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('categorias_pyg')
      .select('*')
      .eq('activa', true)
      .order('orden')
      .then(({ data, error }) => {
        if (!error && data) setCategorias(data as CategoriaPyg[])
        setLoading(false)
      })
  }, [])

  async function handleRename(id: string, nombre: string) {
    const { error } = await supabase.from('categorias_pyg').update({ nombre, updated_at: new Date().toISOString() }).eq('id', id)
    if (!error) {
      setCategorias(prev => prev.map(c => c.id === id ? { ...c, nombre } : c))
      toast.success('Detalle actualizado')
    }
  }

  async function handleDelete(cat: CategoriaPyg) {
    const { count } = await supabase.from('conciliacion').select('id', { count: 'exact', head: true }).eq('categoria', cat.id)
    if ((count ?? 0) > 0) {
      toast.error(`Tienes ${count} movimientos categorizados como "${cat.nombre}". Asígnalos a otro detalle antes de eliminar`)
      return
    }
    if (!window.confirm(`¿Eliminar "${cat.nombre}"?`)) return
    const { error } = await supabase.from('categorias_pyg').update({ activa: false }).eq('id', cat.id)
    if (!error) {
      setCategorias(prev => prev.filter(c => c.id !== cat.id))
      toast.success('Categoría eliminada')
    }
  }

  return (
    <div style={{ background: CREMA, padding: '24px 28px' }}>

      <div style={{ marginBottom: 16 }}>
        <RutaPantalla niveles={['Ajustes', 'Bancos y Cuentas']} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <TabsPastilla
          tabs={SUBTAB_ITEMS}
          activeId={subTab}
          onChange={id => navigate(SUBTAB_ITEMS.find(st => st.id === id)?.path ?? SUBTAB_ITEMS[0].path)}
        />
      </div>

      {subTab === 'categorias' && (
        <TabCategorias categorias={categorias} loading={loading} onRename={handleRename} onDelete={handleDelete} />
      )}
      {subTab === 'cuentas' && <CuentasPanel />}
      {subTab === 'reglas' && <ReglasPanel />}
      {subTab === 'reglas-globales' && <ReglasGlobalesPanel />}
    </div>
  )
}

function TabCategorias({
  categorias,
  loading,
  onRename,
  onDelete,
}: {
  categorias: CategoriaPyg[]
  loading: boolean
  onRename: (id: string, nombre: string) => void
  onDelete: (cat: CategoriaPyg) => void
}) {
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: GRIS, fontFamily: 'Lexend, sans-serif' }}>
      Cargando categorías…
    </div>
  )

  return (
    <div style={{ background: BLANCO, border: `0.5px solid ${BORDE_SUAVE}`, borderRadius: 14, padding: '24px 28px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '2px', color: GRIS, textTransform: 'uppercase', textAlign: 'left', padding: '12px 0', borderBottom: `0.5px solid ${BORDE_SUAVE}`, width: 90 }}>ID</th>
            <th style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '2px', color: GRIS, textTransform: 'uppercase', textAlign: 'left', padding: '12px 0', borderBottom: `0.5px solid ${BORDE_SUAVE}` }}>Nombre</th>
            <th style={{ width: 80, borderBottom: `0.5px solid ${BORDE_SUAVE}` }}></th>
          </tr>
        </thead>
        <tbody>
          {categorias.map(cat => {
            if (cat.nivel === 1) {
              return (
                <tr key={cat.id}>
                  <td style={{ padding: '18px 0 10px', borderBottom: `0.5px solid ${CLARO}`, fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 600, color: GRANATE, letterSpacing: '2px' }}>
                    {cat.id}
                  </td>
                  <td style={{ padding: '18px 0 10px', borderBottom: `0.5px solid ${CLARO}`, fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 600, letterSpacing: '2.5px', color: INK, textTransform: 'uppercase' }}>
                    {stripBanda(cat.nombre)}
                  </td>
                  <td style={{ padding: '18px 0 10px', borderBottom: `0.5px solid ${CLARO}` }}></td>
                </tr>
              )
            }
            if (cat.nivel === 2) {
              return (
                <tr key={cat.id}>
                  <td style={{ padding: '14px 0 8px', borderBottom: `0.5px solid ${CLARO}`, fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 600, color: OSC, letterSpacing: '1.5px' }}>
                    {cat.id}
                  </td>
                  <td style={{ padding: '14px 0 8px', borderBottom: `0.5px solid ${CLARO}`, fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: OSC, textTransform: 'uppercase' }}>
                    {stripBanda(cat.nombre)}
                  </td>
                  <td style={{ padding: '14px 0 8px', borderBottom: `0.5px solid ${CLARO}` }}></td>
                </tr>
              )
            }
            const valEdit = editValues[cat.id] ?? cat.nombre
            return (
              <tr key={cat.id}>
                <td style={{ padding: '12px 0', borderBottom: `0.5px solid ${CLARO}`, fontFamily: 'Oswald, sans-serif', fontSize: 12, fontWeight: 500, color: GRIS, letterSpacing: '1px', whiteSpace: 'nowrap' }}>
                  {cat.id}
                </td>
                <td style={{ padding: '12px 0', borderBottom: `0.5px solid ${CLARO}` }}>
                  <input
                    value={valEdit}
                    onChange={e => setEditValues(prev => ({ ...prev, [cat.id]: e.target.value }))}
                    onBlur={() => {
                      const v = (editValues[cat.id] ?? cat.nombre).trim()
                      if (!v) {
                        setEditValues(prev => ({ ...prev, [cat.id]: cat.nombre }))
                        toast.success('Restaurado')
                      } else if (v !== cat.nombre) {
                        onRename(cat.id, v)
                      }
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    onFocus={e => {
                      e.target.style.borderBottom = `1px dashed ${CORREO_ALERTA_BORDE}`
                      e.target.style.background = '#FF475708'
                    }}
                    style={{
                      fontFamily: 'Lexend, sans-serif',
                      fontSize: 13,
                      color: INK,
                      border: 'none',
                      background: 'transparent',
                      width: '100%',
                      padding: 0,
                      outline: 'none',
                    }}
                  />
                </td>
                <td style={{ padding: '12px 0', borderBottom: `0.5px solid ${CLARO}`, textAlign: 'right', width: 80 }}>
                  <span
                    onClick={() => onDelete(cat)}
                    style={{ fontSize: 13, color: GRIS, cursor: 'pointer', padding: '4px 6px', borderRadius: 4, display: 'inline-block' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = ROJO; (e.currentTarget as HTMLElement).style.background = '#E24B4A15' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = GRIS; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    🗑
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
