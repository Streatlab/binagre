# Spec · Panel Global · Tab Resumen · BATCH FIX 1

> **Modelo:** Sonnet por defecto. Subagentes Sonnet (pm-spec → architect-review → implementer → qa-reviewer → erp-reviewer). NO Opus.
> **Modo:** Localhost + deploy Vercel al final autorizado.
> **Aislamiento Binagre:** NUNCA tocar erp-david.
> **REGLA #1:** Spec literal. NO interpretar, NO improvisar. Si un valor no está aquí, preguntar.
> **Base previa:** `.claude/plans/spec-panel-resumen-v2.md` ya implementado en commit `1a45dc6`. Este spec corrige bugs detectados en QA visual.

---

## 27 FIXES OBLIGATORIOS

### A · DATOS Y LÓGICA

#### FIX 1 · Formato números español

- Formato canónico: `1.000,00 €`
- Separador miles: `.`
- Separador decimales: `,`
- Símbolo `€` al final separado por espacio
- Cifras enteras: `8.916 €` (sin decimales si es entero exacto)
- Cifras con decimales: siempre 2 decimales `1.234,56 €`
- Porcentajes: entero `45%` salvo Prime Cost que también va sin decimales
- Pp: 1 decimal `1,2 pp`
- Ratio: 2 decimales `1,68` (NO `1.68`)
- Helper único: usar/crear `formatearEuros(n)` y `formatearPorcentaje(n)` en `src/lib/format.ts`. Aplicar en TODO el Panel.

#### FIX 2 · Formato fechas español corto

- Formato canónico: `28/04/26` (dd/mm/yy con barras)
- Subtítulo header: `{periodo} · {dd/mm/yy} — {dd/mm/yy}`. Ej: `Mes en curso · 01/04/26 — 28/04/26`
- Fechas en Provisiones, Pagos, Día verde estimado: todas en `dd/mm/yy`
- Helper único: `formatearFechaCorta(date)` en `src/lib/format.ts`

#### FIX 3 · Selector periodo propaga a TODOS los cards/gráficos

- El selector fecha del header debe filtrar en su rango temporal a TODOS los siguientes:
  1. Card Ventas (cifras + 3 barras)
  2. Card Pedidos · TM (cifras + 5 canales)
  3. Card Resultado Periodo (EBITDA + desglose + Prime Cost)
  4. Col Facturación por Canal (5 cards)
  5. Col Grupos de Gasto (4 cards)
  6. Col Días Pico (SVG + resumen)
  7. Card Saldo + Proyección (cobros/pagos del periodo + proyecciones)
  8. Card Ratio Ingresos/Gastos
  9. Card Punto de Equilibrio
  10. Card Provisiones y Próximos Pagos
  11. Card Pendientes de Subir
  12. Card Top Ventas
- Implementación: contexto React `PeriodoContext` envolviendo el Panel. Cada card consume `useContext(PeriodoContext)` y lanza re-fetch al cambiar.
- Persistencia sessionStorage ya existente, no tocar.

#### FIX 4 · Dropdown "Todas las marcas" leer BD

- Cargar marcas reales de tabla `marcas` (Supabase) ordenadas por nombre alfabético
- Items dropdown: "Todas las marcas" (default) + lista marcas activas
- Al seleccionar marca → filtra TODOS los datos del Panel a esa marca
- NO usar mock ni hardcoded list

#### FIX 5 · Cero mock data en Panel

- Eliminar TODO mock data residual
- Cifras 100% de Supabase
- Si BD devuelve vacío para un periodo: mostrar flag visible `datos demo` (badge ámbar fondo `#f5a62320` color `#854F0B` esquina sup-derecha del card)
- NO inventar valores fallback

#### FIX 6 · Bug Ratio Ingresos/Gastos 22,24 ▲ 890%

- Síntoma: ratio mostrado 22,24 con delta +890% del objetivo. Imposible.
- Fórmula correcta: `ratio = netos_reales / gastos_reales` (ambos del periodo seleccionado)
- Validar: si gastos_reales < 100€ o netos_reales > 100x gastos_reales → mostrar `—` con tooltip "Datos insuficientes para calcular ratio"
- Ratio sano esperado: 1,5–2,5
- Revisar query Supabase: probable que esté sumando solo movimientos confirmados ignorando pendientes, o tomando rango temporal mal

#### FIX 7 · Bug Cobros 7d = 0 € con Cobros 30d = 6.010 €

- Síntoma: 0 € en 7d pero 6.010 € en 30d. Inconsistente.
- Fórmula correcta cobros 7d: `SUM(cobros_pendientes WHERE fecha_esperada BETWEEN hoy AND hoy+7d)`
- Mismo patrón cobros 30d con +30d
- Mismo para pagos
- Validar al menos un dato real existe en `cobros_pendientes` y `pagos_pendientes` antes de mostrar 0

