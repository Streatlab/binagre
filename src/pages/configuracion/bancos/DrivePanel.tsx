import { useEffect, useState, type CSSProperties } from 'react'
import { useTheme, FONT } from '@/styles/tokens'

interface TitularStatus {
  id: string
  nombre: string
  color: string
  conectado: boolean
  email: string | null
}

interface StatusResp {
  unified: { conectado: boolean; email: string | null }
  titulares: TitularStatus[]
}

export default function DrivePanel() {
  const { T } = useTheme()
  const [data, setData] = useState<StatusResp | null>(null)
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

  function conectar(titularId: string | null) {
    const qs = titularId ? `?titular_id=${titularId}` : ''
    window.location.href = `/api/oauth/google/start${qs}`
  }

  async function desconectar(titularId: string | null) {
    if (!confirm('¿Desconectar Drive? Las facturas subidas permanecen pero no podrás subir nuevas hasta reconectar.')) return
    await fetch('/api/oauth/google/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titular_id: titularId }),
    })
    setMsg('Drive desconectado')
    await cargar()
  }

  const cardStyle: CSSProperties = {
    background: T.card,
    border: `0.5px solid ${T.brd}`,
    borderRadius: 12,
    padding: '16px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
    flexWrap: 'wrap',
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

  return (
    <div>
      <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, marginBottom: 14, lineHeight: 1.5 }}>
        Conecta tu cuenta Google para que las facturas se archiven automáticamente en tu Drive personal.
        Cada titular puede conectar su propia cuenta; las facturas con ese titular se subirán a su Drive.
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

      {data && (
        <>
          <div style={cardStyle}>
            <div>
              <div style={{ fontFamily: FONT.heading, fontSize: 12, color: T.mut, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                Cuenta unificada (sin titular)
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 14, color: T.pri, marginTop: 4 }}>
                {data.unified.conectado ? (
                  <>✅ <strong>{data.unified.email || 'Conectado'}</strong></>
                ) : (
                  <span style={{ color: T.mut }}>No conectado</span>
                )}
              </div>
            </div>
            {data.unified.conectado ? (
              <button onClick={() => desconectar(null)} style={btnSecundario}>Desconectar</button>
            ) : (
              <button onClick={() => conectar(null)} style={btnPrimario}>🔗 Conectar</button>
            )}
          </div>

          {data.titulares.map((t) => (
            <div key={t.id} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: t.color, display: 'inline-block' }} />
                <div>
                  <div style={{ fontFamily: FONT.heading, fontSize: 12, color: T.mut, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                    {t.nombre}
                  </div>
                  <div style={{ fontFamily: FONT.body, fontSize: 14, color: T.pri, marginTop: 4 }}>
                    {t.conectado ? (
                      <>✅ <strong>{t.email || 'Conectado'}</strong></>
                    ) : (
                      <span style={{ color: T.mut }}>No conectado</span>
                    )}
                  </div>
                </div>
              </div>
              {t.conectado ? (
                <button onClick={() => desconectar(t.id)} style={btnSecundario}>Desconectar</button>
              ) : (
                <button onClick={() => conectar(t.id)} style={btnPrimario}>🔗 Conectar Drive de {t.nombre}</button>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
