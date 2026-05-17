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

import MarcasPage from '@/pages/configuracion/marcas/MarcasPage'
import TabMarcas from '@/pages/configuracion/marcas/TabMarcas'
import TabCanales from '@/pages/configuracion/marcas/TabCanales'
import TabDrive from '@/pages/configuracion/marcas/TabDrive'

import BancosPage from '@/pages/configuracion/bancos/BancosPage'
import CuentasBancarias from '@/pages/configuracion/CuentasBancarias'
import BancosYCuentasPage from '@/pages/configuracion/bancos/BancosYCuentasPage'

import ComprasPage from '@/pages/configuracion/compras/ComprasPage'
import TabCostes from '@/pages/configuracion/compras/TabCostes'
import TabProveedores from '@/pages/configuracion/compras/TabProveedores'
import TabCategorias from '@/pages/configuracion/compras/TabCategorias'
import TabUnidades from '@/pages/configuracion/compras/TabUnidades'

import UsuariosPage from '@/pages/configuracion/usuarios/UsuariosPage'
import CategoriasFinancierasPage from '@/pages/configuracion/categorias/CategoriasPage'
import PlataformasPage from '@/pages/configuracion/plataformas/PlataformasPage'
import CuentasConfigPage from '@/pages/configuracion/cuentas/CuentasPage'
import CalendarioPage from '@/pages/configuracion/calendario/CalendarioPage'

import Objetivos from '@/pages/finanzas/Objetivos'
import Running from '@/pages/finanzas/Running'
import Cashflow from '@/pages/finanzas/Cashflow'
import PagosCobros from '@/pages/PagosCobros'
import ImportarPlataformas from '@/pages/finanzas/ImportarPlataformas'
import PuntoEquilibrio from '@/pages/finanzas/PuntoEquilibrio'
import GestionFacturas from '@/pages/finanzas/GestionFacturas'

import PanelGlobal from '@/pages/PanelGlobal'
import Mockup from '@/pages/Mockup'
import MockupBinagrePosthog from '@/pages/mockups/MockupBinagrePosthog'
import MockupHolded from '@/pages/mockups/MockupHolded'
import MockupMarginEdge from '@/pages/mockups/MockupMarginEdge'
import MockupRestaurant365 from '@/pages/mockups/MockupRestaurant365'
import MockupFusion3 from '@/pages/mockups/MockupFusion3'
import MockupFusion3Binagre from '@/pages/mockups/MockupFusion3Binagre'
import MockupBinagreColors from '@/pages/mockups/MockupBinagreColors'
import MockupPosthogBinagre from '@/pages/mockups/MockupPosthogBinagre'
import MockupLymon from '@/pages/mockups/MockupLymon'
import MockupLymonBinagre from '@/pages/mockups/MockupLymonBinagre'
import Ocr from '@/pages/Ocr'
import Tareas from '@/pages/Tareas'
import EscandalloV2 from '@/pages/EscandalloV2'
import Carta from '@/pages/Carta'

import RevenueTicketMedio from '@/pages/analytics/RevenueTicketMedio'
import CogsCosteMp from '@/pages/analytics/CogsCosteMp'
import MargenCanal from '@/pages/analytics/MargenCanal'
import VentasMarca from '@/pages/analytics/VentasMarca'
import RankingProductos from '@/pages/analytics/RankingProductos'
import PrediccionDemanda from '@/pages/analytics/PrediccionDemanda'

import CocinaRecetas from '@/pages/CocinaRecetas'
import CocinaInventario from '@/pages/CocinaInventario'
import MenuEngineering from '@/pages/cocina/MenuEngineering'
import Recetario from '@/pages/cocina/Recetario'
import RecetaDetalle from '@/pages/cocina/RecetaDetalle'

import MarketingEmbudo from '@/pages/MarketingEmbudo'

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

import Inventario from '@/pages/stock/Inventario'

import Equipo from '@/pages/Equipo'
import FichasEmpleados from '@/pages/equipo/FichasEmpleados'
import Evaluaciones from '@/pages/equipo/Evaluaciones'
import LlamadosAtencion from '@/pages/equipo/LlamadosAtencion'
import BeneficiosAntiguedad from '@/pages/equipo/BeneficiosAntiguedad'
import Celebraciones from '@/pages/equipo/Celebraciones'
import Dotacion from '@/pages/equipo/Dotacion'
import OnboardingDigital from '@/pages/equipo/OnboardingDigital'
import SgSst from '@/pages/equipo/SgSst'
import MisVentasMetas from '@/pages/equipo/MisVentasMetas'

import ClubFidelizacion from '@/pages/clientes/ClubFidelizacion'
import CrmTiendaPropia from '@/pages/clientes/CrmTiendaPropia'
import PanelResenas from '@/pages/clientes/PanelResenas'

