# SPEC ADICIONAL — Fixes Panel Global + Importador unificado + Tareas pendientes

> Encolar tras Bloque MEGA. NO interrumpe el bloque actual.

## Contexto
Tras review localhost del Bloque 1 ejecutado, Rubén detecta gaps de estilo y de contenido en Panel Global. Este spec añade fixes específicos + 2 módulos nuevos (Importador unificado y Tareas pendientes) + regla mobile-friendly global.

## Regla maestra: GUÍA DE ESTILO ÚNICA

**Cualquier estilo aplicado debe leer valores EXACTOS de:**
- Notion: "🎨 Guía de estilo maestra · Streat Lab ERP" (page_id 350c8b1f-6139-8191-952a-f299926ac42f)
- O del archivo `/src/styles/tokens.ts` del repo

**NO improvisar valores.** Si un valor no existe en la guía, antes de inventar, primero actualizar la guía y luego implementar.

---

# FASE A · MOBILE-FRIENDLY GLOBAL

## A.1 Responsive en TODO el ERP
1. Sidebar: collapsable en mobile (off-canvas con burger)
2. Cards grid: 1 col mobile / 2 col tablet / 3-5 col desktop según contexto
3. Tablas con scroll horizontal en mobile, sticky primera columna
4. Selectores: full-width en mobile, inline en desktop
5. Touch targets: mínimo 44x44px en mobile
6. Breakpoints Tailwind estándar: sm 640 / md 768 / lg 1024 / xl 1280
7. Validar cada módulo en viewport 375px (iPhone SE) y 768px (tablet)

## A.2 Tipografía responsive
8. Valores KPI grandes: 2.4rem desktop, 1.8rem tablet, 1.5rem mobile
9. Títulos página: 22px desktop, 18px mobile
10. Body: 14px siempre

---

# FASE B · PANEL GLOBAL · FIXES PROFUNDOS

## B.1 Tipografía intracards (CRÍTICO)
11. Recuperar tipografía intracards anterior (más legible, más grande)
12. Valores numéricos en cards grandes: Oswald 2.4rem 600
13. Valores numéricos en cards medianas: Oswald 1.6rem 600
14. Sublabels: Oswald 12px 500 letter-spacing 2px MAYÚSCULAS

## B.2 Selector de fechas global (CRÍTICO)
15. Reemplazar selector actual por uno con estas opciones EXACTAS:
    - Semana actual
    - Últimos 7 días
    - Mes en curso
    - Un mes hasta ahora
    - Últimos 60 días
    - Personalizado (abre rango date picker)
    - **Semanas X** (al pulsar despliega 2º dropdown a la derecha con: Semana 18, Semana 17, Semana 16, ... hasta Semana 1 año en curso)
16. Aplicar este selector a TODOS los módulos del ERP que tengan selector de fechas (Panel, Facturación, Conciliación, PE, Running, Objetivos)
17. Persistencia: la selección elegida queda fija para TODAS las tabs del módulo hasta refresh o cambio manual

## B.3 Tabs estilo Conciliación EXACTO (CRÍTICO)
18. Reemplazar tabs actuales del Panel (General/Operaciones/Finanzas/Cashflow/Marcas) por estilo Conciliación
19. Valores literales obligatorios:
    ```
    tabActiva: { padding: '6px 14px', borderRadius: 6, border: 'none', background: '#FF4757', color: '#ffffff', fontFamily: 'Lexend', fontSize: 13, fontWeight: 500, transition: 'background 150ms' }
    tabInactiva: { padding: '6px 14px', borderRadius: 6, border: '0.5px solid #d0c8bc', background: 'transparent', color: '#3a4050', fontFamily: 'Lexend', fontSize: 13, fontWeight: 500 }
    ```
