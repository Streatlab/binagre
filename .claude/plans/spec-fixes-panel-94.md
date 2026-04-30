# SPEC FIXES — Panel Resumen — 94 fixes literales uno a uno

> Lista de 94 fixes numerados. Code ejecuta uno tras otro SIN PARAR.
> Cada fix tiene: archivo + qué hacer + valor literal.
> Code marca cada fix como ✅ HECHO en el informe final.
> Si Code no encuentra cómo hacer un fix concreto: lo marca ❌ con motivo y CONTINÚA con el siguiente.

---

## Reglas globales

- Modelo: `claude-sonnet-4-7` general, Haiku triviales, NO Opus
- Pipeline: pm-spec → architect-review → implementer → qa-reviewer → erp-reviewer
- Modo: localhost + Vercel SIEMPRE al cierre
- Commits: 1 commit cada 10 fixes
- Backup BD antes de cualquier migración
- Aislamiento absoluto Binagre vs David

## Helpers obligatorios (crear ANTES de empezar fixes)

`/src/lib/format.ts` debe contener:

```ts
export const fmtNum = (n, decimals = 2) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

export const fmtEur = (n, opts) => {
  const { showEuro = false, decimals = 2 } = opts || {};
  if (n === null || n === undefined || isNaN(n)) return '—';
  const f = fmtNum(n, decimals);
  return showEuro ? `${f} €` : f;
};

export const fmtPct = (n, decimals = 2) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `${fmtNum(n, decimals)}%`;
};

export const fmtSemana = (numSemana, lunes) => {
  const dd = String(lunes.getDate()).padStart(2, '0');
  const mm = String(lunes.getMonth() + 1).padStart(2, '0');
  const yy = String(lunes.getFullYear()).slice(-2);
  return `S${numSemana}_${dd}_${mm}_${yy}`;
};

export const colorSemaforo = (pct) => {
  if (pct >= 80) return '#1D9E75';
  if (pct >= 50) return '#f5a623';
  return '#E24B4A';
};

export const fmtMes = (mes) => {
  return ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][mes-1] ?? '';
};
```

`/src/components/ui/BarraCumplimiento.tsx` debe contener:

```tsx
import React from 'react';

export const BarraCumplimiento = ({ pct, altura = 8, presupuesto }) => {
  if (presupuesto === 0) {
    return <div style={{ height: altura, borderRadius: altura/2, background: '#ebe8e2' }} />;
  }
  const c = Math.min(Math.max(pct, 0), 100);
  const colorFill = c >= 50 ? '#1D9E75' : '#f5a623';
  return (
    <div style={{ height: altura, borderRadius: altura/2, background: '#ebe8e2', overflow: 'hidden', display: 'flex' }}>
      <div style={{ height: '100%', width: `${c}%`, background: colorFill }} />
      <div style={{ height: '100%', width: `${100-c}%`, background: '#E24B4A' }} />
    </div>
  );
};
```

## Tablas Supabase obligatorias (verificar/crear si faltan)

`objetivos`, `kpi_objetivos`, `running`, `gastos_fijos`, `cuentas_bancarias`, `resumenes_plataforma_marca_mensual`. Schema en `spec-fixes-panel-ronda2.md` (commit `b8bd3a51`). Si no existen, crear con `Supabase apply_migration`.

---

# LISTA 94 FIXES

## FIX 1
Aplicar formato `fmtNum(n, 2)` a TODAS las cifras numéricas del Panel · tab Resumen. Buscar todos los `toLocaleString` ad-hoc y todas las cifras hardcoded sin formateo. Sustituir.

## FIX 2
Quitar símbolo € de Card Facturación cifra Bruto. Archivo `/src/components/panel/resumen/CardVentas.tsx`. Pasar `fmtEur(bruto, { showEuro: false })`.

## FIX 3
Quitar símbolo € de Card Facturación cifra Neto Estimado. Mismo archivo. `fmtEur(neto, { showEuro: false })`.

## FIX 4
Quitar símbolo € de las 3 cantidades editables (5.000 / 20.000 / 240.000) en Card Facturación. Render con `fmtEur(valor, { showEuro: false })`.

## FIX 5
Quitar símbolo € de los textos "Faltan X €" en las 3 líneas de Card Facturación. `fmtEur(falta, { showEuro: false })`.

## FIX 6
Card Facturación: cambiar sublabel de "VENTAS" a "FACTURACIÓN". Solo el texto. Mantener tamaño tipográfico actual.

