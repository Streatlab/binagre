import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'

type Tab = 'drive'

const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: 'drive', label: 'Google Drive', emoji: '📂' },
]

export default function IntegracionesPage() {
  const { T } = useTheme()
  const [tab, setTab] = useState<Tab>('drive')
  const accent = '#B01D23'

  return (
    <div style={{ fontFamily: FONT.body, color: T.pri }}>
      <h1 style={{ fontFamily: FONT.heading, fontSize: '1.1rem', letterSpacing: '3px', color: T.sec, marginBottom: 20, textTransform: 'uppercase' }}>
        Integraciones
      </h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                fontFamily: FONT.body,
                fontSize: 13,
                backgroundColor: active ? accent : 'transparent',
                color: active ? '#fff' : T.sec,
                padding: '6px 14px',
                borderRadius: 6,
                border: active ? 'none' : `0.5px solid ${T.brd}`,
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'background 150ms',
              }}
            >
              {t.emoji} {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'drive' && <TabDrive />}
    </div>
  )
}

function TabDrive() {
  const { T } = useTheme()
  const [estado, setEstado] = useState<{ conectado: boolean; email?: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/oauth/google/status')
      .then(r => r.json())
      .then(d => { setEstado(d); setLoading(false) })
      .catch(() => { setEstado({ conectado: false }); setLoading(false) })
  }, [])

  const conectar = () => {
    window.location.href = '/api/oauth/google/connect'
  }

  return (
    <div style={{
      background: T.card,
      border: `0.5px solid ${T.brd}`,
      borderRadius: 14,
      padding: 28,
      maxWidth: 480,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <span style={{ fontSize: 36 }}>📂</span>
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 15, letterSpacing: '1px', textTransform: 'uppercase', color: T.pri }}>
            Google Drive
          </div>
          <div style={{ fontSize: 12, color: T.mut, marginTop: 2 }}>
            Almacenamiento de facturas y documentos
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ color: T.mut, fontSize: 13 }}>Comprobando estado…</div>
      ) : estado?.conectado ? (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(29,158,117,0.1)', border: '0.5px solid #1D9E75',
            borderRadius: 8, padding: '10px 14px', marginBottom: 16,
          }}>
            <span style={{ color: '#1D9E75', fontSize: 16 }}>✓</span>
            <div>
              <div style={{ fontSize: 13, color: '#1D9E75', fontWeight: 600 }}>Conectado</div>
              {estado.email && <div style={{ fontSize: 11, color: T.mut }}>{estado.email}</div>}
            </div>
          </div>
          <button
            onClick={conectar}
            style={{
              fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px',
              textTransform: 'uppercase', padding: '9px 20px', borderRadius: 6,
              background: 'transparent', border: `0.5px solid ${T.brd}`,
              color: T.mut, cursor: 'pointer',
            }}
          >
            Reconectar cuenta
          </button>
        </>
      ) : (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(176,29,35,0.08)', border: '0.5px solid #B01D23',
            borderRadius: 8, padding: '10px 14px', marginBottom: 16,
          }}>
            <span style={{ color: '#B01D23', fontSize: 16 }}>✗</span>
            <div style={{ fontSize: 13, color: '#B01D23', fontWeight: 600 }}>No conectado</div>
          </div>
          <p style={{ fontSize: 12, color: T.mut, marginBottom: 16, lineHeight: 1.5 }}>
            Conecta tu cuenta de Google para subir facturas automáticamente a Drive y mantener los PDFs organizados por titular y trimestre.
          </p>
          <button
            onClick={conectar}
            style={{
              fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px',
              textTransform: 'uppercase', padding: '10px 24px', borderRadius: 6,
              background: '#B01D23', border: 'none', color: '#fff',
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            🔗 Conectar Google Drive
          </button>
        </>
      )}
    </div>
  )
}
