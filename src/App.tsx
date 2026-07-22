import { GRIS, INK } from '@/styles/neobrutal'
import React, { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { TitularProvider } from '@/contexts/TitularContext'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'

const Home = React.lazy(() => import('@/pages/Home'))
const PapeleoPage = React.lazy(() => import('@/pages/finanzas/PapeleoPage'))
const RentabilidadPage = React.lazy(() => import('@/pages/finanzas/RentabilidadPage'))
const Proveedores = React.lazy(() => import('@/pages/Proveedores'))
const POS = React.lazy(() => import('@/pages/POS'))
const Placeholder = React.lazy(() => import('@/pages/Placeholder'))
const MarcasPage = React.lazy(() => import('@/pages/configuracion/marcas/MarcasPage'))
const TabMarcas = React.lazy(() => import('@/pages/configuracion/marcas/TabMarcas'))
const TabCanales = React.lazy(() => import('@/pages/configuracion/marcas/TabCanales'))
const TabDrive = React.lazy(() => import('@/pages/configuracion/marcas/TabDrive'))

// A1 · Mapeo de marcas (venta ciega de Glovo / Just Eat)
const MapeoMarcas = React.lazy(() => import('@/pages/configuracion/MapeoMarcas'))
// A2 · Coste por plato (enlaza venta con receta costeada)
const CostePlato = React.lazy(() => import('@/pages/cocina/CostePlato'))


// Pantallas con interruptor NEO / SL: la ruta decide cual se ve
const EscandalloSwitch = React.lazy(() => import('@/pages/switch/EscandalloSwitch'))
const PanelSwitch = React.lazy(() => import('@/pages/switch/PanelSwitch'))

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

const VentasPage = React.lazy(() => import('@/pages/finanzas/VentasPage'))
const ResultadosPage = React.lazy(() => import('@/pages/finanzas/ResultadosPage'))
const TesoreriaPage = React.lazy(() => import('@/pages/finanzas/TesoreriaPage'))
const BandejaPendientes = React.lazy(() => import('@/pages/BandejaPendientes'))

const PanelAlertas = React.lazy(() => import('@/pages/finanzas/PanelAlertas'))

const PanelDireccion = React.lazy(() => import('@/pages/PanelDireccion'))
const Tareas = React.lazy(() => import('@/pages/Tareas'))
const Carta = React.lazy(() => import('@/pages/Carta'))

const RevenueTicketMedio = React.lazy(() => import('@/pages/analytics/RevenueTicketMedio'))
const MargenCanal = React.lazy(() => import('@/pages/analytics/MargenCanal'))
const VentasMarca = React.lazy(() => import('@/pages/analytics/VentasMarca'))
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
const Horarios = React.lazy(() => import('@/pages/equipo/Horarios'))
const ControlPresencia = React.lazy(() => import('@/pages/equipo/ControlPresencia'))
const Organigrama = React.lazy(() => import('@/pages/equipo/Organigrama'))

const ClubFidelizacion = React.lazy(() => import('@/pages/clientes/ClubFidelizacion'))
const CrmTiendaPropia = React.lazy(() => import('@/pages/clientes/CrmTiendaPropia'))
const PanelResenas = React.lazy(() => import('@/pages/clientes/PanelResenas'))
const PlaybookThinkPaladar = React.lazy(() => import('@/pages/clientes/PlaybookThinkPaladar'))
const Benchmark = React.lazy(() => import('@/pages/clientes/Benchmark'))

const PlanCampanas = React.lazy(() => import('@/pages/marketing/PlanCampanas'))
const RendimientoAdsPromo = React.lazy(() => import('@/pages/marketing/RendimientoAdsPromo'))
const PanelMkt = React.lazy(() => import('@/pages/marketing/PanelMkt'))

const InformesPanel = React.lazy(() => import('@/pages/informes/InformesPanel'))
const ImportarVentas = React.lazy(() => import('@/pages/ImportarVentas'))
const Destinatarios = React.lazy(() => import('@/pages/informes/Destinatarios'))
const Historial = React.lazy(() => import('@/pages/informes/Historial'))
const ConfiguracionInformes = React.lazy(() => import('@/pages/informes/ConfiguracionInformes'))

function LoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: INK, color: GRIS, fontFamily: 'Lexend, sans-serif', fontSize: 14 }}>
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
          <Route index element={<Home />} />
          <Route path="escandallo" element={<EscandalloSwitch />} />
          {/* ── D·Tanda 3 · Carta ← Carta + Menú Familia (facturación permanece en Finanzas·Papeleo) ── */}
          <Route path="carta" element={<TabsContainer title="Carta" tabs={[
            { to: '.', label: 'Carta', end: true },
            { to: 'menu-familia', label: 'Menú Familia' },
          ]} />}>
            <Route index element={<Carta />} />
            <Route path="menu-familia" element={<MenuFamilia />} />
          </Route>
          <Route path="finanzas/papeleo" element={<ProtectedRoute solo={['admin']}><PapeleoPage /></ProtectedRoute>} />
          <Route path="facturacion" element={<Navigate to="/finanzas/papeleo?tab=facturacion" replace />} />
          <Route path="facturacion/conciliacion" element={<Navigate to="/finanzas/papeleo?tab=conciliacion" replace />} />
          <Route path="pos" element={<ProtectedRoute solo={['admin']}><POS /></ProtectedRoute>} />


          <Route path="configuracion" element={<Navigate to="/configuracion/integraciones" replace />} />
          {/* Pantalla Configuracion antigua eliminada · redirige a integraciones */}
          <Route path="configuracion/configuracion" element={<Navigate to="/configuracion/integraciones" replace />} />

          {/* A1 · Mapeo de marcas: asigna marca a la venta ciega de Glovo / Just Eat */}
          <Route path="configuracion/mapeo-marcas" element={<ProtectedRoute solo={['admin']}><MapeoMarcas /></ProtectedRoute>} />

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

          <Route path="finanzas/ventas-panel" element={<ProtectedRoute solo={['admin']}><VentasPage /></ProtectedRoute>} />
          <Route path="finanzas/objetivos" element={<Navigate to="/finanzas/ventas-panel?tab=objetivos" replace />} />
          <Route path="finanzas/resultados" element={<ProtectedRoute solo={['admin']}><ResultadosPage /></ProtectedRoute>} />
          <Route path="finanzas/running" element={<Navigate to="/finanzas/resultados?tab=running" replace />} />
          <Route path="finanzas/importar-plataformas" element={<Navigate to="/finanzas/papeleo?tab=importar" replace />} />
          <Route path="finanzas/rentabilidad" element={<ProtectedRoute solo={['admin']}><RentabilidadPage /></ProtectedRoute>} />
          <Route path="finanzas/punto-equilibrio" element={<Navigate to="/finanzas/rentabilidad?tab=equilibrio" replace />} />
          <Route path="finanzas/documentacion" element={<Navigate to="/finanzas/papeleo?tab=bandeja" replace />} />
          <Route path="finanzas/pendientes" element={<ProtectedRoute solo={['admin']}><BandejaPendientes /></ProtectedRoute>} />
          <Route path="finanzas/ventas" element={<Navigate to="/finanzas/ventas-panel?tab=ventas" replace />} />
          <Route path="finanzas/gestion-facturas" element={<Navigate to="/finanzas/papeleo?tab=gestion" replace />} />
          <Route path="finanzas/listado-facturas" element={<Navigate to="/finanzas/papeleo?tab=gestion" replace />} />
          <Route path="finanzas/tesoreria" element={<ProtectedRoute solo={['admin']}><TesoreriaPage /></ProtectedRoute>} />
          <Route path="finanzas/pagos-cobros" element={<Navigate to="/finanzas/tesoreria?tab=calendario" replace />} />
          <Route path="finanzas/gestoria" element={<Navigate to="/finanzas/papeleo?tab=gestoria" replace />} />
          <Route path="finanzas/escenarios-tesoreria" element={<Navigate to="/finanzas/tesoreria?tab=escenarios" replace />} />

          <Route path="finanzas/tesoreria-13-semanas" element={<Navigate to="/finanzas/tesoreria?tab=13semanas" replace />} />
          <Route path="finanzas/fondo-maniobra" element={<Navigate to="/finanzas/tesoreria?tab=salud" replace />} />
          <Route path="finanzas/estados-financieros" element={<Navigate to="/finanzas/resultados?tab=estados" replace />} />
          <Route path="finanzas/break-even" element={<Navigate to="/finanzas/rentabilidad?tab=marca-canal" replace />} />
          <Route path="finanzas/analisis-horizontal-vertical" element={<Navigate to="/finanzas/resultados?tab=evolucion" replace />} />
          <Route path="finanzas/panel-alertas" element={<ProtectedRoute solo={['admin']}><PanelAlertas /></ProtectedRoute>} />
          <Route path="finanzas/repeticion-clientes" element={<Navigate to="/finanzas/ventas-panel?tab=repeticion" replace />} />
          <Route path="finanzas/roi-canal" element={<Navigate to="/finanzas/rentabilidad?tab=roi" replace />} />
          <Route path="finanzas/reservas" element={<Navigate to="/finanzas/tesoreria?tab=reserva" replace />} />
          <Route path="finanzas/pyg" element={<Navigate to="/finanzas/resultados?tab=pyg" replace />} />
          <Route path="finanzas/rentabilidad-franja" element={<Navigate to="/finanzas/rentabilidad?tab=franja" replace />} />
          <Route path="finanzas/ticket-medio" element={<Navigate to="/finanzas/ventas-panel?tab=ticket" replace />} />

          {/* ── D·Tanda 2 · VENTAS Y CLIENTES ── "/ventas" reutiliza el módulo de Finanzas
               (misma pantalla, ya con pestañas Ventas/Objetivos/Ticket/Repetición) para no
               duplicar pantalla; Analítica/Clientes/Marketing sí son áreas nuevas. */}
          <Route path="ventas" element={<Navigate to="/finanzas/ventas-panel" replace />} />
          <Route path="ventas/ticket-medio" element={<Navigate to="/finanzas/ventas-panel?tab=ticket" replace />} />
          <Route path="ventas/roi-canal" element={<Navigate to="/finanzas/rentabilidad?tab=roi" replace />} />
          <Route path="ventas/rentabilidad-franja" element={<Navigate to="/finanzas/rentabilidad?tab=franja" replace />} />
          <Route path="ventas/repeticion-clientes" element={<Navigate to="/finanzas/ventas-panel?tab=repeticion" replace />} />
          <Route path="ventas/analitica" element={<ProtectedRoute solo={['admin']}><TabsContainer title="Analítica" tabs={[
            { to: '.', label: 'Margen por Canal', end: true },
            { to: 'ventas-marca', label: 'Ventas por Marca' },
            { to: 'pareto', label: 'Pareto Ventas' },
            { to: 'revenue', label: 'Revenue & Ticket' },
            { to: 'demanda', label: 'Predicción Demanda' },
          ]} /></ProtectedRoute>}>
            <Route index element={<MargenCanal />} />
            <Route path="ventas-marca" element={<VentasMarca />} />
            <Route path="pareto" element={<ParetoVentas />} />
            <Route path="revenue" element={<RevenueTicketMedio />} />
            <Route path="demanda" element={<PrediccionDemanda />} />
          </Route>
          <Route path="ventas/clientes" element={<ProtectedRoute solo={['admin']}><TabsContainer title="Clientes" tabs={[
            { to: '.', label: 'CRM', end: true },
            { to: 'club', label: 'Club Fidelización' },
          ]} /></ProtectedRoute>}>
            <Route index element={<CrmTiendaPropia />} />
            <Route path="club" element={<ClubFidelizacion />} />
          </Route>
          <Route path="ventas/marketing" element={<ProtectedRoute solo={['admin']}><TabsContainer title="Marketing" tabs={[
            { to: '.', label: 'Panel MKT', end: true },
            { to: 'campanas', label: 'Campañas y Promos' },
            { to: 'rendimiento', label: 'Rendimiento Ads y Promo' },
            { to: 'resenas', label: 'Panel Reseñas' },
            { to: 'benchmark', label: 'Benchmark' },
            { to: 'playbook', label: 'Playbook ThinkPaladar' },
          ]} /></ProtectedRoute>}>
            <Route index element={<PanelMkt />} />
            <Route path="campanas" element={<PlanCampanas />} />
            <Route path="rendimiento" element={<RendimientoAdsPromo />} />
            <Route path="resenas" element={<PanelResenas />} />
            <Route path="benchmark" element={<Benchmark />} />
            <Route path="playbook" element={<PlaybookThinkPaladar />} />
          </Route>

          <Route path="panel" element={<ProtectedRoute solo={['admin']}><PanelSwitch /></ProtectedRoute>} />
          <Route path="panel-direccion" element={<ProtectedRoute solo={['admin']}><PanelDireccion /></ProtectedRoute>} />

          <Route path="importador" element={<Navigate to="/finanzas/papeleo?tab=bandeja" replace />} />
          <Route path="ocr" element={<Navigate to="/finanzas/papeleo?tab=bandeja" replace />} />
          <Route path="importar-ventas" element={<ProtectedRoute solo={['admin']}><ImportarVentas /></ProtectedRoute>} />
          <Route path="tareas" element={<ProtectedRoute solo={['admin']}><Tareas /></ProtectedRoute>} />

          <Route path="informes" element={<ProtectedRoute solo={['admin']}><InformesPanel /></ProtectedRoute>} />
          <Route path="informes/destinatarios" element={<ProtectedRoute solo={['admin']}><Destinatarios /></ProtectedRoute>} />
          <Route path="informes/historial" element={<ProtectedRoute solo={['admin']}><Historial /></ProtectedRoute>} />
          <Route path="informes/configuracion" element={<ProtectedRoute solo={['admin']}><ConfiguracionInformes /></ProtectedRoute>} />

          <Route path="analytics/revenue" element={<Navigate to="/ventas/analitica/revenue" replace />} />
          <Route path="analytics/margen" element={<Navigate to="/ventas/analitica" replace />} />
          <Route path="analytics/ventas-marca" element={<Navigate to="/ventas/analitica/ventas-marca" replace />} />
          <Route path="analytics/demanda" element={<Navigate to="/ventas/analitica/demanda" replace />} />
          <Route path="analytics/pareto-ventas" element={<Navigate to="/ventas/analitica/pareto" replace />} />

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
          <Route path="equipo/horarios" element={<ProtectedRoute solo={['admin']}><Horarios /></ProtectedRoute>} />
          <Route path="equipo/presencia" element={<ProtectedRoute solo={['admin']}><ControlPresencia /></ProtectedRoute>} />

          <Route path="clientes/club" element={<Navigate to="/ventas/clientes/club" replace />} />
          <Route path="clientes/crm" element={<Navigate to="/ventas/clientes" replace />} />
          <Route path="clientes/resenas" element={<Navigate to="/ventas/marketing/resenas" replace />} />
          <Route path="clientes/playbook-tp" element={<Navigate to="/ventas/marketing/playbook" replace />} />
          <Route path="clientes/benchmark" element={<Navigate to="/ventas/marketing/benchmark" replace />} />

          <Route path="marketing/panel" element={<Navigate to="/ventas/marketing" replace />} />
          <Route path="marketing/plan" element={<Navigate to="/ventas/marketing/campanas" replace />} />
          <Route path="marketing/rendimiento-ads-promo" element={<Navigate to="/ventas/marketing/rendimiento" replace />} />
          <Route path="marketing/:slug" element={<ProtectedRoute solo={['admin']}><Placeholder /></ProtectedRoute>} />

          <Route path="stock/proveedores" element={<ProtectedRoute solo={['admin']}><Proveedores /></ProtectedRoute>} />
          <Route path="stock/inventario" element={<ProtectedRoute solo={['admin']}><Inventario /></ProtectedRoute>} />

          <Route path="cocina/inventario" element={<ProtectedRoute solo={['admin']}><CocinaInventario /></ProtectedRoute>} />
          <Route path="cocina/recetas" element={<CocinaRecetas />} />
          {/* A2 · Coste por plato: enlaza lo que vendes con la receta que lo cuesta */}
          <Route path="cocina/coste-plato" element={<ProtectedRoute solo={['admin']}><CostePlato /></ProtectedRoute>} />
          {/* ── D·Tanda 3 · Menú Engineering ← Menú Engineering + Pareto Ingredientes ── */}
          <Route path="cocina/menu-engineering" element={<ProtectedRoute solo={['admin']}><TabsContainer title="Menú Engineering" tabs={[
            { to: '.', label: 'Menú Engineering', end: true },
            { to: 'pareto', label: 'Pareto Ingredientes' },
          ]} /></ProtectedRoute>}>
            <Route index element={<MenuEngineering />} />
            <Route path="pareto" element={<ParetoIngredientes />} />
          </Route>
          <Route path="cocina/recetario" element={<Recetario />} />
          <Route path="cocina/esquemas" element={<Esquemas />} />
          <Route path="cocina/produccion" element={<Produccion />} />
          <Route path="cocina/lista-compra" element={<ListaCompra />} />
          {/* Redirecciones Tanda 3 */}
          <Route path="cocina/menu-familia" element={<Navigate to="/carta/menu-familia" replace />} />
          <Route path="cocina/pareto-ingredientes" element={<Navigate to="/cocina/menu-engineering/pareto" replace />} />

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
