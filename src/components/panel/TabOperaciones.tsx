/**
 * TabOperaciones — Panel Global · pestaña Operaciones
 * CANTERA ALEGRE v1.0 (área Operaciones · naranja). Solo capa visual; datos/lógica intactos.
 */

import { OSW, LEX, INK, GRIS, VERDE, ROJO, NAR, AZUL, AMA, CORP } from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'
import { fmtNum, fmtEur } from '@/utils/format'

interface Row {
  fecha: string
  uber_bruto: number; uber_pedidos: number
  glovo_bruto: number; glovo_pedidos: number
  je_bruto: number; je_pedidos: number
  web_bruto: number; web_pedidos: number
  directa_bruto: number; directa_pedidos: number
  total_bruto: number; total_pedidos: number
}

interface Props { rows: Row[] }

const CANALES = [
  { id: 'uber',    label: 'Uber Eats', corp: 'uber' },
  { id: 'glovo',   label: 'Glovo',     corp: 'glovo' },
  { id: 'je',      label: 'Just Eat',  corp: 'je' },
  { id: 'web',     label: 'Web',       corp: 'web' },
  { id: 'directa', label: 'Directa',   corp: 'dir' },
] as const

const DIAS_SEM = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function TabOperaciones({ rows }: Props) {
  if (!rows.length) {
    return (
      <PantallaCantera embedded>
        <Papel ceja={NAR}><div style={{ color: GRIS, fontFamily: LEX }}>Sin datos para el período seleccionado.</div></Papel>
      </PantallaCantera>
    )
  }

  // KPIs
  const totalPedidos = rows.reduce((s, r) => s + r.total_pedidos, 0)
  const totalBruto   = rows.reduce((s, r) => s + r.total_bruto, 0)
  const ticketMedio  = totalPedidos > 0 ? totalBruto / totalPedidos : 0
  const pedidoMasAlto = Math.max(...rows.map(r => r.total_pedidos))
  const diaMasPedidos = rows.reduce((best, r) => r.total_pedidos > best.total_pedidos ? r : best, rows[0])

  // Mix de canales (pedidos + ticket medio por canal)
  const mixCanales = CANALES.map(c => {
    const pedidos = rows.reduce((s, r) => s + (r[`${c.id}_pedidos` as keyof Row] as number), 0)
    const bruto = rows.reduce((s, r) => s + (r[`${c.id}_bruto` as keyof Row] as number), 0)
    const pct = totalPedidos > 0 ? (pedidos / totalPedidos) * 100 : 0
    const ticket = pedidos > 0 ? bruto / pedidos : 0
    return { ...c, pedidos, bruto, pct, ticket }
  })
  const canalesConTicket = mixCanales.filter(c => c.pedidos > 0)
  const mejorTicketCanal = canalesConTicket.length
    ? canalesConTicket.reduce((a, c) => (c.ticket > a.ticket ? c : a))
    : null
  const maxTicket = canalesConTicket.reduce((m, c) => Math.max(m, c.ticket), 0) || 1

  // Pedidos por día de semana → MEDIA por día (comparación justa: descuenta
  // cuántas veces sale cada día en el periodo). 0=domingo en JS → lunes=0.
  const sumDiaSem = [0, 0, 0, 0, 0, 0, 0]
  const cntDiaSem = [0, 0, 0, 0, 0, 0, 0]
  rows.forEach(r => {
    const dt = new Date(r.fecha + 'T12:00:00')
    const dow = (dt.getDay() + 6) % 7 // lunes=0 … domingo=6
    sumDiaSem[dow] += r.total_pedidos
    cntDiaSem[dow] += 1
  })
  const mediaDiaSem = sumDiaSem.map((s, i) => (cntDiaSem[i] > 0 ? s / cntDiaSem[i] : 0))
  const maxDiaSem = Math.max(...mediaDiaSem, 1)
  // Día fuerte / flojo por media (solo días con presencia en el periodo)
  const conPresencia = mediaDiaSem.map((m, i) => ({ i, m })).filter(x => cntDiaSem[x.i] > 0)
  const diaFuerte = conPresencia.length ? conPresencia.reduce((a, x) => (x.m > a.m ? x : a)) : null
  const diaFlojo  = conPresencia.length ? conPresencia.reduce((a, x) => (x.m < a.m ? x : a)) : null

  // Top 5 días por pedidos
  const top5 = [...rows]
    .sort((a, b) => b.total_pedidos - a.total_pedidos)
    .slice(0, 5)

  const [ay, am, ad] = diaMasPedidos.fecha.split('-')

  const titular = <>Se sirvieron <b>{fmtNum(totalPedidos)}</b> pedidos en el periodo, con ticket medio de <b>{fmtEur(ticketMedio)}</b>.</>

  const atencion = [
    `Mejor día: ${ad}/${am} · ${fmtNum(diaMasPedidos.total_pedidos)} pedidos`,
    diaFuerte ? `Día fuerte semana: ${DIAS_SEM[diaFuerte.i]}` : null,
    mejorTicketCanal ? `Mejor ticket: ${mejorTicketCanal.label} ${fmtEur(mejorTicketCanal.ticket)}` : null,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera embedded>
      {/* 1 · Héroe del área Operaciones (naranja) */}
      <HeroCantera
        area="ops"
        titular={titular}
        etiquetaDato="Pedidos totales del periodo"
        cifra={fmtNum(totalPedidos)}
        resumen={<>Pico del período: <b>{fmtNum(pedidoMasAlto)}</b> pedidos en un solo día.</>}
        atencion={atencion}
      />

      {/* 2 · Plancha KPIs */}
      <Plancha>
        <PlanchaCelda bg={NAR} color="#fff" first>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Pedidos totales</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtNum(totalPedidos)}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={AMA}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Ticket medio</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(ticketMedio)}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={VERDE} color="#fff">
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Día más alto</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtNum(pedidoMasAlto)}</div>
          <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>pico del período</div>
        </PlanchaCelda>
        <PlanchaCelda bg={AZUL} color="#fff">
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Mejor día</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{ad}/{am}</div>
          <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{fmtNum(diaMasPedidos.total_pedidos)} pedidos</div>
        </PlanchaCelda>
      </Plancha>

      {/* 3 · Frase potente (oportunidad · rosa, distinta del héroe naranja) */}
      {mejorTicketCanal && (
        <FrasePotente significado="oportunidad">Empuja pedidos hacia {mejorTicketCanal.label}: es el canal con mejor ticket medio del periodo.</FrasePotente>
      )}

      {/* Mix de canales | Pedidos por día de semana */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <SeccionLabel bg={NAR}>Mix de canales · pedidos</SeccionLabel>
          <Papel ceja={NAR}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {mixCanales.map(c => (
                <div key={c.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: LEX, fontSize: 13, color: INK }}>{c.label}</span>
                    <span style={{ fontFamily: OSW, fontSize: 13, color: INK, fontWeight: 600 }}>
                      {fmtNum(c.pedidos)} <span style={{ color: GRIS, fontSize: 11 }}>({c.pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 14, background: '#00000010', border: `2px solid ${INK}`, overflow: 'hidden' }}>
                    <div style={{ width: `${c.pct}%`, height: '100%', background: CORP[c.corp] ?? INK }} />
                  </div>
                </div>
              ))}
            </div>
          </Papel>
        </div>

        <div>
          <SeccionLabel bg={AMA} color={INK}>Pedidos por día de semana · media/día</SeccionLabel>
          <Papel ceja={AMA}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110, marginBottom: 12 }}>
              {mediaDiaSem.map((v, i) => {
                const h = maxDiaSem > 0 ? Math.max(4, (v / maxDiaSem) * 96) : 4
                const esFuerte = diaFuerte?.i === i && v > 0
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontFamily: OSW, fontSize: 10, color: esFuerte ? INK : GRIS }}>{cntDiaSem[i] > 0 ? fmtNum(Math.round(v)) : '—'}</span>
                    <div style={{ width: '100%', height: h, background: esFuerte ? VERDE : NAR, border: `2px solid ${INK}` }} />
                    <span style={{ fontFamily: OSW, fontSize: 11, color: INK, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{DIAS_SEM[i]}</span>
                  </div>
                )
              })}
            </div>
            {diaFuerte && diaFlojo && diaFuerte.i !== diaFlojo.i && (
              <div style={{ fontFamily: LEX, fontSize: 12.5, color: INK }}>
                Día fuerte: <b>{DIAS_SEM[diaFuerte.i]}</b> ({fmtNum(Math.round(diaFuerte.m))} ped/día). Más flojo: <b>{DIAS_SEM[diaFlojo.i]}</b> ({fmtNum(Math.round(diaFlojo.m))} ped/día).
              </div>
            )}
          </Papel>
        </div>
      </div>

      {/* Ticket medio por canal */}
      <div>
        <SeccionLabel bg={VERDE}>Ticket medio por canal</SeccionLabel>
        <Papel ceja={VERDE}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {canalesConTicket.map(c => {
              const w = (c.ticket / maxTicket) * 100
              const best = mejorTicketCanal?.id === c.id
              return (
                <div key={c.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: LEX, fontSize: 13, color: INK }}>{c.label}</span>
                    <span style={{ fontFamily: OSW, fontSize: 13, fontWeight: 600, color: best ? VERDE : INK }}>
                      {fmtEur(c.ticket)}{best && <span style={{ fontSize: 11, marginLeft: 6 }}>★ mejor</span>}
                    </span>
                  </div>
                  <div style={{ height: 14, background: '#00000010', border: `2px solid ${INK}`, overflow: 'hidden' }}>
                    <div style={{ width: `${w}%`, height: '100%', background: best ? VERDE : (CORP[c.corp] ?? INK) }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Papel>
      </div>

      {/* Top 5 días */}
      <div>
        <SeccionLabel bg={AZUL}>Top 5 días por pedidos</SeccionLabel>
        <Papel ceja={AZUL} pad="0" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
            <thead>
              <tr style={{ background: INK }}>
                {['#', 'Fecha', 'Pedidos', 'Bruto', 'Ticket'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: i > 1 ? 'right' : 'left', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#fff8e7', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top5.map((r, i) => {
                const ticket = r.total_pedidos > 0 ? r.total_bruto / r.total_pedidos : 0
                const [y, m, d] = r.fecha.split('-')
                return (
                  <tr key={r.fecha} style={{ borderBottom: `2px solid ${INK}` }}>
                    <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, color: GRIS }}>{i + 1}</td>
                    <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600 }}>{d}/{m}/{y}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: OSW, fontWeight: 700 }}>{fmtNum(r.total_pedidos)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmtEur(r.total_bruto)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmtEur(ticket)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Papel>
      </div>
    </PantallaCantera>
  )
}
