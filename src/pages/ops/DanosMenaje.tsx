import { BLANCO, GRANATE, GRIS, INK } from '@/styles/neobrutal'
import { ERROR_BANNER_BG, ERROR_BANNER_BORDE } from '@/styles/palettes'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'
import { toLocalDateStr } from '@/lib/dateRange'
import { COLORS } from '@/components/panel/resumen/tokens'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'
import * as M from '@/lib/marcoDoc'
import BotonImprimir from '@/components/BotonImprimir'

/* ═══ PDF — MARCO ÚNICO (src/lib/marcoDoc.ts) — VERTICAL ═══ */
const AREA: M.Area = 'cocina'

function crearPDFDanos(danos: DanoMenaje[], costeMes: number, costeTotal: number, rec: M.Recursos, bn = false) {
  if (danos.length === 0) return null
  const doc = M.nuevaHoja({ orientation: 'portrait' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA, bn)
  const cb = M.contentBox(doc)

  const nuevaPagina = () => {
    M.pintarEspina(doc, AREA, ctx, bn)
    return M.pintarCabecera(doc, ctx, { docNombre: 'Parte de Daños de Menaje', meta: `Coste mes ${fmtEurLocal(costeMes)} · Total ${fmtEurLocal(costeTotal)}`, area: AREA, bn })
  }
  let y = nuevaPagina()

  const xItem = cb.x0 + 1.5
  const xCant = cb.x0 + cb.w * 0.42
  const xCoste = cb.x1 - 24
  const xFecha = cb.x1 - 1

  doc.setFillColor(pal.soft2[0], pal.soft2[1], pal.soft2[2]); doc.rect(cb.x0, y, cb.w, 6, 'F')
  M.fTitulo(doc, ctx, true); doc.setFontSize(7.5); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
  doc.text('ÍTEM / DESCRIPCIÓN', xItem, y + 4.2)
  doc.text('CANT.', xCant, y + 4.2)
  doc.text('COSTE', xCoste, y + 4.2)
  doc.text('FECHA', xFecha, y + 4.2, { align: 'right' })
  y += 8

  for (const d of danos) {
    if (y > cb.bottom - 10) { doc.addPage(); y = nuevaPagina() }
    M.fDato(doc, ctx, true); doc.setFontSize(9.5); doc.setTextColor(...M.TINTA)
    doc.text(d.item, xItem, y + 4.2, { maxWidth: xCant - xItem - 3 })
    doc.setTextColor(...M.GRIS)
    doc.text(String(d.cantidad), xCant, y + 4.2)
    doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
    doc.text(fmtEurLocal(d.coste_total), xCoste, y + 4.2)
    doc.setTextColor(...M.GRIS)
    const [yy, mm, dd] = d.fecha.split('-')
    doc.text(`${dd}/${mm}/${yy}`, xFecha, y + 4.2, { align: 'right' })
    let yy2 = y + 4.2
    if (d.descripcion) {
      doc.setFontSize(8); doc.setTextColor(...M.GRIS)
      doc.text(d.descripcion, xItem, y + 8.2, { maxWidth: cb.w - 3 })
      yy2 = y + 8.2
    }
    doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.15)
    doc.line(cb.x0, yy2 + 2, cb.x1, yy2 + 2)
    y = yy2 + 5.5
  }

  const totalPag = doc.getNumberOfPages()
  for (let p = 1; p <= totalPag; p++) { doc.setPage(p); M.pintarPaginado(doc, p, totalPag, ctx) }
  return doc
}

interface DanoMenaje {
  id: string
  item: string
  cantidad: number
  coste_unitario: number | null
  coste_total: number | null
  descripcion: string | null
  fecha: string
  created_at: string
}

