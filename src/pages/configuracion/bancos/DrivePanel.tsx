import { useEffect, useState, type CSSProperties } from 'react'
import { useTheme, FONT } from '@/styles/tokens'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'

interface Status {
  conectado: boolean
  email?: string
}

export default function DrivePanel() {
  const { T } = useTheme()
  const [data, setData] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  async function cargar() {
    setLoading(true)
    try {
      const r = await fetch('/api/oauth/google/status')
      if (!r.ok) throw new Error(await r.text())
      setData(await r.json())
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargar()
    const params = new URLSearchParams(window.location.search)
    if (params.get('drive_conectado')) setMsg('✅ Drive conectado correctamente')
    const errParam = params.get('drive_error')
    if (errParam) setMsg(`❌ Error OAuth: ${decodeURIComponent(errParam)}`)
  }, [])

  function conectar() {
    window.location.href = '/api/oauth/google/start'
  }

  async function desconectar() {
    if (!confirm('¿Desconectar Drive? Las facturas ya subidas permanecen, pero no podrás subir nuevas hasta reconectar.')) return
    await fetch('/api/oauth/google/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    setMsg('Drive desconectado')
    await cargar()
  }

  const btnPrimario: CSSProperties = {
    padding: '8px 14px',
    background: '#B01D23',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: '1.2px',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontWeight: 600,
  }
  const btnSecundario: CSSProperties = {
    padding: '8px 14px',
    background: 'transparent',
    color: T.sec,
    border: `0.5px solid ${T.brd}`,
    borderRadius: 8,
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: '1.2px',
    textTransform: 'uppercase',
    cursor: 'pointer',
  }

  const conectado = data?.conectado
  const email = data?.email

  return (
    <ConfigGroupCard title="Drive (Google)" subtitle="archivado automático de facturas">
      <div style={{ padding: '18px 22px' }}>
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, marginBottom: 14, lineHeight: 1.5 }}>
          Conecta una sola cuenta Google. Los PDFs de todas las facturas se archivarán ahí dentro de
          carpetas <code>RUBEN/</code> o <code>EMILIO/</code> según el titular de cada factura.
        </div>

        {msg && (
          <div style={{
            padding: 12,
            borderRadius: 8,
            background: msg.startsWith('❌') ? '#A32D2D22' : '#1D9E7522',
            borderLeft: `3px solid ${msg.startsWith('❌') ? '#A32D2D' : '#1D9E75'}`,
            fontFamily: FONT.body, fontSize: 12, color: T.pri,
            marginBottom: 14,
          }}>{msg}</div>
        )}

        {loading && <div style={{ color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>Cargando…</div>}

        {!loading && data && (
          <div style={{
            background: T.card,
            border: `0.5px solid ${T.brd}`,
            borderRadius: 10,
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontFamily: FONT.heading, fontSize: 11, color: T.mut, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                Cuenta Google
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 14, color: T.pri, marginTop: 4 }}>
                {conectado
                  ? <>✅ <strong>{email || 'Conectado'}</strong></>
                  : <span style={{ color: T.mut }}>No conectado</span>
                }
              </div>
            </div>
            {conectado
              ? <button onClick={desconectar} style={btnSecundario}>Desconectar</button>
              : <button onClick={conectar} style={btnPrimario}>🔗 Conectar Drive</button>
            }
          </div>
        )}
      </div>
    </ConfigGroupCard>
  )
}
