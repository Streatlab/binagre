import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toastStore'
import { fmtEur, fmtDate } from '@/lib/format'
import { OSW, LEX, INK, GRIS, SHADOW, BORDER_CARD, GRANATE, AMA, VERDE, ROJO, NAR, AZUL, d, eyebrow } from '@/styles/neobrutal'

// ── Avisos autoaprendibles de Papeleo ────────────────────────────────────────
// Lista las dudas abiertas (proveedor nuevo, sin categoría, titular, duplicado,
// IVA) y las facturas atascadas en lectura manual. Los 4 botones filtran la
// lista (un tipo activo a la vez). Cada fila muestra el detalle real (factura +
// movimiento candidato + enlace a Drive) y sus acciones a la derecha, sin
// necesidad de desplegar nada. Al resolver una, el sistema APRENDE (diccionario
// NIF) y propaga la solución a todo lo existente y futuro del mismo proveedor.

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
// Color solo con valor semántico (tokens de neobrutal.ts, sin hex sueltos): ámbar = duda,
// azul = informativo (proveedor nuevo por conocer), naranja = intermedio, rojo = alerta.
const TIPO_ESTILO: Record<string, { bg: string; fg: string }> = {
  sin_categoria: { bg: AMA, fg: INK },
  nif_nuevo: { bg: AZUL, fg: '#fff' },
  titular_desconocido: { bg: NAR, fg: '#fff' },
  posible_duplicado: { bg: ROJO, fg: '#fff' },
  aviso_iva: { bg: ROJO, fg: '#fff' },
  regla_desconocida: { bg: GRIS, fg: '#fff' },
}
const estiloTipo = (tipo: string) => TIPO_ESTILO[tipo] ?? { bg: GRIS, fg: '#fff' }

// Los 4 botones que filtran la bandeja (orden fijo, siempre visibles)
const TIPOS_FILTRO = ['sin_categoria', 'nif_nuevo', 'posible_duplicado', 'titular_desconocido']

