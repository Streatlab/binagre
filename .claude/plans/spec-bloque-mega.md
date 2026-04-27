# SPEC — Bloque MEGA · 1.5 Re-trabajo + 2 Plataformas + G Equipo + H Escandallo + I Inventario + J Menu Engineering

## Contexto
Tras Bloque 1 ejecutado por Claude Code (27-abr-2026), Rubén detecta gaps de calidad (estilos pobres, placeholders, módulos sin tocar) y faltan ~85 tareas más entre re-trabajo, Bloque 2 plataformas, módulo Equipo, conexión Escandallo, Inventario y Menu Engineering.

Este spec consolida TODO en un único bloque dividido en 6 fases secuenciales para ejecutar en una sola sesión Claude Code sin paradas.

## Reglas duras vigentes
1. Aislamiento absoluto Binagre ↔ David (RULES.md §1)
2. Tokens canónicos #B01D23 / #1e2233 / #e8f442 / #484f66 / #0a0a0a (RULES.md §2)
3. Modo localhost — NO Vercel hasta confirmación Rubén (RULES.md §3)
4. Ejecución autónoma sin preguntas resolubles (RULES.md §8)
5. Spec sin huecos, decidir y avanzar (RULES.md §9)
6. **NUEVA:** estilo visual de TODOS los módulos debe replicar Conciliación como referencia de oro

## Constantes (NO preguntar)
```ts
const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'
const NIF_RUBEN = '21669051S'
const NIF_EMILIO = '53484832B'
const DRIVE_OPERACIONES_ID = '1dB6REknvNl8JxGGuv8MXloUCJ3_evd7H'
const COLOR_RUBEN = '#F26B1F'
const COLOR_EMILIO = '#1E5BCC'
const RED_SL = '#B01D23'
const SIDEBAR_BG = '#1e2233'
const ACCENT_PANEL = '#e8f442'
const MODAL_BG = '#484f66'

// Ciclos pago plataformas
const CICLOS_PAGO = {
  uber: 'lunes_semanal',
  glovo: 'quincenal_5_y_20_mes_siguiente',
  just_eat: 'quincenal_20_y_5',
  directa: 'al_dia',
  web: 'pendiente'
}
```

---

# FASE 1 · RE-TRABAJO BLOQUE 1 (correcciones obligatorias antes de avanzar)

## 1.1 Estilo unificado patrón Conciliación

**Conciliación es la referencia visual de oro. TODOS los módulos deben replicar este patrón.**

### Patrón Cards
1. Cards grandes con número gigante (font-size XL bold) en color destacado según tipo
2. Subtítulos en MAYÚSCULAS finas (letter-spacing alto, font-weight medium)
3. Comparativas inline con flecha y % ("▲ 11% vs período anterior" / "▼ 2% vs período anterior")
4. Desglose interno con barras de color por canal/categoría
5. Layout 12 columnas, cards proporcionadas
6. Selectores integrados en header arriba derecha
7. Padding generoso, bordes redondeados suaves

### Patrón TABS (CRÍTICO)
**Estilo Conciliación: Resumen / Movimientos**
- Botón con padding 12px 24px
- Tab activa: fondo `#B01D23`, texto blanco, sin borde
- Tab inactiva: fondo blanco, texto gris oscuro, borde fino
- Bordes redondeados 8px
- Hover en inactivas: fondo gris muy claro
- **PROHIBIDO**: guión amarillo subrayando, acento amarillo del v1, cualquier otro patrón

### Aplicar este patrón a:
1. Panel Global: rehacer tabs General/Operaciones/Finanzas/Cashflow/Marcas con patrón Conciliación
2. Facturación: conmutador Diario/Semanas/Meses/Año como tabs estilo Conciliación
3. Objetivos: tabs Objetivos de venta / Presupuesto de gastos como Conciliación
4. Running: tabs Resumen / PyG detallado / Comparativas como Conciliación
5. Punto Equilibrio: tabs Resumen / Día semana / Simulador / Escenarios / Tesorería futura como Conciliación
6. Configuración: tabs Marcas / Categorías / Plataformas / Cuentas / Usuarios como Conciliación

## 1.2 Panel Global · re-trabajo

