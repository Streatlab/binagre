import { AZUL, BLANCO, BORDE_SUAVE, CLARO, CREMA, GRIS, INK, NAR, OSC, ROJO, VERDE } from '@/styles/neobrutal'
import { OCR_FOOTER_BG, CORREO_ALERTA_BORDE, CANAL_UBER_DARK, CONCILIACION_VIOLETA_CLARO } from '@/styles/palettes'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtDate } from '@/utils/format'
import { toast } from '@/lib/toastStore'
import type { Movimiento } from '@/types/conciliacion'
import { getNewId } from '@/lib/categoriaMapping'
import { cargarMatchingConfig, ventanaFechas, bandaImporte } from '@/lib/matching'

interface CatPyg { id: string; nombre: string; nivel: number; parent_id: string | null }
interface Titular { id: string; nombre: string }

interface FacturaAsociada {
  id: string
  factura_id: string
  importe_asociado: number
  confirmado: boolean
  factura_numero: string
  factura_proveedor: string
  factura_fecha: string
  factura_total: number
  factura_pdf_url: string | null
}

interface FacturaCandidata {
  id: string
  numero_factura: string
  proveedor_nombre: string
  fecha_factura: string
  total: number
  pdf_drive_url: string | null
  importe_restante: number
  diff_dias: number
}

// Datos enriquecidos del extracto bancario (punto 25). Vienen de la tabla
// conciliacion; se cargan al abrir el modal para mostrarlos sin tocar el tipo
// Movimiento ni el mapeo de la tabla.
interface DatosExtracto {
  saldo: number | null
  fecha_valor: string | null
  tipo_mov: string | null
  referencia: string | null
  no_conciliable: boolean
  motivo_no_conciliable: string | null
}

interface Props {
  movimiento: Movimiento | null
  categoriasPyg: CatPyg[]
  titulares: Titular[]
  onClose: () => void
  onSaved: (m: Movimiento) => void
}

// Etiqueta legible del tipo de movimiento del extracto.
const TIPO_MOV_LABEL: Record<string, string> = {
  tarjeta: 'Tarjeta',
  transferencia_recibida: 'Transferencia recibida',
  transferencia_emitida: 'Transferencia emitida',
  adeudo: 'Adeudo / recibo',
  traspaso: 'Traspaso entre cuentas',
  bizum: 'Bizum',
  recarga: 'Recarga',
  comision: 'Comisión bancaria',
  otro: 'Otro',
}

// Calcula diferencia en días usando fechas locales (evita desfase UTC — D-12)
function diffDias(d1: string, d2: string): number {
  const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getTime() }
  return Math.round(Math.abs(parse(d1) - parse(d2)) / 86400000)
}

