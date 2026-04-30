# Spec · Conciliación + Bancos y Cuentas · BATCH FIX 2

> **Modelo:** Sonnet por defecto. Subagentes Sonnet. NO Opus.
> **Modo:** Localhost + deploy Vercel al final autorizado.
> **Aislamiento Binagre:** NUNCA tocar erp-david.
> **REGLA #1:** Spec literal. NO improvisar.
> **Base previa:** commit `338d02c` ya implementado. Este spec corrige bugs detectados en QA visual.
> **BD:** Tabla `conciliacion` ya wipeada (0 movimientos). El usuario va a re-importar via /importador.

---

## 14 FIXES OBLIGATORIOS

### A · SIDEBAR

#### FIX 1 · Eliminar item duplicado del sidebar

- En el sidebar bajo Configuración aparece tanto "Bancos y Cuentas" (nuevo) como "Cuentas y conexiones" (viejo)
- Eliminar definitivamente el item "Cuentas y conexiones" del sidebar
- También eliminar la ruta `/configuracion/cuentas-y-conexiones` si existe
- Mantener únicamente "Bancos y Cuentas"

---

### B · BANCOS Y CUENTAS / CATEGORÍAS

#### FIX 2 · Eliminar texto "banda X-Y %" en nombres de bloques

En la tabla de categorías nivel 1 hoy aparece:
- "Producto · banda 25-30 %"
- "Equipo · banda 30-35 %"
- "Alquiler · banda 5-8 %"
- "Controlables · banda 15-18 %"

Cambiar a solo el nombre del bloque, sin banda:
- "Producto"
- "Equipo"
- "Alquiler"
- "Controlables"

Aplicar en TODOS los lugares donde se renderice el nombre del bloque (tabla categorías, badges, dropdowns).

Las bandas siguen guardadas en BD `categorias_pyg.banda_min_pct` y `banda_max_pct` (no eliminar de BD), simplemente NO se muestran en la UI de Bancos y Cuentas.

---

### C · CONCILIACIÓN / HEADER

#### FIX 3 · Eliminar dropdown "Cuenta · Todas"

- En el header de Conciliación hay un dropdown "Cuenta · Todas ▾"
- Eliminarlo completamente
- Solo queda el dropdown SelectorFechaUniversal "Mes en curso ▾"

#### FIX 4 · Subtítulo periodo en formato dd/mm/yy

- Subtítulo actual: `1 abr — 30 abr 2026`
- Subtítulo correcto: `01/04/26 — 30/04/26`
- Usar helper `formatearFechaCorta()` o equivalente del stack
- Aplicar separador ` — ` (em dash con espacios)

---

### D · CONCILIACIÓN / 4 CARDS

#### FIX 5 · Card INGRESOS · limpiar textos

Eliminar:
- "58 movs" arriba derecha
- "Bruto del periodo · click para filtrar" abajo

Quedan solo:
- Label "INGRESOS"
- Cifra `+X.XXX,XX €` verde

#### FIX 6 · Card GASTOS · limpiar textos

Eliminar:
- "38 movs" arriba derecha
- "Total gasto · click para filtrar" abajo

Quedan solo:
- Label "GASTOS"
- Cifra `-X.XXX,XX €` rojo

#### FIX 7 · Card PENDIENTES · limpiar textos

Eliminar:
- "Sin asociar · click para filtrar" abajo

Mantener:
- Label "PENDIENTES"
- Badge naranja con número de pendientes arriba derecha
- Cifra `X.XXX,XX €` naranja

#### FIX 8 · Card TITULAR · limpiar texto

Eliminar:
- "filtro activo" arriba derecha

Mantener:
- Label "TITULAR"
- Texto del filtro activo (Todos / Rubén / Emilio) en grande
- Toggle 3 botones (Todos / Rubén / Emilio)

---

### E · CONCILIACIÓN / FILTROS Y TABLA

#### FIX 9 · Dropdown Categoría debe filtrar la tabla

- Hoy: al seleccionar una categoría en el dropdown "Categoría · Todas las categorías ▾" no se filtra la tabla
- Esperado: al seleccionar un detalle (ej. "2.11.5 Lidl") la tabla muestra solo movimientos con ese detalle
- Lista de opciones del dropdown:
  - "Todas las categorías" (default, sin filtro)
  - Lista de TODOS los detalles nivel 3 de la tabla `categorias_pyg` ordenados por ID jerárquico
  - Cada item muestra `{id} {nombre}` (ej. "2.11.5 Lidl")