export default function AvisosBandeja({ onResuelto }: { onResuelto?: () => void }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [facturas, setFacturas] = useState<Record<string, FacturaInfo>>({})
  const [movs, setMovs] = useState<Record<string, Movimiento>>({})
  const [dic, setDic] = useState<Record<string, string>>({})
  const [cats, setCats] = useState<Categoria[]>([])
  const [filtro, setFiltro] = useState<string | null>(null)
  const [catSel, setCatSel] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState<string | null>(null)
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
      for (const d2 of dicData ?? []) if (d2.categoria_codigo) mapaDic[d2.nif] = d2.categoria_codigo
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

  // Valor efectivo del desplegable: lo elegido por el usuario o, si no ha tocado nada,
  // la propuesta del diccionario de proveedores por NIF.
  const valorCategoria = (a: Aviso): string => {
    if (catSel[a.id] !== undefined) return catSel[a.id]
    const nif = a.factura_id ? facturas[a.factura_id]?.nif_emisor : undefined
    return (nif && dic[nif]) || ''
  }

  const resolver = async (aviso: Aviso, decision: Record<string, any>) => {
    setOcupado(aviso.id)

    // Factura en lectura manual sin aviso real: se guarda la categoría directa en la factura.
    if (aviso.synthetic) {
      const { error } = await supabase
        .from('facturas')
        .update({ categoria_factura: decision.categoria, categoria_factura_origen: 'bandeja_avisos' })
        .eq('id', aviso.factura_id)
      setOcupado(null)
      if (error) { toast.error(`No se pudo guardar la categoría: ${error.message}`); return }
      toast.success('Categoría guardada.')
      cargar(); onResuelto?.()
      return
    }

    const { data, error } = await supabase.rpc('fn_resolver_aviso', { p_aviso: aviso.id, p_decision: decision })
    setOcupado(null)
    if (error || !(data as any)?.ok) {
      toast.error(`No se pudo resolver el aviso: ${error?.message || (data as any)?.error || 'error'}`)
      return
    }
    const n = Number((data as any)?.facturas_actualizadas || 0)
    toast.success(n > 0 ? `Aprendido y aplicado a ${n} factura${n !== 1 ? 's' : ''} más del mismo proveedor.` : 'Aprendido. No vuelvo a preguntar por esto.')
    cargar(); onResuelto?.()
  }

  if (avisos.length === 0) return null

  const base = filtro ? avisos.filter(a => a.tipo === filtro) : avisos
  const visibles = verTodos ? base : base.slice(0, 8)
  const resumen: Record<string, number> = {}
  for (const a of avisos) resumen[a.tipo] = (resumen[a.tipo] ?? 0) + 1

  const btnMini: CSSProperties = {
    fontFamily: OSW, fontWeight: 600, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase',
    border: `2px solid ${INK}`, boxShadow: SHADOW, padding: '7px 12px', cursor: 'pointer', color: '#fff', whiteSpace: 'nowrap',
  }

  return (
    <div style={{ background: '#fff', border: BORDER_CARD, boxShadow: SHADOW, padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={d('20px', GRANATE)}>Avisos</span>
          <span style={eyebrow(ROJO, '#fff')}>{avisos.length} dudas por resolver</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TIPOS_FILTRO.map(tipo => {
            const activo = filtro === tipo
            const est = estiloTipo(tipo)
            return (
              <button
                key={tipo}
                onClick={() => setFiltro(activo ? null : tipo)}
                style={{
                  padding: '7px 14px', border: `3px solid ${INK}`,
                  background: activo ? est.bg : '#fff', color: activo ? est.fg : INK,
                  boxShadow: activo ? SHADOW : 'none',
                  fontFamily: OSW, fontSize: 12, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
                }}
              >
                {ETIQUETA[tipo]} <span style={{ opacity: 0.75, marginLeft: 3 }}>{resumen[tipo] ?? 0}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS, marginBottom: 12 }}>
        Resuelve una vez y el sistema lo aprende: se aplica solo a todo lo pasado y futuro de ese proveedor.
      </div>

      {visibles.map(a => {
        const factura = a.factura_id ? facturas[a.factura_id] : undefined
        const mov = a.factura_id ? movs[a.factura_id] : undefined
        const muestraCategoria = a.tipo === 'sin_categoria' || a.tipo === 'nif_nuevo'
        const est = estiloTipo(a.tipo)
        const cat = valorCategoria(a)
        const bloqueado = ocupado === a.id

        return (
          <div key={a.id} style={{ display: 'flex', alignItems: 'stretch', border: BORDER_CARD, marginBottom: 8, background: '#fff' }}>
            <div style={{ width: 6, background: est.bg, flexShrink: 0 }} />

            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '10px 14px', minWidth: 0 }}>
              <span style={eyebrow(est.bg, est.fg)}>{ETIQUETA[a.tipo] ?? a.tipo}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 200 }}>
                <span style={{ fontFamily: LEX, fontSize: 13, color: INK, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>{a.titulo}</span>
                {factura && (
                  <span style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS }}>
                    {factura.fecha_factura ? fmtDate(factura.fecha_factura) : '—'}
                    {' · '}<strong style={{ color: INK }}>{fmtEur(factura.total, { decimals: 2 })}</strong>
                    {' · '}{factura.proveedor_nombre || '—'}
                    {factura.nif_emisor ? ` · NIF ${factura.nif_emisor}` : ''}
                  </span>
                )}
                {mov && (
                  <span style={{ fontFamily: LEX, fontSize: 11.5, color: VERDE }}>
                    Banco: {fmtDate(mov.fecha)} · {mov.concepto} · {fmtEur(mov.importe, { decimals: 2 })}
                  </span>
                )}
                {a.detalle && !factura && <span style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS }}>{a.detalle}</span>}
              </div>
              {factura?.pdf_drive_url && (
                <a href={factura.pdf_drive_url} target="_blank" rel="noopener noreferrer" title="Ver PDF en Drive" style={{ textDecoration: 'none', fontSize: 16 }}>📎</a>
              )}
            </div>

            {/* ── Acciones a la derecha ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderLeft: `2px solid ${INK}`, flexShrink: 0, flexWrap: 'wrap', maxWidth: 360 }}>
              {muestraCategoria && (
                <>
                  <select value={cat} onChange={e => setCatSel(m => ({ ...m, [a.id]: e.target.value }))}
                    style={{ fontFamily: LEX, fontSize: 12, padding: '7px 9px', border: `2px solid ${INK}`, background: '#fff', color: INK, minWidth: 210 }}>
                    <option value="">Elige categoría…</option>
                    {cats.map(c => <option key={c.id} value={c.id}>{c.id} · {c.nombre}</option>)}
                  </select>
                  <button disabled={!cat || bloqueado} onClick={() => resolver(a, { categoria: cat })}
                    style={{ ...btnMini, background: cat ? VERDE : GRIS, cursor: cat ? 'pointer' : 'not-allowed' }}>
                    Aprender
                  </button>
                </>
              )}

              {a.tipo === 'titular_desconocido' && (
                <>
                  <button disabled={bloqueado} onClick={() => resolver(a, { titular_id: RUBEN_ID })} style={{ ...btnMini, background: NAR }}>Rubén, siempre</button>
                  <button disabled={bloqueado} onClick={() => resolver(a, { titular_id: EMILIO_ID })} style={{ ...btnMini, background: AZUL }}>Emilio, siempre</button>
                </>
              )}

              {a.tipo === 'posible_duplicado' && (
                <>
                  <button disabled={bloqueado} onClick={() => resolver(a, { es_duplicado: true })} style={{ ...btnMini, background: ROJO }}>Es duplicado</button>
                  <button disabled={bloqueado} onClick={() => resolver(a, { es_duplicado: false })} style={{ ...btnMini, background: VERDE }}>Son dos reales</button>
                </>
              )}

              {a.tipo === 'aviso_iva' && (
                <button disabled={bloqueado} onClick={() => resolver(a, { nota: 'revisado por Rubén, total correcto' })} style={{ ...btnMini, background: VERDE }}>Revisado, está bien</button>
              )}
            </div>
          </div>
        )
      })}

      {base.length > 8 && (
        <button onClick={() => setVerTodos(v => !v)}
          style={{ marginTop: 4, background: 'none', border: 'none', color: GRANATE, fontFamily: LEX, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
          {verTodos ? 'Ver menos' : `Ver los ${base.length}`}
        </button>
      )}
    </div>
  )
}
