# SPEC — Bloque 1 Fundaciones · Plan contable + Reestructura ERP

## Contexto
Sesión 27-abr-2026 con Rubén. 128 fixes detectados al revisar todos los módulos del ERP. Se consolidan en un único spec ejecutado por pipeline subagentes (pm-spec → architect-review → implementer → qa-reviewer → erp-reviewer).

## Reglas duras vigentes
1. Aislamiento absoluto Binagre ↔ David (RULES.md §1)
2. Tokens canónicos (RULES.md §2)
3. Modo localhost — NO Vercel hasta confirmación Rubén (RULES.md §3)
4. Ejecución autónoma sin preguntas resolubles (RULES.md §8)
5. Spec sin huecos (RULES.md §9)

## Constantes (NO preguntar)
```ts
const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'
const NIF_RUBEN = '21669051S'
const NIF_EMILIO = '53484832B'
const DRIVE_OPERACIONES_ID = '1dB6REknvNl8JxGGuv8MXloUCJ3_evd7H'
const PLATAFORMAS = ['uber eats','uber bv','portier eats','glovo','glovoapp','just eat','takeaway','rushour']
const COLOR_RUBEN = '#F26B1F' // naranja
const COLOR_EMILIO = '#1E5BCC' // azul

// Ciclos pago plataformas (cobros pendientes)
const CICLOS_PAGO = {
  uber: 'lunes_semanal_lunes_a_domingo_anterior',
  glovo: '1-15_paga_5_mes_siguiente__16-fin_paga_20_mes_siguiente',
  just_eat: '1-15_paga_20_mismo_mes__16-fin_paga_5_mes_siguiente',
  directa: 'al_dia',
  web: 'pendiente_definir'
}
```

---

## SECCIÓN 1 · PLAN CONTABLE PROFESIONAL HOSTELERÍA

### Estructura PyG
```
INGRESOS BRUTOS (suma ventas por canal sin tocar)
  (-) Comisiones plataformas + IVA 21%
INGRESOS NETOS
  (-) PRODUCTO · COGS (objetivo 25-30%)
MARGEN BRUTO
  (-) EQUIPO · LABOR (objetivo 30-35%)
PRIME COST = COGS + LABOR (KPI sector 55-65%)
  (-) LOCAL · OCCUPANCY (objetivo 5-10%)
  (-) CONTROLABLES · OPERATING EXPENSES (objetivo 13-18%)
EBITDA (objetivo 10-13%)
  (-) Provisiones IVA + IRPF
RESULTADO LIMPIO
```

### Categorías maestras (única lista en TODO el ERP)

**INGRESOS** (no son gasto, son entradas brutas)
1. ING-UE — Venta Uber Eats
2. ING-GL — Venta Glovo
3. ING-JE — Venta Just Eat
4. ING-WEB — Venta Web propia
5. ING-DIR — Venta Directa
6. ING-OTRO — Otros ingresos (devoluciones IVA, abonos)

**1. PRODUCTO** (COGS · 25-30%)
1. PRD-MP — Materia prima (Mercadona, Carrefour, Makro, mercados, frutas, carnes, pescados)
2. PRD-BEB — Bebidas
3. PRD-PCK — Packaging
4. PRD-MER — Mermas y roturas

**2. EQUIPO** (LABOR · 30-35%)
1. EQP-NOM — Sueldos empleados nómina
2. EQP-RUB — Sueldo socio Rubén
3. EQP-EMI — Sueldo socio Emilio
4. EQP-SS — Seguridad Social
5. EQP-GES — Gestoría laboral
6. EQP-FOR — Formación e incentivos

**3. LOCAL** (OCCUPANCY · 5-10%)
1. LOC-ALQ — Alquiler local
2. LOC-IRP — IRPF retención alquiler (19%)
3. LOC-SUM — Suministros (luz, agua, gas)
4. LOC-NET — Internet y telefonía
5. LOC-MTO — Mantenimiento y reparaciones
6. LOC-LIM — Limpieza
7. LOC-COM — Comunidad