import PosVentas from '@/pages/integraciones/PosVentas'

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

        <Route path="configuracion" element={<Navigate to="/configuracion/integraciones" replace />} />
        <Route path="configuracion/configuracion" element={<ProtectedRoute solo={['admin']}><Configuracion /></ProtectedRoute>} />

        <Route path="configuracion/integraciones" element={<ProtectedRoute solo={['admin']}><MarcasPage /></ProtectedRoute>}>
          <Route index element={<TabMarcas />} />
          <Route path="canales" element={<TabCanales />} />
          <Route path="drive" element={<TabDrive />} />
        </Route>
        <Route path="configuracion/marcas" element={<Navigate to="/configuracion/integraciones" replace />} />
        <Route path="configuracion/marcas/canales" element={<Navigate to="/configuracion/integraciones/canales" replace />} />

        <Route path="configuracion/bancos" element={<ProtectedRoute solo={['admin']}><BancosPage /></ProtectedRoute>} />
        <Route path="configuracion/cuentas-bancarias" element={<ProtectedRoute solo={['admin']}><CuentasBancarias /></ProtectedRoute>} />
        <Route path="configuracion/bancos-y-cuentas/*" element={<ProtectedRoute solo={['admin']}><BancosYCuentasPage /></ProtectedRoute>} />

        <Route path="configuracion/compras" element={<ProtectedRoute solo={['admin']}><ComprasPage /></ProtectedRoute>}>
          <Route index element={<Navigate to="costes" replace />} />
          <Route path="costes"      element={<TabCostes />} />
          <Route path="proveedores" element={<TabProveedores />} />
          <Route path="categorias"  element={<TabCategorias />} />
          <Route path="unidades"    element={<TabUnidades />} />
        </Route>

        <Route path="configuracion/usuarios" element={<ProtectedRoute solo={['admin']}><UsuariosPage /></ProtectedRoute>} />
        <Route path="configuracion/categorias-financieras" element={<Navigate to="/configuracion/bancos-y-cuentas" replace />} />
        <Route path="configuracion/plataformas" element={<ProtectedRoute solo={['admin']}><PlataformasPage /></ProtectedRoute>} />
        <Route path="configuracion/calendario" element={<ProtectedRoute solo={['admin']}><CalendarioPage /></ProtectedRoute>} />

        <Route path="finanzas/objetivos" element={<ProtectedRoute solo={['admin']}><Objetivos /></ProtectedRoute>} />
        <Route path="finanzas/running" element={<ProtectedRoute solo={['admin']}><Running /></ProtectedRoute>} />
        <Route path="finanzas/cashflow" element={<ProtectedRoute solo={['admin']}><Cashflow /></ProtectedRoute>} />
        <Route path="finanzas/importar-plataformas" element={<ProtectedRoute solo={['admin']}><ImportarPlataformas /></ProtectedRoute>} />
        <Route path="finanzas/punto-equilibrio" element={<ProtectedRoute solo={['admin']}><PuntoEquilibrio /></ProtectedRoute>} />
        <Route path="finanzas/gestion-facturas" element={<ProtectedRoute solo={['admin']}><GestionFacturas /></ProtectedRoute>} />
        <Route path="finanzas/listado-facturas" element={<Navigate to="/finanzas/gestion-facturas" replace />} />
        <Route path="finanzas/pagos-cobros" element={<ProtectedRoute solo={['admin']}><PagosCobros /></ProtectedRoute>} />

        <Route path="panel" element={<ProtectedRoute solo={['admin']}><PanelGlobal /></ProtectedRoute>} />

        {/* Mockup desplegable con 10 submódulos */}
        <Route path="mockup" element={<Navigate to="/mockup/lymon-binagre" replace />} />
        <Route path="mockup/binagre-posthog" element={<ProtectedRoute solo={['admin']}><MockupBinagrePosthog /></ProtectedRoute>} />
        <Route path="mockup/holded" element={<ProtectedRoute solo={['admin']}><MockupHolded /></ProtectedRoute>} />
        <Route path="mockup/marginedge" element={<ProtectedRoute solo={['admin']}><MockupMarginEdge /></ProtectedRoute>} />
        <Route path="mockup/restaurant365" element={<ProtectedRoute solo={['admin']}><MockupRestaurant365 /></ProtectedRoute>} />
        <Route path="mockup/fusion3" element={<ProtectedRoute solo={['admin']}><MockupFusion3 /></ProtectedRoute>} />
        <Route path="mockup/fusion3-binagre" element={<ProtectedRoute solo={['admin']}><MockupFusion3Binagre /></ProtectedRoute>} />
        <Route path="mockup/binagre-colors" element={<ProtectedRoute solo={['admin']}><MockupBinagreColors /></ProtectedRoute>} />
        <Route path="mockup/posthog-binagre" element={<ProtectedRoute solo={['admin']}><MockupPosthogBinagre /></ProtectedRoute>} />
        <Route path="mockup/lymon" element={<ProtectedRoute solo={['admin']}><MockupLymon /></ProtectedRoute>} />
        <Route path="mockup/lymon-binagre" element={<ProtectedRoute solo={['admin']}><MockupLymonBinagre /></ProtectedRoute>} />
        {/* Compatibilidad con la ruta antigua /mockup */}
        <Route path="mockup-old" element={<ProtectedRoute solo={['admin']}><Mockup /></ProtectedRoute>} />

        <Route path="importador" element={<Navigate to="/ocr" replace />} />
        <Route path="ocr" element={<ProtectedRoute solo={['admin']}><Ocr /></ProtectedRoute>} />
        <Route path="tareas" element={<ProtectedRoute solo={['admin']}><Tareas /></ProtectedRoute>} />

        <Route path="informes" element={<ProtectedRoute solo={['admin']}><InformesPanel /></ProtectedRoute>} />
        <Route path="informes/destinatarios" element={<ProtectedRoute solo={['admin']}><Destinatarios /></ProtectedRoute>} />
        <Route path="informes/historial" element={<ProtectedRoute solo={['admin']}><Historial /></ProtectedRoute>} />
        <Route path="informes/configuracion" element={<ProtectedRoute solo={['admin']}><ConfiguracionInformes /></ProtectedRoute>} />

        <Route path="analytics/revenue" element={<ProtectedRoute solo={['admin']}><RevenueTicketMedio /></ProtectedRoute>} />
        <Route path="analytics/cogs" element={<ProtectedRoute solo={['admin']}><CogsCosteMp /></ProtectedRoute>} />
        <Route path="analytics/margen" element={<ProtectedRoute solo={['admin']}><MargenCanal /></ProtectedRoute>} />
        <Route path="analytics/ventas-marca" element={<ProtectedRoute solo={['admin']}><VentasMarca /></ProtectedRoute>} />
        <Route path="analytics/ranking" element={<ProtectedRoute solo={['admin']}><RankingProductos /></ProtectedRoute>} />
        <Route path="analytics/demanda" element={<ProtectedRoute solo={['admin']}><PrediccionDemanda /></ProtectedRoute>} />

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

        <Route path="equipo" element={<ProtectedRoute solo={['admin']}><Equipo /></ProtectedRoute>} />
        <Route path="equipo/empleados" element={<ProtectedRoute solo={['admin']}><FichasEmpleados /></ProtectedRoute>} />
        <Route path="equipo/evaluaciones" element={<ProtectedRoute solo={['admin']}><Evaluaciones /></ProtectedRoute>} />
        <Route path="equipo/llamados" element={<ProtectedRoute solo={['admin']}><LlamadosAtencion /></ProtectedRoute>} />
        <Route path="equipo/antiguedad" element={<ProtectedRoute solo={['admin']}><BeneficiosAntiguedad /></ProtectedRoute>} />
        <Route path="equipo/celebraciones" element={<ProtectedRoute solo={['admin']}><Celebraciones /></ProtectedRoute>} />
        <Route path="equipo/dotacion" element={<ProtectedRoute solo={['admin']}><Dotacion /></ProtectedRoute>} />
        <Route path="equipo/onboarding" element={<ProtectedRoute solo={['admin']}><OnboardingDigital /></ProtectedRoute>} />
        <Route path="equipo/sgsst" element={<ProtectedRoute solo={['admin']}><SgSst /></ProtectedRoute>} />
        <Route path="equipo/metas" element={<ProtectedRoute solo={['admin']}><MisVentasMetas /></ProtectedRoute>} />

        <Route path="clientes/club" element={<ProtectedRoute solo={['admin']}><ClubFidelizacion /></ProtectedRoute>} />
        <Route path="clientes/crm" element={<ProtectedRoute solo={['admin']}><CrmTiendaPropia /></ProtectedRoute>} />
        <Route path="clientes/resenas" element={<ProtectedRoute solo={['admin']}><PanelResenas /></ProtectedRoute>} />

        <Route path="integraciones/pos" element={<ProtectedRoute solo={['admin']}><PosVentas /></ProtectedRoute>} />

        <Route path="marketing/embudo" element={<MarketingEmbudo />} />
        <Route path="marketing/:slug" element={<ProtectedRoute solo={['admin']}><Placeholder /></ProtectedRoute>} />

        <Route path="stock/inventario" element={<ProtectedRoute solo={['admin']}><Inventario /></ProtectedRoute>} />

        <Route path="cocina/inventario" element={<CocinaInventario />} />
        <Route path="cocina/recetas" element={<CocinaRecetas />} />
        <Route path="cocina/menu-engineering" element={<ProtectedRoute solo={['admin']}><MenuEngineering /></ProtectedRoute>} />
        <Route path="cocina/recetario" element={<Recetario />} />
        <Route path="cocina/recetario/:id" element={<RecetaDetalle />} />

        <Route path="analytics/:slug" element={<ProtectedRoute solo={['admin']}><Placeholder /></ProtectedRoute>} />
        <Route path="ops/:slug" element={<Placeholder />} />
        <Route path="equipo/:slug" element={<ProtectedRoute solo={['admin']}><Placeholder /></ProtectedRoute>} />
        <Route path="clientes/:slug" element={<ProtectedRoute solo={['admin']}><Placeholder /></ProtectedRoute>} />
        <Route path="integraciones/:slug" element={<ProtectedRoute solo={['admin']}><Placeholder /></ProtectedRoute>} />
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
