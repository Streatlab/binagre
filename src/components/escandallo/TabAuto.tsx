// TabAuto — bandeja de automatización del Escandallo (ESCANDALLO 2.0, Fases A+C+D)
// A: procesar 1 factura de materia prima (extraer líneas del PDF → ingredientes/precios solos),
//    ingredientes pre-creados pendientes de completar, alertas de subida de precio.
// C: inventario quincenal por foto (leer → confirmar) con confianza por línea.
// D: coste real del periodo y varianza teórico vs real en €.
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import type { Ingrediente } from './types'
import { fmtES } from './types'
import { INK, CREMA, OSW, LEX, AMA, GRANATE, ROJO, VERDE, GRIS } from '@/styles/neobrutal'
import { th, thR, td, tdNum, zebra } from './estilosTabla'

interface Props { onOpenIngrediente: (ing: Ingrediente) => void }

interface Estado {
  facturas_sin_lineas: number
  ingredientes_borrador: number
  alertas_pendientes: number
  estructura_real: { estructura_pct_real: string | null; ingresos_3m: string | null; ultimo_mes_usado: string | null } | null
  drive_conectado?: boolean
}

interface Alerta {
  id: string
  ingrediente_id: string
  precio_anterior: number
  precio_nuevo: number
  variacion_pct: number
  recetas_afectadas: string[] | null
  created_at: string
  ingredientes?: { nombre: string } | null
}

interface Inventario { id: string; fecha: string; estado: string; origen: string | null }
interface InvLinea {
  id: string
  ingrediente_id: string | null
  cantidad: number
  unidad: string | null
  confianza: number | null
  texto_leido: string | null
  ingredientes?: { nombre: string } | null
}
interface Varianza {
  inicio: string
  fin: string
  ingrediente: string
  consumo_real: number
  consumo_teorico: number
  desviacion_eur: number
}
interface CosteReal { inicio: string; fin: string; inventario_inicial: number; inventario_final: number; compras_periodo: number; coste_real: number }
interface Sugerencia { borrador_id: string; borrador_nombre: string; ingrediente_id: string; ingrediente_nombre: string; similitud: number }
interface IngLite { id: string; nombre: string }
interface RadarAhorro {
  base_key: string
  ud_std: string
  proveedor_barato: string
  eur_std_barato: number
  proveedor_caro: string
  eur_std_caro: number
  ahorro_eur_ud_std: number
  ahorro_pct: number
}
interface PlatoSangra {
  plato: string
  marca: string
  receta_id: string | null
  unidades: number
  ingresos: number
  food_cost_pct: number
  objetivo_pct: number
  sangria_eur: number
  pvp_actual: number
  pvp_objetivo: number
  subida_eur: number
}
interface Sospechoso { ingrediente_id: string; nombre: string; ultimo: number; tipico: number; ratio: number; fecha: string }
interface Mover { ingrediente_id: string; nombre: string; antes: number; ahora: number; var_pct: number }
interface ParetoItem { item: string; gasto: number; pct: number; pct_acumulado: number }
interface MargenMarca { marca: string; unidades: number; ingresos: number; coste_mp: number; food_cost_pct: number; margen_pct: number }
interface MenuPlato { plato: string; marca: string; unidades: number; margen_pct: number; cuadrante: string }
interface SaludRobot { objetivos: number; match_ok: number; dudoso: number; sin_match: number; cargados_10d: number; ultima_ejecucion: string | null }
interface GastoProv { proveedor: string; gasto: number; lineas: number; pct: number; pct_acumulado: number }
interface AlertasResumen { total: number; subidas: number; bajadas: number; cambios_formato: number; mayor_subida_pct: number | null; mayor_bajada_pct: number | null }
interface Motor {
  activo: boolean
  procesadas: number
  total_al_iniciar: number
  ultimo_latido: string | null
  ultimo_mensaje: string | null
}

const API = '/api/papeleo/escandallo-auto'

