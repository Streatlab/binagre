import { BLANCO } from '@/styles/neobrutal'
/**
 * CostePlato — A2 + A4 · Enlaza cada plato que vendes con su receta costeada,
 * y limpia los platos duplicados.
 *
 * A2 · Sin receta enlazada no hay coste, y sin coste no hay margen. El problema
 * de fondo no es enlazar: es que faltan recetas. Por eso la lista va ordenada
 * por EUROS con el % acumulado, para convertir "escandalla 435 platos" en
 * "escandalla estos 28 y ya cubres la mitad".
 *
 * A4 · El mismo plato escrito distinto contaba como dos, se comía dos veces la
 * misma receta y partía las ventas. Los idénticos ya se han fusionado solos; los
 * dudosos se deciden aquí abajo.
 *
 * Estilo: Ley Visual SL v2.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  C, Card, CardHead, Hero, HeroPill, Kpi, KpiGrid, Pill, Nota, Vacio, Atencion, InBar,
  eur0, eur2, num0, pct1,
} from '@/components/panel/sl/uiSL'

interface Fila {
  id: number
  plato_norm: string
  plato_muestra: string | null
  receta_id: string | null
  origen: string
  confianza: number | null
  euros: number
  unidades: number
}
interface Receta { id: string; nombre: string; coste_rac: number | null }
interface Dup {
  id: number
  plato_a: string
  plato_b: string
  euros_a: number
  euros_b: number
  parecido: number
  decision: string
}

type Filtro = 'sin_receta' | 'sugerido' | 'listo'

const FILTROS: Array<{ id: Filtro; label: string }> = [
  { id: 'sin_receta', label: 'Sin receta' },
  { id: 'sugerido', label: 'Sugeridas por confirmar' },
  { id: 'listo', label: 'Ya enlazados' },
]

export default function CostePlato() {
  const [filas, setFilas] = useState<Fila[]>([])
  const [recetas, setRecetas] = useState<Receta[]>([])
  const [dups, setDups] = useState<Dup[]>([])
  const [filtro, setFiltro] = useState<Filtro>('sin_receta')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [{ data: dic }, { data: rec }, { data: dup }] = await Promise.all([
      supabase.from('mapeo_plato_receta').select('*').order('euros', { ascending: false }),
      supabase.from('recetas').select('id, nombre, coste_rac').order('nombre'),
      supabase.from('platos_duplicados').select('*').eq('decision', 'pendiente').order('euros_a', { ascending: false }),
    ])
    setFilas((dic ?? []) as Fila[])
    setRecetas((rec ?? []) as Receta[])
    setDups((dup ?? []) as Dup[])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const enlazar = useCallback(async (fila: Fila, recetaId: string) => {
    setGuardando(fila.plato_norm)
    await supabase.from('mapeo_plato_receta').update({
      receta_id: recetaId || null,
      origen: recetaId ? 'manual' : 'pendiente',
      confianza: recetaId ? 1 : null,
      updated_at: new Date().toISOString(),
    }).eq('id', fila.id)
    setGuardando(null)
    await cargar()
  }, [cargar])

  const confirmarSugerencias = useCallback(async () => {
    setGuardando('todas')
    await supabase.from('mapeo_plato_receta')
      .update({ origen: 'manual', confianza: 1, updated_at: new Date().toISOString() })
      .eq('origen', 'sugerido').not('receta_id', 'is', null)
    setGuardando(null)
    setAviso('Sugerencias confirmadas. Esos platos ya tienen coste.')
    await cargar()
  }, [cargar])

  /* ── A4 · fusionar o separar duplicados ── */
  const fusionar = useCallback(async (d: Dup, canonico: string, duplicado: string) => {
    setGuardando(`dup-${d.id}`)
    await supabase.rpc('unificar_plato', { canonico, duplicado })
    await supabase.from('platos_duplicados')
      .update({ decision: 'mismo', canonico, updated_at: new Date().toISOString() })
      .eq('id', d.id)
    setGuardando(null)
    setAviso(`Unificados. Todo el histórico pasa a llamarse "${canonico}".`)
    await cargar()
  }, [cargar])

  const separar = useCallback(async (d: Dup) => {
    setGuardando(`dup-${d.id}`)
    await supabase.from('platos_duplicados')
      .update({ decision: 'distinto', updated_at: new Date().toISOString() })
      .eq('id', d.id)
    setGuardando(null)
    await cargar()
  }, [cargar])

  /* ── Métricas ── */
  const stats = useMemo(() => {
    const s = { conReceta: 0, sugeridas: 0, sinReceta: 0, eCon: 0, eSug: 0, eSin: 0, total: 0 }
    for (const f of filas) {
      const e = Number(f.euros) || 0
      s.total += e
      if (!f.receta_id) { s.sinReceta++; s.eSin += e }
      else if (f.origen === 'sugerido') { s.sugeridas++; s.eSug += e }
      else { s.conReceta++; s.eCon += e }
    }
    return s
  }, [filas])

  const pctCubierto = stats.total > 0 ? (stats.eCon / stats.total) * 100 : 0

  const lista = useMemo(() => {
    const base = filas.filter(f => {
      if (filtro === 'sin_receta') return !f.receta_id
      if (filtro === 'sugerido') return !!f.receta_id && f.origen === 'sugerido'
      return !!f.receta_id && f.origen !== 'sugerido'
    })
    const total = base.reduce((s, f) => s + (Number(f.euros) || 0), 0) || 1
    let ac = 0
    return base.map(f => {
      ac += Number(f.euros) || 0
      return { ...f, acumulado: (ac / total) * 100 }
    })
  }, [filas, filtro])

  const maxEuros = lista.length > 0 ? Number(lista[0].euros) || 1 : 1

  /* ── Tanda 8: nombre madre (recetas.nombre) siempre que ya haya enlace; el nombre
   *  crudo de plataforma queda como detalle secundario. Sin enlace no hay madre —
   *  ahí el nombre crudo sigue siendo el dato principal (es lo que hay que identificar). ── */
  const nombrePorId = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of recetas) m.set(r.id, r.nombre)
    return m
  }, [recetas])

  const cuantasPara = useCallback((objetivo: number) => {
    const sin = filas.filter(f => !f.receta_id).sort((a, b) => Number(b.euros) - Number(a.euros))
    const totalSin = sin.reduce((s, f) => s + Number(f.euros), 0) || 1
    let ac = 0
    for (let i = 0; i < sin.length; i++) {
      ac += Number(sin[i].euros)
      if ((ac / totalSin) * 100 >= objetivo) return i + 1
    }
    return sin.length
  }, [filas])

  const para50 = useMemo(() => cuantasPara(50), [cuantasPara])
  const para80 = useMemo(() => cuantasPara(80), [cuantasPara])

  const eurosDuplicados = useMemo(
    () => dups.reduce((s, d) => s + Math.min(Number(d.euros_a), Number(d.euros_b)), 0),
    [dups])

  if (cargando) {
    return <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}><Card><Vacio>Cargando platos y recetas…</Vacio></Card></div>
  }

  return (
    <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px' }}>Coste por plato</div>
        <div style={{ fontSize: 12, color: C.grisCl, fontWeight: 700, marginTop: 2 }}>
          Enlaza lo que vendes con lo que cuesta. Sin esto no hay margen real.
        </div>
      </div>

      <Hero
        eyebrow="FACTURACIÓN CON COSTE CONOCIDO"
        titular={pctCubierto >= 80 ? 'Ya sabes lo que te cuesta casi todo lo que vendes' : 'No sabes lo que te cuesta casi nada de lo que vendes'}
        valor={pct1(pctCubierto)}
        sub={`${eur0(stats.eCon)} con coste · ${eur0(stats.eSin + stats.eSug)} sin coste conocido`}
        objetivo={{ pct: pctCubierto, label: 'CON COSTE' }}
        right={
          <>
            <HeroPill solid>{num0(stats.conReceta)} platos enlazados</HeroPill>
            <HeroPill>{num0(stats.sinReceta)} sin receta</HeroPill>
          </>
        }
      />

      <Atencion tono="ambar" cifra={`${para50} recetas`}>
        <b>No hace falta escandallar los {num0(stats.sinReceta)} platos.</b> Con las <b>{para50}</b> primeras de la lista cubres
        la mitad de la facturación que hoy va a ciegas. Con <b>{para80}</b> cubres el 80%. Están ordenadas de más euros a menos:
        empieza por arriba y para cuando quieras.
      </Atencion>

      {stats.sugeridas > 0 && (
        <Atencion
          tono="blu"
          cifra={eur0(stats.eSug)}
          accion={guardando === 'todas' ? 'Aplicando…' : `Confirmar las ${stats.sugeridas}`}
          onAccion={confirmarSugerencias}
        >
          <b>{stats.sugeridas} platos con receta sugerida.</b> El nombre se parece mucho al de una receta que ya tienes. Repásalos y confírmalos.
        </Atencion>
      )}

      {aviso && <Nota tono="verde">{aviso}</Nota>}

      <KpiGrid>
        <Kpi icono="✓" tono="verde" label="Con coste" valor={pct1(pctCubierto)}
          pie={<Pill tone="verde" dot>{eur0(stats.eCon)} de facturación</Pill>} />
        <Kpi icono="?" tono="blu" label="Sugeridas" valor={num0(stats.sugeridas)}
          pie={<Pill tone="blu" dot>{eur0(stats.eSug)} en juego</Pill>} />
        <Kpi icono="✕" tono="rojo" label="Sin receta" valor={num0(stats.sinReceta)}
          pie={<Pill tone="rojo" dot>{eur0(stats.eSin)} sin coste</Pill>} />
        <Kpi icono="◈" tono="ambar" label="Recetas para el 80%" valor={num0(para80)}
          pie={<Pill tone="ambar" dot>de {num0(stats.sinReceta)} platos</Pill>} />
      </KpiGrid>

      {/* ── A4 · Platos duplicados ── */}
      {dups.length > 0 && (
        <Card>
          <CardHead
            title="Platos que parecen el mismo"
            sub="Si son el mismo, se juntan las ventas y una sola receta cubre los dos"
            right={<Pill tone="ambar">{dups.length} por decidir · {eur0(eurosDuplicados)}</Pill>}
          />
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Se parecen</th>
                  <th className="r">Factura</th>
                  <th className="r">Parecido</th>
                  <th>¿Son el mismo plato?</th>
                </tr>
              </thead>
              <tbody>
                {dups.slice(0, 50).map(d => {
                  const busy = guardando === `dup-${d.id}`
                  const ea = Number(d.euros_a), eb = Number(d.euros_b)
                  const canon = ea >= eb ? d.plato_a : d.plato_b
                  const otro = ea >= eb ? d.plato_b : d.plato_a
                  return (
                    <tr key={d.id}>
                      <td style={{ maxWidth: 380 }}>
                        <div>{d.plato_a}</div>
                        <div style={{ color: C.grisCl, fontWeight: 700, fontSize: 12, marginTop: 2 }}>{d.plato_b}</div>
                      </td>
                      <td className="r">
                        <div className="slnum">{eur0(ea)}</div>
                        <div className="slnum" style={{ color: C.grisCl, fontSize: 12 }}>{eur0(eb)}</div>
                      </td>
                      <td className="r">
                        <Pill tone={Number(d.parecido) >= 0.85 ? 'ambar' : 'neutro'}>
                          {Math.round(Number(d.parecido) * 100)}%
                        </Pill>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            disabled={busy}
                            onClick={() => fusionar(d, canon, otro)}
                            style={{
                              padding: '7px 13px', borderRadius: 999, cursor: 'pointer',
                              border: 'none', background: C.verde, color: BLANCO,
                              fontFamily: "'Nunito', sans-serif", fontSize: 11.5, fontWeight: 900,
                            }}
                          >{busy ? 'Uniendo…' : 'Sí, es el mismo'}</button>
                          <button
                            disabled={busy}
                            onClick={() => separar(d)}
                            style={{
                              padding: '7px 13px', borderRadius: 999, cursor: 'pointer',
                              border: `1px solid ${C.line}`, background: C.card, color: C.gris,
                              fontFamily: "'Nunito', sans-serif", fontSize: 11.5, fontWeight: 900,
                            }}
                          >Son distintos</button>
                        </div>
                        <div style={{ fontSize: 11, color: C.grisCl, fontWeight: 700, marginTop: 4 }}>
                          Se quedaría con el nombre: {canon}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Nota tono="ambar">
            Ojo con los que solo cambian una talla o un ingrediente (por ejemplo Talla XL y Talla XXL): esos <b>no</b> son el mismo plato.
          </Nota>
        </Card>
      )}

      <Card>
        <CardHead
          title="Platos ordenados por lo que facturan"
          sub="La columna de la derecha dice cuánto llevas cubierto si escandallas hasta ahí"
          right={
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {FILTROS.map(f => {
                const on = f.id === filtro
                return (
                  <button key={f.id} onClick={() => setFiltro(f.id)}
                    style={{
                      padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                      border: `1px solid ${on ? C.rojo : C.line}`,
                      background: on ? C.rojoSoft : C.card,
                      color: on ? C.rojoSem : C.gris,
                      fontFamily: "'Nunito', sans-serif", fontSize: 11.5, fontWeight: 900,
                    }}>{f.label}</button>
                )
              })}
            </div>
          }
        />

        {lista.length === 0 ? (
          <Vacio>Nada en esta lista.</Vacio>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 30 }}>#</th>
                  <th>Plato</th>
                  <th className="r">Uds</th>
                  <th>Factura</th>
                  <th>Receta</th>
                  <th className="r">Cubierto</th>
                </tr>
              </thead>
              <tbody>
                {lista.slice(0, 120).map((f, i) => (
                  <tr key={f.id}>
                    <td className="slnum" style={{ color: C.grisCl, fontSize: 11 }}>{i + 1}</td>
                    <td style={{ maxWidth: 320 }}>
                      {f.receta_id && nombrePorId.get(f.receta_id) ? (
                        <>
                          <div>{nombrePorId.get(f.receta_id)}</div>
                          <div style={{ fontSize: 11, color: C.grisCl }}>{f.plato_muestra ?? f.plato_norm}</div>
                        </>
                      ) : (
                        f.plato_muestra ?? f.plato_norm
                      )}
                    </td>
                    <td className="r slnum">{num0(Number(f.unidades) || 0)}</td>
                    <td style={{ minWidth: 120 }}>
                      <span className="slnum">{eur0(Number(f.euros) || 0)}</span>
                      <InBar pct={(Number(f.euros) / maxEuros) * 100} color={C.rojo} />
                    </td>
                    <td>
                      <select
                        value={f.receta_id ?? ''}
                        disabled={guardando === f.plato_norm}
                        onChange={e => enlazar(f, e.target.value)}
                        style={{
                          padding: '7px 10px', borderRadius: 999, minWidth: 220,
                          border: `1px solid ${f.receta_id ? C.line : C.rojoSem}`,
                          background: C.card, color: f.receta_id ? C.ink : C.rojoSem,
                          fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        <option value="">— Falta la receta —</option>
                        {recetas.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.nombre}{r.coste_rac != null ? ` · ${eur2(Number(r.coste_rac))}/ración` : ' · sin coste'}
                          </option>
                        ))}
                      </select>
                      {f.origen === 'sugerido' && (
                        <div style={{ marginTop: 4 }}>
                          <Pill tone="blu" dot>Se parece · {Math.round((f.confianza ?? 0) * 100)}%</Pill>
                        </div>
                      )}
                      {f.origen === 'carta' && (
                        <div style={{ marginTop: 4 }}><Pill tone="verde" dot>Venía de la carta</Pill></div>
                      )}
                    </td>
                    <td className="r slnum" style={{ color: f.acumulado >= 80 ? C.grisCl : C.rojoSem }}>
                      {pct1(f.acumulado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lista.length > 120 && (
              <Nota tono="blu">Se muestran los 120 que más facturan de {num0(lista.length)}.</Nota>
            )}
          </div>
        )}

        <Nota tono="ambar">
          Si un plato no tiene receta, no aparece en el desplegable. Créala primero en Cocina → Recetas y luego vuelve aquí a enlazarla.
        </Nota>
      </Card>
    </div>
  )
}
