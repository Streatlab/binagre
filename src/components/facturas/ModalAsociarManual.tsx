import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtFechaES } from '@/utils/format'
import type { FacturasTokens } from '@/styles/facturasTheme'

interface FacturaMin {
  id: string
  proveedor_nombre?: string
}

interface Cargo {
  id: string
  fecha: string
  concepto: string | null
  importe: number
}

interface Props {
  T: FacturasTokens
  factura: FacturaMin
  onClose: () => void
  onUpdate: () => void
}

export default function ModalAsociarManual({ T, factura, onClose, onUpdate }: Props) {
  const [query, setQuery] = useState(factura.proveedor_nombre?.slice(0, 15) || '')
  const [candidatos, setCandidatos] = useState<Cargo[]>([])
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let qb = supabase
        .from('conciliacion')
        .select('id, fecha, concepto, importe')
        .lt('importe', 0)
        .order('fecha', { ascending: false })
        .limit(50)
      if (query.trim()) {
        const q = query.trim()
        qb = qb.or(`concepto.ilike.%${q}%,proveedor.ilike.%${q}%`)
      }
      const { data } = await qb
      if (!cancelled && data) {
        setCandidatos(
          data.map((c) => ({
            id: c.id as string,
            fecha: c.fecha as string,
            concepto: (c.concepto as string) || null,
            importe: Number(c.importe),
          })),
        )
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [query])

  async function asociar() {
    try {
      await fetch(`/api/facturas/${factura.id}/asociar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conciliacion_ids: Array.from(seleccionados) }),
      })
    } catch {
      // en dev sin serverless, aplicamos directo vía supabase
      for (const id of seleccionados) {
        const c = candidatos.find((x) => x.id === id)
        if (!c) continue
        await supabase.from('facturas_gastos').insert({
          factura_id: factura.id,
          conciliacion_id: c.id,
          importe_asociado: Math.abs(c.importe),
          confirmado: true,
          confianza_match: 100,
        })
      }
      await supabase.from('facturas').update({ estado: 'asociada' }).eq('id', factura.id)
    }
    onUpdate()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#1a1a1a',
          borderRadius: 14,
          width: '100%',
          maxWidth: 700,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${T.border}`,
        }}
      >
        <div
          style={{
            padding: '18px 22px',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2
            style={{
              fontFamily: T.fontTitle,
              fontSize: 14,
              color: T.text,
              margin: 0,
              letterSpacing: 2,
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            ASOCIAR A MOVIMIENTOS DEL BANCO
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 18 }}>
          <div style={{ position: 'relative', marginBottom: 4 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: T.muted,
              }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar proveedor, concepto, importe..."
              style={{
                width: '100%',
                padding: '10px 14px 10px 36px',
                backgroundColor: '#1e1e1e',
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                color: T.text,
                fontFamily: T.fontUi,
                fontSize: 13,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '0 18px 18px' }}>
          {candidatos.length === 0 && (
            <div style={{ color: T.muted, fontSize: 13, textAlign: 'center', padding: 30 }}>
              No hay movimientos que coincidan
            </div>
          )}
          {candidatos.map((c) => {
            const sel = seleccionados.has(c.id)
            return (
              <div
                key={c.id}
                onClick={() => {
                  const nueva = new Set(seleccionados)
                  if (sel) nueva.delete(c.id)
                  else nueva.add(c.id)
                  setSeleccionados(nueva)
                }}
                style={{
                  backgroundColor: sel ? `${T.accentRed}22` : T.card,
                  border: `1px solid ${sel ? T.accentRed : T.border}`,
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 6,
                  cursor: 'pointer',
                  display: 'grid',
                  gridTemplateColumns: '24px 1fr auto',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <input type="checkbox" checked={sel} readOnly />
                <div>
                  <div style={{ fontFamily: T.fontUi, fontSize: 13, color: T.text }}>
                    {c.concepto || '—'}
                  </div>
                  <div
                    style={{
                      fontFamily: T.fontUi,
                      fontSize: 11,
                      color: T.muted,
                      marginTop: 3,
                    }}
                  >
                    {fmtFechaES(c.fecha)}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: T.fontTitle,
                    fontSize: 14,
                    color: T.text,
                    fontWeight: 600,
                  }}
                >
                  {fmtEur(Math.abs(c.importe))}
                </div>
              </div>
            )
          })}
        </div>

        <div
          style={{
            padding: '14px 22px',
            borderTop: `1px solid ${T.border}`,
            display: 'flex',
            gap: 8,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontFamily: T.fontUi, fontSize: 12, color: T.muted }}>
            {seleccionados.size} seleccionado{seleccionados.size === 1 ? '' : 's'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: '9px 18px',
                backgroundColor: 'transparent',
                color: T.text,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                fontFamily: T.fontTitle,
                fontSize: 12,
                letterSpacing: 1,
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={asociar}
              disabled={seleccionados.size === 0}
              style={{
                padding: '9px 18px',
                backgroundColor: T.accentRed,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontFamily: T.fontTitle,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: 'uppercase',
                cursor: seleccionados.size === 0 ? 'not-allowed' : 'pointer',
                opacity: seleccionados.size === 0 ? 0.5 : 1,
              }}
            >
              Asociar{seleccionados.size > 0 ? ` (${seleccionados.size})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
