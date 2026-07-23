import { CREMA, GRANATE, GRIS, INK, OSW, LEX, ROJO } from '@/styles/neobrutal'
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
import { PantallaCantera, HeroCantera, Papel } from '@/components/kit/cantera'

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

const th: React.CSSProperties = { fontFamily: OSW, fontSize: 10, fontWeight: 500, letterSpacing: '2px', color: GRIS, textTransform: 'uppercase', textAlign: 'left', padding: '12px 0', borderBottom: `2px solid ${INK}` }
const tdN1: React.CSSProperties = { padding: '18px 0 10px', borderBottom: `2px solid ${INK}` }
const tdN2: React.CSSProperties = { padding: '14px 0 8px', borderBottom: `1px solid ${INK}` }
const tdN3: React.CSSProperties = { padding: '12px 0', borderBottom: `1px solid ${INK}` }

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
    <PantallaCantera embedded>
      <Papel ceja={GRANATE}>
        <div style={{ padding: 20, textAlign: 'center', color: GRIS, fontFamily: LEX }}>Cargando categorías…</div>
      </Papel>
    </PantallaCantera>
  )

  const totalN3 = categorias.filter(c => c.nivel === 3).length
  const totalN1 = categorias.filter(c => c.nivel === 1).length

  return (
    <PantallaCantera embedded>
      <HeroCantera
        area="equipo"
        titular="Así están organizadas tus categorías de P&G"
        etiquetaDato="Detalles de categoría activos"
        cifra={totalN3}
        resumen={<>{totalN1} bloques principales · edita el nombre haciendo clic en el detalle</>}
      />

      <Papel ceja={GRANATE} pad="0" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 90, padding: '12px 16px' }}>ID</th>
                <th style={{ ...th, padding: '12px 16px' }}>Nombre</th>
                <th style={{ ...th, width: 80, padding: '12px 16px' }}></th>
              </tr>
            </thead>
            <tbody>
              {categorias.map(cat => {
                if (cat.nivel === 1) {
                  return (
                    <tr key={cat.id}>
                      <td style={{ ...tdN1, padding: '18px 16px 10px', fontFamily: OSW, fontSize: 14, fontWeight: 600, color: GRANATE, letterSpacing: '2px' }}>
                        {cat.id}
                      </td>
                      <td style={{ ...tdN1, padding: '18px 16px 10px', fontFamily: OSW, fontSize: 13, fontWeight: 600, letterSpacing: '2.5px', color: INK, textTransform: 'uppercase' }}>
                        {stripBanda(cat.nombre)}
                      </td>
                      <td style={{ ...tdN1, padding: '18px 16px 10px' }}></td>
                    </tr>
                  )
                }
                if (cat.nivel === 2) {
                  return (
                    <tr key={cat.id}>
                      <td style={{ ...tdN2, padding: '14px 16px 8px', fontFamily: OSW, fontSize: 11, fontWeight: 600, color: GRIS, letterSpacing: '1.5px' }}>
                        {cat.id}
                      </td>
                      <td style={{ ...tdN2, padding: '14px 16px 8px', fontFamily: OSW, fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: GRIS, textTransform: 'uppercase' }}>
                        {stripBanda(cat.nombre)}
                      </td>
                      <td style={{ ...tdN2, padding: '14px 16px 8px' }}></td>
                    </tr>
                  )
                }
                const valEdit = editValues[cat.id] ?? cat.nombre
                return (
                  <tr key={cat.id}>
                    <td style={{ ...tdN3, padding: '12px 16px', fontFamily: OSW, fontSize: 12, fontWeight: 500, color: GRIS, letterSpacing: '1px', whiteSpace: 'nowrap' }}>
                      {cat.id}
                    </td>
                    <td style={{ ...tdN3, padding: '12px 16px' }}>
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
                          e.target.style.background = `${ROJO}08`
                        }}
                        style={{
                          fontFamily: LEX,
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
                    <td style={{ ...tdN3, padding: '12px 16px', textAlign: 'right', width: 80 }}>
                      <span
                        onClick={() => onDelete(cat)}
                        style={{ fontSize: 13, color: GRIS, cursor: 'pointer', padding: '4px 6px', borderRadius: 0, display: 'inline-block' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = ROJO; (e.currentTarget as HTMLElement).style.background = `${ROJO}15` }}
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
      </Papel>
    </PantallaCantera>
  )
}
