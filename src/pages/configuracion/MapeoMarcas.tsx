/**
 * MapeoMarcas — A1 · Asigna marca a la venta ciega de Glovo y Just Eat.
 *
 * Glovo y Just Eat entran por Sinqro sin marca: más de la mitad de la
 * facturación es ciega. Uber sí trae marca. Esta pantalla usa el diccionario
 * `mapeo_plato_marca`, ya sembrado automáticamente:
 *   · exacto   → el plato existe igual en Uber con una única marca. Confianza total.
 *   · sugerido → se parece mucho a un plato de Uber. Hay que confirmarlo.
 *   · manual   → lo has decidido tú.
 *
 * Estilo: Ley Visual SL v2.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  C, Card, CardHead, Hero, HeroPill, Kpi, KpiGrid, Pill, Nota, Vacio, Atencion,
  eur0, num0, pct1,
} from '@/components/panel/sl/uiSL'

interface Fila {
  id: number
  plato_norm: string
  plato_muestra: string | null
  marca: string | null
  origen: string
  confianza: number | null
  euros: number
}

type Filtro = 'pendiente' | 'sugerido' | 'listo'

const FILTROS: Array<{ id: Filtro; label: string }> = [
  { id: 'pendiente', label: 'Sin asignar' },
  { id: 'sugerido', label: 'Sugeridos por confirmar' },
  { id: 'listo', label: 'Ya asignados' },
]

export default function MapeoMarcas() {
  const [filas, setFilas] = useState<Fila[]>([])
  const [marcas, setMarcas] = useState<string[]>([])
  const [filtro, setFiltro] = useState<Filtro>('sugerido')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [visible, setVisible] = useState({ conMarca: 0, ciego: 0 })

  /* ── Carga ── */
  const cargar = useCallback(async () => {
    setCargando(true)

    const [{ data: dic }, { data: mk }, { data: tot }] = await Promise.all([
      supabase.from('mapeo_plato_marca').select('*').order('euros', { ascending: false }),
      supabase.from('ventas_plato').select('marca').eq('canal', 'uber').not('marca', 'is', null),
      supabase.rpc('aplicar_mapeo_marcas', { incluir_sugeridas: false }),
    ])

    setFilas((dic ?? []) as Fila[])

    const set = new Set<string>()
    for (const r of (mk ?? []) as Array<{ marca: string | null }>) {
      if (r.marca && r.marca.trim()) set.add(r.marca.trim())
    }
    setMarcas([...set].sort((a, b) => a.localeCompare(b, 'es')))

    const t = Array.isArray(tot) ? tot[0] : tot
    if (t) setVisible({ conMarca: Number(t.euros_visibles) || 0, ciego: Number(t.euros_ciegos) || 0 })

    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  /* ── Guardar una asignación ── */
  const asignar = useCallback(async (fila: Fila, marca: string) => {
    setGuardando(fila.plato_norm)
    await supabase
      .from('mapeo_plato_marca')
      .update({ marca: marca || null, origen: marca ? 'manual' : 'pendiente', confianza: marca ? 1 : null, updated_at: new Date().toISOString() })
      .eq('id', fila.id)
    await supabase.rpc('aplicar_mapeo_marcas', { incluir_sugeridas: false })
    setGuardando(null)
    await cargar()
  }, [cargar])

  /* ── Confirmar todas las sugerencias de golpe ── */
  const confirmarSugerencias = useCallback(async () => {
    setGuardando('todas')
    await supabase
      .from('mapeo_plato_marca')
      .update({ origen: 'manual', confianza: 1, updated_at: new Date().toISOString() })
      .eq('origen', 'sugerido')
      .not('marca', 'is', null)
    await supabase.rpc('aplicar_mapeo_marcas', { incluir_sugeridas: false })
    setGuardando(null)
    setAviso('Sugerencias confirmadas y aplicadas a la venta.')
    await cargar()
  }, [cargar])

  /* ── Métricas ── */
  const stats = useMemo(() => {
    const s = { pendiente: 0, sugerido: 0, listo: 0, ePend: 0, eSug: 0, eListo: 0 }
    for (const f of filas) {
      const e = Number(f.euros) || 0
      if (!f.marca) { s.pendiente++; s.ePend += e }
      else if (f.origen === 'sugerido') { s.sugerido++; s.eSug += e }
      else { s.listo++; s.eListo += e }
    }
    return s
  }, [filas])

  const totalCiego = stats.ePend + stats.eSug + stats.eListo
  const pctResuelto = totalCiego > 0 ? (stats.eListo / totalCiego) * 100 : 0
  const totalVenta = visible.conMarca + visible.ciego
  const pctVisible = totalVenta > 0 ? (visible.conMarca / totalVenta) * 100 : 0

  const lista = useMemo(() => filas.filter(f => {
    if (filtro === 'pendiente') return !f.marca
    if (filtro === 'sugerido') return !!f.marca && f.origen === 'sugerido'
    return !!f.marca && f.origen !== 'sugerido'
  }), [filas, filtro])

  if (cargando) {
    return <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}><Card><Vacio>Cargando el diccionario de platos…</Vacio></Card></div>
  }

  return (
    <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px' }}>Mapeo de marcas</div>
        <div style={{ fontSize: 12, color: C.grisCl, fontWeight: 700, marginTop: 2 }}>
          A1 · Glovo y Just Eat entran sin marca. Aquí se les pone.
        </div>
      </div>

      <Hero
        eyebrow="VENTA CON MARCA CONOCIDA"
        titular={pctVisible >= 99 ? 'Ya ves toda tu facturación por marca' : 'Todavía hay facturación que no sabes de qué marca es'}
        valor={pct1(pctVisible)}
        sub={`${eur0(visible.conMarca)} identificados · ${eur0(visible.ciego)} todavía ciegos`}
        objetivo={{ pct: pctVisible, label: 'VISIBLE' }}
        right={
          <>
            <HeroPill solid>{num0(stats.listo)} platos resueltos</HeroPill>
            <HeroPill>{num0(stats.pendiente + stats.sugerido)} por revisar</HeroPill>
          </>
        }
      />

      {stats.sugerido > 0 && (
        <Atencion
          tono="ambar"
          cifra={eur0(stats.eSug)}
          accion={guardando === 'todas' ? 'Aplicando…' : `Confirmar las ${stats.sugerido}`}
          onAccion={confirmarSugerencias}
        >
          <b>{stats.sugerido} platos con marca sugerida automáticamente.</b> Se parecen mucho a un plato de Uber que sí tiene marca.
          Repásalos y confírmalos: no toco la venta con una suposición sin que tú lo digas.
        </Atencion>
      )}

      {aviso && <Nota tono="verde">{aviso}</Nota>}

      <KpiGrid>
        <Kpi icono="✓" tono="verde" label="Resueltos" valor={num0(stats.listo)}
          pie={<Pill tone="verde" dot>{eur0(stats.eListo)} recuperados</Pill>} />
        <Kpi icono="?" tono="ambar" label="Sugeridos sin confirmar" valor={num0(stats.sugerido)}
          pie={<Pill tone="ambar" dot>{eur0(stats.eSug)} en juego</Pill>} />
        <Kpi icono="✕" tono="rojo" label="Sin asignar" valor={num0(stats.pendiente)}
          pie={<Pill tone="rojo" dot>{eur0(stats.ePend)} ciegos</Pill>} />
        <Kpi icono="◈" tono={pctResuelto >= 90 ? 'verde' : 'blu'} label="Avance del mapeo" valor={pct1(pctResuelto)}
          pie={<Pill tone="blu" dot>sobre {eur0(totalCiego)} de venta ciega</Pill>} />
      </KpiGrid>

      <Card>
        <CardHead
          title="Platos de Glovo y Just Eat"
          sub="Ordenados por euros: arriba lo que más pesa. Empieza por ahí."
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
          <Vacio>Nada en esta lista. Buena señal.</Vacio>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Plato</th>
                  <th className="r">Facturación ciega</th>
                  <th>Origen</th>
                  <th>Marca</th>
                </tr>
              </thead>
              <tbody>
                {lista.slice(0, 120).map(f => (
                  <tr key={f.id}>
                    <td style={{ maxWidth: 340 }}>
                      {f.plato_muestra ?? f.plato_norm}
                    </td>
                    <td className="r slnum">{eur0(Number(f.euros) || 0)}</td>
                    <td>
                      {f.origen === 'exacto'   && <Pill tone="verde" dot>Igual que en Uber</Pill>}
                      {f.origen === 'manual'   && <Pill tone="blu" dot>Lo dijiste tú</Pill>}
                      {f.origen === 'sugerido' && <Pill tone="ambar" dot>Se parece · {Math.round((f.confianza ?? 0) * 100)}%</Pill>}
                      {f.origen === 'pendiente' && <Pill tone="rojo" dot>Sin asignar</Pill>}
                    </td>
                    <td>
                      <select
                        value={f.marca ?? ''}
                        disabled={guardando === f.plato_norm}
                        onChange={e => asignar(f, e.target.value)}
                        style={{
                          padding: '7px 10px', borderRadius: 999, minWidth: 210,
                          border: `1px solid ${f.marca ? C.line : C.rojoSem}`,
                          background: C.card, color: f.marca ? C.ink : C.rojoSem,
                          fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        <option value="">— Elegir marca —</option>
                        {marcas.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lista.length > 120 && (
              <Nota tono="blu">
                Se muestran los 120 que más pesan de {num0(lista.length)}. Según los vayas cerrando aparecen los siguientes.
              </Nota>
            )}
          </div>
        )}

        <Nota tono="verde">
          Cada plato que asignas se aplica al momento a toda la venta histórica de ese plato. No hay que reimportar nada.
        </Nota>
      </Card>
    </div>
  )
}
