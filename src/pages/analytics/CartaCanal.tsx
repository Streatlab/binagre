/**
 * CartaCanal — B6 · Qué plato está en qué plataforma y a qué precio.
 *
 * El plan original era "cambiar el precio en el ERP y que baje solo a Uber,
 * Glovo y Just Eat". No se puede: ninguna de las tres ofrece una vía para que
 * un tercero les escriba la carta. El precio hay que tocarlo en su panel.
 *
 * Así que esto hace lo único que sí aporta dinero: decir EXACTAMENTE qué
 * corregir en cada panel, ordenado por euros. Dos cosas:
 *
 *   1. HUECOS · Platos que vendes en una plataforma y no listas en otra.
 *      Cada uno es venta que sencillamente no ocurre. Es lo más rentable que
 *      hay: el plato ya existe, ya se cocina, ya se vende. Solo falta darlo de
 *      alta.
 *
 *   2. DESCUADRES · El mismo plato a precios distintos entre plataformas.
 *      Las tres cobran el mismo 30% de comisión, así que un precio distinto
 *      solo se explica por descuido. Y donde el precio es más bajo, se está
 *      regalando margen.
 *
 * Estilo: Ley Visual SL v2.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  C, Card, CardHead, Hero, HeroPill, Kpi, KpiGrid, Pill, Nota, Vacio, Atencion, InBar,
  eur0, eur2, num0, pct1,
} from '@/components/panel/sl/uiSL'

interface Fila {
  plato_norm: string
  plato: string
  precio_uber: number | null
  precio_glovo: number | null
  precio_justeat: number | null
  eur_uber: number
  eur_glovo: number
  eur_justeat: number
  eur_total: number
  uds_total: number
  n_canales: number
  precio_ref: number | null
  dispersion: number | null
}

type Tab = 'huecos' | 'precios'

const CANALES = [
  { id: 'uber' as const, label: 'Uber Eats' },
  { id: 'glovo' as const, label: 'Glovo' },
  { id: 'justeat' as const, label: 'Just Eat' },
]

export default function CartaCanal() {
  const [filas, setFilas] = useState<Fila[]>([])
  const [tab, setTab] = useState<Tab>('huecos')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('v_carta_canal')
        .select('*').order('eur_total', { ascending: false })
      setFilas((data ?? []) as Fila[])
      setCargando(false)
    })()
  }, [])

  const precioDe = (f: Fila, c: 'uber' | 'glovo' | 'justeat') =>
    c === 'uber' ? f.precio_uber : c === 'glovo' ? f.precio_glovo : f.precio_justeat

  /* ── 1. Huecos de carta ──
   * Estimo lo que dejas de ingresar así: cojo lo que ese plato factura de media
   * en las plataformas donde SÍ está, y lo aplico a la que falta. Es una
   * estimación conservadora, no una promesa. */
  const huecos = useMemo(() => {
    const out: Array<{ f: Fila; falta: typeof CANALES; potencial: number }> = []
    for (const f of filas) {
      if (f.n_canales === 0) continue
      const falta = CANALES.filter(c => precioDe(f, c.id) == null)
      if (falta.length === 0 || falta.length === 3) continue
      const mediaPorCanal = Number(f.eur_total) / f.n_canales
      out.push({ f, falta, potencial: mediaPorCanal * falta.length })
    }
    return out.sort((a, b) => b.potencial - a.potencial)
  }, [filas])

  const potencialTotal = huecos.reduce((s, h) => s + h.potencial, 0)

  /* ── 2. Descuadres de precio ── */
  const descuadres = useMemo(() => {
    return filas
      .filter(f => f.n_canales >= 2 && Number(f.dispersion) >= 0.5)
      .map(f => {
        const precios = CANALES
          .map(c => ({ c, p: precioDe(f, c.id) }))
          .filter(x => x.p != null) as Array<{ c: typeof CANALES[0]; p: number }>
        const max = precios.reduce((a, b) => (b.p > a.p ? b : a))
        const min = precios.reduce((a, b) => (b.p < a.p ? b : a))
        // Lo que dejas de ganar por vender barato donde vendes barato
        const udsBaratas = Number(f.uds_total) / f.n_canales
        const fuga = (max.p - min.p) * udsBaratas
        return { f, max, min, fuga }
      })
      .sort((a, b) => b.fuga - a.fuga)
  }, [filas])

  const fugaTotal = descuadres.reduce((s, d) => s + d.fuga, 0)

  /* ── Cobertura por canal ── */
  const cobertura = useMemo(() => {
    const total = filas.length || 1
    return CANALES.map(c => {
      const n = filas.filter(f => precioDe(f, c.id) != null).length
      return { ...c, n, pct: (n / total) * 100 }
    })
  }, [filas])

  const peorCanal = useMemo(
    () => cobertura.reduce((a, b) => (b.pct < a.pct ? b : a), cobertura[0]),
    [cobertura])

  if (cargando) {
    return <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}><Card><Vacio>Cargando carta…</Vacio></Card></div>
  }

  const maxPotencial = huecos.length > 0 ? huecos[0].potencial : 1
  const maxFuga = descuadres.length > 0 ? descuadres[0].fuga : 1

  return (
    <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px' }}>Carta por canal</div>
        <div style={{ fontSize: 12, color: C.grisCl, fontWeight: 700, marginTop: 2 }}>
          Qué plato falta en qué plataforma y dónde estás vendiendo barato.
        </div>
      </div>

      <Hero
        eyebrow="VENTA QUE NO ESTÁ OCURRIENDO"
        titular={peorCanal && peorCanal.pct < 80
          ? `Tu carta de ${peorCanal.label} está a medias`
          : 'Huecos de carta entre plataformas'}
        valor={eur0(potencialTotal)}
        sub={`${num0(huecos.length)} platos que vendes en una plataforma y no listas en otra`}
        right={
          <>
            {cobertura.map(c => (
              <HeroPill key={c.id} solid={c.id === peorCanal?.id}>
                {c.label}: {pct1(c.pct)}
              </HeroPill>
            ))}
          </>
        }
      />

      <Atencion tono="rojo" cifra={eur0(potencialTotal)}>
        <b>Esto es lo más rentable que puedes hacer hoy.</b> Estos platos ya existen, ya se cocinan y ya se venden.
        Solo están sin dar de alta en una plataforma. No hay que cocinar nada nuevo ni gastar en publicidad:
        es dar de alta un plato en un panel.
      </Atencion>

      {fugaTotal > 0 && (
        <Atencion tono="ambar" cifra={eur0(fugaTotal)}>
          <b>Y aquí estás regalando margen.</b> Uber, Glovo y Just Eat te cobran el mismo 30%, pero el mismo plato
          tiene precios distintos según dónde lo mires. Donde está más barato, estás dejando dinero encima de la mesa.
        </Atencion>
      )}

      <KpiGrid>
        <Kpi icono="↑" tono="rojo" label="Venta no realizada" valor={eur0(potencialTotal)}
          pie={<Pill tone="rojo" dot>{num0(huecos.length)} platos sin listar</Pill>} />
        <Kpi icono="€" tono="ambar" label="Margen regalado" valor={eur0(fugaTotal)}
          pie={<Pill tone="ambar" dot>{num0(descuadres.length)} platos mal tarifados</Pill>} />
        {cobertura.map(c => (
          <Kpi key={c.id}
            icono={c.pct >= 90 ? '✓' : '!'}
            tono={c.pct >= 90 ? 'verde' : c.pct >= 60 ? 'ambar' : 'rojo'}
            label={`Carta en ${c.label}`}
            valor={pct1(c.pct)}
            pie={<Pill tone={c.pct >= 90 ? 'verde' : 'rojo'} dot>{num0(c.n)} de {num0(filas.length)} platos</Pill>} />
        ))}
      </KpiGrid>

      <Card>
        <CardHead
          title={tab === 'huecos' ? 'Platos que faltan en alguna plataforma' : 'El mismo plato a precios distintos'}
          sub={tab === 'huecos'
            ? 'Ordenados por lo que estimo que dejas de ingresar. Empieza por arriba.'
            : 'Las tres cobran el mismo 30%. Si el precio no es el mismo, es un descuido.'}
          right={
            <div style={{ display: 'flex', gap: 4 }}>
              {([['huecos', `Huecos (${huecos.length})`], ['precios', `Precios (${descuadres.length})`]] as const).map(([id, label]) => {
                const on = id === tab
                return (
                  <button key={id} onClick={() => setTab(id as Tab)}
                    style={{
                      padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                      border: `1px solid ${on ? C.rojo : C.line}`,
                      background: on ? C.rojoSoft : C.card,
                      color: on ? C.rojoSem : C.gris,
                      fontFamily: "'Nunito', sans-serif", fontSize: 11.5, fontWeight: 900,
                    }}>{label}</button>
                )
              })}
            </div>
          }
        />

        {tab === 'huecos' ? (
          huecos.length === 0 ? <Vacio>Todos los platos están en las tres plataformas.</Vacio> : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 30 }}>#</th>
                    <th>Plato</th>
                    <th className="r">Precio</th>
                    <th>Dónde hay que darlo de alta</th>
                    <th>Podrías ingresar</th>
                  </tr>
                </thead>
                <tbody>
                  {huecos.slice(0, 60).map((h, i) => (
                    <tr key={h.f.plato_norm}>
                      <td className="slnum" style={{ color: C.grisCl, fontSize: 11 }}>{i + 1}</td>
                      <td style={{ maxWidth: 300 }}>{h.f.plato}</td>
                      <td className="r slnum">{h.f.precio_ref ? eur2(Number(h.f.precio_ref)) : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {h.falta.map(c => <Pill key={c.id} tone="rojo" dot>{c.label}</Pill>)}
                        </div>
                      </td>
                      <td style={{ minWidth: 130 }}>
                        <span className="slnum">{eur0(h.potencial)}</span>
                        <InBar pct={(h.potencial / maxPotencial) * 100} color={C.rojo} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {huecos.length > 60 && <Nota tono="blu">Se muestran los 60 de más impacto de {num0(huecos.length)}.</Nota>}
            </div>
          )
        ) : (
          descuadres.length === 0 ? <Vacio>Los precios están alineados entre plataformas.</Vacio> : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 30 }}>#</th>
                    <th>Plato</th>
                    <th className="r">Uber</th>
                    <th className="r">Glovo</th>
                    <th className="r">Just Eat</th>
                    <th>Qué hacer</th>
                    <th className="r">Recuperas</th>
                  </tr>
                </thead>
                <tbody>
                  {descuadres.slice(0, 60).map((d, i) => (
                    <tr key={d.f.plato_norm}>
                      <td className="slnum" style={{ color: C.grisCl, fontSize: 11 }}>{i + 1}</td>
                      <td style={{ maxWidth: 260 }}>{d.f.plato}</td>
                      {CANALES.map(c => {
                        const p = precioDe(d.f, c.id)
                        const esMin = p != null && Number(p) === d.min.p
                        return (
                          <td key={c.id} className="r slnum"
                            style={{ color: p == null ? C.grisCl : esMin ? C.rojoSem : C.ink,
                                     fontWeight: esMin ? 900 : 700 }}>
                            {p != null ? eur2(Number(p)) : '—'}
                          </td>
                        )
                      })}
                      <td style={{ fontSize: 12, fontWeight: 800 }}>
                        Sube <b>{d.min.c.label}</b> a {eur2(d.max.p)}
                      </td>
                      <td className="r slnum">{eur0(d.fuga)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {descuadres.length > 60 && <Nota tono="blu">Se muestran los 60 de más impacto de {num0(descuadres.length)}.</Nota>}
            </div>
          )
        )}

        <Nota tono="ambar">
          Los precios de esta pantalla son los <b>reales a los que se ha vendido</b> cada plato en cada plataforma,
          no los que figuran en la carta. Si no cuadran con lo que tú pusiste, es que hay promociones activas
          comiéndose el precio.
        </Nota>

        <Nota tono="blu">
          Los cambios hay que hacerlos en el panel de cada plataforma: ninguna de las tres deja que el ERP
          les escriba la carta. Esta pantalla te dice qué tocar y en qué orden, para que no pierdas tiempo.
        </Nota>
      </Card>
    </div>
  )
}
