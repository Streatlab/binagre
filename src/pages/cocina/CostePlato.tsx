/**
 * CostePlato — A2 · Enlaza cada plato que vendes con su receta costeada.
 *
 * Sin esto el ERP no sabe cuánto cuesta nada: hoy solo el 2,2% de la
 * facturación tiene coste conocido. Y el problema de fondo no es enlazar:
 * es que hay 33 recetas para 512 platos. Faltan recetas.
 *
 * Por eso esta pantalla ordena los platos por EUROS, no por nombre, y enseña
 * el % acumulado: para que se vea que con las 25 primeras recetas se cubre el
 * 45% de la facturación, y no haya que hacer 500.
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

type Filtro = 'sin_receta' | 'sugerido' | 'listo'

const FILTROS: Array<{ id: Filtro; label: string }> = [
  { id: 'sin_receta', label: 'Sin receta' },
  { id: 'sugerido', label: 'Sugeridas por confirmar' },
  { id: 'listo', label: 'Ya enlazados' },
]

export default function CostePlato() {
  const [filas, setFilas] = useState<Fila[]>([])
  const [recetas, setRecetas] = useState<Receta[]>([])
  const [filtro, setFiltro] = useState<Filtro>('sin_receta')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [{ data: dic }, { data: rec }] = await Promise.all([
      supabase.from('mapeo_plato_receta').select('*').order('euros', { ascending: false }),
      supabase.from('recetas').select('id, nombre, coste_rac').order('nombre'),
    ])
    setFilas((dic ?? []) as Fila[])
    setRecetas((rec ?? []) as Receta[])
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

  /* ── Lista filtrada, con % acumulado sobre lo que falta ── */
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

  /* ── Cuántas recetas hacen falta para cubrir el 50 / 80% ── */
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

  if (cargando) {
    return <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}><Card><Vacio>Cargando platos y recetas…</Vacio></Card></div>
  }

  return (
    <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px' }}>Coste por plato</div>
        <div style={{ fontSize: 12, color: C.grisCl, fontWeight: 700, marginTop: 2 }}>
          A2 · Enlaza lo que vendes con lo que cuesta. Sin esto no hay margen real.
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
                    <td style={{ maxWidth: 320 }}>{f.plato_muestra ?? f.plato_norm}</td>
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
