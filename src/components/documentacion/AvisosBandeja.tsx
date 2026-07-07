import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toastStore'
import { fmtEur, fmtDate } from '@/lib/format'

// ── Avisos autoaprendibles de Papeleo ────────────────────────────────────────
// Lista las dudas abiertas (proveedor nuevo, sin categoría, titular, duplicado,
// IVA) y las facturas atascadas en lectura manual. Los 4 botones filtran la
// lista. Cada fila muestra el detalle real (factura + movimiento candidato +
// enlace a Drive) para poder decidir sin salir del panel. Al resolver una,
// el sistema APRENDE (diccionario NIF) y propaga la solución a todo lo
// existente y futuro del mismo proveedor.

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
  /** true = no es un aviso real en BD, sino una factura pendiente de lectura manual sin aviso abierto */
  synthetic?: boolean
}

interface FacturaInfo {
  id: string
  fecha_factura: string | null
  total: number | null
  proveedor_nombre: string | null
  nif_emisor: string | null
  pdf_drive_url: string | null
  estado: string | null
}

interface Movimiento { fecha: string; concepto: string; importe: number }
interface Categoria { id: string; nombre: string }

const ETIQUETA: Record<string, string> = {
  nif_nuevo: 'Proveedor nuevo',
  titular_desconocido: 'Titular',
  sin_categoria: 'Sin categoría',
  posible_duplicado: 'Duplicados',
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

// Los 4 botones que filtran la bandeja (orden fijo, siempre visibles)
const TIPOS_FILTRO = ['sin_categoria', 'nif_nuevo', 'posible_duplicado', 'titular_desconocido']

export default function AvisosBandeja({ onResuelto }: { onResuelto?: () => void }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [facturas, setFacturas] = useState<Record<string, FacturaInfo>>({})
  const [movs, setMovs] = useState<Record<string, Movimiento>>({})
  const [dic, setDic] = useState<Record<string, string>>({})
  const [cats, setCats] = useState<Categoria[]>([])
  const [filtro, setFiltro] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [catSel, setCatSel] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [verTodos, setVerTodos] = useState(false)

  const cargar = async () => {
    const { data: avisosData } = await supabase
      .from('avisos_papeleo')
      .select('id, tipo, titulo, detalle, solucion_sugerida, payload, factura_id, created_at')
      .eq('estado', 'abierto')
      .order('created_at', { ascending: false })
      .limit(300)

    const idsConAviso = new Set((avisosData ?? []).map(a => a.factura_id).filter(Boolean) as string[])

    // Facturas atascadas en lectura manual que aún no generaron un aviso propio
    let queryPendientes = supabase
      .from('facturas')
      .select('id, fecha_factura, total, proveedor_nombre, nif_emisor, pdf_drive_url, estado')
      .eq('estado', 'pendiente_lectura_manual')
    if (idsConAviso.size > 0) queryPendientes = queryPendientes.not('id', 'in', `(${[...idsConAviso].join(',')})`)
    const { data: pendientes } = await queryPendientes.order('fecha_factura', { ascending: false }).limit(100)

    const sinteticos: Aviso[] = (pendientes ?? []).map(f => ({
      id: `f-${f.id}`,
      tipo: 'sin_categoria',
      titulo: `Pendiente lectura manual — ${f.proveedor_nombre || f.nif_emisor || 'sin proveedor'}`,
      detalle: 'Factura sin OCR automático: revisa el PDF y asigna categoría.',
      solucion_sugerida: null,
      payload: { nif: f.nif_emisor },
      factura_id: f.id,
      created_at: f.fecha_factura || '',
      synthetic: true,
    }))

    const todos = [...(avisosData as Aviso[] ?? []), ...sinteticos]
    setAvisos(todos)

    // Detalle real de cada factura implicada (fecha, importe, proveedor, NIF, Drive)
    const mapaFacturas: Record<string, FacturaInfo> = {}
    for (const f of pendientes ?? []) mapaFacturas[f.id] = f as FacturaInfo
    const idsFaltantes = (avisosData ?? [])
      .map(a => a.factura_id)
      .filter((id): id is string => !!id && !mapaFacturas[id])
    if (idsFaltantes.length > 0) {
      const { data: fds } = await supabase
        .from('facturas')
        .select('id, fecha_factura, total, proveedor_nombre, nif_emisor, pdf_drive_url, estado')
        .in('id', idsFaltantes)
      for (const f of fds ?? []) mapaFacturas[f.id] = f as FacturaInfo
    }
    setFacturas(mapaFacturas)

    // Movimiento de banco candidato ya vinculado a cada factura
    const idsFactura = Object.keys(mapaFacturas)
    if (idsFactura.length > 0) {
      const { data: movsData } = await supabase
        .from('conciliacion')
        .select('factura_id, fecha, concepto, importe')
        .in('factura_id', idsFactura)
      const mapaMovs: Record<string, Movimiento> = {}
      for (const m of movsData ?? []) {
        if (m.factura_id) mapaMovs[m.factura_id] = { fecha: m.fecha, concepto: m.concepto, importe: Number(m.importe) }
      }
      setMovs(mapaMovs)
    } else {
      setMovs({})
    }

    // Categoría propuesta por NIF (diccionario de proveedores)
    const nifs = Array.from(new Set(Object.values(mapaFacturas).map(f => f.nif_emisor).filter(Boolean))) as string[]
    if (nifs.length > 0) {
      const { data: dicData } = await supabase
        .from('diccionario_nif_proveedor')
        .select('nif, categoria_codigo')
        .in('nif', nifs)
      const mapaDic: Record<string, string> = {}
      for (const d of dicData ?? []) if (d.categoria_codigo) mapaDic[d.nif] = d.categoria_codigo
      setDic(mapaDic)
    } else {
      setDic({})
    }
  }

  useEffect(() => {
    cargar()
    supabase.from('categorias_pyg').select('id, nombre').eq('activa', true).order('orden')
      .then(({ data }) => setCats((data as Categoria[]) ?? []))
    const t = setInterval(cargar, 30_000)
    return () => clearInterval(t)
  }, [])

  const abrirFila = (a: Aviso) => {
    if (abierto === a.id) { setAbierto(null); return }
    setAbierto(a.id)
    const nif = facturas[a.factura_id ?? '']?.nif_emisor
    setCatSel((nif && dic[nif]) || '')
  }

  const resolver = async (aviso: Aviso, decision: Record<string, any>) => {
    setOcupado(true)

    // Factura en lectura manual sin aviso real: se guarda la categoría directa en la factura.
    if (aviso.synthetic) {
      const { error } = await supabase
        .from('facturas')
        .update({ categoria_factura: decision.categoria, categoria_factura_origen: 'bandeja_avisos' })
        .eq('id', aviso.factura_id)
      setOcupado(false)
      if (error) { toast.error(`No se pudo guardar la categoría: ${error.message}`); return }
      toast.success('Categoría guardada.')
      setAbierto(null); setCatSel('')
      cargar(); onResuelto?.()
      return
    }

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

  const base = filtro ? avisos.filter(a => a.tipo === filtro) : avisos
  const visibles = verTodos ? base : base.slice(0, 8)
  const resumen: Record<string, number> = {}
  for (const a of avisos) resumen[a.tipo] = (resumen[a.tipo] ?? 0) + 1

  return (
    <div style={{ background: '#fff', border: '3px solid #140f08', boxShadow: '4px 4px 0 #140f08', padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#140f08' }}>
          Avisos · <span style={{ color: '#B01D23' }}>{avisos.length}</span> dudas por resolver
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TIPOS_FILTRO.map(tipo => {
            const activo = filtro === tipo
            const color = COLOR[tipo] ?? '#484f66'
            return (
              <button
                key={tipo}
                onClick={() => setFiltro(activo ? null : tipo)}
                style={{
                  fontFamily: 'Lexend, sans-serif', fontSize: 11, fontWeight: activo ? 700 : 400,
                  color: activo ? '#fff' : color, background: activo ? color : '#fff',
                  padding: '3px 8px', border: `2px solid ${color}`, cursor: 'pointer',
                }}
              >
                {ETIQUETA[tipo]}: {resumen[tipo] ?? 0}
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11.5, color: '#7a8090', marginTop: 6, marginBottom: 10 }}>
        Resuelve una vez y el sistema lo aprende: se aplica solo a todo lo pasado y futuro de ese proveedor.
      </div>

      {visibles.map(a => {
        const activo = abierto === a.id
        const factura = a.factura_id ? facturas[a.factura_id] : undefined
        const mov = a.factura_id ? movs[a.factura_id] : undefined
        const muestraCategoria = a.tipo === 'sin_categoria' || a.tipo === 'nif_nuevo'
        return (
          <div key={a.id} style={{ border: '2px solid #140f08', marginBottom: 8, background: activo ? '#FCEFD6' : '#fff' }}>
            <div onClick={() => abrirFila(a)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer' }}>
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: '#fff', background: COLOR[a.tipo] ?? '#484f66', padding: '2px 7px', whiteSpace: 'nowrap' }}>
                {ETIQUETA[a.tipo] ?? a.tipo}
              </span>
              <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#140f08', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</span>
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, color: '#7a8090' }}>{activo ? '▲' : '▼'}</span>
            </div>

            {factura && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '0 12px 8px 12px', fontFamily: 'Lexend, sans-serif', fontSize: 11.5, color: '#484f66' }}>
                <span>{factura.fecha_factura ? fmtDate(factura.fecha_factura) : '—'}</span>
                <span style={{ fontWeight: 600, color: '#140f08' }}>{fmtEur(factura.total, { decimals: 2 })}</span>
                <span>{factura.proveedor_nombre || '—'}</span>
                {factura.nif_emisor && <span style={{ color: '#7a8090' }}>NIF {factura.nif_emisor}</span>}
                {mov && (
                  <span style={{ color: '#1D9E75' }}>
                    Banco: {fmtDate(mov.fecha)} · {mov.concepto} · {fmtEur(mov.importe, { decimals: 2 })}
                  </span>
                )}
                {factura.pdf_drive_url && (
                  <a href={factura.pdf_drive_url} target="_blank" rel="noopener noreferrer" title="Ver PDF en Drive" style={{ textDecoration: 'none', fontSize: 14 }}>📎</a>
                )}
              </div>
            )}

            {activo && (
              <div style={{ padding: '4px 12px 12px 12px' }}>
                {a.detalle && <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#484f66', marginBottom: 4 }}>{a.detalle}</div>}
                {a.solucion_sugerida && <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#1D9E75', marginBottom: 10 }}>💡 {a.solucion_sugerida}</div>}

                {muestraCategoria && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select value={catSel} onChange={e => setCatSel(e.target.value)}
                      style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, padding: '8px 10px', border: '2px solid #140f08', background: '#fff', minWidth: 260 }}>
                      <option value="">Elige categoría…</option>
                      {cats.map(c => <option key={c.id} value={c.id}>{c.id} · {c.nombre}</option>)}
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

      {base.length > 8 && (
        <button onClick={() => setVerTodos(v => !v)}
          style={{ marginTop: 4, background: 'none', border: 'none', color: '#B01D23', fontFamily: 'Lexend, sans-serif', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
          {verTodos ? 'Ver menos' : `Ver los ${base.length}`}
        </button>
      )}
    </div>
  )
}
