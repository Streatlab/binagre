import { BLANCO, GRANATE, GRIS, INK, VERDE } from '@/styles/neobrutal'
import { ERROR_BANNER_BG, ERROR_BANNER_BORDE } from '@/styles/palettes'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'
import { COLORS } from '@/components/panel/resumen/tokens'
import { HeroCantera, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'
import * as M from '@/lib/marcoDoc'
import BotonImprimir from '@/components/BotonImprimir'

/* ═══ PDF — MARCO ÚNICO (src/lib/marcoDoc.ts) — VERTICAL ═══ */
const AREA: M.Area = 'cocina'

function crearPDFLibroEquipos(equipos: Equipo[], mantenimientos: Mantenimiento[], rec: M.Recursos, bn = false) {
  if (equipos.length === 0) return null
  const doc = M.nuevaHoja({ orientation: 'portrait' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA, bn)
  const cb = M.contentBox(doc)

  const nuevaPagina = () => {
    M.pintarEspina(doc, AREA, ctx, bn)
    return M.pintarCabecera(doc, ctx, { docNombre: 'Libro de Equipos', meta: `${equipos.length} equipos`, area: AREA, bn })
  }
  let y = nuevaPagina()

  const xDesc = cb.x0 + 1.5
  const xFecha = cb.x1 - 45
  const xCoste = cb.x1 - 1

  for (const eq of equipos) {
    const mants = mantenimientos.filter(m => m.equipo_id === eq.id)
    const coste = mants.reduce((s, m) => s + (m.coste ?? 0), 0)
    if (y > cb.bottom - 20) { doc.addPage(); y = nuevaPagina() }

    doc.setFillColor(pal.acento[0], pal.acento[1], pal.acento[2])
    doc.roundedRect(cb.x0, y, cb.w, 7.5, M.R, M.R, 'F')
    M.fTitulo(doc, ctx, true); doc.setFontSize(11); doc.setTextColor(255, 255, 255)
    doc.text(eq.nombre.toUpperCase(), cb.x0 + 3, y + 5.3)
    const rango = eq.temp_min != null && eq.temp_max != null ? `${eq.temp_min}°C – ${eq.temp_max}°C` : ''
    doc.setFontSize(8.5)
    doc.text(`${eq.activo ? 'ACTIVO' : 'INACTIVO'}${rango ? ' · ' + rango : ''}`, cb.x1 - 1.5, y + 5.3, { align: 'right' })
    y += 10

    if (mants.length === 0) {
      M.fDato(doc, ctx, false); doc.setFontSize(9.5); doc.setTextColor(...M.GRIS)
      doc.text('Sin mantenimientos registrados.', xDesc, y + 3)
      y += 8
    } else {
      doc.setFillColor(pal.soft2[0], pal.soft2[1], pal.soft2[2]); doc.rect(cb.x0, y, cb.w, 5, 'F')
      M.fTitulo(doc, ctx, true); doc.setFontSize(7.5); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
      doc.text('DESCRIPCIÓN', xDesc, y + 3.4)
      doc.text('FECHA', xFecha, y + 3.4)
      doc.text('COSTE', xCoste, y + 3.4, { align: 'right' })
      y += 5

      for (const m of mants) {
        if (y > cb.bottom - 6) { doc.addPage(); y = nuevaPagina() }
        M.fDato(doc, ctx, false); doc.setFontSize(9.5); doc.setTextColor(...M.TINTA)
        doc.text(m.descripcion ?? '—', xDesc, y + 4, { maxWidth: xFecha - xDesc - 3 })
        doc.setTextColor(...M.GRIS)
        const [yy, mm, dd] = m.fecha.split('-')
        doc.text(`${dd}/${mm}/${yy}`, xFecha, y + 4)
        doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
        doc.text(fmtEurLocal(m.coste), xCoste, y + 4, { align: 'right' })
        doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.1); doc.line(cb.x0, y + 5.4, cb.x1, y + 5.4)
        y += 5.6
      }

      M.fTitulo(doc, ctx, true); doc.setFontSize(9); doc.setTextColor(...M.TINTA)
      doc.text(`Coste acumulado: ${fmtEurLocal(coste)}`, xCoste, y + 4, { align: 'right' })
      y += 8
    }
    y += 2
  }

  const totalPag = doc.getNumberOfPages()
  for (let p = 1; p <= totalPag; p++) { doc.setPage(p); M.pintarPaginado(doc, p, totalPag, ctx) }
  return doc
}

interface Equipo {
  id: string
  nombre: string
  tipo: string | null
  estado: string | null
  temp_min: number | null
  temp_max: number | null
  descripcion: string | null
  activo: boolean
  created_at: string
}

interface Mantenimiento {
  id: string
  equipo_id: string
  descripcion: string | null
  coste: number | null
  fecha: string
  created_at: string
}

const EMPTY_EQUIPO: Omit<Equipo, 'id' | 'created_at'> = {
  nombre: '', tipo: '', estado: 'activo', temp_min: null, temp_max: null, descripcion: '', activo: true,
}

function fmtFecha(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function fmtEurLocal(n: number | null): string {
  if (n === null) return '—'
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export default function LibroEquipos() {
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [mantenimientos, setMantenimientos] = useState<Mantenimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editData, setEditData] = useState<typeof EMPTY_EQUIPO & { id?: string }>(EMPTY_EQUIPO)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const { data: eqs, error: e1 } = await supabase.from('equipos').select('*').order('nombre')
      if (e1) throw e1
      const { data: mants, error: e2 } = await supabase.from('mantenimientos_equipos').select('*').order('fecha', { ascending: false })
      if (e2) throw e2
      setEquipos((eqs ?? []) as Equipo[])
      setMantenimientos((mants ?? []) as Mantenimiento[])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('42P01') ? 'Tabla equipos no encontrada.' : `Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  async function saveEquipo() {
    setSaving(true)
    const payload = {
      nombre: editData.nombre, tipo: editData.tipo || null, estado: editData.estado || null,
      temp_min: editData.temp_min, temp_max: editData.temp_max,
      descripcion: editData.descripcion || null, activo: editData.activo,
    }
    if (editData.id) {
      await supabase.from('equipos').update(payload).eq('id', editData.id)
    } else {
      await supabase.from('equipos').insert(payload)
    }
    setShowForm(false)
    setEditData(EMPTY_EQUIPO)
    await loadData()
    setSaving(false)
  }

  async function toggleActivo(eq: Equipo) {
    await supabase.from('equipos').update({ activo: !eq.activo }).eq('id', eq.id)
    await loadData()
  }

  const selectedEquipo = equipos.find(e => e.id === selectedId)
  const eqMantenimientos = mantenimientos.filter(m => m.equipo_id === selectedId)
  const costAcum = eqMantenimientos.reduce((s, m) => s + (m.coste ?? 0), 0)

  const equiposActivos = equipos.filter(e => e.activo)
  const equiposInactivos = equipos.filter(e => !e.activo)
  const costeTotal = mantenimientos.reduce((s, m) => s + (m.coste ?? 0), 0)

  const titularHero = equipos.length === 0
    ? 'Aún no hay equipos registrados.'
    : equiposInactivos.length > 0
      ? `${equiposInactivos.length} ${equiposInactivos.length === 1 ? 'equipo desactivado' : 'equipos desactivados'} de ${equipos.length}.`
      : `${equiposActivos.length} ${equiposActivos.length === 1 ? 'equipo activo' : 'equipos activos'} en cocina.`

  const atencionHero = [
    `${equiposActivos.length} activos`,
    equiposInactivos.length > 0 ? `${equiposInactivos.length} desactivados` : null,
    `${mantenimientos.length} mantenimientos`,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera>

      {/* Acción propia (queda plana, fuera del héroe) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <BotonImprimir
          compacto
          documentoId="operaciones.libro_equipos"
          titulo="Libro de equipos / mantenimiento"
          generarPdf={async opts => { const rec = await M.cargarRecursos(); return crearPDFLibroEquipos(equipos, mantenimientos, rec, opts.bn) }}
        />
        <button onClick={() => { setEditData(EMPTY_EQUIPO); setShowForm(s => !s) }}
          style={{ padding: '9px 18px', background: COLORS.glovo, color: INK, border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
          + Añadir equipo
        </button>
      </div>

      {/* 1 · Héroe del área Operaciones (naranja) */}
      <HeroCantera
        area="ops"
        titular={titularHero}
        etiquetaDato={mantenimientos.length > 0 ? 'Coste mantenimientos' : undefined}
        cifra={mantenimientos.length > 0 ? fmtEurLocal(costeTotal) : undefined}
        atencion={atencionHero}
      />

      {error && <Papel ceja={ERROR_BANNER_BORDE} style={{ background: ERROR_BANNER_BG, border: `1px solid ${ERROR_BANNER_BORDE}`, color: COLORS.redSL }}>{error}</Papel>}

      {/* 3 · Frase potente */}
      {!loading && equipos.length > 0 && (
        equiposInactivos.length > 0
          ? <FrasePotente significado="coste">Revisa los equipos desactivados: puede que necesiten mantenimiento o baja definitiva.</FrasePotente>
          : <FrasePotente significado="logro">Todos los equipos están activos y listos para producción.</FrasePotente>
      )}

      {/* Formulario alta/edición */}
      {showForm && (
        <Papel ceja={GRANATE}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {[
              { label: 'Nombre', key: 'nombre', type: 'text' },
              { label: 'Tipo', key: 'tipo', type: 'text' },
              { label: 'Estado', key: 'estado', type: 'text' },
              { label: 'Temp. mín. (°C)', key: 'temp_min', type: 'number' },
              { label: 'Temp. máx. (°C)', key: 'temp_max', type: 'number' },
              { label: 'Descripción', key: 'descripcion', type: 'text' },
            ].map(f => (
              <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160, flex: 1 }}>
                <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>{f.label}</label>
                <input type={f.type}
                  value={(editData as Record<string, unknown>)[f.key] as string ?? ''}
                  onChange={e => setEditData(p => ({ ...p, [f.key]: f.type === 'number' ? (e.target.value ? parseFloat(e.target.value) : null) : e.target.value }))}
                  style={{ padding: '8px 10px', background: BLANCO, border: `3px solid ${INK}`, color: INK, fontFamily: FONT.body, fontSize: 13 }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={saveEquipo} disabled={saving}
              style={{ padding: '9px 18px', background: COLORS.redSL, color: BLANCO, border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => { setShowForm(false); setEditData(EMPTY_EQUIPO) }}
              style={{ padding: '9px 14px', background: BLANCO, border: `3px solid ${INK}`, color: GRIS, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </Papel>
      )}

      {loading ? <div style={{ color: GRIS, fontSize: 13 }}>Cargando…</div> : (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SeccionLabel bg={GRANATE}>Equipos</SeccionLabel>
            {equipos.length === 0 ? (
              <div style={{ color: GRIS, fontSize: 13 }}>Sin equipos registrados aún.</div>
            ) : equipos.map(eq => {
              const mants = mantenimientos.filter(m => m.equipo_id === eq.id)
              const coste = mants.reduce((s, m) => s + (m.coste ?? 0), 0)
              const activo = selectedId === eq.id
              return (
                <Papel key={eq.id} ceja={eq.activo ? VERDE : GRANATE}
                  style={{ cursor: 'pointer', boxShadow: activo ? `3px 3px 0 ${INK}` : undefined, opacity: eq.activo ? 1 : 0.6 }}>
                  <div onClick={() => setSelectedId(eq.id === selectedId ? null : eq.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontFamily: FONT.heading, fontSize: 15, letterSpacing: '1px', color: INK, marginBottom: 4 }}>{eq.nombre}</div>
                      <div style={{ fontSize: 12, color: GRIS }}>
                        {eq.tipo && <span style={{ marginRight: 10 }}>{eq.tipo}</span>}
                        {eq.temp_min !== null && eq.temp_max !== null && <span>Rango: {eq.temp_min}°C – {eq.temp_max}°C</span>}
                      </div>
                    </div>
                    <span style={{ background: eq.activo ? VERDE : COLORS.redSL, color: BLANCO, border: `2px solid ${INK}`, padding: '2px 8px', fontSize: 10, fontFamily: FONT.heading, letterSpacing: '1px' }}>
                      {eq.estado ?? (eq.activo ? 'ACTIVO' : 'INACTIVO')}
                    </span>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 12, color: GRIS, flexWrap: 'wrap' }}>
                    <span>{mants.length} mantenimiento{mants.length !== 1 ? 's' : ''}</span>
                    <span>Coste acum.: {fmtEurLocal(coste)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={e => { e.stopPropagation(); setEditData({ ...eq }); setShowForm(true) }}
                      style={{ padding: '4px 10px', background: BLANCO, border: `2px solid ${INK}`, color: GRIS, fontSize: 11, cursor: 'pointer' }}>Editar</button>
                    <button onClick={e => { e.stopPropagation(); toggleActivo(eq) }}
                      style={{ padding: '4px 10px', background: BLANCO, border: `2px solid ${eq.activo ? COLORS.redSL : VERDE}`, color: eq.activo ? COLORS.redSL : VERDE, fontSize: 11, cursor: 'pointer' }}>
                      {eq.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </Papel>
              )
            })}
          </div>

          {selectedEquipo && (
            <div style={{ flex: '1 1 320px' }}>
              <SeccionLabel bg={GRANATE}>Historial — {selectedEquipo.nombre}</SeccionLabel>
              <Papel ceja={GRANATE}>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: GRIS, marginBottom: 4, fontFamily: FONT.heading, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Coste Acumulado</div>
                  <div style={{ fontFamily: FONT.heading, fontSize: 22, color: INK }}>{fmtEurLocal(costAcum)}</div>
                </div>
                {eqMantenimientos.length === 0 ? (
                  <div style={{ color: GRIS, fontSize: 13 }}>Sin mantenimientos registrados.</div>
                ) : eqMantenimientos.map(m => (
                  <div key={m.id} style={{ borderBottom: `2px solid ${INK}`, padding: '10px 0', fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ color: GRIS }}>{m.descripcion ?? '—'}</span>
                      <span style={{ color: GRIS, whiteSpace: 'nowrap' }}>{fmtFecha(m.fecha)}</span>
                    </div>
                    {m.coste !== null && <div style={{ color: COLORS.glovo, fontSize: 12, marginTop: 2 }}>{fmtEurLocal(m.coste)}</div>}
                  </div>
                ))}
              </Papel>
            </div>
          )}
        </div>
      )}
    </PantallaCantera>
  )
}
