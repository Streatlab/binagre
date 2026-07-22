import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { OSW, LEX, INK, CLARO, TRACK, VERDE, ROJO, AMA, NAR, AZUL, GRANATE, GRIS, BORDER_CARD, SHADOW, eyebrow, d, EUR, E2, BLANCO } from '@/styles/neobrutal'

/* ══════════════ Tipos ══════════════ */
type ItemPedido = { nombre: string; cantidad: number; precio: number; notas?: string; modificadores?: string[]; categoria?: string }
type Pedido = {
  id: string; origen: string; pedido_ref: string | null; marca: string | null; canal: string | null
  cliente_nombre: string | null; estado: string; items: ItemPedido[]; total: number
  metodo_pago: string | null; notas: string | null; cobrado: boolean; created_at: string
}
type Linea = { id: string; producto: string; categoria: string | null; marca: string | null; cantidad: number; precio_unit: number; modificadores: string[]; created_at: string }
type CartaItem = { id: string; producto: string; categoria: string; marca: string | null; precio: number; activo: boolean }

const ESTADOS = [
  { id: 'nuevo', label: 'NUEVO', color: ROJO },
  { id: 'aceptado', label: 'ACEPTADO', color: NAR },
  { id: 'preparando', label: 'PREPARANDO', color: AMA },
  { id: 'listo', label: 'LISTO', color: AZUL },
  { id: 'entregado', label: 'ENTREGADO', color: VERDE },
]
const SIGUIENTE: Record<string, string> = { nuevo: 'aceptado', aceptado: 'preparando', preparando: 'listo', listo: 'entregado' }
const ORIGEN_COLOR: Record<string, string> = { rushour: NAR, sinqro: AZUL, tienda_online: GRANATE, directo: VERDE, web: GRANATE }
const CANAL_LABEL: Record<string, string> = { uber: 'UBER EATS', glovo: 'GLOVO', je: 'JUST EAT', web: 'WEB', dir: 'DIRECTO' }

const hoyISO = () => new Date().toISOString().slice(0, 10)
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

const btn = (bg: string, color: string): CSSProperties => ({
  fontFamily: OSW, fontWeight: 700, textTransform: 'uppercase', fontSize: 12,
  padding: '6px 12px', border: `2px solid ${INK}`, background: bg, color, cursor: 'pointer', boxShadow: `2px 2px 0 ${INK}`,
})
const input: CSSProperties = { fontFamily: LEX, fontSize: 14, padding: '8px 10px', border: `2px solid ${INK}`, background: BLANCO, color: INK }

/* ══════════════ Página ══════════════ */
export default function POS() {
  const [tab, setTab] = useState<'pedidos' | 'venta' | 'cierre' | 'informes'>('pedidos')
  return (
    <div style={{ fontFamily: LEX }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={eyebrow(GRANATE, BLANCO)}>POS</span>
        <span style={d('26px')}>Punto de venta</span>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {(['pedidos', 'venta', 'cierre', 'informes'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ fontFamily: OSW, fontWeight: 700, textTransform: 'uppercase', fontSize: 14, padding: '8px 16px',
                border: BORDER_CARD, boxShadow: tab === t ? 'none' : SHADOW, cursor: 'pointer',
                background: tab === t ? AMA : CLARO, color: INK }}>
              {t}
            </button>
          ))}
        </div>
      </div>
      {tab === 'pedidos' && <TabPedidos />}
      {tab === 'venta' && <TabVenta />}
      {tab === 'cierre' && <TabCierre />}
      {tab === 'informes' && <TabInformes />}
    </div>
  )
}