20. Usar funciones `tabActiveStyle` y `tabInactiveStyle` de `/src/styles/tokens.ts` que ya existen
21. Aplicar a TODAS las tabs del ERP (Panel, Facturación, Conciliación, Objetivos, Running, PE, Configuración, Equipo)
22. NO usar guión amarillo subrayando NUNCA

## B.4 Barras de cumplimiento estándar
23. Estilo único válido para barras de cumplimiento en TODO el ERP (referencia: tabla histórico módulo Objetivos):
    - height: 8px
    - border-radius: 4px
    - background: #ebe8e2 (group color)
    - fill verde #1D9E75 si ≥ 80%
    - fill ámbar #f5a623 si 50-79%
    - fill rojo #E24B4A si < 50%
    - transition: width 0.5s ease
24. Multi-segmento (cumplido + pendiente): verde la parte cumplida, rojo la parte pendiente, división clara
25. Aplicar a las barras de Card Ventas en Panel (semanal/mensual/anual)
26. Aplicar a cualquier otra barra de cumplimiento en el ERP

## B.5 Card Ventas: objetivos reales del módulo Objetivos
27. Card Ventas lee los objetivos REALES de la tabla `objetivos` BD (semanal, mensual, anual)
28. Mostrar tres líneas: SEMANAL, MENSUAL, ANUAL — con barras de cumplimiento estilo B.4
29. Editables inline: pulso sobre la cifra del objetivo y se convierte en input
30. Si guardo un valor nuevo: se actualiza en BD tabla `objetivos`
31. Si borro el valor (input vacío + enter): se restaura el original de BD automáticamente
32. Toast feedback "Objetivo actualizado" / "Objetivo restaurado"