## FIX 7
Card Facturación: cambiar etiqueta línea semanal "SEMANAL — S18" a `fmtSemana(numSemana, lunesSemana)` que produce "S18_27_04_26" formato. Eliminar la palabra "SEMANAL —".

## FIX 8
Card Facturación: cambiar etiqueta línea mensual "MENSUAL — ABRIL" a solo `fmtMes(mes)` que produce "Abril". Eliminar "MENSUAL —" y eliminar mayúsculas del nombre del mes.

## FIX 9
Card Facturación: cambiar etiqueta línea anual "ANUAL — 2026" a solo `String(año)` que produce "2026". Eliminar "ANUAL —".

## FIX 10
Card Facturación: cifra Bruto al `fontSize: 38, fontWeight: 600, color: '#111111'`. Aplicar literal en CSS inline.

## FIX 11
Card Facturación: cifra Neto Estimado al MISMO TAMAÑO `fontSize: 38, fontWeight: 600, color: '#1D9E75'`. NO `fontSize: 24`. Mismo tamaño exacto que Bruto.

## FIX 12
Card Facturación: las cantidades 5.000 / 20.000 / 240.000 deben venir de tabla Supabase `objetivos` filtrando por `tipo` (semanal/mensual/anual), `año`, `mes`, `semana`. NO hardcoded.

## FIX 13
Card Facturación: si tabla `objetivos` tiene `override_usuario` no nulo, usar ese valor. Si nulo, usar `valor`. Mostrar el resultado.

## FIX 14
Card Facturación: hacer las 3 cantidades editables inline. Click → input number → Enter → `UPDATE objetivos SET override_usuario = nuevoValor WHERE año=X AND tipo=Y` (Y = semanal/mensual/anual).

## FIX 15
Card Facturación: si usuario borra el input editable y pulsa Enter (input vacío), ejecutar `UPDATE objetivos SET override_usuario = NULL` para volver al valor base.

## FIX 16
Card Facturación: las 3 barras de progreso deben usar el componente `<BarraCumplimiento pct={pctSemanal/Mensual/Anual} />` en lugar de barras ad-hoc.

## FIX 17
Card Facturación: el % cumplimiento en cada línea debe colorearse con `colorSemaforo(pct)`. Aplicar también al texto "Faltan X €" → color del semáforo.

## FIX 18
Card Pedidos·TM: cifra "Pedidos" tamaño `fontSize: 38, fontWeight: 600` color `#1E5BCC` (azul Lunes).

## FIX 19
Card Pedidos·TM: cifra "TM Bruto" tamaño `fontSize: 38, fontWeight: 600` color `#F26B1F` (naranja). MISMO tamaño que Pedidos.

## FIX 20
Card Pedidos·TM: cifra "TM Neto" tamaño `fontSize: 38, fontWeight: 600` color `#1D9E75` (verde). MISMO tamaño que Pedidos y TM Bruto.

## FIX 21
Card Pedidos·TM: aplicar `fmtEur(tmBruto, { showEuro: true, decimals: 2 })` para mostrar "24,00 €" con 2 decimales.

## FIX 22
Card Pedidos·TM: aplicar `fmtEur(tmNeto, { showEuro: true, decimals: 2 })` para "16,00 €".

## FIX 23
Card Pedidos·TM: en el desglose por canal, cifra de pedidos coloreada `#1E5BCC` (azul) en TODOS los canales (Uber, Glovo, Just Eat, Web, Directa).

## FIX 24
Card Pedidos·TM: en el desglose por canal, cifra TM Bruto coloreada `#F26B1F` (naranja) en TODOS los canales.

## FIX 25
Card Pedidos·TM: en el desglose por canal, cifra TM Neto coloreada `#1D9E75` (verde) en TODOS los canales.

## FIX 26
Card Pedidos·TM: barra mini de cada canal con `background` del color del canal:
- Uber `#06C167`
- Glovo `#e8f442`
- Just Eat `#f5a623`
- Web `#B01D23`
- Directa `#66aaff`

## FIX 27
Card Pedidos·TM: si Web/Directa NO tienen pedidos (0), mostrar "0" no "—". TM mostrar "0,00 €" no "—". Color del canal aún visible.

## FIX 28
Card Pedidos·TM: aplicar `fmtNum(pedidos, 0)` a número de pedidos (sin decimales). En decimales TM aplicar `fmtEur(tm, { decimals: 2 })`.

