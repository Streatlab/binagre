/**
 * TabHojaInventario.tsx — Tanda E: hoja de inventario imprimible + foto (OCR) + valoración.
 *
 * E1: hoja imprimible con el Marco de Documentos (HojaDoc, área Cocina), listando los
 *     ingredientes activos agrupados por categoría (fuente: categorias_ingredientes,
 *     Tanda C), con línea en blanco para anotar la cantidad contada a mano.
 * E2: "Subir foto del conteo" reutiliza el mismo robot de visión que ya existía
 *     (api/_puertas/escandallo-auto.ts, action=leer-conteo) — sin tocar el backend.
 * E3: cada línea leída se valora al precio vigente del ingrediente (coste_neto_std/eur_std).
 *     Al confirmar, `v_inventario_valorado`/`v_coste_real_periodo`/
 *     `v_varianza_ingrediente_periodo` (Supabase) quedan alimentadas para el siguiente
 *     cierre — se muestran en Escandallo → Auto, Fase D.
 * E4: sustituye al flujo "Empezar inventario de hoy" que vivía roto dentro de
 *     escandallo/TabAuto.tsx (tabla `inventarios` nunca llegó a tener una fila en toda
 *     la vida del ERP) — mismas tablas (`inventarios`/`inventario_lineas`), UI nueva.
 */
import { useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import { Printer, FileDown } from 'lucide-react'
import * as M from '@/lib/marcoDoc'
import HojaDoc from '@/components/marco/HojaDoc'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { fmtEur, fmtNum, fmtDate } from '@/utils/format'

const API = '/api/papeleo/escandallo-auto'
const AREA: M.Area = 'cocina'

interface IngLite {
  id: string
  nombre: string
  ud_std: string | null
  eur_std: number | null
  coste_neto_std: number | null
  categoria_nombre: string
  categoria_orden: number
}
interface CatGrupo { nombre: string; orden: number; items: IngLite[] }
interface InventarioRow { id: string; fecha: string; estado: string }
interface InvLinea {
  id: string
  ingrediente_id: string | null
  cantidad: number
  unidad: string | null
  confianza: number | null
  texto_leido: string | null
  ingredientes?: { nombre: string } | null
}

function precioVigente(ing: IngLite | undefined): number {
  if (!ing) return 0
  return ing.coste_neto_std ?? ing.eur_std ?? 0
}

function agruparPorCategoria(ings: IngLite[]): CatGrupo[] {
  const map = new Map<string, CatGrupo>()
  for (const i of ings) {
    if (!map.has(i.categoria_nombre)) map.set(i.categoria_nombre, { nombre: i.categoria_nombre, orden: i.categoria_orden, items: [] })
    map.get(i.categoria_nombre)!.items.push(i)
  }
  return [...map.values()].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
}

// ─── PDF real (mismo marco que Producción → Inventario Permanente) ─────────────

function pintarHojaInventario(doc: jsPDF, cats: CatGrupo[], meta: string, ctx: M.Ctx, bn: boolean) {
  const pal = M.paleta(AREA, bn)
  const yTop = M.pintarCabecera(doc, ctx, { docNombre: 'Hoja de Inventario', meta, area: AREA, bn })
  const cb = M.contentBox(doc)
  const top = yTop
  const bottom = cb.bottom
  const alturaDisp = bottom - top
  const headH = 6.5
  const gap = 1.4

  const nCols = 2
  const colGap = 5
  const colW = (cb.w - colGap) / nCols
  const xCol = [cb.x0, cb.x0 + colW + colGap]

  const cols: CatGrupo[][] = [[], []]
  const carga = [0, 0]
  for (const cat of cats) {
    const ci = carga[0] <= carga[1] ? 0 : 1
    cols[ci].push(cat)
    carga[ci] += cat.items.length + 0.8
  }

  let maxItems = 1, catsEnMax = 1, peor = -1
  for (let k = 0; k < nCols; k++) {
    const its = cols[k].reduce((a, c) => a + c.items.length, 0)
    if (carga[k] > peor) { peor = carga[k]; maxItems = Math.max(its, 1); catsEnMax = Math.max(cols[k].length, 1) }
  }
  let itemH = (alturaDisp - catsEnMax * (headH + gap)) / maxItems
  itemH = Math.max(3, Math.min(9.5, itemH))

  for (let k = 0; k < nCols; k++) {
    const x = xCol[k]
    let y = top
    for (const cat of cols[k]) {
      doc.setFillColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.roundedRect(x, y, colW, headH, M.R, M.R, 'F')
      M.fTitulo(doc, ctx, true); doc.setFontSize(11); doc.setTextColor(255, 255, 255)
      doc.text(cat.nombre.toUpperCase(), x + 3, y + headH - 2.1)
      y += headH

      for (const it of cat.items) {
        const sufijo = it.ud_std ? `  (${it.ud_std})` : ''
        const fsAltura = Math.min(16, itemH * 2.7)
        const fs = M.fitFont(doc, it.nombre + sufijo, colW * 0.55, fsAltura, 7)
        const baseY = y + itemH * 0.5 + fs * 0.13
        M.fDato(doc, ctx, false); doc.setTextColor(...M.TINTA); doc.setFontSize(fs)
        doc.text(it.nombre, x + 2.5, baseY)
        let endX = x + 2.5 + doc.getTextWidth(it.nombre)
        if (it.ud_std) {
          M.fTitulo(doc, ctx, true); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.setFontSize(fs)
          doc.text(`  (${it.ud_std})`, endX, baseY)
          endX += doc.getTextWidth(`  (${it.ud_std})`)
        }
        M.lineaRelleno(doc, endX + 3, x + colW - 2, y + itemH - 1.4)
        y += itemH
      }
      y += gap
    }
  }
}

function construirHojaInventarioPDF(cats: CatGrupo[], meta: string, rec: M.Recursos, bn = false): jsPDF {
  const doc = M.nuevaHoja({ orientation: 'landscape' })
  const ctx = M.preparar(doc, rec)
  M.pintarEspina(doc, AREA, ctx, bn)
  pintarHojaInventario(doc, cats, meta, ctx, bn)
  M.pintarPaginado(doc, 1, 1, ctx)
  return doc
}

// ─── Componente ─────────────────────────────────────────────────────────────

export default function TabHojaInventario() {
  const { T } = useTheme()
  const [ingredientes, setIngredientes] = useState<IngLite[]>([])
  const [loading, setLoading] = useState(true)
  const [inventario, setInventario] = useState<InventarioRow | null>(null)
  const [invLineas, setInvLineas] = useState<InvLinea[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function cargar() {
    setLoading(true)
    const [{ data: ings }, { data: inv }] = await Promise.all([
      supabase.from('ingredientes')
        .select('id, nombre, ud_std, eur_std, coste_neto_std, activo, categorias_ingredientes(nombre, orden)')
        .eq('activo', true)
        .order('nombre'),
      supabase.from('inventarios').select('id, fecha, estado').neq('estado', 'confirmado').order('fecha', { ascending: false }).limit(1).maybeSingle(),
    ])
    const lite: IngLite[] = ((ings as any[]) ?? []).map(i => ({
      id: i.id, nombre: i.nombre, ud_std: i.ud_std, eur_std: i.eur_std, coste_neto_std: i.coste_neto_std,
      categoria_nombre: i.categorias_ingredientes?.nombre ?? 'Sin categoría',
      categoria_orden: i.categorias_ingredientes?.orden ?? 999,
    }))
    setIngredientes(lite)
    setInventario((inv as InventarioRow) ?? null)
    if ((inv as InventarioRow)?.id) {
      const { data } = await supabase.from('inventario_lineas')
        .select('id, ingrediente_id, cantidad, unidad, confianza, texto_leido, ingredientes(nombre)')
        .eq('inventario_id', (inv as InventarioRow).id).order('created_at')
      setInvLineas((data as unknown as InvLinea[]) ?? [])
    } else {
      setInvLineas([])
    }
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  const cats = useMemo(() => agruparPorCategoria(ingredientes), [ingredientes])
  const ingPorId = useMemo(() => new Map(ingredientes.map(i => [i.id, i])), [ingredientes])
  const sinVincular = invLineas.filter(l => !l.ingrediente_id).length
  const valorTotal = useMemo(
    () => invLineas.reduce((s, l) => s + l.cantidad * precioVigente(l.ingrediente_id ? ingPorId.get(l.ingrediente_id) : undefined), 0),
    [invLineas, ingPorId],
  )

  async function generarHoja() {
    setBusy('generar')
    const { data, error } = await supabase.from('inventarios').insert({ fecha: new Date().toISOString().slice(0, 10), estado: 'borrador', tipo: 'quincenal', origen: 'hoja_impresa' }).select().single()
    if (error) { setMsg(`Error creando el inventario: ${error.message}`); setBusy(null); return }
    setInventario(data as InventarioRow)
    setInvLineas([])
    setBusy(null)
  }

  async function imprimir(bn = false) {
    if (!inventario) return
    const rec = await M.cargarRecursos()
    const meta = `FECHA ${fmtDate(inventario.fecha)} · REF ${inventario.id.slice(0, 8).toUpperCase()}`
    M.abrirImprimir(construirHojaInventarioPDF(cats, meta, rec, bn))
  }
  async function descargar(bn = false) {
    if (!inventario) return
    const rec = await M.cargarRecursos()
    const meta = `FECHA ${fmtDate(inventario.fecha)} · REF ${inventario.id.slice(0, 8).toUpperCase()}`
    M.descargar(construirHojaInventarioPDF(cats, meta, rec, bn), `hoja-inventario-${inventario.fecha}`)
  }

  async function subirFoto(file: File) {
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

  async function borrarLinea(id: string) {
    await supabase.from('inventario_lineas').delete().eq('id', id)
    setInvLineas(l => l.filter(x => x.id !== id))
  }

  async function confirmar() {
    if (!inventario) return
    setBusy('confirmar'); setMsg(null)
    try {
      const r = await fetch(`${API}/confirmar-conteo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inventario_id: inventario.id }) })
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      setMsg(j.lineas_sin_vincular_ignoradas > 0
        ? `Inventario confirmado (valorado en ${fmtEur(valorTotal)}). Ojo: ${j.lineas_sin_vincular_ignoradas} líneas sin vincular quedaron fuera.`
        : `Inventario confirmado. Valorado en ${fmtEur(valorTotal)}. La desviación frente al consumo teórico aparecerá en Escandallo → Auto (Fase D) cuando se confirme el siguiente.`)
      await cargar()
    } catch (e: any) { setMsg(`Error: ${e.message}`) } finally { setBusy(null) }
  }

  const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: `0.5px solid ${T.brd}`, background: T.card, color: T.pri, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }
  const btnPrimary: React.CSSProperties = { ...btnGhost, background: '#B01D23', color: '#ffffff', border: 'none' }

  if (loading) return <div style={{ padding: 24, color: T.mut, fontFamily: FONT.body }}>Cargando…</div>

  return (
    <div>
      <style>{`
.inv-cats { column-count: 2; column-gap: 0; }
.inv-cat { break-inside: avoid; border-right: 1px solid var(--sl-border); }
.inv-cat-head { font-family: 'Oswald', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; font-size: 15px; color: #fff; background: var(--m-acento); padding: 7px 14px; border-bottom: 2px solid var(--m-espina); }
.inv-row { display: flex; align-items: stretch; min-height: 38px; }
.inv-name { flex: 0 0 auto; display: flex; align-items: center; white-space: nowrap; padding: 1px 12px; font-family: 'Lexend', sans-serif; font-size: 20px; font-weight: 500; color: var(--text-primary); }
.inv-ud-inline { margin-left: 8px; color: var(--m-acento); font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 13px; }
.inv-write { flex: 1 1 auto; align-self: flex-end; border-bottom: 1.5px solid var(--sl-border); margin: 0 12px 8px 6px; }
@media (max-width: 820px) { .inv-cats { column-count: 1; } .inv-cat { border-right: none; } .inv-name { font-size: 17px; } }
      `}</style>

      {msg && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: '#B01D2320', color: '#B01D23', fontFamily: FONT.body, fontSize: 13 }}>{msg}</div>
      )}

      {!inventario ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ fontFamily: FONT.body, color: T.sec, marginBottom: 14 }}>Sin conteo abierto. Genera la hoja de hoy para imprimirla, rellenarla a mano y subir la foto.</p>
          <button style={btnPrimary} disabled={busy === 'generar'} onClick={generarHoja}>{busy === 'generar' ? 'Generando…' : 'Generar hoja de hoy'}</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec }}>
              Conteo del {fmtDate(inventario.fecha)} (borrador, ref. {inventario.id.slice(0, 8).toUpperCase()})
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={btnGhost} onClick={() => imprimir(false)}><Printer size={15} /> Imprimir hoja</button>
              <button style={btnGhost} onClick={() => descargar(false)}><FileDown size={15} /> Descargar PDF</button>
              <label style={{ ...btnPrimary, display: 'inline-flex' }}>
                {busy === 'foto' ? 'Leyendo foto…' : 'Subir foto del conteo'}
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} disabled={busy === 'foto'}
                  onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.currentTarget.value = '' }} />
              </label>
              {!!invLineas.length && (
                <button style={{ ...btnPrimary, background: '#0FB86B' }} disabled={busy === 'confirmar'} onClick={confirmar}>
                  {busy === 'confirmar' ? 'Confirmando…' : `Confirmar inventario (${invLineas.length - sinVincular} líneas · ${fmtEur(valorTotal)})`}
                </button>
              )}
            </div>
          </div>

          {!invLineas.length ? (
            <div style={M.marcoCSSVars('cocina') as React.CSSProperties}>
              <HojaDoc area="cocina" docNombre="Hoja de Inventario" tituloCentrado="Conteo de cocina" meta={`FECHA ${fmtDate(inventario.fecha)} · REF ${inventario.id.slice(0, 8).toUpperCase()}`}>
                <div className="inv-cats">
                  {cats.map(cat => (
                    <div className="inv-cat" key={cat.nombre}>
                      <div className="inv-cat-head">{cat.nombre}</div>
                      {cat.items.map(it => (
                        <div className="inv-row" key={it.id}>
                          <span className="inv-name">{it.nombre}{it.ud_std && <span className="inv-ud-inline"> ({it.ud_std})</span>}</span>
                          <span className="inv-write" />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </HojaDoc>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `0.5px solid ${T.brd}`, background: T.group }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: T.mut, fontFamily: FONT.heading, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px' }}>Leído</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: T.mut, fontFamily: FONT.heading, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px' }}>Ingrediente</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', color: T.mut, fontFamily: FONT.heading, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px' }}>Cantidad</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: T.mut, fontFamily: FONT.heading, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px' }}>Ud.</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', color: T.mut, fontFamily: FONT.heading, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px' }}>Valor</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', color: T.mut, fontFamily: FONT.heading, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px' }}>Confianza</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {invLineas.map(l => {
                    const ing = l.ingrediente_id ? ingPorId.get(l.ingrediente_id) : undefined
                    const valor = l.cantidad * precioVigente(ing)
                    const conf = l.ingrediente_id ? (l.confianza ?? 0) : 0
                    const col = conf >= 1 ? '#0FB86B' : conf > 0 ? '#FFC400' : '#FF1E27'
                    return (
                      <tr key={l.id} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: T.mut }}>{l.texto_leido ?? ''}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: T.pri }}>{l.ingredientes?.nombre ?? 'SIN VINCULAR'}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: T.pri }}>{fmtNum(l.cantidad)}</td>
                        <td style={{ padding: '10px 14px', color: T.sec }}>{l.unidad ?? ''}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: T.pri }}>{ing ? fmtEur(valor) : '—'}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 6, background: col }} />
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <button onClick={() => borrarLinea(l.id)} style={{ background: 'transparent', border: 'none', color: T.mut, fontSize: 11, cursor: 'pointer', fontFamily: FONT.heading, textTransform: 'uppercase', fontWeight: 600 }}>Quitar</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
