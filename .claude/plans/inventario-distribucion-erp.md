# INVENTARIO LITERAL Y DISTRIBUCIÓN — Cards/Gráficos/KPIs ERP Streat Lab

> Decidido por Rubén+Claude. NO interpretar. NO mover sin orden expresa.

## ÍNDICE
1. Inventario completo de elementos por módulo (versión actual)
2. Decisión: qué se mantiene, qué se elimina, dónde va lo que se mueve
3. Distribución final por módulo y tab

---

## 1. INVENTARIO COMPLETO (versión actual del ERP)

### Módulo Panel Global (Dashboard.tsx)
1. KPI Ventas (card grande con barras objetivo Sem/Mes/Año)
2. KPI Pedidos (card grande con desglose por canal)
3. KPI TM (card con desglose por canal)
4. Hilera 5 cards canal (Uber/Glovo/JustEat/Web/Directa con bruto/neto/margen)
5. Días pico (gráfico barras 7 días)
6. Top ventas (lista numerada productos)
7. Selector "Todos los canales"
8. Selector marca
9. Selector fecha
10. Tabs General / Operaciones / Finanzas / Cashflow / Marcas (mal estilo, recién implementadas)
11. Tab Operaciones: cards Pedidos totales / Ticket medio / Canal top / Facturación bruta + Mix canales (placeholders)
12. Tab Finanzas: bloque "Vista financiera" Ingresos brutos / Comisiones / Ingresos netos (placeholder)
13. Tab Cashflow: cards Cobros pendientes / Pagos pendientes / Provisión IVA / Provisión IRPF + texto "ver en PE"
14. Tab Marcas: vacío

### Módulo Conciliación (Conciliacion.tsx)
1. Card INGRESOS NETOS (grande) con desglose por canal y barras color
2. Card GASTOS (grande) con desglose por categoría
3. Card TESORERÍA HOY (grande) con caja líquida + cobros/pagos pendientes + proyección
4. Card "Ratio Ingresos/Gastos" (con semáforo)
5. Card "Balance Neto"
6. Card "Categorías de gastos" (top + total) — DUPLICADO con Panel
7. Columna gris de gastos a la derecha — sin sentido
8. Card "Tesorería vs Caja líquida" — duplicada con Tesorería Hoy
9. Cards Presupuestos (4 cards Producto/Equipo/Local/Controlables)
10. Tabs Resumen / Movimientos (estilo correcto, REFERENCIA DE ORO)
11. Selector "Este mes" / fechas
12. Selector titular bancario — eliminar
13. Selector Categoría
14. Tabla movimientos
15. Botón "Importar extracto"
16. Gráfico "Ingresos vs Gastos semanal"
17. Gráfico "Ingresos/Gastos/Saldo"
18. Card "Todo al día" (con leyenda click para filtrar)

### Módulo Facturación (Facturacion.tsx)
1. Cards superiores 4 estáticas: Martes 28 / S18 / Abril / 2026 (con valores facturación)
2. Hilera cards medianas: Facturación bruta / Pedidos / TM / Facturación diaria
3. Conmutador Diario/Semanas/Meses (botones rojo)
4. Filtro Todos/ALM/CENAS
5. Selector "Todos" canales (renombrar Canales)
6. Selector mes (Abril 2026)
7. Botón Exportar CSV
8. Botón "+ Añadir día"
9. Tabla diaria por canal con columna SERV "TODO" fijo
10. Selector año

### Módulo Objetivos (finanzas/Objetivos.tsx)
1. Card "Ventas hoy / objetivo" (grande)
2. Card "Objetivo por día" (lista 7 días con barras)
3. Tabla histórico cumplimiento por semana (con barras cumplido + pendiente)
4. Selector "Por semanas" / año
5. Tabs Objetivos de venta / Presupuesto de gastos (placeholder)

