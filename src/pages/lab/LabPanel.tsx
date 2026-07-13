/**
 * LAB · Panel Global — pantalla espejo en Ley Visual SL v2.
 * Copia intocable: no sustituye a la pantalla real, sirve para afinar el estilo.
 * Datos reales de facturacion_diario.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { RowFacturacion } from '@/components/panel/resumen/types'
import {
  C, Hero, HeroPill, Kpi, KpiGrid, Card, CardHead, Pill, Atencion, Nota,
  LineaArea, Barras, InBar, Vacio, eur0, num0, pct1, delta,
  CANAL_COLOR, CANAL_LABEL,
} from '@/components/panel/sl/uiSL'
import {
  PageHead, Tabs, Selector, Tabla, Fila, Celda, SkeletonTabla, Estado,
} from '@/components/panel/sl/uiSLTabla'

type TabId = 'resumen' | 'canales' | 'evolucion'
type Rango = '7d' | '30d' | '90d'

const RANGOS: Array<{ id: Rango; label: string; dias: number }> = [
  { id: '7d', label: 'Últimos 7 días', dias: 7 },
  { id: '30d', label: 'Últimos 30 días', dias: 30 },
  { id: '90d', label: 'Últimos 90 días', dias: 90 },
]

const CANALES = ['uber', 'glovo', 'je', 'web', 'dir'] as const
type CanalId = typeof CANALES[number]

function brutoCanal(r: RowFacturacion, c: CanalId): number {
  if (c === 'uber') return Number(r.uber_bruto ?? 0)
  if (c === 'glovo') return Number(r.glovo_bruto ?? 0)
  if (c === 'je') return Number(r.je_bruto ?? 0)
  if (c === 'web') return Number(r.web_bruto ?? 0)
  return Number(r.directa_bruto ?? 0)
}
function pedidosCanal(r: RowFacturacion, c: CanalId): number {
  if (c === 'uber') return Number(r.uber_pedidos ?? 0)
  if (c === 'glovo') return Number(r.glovo_pedidos ?? 0)
  if (c === 'je') return Number(r.je_pedidos ?? 0)
  if (c === 'web') return Number(r.web_pedidos ?? 0)
  return Number(r.directa_pedidos ?? 0)
}

const dStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function LabPanel() {
  const [tab, setTab] = useState<TabId>('resumen')
  const [rango, setRango] = useState<Rango>('30d')
  const [rows, setRows] = useState<RowFacturacion[]>([])
  const [prev, setPrev] = useState<RowFacturacion[]>([])
  const [cargando, setCargando] = useState(true)

  const dias = RANGOS.find(r => r.id === rango)!.dias

  useEffect(() => {
    setCargando(true)
    const hasta = new Date()
    const desde = new Date(); desde.setDate(desde.getDate() - (dias - 1))
    const desdePrev = new Date(); desdePrev.setDate(desdePrev.getDate() - (dias * 2 - 1))
    const hastaPrev = new Date(); hastaPrev.setDate(hastaPrev.getDate() - dias)

    Promise.all([
      supabase.from('facturacion_diario').select('*').gte('fecha', dStr(desde)).lte('fecha', dStr(hasta)).order('fecha'),
      supabase.from('facturacion_diario').select('*').gte('fecha', dStr(desdePrev)).lte('fecha', dStr(hastaPrev)).order('fecha'),
    ]).then(([a, b]) => {
      setRows((a.data ?? []) as RowFacturacion[])
      setPrev((b.data ?? []) as RowFacturacion[])
      setCargando(false)
    })
  }, [dias])

  const stats = useMemo(() => {
    const bruto = rows.reduce((s, r) => s + Number(r.total_bruto ?? 0), 0)
    const pedidos = rows.reduce((s, r) => s + Number(r.total_pedidos ?? 0), 0)
    const brutoPrev = prev.reduce((s, r) => s + Number(r.total_bruto ?? 0), 0)
    const pedidosPrev = prev.reduce((s, r) => s + Number(r.total_pedidos ?? 0), 0)
    const ticket = pedidos > 0 ? bruto / pedidos : 0
    const ticketPrev = pedidosPrev > 0 ? brutoPrev / pedidosPrev : 0
    const varBruto = brutoPrev > 0 ? ((bruto - brutoPrev) / brutoPrev) * 100 : null
    const varPedidos = pedidosPrev > 0 ? ((pedidos - pedidosPrev) / pedidosPrev) * 100 : null
    const varTicket = ticketPrev > 0 ? ((ticket - ticketPrev) / ticketPrev) * 100 : null

    const porCanal = CANALES.map(c => {
      const b = rows.reduce((s, r) => s + brutoCanal(r, c), 0)
      const p = rows.reduce((s, r) => s + pedidosCanal(r, c), 0)
      const bPrev = prev.reduce((s, r) => s + brutoCanal(r, c), 0)
      return {
        id: c,
        label: CANAL_LABEL[c],
        color: CANAL_COLOR[c],
        bruto: b,
        pedidos: p,
        ticket: p > 0 ? b / p : 0,
        pct: bruto > 0 ? (b / bruto) * 100 : 0,
        varia: bPrev > 0 ? ((b - bPrev) / bPrev) * 100 : null,
      }
    }).sort((a, b) => b.bruto - a.bruto)

    const propio = porCanal.filter(c => c.id === 'web' || c.id === 'dir').reduce((s, c) => s + c.bruto, 0)
    const pctPropio = bruto > 0 ? (propio / bruto) * 100 : 0

    const serie = rows.map(r => Number(r.total_bruto ?? 0))
    const etiquetas = rows.map(r => r.fecha.slice(8, 10) + '/' + r.fecha.slice(5, 7))
    const diasSinVenta = rows.filter(r => Number(r.total_bruto ?? 0) === 0).length

    return { bruto, pedidos, ticket, varBruto, varPedidos, varTicket, porCanal, pctPropio, propio, serie, etiquetas, diasSinVenta }
  }, [rows, prev])

  const tonoVar = (v: number | null) => (v == null ? 'neutro' : v >= 0 ? 'verde' : 'rojo')
  const etiquetasFinas = stats.etiquetas.filter((_, i) => i % Math.ceil(Math.max(1, stats.etiquetas.length / 8)) === 0)

  return (
    <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}>
      <PageHead
        titulo="Panel global"
        sub={`Pantalla espejo · ${RANGOS.find(r => r.id === rango)!.label.toLowerCase()}`}
        right={<Selector valor={rango} onChange={setRango} opciones={RANGOS.map(r => ({ id: r.id, label: r.label }))} ancho={180} />}
      />

      <Hero
        eyebrow="VENTA BRUTA DEL PERIODO"
        titular="Lo que ha entrado por todos los canales"
        valor={eur0(stats.bruto)}
        sub={`${num0(stats.pedidos)} pedidos · ticket medio ${stats.ticket.toFixed(2)} €`}
        spark={stats.serie}
        right={
          <>
            <HeroPill solid>{delta(stats.varBruto)} vs periodo anterior</HeroPill>
            <HeroPill>Tienda propia {pct1(stats.pctPropio)}</HeroPill>
          </>
        }
        objetivo={{ pct: stats.pctPropio, label: 'PROPIO' }}
      />

      {stats.pctPropio < 15 && stats.bruto > 0 && (
        <Atencion
          tono="ambar"
          cifra={pct1(stats.pctPropio)}
          accion="Ver canales"
          onAccion={() => setTab('canales')}
        >
          Solo esa parte de la venta es tuya de verdad. El resto entra por plataformas y paga comisión.
        </Atencion>
      )}

      <Tabs
        tabs={[
          { id: 'resumen', label: 'Resumen' },
          { id: 'canales', label: 'Canales', count: stats.porCanal.filter(c => c.bruto > 0).length },
          { id: 'evolucion', label: 'Evolución' },
        ]}
        activeId={tab}
        onChange={setTab}
      />

      {cargando ? (
        <SkeletonTabla filas={5} />
      ) : rows.length === 0 ? (
        <Card><Vacio>No hay facturación cargada en este periodo.</Vacio></Card>
      ) : (
        <>
          {tab === 'resumen' && (
            <>
              <KpiGrid cols={4}>
                <Kpi
                  icono="€" tono="verde" label="Venta bruta" valor={eur0(stats.bruto)}
                  spark={stats.serie}
                  delta={<Pill tone={tonoVar(stats.varBruto)}>{delta(stats.varBruto)}</Pill>}
                  pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>Periodo anterior: {eur0(prev.reduce((s, r) => s + Number(r.total_bruto ?? 0), 0))}</div>}
                />
                <Kpi
                  icono="#" tono="blu" label="Pedidos" valor={num0(stats.pedidos)}
                  spark={rows.map(r => Number(r.total_pedidos ?? 0))}
                  delta={<Pill tone={tonoVar(stats.varPedidos)}>{delta(stats.varPedidos)}</Pill>}
                  pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>{(stats.pedidos / Math.max(1, rows.length)).toFixed(1)} al día</div>}
                />
                <Kpi
                  icono="T" tono="ambar" label="Ticket medio" valor={`${stats.ticket.toFixed(2)} €`}
                  delta={<Pill tone={tonoVar(stats.varTicket)}>{delta(stats.varTicket)}</Pill>}
                  pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>Sube el ticket antes que el volumen</div>}
                />
                <Kpi
                  icono="%" tono={stats.pctPropio >= 15 ? 'verde' : 'rojo'} label="Venta propia" valor={pct1(stats.pctPropio)}
                  pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>{eur0(stats.propio)} sin comisión</div>}
                />
              </KpiGrid>

              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>
                <Card>
                  <CardHead title="Venta día a día" sub="Bruto por jornada" right={<Pill tone="neutro">{rows.length} días</Pill>} />
                  <LineaArea puntos={stats.serie} etiquetas={etiquetasFinas} fmt={eur0} />
                  {stats.diasSinVenta > 0 && (
                    <Nota tono="ambar">
                      Hay {stats.diasSinVenta} día(s) sin venta registrada. O se cerró, o falta cargar la facturación.
                    </Nota>
                  )}
                </Card>

                <Card>
                  <CardHead title="Reparto por canal" sub="Peso sobre el bruto" />
                  {stats.porCanal.filter(c => c.bruto > 0).map(c => (
                    <div key={c.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 900, marginBottom: 5 }}>
                        <span>{c.label}</span>
                        <span className="slnum" style={{ color: C.gris, fontSize: 12 }}>{eur0(c.bruto)} · {pct1(c.pct)}</span>
                      </div>
                      <InBar pct={c.pct} color={c.color} />
                    </div>
                  ))}
                </Card>
              </div>
            </>
          )}

          {tab === 'canales' && (
            <Tabla
              cabeceras={[
                { label: 'Canal' },
                { label: 'Bruto', alinea: 'der' },
                { label: 'Peso', alinea: 'der' },
                { label: 'Pedidos', alinea: 'der' },
                { label: 'Ticket', alinea: 'der' },
                { label: 'vs anterior', alinea: 'der' },
              ]}
            >
              {stats.porCanal.map(c => (
                <Fila key={c.id} tono={c.varia == null ? 'neutro' : c.varia >= 0 ? 'verde' : 'rojo'}>
                  <Celda fuerte>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color, display: 'inline-block' }} />
                      {c.label}
                    </span>
                  </Celda>
                  <Celda der mono fuerte>{eur0(c.bruto)}</Celda>
                  <Celda der style={{ minWidth: 110 }}>
                    <span className="slnum" style={{ fontSize: 12 }}>{pct1(c.pct)}</span>
                    <InBar pct={c.pct} color={c.color} />
                  </Celda>
                  <Celda der mono>{num0(c.pedidos)}</Celda>
                  <Celda der mono>{c.ticket.toFixed(2)} €</Celda>
                  <Celda der>
                    <Estado tono={c.varia == null ? 'neutro' : c.varia >= 0 ? 'verde' : 'rojo'}>{delta(c.varia)}</Estado>
                  </Celda>
                </Fila>
              ))}
            </Tabla>
          )}

          {tab === 'evolucion' && (
            <Card>
              <CardHead title="Bruto por canal" sub="Total del periodo" />
              <Barras
                datos={stats.porCanal.filter(c => c.bruto > 0).map(c => ({ label: c.label, valor: Math.round(c.bruto), color: c.color }))}
                fmt={eur0}
              />
              <Nota tono="blu" accion="Ver reparto">
                Las barras comparan volumen, no rentabilidad: un euro de Uber no vale lo mismo que un euro de tienda propia.
              </Nota>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
