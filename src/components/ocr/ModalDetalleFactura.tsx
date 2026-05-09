import { useState, useEffect, useMemo, useCallback } from 'react'
import { fmtEur, fmtDate } from '@/utils/format'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toastStore'

/**
 * MODAL UNIFICADO Factura ↔ Movimiento bancario.
 *
 * Ley maestra (definida 09/05/26 por Rubén):
 * Factura y movimiento bancario son LA MISMA REALIDAD vista desde 2 sitios.
 * Campos idénticos en ambos lados: titular, importe (±0.05€),
 * fecha (con ventanas conocidas), categoría (copiada del banco), contraparte, NIF.
 *
 * Al asociar factura↔movimiento:
 *  - La categoría del movimiento bancario se copia a la factura (categoria_factura).
 *  - El proveedor canónico de la factura se copia al movimiento (campo proveedor).
 *  - El NIF emisor de la factura se guarda como referencia en el movimiento.
 *  - El movimiento pasa a doc_estado='tiene' si los importes cuadran (±0.05€).
 *  - La factura pasa a estado='asociada'.
 *
 * Al desasociar:
 *  - Se borra la fila facturas_gastos.
 *  - El movimiento pasa a doc_estado='falta'.
 *  - La factura pierde el match (estado vuelve a sin_match o pendiente_revision).
 *  - La categoría se mantiene (puede haberla puesto Rubén manualmente).
 */

const TOLERANCIA = 0.05