### Módulo Running Financiero (finanzas/Running.tsx)
1. Cards Cashflow real izquierda y derecha (dos cards grandes)
2. Hilera cards: Facturación bruta / Ingresos netos / Total gastos / Resultado
3. Sparklines en cada card
4. Toggle Sin IVA / Con IVA — eliminar
5. Selector "Todos los socios" — eliminar
6. Tabla anual mensual completa (cortada a la derecha)
7. Bloque "Ingresos por marca" (vacío)
8. Bloque "Sueldos del periodo"
9. Botón "+ Añadir gasto" — mover a Conciliación
10. Categorías antiguas (RRHH, Internet y ventas, etc.)

### Módulo Punto Equilibrio (finanzas/PuntoEquilibrio.tsx)
1. Cards superiores con datos PE actuales
2. Toggle Sin IVA / Con IVA — eliminar
3. Tab Día semana
4. Tab Simulador (no integrado en portada)
5. Acciones recomendadas (motor decisiones)
6. Calculadora pedidos/día

### Módulo Importar Plataformas (finanzas/ImportarPlataformas.tsx)
1. Dropzone facturas
2. Cards estado (Pendientes/Asociadas/Faltantes/Duplicadas/Sin titular)
3. Selector titular SL/Rubén/Emilio
4. Buscador
5. Listado facturas
6. Botón asociar movimiento

### Módulo Configuración (Configuracion.tsx)
1. Tab Marcas (con sub-tabs Marcas, Canales, Tipos cocina, Accesos Uber)
2. Tab Compras (Proveedores, Costes, Escandallo params, Formatos, Unidades, Categorías)
3. Tab Bancos (Cuentas, Titulares, Categorías, Reglas, Provisiones, Presupuestos, Drive, Conciliación, Información)
4. Tab Categorías (CategoriasPage)
5. Tab Plataformas (PlataformasPage)
6. Tab Cuentas (CuentasPage)
7. Tab Calendario operativo (CalendarioPage)
8. Tab Usuarios (UsuariosPage)

### Módulo Análisis (placeholder, eliminar)
- Cards de escenarios "qué pasa si"
- Mover a PE como Tab Escenarios

### Módulo Marcas (Marcas.tsx)
- Lista marcas — DUPLICADO con Configuración Marcas

### Módulos eliminados / pendientes
- Socios — ELIMINAR
- Importar Facturas — ELIMINAR (a Conciliación)
- Gestoría — ELIMINAR

---

## 2. DECISIÓN POR ELEMENTO

### MANTENER en su sitio actual (intactos)
1. Conciliación · Card INGRESOS NETOS (referencia oro)
2. Conciliación · Card GASTOS (referencia oro)
3. Conciliación · Card TESORERÍA HOY (referencia oro, simplificar)
4. Conciliación · Tabs Resumen / Movimientos
5. Running · Cards Cashflow real izquierda y derecha
6. Running · Sparklines (rehacer visualmente, no eliminar)

### MOVER a otro módulo
1. Conciliación · "Ratio Ingresos/Gastos" → Running (ya estará allí)
2. Conciliación · "Balance Neto" → Panel Global tab Cashflow
3. Conciliación · "Categorías de gastos" duplicado → solo Panel tab Finanzas
4. Conciliación · Gráfico "Ingresos vs Gastos semanal" → Panel tab Cashflow
5. Conciliación · Gráfico "Ingresos/Gastos/Saldo" → Panel tab Cashflow
6. Configuración · "Provisiones IVA/IRPF" → PE tab Tesorería futura
7. Configuración · "Presupuestos mensuales" → Objetivos tab Presupuesto de gastos
8. Configuración · "Tipos de cocina" → propiedad de tabla Marcas
9. Configuración · "Accesos Uber" → tab Plataformas como subsección
10. Running · botón "+ Añadir gasto" → Conciliación tab Movimientos
11. Análisis (módulo) · Escenarios → PE tab Escenarios

