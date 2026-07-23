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
- [ ] Compras · Lista de compra
- [ ] Compras · Inventario (stock)
- [x] Compras · Proveedores

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

### Excluidos por ley (no Cantera)
- Informes · envíos / robots (zona prohibida: robots/informes-envíos/WhatsApp/crons)
- MARCO DOCUMENTOS de vistas imprimibles (ley propia LEY_IMPRESION)
- Modo oscuro (aplazado)
- POS / placeholders vacíos

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

## BLOQUEADAS
(ninguna aún)