**4. CONTROLABLES** (OPEX · 13-18%)
1. CTR-MKT — Marketing y publicidad
2. CTR-SW — Software y suscripciones
3. CTR-GEF — Gestoría fiscal/contable
4. CTR-BNK — Banco (comisiones, embargos)
5. CTR-SEG — Seguros
6. CTR-LIC — Licencias y tasas
7. CTR-TRP — Transporte y logística
8. CTR-OTR — Otros gastos

**5. PLATAFORMAS** (descuento sobre ingreso bruto, NO gasto operativo)
1. PLT-UE — Comisión Uber Eats
2. PLT-GL — Comisión Glovo
3. PLT-JE — Comisión Just Eat
4. PLT-RUS — Comisión Rushour
5. PLT-WEB — Comisión pasarela web
6. PLT-IVA — IVA 21% sobre comisiones

**6. INTERNO** (NO computa en PyG)
1. INT-TRF — Traspaso entre cuentas
2. INT-IVA — Devolución IVA
3. INT-PRS — Préstamo socio
4. INT-AJU — Ajuste contable

### Migración BD
1. Crear tabla `categorias_maestras` con códigos arriba
2. Migrar `categorias_conciliacion` actual (53 categorías) a códigos nuevos vía mapping table
3. Recategorizar todos los movimientos existentes según mapping
4. Recategorizar todos los gastos en Running según mapping
5. Backup completo antes de migrar (`SELECT * INTO categorias_backup_27042026 FROM categorias_conciliacion`)

---

## SECCIÓN 2 · ELIMINACIONES

### Módulos eliminar completos
1. `/finanzas/socios` (Socios.tsx + ruta + sidebar item)
2. `/analisis` (mover funcionalidad escenarios a PE como tab)
3. `/finanzas/facturas` (Facturas.tsx + ruta + sidebar item) — funcionalidad pasa a Conciliación
4. `/finanzas/gestoria` (Gestoria.tsx + ruta + sidebar item)

### Tabs/cards/bloques eliminar dentro de módulos vivos
1. Conciliación · card "Categorías de gastos" (top + total)
2. Conciliación · columna gris de gastos
3. Conciliación · gráficos "Ingresos vs Gastos semanal" e "Ingresos/Gastos/Saldo" (mover a Panel Global)
4. Running · bloque "Ingresos por marca" (vacío)
5. Running · bloque "Sueldos del periodo" (duplicado con cashflow)
6. PE · toggle "Sin IVA / Con IVA"
7. PE · tab "Presupuestos" (movido a Objetivos)
8. Configuración · tab "Tipos de cocina" (mover a propiedad de Marca)

---

## SECCIÓN 3 · RECONFIGURACIÓN MÓDULOS

### 3.1 — Configuración (4 tabs únicas)

**Tab 1 · Marcas**
- Lista marcas con canales activos por marca (multi-select Uber/Glovo/Just Eat/Web/Directa)
- Margen objetivo configurable por marca (default 70%)
- Estado: ACTIVA / PAUSADA
- Tipo de cocina como propiedad de marca (no tab aparte)

**Tab 2 · Categorías financieras**
- Lista única de las 5 categorías + subcategorías del plan contable
- Editable: añadir/renombrar/eliminar subcategorías
- Cambios se propagan automáticamente a Conciliación, Running, Objetivos, PE

**Tab 3 · Plataformas y canales**
- Lista de canales con: nombre, % comisión, € fijo por pedido, ciclo de pago
- Configurar OAuth/API por plataforma (futuro)
- Reglas auto-categorización (NIF emisor → categoría)

**Tab 4 · Cuentas y conexiones**
- Cuentas bancarias con saldo (solo las activas)
- Drive Google (OAuth ya conectado: rubenrodriguezvinagre@gmail.com)
- Futuras integraciones POS

**Tab 5 · Usuarios y permisos**
- Roles: Admin / Socio / Equipo cocina / Solo lectura
- Permisos por módulo (lectura/edición/sin acceso)
- Vinculado a futuro módulo Equipo (Bloque G)

