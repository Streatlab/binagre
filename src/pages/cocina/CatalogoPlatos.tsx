/**
 * CatalogoPlatos — El plato de verdad, no el nombre que le pone cada plataforma.
 *
 * El problema: el mismo plato se llama distinto en cada sitio. "Cachopo de
 * ternera", "Cachopo especial de ternera con queso y jamón" y "Cachopo de
 * ternera con queso, jamón serrano y Guarnición incluida" son EL MISMO CACHOPO.
 * El ERP los contaba como tres platos: tres rankings, tres recetas, tres
 * escandallos. Y las ventas partidas en tres trozos.
 *
 * Esto agrupa todos los nombres bajo un plato maestro. Resultado: 402 nombres
 * se quedan en 222 platos reales (+ 149 extras y bebidas que no llevan receta).
 *
 * Consecuencia directa: bastan 21 recetas para cubrir la mitad de la
 * facturación, no 27. Y 58 para el 80%, no 71.
 *
 * La máquina agrupa, pero se puede equivocar. Aquí se separa lo que no cuadre.
 *
 * Estilo: Ley Visual SL v2.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  C, Card, CardHead, Hero, HeroPill, Kpi, KpiGrid, Pill, Nota, Vacio, Atencion, InBar,
  eur0, num0, pct1,
} from '@/components/panel/sl/uiSL'

interface Maestro {
  id: number
  nombre: string
  euros: number
  unidades: number
  n_variantes: number
  receta_id: string | null
  es_extra: boolean
}
interface Alias {
  id: number
  alias: string
  alias_norm: string
  maestro_id: number
  canales: string[] | null
  euros: number
  confianza: number | null
}

type Filtro = 'agrupados' | 'sin_receta' | 'extras'

export default function CatalogoPlatos() {
  const [maestros, setMaestros] = useState<Maestro[]>([])
  const [alias, setAlias] = useState<Alias[]>([])
  const [filtro, setFiltro] = useState<Filtro>('agrupados')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState<number | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [{ data: m }, { data: a }] = await Promise.all([
      supabase.from('platos_maestros').select('*').order('euros', { ascending: false }),
      supabase.from('platos_alias').select('*').order('euros', { ascending: false }),
    ])
    setMaestros((m ?? []) as Maestro[])
    setAlias((a ?? []) as Alias[])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  /* Separar un nombre de su grupo: se convierte en plato propio. */
  const separar = useCallback(async (al: Alias) => {
    setGuardando(al.id)
    await supabase.rpc('separar_alias', { p_alias_id: al.id })
    setGuardando(null)
    setAviso(`"${al.alias}" pasa a ser un plato aparte.`)
    await cargar()
  }, [cargar])

  const aliasDe = useCallback(
    (mid: number) => alias.filter(a => a.maestro_id === mid).sort((x, y) => Number(y.euros) - Number(x.euros)),
    [alias])

  const stats = useMemo(() => {
    const platos = maestros.filter(m => !m.es_extra)
    const extras = maestros.filter(m => m.es_extra)
    const conReceta = platos.filter(m => m.receta_id).length
    const eurPlatos = platos.reduce((s, m) => s + Number(m.euros), 0)
    const eurCon = platos.filter(m => m.receta_id).reduce((s, m) => s + Number(m.euros), 0)
    return {
      nombres: alias.length,
      platos: platos.length,
      extras: extras.length,
      agrupados: platos.filter(m => m.n_variantes > 1).length,
      conReceta,
      sinReceta: platos.length - conReceta,
      pctCoste: eurPlatos > 0 ? (eurCon / eurPlatos) * 100 : 0,
      eurPlatos,
    }
  }, [maestros, alias])

  /* Cuántas recetas para cubrir X% */
  const cuantasPara = useCallback((objetivo: number) => {
    const sin = maestros
      .filter(m => !m.es_extra && !m.receta_id && Number(m.euros) > 0)
      .sort((a, b) => Number(b.euros) - Number(a.euros))
    const total = sin.reduce((s, m) => s + Number(m.euros), 0) || 1
    let ac = 0
    for (let i = 0; i < sin.length; i++) {
      ac += Number(sin[i].euros)
      if ((ac / total) * 100 >= objetivo) return i + 1
    }
    return sin.length
  }, [maestros])

  const para50 = useMemo(() => cuantasPara(50), [cuantasPara])
  const para80 = useMemo(() => cuantasPara(80), [cuantasPara])

  const lista = useMemo(() => {
    if (filtro === 'extras') return maestros.filter(m => m.es_extra)
    if (filtro === 'sin_receta') return maestros.filter(m => !m.es_extra && !m.receta_id && Number(m.euros) > 0)
    return maestros.filter(m => !m.es_extra && m.n_variantes > 1)
  }, [maestros, filtro])

  const maxEuros = lista.length > 0 ? Number(lista[0].euros) || 1 : 1

  if (cargando) {
    return <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}><Card><Vacio>Cargando catálogo…</Vacio></Card></div>
  }

  return (
    <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px' }}>Catálogo de platos</div>
        <div style={{ fontSize: 12, color: C.grisCl, fontWeight: 700, marginTop: 2 }}>
          El plato de verdad, junte lo que junte cada plataforma para llamarlo.
        </div>
      </div>

      <Hero
        eyebrow="PLATOS DE VERDAD"
        titular={`${num0(stats.nombres)} nombres distintos son en realidad ${num0(stats.platos)} platos`}
        valor={num0(stats.platos)}
        sub={`Y otros ${num0(stats.extras)} son bebidas, extras y modificadores, que no llevan receta`}
        right={
          <>
            <HeroPill solid>{num0(stats.agrupados)} platos con varios nombres</HeroPill>
            <HeroPill>{num0(stats.conReceta)} ya tienen receta</HeroPill>
          </>
        }
      />

      <Atencion tono="verde" cifra={`${para50} recetas`}>
        <b>Esto te quita trabajo de encima.</b> Al juntar los nombres, el mismo cachopo deja de contar como tres platos.
        Ahora bastan <b>{para50}</b> recetas para cubrir la mitad de lo que facturas, y <b>{para80}</b> para el 80%.
        Y las {num0(stats.extras)} bebidas y extras no necesitan ninguna.
      </Atencion>

      {aviso && <Nota tono="blu">{aviso}</Nota>}

      <KpiGrid>
        <Kpi icono="◈" tono="verde" label="Platos reales" valor={num0(stats.platos)}
          pie={<Pill tone="verde" dot>de {num0(stats.nombres)} nombres</Pill>} />
        <Kpi icono="⊕" tono="blu" label="Con varios nombres" valor={num0(stats.agrupados)}
          pie={<Pill tone="blu" dot>ventas ya juntas</Pill>} />
        <Kpi icono="✕" tono="rojo" label="Sin receta" valor={num0(stats.sinReceta)}
          pie={<Pill tone="rojo" dot>{pct1(stats.pctCoste)} con coste</Pill>} />
        <Kpi icono="◷" tono="ambar" label="Recetas para el 80%" valor={num0(para80)}
          pie={<Pill tone="ambar" dot>empieza por arriba</Pill>} />
      </KpiGrid>

      <Card>
        <CardHead
          title={
            filtro === 'agrupados' ? 'Platos que tenían varios nombres'
            : filtro === 'sin_receta' ? 'Platos que necesitan receta'
            : 'Bebidas, extras y modificadores'
          }
          sub={
            filtro === 'agrupados' ? 'Revisa que la máquina no haya juntado dos platos distintos'
            : filtro === 'sin_receta' ? 'Ordenados por lo que facturan. Haz las de arriba y para cuando quieras.'
            : 'No llevan receta. Se quedan fuera del escandallo.'
          }
          right={
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {([
                ['agrupados', `Agrupados (${stats.agrupados})`],
                ['sin_receta', `Sin receta (${stats.sinReceta})`],
                ['extras', `Extras (${stats.extras})`],
              ] as const).map(([id, label]) => {
                const on = id === filtro
                return (
                  <button key={id} onClick={() => setFiltro(id as Filtro)}
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

        {lista.length === 0 ? <Vacio>Nada en esta lista.</Vacio> : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 30 }}>#</th>
                  <th>Plato</th>
                  <th className="r">Uds</th>
                  <th>Factura</th>
                  {filtro === 'agrupados' && <th>Nombres que lleva dentro</th>}
                  {filtro !== 'agrupados' && <th className="r">Receta</th>}
                </tr>
              </thead>
              <tbody>
                {lista.slice(0, 100).map((m, i) => (
                  <tr key={m.id}>
                    <td className="slnum" style={{ color: C.grisCl, fontSize: 11 }}>{i + 1}</td>
                    <td style={{ maxWidth: 280, fontWeight: 800 }}>{m.nombre}</td>
                    <td className="r slnum">{num0(Number(m.unidades) || 0)}</td>
                    <td style={{ minWidth: 110 }}>
                      <span className="slnum">{eur0(Number(m.euros) || 0)}</span>
                      <InBar pct={(Number(m.euros) / maxEuros) * 100} color={C.rojo} />
                    </td>

                    {filtro === 'agrupados' ? (
                      <td>
                        {aliasDe(m.id).map(a => {
                          const esCanon = a.alias === m.nombre
                          return (
                            <div key={a.id} style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '3px 0', fontSize: 12,
                              color: esCanon ? C.ink : C.gris,
                            }}>
                              <span style={{ flex: 1 }}>
                                {esCanon && <b>▸ </b>}{a.alias}
                                <span className="slnum" style={{ color: C.grisCl, marginLeft: 6, fontSize: 11 }}>
                                  {eur0(Number(a.euros))}
                                </span>
                              </span>
                              {!esCanon && (
                                <button
                                  disabled={guardando === a.id}
                                  onClick={() => separar(a)}
                                  style={{
                                    padding: '3px 9px', borderRadius: 999, cursor: 'pointer',
                                    border: `1px solid ${C.line}`, background: C.card, color: C.gris,
                                    fontFamily: "'Nunito', sans-serif", fontSize: 10.5, fontWeight: 900,
                                    whiteSpace: 'nowrap',
                                  }}>
                                  {guardando === a.id ? '…' : 'No es el mismo'}
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </td>
                    ) : (
                      <td className="r">
                        {m.receta_id
                          ? <Pill tone="verde" dot>Tiene receta</Pill>
                          : <Pill tone="rojo" dot>Falta</Pill>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {lista.length > 100 && <Nota tono="blu">Se muestran los 100 que más facturan de {num0(lista.length)}.</Nota>}
          </div>
        )}

        <Nota tono="ambar">
          Si ves dos platos que <b>no</b> son el mismo metidos en el mismo grupo, pulsa "No es el mismo" y se separan.
          Las ventas se recolocan solas.
        </Nota>
      </Card>
    </div>
  )
}
