import { BLANCO, GRANATE, INK, LIMA, ROJO } from '@/styles/neobrutal'
import { DARK_WASH_VERDE_BG, VERDE_POSITIVO } from '@/styles/palettes'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { fmtEur } from '@/utils/format'

interface Marca { id: string; nombre: string; activa: boolean }
interface Plato { id: string; nombre: string; pvp: number; marca: string; receta_id: string | null; activo: boolean; seccion: string | null; canal: string; descripcion: string | null; orden: number }
interface Receta { id: string; nombre: string; coste_rac: number | null }
interface CartaLink { id: string; marca_id: string; plataforma: string; url: string | null }

const PLATAFORMAS = [
  { key: 'uber', label: 'Uber Eats' },
  { key: 'glovo', label: 'Glovo' },
  { key: 'justeat', label: 'Just Eat' },
  { key: 'web', label: 'Web' },
]

export default function TabMenusMarcas() {
  const { T } = useTheme()
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [marcaSel, setMarcaSel] = useState('')
  const [platos, setPlatos] = useState<Plato[]>([])
  const [recetas, setRecetas] = useState<Receta[]>([])
  const [links, setLinks] = useState<CartaLink[]>([])
  const [form, setForm] = useState({ nombre: '', pvp: '', receta_id: '', seccion: '', descripcion: '' })

  const inp: React.CSSProperties = { padding: '7px 10px', borderRadius: 0, border: `0.5px solid ${T.brd}`, background: INK, color: T.pri, fontSize: 13, fontFamily: FONT.body }

  useEffect(() => {
    supabase.from('marcas').select('id,nombre,activa').eq('activa', true).order('nombre')
      .then(({ data }) => { if (data) { setMarcas(data as Marca[]); if (data.length && !marcaSel) setMarcaSel((data[0] as Marca).nombre) } })
    supabase.from('recetas').select('id,nombre,coste_rac').order('nombre')
      .then(({ data }) => { if (data) setRecetas(data as Receta[]) })
  }, [])

  const cargarCarta = () => {
    if (!marcaSel) return
    supabase.from('carta_platos').select('*').eq('marca', marcaSel).order('orden')
      .then(({ data }) => { if (data) setPlatos(data as Plato[]) })
    const marcaObj = marcas.find(m => m.nombre === marcaSel)
    if (marcaObj) {
      supabase.from('cartas_marca').select('*').eq('marca_id', marcaObj.id)
        .then(({ data }) => { if (data) setLinks(data as CartaLink[]) })
    }
  }
  useEffect(cargarCarta, [marcaSel, marcas])

  const costeReceta = (id: string | null) => recetas.find(r => r.id === id)?.coste_rac ?? null

  const anadirPlato = async () => {
    if (!form.nombre || !form.pvp || !marcaSel) return
    await supabase.from('carta_platos').insert({
      nombre: form.nombre, pvp: parseFloat(form.pvp.replace(',', '.')), marca: marcaSel,
      receta_id: form.receta_id || null, seccion: form.seccion || null,
      descripcion: form.descripcion || null, activo: true, orden: platos.length,
    })
    setForm({ nombre: '', pvp: '', receta_id: '', seccion: '', descripcion: '' })
    cargarCarta()
  }

  const toggleActivo = async (p: Plato) => {
    await supabase.from('carta_platos').update({ activo: !p.activo }).eq('id', p.id)
    cargarCarta()
  }

  const guardarLink = async (plataforma: string, url: string) => {
    const marcaObj = marcas.find(m => m.nombre === marcaSel)
    if (!marcaObj) return
    const existente = links.find(l => l.plataforma === plataforma)
    if (existente) {
      await supabase.from('cartas_marca').update({ url }).eq('id', existente.id)
    } else {
      await supabase.from('cartas_marca').insert({ marca_id: marcaObj.id, plataforma, url })
    }
    cargarCarta()
  }

  const secciones = useMemo(() => {
    const map = new Map<string, Plato[]>()
    for (const p of platos) {
      const s = p.seccion || 'Sin sección'
      map.set(s, [...(map.get(s) ?? []), p])
    }
    return Array.from(map.entries())
  }, [platos])

  const th: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '8px 12px', textAlign: 'left', background: INK, borderBottom: `1px solid ${T.brd}`, whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, color: T.pri, borderBottom: `0.5px solid ${T.brd}`, fontFamily: FONT.body }

  return (
    <div>
      {/* Selector marca */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {marcas.map(m => (
          <button key={m.id} onClick={() => setMarcaSel(m.nombre)}
            style={{ padding: '7px 16px', borderRadius: 0, border: `0.5px solid ${T.brd}`, background: marcaSel === m.nombre ? GRANATE : 'transparent', color: marcaSel === m.nombre ? BLANCO : T.sec, fontFamily: FONT.heading, fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer' }}>
            {m.nombre}
          </button>
        ))}
      </div>

      {/* Links plataformas */}
      <div style={{ ...cardStyle(T), padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: T.mut, fontFamily: FONT.heading, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Links de la carta en plataformas</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          {PLATAFORMAS.map(p => {
            const l = links.find(x => x.plataforma === p.key)
            return (
              <div key={p.key} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: T.sec, minWidth: 70, fontFamily: FONT.heading }}>{p.label}</span>
                <input defaultValue={l?.url ?? ''} placeholder="Pega el link aquí"
                  onBlur={e => { if (e.target.value !== (l?.url ?? '')) guardarLink(p.key, e.target.value) }}
                  style={{ ...inp, flex: 1 }} />
                {l?.url && <a href={l.url} target="_blank" rel="noreferrer" style={{ color: LIMA, fontSize: 12 }}>Abrir</a>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Añadir plato */}
      <div style={{ ...cardStyle(T), padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: T.mut, fontFamily: FONT.heading, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Añadir plato a la carta de {marcaSel || '—'}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Nombre del plato" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={{ ...inp, minWidth: 200 }} />
          <input placeholder="PVP €" value={form.pvp} onChange={e => setForm({ ...form, pvp: e.target.value })} style={{ ...inp, width: 80 }} />
          <input placeholder="Sección (ej. Entrantes)" value={form.seccion} onChange={e => setForm({ ...form, seccion: e.target.value })} style={{ ...inp, width: 160 }} />
          <select value={form.receta_id} onChange={e => setForm({ ...form, receta_id: e.target.value })} style={{ ...inp, maxWidth: 220 }}>
            <option value="">Vincular receta (coste real)...</option>
            {recetas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
          <input placeholder="Descripción para plataforma" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} style={{ ...inp, minWidth: 240, flex: 1 }} />
          <button onClick={anadirPlato} style={{ padding: '8px 18px', borderRadius: 0, border: 'none', background: GRANATE, color: BLANCO, fontFamily: FONT.heading, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', cursor: 'pointer' }}>Añadir</button>
        </div>
      </div>

      {/* Carta por secciones */}
      {secciones.map(([sec, items]) => (
        <div key={sec} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: T.pri, fontFamily: FONT.heading, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>{sec}</div>
          <div style={{ ...cardStyle(T), padding: 0, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Plato</th>
                <th style={{ ...th, textAlign: 'right' }}>PVP</th>
                <th style={{ ...th, textAlign: 'right' }}>Coste</th>
                <th style={{ ...th, textAlign: 'right' }}>Margen</th>
                <th style={th}>Estado</th><th style={th}></th>
              </tr></thead>
              <tbody>
                {items.map(p => {
                  const c = costeReceta(p.receta_id)
                  const margen = c != null && p.pvp > 0 ? Math.round((1 - c / p.pvp) * 1000) / 10 : null
                  return (
                    <tr key={p.id} style={{ opacity: p.activo ? 1 : 0.45 }}>
                      <td style={{ ...td, fontWeight: 600 }}>{p.nombre}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{fmtEur(p.pvp)}</td>
                      <td style={{ ...td, textAlign: 'right', color: T.mut }}>{c != null ? fmtEur(c) : '—'}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: margen == null ? T.mut : margen >= 65 ? VERDE_POSITIVO : margen >= 55 ? LIMA : ROJO }}>
                        {margen != null ? `${margen}%` : '—'}
                      </td>
                      <td style={td}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 0, background: p.activo ? DARK_WASH_VERDE_BG : INK, color: p.activo ? VERDE_POSITIVO : T.mut, fontFamily: FONT.heading, textTransform: 'uppercase' }}>
                          {p.activo ? 'En carta' : 'Fuera'}
                        </span>
                      </td>
                      <td style={td}>
                        <button onClick={() => toggleActivo(p)} style={{ padding: '3px 10px', borderRadius: 0, border: `0.5px solid ${T.brd}`, background: 'transparent', color: T.sec, fontSize: 11, cursor: 'pointer' }}>
                          {p.activo ? 'Quitar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {platos.length === 0 && (
        <div style={{ ...cardStyle(T), padding: 32, textAlign: 'center', color: T.mut }}>Esta marca aún no tiene carta. Añade el primer plato arriba.</div>
      )}
    </div>
  )
}
