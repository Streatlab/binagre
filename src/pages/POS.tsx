import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { OSW, LEX, INK, CLARO, TRACK, VERDE, ROJO, AMA, NAR, AZUL, GRANATE, GRIS, BORDER_CARD, SHADOW, eyebrow, d, EUR, E2 } from '@/styles/neobrutal'

/* ══════════════ Tipos ══════════════ */
type ItemPedido = { nombre: string; cantidad: number; precio: number; notas?: string }
type Pedido = {
  id: string
  origen: string
  pedido_ref: string | null
  marca: string | null
  canal: string | null
  cliente_nombre: string | null
  estado: string
  items: ItemPedido[]
  total: number
  metodo_pago: string | null
  notas: string | null
  cobrado: boolean
  created_at: string
}
type Receta = { id: string; nombre: string; categoria: string | null; pvp_directa: number | null; pvp_web: number | null }
type LineaCarrito = { receta_id: string; nombre: string; precio: number; cantidad: number }

const ESTADOS: { id: string; label: string; color: string }[] = [
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

/* ══════════════ Página ══════════════ */
export default function POS() {
  const [tab, setTab] = useState<'pedidos' | 'venta' | 'cierre' | 'informes'>('pedidos')
  return (
    <div style={{ fontFamily: LEX }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={eyebrow(GRANATE, '#fff')}>POS</span>
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
    const { data } = await supabase
      .from('pos_pedidos')
      .select('*')
      .gte('created_at', hoyISO())
      .order('created_at', { ascending: false })
    setPedidos((data as Pedido[]) || [])
    setCargando(false)
  }, [])

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 15000)
    return () => clearInterval(t)
  }, [cargar])

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
          Sin pedidos activos — en cuanto Rushour, Sinqro o la tienda online envíen un pedido, aparece aquí solo
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
          <span style={{ fontSize: 11, fontFamily: OSW, textTransform: 'uppercase', background: ORIGEN_COLOR[p.origen] ?? GRIS, color: '#fff', padding: '2px 8px', border: `2px solid ${INK}` }}>{p.origen}</span>
          {p.marca && <span style={{ fontSize: 12, color: GRIS }}>{p.marca}</span>}
          {p.cliente_nombre && <span style={{ fontSize: 12, color: INK }}>{p.cliente_nombre}</span>}
        </div>
        {(p.items || []).map((it, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '3px 0', color: INK }}>
            <span><b>{it.cantidad}×</b> {it.nombre}{it.notas ? <em style={{ color: NAR }}> — {it.notas}</em> : null}</span>
            <span>{E2(it.precio * it.cantidad)}</span>
          </div>
        ))}
        {p.notas && <div style={{ fontSize: 13, color: NAR, marginTop: 6 }}>⚠ {p.notas}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, alignItems: 'center' }}>
          <span style={d('22px')}>{EUR(p.total)}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {p.estado === 'nuevo' && (
              <button onClick={() => onEstado(p, 'cancelado')} style={btn(ROJO, '#fff')}>✕</button>
            )}
            {sig && (
              <button onClick={() => onEstado(p, sig)} style={btn(AMA, INK)}>→ {ESTADOS.find(e => e.id === sig)?.label}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const btn = (bg: string, color: string): CSSProperties => ({
  fontFamily: OSW, fontWeight: 700, textTransform: 'uppercase', fontSize: 12,
  padding: '6px 12px', border: `2px solid ${INK}`, background: bg, color, cursor: 'pointer', boxShadow: `2px 2px 0 ${INK}`,
})

/* ══════════════ VENTA DIRECTA ══════════════ */
function TabVenta() {
  const [recetas, setRecetas] = useState<Receta[]>([])
  const [cat, setCat] = useState<string>('TODAS')
  const [carrito, setCarrito] = useState<LineaCarrito[]>([])
  const [guardando, setGuardando] = useState(false)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('recetas')
      .select('id, nombre, categoria, pvp_directa, pvp_web')
      .order('nombre')
      .then(({ data }) => setRecetas(((data as Receta[]) || []).filter(r => (r.pvp_directa ?? r.pvp_web ?? 0) > 0)))
  }, [])

  const cats = useMemo(() => ['TODAS', ...Array.from(new Set(recetas.map(r => r.categoria || 'OTROS')))], [recetas])
  const visibles = cat === 'TODAS' ? recetas : recetas.filter(r => (r.categoria || 'OTROS') === cat)
  const total = carrito.reduce((s, l) => s + l.precio * l.cantidad, 0)

  const añadir = (r: Receta) => {
    const precio = r.pvp_directa ?? r.pvp_web ?? 0
    setOk(null)
    setCarrito(prev => {
      const ex = prev.find(l => l.receta_id === r.id)
      if (ex) return prev.map(l => (l.receta_id === r.id ? { ...l, cantidad: l.cantidad + 1 } : l))
      return [...prev, { receta_id: r.id, nombre: r.nombre, precio, cantidad: 1 }]
    })
  }
  const quitar = (id: string) =>
    setCarrito(prev => prev.map(l => (l.receta_id === id ? { ...l, cantidad: l.cantidad - 1 } : l)).filter(l => l.cantidad > 0))

  const cobrar = async (metodo: string) => {
    if (!carrito.length || guardando) return
    setGuardando(true)
    const { error } = await supabase.from('pos_pedidos').insert({
      origen: 'directo',
      canal: 'dir',
      pedido_ref: `POS-${Date.now()}`,
      estado: 'entregado',
      cobrado: true,
      metodo_pago: metodo,
      items: carrito.map(l => ({ nombre: l.nombre, cantidad: l.cantidad, precio: l.precio })),
      total,
    })
    setGuardando(false)
    if (!error) {
      setOk(`Cobrado ${EUR(total)} · ${metodo}`)
      setCarrito([])
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 20, alignItems: 'start' }}>
      <div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {cats.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{ ...btn(cat === c ? AMA : CLARO, INK), fontSize: 11 }}>{c}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {visibles.map(r => (
            <button key={r.id} onClick={() => añadir(r)}
              style={{ border: BORDER_CARD, boxShadow: SHADOW, background: CLARO, padding: 12, cursor: 'pointer', textAlign: 'left', minHeight: 84 }}>
              <div style={{ fontFamily: LEX, fontSize: 13, fontWeight: 600, color: INK, marginBottom: 6 }}>{r.nombre}</div>
              <div style={d('16px', GRANATE)}>{E2(r.pvp_directa ?? r.pvp_web ?? 0)}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ border: BORDER_CARD, boxShadow: SHADOW, background: CLARO, padding: 16, position: 'sticky', top: 16 }}>
        <div style={{ ...eyebrow(AMA), marginBottom: 12 }}>Ticket</div>
        {carrito.length === 0 && <div style={{ color: GRIS, fontSize: 13 }}>Toca platos para añadir</div>}
        {carrito.map(l => (
          <div key={l.receta_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 14, color: INK }}>
            <span style={{ flex: 1 }}>{l.nombre}</span>
            <button onClick={() => quitar(l.receta_id)} style={{ ...btn(CLARO, INK), padding: '2px 8px' }}>−</button>
            <span style={{ width: 26, textAlign: 'center', fontFamily: OSW, fontWeight: 700 }}>{l.cantidad}</span>
            <button onClick={() => añadir({ id: l.receta_id, nombre: l.nombre, categoria: null, pvp_directa: l.precio, pvp_web: null })} style={{ ...btn(CLARO, INK), padding: '2px 8px' }}>+</button>
            <span style={{ width: 70, textAlign: 'right' }}>{E2(l.precio * l.cantidad)}</span>
          </div>
        ))}
        <div style={{ borderTop: `3px solid ${INK}`, marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: OSW, fontWeight: 700, textTransform: 'uppercase', color: INK }}>Total</span>
          <span style={d('26px')}>{EUR(total)}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
          <button disabled={!carrito.length} onClick={() => cobrar('efectivo')} style={btn(VERDE, '#fff')}>Efectivo</button>
          <button disabled={!carrito.length} onClick={() => cobrar('tarjeta')} style={btn(AZUL, '#fff')}>Tarjeta</button>
          <button disabled={!carrito.length} onClick={() => cobrar('bizum')} style={btn(NAR, '#fff')}>Bizum</button>
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
    supabase.from('pos_pedidos').select('*').gte('created_at', hoyISO()).eq('cobrado', true)
      .then(({ data }) => setPedidos((data as Pedido[]) || []))
    supabase.from('pos_cierres').select('id').eq('fecha', hoyISO()).maybeSingle()
      .then(({ data }) => setCerrado(!!data))
  }, [])

  const suma = (m: string) => pedidos.filter(p => p.metodo_pago === m).reduce((s, p) => s + Number(p.total), 0)
  const efectivo = suma('efectivo'), tarjeta = suma('tarjeta'), bizum = suma('bizum')
  const otros = pedidos.reduce((s, p) => s + Number(p.total), 0) - efectivo - tarjeta - bizum
  const total = efectivo + tarjeta + bizum + otros

  const cerrar = async () => {
    const { error } = await supabase.from('pos_cierres').upsert(
      { fecha: hoyISO(), efectivo, tarjeta, bizum, otros, total, num_tickets: pedidos.length },
      { onConflict: 'fecha' }
    )
    if (!error) { setCerrado(true); setMsg(`Caja cerrada: ${EUR(total)} · ${pedidos.length} tickets`) }
  }

  const Card = ({ label, valor, color }: { label: string; valor: number; color: string }) => (
    <div style={{ border: BORDER_CARD, boxShadow: SHADOW, background: CLARO, padding: 18 }}>
      <div style={{ ...eyebrow(color, '#fff'), marginBottom: 10 }}>{label}</div>
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
        <button onClick={cerrar} style={{ ...btn(cerrado ? TRACK : GRANATE, cerrado ? INK : '#fff'), fontSize: 15, padding: '12px 22px' }}>
          {cerrado ? 'Actualizar cierre de hoy' : 'Cerrar caja de hoy'}
        </button>
        <span style={{ fontFamily: OSW, textTransform: 'uppercase', color: GRIS }}>{pedidos.length} tickets cobrados hoy</span>
      </div>
      {msg && <div style={{ marginTop: 12, fontFamily: OSW, textTransform: 'uppercase', color: VERDE }}>{msg}</div>}
    </div>
  )
}

