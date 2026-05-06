import { useToastsFacturas } from '@/hooks/useToastsFacturas'
import { X } from 'lucide-react'

export default function ToastsFacturasContainer() {
  const { toasts, estados, cerrarToast } = useToastsFacturas()
  const vivos = toasts.filter(t => !t.cerradoManualmente)
  if (vivos.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 360,
      }}
    >
      {vivos.map(t => {
        const e = estados[t.id]
        const procesadas = e?.procesadas ?? 0
        const asociadas = e?.asociadas ?? 0
        const pendientes = e?.pendientes ?? t.totalFacturas
        const errores = e?.errores ?? 0
        const total = t.totalFacturas
        const completado = procesadas >= total
        const pct = total > 0 ? Math.min(100, (procesadas / total) * 100) : 0

        return (
          <div
            key={t.id}
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: 8,
              padding: '12px 14px',
              fontFamily: 'Lexend, system-ui, sans-serif',
              color: '#ffffff',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              minWidth: 280,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {completado ? '✅' : '📥'} {procesadas} de {total} facturas
              </div>
              <button
                onClick={() => cerrarToast(t.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#cccccc',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Cerrar"
              >
                <X size={14} />
              </button>
            </div>

            <div
              style={{
                marginTop: 8,
                height: 6,
                backgroundColor: '#2a2a2a',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  backgroundColor: completado ? '#06C167' : '#B01D23',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: '#cccccc',
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              {asociadas > 0 && <span>✅ {asociadas} asociadas</span>}
              {pendientes > 0 && <span style={{ color: '#e8f442' }}>⏳ {pendientes} pendientes</span>}
              {errores > 0 && <span style={{ color: '#ff6b70' }}>❌ {errores} errores</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