### Tab General
1. Cards grandes superiores (4 fijas): contenido cambia según selector vista (Día/Semana/Mes/Año)
2. Vista Día: Día / Semana / Mes / Año
3. Vista Semanas: Semana / Mes / 3 meses / Año
4. Vista Meses: Mes / 3 meses / 6 meses / Año
5. Vista Año: Mes / Trimestre / Semestre / Año
6. Cards canal Uber/Glovo/Just Eat/Web/Directa: rellenar con datos reales o último mes con datos
7. Card Ventas: objetivos lectura desde Objetivos (no hardcoded)
8. Card Ventas: pulsar el número del objetivo abre input inline editable
9. Card Ventas: si guarda 0, restaura valor original del módulo Objetivos
10. Cards canal: corregir neto = bruto − (bruto × comisión%) − (pedidos × comisión fija) − IVA 21% × (comisión% + comisión fija)
11. Cards canal: leer comisiones de tabla `canales` BD, no hardcoded
12. Card Margen: recalcular automáticamente tras cards canal corregidas
13. Card Días pico: respetar selector periodo global

### Tab Operaciones
14. NO placeholder. Implementar real con cards estilo Conciliación:
    - Pedidos totales (período) + comparativa
    - Ticket medio + comparativa
    - Pedidos por hora pico + heatmap simplificado
    - Mix canales (% pedidos por canal con barras)

### Tab Finanzas
15. NO placeholder. Implementar real con cards estilo Conciliación:
    - Ingresos brutos + Comisiones + Ingresos netos (3 cards)
    - Sparklines mensuales por canal
    - Ratio Gastos/Netos con semáforo

### Tab Cashflow
16. NO placeholder. Implementar gráfico real:
    - Línea temporal saldo proyectado 7d / 30d / 3m / 6m / 1a
    - Cobros pendientes (de facturas plataforma)
    - Pagos pendientes (fijos + facturas pendientes)
    - Provisiones IVA / IRPF visualizadas

### Tab Marcas
17. Esqueleto de vista cruzada Plataforma × Marca
    - Tabla pivote: filas marcas, columnas canales, celdas: bruto / pedidos / margen
    - Heatmap visual con intensidad por color
    - Top 5 marcas del periodo
    - (Datos reales se conectan en FASE 2)

### Header Panel Global
18. Selector "Rango personalizado" mover a la derecha de "Todos los canales" (no arriba)
19. Selector semana "S17 — 20/04/26" desplegable a la derecha
20. Botón derecho "Todos" → "Canales"

## 1.3 Facturación · re-trabajo completo

21. Eliminar hilera cards medianas (Facturación bruta / Pedidos / TM / Facturación diaria)
22. Cards grandes 4 fijas con contenido dinámico según vista
23. Conmutador Diario / Semanas / Meses / Año como tabs estilo Conciliación (no botones rojo separados)
24. Añadir vista Año
25. Vista Diario · cards: Día / Semana / Mes / Año
26. Vista Semanas · cards: Semana / Mes / 3m / Año
27. Vista Meses · cards: Mes / 3m / 6m / Año
28. Vista Año · cards: Mes / Trimestre / Semestre / Año
29. Formato fechas español: "Lunes, 4 abril 2026" / "Semana 17 — 4 abril"
30. Botón derecho "Todos" → "Canales"
31. Filtro servicio Todos/ALM/CENAS izquierda mantiene
32. Tabla diaria columna SERV: ALM, CENA, ALM+CENA según día (no fijo TODO)
33. Día con ambos: dos filas dentro del día
34. Día solo ALM: no mostrar fila CENA vacía
35. Día solo CENA: no mostrar fila ALM vacía
36. Importar histórico Excel almuerzos/cenas a BD vía script (Claude lo hace, autónomo)

## 1.4 Objetivos · re-trabajo

37. Día actual NO en rojo (cambiar a borde grueso azul o fondo destacado claro)
38. Quitar "S18" del subtítulo de la card "Objetivo por día"
39. Título "S18" → "S18 — 27/04/26" como selector
40. Selector navega semanas pasadas y futuras hasta fin año actual + año siguiente
41. Tabla histórico: añadir columna % Real
42. Tabla histórico: añadir columna % Desviación
43. **Crear tab Presupuestos estilo Conciliación**: tabla 12m × 5 categorías (Producto/Equipo/Local/Controlables/Plataformas), editable inline
44. Tab Presupuestos botón "Copiar año anterior"
45. Tab Presupuestos: total mensual y anual auto-calculado

## 1.5 Conciliación · completar lo pendiente

