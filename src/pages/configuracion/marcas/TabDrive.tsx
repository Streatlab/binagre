import { BLANCO, GRANATE, VERDE } from '@/styles/neobrutal'
import { COBERTURA_VERDE } from '@/styles/palettes'
import { useEffect, useState } from 'react'
import { useTheme, FONT } from '@/styles/tokens'
import { PantallaCantera, HeroCantera, Papel } from '@/components/kit/cantera'

export default function TabDrive() {
  const { T } = useTheme()
  const [estado, setEstado] = useState<{ conectado: boolean; email?: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/oauth/google?action=status')
      .then(r => r.json())
      .then(d => { setEstado(d); setLoading(false) })
      .catch(() => { setEstado({ conectado: false }); setLoading(false) })

    const params = new URLSearchParams(window.location.search)
    if (params.get('drive_conectado') === '1') {
      setTimeout(() => window.history.replaceState({}, '', window.location.pathname), 100)
    }
  }, [])

  const desconectar = async () => {
    if (!confirm('¿Desconectar la cuenta de Google Drive?')) return
    await fetch('/api/oauth/google?action=disconnect', { method: 'POST' })
    setEstado({ conectado: false })
  }

  const btnPrimario: React.CSSProperties = {
    display: 'inline-block',
    fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px',
    textTransform: 'uppercase', padding: '11px 26px', borderRadius: 0,
    background: GRANATE, border: 'none', color: BLANCO,
    cursor: 'pointer', fontWeight: 600, textDecoration: 'none',
  }

  const titular = loading
    ? 'Comprobando la conexión con Google Drive…'
    : estado?.conectado
    ? 'Google Drive está conectado'
    : 'Google Drive no está conectado todavía'

  return (
    <PantallaCantera embedded>
      <HeroCantera
        area="equipo"
        titular={titular}
        etiquetaDato={loading ? undefined : 'Estado de la conexión'}
        cifra={loading ? undefined : (estado?.conectado ? 'Conectado' : 'Sin conectar')}
        resumen={
          estado?.conectado
            ? (estado.email ? <>Cuenta enlazada: <b>{estado.email}</b></> : 'Cuenta enlazada correctamente.')
            : 'Conecta tu cuenta de Google para subir facturas automáticamente a Drive y mantener los PDFs organizados por titular y trimestre.'
        }
      />
      <Papel ceja={estado?.conectado ? VERDE : GRANATE} style={{ maxWidth: 520 }}>
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
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(29,158,117,0.1)', border: `0.5px solid ${COBERTURA_VERDE}`,
            borderRadius: 0, padding: '12px 14px', marginBottom: 16,
          }}>
            <span style={{ color: VERDE, fontSize: 18 }}>✓</span>
            <div>
              <div style={{ fontSize: 13, color: VERDE, fontWeight: 600 }}>Conectado</div>
              {estado.email && <div style={{ fontSize: 11, color: T.mut, marginTop: 2 }}>{estado.email}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/api/oauth/google?action=start" style={btnPrimario}>Reconectar cuenta</a>
            <button
              type="button"
              onClick={desconectar}
              style={{
                fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px',
                textTransform: 'uppercase', padding: '9px 20px', borderRadius: 0,
                background: 'transparent', border: `0.5px solid ${T.brd}`,
                color: T.mut, cursor: 'pointer',
              }}
            >
              Desconectar
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(176,29,35,0.08)', border: `0.5px solid ${GRANATE}`,
            borderRadius: 0, padding: '12px 14px', marginBottom: 16,
          }}>
            <span style={{ color: GRANATE, fontSize: 18 }}>✗</span>
            <div style={{ fontSize: 13, color: GRANATE, fontWeight: 600 }}>No conectado</div>
          </div>
          <p style={{ fontSize: 12, color: T.mut, marginBottom: 18, lineHeight: 1.5 }}>
            Conecta tu cuenta de Google para subir facturas automáticamente a Drive y mantener los PDFs organizados por titular y trimestre.
          </p>
          <a href="/api/oauth/google?action=start" style={btnPrimario}>🔗 Conectar Google Drive</a>
        </>
      )}
      </Papel>
    </PantallaCantera>
  )
}
