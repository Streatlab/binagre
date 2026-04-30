# SPEC FIXES RONDA 3 — Panel Resumen — 50 fixes literales

> Tras deploy Vercel ronda 2, validación visual detecta 50 fallos.
> Lista numerada del FIX 1 al FIX 50.
> Code ejecuta uno tras otro SIN PARAR.
> Si un fix falla, marcar ❌ con motivo y CONTINUAR con el siguiente.

---

## Reglas globales

1. Modelo: `claude-sonnet-4-7` general, Haiku triviales, NO Opus
2. Pipeline: pm-spec → architect-review → implementer → qa-reviewer → erp-reviewer
3. Modo: localhost + Vercel SIEMPRE al cierre con URL
4. Commit cada 10 fixes
5. Aislamiento absoluto Binagre vs David
6. **Conciliación se está editando en otro chat — NO TOCAR módulo Conciliación bajo ninguna circunstancia, ni archivos en `/src/components/conciliacion/*`, ni tablas Supabase relacionadas con conciliación**

---

# LISTA 50 FIXES

## FIX 1 · Vista por defecto Abril 2026
Archivo: `/src/components/panel/resumen/TabResumen.tsx`
Cambiar la inicialización del periodo. El dropdown "Mes en curso" debe arrancar mostrando rango `01/04/26 — 30/04/26` independientemente de la fecha del sistema.
Buscar el `useState` que define `mesActual`/`mesEnCurso` por defecto. Sustituir por valor fijo `mes: 4, año: 2026`.

## FIX 2 · Decimales Card Facturación cifra Bruto
Archivo: `/src/components/panel/resumen/CardVentas.tsx`
Cifra Bruto pasar de "9.818" a "9.818,00". Aplicar `fmtEur(bruto, { showEuro: false, decimals: 2 })`.

## FIX 3 · Decimales Card Facturación cifra Neto
Mismo archivo. Cifra Neto Estimado de "6.397" a "6.397,00". Aplicar `fmtEur(neto, { showEuro: false, decimals: 2 })`.

## FIX 4 · Card Facturación margen 2 decimales
Mismo archivo. "65,0%" pasar a "65,00%". Aplicar `fmtPct(margenPct, 2)`.

## FIX 5 · Card Facturación etiqueta mes capitalizada
Mismo archivo. La etiqueta línea mensual muestra "ABRIL". Cambiar a "Abril" usando `fmtMes(mes)`.
Verificar que no se aplica `textTransform: 'uppercase'` en el style del `<span>` que renderiza el nombre del mes. Si se aplica, eliminar esa propiedad.

## FIX 6 · Card Facturación cantidad semanal con separador miles
Mismo archivo. Valor "5000,00" del input editable de la línea semanal debe mostrarse como "5.000,00".
Verificar que `EditableInline.tsx` renderiza con `toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` que ya añade separador de miles. Si no lo hace, corregir el render del componente para que SIEMPRE use `fmtNum`.

## FIX 7 · Card Facturación cifras "Faltan" decimales y miles
Mismo archivo. Las 3 líneas "Faltan 4.098", "Faltan 10.182", "Faltan 193.253" deben mostrarse "Faltan 4.098,00", "Faltan 10.182,00", "Faltan 193.253,00". Aplicar `fmtEur(falta, { showEuro: false, decimals: 2 })`.

## FIX 8 · Card Pedidos·TM color barra Just Eat
Archivo: `/src/components/panel/resumen/CardPedidosTM.tsx`
La barra mini del canal "Just Eat" en el desglose actualmente NO está en color naranja Just Eat. Forzar `background: '#f5a623'` para canal `just_eat`.
Verificar el mapeo `COLOR_CANAL` y asegurar que tanto `just_eat` (con guión bajo) como `Just Eat` (con espacio) hacen match correcto. Normalizar la clave del canal antes de buscar el color.

## FIX 9 · Card Pedidos·TM Web/Directa con color cuando 0
Mismo archivo. Cuando Web o Directa tienen 0 pedidos, las cifras del desglose deben mantener el color del canal aún:
- Pedidos en azul `#1E5BCC`
- TM Bruto en naranja `#F26B1F`
- TM Neto en verde `#1D9E75`

Eliminar lógica que las muta a gris cuando son 0.

