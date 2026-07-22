import { GRANATE, INK, LIMA, VERDE } from '@/styles/neobrutal'
import { INCENTIVOS_PRINT as IP } from '@/styles/palettes'
import { useEffect, useMemo, useState } from 'react'
import { Printer, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'

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

export default function TabIncentivos() {
  const { T } = useTheme()
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

  function imprimir(e: EmpRow) {
    if (!cfg) return
    const r = calc(cfg, e, meds[e.empleado_id], fact)
    const w = window.open('', '_blank', 'width=760,height=900')
    if (!w) return
    const row = (k: string, v: string) => `<tr><td style="padding:8px 4px;border-bottom:1px solid ${IP.borde}">${k}</td><td style="padding:8px 4px;border-bottom:1px solid ${IP.borde};text-align:right;font-weight:600">${v}</td></tr>`
    w.document.write(`<html><head><title>Incentivos ${e.nombre}</title></head>
      <body style="font-family:Arial,sans-serif;max-width:640px;margin:32px auto;color:${IP.texto}">
      <h1 style="font-size:22px;margin:0">Incentivos · ${e.nombre}</h1>
      <div style="color:${IP.mut};margin-bottom:20px">${MESES[mes-1]} ${anio}</div>
      <div style="background:${IP.fondoSuave};padding:16px;border-radius:8px;margin-bottom:20px">
        <div style="font-size:12px;color:${IP.mut};text-transform:uppercase;letter-spacing:1px">Facturación cocina este mes</div>
        <div style="font-size:28px;font-weight:700">${fact.toLocaleString('es-ES')} €</div>
        <div style="font-size:13px;color:${IP.mut}">Candado: ${cfg.tramo1.toLocaleString('es-ES')} abre · ${cfg.tramo2.toLocaleString('es-ES')} sube · ${cfg.tramo3.toLocaleString('es-ES')} completo — <b>Nivel ${r.nivel}</b></div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${row('Por facturación', EUR(r.impFact))}
        ${row('Global compartido (reembolsos, limpieza, mermas, incidencias)', EUR(r.impGlobal))}
        ${row('Personal (puntualidad, errores)', EUR(r.impPers))}
      </table>
      <div style="display:flex;justify-content:space-between;margin-top:20px;padding-top:16px;border-top:2px solid ${IP.texto}">
        <div style="font-size:16px;font-weight:700">A COBRAR ESTE MES</div>
        <div style="font-size:22px;font-weight:700;color:${IP.granate}">${EUR(r.total)}</div>
      </div>
      <div style="color:${IP.pieMut};font-size:11px;margin-top:6px">Tope máximo ${EUR(cfg.tope_total)}. Si la cocina no llega a ${cfg.tramo1.toLocaleString('es-ES')} €, no se cobra ningún incentivo.</div>
      <script>window.print()</script></body></html>`)
    w.document.close()
  }

  const nivelActual = useMemo(() => {
    if (!cfg) return 0
    return fact >= cfg.tramo3 ? 3 : fact >= cfg.tramo2 ? 2 : fact >= cfg.tramo1 ? 1 : 0
  }, [cfg, fact])

  if (loading || !cfg) return <div style={{ padding: 32, color: T.mut, fontFamily: FONT.body }}>Cargando incentivos…</div>

  const pct = Math.min(100, (fact / cfg.tramo3) * 100)
  const marca = (v: number) => `${Math.min(100, (v / cfg.tramo3) * 100)}%`
  const candadoAbierto = nivelActual >= 1

  const th: React.CSSProperties = { padding: '10px 12px', fontFamily: FONT.heading, fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', color: T.mut, fontWeight: 400, textAlign: 'left', background: T.group }
  const td: React.CSSProperties = { padding: '10px 12px', fontFamily: FONT.body, fontSize: 13, color: T.pri, borderBottom: `1px solid ${T.brd}` }
  const chk: React.CSSProperties = { width: 18, height: 18, cursor: 'pointer' }
  const numInput: React.CSSProperties = { width: 52, padding: '6px 8px', borderRadius: 6, border: `1px solid ${T.brd}`, background: T.card, color: T.pri, fontFamily: FONT.body, fontSize: 13 }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={mes} onChange={e => setMes(Number(e.target.value))} style={numInput as React.CSSProperties}>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" value={anio} onChange={e => setAnio(Number(e.target.value))} style={{ ...numInput, width: 80 }} />
        <div style={{ flex: 1 }} />
        <button onClick={guardar} disabled={saving}
          style={{ padding: '12px 16px', minHeight: 44, borderRadius: 8, border: 'none', background: LIMA, color: INK, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Save size={14} /> {saving ? 'Guardando…' : 'Guardar mes'}
        </button>
      </div>

      {/* Termómetro candado */}
      <div style={{ ...cardStyle(T), marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut }}>Facturación cocina · {MESES[mes - 1]} {anio}</div>
            <div style={{ fontFamily: FONT.heading, fontSize: 34, fontWeight: 700, color: T.pri, lineHeight: 1.1 }}>{fact.toLocaleString('es-ES')} €</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: T.mut }}>Candado</div>
            <div style={{ fontFamily: FONT.heading, fontSize: 20, fontWeight: 700, color: candadoAbierto ? VERDE : GRANATE }}>
              {candadoAbierto ? `NIVEL ${nivelActual}` : 'CERRADO'}
            </div>
          </div>
        </div>
        <div style={{ position: 'relative', height: 14, borderRadius: 8, background: T.group, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: candadoAbierto ? VERDE : GRANATE, transition: 'width .4s' }} />
        </div>
        <div style={{ position: 'relative', height: 22, marginTop: 4, fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
          {[cfg.tramo1, cfg.tramo2, cfg.tramo3].map((v, i) => (
            <div key={i} style={{ position: 'absolute', left: marca(v), transform: 'translateX(-50%)', textAlign: 'center' }}>
              <span style={{ color: fact >= v ? VERDE : T.mut, fontWeight: 600 }}>{(v / 1000).toFixed(0)}k</span>
            </div>
          ))}
        </div>
        {!candadoAbierto && (
          <div style={{ marginTop: 8, fontFamily: FONT.body, fontSize: 12, color: GRANATE }}>
            Falta{' '}{(cfg.tramo1 - fact).toLocaleString('es-ES')} € para abrir el bote. Sin esto, nadie cobra incentivo.
          </div>
        )}
      </div>

      {/* Tabla empleados */}
      <div style={{ ...cardStyle(T), padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
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
                      <div style={{ fontWeight: 600 }}>{e.nombre}</div>
                      <div style={{ fontSize: 11, color: T.mut }}>
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
                      <span style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 700, color: candadoAbierto ? T.pri : T.mut }}>{EUR(r.total)}</span>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => imprimir(e)} title="Imprimir hoja"
                        style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${T.brd}`, background: T.card, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Printer size={15} color={T.sec} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 12, fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
        Tope {EUR(cfg.tope_total)} por persona. Bolsas: facturación {EUR(cfg.fact_n3)} máx · global {EUR(cfg.glob_reembolsos + cfg.glob_checklist + cfg.glob_mermas + cfg.glob_incidencias)} · personal {EUR(cfg.pers_puntualidad + cfg.pers_errores)}.
      </div>
    </div>
  )
}
