import { useRef, useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useAuth } from '@/context/AuthContext'

const BG = 'var(--sl-app)'
const CARD = 'var(--sl-card)'
const BRD = 'var(--sl-border)'
const PRI = 'var(--sl-text-primary)'
const MUT = 'var(--sl-text-muted)'
const RED = '#B01D23'
const FONT_BODY = 'Lexend, sans-serif'
const FONT_HEADING = 'Oswald, sans-serif'

export default function Login() {
  const { login, loginGoogle, loadingOAuth } = useAuth()
  const [nombre, setNombre] = useState('')
  const [pin, setPin] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focusNombre, setFocusNombre] = useState(false)
  const [focusPinIdx, setFocusPinIdx] = useState<number | null>(null)
  const pinRefs = useRef<(HTMLInputElement | null)[]>([])

  const pinValue = pin.join('')

  // Captura errores de OAuth (cuenta no autorizada)
  useEffect(() => {
    const h = (e: Event) => setError((e as CustomEvent<string>).detail)
    window.addEventListener('oauth:error', h)
    return () => window.removeEventListener('oauth:error', h)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pinValue.length !== 4) { setError('El PIN debe tener 4 dígitos'); return }
    setLoading(true)
    setError('')
    const err = await login(nombre.trim(), pinValue)
    if (err) setError(err)
    setLoading(false)
  }

  async function handleGoogle() {
    setError('')
    const err = await loginGoogle()
    if (err) setError(err)
  }

  const handlePinChange = (idx: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...pin]
    next[idx] = digit
    setPin(next)
    if (digit && idx < 3) pinRefs.current[idx + 1]?.focus()
  }

  const handlePinKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[idx] && idx > 0) {
      pinRefs.current[idx - 1]?.focus()
    }
  }

  const labelStyle: CSSProperties = {
    fontFamily: FONT_HEADING,
    fontSize: 10,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: MUT,
    marginBottom: 6,
    display: 'block',
  }

  const inputStyle = (focused: boolean): CSSProperties => ({
    fontFamily: FONT_BODY,
    fontSize: 13,
    backgroundColor: CARD,
    border: `1px solid ${focused ? RED : BRD}`,
    borderRadius: 8,
    padding: '10px 12px',
    color: PRI,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  })

  const pinInputStyle = (focused: boolean): CSSProperties => ({
    fontFamily: FONT_BODY,
    fontSize: 20,
    backgroundColor: CARD,
    border: `1px solid ${focused ? RED : BRD}`,
    borderRadius: 8,
    padding: '10px 0',
    color: PRI,
    outline: 'none',
    width: '100%',
    textAlign: 'center',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  })

  return (
    <div style={{ minHeight: '100vh', backgroundColor: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ backgroundColor: CARD, border: `0.5px solid ${BRD}`, borderRadius: 16, padding: 32, width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <img
            src="/data/STREAT LAB LOGO-04.jpg"
            alt="STREAT LAB"
            style={{ maxWidth: 180, width: '100%', height: 'auto', display: 'block', margin: '0 auto' }}
          />
          <p style={{ fontFamily: FONT_HEADING, fontSize: 10, color: MUT, letterSpacing: '2px', textTransform: 'uppercase', marginTop: 12, marginBottom: 0 }}>
            Acceso ERP
          </p>
        </div>

        {/* Botón Google */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={loadingOAuth}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '11px 14px', borderRadius: 8, border: `1px solid ${BRD}`,
            background: CARD, cursor: loadingOAuth ? 'not-allowed' : 'pointer',
            fontFamily: FONT_BODY, fontSize: 13, color: PRI,
            opacity: loadingOAuth ? 0.6 : 1, transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => { if (!loadingOAuth) (e.currentTarget as HTMLButtonElement).style.borderColor = '#4285F4' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = BRD }}
        >
          {loadingOAuth ? (
            <span style={{ fontSize: 13, color: MUT }}>Verificando cuenta…</span>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.174 0 7.547 0 9s.348 2.826.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Entrar con Google
            </>
          )}
        </button>

        {/* Divisor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 1, background: BRD }} />
          <span style={{ fontFamily: FONT_HEADING, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: MUT }}>o con PIN</span>
          <div style={{ flex: 1, height: 1, background: BRD }} />
        </div>

        {/* Formulario PIN */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Usuario</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              onFocus={() => setFocusNombre(true)}
              onBlur={() => setFocusNombre(false)}
              required
              style={inputStyle(focusNombre)}
            />
          </div>

          <div>
            <label style={labelStyle}>PIN</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {pin.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => { pinRefs.current[idx] = el }}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handlePinChange(idx, e.target.value)}
                  onKeyDown={e => handlePinKeyDown(idx, e)}
                  onFocus={() => setFocusPinIdx(idx)}
                  onBlur={() => setFocusPinIdx(null)}
                  style={pinInputStyle(focusPinIdx === idx)}
                />
              ))}
            </div>
          </div>

          {error && (
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: RED, textAlign: 'center', margin: 0 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              fontFamily: FONT_HEADING,
              fontSize: 14,
              fontWeight: 700,
              backgroundColor: RED,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '12px 0',
              width: '100%',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              transition: 'filter 0.15s',
            }}
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