## FIX 29
Card Pedidos·TM: PROHIBIDO escribir "Ticket Medio" en cualquier parte. Solo "TM" o "TM Bruto" o "TM Neto".

## FIX 30
Card Resultado: cambiar sublabel "RESULTADO PERIODO" a "RESULTADO". Solo el texto.

## FIX 31
Card Resultado: cifra EBITDA grande con símbolo €. Aplicar `fmtEur(ebitda, { showEuro: true, decimals: 2 })`.

## FIX 32
Card Resultado: TODAS las demás cifras de la card SIN símbolo €. `fmtEur(x, { showEuro: false })`.

## FIX 33
Card Resultado: línea comparativa "1.0 pp vs anterior" cambiar a "1,0 puntos porcentuales vs anterior". Texto literal con coma decimal.

## FIX 34
Card Resultado: SUSTITUIR la cascada actual (4 líneas: Netos estimados, Netos reales factura, Total gastos periodo, Resultado limpio) por cascada PyG completa con 9 líneas en este orden:
1. Ingresos brutos
2. Comisiones + IVA
3. Ingresos netos (bold)
4. Producto
5. Margen bruto (bold)
6. Personal
7. Local + Controlables
8. Provisiones
9. Resultado limpio (bold, color verde si >0, rojo si <0)

## FIX 35
Card Resultado: cada línea de la cascada PyG debe leer su valor desde tabla `running` mes actual. Si campo nulo o `running` vacío: mostrar "Datos insuficientes" en esa línea.

## FIX 36
Card Resultado: cada línea de la cascada debe tener `title` (tooltip HTML) explicando el concepto:
- Ingresos brutos: "Facturación plataforma + venta directa"
- Comisiones + IVA: "Comisiones plataformas + 21% IVA sobre comisiones"
- Ingresos netos: "Lo que de verdad entra a Streat Lab"
- Producto: "Food cost + bebida + packaging + mermas"
- Personal: "Sueldos + SS + sueldos socios"
- Local + Controlables: "Alquiler + IRPF + suministros + marketing + software + gestoría + bancos + transporte + seguros"
- Provisiones: "Provisión IVA + IRPF"
- Resultado limpio: "Lo que queda tras provisiones"

## FIX 37
Card Resultado: bloque Prime Cost al final. Etiqueta "PRIME COST" debe tener tooltip "COGS + Personal sobre netos. KPI hostelería."

## FIX 38
Card Resultado: ELIMINAR texto "Banda sector 55-65%" del bloque Prime Cost.

## FIX 39
Card Resultado: en su lugar, mostrar "Objetivo {valor}%" donde {valor} es editable inline (lectura `kpi_objetivos.prime_cost_target`, default 60).

## FIX 40
Card Resultado: la palabra "Objetivo" del Prime Cost en color `#1D9E75` (verde).

## FIX 41
Card Resultado: el % Prime Cost coloreado con `colorSemaforo(100 - primeCostPct)` (porque menor Prime Cost = mejor).

## FIX 42
Card Resultado: barra del Prime Cost usar `<BarraCumplimiento pct={primeCostPct} />`.

## FIX 43
Cards Plataformas (Uber, Glovo, Just Eat): cifra Bruto al `fontSize: 24, fontWeight: 600`. Misma cifra para Neto al `fontSize: 24, fontWeight: 600`. Mismo tamaño Bruto y Neto.

## FIX 44
Cards Plataformas: aplicar `fmtEur(bruto, { showEuro: false, decimals: 2 })` para mostrar "5.892,13" con 2 decimales sin €.

## FIX 45
Cards Plataformas: aplicar `fmtEur(neto, { showEuro: false, decimals: 2 })` para Neto.

## FIX 46
Cards Plataformas: cambiar texto "neto · 64% margen" por "Margen {fmtPct(margenPct, 2)}" → "Margen 64,00%". Con 2 decimales.

## FIX 47
Cards Plataformas: cambiar texto "bruto" por "Bruto" (B mayúscula).

## FIX 48
Cards Plataformas: Card Glovo añadir `border: '1px solid #5a5500'` (no `0.5px solid #e8f442` que es invisible sobre amarillo).

## FIX 49
Cards Plataformas: cálculo neto canal real desde tabla `resumenes_plataforma_marca_mensual`:
```ts
const datos = supabase.from('resumenes_plataforma_marca_mensual').select('bruto,comisiones,fees,cargos_promocion,neto_real_cobrado').eq('plataforma',canal).eq('mes',mes).eq('año',año);
if (tieneRealCobrado) neto = sum(neto_real_cobrado);
else neto = bruto - comisiones - fees - cargos - 0.21*(comisiones+fees+cargos);
```

