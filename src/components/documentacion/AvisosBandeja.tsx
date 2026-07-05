import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toastStore'

// ── Avisos autoaprendibles de Papeleo ────────────────────────────────────────
// Lista las dudas abiertas (proveedor nuevo, sin categoría, titular, duplicado,
// IVA). Al resolver una, el sistema APRENDE (diccionario NIF) y propaga la
// solución a todo lo existente y futuro del mismo proveedor.

const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'

interface Aviso {
  id: string
  tipo: string
  titulo: string
  detalle: string | null
  solucion_sugerida: string | null
  payload: Record<string, any>
  factura_id: string | null
  created_at: string
}

interface Categoria { codigo: string; nombre: string }

const ETIQUETA: Record<string, string> = {
  nif_nuevo: 'Proveedor nuevo',
  titular_desconocido: 'Titular',
  sin_categoria: 'Sin categoría',
  posible_duplicado: 'Duplicado',
  aviso_iva: 'IVA no cuadra',
  regla_desconocida: 'Regla',
}
const COLOR: Record<string, string> = {
  nif_nuevo: '#1E5BCC',
  titular_desconocido: '#FF6A1A',
  sin_categoria: '#c47f00',
  posible_duplicado: '#B01D23',
  aviso_iva: '#E24B4A',
  regla_desconocida: '#484f66',
}

