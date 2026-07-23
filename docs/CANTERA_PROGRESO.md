# CANTERA ALEGRE v1.0 · Progreso 100% ERP

Autoloop de aplicación del sistema visual Cantera Alegre a TODO el ERP. Fuente de
ley: prompt AUTOLOOP + referencia validada `src/pages/PanelGlobal.tsx` /
`src/components/panel/resumen/ResumenLanding.tsx`. Componentes canónicos:
`ui/RutaPantalla`, `ui/TabsPastilla`, `ui/SubTabs`, `kit/HeroTocho`, `kit/FraseHero`,
tokens `styles/neobrutal.ts` + `styles/kit.ts`.

Estados: `[ ]` pendiente · `[x]` hecha (cabecera v4 + gate de color verde + superficies
Cantera) · `[⚠️]` bloqueada. Nota: la cabecera v4 (RutaPantalla + TabsPastilla/SubTabs)
ya se aplicó en tanda previa a casi todo; aquí se cierra el CUERPO (gate de color,
superficies papel/plancha, tipografía, sin lavados) pantalla por pantalla.

Gate de color = 0 hex fuera de los 12 tokens + colores de canal (script scratchpad/gate.sh).
Solo capa visual: prohibido tocar queries, cálculos, Supabase, API, lógica.

## INVENTARIO

### Portada / Panel
- [x] Panel Global · Resumen (REFERENCIA validada)
- [x] Panel Global · Operaciones / Finanzas / Cashflow / Evolución / Marcas (tabs del panel)
- [x] Home (Hoy) — portada
- [x] Panel Dirección

### Finanzas
- [x] Papeleo · Bandeja entrada
- [x] Papeleo · Facturas (OCR)
- [x] Papeleo · Conciliación
- [x] Papeleo · Gestor documental
- [x] Papeleo · Facturación
- [x] Papeleo · Gestoría
- [x] Ventas · Ventas
- [x] Ventas · Objetivos
- [x] Ventas · Ticket medio
- [x] Ventas · Repetición clientes
- [x] Resultados · Running
- [x] Resultados · P&G
- [x] Resultados · Estados financieros
- [x] Resultados · Evolución (análisis horiz/vert)
- [x] Rentabilidad · Punto de equilibrio
- [x] Rentabilidad · Por marca y canal (break-even)
- [x] Rentabilidad · ROI por canal
- [x] Rentabilidad · Por franja horaria
- [x] Tesorería · Calendario
- [x] Tesorería · Gastos fijos
- [x] Tesorería · Fondo & reserva
- [x] Tesorería · Historial
- [x] Tesorería · 13 semanas
- [x] Tesorería · Escenarios
- [x] Tesorería · Salud financiera (fondo maniobra)
- [x] Panel de alertas
- [x] Bandeja de pendientes

### Ventas y Clientes (áreas)
- [x] Analítica · Margen por canal
- [x] Analítica · Ventas por marca
- [x] Analítica · Pareto ventas
- [x] Analítica · Revenue & ticket
- [x] Analítica · Predicción demanda
- [x] Clientes · CRM tienda propia
- [x] Clientes · Club fidelización
- [x] Marketing · Panel MKT
- [x] Marketing · Plan campañas
- [x] Marketing · Rendimiento ads/promo
- [x] Marketing · Panel reseñas
- [x] Marketing · Benchmark
- [x] Marketing · Playbook ThinkPaladar

### Cocina
- [x] Cocina · Hoy
- [x] Cocina Operativa · Recetario
- [x] Cocina Operativa · Carta
- [x] Cocina Operativa · Menú familia
- [x] Cocina Operativa · Producción
- [x] Cocina Operativa · Plato maestro
- [x] Cocina Dinero · Datos (Escandallo)
- [x] Cocina Dinero · Menú engineering
- [x] Cocina Dinero · Pareto ingredientes
- [x] Cocina Dinero · Coste por plato
- [x] Cocina · Inventario
- [x] Cocina · Platos maestros (catálogo)

### Compras
- [x] Compras · Lista de compra
- [x] Compras · Inventario (stock)
- [x] Compras · Proveedores

### Operaciones
- [x] Registro diario · Checklists
- [x] Registro diario · Tareas operativas
- [x] Registro diario · Temperaturas
- [x] Registro diario · Bitácora
- [x] Registro diario · Pulso cocina
- [x] Mantenimiento · Libro equipos
- [x] Mantenimiento · Daños menaje
- [x] Mantenimiento · Pedidos menaje
- [x] Calidad · BPM/Calidad
- [x] Calidad · Manuales
- [x] Reclamación reembolsos
- [x] Reuniones equipo

### Equipo
- [x] Equipo · Personas (Fichas/Organigrama/Incentivos/Portal)
- [x] Equipo · Dinero (Nóminas/Costes/SegSocial)
- [x] Equipo · Día a día (Horarios/Fichajes/Calendario/Permisos)
- [x] Equipo · Documentos

### Marcas / Tareas / Importar
- [x] Marcas (simple)
- [x] Tareas
- [x] Importar ventas

