import { BLANCO, GRANATE, GRIS, INK, NAR, OSC, ROJO, VERDE } from '@/styles/neobrutal'
// ModalDetalleFactura v3 — D01 D03 D04 D05 D07 + COMPLETAR DATOS
// v3: además de categoría + movimiento bancario, ahora se pueden completar a mano
//     los datos básicos que el OCR no haya dejado perfectos: proveedor, fecha,
//     importe, NIF emisor y titular. Así CUALQUIER factura a medias se resuelve
//     entera desde esta misma pantalla (objetivo 100%). La búsqueda de movimiento
//     bancario reacciona al importe/fecha que escribas.
import { useState, useEffect, useMemo, useCallback } from 'react'
import { fmtEur } from '@/utils/format'
import { supabase } from '@/lib/supabase'

const TOLERANCIA = 0.05

// D01: sincronizado con matching.ts
const VENTANAS: Record<string, { antes: number; despues: number }> = {
  lidl: { antes: 30, despues: 110 },
  alcampo: { antes: 30, despues: 45 },
  waitry: { antes: 5, despues: 60 },
  tesys: { antes: 5, despues: 60 },
  piensasolutions: { antes: 5, despues: 60 },
  envases: { antes: 5, despues: 45 },
  envapro: { antes: 5, despues: 45 },
  ayora: { antes: 5, despues: 30 },
  amazon: { antes: 10, despues: 45 },
  tgt: { antes: 5, despues: 120 },
  lacteos: { antes: 5, despues: 120 },
}
const VENTANA_DEFAULT = { antes: 5, despues: 30 }

function ventanaProveedor(nombre: string): { antes: number; despues: number } {
  const n = (nombre || '').toLowerCase()
  for (const [clave, v] of Object.entries(VENTANAS)) {
    if (n.includes(clave)) return v
  }
  return VENTANA_DEFAULT
}

interface CatPyg { id: string; nombre: string; nivel: number; parent_id: string | null }
interface Titular { id: string; nombre: string }
interface MovBanco {
  id: string
  fecha: string
  concepto: string | null
  importe: number
  proveedor: string | null
  titular_id: string | null
  categoria: string | null
}

interface FacturaEdit {
  id: string
  fecha_factura: string
  proveedor_nombre: string
  total: number
  categoria_factura: string | null
  nif_emisor: string | null
  titular_id: string | null
  pdf_drive_url: string | null
  pdf_drive_id: string | null
  numero_factura: string | null
  mensaje_matching: string | null
  estado?: string | null
  facturas_gastos?: { id: string; conciliacion_id: string; confirmado: boolean }[]
}

interface Props {
  factura: FacturaEdit
  categoriasPyg: CatPyg[]
  titulares?: Titular[]
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

// Estilo común de inputs/selects de este modal (tema claro).
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8, border: '0.5px solid #d0c8bc',
  background: BLANCO, fontFamily: 'Lexend, sans-serif', fontSize: 13, color: INK,
  boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px',
  textTransform: 'uppercase', color: GRIS, marginBottom: 6,
}

