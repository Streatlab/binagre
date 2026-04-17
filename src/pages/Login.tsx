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
    if (pin.length !== 4) {
      setError('El PIN debe tener 4 dígitos')
      return
    }
    setLoading(true)
    setError('')
    const err = await login(nombre.trim(), pin)
    if (err) setError(err)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4 font-sans">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xs bg-[#484f66] border border-border rounded-xl p-6 space-y-5"
      >
        <div className="text-center">
          <h1 className="text-[#f0f0ff] font-bold text-2xl tracking-tight">Streat Lab</h1>
          <p className="text-[#c8d0e8] text-sm mt-1">Acceso ERP</p>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Nombre"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            required
            className="w-full bg-base border border-border rounded-lg px-3 py-2.5 text-sm text-[#f0f0ff] placeholder-neutral-600 focus:outline-none focus:border-accent transition-colors"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="PIN (4 dígitos)"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            required
            className="w-full bg-base border border-border rounded-lg px-3 py-2.5 text-sm text-[#f0f0ff] placeholder-neutral-600 focus:outline-none focus:border-accent transition-colors tracking-[0.5em] text-center"
          />
        </div>

        {error && (
          <p className="text-[#dc2626] text-xs text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-accent text-base font-semibold rounded-lg py-2.5 text-sm hover:brightness-110 transition disabled:opacity-50"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
