/**
 * NominaSoloLectura — piezas de solo lectura para ver una nómina (desglose,
 * pagos del banco, modal VER con PDF embebido). Compartido entre TabNominas y
 * la ficha financiera del empleado (ModalEmpleado): una sola fuente de verdad
 * para no repetir el mismo mini-componente en dos sitios.
 */
import { useState } from 'react'
import type { NominaCompleta, PagoAsociado } from '@/lib/equipo/useNominasCompletas'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtDate } from '@/lib/format'
import { Check } from 'lucide-react'
import VisorPdf from '@/components/equipo/VisorPdf'
import { OSW, LEX, INK, CREMA, CLARO, BORDER_CARD, GRANATE, AMA, VERDE, ROJO, AZUL, GRIS, eyebrow, BLANCO } from '@/styles/neobrutal'

export const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export function clasifColor(c: NominaCompleta['clasificacion']): string {
  switch (c) {
    case 'cuadra': return VERDE
    case 'pagado_de_mas': return AZUL
    case 'pagado_de_menos': return ROJO
    case 'sin_pago': return GRIS
  }
}
export function clasifLabel(c: NominaCompleta['clasificacion']): string {
  switch (c) {
    case 'cuadra': return 'Cuadra'
    case 'pagado_de_mas': return 'Pagado de más'
    case 'pagado_de_menos': return 'Pagado de menos'
    case 'sin_pago': return 'Sin pago'
  }
}

export function ListaPagosSoloLectura({ pagos }: { pagos: PagoAsociado[] }) {
  if (pagos.length === 0) {
    return <div style={{ color: GRIS, fontFamily: LEX, fontSize: 12 }}>Sin pagos asociados todavía.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {pagos.map(p => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, border: `2px solid ${INK}`, padding: '6px 10px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: LEX, fontSize: 11, color: GRIS, whiteSpace: 'nowrap' }}>{fmtDate(p.fecha)}</span>
          <span style={{ fontFamily: LEX, fontSize: 12, flex: 1, minWidth: 100 }}>{p.concepto}</span>
          <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 12 }}>{fmtEur(p.importe_asociado, { decimals: 2 })}</span>
          <span style={{
            fontFamily: OSW, fontSize: 9, fontWeight: 600, textTransform: 'uppercase', border: `2px solid ${INK}`, padding: '1px 6px',
            background: p.confirmado ? VERDE : AMA, color: p.confirmado ? BLANCO : INK,
          }}>{p.confirmado ? 'Confirmado' : 'Sin confirmar'}</span>
        </div>
      ))}
    </div>
  )
}

export function DesgloseSoloLectura({ n }: { n: NominaCompleta }) {
  const campos: [number | null, string][] = [
    [n.importe_bruto, 'Bruto'], [n.importe_neto, 'Neto'], [n.irpf_retenido, 'IRPF'],
    [n.ss_trabajador, 'SS trabajador'], [n.ss_empresa, 'SS empresa'], [n.coste_empresa, 'Coste empresa'],
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
      {campos.map(([val, label]) => (
        <div key={label}>
          <label style={{ display: 'block', fontFamily: OSW, fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS, marginBottom: 3 }}>{label}</label>
          <div style={{ padding: '8px 10px', border: `2px solid ${INK}`, fontFamily: LEX, fontSize: 13, background: CLARO }}>
            {fmtEur(val, { decimals: 2 })}
          </div>
        </div>
      ))}
    </div>
  )
}

// Frase de estado de pago, sin alarmar cuando la causa real es que aún no hay
// extracto importado (clasificacion='sin_pago' con 0 pagos no es un error).
function fraseEstadoPago(n: NominaCompleta): string {
  if (n.clasificacion === 'sin_pago') return 'Comprometida · aún sin ver en banco'
  return `${clasifLabel(n.clasificacion)} · diferencia ${fmtEur(n.diferencia, { decimals: 2, signed: true })}`
}

const CAMPOS_DESGLOSE: [keyof CamposNomina, string][] = [
  ['importe_bruto', 'Bruto'], ['importe_neto', 'Neto'], ['irpf_retenido', 'IRPF'],
  ['ss_trabajador', 'SS trabajador'], ['ss_empresa', 'SS empresa'], ['coste_empresa', 'Coste empresa'],
]

