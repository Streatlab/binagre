# CANTERA ALEGRE v1.0 · Progreso 100% ERP

Autoloop de aplicación del sistema visual Cantera Alegre a TODO el ERP. Fuente de
ley: prompt AUTOLOOP + referencia validada `src/pages/PanelGlobal.tsx` /
`src/components/panel/resumen/ResumenLanding.tsx`. Componentes canónicos:
`ui/RutaPantalla`, `ui/TabsPastilla`, `ui/SubTabs`, `kit/HeroTocho`, `kit/FraseHero`,
tokens `styles/neobrutal.ts` + `styles/kit.ts`.

## FASE 2 · CUERPO REAL (re-auditoría honesta 23-jul)
La tanda anterior solo logró **gate de color verde** + cabecera v4 en algunos padres.
Eso NO es Cantera Alegre. Se resetea a `[ ]` toda pantalla que no cumpla LOS 6
CRITERIOS. El `[x]` solo se pone cuando una pantalla cumple los 6:

1. **Cabecera v4**: `RutaPantalla` (Módulo ▸ Pestaña ▸ Subpestaña) + `TabsPastilla`/
   `SubTabs` + filtros planos. Fuera `eyebrow + h1 granate + subtítulo gris`.
2. **Héroe del área** con su color (Resumen amarillo · Cashflow/Tesorería azul ·
   Facturación/Ventas verde · Papeleo granate · Cocina/Ops naranja · Marcas/Marketing
   rosa · Equipo tinta · EEFF/Objetivos amarillo). Anatomía: claim + pastilla periodo +
   titular frase natural (no dato suelto) + etiqueta + cifra gigante € + chip variación +
   resumen + tira de atención blanca pegada (máx 4 chips).
3. **UNA frase potente** tras la plancha, color por SIGNIFICADO (rojo peligro · granate
   coste · rosa oportunidad · verde logro), distinta del color del héroe.
4. **Superficies**: plancha = tarjetas sólidas PEGADAS con borde 3px (no grid con gap) ·
   resto = papel blanco, ceja 7px color de familia, gap 16px, sin sombra. Radio 0.
   Columna, ancho máx 1360.
5. **Sombra dura** 3px 3px 0 tinta SOLO en lo pulsable + resumen/neto del héroe. Fuera
   `boxShadow: SHADOW` de tarjetas/tablas informativas.
6. **Cifras/tipografía por ley**: € solo en cifra gigante y totales · es-ES · 2 dec
   <1.000 y 0 desde 1.000 · variación triángulo+signo+color · "—" si falta · numérico a
   la derecha · Oswald titulares/cifras + Lexend texto.

Se mantiene lo logrado: 0 hex fuera de los 12 tokens + colores de canal.
Componentes canónicos a REUTILIZAR (no reescribir): `kit/cantera.tsx`
(`HeroCantera`, `Papel`, `Plancha`, `PlanchaCelda`, `FrasePotente`) + `ui/RutaPantalla`
/`TabsPastilla`/`SubTabs`. Solo capa visual: nada de queries, cálculos, props, lógica.

## INVENTARIO

### Portada / Panel
- [x] Panel Global · Resumen (REFERENCIA validada · cumple los 6 criterios)
- [ ] Panel Global · Operaciones / Finanzas / Cashflow / Evolución / Marcas (tabs del panel)
- [ ] Home (Hoy) — portada
- [ ] Panel Dirección

### Finanzas
- [ ] Papeleo · Bandeja entrada
- [ ] Papeleo · Facturas (OCR)
- [x] Papeleo · Conciliación
- [x] Papeleo · Gestor documental (GestionFacturas)
- [x] Papeleo · Facturación
- [x] Papeleo · Gestoría
- [x] Ventas · Ventas
- [⚠️] Ventas · Objetivos — 4/6; pestañas y edición inline conservan theming T.* compartido (no tocar tokens.ts)
- [x] Ventas · Ticket medio (héroe ventas, plancha canal, frase, papel)
- [x] Ventas · Repetición clientes
- [x] Resultados · Running
- [x] Resultados · P&G
- [x] Resultados · Estados financieros
- [x] Resultados · Evolución (análisis horiz/vert)
- [x] Rentabilidad · Punto de equilibrio
- [x] Rentabilidad · Por marca y canal (break-even)
- [x] Rentabilidad · ROI por canal (héroe resultados, plancha mejor/peor/medio, frase)
- [x] Rentabilidad · Por franja horaria
- [x] Tesorería · Calendario
- [x] Tesorería · Gastos fijos
- [ ] Tesorería · Fondo & reserva
- [x] Tesorería · Historial
- [x] Tesorería · 13 semanas
- [x] Tesorería · Escenarios
- [x] Tesorería · Salud financiera (fondo maniobra)
- [ ] Panel de alertas
- [ ] Bandeja de pendientes

### Ventas y Clientes (áreas)
- [x] Analítica · Margen por canal
- [x] Analítica · Ventas por marca
- [x] Analítica · Pareto ventas
- [x] Analítica · Revenue & ticket
- [x] Analítica · Predicción demanda (contenido real: Pulso operativa)
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
- [ ] Cocina Operativa · Carta
- [ ] Cocina Operativa · Menú familia
- [x] Cocina Operativa · Producción
- [x] Cocina Operativa · Plato maestro
- [x] Cocina Dinero · Datos (Escandallo · cabecera; KPIs viven en sub-tabs)
- [x] Cocina Dinero · Menú engineering
- [x] Cocina Dinero · Pareto ingredientes
- [x] Cocina Dinero · Coste por plato
- [x] Cocina · Inventario
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

### Informes (UI)
- [ ] Informes · Panel (gate verde; lógica de envío/robots NO tocada)
- [ ] Informes · Historial (gate verde)
- [ ] Informes · Configuración (gate verde)
- [ ] Login (gate verde salvo colores de marca Google del botón OAuth — excepción marca)
- [ ] Cashflow (tab del Panel) · gate verde
- [ ] Placeholder · gate verde

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
- [ ] Componentes compartidos: NavIcon (colores de área del sidebar), SortableHeader,
  EditableInline, MargenBanner, SelloAct, IVAToggle, SelectorFechaUniversal,
  KpiCardGrande, ChuletaPlataformas, kit/ProgresoGlobal, kit/TabsContainer,
  ui/RutaPantalla, ui/SubTabs.
- [ ] Conciliación: TabMovimientos, ResumenDashboard, CardFiltro, PanelCobertura,
  ModalDetalleMovimiento, TagFiltroActivo, BandejaPropuestas.
- [ ] Documentación: BandejaEntrada, ModalDescartarFactura, ResolverPendientes,
  AvisosBandeja. Factura: ModalDetalleFactura. OCR: ExtractosTabla.
- [ ] Escandallo: TabFichas, ColaRevisionFichas. Equipo: horarios/TabVacaciones,
  horarios/TabGenerador, ModalSolicitud. Inventario: TabConteos. Importador: TabSubirV2.
- [ ] Panel: resumen/CardFacturasCorreo, sl/uiSL, TabEvolucion. Mobile: PantallasMovil.
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