46. Título solo "Conciliación" (quitar "Resumen ·")
47. Quitar selector titular bancario (auto NIF)
48. Selector Categoría alineado a 5 categorías nuevas (no Ingresos plataformas/web separadas)
49. Importar extracto: aceptar PDF/Excel/imagen + CSV/XLSX
50. Card "Todo al día": letras verdes + quitar leyenda + mismo tamaño otras
51. Selector arriba: añadir vista Por semanas formato S17 — 27/04/26
52. Cards Ingresos/Gastos/Balance/Pendientes: subtítulo dinámico según selector
53. Columna Contraparte: proveedor real si hay factura asociada
54. Columna PDF → Doc
55. Eliminar card "Categorías de gastos" duplicada
56. Eliminar columna gris de gastos
57. Card Tesorería vs Caja líquida: revisar y simplificar (si duplica, eliminar y dejar solo una)
58. Cobros pendientes: calcular real según ciclos plataformas
59. Pagos pendientes: calcular real (fijos + variables)
60. Proyección 7d/30d/3m/6m/1a barra verde tipo Hoy → 30d
61. Eliminar card Ratio Ingresos/Gastos (ya en Running)
62. Eliminar Balance Neto duplicado
63. Cards Presupuestos solo lectura (5 cards Producto/Equipo/Local/Controlables/Plataformas con consumo vs presupuesto Objetivos y semáforo)
64. Eliminar gráficos Ingresos vs Gastos semanal e Ingresos/Gastos/Saldo (van a Panel Cashflow)
65. Dropzone único: extractos + facturas, auto-detección
66. Filtros rápidos: Pendientes/Asociadas/Faltantes/Duplicadas/Sin titular sobre tabla
67. Buscador unificado: proveedor / nº factura / importe / concepto
68. Botón "+ Añadir gasto" desde Running se mueve aquí

## 1.6 Running · re-trabajo

69. Quitar toggle Sin IVA/Con IVA (siempre sin IVA)
70. Quitar selector Todos los socios
71. Quitar botón "+ Añadir gasto" (movido a Conciliación)
72. Sparklines visuales rehechas (mostrar tendencia útil, no decoración)
73. Tabs estilo Conciliación: Resumen / PyG detallado / Comparativas
74. Tab Resumen: cards Cashflow real + cards Facturación bruta / Ingresos netos / Total gastos / Resultado / Prime Cost / EBITDA
75. Cards mantienen Cashflow real izquierda y derecha intactas
76. Desglose 5 categorías con % sobre ingresos vs banda objetivo (semáforo)
77. Tab PyG detallado: tabla anual completa (arreglar corte derecho)
78. Estructura PyG: Brutos → Comisiones → Netos → COGS → Margen bruto → Labor → Prime Cost → Occupancy → OPEX → EBITDA → Provisiones → Limpio
79. Subtítulos inglés benchmark: "Producto · COGS", "Equipo · Labor", "Local · Occupancy", "Controlables · OPEX"
80. Columna acumulado anual al final
81. Tab Comparativas: vs Presupuesto / vs Año anterior / vs Media 3-6-12 meses
82. Eliminar bloque "Ingresos por marca" vacío
83. Eliminar bloque "Sueldos del periodo" duplicado
84. Ratio Gastos/Netos solo aquí (eliminar de Conciliación)

## 1.7 Punto Equilibrio · re-trabajo completo

85. Eliminar toggle Sin IVA/Con IVA (cálculo interno)
86. Cards grandes estilo Panel Global con selector periodo día/sem/mes/60d/90d/6m/año
87. Tabs estilo Conciliación: Resumen / Día semana / Simulador / Escenarios / Tesorería futura
88. Tab Resumen portada:
    - "¿Cubrimos fijos hoy?" Sí/No + margen
    - "¿Qué día cubrimos fijos con objetivo?"
    - "¿Y con real actual?"
    - KPI pedidos/día y TM real necesarios
    - Acciones recomendadas (mantener, motor decisiones)
89. Tab Día semana: rehacer dentro de cards grandes
90. Tab Simulador: sliders inline integrados, feedback inmediato
91. Tab Escenarios (ex-módulo Análisis):
    - Qué pasa si subo precio 5%
    - Qué pasa si bajo food cost 2%
    - Qué pasa si recupero 5% directa
    - Qué pasa si añado 1 marca
    - Guardables y comparables
