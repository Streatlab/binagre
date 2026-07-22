// TabEquivalencias — Bloque A5: ver, buscar, crear, editar y borrar los mapeos
// producto↔ingrediente (producto_ingrediente_map). Es la tabla de equivalencias que
// gobierna el antiduplicado de la ingesta: cada (texto de factura + proveedor) apunta a
// UN ingrediente. Estilo Neobrutal del Escandallo (estilosTabla).
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import type { Ingrediente } from './types'
import { INK, CREMA, OSW, LEX, AMA, VERDE, ROJO, GRIS, GRANATE, ROSA_S } from '@/styles/neobrutal'
import { th, thR, td, tdNum, tdCod, zebra } from './estilosTabla'

interface Props { ingredientes: Ingrediente[] }

interface Equiv {
  id: string
  texto_producto: string
  proveedor_nombre: string | null
  ingrediente_id: string
  veces_usado: number | null
  estado: string | null
}

const btn = (bg: string): CSSProperties => ({ fontFamily: OSW, fontWeight: 700, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase', background: bg, color: INK, border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, padding: '7px 12px', cursor: 'pointer' })
const inp: CSSProperties = { fontFamily: LEX, fontSize: 14, padding: '7px 10px', border: `2px solid ${INK}`, background: 'var(--sl-card)', color: INK, minWidth: 180 }

export default function TabEquivalencias({ ingredientes }: Props) {
  const [equivs, setEquivs] = useState<Equiv[]>([])
  const [busca, setBusca] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState<{ texto: string; proveedor: string; ingrediente_id: string } | null>(null)

  const nombreIng = useMemo(() => {
    const m = new Map<string, { iding: string | null; nombre: string | null }>()
    ingredientes.forEach(i => m.set(i.id, { iding: (i as any).iding ?? null, nombre: i.nombre ?? (i as any).nombre_base ?? null }))
    return m
  }, [ingredientes])

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('producto_ingrediente_map')
      .select('id, texto_producto, proveedor_nombre, ingrediente_id, veces_usado, estado')
      .order('veces_usado', { ascending: false }).limit(2000)
    setEquivs((data as Equiv[]) ?? [])
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const propuestas = useMemo(() => equivs.filter(e => e.estado === 'propuesta'), [equivs])

  const aceptar = async (id: string) => {
    const { data, error } = await supabase.rpc('fn_aceptar_propuesta', { p_map_id: id })
    if (error || !(data as any)?.ok) { setMsg(`Error: ${error?.message ?? (data as any)?.motivo ?? 'no se pudo aceptar'}`); return }
    setMsg(`Equivalencia confirmada${(data as any).lineas_reprocesadas ? `, ${(data as any).lineas_reprocesadas} línea(s) reprocesada(s)` : ''}.`); await cargar()
  }
  const rechazar = async (id: string) => {
    const { data, error } = await supabase.rpc('fn_rechazar_propuesta', { p_map_id: id })
    if (error || !(data as any)?.ok) { setMsg(`Error: ${error?.message ?? 'no se pudo rechazar'}`); return }
    setMsg('Propuesta rechazada.'); await cargar()
  }

  const filtradas = useMemo(() => {
    const confirmadas = equivs.filter(e => e.estado !== 'propuesta')
    const q = busca.trim().toLowerCase()
    if (!q) return confirmadas.slice(0, 500)
    return confirmadas.filter(e => {
      const ing = nombreIng.get(e.ingrediente_id)
      return e.texto_producto.toLowerCase().includes(q)
        || (e.proveedor_nombre ?? '').toLowerCase().includes(q)
        || (ing?.nombre ?? '').toLowerCase().includes(q)
        || (ing?.iding ?? '').toLowerCase().includes(q)
    }).slice(0, 500)
  }, [equivs, busca, nombreIng])

  const guardarDestino = async (id: string, ingrediente_id: string) => {
    if (!ingrediente_id) return
    const { error } = await supabase.from('producto_ingrediente_map').update({ ingrediente_id }).eq('id', id)
    if (error) { setMsg(`Error: ${error.message}`); return }
    setEditId(null); setMsg('Equivalencia actualizada.'); await cargar()
  }

  const borrar = async (id: string) => {
    if (!confirm('¿Borrar esta equivalencia? La ingesta dejará de reconocer ese producto para este proveedor.')) return
    const { error } = await supabase.from('producto_ingrediente_map').delete().eq('id', id)
    if (error) { setMsg(`Error: ${error.message}`); return }
    setMsg('Equivalencia borrada.'); await cargar()
  }

  const crear = async () => {
    if (!nuevo || !nuevo.texto.trim() || !nuevo.ingrediente_id) { setMsg('Falta texto del producto o ingrediente destino.'); return }
    const { error } = await supabase.from('producto_ingrediente_map').insert({
      texto_producto: nuevo.texto.trim().toLowerCase(),
      proveedor_nombre: nuevo.proveedor.trim() || null,
      ingrediente_id: nuevo.ingrediente_id,
    })
    if (error) { setMsg(`Error: ${error.message}`); return }
    setNuevo(null); setMsg('Equivalencia creada.'); await cargar()
  }

  const opcionesIng = [...ingredientes]
    .filter(i => !(i as any).borrador)
    .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? ''))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {msg && <div style={{ background: AMA, border: `3px solid ${INK}`, boxShadow: `4px 4px 0 ${INK}`, padding: '9px 13px', fontFamily: LEX, fontSize: 13, fontWeight: 600, color: INK }}>{msg}</div>}

      {/* Propuestas pendientes (creadas por la ingesta ante un candidato claro) */}
      {!!propuestas.length && (
        <div style={{ background: 'var(--sl-card)', border: `3px solid ${GRANATE}`, boxShadow: `4px 4px 0 ${GRANATE}`, padding: 12 }}>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 14, letterSpacing: '.5px', textTransform: 'uppercase', color: GRANATE, marginBottom: 8 }}>Propuestas por confirmar ({propuestas.length})</div>
          <p style={{ fontFamily: LEX, fontSize: 12, color: GRIS, margin: '0 0 10px' }}>La ingesta cree que estos productos de factura son un ingrediente que ya existe. Confírmalo (vincula y reprocesa las líneas pendientes) o recházalo.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {propuestas.map(p => {
              const ing = nombreIng.get(p.ingrediente_id)
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontFamily: LEX, fontSize: 13 }}>
                  <span><b>{p.texto_producto}</b> {p.proveedor_nombre ? `(${p.proveedor_nombre})` : ''} ≈ <span style={{ color: GRANATE, fontWeight: 700 }}>{ing?.iding ?? ''}</span> <b>{ing?.nombre ?? '—'}</b></span>
                  <button style={btn(VERDE)} onClick={() => aceptar(p.id)}>Confirmar</button>
                  <button style={btn(ROSA_S)} onClick={() => rechazar(p.id)}>Rechazar</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <input placeholder="Buscar producto, proveedor o ingrediente…" value={busca} onChange={e => setBusca(e.target.value)} style={{ ...inp, minWidth: 280, paddingRight: 28 }} />
          {busca && <button onClick={() => setBusca('')} title="Limpiar" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: GRIS, fontFamily: OSW, fontWeight: 700, fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>}
        </div>
        <span style={{ fontFamily: OSW, fontSize: 12, color: GRIS, letterSpacing: '.5px' }}>{filtradas.length} de {equivs.length}</span>
        <button style={btn(AMA)} onClick={() => setNuevo({ texto: '', proveedor: '', ingrediente_id: '' })}>+ Nueva equivalencia</button>
      </div>

      {nuevo && (
        <div style={{ background: 'var(--sl-card)', border: `3px solid ${INK}`, boxShadow: `4px 4px 0 ${INK}`, padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="Texto del producto (como en la factura)" value={nuevo.texto} onChange={e => setNuevo({ ...nuevo, texto: e.target.value })} style={inp} />
          <input placeholder="Proveedor (opcional)" value={nuevo.proveedor} onChange={e => setNuevo({ ...nuevo, proveedor: e.target.value })} style={inp} />
          <select value={nuevo.ingrediente_id} onChange={e => setNuevo({ ...nuevo, ingrediente_id: e.target.value })} style={{ ...inp, minWidth: 220 }}>
            <option value="">— ingrediente destino —</option>
            {opcionesIng.map(i => <option key={i.id} value={i.id}>{(i as any).iding ? `${(i as any).iding} · ` : ''}{i.nombre}</option>)}
          </select>
          <button style={btn(VERDE)} onClick={crear}>Crear</button>
          <button style={btn('var(--sl-card)')} onClick={() => setNuevo(null)}>Cancelar</button>
        </div>
      )}

      <div style={{ overflowX: 'auto', border: `3px solid ${INK}`, boxShadow: `5px 5px 0 ${INK}` }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', background: CREMA }}>
          <thead><tr><th style={th}>TEXTO EN FACTURA</th><th style={th}>PROVEEDOR</th><th style={th}>→ INGREDIENTE</th><th style={thR}>VECES</th><th style={th} /></tr></thead>
          <tbody>
            {filtradas.map((e, i) => {
              const ing = nombreIng.get(e.ingrediente_id)
              const enEdicion = editId === e.id
              return (
                <tr key={e.id} style={{ background: zebra(i) }}>
                  <td style={{ ...td, fontWeight: 700, whiteSpace: 'normal' }}>{e.texto_producto}</td>
                  <td style={{ ...td, color: GRIS }}>{e.proveedor_nombre ?? '—'}</td>
                  <td style={td}>
                    {enEdicion ? (
                      <select defaultValue={e.ingrediente_id} onChange={ev => guardarDestino(e.id, ev.target.value)} style={{ ...inp, minWidth: 220 }}>
                        {opcionesIng.map(o => <option key={o.id} value={o.id}>{(o as any).iding ? `${(o as any).iding} · ` : ''}{o.nombre}</option>)}
                      </select>
                    ) : (
                      <span><span style={{ fontFamily: OSW, fontWeight: 700, color: GRANATE }}>{ing?.iding ?? '—'}</span> · {ing?.nombre ?? <em style={{ color: ROJO }}>huérfano</em>}</span>
                    )}
                  </td>
                  <td style={tdNum}>{e.veces_usado ?? 0}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button style={{ ...btn('var(--sl-card)'), marginRight: 6 }} onClick={() => setEditId(enEdicion ? null : e.id)}>{enEdicion ? 'Cerrar' : 'Cambiar'}</button>
                    <button style={btn(ROSA_S)} onClick={() => borrar(e.id)}>Borrar</button>
                  </td>
                </tr>
              )
            })}
            {!filtradas.length && <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: GRIS }}>Sin equivalencias que coincidan.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