## FIX 10 · Card Resultado coherencia EBITDA vs cascada
Archivo: `/src/components/panel/resumen/CardResultadoPeriodo.tsx`
Si la tabla `running` está vacía o `running.ebitda` es `null`, la cifra EBITDA grande también debe mostrar "Datos insuficientes" (no `255,72 €`).
Lectura: si `running === null` o `running.ebitda === null` → mostrar "Datos insuficientes" en TODOS los campos incluyendo cifra grande EBITDA y línea "% s/netos".
PROHIBIDO mostrar EBITDA con cifra real cuando el resto de la cascada dice "Datos insuficientes".

## FIX 11 · Card Resultado etiqueta sublabel EBITDA
Mismo archivo. La etiqueta sublabel bajo la cifra EBITDA actualmente muestra "% S/NETOS". Mantener el texto pero verificar que el wording exacto sea "% s/netos · Banda 10-13%" (Banda con B mayúscula, "s/netos" en minúsculas). Si actualmente muestra todo en mayúsculas, ajustar `textTransform`.

## FIX 12 · Card Glovo border visible
Archivo: `/src/components/panel/resumen/ColFacturacionCanal.tsx`
La card Glovo NO muestra el border `1px solid #5a5500` visible.
Forzar el border con inline style en el JSX directo:
```tsx
style={{ border: '1px solid #5a5500', ...otrosEstilos }}
```
Si el style se sobreescribe por un className: usar `!important` o subir la especificidad. Verificar en el navegador que el border es visible.

## FIX 13 · Card Días Pico título mes capitalizado
Archivo: `/src/components/panel/resumen/ColDiasPico.tsx`
Título actual "DÍAS PICO — ABRIL - Facturación Bruta". Cambiar a "DÍAS PICO — Abril - Facturación Bruta".
Usar `fmtMes(mes)` que ya capitaliza correctamente. Verificar que no hay `textTransform: 'uppercase'` aplicado al texto del mes específicamente.

## FIX 14 · Card Días Pico valores con separador miles
Mismo archivo. Los valores encima de las barras se ven como "1111,49 / 1317,81 / 819,33 / 1368,44 / 1705,01 / 1327,35 / 2168,41".
Deben tener separador de miles → "1.111,49 / 1.317,81 / 819,33 / 1.368,44 / 1.705,01 / 1.327,35 / 2.168,41".
Aplicar `fmtNum(valor, 2)` que ya genera ese formato con `toLocaleString('es-ES', ...)`.
PROHIBIDO usar `valor.toFixed(2)` que NO añade separador de miles.

## FIX 15 · Card Días Pico línea media con separador miles
Mismo archivo. Texto "Media: 1402,55" debe ser "Media: 1.402,55". Aplicar `fmtNum(mediaSemanal, 2)`.

## FIX 16 · Card Días Pico bloque inferior con separador miles
Mismo archivo. Los 3 valores del bloque inferior deben usar `fmtNum(valor, 2)`:
- "Domingo · 2168,41" → "Domingo · 2.168,41"
- "Miércoles · 819,33" → "Miércoles · 819,33"
- "1402,55" media diaria → "1.402,55"

## FIX 17 · Card Ratio "Objetivo" en verde
Archivo: `/src/components/panel/resumen/CardRatio.tsx`
La palabra "Objetivo" arriba derecha de la card NO está en verde. Aplicar `style={{ color: '#1D9E75' }}` literal en el `<span>` que contiene el texto "Objetivo".

## FIX 18 · Card Ratio "Ingresos netos" sin €
Mismo archivo. Línea "Ingresos netos 6.397 €" debe ser "Ingresos netos 6.397,00". Aplicar `fmtEur(ingresosNetos, { showEuro: false, decimals: 2 })`.

## FIX 19 · Card Ratio "Gastos fijos" sin €
Mismo archivo. Línea "Gastos fijos 4.553 €" debe ser "Gastos fijos 4.553,00". Aplicar `fmtEur(gastosFijos, { showEuro: false, decimals: 2 })`.

## FIX 20 · Card Ratio "Gastos reales" sin €
Mismo archivo. Línea "Gastos reales 0 €" debe ser "Gastos reales 0,00". Aplicar `fmtEur(gastosVariables, { showEuro: false, decimals: 2 })`.