92. Tab Tesorería futura:
    - Provisiones IVA/IRPF (mover desde Configuración)
    - Calendario pagos críticos próximos 90 días

## 1.8 Configuración · re-trabajo

93. 4 tabs principales estilo Conciliación: Marcas / Categorías financieras / Plataformas y canales / Cuentas y conexiones
94. 5ª tab: Usuarios y permisos
95. Eliminar tab Tipos de cocina (mover a propiedad de Marca)
96. Eliminar tab Accesos Uber (mover como subsección de Plataformas)
97. Eliminar tab Presupuestos mensuales (mover a Objetivos · tab Presupuestos)
98. Eliminar tab Provisiones IVA/IRPF (mover a PE · tab Tesorería futura)
99. Tab Marcas:
    - Lista marcas con canales activos multi-select
    - Margen objetivo configurable por marca (default 70%)
    - Estado ACTIVA/PAUSADA
    - Tipo cocina como propiedad
100. Tab Categorías financieras:
    - Lista única 5 categorías + subcategorías plan contable
    - Editable: añadir/renombrar/eliminar
    - Cambios propagan automáticamente a Conciliación, Running, Objetivos, PE
101. Tab Plataformas y canales:
    - Lista canales: nombre, % comisión, € fijo por pedido, ciclo pago
    - Reglas auto-categorización NIF emisor → categoría
102. Tab Cuentas y conexiones:
    - Cuentas bancarias activas con saldo (eliminar campos vacíos)
    - Drive Google ya conectado
    - Espacio futuras integraciones POS
103. Tab Usuarios y permisos:
    - Roles predefinidos: Admin, Socio, Equipo cocina, Repartidor, Solo lectura
    - Permisos custom por usuario por módulo (lectura/edición/sin acceso)

### Reglas oro Configuración (validar en QA)
104. Una variable se define UNA vez en Configuración y se LEE en todos los módulos, nunca se duplica
105. Pausar marca en Configuración propaga ocultamiento automático en Panel/Facturación/Análisis
106. Añadir categoría en Configuración propaga aparición automática en Conciliación/Running/Objetivos/PE

## 1.9 Calendario operativo · re-trabajo

107. Configuración nuevo tab Calendario operativo (mensual navegable)
108. Click día asigna tipo: Operativo / Solo comida / Solo cena / Cerrado total / Festivo / Vacaciones
109. Bulk operations rangos
110. Tabla BD `calendario_operativo (fecha, tipo, nota)`
111. Default todos Operativo
112. PE días operativos lee de calendario
113. PE pedidos/día con días reales
114. PE ¿Qué día cubrimos? salta cerrados
115. Facturación día cerrado muestra "CERRADO"
116. Facturación objetivo semanal recalcula proporcional
117. Running media diaria = total / días operativos reales
118. Panel "Faltan X€" considera operativos restantes
119. Panel card Días pico excluye cerrados
120. Objetivos % real/objetivo ajusta días operativos
121. Aviso futuro N cerrados → recalcular y mostrar
122. Día CERRADO actual: ocultar/grisar "Objetivo de hoy"

## 1.10 Plan contable · validar migración

123. Tabla `categorias_maestras` con códigos del plan
124. Mapping table 53 categorías antiguas → 5 grupos + subcategorías
125. Recategorizar 5.716 movimientos existentes
126. Recategorizar gastos en Running
127. Backup BD obligatorio antes
128. KPI EBITDA con objetivo 10-13%
129. KPI Prime Cost con objetivo 55-65%

## 1.11 Eliminar amarillo acento v1

130. Buscar en todo el código uso de amarillo acento del v1 antiguo (excepto `#e8f442` que es token canónico Panel)
131. Sustituir cualquier amarillo decorativo no canónico por rojo Streat Lab `#B01D23` o blanco/gris según contexto
132. Tabs amarillo subrayando → patrón Conciliación rojo activo

## 1.12 Sidebar · validar eliminaciones

133. Sidebar SIN Socios
134. Sidebar SIN Análisis
135. Sidebar SIN Importar Facturas
136. Sidebar SIN Gestoría
137. Rutas /finanzas/socios, /analisis, /finanzas/facturas, /finanzas/gestoria devuelven 404

## 1.13 Escandallo v2 paralelo

138. Crear ruta /escandallo-v2 con misma estructura BD
139. v1 sigue intacto en /escandallo
140. v2 mejorar usabilidad: simplificar formularios, mejor búsqueda, vista grid+lista, drag&drop