function fmtEurLocal(n: number | null): string {
  if (n === null) return '—'
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtFecha(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function mesActual(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function DanosMenaje() {
  const [danos, setDanos] = useState<DanoMenaje[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ item: '', cantidad: '1', coste_unitario: '', descripcion: '', fecha: toLocalDateStr(new Date()) })
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase.from('danos_menaje').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false })
      if (e) throw e
      setDanos((data ?? []) as DanoMenaje[])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('42P01') ? 'Tabla danos_menaje no encontrada.' : `Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  async function addDano() {
    if (!form.item.trim()) return
    setSaving(true)
    const cantidad = parseFloat(form.cantidad) || 1
    const costeUnit = form.coste_unitario ? parseFloat(form.coste_unitario) : null
    const costeTotal = costeUnit !== null ? costeUnit * cantidad : null
    const { error: e } = await supabase.from('danos_menaje').insert({
      item: form.item.trim(), cantidad, coste_unitario: costeUnit, coste_total: costeTotal,
      descripcion: form.descripcion || null, fecha: form.fecha,
    })
    if (!e) {
      setForm({ item: '', cantidad: '1', coste_unitario: '', descripcion: '', fecha: toLocalDateStr(new Date()) })
      setShowForm(false)
      await loadData()
    }
    setSaving(false)
  }

  const mes = mesActual()
  const kpiMes = danos.filter(d => d.fecha.startsWith(mes)).reduce((s, d) => s + (d.coste_total ?? 0), 0)
  const kpiTotal = danos.reduce((s, d) => s + (d.coste_total ?? 0), 0)
  const danosMes = danos.filter(d => d.fecha.startsWith(mes))

  const titularHero = danos.length === 0
    ? 'Aún no hay daños de menaje registrados.'
    : danosMes.length > 0
      ? `${danosMes.length} ${danosMes.length === 1 ? 'daño' : 'daños'} registrados este mes.`
      : 'Sin daños registrados este mes.'

  const atencionHero = [
    danosMes.length > 0 ? `${danosMes.length} este mes` : null,
    `${danos.length} en total`,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera>

      {/* Acción propia */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <BotonImprimir
          compacto
          documentoId="operaciones.danos_menaje"
          titulo="Parte de daños de menaje"
          generarPdf={async opts => { const rec = await M.cargarRecursos(); return crearPDFDanos(danos, kpiMes, kpiTotal, rec, opts.bn) }}
        />
        <button onClick={() => setShowForm(s => !s)}
          style={{ padding: '9px 18px', background: COLORS.glovo, color: INK, border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
          + Añadir daño
        </button>
      </div>

      {/* 1 · Héroe del área Operaciones (naranja) */}
      <HeroCantera
        area="ops"
        titular={titularHero}
        etiquetaDato="Coste este mes"
        cifra={fmtEurLocal(kpiMes)}
        atencion={atencionHero}
      />

      {error && <Papel ceja={ERROR_BANNER_BORDE} style={{ background: ERROR_BANNER_BG, border: `1px solid ${ERROR_BANNER_BORDE}`, color: COLORS.redSL }}>{error}</Papel>}

      {/* 3 · Frase potente */}
      {!loading && (
        kpiTotal > 0
          ? <FrasePotente significado="coste">El menaje roto o perdido cuesta dinero: revisa manipulación y almacenaje.</FrasePotente>
          : <FrasePotente significado="logro">Sin daños de menaje registrados: la manipulación va bien.</FrasePotente>
      )}

      {/* KPIs */}
      <Plancha>
        <PlanchaCelda first bg={COLORS.redSL}>
          <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 6 }}>Coste Este Mes</div>
          <div style={{ fontFamily: FONT.heading, fontSize: 26, fontWeight: 600 }}>{fmtEurLocal(kpiMes)}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={BLANCO}>
          <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: GRIS, marginBottom: 6 }}>Coste Total Histórico</div>
          <div style={{ fontFamily: FONT.heading, fontSize: 26, fontWeight: 600, color: INK }}>{fmtEurLocal(kpiTotal)}</div>
        </PlanchaCelda>
      </Plancha>

      {/* Form inline */}
      {showForm && (
        <Papel ceja={GRANATE}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {[
              { label: 'Ítem', key: 'item', type: 'text', flex: 2 },
              { label: 'Cantidad', key: 'cantidad', type: 'number', flex: 1 },
              { label: 'Coste unitario (€)', key: 'coste_unitario', type: 'number', flex: 1 },
              { label: 'Descripción', key: 'descripcion', type: 'text', flex: 2 },
              { label: 'Fecha', key: 'fecha', type: 'date', flex: 1 },
            ].map(f => (
              <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: f.flex, minWidth: 120 }}>
                <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>{f.label}</label>
                <input type={f.type} value={(form as Record<string, string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ padding: '8px 10px', background: BLANCO, border: `3px solid ${INK}`, color: INK, fontFamily: FONT.body, fontSize: 13 }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={addDano} disabled={saving}
              style={{ padding: '9px 18px', background: COLORS.redSL, color: BLANCO, border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '9px 14px', background: BLANCO, border: `3px solid ${INK}`, color: GRIS, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </Papel>
      )}

      {loading ? <div style={{ color: GRIS, fontSize: 13 }}>Cargando…</div> : (
        <div>
          <SeccionLabel bg={GRANATE}>Registros</SeccionLabel>
          <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: INK }}>
                  {['Ítem', 'Cantidad', 'Coste Unit.', 'Coste Total', 'Descripción', 'Fecha'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: BLANCO, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {danos.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '20px 14px', color: GRIS, textAlign: 'center' }}>Sin registros aún</td></tr>
                ) : danos.map(d => (
                  <tr key={d.id} style={{ borderBottom: `2px solid ${INK}` }}>
                    <td style={{ padding: '10px 14px', color: INK, fontWeight: 500 }}>{d.item}</td>
                    <td style={{ padding: '10px 14px', color: GRIS, textAlign: 'right' }}>{d.cantidad}</td>
                    <td style={{ padding: '10px 14px', color: GRIS, textAlign: 'right' }}>{fmtEurLocal(d.coste_unitario)}</td>
                    <td style={{ padding: '10px 14px', color: COLORS.redSL, fontWeight: 600, textAlign: 'right' }}>{fmtEurLocal(d.coste_total)}</td>
                    <td style={{ padding: '10px 14px', color: GRIS, fontSize: 12 }}>{d.descripcion ?? '—'}</td>
                    <td style={{ padding: '10px 14px', color: GRIS, whiteSpace: 'nowrap' }}>{fmtFecha(d.fecha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Papel>
        </div>
      )}
    </PantallaCantera>
  )
}
