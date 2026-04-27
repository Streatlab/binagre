import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ConfigShell } from '@/components/configuracion/ConfigShell'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { useTheme, FONT } from '@/styles/tokens'

interface CategoriaMaestra {
  codigo: string
  nombre: string
  grupo: string
  orden_grupo: number
  orden_sub: number
  signo: string
  banda_min_pct: number | null
  banda_max_pct: number | null
  activa: boolean
}

const GRUPO_LABEL: Record<string, string> = {
  INGRESOS:     'Ingresos',
  PRODUCTO:     'Producto (COGS)',
  EQUIPO:       'Equipo (Labor)',
  LOCAL:        'Local (Occupancy)',
  CONTROLABLES: 'Controlables (OPEX)',
  PLATAFORMAS:  'Plataformas',
  INTERNO:      'Interno (no computa PyG)',
}

export default function CategoriasPage() {
  const { T } = useTheme()
  const [cats, setCats] = useState<CategoriaMaestra[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('categorias_maestras')
      .select('*')
      .order('orden_grupo')
      .order('orden_sub')
    setCats(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const grupos = [...new Set(cats.map(c => c.grupo))]

  const saveNombre = async (codigo: string) => {
    await supabase.from('categorias_maestras').update({ nombre: editNombre, updated_at: new Date().toISOString() }).eq('codigo', codigo)
    setEditId(null)
    load()
  }

  return (
    <ConfigShell>
      <ModTitle>Categorías financieras</ModTitle>
      <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, marginBottom: 20 }}>
        Lista canónica de categorías del plan contable. Cambios se propagan a Conciliación, Running y Objetivos.
      </div>

      {loading ? (
        <div style={{ color: T.mut, fontFamily: FONT.body }}>Cargando...</div>
      ) : (
        grupos.map(grupo => (
          <div key={grupo} style={{ marginBottom: 24 }}>
            <div style={{
              fontFamily: FONT.heading,
              fontSize: 12,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              color: '#e8f442',
              marginBottom: 10,
            }}>
              {GRUPO_LABEL[grupo] ?? grupo}
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#0a0a0a' }}>
                    <th style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '8px 14px', textAlign: 'left' }}>Código</th>
                    <th style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '8px 14px', textAlign: 'left' }}>Nombre</th>
                    <th style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '8px 14px', textAlign: 'left' }}>Signo</th>
                    <th style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '8px 14px', textAlign: 'left' }}>Banda %</th>
                  </tr>
                </thead>
                <tbody>
                  {cats.filter(c => c.grupo === grupo).map(c => (
                    <tr key={c.codigo} style={{ borderTop: `1px solid ${T.brd}` }}>
                      <td style={{ fontFamily: FONT.heading, fontSize: 12, color: '#e8f442', padding: '10px 14px', letterSpacing: '0.5px' }}>{c.codigo}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {editId === c.codigo ? (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              value={editNombre}
                              onChange={e => setEditNombre(e.target.value)}
                              style={{ backgroundColor: '#1e1e1e', color: '#fff', border: `1px solid #383838`, borderRadius: 6, padding: '4px 8px', fontFamily: FONT.body, fontSize: 13 }}
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') saveNombre(c.codigo); if (e.key === 'Escape') setEditId(null) }}
                            />
                            <button onClick={() => saveNombre(c.codigo)} style={{ background: '#B01D23', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontFamily: FONT.heading, fontSize: 11, cursor: 'pointer' }}>OK</button>
                            <button onClick={() => setEditId(null)} style={{ background: '#222', color: T.sec, border: `1px solid #383838`, borderRadius: 6, padding: '4px 10px', fontFamily: FONT.heading, fontSize: 11, cursor: 'pointer' }}>×</button>
                          </div>
                        ) : (
                          <span
                            style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, cursor: 'pointer' }}
                            onClick={() => { setEditId(c.codigo); setEditNombre(c.nombre) }}
                            title="Clic para editar"
                          >
                            {c.nombre}
                          </span>
                        )}
                      </td>
                      <td style={{ fontFamily: FONT.body, fontSize: 12, color: c.signo === 'ingreso' ? '#06C167' : c.signo === 'descuento' ? '#f5a623' : '#B01D23', padding: '10px 14px' }}>{c.signo}</td>
                      <td style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec, padding: '10px 14px' }}>
                        {c.banda_min_pct != null ? `${c.banda_min_pct}% – ${c.banda_max_pct}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </ConfigShell>
  )
}