/* ══════════════ PEDIDOS (tablero en vivo) ══════════════ */
function TabPedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('pos_pedidos').select('*').gte('created_at', hoyISO()).order('created_at', { ascending: false })
    setPedidos((data as Pedido[]) || [])
    setCargando(false)
  }, [])

  useEffect(() => { cargar(); const t = setInterval(cargar, 15000); return () => clearInterval(t) }, [cargar])

  const cambiarEstado = async (p: Pedido, estado: string) => {
    setPedidos(prev => prev.map(x => (x.id === p.id ? { ...x, estado } : x)))
    await supabase.from('pos_pedidos').update({ estado }).eq('id', p.id)
  }

  const activos = pedidos.filter(p => !['entregado', 'cancelado'].includes(p.estado))
  const cerrados = pedidos.filter(p => ['entregado', 'cancelado'].includes(p.estado))

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {ESTADOS.map(e => {
          const n = pedidos.filter(p => p.estado === e.id).length
          return (
            <div key={e.id} style={{ border: BORDER_CARD, boxShadow: SHADOW, background: CLARO, padding: '8px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ width: 14, height: 14, background: e.color, border: `2px solid ${INK}`, display: 'inline-block' }} />
              <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 13, textTransform: 'uppercase', color: INK }}>{e.label}</span>
              <span style={d('18px')}>{n}</span>
            </div>
          )
        })}
      </div>
      {cargando && <div style={{ color: GRIS }}>Cargando pedidos…</div>}
      {!cargando && activos.length === 0 && (
        <div style={{ border: BORDER_CARD, boxShadow: SHADOW, background: CLARO, padding: 32, textAlign: 'center', fontFamily: OSW, textTransform: 'uppercase', color: GRIS }}>
          Sin pedidos activos — cuando Rushour, Sinqro o la tienda online envíen un pedido, aparece aquí solo
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {activos.map(p => <CardPedido key={p.id} p={p} onEstado={cambiarEstado} />)}
      </div>
      {cerrados.length > 0 && (
        <>
          <div style={{ ...eyebrow(TRACK), marginTop: 28, marginBottom: 12 }}>Cerrados hoy · {cerrados.length}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, opacity: 0.65 }}>
            {cerrados.map(p => <CardPedido key={p.id} p={p} onEstado={cambiarEstado} />)}
          </div>
        </>
      )}
    </div>
  )
}