export default function AvisosBandeja({ onResuelto }: { onResuelto?: () => void }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [cats, setCats] = useState<Categoria[]>([])
  const [abierto, setAbierto] = useState<string | null>(null)
  const [catSel, setCatSel] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [verTodos, setVerTodos] = useState(false)

  const cargar = async () => {
    const { data } = await supabase
      .from('avisos_papeleo')
      .select('id, tipo, titulo, detalle, solucion_sugerida, payload, factura_id, created_at')
      .eq('estado', 'abierto')
      .order('created_at', { ascending: false })
      .limit(300)
    setAvisos((data as Aviso[]) ?? [])
  }

  useEffect(() => {
    cargar()
    supabase.from('categorias_gastos').select('codigo, nombre').order('codigo')
      .then(({ data }) => setCats((data as Categoria[]) ?? []))
    const t = setInterval(cargar, 30_000)
    return () => clearInterval(t)
  }, [])

  const resolver = async (aviso: Aviso, decision: Record<string, any>) => {
    setOcupado(true)
    const { data, error } = await supabase.rpc('fn_resolver_aviso', { p_aviso: aviso.id, p_decision: decision })
    setOcupado(false)
    if (error || !(data as any)?.ok) {
      toast.error(`No se pudo resolver el aviso: ${error?.message || (data as any)?.error || 'error'}`)
      return
    }
    const n = Number((data as any)?.facturas_actualizadas || 0)
    toast.success(n > 0 ? `Aprendido y aplicado a ${n} factura${n !== 1 ? 's' : ''} más del mismo proveedor.` : 'Aprendido. No vuelvo a preguntar por esto.')
    setAbierto(null); setCatSel('')
    cargar(); onResuelto?.()
  }

  if (avisos.length === 0) return null

  const visibles = verTodos ? avisos : avisos.slice(0, 8)
  const resumen: Record<string, number> = {}
  for (const a of avisos) resumen[a.tipo] = (resumen[a.tipo] ?? 0) + 1

  return (
    <div style={{ background: '#fff', border: '3px solid #140f08', boxShadow: '4px 4px 0 #140f08', padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#140f08' }}>
          Avisos · <span style={{ color: '#B01D23' }}>{avisos.length}</span> dudas por resolver
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(resumen).map(([tipo, n]) => (
            <span key={tipo} style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#fff', background: COLOR[tipo] ?? '#484f66', padding: '3px 8px', border: '2px solid #140f08' }}>
              {ETIQUETA[tipo] ?? tipo}: {n}
            </span>
          ))}
        </div>
      </div>
      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11.5, color: '#7a8090', marginTop: 6, marginBottom: 10 }}>
        Resuelve una vez y el sistema lo aprende: se aplica solo a todo lo pasado y futuro de ese proveedor.
      </div>

      {visibles.map(a => {
        const activo = abierto === a.id
        return (
          <div key={a.id} style={{ border: '2px solid #140f08', marginBottom: 8, background: activo ? '#FCEFD6' : '#fff' }}>
            <div onClick={() => { setAbierto(activo ? null : a.id); setCatSel('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer' }}>
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: '#fff', background: COLOR[a.tipo] ?? '#484f66', padding: '2px 7px', whiteSpace: 'nowrap' }}>
                {ETIQUETA[a.tipo] ?? a.tipo}
              </span>
              <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#140f08', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</span>
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, color: '#7a8090' }}>{activo ? '▲' : '▼'}</span>
            </div>
            {activo && (
              <div style={{ padding: '4px 12px 12px 12px' }}>
                {a.detalle && <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#484f66', marginBottom: 4 }}>{a.detalle}</div>}
                {a.solucion_sugerida && <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#1D9E75', marginBottom: 10 }}>💡 {a.solucion_sugerida}</div>}

                {(a.tipo === 'sin_categoria' || a.tipo === 'nif_nuevo') && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select value={catSel} onChange={e => setCatSel(e.target.value)}
                      style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, padding: '8px 10px', border: '2px solid #140f08', background: '#fff', minWidth: 260 }}>
                      <option value="">Elige categoría…</option>
                      {cats.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)}
                    </select>
                    <button disabled={!catSel || ocupado} onClick={() => resolver(a, { categoria: catSel })}
                      style={{ padding: '8px 16px', border: '2px solid #140f08', boxShadow: '2px 2px 0 #140f08', background: catSel ? '#1D9E75' : '#d0c8bc', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: catSel ? 'pointer' : 'not-allowed' }}>
                      Aprender
                    </button>
                  </div>
                )}

                {a.tipo === 'titular_desconocido' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button disabled={ocupado} onClick={() => resolver(a, { titular_id: RUBEN_ID })}
                      style={{ padding: '8px 16px', border: '2px solid #140f08', boxShadow: '2px 2px 0 #140f08', background: '#FF6A1A', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer' }}>Rubén, siempre</button>
                    <button disabled={ocupado} onClick={() => resolver(a, { titular_id: EMILIO_ID })}
                      style={{ padding: '8px 16px', border: '2px solid #140f08', boxShadow: '2px 2px 0 #140f08', background: '#2D5BFF', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer' }}>Emilio, siempre</button>
                  </div>
                )}

                {a.tipo === 'posible_duplicado' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button disabled={ocupado} onClick={() => resolver(a, { es_duplicado: true })}
                      style={{ padding: '8px 16px', border: '2px solid #140f08', boxShadow: '2px 2px 0 #140f08', background: '#B01D23', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer' }}>Es duplicado, aparcar</button>
                    <button disabled={ocupado} onClick={() => resolver(a, { es_duplicado: false })}
                      style={{ padding: '8px 16px', border: '2px solid #140f08', boxShadow: '2px 2px 0 #140f08', background: '#1D9E75', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer' }}>Son dos reales</button>
                  </div>
                )}

                {a.tipo === 'aviso_iva' && (
                  <button disabled={ocupado} onClick={() => resolver(a, { nota: 'revisado por Rubén, total correcto' })}
                    style={{ padding: '8px 16px', border: '2px solid #140f08', boxShadow: '2px 2px 0 #140f08', background: '#1D9E75', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer' }}>Revisado, está bien</button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {avisos.length > 8 && (
        <button onClick={() => setVerTodos(v => !v)}
          style={{ marginTop: 4, background: 'none', border: 'none', color: '#B01D23', fontFamily: 'Lexend, sans-serif', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
          {verTodos ? 'Ver menos' : `Ver los ${avisos.length}`}
        </button>
      )}
    </div>
  )
}
