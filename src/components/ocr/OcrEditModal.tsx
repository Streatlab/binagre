import { BLANCO, BORDE_SUAVE, CREMA, GRANATE, GRIS, INK, NAR, OSC, ROJO } from '@/styles/neobrutal'
import { COBERTURA_VERDE, CANAL_UBER_DARK, OCR_ROJO_WASH_CLARO, CORREO_ERROR_BORDE, OCR_FOOTER_BG } from '@/styles/palettes'
import { useState, useEffect, useMemo } from 'react'
import { fmtEur, fmtDate } from '@/utils/format'
import { supabase } from '@/lib/supabase'

interface CatPyg { id: string; nombre: string; nivel: number; parent_id: string | null }
interface Mov { id: string; fecha: string; concepto: string; importe: number; titular_id: string }
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

export default function OcrEditModal({ factura, categoriasPyg, onClose, onSaved, onDeleted }: Props) {
  const [categoria, setCategoria] = useState(factura.categoria_factura || '')
  const [movimientoId, setMovimientoId] = useState(factura.facturas_gastos?.find(fg => fg.confirmado)?.conciliacion_id || '')
  const [movsCandidatos, setMovsCandidatos] = useState<Mov[]>([])
  const [cargandoMovs, setCargandoMovs] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!factura.titular_id || !factura.fecha_factura || !factura.total) return
    setCargandoMovs(true)
    const fechaF = new Date(factura.fecha_factura)
    const fechaMin = new Date(fechaF.getTime() - 30 * 86400000).toISOString().slice(0, 10)
    const fechaMax = new Date(fechaF.getTime() + 30 * 86400000).toISOString().slice(0, 10)
    const importeBuscar = -Math.abs(Number(factura.total))
    supabase.from('conciliacion')
      .select('id, fecha, concepto, importe, titular_id')
      .eq('titular_id', factura.titular_id)
      .gte('fecha', fechaMin).lte('fecha', fechaMax)
      .eq('importe', importeBuscar)
      .order('fecha')
      .limit(20)
      .then(({ data }) => {
        setMovsCandidatos(data || [])
        setCargandoMovs(false)
      })
  }, [factura.id, factura.titular_id, factura.fecha_factura, factura.total])

  const catNivel3 = useMemo(() => categoriasPyg.filter(c => c.nivel === 3), [categoriasPyg])

  const handleGuardar = async () => {
    setGuardando(true); setError(null)
    try {
      if (categoria !== (factura.categoria_factura || '')) {
        const { error: errF } = await supabase.from('facturas').update({ categoria_factura: categoria || null }).eq('id', factura.id)
        if (errF) throw new Error(`Factura: ${errF.message}`)

        if (factura.nif_emisor && categoria) {
          const { data: reglaExistente } = await supabase
            .from('reglas_conciliacion')
            .select('id')
            .eq('patron_nif', factura.nif_emisor)
            .eq('activa', true)
            .order('prioridad', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (reglaExistente) {
            await supabase.from('reglas_conciliacion').update({
              categoria_codigo: categoria,
              creada_por_usuario: true,
              prioridad: 100,
            }).eq('id', reglaExistente.id)
          }
        }
      }

      const movActual = factura.facturas_gastos?.find(fg => fg.confirmado)
      if (movimientoId && movimientoId !== movActual?.conciliacion_id) {
        if (movActual) {
          await supabase.from('facturas_gastos').delete().eq('factura_id', factura.id)
          await supabase.from('conciliacion').update({ doc_estado: 'falta', factura_id: null }).eq('id', movActual.conciliacion_id)
        }
        await supabase.from('facturas_gastos').insert({
          factura_id: factura.id,
          conciliacion_id: movimientoId,
          importe_asociado: factura.total,
          confirmado: true,
          confianza_match: 100,
        })
        await supabase.from('conciliacion').update({
          doc_estado: 'tiene',
          factura_id: factura.id,
          ...(categoria ? { categoria } : {}),
        }).eq('id', movimientoId)
      } else if (!movimientoId && movActual) {
        await supabase.from('facturas_gastos').delete().eq('factura_id', factura.id)
        await supabase.from('conciliacion').update({ doc_estado: 'falta', factura_id: null }).eq('id', movActual.conciliacion_id)
      } else if (movimientoId && categoria && categoria !== factura.categoria_factura) {
        await supabase.from('conciliacion').update({ categoria }).eq('id', movimientoId)
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

  const movActual = factura.facturas_gastos?.find(fg => fg.confirmado)?.conciliacion_id || null
  const tienePdf = !!factura.pdf_drive_url

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
      <div style={{ background: BLANCO, borderRadius: 0, width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ padding: '20px 24px', borderBottom: `0.5px solid ${BORDE_SUAVE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: GRIS, marginBottom: 4 }}>Editar factura (datos no editables)</div>
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 16, fontWeight: 500, color: INK }}>{factura.proveedor_nombre || '—'}</div>
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRIS, marginTop: 2 }}>
              {fmtDate(factura.fecha_factura)} · {fmtEur(factura.total)} {factura.numero_factura ? `· Nº ${factura.numero_factura}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: GRIS, cursor: 'pointer', padding: 0, width: 28, height: 28 }}>×</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {tienePdf && (
            <div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, marginBottom: 6 }}>Documento</div>
              <a href={factura.pdf_drive_url!} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 0, background: COBERTURA_VERDE + '15', color: CANAL_UBER_DARK, textDecoration: 'none', fontFamily: 'Lexend, sans-serif', fontSize: 13, fontWeight: 500 }}>
                📎 Abrir en Drive
              </a>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, marginBottom: 6 }}>Categoría</label>
            <select value={categoria} onChange={e => setCategoria(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 0, border: `0.5px solid ${BORDE_SUAVE}`, background: BLANCO, fontFamily: 'Lexend, sans-serif', fontSize: 13, color: INK, cursor: 'pointer' }}>
              <option value="">— Sin categoría —</option>
              {catNivel3.map(c => (<option key={c.id} value={c.id}>{c.id} · {c.nombre}</option>))}
            </select>
            {factura.nif_emisor && (
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: GRIS, marginTop: 6, fontStyle: 'italic' }}>
                Al guardar, se aplica la categoría a todas las facturas futuras del mismo NIF ({factura.nif_emisor})
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, marginBottom: 6 }}>Movimiento bancario</label>
            {cargandoMovs ? (
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRIS }}>Buscando candidatos…</div>
            ) : movsCandidatos.length === 0 ? (
              <div style={{ padding: '10px 12px', borderRadius: 0, background: CREMA, fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRIS }}>
                No hay movimientos del mismo titular con importe {fmtEur(-Math.abs(factura.total))} dentro de ±30 días
              </div>
            ) : (
              <select value={movimientoId} onChange={e => setMovimientoId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 0, border: `0.5px solid ${BORDE_SUAVE}`, background: BLANCO, fontFamily: 'Lexend, sans-serif', fontSize: 13, color: INK, cursor: 'pointer' }}>
                <option value="">— Sin asociar —</option>
                {movsCandidatos.map(m => (
                  <option key={m.id} value={m.id}>
                    {fmtDate(m.fecha)} · {m.concepto.slice(0, 40)} · {fmtEur(m.importe)}
                  </option>
                ))}
              </select>
            )}
            {movActual && movimientoId !== movActual && (
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: NAR, marginTop: 6, fontStyle: 'italic' }}>
                Vas a cambiar el movimiento asociado
              </div>
            )}
          </div>

          {error && (
            <div style={{ padding: '10px 12px', borderRadius: 0, background: OCR_ROJO_WASH_CLARO, border: `0.5px solid ${CORREO_ERROR_BORDE}`, fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRANATE }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: `0.5px solid ${BORDE_SUAVE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: OCR_FOOTER_BG }}>
          {!confirmarBorrar ? (
            <button onClick={() => setConfirmarBorrar(true)} disabled={guardando || borrando}
              style={{ padding: '8px 14px', borderRadius: 0, border: `0.5px solid ${CORREO_ERROR_BORDE}`, background: BLANCO, color: ROJO, fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 500 }}>
              Borrar factura
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRANATE, fontWeight: 500 }}>¿Seguro?</span>
              <button onClick={() => setConfirmarBorrar(false)} disabled={borrando}
                style={{ padding: '8px 12px', borderRadius: 0, border: `0.5px solid ${BORDE_SUAVE}`, background: BLANCO, color: OSC, fontFamily: 'Lexend, sans-serif', fontSize: 12, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleBorrar} disabled={borrando}
                style={{ padding: '8px 14px', borderRadius: 0, border: 'none', background: ROJO, color: BLANCO, fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 500, opacity: borrando ? 0.6 : 1 }}>
                {borrando ? 'Borrando…' : 'Sí, borrar'}
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} disabled={guardando || borrando}
              style={{ padding: '8px 14px', borderRadius: 0, border: `0.5px solid ${BORDE_SUAVE}`, background: BLANCO, color: OSC, fontFamily: 'Lexend, sans-serif', fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={handleGuardar} disabled={guardando || borrando}
              style={{ padding: '8px 18px', borderRadius: 0, border: 'none', background: GRANATE, color: BLANCO, fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600, opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