## FIX 21 · Card Punto Equilibrio "Llevamos" con decimales y miles
Archivo: `/src/components/panel/resumen/CardPE.tsx`
Línea "Llevamos 9.818" pasar a "Llevamos 9.818,00". Aplicar `fmtEur(facturadoActual, { showEuro: false, decimals: 2 })`.

## FIX 22 · Card Punto Equilibrio "Faltan" con decimales
Mismo archivo. Línea "Faltan 0" pasar a "Faltan 0,00". Aplicar `fmtEur(faltan, { showEuro: false, decimals: 2 })`.

## FIX 23 · Card Punto Equilibrio "Realidad hoy" con pedidos día
Mismo archivo. Línea "Realidad hoy 327/día" debe mostrar también pedidos día.
Formato literal: `Realidad hoy 327,00 €/día · {pedidosDiaActual} ped/día`.
Cálculo `pedidosDiaActual = pedidosTotalMes / diaActualMes`.
Aplicar `fmtEur(facturacionDiaActual, { showEuro: true, decimals: 2 })` y `fmtNum(pedidosDiaActual, 0)`.

## FIX 24 · Card Punto Equilibrio formato facturación día
Mismo archivo. Asegurar que la cifra de facturación día tiene 2 decimales y separador miles correctamente: "327,00 €/día" o "1.234,56 €/día" si supera 1000.
Aplicar `fmtEur(facturacionDiaActual, { showEuro: true, decimals: 2 })`.

## FIX 25 · Card Provisiones cifras pagos sin €
Archivo: `/src/components/panel/resumen/CardProvisiones.tsx`
Las 5 líneas de pagos próximos muestran "162 € / 850 € / 348 € / 139 € / 71 €". Pasar a "162,00 / 850,00 / 348,00 / 139,00 / 71,00" (sin € y con 2 decimales). Aplicar `fmtEur(p.importe, { showEuro: false, decimals: 2 })`.

## FIX 26 · Card Provisiones cifra grande sin €
Mismo archivo. La cifra grande "162 €" arriba de la card debe ser "162,00" sin €. Aplicar `fmtEur(totalProvisiones, { showEuro: false, decimals: 2 })`.

## FIX 27 · Card Top Ventas eliminar badge "datos demo"
Archivo: `/src/components/panel/resumen/CardTopVentas.tsx`
El badge amarillo "datos demo" en la esquina superior derecha de la card debe eliminarse completamente. Buscar el JSX que renderiza el texto "datos demo" y quitarlo. Mantener los botones "Productos / Modif." y el texto "Sin datos POS".

## FIX 28 · Layout fila inferior — Top Ventas centro
Archivo: `/src/components/panel/resumen/TabResumen.tsx`
La fila inferior actualmente tiene `gridTemplateColumns: '1fr 2fr'` (Provisiones 1/3 + Top Ventas 2/3).
Cambiar a `gridTemplateColumns: '1fr 1fr 1fr'` con 3 columnas iguales:
- Columna 1: `<CardProvisiones />`
- Columna 2: `<CardTopVentas />`
- Columna 3: vacía (o `<div />`)

Top Ventas ocupa solo el tercio CENTRAL.

## FIX 29 · Verificar formato `fmtNum` no usa toFixed
Archivo: `/src/lib/format.ts`
Auditar que `fmtNum`, `fmtEur` y `fmtPct` usan `toLocaleString('es-ES', ...)` y NO `toFixed`. Si alguna helper usa `toFixed`, sustituir por `toLocaleString`. Esto garantiza separador de miles automático.

## FIX 30 · Eliminar bloque "PROYECCIÓN NETA" de Card Saldo si no estaba en spec
Archivo: `/src/components/panel/resumen/CardSaldo.tsx`
La captura muestra un bloque "PROYECCIÓN NETA" con líneas "Proyección 7d / Proyección 30d Datos insuficientes". Esto NO estaba en el spec original.
Verificar si añade valor:
- Si añade valor: mantener pero asegurar formato consistente con resto de la card.
- Si NO añade valor: eliminar para limpiar la card.
Decisión: ELIMINAR. La card ya muestra Cobros 7d/30d y Pagos 7d/30d arriba; "Proyección" duplicaba esa información sin valor adicional.