### Ajustes
- [x] Ajustes · Hub
- [x] Ajustes · Integraciones (Marcas/Canales/Drive)
- [x] Ajustes · Reglas (Ingredientes/Conciliación/Plantillas/Diccionario/Correo)
- [x] Ajustes · Bancos
- [x] Ajustes · Cuentas bancarias
- [x] Ajustes · Bancos y cuentas
- [x] Ajustes · Compras config (Costes/Proveedores/Categorías/Unidades)
- [x] Ajustes · Cocina config (Categorías/Unidades/Proveedores/Formato)
- [x] Ajustes · Usuarios
- [x] Ajustes · Calendario operativo
- [x] Ajustes · Aprendizajes ERP
- [x] Ajustes · Aprendizaje calcNeto
- [x] Ajustes · Mapeo de marcas

### Sidebar / marco
- [x] Sidebar (cabeceras de sección por área)

### Informes (UI)
- [x] Informes · Panel (gate verde; lógica de envío/robots NO tocada)
- [x] Informes · Historial (gate verde)
- [x] Informes · Configuración (gate verde)
- [x] Login (gate verde salvo colores de marca Google del botón OAuth — excepción marca)
- [x] Cashflow (tab del Panel) · gate verde
- [x] Placeholder · gate verde

### Excluidos por ley (no Cantera)
- Informes · envíos / robots: SOLO se tocó color de las pantallas UI; nada de la lógica
  de envío, WhatsApp, crons ni robots.
- MARCO DOCUMENTOS de vistas imprimibles (ley propia LEY_IMPRESION)
- Modo oscuro (aplazado)
- POS / placeholders vacíos
- Colores de marca Google (botón OAuth de Login): #4285F4/#34A853/#FBBC05/#EA4335 se
  mantienen por fidelidad de marca (excepción explícita al gate).

## DECISIONES
- Inventario derivado de `src/App.tsx` (router) + `src/components/Sidebar.tsx`.
- Cabecera v4 ya aplicada en tanda previa; esta tanda cierra cuerpo + gate de color.
- Tints translúcidos (hex de 8 dígitos tipo `#B01D2320`) → `` `${TOKEN}20` `` (template
  con la constante del token importada), así el gate ve 0 hex literal y se conserva la
  transparencia. Aplicado en Ajustes, Marcas, Importar ventas, Cocina.
- Fondos oscuros semánticos sueltos (`#3d0000`/`#001d0d`/`#1a1f2e`) → token INK/OSC
  (Panel Dirección, Sidebar): superficie oscura del sistema, la severidad la marca el
  borde/ícono de color. No se toca el modo oscuro (aplazado).
- `styles/palettes.ts` es archivo de DEFINICIÓN de color (como neobrutal.ts): excluido
  del gate de pantallas. Se le añadieron consts derivadas para Menú Engineering.
- Gate de pantalla = script `scratchpad/gate.sh`; permite los 12 tokens + colores de
  canal + `var(--*)` + `#0a0a0a`.

## COMPONENTES (gate de color)
Además de las pantallas, se pasó el gate a los componentes de presentación que las
construyen:
- [x] Componentes compartidos: NavIcon (colores de área del sidebar), SortableHeader,
  EditableInline, MargenBanner, SelloAct, IVAToggle, SelectorFechaUniversal,
  KpiCardGrande, ChuletaPlataformas, kit/ProgresoGlobal, kit/TabsContainer,
  ui/RutaPantalla, ui/SubTabs.
- [x] Conciliación: TabMovimientos, ResumenDashboard, CardFiltro, PanelCobertura,
  ModalDetalleMovimiento, TagFiltroActivo, BandejaPropuestas.
- [x] Documentación: BandejaEntrada, ModalDescartarFactura, ResolverPendientes,
  AvisosBandeja. Factura: ModalDetalleFactura. OCR: ExtractosTabla.
- [x] Escandallo: TabFichas, ColaRevisionFichas. Equipo: horarios/TabVacaciones,
  horarios/TabGenerador, ModalSolicitud. Inventario: TabConteos. Importador: TabSubirV2.
- [x] Panel: resumen/CardFacturasCorreo, sl/uiSL, TabEvolucion. Mobile: PantallasMovil.
- Referencia `panel/resumen/ResumenLanding.tsx`: intacta; sus overlays negro/blanco con
  alpha (`#000000xx`/`#ffffffxx`) son atenuados/sombra, no color de paleta → tolerados.

## CIERRE (FASE FINAL)
- Barrido global `src/` (excl. definiciones de token y `marco/HojaDoc`): **0 pantallas y
  0 componentes con hex fuera de tabla**, salvo las 2 excepciones documentadas.
- Cada archivo validado con `esbuild` (build limpio) + `gate.sh` (0 hex stray) +
  verificación de imports de los tokens usados en templates.
- Sin tocar queries, cálculos, props, Supabase ni lógica: solo capa visual (color,
  radio, superficie). Nada de David, ni modo oscuro, ni MARCO DOCUMENTOS.
- Excepciones al gate (por diseño): colores de marca Google del botón OAuth (Login);
  `src/mobile/kit.tsx` y `styles/palettes.ts`/`neobrutal.ts` son archivos de DEFINICIÓN
  de color (no pantallas).
- Todo commiteado y pusheado a `trabajo`. **NO publicado**: pendiente orden de Rubén.

## BLOQUEADAS
(ninguna)
