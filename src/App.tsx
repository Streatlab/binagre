import React, { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { TitularProvider } from '@/contexts/TitularContext'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'

const Dashboard = React.lazy(() => import('@/pages/Dashboard'))
const Escandallo = React.lazy(() => import('@/pages/Escandallo'))
const Facturacion = React.lazy(() => import('@/pages/Facturacion'))
const Conciliacion = React.lazy(() => import('@/pages/Conciliacion'))
const POS = React.lazy(() => import('@/pages/POS'))
const Placeholder = React.lazy(() => import('@/pages/Placeholder'))
const MarcasPage = React.lazy(() => import('@/pages/configuracion/marcas/MarcasPage'))
const TabMarcas = React.lazy(() => import('@/pages/configuracion/marcas/TabMarcas'))
const TabCanales = React.lazy(() => import('@/pages/configuracion/marcas/TabCanales'))
const TabDrive = React.lazy(() => import('@/pages/configuracion/marcas/TabDrive'))

const ReglasPage = React.lazy(() => import('@/pages/configuracion/reglas/ReglasPage'))
const TabReglasIngredientes = React.lazy(() => import('@/pages/configuracion/reglas/TabReglasIngredientes'))
const TabReglasConciliacion = React.lazy(() => import('@/pages/configuracion/reglas/TabReglasConciliacion'))
const TabOcrPlantillas = React.lazy(() => import('@/pages/configuracion/reglas/TabOcrPlantillas'))
const TabCorreoOcr = React.lazy(() => import('@/pages/configuracion/reglas/TabCorreoOcr'))
const TabDiccionarioNif = React.lazy(() => import('@/pages/configuracion/reglas/TabDiccionarioNif'))

const BancosPage = React.lazy(() => import('@/pages/configuracion/bancos/BancosPage'))
const CuentasBancarias = React.lazy(() => import('@/pages/configuracion/CuentasBancarias'))
const BancosYCuentasPage = React.lazy(() => import('@/pages/configuracion/bancos/BancosYCuentasPage'))

const ComprasPage = React.lazy(() => import('@/pages/configuracion/compras/ComprasPage'))
const TabCostes = React.lazy(() => import('@/pages/configuracion/compras/TabCostes'))
const TabProveedores = React.lazy(() => import('@/pages/configuracion/compras/TabProveedores'))
const TabCategorias = React.lazy(() => import('@/pages/configuracion/compras/TabCategorias'))
const TabUnidades = React.lazy(() => import('@/pages/configuracion/compras/TabUnidades'))

const UsuariosPage = React.lazy(() => import('@/pages/configuracion/usuarios/UsuariosPage'))
const CalendarioPage = React.lazy(() => import('@/pages/configuracion/calendario/CalendarioPage'))
const AprendizajesPage = React.lazy(() => import('@/pages/configuracion/AprendizajesPage'))
const CalcNetoAprendizajePage = React.lazy(() => import('@/pages/configuracion/CalcNetoAprendizajePage'))

const Objetivos = React.lazy(() => import('@/pages/finanzas/Objetivos'))
const Running = React.lazy(() => import('@/pages/finanzas/Running'))
const PagosCobros = React.lazy(() => import('@/pages/PagosCobros'))
const ImportarPlataformas = React.lazy(() => import('@/pages/finanzas/ImportarPlataformas'))
const PuntoEquilibrio = React.lazy(() => import('@/pages/finanzas/PuntoEquilibrio'))
const GestionFacturas = React.lazy(() => import('@/pages/finanzas/GestionFacturas'))
const Gestoria = React.lazy(() => import('@/pages/finanzas/Gestoria'))
const EscenariosTesoreria = React.lazy(() => import('@/pages/finanzas/EscenariosTesoreria'))
const Documentacion = React.lazy(() => import('@/pages/finanzas/Documentacion'))
const BandejaPendientes = React.lazy(() => import('@/pages/BandejaPendientes'))
const Ventas = React.lazy(() => import('@/pages/finanzas/Ventas'))

const PanelGlobal = React.lazy(() => import('@/pages/PanelGlobal'))
const PanelDireccion = React.lazy(() => import('@/pages/PanelDireccion'))
const OcrConToast = React.lazy(() => import('@/pages/OcrConToast'))
const Tareas = React.lazy(() => import('@/pages/Tareas'))
const Carta = React.lazy(() => import('@/pages/Carta'))

const RevenueTicketMedio = React.lazy(() => import('@/pages/analytics/RevenueTicketMedio'))
const CogsCosteMp = React.lazy(() => import('@/pages/analytics/CogsCosteMp'))
const MargenCanal = React.lazy(() => import('@/pages/analytics/MargenCanal'))
const VentasMarca = React.lazy(() => import('@/pages/analytics/VentasMarca'))
const RankingProductos = React.lazy(() => import('@/pages/analytics/RankingProductos'))
const PrediccionDemanda = React.lazy(() => import('@/pages/analytics/PrediccionDemanda'))
const ParetoVentas = React.lazy(() => import('@/pages/analytics/ParetoVentas'))

const CocinaRecetas = React.lazy(() => import('@/pages/CocinaRecetas'))
const MenuEngineering = React.lazy(() => import('@/pages/cocina/MenuEngineering'))
const CocinaInventario = React.lazy(() => import('@/pages/cocina/CocinaInventario'))
const Recetario = React.lazy(() => import('@/pages/cocina/Recetario'))
const Esquemas = React.lazy(() => import('@/pages/cocina/Esquemas'))
const Produccion = React.lazy(() => import('@/pages/cocina/Produccion'))
const ListaCompra = React.lazy(() => import('@/pages/cocina/ListaCompra'))
const ParetoIngredientes = React.lazy(() => import('@/pages/cocina/ParetoIngredientes'))
const MenuFamilia = React.lazy(() => import('@/pages/cocina/MenuFamilia'))


const ControlTemperaturas = React.lazy(() => import('@/pages/ops/ControlTemperaturas'))
const ChecklistsAperturaCierre = React.lazy(() => import('@/pages/ops/ChecklistsAperturaCierre'))
const TareasOperativas = React.lazy(() => import('@/pages/ops/TareasOperativas'))
const ManualesOperaciones = React.lazy(() => import('@/pages/ops/ManualesOperaciones'))
const BitacoraNovedades = React.lazy(() => import('@/pages/ops/BitacoraNovedades'))
const LibroEquipos = React.lazy(() => import('@/pages/ops/LibroEquipos'))
const DanosMenaje = React.lazy(() => import('@/pages/ops/DanosMenaje'))
const PedidosMenaje = React.lazy(() => import('@/pages/ops/PedidosMenaje'))
const PulsoCocina = React.lazy(() => import('@/pages/ops/PulsoCocina'))
const BpmCalidad = React.lazy(() => import('@/pages/ops/BpmCalidad'))
const ReunionesEquipo = React.lazy(() => import('@/pages/ops/ReunionesEquipo'))
const RecetasFichasTecnicas = React.lazy(() => import('@/pages/ops/RecetasFichasTecnicas'))
const ReclamacionReembolsos = React.lazy(() => import('@/pages/ops/ReclamacionReembolsos'))

const MarcasSimple = React.lazy(() => import('@/pages/Marcas'))

const Inventario = React.lazy(() => import('@/pages/stock/Inventario'))

const Equipo = React.lazy(() => import('@/pages/Equipo'))
const FichasEmpleados = React.lazy(() => import('@/pages/equipo/FichasEmpleados'))
const Evaluaciones = React.lazy(() => import('@/pages/equipo/Evaluaciones'))
const LlamadosAtencion = React.lazy(() => import('@/pages/equipo/LlamadosAtencion'))
const BeneficiosAntiguedad = React.lazy(() => import('@/pages/equipo/BeneficiosAntiguedad'))
const Celebraciones = React.lazy(() => import('@/pages/equipo/Celebraciones'))
const Dotacion = React.lazy(() => import('@/pages/equipo/Dotacion'))
const OnboardingDigital = React.lazy(() => import('@/pages/equipo/OnboardingDigital'))
const SgSst = React.lazy(() => import('@/pages/equipo/SgSst'))
const MisVentasMetas = React.lazy(() => import('@/pages/equipo/MisVentasMetas'))
const Horarios = React.lazy(() => import('@/pages/equipo/Horarios'))
const ControlPresencia = React.lazy(() => import('@/pages/equipo/ControlPresencia'))
const Organigrama = React.lazy(() => import('@/pages/equipo/Organigrama'))

const ClubFidelizacion = React.lazy(() => import('@/pages/clientes/ClubFidelizacion'))
const CrmTiendaPropia = React.lazy(() => import('@/pages/clientes/CrmTiendaPropia'))
const PanelResenas = React.lazy(() => import('@/pages/clientes/PanelResenas'))
const PlaybookThinkPaladar = React.lazy(() => import('@/pages/clientes/PlaybookThinkPaladar'))

const PosVentas = React.lazy(() => import('@/pages/integraciones/PosVentas'))

const PlanCampanas = React.lazy(() => import('@/pages/marketing/PlanCampanas'))
const RendimientoAdsPromo = React.lazy(() => import('@/pages/marketing/RendimientoAdsPromo'))

const InformesPanel = React.lazy(() => import('@/pages/informes/InformesPanel'))
const ImportarVentas = React.lazy(() => import('@/pages/ImportarVentas'))
const Destinatarios = React.lazy(() => import('@/pages/informes/Destinatarios'))
const Historial = React.lazy(() => import('@/pages/informes/Historial'))
const ConfiguracionInformes = React.lazy(() => import('@/pages/informes/ConfiguracionInformes'))

function LoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#111111', color: '#777777', fontFamily: 'Lexend, sans-serif', fontSize: 14 }}>
      Cargando...
    </div>
  )
}

