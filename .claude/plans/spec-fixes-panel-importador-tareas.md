# SPEC ADICIONAL — Fixes Panel Global + Importador unificado + Tareas pendientes + Mobile-friendly global

> Encolar tras Bloque MEGA. NO interrumpe el bloque actual.

## Modelos a usar

- **General de la sesión**: Claude Sonnet (modelo principal)
- **Subagentes**:
  - pm-spec: Sonnet
  - architect-review: Sonnet
  - implementer: Sonnet
  - implementer-fix: Sonnet
  - qa-reviewer: Sonnet
  - erp-reviewer: Sonnet (es revisión cruzada con repo David, requiere contexto amplio)
  - Tareas simples (renombrados, mover archivos, ediciones triviales): Haiku permitido

NO usar Opus salvo decisión arquitectural compleja explícita.

## Contexto

Tras review localhost del Bloque 1 ejecutado por Claude Code (27-abr-2026), Rubén detecta gaps de estilo y de contenido en Panel Global, además de necesidad de:
- Mobile-friendly global
- Doc maestro de estilo en Notion como única fuente de verdad
- Módulos nuevos: Importador unificado y Tareas pendientes
- Re-arquitectura tabs Panel con inventario previo de todo lo que había antes

Este spec consolida TODOS los fixes en un único bloque con 5 fases secuenciales.

## Regla maestra: GUÍA DE ESTILO ÚNICA