function CardPedido({ p, onEstado }: { p: Pedido; onEstado: (p: Pedido, e: string) => void }) {
  const est = ESTADOS.find(e => e.id === p.estado)
  const sig = SIGUIENTE[p.estado]
  return (
    <div style={{ border: BORDER_CARD, boxShadow: SHADOW, background: CLARO }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: `3px solid ${INK}`, background: est?.color ?? TRACK }}>
        <span style={{ fontFamily: OSW, fontWeight: 700, textTransform: 'uppercase', fontSize: 14, color: INK }}>
          {p.canal ? CANAL_LABEL[p.canal] ?? p.canal : p.origen} {p.pedido_ref ? `· ${p.pedido_ref}` : ''}
        </span>
        <span style={{ fontFamily: OSW, fontSize: 13, color: INK }}>{hora(p.created_at)}</span>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontFamily: OSW, textTransform: 'uppercase', background: ORIGEN_COLOR[p.origen] ?? GRIS, color: BLANCO, padding: '2px 8px', border: `2px solid ${INK}` }}>{p.origen}</span>
          {p.marca && <span style={{ fontSize: 12, color: GRIS }}>{p.marca}</span>}
          {p.cliente_nombre && <span style={{ fontSize: 12, color: INK }}>{p.cliente_nombre}</span>}
        </div>
        {(p.items || []).map((it, i) => (
          <div key={i} style={{ fontSize: 14, padding: '3px 0', color: INK }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><b>{it.cantidad}×</b> {it.nombre}</span>
              <span>{E2(it.precio * it.cantidad)}</span>
            </div>
            {it.modificadores && it.modificadores.length > 0 && (
              <div style={{ fontSize: 12, color: NAR, paddingLeft: 16 }}>+ {it.modificadores.join(', ')}</div>
            )}
            {it.notas && <div style={{ fontSize: 12, color: NAR, paddingLeft: 16 }}>— {it.notas}</div>}
          </div>
        ))}
        {p.notas && <div style={{ fontSize: 13, color: NAR, marginTop: 6 }}>⚠ {p.notas}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, alignItems: 'center' }}>
          <span style={d('22px')}>{EUR(p.total)}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {p.estado === 'nuevo' && <button onClick={() => onEstado(p, 'cancelado')} style={btn(ROJO, BLANCO)}>✕</button>}
            {sig && <button onClick={() => onEstado(p, sig)} style={btn(AMA, INK)}>→ {ESTADOS.find(e => e.id === sig)?.label}</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════ VENTA MANUAL (carta propia por categoría) ══════════════ */
function TabVenta() {
  const [carta, setCarta] = useState<CartaItem[]>([])
  const [cat, setCat] = useState<string>('TODAS')
  const [carrito, setCarrito] = useState<{ id: string; nombre: string; precio: number; cantidad: number }[]>([])
  const [ok, setOk] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState({ producto: '', categoria: '', marca: '', precio: '' })
  const [showAlta, setShowAlta] = useState(false)

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('pos_carta').select('*').eq('activo', true).order('categoria').order('producto')
    setCarta((data as CartaItem[]) || [])
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const cats = useMemo(() => ['TODAS', ...Array.from(new Set(carta.map(c => c.categoria)))], [carta])
  const visibles = cat === 'TODAS' ? carta : carta.filter(c => c.categoria === cat)
  const total = carrito.reduce((s, l) => s + l.precio * l.cantidad, 0)

  const añadir = (c: { id: string; producto: string; precio: number }) => {
    setOk(null)
    setCarrito(prev => {
      const ex = prev.find(l => l.id === c.id)
      if (ex) return prev.map(l => (l.id === c.id ? { ...l, cantidad: l.cantidad + 1 } : l))
      return [...prev, { id: c.id, nombre: c.producto, precio: c.precio, cantidad: 1 }]
    })
  }
  const quitar = (id: string) => setCarrito(prev => prev.map(l => (l.id === id ? { ...l, cantidad: l.cantidad - 1 } : l)).filter(l => l.cantidad > 0))

  const altaProducto = async () => {
    if (!nuevo.producto || !nuevo.precio) return
    await supabase.from('pos_carta').insert({
      producto: nuevo.producto, categoria: nuevo.categoria || 'Sin categoría',
      marca: nuevo.marca || null, precio: Number(nuevo.precio), origen: 'manual',
    })
    setNuevo({ producto: '', categoria: '', marca: '', precio: '' })
    setShowAlta(false)
    cargar()
  }

  const cobrar = async (metodo: string) => {
    if (!carrito.length) return
    const { data } = await supabase.from('pos_pedidos').insert({
      origen: 'directo', canal: 'dir', pedido_ref: `POS-${Date.now()}`, estado: 'entregado', cobrado: true,
      metodo_pago: metodo, items: carrito.map(l => ({ nombre: l.nombre, cantidad: l.cantidad, precio: l.precio })), total,
    }).select()
    const pedido = data?.[0]
    if (pedido) {
      await supabase.from('pos_pedido_lineas').insert(carrito.map(l => ({
        pedido_id: pedido.id, producto: l.nombre, cantidad: l.cantidad, precio_unit: l.precio, modificadores: [],
      })))
      setOk(`Cobrado ${EUR(total)} · ${metodo}`); setCarrito([])
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 20, alignItems: 'start' }}>
      <div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          {cats.map(c => <button key={c} onClick={() => setCat(c)} style={{ ...btn(cat === c ? AMA : CLARO, INK), fontSize: 11 }}>{c}</button>)}
          <button onClick={() => setShowAlta(s => !s)} style={{ ...btn(VERDE, BLANCO), fontSize: 11, marginLeft: 'auto' }}>+ Producto</button>
        </div>

        {showAlta && (
          <div style={{ border: BORDER_CARD, boxShadow: SHADOW, background: CLARO, padding: 14, marginBottom: 14, display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr auto', gap: 8, alignItems: 'center' }}>
            <input style={input} placeholder="Producto" value={nuevo.producto} onChange={e => setNuevo({ ...nuevo, producto: e.target.value })} />
            <input style={input} placeholder="Categoría (Casera, Green…)" value={nuevo.categoria} onChange={e => setNuevo({ ...nuevo, categoria: e.target.value })} />
            <input style={input} placeholder="Marca" value={nuevo.marca} onChange={e => setNuevo({ ...nuevo, marca: e.target.value })} />
            <input style={input} placeholder="€" value={nuevo.precio} onChange={e => setNuevo({ ...nuevo, precio: e.target.value })} />
            <button onClick={altaProducto} style={btn(GRANATE, BLANCO)}>Guardar</button>
          </div>
        )}

        {carta.length === 0 && !showAlta && (
          <div style={{ border: BORDER_CARD, boxShadow: SHADOW, background: CLARO, padding: 24, textAlign: 'center', color: GRIS, fontFamily: OSW, textTransform: 'uppercase' }}>
            Carta vacía — pulsa "+ Producto" para dar de alta, o se llenará sola con los productos que lleguen de las plataformas
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {visibles.map(c => (
            <button key={c.id} onClick={() => añadir(c)} style={{ border: BORDER_CARD, boxShadow: SHADOW, background: CLARO, padding: 12, cursor: 'pointer', textAlign: 'left', minHeight: 84 }}>
              <div style={{ fontFamily: LEX, fontSize: 13, fontWeight: 600, color: INK, marginBottom: 4 }}>{c.producto}</div>
              {c.marca && <div style={{ fontSize: 11, color: GRIS, marginBottom: 4 }}>{c.marca}</div>}
              <div style={d('16px', GRANATE)}>{E2(c.precio)}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ border: BORDER_CARD, boxShadow: SHADOW, background: CLARO, padding: 16, position: 'sticky', top: 16 }}>
        <div style={{ ...eyebrow(AMA), marginBottom: 12 }}>Ticket</div>
        {carrito.length === 0 && <div style={{ color: GRIS, fontSize: 13 }}>Toca productos para añadir</div>}
        {carrito.map(l => (
          <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 14, color: INK }}>
            <span style={{ flex: 1 }}>{l.nombre}</span>
            <button onClick={() => quitar(l.id)} style={{ ...btn(CLARO, INK), padding: '2px 8px' }}>−</button>
            <span style={{ width: 26, textAlign: 'center', fontFamily: OSW, fontWeight: 700 }}>{l.cantidad}</span>
            <button onClick={() => añadir({ id: l.id, producto: l.nombre, precio: l.precio })} style={{ ...btn(CLARO, INK), padding: '2px 8px' }}>+</button>
            <span style={{ width: 70, textAlign: 'right' }}>{E2(l.precio * l.cantidad)}</span>
          </div>
        ))}
        <div style={{ borderTop: `3px solid ${INK}`, marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: OSW, fontWeight: 700, textTransform: 'uppercase', color: INK }}>Total</span>
          <span style={d('26px')}>{EUR(total)}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
          <button disabled={!carrito.length} onClick={() => cobrar('efectivo')} style={btn(VERDE, BLANCO)}>Efectivo</button>
          <button disabled={!carrito.length} onClick={() => cobrar('tarjeta')} style={btn(AZUL, BLANCO)}>Tarjeta</button>
          <button disabled={!carrito.length} onClick={() => cobrar('bizum')} style={btn(NAR, BLANCO)}>Bizum</button>
        </div>
        {ok && <div style={{ marginTop: 10, fontFamily: OSW, textTransform: 'uppercase', color: VERDE }}>{ok}</div>}
      </div>
    </div>
  )
}

/* ══════════════ CIERRE DE CAJA ══════════════ */
function TabCierre() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [cerrado, setCerrado] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('pos_pedidos').select('*').gte('created_at', hoyISO()).eq('cobrado', true).then(({ data }) => setPedidos((data as Pedido[]) || []))
    supabase.from('pos_cierres').select('id').eq('fecha', hoyISO()).maybeSingle().then(({ data }) => setCerrado(!!data))
  }, [])

  const suma = (m: string) => pedidos.filter(p => p.metodo_pago === m).reduce((s, p) => s + Number(p.total), 0)
  const efectivo = suma('efectivo'), tarjeta = suma('tarjeta'), bizum = suma('bizum')
  const otros = pedidos.reduce((s, p) => s + Number(p.total), 0) - efectivo - tarjeta - bizum
  const total = efectivo + tarjeta + bizum + otros

  const cerrar = async () => {
    const { error } = await supabase.from('pos_cierres').upsert({ fecha: hoyISO(), efectivo, tarjeta, bizum, otros, total, num_tickets: pedidos.length }, { onConflict: 'fecha' })
    if (!error) { setCerrado(true); setMsg(`Caja cerrada: ${EUR(total)} · ${pedidos.length} tickets`) }
  }

  const Card = ({ label, valor, color }: { label: string; valor: number; color: string }) => (
    <div style={{ border: BORDER_CARD, boxShadow: SHADOW, background: CLARO, padding: 18 }}>
      <div style={{ ...eyebrow(color, BLANCO), marginBottom: 10 }}>{label}</div>
      <div style={d('34px')}>{EUR(valor)}</div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <Card label="Efectivo" valor={efectivo} color={VERDE} />
        <Card label="Tarjeta" valor={tarjeta} color={AZUL} />
        <Card label="Bizum" valor={bizum} color={NAR} />
        <Card label="Otros / plataforma" valor={otros} color={GRIS} />
        <Card label="Total día" valor={total} color={GRANATE} />
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <button onClick={cerrar} style={{ ...btn(cerrado ? TRACK : GRANATE, cerrado ? INK : BLANCO), fontSize: 15, padding: '12px 22px' }}>
          {cerrado ? 'Actualizar cierre de hoy' : 'Cerrar caja de hoy'}
        </button>
        <span style={{ fontFamily: OSW, textTransform: 'uppercase', color: GRIS }}>{pedidos.length} tickets cobrados hoy</span>
      </div>
      {msg && <div style={{ marginTop: 12, fontFamily: OSW, textTransform: 'uppercase', color: VERDE }}>{msg}</div>}
    </div>
  )
}