---

# FASE 2 · IMPORTADOR PLATAFORMAS + VISTA MARCA × CANAL

## 2.1 Importador rehecho

141. Nuevo módulo Importar Plataformas reformado (mantener entrada sidebar)
142. Dropzone único multi-formato: CSV, XLSX, PDF, imagen
143. Auto-detecta plataforma por estructura archivo:
     - NIF B88515200 → Uber/Portier
     - NIF B67282871 → Glovo
     - Cabeceras "RusHour" → Rushour
     - Cabeceras "Just Eat" / "Takeaway" → Just Eat

## 2.2 Parsers específicos

144. Parser Uber/Portier:
     - Conceptos: Tasa servicio + Comisión canje + Tarifa publicitaria
     - Periodo semanal lun-dom
     - Detectar marca por nombre comercial en cliente (ej: "Mister Katsu")
145. Parser Glovo formato A (con detalle pedidos pág 2):
     - Extraer detalle pedido por pedido (fecha, hora, plato, precio, promoción)
     - Marca por nombre local en cabecera ("Los Menús de Carmiña")
     - Alimentar tabla `pedidos_plataforma` (fecha, hora, plataforma, marca, plato, precio_bruto, promo)
146. Parser Glovo formato B (resumen):
     - Extraer base + IVA + total + ingreso colaborador + fecha pago
147. Parser Just Eat:
     - Pendiente recibir archivos ejemplo Rubén
     - Implementar como TODO con stub que avise "Sin parser Just Eat - subir archivo ejemplo"
148. Parser Rushour:
     - Empresa francesa, IVA 20%, plan fijo mensual
     - Categorizar como CTR-SW (software, no plataforma de venta)
149. Auto-detección marca por:
     - Cliente con marca incluida ("Rubén / Mister Katsu")
     - Cliente con nombre local ("Los Menús de Carmiña (Pico de la Maliciosa)")
     - Concepto factura ("cuenta STREAT LAB - MALICIOSA")
     - Cruzar con maestro Marcas en Configuración
150. Múltiples facturas mismo periodo plataforma: acumular por marca, no sobreescribir
151. Extraer "Fecha de Pago" Glovo cuando aparezca → cobros pendientes reales
152. Extraer "Ingreso a cuenta colaborador" Glovo (lo que efectivamente cobras)

## 2.3 BD desglose

153. Tabla `ventas_plataforma`:
     - fecha, plataforma, marca, bruto, neto, pedidos, ticket_medio
     - índices por (fecha, plataforma, marca)
154. Tabla `pedidos_plataforma` (Glovo formato A):
     - fecha, hora, plataforma, marca, plato, precio_bruto, promo, courier, glovo_id

## 2.4 Vista cruzada Plataforma × Marca en Panel Global

155. Panel Global · tab Marcas (ya esqueleto en FASE 1.2):
     - Conectar con datos reales de `ventas_plataforma`
     - Heatmap "qué marca rinde en qué canal" (intensidad color por bruto)
     - Top 5 marcas por canal
     - Margen real por combinación marca+canal (% sobre bruto)
     - Comparativa periodo vs anterior

## 2.5 Acciones recomendadas

156. Motor de acciones automáticas según umbrales:
     - "Pausa marca X en plataforma Y" si margen < 5% durante 4 semanas
     - "Sube precios marca X en plataforma Y" si demanda alta y margen < 15%
     - "Refuerza marketing combo marca+canal ganador" si margen > 25%
157. Mostrar acciones en PE · tab Resumen

## 2.6 Reconstrucción inversa

158. Cuando importador funcione 100%, reconstruir Running 2025 y 2024 con datos limpios sin IVA
159. Postponer hasta validación parsers en producción

---

# FASE 3 · MÓDULO EQUIPO (sustituye Socios eliminado)

## 3.1 Estructura

160. Crear módulo Equipo en sidebar (icono persona, posición debajo de Conciliación)
161. Ruta `/equipo`
162. Tabs estilo Conciliación: Empleados / Nóminas / Calendario laboral / Horarios / Permisos / Portal

## 3.2 Tab Empleados

