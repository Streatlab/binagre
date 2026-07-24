/**
 * TabIncentivos — Equipo › Incentivos (modelo v13).
 * CANTERA ALEGRE (LEY-ESTILO-01): héroe de Equipo en TINTA, solo los 12 tokens,
 * planchas sólidas pegadas, papel con ceja 7px, sombra dura SOLO en lo pulsable,
 * rojo exclusivo de lo negativo, [EST] pegado a todo dato estimado.
 * Todo el plan es editable desde aquí (incentivos_config) y de ahí beben los PDF.
 */
import { OSW, LEX, INK, CREMA, CLARO, BLANCO, VERDE, GRANATE, ROJO, GRIS, AMA } from '@/styles/neobrutal'
import { HeroCantera, Papel, Plancha, PlanchaCelda, PantallaCantera, SeccionLabel, FrasePotente, SHADOW_DURA } from '@/components/kit/cantera'
import { useEffect, useState } from 'react'
import { Save, SlidersHorizontal, Minus, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import * as M from '@/lib/marcoDoc'
import BotonImprimir from '@/components/BotonImprimir'
import { construirPlanIncentivosPDF } from '@/lib/planIncentivosPdf'

type Config = {
  fact_min: number; fact_t2: number; fact_t3: number
  mult_n1: number; mult_n2: number; mult_n3: number
  reemb_lim1: number; reemb_lim2: number; reemb_eur1: number; reemb_eur2: number; reemb_cero_extra: number
  inventario_eur: number; inventario_tolerancia_pct: number; retrasos_eur: number; valoracion_eur: number
  vacio_eur: number; checklist_eur: number; fechado_eur: number
  tardes_permitidas: number; pen_tarde: number; pen_apertura: number
  bonus_constancia: number; bonus_meses: number; tope_total: number
}

type EmpRow = { empleado_id: string; nombre: string }

type Medicion = {
  empleado_id: string; tardes: number; tardes_apertura: number
  vacio_ok: boolean; checklist_ok: boolean; fechado_ok: boolean
  checklist_verificado_por: string | null
  muerte_personal: boolean; muerte_personal_motivo: string | null
}

type MesColectivo = {
  reembolsos_total: number; reembolsos_sin_foto: number
  inventario_ok: boolean; retrasos_ok: boolean; valoracion_ok: boolean
  valoracion_nota: number | null; fact_override: number | null
  muerte: boolean; muerte_motivo: string | null
}

const EUR = (n: number) => `${Math.round(n)} €`
const MILES = (n: number) => `${Math.round(Number(n)).toLocaleString('es-ES')} €`
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const EYEBROW: React.CSSProperties = { fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: INK, fontWeight: 700 }
const NUM: React.CSSProperties = { width: 74, padding: '6px 8px', border: `2px solid ${INK}`, borderRadius: 0, background: BLANCO, color: INK, fontFamily: OSW, fontSize: 14, textAlign: 'center' }

function multiplicador(cfg: Config, fact: number) {
  if (fact >= cfg.fact_t3) return Number(cfg.mult_n3)
  if (fact >= cfg.fact_t2) return Number(cfg.mult_n2)
  if (fact >= cfg.fact_min) return Number(cfg.mult_n1)
  return 0
}

function eurReembolsos(cfg: Config, mc: MesColectivo) {
  const computa = Number(mc.reembolsos_total) + Number(mc.reembolsos_sin_foto)
  if (computa === 0) return Number(cfg.reemb_eur1) + Number(cfg.reemb_cero_extra)
  if (computa <= cfg.reemb_lim1) return Number(cfg.reemb_eur1)
  if (computa <= cfg.reemb_lim2) return Number(cfg.reemb_eur2)
  return 0
}

function calcV13(cfg: Config, mc: MesColectivo, m: Medicion, fact: number) {
  const k = multiplicador(cfg, fact)
  const eReemb = eurReembolsos(cfg, mc)
  const eInv = mc.inventario_ok ? Number(cfg.inventario_eur) : 0
  const eRet = mc.retrasos_ok ? Number(cfg.retrasos_eur) : 0
  const eVal = mc.valoracion_ok ? Number(cfg.valoracion_eur) : 0
  const col = eReemb + eInv + eRet + eVal
  const ind = (m.vacio_ok ? Number(cfg.vacio_eur) : 0)
    + (m.checklist_ok ? Number(cfg.checklist_eur) : 0)
    + (m.fechado_ok ? Number(cfg.fechado_eur) : 0)
  const pen = Math.max(0, m.tardes - cfg.tardes_permitidas) * Number(cfg.pen_tarde)
    + m.tardes_apertura * Number(cfg.pen_apertura)
  const anulado = mc.muerte || m.muerte_personal || k === 0
  const total = anulado ? 0 : Math.min(Number(cfg.tope_total), Math.max(0, col + ind - pen) * k)
  return { k, eReemb, eInv, eRet, eVal, col, ind, pen, total }
}

const AREA: M.Area = 'equipo'

/** Hoja mensual personal (lo que cobra ese empleado este mes). */
function construirIncentivosPDF(cfg: Config, mc: MesColectivo, e: EmpRow, m: Medicion, fact: number, estimado: boolean, mes: number, anio: number, rec: M.Recursos, bn = false) {
  const r = calcV13(cfg, mc, m, fact)
  const doc = M.nuevaHoja({ orientation: 'portrait' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA, bn)
  const cb = M.contentBox(doc)

  let y = M.pintarCabecera(doc, ctx, { docNombre: 'Hoja de Incentivos', meta: `${MESES_LARGO[mes - 1]} ${anio}`, tituloCentrado: e.nombre, area: AREA, bn })

  M.tarjeta(doc, cb.x0, y, cb.w, 26, AREA, { bn, fill: true })
  M.fDato(doc, ctx, false); doc.setFontSize(8); doc.setTextColor(...M.GRIS)
  doc.text(estimado ? 'FACTURACIÓN DE COCINA · CIERRE ESTIMADO' : 'FACTURACIÓN DE COCINA DEL MES', cb.x0 + 4, y + 6)
  M.fTitulo(doc, ctx, true); doc.setFontSize(18); doc.setTextColor(...M.TINTA)
  doc.text(`${MILES(fact)}${estimado ? ' [EST]' : ''}`, cb.x0 + 4, y + 15)
  M.fDato(doc, ctx, false); doc.setFontSize(8); doc.setTextColor(...M.GRIS)
  doc.text(`Candado: ${MILES(cfg.fact_min)} abre ×${cfg.mult_n1} · ${MILES(cfg.fact_t2)} ×${cfg.mult_n2} · ${MILES(cfg.fact_t3)} ×${cfg.mult_n3}`, cb.x0 + 4, y + 21)
  M.pill(doc, cb.x1 - 30, y + 5, r.k > 0 && !mc.muerte && !m.muerte_personal ? `×${r.k}` : 'CERRADO', AREA, ctx, { bn })
  y += 32

  const computa = Number(mc.reembolsos_total) + Number(mc.reembolsos_sin_foto)
  const filas: Array<[string, string]> = [
    ['Colectivo · Entregas a tiempo y tiempo de preparación', EUR(r.eRet)],
    [`Colectivo · Reembolsos del mes (${computa.toFixed(0)} € computados)`, EUR(r.eReemb)],
    [`Colectivo · Inventario permanente (descuadre tolerado ≤${Number(cfg.inventario_tolerancia_pct)}%)`, EUR(r.eInv)],
    ['Colectivo · Valoración de clientes en plataformas', EUR(r.eVal)],
    ['Individual · Vacío de cámara', EUR(m.vacio_ok ? cfg.vacio_eur : 0)],
    ['Individual · Checklists verificados', EUR(m.checklist_ok ? cfg.checklist_eur : 0)],
    ['Individual · Fechado y conservación', EUR(m.fechado_ok ? cfg.fechado_eur : 0)],
    [`Penalización tardes (${m.tardes} tardes, ${m.tardes_apertura} en apertura)`, r.pen > 0 ? `−${EUR(r.pen)}` : '0 €'],
  ]
  for (const [k2, v] of filas) {
    M.fDato(doc, ctx, false); doc.setFontSize(10); doc.setTextColor(...M.TINTA)
    doc.text(k2, cb.x0, y + 5, { maxWidth: cb.w - 30 })
    doc.setFont(ctx.emb ? 'MBar' : 'helvetica', 'bold')
    doc.text(v, cb.x1, y + 5, { align: 'right' })
    y += 8
    M.lineaRelleno(doc, cb.x0, cb.x1, y)
    y += 2
  }

  y += 4
  doc.setDrawColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.setLineWidth(0.6); doc.line(cb.x0, y, cb.x1, y)
  y += 8
  M.fTitulo(doc, ctx, true); doc.setFontSize(13); doc.setTextColor(...M.TINTA)
  doc.text(estimado ? 'VA CAMINO DE COBRAR' : 'A COBRAR ESTE MES', cb.x0, y)
  doc.setFontSize(18); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
  doc.text(`${EUR(r.total)}${estimado ? ' [EST]' : ''}`, cb.x1, y, { align: 'right' })
  y += 8
  M.fDato(doc, ctx, false); doc.setFontSize(8); doc.setTextColor(...M.GRIS)
  const nota = m.muerte_personal
    ? 'Regla de compañerismo activada este mes: el incentivo personal queda a 0 €.'
    : mc.muerte
      ? 'Este mes hubo una cancelación de pedido o cierre de tienda: el incentivo queda a 0 € para toda la cocina.'
      : `(${EUR(r.col)} colectivo + ${EUR(r.ind)} individual − ${EUR(r.pen)}) × ${r.k}. Tope ${EUR(Number(cfg.tope_total))}. Si la cocina no llega a ${MILES(cfg.fact_min)}, no hay incentivos.`
  doc.text(nota, cb.x0, y, { maxWidth: cb.w })
  if (estimado) {
    y += 5
    doc.text('Cifra estimada con el ritmo de ventas del mes en curso; el pago se calcula con la facturación real al cerrar el mes.', cb.x0, y, { maxWidth: cb.w })
  }

  y += 10
  doc.setFontSize(7)
  doc.text(doc.splitTextToSize('Documento personal e intransferible (protección de datos). El plan puede modificarse en función de las métricas a conseguir; cualquier cambio se avisa antes del mes en que empieza a aplicar.', cb.w), cb.x0, y)

  M.pintarPaginado(doc, 1, 1, ctx)
  return doc
}

/** Tarjeta pulsable de concepto colectivo (verde = se cobra). */
function Concepto({ activo, titulo, detalle, importe, onToggle, extra }: {
  activo: boolean; titulo: string; detalle: string; importe: number; onToggle: () => void; extra?: React.ReactNode
}) {
  return (
    <div onClick={onToggle} role="button" tabIndex={0}
      style={{ flex: '1 1 250px', minWidth: 230, background: activo ? VERDE : BLANCO, color: activo ? BLANCO : INK, border: `3px solid ${INK}`, boxShadow: SHADOW_DURA, borderRadius: 0, padding: '14px 16px', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: OSW, fontSize: 13.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{titulo}</div>
          <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4, lineHeight: 1.35, opacity: activo ? 0.95 : 0.75 }}>{detalle}</div>
        </div>
        <div style={{ fontFamily: OSW, fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{EUR(importe)}</div>
      </div>
      <div style={{ marginTop: 10 }}>
        <span style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', border: `2px solid ${activo ? BLANCO : INK}`, padding: '2px 8px' }}>
          {activo ? '✓ Se cobra' : 'No se cobra'}
        </span>
      </div>
      {extra && <div onClick={ev => ev.stopPropagation()} style={{ marginTop: 10 }}>{extra}</div>}
    </div>
  )
}

/** Campo numérico de ajustes. */
function Campo({ label, valor, onChange, sufijo, ancho }: { label: string; valor: number; onChange: (v: number) => void; sufijo?: string; ancho?: number }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ ...EYEBROW, fontSize: 10 }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <input type="number" value={valor} onChange={e => onChange(Number(e.target.value))} style={{ ...NUM, width: ancho ?? 74 }} />
        {sufijo && <span style={{ fontFamily: OSW, fontSize: 12, color: GRIS }}>{sufijo}</span>}
      </span>
    </label>
  )
}

export default function TabIncentivos() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [cfg, setCfg] = useState<Config | null>(null)
  const [emps, setEmps] = useState<EmpRow[]>([])
  const [meds, setMeds] = useState<Record<string, Medicion>>({})
  const [mc, setMc] = useState<MesColectivo>({ reembolsos_total: 0, reembolsos_sin_foto: 0, inventario_ok: false, retrasos_ok: false, valoracion_ok: false, valoracion_nota: null, fact_override: null, muerte: false, muerte_motivo: null })
  const [factAcum, setFactAcum] = useState(0)
  const [diasConVentas, setDiasConVentas] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ajustes, setAjustes] = useState(false)
  const [guardadoCfg, setGuardadoCfg] = useState(false)

  const diasMes = new Date(anio, mes, 0).getDate()
  const esMesActual = mes === now.getMonth() + 1 && anio === now.getFullYear()
  const diasPasados = esMesActual ? Math.min(now.getDate(), diasMes) : diasMes

  async function fetchAll() {
    setLoading(true)
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
    const hasta = `${mes === 12 ? anio + 1 : anio}-${String(mes === 12 ? 1 : mes + 1).padStart(2, '0')}-01`
    const [{ data: c }, { data: e }, { data: v }, { data: md }, { data: im }] = await Promise.all([
      supabase.from('incentivos_config').select('*').eq('id', 1).single(),
      supabase.from('incentivos_empleado').select('empleado_id, activo, empleados(nombre)').eq('activo', true),
      supabase.from('v_facturacion_diario_unificada').select('fecha, total_bruto').gte('fecha', desde).lt('fecha', hasta),
      supabase.from('incentivos_medicion').select('*').eq('mes', mes).eq('anio', anio),
      supabase.from('incentivos_mes').select('*').eq('mes', mes).eq('anio', anio).maybeSingle(),
    ])
    if (c) setCfg(c as Config)
    const rows: EmpRow[] = (e ?? []).map((r: any) => ({ empleado_id: r.empleado_id, nombre: r.empleados?.nombre ?? '—' }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
    setEmps(rows)
    setFactAcum((v ?? []).reduce((s: number, x: any) => s + Number(x.total_bruto || 0), 0))
    setDiasConVentas(new Set((v ?? []).map((x: any) => x.fecha)).size)
    const map: Record<string, Medicion> = {}
    for (const r of rows) {
      const found = (md ?? []).find((x: any) => x.empleado_id === r.empleado_id)
      map[r.empleado_id] = found ? {
        empleado_id: r.empleado_id,
        tardes: found.tardes ?? 0,
        tardes_apertura: found.tardes_apertura ?? 0,
        vacio_ok: !!found.vacio_ok,
        checklist_ok: !!found.checklist_ok,
        fechado_ok: !!found.fechado_ok,
        checklist_verificado_por: found.checklist_verificado_por ?? null,
        muerte_personal: !!found.muerte_personal,
        muerte_personal_motivo: found.muerte_personal_motivo ?? null,
      } : {
        empleado_id: r.empleado_id, tardes: 0, tardes_apertura: 0,
        vacio_ok: false, checklist_ok: false, fechado_ok: false, checklist_verificado_por: null,
        muerte_personal: false, muerte_personal_motivo: null,
      }
    }
    setMeds(map)
    setMc(im ? {
      reembolsos_total: Number(im.reembolsos_total) || 0,
      reembolsos_sin_foto: Number(im.reembolsos_sin_foto) || 0,
      inventario_ok: !!im.inventario_ok,
      retrasos_ok: !!im.retrasos_ok,
      valoracion_ok: !!im.valoracion_ok,
      valoracion_nota: im.valoracion_nota != null ? Number(im.valoracion_nota) : null,
      fact_override: im.fact_override != null ? Number(im.fact_override) : null,
      muerte: !!im.muerte,
      muerte_motivo: im.muerte_motivo ?? null,
    } : { reembolsos_total: 0, reembolsos_sin_foto: 0, inventario_ok: false, retrasos_ok: false, valoracion_ok: false, valoracion_nota: null, fact_override: null, muerte: false, muerte_motivo: null })
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [mes, anio])

  function upd(id: string, patch: Partial<Medicion>) {
    setMeds(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }
  function updCfg(patch: Partial<Config>) {
    setCfg(prev => (prev ? { ...prev, ...patch } : prev))
  }

  async function guardar() {
    setSaving(true)
    const rows = Object.values(meds).map(m => ({ ...m, mes, anio }))
    await supabase.from('incentivos_medicion').upsert(rows, { onConflict: 'mes,anio,empleado_id' })
    await supabase.from('incentivos_mes').upsert([{ ...mc, mes, anio, updated_at: new Date().toISOString() }], { onConflict: 'anio,mes' })
    setSaving(false)
    fetchAll()
  }

  async function guardarCfg() {
    if (!cfg) return
    await supabase.from('incentivos_config').update({ ...cfg, updated_at: new Date().toISOString() }).eq('id', 1)
    setGuardadoCfg(true)
    setTimeout(() => setGuardadoCfg(false), 2500)
  }

  if (loading || !cfg) return <div style={{ padding: 32, color: INK, fontFamily: LEX }}>Cargando incentivos…</div>

  // Facturación: acumulada real + proyección a fin de mes con el ritmo actual.
  const ritmoDia = diasPasados > 0 ? factAcum / diasPasados : 0
  const proyeccion = esMesActual ? ritmoDia * diasMes : factAcum
  const estimado = esMesActual && mc.fact_override == null
  const fact = mc.fact_override != null ? mc.fact_override : (esMesActual ? proyeccion : factAcum)

  const k = multiplicador(cfg, fact)
  const kHoy = multiplicador(cfg, factAcum)
  const abierto = k > 0 && !mc.muerte
  const pctProy = Math.min(100, (fact / Number(cfg.fact_t3)) * 100)
  const pctHoy = Math.min(100, (factAcum / Number(cfg.fact_t3)) * 100)
  const marca = (v: number) => `${Math.min(100, (v / Number(cfg.fact_t3)) * 100)}%`
  const eReemb = eurReembolsos(cfg, mc)
  const computa = Number(mc.reembolsos_total) + Number(mc.reembolsos_sin_foto)
  const colTotal = eReemb + (mc.inventario_ok ? Number(cfg.inventario_eur) : 0) + (mc.retrasos_ok ? Number(cfg.retrasos_eur) : 0) + (mc.valoracion_ok ? Number(cfg.valoracion_eur) : 0)
  const colMax = Number(cfg.retrasos_eur) + Number(cfg.reemb_eur1) + Number(cfg.reemb_cero_extra) + Number(cfg.inventario_eur) + Number(cfg.valoracion_eur)
  const indMax = Number(cfg.vacio_eur) + Number(cfg.checklist_eur) + Number(cfg.fechado_eur)
  const totalMes = emps.reduce((s, e) => s + calcV13(cfg, mc, meds[e.empleado_id], fact).total, 0)
  const faltaParaAbrir = Math.max(0, Number(cfg.fact_min) - fact)
  const faltaDiario = esMesActual && diasMes > diasPasados ? faltaParaAbrir / (diasMes - diasPasados) : 0

  const chkLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontFamily: LEX, fontSize: 13, color: INK, cursor: 'pointer' }
  const btnSolido = (bg: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', border: `3px solid ${INK}`, boxShadow: SHADOW_DURA, background: bg, color: bg === AMA || bg === BLANCO ? INK : BLANCO, fontFamily: OSW, fontSize: 12.5, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer', borderRadius: 0 })

  const tituloHero = mc.muerte
    ? 'Regla de muerte activada: este mes no cobra nadie.'
    : abierto
      ? `Al ritmo de hoy el mes cierra abierto: todo lo ganado se multiplica ×${k}.`
      : 'Al ritmo de hoy el mes cierra por debajo del candado.'

  const cfgPdf = cfg as unknown as Record<string, number>

  return (
    <PantallaCantera embedded>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={mes} onChange={e => setMes(Number(e.target.value))} style={{ ...NUM, width: 86 }}>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" value={anio} onChange={e => setAnio(Number(e.target.value))} style={{ ...NUM, width: 84 }} />
        <div style={{ flex: 1 }} />
        <button onClick={() => setAjustes(!ajustes)} style={btnSolido(ajustes ? INK : BLANCO)}>
          <SlidersHorizontal size={15} /> {ajustes ? 'Cerrar ajustes' : 'Ajustar plan'}
        </button>
        <BotonImprimir
          documentoId="equipo.plan_incentivos"
          titulo="Plan de Incentivos de Cocina · SL-EQP-PR-001"
          etiqueta="Plan en blanco"
          generarPdf={async opts => { const rec = await M.cargarRecursos(); return construirPlanIncentivosPDF(cfgPdf, rec, { bn: opts.bn, mes, anio }) }}
        />
        <button onClick={guardar} disabled={saving} style={btnSolido(VERDE)}>
          <Save size={15} /> {saving ? 'Guardando…' : 'Guardar mes'}
        </button>
      </div>

      <HeroCantera
        area="equipo"
        periodo={`${MESES_LARGO[mes - 1]} ${anio}`}
        titular={tituloHero}
        etiquetaDato={mc.fact_override != null ? 'Facturación de cocina (a mano)' : estimado ? 'Cierre estimado del mes' : 'Facturación de cocina del mes'}
        cifra={`${MILES(fact)}${estimado ? ' [EST]' : ''}`}
        resumen={estimado
          ? <>Hoy llevamos <b>{MILES(factAcum)}</b> en {diasPasados} días ({MILES(ritmoDia)}/día). {faltaParaAbrir > 0
            ? <>Para abrir el candado faltan <b>{MILES(faltaParaAbrir)}</b>: {MILES(faltaDiario)} más al día en lo que queda de mes.</>
            : <>Al cierre, la cocina se llevaría <b>{EUR(totalMes)}</b> entre {emps.length} personas.</>}</>
          : <>Mes cerrado con {MILES(factAcum)}. La cocina se lleva <b>{EUR(totalMes)}</b> entre {emps.length} personas.</>}
        atencion={[
          `Hoy ${MILES(factAcum)} · ×${kHoy || 0}`,
          `Colectivo ${EUR(colTotal)} de ${EUR(colMax)}`,
          `Individual hasta ${EUR(indMax)}`,
          `A pagar ${EUR(totalMes)}${estimado ? ' [EST]' : ''}`,
        ]}
      />

      {mc.muerte && <FrasePotente significado="peligro">Cancelación o cierre en horario: el incentivo del mes queda a cero para toda la cocina.</FrasePotente>}

      {ajustes && (
        <Papel ceja={INK}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={EYEBROW}>Ajustar el plan · cambia el cálculo y todo lo que se imprime</div>
            <div style={{ flex: 1 }} />
            {guardadoCfg && <span style={{ fontFamily: OSW, fontSize: 12, color: VERDE, fontWeight: 700, letterSpacing: '1px' }}>GUARDADO</span>}
            <button onClick={guardarCfg} style={btnSolido(VERDE)}><Save size={14} /> Guardar plan</button>
          </div>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            <div>
              <div style={{ ...EYEBROW, marginBottom: 8 }}>Candado de facturación</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', maxWidth: 430 }}>
                <Campo label="Abre en" valor={cfg.fact_min} onChange={v => updCfg({ fact_min: v })} sufijo="€" ancho={92} />
                <Campo label="Sube en" valor={cfg.fact_t2} onChange={v => updCfg({ fact_t2: v })} sufijo="€" ancho={92} />
                <Campo label="Completo en" valor={cfg.fact_t3} onChange={v => updCfg({ fact_t3: v })} sufijo="€" ancho={92} />
                <Campo label="Mult. 1" valor={cfg.mult_n1} onChange={v => updCfg({ mult_n1: v })} ancho={62} />
                <Campo label="Mult. 2" valor={cfg.mult_n2} onChange={v => updCfg({ mult_n2: v })} ancho={62} />
                <Campo label="Mult. 3" valor={cfg.mult_n3} onChange={v => updCfg({ mult_n3: v })} ancho={62} />
              </div>
            </div>
            <div>
              <div style={{ ...EYEBROW, marginBottom: 8 }}>Bloque colectivo</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', maxWidth: 430 }}>
                <Campo label="Entregas a tiempo" valor={cfg.retrasos_eur} onChange={v => updCfg({ retrasos_eur: v })} sufijo="€" />
                <Campo label="Reembolsos base" valor={cfg.reemb_eur1} onChange={v => updCfg({ reemb_eur1: v })} sufijo="€" />
                <Campo label="Premio cero" valor={cfg.reemb_cero_extra} onChange={v => updCfg({ reemb_cero_extra: v })} sufijo="€" />
                <Campo label="Tramo medio" valor={cfg.reemb_eur2} onChange={v => updCfg({ reemb_eur2: v })} sufijo="€" />
                <Campo label="Límite bueno" valor={cfg.reemb_lim1} onChange={v => updCfg({ reemb_lim1: v })} sufijo="€" />
                <Campo label="Límite tolerable" valor={cfg.reemb_lim2} onChange={v => updCfg({ reemb_lim2: v })} sufijo="€" />
                <Campo label="Inventario" valor={cfg.inventario_eur} onChange={v => updCfg({ inventario_eur: v })} sufijo="€" />
                <Campo label="Descuadre máx." valor={cfg.inventario_tolerancia_pct} onChange={v => updCfg({ inventario_tolerancia_pct: v })} sufijo="%" />
                <Campo label="Valoración" valor={cfg.valoracion_eur} onChange={v => updCfg({ valoracion_eur: v })} sufijo="€" />
              </div>
            </div>
            <div>
              <div style={{ ...EYEBROW, marginBottom: 8 }}>Individual, tardes y tope</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', maxWidth: 430 }}>
                <Campo label="Vacío de cámara" valor={cfg.vacio_eur} onChange={v => updCfg({ vacio_eur: v })} sufijo="€" />
                <Campo label="Checklists" valor={cfg.checklist_eur} onChange={v => updCfg({ checklist_eur: v })} sufijo="€" />
                <Campo label="Fechado" valor={cfg.fechado_eur} onChange={v => updCfg({ fechado_eur: v })} sufijo="€" />
                <Campo label="Tardes gratis" valor={cfg.tardes_permitidas} onChange={v => updCfg({ tardes_permitidas: v })} ancho={62} />
                <Campo label="Por tarde" valor={cfg.pen_tarde} onChange={v => updCfg({ pen_tarde: v })} sufijo="€" />
                <Campo label="Tarde en apertura" valor={cfg.pen_apertura} onChange={v => updCfg({ pen_apertura: v })} sufijo="€" />
                <Campo label="Bonus constancia" valor={cfg.bonus_constancia} onChange={v => updCfg({ bonus_constancia: v })} sufijo="€" />
                <Campo label="Meses seguidos" valor={cfg.bonus_meses} onChange={v => updCfg({ bonus_meses: v })} ancho={62} />
                <Campo label="Tope por persona" valor={cfg.tope_total} onChange={v => updCfg({ tope_total: v })} sufijo="€" />
              </div>
            </div>
          </div>
        </Papel>
      )}

      <Plancha>
        <PlanchaCelda first bg={BLANCO}>
          <div style={EYEBROW}>Llevamos hoy</div>
          <div style={{ fontFamily: OSW, fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>{MILES(factAcum)}</div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>{diasPasados} de {diasMes} días · {diasConVentas} con ventas</div>
        </PlanchaCelda>
        <PlanchaCelda bg={CREMA}>
          <div style={EYEBROW}>Ritmo diario</div>
          <div style={{ fontFamily: OSW, fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>{MILES(ritmoDia)}</div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>objetivo 900-1.000 €</div>
        </PlanchaCelda>
        <PlanchaCelda bg={abierto ? VERDE : CLARO} color={abierto ? BLANCO : INK}>
          <div style={{ ...EYEBROW, color: abierto ? BLANCO : INK }}>Cierre estimado</div>
          <div style={{ fontFamily: OSW, fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>{MILES(fact)}{estimado ? ' [EST]' : ''}</div>
          <div style={{ fontFamily: LEX, fontSize: 12 }}>{abierto ? `multiplicador ×${k}` : 'candado cerrado'}</div>
        </PlanchaCelda>
      </Plancha>

      <Papel ceja={abierto ? VERDE : GRANATE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
          <div style={EYEBROW}>Candado de facturación · barra clara = hoy, barra completa = cierre estimado</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ ...chkLabel, fontSize: 12 }}>
              Corregir a mano:
              <input type="number" min={0} placeholder="auto" value={mc.fact_override ?? ''}
                onChange={e => setMc({ ...mc, fact_override: e.target.value === '' ? null : Number(e.target.value) })}
                style={{ ...NUM, width: 100 }} />
              €
            </label>
            <div style={{ fontFamily: OSW, fontSize: 20, fontWeight: 700, color: abierto ? VERDE : GRANATE }}>
              {mc.muerte ? 'MUERTE' : abierto ? `×${k}` : 'CERRADO'}
            </div>
          </div>
        </div>
        <div style={{ position: 'relative', height: 16, border: `3px solid ${INK}`, background: CLARO, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, width: `${pctProy}%`, background: abierto ? VERDE : GRANATE, opacity: 0.35 }} />
          <div style={{ position: 'absolute', inset: 0, width: `${pctHoy}%`, background: abierto ? VERDE : GRANATE }} />
        </div>
        <div style={{ position: 'relative', height: 22, marginTop: 5, fontFamily: OSW, fontSize: 12.5 }}>
          {[Number(cfg.fact_min), Number(cfg.fact_t2), Number(cfg.fact_t3)].map((v, i) => (
            <div key={i} style={{ position: 'absolute', left: marca(v), transform: 'translateX(-50%)' }}>
              <span style={{ color: fact >= v ? VERDE : INK, fontWeight: 700 }}>{(v / 1000).toFixed(0)}k</span>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS, marginTop: 6 }}>
          {mc.fact_override != null
            ? 'Cifra puesta a mano: manda sobre el dato automático.'
            : 'Sale solo de las ventas del ERP; la estimación se corrige cada día con lo que se factura de verdad. El pago final se calcula con el mes cerrado.'}
        </div>
      </Papel>

      <Papel ceja={mc.muerte ? ROJO : VERDE}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ ...EYEBROW, flex: 1 }}>Regla de muerte · cancelación o cierre en horario (afecta a todos)</div>
          <label style={chkLabel}>
            <input type="checkbox" checked={mc.muerte} onChange={e => setMc({ ...mc, muerte: e.target.checked })} style={{ width: 18, height: 18, cursor: 'pointer' }} />
            Ha pasado este mes
          </label>
          {mc.muerte && (
            <input type="text" placeholder="Motivo (pedido, fecha…)" value={mc.muerte_motivo ?? ''} onChange={e => setMc({ ...mc, muerte_motivo: e.target.value })}
              style={{ ...NUM, width: 260, textAlign: 'left' }} />
          )}
        </div>
        <div style={{ fontFamily: LEX, fontSize: 12.5, color: INK, marginTop: 8 }}>
          Además existe la <b>regla de compañerismo</b> (individual): faltas de respeto, incidentes graves de actitud o dejar tirado al equipo anulan el mes solo de esa persona. Se marca en su ficha.
        </div>
      </Papel>

      <div>
        <SeccionLabel bg={AMA} color={INK}>Bloque colectivo · lo gana todo el equipo o nadie</SeccionLabel>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Concepto activo={mc.retrasos_ok} titulo="Entregas a tiempo" importe={Number(cfg.retrasos_eur)}
            detalle="Sin retrasos al rider y tiempo de preparación cumplido. Es lo que más premian las plataformas."
            onToggle={() => setMc({ ...mc, retrasos_ok: !mc.retrasos_ok })} />
          <Concepto activo={eReemb > 0} titulo="Reembolsos del mes" importe={eReemb}
            detalle={computa === 0 ? `Cero reembolsos: base + ${EUR(Number(cfg.reemb_cero_extra))} de premio.` : `Computan ${EUR(computa)}; los que van sin foto cuentan doble.`}
            onToggle={() => { }}
            extra={
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase' }}>Total €</span>
                  <input type="number" min={0} value={mc.reembolsos_total} onChange={e => setMc({ ...mc, reembolsos_total: Number(e.target.value) || 0 })} style={NUM} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase' }}>Sin foto €</span>
                  <input type="number" min={0} value={mc.reembolsos_sin_foto} onChange={e => setMc({ ...mc, reembolsos_sin_foto: Number(e.target.value) || 0 })} style={NUM} />
                </label>
              </div>
            } />
          <Concepto activo={mc.inventario_ok} titulo="Inventario permanente" importe={Number(cfg.inventario_eur)}
            detalle={`Examen sorpresa: se cobra si el descuadre no pasa del ${Number(cfg.inventario_tolerancia_pct)}% del valor contado.`}
            onToggle={() => setMc({ ...mc, inventario_ok: !mc.inventario_ok })} />
          <Concepto activo={mc.valoracion_ok} titulo="Valoración de clientes" importe={Number(cfg.valoracion_eur)}
            detalle="La nota media en plataformas se mantiene o mejora respecto al mes anterior."
            onToggle={() => setMc({ ...mc, valoracion_ok: !mc.valoracion_ok })}
            extra={
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase' }}>Nota</span>
                <input type="number" min={0} max={5} step={0.1} placeholder="—" value={mc.valoracion_nota ?? ''}
                  onChange={e => setMc({ ...mc, valoracion_nota: e.target.value === '' ? null : Number(e.target.value) })} style={{ ...NUM, width: 66 }} />
              </label>
            } />
        </div>
        <Plancha style={{ marginTop: 12 }}>
          <PlanchaCelda first bg={CREMA}>
            <div style={EYEBROW}>Colectivo del mes</div>
            <div style={{ fontFamily: OSW, fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>{EUR(colTotal)}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>de {EUR(colMax)} posibles</div>
          </PlanchaCelda>
          <PlanchaCelda bg={BLANCO}>
            <div style={EYEBROW}>Individual máximo</div>
            <div style={{ fontFamily: OSW, fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>{EUR(indMax)}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>por persona</div>
          </PlanchaCelda>
          <PlanchaCelda bg={abierto ? VERDE : CLARO} color={abierto ? BLANCO : INK}>
            <div style={{ ...EYEBROW, color: abierto ? BLANCO : INK }}>A pagar este mes</div>
            <div style={{ fontFamily: OSW, fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>{EUR(totalMes)}{estimado ? ' [EST]' : ''}</div>
            <div style={{ fontFamily: LEX, fontSize: 12 }}>{emps.length} personas · ×{k || 0}</div>
          </PlanchaCelda>
        </Plancha>
      </div>

      <div>
        <SeccionLabel bg={AMA} color={INK}>Ficha de cada persona</SeccionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {emps.map(e => {
            const m = meds[e.empleado_id]
            const r = calcV13(cfg, mc, m, fact)
            const anulado = m.muerte_personal || mc.muerte || k === 0
            return (
              <Papel key={e.empleado_id} ceja={m.muerte_personal ? ROJO : INK}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 220px', minWidth: 200 }}>
                    <div style={{ fontFamily: OSW, fontSize: 22, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{e.nombre}</div>
                    <div style={{ fontFamily: LEX, fontSize: 12, color: m.muerte_personal ? ROJO : GRIS, marginTop: 2, fontWeight: m.muerte_personal ? 700 : 400 }}>
                      {m.muerte_personal
                        ? 'Regla de compañerismo: este mes no cobra incentivo.'
                        : `Colectivo ${EUR(r.col)} + individual ${EUR(r.ind)}${r.pen > 0 ? ` − ${EUR(r.pen)} de tardes` : ''} · ×${r.k}`}
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginTop: 10, background: anulado ? CLARO : VERDE, color: anulado ? INK : BLANCO, border: `3px solid ${INK}`, boxShadow: SHADOW_DURA, padding: '6px 14px' }}>
                      <span style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase' }}>{estimado ? 'Va camino de' : 'Cobra'}</span>
                      <span style={{ fontFamily: OSW, fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{EUR(r.total)}{estimado ? ' [EST]' : ''}</span>
                    </div>
                  </div>

                  <div style={{ flex: '2 1 420px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    {([
                      ['vacio_ok', 'Vacío de cámara', Number(cfg.vacio_eur)],
                      ['checklist_ok', 'Checklists', Number(cfg.checklist_eur)],
                      ['fechado_ok', 'Fechado', Number(cfg.fechado_eur)],
                    ] as Array<[keyof Medicion, string, number]>).map(([campo, label, imp]) => {
                      const on = !!m[campo]
                      return (
                        <button key={String(campo)} onClick={() => upd(e.empleado_id, { [campo]: !on } as Partial<Medicion>)}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '9px 13px', border: `3px solid ${INK}`, boxShadow: SHADOW_DURA, background: on ? VERDE : BLANCO, color: on ? BLANCO : INK, cursor: 'pointer', borderRadius: 0, minWidth: 120 }}>
                          <span style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase' }}>{on ? '✓ ' : ''}{label}</span>
                          <span style={{ fontFamily: OSW, fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{EUR(imp)}</span>
                        </button>
                      )
                    })}

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ ...EYEBROW, fontSize: 10 }}>Checklist firmado por</span>
                      <select value={m.checklist_verificado_por ?? ''} onChange={ev => upd(e.empleado_id, { checklist_verificado_por: ev.target.value || null })} style={{ ...NUM, width: 150, textAlign: 'left' }}>
                        <option value="">—</option>
                        {emps.filter(x => x.empleado_id !== e.empleado_id).map(x => <option key={x.empleado_id} value={x.empleado_id}>{x.nombre}</option>)}
                      </select>
                    </label>

                    {([['tardes', 'Tardes'], ['tardes_apertura', 'En apertura']] as Array<[keyof Medicion, string]>).map(([campo, label]) => {
                      const val = Number(m[campo] ?? 0)
                      const malo = campo === 'tardes' ? val > cfg.tardes_permitidas : val > 0
                      return (
                        <div key={String(campo)} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ ...EYEBROW, fontSize: 10, color: malo ? GRANATE : INK }}>{label}{campo === 'tardes' ? ` · ${cfg.tardes_permitidas} gratis` : ''}</span>
                          <div style={{ display: 'flex', alignItems: 'center', border: `3px solid ${INK}` }}>
                            <button onClick={() => upd(e.empleado_id, { [campo]: Math.max(0, val - 1) } as Partial<Medicion>)} style={{ padding: '5px 9px', background: BLANCO, border: 'none', borderRight: `2px solid ${INK}`, cursor: 'pointer', color: INK, display: 'flex' }}><Minus size={13} /></button>
                            <span style={{ fontFamily: OSW, fontSize: 17, fontWeight: 700, minWidth: 34, textAlign: 'center', color: malo ? GRANATE : INK }}>{val}</span>
                            <button onClick={() => upd(e.empleado_id, { [campo]: val + 1 } as Partial<Medicion>)} style={{ padding: '5px 9px', background: BLANCO, border: 'none', borderLeft: `2px solid ${INK}`, cursor: 'pointer', color: INK, display: 'flex' }}><Plus size={13} /></button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 14, borderTop: `2px solid ${CLARO}`, paddingTop: 12 }}>
                  <label style={{ ...chkLabel, color: m.muerte_personal ? ROJO : INK, fontWeight: m.muerte_personal ? 700 : 400 }}>
                    <input type="checkbox" checked={m.muerte_personal} style={{ width: 17, height: 17, cursor: 'pointer' }}
                      onChange={ev => upd(e.empleado_id, { muerte_personal: ev.target.checked, muerte_personal_motivo: ev.target.checked ? m.muerte_personal_motivo : null })} />
                    Regla de compañerismo (anula su mes)
                  </label>
                  {m.muerte_personal && (
                    <input type="text" placeholder="Motivo" value={m.muerte_personal_motivo ?? ''}
                      onChange={ev => upd(e.empleado_id, { muerte_personal_motivo: ev.target.value })}
                      style={{ ...NUM, width: 240, textAlign: 'left' }} />
                  )}
                  <div style={{ flex: 1 }} />
                  <BotonImprimir compacto documentoId="equipo.plan_incentivos"
                    titulo={`Plan de Incentivos · ${e.nombre}`}
                    etiqueta="Su plan"
                    generarPdf={async opts => { const rec = await M.cargarRecursos(); return construirPlanIncentivosPDF(cfgPdf, rec, { bn: opts.bn, para: e.nombre, mes, anio }) }} />
                  <BotonImprimir compacto documentoId="equipo.incentivos_empleado"
                    titulo={`Hoja de incentivos · ${e.nombre} · ${MESES_LARGO[mes - 1]} ${anio}`}
                    etiqueta="Su mes"
                    generarPdf={async opts => { const rec = await M.cargarRecursos(); return construirIncentivosPDF(cfg, mc, e, m, fact, estimado, mes, anio, rec, opts.bn) }} />
                </div>
              </Papel>
            )
          })}
        </div>
      </div>

      <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, lineHeight: 1.6 }}>
        Tope {EUR(Number(cfg.tope_total))} por persona · Reembolsos: 0 € → {EUR(Number(cfg.reemb_eur1) + Number(cfg.reemb_cero_extra))} · hasta {EUR(Number(cfg.reemb_lim1))} → {EUR(Number(cfg.reemb_eur1))} · hasta {EUR(Number(cfg.reemb_lim2))} → {EUR(Number(cfg.reemb_eur2))} · Tardes: {cfg.tardes_permitidas} gratis y después −{EUR(Number(cfg.pen_tarde))}, en apertura −{EUR(Number(cfg.pen_apertura))} · Constancia: {cfg.bonus_meses} meses al 100% → +{EUR(Number(cfg.bonus_constancia))}.
        Todo lo marcado [EST] es estimación con el ritmo del mes en curso; el pago se calcula con el mes cerrado. El plan puede modificarse según las métricas a conseguir y se avisa antes del mes en que aplica. Documento personal e intransferible.
      </div>
    </PantallaCantera>
  )
}