/* ══════════════ INFORMES TIPO POS ══════════════ */
function TabInformes() {
  const [desde, setDesde] = useState(() => new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10))
  const [hasta, setHasta] = useState(hoyISO())
  const [horaIni, setHoraIni] = useState('')
  const [horaFin, setHoraFin] = useState('')
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [lineas, setLineas] = useState<Linea[]>([])
  const [cargando, setCargando] = useState(false)

  const consultar = useCallback(async () => {
    setCargando(true)
    const desdeTs = `${desde}T00:00:00`
    const hastaTs = `${hasta}T23:59:59`
    const [pd, ln] = await Promise.all([
      supabase.from('pos_pedidos').select('*').gte('created_at', desdeTs).lte('created_at', hastaTs).neq('estado', 'cancelado'),
      supabase.from('pos_pedido_lineas').select('*').gte('created_at', desdeTs).lte('created_at', hastaTs),
    ])
    setPedidos((pd.data as Pedido[]) || [])
    setLineas((ln.data as Linea[]) || [])
    setCargando(false)
  }, [desde, hasta])

  useEffect(() => { consultar() }, [consultar])

  // Filtro por franja horaria (si se rellena)
  const enFranja = (iso: string) => {
    if (!horaIni && !horaFin) return true
    const h = new Date(iso).getHours() + new Date(iso).getMinutes() / 60
    const a = horaIni ? parseInt(horaIni.slice(0, 2)) + parseInt(horaIni.slice(3, 5) || '0') / 60 : 0
    const b = horaFin ? parseInt(horaFin.slice(0, 2)) + parseInt(horaFin.slice(3, 5) || '0') / 60 : 24
    return h >= a && h <= b
  }
  const pedFilt = pedidos.filter(p => enFranja(p.created_at))
  const linFilt = lineas.filter(l => enFranja(l.created_at))

  const totalVentas = pedFilt.reduce((s, p) => s + Number(p.total), 0)
  const numPedidos = pedFilt.length
  const ticketMedio = numPedidos ? totalVentas / numPedidos : 0

  const agrupa = <T,>(arr: T[], key: (t: T) => string, val: (t: T) => number) => {
    const m = new Map<string, number>()
    arr.forEach(t => { const k = key(t) || '—'; m.set(k, (m.get(k) || 0) + val(t)) })
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }

  const porProducto = agrupa(linFilt, l => l.producto, l => Number(l.cantidad))
  const porMarca = agrupa(pedFilt, p => p.marca || '—', p => Number(p.total))
  const porCanal = agrupa(pedFilt, p => p.canal || p.origen, p => Number(p.total))
  const porMomento = useMemo(() => {
    const m = new Map<string, number>()
    for (let h = 0; h < 24; h++) m.set(String(h).padStart(2, '0'), 0)
    pedFilt.forEach(p => { const h = String(new Date(p.created_at).getHours()).padStart(2, '0'); m.set(h, (m.get(h) || 0) + Number(p.total)) })
    return Array.from(m.entries())
  }, [pedFilt])
  const porModificador = useMemo(() => {
    const m = new Map<string, number>()
    linFilt.forEach(l => (l.modificadores || []).forEach(mod => m.set(mod, (m.get(mod) || 0) + Number(l.cantidad))))
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15)
  }, [linFilt])

  const maxMomento = Math.max(1, ...porMomento.map(([, v]) => v))

  const rangoRapido = (dias: number) => {
    setDesde(new Date(Date.now() - (dias - 1) * 86400000).toISOString().slice(0, 10))
    setHasta(hoyISO())
  }
  const hoy = () => { setDesde(hoyISO()); setHasta(hoyISO()) }
  const esteMes = () => { const n = new Date(); setDesde(new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10)); setHasta(hoyISO()) }
  const esteAno = () => { const n = new Date(); setDesde(new Date(n.getFullYear(), 0, 1).toISOString().slice(0, 10)); setHasta(hoyISO()) }

  const KPI = ({ label, valor, color }: { label: string; valor: string; color: string }) => (
    <div style={{ border: BORDER_CARD, boxShadow: SHADOW, background: CLARO, padding: 18, flex: 1, minWidth: 160 }}>
      <div style={{ ...eyebrow(color, BLANCO), marginBottom: 10 }}>{label}</div>
      <div style={d('30px')}>{valor}</div>
    </div>
  )
  const Tabla = ({ titulo, filas, color, sufijo = '' }: { titulo: string; filas: [string, number][]; color: string; sufijo?: string }) => (
    <div style={{ border: BORDER_CARD, boxShadow: SHADOW, background: CLARO, padding: 18 }}>
      <div style={{ ...eyebrow(color, BLANCO), marginBottom: 12 }}>{titulo}</div>
      {filas.length === 0 && <div style={{ color: GRIS, fontSize: 13 }}>Sin datos en este rango</div>}
      {filas.slice(0, 12).map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${TRACK}`, color: INK }}>
          <span style={{ fontFamily: LEX, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{k}</span>
          <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 13 }}>{sufijo === '€' ? EUR(v) : `${v}${sufijo}`}</span>
        </div>
      ))}
    </div>
  )

  return (
    <div>
      {/* Barra de consulta */}
      <div style={{ border: BORDER_CARD, boxShadow: SHADOW, background: CLARO, padding: 16, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={hoy} style={{ ...btn(CLARO, INK), fontSize: 11 }}>Hoy</button>
          <button onClick={() => rangoRapido(7)} style={{ ...btn(CLARO, INK), fontSize: 11 }}>7 días</button>
          <button onClick={() => rangoRapido(30)} style={{ ...btn(CLARO, INK), fontSize: 11 }}>30 días</button>
          <button onClick={esteMes} style={{ ...btn(CLARO, INK), fontSize: 11 }}>Este mes</button>
          <button onClick={esteAno} style={{ ...btn(CLARO, INK), fontSize: 11 }}>Este año</button>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: OSW, fontSize: 12, textTransform: 'uppercase', color: GRIS }}>Desde</span>
          <input type="date" style={input} value={desde} onChange={e => setDesde(e.target.value)} />
          <span style={{ fontFamily: OSW, fontSize: 12, textTransform: 'uppercase', color: GRIS }}>Hasta</span>
          <input type="date" style={input} value={hasta} onChange={e => setHasta(e.target.value)} />
          <span style={{ fontFamily: OSW, fontSize: 12, textTransform: 'uppercase', color: GRIS }}>Hora</span>
          <input type="time" style={input} value={horaIni} onChange={e => setHoraIni(e.target.value)} />
          <span style={{ color: GRIS }}>–</span>
          <input type="time" style={input} value={horaFin} onChange={e => setHoraFin(e.target.value)} />
          <button onClick={consultar} style={{ ...btn(GRANATE, BLANCO), fontSize: 13, padding: '8px 18px' }}>Consultar</button>
        </div>
      </div>

      {cargando ? <div style={{ color: GRIS }}>Consultando…</div> : (
        <>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
            <KPI label="Ventas" valor={EUR(totalVentas)} color={GRANATE} />
            <KPI label="Pedidos" valor={String(numPedidos)} color={AZUL} />
            <KPI label="Ticket medio" valor={EUR(ticketMedio)} color={VERDE} />
            <KPI label="Productos vendidos" valor={String(linFilt.reduce((s, l) => s + Number(l.cantidad), 0))} color={NAR} />
          </div>

          {/* Ventas por hora del día */}
          <div style={{ border: BORDER_CARD, boxShadow: SHADOW, background: CLARO, padding: 18, marginBottom: 18 }}>
            <div style={{ ...eyebrow(AMA), marginBottom: 14 }}>Ventas por hora / momento de compra</div>
            {porMomento.map(([h, v]) => (
              <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontFamily: OSW, fontSize: 12, width: 40, color: INK }}>{h}h</span>
                <div style={{ flex: 1, background: TRACK, border: `2px solid ${INK}`, height: 16 }}>
                  <div style={{ width: `${(v / maxMomento) * 100}%`, height: '100%', background: GRANATE }} />
                </div>
                <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 12, width: 80, textAlign: 'right', color: INK }}>{EUR(v)}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
            <Tabla titulo="Productos más vendidos" filas={porProducto} color={GRANATE} sufijo=" ud" />
            <Tabla titulo="Modificadores vendidos" filas={porModificador} color={NAR} sufijo=" ud" />
            <Tabla titulo="Ventas por marca" filas={porMarca} color={AZUL} sufijo="€" />
            <Tabla titulo="Ventas por canal / plataforma" filas={porCanal} color={VERDE} sufijo="€" />
          </div>
        </>
      )}
    </div>
  )
}
