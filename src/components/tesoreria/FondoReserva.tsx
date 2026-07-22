/**
 * FondoReserva — Fondo de maniobra. Neobrutal Food-Pop (tokens canonicos).
 *
 * Extraido de la antigua pagina Reservas para poder vivir como pestaña dentro
 * de Pagos y Cobros. Incluye:
 *  - Barrido de cobros de plataforma al fondo (DOTACION vinculada, reversible).
 *  - Boton "Deshacer" por dotacion (doble confirmacion) via RPC transaccional.
 *  - Cobertura contra el objetivo REAL de fijos (reserva_config.objetivo_fijos_mes).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import {
  OSW, LEX, INK, CREMA, CLARO, OSC, D1, SHADOW, BORDER_CARD,
  VERDE, ROJO, AMA, NAR, AZUL, GRANATE, GRIS, CORP, CLARA, eyebrow, d, E2, EUR, P0,
  BLANCO, VERDE_S, AMA_S, ROSA_S, NAR_S,
} from '@/styles/neobrutal'
import { fmtEur } from '@/lib/format'

interface Config { id: number; pct: number; activo: boolean; fecha_inicio: string; objetivo_fijos_mes: number; cuenta_destino: string | null; match_traspaso: string | null; tolerancia_dias: number }
interface Orden {
  id: string; fecha_cobro: string; plataforma: string
  importe_cobro: number; pct_aplicado: number; importe_reservar: number; estado: string
}
interface Movimiento {
  id: string; fecha: string; tipo: string; importe: number
  destino: string | null; autorizado: boolean; nota: string | null
  verificado: boolean; fecha_verificado: string | null
}
interface NoVerif { id: string; fecha: string; importe: number; nota: string | null; dias_sin_verificar: number }
interface Agenda {
  hoy: number; hoy_n: number; semana: number; semana_n: number
  total: number; total_n: number; barrido_mes: number; objetivo_mes: number
}
interface FijoMes { concepto: string; importe: number; dia: string; estimado: boolean; categoria: string | null; estado_pago: string }

/** Mapea la categoría contable de un fijo al destino de retirada del fondo.
 *  'OTRO' = el fondo no está pensado para ese gasto (p.ej. software) → sin botón. */
function destinoDeCategoria(cat: string | null): string {
  const c = cat ?? ''
  if (c.startsWith('2.31')) return 'ALQUILER'
  if (c.startsWith('2.44')) return 'SUMINISTROS'
  if (c.startsWith('2.21.1')) return 'SS'
  if (c.startsWith('2.21.2') || c.startsWith('2.21.4')) return 'NOMINAS'
  if (c.startsWith('4.2')) return 'PRESTAMO'
  if (c.startsWith('2.5') || c.startsWith('2.6')) return 'IMPUESTOS'
  return 'OTRO'
}

const DESTINOS = ['NOMINAS', 'SS', 'ALQUILER', 'SUMINISTROS', 'PRESTAMO', 'IMPUESTOS', 'OTRO']
const AUTORIZADOS = ['NOMINAS', 'SS', 'ALQUILER', 'SUMINISTROS', 'PRESTAMO', 'IMPUESTOS']

