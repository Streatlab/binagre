import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT, useTheme, tituloPaginaStyle, cardStyle, groupStyle, kpiLabelStyle, kpiValueStyle, tabActiveStyle, tabInactiveStyle, tabsContainerStyle, CANALES, fmtFechaCorta, semaforoColor } from '@/styles/tokens'

/* ═════════════ CRM STREAT LAB ═════════════
   Clientes propios · Públicos por marca · Campañas medibles · Embudo por canal
   Tablas: crm_clientes, crm_publicos_marca, crm_campanas, crm_campanas_metricas, crm_embudo_eventos
*/

type Cliente = { id: string; nombre: string | null; email: string | null; telefono: string | null; marca_preferida: string | null; canal_captacion: string; consentimiento_rgpd: boolean; fecha_alta: string; ultima_compra: string | null; num_pedidos: number; gasto_total: number; baja: boolean }
type Publico = { id: number; marca: string; publico_objetivo: string; propuesta_valor: string; momentos_consumo: string | null; mensajes_clave: string | null; ticket_medio_objetivo: number | null; plataforma_principal: string | null }
type Campana = { id: number; nombre: string; marca: string | null; canal: string; tipo: string; objetivo_smart: string; kpi_principal: string; kpi_meta: number | null; codigo_promo: string | null; mecanica: string | null; fecha_inicio: string; fecha_fin: string | null; presupuesto: number; coste_real: number; estado: string }
type Metrica = { id: number; campana_id: number; fecha: string; pedidos: number; ventas: number; nuevos_clientes: number; canjes_codigo: number; coste: number }
type EmbudoEvento = { id: number; fecha: string; canal: string; marca: string | null; etapa: string; valor: number }

const CANAL_LABEL: Record<string, string> = { uber_eats: 'Uber Eats', glovo: 'Glovo', just_eat: 'Just Eat', web: 'Web', qr_bolsa: 'QR Bolsa', email: 'Email', rrss: 'RRSS', directo: 'Directa', encuesta: 'Encuesta' }
const CANAL_COLOR: Record<string, string> = { uber_eats: '#06C167', glovo: '#e8f442', just_eat: '#f5a623', web: '#B01D23', qr_bolsa: '#66aaff', email: '#9b59b6', rrss: '#1E5BCC' }
const ETAPAS = ['visitas_menu', 'pedidos', 'clientes_nuevos', 'clientes_recurrentes'] as const
const ETAPA_LABEL: Record<string, string> = { visitas_menu: 'Visitas menú', pedidos: 'Pedidos', clientes_nuevos: 'Clientes nuevos', clientes_recurrentes: 'Recurrentes' }
const ESTADOS = ['borrador', 'activa', 'pausada', 'cerrada']
const ESTADO_COLOR: Record<string, string> = { borrador: '#5a6880', activa: '#1D9E75', pausada: '#f5a623', cerrada: '#B01D23' }
const fmtEur = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0)