export default function ModalDetalleFactura({ factura, categoriasPyg, titulares = [], onClose, onSaved, onDeleted }: Props) {
  // Datos editables (completar lo que el OCR no leyó). Arrancan con lo que haya.
  const [proveedor, setProveedor] = useState(factura.proveedor_nombre || '')
  const [fecha, setFecha] = useState(factura.fecha_factura || '')
  const [totalStr, setTotalStr] = useState(factura.total ? String(factura.total) : '')
  const [nifEmisor, setNifEmisor] = useState(factura.nif_emisor || '')
  const [titularId, setTitularId] = useState(factura.titular_id || '')

  const [categoria, setCategoria] = useState(factura.categoria_factura || '')
  const [movimientoId, setMovimientoId] = useState(factura.facturas_gastos?.find(fg => fg.confirmado)?.conciliacion_id || '')
  const [movsCandidatos, setMovsCandidatos] = useState<MovBanco[]>([])
  const [cargandoMovs, setCargandoMovs] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ampliarVentana, setAmpliarVentana] = useState(false)
  // D05: override categoría
  const [overrideCategoria, setOverrideCategoria] = useState(false)

  // Importe numérico a partir de lo escrito (admite coma decimal española).
  const totalNum = useMemo(() => {
    const v = (totalStr || '').replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
    const n = parseFloat(v)
    return isNaN(n) ? 0 : n
  }, [totalStr])

  const ventana = useMemo(() => {
    const base = ventanaProveedor(proveedor)
    if (ampliarVentana) return { antes: base.antes + 30, despues: base.despues + 60 }
    return base
  }, [proveedor, ampliarVentana])

  const buscarCandidatos = useCallback(async () => {
    if (!fecha || !totalNum) { setMovsCandidatos([]); return }
    setCargandoMovs(true)
    try {
      const fechaF = new Date(fecha)
      const fechaMin = new Date(fechaF.getTime() - ventana.antes * 86400000).toISOString().slice(0, 10)
      const fechaMax = new Date(fechaF.getTime() + ventana.despues * 86400000).toISOString().slice(0, 10)
      const importeAbs = Math.abs(totalNum)
      const importeMin = -(importeAbs + TOLERANCIA)
      const importeMax = -(importeAbs - TOLERANCIA)

      // D03: si no hay titular, buscar sin filtro titular
      let query = supabase.from('conciliacion')
        .select('id, fecha, concepto, importe, proveedor, titular_id, categoria')
        .gte('fecha', fechaMin).lte('fecha', fechaMax)
        .gte('importe', importeMin).lte('importe', importeMax)
        .order('fecha', { ascending: false })
        .limit(40)

      if (titularId) {
        query = query.eq('titular_id', titularId)
      }

      const { data } = await query

      const asociado = factura.facturas_gastos?.find(fg => fg.confirmado)?.conciliacion_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let movs: MovBanco[] = (data || []).map((d: any) => ({
        id: d.id, fecha: d.fecha, concepto: d.concepto, importe: Number(d.importe),
        proveedor: d.proveedor, titular_id: d.titular_id, categoria: d.categoria,
      }))
      if (asociado && !movs.some(m => m.id === asociado)) {
        const { data: extra } = await supabase.from('conciliacion')
          .select('id, fecha, concepto, importe, proveedor, titular_id, categoria')
          .eq('id', asociado).maybeSingle()
        if (extra) {
          movs = [{
            id: extra.id, fecha: extra.fecha, concepto: extra.concepto, importe: Number(extra.importe),
            proveedor: extra.proveedor, titular_id: extra.titular_id, categoria: extra.categoria,
          }, ...movs]
        }
      }
      setMovsCandidatos(movs)
    } finally {
      setCargandoMovs(false)
    }
  }, [titularId, fecha, totalNum, factura.facturas_gastos, ventana])

  useEffect(() => { buscarCandidatos() }, [buscarCandidatos])

  useEffect(() => {
    if (!movimientoId) return
    if (overrideCategoria) return // D05: no pisar si usuario hizo override
    const m = movsCandidatos.find(x => x.id === movimientoId)
    if (m?.categoria) setCategoria(m.categoria)
  }, [movimientoId, movsCandidatos, overrideCategoria])

  const catNivel3 = useMemo(() => categoriasPyg.filter(c => c.nivel === 3), [categoriasPyg])

  // ¿Qué falta para que esta factura quede "completa"? Guía visual hacia el 100%.
  const faltan = useMemo(() => {
    const f: string[] = []
    if (!proveedor.trim()) f.push('proveedor')
    if (!fecha) f.push('fecha')
    if (!totalNum) f.push('importe')
    if (!titularId) f.push('titular')
    if (!categoria) f.push('categoría')
    return f
  }, [proveedor, fecha, totalNum, titularId, categoria])

  const handleGuardar = async () => {
    setGuardando(true); setError(null)
    try {
      const movActual = factura.facturas_gastos?.find(fg => fg.confirmado)
      const movSeleccionado = movsCandidatos.find(m => m.id === movimientoId) || null
      const categoriaFinal = overrideCategoria ? categoria : (movSeleccionado?.categoria || categoria || null)

      // Datos básicos editados (completar lo que faltaba)
      const updateFactura: Record<string, unknown> = {
        proveedor_nombre: proveedor.trim() || factura.proveedor_nombre,
        fecha_factura: fecha || factura.fecha_factura,
        total: totalNum,
        nif_emisor: nifEmisor.trim() ? nifEmisor.trim().toUpperCase() : null,
        titular_id: titularId || null,
        categoria_factura: categoriaFinal,
        ...(categoriaFinal ? { categoria_factura_origen: 'manual' } : {}),
      }
      if (movSeleccionado) updateFactura.estado = 'asociada'
      else if (movActual) updateFactura.estado = 'sin_match'
      // Si la factura venía marcada como "a medias" y ya tiene importe y titular,
      // sale de la cola de pendientes de completar (estado neutro 'leida').
      const estadosPendientesDato = ['pendiente_lectura_manual', 'pendiente_titular_manual', 'drive_pendiente', 'error']
      if (!movSeleccionado && !movActual && factura.estado && estadosPendientesDato.includes(factura.estado) && totalNum > 0 && titularId) {
        updateFactura.estado = 'leida'
      }

      const { error: errF } = await supabase.from('facturas').update(updateFactura).eq('id', factura.id)
      if (errF) throw new Error(`Factura: ${errF.message}`)

      if (movimientoId && movimientoId !== movActual?.conciliacion_id) {
        if (movActual) {
          await supabase.from('facturas_gastos').delete().eq('factura_id', factura.id)
          await supabase.from('conciliacion').update({ doc_estado: 'falta', factura_id: null }).eq('id', movActual.conciliacion_id)
        }
        await supabase.from('facturas_gastos').insert({
          factura_id: factura.id, conciliacion_id: movimientoId,
          importe_asociado: Math.abs(totalNum), confirmado: true, confirmado_manual: true, confianza_match: 100,
        })
        await supabase.from('conciliacion').update({
          doc_estado: 'tiene', factura_id: factura.id,
          ...(categoriaFinal ? { categoria: categoriaFinal } : {}),
        }).eq('id', movimientoId)
      } else if (!movimientoId && movActual) {
        await supabase.from('facturas_gastos').delete().eq('factura_id', factura.id)
        await supabase.from('conciliacion').update({ doc_estado: 'falta', factura_id: null }).eq('id', movActual.conciliacion_id)
      } else if (movimientoId && categoriaFinal) {
        await supabase.from('conciliacion').update({ categoria: categoriaFinal }).eq('id', movimientoId)
      }

      // Aprender la categoría (regla por NIF, futuras facturas). La propagación a facturas
      // pasadas del mismo NIF ya la hace el trigger de BBDD fn_backfill_categoria_manual_nif
      // (solo a las que siguen sin categoría, nunca sobrescribe una puesta a mano).
      if (categoriaFinal && nifEmisor.trim()) {
        try {
          const nifN = nifEmisor.trim().toUpperCase()
          const { data: reglasPrev } = await supabase.from('reglas_conciliacion').select('id').eq('patron_nif', nifN).limit(1)
          const reglaPrev = reglasPrev && reglasPrev.length > 0 ? reglasPrev[0] : null
          if (reglaPrev?.id) {
            await supabase.from('reglas_conciliacion').update({ categoria_codigo: categoriaFinal }).eq('id', reglaPrev.id)
          } else {
            // patron y tipo_categoria son NOT NULL: sin ellos el insert falla.
            await supabase.from('reglas_conciliacion').insert({ patron: proveedor.trim() || nifN, tipo_categoria: 'gasto', patron_nif: nifN, razon_social: proveedor.trim() || null, categoria_codigo: categoriaFinal, activa: true, prioridad: 50 })
          }
        } catch { /* best-effort: no romper el guardado por la regla */ }
      }

      onSaved()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setGuardando(false)
    }
  }

  const handleBorrar = async () => {
    setBorrando(true); setError(null)
    try {
      const movActual = factura.facturas_gastos?.find(fg => fg.confirmado)
      if (movActual) {
        await supabase.from('facturas_gastos').delete().eq('factura_id', factura.id)
        await supabase.from('conciliacion').update({ doc_estado: 'falta', factura_id: null }).eq('id', movActual.conciliacion_id)
      } else {
        await supabase.from('facturas_gastos').delete().eq('factura_id', factura.id)
      }
      if (factura.pdf_drive_id) {
        try { await supabase.functions.invoke('drive-borrar-archivo', { body: { drive_file_id: factura.pdf_drive_id } }) } catch {/* swallow */}
      }
      const { error: errDel } = await supabase.from('facturas').delete().eq('id', factura.id)
      if (errDel) throw new Error(errDel.message)
      onDeleted()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || String(err)); setBorrando(false)
    }
  }

  const tienePdf = !!factura.pdf_drive_url
  const movActualId = factura.facturas_gastos?.find(fg => fg.confirmado)?.conciliacion_id || null
  const movSeleccionado = movsCandidatos.find(m => m.id === movimientoId) || null
  const categoriaPropuesta = movSeleccionado?.categoria || null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
      <div style={{ background: BLANCO, borderRadius: 14, width: 'min(640px, 100%)', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #d0c8bc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: GRIS, marginBottom: 4 }}>Completar factura</div>
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 16, fontWeight: 500, color: INK }}>{proveedor || '—'}</div>
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRIS, marginTop: 2 }}>
              {totalNum ? fmtEur(totalNum) : 'sin importe leído'} {factura.numero_factura ? `· Nº ${factura.numero_factura}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: GRIS, cursor: 'pointer', padding: 0, width: 28, height: 28 }}>×</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Aviso de qué falta por completar */}
          {faltan.length > 0 ? (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#FFF7ED', border: `0.5px solid ${NAR}`, fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#9a4a12' }}>
              Faltan por completar: <strong>{faltan.join(', ')}</strong>
            </div>
          ) : (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#1D9E7510', border: '0.5px solid #1D9E7540', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#0F6E56' }}>
              ✓ Factura completa
            </div>
          )}

          {tienePdf && (
            <div>
              <div style={labelStyle}>Documento</div>
              <a href={factura.pdf_drive_url!} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, background: '#1D9E7515', color: '#0F6E56', textDecoration: 'none', fontFamily: 'Lexend, sans-serif', fontSize: 13, fontWeight: 500 }}>
                📎 Abrir en Drive
              </a>
            </div>
          )}

          {/* Datos básicos editables */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Proveedor</label>
              <input type="text" value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Nombre del proveedor" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Fecha</label>
              <input type="date" value={fecha ? fecha.slice(0, 10) : ''} onChange={e => setFecha(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Importe (€)</label>
              <input type="text" inputMode="decimal" value={totalStr} onChange={e => setTotalStr(e.target.value)} placeholder="0,00" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>NIF emisor</label>
              <input type="text" value={nifEmisor} onChange={e => setNifEmisor(e.target.value)} placeholder="B12345678" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Titular</label>
              <select value={titularId} onChange={e => setTitularId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">— Sin titular —</option>
                {titulares.map(t => (<option key={t.id} value={t.id}>{t.nombre}</option>))}
              </select>
            </div>
          </div>

          {/* D07: mostrar mensaje_matching */}
          {factura.mensaje_matching && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#f5f3ef', border: '0.5px solid #d0c8bc', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: GRIS, lineHeight: 1.4 }}>
              {factura.mensaje_matching}
            </div>
          )}

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>Movimiento bancario</label>
              {/* D04: botón ampliar siempre visible */}
              {!cargandoMovs && !ampliarVentana && (
                <button onClick={() => setAmpliarVentana(true)} style={{ background: 'transparent', border: 'none', color: ROJO, fontFamily: 'Lexend, sans-serif', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>
                  Ampliar búsqueda
                </button>
              )}
            </div>
            {!fecha || !totalNum ? (
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRIS }}>Completa importe y fecha para buscar el movimiento del banco.</div>
            ) : cargandoMovs ? (
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRIS }}>Buscando candidatos…</div>
            ) : movsCandidatos.length === 0 ? (
              <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff5f5', border: '0.5px solid #E24B4A40', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRANATE }}>
                No hay movimientos {titularId ? 'del mismo titular ' : ''}con importe {fmtEur(-Math.abs(totalNum))} ±{TOLERANCIA}€ en ventana ({ventana.antes}d antes / {ventana.despues}d después).
              </div>
            ) : (
              <select value={movimientoId} onChange={e => setMovimientoId(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">— Sin asociar —</option>
                {movsCandidatos.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.fecha} · {(m.concepto || '').slice(0, 40)} · {fmtEur(m.importe)}{m.categoria ? ` · ${m.categoria}` : ''}
                  </option>
                ))}
              </select>
            )}
            {movActualId && movimientoId !== movActualId && (
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: NAR, marginTop: 6, fontStyle: 'italic' }}>
                Vas a cambiar el movimiento asociado
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, marginBottom: 6 }}>
              Categoría {categoriaPropuesta && !overrideCategoria ? <span style={{ color: VERDE, fontStyle: 'italic', textTransform: 'none' }}>(copiada del banco)</span> : null}
              {overrideCategoria ? <span style={{ color: NAR, fontStyle: 'italic', textTransform: 'none' }}>(manual — se sobreescribe la del banco)</span> : null}
            </label>
            {/* D05: categoría editable con override */}
            <select value={categoria} onChange={e => { setCategoria(e.target.value); if (categoriaPropuesta) setOverrideCategoria(true) }}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">— Sin categoría —</option>
              {catNivel3.map(c => (<option key={c.id} value={c.id}>{c.id} · {c.nombre}</option>))}
            </select>
            {categoriaPropuesta && !overrideCategoria && (
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: GRIS, marginTop: 6, fontStyle: 'italic' }}>
                La categoría se hereda del movimiento bancario. Puedes cambiarla seleccionando otra.
              </div>
            )}
            {nifEmisor.trim() && categoria && (
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: GRIS, marginTop: 6, fontStyle: 'italic' }}>
                Se recordará esta categoría para las próximas facturas del NIF {nifEmisor.trim().toUpperCase()}.
              </div>
            )}
          </div>

          {error && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff5f5', border: '0.5px solid #E24B4A', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRANATE }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '0.5px solid #d0c8bc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: '#fafaf7' }}>
          {!confirmarBorrar ? (
            <button onClick={() => setConfirmarBorrar(true)} disabled={guardando || borrando}
              style={{ padding: '8px 14px', borderRadius: 8, border: '0.5px solid #E24B4A', background: BLANCO, color: ROJO, fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 500 }}>
              Borrar factura
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRANATE, fontWeight: 500 }}>¿Seguro?</span>
              <button onClick={() => setConfirmarBorrar(false)} disabled={borrando}
                style={{ padding: '8px 12px', borderRadius: 8, border: '0.5px solid #d0c8bc', background: BLANCO, color: OSC, fontFamily: 'Lexend, sans-serif', fontSize: 12, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleBorrar} disabled={borrando}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: ROJO, color: BLANCO, fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 500, opacity: borrando ? 0.6 : 1 }}>
                {borrando ? 'Borrando…' : 'Sí, borrar'}
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} disabled={guardando || borrando}
              style={{ padding: '8px 14px', borderRadius: 8, border: '0.5px solid #d0c8bc', background: BLANCO, color: OSC, fontFamily: 'Lexend, sans-serif', fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={handleGuardar} disabled={guardando || borrando}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: GRANATE, color: BLANCO, fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600, opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
