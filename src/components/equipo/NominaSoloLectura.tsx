/**
 * NominaSoloLectura — piezas de solo lectura para ver una nómina (desglose,
 * pagos del banco, modal VER con PDF embebido). Compartido entre TabNominas y
 * la ficha financiera del empleado (ModalEmpleado): una sola fuente de verdad
 * para no repetir el mismo mini-componente en dos sitios.
 */
import type { NominaCompleta, PagoAsociado } from '@/lib/equipo/useNominasCompletas'
import { fmtEur, fmtDate } from '@/lib/format'
import { Download } from 'lucide-react'
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

export function ModalVerNomina({ n, onClose }: { n: NominaCompleta; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 130, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: CREMA, border: BORDER_CARD, boxShadow: '8px 8px 0 rgba(0,0,0,0.25)', padding: 24, width: '100%', maxWidth: 720, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontFamily: OSW, fontSize: 15, letterSpacing: '2px', textTransform: 'uppercase', color: GRANATE }}>
              {n.empleado_nombre} · {MESES_LARGO[n.mes - 1]} {n.anio}
            </div>
            <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: clasifColor(n.clasificacion), marginTop: 4 }}>
              {clasifLabel(n.clasificacion)} · diferencia {fmtEur(n.diferencia, { decimals: 2, signed: true })}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: GRIS, fontFamily: LEX, fontSize: 13, cursor: 'pointer' }}>Cerrar</button>
        </div>

        {n.pdf_url ? (
          <div style={{ marginBottom: 16 }}>
            <iframe src={n.pdf_url} title="Nómina PDF" style={{ width: '100%', height: 380, border: `2px solid ${INK}` }} />
            <a href={n.pdf_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, color: AZUL, fontFamily: LEX, fontSize: 12, textDecoration: 'none' }}>
              <Download size={12} /> Abrir PDF en pestaña nueva
            </a>
          </div>
        ) : (
          <div style={{ color: GRIS, fontFamily: LEX, fontSize: 12, marginBottom: 16 }}>Sin PDF asociado.</div>
        )}

        <span style={eyebrow(CLARO, INK)}>DESGLOSE</span>
        <div style={{ marginTop: 8, marginBottom: 16 }}>
          <DesgloseSoloLectura n={n} />
        </div>

        <span style={eyebrow(AZUL, BLANCO)}>PAGOS DEL BANCO</span>
        <div style={{ marginTop: 8 }}>
          <ListaPagosSoloLectura pagos={n.pagos} />
        </div>
      </div>
    </div>
  )
}