#### FIX 8 · Día verde estimado "—"

- En Card PE, el campo "Día verde estimado" muestra "—". Debe calcularse:
- Fórmula: `dia_verde = primer_dia_mes + (pe_bruto / ritmo_diario_actual) días`
- `ritmo_diario_actual = bruto_acumulado_periodo / dias_transcurridos_periodo`
- Si `ritmo_diario_actual <= 0` → mostrar "—" con tooltip "Sin facturación reciente"
- Si `dia_verde > último_dia_mes` → mostrar "❌ no se cubre este mes" en color rojo
- Formato fecha: `dd/mm/yy · {dia_semana_abreviado}`. Ej: `09/05/26 · vie`

#### FIX 9 · Provisiones cifra grande mal calculada

- Síntoma: muestra 22.026 € que parece sumar TODOS los pagos pendientes
- Cifra correcta: SOLO `provision_iva_estimada + provision_irpf_estimada` del mes en curso
- Fórmula:
  - `provision_iva = SUM(ventas_brutas_mes) × 0,21 − SUM(iva_soportado_mes)`
  - `provision_irpf = SUM(facturas_servicios_profesionales_mes) × 0,15`
- Lista pagos próximos 30d aparte (sin sumar a la cifra grande)
- Texto pequeño derecha mantiene desglose: `{prov_iva} € + {prov_irpf} €`

#### FIX 10 · Top Ventas "Sin datos POS"

- Conectar a tabla `pedidos` (o equivalente con productos vendidos)
- Tab Productos: agregación `GROUP BY producto_id ORDER BY SUM(importe) DESC LIMIT 5`
- Tab Modif. (Modificadores): agregación `GROUP BY modificador_id ORDER BY count DESC LIMIT 5`
- Si tabla vacía → mostrar `Sin datos POS` con flag `datos demo` (igual que FIX 5)
- Si tabla tiene <5 items → mostrar los que haya, no rellenar

#### FIX 11 · Badge Pendientes ≠ ítems visibles

- Síntoma: badge dice 7 pero hay 6 ítems en lista
- Fix: contador del badge = `count(items en lista)`. Mismo query, no consulta separada
- Lista debe incluir TODAS las tareas pendientes del periodo (no truncar a top 6 sin avisar)

---

### B · DROPDOWNS HEADER (3 botones: fecha · marcas · canales)

#### FIX 12 · Caracter chevron correcto

- Botones dropdown deben llevar **▾** (flechita pequeña abajo, U+25BE)
- NO usar **▼** (triángulo grande), NO `▽`, NO `↓`, NO punto, NO icono SVG
- Texto literal botón: `Mes en curso ▾` con un espacio entre texto y chevron

#### FIX 13 · Submenú "Semanas X" chevron derecho

- Item "Semanas X" del dropdown lleva **▸** (U+25B8) a la derecha
- Layout: `display:flex; justify-content:space-between; align-items:center`. Texto izquierda, chevron derecha
- Click en este item abre submenú lateral con lista semanas pasadas

#### FIX 14 · Estilo dropdown literal

- Container dropdown abierto:
  - `position:absolute; top:38px; right:0`
  - `background:#fff`
  - `border:0.5px solid #d0c8bc`
  - `border-radius:8px`
  - `width:200px`
  - `font-size:13px`
  - `color:#3a4050`
  - `box-shadow:0 4px 12px rgba(0,0,0,0.06)`
  - `z-index:10`
  - `overflow:hidden`
- Items normales:
  - `padding:8px 12px`
  - `color:#7a8090`
  - hover: `background:#f5f3ef`
- Item ACTIVO (el seleccionado actualmente):
  - `background:#FF475715` (rojo accent con 15 alpha hex)
  - `color:#FF4757`
  - `font-weight:500`
- Botón disparador:
  - `padding:6px 10px`
  - `border-radius:8px`
  - `border:0.5px solid #d0c8bc`
  - `background:#fff`
  - `font-size:13px`
  - `font-family:'Lexend'`
  - `color:#111`

---

### C · TABS RESUMEN

#### FIX 15 · Container tabs literal

- Wrapper exterior:
  - `background:#fff`
  - `border:0.5px solid #d0c8bc`
  - `border-radius:14px`
  - `padding:14px 18px`
  - `margin-bottom:18px`
  - `display:inline-flex`
  - `gap:8px`

#### FIX 16 · Tab activa literal

