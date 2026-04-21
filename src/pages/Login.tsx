import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const [nombre, setNombre] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length !== 4) { setError('El PIN debe tener 4 dígitos'); return }
    setLoading(true)
    setError('')
    const err = await login(nombre.trim(), pin)
    if (err) setError(err)
    setLoading(false)
  }

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    fontFamily: 'Lexend, sans-serif',
    fontSize: 13,
    backgroundColor: '#1e1e1e',
    border: `1px solid ${focused ? '#e8f442' : '#383838'}`,
    borderRadius: 6,
    padding: '8px 10px',
    color: '#ffffff',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  })

  const [focusNombre, setFocusNombre] = useState(false)
  const [focusPin, setFocusPin] = useState(false)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#111111', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form
        onSubmit={handleSubmit}
        style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: 28, width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, color: '#ffffff', letterSpacing: '3px', textTransform: 'uppercase', margin: 0 }}>
            STREAT LAB
          </h1>
          <p style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#999999', marginTop: 4, marginBottom: 0 }}>
            Acceso ERP
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text"
            placeholder="Nombre"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            onFocus={() => setFocusNombre(true)}
            onBlur={() => setFocusNombre(false)}
            required
            style={inputStyle(focusNombre)}
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="PIN (4 dígitos)"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onFocus={() => setFocusPin(true)}
            onBlur={() => setFocusPin(false)}
            required
            style={{ ...inputStyle(focusPin), letterSpacing: '0.5em', textAlign: 'center' }}
          />
        </div>

        {error && (
          <p style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#cc4444', textAlign: 'center', margin: 0 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 500, backgroundColor: '#e8f442', color: '#111111', border: 'none', borderRadius: 6, padding: '10px 0', width: '100%', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, letterSpacing: '1px', textTransform: 'uppercase', transition: 'filter 0.15s' }}
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
