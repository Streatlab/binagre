# Spec · Panel Global · Tab Resumen v2

> **Modelo:** Sonnet por defecto. Subagentes Sonnet (pm-spec → architect-review → implementer → qa-reviewer → erp-reviewer). NO Opus.
> **Modo:** Localhost + deploy Vercel al final.
> **Fuente de verdad estilo:** Notion page_id `350c8b1f-6139-8191-952a-f299926ac42f`. NO improvisar tokens.
> **Aislamiento Binagre:** NUNCA tocar erp-david.
> **Mockup referencia:** `panel-general-mockup.html` (subido por Rubén a Notion). Implementar 1:1 estructura, datos reales BD, tokens canónicos.

---

## OBJETIVO

Reescribir Tab **Resumen** del Panel Global (`/finanzas` o ruta del Panel actual) replicando el mockup de referencia, con datos reales de BD, conectado a presupuestos editables, integrado con módulo Tareas pendientes, módulo Importador y módulo PE.

Tab Resumen sustituye actualmente al "General". Renombrar tab interna a **"Resumen"**.

---

## LAYOUT GENERAL · ORDEN VERTICAL

1. **Header** (título + subtítulo periodo + filtros)
2. **Bloque tabs** (Resumen activo · Operaciones · Finanzas · Cashflow · Marcas)
3. **Fila 1 · 3 cards grandes**: Ventas / Pedidos·TM / Resultado Periodo
4. **Fila 2 · 3 columnas**: Facturación por Canal / Grupos de Gasto / Días Pico
5. **Fila 3 · 3 cards medianas**: Saldo+Proyección / Ratio Ingresos·Gastos / Punto de Equilibrio
6. **Fila 4 · 3 cards medianas**: Provisiones / Pendientes de Subir / Top Ventas

---

## HEADER

- Título `PANEL GLOBAL` Oswald 22px 600 letter-spacing 3px color `#B01D23` MAYÚSCULAS
- Subtítulo dinámico debajo Lexend 13px color `#7a8090`. Formato: `<periodo> · <fecha_inicio> — <fecha_fin>` (ej. "Mes en curso · 1 abr — 28 abr 2026")
- Filtros derecha:
  1. SelectorFechaUniversal (componente compartido) — valor por defecto **Mes en curso**
  2. Dropdown "Todas las marcas ▾"
  3. Dropdown "Canales ▾"
- Persistencia sessionStorage ya implementada — no tocar
- Aplicar a **todas** las tabs del módulo

---

## BLOQUE TABS

- 5 tabs orden literal: **Resumen · Operaciones · Finanzas · Cashflow · Marcas**
- Estilo TabConciliacion existente (NO tocar)
- Activa fondo `#FF4757`, inactiva borde `0.5px solid #d0c8bc`
- Container del bloque tabs con fondo blanco border `0.5px solid #d0c8bc` border-radius 14px padding 14px 18px (como mockup)

---

## FILA 1 · 3 CARDS GRANDES (grid 3 cols, gap 14px)

### Card 1 · VENTAS

- Sublabel `VENTAS` Oswald 12px 500 letter-spacing 2px color `#7a8090`
- Bloque cifras horizontal:
  1. Bruto: número Oswald 38px 600 color `#111` + sublabel `BRUTO`
  2. Neto estimado: número Oswald 24px 600 color `#1D9E75` + sublabel `NETO ESTIMADO · X%` (X = neto/bruto)
- Delta vs anterior Lexend 12px (verde si ▲, rojo si ▼)
- 3 barras cumplimiento:
  1. **SEMANAL — S{nº}** · % cumplido · "Faltan X € de Y €" (Y editable inline)
  2. **MENSUAL — {Mes}** · idem
  3. **ANUAL — {Año}** · idem
- Barras altura 8px multi-segmento verde (cumplido) + rojo (pendiente). NO usar gris para pendiente
- Color del % en label según semáforo: ≥80% verde, 50-79% ámbar, <50% rojo
- Editable inline: pulsar el valor, editar, enter guarda en BD `objetivos`. Si se borra y enter, restaurar valor original
- Toast feedback "Objetivo actualizado" / "Restaurado"

### Card 2 · PEDIDOS · TM

- Sublabel `PEDIDOS · TM`
- Bloque cifras horizontal:
  1. Pedidos: Oswald 38px 600 + sublabel `PEDIDOS`
  2. TM Bruto: Oswald 26px 600 + sublabel `TM BRUTO`
  3. TM Neto: Oswald 26px 600 color `#1D9E75` + sublabel `TM NETO`