- `padding:6px 14px`
- `border-radius:6px`
- `border:none`
- `background:#FF4757`
- `color:#fff`
- `font-family:'Lexend'`
- `font-size:13px`
- `font-weight:500`
- Tab activa por defecto: **Resumen**

#### FIX 17 · Tab inactiva literal

- `padding:6px 14px`
- `border-radius:6px`
- `border:0.5px solid #d0c8bc`
- `background:transparent`
- `color:#3a4050`
- `font-family:'Lexend'`
- `font-size:13px`
- `font-weight:500`

#### FIX 18 · Prohibiciones tabs

- NO usar guión amarillo subrayando
- NO usar `#B01D23` en tabs (es color título página)
- Color rojo de tabs SIEMPRE `#FF4757`
- NO usar `#e8f442` ni ningún amarillo
- Tabs en orden literal: **Resumen · Operaciones · Finanzas · Cashflow · Marcas**

---

### D · SIDEBAR

#### FIX 19 · Mover Tareas debajo de Panel Global

- Orden actual probable: TAREAS encima de PANEL GLOBAL
- Orden correcto:
  1. PANEL GLOBAL
  2. TAREAS
  3. FINANZAS
  4. EQUIPO
  5. COCINA
  6. STOCK & COMPRAS
  7. CONFIGURACIÓN
- Mantener mismo estilo visual sidebar `#1e2233`

#### FIX 20 · Eliminar / aclarar "PRÓXIMAMENTE · 61"

- Aparece en captura un item "PRÓXIMAMENTE · 61" en sidebar
- No tiene sentido visible. Eliminar del sidebar
- Si era debug/placeholder: borrar
- Si era una ruta real: mover a configuración o eliminar definitivamente

---

### E · CARDS DESBORDE

#### FIX 21 · Card Controlables corta texto "Banda 13-18%"

- Síntoma: texto banda inferior queda cortado por overflow del card
- Fix: añadir `overflow:visible` al card si tiene `overflow:hidden`. Verificar `padding-bottom` del card de Grupos de Gasto: debe ser ≥ 14px para que la línea inferior `Banda X-Y%` quepa
- Si el card tiene altura fija, cambiar a `min-height` para que se ajuste al contenido
- Aplicar fix a las 4 cards de Grupos de Gasto (Producto, Equipo, Local, Controlables)

---

### F · VERIFICAR FILAS SUPERIORES (no visibles en captura recibida)

#### FIX 22 · Card Ventas — 3 barras editables

- 3 barras: SEMANAL — S{nº} · MENSUAL — {Mes} · ANUAL — {Año}
- Multi-segmento: verde `#1D9E75` (cumplido) + rojo `#E24B4A` (pendiente). NO gris para pendiente
- Altura barra 8px border-radius 4px
- Editable inline en `<span class="editable">{objetivo} €</span>`. Pulsar convierte en input. Enter guarda en `objetivos`. Borrar+enter restaura.
- Toast "Objetivo actualizado" / "Restaurado"

#### FIX 23 · Card Pedidos · TM — layout

- 3 cifras horizontales gap 24px:
  - Pedidos `kpi-big` 38px
  - TM Bruto Oswald 26px 600
  - TM Neto Oswald 26px 600 color `#1D9E75`
- 5 canales lista con barra 5px altura color canal
- Si canal 0 pedidos: span exterior `color:#7a8090`, valores `0 · — / —`, barra width 0%

#### FIX 24 · Card Resultado Periodo — colores y Prime Cost

- EBITDA Oswald 38px 600 verde si >0 / rojo `#E24B4A` si <0
- Mismo color al `%` y al sublabel
- Delta pp: `▲/▼ {pp} pp vs anterior` con color verde/rojo
- Bloque Prime Cost: barra 8px multi-segmento color cumplimiento + resto gris `#ebe8e2`
- Texto inferior: `Banda sector 55-65%` izquierda + `OK / Alto / Bajo` derecha color verde si dentro

#### FIX 25 · Col Facturación por Canal — 3+2 layout

- 3 cards principales en columna gap 10px (Uber/Glovo/JE) con fondos color canal alpha:
  - Uber: `background:#06C16720; border:0.5px solid #06C167; border-radius:14px; padding:12px 14px`
  - Glovo: `background:#e8f44230; border:0.5px solid #e8f442; border-radius:14px; padding:12px 14px`
  - JE: `background:#f5a62320; border:0.5px solid #f5a623; border-radius:14px; padding:12px 14px`
- Layout interior horizontal: izquierda label+bruto, derecha neto+margen
- Bajo las 3 cards: grid 2 cols gap 8px con Web + Directa:
  - Web: `background:#B01D2310; border:0.5px solid #B01D2350; border-radius:14px; padding:10px 12px`
  - Directa: `background:#66aaff20; border:0.5px solid #66aaff; border-radius:14px; padding:10px 12px`