163. Lista empleados con avatar, nombre, rol, estado
164. Botón "+ Nuevo empleado"
165. Modal ficha empleado:
     - Datos personales (nombre, NIF, fecha nacimiento, dirección, teléfono, email)
     - Datos laborales (fecha alta, contrato, salario, IBAN, SS)
     - Documentos vinculados (contrato PDF, nómina, baja, etc) en Drive
     - Antigüedad calculada
     - Estado: activo, baja, vacaciones, despedido
166. Tabla BD `empleados` (id, nombre, nif, iban, salario, fecha_alta, estado, datos_personales JSONB)

## 3.3 Tab Nóminas

167. Listado nóminas por empleado por mes
168. Botón "Subir nómina" PDF al Drive
169. Histórico mensual descargable
170. Tabla BD `nominas` (id, empleado_id, mes, año, importe_bruto, importe_neto, pdf_url)

## 3.4 Tab Calendario laboral

171. Vista calendario mensual
172. Marcar festivos nacionales/locales (auto-cargar Madrid)
173. Marcar vacaciones por empleado (color por persona)
174. Marcar bajas (médica, asuntos propios)
175. Tabla BD `eventos_laborales` (id, empleado_id, fecha, tipo, nota)

## 3.5 Tab Horarios

176. Planificador semanal drag&drop
177. Turnos: Comida (12:00-16:00), Cena (19:00-23:30) configurables
178. Reglas: descansos legales mínimos, máx horas/semana por empleado
179. Si Calendario operativo marca día CERRADO → no genera turnos
180. Si Calendario operativo marca SOLO COMIDA → solo turno mediodía
181. Si Calendario operativo marca SOLO CENA → solo turno cena
182. Validación automática: alerta si excede límites legales
183. Tabla BD `horarios` (id, empleado_id, fecha, hora_inicio, hora_fin, turno_tipo)

## 3.6 Tab Permisos

184. Lista solicitudes con estado: pendiente / aprobado / rechazado
185. Empleado solicita permiso (fecha, motivo, días)
186. Admin/Socio aprueba o rechaza con nota
187. Si aprobado: marcar en Calendario laboral automáticamente
188. Si todo el equipo cocina vacaciones → Calendario operativo marca día CERRADO automático
189. Tabla BD `solicitudes_permisos` (id, empleado_id, fecha_inicio, fecha_fin, tipo, estado, nota)

## 3.7 Tab Portal Empleado

190. Login propio empleado (vinculado a Configuración · Usuarios)
191. Vista limitada: ve solo su contrato, sus nóminas, su horario, sus permisos
192. Botón "Solicitar permiso"
193. Botón "Descargar nómina"
194. NO ve datos de otros empleados ni datos financieros del negocio

## 3.8 Permisos vinculados

195. Roles definidos en Configuración · Usuarios:
     - Admin: acceso total
     - Socio: acceso total excepto datos personales otros empleados
     - Cocina: ve sus horarios y los del equipo, solicita permisos
     - Repartidor: ve sus horarios, solicita permisos
196. Documentos en Drive con permisos por persona

## 3.9 Vinculación con Calendario operativo

197. Si empleados todos vacaciones día X → Calendario operativo marca día X como CERRADO
198. Si Calendario operativo marca día CERRADO → no se generan turnos en Horarios
199. Si Solo comida en Calendario → solo turnos mediodía en Horarios
200. Si Solo cena en Calendario → solo turnos cena en Horarios

---

# FASE 4 · CONEXIÓN ESCANDALLO (Bloque H)

## 4.1 Ingredientes ↔ Compras

201. Cada ingrediente en Escandallo v2 tiene un proveedor_principal asignable
202. Botón "Vincular con compra" desde ingrediente: busca facturas Mercadona/Carrefour/Makro
203. Histórico precios por ingrediente: tabla `precios_ingredientes` (ingrediente_id, fecha, precio_unitario, proveedor)
204. Cada vez que entra factura producto en Conciliación → actualizar precios automáticamente
205. Visualizar gráfico evolución precio por ingrediente últimos 12 meses

## 4.2 Recetas ↔ Productos vendidos

206. Cada plato en Carta puede vincularse a una receta de Escandallo
207. Cada receta calcula food cost real basado en precios actuales ingredientes
208. Plato muestra: precio venta (PVP) - food cost = margen bruto
209. Si plato vendido en Uber/Glovo/Just Eat: calcular margen real por canal (PVP - comisión - food cost)

## 4.3 Food cost en Punto Equilibrio