- Delta combinado: "▼ X% pedidos · ▼ Y% TM vs anterior"
- Lista 5 canales con barra horizontal:
  - Layout cada fila: `● Canal | Pedidos · TMbruto / TMneto | barra colour-canal`
  - Pedidos en bold weight 500
  - TM neto en color `#1D9E75`
  - % barra = pedidos_canal / pedidos_total
  - Barra altura 5px border-radius 3px fondo `#ebe8e2` fill color canal
  - Si 0 pedidos: barra vacía + valores `—`
- Colores canal: Uber `#06C167` · Glovo `#e8f442` · Just Eat `#f5a623` · Web `#B01D23` · Directa `#66aaff`

### Card 3 · RESULTADO PERIODO

- Sublabel `RESULTADO PERIODO`
- Bloque cifras horizontal:
  1. EBITDA €: Oswald 38px 600 color verde si >0 / rojo si <0 + sublabel `EBITDA`
  2. EBITDA %: Oswald 24px 600 mismo color + sublabel `% S/NETOS · BANDA 10-13%`
- Delta vs anterior en pp (puntos porcentuales): "▲ X,X pp vs anterior"
- Bloque desglose con border-top:
  1. Netos estimados (de cards canal estimados)
  2. Netos reales factura (de tabla resúmenes plataforma subidos)
  3. Total gastos periodo (de Conciliación)
  4. Resultado limpio (netos reales − gastos) en bold color verde si >0
- Bloque PRIME COST con border-top:
  - Sublabel `PRIME COST` + % a la derecha (color semáforo según banda)
  - Barra altura 8px multi-segmento color semáforo + resto gris
  - Subtexto: "Banda sector 55-65%" + estado OK/Alto/Bajo
  - Fórmula: (COGS + Labor) / Netos
  - Banda OK: 55-65%. <55% bajo (verde). >65% alto (rojo)

---

## FILA 2 · 3 COLUMNAS (grid 3 cols, gap 14px)

### Col 1 · FACTURACIÓN POR CANAL

- Header columna: label `FACTURACIÓN POR CANAL` Oswald 12px 500 letter-spacing 2px MAYÚSCULAS color `#7a8090`
- 3 cards principales (Uber / Glovo / Just Eat) layout horizontal:
  - Background: color canal con alpha 12-20% (`#06C16720`, `#e8f44230`, `#f5a62320`)
  - Border 0.5px solid color canal (Glovo `#e8f442`, JE `#f5a623`, Uber `#06C167`)
  - Border-radius 14px padding 12px 14px
  - Izquierda: `LABEL CANAL` (Oswald 10px 500 letter-spacing 1.5px color dark-canal) + cifra bruta Oswald 18px 600 + texto "bruto" 10px
  - Derecha: cifra neta Oswald 15px 600 color `#1D9E75` + "neto · X% margen" 10px
  - Color dark-canal: Uber `#0F6E56` · Glovo `#3a3a00` (texto sobre amarillo) · JE `#854F0B`
- 2 cards pequeñas inferiores grid 1fr 1fr (Web / Directa):
  - Mismo patrón colores: Web `#B01D2310` border `#B01D2350` color dark `#791F1F`. Directa `#66aaff20` border `#66aaff` color dark `#185FA5`
  - Si 0 datos: cifra `— €` + texto "sin datos" gris
- Cálculo neto por canal: tabla `canales` campos `comision_pct`, `comision_fija`. Fórmula: `bruto − (bruto*comision_pct) − comision_fija − IVA(21%)*(bruto*comision_pct + comision_fija)`. ADS NO resta
- % margen = neto / bruto * 100

### Col 2 · GRUPOS DE GASTO · CONSUMO vs PRESUPUESTO

- Header columna: label `GRUPOS DE GASTO · CONSUMO vs PRESUPUESTO`
- 4 cards apiladas (Producto · Equipo · Local · Controlables) padding 12px 14px:
  - Header card: sublabel grupo + a la derecha "% s/netos X%" (color semáforo según banda) o "food cost X%" para Producto
  - Cifra: gasto Oswald 18px 600 + " / presupuesto" Lexend 12px (presupuesto editable inline)
  - Derecha: % cumplimiento Oswald 12px color semáforo
  - Barra 6px multi-segmento verde + rojo
  - Footer: "Banda X-Y%" izquierda + desviación €/€ derecha (color verde si bajo presupuesto, rojo si por encima)
