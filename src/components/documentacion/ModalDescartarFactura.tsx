import { BLANCO, GRANATE, GRIS, INK, ROJO_S } from '@/styles/neobrutal'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Modal "Descartar" con aprendizaje ───────────────────────────────────────
// Usado desde AvisosBandeja (bandeja de entrada) y GestionFacturas (Gestor
// documental). Dos modos:
//   1. Descartar solo esta factura → no_conciliable=true en la fila.
//   2. Descartar siempre las de este tipo → además crea una regla en
//      reglas_no_conciliable (por nombre de archivo o por NIF) y aplica el
//      descarte con carácter retroactivo a todas las facturas que casen el
//      patrón. Cada descarte (el actual y los retroactivos) queda registrado
//      en movimientos_descartados para trazabilidad.

export interface FacturaDescartable {
  id: string
  pdf_original_name?: string | null
  nif_emisor?: string | null
  proveedor_nombre?: string | null
  fecha_factura?: string | null
  total?: number | null
  titular_id?: string | null
}

interface Props {
  factura: FacturaDescartable
  onClose: () => void
  onDescartada: (info: { soloEste: boolean; afectadas: number }) => void
}

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: INK, border: `1px solid ${GRIS}`,
  borderRadius: 8, color: BLANCO, fontFamily: 'Lexend, sans-serif', fontSize: 13, padding: '10px 12px', outline: 'none',
}