210. PE · simulador food cost: leer food cost ponderado real (no hardcoded 28%)
211. Cálculo ponderado: media food cost recetas activas × peso ventas por plato
212. Si receta tiene food cost > 32% → alerta visual

## 4.4 Margen objetivo en Marcas

213. Configuración · Marcas: margen objetivo deja de ser 70% fijo
214. Calcular margen objetivo ponderado por marca según recetas asignadas a esa marca
215. Mostrar margen real vs objetivo con semáforo

## 4.5 Recálculo automático y alertas

216. Cuando sube precio ingrediente (factura nueva) → recalcular food cost recetas que lo usen
217. Si receta queda fuera margen objetivo tras subida → alerta en notificaciones
218. Alerta food cost > umbral (configurable, default 32%)

## 4.6 Comparativa proveedores

219. Por ingrediente: comparar precios Mercadona vs Carrefour vs Makro últimos 30 días
220. Recomendación visual "Cambia a proveedor X, ahorras Y €/mes"

---

# FASE 5 · MÓDULO INVENTARIO FÍSICO (Bloque I)

## 5.1 Estructura

221. Crear módulo Inventario en sidebar bajo Stock & Compras
222. Ruta `/inventario`
223. Tabs estilo Conciliación: Conteos / Movimientos / Mermas / Análisis food cost real

## 5.2 Tab Conteos

224. Botón "Nuevo conteo" (semanal/mensual)
225. Lista ingredientes con: stock anterior, entradas (compras periodo), conteo actual, consumo calculado
226. Conteo manual por ingrediente con confirmación
227. Tabla BD `conteos_inventario` (id, fecha, ingrediente_id, stock_inicial, entradas, stock_final, consumo)

## 5.3 Tab Movimientos

228. Listado entradas (compras) y salidas (consumos) por ingrediente
229. Filtros por fecha, ingrediente, tipo movimiento

## 5.4 Tab Mermas

230. Calcular merma = consumo_calculado - consumo_teorico (recetas × ventas)
231. Alerta si merma > 5% en una semana
232. Top 5 ingredientes con mayor merma del periodo

## 5.5 Tab Análisis food cost real

233. Comparativa food cost teórico (escandallo) vs food cost real (inventario)
234. Gráfico evolución food cost real mensual
235. Alerta si food cost real > teórico + 3%

---

# FASE 6 · MENU ENGINEERING + RECETARIO (Bloque J)

## 6.1 Menu Engineering

236. Crear módulo Menu Engineering en sidebar bajo Cocina
237. Matriz cuadrante 2x2:
     - Eje X: popularidad (% pedidos / total pedidos)
     - Eje Y: rentabilidad (margen unitario)
     - Estrella: alta popularidad + alta rentabilidad
     - Vaca: alta popularidad + baja rentabilidad
     - Dilema: baja popularidad + alta rentabilidad
     - Perro: baja popularidad + baja rentabilidad
238. Filtros por marca, periodo, canal
239. Acciones recomendadas por cuadrante:
     - Estrella: mantener, destacar
     - Vaca: subir precio, optimizar food cost
     - Dilema: promocionar, mejorar visibilidad
     - Perro: eliminar de carta o rediseñar

## 6.2 Recetario operativo

240. Ruta `/cocina/recetario`
241. Lista recetas con foto, tiempo preparación, alérgenos
242. Vista detalle receta:
     - Ingredientes con cantidades por ración
     - Pasos numerados con foto opcional
     - Tiempo cocción/preparación
     - Alérgenos
     - Trucos cocinero
     - Presentación final foto
243. Búsqueda y filtros por marca, alérgenos, dificultad
244. Modo cocina: vista grande para tablet en cocina

---

# CRITERIOS DE ACEPTACIÓN GLOBALES

### Estilo
1. TODOS los módulos siguen patrón visual Conciliación
2. NO hay placeholders ni cáscaras vacías
3. NO hay amarillo acento v1 (excepto token `#e8f442` Panel)
4. TODAS las tabs estilo Conciliación (rojo activo, blanco inactivo)

