/**
 * TabCostes — coste real del equipo del mes: nóminas (neto o pagado real),
 * RLC de Seguridad Social, cuotas de autónomos (Rubén/Emilio) y extras Bizum
 * (Fernando). LEY-PRUDENCIA-01: un importe se fija "comprometido" en cuanto se
 * conoce (nómina creada, RLC recibido, cuota del mes) aunque no haya salido del
 * banco; pasa a "pagado" solo cuando aparece el cargo real en conciliación.
 * Nunca se anticipan ingresos, esto es solo gasto.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useNominasCompletas } from '@/lib/equipo/useNominasCompletas'
import { buscarBizumMes } from '@/lib/equipo/bizumExtra'
import { fmtEur, fmtDate } from '@/lib/format'
import { fechaLocalStr } from '@/utils/fechaLocal'
import { OSW, LEX, INK, CREMA, CLARO, SHADOW, BORDER_CARD, AMA, VERDE, ROJO, GRIS, BLANCO, eyebrow, d } from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'

const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const card: React.CSSProperties = { background: BLANCO, border: BORDER_CARD, boxShadow: SHADOW }

type EstadoPago = 'pagado' | 'comprometido' | 'sin_registrar'

interface FilaCoste {
  concepto: string
  detalle: string
  importe: number | null
  estado: EstadoPago
  fecha: string | null
}

interface SSResumenRow {
  id: string
  importe: number | null
  fecha_cargo: string | null
}
interface Titular {
  id: string
  nombre: string
}
interface AutonomoCuota {
  id: string
  titular_id: string
  importe: number | null
  estado: EstadoPago
  fecha_cargo: string | null
  conciliacion_id: string | null
}
interface ConciliacionRow {
  id: string
  fecha: string
  concepto: string | null
  proveedor: string | null
  importe: number
}

function sumaDias(fechaISO: string, dias: number): string {
  const [y, m, dd] = fechaISO.split('-').map(Number)
  const dt = new Date(y, m - 1, dd)
  dt.setDate(dt.getDate() + dias)
  return fechaLocalStr(dt)
}

function estadoBadge(estado: EstadoPago): { label: string; bg: string; color: string } {
  if (estado === 'pagado') return { label: 'Pagado', bg: VERDE, color: BLANCO }
  if (estado === 'comprometido') return { label: 'Comprometido', bg: AMA, color: INK }
  return { label: 'Sin registrar', bg: CLARO, color: GRIS }
}

export default function TabCostes() {
  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())
  const anios = [anio - 1, anio, anio + 1]

  const { loading: loadingNominas, nominas } = useNominasCompletas(anio)
  const [ssResumen, setSsResumen] = useState<SSResumenRow | null>(null)
  const [rlcPago, setRlcPago] = useState<{ importe: number; fecha: string } | null>(null)
  const [ventanaTgss, setVentanaTgss] = useState<{ dias_antes: number; dias_despues: number }>({ dias_antes: 5, dias_despues: 35 })
  const [titulares, setTitulares] = useState<Titular[]>([])
  const [cuotas, setCuotas] = useState<AutonomoCuota[]>([])
  const [fernandoNombre, setFernandoNombre] = useState<string | null>(null)
  const [bizumFernando, setBizumFernando] = useState<{ importe: number; fecha: string } | null>(null)
  const [loadingResto, setLoadingResto] = useState(true)
  const [barrido, setBarrido] = useState<{ revisadas: number; asociadas: number } | null>(null)

  // Barrido automático de cruce nómina↔banco al abrir Costes (alta confianza, sin bajar umbrales).
  useEffect(() => {
    let cancelado = false
    fetch('/api/nominas/barrido', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anio }),
    })
      .then(r => r.json())
      .then(data => { if (!cancelado && data?.ok) setBarrido({ revisadas: data.revisadas ?? 0, asociadas: (data.asociadas ?? []).length }) })
      .catch(() => { /* el barrido es una mejora silenciosa: si falla, la vista sigue funcionando */ })
    return () => { cancelado = true }
  }, [anio])

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setLoadingResto(true)

      const [ss, tgss, tits, extra] = await Promise.all([
        supabase.from('seguridad_social_resumen').select('id, importe, fecha_cargo').eq('mes', mes).eq('anio', anio).maybeSingle(),
        supabase.from('matching_config').select('dias_antes, dias_despues').eq('proveedor', 'tgss').eq('activo', true).maybeSingle(),
        supabase.from('titulares').select('id, nombre').eq('activo', true).order('orden'),
        supabase.from('empleados').select('nombre').eq('tipo_relacion', 'extra').eq('estado', 'activo').maybeSingle(),
      ])
      if (cancelado) return
      setSsResumen((ss.data as SSResumenRow) ?? null)
      const ventana = tgss.data ? { dias_antes: tgss.data.dias_antes, dias_despues: tgss.data.dias_despues } : ventanaTgss
      setVentanaTgss(ventana)
      const tits2 = (tits.data ?? []) as Titular[]
      setTitulares(tits2)
      setFernandoNombre((extra.data as { nombre: string } | null)?.nombre ?? null)

      // Cruce RLC ↔ banco: importe exacto dentro de la ventana TGSS de matching_config.
      let rlcConc: ConciliacionRow[] = []
      if (ss.data?.fecha_cargo) {
        const va = ventana.dias_antes, vd = ventana.dias_despues
        const desde = sumaDias(ss.data.fecha_cargo, -va)
        const hasta = sumaDias(ss.data.fecha_cargo, vd)
        const { data } = await supabase.from('conciliacion').select('id, fecha, concepto, proveedor, importe')
          .eq('tipo', 'gasto').gte('fecha', desde).lte('fecha', hasta)
        rlcConc = (data ?? []) as ConciliacionRow[]
      }
      const rlcImporte = ss.data?.importe != null ? Number(ss.data.importe) : null
      const rlcMatch = rlcImporte != null ? rlcConc.find(c => Math.abs(Math.abs(Number(c.importe)) - rlcImporte) < 0.005) : undefined
      setRlcPago(rlcMatch ? { importe: Math.abs(Number(rlcMatch.importe)), fecha: rlcMatch.fecha } : null)

      // Cuotas de autónomos del mes (tabla nueva, se puebla desde Papeleo → Equipo).
      // Cruce con banco por TITULAR (cuentas distintas de Rubén y Emilio: nunca
      // cruzar la cuota de uno con el banco del otro) + importe exacto + ventana TGSS.
      const { data: cuotasData } = await supabase.from('autonomos_cuotas')
        .select('id, titular_id, importe, estado, fecha_cargo, conciliacion_id').eq('mes', mes).eq('anio', anio)
      const cuotasFilas = (cuotasData ?? []) as AutonomoCuota[]
      const cuotasResueltas = await Promise.all(cuotasFilas.map(async c => {
        if (c.estado === 'pagado' || c.conciliacion_id || !c.fecha_cargo || c.importe == null) return c
        const va = ventana.dias_antes, vd = ventana.dias_despues
        const desde = sumaDias(c.fecha_cargo, -va)
        const hasta = sumaDias(c.fecha_cargo, vd)
        const { data } = await supabase.from('conciliacion').select('id, fecha, importe')
          .eq('tipo', 'gasto').eq('titular_id', c.titular_id).gte('fecha', desde).lte('fecha', hasta)
        const match = ((data ?? []) as { id: string; fecha: string; importe: number }[])
          .find(m => Math.abs(Math.abs(Number(m.importe)) - Number(c.importe)) < 0.005)
        if (!match) return c
        await supabase.from('autonomos_cuotas').update({ estado: 'pagado', conciliacion_id: match.id }).eq('id', c.id)
        return { ...c, estado: 'pagado' as EstadoPago, conciliacion_id: match.id, fecha_cargo: match.fecha }
      }))
      if (!cancelado) setCuotas(cuotasResueltas)

      // Extra Bizum: búsqueda por nombre real en conciliación del mes (sin fuzzy inventado).
      const nombreExtra = (extra.data as { nombre: string } | null)?.nombre
      setBizumFernando(nombreExtra ? await buscarBizumMes(supabase, nombreExtra, mes, anio) : null)

      setLoadingResto(false)
    }
    cargar()
    return () => { cancelado = true }
  }, [mes, anio])

  const nominasMes = useMemo(() => nominas.filter(n => n.mes === mes), [nominas, mes])

  const filasNomina: FilaCoste[] = useMemo(() => nominasMes.map(n => {
    const pagado = n.clasificacion !== 'sin_pago'
    const importe = pagado ? n.totalPagado : (n.importe_neto ?? null)
    const fecha = n.pagos.find(p => p.confirmado)?.fecha ?? null
    return {
      concepto: `Nómina · ${n.empleado_nombre}`,
      detalle: pagado ? `Pagado real (neto nómina ${fmtEur(n.importe_neto, { decimals: 2 })})` : 'Neto de nómina (aún sin ver en banco)',
      importe, estado: pagado ? 'pagado' : 'comprometido', fecha,
    }
  }), [nominasMes])

  const filaRlc: FilaCoste = useMemo(() => {
    if (!ssResumen) return { concepto: 'RLC Seguridad Social', detalle: 'Sin resumen registrado este mes', importe: null, estado: 'sin_registrar', fecha: null }
    if (rlcPago) return { concepto: 'RLC Seguridad Social', detalle: 'Visto en banco', importe: rlcPago.importe, estado: 'pagado', fecha: rlcPago.fecha }
    return { concepto: 'RLC Seguridad Social', detalle: 'Recibido, aún sin ver en banco', importe: ssResumen.importe, estado: 'comprometido', fecha: ssResumen.fecha_cargo }
  }, [ssResumen, rlcPago])

  const filasAutonomos: FilaCoste[] = useMemo(() => titulares.map(t => {
    const c = cuotas.find(cc => cc.titular_id === t.id)
    if (!c) return { concepto: `Cuota autónomos · ${t.nombre}`, detalle: 'Sin registrar', importe: null, estado: 'sin_registrar', fecha: null }
    return {
      concepto: `Cuota autónomos · ${t.nombre}`,
      detalle: c.estado === 'pagado' ? 'Visto en banco' : 'Comprometida, aún sin ver en banco',
      importe: c.importe, estado: c.estado, fecha: c.fecha_cargo,
    }
  }), [titulares, cuotas])

  const filaBizum: FilaCoste = useMemo(() => {
    if (!fernandoNombre) return { concepto: 'Extra Bizum', detalle: 'Sin empleado extra activo', importe: null, estado: 'sin_registrar', fecha: null }
    if (!bizumFernando) return { concepto: `Extra Bizum · ${fernandoNombre}`, detalle: 'Sin movimiento identificado este mes', importe: null, estado: 'sin_registrar', fecha: null }
    return { concepto: `Extra Bizum · ${fernandoNombre}`, detalle: 'Visto en banco', importe: bizumFernando.importe, estado: 'pagado', fecha: bizumFernando.fecha }
  }, [fernandoNombre, bizumFernando])

  const todasLasFilas = useMemo(() => [...filasNomina, filaRlc, ...filasAutonomos, filaBizum], [filasNomina, filaRlc, filasAutonomos, filaBizum])

  const kpis = useMemo(() => {
    let pagado = 0, comprometido = 0
    for (const f of todasLasFilas) {
      if (f.importe == null) continue
      if (f.estado === 'pagado') pagado += f.importe
      else if (f.estado === 'comprometido') comprometido += f.importe
    }
    return { total: pagado + comprometido, pagado, comprometido }
  }, [todasLasFilas])

  const loading = loadingNominas || loadingResto
  const mesLabel = `${MESES_LARGO[mes - 1]} ${anio}`
  const tituloHero = kpis.total === 0
    ? `Aún no hay coste de equipo registrado en ${mesLabel}.`
    : kpis.comprometido > 0
    ? `Este mes el equipo cuesta ${fmtEur(kpis.total, { decimals: 0 })}, con parte aún sin ver en banco.`
    : `Este mes el equipo cuesta ${fmtEur(kpis.total, { decimals: 0 })}, todo pagado.`

  return (
    <PantallaCantera embedded>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={mes} onChange={e => setMes(parseInt(e.target.value))} style={selectNeo}>
          {MESES_LARGO.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={anio} onChange={e => setAnio(parseInt(e.target.value))} style={selectNeo}>
          {anios.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {barrido && barrido.asociadas > 0 && (
          <span style={{ ...eyebrow(VERDE, BLANCO), fontSize: 10 }}>
            Barrido automático: {barrido.asociadas} pago{barrido.asociadas !== 1 ? 's' : ''} de alta confianza asociado{barrido.asociadas !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <HeroCantera
        area="equipo"
        periodo={mesLabel}
        titular={tituloHero}
        etiquetaDato="Coste total del equipo"
        cifra={fmtEur(kpis.total, { decimals: 2 })}
        atencion={[
          kpis.comprometido > 0 ? `Comprometido ${fmtEur(kpis.comprometido, { decimals: 0 })}` : null,
          kpis.pagado > 0 ? `Pagado ${fmtEur(kpis.pagado, { decimals: 0 })}` : null,
        ]}
      />
      <Plancha>
        <PlanchaCelda bg={BLANCO} first>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600, color: GRIS }}>Coste total del mes</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(kpis.total, { decimals: 2 })}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={kpis.comprometido > 0 ? AMA : BLANCO}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Comprometido</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(kpis.comprometido, { decimals: 2 })}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={VERDE}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Pagado</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(kpis.pagado, { decimals: 2 })}</div>
        </PlanchaCelda>
      </Plancha>

      <SeccionLabel bg={INK} color={CREMA}>Detalle de partidas</SeccionLabel>
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: GRIS, fontFamily: LEX }}>Cargando…</div>
      ) : (
        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: INK }}>
                {['Partida', 'Detalle', 'Fecha de cargo', 'Estado', 'Importe'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 12px', textAlign: i === 4 ? 'right' : 'left', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {todasLasFilas.map((f, i) => {
                const badge = estadoBadge(f.estado)
                return (
                  <tr key={i} style={{ borderBottom: `2px solid ${INK}` }}>
                    <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600 }}>{f.concepto}</td>
                    <td style={{ padding: '10px 12px', color: GRIS }}>{f.detalle}</td>
                    <td style={{ padding: '10px 12px', color: GRIS }}>{f.fecha ? fmtDate(f.fecha) : '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontFamily: OSW, fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase',
                        border: `2px solid ${INK}`, padding: '3px 9px', background: badge.bg, color: badge.color,
                      }}>{badge.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: OSW, fontWeight: 700 }}>
                      {f.importe != null ? fmtEur(f.importe, { decimals: 2 }) : <span style={{ color: GRIS }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: INK }}>
                <td colSpan={4} style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 700, color: CREMA, textTransform: 'uppercase', letterSpacing: '1px', fontSize: 12 }}>Total</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: OSW, fontWeight: 700, color: CREMA }}>{fmtEur(kpis.total, { decimals: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </PantallaCantera>
  )
}

const selectNeo: React.CSSProperties = { background: BLANCO, border: `3px solid ${INK}`, color: INK, padding: '7px 12px', fontFamily: OSW, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', outline: 'none' }