export default function ModalDescartarFactura({ factura, onClose, onDescartada }: Props) {
  const [modo, setModo] = useState<'uno' | 'siempre'>('uno')
  const [campo, setCampo] = useState<'pdf_original_name' | 'nif_emisor'>(
    factura.nif_emisor ? 'nif_emisor' : 'pdf_original_name',
  )
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patronValor = campo === 'pdf_original_name' ? factura.pdf_original_name : factura.nif_emisor
  const bloqueadoSiempre = modo === 'siempre' && !patronValor

  // Cierra los avisos abiertos ligados a facturas que se acaban de descartar,
  // para que dejen de aparecer en la bandeja de dudas por resolver.
  async function cerrarAvisos(ids: string[]) {
    if (ids.length === 0) return
    const { error: err } = await supabase
      .from('avisos_papeleo')
      .update({ estado: 'resuelto' })
      .in('factura_id', ids)
      .eq('estado', 'abierto')
    if (err) console.error('[avisos_papeleo] cierre por descarte:', err.message)
  }

  // El movimiento de banco casado con la factura (si existe) tampoco debe seguir
  // contando como "pendiente" en la cobertura de conciliación.
  async function marcarMovimientos(idsFactura: string[], motivoTexto: string) {
    if (idsFactura.length === 0) return
    const { error: err } = await supabase
      .from('conciliacion')
      .update({ no_conciliable: true, motivo_no_conciliable: motivoTexto })
      .in('factura_id', idsFactura)
    if (err) console.error('[conciliacion] marcar no_conciliable:', err.message)
  }

  async function registrarDescartes(rows: FacturaDescartable[], reglaAplicada: string | null, motivoTexto: string) {
    if (rows.length === 0) return
    const inserts = rows.map(f => ({
      fecha: f.fecha_factura ?? null,
      concepto: `Factura descartada · ${f.proveedor_nombre || f.nif_emisor || f.pdf_original_name || 'sin identificar'}`,
      importe: f.total ?? null,
      titular_id: f.titular_id ?? null,
      proveedor: f.proveedor_nombre ?? null,
      ordenante: null,
      beneficiario: null,
      regla_aplicada: reglaAplicada,
      dedup_key: `factura:${f.id}`,
      motivo: motivoTexto || 'descarte_manual',
    }))
    const { error: err } = await supabase.from('movimientos_descartados').insert(inserts)
    if (err) console.error('[movimientos_descartados] insert:', err.message)
  }

  async function confirmar() {
    if (guardando) return
    setGuardando(true)
    setError(null)
    const motivoTexto = motivo.trim() || (modo === 'siempre' ? `Descarte automático por regla (${campo})` : 'Descarte manual')

    try {
      if (modo === 'uno') {
        const { error: err } = await supabase
          .from('facturas')
          .update({ no_conciliable: true, motivo_no_conciliable: motivoTexto, estado: 'no_conciliable' })
          .eq('id', factura.id)
        if (err) throw new Error(err.message)
        await Promise.all([
          registrarDescartes([factura], null, motivoTexto),
          cerrarAvisos([factura.id]),
          marcarMovimientos([factura.id], motivoTexto),
        ])
        onDescartada({ soloEste: true, afectadas: 1 })
        return
      }

      // modo 'siempre': crea la regla + aplica retroactivo
      if (!patronValor) throw new Error('Esta factura no tiene ese dato, elige otro campo.')

      const reglaTexto = campo === 'pdf_original_name'
        ? `Nombre de archivo contiene "${patronValor}"`
        : `NIF emisor = ${patronValor}`

      const { error: errRegla } = await supabase.from('reglas_no_conciliable').insert({
        regla: reglaTexto, campo, patron: patronValor, activo: true,
      })
      if (errRegla) throw new Error(errRegla.message)

      // Facturas afectadas por el patrón (incluye la actual), que aún no estén descartadas.
      const { data: afectadas, error: errSel } = await supabase
        .from('facturas')
        .select('id, fecha_factura, total, proveedor_nombre, nif_emisor, pdf_original_name, titular_id')
        .eq(campo, patronValor)
        .neq('no_conciliable', true)
      if (errSel) throw new Error(errSel.message)

      const filas = (afectadas ?? []) as FacturaDescartable[]
      const ids = filas.map(f => f.id)
      if (ids.length > 0) {
        const { error: errUpd } = await supabase
          .from('facturas')
          .update({ no_conciliable: true, motivo_no_conciliable: motivoTexto, estado: 'no_conciliable' })
          .in('id', ids)
        if (errUpd) throw new Error(errUpd.message)
      } else {
        // La factura actual ya estaba marcada por otra vía: aun así, aplica sobre ella.
        const { error: errUpd } = await supabase
          .from('facturas')
          .update({ no_conciliable: true, motivo_no_conciliable: motivoTexto, estado: 'no_conciliable' })
          .eq('id', factura.id)
        if (errUpd) throw new Error(errUpd.message)
      }

      const idsAfectados = ids.length > 0 ? ids : [factura.id]
      await Promise.all([
        registrarDescartes(filas.length > 0 ? filas : [factura], reglaTexto, motivoTexto),
        cerrarAvisos(idsAfectados),
        marcarMovimientos(idsAfectados, motivoTexto),
      ])
      onDescartada({ soloEste: false, afectadas: Math.max(filas.length, 1) })
    } catch (e: any) {
      setError(e?.message || 'No se pudo descartar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: INK, borderRadius: 14, width: '100%', maxWidth: 460, border: `1px solid ${GRIS}`, padding: 22 }}
      >
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', color: ROJO_S, marginBottom: 4, fontWeight: 600 }}>
          Descartar factura
        </div>
        <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRIS, marginBottom: 16 }}>
          {factura.proveedor_nombre || factura.nif_emisor || factura.pdf_original_name || 'Factura'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: BLANCO }}>
            <input type="radio" checked={modo === 'uno'} onChange={() => setModo('uno')} />
            Descartar solo esta factura
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: BLANCO }}>
            <input type="radio" checked={modo === 'siempre'} onChange={() => setModo('siempre')} />
            Descartar siempre los de este tipo
          </label>

          {modo === 'siempre' && (
            <div style={{ marginLeft: 24, display: 'flex', flexDirection: 'column', gap: 8, background: INK, border: `1px solid ${GRANATE}`, borderRadius: 8, padding: '10px 12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Lexend, sans-serif', fontSize: 12.5, color: ROJO_S }}>
                <input type="radio" checked={campo === 'pdf_original_name'} onChange={() => setCampo('pdf_original_name')} disabled={!factura.pdf_original_name} />
                Por nombre de archivo{factura.pdf_original_name ? ` (${factura.pdf_original_name})` : ' (sin dato)'}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Lexend, sans-serif', fontSize: 12.5, color: ROJO_S }}>
                <input type="radio" checked={campo === 'nif_emisor'} onChange={() => setCampo('nif_emisor')} disabled={!factura.nif_emisor} />
                Por NIF del emisor{factura.nif_emisor ? ` (${factura.nif_emisor})` : ' (sin dato)'}
              </label>
              {bloqueadoSiempre && (
                <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11.5, color: ROJO_S }}>Esta factura no tiene ese dato: elige el otro campo.</div>
              )}
            </div>
          )}
        </div>

        <textarea
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          placeholder="Motivo (opcional)"
          rows={3}
          style={{ ...inp, resize: 'vertical', marginBottom: 12 }}
        />

        {error && <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: ROJO_S, marginBottom: 10 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={guardando}
            style={{ padding: '9px 16px', background: INK, border: `1px solid ${GRIS}`, borderRadius: 8, color: BLANCO, fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', cursor: guardando ? 'default' : 'pointer' }}>
            Cancelar
          </button>
          <button onClick={confirmar} disabled={guardando || bloqueadoSiempre}
            style={{ padding: '9px 16px', background: GRANATE, border: 'none', borderRadius: 8, color: BLANCO, fontFamily: 'Oswald, sans-serif', fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', cursor: (guardando || bloqueadoSiempre) ? 'not-allowed' : 'pointer', opacity: (guardando || bloqueadoSiempre) ? 0.5 : 1 }}>
            {guardando ? 'Descartando…' : 'Descartar'}
          </button>
        </div>
      </div>
    </div>
  )
}
