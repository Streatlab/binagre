// TabAuto — bandeja de automatización del Escandallo (ESCANDALLO 2.0, Fases A+C+D)
// A: procesar facturas de materia prima (extraer líneas del PDF → ingredientes/precios solos),
//    ingredientes pre-creados pendientes de completar, alertas de subida de precio.
// C: inventario quincenal por foto (leer → confirmar) con confianza por línea.
// D: coste real del periodo y varianza teórico vs real en €.
import { useCallback, useEffect, useState } from 'react'
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

const API = '/api/papeleo/escandallo-auto'

const card: React.CSSProperties = { background: 'var(--sl-card)', border: `4px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`, padding: 16 }
const h3: React.CSSProperties = { fontFamily: OSW, fontWeight: 700, fontSize: 15, letterSpacing: '1px', textTransform: 'uppercase', color: GRANATE, margin: '0 0 10px' }
const btn = (bg: string): React.CSSProperties => ({ fontFamily: OSW, fontWeight: 700, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', background: bg, color: INK, border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, padding: '8px 14px', cursor: 'pointer' })

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

  const cargar = useCallback(async () => {
    const [est, al, bo, inv, vza, cr] = await Promise.all([
      fetch(`${API}/estado`).then(r => r.ok ? r.json() : null).catch(() => null),
      supabase.from('alertas_precio').select('*, ingredientes(nombre)').eq('estado', 'pendiente').order('created_at', { ascending: false }).limit(30),
      supabase.from('ingredientes').select('*').eq('borrador', true).order('created_at', { ascending: false }).limit(50),
      supabase.from('inventarios').select('id, fecha, estado, origen').neq('estado', 'confirmado').order('fecha', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('v_varianza_ingrediente_periodo').select('*').order('desviacion_eur', { ascending: false }).limit(200),
      supabase.from('v_coste_real_periodo').select('*').order('fin', { ascending: false }).limit(1).maybeSingle(),
    ])
    setEstado(est)
    setAlertas((al.data as Alerta[]) ?? [])
    setBorradores((bo.data as Ingrediente[]) ?? [])
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

  /* ── Fase A ── */
  const procesarLote = async () => {
    setBusy('lote'); setMsg(null)
    try {
      const r = await fetch(`${API}/extraer-lineas`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ limit: 5 }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setMsg(`Lote procesado: ${j.procesadas} facturas (${(j.resultados || []).filter((x: any) => x.estado === 'extraidas').length} con líneas).`)
      await cargar()
    } catch (e: any) { setMsg(`Error: ${e.message}`) } finally { setBusy(null) }
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
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
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
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setMsg(j.lineas_sin_vincular_ignoradas > 0
        ? `Inventario confirmado. Ojo: ${j.lineas_sin_vincular_ignoradas} líneas sin vincular quedaron fuera.`
        : 'Inventario confirmado.')
      await cargar()
    } catch (e: any) { setMsg(`Error: ${e.message}`) } finally { setBusy(null) }
  }

  const estrReal = estado?.estructura_real?.estructura_pct_real
  const sinVincular = invLineas.filter(l => !l.ingrediente_id).length

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

      {/* Fase A · procesar facturas */}
      <div style={card}>
        <h3 style={h3}>Facturas de materia prima → ingredientes y precios (automático)</h3>
        <p style={{ fontFamily: LEX, fontSize: 13, color: INK, margin: '0 0 10px' }}>
          Cada lote lee 5 facturas (PDF de Drive), extrae sus líneas y las cruza solas: si el producto es conocido actualiza el precio y recalcula los escandallos; si es nuevo lo pre-crea y deja tarea. Coste aprox.: céntimos por factura, se gasta solo al pulsar.
        </p>
        <button style={btn(AMA)} disabled={busy === 'lote'} onClick={procesarLote}>
          {busy === 'lote' ? 'Procesando…' : 'Procesar lote de 5 facturas'}
        </button>
      </div>

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
              <button key={b.id} style={btn(CREMA)} onClick={() => onOpenIngrediente(b)}>
                {b.nombre} {b.precio_activo != null ? `· ${fmtES(b.precio_activo, 2)}€` : ''}
              </button>
            ))}
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
