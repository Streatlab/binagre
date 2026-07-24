import { OSW, LEX, INK, CREMA, CLARO, SHADOW, BORDER_CARD, GRANATE, AMA, VERDE, LIMA, GRIS, BLANCO } from '@/styles/neobrutal'
import { HeroCantera, Papel, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'
import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import * as M from '@/lib/marcoDoc'
import BotonImprimir from '@/components/BotonImprimir'

type Config = {
  tramo1: number; tramo2: number; tramo3: number
  fact_n1: number; fact_n2: number; fact_n3: number
  glob_reembolsos: number; glob_checklist: number; glob_mermas: number; glob_incidencias: number
  pers_puntualidad: number; pers_errores: number
  tardes_permitidas: number; tope_total: number
}

type EmpRow = {
  empleado_id: string; nombre: string
  tardes_permitidas: number | null; fact_max: number | null
}

type Medicion = {
  empleado_id: string; tardes: number; errores_personales: number
  reembolsos_ok: boolean; checklist_ok: boolean; mermas_ok: boolean; incidencias_ok: boolean
}

const EUR = (n: number) => `${n.toFixed(0)} €`
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function calc(cfg: Config, e: EmpRow, m: Medicion, fact: number) {
  const nivel = fact >= cfg.tramo3 ? 3 : fact >= cfg.tramo2 ? 2 : fact >= cfg.tramo1 ? 1 : 0
  const impFact = nivel === 3 ? (e.fact_max ?? cfg.fact_n3) : nivel === 2 ? cfg.fact_n2 : nivel === 1 ? cfg.fact_n1 : 0
  const perm = e.tardes_permitidas ?? cfg.tardes_permitidas
  const impGlobal = nivel >= 1
    ? (m.reembolsos_ok ? cfg.glob_reembolsos : 0) + (m.checklist_ok ? cfg.glob_checklist : 0)
      + (m.mermas_ok ? cfg.glob_mermas : 0) + (m.incidencias_ok ? cfg.glob_incidencias : 0)
    : 0
  const impPers = nivel >= 1
    ? (m.tardes <= perm ? cfg.pers_puntualidad : 0) + (m.errores_personales === 0 ? cfg.pers_errores : 0)
    : 0
  const total = Math.min(cfg.tope_total, impFact + impGlobal + impPers)
  return { nivel, impFact, impGlobal, impPers, total, perm }
}

// ─── FASE 2: PDF con el marco único (área 'equipo') — botón Imprimir ────────
const AREA: M.Area = 'equipo'

/** Hoja de incentivos de un empleado. Sin config cargada → null (regla del marco). */
function construirIncentivosPDF(cfg: Config, e: EmpRow, m: Medicion, fact: number, mes: number, anio: number, rec: M.Recursos, bn = false) {
  const r = calc(cfg, e, m, fact)
  const doc = M.nuevaHoja({ orientation: 'portrait' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA, bn)
  const cb = M.contentBox(doc)

  let y = M.pintarCabecera(doc, ctx, { docNombre: 'Hoja de Incentivos', meta: `${MESES[mes - 1]} ${anio}`, tituloCentrado: e.nombre, area: AREA, bn })

  // Facturación / candado
  M.tarjeta(doc, cb.x0, y, cb.w, 24, AREA, { bn, fill: true })
  M.fDato(doc, ctx, false); doc.setFontSize(8); doc.setTextColor(...M.GRIS)
  doc.text('FACTURACIÓN COCINA ESTE MES', cb.x0 + 4, y + 6)
  M.fTitulo(doc, ctx, true); doc.setFontSize(18); doc.setTextColor(...M.TINTA)
  doc.text(`${fact.toLocaleString('es-ES')} €`, cb.x0 + 4, y + 15)
  M.fDato(doc, ctx, false); doc.setFontSize(8); doc.setTextColor(...M.GRIS)
  doc.text(`Candado: ${cfg.tramo1.toLocaleString('es-ES')} abre · ${cfg.tramo2.toLocaleString('es-ES')} sube · ${cfg.tramo3.toLocaleString('es-ES')} completo`, cb.x0 + 4, y + 20)
  M.pill(doc, cb.x1 - 26, y + 5, `NIVEL ${r.nivel}`, AREA, ctx, { bn })
  y += 30

  // Desglose
  const filas: Array<[string, string]> = [
    ['Por facturación', `${r.impFact.toFixed(0)} €`],
    ['Global compartido (reembolsos, limpieza, mermas, incidencias)', `${r.impGlobal.toFixed(0)} €`],
    ['Personal (puntualidad, errores)', `${r.impPers.toFixed(0)} €`],
  ]
  for (const [k, v] of filas) {
    M.fDato(doc, ctx, false); doc.setFontSize(10); doc.setTextColor(...M.TINTA)
    doc.text(k, cb.x0, y + 5, { maxWidth: cb.w - 30 })
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
  doc.text(`${r.total.toFixed(0)} €`, cb.x1, y, { align: 'right' })
  y += 8
  M.fDato(doc, ctx, false); doc.setFontSize(8); doc.setTextColor(...M.GRIS)
  doc.text(`Tope máximo ${cfg.tope_total.toFixed(0)} €. Si la cocina no llega a ${cfg.tramo1.toLocaleString('es-ES')} €, no se cobra ningún incentivo.`, cb.x0, y, { maxWidth: cb.w })

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
  const [fact, setFact] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function fetchAll() {
    setLoading(true)
    const [{ data: c }, { data: e }, { data: f }, { data: md }] = await Promise.all([
      supabase.from('incentivos_config').select('*').eq('id', 1).single(),
      supabase.from('incentivos_empleado').select('empleado_id, tardes_permitidas, fact_max, activo, empleados(nombre)').eq('activo', true),
      supabase.from('facturacion_meses').select('bruto').eq('mes', mes).eq('anio', anio),
      supabase.from('incentivos_medicion').select('*').eq('mes', mes).eq('anio', anio),
    ])
    if (c) setCfg(c as Config)
    const rows: EmpRow[] = (e ?? []).map((r: any) => ({
      empleado_id: r.empleado_id,
      nombre: r.empleados?.nombre ?? '—',
      tardes_permitidas: r.tardes_permitidas,
      fact_max: r.fact_max,
    })).sort((a, b) => a.nombre.localeCompare(b.nombre))
    setEmps(rows)
    setFact((f ?? []).reduce((s: number, x: any) => s + Number(x.bruto || 0), 0))
    const map: Record<string, Medicion> = {}
    for (const r of rows) {
      const found = (md ?? []).find((x: any) => x.empleado_id === r.empleado_id)
      map[r.empleado_id] = found ? found as Medicion : {
        empleado_id: r.empleado_id, tardes: 0, errores_personales: 0,
        reembolsos_ok: false, checklist_ok: false, mermas_ok: false, incidencias_ok: false,
      }
    }
    setMeds(map)
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
    setSaving(false)
    fetchAll()
  }

  const nivelActual = useMemo(() => {
    if (!cfg) return 0
    return fact >= cfg.tramo3 ? 3 : fact >= cfg.tramo2 ? 2 : fact >= cfg.tramo1 ? 1 : 0
  }, [cfg, fact])

  if (loading || !cfg) return <div style={{ padding: 32, color: GRIS, fontFamily: LEX }}>Cargando incentivos…</div>

  const pct = Math.min(100, (fact / cfg.tramo3) * 100)
  const marca = (v: number) => `${Math.min(100, (v / cfg.tramo3) * 100)}%`
  const candadoAbierto = nivelActual >= 1

  const th: React.CSSProperties = { padding: '10px 12px', fontFamily: OSW, fontSize: 11, textTransform: 'uppercase', letterSpacing: '1.5px', color: CREMA, fontWeight: 600, textAlign: 'left' }
  const td: React.CSSProperties = { padding: '10px 12px', fontFamily: LEX, fontSize: 13, color: INK, borderBottom: `2px solid ${INK}` }
  const chk: React.CSSProperties = { width: 18, height: 18, cursor: 'pointer' }
  const numInput: React.CSSProperties = { width: 52, padding: '6px 8px', border: `2px solid ${INK}`, borderRadius: 0, background: BLANCO, color: INK, fontFamily: OSW, fontSize: 13 }

  const tituloHero = candadoAbierto
    ? `Incentivos abiertos: nivel ${nivelActual} este mes.`
    : 'El bote de incentivos sigue cerrado este mes.'

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

      {/* Héroe del área Equipo */}
      <HeroCantera
        area="equipo"
        periodo={`${MESES[mes - 1]} ${anio}`}
        titular={tituloHero}
        etiquetaDato="Facturación cocina del mes"
        cifra={`${fact.toLocaleString('es-ES')} €`}
        resumen={!candadoAbierto
          ? <>Falta <b>{(cfg.tramo1 - fact).toLocaleString('es-ES')} €</b> para abrir el bote. Sin esto, nadie cobra incentivo.</>
          : undefined}
        atencion={[
          `Tramo 1: ${(cfg.tramo1 / 1000).toFixed(0)}k`,
          `Tramo 2: ${(cfg.tramo2 / 1000).toFixed(0)}k`,
          `Tramo 3: ${(cfg.tramo3 / 1000).toFixed(0)}k`,
        ]}
      />

      {/* Termómetro candado */}
      <Papel ceja={candadoAbierto ? VERDE : GRANATE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>Candado de facturación</div>
          <div style={{ fontFamily: OSW, fontSize: 18, fontWeight: 700, color: candadoAbierto ? VERDE : GRANATE }}>
            {candadoAbierto ? `NIVEL ${nivelActual}` : 'CERRADO'}
          </div>
        </div>
        <div style={{ position: 'relative', height: 14, border: `2px solid ${INK}`, background: CLARO, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: candadoAbierto ? VERDE : GRANATE, transition: 'width .4s' }} />
        </div>
        <div style={{ position: 'relative', height: 22, marginTop: 4, fontFamily: LEX, fontSize: 11, color: GRIS }}>
          {[cfg.tramo1, cfg.tramo2, cfg.tramo3].map((v, i) => (
            <div key={i} style={{ position: 'absolute', left: marca(v), transform: 'translateX(-50%)', textAlign: 'center' }}>
              <span style={{ color: fact >= v ? VERDE : GRIS, fontWeight: 600 }}>{(v / 1000).toFixed(0)}k</span>
            </div>
          ))}
        </div>
      </Papel>

      {/* Tabla empleados */}
      <SeccionLabel bg={GRANATE}>Incentivos por empleado</SeccionLabel>
      <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: INK }}>
              <th style={th}>Empleado</th>
              <th style={th}>Tardes</th>
              <th style={th}>Errores</th>
              <th style={{ ...th, textAlign: 'center' }}>Reemb.</th>
              <th style={{ ...th, textAlign: 'center' }}>Limpieza</th>
              <th style={{ ...th, textAlign: 'center' }}>Mermas</th>
              <th style={{ ...th, textAlign: 'center' }}>Incid.</th>
              <th style={{ ...th, textAlign: 'right' }}>Total</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {emps.map(e => {
              const m = meds[e.empleado_id]
              const r = calc(cfg, e, m, fact)
              return (
                <tr key={e.empleado_id}>
                  <td style={td}>
                    <div style={{ fontFamily: OSW, fontWeight: 600 }}>{e.nombre}</div>
                    <div style={{ fontSize: 11, color: GRIS }}>
                      Fact {EUR(r.impFact)} · Global {EUR(r.impGlobal)} · Pers {EUR(r.impPers)}
                    </div>
                  </td>
                  <td style={td}>
                    <input type="number" min={0} value={m.tardes} onChange={ev => upd(e.empleado_id, { tardes: Number(ev.target.value) })} style={numInput} />
                    <span style={{ fontSize: 10, color: m.tardes <= r.perm ? VERDE : GRANATE, marginLeft: 4 }}>/{r.perm}</span>
                  </td>
                  <td style={td}>
                    <input type="number" min={0} value={m.errores_personales} onChange={ev => upd(e.empleado_id, { errores_personales: Number(ev.target.value) })} style={numInput} />
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}><input type="checkbox" checked={m.reembolsos_ok} onChange={ev => upd(e.empleado_id, { reembolsos_ok: ev.target.checked })} style={chk} /></td>
                  <td style={{ ...td, textAlign: 'center' }}><input type="checkbox" checked={m.checklist_ok} onChange={ev => upd(e.empleado_id, { checklist_ok: ev.target.checked })} style={chk} /></td>
                  <td style={{ ...td, textAlign: 'center' }}><input type="checkbox" checked={m.mermas_ok} onChange={ev => upd(e.empleado_id, { mermas_ok: ev.target.checked })} style={chk} /></td>
                  <td style={{ ...td, textAlign: 'center' }}><input type="checkbox" checked={m.incidencias_ok} onChange={ev => upd(e.empleado_id, { incidencias_ok: ev.target.checked })} style={chk} /></td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <span style={{ fontFamily: OSW, fontSize: 18, fontWeight: 700, color: candadoAbierto ? INK : GRIS }}>{EUR(r.total)}</span>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <BotonImprimir
                      compacto
                      documentoId="equipo.incentivos_empleado"
                      titulo={`Hoja de incentivos · ${e.nombre} · ${MESES[mes - 1]} ${anio}`}
                      generarPdf={async opts => { const rec = await M.cargarRecursos(); return construirIncentivosPDF(cfg, e, m, fact, mes, anio, rec, opts.bn) }}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Papel>

      <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS }}>
        Tope {EUR(cfg.tope_total)} por persona. Bolsas: facturación {EUR(cfg.fact_n3)} máx · global {EUR(cfg.glob_reembolsos + cfg.glob_checklist + cfg.glob_mermas + cfg.glob_incidencias)} · personal {EUR(cfg.pers_puntualidad + cfg.pers_errores)}.
      </div>
    </PantallaCantera>
  )
}
