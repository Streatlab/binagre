import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { TitularProvider } from '@/contexts/TitularContext'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Escandallo from '@/pages/Escandallo'
import Facturacion from '@/pages/Facturacion'
import Conciliacion from '@/pages/Conciliacion'
import POS from '@/pages/POS'
import Configuracion from '@/pages/Configuracion'
import Placeholder from '@/pages/Placeholder'

// Configuración · Marcas
import MarcasPage from '@/pages/configuracion/marcas/MarcasPage'
import TabMarcas from '@/pages/configuracion/marcas/TabMarcas'
// TabAccesosUber → eliminado FASE 10.5, movido a Plataformas
import TabCanales from '@/pages/configuracion/marcas/TabCanales'

// Configuración · Bancos
import BancosPage from '@/pages/configuracion/bancos/BancosPage'
import CuentasBancarias from '@/pages/configuracion/CuentasBancarias'
import BancosYCuentasPage from '@/pages/configuracion/bancos/BancosYCuentasPage'

// Configuración · Compras
import ComprasPage from '@/pages/configuracion/compras/ComprasPage'
import TabCostes from '@/pages/configuracion/compras/TabCostes'
import TabProveedores from '@/pages/configuracion/compras/TabProveedores'
import TabCategorias from '@/pages/configuracion/compras/TabCategorias'
import TabUnidades from '@/pages/configuracion/compras/TabUnidades'

// Configuración · Usuarios
import UsuariosPage from '@/pages/configuracion/usuarios/UsuariosPage'

// Configuración · Categorías financieras (plan contable)
import CategoriasFinancierasPage from '@/pages/configuracion/categorias/CategoriasPage'

// Configuración · Plataformas
import PlataformasPage from '@/pages/configuracion/plataformas/PlataformasPage'

// Configuración · Cuentas
import CuentasConfigPage from '@/pages/configuracion/cuentas/CuentasPage'

// Configuración · Calendario operativo
import CalendarioPage from '@/pages/configuracion/calendario/CalendarioPage'


// Finanzas
import Objetivos from '@/pages/finanzas/Objetivos'
import Running from '@/pages/finanzas/Running'
import PagosCobros from '@/pages/PagosCobros'
import ImportarPlataformas from '@/pages/finanzas/ImportarPlataformas'
import PuntoEquilibrio from '@/pages/finanzas/PuntoEquilibrio'
import GestionFacturas from '@/pages/finanzas/GestionFacturas'

// Panel Global
import PanelGlobal from '@/pages/PanelGlobal'

// OCR (renombrado desde Importador FASE 7)
import Ocr from '@/pages/Ocr'

// Tareas pendientes (FASE 8)
import Tareas from '@/pages/Tareas'

// Escandallo v2
import EscandalloV2 from '@/pages/EscandalloV2'
// Carta (T-F4-05)
import Carta from '@/pages/Carta'

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
// Cocina FASE 6
import MenuEngineering from '@/pages/cocina/MenuEngineering'
import Recetario from '@/pages/cocina/Recetario'
import RecetaDetalle from '@/pages/cocina/RecetaDetalle'

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

// Inventario (módulo FASE 5)
import Inventario from '@/pages/stock/Inventario'

// Equipo (módulo FASE 3)
import Equipo from '@/pages/Equipo'

// Equipo (legacy placeholder pages)
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