- Bandas:
  - Producto/COGS: 25-30% (food cost sobre netos)
  - Equipo/Labor: 30-35% s/netos
  - Local/Occupancy: 5-10% s/netos
  - Controlables/OPEX: 13-18% s/netos
- Presupuesto editable inline guarda en `presupuestos_grupos_gasto`
- Plataformas NO va aquí (es coste variable, no grupo gasto fijo). Solo 4 grupos en esta columna.

### Col 3 · DÍAS PICO — MES ACTUAL

- Header columna: label `DÍAS PICO — MES ACTUAL`
- 1 card grande wrap padding 18px:
  - SVG bar chart 7 días (L M X J V S D) datos reales `facturacion_diaria` agregados por día semana del periodo seleccionado
  - Cada barra color distinto: L `#1E5BCC` · M `#06C167` · X `#f5a623` · J `#B01D23` · V `#66aaff` · S `#F26B1F` · D `#1D9E75`
  - Valor numérico encima de cada barra Lexend 11px (si máximo, weight 500)
  - Día abreviado debajo Lexend 12px color `#7a8090`
  - Click día filtra el Panel a ese día semana
  - Bloque resumen abajo con border-top:
    - "Día más fuerte" + nombre + valor (weight 500)
    - "Día más débil" + nombre + valor
    - "Media diaria" + valor

---

## FILA 3 · 3 CARDS MEDIANAS (grid 3 cols, gap 14px)

### Card · SALDO + PROYECCIÓN

- Sublabel `SALDO + PROYECCIÓN`
- Cifra: caja líquida hoy Oswald 24px 600 + "caja líquida hoy" 11px
- Border-top después
- Líneas:
  - Cobros 7d: verde "+X €"
  - Pagos 7d: rojo "-X €"
  - **Proyección 7d** (bold weight 500): saldo + cobros − pagos
  - Cobros 30d: verde
  - Pagos 30d: rojo
  - **Proyección 30d** (bold)
- Indicador visual barra 6px verde con 2 puntos (hoy izquierda · 30d derecha):
  - Punto izquierda color `#1D9E75`
  - Punto derecha color `#0F6E56` (más oscuro)
  - Labels debajo "Hoy" / "30d"
- Datos de tabla `cobros_pendientes`, `pagos_pendientes`, `movimientos_bancarios`

### Card · RATIO INGRESOS / GASTOS

- Sublabel `RATIO INGRESOS / GASTOS` + a la derecha "obj X,XX" (objetivo editable inline)
- Cifra ratio Oswald 38px 600 color verde si >objetivo / ámbar si entre 80-100% del obj / rojo si <80%
- Texto delta: "▼ X% del objetivo" o "▲ X% sobre objetivo"
- Bloque comparativa estimado vs real:
  - Netos estimados / Netos reales factura
  - Gastos fijos (presupuesto sumado 4 grupos) / Gastos reales (Conciliación)
- Border-top después con label "Distancia al objetivo":
  - Barra 8px multi-segmento (cumplido% color semáforo + pendiente% rojo)
  - Texto "X% del Y obj" alineado derecha
- Ratio = netos / gastos. Objetivo editable guarda en `objetivos.ratio_ingresos_gastos`

### Card · PUNTO DE EQUILIBRIO

- Sublabel `PUNTO DE EQUILIBRIO`
- Layout horizontal:
  - Izquierda: cifra bruto necesario Oswald 22px 600 + subtexto "bruto necesario · X € netos"
  - Derecha: % progreso Oswald 18px 600 color semáforo
- Barra 8px multi-segmento (progreso% color semáforo + falta% rojo)
- Subtexto barra: "Llevamos X €" / "Faltan Y €"
- Border-top después:
  - "Día verde estimado" + fecha · día_semana (proyección lineal según ritmo actual)
  - "Facturación / día" + bruto requerido
  - "Pedidos / día" + nº a TM_actual
  - "Real actual" + €/día · pedidos/día (color gris)
- Lógica PE: gastos_fijos_mes / margen_promedio_pedido. Reutilizar utilidades del módulo PE existente

---

## FILA 4 · 3 CARDS MEDIANAS (grid 3 cols, gap 14px)

### Card · PROVISIONES Y PRÓXIMOS PAGOS