#### FIX 26 · Col Días Pico — colores literales por día

- SVG 480x230 viewBox
- 7 barras color literal exacto:
  - L `#1E5BCC` (azul Emilio)
  - M `#06C167` (verde Uber)
  - X `#f5a623` (ámbar)
  - J `#B01D23` (rojo SL)
  - V `#66aaff` (azul claro)
  - S `#F26B1F` (naranja Rubén)
  - D `#1D9E75` (verde semáforo)
- Cada barra width 40 con x literal (15/80/145/210/275/340/405)
- Altura proporcional al máximo del periodo, base Y=190
- Texto valor encima Y=20 font-size 11. El valor del día más alto: `fill="#3a4050" font-weight="500"`. Resto: `fill="#7a8090"`
- Etiquetas día Y=210 font-size 12 fill `#7a8090`
- Click barra → filtra Panel a ese día semana
- Bloque resumen abajo border-top `0.5px solid #d0c8bc` margin-top 14px padding-top 12px:
  - "Día más fuerte" + nombre + valor (weight 500)
  - "Día más débil" + nombre + valor
  - "Media diaria" + valor

#### FIX 27 · Re-validar TODOS los criterios spec v2

- Re-leer `.claude/plans/spec-panel-resumen-v2.md` y ejecutar los 29 criterios de aceptación uno por uno
- Reportar cuáles pasan y cuáles fallan en informe final

---

## CRITERIOS DE ACEPTACIÓN BATCH FIX

1. Todos los importes con `1.000,00 €` en TODO el Panel
2. Todas las fechas con `dd/mm/yy` en TODO el Panel
3. Selector periodo recalcula los 12 cards listados en FIX 3 al cambiar
4. Dropdown marcas lista marcas reales BD ordenadas alfabéticamente
5. CERO mock data. Si BD vacía → flag `datos demo` ámbar visible
6. Ratio Ingresos/Gastos muestra valor sano (1,5-2,5) o `—` con tooltip
7. Cobros 7d coherente con cobros 30d (queries del mismo dataset)
8. Día verde estimado calculado, con formato `dd/mm/yy · {dow}`
9. Provisiones cifra grande = solo `prov_iva + prov_irpf`
10. Top Ventas con datos reales o flag `datos demo`
11. Badge Pendientes = count(items lista visible)
12. Chevron `▾` en los 3 dropdowns header
13. Chevron `▸` en submenú "Semanas X"
14. Dropdown estilo literal (200px, padding 8px 12px, item activo `#FF475715` + `#FF4757` weight 500)
15. Tabs container literal (padding 14px 18px, gap 8px, border-radius 14px)
16. Tab activa literal (`#FF4757` blanco sin borde)
17. Tab inactiva literal (transparente borde gris claro color `#3a4050`)
18. NO `#B01D23` ni amarillo en tabs
19. Sidebar orden: Panel Global → Tareas → resto
20. Sidebar SIN item "PRÓXIMAMENTE · 61"
21. Cards Grupos Gasto: texto banda inferior visible (no cortado)
22. Card Ventas: 3 barras multi-segmento verde+rojo + editable inline funcional
23. Card Pedidos·TM: 3 cifras + 5 canales con barras 5px color canal
24. Card Resultado: EBITDA color según signo + Prime Cost banda
25. Col Facturación: 3 cards principales fondos alpha + 2 cards Web/Directa grid 2 cols
26. Col Días Pico: 7 colores literales por día + click filtra
27. Re-validados los 29 criterios del spec v2 anterior
28. Build 0 errores tsc + vite
29. Aislamiento Binagre absoluto (NO tocar erp-david)
30. Deploy Vercel ejecutado

---

## ENTREGABLES

1. Implementación de los 27 fixes
2. Helpers `formatearEuros` y `formatearFechaCorta` en `src/lib/format.ts` aplicados consistentemente
3. Build limpio
4. Commit + push master
5. Deploy Vercel `npx vercel --prod`
6. Informe final: URL deploy + 30 criterios pasados/fallados + decisiones tomadas + archivos modificados

---

## DECISIONES AUTÓNOMAS PERMITIDAS

- Estructura archivos/componentes
- Refactor utilidades cálculo
- Skeleton loaders en cards
- Animación width 0.5s ease en barras

NO autónomo:
- Cambios tokens (van a guía Notion antes)
- Cambios estructura BD (preguntar)
- Modificar TabConciliacion (intacto)
- Modificar SelectorFechaUniversal interno (sí debe propagar al PeriodoContext)
- Saltar criterios de aceptación
