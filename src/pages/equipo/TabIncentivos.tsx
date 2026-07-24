import { OSW, LEX, INK, CREMA, CLARO, SHADOW, GRANATE, VERDE, GRIS, BLANCO } from '@/styles/neobrutal'
import { HeroCantera, Papel, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'
import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import * as M from '@/lib/marcoDoc'
import BotonImprimir from '@/components/BotonImprimir'

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
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

/** Etiqueta eyebrow legible (tinta, no gris claro) — CANTERA. */
const EYEBROW: React.CSSProperties = { fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: INK, fontWeight: 700 }

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

function construirIncentivosPDF(cfg: Config, mc: MesColectivo, e: EmpRow, m: Medicion, fact: number, mes: number, anio: number, rec: M.Recursos, bn = false) {
  const r = calcV13(cfg, mc, m, fact)
  const doc = M.nuevaHoja({ orientation: 'portrait' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA, bn)
  const cb = M.contentBox(doc)

  let y = M.pintarCabecera(doc, ctx, { docNombre: 'Hoja de Incentivos', meta: `${MESES[mes - 1]} ${anio}`, tituloCentrado: e.nombre, area: AREA, bn })

  M.tarjeta(doc, cb.x0, y, cb.w, 26, AREA, { bn, fill: true })
  M.fDato(doc, ctx, false); doc.setFontSize(8); doc.setTextColor(...M.GRIS)
  doc.text('FACTURACIÓN COCINA ESTE MES', cb.x0 + 4, y + 6)
  M.fTitulo(doc, ctx, true); doc.setFontSize(18); doc.setTextColor(...M.TINTA)
  doc.text(`${fact.toLocaleString('es-ES')} €`, cb.x0 + 4, y + 15)
  M.fDato(doc, ctx, false); doc.setFontSize(8); doc.setTextColor(...M.GRIS)
  doc.text(`Candado: ${Number(cfg.fact_min).toLocaleString('es-ES')} abre ×${cfg.mult_n1} · ${Number(cfg.fact_t2).toLocaleString('es-ES')} ×${cfg.mult_n2} · ${Number(cfg.fact_t3).toLocaleString('es-ES')} ×${cfg.mult_n3}`, cb.x0 + 4, y + 21)
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
  doc.text('A COBRAR ESTE MES', cb.x0, y)
  doc.setFontSize(18); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
  doc.text(EUR(r.total), cb.x1, y, { align: 'right' })
  y += 8
  M.fDato(doc, ctx, false); doc.setFontSize(8); doc.setTextColor(...M.GRIS)
  const nota = m.muerte_personal
    ? 'Regla de compañerismo activada este mes: el incentivo personal queda a 0 €.'
    : mc.muerte
      ? 'Este mes hubo una cancelación de pedido o cierre de tienda: el incentivo queda a 0 € para toda la cocina.'
      : `(${EUR(r.col)} colectivo + ${EUR(r.ind)} individual − ${EUR(r.pen)}) × ${r.k}. Tope ${EUR(Number(cfg.tope_total))}. Si la cocina no llega a ${Number(cfg.fact_min).toLocaleString('es-ES')} €, no hay incentivos.`
  doc.text(nota, cb.x0, y, { maxWidth: cb.w })

  M.pintarPaginado(doc, 1, 1, ctx)
  return doc
}

export default function TabIncentivos() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [cfg, setCfg] = useState<Config | null>(null)
  const [emps, setEmps] = useState<EmpRow[]>([])
  const [meds, setMeds] = useState<Record<string, Medicion>>({})
  const [mc, setMc] = useState<MesColectivo>({ reembolsos_total: 0, reembolsos_sin_foto: 0, inventario_ok: false, retrasos_ok: false, valoracion_ok: false, valoracion_nota: null, fact_override: null, muerte: false, muerte_motivo: null })
  const [factReal, setFactReal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function fetchAll() {
    setLoading(true)
    const [{ data: c }, { data: e }, { data: f }, { data: md }, { data: im }] = await Promise.all([
      supabase.from('incentivos_config').select('*').eq('id', 1).single(),
      supabase.from('incentivos_empleado').select('empleado_id, activo, empleados(nombre)').eq('activo', true),
      supabase.from('facturacion_meses').select('bruto').eq('mes', mes).eq('anio', anio),
      supabase.from('incentivos_medicion').select('*').eq('mes', mes).eq('anio', anio),
      supabase.from('incentivos_mes').select('*').eq('mes', mes).eq('anio', anio).maybeSingle(),
    ])
    if (c) setCfg(c as Config)
    const rows: EmpRow[] = (e ?? []).map((r: any) => ({
      empleado_id: r.empleado_id,
      nombre: r.empleados?.nombre ?? '—',
    })).sort((a, b) => a.nombre.localeCompare(b.nombre))
    setEmps(rows)
    setFactReal((f ?? []).reduce((s: number, x: any) => s + Number(x.bruto || 0), 0))
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

  async function guardar() {
    setSaving(true)
    const rows = Object.values(meds).map(m => ({ ...m, mes, anio }))
    await supabase.from('incentivos_medicion').upsert(rows, { onConflict: 'mes,anio,empleado_id' })
    await supabase.from('incentivos_mes').upsert([{ ...mc, mes, anio, updated_at: new Date().toISOString() }], { onConflict: 'anio,mes' })
    setSaving(false)
    fetchAll()
  }

  if (loading || !cfg) return <div style={{ padding: 32, color: INK, fontFamily: LEX }}>Cargando incentivos…</div>

  const fact = mc.fact_override != null ? mc.fact_override : factReal
  const k = multiplicador(cfg, fact)
  const abierto = k > 0 && !mc.muerte
  const pct = Math.min(100, (fact / Number(cfg.fact_t3)) * 100)
  const marca = (v: number) => `${Math.min(100, (v / Number(cfg.fact_t3)) * 100)}%`
  const eReemb = eurReembolsos(cfg, mc)
  const computa = Number(mc.reembolsos_total) + Number(mc.reembolsos_sin_foto)
  const colTotal = eReemb + (mc.inventario_ok ? Number(cfg.inventario_eur) : 0) + (mc.retrasos_ok ? Number(cfg.retrasos_eur) : 0) + (mc.valoracion_ok ? Number(cfg.valoracion_eur) : 0)

  const th: React.CSSProperties = { padding: '10px 12px', fontFamily: OSW, fontSize: 11, textTransform: 'uppercase', letterSpacing: '1.5px', color: CREMA, fontWeight: 600, textAlign: 'left' }
  const td: React.CSSProperties = { padding: '10px 12px', fontFamily: LEX, fontSize: 13, color: INK, borderBottom: `2px solid ${INK}` }
  const chk: React.CSSProperties = { width: 18, height: 18, cursor: 'pointer' }
  const numInput: React.CSSProperties = { width: 52, padding: '6px 8px', border: `2px solid ${INK}`, borderRadius: 0, background: BLANCO, color: INK, fontFamily: OSW, fontSize: 13 }
  const lbl: React.CSSProperties = { ...EYEBROW, fontSize: 11, marginBottom: 4, display: 'block' }
  const chkLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontFamily: LEX, fontSize: 13.5, color: INK, cursor: 'pointer' }

  const tituloHero = mc.muerte
    ? 'Regla de muerte activada: incentivo del mes a cero.'
    : abierto
      ? `Incentivos abiertos: todo lo ganado se multiplica ×${k}.`
      : 'El candado de facturación sigue cerrado este mes.'

  return (
    <PantallaCantera embedded>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={mes} onChange={e => setMes(Number(e.target.value))} style={numInput as React.CSSProperties}>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" value={anio} onChange={e => setAnio(Number(e.target.value))} style={{ ...numInput, width: 80 }} />
        <div style={{ flex: 1 }} />
        <button onClick={guardar} disabled={saving}
          style={{ padding: '9px 16px', border: `3px solid ${INK}`, boxShadow: SHADOW, background: GRANATE, color: BLANCO, fontFamily: OSW, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Save size={14} /> {saving ? 'Guardando…' : 'Guardar mes'}
        </button>
      </div>

      <HeroCantera
        area="equipo"
        periodo={`${MESES[mes - 1]} ${anio}`}
        titular={tituloHero}
        etiquetaDato={mc.fact_override != null ? 'Facturación cocina del mes (manual)' : 'Facturación cocina del mes'}
        cifra={`${fact.toLocaleString('es-ES')} €`}
        resumen={!abierto && !mc.muerte
          ? <>Falta <b>{Math.max(0, Number(cfg.fact_min) - fact).toLocaleString('es-ES')} €</b> para abrir el sistema. Objetivo diario: 900-1.000 €.</>
          : undefined}
        atencion={[
          `${(Number(cfg.fact_min) / 1000).toFixed(0)}k ×${cfg.mult_n1}`,
          `${(Number(cfg.fact_t2) / 1000).toFixed(0)}k ×${cfg.mult_n2}`,
          `${(Number(cfg.fact_t3) / 1000).toFixed(0)}k ×${cfg.mult_n3}`,
        ]}
      />

      <Papel ceja={abierto ? VERDE : GRANATE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
          <div style={EYEBROW}>Candado de facturación</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ ...chkLabel, fontSize: 12 }}>
              Manual:
              <input type="number" min={0} placeholder="auto" value={mc.fact_override ?? ''}
                onChange={e => setMc({ ...mc, fact_override: e.target.value === '' ? null : Number(e.target.value) })}
                style={{ ...numInput, width: 90 }} />
              €
            </label>
            <div style={{ fontFamily: OSW, fontSize: 18, fontWeight: 700, color: abierto ? VERDE : GRANATE }}>
              {mc.muerte ? 'MUERTE' : abierto ? `×${k}` : 'CERRADO'}
            </div>
          </div>
        </div>
        <div style={{ position: 'relative', height: 14, border: `2px solid ${INK}`, background: CLARO, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: abierto ? VERDE : GRANATE, transition: 'width .4s' }} />
        </div>
        <div style={{ position: 'relative', height: 22, marginTop: 4, fontFamily: LEX, fontSize: 12, color: INK }}>
          {[Number(cfg.fact_min), Number(cfg.fact_t2), Number(cfg.fact_t3)].map((v, i) => (
            <div key={i} style={{ position: 'absolute', left: marca(v), transform: 'translateX(-50%)', textAlign: 'center' }}>
              <span style={{ color: fact >= v ? VERDE : INK, fontWeight: 700 }}>{(v / 1000).toFixed(0)}k</span>
            </div>
          ))}
        </div>
        {mc.fact_override == null && <div style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS, marginTop: 6 }}>Dato automático de ventas ({factReal.toLocaleString('es-ES')} €). Rellena "Manual" solo si algo falla.</div>}
      </Papel>

      <Papel ceja={mc.muerte ? GRANATE : VERDE}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ ...EYEBROW, flex: 1 }}>Regla de muerte · cancelación o cierre en horario (afecta a todos)</div>
          <label style={chkLabel}>
            <input type="checkbox" checked={mc.muerte} onChange={e => setMc({ ...mc, muerte: e.target.checked })} style={chk} />
            Activada este mes
          </label>
          {mc.muerte && (
            <input type="text" placeholder="Motivo (pedido, fecha…)" value={mc.muerte_motivo ?? ''} onChange={e => setMc({ ...mc, muerte_motivo: e.target.value })}
              style={{ ...numInput, width: 260 }} />
          )}
        </div>
        <div style={{ fontFamily: LEX, fontSize: 12, color: INK, marginTop: 8 }}>
          Existe además la <b>regla de compañerismo</b> (individual): faltas de respeto, incidentes graves de actitud o dejar tirado al equipo anulan el incentivo del mes solo de esa persona. Se marca en su fila.
        </div>
      </Papel>

      <SeccionLabel bg={GRANATE}>Bloque colectivo · todos o nadie</SeccionLabel>
      <Papel ceja={GRANATE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={chkLabel}>
            <input type="checkbox" checked={mc.retrasos_ok} onChange={e => setMc({ ...mc, retrasos_ok: e.target.checked })} style={chk} />
            <b>Entregas a tiempo</b>: sin retrasos al rider y tiempo de preparación cumplido ({EUR(Number(cfg.retrasos_eur))}) — lo que más premian las plataformas
          </label>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <span style={lbl}>Reembolsos del mes (€)</span>
              <input type="number" min={0} value={mc.reembolsos_total} onChange={e => setMc({ ...mc, reembolsos_total: Number(e.target.value) || 0 })} style={{ ...numInput, width: 90 }} />
            </div>
            <div>
              <span style={lbl}>Sin foto (cuentan doble, €)</span>
              <input type="number" min={0} value={mc.reembolsos_sin_foto} onChange={e => setMc({ ...mc, reembolsos_sin_foto: Number(e.target.value) || 0 })} style={{ ...numInput, width: 90 }} />
            </div>
            <div style={{ fontFamily: LEX, fontSize: 13.5, fontWeight: 600, color: eReemb > 0 ? VERDE : GRANATE, paddingBottom: 8 }}>
              Computan {EUR(computa)} → {computa === 0 ? `CERO reembolsos: ${EUR(Number(cfg.reemb_eur1))} + ${EUR(Number(cfg.reemb_cero_extra))} de premio` : eReemb > 0 ? `tramo de ${EUR(eReemb)}` : `fuera de tramos: 0 €`}
            </div>
          </div>
          <label style={chkLabel}>
            <input type="checkbox" checked={mc.inventario_ok} onChange={e => setMc({ ...mc, inventario_ok: e.target.checked })} style={chk} />
            Inventario permanente: examen sorpresa con descuadre ≤ {Number(cfg.inventario_tolerancia_pct)}% del valor contado ({EUR(Number(cfg.inventario_eur))})
          </label>
          <label style={{ ...chkLabel, flexWrap: 'wrap' }}>
            <input type="checkbox" checked={mc.valoracion_ok} onChange={e => setMc({ ...mc, valoracion_ok: e.target.checked })} style={chk} />
            Valoración de clientes: se mantiene o mejora ({EUR(Number(cfg.valoracion_eur))})
            <span style={{ fontSize: 12, color: INK }}>Nota media:</span>
            <input type="number" min={0} max={5} step={0.1} placeholder="—" value={mc.valoracion_nota ?? ''}
              onChange={e => setMc({ ...mc, valoracion_nota: e.target.value === '' ? null : Number(e.target.value) })}
              style={{ ...numInput, width: 64 }} />
          </label>
        </div>
        <div style={{ fontFamily: OSW, fontSize: 16, fontWeight: 700, marginTop: 12, color: INK }}>
          Colectivo del mes: {EUR(colTotal)}
        </div>
      </Papel>

      <SeccionLabel bg={GRANATE}>Incentivos por empleado</SeccionLabel>
      <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: INK }}>
              <th style={th}>Empleado</th>
              <th style={{ ...th, textAlign: 'center' }}>Vacío ({EUR(Number(cfg.vacio_eur))})</th>
              <th style={{ ...th, textAlign: 'center' }}>Checklists ({EUR(Number(cfg.checklist_eur))})</th>
              <th style={th}>Verificado por</th>
              <th style={{ ...th, textAlign: 'center' }}>Fechado ({EUR(Number(cfg.fechado_eur))})</th>
              <th style={th}>Tardes</th>
              <th style={th}>Apertura</th>
              <th style={{ ...th, textAlign: 'center' }}>Compañerismo</th>
              <th style={{ ...th, textAlign: 'right' }}>Total</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {emps.map(e => {
              const m = meds[e.empleado_id]
              const r = calcV13(cfg, mc, m, fact)
              return (
                <tr key={e.empleado_id} style={m.muerte_personal ? { background: '#fbecec' } : undefined}>
                  <td style={td}>
                    <div style={{ fontFamily: OSW, fontWeight: 600 }}>{e.nombre}</div>
                    <div style={{ fontSize: 11.5, color: m.muerte_personal ? GRANATE : INK, fontWeight: m.muerte_personal ? 700 : 400 }}>
                      {m.muerte_personal ? 'REGLA DE COMPAÑERISMO: incentivo del mes anulado' : <>Col {EUR(r.col)} · Ind {EUR(r.ind)}{r.pen > 0 ? ` · Pen −${EUR(r.pen)}` : ''} · ×{r.k}</>}
                    </div>
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}><input type="checkbox" checked={m.vacio_ok} onChange={ev => upd(e.empleado_id, { vacio_ok: ev.target.checked })} style={chk} /></td>
                  <td style={{ ...td, textAlign: 'center' }}><input type="checkbox" checked={m.checklist_ok} onChange={ev => upd(e.empleado_id, { checklist_ok: ev.target.checked })} style={chk} /></td>
                  <td style={td}>
                    <select value={m.checklist_verificado_por ?? ''} onChange={ev => upd(e.empleado_id, { checklist_verificado_por: ev.target.value || null })} style={{ ...numInput, width: 120 }}>
                      <option value="">—</option>
                      {emps.filter(x => x.empleado_id !== e.empleado_id).map(x => <option key={x.empleado_id} value={x.empleado_id}>{x.nombre}</option>)}
                    </select>
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}><input type="checkbox" checked={m.fechado_ok} onChange={ev => upd(e.empleado_id, { fechado_ok: ev.target.checked })} style={chk} /></td>
                  <td style={td}>
                    <input type="number" min={0} value={m.tardes} onChange={ev => upd(e.empleado_id, { tardes: Number(ev.target.value) || 0 })} style={numInput} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: m.tardes <= cfg.tardes_permitidas ? VERDE : GRANATE, marginLeft: 4 }}>/{cfg.tardes_permitidas}</span>
                  </td>
                  <td style={td}>
                    <input type="number" min={0} value={m.tardes_apertura} onChange={ev => upd(e.empleado_id, { tardes_apertura: Number(ev.target.value) || 0 })} style={numInput} />
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <input type="checkbox" checked={m.muerte_personal} title="Marcar solo por falta de respeto o incidente grave de actitud: anula su incentivo del mes"
                      onChange={ev => upd(e.empleado_id, { muerte_personal: ev.target.checked, muerte_personal_motivo: ev.target.checked ? m.muerte_personal_motivo : null })} style={chk} />
                    {m.muerte_personal && (
                      <input type="text" placeholder="Motivo" value={m.muerte_personal_motivo ?? ''}
                        onChange={ev => upd(e.empleado_id, { muerte_personal_motivo: ev.target.value })}
                        style={{ ...numInput, width: 110, marginLeft: 6 }} />
                    )}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <span style={{ fontFamily: OSW, fontSize: 18, fontWeight: 700, color: r.total > 0 ? INK : GRIS }}>{EUR(r.total)}</span>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <BotonImprimir
                      compacto
                      documentoId="equipo.incentivos_empleado"
                      titulo={`Hoja de incentivos · ${e.nombre} · ${MESES[mes - 1]} ${anio}`}
                      generarPdf={async opts => { const rec = await M.cargarRecursos(); return construirIncentivosPDF(cfg, mc, e, m, fact, mes, anio, rec, opts.bn) }}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Papel>

      <div style={{ fontFamily: LEX, fontSize: 12, color: INK }}>
        Tope {EUR(Number(cfg.tope_total))} por persona. Reembolsos: 0 € → {EUR(Number(cfg.reemb_eur1) + Number(cfg.reemb_cero_extra))} · ≤{EUR(Number(cfg.reemb_lim1))} → {EUR(Number(cfg.reemb_eur1))} · ≤{EUR(Number(cfg.reemb_lim2))} → {EUR(Number(cfg.reemb_eur2))}. Penalización: {EUR(Number(cfg.pen_tarde))}/tarde a partir de la {cfg.tardes_permitidas + 1}ª, {EUR(Number(cfg.pen_apertura))} por tarde en apertura. Constancia: {cfg.bonus_meses} meses al 100% → +{EUR(Number(cfg.bonus_constancia))}.
      </div>
    </PantallaCantera>
  )
}
