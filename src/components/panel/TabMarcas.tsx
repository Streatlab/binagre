/**
 * TabMarcas — Panel Global · pestaña Marcas
 * CANTERA ALEGRE v1.0 (área Marcas · rosa). Solo capa visual; datos/lógica intactos.
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { INK, GRIS, OSW, LEX, VERDE, NAR, AMA, AZUL, ROSA, GRANATE } from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'
import { fmtEur, fmtNum } from '@/utils/format'
import type { RowFacturacion } from '@/components/panel/resumen/types'
import { resolverNeto } from '@/lib/panel/netoResolver'
import { useNetoContext } from '@/lib/panel/useNetoContext'

// RowFacturacion extended with optional servicio
type RowConServicio = RowFacturacion & { servicio?: string | null }

interface Marca { id: string; nombre: string }

interface Props { rows: RowConServicio[]; fechaDesde: Date; fechaHasta: Date }

// LEY-NETO-01: el neto se resuelve siempre con resolverNeto, nunca con comisiones fijas.
const CANALES = [
  { id: 'uber',  bk: 'uber_bruto',    pk: 'uber_pedidos' },
  { id: 'glovo', bk: 'glovo_bruto',   pk: 'glovo_pedidos' },
  { id: 'je',    bk: 'je_bruto',      pk: 'je_pedidos' },
  { id: 'web',   bk: 'web_bruto',     pk: 'web_pedidos' },
  { id: 'dir',   bk: 'directa_bruto', pk: 'directa_pedidos' },
] as const

const MARCA_COLORS = [ROSA, AZUL, VERDE, NAR, AMA]

export default function TabMarcas({ rows, fechaDesde, fechaHasta }: Props) {
  const [marcasDisp, setMarcasDisp] = useState<Marca[]>([])
  const { configCanales: config, marcasPorCanal } = useNetoContext()

  useEffect(() => {
    supabase.from('marcas').select('id, nombre').eq('activa', true).then(({ data }) => {
      if (data) setMarcasDisp(data as Marca[])
    })
  }, [])

  if (!rows.length) {
    return (
      <PantallaCantera embedded>
        <Papel ceja={ROSA}><div style={{ color: GRIS, fontFamily: LEX }}>Sin datos para el período seleccionado.</div></Papel>
      </PantallaCantera>
    )
  }

  // Check if any row has servicio data
  const hayServicio = rows.some(r => r.servicio != null && r.servicio !== '')

  if (!hayServicio) {
    const totalBruto = rows.reduce((s, r) => s + r.total_bruto, 0)
    const totalPedidos = rows.reduce((s, r) => s + r.total_pedidos, 0)
    const ticketMedio = totalPedidos > 0 ? totalBruto / totalPedidos : 0

    return (
      <PantallaCantera embedded>
        <HeroCantera
          area="marcas"
          titular={<>Ventas de <b>{fmtEur(totalBruto)}</b> sin desglose por marca este periodo.</>}
          etiquetaDato="Ventas brutas del periodo"
          cifra={fmtEur(totalBruto)}
          resumen={<>{fmtNum(totalPedidos)} pedidos · ticket medio {fmtEur(ticketMedio)}</>}
        />
        <Papel ceja={ROSA}>
          <div style={{ color: GRIS, fontFamily: LEX, fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
            Sin datos de marca en este período — el campo <em>servicio</em> no está informado en las filas cargadas.
          </div>
          {marcasDisp.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, marginBottom: 10, textAlign: 'center' }}>Marcas activas registradas</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {marcasDisp.map((m, i) => (
                  <span key={m.id} style={{
                    padding: '4px 12px', border: `2px solid ${INK}`,
                    background: MARCA_COLORS[i % MARCA_COLORS.length],
                    color: MARCA_COLORS[i % MARCA_COLORS.length] === AMA ? INK : '#fff',
                    fontFamily: OSW, fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
                  }}>
                    {m.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Papel>
      </PantallaCantera>
    )
  }

  // Neto por canal AGREGADO del periodo (resolverNeto una vez por canal, como
  // Finanzas/Resumen → el total cuadra). Después se prorratea el neto de cada
  // canal entre las franjas según su cuota de bruto en ese canal (sin
  // sobre-atribuir la liquidación real de canal a cada franja).
  const nDias = new Set(rows.filter(r => r.total_bruto > 0).map(r => r.fecha)).size || 1
  const netoRatioCanal: Record<string, number> = {}
  for (const c of CANALES) {
    const bruto = rows.reduce((s, r) => s + ((r as unknown as Record<string, number>)[c.bk] ?? 0), 0)
    const pedidos = rows.reduce((s, r) => s + ((r as unknown as Record<string, number>)[c.pk] ?? 0), 0)
    const { neto } = resolverNeto(c.id, bruto, pedidos, {
      modo: 'agregado_canal', marcasPorCanal, fechaDesde, fechaHasta,
      configCanales: config, diasConDatos: nDias,
    })
    netoRatioCanal[c.id] = bruto > 0 ? neto / bruto : 0
  }

  const marcaMap: Record<string, { pedidos: number; bruto: number; neto: number }> = {}
  rows.forEach(r => {
    const key = r.servicio ?? 'Sin marca'
    const e = (marcaMap[key] ??= { pedidos: 0, bruto: 0, neto: 0 })
    e.pedidos += r.total_pedidos
    e.bruto += r.total_bruto
    for (const c of CANALES) {
      const b = (r as unknown as Record<string, number>)[c.bk] ?? 0
      e.neto += b * netoRatioCanal[c.id]
    }
  })

  const marcaList = Object.entries(marcaMap)
    .map(([nombre, s]) => ({ nombre, pedidos: s.pedidos, bruto: s.bruto, neto: s.neto }))
    .sort((a, b) => b.bruto - a.bruto)

  const totalBruto = marcaList.reduce((s, m) => s + m.bruto, 0)
  const totalPedidos = marcaList.reduce((s, m) => s + m.pedidos, 0)
  const netoTot = marcaList.reduce((s, m) => s + m.neto, 0)
  const margenTot = totalBruto > 0 ? (netoTot / totalBruto) * 100 : 0

  const marcaMasVentas = marcaList[0]
  const marcaMejorTicket = [...marcaList].sort((a, b) => {
    const ta = a.pedidos > 0 ? a.bruto / a.pedidos : 0
    const tb = b.pedidos > 0 ? b.bruto / b.pedidos : 0
    return tb - ta
  })[0]

  const titular = marcaMasVentas
    ? <><b>{marcaMasVentas.nombre}</b> lidera el periodo con {fmtEur(marcaMasVentas.bruto)}.</>
    : 'Desglose por marca del periodo.'

  const atencion = [
    marcaMasVentas ? `Más ventas: ${marcaMasVentas.nombre} ${fmtEur(marcaMasVentas.bruto)}` : null,
    marcaMejorTicket && marcaMejorTicket.pedidos > 0 ? `Mejor ticket: ${marcaMejorTicket.nombre} ${fmtEur(marcaMejorTicket.bruto / marcaMejorTicket.pedidos)}` : null,
    `${marcaList.length} marcas con ventas en el periodo`,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera embedded>
      {/* 1 · Héroe del área Marcas (rosa) */}
      <HeroCantera
        area="marcas"
        titular={titular}
        etiquetaDato="Ventas brutas del periodo"
        cifra={fmtEur(totalBruto)}
        resumen={<>{fmtNum(totalPedidos)} pedidos · margen medio {margenTot.toFixed(0)}%</>}
        atencion={atencion}
      />

      {/* 2 · Plancha KPIs */}
      <Plancha>
        <PlanchaCelda bg={ROSA} color="#fff" first>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Marca más ventas</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, lineHeight: 1.1, marginTop: 6, textTransform: 'uppercase' }}>{marcaMasVentas?.nombre ?? '—'}</div>
          <div style={{ fontFamily: LEX, fontSize: 13, marginTop: 4 }}>{fmtEur(marcaMasVentas?.bruto ?? 0)}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={AZUL} color="#fff">
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Mejor ticket medio</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, lineHeight: 1.1, marginTop: 6, textTransform: 'uppercase' }}>{marcaMejorTicket?.nombre ?? '—'}</div>
          <div style={{ fontFamily: LEX, fontSize: 13, marginTop: 4 }}>{marcaMejorTicket && marcaMejorTicket.pedidos > 0 ? fmtEur(marcaMejorTicket.bruto / marcaMejorTicket.pedidos) : '—'}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={AMA} color={INK}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Marcas con ventas</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtNum(marcaList.length)}</div>
          <div style={{ fontFamily: LEX, fontSize: 13, marginTop: 4 }}>en el periodo</div>
        </PlanchaCelda>
      </Plancha>

      {/* 3 · Frase potente (logro · verde, distinta del héroe rosa) */}
      {marcaMasVentas && (
        <FrasePotente significado="logro">{marcaMasVentas.nombre} concentra el {totalBruto > 0 ? ((marcaMasVentas.bruto / totalBruto) * 100).toFixed(0) : 0}% de la facturación del periodo.</FrasePotente>
      )}

      {/* % ventas por marca */}
      <div>
        <SeccionLabel bg={ROSA}>% ventas por marca</SeccionLabel>
        <Papel ceja={ROSA}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {marcaList.map((m, i) => {
              const pct = totalBruto > 0 ? (m.bruto / totalBruto) * 100 : 0
              const color = MARCA_COLORS[i % MARCA_COLORS.length]
              return (
                <div key={m.nombre}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: LEX, fontSize: 13, color: INK }}>{m.nombre}</span>
                    <span style={{ fontFamily: OSW, fontSize: 13, fontWeight: 600, color: INK }}>
                      {fmtEur(m.bruto)} <span style={{ color: GRIS, fontSize: 11 }}>({pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 14, background: `${INK}10`, border: `2px solid ${INK}`, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Papel>
      </div>

      {/* Tabla desglose por marca */}
      <div>
        <SeccionLabel bg={GRANATE}>Desglose por marca</SeccionLabel>
        <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
            <thead>
              <tr style={{ background: INK }}>
                {['Marca', 'Pedidos', 'Bruto', 'Neto est.', 'Margen est.', '% total'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: i === 0 ? 'left' : 'right', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#fff8e7', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {marcaList.map((m, i) => {
                const pct = totalBruto > 0 ? (m.bruto / totalBruto) * 100 : 0
                const margen = m.bruto > 0 ? (m.neto / m.bruto) * 100 : 0
                const color = MARCA_COLORS[i % MARCA_COLORS.length]
                return (
                  <tr key={m.nombre} style={{ borderBottom: `2px solid ${INK}` }}>
                    <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, border: `1px solid ${INK}`, display: 'inline-block' }} />
                      {m.nombre}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: OSW, fontWeight: 700 }}>{fmtNum(m.pedidos)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmtEur(m.bruto)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: VERDE }}>{fmtEur(m.neto)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: OSW, color: margen >= 70 ? VERDE : NAR }}>{margen.toFixed(0)}%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: OSW }}>{pct.toFixed(1)}%</td>
                  </tr>
                )
              })}
              <tr style={{ background: INK }}>
                <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 700, color: '#fff8e7' }}>TOTAL</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: OSW, fontWeight: 700, color: '#fff8e7' }}>{fmtNum(totalPedidos)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: OSW, fontWeight: 700, color: '#fff8e7' }}>{fmtEur(totalBruto)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: OSW, fontWeight: 700, color: VERDE }}>{fmtEur(netoTot)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: OSW, fontWeight: 700, color: '#fff8e7' }}>{margenTot.toFixed(0)}%</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: OSW, fontWeight: 700, color: '#fff8e7' }}>100%</td>
              </tr>
            </tbody>
          </table>
        </Papel>
      </div>
    </PantallaCantera>
  )
}