/* ══════════════ INFORMES ══════════════ */
function TabInformes() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])

  useEffect(() => {
    const desde = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)
    supabase.from('pos_pedidos').select('*').gte('created_at', desde).neq('estado', 'cancelado')
      .then(({ data }) => setPedidos((data as Pedido[]) || []))
  }, [])

  const porDia = useMemo(() => {
    const m = new Map<string, number>()
    for (let i = 6; i >= 0; i--) m.set(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), 0)
    pedidos.forEach(p => {
      const k = p.created_at.slice(0, 10)
      if (m.has(k)) m.set(k, (m.get(k) || 0) + Number(p.total))
    })
    return Array.from(m.entries())
  }, [pedidos])

  const porOrigen = useMemo(() => {
    const m = new Map<string, { total: number; n: number }>()
    pedidos.forEach(p => {
      const e = m.get(p.origen) || { total: 0, n: 0 }
      e.total += Number(p.total); e.n += 1
      m.set(p.origen, e)
    })
    return Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total)
  }, [pedidos])

  const max = Math.max(1, ...porDia.map(([, v]) => v))
  const total7 = pedidos.reduce((s, p) => s + Number(p.total), 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
      <div style={{ border: BORDER_CARD, boxShadow: SHADOW, background: CLARO, padding: 18 }}>
        <div style={{ ...eyebrow(AMA), marginBottom: 14 }}>Ventas POS · últimos 7 días · {EUR(total7)}</div>
        {porDia.map(([dia, v]) => (
          <div key={dia} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontFamily: OSW, fontSize: 12, width: 46, color: INK }}>{dia.slice(8, 10)}/{dia.slice(5, 7)}</span>
            <div style={{ flex: 1, background: TRACK, border: `2px solid ${INK}`, height: 20 }}>
              <div style={{ width: `${(v / max) * 100}%`, height: '100%', background: GRANATE }} />
            </div>
            <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 13, width: 80, textAlign: 'right', color: INK }}>{EUR(v)}</span>
          </div>
        ))}
      </div>
      <div style={{ border: BORDER_CARD, boxShadow: SHADOW, background: CLARO, padding: 18 }}>
        <div style={{ ...eyebrow(NAR, '#fff'), marginBottom: 14 }}>Por origen · 7 días</div>
        {porOrigen.length === 0 && <div style={{ color: GRIS, fontSize: 13 }}>Sin datos todavía</div>}
        {porOrigen.map(([o, v]) => (
          <div key={o} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${TRACK}`, color: INK }}>
            <span style={{ fontFamily: OSW, textTransform: 'uppercase', fontSize: 13 }}>{o} · {v.n} pedidos</span>
            <span style={{ fontFamily: OSW, fontWeight: 700 }}>{EUR(v.total)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