## FIX 31 · Card Pedidos·TM Decimales pedidos canales
Archivo: `/src/components/panel/resumen/CardPedidosTM.tsx`
En el desglose canal, los pedidos "288 / 91 / 26" están sin decimales (correcto, son pedidos enteros). Verificar que se aplica `fmtNum(pedidos, 0)` (no fmtEur).

## FIX 32 · Card Pedidos·TM TM con € en desglose
Mismo archivo. En el desglose canal "288 · 22,71 / 14,46" → debería ser "288 · 22,71 € / 14,46 €" CON símbolo €. Spec original (FIX 24-25 ronda 2) exigía `fmtEur(tm, { showEuro: true, decimals: 2 })`. Verificar y corregir.

## FIX 33 · Card Punto Equilibrio % pasado de 100
Archivo: `/src/components/panel/resumen/CardPE.tsx`
Cuando facturado real supera el bruto necesario, el % debe mostrar el valor real, no truncar a 100%.
Si `pct > 100`: mostrar "{pct,2}%" sin truncar (ej. "140,52%").
La barra `<BarraCumplimiento pct={pct} />` ya trunca visualmente al 100% por dentro, pero el texto del % debe ser real.

## FIX 34 · Card Saldo cifra grande con €
Archivo: `/src/components/panel/resumen/CardSaldo.tsx`
Cuando la tabla `cuentas_bancarias` está vacía, el saldo grande muestra "—". Mantener "—" cuando vacío. Cuando hay datos, mostrar `fmtEur(saldoTotal, { showEuro: true, decimals: 2 })` con € y 2 decimales.

## FIX 35 · Card Punto Equilibrio Líneas Pedidos día/TM con decimales
Mismo archivo. La línea "Pedidos día / TM" muestra "21 / 24,24". Verificar:
- Pedidos: `fmtNum(pedidosDiaNecesarios, 0)` → "21" (entero)
- TM: `fmtEur(tm, { showEuro: false, decimals: 2 })` → "24,24"

OK ahora. Pero verificar que sigue mostrando 2 decimales si TM cambia a "24,2" o "24" sin decimales. Forzar 2 decimales siempre.

## FIX 36 · Card Pedidos·TM cifras Pedidos sin decimales
Archivo: `/src/components/panel/resumen/CardPedidosTM.tsx`
La cifra grande "405" pedidos NO debe tener decimales (es número de pedidos enteros). Aplicar `fmtNum(pedidos, 0)`.
Verificar también que las cifras canal "288, 91, 26" se mantengan sin decimales.

## FIX 37 · Limpieza global hardcodes formato
Auditar TODO el código de `/src/components/panel/resumen/*.tsx` y buscar:
- `.toFixed(` → sustituir por `fmtNum`/`fmtEur`/`fmtPct`
- `Math.round(` con renderizado de número → revisar si pierde decimales
- Cifras hardcoded sin formato

Lista de todas las ocurrencias encontradas y sustituidas en informe.

## FIX 38 · Card Resultado Prime Cost decimales
Archivo: `/src/components/panel/resumen/CardResultadoPeriodo.tsx`
La cifra "77%" del Prime Cost debe mostrar 2 decimales: "77,00%". Aplicar `fmtPct(primeCostPct, 2)`.

## FIX 39 · Card Resultado Prime Cost objetivo formato
Mismo archivo. "Objetivo 60 %" debe ser "Objetivo 60%" (sin espacio entre número y %) o "Objetivo 60,00%" si la convención es 2 decimales.
Decisión: "Objetivo 60%" (sin decimales para el target porque es entero, sin espacio).
Revisar `EditableInline` con `unidad="%"` para que renderice sin espacio: cambiar `${valor} %` a `${valor}%`.

## FIX 40 · Card Pedidos·TM delta pedidos formato
Mismo archivo. "▲ 2,0% pedidos · ▼ 6,6% TM vs anterior" → mantener formato pero verificar que aplica `fmtPct(delta, 1)` con 1 decimal (porque deltas suelen ser muy pequeños y 2 decimales abruman).
Si convención del Panel es 2 decimales en todo: aplicar `fmtPct(delta, 2)` → "▲ 2,00% pedidos".
Decisión: 1 decimal en deltas.

