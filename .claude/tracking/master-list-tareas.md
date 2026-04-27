# MASTER LIST — Sesión 27 abr 2026

Lista cronológica completa de TODAS las tareas pedidas en sesión Rubén + Claude del 27 abril 2026.

**Total: 261 tareas en 19 bloques.**

---

## A — Hotfix V2 (descartado, NO aplicable)
Estado: descartado en favor de Bloque 1. Working tree limpio, branch al día con master.
8 tareas A1-A8 no se ejecutan.

## BLOQUE 1 — EN CURSO en Claude Code · 207 tareas

### B — Panel Global (23)

- B1. Selector "Rango personalizado" mover a la derecha de "Todos los canales"
- B2. Añadir selector semana "S17 — 20/04/26" (formato fecha esp.)
- B3. Selector semana desplegable hacia la derecha
- B4. Card Ventas: objetivos del módulo Objetivos (no hardcoded)
- B5. Card Ventas: editables inline al pulsar la cifra
- B6. Card Ventas: 0 restaura valor original
- B7. Cards canal: validar fórmulas bruto/neto
- B8. Cards canal: añadir IVA 21% sobre comisiones al neto
- B9. Cards canal: aplicar a todos canales con comisión > 0
- B10. Cards canal: línea Margen recalcula tras corregir
- B11. Card Días pico: respeta filtro periodo global
- B12. Cards grandes: contenido cambia según vista
- B13. Cards grandes: 4 fijas
- B14. Eliminar hilera cards medianas
- B15. Vista Diario: Día/Semana/Mes/Año
- B16. Vista Semanas: Semana/Mes/3 meses/Año
- B17. Vista Meses: Mes/3 meses/6 meses/Año
- B18. Vista Año: Mes/Trimestre/Semestre/Año
- B19. Añadir vista Año al conmutador
- B20. Formato fechas "Lunes, 4 abril 2026" / "Semana 17 — 4 abril"
- B21. Botón derecho "Todos" → "Canales"
- B22. Tabs: General/Operaciones/Finanzas/Cashflow
- B23. Tab Cashflow: gráfico flujo caja real proyectado 7d/30d/3m/6m/1a

### C — Objetivos (11)

- C1. Mantener estilo Panel/Conciliación con tokens en TODO módulo rehecho
- C2. Día actual NO en rojo
- C3. Quitar S18 subtítulo card
- C4. Título S18 → "S18 — 27/04/26" como selector
- C5. Selector navega semanas pasadas/futuras hasta fin año siguiente
- C6. Tabla histórico: añadir % Real
- C7. Tabla histórico: añadir % Desviación
- C8. Tab Presupuestos único origen verdad presupuestos
- C9. Tab Presupuestos: tabla 12m × categorías editable inline
- C10. Tab Presupuestos: botón "Copiar año anterior"
- C11. Tab Presupuestos: total mensual y anual auto

### D — Conciliación (34)

- D1. Título solo "Conciliación"
- D2. Quitar selector titular bancario
- D3. Auto-detección NIF (Rubén 21669051S, Emilio 53484832B)
- D4. Sin NIF → pendiente revisión manual
- D5. Selector Categoría alineado Running
- D6. Eliminar "Ingresos plataformas" e "Ingresos web directa", unificar "Ingresos"
- D7. Resto categorías idénticas a Running
- D8. Importar extracto: PDF/Excel/imagen + CSV/XLSX
- D9. Leyenda "Arrastra documento (CSV, XLSX, PDF, imagen)"
- D10. Card "Todo al día": letras verdes
- D11. Card "Todo al día": quitar leyenda "Click para filtrar"
- D12. Card "Todo al día": mismo tamaño que otras cards
- D13. Selector arriba: vista por semanas S17 — 27/04/26
- D14. Cards subtítulo dinámico según selector
- D15. Columna Contraparte: proveedor real si hay factura asociada
- D16. Columna PDF → Doc
- D17. Uniformizar categorías TODO ERP
- D18. Cards I/G/B/P según selector periodo
- D19. Eliminar card "Categorías de gastos"
- D20. Eliminar columna gris gastos
- D21. Card Tesorería vs Caja líquida: revisar contigo qué hace
- D22. Cobros pendientes: real según ciclos plataformas
- D23. Pagos pendientes: real (fijos + variables facturas)
- D24. Proyección 7d/30d/3m/6m/1a barra verde
- D25. Eliminar card "Ratio Ingresos/Gastos" (mover Panel/Running)
- D26. Eliminar Balance Neto duplicado (mover Panel)
- D27. Cards Presupuestos solo lectura (edición vive en Objetivos)
- D28. 5 cards Producto/Equipo/Local/Controlables/Plataformas con consumo vs presupuesto y semáforo
- D29. Eliminar gráfico "Ingresos vs Gastos semanal" (mover Panel)
- D30. Eliminar gráfico "Ingresos/Gastos/Saldo" (mover Panel)
- D31. Dropzone único: extractos + facturas, auto-detecta y enruta
- D32. Filtros rápidos: Pendientes/Asociadas/Faltantes/Duplicadas/Sin titular
- D33. Buscador unificado proveedor/nº factura/importe/concepto
- D34. Botón "+ Añadir gasto" se mueve aquí desde Running

