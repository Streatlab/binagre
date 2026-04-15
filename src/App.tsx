import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Escandallo from '@/pages/Escandallo'
import Facturacion from '@/pages/Facturacion'
import POS from '@/pages/POS'
import Marcas from '@/pages/Marcas'
import Proveedores from '@/pages/Proveedores'
import Running from '@/pages/Running'

function ProtectedRoute({ children, solo }: { children: React.ReactNode; solo?: string[] }) {
  const { usuario } = useAuth()
  if (!usuario) return <Navigate to="/login" replace />
  if (solo && !solo.includes(usuario.perfil)) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { usuario } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={usuario ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="escandallo" element={<Escandallo />} />
        <Route path="facturacion" element={<ProtectedRoute solo={['admin']}><Facturacion /></ProtectedRoute>} />
        <Route path="pos" element={<ProtectedRoute solo={['admin']}><POS /></ProtectedRoute>} />
        <Route path="marcas" element={<ProtectedRoute solo={['admin']}><Marcas /></ProtectedRoute>} />
        <Route path="proveedores" element={<ProtectedRoute solo={['admin']}><Proveedores /></ProtectedRoute>} />
        <Route path="running" element={<ProtectedRoute solo={['admin']}><Running /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