### ELIMINAR (sin reubicación)
1. Conciliación · "Tesorería vs Caja líquida" (duplica Tesorería Hoy)
2. Conciliación · Columna gris de gastos
3. Running · Bloque "Ingresos por marca" (vacío, lo hará Panel tab Marcas)
4. Running · Bloque "Sueldos del periodo" (duplicado con Cashflow real cards)
5. Running · Toggle Sin IVA / Con IVA
6. Running · Selector "Todos los socios"
7. PE · Toggle Sin IVA / Con IVA
8. Conciliación · Selector titular bancario
9. Facturación · Hilera cards medianas (Facturación bruta, Pedidos, TM, Facturación diaria)
10. Configuración · Submódulo Compras antiguo (mover a Stock & Compras)

### CREAR NUEVO
1. Panel Global tab Operaciones — nuevo (definido abajo)
2. Panel Global tab Finanzas — nuevo (definido abajo)
3. Panel Global tab Cashflow — nuevo (definido abajo)
4. Panel Global tab Marcas — nuevo (definido abajo)
5. Importador unificado (módulo nuevo, sustituye Importar Plataformas)
6. Tareas (módulo nuevo)
7. Equipo (módulo nuevo, sustituye Socios)
8. Calendario operativo (tab Configuración)
9. Card EBITDA (Running)
10. Card PRIME COST (Running)
11. Tab PyG detallado (Running)
12. Tab Comparativas (Running)
13. Tab Escenarios (PE, ex-módulo Análisis)
14. Tab Tesorería futura (PE)
15. Card 5 categorías presupuesto vs real (Conciliación tab Resumen)
16. Tabla histórico Objetivos columnas % Real y % Desviación
17. Tab Presupuesto de gastos (Objetivos)

---

## 3. DISTRIBUCIÓN FINAL POR MÓDULO Y TAB

### PANEL GLOBAL · Tab General

Cards en este orden (de arriba a abajo, izquierda a derecha):

1. **VENTAS** (grande, columna 1/3)
   - Sublabel: "VENTAS"
   - Valor grande: ingresos brutos del periodo
   - Comparativa "▼ X% vs anterior" / "▲ X%"
   - Línea SEMANAL — barra cumplimiento + "Faltan X€ de Y€" (objetivo viene de tabla `objetivos` editable inline)
   - Línea MENSUAL — barra cumplimiento + "Faltan X€ de Y€"
   - Línea ANUAL — barra cumplimiento + "Faltan X€ de Y€"

2. **PEDIDOS** (grande, columna 2/3)
   - Sublabel: "PEDIDOS"
   - Valor grande: total pedidos del periodo
   - Comparativa vs anterior
   - Desglose horizontal por canal con barras de color y % cada uno

3. **TM BRUTO · NETO** (grande, columna 3/3)
   - Sublabel: "TM BRUTO · NETO"
   - Lado izquierdo: TM bruto Oswald 2.4rem #111
   - Lado derecho: TM neto Oswald 1.4rem #1D9E75 (verde)

4. **FACTURACIÓN POR CANAL** (5 cards horizontales, full row debajo de las 3 grandes)
   - Una card por canal con: bruto / neto / % margen
   - Color background canal (10% opacidad)
   - Si datos ADS subidos: badge "ADS: X€" pequeño informativo

5. **DÍAS PICO — {periodo}** (full-width, gráfico barras 7 días)
   - Cada barra color del día (Lun azul, Mar verde, Mié ámbar, Jue rojo, Vie azul claro, Sáb naranja, Dom verde oscuro)
   - Valor encima de cada barra
   - Datos reales de `facturacion_diaria` agrupados por DOW

6. **TOP VENTAS** (full-width, lista 1-5)
   - 1. Producto + badge canal + cantidad + importe
   - 2. ...
   - Botón cabecera "Productos / Modif."

### PANEL GLOBAL · Tab Operaciones

Cards (sin duplicar General):

1. **PEDIDOS POR HORA** (heatmap simplificado 4 franjas)
   - Mañana 8-12h
   - Mediodía 12-16h
   - Tarde 16-19h
   - Noche 19-23:59h

2. **RATIO ALM vs CENA** (donut chart con %)

3. **MIX CANALES** (barras horizontales con % por canal — diferente a card pedidos del General que muestra valores absolutos)