### E — Eliminaciones módulos (4)

- E1. Eliminar Socios (página + ruta + sidebar)
- E2. Eliminar Análisis (mover a PE Escenarios)
- E3. Eliminar Importar Facturas (a Conciliación)
- E4. Eliminar Gestoría

### F — Punto Equilibrio (18)

- F1. Estilo cards grandes Panel Global
- F2. Tabs y selectores, eliminar duplicados
- F3. Datos vienen de Running (única verdad)
- F4. Pregunta clave: ¿Qué día cubrimos fijos con objetivo?
- F5. Pregunta clave: ¿Y con real actual incluyendo desviaciones?
- F6. Selector periodo día/sem/mes/60d/90d/6m/año
- F7. KPI pedidos/TM real necesarios
- F8. Eliminar toggle Sin IVA / Con IVA
- F9. Simulador integrado en portada
- F10. Sliders visuales feedback inmediato
- F11. Tab Día semana rehecho dentro cards grandes
- F12. Eliminar tab Presupuestos (movido Objetivos)
- F13. Mantener Acciones recomendadas
- F14. Tab Resumen ¿Cubrimos? + ¿Qué día? + KPIs
- F15. Tab Día semana cards grandes
- F16. Tab Simulador sliders inline
- F17. Tab Escenarios (ex-Análisis) guardables comparables
- F18. Tab Tesorería futura: provisiones IVA/IRPF + calendario pagos 90d

### G — Running (19)

- G1. Sparklines visuales rehechas (mantener en Running)
- G2. Recategorizar 5 categorías comunes
- G3. Eliminar etiquetas "RRHH", "Internet y ventas", "Admin/Generales"
- G4. Tabs: Resumen + PyG + Comparativas
- G5. Tab Resumen: Cashflow + cards Facturación/Ingresos/Gastos/Resultado/Prime Cost/EBITDA + sparklines + 5 categorías
- G6. Tab PyG detallado tabla anual completa (arreglar corte derecho)
- G7. Estructura PyG: Brutos→Comisiones→Netos→COGS→MargenBruto→Labor→PrimeCost→Occupancy→OPEX→EBITDA→Provisiones→Limpio
- G8. Columna acumulado anual al final
- G9. Tab Comparativas vs Presupuesto Objetivos
- G10. Tab Comparativas vs Mismo mes año anterior
- G11. Tab Comparativas vs Media 3/6/12 meses
- G12. Eliminar bloque "Ingresos por marca" vacío
- G13. Eliminar bloque "Sueldos del periodo" duplicado
- G14. Eliminar toggle Sin IVA/Con IVA
- G15. Eliminar selector "Todos los socios"
- G16. Mover botón "+ Añadir gasto" a Conciliación
- G17. Cards Cashflow real izq/dcha intactas
- G18. Ratio Gastos/Netos solo aquí
- G19. Validar Running ERP vs Running Excel personal (postpuesto)

### H — Configuración (25)

- H1. 4 tabs: Marcas/Categorías/Plataformas/Cuentas
- H2. 5ª tab Usuarios y permisos
- H3. Tab Marcas: lista + canales activos multi-select
- H4. Tab Marcas: margen objetivo configurable (default 70%)
- H5. Tab Marcas: estado ACTIVA/PAUSADA
- H6. Tab Marcas: tipo cocina como propiedad de marca
- H7. Tab Categorías: lista única 5 categorías + subcategorías
- H8. Tab Categorías: editable
- H9. Cambios categorías propagan automáticamente
- H10. Tab Plataformas: nombre + %comisión + €fijo + ciclo pago
- H11. Tab Plataformas: OAuth/API futuro
- H12. Tab Plataformas: reglas auto-categorización NIF→categoría
- H13. Tab Cuentas: bancarias activas con saldo (limpiar vacíos)
- H14. Tab Cuentas: Drive Google ya conectado
- H15. Tab Cuentas: futuras integraciones POS
- H16. Eliminar tab "Accesos Uber" (a Plataformas)
- H17. Eliminar tab "Tipos de cocina" (a Marca)
- H18. Eliminar tab "Presupuestos mensuales" (a Objetivos)
- H19. Eliminar tab "Provisiones IVA/IRPF" (a PE Tesorería)
- H20. Submódulo Compras: revisar/mover Stock&Compras
- H21. Tab Usuarios: roles Admin/Socio/Cocina/Repartidor/Solo lectura
- H22. Tab Usuarios: permisos custom por módulo
- H23. Regla oro 1: variable definida UNA vez en Configuración
- H24. Regla oro 2: pausar marca propaga ocultamiento todos módulos
- H25. Regla oro 3: añadir categoría propaga aparición todos módulos

