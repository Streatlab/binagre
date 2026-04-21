import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useAuth } from '@/context/AuthContext'

const BG = '#f5f3ef'
const CARD = '#ffffff'
const BRD = '#d0c8bc'
const PRI = '#111111'
const MUT = '#7a8090'
const RED = '#B01D23'
const FONT_BODY = 'Lexend, sans-serif'
const FONT_HEADING = 'Oswald, sans-serif'

export default function Login() {
  const { login } = useAuth()
  const [nombre, setNombre] = useState('')
  const [pin, setPin] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focusNombre, setFocusNombre] = useState(false)
  const [focusPinIdx, setFocusPinIdx] = useState<number | null>(null)
  const pinRefs = useRef<(HTMLInputElement | null)[]>([])

  const pinValue = pin.join('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pinValue.length !== 4) { setError('El PIN debe tener 4 dígitos'); return }
    setLoading(true)
    setError('')
    const err = await login(nombre.trim(), pinValue)
    if (err) setError(err)
    setLoading(false)
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
      <form
        onSubmit={handleSubmit}
        style={{ backgroundColor: CARD, border: `0.5px solid ${BRD}`, borderRadius: 16, padding: 32, width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 20 }}
      >
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
            color: '#ffffff',
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
  )
}
