import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { fmtNum, fmtDate } from '@/utils/format'
import type { PeriodoInventario } from '@/pages/stock/Inventario'

interface Ingrediente {
  id: string
  nombre: string
  unidad: string
}

interface Conteo {
  id: string
  fecha: string
  ingrediente_id: string
  stock_inicial: number
  entradas: number
  stock_final: number
  consumo: number
  periodicidad: string
  nota: string | null
  ingrediente: { nombre: string; unidad: string } | null
}

interface Props {
  desde: string
  hasta: string
  periodo: PeriodoInventario
}

export default function TabConteos({ desde, hasta }: Props) {
  const { T, isDark } = useTheme()

  const [conteos, setConteos] = useState<Conteo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Modal state
  const [periodicidad, setPeriodicidad] = useState<'semanal' | 'mensual'>('mensual')
  const [fechaNuevo, setFechaNuevo] = useState(() => new Date().toISOString().split('T')[0])

  // Edit stock_final per conteo id
  const [editMap, setEditMap] = useState<Record<string, string>>({})

  const calcStyle: React.CSSProperties = {
    backgroundColor: '#2d1515',
    border: '1px solid #aa3030',
    color: '#ffaaaa',
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 13,
    fontFamily: FONT.body,
    minWidth: 80,
    display: 'inline-block',
    textAlign: 'right',
  }

  async function cargarConteos() {
    setLoading(true)
    const { data, error } = await supabase
      .from('conteos_inventario')
      .select('*, ingrediente:ingredientes(nombre,unidad)')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: false })

    if (!error && data) {
      setConteos(data as Conteo[])
      const map: Record<string, string> = {}
      for (const c of data as Conteo[]) {
        map[c.id] = String(c.stock_final ?? '')
      }
      setEditMap(map)
    }
    setLoading(false)
  }

  useEffect(() => { cargarConteos() }, [desde, hasta])

  async function crearConteo() {
    setSaving(true)
    // Cargar ingredientes activos
    const { data: ings } = await supabase
      .from('ingredientes')
      .select('id')
      .eq('activo', true)

    if (!ings || ings.length === 0) {
      setSaving(false)
      setModalOpen(false)
      return
    }

    // Para cada ingrediente, obtener último stock_final como stock_inicial
    const rows = await Promise.all(
      (ings as Ingrediente[]).map(async ing => {
        const { data: ultimo } = await supabase
          .from('conteos_inventario')
          .select('stock_final')
          .eq('ingrediente_id', ing.id)
          .order('fecha', { ascending: false })
          .limit(1)
          .maybeSingle()

        return {
          fecha: fechaNuevo,
          ingrediente_id: ing.id,
          stock_inicial: ultimo?.stock_final ?? 0,
          entradas: 0,
          stock_final: ultimo?.stock_final ?? 0,
          periodicidad,
        }
      })
    )

    await supabase.from('conteos_inventario').insert(rows)
    setSaving(false)
    setModalOpen(false)
    await cargarConteos()
  }

  async function guardarStockFinal(conteoId: string, valor: string) {
    const num = parseFloat(valor.replace(',', '.'))
    if (isNaN(num)) return
    await supabase
      .from('conteos_inventario')
      .update({ stock_final: num })
      .eq('id', conteoId)
    // Reload for consumo actualizado
    await cargarConteos()
  }

  async function confirmarConteo() {
    const sinCompletar = conteos.filter(c => c.stock_final === null || c.stock_final === undefined)
    if (sinCompletar.length > 0) {
      alert(`Hay ${sinCompletar.length} ingredientes sin stock final. Completa todos antes de confirmar.`)
      return
    }
    alert('Conteo confirmado correctamente.')
  }

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
      {/* Header acciones */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: T.mut, fontSize: 13, fontFamily: FONT.body }}>
          {conteos.length} registros en el periodo
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={confirmarConteo}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: `0.5px solid ${T.brd}`,
              background: 'transparent',
              color: T.sec,
              fontSize: 13,
              fontFamily: FONT.heading,
              fontWeight: 600,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Confirmar conteo
          </button>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: 'none',
              background: '#e8f442',
              color: '#111111',
              fontSize: 13,
              fontFamily: FONT.heading,
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            + Nuevo conteo
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div style={{ ...cardStyle(T), padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>
            Cargando...
          </div>
        ) : conteos.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>
            Sin conteos en este periodo. Crea uno con "+ Nuevo conteo".
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Fecha</th>
                <th style={thStyle}>Ingrediente</th>
                <th style={thStyle}>Periodicidad</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Stock anterior</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Entradas</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Conteo actual</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Consumo</th>
                <th style={thStyle}>Nota</th>
              </tr>
            </thead>
            <tbody>
              {conteos.map(c => (
                <tr key={c.id} style={{ transition: 'background 120ms' }}>
                  <td style={tdStyle}>{fmtDate(c.fecha)}</td>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600 }}>{c.ingrediente?.nombre ?? c.ingrediente_id}</span>
                    {c.ingrediente?.unidad && (
                      <span style={{ color: T.mut, fontSize: 11, marginLeft: 4 }}>
                        ({c.ingrediente.unidad})
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: 11,
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: c.periodicidad === 'mensual' ? '#1a2a1a' : '#1a1a2a',
                      color: c.periodicidad === 'mensual' ? '#4caf50' : '#66aaff',
                      fontFamily: FONT.heading,
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                    }}>
                      {c.periodicidad}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: T.sec }}>
                    {fmtNum(c.stock_inicial)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: T.sec }}>
                    {fmtNum(c.entradas)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <input
                      type="number"
                      step="0.001"
                      value={editMap[c.id] ?? ''}
                      onChange={e => setEditMap(prev => ({ ...prev, [c.id]: e.target.value }))}
                      onBlur={() => guardarStockFinal(c.id, editMap[c.id] ?? '')}
                      style={{
                        width: 90,
                        padding: '4px 8px',
                        borderRadius: 4,
                        border: `1px solid ${T.brd}`,
                        background: '#1e1e1e',
                        color: T.pri,
                        fontSize: 13,
                        fontFamily: FONT.body,
                        textAlign: 'right',
                      }}
                    />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={calcStyle}>{fmtNum(c.consumo)}</div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: T.mut, fontSize: 12 }}>{c.nota ?? ''}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nuevo conteo */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
            zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => !saving && setModalOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#1a1a1a',
              border: `1px solid ${T.brd}`,
              borderRadius: 12,
              padding: '28px 32px',
              width: 380,
              fontFamily: FONT.body,
            }}
          >
            <h2 style={{ fontFamily: FONT.heading, fontSize: 17, letterSpacing: '2px', textTransform: 'uppercase', color: '#B01D23', marginBottom: 20 }}>
              Nuevo conteo
            </h2>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={{ display: 'block', fontSize: 12, color: T.mut, fontFamily: FONT.heading, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>
                Periodicidad *
              </span>
              <select
                value={periodicidad}
                onChange={e => setPeriodicidad(e.target.value as 'semanal' | 'mensual')}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: `1px solid ${T.brd}`, background: '#1e1e1e',
                  color: T.pri, fontSize: 14, fontFamily: FONT.body,
                }}
              >
                <option value="mensual">Mensual</option>
                <option value="semanal">Semanal</option>
              </select>
            </label>

            <label style={{ display: 'block', marginBottom: 24 }}>
              <span style={{ display: 'block', fontSize: 12, color: T.mut, fontFamily: FONT.heading, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>
                Fecha
              </span>
              <input
                type="date"
                value={fechaNuevo}
                onChange={e => setFechaNuevo(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: `1px solid ${T.brd}`, background: '#1e1e1e',
                  color: T.pri, fontSize: 14, fontFamily: FONT.body,
                }}
              />
            </label>

            <p style={{ fontSize: 12, color: T.mut, marginBottom: 20, lineHeight: 1.5 }}>
              Se creará una fila por cada ingrediente activo. El stock inicial se tomará del último conteo de cada ingrediente.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setModalOpen(false)}
                disabled={saving}
                style={{
                  padding: '9px 18px', borderRadius: 8,
                  border: `1px solid ${T.brd}`, background: '#222222',
                  color: T.sec, fontSize: 13, fontFamily: FONT.heading,
                  fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={crearConteo}
                disabled={saving}
                style={{
                  padding: '9px 18px', borderRadius: 8,
                  border: 'none', background: '#B01D23',
                  color: '#ffffff', fontSize: 13, fontFamily: FONT.heading,
                  fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Creando...' : 'Crear conteo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDark && <></>}
    </div>
  )
}