### 3.2 — Objetivos (añadir tab Presupuestos)

**Existente:** Dashboard objetivos facturación + Histórico cumplimiento

**Cambios:**
1. Título "S18" → "S18 — 27/04/26" como selector navegable (semanas pasadas + futuras hasta fin año siguiente)
2. Card "Objetivo por día": día actual NO en rojo (cambiar a borde grueso o fondo claro destacado)
3. Card "Objetivo por día": quitar "S18" del subtítulo (redundante)
4. Tabla histórico: añadir columnas % Real (real/objetivo) y % Desviación

**Tab nuevo · Presupuestos:**
- Tabla 12 meses × 4 categorías (Producto / Equipo / Local / Controlables)
- Editable inline por celda
- Botón "Copiar año anterior"
- Total mensual y anual auto-calculado
- Esto es la única fuente de verdad de presupuestos en TODO el ERP

### 3.3 — Conciliación (rehecho)

**Título:** "Conciliación" (quitar "Resumen ·")

**Header:**
1. Selector periodo arriba derecha: día / semana (S17 — 27/04/26) / mes / trimestre / año / rango personalizado
2. Cards Ingresos / Gastos / Balance / Pendientes con subtítulo dinámico según selector

**Tabs:**
1. **Resumen**
   - Card Cashflow (caja líquida, provisiones IVA/IRPF, dinero real disponible)
   - Cards 5 categorías (Producto/Equipo/Local/Controlables/Plataformas) con % consumido vs presupuesto Objetivos, semáforo
   - Sección "Cobros pendientes" calculados según ciclos plataformas
   - Sección "Pagos pendientes" calculados de facturas pendientes + fijos del mes
   - Proyección caja: 7d / 30d / 3m / 6m / 1a (formato barra verde)

2. **Movimientos**
   - Dropzone único: extractos bancarios (CSV/XLSX) + facturas (PDF/imagen). Auto-detecta tipo
   - QUITAR selector "Titular bancario" (auto-detección por NIF)
   - Selector "Categoría" alineado a las 5 categorías nuevas
   - Filtros rápidos arriba tabla: Pendientes / Asociadas / Faltantes / Duplicadas / Sin titular
   - Buscador unificado: proveedor / nº factura / importe / concepto
   - Columna "PDF" → renombrar "Doc"
   - Columna "Contraparte": si hay factura asociada, mostrar proveedor real
   - Botón "+ Añadir gasto" (movido desde Running)

### 3.4 — Running (rehecho)

**Header:**
- Quitar toggle "Sin IVA / Con IVA" (siempre sin IVA)
- Quitar selector "Todos los socios"
- Quitar botón "+ Añadir gasto" (movido a Conciliación)

**Tabs:**
1. **Resumen**
   - Cards Cashflow real (mantener izquierda y derecha intactas — son valor único)
   - Cards Facturación bruta / Ingresos netos / Total gastos / Resultado / Prime Cost / EBITDA
   - Sparklines visuales (rehacer para mostrar tendencia útil)
   - Sección desglose por las 5 categorías con % sobre ingresos vs banda objetivo (semáforo)

2. **PyG detallado**
   - Tabla anual completa (arreglar corte derecho)
   - Estructura: Ingresos brutos → Comisiones → Ingresos netos → COGS → Margen bruto → Labor → Prime Cost → Occupancy → OPEX → EBITDA → Provisiones → Resultado limpio
   - Columna acumulado anual al final

3. **Comparativas**
   - vs Presupuesto Objetivos
   - vs Mismo mes año anterior
   - vs Media últimos 3/6/12 meses

### 3.5 — Punto Equilibrio (rehecho)

**Quitar:**
- Toggle Sin IVA / Con IVA (calcular internamente)
- Tab Presupuestos (movido a Objetivos)

**Cards grandes estilo Panel Global** con selector periodo (día/semana/mes/60d/90d/6m/año):