- Ancho mínimo del dropdown: 280px
- Click en una opción → filtra tabla en tiempo real, persiste hasta que se seleccione otra o "Todas las categorías"

#### FIX 10 · Layout fijo de la tabla

- Hoy: al cambiar de card seleccionada (Ingresos/Gastos/Pendientes), las columnas de la tabla cambian de ancho y el contenido se reflowea
- Esperado: anchos de columnas fijos. La tabla NO se mueve al cambiar de filtro
- Implementación: usar `table-layout: fixed` en CSS de la tabla con anchos explícitos por columna:
  - Fecha: 90px
  - Concepto: flex (al menos 22%)
  - Contraparte: 16%
  - Importe: 110px (right)
  - Categoría: 200px
  - Doc: 80px (center)
  - Estado: 110px
  - Titular: 100px
- El total de anchos fijos debe sumar < 100% para dejar el flex a Concepto

#### FIX 11 · Filas de la tabla más bajas

- Reducir padding vertical de las filas
- Antes: `padding: 14px 16px`
- Ahora: `padding: 8px 16px`
- Aplicar también al thead: `padding: 10px 16px`
- Border-bottom de las filas: `0.5px solid #ebe8e2` (sin cambio)
- Línea altura del texto: `line-height: 1.4` para que se mantenga legible aun con menos padding

---

### F · CATEGORÍA EN TABLA · MAPPING CORRECTO

#### FIX 12 · Categoría en tabla muestra el detalle correcto

- Hoy: TODOS los movimientos de gasto muestran "2.11.1 Mercadona" aunque sean de Lidl, Alcampo, Huijia, etc. Bug del mapping helper
- Esperado: cada movimiento muestra su detalle correcto según el contraparte detectado
- **NOTA:** dado que la tabla `conciliacion` está wipeada (0 movs), este fix se valida cuando el usuario re-importe vía Importador
- El parser/auto-categorizador del Importador debe asignar el `categoria_id` (nuevo nivel 3) usando reglas:
  - Concepto contiene "MERCADONA" → 2.11.1 Mercadona
  - Concepto contiene "ALCAMPO" → 2.11.2 Alcampo
  - Concepto contiene "CARREFOUR" → 2.11.3 Carrefour
  - Concepto contiene "DIA" (palabra exacta como tienda) → 2.11.4 Día
  - Concepto contiene "LIDL" → 2.11.5 Lidl
  - Concepto contiene "COCA" o "COCA-COLA" → 2.11.6 Coca Cola
  - Concepto contiene "PASCUAL" → 2.11.7 Pascual
  - Concepto contiene "LACTALIS" → 2.11.8 Lactalis
  - Concepto contiene "EMBAJADORES" → 2.11.9 Embajadores
  - Concepto contiene "JASA" → 2.11.10 Jasa
  - Concepto contiene "FRITRAVICH" → 2.11.11 Fritravich
  - Concepto contiene "PRODESCO" → 2.11.12 Prodesco
  - Concepto contiene "TGT" → 2.11.13 TGT
  - Concepto contiene "CHINA CAYENTE" → 2.11.14 China Cayente
  - Concepto contiene "CHINA GRUÑONA" o "CHINA GRUNONA" → 2.11.15 China Gruñona
  - Concepto contiene "AMAZON" → 2.11.16 Amazon Bebidas (default si es bebidas, sino dejar pendiente)
  - Concepto contiene "HUIJIA" → sin auto-asignar, dejar SIN CATEGORÍA (no estaba en el árbol original — el usuario lo añadirá desde Configuración)
  - Concepto contiene "ENVAPRO" → 2.12.1 Envapro
  - Concepto contiene "PUNTOQPACK" → 2.12.2 PuntoQpack
  - Concepto contiene "PAMPOLS" → 2.12.3 Pampols
  - Concepto contiene "BOLSEMACK" → 2.12.4 Bolsemack
  - Concepto contiene "WORKANA" → 2.23.1 Workana
  - Concepto contiene "ALQUILER" Y "MALICIOSA" → 2.31.1 Alquiler local
  - Concepto contiene "IBERDROLA" o "ENDESA" o "REPSOL" + LUZ → 2.44.2 Electricidad
  - Concepto contiene "REAL GAS" o "GAS NATURAL" o "NATURGY" → 2.44.3 Gas
  - Concepto contiene "CANAL ISABEL" o "AGUA" + suministro → 2.44.4 Agua
  - Concepto contiene "MOVISTAR" o "VODAFONE" o "ORANGE" → 2.44.1 Teléfono e internet
  - Concepto contiene "RUSHOUR" → 2.43.2 Integración Rushour
  - Concepto contiene "SINQRO" → 2.43.3 Integración Sinqro
  - Concepto contiene "FLYNT" → 2.43.5 Flynt
  - Concepto contiene "ANTHROPIC" o "OPENAI" o "CLAUDE" → 2.43.6 IA
  - Concepto contiene "CONTROL DE PLAGAS" o "PLAGAS" → 2.43.7 Control de plagas
  - Concepto contiene "AEAT" + "IVA" → 3.2 Devolución IVA (si entrada) o 3.5 Ajuste contable
  - Concepto contiene "TRASPASO" → 3.1 Traspaso entre cuentas
  - Concepto contiene "BEN MENJAT" o "FRACCIONAMIENTO" → 3.6 Cuotas préstamos Ben Menjat
  - Concepto entrada Uber Eats / Glovo / Just Eat (transferencias plataformas) → 1.1.1 / 1.1.2 / 1.1.3 según patrón
  - Si NO matchea ninguna regla → SIN CATEGORÍA (badge dashed rojo)