## FIX 50
Cards Plataformas: si `resumenes_plataforma_marca_mensual` NO tiene datos del canal del mes actual, mostrar "Datos insuficientes". Si SÍ tiene datos pero algunos canales sin facturación: mostrar 0,00.

## FIX 51
Cards Plataformas: Just Eat debe mostrar sus datos reales si los hay (verificar tabla, no debe quedarse sin renderizar).

## FIX 52
Cards Grupos de gasto: aplicar `fmtEur(consumido, { showEuro: true, decimals: 2 })` con € y 2 decimales.

## FIX 53
Cards Grupos de gasto: aplicar `fmtEur(presupuesto, { showEuro: true, decimals: 2 })` con € y 2 decimales.

## FIX 54
Cards Grupos de gasto: aplicar `fmtEur(desviacion, { showEuro: false, decimals: 2 })` SIN € en la desviación. Solo en la desviación.

## FIX 55
Cards Grupos de gasto: en la desviación, usar signo coherente: si `consumido < presupuesto` → desviacion negativa color `#1D9E75` (verde, bien). Si `consumido > presupuesto` → desviacion positiva con prefijo "+" color `#E24B4A` (rojo, sobrecoste).

## FIX 56
Cards Grupos de gasto: en cabecera derecha SOLO de Card Producto mostrar "Food Cost X%" en color `#1D9E75` (verde). Tanto las palabras "Food Cost" como el % en verde.

## FIX 57
Cards Grupos de gasto: en cabecera derecha de Equipo, Local, Controlables: ELIMINAR el "% s/netos X%". No mostrar nada en cabecera derecha.

## FIX 58
Cards Grupos de gasto: ELIMINAR el texto "Banda 25-30%" / "Banda 30-35%" / "Banda 5-10%" / "Banda 13-18%" de la línea inferior.

## FIX 59
Cards Grupos de gasto: en línea inferior izquierda mostrar "Objetivo {pct}%" donde {pct} es editable inline. Lectura desde `kpi_objetivos.presupuesto_{grupo}_pct`. Defaults: producto 30, personal 40, local 15, controlables 15.

## FIX 60
Cards Grupos de gasto: barra de progreso usar `<BarraCumplimiento pct={consumoPct} presupuesto={presupuesto} />`. Si `presupuesto === 0`: barra vacía gris.

## FIX 61
Cards Grupos de gasto: % consumo de cabecera derecha (al lado de la cifra grande) coloreado con `colorSemaforo(100 - Math.min(consumoPct, 100))`. Menos consumo = mejor.

## FIX 62
Cards Grupos de gasto: cálculo `presupuesto = (running.ingresos_netos * pctObjetivo / 100)`. Sin IVA. Lectura desde `running.ingresos_netos` mes actual.

## FIX 63
Cards Grupos de gasto: cálculo `consumido = running.{grupo}` mes actual. SIN IVA (asumir tabla `running` ya tiene gastos sin IVA).

## FIX 64
Cards Grupos de gasto: si `running` está vacío para el mes: mostrar "Datos insuficientes" en consumido y presupuesto.

## FIX 65
Card Días Pico: título cambiar a `DÍAS PICO — ${fmtMes(mes)} - Facturación Bruta`. Ejemplo "DÍAS PICO — Abril - Facturación Bruta".

## FIX 66
Card Días Pico: TODOS los valores encima de barras al MISMO `fontSize: 11`. NO uno más grande que otro. Color `#7a8090` para todos. NO destacar el día más fuerte con weight 500. Todos iguales.

## FIX 67
Card Días Pico: aplicar `fmtNum(valor, 2)` a TODOS los valores encima de barras → "1.111,00", "2.168,00", etc. Con 2 decimales y separador miles.

## FIX 68
Card Días Pico: añadir línea media dashed cruzando las barras horizontalmente:
```svg
<line x1="15" y1={yMedia} x2="445" y2={yMedia} stroke="#3a4050" strokeDasharray="6 4" strokeWidth="1.5" />
<text x="445" y={yMedia - 6} fontSize="11" fill="#3a4050" fontWeight="500" textAnchor="end">Media: {fmtNum(mediaSemanal, 2)}</text>
```
Color oscuro para que se lea, no muted.

## FIX 69
Card Días Pico: ELIMINAR la palabra "RESUMEN" del bloque inferior.

