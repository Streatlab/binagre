import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Escandallo from '@/pages/Escandallo'
import Facturacion from '@/pages/Facturacion'
import Conciliacion from '@/pages/Conciliacion'
import POS from '@/pages/POS'
import Marcas from '@/pages/Marcas'
import Running from '@/pages/Running'
import Configuracion from '@/pages/Configuracion'
import Placeholder from '@/pages/Placeholder'

// Finanzas
import Objetivos from '@/pages/finanzas/Objetivos'

// Analytics
import RevenueTicketMedio from '@/pages/analytics/RevenueTicketMedio'
import CogsCosteMp from '@/pages/analytics/CogsCosteMp'
import MargenCanal from '@/pages/analytics/MargenCanal'
import VentasMarca from '@/pages/analytics/VentasMarca'
import RankingProductos from '@/pages/analytics/RankingProductos'
import PrediccionDemanda from '@/pages/analytics/PrediccionDemanda'

// Cocina
import CocinaRecetas from '@/pages/CocinaRecetas'
import CocinaInventario from '@/pages/CocinaInventario'

// Marketing
import MarketingEmbudo from '@/pages/MarketingEmbudo'

// Operaciones
import ControlTemperaturas from '@/pages/ops/ControlTemperaturas'
import ChecklistsAperturaCierre from '@/pages/ops/ChecklistsAperturaCierre'
import TareasOperativas from '@/pages/ops/TareasOperativas'
import BitacoraNovedades from '@/pages/ops/BitacoraNovedades'
import LibroEquipos from '@/pages/ops/LibroEquipos'
import DanosMenaje from '@/pages/ops/DanosMenaje'
import PedidosMenaje from '@/pages/ops/PedidosMenaje'
import PulsoCocina from '@/pages/ops/PulsoCocina'
import BpmCalidad from '@/pages/ops/BpmCalidad'
import ReunionesEquipo from '@/pages/ops/ReunionesEquipo'
import RecetasFichasTecnicas from '@/pages/ops/RecetasFichasTecnicas'
import ReclamacionReembolsos from '@/pages/ops/ReclamacionReembolsos'

// Equipo
import FichasEmpleados from '@/pages/equipo/FichasEmpleados'
import Evaluaciones from '@/pages/equipo/Evaluaciones'
import LlamadosAtencion from '@/pages/equipo/LlamadosAtencion'
import BeneficiosAntiguedad from '@/pages/equipo/BeneficiosAntiguedad'
import Celebraciones from '@/pages/equipo/Celebraciones'
import Dotacion from '@/pages/equipo/Dotacion'
import OnboardingDigital from '@/pages/equipo/OnboardingDigital'
import SgSst from '@/pages/equipo/SgSst'
import MisVentasMetas from '@/pages/equipo/MisVentasMetas'

// Clientes
import ClubFidelizacion from '@/pages/clientes/ClubFidelizacion'
import CrmTiendaPropia from '@/pages/clientes/CrmTiendaPropia'
import PanelResenas from '@/pages/clientes/PanelResenas'

