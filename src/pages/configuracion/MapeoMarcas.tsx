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
 * Estilo: Neobrutal (@/styles/neobrutal).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  OSW, LEX, INK, CREMA, GRIS, GRANATE, VERDE, AMA, AZUL, BLANCO,
  VERDE_S, AMA_S, ROSA_S, AZUL_S,
  SHADOW_MINI, d, pill,
} from '@/styles/neobrutal'
import RutaPantalla from '@/components/ui/RutaPantalla'
import { PantallaCantera, HeroCantera, Papel, Plancha, PlanchaCelda } from '@/components/kit/cantera'

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

const nf0 = (n: number) => Math.round(n).toLocaleString('es-ES', { useGrouping: true })
const eur0 = (n: number) => `${nf0(n)} €`
const pct1 = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

function Vacio({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 32, textAlign: 'center', color: GRIS, fontFamily: LEX, fontSize: 13, fontWeight: 600 }}>{children}</div>
}

function Nota({ tono = 'verde', children }: { tono?: 'verde' | 'rojo' | 'ambar' | 'blu'; children: React.ReactNode }) {
  const map = { verde: VERDE_S, rojo: ROSA_S, ambar: AMA_S, blu: AZUL_S } as const
  const borde = { verde: VERDE, rojo: GRANATE, ambar: AMA, blu: AZUL } as const
  return (
    <div style={{ marginTop: 14, padding: '11px 14px', background: map[tono], border: `2px solid ${borde[tono]}`, fontFamily: LEX, fontSize: 12.5, fontWeight: 600, color: INK, lineHeight: 1.5 }}>
      {children}
    </div>
  )
}

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
    return (
      <PantallaCantera>
        <Papel ceja={GRIS}><Vacio>Cargando el diccionario de platos…</Vacio></Papel>
      </PantallaCantera>
    )
  }

  const titular = pctVisible >= 99 ? 'Ya ves toda tu facturación por marca' : 'Todavía hay facturación que no sabes de qué marca es'
  const atencion = [
    `${nf0(stats.listo)} platos resueltos`,
    `${nf0(stats.pendiente + stats.sugerido)} por revisar`,
  ]

  return (
    <PantallaCantera>
      <RutaPantalla niveles={['Ajustes', 'Mapeo de Marcas']} subtitulo="A1 · Glovo y Just Eat entran sin marca. Aquí se les pone." />

      {/* Héroe: venta con marca conocida (área Papeleo · granate) */}
      <HeroCantera
        area="papeleo"
        titular={titular}
        etiquetaDato="Venta con marca conocida"
        cifra={pct1(pctVisible)}
        resumen={<>{eur0(visible.conMarca)} identificados · {eur0(visible.ciego)} todavía ciegos</>}
        atencion={atencion}
      />

      {stats.sugerido > 0 && (
        <Papel ceja={AMA} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ ...d('19px', AMA), whiteSpace: 'nowrap' }}>{eur0(stats.eSug)}</span>
          <span style={{ flex: 1, fontFamily: LEX, fontSize: 13, fontWeight: 600, color: INK, minWidth: 220 }}>
            <b>{stats.sugerido} platos con marca sugerida automáticamente.</b> Se parecen mucho a un plato de Uber que sí tiene marca.
            Repásalos y confírmalos: no toco la venta con una suposición sin que tú lo digas.
          </span>
          <button
            onClick={confirmarSugerencias}
            disabled={guardando === 'todas'}
            style={{ background: AMA, color: INK, border: `2px solid ${INK}`, boxShadow: SHADOW_MINI, padding: '8px 14px', fontFamily: OSW, fontWeight: 700, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >{guardando === 'todas' ? 'Aplicando…' : `Confirmar las ${stats.sugerido}`}</button>
        </Papel>
      )}

      {aviso && <Nota tono="verde">{aviso}</Nota>}

      <Plancha>
        <PlanchaCelda bg={VERDE_S} color={INK} first>
          <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Resueltos</div>
          <div style={{ ...d('26px', VERDE), margin: '6px 0' }}>{nf0(stats.listo)}</div>
          <span style={pill(VERDE_S, VERDE)}>{eur0(stats.eListo)} recuperados</span>
        </PlanchaCelda>
        <PlanchaCelda bg={AMA_S} color={INK}>
          <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Sugeridos sin confirmar</div>
          <div style={{ ...d('26px', AMA), margin: '6px 0' }}>{nf0(stats.sugerido)}</div>
          <span style={pill(AMA_S, AMA)}>{eur0(stats.eSug)} en juego</span>
        </PlanchaCelda>
        <PlanchaCelda bg={ROSA_S} color={INK}>
          <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Sin asignar</div>
          <div style={{ ...d('26px', GRANATE), margin: '6px 0' }}>{nf0(stats.pendiente)}</div>
          <span style={pill(ROSA_S, GRANATE)}>{eur0(stats.ePend)} ciegos</span>
        </PlanchaCelda>
        <PlanchaCelda bg={AZUL_S} color={INK}>
          <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Avance del mapeo</div>
          <div style={{ ...d('26px', AZUL), margin: '6px 0' }}>{pct1(pctResuelto)}</div>
          <span style={pill(AZUL_S, AZUL)}>sobre {eur0(totalCiego)} de venta ciega</span>
        </PlanchaCelda>
      </Plancha>

      <Papel ceja={GRANATE} pad="0" style={{ overflow: 'hidden' }}>
        <div style={{ background: GRANATE, color: BLANCO, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontFamily: OSW, fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>Platos de Glovo y Just Eat</div>
            <div style={{ fontFamily: LEX, fontSize: 11, opacity: 0.85, marginTop: 2 }}>Ordenados por euros: arriba lo que más pesa. Empieza por ahí.</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FILTROS.map(f => {
              const on = f.id === filtro
              return (
                <button key={f.id} onClick={() => setFiltro(f.id)}
                  style={{
                    padding: '6px 12px', cursor: 'pointer',
                    background: on ? BLANCO : 'transparent',
                    color: on ? GRANATE : BLANCO,
                    border: `2px solid ${BLANCO}`,
                    fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
                  }}>{f.label}</button>
              )
            })}
          </div>
        </div>

        <div style={{ padding: '14px 16px' }}>
          {lista.length === 0 ? (
            <Vacio>Nada en esta lista. Buena señal.</Vacio>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: INK }}>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'left' }}>Plato</th>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'right' }}>Facturación ciega</th>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'left' }}>Origen</th>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'left' }}>Marca</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.slice(0, 120).map(f => (
                    <tr key={f.id}>
                      <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}`, maxWidth: 340 }}>
                        {f.plato_muestra ?? f.plato_norm}
                      </td>
                      <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}`, textAlign: 'right' }}>{eur0(Number(f.euros) || 0)}</td>
                      <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}` }}>
                        {f.origen === 'exacto'    && <span style={pill(VERDE_S, VERDE)}>Igual que en Uber</span>}
                        {f.origen === 'manual'    && <span style={pill(AZUL_S, AZUL)}>Lo dijiste tú</span>}
                        {f.origen === 'sugerido'  && <span style={pill(AMA_S, AMA)}>Se parece · {Math.round((f.confianza ?? 0) * 100)}%</span>}
                        {f.origen === 'pendiente' && <span style={pill(ROSA_S, GRANATE)}>Sin asignar</span>}
                      </td>
                      <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}` }}>
                        <select
                          value={f.marca ?? ''}
                          disabled={guardando === f.plato_norm}
                          onChange={e => asignar(f, e.target.value)}
                          style={{
                            padding: '6px 10px', minWidth: 210,
                            border: `2px solid ${f.marca ? INK : GRANATE}`,
                            background: BLANCO, color: f.marca ? INK : GRANATE,
                            fontFamily: LEX, fontSize: 13, fontWeight: 600,
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
                  Se muestran los 120 que más pesan de {nf0(lista.length)}. Según los vayas cerrando aparecen los siguientes.
                </Nota>
              )}
            </div>
          )}

          <Nota tono="verde">
            Cada plato que asignas se aplica al momento a toda la venta histórica de ese plato. No hay que reimportar nada.
          </Nota>
        </div>
      </Papel>
    </PantallaCantera>
  )
}