## FIX 70
Card Días Pico: cambiar texto "Día más débil" por "Día más flojo".

## FIX 71
Card Días Pico: en bloque inferior aplicar `fmtNum(valor, 2)` a TODOS los valores ("Domingo · 2.168,00", "Miércoles · 819,00", "1.331,00").

## FIX 72
Card Días Pico: datos REALES desde Supabase tabla `facturacion_diaria` agrupada por DOW del mes seleccionado. Lectura:
```ts
supabase.from('facturacion_diaria').select('fecha,bruto').gte('fecha',inicioMes).lte('fecha',finMes);
```
Agrupar por día semana y sumar.

## FIX 73
Card Saldo: cambiar título "SALDO + PROYECCIÓN" a "PROYECCIONES". Solo el texto.

## FIX 74
Card Saldo: lectura saldo real desde tabla `cuentas_bancarias`:
```ts
supabase.from('cuentas_bancarias').select('saldo_actual').eq('titular','streat_lab').eq('activa',true);
```
Sumar todos los saldos. SI HAY DATOS, mostrar valor real. NO "Datos insuficientes" si la tabla tiene datos.

## FIX 75
Card Saldo: cifra grande del saldo `fmtEur(saldoTotal, { showEuro: true, decimals: 2 })` con €.

## FIX 76
Card Saldo: bajo el saldo grande, texto "Saldo cuentas Streat Lab" con tooltip "Suma del saldo actual de las cuentas bancarias de Streat Lab".

## FIX 77
Card Saldo: ELIMINAR completamente la barra "Hoy → 30d" y los puntos circulares verde/oscuro de los extremos. Borrar el bloque entero. NO sustituir por nada.

## FIX 78
Card Saldo: lectura cobros 7d/30d desde Supabase con cálculo según ciclos pago plataforma:
- Uber: lunes próximo a cierre semana anterior
- Glovo días 1-15: paga día 5 mes siguiente
- Glovo días 16-fin: paga día 20 mes siguiente
- Just Eat días 1-15: paga día 20 mismo mes
- Just Eat días 16-fin: paga día 5 mes siguiente

Si tabla `resumenes_plataforma_marca_mensual` tiene `neto_real_cobrado` no nulo, usar valor real (modo híbrido). Si nulo, estimar.

## FIX 79
Card Saldo: lectura pagos 7d/30d:
- Pagos fijos desde `gastos_fijos WHERE proxima_fecha_pago BETWEEN hoy AND hoy+Nd`
- Pagos variables desde tabla `pagos_variables` (módulo Pagos y Cobros) si existe, sino 0 por ahora.

## FIX 80
Card Saldo: aplicar `fmtEur` con `{ showEuro: false, decimals: 2 }` a Cobros 7d, Pagos 7d, Proyección 7d, Cobros 30d, Pagos 30d, Proyección 30d. SIN € en estas líneas.

## FIX 81
Card Ratio: cambiar texto "obj" por "Objetivo". Mantenerlo en color `#1D9E75` (verde) tanto la palabra como la cifra editable.

## FIX 82
Card Ratio: la cifra editable del objetivo en color `#1D9E75` (verde).

## FIX 83
Card Ratio: el coeficiente grande (ej. 2,00) coloreado con `colorSemaforo((ratio/objetivo) * 100)`.

## FIX 84
Card Ratio: bajo el coeficiente grande, INMEDIATAMENTE poner la barra de desviación con `<BarraCumplimiento pct={(ratio/objetivo) * 100} altura={6} />` y texto "▼ X% bajo objetivo" o "▲ X% sobre objetivo" con color del semáforo.

## FIX 85
Card Ratio: ELIMINAR el bloque inferior "Distancia al objetivo" (que estaba al final). Ya está movido arriba bajo el coeficiente.

## FIX 86
Card Ratio: cambiar las líneas detalle. ELIMINAR "Netos estimados" y "Netos reales factura". Sustituir por:
- "Ingresos netos" (lectura `running.ingresos_netos`)
- "Gastos fijos" (con tooltip "Gastos fijos conocidos: alquiler, SS, nóminas, etc.")
- "Gastos reales" (con tooltip "Gastos variables que cambian mes a mes")

## FIX 87
Card Ratio: cálculo `ratio = ingresosNetos / (gastosFijos + gastosVariables)`. Lectura `running.ingresos_netos`, `running.gastos_fijos_periodo`, `running.gastos_variables_periodo`. SI HAY DATOS EN RUNNING, mostrar valores reales. NO "Datos insuficientes" si tabla tiene fila.