4. **EVOLUCIÓN PEDIDOS** (línea temporal, periodo vs periodo anterior comparable)

5. **REPETICIÓN CLIENTES** (KPI con % clientes repetidores si POS conectado, si no placeholder "Pendiente integración POS")

### PANEL GLOBAL · Tab Finanzas

Cards (sin duplicar):

1. **INGRESOS BRUTOS** (grande)
   - Valor + comparativa
   - Desglose por canal con barras (movido de Conciliación)

2. **COMISIONES PLATAFORMAS** (grande)
   - Total comisiones del periodo
   - Desglose por plataforma con valores

3. **INGRESOS NETOS** (grande)
   - Valor + comparativa

4. **CATEGORÍAS DE GASTOS** (grande, movida desde Conciliación)
   - Top 5 categorías con valor y % sobre total
   - Total gastos

5. **RATIO GASTOS / NETOS** (mediana con semáforo, viene de Running pero también vista aquí)
   - ≤ 65% verde
   - 65-75% ámbar
   - > 75% rojo

6. **MARGEN REAL VALIDADO** (mediana)
   - Valor margen real del periodo
   - Icono OK/ALERTA/ERROR según validación banca

7. **COMPARATIVA vs PRESUPUESTO OBJETIVOS** (gráfico barras, real vs presupuesto por categoría)

8. **ADS POR MARCA Y CANAL** (tabla)
   - | Marca | Canal | ADS mes | ADS últ 3 meses |
   - Tooltip: "Informativo. NO afecta margen."

### PANEL GLOBAL · Tab Cashflow

Cards (datos reales, no hardcoded):

1. **COBROS PENDIENTES** (tabla)
   - | Plataforma | Marca | Periodo | Bruto | Neto estimado | Fecha pago |
   - Cálculo según CICLOS_PAGO

2. **PAGOS PENDIENTES** (tabla)
   - | Proveedor | Concepto | Importe | Vencimiento | Tipo (fijo/var) |
   - Fijos de tabla `gastos_fijos`, variables de facturas pendientes

3. **PROVISIONES** (2 sub-cards)
   - Provisión IVA = 21% × ventas netas trimestre
   - Provisión IRPF = 19% × retención alquiler año

4. **GRÁFICO SALDO PROYECTADO** (línea temporal con 5 puntos)
   - Hoy / +7d / +30d / +3m / +6m / +1a
   - Background barra verde tipo "Hoy → 30d"

5. **CALENDARIO PAGOS CRÍTICOS 90D** (lista cronológica)
   - Pagos > 500€ próximos 90 días
   - Marcar rojo si > 1000€ y < 7 días

6. **BALANCE NETO** (movido de Conciliación)
   - Valor + tendencia 12 meses

7. **GRÁFICO INGRESOS vs GASTOS SEMANAL** (movido de Conciliación)
   - 12 últimas semanas, líneas verde y roja

8. **GRÁFICO INGRESOS / GASTOS / SALDO** (movido de Conciliación)
   - 12 últimos meses, 3 líneas

### PANEL GLOBAL · Tab Marcas

(Activo solo cuando hay datos en `ventas_plataforma_marca_mensual`. Si no, placeholder con CTA "Ir al Importador →".)

1. **MATRIZ CRUZADA PLATAFORMA × MARCA** (heatmap)
   - Filas: marcas
   - Columnas: plataformas
   - Celdas: bruto facturado, color intensidad

2. **TOP 5 MARCAS DEL PERIODO** (lista)
   - Marca / Bruto / Pedidos / TM / % sobre total

3. **MARGEN REAL POR COMBO MARCA × CANAL** (tabla)
   - | Marca | Canal | Bruto | Neto | % Margen |

4. **EVOLUCIÓN MENSUAL POR MARCA** (gráfico líneas)
   - Eje X: últimos 12 meses
   - Una línea por marca