## FIX 41 · Card Resultado delta EBITDA formato
Archivo: `/src/components/panel/resumen/CardResultadoPeriodo.tsx`
"▼ 0,5 puntos porcentuales vs anterior" mantener 1 decimal. Aplicar `fmtNum(Math.abs(deltaPp), 1)`.

## FIX 42 · Card Facturación delta vs anterior
Archivo: `/src/components/panel/resumen/CardVentas.tsx`
"▼ 4,8% vs anterior" mantener 1 decimal. Aplicar `fmtPct(Math.abs(delta), 1)`.

## FIX 43 · Card Pedidos·TM "vs anterior" texto literal
Archivo: `/src/components/panel/resumen/CardPedidosTM.tsx`
Línea "▲ 2,0% pedidos · ▼ 6,6% TM vs anterior". Verificar que el texto exacto incluye "vs anterior" (no "vs mes anterior" ni otro). Mantener literal.

## FIX 44 · Refrescar tras edit inline objetivos
Archivo: `/src/components/ui/EditableInline.tsx`
Al guardar un valor editable, la card debe re-renderizar con el nuevo valor sin recargar página completa. Verificar que `onUpdate` callback dispara un `refetch` o `revalidate` de los datos del componente padre.
Si no se re-renderiza, propagar `onUpdate` desde TabResumen hasta cada card y re-llamar la query Supabase tras update.

## FIX 45 · Toast confirmación visible
Archivo: `/src/components/ui/EditableInline.tsx`
Verificar que `toast.success`, `toast.warning`, `toast.error` muestran notificación visible al usuario tras guardar. Si la librería `sonner` no está integrada, instalarla y añadir `<Toaster />` en `App.tsx` o `Layout.tsx`.

## FIX 46 · Lectura `objetivos` correcta por filtros
Archivo: `/src/components/panel/resumen/CardVentas.tsx`
Verificar que las 3 líneas (semanal/mensual/anual) leen correctamente:
- Semanal: `tipo='semanal' AND año=X AND semana=Y`
- Mensual: `tipo='mensual' AND año=X AND mes=Z`
- Anual: `tipo='anual' AND año=X`

Si tabla `objetivos` no tiene fila para alguno: mostrar valor 0 (no error).

## FIX 47 · Mobile validación 375
Verificar Panel completo en viewport 375px (mobile). Capturas en `.claude/tracking/mobile-validation/ronda3/375.png`. Las cards deben apilarse en 1 columna, las cifras deben ser legibles, los dropdowns deben funcionar.

## FIX 48 · Mobile validación 768
Verificar Panel completo en viewport 768px (tablet). Capturas en `.claude/tracking/mobile-validation/ronda3/768.png`. Layout 2 columnas, cards proporcionales.

## FIX 49 · Mobile validación 1280
Verificar Panel completo en viewport 1280px (desktop standard). Capturas en `.claude/tracking/mobile-validation/ronda3/1280.png`. Layout 3 columnas, todo legible.

## FIX 50 · Deploy Vercel + URL
Tras completar los 49 fixes anteriores:
1. Build local OK
2. Tests OK (si existen)
3. Commit final + push master
4. Deploy Vercel automático
5. URL del deploy en `.claude/tracking/informe-fixes-panel-ronda3.md` con checklist 50/50.

---

# CHECKLIST FINAL

Code rellena `.claude/tracking/informe-fixes-panel-ronda3.md`:

```
FIX 1  · ✅/❌ · {motivo si ❌}
FIX 2  · ✅/❌ · {motivo si ❌}
...
FIX 50 · ✅/❌ · {motivo si ❌}

TOTAL: X/50 ✅
URL Vercel: https://...
```

PROHIBIDO marcar ✅ sin verificación visual en localhost o Vercel.

---

# RESTRICCIONES

1. NO TOCAR `/src/components/conciliacion/*` ni nada relacionado con Conciliación
2. NO TOCAR tablas Supabase usadas por Conciliación
3. NO crear nuevos archivos de configuración global salvo helpers ya existentes
4. NO cambiar tokens/diseño global (`/src/styles/tokens.ts`) sin avisar
5. NO modificar las tablas Supabase populadas por otros chats — solo leer

---

# ORDEN

Ejecutar FIX 1 → FIX 2 → ... → FIX 50.
Commit cada 10 fixes.
Tras FIX 50: deploy Vercel + informe.
NO PARAR ENTRE FIXES.