// Ventana temporal por proveedor (días antes / después de la fecha factura)
const VENTANAS: Record<string, { antes: number; despues: number }> = {
  lidl: { antes: 5, despues: 105 }, // Lidl emite con retraso
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
interface MovBanco {
  id: string
  fecha: string
  concepto: string | null
  importe: number
  proveedor: string | null
  titular_id: string | null
  categoria_codigo: string | null
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
  facturas_gastos?: { id: string; conciliacion_id: string; confirmado: boolean }[]
}

interface Props {
  factura: FacturaEdit
  categoriasPyg: CatPyg[]
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

export default function ModalDetalleFactura({ factura, categoriasPyg, onClose, onSaved, onDeleted }: Props) {
  const [categoria, setCategoria] = useState(factura.categoria_factura || '')
  const [movimientoId, setMovimientoId] = useState(factura.facturas_gastos?.find(fg => fg.confirmado)?.conciliacion_id || '')
  const [movsCandidatos, setMovsCandidatos] = useState<MovBanco[]>([])
  const [cargandoMovs, setCargandoMovs] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ampliarVentana, setAmpliarVentana] = useState(false)

  const ventana = useMemo(() => {
    const base = ventanaProveedor(factura.proveedor_nombre)
    if (ampliarVentana) {
      return { antes: base.antes + 30, despues: base.despues + 60 }
    }
    return base
  }, [factura.proveedor_nombre, ampliarVentana])

  // Buscar candidatos: mismo titular + importe ±0.05€ + ventana fecha
  const buscarCandidatos = useCallback(async () => {
    if (!factura.titular_id || !factura.fecha_factura || !factura.total) return
    setCargandoMovs(true)
    try {
      const fechaF = new Date(factura.fecha_factura)
      const fechaMin = new Date(fechaF.getTime() - ventana.antes * 86400000).toISOString().slice(0, 10)
      const fechaMax = new Date(fechaF.getTime() + ventana.despues * 86400000).toISOString().slice(0, 10)
      const importeAbs = Math.abs(Number(factura.total))
      const importeMin = -(importeAbs + TOLERANCIA)
      const importeMax = -(importeAbs - TOLERANCIA)

      const { data } = await supabase.from('conciliacion')
        .select('id, fecha, concepto, importe, proveedor, titular_id, categoria_codigo')
        .eq('titular_id', factura.titular_id)
        .gte('fecha', fechaMin).lte('fecha', fechaMax)
        .gte('importe', importeMin).lte('importe', importeMax)
        .order('fecha', { ascending: false })
        .limit(40)

      // Si está asociada, asegurarnos de que el mov asociado esté en la lista aunque caiga fuera de la ventana
      const asociado = factura.facturas_gastos?.find(fg => fg.confirmado)?.conciliacion_id
      let movs: MovBanco[] = (data || []).map((d: any) => ({
        id: d.id,
        fecha: d.fecha,
        concepto: d.concepto,
        importe: Number(d.importe),
        proveedor: d.proveedor,
        titular_id: d.titular_id,
        categoria_codigo: d.categoria_codigo,
      }))
      if (asociado && !movs.some(m => m.id === asociado)) {
        const { data: extra } = await supabase.from('conciliacion')
          .select('id, fecha, concepto, importe, proveedor, titular_id, categoria_codigo')
          .eq('id', asociado)
          .maybeSingle()
        if (extra) {
          movs = [{
            id: extra.id,
            fecha: extra.fecha,
            concepto: extra.concepto,
            importe: Number(extra.importe),
            proveedor: extra.proveedor,
            titular_id: extra.titular_id,
            categoria_codigo: extra.categoria_codigo,
          }, ...movs]
        }
      }
      setMovsCandidatos(movs)
    } finally {
      setCargandoMovs(false)
    }
  }, [factura.id, factura.titular_id, factura.fecha_factura, factura.total, factura.facturas_gastos, ventana])

  useEffect(() => { buscarCandidatos() }, [buscarCandidatos])

  // Cuando cambia el movimiento seleccionado, proponer su categoría como categoría de la factura
  useEffect(() => {
    if (!movimientoId) return
    const m = movsCandidatos.find(x => x.id === movimientoId)
    if (m?.categoria_codigo) {
      setCategoria(m.categoria_codigo)
    }
  }, [movimientoId, movsCandidatos])

  const catNivel3 = useMemo(() => categoriasPyg.filter(c => c.nivel === 3), [categoriasPyg])

  const handleGuardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      const movActual = factura.facturas_gastos?.find(fg => fg.confirmado)
      const movSeleccionado = movsCandidatos.find(m => m.id === movimientoId) || null

      // Categoría definitiva: si hay mov asociado, su categoria_codigo manda. Si no, la del select.
      const categoriaFinal = movSeleccionado?.categoria_codigo || categoria || null

      // 1. Actualizar factura (categoría + nif + estado)
      const updateFactura: Record<string, unknown> = {
        categoria_factura: categoriaFinal,
      }
      if (movSeleccionado) {
        updateFactura.estado = 'asociada'
      } else if (movActual) {
        // Se quita asociación
        updateFactura.estado = 'sin_match'
      }
      const { error: errF } = await supabase.from('facturas').update(updateFactura).eq('id', factura.id)
      if (errF) throw new Error(`Factura: ${errF.message}`)

      // 2. Sincronizar facturas_gastos
      if (movimientoId && movimientoId !== movActual?.conciliacion_id) {
        // Quitar la anterior si la había
        if (movActual) {
          await supabase.from('facturas_gastos').delete().eq('factura_id', factura.id)
          await supabase.from('conciliacion').update({
            doc_estado: 'falta',
            factura_id: null,
          }).eq('id', movActual.conciliacion_id)
        }
        // Crear nueva
        await supabase.from('facturas_gastos').insert({
          factura_id: factura.id,
          conciliacion_id: movimientoId,
          importe_asociado: Math.abs(factura.total),
          confirmado: true,
          confianza_match: 100,
        })
        // Actualizar mov bancario: doc_estado + sincroniza proveedor con la factura
        await supabase.from('conciliacion').update({
          doc_estado: 'tiene',
          factura_id: factura.id,
          proveedor: factura.proveedor_nombre,
          ...(categoriaFinal ? { categoria: categoriaFinal, categoria_codigo: categoriaFinal } : {}),
        }).eq('id', movimientoId)
      } else if (!movimientoId && movActual) {
        // Quitar asociación
        await supabase.from('facturas_gastos').delete().eq('factura_id', factura.id)
        await supabase.from('conciliacion').update({
          doc_estado: 'falta',
          factura_id: null,
        }).eq('id', movActual.conciliacion_id)
      } else if (movimientoId && categoriaFinal) {
        // Mismo mov asociado, solo refrescar categoría
        await supabase.from('conciliacion').update({
          categoria: categoriaFinal,
          categoria_codigo: categoriaFinal,
        }).eq('id', movimientoId)
      }

      toast.success('Guardado')
      onSaved()
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setGuardando(false)
    }
  }

  const handleBorrar = async () => {
    setBorrando(true)
    setError(null)
    try {
      const movActual = factura.facturas_gastos?.find(fg => fg.confirmado)
      if (movActual) {
        await supabase.from('facturas_gastos').delete().eq('factura_id', factura.id)
        await supabase.from('conciliacion').update({
          doc_estado: 'falta',
          factura_id: null,
        }).eq('id', movActual.conciliacion_id)
      } else {
        await supabase.from('facturas_gastos').delete().eq('factura_id', factura.id)
      }

      if (factura.pdf_drive_id) {
        try {
          await supabase.functions.invoke('drive-borrar-archivo', { body: { drive_file_id: factura.pdf_drive_id } })
        } catch {/* swallow */}
      }

      const { error: errDel } = await supabase.from('facturas').delete().eq('id', factura.id)
      if (errDel) throw new Error(errDel.message)

      toast.success('Factura borrada')
      onDeleted()
    } catch (err: any) {
      setError(err.message || String(err))
      setBorrando(false)
    }
  }

  const tienePdf = !!factura.pdf_drive_url
  const movActualId = factura.facturas_gastos?.find(fg => fg.confirmado)?.conciliacion_id || null
  const movSeleccionado = movsCandidatos.find(m => m.id === movimientoId) || null
  const categoriaPropuesta = movSeleccionado?.categoria_codigo || null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 'min(640px, 100%)', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.18)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #d0c8bc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: '#7a8090', marginBottom: 4 }}>Factura</div>
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 16, fontWeight: 500, color: '#111' }}>{factura.proveedor_nombre || '—'}</div>
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090', marginTop: 2 }}>
              {fmtDate(factura.fecha_factura)} · {fmtEur(factura.total)} {factura.numero_factura ? `· Nº ${factura.numero_factura}` : ''}
              {factura.nif_emisor ? ` · NIF ${factura.nif_emisor}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#7a8090', cursor: 'pointer', padding: 0, width: 28, height: 28 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Doc */}
          {tienePdf && (
            <div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#7a8090', marginBottom: 6 }}>Documento</div>
              <a href={factura.pdf_drive_url!} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, background: '#1D9E7515', color: '#0F6E56', textDecoration: 'none', fontFamily: 'Lexend, sans-serif', fontSize: 13, fontWeight: 500 }}>
                📎 Abrir en Drive
              </a>
            </div>
          )}

          {/* Movimiento bancario asociado — primer bloque importante */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#7a8090' }}>Movimiento bancario</label>
              {!cargandoMovs && movsCandidatos.length === 0 && !ampliarVentana && (
                <button onClick={() => setAmpliarVentana(true)} style={{ background: 'transparent', border: 'none', color: '#FF4757', fontFamily: 'Lexend, sans-serif', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>
                  Ampliar búsqueda
                </button>
              )}
            </div>
            {cargandoMovs ? (
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090' }}>Buscando candidatos…</div>
            ) : movsCandidatos.length === 0 ? (
              <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff5f5', border: '0.5px solid #E24B4A40', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#B01D23' }}>
                No hay movimientos del mismo titular con importe {fmtEur(-Math.abs(factura.total))} ±{TOLERANCIA}€ en ventana ({ventana.antes}d antes / {ventana.despues}d después).
              </div>
            ) : (
              <select
                value={movimientoId}
                onChange={e => setMovimientoId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', cursor: 'pointer' }}
              >
                <option value="">— Sin asociar —</option>
                {movsCandidatos.map(m => (
                  <option key={m.id} value={m.id}>
                    {fmtDate(m.fecha)} · {(m.concepto || '').slice(0, 40)} · {fmtEur(m.importe)}
                    {m.categoria_codigo ? ` · ${m.categoria_codigo}` : ''}
                  </option>
                ))}
              </select>
            )}
            {movActualId && movimientoId !== movActualId && (
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#F26B1F', marginTop: 6, fontStyle: 'italic' }}>
                Vas a cambiar el movimiento asociado
              </div>
            )}
          </div>

          {/* Categoría — propuesta del banco si hay mov */}
          <div>
            <label style={{ display: 'block', fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#7a8090', marginBottom: 6 }}>
              Categoría {categoriaPropuesta ? <span style={{ color: '#1D9E75', fontStyle: 'italic', textTransform: 'none' }}>(copiada del banco)</span> : null}
            </label>
            <select
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
              disabled={!!categoriaPropuesta}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, border: '0.5px solid #d0c8bc',
                background: categoriaPropuesta ? '#fafaf7' : '#fff',
                fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111',
                cursor: categoriaPropuesta ? 'not-allowed' : 'pointer',
              }}
            >
              <option value="">— Sin categoría —</option>
              {catNivel3.map(c => (
                <option key={c.id} value={c.id}>{c.id} · {c.nombre}</option>
              ))}
            </select>
            {categoriaPropuesta && (
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 6, fontStyle: 'italic' }}>
                La categoría se hereda del movimiento bancario. Si quieres cambiarla, edita el movimiento en Conciliación.
              </div>
            )}
          </div>

          {error && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff5f5', border: '0.5px solid #E24B4A', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#B01D23' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '0.5px solid #d0c8bc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: '#fafaf7' }}>
          {!confirmarBorrar ? (
            <button
              onClick={() => setConfirmarBorrar(true)}
              disabled={guardando || borrando}
              style={{ padding: '8px 14px', borderRadius: 8, border: '0.5px solid #E24B4A', background: '#fff', color: '#E24B4A', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 500 }}
            >
              Borrar factura
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#B01D23', fontWeight: 500 }}>¿Seguro?</span>
              <button
                onClick={() => setConfirmarBorrar(false)}
                disabled={borrando}
                style={{ padding: '8px 12px', borderRadius: 8, border: '0.5px solid #d0c8bc', background: '#fff', color: '#3a4050', fontFamily: 'Lexend, sans-serif', fontSize: 12, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleBorrar}
                disabled={borrando}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#E24B4A', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 500, opacity: borrando ? 0.6 : 1 }}
              >
                {borrando ? 'Borrando…' : 'Sí, borrar'}
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              disabled={guardando || borrando}
              style={{ padding: '8px 14px', borderRadius: 8, border: '0.5px solid #d0c8bc', background: '#fff', color: '#3a4050', fontFamily: 'Lexend, sans-serif', fontSize: 13, cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={guardando || borrando}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#B01D23', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600, opacity: guardando ? 0.6 : 1 }}
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