export default function CrmTiendaPropia() {
  const { T, isDark } = useTheme()
  const [tab, setTab] = useState<'clientes' | 'publicos' | 'campanas' | 'embudo'>('clientes')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [publicos, setPublicos] = useState<Publico[]>([])
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [metricas, setMetricas] = useState<Metrica[]>([])
  const [embudo, setEmbudo] = useState<EmbudoEvento[]>([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState('')

  async function cargar() {
    setCargando(true)
    const [c, p, ca, m, e] = await Promise.all([
      supabase.from('crm_clientes').select('*').eq('baja', false).order('fecha_alta', { ascending: false }),
      supabase.from('crm_publicos_marca').select('*').order('marca'),
      supabase.from('crm_campanas').select('*').order('fecha_inicio', { ascending: false }),
      supabase.from('crm_campanas_metricas').select('*'),
      supabase.from('crm_embudo_eventos').select('*').order('fecha', { ascending: false }).limit(2000),
    ])
    setClientes((c.data as Cliente[]) || [])
    setPublicos((p.data as Publico[]) || [])
    setCampanas((ca.data as Campana[]) || [])
    setMetricas((m.data as Metrica[]) || [])
    setEmbudo((e.data as EmbudoEvento[]) || [])
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  const tabs = [
    { id: 'clientes', label: 'Clientes' },
    { id: 'publicos', label: 'Públicos por marca' },
    { id: 'campanas', label: 'Campañas' },
    { id: 'embudo', label: 'Embudo por canal' },
  ] as const

  return (
    <div style={{ padding: 4 }}>
      <h1 style={tituloPaginaStyle(T)}>CRM STREAT LAB</h1>
      <div style={tabsContainerStyle()}>
        {tabs.map(t2 => (
          <button key={t2.id} onClick={() => setTab(t2.id)} style={tab === t2.id ? tabActiveStyle(isDark) : tabInactiveStyle(T)}>{t2.label}</button>
        ))}
      </div>
      {msg && <div style={{ ...cardStyle(T), borderLeft: '3px solid #1D9E75', marginBottom: 12, fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{msg}</div>}
      {cargando ? (
        <div style={{ color: T.mut, fontFamily: FONT.body, fontSize: 14, padding: 24 }}>Cargando CRM...</div>
      ) : (
        <>
          {tab === 'clientes' && <TabClientes T={T} clientes={clientes} onSaved={() => { cargar(); flash('Cliente guardado') }} />}
          {tab === 'publicos' && <TabPublicos T={T} publicos={publicos} onSaved={() => { cargar(); flash('Público actualizado') }} />}
          {tab === 'campanas' && <TabCampanas T={T} isDark={isDark} campanas={campanas} metricas={metricas} onSaved={(t3: string) => { cargar(); flash(t3) }} />}
          {tab === 'embudo' && <TabEmbudo T={T} embudo={embudo} onSaved={() => { cargar(); flash('Embudo actualizado') }} />}
        </>
      )}
    </div>
  )
}

/* ─────────── helpers UI ─────────── */
function inputStyle(T: any) {
  return { padding: '7px 10px', borderRadius: 8, border: `0.5px solid ${T.brd}`, background: T.inp, color: T.pri, fontSize: 13, fontFamily: FONT.body, outline: 'none', width: '100%' } as const
}
function btnPrimario() {
  return { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#B01D23', color: '#fff', fontFamily: FONT.body, fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const
}
function thStyle(T: any) {
  return { fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase' as const, color: T.mut, padding: '8px 10px', textAlign: 'left' as const, borderBottom: `0.5px solid ${T.brd}` }
}
function tdStyle(T: any) {
  return { fontFamily: FONT.body, fontSize: 13, color: T.pri, padding: '8px 10px', borderBottom: `0.5px solid ${T.brd}` }
}
function Kpi({ T, label, value, sub }: any) {
  return (
    <div style={cardStyle(T)}>
      <div style={kpiLabelStyle(T)}>{label}</div>
      <div style={{ ...kpiValueStyle(T), fontSize: '2rem', marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

/* ─────────── TAB CLIENTES ─────────── */
function TabClientes({ T, clientes, onSaved }: any) {
  const [f, setF] = useState({ nombre: '', email: '', telefono: '', marca_preferida: '', canal_captacion: 'qr_bolsa', consentimiento_rgpd: false })
  const [filtro, setFiltro] = useState('')

  const conRgpd = clientes.filter((c: Cliente) => c.consentimiento_rgpd).length
  const gastoTotal = clientes.reduce((s: number, c: Cliente) => s + (Number(c.gasto_total) || 0), 0)
  const pedidosTotal = clientes.reduce((s: number, c: Cliente) => s + (c.num_pedidos || 0), 0)
  const ticketMedio = pedidosTotal > 0 ? gastoTotal / pedidosTotal : 0
  const repetidores = clientes.filter((c: Cliente) => c.num_pedidos >= 2).length

  const lista = clientes.filter((c: Cliente) => !filtro || (c.nombre || '').toLowerCase().includes(filtro.toLowerCase()) || (c.email || '').toLowerCase().includes(filtro.toLowerCase()))

  async function guardar() {
    if (!f.email && !f.telefono) return
    await supabase.from('crm_clientes').insert({ ...f, marca_preferida: f.marca_preferida || null, fecha_consentimiento: f.consentimiento_rgpd ? new Date().toISOString() : null })
    setF({ nombre: '', email: '', telefono: '', marca_preferida: '', canal_captacion: 'qr_bolsa', consentimiento_rgpd: false })
    onSaved()
  }
  async function borrar(id: string) {
    await supabase.from('crm_clientes').update({ baja: true }).eq('id', id)
    onSaved()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        <Kpi T={T} label="Clientes propios" value={clientes.length} sub={`${conRgpd} con RGPD`} />
        <Kpi T={T} label="Repetidores" value={repetidores} sub={clientes.length ? `${Math.round(repetidores / clientes.length * 100)}% de la base` : '—'} />
        <Kpi T={T} label="Gasto acumulado" value={fmtEur(gastoTotal)} sub={`${pedidosTotal} pedidos`} />
        <Kpi T={T} label="Ticket medio" value={fmtEur(ticketMedio)} sub="canal propio" />
      </div>

      <div style={groupStyle(T)}>
        <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>Alta de cliente</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, alignItems: 'center' }}>
          <input placeholder="Nombre" value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} style={inputStyle(T)} />
          <input placeholder="Email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} style={inputStyle(T)} />
          <input placeholder="Teléfono" value={f.telefono} onChange={e => setF({ ...f, telefono: e.target.value })} style={inputStyle(T)} />
          <input placeholder="Marca preferida" value={f.marca_preferida} onChange={e => setF({ ...f, marca_preferida: e.target.value })} style={inputStyle(T)} />
          <select value={f.canal_captacion} onChange={e => setF({ ...f, canal_captacion: e.target.value })} style={inputStyle(T)}>
            {['qr_bolsa', 'web', 'directo', 'encuesta', 'rrss'].map(c => <option key={c} value={c}>{CANAL_LABEL[c] || c}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT.body, fontSize: 13, color: T.sec, cursor: 'pointer' }}>
            <input type="checkbox" checked={f.consentimiento_rgpd} onChange={e => setF({ ...f, consentimiento_rgpd: e.target.checked })} /> RGPD
          </label>
          <button onClick={guardar} style={btnPrimario()}>Guardar</button>
        </div>
      </div>

      <div style={groupStyle(T)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut }}>Base de clientes</div>
          <input placeholder="Buscar..." value={filtro} onChange={e => setFiltro(e.target.value)} style={{ ...inputStyle(T), width: 220 }} />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={thStyle(T)}>Cliente</th><th style={thStyle(T)}>Contacto</th><th style={thStyle(T)}>Marca</th><th style={thStyle(T)}>Captación</th><th style={thStyle(T)}>RGPD</th><th style={thStyle(T)}>Pedidos</th><th style={thStyle(T)}>Gasto</th><th style={thStyle(T)}>Última compra</th><th style={thStyle(T)}></th>
            </tr></thead>
            <tbody>
              {lista.length === 0 && <tr><td colSpan={9} style={{ ...tdStyle(T), color: T.mut }}>Sin clientes todavía. Primera fuente: QR en bolsa → registro web.</td></tr>}
              {lista.map((c: Cliente) => (
                <tr key={c.id}>
                  <td style={tdStyle(T)}>{c.nombre || '—'}</td>
                  <td style={tdStyle(T)}>{c.email || c.telefono || '—'}</td>
                  <td style={tdStyle(T)}>{c.marca_preferida || '—'}</td>
                  <td style={tdStyle(T)}>{CANAL_LABEL[c.canal_captacion] || c.canal_captacion}</td>
                  <td style={tdStyle(T)}>{c.consentimiento_rgpd ? '✅' : '—'}</td>
                  <td style={tdStyle(T)}>{c.num_pedidos}</td>
                  <td style={tdStyle(T)}>{fmtEur(Number(c.gasto_total))}</td>
                  <td style={tdStyle(T)}>{c.ultima_compra ? fmtFechaCorta(c.ultima_compra) : '—'}</td>
                  <td style={tdStyle(T)}><button onClick={() => borrar(c.id)} style={{ background: 'none', border: 'none', color: T.mut, cursor: 'pointer', fontSize: 12 }}>Baja</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ─────────── TAB PÚBLICOS ─────────── */
function TabPublicos({ T, publicos, onSaved }: any) {
  const [editId, setEditId] = useState<number | null>(null)
  const [ed, setEd] = useState<any>({})

  async function guardar() {
    await supabase.from('crm_publicos_marca').update({
      publico_objetivo: ed.publico_objetivo, propuesta_valor: ed.propuesta_valor,
      momentos_consumo: ed.momentos_consumo, mensajes_clave: ed.mensajes_clave,
      ticket_medio_objetivo: ed.ticket_medio_objetivo ? Number(ed.ticket_medio_objetivo) : null,
    }).eq('id', editId)
    setEditId(null)
    onSaved()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 14 }}>
      {publicos.map((p: Publico) => (
        <div key={p.id} style={{ ...groupStyle(T), padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 16, letterSpacing: '1px', textTransform: 'uppercase', color: '#B01D23', fontWeight: 600 }}>{p.marca}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {p.plataforma_principal && <span style={{ fontSize: 10, fontFamily: 'Oswald,sans-serif', letterSpacing: '1px', padding: '2px 8px', borderRadius: 4, background: CANAL_COLOR[p.plataforma_principal] || '#888', color: p.plataforma_principal === 'glovo' ? '#1a1a00' : '#fff' }}>{(CANAL_LABEL[p.plataforma_principal] || p.plataforma_principal).toUpperCase()}</span>}
              <button onClick={() => { setEditId(p.id); setEd({ ...p }) }} style={{ background: 'none', border: `0.5px solid ${T.brd}`, borderRadius: 6, color: T.sec, cursor: 'pointer', fontSize: 11, padding: '3px 10px', fontFamily: FONT.body }}>Editar</button>
            </div>
          </div>
          {editId === p.id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea value={ed.publico_objetivo} onChange={e => setEd({ ...ed, publico_objetivo: e.target.value })} style={{ ...inputStyle(T), minHeight: 60 }} />
              <textarea value={ed.propuesta_valor} onChange={e => setEd({ ...ed, propuesta_valor: e.target.value })} style={{ ...inputStyle(T), minHeight: 44 }} />
              <input value={ed.momentos_consumo || ''} onChange={e => setEd({ ...ed, momentos_consumo: e.target.value })} style={inputStyle(T)} placeholder="Momentos de consumo" />
              <input value={ed.mensajes_clave || ''} onChange={e => setEd({ ...ed, mensajes_clave: e.target.value })} style={inputStyle(T)} placeholder="Mensajes clave" />
              <input type="number" value={ed.ticket_medio_objetivo || ''} onChange={e => setEd({ ...ed, ticket_medio_objetivo: e.target.value })} style={inputStyle(T)} placeholder="Ticket medio objetivo €" />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={guardar} style={btnPrimario()}>Guardar</button>
                <button onClick={() => setEditId(null)} style={{ ...btnPrimario(), background: 'transparent', border: `0.5px solid ${T.brd}`, color: T.sec }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, display: 'flex', flexDirection: 'column', gap: 7, lineHeight: 1.45 }}>
              <div><span style={{ color: T.mut, fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'Oswald,sans-serif' }}>Público</span><br />{p.publico_objetivo}</div>
              <div><span style={{ color: T.mut, fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'Oswald,sans-serif' }}>Propuesta</span><br />{p.propuesta_valor}</div>
              {p.momentos_consumo && <div><span style={{ color: T.mut, fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'Oswald,sans-serif' }}>Momentos</span><br />{p.momentos_consumo}</div>}
              {p.mensajes_clave && <div><span style={{ color: T.mut, fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'Oswald,sans-serif' }}>Mensajes</span><br />{p.mensajes_clave}</div>}
              {p.ticket_medio_objetivo != null && <div><span style={{ color: T.mut, fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'Oswald,sans-serif' }}>Ticket objetivo</span><br />{fmtEur(Number(p.ticket_medio_objetivo))}</div>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ─────────── TAB CAMPAÑAS ─────────── */
function TabCampanas({ T, isDark, campanas, metricas, onSaved }: any) {
  const [regId, setRegId] = useState<number | null>(null)
  const [reg, setReg] = useState({ fecha: new Date().toISOString().slice(0, 10), pedidos: '', ventas: '', nuevos_clientes: '', canjes_codigo: '', coste: '' })

  const aggPorCampana = useMemo(() => {
    const m: Record<number, { pedidos: number; ventas: number; nuevos: number; canjes: number; coste: number }> = {}
    for (const x of metricas as Metrica[]) {
      if (!m[x.campana_id]) m[x.campana_id] = { pedidos: 0, ventas: 0, nuevos: 0, canjes: 0, coste: 0 }
      m[x.campana_id].pedidos += x.pedidos || 0
      m[x.campana_id].ventas += Number(x.ventas) || 0
      m[x.campana_id].nuevos += x.nuevos_clientes || 0
      m[x.campana_id].canjes += x.canjes_codigo || 0
      m[x.campana_id].coste += Number(x.coste) || 0
    }
    return m
  }, [metricas])

  function progresoKpi(c: Campana): number {
    const a = aggPorCampana[c.id]
    if (!a || !c.kpi_meta) return 0
    let real = 0
    if (c.kpi_principal.includes('email') || c.kpi_principal.includes('clientes_nuevos') || c.kpi_principal === 'clientes_nuevos') real = a.nuevos
    else if (c.kpi_principal.includes('pedidos')) real = a.pedidos
    else if (c.kpi_principal.includes('ticket')) real = a.pedidos > 0 ? a.ventas / a.pedidos : 0
    else real = a.ventas
    return Math.round((real / Number(c.kpi_meta)) * 100)
  }

  async function cambiarEstado(c: Campana, estado: string) {
    await supabase.from('crm_campanas').update({ estado }).eq('id', c.id)
    onSaved(`Campaña ${estado}`)
  }
  async function guardarMetrica() {
    if (!regId) return
    await supabase.from('crm_campanas_metricas').upsert({
      campana_id: regId, fecha: reg.fecha,
      pedidos: Number(reg.pedidos) || 0, ventas: Number(reg.ventas) || 0,
      nuevos_clientes: Number(reg.nuevos_clientes) || 0, canjes_codigo: Number(reg.canjes_codigo) || 0, coste: Number(reg.coste) || 0,
    }, { onConflict: 'campana_id,fecha' })
    setRegId(null)
    setReg({ fecha: new Date().toISOString().slice(0, 10), pedidos: '', ventas: '', nuevos_clientes: '', canjes_codigo: '', coste: '' })
    onSaved('Métricas registradas')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {campanas.map((c: Campana) => {
        const a = aggPorCampana[c.id]
        const pct = progresoKpi(c)
        const roi = a && a.coste > 0 ? ((a.ventas - a.coste) / a.coste) * 100 : null
        return (
          <div key={c.id} style={groupStyle(T)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'Oswald,sans-serif', fontSize: 16, fontWeight: 600, color: T.pri, letterSpacing: '0.5px' }}>{c.nombre}</span>
                  <span style={{ fontSize: 10, fontFamily: 'Oswald,sans-serif', letterSpacing: '1px', padding: '2px 8px', borderRadius: 4, background: CANAL_COLOR[c.canal] || '#888', color: c.canal === 'glovo' ? '#1a1a00' : '#fff' }}>{(CANAL_LABEL[c.canal] || c.canal).toUpperCase()}</span>
                  <span style={{ fontSize: 10, fontFamily: 'Oswald,sans-serif', letterSpacing: '1px', padding: '2px 8px', borderRadius: 4, border: `1px solid ${ESTADO_COLOR[c.estado]}`, color: ESTADO_COLOR[c.estado] }}>{c.estado.toUpperCase()}</span>
                  {c.marca && <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>{c.marca}</span>}
                </div>
                <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, marginBottom: 4 }}>{c.objetivo_smart}</div>
                {c.mecanica && <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>Mecánica: {c.mecanica}</div>}
                <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginTop: 4 }}>
                  {fmtFechaCorta(c.fecha_inicio)}{c.fecha_fin ? ` → ${fmtFechaCorta(c.fecha_fin)}` : ''} · Presupuesto {fmtEur(Number(c.presupuesto))}{c.codigo_promo ? ` · Código ${c.codigo_promo}` : ''}
                </div>
              </div>
              <div style={{ minWidth: 220 }}>
                <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: T.mut }}>KPI: {c.kpi_principal} · Meta {c.kpi_meta ?? '—'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <div style={{ flex: 1, height: 6, background: T.brd, borderRadius: 3 }}>
                    <div style={{ height: 6, width: `${Math.min(pct, 100)}%`, background: semaforoColor(pct), borderRadius: 3, transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ fontFamily: 'Oswald,sans-serif', fontSize: 15, fontWeight: 600, color: semaforoColor(pct) }}>{pct}%</span>
                </div>
                {a && (
                  <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec, marginTop: 6 }}>
                    {a.pedidos} pedidos · {fmtEur(a.ventas)} · {a.nuevos} nuevos{a.canjes ? ` · ${a.canjes} canjes` : ''}{roi !== null ? ` · ROI ${Math.round(roi)}%` : ''}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {ESTADOS.filter(e => e !== c.estado).map(e => (
                    <button key={e} onClick={() => cambiarEstado(c, e)} style={{ background: 'none', border: `0.5px solid ${T.brd}`, borderRadius: 6, color: T.sec, cursor: 'pointer', fontSize: 11, padding: '3px 8px', fontFamily: FONT.body }}>{e}</button>
                  ))}
                  <button onClick={() => setRegId(regId === c.id ? null : c.id)} style={{ background: 'none', border: '0.5px solid #B01D23', borderRadius: 6, color: '#B01D23', cursor: 'pointer', fontSize: 11, padding: '3px 8px', fontFamily: FONT.body, fontWeight: 600 }}>+ Métricas día</button>
                </div>
              </div>
            </div>
            {regId === c.id && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginTop: 14, paddingTop: 14, borderTop: `0.5px solid ${T.brd}`, alignItems: 'center' }}>
                <input type="date" value={reg.fecha} onChange={e => setReg({ ...reg, fecha: e.target.value })} style={inputStyle(T)} />
                <input type="number" placeholder="Pedidos" value={reg.pedidos} onChange={e => setReg({ ...reg, pedidos: e.target.value })} style={inputStyle(T)} />
                <input type="number" placeholder="Ventas €" value={reg.ventas} onChange={e => setReg({ ...reg, ventas: e.target.value })} style={inputStyle(T)} />
                <input type="number" placeholder="Nuevos" value={reg.nuevos_clientes} onChange={e => setReg({ ...reg, nuevos_clientes: e.target.value })} style={inputStyle(T)} />
                <input type="number" placeholder="Canjes" value={reg.canjes_codigo} onChange={e => setReg({ ...reg, canjes_codigo: e.target.value })} style={inputStyle(T)} />
                <input type="number" placeholder="Coste €" value={reg.coste} onChange={e => setReg({ ...reg, coste: e.target.value })} style={inputStyle(T)} />
                <button onClick={guardarMetrica} style={btnPrimario()}>Guardar</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─────────── TAB EMBUDO ─────────── */
function TabEmbudo({ T, embudo, onSaved }: any) {
  const hoy = new Date()
  const hace30 = new Date(hoy.getTime() - 30 * 86400000).toISOString().slice(0, 10)
  const [f, setF] = useState({ fecha: hoy.toISOString().slice(0, 10), canal: 'uber_eats', marca: '', etapa: 'pedidos', valor: '' })

  const canales = ['uber_eats', 'glovo', 'just_eat', 'web']
  const agg = useMemo(() => {
    const m: Record<string, Record<string, number>> = {}
    for (const c of canales) m[c] = { visitas_menu: 0, pedidos: 0, clientes_nuevos: 0, clientes_recurrentes: 0 }
    for (const e of embudo as EmbudoEvento[]) {
      if (e.fecha < hace30) continue
      if (m[e.canal] && m[e.canal][e.etapa] !== undefined) m[e.canal][e.etapa] += Number(e.valor) || 0
    }
    return m
  }, [embudo])

  async function guardar() {
    if (!f.valor) return
    await supabase.from('crm_embudo_eventos').upsert({ fecha: f.fecha, canal: f.canal, marca: f.marca || null, etapa: f.etapa, valor: Number(f.valor), fuente: 'manual' }, { onConflict: 'fecha,canal,marca,etapa' })
    setF({ ...f, valor: '' })
    onSaved()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>Últimos 30 días · Visitas de menú: solo disponibles en los paneles de Uber Eats / Glovo / Just Eat (dato agregado, las plataformas no ceden identidad del cliente). El embudo completo cliente a cliente solo existe en canal propio.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14 }}>
        {canales.map(c => {
          const a = agg[c]
          const convVisPed = a.visitas_menu > 0 ? Math.round(a.pedidos / a.visitas_menu * 100) : null
          const convRec = a.pedidos > 0 ? Math.round(a.clientes_recurrentes / a.pedidos * 100) : null
          return (
            <div key={c} style={groupStyle(T)}>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 14, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: c === 'glovo' ? '#8a7800' : (CANAL_COLOR[c] || T.pri), marginBottom: 12 }}>{CANAL_LABEL[c]}</div>
              {ETAPAS.map((et, i) => {
                const maxV = Math.max(...ETAPAS.map(e2 => agg[c][e2]), 1)
                return (
                  <div key={et} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT.body, fontSize: 12, color: T.sec, marginBottom: 3 }}>
                      <span>{ETAPA_LABEL[et]}</span><span style={{ fontWeight: 600, color: T.pri }}>{agg[c][et]}</span>
                    </div>
                    <div style={{ height: 8, background: T.brd, borderRadius: 4 }}>
                      <div style={{ height: 8, width: `${(agg[c][et] / maxV) * 100}%`, background: CANAL_COLOR[c], borderRadius: 4, opacity: 1 - i * 0.15 }} />
                    </div>
                  </div>
                )
              })}
              <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginTop: 10 }}>
                {convVisPed !== null ? `Conversión menú→pedido: ${convVisPed}%` : 'Sin datos de visitas'}{convRec !== null ? ` · Recurrencia: ${convRec}%` : ''}
              </div>
            </div>
          )
        })}
      </div>

      <div style={groupStyle(T)}>
        <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>Registrar dato de embudo (de los paneles de plataforma)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, alignItems: 'center' }}>
          <input type="date" value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} style={inputStyle(T)} />
          <select value={f.canal} onChange={e => setF({ ...f, canal: e.target.value })} style={inputStyle(T)}>
            {canales.map(c => <option key={c} value={c}>{CANAL_LABEL[c]}</option>)}
          </select>
          <input placeholder="Marca (opcional)" value={f.marca} onChange={e => setF({ ...f, marca: e.target.value })} style={inputStyle(T)} />
          <select value={f.etapa} onChange={e => setF({ ...f, etapa: e.target.value })} style={inputStyle(T)}>
            {ETAPAS.map(e2 => <option key={e2} value={e2}>{ETAPA_LABEL[e2]}</option>)}
          </select>
          <input type="number" placeholder="Valor" value={f.valor} onChange={e => setF({ ...f, valor: e.target.value })} style={inputStyle(T)} />
          <button onClick={guardar} style={btnPrimario()}>Guardar</button>
        </div>
      </div>
    </div>
  )
}