**Tabs:**
1. **Resumen** (portada)
   - "¿Cubrimos fijos hoy?" Sí/No + margen proyectado
   - "¿Qué día de la semana cubrimos fijos?" con objetivo y con real actual
   - KPIs: pedidos/día y TM real necesarios para llegar a verde
   - Acciones recomendadas (mantener — es lo más valioso del módulo)

2. **Día semana** (mejorado dentro de cards grandes, no aislado)

3. **Simulador** (sliders inline integrados con feedback inmediato)

4. **Escenarios** (ex-módulo Análisis)
   - "Qué pasa si subo precio 5%"
   - "Qué pasa si bajo food cost 2%"
   - "Qué pasa si recupero 5% directa"
   - Guardables y comparables

5. **Tesorería futura**
   - Provisiones IVA/IRPF (movidas desde Configuración)
   - Calendario de pagos críticos próximos 90 días

### 3.6 — Panel Global (rediseño completo)

**Header:**
- Selector periodo: rango personalizado a la derecha de "Todos los canales" (no arriba)
- Selector semana tipo "S17 — 20/04/26" desplegable a la derecha
- Botón derecho "Todos" → renombrar "Canales"

**4 cards grandes superiores** (fijas, contenido cambia según vista):
- Vista Día: Día / Semana / Mes / Año
- Vista Semanas: Semana / Mes / 3 meses / Año
- Vista Meses: Mes / 3 meses / 6 meses / Año
- Vista Año: Mes / Trimestre / Semestre / Año

**Card Ventas:**
- Objetivos leen del módulo Objetivos (NO hardcoded)
- Editables inline al pulsar el número
- Si dejar a 0, restaurar valor original

**Cards canal (Uber/Glovo/Just Eat/Web/Directa):**
- Fórmula neto correcta: `bruto - (bruto × comisión%) - (pedidos × comisión fija) - IVA 21% × (comisión% + comisión fija)`
- Margen recalcula automáticamente
- Mantener cálculo dentro de tokens.ts pero leer comisiones de tabla `canales` BD (no hardcoded)

**Card Días pico:**
- Respetar rango/semana del filtro global (no fijo a semana actual)

**Tabs Panel Global:**
1. General (vista actual mejorada)
2. Operaciones (KPIs operativos: pedidos, TM, días pico, picos hora)
3. Finanzas (sparklines Running + ratio gastos/netos + EBITDA)
4. Cashflow (gráfico flujo de caja real con cobros/pagos pendientes proyectados 7d/30d/3m/6m/1a)
5. Marcas (vista cruzada Plataforma × Marca — esqueleto, datos llegan en Bloque 2)

### 3.7 — Facturación (rehecho)

**Vista Diario / Semanas / Meses / Año** (añadir Año):
- Cards grandes: 4 fijas con contenido dinámico según vista
- Eliminar hilera cards medianas (Facturación bruta / Pedidos / TM / Facturación diaria)
- Toda la info se consolida en las 4 cards grandes

**Vista Diario:**
- Cards: Día / Semana / Mes / Año
- Formato fechas: "Lunes, 4 abril 2026" / "Semana 17 — 4 abril"
- Tabla con servicio ALM/CENA/AMBOS según día (no fijo "TODO")
- Si solo ALM, no mostrar fila CENA vacía (y viceversa)
- Si día tiene ambos: dos filas dentro del día, una por servicio

**Selectores:**
- Botón "Todos" derecho → "Canales"
- Filtro servicio mantiene Todos/ALM/CENAS

**Importar histórico Excel almuerzos/cenas a BD:** lo hace Claude (no Rubén) con script de migración

### 3.8 — Escandallo (v1 mantenido + v2 paralelo)

1. NO tocar Escandallo v1 actual (sigue funcionando)
2. Crear ruta `/escandallo-v2` con misma estructura BD
3. v2 mejora: usabilidad (lo más complejo)
4. Cuando v2 validado por Rubén, desconectar v1 y promover v2 a ruta principal

---

