import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { fmtNum, fmtDate } from '@/utils/format'

interface ConteoRow {
  id: string
  fecha: string
  ingrediente_id: string
  entradas: number
  consumo: number
  ingrediente: { nombre: string; unidad: string } | null
}

interface MovimientoVirtual {
  id: string
  fecha: string
  ingrediente_id: string
  nombre: string
  unidad: string
  tipo: 'entrada' | 'salida'
  cantidad: number
}

type FiltroTipo = 'todos' | 'entrada' | 'salida'

interface Props {
  desde: string
  hasta: string
}

export default function TabMovimientos({ desde, hasta }: Props) {
  const { T } = useTheme()
  const [conteos, setConteos] = useState<ConteoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos')
  const [filtroIngrediente, setFiltroIngrediente] = useState<string>('')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    setLoading(true)
    supabase
      .from('conteos_inventario')
      .select('id, fecha, ingrediente_id, entradas, consumo, ingrediente:ingredientes(nombre,unidad)')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          // Supabase returns joined relation as array; normalise to single object
          const normalised = (data as unknown[]).map((row: unknown) => {
            const r = row as Record<string, unknown>
            const ing = Array.isArray(r.ingrediente) ? r.ingrediente[0] ?? null : r.ingrediente ?? null
            return { ...r, ingrediente: ing } as ConteoRow
          })
          setConteos(normalised)
        }
        setLoading(false)
      })
  }, [desde, hasta])

  const movimientos = useMemo<MovimientoVirtual[]>(() => {
    const list: MovimientoVirtual[] = []
    for (const c of conteos) {
      const nombre = c.ingrediente?.nombre ?? c.ingrediente_id
      const unidad = c.ingrediente?.unidad ?? ''
      if (c.entradas > 0) {
        list.push({ id: `${c.id}-e`, fecha: c.fecha, ingrediente_id: c.ingrediente_id, nombre, unidad, tipo: 'entrada', cantidad: c.entradas })
      }
      if (c.consumo > 0) {
        list.push({ id: `${c.id}-s`, fecha: c.fecha, ingrediente_id: c.ingrediente_id, nombre, unidad, tipo: 'salida', cantidad: c.consumo })
      }
    }
    return list
  }, [conteos])

  const ingredientesUnicos = useMemo(() => {
    const set = new Set<string>()
    const list: { id: string; nombre: string }[] = []
    for (const m of movimientos) {
      if (!set.has(m.ingrediente_id)) {
        set.add(m.ingrediente_id)
        list.push({ id: m.ingrediente_id, nombre: m.nombre })
      }
    }
    return list.sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [movimientos])

  const filtrados = useMemo(() => {
    return movimientos.filter(m => {
      if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false
      if (filtroIngrediente && m.ingrediente_id !== filtroIngrediente) return false
      if (busqueda && !m.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
      return true
    })
  }, [movimientos, filtroTipo, filtroIngrediente, busqueda])

  const thStyle: React.CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: T.mut,
    padding: '8px 12px',
    textAlign: 'left',
    background: '#0a0a0a',
    borderBottom: `1px solid ${T.brd}`,
    whiteSpace: 'nowrap',
  }

  const tdStyle: React.CSSProperties = {
    padding: '8px 12px',
    fontSize: 13,
    color: T.pri,
    borderBottom: `0.5px solid ${T.brd}`,
    fontFamily: FONT.body,
    verticalAlign: 'middle',
  }

  return (
    <div>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Buscar ingrediente..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{
            padding: '7px 12px', borderRadius: 8,
            border: `0.5px solid ${T.brd}`, background: '#1e1e1e',
            color: T.pri, fontSize: 13, fontFamily: FONT.body, minWidth: 200,
          }}
        />
        <select
          value={filtroIngrediente}
          onChange={e => setFiltroIngrediente(e.target.value)}
          style={{
            padding: '7px 12px', borderRadius: 8,
            border: `0.5px solid ${T.brd}`, background: '#1e1e1e',
            color: T.pri, fontSize: 13, fontFamily: FONT.body,
          }}
        >
          <option value="">Todos los ingredientes</option>
          {ingredientesUnicos.map(i => (
            <option key={i.id} value={i.id}>{i.nombre}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['todos', 'entrada', 'salida'] as FiltroTipo[]).map(t => (
            <button
              key={t}
              onClick={() => setFiltroTipo(t)}
              style={{
                padding: '6px 14px', borderRadius: 6,
                border: `0.5px solid ${T.brd}`,
                background: filtroTipo === t ? '#B01D23' : 'transparent',
                color: filtroTipo === t ? '#ffffff' : T.sec,
                fontSize: 12, fontFamily: FONT.heading, fontWeight: 600,
                letterSpacing: '0.5px', textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <span style={{ color: T.mut, fontSize: 12, fontFamily: FONT.body, marginLeft: 'auto' }}>
          {filtrados.length} movimientos
        </span>
      </div>

      {/* Tabla */}
      <div style={{ ...cardStyle(T), padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>
            Sin movimientos en este periodo o con los filtros actuales.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Fecha</th>
                <th style={thStyle}>Ingrediente</th>
                <th style={thStyle}>Tipo</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Cantidad</th>
                <th style={thStyle}>Unidad</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(m => (
                <tr key={m.id}>
                  <td style={tdStyle}>{fmtDate(m.fecha)}</td>
                  <td style={tdStyle}>{m.nombre}</td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 4,
                      background: m.tipo === 'entrada' ? '#1a2a1a' : '#2a1a1a',
                      color: m.tipo === 'entrada' ? '#4caf50' : '#e24b4a',
                      fontFamily: FONT.heading, letterSpacing: '0.5px', textTransform: 'uppercase',
                    }}>
                      {m.tipo}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtNum(m.cantidad)}</td>
                  <td style={{ ...tdStyle, color: T.mut }}>{m.unidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
