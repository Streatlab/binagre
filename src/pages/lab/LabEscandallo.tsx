/**
 * LAB · Escandallo — pantalla espejo en Ley Visual SL v2.
 * Copia intocable: el Escandallo real sigue en neobrutal, sin tocar.
 * Elementos que aporta: pestañas con contador, buscador, rejilla de fichas,
 * listas anidadas y ficha en modal. Solo lectura.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  C, Card, CardHead, Kpi, KpiGrid, Pill, Nota, Vacio, InBar,
  eur2, num0, pct1,
} from '@/components/panel/sl/uiSL'
import {
  PageHead, Tabs, Toolbar, Campo, Tabla, Fila, Celda, Modal, Boton,
  SkeletonTabla, Estado,
} from '@/components/panel/sl/uiSLTabla'

type TabId = 'ingredientes' | 'eps' | 'recetas' | 'mermas'

interface Ing { id: string; nombre: string; precio_kg?: number | null; unidad?: string | null; proveedor?: string | null }
interface Eps { id: string; codigo?: string | null; nombre: string; coste_kg?: number | null; usos?: number }
interface Rec { id: string; codigo?: string | null; nombre: string; coste_total?: number | null; pvp?: number | null }
interface Mer { id: string; nombre: string; merma_pct?: number | null }

export default function LabEscandallo() {
  const [tab, setTab] = useState<TabId>('ingredientes')
  const [busca, setBusca] = useState('')
  const [cargando, setCargando] = useState(true)
  const [ings, setIngs] = useState<Ing[]>([])
  const [eps, setEps] = useState<Eps[]>([])
  const [recs, setRecs] = useState<Rec[]>([])
  const [mermas, setMermas] = useState<Mer[]>([])
  const [ficha, setFicha] = useState<{ titulo: string; sub: string; filas: Array<[string, string]> } | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('ingredientes').select('*').order('nombre'),
      supabase.from('eps').select('*').order('nombre'),
      supabase.from('recetas').select('*').order('nombre'),
      supabase.from('mermas').select('*'),
      supabase.from('recetas_lineas').select('eps_id').not('eps_id', 'is', null),
    ]).then(([i, e, r, m, rl]) => {
      const usos: Record<string, number> = {}
      ;(rl.data ?? []).forEach((l: any) => { if (l.eps_id) usos[l.eps_id] = (usos[l.eps_id] ?? 0) + 1 })
      setIngs((i.data ?? []) as unknown as Ing[])
      setEps(((e.data ?? []) as unknown as Eps[]).map(x => ({ ...x, usos: usos[x.id] ?? 0 })))
      setRecs((r.data ?? []) as unknown as Rec[])
      setMermas((m.data ?? []) as unknown as Mer[])
      setCargando(false)
    })
  }, [])

  const q = busca.trim().toLowerCase()
  const fIngs = useMemo(() => ings.filter(x => !q || (x.nombre ?? '').toLowerCase().includes(q)), [ings, q])
  const fEps = useMemo(() => eps.filter(x => !q || (x.nombre ?? '').toLowerCase().includes(q)), [eps, q])
  const fRecs = useMemo(() => recs.filter(x => !q || (x.nombre ?? '').toLowerCase().includes(q)), [recs, q])
  const fMermas = useMemo(() => mermas.filter(x => !q || (x.nombre ?? '').toLowerCase().includes(q)), [mermas, q])

  const conPrecio = ings.filter(i => Number(i.precio_kg ?? 0) > 0).length
  const coberturaPrecio = ings.length > 0 ? (conPrecio / ings.length) * 100 : 0
  const epsHuerfanos = eps.filter(e => (e.usos ?? 0) === 0).length
  const maxPrecio = Math.max(...ings.map(i => Number(i.precio_kg ?? 0)), 1)

  const margenReceta = (r: Rec) => {
    const pvp = Number(r.pvp ?? 0)
    const coste = Number(r.coste_total ?? 0)
    if (pvp <= 0 || coste <= 0) return null
    return ((pvp - coste) / pvp) * 100
  }

  return (
    <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}>
      <PageHead
        titulo="Escandallo"
        sub="Pantalla espejo · solo lectura, no toca datos"
        right={<Pill tone="neutro">{num0(ings.length + eps.length + recs.length)} fichas</Pill>}
      />

      <KpiGrid cols={4}>
        <Kpi
          icono="€" tono={coberturaPrecio >= 90 ? 'verde' : 'ambar'}
          label="Ingredientes con precio" valor={pct1(coberturaPrecio)}
          pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>{num0(conPrecio)} de {num0(ings.length)} · sin precio no hay coste real</div>}
        />
        <Kpi icono="E" tono="blu" label="EPS" valor={num0(eps.length)}
          pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>{num0(epsHuerfanos)} sin usar en ninguna receta</div>} />
        <Kpi icono="R" tono="blu" label="Recetas" valor={num0(recs.length)}
          pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>Cada receta debe acabar en un plato de carta</div>} />
        <Kpi icono="%" tono="ambar" label="Mermas" valor={num0(mermas.length)}
          pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>Lo que se pierde antes de cocinar</div>} />
      </KpiGrid>

      <Tabs
        activeId={tab}
        onChange={setTab}
        tabs={[
          { id: 'ingredientes', label: 'Ingredientes', count: ings.length },
          { id: 'eps', label: 'EPS', count: eps.length },
          { id: 'recetas', label: 'Recetas', count: recs.length },
          { id: 'mermas', label: 'Mermas', count: mermas.length },
        ]}
      />

      <Toolbar right={<Campo valor={busca} onChange={setBusca} placeholder="Buscar por nombre…" ancho={260} />} />

      {cargando ? (
        <SkeletonTabla filas={8} />
      ) : (
        <>
          {tab === 'ingredientes' && (
            fIngs.length === 0 ? <Card><Vacio>Ningún ingrediente con ese nombre.</Vacio></Card> : (
              <Tabla cabeceras={[
                { label: 'Ingrediente' },
                { label: 'Proveedor', ancho: 180 },
                { label: 'Unidad', ancho: 90 },
                { label: 'Precio', alinea: 'der', ancho: 170 },
                { label: 'Estado', alinea: 'der', ancho: 130 },
              ]}>
                {fIngs.slice(0, 120).map(i => {
                  const p = Number(i.precio_kg ?? 0)
                  return (
                    <Fila key={i.id} tono={p > 0 ? 'verde' : 'ambar'} onClick={() => setFicha({
                      titulo: i.nombre,
                      sub: i.proveedor ?? 'Sin proveedor',
                      filas: [
                        ['Precio', p > 0 ? eur2(p) : 'Sin precio'],
                        ['Unidad', i.unidad ?? '—'],
                        ['Proveedor', i.proveedor ?? '—'],
                      ],
                    })}>
                      <Celda fuerte>{i.nombre}</Celda>
                      <Celda style={{ color: C.grisCl }}>{i.proveedor || '—'}</Celda>
                      <Celda style={{ color: C.grisCl }}>{i.unidad || '—'}</Celda>
                      <Celda der>
                        <span className="slnum" style={{ fontWeight: 900 }}>{p > 0 ? eur2(p) : '—'}</span>
                        {p > 0 && <InBar pct={(p / maxPrecio) * 100} color={C.rojo} />}
                      </Celda>
                      <Celda der>
                        <Estado tono={p > 0 ? 'verde' : 'ambar'}>{p > 0 ? 'Costeado' : 'Sin precio'}</Estado>
                      </Celda>
                    </Fila>
                  )
                })}
              </Tabla>
            )
          )}

          {tab === 'eps' && (
            fEps.length === 0 ? <Card><Vacio>Ningún EPS con ese nombre.</Vacio></Card> : (
              <Tabla cabeceras={[
                { label: 'Código', ancho: 100 },
                { label: 'EPS' },
                { label: 'Coste', alinea: 'der', ancho: 130 },
                { label: 'Usos', alinea: 'der', ancho: 90 },
                { label: 'Estado', alinea: 'der', ancho: 140 },
              ]}>
                {fEps.slice(0, 120).map(e => {
                  const usos = e.usos ?? 0
                  return (
                    <Fila key={e.id} tono={usos > 0 ? 'verde' : 'ambar'} onClick={() => setFicha({
                      titulo: e.nombre,
                      sub: e.codigo ?? 'Sin código',
                      filas: [
                        ['Coste', Number(e.coste_kg ?? 0) > 0 ? eur2(Number(e.coste_kg)) : 'Sin coste'],
                        ['Usos en recetas', String(usos)],
                      ],
                    })}>
                      <Celda mono style={{ color: C.grisCl }}>{e.codigo || '—'}</Celda>
                      <Celda fuerte>{e.nombre}</Celda>
                      <Celda der mono>{Number(e.coste_kg ?? 0) > 0 ? eur2(Number(e.coste_kg)) : '—'}</Celda>
                      <Celda der mono>{num0(usos)}</Celda>
                      <Celda der>
                        <Estado tono={usos > 0 ? 'verde' : 'ambar'}>{usos > 0 ? 'En uso' : 'Huérfano'}</Estado>
                      </Celda>
                    </Fila>
                  )
                })}
              </Tabla>
            )
          )}

          {tab === 'recetas' && (
            fRecs.length === 0 ? <Card><Vacio>Ninguna receta con ese nombre.</Vacio></Card> : (
              <Tabla cabeceras={[
                { label: 'Código', ancho: 100 },
                { label: 'Receta' },
                { label: 'Coste', alinea: 'der', ancho: 120 },
                { label: 'PVP', alinea: 'der', ancho: 120 },
                { label: 'Margen', alinea: 'der', ancho: 160 },
              ]}>
                {fRecs.slice(0, 120).map(r => {
                  const m = margenReceta(r)
                  const tono = m == null ? 'neutro' : m >= 65 ? 'verde' : m >= 50 ? 'ambar' : 'rojo'
                  return (
                    <Fila key={r.id} tono={tono} onClick={() => setFicha({
                      titulo: r.nombre,
                      sub: r.codigo ?? 'Sin código',
                      filas: [
                        ['Coste', Number(r.coste_total ?? 0) > 0 ? eur2(Number(r.coste_total)) : 'Sin coste'],
                        ['PVP', Number(r.pvp ?? 0) > 0 ? eur2(Number(r.pvp)) : 'Sin PVP'],
                        ['Margen', m == null ? 'No calculable' : pct1(m)],
                      ],
                    })}>
                      <Celda mono style={{ color: C.grisCl }}>{r.codigo || '—'}</Celda>
                      <Celda fuerte>{r.nombre}</Celda>
                      <Celda der mono>{Number(r.coste_total ?? 0) > 0 ? eur2(Number(r.coste_total)) : '—'}</Celda>
                      <Celda der mono>{Number(r.pvp ?? 0) > 0 ? eur2(Number(r.pvp)) : '—'}</Celda>
                      <Celda der>
                        {m == null ? <Pill tone="neutro">Sin datos</Pill> : (
                          <>
                            <span className="slnum" style={{ fontWeight: 900 }}>{pct1(m)}</span>
                            <InBar pct={m} color={m >= 65 ? C.verde : m >= 50 ? C.ambar : C.rojoSem} />
                          </>
                        )}
                      </Celda>
                    </Fila>
                  )
                })}
              </Tabla>
            )
          )}

          {tab === 'mermas' && (
            fMermas.length === 0 ? <Card><Vacio>Ninguna merma con ese nombre.</Vacio></Card> : (
              <Tabla cabeceras={[
                { label: 'Producto' },
                { label: 'Merma', alinea: 'der', ancho: 200 },
              ]}>
                {fMermas.slice(0, 120).map(m => {
                  const pct = Number(m.merma_pct ?? 0)
                  return (
                    <Fila key={m.id} tono={pct > 25 ? 'rojo' : pct > 12 ? 'ambar' : 'verde'}>
                      <Celda fuerte>{m.nombre}</Celda>
                      <Celda der>
                        <span className="slnum" style={{ fontWeight: 900 }}>{pct1(pct)}</span>
                        <InBar pct={pct} color={pct > 25 ? C.rojoSem : pct > 12 ? C.ambar : C.verde} />
                      </Celda>
                    </Fila>
                  )
                })}
              </Tabla>
            )
          )}

          {tab === 'ingredientes' && coberturaPrecio < 90 && (
            <Nota tono="ambar" accion="Ver los que faltan">
              Mientras haya ingredientes sin precio, el coste de las recetas que los usan es mentira.
            </Nota>
          )}
        </>
      )}

      {ficha && (
        <Modal
          titulo={ficha.titulo}
          sub={ficha.sub}
          onClose={() => setFicha(null)}
          ancho={520}
          pie={<Boton variante="primario" onClick={() => setFicha(null)}>Cerrar</Boton>}
        >
          {ficha.filas.map(([k, v]) => (
            <div key={k} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '11px 0', borderBottom: `1px solid ${C.line}`,
            }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: C.grisCl, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{k}</span>
              <span className="slnum" style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{v}</span>
            </div>
          ))}
          <Nota tono="blu">Ficha de solo lectura. Para editar, ve al Escandallo real.</Nota>
        </Modal>
      )}
    </div>
  )
}
