import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

interface Usuario {
  nombre: string
  perfil: 'admin' | 'cocina'
}

interface AuthContextType {
  usuario: Usuario | null
  login: (nombre: string, pin: string) => Promise<string | null>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const saved = localStorage.getItem('streatlab_user')
    return saved ? JSON.parse(saved) : null
  })

  useEffect(() => {
    if (usuario) {
      localStorage.setItem('streatlab_user', JSON.stringify(usuario))
    } else {
      localStorage.removeItem('streatlab_user')
    }
  }, [usuario])

  async function login(nombre: string, pin: string): Promise<string | null> {
    const { supabase } = await import('@/lib/supabase')
    const { data, error } = await supabase
      .from('usuarios')
      .select('nombre, perfil')
      .eq('nombre', nombre)
      .eq('pin', pin)
      .single()

    if (error || !data) return 'Usuario o PIN incorrecto'
    setUsuario({ nombre: data.nombre, perfil: data.perfil })
    return null
  }

  function logout() {
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{ usuario, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