### Funcionalidad FASE 1
5. Build OK sin errores
6. Sidebar sin módulos eliminados (Socios, Análisis, Importar Facturas, Gestoría)
7. Panel Global 5 tabs implementadas con datos reales o placeholder funcional avanzado
8. Facturación con vista Año + tabs estilo Conciliación + servicio ALM/CENA
9. Objetivos con tab Presupuestos editable + columnas % Real y % Desviación
10. Conciliación completa con dropzone único + filtros rápidos + 5 cards categorías
11. Running con tabs + EBITDA + Prime Cost + comparativas
12. PE con cards grandes + 5 tabs (Resumen/Día semana/Simulador/Escenarios/Tesorería)
13. Configuración con 5 tabs limpias + reglas oro propagación
14. Calendario operativo funcional con todos los tipos de día
15. Migración categorías 5.716 movs sin pérdida

### Funcionalidad FASE 2
16. Importador con dropzone multi-formato funcional
17. Parsers Uber/Glovo/Rushour validando contra `.claude/tests/casos-prueba-ocr.md`
18. Vista marca × canal con datos reales o esqueleto
19. Acciones recomendadas motor implementado

### Funcionalidad FASE 3
20. Módulo Equipo con 6 tabs implementadas
21. Portal empleado con login propio funcional
22. Vinculación Calendario operativo ↔ Horarios validada

### Funcionalidad FASE 4
23. Conexión Escandallo ↔ Compras con histórico precios
24. Food cost real en PE
25. Alertas margen y food cost umbral

### Funcionalidad FASE 5
26. Inventario con conteos, mermas, análisis food cost real

### Funcionalidad FASE 6
27. Menu Engineering matriz funcional
28. Recetario operativo con vista cocina

### Aislamiento
29. NO se ha tocado código del repo erp-david
30. NO se han usado tokens Marino+Fuego (#16355C, #F26B1F como tokens; sí como color titular Rubén)
31. NO se ha conectado Supabase de David

### Cierre
32. Commit final con mensaje descriptivo + push master
33. NO Vercel hasta confirmación Rubén
34. Informe final: build, validaciones pasadas/falladas, archivos creados/modificados/eliminados, decisiones autónomas

---

# DECISIONES AUTÓNOMAS PERMITIDAS

El implementer puede tomar autónomamente:
1. Mapping exacto categorías antiguas → nuevas
2. Estilos de componentes nuevos siguiendo tokens canónicos y patrón Conciliación
3. Estructura interna de tabs respetando patrón Resumen/Movimientos
4. Formato fechas y números siguiendo `fmtEur` y `parseLocalDate`
5. Queries Supabase para tablas existentes
6. Schema BD nuevo (empleados, nóminas, conteos, ventas_plataforma, etc.) según mejor práctica
7. Iconos sidebar (Lucide React) según convención existente
8. Defaults sensatos para campos sin valor

El implementer DEBE preguntar SOLO si:
1. Va a borrar datos de producción sin backup
2. Detecta dependencia con módulo David (debe parar)
3. Encuentra ambigüedad de mapping con riesgo financiero alto

**Para todo lo demás: decide autónomamente, documenta en `summary.md`, sigue.**

---

# ORDEN DE EJECUCIÓN

Ejecutar fases EN ORDEN sin parar:

1. FASE 1 (re-trabajo) → validar build OK → continuar
2. FASE 2 (importador) → validar parsers contra casos prueba → continuar
3. FASE 3 (Equipo) → validar tabs y portal → continuar
4. FASE 4 (Escandallo conectado) → validar food cost real → continuar
5. FASE 5 (Inventario) → validar conteos → continuar
6. FASE 6 (Menu Engineering + Recetario) → validar matriz → cerrar

Cada fase termina con commit intermedio y push:
```
git add . && git commit -m "feat(bloqueMEGA): FASE X completada" && git push origin master
```

Cierre final tras FASE 6:
```
git add . && git commit -m "feat(bloqueMEGA): completo - 1.5 + 2 + G + H + I + J" && git push origin master && git pull origin master
```

NO Vercel. Solo localhost. Rubén valida módulo por módulo y dirá "deploy Vercel" cuando esté satisfecho.

---

# PIPELINE OBLIGATORIO

Para CADA fase:
1. pm-spec valida spec sin huecos
2. architect-review aprueba arquitectura y dependencias
3. implementer ejecuta autónomo (regla 8 + decisiones permitidas arriba)
4. qa-reviewer valida CA específicos de la fase
5. erp-reviewer valida aislamiento Binagre vs David

Si qa-reviewer detecta fallos: implementer-fix antes de avanzar a siguiente fase.

NO PARAR ENTRE FASES. NO PREGUNTAR. AVANZAR.