interface CamposNomina {
  importe_bruto: number
  importe_neto: number
  irpf_retenido: number
  ss_trabajador: number
  ss_empresa: number
  coste_empresa: number
}

/** Desglose editable — solo se usa dentro del flujo "Confirmar importes" de una
 *  nómina en 'revisar'. Edición inline, sin subir nada; al confirmar guarda los
 *  valores y pasa estado a 'ok'. */
function DesgloseConfirmable({ vals, onChange }: { vals: CamposNomina; onChange: (campo: keyof CamposNomina, valor: number) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
      {CAMPOS_DESGLOSE.map(([campo, label]) => (
        <div key={campo}>
          <label style={{ display: 'block', fontFamily: OSW, fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS, marginBottom: 3 }}>{label}</label>
          <input
            type="number" step="0.01" value={vals[campo]}
            onChange={e => onChange(campo, parseFloat(e.target.value) || 0)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: `2px solid ${AMA}`, fontFamily: LEX, fontSize: 13, background: BLANCO, color: INK, outline: 'none' }}
          />
        </div>
      ))}
    </div>
  )
}

export function ModalVerNomina({ n, onClose, onConfirmado }: { n: NominaCompleta; onClose: () => void; onConfirmado?: () => void }) {
  const porConfirmar = n.estado === 'revisar'
  const [vals, setVals] = useState<CamposNomina>({
    importe_bruto: n.importe_bruto ?? 0,
    importe_neto: n.importe_neto ?? 0,
    irpf_retenido: n.irpf_retenido ?? 0,
    ss_trabajador: n.ss_trabajador ?? 0,
    ss_empresa: n.ss_empresa ?? 0,
    coste_empresa: n.coste_empresa ?? 0,
  })
  const [confirmando, setConfirmando] = useState(false)

  async function confirmarImportes() {
    setConfirmando(true)
    try {
      const { error } = await supabase.from('nominas').update({ ...vals, estado: 'ok' }).eq('id', n.id)
      if (!error) { onConfirmado?.(); onClose() }
    } finally {
      setConfirmando(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 130, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: CREMA, border: BORDER_CARD, boxShadow: '8px 8px 0 rgba(0,0,0,0.25)', padding: 24, width: '100%', maxWidth: 720, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontFamily: OSW, fontSize: 15, letterSpacing: '2px', textTransform: 'uppercase', color: GRANATE }}>
              {n.empleado_nombre} · {MESES_LARGO[n.mes - 1]} {n.anio}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: OSW, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: clasifColor(n.clasificacion) }}>
                {fraseEstadoPago(n)}
              </span>
              {porConfirmar && <span style={{ ...eyebrow(AMA, INK), fontSize: 9 }}>Por confirmar</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: GRIS, fontFamily: LEX, fontSize: 13, cursor: 'pointer' }}>Cerrar</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <VisorPdf storagePath={n.pdf_storage_path} driveUrl={n.pdf_url} />
        </div>

        <span style={eyebrow(CLARO, INK)}>DESGLOSE{porConfirmar ? ' · edita antes de confirmar' : ''}</span>
        <div style={{ marginTop: 8, marginBottom: porConfirmar ? 10 : 16 }}>
          {porConfirmar ? <DesgloseConfirmable vals={vals} onChange={(campo, valor) => setVals(v => ({ ...v, [campo]: valor }))} /> : <DesgloseSoloLectura n={n} />}
        </div>
        {porConfirmar && (
          <button
            onClick={confirmarImportes} disabled={confirmando}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16,
              border: `3px solid ${INK}`, background: VERDE, color: BLANCO,
              fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase',
              padding: '8px 14px', cursor: confirmando ? 'wait' : 'pointer',
            }}
          >
            <Check size={13} /> {confirmando ? 'Confirmando…' : 'Confirmar importes'}
          </button>
        )}

        <span style={eyebrow(AZUL, BLANCO)}>PAGOS DEL BANCO</span>
        <div style={{ marginTop: 8 }}>
          <ListaPagosSoloLectura pagos={n.pagos} />
        </div>
      </div>
    </div>
  )
}