function ProtectedRoute({ children, solo }: { children: React.ReactNode; solo?: string[] }) {
  const { usuario } = useAuth()
  if (!usuario) return <Navigate to="/login" replace />
  if (solo && !solo.includes(usuario.perfil)) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { usuario } = useAuth()

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={usuario ? <Navigate to="/" replace /> : <Login />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="escandallo" element={<Escandallo />} />
          <Route path="carta" element={<Carta />} />
          <Route path="facturacion" element={<ProtectedRoute solo={['admin']}><Facturacion /></ProtectedRoute>} />
          <Route path="facturacion/conciliacion" element={<ProtectedRoute solo={['admin']}><Conciliacion /></ProtectedRoute>} />
          <Route path="pos" element={<ProtectedRoute solo={['admin']}><POS /></ProtectedRoute>} />

          <Route path="configuracion" element={<Navigate to="/configuracion/integraciones" replace />} />
          {/* Pantalla Configuracion antigua eliminada · redirige a integraciones */}
          <Route path="configuracion/configuracion" element={<Navigate to="/configuracion/integraciones" replace />} />

          <Route path="configuracion/integraciones" element={<ProtectedRoute solo={['admin']}><MarcasPage /></ProtectedRoute>}>
            <Route index element={<TabMarcas />} />
            <Route path="canales" element={<TabCanales />} />
            <Route path="drive" element={<TabDrive />} />
          </Route>
          <Route path="configuracion/marcas" element={<Navigate to="/configuracion/integraciones" replace />} />
          <Route path="configuracion/marcas/canales" element={<Navigate to="/configuracion/integraciones/canales" replace />} />

          <Route path="configuracion/reglas" element={<ProtectedRoute solo={['admin']}><ReglasPage /></ProtectedRoute>}>
            <Route index element={<TabReglasIngredientes />} />
            <Route path="ingredientes" element={<TabReglasIngredientes />} />
            <Route path="conciliacion" element={<TabReglasConciliacion />} />
            <Route path="plantillas" element={<TabOcrPlantillas />} />
            <Route path="diccionario" element={<TabDiccionarioNif />} />
            <Route path="correo" element={<TabCorreoOcr />} />
          </Route>

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
          <Route path="configuracion/calendario" element={<ProtectedRoute solo={['admin']}><CalendarioPage /></ProtectedRoute>} />
          <Route path="configuracion/aprendizajes" element={<ProtectedRoute solo={['admin']}><AprendizajesPage /></ProtectedRoute>} />
          <Route path="configuracion/calcneto-aprendizaje" element={<ProtectedRoute solo={['admin']}><CalcNetoAprendizajePage /></ProtectedRoute>} />

          <Route path="finanzas/objetivos" element={<ProtectedRoute solo={['admin']}><Objetivos /></ProtectedRoute>} />
          <Route path="finanzas/running" element={<ProtectedRoute solo={['admin']}><Running /></ProtectedRoute>} />
          <Route path="finanzas/importar-plataformas" element={<ProtectedRoute solo={['admin']}><ImportarPlataformas /></ProtectedRoute>} />
          <Route path="finanzas/punto-equilibrio" element={<ProtectedRoute solo={['admin']}><PuntoEquilibrio /></ProtectedRoute>} />
          <Route path="finanzas/documentacion" element={<ProtectedRoute solo={['admin']}><Documentacion /></ProtectedRoute>} />
          <Route path="finanzas/pendientes" element={<ProtectedRoute solo={['admin']}><BandejaPendientes /></ProtectedRoute>} />
          <Route path="finanzas/ventas" element={<ProtectedRoute solo={['admin']}><Ventas /></ProtectedRoute>} />
          <Route path="finanzas/gestion-facturas" element={<ProtectedRoute solo={['admin']}><GestionFacturas /></ProtectedRoute>} />
          <Route path="finanzas/listado-facturas" element={<Navigate to="/finanzas/gestion-facturas" replace />} />
          <Route path="finanzas/pagos-cobros" element={<ProtectedRoute solo={['admin']}><PagosCobros /></ProtectedRoute>} />
          <Route path="finanzas/gestoria" element={<ProtectedRoute solo={['admin']}><Gestoria /></ProtectedRoute>} />
          <Route path="finanzas/escenarios-tesoreria" element={<ProtectedRoute solo={['admin']}><EscenariosTesoreria /></ProtectedRoute>} />

          <Route path="panel" element={<ProtectedRoute solo={['admin']}><PanelGlobal /></ProtectedRoute>} />
          <Route path="panel-direccion" element={<ProtectedRoute solo={['admin']}><PanelDireccion /></ProtectedRoute>} />

          <Route path="importador" element={<Navigate to="/ocr" replace />} />
          <Route path="ocr" element={<ProtectedRoute solo={['admin']}><OcrConToast /></ProtectedRoute>} />
          <Route path="importar-ventas" element={<ProtectedRoute solo={['admin']}><ImportarVentas /></ProtectedRoute>} />
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
          <Route path="analytics/pareto-ventas" element={<ProtectedRoute solo={['admin']}><ParetoVentas /></ProtectedRoute>} />

          <Route path="ops/reembolsos" element={<ReclamacionReembolsos />} />
          <Route path="ops/temperaturas" element={<ControlTemperaturas />} />
          <Route path="ops/checklists" element={<ChecklistsAperturaCierre />} />
          <Route path="ops/tareas" element={<TareasOperativas />} />
          <Route path="ops/manuales" element={<ManualesOperaciones />} />
          <Route path="ops/bitacora" element={<BitacoraNovedades />} />
          <Route path="ops/equipos" element={<LibroEquipos />} />
          <Route path="ops/danos" element={<DanosMenaje />} />
          <Route path="ops/pedidos-menaje" element={<PedidosMenaje />} />
          <Route path="ops/pulso" element={<ProtectedRoute solo={['admin']}><PulsoCocina /></ProtectedRoute>} />
          <Route path="ops/bpm" element={<ProtectedRoute solo={['admin']}><BpmCalidad /></ProtectedRoute>} />
          <Route path="ops/reuniones" element={<ProtectedRoute solo={['admin']}><ReunionesEquipo /></ProtectedRoute>} />
          <Route path="ops/recetas" element={<RecetasFichasTecnicas />} />
          <Route path="marcas" element={<ProtectedRoute solo={['admin']}><MarcasSimple /></ProtectedRoute>} />

          <Route path="equipo" element={<ProtectedRoute solo={['admin']}><Equipo /></ProtectedRoute>} />
          <Route path="equipo/organigrama" element={<ProtectedRoute solo={['admin']}><Organigrama /></ProtectedRoute>} />
          <Route path="equipo/empleados" element={<ProtectedRoute solo={['admin']}><FichasEmpleados /></ProtectedRoute>} />
          <Route path="equipo/horarios" element={<ProtectedRoute solo={['admin']}><Horarios /></ProtectedRoute>} />
          <Route path="equipo/presencia" element={<ProtectedRoute solo={['admin']}><ControlPresencia /></ProtectedRoute>} />
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
          <Route path="clientes/playbook-tp" element={<ProtectedRoute solo={['admin']}><PlaybookThinkPaladar /></ProtectedRoute>} />

          <Route path="integraciones/pos" element={<ProtectedRoute solo={['admin']}><PosVentas /></ProtectedRoute>} />

          <Route path="marketing/plan" element={<ProtectedRoute solo={['admin']}><PlanCampanas /></ProtectedRoute>} />
          <Route path="marketing/rendimiento-ads-promo" element={<ProtectedRoute solo={['admin']}><RendimientoAdsPromo /></ProtectedRoute>} />
          <Route path="marketing/:slug" element={<ProtectedRoute solo={['admin']}><Placeholder /></ProtectedRoute>} />

          <Route path="stock/inventario" element={<ProtectedRoute solo={['admin']}><Inventario /></ProtectedRoute>} />

          <Route path="cocina/inventario" element={<ProtectedRoute solo={['admin']}><CocinaInventario /></ProtectedRoute>} />
          <Route path="cocina/recetas" element={<CocinaRecetas />} />
          <Route path="cocina/menu-engineering" element={<ProtectedRoute solo={['admin']}><MenuEngineering /></ProtectedRoute>} />
          <Route path="cocina/recetario" element={<Recetario />} />
          <Route path="cocina/esquemas" element={<Esquemas />} />
          <Route path="cocina/produccion" element={<Produccion />} />
          <Route path="cocina/menu-familia" element={<MenuFamilia />} />
          <Route path="cocina/lista-compra" element={<ListaCompra />} />
          <Route path="cocina/pareto-ingredientes" element={<ProtectedRoute solo={['admin']}><ParetoIngredientes /></ProtectedRoute>} />

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
    </Suspense>
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