## SECCIÓN 4 · CRITERIOS ACEPTACIÓN (QA-REVIEWER)

### Build y migración
1. `npm run build` 0 errores
2. Migración BD ejecutada sin errores, backup creado
3. Mapping de 53 categorías antiguas → 5 nuevas + subcategorías validado en Supabase
4. 5.716 movimientos conciliación recategorizados sin pérdida

### Eliminaciones validadas
5. Sidebar NO muestra: Socios, Análisis, Importar Facturas, Gestoría
6. Rutas `/finanzas/socios`, `/analisis`, `/finanzas/facturas`, `/finanzas/gestoria` devuelven 404
7. NO existen referencias rotas a estos módulos en el código

### Configuración
8. Tab Marcas: lista 27 marcas con canales activos visibles
9. Tab Categorías: lista 5 grupos con subcategorías editables
10. Tab Plataformas: muestra ciclos de pago configurados según constantes
11. Tab Cuentas: Drive conectado, cuentas bancarias listadas

### Conciliación
12. Título solo "Conciliación"
13. Auto-detección titular por NIF funciona (probar con factura de Rubén y de Emilio)
14. Dropzone acepta CSV, XLSX, PDF e imagen
15. Filtros rápidos pendientes/asociadas/faltantes/duplicadas/sin-titular funcionan
16. Cards de presupuesto leen de Objetivos
17. Cobros pendientes calcula real según ciclos plataformas (Uber semanal, Glovo bimestral, Just Eat bimestral)

### Running
18. Sin toggle IVA, sin selector socios
19. Cards muestran Prime Cost y EBITDA correctamente calculados
20. Tabla PyG detallada se ve completa (no cortada a la derecha)
21. Comparativas vs presupuesto y vs año anterior calculan correctamente

### Panel Global
22. Cards grandes cambian contenido según vista seleccionada
23. Card Ventas: pulsar objetivo abre edición inline, guarda en BD `objetivos`
24. Cards canal: neto correcto con IVA 21% sobre comisiones
25. Card Días pico respeta filtro de periodo global
26. 4 tabs (General/Operaciones/Finanzas/Cashflow) navegables
27. Vista Marcas presente como esqueleto

### Punto Equilibrio
28. Cards grandes con selector periodo
29. "¿Cubrimos fijos?" responde Sí/No con datos reales del Running
30. Tab Escenarios funciona con sliders inline
31. Tab Tesorería futura muestra provisiones IVA/IRPF

### Facturación
32. Vista Año añadida al conmutador
33. 4 cards grandes con contenido dinámico
34. Servicio ALM/CENA correctamente desglosado por día (verificar S3, S7, S8 que tenían almuerzos)
35. Sin filas vacías de servicio sin datos

### Escandallo
36. v1 sigue funcionando intacto en `/escandallo`
37. v2 disponible en `/escandallo-v2` con misma BD

---

## SECCIÓN 5 · DECISIONES AUTÓNOMAS PERMITIDAS

El implementer puede tomar autónomamente:
1. Mapping exacto categorías antiguas → nuevas (usar lógica más cercana)
2. Estilos de componentes nuevos siguiendo tokens canónicos
3. Estructura de tabs nuevos respetando patrón Panel Global
4. Formato de fechas y números siguiendo `fmtEur` y `parseLocalDate` existentes
5. Queries Supabase para leer/escribir en tablas existentes

El implementer DEBE preguntar si:
1. Encuentra ambigüedad en mapping de categorías (ej: una subcategoría podría ir a Producto o Controlables)
2. Detecta riesgo de pérdida de datos en migración
3. Encuentra dependencia con módulo David ERP (debe parar inmediatamente)

---

## CIERRE

```bash
git add . && git commit -m "feat(bloque1): plan contable profesional + reestructura ERP completa" && git push origin master && git pull origin master
```

NO Vercel. Solo localhost. Rubén valida módulo por módulo en `http://localhost:5173`.

Una vez validado en localhost, Rubén dirá "deploy Vercel" para promover.