export default function ModalDetalleMovimiento({ movimiento, categoriasPyg, titulares, onClose, onSaved }: Props) {
  const [selectedBloque, setSelectedBloque] = useState('')
  const [selectedSubgrupo, setSelectedSubgrupo] = useState('')
  const [selectedDetalle, setSelectedDetalle] = useState('')
  const [titularId, setTitularId] = useState('')
  const [noRequiere, setNoRequiere] = useState(false)
  const [contraparte, setContraparte] = useState('')
  const [saving, setSaving] = useState(false)

  // Punto 25 + 9/10: datos del extracto y marca "no conciliable".
  const [extracto, setExtracto] = useState<DatosExtracto | null>(null)
  const [noConciliable, setNoConciliable] = useState(false)
  const [motivoNoConc, setMotivoNoConc] = useState('')

  const [facturasAsociadas, setFacturasAsociadas] = useState<FacturaAsociada[]>([])
  const [mostrarBuscador, setMostrarBuscador] = useState(false)
  const [busquedaFactura, setBusquedaFactura] = useState('')
  const [candidatas, setCandidatas] = useState<FacturaCandidata[]>([])
  const [cargandoCandidatas, setCargandoCandidatas] = useState(false)
  const [importeAsociar, setImporteAsociar] = useState<Record<string, string>>({})

  const importeAbs = movimiento ? Math.abs(Number(movimiento.importe)) : 0
  const totalAsociado = facturasAsociadas.reduce((acc, f) => acc + Number(f.importe_asociado), 0)
  const restante = +(importeAbs - totalAsociado).toFixed(2)

  const cargarAsociadas = useCallback(async (movId: string) => {
    const { data } = await supabase
      .from('facturas_gastos')
      .select('id, factura_id, importe_asociado, confirmado, facturas(numero_factura, proveedor_nombre, fecha_factura, total, pdf_drive_url)')
      .eq('conciliacion_id', movId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: FacturaAsociada[] = (data ?? []).map((r: any) => ({
      id: r.id,
      factura_id: r.factura_id,
      importe_asociado: Number(r.importe_asociado),
      confirmado: r.confirmado,
      factura_numero: r.facturas?.numero_factura ?? '',
      factura_proveedor: r.facturas?.proveedor_nombre ?? '',
      factura_fecha: r.facturas?.fecha_factura ?? '',
      factura_total: Number(r.facturas?.total ?? 0),
      factura_pdf_url: r.facturas?.pdf_drive_url ?? null,
    }))
    setFacturasAsociadas(mapped)
  }, [])

  // Carga los datos enriquecidos del extracto (punto 25) al abrir el modal.
  const cargarExtracto = useCallback(async (movId: string) => {
    const { data } = await supabase
      .from('conciliacion')
      .select('saldo, fecha_valor, tipo_mov, referencia, no_conciliable, motivo_no_conciliable')
      .eq('id', movId)
      .maybeSingle()
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any
      setExtracto({
        saldo: d.saldo != null ? Number(d.saldo) : null,
        fecha_valor: d.fecha_valor ?? null,
        tipo_mov: d.tipo_mov ?? null,
        referencia: d.referencia ?? null,
        no_conciliable: !!d.no_conciliable,
        motivo_no_conciliable: d.motivo_no_conciliable ?? null,
      })
      setNoConciliable(!!d.no_conciliable)
      setMotivoNoConc(d.motivo_no_conciliable ?? '')
    } else {
      setExtracto(null)
      setNoConciliable(false)
      setMotivoNoConc('')
    }
  }, [])

  useEffect(() => {
    if (!movimiento) return

    const catId = getNewId(movimiento.categoria_id) ?? movimiento.categoria_id
    if (catId && categoriasPyg.length > 0) {
      const cat = categoriasPyg.find(c => c.id === catId)
      if (cat && cat.nivel === 3 && cat.parent_id) {
        const parent = categoriasPyg.find(c => c.id === cat.parent_id)
        if (parent) {
          if (parent.nivel === 2 && parent.parent_id) {
            setSelectedBloque(parent.parent_id)
            setSelectedSubgrupo(parent.id)
            setSelectedDetalle(cat.id)
          } else if (parent.nivel === 1) {
            setSelectedBloque(parent.id)
            setSelectedSubgrupo('')
            setSelectedDetalle(cat.id)
          }
        }
      }
    } else {
      setSelectedBloque('')
      setSelectedSubgrupo('')
      setSelectedDetalle('')
    }

    setTitularId(movimiento.titular_id ?? '')
    setNoRequiere(movimiento.doc_estado === 'no_requiere')
    setContraparte(movimiento.contraparte ?? '')
    cargarAsociadas(movimiento.id)
    cargarExtracto(movimiento.id)
  }, [movimiento, categoriasPyg, cargarAsociadas, cargarExtracto])

  useEffect(() => {
    if (!movimiento || !mostrarBuscador) return
    let cancelado = false
    const timer = setTimeout(async () => {
      setCargandoCandidatas(true)
      try {
        // Motor único: parámetros desde matching_config según proveedor del movimiento
        const paramsPara = await cargarMatchingConfig()
        const params = paramsPara(movimiento.contraparte ?? '')
        const { desde, hasta } = ventanaFechas(movimiento.fecha, params.ventana_dias)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q: any = supabase
          .from('facturas')
          .select('id, numero_factura, proveedor_nombre, fecha_factura, total, pdf_drive_url, titular_id')
          .gte('fecha_factura', desde)
          .lte('fecha_factura', hasta)
          .order('fecha_factura', { ascending: false })
          .limit(100) // margen mayor; se recorta a 30 tras ordenar por diff_dias (D-09)

        if (movimiento.titular_id) {
          q = q.or(`titular_id.eq.${movimiento.titular_id},titular_id.is.null`)
        }

        if (busquedaFactura.trim()) {
          const safe = busquedaFactura.trim().replace(/[%_,()]/g, ' ')
          q = q.or(`numero_factura.ilike.%${safe}%,proveedor_nombre.ilike.%${safe}%`)
        } else {
          // Banda sobre valor absoluto: cubre ingresos positivos Y abonos negativos (D-02, D-03)
          const { min, max } = bandaImporte(importeAbs, params.tolerancia_eur)
          q = q.or(`and(total.gte.${min},total.lte.${max}),and(total.gte.${-max},total.lte.${-min})`)
        }

        const { data } = await q
        if (cancelado) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const candidatasRaw: any[] = data ?? []
        const ids = candidatasRaw.map(f => f.id)
        const { data: asocs } = await supabase
          .from('facturas_gastos')
          .select('factura_id, importe_asociado')
          .in('factura_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])

        const asociadoPorFactura: Record<string, number> = {}
        for (const a of asocs ?? []) {
          asociadoPorFactura[a.factura_id] = (asociadoPorFactura[a.factura_id] ?? 0) + Number(a.importe_asociado)
        }

        const mapped: FacturaCandidata[] = candidatasRaw
          .map(f => ({
            id: f.id,
            numero_factura: f.numero_factura ?? '',
            proveedor_nombre: f.proveedor_nombre ?? '',
            fecha_factura: f.fecha_factura ?? '',
            total: Number(f.total ?? 0),
            pdf_drive_url: f.pdf_drive_url,
            importe_restante: +(Math.abs(Number(f.total ?? 0)) - (asociadoPorFactura[f.id] ?? 0)).toFixed(2),
            diff_dias: diffDias(f.fecha_factura, movimiento.fecha),
          }))
          .filter(f => !facturasAsociadas.some(a => a.factura_id === f.id))
          .filter(f => f.importe_restante > 0.005) // excluir ya consumidas (D-09)
          .sort((a, b) => a.diff_dias - b.diff_dias)
          .slice(0, 30) // las 30 más cercanas en fecha (D-09)

        setCandidatas(mapped)
      } finally {
        if (!cancelado) setCargandoCandidatas(false)
      }
    }, 300)
    return () => { cancelado = true; clearTimeout(timer) }
  }, [busquedaFactura, mostrarBuscador, movimiento, importeAbs, facturasAsociadas])

  if (!movimiento) return null

  const bloques = categoriasPyg.filter(c => c.nivel === 1)
  const subgrupos = selectedBloque
    ? categoriasPyg.filter(c => c.nivel === 2 && c.parent_id === selectedBloque)
    : []
  const detalles = selectedSubgrupo
    ? categoriasPyg.filter(c => c.nivel === 3 && c.parent_id === selectedSubgrupo)
    : selectedBloque
    ? categoriasPyg.filter(c => c.nivel === 3 && c.parent_id === selectedBloque)
    : []

  async function handleAsociar(factura: FacturaCandidata) {
    if (!movimiento) return
    const importeStr = importeAsociar[factura.id] ?? String(Math.min(restante, factura.importe_restante).toFixed(2))
    const importe = Number(importeStr.replace(',', '.'))
    if (!importe || importe <= 0) {
      toast.error('Importe inválido')
      return
    }
    if (importe > restante + 0.01) {
      toast.error(`Importe supera el restante del movimiento (${fmtEur(restante)})`)
      return
    }
    if (importe > factura.importe_restante + 0.01) {
      toast.error(`Importe supera el restante de la factura (${fmtEur(factura.importe_restante)})`)
      return
    }
    try {
      const { error } = await supabase.from('facturas_gastos').insert({
        factura_id: factura.id,
        conciliacion_id: movimiento.id,
        importe_asociado: importe,
        confirmado: true,
      })
      if (error) throw error
      toast.success('Factura asociada')
      await cargarAsociadas(movimiento.id)
      setImporteAsociar(prev => { const n = { ...prev }; delete n[factura.id]; return n })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error asociando')
    }
  }

  async function handleDesasociar(asoc: FacturaAsociada) {
    if (!movimiento) return
    if (!confirm(`Quitar asociación con factura ${asoc.factura_numero}?`)) return
    try {
      const { error } = await supabase.from('facturas_gastos').delete().eq('id', asoc.id)
      if (error) throw error
      toast.success('Asociación eliminada')
      await cargarAsociadas(movimiento.id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error desasociando')
    }
  }

  async function handleGuardar() {
    if (!movimiento) return
    setSaving(true)
    try {
      let docEstado: 'tiene' | 'falta' | 'no_requiere' = 'falta'
      if (facturasAsociadas.length > 0 && Math.abs(restante) < 0.01) docEstado = 'tiene'
      else if (noRequiere) docEstado = 'no_requiere'
      else if (movimiento.doc_estado === 'tiene' && facturasAsociadas.length > 0) docEstado = 'tiene'

      const updates: Record<string, unknown> = {
        titular_id: titularId || null,
        doc_estado: docEstado,
        // Puntos 9/10: marca "no conciliable" + motivo, definidos a mano por el usuario.
        no_conciliable: noConciliable,
        motivo_no_conciliable: noConciliable ? (motivoNoConc.trim() || 'Marcado manualmente') : null,
      }
      if (selectedDetalle) updates.categoria = selectedDetalle
      // Contraparte/proveedor NO se edita aquí: viene del banco

      const { error } = await supabase
        .from('conciliacion')
        .update(updates)
        .eq('id', movimiento.id)

      if (error) throw error

      const { data: refreshed } = await supabase
        .from('conciliacion')
        .select('*, factura_data:facturas(pdf_drive_url, pdf_filename)')
        .eq('id', movimiento.id)
        .single()

      toast.success('Guardado')

      if (refreshed) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = refreshed as any
        onSaved({
          id: r.id,
          fecha: r.fecha,
          concepto: r.concepto,
          importe: Number(r.importe),
          categoria_id: r.categoria ?? null,
          contraparte: r.proveedor ?? '',
          gasto_id: r.gasto_id ?? null,
          factura_id: r.factura_id ?? null,
          factura_data: r.factura_data ?? null,
          titular_id: r.titular_id ?? null,
          doc_estado: r.doc_estado ?? 'falta',
        })
      } else {
        onSaved({
          ...movimiento,
          categoria_id: selectedDetalle || movimiento.categoria_id,
          titular_id: (updates.titular_id as string | null),
          doc_estado: docEstado,
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar'
      toast.error(msg)
      console.error('Error guardando movimiento:', err)
    } finally {
      setSaving(false)
    }
  }

  const tipoMovLabel = extracto?.tipo_mov ? (TIPO_MOV_LABEL[extracto.tipo_mov] ?? extracto.tipo_mov) : null
  const hayDatosExtracto = !!(extracto && (extracto.saldo != null || extracto.fecha_valor || extracto.tipo_mov || extracto.referencia))

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={onClose}
    >
      <div
        style={{ background: BLANCO, border: `0.5px solid ${BORDE_SUAVE}`, borderRadius: 14, padding: '28px 32px', maxWidth: 640, width: '92%', boxShadow: '0 8px 30px rgba(0,0,0,0.06)', maxHeight: '92vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '2px', color: GRIS, textTransform: 'uppercase', marginBottom: 4 }}>
              Detalle movimiento · {fmtDate(movimiento.fecha)}
            </div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 18, fontWeight: 600, color: INK, letterSpacing: '0.5px' }}>
              {movimiento.concepto.length > 50 ? movimiento.concepto.slice(0, 50) + '…' : movimiento.concepto}
            </div>
            {movimiento.contraparte && (
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRIS, marginTop: 4 }}>{movimiento.contraparte}</div>
            )}
          </div>
          <button onClick={onClose} style={{ fontSize: 18, color: GRIS, cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: 22, fontSize: 13, padding: '14px 0', borderTop: `0.5px solid ${CLARO}`, borderBottom: `0.5px solid ${CLARO}` }}>
          <div style={{ color: GRIS, fontFamily: 'Lexend, sans-serif' }}>Importe</div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 500, letterSpacing: '0.5px', color: movimiento.importe >= 0 ? VERDE : ROJO, textAlign: 'right' }}>
            {movimiento.importe >= 0 ? '+' : ''}{fmtEur(movimiento.importe)}
          </div>
          <div style={{ color: GRIS, fontFamily: 'Lexend, sans-serif' }}>Asociado / restante</div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 500, color: Math.abs(restante) < 0.01 ? VERDE : NAR, textAlign: 'right' }}>
            {fmtEur(totalAsociado)} / {fmtEur(restante)}
          </div>
        </div>

        {/* Punto 25: datos enriquecidos del extracto bancario */}
        {hayDatosExtracto && (
          <div style={{ marginBottom: 22, padding: '12px 14px', background: OCR_FOOTER_BG, border: `0.5px solid ${CLARO}`, borderRadius: 10 }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '2px', color: GRIS, textTransform: 'uppercase', marginBottom: 10 }}>Datos del extracto</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13, fontFamily: 'Lexend, sans-serif' }}>
              {extracto?.fecha_valor && (<>
                <div style={{ color: GRIS }}>Fecha valor</div>
                <div style={{ color: INK, textAlign: 'right' }}>{fmtDate(extracto.fecha_valor)}</div>
              </>)}
              {tipoMovLabel && (<>
                <div style={{ color: GRIS }}>Tipo de movimiento</div>
                <div style={{ color: INK, textAlign: 'right' }}>{tipoMovLabel}</div>
              </>)}
              {extracto?.saldo != null && (<>
                <div style={{ color: GRIS }}>Saldo tras el movimiento</div>
                <div style={{ color: INK, textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontWeight: 500 }}>{fmtEur(extracto.saldo)}</div>
              </>)}
              {extracto?.referencia && (<>
                <div style={{ color: GRIS }}>Referencia</div>
                <div style={{ color: INK, textAlign: 'right', wordBreak: 'break-all' }}>{extracto.referencia}</div>
              </>)}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '2px', color: GRIS, textTransform: 'uppercase', marginBottom: 8 }}>Categoría</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <select value={selectedBloque} onChange={e => { setSelectedBloque(e.target.value); setSelectedSubgrupo(''); setSelectedDetalle('') }}
              style={{ padding: '9px 12px', borderRadius: 8, border: `0.5px solid ${BORDE_SUAVE}`, background: BLANCO, color: INK, fontFamily: 'Lexend, sans-serif', fontSize: 13, cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}>
              <option value="">Categoría</option>
              {bloques.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
            <select value={selectedSubgrupo} onChange={e => { setSelectedSubgrupo(e.target.value); setSelectedDetalle('') }}
              disabled={!selectedBloque || subgrupos.length === 0}
              style={{ padding: '9px 12px', borderRadius: 8, border: `0.5px solid ${BORDE_SUAVE}`, background: BLANCO, color: INK, fontFamily: 'Lexend, sans-serif', fontSize: 13, cursor: 'pointer', width: '100%', boxSizing: 'border-box', opacity: (!selectedBloque || subgrupos.length === 0) ? 0.5 : 1 }}>
              <option value="">Grupo</option>
              {subgrupos.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
            <select value={selectedDetalle} onChange={e => setSelectedDetalle(e.target.value)} disabled={!selectedBloque}
              style={{ padding: '9px 12px', borderRadius: 8, border: selectedDetalle ? `0.5px solid ${CORREO_ALERTA_BORDE}` : `0.5px solid ${BORDE_SUAVE}`, background: selectedDetalle ? CORREO_ALERTA_BORDE + '10' : BLANCO, color: selectedDetalle ? ROJO : INK, fontFamily: 'Lexend, sans-serif', fontSize: 13, cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}>
              <option value="">Detalle</option>
              {detalles.map(d => <option key={d.id} value={d.id}>{d.id} · {d.nombre}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '2px', color: GRIS, textTransform: 'uppercase', marginBottom: 8 }}>Contraparte (no editable)</label>
          <div
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `0.5px solid ${BORDE_SUAVE}`, background: OCR_FOOTER_BG, color: GRIS, fontFamily: 'Lexend, sans-serif', fontSize: 13, boxSizing: 'border-box' }}>
            {contraparte || facturasAsociadas[0]?.factura_proveedor || '—'}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '2px', color: GRIS, textTransform: 'uppercase', marginBottom: 8 }}>Titular</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {titulares.filter(t => {
              const n = t.nombre.toLowerCase()
              return n.includes('rubén') || n.includes('ruben') || n.includes('emilio')
            }).slice(0, 2).map(t => {
              const n = t.nombre.toLowerCase()
              const isR = n.includes('rubén') || n.includes('ruben')
              const isActive = titularId === t.id
              const activeColor = isR ? NAR : AZUL
              return (
                <button key={t.id} onClick={() => setTitularId(isActive ? '' : t.id)}
                  style={{ padding: 10, borderRadius: 8, border: isActive ? 'none' : `0.5px solid ${BORDE_SUAVE}`, background: isActive ? activeColor : BLANCO, color: isActive ? BLANCO : OSC, fontFamily: 'Lexend, sans-serif', fontSize: 13, cursor: 'pointer', textAlign: 'center', fontWeight: 500 }}>
                  {t.nombre}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '2px', color: GRIS, textTransform: 'uppercase' }}>
              Facturas asociadas ({facturasAsociadas.length})
            </label>
            <button onClick={() => setMostrarBuscador(v => !v)}
              style={{ padding: '5px 12px', borderRadius: 6, border: `0.5px solid ${BORDE_SUAVE}`, background: BLANCO, fontFamily: 'Lexend, sans-serif', fontSize: 11, color: OSC, cursor: 'pointer' }}>
              {mostrarBuscador ? 'Cerrar' : '+ Asociar'}
            </button>
          </div>

          {facturasAsociadas.length === 0 && !mostrarBuscador && (
            <div style={{ padding: 16, textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRIS, background: OCR_FOOTER_BG, borderRadius: 8, border: `0.5px dashed ${BORDE_SUAVE}` }}>
              Sin facturas asociadas
            </div>
          )}

          {facturasAsociadas.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: mostrarBuscador ? 12 : 0 }}>
              {facturasAsociadas.map(f => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#1D9E7510', border: '0.5px solid #1D9E7540', borderRadius: 8, fontFamily: 'Lexend, sans-serif', fontSize: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: CANAL_UBER_DARK, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.factura_numero} · {f.factura_proveedor}
                    </div>
                    <div style={{ color: GRIS, fontSize: 11 }}>
                      {fmtDate(f.factura_fecha)} · Asociado {fmtEur(f.importe_asociado)} de {fmtEur(f.factura_total)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    {f.factura_pdf_url && (
                      <a href={f.factura_pdf_url} target="_blank" rel="noreferrer"
                        style={{ padding: '3px 8px', background: BLANCO, border: `0.5px solid ${BORDE_SUAVE}`, borderRadius: 6, color: OSC, textDecoration: 'none', fontSize: 11 }}>
                        📎 PDF
                      </a>
                    )}
                    <button onClick={() => handleDesasociar(f)}
                      style={{ padding: '3px 8px', background: BLANCO, border: '0.5px solid #E24B4A40', borderRadius: 6, color: ROJO, cursor: 'pointer', fontSize: 11 }}>
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {mostrarBuscador && (
            <div style={{ background: OCR_FOOTER_BG, borderRadius: 8, padding: 12, border: `0.5px solid ${BORDE_SUAVE}` }}>
              <input type="text" value={busquedaFactura} onChange={e => setBusquedaFactura(e.target.value)}
                placeholder="Buscar factura por nº o proveedor (vacío = match según reglas de proveedor)"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: `0.5px solid ${BORDE_SUAVE}`, background: BLANCO, fontFamily: 'Lexend, sans-serif', fontSize: 12, marginBottom: 10, boxSizing: 'border-box', outline: 'none' }} />

              {cargandoCandidatas && (
                <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: GRIS }}>Buscando…</div>
              )}

              {!cargandoCandidatas && candidatas.length === 0 && (
                <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: GRIS }}>
                  Sin candidatas en la ventana configurada.
                </div>
              )}

              {!cargandoCandidatas && candidatas.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                  {candidatas.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: BLANCO, border: `0.5px solid ${BORDE_SUAVE}`, borderRadius: 6, fontFamily: 'Lexend, sans-serif', fontSize: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: INK, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.numero_factura} · {c.proveedor_nombre}
                        </div>
                        <div style={{ color: GRIS, fontSize: 11 }}>
                          {fmtDate(c.fecha_factura)} · {c.diff_dias}d · Total {fmtEur(c.total)} · Restante {fmtEur(c.importe_restante)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                        <input type="text" value={importeAsociar[c.id] ?? ''}
                          onChange={e => setImporteAsociar(p => ({ ...p, [c.id]: e.target.value }))}
                          placeholder={String(Math.min(restante, c.importe_restante).toFixed(2))}
                          style={{ width: 70, padding: '4px 8px', borderRadius: 5, border: `0.5px solid ${BORDE_SUAVE}`, fontSize: 11, fontFamily: 'Oswald, sans-serif', textAlign: 'right' }} />
                        <button onClick={() => handleAsociar(c)}
                          style={{ padding: '4px 10px', background: ROJO, border: 'none', borderRadius: 5, color: BLANCO, cursor: 'pointer', fontSize: 11, fontFamily: 'Lexend, sans-serif' }}>
                          Asociar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Lexend, sans-serif', fontSize: 13, color: OSC, cursor: 'pointer', marginBottom: 12, padding: '10px 12px', background: CREMA, borderRadius: 8 }}>
          <input type="checkbox" checked={noRequiere} onChange={e => setNoRequiere(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: ROJO, margin: 0 }} />
          <span>No requiere documento</span>
        </label>

        {/* Puntos 9/10: marcar el movimiento como NO conciliable (comisión banco, traspaso…) */}
        <div style={{ marginBottom: 22, padding: '10px 12px', background: noConciliable ? CONCILIACION_VIOLETA_CLARO + '10' : CREMA, border: noConciliable ? `0.5px solid ${CONCILIACION_VIOLETA_CLARO}` : '0.5px solid transparent', borderRadius: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Lexend, sans-serif', fontSize: 13, color: OSC, cursor: 'pointer' }}>
            <input type="checkbox" checked={noConciliable} onChange={e => setNoConciliable(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: CONCILIACION_VIOLETA_CLARO, margin: 0 }} />
            <span>No conciliable (no se cruza con factura: comisión del banco, traspaso entre cuentas…)</span>
          </label>
          {noConciliable && (
            <input type="text" value={motivoNoConc} onChange={e => setMotivoNoConc(e.target.value)}
              placeholder="Motivo (ej. traspaso entre cuentas, comisión bancaria)"
              style={{ width: '100%', marginTop: 10, padding: '8px 12px', borderRadius: 6, border: `0.5px solid ${BORDE_SUAVE}`, background: BLANCO, fontFamily: 'Lexend, sans-serif', fontSize: 12, boxSizing: 'border-box', outline: 'none' }} />
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: 8, border: `0.5px solid ${BORDE_SUAVE}`, background: 'transparent', color: OSC, fontFamily: 'Lexend, sans-serif', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={saving}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: ROJO, color: BLANCO, fontFamily: 'Lexend, sans-serif', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