**Antes de implementar cualquier estilo, leer:**
- Notion: "🎨 Guía de estilo maestra · Streat Lab ERP" (page_id `350c8b1f-6139-8191-952a-f299926ac42f`, URL: https://www.notion.so/350c8b1f61398191952af299926ac42f)
- Repo: `/src/styles/tokens.ts`

**NO improvisar valores.** Si un valor no existe en la guía, primero actualizar la guía y luego implementar.

---

# FASE A · MOBILE-FRIENDLY GLOBAL

## A.1 Responsive en TODO el ERP

1. Sidebar: collapsable en mobile (off-canvas con burger)
2. Cards grid: 1 col mobile / 2 col tablet / 3-5 col desktop según contexto
3. Tablas con scroll horizontal en mobile, sticky primera columna
4. Selectores: full-width en mobile, inline en desktop
5. Touch targets: mínimo 44x44px en mobile
6. Breakpoints Tailwind estándar: sm 640 / md 768 / lg 1024 / xl 1280

## A.2 Validación obligatoria por módulo

Probar EXPLÍCITAMENTE cada módulo en estos viewports y dejar capturas en `.claude/tracking/mobile-validation/`:
- 375px (iPhone SE)
- 768px (tablet)
- 1280px (desktop)

Módulos a validar (en orden de prioridad):
7. Panel Global (5 tabs)
8. Conciliación
9. Facturación
10. Objetivos
11. Punto de Equilibrio
12. Running Financiero
13. Importador (nuevo)
14. Tareas (nuevo)
15. Configuración (5 tabs)
16. Equipo (cuando exista, FASE 3 del MEGA)

## A.3 Tipografía responsive

17. Valores KPI grandes: 2.4rem desktop, 1.8rem tablet, 1.5rem mobile
18. Títulos página: 22px desktop, 18px mobile
19. Body: 14px siempre
20. Sublabels cards: 12px siempre

---

# FASE B · PANEL GLOBAL · FIXES PROFUNDOS

## B.1 Tipografía intracards (CRÍTICO)

21. Recuperar tipografía intracards anterior (más legible, más grande)
22. Valores numéricos en cards grandes: Oswald 2.4rem 600
23. Valores numéricos en cards medianas: Oswald 1.6rem 600
24. Sublabels: Oswald 12px 500 letter-spacing 2px MAYÚSCULAS
25. Texto de barras y delta: Lexend 12px 400

## B.2 Selector de fechas global (CRÍTICO)

26. Reemplazar selector actual por uno con estas opciones EXACTAS:
    1. Semana actual
    2. Últimos 7 días
    3. Mes en curso
    4. Un mes hasta ahora
    5. Últimos 60 días
    6. Personalizado (abre rango date picker)
    7. **Semanas X** (al pulsar despliega 2º dropdown a la derecha con: Semana 18, Semana 17, Semana 16, ... hasta Semana 1 año en curso)
27. Aplicar este selector a TODOS los módulos del ERP que tengan selector de fechas: Panel, Facturación, Conciliación, PE, Running, Objetivos, Importador, Tareas
28. Componente compartido `<SelectorFechaUniversal />` en `/src/components/ui/`

## B.3 Persistencia y propagación del selector

29. La selección elegida queda fija para TODAS las tabs del módulo hasta que: se refresque la página, o se cambie manualmente
30. Persistir en `sessionStorage` por módulo (key: `selector_fecha_${modulo}`)
31. **Cualquier gráfico, card, tabla o KPI del módulo se adapta automáticamente al periodo seleccionado**:
    - Si seleccionas "Día": todos los datos son del día
    - Si seleccionas "Mes en curso": todos los datos son del mes
    - Si seleccionas "Semanas X · Semana 17": todos los datos son de S17
    - Comparativas vs anterior se ajustan al mismo periodo (Día vs Día anterior, Mes vs Mes anterior, Semana vs Semana anterior)
32. NO mezclar datos de distintos periodos en mismo módulo

## B.4 Tabs estilo Conciliación EXACTO (CRÍTICO)

33. Reemplazar tabs actuales del Panel (General/Operaciones/Finanzas/Cashflow/Marcas) por estilo Conciliación
34. Valores literales obligatorios (NO interpretar):
    ```ts
    tabActiva = {
      padding: '6px 14px',
      borderRadius: 6,
      border: 'none',
      background: '#FF4757',
      color: '#ffffff',
      fontFamily: 'Lexend, sans-serif',
      fontSize: 13,
      fontWeight: 500,
      transition: 'background 150ms'
    }
    tabInactiva = {
      padding: '6px 14px',
      borderRadius: 6,
      border: '0.5px solid #d0c8bc',
      background: 'transparent',
      color: '#3a4050',
      fontFamily: 'Lexend, sans-serif',
      fontSize: 13,
      fontWeight: 500
    }
    ```
35. Usar funciones `tabActiveStyle` y `tabInactiveStyle` de `/src/styles/tokens.ts` que ya existen
36. Aplicar a TODAS las tabs del ERP: Panel, Facturación, Conciliación, Objetivos, Running, PE, Configuración, Equipo (cuando exista), Importador, Tareas
37. NO usar guión amarillo subrayando NUNCA
38. NO usar el rojo Streat Lab #B01D23 en tabs (es para títulos)
39. El rojo de tabs es SIEMPRE #FF4757
40. Botones pequeños y juntos (gap 8px máximo entre tabs)

## B.5 Barras de cumplimiento estándar

41. Estilo único válido para barras de cumplimiento en TODO el ERP. Referencia: tabla histórico módulo Objetivos (S17 a S6 que se ve en captura actual).
42. Valores literales:
    ```ts
    barra = {
      height: 8,
      borderRadius: 4,
      background: '#ebe8e2',
      transition: 'width 0.5s ease'
    }
    fillVerde = '#1D9E75'  // ≥ 80%
    fillAmbar = '#f5a623'  // 50-79%
    fillRojo = '#E24B4A'   // < 50%
    ```
43. Multi-segmento (cumplido + pendiente): verde la parte cumplida, rojo la parte pendiente, división clara
44. Componente compartido `<BarraCumplimiento porcentaje={pct} multiSegmento={bool} />`
45. Aplicar a las barras de Card Ventas en Panel (semanal/mensual/anual)
46. Aplicar a cualquier otra barra de cumplimiento en el ERP

## B.6 Card Ventas: objetivos reales del módulo Objetivos

47. Card Ventas lee los objetivos REALES de la tabla `objetivos` BD (semanal, mensual, anual)
48. Mostrar tres líneas: SEMANAL, MENSUAL, ANUAL — cada una con barra de cumplimiento estilo B.5
49. Editables inline: pulso sobre la cifra del objetivo y se convierte en input
50. Si guardo un valor nuevo: se actualiza en BD tabla `objetivos`
51. Si borro el valor (input vacío + enter): se restaura el original de BD automáticamente
52. Toast feedback: "Objetivo actualizado" / "Objetivo restaurado"
53. Cambios propagan al módulo Objetivos en tiempo real (mismo origen de datos)

## B.7 Card TM bruto vs neto

54. Card TM muestra dos valores en línea:
    - Izquierda: TM bruto (color pri #111111, Oswald 2.4rem 600) → lo facturado
    - Derecha en verde (#1D9E75, Oswald 1.4rem 600): TM neto → lo cobrado
55. Sublabel: "BRUTO · NETO"
56. Cálculo TM bruto = ingresos_brutos / pedidos del periodo
57. Cálculo TM neto = ingresos_netos / pedidos del periodo

## B.8 Cards plataformas: facturado vs cobrado real

58. Cada card de plataforma (Uber/Glovo/Just Eat/Web/Directa) muestra:
    - Bruto facturado (lo que el cliente pagó en la plataforma)
    - Neto cobrado real (lo que efectivamente entra a cuenta tras comisiones, fees, ADS NO, IVA)
    - % margen real
59. Cálculo neto cobrado UBER (con resumen mensual cargado, ver FASE C):
    ```
    neto_cobrado = bruto - comision% × bruto - fees - cargos_promocion - IVA(21%) × (comision + fees + cargos)
    ```
    Importante: ADS NO se restan al neto. Son gasto informativo separado.
60. Cálculo neto Glovo/Just Eat: similar pero con sus tasas específicas (leer de tabla `canales`)
61. Cálculo neto Web/Directa: bruto - comisión pasarela
62. **Validación conciliación bancaria** (CRÍTICO):
    - Cada cierre mensual: comparar suma neto_cobrado plataforma con suma de ingresos bancarios concepto plataforma X en `movimientos_bancarios`
    - Tabla `validaciones_plataforma_banca (mes, plataforma, neto_calculado, neto_bancario, diferencia, estado [OK/ALERTA/ERROR])`
    - Tolerancia OK: ≤ 1% diferencia
    - Alerta: 1-5% diferencia (icono ámbar en card)
    - Error: > 5% (icono rojo + tooltip con detalle)
    - Visualizar estado en tooltip al hover sobre % margen card

## B.9 Días pico (datos reales + colores distintos)

63. Datos reales calculados de tabla `facturacion_diaria`
64. Cada barra del gráfico de un color diferente:
    - Lunes: #1E5BCC (azul Emilio)
    - Martes: #06C167 (verde Uber)
    - Miércoles: #f5a623 (ámbar)
    - Jueves: #B01D23 (rojo SL)
    - Viernes: #66aaff (azul claro)
    - Sábado: #F26B1F (naranja Rubén)
    - Domingo: #1D9E75 (verde oscuro)
65. Barras con valor numérico encima
66. Click sobre día = filtra Panel a ese día de la semana en el periodo seleccionado

## B.10 Re-arquitectura tabs Panel

### B.10.1 ENTREGABLE OBLIGATORIO PREVIO

67. Antes de redistribuir tabs, generar archivo `.claude/tracking/inventario-elementos-modulos-viejos.md` con:
    - Lista TODA la infografía/gráficos/cards/tablas que había en cada módulo del ERP antes del rework
    - Por cada elemento: nombre, módulo origen, qué dato muestra, fuente del dato, ¿aporta valor único o duplica?
    - Módulos a inventariar: Panel viejo, Running, PE, Conciliación, Análisis (eliminado), Facturación, Objetivos
    - Marcar elementos como: VALOR ÚNICO / DUPLICADO / OBSOLETO / PLACEHOLDER

### B.10.2 Identificar valor real

68. Cards/gráficos marcados VALOR ÚNICO se mantienen
69. DUPLICADOS: dejar solo en módulo más relevante, eliminar resto
70. OBSOLETO: eliminar
71. PLACEHOLDER: implementar contenido real o eliminar

### B.10.3 Distribución entre 5 tabs

Cada tab con su set de cards/gráficos sin duplicar entre tabs:

**Tab General**:
- Card Ventas (con objetivos reales editables) — B.6
- Card Pedidos totales con desglose por canal
- Card TM bruto vs neto — B.7
- Cards plataformas (5: Uber/Glovo/Just Eat/Web/Directa) con bruto vs neto — B.8
- Días pico con colores — B.9
- Top ventas (productos más vendidos del periodo)

**Tab Operaciones**:
- Pedidos por hora (heatmap simplificado mañana/mediodía/tarde/noche)
- Ratio ALM vs CENA con tendencia
- Mix canales (% pedidos por canal — barras horizontales)
- Evolución pedidos vs semana/mes anterior (línea temporal)
- KPI repetición clientes (cuando se tenga dato del POS)

**Tab Finanzas**:
- Ingresos brutos del periodo
- Comisiones plataformas detalladas
- Ingresos netos
- Ratio gastos/netos
- Margen real validado contra conciliación
- Comparativa vs presupuesto Objetivos
- ADS por marca/canal (informativo, NO resta) — referencia FASE C.2

**Tab Cashflow**:
- Cobros pendientes detallados por canal con fecha estimada cobro
- Pagos pendientes detallados por proveedor con fecha vencimiento
- Provisiones IVA / IRPF
- Gráfico saldo proyectado 7d / 30d / 3m / 6m / 1a
- Calendario pagos críticos próximos 90d

**Tab Marcas**:
- Matriz cruzada Plataforma × Marca (heatmap por bruto)
- Top 5 marcas del periodo
- Margen real por combinación marca × canal
- Evolución mensual marca
- Acciones recomendadas (motor decisiones desde PE)

72. NO repetir datos entre tabs (TM en card grande Y en tab Operaciones es duplicado, eliminar el segundo)

---

# FASE C · DATOS PLATAFORMA REALES (UBER PRIMERO, LUEGO RESTO)

## C.1 Subir resúmenes mensuales por marca al ERP

73. Crear sección en módulo Importador (FASE D) para subir resúmenes mensuales de plataformas
74. Tipo de archivo aceptado: PDF + XLSX
75. Parser Uber resumen mensual extrae por marca:
    - Bruto facturado
    - Pedidos
    - Comisiones plataforma
    - Fees por pedido
    - Cargos de promoción (equivalen a fees adicionales según pedido)
    - ADS / Gastos por anuncios
    - Neto cobrado real
76. Tabla BD `ventas_plataforma_marca_mensual`:
    ```sql
    (id, mes, año, plataforma, marca, bruto, pedidos, comisiones, fees, cargos_promocion, ads, neto_cobrado, archivo_origen, fecha_subida)
    ```

## C.2 Vista detallada de resúmenes tras subir

77. Ruta `/importador/resumenes-plataforma`
78. Tabla con todos los resúmenes subidos: mes/año, plataforma, marca, bruto, neto, ADS
79. Filtros: por mes, por plataforma, por marca
80. Click sobre fila abre modal con detalle completo del resumen + link a PDF original
81. Botón "Ir a Running" enlaza a Running con filtros aplicados de esa marca/canal/mes
82. Botón "Ver en Panel · Marcas" enlaza a Panel tab Marcas con filtros aplicados

## C.3 ADS informativo (NO restar a facturación)

83. Tabla Running: nueva columna ADS por mes/marca/canal — visualización informativa
84. Gráfico ADS evolución mensual por marca en Running tab Comparativas
85. NO restar ADS a facturación neta ni en Panel ni en Running ni en Conciliación
86. NO afecta cálculo margen real
87. Tooltip al hover sobre ADS: "Gasto en publicidad pagada (Uber Ads, Glovo Promo, etc.). Informativo. No afecta margen."

## C.4 Cargos promoción / fees afectan margen real

88. Cálculo margen real = bruto − comisión − fees − cargos_promocion − IVA(21%)
89. Mostrar desglose en card cuando se hace click en una plataforma
90. Modal detalle: Bruto / -Comisión X% / -Fees / -Cargos promo / -IVA / = Neto cobrado

## C.5 Validación contra conciliación bancaria (definido en B.8 punto 62)

91. Cron mensual: día 5 del mes siguiente, comparar todos los neto_cobrado plataforma del mes anterior con `movimientos_bancarios` ingresos plataforma
92. Generar registros tabla `validaciones_plataforma_banca`
93. Notificación en módulo Tareas si hay alertas o errores

## C.6 Replicar lógica para Glovo y Just Eat

94. Stub parser Glovo resumen mensual (cuando llegue archivo ejemplo de Rubén)
95. Stub parser Just Eat resumen mensual (cuando llegue archivo ejemplo de Rubén)
96. Hasta entonces: mostrar mensaje en Importador "Parser Glovo/Just Eat pendiente. Subir archivo ejemplo a Tareas para activarlo."

---

# FASE D · MÓDULO IMPORTADOR UNIFICADO (NUEVO)

## D.1 Estructura

97. Reemplazar módulo "Importar Plataformas" actual por uno nuevo llamado "**Importador**"
98. Ruta `/importador`
99. Icono: ArrowDownTray (Lucide React)
100. Posición sidebar: bajo Conciliación, antes de Equipo
101. Tabs estilo Conciliación: Subir / Histórico / Pendientes / Resúmenes plataforma

## D.2 Tab Subir

102. Dropzone único multi-formato (drag&drop + click para seleccionar)
103. Detección automática del tipo de archivo subido por contenido + extensión + NIF emisor:
    - Factura proveedor (PDF, imagen) → Conciliación · Facturas (NIF emisor en BBDD)
    - Extracto bancario (CSV, XLSX con cabeceras tipo BBVA) → Conciliación · Movimientos
    - Resumen mensual Uber (PDF con NIF B88515200 + estructura por marca) → tabla `ventas_plataforma_marca_mensual`
    - Resumen mensual Glovo (PDF con NIF B67282871) → tabla
    - Resumen mensual Just Eat (PDF/XLSX con cabecera Just Eat) → tabla
    - Nómina (PDF con cabecera nómina + IBAN empleado) → módulo Equipo · Nóminas
    - CSV ventas plataformas (CSV diario tipo POS) → tabla `ventas_plataforma`
    - Otros / no detectable: pedir confirmación al usuario qué tipo es
104. Auto-categorización tras detección
105. Toast confirmación con resumen: "Subido: factura Mercadona 31/01/26 — 1.352,71€"

## D.3 Tab Histórico

106. Lista de todo lo subido con: fecha subida, tipo, nombre archivo, importe (si aplica), estado
107. Filtros: por tipo, por fecha, por estado (procesado/pendiente revisión/error)
108. Click sobre item: abre detalle o redirige al módulo donde acabó

## D.4 Tab Pendientes

109. Lista de imports que requieren acción manual (factura sin NIF detectable, archivo corrupto, parser pendiente)
110. Acciones: editar, reasignar, eliminar
111. Botón "Reintentar parser" si el parser falló

## D.5 Tab Resúmenes plataforma (definido en C.2)

Ya cubierto en C.2 puntos 77-82.

---

# FASE E · MÓDULO TAREAS PENDIENTES (NUEVO)

## E.1 Estructura

112. Crear módulo "**Tareas**" en sidebar
113. Ruta `/tareas`
114. Icono: BellRing (Lucide React)
115. Posición sidebar: TOP del sidebar, primer item (visibilidad máxima)
116. Indicador rojo con número en sidebar (estilo notificación) cuando hay pendientes/atrasadas

## E.2 Calendario de imports periódicos

117. Tabla BD `tareas_periodicas`:
    ```sql
    (id, nombre, frecuencia [diaria/semanal/quincenal/mensual/trimestral], dia_esperado, descripcion, modulo_destino, activa)
    ```
118. Seed inicial:
    - Resumen mensual Uber: día 5 de cada mes
    - Resumen mensual Glovo: día 5 de cada mes
    - Resumen mensual Just Eat: día 5 de cada mes
    - Facturas proveedores: cada lunes (revisar inbox)
    - Movimientos bancarios: cada lunes (descargar BBVA)
    - Nóminas: día 28-31 de cada mes
    - Cierre fiscal trimestral: día 1 de abril, julio, octubre, enero
119. Tabla BD `tareas_pendientes`:
    ```sql
    (id, tarea_periodica_id, fecha_esperada, estado [pendiente/cumplida/atrasada], fecha_cumplida, archivo_id_relacionado)
    ```

## E.3 Vista calendario

120. Vista calendario mensual con tareas marcadas en su día esperado
121. Tareas cumplidas: verde con check
122. Tareas pendientes hoy: ámbar
123. Tareas atrasadas: rojo

## E.4 Vista lista

124. Lista de tareas pendientes ordenadas por urgencia
125. Cada tarea: título, fecha esperada, días de retraso, botón "Marcar como subida" (redirige al Importador)

## E.5 Indicador sidebar

126. Badge rojo con número de tareas pendientes/atrasadas total
127. Actualización en tiempo real al subir un archivo (decrementa)
128. Componente `<SidebarBadge count={N} />` reutilizable

## E.6 Alerta visual al entrar al ERP

129. Modal o banner top en página principal (Panel Global) si hay tareas atrasadas
130. Mensaje: "⚠️ Tienes pendiente subir: [lista de tareas atrasadas]. [Botón: Ir al Importador]"
131. Persistencia: si el usuario cierra el banner, no vuelve a aparecer hasta el día siguiente o nueva tarea pendiente
132. localStorage key `banner_tareas_pendientes_dismissed_${fecha}`

---

# CRITERIOS DE ACEPTACIÓN

1. Build OK sin errores
2. Mobile-friendly validado en 375px, 768px y 1280px en TODOS los módulos listados (capturas en `.claude/tracking/mobile-validation/`)
3. Tipografía intracards Panel recuperada y legible (Oswald 2.4rem cards grandes)
4. Selector fechas con 7 opciones obligatorias en TODOS los módulos
5. Persistencia selección de periodo entre tabs del mismo módulo (sessionStorage)
6. TODOS los gráficos/cards/tablas se adaptan al periodo seleccionado
7. Tabs estilo Conciliación exacto (#FF4757 activo) en TODO el ERP
8. NO hay guión amarillo subrayando en ninguna tab
9. Barras cumplimiento 8px alto, 4px radius, semáforo correcto en todo el ERP
10. Card Ventas Panel: objetivos editables inline, restauran al borrar
11. Card TM Panel: muestra bruto y neto verde al lado
12. Cards plataforma Panel: bruto vs neto con margen real validado
13. Validación conciliación bancaria implementada (tabla `validaciones_plataforma_banca`)
14. Días pico Panel: datos reales y cada barra color distinto
15. Inventario obligatorio generado (`inventario-elementos-modulos-viejos.md`)
16. Re-arquitectura tabs Panel: 5 tabs con valor real, no duplicados, no placeholders
17. Vista detallada resúmenes plataforma en `/importador/resumenes-plataforma`
18. ADS solo informativo en Running, NO resta a facturación
19. Cargos promoción/fees afectan margen real con desglose en modal
20. Módulo Importador unificado funcional con dropzone multi-formato
21. Módulo Tareas con calendario, indicador sidebar y alerta visual al entrar
22. Aislamiento Binagre vs David validado por erp-reviewer

---

# PIPELINE OBLIGATORIO

1. pm-spec valida spec sin huecos
2. architect-review aprueba arquitectura
3. implementer ejecuta autónomo (Sonnet)
4. qa-reviewer valida los 22 CA
5. erp-reviewer valida aislamiento

Si qa-reviewer detecta fallos: implementer-fix antes de cierre.

---

# DECISIONES AUTÓNOMAS PERMITIDAS

El implementer puede tomar autónomamente:
1. Estructura interna de los módulos nuevos respetando guía de estilo Notion
2. Schema BD tablas nuevas (`ventas_plataforma_marca_mensual`, `tareas_periodicas`, `tareas_pendientes`, `validaciones_plataforma_banca`)
3. Iconos Lucide React siguiendo convención existente
4. Componentes compartidos en `/src/components/ui/` (`SelectorFechaUniversal`, `BarraCumplimiento`, `SidebarBadge`)
5. Defaults sensatos para campos sin valor
6. Mapping tipos de archivo para detección automática

El implementer DEBE preguntar SOLO si:
1. Va a borrar datos de producción sin backup
2. Detecta dependencia con módulo David (debe parar)
3. Encuentra ambigüedad de mapping con riesgo financiero alto

**Para todo lo demás: decide autónomamente, documenta en `summary.md`, sigue.**

---

# CIERRE

- Commit final con mensaje descriptivo + push master
- NO Vercel hasta confirmación Rubén
- Informe final con: build, validaciones pasadas/falladas, archivos creados/modificados/eliminados, decisiones autónomas tomadas en cada fase

---

# ORDEN DE EJECUCIÓN

Ejecutar fases EN ORDEN sin parar:

1. FASE A (mobile-friendly) → validar viewports → continuar
2. FASE B (Panel Global fixes profundos) → validar build OK + capturas → continuar
3. FASE C (datos plataforma reales) → validar parser Uber contra casos prueba → continuar
4. FASE D (Importador unificado) → validar dropzone + detección → continuar
5. FASE E (Tareas pendientes) → validar indicador + alerta → cerrar

Commit intermedio tras cada fase:
```
git add . && git commit -m "feat(fixes): FASE X completada" && git push origin master
```

Cierre final tras FASE E:
```
git add . && git commit -m "feat(fixes): completo - mobile + Panel + Importador + Tareas" && git push origin master
```

NO Vercel. Solo localhost.
