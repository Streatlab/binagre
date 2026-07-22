import { BLANCO, BORDE_SUAVE, CLARO, GRANATE, GRIS, INK, NAR, OSC, VERDE } from '@/styles/neobrutal'
import { OCR_ROJO_WASH_CLARO, COBERTURA_VERDE, CANAL_UBER_DARK } from '@/styles/palettes'
import { useState } from 'react'

// Alerta de pendientes (paso 6-9 del flujo OCR).
// Al pulsar "Re-conciliar pendientes" llama al barrido del backend, que reintenta
// el matching de TODAS las pendientes contra reglas/plantillas/conciliación actuales.
// Devuelve un informe con el motivo de cada una que sigue pendiente, separando:
//   - sin_regla: NO hay alias/regla/plantilla → hay que crearla (acción de Rubén/Claude)
//   - sin_plantilla: lectura manual sin plantilla de NIF → crear plantilla
//   - con_regla_sin_match: hay regla pero el banco no cuadra (falta extracto, importe…)
// LEY 100%: si sin_regla + sin_plantilla > 0, NO está cerrado.

interface Pendiente {
  factura_id: string
  proveedor: string | null
  nif: string | null
  total: number | null
  fecha: string | null
  archivo: string | null
  motivo: string
}

interface Informe {
  ok: boolean
  cien_por_cien: boolean
  total_pendientes_revisados: number
  reconciliadas: number
  siguen_pendientes: number
  con_regla_sin_match: Pendiente[]
  sin_regla: Pendiente[]
  sin_plantilla: Pendiente[]
}

interface Props {
  desde?: string | null
  hasta?: string | null
  onReconciliado?: () => void
}

const ROJO = GRANATE
const NARANJA = NAR
function Grupo({ titulo, color, items }: { titulo: string; color: string; items: Pendiente[] }) {
  const [abierto, setAbierto] = useState(items.length > 0 && items.length <= 12)
  if (items.length === 0) return null
  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => setAbierto(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color }}
      >
        <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: color }} />
        {titulo} · {items.length}
        <span style={{ fontSize: 11, color: GRIS }}>{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && (
        <div style={{ marginTop: 8, border: `0.5px solid ${CLARO}`, borderRadius: 10, overflow: 'hidden' }}>
          {items.map((p, i) => (
            <div key={p.factura_id} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px', borderTop: i === 0 ? 'none' : `0.5px solid ${CLARO}`, background: BLANCO }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontFamily: 'Lexend, sans-serif', fontSize: 13, color: INK }}>
                <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.proveedor || p.archivo || 'Sin identificar'}</span>
                <span style={{ flexShrink: 0, color: GRIS }}>{p.fecha ?? ''}{p.total != null ? ` · ${p.total.toFixed(2)}€` : ''}</span>
              </div>
              {p.nif && <div style={{ fontFamily: 'monospace', fontSize: 11, color: GRIS }}>{p.nif}</div>}
              <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: OSC }}>{p.motivo}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PendientesAlerta({ desde, hasta, onReconciliado }: Props) {
  const [cargando, setCargando] = useState(false)
  const [informe, setInforme] = useState<Informe | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function reconciliar() {
    setCargando(true); setError(null)
    try {
      const params = new URLSearchParams({ action: 'reconciliar-pendientes' })
      if (desde) params.set('desde', desde)
      if (hasta) params.set('hasta', hasta)
      const r = await fetch(`/api/facturas?${params.toString()}`)
      const data = await r.json()
      if (!r.ok || !data.ok) throw new Error(data.error || 'Error en el barrido')
      setInforme(data as Informe)
      onReconciliado?.()
    } catch (e: any) {
      setError(e?.message || 'Error al re-conciliar')
    } finally {
      setCargando(false)
    }
  }

  const bloqueantes = informe ? informe.sin_regla.length + informe.sin_plantilla.length : 0

  return (
    <div style={{ background: BLANCO, border: `0.5px solid ${informe && bloqueantes > 0 ? NARANJA : BORDE_SUAVE}`, borderRadius: 14, padding: '14px 18px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', color: ROJO }}>
          Barrido de pendientes
        </div>
        <button
          onClick={reconciliar}
          disabled={cargando}
          style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: cargando ? BORDE_SUAVE : ROJO, color: BLANCO, fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', cursor: cargando ? 'wait' : 'pointer', fontWeight: 600 }}
        >
          {cargando ? 'Re-conciliando…' : 'Re-conciliar pendientes'}
        </button>
      </div>

      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRIS, marginTop: 6 }}>
        Reintenta el match de todas las pendientes con las reglas y plantillas actuales. Las que sigan sin cuadrar aparecen aquí con su motivo.
      </div>

      {error && (
        <div style={{ marginTop: 10, background: OCR_ROJO_WASH_CLARO, border: `0.5px solid ${ROJO}`, borderRadius: 8, padding: '8px 12px', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: ROJO }}>{error}</div>
      )}

      {informe && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>
            <span style={{ color: OSC }}>Revisadas: <strong>{informe.total_pendientes_revisados}</strong></span>
            <span style={{ color: VERDE }}>Reconciliadas ahora: <strong>{informe.reconciliadas}</strong></span>
            <span style={{ color: informe.siguen_pendientes > 0 ? NARANJA : VERDE }}>Siguen pendientes: <strong>{informe.siguen_pendientes}</strong></span>
          </div>

          {informe.cien_por_cien ? (
            <div style={{ marginTop: 10, background: COBERTURA_VERDE + '10', border: `0.5px solid ${VERDE}`, borderRadius: 8, padding: '10px 12px', fontFamily: 'Oswald, sans-serif', fontSize: 13, letterSpacing: '1px', color: CANAL_UBER_DARK, textTransform: 'uppercase' }}>
              ✓ 100% conciliado
            </div>
          ) : (
            <>
              <Grupo titulo="Sin regla — créala" color={ROJO} items={informe.sin_regla} />
              <Grupo titulo="Sin plantilla de NIF — créala" color={ROJO} items={informe.sin_plantilla} />
              <Grupo titulo="Con regla, banco no cuadra" color={NARANJA} items={informe.con_regla_sin_match} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