- Sublabel `PROVISIONES Y PRÓXIMOS PAGOS`
- Header: cifra "a guardar este mes" Oswald 24px 600 + subtexto + a la derecha desglose pequeño "X € + Y €" (IVA + IRPF)
- Lista 6-N líneas pagos:
  - Label izquierda gris (concepto + fecha)
  - Importe derecha
  - Ordenados por fecha ascendente
- Datos de tabla `pagos_pendientes` filtrados próximos 30d + provisiones IVA/IRPF (existente módulo PE)

### Card · PENDIENTES DE SUBIR

- Border-left 3px solid `#E24B4A`
- Header: sublabel `PENDIENTES DE SUBIR` + badge contador derecha (background `#E24B4A` color blanco)
- Lista tareas pendientes/atrasadas (de tabla `tareas_pendientes`):
  - Punto color: rojo si atrasada · ámbar si hoy · gris si futura
  - Concepto izquierda
  - Status derecha gris ("atrasado Xd" · "hoy" · "en Xd")
- Botón abajo full-width fondo `#FF4757` color blanco "Ir al Importador →" → ruta `/importador`

### Card · TOP VENTAS

- Header: sublabel `TOP VENTAS` + a la derecha 2 mini-tabs (Productos activo `#FF4757` blanco / Modif. inactivo borde `0.5px solid #d0c8bc`)
- Tabla 5 filas:
  - Col 1: ranking gris
  - Col 2: nombre producto
  - Col 3: badge canal (10px Oswald letter-spacing 0.5px padding 1px 5px border-radius 3px). Glovo texto `#3a3a00`, resto blanco
  - Col 4: pedidos
  - Col 5: importe Oswald weight 500
- Datos de pedidos del periodo agrupados por producto/modificador

---

## CRITERIOS DE ACEPTACIÓN

1. Layout idéntico al mockup `panel-general-mockup.html`
2. Tokens canónicos guía Notion · NO hex hardcoded fuera del mockup de referencia
3. Tipografías Oswald (cifras + labels) + Lexend (texto) — NUNCA mezclar otras
4. Datos REALES BD · NO mock data
5. SelectorFechaUniversal aplicado y propagado a TODOS los gráficos/cards/tablas del Panel
6. Persistencia sessionStorage funcionando (ya existente)
7. Inline edit funcional en: objetivos venta semanal/mensual/anual · presupuesto 4 grupos gasto · objetivo ratio
8. Toast feedback en cada edit (actualizado/restaurado)
9. Borrar + enter en inline edit restaura valor original
10. Click día en chart Días Pico filtra Panel a ese día semana
11. Botón "Ir al Importador" navega a `/importador`
12. Card Pendientes de Subir lee de tabla `tareas_pendientes` BD
13. Card Provisiones lee de `pagos_pendientes` + provisiones existentes
14. Cálculo neto canal con fórmula explícita (ADS NO resta)
15. Cálculo Prime Cost = (COGS+Labor)/Netos
16. Cálculo PE reutiliza módulo PE existente
17. Top Ventas tabs Productos/Modificadores cambia datasource
18. Mobile-friendly: grid 3 cols → 2 cols tablet → 1 col mobile. Touch targets 44px
19. Build 0 errores tsc + vite
20. Aislamiento Binagre absoluto · NO tocar erp-david
21. Deploy Vercel al final tras `git push origin master`

---

## ENTREGABLES

1. Implementación Tab Resumen Panel Global completa
2. Componentes nuevos extraídos (CardVentas, CardPedidosTM, CardResultadoPeriodo, ColumnaFacturacionCanal, ColumnaGruposGasto, ColumnaDiasPico, CardSaldoProyeccion, CardRatio, CardPE, CardProvisiones, CardPendientesSubir, CardTopVentas) si aplica
3. Build limpio
4. Commit + push master
5. Deploy Vercel `npx vercel --prod`
6. Informe final con URL deploy + validaciones pasadas + decisiones tomadas

---

## DECISIONES AUTÓNOMAS PERMITIDAS

- Estructura de archivos/componentes
- Refactor de utilidades de cálculo (neto, PE, prime cost)
- Mock data como fallback si BD vacía (con flag visible "datos demo")
- Skeleton loaders en cards mientras carga BD
- Animación barras (transition width 0.5s ease ya en guía)

NO autónomo:
- Cambios de tokens (van a guía Notion antes)
- Cambios estructura BD (preguntar)
- Modificar TabConciliacion (intacto)