function canalKey(plataforma: string): string {
  const p = plataforma.toUpperCase()
  if (p.includes('UBER')) return 'uber'
  if (p.includes('GLOVO')) return 'glovo'
  if (p.includes('JUST')) return 'je'
  return 'dir'
}
function fechaBonita(iso: string): string {
  const dt = new Date(iso + 'T00:00:00')
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const diff = Math.round((hoy.getTime() - dt.getTime()) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  return dt.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
}

export function FondoReserva({ embedded = false }: { embedded?: boolean }) {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [movs, setMovs] = useState<Movimiento[]>([])
  const [fijosMedia, setFijosMedia] = useState(0)
  const [objetivoReal, setObjetivoReal] = useState(0)
  const [saldoTeorico, setSaldoTeorico] = useState(0)
  const [fijosMes, setFijosMes] = useState<FijoMes[]>([])
  const [agenda, setAgenda] = useState<Agenda | null>(null)
  const [loading, setLoading] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [pctEdit, setPctEdit] = useState(5)
  const [confirmDeshacer, setConfirmDeshacer] = useState<string | null>(null)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [fugaArmada, setFugaArmada] = useState(false)
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fugaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [noVerif, setNoVerif] = useState<NoVerif[]>([])
  const [revisando, setRevisando] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [cuentaEdit, setCuentaEdit] = useState('')
  const [matchEdit, setMatchEdit] = useState('')
  const [tolEdit, setTolEdit] = useState(3)

  async function cargar() {
    try {
    setError(null)
    const [c, o, m, f, a, p, fm, nv] = await Promise.all([
      supabase.from('reserva_config').select('*').eq('id', 1).single(),
      supabase.from('reserva_ordenes').select('*').order('fecha_cobro', { ascending: false }).limit(300),
      supabase.from('reserva_movimientos').select('*').order('fecha', { ascending: false }).limit(100),
      supabase.from('v_reserva_fijos_mes').select('fijos_mes').single(),
      supabase.from('v_reserva_agenda').select('*').single(),
      supabase.from('v_reserva_panel').select('saldo_teorico').single(),
      supabase.from('v_tesoreria_fijos_mes').select('concepto,importe,dia,estimado,categoria,estado_pago').order('dia', { ascending: true }).order('concepto', { ascending: true }),
      supabase.from('v_reserva_no_verificadas').select('*').order('dias_sin_verificar', { ascending: false }),
    ])
    setFijosMes(((fm.data ?? []) as FijoMes[]).map(r => ({ ...r, importe: Number(r.importe) })))
    setNoVerif(((nv.data ?? []) as NoVerif[]).map(r => ({ ...r, importe: Number(r.importe), dias_sin_verificar: Number(r.dias_sin_verificar) })))
    if (c.data) {
      const cd = c.data as Config
      setCfg(cd); setPctEdit(Number(cd.pct)); setObjetivoReal(Number(cd.objetivo_fijos_mes ?? 0))
      setCuentaEdit(cd.cuenta_destino ?? ''); setMatchEdit(cd.match_traspaso ?? ''); setTolEdit(Number(cd.tolerancia_dias ?? 3))
    }
    setSaldoTeorico(Number((p.data as { saldo_teorico?: number } | null)?.saldo_teorico ?? 0))
    setOrdenes((o.data ?? []) as Orden[])
    setMovs((m.data ?? []) as Movimiento[])
    setFijosMedia(Number((f.data as { fijos_mes?: number } | null)?.fijos_mes ?? 0))
    if (a.data) {
      const raw = a.data as Record<string, unknown>
      setAgenda({
        hoy: Number(raw.hoy ?? 0), hoy_n: Number(raw.hoy_n ?? 0),
        semana: Number(raw.semana ?? 0), semana_n: Number(raw.semana_n ?? 0),
        total: Number(raw.total ?? 0), total_n: Number(raw.total_n ?? 0),
        barrido_mes: Number(raw.barrido_mes ?? 0), objetivo_mes: Number(raw.objetivo_mes ?? 0),
      })
    }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos')
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }
  async function refrescar() { setRefreshing(true); await cargar() }

  // Concilia las dotaciones del fondo con los traspasos reales del banco.
  async function revisarBanco() {
    setRevisando(true)
    const { data, error: eRpc } = await supabase.rpc('fn_reserva_conciliar')
    setRevisando(false)
    if (eRpc) { setMsg('No se pudo revisar el banco'); return }
    const r = (data ?? {}) as { ok?: boolean; motivo?: string; verificadas?: number; creadas?: number }
    if (!r.ok) {
      setMsg(r.motivo === 'sin_cuenta_reserva_configurada'
        ? 'Configura primero el texto del traspaso en «Cuenta de reserva»'
        : 'No se pudo revisar el banco')
      setConfigOpen(true)
      return
    }
    setMsg(`Banco revisado · ${r.verificadas ?? 0} confirmada${(r.verificadas ?? 0) === 1 ? '' : 's'}, ${r.creadas ?? 0} detectada${(r.creadas ?? 0) === 1 ? '' : 's'}`)
    cargar()
  }

  async function guardarCuenta() {
    await supabase.from('reserva_config').update({
      cuenta_destino: cuentaEdit.trim() || null,
      match_traspaso: matchEdit.trim() || null,
      tolerancia_dias: Math.max(0, tolEdit),
    }).eq('id', 1)
    setMsg('Cuenta de reserva guardada')
    setConfigOpen(false)
    cargar()
  }
  useEffect(() => { cargar(); return () => { if (confirmTimer.current) clearTimeout(confirmTimer.current) } }, [])

  // El aviso (toast) se cierra solo a los 4,5 s.
  useEffect(() => {
    if (!msg) return
    if (msgTimer.current) clearTimeout(msgTimer.current)
    msgTimer.current = setTimeout(() => setMsg(null), 4500)
    return () => { if (msgTimer.current) clearTimeout(msgTimer.current) }
  }, [msg])

  const pendientes = useMemo(() => ordenes.filter(o => o.estado === 'PENDIENTE'), [ordenes])
  const totalPendiente = agenda?.total ?? 0
  const dotado = useMemo(() => movs.filter(m => m.tipo === 'DOTACION').reduce((a, m) => a + Number(m.importe), 0), [movs])
  const retirado = useMemo(() => movs.filter(m => m.tipo === 'RETIRADA').reduce((a, m) => a + Number(m.importe), 0), [movs])
  const dotadoSinVerif = useMemo(() => movs.filter(m => m.tipo === 'DOTACION' && !m.verificado).reduce((a, m) => a + Number(m.importe), 0), [movs])
  // Saldo real desde el servidor (v_reserva_panel), no la suma de los últimos 100 movimientos.
  const saldo = saldoTeorico
  const fugas = useMemo(() => movs.filter(m => m.tipo === 'RETIRADA' && !m.autorizado), [movs])
  // Nombre del mes en curso, para dejar explícito qué mes cubre la barra (p.ej. "julio 2026").
  const mesCoberturaTexto = useMemo(() => {
    const t = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    return t.charAt(0).toUpperCase() + t.slice(1)
  }, [])
  // Cobertura contra el objetivo REAL de fijos del mes (no la media historica).
  const objetivo = objetivoReal > 0 ? objetivoReal : fijosMedia
  const cobertura = objetivo > 0 ? (saldo / objetivo) * 100 : 0
  const colorCob = cobertura >= 100 ? VERDE : cobertura >= 60 ? AMA : ROJO
  // Colchón: cuántos días de gastos fijos aguanta el fondo (mes = 30 días).
  const diasColchon = objetivo > 0 ? Math.round((saldo * 30) / objetivo) : 0

  // "Hasta dónde llega el fondo": rellena los fijos del mes (ordenados por fecha)
  // con el saldo actual y con el saldo + lo pendiente de barrer. Marca cada fijo
  // como cubierto ya / cubierto si barres lo pendiente / al descubierto.
  const alcance = useMemo(() => {
    const conPendiente = saldo + (agenda?.total ?? 0)
    let acc = 0
    let nCub = 0, nBar = 0
    let ultimoCub = ''
    let faltaSiguiente = 0
    let nPagados = 0, importePagado = 0, importePendiente = 0
    let proxDesc: { concepto: string; dia: string } | null = null
    let diaD: { concepto: string; dia: string; acum: number } | null = null
    const rows = fijosMes.map(fj => {
      // Ya cargado en banco este mes → fuera del cálculo, el fondo no lo cubre.
      if (fj.estado_pago === 'pagado') {
        nPagados++; importePagado += fj.importe
        return { ...fj, estado: 'pag' as const, acum: 0 }
      }
      importePendiente += fj.importe
      acc += fj.importe
      let estado: 'cub' | 'bar' | 'desc'
      if (acc <= saldo + 0.001) { estado = 'cub'; nCub++; ultimoCub = fj.concepto }
      else {
        estado = acc <= conPendiente + 0.001 ? 'bar' : 'desc'
        if (estado === 'bar') nBar++
        if (faltaSiguiente === 0) faltaSiguiente = acc - saldo // primer pendiente no cubierto por el saldo
        if (!diaD) diaD = { concepto: fj.concepto, dia: fj.dia, acum: acc } // primer vencimiento que el fondo no cubre
        if (estado === 'desc' && !proxDesc) proxDesc = { concepto: fj.concepto, dia: fj.dia }
      }
      return { ...fj, estado, acum: acc }
    })
    return { rows, nCub, nBar, ultimoCub, faltaSiguiente, total: fijosMes.length, nPagados, importePagado, nPend: fijosMes.length - nPagados, importePendiente, proxDesc: proxDesc as { concepto: string; dia: string } | null, diaD: diaD as { concepto: string; dia: string; acum: number } | null }
  }, [fijosMes, saldo, agenda])

  // "Foto del mes": reparte el total de fijos en pagado (banco) / cubierto por el
  // fondo / cubrible barriendo lo pendiente / al descubierto.
  const estim = useMemo(() => {
    const list = fijosMes.filter(f => f.estimado)
    return { n: list.length, importe: list.reduce((a, f) => a + f.importe, 0) }
  }, [fijosMes])

  const foto = useMemo(() => {
    const pagado = alcance.importePagado
    const pend = alcance.importePendiente
    const cubierto = Math.min(saldo, pend)
    const barrido = Math.min(Math.max(agenda?.total ?? 0, 0), pend - cubierto)
    const descubierto = Math.max(pend - cubierto - barrido, 0)
    return { pagado, cubierto, barrido, descubierto, total: pagado + pend }
  }, [alcance, saldo, agenda])

  async function copiarResumen() {
    const mesNombre = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    const faltaTot = Math.max(alcance.importePendiente - saldo, 0)
    const lineas = [
      `📊 TESORERÍA · ${mesNombre}`,
      `💰 Fondo de reserva: ${E2(saldo)} €`,
      `🎯 Fijos del mes: ${E2(objetivo)} €`,
      alcance.nPagados > 0 ? `✅ Ya pagados: ${E2(alcance.importePagado)} € (${alcance.nPagados})` : null,
      `🧾 Queda por pagar: ${E2(alcance.importePendiente)} € (${alcance.nPend})`,
      `📌 El fondo cubre ${alcance.nCub} de ${alcance.nPend} pendientes`,
      faltaTot > 0 ? `⚠️ Faltan ${E2(faltaTot)} € para cubrirlo todo` : `👍 El fondo cubre todo lo pendiente`,
      alcance.proxDesc ? `🔴 Próximo al descubierto: ${alcance.proxDesc.concepto} (${alcance.proxDesc.dia.slice(8, 10)}/${alcance.proxDesc.dia.slice(5, 7)})` : null,
    ].filter(Boolean)
    try {
      await navigator.clipboard.writeText(lineas.join('\n'))
      setMsg('Resumen copiado · pégalo en WhatsApp')
    } catch {
      setMsg('No se pudo copiar automáticamente')
    }
  }

  const diasMasAntigua = useMemo(() => {
    if (pendientes.length === 0) return 0
    const min = pendientes.reduce((a, o) => (o.fecha_cobro < a ? o.fecha_cobro : a), pendientes[0].fecha_cobro)
    return Math.floor((Date.now() - new Date(min + 'T00:00:00').getTime()) / 86400000)
  }, [pendientes])
  const nivel: 'ok' | 'aviso' | 'rojo' | 'bloqueo' =
    pendientes.length === 0 ? 'ok' : diasMasAntigua >= 5 ? 'bloqueo' : diasMasAntigua >= 2 ? 'rojo' : 'aviso'

  const mixCanal = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const o of pendientes) {
      const k = canalKey(o.plataforma)
      acc[k] = (acc[k] ?? 0) + Number(o.importe_reservar)
    }
    return acc
  }, [pendientes])

  const porDia = useMemo(() => {
    const m = new Map<string, Orden[]>()
    for (const o of pendientes) {
      const arr = m.get(o.fecha_cobro) ?? []
      arr.push(o); m.set(o.fecha_cobro, arr)
    }
    return Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [pendientes])

  async function guardarPct() {
    const p = Math.min(35, Math.max(0, pctEdit))
    setOcupado(true)
    await supabase.from('reserva_config').update({ pct: p, updated_at: new Date().toISOString() }).eq('id', 1)
    for (const o of pendientes) {
      await supabase.from('reserva_ordenes')
        .update({ pct_aplicado: p, importe_reservar: Math.round(Number(o.importe_cobro) * p) / 100 })
        .in('id', [o.id])
    }
    setMsg(`Porcentaje guardado: ${p}% · órdenes pendientes recalculadas`)
    setOcupado(false)
    cargar()
  }

  async function toggleActivo() {
    if (!cfg) return
    await supabase.from('reserva_config').update({ activo: !cfg.activo }).eq('id', 1)
    cargar()
  }

  async function cumplirLote(lista: Orden[], etiqueta: string) {
    if (lista.length === 0) return
    setOcupado(true)
    const total = lista.reduce((a, o) => a + Number(o.importe_reservar), 0)
    // Barrido atómico en servidor: inserta la dotación y vincula las órdenes en
    // una sola transacción (movimiento_traspaso_id) para poder deshacer.
    const { error } = await supabase.rpc('fn_reserva_cumplir_lote', {
      p_orden_ids: lista.map(o => o.id),
      p_nota: `${etiqueta} · ${lista.length} cobro${lista.length === 1 ? '' : 's'}`,
    })
    setMsg(error ? `No se pudo ingresar: ${error.message}` : `Ingresado en el fondo: ${E2(total)} € (${etiqueta.toLowerCase()})`)
    setOcupado(false)
    cargar()
  }

  function pedirDeshacer(id: string) {
    if (confirmDeshacer === id) { ejecutarDeshacer(id); return }
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    setConfirmDeshacer(id)
    confirmTimer.current = setTimeout(() => setConfirmDeshacer(null), 4000)
  }
  async function ejecutarDeshacer(id: string) {
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    setConfirmDeshacer(null)
    setOcupado(true)
    await supabase.rpc('fn_reserva_deshacer_dotacion', { p_mov_id: id })
    setMsg('Dotación deshecha · reabiertas las órdenes')
    setOcupado(false)
    cargar()
  }

  async function omitir(o: Orden) {
    await supabase.from('reserva_ordenes').update({ estado: 'OMITIDA' }).eq('id', o.id)
    cargar()
  }

  const [retImporte, setRetImporte] = useState(0)
  const [retDestino, setRetDestino] = useState('NOMINAS')
  const [simExtra, setSimExtra] = useState(0)
  async function registrarRetirada() {
    if (retImporte <= 0 || retImporte > saldo) {
      setMsg(retImporte > saldo ? 'No puedes sacar más de lo que hay en el fondo' : 'Pon un importe')
      return
    }
    // Destino no autorizado = fuga del fondo: pedir confirmación explícita.
    if (!AUTORIZADOS.includes(retDestino) && !fugaArmada) {
      setFugaArmada(true)
      setMsg(`«${retDestino}» no es un destino autorizado: se marcará como FUGA. Pulsa otra vez para confirmar.`)
      if (fugaTimer.current) clearTimeout(fugaTimer.current)
      fugaTimer.current = setTimeout(() => setFugaArmada(false), 4000)
      return
    }
    await supabase.from('reserva_movimientos').insert({
      fecha: new Date().toISOString().slice(0, 10),
      tipo: 'RETIRADA', importe: retImporte, destino: retDestino,
      autorizado: AUTORIZADOS.includes(retDestino),
    })
    if (fugaTimer.current) clearTimeout(fugaTimer.current)
    setFugaArmada(false)
    setRetImporte(0)
    cargar()
  }

  const wrap: CSSProperties = embedded
    ? { padding: 0 }
    : { background: CREMA, minHeight: '100vh', padding: '28px 32px' }

  if (loading) {
    return <div style={{ ...(embedded ? {} : { background: CREMA, minHeight: '100vh' }), padding: embedded ? 8 : 40, ...d('20px'), color: GRIS }}>Cargando fondo…</div>
  }

  const ordenesHoy = pendientes.filter(o => o.fecha_cobro === new Date().toISOString().slice(0, 10))
  const semanaIni = (() => { const dt = new Date(); const day = (dt.getDay() + 6) % 7; dt.setDate(dt.getDate() - day); return dt.toISOString().slice(0, 10) })()
  const ordenesSemana = pendientes.filter(o => o.fecha_cobro >= semanaIni)

  // Recomendación "aparta X €/día hasta fin de mes" para cubrir lo pendiente.
  const hoyD = new Date()
  const finMes = new Date(hoyD.getFullYear(), hoyD.getMonth() + 1, 0)
  const diasRestantes = Math.max(1, Math.ceil((finMes.getTime() - hoyD.getTime()) / 86400000))
  const faltaPend = Math.max(alcance.importePendiente - saldo, 0)
  const apartarDia = faltaPend / diasRestantes

  // Simulador: cuántos pendientes cubrirías con saldo + lo que ingreses.
  const simDisponible = saldo + (simExtra || 0)
  const simPend = alcance.rows.filter(r => r.estado !== 'pag')
  const simCubre = simPend.filter(r => r.acum <= simDisponible + 0.001).length
  const simUltimo = simPend.filter(r => r.acum <= simDisponible + 0.001).slice(-1)[0]?.concepto ?? ''

  return (
    <div style={wrap}>

      {/* CABECERA (solo en modo pagina completa) */}
      {!embedded && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <div>
            <span style={eyebrow(AMA)}>Tesorería · desde {cfg?.fecha_inicio ?? ''}</span>
            <h1 style={{ ...d('42px'), margin: '10px 0 0' }}>Reservas</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={revisarBanco} disabled={revisando} style={{ ...btnMini, background: AZUL, color: BLANCO }}>{revisando ? 'Revisando…' : 'Revisar banco'}</button>
            <button onClick={refrescar} disabled={refreshing} style={{ ...btnMini, background: BLANCO, color: INK }}>{refreshing ? 'Actualizando…' : '↻ Actualizar'}</button>
            <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>Barrido</span>
            <button onClick={toggleActivo} style={{
              ...btn, padding: '8px 14px',
              background: cfg?.activo ? VERDE : BLANCO, color: cfg?.activo ? BLANCO : GRIS,
            }}>{cfg?.activo ? 'Activo' : 'Apagado'}</button>
          </div>
        </div>
      )}

      {embedded && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={revisarBanco} disabled={revisando} style={{ ...btnMini, background: AZUL, color: BLANCO }}>{revisando ? 'Revisando…' : 'Revisar banco'}</button>
          <button onClick={refrescar} disabled={refreshing} style={{ ...btnMini, background: BLANCO, color: INK }}>{refreshing ? 'Actualizando…' : '↻ Actualizar'}</button>
          <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>Barrido {cfg?.fecha_inicio ? `· desde ${cfg.fecha_inicio}` : ''}</span>
          <button onClick={toggleActivo} style={{
            ...btn, padding: '8px 14px',
            background: cfg?.activo ? VERDE : BLANCO, color: cfg?.activo ? BLANCO : GRIS,
          }}>{cfg?.activo ? 'Activo' : 'Apagado'}</button>
        </div>
      )}

      {msg && (
        <div onClick={() => setMsg(null)} style={{ background: fugaArmada ? ROJO : VERDE, color: BLANCO, border: BORDER_CARD, boxShadow: SHADOW, padding: '12px 16px', marginBottom: 16, fontFamily: OSW, fontWeight: 600, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' }}>
          {msg}
        </div>
      )}

      {error && (
        <div style={{ background: ROJO, color: BLANCO, border: BORDER_CARD, boxShadow: SHADOW, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>Error al cargar: {error}</span>
          <button onClick={refrescar} disabled={refreshing} style={{ ...btnMini, background: BLANCO, color: ROJO }}>Reintentar</button>
        </div>
      )}

      {/* Alerta: dotaciones que el banco no confirma pasado el margen de días. */}
      {noVerif.length > 0 && (
        <div style={{ background: ROJO, color: BLANCO, border: BORDER_CARD, boxShadow: SHADOW, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 18, letterSpacing: 1, textTransform: 'uppercase' }}>
            El banco no confirma {noVerif.length} traspaso{noVerif.length === 1 ? '' : 's'}
          </div>
          <div style={{ fontFamily: LEX, fontSize: 12.5, marginTop: 4, opacity: 0.95 }}>
            Marcaste como hecho {E2(noVerif.reduce((a, n) => a + n.importe, 0))} € pero no aparece el movimiento en la cuenta de reserva. Comprueba que hiciste el traspaso o pulsa «Revisar banco».
          </div>
        </div>
      )}

      {/* ══ HERO · QUE TIENES QUE INGRESAR ══ */}
      <div style={{
        background: nivel === 'bloqueo' ? OSC : AMA, color: nivel === 'bloqueo' ? D1 : INK,
        border: BORDER_CARD, boxShadow: SHADOW, padding: '24px 26px', marginBottom: 18,
      }}>
        {totalPendiente > 0 ? (
          <>
            <span style={eyebrow(nivel === 'bloqueo' ? ROJO : INK, nivel === 'bloqueo' ? BLANCO : AMA)}>
              {nivel === 'bloqueo' ? `Llevas ${diasMasAntigua} días sin barrer` : 'Ingresa en el fondo'}
            </span>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28, flexWrap: 'wrap', marginTop: 14 }}>
              <div>
                <div style={{ ...d('64px', nivel === 'bloqueo' ? D1 : INK) }}>{E2(totalPendiente)} €</div>
                <div style={{ fontFamily: LEX, fontSize: 13, marginTop: 6, opacity: 0.85 }}>
                  {agenda && agenda.hoy > 0 && <><strong>{E2(agenda.hoy)} € de hoy</strong> · </>}
                  {agenda && agenda.semana > 0 && agenda.semana !== totalPendiente && <>{E2(agenda.semana)} € de esta semana · </>}
                  {pendientes.length} cobro{pendientes.length === 1 ? '' : 's'} de plataforma al {cfg?.pct ?? 5}%
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginLeft: 'auto' }}>
                {ordenesHoy.length > 0 && (
                  <button disabled={ocupado} onClick={() => cumplirLote(ordenesHoy, 'Barrido de hoy')}
                    style={{ ...btn, background: BLANCO, color: INK }}>
                    Ingresado lo de hoy · {E2(agenda?.hoy ?? 0)} €
                  </button>
                )}
                {ordenesSemana.length > 0 && ordenesSemana.length !== pendientes.length && (
                  <button disabled={ocupado} onClick={() => cumplirLote(ordenesSemana, 'Barrido de la semana')}
                    style={{ ...btn, background: BLANCO, color: INK }}>
                    Lo de la semana · {E2(agenda?.semana ?? 0)} €
                  </button>
                )}
                <button disabled={ocupado} onClick={() => cumplirLote(pendientes, 'Barrido total')}
                  style={{ ...btn, background: VERDE, color: BLANCO }}>
                  Todo ingresado · {E2(totalPendiente)} €
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', height: 14, border: `2px solid ${INK}`, marginTop: 18, overflow: 'hidden', background: BLANCO }}>
              {(['uber', 'glovo', 'je'] as const).map(k => {
                const v = mixCanal[k] ?? 0
                if (v <= 0 || totalPendiente <= 0) return null
                return <div key={k} style={{ width: `${(v / totalPendiente) * 100}%`, background: CORP[k] }} />
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
              {(['uber', 'glovo', 'je'] as const).map(k => {
                const v = mixCanal[k] ?? 0
                if (v <= 0) return null
                const nombre = k === 'uber' ? 'Uber Eats' : k === 'glovo' ? 'Glovo' : 'Just Eat'
                return (
                  <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: LEX, fontSize: 11.5 }}>
                    <span style={{ width: 12, height: 12, background: CORP[k], border: `1.5px solid ${INK}`, display: 'inline-block' }} />
                    {nombre} <strong style={{ fontFamily: OSW }}>{E2(v)} €</strong>
                  </span>
                )
              })}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ ...d('40px') }}>Todo al día ✓</div>
            <div style={{ fontFamily: LEX, fontSize: 13.5 }}>
              No hay nada pendiente de ingresar. En cuanto entre un cobro de plataforma, aquí verás cuánto apartar.
            </div>
          </div>
        )}
      </div>

      {/* ══ TRES CARDS ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 18 }}>

        {/* SALDO + COBERTURA */}
        <div style={card}>
          <span style={eyebrow(VERDE, BLANCO)}>Fondo acumulado</span>
          <div style={{ ...d('48px'), marginTop: 12 }}>{E2(saldo)} €</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontFamily: LEX, fontSize: 12, color: GRIS }}>
            <span>Entró <strong style={{ fontFamily: OSW, color: VERDE }}>{E2(dotado)}</strong></span>
            <span>Salió <strong style={{ fontFamily: OSW, color: ROJO }}>{E2(retirado)}</strong></span>
          </div>
          {dotadoSinVerif > 0 && (
            <div style={{ fontFamily: LEX, fontSize: 11, color: NAR, marginTop: 4 }}>
              {E2(dotadoSinVerif)} € aún sin confirmar por el banco
            </div>
          )}
          <div style={{ height: 18, border: `2px solid ${INK}`, background: CLARO, marginTop: 16, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, Math.max(0, cobertura))}%`, height: '100%', background: colorCob, transition: 'width .5s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
            <span style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS }}>
              de los <strong>{EUR(objetivo)}</strong> de fijos reales del mes
            </span>
            <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, color: colorCob }}>{P0(cobertura)}</span>
          </div>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', color: colorCob, marginTop: 6 }}>
            Fijos de {mesCoberturaTexto}
          </div>
          <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS, marginTop: 4 }}>
            Objetivo real = suma de gastos fijos activos del mes. Media 3 meses: <strong>{EUR(fijosMedia)}</strong>.
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `2px solid ${INK}`, fontFamily: LEX, fontSize: 12, color: GRIS }}>
            El fondo aguanta <strong style={{ fontFamily: OSW, fontSize: 16, color: colorCob }}>{diasColchon}</strong> día{diasColchon === 1 ? '' : 's'} de gastos fijos.
          </div>
        </div>

        {/* MES EN CURSO */}
        <div style={card}>
          <span style={eyebrow(AZUL, BLANCO)}>Este mes</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div>
              <div style={{ ...d('34px', VERDE) }}>{E2(agenda?.barrido_mes ?? 0)} €</div>
              <div style={miniLbl}>Ya ingresado</div>
            </div>
            <div>
              <div style={{ ...d('34px', NAR) }}>{E2(totalPendiente)} €</div>
              <div style={miniLbl}>Pendiente</div>
            </div>
          </div>
          {(agenda?.objetivo_mes ?? 0) > 0 && (
            <>
              <div style={{ height: 14, border: `2px solid ${INK}`, background: CLARO, marginTop: 16, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, ((agenda?.barrido_mes ?? 0) / (agenda?.objetivo_mes ?? 1)) * 100)}%`,
                  height: '100%', background: VERDE,
                }} />
              </div>
              <div style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS, marginTop: 8 }}>
                Objetivo del mes: <strong style={{ fontFamily: OSW }}>{E2(agenda?.objetivo_mes ?? 0)} €</strong> ({cfg?.pct}% de lo cobrado)
              </div>
            </>
          )}
          <div style={{ marginTop: 14, borderTop: `2px solid ${INK}`, paddingTop: 12 }}>
            <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginRight: 8 }}>% de barrido</span>
            <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap', verticalAlign: 'middle' }}>
              {[5, 6, 7, 8, 9, 10].map(v => (
                <button key={v} onClick={() => setPctEdit(v)} style={{
                  ...pill, background: pctEdit === v ? INK : BLANCO, color: pctEdit === v ? AMA : INK,
                }}>{v}</button>
              ))}
            </span>
            {pctEdit !== Number(cfg?.pct ?? 5) && (
              <button disabled={ocupado} onClick={guardarPct} style={{ ...btnMini, background: INK, color: AMA, marginLeft: 8 }}>
                Guardar {pctEdit}%
              </button>
            )}
          </div>
        </div>

        {/* RETIRADA */}
        <div style={card}>
          <span style={eyebrow(GRANATE, BLANCO)}>Pagar con el fondo</span>
          <p style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 12, marginBottom: 12, lineHeight: 1.5 }}>
            Solo para <strong style={{ color: INK }}>nóminas, SS, alquiler, suministros, préstamos e impuestos</strong>. Otro destino queda marcado como fuga.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input type="number" min={0} step={0.01} value={retImporte || ''} placeholder="Importe €"
              onChange={e => setRetImporte(parseFloat(e.target.value) || 0)}
              style={{ padding: '10px 12px', border: BORDER_CARD, background: BLANCO, fontFamily: OSW, fontWeight: 600, fontSize: 16, textAlign: 'right', outline: 'none', color: INK }} />
            <select value={retDestino} onChange={e => setRetDestino(e.target.value)}
              style={{ padding: '10px 12px', border: BORDER_CARD, background: BLANCO, fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: 1, outline: 'none', color: INK }}>
              {DESTINOS.map(dd => <option key={dd} value={dd}>{dd}</option>)}
            </select>
          </div>
          <button onClick={registrarRetirada} disabled={saldo <= 0}
            style={{ ...btn, background: saldo <= 0 ? CLARO : fugaArmada ? ROJO : GRANATE, color: saldo > 0 ? BLANCO : GRIS, width: '100%', marginTop: 10, cursor: saldo > 0 ? 'pointer' : 'not-allowed' }}>
            {fugaArmada ? '¿Confirmar fuga?' : 'Registrar retirada'}
          </button>
          {saldo <= 0 && (
            <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS, marginTop: 8 }}>El fondo está a cero: primero ingresa.</div>
          )}
          {fugas.length > 0 && (
            <div style={{ marginTop: 12, background: ROJO, color: BLANCO, border: `2px solid ${INK}`, padding: '10px 12px', fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {fugas.length} fuga{fugas.length === 1 ? '' : 's'} · {E2(fugas.reduce((a, f) => a + Number(f.importe), 0))} €
            </div>
          )}
        </div>
      </div>

      {/* ══ ALERTA DÍA D + RITMO DE AHORRO ══ */}
      {alcance.nPend > 0 && (
        alcance.diaD ? (
          <div style={{ background: ROJO, color: BLANCO, border: BORDER_CARD, boxShadow: SHADOW, padding: '16px 20px', marginBottom: 18 }}>
            <span style={eyebrow(BLANCO, ROJO)}>Día D</span>
            <div style={{ ...d('26px', BLANCO), margin: '10px 0 6px' }}>
              El {alcance.diaD.dia.slice(8, 10)}/{alcance.diaD.dia.slice(5, 7)} dejas de llegar
            </div>
            <div style={{ fontFamily: LEX, fontSize: 13, lineHeight: 1.5 }}>
              Al vencer <strong>{alcance.diaD.concepto}</strong> el acumulado del mes ({E2(alcance.diaD.acum)} €) supera tu fondo ({E2(saldo)} €).
              {faltaPend > 0 && <> Para cubrir lo pendiente antes de fin de mes, aparta <strong>~{E2(apartarDia)} €/día</strong> ({diasRestantes} días).</>}
            </div>
          </div>
        ) : (
          <div style={{ background: VERDE, color: BLANCO, border: BORDER_CARD, boxShadow: SHADOW, padding: '14px 20px', marginBottom: 18, fontFamily: OSW, fontWeight: 600, fontSize: 14, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            ✓ Tu fondo cubre todos los vencimientos pendientes del mes
          </div>
        )
      )}

      {/* ══ FOTO DEL MES (barra segmentada) ══ */}
      {foto.total > 0 && (() => {
        const segs = [
          { k: 'pag', v: foto.pagado, c: GRIS, label: 'Pagado' },
          { k: 'cub', v: foto.cubierto, c: VERDE, label: 'Cubre el fondo' },
          { k: 'bar', v: foto.barrido, c: NAR, label: 'Con barrido' },
          { k: 'desc', v: foto.descubierto, c: ROJO, label: 'Al descubierto' },
        ].filter(s => s.v > 0.005)
        return (
          <div style={{ ...card, marginBottom: 18 }}>
            <span style={eyebrow(INK, AMA)}>Foto del mes</span>
            <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, margin: '10px 0 12px' }}>
              Reparto de los <strong style={{ color: INK }}>{E2(foto.total)} €</strong> de fijos del mes.
            </div>
            <div style={{ display: 'flex', height: 28, border: `2px solid ${INK}`, overflow: 'hidden', background: BLANCO }}>
              {segs.map(s => (
                <div key={s.k} style={{ width: `${(s.v / foto.total) * 100}%`, background: s.c }} title={`${s.label}: ${E2(s.v)} €`} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
              {segs.map(s => (
                <span key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: LEX, fontSize: 11.5, color: GRIS }}>
                  <span style={{ width: 12, height: 12, background: s.c, border: `1.5px solid ${INK}`, display: 'inline-block' }} />
                  {s.label} <strong style={{ fontFamily: OSW, color: INK }}>{E2(s.v)} €</strong>
                </span>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ══ HASTA DONDE LLEGA EL FONDO ══ */}
      {alcance.total > 0 && (
        <div style={{ ...card, marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={eyebrow(AZUL, BLANCO)}>Hasta dónde llega el fondo</span>
            <button onClick={copiarResumen} title="Copiar resumen para WhatsApp" style={{ ...btnMini, background: BLANCO, color: INK }}>
              📋 Copiar resumen
            </button>
          </div>
          <p style={{ fontFamily: LEX, fontSize: 12, color: GRIS, margin: '12px 0 4px', lineHeight: 1.5 }}>
            Tus fijos del mes ordenados por fecha, rellenados con el saldo de hoy
            (<strong style={{ color: VERDE }}>{E2(saldo)} €</strong>)
            {(agenda?.total ?? 0) > 0 && <> y con lo pendiente de barrer (<strong style={{ color: NAR }}>{E2(agenda?.total ?? 0)} €</strong>)</>}.
          </p>
          <div style={{ ...d('22px'), margin: '10px 0 4px' }}>
            {alcance.nPend === 0
              ? <>Todos los fijos del mes <span style={{ color: VERDE }}>ya pagados</span> ✓</>
              : alcance.nCub === alcance.nPend
              ? <>El fondo cubre <span style={{ color: VERDE }}>los {alcance.nPend} pendientes</span> ✓</>
              : <>El fondo cubre <span style={{ color: alcance.nCub > 0 ? VERDE : ROJO }}>{alcance.nCub} de {alcance.nPend}</span> pendientes</>}
          </div>
          {alcance.nPagados > 0 && (
            <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginBottom: 2 }}>
              Ya pagados este mes: <strong style={{ color: VERDE }}>{alcance.nPagados}</strong> ({E2(alcance.importePagado)} €, detectados en banco) · queda por pagar <strong style={{ color: INK }}>{E2(alcance.importePendiente)} €</strong>
            </div>
          )}
          {alcance.nCub > 0 && alcance.nCub < alcance.nPend && (
            <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginBottom: 4 }}>
              Llegas hasta <strong style={{ color: INK }}>{alcance.ultimoCub}</strong>
              {alcance.faltaSiguiente > 0 && <> · te faltan <strong style={{ color: ROJO }}>{E2(alcance.faltaSiguiente)} €</strong> para el siguiente</>}
            </div>
          )}

          {estim.n > 0 && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: AMA_S, border: `2px solid ${AMA}`, fontFamily: LEX, fontSize: 12, color: INK }}>
              🟡 {estim.n} importe{estim.n === 1 ? '' : 's'} aún estimado{estim.n === 1 ? '' : 's'} (<strong>{E2(estim.importe)} €</strong>) — confírmalos al llegar la factura para que el objetivo sea exacto.
            </div>
          )}

          {/* Simulador: ¿y si ingreso X €? */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12, padding: '10px 12px', background: CLARO, border: `2px solid ${INK}` }}>
            <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', color: INK }}>Simular · si ingreso</span>
            <input type="number" min={0} step={50} value={simExtra || ''} placeholder="0"
              onChange={e => setSimExtra(parseFloat(e.target.value) || 0)}
              style={{ width: 110, padding: '7px 10px', border: `2px solid ${AZUL}`, background: BLANCO, fontFamily: OSW, fontWeight: 700, fontSize: 14, textAlign: 'right', outline: 'none', color: INK }} />
            <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 12, color: INK }}>€</span>
            {simExtra > 0 && (
              <span style={{ fontFamily: LEX, fontSize: 12.5, color: GRIS }}>
                → cubrirías <strong style={{ color: simCubre > alcance.nCub ? VERDE : INK }}>{simCubre} de {alcance.nPend}</strong> pendientes
                {simUltimo && <> (hasta <strong style={{ color: INK }}>{simUltimo}</strong>)</>}
              </span>
            )}
          </div>

          <div style={{ marginTop: 12, border: `2px solid ${INK}` }}>
            {alcance.rows.map((r, i) => {
              const est = r.estado === 'pag'
                ? { bg: GRIS, txt: BLANCO, label: '✓ Pagado', wash: 'transparent' }
                : r.estado === 'cub'
                ? { bg: VERDE, txt: BLANCO, label: 'Cubierto', wash: VERDE_S }
                : r.estado === 'bar'
                ? { bg: NAR, txt: BLANCO, label: 'Con barrido', wash: NAR_S }
                : { bg: ROJO, txt: BLANCO, label: 'Descubierto', wash: ROSA_S }
              const muted = r.estado === 'pag'
              const destino = destinoDeCategoria(r.categoria)
              const pagable = destino !== 'OTRO' && !muted
              return (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '48px 1fr 92px 116px 96px', alignItems: 'center', gap: 8,
                  padding: '8px 12px', background: est.wash,
                  borderBottom: i < alcance.rows.length - 1 ? `1px solid ${INK}` : 'none',
                }}>
                  <span style={{ fontFamily: LEX, fontSize: 12, color: muted ? GRIS : INK }}>{r.dia.slice(8, 10)}/{r.dia.slice(5, 7)}</span>
                  <span style={{ fontFamily: LEX, fontSize: 12.5, color: muted ? GRIS : INK, textDecoration: muted ? 'line-through' : 'none' }}>
                    {r.concepto}
                    {r.estimado && <span style={{ fontFamily: OSW, fontSize: 9.5, color: NAR, marginLeft: 6, letterSpacing: 0.5 }}>🟡 EST</span>}
                  </span>
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 14, color: muted ? GRIS : INK, textAlign: 'right' }}>{E2(r.importe)} €</span>
                  <span style={{
                    justifySelf: 'end', fontFamily: OSW, fontWeight: 700, fontSize: 10.5, letterSpacing: 0.5,
                    textTransform: 'uppercase', padding: '3px 8px', border: `2px solid ${INK}`,
                    background: est.bg, color: est.txt,
                  }}>{est.label}</span>
                  {pagable ? (
                    <button
                      title={`Cargar retirada: ${r.concepto} → ${destino}`}
                      onClick={() => {
                        setRetImporte(r.importe); setRetDestino(destino)
                        setMsg(`Cargado para pagar: ${r.concepto} · ${E2(r.importe)} € → ${destino}. Revisa y pulsa "Registrar retirada".`)
                      }}
                      style={{ ...btnMini, justifySelf: 'end', background: BLANCO, color: GRANATE, borderColor: GRANATE, fontSize: 10.5, padding: '5px 8px' }}
                    >Pagar</button>
                  ) : <span />}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══ ORDENES POR DIA ══ */}
      {porDia.length > 0 && (
        <div style={{ ...card, marginBottom: 18 }}>
          <span style={eyebrow(INK, AMA)}>Detalle por día</span>
          {porDia.map(([dia, lista]) => {
            const totalDia = lista.reduce((a, o) => a + Number(o.importe_reservar), 0)
            return (
              <div key={dia} style={{ marginTop: 16 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  background: CLARO, border: `2px solid ${INK}`, padding: '9px 14px',
                }}>
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 16, letterSpacing: 0.5, textTransform: 'uppercase', color: INK }}>
                    {fechaBonita(dia)} <span style={{ color: GRIS, fontSize: 13 }}>· {lista.length} cobro{lista.length === 1 ? '' : 's'}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <strong style={{ fontFamily: OSW, fontSize: 20, color: VERDE }}>{E2(totalDia)} €</strong>
                    <button disabled={ocupado} onClick={() => cumplirLote(lista, `Barrido del ${dia}`)} style={{ ...btnMini, background: INK, color: AMA }}>
                      Ingresado
                    </button>
                  </span>
                </div>
                {lista.map((o, i) => {
                  const k = canalKey(o.plataforma)
                  return (
                    <div key={o.id} style={{
                      display: 'grid', gridTemplateColumns: 'auto 1fr 120px auto', alignItems: 'center', gap: 12,
                      padding: '9px 14px', background: BLANCO,
                      borderLeft: `2px solid ${INK}`, borderRight: `2px solid ${INK}`,
                      borderBottom: i === lista.length - 1 ? `2px solid ${INK}` : '1px solid var(--neo-track)',
                    }}>
                      <span style={{
                        fontFamily: OSW, fontWeight: 700, fontSize: 11.5, letterSpacing: 0.5, textTransform: 'uppercase',
                        background: CORP[k], color: CLARA[k] ? INK : BLANCO,
                        border: `2px solid ${INK}`, padding: '3px 8px',
                      }}>{o.plataforma}</span>
                      <span style={{ fontFamily: LEX, fontSize: 12.5, color: GRIS }}>cobrado {E2(o.importe_cobro)} €</span>
                      <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 18, color: VERDE, textAlign: 'right' }}>{E2(o.importe_reservar)} €</span>
                      <button onClick={() => omitir(o)} style={{ ...btnMini, background: BLANCO, color: GRIS }}>Omitir</button>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* ══ HISTORIAL ══ */}
      <div style={card}>
        <span style={eyebrow(INK, AMA)}>Movimientos del fondo</span>
        {movs.length === 0 && (
          <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS, padding: '16px 0 4px' }}>
            Sin movimientos todavía. El primero aparecerá cuando marques un barrido como ingresado.
          </div>
        )}
        {movs.map((m, i) => {
          const esConfirm = confirmDeshacer === m.id
          return (
            <div key={m.id} style={{
              display: 'grid', gridTemplateColumns: '105px 82px 1fr 130px 130px', alignItems: 'center', gap: 12,
              padding: '10px 0', borderBottom: i < movs.length - 1 ? '1px solid var(--neo-track)' : 'none',
            }}>
              <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>{m.fecha}</span>
              <span style={{
                fontFamily: OSW, fontWeight: 700, fontSize: 11, letterSpacing: 1, textAlign: 'center',
                padding: '4px 6px', border: `2px solid ${INK}`, textTransform: 'uppercase',
                background: m.tipo === 'DOTACION' ? VERDE : m.autorizado ? CLARO : ROJO,
                color: m.tipo === 'DOTACION' ? BLANCO : m.autorizado ? INK : BLANCO,
              }}>
                {m.tipo === 'DOTACION' ? 'Entra' : m.autorizado ? 'Sale' : 'Fuga'}
              </span>
              <span style={{ fontFamily: LEX, fontSize: 12.5, color: GRIS, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {m.destino ?? m.nota ?? '—'}
                {m.tipo === 'DOTACION' && (
                  <span title={m.verificado && m.fecha_verificado ? `Confirmado en banco el ${m.fecha_verificado}` : 'El banco aún no ha confirmado este traspaso'} style={{
                    fontFamily: OSW, fontWeight: 600, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase',
                    padding: '2px 7px', border: `1.5px solid ${m.verificado ? VERDE : NAR}`, color: m.verificado ? VERDE : NAR,
                  }}>{m.verificado ? '✓ banco' : 'sin confirmar'}</span>
                )}
              </span>
              <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 17, textAlign: 'right', color: m.tipo === 'DOTACION' ? VERDE : ROJO }}>
                {fmtEur(m.tipo === 'DOTACION' ? Number(m.importe) : -Number(m.importe), { decimals: 2, signed: true })}
              </span>
              {m.tipo === 'DOTACION' ? (
                <button disabled={ocupado} onClick={() => pedirDeshacer(m.id)} style={{
                  ...btnMini, justifySelf: 'end',
                  background: esConfirm ? ROJO : BLANCO, color: esConfirm ? BLANCO : GRIS,
                  borderColor: esConfirm ? ROJO : INK,
                }}>
                  {esConfirm ? '¿Seguro?' : 'Deshacer'}
                </button>
              ) : <span />}
            </div>
          )
        })}
      </div>

      {/* ══ CUENTA DE RESERVA (configuración de la conciliación bancaria) ══ */}
      <div style={{ ...card, marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={eyebrow(AZUL, BLANCO)}>Cuenta de reserva</span>
          <button onClick={() => setConfigOpen(v => !v)} style={{ ...btnMini, background: BLANCO, color: INK }}>
            {configOpen ? 'Cerrar' : 'Configurar'}
          </button>
        </div>
        <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 10 }}>
          Cuenta destino: <strong style={{ color: INK }}>{cfg?.cuenta_destino ?? '—'}</strong>
          {' · '}Texto del traspaso en banco: {cfg?.match_traspaso
            ? <strong style={{ color: INK }}>«{cfg.match_traspaso}»</strong>
            : <strong style={{ color: ROJO }}>sin configurar</strong>}
          {' · '}Margen: <strong style={{ color: INK }}>{cfg?.tolerancia_dias ?? 3} días</strong>
        </div>
        {!cfg?.match_traspaso && !configOpen && (
          <div style={{ fontFamily: LEX, fontSize: 11.5, color: ROJO, marginTop: 6 }}>
            Sin el texto del traspaso, «Revisar banco» no puede casar los ingresos. Pulsa Configurar.
          </div>
        )}
        {configOpen && (
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, alignItems: 'end' }}>
            <label style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS }}>
              Nombre de la cuenta
              <input value={cuentaEdit} onChange={e => setCuentaEdit(e.target.value)} placeholder="p.ej. BBVA Reserva"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '9px 10px', border: `2px solid ${AZUL}`, background: BLANCO, fontFamily: OSW, fontWeight: 600, fontSize: 13, outline: 'none', color: INK }} />
            </label>
            <label style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS }}>
              Texto que aparece en el banco
              <input value={matchEdit} onChange={e => setMatchEdit(e.target.value)} placeholder="p.ej. TRASPASO RESERVA"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '9px 10px', border: `2px solid ${AZUL}`, background: BLANCO, fontFamily: OSW, fontWeight: 600, fontSize: 13, outline: 'none', color: INK }} />
            </label>
            <label style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS }}>
              Margen de días
              <input type="number" min={0} step={1} value={tolEdit} onChange={e => setTolEdit(parseInt(e.target.value) || 0)}
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '9px 10px', border: `2px solid ${AZUL}`, background: BLANCO, fontFamily: OSW, fontWeight: 600, fontSize: 13, textAlign: 'right', outline: 'none', color: INK }} />
            </label>
            <button onClick={guardarCuenta} style={{ ...btn, background: GRANATE, color: BLANCO }}>Guardar cuenta</button>
          </div>
        )}
      </div>
    </div>
  )
}

const card: CSSProperties = {
  background: `var(--neo-card, ${BLANCO})`, border: BORDER_CARD, boxShadow: SHADOW, padding: '18px 20px',
}
const btn: CSSProperties = {
  border: BORDER_CARD, boxShadow: '3px 3px 0 var(--neo-shadow-color)', padding: '11px 18px',
  fontFamily: OSW, fontWeight: 700, fontSize: 13.5, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer',
}
const btnMini: CSSProperties = {
  border: `2px solid ${INK}`, padding: '6px 10px',
  fontFamily: OSW, fontWeight: 700, fontSize: 11.5, letterSpacing: 0.5, textTransform: 'uppercase', cursor: 'pointer',
}
const pill: CSSProperties = {
  border: `2px solid ${INK}`, padding: '5px 10px',
  fontFamily: OSW, fontWeight: 700, fontSize: 13, cursor: 'pointer',
}
const miniLbl: CSSProperties = {
  fontFamily: OSW, fontWeight: 600, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, marginTop: 4,
}

export default FondoReserva