### I — Plan contable profesional (16)

- I1. Estructura PyG completa (Brutos→Limpio)
- I2. Códigos INGRESOS: ING-UE/GL/JE/WEB/DIR/OTRO
- I3. Códigos PRODUCTO: PRD-MP/BEB/PCK/MER (25-30%)
- I4. Códigos EQUIPO: EQP-NOM/RUB/EMI/SS/GES/FOR (30-35%)
- I5. Códigos LOCAL: LOC-ALQ/IRP/SUM/NET/MTO/LIM/COM (5-10%)
- I6. Códigos CONTROLABLES: CTR-MKT/SW/GEF/BNK/SEG/LIC/TRP/OTR (13-18%)
- I7. Códigos PLATAFORMAS: PLT-UE/GL/JE/RUS/WEB/IVA (descuento ingreso)
- I8. Códigos INTERNO: INT-TRF/IVA/PRS/AJU (no computa)
- I9. Tabla `categorias_maestras`
- I10. Mapping table 53→nuevas
- I11. Recategorizar 5.716 movimientos
- I12. Recategorizar gastos Running
- I13. Backup BD obligatorio antes
- I14. Subtítulos inglés benchmark sector ("Producto · COGS", "Equipo · Labor", "Prime Cost", "EBITDA")
- I15. KPI EBITDA objetivo 10-13%
- I16. KPI Prime Cost objetivo 55-65%

### J — Facturación (15)

- J1. Cards grandes 4 fijas dinámicas
- J2. Eliminar hilera medianas
- J3. Vista Diario/Semanas/Meses/Año (añadir Año)
- J4. Vista Diario · cards Día/Semana/Mes/Año
- J5. Vista Semanas · cards Semana/Mes/3m/Año
- J6. Vista Meses · cards Mes/3m/6m/Año
- J7. Vista Año · cards Mes/Trimestre/Semestre/Año
- J8. Formato fechas español
- J9. Botón "Todos" derecho → "Canales"
- J10. Filtro servicio Todos/ALM/CENAS izquierda
- J11. Columna SERV: ALM/CENA/AMBOS según día (no fijo TODO)
- J12. Día con ambos: dos filas dentro día
- J13. Solo ALM: no mostrar fila CENA vacía
- J14. Solo CENA: no mostrar fila ALM vacía
- J15. Importar histórico Excel ALM/CENA vía script (Claude lo hace)

### K — Importar Facturas (eliminar) (6)

- K1. Eliminar módulo del sidebar
- K2. Drag&drop facturas → Conciliación
- K3. Sistema detecta tipo y enruta
- K4. 5 cards estado → Conciliación Movimientos como filtros
- K5. Selector SL/Rubén/Emilio desaparece (auto NIF)
- K6. Buscador integrado en Conciliación Movimientos

### L — Calendario operativo (26)

- L1. Configuración tab Calendario operativo (mensual navegable)
- L2. Click día asignar tipo
- L3. Tipo Operativo (default)
- L4. Tipo Solo comida
- L5. Tipo Solo cena
- L6. Tipo Cerrado total
- L7. Tipo Festivo
- L8. Tipo Vacaciones
- L9. Bulk operations rangos
- L10. Tabla BD `calendario_operativo`
- L11. Default todos Operativo
- L12. PE días operativos lee calendario
- L13. PE pedidos/día con días reales
- L14. PE ¿Qué día cubrimos? salta cerrados
- L15. PE card Día semana excluye cerrados
- L16. Facturación día cerrado muestra "CERRADO"
- L17. Facturación objetivo semanal recalcula proporcional
- L18. Running media diaria = total/días operativos
- L19. Running comparativa año anterior ajusta días
- L20. Panel "Faltan X€" considera operativos restantes
- L21. Panel card Días pico excluye cerrados
- L22. Objetivos % real/objetivo ajusta días operativos
- L23. Aviso futuro N cerrados → recalcular y mostrar
- L24. Día CERRADO actual: ocultar/grisar "Objetivo de hoy"
- L25. Vincular con horarios Equipo (Bloque G)
- L26. Vincular Equipo vacaciones con calendario operativo