5. **ACCIONES RECOMENDADAS** (lista cards)
   - "Pausa marca X en plataforma Y" (si margen < 5% durante 4 sem)
   - "Sube precios marca X en plataforma Y" (si demanda alta y margen < 15%)
   - "Refuerza marketing combo ganador X+Y" (si margen > 25%)

---

### CONCILIACIÓN · Tab Resumen

3 cards superiores grandes (mantener intactas):

1. **INGRESOS NETOS** — referencia oro intacta
2. **GASTOS** — referencia oro intacta
3. **TESORERÍA HOY** — referencia oro, simplificar (eliminar duplicado Tesorería vs Caja Líquida)

5 cards inferiores (NUEVAS, sustituyen las 4 actuales):

1. **PRODUCTO (COGS)** — gasto del periodo / presupuesto + barra cumplimiento + % consumido + semáforo
2. **EQUIPO (LABOR)** — idem
3. **LOCAL (OCCUPANCY)** — idem
4. **CONTROLABLES (OPEX)** — idem
5. **PLATAFORMAS** — comisiones del periodo (descuento informativo, no gasto)

ELIMINADAS de Conciliación tab Resumen:
- Card Ratio Ingresos/Gastos (a Running)
- Card Balance Neto (a Panel Cashflow)
- Card Categorías de gastos (a Panel Finanzas)
- Card Tesorería vs Caja líquida (eliminar, duplica)
- Columna gris de gastos
- Gráfico Ingresos vs Gastos (a Panel Cashflow)
- Gráfico Ingresos/Gastos/Saldo (a Panel Cashflow)

### CONCILIACIÓN · Tab Movimientos

1. Dropzone único multi-formato arriba (CSV/XLSX/PDF/imagen)
2. Filtros rápidos: Pendientes/Asociadas/Faltantes/Duplicadas/Sin titular
3. Buscador unificado proveedor/nº factura/importe/concepto
4. Tabla movimientos con columnas: Fecha / Concepto / Contraparte (proveedor real si factura asociada) / Importe / Categoría (badge color) / Doc / Acciones
5. Botón "+ Añadir gasto" fixed bottom-right (movido desde Running)

ELIMINADO de Movimientos:
- Selector titular bancario (auto NIF)

---

### FACTURACIÓN

Cards superiores 4 grandes (sustituyen hilera medianas eliminada):

| Vista | Card 1 | Card 2 | Card 3 | Card 4 |
|---|---|---|---|---|
| Diario | Día | Semana | Mes | Año |
| Semanas | Semana | Mes | 3 meses | Año |
| Meses | Mes | 3 meses | 6 meses | Año |
| Año | Mes | Trimestre | Semestre | Año |

Cada card grande:
- Sublabel: período
- Valor grande facturación
- N pedidos
- TM
- Comparativa vs equivalente anterior

Tabla diaria:
- Columna SERV: ALM/CENA/AMBOS según día
- Si AMBOS: dos filas dentro del día
- Si solo ALM: NO mostrar fila CENA vacía
- Si solo CENA: NO mostrar fila ALM vacía

ELIMINADO:
- Hilera 4 cards medianas (Facturación bruta, Pedidos, TM, Facturación diaria)
- Cards estáticas Martes 28 / S18 / Abril / 2026

---

### OBJETIVOS · Tab Objetivos de venta

1. **Card "Ventas hoy / objetivo"** (grande, izquierda, mantener)
2. **Card "Objetivo por día"** (grande, derecha)
   - Día actual: borde 2px solid #1E5BCC azul, fondo blanco (NO rojo)
   - Quitar S18 del subtítulo
3. **Tabla histórico cumplimiento** (full-width abajo)
   - Columnas: Período / Cumplido·Pendiente (barra) / **% Real** / Real / Objetivo / Desviación / **% Desviación**

### OBJETIVOS · Tab Presupuesto de gastos (NUEVO)

Tabla 12 meses × 5 categorías editable inline + Total mes + Total año.

Botón "Copiar año anterior".

---

### RUNNING · Tab Resumen

Cards en este orden:

1. **CASHFLOW REAL IZQUIERDA** (mantener intacta)
2. **CASHFLOW REAL DERECHA** (mantener intacta)
3. **FACTURACIÓN BRUTA** + sparkline 12m
4. **INGRESOS NETOS** + sparkline 12m
5. **TOTAL GASTOS** + sparkline 12m
6. **RESULTADO** + sparkline 12m
7. **PRIME COST** (NUEVA) + sparkline + semáforo banda 55-65%
8. **EBITDA** (NUEVA) + sparkline + semáforo banda 10-13%

Bajo cards: desglose 5 categorías con barras horizontales:
- Producto (COGS) / Equipo (Labor) / Local (Occupancy) / Controlables (OPEX) / Plataformas (Comisiones)

Card "RATIO GASTOS/NETOS" (movida desde Conciliación) con semáforo.

ELIMINADO:
- Bloque "Ingresos por marca"
- Bloque "Sueldos del periodo"
- Toggle Sin IVA/Con IVA
- Selector "Todos los socios"
- Botón "+ Añadir gasto"

### RUNNING · Tab PyG detallado (NUEVO)

Tabla anual completa columnas: Concepto / Ene...Dic / Total año.

Filas:
1. INGRESOS BRUTOS
2. (-) Comisiones plataformas
3. (-) IVA 21% comisiones
4. = INGRESOS NETOS
5. (-) PRODUCTO (COGS)
6. = MARGEN BRUTO
7. (-) EQUIPO (Labor)
8. = PRIME COST
9. (-) LOCAL (Occupancy)
10. (-) CONTROLABLES (OPEX)
11. = EBITDA
12. (-) Provisiones (IVA + IRPF)
13. = RESULTADO LIMPIO

Subtítulos benchmark: "Producto · COGS", "Equipo · Labor", "Prime Cost", "EBITDA · Beneficio operativo".

ARREGLAR corte derecho de tabla actual.

### RUNNING · Tab Comparativas (NUEVO)

3 sub-vistas (sub-tabs o dropdown):
1. vs Presupuesto Objetivos (barras real vs presupuesto por mes/categoría)
2. vs Mismo mes año anterior (tabla y gráfico)
3. vs Media últimos 3-6-12 meses (card por horizonte)

---

### PE · Tab Resumen

Cards superiores 4 grandes:

1. **¿CUBRIMOS FIJOS HOY?** (Sí/No grande + margen actual + comparativa vs ayer)
2. **¿QUÉ DÍA CUBRIMOS?** (texto "El día X" + pedidos extra necesarios)
3. **PEDIDOS / DÍA NECESARIOS** (al TM real para cubrir + comparativa vs media)
4. **TM REAL** (valor + comparativa vs anterior)

Bajo cards: **ACCIONES RECOMENDADAS** (motor decisiones, mantener)

### PE · Tab Día semana

Cards grandes con datos por día semana del periodo.

### PE · Tab Simulador

Sliders inline integrados (no tab separado):
- Subir precios %
- Bajar food cost %
- Recuperar directa %
- Añadir marca

Feedback inmediato sobre cards arriba.

### PE · Tab Escenarios (NUEVO, ex-módulo Análisis)

Lista escenarios guardables y comparables:
1. "Subo precio 5%"
2. "Bajo food cost 2%"
3. "Recupero 5% directa"
4. "Añado 1 marca"

Cada escenario muestra impacto en EBITDA, Prime Cost, ¿Cubrimos?

### PE · Tab Tesorería futura (NUEVO)

1. **PROVISIÓN IVA** (movida de Configuración)
2. **PROVISIÓN IRPF** (movida de Configuración)
3. **CALENDARIO PAGOS CRÍTICOS 90D**

ELIMINADO:
- Toggle Sin IVA/Con IVA

---

### CONFIGURACIÓN · 6 tabs