// Integraciones
import PosVentas from '@/pages/integraciones/PosVentas'

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
        <Route path="facturacion/conciliacion" element={<ProtectedRoute solo={['admin']}><Conciliacion /></ProtectedRoute>} />
        <Route path="pos" element={<ProtectedRoute solo={['admin']}><POS /></ProtectedRoute>} />
        <Route path="marcas" element={<ProtectedRoute solo={['admin']}><Marcas /></ProtectedRoute>} />
        <Route path="running" element={<ProtectedRoute solo={['admin']}><Running /></ProtectedRoute>} />
        <Route path="configuracion" element={<ProtectedRoute solo={['admin']}><Configuracion /></ProtectedRoute>} />

        {/* Finanzas */}
        <Route path="finanzas/objetivos" element={<ProtectedRoute solo={['admin']}><Objetivos /></ProtectedRoute>} />

        {/* Analytics */}
        <Route path="analytics/revenue" element={<ProtectedRoute solo={['admin']}><RevenueTicketMedio /></ProtectedRoute>} />
        <Route path="analytics/cogs" element={<ProtectedRoute solo={['admin']}><CogsCosteMp /></ProtectedRoute>} />
        <Route path="analytics/margen" element={<ProtectedRoute solo={['admin']}><MargenCanal /></ProtectedRoute>} />
        <Route path="analytics/ventas-marca" element={<ProtectedRoute solo={['admin']}><VentasMarca /></ProtectedRoute>} />
        <Route path="analytics/ranking" element={<ProtectedRoute solo={['admin']}><RankingProductos /></ProtectedRoute>} />
        <Route path="analytics/demanda" element={<ProtectedRoute solo={['admin']}><PrediccionDemanda /></ProtectedRoute>} />

        {/* Operaciones */}
        <Route path="ops/reembolsos" element={<ReclamacionReembolsos />} />
        <Route path="ops/temperaturas" element={<ControlTemperaturas />} />
        <Route path="ops/checklists" element={<ChecklistsAperturaCierre />} />
        <Route path="ops/tareas" element={<TareasOperativas />} />
        <Route path="ops/bitacora" element={<BitacoraNovedades />} />
        <Route path="ops/equipos" element={<LibroEquipos />} />
        <Route path="ops/danos" element={<DanosMenaje />} />
        <Route path="ops/pedidos-menaje" element={<PedidosMenaje />} />
        <Route path="ops/pulso" element={<ProtectedRoute solo={['admin']}><PulsoCocina /></ProtectedRoute>} />
        <Route path="ops/bpm" element={<ProtectedRoute solo={['admin']}><BpmCalidad /></ProtectedRoute>} />
        <Route path="ops/reuniones" element={<ProtectedRoute solo={['admin']}><ReunionesEquipo /></ProtectedRoute>} />
        <Route path="ops/recetas" element={<RecetasFichasTecnicas />} />

        {/* Equipo */}
        <Route path="equipo/empleados" element={<ProtectedRoute solo={['admin']}><FichasEmpleados /></ProtectedRoute>} />
        <Route path="equipo/evaluaciones" element={<ProtectedRoute solo={['admin']}><Evaluaciones /></ProtectedRoute>} />
        <Route path="equipo/llamados" element={<ProtectedRoute solo={['admin']}><LlamadosAtencion /></ProtectedRoute>} />
        <Route path="equipo/antiguedad" element={<ProtectedRoute solo={['admin']}><BeneficiosAntiguedad /></ProtectedRoute>} />
        <Route path="equipo/celebraciones" element={<ProtectedRoute solo={['admin']}><Celebraciones /></ProtectedRoute>} />
        <Route path="equipo/dotacion" element={<ProtectedRoute solo={['admin']}><Dotacion /></ProtectedRoute>} />
        <Route path="equipo/onboarding" element={<ProtectedRoute solo={['admin']}><OnboardingDigital /></ProtectedRoute>} />
        <Route path="equipo/sgsst" element={<ProtectedRoute solo={['admin']}><SgSst /></ProtectedRoute>} />
        <Route path="equipo/metas" element={<ProtectedRoute solo={['admin']}><MisVentasMetas /></ProtectedRoute>} />

        {/* Clientes */}
        <Route path="clientes/club" element={<ProtectedRoute solo={['admin']}><ClubFidelizacion /></ProtectedRoute>} />
        <Route path="clientes/crm" element={<ProtectedRoute solo={['admin']}><CrmTiendaPropia /></ProtectedRoute>} />
        <Route path="clientes/resenas" element={<ProtectedRoute solo={['admin']}><PanelResenas /></ProtectedRoute>} />

        {/* Integraciones */}
        <Route path="integraciones/pos" element={<ProtectedRoute solo={['admin']}><PosVentas /></ProtectedRoute>} />

        {/* Marketing */}
        <Route path="marketing/embudo" element={<MarketingEmbudo />} />
        <Route path="marketing/:slug" element={<ProtectedRoute solo={['admin']}><Placeholder /></ProtectedRoute>} />

        {/* Catch-all */}
        <Route path="analytics/:slug" element={<ProtectedRoute solo={['admin']}><Placeholder /></ProtectedRoute>} />
        <Route path="ops/:slug" element={<Placeholder />} />
        <Route path="equipo/:slug" element={<ProtectedRoute solo={['admin']}><Placeholder /></ProtectedRoute>} />
        <Route path="clientes/:slug" element={<ProtectedRoute solo={['admin']}><Placeholder /></ProtectedRoute>} />
        <Route path="integraciones/:slug" element={<ProtectedRoute solo={['admin']}><Placeholder /></ProtectedRoute>} />

        {/* Cocina */}
        <Route path="cocina/inventario" element={<CocinaInventario />} />
        <Route path="cocina/recetas" element={<CocinaRecetas />} />

        {/* Nuevas secciones acordeón */}
        <Route path="finanzas/:slug" element={<ProtectedRoute solo={['admin']}><Placeholder /></ProtectedRoute>} />
        <Route path="cocina/:slug" element={<Placeholder />} />
        <Route path="stock/:slug" element={<ProtectedRoute solo={['admin']}><Placeholder /></ProtectedRoute>} />
        <Route path="pos/:slug" element={<ProtectedRoute solo={['admin']}><Placeholder /></ProtectedRoute>} />
        <Route path="marcas/:slug" element={<ProtectedRoute solo={['admin']}><Placeholder /></ProtectedRoute>} />
        <Route path="informes/:slug" element={<ProtectedRoute solo={['admin']}><Placeholder /></ProtectedRoute>} />
        <Route path="configuracion/:slug" element={<ProtectedRoute solo={['admin']}><Placeholder /></ProtectedRoute>} />
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
