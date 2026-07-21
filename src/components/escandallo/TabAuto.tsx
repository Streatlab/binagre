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
  const [radar, setRadar] = useState<RadarAhorro[]>([])

  const cargar = useCallback(async () => {
    const [est, al, bo, inv, vza, cr, rad] = await Promise.all([
      fetch(`${API}/estado`).then(r => r.ok ? r.json() : null).catch(() => null),
      supabase.from('alertas_precio').select('*, ingredientes(nombre)').eq('estado', 'pendiente').order('created_at', { ascending: false }).limit(30),
      supabase.from('ingredientes').select('*').eq('borrador', true).order('created_at', { ascending: false }).limit(50),
      supabase.from('inventarios').select('id, fecha, estado, origen').neq('estado', 'confirmado').order('fecha', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('v_varianza_ingrediente_periodo').select('*').order('desviacion_eur', { ascending: false }).limit(200),
      supabase.from('v_coste_real_periodo').select('*').order('fin', { ascending: false }).limit(1).maybeSingle(),
      fetch(`${API}/radar-ahorro`).then(r => r.ok ? r.json() : null).catch(() => null),
    ])
    setEstado(est)
    setAlertas((al.data as Alerta[]) ?? [])
    setBorradores((bo.data as Ingrediente[]) ?? [])
    setRadar((rad?.radar as RadarAhorro[]) ?? [])
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

  const TRAD_ESTADO: Record<string, string> = {
    extraidas: 'líneas extraídas y cruzadas',
    sin_detalle_lineas: 'la factura no desglosa artículos, o no cuadra al céntimo',
    fallo_lectura: 'no se pudo leer el PDF',
    error: 'error al procesar',
  }

  /* ── Fase A: procesa 1 factura (síncrona) y muestra el resultado ── */
  const procesarUna = async () => {
    setBusy('lote'); setMsg('Procesando factura… (puede tardar hasta un minuto, no cierres la pestaña)')
    try {
      const r = await fetch(`${API}/extraer-lineas`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) })
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      if (j.vacio) { setMsg('No quedan facturas de materia prima pendientes.'); await cargar(); return }
      setMsg(`Factura de ${j.proveedor ?? '—'}: ${TRAD_ESTADO[j.estado] ?? j.estado} (${j.lineas} líneas). Revisa abajo y pulsa otra vez para la siguiente.`)
      await cargar()
    } catch (e: any) { setMsg(`Error: ${e.message}`) } finally { setBusy(null) }
  }

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
            <button style={btn('var(--sl-card)')} disabled={busy === 'lote' || driveOff} onClick={procesarUna}>
              {busy === 'lote' ? 'Procesando…' : 'Procesar 1 factura'}
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

      {/* Borradores */}
      {!!borradores.length && (
        <div style={card}>
          <h3 style={h3}>Ingredientes pre-creados · dicta lo que falta y quedan automatizados</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {borradores.map(b => (
              <div key={b.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={btn(CREMA)} onClick={() => onOpenIngrediente(b)}>
                    {b.nombre} {b.precio_activo != null ? `· ${fmtES(b.precio_activo, 2)}€` : ''}
                  </button>
                  <button style={btn('var(--sl-card)')} onClick={() => abrirBuscadorFusion(b.id)}>
                    {fusionAbierta === b.id ? 'Cancelar' : 'Es el mismo que…'}
                  </button>
                </div>
                {fusionAbierta === b.id && (
                  <div style={{ background: 'var(--sl-card)', border: `2px solid ${INK}`, padding: 8, minWidth: 260 }}>
                    <input
                      autoFocus
                      placeholder="Buscar ingrediente ya existente…"
                      value={busquedaFusion}
                      onChange={e => setBusquedaFusion(e.target.value)}
                      style={{ width: '100%', fontFamily: LEX, fontSize: 13, padding: '6px 8px', border: `2px solid ${INK}`, marginBottom: 6 }}
                    />
                    <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {catalogoIngs
                        .filter(i => busquedaFusion.trim().length > 1 && i.nombre.toLowerCase().includes(busquedaFusion.trim().toLowerCase()))
                        .slice(0, 20)
                        .map(i => (
                          <button key={i.id} style={{ ...btn('var(--sl-card)'), textAlign: 'left', fontSize: 11 }}
                            disabled={busy === `fusion-${b.id}`}
                            onClick={() => fusionar(b.id, i.id, i.nombre)}>
                            {i.nombre}
                          </button>
                        ))}
                      {busquedaFusion.trim().length > 1 && !catalogoIngs.some(i => i.nombre.toLowerCase().includes(busquedaFusion.trim().toLowerCase())) && (
                        <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>Sin resultados.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

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
      )}

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