1. **Marcas** — Lista marcas / canales activos / margen objetivo / estado / tipo cocina (propiedad)
2. **Categorías** — 5 grupos × subcategorías editable, propaga a TODO ERP
3. **Plataformas** — % comisión / € fijo / ciclo pago / reglas auto-cat NIF→categoría
4. **Cuentas** — Bancarias con saldo / Drive Google / espacio futuras integraciones POS
5. **Usuarios** — Roles + permisos custom matrix por módulo
6. **Calendario operativo** (NUEVO) — Mensual navegable con tipos día (operativo/solo comida/solo cena/cerrado/festivo/vacaciones)

ELIMINADAS:
- Tab Accesos Uber (a Plataformas)
- Tab Tipos cocina (a Marca propiedad)
- Tab Presupuestos mensuales (a Objetivos)
- Tab Provisiones IVA/IRPF (a PE)

---

### IMPORTADOR (NUEVO MÓDULO)

4 tabs estilo Conciliación:

1. **Subir** — Dropzone multi-formato + auto-detección tipo + routing al módulo destino
2. **Histórico** — Tabla de imports con filtros y búsqueda
3. **Pendientes** — Imports requieren acción manual (sin NIF, parser falló)
4. **Resúmenes plataforma** — Tabla resúmenes mensuales subidos por plataforma×marca, con detalle clickeable

---

### TAREAS (NUEVO MÓDULO)

3 tabs estilo Conciliación:

1. **Calendario** — Vista mensual con tareas marcadas por día (cumplida/pendiente/atrasada)
2. **Lista pendientes** — Ordenada por urgencia con acciones (marcar subida, posponer, eliminar)
3. **Configuración tareas** — CRUD de tareas periódicas (resumen Uber día 5, facturas lunes, etc.)

Indicador rojo en sidebar con número pendientes.

Banner top en Panel si hay tareas atrasadas.

---

### EQUIPO (NUEVO MÓDULO)

6 tabs:

1. **Empleados** — Lista cards + ficha completa (datos personales, contrato, salario, IBAN, documentos)
2. **Nóminas** — Histórico mensual descargable, subir nómina abre Importador
3. **Calendario laboral** — Vista mensual con eventos (festivos, vacaciones, bajas)
4. **Horarios** — Planificador semanal drag&drop, validaciones legales, vinculado Calendario operativo
5. **Permisos** — Solicitudes empleado, admin aprueba/rechaza, si aprobado crea evento laboral
6. **Portal empleado** — Login propio, vista limitada (su contrato, sus nóminas, su horario, sus permisos)

---

### ESCANDALLO

- v1 intacto en `/escandallo`
- v2 paralelo en `/escandallo-v2` con misma BD, UI mejorada
- Promoción a `/escandallo` solo tras OK Rubén

---

### MENU ENGINEERING (futuro, post-importador funcional)

- Matriz 2x2: popularidad × rentabilidad (estrellas/vacas/dilemas/perros)
- Filtros por marca/periodo/canal
- Acciones recomendadas por cuadrante

### RECETARIO (futuro)

- Lista recetas con foto/tiempo/alérgenos
- Detalle: ingredientes, pasos numerados con foto, presentación
- Modo cocina: vista grande para tablet

### INVENTARIO FÍSICO (futuro)

- Conteos físicos
- Mermas
- Análisis food cost real vs teórico

---

## RESUMEN COMPACTO

| Módulo | Tabs | Total cards/elementos |
|---|---|---|
| Panel Global | 5 (General/Operaciones/Finanzas/Cashflow/Marcas) | 38 |
| Conciliación | 2 (Resumen/Movimientos) | 13 |
| Facturación | sin tabs | 4 cards superiores + tabla |
| Objetivos | 2 (Venta/Presupuesto) | 5 |
| Running | 3 (Resumen/PyG/Comparativas) | 14 |
| PE | 5 (Resumen/Día sem/Simulador/Escenarios/Tesorería) | 12 |
| Configuración | 6 | depende sub-tabs |
| Importador | 4 | depende |
| Tareas | 3 | depende |
| Equipo | 6 | depende |

**Total elementos distribuidos: ~100+**

NO improvisar, NO añadir, NO eliminar sin orden. Esta es la distribución oficial.