## FIX 88
Card Ratio: el título "RATIO INGRESOS / GASTOS" añadir tooltip "Euros que entran por cada euro de gasto. Mayor es mejor."

## FIX 89
Card Punto Equilibrio: cifra "Bruto necesario" con B mayúscula. Texto literal "Bruto necesario".

## FIX 90
Card Punto Equilibrio: ELIMINAR el texto "9.610 € netos" del subtítulo. Solo dejar "Bruto necesario".

## FIX 91
Card Punto Equilibrio: aplicar `fmtPct(pct, 2)` para mostrar "100,00%" con 2 decimales.

## FIX 92
Card Punto Equilibrio: cambiar "Día verde estimado · Alcanzado ✓" por texto dinámico:
- Si pct >= 100: "Día N · ✓ alcanzado" (donde N es el día del mes en que se alcanzó)
- Si pct < 100 y diaVerdeEstimado <= diasMes: "Día N"
- Si pct < 100 y diaVerdeEstimado > diasMes: "+Nd sobre mes" (donde N = diaVerdeEstimado - diasMes)
Texto color `#1D9E75` (verde).

## FIX 93
Card Punto Equilibrio: unificar líneas "Facturación día" y "Pedidos día" en UNA sola línea con etiqueta "Pedidos día / TM" y valor `<span color azul>{pedidos}</span> / <span color naranja>{fmtEur(tm, {decimals:2})}</span>`.

## FIX 94
Card Punto Equilibrio: cambiar "Real actual" por "Realidad hoy". Tooltip "Lo que estamos facturando de media diaria en el periodo seleccionado".

---

# CHECKLIST FINAL OBLIGATORIO

Code debe rellenar este checklist en `.claude/tracking/informe-fixes-panel-94.md`:

```
FIX 1  · ✅/❌ · {motivo si ❌}
FIX 2  · ✅/❌ · {motivo si ❌}
FIX 3  · ✅/❌ · {motivo si ❌}
...
FIX 94 · ✅/❌ · {motivo si ❌}

TOTAL: X/94 ✅
```

PROHIBIDO marcar un fix como ✅ si no está realmente aplicado y verificado en localhost.

---

# CONFIGURACIÓN ADICIONAL FUERA DEL TAB RESUMEN

Estos puntos no son fixes numerados pero también deben aplicarse:

A) Banner amarillo: archivo `/src/components/ui/BannerPendientes.tsx` con `padding: '6px 14px'`, `fontSize: 12`, botón "IR AL IMPORTADOR" `padding: '4px 10px'` `fontSize: 11`, botón cierre `<X size={14} />`.

B) Marco contenedor tabs: `/src/components/ui/TabsPastilla.tsx` container con `padding: '4px 6px'`, `borderRadius: 10`, `gap: 4`.

C) Dropdowns con `<ChevronDown size={11} strokeWidth={2.5} />` en TODOS los dropdowns del Panel: Mes en curso, Todas las marcas, Canales. Buscar `▾` y sustituir.

D) Dropdown Marcas items: `padding: '3px 8px'`, `fontSize: 12`, `lineHeight: 1.2`. Container `maxHeight: 360, overflowY: 'auto'`.

E) Layout fila 4 del tab Resumen: `gridTemplateColumns: '1fr 2fr'`. Provisiones ocupa 1/3, Top Ventas 2/3.

F) Verificar que `<CardPendientesSubir />` NO se renderiza en `TabResumen.tsx`. Si está, eliminar import + uso.

---

# ORDEN DE EJECUCIÓN

1. Crear/verificar helpers `/src/lib/format.ts`
2. Crear/verificar `/src/components/ui/BarraCumplimiento.tsx`
3. Verificar tablas Supabase obligatorias, crear si faltan
4. Ejecutar FIX 1 → marcar ✅ → FIX 2 → marcar ✅ → ... → FIX 94 → marcar ✅
5. Aplicar Configuración Adicional A-F
6. Validación mobile 375/768/1280 con capturas en `.claude/tracking/mobile-validation/ronda2/`
7. Build + tests
8. Commit final + push master
9. Deploy Vercel automático
10. Escribir informe `.claude/tracking/informe-fixes-panel-94.md` con checklist 94 fixes + URL Vercel

NO PARAR ENTRE FIXES. Si un fix falla, marcar ❌ con motivo y CONTINUAR con el siguiente.

Tras último fix: deploy Vercel + URL final.