const card: CSSProperties = { background: 'var(--sl-card)', border: `4px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`, padding: 16 }
const h3: CSSProperties = { fontFamily: OSW, fontWeight: 700, fontSize: 15, letterSpacing: '1px', textTransform: 'uppercase', color: GRANATE, margin: '0 0 10px' }
const btn = (bg: string): CSSProperties => ({ fontFamily: OSW, fontWeight: 700, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', background: bg, color: INK, border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, padding: '8px 14px', cursor: 'pointer' })

export default function TabAuto({ onOpenIngrediente }: Props) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [borradores, setBorradores] = useState<Ingrediente[]>([])
  const [inventario, setInventario] = useState<Inventario | null>(null)
  const [invLineas, setInvLineas] = useState<InvLinea[]>([])
  const [varianza, setVarianza] = useState<Varianza[]>([])
  const [costeReal, setCosteReal] = useState<CosteReal | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [sugerencias, setSugerencias] = useState<Sugerencia[] | null>(null)
  const [fusionAbierta, setFusionAbierta] = useState<string | null>(null)
  const [catalogoIngs, setCatalogoIngs] = useState<IngLite[]>([])
  const [busquedaFusion, setBusquedaFusion] = useState('')
  const [motor, setMotor] = useState<Motor | null>(null)
  const [pendientes, setPendientes] = useState<number | null>(null)
  const [borrPage, setBorrPage] = useState(0)
  const [radar, setRadar] = useState<RadarAhorro[]>([])
  const [sangran, setSangran] = useState<PlatoSangra[]>([])
  const [objetivoFood, setObjetivoFood] = useState(35)
  const [sospechosos, setSospechosos] = useState<Sospechoso[]>([])
  const [movers, setMovers] = useState<Mover[]>([])
  const [inflMediana, setInflMediana] = useState<number | null>(null)
  const [pareto, setPareto] = useState<ParetoItem[]>([])
  const [margenMarca, setMargenMarca] = useState<MargenMarca[]>([])
  const [menuEng, setMenuEng] = useState<MenuPlato[]>([])
  const [saludRobot, setSaludRobot] = useState<SaludRobot | null>(null)
  const [gastoProv, setGastoProv] = useState<GastoProv[]>([])
  const [alertasResumen, setAlertasResumen] = useState<AlertasResumen | null>(null)

  const cargar = useCallback(async () => {
    const [est, al, bo, inv, vza, cr, rad, san, sos, infl, par, mm, me, sr, gp, ar] = await Promise.all([
      fetch(`${API}/estado`).then(r => r.ok ? r.json() : null).catch(() => null),
      supabase.from('alertas_precio').select('*, ingredientes(nombre)').eq('estado', 'pendiente').order('created_at', { ascending: false }).limit(30),
      supabase.from('ingredientes').select('*').eq('borrador', true).order('created_at', { ascending: false }).limit(50),
      supabase.from('inventarios').select('id, fecha, estado, origen').neq('estado', 'confirmado').order('fecha', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('v_varianza_ingrediente_periodo').select('*').order('desviacion_eur', { ascending: false }).limit(200),
      supabase.from('v_coste_real_periodo').select('*').order('fin', { ascending: false }).limit(1).maybeSingle(),
      fetch(`${API}/radar-ahorro`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/platos-sangran`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/precios-sospechosos`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/inflacion`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/pareto-compras`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/margen-marca`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/menu-engineering`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/salud-robot`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/gasto-proveedor`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/alertas-resumen`).then(r => r.ok ? r.json() : null).catch(() => null),
    ])
    setEstado(est)
    setAlertas((al.data as Alerta[]) ?? [])
    setBorradores((bo.data as Ingrediente[]) ?? [])
    setRadar((rad?.radar as RadarAhorro[]) ?? [])
    setSangran((san?.platos as PlatoSangra[]) ?? [])
    if (san?.objetivo_pct != null) setObjetivoFood(san.objetivo_pct)
    setSospechosos((sos?.sospechosos as Sospechoso[]) ?? [])
    setMovers((infl?.movers as Mover[]) ?? [])
    setInflMediana(infl?.mediana_var_pct ?? null)
    setPareto((par?.pareto as ParetoItem[]) ?? [])
    setMargenMarca((mm?.marcas as MargenMarca[]) ?? [])
    setMenuEng((me?.platos as MenuPlato[]) ?? [])
    setSaludRobot((sr?.salud as SaludRobot) ?? null)
    setGastoProv((gp?.proveedores as GastoProv[]) ?? [])
    setAlertasResumen((ar?.resumen as AlertasResumen) ?? null)
    setInventario((inv.data as Inventario) ?? null)
    const ultimo = ((vza.data as Varianza[]) ?? [])
    const ultFin = ultimo.length ? ultimo.reduce((mx, v) => v.fin > mx ? v.fin : mx, ultimo[0].fin) : null
    setVarianza(ultFin ? ultimo.filter(v => v.fin === ultFin).sort((a, b) => Math.abs(b.desviacion_eur) - Math.abs(a.desviacion_eur)).slice(0, 25) : [])
    setCosteReal((cr.data as CosteReal) ?? null)
    if ((inv.data as Inventario)?.id) {
      const { data } = await supabase.from('inventario_lineas').select('id, ingrediente_id, cantidad, unidad, confianza, texto_leido, ingredientes(nombre)').eq('inventario_id', (inv.data as Inventario).id).order('created_at')
      setInvLineas((data as unknown as InvLinea[]) ?? [])
    } else {
      setInvLineas([])
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])


  /* ── SUPERPERSISTENCIA: el trabajo corre en el servidor (cron empujador). La UI solo
     lo pinta con polling a motor-estado; sobrevive a F5, cambio de módulo y cierre. ── */
  const leerMotor = useCallback(async () => {
    try {
      const r = await fetch(`${API}/motor-estado`)
      const j = await r.json()
      if (j.ok) { setMotor(j.motor as Motor); setPendientes(j.pendientes ?? null) }
    } catch { /* silencioso: reintenta al siguiente ciclo */ }
  }, [])

  useEffect(() => {
    leerMotor()
    const id = setInterval(leerMotor, 5000)
    return () => clearInterval(id)
  }, [leerMotor])

  // Cuando el motor pasa de activo a apagado, refrescamos la bandeja (borradores, alertas…).
  const motorActivo = !!motor?.activo
  useEffect(() => { if (!motorActivo) cargar() }, [motorActivo, cargar])

  const arrancarMotor = async () => {
    setBusy('motor')
    try {
      const r = await fetch(`${API}/motor-arrancar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'no se pudo arrancar')
      setMotor(j.motor as Motor)
      setMsg(j.pendientes > 0 ? 'Procesando en 2º plano. Puedes cerrar esta pestaña, el proceso sigue solo.' : 'No hay facturas pendientes.')
    } catch (e: any) { setMsg(`Error: ${e.message}`) } finally { setBusy(null) }
  }
  const pararMotor = async () => {
    setBusy('motor')
    try {
      const r = await fetch(`${API}/motor-parar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'no se pudo parar')
      setMotor(j.motor as Motor)
    } catch (e: any) { setMsg(`Error: ${e.message}`) } finally { setBusy(null) }
  }

  /* ── T3.3: sugerencias de fusión (solo propone) ── */
  const cargarSugerencias = async () => {
    setBusy('sugerencias')
    try {
      const r = await fetch(`${API}/sugerir-fusiones`)
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      setSugerencias((j.sugerencias as Sugerencia[]) ?? [])
    } catch (e: any) { setMsg(`Error: ${e.message}`) } finally { setBusy(null) }
  }

  /* ── T3.2: fusionar-borrador (1 clic, con confirmación) ── */
  const fusionar = async (borradorId: string, ingredienteId: string, nombreDestino: string) => {
    if (!confirm(`¿Fusionar este borrador con "${nombreDestino}"? El borrador desaparecerá; su histórico y alias pasan a "${nombreDestino}".`)) return
    setBusy(`fusion-${borradorId}`)
    try {
      const r = await fetch(`${API}/fusionar-borrador`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ borrador_id: borradorId, ingrediente_id: ingredienteId }) })
      const j = await r.json()
      if (!j.ok) throw new Error(j.motivo || j.error || 'no se pudo fusionar')
      setMsg(`Fusionado con "${j.nombre_destino ?? nombreDestino}".`)
      setSugerencias(s => s?.filter(x => x.borrador_id !== borradorId) ?? null)
      setFusionAbierta(null)
      await cargar()
    } catch (e: any) { setMsg(`Error: ${e.message}`) } finally { setBusy(null) }
  }

  const abrirBuscadorFusion = async (borradorId: string) => {
    if (fusionAbierta === borradorId) { setFusionAbierta(null); return }
    setFusionAbierta(borradorId)
    setBusquedaFusion('')
    if (!catalogoIngs.length) {
      const { data } = await supabase.from('ingredientes').select('id, nombre').eq('borrador', false).order('nombre').limit(2000)
      setCatalogoIngs((data as IngLite[]) ?? [])
    }
  }

  const marcarAlerta = async (id: string) => {
    await supabase.from('alertas_precio').update({ estado: 'vista' }).eq('id', id)
    setAlertas(a => a.filter(x => x.id !== id))
  }

  /* ── Fase C ── */
  const crearInventario = async () => {
    setBusy('inv')
    const { data } = await supabase.from('inventarios').insert({ fecha: new Date().toISOString().slice(0, 10), estado: 'borrador', tipo: 'quincenal' }).select().single()
    setInventario((data as Inventario) ?? null)
    setInvLineas([])
    setBusy(null)
  }

  const subirFoto = async (file: File) => {
    if (!inventario) return
    setBusy('foto'); setMsg(null)
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const rd = new FileReader()
        rd.onload = () => res(String(rd.result).split(',')[1])
        rd.onerror = () => rej(new Error('No se pudo leer la foto'))
        rd.readAsDataURL(file)
      })
      const r = await fetch(`${API}/leer-conteo`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inventario_id: inventario.id, imagen_base64: b64, media_type: file.type || 'image/jpeg' }),
      })
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      setMsg(`Foto leída: ${j.insertadas} líneas.`)
      await cargar()
    } catch (e: any) { setMsg(`Error leyendo foto: ${e.message}`) } finally { setBusy(null) }
  }

  const borrarLinea = async (id: string) => {
    await supabase.from('inventario_lineas').delete().eq('id', id)
    setInvLineas(l => l.filter(x => x.id !== id))
  }

  const confirmarInventario = async () => {
    if (!inventario) return
    setBusy('confirmar'); setMsg(null)
    try {
      const r = await fetch(`${API}/confirmar-conteo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inventario_id: inventario.id }) })
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      setMsg(j.lineas_sin_vincular_ignoradas > 0
        ? `Inventario confirmado. Ojo: ${j.lineas_sin_vincular_ignoradas} líneas sin vincular quedaron fuera.`
        : 'Inventario confirmado.')
      await cargar()
    } catch (e: any) { setMsg(`Error: ${e.message}`) } finally { setBusy(null) }
  }

  const estrReal = estado?.estructura_real?.estructura_pct_real
  const sinVincular = invLineas.filter(l => !l.ingrediente_id).length
  const driveOff = estado?.drive_conectado === false

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {msg && (
        <div style={{ background: AMA, border: `3px solid ${INK}`, boxShadow: `4px 4px 0 ${INK}`, padding: '10px 14px', fontFamily: LEX, fontSize: 13, fontWeight: 600, color: INK }}>{msg}</div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        {[
          { t: 'Facturas MP sin líneas', v: estado?.facturas_sin_lineas ?? '—' },
          { t: 'Ingredientes por completar', v: estado?.ingredientes_borrador ?? borradores.length },
          { t: 'Alertas de precio', v: estado?.alertas_pendientes ?? alertas.length },
          { t: 'Estructura real (Running)', v: estrReal != null ? `${fmtES(Number(estrReal), 1)}%` : 'sin dato' },
        ].map((k, i) => (
          <div key={i} style={card}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS }}>{k.t}</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 30, color: INK, marginTop: 2 }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Fase A · procesar facturas (motor superpersistente) */}
      <div style={card}>
        <h3 style={h3}>Facturas de materia prima → ingredientes y precios (automático)</h3>
        <p style={{ fontFamily: LEX, fontSize: 13, color: INK, margin: '0 0 10px' }}>
          Lee las facturas (PDF de Drive), extrae sus líneas y las cruza solas: producto conocido → actualiza precio y recalcula escandallos; producto nuevo → lo pre-crea y deja tarea. Coste: céntimos por factura.
        </p>
        {driveOff && (
          <p style={{ fontFamily: LEX, fontSize: 13, color: ROJO, fontWeight: 700, margin: '0 0 10px' }}>
            Drive no está conectado. Ve a Configuración → Integraciones → Drive y conéctalo primero.
          </p>
        )}

        {motorActivo ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 13, color: GRANATE }}>
              Procesando en 2º plano… {motor?.procesadas ?? 0} / {motor?.total_al_iniciar ?? 0}
            </div>
            <div style={{ background: 'var(--sl-card)', border: `2px solid ${INK}`, height: 16, width: '100%', maxWidth: 420 }}>
              <div style={{ background: VERDE, height: '100%', width: `${motor && motor.total_al_iniciar > 0 ? Math.min(100, Math.round((motor.procesadas / motor.total_al_iniciar) * 100)) : 0}%`, transition: 'width .4s' }} />
            </div>
            {motor?.ultimo_mensaje && <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>{motor.ultimo_mensaje}</div>}
            <div style={{ fontFamily: LEX, fontSize: 12, color: INK, fontWeight: 600 }}>Puedes cerrar esta pestaña, el proceso sigue solo.</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button style={btn(ROJO)} disabled={busy === 'motor'} onClick={pararMotor}>Parar</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button style={btn(AMA)} disabled={busy === 'motor' || driveOff || (pendientes ?? 0) === 0} onClick={arrancarMotor}>
              Procesar todo (en 2º plano){pendientes != null ? ` · ${pendientes} pendiente(s)` : ''}
            </button>
            {motor?.ultimo_mensaje && !motorActivo && (
              <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>{motor.ultimo_mensaje}</span>
            )}
          </div>
        )}
      </div>

      {/* Radar de ahorro · mismo producto, proveedor más barato por unidad estándar */}
      {!!radar.length && (
        <div style={card}>
          <h3 style={h3}>Radar de ahorro · mismo producto, súper más barato</h3>
          <p style={{ fontFamily: LEX, fontSize: 13, color: INK, margin: '0 0 10px' }}>
            Comparado por precio por unidad estándar (sin merma). Estos productos te salen más baratos cambiando de proveedor.
          </p>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={th}>PRODUCTO</th><th style={th}>COMPRA EN</th><th style={thR}>PRECIO/UD</th><th style={th}>EN VEZ DE</th><th style={thR}>PRECIO/UD</th><th style={thR}>AHORRO</th></tr></thead>
            <tbody>
              {radar.map((r, i) => (
                <tr key={`${r.base_key}-${r.ud_std}`} style={{ background: zebra(i) }}>
                  <td style={{ ...td, fontWeight: 700, textTransform: 'capitalize' }}>{r.base_key}</td>
                  <td style={{ ...td, color: VERDE, fontWeight: 700 }}>{r.proveedor_barato}</td>
                  <td style={tdNum}>{fmtES(r.eur_std_barato, 2)} €/{r.ud_std}</td>
                  <td style={{ ...td, color: GRIS }}>{r.proveedor_caro}</td>
                  <td style={{ ...tdNum, color: GRIS }}>{fmtES(r.eur_std_caro, 2)} €/{r.ud_std}</td>
                  <td style={{ ...tdNum, color: VERDE, fontWeight: 700 }}>−{fmtES(r.ahorro_pct, 0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Salud del robot de precios · cobertura y frescura */}
      {saludRobot && saludRobot.objetivos > 0 && (
        <div style={card}>
          <h3 style={h3}>Salud del robot de precios</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
            {[
              { t: 'Objetivos', v: saludRobot.objetivos },
              { t: 'Emparejados', v: `${saludRobot.match_ok} (${Math.round(saludRobot.match_ok / saludRobot.objetivos * 100)}%)` },
              { t: 'Dudosos', v: saludRobot.dudoso },
              { t: 'Sin match', v: saludRobot.sin_match },
              { t: 'Precios cargados (10d)', v: saludRobot.cargados_10d },
            ].map((k, i) => (
              <div key={i}>
                <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS }}>{k.t}</div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, color: INK }}>{k.v}</div>
              </div>
            ))}
          </div>
          {saludRobot.ultima_ejecucion && (
            <p style={{ fontFamily: LEX, fontSize: 12, color: GRIS, margin: '10px 0 0' }}>
              Última pasada: {new Date(saludRobot.ultima_ejecucion).toLocaleString('es-ES')}
            </p>
          )}
        </div>
      )}

      {/* Guardián anti-error de lectura · precios que se disparan o se desploman */}
      {!!sospechosos.length && (
        <div style={{ ...card, borderColor: ROJO, boxShadow: `6px 6px 0 ${ROJO}` }}>
          <h3 style={{ ...h3, color: ROJO }}>⚠ Precios sospechosos · revisa antes de fiarte (posible error de lectura)</h3>
          <p style={{ fontFamily: LEX, fontSize: 13, color: INK, margin: '0 0 10px' }}>
            El último precio se dispara ×4 o cae a ¼ frente a lo habitual. Suele ser una coma mal leída en la factura. Ábrelo y corrígelo si está mal, para que no contamine el escandallo.
          </p>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={th}>INGREDIENTE</th><th style={thR}>PRECIO LEÍDO</th><th style={thR}>HABITUAL</th><th style={thR}>×</th><th style={th} /></tr></thead>
            <tbody>
              {sospechosos.map((s, i) => (
                <tr key={s.ingrediente_id} style={{ background: zebra(i) }}>
                  <td style={{ ...td, fontWeight: 700 }}>{s.nombre}</td>
                  <td style={{ ...tdNum, color: ROJO, fontWeight: 700 }}>{fmtES(s.ultimo, 2)} €</td>
                  <td style={tdNum}>{fmtES(s.tipico, 2)} €</td>
                  <td style={{ ...tdNum, color: ROJO }}>{fmtES(s.ratio, 2)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button style={btn(AMA)} onClick={() => onOpenIngrediente({ id: s.ingrediente_id, nombre: s.nombre } as Ingrediente)}>Revisar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Platos que sangran · food cost real por encima del objetivo × ventas reales */}
      {!!sangran.length && (
        <div style={card}>
          <h3 style={h3}>Platos que sangran · coste por encima del objetivo ({objetivoFood}%)</h3>
          <p style={{ fontFamily: LEX, fontSize: 13, color: INK, margin: '0 0 10px' }}>
            Con el food cost real (que la ingesta mantiene al día) y las unidades vendidas del último mes: cuánto dinero de más te cuesta la materia prima de cada plato. Súbele el precio o abarata el escandallo.
          </p>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={th}>PLATO</th><th style={th}>MARCA</th><th style={thR}>UDS/MES</th><th style={thR}>FOOD COST</th><th style={thR}>PIERDES/MES</th><th style={thR}>PVP AHORA</th><th style={thR}>SÚBELO A</th></tr></thead>
            <tbody>
              {sangran.map((p, i) => (
                <tr key={`${p.plato}-${p.marca}-${i}`} style={{ background: zebra(i) }}>
                  <td style={{ ...td, fontWeight: 700 }}>{p.plato}</td>
                  <td style={{ ...td, fontSize: 12, color: GRIS }}>{p.marca}</td>
                  <td style={tdNum}>{p.unidades}</td>
                  <td style={{ ...tdNum, color: ROJO, fontWeight: 700 }}>{fmtES(p.food_cost_pct, 0)}%</td>
                  <td style={{ ...tdNum, color: ROJO, fontWeight: 700 }}>{fmtES(p.sangria_eur, 2)} €</td>
                  <td style={{ ...tdNum, color: GRIS }}>{fmtES(p.pvp_actual, 2)} €</td>
                  <td style={{ ...tdNum, color: VERDE, fontWeight: 700 }}>{fmtES(p.pvp_objetivo, 2)} € <span style={{ color: GRIS, fontWeight: 400 }}>(+{fmtES(p.subida_eur, 2)})</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Margen por marca · qué marca virtual rinde mejor/peor */}
      {!!margenMarca.length && (
        <div style={card}>
          <h3 style={h3}>Margen por marca · food cost del último mes</h3>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={th}>MARCA</th><th style={thR}>UDS</th><th style={thR}>INGRESOS</th><th style={thR}>FOOD COST</th><th style={thR}>MARGEN</th></tr></thead>
            <tbody>
              {margenMarca.map((m, i) => (
                <tr key={`${m.marca}-${i}`} style={{ background: zebra(i) }}>
                  <td style={{ ...td, fontWeight: 700 }}>{m.marca}</td>
                  <td style={tdNum}>{m.unidades}</td>
                  <td style={tdNum}>{fmtES(m.ingresos, 0)} €</td>
                  <td style={{ ...tdNum, color: m.food_cost_pct > objetivoFood ? ROJO : VERDE, fontWeight: 700 }}>{fmtES(m.food_cost_pct, 0)}%</td>
                  <td style={{ ...tdNum, fontWeight: 700 }}>{fmtES(m.margen_pct, 0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Menu engineering · popularidad × rentabilidad */}
      {!!menuEng.length && (
        <div style={card}>
          <h3 style={h3}>Menu engineering · qué plato es estrella y cuál perro</h3>
          <p style={{ fontFamily: LEX, fontSize: 13, color: INK, margin: '0 0 10px' }}>
            Cruzando lo que vende (popularidad) con lo que deja (margen food), respecto a la mediana de tu carta. ESTRELLA: mímalo. CABALLO: vende pero margen flojo, súbelo. ENIGMA: buen margen, poca venta, promociónalo. PERRO: revísalo o quítalo.
          </p>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={th}>PLATO</th><th style={th}>MARCA</th><th style={thR}>UDS</th><th style={thR}>MARGEN</th><th style={th}>CUADRANTE</th></tr></thead>
            <tbody>
              {menuEng.slice(0, 20).map((p, i) => {
                const col = p.cuadrante === 'ESTRELLA' ? VERDE : p.cuadrante === 'PERRO' ? ROJO : p.cuadrante === 'CABALLO' ? '#f5a623' : GRIS
                return (
                  <tr key={`${p.plato}-${p.marca}-${i}`} style={{ background: zebra(i) }}>
                    <td style={{ ...td, fontWeight: 700 }}>{p.plato}</td>
                    <td style={{ ...td, fontSize: 12, color: GRIS }}>{p.marca}</td>
                    <td style={tdNum}>{p.unidades}</td>
                    <td style={tdNum}>{fmtES(p.margen_pct, 0)}%</td>
                    <td style={{ ...td, fontWeight: 700, color: col }}>{p.cuadrante}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Termómetro de inflación de la despensa */}
      {!!movers.length && (
        <div style={card}>
          <h3 style={h3}>Termómetro de la despensa · {inflMediana != null ? `${inflMediana > 0 ? '+' : ''}${fmtES(inflMediana, 1)}% (mediana 45d)` : 'sin dato'}</h3>
          <p style={{ fontFamily: LEX, fontSize: 13, color: INK, margin: '0 0 10px' }}>
            Variación del precio medio de cada ingrediente (últimos 45 días vs los 45-135 anteriores). Indicativo. Los que más se mueven:
          </p>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={th}>INGREDIENTE</th><th style={thR}>ANTES</th><th style={thR}>AHORA</th><th style={thR}>VAR %</th></tr></thead>
            <tbody>
              {movers.map((m, i) => (
                <tr key={m.ingrediente_id} style={{ background: zebra(i) }}>
                  <td style={{ ...td, fontWeight: 700 }}>{m.nombre}</td>
                  <td style={tdNum}>{fmtES(m.antes, 2)} €</td>
                  <td style={tdNum}>{fmtES(m.ahora, 2)} €</td>
                  <td style={{ ...tdNum, color: m.var_pct > 0 ? ROJO : VERDE, fontWeight: 700 }}>{m.var_pct > 0 ? '+' : ''}{fmtES(m.var_pct, 1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pareto de compras · dónde se va el dinero de materia prima (90 días) */}
      {!!pareto.length && (
        <div style={card}>
          <h3 style={h3}>Dónde se va el dinero · compras últimos 90 días</h3>
          <p style={{ fontFamily: LEX, fontSize: 13, color: INK, margin: '0 0 10px' }}>
            Tus mayores partidas de compra. En estas es donde más pesa pelear precio (mira el Radar de ahorro).
          </p>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={th}>PARTIDA</th><th style={thR}>GASTO</th><th style={thR}>% DEL TOTAL</th><th style={thR}>% ACUM.</th></tr></thead>
            <tbody>
              {pareto.map((p, i) => (
                <tr key={`${p.item}-${i}`} style={{ background: zebra(i) }}>
                  <td style={{ ...td, fontWeight: 700 }}>{p.item}</td>
                  <td style={{ ...tdNum, fontWeight: 700 }}>{fmtES(p.gasto, 2)} €</td>
                  <td style={tdNum}>{fmtES(p.pct, 1)}%</td>
                  <td style={{ ...tdNum, color: GRIS }}>{fmtES(p.pct_acumulado, 0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Concentración por proveedor · dependencia y poder de negociación (90d) */}
      {!!gastoProv.length && (
        <div style={card}>
          <h3 style={h3}>Concentración por proveedor · compras últimos 90 días</h3>
          <p style={{ fontFamily: LEX, fontSize: 13, color: INK, margin: '0 0 10px' }}>
            Cuánto pesa cada proveedor en tu gasto. Mucha concentración = más poder de negociación, pero también más dependencia.
          </p>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={th}>PROVEEDOR</th><th style={thR}>GASTO</th><th style={thR}>% DEL TOTAL</th><th style={thR}>% ACUM.</th></tr></thead>
            <tbody>
              {gastoProv.map((p, i) => (
                <tr key={`${p.proveedor}-${i}`} style={{ background: zebra(i) }}>
                  <td style={{ ...td, fontWeight: 700 }}>{p.proveedor}</td>
                  <td style={{ ...tdNum, fontWeight: 700 }}>{fmtES(p.gasto, 2)} €</td>
                  <td style={tdNum}>{fmtES(p.pct, 1)}%</td>
                  <td style={{ ...tdNum, color: GRIS }}>{fmtES(p.pct_acumulado, 0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Resumen ejecutivo del backlog de alertas de precio */}
      {alertasResumen && alertasResumen.total > 0 && (
        <div style={{ background: AMA, border: `3px solid ${INK}`, boxShadow: `4px 4px 0 ${INK}`, padding: '10px 14px', fontFamily: LEX, fontSize: 13, fontWeight: 600, color: INK }}>
          <b>{alertasResumen.total} alertas de precio pendientes</b>: {alertasResumen.subidas} subidas, {alertasResumen.bajadas} bajadas
          {alertasResumen.cambios_formato > 0 ? `, ${alertasResumen.cambios_formato} por cambio de formato` : ''}
          {alertasResumen.mayor_subida_pct != null ? `. Mayor subida: +${fmtES(alertasResumen.mayor_subida_pct, 0)}%` : ''}.
        </div>
      )}

      {/* Alertas de precio */}
      {!!alertas.length && (
        <div style={card}>
          <h3 style={h3}>Alertas: ingredientes que han cambiado de precio</h3>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={th}>INGREDIENTE</th><th style={thR}>ANTES €</th><th style={thR}>AHORA €</th><th style={thR}>VAR %</th><th style={th}>PLATOS AFECTADOS</th><th style={th} /></tr></thead>
            <tbody>
              {alertas.map((a, i) => (
                <tr key={a.id} style={{ background: zebra(i) }}>
                  <td style={{ ...td, fontWeight: 700 }}>{a.ingredientes?.nombre ?? '—'}</td>
                  <td style={tdNum}>{fmtES(a.precio_anterior, 2)}</td>
                  <td style={tdNum}>{fmtES(a.precio_nuevo, 2)}</td>
                  <td style={{ ...tdNum, color: a.variacion_pct > 0 ? ROJO : VERDE, fontWeight: 700 }}>{a.variacion_pct > 0 ? '+' : ''}{fmtES(a.variacion_pct, 1)}%</td>
                  <td style={{ ...td, fontSize: 12 }}>{(a.recetas_afectadas ?? []).join(', ') || '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}><button style={btn('var(--sl-card)')} onClick={() => marcarAlerta(a.id)}>Vista</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Borradores · A4: tabla densa paginada (20/pág) */}
      {!!borradores.length && (() => {
        const PS = 20
        const nPag = Math.max(1, Math.ceil(borradores.length / PS))
        const pg = Math.min(borrPage, nPag - 1)
        const vis = borradores.slice(pg * PS, pg * PS + PS)
        const vacio = (v: unknown) => v == null || String(v).trim() === '' || Number(v) === 0
        const chip = (txt: string) => <span key={txt} style={{ fontFamily: OSW, fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', background: AMA, color: INK, border: `2px solid ${INK}`, padding: '1px 6px', marginRight: 4 }}>{txt}</span>
        return (
        <div style={card}>
          <h3 style={h3}>Ingredientes pre-creados · completa lo ámbar y quedan automatizados</h3>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={th}>IDING</th><th style={th}>NOMBRE</th><th style={thR}>PRECIO</th><th style={th}>PROVEEDOR</th><th style={th}>FALTA</th><th style={th} /></tr></thead>
            <tbody>
              {vis.map((b, i) => {
                const falta: string[] = []
                if (vacio((b as any).formato)) falta.push('formato')
                if (vacio((b as any).uds) || vacio((b as any).ud_std)) falta.push('unidades')
                if (vacio((b as any).categoria)) falta.push('categoría')
                if (vacio((b as any).merma_pct)) falta.push('merma')
                return (
                  <tr key={b.id} style={{ background: zebra(i) }}>
                    <td style={{ ...td, fontFamily: OSW, fontWeight: 700, color: GRANATE }}>{(b as any).iding ?? '—'}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{b.nombre}</td>
                    <td style={tdNum}>{b.precio_activo != null ? `${fmtES(b.precio_activo, 2)} €` : '—'}</td>
                    <td style={{ ...td, fontSize: 12, color: GRIS }}>{(b as any).marca ?? '—'}</td>
                    <td style={td}>{falta.length ? falta.map(chip) : <span style={{ color: VERDE, fontWeight: 700 }}>✓ listo</span>}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button style={{ ...btn(AMA), marginRight: 6 }} onClick={() => onOpenIngrediente(b)}>Completar</button>
                      <button style={btn('var(--sl-card)')} onClick={() => abrirBuscadorFusion(b.id)}>{fusionAbierta === b.id ? 'Cerrar' : 'Es el mismo que…'}</button>
                      {fusionAbierta === b.id && (
                        <div style={{ background: 'var(--sl-card)', border: `2px solid ${INK}`, padding: 8, marginTop: 6, minWidth: 260, textAlign: 'left' }}>
                          <input autoFocus placeholder="Buscar ingrediente ya existente…" value={busquedaFusion} onChange={e => setBusquedaFusion(e.target.value)} style={{ width: '100%', fontFamily: LEX, fontSize: 13, padding: '6px 8px', border: `2px solid ${INK}`, marginBottom: 6 }} />
                          <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {catalogoIngs.filter(x => busquedaFusion.trim().length > 1 && x.nombre.toLowerCase().includes(busquedaFusion.trim().toLowerCase())).slice(0, 20).map(x => (
                              <button key={x.id} style={{ ...btn('var(--sl-card)'), textAlign: 'left', fontSize: 11 }} disabled={busy === `fusion-${b.id}`} onClick={() => fusionar(b.id, x.id, x.nombre)}>{x.nombre}</button>
                            ))}
                            {busquedaFusion.trim().length > 1 && !catalogoIngs.some(x => x.nombre.toLowerCase().includes(busquedaFusion.trim().toLowerCase())) && <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>Sin resultados.</span>}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {nPag > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 }}>
              <button style={btn('var(--sl-card)')} disabled={pg === 0} onClick={() => setBorrPage(p => Math.max(0, p - 1))}>◀</button>
              <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 12, color: INK }}>Página {pg + 1} de {nPag} · {borradores.length} pre-creados</span>
              <button style={btn('var(--sl-card)')} disabled={pg >= nPag - 1} onClick={() => setBorrPage(p => Math.min(nPag - 1, p + 1))}>▶</button>
            </div>
          )}

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `2px solid ${INK}` }}>
            <button style={btn(CREMA)} disabled={busy === 'sugerencias'} onClick={cargarSugerencias}>
              {busy === 'sugerencias' ? 'Buscando…' : 'Sugerir fusiones (por nombre parecido)'}
            </button>
            {sugerencias && (
              sugerencias.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                  {sugerencias.map(s => (
                    <div key={`${s.borrador_id}-${s.ingrediente_id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: LEX, fontSize: 13 }}>
                      <span><b>{s.borrador_nombre}</b> ≈ <b>{s.ingrediente_nombre}</b> ({fmtES(s.similitud * 100, 0)}% parecido)</span>
                      <button style={btn(AMA)} disabled={busy === `fusion-${s.borrador_id}`} onClick={() => fusionar(s.borrador_id, s.ingrediente_id, s.ingrediente_nombre)}>
                        Fusionar
                      </button>
                    </div>
                  ))}
                </div>
              ) : <p style={{ fontFamily: LEX, fontSize: 13, color: GRIS, margin: '10px 0 0' }}>Sin candidatos parecidos por ahora.</p>
            )}
          </div>
        </div>
        )
      })()}

      {/* Fase C · inventario quincenal */}
      <div style={card}>
        <h3 style={h3}>Inventario quincenal por foto</h3>
        {!inventario ? (
          <button style={btn(AMA)} disabled={busy === 'inv'} onClick={crearInventario}>Empezar inventario de hoy</button>
        ) : (
          <>
            <p style={{ fontFamily: LEX, fontSize: 13, color: INK, margin: '0 0 10px' }}>
              Inventario del {inventario.fecha} (borrador). Rellena la hoja a mano, hazle fotos y súbelas; revisa lo dudoso y confirma.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <label style={{ ...btn(AMA), display: 'inline-block' }}>
                {busy === 'foto' ? 'Leyendo foto…' : 'Subir foto del conteo'}
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} disabled={busy === 'foto'}
                  onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.currentTarget.value = '' }} />
              </label>
              {!!invLineas.length && (
                <button style={btn(VERDE)} disabled={busy === 'confirmar'} onClick={confirmarInventario}>
                  {busy === 'confirmar' ? 'Confirmando…' : `Confirmar inventario (${invLineas.length - sinVincular} líneas)`}
                </button>
              )}
            </div>
            {!!invLineas.length && (
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead><tr><th style={th}>LEÍDO</th><th style={th}>INGREDIENTE</th><th style={thR}>CANTIDAD</th><th style={th}>UD.</th><th style={th}>CONFIANZA</th><th style={th} /></tr></thead>
                <tbody>
                  {invLineas.map((l, i) => {
                    const conf = l.ingrediente_id ? (l.confianza ?? 0) : 0
                    const col = conf >= 1 ? VERDE : conf > 0 ? AMA : ROJO
                    return (
                      <tr key={l.id} style={{ background: zebra(i) }}>
                        <td style={{ ...td, fontSize: 12, color: GRIS }}>{l.texto_leido ?? ''}</td>
                        <td style={{ ...td, fontWeight: 700 }}>{l.ingredientes?.nombre ?? 'SIN VINCULAR'}</td>
                        <td style={tdNum}>{fmtES(l.cantidad, 2)}</td>
                        <td style={td}>{l.unidad ?? ''}</td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <span style={{ display: 'inline-block', width: 14, height: 14, background: col, border: `2px solid ${INK}` }} />
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}><button style={btn('var(--sl-card)')} onClick={() => borrarLinea(l.id)}>Quitar</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {/* Fase D · coste real + varianza */}
      {(costeReal || !!varianza.length) && (
        <div style={card}>
          <h3 style={h3}>Cierre del periodo · dónde se escapa el dinero</h3>
          {costeReal && (
            <p style={{ fontFamily: LEX, fontSize: 13, color: INK, margin: '0 0 12px' }}>
              Periodo {costeReal.inicio} → {costeReal.fin}: inventario inicial {fmtES(costeReal.inventario_inicial, 2)}€ + compras {fmtES(costeReal.compras_periodo, 2)}€ − inventario final {fmtES(costeReal.inventario_final, 2)}€ = <b>coste real {fmtES(costeReal.coste_real, 2)}€</b>.
            </p>
          )}
          {!!varianza.length && (
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr><th style={th}>INGREDIENTE</th><th style={thR}>TEÓRICO</th><th style={thR}>REAL</th><th style={thR}>DESVÍO €</th></tr></thead>
              <tbody>
                {varianza.map((v, i) => (
                  <tr key={`${v.ingrediente}-${i}`} style={{ background: zebra(i) }}>
                    <td style={{ ...td, fontWeight: 700 }}>{v.ingrediente}</td>
                    <td style={tdNum}>{fmtES(v.consumo_teorico, 2)}</td>
                    <td style={tdNum}>{fmtES(v.consumo_real, 2)}</td>
                    <td style={{ ...tdNum, color: v.desviacion_eur > 0 ? ROJO : VERDE, fontWeight: 700 }}>{v.desviacion_eur > 0 ? '+' : ''}{fmtES(v.desviacion_eur, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