// Informes (módulo nuevo mayo 2026)
import InformesPanel from '@/pages/informes/InformesPanel'
import Destinatarios from '@/pages/informes/Destinatarios'
import Historial from '@/pages/informes/Historial'
import ConfiguracionInformes from '@/pages/informes/ConfiguracionInformes'

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
        <Route path="escandallo-v2" element={<EscandalloV2 />} />
        <Route path="carta" element={<Carta />} />
        <Route path="facturacion" element={<ProtectedRoute solo={['admin']}><Facturacion /></ProtectedRoute>} />
        <Route path="facturacion/conciliacion" element={<ProtectedRoute solo={['admin']}><Conciliacion /></ProtectedRoute>} />
        <Route path="pos" element={<ProtectedRoute solo={['admin']}><POS /></ProtectedRoute>} />

        {/* Configuración · Redirect */}
        <Route path="configuracion" element={<Navigate to="/configuracion/marcas" replace />} />

        {/* Configuración · Legacy (accesible solo por URL directa) */}
        <Route path="configuracion/configuracion" element={<ProtectedRoute solo={['admin']}><Configuracion /></ProtectedRoute>} />

        {/* Configuración · Marcas */}
        <Route path="configuracion/marcas" element={<ProtectedRoute solo={['admin']}><MarcasPage /></ProtectedRoute>}>
          <Route index element={<TabMarcas />} />
          {/* accesos-uber → eliminado FASE 10.5, contenido en Plataformas */}
          <Route path="canales" element={<TabCanales />} />
        </Route>

        {/* Configuración · Bancos (single page con subpills internos) */}
        <Route path="configuracion/bancos" element={<ProtectedRoute solo={['admin']}><BancosPage /></ProtectedRoute>} />

        {/* Configuración · Cuentas bancarias multi-titular */}
        <Route path="configuracion/cuentas-bancarias" element={<ProtectedRoute solo={['admin']}><CuentasBancarias /></ProtectedRoute>} />

        {/* Configuración · Compras */}
        <Route path="configuracion/compras" element={<ProtectedRoute solo={['admin']}><ComprasPage /></ProtectedRoute>}>
          <Route index element={<Navigate to="costes" replace />} />
          <Route path="costes"      element={<TabCostes />} />
          <Route path="proveedores" element={<TabProveedores />} />
          <Route path="categorias"  element={<TabCategorias />} />
          <Route path="unidades"    element={<TabUnidades />} />
        </Route>

        {/* Configuración · Usuarios */}
        <Route path="configuracion/usuarios" element={<ProtectedRoute solo={['admin']}><UsuariosPage /></ProtectedRoute>} />

        {/* Configuración · Bancos y Cuentas (nuevo) */}
        <Route path="configuracion/bancos-y-cuentas/*" element={<ProtectedRoute solo={['admin']}><BancosYCuentasPage /></ProtectedRoute>} />

        {/* Configuración · Categorías financieras (redirect a bancos-y-cuentas) */}
        <Route path="configuracion/categorias-financieras" element={<Navigate to="/configuracion/bancos-y-cuentas" replace />} />

        {/* Configuración · Plataformas */}
        <Route path="configuracion/plataformas" element={<ProtectedRoute solo={['admin']}><PlataformasPage /></ProtectedRoute>} />

        {/* Configuración · Calendario operativo */}
        <Route path="configuracion/calendario" element={<ProtectedRoute solo={['admin']}><CalendarioPage /></ProtectedRoute>} />

        {/* Finanzas */}
        <Route path="finanzas/objetivos" element={<ProtectedRoute solo={['admin']}><Objetivos /></ProtectedRoute>} />
        <Route path="finanzas/running" element={<ProtectedRoute solo={['admin']}><Running /></ProtectedRoute>} />
        <Route path="finanzas/importar-plataformas" element={<ProtectedRoute solo={['admin']}><ImportarPlataformas /></ProtectedRoute>} />
        <Route path="finanzas/punto-equilibrio" element={<ProtectedRoute solo={['admin']}><PuntoEquilibrio /></ProtectedRoute>} />
        {/* Gestión de Facturas (antes Listado de Facturas) */}
        <Route path="finanzas/gestion-facturas" element={<ProtectedRoute solo={['admin']}><GestionFacturas /></ProtectedRoute>} />
        <Route path="finanzas/listado-facturas" element={<Navigate to="/finanzas/gestion-facturas" replace />} />
        <Route path="finanzas/pagos-cobros" element={<ProtectedRoute solo={['admin']}><PagosCobros /></ProtectedRoute>} />

        {/* Panel Global */}
        <Route path="panel" element={<ProtectedRoute solo={['admin']}><PanelGlobal /></ProtectedRoute>} />

        {/* Importador unificado FASE 7 → OCR */}
        <Route path="importador" element={<Navigate to="/ocr" replace />} />
        <Route path="ocr" element={<ProtectedRoute solo={['admin']}><Ocr /></ProtectedRoute>} />

        {/* Tareas pendientes FASE 8 */}
        <Route path="tareas" element={<ProtectedRoute solo={['admin']}><Tareas /></ProtectedRoute>} />

        {/* Informes (módulo nuevo) */}
        <Route path="informes" element={<ProtectedRoute solo={['admin']}><InformesPanel /></ProtectedRoute>} />
        <Route path="informes/destinatarios" element={<ProtectedRoute solo={['admin']}><Destinatarios /></ProtectedRoute>} />
        <Route path="informes/historial" element={<ProtectedRoute solo={['admin']}><Historial /></ProtectedRoute>} />
        <Route path="informes/configuracion" element={<ProtectedRoute solo={['admin']}><ConfiguracionInformes /></ProtectedRoute>} />

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

        {/* Módulo Equipo FASE 3 */}
        <Route path="equipo" element={<ProtectedRoute solo={['admin']}><Equipo /></ProtectedRoute>} />

        {/* Equipo legacy */}
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

        {/* Inventario físico FASE 5 */}
        <Route path="stock/inventario" element={<ProtectedRoute solo={['admin']}><Inventario /></ProtectedRoute>} />

        {/* Cocina */}
        <Route path="cocina/inventario" element={<CocinaInventario />} />
        <Route path="cocina/recetas" element={<CocinaRecetas />} />
        {/* Cocina FASE 6 */}
        <Route path="cocina/menu-engineering" element={<ProtectedRoute solo={['admin']}><MenuEngineering /></ProtectedRoute>} />
        <Route path="cocina/recetario" element={<Recetario />} />
        <Route path="cocina/recetario/:id" element={<RecetaDetalle />} />

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
        <TitularProvider>
          <AppRoutes />
        </TitularProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
