import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toastStore'

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

export default function BancosYCuentasPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const path = location.pathname
  const subTab = path.endsWith('cuentas') ? 'cuentas'
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
    <div style={{ background: '#f5f3ef', padding: '24px 28px' }}>

      {/* Breadcrumb */}
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase', marginBottom: 4 }}>
        Configuración
      </div>

      {/* Título */}
      <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 600, letterSpacing: '3px', color: '#B01D23', margin: '0 0 18px', textTransform: 'uppercase' }}>
        Bancos y Cuentas
      </h1>

      {/* Tabs principales Configuración */}
      <div style={{ display: 'inline-flex', gap: 6, marginBottom: 16 }}>
        {[
          { id: 'marcas', label: 'Marcas', path: '/configuracion/marcas' },
          { id: 'bancos', label: 'Bancos y Cuentas', path: '/configuracion/bancos-y-cuentas' },
          { id: 'plataformas', label: 'Plataformas', path: '/configuracion/plataformas' },
          { id: 'usuarios', label: 'Usuarios', path: '/configuracion/usuarios' },
          { id: 'calendario', label: 'Calendario operativo', path: '/configuracion/calendario' },
        ].map(tab => {
          const isActive = tab.id === 'bancos'
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: isActive ? 'none' : '0.5px solid #d0c8bc',
                background: isActive ? '#FF4757' : 'transparent',
                color: isActive ? '#fff' : '#3a4050',
                fontFamily: 'Lexend, sans-serif',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[
          { id: 'cuentas', label: 'Cuentas bancarias', path: '/configuracion/bancos-y-cuentas/cuentas' },
          { id: 'categorias', label: 'Categorías', path: '/configuracion/bancos-y-cuentas/categorias' },
          { id: 'reglas', label: 'Reglas', path: '/configuracion/bancos-y-cuentas/reglas' },
        ].map(st => {
          const isActive = st.id === subTab
          return (
            <button
              key={st.id}
              onClick={() => navigate(st.path)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: isActive ? 'none' : '0.5px solid #d0c8bc',
                background: isActive ? '#FF4757' : '#fff',
                color: isActive ? '#fff' : '#3a4050',
                fontFamily: 'Lexend, sans-serif',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {st.label}
            </button>
          )
        })}
      </div>

      {/* Contenido según sub-tab */}
      {subTab === 'categorias' && (
        <TabCategorias categorias={categorias} loading={loading} onRename={handleRename} onDelete={handleDelete} />
      )}
      {subTab === 'cuentas' && <PlaceholderSubtab label="Cuentas bancarias" />}
      {subTab === 'reglas' && <PlaceholderSubtab label="Reglas" />}
    </div>
  )
}

/* ─── TabCategorias ─── */

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
    <div style={{ padding: 40, textAlign: 'center', color: '#7a8090', fontFamily: 'Lexend, sans-serif' }}>
      Cargando categorías…
    </div>
  )

  return (
    <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, padding: '24px 28px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase', textAlign: 'left', padding: '12px 0', borderBottom: '0.5px solid #d0c8bc', width: 90 }}>ID</th>
            <th style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase', textAlign: 'left', padding: '12px 0', borderBottom: '0.5px solid #d0c8bc' }}>Nombre</th>
            <th style={{ width: 80, borderBottom: '0.5px solid #d0c8bc' }}></th>
          </tr>
        </thead>
        <tbody>
          {categorias.map(cat => {
            if (cat.nivel === 1) {
              return (
                <tr key={cat.id}>
                  <td style={{ padding: '18px 0 10px', borderBottom: '0.5px solid #ebe8e2', fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 600, color: '#B01D23', letterSpacing: '2px' }}>
                    {cat.id}
                  </td>
                  <td style={{ padding: '18px 0 10px', borderBottom: '0.5px solid #ebe8e2', fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 600, letterSpacing: '2.5px', color: '#111', textTransform: 'uppercase' }}>
                    {cat.nombre}
                  </td>
                  <td style={{ padding: '18px 0 10px', borderBottom: '0.5px solid #ebe8e2' }}></td>
                </tr>
              )
            }
            if (cat.nivel === 2) {
              return (
                <tr key={cat.id}>
                  <td style={{ padding: '14px 0 8px', borderBottom: '0.5px solid #ebe8e2', fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 600, color: '#3a4050', letterSpacing: '1.5px' }}>
                    {cat.id}
                  </td>
                  <td style={{ padding: '14px 0 8px', borderBottom: '0.5px solid #ebe8e2', fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#3a4050', textTransform: 'uppercase' }}>
                    {cat.nombre}
                  </td>
                  <td style={{ padding: '14px 0 8px', borderBottom: '0.5px solid #ebe8e2' }}></td>
                </tr>
              )
            }
            // nivel 3 - editable
            const valEdit = editValues[cat.id] ?? cat.nombre
            return (
              <tr key={cat.id}>
                <td style={{ padding: '12px 0', borderBottom: '0.5px solid #ebe8e2', fontFamily: 'Oswald, sans-serif', fontSize: 12, fontWeight: 500, color: '#7a8090', letterSpacing: '1px', whiteSpace: 'nowrap' }}>
                  {cat.id}
                </td>
                <td style={{ padding: '12px 0', borderBottom: '0.5px solid #ebe8e2' }}>
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
                      e.target.style.borderBottom = '1px dashed #FF4757'
                      e.target.style.background = '#FF475708'
                    }}
                    style={{
                      fontFamily: 'Lexend, sans-serif',
                      fontSize: 13,
                      color: '#111',
                      border: 'none',
                      background: 'transparent',
                      width: '100%',
                      padding: 0,
                      outline: 'none',
                    }}
                  />
                </td>
                <td style={{ padding: '12px 0', borderBottom: '0.5px solid #ebe8e2', textAlign: 'right', width: 80 }}>
                  <span
                    onClick={() => onDelete(cat)}
                    style={{ fontSize: 13, color: '#7a8090', cursor: 'pointer', padding: '4px 6px', borderRadius: 4, display: 'inline-block' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E24B4A'; (e.currentTarget as HTMLElement).style.background = '#E24B4A15' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#7a8090'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
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

function PlaceholderSubtab({ label }: { label: string }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, padding: '40px 28px', textAlign: 'center', color: '#7a8090', fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>
      Próximamente · módulo {label} aún no implementado
    </div>
  )
}