### M — Escandallo (4)

- M1. v1 intacto en /escandallo
- M2. v2 paralelo en /escandallo-v2 misma BD
- M3. v2 mejora usabilidad
- M4. Cuando v2 validado, desconectar v1 y promover v2

### N — Cierre Bloque 1 (6)

- N1. Pipeline pm-spec → architect-review → implementer → qa-reviewer → erp-reviewer
- N2. Modo localhost — NO Vercel
- N3. 37 criterios aceptación qa
- N4. Aislamiento Binagre vs David
- N5. Commit + push master, sin Vercel
- N6. Informe final: build, validaciones, archivos, decisiones autónomas

---

## BLOQUE 2 — PARADO esperando archivos plataformas · 24 tareas

### O — Importador y vista marca×canal

- O1. Dropzone multi-formato CSV/XLSX/PDF/imagen
- O2. Auto-detecta plataforma por estructura
- O3. Parser Uber Eats / Portier B88515200
- O4. Parser Glovo formato A (detalle pedidos pág 2)
- O5. Parser Glovo formato B (resumen)
- O6. Parser Just Eat (pendiente recibir archivo)
- O7. Parser Rushour Francia IVA 20%
- O8. Auto-detección marca por nombre tienda
- O9. Cruzar marca con maestro Marcas Configuración
- O10. Detectar Mister Katsu desde cliente factura
- O11. Detectar Los Menús de Carmiña
- O12. Detectar Binagre y otras marcas virtuales
- O13. BD desglose fecha+plataforma+marca+bruto+neto+pedidos+TM
- O14. Múltiples facturas mismo periodo: acumular por marca
- O15. Extraer "Fecha de Pago" Glovo
- O16. Extraer "Ingreso a cuenta colaborador" Glovo
- O17. Acumular detalle pedido-plato-fecha
- O18. Panel tab Marcas heatmap
- O19. Panel tab Marcas top por canal
- O20. Panel tab Marcas margen real combo
- O21. Acción: pausar marca X en plataforma Y bajo umbral
- O22. Acción: subir precios si demanda alta margen bajo
- O23. Acción: reforzar marketing combo ganador
- O24. Reconstrucción inversa Running 2025-2024 (postpuesto)

---

## BLOQUES FUTUROS — PARADO Notion · 30 tareas

### P — Equipo módulo nuevo (14)
P1. Módulo Equipo en sidebar (sustituye Socios)
P2. Empleados ficha completa
P3. Nóminas histórico mensual
P4. Calendario laboral festivos/vacaciones/bajas
P5. Horarios planificador con turnos
P6. Horarios descansos legales
P7. Horarios máx horas/semana
P8. Permisos empleado solicita
P9. Permisos admin aprueba/rechaza
P10. Portal empleado login propio
P11. Portal empleado ve solo lo suyo
P12. Permisos vinculados Configuración
P13. Documentos en Drive con permisos
P14. Vinculación con Calendario operativo

### Q — Escandallo conectado (9)
Q1-Q9. Conexiones con Compras, Recetas, PE, Marcas, recálculos automáticos, alertas, histórico precios, comparativa proveedores.

### R — Inventario físico (5)
R1-R5. Conteos, vínculos, food cost real, alertas mermas, trazabilidad.

### S — Menu Engineering + Recetario (2)
S1. Menu Engineering matriz rentabilidad/popularidad
S2. Recetario cocina paso a paso

---

## RECUENTO

| Bloque | Tareas | Estado |
|---|---|---|
| A Hotfix V2 | 8 | Descartado |
| B Panel Global | 23 | EN CURSO |
| C Objetivos | 11 | EN CURSO |
| D Conciliación | 34 | EN CURSO |
| E Eliminaciones | 4 | EN CURSO |
| F PE | 18 | EN CURSO |
| G Running | 19 | EN CURSO |
| H Configuración | 25 | EN CURSO |
| I Plan contable | 16 | EN CURSO |
| J Facturación | 15 | EN CURSO |
| K Importar Facturas | 6 | EN CURSO |
| L Calendario operativo | 26 | EN CURSO |
| M Escandallo v2 | 4 | EN CURSO |
| N Cierre Bloque 1 | 6 | EN CURSO |
| **Subtotal Bloque 1** | **207** | EN CURSO |
| O Bloque 2 | 24 | PARADO |
| P Equipo | 14 | PARADO |
| Q Escandallo conectado | 9 | PARADO |
| R Inventario | 5 | PARADO |
| S Menu Engineering | 2 | PARADO |
| **Subtotal futuro** | **54** | PARADO |
| **TOTAL** | **261** | |