- Cuando el usuario asigne manualmente una categoría a un movimiento "sin categoría" desde el modal, **crear regla automática** persistida en tabla `reglas_conciliacion`:
  - `match_pattern`: keyword principal del concepto (ej. "HUIJIA")
  - `categoria_id`: el detalle elegido
  - `creada_por_usuario`: true
- Próximas importaciones aplican esa regla automáticamente

---

### G · TAB RESUMEN DE CONCILIACIÓN

#### FIX 13 · Wrapper tabs consistente Resumen/Movimientos

- En captura, las tabs "Resumen / Movimientos" en la vista Movimientos se ven sin el wrapper blanco con borde
- Asegurar que el bloque tabs tiene SIEMPRE este estilo en ambas vistas:
  ```
  background: #fff;
  border: 0.5px solid #d0c8bc;
  border-radius: 14px;
  padding: 14px 18px;
  display: inline-flex;
  gap: 6px;
  margin-bottom: 14px;
  ```
- El componente debe ser uno solo y reutilizado entre Tab Resumen y Tab Movimientos sin perder estilos al cambiar

---

### H · BD

#### FIX 14 · Confirmar wipe de movimientos

- Tabla `conciliacion` debe estar a 0 registros (ya hecho via SQL externo)
- Verificar que la app no falla con BD vacía
- Mostrar estado vacío en Movimientos: cards con `0 movs · 0,00 €`, tabla vacía con mensaje "No hay movimientos en este periodo. Importa un extracto desde el Importador"
- Mostrar botón "Ir al Importador" → navega a `/importador`

---

## CRITERIOS DE ACEPTACIÓN BATCH FIX 2

1. Sidebar SIN "Cuentas y conexiones" duplicado
2. Tabla categorías SIN texto "banda X-Y %" en nombre de bloque
3. Header Conciliación SIN dropdown "Cuenta · Todas"
4. Subtítulo periodo formato `dd/mm/yy — dd/mm/yy`
5. Card Ingresos solo label + cifra (sin "X movs" ni footer)
6. Card Gastos idem
7. Card Pendientes solo label + badge contador + cifra
8. Card Titular sin texto "filtro activo"
9. Dropdown categoría filtra tabla en tiempo real al seleccionar
10. Anchos de columnas tabla FIJOS (table-layout: fixed)
11. Filas tabla con padding vertical 8px
12. Auto-categorización funcional con las reglas de FIX 12
13. Movs sin match → "sin categoría" + creación de regla al asignar manual
14. Wrapper tabs consistente entre Resumen y Movimientos
15. Estado vacío con botón "Ir al Importador" funcional
16. Build 0 errores tsc + vite
17. Aislamiento Binagre absoluto
18. Deploy Vercel ejecutado

---

## ENTREGABLES

1. Implementación 14 fixes
2. Build limpio
3. Commit + push master
4. Deploy Vercel
5. Informe final con URL deploy + 18 criterios pasados/fallados + decisiones tomadas + archivos modificados

---

## DECISIONES AUTÓNOMAS PERMITIDAS

- Estructura archivos / componentes
- Refactor utilidades cálculo / mapping
- Skeleton loaders durante fetch

NO autónomo:
- Cambios tokens (van a guía Notion antes)
- Cambios estructura BD (preguntar)
- Saltar criterios de aceptación