## B.6 Card TM bruto vs neto
33. Card TM muestra dos valores en línea:
    - Izquierda: TM bruto (color pri, Oswald 2.4rem) → lo facturado
    - Derecha en verde (#1D9E75, Oswald 1.4rem): TM neto → lo cobrado
34. Sublabel: "BRUTO · NETO"
35. Cálculo TM neto = ingresos_netos / pedidos del periodo

## B.7 Cards plataformas: facturado vs cobrado real
36. Cada card de plataforma (Uber/Glovo/Just Eat/Web/Directa) muestra:
    - Bruto facturado (lo que el cliente pagó en la plataforma)
    - Neto cobrado real (lo que efectivamente entra a cuenta tras comisiones, fees, IVA)
    - % margen real
37. Cálculo neto cobrado = bruto − comisión% − comisión fija × pedidos − IVA 21% × (comisión%+comisión fija)
38. Validar % margen contra conciliación bancaria mensual (si discrepa más del 5%, alerta visual)

## B.8 Días pico
39. Datos reales (no random) calculados de tabla `facturacion_diaria`
40. Cada barra del gráfico de un color diferente:
    - Lunes: #1E5BCC azul
    - Martes: #06C167 verde
    - Miércoles: #f5a623 ámbar
    - Jueves: #B01D23 rojo SL
    - Viernes: #66aaff azul claro
    - Sábado: #F26B1F naranja Rubén
    - Domingo: #1D9E75 verde oscuro

## B.9 Re-arquitectura tabs Panel
41. Hacer inventario completo de toda la infografía/gráficos/cards que había en TODOS los módulos antes (Panel viejo, Running, PE, Conciliación, Análisis viejo)
42. Identificar cuáles tienen valor real (eliminar duplicados, eliminar placeholders)
43. Distribuir entre las 5 tabs con criterio:
    - **General**: KPIs principales (Ventas, Pedidos, TM bruto/neto, cards plataformas), Días pico, Top ventas
    - **Operaciones**: Pedidos por hora pico, mix canales, ratio ALM/CENA, ratio repetición clientes (cuando se tenga dato), evolución pedidos vs semana anterior
    - **Finanzas**: Ingresos brutos, comisiones plataformas, ingresos netos, ratio gastos/netos, margen real, comparativa vs presupuesto Objetivos
    - **Cashflow**: Cobros pendientes detallados, pagos pendientes detallados, provisiones IVA/IRPF, gráfico saldo proyectado 7d/30d/3m/6m/1a, calendario pagos críticos próximos 90d
    - **Marcas**: matriz cruzada Plataforma × Marca, top marcas por canal, margen real por combo, acciones recomendadas
44. Cards grandes con info de valor real, NO repetida con otras tabs, NO placeholders pobres
45. NO repetir datos entre tabs (TM en card grande Y en tab Operaciones es duplicado, eliminar)

---

# FASE C · DATOS PLATAFORMA REALES (UBER PRIMERO)

## C.1 Subida resumenes mensuales por marca
46. Crear sección en módulo nuevo "Importador unificado" (FASE D) para subir resúmenes mensuales Uber por marca
47. Parser Uber resumen mensual extrae:
    - Bruto por marca
    - Pedidos por marca
    - Comisiones, fees, ADS
    - Cargos de promoción (esto equivale a fees por pedido, sí afecta margen)
    - Tabla `ventas_plataforma_marca_mensual (mes, plataforma, marca, bruto, pedidos, comisiones, fees, promo, ads, neto_cobrado)`

## C.2 ADS informativo (NO restar a facturación)
48. Tabla Running: nueva columna ADS por mes/marca/canal — visualización informativa
49. Gráfico ADS evolución mensual por marca — para evaluar futuro mkt
50. NO restar ADS a facturación neta. NO afecta cálculo margen.

## C.3 Cargos promoción / fees afectan margen
51. Cálculo margen real = bruto − comisión − fees − cargos_promoción − IVA 21%
52. Mostrar desglose en card cuando se hace click en una plataforma

## C.4 Replicar lógica para Glovo y Just Eat
53. Stub parser Glovo resumen mensual (cuando llegue archivo ejemplo)
54. Stub parser Just Eat resumen mensual (cuando llegue archivo ejemplo)
55. Validación contra conciliación bancaria mensual

---

# FASE D · MÓDULO IMPORTADOR UNIFICADO (NUEVO)

## D.1 Estructura
56. Reemplazar módulo "Importar Plataformas" actual por uno nuevo llamado "**Importador**"
57. Ruta `/importador`
58. Icono: ArrowDownTray o Upload
59. Posición sidebar: bajo Conciliación, antes de Equipo
60. Tabs estilo Conciliación: Subir / Histórico / Pendientes

## D.2 Tab Subir
61. Dropzone único multi-formato
62. Detección automática del tipo de archivo subido:
    - Factura proveedor (PDF, imagen) → Conciliación · Facturas
    - Extracto bancario (CSV, XLSX) → Conciliación · Movimientos
    - Resumen mensual Uber (PDF, XLSX) → tabla `ventas_plataforma_marca_mensual`
    - Resumen mensual Glovo (PDF, XLSX) → tabla
    - Resumen mensual Just Eat (PDF, XLSX) → tabla
    - Nómina (PDF) → módulo Equipo · Nóminas
    - CSV ventas plataformas (CSV diario) → tabla `ventas_plataforma`
    - Otros: pedir confirmación al usuario qué tipo es
63. Auto-categorización tras detección
64. Toast de confirmación con resumen "Subido: factura Mercadona 31/01/26 — 1.352,71€"

## D.3 Tab Histórico
65. Lista de todo lo subido con: fecha subida, tipo, nombre archivo, importe (si aplica), estado
66. Filtros: por tipo, por fecha, por estado (procesado/pendiente revisión/error)
67. Click sobre item: abre detalle o redirige al módulo donde acabó

## D.4 Tab Pendientes
68. Lista de imports que requieren acción manual (ej: factura sin NIF detectable, archivo corrupto)
69. Acciones: editar, reasignar, eliminar

---

# FASE E · MÓDULO TAREAS PENDIENTES (NUEVO)

## E.1 Estructura
70. Crear módulo "**Tareas**" en sidebar
71. Ruta `/tareas`
72. Icono: ClipboardCheck o BellRing
73. Posición sidebar: TOP del sidebar, primer item (visibilidad máxima)
74. Indicador rojo con número en sidebar (estilo notificación) cuando hay pendientes

## E.2 Calendario de imports periódicos
75. Tabla BD `tareas_periodicas (id, nombre, frecuencia, dia_esperado, descripcion, modulo_destino)`
76. Seed inicial:
    - Resumen mensual Uber: día 5 de cada mes
    - Resumen mensual Glovo: día 5 de cada mes
    - Resumen mensual Just Eat: día 5 de cada mes
    - Facturas proveedores: cada lunes
    - Movimientos bancarios: cada lunes
    - Nóminas: día 28-31 de cada mes
    - Cierre fiscal trimestral: día 1 de abril, julio, octubre, enero
77. Tabla BD `tareas_pendientes (id, tarea_periodica_id, fecha_esperada, estado [pendiente/cumplida/atrasada], fecha_cumplida)`

## E.3 Vista calendario
78. Vista calendario mensual con tareas marcadas en su día esperado
79. Tareas cumplidas: verde con check
80. Tareas pendientes hoy: ámbar
81. Tareas atrasadas: rojo

## E.4 Vista lista
82. Lista de tareas pendientes ordenadas por urgencia
83. Cada tarea: título, fecha esperada, días de retraso, botón "Marcar como subida" (redirige al Importador)

## E.5 Indicador sidebar
84. Badge rojo con número de tareas pendientes/atrasadas total
85. Actualización en tiempo real al subir un archivo (decrementa)

## E.6 Alerta visual al entrar al ERP
86. Modal o banner top en página principal (Panel Global) si hay tareas atrasadas
87. Mensaje: "⚠️ Tienes pendiente subir: [lista de tareas atrasadas]. [Botón: Ir al Importador]"
88. Persistencia: si el usuario cierra el banner, no vuelve a aparecer hasta el día siguiente o nueva tarea pendiente

---

# CRITERIOS DE ACEPTACIÓN

1. Build OK sin errores
2. Mobile-friendly validado en 375px y 768px (cards apiladas, sidebar off-canvas)
3. Tipografía intracards Panel recuperada y legible (Oswald 2.4rem cards grandes)
4. Selector fechas con 7 opciones obligatorias en TODOS los módulos
5. Persistencia selección de periodo entre tabs del mismo módulo
6. Tabs estilo Conciliación exacto (#FF4757 activo) en TODO el ERP
7. NO hay guión amarillo subrayando en ninguna tab
8. Barras cumplimiento 8px alto, 4px radius, semáforo correcto en todo el ERP
9. Card Ventas Panel: objetivos editables inline, restauran al borrar
10. Card TM Panel: muestra bruto y neto verde al lado
11. Cards plataforma Panel: bruto vs neto con margen real validado
12. Días pico Panel: datos reales y cada barra color distinto
13. Re-arquitectura tabs Panel: 5 tabs con valor real, no duplicados, no placeholders
14. Módulo Importador unificado funcional con dropzone multi-formato
15. Módulo Tareas con calendario, indicador sidebar y alerta visual al entrar
16. Aislamiento Binagre vs David validado

# PIPELINE
1. pm-spec valida spec sin huecos
2. architect-review aprueba arquitectura
3. implementer ejecuta autónomo
4. qa-reviewer valida los 16 CA
5. erp-reviewer valida aislamiento

# DECISIONES AUTÓNOMAS
- Estructura interna de los módulos nuevos respetando guía de estilo
- Schema BD tablas nuevas
- Iconos Lucide React siguiendo convención existente
- Defaults sensatos sin preguntar

# CIERRE
- Commit + push master
- NO Vercel
- Informe final con build, validaciones, archivos creados/modificados, decisiones autónomas
