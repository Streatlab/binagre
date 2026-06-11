import { createContext, useContext, useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

interface Usuario {
  id: string
  nombre: string
  perfil: 'admin' | 'gestor' | 'cocina'
  rol?: 'admin' | 'gestor' | 'cocina' | null
  empleado_id?: string | null
  google_email?: string | null
}

interface AuthContextType {
  usuario: Usuario | null
  login: (nombre: string, pin: string) => Promise<string | null>
  loginGoogle: () => Promise<string | null>
  logout: () => void
  loadingOAuth: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

const LS_KEY = 'streatlab_user'

function mapRow(data: Record<string, unknown>): Usuario {
  return {
    id: data.id as string,
    nombre: data.nombre as string,
    perfil: ((data.rol ?? data.perfil) as 'admin' | 'gestor' | 'cocina'),
    rol: (data.rol as 'admin' | 'gestor' | 'cocina' | null) ?? null,
    empleado_id: (data.empleado_id as string | null) ?? null,
    google_email: (data.google_email as string | null) ?? null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null } catch { return null }
  })
  const [loadingOAuth, setLoadingOAuth] = useState(false)
  const handledRef = useRef(false)

  useEffect(() => {
    if (usuario) localStorage.setItem(LS_KEY, JSON.stringify(usuario))
    else localStorage.removeItem(LS_KEY)
  }, [usuario])

  // Escucha callback OAuth de Supabase Auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== 'SIGNED_IN' || !session?.user?.email) return
      if (handledRef.current) return
      handledRef.current = true
      setLoadingOAuth(true)

      const email = session.user.email
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, perfil, rol, empleado_id, google_email')
        .eq('google_email', email)
        .single()

      if (error || !data) {
        await supabase.auth.signOut()
        setLoadingOAuth(false)
        handledRef.current = false
        window.dispatchEvent(new CustomEvent('oauth:error', {
          detail: `Cuenta ${email} no autorizada. Pide al administrador que te añada.`
        }))
        return
      }

      setUsuario(mapRow(data as Record<string, unknown>))
      track(data.id as string)
      setLoadingOAuth(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function login(nombre: string, pin: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, perfil, rol, empleado_id, google_email')
      .eq('nombre', nombre)
      .eq('pin', pin)
      .single()

    if (error || !data) return 'Usuario o PIN incorrecto'
    setUsuario(mapRow(data as Record<string, unknown>))
    track(data.id as string)
    return null
  }

  async function loginGoogle(): Promise<string | null> {
    handledRef.current = false
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) return error.message
    return null
  }

  function logout() {
    supabase.auth.signOut().catch(() => {})
    setUsuario(null)
  }

  function track(id: string) {
    const now = new Date().toISOString()
    supabase.from('sesiones_usuario').insert({ usuario_id: id, tipo: 'login' }).then(() => {})
    supabase.from('usuarios').update({ ultima_conexion: now }).eq('id', id).then(() => {})
  }

  return (
    <AuthContext.Provider value={{ usuario, login, loginGoogle, logout, loadingOAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
