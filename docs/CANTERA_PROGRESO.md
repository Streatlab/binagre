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
- [ ] Home (Hoy) — portada
- [ ] Panel Dirección

### Finanzas
- [ ] Papeleo · Bandeja entrada
- [ ] Papeleo · Facturas (OCR)
- [ ] Papeleo · Conciliación
- [ ] Papeleo · Gestor documental
- [ ] Papeleo · Facturación
- [ ] Papeleo · Gestoría
- [ ] Ventas · Ventas
- [ ] Ventas · Objetivos
- [ ] Ventas · Ticket medio
- [ ] Ventas · Repetición clientes
- [ ] Resultados · Running
- [ ] Resultados · P&G
- [ ] Resultados · Estados financieros
- [ ] Resultados · Evolución (análisis horiz/vert)
- [ ] Rentabilidad · Punto de equilibrio
- [ ] Rentabilidad · Por marca y canal (break-even)
- [ ] Rentabilidad · ROI por canal
- [ ] Rentabilidad · Por franja horaria
- [ ] Tesorería · Calendario
- [ ] Tesorería · Gastos fijos
- [ ] Tesorería · Fondo & reserva
- [ ] Tesorería · Historial
- [ ] Tesorería · 13 semanas
- [ ] Tesorería · Escenarios
- [ ] Tesorería · Salud financiera (fondo maniobra)
- [ ] Panel de alertas
- [ ] Bandeja de pendientes

### Ventas y Clientes (áreas)
- [ ] Analítica · Margen por canal
- [ ] Analítica · Ventas por marca
- [ ] Analítica · Pareto ventas
- [ ] Analítica · Revenue & ticket
- [ ] Analítica · Predicción demanda
- [ ] Clientes · CRM tienda propia
- [ ] Clientes · Club fidelización
- [ ] Marketing · Panel MKT
- [ ] Marketing · Plan campañas
- [ ] Marketing · Rendimiento ads/promo
- [ ] Marketing · Panel reseñas
- [ ] Marketing · Benchmark
- [ ] Marketing · Playbook ThinkPaladar

### Cocina
- [ ] Cocina · Hoy
- [ ] Cocina Operativa · Recetario
- [ ] Cocina Operativa · Carta
- [ ] Cocina Operativa · Menú familia
- [ ] Cocina Operativa · Producción
- [ ] Cocina Operativa · Plato maestro
- [ ] Cocina Dinero · Datos (Escandallo)
- [ ] Cocina Dinero · Menú engineering
- [ ] Cocina Dinero · Pareto ingredientes
- [ ] Cocina Dinero · Coste por plato
- [ ] Cocina · Inventario
- [ ] Cocina · Platos maestros (catálogo)

### Compras
- [ ] Compras · Lista de compra
- [ ] Compras · Inventario (stock)
- [ ] Compras · Proveedores

### Operaciones
- [ ] Registro diario · Checklists
- [ ] Registro diario · Tareas operativas
- [ ] Registro diario · Temperaturas
- [ ] Registro diario · Bitácora
- [ ] Registro diario · Pulso cocina
- [ ] Mantenimiento · Libro equipos
- [ ] Mantenimiento · Daños menaje
- [ ] Mantenimiento · Pedidos menaje
- [ ] Calidad · BPM/Calidad
- [ ] Calidad · Manuales
- [ ] Reclamación reembolsos
- [ ] Reuniones equipo

### Equipo
- [ ] Equipo · Personas (Fichas/Organigrama/Incentivos/Portal)
- [ ] Equipo · Dinero (Nóminas/Costes/SegSocial)
- [ ] Equipo · Día a día (Horarios/Fichajes/Calendario/Permisos)
- [ ] Equipo · Documentos

### Marcas / Tareas / Importar
- [ ] Marcas (simple)
- [ ] Tareas
- [ ] Importar ventas

### Ajustes
- [ ] Ajustes · Hub
- [ ] Ajustes · Integraciones (Marcas/Canales/Drive)
- [ ] Ajustes · Reglas (Ingredientes/Conciliación/Plantillas/Diccionario/Correo)
- [ ] Ajustes · Bancos
- [ ] Ajustes · Cuentas bancarias
- [ ] Ajustes · Bancos y cuentas
- [ ] Ajustes · Compras config (Costes/Proveedores/Categorías/Unidades)
- [ ] Ajustes · Cocina config (Categorías/Unidades/Proveedores/Formato)
- [ ] Ajustes · Usuarios
- [ ] Ajustes · Calendario operativo
- [ ] Ajustes · Aprendizajes ERP
- [ ] Ajustes · Aprendizaje calcNeto
- [ ] Ajustes · Mapeo de marcas

### Sidebar / marco
- [ ] Sidebar (cabeceras de sección por área)

### Excluidos por ley (no Cantera)
- Informes · envíos / robots (zona prohibida: robots/informes-envíos/WhatsApp/crons)
- MARCO DOCUMENTOS de vistas imprimibles (ley propia LEY_IMPRESION)
- Modo oscuro (aplazado)
- POS / placeholders vacíos

## DECISIONES
- Inventario derivado de `src/App.tsx` (router) + `src/components/Sidebar.tsx`.
- Cabecera v4 ya aplicada en tanda previa; esta tanda cierra cuerpo + gate de color.

## BLOQUEADAS
(ninguna aún)
